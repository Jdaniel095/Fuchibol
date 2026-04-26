// ══════════════════════════════════════════════════════════════════
// pitch-cards.js — Tarjetas pintadas sobre el césped (Estilo Marcador)
// ══════════════════════════════════════════════════════════════════

const PitchCards = (() => {
  if (typeof Scene === 'undefined') return null;
  const { scene, renderer } = Scene;
  const { Y, FW, FH }       = Field;

  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter  = THREE.LinearMipmapLinearFilter;
  tex.magFilter  = THREE.LinearFilter;

  // Material pegado al suelo, justo encima del chevron
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = Y + 0.055; 
  mesh.renderOrder = 4;
  scene.add(mesh);

  let currentOpacity = 0;
  let targetOpacity = 0;
  let autoHideTimer = null;

  function drawRoundedImage(url, cx, cy, r, borderColor, callback) {
    if (!url) { callback(); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const scale = Math.max((r*2)/img.width, (r*2)/img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, cx - dw/2, cy - dh/2, dw, dh);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r+2, 0, Math.PI*2);
      ctx.lineWidth = 6; ctx.strokeStyle = borderColor; ctx.stroke();
      callback();
    };
    img.onerror = () => callback();
  }

  function show(typeid, playerObj, teamName, durationMs = 30000) {
    clearTimeout(autoHideTimer);
    ctx.clearRect(0, 0, W, H);

    let mainText = '';
    let subText = 'TARJETA'; 
    let color = '#ffffff';

    // Paleta de Colores "eSports"
    if (typeid === 302) { 
        mainText = 'AMARILLA'; 
        color = '#fbf724'; // Amarillo Oro (Vivid)
    }
    else if (typeid === 303) { 
        mainText = 'ROJA'; 
        color = '#DC2626'; // Rojo Intenso (Sports)
    }
    else if (typeid === 304) { 
        mainText = 'DOBLE AMARILLA'; // Texto central específico
        color = '#eaf916'; // Ámbar/Naranja (Alerta)
    }

    const playerName = (playerObj && playerObj.name_short) ? playerObj.name_short : (typeof playerObj === 'string' ? playerObj : '');
    const photoUrl = (playerObj && playerObj.photo) ? playerObj.photo : null;

    // Efecto sombra realista sobre el césped (Flotando)
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 10;

    // 1. Texto Superior (Subtítulo - Pequeño)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 60px "Segoe UI", sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(subText.toUpperCase(), W/2, 280);

    // 2. Texto Gigante Central (AMARILLA / ROJA)
    const fontSize = mainText === 'DOBLE AMARILLA' ? '220px' : '280px';
    ctx.font = `900 ${fontSize} "Segoe UI", sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(mainText, W/2, 480);

    // --- ✨ NUEVO: Dibujar Tarjeta física al lado izquierdo de la cara ---
    if (photoUrl) {
        const infoY = 750; // Centro vertical de la info inferior
        const cxPhoto = W/2 - 120; // Centro de la foto existente
        
        // Dimensiones estándar de tarjeta
        const cardW = 90;
        const cardH = 150;
        const cardR = 15; // Radio bordes
        const gap = 30; // Espacio entre tarjeta y foto
        
        // Borde izquierdo de la foto: cxPhoto - 110 (radio) = W/2 - 230
        const photoLeftEdge = cxPhoto - 110;

        // Helper interno para dibujar rectángulos redondeados con sombra activa
        const drawSingleCard = (x, y, w, h, r, c) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
        }

        // Determinar posición según tipo (Doble Amarilla requiere 2 tarjetas)
        if (typeid === 304) {
            // Doble Amarilla (Dos tarjetas superpuestas)
            // Desplazamos la base ligeramente a la izquierda para balancear
            const baseX = photoLeftEdge - gap - cardW - 20; 
            const baseY = infoY - cardH/2;
            
            // Tarjeta 1 (Fondo, desplazada abajo-izquierda)
            drawSingleCard(baseX - 15, baseY + 15, cardW, cardH, cardR, color);
            // Tarjeta 2 (Frente, desplazada arriba-derecha)
            drawSingleCard(baseX + 15, baseY - 15, cardW, cardH, cardR, color);
        } else {
            // Tarjeta única (302 Amarilla, 303 Roja)
            const cardX = photoLeftEdge - gap - cardW;
            const cardY = infoY - cardH/2;
            drawSingleCard(cardX, cardY, cardW, cardH, cardR, color);
        }
    }

    // 3. Información del Jugador (Abajo)
    // Desactivamos sombra para el texto y la foto (la foto tiene su propio stroke)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const infoY = 750;
    if (playerName) {
        // Sombra suave específica para el texto del nombre
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.font = '800 100px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffffff';
        
        if (photoUrl) {
            ctx.textAlign = 'left';
            ctx.fillText(playerName.toUpperCase(), W/2 + 20, infoY - 15);
            ctx.font = '600 55px "Segoe UI", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(teamName.toUpperCase(), W/2 + 20, infoY + 60);

            // Quitamos sombra antes de llamar al helper de imagen circular
            ctx.shadowColor = 'transparent';
            const cxPhoto = W/2 - 120; // Re-calculamos cx para mayor claridad
            drawRoundedImage(photoUrl, cxPhoto, infoY, 110, color, () => { tex.needsUpdate = true; });
        } else {
            // Layout centrado si no hay foto
            ctx.textAlign = 'center';
            ctx.fillText(playerName.toUpperCase(), W/2, infoY);
            ctx.font = '600 55px "Segoe UI", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(teamName.toUpperCase(), W/2, infoY + 80);
            tex.needsUpdate = true;
        }
    }

    tex.needsUpdate = true;
    targetOpacity = 1.0;

    autoHideTimer = setTimeout(() => { targetOpacity = 0; }, durationMs);
  }

function update(dt) {
    if (Math.abs(currentOpacity - targetOpacity) > 0.01) {
        currentOpacity += (targetOpacity - currentOpacity) * dt * 3;
        mat.opacity = currentOpacity;
    }
    // ✨ Lógica fade capa Lesión
    if (Math.abs(matInj.opacity - injuryOpacityTarget) > 0.01) {
        matInj.opacity += (injuryOpacityTarget - matInj.opacity) * dt * 3;
    }
  }

  function hide() {
    clearTimeout(autoHideTimer);
    targetOpacity = 0;
  }

  // ── ✨ CAPA: ESTADO DE LESIÓN EN ESQUINA ─────────────────────
  const canvasInj = document.createElement('canvas');
  canvasInj.width = W; canvasInj.height = H;
  const ctxInj = canvasInj.getContext('2d');
  
  const texInj = new THREE.CanvasTexture(canvasInj);
  texInj.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texInj.minFilter  = THREE.LinearMipmapLinearFilter;
  texInj.magFilter  = THREE.LinearFilter;

  const matInj = new THREE.MeshBasicMaterial({
    map: texInj, transparent: true, opacity: 0,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6
  });
  const meshInj = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), matInj);
  meshInj.rotation.x = -Math.PI / 2;
  meshInj.position.y = Y + 0.056; 
  meshInj.renderOrder = 5;
  scene.add(meshInj);

  let injuryOpacityTarget = 0;
  
  // Memoria para recordar quién se lesionó
  let lastInjPlayer = '';
  let lastInjTeam = '';
  let lastInjIsHome = false;

  // ✨ FIX: Memorización forzada inmediata
  function setInjuryMemory(playerName, teamName, isHome) {
      lastInjPlayer = playerName;
      lastInjTeam = teamName;
      lastInjIsHome = isHome;
  }

  function rrectInj(x, y, w, h, r) {
      ctxInj.beginPath();
      ctxInj.moveTo(x+r, y);
      ctxInj.lineTo(x+w-r, y); ctxInj.quadraticCurveTo(x+w, y, x+w, y+r);
      ctxInj.lineTo(x+w, y+h-r); ctxInj.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
      ctxInj.lineTo(x+r, y+h); ctxInj.quadraticCurveTo(x, y+h, x, y+h-r);
      ctxInj.lineTo(x, y+r); ctxInj.quadraticCurveTo(x, y, x+r, y);
      ctxInj.closePath();
      ctxInj.fill();
  }

  function showInjuryCorner(playerName, teamName, isHome) {
      setInjuryMemory(playerName, teamName, isHome); // Aseguramos que guarde

      ctxInj.clearRect(0, 0, W, H);
      ctxInj.shadowColor = 'rgba(0,0,0,0.6)';
      ctxInj.shadowBlur = 15;
      ctxInj.shadowOffsetY = 8;
      
      const cardW = 650, cardH = 130;
      const x = isHome ? 120 : W - cardW - 120;
      const y = H - cardH - 120; 
      
      ctxInj.fillStyle = 'rgba(15, 23, 42, 0.95)';
      rrectInj(x, y, cardW, cardH, 20);

      ctxInj.fillStyle = '#ef4444'; 
      ctxInj.fillRect(x, y + 20, 10, cardH - 40);

      ctxInj.shadowColor = 'transparent';
      ctxInj.fillStyle = '#ffffff';
      ctxInj.font = '800 45px "Segoe UI", sans-serif';
      ctxInj.textAlign = 'left';
      
      const safeName = String(playerName || '').toUpperCase();
      ctxInj.fillText(safeName, x + 40, y + 60);
      
      ctxInj.font = '600 28px "Segoe UI", sans-serif';
      ctxInj.fillStyle = '#fca5a5';
      ctxInj.fillText("✚ RECIBIENDO ATENCIÓN MÉDICA", x + 40, y + 105);
      
      texInj.needsUpdate = true;
      injuryOpacityTarget = 1.0;
  }

  function showRecoveryCorner() {
      if (!lastInjPlayer) return; 

      ctxInj.clearRect(0, 0, W, H);
      ctxInj.shadowColor = 'rgba(0,0,0,0.6)';
      ctxInj.shadowBlur = 15;
      ctxInj.shadowOffsetY = 8;
      
      const cardW = 650, cardH = 130;
      const x = lastInjIsHome ? 120 : W - cardW - 120;
      const y = H - cardH - 120; 
      
      ctxInj.fillStyle = 'rgba(15, 23, 42, 0.95)';
      rrectInj(x, y, cardW, cardH, 20);

      ctxInj.fillStyle = '#10b981'; // Verde Esmeralda
      ctxInj.fillRect(x, y + 20, 10, cardH - 40);

      ctxInj.shadowColor = 'transparent';
      ctxInj.fillStyle = '#ffffff';
      ctxInj.font = '800 45px "Segoe UI", sans-serif';
      ctxInj.textAlign = 'left';
      
      const safeName = String(lastInjPlayer || '').toUpperCase();
      ctxInj.fillText(safeName, x + 40, y + 60);
      
      ctxInj.font = '600 28px "Segoe UI", sans-serif';
      ctxInj.fillStyle = '#34d399'; // Verde Claro
      ctxInj.fillText("✔ JUGADOR RECUPERADO", x + 40, y + 105);
      
      texInj.needsUpdate = true;
      injuryOpacityTarget = 1.0;

      setTimeout(() => { hideInjuryCorner(); }, 8000);
  }

  function hideInjuryCorner() {
      injuryOpacityTarget = 0;
  }

  // ✨ FIX: Exportamos setInjuryMemory
  return { show, update, hide, showInjuryCorner, hideInjuryCorner, showRecoveryCorner, setInjuryMemory };
})();