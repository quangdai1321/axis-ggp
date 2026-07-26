import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { QUIZ_TOPICS } from "@/lib/quizData";
import RoomClient from "./RoomClient";

export const metadata = { title: "Quiz nhiều người — AXIS: Gadget Grand Prix" };
export const dynamic = "force-dynamic";

export default async function QuizRoomPage() {
  let username = null;
  let userId = null;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      username = profile?.username ?? null;
    }
  }

  const topics = QUIZ_TOPICS.map((t) => ({
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    count: t.questions.length,
  }));

  return (
    <main className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <div className="flex items-center justify-between mb-2">
        <p className="text-axis-yellow font-extrabold tracking-widest text-xs uppercase">
          Chơi trực tiếp nhiều người
        </p>
        <Link href="/quiz" className="text-white/60 hover:text-white text-sm font-bold">
          ← Quiz một mình
        </Link>
      </div>
      <h1 className="font-display text-3xl font-extrabold mb-2">Phòng Quiz ⚡</h1>
      <p className="text-white/60 mb-10 max-w-2xl">
        Chủ phòng tạo phòng và nhận mã, mọi người nhập mã để vào (không cần đăng nhập). Chủ phòng
        bấm <b>Bắt đầu</b> là tất cả cùng trả lời một câu tại một thời điểm — trả lời càng nhanh
        điểm càng cao. Hỗ trợ tới ~100 người mỗi phòng.
      </p>
      <RoomClient
        username={username}
        userId={userId}
        supabaseReady={isSupabaseConfigured}
        topics={topics}
      />
    </main>
  );
}
