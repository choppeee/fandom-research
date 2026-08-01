import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { parseStoredModuleContent, type StructuredInsight } from "@/lib/insight-types";
import { loadEvidenceSource, buildEvidencePackage } from "@/lib/evidence-resolve";
import type { EvidencePackage } from "@/lib/evidence-types";
import { REPORT_ORDER } from "@/lib/pipeline";

type InsightWithEvidence = StructuredInsight & { evidenceId: string; evidencePackage: EvidencePackage };

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
    .select("id, keyword, period_start, period_end, status")
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
      "summary_text, top_keywords, sentiment_ratio, daily_trend, fandom_highlights, purchase_intent_summary, risk_alerts, generated_at"
    )
    .eq("job_id", jobId)
    .maybeSingle();

  const { count: videoCount } = await admin
    .from("youtube_videos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  const { count: commentCount } = await admin
    .from("youtube_comments")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);

  const { data: moduleRows } = await admin
    .from("job_analysis_modules")
    .select("module_key, title, content_md")
    .eq("job_id", jobId);

  // 웹 리포트의 Evidence Visualization(영상/댓글 근거 카드)에 쓸 원본 데이터를 한 번만 로드해
  // 모듈마다 다시 쿼리하지 않는다.
  const evidenceSource = await loadEvidenceSource(admin, jobId);

  const byKey = new Map((moduleRows ?? []).map((m) => [m.module_key, m]));
  const modules = REPORT_ORDER.map((moduleKey) => {
    const row = byKey.get(moduleKey);
    if (!row) return null;
    const parsed = parseStoredModuleContent(row.content_md);
    if (!parsed) {
      // 구버전 자유 마크다운 job - 구조화 렌더링 불가, 클라이언트가 summaryText로 폴백한다.
      return { moduleKey, title: row.title, kind: "legacy" as const, insights: undefined };
    }
    if (parsed.kind !== "insights") return null; // positioning/strategy/executive_summary는 웹 카드 대상 아님
    if (!parsed.data.applicable) return null;

    const insights: InsightWithEvidence[] = parsed.data.insights.map((ins, idx) => {
      const evidenceId = `${moduleKey}-${idx}`;
      const evidencePackage = buildEvidencePackage({
        insightId: evidenceId,
        headline: ins.headline,
        evidenceIds: ins.evidenceIds,
        confidence: ins.confidence,
        source: evidenceSource,
      });
      return { ...ins, evidenceId, evidencePackage };
    });

    return { moduleKey, title: row.title, kind: "insights" as const, insights };
  }).filter((m): m is NonNullable<typeof m> => m !== null);

  return NextResponse.json({
    keyword: job.keyword,
    periodStart: job.period_start,
    periodEnd: job.period_end,
    videoCount: videoCount ?? 0,
    commentCount: commentCount ?? 0,
    modules,
    insight: insight
      ? {
          summaryText: insight.summary_text,
          topKeywords: insight.top_keywords,
          sentimentRatio: insight.sentiment_ratio,
          dailyTrend: insight.daily_trend,
          fandomHighlights: insight.fandom_highlights,
          purchaseIntentSummary: insight.purchase_intent_summary,
          riskAlerts: insight.risk_alerts,
        }
      : null,
  });
}
