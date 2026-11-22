// Feelings Garden in 3D (three.js): a round pastel garden bed where each check-in grows a flower.
// Drag to turn the garden, tap a flower to see its day. Returns null when the device has no WebGL,
// so the page can fall back to the flat garden.
import * as THREE from "./vendor/three.module.min.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#cccccc";
const SIZE = 1.35, BIG = 1.7; // flower size, and size of the flower you tapped
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // sunflower spacing, so flowers never overlap

export function createGarden3D(container, { onPick = () => {}, reduceMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  let running = false, last = performance.now(); // render-loop state (used by wake() below)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 6.2, 11.5);
  camera.lookAt(0, 0.9, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 9, 6);
  scene.add(sun);

  // Everything that turns when the viewer drags
  const world = new THREE.Group();
  scene.add(world);

  // ---------- the garden bed ----------
  const grassMat = new THREE.MeshLambertMaterial();
  const soilMat = new THREE.MeshLambertMaterial();
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.35, 64), grassMat);
  grass.position.y = -0.175;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.1, 0.9, 64), soilMat);
  soil.position.y = -0.62;
  world.add(grass, soil);

  // little stones and grass tufts around the edge (same pattern every time)
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xf3efe9 });
  const tuftMat = new THREE.MeshLambertMaterial();
  const stoneGeo = new THREE.SphereGeometry(0.22, 12, 8);
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.45, 5);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(Math.cos(a) * 6.0, 0.02, Math.sin(a) * 6.0);
    stone.scale.set(1 + (i % 3) * 0.2, 0.55, 1 + ((i + 1) % 3) * 0.15);
    world.add(stone);
    if (i % 2 === 0) {
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(tuftGeo, tuftMat);
        const b = a + 0.06 * (k - 1);
        t.position.set(Math.cos(b) * 5.45, 0.2, Math.sin(b) * 5.45);
        t.rotation.z = (k - 1) * 0.35;
        world.add(t);
      }
    }
  }

  // ---------- flowers ----------
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.065, 1, 8);
  stemGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.SphereGeometry(1, 14, 10);
  const petalGeo = new THREE.SphereGeometry(1, 16, 10);
  const centerGeo = new THREE.SphereGeometry(0.15, 16, 12);
  const budGeo = new THREE.SphereGeometry(1, 16, 12);
  const shadowGeo = new THREE.CircleGeometry(0.42, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const stemMat = new THREE.MeshLambertMaterial();
  const leafMat = new THREE.MeshLambertMaterial();
  const centerMat = new THREE.MeshLambertMaterial({ color: 0xffe28f });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false });
  const petalMats = {};
  const petalMat = (feeling) => (petalMats[feeling] ??= tint(new THREE.MeshLambertMaterial(), css(`--${feeling}`)));
  // petals glow a little in their own colour, so the pastels stay light instead of muddy
  function tint(m, c) { m.color.set(c); m.emissive.set(c).multiplyScalar(0.28); return m; }

  function makeFlower(f, bloom) {
    const g = new THREE.Group();
    const h = bloom ? 1.55 : 1.0;
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.scale.y = h;
    g.add(stem);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(0.3, 0.07, 0.13);
      leaf.position.set(side * 0.22, h * 0.38 + (side > 0 ? 0.12 : 0), 0);
      leaf.rotation.z = side * 0.5;
      g.add(leaf);
    }
    const head = new THREE.Group();
    head.position.y = h;
    if (bloom) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(petalGeo, petalMat(f));
        petal.scale.set(0.3, 0.07, 0.15);
        petal.position.set(Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27);
        petal.rotation.y = -a;
        petal.rotation.z = 0.25; // petals tip up slightly, like a cup
        head.add(petal);
      }
      head.add(new THREE.Mesh(centerGeo, centerMat));
      head.rotation.x = -0.35; // face the viewer a little
    } else {
      const bud = new THREE.Mesh(budGeo, petalMat(f));
      bud.scale.set(0.17, 0.27, 0.17);
      bud.position.y = 0.12;
      head.add(bud);
    }
    g.add(head);
    g.add(new THREE.Mesh(shadowGeo, shadowMat));
    g.userData.head = head;
    return g;
  }

  let flowers = []; // { key, group, born, phase }
  function update(list) {
    const next = [];
    list.forEach((fl, i) => {
      const key = `${fl.d}|${fl.f}|${fl.bloom ? 1 : 0}`;
      const r = 0.95 * Math.sqrt(i + 0.6);
      const a = i * GOLDEN;
      let item = flowers.find((x) => x.key === key);
      if (item) flowers = flowers.filter((x) => x !== item);
      else {
        item = { key, group: makeFlower(fl.f, fl.bloom), born: performance.now(), phase: Math.random() * 6 };
        if (reduceMotion) item.born = -1e9;
        world.add(item.group);
      }
      item.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      item.group.userData.index = i;
      next.push(item);
    });
    for (const old of flowers) world.remove(old.group); // changed or removed flowers
    flowers = next;
    wake();
  }

  function setColors() {
    scene.background = new THREE.Color(css("--sky"));
    grassMat.color.set(css("--okay"));
    soilMat.color.set(css("--soil"));
    tuftMat.color.set("#9fd28c");
    stemMat.color.set("#8cc47a");
    leafMat.color.set("#a8d695");
    hemi.color.set(css("--sky"));
    hemi.groundColor.set(css("--soil"));
    for (const [f, m] of Object.entries(petalMats)) tint(m, css(`--${f}`));
    wake();
  }

  // ---------- size ----------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Step back just far enough that the whole round bed fits across the screen (phones need more room)
    const across = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const dist = Math.max(13.5, 7.4 / across + 1.2);
    camera.position.set(0, dist * 0.47, dist * 0.88);
    camera.lookAt(0, 0.9, 0);
    camera.updateProjectionMatrix();
    wake();
  }
  new ResizeObserver(resize).observe(container);

  // ---------- turning and tapping ----------
  let dragging = false, startX = 0, startY = 0, startRot = 0, moved = 0, spin = 0;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "pan-y"; // vertical swipes still scroll the page
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; startX = e.clientX; startY = e.clientY; startRot = world.rotation.y;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx), Math.abs(e.clientY - startY));
    world.rotation.y = startRot + dx * 0.008;
    wake();
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) pick(e);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  const ray = new THREE.Raycaster();
  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(p, camera);
    const hit = ray.intersectObjects(flowers.map((x) => x.group), true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && o.userData.index === undefined) o = o.parent;
    if (o) select(o.userData.index);
  }

  let selected = -1;
  function select(i) {
    if (!flowers.length) return;
    selected = ((i % flowers.length) + flowers.length) % flowers.length;
    flowers.forEach((x, k) => x.group.scale.setScalar(k === selected ? BIG : SIZE));
    onPick(selected);
    wake();
  }

  // ---------- drawing ----------
  const visible = () => !document.hidden && container.isConnected;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let busy = false;
    if (!reduceMotion && !dragging) world.rotation.y += dt * 0.08; // slow turn
    for (const x of flowers) {
      const age = (now - x.born) / 900;
      const grow = age >= 1 ? 1 : 1 - Math.pow(1 - Math.max(0, age), 3);
      if (age < 1) busy = true;
      const base = flowers.indexOf(x) === selected ? BIG : SIZE;
      x.group.scale.setScalar(base * Math.max(0.001, grow));
      if (!reduceMotion) x.group.rotation.z = Math.sin(now / 1100 + x.phase) * 0.035;
    }
    renderer.render(scene, camera);
    running = visible() && (!reduceMotion || busy || dragging);
    if (running) requestAnimationFrame(frame);
  }
  function wake() {
    if (running || !visible()) { if (reduceMotion) renderer.render(scene, camera); return; }
    running = true; last = performance.now();
    requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", wake);
  setColors();
  resize();

  return { update, setColors, select, selectNext: (d) => select((selected < 0 ? -1 : selected) + d), canvas };
}
