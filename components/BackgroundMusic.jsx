"use client";

import { useEffect, useRef, useState } from "react";

const BPM = 132;
const STEP_SECONDS = 60 / BPM / 2; // 8th notes
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

// simple riff: root-fifth-octave bass, four-on-the-floor kick, off-beat hats
const BASS_STEPS = [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 10, null, 7, null];
const KICK_STEPS = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const HAT_STEPS = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];

function freqFromSemitone(semitone) {
  const baseFreq = 55; // A1
  return baseFreq * Math.pow(2, semitone / 12);
}

export default function BackgroundMusic() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const schedulerRef = useRef(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      ctxRef.current?.close();
    };
  }, []);

  function playKick(ctx, dest, time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  function playHat(ctx, dest, time) {
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  function playBass(ctx, dest, time, semitone) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freqFromSemitone(semitone), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.22, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + STEP_SECONDS * 0.9);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + STEP_SECONDS);
  }

  function scheduleStep(ctx, dest, step, time) {
    if (KICK_STEPS[step]) playKick(ctx, dest, time);
    if (HAT_STEPS[step]) playHat(ctx, dest, time);
    const bassNote = BASS_STEPS[step];
    if (bassNote !== null) playBass(ctx, dest, time, bassNote);
  }

  function start() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.1;

    schedulerRef.current = setInterval(() => {
      while (nextTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(ctx, master, stepRef.current % 16, nextTimeRef.current);
        nextTimeRef.current += STEP_SECONDS;
        stepRef.current += 1;
      }
    }, LOOKAHEAD_MS);

    setOn(true);
  }

  function stop() {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    ctxRef.current?.close();
    ctxRef.current = null;
    setOn(false);
  }

  return (
    <button
      onClick={() => (on ? stop() : start())}
      title={on ? "Tắt nhạc nền" : "Bật nhạc nền"}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-sm"
      aria-label={on ? "Tắt nhạc nền" : "Bật nhạc nền"}
    >
      {on ? "🔊" : "🔈"}
    </button>
  );
}
