import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { disconnectAccount } from "@/lib/social/connections";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const connectionId = String(body?.connectionId ?? "");
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  await disconnectAccount(admin, user.id, connectionId);
  return NextResponse.json({ ok: true });
}
