import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ResearchModeSelector } from "@/components/research/ResearchModeSelector";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bg">
      <ReportHeader active="dashboard" userEmail={user.email} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <section className="mb-10 text-center">
          <p className="text-xs font-semibold tracking-wide text-ink-muted">NEW RESEARCH</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">무엇을 알고 싶은지에 따라 분석 방식을 선택하세요</h1>
        </section>

        <ResearchModeSelector />
      </main>
    </div>
  );
}
