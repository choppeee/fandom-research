import { INSIGHT_SCOPE_KO } from "@/lib/insight-types";
import type { InsightScope } from "@/lib/insight-types";

const SCOPE_TONE: Record<InsightScope, string> = {
  single_content_exploratory: "bg-surface-soft text-ink-muted",
  concentrated: "bg-brand-soft text-brand",
  broad_repeated: "bg-positive-soft text-positive",
};

export function ScopeBadge({ scope, note }: { scope: InsightScope; note?: string }) {
  return (
    <span
      title={note}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SCOPE_TONE[scope]}`}
    >
      SCOPE · {INSIGHT_SCOPE_KO[scope]}
    </span>
  );
}
