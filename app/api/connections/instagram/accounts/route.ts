import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { listConnections } from "@/lib/social/connections";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  const connections = await listConnections(admin, user.id, "instagram");

  return NextResponse.json({
    configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    connections: connections.map((c) => ({
      id: c.id,
      accountName: c.accountName,
      accountType: c.accountType,
      tokenExpiresAt: c.tokenExpiresAt,
      connectionStatus: c.connectionStatus,
      createdAt: c.createdAt,
    })),
  });
}
