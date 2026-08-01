import type { ExecutiveDecision as ExecutiveDecisionModel } from "@/lib/report/reportSchema";
import { CurrentSituationBlock } from "./CurrentSituationBlock";
import { DecisionBadge } from "./DecisionBadge";

/** 화면에서 가장 먼저 읽혀야 하는 블록. 근거 조건이 충분할 때만 검정 배경의 강한 판단(kind:"decision")을
 * 보여주고, 그렇지 않으면(exploratory) 확정적 톤 없이 "무엇을 알고/모르는지"만 정직하게 보여준다 -
 * 근거가 약한데 검정 배경 강한 결론을 만들면 시각적으로 과장된 판단이 되기 때문. */
export function ExecutiveDecision({ decision }: { decision: ExecutiveDecisionModel | null }) {
  if (!decision) return null;

  if (decision.kind === "exploratory") {
    return (
      <section className="rounded-xl border border-line bg-surface-soft p-6">
        <div className="text-[10px] font-semibold tracking-wider text-ink-muted">EXPLORATORY FINDING</div>
        <h2 className="mt-2 text-xl font-bold leading-snug text-ink sm:text-2xl">{decision.headline}</h2>
        {decision.body.length > 0 && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">{decision.body.join(" ")}</p>
        )}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-ink-muted">WHAT WE KNOW</div>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-secondary">
              {decision.whatWeKnow.length === 0 ? (
                <li className="text-ink-muted">아직 확인된 반복 패턴이 없습니다.</li>
              ) : (
                decision.whatWeKnow.map((w, i) => <li key={i}>· {w}</li>)
              )}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-ink-muted">WHAT WE DO NOT KNOW</div>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-secondary">
              {decision.whatWeDontKnow.map((w, i) => (
                <li key={i}>· {w}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-xl border border-line lg:grid-cols-5">
      <div className="p-6 lg:col-span-3">
        <div className="text-[10px] font-semibold tracking-wider text-brand">KEY JUDGMENT</div>
        <h2 className="mt-2 text-xl font-bold leading-snug text-ink sm:text-2xl">{decision.headline}</h2>
        {decision.body.length > 0 && (
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-secondary">
            {decision.body.map((b, i) => (
              <p key={i}>{b}</p>
            ))}
          </div>
        )}
      </div>
      <div className="bg-black-surface p-6 lg:col-span-2">
        <CurrentSituationBlock situation={decision.currentSituation} priority={decision.currentPriority} />
        <div className="mt-4 flex items-center gap-3">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-white/50">DECISION</div>
            <div className="mt-1">
              <DecisionBadge decision={decision.decision} dark />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-white/50">CONFIDENCE</div>
            <div className="mt-1 text-sm font-medium text-white">{decision.confidence}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
