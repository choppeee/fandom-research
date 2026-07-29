import type { SupabaseClient } from "@supabase/supabase-js";

export type AnalysisTask = {
  id: string;
  job_id: string;
  task_type: string;
  status: "pending" | "processing" | "success" | "failed";
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  payload: Record<string, unknown> | null;
};

export async function enqueueTasks(
  admin: SupabaseClient,
  jobId: string,
  tasks: { type: string; payload?: Record<string, unknown> }[]
) {
  if (tasks.length === 0) return;
  const { error } = await admin.from("analysis_tasks").insert(
    tasks.map((t) => ({
      job_id: jobId,
      task_type: t.type,
      payload: t.payload ?? null,
      status: "pending",
    }))
  );
  if (error) throw new Error(`태스크 생성 실패: ${error.message}`);
}

/**
 * 이 Job의 가장 오래된 대기 중 태스크 하나를 처리 중 상태로 바꾸고 반환한다.
 * update 조건에 status="pending"을 다시 걸어, 동시에 두 요청이 같은 태스크를 집었을 때
 * 실제로 행을 갱신한 쪽(count>0)만 태스크를 가져가도록 한다(동시성 경쟁 방지).
 */
export async function claimNextTask(admin: SupabaseClient, jobId: string): Promise<AnalysisTask | null> {
  const { data } = await admin
    .from("analysis_tasks")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const { data: updated } = await admin
    .from("analysis_tasks")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("status", "pending")
    .select("id");

  if (!updated || updated.length === 0) return null; // 다른 요청이 먼저 가져감

  return data as AnalysisTask;
}

export async function completeTask(admin: SupabaseClient, taskId: string) {
  await admin
    .from("analysis_tasks")
    .update({ status: "success", updated_at: new Date().toISOString() })
    .eq("id", taskId);
}

/** 실패 처리. 재시도 여지가 있으면 pending으로 되돌리고 false, 완전히 실패하면 failed로 표시하고 true를 반환. */
export async function failTask(admin: SupabaseClient, task: AnalysisTask, errorMessage: string): Promise<boolean> {
  const attempt = (task.attempt_count ?? 0) + 1;
  const maxAttempts = task.max_attempts ?? 3;

  if (attempt < maxAttempts) {
    await admin
      .from("analysis_tasks")
      .update({
        status: "pending",
        attempt_count: attempt,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    return false;
  }

  await admin
    .from("analysis_tasks")
    .update({
      status: "failed",
      attempt_count: attempt,
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);
  return true;
}

/** 주어진 phase 태그에 해당하는 태스크 중 아직 안 끝난(pending/processing) 것이 있는지 센다. */
export async function countUnfinishedInPhase(admin: SupabaseClient, jobId: string, phase: string): Promise<number> {
  const { count } = await admin
    .from("analysis_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["pending", "processing"])
    .contains("payload", { phase });
  return count ?? 0;
}

/** phase 내 전체/완료(성공+영구실패) 태스크 수 - 진행률 계산용. */
export async function getPhaseTaskCounts(
  admin: SupabaseClient,
  jobId: string,
  phase: string
): Promise<{ total: number; done: number }> {
  const { count: total } = await admin
    .from("analysis_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .contains("payload", { phase });
  const { count: done } = await admin
    .from("analysis_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["success", "failed"])
    .contains("payload", { phase });
  return { total: total ?? 0, done: done ?? 0 };
}

/** 해당 phase의 태스크가 이미 한 번이라도 생성된 적 있는지(중복 enqueue 방지). */
export async function phaseTasksExist(admin: SupabaseClient, jobId: string, phase: string): Promise<boolean> {
  const { count } = await admin
    .from("analysis_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .contains("payload", { phase });
  return (count ?? 0) > 0;
}

