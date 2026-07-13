import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import LoginForm from "./LoginForm";

export const metadata = { title: "Đăng nhập — AXIS: Gadget Grand Prix" };

export default async function LoginPage() {
  if (!isSupabaseConfigured) {
    return (
      <main className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold mb-3">Chưa cấu hình Supabase</h1>
        <p className="text-white/70">
          Thêm <code className="bg-white/10 px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          và <code className="bg-white/10 px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          vào <code className="bg-white/10 px-1.5 py-0.5 rounded">.env.local</code> (xem README) rồi
          khởi động lại server.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/lobby");

  return (
    <main className="max-w-md mx-auto px-5 py-16 sm:py-24">
      <h1 className="font-display text-3xl font-extrabold text-center mb-2">
        Vào AXIS
      </h1>
      <p className="text-white/60 text-center mb-10">
        Đăng nhập hoặc tạo tài khoản để chọn xe và tham gia Gadget Grand Prix.
      </p>
      <LoginForm />
    </main>
  );
}
