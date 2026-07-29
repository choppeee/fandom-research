import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기 중",
  collect: "수집 중",
  classify: "1차 분류 중",
  aggregate: "집계 중",
  modules: "심층 분석 중",
  platform: "플랫폼별 분석 중",
  cross: "교차 분석 중",
  positioning: "포지셔닝 도출 중",
  strategy_actions: "전략 생성 중",
  reference: "레퍼런스 검색 중",
  executive_summary: "요약 작성 중",
  assemble: "리포트 조립 중",
  done: "완료",
  failed: "실패",
};

export default async function JobsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobs } = await supabase
    .from("research_jobs")
    .select("id, keyword, period_start, period_end, status, progress, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <header className="flex w-full max-w-3xl items-center justify-between">
        <h1 className="text-xl font-bold">내 리서치 목록</h1>
        <Link href="/" className="text-sm underline underline-offset-2">
          ← 새 리서치 시작
        </Link>
      </header>

      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-4 py-2">키워드</th>
              <th className="px-4 py-2">기간</th>
              <th className="px-4 py-2">상태</th>
              <th className="px-4 py-2">생성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(jobs ?? []).map((job) => (
              <tr key={job.id} className="hover:bg-muted/50">
                <td className="px-4 py-2">
                  <Link href={`/jobs/${job.id}`} className="underline underline-offset-2">
                    {job.keyword}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {job.period_start} ~ {job.period_end}
                </td>
                <td className="px-4 py-2">
                  {STATUS_LABEL[job.status] ?? job.status}
                  {job.status !== "done" && job.status !== "failed" && ` (${job.progress}%)`}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(job.created_at).toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
            {(!jobs || jobs.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  아직 실행한 리서치가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
