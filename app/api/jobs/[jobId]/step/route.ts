import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stepJob } from "@/lib/pipeline";

export const maxDuration = 60;

type Job = {
  id: string;
  keyword: string;
  period_start: string;
  period_end: string;
  max_videos: number;
  max_comments_per_video: number;
  status: string;
};

/**
 * 파이프라인 태스크 큐를 한 스텝(태스크 하나 또는 phase 전환) 진행시킨다.
 * 클라이언트가 이 라우트를 완료될 때까지 반복 호출한다.
 * 각 호출은 짧게 끝나도록 설계되어 있어 Vercel 함수 시간제한에 걸리지 않는다.
 */
export async function POST(
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
    .select("id, keyword, period_start, period_end, max_videos, max_comments_per_video, status")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle<Job>();

  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }
  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json({ done: true, status: job.status });
  }

  const admin = createAdminClient();
  const result = await stepJob(admin, job);

  return NextResponse.json(result);
}
