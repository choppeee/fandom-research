import { DECISION_KO } from "@/lib/insight-types";
import type { DecisionType } from "@/lib/insight-types";

// Red는 CTA/강조 전용, 위험(AVOID)에는 danger 변수를 쓴다 - 값은 같아도 의미가 다른 토큰.
const DECISION_TONE: Record<DecisionType, string> = {
  KEEP: "bg-positive-soft text-positive",
  REPEAT: "bg-positive-soft text-positive",
  AMPLIFY: "bg-positive-soft text-positive",
  PROTECT: "bg-positive-soft text-positive",
  CLARIFY: "bg-surface-soft text-ink-secondary",
  CORRECT: "bg-surface-soft text-ink-secondary",
  CONNECT: "bg-positive-soft text-positive",
  TEST: "bg-brand-soft text-brand",
  EXPAND: "bg-brand-soft text-brand",
  REFRAME: "bg-brand-soft text-brand",
  WATCH: "bg-surface-soft text-ink-muted",
  NO_CHANGE: "bg-surface-soft text-ink-muted",
  AVOID: "bg-danger-soft text-danger",
};

export function DecisionBadge({ decision, dark }: { decision: DecisionType; dark?: boolean }) {
  if (dark) {
    const isPriority = decision === "TEST" || decision === "EXPAND" || decision === "AVOID";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          isPriority ? "bg-brand text-white" : "bg-white/10 text-white"
        }`}
      >
        {DECISION_KO[decision]}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${DECISION_TONE[decision]}`}>
      {DECISION_KO[decision]}
    </span>
  );
}
