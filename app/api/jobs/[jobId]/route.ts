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

  const { data: job, error } = await supabase
    .from("research_jobs")
    .select(
      "id, keyword, period_start, period_end, status, progress, error_message, max_videos, max_comments_per_video, created_at"
    )
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }

  const admin = createAdminClient();
  const [{ count: videoCount }, { count: commentCount }, { count: patternCount }, { data: likeRows }] = await Promise.all([
    admin.from("youtube_videos").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    admin.from("youtube_comments").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    // 진행 화면의 "패턴 발견" 수 - 지금까지 저장된 분석 모듈 개수를 그대로 쓴다(가짜 수치 아님).
    admin.from("job_analysis_modules").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    admin.from("youtube_comments").select("like_count").eq("job_id", jobId),
  ]);
  const totalLikes = (likeRows ?? []).reduce((sum, r) => sum + ((r.like_count as number) ?? 0), 0);

  return NextResponse.json({
    jobId: job.id,
    keyword: job.keyword,
    periodStart: job.period_start,
    periodEnd: job.period_end,
    status: job.status,
    progress: job.progress,
    errorMessage: job.error_message,
    maxVideos: job.max_videos,
    maxCommentsPerVideo: job.max_comments_per_video,
    createdAt: job.created_at,
    videoCount: videoCount ?? 0,
    commentCount: commentCount ?? 0,
    patternCount: patternCount ?? 0,
    totalLikes,
  });
}
