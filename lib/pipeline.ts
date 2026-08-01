import type { SupabaseClient } from "@supabase/supabase-js";
import { getCollector } from "./collectors";
import type { NormalizedPost } from "./collectors/types";
import { analyzeCommentBatch, COMMENT_BATCH_SIZE } from "./claude";
import { computeAggregates, buildCommentSample, type CommentRow, type CommentSampleItem, type Aggregates } from "./aggregate";
import { MODULE_DEFINITIONS, runAnalysisModule } from "./analysis-modules";
import {
  runPlatformModule,
  runInsightSynthesis,
  runPositioningSynthesis,
  runStrategySynthesis,
  runExecutiveSummarySynthesis,
} from "./synthesis-modules";
import { searchValidatedReferences, type ValidatedReference } from "./reference-search";
import { extractVisualData } from "./visual-data";
import { wrapStoredContent, renderStoredContentToMarkdown } from "./insight-types";
import {
  claimNextTask,
  completeTask,
  enqueueTasks,
  failTask,
  countUnfinishedInPhase,
  phaseTasksExist,
  getPhaseTaskCounts,
  type AnalysisTask,
} from "./task-queue";

// ---------------------------------------------------------------------------
// 파이프라인 단계 정의
// ---------------------------------------------------------------------------

const PHASE_ORDER = [
  "collect",
  "classify",
  "aggregate",
  "modules",
  "platform",
  "cross",
  "positioning",
  "strategy_actions",
  "reference",
  "executive_summary",
  "visual_data",
  "assemble",
] as const;
type Phase = (typeof PHASE_ORDER)[number];

// 각 phase 진입 시점의 progress(%) - 대략적인 체감용
const PHASE_START_PROGRESS: Record<Phase, number> = {
  collect: 0,
  classify: 15,
  aggregate: 45,
  modules: 50,
  platform: 75,
  cross: 82,
  positioning: 85,
  strategy_actions: 89,
  reference: 93,
  executive_summary: 95,
  visual_data: 97,
  assemble: 98,
};

type Job = {
  id: string;
  keyword: string;
  period_start: string;
  period_end: string;
  max_videos: number;
  max_comments_per_video: number;
  status: string;
};

function isPhase(v: string): v is Phase {
  return (PHASE_ORDER as readonly string[]).includes(v);
}

// 이 태스크들이 완전히 실패하면 리포트 자체를 만들 수 없으므로 job 전체를 실패 처리한다.
// 그 외(모듈 하나, X 수집, 레퍼런스 검색 등)는 실패해도 해당 부분만 비운 채 계속 진행한다.
const CRITICAL_TASK_TYPES = new Set(["collect_youtube", "aggregate", "assemble"]);

async function setJobState(admin: SupabaseClient, jobId: string, patch: Record<string, unknown>) {
  await admin
    .from("research_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

/** 30초 넘게 processing 상태에 멈춰있는 태스크는 서버리스 함수가 죽은 것으로 보고 재시도 대상으로 되돌린다. */
async function recoverStaleTasks(admin: SupabaseClient, jobId: string) {
  const staleBefore = new Date(Date.now() - 30_000).toISOString();
  await admin
    .from("analysis_tasks")
    .update({ status: "pending" })
    .eq("job_id", jobId)
    .eq("status", "processing")
    .lt("updated_at", staleBefore);
}

// ---------------------------------------------------------------------------
// 메인 스텝 함수: /api/jobs/[jobId]/step 라우트에서 호출
// ---------------------------------------------------------------------------

export async function stepJob(
  admin: SupabaseClient,
  job: Job
): Promise<{ done: boolean; failed?: boolean; status?: string; progress?: number }> {
  await recoverStaleTasks(admin, job.id);

  const task = await claimNextTask(admin, job.id);
  if (task) {
    const phase = (task.payload?.phase as Phase | undefined) ?? "collect";
    try {
      await executeTask(admin, job, task);
      await completeTask(admin, task.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanentlyFailed = await failTask(admin, task, message);
      if (permanentlyFailed) {
        if (CRITICAL_TASK_TYPES.has(task.task_type)) {
          await setJobState(admin, job.id, {
            status: "failed",
            error_message: `[${task.task_type}] ${message}`,
          });
          return { done: true, failed: true };
        }
        // 핵심 태스크가 아니면 이 부분만 비워두고 리포트 전체는 계속 진행한다.
        console.error(`[stepJob] 비핵심 태스크 영구 실패, 건너뜀 (${task.task_type}): ${message}`);
      }
    }
    await updateIntraPhaseProgress(admin, job.id, phase);
    return { done: false };
  }

  // 대기 중인 태스크가 없다 = 현재 phase가 끝났거나, 아직 phase가 시작 안 됐다.
  const currentPhase: Phase = isPhase(job.status) ? job.status : "collect";
  const unfinished = await countUnfinishedInPhase(admin, job.id, currentPhase);
  if (unfinished > 0) {
    // processing 상태인 게 남아있음 (드물게 stale 복구 직후 등) - 다음 호출에서 다시 claim됨
    return { done: false };
  }

  const started = await phaseTasksExist(admin, job.id, currentPhase);
  if (!started) {
    // 이 phase의 태스크가 아직 하나도 생성되지 않음 -> 지금 생성
    if (job.status !== currentPhase) {
      await setJobState(admin, job.id, { status: currentPhase, progress: PHASE_START_PROGRESS[currentPhase], error_message: null });
    }
    await enqueuePhase(admin, job, currentPhase);
    return { done: false };
  }

  // 이 phase의 태스크가 전부 끝남(성공 또는 영구실패) -> 다음 phase로
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === PHASE_ORDER.length - 1) {
    // assemble까지 끝났는데 아직 done 처리가 안 됐다면(이례적) 여기서 마무리
    await setJobState(admin, job.id, { status: "done", progress: 100 });
    return { done: true };
  }

  const nextPhase = PHASE_ORDER[currentIndex + 1];
  await setJobState(admin, job.id, {
    status: nextPhase,
    progress: PHASE_START_PROGRESS[nextPhase],
  });
  return { done: false };
}

async function updateIntraPhaseProgress(admin: SupabaseClient, jobId: string, phase: Phase) {
  const { total, done } = await getPhaseTaskCounts(admin, jobId, phase);
  if (total === 0) return;
  const currentIndex = PHASE_ORDER.indexOf(phase);
  const nextPhase = PHASE_ORDER[currentIndex + 1] ?? phase;
  const start = PHASE_START_PROGRESS[phase];
  const end = PHASE_START_PROGRESS[nextPhase];
  const progress = Math.round(start + (done / total) * (end - start));
  await setJobState(admin, jobId, { progress });
}

// ---------------------------------------------------------------------------
// Phase별 태스크 생성
// ---------------------------------------------------------------------------

async function enqueuePhase(admin: SupabaseClient, job: Job, phase: Phase) {
  switch (phase) {
    case "collect": {
      const tasks: { type: string; payload: Record<string, unknown> }[] = [
        { type: "collect_youtube", payload: { phase: "collect", platform: "youtube" } },
      ];
      if (getCollector("x").isConfigured()) {
        tasks.push({ type: "collect_x", payload: { phase: "collect", platform: "x" } });
      }
      await enqueueTasks(admin, job.id, tasks);
      return;
    }

    case "classify": {
      const { data: comments } = await admin
        .from("youtube_comments")
        .select("comment_id")
        .eq("job_id", job.id);
      const { data: posts } = await admin.from("social_posts").select("id").eq("job_id", job.id);

      const tasks: { type: string; payload: Record<string, unknown> }[] = [];
      const commentIds = (comments ?? []).map((c) => c.comment_id);
      for (let i = 0; i < commentIds.length; i += COMMENT_BATCH_SIZE) {
        tasks.push({
          type: "classify_batch",
          payload: { phase: "classify", platform: "youtube", ids: commentIds.slice(i, i + COMMENT_BATCH_SIZE) },
        });
      }
      const postIds = (posts ?? []).map((p) => p.id);
      for (let i = 0; i < postIds.length; i += COMMENT_BATCH_SIZE) {
        tasks.push({
          type: "classify_batch",
          payload: { phase: "classify", platform: "x", ids: postIds.slice(i, i + COMMENT_BATCH_SIZE) },
        });
      }
      await enqueueTasks(admin, job.id, tasks);
      return;
    }

    case "aggregate":
      await enqueueTasks(admin, job.id, [{ type: "aggregate", payload: { phase: "aggregate" } }]);
      return;

    case "modules":
      await enqueueTasks(
        admin,
        job.id,
        MODULE_DEFINITIONS.map((def) => ({
          type: `module_${def.key}`,
          payload: { phase: "modules", moduleKey: def.key },
        }))
      );
      return;

    case "platform": {
      const { count: postCount } = await admin
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id);
      const tasks: { type: string; payload: Record<string, unknown> }[] = [
        { type: "platform_youtube", payload: { phase: "platform", platform: "youtube" } },
      ];
      if ((postCount ?? 0) > 0) {
        tasks.push({ type: "platform_x", payload: { phase: "platform", platform: "x" } });
      }
      await enqueueTasks(admin, job.id, tasks);
      return;
    }

    case "cross": {
      const { count: postCount } = await admin
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id);
      if ((postCount ?? 0) > 0) {
        await enqueueTasks(admin, job.id, [{ type: "cross_platform", payload: { phase: "cross" } }]);
      } else {
        // X 데이터가 없으면 크로스플랫폼 분석은 의미가 없으므로 생략한다.
        // (phase를 "시작됨"으로 표시하기 위해 아무 것도 안 하는 태스크를 하나 넣어 즉시 통과시킨다)
        await enqueueTasks(admin, job.id, [{ type: "noop", payload: { phase: "cross" } }]);
      }
      return;
    }

    case "positioning":
      await enqueueTasks(admin, job.id, [{ type: "positioning_strategy", payload: { phase: "positioning" } }]);
      return;

    case "strategy_actions":
      await enqueueTasks(admin, job.id, [
        { type: "strategy_actions_ideas", payload: { phase: "strategy_actions" } },
      ]);
      return;

    case "reference":
      await enqueueTasks(admin, job.id, [{ type: "reference_search", payload: { phase: "reference" } }]);
      return;

    case "executive_summary":
      await enqueueTasks(admin, job.id, [
        { type: "executive_summary", payload: { phase: "executive_summary" } },
      ]);
      return;

    case "visual_data":
      await enqueueTasks(admin, job.id, [{ type: "visual_data", payload: { phase: "visual_data" } }]);
      return;

    case "assemble":
      await enqueueTasks(admin, job.id, [{ type: "assemble", payload: { phase: "assemble" } }]);
      return;
  }
}

// ---------------------------------------------------------------------------
// 태스크 실행기
// ---------------------------------------------------------------------------

async function loadCombinedData(admin: SupabaseClient, jobId: string) {
  const { data: comments } = await admin
    .from("youtube_comments")
    .select("comment_id, video_id, text_original, like_count, published_at")
    .eq("job_id", jobId);
  const { data: posts } = await admin.from("social_posts").select("*").eq("job_id", jobId);
  const { data: commentAnalyses } = await admin.from("comment_analysis").select("*").eq("job_id", jobId);
  const { data: postAnalyses } = await admin.from("post_analysis").select("*").eq("job_id", jobId);

  const rows: CommentRow[] = [
    ...(comments ?? []).map((c) => ({
      commentId: c.comment_id as string,
      videoId: c.video_id as string,
      textOriginal: c.text_original as string,
      likeCount: c.like_count as number,
      publishedAt: c.published_at as string | null,
      platform: "youtube" as const,
    })),
    ...(posts ?? []).map((p) => ({
      commentId: p.id as string,
      videoId: p.url ?? p.external_id,
      textOriginal: p.text_original as string,
      likeCount: p.like_count as number,
      publishedAt: p.created_at as string | null,
      platform: "x" as const,
    })),
  ];

  const analyses = [
    ...(commentAnalyses ?? []).map((a) => ({
      commentId: a.comment_id as string,
      sentiment: a.sentiment,
      purchaseIntent: a.purchase_intent,
      adReaction: a.ad_reaction,
      riskFlag: a.risk_flag,
      extractedKeywords: a.extracted_keywords ?? [],
      fandomExpressions: a.fandom_expressions ?? [],
    })),
    ...(postAnalyses ?? []).map((a) => ({
      commentId: a.post_id as string,
      sentiment: a.sentiment,
      purchaseIntent: a.purchase_intent,
      adReaction: a.ad_reaction,
      riskFlag: a.risk_flag,
      extractedKeywords: a.extracted_keywords ?? [],
      fandomExpressions: a.fandom_expressions ?? [],
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any[];

  return { rows, analyses, hasX: (posts ?? []).length > 0 };
}

async function getStoredStatsAndSample(
  admin: SupabaseClient,
  jobId: string
): Promise<{ stats: Aggregates; sample: CommentSampleItem[]; platforms: ("youtube" | "x")[] }> {
  const { data: insight } = await admin
    .from("job_insights")
    .select("top_keywords, sentiment_ratio, daily_trend, fandom_highlights, purchase_intent_summary, risk_alerts, raw_json")
    .eq("job_id", jobId)
    .maybeSingle();

  const raw = (insight?.raw_json ?? {}) as { sample?: CommentSampleItem[] };
  const stats: Aggregates = {
    topKeywords: insight?.top_keywords ?? [],
    sentimentRatio: insight?.sentiment_ratio ?? { positive: 0, negative: 0, neutral: 0 },
    dailyTrend: insight?.daily_trend ?? [],
    fandomHighlights: insight?.fandom_highlights ?? [],
    purchaseIntentSummary: insight?.purchase_intent_summary ?? { positiveRatio: 0, examples: [] },
    riskGroups: (insight?.risk_alerts ?? []).map((r: { level: "caution" | "high_risk"; count?: number; example_comment_id?: string | null }) => ({
      level: r.level,
      count: r.count ?? 0,
      examples: [],
      exampleCommentIds: r.example_comment_id ? [r.example_comment_id] : [],
    })),
  };
  const sample = raw.sample ?? [];
  const platforms = Array.from(new Set(sample.map((s) => s.platform)));
  return { stats, sample, platforms: platforms.length ? platforms : ["youtube"] };
}

async function getAllModules(admin: SupabaseClient, jobId: string) {
  const { data } = await admin
    .from("job_analysis_modules")
    .select("module_key, platform, title, content_md")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  return (data ?? []) as { module_key: string; platform: string | null; title: string; content_md: string }[];
}

/** 이전 단계 모듈들을 다음 LLM 호출의 프롬프트 컨텍스트로 넣기 위한 텍스트로 변환 (신규 구조화/레거시 마크다운 모두 처리). */
function modulesToPromptText(modules: { title: string; content_md: string }[]): string {
  return modules.map((m) => renderStoredContentToMarkdown(m.title, m.content_md)).join("\n\n---\n\n");
}

async function saveModule(
  admin: SupabaseClient,
  jobId: string,
  moduleKey: string,
  platform: string | null,
  result: { title: string; content: string }
) {
  const { error } = await admin.from("job_analysis_modules").upsert(
    {
      job_id: jobId,
      module_key: moduleKey,
      platform,
      title: result.title,
      content_md: result.content,
      model_version: "claude-sonnet-5",
    },
    { onConflict: "job_id,module_key" }
  );
  if (error) throw new Error(`모듈 저장 실패(${moduleKey}): ${error.message}`);
}

async function executeTask(admin: SupabaseClient, job: Job, task: AnalysisTask) {
  const payload = task.payload ?? {};

  switch (task.task_type) {
    case "collect_youtube": {
      const collector = getCollector("youtube");
      const result = await collector.collect({
        keyword: job.keyword,
        periodStart: job.period_start,
        periodEnd: job.period_end,
        maxVideos: job.max_videos,
        maxCommentsPerVideo: job.max_comments_per_video,
      });

      if (result.videos?.length) {
        const { error } = await admin.from("youtube_videos").upsert(
          result.videos.map((v) => ({
            job_id: job.id,
            video_id: v.videoId,
            channel_id: v.channelId,
            channel_title: v.channelTitle,
            title: v.title,
            description: v.description,
            published_at: v.publishedAt,
            view_count: v.viewCount,
            like_count: v.likeCount,
            comment_count: v.commentCount,
            platform: "youtube",
          })),
          { onConflict: "video_id,job_id" }
        );
        if (error) throw new Error(`영상 저장 실패: ${error.message}`);
      }

      if (result.posts.length) {
        const { error } = await admin.from("youtube_comments").upsert(
          result.posts.map((p: NormalizedPost) => ({
            job_id: job.id,
            video_id: p.videoId,
            comment_id: p.externalId,
            author_display: null,
            text_original: p.text,
            like_count: p.likeCount,
            published_at: p.createdAt,
            platform: "youtube",
          })),
          { onConflict: "comment_id", ignoreDuplicates: true }
        );
        if (error) throw new Error(`댓글 저장 실패: ${error.message}`);
      }
      return;
    }

    case "collect_x": {
      const collector = getCollector("x");
      if (!collector.isConfigured()) return; // 미연결 - 조용히 스킵 (X_NOT_CONFIGURED)

      const result = await collector.collect({
        keyword: job.keyword,
        periodStart: job.period_start,
        periodEnd: job.period_end,
        maxPosts: Math.max(50, job.max_comments_per_video * 3),
      });

      if (result.posts.length) {
        const { error } = await admin.from("social_posts").upsert(
          result.posts.map((p: NormalizedPost) => ({
            job_id: job.id,
            platform: "x",
            external_id: p.externalId,
            url: p.url,
            author: p.author,
            text_original: p.text,
            created_at: p.createdAt,
            like_count: p.likeCount,
            share_count: p.shareCount ?? 0,
            reply_count: p.replyCount ?? 0,
            quote_count: p.quoteCount ?? 0,
            language: p.language,
            hashtags: p.hashtags ?? [],
            mentions: p.mentions ?? [],
            referenced_post_id: p.referencedPostId,
            search_query: p.searchQuery,
          })),
          { onConflict: "platform,external_id", ignoreDuplicates: true }
        );
        if (error) throw new Error(`X 게시물 저장 실패: ${error.message}`);
      }
      return;
    }

    case "classify_batch": {
      const platform = payload.platform as "youtube" | "x";
      const ids = (payload.ids as string[]) ?? [];
      if (ids.length === 0) return;

      let items: { id: string; text: string }[] = [];
      if (platform === "youtube") {
        const { data } = await admin
          .from("youtube_comments")
          .select("comment_id, text_original")
          .in("comment_id", ids);
        items = (data ?? []).map((c) => ({ id: c.comment_id, text: c.text_original }));
      } else {
        const { data } = await admin.from("social_posts").select("id, text_original").in("id", ids);
        items = (data ?? []).map((p) => ({ id: p.id, text: p.text_original }));
      }
      if (items.length === 0) return;

      const idSet = new Set(items.map((i) => i.id));
      const results = (
        await analyzeCommentBatch(
          job.keyword,
          items.map((i) => ({ commentId: i.id, text: i.text }))
        )
      ).filter((r) => idSet.has(r.commentId));

      if (results.length === 0) return;

      if (platform === "youtube") {
        const { error } = await admin.from("comment_analysis").upsert(
          results.map((r) => ({
            job_id: job.id,
            comment_id: r.commentId,
            sentiment: r.sentiment,
            purchase_intent: r.purchaseIntent,
            ad_reaction: r.adReaction,
            risk_flag: r.riskFlag,
            extracted_keywords: r.extractedKeywords,
            fandom_expressions: r.fandomExpressions,
            raw_json: r,
            model_version: "claude-haiku-4-5-20251001",
          })),
          { onConflict: "comment_id" }
        );
        if (error) console.error(`[classify_batch] comment_analysis 저장 실패: ${error.message}`);
      } else {
        const { error } = await admin.from("post_analysis").upsert(
          results.map((r) => ({
            job_id: job.id,
            post_id: r.commentId,
            sentiment: r.sentiment,
            purchase_intent: r.purchaseIntent,
            ad_reaction: r.adReaction,
            risk_flag: r.riskFlag,
            extracted_keywords: r.extractedKeywords,
            fandom_expressions: r.fandomExpressions,
            raw_json: r,
            model_version: "claude-haiku-4-5-20251001",
          })),
          { onConflict: "post_id" }
        );
        if (error) console.error(`[classify_batch] post_analysis 저장 실패: ${error.message}`);
      }
      return;
    }

    case "aggregate": {
      const { rows, analyses } = await loadCombinedData(admin, job.id);
      const stats = computeAggregates(rows, analyses);
      const sample = buildCommentSample(rows, analyses, 60);

      const { error } = await admin.from("job_insights").upsert(
        {
          job_id: job.id,
          top_keywords: stats.topKeywords,
          sentiment_ratio: stats.sentimentRatio,
          daily_trend: stats.dailyTrend,
          fandom_highlights: stats.fandomHighlights,
          purchase_intent_summary: stats.purchaseIntentSummary,
          risk_alerts: stats.riskGroups.map((g) => ({
            level: g.level,
            count: g.count,
            description: `${g.level === "high_risk" ? "고위험" : "주의"} 댓글/게시물 ${g.count}건 발견`,
            example_comment_id: g.exampleCommentIds[0] ?? null,
          })),
          raw_json: { sample },
        },
        { onConflict: "job_id" }
      );
      if (error) throw new Error(`집계 저장 실패: ${error.message}`);
      return;
    }

    case "noop":
      return;

    default:
      break;
  }

  // module_* 태스크
  if (task.task_type.startsWith("module_")) {
    const moduleKey = task.task_type.replace("module_", "");
    const def = MODULE_DEFINITIONS.find((d) => d.key === moduleKey);
    if (!def) return;

    const { stats, sample, platforms } = await getStoredStatsAndSample(admin, job.id);
    const { title, result } = await runAnalysisModule(def, {
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      platforms,
      stats,
      sample,
    });
    await saveModule(admin, job.id, def.key, null, { title, content: wrapStoredContent({ kind: "insights", data: result }) });
    return;
  }

  if (task.task_type === "platform_youtube" || task.task_type === "platform_x") {
    const platform = task.task_type === "platform_youtube" ? "youtube" : "x";
    const { stats, sample } = await getStoredStatsAndSample(admin, job.id);
    const filteredSample = sample.filter((s) => s.platform === platform);
    if (platform === "x" && filteredSample.length === 0) return; // X 데이터 없으면 스킵

    const { title, result } = await runPlatformModule({
      platform,
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      stats,
      sample: filteredSample.length ? filteredSample : sample,
    });
    await saveModule(admin, job.id, `platform_${platform}`, platform, {
      title,
      content: wrapStoredContent({ kind: "insights", data: result }),
    });
    return;
  }

  if (task.task_type === "cross_platform") {
    const modules = await getAllModules(admin, job.id);
    const yt = modules.find((m) => m.module_key === "platform_youtube");
    const x = modules.find((m) => m.module_key === "platform_x");
    if (!yt || !x) return;

    const result = await runInsightSynthesis({
      title: "Cross-Platform Insight",
      instruction: `YouTube와 X 두 플랫폼의 분석을 비교하여 AGREEMENT(공통 인식), PLATFORM-SPECIFIC(특정 플랫폼에서만 강한 인식),
CONTRADICTION(플랫폼별로 다른 반응)을 구분하라. 이 차이 자체를 전략적 Insight로 활용하라.`,
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      inputModulesText: modulesToPromptText([yt, x]),
      maxTokens: 2500,
    });
    await saveModule(admin, job.id, "cross_platform", "cross", {
      title: "Cross-Platform Insight",
      content: wrapStoredContent({ kind: "insights", data: result }),
    });
    return;
  }

  if (task.task_type === "positioning_strategy") {
    const modules = await getAllModules(admin, job.id);
    const result = await runPositioningSynthesis({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      inputModulesText: modulesToPromptText(modules),
    });
    await saveModule(admin, job.id, "positioning_strategy", null, {
      title: "Positioning Opportunities & Recommended Position",
      content: wrapStoredContent({ kind: "positioning", data: result }),
    });
    return;
  }

  if (task.task_type === "strategy_actions_ideas") {
    const modules = await getAllModules(admin, job.id);
    const result = await runStrategySynthesis({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      inputModulesText: modulesToPromptText(modules),
    });
    await saveModule(admin, job.id, "strategy_actions_ideas", null, {
      title: "Strategic Actions & Opportunity Ideas",
      content: wrapStoredContent({ kind: "strategy", data: result }),
    });
    return;
  }

  if (task.task_type === "reference_search") {
    const { stats } = await getStoredStatsAndSample(admin, job.id);
    const focusAreas = [
      `"${job.keyword}" 팬덤 심리 또는 소비자 행동 관련 연구`,
      ...stats.topKeywords.slice(0, 3).map((k) => `"${job.keyword}"의 "${k.keyword}" 관련 반응을 설명할 수 있는 자료`),
    ];
    const refs = await searchValidatedReferences({ keyword: job.keyword, focusAreas });

    const { error } = await admin
      .from("job_insights")
      .update({ research_references: refs })
      .eq("job_id", job.id);
    if (error) console.error(`[reference_search] 저장 실패: ${error.message}`);
    return;
  }

  if (task.task_type === "executive_summary") {
    const modules = await getAllModules(admin, job.id);
    const result = await runExecutiveSummarySynthesis({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      inputModulesText: modulesToPromptText(modules),
    });
    await saveModule(admin, job.id, "executive_summary", null, {
      title: "Executive Summary",
      content: wrapStoredContent({ kind: "executive_summary", data: result }),
    });
    return;
  }

  if (task.task_type === "visual_data") {
    const modules = await getAllModules(admin, job.id);
    const visualData = await extractVisualData({
      keyword: job.keyword,
      modules: modules.map((m) => ({ title: m.title, content: renderStoredContentToMarkdown(m.title, m.content_md) })),
    });
    const { error } = await admin.from("job_insights").update({ visual_data: visualData }).eq("job_id", job.id);
    if (error) console.error(`[visual_data] 저장 실패: ${error.message}`);
    return;
  }

  if (task.task_type === "assemble") {
    await assembleReport(admin, job);
    return;
  }
}

// ---------------------------------------------------------------------------
// 최종 리포트 조립 (LLM 호출 없이 로컬에서 모듈들을 정해진 순서로 합친다)
// ---------------------------------------------------------------------------

const REPORT_ORDER = [
  "audience_perception",
  "character_traits",
  "appeal_drivers",
  "psychological_drivers",
  "audience_segments",
  "conversion_signals",
  "relationship_dynamics",
  "viral_mechanics",
  "platform_youtube",
  "platform_x",
  "cross_platform",
  "hidden_value",
  "risk_misperception",
  "positioning_strategy",
  "strategy_actions_ideas",
];

function renderReferences(refs: ValidatedReference[]): string {
  if (!refs.length) return "";
  const items = refs
    .map(
      (r) =>
        `- **[${r.title}](${r.url})**\n  ${r.connectionNote || r.snippet}`
    )
    .join("\n\n");
  return `## Research References\n\n${items}`;
}

async function assembleReport(admin: SupabaseClient, job: Job) {
  const modules = await getAllModules(admin, job.id);
  const byKey = new Map(modules.map((m) => [m.module_key, m]));

  const { data: job_insight } = await admin
    .from("job_insights")
    .select("research_references")
    .eq("job_id", job.id)
    .maybeSingle();

  const { count: videoCount } = await admin
    .from("youtube_videos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id);
  const { count: commentCount } = await admin
    .from("youtube_comments")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id);
  const { count: postCount } = await admin
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id);

  const execModule = byKey.get("executive_summary");
  const summary = execModule
    ? renderStoredContentToMarkdown(execModule.title, execModule.content_md)
    : "## Executive Summary\n\n데이터 부족으로 생성되지 않았습니다.";

  const methodology = `## Methodology & Data Scope

- 분석 기간: ${job.period_start} ~ ${job.period_end}
- YouTube: 영상 ${videoCount ?? 0}개, 댓글 ${commentCount ?? 0}건
- X(Twitter): 게시물 ${postCount ?? 0}건${(postCount ?? 0) === 0 ? " (미연결 또는 검색 결과 없음)" : ""}
- 각 항목의 감성/구매의향/위험신호는 댓글/게시물 단위로 1차 분류한 뒤, 좋아요 상위·감성별·위험군·팬덤표현 포함
  게시물을 우선 선별한 대표 샘플을 근거로 심층 분석했습니다.`;

  const sections: string[] = [
    `# "${job.keyword}" IP 인텔리전스 리포트`,
    summary,
    methodology,
    ...REPORT_ORDER.map((key) => {
      const m = byKey.get(key);
      return m ? renderStoredContentToMarkdown(m.title, m.content_md) : undefined;
    }).filter((v): v is string => Boolean(v)),
    renderReferences((job_insight?.research_references as ValidatedReference[] | null) ?? []),
  ].filter(Boolean);

  const finalMarkdown = sections.join("\n\n---\n\n");

  const { error } = await admin
    .from("job_insights")
    .update({ summary_text: finalMarkdown, model_version: "claude-sonnet-5" })
    .eq("job_id", job.id);
  if (error) throw new Error(`리포트 조립 저장 실패: ${error.message}`);

  await setJobState(admin, job.id, { status: "done", progress: 100 });
}
