"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ChartSpec } from "@/lib/report/reportSchema";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#16A34A",
  negative: "#E3262E",
  neutral: "#ADA9B8",
};
const CHART_INK = "#E3262E";
const CHART_NEUTRAL = "#222222";

function interpretationFor(spec: ChartSpec): string {
  switch (spec.kind) {
    case "trend":
      return "날짜별 언급량(댓글 수)과 참여량(좋아요 합계)의 흐름입니다.";
    case "keywordBar":
      return "댓글·게시물에서 가장 자주 함께 언급된 키워드입니다.";
    case "sentimentDonut":
      return "전체 표본의 감성 분류 비율입니다.";
    case "sentimentTrend":
      return "날짜별 긍정·부정·중립 비율 변화입니다.";
  }
}

export function ChartCard({ spec }: { spec: ChartSpec }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-0.5 text-sm font-semibold text-ink">{spec.title}</div>
      <div className="mb-3 text-xs text-ink-muted">{interpretationFor(spec)}</div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          {spec.kind === "trend" ? (
            <ComposedChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E0" />
              <XAxis dataKey="date" fontSize={10} stroke="#8B8B8B" />
              <YAxis fontSize={10} stroke="#8B8B8B" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="mentions" name="언급량" fill={CHART_NEUTRAL} />
              <Line type="monotone" dataKey="engagement" name="참여량" stroke={CHART_INK} strokeWidth={2} dot={false} />
            </ComposedChart>
          ) : spec.kind === "keywordBar" ? (
            <BarChart data={spec.data} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E0" />
              <XAxis type="number" fontSize={10} stroke="#8B8B8B" />
              <YAxis dataKey="keyword" type="category" fontSize={10} width={70} stroke="#8B8B8B" />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_INK} radius={[0, 3, 3, 0]} />
            </BarChart>
          ) : spec.kind === "sentimentDonut" ? (
            <PieChart>
              <Pie
                data={[
                  { name: "긍정", key: "positive", value: spec.data.positive },
                  { name: "부정", key: "negative", value: spec.data.negative },
                  { name: "중립", key: "neutral", value: spec.data.neutral },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                label={(d) => `${d.name} ${d.value}%`}
                labelLine={false}
              >
                {["positive", "negative", "neutral"].map((k) => (
                  <Cell key={k} fill={SENTIMENT_COLORS[k]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={spec.data} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E0" />
              <XAxis dataKey="date" fontSize={10} stroke="#8B8B8B" />
              <YAxis fontSize={10} stroke="#8B8B8B" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="positive" stackId="s" name="긍정" fill={SENTIMENT_COLORS.positive} />
              <Bar dataKey="negative" stackId="s" name="부정" fill={SENTIMENT_COLORS.negative} />
              <Bar dataKey="neutral" stackId="s" name="중립" fill={SENTIMENT_COLORS.neutral} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
