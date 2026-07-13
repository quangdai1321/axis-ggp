"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const username = formData.get("username")?.toString().trim();

  if (!username || username.length < 3) {
    return { error: "Tên hiển thị phải có ít nhất 3 ký tự." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Đăng ký thành công! Kiểm tra email để xác nhận (nếu bật), sau đó đăng nhập." };
}

export async function signIn(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/lobby");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// used by the client SignOutButton, which forces a hard reload afterwards
// instead of relying on redirect()'s soft client-side navigation
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
