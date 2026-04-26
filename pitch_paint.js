// ══════════════════════════════════════════════════════════════════
// pitch_paint.js — Marcador + escudos pintados sobre el césped 3D
//
// DEPENDE DE: Scene, Field (globales ya inicializados)
//
// ACTIVACIÓN DESDE FIREBASE (nodo engine_3d/paint, typeid 903):
//
//   PitchPaint.show(homeScore, awayScore, homeLogoUrl, awayLogoUrl)
//   PitchPaint.hide()
//
// ANIMACIÓN: llamar PitchPaint.update(dt) en tu render loop.
// ══════════════════════════════════════════════════════════════════

const PitchPaint = (() => {

  const { scene, renderer } = Scene;
  const { Y, FW, FH }       = Field;

  // ── CANVAS DE ALTA RESOLUCIÓN ────────────────────────────────────
  const paintCanvas = document.createElement('canvas');
  paintCanvas.width  = 2048;
  paintCanvas.height = 1024;
  const paintCtx = paintCanvas.getContext('2d');

  // ── TEXTURA 3D (Anisotropy para nitidez en perspectiva) ──────────
  const paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  paintTexture.minFilter  = THREE.LinearMipmapLinearFilter;
  paintTexture.magFilter  = THREE.LinearFilter;

  // ── MATERIAL — Anti-parpadeo (Z-fighting) ────────────────────────
  const paintMat = new THREE.MeshBasicMaterial({
    map:                 paintTexture,
    transparent:         true,
    opacity:             0,
    depthWrite:          false,
    depthTest:           true,
    polygonOffset:       true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits:  -4,
  });

  // ── PLANO PEGADO AL CÉSPED ───────────────────────────────────────
  const paintPlane = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), paintMat);
  paintPlane.rotation.x  = -Math.PI / 2;
  paintPlane.position.y  = Y + 0.05;   // Justo encima del césped, debajo de las líneas (0.08)
  paintPlane.renderOrder = 3;
  scene.add(paintPlane);

  // ── ESTADO DE FADE ───────────────────────────────────────────────
  let currentOpacity = 0;
  let targetOpacity  = 0;
  let lastKey        = '';   // Caché para no redibujar si no cambió nada

  // ── DIBUJAR IMAGEN CON FALLBACK CORS ────────────────────────────
  function drawImageSafe(url, x, y, size) {
    if (!url || !url.startsWith('http')) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      paintCtx.save();
      paintCtx.imageSmoothingEnabled  = true;
      paintCtx.imageSmoothingQuality  = 'high';
      paintCtx.shadowBlur   = 0;
      paintCtx.shadowColor  = 'transparent';
      paintCtx.globalAlpha  = 0.65;
      paintCtx.drawImage(img, x - size / 2, y - size / 2, size, size);
      paintCtx.restore();
      paintTexture.needsUpdate = true;
    };

    img.onerror = () => {
      // Fallback: proxy CORS alternativo
      const fallback = new Image();
      fallback.crossOrigin = 'Anonymous';
      fallback.onload = () => {
        paintCtx.save();
        paintCtx.imageSmoothingEnabled = true;
        paintCtx.imageSmoothingQuality = 'high';
        paintCtx.shadowBlur  = 0;
        paintCtx.shadowColor = 'transparent';
        paintCtx.globalAlpha = 0.65;
        paintCtx.drawImage(fallback, x - size / 2, y - size / 2, size, size);
        paintCtx.restore();
        paintTexture.needsUpdate = true;
      };
      fallback.src = 'https://corsproxy.io/?' + encodeURIComponent(url);
    };

    img.src = url;
  }

  // ── API PÚBLICA ──────────────────────────────────────────────────

  /**
   * Muestra el marcador pintado en el césped.
   * @param {number|string} homeScore  Goles local
   * @param {number|string} awayScore  Goles visitante
   * @param {string}        homeLogoUrl  URL del escudo local (https://...)
   * @param {string}        awayLogoUrl  URL del escudo visitante
   */
  function show(homeScore, awayScore, homeLogoUrl, awayLogoUrl) {
    const key = `${homeScore}-${awayScore}-${homeLogoUrl}-${awayLogoUrl}`;
    if (key === lastKey && targetOpacity === 1.0) return; // Sin cambios
    lastKey = key;

    // Limpiar lienzo
    paintCtx.clearRect(0, 0, 2048, 1024);
    paintTexture.needsUpdate = true;
    targetOpacity = 1.0;

    // ── Números del marcador ─────────────────────────────────────
    paintCtx.save();
    paintCtx.fillStyle    = '#ffffff';
    paintCtx.font         = 'bold 360px "Segoe UI", sans-serif';
    paintCtx.textAlign    = 'center';
    paintCtx.textBaseline = 'middle';
    paintCtx.globalAlpha  = 0.9;
    paintCtx.shadowColor  = 'rgba(0,0,0,0.85)';
    paintCtx.shadowBlur   = 35;

    const scoreY      = 320;
    const gap         = 450;

    paintCtx.fillText(`${homeScore}`, 1024 - gap, scoreY);
    paintCtx.fillText('-',             1024,       scoreY - 20);
    paintCtx.fillText(`${awayScore}`, 1024 + gap, scoreY);
    paintCtx.restore();
    paintTexture.needsUpdate = true;

    // ── Escudos ──────────────────────────────────────────────────
    const logoSize    = 390;
    const logoY       = 750;
    const logoXOffset = 400;

    drawImageSafe(homeLogoUrl, 1024 - logoXOffset, logoY, logoSize);
    drawImageSafe(awayLogoUrl, 1024 + logoXOffset, logoY, logoSize);
  }

  /** Oculta el marcador con fade-out suave */
  function hide() {
    targetOpacity = 0;
  }

  /**
   * Actualiza el fade. Llamar en el render loop con delta time.
   * @param {number} dt  Tiempo en segundos desde el último frame
   */
  function update(dt) {
    if (Math.abs(currentOpacity - targetOpacity) > 0.005) {
      currentOpacity += (targetOpacity - currentOpacity) * dt * 3;
      paintMat.opacity = currentOpacity;
    }
  }

  return { show, hide, update };

})();
