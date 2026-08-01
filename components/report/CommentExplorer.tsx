"use client";

import { useEffect, useState } from "react";

type CommentItem = {
  commentId: string;
  videoId: string;
  text: string;
  likeCount: number;
  publishedAt: string | null;
  analysis: { sentiment: string; risk_flag: string } | null;
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#16A34A",
  negative: "#E3262E",
  neutral: "#8B8B8B",
};

export function CommentExplorer({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sentiment, setSentiment] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const params = new URLSearchParams({ jobId, page: String(page) });
    if (sentiment !== "all") params.set("sentiment", sentiment);
    if (q) params.set("q", q);
    fetch(`/api/comments?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.comments ?? []);
        setTotal(data.total ?? 0);
      });
  }, [jobId, sentiment, q, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-3 rounded-xl border border-line p-5">
      <h2 className="text-lg font-bold text-ink">원문 댓글 탐색기</h2>
      <div className="flex flex-wrap gap-2">
        <select
          value={sentiment}
          onChange={(e) => {
            setPage(1);
            setSentiment(e.target.value);
          }}
          className="rounded-md border border-line px-2 py-1.5 text-sm"
        >
          <option value="all">전체 감성</option>
          <option value="positive">긍정</option>
          <option value="negative">부정</option>
          <option value="neutral">중립</option>
        </select>
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="댓글 내용 검색"
          className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm"
        />
      </div>

      <ul className="divide-y divide-line">
        {items.map((c) => (
          <li key={c.commentId} className="space-y-1 py-2 text-sm">
            <p className="text-ink">{c.text}</p>
            <p className="text-xs text-ink-muted">
              좋아요 {c.likeCount} · {c.publishedAt?.slice(0, 10) ?? "-"}
              {c.analysis && (
                <>
                  {" "}
                  ·{" "}
                  <span style={{ color: SENTIMENT_COLORS[c.analysis.sentiment] }}>{c.analysis.sentiment}</span>
                  {c.analysis.risk_flag !== "none" && <span className="text-danger"> · {c.analysis.risk_flag}</span>}
                </>
              )}
            </p>
          </li>
        ))}
        {items.length === 0 && <li className="py-4 text-sm text-ink-muted">조건에 맞는 댓글이 없습니다.</li>}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-ink-secondary disabled:opacity-40">
            이전
          </button>
          <span className="text-ink-muted">
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-ink-secondary disabled:opacity-40">
            다음
          </button>
        </div>
      )}
    </section>
  );
}
