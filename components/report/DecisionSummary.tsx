import type { StrategyResult } from "@/lib/insight-types";
import { DecisionBadge } from "./DecisionBadge";

const PRIORITY_LABEL = ["PRIORITY 01", "PRIORITY 02", "PRIORITY 03"];

/** "06 DECISION" - 전략 추천을 우선순위 카드로. Red는 PRIORITY 01에만 적극적으로 쓴다. */
export function DecisionSummary({ strategy }: { strategy: StrategyResult | null }) {
  if (!strategy || strategy.recommendations.length === 0) return null;
  return (
    <section id="decision" className="scroll-mt-20 space-y-4">
      <h2 className="text-lg font-bold text-ink">판단</h2>
      <div className="space-y-3">
        {strategy.recommendations.slice(0, 3).map((r, i) => (
          <div
            key={i}
            className={`rounded-xl border p-5 ${i === 0 ? "border-brand/40 bg-brand-soft" : "border-line"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[10px] font-semibold tracking-wider ${i === 0 ? "text-brand" : "text-ink-muted"}`}>
                {PRIORITY_LABEL[i] ?? `PRIORITY 0${i + 1}`}
              </span>
              <DecisionBadge decision={r.decision} />
            </div>
            <h3 className="mt-1.5 text-base font-bold text-ink">{r.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{r.insight}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-md bg-surface-soft p-2.5">
                <div className="font-medium text-ink-secondary">다음 확인(Next Move)</div>
                <div className="mt-0.5 text-ink-muted">{r.test}</div>
              </div>
              <div className="rounded-md bg-surface-soft p-2.5">
                <div className="font-medium text-ink-secondary">확대/중단 기준</div>
                <div className="mt-0.5 text-ink-muted">{r.decisionRule}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
