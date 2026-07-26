"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { getTrackById } from "../lib/tracks";
import { createClient } from "../lib/supabase/client";
import { finishSession } from "../app/lobby/actions";
import {
  createSkyDome,
  createGroundMaterial,
  createTrackMaterial,
  createCurbMaterial,
  addCityscape,
} from "../lib/three/environment";

const SCALE = 0.06; // đổi toạ độ SVG (1400x800) sang mét trong cảnh 3D
const TRACK_WIDTH = 8.5;
const LANE_COUNT = 6;
const LANE_SPACING = 1.05;
const CONFETTI_COLORS = ["#ff6fa1", "#ffcf3a", "#1e9bf0", "#53e07a", "#ff9a3c"];

// Lấy mẫu điểm dọc theo path SVG rồi đổi sang toạ độ 3D (mặt phẳng y=0)
function sampleTrackPoints(pathD, samples, cx, cy) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.left = "-9999px";
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const total = path.getTotalLength();
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const p = path.getPointAtLength((i / samples) * total);
    pts.push(new THREE.Vector3((p.x - cx) * SCALE, 0, (p.y - cy) * SCALE));
  }
  document.body.removeChild(svg);
  return pts;
}

// Dải mặt đường bám theo đường cong
function buildRibbon(curve, width, segments, material, y) {
  const up = new THREE.Vector3(0, 1, 0);
  const pos = [];
  const uv = [];
  const idx = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const S = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T).normalize();
    S.crossVectors(T, up).normalize().multiplyScalar(width / 2);
    pos.push(P.x + S.x, y, P.z + S.z, P.x - S.x, y, P.z - S.z);
    const v = (u * segments) / 8;
    uv.push(0, v, 1, v);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(g, material);
}

// Viền vỉa (curb) đỏ-trắng chạy dọc mép đường
function buildEdge(curve, offset, width, segments, material, y) {
  const up = new THREE.Vector3(0, 1, 0);
  const pos = [];
  const uv = [];
  const idx = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const S = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T).normalize();
    S.crossVectors(T, up).normalize();
    const cx = P.x + S.x * offset;
    const cz = P.z + S.z * offset;
    pos.push(
      cx + S.x * (width / 2),
      y,
      cz + S.z * (width / 2),
      cx - S.x * (width / 2),
      y,
      cz - S.z * (width / 2)
    );
    uv.push(0, u * segments, 1, u * segments);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(g, material);
}

// Xe kart 3D đơn giản, hướng đầu xe theo trục +z
function makeKart(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.35, 1.9),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 })
  );
  body.position.y = 0.34;
  g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.34, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.4 })
  );
  cabin.position.set(0, 0.66, -0.08);
  g.add(cabin);

  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color })
  );
  nose.position.set(0, 0.28, 1.0);
  g.add(nose);

  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.24, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.8 });
  [
    [0.62, 0.28, 0.62],
    [-0.62, 0.28, 0.62],
    [0.62, 0.28, -0.62],
    [-0.62, 0.28, -0.62],
  ].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
  });
  return g;
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
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
  const mountRef = useRef(null);
  const autoFinishedRef = useRef(false);
  const [standings, setStandings] = useState([]);
  const [raceOver, setRaceOver] = useState(false);

  const track = getTrackById(trackId);

  // admin tự chốt ván khi xe cuối cán đích
  useEffect(() => {
    if (!raceOver || !isAdmin || !sessionId || status !== "racing" || autoFinishedRef.current) return;
    autoFinishedRef.current = true;
    const formData = new FormData();
    formData.set("sessionId", String(sessionId));
    finishSession(formData);
  }, [raceOver, isAdmin, sessionId, status]);

  // realtime: khi admin bắt đầu / cập nhật thì refresh lại props từ server
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
        sessionId
          ? { event: "*", schema: "public", table: "race_entries", filter: `session_id=eq.${sessionId}` }
          : { event: "*", schema: "public", table: "race_entries" },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, sessionId]);

  // ================= Cảnh 3D =================
  useEffect(() => {
    if (status === "lobby" || entries.length === 0) return;
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 800;
    let height = mount.clientHeight || Math.round(width * 0.5625);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbfe8ff, 130, 520);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x0a1a2f, 1);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x557755, 1.05));
    const dir = new THREE.DirectionalLight(0xfff4d6, 1.2);
    dir.position.set(30, 60, 20);
    scene.add(dir);

    scene.add(createSkyDome(THREE));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), createGroundMaterial(THREE));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    scene.add(ground);

    // đường đua từ path SVG
    const pts = sampleTrackPoints(track.d, 220, track.center.x, track.center.y);
    const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
    let radius = 0;
    pts.forEach((p) => (radius = Math.max(radius, Math.hypot(p.x, p.z))));

    scene.add(buildRibbon(curve, TRACK_WIDTH, 360, createTrackMaterial(THREE), 0.02));
    scene.add(buildEdge(curve, TRACK_WIDTH / 2, 0.45, 360, createCurbMaterial(THREE), 0.05));
    scene.add(buildEdge(curve, -TRACK_WIDTH / 2, 0.45, 360, createCurbMaterial(THREE), 0.05));

    addCityscape(scene, THREE, radius);

    const cars = entries.map((e) => {
      const kart = makeKart(new THREE.Color(e.color_hex || "#ffffff"));
      scene.add(kart);
      return kart;
    });

    const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;
    const maxFinish = Math.max(...entries.map((e) => e.finish_time ?? 999));
    const up = new THREE.Vector3(0, 1, 0);
    const P = new THREE.Vector3();
    const T = new THREE.Vector3();
    const S = new THREE.Vector3();
    let camAngle = Math.PI * 0.25;
    let lastPush = 0;
    let frameId;

    const camDist = radius * 1.9 + 12;
    const camH = radius * 1.05 + 10;

    function frame(now) {
      const elapsed = startedAtMs ? (Date.now() - startedAtMs) / 1000 : 0;

      const live = entries.map((entry, i) => {
        const finishTime = entry.finish_time ?? maxFinish;
        const progress = Math.min(1, Math.max(0, elapsed / finishTime));
        const u = (((progress * laps) % 1) + 1) % 1;
        curve.getPointAt(u, P);
        curve.getTangentAt(u, T).normalize();
        S.crossVectors(T, up).normalize();
        const lane = i % LANE_COUNT;
        const laneOffset = (lane - (LANE_COUNT - 1) / 2) * LANE_SPACING;
        const kart = cars[i];
        kart.position.set(P.x + S.x * laneOffset, 0, P.z + S.z * laneOffset);
        kart.rotation.y = Math.atan2(T.x, T.z);
        return {
          i,
          id: entry.id,
          nickname: entry.nickname,
          progress,
          finished: progress >= 1,
          colorHex: entry.color_hex || "#ffffff",
        };
      });

      live.sort((a, b) => b.progress - a.progress);

      camAngle += 0.0013;
      camera.position.set(Math.cos(camAngle) * camDist, camH, Math.sin(camAngle) * camDist);
      camera.lookAt(0, 1.5, 0);

      if (!lastPush || now - lastPush > 200) {
        lastPush = now;
        setStandings(live);
      }
      if (elapsed >= maxFinish) setRaceOver(true);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || Math.round(width * 0.5625);
      if (width && height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    };
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

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 bg-[#0a1a2f]">
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

        <div ref={mountRef} className="relative w-full aspect-video">
          {raceOver && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center z-10">
                <span className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full">
                  🏁 Đua xong! Vào Sảnh chờ để xem admin chốt kết quả.
                </span>
              </div>
              <Confetti />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-t border-white/10 max-h-24 overflow-y-auto">
          {entries.map((entry) => (
            <span key={entry.id} className="flex items-center gap-1.5 text-xs text-white/70">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color_hex || "#fff" }}
              />
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
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.colorHex }}
                />
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
