import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buildReportHtml, renderHtmlToPdf, type ModuleContent, type ReportData } from "@/lib/pdf/render";
import { parseStoredModuleContent, wrapStoredContent, type ExecutiveSummaryResult, type StructuredInsight } from "@/lib/insight-types";
import { MODULE_SECTION_MAP } from "@/lib/report/selectSections";
import type { CanonicalInsight } from "@/lib/report/reportSchema";
import type { ValidatedReference } from "@/lib/reference-search";
import type { VisualData } from "@/lib/visual-data";
import type { Aggregates } from "@/lib/aggregate";
import type { ReportMode } from "@/lib/report-mode";
import { loadEvidenceSource } from "@/lib/evidence-resolve";
import { buildPdfEvidenceMap } from "@/lib/pdf/evidence-resolve";
import { qrDataUri } from "@/lib/pdf/qrcode";
import { loadReportModel } from "@/lib/report/buildReportModel";

export const maxDuration = 90;

const EMPTY_VISUAL_DATA: VisualData = {
  ipLabel: "IP",
  diagnostic: { strongAssets: [], hiddenAssets: [], weakSignals: [], risks: [] },
  funnel: { stages: [] },
  characterArchitecture: { applicable: false, layers: [] },
  opportunityMatrix: { points: [] },
  perceptionMap: { axes: [] },
  opportunityMap: { keep: [], discover: [], create: [] },
};

const EMPTY_EXECUTIVE_SUMMARY: ExecutiveSummaryResult = {
  findings: [],
  ipAtGlance: {
    currentPosition: "",
    coreAppeal: "",
    hiddenValue: "",
    topOpportunity: "",
    topRisk: "",
    recommendedDirection: "",
  },
  finalSentence: "",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: job } = await supabase
    .from("research_jobs")
    .select("id, keyword, period_start, period_end, research_mode")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: insight } = await admin
    .from("job_insights")
    .select(
      "top_keywords, sentiment_ratio, daily_trend, fandom_highlights, purchase_intent_summary, risk_alerts, research_references, visual_data, generated_at, raw_json"
    )
    .eq("job_id", jobId)
    .maybeSingle();
  const reportMode: ReportMode = (insight?.raw_json as { reportMode?: ReportMode } | null)?.reportMode ?? "standard";

  const { data: modulesData } = await admin
    .from("job_analysis_modules")
    .select("module_key, title, content_md")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

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

  // 웹과 PDF가 같은 판단/같은 중복 제거 결과를 보여주도록, 여기서 ReportModel을 먼저 만들고
  // PDF 전용 모듈 콘텐츠도 이 결과로부터 재구성한다(§ "웹에서는 있는데 PDF에서는 다른" 문제 방지).
  const reportModel = await loadReportModel(admin, jobId, {
    keyword: job.keyword,
    period_start: job.period_start,
    period_end: job.period_end,
    research_mode: job.research_mode,
  });

  // dedupeByDominantEvidence가 같은 영상을 핵심 근거로 삼는 여러 모듈의 insight를 하나로
  // 합쳤으므로, PDF도 원래 모듈별 raw content_md 대신 이 결과로 재구성한 콘텐츠를 쓴다.
  // 그래야 같은 발견(예: 침착맨 콜라보 캐릭터 반응)이 여러 페이지에서 반복되지 않는다.
  const survivingByModule = new Map<string, CanonicalInsight[]>();
  for (const section of reportModel.sections) {
    for (const ins of section.insights) {
      const list = survivingByModule.get(ins.moduleKey) ?? [];
      list.push(ins);
      survivingByModule.set(ins.moduleKey, list);
    }
  }
  const stripCanonicalFields = (ins: CanonicalInsight): StructuredInsight => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, moduleKey: _mk, moduleTitle: _mt, evidencePackage: _ep, ...rest } = ins;
    return rest;
  };

  const modules: ModuleContent[] = (modulesData ?? [])
    .filter((m) => m.module_key !== "executive_summary")
    .map((m) => {
      if (!(m.module_key in MODULE_SECTION_MAP)) {
        // insights 종류가 아닌 모듈(positioning/strategy 등)은 원본 그대로 사용
        return { moduleKey: m.module_key, title: m.title ?? m.module_key, content: m.content_md ?? "" };
      }
      const surviving = survivingByModule.get(m.module_key) ?? [];
      const content = wrapStoredContent({
        kind: "insights",
        data: {
          applicable: surviving.length > 0,
          notApplicableReason: surviving.length > 0 ? "" : "다른 모듈과 같은 근거를 다뤄 통합됨",
          insights: surviving.map(stripCanonicalFields),
        },
      });
      return { moduleKey: m.module_key, title: m.title ?? m.module_key, content };
    });

  // Evidence Visualization: 원본 영상/댓글 근거를 fetch해서 PDF용 카드 데이터로 미리 만들어둔다.
  // 실패해도(썸네일 fetch 실패 등) PDF 생성 자체는 막지 않는다. 위에서 중복 제거된 modules를
  // 그대로 넘겨, Evidence 페이지도 같은 영상을 중복으로 만들지 않는다.
  const evidenceSource = await loadEvidenceSource(admin, jobId);
  const evidenceByInsightId = await buildPdfEvidenceMap(
    modules.map((m) => ({ module_key: m.moduleKey, content_md: m.content })),
    evidenceSource
  );

  const execModule = (modulesData ?? []).find((m) => m.module_key === "executive_summary");
  const execParsed = execModule ? parseStoredModuleContent(execModule.content_md ?? "") : null;
  const executiveSummary =
    execParsed && execParsed.kind === "executive_summary" ? execParsed.data : EMPTY_EXECUTIVE_SUMMARY;

  // 웹과 PDF가 같은 판단을 보여주도록, "핵심 한 문장"은 raw finalSentence를 그대로 쓰지 않고
  // 웹과 동일한 buildReportModel()의 executiveDecision에서 가져온다(예: finalSentence가
  // "이 IP는 ______로 포지셔닝해야 한다."처럼 빈칸으로 남았을 때 웹은 자동으로 대체 문장을
  // 쓰는데 PDF만 빈칸 그대로 노출되는 불일치를 막는다).
  if (reportModel.executiveDecision) {
    executiveSummary.finalSentence = reportModel.executiveDecision.headline;
    if (!executiveSummary.currentSituation && reportModel.executiveDecision.kind === "decision") {
      executiveSummary.currentSituation = reportModel.executiveDecision.currentSituation;
    }
  }

  const stats: Aggregates = {
    topKeywords: insight?.top_keywords ?? [],
    sentimentRatio: insight?.sentiment_ratio ?? { positive: 0, negative: 0, neutral: 0 },
    dailyTrend: insight?.daily_trend ?? [],
    fandomHighlights: insight?.fandom_highlights ?? [],
    purchaseIntentSummary: insight?.purchase_intent_summary ?? { positiveRatio: 0, examples: [] },
    riskGroups: (insight?.risk_alerts ?? []).map(
      (r: { level: "caution" | "high_risk"; count?: number; example_comment_id?: string | null }) => ({
        level: r.level,
        count: r.count ?? 0,
        examples: [],
        exampleCommentIds: r.example_comment_id ? [r.example_comment_id] : [],
      })
    ),
  };

  const referenceUrls = ((insight?.research_references as ValidatedReference[] | null) ?? []).map((r) => r.url);
  const referenceQrEntries = await Promise.all(
    referenceUrls.map(async (url) => [url, await qrDataUri(url)] as const)
  );
  const referenceQrCodes: Record<string, string> = Object.fromEntries(
    referenceQrEntries.filter((entry): entry is [string, string] => entry[1] !== null)
  );

  const reportData: ReportData = {
    keyword: job.keyword,
    periodStart: job.period_start,
    periodEnd: job.period_end,
    videoCount: videoCount ?? 0,
    commentCount: commentCount ?? 0,
    postCount: postCount ?? 0,
    generatedAt: insight?.generated_at
      ? new Date(insight.generated_at).toLocaleDateString("ko-KR")
      : new Date().toLocaleDateString("ko-KR"),
    reportMode,
    researchMode: job.research_mode ?? "broad_research",
    dataCoverageNote: reportModel.dataCoverageNote,
    stats,
    modules,
    metrics: reportModel.metrics,
    visualData: (insight?.visual_data as VisualData) ?? EMPTY_VISUAL_DATA,
    researchReferences: (insight?.research_references as ValidatedReference[] | null) ?? [],
    executiveSummary,
    evidenceByInsightId,
    referenceQrCodes,
  };

  let pdfBuffer: Buffer;
  try {
    const html = buildReportHtml(reportData);
    pdfBuffer = await renderHtmlToPdf(html);
  } catch (err) {
    console.error("PDF generation failed", err);
    return NextResponse.json(
      { error: "PDF 생성 중 오류가 발생했습니다.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(job.keyword)}_report.pdf"`,
    },
  });
}
