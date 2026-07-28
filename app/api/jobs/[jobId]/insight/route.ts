import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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

  return NextResponse.json({
    keyword: job.keyword,
    periodStart: job.period_start,
    periodEnd: job.period_end,
    videoCount: videoCount ?? 0,
    commentCount: commentCount ?? 0,
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
