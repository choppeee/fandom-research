import type { CommentEvidence, EvidencePackage } from "@/lib/evidence-types";

/** 하나의 Insight가 여러 댓글에서 반복될 때, 시청자 언어를 있는 그대로 모아 보여준다.
 * 분석가가 만든 별명이 아니라 실제 표현에서 나온 것임을 확인시키는 용도 - 최대 6개만 노출. */
export function CommentCollage({
  pkg,
  onSelectEvidence,
}: {
  pkg: EvidencePackage;
  onSelectEvidence?: (comment: CommentEvidence) => void;
}) {
  const quotes = pkg.supportingComments.slice(0, 6);
  if (quotes.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">사람들이 붙인 표현</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {quotes.map((q) => (
          <blockquote
            key={q.commentId}
            className={`rounded-md bg-background px-3 py-2 text-sm shadow-sm ${onSelectEvidence ? "cursor-pointer hover:ring-1 hover:ring-primary/40" : ""}`}
            onClick={onSelectEvidence ? () => onSelectEvidence(q) : undefined}
          >
            &ldquo;{q.text}&rdquo;
            <footer className="mt-1 text-[11px] text-muted-foreground">좋아요 {q.likeCount.toLocaleString("ko-KR")}</footer>
          </blockquote>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        댓글 {pkg.sourceDiversity.commentCount}건
        {pkg.sourceDiversity.videoCount > 0 && ` · 영상 ${pkg.sourceDiversity.videoCount}개`}
        {pkg.engagementSummary && ` · ${pkg.engagementSummary}`}
      </p>
    </div>
  );
}
