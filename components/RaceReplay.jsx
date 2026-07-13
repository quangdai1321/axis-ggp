"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const TRACK_RADIUS = 26;
const LANE_COUNT = 6;

function makeCar(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 3),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.5, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  cabin.position.set(0, 1.0, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  return group;
}

export default function RaceReplay({ entries, laps, startedAt, status }) {
  const mountRef = useRef(null);
  const [standings, setStandings] = useState([]);
  const [raceOver, setRaceOver] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || status === "lobby" || entries.length === 0) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd6ff);
    scene.fog = new THREE.Fog(0x8fd6ff, 50, 160);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a5a3a, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(70, 48),
      new THREE.MeshStandardMaterial({ color: 0x3fae5c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const track = new THREE.Mesh(
      new THREE.RingGeometry(TRACK_RADIUS - 8, TRACK_RADIUS + 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x6b6b76 })
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    scene.add(track);

    const finishLine = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(TRACK_RADIUS, 0.03, 0);
    scene.add(finishLine);

    const cars = entries.map((entry, i) => {
      const mesh = makeCar(entry.color_hex ? parseInt(entry.color_hex.replace("#", "0x")) : 0xffffff);
      scene.add(mesh);
      const lane = i % LANE_COUNT;
      const laneRadius = TRACK_RADIUS + (lane - (LANE_COUNT - 1) / 2) * 2.2;
      return { entry, mesh, laneRadius };
    });

    const totalAngle = laps * Math.PI * 2;
    const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;
    const maxFinish = Math.max(...entries.map((e) => e.finish_time ?? 999));

    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = startedAtMs ? (Date.now() - startedAtMs) / 1000 : 0;

      const live = cars.map(({ entry, mesh, laneRadius }) => {
        const finishTime = entry.finish_time ?? maxFinish;
        const progress = Math.min(1, Math.max(0, elapsed / finishTime));
        const angle = progress * totalAngle;
        mesh.position.set(Math.cos(angle) * laneRadius, 0, Math.sin(angle) * laneRadius);
        mesh.rotation.y = -angle - Math.PI / 2 + Math.PI / 2;
        return { nickname: entry.nickname, progress, finished: progress >= 1, position: entry.position };
      });

      live.sort((a, b) => b.progress - a.progress);
      setStandings(live);
      if (elapsed >= maxFinish) setRaceOver(true);

      const camAngle = elapsed * 0.05;
      camera.position.set(Math.cos(camAngle) * 55, 32, Math.sin(camAngle) * 55);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [entries, laps, startedAt, status]);

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
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-4 border-axis-blue shadow-2xl">
        <div ref={mountRef} className="absolute inset-0" />
        {raceOver && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <span className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full">
              🏁 Đua xong! Vào Sảnh chờ để xem admin chốt kết quả.
            </span>
          </div>
        )}
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto">
        <p className="font-display font-extrabold mb-3 text-axis-yellow text-sm uppercase tracking-wide">
          Bảng xếp hạng trực tiếp
        </p>
        <ol className="space-y-2 text-sm">
          {standings.map((s, i) => (
            <li
              key={s.nickname + i}
              className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
            >
              <span className="font-bold truncate">
                {i + 1}. {s.nickname}
              </span>
              <span className="text-white/60 text-xs">
                {s.finished ? "🏁 Về đích" : `${Math.round(s.progress * 100)}%`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
