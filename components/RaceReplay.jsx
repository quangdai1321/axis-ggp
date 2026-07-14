"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTrackById } from "../lib/tracks";
import { createAxisLogoDataUrl } from "../lib/axisLogoCanvas";
import { createClient } from "../lib/supabase/client";
import { finishSession } from "../app/lobby/actions";

const LANE_COUNT = 10;
const LANE_SPACING = 5.5;
const TRAIL_LEN = 9; // percent of path length
const CAR_POLY = "0,-6 9,0 0,6 2.5,0";
const CONFETTI_COLORS = ["#ff6fa1", "#ffcf3a", "#1e9bf0", "#53e07a", "#ff9a3c"];

function StartMarker({ pathD }) {
  const match = /^M\s*([\d.]+)[,\s]+([\d.]+)/.exec(pathD);
  if (!match) return null;
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  const cell = 5;
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2 === 0) continue;
      cells.push(<rect key={`${row}-${col}`} x={col * cell} y={row * cell} width={cell} height={cell} fill="#000" />);
    }
  }
  return (
    <g transform={`translate(${x - 10} ${y - 10})`}>
      <rect width="20" height="20" fill="#fff" />
      {cells}
    </g>
  );
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0 w-2 h-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 10) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function RaceReplay({ entries, laps, startedAt, status, trackId, sessionId, isAdmin }) {
  const router = useRouter();
  const pathRef = useRef(null);
  const carRefs = useRef([]);
  const trailRefs = useRef([]);
  const autoFinishedRef = useRef(false);
  const [standings, setStandings] = useState([]);
  const [raceOver, setRaceOver] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);

  const track = getTrackById(trackId);

  useEffect(() => {
    setLogoUrl(createAxisLogoDataUrl());
  }, []);

  // once the last car crosses the line, the admin's own browser closes
  // the session automatically — no need to walk back to the Lobby
  useEffect(() => {
    if (!raceOver || !isAdmin || !sessionId || status !== "racing" || autoFinishedRef.current) return;
    autoFinishedRef.current = true;
    const formData = new FormData();
    formData.set("sessionId", String(sessionId));
    finishSession(formData);
  }, [raceOver, isAdmin, sessionId, status]);

  // the page's props are a server-side snapshot — without this, someone
  // sitting on /race before the admin hits "start" would keep seeing the
  // pre-race snapshot (status: lobby, started_at: null) forever, which
  // rendered as cars frozen at the starting line
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("race-page-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "race_sessions" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "race_entries" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    if (status === "lobby" || entries.length === 0) return;
    const pathEl = pathRef.current;
    if (!pathEl) return;

    const totalLength = pathEl.getTotalLength();
    const maxFinish = Math.max(...entries.map((e) => e.finish_time ?? 999));
    const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;

    function updateFrame() {
      const elapsed = startedAtMs ? (Date.now() - startedAtMs) / 1000 : 0;

      const live = entries.map((entry, i) => {
        const finishTime = entry.finish_time ?? maxFinish;
        const progress = Math.min(1, Math.max(0, elapsed / finishTime));
        const distance = totalLength ? (progress * laps * totalLength) % totalLength : 0;
        const p = pathEl.getPointAtLength(distance);
        const p2 = pathEl.getPointAtLength(Math.min(totalLength, distance + 1));
        const angleRad = Math.atan2(p2.y - p.y, p2.x - p.x);
        const lane = i % LANE_COUNT;
        const laneOffset = (lane - (LANE_COUNT - 1) / 2) * LANE_SPACING;
        const nx = Math.cos(angleRad + Math.PI / 2) * laneOffset;
        const ny = Math.sin(angleRad + Math.PI / 2) * laneOffset;
        const x = p.x + nx;
        const y = p.y + ny;
        const deg = (angleRad * 180) / Math.PI;

        const g = carRefs.current[i];
        if (g) g.setAttribute("transform", `translate(${x} ${y}) rotate(${deg})`);

        const trail = trailRefs.current[i];
        if (trail && totalLength) {
          const progressPct = (distance / totalLength) * 100;
          trail.setAttribute("stroke-dashoffset", String(TRAIL_LEN - progressPct));
        }

        return {
          id: entry.id,
          nickname: entry.nickname,
          progress,
          finished: progress >= 1,
          colorHex: entry.color_hex || "#ffffff",
        };
      });

      live.sort((a, b) => b.progress - a.progress);
      setStandings(live);
      if (elapsed >= maxFinish) setRaceOver(true);
    }

    updateFrame();
    let frameId = requestAnimationFrame(function loop() {
      updateFrame();
      frameId = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frameId);
  }, [entries, laps, startedAt, status, trackId]);

  if (status === "lobby" || entries.length === 0) {
    return (
      <div className="w-full aspect-video rounded-2xl border-4 border-axis-blue bg-axis-navy/60 flex items-center justify-center text-center px-6">
        <p className="text-white/70">
          Chưa có trận đua nào đang diễn ra. Vào Sảnh chờ để chọn xe và chờ admin bắt đầu.
        </p>
      </div>
    );
  }

  const clipId = `logoClip-${track.id}`;

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 bg-[#0a0a0f]">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10">
          <span className="flex items-center gap-2 text-xs sm:text-sm font-bold tracking-wide text-white/70 uppercase">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "racing" ? "bg-red-500 animate-pulse" : "bg-white/30"
              }`}
            />
            {track.name}
          </span>
          <span className="text-xs sm:text-sm font-bold text-axis-yellow uppercase tracking-wide">
            {entries.length} xe · {status === "racing" ? "Đang đua" : "Đã kết thúc"} · {laps} vòng
          </span>
        </div>

        <svg viewBox={track.viewBox} className="w-full h-auto block">
          <defs>
            <pattern id="axisGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#1c1c24" />
            </pattern>
            <clipPath id={clipId}>
              <circle cx={track.center.x} cy={track.center.y} r={track.logoRadius} />
            </clipPath>
          </defs>
          <rect width="100%" height="100%" fill="#0d0d13" />
          <rect width="100%" height="100%" fill="url(#axisGrid)" />

          {logoUrl && (
            <image
              href={logoUrl}
              x={track.center.x - track.logoRadius}
              y={track.center.y - track.logoRadius}
              width={track.logoRadius * 2}
              height={track.logoRadius * 2}
              clipPath={`url(#${clipId})`}
              opacity="0.95"
            />
          )}

          <path d={track.d} fill="none" stroke="#24242e" strokeWidth="64" strokeLinejoin="round" />
          <path
            d={track.d}
            fill="none"
            stroke="#1e9bf0"
            strokeWidth="2"
            strokeDasharray="4 22"
            opacity="0.5"
            className="track-flow-line"
          />
          <path ref={pathRef} d={track.d} fill="none" stroke="none" />

          <StartMarker pathD={track.d} />

          {entries.map((entry, i) => (
            <g key={entry.id}>
              <path
                ref={(el) => (trailRefs.current[i] = el)}
                d={track.d}
                fill="none"
                stroke={entry.color_hex || "#ffffff"}
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${TRAIL_LEN} ${100 - TRAIL_LEN}`}
                opacity="0.5"
              />
              <g
                ref={(el) => (carRefs.current[i] = el)}
                style={{ filter: `drop-shadow(0 0 4px ${entry.color_hex || "#fff"})` }}
              >
                <polygon points={CAR_POLY} fill={entry.color_hex || "#ffffff"} />
              </g>
            </g>
          ))}
        </svg>

        {raceOver && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <span className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full">
                🏁 Đua xong! Vào Sảnh chờ để xem admin chốt kết quả.
              </span>
            </div>
            <Confetti />
          </>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-t border-white/10 max-h-24 overflow-y-auto">
          {entries.map((entry) => (
            <span key={entry.id} className="flex items-center gap-1.5 text-xs text-white/70">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color_hex || "#fff" }} />
              {entry.nickname}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-[500px] overflow-y-auto">
        <p className="font-display font-extrabold mb-3 text-axis-yellow text-sm uppercase tracking-wide">
          Bảng xếp hạng trực tiếp
        </p>
        <ol className="space-y-2 text-sm">
          {standings.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
              <span className="font-bold truncate flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.colorHex }} />
                {i === 0 ? "👑" : `${i + 1}.`} {s.nickname}
              </span>
              <span className="text-white/60 text-xs shrink-0">
                {s.finished ? "🏁 Về đích" : `${Math.round(s.progress * 100)}%`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
