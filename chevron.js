// ══════════════════════════════════════════════════════════════════
// chevron.js — Canvas 2D sobre el campo 3D con Chevron de posesión
// ══════════════════════════════════════════════════════════════════

const Chevron = (() => {

  const { scene, renderer, camera, updateCamera } = Scene;
  const { Y, FW, FH } = Field;

  // ── CANVAS 2D SOBRE EL CAMPO (PlaneGeometry 3D) ─────────────────
  const OV_W = 2048, OV_H = 1024;
  const ovCanvas = document.createElement('canvas');
  ovCanvas.width  = OV_W;
  ovCanvas.height = OV_H;
  const ovCtx = ovCanvas.getContext('2d');

  const ovTex = new THREE.CanvasTexture(ovCanvas);
  ovTex.minFilter = THREE.LinearFilter;
  ovTex.magFilter = THREE.LinearFilter;
  ovTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const ovMat = new THREE.MeshBasicMaterial({
    map: ovTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  ovMat.renderOrder = 5;

  const ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(FW - 0.4, FH - 0.4), ovMat);
  ovMesh.rotation.x = -Math.PI / 2;
  ovMesh.position.set(0, Y + 0.04, 0);
  ovMesh.renderOrder = 5;
  scene.add(ovMesh);

  // ── ESTADO DEL CHEVRON ───────────────────────────────────────────
  let ovActive          = false; 
  let ovOpacity         = 0;     
  let ovCurrentTipNorm  = 0.5;
  let ovTargetTipNorm   = 0.5;
  let ovAttackDir       = 1;
  let ovRenderAttackDir = 1;     
  let ovDirAlpha        = 1.0;   
  let ovPulseTimer      = 0;
  let ovTeamName        = '';
  let ovActionText      = '';
  let ovActionData      = null; // Guarda fotos y escudos
  let ovHideTimer = 0; // ✨ NUEVO: Cronómetro de ocultamiento

  // Cache de imágenes para evitar parpadeos
  const imgCache = {
    player: { url: null, element: null },
    team:   { url: null, element: null }
  };

// ── DRAW CHEVRON ─────────────────────────────────────────────────
  function drawChevron(t, exactBallNormX) { // ✨ FIX: Agregamos el parámetro aquí
    const toRight = (ovRenderAttackDir === 1);
    const cy = OV_H * 0.5;

    let effectiveNorm = ovCurrentTipNorm;
    if (toRight) effectiveNorm = Math.max(0.5, effectiveNorm);
    else         effectiveNorm = Math.min(0.5, effectiveNorm);
    
    let tipX = effectiveNorm * OV_W;
    const GAP    = OV_W * 0.08;
    const ARM    = OV_W * 0.05;
    const RADIUS = 125;

    if (toRight) tipX -= GAP; else tipX += GAP;

    // ── Opacidad global de la transición de lado ─────────────────
    ovCtx.globalAlpha = ovDirAlpha;

    // ── Fondo degradado del chevron ──────────────────────────────
    ovCtx.save();
    ovCtx.beginPath();
    let baseX;

    if (toRight) {
      baseX = Math.max(tipX - ARM, 0);
      ovCtx.moveTo(0, 0);
      ovCtx.lineTo(baseX, 0);
      ovCtx.arcTo(tipX, cy, baseX, OV_H, RADIUS);
      ovCtx.lineTo(baseX, OV_H);
      ovCtx.lineTo(0, OV_H);
    } else {
      baseX = Math.min(tipX + ARM, OV_W);
      ovCtx.moveTo(OV_W, 0);
      ovCtx.lineTo(baseX, 0);
      ovCtx.arcTo(tipX, cy, baseX, OV_H, RADIUS);
      ovCtx.lineTo(baseX, OV_H);
      ovCtx.lineTo(OV_W, OV_H);
    }
    ovCtx.closePath();
    ovCtx.clip();

    const grad = toRight
      ? ovCtx.createLinearGradient(0, 0, tipX, 0)
      : ovCtx.createLinearGradient(OV_W, 0, tipX, 0);
    grad.addColorStop(0,    'rgba(0, 4, 18, 0)');
    grad.addColorStop(0.40, 'rgba(0, 4, 18, 0.1)');
    grad.addColorStop(1,    'rgba(0, 4, 18, 0.25)'); 
    ovCtx.fillStyle = grad;
    ovCtx.fillRect(0, 0, OV_W, OV_H);
    ovCtx.restore();

    // ── Pulso animado (línea que corre hacia la punta) ───────────
    const PULSE_DURATION = 1.3;
    const MAX_OFFSET     = 120;
    const progress       = (t % PULSE_DURATION) / PULSE_DURATION;
    const smoothProgress = 1 - Math.pow(1 - progress, 3);
    const offset         = smoothProgress * MAX_OFFSET;
    const pulseOpacity   = Math.sin(progress * Math.PI) * 0.315;

    ovCtx.save();
    ovCtx.beginPath();
    if (toRight) {
      ovCtx.moveTo(baseX + offset, 0);
      ovCtx.arcTo(tipX + offset, cy, baseX + offset, OV_H, RADIUS);
      ovCtx.lineTo(baseX + offset, OV_H);
    } else {
      ovCtx.moveTo(baseX - offset, 0);
      ovCtx.arcTo(tipX - offset, cy, baseX - offset, OV_H, RADIUS);
      ovCtx.lineTo(baseX - offset, OV_H);
    }
    ovCtx.lineWidth   = 60;
    ovCtx.lineJoin    = 'round';
    ovCtx.strokeStyle = `rgba(0, 0, 0, ${Math.max(0, pulseOpacity)})`;
    ovCtx.stroke();
    ovCtx.restore();

// ── Textos sobre el chevron ───────────────────────────────────
    if (ovTeamName) {
      ovCtx.save();
      
      const startX = toRight ? tipX - GAP*1.2 : tipX + GAP*1.2;

      // 👇 ✨ MAGIA: Opacidad inteligente SOLO para los textos 👇
      let textOpacity = 1.0;
      if (exactBallNormX !== undefined) {
        const realBallCanvasX = exactBallNormX * OV_W;
        
        // Calculamos la distancia exacta del balón a la "caja de texto" (aprox 600px de ancho)
        let distAlTexto = 0;
        if (toRight) {
            if (realBallCanvasX > startX) distAlTexto = realBallCanvasX - startX;
            else if (realBallCanvasX < startX - 600) distAlTexto = (startX - 600) - realBallCanvasX;
            else distAlTexto = 0; // El balón está pisando el texto
        } else {
            if (realBallCanvasX < startX) distAlTexto = startX - realBallCanvasX;
            else if (realBallCanvasX > startX + 600) distAlTexto = realBallCanvasX - (startX + 600);
            else distAlTexto = 0; // El balón está pisando el texto
        }

if (distAlTexto < 300) {
          // Baja hasta 0.20 (20%) cuando el balón la pisa. 
          // Sube progresivamente el 0.80 restante hasta llegar al 100% al alejarse.
          textOpacity = 0.75 + 0.25 * (distAlTexto / 300);
        }
      }
      
      // Aplicamos la opacidad antes de empezar a dibujar las letras
      ovCtx.globalAlpha = ovDirAlpha * textOpacity;
      // 👆 ==================================================== 👆

      ovCtx.shadowColor   = 'rgba(0, 0, 0, 0.95)';
      ovCtx.shadowBlur    = 12;
      ovCtx.shadowOffsetX = 2;
      ovCtx.shadowOffsetY = 4;
      
      ovCtx.textBaseline  = 'middle';
      ovCtx.textAlign     = toRight ? 'right' : 'left';
      const photoSize  = 140;
      const shieldSize = 120;

// ── 1. Lógica Inteligente de Zona / Acción ──
      let avance = (ovRenderAttackDir === 1) ? ovCurrentTipNorm : (1 - ovCurrentTipNorm);
      let targetZoneText = '';
      let colorAccion    = '#ffffff';
      const accionActiva = (ovActionText || '').toUpperCase();
      let playerNameText = '';

      // ── Separamos la acción del nombre del jugador ──
      if (accionActiva !== '') {
        targetZoneText = accionActiva; 

        // Guardamos el nombre aparte en lugar de pegarlo a la acción
        if (ovActionData && ovActionData.pFullNombre) {
          playerNameText = ovActionData.pFullNombre.toUpperCase();
        }

        if      (accionActiva.includes('PENAL'))      colorAccion = '#ea5a0cb9'; 
        else if (accionActiva.includes('TIRO LIBRE')) colorAccion = '#2dd4bf'; 
        else if (accionActiva.includes('CÓRNER') || accionActiva.includes('ESQUINA')) colorAccion = '#38bdf8'; 
        else if (accionActiva.includes('LATERAL'))    colorAccion = '#f7f455'; 
        else if (accionActiva.includes('META'))       colorAccion = '#cbd5e1'; 
      } 
      else {
        if      (avance >= 0.75) { targetZoneText = 'ATAQUE PELIGROSO'; colorAccion = '#ef4444ea'; } 
        else if (avance >= 0.55) { targetZoneText = 'ATAQUE';           colorAccion = '#f97316'; } 
        else if (avance >= 0.35) { targetZoneText = 'MEDIO CAMPO';      colorAccion = '#facc15'; } 
        else                     { targetZoneText = 'EN CAMPO PROPIO';  colorAccion = '#fbff00'; } 
      }

      // ── Ajuste dinámico de posiciones Y (Diseño de 3 Filas) ──
      const hasPlayer = ovActionData && (ovActionData.pPhotoUrl || playerNameText !== '');
      let yTeam, yAction, yPlayer;

      if (hasPlayer) {
          yTeam   = cy - 115; // Fila 1: Nombre del Equipo (Arriba)
          yAction = cy + 20;  // Fila 2: Tipo de Acción y Minuto (Medio)
          yPlayer = cy + 180; // Fila 3: Jugador y Foto (Abajo)
      } else {
          yTeam   = cy - 70;
          yAction = cy + 70;
      }

      // ── 2. DIBUJAR Nombre de Equipo (FILA 1) ──
      ovCtx.font      = "900 120px 'Barlow Condensed', sans-serif";
      ovCtx.fillStyle = '#ffffff';
      ovCtx.fillText(ovTeamName.toUpperCase(), startX, yTeam);

      // ── 3. DIBUJAR Acción y Minuto (FILA 2) ──
      ovCtx.font      = "900 95px 'Barlow Condensed', sans-serif";
      ovCtx.fillStyle = colorAccion;
      ovCtx.fillText(targetZoneText, startX, yAction);

      // ── 4. DIBUJAR Jugador y Foto (FILA 3) ──
      if (hasPlayer) {
        let currentX = startX;
        const gapEntreElementos = 30; // Separación entre foto y texto

        // Dibujar Foto alineada a la orilla
        if (ovActionData.pPhotoUrl) {
          const drawX = toRight ? currentX - photoSize : currentX;
          // Centramos la foto verticalmente usando yPlayer
          drawRoundedImage(ovActionData.pPhotoUrl, 'player', imgCache.player, drawX, yPlayer - (photoSize / 2), photoSize, photoSize, true);
          // Desplazamos la coordenada X para escribir el nombre a un lado
          currentX = toRight ? currentX - photoSize - gapEntreElementos : currentX + photoSize + gapEntreElementos;
        }

        // Si hubiera escudo del equipo, se dibuja aquí
        if (ovActionData.tShieldUrl) {
          const drawX = toRight ? currentX - shieldSize : currentX;
          drawRoundedImage(ovActionData.tShieldUrl, 'team', imgCache.team, drawX, yPlayer - (shieldSize / 2), shieldSize, shieldSize, false);
          currentX = toRight ? currentX - shieldSize - gapEntreElementos : currentX + shieldSize + gapEntreElementos;
        }

        // Dibujar Nombre del Jugador justo al lado de su foto
        if (playerNameText !== '') {
          ovCtx.font      = "800 85px 'Barlow Condensed', sans-serif";
          ovCtx.fillStyle = '#e2e8f0'; // Tono gris claro/plata para diferenciarlo elegantemente
          ovCtx.fillText(playerNameText, currentX, yPlayer);
        }
      }
    }

    ovTex.needsUpdate = true;
  }

  // ── FUNCIÓN AUXILIAR: Dibujar Imagen Redondeada ───────
// ── FUNCIÓN AUXILIAR: Dibujar Imagen Redondeada ───────
  function drawRoundedImage(url, cacheKey, cacheObj, x, y, w, h, applyPadding) {
    if (cacheObj.url !== url) {
      cacheObj.url = url;
      cacheObj.element = new Image();
      cacheObj.element.crossOrigin = 'anonymous';
      cacheObj.element.onload = () => { ovTex.needsUpdate = true; };
      cacheObj.element.src = url;
    }

    if (cacheObj.element && cacheObj.element.complete) {
      // ✨ FIX: Verificamos las dimensiones directamente desde cacheObj 
      // sin declarar una nueva variable 'img' para evitar el choque.
      if (cacheObj.element.naturalWidth === 0 || cacheObj.element.naturalHeight === 0) return;

      ovCtx.save();
      const r = w / 2;
      const centerX = x + r;
      const centerY = y + r;

      ovCtx.beginPath();
      ovCtx.arc(centerX, centerY, r, 0, Math.PI * 2, true);
      ovCtx.closePath();
      ovCtx.clip();

      const img = cacheObj.element; // La declaración segura se mantiene aquí
      let drawW, drawH, drawX, drawY;
      
      if (img.width > img.height) {
        drawH = h;
        drawW = img.width * (h / img.height);
        drawX = centerX - drawW / 2;
        drawY = y;
      } else {
        drawW = w;
        drawH = img.height * (w / img.width);
        drawX = x;
        drawY = centerY - drawH / 2;
      }
      
      ovCtx.drawImage(img, drawX, drawY, drawW, drawH);
      ovCtx.restore();

      // Borde redondeado opcional (para la foto del jugador)
      if (applyPadding) {
        ovCtx.save();
        ovCtx.beginPath();
        ovCtx.arc(centerX, centerY, r + 2, 0, Math.PI * 2, true);
        ovCtx.closePath();
        ovCtx.lineWidth = 4;
        ovCtx.strokeStyle = 'rgba(45, 212, 191, 0.4)'; 
        ovCtx.stroke();
        ovCtx.restore();
      }
    }
  }

  // ── UPDATE ───────────────────────────────────────────────────────
function update(dt, t) {
    // ✨ NUEVO: Lógica de ocultamiento temporal (30 segundos)
    if (ovHideTimer > 0) {
        ovHideTimer -= dt;
        ovOpacity = Math.max(0.0, ovOpacity - dt * 3.0);
    } else {
        if (ovActive) ovOpacity = Math.min(1.0, ovOpacity + dt * 4.0);
        else          ovOpacity = Math.max(0.0, ovOpacity - dt * 3.0);
    }
    ovMat.opacity = ovOpacity * 0.96;

    if (ovOpacity <= 0) {
      ovCtx.clearRect(0, 0, OV_W, OV_H);
      ovTex.needsUpdate = true;
      return; 
    }

    if (ovRenderAttackDir !== ovAttackDir) {
      ovDirAlpha -= dt * 6.0;
      if (ovDirAlpha <= 0) {
        ovDirAlpha        = 0;
        ovRenderAttackDir = ovAttackDir;
      }
    } else {
      ovDirAlpha = Math.min(1.0, ovDirAlpha + dt * 6.0);
    }

    // 2. Seguimiento suave de la punta al balón (con retroceso)
    const actualBallX = Objects.ballGroup.position.x;
    
    // Distancia que retrocede el radar
    const retroceso = 5.0; 
    
    // Si ataca a la derecha (1), restamos X. Si ataca a la izquierda (-1), sumamos X.
    const offsetX = (ovAttackDir === 1) ? -retroceso : retroceso;

    // Calculamos el objetivo sumándole el offset
    ovTargetTipNorm   = ((actualBallX + offsetX) + FW / 2) / FW;
    ovCurrentTipNorm += (ovTargetTipNorm - ovCurrentTipNorm) * (1 - Math.pow(0.0001, dt));

ovCtx.clearRect(0, 0, OV_W, OV_H);
    ovPulseTimer += dt;
    ovCtx.save();
    
    // ✨ FIX: Calculamos la posición exacta y se la enviamos al dibujante
    const exactBallNormX = (actualBallX + FW / 2) / FW;
    drawChevron(ovPulseTimer, exactBallNormX);
    
    ovCtx.restore();

    ovTex.needsUpdate = true;
  }
  // ── API PÚBLICA ──────────────────────────────────────────────────
  function updateBallPos(normX) {
    // Si el balón se mueve (detecta tu clic en el panel)
    // Borramos el estado fijo y devolvemos las zonas automáticas
    if (Math.abs(normX - ovTargetTipNorm) > 0.03) {
      ovActionText = '';
      ovActionData = null;
    }
    ovTargetTipNorm = normX;
  }

  function showGroundLabel(text, sub, _color, actionData = null) {
    ovTeamName   = text;
    ovActionText = sub;
    ovActionData = actionData;
  }

  function setPossession(active, team, direction) {
    ovActive = active;
    if (team !== undefined) ovTeamName = team;
    if (direction !== undefined) ovAttackDir = direction;
  }

  function setBallTarget(nx, ny) {
    if (!isFinite(nx) || !isFinite(ny)) return;
    const worldX = (nx - 0.5) * FW;
    const worldZ = (ny - 0.5) * FH;
    if (isFinite(worldX) && isFinite(worldZ)) {
      Objects.moveBall(worldX, worldZ);
    }
  }

function hideFor(ms) {
    ovHideTimer = ms / 1000; // Convertimos milisegundos a segundos
  }

  // ✨ FIX: Exporta hideFor en el return final
  return { updateBallPos, showGroundLabel, setPossession, setBallTarget, hideFor, update };

})();