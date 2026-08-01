export function LimitationNote({ limitations }: { limitations: string[] }) {
  if (limitations.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface-soft p-3 text-xs text-ink-muted">
      {limitations.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
