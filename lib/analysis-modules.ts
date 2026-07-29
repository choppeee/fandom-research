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

const MODULE_MODEL = "claude-sonnet-5";
const MODULE_MAX_TOKENS = 3500;

const MODULE_ADDENDUM = `
지금은 전체 리포트를 한 번에 쓰는 것이 아니라, 리포트를 구성하는 "모듈" 하나만 깊게 작성한다.
반드시 지켜야 할 원칙:
- 이 모듈에서 다루는 핵심 Insight마다 다음 구조를 갖춘 문단으로 서술한다:
  Observation(무엇이 관찰되었는가) → Evidence(어떤 댓글/수치가 근거인가, 실제 인용 포함) →
  Interpretation(무엇을 의미하는가) → Psychological Explanation(왜 그런 반응인가) →
  Strategic Meaning(IP 관점에서 왜 중요한가) → Action(그래서 무엇을 해야 하는가).
- 근거 없이 심리학 용어만 붙이지 않는다. 반드시 데이터 관찰 → 이론 → 전략적 의미 순서로 설명한다.
- "귀엽다/재밌다/멋있다" 같은 일반 형용사만으로 결론 내지 않는다. 더 구체적으로 정의한다.
- 빈도(얼마나 많이 언급됐는가)와 전략적 중요도(전략적으로 왜 중요한가)를 구분한다.
  언급량이 적어도 신규 유입/전환을 보여주는 반응은 전략적 중요도가 높을 수 있다.
- 이 모듈이 이번 데이터/IP 유형에 적용하기 어렵다면 억지로 채우지 말고,
  "## {title}" 제목 아래 왜 적용하기 어려운지 1~2문장만 쓰고 끝낸다.
- 각 핵심 Insight에 Evidence Strength(HIGH/MEDIUM/LOW)를 표시한다.
- 마크다운으로 작성하고, 섹션 제목은 "## {title}" 하나로 시작한다.
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
    title: "Current Audience Perception & Perception Map",
    instruction: `대중이 현재 이 IP를 머릿속에서 어떤 존재로 인식하고 있는지 분석하라.
최소 5개의 구체적인 인식 특성을 도출하고(각각 데이터 근거 포함), 이 IP 유형에 맞는 인식 축(예: 친근함↔동경, 프리미엄↔대중적 등) 3~6개를 스스로 골라
각 축에서 현재 위치와 근거, 원하는 이동 방향까지 제안하라. 마지막에 "현재 대중 인식 한 문장"을 정의하라.`,
  },
  {
    key: "character_traits",
    title: "Character / IP Traits",
    instruction: `이 IP(또는 인물)의 특성을 최소 5개 도출하라. "웃기다/귀엽다" 같은 일반 형용사로 끝내지 말고,
왜 그렇게 인식되는지까지 분해하라. 예: 의도적으로 웃긴가/본인은 진지한데 웃긴가/주변이 캐릭터를 만들어주는가/
허술함 때문에 친근한가/예측 불가능성 때문인가. 각 특성마다 "X보다는 Y" 형태로 구체적으로 정의하고 근거 댓글을 인용하라.`,
  },
  {
    key: "appeal_drivers",
    title: "Appeal Drivers",
    instruction: `사람들이 이 IP를 좋아하거나 선택하는 이유를 최소 5개 도출하라. 각 항목에 WHY(왜 매력적인가)를 반드시 포함하고,
Functional / Emotional / Social / Identity / Cultural / Relationship Appeal 중 해당하는 것으로 분류하라. 해당 없는 범주는 억지로 채우지 않는다.`,
  },
  {
    key: "psychological_drivers",
    title: "Psychological Drivers",
    instruction: `대중 반응 이면의 심리적 동인을 최소 4개 분석하라. Social/Consumer/Media Psychology, Behavioral Economics, Fandom Studies,
Brand Psychology 등에서 실제 데이터와 연결되는 이론만 사용한다(Parasocial Interaction, Pratfall Effect, Expectation Violation,
Similarity Attraction, Self-Disclosure, Warmth-Competence, Social Proof, Mere Exposure, Peak-End Rule 등).
각 이론마다 관찰된 데이터 → 이론 → 현재 IP에서 작동하는 방식 → 전략적 의미 순서로 설명하라.`,
  },
  {
    key: "audience_segments",
    title: "Audience Segments (Fan vs Non-fan / Existing vs New)",
    instruction: `반응을 Core Fan / Casual Fan / New Fan / Non-fan / Accidental Discovery / Critical Audience 등으로 구분하되,
텍스트에서 확실하지 않으면 "신규 유입 추정" 같은 추정 표현을 쓴다. 기존 팬과 신규 유입의 반응이 어떻게 다른지 반드시 비교하라.`,
  },
  {
    key: "conversion_signals",
    title: "Conversion Signals & Expectation Gap",
    instruction: `"팬 아닌데", "이거 보고 찾아봄", "생각보다", "의외로", "원래 이런 사람이었어?" 류의 반응을 최소 3개 찾아
CONVERSION SIGNAL로 분석하라 (일반 긍정 댓글보다 전략적 중요도가 높다). 어떤 콘텐츠/장면/행동이 전환을 발생시켰는지 설명하고,
기존 예상과 실제 발견 사이의 Expectation Gap을 별도로 짚어라(긍정적 갭이면 신규 유입용 콘텐츠 자산으로 평가).`,
  },
  {
    key: "relationship_dynamics",
    title: "Relationship Dynamics",
    instruction: `인물/그룹 IP인 경우, 누구와 있을 때 어떤 캐릭터가 활성화되는지 분석하라(혼자/친한 멤버/후배/낯선 사람 등).
"케미가 좋다"에서 끝내지 말고 왜 그 관계를 좋아하는지 설명하라. 인물/그룹 IP가 아니거나 관계성 데이터가 부족하면
길게 쓰지 말고 이유를 명시하고 마친다.`,
  },
  {
    key: "viral_mechanics",
    title: "Viral & Meme Mechanics",
    instruction: `온라인에서 퍼질 가능성이 있는 요소를 분석하라: 반복 인용되는 문장, 밈, 별명, 특정 장면/이미지, 예상 밖 행동.
Viral Object(무엇이 퍼지는가) / Viral Emotion(왜 공유하고 싶은가) / Viral Language(어떤 표현으로 압축되는가) /
Viral Context(어떤 상황에서 확산되는가) / Replication Potential(콘텐츠로 재현 가능한가)로 구성하라.
X 데이터가 없으면 YouTube 댓글 내에서 반복 인용/패러디되는 표현 중심으로 분석하고, 데이터가 부족한 부분은 명시하라.`,
  },
  {
    key: "hidden_value",
    title: "Hidden Value",
    instruction: `공식적으로 강조되는 매력 포인트와, 실제 대중이 반응하는 지점 사이의 차이를 최소 3개 찾아라.
"공식 포지션: X / 실제 대중 반응: Y / Hidden Value: Z" 형태로 정리하고, 반드시 데이터 근거를 붙여라.`,
  },
  {
    key: "risk_misperception",
    title: "Risks & Misperception",
    instruction: `단순 악플 요약이 아니라 장기적 포지셔닝 리스크를 최소 3개 분석하라: 오해, 피로, 이미지 고착, 진정성 훼손,
과장된 포지셔닝, 팬과 대중의 인식 충돌, 경쟁 IP와의 동질화 등. 각 리스크가 실제로 어떤 반응에서 감지되는지 근거를 붙이고,
심각도(HIGH/MEDIUM/LOW)를 표시하라.`,
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
): Promise<{ title: string; content: string }> {
  const res = await anthropic().messages.create({
    model: MODULE_MODEL,
    max_tokens: MODULE_MAX_TOKENS,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT + "\n" + MODULE_ADDENDUM,
    messages: [{ role: "user", content: buildPrompt(def, ctx) }],
  });
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  return { title: def.title, content: text };
}
