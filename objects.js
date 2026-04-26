// ══════════════════════════════════════════════════════════════════
// objects.js — Banderines, arcos y balón
// ══════════════════════════════════════════════════════════════════

const Objects = (() => {

  const { scene } = Scene;
  const { Y, FW, FH, GOAL_W, GOAL_H, GOAL_D } = Field;

// ── BANDERINES ───────────────────────────────────────────────────
  const flags = []; // <--- Arreglo para guardar las banderas

  function buildFlag(cx, cz, color) {
    const poleMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, emissive: 0x111111, shininess: 60 });
    
    // 1. Reducimos la altura del cilindro de 3.4 a 2.4
    const pole    = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.4, 8), poleMat);
    
    // 2. Ajustamos la posición Y del mástil para que siga tocando el suelo
    // (Mitad de 2.4 es 1.2. Originalmente era Y + 1.7 para un poste de 3.4)
    pole.position.set(cx, Y + 1.2, cz); 
    pole.castShadow = true;
    scene.add(pole);

    const fW = 1.1, fH = 0.72;
    const fGeo = new THREE.PlaneGeometry(fW, fH, 8, 4);
    const pos = fGeo.attributes.position;

    pos.setUsage(THREE.DynamicDrawUsage);
    
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + fW / 2);
    pos.needsUpdate = true;

    const fMat = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide, shininess: 30 });
    const flag = new THREE.Mesh(fGeo, fMat);
    
    // 3. Ajustamos la posición Y de la tela de la bandera
    // Originalmente estaba en Y + 3.1. Ahora lo bajamos para que quede arriba del nuevo mástil.
    flag.position.set(cx, Y + 2.1, cz); 
    flag.rotation.y = cx < 0 ? 0 : Math.PI;
    
    scene.add(flag);
    flags.push(flag); // <--- Guardamos la malla de la tela en el arreglo
  }

  buildFlag(-FW/2, -FH/2, 0xee2222);
  buildFlag(-FW/2,  FH/2, 0xee2222);
  buildFlag( FW/2, -FH/2, 0x2255ee);
  buildFlag( FW/2,  FH/2, 0x2255ee);
  // ── ARCOS ────────────────────────────────────────────────────────
  function buildGoal(side) {
    const xFace = side * (FW / 2);
    const xBack = xFace + side * GOAL_D;
    const hw    = GOAL_W / 2;
    const H     = GOAL_H;
    const postR = 0.11;

    const gMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x181818, shininess: 130 });

    function cyl(ax, ay, az, bx, by, bz, r = postR) {
      const dx = bx-ax, dy = by-ay, dz = bz-az;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (len < 0.001) return;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), gMat);
      m.position.set((ax+bx)/2, (ay+by)/2, (az+bz)/2);
      m.setRotationFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0,1,0),
          new THREE.Vector3(dx,dy,dz).normalize()
        )
      );
      m.castShadow = true; scene.add(m);
    }

    cyl(xFace, Y,    -hw, xFace, Y+H, -hw);
    cyl(xFace, Y,     hw, xFace, Y+H,  hw);
    cyl(xFace, Y+H, -hw,  xFace, Y+H,  hw, postR*0.9);

    function makeNetFace(p00, p10, p01, p11, sX, sY) {
      const count = (sX+1) * (sY+1);
      const verts = new Float32Array(count * 3);
      const uvs   = new Float32Array(count * 2);
      let idx = 0;
      for (let yi = 0; yi <= sY; yi++) {
        for (let xi = 0; xi <= sX; xi++) {
          const u = xi/sX, v = yi/sY;
          verts[idx*3]   = p00.x+(p10.x-p00.x)*u+(p01.x-p00.x)*v+(p11.x-p10.x-p01.x+p00.x)*u*v;
          verts[idx*3+1] = p00.y+(p10.y-p00.y)*u+(p01.y-p00.y)*v+(p11.y-p10.y-p01.y+p00.y)*u*v;
          verts[idx*3+2] = p00.z+(p10.z-p00.z)*u+(p01.z-p00.z)*v+(p11.z-p10.z-p01.z+p00.z)*u*v;
          uvs[idx*2] = u; uvs[idx*2+1] = v; idx++;
        }
      }
      const indices = [];
      for (let yi = 0; yi < sY; yi++) {
        for (let xi = 0; xi < sX; xi++) {
          const a = yi*(sX+1)+xi, b = a+1, c = a+(sX+1), d = c+1;
          indices.push(a,b,c, b,d,c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts.slice(), 3));
      geo.setAttribute('uv',       new THREE.BufferAttribute(uvs,           2));
      geo.setIndex(indices); geo.computeVertexNormals();
      const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.28 });
      const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
    }

    const V = THREE.Vector3;
    makeNetFace(new V(xFace,Y+H,-hw), new V(xFace,Y+H,hw), new V(xFace,Y,-hw), new V(xFace,Y,hw),   12, 8);
    makeNetFace(new V(xFace,Y+H,-hw), new V(xFace,Y+H,hw), new V(xBack,Y+H,-hw), new V(xBack,Y+H,hw), 12, 4);
    makeNetFace(new V(xFace,Y+H,-hw), new V(xBack,Y+H,-hw), new V(xFace,Y,-hw), new V(xBack,Y,-hw), 12, 8);
    makeNetFace(new V(xFace,Y+H,hw),  new V(xBack,Y+H,hw),  new V(xFace,Y,hw),  new V(xBack,Y,hw),  12, 8);
    makeNetFace(new V(xBack,Y+H,-hw), new V(xBack,Y+H,hw),  new V(xBack,Y,-hw), new V(xBack,Y,hw),  12, 8);
  }

  buildGoal(-1);
  buildGoal(1);

  // ── BALÓN ────────────────────────────────────────────────────────
 // ── BALÓN ────────────────────────────────────────────────────────
  const BALL_R = 1.2;

  const ballGroup = new THREE.Group();

  // ✨ FIX: Añadimos transparent: true para poder hacer el Fade Out
  const ballMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 160, specular: 0xbbbbbb, transparent: true, opacity: 1 });
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 32), ballMat);
  ballMesh.castShadow = true;
  ballGroup.add(ballMesh);

  // ✨ FIX: Añadimos transparent: true aquí también
  const patchMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 80, transparent: true, opacity: 1 });
  const phi = (1 + Math.sqrt(5)) / 2;
  [
    [0,1,phi],[0,-1,phi],[0,1,-phi],[0,-1,-phi],
    [1,phi,0],[-1,phi,0],[1,-phi,0],[-1,-phi,0],
    [phi,0,1],[phi,0,-1],[-phi,0,1],[-phi,0,-1],
  ].forEach(([nx,ny,nz]) => {
    const n = new THREE.Vector3(nx,ny,nz).normalize();
    const p = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 0.34, 5), patchMat);
    p.position.copy(n.clone().multiplyScalar(BALL_R + 0.01));
    p.lookAt(n.clone().multiplyScalar(2));
    ballGroup.add(p);
  });

  ballGroup.position.set(0, Y + BALL_R, 0);
  scene.add(ballGroup);

const ballShadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_R * 0.8, 20),
    // ✨ FIX: Subimos la opacidad a 0.45 para que cree un contraste fuerte contra el texto blanco
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }) 
  );
  ballShadow.rotation.x = -Math.PI / 2;
  
  // ✨ FIX: Y+0.05 lo pone físicamente por encima del Chevron. 
  // RenderOrder 6 le dice al motor gráfico que lo dibuje de último.
  ballShadow.position.y = Y + 0.05; 
  ballShadow.renderOrder = 6; 
  
  scene.add(ballShadow);

  // ── MOVIMIENTO DEL BALÓN ─────────────────────────────────────────
  const BALL_MOVE_THRESHOLD = 3.5;
  let ballTarget = new THREE.Vector3(0, Y + BALL_R, 0);
  let waypoints  = [];
// ─────────────────────────────────────────────────────────────────
  // ✨ FIX DEFINITIVO: Movimiento natural sin memoria residual
  // ─────────────────────────────────────────────────────────────────
  function moveBall(x, z) {
    // 1. Vaciamos la cola. El balón abandona cualquier viaje que estuviera haciendo.
    waypoints = [];
    
    // 2. Le damos el nuevo objetivo.
    // La función 'lerp' en el setInterval se encargará de hacerlo rodar 
    // suavemente desde donde sea que esté en este momento hacia el nuevo punto.
    ballTarget.set(x, Y + BALL_R, z);
  }

  // ✨ NUEVO: Función para teletransportar y limpiar el rastro cuando vuelve a aparecer
  function resetBallPath(x, z) {
    waypoints = [];
    ballTarget.set(x, Y + BALL_R, z);
    ballGroup.position.set(x, Y + BALL_R, z);
    ballShadow.position.set(x, ballShadow.position.y, z);
  }

// ══════════════════════════════════════════════════════════════════
  // ✨ MOTOR DE FÍSICA Y ANIMACIÓN DEL BALÓN (~60 FPS)
  // ══════════════════════════════════════════════════════════════════
  
  const BALL_REST_THRESHOLD = 0.5;
  const BALL_REST_SETTLE_MS = 200;
  let _lastMoveTime = 0;
  let _restTimer = 0;

  setInterval(() => {
    // 1. ESCUDO: Si hay animación de gol, pausamos la física normal
    if (window._bloqueoSecuencia) return; 

    const now = performance.now();

    // 2. SISTEMA DE WAYPOINTS
    if (waypoints.length > 0) {
      const dist = ballGroup.position.distanceTo(waypoints[0]);
      if (dist < 2.5) waypoints.shift();
      if (waypoints.length > 0) ballTarget.copy(waypoints[0]);
    }

    // 3. MOVIMIENTO SUAVE (Lerp)
    ballGroup.position.lerp(ballTarget, 0.08);

    // 4. ROTACIÓN FÍSICA
    const vel = ballTarget.clone().sub(ballGroup.position);
    
    if (vel.length() > 0.05) {
      // A) El balón está rodando por el césped
      const axis = new THREE.Vector3(0, 1, 0).cross(vel).normalize();
      const angle = vel.length() * 0.045; // Fricción mejorada
      ballGroup.rotateOnWorldAxis(axis, angle);
    } else {
      // B) Animación Inactiva (TV Broadcast Idle) - Gira suavemente cuando está detenido
      ballGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.010); 
      ballGroup.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), 0.003); 
    }

    // 5. SOMBRA SIGUE AL BALÓN
    ballShadow.position.x = ballGroup.position.x;
    ballShadow.position.z = ballGroup.position.z;

    // 6. DETECCIÓN DE ESTADO (Para avisar a otros módulos si está en movimiento)
    const distToTarget = ballGroup.position.distanceTo(ballTarget);

    if (distToTarget > BALL_REST_THRESHOLD) {
      _restTimer = 0;
      if (typeof _updateMovingState === 'function') _updateMovingState(true, now);
    } else {
      const sinceLastMove = now - _lastMoveTime;
      if (sinceLastMove > BALL_REST_SETTLE_MS) {
        if (typeof _updateMovingState === 'function') _updateMovingState(false, now);
      }
    }
  }, 16);
return { ballGroup, ballShadow, moveBall, resetBallPath, BALL_R, flags, ballMat, patchMat }; // Exportamos materiales
})();