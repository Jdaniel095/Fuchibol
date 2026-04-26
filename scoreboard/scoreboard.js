// ══════════════════════════════════════════════════════════════════
// scoreboard.js — Scoreboard HTML Overlay para Campo 3D OBS
//
// INTEGRACIÓN EN index.html (justo antes de </body>):
//   <script type="module" src="scoreboard.js"></script>
//
// NODOS FIREBASE que lee:
//   matches_list/${MATCH_ID}/state
//     .team_home_name / .team_home_logo
//     .team_away_name / .team_away_logo
//     .score.home     / .score.away
//     .clock          → "MM:SS"
//     .status         → "preview" | "live" | "halftime" | "finished"
//
//   matches_list/${MATCH_ID}/scoreboard  (control directo)
//     .visible        → true/false
//     .mode           → "live" | "preview"
//     .score_home     / .score_away (override)
//     .clock          → "MM:SS" (override)
//
// API GLOBAL después de cargar:
//   Scoreboard.show()
//   Scoreboard.hide()
//   Scoreboard.setMode('live' | 'preview')
//   Scoreboard.setScore(home, away)
//   Scoreboard.setClock('45:30')
//   Scoreboard.setTeams('Qatar', 'Ecuador')
//   Scoreboard.setLogos(urlHome, urlAway)
// ══════════════════════════════════════════════════════════════════

import { initializeApp, getApps }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── FIREBASE ──────────────────────────────────────────────────────
const FB_CONFIG = {
  apiKey:            "AIzaSyDAJrrAW3JMqGTLsOvv2eXKYNpfpMLJ-P8",
  authDomain:        "proyecto-futbol-7c0cb.firebaseapp.com",
  databaseURL:       "https://proyecto-futbol-7c0cb-default-rtdb.firebaseio.com",
  projectId:         "proyecto-futbol-7c0cb",
  storageBucket:     "proyecto-futbol-7c0cb.firebasestorage.app",
  messagingSenderId: "840299316357",
  appId:             "1:840299316357:web:1b0abe35b0a1bb18ec95ec"
};

// Nombre único 'sb' para no colisionar con la instancia de firebase.js
const existingApp = getApps().find(a => a.name === 'sb');
const fbApp       = existingApp || initializeApp(FB_CONFIG, 'sb');
const DB          = getDatabase(fbApp);

const urlParams = new URLSearchParams(window.location.search);
const MATCH_ID  = urlParams.get('id') || urlParams.get('match') || 'current_match';
const BASE      = `matches_list/${MATCH_ID}`;

// ══════════════════════════════════════════════════════════════════
// CSS INLINE
// ══════════════════════════════════════════════════════════════════
const STYLES = `
#campo-sb {
  position: absolute;
  bottom: 4.5%;
  left: 50%;
  transform: translateX(-50%) translateY(12px);
  z-index: 200;
  display: flex;
  align-items: stretch;
  width: 72vw;
  max-width: 840px;
  height: 66px;
  filter: drop-shadow(0 8px 28px rgba(0,0,0,.9));
  opacity: 0;
  pointer-events: none;
  transition: opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1);
  font-family: 'Barlow Condensed', sans-serif;
}
#campo-sb.sb-show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* FLAGS */
.sb-flag {
  width: 70px; flex-shrink: 0;
  overflow: hidden;
  border-top: 2.5px solid #C9A84C;
  border-bottom: 2.5px solid #C9A84C;
  background: #111827;
  display: flex; align-items: center; justify-content: center;
}
.sb-flag img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.sb-flag.sb-fl {
  border-left: 2.5px solid #C9A84C;
  clip-path: polygon(13px 0%,100% 0%,100% 100%,13px 100%,0% 50%);
}
.sb-flag.sb-fr {
  border-right: 2.5px solid #C9A84C;
  clip-path: polygon(0% 0%,calc(100% - 13px) 0%,100% 50%,calc(100% - 13px) 100%,0% 100%);
}

/* NAME WINGS */
.sb-wing {
  flex: 1; min-width: 0;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  border-top: 2.5px solid #C9A84C;
  border-bottom: 2.5px solid #C9A84C;
  background: linear-gradient(180deg,#f6f5f1 0%,#eceae4 50%,#dddbd5 100%);
  overflow: hidden;
}
.sb-wing::before {
  content:'';
  position:absolute; top:0; left:0; right:0; height:40%;
  background: linear-gradient(180deg,rgba(255,255,255,.5),transparent);
}
.sb-wing.sb-wl::after {
  content:''; position:absolute; left:0; top:0; bottom:0; width:2.5px;
  background: linear-gradient(180deg,#C9A84C,#F0D875,#C9A84C);
}
.sb-wing.sb-wr::after {
  content:''; position:absolute; right:0; top:0; bottom:0; width:2.5px;
  background: linear-gradient(180deg,#C9A84C,#F0D875,#C9A84C);
}
.sb-team {
  font-size: clamp(13px,1.9vw,22px);
  font-weight: 800;
  letter-spacing: 3px;
  text-transform: uppercase;
  position: relative; z-index: 2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 88%;
}
.sb-wing.sb-wl .sb-team { color: #1A3A6B; }
.sb-wing.sb-wr .sb-team { color: #1A6B3A; }

/* SHIELD */
.sb-shield {
  flex-shrink: 0; width: 94px; z-index: 20;
  display: flex; flex-direction: column; align-items: center;
  margin: 0 -1px;
}
.sb-shield-body {
  width: 90px; height: 66px;
  background: linear-gradient(160deg,#f0efea,#e0deda 40%,#cac8c2);
  border: 2.5px solid #C9A84C;
  border-bottom: none;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  box-shadow: 0 6px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.8);
}
.sb-shield-body::before {
  content:''; position:absolute; inset:5px 5px 0 5px;
  border:1px solid rgba(201,168,76,.28);
}
.sb-tip { display:block; width:94px; height:24px; margin-left:-2px; }

/* VS */
.sb-vs {
  font-size: 36px; font-weight: 900; font-style: italic; line-height: 1;
  background: linear-gradient(180deg,#F5E080,#C9A84C 45%,#8B6914);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,.55));
  transition: opacity .35s ease;
}

/* SCORE BLOCK */
.sb-scorebox {
  display:flex; flex-direction:column; align-items:center; gap:2px;
  opacity: 0; transition: opacity .35s ease;
}
.sb-scorebox.sb-show-score { opacity:1; }
.sb-timebar {
  background: rgba(0,0,0,.48);
  border: 1.5px solid rgba(255,255,255,.22);
  border-radius: 3px;
  padding: 2px 9px 1px;
  display:flex; align-items:center; gap:5px;
}
.sb-dot {
  width:7px; height:7px; border-radius:50%;
  background:#ff3322; box-shadow:0 0 6px #ff4433;
  animation: sbpulse 1s ease-in-out infinite;
}
@keyframes sbpulse { 0%,100%{opacity:1} 50%{opacity:.15} }
.sb-time-txt {
  font-family:'Barlow',sans-serif;
  font-size:13px; font-weight:800; color:#fff; letter-spacing:3px;
}
.sb-score-txt {
  font-size:32px; font-weight:900; font-style:italic;
  letter-spacing:4px; line-height:1; color:#fff;
  text-shadow: 0 1px 0 rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.6);
}
`;

// ══════════════════════════════════════════════════════════════════
// CREAR DOM
// ══════════════════════════════════════════════════════════════════
function buildDOM() {
  // Estilos
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // Wrapper
  const sb = document.createElement('div');
  sb.id = 'campo-sb';
  sb.innerHTML = `
    <div class="sb-flag sb-fl"><img id="sb-img-home" src="" alt=""></div>
    <div class="sb-wing sb-wl"><span class="sb-team" id="sb-name-home">LOCAL</span></div>

    <div class="sb-shield">
      <div class="sb-shield-body">
        <span class="sb-vs" id="sb-vs">VS</span>
        <div class="sb-scorebox" id="sb-scorebox">
          <div class="sb-timebar">
            <span class="sb-dot"></span>
            <span class="sb-time-txt" id="sb-time">00:00</span>
          </div>
          <span class="sb-score-txt" id="sb-score">0 – 0</span>
        </div>
      </div>
      <svg class="sb-tip" viewBox="0 0 94 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,0 94,0 47,24" fill="#cac8c2"/>
        <polyline points="0,0 47,24 94,0" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    </div>

    <div class="sb-wing sb-wr"><span class="sb-team" id="sb-name-away">VISITA</span></div>
    <div class="sb-flag sb-fr"><img id="sb-img-away" src="" alt=""></div>
  `;

  const app = document.getElementById('app') || document.body;
  app.appendChild(sb);
  return sb;
}

// ══════════════════════════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════════════════════════
const S = {
  visible:     true,
  mode:        'preview',   // 'preview' | 'live'
  nameHome:    'LOCAL',
  nameAway:    'VISITA',
  logoHome:    '',
  logoAway:    '',
  scoreHome:   0,
  scoreAway:   0,
  clockBase:   0,           // segundos en el momento de la última sincronización
  clockRef:    Date.now(),  // timestamp de la última sincronización
  timerOn:     false,
  _timerInt:   null,
  _prevMode:   '',
};

// ── Timer local ───────────────────────────────────────────────────
function tickTimer() {
  if (!S.timerOn) return;
  const elapsed = Math.floor((Date.now() - S.clockRef) / 1000);
  const total   = S.clockBase + elapsed;
  const m = Math.floor(total / 60);
  const s = total % 60;
  const el = document.getElementById('sb-time');
  if (el) el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function startTimer() {
  if (S._timerInt) clearInterval(S._timerInt);
  S.timerOn    = true;
  S.clockRef   = Date.now();
  S._timerInt  = setInterval(tickTimer, 500);
}

function stopTimer() {
  S.timerOn = false;
  if (S._timerInt) { clearInterval(S._timerInt); S._timerInt = null; }
}

function syncClock(str) {
  if (!str) return;
  const parts = String(str).split(':');
  if (parts.length < 2) return;
  S.clockBase = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  S.clockRef  = Date.now();
  const el = document.getElementById('sb-time');
  if (el) el.textContent = str;
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  const sb = document.getElementById('campo-sb');
  if (!sb) return;

  // Visibilidad
  sb.classList.toggle('sb-show', S.visible);

  // Textos
  const elNH = document.getElementById('sb-name-home');
  const elNA = document.getElementById('sb-name-away');
  if (elNH) elNH.textContent = S.nameHome;
  if (elNA) elNA.textContent = S.nameAway;

  // Logos
  const imgH = document.getElementById('sb-img-home');
  const imgA = document.getElementById('sb-img-away');
  if (imgH && S.logoHome) imgH.src = S.logoHome;
  if (imgA && S.logoAway) imgA.src = S.logoAway;

  // Marcador
  const elSc = document.getElementById('sb-score');
  if (elSc) elSc.textContent = `${S.scoreHome} – ${S.scoreAway}`;

  // Cambio VS ↔ Live
  if (S.mode !== S._prevMode) {
    S._prevMode = S.mode;
    const vsEl  = document.getElementById('sb-vs');
    const scBox = document.getElementById('sb-scorebox');

    if (S.mode === 'live') {
      if (vsEl)  { vsEl.style.opacity = '0'; setTimeout(() => { vsEl.style.display = 'none'; }, 380); }
      if (scBox) { scBox.style.display = 'flex'; setTimeout(() => scBox.classList.add('sb-show-score'), 40); }
      startTimer();
    } else {
      if (scBox) { scBox.classList.remove('sb-show-score'); setTimeout(() => { scBox.style.display = 'none'; }, 380); }
      if (vsEl)  { vsEl.style.display = 'block'; setTimeout(() => { vsEl.style.opacity = '1'; }, 40); }
      stopTimer();
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// FIREBASE LISTENERS
// ══════════════════════════════════════════════════════════════════
function listenState() {
  onValue(ref(DB, `${BASE}/state`), snap => {
    const d = snap.val(); 
    
    // 👇 INICIO DEL CÓDIGO DE DEPURACIÓN 👇
    console.log(`📡 Consultando ruta: ${BASE}/state`);
    console.log("📦 Datos recibidos de Firebase:", d);
    
    if (!d) {
        console.warn("⚠️ ALERTA: Firebase devolvió null. La ruta no existe o está vacía.");
        return; 
    }
    // 👆 FIN DEL CÓDIGO DE DEPURACIÓN 👆

    S.nameHome = d.team_home_name || d.team_home || S.nameHome;
    S.nameAway = d.team_away_name || d.team_away || S.nameAway;

    // Logos — varios nombres de campo posibles
    S.nameAway = d.team_away_name || d.team_away || S.nameAway;

    // Logos — varios nombres de campo posibles
    S.logoHome = d.team_home_logo || d.logo_home  || d.home_logo  || d.team_home_shield || S.logoHome;
    S.logoAway = d.team_away_logo || d.logo_away  || d.away_logo  || d.team_away_shield || S.logoAway;

    if (d.score) {
      S.scoreHome = d.score.home ?? S.scoreHome;
      S.scoreAway = d.score.away ?? S.scoreAway;
    }

    if (d.clock) syncClock(d.clock);

    const st = (d.status || '').toLowerCase();
    if (st === 'live' || st === 'playing' || st === 'en_juego' ||
        st === 'halftime' || st === 'half_time' ||
        st === 'finished' || st === 'ended')   S.mode = 'live';
    else                                        S.mode = 'preview';

    render();
  });
}

function listenScoreNode() {
  // Listener aislado para cambios rápidos del marcador (goles)
  onValue(ref(DB, `${BASE}/state/score`), snap => {
    const d = snap.val(); if (!d) return;
    S.scoreHome = d.home ?? S.scoreHome;
    S.scoreAway = d.away ?? S.scoreAway;
    if (S.mode === 'preview' && (S.scoreHome > 0 || S.scoreAway > 0)) S.mode = 'live';
    render();
  });
}

function listenClockNode() {
  onValue(ref(DB, `${BASE}/state/clock`), snap => {
    const v = snap.val();
    if (v) syncClock(typeof v === 'string' ? v : String(v));
  });
}

function listenScoreboardControl() {
  // Nodo de control directo: permite mostrar/ocultar y cambiar modo desde Firebase
  onValue(ref(DB, `${BASE}/scoreboard`), snap => {
    const d = snap.val(); if (!d) return;

    if (typeof d.visible === 'boolean') S.visible = d.visible;
    if (d.mode === 'live' || d.mode === 'preview') S.mode = d.mode;
    if (typeof d.score_home === 'number') S.scoreHome = d.score_home;
    if (typeof d.score_away === 'number') S.scoreAway = d.score_away;
    if (d.clock)      syncClock(d.clock);
    if (d.name_home)  S.nameHome = d.name_home;
    if (d.name_away)  S.nameAway = d.name_away;
    if (d.logo_home)  S.logoHome = d.logo_home;
    if (d.logo_away)  S.logoAway = d.logo_away;

    render();
  });
}

// ══════════════════════════════════════════════════════════════════
// API PÚBLICA
// ══════════════════════════════════════════════════════════════════
window.Scoreboard = {
  show:     ()         => { S.visible = true;  render(); },
  hide:     ()         => { S.visible = false; render(); },
  setMode:  (m)        => { S.mode = m;        render(); },
  setScore: (h, a)     => { S.scoreHome = h; S.scoreAway = a; render(); },
  setClock: (str)      => syncClock(str),
  setTeams: (h, a)     => { S.nameHome = h; S.nameAway = a; render(); },
  setLogos: (h, a)     => { S.logoHome = h; S.logoAway = a; render(); },
};

// ══════════════════════════════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════════════════════════════
function init() {
  buildDOM();
  // Breve delay para que la animación de entrada sea visible
  setTimeout(() => {
    const sb = document.getElementById('campo-sb');
    if (sb) sb.classList.add('sb-show');
  }, 400);

  listenState();
  listenScoreNode();
  listenClockNode();
  listenScoreboardControl();

  console.log(`📊 Scoreboard → ${BASE}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
