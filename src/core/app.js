import * as THREE from 'three';

const ALTURA_ESCRITORIO = 1.3;

/**
 * Renderizador, escena, cámara y sesión WebXR.
 * El usuario está dentro de `rig`; en VR la pose de la cámara la pone el visor
 * (espacio de referencia `local-floor`, el suelo está en y = 0).
 */
export class App {
  constructor(contenedor) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    // Foveated rendering: menos píxeles en la periferia = más rendimiento en Quest.
    renderer.xr.setFoveation(1);
    contenedor.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);
    this.camara.rotation.order = 'YXZ';
    this.camara.position.set(0, ALTURA_ESCRITORIO, 0);
    this.rig = new THREE.Group();
    this.rig.add(this.camara);
    this.escena.add(this.rig);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.2);
    this.sol = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sol.position.set(2, 5, 3);
    this.escena.add(this.hemi, this.sol);

    this.alturaOjos = ALTURA_ESCRITORIO;
    // Área donde el usuario puede moverse (la fija cada escena al anclarse).
    this.limites = { centro: new THREE.Vector3(), radio: 2.3 };
    this.tiempo = 0;
    this._actualizadores = new Set();
    this._alReiniciarReferencia = new Set();
    this._alSalirVR = new Set();
    this._ultimo = performance.now();

    renderer.setAnimationLoop(() => this._cuadro());
    window.addEventListener('resize', () => this._redimensionar());
  }

  get enVR() {
    return this.renderer.xr.isPresenting;
  }

  /** Registra una función `(dt, t)` que se ejecuta cada cuadro. Devuelve la función para quitarla. */
  alActualizar(fn) {
    this._actualizadores.add(fn);
    return () => this._actualizadores.delete(fn);
  }

  alReiniciarReferencia(fn) {
    this._alReiniciarReferencia.add(fn);
  }

  alSalirVR(fn) {
    this._alSalirVR.add(fn);
  }

  static async vrDisponible() {
    try {
      return Boolean(navigator.xr) && (await navigator.xr.isSessionSupported('immersive-vr'));
    } catch {
      return false;
    }
  }

  async entrarVR() {
    const sesion = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking'],
    });
    await this.renderer.xr.setSession(sesion);
    sesion.addEventListener('end', () => {
      this.camara.position.set(0, ALTURA_ESCRITORIO, 0);
      this.rig.position.set(0, 0, 0);
      this.rig.rotation.set(0, 0, 0);
      this.alturaOjos = ALTURA_ESCRITORIO;
      for (const fn of this._alSalirVR) fn();
    });
    // Si el estudiante mantiene el botón Meta para recentrar, volvemos a anclar el contenido.
    this.renderer.xr.getReferenceSpace()?.addEventListener('reset', () => {
      for (const fn of this._alReiniciarReferencia) fn();
    });
    await this.esperarPose();
  }

  salirVR() {
    this.renderer.xr.getSession()?.end();
  }

  /** Espera unos cuadros para que el visor entregue una pose real antes de colocar contenido. */
  esperarPose(cuadros = 12) {
    return new Promise((resolver) => {
      let n = 0;
      const quitar = this.alActualizar(() => {
        if (++n >= cuadros) {
          quitar();
          resolver();
        }
      });
    });
  }

  /**
   * Coloca `grupo` delante del usuario: misma posición horizontal que la cabeza
   * y mirando hacia donde mira. También actualiza la altura de los ojos, así el
   * contenido queda cómodo tanto sentado como de pie.
   */
  anclarDelanteDelUsuario(grupo) {
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camara.getWorldPosition(pos);
    this.camara.getWorldDirection(dir);
    grupo.position.set(pos.x, 0, pos.z);
    grupo.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    // El área de movimiento se centra un poco por delante, entre el usuario y la actividad.
    const plano = dir.setY(0).normalize();
    this.limites.centro.set(pos.x + plano.x * 0.8, 0, pos.z + plano.z * 0.8);
    this.alturaOjos = THREE.MathUtils.clamp(this.enVR ? pos.y : ALTURA_ESCRITORIO, 0.9, 1.85);
  }

  _cuadro() {
    const ahora = performance.now();
    const dt = Math.min((ahora - this._ultimo) / 1000, 0.1);
    this._ultimo = ahora;
    this.tiempo += dt;
    for (const fn of this._actualizadores) fn(dt, this.tiempo);
    this.renderer.render(this.escena, this.camara);
  }

  _redimensionar() {
    if (this.enVR) return;
    this.camara.aspect = window.innerWidth / window.innerHeight;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
