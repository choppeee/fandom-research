import type { PossibleBottleneck } from "@/lib/insight-types";

const BOTTLENECK_KO: Record<string, string> = {
  Awareness: "인지 부족",
  Discovery: "발견 경로 부족",
  Understanding: "이해 어려움",
  Access: "접근/이용 불편",
  Trust: "신뢰 부족",
  Conversion: "행동 전환 약함",
  Retention: "재방문 유인 부족",
  Advocacy: "공유/추천 소재 부족",
  ProductQuality: "결과물 품질",
  Positioning: "포지셔닝 불명확",
  Continuity: "후속 접점 부족",
};

/** possible_bottleneck은 4조건(반복 확인/대상 식별/대안보다 설득력/실행 가능)을 충족했을 때만
 * 채워지는 필드다 - 여기 있는 건 이미 정당화된 것만 남은 것이라 그대로 보여준다. */
export function BottleneckBlock({ bottleneck }: { bottleneck: PossibleBottleneck }) {
  return (
    <div className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-ink">
      <span className="font-semibold text-warn">병목 후보 · {BOTTLENECK_KO[bottleneck.type] ?? bottleneck.type}</span>
      <span className="ml-1.5 text-ink-secondary">{bottleneck.evidence}</span>
    </div>
  );
}
