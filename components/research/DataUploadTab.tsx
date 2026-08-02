"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TARGET_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "commentText", label: "댓글/피드백 (필수 - 본문과 최소 하나)" },
  { key: "contentText", label: "본문/캡션" },
  { key: "replyText", label: "답글" },
  { key: "platform", label: "플랫폼" },
  { key: "accountName", label: "계정명" },
  { key: "sourceUrl", label: "게시물 URL" },
  { key: "contentId", label: "콘텐츠 ID" },
  { key: "contentType", label: "콘텐츠 유형" },
  { key: "publishedAt", label: "작성일시" },
  { key: "likeCount", label: "좋아요 수" },
  { key: "viewCount", label: "조회수" },
  { key: "saveCount", label: "저장 수" },
  { key: "shareCount", label: "공유 수" },
  { key: "authorId", label: "작성자 식별자 (해시 처리되어 저장됨)" },
  { key: "campaign", label: "캠페인" },
  { key: "product", label: "제품/상품" },
];

type ParsedResult = {
  headers: string[];
  rows: Record<string, unknown>[];
  preview: Record<string, unknown>[];
  totalRowCount: number;
  usedRowCount: number;
  suggestedMapping: Record<string, string | null>;
  warnings: string[];
};

export function DataUploadTab() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [datasetLabel, setDatasetLabel] = useState("");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!file) return;
    setError(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "파일을 처리하지 못했습니다.");
        return;
      }
      setParsed(data);
      setMapping(data.suggestedMapping);
      if (!datasetLabel) setDatasetLabel(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!parsed) return;
    setError(null);
    setCommitting(true);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows, mapping, datasetLabel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "업로드 확정에 실패했습니다.");
        setCommitting(false);
        return;
      }
      router.push(`/jobs/${data.jobId}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setCommitting(false);
    }
  }

  if (!parsed) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-line bg-surface-soft px-3.5 py-3 text-xs leading-relaxed text-ink-secondary">
          이미 보유한 댓글/VOC/리뷰 데이터(CSV, XLSX, JSON)를 업로드해 같은 분석 파이프라인으로
          리포트를 생성합니다. 파일에 없는 값은 임의로 채우지 않습니다.
        </div>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.json,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={handleParse}
          disabled={!file || parsing}
          className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {parsing ? "파일 읽는 중..." : "파일 불러오기"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {parsed.warnings.length > 0 && (
        <div className="space-y-1 rounded-md border border-warn/30 bg-warn-soft px-3.5 py-3 text-xs text-ink">
          {parsed.warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">데이터셋 이름</label>
        <input
          value={datasetLabel}
          onChange={(e) => setDatasetLabel(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">컬럼 매핑 ({parsed.usedRowCount.toLocaleString("ko-KR")}행)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TARGET_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <label className="w-40 flex-shrink-0 text-xs text-ink-secondary">{f.label}</label>
              <select
                value={mapping[f.key] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">(매핑 안 함)</option>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink">미리보기 (상위 {Math.min(20, parsed.preview.length)}행)</p>
        <div className="max-h-64 overflow-auto rounded-md border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-soft">
              <tr>
                {parsed.headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-ink-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.preview.map((row, i) => (
                <tr key={i} className="border-t border-line">
                  {parsed.headers.map((h) => (
                    <td key={h} className="max-w-[160px] truncate px-2 py-1.5 text-ink">
                      {String(row[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setParsed(null);
            setFile(null);
          }}
          className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-secondary hover:border-ink-muted"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleCommit}
          disabled={committing}
          className="flex-1 rounded-md bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {committing ? "생성 중..." : "이 데이터로 분석 시작하기"}
        </button>
      </div>
    </div>
  );
}
