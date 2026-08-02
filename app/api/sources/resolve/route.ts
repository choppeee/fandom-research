import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findAdapterForUrl } from "@/lib/social/registry";

/** Instant Intelligence "링크 붙여넣기" 탭의 미리보기 전용 엔드포인트.
 * YouTube 영상/채널, Instagram 게시물/릴스/프로필을 전부 findAdapterForUrl 하나로 판별한다 -
 * 새 플랫폼을 추가할 때 이 라우트는 건드릴 필요가 없다(registry.ts에만 추가). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = String(body?.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ ok: false, error: { code: "invalid_url", message: "링크를 입력해주세요." } }, { status: 400 });
  }

  const adapter = findAdapterForUrl(url);
  if (!adapter) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "not_supported_yet",
          message: "아직 지원하지 않는 링크 형식입니다. YouTube 영상/채널, Instagram 게시물·릴스·프로필 링크를 입력해주세요.",
        },
      },
      { status: 400 }
    );
  }

  const result = await adapter.resolve(url, { userId: user.id });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, source: result.source });
}
