export function DataCoverageNote({ note, warnings }: { note: string | null; warnings: string[] }) {
  if (!note && warnings.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface-soft p-3 text-xs text-ink-muted">
      {note && (
        <p>
          <span className="font-semibold text-ink-secondary">DATA COVERAGE</span> · {note}
        </p>
      )}
      {warnings.map((w, i) => (
        <p key={i} className="mt-1 text-warning">
          {w}
        </p>
      ))}
    </div>
  );
}
