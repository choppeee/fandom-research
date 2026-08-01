/** 모든 분석 모듈이 공유하는 구조화 출력 타입 + tool-use 스키마.
 * 자유 마크다운 대신 headline/interpretation/evidence/strategicImplication을 분리해서
 * PDF의 Insight Page(60/40 split + evidence card)에 그대로 매핑한다. */

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type StructuredInsight = {
  headline: string;
  interpretation: string;
  evidence: string[];
  whyItMatters: string;
  strategicImplication: string;
  confidence: Confidence;
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

export const INSIGHT_ITEM_SCHEMA = {
  type: "object" as const,
  properties: {
    headline: { type: "string" as const, description: "핵심 결론 한 문장" },
    interpretation: {
      type: "string" as const,
      description: "왜 그런지에 대한 핵심 해석. 100~180 단어(한국어 기준 약 200~350자) 분량으로 압축해서 작성. 더 긴 추론은 생략하고 가장 중요한 것만 남긴다.",
    },
    evidence: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2~4개. 각각 짧은 댓글 인용, 반복 횟수, engagement(좋아요 등), 또는 수치 하나. 문장이 아니라 짧은 근거 조각.",
    },
    why_it_matters: { type: "string" as const, description: "이 발견이 왜 중요한지 1문장" },
    strategic_implication: { type: "string" as const, description: "전략적 함의. 2~4문장으로 압축." },
    confidence: { type: "string" as const, enum: ["HIGH", "MEDIUM", "LOW"], description: "데이터가 직접 뒷받침하면 HIGH, 반복 패턴은 있으나 제한적이면 MEDIUM, 소수 사례 추정이면 LOW" },
    theory: { type: "string" as const, description: "실제로 설명력이 높을 때만, 근거가 된 심리학/행동경제학 이론명 1개(선택, 없으면 생략)" },
  },
  required: ["headline", "interpretation", "evidence", "why_it_matters", "strategic_implication", "confidence"],
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
export function parseModuleResult(input: any): ModuleResult {
  return {
    applicable: Boolean(input?.applicable),
    notApplicableReason: input?.not_applicable_reason ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insights: (input?.insights ?? []).map((i: any) => ({
      headline: i.headline ?? "",
      interpretation: i.interpretation ?? "",
      evidence: Array.isArray(i.evidence) ? i.evidence : [],
      whyItMatters: i.why_it_matters ?? "",
      strategicImplication: i.strategic_implication ?? "",
      confidence: (i.confidence ?? "MEDIUM") as Confidence,
      theory: i.theory || undefined,
    })),
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

/** job 상세 화면의 인라인 미리보기(summary_text)용으로 저장된 구조화 콘텐츠를 마크다운으로 변환.
 * 구버전 자유 마크다운이면 그대로 반환한다(하위호환). */
export function renderStoredContentToMarkdown(title: string, rawContentMd: string): string {
  const parsed = parseStoredModuleContent(rawContentMd);
  if (!parsed) return rawContentMd; // 레거시 자유 마크다운

  if (parsed.kind === "insights") {
    const r = parsed.data;
    if (!r.applicable) return `## ${title}\n\n${r.notApplicableReason || "이번 데이터/IP 유형에는 적용하기 어렵습니다."}`;
    const body = r.insights
      .map(
        (i) => `### ${i.headline}

${i.interpretation}

**근거:** ${i.evidence.join(" · ")}
**왜 중요한가:** ${i.whyItMatters}
**전략적 함의:** ${i.strategicImplication}
_확신도: ${i.confidence}${i.theory ? ` · 이론: ${i.theory}` : ""}_`
      )
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
        (r) => `### [${r.priority}] ${r.title} (확신도: ${r.confidence})
- Insight: ${r.insight}
- Opportunity: ${r.opportunity}
- Hypothesis: ${r.hypothesis}
- Test: ${r.test}`
      )
      .join("\n\n");
    const appendix = s.appendixIdeas.length ? `\n\n**Appendix Ideas**\n${s.appendixIdeas.map((i) => `- ${i}`).join("\n")}` : "";
    return `## ${title}\n\n${rows}${appendix}`;
  }

  if (parsed.kind === "executive_summary") {
    const e = parsed.data;
    const findings = e.findings
      .map((f, i) => `**${String(i + 1).padStart(2, "0")}. ${f.headline}**\nEvidence: ${f.evidence}\nImplication: ${f.implication}`)
      .join("\n\n");
    return `## ${title}

${findings}

### IP at a Glance
- 현재 포지션: ${e.ipAtGlance.currentPosition}
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
        `[Insight ${idx + 1}] ${i.headline}\n해석: ${i.interpretation}\n근거: ${i.evidence.join(" / ")}\n왜 중요한가: ${i.whyItMatters}\n전략적 함의: ${i.strategicImplication}\n확신도: ${i.confidence}${i.theory ? ` (이론: ${i.theory})` : ""}`
    )
    .join("\n\n");
  return `--- ${title} ---\n${body}`;
}

// ---------------------------------------------------------------------------
// Strategy (Insight -> Opportunity -> Hypothesis -> Test) + Priority
// ---------------------------------------------------------------------------

export type StrategyConfidence = "HIGH" | "MEDIUM" | "EXPERIMENTAL";
export type Priority = "P1" | "P2" | "P3";

export type StrategyRecommendation = {
  priority: Priority;
  title: string;
  insight: string;
  opportunity: string;
  hypothesis: string;
  test: string;
  confidence: StrategyConfidence;
};

export type StrategyResult = {
  recommendations: StrategyRecommendation[];
  appendixIdeas: string[];
};

export const STRATEGY_SCHEMA = {
  name: "record_strategy",
  description: "데이터 근거 -> 실행안까지 4단계로 분리한 전략 추천을 기록한다. 데이터만으로 바로 대규모 실행을 추천하지 않는다.",
  input_schema: {
    type: "object" as const,
    properties: {
      recommendations: {
        type: "array" as const,
        description: "우선순위가 매겨진 전략 추천. P1(지금 바로) 1~3개, P2(테스트) 2~4개, P3(관찰) 2~4개 정도.",
        items: {
          type: "object" as const,
          properties: {
            priority: { type: "string" as const, enum: ["P1", "P2", "P3"] },
            title: { type: "string" as const, description: "한 줄 제목" },
            insight: { type: "string" as const, description: "실제 데이터에서 무엇을 발견했는가 (1~2문장)" },
            opportunity: { type: "string" as const, description: "어떤 가능성이 존재하는가 (1~2문장)" },
            hypothesis: { type: "string" as const, description: "어떤 전략을 테스트할 가치가 있는가 (1~2문장)" },
            test: { type: "string" as const, description: "낮은 비용으로 무엇을 먼저 검증할 수 있는가 (1~2문장, 구체적으로)" },
            confidence: {
              type: "string" as const,
              enum: ["HIGH", "MEDIUM", "EXPERIMENTAL"],
              description: "HIGH=현재 데이터가 직접 뒷받침, MEDIUM=반복 패턴은 있으나 실행 효과 미검증, EXPERIMENTAL=가설 단계, 테스트 필요",
            },
          },
          required: ["priority", "title", "insight", "opportunity", "hypothesis", "test", "confidence"],
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
      priority: r.priority ?? "P3",
      title: r.title ?? "",
      insight: r.insight ?? "",
      opportunity: r.opportunity ?? "",
      hypothesis: r.hypothesis ?? "",
      test: r.test ?? "",
      confidence: r.confidence ?? "EXPERIMENTAL",
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
        description: "3~5개",
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
// Executive Summary
// ---------------------------------------------------------------------------

export type ExecFinding = { headline: string; evidence: string; implication: string };
export type IpAtGlance = {
  currentPosition: string;
  coreAppeal: string;
  hiddenValue: string;
  topOpportunity: string;
  topRisk: string;
  recommendedDirection: string;
};
export type ExecutiveSummaryResult = { findings: ExecFinding[]; ipAtGlance: IpAtGlance; finalSentence: string };

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
            headline: { type: "string" as const, description: "핵심 결론 한 문장, 짧게" },
            evidence: { type: "string" as const, description: "짧은 숫자/댓글 근거 1개" },
            implication: { type: "string" as const, description: "1~2문장" },
          },
          required: ["headline", "evidence", "implication"],
        },
      },
      ip_at_glance: {
        type: "object" as const,
        properties: {
          current_position: { type: "string" as const, description: "현재 포지션 (1문장)" },
          core_appeal: { type: "string" as const, description: "핵심 매력 (1문장)" },
          hidden_value: { type: "string" as const, description: "Hidden Value (1문장)" },
          top_opportunity: { type: "string" as const, description: "가장 큰 Opportunity (1문장)" },
          top_risk: { type: "string" as const, description: "가장 큰 Risk (1문장)" },
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
