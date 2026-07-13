// Decorative, animated scenery shared by the manual demo and the race
// replay: waving flags, spinning pinwheels, drifting clouds, sparkle
// particles around the center logo. Purely cosmetic, no gameplay logic.

const FLAG_COLORS = [0xff6fa1, 0xffcf3a, 0x1e9bf0, 0x53e07a, 0xff9a3c];

export function addTrackScenery(scene, THREE, trackRadius) {
  const flags = [];
  const flagCount = 10;
  for (let i = 0; i < flagCount; i++) {
    const angle = (i / flagCount) * Math.PI * 2;
    const r = trackRadius + 9;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    pole.position.set(Math.cos(angle) * r, 1.6, Math.sin(angle) * r);
    scene.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      new THREE.MeshStandardMaterial({
        color: FLAG_COLORS[i % FLAG_COLORS.length],
        side: THREE.DoubleSide,
      })
    );
    flag.position.set(0.6, 1.15, 0);
    const flagPivot = new THREE.Group();
    flagPivot.position.copy(pole.position);
    flagPivot.add(flag);
    scene.add(flagPivot);

    flags.push({ mesh: flag, phase: Math.random() * Math.PI * 2 });
  }

  const pinwheels = [];
  const pinwheelCount = 6;
  for (let i = 0; i < pinwheelCount; i++) {
    const angle = (i / pinwheelCount) * Math.PI * 2 + 0.4;
    const r = trackRadius + 13 + (i % 2) * 4;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    pole.position.set(Math.cos(angle) * r, 1.2, Math.sin(angle) * r);
    scene.add(pole);

    const fan = new THREE.Group();
    fan.position.set(pole.position.x, 2.5, pole.position.z);
    const blades = 4;
    for (let b = 0; b < blades; b++) {
      const blade = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 3),
        new THREE.MeshStandardMaterial({
          color: FLAG_COLORS[(i + b) % FLAG_COLORS.length],
          side: THREE.DoubleSide,
        })
      );
      blade.position.x = 0.4;
      blade.rotation.z = (b / blades) * Math.PI * 2;
      fan.add(blade);
    }
    scene.add(fan);
    pinwheels.push({ mesh: fan, speed: 1.5 + Math.random() });
  }

  const clouds = [];
  const cloudCount = 6;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 2);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(2 + Math.random(), 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 0.9, transparent: true })
      );
      puff.position.set(p * 2.2 - puffs, Math.random() * 0.6, Math.random() * 1.2);
      cloud.add(puff);
    }
    const angle = Math.random() * Math.PI * 2;
    const r = 55 + Math.random() * 25;
    cloud.position.set(Math.cos(angle) * r, 28 + Math.random() * 12, Math.sin(angle) * r);
    scene.add(cloud);
    clouds.push({
      mesh: cloud,
      angle,
      radius: r,
      speed: 0.01 + Math.random() * 0.015,
    });
  }

  const particleCount = 70;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (trackRadius - 8);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.random() * 6;
    positions[i * 3 + 2] = Math.sin(angle) * r;
    speeds[i] = 0.4 + Math.random() * 0.6;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      color: 0xffcf3a,
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    })
  );
  scene.add(particles);

  return { flags, pinwheels, clouds, particles, particleSpeeds: speeds };
}

export function animateTrackScenery(scenery, t, dt) {
  scenery.flags.forEach((f) => {
    f.mesh.rotation.y = Math.sin(t * 3 + f.phase) * 0.5;
    f.mesh.rotation.z = Math.sin(t * 2.2 + f.phase) * 0.08;
  });

  scenery.pinwheels.forEach((p) => {
    p.mesh.rotation.x += dt * p.speed;
  });

  scenery.clouds.forEach((c) => {
    c.angle += dt * c.speed;
    c.mesh.position.x = Math.cos(c.angle) * c.radius;
    c.mesh.position.z = Math.sin(c.angle) * c.radius;
  });

  const posAttr = scenery.particles.geometry.getAttribute("position");
  for (let i = 0; i < posAttr.count; i++) {
    let y = posAttr.getY(i) + scenery.particleSpeeds[i] * dt;
    if (y > 6) y = 0;
    posAttr.setY(i, y);
  }
  posAttr.needsUpdate = true;
}
