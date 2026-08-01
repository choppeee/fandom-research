import type { ReportSection as ReportSectionModel } from "@/lib/report/reportSchema";
import { InsightBlock } from "./InsightBlock";

export function ReportSection({ section }: { section: ReportSectionModel }) {
  return (
    <section id={section.key} className="scroll-mt-20 space-y-4">
      <h2 className="text-lg font-bold text-ink">{section.title}</h2>
      <div className="space-y-4">
        {section.insights.map((ins) => (
          <InsightBlock key={ins.id} insight={ins} sectionKey={section.key} />
        ))}
      </div>
    </section>
  );
}
