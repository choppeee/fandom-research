import type { CanonicalInsight } from "@/lib/report/reportSchema";
import { authorMetricDisplayLevel } from "@/lib/coverage-audit";
import { DecisionBadge } from "./DecisionBadge";
import { ScopeBadge } from "./ScopeBadge";
import { BottleneckBlock } from "./BottleneckBlock";
import { ExpandableAnalysis } from "./ExpandableAnalysis";
import { VisualInsightBlock } from "@/components/evidence/VisualInsightBlock";

const SECTION_KEY_LABEL: Record<string, string> = {
  audience_response: "RESPONSE",
  intent: "INTENT",
  perception: "PERCEPTION",
  diagnosis: "DIAGNOSIS",
  evidence: "EVIDENCE",
};

export function InsightBlock({ insight, sectionKey }: { insight: CanonicalInsight; sectionKey: string }) {
  return (
    <article className="space-y-3 rounded-xl border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-wider text-ink-muted">{SECTION_KEY_LABEL[sectionKey] ?? insight.moduleTitle}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {insight.scope && <ScopeBadge scope={insight.scope} note={insight.scopeNote} />}
          {insight.decision && <DecisionBadge decision={insight.decision} />}
        </div>
      </div>

      <h3 className="text-lg font-bold leading-snug text-ink">{insight.headline}</h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{insight.interpretation}</p>

      <VisualInsightBlock pkg={insight.evidencePackage} insightHeadline={insight.headline} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span>대표 Evidence {insight.evidencePackage.sourceDiversity.commentCount}건</span>
        {insight.evidencePackage.sourceDiversity.videoCount > 0 && <span>대표 콘텐츠 {insight.evidencePackage.sourceDiversity.videoCount}개</span>}
        {insight.supportingCoverage && (
          <span>
            실제 반복 범위 · 콘텐츠 {insight.supportingCoverage.contentCount}개 · 댓글 {insight.supportingCoverage.commentCount}건
            {authorMetricDisplayLevel(insight.supportingCoverage) === "full" &&
              ` · 작성자 식별 가능 댓글 ${insight.supportingCoverage.commentsWithAuthorKey}건 중 최소 ${insight.supportingCoverage.knownUniqueAuthorCount}명`}
            {authorMetricDisplayLevel(insight.supportingCoverage) === "muted" &&
              ` · 작성자 식별 범위 제한(${Math.round((insight.supportingCoverage.authorCoverageRate ?? 0) * 100)}%)`}
          </span>
        )}
        <span>확신도 {insight.confidence}</span>
        <span>{insight.evidenceScope}</span>
      </div>

      {insight.possibleBottleneck && <BottleneckBlock bottleneck={insight.possibleBottleneck} />}

      <ExpandableAnalysis>
        <p>{insight.whyItMatters}</p>
        <p>{insight.strategicImplication}</p>
        {insight.amplificationRisk && <p className="text-warn">확대 시 주의점 · {insight.amplificationRisk}</p>}
        {insight.strategicReframe && <p>재정의 · {insight.strategicReframe}</p>}
      </ExpandableAnalysis>
    </article>
  );
}
