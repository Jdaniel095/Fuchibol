// ══════════════════════════════════════════════════════════════════
// field.js — Césped, suelo, laterales y líneas del campo
// ══════════════════════════════════════════════════════════════════

const Field = (() => {

  const { scene } = Scene;

  // ── DIMENSIONES FIFA ─────────────────────────────────────────────
  const S      = 0.6;
  const FW     = 105 * S,   FH   = 68 * S,    TH = 1.6;
  const Y      = TH / 2;
  const PA_W   = 40.32 * S, PA_D = 16.5 * S;
  const GA_W   = 18.32 * S, GA_D = 5.5 * S;
  const PEN_X  = 11 * S,    CR   = 9.15 * S,  CORN = 1 * S;
 // Arcos un 20% más grandes
const GOAL_W = 7.32 * S * 1.2,  GOAL_H = 2.44 * S * 1.2, GOAL_D = 2.0 * S * 1.2;

  const MARGIN_BACK = 1.5;
  const MARGIN_SIDE = 1;

  // ── TEXTURA CÉSPED ───────────────────────────────────────────────
  function makeGrassTexture() {
    const sz = 512;
    const cv = document.createElement('canvas');
    cv.width = sz; cv.height = sz;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#63a82a';
    ctx.fillRect(0, 0, sz, sz);

    ctx.fillStyle = '#589624';
    ctx.fillRect(sz / 2, 0, sz / 2, sz);

    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * sz, y = Math.random() * sz;
      const l = Math.random() * 3 + 1;
      ctx.strokeStyle = `rgba(255,255,255,0.02)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - l); ctx.stroke();
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(11, 4);
    return t;
  }

  // ── PLANO DE CÉSPED ──────────────────────────────────────────────
  const topGrass = new THREE.Mesh(
    new THREE.PlaneGeometry(FW + MARGIN_BACK * 2, FH + MARGIN_SIDE * 2),
    new THREE.MeshLambertMaterial({ map: makeGrassTexture() })
  );
  topGrass.rotation.x = -Math.PI / 2;
  topGrass.position.y = Y + 0.005;
  topGrass.receiveShadow = true;
  scene.add(topGrass);

  // ── TEXTURA LATERAL (DIRT) ───────────────────────────────────────
  function makeDirtTexture() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#1a4a0a'; ctx.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * 256, y = Math.random() * 64;
      ctx.fillStyle = `rgba(${Math.floor(Math.random()*40+10)},${Math.floor(Math.random()*60+30)},${Math.floor(Math.random()*20+5)},0.4)`;
      ctx.fillRect(x, y, 2, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
  }

  const dirt = makeDirtTexture();

  [
    { w: FH + MARGIN_SIDE * 2, h: TH, ry:  Math.PI / 2,  px: -(FW / 2 + MARGIN_BACK), pz: 0 },
    { w: FH + MARGIN_SIDE * 2, h: TH, ry: -Math.PI / 2,  px:  (FW / 2 + MARGIN_BACK), pz: 0 },
    { w: FW + MARGIN_BACK * 2, h: TH, ry:  Math.PI,      px: 0, pz: -(FH / 2 + MARGIN_SIDE) },
    { w: FW + MARGIN_BACK * 2, h: TH, ry:  0,            px: 0, pz:  (FH / 2 + MARGIN_SIDE) },
  ].forEach(s => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.h),
      new THREE.MeshLambertMaterial({ map: dirt })
    );
    m.rotation.y = s.ry;
    m.position.set(s.px, 0, s.pz);
    m.receiveShadow = true;
    scene.add(m);
  });

  const bot = new THREE.Mesh(
    new THREE.PlaneGeometry(FW, FH),
    new THREE.MeshLambertMaterial({ color: 0x0a2a05 })
  );
  bot.rotation.x = Math.PI / 2; bot.position.set(0, -TH/2 - 0.01, 0); scene.add(bot);

  const gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(FW + 30, FH + 30),
    new THREE.ShadowMaterial({ opacity: 0.4 })
  );
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -TH/2 - 0.02;
  gnd.receiveShadow = true; scene.add(gnd);

  // ── LÍNEAS DEL CAMPO ─────────────────────────────────────────────
  const LY  = Y + 0.08;
  const LW  = 0.20;
  const lMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide, depthWrite: false
  });
  lMat.renderOrder = 20;

  function seg(x1, z1, x2, z2) {
    const dx = x2-x1, dz = z2-z1, len = Math.sqrt(dx*dx + dz*dz);
    if (len < 0.001) return;
    const px = -dz/len, pz = dx/len;
    const v = new Float32Array([
      x1+px*LW, LY, z1+pz*LW,
      x1-px*LW, LY, z1-pz*LW,
      x2+px*LW, LY, z2+pz*LW,
      x2-px*LW, LY, z2-pz*LW,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.setIndex([0,1,2,1,3,2]);
    const m = new THREE.Mesh(g, lMat); m.renderOrder = 2; scene.add(m);
  }

  function rect(x1, z1, x2, z2) {
    seg(x1,z1,x2,z1); seg(x2,z1,x2,z2); seg(x2,z2,x1,z2); seg(x1,z2,x1,z1);
  }

  function dot(x, z, r = 0.30) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), lMat);
    m.rotation.x = -Math.PI/2; m.position.set(x, LY + 0.01, z);
    m.renderOrder = 2; scene.add(m);
  }

  function arc(cx, cz, r, a0, a1, n = 72) {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1-a0)*(i/n), t1 = a0 + (a1-a0)*((i+1)/n);
      seg(cx+Math.cos(t0)*r, cz+Math.sin(t0)*r,
          cx+Math.cos(t1)*r, cz+Math.sin(t1)*r);
    }
  }

  // Borde + línea de medio campo
  rect(-FW/2, -FH/2, FW/2, FH/2);
  seg(0, -FH/2, 0, FH/2);

  // Centro
  arc(0, 0, CR, 0, Math.PI * 2); dot(0, 0);

  // Área grande izquierda
  const LPx2 = -FW/2 + PA_D;
  rect(-FW/2, -PA_W/2, LPx2, PA_W/2);
  rect(-FW/2, -GA_W/2, -FW/2 + GA_D, GA_W/2);
  dot(-FW/2 + PEN_X, 0);
  {
    const px = -FW/2 + PEN_X; let pv = null;
    for (let i = 0; i <= 80; i++) {
      const a = -Math.PI + i*(Math.PI*2/80);
      const x = px + Math.cos(a)*CR, z = Math.sin(a)*CR;
      if (x > LPx2) { if (pv) seg(pv[0], pv[1], x, z); pv = [x, z]; }
      else pv = null;
    }
  }

  // Área grande derecha
  const RPx2 = FW/2 - PA_D;
  rect(RPx2, -PA_W/2, FW/2, PA_W/2);
  rect(FW/2 - GA_D, -GA_W/2, FW/2, GA_W/2);
  dot(FW/2 - PEN_X, 0);
  {
    const px = FW/2 - PEN_X; let pv = null;
    for (let i = 0; i <= 80; i++) {
      const a = i*(Math.PI*2/80);
      const x = px + Math.cos(a)*CR, z = Math.sin(a)*CR;
      if (x < RPx2) { if (pv) seg(pv[0], pv[1], x, z); pv = [x, z]; }
      else pv = null;
    }
  }

  // Arcos de córner
  arc(-FW/2, -FH/2, CORN, 0,           Math.PI/2);
  arc(-FW/2,  FH/2, CORN, -Math.PI/2,  0);
  arc( FW/2, -FH/2, CORN,  Math.PI/2,  Math.PI);
  arc( FW/2,  FH/2, CORN,  Math.PI,    Math.PI * 3/2);

  // ── EXPORTS ─────────────────────────────────────────────────────
  return { Y, FW, FH, GOAL_W, GOAL_H, GOAL_D };

})();