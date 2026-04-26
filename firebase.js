// ══════════════════════════════════════════════════════════════════
// firebase.js — Conexión Firebase | Todos los TypeIDs del Smart Panel
// Usar: ?id=match_IDPARTIDO  o  ?match=match_IDPARTIDO
// ══════════════════════════════════════════════════════════════════

import { initializeApp }                     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, get }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── CONFIGURACIÓN ────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDAJrrAW3JMqGTLsOvv2eXKYNpfpMLJ-P8",
  authDomain:        "proyecto-futbol-7c0cb.firebaseapp.com",
  databaseURL:       "https://proyecto-futbol-7c0cb-default-rtdb.firebaseio.com",
  projectId:         "proyecto-futbol-7c0cb",
  storageBucket:     "proyecto-futbol-7c0cb.firebasestorage.app",
  messagingSenderId: "840299316357",
  appId:             "1:840299316357:web:1b0abe35b0a1bb18ec95ec"
};

const fbApp = initializeApp(FIREBASE_CONFIG);
const DB    = getDatabase(fbApp);

// ── ID DEL PARTIDO ───────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const MATCH_ID  = urlParams.get('id') || urlParams.get('match') || 'current_match';
const BASE      = `matches_list/${MATCH_ID}`;

// ── DIMENSIONES ──────────────────────────────────────────────────
const S = 0.6, FW = 105 * S, FH = 68 * S;

function clampXZ(bx, bz) {
  return (!isFinite(bx) || !isFinite(bz)) ? { x: 0, z: 0 } : { x: bx, z: bz };
}

// ── VARIABLES GLOBALES Y CEREBRO DEL CHEVRON ─────────────────────
window._bloqueoSecuencia = false;
window._overlayActivo = false;
window._ultimaPosicionBalon = { x: 0, z: 0, normX: 0.5 };
window._tiempoOffside = 0; // ✨ NUEVO: Candado de tiempo para Offside
window._equipoOffside = ''; // ✨ NUEVO: Memoria del equipo en Offside
window._cachedTeamHome = '';
window._cachedTeamAway = '';
window._textoZombieSuprimido = '';
let _lastChevronState = null; 

function aplicarEstadoChevron() {
  if (typeof Chevron === 'undefined') return;
  
  if (window._bloqueoSecuencia) {
    Chevron.setPossession(false);
    if (typeof Radar3D !== 'undefined') Radar3D.hide();
    return;
  }
  
  if (window._overlayActivo && !window._isCoolingBreak) {
    Chevron.setPossession(false);
    return;
  }
  
  const esOffsideFijo = window._tiempoOffside > 0;

  if (_lastChevronState && _lastChevronState.active) {
    Chevron.setPossession(true, _lastChevronState.team || '', _lastChevronState.direction || 1);
    
    // 👇 ✨ NUEVO: Interceptor de textos para el Chevron 👇
    let textAction = _lastChevronState.action || '';
    let extraData = _lastChevronState.extra || null;

// Si por error la acción dice GOL, o es un texto "zombi" residual de un Penal anterior
    if (textAction.toUpperCase().includes('GOL') || (textAction !== '' && textAction === window._textoZombieSuprimido)) {
        textAction = '';
        extraData = null;
    }
    // 👆 ================================================= 👆

    if (window._isCoolingBreak) {
        Chevron.showGroundLabel('', '', '', null);
    } else if (esOffsideFijo) {
        Chevron.showGroundLabel(window._equipoOffside || _lastChevronState.team, 'FUERA DE JUEGO', '#ef4444');
    } else {
        // ✨ Usamos nuestras variables filtradas en lugar de _lastChevronState directo
        Chevron.showGroundLabel(_lastChevronState.team || '', textAction, '#ffffff', extraData);
    }
    
    if (typeof Radar3D !== 'undefined') {
        if (textAction && !esOffsideFijo) Radar3D.show(textAction, _lastChevronState.direction || 1);
        else Radar3D.hide(); 
    }
  } else {
    Chevron.setPossession(false);
    if (typeof Radar3D !== 'undefined') Radar3D.hide();
  }
}
window.restaurarChevronActivo = aplicarEstadoChevron;

// ── HELPERS ──────────────────────────────────────────────────────
function ballVisible(v) {
  if (typeof Objects !== 'undefined') {
    Objects.ballGroup.visible  = v;
    Objects.ballShadow.visible = v;
  }
}

function resetScene() {
  window._overlayActivo = false;
  window._isCoolingBreak = false;
  aplicarEstadoChevron();
  if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
  if (typeof OffsideLine !== 'undefined') OffsideLine.hide(); // ← nueva línea
  if (typeof BallTrajectory !== 'undefined') BallTrajectory.clear();
  ballVisible(true);
}

// ══════════════════════════════════════════════════════════════════
// LISTENER: /engine_3d/paint → Marcador y escudos en el césped
// ══════════════════════════════════════════════════════════════════
function listenPitchPaint() {
  onValue(ref(DB, `${BASE}/engine_3d/paint`), snap => {
    const d = snap.val();
    if (typeof PitchPaint !== 'undefined') {
      if (d && d.active && d.data) {
        PitchPaint.show(
          d.data.score_home || 0,
          d.data.score_away || 0,
          d.data.logo_home  || '',
          d.data.logo_away  || ''
        );
      } else {
        PitchPaint.hide();
      }
    }
  });
}

// ── MEMORIA CACHÉ PARA OVERLAYS ───────────────────────────────────
let _overlayNormalGuardado = null;
let _temporizadorPitchCard = null;
let _overlayNormalTimestamp = 0;  // ✨ FIX: Timestamp del último overlay normal guardado
let _cardEventTimestamp = 0;      // ✨ FIX: Timestamp del evento de tarjeta que interrumpió

// ══════════════════════════════════════════════════════════════════
// LISTENER: /engine_3d/overlay → Todos los TypeIDs
// ══════════════════════════════════════════════════════════════════
function listenOverlays() {
  onValue(ref(DB, `${BASE}/engine_3d/overlay`), snap => {
    const d = snap.val();

    // ✨ NUEVO: INTERCEPTOR DE VAR (Fuerza a mostrar la tarjeta aunque active sea false)
    if (d && d.typeid >= 501 && d.typeid <= 509) {
        _overlayNormalGuardado = d;
        _overlayNormalTimestamp = d.timestamp || Date.now();
        clearTimeout(_temporizadorPitchCard);
        if (typeof PitchCards !== 'undefined' && PitchCards.hide) PitchCards.hide();
        
        // Forzamos a que dibuje la tarjeta
        procesarOverlayNormal(d);
        
        // Si es una resolución (ej. 509) o mandaron active:false desde el panel,
        // le damos 6 segundos de gloria en pantalla y luego lo auto-ocultamos
        if (d.typeid > 501 || d.active === false) {
           _autoHide(6000); 
        }
        return; // Salimos para que el código de abajo no lo borre instantáneamente
    }

    // 1. SI APAGAN EL SWITCH MANUALMENTE EN LA WEB
    if (!d || !d.active) {
      window._overlayActivo = false;
      _overlayNormalGuardado = null;        // Borramos la memoria
      clearTimeout(_temporizadorPitchCard); // Cancelamos el regreso del penal
      aplicarEstadoChevron(); 
      
      if (typeof PitchCards !== 'undefined' && PitchCards.hide) PitchCards.hide();
      if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) Animacion.fadeBalon(1, 400);
      if (!window._bloqueoSecuencia) resetScene();
      return;
    }

    const typeid = parseInt(d.typeid);
    const ex     = d.extra || {};

    // ── ✨ FIX: Si este overlay es más antiguo que el último evento de tarjeta,
    // lo ignoramos. Evita que un overlay guardado en Firebase vuelva a dispararse
    // cuando el listener se re-ejecuta tras una tarjeta 302/303/304.
    const overlayTimestamp = d.timestamp || 0;
    if (overlayTimestamp > 0 && overlayTimestamp <= _cardEventTimestamp) {
        // Este overlay ya fue "cancelado" por una tarjeta posterior — lo ignoramos
        return;
    }

// ── ✨ 2. ALTA PRIORIDAD: TARJETAS AL CÉSPED (TypeIDs 302, 303, 304) ──
    if ([302, 303, 304].includes(typeid)) {
        
        // A) Ocultamos el overlay de pantalla (El Penal se va)
        if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
        window._overlayActivo = false; 

        // ✨ FIX: Guardamos el timestamp de este evento de tarjeta
        // y limpiamos el overlay guardado para que NO vuelva a aparecer
        _cardEventTimestamp = d.timestamp || Date.now();
        _overlayNormalGuardado = null; // El overlay anterior queda invalidado

        // 👇 ✨ NUEVO: Si es ROJA (303) o DOBLE AMARILLA (304), el balón se desvanece
        if (typeid === 303 || typeid === 304) {
            if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) {
                Animacion.fadeBalon(0, 400); // 0% opacidad en 400ms
            }
        }
        // 👆 =======================================================================

        get(ref(DB, `${BASE}/state`)).then(sSnap => {
            const st = sSnap.val() || {};
            const tHome = st.team_home_name || st.team_home || d.teamHome || 'LOCAL';
            const tAway = st.team_away_name || st.team_away || d.teamAway || 'VISITA';
            const equipo = ex.team_name || d.team_name || (d.team === 'away' ? tAway : tHome);
            
            // B) Pintamos en el césped por 10 segundos
            if (typeof PitchCards !== 'undefined') {
                PitchCards.show(typeid, ex.player || ex, equipo, 10000); 
            }
            if (typeof Chevron !== 'undefined' && Chevron.hideFor) {
                Chevron.hideFor(10000); 
            }

            // C) Después de 10 segundos, restauramos todo
            clearTimeout(_temporizadorPitchCard);
            _temporizadorPitchCard = setTimeout(() => {
                
                // 👇 ✨ NUEVO: El balón reaparece después de los 10 segundos de la tarjeta
                if (typeid === 303 || typeid === 304) {
                    if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) {
                        Animacion.fadeBalon(1, 500); // 100% opacidad en 500ms
                    }
                }
                // 👆 ====================================================================

                // ✨ FIX: Solo restauramos si hay un overlay guardado Y es más reciente
                if (_overlayNormalGuardado && (_overlayNormalGuardado.timestamp || 0) > _cardEventTimestamp) {
                    procesarOverlayNormal(_overlayNormalGuardado);
                } else {
                    aplicarEstadoChevron();
                }
            }, 10000); // Pasan 10 segundos y vuelve
        });
        return; // ⛔ Salimos para no ejecutar carteles normales
    }

    // ── 3. OVERLAYS NORMALES (Penales, Goles, etc) ──
    // Guardamos en la memoria RAM por si luego tiran una tarjeta
    _overlayNormalGuardado = d;
    _overlayNormalTimestamp = d.timestamp || Date.now(); // ✨ FIX: Guardamos su timestamp
    clearTimeout(_temporizadorPitchCard); // Cancelamos si entra un cartel nuevo
    if (typeof PitchCards !== 'undefined' && PitchCards.hide) PitchCards.hide(); // Borra tarjeta si entra cartel nuevo
    
    procesarOverlayNormal(d);
  });
}

// ── FUNCIÓN AISLADA PARA RE-DIBUJAR CARTELES NORMALES ──────────────
// 1. Modifica la función procesarOverlayNormal así:
function procesarOverlayNormal(d) {
    const typeid = parseInt(d.typeid);
    const ex     = d.extra || {};

// ✨ FIX DEFINITIVO: Agrupamos todas las acciones de balón parado (Córner 401, 
    // Tiro Libre 402, Lateral 403, Saque de meta 404 y Offside 405).
    // Salimos temprano para NO activar "_overlayActivo" y evitar que el Chevron desaparezca.
if ([401, 402, 403, 404, 405].includes(typeid)) {
        if (typeof BallTrajectory !== 'undefined') BallTrajectory.clear();
        return;
    }

    if (typeof BallTrajectory !== 'undefined') BallTrajectory.clear();

// 👇 ✨ FIX: Limpiar datos del Chevron al haber un Gol o Penal 👇
    // Borramos la acción y la foto de la memoria para que cuando termine 
    // la secuencia del gol, el césped vuelva limpio.
    if ([201, 202, 203, 204, 205].includes(typeid)) {
        if (_lastChevronState && _lastChevronState.action) {
            // Guardamos el texto (ej. "PENAL MIN 06") para ignorarlo si Firebase lo revive
            window._textoZombieSuprimido = _lastChevronState.action;
            
            _lastChevronState.action = '';
            _lastChevronState.extra = null;
        }
    }
    // 👆 =========================================================== 👆

    // ✨ FIX: Detectamos si es pausa para proteger al Chevron
    window._isCoolingBreak = (typeid === 603);
    window._overlayActivo = true;
    aplicarEstadoChevron();

    // ── GOL (Secuencia con coreografía y balón oculto) ────────
    if (typeid === 201 || typeid === 202 || typeid === 203) {
      if (typeof Animacion !== 'undefined') {
        if (!window._bloqueoSecuencia && Animacion.secuenciaGol201) {
          Animacion.secuenciaGol201(d, ex, typeid === 203 ? 15000 : 30000);
        } else if (Animacion.actualizarDatosGol) {
          Animacion.actualizarDatosGol(d, ex);
        }
      }
      return; 
    }

    // ── RESTO DE CARTELES ─
    if (typeof OverlayManager !== 'undefined') {
      switch(typeid) {
// ✨ FIX: Agregado el 508
        case 501: case 502: case 503: case 504: case 505: case 506: case 508: case 509:
            get(ref(DB, `${BASE}/state`)).then(sSnap => {
                const st = sSnap.val() || {};
                const scStr = `${st.score?.home||0} - ${st.score?.away||0}`;
                
                // ✨ FIX: Priorizamos los nombres enviados directamente en el extra
                const tHome = ex.team_name_home || st.team_home_name || d.teamHome || 'LOCAL';
                const tAway = ex.team_name_away || st.team_away_name || d.teamAway || 'VISITA';
                
                // La razón del VAR siempre viaja aquí ahora
                const motivo = ex.reason || d.reason || 'Revisión Oficial';

                OverlayManager.showVAR(typeid, motivo, scStr, tHome, tAway, ex.time||'');
            });
            break;

        case 204: 
        case 205:
            get(ref(DB, `${BASE}/state`)).then(sSnap => {
                const st = sSnap.val() || {};
                const sc = st.score || {home: 0, away: 0};
                const scStr = `${sc.home} - ${sc.away}`;

                // 👇 ✨ FIX DEFINITIVO: Nombres blindados (copiados del código del VAR)
                const tHome = ex.team_name_home || st.team_home_name || window._cachedTeamHome || 'LOCAL';
                const tAway = ex.team_name_away || st.team_away_name || window._cachedTeamAway || 'VISITA';
                
                const esLocal = (d.team !== 'away');
                const teamAccion = d.team_name || ex.team_name || (esLocal ? tHome : tAway);
                // 👆 ===============================================================

                if (typeid === 204) {
                    OverlayManager.showPenalty(teamAccion, ex.name_short||ex.player||'', scStr, ex.photo||'', tHome, tAway, ex.minute||d.time||'', ex.team_logo||'');
                } else {
                    OverlayManager.showPenaltyMissed(teamAccion, ex.name_short||ex.player||'', scStr, ex.photo||'', tHome, tAway, ex.minute||d.time||'', ex.team_logo||'');
                }
                
                // ✨ NOTA: Se eliminaron las líneas del "dirPenal" y "Radar3D.show" de aquí.
                // Ahora el motor dejará que tu Panel (que ya sabe si el campo está invertido) 
                // controle la dirección del cono de forma absoluta y sin contradecirlo.
            });
            break;
            
        case 401: OverlayManager.showCorner(ex.player||'', d.team||'', ex.detail||'', ex.count||''); break;

        case 604: resetScene(); break;
        case 604: resetScene(); break;
        case 803: OverlayManager.showMomentum(ex.pctHome||50, ex.pctAway||50, d.teamHome||'', d.teamAway||'', ex.clock||''); break;
        case 902: resetScene(); break;
      }
    }
}

// Auto-hide blindado que respeta la posición del balón
function _autoHide(ms) {
  setTimeout(() => {
    if (window._bloqueoSecuencia) return;
    
    window._overlayActivo = false; // El cartel se va
    aplicarEstadoChevron();        // Reactivamos el chevron
    
    if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
    
    if (typeof Objects !== 'undefined') {
      const posReal = window._ultimaPosicionBalon || { x: 0, z: 0 };
      Objects.moveBall(posReal.x, posReal.z);
    }
    ballVisible(true);
  }, ms);
}
// ══════════════════════════════════════════════════════════════════
// LISTENER: /engine_3d/chevron
// ══════════════════════════════════════════════════════════════════

// ✨ FIX DEFINITIVO: Tracker independiente de qué acción disparó el último clear.
// El problema: cuando cambia el equipo (diferente team), Firebase envía DOS updates:
//   1) sync de posesión (sin action → Firebase conserva la acción VIEJA en el nodo)
//   2) la acción nueva del lateral
// Si la acción vieja === la nueva (ej: mismo "SAQUE LATERAL Min 15"), la comparación
// anteriorAccion === nuevaAccion → apareceNuevaAccion = false → no limpia.
// Solución: rastrear separado. Se resetea a "" en cada cambio de posesión, asegurando
// que el siguiente update con acción siempre sea detectado como "nuevo".
let _lastClearedAction = '';

function listenChevron() {
  onValue(ref(DB, `${BASE}/engine_3d/chevron`), snap => {
    const nuevoEstado = snap.val() || {};

// 👇 ✨ FIX: INTERCEPTOR EN LA PUERTA 👇
        // Si Firebase intenta empujar la misma acción que acabamos de matar, la vaciamos
        // antes de que contamine el resto de la lógica.
        if (nuevoEstado.action && window._textoZombieSuprimido !== '' && nuevoEstado.action === window._textoZombieSuprimido) {
            nuevoEstado.action = '';
            nuevoEstado.extra = null;
        }
        // 👆 ===================================== 👆

        // Verificamos si hubo un cambio REAL en la posesión (cambio de equipo, dirección o estado activo)
        const cambioDePosesion = _lastChevronState && (
            _lastChevronState.team !== nuevoEstado.team ||
            _lastChevronState.direction !== nuevoEstado.direction ||
            _lastChevronState.active !== nuevoEstado.active
        );

    // Al cambiar posesión: reseteamos el tracker
    if (cambioDePosesion) {
        _lastClearedAction = '';
        // ❌ Ya NO borramos el zombi aquí. El panel cambia la posesión automáticamente tras un gol
        // y eso borraba nuestra protección antes de tiempo.
    }

    const nuevaAccion = nuevoEstado.action || '';
    const apareceNuevaAccion = nuevaAccion !== '' && nuevaAccion !== _lastClearedAction;

    // ✨ FIX: Solo olvidamos el zombi si entra una acción nueva REAL y la cinemática ya terminó
    if (apareceNuevaAccion && !window._bloqueoSecuencia) {
        window._textoZombieSuprimido = ''; 
    }

    _lastChevronState = nuevoEstado;

    // ✨ FIX: Si hay un offside activo y detectamos un CAMBIO DE POSESIÓN manual
    // (damos un margen de 500ms por si los datos llegan casi al mismo tiempo)
    if (window._tiempoOffside > 0 && cambioDePosesion && (Date.now() - window._tiempoOffside > 500)) {
        window._tiempoOffside = 0; // Apagamos el candado
        if (typeof OffsideLine !== 'undefined') OffsideLine.hide();
    }

    if ((cambioDePosesion || apareceNuevaAccion) && typeof BallTrajectory !== 'undefined') {
        BallTrajectory.clear();
        // Solo actualizamos el tracker cuando FUE LA ACCIÓN quien limpió (no la posesión).
        // Si fue posesión, dejamos _lastClearedAction = '' para que el siguiente update
        // con acción (incluso misma acción vieja de carry-over) también dispare un clear.
        if (apareceNuevaAccion && !cambioDePosesion) {
            _lastClearedAction = nuevaAccion;
        }
    }

// 👇 ✨ INYECCIÓN DEL HOLOGRAMA Y SINCRONIZACIÓN CON CHEVRON 👇
        
        const posBalon = window._ultimaPosicionBalon || { x: 0, z: 0 };
        const absX = Math.abs(posBalon.x);
        const absZ = Math.abs(posBalon.z);

        // ZONAS DONDE ESTÁ PROHIBIDO EL HOLOGRAMA (Puntos de Balón Parado)
        const esSaqueCentro = absX < 2.0 && absZ < 2.0;
        const esPuntoPenal  = absX > 23.0 && absX < 26.0 && absZ < 2.0;
        const esSaqueMeta   = absX > 28.0 && absZ < 10.0;
        const esCorner      = absX > 29.0 && absZ > 19.0;
        
        const esBalonParado = esSaqueCentro || esPuntoPenal || esSaqueMeta || esCorner;

// 👇 ✨ INYECCIÓN DEL HOLOGRAMA BLINDADA 👇
        
        // Solo disparamos si realmente tenemos nombres cargados
        const tieneNombres = window._cachedTeamHome && window._cachedTeamAway;

        // Solo es una "Recuperación en disputa" si:
        // 1. Cambió posesión
        // 2. No hay cartel nuevo (!apareceNuevaAccion)
        // 3. No estamos en cinemática (!window._bloqueoSecuencia)
        // 4. NO ES BALÓN PARADO (!esBalonParado)
        // 5. NO HAY UN CARTEL GRÁFICO ACTIVO (!window._overlayActivo)
        // 6. ✨ TENEMOS NOMBRES (tieneNombres)
        
        if (cambioDePosesion && nuevoEstado.active && !apareceNuevaAccion && !window._bloqueoSecuencia && !window._overlayActivo && !esBalonParado && tieneNombres) {
            if (typeof HologramLabel !== 'undefined') {
                // Pasamos el ID del equipo y dejamos que el Holograma use el Cache
                HologramLabel.show(nuevoEstado.team);
                
                if (typeof Chevron !== 'undefined' && Chevron.hideFor) {
                    Chevron.hideFor(3000); 
                }
            }
        }
        // 👆 ======================================================= 👆
    aplicarEstadoChevron();         
  });
}

// ── VARIABLES GLOBALES PARA LA SECUENCIA ─────────────────────────
window._bloqueoSecuencia = false;
window._ultimaPosicionBalon = { x: 0, z: 0, normX: 0.5 }; // Memoria silenciosa

// ══════════════════════════════════════════════════════════════════
// LISTENER: /engine_3d/ball
// ══════════════════════════════════════════════════════════════════
let timestampBalonAnterior = 0; // Memoria para detectar clicks nuevos

function listenBall() {
  onValue(ref(DB, `${BASE}/engine_3d/ball`), snap => {
    const d = snap.val();
    if (!d) return;

// ✨ MAGIA AQUÍ: Si hay un NUEVO movimiento de balón (click del operador)
    const nuevoTimestamp = d.timestamp || 0;
    if (nuevoTimestamp > timestampBalonAnterior) {
        timestampBalonAnterior = nuevoTimestamp;

        // ✨ FIX DEFINITIVO: El panel mueve el balón al medio campo automáticamente 
        // después de un gol. Solo borramos el zombi si NO estamos en la cinemática.
        if (!window._bloqueoSecuencia) {
            window._textoZombieSuprimido = '';
        }
        
        if (_lastChevronState) {
            _lastChevronState.action = '';
            _lastChevronState.extra = null;
        }

        // ✨ FIX: Apagamos el offside SOLO si detectamos un click de movimiento NUEVO


        // ✨ FIX: Apagamos el offside SOLO si detectamos un click de movimiento NUEVO
        if (window._tiempoOffside > 0 && (Date.now() - window._tiempoOffside > 500)) {
            window._tiempoOffside = 0;
            if (typeof OffsideLine !== 'undefined') OffsideLine.hide();
        }

        // Limpiamos los overlays...
        if (window._overlayActivo && !window._bloqueoSecuencia) {
            window._overlayActivo = false;
            aplicarEstadoChevron();
            if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
            if (typeof Radar3D !== 'undefined') Radar3D.hide();
        }
    }

    const coords = Array.isArray(d.ruta) ? d.ruta : [d];
    const last   = coords[coords.length - 1];
    let { x: bx, z: bz } = clampXZ(last.x ?? 0, last.z ?? 0);

    // ✨ FIX: Invertimos siempre el eje Z de manera uniforme. 
    bz = -bz;

    const normX = (bx + (105 * 0.6) / 2) / (105 * 0.6);

// 1. Guardamos la posición real silenciosamente siempre
    window._ultimaPosicionBalon = { x: bx, z: bz, normX: normX };

    // 2. SI HAY UNA SECUENCIA (GOL) EN CURSO, IGNORAMOS EL MOVIMIENTO VISUAL
    if (window._bloqueoSecuencia) return; 

    // 3. ✨ FIX: Restauramos el movimiento natural (Lerp) para TODOS los clics.
    // El balón volverá a "rodar" suavemente hacia su objetivo.
    if (typeof Objects !== 'undefined') {
        Objects.moveBall(bx, bz);
    }
    
    // 👇 ✨ NUEVO: Registrar el punto en la trayectoria 👇
    if (typeof BallTrajectory !== 'undefined') {
        BallTrajectory.addPosition(bx, bz, 0.01);
    }
    // 👆 ============================================== 👆

    if (typeof Chevron !== 'undefined') Chevron.updateBallPos(normX);

    // Actualizamos Radar
    aplicarEstadoChevron();
  });
}
// ══════════════════════════════════════════════════════════════════
// LISTENER: /match_config → Cámara y Luces
// ══════════════════════════════════════════════════════════════════

function listenMatchConfig() {
  onValue(ref(DB, `${BASE}/match_config/camera`), snap => {
    const d = snap.val(); if (!d) return;
    if (d.view === 'custom' && d.pos && d.look) Scene?.setCustomView(d);
    else if (d.view) Scene?.setView(d.view);
  });

  onValue(ref(DB, `${BASE}/match_config/light`), snap => {
    const d = snap.val(); if (d) Scene?.applyLight(d);
  });

// 👇 ✨ FIX: Escuchando la ruta correcta (config) donde el Panel guarda el estado
  onValue(ref(DB, `${BASE}/config/campoInvertido`), snap => {
    window._campoInvertido = snap.val() === true;
  });
  // 👆 ====================================================================== 👆
}





function listenTeamNames() {
  onValue(ref(DB, `${BASE}/teams`), snap => {
    const d = snap.val();
    if (d) {
        // 🛡️ CAJA FUERTE: Guardamos los nombres reales para que NADIE los borre
        window._cachedTeamHome = d.home?.name || 'LOCAL';
        window._cachedTeamAway = d.away?.name || 'VISITANTE';
        console.log("✅ Nombres blindados en 3D:", window._cachedTeamHome, "vs", window._cachedTeamAway);
    }
  });
}
// ══════════════════════════════════════════════════════════════════
// LISTENER: /event_log → Sustituciones, Lesiones y Pausas
// ══════════════════════════════════════════════════════════════════
let _lastEventLogId = null;
let _initialEventLogLoad = true;
let _lesionFase2Procesada = false; 

function listenEventLog() {
  onValue(ref(DB, `${BASE}/event_log`), snap => {
    const val = snap.val();
    if (!val) return;
    
    const keys = Object.keys(val);
    const latestKey = keys[keys.length - 1];
    const d = val[latestKey];
    const typeid = parseInt(d.typeid);
    
    if (_initialEventLogLoad) {
        _lastEventLogId = latestKey;
        _initialEventLogLoad = false;
        return; 
    }

    const esNuevoEvento = (latestKey !== _lastEventLogId);
    const tieneNombreJugador = (d.player || d.name_short);
    const esLesionFase2 = (!esNuevoEvento && typeid === 602 && !_lesionFase2Procesada && tieneNombreJugador);

    if (esNuevoEvento || esLesionFase2) {
        
        if (esNuevoEvento) {
            _lastEventLogId = latestKey;
            _lesionFase2Procesada = false; 

            // 👇 ✨ NUEVO: Limpiar trayectoria cuando llega Tarjeta Roja, Amarilla, Lesión, etc 👇
            if (typeof BallTrajectory !== 'undefined') BallTrajectory.clear();
            // 👆 ============================================================================== 👆
  

        }

            // ✨ FIX: Cachear nombres de equipo desde event_log (siempre los trae)
    if (typeid === 204 || typeid === 205) {
        if (d.team_name_home) window._cachedTeamHome = d.team_name_home;
        if (d.team_name_away) window._cachedTeamAway = d.team_name_away;
    }
        // ── TYPEID 403: SAQUE LATERAL ──
        // El clear ya se ejecutó arriba (línea 454), pero añadimos un return explícito
        // para evitar la race condition con listenBall que puede re-añadir puntos antes
        // de que el clear se propague. Así el comportamiento es idéntico al cambio de posesión.
        if (typeid === 403) {
            if (typeof BallTrajectory !== 'undefined') BallTrajectory.clear();
            return;
        }

 // ✨ FIX: Ahora escuchamos 302, 303, 304, 405 (Offside), 601, 602, 603, 604 y 605
if ([302, 303, 304, 405, 601, 602, 603, 604, 605].includes(typeid)) {
            get(ref(DB, `${BASE}/state`)).then(sSnap => {
                const st = sSnap.val() || {};
                const scStr = `${st.score?.home||0} - ${st.score?.away||0}`;
                
                const tHome = d.team_name_home || st.team_home_name || st.team_home || 'LOCAL';
                const tAway = d.team_name_away || st.team_away_name || st.team_away || 'VISITA';
                const equipo = d.team_name || (d.team === 'away' ? tAway : tHome);
                const isHome = (d.team !== 'away');

                // 👇 AÑADE ESTE BLOQUE NUEVO PARA EL OFFSIDE 👇
// ── TYPEID 405: OFFSIDE (FASE ÚNICA E INMEDIATA) ──
        if (typeid === 405) {
            const _aimsRight = (_lastChevronState?.direction || 1) === 1;
            const _posNow = window._ultimaPosicionBalon || { normX: 0.5 };
            
            // ✨ FIX: Activamos el candado guardando el milisegundo exacto y el equipo
            window._tiempoOffside = Date.now();
            window._equipoOffside = equipo;
            
            // 1. Mostrar la línea 3D de forma indefinida
            if (typeof OffsideLine !== 'undefined') {
                const bx = d.coord ? d.coord.x : null;
                const nx = bx !== null ? Math.max(0, Math.min(1, (bx + FW / 2) / FW)) : _posNow.normX;
                OffsideLine.show(nx, _aimsRight, 0); 
            }

            // 2. Refrescamos el Chevron para que pinte el texto protegido
            aplicarEstadoChevron();
            return; 
        }
                // ── TYPEID 302 / 303 / 304: TARJETAS (desde event_log) ──
                // Solo limpiamos el overlay guardado para que no vuelva a aparecer.
                // La animación real la maneja listenOverlays() con engine_3d/overlay.
                if ([302, 303, 304].includes(typeid)) {
                    _cardEventTimestamp = d.timestamp || Date.now();
                    _overlayNormalGuardado = null;
                    clearTimeout(_temporizadorPitchCard);
                    return;
                }

                // ── TYPEID 603: PAUSA DE HIDRATACIÓN ──
                if (typeid === 603) {
                    window._isCoolingBreak = true;
                    window._overlayActivo = true;
                    aplicarEstadoChevron(); // Magia: Se borran las letras pero el Chevron se queda
                    
                    if (typeof OverlayManager !== 'undefined') {
                        OverlayManager.showCoolingBreak(d.detail||'TIEMPO MUERTO', d.time||d.minute||'', scStr, tHome, tAway);
                    }
                    return;
                }

                // ── TYPEID 604: FIN DE PAUSA (REANUDAR) ──
                if (typeid === 604) {
                    resetScene(); // Apaga el cartel azul y devuelve las letras al Chevron
                    return;
                }

                // ── TYPEID 605: JUGADOR RECUPERADO ──
                if (typeid === 605) {
                    if (typeof PitchCards !== 'undefined') {
                        PitchCards.hideInjuryCorner();
                        PitchCards.showRecoveryCorner();
                    }
                    window._bloqueoSecuencia = false; 
                    if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) Animacion.fadeBalon(1, 500); 
                    aplicarEstadoChevron(); 
                    return;
                }

                // ── TYPEID 601: SUSTITUCIÓN ──
                if (typeid === 601) {
                    window._bloqueoSecuencia = true;
                    if (typeof Chevron !== 'undefined') Chevron.setPossession(false);
                    if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) Animacion.fadeBalon(0, 400); 
                    if (typeof PitchCards !== 'undefined' && PitchCards.hideInjuryCorner) PitchCards.hideInjuryCorner(); 
                    
                    const pIn = d.player_in?.name_short || '';
                    const pOut = d.player_out?.name_short || '';
                    const pPhoto = (d.player_in && d.player_in.photo) ? d.player_in.photo : (d.photo || '');
                    
                    if (typeof OverlayManager !== 'undefined') {
                        OverlayManager.showSubstitution(equipo, pIn, pOut, scStr, tHome, tAway, d.time||d.minute||'', pPhoto);
                    }

                    clearTimeout(window._timeoutSustitucion);
                    window._timeoutSustitucion = setTimeout(() => {
                        if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
                        if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) Animacion.fadeBalon(1, 500); 
                        window._bloqueoSecuencia = false;
                        aplicarEstadoChevron();
                    }, 15000);
                }

                // ── TYPEID 602: LESIÓN / ATENCIÓN MÉDICA ──
                if (typeid === 602) {
                    
                    if (esNuevoEvento) {
                        window._bloqueoSecuencia = true; 
                        if (typeof Chevron !== 'undefined') Chevron.setPossession(false);
                        if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) Animacion.fadeBalon(0, 400); 
                    }

                    const pName = (d.player && d.player.name_short) ? d.player.name_short : (typeof d.player === 'string' ? d.player : (d.name_short || ''));
                    const pPhoto = (d.player && d.player.photo) ? d.player.photo : (d.photo || '');
                    
                    if (typeof OverlayManager !== 'undefined') {
                        OverlayManager.showInjury(equipo, pName, scStr, tHome, tAway, d.time||d.minute||'', pPhoto);
                    }

                    if (pName !== '') {
                        _lesionFase2Procesada = true; 
                        
                        if (typeof PitchCards !== 'undefined' && PitchCards.setInjuryMemory) {
                            PitchCards.setInjuryMemory(pName, equipo, isHome);
                        }

                        clearTimeout(window._timeoutLesion);
                        window._timeoutLesion = setTimeout(() => {
                            if (typeof OverlayManager !== 'undefined') OverlayManager.hide();
                            
                            if (typeof Animacion !== 'undefined' && Animacion.fadeBalon) Animacion.fadeBalon(1, 500);
                            window._bloqueoSecuencia = false;
                            aplicarEstadoChevron();
                            
                            if (typeof PitchCards !== 'undefined' && PitchCards.showInjuryCorner) {
                                PitchCards.showInjuryCorner(pName, equipo, isHome);
                            }
                        }, 15000);
                    }
                }
            });
        }
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// LISTENER: /engine_3d/trajectory (Interruptor maestro de las líneas)
// ══════════════════════════════════════════════════════════════════
function listenTrajectory() {
  onValue(ref(DB, `${BASE}/engine_3d/trajectory`), snap => {
    const val = snap.val();
    
    // Si no hay datos en Firebase, asumimos que está encendido (true)
    const isTrajectoryActive = val !== null ? val.active : true;
    
    if (typeof BallTrajectory !== 'undefined' && BallTrajectory.setActive) {
        BallTrajectory.setActive(isTrajectoryActive);
    }
  });
}

// ── INICIO ───────────────────────────────────────────────────────
console.log(`🔥 Firebase conectado → ${BASE}`);
listenBall();
listenMatchConfig();
listenPitchPaint();
listenChevron();
listenOverlays();
listenEventLog();
listenTrajectory();
listenTeamNames();