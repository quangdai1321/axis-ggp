"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { claimCar, dropCar, startRace, newSession, finishSession } from "./actions";

const STATUS_LABEL = {
  lobby: "Đang mở — chọn xe đi!",
  racing: "Đang đua!",
  finished: "Đã kết thúc",
};

export default function LobbySection({ session: initialSession, carSlots, initialEntries, userId, isAdmin }) {
  const [session, setSession] = useState(initialSession);
  const [entries, setEntries] = useState(initialEntries);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!initialSession) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`lobby-session-${initialSession.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "race_entries", filter: `session_id=eq.${initialSession.id}` },
        (payload) => {
          setEntries((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((e) => e.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((e) => e.id !== payload.old.id);
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((e) => (e.id === payload.new.id ? { ...e, ...payload.new } : e));
            }
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "race_sessions", filter: `id=eq.${initialSession.id}` },
        (payload) => setSession((prev) => ({ ...prev, ...payload.new }))
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialSession?.id]);

  if (!session) {
    return <p className="text-white/60">Chưa có phiên đua.</p>;
  }

  const entryBySlot = new Map(entries.map((e) => [e.car_slot_id, e]));
  const myEntry = entries.find((e) => e.user_id === userId);
  const isLobbyOpen = session.status === "lobby";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-axis-yellow font-extrabold tracking-widest text-xs uppercase mb-1">
            Sảnh chờ
          </p>
          <h1 className="font-display text-3xl font-extrabold">
            Chọn xe của bạn — {entries.length} / 50
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${live ? "bg-emerald-400" : "bg-white/30"}`}
            title={live ? "Đang cập nhật trực tiếp" : "Đang kết nối..."}
          />
          <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-bold">
            {STATUS_LABEL[session.status]}
          </span>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 flex flex-wrap items-center gap-3">
          <span className="font-extrabold text-axis-yellow text-sm uppercase tracking-wide">
            Điều khiển admin
          </span>
          {session.status === "lobby" && (
            <form action={startRace}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                disabled={entries.length === 0}
                className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full disabled:opacity-40 hover:scale-105 transition"
              >
                🏁 Bắt đầu đua ({entries.length} xe)
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

      {!isAdmin && session.status === "racing" && (
        <div className="bg-white/5 border border-axis-blue/40 rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
          <p>Trận đua đang diễn ra!</p>
          <Link href="/race" className="bg-axis-blue px-5 py-2 rounded-full font-extrabold hover:scale-105 transition">
            Xem đua trực tiếp
          </Link>
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
        {carSlots.map((car) => {
          const entry = entryBySlot.get(car.id);
          const claimable = userId && isLobbyOpen && !myEntry && !entry;
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
              <div className="h-8 rounded-lg" style={{ backgroundColor: car.color_hex }} aria-hidden />
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
    </>
  );
}
