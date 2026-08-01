import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";
import type { CommentSampleItem, Aggregates } from "./aggregate";
import { moduleResultSchema, parseModuleResult, EMPTY_MODULE_RESULT, type ModuleResult, type SituationDiagnosis } from "./insight-types";
import type { IpTypeInfo } from "./ip-classify";
import { REPORT_MODE_GUIDE, type ReportMode } from "./report-mode";

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
// 인사이트 스키마가 surface/emotion/intent + optional bottleneck/reframe/amplification까지
// 포함하면서 항목당 출력량이 늘었다. 3000에서는 max_tokens 도중 끊겨 insights가 통째로
// 빈 배열이 되는 문제가 실측 확인됨(stop_reason: "max_tokens").
const MODULE_MAX_TOKENS = 6000;

const MODULE_ADDENDUM = `
지금은 전체 리포트를 한 번에 쓰는 것이 아니라, 리포트를 구성하는 "모듈" 하나만 깊게 작성하는 1차 분석(analyst)
단계다. 이 단계의 글은 나중에 별도의 editorial 단계에서 다시 다듬어지므로, 완벽한 최종 문장이 아니어도
되지만 시스템 프롬프트의 WRITING STYLE 규칙(결론 먼저 선언 금지, 상투어 금지, IP 유형에 맞는 언어, 이론
먼저 던지지 않기)은 이 단계에서부터 지킨다. 반드시 record_insights 도구 호출로만 답하라.

원칙:
- 이 모듈의 핵심 Insight를 2~4개만 선별한다. 개수를 채우려고 약한 Insight를 넣지 않는다.
- interpretation은 100~180단어(한국어 약 200~350자) 안에서: 가장 먼저 눈에 띄는 구체적 반응 -> 반복되는
  공통점 -> 예상과 실제의 차이 -> 그 차이의 의미 순서로 자연스러운 문단을 쓴다. Observation/Evidence 같은
  영문 라벨을 절대 노출하지 않는다.
- evidence_scope에 이 발견이 전체 표본에 적용되는지, 특정 영상/게시물/세그먼트에 한정되는지 반드시 밝힌다.
- evidence 배열의 항목이 [대표 댓글/게시물 샘플]의 실제 댓글을 인용한 것이면, 그 댓글의 comment_id를
  evidence_ids에 담는다. 통계·수치 요약이라 특정 댓글을 인용하지 않았으면 evidence_ids는 비워둔다.
  샘플에 없는 comment_id를 만들어내지 않는다 - 이 값은 나중에 리포트에서 실제 영상 썸네일/댓글 카드를
  보여주는 데 쓰이므로, 근거 없이 채우면 사실과 다른 화면이 만들어진다.
- surface_expression(사람들이 실제로 쓴 말) / emotional_meaning(그 말의 감정) / underlying_intent(실제
  원하는 것)를 구분해서 채운다. underlying_intent는 반복 맥락·함께 등장하는 표현·행동 신호로 뒷받침될
  때만 채우고, 근거 없이 마음대로 상상하지 않는다. 표면 표현을 그대로 전략으로 옮기지 않는다.
- 실행 판단이 필요한 발견에는 decision을 채운다(KEEP/REPEAT/AMPLIFY/CLARIFY/TEST/EXPAND/CONNECT/
  PROTECT/REFRAME/CORRECT/WATCH/AVOID/NO_CHANGE 중 하나). 단순 인식 발견이면 비워둔다. 문제가 없다면
  NO_CHANGE도 정당한 답이다 - 모든 IP에 병목이 있다고 가정하지 않는다.
- possible_bottleneck은 반응과 성과 사이 단절이 실제로 반복 확인되고 다른 설명보다 병목 해석이 더
  설득력 있을 때만 채운다. 그렇지 않으면 이 필드를 아예 생략한다(억지로 병목을 만들지 않는다).
- 강점을 더 키우자는 방향(decision=AMPLIFY 등)이면 amplification_risk에 확대했을 때의 부작용도 함께
  적는다(지속가능성, 다른 정체성을 가릴 위험, 진입장벽 등).
- 이 모듈이 이번 데이터/IP 유형에 적용하기 어려우면 applicable=false, not_applicable_reason에 1~2문장만
  쓰고 insights는 빈 배열로 둔다. 억지로 채우지 않는다.
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
    title: "사람들은 이 대상을 어떤 존재로 기억하고 있는가",
    instruction: `대중이 현재 이 IP를 머릿속에서 어떤 존재로 인식하고 있는지 분석하라.
가장 중요한 인식 특성 2~4개를 도출하라(각각 데이터 근거 포함). 일반 형용사로 끝내지 말고 구체적으로 정의하라.`,
  },
  {
    key: "character_traits",
    title: "이 대상의 모습은 구체적으로 어떻게 그려지는가",
    instruction: `이 IP(또는 인물)의 특성 중 가장 중요한 2~4개를 도출하라. "웃기다/귀엽다" 같은 일반 형용사로 끝내지 말고,
왜 그렇게 인식되는지까지 분해하라. 각 특성마다 "X보다는 Y" 형태로 구체적으로 정의하고 근거 댓글을 인용하라.
Person/Group IP가 아니면(브랜드/제품 등) "캐릭터"가 아니라 그 IP 유형에 맞는 정체성 언어로 분석하라.`,
  },
  {
    key: "appeal_drivers",
    title: "사람들이 실제로 마음을 여는 순간",
    instruction: `사람들이 이 IP를 좋아하거나 선택하는 이유 중 가장 중요한 2~4개를 도출하라. Functional / Emotional / Social /
Identity / Cultural / Relationship Appeal 중 해당하는 것으로 분류하라. 해당 없는 범주는 억지로 채우지 않는다.`,
  },
  {
    key: "psychological_drivers",
    title: "왜 이런 반응이 나타나는가",
    instruction: `대중 반응 이면의 심리적 동인 중 실제로 데이터와 강하게 연결되는 것 2~3개만 분석하라(모든 이론을 나열하지 않는다).
Parasocial Interaction, Pratfall Effect, Expectation Violation, Similarity Attraction, Warmth-Competence, Social Proof,
Mere Exposure, Peak-End Rule 등에서 실제 데이터와 연결되는 것만 theory에 표시한다. 이론 이름보다 현상 설명이 먼저다.`,
  },
  {
    key: "audience_segments",
    title: "누가, 어떤 맥락에서 다르게 반응하는가",
    instruction: `반응을 Core Fan / Casual Fan / New Fan / Non-fan / Accidental Discovery 등으로 구분하되,
텍스트에서 확실하지 않으면 "신규 유입 추정" 같은 추정 표현을 쓴다. 기존 팬과 신규 유입의 반응 차이 중 가장 중요한 것을 다뤄라.`,
  },
  {
    key: "conversion_signals",
    title: "무관심이 관심으로 바뀌는 순간",
    instruction: `"팬 아닌데", "이거 보고 찾아봄", "생각보다", "의외로" 류의 반응을 찾아 CONVERSION SIGNAL로 분석하라
(일반 긍정 댓글보다 전략적 중요도가 높다). 어떤 콘텐츠/장면이 전환을 발생시켰는지와, 기대와 실제 사이의
Expectation Gap을 다뤄라.`,
  },
  {
    key: "relationship_dynamics",
    title: "누구와 함께 있을 때 매력이 더 선명해지는가",
    instruction: `인물/그룹 IP인 경우, 누구와 있을 때 어떤 캐릭터가 활성화되는지 분석하라. "케미가 좋다"에서 끝내지 말고
왜 그 관계를 좋아하는지 설명하라. 인물/그룹 IP가 아니거나 관계성 데이터가 부족하면 applicable=false로 처리한다.`,
  },
  {
    key: "viral_mechanics",
    title: "무엇이 사람들 사이에서 계속 퍼지는가",
    instruction: `온라인에서 퍼질 가능성이 있는 요소를 분석하라: 반복 인용되는 문장, 밈, 별명, 특정 장면, 예상 밖 행동.
무엇이 퍼지는지(Object), 왜 공유하고 싶은지(Emotion), 어떤 표현으로 압축되는지(Language)를 각 Insight 안에 녹여라.`,
  },
  {
    key: "hidden_value",
    title: "운영자가 말하는 강점과 사람들이 반응하는 강점은 같은가",
    instruction: `공식적으로 강조되는 매력 포인트와 실제 대중이 반응하는 지점 사이의 차이를 찾아라.
headline에서 결론을 선언하지 말고, 공식 포지션과 실제 반응의 차이가 먼저 드러나게 쓴 뒤 그 차이가 무엇을
의미하는지 풀어라. 실행 판단이 뒤따르는 발견이면 recommendation을 채워라.`,
  },
  {
    key: "risk_misperception",
    title: "지금 방치하면 굳어질 수 있는 인식은 무엇인가",
    instruction: `단순 악플 요약이 아니라 장기적 포지셔닝 리스크를 분석하라: 오해, 피로, 이미지 고착, 진정성 훼손,
과장된 포지셔닝, 팬과 대중의 인식 충돌 등. confidence는 근거의 확실성으로, recommendation은 지금 대응해야
하는지(TEST/AVOID) 지켜봐야 하는지(WATCH)로 구분해서 채워라.`,
  },
];

function situationLine(situation: SituationDiagnosis): string {
  if (!situation.currentSituation) return "";
  return `\n현재 상태 진단: ${situation.currentSituation}
지금 가장 중요한 목적: ${situation.currentPriority}
핵심 질문: ${situation.keyQuestions.join(" / ")}
(이 진단에 맞는 발견을 우선하되, 기계적으로 모든 질문에 답하려 하지 마라. 데이터가 다른 것을 보여주면 그것을 따른다.)`;
}

function buildPrompt(def: ModuleDefinition, ctx: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  platforms: ("youtube" | "x")[];
  stats: Aggregates;
  sample: CommentSampleItem[];
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
}) {
  return `분석 대상(IP): "${ctx.keyword}"
IP 유형: ${ctx.ipType.typeLabel} (대중은 "${ctx.ipType.audienceTerm}"으로, 정체성은 "${ctx.ipType.identityTerm}"으로 지칭하라)
분석 기간: ${ctx.periodStart} ~ ${ctx.periodEnd}
데이터 플랫폼: ${ctx.platforms.join(", ")}
리포트 모드: ${ctx.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[ctx.reportMode]}${situationLine(ctx.situation)}

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
    ipType: IpTypeInfo;
    reportMode: ReportMode;
    situation: SituationDiagnosis;
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
