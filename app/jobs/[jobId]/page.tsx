import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobDashboard } from "@/components/JobDashboard";

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("research_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <Link href="/dashboard" className="text-sm underline underline-offset-2">
          ← 홈
        </Link>
        <Link href="/jobs" className="text-sm underline underline-offset-2">
          내 리서치 목록
        </Link>
      </header>
      <JobDashboard jobId={jobId} />
    </main>
  );
}
