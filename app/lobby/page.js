import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { claimCar, dropCar, startRace, newSession, finishSession } from "./actions";

export const metadata = { title: "Sảnh chờ — AXIS: Gadget Grand Prix" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  lobby: "Đang mở — chọn xe đi!",
  racing: "Đang đua!",
  finished: "Đã kết thúc",
};

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

  const entryBySlot = new Map((entries ?? []).map((e) => [e.car_slot_id, e]));
  const myEntry = (entries ?? []).find((e) => e.user_id === user?.id);
  const isLobbyOpen = session?.status === "lobby";

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-axis-yellow font-extrabold tracking-widest text-xs uppercase mb-1">
            Sảnh chờ
          </p>
          <h1 className="font-display text-3xl font-extrabold">
            Chọn xe của bạn {session && `— ${entries?.length ?? 0} / 50`}
          </h1>
        </div>
        <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-bold">
          {session ? STATUS_LABEL[session.status] : "Chưa có phiên đua"}
        </span>
      </div>

      {!user && (
        <div className="bg-white/5 border border-axis-blue/40 rounded-2xl p-5 mb-8">
          <Link href="/login" className="text-axis-yellow font-extrabold underline">
            Đăng nhập
          </Link>{" "}
          để chọn xe và tham gia giải đấu.
        </div>
      )}

      {profile?.is_admin && session && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 flex flex-wrap items-center gap-3">
          <span className="font-extrabold text-axis-yellow text-sm uppercase tracking-wide">
            Điều khiển admin
          </span>
          {session.status === "lobby" && (
            <form action={startRace}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                disabled={(entries?.length ?? 0) === 0}
                className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full disabled:opacity-40 hover:scale-105 transition"
              >
                🏁 Bắt đầu đua ({entries?.length ?? 0} xe)
              </button>
            </form>
          )}
          {session.status === "racing" && (
            <>
              <Link
                href="/race"
                className="bg-axis-blue px-5 py-2 rounded-full font-extrabold hover:scale-105 transition"
              >
                Xem đua trực tiếp
              </Link>
              <form action={finishSession}>
                <input type="hidden" name="sessionId" value={session.id} />
                <button className="bg-white/10 px-5 py-2 rounded-full font-extrabold hover:bg-white/20 transition">
                  Chốt kết quả
                </button>
              </form>
            </>
          )}
          {session.status === "finished" && (
            <form action={newSession}>
              <button className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full hover:scale-105 transition">
                🔄 Ván mới
              </button>
            </form>
          )}
        </div>
      )}

      {myEntry && (
        <div className="bg-axis-blue/15 border border-axis-blue/50 rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
          <p>
            Xe của bạn: <span className="font-extrabold text-axis-yellow">{myEntry.nickname}</span>{" "}
            (#{myEntry.car_slot_id})
          </p>
          {isLobbyOpen && (
            <form action={dropCar}>
              <input type="hidden" name="entryId" value={myEntry.id} />
              <button className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-white/20 transition">
                Bỏ xe
              </button>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        {(carSlots ?? []).map((car) => {
          const entry = entryBySlot.get(car.id);
          const claimable = user && isLobbyOpen && !myEntry && !entry;
          return (
            <div
              key={car.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2"
              style={{ borderTopColor: car.color_hex, borderTopWidth: 3 }}
            >
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>#{car.slot_number}</span>
                <span>⚡ {car.speed_rating}</span>
              </div>
              <div
                className="h-8 rounded-lg"
                style={{ backgroundColor: car.color_hex }}
                aria-hidden
              />
              <p className="font-bold text-sm">{car.model_name}</p>
              {entry ? (
                <p className="text-xs text-axis-yellow font-bold truncate" title={entry.nickname}>
                  🏎️ {entry.nickname}
                </p>
              ) : claimable ? (
                <form action={claimCar} className="flex flex-col gap-1.5">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="carSlotId" value={car.id} />
                  <input
                    name="nickname"
                    placeholder="Đặt tên xe"
                    maxLength={24}
                    required
                    className="w-full bg-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-axis-blue"
                  />
                  <button className="bg-axis-blue text-xs font-extrabold py-1.5 rounded-lg hover:brightness-110 transition">
                    Chọn xe này
                  </button>
                </form>
              ) : (
                <p className="text-xs text-white/40">Trống</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
