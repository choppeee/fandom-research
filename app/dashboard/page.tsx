import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ResearchModeSelector } from "@/components/research/ResearchModeSelector";
import { stageForPhase, STAGE_LABEL } from "@/lib/progress-narrative";
import type { ReportMode } from "@/lib/report-mode";
import type { CoverageAudit } from "@/lib/coverage-audit";

type JobRow = {
  id: string;
  keyword: string;
  period_start: string;
  period_end: string;
  status: string;
  progress: number;
  created_at: string;
};

type QueueStatus = "coverage_check" | "needs_review" | "decision_ready";

const QUEUE_LABEL: Record<QueueStatus, { text: string; className: string }> = {
  coverage_check: { text: "Coverage Check Required", className: "bg-warning-soft text-warning" },
  needs_review: { text: "Needs Review", className: "bg-surface-soft text-ink-secondary" },
  decision_ready: { text: "Decision Ready", className: "bg-positive-soft text-positive" },
};

function classifyQueueStatus(raw: { reportMode?: ReportMode; coverageAudit?: CoverageAudit } | null): QueueStatus {
  if ((raw?.coverageAudit?.concentrationWarnings ?? []).length > 0) return "coverage_check";
  if (raw?.reportMode === "exploratory") return "needs_review";
  return "decision_ready";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: jobs } = await supabase
    .from("research_jobs")
    .select("id, keyword, period_start, period_end, status, progress, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const allJobs = (jobs ?? []) as JobRow[];
  const doneJobs = allJobs.filter((j) => j.status === "done");
  const inProgressJobs = allJobs.filter((j) => j.status !== "done" && j.status !== "failed");

  const admin = createAdminClient();
  const doneJobIds = doneJobs.map((j) => j.id);
  const { data: insightRows } =
    doneJobIds.length > 0
      ? await admin.from("job_insights").select("job_id, raw_json").in("job_id", doneJobIds)
      : { data: [] as { job_id: string; raw_json: unknown }[] };
  const rawByJob = new Map((insightRows ?? []).map((r) => [r.job_id, r.raw_json as { reportMode?: ReportMode; coverageAudit?: CoverageAudit } | null]));

  const queueJobs = doneJobs
    .map((j) => ({ job: j, status: classifyQueueStatus(rawByJob.get(j.id) ?? null) }))
    .filter((q) => q.status !== "decision_ready")
    .slice(0, 5);

  const recentJobs = doneJobs.slice(0, 5);

  return (
    <div className="min-h-screen bg-bg">
      <ReportHeader active="dashboard" userEmail={user.email} />
      <main className="mx-auto max-w-4xl space-y-14 px-6 py-12">
        {/* 1. Decision Queue - 검토가 필요한 것만. 없으면 빈 상태를 보여주되 섹션 자체는 유지한다
            (위치가 화면마다 바뀌면 워크스페이스로 안 느껴진다). */}
        <section>
          <SectionHeading eyebrow="DECISION QUEUE" title="오늘 검토해야 할 리포트" />
          {queueJobs.length === 0 ? (
            <EmptyRow text="지금 검토가 필요한 리포트가 없습니다." />
          ) : (
            <div className="space-y-2">
              {queueJobs.map(({ job, status }) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{job.keyword}</p>
                    <p className="text-xs text-ink-muted">
                      {job.period_start} ~ {job.period_end}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${QUEUE_LABEL[status].className}`}>
                    {QUEUE_LABEL[status].text}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 2. Continue Research - 진행 중인 것 */}
        <section>
          <SectionHeading eyebrow="CONTINUE RESEARCH" title="진행 중인 리서치" />
          {inProgressJobs.length === 0 ? (
            <EmptyRow text="진행 중인 리서치가 없습니다." />
          ) : (
            <div className="space-y-2">
              {inProgressJobs.map((job) => {
                const stage = stageForPhase(job.status);
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{job.keyword}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-soft">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${job.progress}%` }} />
                        </div>
                        <span className="text-xs text-ink-muted">
                          {STAGE_LABEL[stage].ko} · {job.progress}%
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-secondary">
                      계속하기
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Recent Intelligence - 최근 완료된 것 */}
        <section>
          <SectionHeading eyebrow="RECENT INTELLIGENCE" title="최근 완료된 리포트" linkHref="/jobs" linkLabel="전체 보기" />
          {recentJobs.length === 0 ? (
            <EmptyRow text="아직 완료된 리포트가 없습니다." />
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{job.keyword}</p>
                    <p className="text-xs text-ink-muted">{new Date(job.created_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive">
                    Completed
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 4. New Research - 가장 마지막 */}
        <section>
          <SectionHeading eyebrow="NEW RESEARCH" title="새로운 분석 시작하기" />
          <ResearchModeSelector />
        </section>
      </main>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  linkHref,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <p className="text-xs font-semibold tracking-wide text-ink-muted">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold text-ink">{title}</h2>
      </div>
      {linkHref && (
        <Link href={linkHref} className="text-xs font-medium text-brand hover:text-brand-hover">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-muted">{text}</div>;
}
