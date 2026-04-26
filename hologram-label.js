// ══════════════════════════════════════════════════════════════════
// hologram-label.js — Etiqueta 3D GIGANTE y MINIMALISTA 
// ══════════════════════════════════════════════════════════════════

const HologramLabel = (() => {
  if (typeof Scene === 'undefined' || typeof Objects === 'undefined') return null;

  const W = 2048, H = 600; 
  const canvas = document.createElement('canvas');
  canvas.width = W; 
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false 
  });
// BÚSCALO EN hologram-label.js (aprox línea 22)
  const sprite = new THREE.Sprite(material);
  // ✨ FIX: Aumentamos la escala drásticamente (antes 18.0, 5.2)
  sprite.scale.set(32.0, 9.2, 1); 
  sprite.renderOrder = 99;       
  sprite.visible = false;
  Scene.scene.add(sprite);

  let _active = false;
  let _timer = 0;
  const DURATION = 3.0; // 3 segundos exactos

  function draw(teamName) {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';

    // ✨ MAGIA MINIMALISTA: En lugar de un fondo sólido, usamos una sombra difuminada
    // Esto hace que el texto blanco resalte perfectamente sobre cualquier pasto o línea blanca
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;

    // ── TEXTO SUPERIOR ──
    ctx.font = "800 100px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = '#52FFF6'; // Cyan brillante
    ctx.letterSpacing = '24px';
    ctx.fillText("RECUPERA", W / 2, 180);
    ctx.letterSpacing = '0px';

    // ── LÍNEA SEPARADORA SUTIL ──
    ctx.fillStyle = 'rgba(82, 255, 246, 0.7)';
    ctx.fillRect(W/2 - 250, 230, 500, 6);

    // ── NOMBRE DEL EQUIPO ──
    ctx.font = "900 260px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    
    let displayTeam = String(teamName).toUpperCase();
    if (displayTeam.length > 20) displayTeam = displayTeam.substring(0, 18) + "...";
    
    ctx.fillText(displayTeam, W / 2, 480);

    ctx.shadowBlur = 0; 
    ctx.shadowOffsetY = 0; 
    texture.needsUpdate = true;
  }


  function show(teamId) {
    if (!teamId || teamId === '') return;

    // 🛡️ TRADUCCIÓN: Convertimos 'home'/'away' en el nombre real del Cache
    let nombreReal = 'EQUIPO';
    if (teamId === 'home') nombreReal = window._cachedTeamHome || 'LOCAL';
    else if (teamId === 'away') nombreReal = window._cachedTeamAway || 'VISITANTE';
    else nombreReal = teamId; // Por si ya venía el nombre

    draw(nombreReal);
    _active = true;
    _timer = 0;
    sprite.visible = true;
  }

// BÚSCALO EN hologram-label.js (aprox línea 70)
  function update(dt) {
    if (!_active || !Objects.ballGroup) return;

    _timer += dt;
    const bx = Objects.ballGroup.position.x;
    const bz = Objects.ballGroup.position.z;
    // ✨ FIX: Subimos la altura base para que flote bien por encima del balón
    const baseY = Objects.ballGroup.position.y + 7.5;

    if (_timer < 0.3) {
      material.opacity = _timer / 0.3;
      sprite.position.set(bx, baseY - 1.0 + (_timer / 0.3), bz);
    } else if (_timer < 2.5) {
      material.opacity = 1.0;
      const floatY = Math.sin(_timer * 3) * 0.2; 
      sprite.position.set(bx, baseY + floatY, bz);
    } else if (_timer < DURATION) {
      const fadeOut = (_timer - 2.5) / (DURATION - 2.5);
      material.opacity = 1.0 - fadeOut;
      sprite.position.set(bx, baseY + (fadeOut * 3.0), bz);
    } else {
      _active = false;
      sprite.visible = false;
    }
  }

  return { show, update };
})();