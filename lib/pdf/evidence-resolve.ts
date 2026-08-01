import { buildEvidencePackage, type EvidenceSource } from "../evidence-resolve";
import { parseStoredModuleContent } from "../insight-types";
import { youtubeWatchUrl } from "../evidence-types";
import { resolveYoutubeThumbnail } from "./thumbnail-cache";
import { qrDataUri } from "./qrcode";
import type { PdfEvidencePackage, PdfVideoEvidence } from "./evidence-types";

/** 각 모듈의 primary insight(insights[0])에 대해서만 Evidence Package를 만든다 - PDF는 페이지 수 제약이
 * 커서, 웹처럼 모든 insight가 아니라 그 모듈의 핵심 발견 하나에만 시각자료를 붙인다(§11 스코어 원칙:
 * 가장 관련성 높은 근거만 본문에, 나머지는 만들지 않는다). 실패한 fetch는 null로 남기고 절대 리포트
 * 생성 자체를 막지 않는다. */
export async function buildPdfEvidenceMap(
  modules: { module_key: string; content_md: string }[],
  source: EvidenceSource
): Promise<Record<string, PdfEvidencePackage>> {
  const thumbCache = new Map<string, string | null>();
  const result: Record<string, PdfEvidencePackage> = {};

  for (const mod of modules) {
    const parsed = parseStoredModuleContent(mod.content_md ?? "");
    if (!parsed || parsed.kind !== "insights" || !parsed.data.applicable) continue;
    const primary = parsed.data.insights[0];
    if (!primary) continue;

    const pkg = buildEvidencePackage({
      insightId: `${mod.module_key}-0`,
      headline: primary.headline,
      evidenceIds: primary.evidenceIds,
      confidence: primary.confidence,
      source,
    });
    if (pkg.visualRecommendation === "no_visual") continue;

    const supportingVideos: PdfVideoEvidence[] = await Promise.all(
      pkg.supportingVideos.slice(0, 3).map(async (v) => ({
        ...v,
        thumbnailDataUri: await resolveYoutubeThumbnail(v.videoId, thumbCache),
      }))
    );

    const heroUrl = supportingVideos[0] ? youtubeWatchUrl(supportingVideos[0].videoId) : null;
    const qr = heroUrl ? await qrDataUri(heroUrl) : null;

    result[`${mod.module_key}-0`] = {
      ...pkg,
      supportingVideos,
      qrDataUri: qr,
      qrTargetLabel: heroUrl ? "YouTube 원본 보기" : "",
    };
  }

  return result;
}
