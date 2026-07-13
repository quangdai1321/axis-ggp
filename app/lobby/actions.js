"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const LAP_BASE_SECONDS = 25;

export async function claimCar(formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập trước." };

  const sessionId = Number(formData.get("sessionId"));
  const carSlotId = Number(formData.get("carSlotId"));
  const nickname = formData.get("nickname")?.toString().trim();

  if (!nickname || nickname.length < 1 || nickname.length > 24) {
    return { error: "Tên xe phải từ 1–24 ký tự." };
  }

  const { error } = await supabase.from("race_entries").insert({
    session_id: sessionId,
    user_id: user.id,
    car_slot_id: carSlotId,
    nickname,
  });

  if (error) {
    if (error.code === "23505") return { error: "Xe này vừa có người chọn, thử xe khác nhé." };
    return { error: error.message };
  }

  revalidatePath("/lobby");
  return { success: true };
}

export async function dropCar(formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập trước." };

  const entryId = Number(formData.get("entryId"));
  await supabase.from("race_entries").delete().eq("id", entryId).eq("user_id", user.id);

  revalidatePath("/lobby");
}

export async function startRace(formData) {
  const supabase = await createClient();
  const sessionId = Number(formData.get("sessionId"));

  const { data: session } = await supabase
    .from("race_sessions")
    .select("id, laps, status")
    .eq("id", sessionId)
    .single();
  if (!session || session.status !== "lobby") return { error: "Phiên đua không hợp lệ." };

  const { data: entries } = await supabase
    .from("race_entries")
    .select("id, car_slots(speed_rating)")
    .eq("session_id", sessionId);

  if (!entries || entries.length === 0) return { error: "Chưa có xe nào tham gia." };

  const results = entries.map((entry) => {
    const speedRating = entry.car_slots?.speed_rating ?? 1;
    const variance = Math.random() * 0.24 - 0.12;
    const gadgetEvent = Math.random() < 0.3 ? Math.random() * 8 - 3 : 0;
    const finishTime = Math.max(
      10,
      (LAP_BASE_SECONDS * session.laps) / speedRating * (1 + variance) + gadgetEvent
    );
    return { id: entry.id, finishTime };
  });

  results.sort((a, b) => a.finishTime - b.finishTime);

  await Promise.all(
    results.map((r, i) =>
      supabase
        .from("race_entries")
        .update({ finish_time: r.finishTime, position: i + 1 })
        .eq("id", r.id)
    )
  );

  await supabase
    .from("race_sessions")
    .update({ status: "racing", started_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath("/lobby");
  revalidatePath("/race");
  revalidatePath("/leaderboard");
}

export async function newSession() {
  const supabase = await createClient();
  await supabase.from("race_sessions").insert({ status: "lobby", laps: 2 });
  revalidatePath("/lobby");
  revalidatePath("/race");
}

export async function finishSession(formData) {
  const supabase = await createClient();
  const sessionId = Number(formData.get("sessionId"));
  await supabase.from("race_sessions").update({ status: "finished" }).eq("id", sessionId);
  revalidatePath("/lobby");
  revalidatePath("/race");
  revalidatePath("/leaderboard");
}
