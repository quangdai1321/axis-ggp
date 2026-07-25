"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTopic } from "@/lib/quizData";

// Điểm tối đa lý thuyết: 10 câu × (1000 điểm tốc độ + 300 thưởng chuỗi)
const MAX_SCORE_PER_QUESTION = 1300;

export async function submitQuizScore({ topicId, score, correctCount, questionCount }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập trước." };

  const topic = getTopic(topicId);
  if (!topic) return { error: "Chủ đề không hợp lệ." };

  const nQuestions = Number(questionCount);
  const nCorrect = Number(correctCount);
  const nScore = Number(score);

  if (
    !Number.isInteger(nQuestions) ||
    nQuestions < 1 ||
    nQuestions > topic.questions.length ||
    !Number.isInteger(nCorrect) ||
    nCorrect < 0 ||
    nCorrect > nQuestions ||
    !Number.isInteger(nScore) ||
    nScore < 0 ||
    nScore > nQuestions * MAX_SCORE_PER_QUESTION
  ) {
    return { error: "Kết quả không hợp lệ." };
  }

  const { error } = await supabase.from("quiz_scores").insert({
    user_id: user.id,
    topic_id: topicId,
    score: nScore,
    correct_count: nCorrect,
    question_count: nQuestions,
  });
  if (error) return { error: error.message };

  revalidatePath("/quiz");
  return { success: true };
}
