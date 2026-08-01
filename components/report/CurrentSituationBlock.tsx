export function CurrentSituationBlock({ situation, priority }: { situation: string; priority?: string }) {
  if (!situation) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-wider text-white/50">CURRENT SITUATION</div>
      <p className="mt-1 text-sm leading-relaxed text-white/90">{situation}</p>
      {priority && (
        <>
          <div className="mt-3 text-[10px] font-semibold tracking-wider text-white/50">CURRENT PRIORITY</div>
          <p className="mt-1 text-sm leading-relaxed text-white/90">{priority}</p>
        </>
      )}
    </div>
  );
}
