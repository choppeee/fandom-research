import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewResearchForm } from "@/components/NewResearchForm";
import { ReportHeader } from "@/components/report/ReportHeader";

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
      <ReportHeader active="dashboard" />
      <main className="mx-auto flex max-w-md flex-col items-center gap-8 px-6 py-16">
        <div className="w-full text-center">
          <p className="text-xs text-ink-muted">{user.email}</p>
        </div>

        <section className="w-full space-y-1.5 text-center">
          <h1 className="text-2xl font-bold text-ink">새 리서치 시작</h1>
          <p className="text-sm text-ink-secondary">키워드와 분석 기간을 입력하면 유튜브 영상·댓글을 수집해 분석합니다.</p>
        </section>

        <NewResearchForm />
      </main>
    </div>
  );
}
