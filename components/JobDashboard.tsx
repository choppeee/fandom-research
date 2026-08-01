"use client";

import { useResearchJob } from "@/features/research/hooks/useResearchJob";
import { ReportPage } from "@/components/report/ReportPage";
import { ReportHeader } from "@/components/report/ReportHeader";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기 중",
  collect: "영상·댓글 수집 중",
  classify: "댓글 1차 분류 중",
  aggregate: "통계 집계 중",
  context: "IP 유형 판별 중",
  modules: "심층 분석 중 (인식·심리·전환 등)",
  platform: "플랫폼별 분석 중",
  cross: "플랫폼 교차 분석 중",
  positioning: "포지셔닝 전략 도출 중",
  strategy_actions: "실행 전략·아이디어 생성 중",
  editorial: "리포트 문체 편집 중",
  reference: "외부 레퍼런스 검색 중",
  executive_summary: "종합 요약 작성 중",
  visual_data: "시각화 데이터 추출 중",
  assemble: "리포트 조립 중",
  done: "완료",
  failed: "실패",
};

/** job 상태 수신 + loading/failed/done 분기만 담당한다. 데이터 가공/렌더링 판단은 전부
 * lib/report(ReportModel)와 ReportPage 쪽으로 옮겨졌다. */
export function JobDashboard({ jobId }: { jobId: string }) {
  const { job, report, retry } = useResearchJob(jobId);

  if (!job || job.status !== "done") {
    return (
      <div className="min-h-screen bg-bg">
        <ReportHeader active="jobs" />
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
          {!job ? (
            <p className="text-ink-muted">불러오는 중...</p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  &ldquo;{job.keyword}&rdquo; ({job.periodStart} ~ {job.periodEnd})
                </h2>
                <p className="text-sm text-ink-muted">
                  {STATUS_LABEL[job.status] ?? job.status} · 영상 {job.videoCount}개 · 댓글 {job.commentCount}개
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                <div className="h-full bg-brand transition-all" style={{ width: `${job.progress}%` }} />
              </div>
              <p className="text-sm text-ink-muted">{job.progress}%</p>
              {job.status === "failed" && (
                <div className="space-y-2 rounded-md border border-danger/30 bg-danger-soft p-3">
                  <p className="text-sm text-danger">{job.errorMessage ?? "알 수 없는 오류로 실패했습니다."}</p>
                  <button onClick={retry} className="rounded-md bg-brand px-3 py-1.5 text-sm text-white">
                    재시도
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
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
