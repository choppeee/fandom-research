import type { ReportSection as ReportSectionModel } from "@/lib/report/reportSchema";
import { VisualInsightBlock } from "@/components/evidence/VisualInsightBlock";

/** 08 EVIDENCE - 위 섹션들에서 이미 다룬 insight의 헤드라인을 반복 설명하지 않고, 원본
 * 영상/댓글 근거만 다시 모아 "직접 확인하기" 용도로 보여준다(같은 카드 중복 방지). */
export function EvidenceSection({ section }: { section: ReportSectionModel }) {
  if (section.insights.length === 0) return null;
  return (
    <section id={section.key} className="scroll-mt-20 space-y-4">
      <h2 className="text-lg font-bold text-ink">{section.title}</h2>
      <p className="text-xs text-ink-muted">위에서 다룬 발견들의 원본 영상·댓글입니다.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {section.insights.map((ins) => (
          <div key={ins.id} className="rounded-xl border border-line p-4">
            <div className="mb-2 text-xs font-medium text-ink-secondary">{ins.headline}</div>
            <VisualInsightBlock pkg={ins.evidencePackage} insightHeadline={ins.headline} />
          </div>
        ))}
      </div>
    </section>
  );
}
