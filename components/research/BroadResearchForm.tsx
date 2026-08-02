"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function BroadResearchForm() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [periodStart, setPeriodStart] = useState(isoDaysAgo(30));
  const [periodEnd, setPeriodEnd] = useState(isoDaysAgo(0));
  const [maxVideos, setMaxVideos] = useState(20);
  const [maxCommentsPerVideo, setMaxCommentsPerVideo] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!keyword.trim()) {
      setError("키워드를 입력해주세요.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchMode: "broad_research",
          keyword: keyword.trim(),
          periodStart,
          periodEnd,
          maxVideos,
          maxCommentsPerVideo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Job 생성에 실패했습니다.");
        setPending(false);
        return;
      }
      localStorage.setItem("lastResearchMode", "broad_research");
      router.push(`/jobs/${data.jobId}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="keyword" className="text-sm font-medium text-ink">
          키워드 또는 채널
        </label>
        <input
          id="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 아이브"
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="periodStart" className="text-sm font-medium text-ink">
            시작일
          </label>
          <input
            id="periodStart"
            type="date"
            value={periodStart}
            max={periodEnd}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="periodEnd" className="text-sm font-medium text-ink">
            종료일
          </label>
          <input
            id="periodEnd"
            type="date"
            value={periodEnd}
            min={periodStart}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="maxVideos" className="text-sm font-medium text-ink">
            영상 수 상한
          </label>
          <input
            id="maxVideos"
            type="number"
            min={1}
            max={200}
            value={maxVideos}
            onChange={(e) => setMaxVideos(Number(e.target.value))}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="maxComments" className="text-sm font-medium text-ink">
            영상당 댓글 수 상한
          </label>
          <input
            id="maxComments"
            type="number"
            min={1}
            max={200}
            value={maxCommentsPerVideo}
            onChange={(e) => setMaxCommentsPerVideo(Number(e.target.value))}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>
      <p className="text-xs text-ink-muted">테스트 중에는 값을 작게 유지하는 것을 권장합니다 (유튜브 쿼터/Claude 비용 절약).</p>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? "생성 중..." : "IP 리서치 시작하기"}
      </button>
    </form>
  );
}
