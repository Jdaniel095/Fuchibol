// ══════════════════════════════════════════════════════════════════
// offside-line.js — Línea y zona de offside animada sobre el césped
// ══════════════════════════════════════════════════════════════════

const OffsideLine = (() => {

  const { scene }     = Scene;
  const { Y, FW, FH } = Field;

  let _active    = false;
  let _elapsed   = 0;
  let _autoHideTO = null;
  const AUTO_HIDE_MS = 8000;

  // ── UNIFORMS ────────────────────────────────────────────────────
  const uniforms = {
    uTime:      { value: 0.0 },
    uOffsideX:  { value: 0.5 },   // posición normalizada [0..1]
    uAttackDir: { value: 1.0 },   // +1 ataca a la derecha, -1 a la izquierda
    uFW:        { value: FW   },  // ancho del campo
    uLineColor: { value: new THREE.Color(0xff4400) } // Rojo/Naranja original
  };

  // ── SHADER ORIGINAL RESTAURADO ──────────────────────────────────
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOffsideX;
      uniform float uAttackDir;
      uniform float uFW;
      uniform vec3  uLineColor;
      varying vec2  vUv;

      // Función original para una cuadrícula suave y sin "ruido"
      float drawGrid(vec2 uv, vec2 size, float thickness) {
        vec2 smoothUV = smoothstep(-thickness, thickness, fract(uv * size - 0.5));
        smoothUV = min(smoothUV, 1.0 - smoothUV);
        return 1.0 - smoothstep(0.0, 0.01, min(smoothUV.x, smoothUV.y));
      }

      void main() {
        float distX     = vUv.x - uOffsideX;
        float distWorld = abs(distX * uFW);
        vec4 finalColor = vec4(0.0);

        // Cuadrícula suave de fondo
        float gridVal = drawGrid(vUv, vec2(10.0, 30.0), 0.03);
        if (gridVal > 0.0) finalColor = vec4(1.0, 1.0, 1.0, 0.05);

        // Zona negra sombreada
        if (distX * uAttackDir > 0.0 && distWorld < 14.0) {
          float grad      = 1.0 - (distWorld / 14.0);
          grad            = pow(grad, 1.2);
          float flicker   = 1.0 + sin(uTime * 15.0) * 0.3;
          float blackAlpha = grad * 0.45 * flicker;
          finalColor = vec4(0.0, 0.0, 0.0, max(finalColor.a, blackAlpha));
        }

        // Grosor original de la línea roja (0.15 = más delgada)
        if (distWorld < 0.15) finalColor = vec4(uLineColor, 0.9);

        gl_FragColor = finalColor;
      }
    `,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
    depthTest:   true   // ← FIX: True para que el balón (que está más arriba) tape a la línea
  });

  // ── MESH ────────────────────────────────────────────────────────
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FW, FH),
    material
  );
  mesh.rotation.x  = -Math.PI / 2;
  mesh.position.y  = Y + 0.05;   // ← Altura original, justo sobre el pasto
  mesh.renderOrder = 4;          
  mesh.visible     = false;
  scene.add(mesh);

  // ── API ─────────────────────────────────────────────────────────
  function show(normX = 0.5, aimsRight = true, autoHideMs = AUTO_HIDE_MS) {
    _active = true;
    uniforms.uOffsideX.value  = Math.max(0, Math.min(1, normX));
    uniforms.uAttackDir.value = aimsRight ? 1.0 : -1.0;
    mesh.visible = true;

    clearTimeout(_autoHideTO);
    if (autoHideMs > 0) _autoHideTO = setTimeout(hide, autoHideMs);
  }

  function hide() {
    _active      = false;
    mesh.visible = false;
    clearTimeout(_autoHideTO);
    _autoHideTO  = null;
  }

  function isActive() { return _active; }

  function update(dt) {
    if (!_active) return;
    _elapsed += dt;
    uniforms.uTime.value = _elapsed;
  }

  return { show, hide, isActive, update };

})();