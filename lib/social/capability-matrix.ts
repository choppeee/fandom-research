import type { SourceCapabilities, SourceType } from "./types";

/** 소스 타입별 "원래 뭘 기대할 수 있는가" 정적 선언. UI(어떤 CTA를 보여줄지)와
 * Coverage Audit(뭘 못 받았는지 설명)이 공통으로 참조하는 단일 소스. */
export const CAPABILITY_MATRIX: Record<SourceType, SourceCapabilities> = {
  youtube_video: {
    metadata: "available",
    comments: "available",
    metrics: "available",
    insights: "unavailable",
    ownerAuthRequired: false,
    notes: "공식 YouTube Data API v3, 소유 여부와 무관하게 공개 데이터 수집 가능",
  },
  youtube_channel: {
    metadata: "available",
    comments: "available",
    metrics: "available",
    insights: "unavailable",
    ownerAuthRequired: false,
    notes: "최근 업로드 영상 목록 + 각 영상 댓글, 공식 API",
  },
  instagram_post: {
    metadata: "permission_dependent",
    comments: "permission_dependent",
    metrics: "permission_dependent",
    insights: "permission_dependent",
    ownerAuthRequired: true,
    notes: "연결된 관리 계정 소유 게시물만 댓글/지표 수집 가능. 제3자 공개 게시물은 URL 인식까지만.",
  },
  instagram_reel: {
    metadata: "permission_dependent",
    comments: "permission_dependent",
    metrics: "permission_dependent",
    insights: "permission_dependent",
    ownerAuthRequired: true,
    notes: "연결된 관리 계정 소유 릴스만 댓글/지표 수집 가능. 제3자 공개 릴스는 URL 인식까지만.",
  },
  instagram_profile: {
    metadata: "permission_dependent",
    comments: "permission_dependent",
    metrics: "permission_dependent",
    insights: "permission_dependent",
    ownerAuthRequired: true,
    notes: "연결된 관리 계정만 계정 전체(Account Intelligence) 분석 가능",
  },
  imported_dataset: {
    metadata: "limited",
    comments: "limited",
    metrics: "limited",
    insights: "unavailable",
    ownerAuthRequired: false,
    notes: "사용자가 업로드한 파일에 실제로 있는 컬럼까지만 - 없는 값은 추정하지 않음",
  },
  voc_dataset: {
    metadata: "limited",
    comments: "limited",
    metrics: "unavailable",
    insights: "unavailable",
    ownerAuthRequired: false,
    notes: "VOC/CS 텍스트 업로드 - 지표 없이 텍스트 반응 위주",
  },
  review_dataset: {
    metadata: "limited",
    comments: "limited",
    metrics: "limited",
    insights: "unavailable",
    ownerAuthRequired: false,
    notes: "리뷰 업로드 - 평점 등 파일에 있는 값까지만",
  },
};

export function capabilitiesFor(sourceType: SourceType): SourceCapabilities {
  return CAPABILITY_MATRIX[sourceType];
}
