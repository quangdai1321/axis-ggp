// Procedural sky/ground/track/curb textures + a varied cityscape (towers,
// domes, huts, trees) — all canvas-generated, no external assets, shared
// by the manual demo and the race replay scenes.

export function createSkyDome(THREE) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#1e9bf0");
  gradient.addColorStop(0.55, "#8fd6ff");
  gradient.addColorStop(1, "#e8f8ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "rgba(255, 235, 150, 0.9)";
  ctx.beginPath();
  ctx.arc(size * 0.78, size * 0.22, 46, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 20, 0, Math.PI * 2, 0, Math.PI / 1.9),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false })
  );
  dome.position.y = -5;
  return dome;
}

export function createGroundMaterial(THREE) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#3fae5c";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const shade = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillStyle = shade;
    const w = 3 + Math.random() * 6;
    ctx.fillRect(Math.random() * size, Math.random() * size, w, w);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);

  return new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
}

export function createTrackMaterial(THREE) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#5c5c66";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const v = 60 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.25)`;
    const w = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * size, Math.random() * size, w, w);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(24, 3);

  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
}

export function createCurbMaterial(THREE) {
  const w = 64;
  const h = 16;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e23b3b";
  ctx.fillRect(0, 0, w / 2, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(60, 1);

  return new THREE.MeshBasicMaterial({ map: texture });
}

function makeTree(THREE, palette) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34 })
  );
  trunk.position.y = 0.7;
  tree.add(trunk);
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 8, 8),
    new THREE.MeshStandardMaterial({ color: palette[Math.floor(Math.random() * palette.length)] })
  );
  leaves.position.y = 1.8;
  leaves.scale.y = 1.2;
  tree.add(leaves);
  tree.castShadow = true;
  return tree;
}

function makeBuilding(THREE, color, height) {
  const roll = Math.random();
  const group = new THREE.Group();

  if (roll < 0.4) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4, height, 4),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = height / 2;
    body.castShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 2, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = height + 1;
    roof.castShadow = true;
    group.add(roof);
  } else if (roll < 0.7) {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, height, 12),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = height / 2;
    body.castShadow = true;
    group.add(body);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    dome.position.y = height;
    dome.castShadow = true;
    group.add(dome);
  } else {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, height, 3.4),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = height / 2;
    body.castShadow = true;
    group.add(body);
    // windows
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a8,
      emissive: 0xffdd88,
      emissiveIntensity: 0.6,
    });
    const rows = Math.max(1, Math.floor(height / 2));
    for (let r = 0; r < rows; r++) {
      if (Math.random() < 0.5) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), winMat);
      win.position.set(1.71, 1 + r * 2, 0);
      win.rotation.y = Math.PI / 2;
      group.add(win);
    }
  }

  return group;
}

export function addCityscape(scene, THREE, trackRadius) {
  const buildingColors = [0xff6fa1, 0xffcf3a, 0x1e9bf0, 0x53e07a, 0xff9a3c, 0x9b59b6];
  const treeColors = [0x4caf50, 0x66bb6a, 0x2e8b57];

  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.15;
    const r = trackRadius + 16 + Math.random() * 22;
    const height = 4 + Math.random() * 9;
    const building = makeBuilding(THREE, buildingColors[i % buildingColors.length], height);
    building.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    building.rotation.y = Math.random() * Math.PI * 2;
    scene.add(building);
  }

  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = trackRadius + 8 + Math.random() * 30;
    const tree = makeTree(THREE, treeColors);
    tree.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    tree.scale.setScalar(0.7 + Math.random() * 0.6);
    scene.add(tree);
  }
}
