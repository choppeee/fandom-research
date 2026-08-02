import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

const META_OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";
// Instagram Graph API는 Facebook 로그인(OAuth)을 그대로 쓴다 - 연결 대상은 Facebook Page에
// 붙어있는 Instagram Business/Creator 계정이다(개인 계정은 이 방식으로 연결할 수 없음).
const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json(
      {
        error: {
          code: "not_configured",
          message: "Meta 앱 자격증명(META_APP_ID/META_OAUTH_REDIRECT_URI)이 아직 설정되지 않았습니다. 계정 연결을 사용할 수 없습니다.",
        },
      },
      { status: 503 }
    );
  }

  // CSRF 방지: 서버가 발급한 state를 httpOnly 쿠키에 저장해두고, 콜백에서 그대로 돌아왔는지 대조한다.
  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authUrl = new URL(META_OAUTH_DIALOG);
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));

  return NextResponse.redirect(authUrl.toString());
}
