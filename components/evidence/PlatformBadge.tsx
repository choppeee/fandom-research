const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  x: "X",
};

const PLATFORM_COLOR: Record<string, string> = {
  youtube: "bg-red-50 text-red-700 border-red-200",
  x: "bg-slate-100 text-slate-700 border-slate-300",
};

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        PLATFORM_COLOR[platform] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {PLATFORM_LABEL[platform] ?? platform}
    </span>
  );
}
