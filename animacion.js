// ══════════════════════════════════════════════════════════════════
// animacion.js — Viento, Cinemáticas y Secuencias Especiales (Gol)
// ══════════════════════════════════════════════════════════════════

const Animacion = (() => {

  let time = 0;
  let _datosGolActuales = null; // Memoria para fusionar Fase 1 y Fase 2

  function update() {
    if (typeof Objects === 'undefined' || !Objects.flags) return;
    time += 0.05;

    Objects.flags.forEach(flag => {
      const pos = flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const waveX = Math.sin(x * 3.5 - time * 2) * (x * 0.15);
        const waveY = Math.cos(y * 2.0 - time) * (x * 0.05);
        pos.setZ(i, waveX + waveY);
      }
      pos.needsUpdate = true;
    });
  }

  // ── HELPERS DE ANIMACIÓN ASÍNCRONOS ──────────────────────────────

  function animarBalonParabola(endX, endZ, duracion = 1000) {
    return new Promise(resolve => {
      const ball = Objects.ballGroup;
      const shadow = Objects.ballShadow;
      if (!ball || !shadow) return resolve(); // Prevención por si no ha cargado

      const startX = ball.position.x;
      const startZ = ball.position.z;
      const startY = ball.position.y;
      
      const dist = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endZ - startZ, 2));
      const alturaMax = Math.min(dist * 0.25, 12); 

      const startTime = performance.now();

      function animate(currentTime) {
        let elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duracion, 1);
        let easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        ball.position.x = startX + (endX - startX) * easeProgress;
        ball.position.z = startZ + (endZ - startZ) * easeProgress;
        ball.position.y = startY + Math.sin(progress * Math.PI) * alturaMax;

        ball.rotation.x += 0.1;
        ball.rotation.z += 0.05;

        shadow.position.x = ball.position.x;
        shadow.position.z = ball.position.z;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(animate);
    });
  }

  function fadeBalon(targetOpacity, duracion = 500) {
    return new Promise(resolve => {
      if (!Objects.ballMat || !Objects.ballGroup) return resolve();

      const startOpacity = Objects.ballMat.opacity;
      const startTime = performance.now();

      if (targetOpacity === 1) {
          Objects.ballGroup.visible = true;
          Objects.ballShadow.visible = true;
          Objects.ballGroup.children.forEach(c => c.castShadow = true);
      } else {
          Objects.ballGroup.children.forEach(c => c.castShadow = false);
      }

      function animateFade(currentTime) {
        let elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duracion, 1);
        let currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
        
        Objects.ballMat.opacity = currentOpacity;
        Objects.patchMat.opacity = currentOpacity;
        Objects.ballShadow.material.opacity = currentOpacity * 0.25; 

        if (progress < 1) {
          requestAnimationFrame(animateFade);
        } else {
          if (targetOpacity === 0) {
              Objects.ballGroup.visible = false;
              Objects.ballShadow.visible = false;
          }
          resolve();
        }
      }
      requestAnimationFrame(animateFade);
    });
  }

function llamarOverlayGol() {
    if (!_datosGolActuales || typeof OverlayManager === 'undefined') return;

    const ev = _datosGolActuales.evento || {};
    const ex = _datosGolActuales.extra || {};

    const teamHome = ex.team_name_home || ev.team_name_home || 'LOCAL';
    const teamAway = ex.team_name_away || ev.team_name_away || 'VISITA';
    const minuto = ex.minute || ex.time || ev.time || ev.minute || '';
    const score = ex.score || ev.score || '0 - 0';
    const nombre = ex.name_short || ex.player || ev.name_short || ev.player || '';
    const foto = ex.photo || ev.photo || null;

    // ✨ FIX: Quien anota de verdad
    const scoringTeam = ex.team_name || ev.team_name || (ev.team === 'away' ? teamAway : teamHome);

    if (ev.typeid === 203) {
        OverlayManager.showPenaltyGoal(scoringTeam, nombre, score, foto, teamHome, teamAway, minuto);
    } else if (ev.typeid === 202) {
        OverlayManager.showOwnGoal(scoringTeam, nombre, score, foto, teamHome, teamAway, minuto);
    } else {
        OverlayManager.showGoal(scoringTeam, nombre, score, foto, teamHome, teamAway, minuto);
    }
  }

  // ── SECUENCIA MAESTRA: TYPEID 201 (GOL) ──────────────────────────

  // Se ejecuta en Fase 2 (Cuando el jugador es asignado)
  function actualizarDatosGol(evento, extra) {
    if (!window._bloqueoSecuencia || !_datosGolActuales) return;
    console.log("🔄 Actualizando datos del goleador en pantalla (Fase 2)...");

    // Fusionamos los datos nuevos con los de la Fase 1
    _datosGolActuales.extra = { ...(_datosGolActuales.extra || {}), ...(extra || {}) };
    _datosGolActuales.evento = { ...(_datosGolActuales.evento || {}), ...(evento || {}) };

    llamarOverlayGol(); // Vuelve a dibujar el cartel pero ahora con foto y nombre
  }

// ✨ FIX: Añadimos `tiempoEspera` con 30000 por defecto
  async function secuenciaGol201(evento, extra, tiempoEspera = 30000) {
    console.log("🎬 INICIANDO SECUENCIA DE GOL (Fase 1)");
    
    _datosGolActuales = { evento: evento || {}, extra: extra || {} };
    window._bloqueoSecuencia = true;

let atacaHaciaDerecha = (!window._campoInvertido && evento.team === 'home') || 
                          (window._campoInvertido && evento.team === 'away');

  // Magia: Si es autogol (202), el balón viaja hacia su PROPIA portería (contraria a la que atacan)
  if (evento.typeid === 202) atacaHaciaDerecha = !atacaHaciaDerecha;

  const xDestino = atacaHaciaDerecha ? 30.5 : -30.5; 
  // 👆 ========================================= 👆

  if (typeof Chevron !== 'undefined') Chevron.setPossession(false);

    await animarBalonParabola(xDestino, 0, 1100); 
    await fadeBalon(0, 400);

    llamarOverlayGol();

    // ✨ FIX: Esperamos dinámicamente (15s para penal, 30s para normal)
    await new Promise(resolve => setTimeout(resolve, tiempoEspera));

    if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
    const posReal = window._ultimaPosicionBalon || { x: 0, z: 0, normX: 0.5 };
    if (typeof Objects !== 'undefined' && Objects.resetBallPath) {
         Objects.resetBallPath(posReal.x, posReal.z); 
    }
    
    await fadeBalon(1, 500);

    // Forzamos visibilidad de la pelota
    if (typeof Objects !== 'undefined' && Objects.ballGroup) {
        Objects.ballGroup.visible = true;
        Objects.ballShadow.visible = true;
        Objects.ballMat.opacity = 1;
        Objects.patchMat.opacity = 1;
    }

    // Avisamos que el gol terminó para que vuelva el Chevron (marcador pequeño)
    window._bloqueoSecuencia = false;
    window._overlayActivo = false;
    if (typeof window.restaurarChevronActivo === 'function') window.restaurarChevronActivo();

    _datosGolActuales = null;
    console.log("🎬 SECUENCIA DE GOL TERMINADA");
  }

return { update, secuenciaGol201, actualizarDatosGol, fadeBalon }; 
})();