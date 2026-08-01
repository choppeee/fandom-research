"use client";

import type { CommentEvidence } from "@/lib/evidence-types";
import { PlatformBadge } from "./PlatformBadge";

/** Evidence ID를 클릭했을 때 원문 전체와 같은 근거 묶음 안의 다른 반응을 보여주는 패널.
 * insightHeadline: 이 근거가 어떤 Insight에 쓰였는지. related: 같은 EvidencePackage의 나머지 댓글. */
export function EvidenceDrawer({
  comment,
  insightHeadline,
  related,
  onClose,
}: {
  comment: CommentEvidence | null;
  insightHeadline: string;
  related: CommentEvidence[];
  onClose: () => void;
}) {
  if (!comment) return null;
  const others = related.filter((r) => r.commentId !== comment.commentId).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm overflow-y-auto bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Evidence 원문</span>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            닫기 ✕
          </button>
        </div>

        <div className="mb-1.5 flex items-center gap-1.5">
          <PlatformBadge platform={comment.platform} />
        </div>
        <p className="text-sm leading-relaxed">&ldquo;{comment.text}&rdquo;</p>

        <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <dt>좋아요</dt>
            <dd>{comment.likeCount.toLocaleString("ko-KR")}</dd>
          </div>
          {comment.publishedAt && (
            <div className="flex justify-between">
              <dt>작성일</dt>
              <dd>{comment.publishedAt.slice(0, 10)}</dd>
            </div>
          )}
          {comment.videoTitle && (
            <div className="flex justify-between gap-3">
              <dt>관련 영상</dt>
              <dd className="text-right">{comment.videoTitle}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Evidence ID</dt>
            <dd>{comment.commentId}</dd>
          </div>
          <div className="flex justify-between">
            <dt>사용된 Insight</dt>
            <dd className="text-right">{insightHeadline}</dd>
          </div>
        </dl>

        {comment.url && (
          <a
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-md border border-border px-3 py-1.5 text-xs underline underline-offset-2"
          >
            원문 페이지 열기
          </a>
        )}

        {others.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-muted-foreground">같은 패턴의 다른 반응</p>
            <ul className="space-y-2">
              {others.map((o) => (
                <li key={o.commentId} className="rounded-md bg-muted p-2 text-xs">
                  &ldquo;{o.text}&rdquo;
                  <span className="ml-1 text-muted-foreground">· 좋아요 {o.likeCount.toLocaleString("ko-KR")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
