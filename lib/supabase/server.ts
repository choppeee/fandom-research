import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * 서버 사이드 전용 Supabase 클라이언트 (API Route, 서버 컴포넌트에서만 사용).
 * 사용자 인증 세션이 필요한 일반 서버 작업에 사용한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 호출된 경우 무시 (미들웨어가 세션을 갱신함)
          }
        },
      },
    }
  );
}

/**
 * 관리자 권한(secret key)이 필요한 작업 전용 클라이언트.
 * - YouTube 데이터 수집, Claude 분석 결과 저장 등 백엔드 배치 작업에서만 사용.
 * - RLS(Row Level Security)를 우회하므로 절대 클라이언트 코드에서 import 금지.
 * - SUPABASE_SECRET_KEY는 .env에만 저장하고 NEXT_PUBLIC_ 접두사를 붙이지 않는다.
 */
export function createAdminClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
