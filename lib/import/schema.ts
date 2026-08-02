// 업로드 파일(CSV/XLSX/JSON) 컬럼을 ImportedRow 필드로 매핑하기 위한 후보 정의.
// "없는 컬럼은 생성하거나 추정하지 않는다" 원칙 - 여기서는 후보를 "제안"할 뿐이고,
// 실제 매핑은 사용자가 화면에서 확인/수정한 값을 그대로 쓴다.
export type ImportTargetField =
  | "platform"
  | "accountName"
  | "sourceUrl"
  | "contentId"
  | "contentType"
  | "contentText"
  | "commentText"
  | "replyText"
  | "publishedAt"
  | "likeCount"
  | "viewCount"
  | "saveCount"
  | "shareCount"
  | "authorId"
  | "campaign"
  | "product";

export const IMPORT_TARGET_FIELDS: { key: ImportTargetField; label: string; synonyms: string[]; numeric?: boolean }[] = [
  { key: "platform", label: "플랫폼", synonyms: ["platform", "플랫폼", "채널"] },
  { key: "accountName", label: "계정명", synonyms: ["account_name", "account", "계정", "계정명", "username", "handle"] },
  { key: "sourceUrl", label: "게시물 URL", synonyms: ["source_url", "url", "link", "링크", "게시물주소", "permalink"] },
  { key: "contentId", label: "콘텐츠 ID", synonyms: ["content_id", "post_id", "media_id", "게시물id", "콘텐츠id"] },
  { key: "contentType", label: "콘텐츠 유형", synonyms: ["content_type", "type", "유형", "게시물유형"] },
  { key: "contentText", label: "본문/캡션", synonyms: ["caption", "본문", "게시물내용", "content_text", "content", "post_text"] },
  { key: "commentText", label: "댓글", synonyms: ["comment", "댓글", "comment_text", "text", "review", "리뷰", "voc", "고객의견", "피드백", "feedback"] },
  { key: "replyText", label: "답글", synonyms: ["reply", "답글", "reply_text", "대댓글"] },
  { key: "publishedAt", label: "작성일시", synonyms: ["published_at", "date", "created_at", "작성일", "작성일시", "일시", "timestamp"] },
  { key: "likeCount", label: "좋아요 수", synonyms: ["like_count", "likes", "좋아요", "좋아요수"], numeric: true },
  { key: "viewCount", label: "조회수", synonyms: ["view_count", "views", "조회수", "재생수"], numeric: true },
  { key: "saveCount", label: "저장 수", synonyms: ["save_count", "saves", "저장수", "저장"], numeric: true },
  { key: "shareCount", label: "공유 수", synonyms: ["share_count", "shares", "공유수", "공유", "리트윗"], numeric: true },
  { key: "authorId", label: "작성자 식별자 (해시 처리됨)", synonyms: ["author_id", "author", "user_id", "작성자", "닉네임", "nickname"] },
  { key: "campaign", label: "캠페인", synonyms: ["campaign", "캠페인"] },
  { key: "product", label: "제품/상품", synonyms: ["product", "제품", "상품", "sku"] },
];

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_\-()]/g, "");
}

/** 헤더 목록을 보고 각 target field에 가장 그럴듯한 헤더를 하나씩 제안한다.
 * 확신이 없으면(매칭 없음) null - 화면에서 사용자가 직접 지정해야 한다. */
export function suggestMapping(headers: string[]): Record<ImportTargetField, string | null> {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  const result = {} as Record<ImportTargetField, string | null>;
  const used = new Set<string>();

  for (const field of IMPORT_TARGET_FIELDS) {
    const synonymsNorm = field.synonyms.map(normalize);
    const match = normalizedHeaders.find((h) => !used.has(h.raw) && synonymsNorm.includes(h.norm));
    result[field.key] = match ? match.raw : null;
    if (match) used.add(match.raw);
  }
  return result;
}
