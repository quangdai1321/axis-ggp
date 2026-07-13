// Lightweight Web Audio engine hum + SFX synth for the driving demo.
// Lazily created on first user input (browsers block AudioContext
// autoplay until a gesture), fully procedural — no audio files.
export function createCarAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const engineOsc = ctx.createOscillator();
  const engineGain = ctx.createGain();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 70;
  engineGain.gain.value = 0;
  engineOsc.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();

  function updateEngine(speedRatio) {
    const clamped = Math.max(0, Math.min(1, speedRatio));
    engineOsc.frequency.setTargetAtTime(70 + clamped * 190, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(0.05 + clamped * 0.09, ctx.currentTime, 0.1);
  }

  function blip(freqStart, freqEnd, duration, type = "square", gainPeak = 0.3) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noiseBurst(duration, gainPeak = 0.35) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
    src.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    ctx,
    updateEngine,
    playBoost: () => blip(220, 700, 0.35, "sawtooth", 0.28),
    playCollision: () => noiseBurst(0.18, 0.4),
    playPickup: () => blip(500, 1100, 0.18, "square", 0.25),
    playShield: () => blip(300, 900, 0.25, "sine", 0.22),
    playShrink: () => blip(700, 150, 0.3, "square", 0.22),
    playCountdownBeep: () => blip(440, 440, 0.12, "sine", 0.3),
    playGo: () => blip(440, 880, 0.3, "sine", 0.35),
    playCheckpoint: () => blip(600, 1000, 0.15, "triangle", 0.2),
    playFinish: () => blip(523, 1046, 0.6, "triangle", 0.3),
    stop: () => {
      try {
        engineOsc.stop();
      } catch {
        // already stopped
      }
      ctx.close();
    },
  };
}
