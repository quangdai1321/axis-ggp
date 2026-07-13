"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const GADGETS = [
  { name: "Rocket Shoes", color: 0xffcf3a, effect: "boost" },
  { name: "Barrier Ball", color: 0x1e9bf0, effect: "shield" },
  { name: "Shrink Flashlight", color: 0xff6fa1, effect: "shrink" },
  { name: "Turbo Candy", color: 0x53e07a, effect: "boost" },
];

const TRACK_RADIUS = 26;
const BOT_COUNT = 8;
const CAR_RADIUS = 1.3;
const OUT_OF_BOUNDS_RADIUS = 42;
const REWIND_SECONDS = 1;
const HISTORY_MAX_AGE = 1.6;

function recordHistory(history, t, x, z, heading) {
  history.push({ t, x, z, heading });
  while (history.length && t - history[0].t > HISTORY_MAX_AGE) history.shift();
}

function snapshotSecondsAgo(history, now, seconds) {
  const target = now - seconds;
  let best = null;
  for (let i = 0; i < history.length; i++) {
    if (history[i].t <= target) best = history[i];
    else break;
  }
  return best;
}

export default function RaceDemo() {
  const mountRef = useRef(null);
  const [hud, setHud] = useState({
    speed: 0,
    gadget: null,
    message: "Dùng phím mũi tên / WASD để lái, Space để dùng bảo bối",
    started: false,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd6ff);
    scene.fog = new THREE.Fog(0x8fd6ff, 40, 140);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    camera.position.set(0, 6, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a5a3a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    // ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(70, 48),
      new THREE.MeshStandardMaterial({ color: 0x3fae5c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // track ring
    const track = new THREE.Mesh(
      new THREE.RingGeometry(TRACK_RADIUS - 6, TRACK_RADIUS + 6, 64),
      new THREE.MeshStandardMaterial({ color: 0x6b6b76 })
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    track.receiveShadow = true;
    scene.add(track);

    const laneMarks = new THREE.Mesh(
      new THREE.RingGeometry(TRACK_RADIUS - 0.3, TRACK_RADIUS + 0.3, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    laneMarks.rotation.x = -Math.PI / 2;
    laneMarks.position.y = 0.02;
    scene.add(laneMarks);

    // scenery: colorful buildings around the ring, Nobita Town vibe
    const buildingColors = [0xff6fa1, 0xffcf3a, 0x1e9bf0, 0x53e07a, 0xff9a3c];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const r = 40 + Math.random() * 20;
      const h = 4 + Math.random() * 8;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, h, 4),
        new THREE.MeshStandardMaterial({
          color: buildingColors[i % buildingColors.length],
        })
      );
      box.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
      box.castShadow = true;
      scene.add(box);
    }

    // player car
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
      const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f });
      const wheelPositions = [
        [-0.9, 0.35, 1.1],
        [0.9, 0.35, 1.1],
        [-0.9, 0.35, -1.1],
        [0.9, 0.35, -1.1],
      ];
      wheelPositions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, y, z);
        wheel.castShadow = true;
        group.add(wheel);
      });
      return group;
    }

    const player = makeCar(0xff3b3b);
    player.position.set(TRACK_RADIUS, 0, 0);
    player.rotation.y = -Math.PI / 2;
    scene.add(player);

    // bots on the ring
    const botColors = [0x1e9bf0, 0xffcf3a, 0x53e07a, 0xff6fa1, 0xffffff, 0x9b59b6, 0xff9a3c, 0x2ecc71];
    const bots = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      const mesh = makeCar(botColors[i % botColors.length]);
      const offset = (i / BOT_COUNT) * Math.PI * 2;
      const spawnX = Math.cos(offset) * TRACK_RADIUS;
      const spawnZ = Math.sin(offset) * TRACK_RADIUS;
      const spawnHeading = offset + Math.PI / 2;
      mesh.position.set(spawnX, 0, spawnZ);
      mesh.rotation.y = -spawnHeading + Math.PI / 2;
      bots.push({
        mesh,
        heading: spawnHeading,
        speed: 9 + Math.random() * 5,
        knockback: { x: 0, z: 0 },
        history: [],
        spawn: { x: spawnX, z: spawnZ, heading: spawnHeading },
      });
      scene.add(mesh);
    }

    // gadget pickups
    const pickups = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const gadget = GADGETS[i % GADGETS.length];
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.6),
        new THREE.MeshStandardMaterial({
          color: gadget.color,
          emissive: gadget.color,
          emissiveIntensity: 0.4,
        })
      );
      mesh.position.set(
        Math.cos(angle) * TRACK_RADIUS,
        1.2,
        Math.sin(angle) * TRACK_RADIUS
      );
      mesh.castShadow = true;
      mesh.userData = { gadget, active: true };
      pickups.push(mesh);
      scene.add(mesh);
    }

    // input
    const keys = {};
    const onKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === "Space") e.preventDefault();
    };
    const onKeyUp = (e) => {
      keys[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const playerSpawn = { x: player.position.x, z: player.position.z, heading: -Math.PI / 2 };
    const state = {
      speed: 0,
      heading: -Math.PI / 2,
      boostTimer: 0,
      shieldActive: false,
      currentGadget: null,
      started: false,
      knockback: { x: 0, z: 0 },
      history: [],
      lastBumpMessage: -10,
    };

    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      const accel = keys["ArrowUp"] || keys["KeyW"];
      const brake = keys["ArrowDown"] || keys["KeyS"];
      const left = keys["ArrowLeft"] || keys["KeyA"];
      const right = keys["ArrowRight"] || keys["KeyD"];
      const useGadget = keys["Space"];

      if (accel || brake || left || right) state.started = true;

      const maxSpeed = state.boostTimer > 0 ? 22 : 12;
      if (accel) state.speed = Math.min(state.speed + dt * 10, maxSpeed);
      else if (brake) state.speed = Math.max(state.speed - dt * 14, -6);
      else state.speed *= 0.98;

      if (Math.abs(state.speed) > 0.2) {
        const turn = (left ? 1 : 0) - (right ? 1 : 0);
        state.heading += turn * dt * 1.8 * Math.sign(state.speed || 1);
      }

      player.position.x += Math.cos(state.heading) * state.speed * dt;
      player.position.z += Math.sin(state.heading) * state.speed * dt;

      // knockback from collisions decays over time
      const knockDecay = Math.pow(0.02, dt);
      player.position.x += state.knockback.x * dt;
      player.position.z += state.knockback.z * dt;
      state.knockback.x *= knockDecay;
      state.knockback.z *= knockDecay;

      player.rotation.y = -state.heading + Math.PI / 2;

      if (state.boostTimer > 0) state.boostTimer -= dt;

      if (useGadget && state.currentGadget) {
        if (state.currentGadget.effect === "boost") {
          state.boostTimer = 1.6;
        } else if (state.currentGadget.effect === "shield") {
          state.shieldActive = true;
          setTimeout(() => (state.shieldActive = false), 2000);
        }
        setHud((h) => ({ ...h, message: `Đã dùng ${state.currentGadget.name}!` }));
        state.currentGadget = null;
        setHud((h) => ({ ...h, gadget: null }));
      }

      // pickup collision
      pickups.forEach((p) => {
        if (!p.userData.active) return;
        p.rotation.y += dt * 2;
        p.position.y = 1.2 + Math.sin(t * 2 + p.position.x) * 0.15;
        const dist = p.position.distanceTo(player.position);
        if (dist < 1.6) {
          p.userData.active = false;
          p.visible = false;
          state.currentGadget = p.userData.gadget;
          setHud((h) => ({
            ...h,
            gadget: p.userData.gadget.name,
            message: `Nhặt được ${p.userData.gadget.name}! Nhấn Space để dùng.`,
          }));
          setTimeout(() => {
            p.userData.active = true;
            p.visible = true;
          }, 6000);
        }
      });

      // bots steer to stay near the ring, self-correcting after knocks
      bots.forEach((b) => {
        const a = Math.atan2(b.mesh.position.z, b.mesh.position.x);
        const currentRadius = Math.hypot(b.mesh.position.x, b.mesh.position.z);
        const radialError = TRACK_RADIUS - currentRadius;
        const desiredHeading =
          a + Math.PI / 2 + THREE.MathUtils.clamp(radialError * 0.08, -0.6, 0.6);
        let diff = desiredHeading - b.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        b.heading += diff * Math.min(1, dt * 2.5);

        b.mesh.position.x += Math.cos(b.heading) * b.speed * dt;
        b.mesh.position.z += Math.sin(b.heading) * b.speed * dt;

        const botKnockDecay = Math.pow(0.02, dt);
        b.mesh.position.x += b.knockback.x * dt;
        b.mesh.position.z += b.knockback.z * dt;
        b.knockback.x *= botKnockDecay;
        b.knockback.z *= botKnockDecay;

        b.mesh.rotation.y = -b.heading + Math.PI / 2;
      });

      // car-to-car collision: push apart + bounce knockback
      const cars = [
        { pos: player.position, knockback: state.knockback, isPlayer: true },
        ...bots.map((b) => ({ pos: b.mesh.position, knockback: b.knockback, bot: b })),
      ];
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i];
          const b = cars[j];
          const dx = a.pos.x - b.pos.x;
          const dz = a.pos.z - b.pos.z;
          const dist = Math.hypot(dx, dz);
          const minDist = CAR_RADIUS * 2;
          if (dist > 0.0001 && dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const nz = dz / dist;
            a.pos.x += nx * overlap * 0.5;
            a.pos.z += nz * overlap * 0.5;
            b.pos.x -= nx * overlap * 0.5;
            b.pos.z -= nz * overlap * 0.5;

            const bump = 7;
            a.knockback.x += nx * bump;
            a.knockback.z += nz * bump;
            b.knockback.x -= nx * bump;
            b.knockback.z -= nz * bump;

            if (a.isPlayer || b.isPlayer) {
              state.speed *= 0.6;
              if (t - state.lastBumpMessage > 1.2) {
                state.lastBumpMessage = t;
                setHud((h) => ({ ...h, message: "💥 Va chạm!" }));
              }
            }
          }
        }
      }

      // out-of-bounds check + rewind to position from 1s ago
      const playerDist = Math.hypot(player.position.x, player.position.z);
      if (playerDist > OUT_OF_BOUNDS_RADIUS) {
        const snap = snapshotSecondsAgo(state.history, t, REWIND_SECONDS) || playerSpawn;
        player.position.set(snap.x, 0, snap.z);
        state.heading = snap.heading;
        state.speed = 0;
        state.knockback.x = 0;
        state.knockback.z = 0;
        state.history = [];
        setHud((h) => ({ ...h, message: "🚧 Xe văng ra ngoài! Đã đặt lại vị trí trước đó 1 giây." }));
      } else {
        recordHistory(state.history, t, player.position.x, player.position.z, state.heading);
      }

      bots.forEach((b) => {
        const dist = Math.hypot(b.mesh.position.x, b.mesh.position.z);
        if (dist > OUT_OF_BOUNDS_RADIUS) {
          const snap = snapshotSecondsAgo(b.history, t, REWIND_SECONDS) || b.spawn;
          b.mesh.position.set(snap.x, 0, snap.z);
          b.heading = snap.heading;
          b.knockback.x = 0;
          b.knockback.z = 0;
          b.history = [];
        } else {
          recordHistory(b.history, t, b.mesh.position.x, b.mesh.position.z, b.heading);
        }
      });

      // camera follow (third person)
      const camDist = 8;
      const desired = new THREE.Vector3(
        player.position.x - Math.cos(state.heading) * camDist,
        player.position.y + 4.5,
        player.position.z - Math.sin(state.heading) * camDist
      );
      camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      camera.lookAt(
        player.position.x,
        player.position.y + 1,
        player.position.z
      );

      setHud((h) =>
        Math.round(Math.abs(state.speed) * 10) === h.speed
          ? h
          : { ...h, speed: Math.round(Math.abs(state.speed) * 10), started: state.started }
      );

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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-4 border-axis-blue shadow-2xl">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
        <div className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold">
          Tốc độ: {hud.speed} km/h
        </div>
        {hud.gadget && (
          <div className="bg-axis-yellow text-axis-navy px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold shadow">
            🎁 {hud.gadget}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <div className="bg-black/50 backdrop-blur px-3 py-2 rounded-xl text-xs sm:text-sm text-center">
          {hud.message}
        </div>
      </div>
    </div>
  );
}
