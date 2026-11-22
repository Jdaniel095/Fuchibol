// ══════════════════════════════════════════════════════════════════
// overlay-manager.js — PITCH PAINTED V2 (MINIMALIST REDESIGN)
// Canvas 4096×2048 proyectado plano sobre el suelo
// TypeIDs 201, 202, 203 (Goles)
// ══════════════════════════════════════════════════════════════════

const OverlayManager = (() => {
  const { scene, renderer } = Scene;
  const { Y, FW, FH } = Field;

  // ── RESOLUCIÓN 4K ────────────────────────────────────────────────
  const W = 4096, H = 2048;

  // ── PALETA MINIMALISTA V2 ────────────────────────────────────────
  const C = {
    green:       '#3fb950',
    greenGlow:   'rgba(63,185,80,0.55)',
    orange:      '#f0883e',
    orangeGlow:  'rgba(240,136,62,0.55)',
    yellow:      '#d29922',
    yellowGlow:  'rgba(210,153,34,0.55)',
    white:       '#ffffff',
    textMid:     'rgba(255,255,255,0.55)',
    textLow:     'rgba(255,255,255,0.35)',
    borderDim:   'rgba(255,255,255,0.12)'
  };

  const FONT_BC = "'Barlow Condensed', sans-serif";
  const FONT_B  = "'Barlow', sans-serif";
  const FONT_JM = "'JetBrains Mono', monospace";

  let fontsReady = false;
  let pendingFn  = null;

  (async function preloadFonts() {
    try {
      await Promise.all([
        document.fonts.load("900 1px 'Barlow Condensed'"),
        document.fonts.load("800 1px 'Barlow Condensed'"),
        document.fonts.load("700 1px 'Barlow Condensed'"),
        document.fonts.load("500 1px 'Barlow'"),
        document.fonts.load("700 1px 'JetBrains Mono'")
      ]);
    } catch(e) {}
    fontsReady = true;
    if (pendingFn) { pendingFn(); pendingFn = null; }
  })();

  // ── CANVAS Y TEXTURA ─────────────────────────────────────────────
  const ovCanvas = document.createElement('canvas');
  ovCanvas.width  = W;
  ovCanvas.height = H;
  const ctx = ovCanvas.getContext('2d', { alpha: true });

  const texture = new THREE.CanvasTexture(ovCanvas);
  texture.anisotropy      = renderer.capabilities.getMaxAnisotropy();
  texture.minFilter       = THREE.LinearMipmapLinearFilter;
  texture.magFilter       = THREE.LinearFilter;
  texture.generateMipmaps = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture, 
    transparent: true, 
    opacity: 0,
    depthWrite: false, 
    side: THREE.DoubleSide
  });

  const planeWidth  = FW * 1.05; 
  const planeHeight = planeWidth * (H / W); 

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    material
  );
  
  // ── INCLINACIÓN ESTILO REALIDAD AUMENTADA ──
  mesh.rotation.x = (-Math.PI / 2) + 0.80; 
  mesh.position.set(0, Y + 10.0, 0);
  mesh.renderOrder = 30; 
  mesh.visible = false;
  scene.add(mesh);

  let targetOpacity = 0;

  // ── HELPERS DE DIBUJO ────────────────────────────────────────────
  function clear() { ctx.clearRect(0, 0, W, H); }

  function rrect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

function drawPlayerCircle(url, cx, cy, r, borderColor, cardScale = 1.0) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      ctx.save();
      
      // ✨ FIX: Volvemos a aplicar el "zoom" del cartel antes de pegar la foto
      const centerX = W / 2;
      const centerY = H / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(cardScale, cardScale);
      ctx.translate(-centerX, -centerY);

      // Recortamos el círculo y pegamos la foto
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
      const scale = Math.max((r*2) / img.width, (r*2) / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, cx - dw/2, cy - dh/2, dw, dh);
      ctx.restore();

      // Dibujamos el anillo del borde
      ctx.beginPath(); ctx.arc(cx, cy, r+4, 0, Math.PI*2);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 6;
      ctx.stroke();
      
      ctx.restore();
      texture.needsUpdate = true;
    };
  }

  function commit() {
    texture.needsUpdate = true;
    mesh.visible = true;
    targetOpacity = 1.0;
  }

  function draw(fn) {
    if (fontsReady) { fn(); commit(); }
    else { pendingFn = () => { fn(); commit(); }; }
  }

// ══════════════════════════════════════════════════════════════════
  // CORE: DIBUJAR EL DISEÑO V2 (Estilo Verde Translúcido)
  // ══════════════════════════════════════════════════════════════════
function _drawV2GoalCard(labelIcon, labelText, mainText, player, playerSub, score, photoUrl, min, colors, teamHome, teamAway, teamAccion, scale = 1.0) {
      draw(() => {
      clear();

// ✨ MAGIA: Guardamos el estado y aplicamos la escala desde el centro
      ctx.save();
      const cx = W / 2, cy = H / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

      // ✨ FIX: Ancho dinámico del cartel. Si el texto inferior es larguísimo, lo estiramos con elegancia.
      const bottomText = String(teamAccion || teamHome || '¡ACCIÓN!').toUpperCase();
      let fw = 2400; 
      if (!player && bottomText.length > 14) fw = 2800; // Estirón mágico para "TIEMPO DE HIDRATACIÓN" u otros largos

      const fh = 1350; 
      const x = cx - fw / 2, y = cy - fh / 2;
// 1. Contenedor base (DEGRADADO VERDE TRANSLÚCIDO TIPO REFERENCIA + TEXTURA)
      const bgG = ctx.createLinearGradient(x, y, x, y + fh);
      bgG.addColorStop(0, colors.bgTop); 
      bgG.addColorStop(1, colors.bgBot);
      
      ctx.fillStyle = bgG;
      rrect(x, y, fw, fh, 45, true, false);

      // ─── TEXTURA MALLA / ROMBOS (Estilo Panel LED) ───
      ctx.save();
      // Recortamos para que no se salga de los bordes redondeados
      rrect(x, y, fw, fh, 45, false, false);
      ctx.clip();
      
      // Líneas diagonales (hacia la derecha) - Más visibles
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'; // Subimos la opacidad
      ctx.lineWidth = 3;
      for (let i = -fh; i < fw + fh; i += 30) { 
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i - fh, y + fh);
        ctx.stroke();
      }

      // Líneas diagonales (hacia la izquierda) para cruzar y formar rombos
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; // Líneas oscuras para dar contraste
      for (let i = -fh; i < fw + fh; i += 30) { 
        ctx.beginPath();
        ctx.moveTo(x + i, y + fh);
        ctx.lineTo(x + i - fh, y);
        ctx.stroke();
      }

      // Capa de viñeta oscura interior para dar volumen 3D y apagar un poco los bordes
      const shadowG = ctx.createRadialGradient(cx, cy, fw * 0.1, cx, cy, fw * 0.7);
      shadowG.addColorStop(0, 'rgba(0,0,0,0)');
      shadowG.addColorStop(1, 'rgba(0,0,0,0.5)'); // Viñeta más marcada
      ctx.fillStyle = shadowG;
      ctx.fillRect(x, y, fw, fh);
      
      ctx.restore();
      // ─── FIN TEXTURA ───

      // Borde del contenedor (muy sutil)
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 4;
      rrect(x, y, fw, fh, 45, false, true);
  // 2. Fila Superior (Top Row)
      const topY = y + 140;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 65px ${FONT_BC}`;
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 0.9; 
      ctx.letterSpacing = '16px';
      ctx.fillText(`${labelIcon} ${labelText}`.toUpperCase(), x + 120, topY);
      ctx.globalAlpha = 1.0;
      ctx.letterSpacing = '0px';

// ─── 🔴 CHIP DE MINUTO (Esquina Superior Derecha) ───
      if (min && String(min).trim() !== '') {
          // Si no trae el apóstrofe de minuto ('), se lo agregamos
          const timeText = String(min).includes("'") ? String(min) : `${min}'`; 
          ctx.font = `700 65px ${FONT_JM}`;
          
          // Medimos el texto para hacer la caja del tamaño perfecto
          const textWidth = ctx.measureText(timeText).width;
          const chipW = textWidth + 80; // Padding
          const chipH = 90;
          const chipX = x + fw - 120 - chipW; 
          const chipY = topY - chipH / 2;     
          
          // Fondo semitransparente redondeado
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          rrect(chipX, chipY, chipW, chipH, 45, true, false); 
          
          // Borde
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 3;
          rrect(chipX, chipY, chipW, chipH, 45, false, true);

          // Texto adentro
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillText(timeText, chipX + chipW / 2, topY);
      }

      // 3. TEXTO GIGANTE "GOL"
// 3. TEXTO GIGANTE "GOL"
      const heroY = y + 580;
      ctx.textAlign = 'center';
      
      // ✨ FIX: Ajuste dinámico de tamaño para textos largos como "JUEGO DETENIDO"
      let mainFontSize = 520;
      if (mainText.length > 10) mainFontSize = 280;      // Para "JUEGO DETENIDO"
      else if (mainText.length > 6) mainFontSize = 380;  // Para palabras medianas
      
      ctx.font = `900 ${mainFontSize}px ${FONT_BC}`;
      ctx.fillStyle = '#ffffff';
      ctx.letterSpacing = '-12px';
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 80;
      ctx.fillText(mainText, cx, heroY);
      
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; 
      ctx.shadowBlur = 20; 
      ctx.shadowOffsetY = 10;
      ctx.fillText(mainText, cx, heroY);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.letterSpacing = '0px';

      // 4. LÍNEA DIVISORIA
      const divY = y + 940;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; 
      ctx.fillRect(x + 120, divY, fw - 240, 4);

// 5. FILA INFERIOR (Fase 1 y Fase 2)
      const bottomY = y + 1140;
      
      // 🟢 FASE 2: Si hay jugador asignado, dibujamos su foto y sus datos
      if (player && String(player).trim() !== '' && String(player).toUpperCase() !== 'JUGADOR') {
          const avatarR = 85;
          const avatarX = x + 120 + avatarR;
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.beginPath(); ctx.arc(avatarX, bottomY, avatarR, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = colors.avatarBorder;
          ctx.lineWidth = 6;
          ctx.stroke();
          
          if (photoUrl && String(photoUrl).trim() !== '') {
drawPlayerCircle(photoUrl, avatarX, bottomY, avatarR, colors.avatarBorder, scale);          }
          
          ctx.textAlign = 'left';
          ctx.font = `800 110px ${FONT_BC}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(player).toUpperCase(), avatarX + avatarR + 50, bottomY - 15);
          
          ctx.font = `500 70px ${FONT_B}`;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(playerSub || 'Goleador', avatarX + avatarR + 50, bottomY + 65);
      } 
// 🔴 FASE 1: Si aún no hay jugador, SOLO escribimos el nombre del equipo en grande
      else {
          ctx.textAlign = 'left';
          const bottomText = String(teamAccion || teamHome || '¡ACCIÓN!').toUpperCase();
          
          // ✨ FIX: Ajuste dinámico de texto para que frases largas no se desborden
          let fontSize = 150;
          if (bottomText.length > 16) fontSize = 95;
          else if (bottomText.length > 10) fontSize = 120;
          
          ctx.font = `900 ${fontSize}px ${FONT_BC}`;
          ctx.fillStyle = '#ffffff';
          
          const offset = fontSize < 110 ? 15 : 30;
          ctx.fillText(bottomText, x + 120, bottomY + offset);
      }
      // ─── 🔴 SCOREBOARD Y NOMBRES DE EQUIPO ───
      // Filtro estricto: Extrae SOLO los dos primeros números, ignorando letras o basura
      let numHome = '0', numAway = '0';
      const safeScore = String(score || '0-0').replace(/—|–/g, '-'); 
      const scoreMatch = safeScore.match(/(\d+)\s*\D+\s*(\d+)/);
      if (scoreMatch) {
          numHome = scoreMatch[1];
          numAway = scoreMatch[2];
      }
      
      ctx.textAlign = 'center';
      
      // Ejes X separados a la izquierda para que no choquen con el borde derecho
      const dashX = x + fw - 360; 
      const homeX = dashX - 160;  
      const awayX = dashX + 160;
      
      const scoreY = bottomY - 10; 
      const teamY = bottomY + 75;  

      // Guión central
      ctx.font = `500 120px ${FONT_BC}`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('—', dashX, scoreY - 10);

// Números
      ctx.font = `700 160px ${FONT_JM}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(numHome, homeX, scoreY);
      ctx.fillText(numAway, awayX, scoreY);

// Nombres de los Equipos
      ctx.font = `600 48px ${FONT_BC}`;
      ctx.fillStyle = colors.accent; 
      ctx.letterSpacing = '2px';
      
      // ✨ FIX DEFINITIVO: Centrados bajo sus números con límite estricto de ancho (maxWidth 280).
      // Matemáticamente imposible que choquen o se salgan del cuadro.
      ctx.textAlign = 'center';
      ctx.fillText(String(teamHome || 'LOCAL').toUpperCase(), homeX, teamY, 280);
      ctx.fillText(String(teamAway || 'VISITA').toUpperCase(), awayX, teamY, 280);
      
      ctx.letterSpacing = '0px';
      // 6. BARRA DE ACENTO INFERIOR (Píldora Redondeada)
      const barHeight = 24; 
      const barMargin = 120; 
      const barWidth = fw - (barMargin * 2);
      const barX = x + barMargin;
      const barY = y + fh - barHeight - 40; 

      ctx.beginPath();
      const radius = barHeight / 2;
      ctx.moveTo(barX + radius, barY);
      ctx.lineTo(barX + barWidth - radius, barY);
      ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
      ctx.lineTo(barX + barWidth, barY + barHeight - radius);
      ctx.quadraticCurveTo(barX + barWidth, barY + barHeight, barX + barWidth - radius, barY + barHeight);
      ctx.lineTo(barX + radius, barY + barHeight);
      ctx.quadraticCurveTo(barX, barY + barHeight, barX, barY + barHeight - radius);
      ctx.lineTo(barX, barY + radius);
      ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
      ctx.closePath();

      ctx.fillStyle = colors.accent;
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;

ctx.fillStyle = colors.accent;
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // ✨ MAGIA: Restauramos el canvas a su estado normal para no afectar al próximo frame
      ctx.restore();

    });
  }

function _drawSubstitutionCard(playerIn, playerOut, photoUrl, min, colors, teamAccion, scale = 1.0) {
      draw(() => {
      clear();

      ctx.save();
      const cx = W / 2, cy = H / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

      const fw = 2400, fh = 1350; 
      const x = cx - fw / 2, y = cy - fh / 2;

      // 1. Contenedor base
      const bgG = ctx.createLinearGradient(x, y, x, y + fh);
      bgG.addColorStop(0, colors.bgTop); 
      bgG.addColorStop(1, colors.bgBot);
      ctx.fillStyle = bgG;
      rrect(x, y, fw, fh, 45, true, false);

      ctx.save();
      rrect(x, y, fw, fh, 45, false, false);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'; ctx.lineWidth = 3;
      for (let i = -fh; i < fw + fh; i += 30) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i - fh, y + fh); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      for (let i = -fh; i < fw + fh; i += 30) { ctx.beginPath(); ctx.moveTo(x + i, y + fh); ctx.lineTo(x + i - fh, y); ctx.stroke(); }
      const shadowG = ctx.createRadialGradient(cx, cy, fw * 0.1, cx, cy, fw * 0.7);
      shadowG.addColorStop(0, 'rgba(0,0,0,0)'); shadowG.addColorStop(1, 'rgba(0,0,0,0.5)'); 
      ctx.fillStyle = shadowG; ctx.fillRect(x, y, fw, fh);
      ctx.restore();

      ctx.strokeStyle = colors.border; ctx.lineWidth = 4;
      rrect(x, y, fw, fh, 45, false, true);

      // 2. Fila Superior (CAMBIO A LA IZQUIERDA)
      const topY = y + 140;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 65px ${FONT_BC}`;
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 0.9; ctx.letterSpacing = '16px';
      ctx.fillText('🔄 CAMBIO', x + 120, topY);
      ctx.globalAlpha = 1.0; ctx.letterSpacing = '0px';

      // CHIP DE MINUTO
      if (min && String(min).trim() !== '') {
          const timeText = String(min).includes("'") ? String(min) : `${min}'`; 
          ctx.font = `700 65px ${FONT_JM}`;
          const textWidth = ctx.measureText(timeText).width;
          const chipW = textWidth + 80; const chipH = 90;
          const chipX = x + fw - 120 - chipW; const chipY = topY - chipH / 2;     
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          rrect(chipX, chipY, chipW, chipH, 45, true, false); 
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 3;
          rrect(chipX, chipY, chipW, chipH, 45, false, true);
          ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillText(timeText, chipX + chipW / 2, topY);
      }

      // 3. NOMBRES GIGANTES EN EL CENTRO
      const midY = y + 500;
      ctx.textAlign = 'center';
      
      // ▲ ENTRA (Jugador Principal, más brillante)
      ctx.font = `700 70px ${FONT_BC}`;
      ctx.fillStyle = '#a8f06a'; // Verde claro para el que entra
      ctx.fillText('▲ ENTRA', cx, midY - 110);

      ctx.font = `900 240px ${FONT_BC}`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 50;
      ctx.fillText(String(playerIn || '').toUpperCase(), cx, midY + 40);
      ctx.shadowBlur = 0;

      // Línea separadora tenue
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; 
      ctx.fillRect(cx - 500, midY + 160, 1000, 4);

      // ▼ SALE (Jugador saliente, más pequeño y opaco)
      const outY = midY + 360;
      ctx.font = `700 65px ${FONT_BC}`;
      ctx.fillStyle = '#f85149'; // Rojo para el que sale
      ctx.fillText('▼ SALE', cx, outY - 75);

      ctx.font = `800 150px ${FONT_BC}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; // Opaco
      ctx.fillText(String(playerOut || '').toUpperCase(), cx, outY + 40);

      // 4. FILA INFERIOR (Solo Foto y Equipo, SIN MARCADOR)
      const bottomY = y + 1140;
      
      if (photoUrl && String(photoUrl).trim() !== '') {
          const avatarR = 85;
          const avatarX = x + 120 + avatarR;
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.beginPath(); ctx.arc(avatarX, bottomY, avatarR, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = colors.avatarBorder; ctx.lineWidth = 6; ctx.stroke();
          
          drawPlayerCircle(photoUrl, avatarX, bottomY, avatarR, colors.avatarBorder, scale);
          
          ctx.textAlign = 'left';
          ctx.font = `800 110px ${FONT_BC}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(teamAccion || 'EQUIPO').toUpperCase(), avatarX + avatarR + 50, bottomY + 25);
      } else {
          ctx.textAlign = 'left';
          ctx.font = `900 130px ${FONT_BC}`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(teamAccion || 'EQUIPO').toUpperCase(), x + 120, bottomY + 30);
      }

      // 5. BARRA DE ACENTO INFERIOR
      const barHeight = 24; const barMargin = 120; 
      const barWidth = fw - (barMargin * 2);
      const barX = x + barMargin; const barY = y + fh - barHeight - 40; 
      ctx.beginPath(); const radius = barHeight / 2;
      ctx.moveTo(barX + radius, barY); ctx.lineTo(barX + barWidth - radius, barY);
      ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
      ctx.lineTo(barX + barWidth, barY + barHeight - radius);
      ctx.quadraticCurveTo(barX + barWidth, barY + barHeight, barX + barWidth - radius, barY + barHeight);
      ctx.lineTo(barX + radius, barY + barHeight); ctx.quadraticCurveTo(barX, barY + barHeight, barX, barY + barHeight - radius);
      ctx.lineTo(barX, barY + radius); ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
      ctx.closePath();
      ctx.fillStyle = colors.accent; ctx.shadowColor = colors.glow; ctx.shadowBlur = 20; ctx.fill(); ctx.shadowBlur = 0;

      ctx.restore();
    });
  }


// ══════════════════════════════════════════════════════════════════
  // PUBLICAS: TYPEIDS 201, 202, 203
  // ══════════════════════════════════════════════════════════════════
function showGoal(matchInfo, player, score, photoUrl, arg5, arg6, arg7) {
    let teamHomeName = 'LOCAL';
    let teamAwayName = 'VISITA';
    let minute = '';

    // Filtro inteligente: Busca el minuto esté donde esté
    [arg5, arg6, arg7].forEach(arg => {
        if (arg && String(arg).match(/^\d+$/)) minute = arg;
        else if (arg && teamHomeName === 'LOCAL') teamHomeName = arg;
        else if (arg) teamAwayName = arg;
    });

    if (teamHomeName === 'LOCAL' && OverlayManager.mesh && OverlayManager.mesh.teamHomeStr) teamHomeName = OverlayManager.mesh.teamHomeStr;
    if (teamAwayName === 'VISITA' && OverlayManager.mesh && OverlayManager.mesh.teamAwayStr) teamAwayName = OverlayManager.mesh.teamAwayStr;
    
    const colors = {
      bgTop: 'rgba(85, 122, 38, 0.90)',  
      bgBot: 'rgba(63, 90, 28, 0.95)',   
      accent: '#a8f06a',
      glow: 'rgba(168, 240, 106, 0.5)',
      avatarBorder: 'rgba(255, 255, 255, 0.3)',
      border: 'rgba(255, 255, 255, 0.15)'
    };
    
    // ✨ FIX DEFINITIVO: Ahora sí usamos 'matchInfo', que trae el nombre del equipo que anotó
    const scoringTeam = matchInfo || teamHomeName || 'EQUIPO'; 
    const subText = player ? `${scoringTeam} · Goleador` : ''; 

    // Añadimos 'scoringTeam' al final como teamAccion para que se pinte en la Fase 1
    _drawV2GoalCard('⚽', 'Gol', 'GOL', player, subText, score, photoUrl, minute, colors, teamHomeName, teamAwayName, scoringTeam);
  }

  function showOwnGoal(scoringTeam, player, score, photoUrl, arg5, arg6, arg7) {
    let teamHomeName = 'LOCAL'; let teamAwayName = 'VISITA'; let minute = '';
    
    [arg5, arg6, arg7].forEach(arg => {
        if (arg && String(arg).match(/\d/)) minute = String(arg).replace(/\D/g, '');
        else if (arg && teamHomeName === 'LOCAL') teamHomeName = arg;
        else if (arg) teamAwayName = arg;
    });

    const colors = { 
      bgTop: 'rgba(122, 50, 38, 0.90)', 
      bgBot: 'rgba(90, 30, 28, 0.95)', 
      accent: '#f85149', 
      glow: 'rgba(248,81,73,0.5)', 
      avatarBorder: 'rgba(248,81,73,0.4)', 
      border: 'rgba(255, 255, 255, 0.15)' 
    };
    
    // ✨ FIX: Añadimos 'scoringTeam' al final como teamAccion también aquí
    _drawV2GoalCard('▲', 'Autogol', 'GOL', player, 'En propia puerta', score, photoUrl, minute, colors, teamHomeName, teamAwayName, scoringTeam);
  }

function showOwnGoal(scoringTeam, player, score, photoUrl, arg5, arg6, arg7) {
    let teamHomeName = 'LOCAL'; let teamAwayName = 'VISITA'; let minute = '';
    
    [arg5, arg6, arg7].forEach(arg => {
        if (arg && String(arg).match(/\d/)) minute = String(arg).replace(/\D/g, '');
        else if (arg && teamHomeName === 'LOCAL') teamHomeName = arg;
        else if (arg) teamAwayName = arg;
    });

    const colors = { 
      bgTop: 'rgba(122, 50, 38, 0.90)', 
      bgBot: 'rgba(90, 30, 28, 0.95)', 
      accent: '#f85149', 
      glow: 'rgba(248,81,73,0.5)', 
      avatarBorder: 'rgba(248,81,73,0.4)', 
      border: 'rgba(255, 255, 255, 0.15)' 
    };
    
    _drawV2GoalCard('▲', 'Autogol', 'GOL', player, 'En propia puerta', score, photoUrl, minute, colors, teamHomeName, teamAwayName);
  }

function showPenaltyGoal(teamAccion, player, score, photoUrl, arg5, arg6, arg7) {
      let teamHomeName = 'LOCAL';
      let teamAwayName = 'VISITA';
      let minute = '';

      // ✨ FIX: Filtro inteligente añadido igual que en el Gol normal
      [arg5, arg6, arg7].forEach(arg => {
          if (arg && String(arg).match(/^\d+$/)) minute = arg;
          else if (arg && teamHomeName === 'LOCAL') teamHomeName = arg;
          else if (arg) teamAwayName = arg;
      });

      const colors = { bgTop: 'rgba(85, 122, 38, 0.90)', bgBot: 'rgba(63, 90, 28, 0.95)', accent: C.yellow, glow: C.yellowGlow, avatarBorder: 'rgba(210,153,34,0.4)', border: 'rgba(255, 255, 255, 0.15)' };
      const subText = player ? `${teamAccion} · Penal` : '';
      
      _drawV2GoalCard('⬤', 'Penal Otorgado', 'GOL', player, subText, score, photoUrl, minute, colors, teamHomeName, teamAwayName, teamAccion);
  }

// ══════════════════════════════════════════════════════════════════
  // TARJETAS Y FALTAS (Reutilizando el diseño maestro V2)
  // ══════════════════════════════════════════════════════════════════
  






function showPenalty(teamAccion, player, score, photoUrl, teamHome, teamAway, minute, logoUrl) {
      const colors = { bgTop: 'rgba(234, 88, 12, 0.95)', bgBot: 'rgba(154, 52, 18, 0.98)', accent: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', avatarBorder: 'rgba(249, 115, 22, 0.5)', border: 'rgba(255, 255, 255, 0.08)' };
      const imageToShow = player ? photoUrl : logoUrl;
      const subText = player ? `${teamAccion} · Penal a favor` : '';
      
      // ✨ AÑADIDO: 0.70 al final para reducir tamaño
      _drawV2GoalCard('●', 'Penal Otorgado', 'PENAL', player, subText, score, imageToShow, minute, colors, teamHome, teamAway, teamAccion, 0.70);
  }

function showPenaltyMissed(teamAccion, player, score, photoUrl, teamHome, teamAway, minute, logoUrl) {
      const colors = { bgTop: 'rgba(71, 85, 105, 0.95)', bgBot: 'rgba(30, 41, 59, 0.98)', accent: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', avatarBorder: 'rgba(148, 163, 184, 0.5)', border: 'rgba(255, 255, 255, 0.08)' };
      const imageToShow = player ? photoUrl : logoUrl;
      const subText = player ? `${teamAccion} · Penal fallado` : '';
      
      // ✨ AÑADIDO: 0.70 al final para reducir tamaño
      _drawV2GoalCard('❌', 'Penal Fallado', 'FALLO', player, subText, score, imageToShow, minute, colors, teamHome, teamAway, teamAccion, 0.70);
  }

function showSubstitution(teamAccion, playerIn, playerOut, score, teamHome, teamAway, minute, photoUrl) {
      const colors = { bgTop: 'rgba(30, 41, 59, 0.95)', bgBot: 'rgba(15, 23, 42, 0.98)', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', avatarBorder: 'rgba(56, 189, 248, 0.5)', border: 'rgba(255, 255, 255, 0.08)' };
      
      // ✨ Llamamos a nuestro nuevo lienzo especializado
      _drawSubstitutionCard(playerIn, playerOut, photoUrl, minute, colors, teamAccion, 0.70);
  }
  function showInjury(teamAccion, player, score, teamHome, teamAway, minute, photoUrl) {
      const colors = { bgTop: 'rgba(127, 29, 29, 0.95)', bgBot: 'rgba(69, 10, 10, 0.98)', accent: '#fca5a5', glow: 'rgba(252, 165, 165, 0.4)', avatarBorder: 'rgba(252, 165, 165, 0.5)', border: 'rgba(255, 255, 255, 0.08)' };
      const subText = player ? `${teamAccion} · Asistencia Médica` : '';
      _drawV2GoalCard('✚', 'Lesión', 'ASISTENCIA', player, subText, score, photoUrl, minute, colors, teamHome, teamAway, teamAccion, 0.70);
  }

 // STUBS RESTANTES
  function showCorner() {}
  function showOffside(teamName, minute) {
    const colors = {
        bgTop: 'rgba(194, 65, 12, 0.95)',
        bgBot: 'rgba(124, 45, 18, 0.98)',
        accent: '#fb923c',
        glow: 'rgba(251, 146, 60, 0.4)',
        avatarBorder: 'rgba(251, 146, 60, 0.5)',
        border: 'rgba(255, 255, 255, 0.08)'
    };
    _drawV2GoalCard('🚩', 'Fuera de Juego', 'OFFSIDE', '', teamName, '', null, minute, colors, '', '', teamName, 0.70);
}
  function showShot() {}
// ══════════════════════════════════════════════════════════════════
  // CORE: DIBUJAR EL DISEÑO EXCLUSIVO DE VAR (Monitor Gigante)
  // ══════════════════════════════════════════════════════════════════
  function showVAR(typeid, reason, score, teamHome, teamAway, minute) {
      draw(() => {
          clear();
          ctx.save();
          const cx = W / 2, cy = H / 2;
          
          // ✨ Tamaño masivo exclusivo para el VAR
          const fw = 3200, fh = 1400; 
          const x = cx - fw/2, y = cy - fh/2;

          // 1. Configuración dinámica según el resultado
          let mainText = 'REVISIÓN EN CURSO';
          let colorAccent = '#ff0000'; // Cyan
          let colorBgTop = 'rgba(15, 23, 42, 0.95)';
          let colorBgBot = 'rgba(2, 6, 23, 0.98)';

          if (typeid === 502) { mainText = 'GOL ANULADO'; colorAccent = '#ef4444'; }
          else if (typeid === 503) { mainText = 'PENAL CANCELADO'; colorAccent = '#ef4444'; }
          else if (typeid === 504) { mainText = 'TARJETA ROJA'; colorAccent = '#ef4444'; }
          else if (typeid === 505) { mainText = 'PENAL OTORGADO'; colorAccent = '#f97316'; }
          else if (typeid === 506) { mainText = 'ROJA ANULADA'; colorAccent = '#22c55e'; }
          else if (typeid === 508) { mainText = 'DECISIÓN REVERTIDA'; colorAccent = '#3b82f6'; }
          else if (typeid === 509) { mainText = 'DECISIÓN CONFIRMADA'; colorAccent = '#22c55e'; }

          // 2. Fondo Base (Degradado Oscuro)
          const grad = ctx.createLinearGradient(x, y, x, y + fh);
          grad.addColorStop(0, colorBgTop);
          grad.addColorStop(1, colorBgBot);
          ctx.fillStyle = grad;
          rrect(x, y, fw, fh, 60, true, false);

          // 3. Textura Tecnológica (Cuadrícula Monitor VAR)
          ctx.save();
          rrect(x, y, fw, fh, 60, false, false);
          ctx.clip();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 4;
          const gridSize = 80;
          for(let i=x; i<x+fw; i+=gridSize) { ctx.beginPath(); ctx.moveTo(i, y); ctx.lineTo(i, y+fh); ctx.stroke(); }
          for(let i=y; i<y+fh; i+=gridSize) { ctx.beginPath(); ctx.moveTo(x, i); ctx.lineTo(x+fw, i); ctx.stroke(); }
          
          // Marca de agua gigante de fondo
          ctx.font = `900 800px ${FONT_BC}`;
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('VAR', cx, cy);
          ctx.restore();

          // 4. Borde Neón
          ctx.strokeStyle = colorAccent;
          ctx.lineWidth = 12;
          rrect(x, y, fw, fh, 60, false, true);

          // 5. Header Superior (Cabecera del Monitor)
          ctx.fillStyle = colorAccent;
          rrect(x, y, fw, 180, 60, true, false);
          ctx.fillRect(x, y + 100, fw, 80); // Quita el redondeo inferior del header
          
          ctx.font = `800 90px ${FONT_B}`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.letterSpacing = '10px';
          ctx.fillText('VAR', cx, y + 120);
          ctx.letterSpacing = '0px';

          // 6. TEXTO DE DECISIÓN PRINCIPAL GIGANTE
          ctx.font = `900 300px ${FONT_BC}`;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = colorAccent;
          ctx.shadowBlur = 60;
          ctx.fillText(mainText, cx, cy - 60);
          ctx.shadowBlur = 0;

          // 7. Divisor elegante
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(cx - 1000, cy + 180, 2000, 6);

          // 8. Razón / Motivo evaluado
          ctx.font = `600 110px ${FONT_B}`;
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText(`REVISIÓN: ${String(reason || 'OFICIAL').toUpperCase()}`, cx, cy + 360);

          // 9. Equipos involucrados
          ctx.font = `700 90px ${FONT_BC}`;
          ctx.fillStyle = colorAccent;
          ctx.letterSpacing = '5px';
          ctx.fillText(`${teamHome} VS ${teamAway}`, cx, cy + 540);
          ctx.letterSpacing = '0px';

          ctx.restore();
      });
  }
  function showHalftime() {}
  function showFulltime() {}
  function showMatchSummary() {}
  function showExtratime() {}
  function showShootout() {}
  function showInjuryTime() {}
  // ✨ FIX: Borramos showSubstitution() y showInjury() vacíos de aquí
function showCoolingBreak(detail, timer, score, teamHome, teamAway) {
      const colors = { 
          bgTop: 'rgba(2, 132, 199, 0.95)', // Azul Agua Profundo
          bgBot: 'rgba(3, 105, 161, 0.98)', 
          accent: '#38bdf8', // Celeste Brillante
          glow: 'rgba(56, 189, 248, 0.4)', 
          avatarBorder: 'rgba(56, 189, 248, 0.5)', 
          border: 'rgba(255, 255, 255, 0.08)' 
      };
      
      // ✨ FIX: Inyectamos "TIEMPO DE HIDRATACIÓN" como teamAccion para que se ponga abajo a la izquierda
      _drawV2GoalCard('💧', 'Pausa', 'HIDRATACIÓN', '', detail, score, null, timer, colors, teamHome, teamAway, 'TIEMPO DE HIDRATACIÓN', 0.70);
  }


  function showMatchPaused(detail, timer, score, teamHome, teamAway) {
      const colors = { 
          bgTop: 'rgba(71, 85, 105, 0.95)', // Pizarra/Gris Oscuro neutro
          bgBot: 'rgba(15, 23, 42, 0.98)', 
          accent: '#cbd5e1', // Gris Plata brillante
          glow: 'rgba(203, 213, 225, 0.4)', 
          avatarBorder: 'rgba(203, 213, 225, 0.5)', 
          border: 'rgba(255, 255, 255, 0.12)' 
      };
      
      _drawV2GoalCard('⏸', 'Pausa', 'JUEGO DETENIDO', '', detail, score, null, timer, colors, teamHome, teamAway, 'PARTIDO PAUSADO', 0.70);
  }

  function showMomentum() {}

  // ══════════════════════════════════════════════════════════════════
  // FADE / HIDE / UPDATE
  // ══════════════════════════════════════════════════════════════════
  function hide() { targetOpacity = 0; }

  function update(dt) {
    if (pendingFn && fontsReady) {
      const fn = pendingFn; pendingFn = null;
      fn();
      texture.needsUpdate = true;
      mesh.visible = true;
      targetOpacity = 1.0;
    }

    if (material.opacity < targetOpacity) {
      material.opacity = Math.min(targetOpacity, material.opacity + dt * 5);
    } else if (material.opacity > targetOpacity) {
      material.opacity = Math.max(0, material.opacity - dt * 6);
      if (material.opacity <= 0) {
        mesh.visible = false;
      }
    }
  }

  // ✨ FIX: Return limpio y sin duplicados
  return {
    showGoal, showOwnGoal, showPenaltyGoal, 
    showPenalty, showPenaltyMissed, showSubstitution, showInjury, showCorner, 
    showOffside, showShot, showVAR, showHalftime, showFulltime, 
    showMatchSummary, showExtratime, showShootout, showInjuryTime, 
    showCoolingBreak, showMomentum, showMatchPaused,
    hide, update
  };
})();