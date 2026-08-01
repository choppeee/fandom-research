import type { ReportModel } from "@/lib/report/reportSchema";

export function RiskCallout({ riskAlerts }: { riskAlerts: ReportModel["riskAlerts"] }) {
  if (riskAlerts.length === 0) return null;
  const highRisk = riskAlerts.filter((r) => r.level === "high_risk").length;
  const caution = riskAlerts.filter((r) => r.level === "caution").length;
  return (
    <div className="flex flex-wrap gap-3">
      {highRisk > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs">
          <span className="font-semibold text-danger">고위험</span>
          <span className="text-ink-secondary">{highRisk}건 발견</span>
        </div>
      )}
      {caution > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs">
          <span className="font-semibold text-warn">주의</span>
          <span className="text-ink-secondary">{caution}건 발견</span>
        </div>
      )}
    </div>
  );
}
