// ══════════════════════════════════════════════════════════════════
// scene.js — Renderer, cámara, luces y rotación del campo (Three.js)
// ══════════════════════════════════════════════════════════════════

const Scene = (() => {

  // ── RENDERER ────────────────────────────────────────────────────
  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  app.appendChild(renderer.domElement);

  // ── SCENE ───────────────────────────────────────────────────────
  const scene = new THREE.Scene();

  // ── CAMERA ──────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    40, window.innerWidth / window.innerHeight, 0.1, 600
  );

  const VIEWS = {
    broadcast: { pos: [0, 24, 67],  look: [0, 0, 11] },
    iso:       { pos: [0, 48, 40],  look: [0, 0,  0] },
    top:       { pos: [0, 78,  2],  look: [0, 0,  0] },
    goal:      { pos: [0,  8, 45],  look: [0, 2, -10] },
    custom:    { pos: [0, 24, 65],  look: [0, 0, -2] }
  };

  let currentView = 'broadcast';

  const camPos  = new THREE.Vector3(...VIEWS.broadcast.pos);
  const camLook = new THREE.Vector3(...VIEWS.broadcast.look);

  // Rotación de la maqueta entera
  const fieldRotTgt     = new THREE.Vector3(17 * Math.PI / 180, 0, 0);
  const currentFieldRot = new THREE.Vector3(17 * Math.PI / 180, 0, 0);

  function setView(v) {
    if (VIEWS[v]) currentView = v;
  }

  function setCustomView(data) {
    VIEWS.custom.pos  = data.pos;
    VIEWS.custom.look = data.look;
    if (data.fieldRot) {
      fieldRotTgt.set(
        data.fieldRot[0] * Math.PI / 180,
        data.fieldRot[1] * Math.PI / 180,
        data.fieldRot[2] * Math.PI / 180
      );
    } else {
      fieldRotTgt.set(0, 0, 0);
    }
    currentView = 'custom';
  }

  // ── LIGHTS ──────────────────────────────────────────────────────
  const ambLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambLight);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 0.5);
  sunLight.position.set(18, 52, 22);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left   = -55;
  sunLight.shadow.camera.right  =  55;
  sunLight.shadow.camera.top    =  45;
  sunLight.shadow.camera.bottom = -45;
  sunLight.shadow.camera.far    = 200;
  scene.add(sunLight);

  const spots = [];
  [[-38,34,-28],[38,34,-28],[-38,34,28],[38,34,28]].forEach(([x,y,z]) => {
    const s = new THREE.SpotLight(0xfff8e0, 0.65, 190, Math.PI / 5.5, 0.5);
    s.position.set(x, y, z);
    s.target.position.set(0, 0, 0);
    scene.add(s);
    scene.add(s.target);
    spots.push(s);
  });

  function applyLight(d) {
    ambLight.intensity = (d.amb  ?? 40) / 100 * 0.8;
    sunLight.intensity = (d.sun  ?? 30) / 100 * 1.6;
    spots.forEach(s => s.intensity = (d.spot ?? 70) / 100 * 0.9);
    if (d.sc) spots.forEach(s => s.color.set(d.sc));
    if (d.dc) sunLight.color.set(d.dc);
  }

  // ── CAMERA & SCENE LERP (llamado cada frame) ─────────────────────
  function updateCamera() {
    const tgt = VIEWS[currentView];

    camPos.lerp(new THREE.Vector3(...tgt.pos),  0.045);
    camLook.lerp(new THREE.Vector3(...tgt.look), 0.045);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    if (currentView === 'broadcast') {
      fieldRotTgt.set(17 * Math.PI / 180, 0, 0);
    } else if (currentView !== 'custom') {
      fieldRotTgt.set(0, 0, 0);
    }
    currentFieldRot.lerp(fieldRotTgt, 0.045);
    scene.rotation.set(currentFieldRot.x, currentFieldRot.y, currentFieldRot.z);
  }

  // ── RESIZE ──────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, renderer, camera, updateCamera, setView, applyLight, setCustomView };

})();