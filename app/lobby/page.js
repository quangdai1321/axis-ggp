import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import LobbySection from "./LobbySection";

export const metadata = { title: "Sảnh chờ — AXIS: Gadget Grand Prix" };
export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  if (!isSupabaseConfigured) {
    return (
      <main className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold mb-3">Chưa cấu hình Supabase</h1>
        <p className="text-white/70">Xem README để cấu hình biến môi trường trước.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: session }, { data: carSlots }] = await Promise.all([
    user
      ? supabase.from("profiles").select("username, is_admin").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("race_sessions")
      .select("id, status, laps, started_at")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("car_slots").select("id, slot_number, model_name, color_hex, speed_rating").order("slot_number"),
  ]);

  const { data: entries } = session
    ? await supabase
        .from("race_entries")
        .select("id, user_id, car_slot_id, nickname, position, finish_time")
        .eq("session_id", session.id)
    : { data: [] };

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      {!user && (
        <div className="bg-white/5 border border-axis-blue/40 rounded-2xl p-5 mb-8">
          <Link href="/login" className="text-axis-yellow font-extrabold underline">
            Đăng nhập
          </Link>{" "}
          để chọn xe và tham gia giải đấu.
        </div>
      )}

      <LobbySection
        session={session}
        carSlots={carSlots ?? []}
        initialEntries={entries ?? []}
        userId={user?.id ?? null}
        isAdmin={Boolean(profile?.is_admin)}
      />
    </main>
  );
}
