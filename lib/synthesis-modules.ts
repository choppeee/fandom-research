import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";
import type { CommentSampleItem, Aggregates } from "./aggregate";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const MODEL = "claude-sonnet-5";

/** 앞서 만들어진 모듈들의 마크다운을 입력으로 받아 그 위에 종합/전략 판단을 얹는 후속 모듈. */
export async function runSynthesisModule(params: {
  title: string;
  instruction: string;
  keyword: string;
  periodStart: string;
  periodEnd: string;
  inputModules: { title: string; content: string }[];
  maxTokens?: number;
}): Promise<{ title: string; content: string }> {
  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})

이번에 작성할 모듈: ${params.title}
모듈 지침: ${params.instruction}

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라. 여기 없는 사실을 새로 지어내지 않는다.

${params.inputModules.map((m) => `--- ${m.title} ---\n${m.content}`).join("\n\n")}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 4000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  if (!text) {
    console.error(
      `[runSynthesisModule:${params.title}] 빈 응답. stop_reason=${res.stop_reason}, blocks=${res.content.map((b) => b.type).join(",")}`
    );
  }
  return { title: params.title, content: text };
}

/** 플랫폼 하나만의 데이터로 그 플랫폼 특유의 반응 성격을 분석한다 (YouTube: 시청 후 반응, X: 실시간 화제/밈 등). */
export async function runPlatformModule(params: {
  platform: "youtube" | "x";
  keyword: string;
  periodStart: string;
  periodEnd: string;
  stats: Aggregates;
  sample: CommentSampleItem[];
}): Promise<{ title: string; content: string }> {
  const platformGuide =
    params.platform === "youtube"
      ? "YouTube는 콘텐츠를 실제 시청한 이후 나타나는 반응이다. 장면, 행동, 관계성, 캐릭터에 대한 반응 중심으로 분석하라."
      : "X는 실시간 화제, 밈, 팬덤 내부 언어, 짤/클립 확산, 인용/재해석, 비팬 유입, 이슈 확산이 특징이다. 이런 성격 중심으로 분석하라.";

  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
플랫폼: ${params.platform}

${platformGuide}
이 플랫폼 데이터만 근거로 이 플랫폼에서 나타나는 고유한 반응 성격을 분석하라(최소 3개 핵심 관찰, Observation→Evidence→Interpretation→Strategic Meaning 구조).
마크다운 "## ${params.platform === "youtube" ? "YouTube" : "X(Twitter)"} 반응 분석" 제목으로 시작하라.

[집계 통계]
${JSON.stringify(
  {
    topKeywords: params.stats.topKeywords,
    sentimentRatio: params.stats.sentimentRatio,
  },
  null,
  2
)}

[대표 게시물 샘플 (${params.sample.length}건)]
${JSON.stringify(params.sample, null, 2)}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  return { title: `${params.platform === "youtube" ? "YouTube" : "X(Twitter)"} 반응 분석`, content: text };
}
