/** Insight <-> 원본 증거(영상/댓글) 연결 타입.
 * 여기서 만드는 모든 값은 실제 DB에 존재하는 comment_id/video_id를 통해서만 구성된다 -
 * LLM이 evidence_ids로 지목하지 않았거나 DB에 없는 값은 절대 채워지지 않는다(억지 시각자료 금지). */

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export function youtubeThumbnailUrl(videoId: string): string {
  // maxresdefault는 없는 영상이 많아, 항상 존재하는 hqdefault를 기본값으로 쓴다.
  // (렌더 시점에 fetch 실패하면 lib/pdf/thumbnail-cache.ts가 mqdefault까지 추가로 내려간다)
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string, timestampSeconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return timestampSeconds && timestampSeconds > 0 ? `${base}&t=${Math.floor(timestampSeconds)}s` : base;
}

export function youtubeCommentUrl(videoId: string, commentId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`;
}

export type CommentEvidence = {
  platform: "youtube" | "x";
  commentId: string;
  text: string;
  likeCount: number;
  publishedAt: string | null;
  videoId: string | null;
  videoTitle: string | null;
  url: string | null; // 원문으로 바로 이동하는 링크 (구할 수 있을 때만)
};

export type VideoEvidence = {
  platform: "youtube";
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  publishedAt: string | null;
  thumbnailUrl: string;
  commentCount: number; // 이 insight 근거 중 이 영상에서 나온 댓글 수
  totalLikes: number;
  representativeComments: CommentEvidence[]; // 이 영상에서 나온 대표 댓글 (좋아요 상위, 최대 3개)
};

export type VisualRecommendation =
  | "hero_video" // 영상 1개가 핵심 근거 - 임베드/카드를 크게
  | "comment_collage" // 여러 댓글이 같은 표현을 반복 - 콜라주로
  | "quote_card" // 댓글 1~2개만 - 인용 카드 하나로 충분
  | "no_visual"; // 근거가 통계/요약뿐이라 실제 원본이 없음 - 텍스트만

export type EvidencePackage = {
  insightId: string;
  headline: string;
  supportingVideos: VideoEvidence[];
  supportingComments: CommentEvidence[]; // dedup된 전체 댓글 근거 (콜라주/카드 렌더링용)
  engagementSummary: string; // 예: "댓글 4건 · 좋아요 합계 1,230"
  repetitionSummary: string; // 예: "3개 영상에서 반복 확인"
  sourceDiversity: { videoCount: number; platformCount: number; commentCount: number };
  evidenceStrength: Confidence;
  visualRecommendation: VisualRecommendation;
};
