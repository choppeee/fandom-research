import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseStoredModuleContent,
  type SituationDiagnosis,
  type ExecutiveSummaryResult,
  type StrategyResult,
} from "../insight-types";
import { EMPTY_SITUATION_DIAGNOSIS } from "../insight-types";
import { FALLBACK_IP_TYPE, type IpTypeInfo } from "../ip-classify";
import type { ReportMode } from "../report-mode";
import type { ValidatedReference } from "../reference-search";
import type { Aggregates } from "../aggregate";
import { loadEvidenceSource, buildEvidencePackage, type EvidenceSource } from "../evidence-resolve";
import { adaptLegacyModules } from "./legacyReportAdapter";
import { buildSections, buildEvidenceSection, MODULE_SECTION_MAP } from "./selectSections";
import { selectMetrics } from "./ipMetricSelectors";
import type { ReportModel, CanonicalInsight, ExecutiveDecision, ChartSpec } from "./reportSchema";

type ModuleRow = { module_key: string; title: string | null; content_md: string };

export type ReportModelInput = {
  jobId: string;
  keyword: string;
  periodStart: string;
  periodEnd: string;
  insightRow: {
    top_keywords: { keyword: string; count: number }[] | null;
    sentiment_ratio: Aggregates["sentimentRatio"] | null;
    daily_trend: Aggregates["dailyTrend"] | null;
    fandom_highlights: { expression: string; count: number; example: string }[] | null;
    purchase_intent_summary: Aggregates["purchaseIntentSummary"] | null;
    risk_alerts: { level: "caution" | "high_risk"; count?: number; example_comment_id?: string | null }[] | null;
    research_references: ValidatedReference[] | null;
    generated_at: string | null;
    raw_json: { sample?: unknown; ipType?: IpTypeInfo; reportMode?: ReportMode; situation?: SituationDiagnosis } | null;
  } | null;
  moduleRows: ModuleRow[];
  videoCount: number;
  commentCount: number;
  postCount: number;
  evidenceSource: EvidenceSource;
};

function buildCanonicalInsights(moduleRows: ModuleRow[], evidenceSource: EvidenceSource): CanonicalInsight[] {
  const out: CanonicalInsight[] = [];
  for (const row of moduleRows) {
    if (!(row.module_key in MODULE_SECTION_MAP)) continue;
    const parsed = parseStoredModuleContent(row.content_md ?? "");
    if (!parsed || parsed.kind !== "insights" || !parsed.data.applicable) continue;
    parsed.data.insights.forEach((ins, idx) => {
      out.push({
        ...ins,
        id: `${row.module_key}-${idx}`,
        moduleKey: row.module_key,
        moduleTitle: row.title || row.module_key,
        evidencePackage: buildEvidencePackage({
          insightId: `${row.module_key}-${idx}`,
          headline: ins.headline,
          evidenceIds: ins.evidenceIds,
          confidence: ins.confidence,
          source: evidenceSource,
        }),
      });
    });
  }
  return out;
}

function buildExecutiveDecision(params: {
  keyword: string;
  situation: SituationDiagnosis;
  executiveSummary: ExecutiveSummaryResult | null;
  strategy: StrategyResult | null;
  allInsights: CanonicalInsight[];
}): ExecutiveDecision {
  const { keyword, situation, executiveSummary, strategy, allInsights } = params;
  const situationOk = situation.currentSituation.trim().length > 0;
  const questionsOk = situation.keyQuestions.length > 0;
  const evidenceOk = allInsights.some((i) => i.evidencePackage.visualRecommendation !== "no_visual") || (executiveSummary?.findings.length ?? 0) > 0;
  const top = strategy?.recommendations[0];
  const decisionOk = Boolean(top);

  // final_sentence는 "이 IP는 ______로 포지셔닝해야 한다." 형식을 채우도록 요청하는데, 데이터가
  // 판단하기에 부족하면 모델이 빈칸을 채우지 못하고 "판단 불가"류 설명을 덧붙인 채로 남길 수 있다.
  // 그 경우 finalSentence를 헤드라인으로 쓰면 미완성 문장이 그대로 노출되므로, 항상 구조화된
  // top.title(전략 추천 제목)로 대체한다.
  const finalSentenceUsable = Boolean(executiveSummary?.finalSentence) && !executiveSummary!.finalSentence.includes("___");

  if (situationOk && questionsOk && evidenceOk && decisionOk && top) {
    return {
      kind: "decision",
      headline: finalSentenceUsable ? executiveSummary!.finalSentence : top.title,
      body: [top.insight, top.opportunity].filter(Boolean),
      currentSituation: situation.currentSituation,
      currentPriority: situation.currentPriority,
      decision: top.decision,
      confidence: top.confidence,
    };
  }

  const firstSentence = situation.currentSituation
    ? (situation.currentSituation.match(/^[^.!?]*[.!?]/)?.[0] ?? situation.currentSituation)
    : `"${keyword}" 데이터를 확인하고 있습니다.`;
  return {
    kind: "exploratory",
    headline: firstSentence,
    body: situation.currentSituation ? [situation.currentSituation] : [],
    whatWeKnow: allInsights.slice(0, 3).map((i) => i.headline),
    whatWeDontKnow: situation.keyQuestions.length > 0 ? situation.keyQuestions : ["표본이 충분하지 않아 확정적 판단을 내리기는 이릅니다."],
  };
}

function buildCharts(stats: Aggregates): ChartSpec[] {
  const charts: ChartSpec[] = [];
  if (stats.dailyTrend.length > 0) charts.push({ kind: "trend", title: "언급량·참여량 추이", data: stats.dailyTrend });
  if (stats.topKeywords.length > 0) charts.push({ kind: "keywordBar", title: "연관 키워드", data: stats.topKeywords });
  const { positive, negative, neutral } = stats.sentimentRatio;
  if (positive + negative + neutral > 0) charts.push({ kind: "sentimentDonut", title: "감성 분포", data: stats.sentimentRatio });
  if (stats.dailyTrend.length > 0) charts.push({ kind: "sentimentTrend", title: "감성 추이", data: stats.dailyTrend });
  return charts;
}

/** Supabase 원본 데이터 -> Canonical ReportModel. 웹/PDF 렌더러가 공유하는 유일한 변환 지점 -
 * "무엇을 보여줄지"에 대한 모든 판단(빈 섹션 숨김, 억지 병목 금지, exploratory 완화 등)은
 * 여기서 끝내고, 렌더러는 결과를 그대로 그리기만 한다. */
export function buildReportModel(input: ReportModelInput): ReportModel {
  const raw = input.insightRow?.raw_json ?? null;
  const ipType = raw?.ipType ?? FALLBACK_IP_TYPE;
  const reportMode = raw?.reportMode ?? "standard";
  const situation = raw?.situation ?? EMPTY_SITUATION_DIAGNOSIS;

  const stats: Aggregates = {
    topKeywords: input.insightRow?.top_keywords ?? [],
    sentimentRatio: input.insightRow?.sentiment_ratio ?? { positive: 0, negative: 0, neutral: 0 },
    dailyTrend: input.insightRow?.daily_trend ?? [],
    fandomHighlights: (input.insightRow?.fandom_highlights ?? []).map((f) => ({ ...f, exampleCommentId: "" })),
    purchaseIntentSummary: input.insightRow?.purchase_intent_summary ?? { positiveRatio: 0, examples: [] },
    riskGroups: (input.insightRow?.risk_alerts ?? []).map((r) => ({
      level: r.level,
      count: r.count ?? 0,
      examples: [],
      exampleCommentIds: r.example_comment_id ? [r.example_comment_id] : [],
    })),
  };

  const structuredModuleKeys = new Set(
    input.moduleRows.filter((m) => (m.content_md ?? "").trim().startsWith("{")).map((m) => m.module_key)
  );
  // job 전체가 legacy인지는 "insight 성격 모듈 중 구조화된 게 하나도 없는가"로 판단한다.
  const anyStructuredInsightModule = input.moduleRows.some(
    (m) => m.module_key in MODULE_SECTION_MAP && structuredModuleKeys.has(m.module_key)
  );
  const isLegacy = input.moduleRows.length > 0 && !anyStructuredInsightModule;

  const allInsights = buildCanonicalInsights(input.moduleRows, input.evidenceSource);
  const sections = buildSections(allInsights);
  const evidenceSection = buildEvidenceSection(allInsights);
  if (evidenceSection) sections.push(evidenceSection);

  const execModule = input.moduleRows.find((m) => m.module_key === "executive_summary");
  const execParsed = execModule ? parseStoredModuleContent(execModule.content_md ?? "") : null;
  const executiveSummary = execParsed && execParsed.kind === "executive_summary" ? execParsed.data : null;

  const strategyModule = input.moduleRows.find((m) => m.module_key === "strategy_actions_ideas");
  const strategyParsed = strategyModule ? parseStoredModuleContent(strategyModule.content_md ?? "") : null;
  const strategy = strategyParsed && strategyParsed.kind === "strategy" ? strategyParsed.data : null;

  const conversionSignalCount = allInsights.filter((i) => i.moduleKey === "conversion_signals").length;

  const legacy = isLegacy ? adaptLegacyModules(input.moduleRows) : null;

  return {
    meta: {
      jobId: input.jobId,
      keyword: input.keyword,
      ipType,
      reportMode,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      generatedAt: input.insightRow?.generated_at ?? null,
      videoCount: input.videoCount,
      commentCount: input.commentCount,
      postCount: input.postCount,
    },
    isLegacy,
    executiveDecision: isLegacy
      ? null
      : buildExecutiveDecision({ keyword: input.keyword, situation, executiveSummary, strategy, allInsights }),
    metrics: isLegacy
      ? []
      : selectMetrics({
          ipType,
          stats,
          videoCount: input.videoCount,
          commentCount: input.commentCount,
          postCount: input.postCount,
          conversionSignalCount,
          evidencePackages: allInsights.map((i) => i.evidencePackage),
        }),
    sections: isLegacy ? [] : sections,
    charts: buildCharts(stats),
    fandomHighlights: stats.fandomHighlights,
    purchaseIntentSummary: stats.purchaseIntentSummary,
    riskAlerts: (input.insightRow?.risk_alerts ?? []).map((r) => ({
      level: r.level,
      description: "",
      exampleCommentId: r.example_comment_id ?? null,
    })),
    strategy,
    references: input.insightRow?.research_references ?? [],
    limitations: reportMode === "exploratory" ? ["표본이 작아(Exploratory 모드) 진단·전략 결론이 후보 수준으로 절제되어 있습니다."] : [],
    legacy,
  };
}

/** DB에서 필요한 모든 원본을 로드해 buildReportModel을 호출한다. 웹 /insight 라우트와 PDF
 * /export/pdf 라우트가 각자 쿼리하던 것을 여기 하나로 합쳐, 두 렌더러가 서로 다른 데이터를
 * 보는 일이 없게 한다. */
export async function loadReportModel(admin: SupabaseClient, jobId: string, job: { keyword: string; period_start: string; period_end: string }) {
  const [{ data: insightRow }, { data: moduleRows }, { count: videoCount }, { count: commentCount }, { count: postCount }, evidenceSource] =
    await Promise.all([
      admin
        .from("job_insights")
        .select(
          "top_keywords, sentiment_ratio, daily_trend, fandom_highlights, purchase_intent_summary, risk_alerts, research_references, generated_at, raw_json"
        )
        .eq("job_id", jobId)
        .maybeSingle(),
      admin.from("job_analysis_modules").select("module_key, title, content_md").eq("job_id", jobId),
      admin.from("youtube_videos").select("id", { count: "exact", head: true }).eq("job_id", jobId),
      admin.from("youtube_comments").select("id", { count: "exact", head: true }).eq("job_id", jobId),
      admin.from("social_posts").select("id", { count: "exact", head: true }).eq("job_id", jobId),
      loadEvidenceSource(admin, jobId),
    ]);

  return buildReportModel({
    jobId,
    keyword: job.keyword,
    periodStart: job.period_start,
    periodEnd: job.period_end,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insightRow: insightRow as any,
    moduleRows: moduleRows ?? [],
    videoCount: videoCount ?? 0,
    commentCount: commentCount ?? 0,
    postCount: postCount ?? 0,
    evidenceSource,
  });
}
