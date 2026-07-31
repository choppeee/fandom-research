/** Executive Summary / Final Strategic Conclusion 텍스트에서 구조화 카드 데이터를 뽑아낸다.
 * lib/pipeline.ts의 executive_summary 태스크 프롬프트가 이 포맷을 지시하므로 매칭 가능하다. */

function stripMd(s: string): string {
  return s
    .replace(/^[-*]\s+/gm, "")
    .replace(/[*`_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTop5Insights(text: string): { headline: string; evidence: string; implication: string }[] {
  const items: { headline: string; evidence: string; implication: string }[] = [];
  const regex = /INSIGHT\s*0?(\d+)[:.]?\s*([\s\S]*?)(?=INSIGHT\s*0?\d+[:.]|##\s*Final Strategic Conclusion|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) && items.length < 5) {
    const body = m[2].trim();
    const evidenceMatch = body.match(/Evidence:\s*([\s\S]*?)(?=Why it matters:|Strategic implication:|$)/i);
    const whyMatch = body.match(/Why it matters:\s*([\s\S]*?)(?=Strategic implication:|$)/i);
    const implMatch = body.match(/Strategic implication:\s*([\s\S]*)/i);
    const headline = stripMd(body.split(/Evidence:/i)[0]);
    if (!headline) continue;
    items.push({
      headline: headline.slice(0, 130),
      evidence: stripMd(evidenceMatch?.[1] ?? "").slice(0, 130),
      implication: stripMd(`${whyMatch?.[1] ?? ""} ${implMatch?.[1] ?? ""}`).slice(0, 150),
    });
  }
  return items;
}

const CONCLUSION_LABELS = ["CURRENT", "HIDDEN", "OPPORTUNITY", "AUDIENCE", "TRIGGER", "POSITIONING", "ACTION"];

export function parseFinalConclusion(text: string): { label: string; value: string }[] {
  const steps: { label: string; value: string }[] = [];
  for (let i = 0; i < CONCLUSION_LABELS.length; i++) {
    const label = CONCLUSION_LABELS[i];
    const next = CONCLUSION_LABELS[i + 1];
    const re = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=${next ? `${next}[:\\s]` : "$"})`, "i");
    const m = text.match(re);
    if (m && m[1].trim()) steps.push({ label, value: stripMd(m[1]).slice(0, 220) });
  }
  return steps;
}

export function extractFinalSentence(text: string): string | null {
  const m = text.match(/이\s*IP는[^.]*로\s*포지셔닝해야\s*한다\.?/);
  return m ? m[0] : null;
}
