import type { MetricItem } from "@/lib/report/reportSchema";

const TONE_CLASS: Record<NonNullable<MetricItem["tone"]>, string> = {
  neutral: "text-ink",
  brand: "text-brand",
  positive: "text-positive",
  warning: "text-warn",
  danger: "text-danger",
};

/** 실제 계산된 값만 들어온다(빈 값/가짜 성장률 없음) - buildReportModel에서 이미 걸러졌으므로
 * 여기서는 있는 것만 그린다. */
export function MetricGrid({ metrics }: { metrics: MetricItem[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => (
        <div key={m.key} className="bg-surface p-4">
          <div className="text-[11px] text-ink-muted">{m.label}</div>
          <div className={`mt-1 text-2xl font-bold ${m.tone ? TONE_CLASS[m.tone] : "text-ink"}`}>{m.value}</div>
          {m.caption && <div className="mt-0.5 text-[10.5px] text-ink-muted">{m.caption}</div>}
        </div>
      ))}
    </div>
  );
}
