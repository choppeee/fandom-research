"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type JobStatus = {
  jobId: string;
  keyword: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  videoCount: number;
  commentCount: number;
};

type Insight = {
  summaryText: string;
  topKeywords: { keyword: string; count: number }[];
  sentimentRatio: { positive: number; negative: number; neutral: number };
  dailyTrend: {
    date: string;
    mentions: number;
    engagement: number;
    positive: number;
    negative: number;
    neutral: number;
  }[];
  fandomHighlights: { expression: string; count: number; example: string }[];
  purchaseIntentSummary: { positiveRatio: number; examples: string[] };
  riskAlerts: { level: "caution" | "high_risk"; description: string; example_comment_id: string | null }[];
};

type CommentItem = {
  commentId: string;
  videoId: string;
  text: string;
  likeCount: number;
  publishedAt: string | null;
  analysis: { sentiment: string; risk_flag: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기 중",
  collecting_videos: "영상 수집 중",
  collecting_comments: "댓글 수집 중",
  analyzing: "분석 중",
  done: "완료",
  failed: "실패",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
};

export function JobDashboard({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const startedRun = useRef(false);
  const insightFetched = useRef(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) setJob(await res.json());
  }, [jobId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // pending 상태면 파이프라인 실행 트리거 (1회)
  useEffect(() => {
    if (job?.status === "pending" && !startedRun.current) {
      startedRun.current = true;
      fetch(`/api/jobs/${jobId}/run`, { method: "POST" }).finally(fetchStatus);
    }
  }, [job?.status, jobId, fetchStatus]);

  // 진행 중이면 3초마다 폴링
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed") return;
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [job, fetchStatus]);

  // 완료되면 인사이트 로드
  useEffect(() => {
    if (job?.status === "done" && !insightFetched.current) {
      insightFetched.current = true;
      fetch(`/api/jobs/${jobId}/insight`)
        .then((r) => r.json())
        .then((data) => setInsight(data.insight));
    }
  }, [job?.status, jobId]);

  function retry() {
    startedRun.current = false;
    fetch(`/api/jobs/${jobId}/run`, { method: "POST" }).finally(fetchStatus);
    startedRun.current = true;
  }

  if (!job) {
    return <p className="text-muted-foreground">불러오는 중...</p>;
  }

  if (job.status !== "done") {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            &ldquo;{job.keyword}&rdquo; ({job.periodStart} ~ {job.periodEnd})
          </h2>
          <p className="text-sm text-muted-foreground">
            {STATUS_LABEL[job.status] ?? job.status} · 영상 {job.videoCount}개 · 댓글 {job.commentCount}개
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{job.progress}%</p>
        {job.status === "failed" && (
          <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{job.errorMessage ?? "알 수 없는 오류로 실패했습니다."}</p>
            <button
              onClick={retry}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              재시도
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          &ldquo;{job.keyword}&rdquo; ({job.periodStart} ~ {job.periodEnd})
        </h2>
        <div className="flex gap-2">
          <a
            href={`/api/jobs/${jobId}/export/csv`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            CSV 다운로드
          </a>
          <a
            href={`/api/jobs/${jobId}/export/pdf`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            PDF 리포트
          </a>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
        <Stat label="총 영상 수" value={job.videoCount} />
        <Stat label="총 댓글 수" value={job.commentCount} />
        <Stat label="분석 기간" value={`${job.periodStart} ~ ${job.periodEnd}`} small />
        <Stat label="상태" value="완료" />
      </section>

      {!insight ? (
        <p className="text-muted-foreground">인사이트 불러오는 중...</p>
      ) : (
        <>
          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">IP 인텔리전스 리포트</h3>
            <p className="text-xs text-muted-foreground">
              대중 인식 구조·심리적 동인·포지셔닝 기회를 데이터 근거로 분석한 전략 리포트입니다.
            </p>
            <div className="ip-report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.summaryText}</ReactMarkdown>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">언급량·참여량 추이</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <ComposedChart data={insight.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mentions" name="언급량(댓글)" fill="hsl(var(--primary))" />
                  <Line type="monotone" dataKey="engagement" name="참여량(좋아요)" stroke="#f59e0b" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border p-4">
              <h3 className="font-semibold">연관 키워드 Top {insight.topKeywords.length}</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={insight.topKeywords} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis dataKey="keyword" type="category" fontSize={11} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <h3 className="font-semibold">감성 분석</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "긍정", key: "positive", value: insight.sentimentRatio.positive },
                        { name: "부정", key: "negative", value: insight.sentimentRatio.negative },
                        { name: "중립", key: "neutral", value: insight.sentimentRatio.neutral },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label={(d) => `${d.name} ${d.value}%`}
                    >
                      {["positive", "negative", "neutral"].map((k) => (
                        <Cell key={k} fill={SENTIMENT_COLORS[k]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">감성 추이 (날짜별)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={insight.dailyTrend} stackOffset="expand">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="positive" stackId="s" name="긍정" fill={SENTIMENT_COLORS.positive} />
                  <Bar dataKey="negative" stackId="s" name="부정" fill={SENTIMENT_COLORS.negative} />
                  <Bar dataKey="neutral" stackId="s" name="중립" fill={SENTIMENT_COLORS.neutral} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">팬덤 표현·밈 하이라이트</h3>
            {insight.fandomHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">발견된 팬덤 표현이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {insight.fandomHighlights.map((f) => (
                  <li key={f.expression} className="rounded-md bg-muted p-3 text-sm">
                    <span className="font-medium">&ldquo;{f.expression}&rdquo;</span>
                    <span className="text-muted-foreground"> · {f.count}회</span>
                    <p className="mt-1 text-muted-foreground">{f.example}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">구매의향/광고반응 지표</h3>
            <p className="text-sm">
              긍정 구매의향 비율: <span className="font-semibold">{insight.purchaseIntentSummary.positiveRatio}%</span>
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {insight.purchaseIntentSummary.examples.map((ex, i) => (
                <li key={i}>&ldquo;{ex}&rdquo;</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">이슈·위험 탐지</h3>
            {insight.riskAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">감지된 위험 신호가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {insight.riskAlerts.map((r, i) => (
                  <li
                    key={i}
                    className={`rounded-md border p-3 text-sm ${
                      r.level === "high_risk"
                        ? "border-red-300 bg-red-50"
                        : "border-yellow-300 bg-yellow-50"
                    }`}
                  >
                    <span className="font-medium">
                      {r.level === "high_risk" ? "고위험" : "주의"}
                    </span>{" "}
                    {r.description}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <CommentExplorer jobId={jobId} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={small ? "text-sm font-medium" : "text-xl font-bold"}>{value}</p>
    </div>
  );
}

function CommentExplorer({ jobId }: { jobId: string }) {
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
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">원문 댓글 탐색기</h3>
      <div className="flex flex-wrap gap-2">
        <select
          value={sentiment}
          onChange={(e) => {
            setPage(1);
            setSentiment(e.target.value);
          }}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
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
          className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>

      <ul className="divide-y divide-border">
        {items.map((c) => (
          <li key={c.commentId} className="space-y-1 py-2 text-sm">
            <p>{c.text}</p>
            <p className="text-xs text-muted-foreground">
              좋아요 {c.likeCount} · {c.publishedAt?.slice(0, 10) ?? "-"}
              {c.analysis && (
                <>
                  {" "}
                  ·{" "}
                  <span style={{ color: SENTIMENT_COLORS[c.analysis.sentiment] }}>
                    {c.analysis.sentiment}
                  </span>
                  {c.analysis.risk_flag !== "none" && <span className="text-red-600"> · {c.analysis.risk_flag}</span>}
                </>
              )}
            </p>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-sm text-muted-foreground">조건에 맞는 댓글이 없습니다.</li>
        )}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="disabled:opacity-40"
          >
            이전
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}
