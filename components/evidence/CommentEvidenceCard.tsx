import type { CommentEvidence } from "@/lib/evidence-types";
import { PlatformBadge } from "./PlatformBadge";

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CommentEvidenceCard({
  comment,
  tag,
  onSelectEvidence,
}: {
  comment: CommentEvidence;
  tag?: string;
  onSelectEvidence?: (comment: CommentEvidence) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <PlatformBadge platform={comment.platform} />
        {tag && (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {tag}
          </span>
        )}
      </div>
      <p className="leading-relaxed">&ldquo;{comment.text}&rdquo;</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>좋아요 {comment.likeCount.toLocaleString("ko-KR")}</span>
        {comment.publishedAt && <span>{relativeDate(comment.publishedAt)}</span>}
        {comment.videoTitle && <span className="truncate max-w-[220px]">관련 영상: {comment.videoTitle}</span>}
        {onSelectEvidence ? (
          <button
            type="button"
            onClick={() => onSelectEvidence(comment)}
            className="text-muted-foreground/70 underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Evidence ID: {comment.commentId}
          </button>
        ) : (
          <span className="text-muted-foreground/70">Evidence ID: {comment.commentId}</span>
        )}
        {comment.url && (
          <a href={comment.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            원문 보기
          </a>
        )}
      </div>
    </div>
  );
}
