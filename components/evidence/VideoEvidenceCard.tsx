"use client";

import { useState } from "react";
import type { VideoEvidence } from "@/lib/evidence-types";
import { PlatformBadge } from "./PlatformBadge";

/** 영상 썸네일 카드. 클릭하면 그 자리에서 YouTube 임베드로 전환된다(원본 영상 확인).
 * defaultEmbedded=true면 hero_video 추천(가장 핵심 근거 영상)일 때처럼 처음부터 재생 화면을 보여준다. */
export function VideoEvidenceCard({ video, defaultEmbedded = false }: { video: VideoEvidence; defaultEmbedded?: boolean }) {
  const [embedded, setEmbedded] = useState(defaultEmbedded);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-video w-full bg-black">
        {embedded ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${video.videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setEmbedded(true)}
            className="group relative block h-full w-full"
            aria-label="영상 재생"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/35">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-red-600 shadow">
                ▶
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <PlatformBadge platform={video.platform} />
        </div>
        <p className="text-sm font-medium leading-snug">{video.title || "제목 없음"}</p>
        <p className="text-xs text-muted-foreground">
          {video.channelTitle}
          {video.publishedAt && ` · ${video.publishedAt.slice(0, 10)}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1 text-[11px] text-muted-foreground">
          <span>이 근거로 쓰인 댓글 {video.commentCount}건</span>
          <a href={video.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            YouTube 원본 열기
          </a>
        </div>
      </div>
    </div>
  );
}
