/** 단일 콘텐츠(링크 하나) 분석을 위한 Source Adapter 공통 형태.
 * 지금은 YouTube만 구현하지만, 향후 X/Instagram/TikTok/뉴스 등을 추가할 때
 * 이 인터페이스만 구현하면 폼/파이프라인 쪽 코드는 건드리지 않아도 되게 한다. */

export type SourceType = "youtube_video";

export type ResolvedSource = {
  sourceType: SourceType;
  sourceId: string; // 예: YouTube videoId
  sourceUrl: string; // 정규화된 원본 URL
  metadata: {
    title: string | null;
    channelTitle: string | null;
    publishedAt: string | null;
    thumbnailUrl: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
};

export type SourceResolveError = {
  code: "invalid_url" | "not_found" | "private" | "comments_disabled" | "api_error";
  message: string;
};

export interface SourceResolver {
  sourceType: SourceType;
  /** 이 리졸버가 처리할 수 있는 URL인지 (플랫폼 판별용). */
  matches(url: string): boolean;
  /** URL을 검증하고 미리보기에 필요한 메타데이터까지 가져온다. */
  resolve(url: string): Promise<{ ok: true; source: ResolvedSource } | { ok: false; error: SourceResolveError }>;
}
