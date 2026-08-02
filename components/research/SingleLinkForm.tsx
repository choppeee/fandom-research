"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResolvedSource, SourceResolveError } from "@/lib/sources/types";

const DEFAULT_MAX_COMMENTS = 100;

function costTier(maxComments: number): string {
  if (maxComments <= 50) return "가벼운 분석";
  if (maxComments <= 200) return "표준 분석";
  return "심층 분석";
}

export function SingleLinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ResolvedSource | null>(null);
  const [previewError, setPreviewError] = useState<SourceResolveError | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [maxComments, setMaxComments] = useState(DEFAULT_MAX_COMMENTS);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPreview(null);
    setPreviewError(null);
    if (!url.trim()) return;

    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch("/api/sources/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        const data = await res.json();
        if (data.ok) {
          setPreview(data.source);
        } else {
          setPreviewError(data.error);
        }
      } catch {
        setPreviewError({ code: "api_error", message: "네트워크 오류가 발생했습니다." });
      } finally {
        setPreviewing(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!preview) {
      setSubmitError("먼저 유효한 영상 링크를 입력해주세요.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchMode: "single_content",
          sourceType: preview.sourceType,
          sourceUrl: preview.sourceUrl,
          sourceId: preview.sourceId,
          sourceMetadata: preview.metadata,
          maxCommentsPerVideo: maxComments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Job 생성에 실패했습니다.");
        setPending(false);
        return;
      }
      localStorage.setItem("lastResearchMode", "single_content");
      router.push(`/jobs/${data.jobId}`);
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="videoUrl" className="text-sm font-medium text-ink">
          분석할 링크
        </label>
        <input
          id="videoUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-ink-muted">일반 영상, Shorts, youtu.be 단축 링크 모두 지원합니다.</p>
      </div>

      {previewing && <p className="text-sm text-ink-muted">영상 정보를 확인하는 중...</p>}

      {previewError && (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {previewError.message}
        </p>
      )}

      {preview && (
        <div className="flex gap-3 rounded-lg border border-line bg-surface-soft p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.metadata.thumbnailUrl} alt="" className="h-20 w-32 flex-shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium text-ink">{preview.metadata.title || "제목 없음"}</p>
            <p className="text-xs text-ink-secondary">
              {preview.metadata.channelTitle}
              {preview.metadata.publishedAt && ` · ${preview.metadata.publishedAt.slice(0, 10)}`}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              조회수 {preview.metadata.viewCount.toLocaleString("ko-KR")} · 댓글 {preview.metadata.commentCount.toLocaleString("ko-KR")}건
            </p>
            {preview.metadata.commentCount === 0 && (
              <p className="mt-1 text-xs text-warn">댓글이 없거나 비활성화된 영상일 수 있습니다.</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="maxComments" className="text-sm font-medium text-ink">
          댓글 수 상한
        </label>
        <input
          id="maxComments"
          type="number"
          min={10}
          max={500}
          value={maxComments}
          onChange={(e) => setMaxComments(Number(e.target.value))}
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand sm:w-48"
        />
        <p className="text-xs text-ink-muted">예상 분석 범위: {costTier(maxComments)}</p>
      </div>

      <div className="rounded-md border border-line bg-surface-soft px-3.5 py-3 text-xs leading-relaxed text-ink-secondary">
        이 모드는 영상 1개의 댓글만 분석합니다. 대상 전체에 대한 장기 포지셔닝보다 해당 콘텐츠에서
        발생한 반응과 의도를 깊게 읽는 데 적합합니다.
      </div>

      {submitError && (
        <p className="text-sm text-danger" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !preview}
        className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? "생성 중..." : "이 영상 분석하기"}
      </button>
    </form>
  );
}
