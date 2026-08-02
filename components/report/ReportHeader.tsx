import Link from "next/link";
import { signOut } from "@/app/login/actions";

/** 제품 전역 Header. 실제 존재하는 라우트만 메뉴로 노출한다(가짜 메뉴 금지). */
export function ReportHeader({ active, userEmail }: { active?: "dashboard" | "jobs"; userEmail?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-6 backdrop-blur">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-sm font-bold tracking-tight text-ink">
          FANDOM RESEARCH
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/dashboard"
            className={`relative py-1 ${active === "dashboard" ? "font-medium text-ink" : "text-ink-secondary hover:text-ink"}`}
          >
            새 리서치
            {active === "dashboard" && <span className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-brand" />}
          </Link>
          <Link
            href="/jobs"
            className={`relative py-1 ${active === "jobs" ? "font-medium text-ink" : "text-ink-secondary hover:text-ink"}`}
          >
            리포트
            {active === "jobs" && <span className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-brand" />}
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {userEmail && <span className="hidden text-xs text-ink-muted sm:inline">{userEmail}</span>}
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-soft">
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
