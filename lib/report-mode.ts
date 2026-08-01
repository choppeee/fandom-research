/** 데이터 양/다양성에 따라 리포트가 스스로 커지거나 작아지도록 하는 결정론적(비-LLM) 판별.
 * 표본이 작을수록 강한 포지셔닝/전략 단정을 금지하고, 리포트 구조 자체를 축소한다. */

export type ReportMode = "exploratory" | "standard" | "deep";

export type ReportModeInput = {
  commentCount: number;
  postCount: number;
  videoCount: number;
  platformCount: number; // 1 = YouTube만, 2 = YouTube+X
};

export function computeReportMode(input: ReportModeInput): ReportMode {
  const totalItems = input.commentCount + input.postCount;
  const contentUnits = input.videoCount + (input.postCount > 0 ? Math.min(input.postCount, 10) : 0);

  if (totalItems >= 150 && input.videoCount >= 8 && input.platformCount >= 2) {
    return "deep";
  }
  if (totalItems < 30 || input.videoCount < 3 || contentUnits < 4) {
    return "exploratory";
  }
  return "standard";
}

export const REPORT_MODE_LABEL: Record<ReportMode, string> = {
  exploratory: "탐색적 표본 (Exploratory)",
  standard: "표준 표본 (Standard)",
  deep: "심층 표본 (Deep)",
};

export const REPORT_MODE_GUIDE: Record<ReportMode, string> = {
  exploratory: `표본이 매우 작거나 특정 콘텐츠에 편중되어 있다. 확정적인 IP 진단이나 장기 포지셔닝 제안을 하지 않는다.
"현재 표본에서 발견된 반응 후보"로만 표현하고, 전략보다 "다음에 무엇을 더 확인해야 하는가"라는 질문 중심으로 짧게 쓴다.
Positioning/Opportunity Matrix 같은 강한 확정형 분석은 근거가 부족하면 생략한다.`,
  standard: `여러 콘텐츠에서 반복되는 패턴을 확인할 수 있는 수준이다. 현재 인식과 기회를 제안할 수 있지만,
실행했을 때의 효과는 아직 검증되지 않은 별도의 가설로 명확히 구분해서 쓴다.`,
  deep: `데이터가 충분하고 여러 시점/콘텐츠/플랫폼을 포함한다. 세그먼트, 교차 플랫폼 비교, 포지셔닝까지
비교적 확신을 갖고 다룰 수 있다. 다만 여전히 근거 없는 확대해석은 금지한다.`,
};
