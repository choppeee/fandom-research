import type { ReportModel } from "@/lib/report/reportSchema";
import { SECTION_LABEL } from "@/lib/report/reportSchema";
import { ReportHeader } from "./ReportHeader";
import { ReportHero } from "./ReportHero";
import { ExecutiveDecision } from "./ExecutiveDecision";
import { MetricGrid } from "./MetricGrid";
import { ReportSidebar } from "./ReportSidebar";
import { ReportSection } from "./ReportSection";
import { EvidenceSection } from "./EvidenceSection";
import { DecisionSummary } from "./DecisionSummary";
import { ChartCard } from "./ChartCard";
import { RiskCallout } from "./RiskCallout";
import { LimitationNote } from "./LimitationNote";
import { LegacyReportView } from "./LegacyReportView";
import { CommentExplorer } from "./CommentExplorer";

export function ReportPage({ jobId, report }: { jobId: string; report: ReportModel }) {
  const downloadHref = `/api/jobs/${jobId}/export/pdf`;
  const topicSections = report.sections.filter((s) => s.key !== "evidence");
  const evidenceSection = report.sections.find((s) => s.key === "evidence");
  const hasDecision = (report.strategy?.recommendations.length ?? 0) > 0;

  const navItems = [
    ...(report.executiveDecision ? [{ id: "executive", label: "Executive" }] : []),
    ...topicSections.map((s) => ({ id: s.key, label: SECTION_LABEL[s.key] })),
    ...(hasDecision ? [{ id: "decision", label: "Decision" }] : []),
    ...(evidenceSection ? [{ id: "evidence", label: "Evidence" }] : []),
  ];

  return (
    <div className="min-h-screen bg-bg">
      <ReportHeader active="jobs" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div id="executive">
          <ReportHero meta={report.meta} downloadHref={downloadHref} />
        </div>

        {report.isLegacy ? (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
            <LegacyReportView legacy={report.legacy!} />
            <ReportSidebar navItems={[]} meta={report.meta} downloadHref={downloadHref} />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
            <main className="min-w-0 space-y-10">
              <ExecutiveDecision decision={report.executiveDecision} />
              <MetricGrid metrics={report.metrics} />
              <RiskCallout riskAlerts={report.riskAlerts} />

              {topicSections.map((section) => (
                <ReportSection key={section.key} section={section} />
              ))}

              {report.charts.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-ink">데이터로 보기</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {report.charts.map((c, i) => (
                      <ChartCard key={i} spec={c} />
                    ))}
                  </div>
                </section>
              )}

              <DecisionSummary strategy={report.strategy} />
              {evidenceSection && <EvidenceSection section={evidenceSection} />}

              <LimitationNote limitations={report.limitations} />

              <CommentExplorer jobId={jobId} />
            </main>
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <ReportSidebar navItems={navItems} meta={report.meta} downloadHref={downloadHref} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky bottom CTA */}
      <div className="sticky bottom-0 border-t border-line bg-surface p-3 lg:hidden">
        <a href={downloadHref} className="block w-full rounded-md bg-brand py-2.5 text-center text-sm font-medium text-white">
          PDF 다운로드
        </a>
      </div>
    </div>
  );
}
