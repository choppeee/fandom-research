import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { loadReportModel } from "@/lib/report/buildReportModel";

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
  const report = await loadReportModel(admin, jobId, {
    keyword: job.keyword,
    period_start: job.period_start,
    period_end: job.period_end,
  });

  return NextResponse.json({ report });
}
