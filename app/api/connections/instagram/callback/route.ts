import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { saveConnection } from "@/lib/social/connections";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const CONNECTED_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
];

/** 이 라우트는 실제 Meta 문서 기준 흐름(인가 코드 -> 단기 토큰 -> 장기 토큰 -> Page 목록 ->
 * Page에 연결된 Instagram Business 계정)으로 작성했지만, 이 세션에는 실제 Meta 앱/테스트
 * 계정이 없어 라이브 호출은 검증하지 못했다 - 완료 보고에 명시. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Meta 앱 자격증명이 설정되지 않았습니다." } },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("ig_oauth_state")?.value;
  cookieStore.delete("ig_oauth_state");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/dashboard?instagram_connect=failed&reason=${encodeURIComponent(oauthError)}`, request.url)
    );
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`/dashboard?instagram_connect=failed&reason=invalid_state`, request.url));
  }

  try {
    // 1) 인가 코드 -> 단기 사용자 액세스 토큰
    const shortTokenUrl = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
    shortTokenUrl.searchParams.set("client_id", appId);
    shortTokenUrl.searchParams.set("redirect_uri", redirectUri);
    shortTokenUrl.searchParams.set("client_secret", appSecret);
    shortTokenUrl.searchParams.set("code", code);
    const shortTokenRes = await fetch(shortTokenUrl.toString());
    if (!shortTokenRes.ok) throw new Error(`토큰 교환 실패 (${shortTokenRes.status})`);
    const shortTokenData = await shortTokenRes.json();
    const shortLivedToken = shortTokenData.access_token as string;

    // 2) 단기 토큰 -> 장기(약 60일) 사용자 액세스 토큰
    const longTokenUrl = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortLivedToken);
    const longTokenRes = await fetch(longTokenUrl.toString());
    if (!longTokenRes.ok) throw new Error(`장기 토큰 교환 실패 (${longTokenRes.status})`);
    const longTokenData = await longTokenRes.json();
    const userAccessToken = longTokenData.access_token as string;
    const expiresInSec = Number(longTokenData.expires_in) || 60 * 24 * 3600;

    // 3) 이 사용자가 관리하는 Facebook Page 목록 - Instagram Business 계정은 Page에 연결되어 있다
    const pagesRes = await fetch(`${GRAPH_API_BASE}/me/accounts?access_token=${userAccessToken}`);
    if (!pagesRes.ok) throw new Error(`Page 목록 조회 실패 (${pagesRes.status})`);
    const pagesData = await pagesRes.json();
    const pages = (pagesData.data ?? []) as { id: string; name: string; access_token: string }[];

    const admin = createAdminClient();
    let connectedCount = 0;
    for (const page of pages) {
      const igRes = await fetch(
        `${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`
      );
      if (!igRes.ok) continue;
      const igData = await igRes.json();
      const igAccount = igData.instagram_business_account as { id: string; username: string } | undefined;
      if (!igAccount) continue; // 이 Page엔 연결된 Instagram Business 계정이 없음 - 스킵

      await saveConnection(admin, {
        userId: user.id,
        platform: "instagram",
        externalAccountId: igAccount.id,
        accountName: igAccount.username,
        accountType: "business",
        accessToken: page.access_token, // Instagram Graph API 호출은 Page 액세스 토큰을 쓴다
        tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
        scopes: CONNECTED_SCOPES,
      });
      connectedCount++;
    }

    if (connectedCount === 0) {
      return NextResponse.redirect(
        new URL(`/dashboard?instagram_connect=failed&reason=no_instagram_business_account`, request.url)
      );
    }
    return NextResponse.redirect(new URL(`/dashboard?instagram_connect=success&count=${connectedCount}`, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/dashboard?instagram_connect=failed&reason=${encodeURIComponent(message)}`, request.url));
  }
}
