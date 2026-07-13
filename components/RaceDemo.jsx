"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createAxisLogoTexture } from "../lib/three/axisLogoTexture";
import { addTrackScenery, animateTrackScenery } from "../lib/three/trackScenery";
import { createCarAudio } from "../lib/three/carAudio";

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
const BASE_MAX_SPEED = 12;
const BOOST_MAX_SPEED = 22;
const TOTAL_LAPS = 2;
const CHECKPOINT_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const CHECKPOINTS = CHECKPOINT_ANGLES.map((angle) => ({
  angle,
  x: Math.cos(angle) * TRACK_RADIUS,
  z: Math.sin(angle) * TRACK_RADIUS,
}));

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

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

export default function RaceDemo() {
  const mountRef = useRef(null);
  const minimapRef = useRef(null);
  const controlsRef = useRef(null);
  const [hud, setHud] = useState({
    speed: 0,
    maxSpeedNow: BASE_MAX_SPEED,
    gadget: null,
    message: "Chờ đếm ngược để xuất phát...",
    phase: "countdown",
    countdownText: "3",
    lap: 0,
    lapTime: 0,
    finished: false,
    finishTime: 0,
  });
  const [restartToken, setRestartToken] = useState(0);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd6ff);
    scene.fog = new THREE.Fog(0x8fd6ff, 40, 140);

    const BASE_FOV = 60;
    const camera = new THREE.PerspectiveCamera(BASE_FOV, width / height, 0.1, 500);
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

    // AXIS ROBOTICS emblem in the middle of the ring
    const logoTexture = createAxisLogoTexture(THREE);
    const logo = new THREE.Mesh(
      new THREE.CircleGeometry(TRACK_RADIUS - 7, 64),
      new THREE.MeshBasicMaterial({ map: logoTexture })
    );
    logo.rotation.x = -Math.PI / 2;
    logo.position.y = 0.015;
    scene.add(logo);

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

    const scenery = addTrackScenery(scene, THREE, TRACK_RADIUS);

    // checkpoint gates
    const checkpointMeshes = CHECKPOINTS.map((cp) => {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.18, 8, 24),
        new THREE.MeshStandardMaterial({
          color: 0x1e9bf0,
          emissive: 0x1e9bf0,
          emissiveIntensity: 0.3,
        })
      );
      torus.position.set(cp.x, 3.2, cp.z);
      torus.rotation.y = cp.angle;
      scene.add(torus);
      return torus;
    });

    function highlightCheckpoint(index) {
      checkpointMeshes.forEach((mesh, i) => {
        const active = i === index;
        mesh.material.color.set(active ? 0xffcf3a : 0x1e9bf0);
        mesh.material.emissive.set(active ? 0xffcf3a : 0x1e9bf0);
      });
    }
    highlightCheckpoint(1);

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

    const shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x1e9bf0, transparent: true, opacity: 0.28 })
    );
    shieldMesh.visible = false;
    player.add(shieldMesh);

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
        baseSpeed: 9 + Math.random() * 5,
        knockback: { x: 0, z: 0 },
        history: [],
        spawn: { x: spawnX, z: spawnZ, heading: spawnHeading },
        shrunkUntil: 0,
      });
      scene.add(mesh);
    }
    bots.forEach((b) => (b.speed = b.baseSpeed));

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

    // drift dust particle pool
    const DUST_COUNT = 50;
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    const dustVelocity = new Array(DUST_COUNT).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    const dustLife = new Array(DUST_COUNT).fill(0);
    for (let i = 0; i < DUST_COUNT; i++) dustPositions[i * 3 + 1] = -200;
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xc9b896, size: 0.35, transparent: true, opacity: 0.6 })
    );
    scene.add(dust);
    let dustCursor = 0;
    let dustAccumulator = 0;

    function spawnDust(x, z) {
      const i = dustCursor;
      dustCursor = (dustCursor + 1) % DUST_COUNT;
      dustPositions[i * 3] = x + (Math.random() - 0.5) * 0.6;
      dustPositions[i * 3 + 1] = 0.3;
      dustPositions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
      dustVelocity[i].x = (Math.random() - 0.5) * 1.2;
      dustVelocity[i].y = 0.8 + Math.random() * 0.6;
      dustVelocity[i].z = (Math.random() - 0.5) * 1.2;
      dustLife[i] = 0.6;
    }

    // input
    const keys = {};
    const controlKeys = new Set([
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ]);

    let audio = null;
    function ensureAudio() {
      if (!audio) {
        try {
          audio = createCarAudio();
        } catch {
          audio = null;
        }
      } else if (audio.ctx.state === "suspended") {
        audio.ctx.resume();
      }
    }

    const onKeyDown = (e) => {
      keys[e.code] = true;
      if (controlKeys.has(e.code)) e.preventDefault();
      ensureAudio();
    };
    const onKeyUp = (e) => {
      keys[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", ensureAudio, { once: true });

    controlsRef.current = {
      press: (code) => {
        keys[code] = true;
        ensureAudio();
      },
      release: (code) => {
        keys[code] = false;
      },
    };

    const playerSpawn = { x: player.position.x, z: player.position.z, heading: -Math.PI / 2 };
    const state = {
      speed: 0,
      heading: -Math.PI / 2,
      boostTimer: 0,
      shieldActive: false,
      shieldUntil: 0,
      currentGadget: null,
      started: false,
      knockback: { x: 0, z: 0 },
      history: [],
      lastBumpMessage: -10,
      phase: "countdown",
      lap: 0,
      nextCheckpoint: 1,
      raceStart: 0,
      finishTime: 0,
      shakeTime: 0,
      shakeMag: 0,
      fov: BASE_FOV,
    };

    let countdownTimers = [];
    function runCountdown() {
      countdownTimers.forEach(clearTimeout);
      countdownTimers = [];
      const steps = [
        { delay: 0, text: "3", beep: true },
        { delay: 1000, text: "2", beep: true },
        { delay: 2000, text: "1", beep: true },
        { delay: 3000, text: "ĐI!", beep: false, go: true },
        { delay: 3600, text: null, hide: true },
      ];
      steps.forEach((step) => {
        countdownTimers.push(
          setTimeout(() => {
            if (step.beep) audio?.playCountdownBeep();
            if (step.go) {
              audio?.playGo();
              state.phase = "racing";
              state.raceStart = clock.elapsedTime;
            }
            setHud((h) => ({
              ...h,
              countdownText: step.text,
              phase: step.hide ? "racing" : h.phase,
              message: step.hide ? "Dùng phím mũi tên / WASD để lái, Space để dùng bảo bối" : h.message,
            }));
          }, step.delay)
        );
      });
    }
    runCountdown();

    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      animateTrackScenery(scenery, t, dt);

      // dust particles fade/move regardless of race phase
      for (let i = 0; i < DUST_COUNT; i++) {
        if (dustLife[i] <= 0) continue;
        dustLife[i] -= dt;
        dustPositions[i * 3] += dustVelocity[i].x * dt;
        dustPositions[i * 3 + 1] += dustVelocity[i].y * dt;
        dustPositions[i * 3 + 2] += dustVelocity[i].z * dt;
        dustVelocity[i].y -= dt * 2;
        if (dustLife[i] <= 0) dustPositions[i * 3 + 1] = -200;
      }
      dustGeo.getAttribute("position").needsUpdate = true;

      const accel = keys["ArrowUp"] || keys["KeyW"];
      const brake = keys["ArrowDown"] || keys["KeyS"];
      const left = keys["ArrowLeft"] || keys["KeyA"];
      const right = keys["ArrowRight"] || keys["KeyD"];
      const useGadget = keys["Space"];

      const racing = state.phase === "racing";

      if (racing) {
        if (accel || brake || left || right) state.started = true;

        const maxSpeedNow = state.boostTimer > 0 ? BOOST_MAX_SPEED : BASE_MAX_SPEED;
        if (accel) state.speed = Math.min(state.speed + dt * 10, maxSpeedNow);
        else if (brake) state.speed = Math.max(state.speed - dt * 14, -6);
        else state.speed *= 0.98;

        let turning = false;
        if (Math.abs(state.speed) > 0.2) {
          const turn = (right ? 1 : 0) - (left ? 1 : 0);
          if (turn !== 0) turning = true;
          state.heading += turn * dt * 1.8 * Math.sign(state.speed || 1);
        }

        if (turning && Math.abs(state.speed) > 7) {
          dustAccumulator += dt;
          if (dustAccumulator > 0.04) {
            dustAccumulator = 0;
            spawnDust(player.position.x, player.position.z);
          }
        }

        player.position.x += Math.cos(state.heading) * state.speed * dt;
        player.position.z += Math.sin(state.heading) * state.speed * dt;

        const knockDecay = Math.pow(0.02, dt);
        player.position.x += state.knockback.x * dt;
        player.position.z += state.knockback.z * dt;
        state.knockback.x *= knockDecay;
        state.knockback.z *= knockDecay;

        player.rotation.y = -state.heading + Math.PI / 2;

        if (state.boostTimer > 0) state.boostTimer -= dt;
        if (state.shieldActive && t > state.shieldUntil) state.shieldActive = false;
        shieldMesh.visible = state.shieldActive;

        if (useGadget && state.currentGadget) {
          const effect = state.currentGadget.effect;
          if (effect === "boost") {
            const wasBoost = state.boostTimer > 0;
            state.boostTimer = 1.6;
            if (!wasBoost) {
              state.shakeTime = 0.2;
              state.shakeMag = 0.12;
              audio?.playBoost();
            }
          } else if (effect === "shield") {
            state.shieldActive = true;
            state.shieldUntil = t + 2.5;
            audio?.playShield();
          } else if (effect === "shrink") {
            let nearest = null;
            let nearestDist = 18;
            bots.forEach((b) => {
              const dx = b.mesh.position.x - player.position.x;
              const dz = b.mesh.position.z - player.position.z;
              const dist = Math.hypot(dx, dz);
              const forward = dx * Math.cos(state.heading) + dz * Math.sin(state.heading);
              if (forward > 0 && dist < nearestDist) {
                nearestDist = dist;
                nearest = b;
              }
            });
            if (nearest) {
              nearest.shrunkUntil = t + 3;
              nearest.mesh.scale.set(0.5, 0.5, 0.5);
              nearest.speed = nearest.baseSpeed * 0.4;
              audio?.playShrink();
            }
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
            audio?.playPickup();
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

        // checkpoint progress
        const targetCp = CHECKPOINTS[state.nextCheckpoint];
        const cpDist = Math.hypot(player.position.x - targetCp.x, player.position.z - targetCp.z);
        if (cpDist < 6) {
          audio?.playCheckpoint();
          state.nextCheckpoint = (state.nextCheckpoint + 1) % CHECKPOINTS.length;
          if (state.nextCheckpoint === 1) {
            state.lap += 1;
            if (state.lap >= TOTAL_LAPS) {
              state.phase = "finished";
              state.finishTime = t - state.raceStart;
              audio?.playFinish();
              setHud((h) => ({ ...h, finished: true, finishTime: state.finishTime, phase: "finished" }));
            }
          }
          highlightCheckpoint(state.nextCheckpoint);
        }
      }

      // bots steer to stay near the ring, self-correcting after knocks
      bots.forEach((b) => {
        if (b.shrunkUntil && t > b.shrunkUntil) {
          b.shrunkUntil = 0;
          b.mesh.scale.set(1, 1, 1);
          b.speed = b.baseSpeed;
        }
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

            const playerShielded =
              (a.isPlayer && state.shieldActive) || (b.isPlayer && state.shieldActive);
            const bump = 7;
            if (!(a.isPlayer && state.shieldActive)) {
              a.knockback.x += nx * bump;
              a.knockback.z += nz * bump;
            }
            if (!(b.isPlayer && state.shieldActive)) {
              b.knockback.x -= nx * bump;
              b.knockback.z -= nz * bump;
            }

            if ((a.isPlayer || b.isPlayer) && racing) {
              if (!playerShielded) {
                state.speed *= 0.6;
                state.shakeTime = 0.25;
                state.shakeMag = 0.22;
                audio?.playCollision();
                if (t - state.lastBumpMessage > 1.2) {
                  state.lastBumpMessage = t;
                  setHud((h) => ({ ...h, message: "💥 Va chạm!" }));
                }
              } else if (t - state.lastBumpMessage > 1.2) {
                state.lastBumpMessage = t;
                setHud((h) => ({ ...h, message: "🛡️ Khiên đỡ va chạm!" }));
              }
            }
          }
        }
      }

      if (racing) {
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

      // camera follow (third person) + shake + FOV kick
      const camDist = 8;
      const desired = new THREE.Vector3(
        player.position.x - Math.cos(state.heading) * camDist,
        player.position.y + 4.5,
        player.position.z - Math.sin(state.heading) * camDist
      );
      camera.position.lerp(desired, 1 - Math.pow(0.001, dt));

      if (state.shakeTime > 0) {
        state.shakeTime -= dt;
        const mag = state.shakeMag * (state.shakeTime / 0.3);
        camera.position.x += (Math.random() - 0.5) * mag;
        camera.position.y += (Math.random() - 0.5) * mag;
        camera.position.z += (Math.random() - 0.5) * mag;
      }

      const targetFov = state.boostTimer > 0 ? 70 : BASE_FOV;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }

      camera.lookAt(player.position.x, player.position.y + 1, player.position.z);

      if (audio) {
        audio.updateEngine(Math.abs(state.speed) / BOOST_MAX_SPEED);
      }

      // minimap
      const mmCanvas = minimapRef.current;
      if (mmCanvas) {
        const ctx2d = mmCanvas.getContext("2d");
        const size = mmCanvas.width;
        const scale = (size / 2 - 6) / OUT_OF_BOUNDS_RADIUS;
        const cx = size / 2;
        const cy = size / 2;
        ctx2d.clearRect(0, 0, size, size);
        ctx2d.fillStyle = "rgba(10,26,47,0.55)";
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.strokeStyle = "rgba(255,255,255,0.35)";
        ctx2d.lineWidth = 6 * scale;
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, TRACK_RADIUS * scale, 0, Math.PI * 2);
        ctx2d.stroke();

        pickups.forEach((p) => {
          if (!p.userData.active) return;
          ctx2d.fillStyle = `#${p.userData.gadget.color.toString(16).padStart(6, "0")}`;
          ctx2d.beginPath();
          ctx2d.arc(cx + p.position.x * scale, cy + p.position.z * scale, 2, 0, Math.PI * 2);
          ctx2d.fill();
        });

        bots.forEach((b) => {
          ctx2d.fillStyle = "#ffffff";
          ctx2d.beginPath();
          ctx2d.arc(cx + b.mesh.position.x * scale, cy + b.mesh.position.z * scale, 2.5, 0, Math.PI * 2);
          ctx2d.fill();
        });

        ctx2d.fillStyle = "#ff3b3b";
        ctx2d.beginPath();
        ctx2d.arc(cx + player.position.x * scale, cy + player.position.z * scale, 3.5, 0, Math.PI * 2);
        ctx2d.fill();
      }

      setHud((h) => {
        const speedRounded = Math.round(Math.abs(state.speed) * 10);
        const lapTime = racing ? Math.max(0, t - state.raceStart) : h.lapTime;
        if (speedRounded === h.speed && Math.abs(lapTime - h.lapTime) < 0.05 && h.lap === state.lap) {
          return h;
        }
        return {
          ...h,
          speed: speedRounded,
          maxSpeedNow: state.boostTimer > 0 ? BOOST_MAX_SPEED : BASE_MAX_SPEED,
          started: state.started,
          lap: state.lap,
          lapTime,
        };
      });

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
      countdownTimers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", ensureAudio);
      resizeObserver.disconnect();
      renderer.dispose();
      logoTexture.dispose();
      audio?.stop();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartToken]);

  const speedRatio = Math.min(1, hud.speed / 10 / BOOST_MAX_SPEED);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-4 border-axis-blue shadow-2xl select-none">
      <div ref={mountRef} className="absolute inset-0" />

      {/* countdown overlay */}
      {hud.phase === "countdown" && hud.countdownText && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-display text-7xl sm:text-8xl font-extrabold text-axis-yellow drop-shadow-[0_0_20px_rgba(0,0,0,0.6)] animate-pulse">
            {hud.countdownText}
          </span>
        </div>
      )}

      {/* finish overlay */}
      {hud.finished && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center px-6">
          <div className="bg-axis-navy border-2 border-axis-yellow rounded-2xl p-6 sm:p-8 text-center max-w-xs">
            <p className="text-3xl mb-2">🏁</p>
            <h3 className="font-display text-xl font-extrabold mb-1">Hoàn thành!</h3>
            <p className="text-axis-yellow font-display text-2xl font-extrabold mb-4">
              {formatTime(hud.finishTime)}
            </p>
            <button
              onClick={() => setRestartToken((n) => n + 1)}
              className="bg-axis-yellow text-axis-navy font-extrabold px-5 py-2 rounded-full hover:scale-105 transition"
            >
              🔁 Đua lại
            </button>
          </div>
        </div>
      )}

      {/* top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4 gap-2">
        <div className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold">
          Vòng {Math.min(hud.lap + 1, TOTAL_LAPS)}/{TOTAL_LAPS} · {formatTime(hud.lapTime)}
        </div>
        {hud.gadget && (
          <div className="bg-axis-yellow text-axis-navy px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold shadow">
            🎁 {hud.gadget}
          </div>
        )}
      </div>

      {/* speedometer */}
      <div className="pointer-events-none absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
        <div
          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center"
          style={{
            background: `conic-gradient(#ffcf3a ${speedRatio * 100}%, rgba(255,255,255,0.12) ${speedRatio * 100}%)`,
          }}
        >
          <div className="absolute inset-1.5 rounded-full bg-axis-navy/90 flex flex-col items-center justify-center">
            <span className="font-display font-extrabold text-lg sm:text-xl leading-none">{hud.speed}</span>
            <span className="text-[9px] text-white/50">km/h</span>
          </div>
        </div>
      </div>

      {/* minimap */}
      <div className="pointer-events-none absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
        <canvas ref={minimapRef} width={110} height={110} className="rounded-full opacity-90" />
      </div>

      {/* message */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-24 sm:pb-4 flex justify-center px-3">
        <div className="bg-black/50 backdrop-blur px-3 py-2 rounded-xl text-xs sm:text-sm text-center max-w-sm">
          {hud.message}
        </div>
      </div>

      {/* touch controls */}
      {isTouch && (
        <div className="absolute inset-x-0 bottom-3 flex items-end justify-between px-3 sm:px-4">
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5 w-32">
            <div />
            <TouchButton code="ArrowUp" controlsRef={controlsRef} label="▲" />
            <div />
            <TouchButton code="ArrowLeft" controlsRef={controlsRef} label="◀" />
            <TouchButton code="ArrowDown" controlsRef={controlsRef} label="▼" />
            <TouchButton code="ArrowRight" controlsRef={controlsRef} label="▶" />
          </div>
          <TouchButton
            code="Space"
            controlsRef={controlsRef}
            label="🎁"
            className="w-16 h-16 text-2xl rounded-full"
          />
        </div>
      )}
    </div>
  );
}

function TouchButton({ code, controlsRef, label, className = "" }) {
  const press = (e) => {
    e.preventDefault();
    controlsRef.current?.press(code);
  };
  const release = (e) => {
    e.preventDefault();
    controlsRef.current?.release(code);
  };
  return (
    <button
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      className={`bg-white/15 active:bg-white/30 backdrop-blur rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold ${className}`}
    >
      {label}
    </button>
  );
}
