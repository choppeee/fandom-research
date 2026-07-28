"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error: string | null;
  message: string | null;
};

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 모두 입력해주세요.", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", message: null };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 모두 입력해주세요.", message: null };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다.", message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const message = error.message.toLowerCase().includes("already")
      ? "이미 가입된 이메일입니다. 로그인을 시도해주세요."
      : "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    return { error: message, message: null };
  }

  // Supabase 프로젝트의 "Confirm email" 설정이 꺼져 있으면 가입과 동시에 세션이 생성됨
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  return {
    error: null,
    message: "가입 확인 이메일을 보냈습니다. 받은편지함에서 링크를 눌러 인증을 완료해주세요.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
