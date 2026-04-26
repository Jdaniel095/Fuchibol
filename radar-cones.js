// ══════════════════════════════════════════════════════════════════
// radar-cones.js — Animaciones de cono/radar para córner, lateral
//                  y tiro libre. Standalone, sin dependencias.
// ══════════════════════════════════════════════════════════════════

class RadarCones {

  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.timer   = 0;
    this.last    = performance.now();
    this._raf    = null;
    this._autoHideTO = null;

    // Estado activo
    this._mode   = null; 

    // Parámetros de cada modo
    this._cornerSide     = 'tl';
    this._lateralX       = 0;
    this._lateralY       = 0;
    this._lateralAimsRight = true;
    this._freekickX      = 0;
    this._freekickY      = 0;
    this._freekickAimsRight = true;

    this._loop = this._loop.bind(this);
    this._raf  = requestAnimationFrame(this._loop);
  }

  // ── API PÚBLICA ──────────────────────────────────────────────────

  showCorner(side = 'tl', autohideMs = 10000) {
    // 🛡️ ESCUDO: Si ya está activo este mismo córner, no reiniciamos la animación
    if (this._mode === 'corner' && this._cornerSide === side) {
        clearTimeout(this._autoHideTO);
        this._scheduleHide(autohideMs);
        return; 
    }
    this._reset();
    this._mode       = 'corner';
    this._cornerSide = side;
    this._scheduleHide(autohideMs);
  }

  showThrowIn(normX = 0.5, isOnTop = true, aimsRight = true, autohideMs = 10000) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const nx = normX * W;
    const ny = isOnTop ? 12 : H - 12;

    // 🛡️ ESCUDO: Si ya está activo, solo actualizamos su posición sin reiniciar la onda
    if (this._mode === 'lateral' && this._lateralAimsRight === aimsRight && this._lateralY === ny) {
        this._lateralX = nx; 
        clearTimeout(this._autoHideTO);
        this._scheduleHide(autohideMs);
        return; 
    }

    this._reset();
    this._mode             = 'lateral';
    this._lateralX         = nx;
    this._lateralY         = ny;
    this._lateralAimsRight = aimsRight;
    this._scheduleHide(autohideMs);
  }

  showFreekick(normX = 0.5, normZ = 0.5, aimsRight = true, autohideMs = 10000) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const nx = normX * W;
    const ny = normZ * H;

    // 🛡️ ESCUDO: Si ya está activo, actualizamos posición sin romper la fluidez
    if (this._mode === 'freekick' && this._freekickAimsRight === aimsRight) {
        this._freekickX = nx; 
        this._freekickY = ny;
        clearTimeout(this._autoHideTO);
        this._scheduleHide(autohideMs);
        return; 
    }

    this._reset();
    this._mode              = 'freekick';
    this._freekickX         = nx;
    this._freekickY         = ny;
    this._freekickAimsRight = aimsRight;
    this._scheduleHide(autohideMs);
  }

  hide() {
    this._mode = null;
    clearTimeout(this._autoHideTO);
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._autoHideTO);
    this._mode = null;
  }

  // ── LOOP INTERNO ─────────────────────────────────────────────────

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    const dt  = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    const W = this.canvas.width;
    const H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);

    if (!this._mode) return;

    this.timer += dt;

    if      (this._mode === 'corner')   this._drawCornerCone(this.timer);
    else if (this._mode === 'lateral')  this._drawThrowInCone(this.timer);
    else if (this._mode === 'freekick') this._drawFreekickCone(this.timer);
  }

  // ── HELPERS ──────────────────────────────────────────────────────

  _reset() {
    this.timer = 0;
    clearTimeout(this._autoHideTO);
  }

  _scheduleHide(ms) {
    if (ms > 0) this._autoHideTO = setTimeout(() => this.hide(), ms);
  }

  // ── DRAW CORNER CONE ─────────────────────────────────────────────
  _drawCornerCone(t) {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;

    const DURATION      = 2.0; // Velocidad perfecta y profesional
    const progress      = (t % DURATION) / DURATION;
    const opacityFactor = Math.sin(progress * Math.PI);

    const ANGLE_WIDTH = 0.20 * Math.PI;
    let x, y, startAngle, endAngle;

    if      (this._cornerSide === 'tl') { x = 0; y = 0; startAngle = 0.5*Math.PI - ANGLE_WIDTH; endAngle = 0.5*Math.PI; }
    else if (this._cornerSide === 'tr') { x = W; y = 0; startAngle = 0.5*Math.PI;               endAngle = 0.5*Math.PI + ANGLE_WIDTH; }
    else if (this._cornerSide === 'bl') { x = 0; y = H; startAngle = 1.5*Math.PI;               endAngle = 1.5*Math.PI + ANGLE_WIDTH; }
    else                                { x = W; y = H; startAngle = 1.5*Math.PI - ANGLE_WIDTH; endAngle = 1.5*Math.PI; }

    const MAX_RADIUS = W * 0.35;

    this._drawFilledCone(x, y, MAX_RADIUS * 1.00 * progress, opacityFactor * 0.15, startAngle, endAngle, false);
    this._drawFilledCone(x, y, MAX_RADIUS * 0.66 * progress, opacityFactor * 0.35, startAngle, endAngle, false);
    this._drawFilledCone(x, y, MAX_RADIUS * 0.33 * progress, opacityFactor * 0.60, startAngle, endAngle, false);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, MAX_RADIUS * progress, startAngle, endAngle, false);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * opacityFactor})`;
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.restore();
  }

  // ── DRAW THROW-IN CONE ───────────────────────────────────────────
  _drawThrowInCone(t) {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;

    const DURATION      = 2.0;
    const progress      = (t % DURATION) / DURATION;
    const opacityFactor = Math.sin(progress * Math.PI);

    const x       = this._lateralX;
    const y       = this._lateralY;
    const isOnTop = (y < H / 2);

    const ANGLE_WIDTH = 0.20 * Math.PI;
    let startAngle, endAngle;

    if (isOnTop) {
      if (this._lateralAimsRight) { startAngle = 0.5*Math.PI; endAngle = 0.5*Math.PI - ANGLE_WIDTH; }
      else                        { startAngle = 0.5*Math.PI; endAngle = 0.5*Math.PI + ANGLE_WIDTH; }
    } else {
      if (this._lateralAimsRight) { startAngle = 1.5*Math.PI; endAngle = 1.5*Math.PI + ANGLE_WIDTH; }
      else                        { startAngle = 1.5*Math.PI; endAngle = 1.5*Math.PI - ANGLE_WIDTH; }
    }

    const MAX_RADIUS = W * 0.30;
    const useCCW     = (isOnTop && this._lateralAimsRight) || (!isOnTop && !this._lateralAimsRight);

    this._drawFilledCone(x, y, MAX_RADIUS * 1.00 * progress, opacityFactor * 0.15, startAngle, endAngle, useCCW);
    this._drawFilledCone(x, y, MAX_RADIUS * 0.66 * progress, opacityFactor * 0.35, startAngle, endAngle, useCCW);
    this._drawFilledCone(x, y, MAX_RADIUS * 0.33 * progress, opacityFactor * 0.60, startAngle, endAngle, useCCW);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, MAX_RADIUS * progress, startAngle, endAngle, useCCW);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * opacityFactor})`;
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.restore();
  }

  // ── DRAW FREEKICK CONE ───────────────────────────────────────────
  _drawFreekickCone(t) {
    const ctx = this.ctx;
    const W   = this.canvas.width;

    const DURATION      = 2.0;
    const progress      = (t % DURATION) / DURATION;
    const opacityFactor = Math.sin(progress * Math.PI);

    const x = this._freekickX;
    const y = this._freekickY;

    const ANGLE_WIDTH = 0.18 * Math.PI;
    let startAngle, endAngle;

    if (this._freekickAimsRight) { startAngle = -ANGLE_WIDTH;          endAngle = ANGLE_WIDTH; }
    else                         { startAngle = Math.PI - ANGLE_WIDTH; endAngle = Math.PI + ANGLE_WIDTH; }

    const MAX_RADIUS = W * 0.22;

    this._drawFilledCone(x, y, MAX_RADIUS * 1.00 * progress, opacityFactor * 0.15, startAngle, endAngle, false);
    this._drawFilledCone(x, y, MAX_RADIUS * 0.66 * progress, opacityFactor * 0.35, startAngle, endAngle, false);
    this._drawFilledCone(x, y, MAX_RADIUS * 0.33 * progress, opacityFactor * 0.60, startAngle, endAngle, false);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, MAX_RADIUS * progress, startAngle, endAngle, false);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * opacityFactor})`;
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.restore();
  }

  // ── CONO RELLENO (helper compartido) ────────────────────────────
  _drawFilledCone(x, y, r, alpha, startAngle, endAngle, ccw) {
    if (alpha <= 0.01 || r <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, startAngle, endAngle, ccw);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════════════
// INTEGRACIÓN 3D PARA EL SMART PANEL
// ══════════════════════════════════════════════════════════════════
const Radar3D = (() => {
  if (typeof Scene === 'undefined') return null;
  const { scene, renderer } = Scene;
  const { Y, FW, FH } = Field;

  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  
  const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, // Inicia invisible
      depthWrite: false, side: THREE.DoubleSide
  });
  mat.renderOrder = 4;
  
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, Y + 0.02, 0); 
  scene.add(mesh);

  const radar = new RadarCones(canvas);
  
  // Variables para la aparición progresiva (Lerp)
  let currentOpacity = 0;
  let targetOpacity = 0;

function show(actionText, direction) {
      if (!actionText) { radar.hide(); return; }

      const pos = window._ultimaPosicionBalon || { x: 0, z: 0, normX: 0.5 };
      const normZ = (pos.z + FH / 2) / FH; 
      
      // ✨ FIX: Dejamos que el Panel controle la dirección sin contradecirlo
      const aimsRight = (direction === 1); 
      const isTop = (normZ < 0.5);

      const act = actionText.toUpperCase();

      if (act.includes('ESQUINA') || act.includes('CORNER')) {
          let side = 'tl';
          if (pos.normX < 0.5 && normZ < 0.5) side = 'tl';
          if (pos.normX >= 0.5 && normZ < 0.5) side = 'tr';
          if (pos.normX < 0.5 && normZ >= 0.5) side = 'bl';
          if (pos.normX >= 0.5 && normZ >= 0.5) side = 'br';
          
          radar.showCorner(side, 0); 
      } 
      else if (act.includes('LATERAL')) {
          radar.showThrowIn(pos.normX, isTop, aimsRight, 0);
      }
      else {
          radar.showFreekick(pos.normX, normZ, aimsRight, 0);
      }
  }

  function hide() {
      radar.hide();
  }

function update() {
      tex.needsUpdate = true;
      
      // ✨ FIX: Eliminamos window._overlayActivo. El radar ahora sobrevive a los carteles.
      // Solo se apaga si hay secuencia de Gol (bloqueoSecuencia), si no tiene modo, o si el balón no está.
      if (window._bloqueoSecuencia || !radar._mode || (typeof Objects !== 'undefined' && !Objects.ballGroup.visible)) {
          targetOpacity = 0;
      } else {
          targetOpacity = 0.85; // Máxima opacidad del radar
      }

      currentOpacity += (targetOpacity - currentOpacity) * 0.08;
      
      // Apagado de optimización
      if (currentOpacity < 0.01) {
          mat.opacity = 0;
          mesh.visible = false;
      } else {
          mesh.visible = true;
          mat.opacity = currentOpacity;
      }
  }

  return { show, hide, update };
})();