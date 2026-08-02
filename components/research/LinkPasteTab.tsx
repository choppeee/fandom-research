"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResolvedSource, SourceResolveError } from "@/lib/social/types";

const DEFAULT_MAX_ITEMS = 100;

function isInstagram(sourceType: string): boolean {
  return sourceType.startsWith("instagram_");
}

export function LinkPasteTab() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ResolvedSource | null>(null);
  const [previewError, setPreviewError] = useState<SourceResolveError | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [maxItems, setMaxItems] = useState(DEFAULT_MAX_ITEMS);
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
        if (data.ok) setPreview(data.source);
        else setPreviewError(data.error);
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
      setSubmitError("먼저 유효한 링크를 입력해주세요.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/jobs/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), maxItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(typeof data.error === "string" ? data.error : data.error?.message ?? "Job 생성에 실패했습니다.");
        setPending(false);
        return;
      }
      router.push(`/jobs/${data.jobId}`);
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="instantUrl" className="text-sm font-medium text-ink">
          분석할 링크
        </label>
        <input
          id="instantUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube 영상/채널, Instagram 게시물/릴스/프로필 링크"
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-ink-muted">
          YouTube 영상·채널, Instagram 게시물·릴스·프로필 링크를 붙여넣으면 플랫폼을 자동으로 인식합니다.
        </p>
      </div>

      {previewing && <p className="text-sm text-ink-muted">링크 정보를 확인하는 중...</p>}

      {previewError && (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {previewError.message}
        </p>
      )}

      {preview && isInstagram(preview.sourceType) && (
        <InstagramPreviewCard preview={preview} />
      )}

      {preview && !isInstagram(preview.sourceType) && preview.sourceType.startsWith("youtube") && (
        <YoutubePreviewCard preview={preview} />
      )}

      {preview && (
        <div className="space-y-1.5">
          <label htmlFor="maxItems" className="text-sm font-medium text-ink">
            {preview.sourceType.endsWith("channel") || preview.sourceType.endsWith("profile") ? "전체 반응 수 상한" : "댓글 수 상한"}
          </label>
          <input
            id="maxItems"
            type="number"
            min={10}
            max={500}
            value={maxItems}
            onChange={(e) => setMaxItems(Number(e.target.value))}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand sm:w-48"
          />
        </div>
      )}

      {submitError && (
        <p className="text-sm text-danger" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !preview || (isInstagram(preview?.sourceType ?? "") && preview?.connectionStatus === "not_connected")}
        className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? "생성 중..." : "이 콘텐츠 분석하기"}
      </button>
    </form>
  );
}

function YoutubePreviewCard({ preview }: { preview: ResolvedSource }) {
  const meta = preview.metadata as Record<string, unknown>;
  if (preview.sourceType === "youtube_channel") {
    return (
      <div className="rounded-lg border border-line bg-surface-soft p-3 text-sm">
        <p className="font-medium text-ink">{String(meta.title ?? "채널")}</p>
        <p className="mt-1 text-xs text-ink-muted">
          구독자 {Number(meta.subscriberCount ?? 0).toLocaleString("ko-KR")}명 · 영상 {Number(meta.videoCount ?? 0).toLocaleString("ko-KR")}개
        </p>
        <p className="mt-1 text-xs text-ink-muted">최근 영상들을 모아 채널 단위 반응(Account Intelligence)을 분석합니다.</p>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-surface-soft p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={String(meta.thumbnailUrl ?? "")} alt="" className="h-20 w-32 flex-shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium text-ink">{String(meta.title ?? "제목 없음")}</p>
        <p className="text-xs text-ink-secondary">{String(meta.channelTitle ?? "")}</p>
        <p className="mt-1 text-xs text-ink-muted">
          조회수 {Number(meta.viewCount ?? 0).toLocaleString("ko-KR")} · 댓글 {Number(meta.commentCount ?? 0).toLocaleString("ko-KR")}건
        </p>
      </div>
    </div>
  );
}

// Instagram은 URL만으로 소유 여부를 알 수 없어 4가지 상태를 명시적으로 갈라 보여준다 -
// "미지원" 한 줄로 끝내지 않는다는 것이 이 화면의 핵심 요구사항이다.
function InstagramPreviewCard({ preview }: { preview: ResolvedSource }) {
  const isProfile = preview.sourceType === "instagram_profile";

  if (preview.connectionStatus === "connected") {
    return (
      <div className="rounded-lg border border-brand/30 bg-brand-soft p-3 text-sm">
        <p className="font-medium text-ink">연결된 관리 계정의 콘텐츠로 확인됩니다</p>
        <p className="mt-1 text-xs text-ink-secondary">
          {isProfile
            ? "최근 게시물들을 모아 계정 단위 반응(Account Intelligence)을 분석합니다."
            : "이 게시물/릴스의 댓글을 Instagram 공식 API로 수집해 분석합니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm">
      <p className="font-medium text-ink">연결된 관리 계정을 찾지 못했습니다</p>
      <p className="text-xs text-ink-secondary">
        Instagram은 계정 소유자가 공식으로 연결한 콘텐츠만 댓글까지 분석할 수 있습니다. 이 게시물이 직접 관리하는 계정의
        콘텐츠라면 계정을 연결해주세요. 제3자 공개 게시물이라면 기본 정보 확인까지만 가능하며, 댓글은 공식 API로 가져올 수
        없습니다(Instagram 정책).
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href="/api/connections/instagram/start"
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
        >
          관리 계정 연결하기
        </a>
        <span className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-secondary">
          댓글 데이터가 있다면 &ldquo;데이터 업로드&rdquo; 탭을 이용하세요
        </span>
      </div>
    </div>
  );
}
