"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TRACKS, DEFAULT_TRACK_ID } from "@/lib/tracks";

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

  const requestedTrackId = formData.get("trackId")?.toString();
  const trackId = TRACKS.some((t) => t.id === requestedTrackId) ? requestedTrackId : DEFAULT_TRACK_ID;

  const { error: sessionError } = await supabase
    .from("race_sessions")
    .update({ status: "racing", started_at: new Date().toISOString(), track_id: trackId })
    .eq("id", sessionId);

  if (sessionError) {
    return { error: `Không thể bắt đầu đua: ${sessionError.message}` };
  }

  revalidatePath("/lobby");
  revalidatePath("/race");
  revalidatePath("/leaderboard");
  return { success: true };
}

async function requireAdmin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập trước." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { error: "Chỉ admin mới dùng được chức năng này." };

  return { user };
}

export async function addTestEntries(formData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  const sessionId = Number(formData.get("sessionId"));
  const requestedCount = Number(formData.get("count")) || 0;

  const { data: session } = await supabase
    .from("race_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();
  if (!session || session.status !== "lobby") return { error: "Phiên đua không hợp lệ." };

  const [{ data: carSlots }, { data: existingEntries }] = await Promise.all([
    supabase.from("car_slots").select("id, slot_number"),
    supabase.from("race_entries").select("car_slot_id").eq("session_id", sessionId),
  ]);

  const takenSlotIds = new Set((existingEntries ?? []).map((e) => e.car_slot_id));
  const freeSlots = (carSlots ?? []).filter((c) => !takenSlotIds.has(c.id));
  if (freeSlots.length === 0) return { error: "Đã hết xe trống." };

  // shuffle so test cars don't always land on the lowest slot numbers
  for (let i = freeSlots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [freeSlots[i], freeSlots[j]] = [freeSlots[j], freeSlots[i]];
  }

  const count = Math.max(1, Math.min(requestedCount, freeSlots.length, 50));
  const rows = freeSlots.slice(0, count).map((slot) => ({
    session_id: sessionId,
    user_id: user.id,
    car_slot_id: slot.id,
    nickname: `Bot ${slot.slot_number}`,
    is_test: true,
  }));

  const { error } = await supabase.from("race_entries").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/lobby");
  return { success: true };
}

export async function clearTestEntries(formData) {
  const supabase = await createClient();
  const { error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  const sessionId = Number(formData.get("sessionId"));
  const { error } = await supabase
    .from("race_entries")
    .delete()
    .eq("session_id", sessionId)
    .eq("is_test", true);
  if (error) return { error: error.message };

  revalidatePath("/lobby");
  return { success: true };
}

export async function newSession() {
  const supabase = await createClient();
  const { error } = await supabase.from("race_sessions").insert({ status: "lobby", laps: 2 });
  if (error) return { error: error.message };

  revalidatePath("/lobby");
  revalidatePath("/race");
  return { success: true };
}

export async function finishSession(formData) {
  const supabase = await createClient();
  const sessionId = Number(formData.get("sessionId"));
  const { error } = await supabase.from("race_sessions").update({ status: "finished" }).eq("id", sessionId);
  if (error) return { error: error.message };

  revalidatePath("/lobby");
  revalidatePath("/race");
  revalidatePath("/leaderboard");
  return { success: true };
}
