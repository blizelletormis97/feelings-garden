// Feelings Garden in 3D (three.js): a round pastel garden bed where each check-in grows a flower.
// Drag to turn the garden, tap a flower to see its day. Butterflies, a hiding ladybug, rain from a watering
// cloud, and a sky that follows the bright or dark theme (sun and clouds, or moon, stars and fireflies). Returns null when the device has no WebGL,
// so the page can fall back to the flat garden.
import * as THREE from "./vendor/three.module.min.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#cccccc";
const SIZE = 1.35, BIG = 1.7; // flower size, and size of the flower you tapped
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // sunflower spacing, so flowers never overlap

export function createGarden3D(container, { onPick = () => {}, onFriend = () => {}, onWatered = () => {}, reduceMotion = false } = {}) {
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

  function makeFlower(f, bloom, size = 2) {
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
    head.scale.setScalar(size === 1 ? 0.78 : size === 3 ? 1.3 : 1); // a bigger feeling grows a bigger flower head
    g.add(head);
    g.add(new THREE.Mesh(shadowGeo, shadowMat));
    g.userData.head = head;
    return g;
  }

  let flowers = []; // { key, group, born, phase }
  function update(list) {
    const next = [];
    list.forEach((fl, i) => {
      const key = `${fl.d}|${fl.f}|${fl.bloom ? 1 : 0}|${fl.size || 2}`;
      const r = 0.95 * Math.sqrt(i + 0.6);
      const a = i * GOLDEN;
      let item = flowers.find((x) => x.key === key);
      if (item) flowers = flowers.filter((x) => x !== item);
      else {
        item = { key, group: makeFlower(fl.f, fl.bloom, fl.size || 2), born: performance.now(), phase: Math.random() * 6 };
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


  // ---------- sparkles (a small pool, reused) ----------
  const SPARKS = 240;
  const sparkMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xfff1a1 }), SPARKS);
  sparkMesh.frustumCulled = false;
  scene.add(sparkMesh);
  const sparks = Array.from({ length: SPARKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1 }));
  const dummy = new THREE.Object3D();
  let sparkNext = 0;
  function burst(at, n = 14) {
    if (reduceMotion) return;
    for (let k = 0; k < n; k++) {
      const sp = sparks[sparkNext++ % SPARKS];
      sp.p.copy(at);
      sp.v.set(Math.random() - 0.5, Math.random() * 0.9 + 0.4, Math.random() - 0.5).multiplyScalar(2.2);
      sp.max = sp.life = 0.6 + Math.random() * 0.5;
    }
    wake();
  }
  function stepSparks(dt) {
    let any = false;
    sparks.forEach((sp, k) => {
      if (sp.life > 0) {
        sp.life -= dt; any = true;
        sp.v.y -= dt * 2.5;
        sp.p.addScaledVector(sp.v, dt);
      }
      dummy.position.copy(sp.p);
      dummy.rotation.set(sp.life * 6, sp.life * 4, 0);
      dummy.scale.setScalar(Math.max(0, sp.life / sp.max));
      dummy.updateMatrix();
      sparkMesh.setMatrixAt(k, dummy.matrix);
    });
    sparkMesh.instanceMatrix.needsUpdate = true;
    return any;
  }
  const headPos = (item) => item.group.userData.head.getWorldPosition(new THREE.Vector3());

  // ---------- sky: lives on the camera, so it stays put while the garden turns ----------
  scene.add(camera);
  const sky = new THREE.Group();
  camera.add(sky);
  const SKY_Z = -40;
  // fx, fy: where in the view, as a share of half the width and half the height (fy 1 = top edge)
  function placeSky(o) {
    const halfH = -SKY_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    o.position.set(o.userData.fx * halfH * camera.aspect, o.userData.fy * halfH, SKY_Z + (o.userData.dz || 0));
  }
  const skyThing = (o, fx, fy, dz = 0) => { o.userData = { ...o.userData, fx, fy, dz }; sky.add(o); return o; };

  // the sun
  const sunDisc = new THREE.Group();
  sunDisc.add(new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a })));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(2.9, 40), new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.55, depthWrite: false }));
  halo.position.z = -0.1;
  sunDisc.add(halo);
  skyThing(sunDisc, -0.62, 0.72);

  // clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  const puffGeo = new THREE.SphereGeometry(1, 18, 12);
  function makeCloud(mat) {
    const c = new THREE.Group();
    [[0, 0, 1.25], [1.3, -0.25, 0.95], [-1.3, -0.3, 0.9], [0.6, 0.45, 0.9], [-0.55, 0.35, 0.8]].forEach(([x, y, r]) => {
      const puff = new THREE.Mesh(puffGeo, mat);
      puff.position.set(x, y, 0); puff.scale.set(r, r * 0.8, r * 0.6);
      c.add(puff);
    });
    return c;
  }
  const clouds = [[-0.15, 0.55, 1.1], [0.55, 0.78, 0.85], [1.15, 0.45, 1]].map(([fx, fy, sc]) => {
    const c = skyThing(makeCloud(cloudMat), fx, fy, 2);
    c.scale.setScalar(sc);
    c.userData.speed = 0.006 + sc * 0.004;
    return c;
  });

  // the moon (a crescent: a pale disc with a sky-coloured disc over part of it)
  const moon = new THREE.Group();
  moon.add(new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: 0xfff4cc })));
  const moonCut = new THREE.Mesh(new THREE.CircleGeometry(1.45, 40), new THREE.MeshBasicMaterial());
  moonCut.position.set(0.75, 0.45, 0.05);
  moon.add(moonCut);
  skyThing(moon, 0.6, 0.7);

  // stars
  const STARS = 70;
  const starSpots = Array.from({ length: STARS }, (_, i) => [((i * 0.6180339) % 1) * 2.2 - 1.1, 0.28 + ((i * 0.7548776) % 1) * 0.7]);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STARS * 3), 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfffbe6, size: 0.34, transparent: true });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  sky.add(stars);
  function placeStars() {
    const halfH = -SKY_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const pos = starGeo.attributes.position;
    starSpots.forEach(([fx, fy], i) => pos.setXYZ(i, fx * halfH * camera.aspect, fy * halfH, SKY_Z - 1));
    pos.needsUpdate = true;
  }

  // fireflies (night only), floating over the garden
  const fireflies = Array.from({ length: 16 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff59a, transparent: true }));
    const a = i * GOLDEN * 3, r = 1.2 + (i % 5) * 0.85;
    m.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.7 + (i % 4) * 0.55, ph: i * 1.7 };
    m.position.set(m.userData.x, m.userData.y, m.userData.z);
    world.add(m);
    return m;
  });

  // ---------- butterflies ----------
  const hitMat = new THREE.MeshBasicMaterial({ visible: false }); // invisible, larger tap targets
  const hitGeo = new THREE.SphereGeometry(1, 10, 8);
  const wingUpGeo = new THREE.CircleGeometry(0.23, 20); wingUpGeo.rotateX(-Math.PI / 2); wingUpGeo.scale(1, 1, 0.85); wingUpGeo.translate(0.22, 0, 0.09);
  const wingLowGeo = new THREE.CircleGeometry(0.15, 16); wingLowGeo.rotateX(-Math.PI / 2); wingLowGeo.translate(0.15, 0, -0.13);
  const bodyGeo = new THREE.CapsuleGeometry(0.035, 0.28, 4, 8); bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6b5a6e });
  const butterflies = ["#f8b4d9", "#d8ccf5", "#ffe28f"].map((color, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    const wingMat = tint(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), color);
    const wings = [-1, 1].map((side) => {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(wingUpGeo, wingMat), new THREE.Mesh(wingLowGeo, wingMat));
      w.scale.x = side;
      g.add(w);
      return w;
    });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.scale.setScalar(0.55);
    g.add(hit);
    g.scale.setScalar(1.6);
    g.userData = { friend: "butterfly", wings, r: 2.2 + i * 1.1, h: 1.9 + i * 0.35, speed: (i % 2 ? -1 : 1) * (0.22 + i * 0.05), ph: i * 2.1, loop: -1 };
    scene.add(g);
    return g;
  });
  const flyAt = (b, t) => {
    const u = b.userData, a = u.ph + t * u.speed;
    const r = u.r + 0.6 * Math.sin(t * 0.7 + u.ph);
    let y = u.h + 0.35 * Math.sin(t * 1.7 + u.ph) + 0.1 * Math.sin(t * 5.3);
    if (u.loop >= 0) { const k = Math.min(1, (t - u.loop) / 1.6); y += Math.sin(k * Math.PI) * 1.6; if (k >= 1) u.loop = -1; }
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };

  // ---------- the ladybug ----------
  const ink = new THREE.MeshLambertMaterial({ color: 0x3a3238 });
  const lady = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), tint(new THREE.MeshLambertMaterial(), "#ff8f8f"));
  shell.scale.y = 0.8;
  lady.add(shell);
  const ladyHead = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), ink);
  ladyHead.position.set(0, 0.03, 0.2);
  lady.add(ladyHead);
  const dotGeo = new THREE.SphereGeometry(0.035, 8, 6);
  [[0.08, 0.06], [-0.08, 0.06], [0.1, -0.07], [-0.1, -0.07], [0, -0.13]].forEach(([x, z]) => {
    const d = new THREE.Mesh(dotGeo, ink);
    d.position.set(x, Math.sqrt(Math.max(0, 0.04 - x * x - z * z)) * 0.8, z);
    lady.add(d);
  });
  const ladyHit = new THREE.Mesh(hitGeo, hitMat);
  ladyHit.scale.setScalar(0.45);
  lady.add(ladyHit);
  lady.userData = { friend: "ladybug", state: "walk", since: 0, turn: 0.6 };
  world.add(lady);
  const LADY_SIZE = 1.6;
  function hideLadybug() {
    // somewhere new: next to a flower if there are any, otherwise in the grass
    const near = flowers.length ? flowers[Math.floor(Math.random() * flowers.length)].group.position : null;
    const a = Math.random() * Math.PI * 2, r = near ? 0.55 : 1 + Math.random() * 3.5;
    lady.position.set((near?.x ?? 0) + Math.cos(a) * r, 0.01, (near?.z ?? 0) + Math.sin(a) * r);
    if (lady.position.length() > 5) lady.position.setLength(4.5);
    lady.rotation.y = Math.random() * Math.PI * 2;
  }
  hideLadybug();
  lady.scale.setScalar(LADY_SIZE);

  // ---------- rain from a little cloud ----------
  const DROPS = 140;
  const dropGeo = new THREE.SphereGeometry(0.045, 6, 6); dropGeo.scale(1, 3.2, 1);
  const rain = new THREE.InstancedMesh(dropGeo, new THREE.MeshBasicMaterial({ color: 0x9fd3f5 }), DROPS);
  rain.frustumCulled = false;
  rain.visible = false;
  world.add(rain);
  const drops = Array.from({ length: DROPS }, (_, i) => { const a = i * GOLDEN, r = 4.6 * Math.sqrt((i + 0.5) / DROPS); return { x: Math.cos(a) * r, z: Math.sin(a) * r, delay: Math.random() * 0.6 }; });
  const rainCloudMat = new THREE.MeshBasicMaterial({ color: 0xeaf4fb, transparent: true, opacity: 0, depthWrite: false });
  const rainCloud = makeCloud(rainCloudMat);
  rainCloud.scale.set(1.6, 0.95, 1.4);
  rainCloud.position.set(0, 4.6, -0.6);
  rainCloud.visible = false;
  scene.add(rainCloud);
  let rainStart = -1;
  const RAIN = 2.8; // seconds of rain
  function water() {
    if (rainStart >= 0) return false;
    if (reduceMotion) { onWatered(); return true; }
    rainStart = performance.now();
    rain.visible = rainCloud.visible = true;
    wake();
    return true;
  }
  function stepRain(now) {
    if (rainStart < 0) return false;
    const el = (now - rainStart) / 1000;
    rainCloudMat.opacity = Math.min(1, el / 0.4, Math.max(0, (RAIN + 0.6 - el) / 0.5)) * 0.95;
    drops.forEach((d, k) => {
      const tt = el - 0.35 - d.delay;
      const falling = tt > 0 && el < RAIN;
      const y = 4 - ((tt * 7.5) % 4.1);
      dummy.position.set(d.x, falling ? y : -5, d.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(falling ? 1 : 0);
      dummy.updateMatrix();
      rain.setMatrixAt(k, dummy.matrix);
    });
    rain.instanceMatrix.needsUpdate = true;
    if (el > RAIN + 0.7) {
      rainStart = -1;
      rain.visible = rainCloud.visible = false;
      // the flowers say thank you: a happy wiggle and sparkles, one after another
      flowers.forEach((x, k) => { x.wig = now + k * 70; setTimeout(() => burst(headPos(x), 8), k * 70); });
      onWatered();
    }
    return true;
  }

  // ---------- garden themes (Premium): beach, snow and space ----------
  const THEMES = {
    beach: { ground: "#f3e2b3", soil: "#dcc08a", tuft: "#b9dea0", stone: "#f9d5d3", sky: "#cdeefc", nightSky: "#1c3246" },
    snow: { ground: "#f3f7fb", soil: "#c3d2df", tuft: "#d8e6ee", stone: "#ffffff", sky: "#e1edf7", nightSky: "#1f2a3a", snow: true },
    space: { ground: "#cbbcf2", soil: "#7f6cb8", tuft: "#e2d8ff", stone: "#f1ecff", sky: "#2b2456", nightSky: "#1b1738", alwaysNight: true },
  };
  let theme = "meadow";
  function setTheme(name) { theme = THEMES[name] ? name : "meadow"; setColors(); }

  // falling snow for the snow theme
  const FLAKES = 160;
  const snow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), FLAKES);
  snow.frustumCulled = false;
  snow.visible = false;
  world.add(snow);
  const flakes = Array.from({ length: FLAKES }, (_, i) => { const a = i * GOLDEN, r = 6.5 * Math.sqrt((i + 0.5) / FLAKES); return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: (i * 0.37) % 6, sp: 0.35 + (i % 7) * 0.06, ph: i }; });
  function stepSnow(t) {
    if (!snow.visible) return;
    flakes.forEach((f, k) => {
      const y = reduceMotion ? f.y : 6 - ((6 - f.y + t * f.sp) % 6);
      dummy.position.set(f.x + (reduceMotion ? 0 : Math.sin(t * 0.8 + f.ph) * 0.25), y, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      snow.setMatrixAt(k, dummy.matrix);
    });
    snow.instanceMatrix.needsUpdate = true;
  }

  // ---------- colours and day or night ----------
  let night = false;
  function setColors() {
    const T = THEMES[theme];
    const dark = new THREE.Color(css("--bg")).getHSL({}).l < 0.35;
    night = dark || Boolean(T?.alwaysNight);
    const skyCol = T ? (dark ? T.nightSky : T.sky) : css("--sky");
    scene.background = new THREE.Color(skyCol);
    grassMat.color.set(T?.ground ?? css("--okay"));
    soilMat.color.set(T?.soil ?? css("--soil"));
    tuftMat.color.set(T?.tuft ?? "#9fd28c");
    stoneMat.color.set(T?.stone ?? "#f3efe9");
    snow.visible = Boolean(T?.snow);
    stepSnow(performance.now() / 1000);
    stemMat.color.set("#8cc47a");
    leafMat.color.set("#a8d695");
    hemi.color.set(skyCol);
    hemi.groundColor.set(T?.soil ?? css("--soil"));
    hemi.intensity = night ? 1.25 : 1.6;
    sun.intensity = night ? 1.0 : 1.5;
    for (const [f, m] of Object.entries(petalMats)) tint(m, css(`--${f}`));
    moonCut.material.color.set(skyCol);
    sunDisc.visible = !night;
    clouds.forEach((c) => { c.visible = !night; });
    moon.visible = stars.visible = night;
    fireflies.forEach((m) => { m.visible = night; });
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
    sky.children.forEach((o) => { if (o.userData.fx !== undefined) placeSky(o); });
    placeStars();
    wake();
  }
  new ResizeObserver(resize).observe(container);

  // ---------- turning and tapping ----------
  let dragging = false, startX = 0, startY = 0, startRot = 0, moved = 0;
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
    const targets = [...butterflies, ...flowers.map((x) => x.group)];
    if (lady.userData.state === "walk") targets.push(lady);
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && o.userData.index === undefined && !o.userData.friend) o = o.parent;
    if (!o) return;
    if (o.userData.friend) return found(o);
    select(o.userData.index, true);
  }

  function found(o) {
    const now = performance.now();
    burst(o.getWorldPosition(new THREE.Vector3()), 18);
    if (o === lady) {
      // off it flies, to hide somewhere new
      lady.userData.state = "fly"; lady.userData.since = now;
      if (reduceMotion) { hideLadybug(); lady.userData.state = "walk"; }
    } else if (reduceMotion) {
      o.userData.ph += 2.2;
    } else {
      o.userData.loop = now / 1000;
    }
    onFriend(o.userData.friend);
    wake();
  }

  let selected = -1;
  function select(i, tapped = false) {
    if (!flowers.length) return;
    selected = ((i % flowers.length) + flowers.length) % flowers.length;
    const item = flowers[selected];
    flowers.forEach((x, k) => x.group.scale.setScalar(k === selected ? BIG : SIZE));
    if (!reduceMotion) { item.wig = performance.now(); setTimeout(() => burst(headPos(item), 12), 60); }
    onPick(selected, tapped);
    wake();
  }

  // ---------- drawing ----------
  const visible = () => !document.hidden && container.isConnected;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    let busy = false;
    if (!reduceMotion && !dragging) world.rotation.y += dt * 0.08; // slow turn

    for (const x of flowers) {
      const age = (now - x.born) / 900;
      const grow = age >= 1 ? 1 : 1 - Math.pow(1 - Math.max(0, age), 3);
      if (age < 1) busy = true;
      const base = (flowers.indexOf(x) === selected ? BIG : SIZE) * Math.max(0.001, grow);
      let wz = 0, sy = 1;
      if (x.wig) {
        const k = (now - x.wig) / 1000;
        if (k > 1.2) x.wig = 0;
        else if (k > 0) { const fade = 1 - k / 1.2; wz = Math.sin(k * 18) * 0.22 * fade; sy = 1 + 0.14 * Math.sin(k * 11) * fade; busy = true; }
        else busy = true;
      }
      x.group.scale.set(base, base * sy, base);
      x.group.rotation.z = (reduceMotion ? 0 : Math.sin(now / 1100 + x.phase) * 0.035) + wz;
    }

    // butterflies
    for (const b of butterflies) {
      const u = b.userData;
      const tb = reduceMotion ? 0 : t;
      b.position.copy(flyAt(b, tb));
      b.lookAt(flyAt(b, tb + 0.06).add(reduceMotion ? new THREE.Vector3(0.001, 0, 0) : new THREE.Vector3()));
      const flap = reduceMotion ? 0.5 : Math.sin(t * (u.loop >= 0 ? 26 : 15) + u.ph) * 0.75 + 0.25;
      u.wings.forEach((w, k) => { w.rotation.z = (k ? 1 : -1) * flap; });
    }

    // the ladybug crawls about; when found it flies off, hides, and comes back somewhere else
    const L = lady.userData;
    if (L.state === "walk" && !reduceMotion) {
      if (Math.random() < dt * 0.4) L.turn = (Math.random() - 0.5) * 1.6;
      lady.rotation.y += L.turn * dt;
      lady.position.x += Math.sin(lady.rotation.y) * 0.22 * dt;
      lady.position.z += Math.cos(lady.rotation.y) * 0.22 * dt;
      if (lady.position.length() > 5) lady.rotation.y = Math.atan2(-lady.position.x, -lady.position.z);
      lady.position.y = 0.01;
      lady.scale.setScalar(LADY_SIZE);
    } else if (L.state === "fly") {
      const k = (now - L.since) / 1000;
      lady.position.y = 0.01 + k * k * 4;
      lady.rotation.y += dt * 8;
      lady.scale.setScalar(LADY_SIZE * Math.max(0, 1 - k));
      busy = true;
      if (k >= 1) { L.state = "hidden"; L.since = now; lady.visible = false; }
    } else if (L.state === "hidden") {
      busy = true;
      if (now - L.since > 3500) { hideLadybug(); lady.visible = true; L.state = "grow"; L.since = now; }
    } else if (L.state === "grow") {
      const k = Math.min(1, (now - L.since) / 600);
      lady.scale.setScalar(LADY_SIZE * k);
      busy = true;
      if (k >= 1) L.state = "walk";
    }

    // sky
    if (!night && !reduceMotion) {
      clouds.forEach((c) => { c.userData.fx += c.userData.speed * dt; if (c.userData.fx > 1.5) c.userData.fx = -1.5; placeSky(c); });
      halo.scale.setScalar(1 + Math.sin(t * 1.3) * 0.05);
    }
    if (night) {
      starMat.opacity = reduceMotion ? 1 : 0.75 + Math.sin(t * 2.1) * 0.25;
      fireflies.forEach((m) => {
        const u = m.userData;
        if (!reduceMotion) m.position.set(u.x + Math.sin(t * 0.5 + u.ph) * 0.5, u.y + Math.sin(t * 0.8 + u.ph * 2) * 0.3, u.z + Math.cos(t * 0.45 + u.ph) * 0.5);
        m.material.opacity = reduceMotion ? 0.9 : 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.4 + u.ph));
      });
    }

    if (stepRain(now)) busy = true;
    stepSnow(t);
    if (stepSparks(dt)) busy = true;
    renderer.render(scene, camera);
    running = visible() && (!reduceMotion || busy || dragging);
    if (running) requestAnimationFrame(frame);
  }
  function wake() {
    if (running || !visible()) return;
    running = true; last = performance.now();
    requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", wake);
  setColors();
  resize();

  return { update, setColors, setTheme, select, selectNext: (d) => select((selected < 0 ? -1 : selected) + d, true), water, canvas };
}
