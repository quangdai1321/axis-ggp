import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import RaceReplay from "../../components/RaceReplay";

export const metadata = { title: "Đường đua — AXIS: Gadget Grand Prix" };
export const dynamic = "force-dynamic";

export default async function RacePage() {
  if (!isSupabaseConfigured) {
    return (
      <main className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold mb-3">Chưa cấu hình Supabase</h1>
        <p className="text-white/70">Xem README để cấu hình biến môi trường trước.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("race_sessions")
    .select("id, status, laps, started_at")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: entries } = session
    ? await supabase
        .from("race_entries")
        .select("id, nickname, finish_time, position, car_slots(color_hex, model_name)")
        .eq("session_id", session.id)
        .not("finish_time", "is", null)
    : { data: [] };

  const flatEntries = (entries ?? []).map((e) => ({
    id: e.id,
    nickname: e.nickname,
    finish_time: e.finish_time,
    position: e.position,
    color_hex: e.car_slots?.color_hex,
    model_name: e.car_slots?.model_name,
  }));

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <p className="text-axis-yellow font-extrabold tracking-widest text-xs uppercase mb-1">
        Đường đua
      </p>
      <h1 className="font-display text-3xl font-extrabold mb-8">Trận đua trực tiếp</h1>
      <RaceReplay
        entries={flatEntries}
        laps={session?.laps ?? 2}
        startedAt={session?.started_at ?? null}
        status={session?.status ?? "lobby"}
      />
    </main>
  );
}
