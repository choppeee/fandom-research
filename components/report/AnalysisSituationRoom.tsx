"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/app/login/actions";
import type { JobStatus } from "@/features/research/hooks/useResearchJob";
import { RabbitStaffScene } from "./RabbitStaffScene";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  stageForPhase,
  questionForStage,
  feedLineForStage,
  roomMilestonesReached,
  type NarrativeStage,
} from "@/lib/progress-narrative";

const STAGE_HEADLINE: Record<NarrativeStage, { title: string; body: string }> = {
  evidence: { title: "필요한 자료를 모으고 있어요.", body: "영상과 댓글을 수집하고 있어요." },
  observation: { title: "전체 흐름을 살펴보고 있어요.", body: "지금 어떤 상태인지 훑어보고 있어요." },
  pattern: { title: "패턴을 연결하고 있어요.", body: "반복되는 반응을 묶어 인사이트로 만들고 있어요." },
  interpretation: { title: "의미를 해석하고 있어요.", body: "패턴이 실제로 어디까지 반복되는지 다시 확인하고 있어요." },
  decision: { title: "결론을 정리하고 있어요.", body: "무엇을 유지하고 무엇을 테스트할지 정리하고 있어요." },
};

function formatRemaining(createdAt: string, progress: number): string {
  if (progress <= 2) return "계산 중";
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  if (elapsedMs <= 0) return "계산 중";
  const estimatedTotalMs = elapsedMs / (progress / 100);
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  const totalMin = Math.round(estimatedTotalMs / 60000);
  const remainMin = Math.floor(remainingMs / 60000);
  const remainSec = Math.floor((remainingMs % 60000) / 1000);
  if (remainMin <= 0) return `약 ${remainSec}초 남음 (총 ${Math.max(1, totalMin)}분 예상)`;
  return `약 ${remainMin}분 ${remainSec}초 남음 (총 ${Math.max(1, totalMin)}분 예상)`;
}

export function AnalysisSituationRoom({ job }: { job: JobStatus }) {
  const stage = stageForPhase(job.status);
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const milestones = useMemo(() => roomMilestonesReached(job.progress), [job.progress]);
  const [tick, setTick] = useState(0);
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  // 남은 시간 표시가 계속 흘러가도록 30초마다 재계산
  useEffect(() => {
    const id = setInterval(() => forceRerender((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const headline = STAGE_HEADLINE[stage];
  const remaining = job.createdAt ? formatRemaining(job.createdAt, job.progress) : "계산 중";
  const feedLine = feedLineForStage(stage, tick);
  const question = questionForStage(stage);

  return (
    <div className="min-h-screen bg-[#0F1012] text-white">
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-6">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <span className="text-[#E3262E]">✦</span> FANDOM RESEARCH
          </span>
          <nav className="flex items-center gap-5 text-sm text-white/50">
            <span>새 리서치</span>
            <span className="relative text-white">
              리포트
              <span className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-[#E3262E]" />
            </span>
          </nav>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5">
            로그아웃
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* 좌측: Information */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E3262E]" />
                분석 진행 중
              </div>
              <h1 className="text-3xl font-bold leading-tight">
                좋은 <span className="text-[#E3262E]">결정</span>은
                <br />
                준비된 회의에서 시작됩니다.
              </h1>
              <p className="mt-4 text-sm text-white/60">
                &ldquo;{job.keyword}&rdquo; ({job.periodStart} ~ {job.periodEnd})
              </p>
              <p className="text-sm text-white/40">
                {job.status === "pending" ? "대기 중" : headline.title} · 영상 {job.videoCount}개 · 댓글 {job.commentCount}개
              </p>
            </div>

            <div className="rounded-xl bg-[#1E1F23] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{headline.title}</p>
                  <p className="mt-1 text-xs text-white/50">{headline.body}</p>
                </div>
                <span className="text-2xl font-bold text-[#E3262E] tabular-nums">{job.progress}%</span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#E3262E] transition-all duration-700 ease-out"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              {STAGE_ORDER.map((s, i) => {
                const done = i < stageIndex || job.status === "done";
                const current = i === stageIndex && job.status !== "done";
                return (
                  <div key={s} className="flex flex-1 flex-col items-center gap-2 text-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                        done
                          ? "border-[#E3262E] bg-[#E3262E] text-white"
                          : current
                            ? "border-[#E3262E] bg-[#E3262E] text-white"
                            : "border-white/15 bg-transparent text-white/30"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </div>
                    <div className="text-[11px] leading-tight">
                      <div className={current ? "text-white" : "text-white/40"}>{STAGE_LABEL[s].en}</div>
                      <div className="text-white/30">{STAGE_LABEL[s].ko}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우측: 상황실 일러스트 */}
          <div className="min-h-[360px] overflow-hidden rounded-xl bg-[#17181B]">
            <RabbitStaffScene milestones={milestones} />
          </div>
        </div>

        {/* 하단 정보 카드 3개 */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-[#1E1F23] p-5">
            <p className="text-xs text-white/40">예상 소요 시간</p>
            <p className="mt-2 text-lg font-semibold">{remaining}</p>
          </div>
          <div className="rounded-xl bg-[#1E1F23] p-5">
            <p className="mb-3 text-xs text-white/40">현재 분석 현황</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <StatCell label="댓글 수집" value={job.commentCount} />
              <StatCell label="영상 분석" value={job.videoCount} />
              <StatCell label="패턴 발견" value={job.patternCount} />
              <StatCell label="공감 반응" value={job.totalLikes} />
            </div>
          </div>
          <div className="rounded-xl bg-[#1E1F23] p-5">
            <p className="text-xs text-white/40">AI가 지금 고민하는 질문</p>
            <p className="mt-2 text-sm font-medium leading-snug">{question}</p>
          </div>
        </div>

        {/* Live Insight Feed */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#17181B] px-5 py-4 text-sm text-white/60">
          <span className="text-[#E3262E]">●</span>
          <span key={feedLine} className="rs-feed-line">
            {feedLine}
          </span>
        </div>
      </main>

      <style>{`
        @keyframes rsFeedIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .rs-feed-line { animation: rsFeedIn 0.4s ease; }
      `}</style>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-base font-bold tabular-nums">{value.toLocaleString("ko-KR")}</div>
      <div className="text-[10px] text-white/35">{label}</div>
    </div>
  );
}
