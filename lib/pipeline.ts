import type { SupabaseClient } from "@supabase/supabase-js";
import { getCollector } from "./collectors";
import { getVideoDetails, getVideoComments } from "./collectors/youtube";
import type { NormalizedPost, CollectResult } from "./collectors/types";
import { analyzeCommentBatch, COMMENT_BATCH_SIZE } from "./claude";
import { computeAggregates, buildCommentSample, type CommentRow, type CommentSampleItem, type Aggregates } from "./aggregate";
import { MODULE_DEFINITIONS, runAnalysisModule } from "./analysis-modules";
import {
  runPlatformModule,
  runInsightSynthesis,
  runPositioningSynthesis,
  runStrategySynthesis,
  runExecutiveSummarySynthesis,
  runEditorialPass,
  runSituationDiagnosis,
  runCoverageClassification,
  type CoverageInsightInput,
  type CoverageCommentInput,
} from "./synthesis-modules";
import { searchValidatedReferences, type ValidatedReference } from "./reference-search";
import { extractVisualData } from "./visual-data";
import {
  wrapStoredContent,
  renderStoredContentToMarkdown,
  parseStoredModuleContent,
  EMPTY_SITUATION_DIAGNOSIS,
  type EditorialInsight,
  type SituationDiagnosis,
  type StructuredInsight,
  type SupportingCoverage,
} from "./insight-types";
import {
  computeStructuralCoverage,
  computeConcentrationWarnings,
  computeAuthorMetricStatus,
  computeInsightAuthorCoverage,
  computeAuthorConcentrationWarnings,
  buildDataCoverageNote,
  type CoverageAudit,
} from "./coverage-audit";
import { classifyIpType, FALLBACK_IP_TYPE, type IpTypeInfo } from "./ip-classify";
import { computeReportMode, type ReportMode } from "./report-mode";
import { lintAndLog } from "./style-lint";
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
import { sourceRegistry } from "./social/registry";
import type { SourceType } from "./social/types";

// ---------------------------------------------------------------------------
// 파이프라인 단계 정의
// ---------------------------------------------------------------------------

const PHASE_ORDER = [
  "collect",
  "classify",
  "aggregate",
  "context",
  "modules",
  "platform",
  "cross",
  "positioning",
  "strategy_actions",
  "editorial",
  "coverage",
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
  aggregate: 42,
  context: 45,
  modules: 48,
  platform: 72,
  cross: 78,
  positioning: 81,
  strategy_actions: 84,
  editorial: 88,
  coverage: 90,
  reference: 91,
  executive_summary: 94,
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
  research_mode?: string;
  source_id?: string | null;
  user_id?: string;
  uses_common_schema?: boolean;
};

function isPhase(v: string): v is Phase {
  return (PHASE_ORDER as readonly string[]).includes(v);
}

// 이 태스크들이 완전히 실패하면 리포트 자체를 만들 수 없거나(수집/집계/조립), "그래서 뭘 해야
// 하는가"에 해당하는 결정 레이어(editorial_pass/executive_summary/strategy_actions_ideas)가
// 통째로 비어버리므로 job 전체를 실패 처리한다. 새 헌법(CLAUDE.md) 기준상 이 결정 레이어는
// 선택 사항이 아니라 제품의 핵심이라 "일부만 비운 채 done" 처리를 허용하지 않는다.
// 그 외(모듈 하나, X 수집, 레퍼런스 검색, positioning 등)는 실패해도 해당 부분만 비운 채 계속 진행한다.
const CRITICAL_TASK_TYPES = new Set([
  "collect_youtube",
  "collect_source",
  "aggregate",
  "assemble",
  "editorial_pass",
  "executive_summary",
  "strategy_actions_ideas",
  "positioning_strategy",
]);

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
    // 이 phase의 태스크가 아직 하나도 생성되지 않음 -> 지금 생성.
    // 클라이언트가 여러 워커를 동시에 돌리므로(속도 향상), 짧은 지터 후 재확인해 같은 phase를
    // 중복 enqueue하는 경쟁을 줄인다(완전한 락은 아니지만 충돌 확률을 크게 낮춘다).
    if (job.status !== currentPhase) {
      await setJobState(admin, job.id, { status: currentPhase, progress: PHASE_START_PROGRESS[currentPhase], error_message: null });
    }
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 200));
    const stillNotStarted = !(await phaseTasksExist(admin, job.id, currentPhase));
    if (stillNotStarted) {
      await enqueuePhase(admin, job, currentPhase);
    }
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
      if (job.uses_common_schema) {
        await enqueueTasks(admin, job.id, [{ type: "collect_source", payload: { phase: "collect" } }]);
        return;
      }
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
      if (job.uses_common_schema) {
        const { reactionRows } = await loadCommonSchemaRows(admin, job.id);
        const reactionIds = reactionRows.map((r) => r.id as string);
        const tasks: { type: string; payload: Record<string, unknown> }[] = [];
        for (let i = 0; i < reactionIds.length; i += COMMENT_BATCH_SIZE) {
          tasks.push({
            type: "classify_batch",
            payload: { phase: "classify", platform: "source", ids: reactionIds.slice(i, i + COMMENT_BATCH_SIZE) },
          });
        }
        if (tasks.length === 0) tasks.push({ type: "noop", payload: { phase: "classify" } });
        await enqueueTasks(admin, job.id, tasks);
        return;
      }

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
      if (tasks.length === 0) {
        // 분류할 댓글/게시물이 하나도 없음(예: 댓글 수집 실패/비활성화) - 그래도 phase가
        // "시작됨"으로 표시되도록 noop을 하나 넣어 무한 대기를 방지한다.
        tasks.push({ type: "noop", payload: { phase: "classify" } });
      }
      await enqueueTasks(admin, job.id, tasks);
      return;
    }

    case "aggregate":
      await enqueueTasks(admin, job.id, [{ type: "aggregate", payload: { phase: "aggregate" } }]);
      return;

    case "context":
      await enqueueTasks(admin, job.id, [{ type: "classify_ip", payload: { phase: "context" } }]);
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
      if (job.uses_common_schema) {
        // platform_youtube/platform_x는 "YouTube vs X" 프레이밍 전용 프롬프트라 다른 플랫폼에
        // 그대로 쓰면 틀린 서술이 나온다 - 공통 스키마 job은 modules phase의 범용 모듈만 사용하고
        // 이 phase는 건너뛴다(cross_platform도 yt/x 모듈이 없으므로 자연히 스킵됨).
        await enqueueTasks(admin, job.id, [{ type: "noop", payload: { phase: "platform" } }]);
        return;
      }
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

    case "editorial":
      await enqueueTasks(admin, job.id, [{ type: "editorial_pass", payload: { phase: "editorial" } }]);
      return;

    case "coverage":
      await enqueueTasks(admin, job.id, [{ type: "coverage_audit", payload: { phase: "coverage" } }]);
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

/** 공통 스키마(sources -> contents -> reactions) job의 raw row들을 job_id 기준으로 불러온다.
 * PostgREST 중첩 필터 대신 3단계로 나눠 조회해 supabase-js 버전에 덜 민감하게 만든다. */
async function loadCommonSchemaRows(admin: SupabaseClient, jobId: string) {
  const { data: sourceRows } = await admin.from("sources").select("id").eq("job_id", jobId);
  const sourceIds = (sourceRows ?? []).map((s) => s.id as string);
  if (sourceIds.length === 0) {
    return { sourceIds, contentRows: [] as Record<string, unknown>[], reactionRows: [] as Record<string, unknown>[] };
  }

  const { data: contentRows } = await admin.from("contents").select("*").in("source_id", sourceIds);
  const contentIds = (contentRows ?? []).map((c) => c.id as string);
  if (contentIds.length === 0) {
    return { sourceIds, contentRows: (contentRows ?? []) as Record<string, unknown>[], reactionRows: [] as Record<string, unknown>[] };
  }

  const { data: reactionRows } = await admin.from("reactions").select("*").in("content_id", contentIds);
  return {
    sourceIds,
    contentRows: (contentRows ?? []) as Record<string, unknown>[],
    reactionRows: (reactionRows ?? []) as Record<string, unknown>[],
  };
}

async function loadCombinedData(admin: SupabaseClient, jobId: string, usesCommonSchema?: boolean) {
  if (usesCommonSchema) {
    const { reactionRows } = await loadCommonSchemaRows(admin, jobId);
    const rows: CommentRow[] = reactionRows.map((r) => ({
      commentId: r.id as string,
      videoId: r.content_id as string,
      textOriginal: (r.text as string) ?? "",
      likeCount: ((r.engagement as Record<string, number | null> | null)?.likeCount as number) ?? 0,
      publishedAt: (r.published_at as string | null) ?? null,
      platform: "source" as const,
    }));
    const analyses = reactionRows
      .filter((r) => r.analyzed_at)
      .map((r) => ({
        commentId: r.id as string,
        sentiment: r.sentiment,
        purchaseIntent: r.purchase_intent,
        adReaction: r.ad_reaction,
        riskFlag: r.risk_flag,
        extractedKeywords: r.extracted_keywords ?? [],
        fandomExpressions: r.fandom_expressions ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any[];
    return { rows, analyses, hasX: false };
  }

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
): Promise<{
  stats: Aggregates;
  sample: CommentSampleItem[];
  platforms: ("youtube" | "x" | "source")[];
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
}> {
  const { data: insight } = await admin
    .from("job_insights")
    .select("top_keywords, sentiment_ratio, daily_trend, fandom_highlights, purchase_intent_summary, risk_alerts, raw_json")
    .eq("job_id", jobId)
    .maybeSingle();

  const raw = (insight?.raw_json ?? {}) as {
    sample?: CommentSampleItem[];
    ipType?: IpTypeInfo;
    reportMode?: ReportMode;
    situation?: SituationDiagnosis;
  };
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
  return {
    stats,
    sample,
    platforms: platforms.length ? platforms : ["youtube"],
    ipType: raw.ipType ?? FALLBACK_IP_TYPE,
    reportMode: raw.reportMode ?? "standard",
    situation: raw.situation ?? EMPTY_SITUATION_DIAGNOSIS,
  };
}

async function getContentCounts(admin: SupabaseClient, jobId: string, usesCommonSchema?: boolean) {
  if (usesCommonSchema) {
    const { contentRows, reactionRows } = await loadCommonSchemaRows(admin, jobId);
    // videoCount/postCount 자리는 이름은 legacy지만 콘텐츠 중심 값을 그대로 담는다
    // (필드명 자체를 content 중심으로 바꾸는 건 Coverage Audit 일반화 작업(#91)에서 처리).
    return { videoCount: contentRows.length, commentCount: reactionRows.length, postCount: 0 };
  }
  const { count: videoCount } = await admin
    .from("youtube_videos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  const { count: commentCount } = await admin
    .from("youtube_comments")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  const { count: postCount } = await admin
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  return { videoCount: videoCount ?? 0, commentCount: commentCount ?? 0, postCount: postCount ?? 0 };
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
      let result: CollectResult;
      if (job.research_mode === "single_content" && job.source_id) {
        // 단일 콘텐츠 모드: 키워드 검색을 건너뛰고 지정된 영상 하나만 직접 수집한다.
        const videos = await getVideoDetails([job.source_id]);
        const posts = await getVideoComments(job.source_id, job.max_comments_per_video, job.id);
        result = { configured: true, posts, videos };
      } else {
        const collector = getCollector("youtube");
        result = await collector.collect({
          jobId: job.id,
          keyword: job.keyword,
          periodStart: job.period_start,
          periodEnd: job.period_end,
          maxVideos: job.max_videos,
          maxCommentsPerVideo: job.max_comments_per_video,
        });
      }

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
            author_display: null, // 원본 작성자 정보는 저장하지 않는다 (PLAN.md 8.2)
            author_key: p.authorKey ?? null, // job 범위 익명 키 - 원본 채널ID가 아님
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
        jobId: job.id,
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

    case "collect_source": {
      const { data: sourceRows, error: sourceErr } = await admin.from("sources").select("*").eq("job_id", job.id);
      if (sourceErr) throw new Error(`소스 조회 실패: ${sourceErr.message}`);
      if (!sourceRows || sourceRows.length === 0) throw new Error("이 job에 연결된 source가 없습니다.");

      for (const s of sourceRows) {
        const adapter = sourceRegistry[s.source_type as SourceType];
        if (!adapter) throw new Error(`지원하지 않는 source_type입니다: ${s.source_type}`);

        const result = await adapter.collect({
          sourceId: (s.external_id as string) ?? "",
          userId: job.user_id ?? "",
          jobId: job.id,
          maxItems: job.max_comments_per_video || 100,
          sourceMetadata: (s.metadata as Record<string, unknown>) ?? {},
        });

        // 재시도(태스크 실패 후 재큐잉) 시 중복 삽입을 막기 위해 이 source의 기존
        // contents/reactions를 먼저 지우고 다시 채운다 - collect()는 매번 전체를 다시 반환한다.
        const { data: existingContents } = await admin.from("contents").select("id").eq("source_id", s.id);
        const existingContentIds = (existingContents ?? []).map((c) => c.id as string);
        if (existingContentIds.length > 0) {
          await admin.from("reactions").delete().in("content_id", existingContentIds);
          await admin.from("contents").delete().eq("source_id", s.id);
        }

        const contentIdByExternalId = new Map<string, string>();
        for (const c of result.contents) {
          const { data: inserted, error } = await admin
            .from("contents")
            .insert({
              source_id: s.id,
              external_content_id: c.externalContentId,
              content_type: c.contentType,
              title: c.title,
              text: c.text,
              published_at: c.publishedAt,
              metrics: c.metrics,
              native_metadata: c.nativeMetadata ?? {},
            })
            .select("id, external_content_id")
            .single();
          if (error) throw new Error(`contents 저장 실패: ${error.message}`);
          if (inserted?.external_content_id) contentIdByExternalId.set(inserted.external_content_id as string, inserted.id as string);
        }
        const firstContentId = [...contentIdByExternalId.values()][0] ?? null;

        if (result.reactions.length > 0) {
          const reactionRows = result.reactions
            .map((r) => ({
              content_id: (r.externalContentId && contentIdByExternalId.get(r.externalContentId)) || firstContentId,
              reaction_type: r.reactionType,
              text: r.text,
              published_at: r.publishedAt,
              engagement: r.engagement,
              author_key: r.authorKey,
              native_metadata: r.nativeMetadata ?? {},
            }))
            .filter((r) => r.content_id);
          if (reactionRows.length > 0) {
            const { error } = await admin.from("reactions").insert(reactionRows);
            if (error) throw new Error(`reactions 저장 실패: ${error.message}`);
          }
        }

        const { error: availErr } = await admin
          .from("sources")
          .update({
            data_origin: result.dataOrigin,
            availability: {
              unavailableFields: result.unavailableFields,
              limitationReasons: result.limitationReasons,
              contentCount: result.contents.length,
              reactionCount: result.reactions.length,
            },
          })
          .eq("id", s.id);
        if (availErr) console.error(`[collect_source] source availability 업데이트 실패: ${availErr.message}`);
      }
      return;
    }

    case "classify_batch": {
      const platform = payload.platform as "youtube" | "x" | "source";
      const ids = (payload.ids as string[]) ?? [];
      if (ids.length === 0) return;

      if (platform === "source") {
        const { data } = await admin.from("reactions").select("id, text").in("id", ids);
        const items = (data ?? []).map((r) => ({ id: r.id as string, text: (r.text as string) ?? "" }));
        if (items.length === 0) return;

        const idSet = new Set(items.map((i) => i.id));
        const results = (
          await analyzeCommentBatch(
            job.keyword,
            items.map((i) => ({ commentId: i.id, text: i.text }))
          )
        ).filter((r) => idSet.has(r.commentId));
        if (results.length === 0) return;

        for (const r of results) {
          const { error } = await admin
            .from("reactions")
            .update({
              sentiment: r.sentiment,
              purchase_intent: r.purchaseIntent,
              ad_reaction: r.adReaction,
              risk_flag: r.riskFlag,
              extracted_keywords: r.extractedKeywords,
              fandom_expressions: r.fandomExpressions,
              analysis_raw_json: r,
              analyzed_at: new Date().toISOString(),
            })
            .eq("id", r.commentId);
          if (error) console.error(`[classify_batch] reactions 분석 저장 실패: ${error.message}`);
        }
        return;
      }

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
      const { rows, analyses } = await loadCombinedData(admin, job.id, job.uses_common_schema);
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

    case "classify_ip": {
      const { stats, sample } = await getStoredStatsAndSample(admin, job.id);
      const { videoCount, commentCount, postCount } = await getContentCounts(admin, job.id, job.uses_common_schema);
      const platformCount = postCount > 0 ? 2 : 1;
      const reportMode = computeReportMode({ commentCount, postCount, videoCount, platformCount });
      const ipType = await classifyIpType(job.keyword, sample);
      const situation = await runSituationDiagnosis({
        keyword: job.keyword,
        ipType,
        reportMode,
        researchMode: job.research_mode,
        stats,
        sample,
      });

      const { data: existing } = await admin.from("job_insights").select("raw_json").eq("job_id", job.id).maybeSingle();
      const raw = (existing?.raw_json ?? {}) as Record<string, unknown>;
      const { error } = await admin
        .from("job_insights")
        .update({ raw_json: { ...raw, ipType, reportMode, situation } })
        .eq("job_id", job.id);
      if (error) throw new Error(`IP 유형/리포트 모드/상태 진단 저장 실패: ${error.message}`);
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

    const { stats, sample, platforms, ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);
    const { title, result } = await runAnalysisModule(def, {
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      platforms,
      stats,
      sample,
      ipType,
      reportMode,
      situation,
    });
    await saveModule(admin, job.id, def.key, null, { title, content: wrapStoredContent({ kind: "insights", data: result }) });
    return;
  }

  if (task.task_type === "platform_youtube" || task.task_type === "platform_x") {
    const platform = task.task_type === "platform_youtube" ? "youtube" : "x";
    const { stats, sample, ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);
    const filteredSample = sample.filter((s) => s.platform === platform);
    if (platform === "x" && filteredSample.length === 0) return; // X 데이터 없으면 스킵

    const { title, result } = await runPlatformModule({
      platform,
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      ipType,
      reportMode,
      situation,
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
    const { ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);

    const result = await runInsightSynthesis({
      title: "플랫폼마다 반응이 어떻게 다른가",
      instruction: `YouTube와 X 두 플랫폼의 분석을 비교하여 AGREEMENT(공통 인식), PLATFORM-SPECIFIC(특정 플랫폼에서만 강한 인식),
CONTRADICTION(플랫폼별로 다른 반응)을 구분하라. 이 차이 자체를 전략적 Insight로 활용하라.`,
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      ipType,
      reportMode,
      situation,
      inputModulesText: modulesToPromptText([yt, x]),
      maxTokens: 2500,
    });
    await saveModule(admin, job.id, "cross_platform", "cross", {
      title: "플랫폼마다 반응이 어떻게 다른가",
      content: wrapStoredContent({ kind: "insights", data: result }),
    });
    return;
  }

  if (task.task_type === "positioning_strategy") {
    const modules = await getAllModules(admin, job.id);
    const { ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);
    const result = await runPositioningSynthesis({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      ipType,
      reportMode,
      situation,
      inputModulesText: modulesToPromptText(modules),
    });
    await saveModule(admin, job.id, "positioning_strategy", null, {
      title: "그래서 어떤 자리를 잡아야 하는가",
      content: wrapStoredContent({ kind: "positioning", data: result }),
    });
    return;
  }

  if (task.task_type === "strategy_actions_ideas") {
    const modules = await getAllModules(admin, job.id);
    const { ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);
    const result = await runStrategySynthesis({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      ipType,
      reportMode,
      situation,
      inputModulesText: modulesToPromptText(modules),
    });
    await saveModule(admin, job.id, "strategy_actions_ideas", null, {
      title: "그래서 지금 무엇을 어떻게 움직여야 하는가",
      content: wrapStoredContent({ kind: "strategy", data: result }),
    });
    return;
  }

  if (task.task_type === "editorial_pass") {
    const modules = await getAllModules(admin, job.id);
    const { ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);

    const flattened: EditorialInsight[] = [];
    for (const m of modules) {
      const parsed = parseStoredModuleContent(m.content_md);
      if (!parsed || parsed.kind !== "insights" || !parsed.data.applicable) continue;
      for (const insight of parsed.data.insights) {
        flattened.push({ ...insight, moduleKey: m.module_key });
      }
    }
    if (flattened.length === 0) return;

    const edited = await runEditorialPass({ keyword: job.keyword, ipType, reportMode, situation, insights: flattened });
    lintAndLog(
      `job ${job.id}`,
      edited.flatMap((i) => [i.headline, i.interpretation, i.whyItMatters, i.strategicImplication])
    );

    // 편집 단계에서 통째로 사라진 대표 증거(comment_id) - coverage_audit 단계가 이 목록을
    // video_id로 변환해 "편집 과정에서 제외된 콘텐츠"를 추적하는 데 쓴다.
    const preEditEvidenceIds = new Set(flattened.flatMap((i) => (Array.isArray(i.evidenceIds) ? i.evidenceIds : [])));
    const postEditEvidenceIds = new Set(edited.flatMap((i) => (Array.isArray(i.evidenceIds) ? i.evidenceIds : [])));
    const droppedEvidenceIds = [...preEditEvidenceIds].filter((id) => !postEditEvidenceIds.has(id));
    const { data: existingInsightRow } = await admin.from("job_insights").select("raw_json").eq("job_id", job.id).maybeSingle();
    const rawForDrop = (existingInsightRow?.raw_json ?? {}) as Record<string, unknown>;
    await admin
      .from("job_insights")
      .update({ raw_json: { ...rawForDrop, editorialDroppedEvidenceIds: droppedEvidenceIds } })
      .eq("job_id", job.id);

    const byModule = new Map<string, EditorialInsight[]>();
    for (const ins of edited) {
      const list = byModule.get(ins.moduleKey) ?? [];
      list.push(ins);
      byModule.set(ins.moduleKey, list);
    }

    for (const m of modules) {
      const parsed = parseStoredModuleContent(m.content_md);
      if (!parsed || parsed.kind !== "insights" || !parsed.data.applicable) continue;
      const newInsights = byModule.get(m.module_key) ?? [];
      const updated = {
        applicable: newInsights.length > 0,
        notApplicableReason: newInsights.length > 0 ? "" : "편집 단계에서 다른 모듈과 중복되어 제외됨",
        insights: newInsights.map(({ moduleKey: _moduleKey, ...rest }) => rest),
      };
      await saveModule(admin, job.id, m.module_key, m.platform, {
        title: m.title,
        content: wrapStoredContent({ kind: "insights", data: updated }),
      });
    }
    return;
  }

  if (task.task_type === "coverage_audit") {
    const modules = await getAllModules(admin, job.id);

    let commentRows: { comment_id: string; video_id: string | null; text_original: string; author_key: string | null }[];
    let videoRows: { video_id: string }[];
    if (job.uses_common_schema) {
      const { contentRows, reactionRows } = await loadCommonSchemaRows(admin, job.id);
      videoRows = contentRows.map((c) => ({ video_id: c.id as string }));
      commentRows = reactionRows.map((r) => ({
        comment_id: r.id as string,
        video_id: (r.content_id as string) ?? null,
        text_original: (r.text as string) ?? "",
        author_key: (r.author_key as string) ?? null,
      }));
    } else {
      const [{ data: c }, { data: v }] = await Promise.all([
        admin.from("youtube_comments").select("comment_id, video_id, text_original, author_key").eq("job_id", job.id),
        admin.from("youtube_videos").select("video_id").eq("job_id", job.id),
      ]);
      commentRows = (c ?? []) as typeof commentRows;
      videoRows = (v ?? []) as typeof videoRows;
    }

    const allVideoIds = (videoRows ?? []).map((v) => v.video_id as string);
    const allCommentIds = (commentRows ?? []).map((c) => c.comment_id as string);
    const commentToVideo = new Map<string, string | null>();
    const commentToAuthorKey = new Map<string, string | null>();
    const videoCommentCounts = new Map<string, number>(allVideoIds.map((v) => [v, 0]));
    let commentsWithAuthorKeyTotal = 0;
    for (const c of commentRows ?? []) {
      const videoId = (c.video_id as string) ?? null;
      commentToVideo.set(c.comment_id as string, videoId);
      const authorKey = (c.author_key as string) ?? null;
      commentToAuthorKey.set(c.comment_id as string, authorKey);
      if (authorKey) commentsWithAuthorKeyTotal++;
      if (videoId) videoCommentCounts.set(videoId, (videoCommentCounts.get(videoId) ?? 0) + 1);
    }
    const authorMetricStatus = computeAuthorMetricStatus(allCommentIds.length, commentsWithAuthorKeyTotal);

    type FlatInsight = { insightId: number; moduleKey: string; insightIndex: number; insight: StructuredInsight };
    const flat: FlatInsight[] = [];
    let counter = 0;
    for (const m of modules) {
      const parsed = parseStoredModuleContent(m.content_md);
      if (!parsed || parsed.kind !== "insights" || !parsed.data.applicable) continue;
      parsed.data.insights.forEach((insight, insightIndex) => {
        flat.push({ insightId: counter++, moduleKey: m.module_key, insightIndex, insight });
      });
    }
    if (flat.length === 0) return; // 인사이트가 없으면 커버리지도 계산 불가 - 비핵심 태스크라 조용히 스킵

    const structural = computeStructuralCoverage({
      insights: flat.map((f) => f.insight),
      commentToVideo,
      allVideoIds,
      allCommentIds,
      videoCommentCounts,
    });

    const coverageInsightInput: CoverageInsightInput[] = flat.map((f) => ({
      insightId: f.insightId,
      moduleKey: f.moduleKey,
      headline: f.insight.headline,
      interpretation: f.insight.interpretation,
    }));
    const coverageCommentInput: CoverageCommentInput[] = (commentRows ?? []).map((c) => ({
      commentId: c.comment_id as string,
      videoId: (c.video_id as string) ?? null,
      text: (c.text_original as string) ?? "",
    }));
    const classification = await runCoverageClassification({
      keyword: job.keyword,
      insights: coverageInsightInput,
      comments: coverageCommentInput,
    });

    const byInsightId = new Map(classification.items.map((it) => [it.insightId, it]));
    const matchedVideoIdsUnion = new Set<string>();
    const insightsDominatedBySameVideo = new Map<string, string[]>(); // videoId -> headlines (구조적 dominant, evidenceIds 기준)
    const perInsightAuthorCoverage: { headline: string; coverage: SupportingCoverage }[] = [];
    let crossContentRepeatCount = 0;

    for (const f of flat) {
      const item = byInsightId.get(f.insightId);
      const matchedVideoIds = new Set<string>();
      if (item) {
        for (const cid of item.matchedCommentIds) {
          const videoId = commentToVideo.get(cid);
          if (videoId) matchedVideoIds.add(videoId);
        }
        matchedVideoIds.forEach((v) => matchedVideoIdsUnion.add(v));
        if (matchedVideoIds.size >= 2) crossContentRepeatCount++;
        const authorCoverage = computeInsightAuthorCoverage({
          matchedCommentIds: item.matchedCommentIds,
          commentToAuthorKey,
        });
        f.insight.supportingCoverage = {
          contentCount: matchedVideoIds.size,
          commentCount: new Set(item.matchedCommentIds).size,
          ...authorCoverage,
        };
        f.insight.scope = item.scope;
        f.insight.scopeNote = item.scopeNote;
        perInsightAuthorCoverage.push({ headline: f.insight.headline, coverage: f.insight.supportingCoverage });
      }

      const evidenceVideoCounts = new Map<string, number>();
      for (const id of Array.isArray(f.insight.evidenceIds) ? f.insight.evidenceIds : []) {
        const videoId = commentToVideo.get(id);
        if (videoId) evidenceVideoCounts.set(videoId, (evidenceVideoCounts.get(videoId) ?? 0) + 1);
      }
      const dominant = [...evidenceVideoCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (dominant) {
        const list = insightsDominatedBySameVideo.get(dominant) ?? [];
        list.push(f.insight.headline);
        insightsDominatedBySameVideo.set(dominant, list);
      }
    }

    const byModule = new Map<string, FlatInsight[]>();
    for (const f of flat) {
      const list = byModule.get(f.moduleKey) ?? [];
      list.push(f);
      byModule.set(f.moduleKey, list);
    }
    for (const m of modules) {
      const items = byModule.get(m.module_key);
      if (!items || items.length === 0) continue;
      const parsed = parseStoredModuleContent(m.content_md);
      if (!parsed || parsed.kind !== "insights") continue;
      const updated = {
        ...parsed.data,
        insights: [...items].sort((a, b) => a.insightIndex - b.insightIndex).map((f) => f.insight),
      };
      await saveModule(admin, job.id, m.module_key, m.platform, {
        title: m.title,
        content: wrapStoredContent({ kind: "insights", data: updated }),
      });
    }

    let baselineAdded = false;
    if (classification.baseline.applicable && classification.baseline.headline) {
      const matchedVideoIds = new Set(classification.baseline.matchedVideoIds);
      const baselineAuthorCoverage = computeInsightAuthorCoverage({
        matchedCommentIds: classification.baseline.evidenceCommentIds,
        commentToAuthorKey,
      });
      const baselineInsight: StructuredInsight = {
        headline: classification.baseline.headline,
        interpretation: classification.baseline.interpretation,
        evidence: [],
        evidenceIds: classification.baseline.evidenceCommentIds,
        evidenceScope: "여러 콘텐츠에 걸쳐 반복되는 안정 패턴",
        surfaceExpression: "",
        emotionalMeaning: "",
        underlyingIntent: "",
        whyItMatters: classification.baseline.whyItMatters,
        strategicImplication: "",
        confidence: "MEDIUM",
        supportingCoverage: {
          contentCount: matchedVideoIds.size,
          commentCount: classification.baseline.evidenceCommentIds.length,
          ...baselineAuthorCoverage,
        },
        scope: "broad_repeated",
        scopeNote: "여러 콘텐츠에서 반복 확인되어 별도 인사이트로 승격됨",
      };
      perInsightAuthorCoverage.push({ headline: baselineInsight.headline, coverage: baselineInsight.supportingCoverage! });
      await saveModule(admin, job.id, "baseline_stability", null, {
        title: "조용했던 콘텐츠들에서 반복되는 패턴",
        content: wrapStoredContent({
          kind: "insights",
          data: { applicable: true, notApplicableReason: "", insights: [baselineInsight] },
        }),
      });
      baselineAdded = true;
      matchedVideoIds.forEach((v) => matchedVideoIdsUnion.add(v));
    }

    const { data: insightRowForCoverage } = await admin.from("job_insights").select("raw_json").eq("job_id", job.id).maybeSingle();
    const rawForCoverage = (insightRowForCoverage?.raw_json ?? {}) as Record<string, unknown>;
    const droppedEvidenceIds = Array.isArray(rawForCoverage.editorialDroppedEvidenceIds)
      ? (rawForCoverage.editorialDroppedEvidenceIds as string[])
      : [];
    const contentsDroppedDuringEditorialSelection = new Set(
      droppedEvidenceIds.map((id) => commentToVideo.get(id)).filter((v): v is string => Boolean(v))
    ).size;

    const contentsMatchedToAnyPattern = matchedVideoIdsUnion.size;
    const contentsWithOnlyBaselineReactions = Math.max(0, structural.totalContentsAnalyzed - contentsMatchedToAnyPattern);
    const concentrationWarnings = [
      ...computeConcentrationWarnings({
        evidenceConcentration: structural.evidenceConcentration,
        topContentEvidenceShare: structural.topContentEvidenceShare,
        totalContentsAnalyzed: structural.totalContentsAnalyzed,
        contentsReferencedInFinalReport: structural.contentsReferencedInFinalReport,
        insightsDominatedBySameVideo: [...insightsDominatedBySameVideo.entries()].map(([videoId, insightHeadlines]) => ({
          videoId,
          insightHeadlines,
        })),
      }),
      ...computeAuthorConcentrationWarnings(perInsightAuthorCoverage),
    ];
    const dataCoverageNote = buildDataCoverageNote({
      totalContentsAnalyzed: structural.totalContentsAnalyzed,
      totalCommentsAnalyzed: structural.totalCommentsAnalyzed,
      finalInsightCount: flat.length + (baselineAdded ? 1 : 0),
      contentsReferencedInFinalReport: structural.contentsReferencedInFinalReport,
      contentsMatchedToAnyPattern,
      baselineInsightAdded: baselineAdded,
    });

    const audit: CoverageAudit = {
      ...structural,
      authorMetricStatus,
      contentsDroppedDuringEditorialSelection,
      contentsMatchedToAnyPattern,
      contentsWithOnlyBaselineReactions,
      crossContentRepeatCount,
      concentrationWarnings,
      dataCoverageNote,
    };

    const { error: coverageSaveError } = await admin
      .from("job_insights")
      .update({ raw_json: { ...rawForCoverage, coverageAudit: audit } })
      .eq("job_id", job.id);
    if (coverageSaveError) console.error(`[coverage_audit] 저장 실패: ${coverageSaveError.message}`);
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
    const { ipType, reportMode, situation } = await getStoredStatsAndSample(admin, job.id);
    const result = await runExecutiveSummarySynthesis({
      keyword: job.keyword,
      periodStart: job.period_start,
      periodEnd: job.period_end,
      ipType,
      reportMode,
      situation,
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

export const REPORT_ORDER = [
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
  "baseline_stability",
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

  const { videoCount, commentCount, postCount } = await getContentCounts(admin, job.id, job.uses_common_schema);

  const execModule = byKey.get("executive_summary");
  const summary = execModule
    ? renderStoredContentToMarkdown(execModule.title, execModule.content_md)
    : "## Executive Summary\n\n데이터 부족으로 생성되지 않았습니다.";

  let dataScopeLine: string;
  if (job.uses_common_schema) {
    const { data: sourceRows } = await admin
      .from("sources")
      .select("platform, source_type, data_origin, availability")
      .eq("job_id", job.id);
    const dataOriginLabel: Record<string, string> = {
      official_api: "공식 API",
      connected_account: "연결된 계정",
      public_snapshot: "공개 스냅샷",
      user_upload: "사용자 업로드",
      manual_entry: "직접 입력",
    };
    const originLines = (sourceRows ?? [])
      .map((s) => `${s.platform}/${s.source_type} (${dataOriginLabel[s.data_origin as string] ?? s.data_origin})`)
      .join(", ") || "알 수 없음";
    dataScopeLine = `- 데이터 출처: ${originLines}\n- 콘텐츠 ${videoCount ?? 0}개, 반응(댓글/답글) ${commentCount ?? 0}건`;
  } else {
    dataScopeLine = `- YouTube: 영상 ${videoCount ?? 0}개, 댓글 ${commentCount ?? 0}건
- X(Twitter): 게시물 ${postCount ?? 0}건${(postCount ?? 0) === 0 ? " (미연결 또는 검색 결과 없음)" : ""}`;
  }

  const methodology = `## Methodology & Data Scope

- 분석 기간: ${job.period_start} ~ ${job.period_end}
${dataScopeLine}
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
