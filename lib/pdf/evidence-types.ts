import type { VideoEvidence, EvidencePackage } from "../evidence-types";

/** 웹의 EvidencePackage와 같은 구조에, PDF 렌더 시점에 미리 fetch해둔 base64 썸네일/QR을 붙인 것.
 * pages.ts는 항상 동기 함수이므로, 네트워크 fetch가 필요한 값은 여기서 미리 다 채워서 넘긴다. */
export type PdfVideoEvidence = VideoEvidence & { thumbnailDataUri: string | null };

export type PdfEvidencePackage = Omit<EvidencePackage, "supportingVideos"> & {
  supportingVideos: PdfVideoEvidence[];
  qrDataUri: string | null; // 대표 링크(영상 URL) QR - 없으면 null
  qrTargetLabel: string; // QR 옆에 표시할 "무엇으로 연결되는지" 텍스트
};
