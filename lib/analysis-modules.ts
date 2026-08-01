import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";
import type { CommentSampleItem, Aggregates } from "./aggregate";
import { moduleResultSchema, parseModuleResult, EMPTY_MODULE_RESULT, type ModuleResult } from "./insight-types";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const MODULE_MODEL = "claude-sonnet-5";
const MODULE_MAX_TOKENS = 3000;

const MODULE_ADDENDUM = `
지금은 전체 리포트를 한 번에 쓰는 것이 아니라, 리포트를 구성하는 "모듈" 하나만 깊게 작성한다.
반드시 record_insights 도구 호출로만 답하라 (마크다운 텍스트로 답하지 않는다).
원칙:
- 이 모듈의 핵심 Insight를 2~4개만 선별한다. 개수를 채우려고 약한 Insight를 넣지 않는다.
- 각 Insight의 interpretation은 100~180단어(한국어 약 200~350자) 안에서 가장 중요한 것만 압축한다.
  Observation/Evidence/Interpretation/Psychological Explanation/Strategic Meaning/Action을 전부 긴 문단으로
  나열하지 말고, "왜 그런가"에 대한 핵심 해석만 interpretation에, 근거는 evidence 배열에, 전략적 의미는
  strategic_implication에 짧게 나눠 담는다.
- 근거 없이 심리학 용어만 붙이지 않는다. 이론(theory 필드)은 실제로 설명력이 높을 때만 채우고, 아니면 비워둔다.
  이론 이름보다 "왜 이 반응이 발생했는지"에 대한 한국어 설명이 먼저다.
- "귀엽다/재밌다/멋있다" 같은 일반 형용사만으로 결론 내지 않는다.
- 빈도(얼마나 많이 언급됐는가)와 전략적 중요도를 구분한다. 언급량이 적어도 신규 유입/전환을 보여주는
  반응은 전략적 중요도가 높을 수 있다.
- 이 모듈이 이번 데이터/IP 유형에 적용하기 어려우면 applicable=false, not_applicable_reason에 1~2문장만 쓰고
  insights는 빈 배열로 둔다. 억지로 채우지 않는다.
- 반드시 한국어로 작성한다.
`;

export type ModuleKey =
  | "audience_perception"
  | "character_traits"
  | "appeal_drivers"
  | "psychological_drivers"
  | "audience_segments"
  | "conversion_signals"
  | "relationship_dynamics"
  | "viral_mechanics"
  | "hidden_value"
  | "risk_misperception";

export type ModuleDefinition = {
  key: ModuleKey;
  title: string;
  instruction: string;
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "audience_perception",
    title: "Current Audience Perception",
    instruction: `대중이 현재 이 IP를 머릿속에서 어떤 존재로 인식하고 있는지 분석하라.
가장 중요한 인식 특성 2~4개를 도출하라(각각 데이터 근거 포함). 일반 형용사로 끝내지 말고 구체적으로 정의하라.`,
  },
  {
    key: "character_traits",
    title: "Character / IP Traits",
    instruction: `이 IP(또는 인물)의 특성 중 가장 중요한 2~4개를 도출하라. "웃기다/귀엽다" 같은 일반 형용사로 끝내지 말고,
왜 그렇게 인식되는지까지 분해하라. 각 특성마다 "X보다는 Y" 형태로 구체적으로 정의하고 근거 댓글을 인용하라.`,
  },
  {
    key: "appeal_drivers",
    title: "Appeal Drivers",
    instruction: `사람들이 이 IP를 좋아하거나 선택하는 이유 중 가장 중요한 2~4개를 도출하라. Functional / Emotional / Social /
Identity / Cultural / Relationship Appeal 중 해당하는 것으로 분류하라. 해당 없는 범주는 억지로 채우지 않는다.`,
  },
  {
    key: "psychological_drivers",
    title: "Psychological Drivers",
    instruction: `대중 반응 이면의 심리적 동인 중 실제로 데이터와 강하게 연결되는 것 2~3개만 분석하라(모든 이론을 나열하지 않는다).
Parasocial Interaction, Pratfall Effect, Expectation Violation, Similarity Attraction, Warmth-Competence, Social Proof,
Mere Exposure, Peak-End Rule 등에서 실제 데이터와 연결되는 것만 theory에 표시한다.`,
  },
  {
    key: "audience_segments",
    title: "Audience Segments (Fan vs Non-fan / Existing vs New)",
    instruction: `반응을 Core Fan / Casual Fan / New Fan / Non-fan / Accidental Discovery 등으로 구분하되,
텍스트에서 확실하지 않으면 "신규 유입 추정" 같은 추정 표현을 쓴다. 기존 팬과 신규 유입의 반응 차이 중 가장 중요한 것을 다뤄라.`,
  },
  {
    key: "conversion_signals",
    title: "Conversion Signals & Expectation Gap",
    instruction: `"팬 아닌데", "이거 보고 찾아봄", "생각보다", "의외로" 류의 반응을 찾아 CONVERSION SIGNAL로 분석하라
(일반 긍정 댓글보다 전략적 중요도가 높다). 어떤 콘텐츠/장면이 전환을 발생시켰는지와, 기대와 실제 사이의
Expectation Gap을 다뤄라.`,
  },
  {
    key: "relationship_dynamics",
    title: "Relationship Dynamics",
    instruction: `인물/그룹 IP인 경우, 누구와 있을 때 어떤 캐릭터가 활성화되는지 분석하라. "케미가 좋다"에서 끝내지 말고
왜 그 관계를 좋아하는지 설명하라. 인물/그룹 IP가 아니거나 관계성 데이터가 부족하면 applicable=false로 처리한다.`,
  },
  {
    key: "viral_mechanics",
    title: "Viral & Meme Mechanics",
    instruction: `온라인에서 퍼질 가능성이 있는 요소를 분석하라: 반복 인용되는 문장, 밈, 별명, 특정 장면, 예상 밖 행동.
무엇이 퍼지는지(Object), 왜 공유하고 싶은지(Emotion), 어떤 표현으로 압축되는지(Language)를 각 Insight 안에 녹여라.`,
  },
  {
    key: "hidden_value",
    title: "Hidden Value",
    instruction: `공식적으로 강조되는 매력 포인트와 실제 대중이 반응하는 지점 사이의 차이를 찾아라.
headline에 "공식 포지션 X / 실제 반응 Y" 형태를 담고, interpretation에서 Hidden Value가 무엇인지 정의하라.`,
  },
  {
    key: "risk_misperception",
    title: "Risks & Misperception",
    instruction: `단순 악플 요약이 아니라 장기적 포지셔닝 리스크를 분석하라: 오해, 피로, 이미지 고착, 진정성 훼손,
과장된 포지셔닝, 팬과 대중의 인식 충돌 등. confidence 필드를 리스크의 심각도(HIGH/MEDIUM/LOW)로 사용하라.`,
  },
];

function buildPrompt(def: ModuleDefinition, ctx: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  platforms: ("youtube" | "x")[];
  stats: Aggregates;
  sample: CommentSampleItem[];
}) {
  return `분석 대상(IP): "${ctx.keyword}"
분석 기간: ${ctx.periodStart} ~ ${ctx.periodEnd}
데이터 플랫폼: ${ctx.platforms.join(", ")}

이번에 작성할 모듈: ${def.title}
모듈 지침: ${def.instruction}

[집계 통계 - 전체 데이터 기준]
${JSON.stringify(
  {
    topKeywords: ctx.stats.topKeywords,
    sentimentRatio: ctx.stats.sentimentRatio,
    dailyTrend: ctx.stats.dailyTrend,
    purchaseIntentSummary: ctx.stats.purchaseIntentSummary,
    riskGroups: ctx.stats.riskGroups,
  },
  null,
  2
)}

[대표 댓글/게시물 샘플 (${ctx.sample.length}건, platform 태그 포함)]
${JSON.stringify(ctx.sample, null, 2)}`;
}

export async function runAnalysisModule(
  def: ModuleDefinition,
  ctx: {
    keyword: string;
    periodStart: string;
    periodEnd: string;
    platforms: ("youtube" | "x")[];
    stats: Aggregates;
    sample: CommentSampleItem[];
  }
): Promise<{ title: string; result: ModuleResult }> {
  const schema = moduleResultSchema("record_insights", `${def.title} 모듈의 구조화된 Insight를 기록한다.`);
  const res = await anthropic().messages.create({
    model: MODULE_MODEL,
    max_tokens: MODULE_MAX_TOKENS,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT + "\n" + MODULE_ADDENDUM,
    tools: [schema],
    tool_choice: { type: "tool", name: "record_insights" },
    messages: [{ role: "user", content: buildPrompt(def, ctx) }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return { title: def.title, result: EMPTY_MODULE_RESULT };
  return { title: def.title, result: parseModuleResult(toolUse.input) };
}
