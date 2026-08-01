import type { StructuredInsight } from "@/lib/insight-types";
import { DECISION_KO } from "@/lib/insight-types";
import type { EvidencePackage } from "@/lib/evidence-types";
import { VisualInsightBlock } from "./VisualInsightBlock";

const DECISION_TIER_CLASS: Record<string, string> = {
  KEEP: "bg-green-50 text-green-700 border-green-200",
  REPEAT: "bg-green-50 text-green-700 border-green-200",
  AMPLIFY: "bg-green-50 text-green-700 border-green-200",
  PROTECT: "bg-green-50 text-green-700 border-green-200",
  CLARIFY: "bg-green-50 text-green-700 border-green-200",
  CORRECT: "bg-green-50 text-green-700 border-green-200",
  CONNECT: "bg-green-50 text-green-700 border-green-200",
  TEST: "bg-amber-50 text-amber-700 border-amber-200",
  EXPAND: "bg-amber-50 text-amber-700 border-amber-200",
  REFRAME: "bg-amber-50 text-amber-700 border-amber-200",
  WATCH: "bg-slate-100 text-slate-700 border-slate-300",
  NO_CHANGE: "bg-slate-100 text-slate-700 border-slate-300",
  AVOID: "bg-red-50 text-red-700 border-red-200",
};

export function InsightCard({
  insight,
  evidencePackage,
}: {
  insight: StructuredInsight & { evidenceId: string };
  evidencePackage: EvidencePackage;
}) {
  return (
    <article className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold leading-snug">{insight.headline}</h4>
        {insight.decision && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              DECISION_TIER_CLASS[insight.decision] ?? "bg-muted text-muted-foreground border-border"
            }`}
          >
            {DECISION_KO[insight.decision]}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">{insight.interpretation}</p>

      <VisualInsightBlock pkg={evidencePackage} insightHeadline={insight.headline} />

      <div className="space-y-1 text-sm">
        <p>{insight.whyItMatters}</p>
        <p className="text-muted-foreground">{insight.strategicImplication}</p>
      </div>

      {insight.possibleBottleneck && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          병목 후보: {insight.possibleBottleneck.type} — {insight.possibleBottleneck.evidence}
        </p>
      )}
      {insight.amplificationRisk && (
        <p className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
          확대 시 주의점: {insight.amplificationRisk}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {insight.evidenceScope} · 확신도 {insight.confidence}
      </p>
    </article>
  );
}
