/** Social Intelligence 공통 타입 - 플랫폼(YouTube/Instagram/Import)이 늘어나도 이 파일의
 * 계약만 지키면 pipeline/coverage/report 쪽 코드는 건드릴 필요가 없도록 하는 게 목적이다.
 * lib/sources/*(기존 단일 영상 미리보기용 SourceResolver)는 이 파일의 SourceAdapter로
 * 흡수되고, lib/sources는 legacy 호환을 위해 당분간 남겨둔다. */

/** 열린 문자열 union - 새 플랫폼을 추가할 때 여기 리터럴만 늘리면 된다(switch문을
 * 여기저기 늘리지 않는다 - 실제 분기는 lib/social/registry.ts의 레지스트리 lookup 하나뿐). */
export type SourceType =
  | "youtube_video"
  | "youtube_channel"
  | "instagram_post"
  | "instagram_reel"
  | "instagram_profile"
  | "imported_dataset"
  | "voc_dataset"
  | "review_dataset";

/** 이 데이터를 실제로 어디서 확보했는지 - 같은 "댓글"이라도 공식 API로 받은 것과
 * 사용자가 업로드한 것을 리포트에서 절대 같은 출처인 것처럼 섞지 않기 위한 필드. */
export type DataOrigin = "official_api" | "connected_account" | "public_snapshot" | "user_upload" | "manual_entry";

export type CapabilityLevel = "available" | "unavailable" | "permission_dependent" | "limited";

/** "이 소스 타입에서 원래 뭘 기대할 수 있는가"의 정적 선언 - lib/social/capability-matrix.ts에서
 * 소스 타입별로 하나씩 정의하고, UI/Coverage Audit이 공통으로 이걸 읽는다. 실제 승인된
 * permission에 따라 달라지는 항목(예: Instagram insights)은 "permission_dependent"로 두고,
 * 실제 값은 각 job의 sources.availability(런타임 결과)에서 확정한다 - capability matrix
 * 자체를 "이 job에서 실제로 뭘 받았는지"의 기록으로 쓰지 않는다(그건 availability의 역할). */
export type SourceCapabilities = {
  metadata: CapabilityLevel;
  comments: CapabilityLevel;
  metrics: CapabilityLevel;
  insights: CapabilityLevel;
  ownerAuthRequired: boolean;
  notes?: string;
};

export type NormalizedContent = {
  externalContentId: string | null;
  contentType: string; // "video" | "post" | "reel" | "imported_row"
  title: string | null;
  text: string | null; // 설명/캡션
  publishedAt: string | null;
  metrics: Record<string, number | null>; // 플랫폼 고유 지표 그대로 (viewCount/saveCount 등 섞지 않음)
  nativeMetadata?: Record<string, unknown>;
};

export type NormalizedReaction = {
  externalContentId: string | null; // 어느 content에 속하는지
  reactionType: string; // "comment" | "reply"
  text: string;
  parentReactionExternalId?: string | null;
  publishedAt: string | null;
  engagement: Record<string, number | null>;
  // 이미 lib/author-key.ts의 computeAuthorKey(jobId, 원본식별자)로 해시된 값이어야 한다 -
  // 어댑터가 원본 작성자 식별자를 이 필드에 그대로 담아 반환하면 안 된다(개인정보 최소화
  // 원칙, 전 플랫폼 공통). 원본 식별자가 아예 없으면 null.
  authorKey: string | null;
  nativeMetadata?: Record<string, unknown>;
};

export type CollectionResult = {
  contents: NormalizedContent[];
  reactions: NormalizedReaction[];
  unavailableFields: string[]; // 이번에 못 받은 필드 (예: ["views", "saves"])
  limitationReasons: string[]; // 왜 못 받았는지 (예: ["Instagram 공식 API 정책상 비연결 계정은 댓글 조회 불가"])
  dataOrigin: DataOrigin;
};

export type ResolvedSource = {
  sourceType: SourceType;
  platform: string;
  sourceId: string;
  sourceUrl: string;
  metadata: Record<string, unknown>;
  capabilities: SourceCapabilities;
  dataOrigin: DataOrigin;
  // Instagram의 "제3자 공개 콘텐츠라 연결이 필요함" 같은 상태를 UI가 바로 분기할 수 있게.
  connectionStatus: "connected" | "not_connected" | "not_applicable";
};

export type SourceResolveError = {
  code: "invalid_url" | "not_found" | "private" | "comments_disabled" | "api_error" | "requires_connection" | "not_supported_yet";
  message: string;
};

/** 새 플랫폼을 추가하려면 이 인터페이스 하나만 구현하면 된다 - UI/파이프라인/Coverage는
 * 전부 이 계약을 통해서만 플랫폼과 상호작용한다. */
export interface SourceAdapter {
  sourceType: SourceType;
  platform: string;
  matches(url: string): boolean;
  resolve(
    url: string,
    ctx: { userId: string }
  ): Promise<{ ok: true; source: ResolvedSource } | { ok: false; error: SourceResolveError }>;
  capabilities(): SourceCapabilities;
  /** sourceId가 가리키는 실제 데이터를 수집한다. userId는 connected-account 조회에,
   * jobId는 작성자 익명 키(computeAuthorKey) 스코프에 쓰인다 - 반드시 실제 job.id를
   * 넘겨야 같은 job 안에서 작성자 재현성이 보장된다(다른 값을 넘기면 안전하지만 의미 없는
   * 스코프가 생긴다). */
  collect(params: {
    sourceId: string;
    userId: string;
    jobId: string;
    maxItems: number;
    sourceMetadata?: Record<string, unknown>;
  }): Promise<CollectionResult>;
}
