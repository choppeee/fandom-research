import type { CanonicalInsight, ReportSection, ReportSectionKey } from "./reportSchema";
import { SECTION_LABEL } from "./reportSchema";

export const MODULE_SECTION_MAP: Record<string, ReportSectionKey> = {
  audience_perception: "audience_response",
  character_traits: "audience_response",
  platform_youtube: "audience_response",
  platform_x: "audience_response",
  cross_platform: "audience_response",
  viral_mechanics: "audience_response",
  conversion_signals: "intent",
  audience_segments: "intent",
  appeal_drivers: "perception",
  hidden_value: "perception",
  positioning_strategy: "perception",
  psychological_drivers: "diagnosis",
  relationship_dynamics: "diagnosis",
  risk_misperception: "diagnosis",
};

const STRENGTH_SCORE: Record<"HIGH" | "MEDIUM" | "LOW", number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };

function dominantVideoId(insight: CanonicalInsight): string | null {
  return insight.evidencePackage.supportingVideos[0]?.videoId ?? null;
}

/** 서로 다른 분석 모듈(청중반응/매력요인/바이럴/숨은가치 등)이 같은 영상을 핵심 근거로
 * 삼으면, 텍스트 유사도로는 다 걸러지지 않는 "같은 사건에 대한 여러 번의 설명"이 생긴다.
 * Editorial Pass(LLM)의 판단만으로는 부족해서, 같은 dominant video를 공유하는 insight를
 * 코드에서 강제로 하나로 묶는다 - 가장 근거가 강한 것만 본문에 남기고 나머지는
 * relatedFindings(짧은 헤드라인만)로 접는다. */
export function dedupeByDominantEvidence(insights: CanonicalInsight[]): CanonicalInsight[] {
  const groups = new Map<string, CanonicalInsight[]>();
  const noVideo: CanonicalInsight[] = [];
  for (const ins of insights) {
    const vid = dominantVideoId(ins);
    if (!vid) {
      noVideo.push(ins);
      continue;
    }
    const list = groups.get(vid) ?? [];
    list.push(ins);
    groups.set(vid, list);
  }

  const kept: CanonicalInsight[] = [...noVideo];
  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const s = STRENGTH_SCORE[b.evidencePackage.evidenceStrength] - STRENGTH_SCORE[a.evidencePackage.evidenceStrength];
      if (s !== 0) return s;
      return b.evidencePackage.sourceDiversity.commentCount - a.evidencePackage.sourceDiversity.commentCount;
    });
    const [primary, ...rest] = sorted;
    kept.push({ ...primary, relatedFindings: rest.map((r) => r.headline) });
  }
  return kept;
}

/** "DB에 있는가"가 아니라 "판단에 필요한가" 기준의 필터. 빈 섹션은 만들지 않고,
 * 같은 헤드라인이 여러 모듈에서 겹치면(에디토리얼 패스가 놓친 잔여 중복) 하나만 남긴다. */
export function buildSections(insights: CanonicalInsight[]): ReportSection[] {
  const byKey = new Map<ReportSectionKey, CanonicalInsight[]>();
  for (const ins of insights) {
    const key = MODULE_SECTION_MAP[ins.moduleKey];
    if (!key) continue; // 매핑 안 된 모듈(strategy/positioning 등은 별도 필드로 처리)
    const list = byKey.get(key) ?? [];
    list.push(ins);
    byKey.set(key, list);
  }

  const order: ReportSectionKey[] = ["audience_response", "intent", "perception", "diagnosis"];
  const sections: ReportSection[] = [];
  for (const key of order) {
    const list = byKey.get(key);
    if (!list || list.length === 0) continue; // 데이터 없는 섹션은 만들지 않는다
    const seenHeadlines = new Set<string>();
    const deduped = list.filter((ins) => {
      const norm = ins.headline.trim();
      if (seenHeadlines.has(norm)) return false;
      seenHeadlines.add(norm);
      return true;
    });
    sections.push({ key, title: SECTION_LABEL[key], insights: deduped });
  }
  return sections;
}

/** Evidence 섹션 - 실제 원본이 확인된(no_visual이 아닌) insight 중 근거 강도/다양성이 높은 순으로
 * 최대 N개만. 좋아요 수가 아니라 relevance(=이미 상위 섹션에서 선별된 insight라는 것 자체)와
 * evidenceStrength/sourceDiversity로 고른다. */
export function buildEvidenceSection(insights: CanonicalInsight[], limit = 4): ReportSection | null {
  const withEvidence = insights.filter((ins) => ins.evidencePackage.visualRecommendation !== "no_visual");
  if (withEvidence.length === 0) return null;
  const strengthScore = { HIGH: 2, MEDIUM: 1, LOW: 0 };
  const ranked = [...withEvidence].sort((a, b) => {
    const s = strengthScore[b.evidencePackage.evidenceStrength] - strengthScore[a.evidencePackage.evidenceStrength];
    if (s !== 0) return s;
    return b.evidencePackage.sourceDiversity.videoCount - a.evidencePackage.sourceDiversity.videoCount;
  });
  return { key: "evidence", title: SECTION_LABEL.evidence, insights: ranked.slice(0, limit) };
}
