import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

// 댓글 배치 처리 크기 (PLAN.md 5.2: 20~30개씩 묶어 1회 호출)
export const COMMENT_BATCH_SIZE = 25;
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001";
const INSIGHT_MODEL = "claude-sonnet-5";

export type CommentAnalysisResult = {
  commentId: string;
  sentiment: "positive" | "negative" | "neutral";
  purchaseIntent: boolean;
  adReaction: "positive" | "negative" | "none";
  riskFlag: "none" | "caution" | "high_risk";
  extractedKeywords: string[];
  fandomExpressions: string[];
};

const COMMENT_TOOL_SCHEMA = {
  name: "record_comment_analysis",
  description: "유튜브 댓글 배치에 대한 감성/속성 분석 결과를 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            comment_id: { type: "string" as const },
            sentiment: {
              type: "string" as const,
              enum: ["positive", "negative", "neutral"],
            },
            purchase_intent: { type: "boolean" as const },
            ad_reaction: {
              type: "string" as const,
              enum: ["positive", "negative", "none"],
            },
            risk_flag: {
              type: "string" as const,
              enum: ["none", "caution", "high_risk"],
            },
            extracted_keywords: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "댓글에서 추출한 핵심 명사/키워드 (최대 5개)",
            },
            fandom_expressions: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "팬덤 용어/밈 표현 (없으면 빈 배열)",
            },
          },
          required: [
            "comment_id",
            "sentiment",
            "purchase_intent",
            "ad_reaction",
            "risk_flag",
            "extracted_keywords",
            "fandom_expressions",
          ],
        },
      },
    },
    required: ["results"],
  },
};

/** 댓글 최대 25개 배치를 감성/키워드/이슈 관점으로 구조화 분석한다. */
export async function analyzeCommentBatch(
  keyword: string,
  comments: { commentId: string; text: string }[]
): Promise<CommentAnalysisResult[]> {
  const prompt = `당신은 "${keyword}" 관련 유튜브 댓글을 분석하는 리서치 어시스턴트입니다.
아래 댓글 목록 각각에 대해 감성(sentiment), 구매의향(purchase_intent), 광고반응(ad_reaction),
위험신호(risk_flag: 욕설/혐오/허위정보/분쟁 소지가 있으면 caution 또는 high_risk), 핵심 키워드,
팬덤 표현(있다면)을 분석해서 record_comment_analysis 도구를 호출해 결과를 기록하세요.
모든 댓글에 대해 빠짐없이 결과를 반환해야 합니다.

댓글 목록 (JSON):
${JSON.stringify(comments, null, 2)}`;

  const res = await anthropic().messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 4096,
    tools: [COMMENT_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "record_comment_analysis" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) return [];

  const input = toolUse.input as { results: Record<string, unknown>[] };
  return (input.results ?? []).map((r) => ({
    commentId: String(r.comment_id),
    sentiment: r.sentiment as CommentAnalysisResult["sentiment"],
    purchaseIntent: Boolean(r.purchase_intent),
    adReaction: r.ad_reaction as CommentAnalysisResult["adReaction"],
    riskFlag: r.risk_flag as CommentAnalysisResult["riskFlag"],
    extractedKeywords: Array.isArray(r.extracted_keywords)
      ? (r.extracted_keywords as string[])
      : [],
    fandomExpressions: Array.isArray(r.fandom_expressions)
      ? (r.fandom_expressions as string[])
      : [],
  }));
}

const INSIGHT_TOOL_SCHEMA = {
  name: "record_job_insight",
  description: "리서치 Job 전체에 대한 종합 서술형 인사이트와 이슈 설명을 기록한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary_text: {
        type: "string" as const,
        description: "3~5문단의 한국어 종합 인사이트 서술 (언급량 추이, 여론, 팬덤 반응, 리스크 순으로)",
      },
      risk_alerts: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            level: { type: "string" as const, enum: ["caution", "high_risk"] },
            description: {
              type: "string" as const,
              description: "이 위험군 댓글들을 근거로 한 1~2문장 설명",
            },
          },
          required: ["level", "description"],
        },
      },
    },
    required: ["summary_text", "risk_alerts"],
  },
};

export type InsightContext = {
  keyword: string;
  periodStart: string;
  periodEnd: string;
  videoCount: number;
  commentCount: number;
  topKeywords: { keyword: string; count: number }[];
  sentimentRatio: { positive: number; negative: number; neutral: number };
  dailyTrend: { date: string; mentions: number; engagement: number }[];
  purchaseIntentPositiveRatio: number;
  riskGroups: { level: "caution" | "high_risk"; count: number; examples: string[] }[];
};

export type GeneratedInsight = {
  summaryText: string;
  riskAlerts: { level: "caution" | "high_risk"; description: string }[];
};

/** Job 단위 집계 데이터를 근거로 종합 서술형 인사이트를 생성한다. */
export async function generateJobInsight(
  ctx: InsightContext
): Promise<GeneratedInsight> {
  if (ctx.commentCount === 0) {
    return { summaryText: "분석할 댓글 데이터가 없습니다.", riskAlerts: [] };
  }

  const prompt = `아래는 "${ctx.keyword}" 키워드로 ${ctx.periodStart}~${ctx.periodEnd} 기간에
수집한 유튜브 영상 ${ctx.videoCount}개, 댓글 ${ctx.commentCount}개에 대한 집계 데이터입니다.
이 데이터를 근거로 record_job_insight 도구를 호출해
1) 3~5문단짜리 한국어 종합 인사이트(언급량 추이 → 여론/감성 → 팬덤 반응 → 구매의향 → 리스크 순)와
2) 리스크 그룹별 설명을 작성하세요. 반드시 주어진 데이터에 근거해서만 서술하고, 없는 사실을 지어내지 마세요.

집계 데이터(JSON):
${JSON.stringify(
  {
    topKeywords: ctx.topKeywords,
    sentimentRatio: ctx.sentimentRatio,
    dailyTrend: ctx.dailyTrend,
    purchaseIntentPositiveRatio: ctx.purchaseIntentPositiveRatio,
    riskGroups: ctx.riskGroups,
  },
  null,
  2
)}`;

  const res = await anthropic().messages.create({
    model: INSIGHT_MODEL,
    max_tokens: 2048,
    tools: [INSIGHT_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "record_job_insight" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) return { summaryText: "", riskAlerts: [] };

  const input = toolUse.input as {
    summary_text: string;
    risk_alerts: { level: "caution" | "high_risk"; description: string }[];
  };

  return {
    summaryText: input.summary_text,
    riskAlerts: input.risk_alerts ?? [],
  };
}
