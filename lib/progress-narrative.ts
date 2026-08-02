/** 진행 화면(Situation Room)의 5단계 프레이밍 - 실제 파이프라인 14개 phase를
 * "Evidence → Observation → Pattern → Interpretation → Decision"이라는 사람이 이해하기 쉬운
 * 5단계로 압축한다. 각 phase가 정확히 무엇을 하는지는 lib/pipeline.ts의 PHASE_ORDER 참고. */

export type NarrativeStage = "evidence" | "observation" | "pattern" | "interpretation" | "decision";

export const STAGE_ORDER: NarrativeStage[] = ["evidence", "observation", "pattern", "interpretation", "decision"];

export const STAGE_LABEL: Record<NarrativeStage, { en: string; ko: string }> = {
  evidence: { en: "Evidence", ko: "수집" },
  observation: { en: "Observation", ko: "관찰" },
  pattern: { en: "Pattern", ko: "연결" },
  interpretation: { en: "Interpretation", ko: "해석" },
  decision: { en: "Decision", ko: "정리" },
};

const PHASE_TO_STAGE: Record<string, NarrativeStage> = {
  pending: "evidence",
  collect: "evidence",
  classify: "evidence",
  aggregate: "observation",
  context: "observation",
  modules: "pattern",
  platform: "pattern",
  cross: "pattern",
  positioning: "interpretation",
  strategy_actions: "interpretation",
  editorial: "interpretation",
  coverage: "interpretation",
  reference: "interpretation",
  executive_summary: "decision",
  visual_data: "decision",
  assemble: "decision",
};

export function stageForPhase(phase: string): NarrativeStage {
  return PHASE_TO_STAGE[phase] ?? "evidence";
}

/** 화면 왼쪽 하단에 뜨는 "AI가 지금 고민하는 질문" - phase가 바뀔 때마다 갱신된다. */
const QUESTIONS_BY_STAGE: Record<NarrativeStage, string[]> = {
  evidence: ["어떤 영상과 댓글을 봐야 이 질문에 답할 수 있을까?", "지금 모으는 반응이 대표성이 있을까?"],
  observation: ["이 대상은 지금 어떤 상태에 있을까?", "겉으로 보이는 숫자 뒤에 무엇이 있을까?"],
  pattern: ["사람들이 가장 강하게 반응한 순간은 언제일까?", "반복적으로 등장하는 표현이 있을까?"],
  interpretation: ["이 반응이 어디까지 넓게 반복되고, 어디서부터는 특정 콘텐츠에 한정될까?", "겉으로 한 말과 실제로 원하는 것이 다를까?"],
  decision: ["지금 무엇을 유지하고, 무엇을 테스트해야 할까?", "이 결론을 어디까지 확대해도 안전할까?"],
};

export function questionForStage(stage: NarrativeStage): string {
  const pool = QUESTIONS_BY_STAGE[stage];
  return pool[Math.floor(Date.now() / 4000) % pool.length];
}

/** 화면 하단 Live Insight Feed - 몇 초마다 한 줄씩 바뀐다. 실제 LLM 중간 출력을 노출하는 게
 * 아니라(비용/지연 문제), 지금 어떤 phase에 있는지에 맞는 예시 문장을 순환시킨다 - 사실이
 * 아닌 구체적 수치나 인용은 넣지 않는다(과장 금지). */
const FEED_BY_STAGE: Record<NarrativeStage, string[]> = {
  evidence: ["영상과 댓글을 모으고 있어요.", "기간 안의 콘텐츠를 확인하고 있어요.", "댓글을 1차로 분류하고 있어요."],
  observation: ["전체적인 반응 분포를 살펴보고 있어요.", "지금 어떤 상태인지 진단하고 있어요."],
  pattern: ["반복되는 반응을 묶어 패턴으로 만들고 있어요.", "예상 밖의 반응이 있는지 찾고 있어요.", "플랫폼별로 다른 반응을 비교하고 있어요."],
  interpretation: ["이 패턴이 얼마나 넓게 반복되는지 다시 확인하고 있어요.", "표면적인 말과 실제 의도를 구분하고 있어요.", "대체 가설도 함께 검토하고 있어요."],
  decision: ["무엇을 유지하고 무엇을 테스트할지 정리하고 있어요.", "핵심 발견 순서를 정하고 있어요.", "리포트를 조립하고 있어요."],
};

export function feedLineForStage(stage: NarrativeStage, tick: number): string {
  const pool = FEED_BY_STAGE[stage];
  return pool[tick % pool.length];
}

/** 진행률에 따라 회의실이 완성되는 정도 - 0~100 사이 구간을 룸 요소 등장 시점에 매핑. */
export type RoomMilestone = "whiteboard" | "materials" | "projector" | "table" | "lightsOn";

export function roomMilestonesReached(progress: number): Set<RoomMilestone> {
  const reached = new Set<RoomMilestone>();
  if (progress >= 20) reached.add("whiteboard");
  if (progress >= 40) reached.add("materials");
  if (progress >= 60) reached.add("projector");
  if (progress >= 80) reached.add("table");
  if (progress >= 100) reached.add("lightsOn");
  return reached;
}
