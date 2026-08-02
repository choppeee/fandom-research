export type Platform = "youtube" | "x" | "web";

/** 플랫폼 무관 공통 포스트 형태 (댓글/트윗 등). 크로스플랫폼 분석은 이 형태를 기준으로 한다. */
export type NormalizedPost = {
  platform: Platform;
  externalId: string;
  url?: string | null;
  author?: string | null;
  // 원본 작성자 식별자가 아니라 job 범위 익명 키(lib/author-key.ts). 같은 job 안에서만
  // 같은 작성자가 같은 값을 가지며, 다른 job으로는 추적할 수 없다.
  authorKey?: string | null;
  text: string;
  createdAt: string | null;
  likeCount: number;
  shareCount?: number;
  replyCount?: number;
  quoteCount?: number;
  language?: string | null;
  hashtags?: string[];
  mentions?: string[];
  referencedPostId?: string | null;
  searchQuery?: string | null;
  videoId?: string | null;
};

export type NormalizedVideo = {
  videoId: string;
  channelId: string | null;
  channelTitle: string | null;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

export type CollectParams = {
  jobId: string; // 작성자 익명 키(HMAC) 생성 범위 - 이 job 안에서만 유효한 authorKey를 만드는 데 쓰인다.
  keyword: string;
  periodStart: string;
  periodEnd: string;
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  maxPosts?: number;
};

export type CollectResult = {
  configured: boolean;
  note?: string;
  posts: NormalizedPost[];
  videos?: NormalizedVideo[];
};

/**
 * 플랫폼별 데이터 수집기가 구현해야 하는 공통 인터페이스.
 * 새 플랫폼(예: 웹 커뮤니티, 뉴스)을 추가할 때 이 인터페이스만 구현하면
 * 태스크 큐/분석 파이프라인 쪽 코드는 건드릴 필요가 없다.
 */
export interface PlatformCollector {
  platform: Platform;
  /** API 키 등 필요한 설정이 되어 있는지. false면 collect()는 빈 결과를 반환해야 한다. */
  isConfigured(): boolean;
  collect(params: CollectParams): Promise<CollectResult>;
}
