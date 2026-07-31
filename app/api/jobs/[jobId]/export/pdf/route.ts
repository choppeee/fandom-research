import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buildReportHtml, renderHtmlToPdf, type ModuleContent, type ReportData } from "@/lib/pdf/render";
import type { VisualData } from "@/lib/visual-data";
import type { Aggregates } from "@/lib/aggregate";

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

function splitExecutiveSummary(content: string): { summary: string; conclusion: string } {
  const marker = "## Final Strategic Conclusion";
  const idx = content.indexOf(marker);
  if (idx === -1) return { summary: content, conclusion: "" };
  return { summary: content.slice(0, idx).trim(), conclusion: content.slice(idx).trim() };
}

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
    .select("id, keyword, period_start, period_end")
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
      "top_keywords, sentiment_ratio, daily_trend, fandom_highlights, purchase_intent_summary, risk_alerts, research_references, visual_data, generated_at"
    )
    .eq("job_id", jobId)
    .maybeSingle();

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

  const modules: ModuleContent[] = (modulesData ?? [])
    .filter((m) => m.module_key !== "executive_summary")
    .map((m) => ({ moduleKey: m.module_key, title: m.title ?? m.module_key, content: m.content_md ?? "" }));

  const execModule = (modulesData ?? []).find((m) => m.module_key === "executive_summary");
  const { summary, conclusion } = execModule ? splitExecutiveSummary(execModule.content_md ?? "") : { summary: "", conclusion: "" };

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
    stats,
    modules,
    visualData: (insight?.visual_data as VisualData) ?? EMPTY_VISUAL_DATA,
    researchReferences: insight?.research_references ?? [],
    executiveSummaryMd: summary,
    finalConclusionMd: conclusion,
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
