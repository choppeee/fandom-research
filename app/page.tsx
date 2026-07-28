import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { NewResearchForm } from "@/components/NewResearchForm";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      <header className="flex w-full max-w-md items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">팬덤 리서치 대시보드</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="text-sm underline underline-offset-2">
            내 리서치 목록
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <section className="w-full max-w-md space-y-2 text-center">
        <h2 className="text-lg font-semibold">새 리서치 시작</h2>
        <p className="text-sm text-muted-foreground">
          키워드와 분석 기간을 입력하면 유튜브 영상·댓글을 수집해 분석합니다.
        </p>
      </section>

      <NewResearchForm />
    </main>
  );
}
