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

const SCALE = 0.1; // đổi toạ độ SVG (1400x800) sang mét trong cảnh 3D (to & dài hơn)
const TRACK_WIDTH = 13;
const LANE_COUNT = 8; // số làn ngang
const LANE_SPACING = 1.4;
const ROW_GAP = 4; // khoảng cách trước-sau giữa các hàng xe (chống chồng lên nhau)
// camera bám theo xe dẫn đầu (kiểu quay phim)
const CAM_BACK = 12; // lùi sau xe
const CAM_HEIGHT = 6.5; // cao hơn xe
const CAM_LOOK_AHEAD = 5; // nhìn về phía trước xe
// góc máy trên không (bird's-eye), luân phiên với camera bám xe
const AERIAL_HEIGHT = 32;
const AERIAL_BACK = 10;
const CAM_MODE_SECONDS = 8; // đổi góc máy mỗi 8 giây
const CAM_MODES = ["chase", "aerial", "side"];
const CAM_MODE_LABEL = { chase: "Bám xe", aerial: "Trên không", side: "Bên hông" };
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

// Xe kart 3D đơn giản, hướng đầu xe theo trục +z. Trả về group + mảng bánh xe
// để quay bánh trong lúc chạy.
function makeKart(color) {
  const g = new THREE.Group();
  // `tilt` nhận độ nghiêng khi vào cua + nhún nhẹ, để group gốc giữ nguyên hướng
  const tilt = new THREE.Group();
  g.add(tilt);

  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.35,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 1.9), bodyMat);
  body.position.y = 0.36;
  body.castShadow = true;
  tilt.add(body);

  // thân dưới bo hẹp cho dáng thể thao
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.14, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 0.7 })
  );
  skirt.position.y = 0.2;
  tilt.add(skirt);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.3, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.25, metalness: 0.5 })
  );
  cabin.position.set(0, 0.66, -0.1);
  cabin.castShadow = true;
  tilt.add(cabin);

  // tay đua (mũ bảo hiểm)
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.3 })
  );
  helmet.position.set(0, 0.87, -0.12);
  helmet.castShadow = true;
  tilt.add(helmet);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.55), bodyMat);
  nose.position.set(0, 0.3, 1.05);
  nose.castShadow = true;
  tilt.add(nose);

  // cánh gió sau
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.5 });
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.07, 0.34), wingMat);
  wing.position.set(0, 0.86, -1.0);
  wing.castShadow = true;
  tilt.add(wing);
  [-0.48, 0.48].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), wingMat);
    post.position.set(x, 0.68, -1.0);
    tilt.add(post);
  });

  // trục bánh nằm dọc x (bake sẵn vào geometry) -> quay bánh bằng rotation.x
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.85 });
  const wheels = [];
  [
    [0.64, 0.32, 0.62],
    [-0.64, 0.32, 0.62],
    [0.64, 0.32, -0.64],
    [-0.64, 0.32, -0.64],
  ].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    tilt.add(w);
  });

  // luồng lửa tăng tốc (chỉ bật cho top 3)
  const boost = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.9, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x8fe3ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  // xoay để đỉnh nón chĩa về phía sau xe (-z)
  boost.rotation.x = -Math.PI / 2;
  boost.position.set(0, 0.38, -1.35);
  tilt.add(boost);

  return { group: g, tilt, wheels, boost };
}

// Vạch xuất phát ca-rô cắt ngang mặt đường
function makeStartLine(curve, width) {
  const P = curve.getPointAt(0);
  const T = curve.getTangentAt(0).normalize();
  const S = new THREE.Vector3().crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize();

  const cells = 12;
  const cellW = width / cells;
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(cellW, 1.1);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x14161d });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cells; c++) {
      const m = new THREE.Mesh(geo, (r + c) % 2 === 0 ? white : black);
      m.rotation.x = -Math.PI / 2;
      const off = (c - (cells - 1) / 2) * cellW;
      m.position.set(
        P.x + S.x * off + T.x * (r * 1.1),
        0.06,
        P.z + S.z * off + T.z * (r * 1.1)
      );
      m.rotation.z = -Math.atan2(T.x, T.z);
      group.add(m);
    }
  }
  return group;
}

// Vạch tim đường đứt quãng
function makeCenterDashes(curve, count) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.22, 1.6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = i / count;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T).normalize();
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(T.x, T.z);
    m.position.set(P.x, 0.05, P.z);
    group.add(m);
  }
  return group;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Nhãn tên người chơi nổi phía trên xe (sprite luôn quay mặt về camera)
function makeNameSprite(text, colorHex) {
  const w = 256;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10,26,47,0.82)";
  roundRectPath(ctx, 6, 12, w - 12, h - 24, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = colorHex || "#ffffff";
  roundRectPath(ctx, 6, 12, w - 12, h - 24, 16);
  ctx.stroke();

  let label = text || "";
  if (label.length > 14) label = label.slice(0, 13) + "…";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  sprite.scale.set((w / h) * 0.85, 0.85, 1);
  sprite.position.y = 2.2;
  return sprite;
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
  const [hud, setHud] = useState(null); // { leader, lap, mode }

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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // tone-mapping điện ảnh cho màu dịu & tương phản hiện đại hơn
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0a1a2f, 1);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x4e7a52, 1.0));
    const dir = new THREE.DirectionalLight(0xfff4d6, 1.45);
    dir.position.set(40, 70, 25);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.bias = -0.0008;
    scene.add(dir);

    scene.add(createSkyDome(THREE));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), createGroundMaterial(THREE));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    scene.add(ground);

    // đường đua từ path SVG
    const pts = sampleTrackPoints(track.d, 220, track.center.x, track.center.y);
    const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
    const trackLen = curve.getLength();
    let radius = 0;
    pts.forEach((p) => (radius = Math.max(radius, Math.hypot(p.x, p.z))));

    const road = buildRibbon(curve, TRACK_WIDTH, 420, createTrackMaterial(THREE), 0.02);
    road.receiveShadow = true;
    scene.add(road);
    scene.add(buildEdge(curve, TRACK_WIDTH / 2, 0.5, 420, createCurbMaterial(THREE), 0.05));
    scene.add(buildEdge(curve, -TRACK_WIDTH / 2, 0.5, 420, createCurbMaterial(THREE), 0.05));
    scene.add(makeCenterDashes(curve, 90));
    scene.add(makeStartLine(curve, TRACK_WIDTH));

    addCityscape(scene, THREE, radius);

    // khung chiếu bóng ôm vừa đường đua để bóng nét
    const shadowSpan = radius + 25;
    dir.shadow.camera.left = -shadowSpan;
    dir.shadow.camera.right = shadowSpan;
    dir.shadow.camera.top = shadowSpan;
    dir.shadow.camera.bottom = -shadowSpan;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 400;
    dir.shadow.camera.updateProjectionMatrix();

    const cars = entries.map((e) => {
      const kart = makeKart(new THREE.Color(e.color_hex || "#ffffff"));
      kart.group.add(makeNameSprite(e.nickname, e.color_hex || "#ffffff"));
      scene.add(kart.group);
      return kart;
    });

    const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;
    const maxFinish = Math.max(...entries.map((e) => e.finish_time ?? 999));
    const up = new THREE.Vector3(0, 1, 0);
    const P = new THREE.Vector3();
    const T = new THREE.Vector3();
    const S = new THREE.Vector3();
    const F = new THREE.Vector3();
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    const smoothLook = new THREE.Vector3();
    let camReady = false;
    let lastPush = 0;
    let lastT = performance.now();
    let frameId;
    const prevHeading = new Float32Array(entries.length);
    const roll = new Float32Array(entries.length);

    function frame(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const elapsed = startedAtMs ? (Date.now() - startedAtMs) / 1000 : 0;

      const live = entries.map((entry, i) => {
        const finishTime = entry.finish_time ?? maxFinish;
        const base = Math.min(1, Math.max(0, elapsed / finishTime));
        // biến tốc độ (nhanh/chậm) nhưng LUÔN tiến tới — không tụt lùi.
        // Đây là hàm warp đơn điệu (đạo hàm luôn > 0), chỉnh để progress(0)=0,
        // progress(1)=1 nên vẫn về đích đúng thứ hạng theo finish_time.
        const w2 = 6 + (i % 4);
        const ph = i * 1.7;
        const A = 0.7 / w2; // A*w2 = 0.7 < 1 -> đạo hàm luôn dương
        const endErr = A * (Math.sin(ph + w2) - Math.sin(ph));
        const progress = Math.min(
          1,
          Math.max(0, base + A * (Math.sin(ph + w2 * base) - Math.sin(ph)) - base * endErr)
        );

        // xếp xe thành lưới: cột = làn ngang, hàng = lùi dần về sau -> không đè nhau
        const col = i % LANE_COUNT;
        const row = Math.floor(i / LANE_COUNT);
        const lateral = (col - (LANE_COUNT - 1) / 2) * LANE_SPACING;
        const dist = progress * laps * trackLen - row * ROW_GAP;
        const u = (((dist / trackLen) % 1) + 1) % 1;
        curve.getPointAt(u, P);
        curve.getTangentAt(u, T).normalize();
        S.crossVectors(T, up).normalize();
        const kart = cars[i];
        kart.group.position.set(P.x + S.x * lateral, 0, P.z + S.z * lateral);
        const heading = Math.atan2(T.x, T.z);
        kart.group.rotation.y = heading;

        // nghiêng thân xe theo độ gắt của cua (mượt dần) + nhún nhẹ khi chạy
        let dh = heading - prevHeading[i];
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        prevHeading[i] = heading;
        const targetRoll = dt > 0 ? Math.max(-0.3, Math.min(0.3, (dh / dt) * 0.16)) : 0;
        roll[i] += (targetRoll - roll[i]) * (1 - Math.exp(-8 * dt));
        kart.tilt.rotation.z = roll[i];
        kart.tilt.position.y =
          progress < 1 ? Math.sin(now * 0.011 + i * 2.1) * 0.022 : 0;

        // quay bánh khi chưa về đích
        if (progress < 1) {
          for (let w = 0; w < kart.wheels.length; w++) kart.wheels[w].rotation.x -= dt * 16;
        }
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

      // lửa tăng tốc: chỉ top 3 và khi chưa về đích
      for (let k = 0; k < live.length; k++) {
        const kart = cars[live[k].i];
        const on = k < 3 && !live[k].finished;
        const target = on ? 0.5 + Math.sin(now * 0.02 + k) * 0.22 : 0;
        const m = kart.boost.material;
        m.opacity += (target - m.opacity) * (1 - Math.exp(-10 * dt));
        kart.boost.scale.y = 0.85 + m.opacity * 0.6; // trục y = chiều dài nón
      }

      // camera: luân phiên 3 góc máy quanh xe dẫn đầu
      const leader = cars[live[0].i].group;
      const h = leader.rotation.y;
      F.set(Math.sin(h), 0, Math.cos(h)); // hướng đầu xe dẫn đầu
      const mode = CAM_MODES[Math.floor(elapsed / CAM_MODE_SECONDS) % CAM_MODES.length];
      if (mode === "aerial") {
        desiredPos.set(
          leader.position.x - F.x * AERIAL_BACK,
          AERIAL_HEIGHT,
          leader.position.z - F.z * AERIAL_BACK
        );
        desiredLook.set(leader.position.x + F.x * 3, 0, leader.position.z + F.z * 3);
      } else if (mode === "side") {
        // bám ngang thân xe, thấp sát mặt đường cho cảm giác tốc độ
        desiredPos.set(
          leader.position.x - F.z * 9,
          2.6,
          leader.position.z + F.x * 9
        );
        desiredLook.set(leader.position.x, 0.9, leader.position.z);
      } else {
        // lệch nhẹ sang bên (vector bên của xe = (-Fz, Fx)) cho góc 3/4 đẹp hơn
        desiredPos.set(
          leader.position.x - F.x * CAM_BACK + -F.z * 3,
          CAM_HEIGHT,
          leader.position.z - F.z * CAM_BACK + F.x * 3
        );
        desiredLook.set(
          leader.position.x + F.x * CAM_LOOK_AHEAD,
          1.2,
          leader.position.z + F.z * CAM_LOOK_AHEAD
        );
      }
      if (!camReady) {
        camera.position.copy(desiredPos);
        smoothLook.copy(desiredLook);
        camReady = true;
      } else {
        // damping độc lập tốc độ khung hình -> mượt như nhau ở 30/60/120fps
        camera.position.lerp(desiredPos, 1 - Math.exp(-3.2 * dt));
        smoothLook.lerp(desiredLook, 1 - Math.exp(-5 * dt));
      }
      camera.lookAt(smoothLook);

      if (!lastPush || now - lastPush > 200) {
        lastPush = now;
        setStandings(live);
        setHud({
          leader: live[0].nickname,
          lap: Math.min(laps, Math.floor(live[0].progress * laps) + 1),
          mode: CAM_MODE_LABEL[mode],
        });
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
          {hud && !raceOver && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4 z-10">
              <div className="bg-black/45 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-extrabold">
                  Dẫn đầu
                </p>
                <p className="font-display font-extrabold text-axis-yellow leading-tight">
                  👑 {hud.leader}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="bg-black/45 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10 font-display font-extrabold text-sm">
                  VÒNG {hud.lap}/{laps}
                </span>
                <span className="bg-black/45 backdrop-blur-sm rounded-full px-3 py-1 border border-white/10 text-[11px] font-bold text-white/70">
                  🎥 {hud.mode}
                </span>
              </div>
            </div>
          )}
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
