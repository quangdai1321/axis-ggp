// Same AXIS ROBOTICS badge as lib/three/axisLogoTexture.js, but returns a
// plain <canvas>/data URL for use as an SVG <image> (2D race map) instead
// of a THREE.CanvasTexture (3D scenes). Keep the two in sync visually.
export function createAxisLogoCanvas(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fill();

  const cx = size / 2;
  const cy = size * 0.4;
  const spikes = 12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  for (let i = 0; i < spikes; i++) {
    const angle = (i / spikes) * Math.PI * 2;
    const long = i % 3 === 0;
    const len = long ? 78 : 48;
    ctx.lineWidth = long ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 50px 'Segoe UI', sans-serif";
  ctx.fillText("AXIS", cx, size * 0.72);

  ctx.font = "300 22px 'Segoe UI', sans-serif";
  try {
    ctx.letterSpacing = "6px";
  } catch {
    // older browsers without CanvasRenderingContext2D.letterSpacing support
  }
  ctx.fillText("ROBOTICS", cx, size * 0.8);

  return canvas;
}

export function createAxisLogoDataUrl(size = 256) {
  return createAxisLogoCanvas(size).toDataURL("image/png");
}
