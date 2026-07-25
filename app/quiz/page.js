import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTopic } from "@/lib/quizData";
import QuizGame from "./QuizGame";

export const metadata = { title: "Quiz — AXIS: Gadget Grand Prix" };
export const dynamic = "force-dynamic";

export default async function QuizPage() {
  let username = null;
  let topScores = [];

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      username = profile?.username ?? null;
    }

    const { data: scores } = await supabase
      .from("quiz_scores")
      .select("score, correct_count, question_count, topic_id, profiles(username)")
      .order("score", { ascending: false })
      .limit(10);

    topScores = (scores ?? []).map((s) => ({
      username: s.profiles?.username ?? "???",
      score: s.score,
      correct_count: s.correct_count,
      question_count: s.question_count,
      topicName: getTopic(s.topic_id)?.name ?? s.topic_id,
    }));
  }

  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <p className="text-axis-yellow font-extrabold tracking-widest text-xs uppercase mb-1">
        Giải trí giữa các ván đua
      </p>
      <h1 className="font-display text-3xl font-extrabold mb-2">Quiz thần tốc ⚡</h1>
      <p className="text-white/60 mb-10 max-w-2xl">
        Chọn chủ đề, trả lời nhanh và chính xác để ghi điểm — trả lời càng nhanh điểm càng cao,
        giữ chuỗi đúng liên tiếp để nhận thưởng thêm. Giống hệt quiz.com nhưng đậm chất AXIS!
      </p>
      <QuizGame username={username} supabaseReady={isSupabaseConfigured} topScores={topScores} />
    </main>
  );
}
