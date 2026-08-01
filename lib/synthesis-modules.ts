import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";
import type { CommentSampleItem, Aggregates } from "./aggregate";
import {
  moduleResultSchema,
  parseModuleResult,
  EMPTY_MODULE_RESULT,
  STRATEGY_SCHEMA,
  parseStrategyResult,
  POSITIONING_SCHEMA,
  parsePositioningResult,
  EXECUTIVE_SUMMARY_SCHEMA,
  parseExecutiveSummaryResult,
  type ModuleResult,
  type StrategyResult,
  type PositioningResult,
  type ExecutiveSummaryResult,
} from "./insight-types";

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

const COMPRESSION_NOTE = `
반드시 도구 호출로만 답한다 (마크다운 텍스트 금지). 개수를 채우려고 약한 항목을 넣지 않는다.
인터프리테이션은 100~180단어로 압축하고, 이론은 실제로 설명력이 높을 때만 표시한다.`;

/** 앞서 만들어진 모듈들의 결과를 입력으로 받아 그 위에 종합 판단을 얹는 후속 모듈 (구조화 Insight 출력). */
export async function runInsightSynthesis(params: {
  title: string;
  instruction: string;
  keyword: string;
  periodStart: string;
  periodEnd: string;
  inputModulesText: string;
  maxTokens?: number;
}): Promise<ModuleResult> {
  const schema = moduleResultSchema("record_insights", `${params.title} 모듈의 구조화된 Insight를 기록한다.`);
  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})

이번에 작성할 모듈: ${params.title}
모듈 지침: ${params.instruction}
${COMPRESSION_NOTE}

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라. 여기 없는 사실을 새로 지어내지 않는다.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 3000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [schema],
    tool_choice: { type: "tool", name: "record_insights" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return EMPTY_MODULE_RESULT;
  return parseModuleResult(toolUse.input);
}

/** 플랫폼 하나만의 데이터로 그 플랫폼 특유의 반응 성격을 분석한다 (YouTube: 시청 후 반응, X: 실시간 화제/밈 등). */
export async function runPlatformModule(params: {
  platform: "youtube" | "x";
  keyword: string;
  periodStart: string;
  periodEnd: string;
  stats: Aggregates;
  sample: CommentSampleItem[];
}): Promise<{ title: string; result: ModuleResult }> {
  const platformGuide =
    params.platform === "youtube"
      ? "YouTube는 콘텐츠를 실제 시청한 이후 나타나는 반응이다. 장면, 행동, 관계성, 캐릭터에 대한 반응 중심으로 분석하라."
      : "X는 실시간 화제, 밈, 팬덤 내부 언어, 짤/클립 확산, 인용/재해석, 비팬 유입, 이슈 확산이 특징이다. 이런 성격 중심으로 분석하라.";
  const title = params.platform === "youtube" ? "YouTube 반응 분석" : "X(Twitter) 반응 분석";
  const schema = moduleResultSchema("record_insights", `${title} 모듈의 구조화된 Insight를 기록한다.`);

  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
플랫폼: ${params.platform}

${platformGuide}
이 플랫폼 데이터만 근거로 이 플랫폼에서 나타나는 고유한 반응 성격 2~3개를 분석하라.
${COMPRESSION_NOTE}

[집계 통계]
${JSON.stringify({ topKeywords: params.stats.topKeywords, sentimentRatio: params.stats.sentimentRatio }, null, 2)}

[대표 게시물 샘플 (${params.sample.length}건)]
${JSON.stringify(params.sample, null, 2)}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [schema],
    tool_choice: { type: "tool", name: "record_insights" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return { title, result: EMPTY_MODULE_RESULT };
  return { title, result: parseModuleResult(toolUse.input) };
}

/** Positioning 후보 + CORE/SUPPORTING/EMERGING 최종 포지션. */
export async function runPositioningSynthesis(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  inputModulesText: string;
}): Promise<PositioningResult> {
  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})

모든 분석 모듈을 종합해 Positioning 후보 3~5개(각각 Audience Need/데이터 근거/심리적 매력/차별성/리스크 포함)를
제안하고, 마지막에 CORE/SUPPORTING/EMERGING Position을 확정하라. 추상적 문장("소통을 강화해야 한다" 등)은
금지, 반드시 "누구에게/어떤 상황에서/어떤 포맷으로"까지 구체화하라. 반드시 도구 호출로만 답한다.

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [POSITIONING_SCHEMA],
    tool_choice: { type: "tool", name: "record_positioning" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return { candidates: [], core: "", supporting: "", emerging: "" };
  return parsePositioningResult(toolUse.input);
}

/** 확정된 Positioning을 실행 전략으로 연결 (Insight -> Opportunity -> Hypothesis -> Test, 우선순위 포함). */
export async function runStrategySynthesis(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  inputModulesText: string;
}): Promise<StrategyResult> {
  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})

확정된 Positioning을 실행으로 연결하는 전략 추천을 만들어라. 각 추천은 반드시
INSIGHT(실제 데이터에서 무엇을 발견했는가) -> OPPORTUNITY(어떤 가능성이 존재하는가) ->
HYPOTHESIS(어떤 전략을 테스트할 가치가 있는가) -> TEST(낮은 비용으로 무엇을 먼저 검증할 수 있는가)
4단계로 분리한다. 데이터만으로 바로 대규모 제작/MD/브랜딩을 추천하지 않는다(그런 결론은 confidence를
EXPERIMENTAL로 표시하고 TEST 단계에 작은 실험으로 축소해서 제안하라). P1(지금 바로 할 것)은 1~3개로
엄격하게 제한하고, 나머지는 P2(테스트할 것)/P3(관찰할 것)로 분류하며, 우선순위에 들지 못한 아이디어는
appendix_ideas에 한 줄씩만 담아라. 반드시 도구 호출로만 답한다.

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [STRATEGY_SCHEMA],
    tool_choice: { type: "tool", name: "record_strategy" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return { recommendations: [], appendixIdeas: [] };
  return parseStrategyResult(toolUse.input);
}

/** Top 5 Findings + IP at a Glance. 모든 모듈이 끝난 뒤 마지막에 생성한다. */
export async function runExecutiveSummarySynthesis(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  inputModulesText: string;
}): Promise<ExecutiveSummaryResult> {
  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})

모든 모듈을 종합해 가장 중요한 전략적 발견 정확히 5개(findings)와 IP at a Glance(현재 포지션 -> 핵심 매력 ->
Hidden Value -> 가장 큰 Opportunity -> 가장 큰 Risk -> 추천 방향)를 기록하라. 이것만 읽어도 전체 리포트의
70%를 이해할 수 있어야 한다. final_sentence는 정확히 "이 IP는 ______로 포지셔닝해야 한다." 형식으로 채워라.
반드시 도구 호출로만 답한다.

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [EXECUTIVE_SUMMARY_SCHEMA],
    tool_choice: { type: "tool", name: "record_executive_summary" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    return {
      findings: [],
      ipAtGlance: {
        currentPosition: "",
        coreAppeal: "",
        hiddenValue: "",
        topOpportunity: "",
        topRisk: "",
        recommendedDirection: "",
      },
      finalSentence: "",
    };
  }
  return parseExecutiveSummaryResult(toolUse.input);
}
