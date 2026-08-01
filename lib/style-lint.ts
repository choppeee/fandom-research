/** AI 보고서 특유의 상투어를 정규식으로 검사하는 가벼운 lint. LLM 호출 없이 서버 로그로만 남겨
 * editorial 단계 품질을 모니터링한다(자동 재작성을 트리거하지는 않음 - 그건 비용/지연이 크다). */

const BANNED_PHRASES = [
  "분석 결과",
  "현재 데이터는",
  "해당 IP는",
  "~로 나타났다",
  "로 나타났다",
  "로 판단된다",
  "로 보인다",
  "일 가능성이 있다",
  "를 시사한다",
  "로 해석할 수 있다",
  "전략적 의미",
  "유의미한 인사이트",
  "차별화 포인트",
  "핵심 자산",
  "극대화할 수 있다",
  "강화할 필요가 있다",
  "활용하는 것이 효과적이다",
  "다양한 콘텐츠",
  "적극적인 소통",
  "시너지를 창출한다",
];

export type LintHit = { phrase: string; count: number };

export function lintText(text: string): LintHit[] {
  const hits: LintHit[] = [];
  for (const phrase of BANNED_PHRASES) {
    const count = text.split(phrase).length - 1;
    if (count > 0) hits.push({ phrase, count });
  }
  return hits;
}

/** 여러 텍스트 조각을 한 번에 검사하고, 있으면 콘솔에 경고로 남긴다. */
export function lintAndLog(label: string, texts: string[]): void {
  const combined = texts.join("\n");
  const hits = lintText(combined);
  if (hits.length > 0) {
    console.warn(
      `[style-lint] ${label}: 상투어 ${hits.length}종 발견 - ${hits.map((h) => `"${h.phrase}"x${h.count}`).join(", ")}`
    );
  }
}
