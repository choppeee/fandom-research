import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { youtubeUrlResolver } from "@/lib/sources/youtubeUrlResolver";

const RESOLVERS = [youtubeUrlResolver];

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

  const resolver = RESOLVERS.find((r) => r.matches(url));
  if (!resolver) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_url", message: "유효한 YouTube 영상 링크를 입력해주세요." } },
      { status: 400 }
    );
  }

  const result = await resolver.resolve(url);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, source: result.source });
}
