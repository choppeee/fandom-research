import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";
import type { CommentSampleItem, Aggregates } from "./aggregate";
import type { IpTypeInfo } from "./ip-classify";
import { REPORT_MODE_GUIDE, type ReportMode } from "./report-mode";
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
  EDITORIAL_PASS_SCHEMA,
  parseEditorialPassResult,
  SITUATION_DIAGNOSIS_SCHEMA,
  parseSituationDiagnosis,
  EMPTY_SITUATION_DIAGNOSIS,
  type ModuleResult,
  type StrategyResult,
  type PositioningResult,
  type ExecutiveSummaryResult,
  type EditorialInsight,
  type SituationDiagnosis,
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

function ipTypeLine(ipType: IpTypeInfo): string {
  return `IP 유형: ${ipType.typeLabel} (대중은 "${ipType.audienceTerm}"으로, 정체성은 "${ipType.identityTerm}"으로 지칭하라)`;
}

function situationLine(situation: SituationDiagnosis): string {
  if (!situation.currentSituation) return "";
  return `\n현재 상태 진단: ${situation.currentSituation}
지금 가장 중요한 목적: ${situation.currentPriority}
핵심 질문: ${situation.keyQuestions.join(" / ")}
(이 진단에 맞는 발견을 우선하되, 기계적으로 모든 질문에 답하려 하지 마라. 데이터가 다른 것을 보여주면 그것을 따른다.)`;
}

const COMPRESSION_NOTE = `
반드시 도구 호출로만 답한다 (마크다운 텍스트 금지). 개수를 채우려고 약한 항목을 넣지 않는다.
결론을 먼저 선언하지 말고 관찰 -> 공통점 -> 차이 -> 의미 순서로 자연스러운 한국어 문단을 쓴다.
이론은 실제로 설명력이 높을 때만 표시한다. evidence_scope에 이 발견이 전체/일부 어디까지 적용되는지 밝힌다.
surface_expression/emotional_meaning/underlying_intent를 구분해서 채우되, underlying_intent는 근거 없이
상상하지 않는다(반복 맥락·함께 등장하는 표현·행동 신호로 뒷받침될 때만). possible_bottleneck은 실제로
반응과 성과 사이 단절이 반복 확인될 때만 채우고, 그렇지 않으면 생략한다 - 병목을 억지로 만들지 않는다.
decision은 실제로 판단이 필요할 때만 채우고, "문제 없음/현재 유지가 낫다"면 NO_CHANGE도 정당한 답이다.
evidence가 실제 댓글 인용이면 그 댓글의 comment_id를 evidence_ids에 담는다(제공된 샘플에 있는 것만,
지어내지 않는다). 요약 통계라 특정 댓글을 인용하지 않았으면 evidence_ids는 비워둔다.`;

/** 본격적인 모듈 분석 전에, 이 IP가 지금 어떤 상태에 있고 무엇을 우선 확인해야 하는지 정한다.
 * "모든 IP에 병목이 있다"고 가정하지 않기 위한 단계 - 문제가 없다면 그렇게 판단한다. */
export async function runSituationDiagnosis(params: {
  keyword: string;
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  stats: Aggregates;
  sample: CommentSampleItem[];
}): Promise<SituationDiagnosis> {
  const prompt = `분석 대상(IP): "${params.keyword}"
${ipTypeLine(params.ipType)}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}

본격적인 심층 분석에 들어가기 전에, 지금 데이터를 훑어보고 다음을 판단하라.
"이 IP는 지금 어떤 상태에 있는가?" — 미리 정해진 성장 단계 모델에 끼워맞추지 말고, 데이터가 보여주는
상태를 자연어로 설명하라. 발견 초기 단계일 수도, 이미 성공 공식을 확보한 단계일 수도, 특별한 문제 없이
현재 방향을 유지하는 게 나은 단계일 수도 있다. 문제나 병목을 찾아야 한다고 가정하지 마라 - 없으면 없다고
판단하는 것도 정당한 결론이다.

그다음 이번 데이터에서 가장 중요한 질문 1~3개를 고르고, 지금 가장 중요한 분석 목적 하나를 정하라.
반드시 도구 호출로만 답한다.

[집계 통계]
${JSON.stringify(
  { topKeywords: params.stats.topKeywords, sentimentRatio: params.stats.sentimentRatio, purchaseIntentSummary: params.stats.purchaseIntentSummary },
  null,
  2
)}

[대표 댓글/게시물 샘플 (${params.sample.length}건)]
${JSON.stringify(params.sample.slice(0, 40), null, 2)}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [SITUATION_DIAGNOSIS_SCHEMA],
    tool_choice: { type: "tool", name: "record_situation_diagnosis" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return EMPTY_SITUATION_DIAGNOSIS;
  return parseSituationDiagnosis(toolUse.input);
}

/** 앞서 만들어진 모듈들의 결과를 입력으로 받아 그 위에 종합 판단을 얹는 후속 모듈 (구조화 Insight 출력). */
export async function runInsightSynthesis(params: {
  title: string;
  instruction: string;
  keyword: string;
  periodStart: string;
  periodEnd: string;
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
  inputModulesText: string;
  maxTokens?: number;
}): Promise<ModuleResult> {
  const schema = moduleResultSchema("record_insights", `${params.title} 모듈의 구조화된 Insight를 기록한다.`);
  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
${ipTypeLine(params.ipType)}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}${situationLine(params.situation)}

이번에 작성할 모듈: ${params.title}
모듈 지침: ${params.instruction}
${COMPRESSION_NOTE}

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라. 여기 없는 사실을 새로 지어내지 않는다.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 6000,
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
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
  stats: Aggregates;
  sample: CommentSampleItem[];
}): Promise<{ title: string; result: ModuleResult }> {
  const platformGuide =
    params.platform === "youtube"
      ? "YouTube는 콘텐츠를 실제 시청한 이후 나타나는 반응이다. 장면, 행동, 관계성, 캐릭터에 대한 반응 중심으로 분석하라."
      : "X는 실시간 화제, 밈, 팬덤 내부 언어, 짤/클립 확산, 인용/재해석, 비팬 유입, 이슈 확산이 특징이다. 이런 성격 중심으로 분석하라.";
  const title = params.platform === "youtube" ? "YouTube에서는 무엇에 반응하는가" : "X(Twitter)에서는 무엇이 화제가 되는가";
  const schema = moduleResultSchema("record_insights", `${title} 모듈의 구조화된 Insight를 기록한다.`);

  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
${ipTypeLine(params.ipType)}
플랫폼: ${params.platform}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}${situationLine(params.situation)}

${platformGuide}
이 플랫폼 데이터만 근거로 이 플랫폼에서 나타나는 고유한 반응 성격 2~3개를 분석하라.
${COMPRESSION_NOTE}

[집계 통계]
${JSON.stringify({ topKeywords: params.stats.topKeywords, sentimentRatio: params.stats.sentimentRatio }, null, 2)}

[대표 게시물 샘플 (${params.sample.length}건)]
${JSON.stringify(params.sample, null, 2)}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 5000,
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
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
  inputModulesText: string;
}): Promise<PositioningResult> {
  const exploratoryNote =
    params.reportMode === "exploratory"
      ? `\n표본이 작은 EXPLORATORY 모드다. 확정적인 포지셔닝을 단정하지 마라. 근거가 뚜렷한 후보가 없으면
candidates를 비워두고 core/supporting/emerging에는 "현재 표본으로는 포지셔닝을 확정하기 이르다"는 취지를 써라.`
      : "";

  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
${ipTypeLine(params.ipType)}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}${situationLine(params.situation)}${exploratoryNote}

모든 분석 모듈을 종합해 Positioning 후보를 제안하라. 이미 명확하고 잘 작동하는 포지션이 있다면 억지로 새
후보를 만들지 말고 candidates를 비워도 된다(그 경우 core에 "현재 포지션을 유지·반복하는 것이 우선"이라고
쓴다). 새 후보를 제안할 때는 추상적 문장("소통을 강화해야 한다" 등) 금지, 반드시 "누구에게/어떤 상황에서/
어떤 포맷으로"까지 구체화하라. 결론부터 선언하지 말고 근거를 먼저 보여준 뒤 자연스럽게 이어라. 반드시
도구 호출로만 답한다.

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [POSITIONING_SCHEMA],
    tool_choice: { type: "tool", name: "record_positioning" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return { candidates: [], core: "", supporting: "", emerging: "" };
  return parsePositioningResult(toolUse.input);
}

/** 확정된 방향을 실행 판단으로 연결. KEEP/REPEAT/AMPLIFY/CLARIFY/TEST/EXPAND/CONNECT/PROTECT/
 * REFRAME/CORRECT/WATCH/AVOID/NO_CHANGE 중 실제 데이터에 맞는 것만 고른다. */
export async function runStrategySynthesis(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
  inputModulesText: string;
}): Promise<StrategyResult> {
  const exploratoryNote =
    params.reportMode === "exploratory"
      ? `\n표본이 작은 EXPLORATORY 모드다. KEEP/AMPLIFY/AVOID 같은 확정적 판단보다 WATCH/TEST 위주로 작성하고,
"대규모 실행"을 추천하지 마라.`
      : "";

  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
${ipTypeLine(params.ipType)}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}${situationLine(params.situation)}${exploratoryNote}

지금까지의 분석을 실행 판단으로 연결하라. 모든 IP에 문제가 있다고 가정하지 마라 - 현재 전략이 잘
작동하고 있다면 REPEAT/AMPLIFY/PROTECT/NO_CHANGE 위주로 나올 수도 있고, 반대로 실제 병목이 있다면
TEST/CORRECT/EXPAND가 중심이 될 수도 있다. 표현 하나가 반복됐다고 곧바로 상품·캠페인·신규 포맷을
만들라고 제안하지 않는다. 각 추천은 다음 순서로 사고한다(라벨을 그대로 노출하지 않고 자연스러운
문단으로 통합): 무엇을 발견했는가 -> 왜 중요한가 -> 어떤 가능성이 있는가 -> 아직 무엇을 모르는가 ->
가장 낮은 비용으로 무엇을 먼저 확인할 것인가. 그리고 어떤 결과가 나오면 확대하고 어떤 결과가 나오면
중단할지(decision_rule)를 구체적으로 밝힌다. 이미 잘 작동하는 강점을 더 확대하자는 추천(AMPLIFY)이
있다면, 그 확대가 만들 수 있는 부작용도 insight나 opportunity 문단 안에서 함께 짚어라(지속가능성, 다른
정체성을 가릴 위험, 진입장벽 등). 우선순위에 들지 못한 아이디어는 appendix_ideas에 한 줄씩만 담아라.
반드시 도구 호출로만 답한다.

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [STRATEGY_SCHEMA],
    tool_choice: { type: "tool", name: "record_strategy" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return { recommendations: [], appendixIdeas: [] };
  return parseStrategyResult(toolUse.input);
}

/** Top 5 Findings + IP at a Glance. editorial pass 이후, 모든 모듈이 끝난 뒤 마지막에 생성한다. */
export async function runExecutiveSummarySynthesis(params: {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
  inputModulesText: string;
}): Promise<ExecutiveSummaryResult> {
  const exploratoryNote =
    params.reportMode === "exploratory"
      ? `\n표본이 작은 EXPLORATORY 모드다. finding들과 ip_at_glance 모두 "현재 표본에서 발견된 후보" 수준으로
절제해서 쓰고, 확정적 포지셔닝 단언을 피하라.`
      : "";

  const prompt = `분석 대상(IP): "${params.keyword}" (${params.periodStart} ~ ${params.periodEnd})
${ipTypeLine(params.ipType)}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}${situationLine(params.situation)}${exploratoryNote}

모든 모듈을 종합해 가장 중요한 전략적 발견 정확히 5개(findings)와 IP at a Glance(현재 우선순위 -> 핵심
매력 -> Hidden Value -> 가장 큰 Opportunity -> 가장 큰 Risk -> 추천 방향)를 기록하라. 이것만 읽어도
사람들이 무엇을 좋아하는지, 왜 좋아하는지, 무엇을 섣불리 하면 안 되는지, 다음에 무엇을 확인해야 하는지
알 수 있어야 한다. 특별한 문제가 없다면 top_risk에 "특별히 두드러지는 리스크는 확인되지 않음"이라고
정직하게 써도 된다 - 억지로 리스크를 만들지 않는다. 각 finding은 결론부터 선언하지 말고 대표 근거를
먼저 보여준다. final_sentence는 정확히 "이 IP는 ______로 포지셔닝해야 한다." 형식으로 채워라. 반드시
도구 호출로만 답한다.

아래는 이미 완료된 앞선 분석 모듈들이다. 이 내용을 근거로만 삼아 작성하라.

${params.inputModulesText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
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
  const result = parseExecutiveSummaryResult(toolUse.input);
  return { ...result, currentSituation: params.situation.currentSituation || undefined };
}

/** Editorial Rewrite Pass — 전체 모듈의 insight를 한 번에 검토해 중복을 제거하고,
 * "실제 반응을 오래 들여다본 사람"의 자연스러운 한국어로 재작성한다.
 * analyst 단계(runAnalysisModule 등)가 사실/패턴을 뽑아내는 1차 초안이라면,
 * 이 단계가 최종적으로 사람이 읽는 글로 편집하는 단계이자 Self-Critique(Editorial Review)
 * 단계다: 억지 병목이 만들어지지 않았는지, 표면 요구를 그대로 전략으로 옮기지 않았는지,
 * 결론의 적용 범위가 명확한지 검수한다. */
export async function runEditorialPass(params: {
  keyword: string;
  ipType: IpTypeInfo;
  reportMode: ReportMode;
  situation: SituationDiagnosis;
  insights: EditorialInsight[];
}): Promise<EditorialInsight[]> {
  if (params.insights.length === 0) return [];

  const inputText = params.insights
    .map(
      (i, idx) =>
        `[${idx}] module_key=${i.moduleKey}
headline: ${i.headline}
interpretation: ${i.interpretation}
evidence: ${i.evidence.join(" / ")}
evidence_ids: ${i.evidenceIds.join(", ")}
evidence_scope: ${i.evidenceScope}
surface_expression: ${i.surfaceExpression}
emotional_meaning: ${i.emotionalMeaning}
underlying_intent: ${i.underlyingIntent}
why_it_matters: ${i.whyItMatters}
strategic_implication: ${i.strategicImplication}
confidence: ${i.confidence}${i.decision ? `\ndecision: ${i.decision}` : ""}${
          i.possibleBottleneck ? `\npossible_bottleneck: ${i.possibleBottleneck.type} (${i.possibleBottleneck.evidence})` : ""
        }${i.amplificationRisk ? `\namplification_risk: ${i.amplificationRisk}` : ""}${
          i.strategicReframe ? `\nstrategic_reframe: ${i.strategicReframe}` : ""
        }${i.theory ? `\ntheory: ${i.theory}` : ""}`
    )
    .join("\n\n");

  const exploratoryNote =
    params.reportMode === "exploratory"
      ? `\n표본이 작은 EXPLORATORY 모드다. 모든 insight의 톤을 "현재 표본에서 발견된 후보" 수준으로 낮추고,
확정적 단언이 있으면 완화하라.`
      : "";

  const prompt = `분석 대상(IP): "${params.keyword}"
${ipTypeLine(params.ipType)}
리포트 모드: ${params.reportMode.toUpperCase()} — ${REPORT_MODE_GUIDE[params.reportMode]}${situationLine(params.situation)}${exploratoryNote}

아래는 여러 분석 모듈에서 나온 1차 초안 insight들이다(번호가 붙어 있음). 너의 역할은 애널리스트가 아니라
편집자 겸 검수자다. 다음을 수행하라:

1. 중복 제거 — 같은 발견이 여러 모듈에서 표현만 바꿔 반복되면, 가장 적합한 module_key 하나에만 남기고
   나머지는 결과에서 뺀다(같은 증거를 다시 설명해야 할 경우 장황하게 반복하지 말고 한 문장으로만 연결한다).
2. 재작성 — 시스템 프롬프트의 WRITING STYLE 규칙을 적용해 모든 문장을 "실제 반응을 오래 들여다본 사람이
   설명하는" 자연스러운 한국어로 다시 쓴다. 결론을 먼저 선언하지 않고, 상투어를 쓰지 않고, 전문 용어를
   먼저 던지지 않고, IP 유형에 맞는 언어를 쓴다. interpretation은 관찰 -> 공통점 -> 차이 -> 의미 순서로
   자연스럽게 이어지는 문단이어야 한다.
3. Self-Critique 검수 — 아래 항목을 각 insight에 적용하고, 하나라도 위반하면 그 부분을 고친다:
   - 문제를 찾으려고 억지로 병목을 만들지 않았는가 (possible_bottleneck이 근거 없이 붙어 있으면 뺀다)
   - 표면 표현(surface_expression)을 실제 의도(underlying_intent)로 그대로 옮기지 않았는가 (예: "더
     자주 올려주세요" -> 무조건 "제작량을 늘려야 한다"로 비약하지 않았는가)
   - decision이 근거보다 앞서 나가지 않았는가, 그리고 문제가 없다면 NO_CHANGE로 정직하게 표시했는가
   - amplification_risk가 필요한데(강점을 더 키우자는 내용인데) 비어 있지 않은가
   - evidence_scope와 결론의 적용 범위가 정직한가(소수 사례를 전체로 확대하지 않았는가)
4. 절제 — 근거보다 앞서 나가는 결론이나 실행 제안이 있으면 완화한다.
5. evidence_ids 보존 — 인용한 댓글이 가리키는 대상이 바뀌지 않는 한, 원본 insight의 evidence_ids를
   그대로 유지한다. 두 insight를 병합하면 두 evidence_ids를 합친다. 입력에 없던 새 comment_id를
   만들어내지 않는다(입력에 있는 evidence_ids 값만 사용 가능).

원본 개수보다 같거나 적은 개수로 반환하라(병합/삭제는 가능, 새 insight를 지어내지 않는다). 반드시 도구
호출로만 답한다.

[1차 초안 insights]
${inputText}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    tools: [EDITORIAL_PASS_SCHEMA],
    tool_choice: { type: "tool", name: "record_editorial_pass" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return params.insights; // 실패 시 1차 초안을 그대로 사용 (편집 실패가 리포트 자체를 막지 않게)
  const edited = parseEditorialPassResult(toolUse.input);
  return edited.length > 0 ? edited : params.insights;
}
