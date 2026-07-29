import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * 파이프라인을 "시작 가능" 상태로만 표시한다. 실제 실행(태스크 생성/처리)은
 * 클라이언트가 반복 호출하는 /step 라우트에서 이루어진다 (Vercel 함수 시간제한 회피).
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
    .select("id, status")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job을 찾을 수 없습니다." }, { status: 404 });
  }

  if (job.status === "failed") {
    // 실패했던 태스크를 재시도 가능하게 되돌리고, 그 태스크가 속했던 phase로 job 상태를 복원한다.
    // (처음부터 다시 하지 않고 멈춘 지점부터 이어서 진행하기 위함)
    const admin = createAdminClient();
    const { data: failedTasks } = await admin
      .from("analysis_tasks")
      .select("id, payload")
      .eq("job_id", jobId)
      .eq("status", "failed");

    if (failedTasks && failedTasks.length > 0) {
      await admin
        .from("analysis_tasks")
        .update({ status: "pending", attempt_count: 0, last_error: null })
        .in(
          "id",
          failedTasks.map((t) => t.id)
        );

      const resumePhase =
        (failedTasks[0].payload as { phase?: string } | null)?.phase ?? "collect";
      await admin
        .from("research_jobs")
        .update({ status: resumePhase, error_message: null })
        .eq("id", jobId);
    } else {
      // 실패한 태스크를 못 찾으면(이례적) 안전하게 처음부터 다시 시작
      await admin
        .from("research_jobs")
        .update({ status: "collect", error_message: null, progress: 0 })
        .eq("id", jobId);
    }
  }

  return NextResponse.json({ jobId: job.id, status: job.status, started: true });
}
