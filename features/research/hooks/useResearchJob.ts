"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportModel } from "@/lib/report/reportSchema";

export type JobStatus = {
  jobId: string;
  keyword: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  videoCount: number;
  commentCount: number;
  patternCount: number;
  totalLikes: number;
};

/** job 상태 폴링 + 파이프라인 구동 루프(4-worker) + 완료 시 ReportModel 로드를 한 곳에 모은다.
 * 컴포넌트는 여기서 나온 값만 그대로 그리면 되고, fetch/재시도/워커 로직을 직접 갖지 않는다. */
export function useResearchJob(jobId: string) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [report, setReport] = useState<ReportModel | null>(null);
  const reportFetched = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) setJob(await res.json());
  }, [jobId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isPipelineActive = job ? job.status !== "done" && job.status !== "failed" : false;

  // 파이프라인은 클라이언트가 /step을 계속 호출해야 진행된다(긴 작업을 서버가 붙잡지 않고
  // 짧은 단위로 쪼개 Vercel 시간제한을 피하기 위함). 같은 phase 안의 태스크(심층 분석 모듈 등)는
  // 서로 독립적이라 워커 여러 개를 동시에 돌려 병렬 처리한다(claimNextTask가 원자적이라 안전).
  useEffect(() => {
    if (!isPipelineActive) return;
    let stopped = false;
    // 서버가 /step 한 번에 태스크를 최대 3개씩 묶어서 처리하므로(lib/pipeline.ts TASK_BATCH_SIZE),
    // 워커 수를 그대로 6에 두면 동시 LLM 호출이 최대 18개까지 치솟아 API 요청 한도에 걸릴 수 있다.
    // 워커 수를 낮추는 대신 왕복 자체가 줄어서(태스크 3개당 요청 1번), 총 동시성은 이전과 비슷하게
    // 유지하면서(2 워커 x 3개 배치 = 최대 6개 동시) 태스크당 오가는 요청 수만 줄인다.
    const WORKER_COUNT = 2;

    async function worker() {
      while (!stopped) {
        let done = false;
        let ok = false;
        try {
          const res = await fetch(`/api/jobs/${jobId}/step`, { method: "POST" });
          if (res.ok) {
            const data = await res.json();
            done = Boolean(data.done);
            ok = true;
          }
        } catch {
          // 네트워크 오류 - 아래에서 재시도
        }
        if (stopped) break;
        if (done) {
          stopped = true;
          await fetchStatus();
          break;
        }
        await new Promise((r) => setTimeout(r, ok ? 100 : 1500));
      }
    }

    (async () => {
      await fetch(`/api/jobs/${jobId}/run`, { method: "POST" });
      const workers = Array.from({ length: WORKER_COUNT }, () => worker());
      const statusInterval = setInterval(() => {
        if (!stopped) fetchStatus();
      }, 1500);
      await Promise.all(workers);
      clearInterval(statusInterval);
    })();

    return () => {
      stopped = true;
    };
  }, [isPipelineActive, jobId, fetchStatus, retryTick]);

  useEffect(() => {
    if (job?.status === "done" && !reportFetched.current) {
      reportFetched.current = true;
      fetch(`/api/jobs/${jobId}/insight`)
        .then((r) => r.json())
        .then((data) => setReport(data.report ?? null));
    }
  }, [job?.status, jobId]);

  const retry = useCallback(async () => {
    await fetch(`/api/jobs/${jobId}/run`, { method: "POST" });
    await fetchStatus();
    setRetryTick((t) => t + 1);
  }, [jobId, fetchStatus]);

  return { job, report, retry };
}
