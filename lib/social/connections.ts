import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "./token-crypto";

export type SocialAccountConnection = {
  id: string;
  userId: string;
  platform: string;
  externalAccountId: string;
  accountName: string | null;
  accountType: string | null;
  tokenExpiresAt: string | null;
  scopes: string[] | null;
  connectionStatus: "active" | "expired" | "revoked";
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): SocialAccountConnection {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    platform: row.platform as string,
    externalAccountId: row.external_account_id as string,
    accountName: (row.account_name as string) ?? null,
    accountType: (row.account_type as string) ?? null,
    tokenExpiresAt: (row.token_expires_at as string) ?? null,
    scopes: (row.scopes as string[]) ?? null,
    connectionStatus: row.connection_status as "active" | "expired" | "revoked",
    createdAt: row.created_at as string,
  };
}

export async function listConnections(admin: SupabaseClient, userId: string, platform?: string): Promise<SocialAccountConnection[]> {
  let query = admin.from("social_account_connections").select("*").eq("user_id", userId).eq("connection_status", "active");
  if (platform) query = query.eq("platform", platform);
  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []).map(mapRow);
}

export async function findConnectionByAccountName(
  admin: SupabaseClient,
  userId: string,
  platform: string,
  accountNameOrHandle: string
): Promise<SocialAccountConnection | null> {
  const { data } = await admin
    .from("social_account_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("connection_status", "active")
    .ilike("account_name", accountNameOrHandle)
    .maybeSingle();
  return data ? mapRow(data) : null;
}

export async function getDecryptedAccessToken(admin: SupabaseClient, connectionId: string): Promise<string | null> {
  const { data } = await admin.from("social_account_connections").select("encrypted_access_token").eq("id", connectionId).maybeSingle();
  if (!data?.encrypted_access_token) return null;
  return decryptToken(data.encrypted_access_token as string);
}

export async function saveConnection(
  admin: SupabaseClient,
  params: {
    userId: string;
    platform: string;
    externalAccountId: string;
    accountName: string | null;
    accountType: string | null;
    accessToken: string;
    tokenExpiresAt: string | null;
    scopes: string[];
  }
): Promise<void> {
  const { error } = await admin.from("social_account_connections").upsert(
    {
      user_id: params.userId,
      platform: params.platform,
      external_account_id: params.externalAccountId,
      account_name: params.accountName,
      account_type: params.accountType,
      encrypted_access_token: encryptToken(params.accessToken),
      token_expires_at: params.tokenExpiresAt,
      scopes: params.scopes,
      connection_status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_account_id" }
  );
  if (error) throw new Error(`계정 연결 저장 실패: ${error.message}`);
}

export async function disconnectAccount(admin: SupabaseClient, userId: string, connectionId: string): Promise<void> {
  // 토큰 자체를 지워서 연결 해제 후에는 복호화할 값 자체가 남지 않게 한다.
  const { error } = await admin
    .from("social_account_connections")
    .update({ connection_status: "revoked", encrypted_access_token: "", updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("user_id", userId);
  if (error) throw new Error(`연결 해제 실패: ${error.message}`);
}
