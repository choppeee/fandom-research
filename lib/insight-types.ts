/** 모든 분석 모듈이 공유하는 구조화 출력 타입 + tool-use 스키마.
 * 자유 마크다운 대신 headline/interpretation/evidence/decision을 분리해서
 * PDF의 Insight Page(60/40 split + evidence card)에 그대로 매핑한다.
 * 문장 자체는 analyst 단계에서 1차로 쓰이고, editorial 단계(runEditorialPass)에서
 * 중복 제거 + 사람이 읽는 자연스러운 한국어로 재작성된다.
 *
 * 이 리포트의 목적은 모든 IP에서 문제/병목을 찾아내는 게 아니라, 대중이 실제로 무엇에
 * 반응했는지 읽고 표면 표현과 실제 의도를 구분한 뒤, 지금 가장 중요한 판단이 무엇인지
 * 찾아 근거로 납득시키는 것이다. 병목은 여러 진단 중 하나일 뿐이고, "현재 유지가 낫다"는
 * 결론도 정당한 결과다. */

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** 실행 판단 13종. 모든 리포트가 이 전부를 쓰지 않는다 - 실제 데이터에 맞는 것만 고른다. */
export type DecisionType =
  | "KEEP" // 현재 잘 작동하는 요소를 유지
  | "REPEAT" // 성공 조건을 반복 재현
  | "AMPLIFY" // 이미 검증된 장점을 더 넓게 노출
  | "CLARIFY" // 무엇으로 기억해야 하는지 더 명확히
  | "TEST" // 가능성은 있으나 작은 실험 필요
  | "EXPAND" // 새로운 타깃·채널·상황으로 확장
  | "CONNECT" // 관심 이후 다음 행동으로 넘어가는 동선
  | "PROTECT" // 강한 자산이 훼손되지 않도록 관리
  | "REFRAME" // 대중의 표현을 더 건강하고 지속 가능한 포지션으로 번역
  | "CORRECT" // 잘못된 인식/정보 혼선 바로잡기
  | "WATCH" // 의미 있는 초기 신호, 아직 관찰 필요
  | "AVOID" // 현재 근거로는 실행 금지
  | "NO_CHANGE"; // 새 전략보다 기존 방향 유지가 합리적

export type BottleneckType =
  | "Awareness"
  | "Discovery"
  | "Understanding"
  | "Access"
  | "Trust"
  | "Conversion"
  | "Retention"
  | "Advocacy"
  | "ProductQuality"
  | "Positioning"
  | "Continuity";

export type PossibleBottleneck = { type: BottleneckType; evidence: string; confidence: Confidence };

export type StructuredInsight = {
  headline: string;
  interpretation: string;
  evidence: string[];
  evidenceScope: string; // 이 발견이 전체 표본에 적용되는지, 특정 콘텐츠/세그먼트에 한정되는지
  // 표면 표현 -> 감정 -> 실제 의도 4계층 (사람들이 쓴 말을 그대로 전략으로 옮기지 않기 위함)
  surfaceExpression: string; // 사람들이 실제로 사용한 말
  emotionalMeaning: string; // 그 말에 담긴 감정
  underlyingIntent: string; // 실제로 원하는 것 (근거 없이 상상하지 않는다)
  whyItMatters: string;
  strategicImplication: string;
  confidence: Confidence;
  decision?: DecisionType; // 실행 판단이 필요한 발견에만
  possibleBottleneck?: PossibleBottleneck; // 실제 병목이 확인될 때만 (없으면 필드 자체를 비운다)
  amplificationRisk?: string; // 이 강점을 그대로 확대했을 때의 부작용 (강점 관련 발견에만)
  strategicReframe?: string; // 원초적 표현 -> 건강한 상위 언어로 번역 (해당할 때만)
  alternativeInterpretation?: string; // 검토했던 다른 해석 후보 (있을 때만)
  interpretationReason?: string; // 왜 채택한 해석이 더 설득력 있는지 (다른 해석을 검토했을 때만)
  theory?: string;
};

export type ModuleResult = {
  applicable: boolean;
  notApplicableReason: string;
  insights: StructuredInsight[];
};

export const EMPTY_MODULE_RESULT: ModuleResult = {
  applicable: false,
  notApplicableReason: "",
  insights: [],
};

const DECISION_ENUM = [
  "KEEP",
  "REPEAT",
  "AMPLIFY",
  "CLARIFY",
  "TEST",
  "EXPAND",
  "CONNECT",
  "PROTECT",
  "REFRAME",
  "CORRECT",
  "WATCH",
  "AVOID",
  "NO_CHANGE",
  "",
] as const;

const BOTTLENECK_TYPE_ENUM = [
  "Awareness",
  "Discovery",
  "Understanding",
  "Access",
  "Trust",
  "Conversion",
  "Retention",
  "Advocacy",
  "ProductQuality",
  "Positioning",
  "Continuity",
] as const;

export const INSIGHT_ITEM_SCHEMA = {
  type: "object" as const,
  properties: {
    headline: {
      type: "string" as const,
      description:
        '독자가 실제 반응을 오래 들여다본 사람이 짚어주는 것처럼 느끼는 구체적인 한 문장. "~로 인식된다/판단된다"처럼 결론을 선언하지 않는다. 대상의 모습이 그려지는 표현일수록 좋다.',
    },
    interpretation: {
      type: "string" as const,
      description:
        "가장 먼저 눈에 띄는 구체적 반응 -> 반복되는 공통점 -> 예상과 실제의 차이 -> 그 차이가 의미하는 것 -> 이 해석의 적용 범위(전체인지 일부인지) 순서로 자연스럽게 이어지는 한국어 문단. 100~180단어(한국어 약 200~350자). Observation/Interpretation 같은 영문 라벨이나 형식어를 쓰지 않는다.",
    },
    evidence: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2~4개. 각각 짧은 댓글 인용, 반복 횟수, engagement(좋아요 등), 또는 수치 하나. 문장이 아니라 짧은 근거 조각.",
    },
    evidence_scope: {
      type: "string" as const,
      description:
        '이 발견이 어디까지 유효한지 한국어 짧은 문구로. 예: "전체 표본에서 반복 확인", "특정 영상 1건에 편중", "신규 유입 세그먼트에 한정", "표본이 작아 후보 수준"',
    },
    surface_expression: {
      type: "string" as const,
      description: "사람들이 실제로 사용한 말 그대로 (짧은 인용이나 요약). 해석하지 말고 표면적으로 무엇을 말했는지만.",
    },
    emotional_meaning: {
      type: "string" as const,
      description: "그 표현에 담긴 감정 (예: 그리움, 안도, 놀라움, 답답함). 짧게.",
    },
    underlying_intent: {
      type: "string" as const,
      description:
        "표면 표현 너머 실제로 원하는 것. 반복 맥락·함께 등장하는 표현·행동 신호·비교 반응 등 근거가 있을 때만 채우고, 근거 없이 마음대로 상상하지 않는다.",
    },
    why_it_matters: { type: "string" as const, description: "이 발견이 왜 중요한지, 형식어 없이 자연스러운 한 문장" },
    strategic_implication: {
      type: "string" as const,
      description:
        '그래서 무엇을 유지/검증/관찰해야 하는지 자연스러운 한국어로 2~4문장. "전략적 의미:" 같은 라벨을 붙이지 않는다. 근거보다 앞서 나가는 실행 제안(제품 출시, 캠페인 등)을 바로 던지지 않는다.',
    },
    confidence: {
      type: "string" as const,
      enum: ["HIGH", "MEDIUM", "LOW"],
      description: "데이터가 직접 뒷받침하면 HIGH, 반복 패턴은 있으나 제한적이면 MEDIUM, 소수 사례 추정이면 LOW",
    },
    decision: {
      type: "string" as const,
      enum: DECISION_ENUM,
      description:
        "실행 판단이 필요한 발견에만 채운다(그렇지 않으면 빈 문자열). KEEP/REPEAT/AMPLIFY/CLARIFY/TEST/EXPAND/CONNECT/PROTECT/REFRAME/CORRECT/WATCH/AVOID/NO_CHANGE 중 실제 데이터에 맞는 것 하나. 모든 리포트가 같은 값을 쓸 필요 없다. 문제가 없으면 NO_CHANGE도 정당한 답이다.",
    },
    possible_bottleneck: {
      type: "object" as const,
      description:
        "실제로 반응과 성과 사이 단절이 반복 확인되고, 다른 설명보다 병목 해석이 더 설득력 있을 때만 채운다. 그렇지 않으면 이 필드 자체를 생략한다(억지로 병목을 만들지 않는다).",
      properties: {
        type: { type: "string" as const, enum: BOTTLENECK_TYPE_ENUM },
        evidence: { type: "string" as const },
        confidence: { type: "string" as const, enum: ["HIGH", "MEDIUM", "LOW"] },
      },
      required: ["type", "evidence", "confidence"],
    },
    amplification_risk: {
      type: "string" as const,
      description:
        "이 강점을 그대로 확대했을 때 생길 수 있는 부작용(지속가능성, 다른 정체성을 가림, 진입장벽 등). 강점 관련 발견에만, 해당 없으면 생략.",
    },
    strategic_reframe: {
      type: "string" as const,
      description:
        '대중의 원초적 표현을 더 건강하고 지속 가능한 상위 언어로 번역 (예: "불쌍하다" -> "준비된 저평가 실력자"). 원초적 표현이 실제 위험 신호라면 억지로 포장하지 않는다. 해당 없으면 생략.',
    },
    alternative_interpretation: {
      type: "string" as const,
      description: "채택하지 않은 다른 해석 후보. 검토했을 때만 채우고, 아니면 생략.",
    },
    interpretation_reason: {
      type: "string" as const,
      description: "다른 해석보다 채택한 해석이 더 설득력 있는 이유. alternative_interpretation을 채웠을 때만.",
    },
    theory: {
      type: "string" as const,
      description:
        "실제로 설명력이 높을 때만, 이미 평이한 한국어로 현상을 설명한 뒤 보조 근거로 붙이는 이론명 1개(선택, 없으면 생략). 이론 이름을 먼저 던지지 않는다.",
    },
  },
  required: [
    "headline",
    "interpretation",
    "evidence",
    "evidence_scope",
    "surface_expression",
    "emotional_meaning",
    "underlying_intent",
    "why_it_matters",
    "strategic_implication",
    "confidence",
  ],
};

export function moduleResultSchema(toolName: string, description: string) {
  return {
    name: toolName,
    description,
    input_schema: {
      type: "object" as const,
      properties: {
        applicable: { type: "boolean" as const, description: "이 모듈이 이번 IP 유형/데이터에 실제로 적용 가능하면 true" },
        not_applicable_reason: {
          type: "string" as const,
          description: "applicable=false일 때만 1~2문장으로 이유. applicable=true면 빈 문자열.",
        },
        insights: {
          type: "array" as const,
          items: INSIGHT_ITEM_SCHEMA,
          description: "핵심 Insight만 선별. 개수보다 질. 보통 2~4개.",
        },
      },
      required: ["applicable", "not_applicable_reason", "insights"],
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBottleneck(b: any): PossibleBottleneck | undefined {
  if (!b || !b.type) return undefined;
  return { type: b.type as BottleneckType, evidence: b.evidence ?? "", confidence: (b.confidence ?? "MEDIUM") as Confidence };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInsight(i: any): StructuredInsight {
  return {
    headline: i.headline ?? "",
    interpretation: i.interpretation ?? "",
    evidence: Array.isArray(i.evidence) ? i.evidence : [],
    evidenceScope: i.evidence_scope ?? "",
    surfaceExpression: i.surface_expression ?? "",
    emotionalMeaning: i.emotional_meaning ?? "",
    underlyingIntent: i.underlying_intent ?? "",
    whyItMatters: i.why_it_matters ?? "",
    strategicImplication: i.strategic_implication ?? "",
    confidence: (i.confidence ?? "MEDIUM") as Confidence,
    decision: (i.decision || undefined) as DecisionType | undefined,
    possibleBottleneck: parseBottleneck(i.possible_bottleneck),
    amplificationRisk: i.amplification_risk || undefined,
    strategicReframe: i.strategic_reframe || undefined,
    alternativeInterpretation: i.alternative_interpretation || undefined,
    interpretationReason: i.interpretation_reason || undefined,
    theory: i.theory || undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseModuleResult(input: any): ModuleResult {
  return {
    applicable: Boolean(input?.applicable),
    notApplicableReason: input?.not_applicable_reason ?? "",
    insights: (input?.insights ?? []).map(parseInsight),
  };
}

// ---------------------------------------------------------------------------
// content_md 컬럼에 저장되는 태그드 유니언 (신규 구조화 모듈 vs 구버전 자유 마크다운 구분용)
// ---------------------------------------------------------------------------

export type StoredModuleContent =
  | { kind: "insights"; data: ModuleResult }
  | { kind: "strategy"; data: StrategyResult }
  | { kind: "positioning"; data: PositioningResult }
  | { kind: "executive_summary"; data: ExecutiveSummaryResult };

export function wrapStoredContent(content: StoredModuleContent): string {
  return JSON.stringify(content);
}

/** content_md 컬럼 값이 신규 태그드 JSON이면 파싱해서 반환, 구버전 자유 마크다운이면 null. */
export function parseStoredModuleContent(raw: string): StoredModuleContent | null {
  if (!raw || !raw.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.kind === "string" && parsed.data) return parsed as StoredModuleContent;
    return null;
  } catch {
    return null;
  }
}

export const DECISION_KO: Record<DecisionType, string> = {
  KEEP: "유지",
  REPEAT: "반복",
  AMPLIFY: "확대",
  CLARIFY: "명확화",
  TEST: "테스트",
  EXPAND: "확장",
  CONNECT: "연결",
  PROTECT: "보호",
  REFRAME: "재정의",
  CORRECT: "교정",
  WATCH: "관찰",
  AVOID: "보류",
  NO_CHANGE: "현행 유지",
};

const BOTTLENECK_KO: Record<BottleneckType, string> = {
  Awareness: "인지 부족",
  Discovery: "발견 경로 부족",
  Understanding: "이해 어려움",
  Access: "접근/이용 불편",
  Trust: "신뢰 부족",
  Conversion: "행동 전환 약함",
  Retention: "재방문 유인 부족",
  Advocacy: "공유/추천 소재 부족",
  ProductQuality: "결과물 품질",
  Positioning: "포지셔닝 불명확",
  Continuity: "후속 접점 부족",
};

/** job 상세 화면의 인라인 미리보기(summary_text)용으로 저장된 구조화 콘텐츠를 마크다운으로 변환.
 * 구버전 자유 마크다운이면 그대로 반환한다(하위호환). */
export function renderStoredContentToMarkdown(title: string, rawContentMd: string): string {
  const parsed = parseStoredModuleContent(rawContentMd);
  if (!parsed) return rawContentMd; // 레거시 자유 마크다운

  if (parsed.kind === "insights") {
    const r = parsed.data;
    if (!r.applicable) return `## ${title}\n\n${r.notApplicableReason || "이번 데이터/IP 유형에는 적용하기 어렵습니다."}`;
    const body = r.insights
      .map((i) => {
        const tag = i.decision ? ` · ${DECISION_KO[i.decision]}` : "";
        const bottleneck = i.possibleBottleneck
          ? `\n\n병목 후보: ${BOTTLENECK_KO[i.possibleBottleneck.type]} (${i.possibleBottleneck.evidence})`
          : "";
        return `### ${i.headline}

${i.interpretation}

${i.whyItMatters} ${i.strategicImplication}${bottleneck}

_근거: ${i.evidence.join(" · ")} (${i.evidenceScope}) · 확신도 ${i.confidence}${tag}${i.theory ? ` · ${i.theory}` : ""}_`;
      })
      .join("\n\n");
    return `## ${title}\n\n${body}`;
  }

  if (parsed.kind === "positioning") {
    const p = parsed.data;
    const candidates = p.candidates
      .map(
        (c) => `- **${c.positioning}** — Audience Need: ${c.audienceNeed} / 근거: ${c.evidence} / 심리적 매력: ${c.psychologicalAppeal} / 차별성: ${c.differentiation} / 리스크: ${c.risk}`
      )
      .join("\n");
    return `## ${title}\n\n${candidates}\n\n**CORE POSITION:** ${p.core}\n**SUPPORTING POSITION:** ${p.supporting}\n**EMERGING POSITION:** ${p.emerging}`;
  }

  if (parsed.kind === "strategy") {
    const s = parsed.data;
    const rows = s.recommendations
      .map(
        (r) => `### [${DECISION_KO[r.decision]}] ${r.title} (확신도: ${r.confidence})
${r.insight} ${r.opportunity}

검증: ${r.test}
중단/확대 기준: ${r.decisionRule}`
      )
      .join("\n\n");
    const appendix = s.appendixIdeas.length ? `\n\n**Appendix Ideas**\n${s.appendixIdeas.map((i) => `- ${i}`).join("\n")}` : "";
    return `## ${title}\n\n${rows}${appendix}`;
  }

  if (parsed.kind === "executive_summary") {
    const e = parsed.data;
    const findings = e.findings
      .map((f, i) => {
        const tag = f.decision ? ` · 권고: ${DECISION_KO[f.decision]}` : "";
        return `**${String(i + 1).padStart(2, "0")}. ${f.headline}**\n근거: ${f.evidence}\n${f.implication}${tag}`;
      })
      .join("\n\n");
    return `## ${title}

${e.currentSituation ? `현재 상태: ${e.currentSituation}\n\n` : ""}${findings}

### IP at a Glance
- 현재 우선순위: ${e.ipAtGlance.currentPosition}
- 핵심 매력: ${e.ipAtGlance.coreAppeal}
- Hidden Value: ${e.ipAtGlance.hiddenValue}
- 가장 큰 Opportunity: ${e.ipAtGlance.topOpportunity}
- 가장 큰 Risk: ${e.ipAtGlance.topRisk}
- 추천 방향: ${e.ipAtGlance.recommendedDirection}

${e.finalSentence}`;
  }

  return rawContentMd;
}

/** 이전 단계 모듈들을 다음 LLM 호출의 컨텍스트로 넣기 위한 사람이 읽을 수 있는 텍스트 변환. */
export function moduleResultToPromptText(title: string, result: ModuleResult): string {
  if (!result.applicable) return `--- ${title} ---\n(적용 어려움: ${result.notApplicableReason})`;
  const body = result.insights
    .map(
      (i, idx) =>
        `[Insight ${idx + 1}] ${i.headline}\n해석: ${i.interpretation}\n근거: ${i.evidence.join(" / ")} (범위: ${i.evidenceScope})\n표면 표현: ${i.surfaceExpression} / 실제 의도: ${i.underlyingIntent}\n왜 중요한가: ${i.whyItMatters}\n전략적 함의: ${i.strategicImplication}\n확신도: ${i.confidence}${i.decision ? ` · 판단: ${i.decision}` : ""}${i.theory ? ` (이론: ${i.theory})` : ""}`
    )
    .join("\n\n");
  return `--- ${title} ---\n${body}`;
}

// ---------------------------------------------------------------------------
// Strategy (Insight -> Opportunity -> Test -> Decision Rule)
// ---------------------------------------------------------------------------

export type StrategyRecommendation = {
  decision: DecisionType;
  title: string;
  insight: string;
  opportunity: string;
  test: string;
  decisionRule: string;
  confidence: Confidence;
};

export type StrategyResult = {
  recommendations: StrategyRecommendation[];
  appendixIdeas: string[];
};

const STRATEGY_DECISION_ENUM = DECISION_ENUM.filter((v) => v !== "");

export const STRATEGY_SCHEMA = {
  name: "record_strategy",
  description: "데이터 근거 -> 실행 판단까지 단계적으로 분리한 전략 추천을 기록한다. 데이터만으로 바로 대규모 실행을 추천하지 않는다.",
  input_schema: {
    type: "object" as const,
    properties: {
      recommendations: {
        type: "array" as const,
        description:
          "실제 데이터에 맞는 판단만 선택한다. 모든 리포트에 같은 판단 조합을 억지로 채우지 않는다 (특별한 문제가 없다면 NO_CHANGE/KEEP/REPEAT 위주로만 나올 수도 있다).",
        items: {
          type: "object" as const,
          properties: {
            decision: {
              type: "string" as const,
              enum: STRATEGY_DECISION_ENUM,
              description: "KEEP/REPEAT/AMPLIFY/CLARIFY/TEST/EXPAND/CONNECT/PROTECT/REFRAME/CORRECT/WATCH/AVOID/NO_CHANGE 중 하나",
            },
            title: { type: "string" as const, description: "사람의 언어로 된 한 줄 제목 (영문 라벨이나 딱딱한 명사형 금지)" },
            insight: {
              type: "string" as const,
              description: "실제 데이터에서 무엇을 발견했는지와 그것이 왜 중요한지를 자연스러운 한국어 문단으로 (형식어 없이)",
            },
            opportunity: { type: "string" as const, description: "어떤 가능성이 열리는지, 근거보다 앞서가지 않게 절제해서 1~2문장" },
            test: {
              type: "string" as const,
              description: "가장 낮은 비용으로 무엇을 먼저 확인할 것인지 구체적으로. KEEP/NO_CHANGE/AVOID인 경우 왜 지금 추가 검증이 필요 없는지/실행하면 안 되는지로 대체 가능",
            },
            decision_rule: {
              type: "string" as const,
              description: "어떤 결과가 나오면 확대하고 어떤 결과가 나오면 중단할 것인지 구체적 기준 1문장",
            },
            confidence: { type: "string" as const, enum: ["HIGH", "MEDIUM", "LOW"] },
          },
          required: ["decision", "title", "insight", "opportunity", "test", "decision_rule", "confidence"],
        },
      },
      appendix_ideas: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "우선순위에 들지 못한 나머지 아이디어. 한 줄씩만.",
      },
    },
    required: ["recommendations", "appendix_ideas"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseStrategyResult(input: any): StrategyResult {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recommendations: (input?.recommendations ?? []).map((r: any) => ({
      decision: (r.decision ?? "WATCH") as DecisionType,
      title: r.title ?? "",
      insight: r.insight ?? "",
      opportunity: r.opportunity ?? "",
      test: r.test ?? "",
      decisionRule: r.decision_rule ?? "",
      confidence: (r.confidence ?? "MEDIUM") as Confidence,
    })),
    appendixIdeas: input?.appendix_ideas ?? [],
  };
}

// ---------------------------------------------------------------------------
// Positioning candidates
// ---------------------------------------------------------------------------

export type PositioningCandidate = {
  positioning: string;
  audienceNeed: string;
  evidence: string;
  psychologicalAppeal: string;
  differentiation: string;
  risk: string;
};

export type PositioningResult = {
  candidates: PositioningCandidate[];
  core: string;
  supporting: string;
  emerging: string;
};

export const POSITIONING_SCHEMA = {
  name: "record_positioning",
  description: "Positioning 후보와 최종 CORE/SUPPORTING/EMERGING 포지션을 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array" as const,
        description: "3~5개. 이미 명확한 포지션이 있고 새 후보가 불필요하면 비워도 된다.",
        items: {
          type: "object" as const,
          properties: {
            positioning: { type: "string" as const },
            audience_need: { type: "string" as const },
            evidence: { type: "string" as const },
            psychological_appeal: { type: "string" as const },
            differentiation: { type: "string" as const },
            risk: { type: "string" as const },
          },
          required: ["positioning", "audience_need", "evidence", "psychological_appeal", "differentiation", "risk"],
        },
      },
      core: { type: "string" as const, description: "CORE POSITION - 가장 강하게 가져가야 하는 중심 포지션 (1~2문장, 구체적으로)" },
      supporting: { type: "string" as const, description: "SUPPORTING POSITION (1~2문장)" },
      emerging: { type: "string" as const, description: "EMERGING POSITION (1~2문장)" },
    },
    required: ["candidates", "core", "supporting", "emerging"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePositioningResult(input: any): PositioningResult {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    candidates: (input?.candidates ?? []).map((c: any) => ({
      positioning: c.positioning ?? "",
      audienceNeed: c.audience_need ?? "",
      evidence: c.evidence ?? "",
      psychologicalAppeal: c.psychological_appeal ?? "",
      differentiation: c.differentiation ?? "",
      risk: c.risk ?? "",
    })),
    core: input?.core ?? "",
    supporting: input?.supporting ?? "",
    emerging: input?.emerging ?? "",
  };
}

// ---------------------------------------------------------------------------
// Situation Diagnosis — 모듈 분석 전에 먼저 "지금 이 IP는 어떤 상태인가"와
// "지금 가장 중요한 질문/목적은 무엇인가"를 정한다 (병목 찾기를 기본값으로 두지 않기 위함).
// ---------------------------------------------------------------------------

export type SituationDiagnosis = {
  currentSituation: string; // 지금 이 IP가 어떤 상태에 있는지 자연어 설명 (미리 정해진 성장단계 모델에 끼워맞추지 않음)
  keyQuestions: string[]; // 이번 데이터에서 가장 중요한 질문 1~3개
  currentPriority: string; // 지금 가장 중요한 분석 목적
};

export const SITUATION_DIAGNOSIS_SCHEMA = {
  name: "record_situation_diagnosis",
  description: "본격적인 모듈 분석 전에, 이 IP가 지금 어떤 상태에 있고 무엇을 우선 확인해야 하는지 정한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      current_situation: {
        type: "string" as const,
        description:
          '지금 데이터가 보여주는 상태를 자연어로 설명 (2~4문장). 예: "발견이 막 시작되는 단계", "호감은 높지만 행동 전환은 약한 단계", "이미 성공 공식을 확보한 단계", "특별한 문제 없이 현재 방향을 유지하는 게 나은 단계" 등. 미리 정해진 하나의 성장 모델에 억지로 끼워맞추지 않는다. 왜 그렇게 판단했는지 근거도 함께.',
      },
      key_questions: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "이번 데이터에서 가장 중요한 질문 1~3개. 모든 리포트에 같은 질문을 기계적으로 쓰지 않는다.",
      },
      current_priority: {
        type: "string" as const,
        description:
          '지금 가장 중요한 분석 목적 한 문장. 예: "왜 만족도가 높은데 신규 유입이 적은지 찾기", "현재 성공 공식이 재현 가능한 조건인지 설명하기", "오해나 리스크를 관리하기"',
      },
    },
    required: ["current_situation", "key_questions", "current_priority"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSituationDiagnosis(input: any): SituationDiagnosis {
  return {
    currentSituation: input?.current_situation ?? "",
    keyQuestions: Array.isArray(input?.key_questions) ? input.key_questions : [],
    currentPriority: input?.current_priority ?? "",
  };
}

export const EMPTY_SITUATION_DIAGNOSIS: SituationDiagnosis = { currentSituation: "", keyQuestions: [], currentPriority: "" };

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

export type ExecFinding = {
  headline: string;
  evidence: string;
  implication: string;
  decision?: DecisionType;
  confidence?: Confidence;
};
export type IpAtGlance = {
  currentPosition: string;
  coreAppeal: string;
  hiddenValue: string;
  topOpportunity: string;
  topRisk: string;
  recommendedDirection: string;
};
export type ExecutiveSummaryResult = {
  findings: ExecFinding[];
  ipAtGlance: IpAtGlance;
  finalSentence: string;
  currentSituation?: string;
};

export const EXECUTIVE_SUMMARY_SCHEMA = {
  name: "record_executive_summary",
  description: "전체 리포트를 압축한 Top 5 Findings와 IP at a Glance 요약을 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      findings: {
        type: "array" as const,
        description: "정확히 5개. 가장 중요한 전략적 발견 순서로.",
        items: {
          type: "object" as const,
          properties: {
            headline: {
              type: "string" as const,
              description: '기억에 남는 구체적인 한 문장. "~로 인식된다"처럼 결론만 선언하지 않는다.',
            },
            evidence: { type: "string" as const, description: "이 결론을 만든 대표 근거 (숫자나 댓글 1개, 짧게)" },
            implication: { type: "string" as const, description: "왜 이 차이가 중요한지 1~2문장, 자연스러운 한국어로" },
            decision: {
              type: "string" as const,
              enum: DECISION_ENUM,
              description: "현재 권고 수준. 실행 판단이 필요 없는 순수 인식 발견이면 빈 문자열.",
            },
            confidence: { type: "string" as const, enum: ["HIGH", "MEDIUM", "LOW"] },
          },
          required: ["headline", "evidence", "implication", "confidence"],
        },
      },
      ip_at_glance: {
        type: "object" as const,
        properties: {
          current_position: { type: "string" as const, description: "현재 우선순위/포지션 (1문장)" },
          core_appeal: { type: "string" as const, description: "핵심 매력 (1문장)" },
          hidden_value: { type: "string" as const, description: "Hidden Value (1문장)" },
          top_opportunity: { type: "string" as const, description: "가장 큰 Opportunity (1문장)" },
          top_risk: { type: "string" as const, description: "가장 큰 Risk (1문장, 특별한 리스크가 없으면 그렇게 명시)" },
          recommended_direction: { type: "string" as const, description: "추천 방향 (1문장)" },
        },
        required: ["current_position", "core_appeal", "hidden_value", "top_opportunity", "top_risk", "recommended_direction"],
      },
      final_sentence: {
        type: "string" as const,
        description: '정확히 "이 IP는 ______로 포지셔닝해야 한다." 형식의 한 문장.',
      },
    },
    required: ["findings", "ip_at_glance", "final_sentence"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseExecutiveSummaryResult(input: any): ExecutiveSummaryResult {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findings: (input?.findings ?? []).map((f: any) => ({
      headline: f.headline ?? "",
      evidence: f.evidence ?? "",
      implication: f.implication ?? "",
      decision: (f.decision || undefined) as DecisionType | undefined,
      confidence: (f.confidence || undefined) as Confidence | undefined,
    })),
    ipAtGlance: {
      currentPosition: input?.ip_at_glance?.current_position ?? "",
      coreAppeal: input?.ip_at_glance?.core_appeal ?? "",
      hiddenValue: input?.ip_at_glance?.hidden_value ?? "",
      topOpportunity: input?.ip_at_glance?.top_opportunity ?? "",
      topRisk: input?.ip_at_glance?.top_risk ?? "",
      recommendedDirection: input?.ip_at_glance?.recommended_direction ?? "",
    },
    finalSentence: input?.final_sentence ?? "",
  };
}

// ---------------------------------------------------------------------------
// Editorial Rewrite Pass — 전체 insight를 입력받아 중복 제거 + 사람이 읽는 글로 재작성
// ---------------------------------------------------------------------------

export type EditorialInsight = StructuredInsight & { moduleKey: string };

export const EDITORIAL_PASS_SCHEMA = {
  name: "record_editorial_pass",
  description:
    "여러 모듈에서 나온 insight들을 검토해 중복을 제거하고, 사람이 읽는 자연스러운 한국어로 재작성한 최종본을 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      edited_insights: {
        type: "array" as const,
        description:
          "재작성된 최종 insight 목록. 입력받은 것과 같거나 더 적은 개수여야 한다(중복은 제거, 병합 가능). 각 항목은 원래 속했던 module_key를 유지하거나, 더 적합한 module_key로 재배치할 수 있다.",
        items: {
          type: "object" as const,
          properties: {
            module_key: { type: "string" as const, description: "이 insight가 실릴 모듈 키 (입력에 주어진 module_key 중 하나)" },
            ...INSIGHT_ITEM_SCHEMA.properties,
          },
          required: ["module_key", ...INSIGHT_ITEM_SCHEMA.required],
        },
      },
    },
    required: ["edited_insights"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEditorialPassResult(input: any): EditorialInsight[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (input?.edited_insights ?? []).map((i: any) => ({ moduleKey: i.module_key ?? "", ...parseInsight(i) }));
}
