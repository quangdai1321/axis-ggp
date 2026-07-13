import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Xếp hạng — AXIS: Gadget Grand Prix" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
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
    .select("id, status, laps")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestResults } = session
    ? await supabase
        .from("race_entries")
        .select("nickname, position, finish_time, car_slots(model_name, color_hex)")
        .eq("session_id", session.id)
        .not("position", "is", null)
        .order("position")
    : { data: [] };

  const { data: allEntries } = await supabase
    .from("race_entries")
    .select("nickname, position")
    .not("position", "is", null);

  const wins = new Map();
  (allEntries ?? []).forEach((e) => {
    if (e.position === 1) wins.set(e.nickname, (wins.get(e.nickname) ?? 0) + 1);
  });
  const hallOfFame = [...wins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <p className="text-axis-yellow font-extrabold tracking-widest text-xs uppercase mb-1">
        Xếp hạng
      </p>
      <h1 className="font-display text-3xl font-extrabold mb-8">Bảng xếp hạng</h1>

      <section className="mb-12">
        <h2 className="font-display font-extrabold text-lg mb-4">
          Kết quả ván {session ? `#${session.id}` : ""}
        </h2>
        {latestResults && latestResults.length > 0 ? (
          <ol className="space-y-2">
            {latestResults.map((r) => (
              <li
                key={r.position}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <span className="font-display font-extrabold text-axis-yellow w-8">
                    #{r.position}
                  </span>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: r.car_slots?.color_hex }}
                  />
                  <span className="font-bold">{r.nickname}</span>
                  <span className="text-white/50 text-xs hidden sm:inline">
                    {r.car_slots?.model_name}
                  </span>
                </span>
                <span className="text-white/60 text-sm">{r.finish_time?.toFixed(1)}s</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-white/60">
            Chưa có kết quả. Vào{" "}
            <Link href="/lobby" className="text-axis-yellow underline">
              Sảnh chờ
            </Link>{" "}
            để bắt đầu một ván đua.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display font-extrabold text-lg mb-4">🏆 Bảng vinh danh (số lần về nhất)</h2>
        {hallOfFame.length > 0 ? (
          <ol className="space-y-2">
            {hallOfFame.map(([nickname, count], i) => (
              <li
                key={nickname}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
              >
                <span className="font-bold">
                  {i + 1}. {nickname}
                </span>
                <span className="text-axis-yellow font-extrabold">{count} lần</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-white/60">Chưa có dữ liệu.</p>
        )}
      </section>
    </main>
  );
}
