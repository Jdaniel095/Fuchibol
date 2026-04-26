// ─────────────────────────────────────────────────────────────────────────────
// ball-trajectory.js — Progresivo, Grueso y con Fade-Out Suave
// ─────────────────────────────────────────────────────────────────────────────

let BallTrajectory = (() => {
    let clickPositions = []; 
    let staticMeshes = [];   // Memoria permanente para las líneas ya completadas
    let dynamicMesh = null;  // La línea viva que persigue al balón
let isActive = true;
    const LINE_COLOR = 0xFFFFFF; 
    const LINE_RADIUS = 0.20; 

    // --- FUNCIONES PRIVADAS ---

    // Crea un tubo grueso (Geometría 3D real)
    function createThickLine(pStart, pEnd, opacity) {
        if (pStart.distanceTo(pEnd) < 0.05) return null; 

        const path = new THREE.LineCurve3(pStart, pEnd);
        const geometry = new THREE.TubeGeometry(path, 1, LINE_RADIUS, 6, false);
        
        const material = new THREE.MeshBasicMaterial({
            color: LINE_COLOR,
            opacity: opacity,
            transparent: true,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 3; 
        
        if (typeof Scene !== 'undefined' && Scene.scene) {
            Scene.scene.add(mesh);
        }
        return mesh;
    }

    function drawLines() {
        if (clickPositions.length < 2) return;

        const alturaCesped = (typeof Field !== 'undefined' && Field.Y) ? (Field.Y + 0.15) : 0.85;
        const n = clickPositions.length;

        // 1. GESTIONAR LÍNEAS ESTÁTICAS (Fade-Out Suave)
        for (let i = 0; i < n - 2; i++) {
            const age = (n - 3) - i; 
            
            // Determinamos a qué opacidad debe llegar según su edad
            let targetOpacity = 0.0;
            if (age === 0) targetOpacity = 0.40;      // Última jugada
            else if (age === 1) targetOpacity = 0.10; // Penúltima
            else if (age === 2) targetOpacity = 0.05; // Memoria
            else targetOpacity = 0.00;                // Desaparición total

            let meshObj = staticMeshes[i];

            // Si el segmento no existe, lo creamos
            if (!meshObj) {
                const pStart = clickPositions[i];
                const pEnd = clickPositions[i + 1];
                // Lo creamos al 70% inicialmente para que la bajada a 40% sea animada
                const mesh = createThickLine(pStart, pEnd, 0.70);
                meshObj = { mesh: mesh, currentOpacity: 0.70 };
                staticMeshes[i] = meshObj;
            }

            // ✨ MAGIA: Transición suave cuadro por cuadro (Lerp)
            if (meshObj.mesh) {
                // Se acerca progresivamente a la opacidad destino (5% cada 30ms)
                meshObj.currentOpacity += (targetOpacity - meshObj.currentOpacity) * 0.05;
                meshObj.mesh.material.opacity = meshObj.currentOpacity;

                // Optimización: Si ya es invisible (0%), la ocultamos del motor 3D
                if (meshObj.currentOpacity < 0.01 && targetOpacity === 0) {
                    meshObj.mesh.visible = false;
                } else {
                    meshObj.mesh.visible = true;
                }
            }
        }

        // 2. ACTUALIZAR LÍNEA PROGRESIVA DINÁMICA
        // Como esta línea cambia de tamaño y dirección, la redibujamos
        if (dynamicMesh) {
            if (typeof Scene !== 'undefined' && Scene.scene) Scene.scene.remove(dynamicMesh);
            dynamicMesh.geometry.dispose();
            dynamicMesh.material.dispose();
            dynamicMesh = null;
        }

        if (typeof Objects !== 'undefined' && Objects.ballGroup && Objects.ballGroup.visible) {
            const currentStart = clickPositions[n - 2];
            const ballPos = Objects.ballGroup.position.clone();
            ballPos.y = alturaCesped; 
            
            dynamicMesh = createThickLine(currentStart, ballPos, 0.70); 
        }
    }

    // Bucle de renderizado (~30 FPS)
    setInterval(() => {
        if (clickPositions.length > 0 && !window._bloqueoSecuencia) {
            drawLines();
        }
    }, 30);

    // --- FUNCIONES PÚBLICAS ---

    function addPosition(x, z) {
        if (!isActive || typeof THREE === 'undefined') return; // ✨ FIX: Abortar si está apagado
        if (typeof THREE === 'undefined') return;
        const alturaCesped = (typeof Field !== 'undefined' && Field.Y) ? (Field.Y + 0.15) : 0.85;

        // Registrar inicio dinámico AHORA MISMO
        if (clickPositions.length === 0 && typeof Objects !== 'undefined' && Objects.ballGroup) {
            const origenX = Objects.ballGroup.position.x;
            const origenZ = Objects.ballGroup.position.z;
            
            if (Math.abs(origenX - x) > 0.5 || Math.abs(origenZ - z) > 0.5) {
                clickPositions.push(new THREE.Vector3(origenX, alturaCesped, origenZ));
            }
        }

        const newPoint = new THREE.Vector3(x, alturaCesped, z);
        clickPositions.push(newPoint);
    }

    function resetAndClear() {
        // Borrado profundo para evitar fugas de memoria
        if (typeof Scene !== 'undefined' && Scene.scene) {
            staticMeshes.forEach(obj => {
                if (obj && obj.mesh) {
                    Scene.scene.remove(obj.mesh);
                    if (obj.mesh.geometry) obj.mesh.geometry.dispose();
                    if (obj.mesh.material) obj.mesh.material.dispose();
                }
            });
            if (dynamicMesh) {
                Scene.scene.remove(dynamicMesh);
                if (dynamicMesh.geometry) dynamicMesh.geometry.dispose();
                if (dynamicMesh.material) dynamicMesh.material.dispose();
            }
        }
        
        staticMeshes = [];
        dynamicMesh = null;
        clickPositions = [];
    }
// 👇 ✨ NUEVA FUNCIÓN 👇
    function setActive(state) {
        isActive = state;
        if (!isActive) {
            resetAndClear(); // Si lo apagan, borramos todo inmediatamente
        }
    }

    return {
        addPosition: addPosition,
        clear: resetAndClear,
        setActive: setActive // ✨ NUEVO: Exportamos la función
    };
})();

window.BallTrajectory = BallTrajectory;