/** IP 유형별 Metric 선택. 사용자가 제시한 예시(Brand의 Awareness/Trust/Brand Association,
 * Product의 Repurchase Signal 등)는 지금 파이프라인(YouTube 댓글 수집 + 감성/구매의향 분류)으로는
 * 실제로 계산할 수 없는 값들이라 포함하지 않는다 - 대신 실제로 계산 가능한 값만, IP 유형에
 * 맞는 라벨로 노출한다. "실제 계산되는 값만 표시" 원칙을 지표 이름보다 우선한다. */

import type { MetricItem } from "./reportSchema";
import type { Aggregates } from "../aggregate";
import type { IpTypeInfo } from "../ip-classify";
import type { EvidencePackage } from "../evidence-types";

function evidenceStrengthSummary(packages: EvidencePackage[]): MetricItem | null {
  const withEvidence = packages.filter((p) => p.visualRecommendation !== "no_visual");
  if (withEvidence.length === 0) return null;
  const counts: Record<"HIGH" | "MEDIUM" | "LOW", number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const p of withEvidence) counts[p.evidenceStrength] += 1;
  const order: ("HIGH" | "MEDIUM" | "LOW")[] = ["HIGH", "MEDIUM", "LOW"];
  const dominant = [...order].sort((a, b) => counts[b] - counts[a])[0];
  const dominantLabel: Record<"HIGH" | "MEDIUM" | "LOW", string> = { HIGH: "높음", MEDIUM: "보통", LOW: "낮음" };
  return {
    key: "evidence_strength",
    label: "근거 강도",
    value: dominantLabel[dominant],
    caption: `원본 확인된 발견 ${withEvidence.length}건 중 다수`,
    tone: dominant === "HIGH" ? "positive" : dominant === "LOW" ? "warning" : "neutral",
  };
}

export function selectMetrics(params: {
  ipType: IpTypeInfo;
  stats: Aggregates;
  videoCount: number;
  commentCount: number;
  postCount: number;
  conversionSignalCount: number; // conversion_signals 모듈이 실제로 뽑아낸 insight 수
  evidencePackages: EvidencePackage[];
}): MetricItem[] {
  const { ipType, stats, videoCount, commentCount, postCount, conversionSignalCount, evidencePackages } = params;
  const totalSignals = commentCount + postCount;
  const metrics: MetricItem[] = [];

  if (totalSignals > 0) {
    metrics.push({ key: "signals", label: "수집된 Signal", value: totalSignals.toLocaleString("ko-KR"), caption: "댓글·게시물" });
  }
  if (videoCount > 0) {
    metrics.push({ key: "contents", label: "분석한 콘텐츠", value: videoCount.toLocaleString("ko-KR"), caption: "영상" });
  }
  if (stats.sentimentRatio.positive + stats.sentimentRatio.negative + stats.sentimentRatio.neutral > 0) {
    metrics.push({
      key: "positive_response",
      label: "긍정 반응",
      value: `${stats.sentimentRatio.positive}%`,
      tone: stats.sentimentRatio.positive >= 60 ? "positive" : "neutral",
    });
  }

  // 구매의향은 브랜드/제품/서비스에서만 의미 있는 개념 - person/group/content/place에는 표시하지 않는다
  const purchaseRelevant = ["brand", "product", "service"].includes(ipType.type);
  if (purchaseRelevant && stats.purchaseIntentSummary.examples.length > 0) {
    metrics.push({
      key: "purchase_intent",
      label: "구매 의향",
      value: `${stats.purchaseIntentSummary.positiveRatio}%`,
      tone: stats.purchaseIntentSummary.positiveRatio >= 50 ? "positive" : "neutral",
    });
  }

  if (conversionSignalCount > 0) {
    metrics.push({
      key: "discovery_signals",
      label: "발견·전환 신호",
      value: `${conversionSignalCount}건`,
      caption: "무관심→관심으로 전환된 반응",
      tone: "brand",
    });
  }

  const riskCount = stats.riskGroups.reduce((sum, g) => sum + g.count, 0);
  if (riskCount > 0) {
    metrics.push({
      key: "risk_signals",
      label: "주의·위험 신호",
      value: `${riskCount}건`,
      tone: riskCount > 5 ? "danger" : "warning",
    });
  }

  const evidenceMetric = evidenceStrengthSummary(evidencePackages);
  if (evidenceMetric) metrics.push(evidenceMetric);

  return metrics.slice(0, 6);
}
