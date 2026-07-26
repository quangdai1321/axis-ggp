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

export async function createRoom({ topicId, custom }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Chỉ chủ phòng (đã đăng nhập) mới tạo được phòng." };

  let topicIdVal;
  let topicName;
  let questions;
  let answerKey;

  if (custom && Array.isArray(custom.questions) && custom.questions.length > 0) {
    // bộ câu hỏi tự tạo do client gửi lên — chỉ hỗ trợ câu 1 đáp án đúng
    for (const q of custom.questions) {
      if (!q || typeof q.text !== "string" || !Array.isArray(q.answers) || q.answers.length < 2) {
        return { error: "Bộ câu hỏi không hợp lệ." };
      }
      if (Array.isArray(q.correct)) {
        return {
          error: "Phòng nhiều người hiện chỉ hỗ trợ câu 1 đáp án đúng — bộ này có câu nhiều đáp án.",
        };
      }
      const c = Number(q.correct);
      if (!Number.isInteger(c) || c < 0 || c >= q.answers.length) {
        return { error: "Bộ câu hỏi không hợp lệ (đáp án đúng)." };
      }
    }
    const run = shuffleQuestions(custom.questions);
    questions = run.map((q) => ({ text: q.text, answers: q.answers }));
    answerKey = run.map((q) => q.correct);
    topicIdVal = "custom";
    topicName = String(custom.name || "Quiz tự tạo").slice(0, 60);
  } else {
    const topic = getTopic(topicId);
    if (!topic) return { error: "Chủ đề không hợp lệ." };
    const run = shuffleQuestions(topic.questions);
    questions = run.map((q) => ({ text: q.text, answers: q.answers }));
    answerKey = run.map((q) => q.correct);
    topicIdVal = topic.id;
    topicName = topic.name;
  }

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
        topic_id: topicIdVal,
        topic_name: topicName,
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
