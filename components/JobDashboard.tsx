"use client";

import { useResearchJob } from "@/features/research/hooks/useResearchJob";
import { ReportPage } from "@/components/report/ReportPage";
import { ReportHeader } from "@/components/report/ReportHeader";
import { AnalysisSituationRoom } from "@/components/report/AnalysisSituationRoom";

/** job 상태 수신 + loading/failed/done 분기만 담당한다. 데이터 가공/렌더링 판단은 전부
 * lib/report(ReportModel)와 ReportPage 쪽으로 옮겨졌다. 진행 중 화면(대기~조립)은
 * AnalysisSituationRoom이 전담한다. */
export function JobDashboard({ jobId }: { jobId: string }) {
  const { job, report, retry } = useResearchJob(jobId);

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0F1012]">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-white/40">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="min-h-screen bg-[#0F1012] text-white">
        <header className="flex h-14 items-center border-b border-white/10 px-6 text-sm font-bold">FANDOM RESEARCH</header>
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
          <h2 className="text-lg font-semibold">
            &ldquo;{job.keyword}&rdquo; ({job.periodStart} ~ {job.periodEnd})
          </h2>
          <div className="space-y-2 rounded-md border border-[#E3262E]/30 bg-[#E3262E]/10 p-3">
            <p className="text-sm text-[#ff8a8f]">{job.errorMessage ?? "알 수 없는 오류로 실패했습니다."}</p>
            <button onClick={retry} className="rounded-md bg-[#E3262E] px-3 py-1.5 text-sm text-white">
              재시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (job.status !== "done") {
    return <AnalysisSituationRoom job={job} />;
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-bg">
        <ReportHeader active="jobs" />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-ink-muted">리포트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return <ReportPage jobId={jobId} report={report} />;
}
