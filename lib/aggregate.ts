import type { CommentAnalysisResult } from "./claude";

export type CommentRow = {
  commentId: string;
  videoId: string;
  textOriginal: string;
  likeCount: number;
  publishedAt: string | null;
};

export type Aggregates = {
  topKeywords: { keyword: string; count: number }[];
  sentimentRatio: { positive: number; negative: number; neutral: number };
  dailyTrend: {
    date: string;
    mentions: number;
    engagement: number;
    positive: number;
    negative: number;
    neutral: number;
  }[];
  fandomHighlights: { expression: string; count: number; example: string; exampleCommentId: string }[];
  purchaseIntentSummary: { positiveRatio: number; examples: string[] };
  riskGroups: {
    level: "caution" | "high_risk";
    count: number;
    examples: string[];
    exampleCommentIds: string[];
  }[];
};

function toDateKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function computeAggregates(
  comments: CommentRow[],
  analyses: CommentAnalysisResult[]
): Aggregates {
  const commentById = new Map(comments.map((c) => [c.commentId, c]));

  // --- 감성 비율 ---
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  for (const a of analyses) sentimentCounts[a.sentiment] += 1;
  const total = analyses.length || 1;
  const sentimentRatio = {
    positive: Math.round((sentimentCounts.positive / total) * 100),
    negative: Math.round((sentimentCounts.negative / total) * 100),
    neutral: Math.round((sentimentCounts.neutral / total) * 100),
  };

  // --- 연관 키워드 Top 20 ---
  const keywordCounts = new Map<string, number>();
  for (const a of analyses) {
    for (const kw of a.extractedKeywords) {
      const norm = kw.trim();
      if (!norm) continue;
      keywordCounts.set(norm, (keywordCounts.get(norm) ?? 0) + 1);
    }
  }
  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));

  // --- 날짜별 추이 (언급량/참여량 + 감성 스택) ---
  const analysisById = new Map(analyses.map((a) => [a.commentId, a]));
  type DailyEntry = {
    mentions: number;
    engagement: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  const dailyMap = new Map<string, DailyEntry>();
  for (const c of comments) {
    const date = toDateKey(c.publishedAt);
    if (!date) continue;
    const entry: DailyEntry =
      dailyMap.get(date) ?? { mentions: 0, engagement: 0, positive: 0, negative: 0, neutral: 0 };
    entry.mentions += 1;
    entry.engagement += c.likeCount;
    const sentiment = analysisById.get(c.commentId)?.sentiment;
    if (sentiment) entry[sentiment] += 1;
    dailyMap.set(date, entry);
  }
  const dailyTrend = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));

  // --- 팬덤 표현 하이라이트 ---
  const fandomMap = new Map<string, { count: number; commentId: string }>();
  for (const a of analyses) {
    for (const expr of a.fandomExpressions) {
      const norm = expr.trim();
      if (!norm) continue;
      const existing = fandomMap.get(norm);
      if (existing) existing.count += 1;
      else fandomMap.set(norm, { count: 1, commentId: a.commentId });
    }
  }
  const fandomHighlights = [...fandomMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([expression, v]) => ({
      expression,
      count: v.count,
      example: commentById.get(v.commentId)?.textOriginal.slice(0, 200) ?? "",
      exampleCommentId: v.commentId,
    }));

  // --- 구매의향 ---
  const purchasePositive = analyses.filter((a) => a.purchaseIntent);
  const purchaseIntentSummary = {
    positiveRatio: Math.round((purchasePositive.length / total) * 100),
    examples: purchasePositive
      .slice(0, 5)
      .map((a) => commentById.get(a.commentId)?.textOriginal.slice(0, 200) ?? "")
      .filter(Boolean),
  };

  // --- 이슈/위험 그룹 ---
  const riskGroups: Aggregates["riskGroups"] = (["caution", "high_risk"] as const)
    .map((level) => {
      const items = analyses.filter((a) => a.riskFlag === level);
      return {
        level,
        count: items.length,
        examples: items
          .slice(0, 3)
          .map((a) => commentById.get(a.commentId)?.textOriginal.slice(0, 200) ?? "")
          .filter(Boolean),
        exampleCommentIds: items.slice(0, 3).map((a) => a.commentId),
      };
    })
    .filter((g) => g.count > 0);

  return {
    topKeywords,
    sentimentRatio,
    dailyTrend,
    fandomHighlights,
    purchaseIntentSummary,
    riskGroups,
  };
}
