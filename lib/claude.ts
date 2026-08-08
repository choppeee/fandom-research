import Anthropic from "@anthropic-ai/sdk";
import { IP_INTELLIGENCE_SYSTEM_PROMPT } from "./ip-intelligence-prompt";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** 드물게 모델 응답의 멀티바이트 문자가 토큰 경계에서 깨져 U+FFFD(�)로 디코딩되는 경우가 있다.
 * 결정론적 버그가 아니라 그 호출 자체의 디코딩 아티팩트이므로, 감지되면 동일 요청을 1회 재시도한다. */
export async function createMessageWithCorruptionRetry(
  llm: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const res = await llm.messages.create(params);
  if (JSON.stringify(res.content).includes("�")) {
    return llm.messages.create(params);
  }
  return res;
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

  const res = await createMessageWithCorruptionRetry(anthropic(), {
    model: CLASSIFY_MODEL,
    max_tokens: 8192,
    tools: [COMMENT_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "record_comment_analysis" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) return [];

  const input = toolUse.input as { results?: unknown };
  // 모델 응답이 스키마와 다르게 오는 경우(배열이 아닌 값 등) 배치 전체를 건너뛴다.
  if (!Array.isArray(input.results)) {
    console.error("[analyzeCommentBatch] results가 배열이 아님, 배치 건너뜀:", input);
    return [];
  }

  return (input.results as Record<string, unknown>[]).map((r) => ({
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
  commentSample: {
    commentId: string;
    text: string;
    likeCount: number;
    sentiment: string;
    purchaseIntent: boolean;
    riskFlag: string;
    fandomExpressions: string[];
  }[];
};

export type GeneratedInsight = {
  summaryText: string;
};

const INSIGHT_MAX_TOKENS = 8000;

/**
 * Job 단위 집계 데이터 + 대표 댓글 샘플을 근거로
 * IP 인텔리전스 리포트(FINAL REPORT 1~20 섹션)를 생성한다.
 */
export async function generateJobInsight(
  ctx: InsightContext
): Promise<GeneratedInsight> {
  if (ctx.commentCount === 0) {
    return { summaryText: "분석할 댓글 데이터가 없습니다." };
  }

  const prompt = `분석 대상(IP): "${ctx.keyword}"
데이터 출처: 유튜브 영상 ${ctx.videoCount}개 및 그 댓글 ${ctx.commentCount}개
분석 기간: ${ctx.periodStart} ~ ${ctx.periodEnd}

아래는 이 데이터에서 뽑은 집계 통계와 대표 댓글 샘플이다.
이 데이터만 근거로 삼아 시스템 지침의 FINAL REPORT(1~20번 섹션)를 작성하라.

[집계 통계]
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
)}

[대표 댓글 샘플 (${ctx.commentSample.length}건 — likeCount 및 1차 분류 라벨 포함)]
${JSON.stringify(ctx.commentSample, null, 2)}`;

  const res = await createMessageWithCorruptionRetry(anthropic(), {
    model: INSIGHT_MODEL,
    max_tokens: INSIGHT_MAX_TOKENS,
    system: IP_INTELLIGENCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = res.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );

  return { summaryText: textBlock?.text ?? "" };
}
