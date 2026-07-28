import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트.
 * 반드시 NEXT_PUBLIC_ 접두사가 붙은, 공개해도 안전한 publishable key만 사용한다.
 * secret key는 절대 이 파일이나 클라이언트 코드에 넣지 않는다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
