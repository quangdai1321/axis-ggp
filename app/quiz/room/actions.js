"use server";

import { createClient } from "@/lib/supabase/server";
import { getTopic, shuffleQuestions } from "@/lib/quizData";

// Mã phòng 5 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I...)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export async function createRoom({ topicId }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Chỉ chủ phòng (đã đăng nhập) mới tạo được phòng." };

  const topic = getTopic(topicId);
  if (!topic) return { error: "Chủ đề không hợp lệ." };

  const run = shuffleQuestions(topic.questions);
  const questions = run.map((q) => ({ text: q.text, answers: q.answers }));
  const answerKey = run.map((q) => q.correct);

  let code = null;
  let roomId = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = genCode();
    const { data, error } = await supabase
      .from("quiz_rooms")
      .insert({
        code: candidate,
        host_id: user.id,
        topic_id: topic.id,
        topic_name: topic.name,
        questions,
        status: "lobby",
        current_index: -1,
      })
      .select("id, code")
      .single();
    if (!error) {
      code = data.code;
      roomId = data.id;
      break;
    }
    lastErr = error;
    if (error.code !== "23505") break; // 23505 = trùng mã, thử lại; lỗi khác thì dừng
  }
  if (!code) return { error: lastErr?.message || "Không tạo được phòng." };

  const { error: keyErr } = await supabase
    .from("quiz_room_keys")
    .insert({ room_id: roomId, answer_key: answerKey });
  if (keyErr) {
    await supabase.from("quiz_rooms").delete().eq("id", roomId);
    return { error: keyErr.message };
  }

  return { success: true, code, roomId };
}

export async function advanceRoom({ roomId }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const { data: room, error } = await supabase
    .from("quiz_rooms")
    .select("id, host_id, status, current_index, questions")
    .eq("id", roomId)
    .single();
  if (error || !room) return { error: "Phòng không tồn tại." };
  if (room.host_id !== user.id) return { error: "Chỉ chủ phòng mới điều khiển được." };

  const total = Array.isArray(room.questions) ? room.questions.length : 0;
  let patch;
  if (room.status === "lobby") {
    patch = { status: "playing", current_index: 0, question_started_at: new Date().toISOString() };
  } else if (room.status === "playing" && room.current_index + 1 < total) {
    patch = {
      status: "playing",
      current_index: room.current_index + 1,
      question_started_at: new Date().toISOString(),
    };
  } else {
    patch = { status: "finished" };
  }

  const { error: upErr } = await supabase.from("quiz_rooms").update(patch).eq("id", roomId);
  if (upErr) return { error: upErr.message };
  return { success: true };
}

export async function closeRoom({ roomId }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const { error } = await supabase.from("quiz_rooms").update({ status: "finished" }).eq("id", roomId);
  if (error) return { error: error.message };
  return { success: true };
}
