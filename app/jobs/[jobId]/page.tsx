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

  return <JobDashboard jobId={jobId} />;
}
