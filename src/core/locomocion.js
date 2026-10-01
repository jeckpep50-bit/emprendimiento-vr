import * as THREE from 'three';

const GIRO = THREE.MathUtils.degToRad(30);
const PASOS_ARCO = 48;
const PUNTOS_VISIBLES = 22;
const VELOCIDAD_ARCO = 6;
const GRAVEDAD = 9.8;

/**
 * Movimiento cómodo para VR (sin mareo):
 *  - Palanca hacia adelante: aparece un arco; al soltarla te teletransportas.
 *  - Palanca a los lados: giro por pasos de 30°.
 *  - Vista previa en el PC: WASD o flechas para caminar.
 * El movimiento queda limitado a un círculo alrededor del contenido de la escena
 * (app.limites) para que nadie se aleje de la actividad.
 */
export class Locomocion {
  constructor(app, entrada, audio, fx) {
    Object.assign(this, { app, entrada, audio, fx });
    this.estados = new Map();
    this._teclas = new Set();
    this._crearVisuales();
    window.addEventListener('keydown', (e) => this._teclas.add(e.code));
    window.addEventListener('keyup', (e) => this._teclas.delete(e.code));
    window.addEventListener('blur', () => this._teclas.clear());
    app.alActualizar((dt) => this._actualizar(dt));
  }

  _crearVisuales() {
    this.puntos = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.012, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.9 }),
      PUNTOS_VISIBLES,
    );
    this.puntos.frustumCulled = false;
    this.marca = new THREE.Group();
    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.22, 40), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.9 }));
    const disco = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.18, depthWrite: false }));
    const pulso = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.23, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
    for (const m of [anillo, disco, pulso]) m.rotation.x = -Math.PI / 2;
    anillo.position.y = disco.position.y = pulso.position.y = 0.01;
    this.marca.add(anillo, disco, pulso);
    this.pulso = pulso;
    this.puntos.visible = this.marca.visible = false;
    this.app.escena.add(this.puntos, this.marca);
    this._muestras = Array.from({ length: PASOS_ARCO + 1 }, () => new THREE.Vector3());
  }

  _estado(p) {
    let e = this.estados.get(p);
    if (!e) {
      e = { giroListo: true, apuntando: false, destino: new THREE.Vector3(), valido: false };
      this.estados.set(p, e);
    }
    return e;
  }

  _actualizar(dt) {
    if (this.app.enVR) this._actualizarVR();
    else if (this.entrada.habilitarRaton) this._actualizarTeclado(dt);
    if (this.marca.visible) {
      const k = (this.app.tiempo * 1.5) % 1;
      this.pulso.scale.setScalar(1 + k * 0.6);
      this.pulso.material.opacity = 0.6 * (1 - k);
    }
  }

  _actualizarVR() {
    let alguienApunta = false;
    for (const p of this.entrada.punteros) {
      if (p.tipo !== 'xr') continue;
      const ejes = p.fuente?.gamepad?.axes;
      const e = this._estado(p);
      if (!p.activo || !ejes || ejes.length < 2) {
        e.apuntando = false;
        p.suspendido = false;
        continue;
      }
      const x = ejes.length >= 4 ? ejes[2] : ejes[0];
      const y = ejes.length >= 4 ? ejes[3] : ejes[1];

      // Giro por pasos
      if (Math.abs(x) > 0.75 && Math.abs(y) < 0.6 && e.giroListo && !e.apuntando) {
        this.girar(-Math.sign(x) * GIRO);
        p.vibrar(0.3, 20);
        e.giroListo = false;
      } else if (Math.abs(x) < 0.3) {
        e.giroListo = true;
      }

      // Teletransporte
      if (y < -0.7 && !p.agarrado) e.apuntando = true;
      if (e.apuntando) {
        if (y > -0.3) {
          e.apuntando = false;
          if (e.valido) this.teletransportar(e.destino);
          p.vibrar(0.5, 30);
        } else {
          this._calcularArco(p, e);
          alguienApunta = true;
        }
      }
      p.suspendido = e.apuntando;
    }
    if (!alguienApunta) this.puntos.visible = this.marca.visible = false;
  }

  _calcularArco(p, e) {
    const v = p.dir.clone().multiplyScalar(VELOCIDAD_ARCO);
    const muestras = this._muestras;
    let n = 0;
    e.valido = false;
    for (let i = 0; i <= PASOS_ARCO; i++) {
      const t = i * 0.03;
      muestras[i].copy(p.origen).addScaledVector(v, t);
      muestras[i].y -= 0.5 * GRAVEDAD * t * t;
      n = i;
      if (muestras[i].y <= 0 && i > 0) {
        const a = muestras[i - 1];
        const b = muestras[i];
        const k = a.y / (a.y - b.y);
        b.lerpVectors(a, b, k);
        e.valido = true;
        break;
      }
    }
    if (e.valido) {
      // Mantiene el destino dentro del área de la actividad.
      const { centro, radio } = this.app.limites;
      const d = new THREE.Vector2(muestras[n].x - centro.x, muestras[n].z - centro.z);
      if (d.length() > radio) d.setLength(radio);
      e.destino.set(centro.x + d.x, 0, centro.z + d.y);
      this.marca.position.copy(e.destino);
    }

    const m = new THREE.Matrix4();
    for (let i = 0; i < PUNTOS_VISIBLES; i++) {
      const s = (i / (PUNTOS_VISIBLES - 1)) * n;
      const j = Math.floor(s);
      const q = new THREE.Vector3().lerpVectors(muestras[j], muestras[Math.min(j + 1, n)], s - j);
      m.makeTranslation(q.x, q.y, q.z);
      this.puntos.setMatrixAt(i, m);
    }
    this.puntos.instanceMatrix.needsUpdate = true;
    this.puntos.visible = true;
    this.marca.visible = e.valido;
  }

  /** Gira al usuario alrededor de su propia cabeza. */
  girar(angulo) {
    const { rig, camara } = this.app;
    const cabeza = camara.getWorldPosition(new THREE.Vector3());
    const desde = rig.position.clone().sub(cabeza);
    desde.applyAxisAngle(new THREE.Vector3(0, 1, 0), angulo);
    rig.position.copy(cabeza).add(desde);
    rig.rotation.y += angulo;
    this.audio.giro();
  }

  /** Lleva la cabeza del usuario (en el plano del suelo) hasta `destino`. */
  async teletransportar(destino) {
    const fin = destino.clone();
    this.audio.teletransporte();
    await this.fx.fundido(true, 0.1);
    const cabeza = this.app.camara.getWorldPosition(new THREE.Vector3());
    this.app.rig.position.x += fin.x - cabeza.x;
    this.app.rig.position.z += fin.z - cabeza.z;
    this.fx.fundido(false, 0.2);
  }

  _actualizarTeclado(dt) {
    const t = this._teclas;
    const adelante = (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0) - (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0);
    const lado = (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0);
    if (!adelante && !lado) return;
    const cam = this.app.camara;
    const dir = cam.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const derecha = new THREE.Vector3(-dir.z, 0, dir.x);
    const mov = dir.multiplyScalar(adelante).add(derecha.multiplyScalar(lado)).normalize().multiplyScalar(1.4 * dt);
    this.app.rig.position.add(mov);
    // Límite del área de la actividad
    const { centro, radio } = this.app.limites;
    const cabeza = cam.getWorldPosition(new THREE.Vector3());
    const d = new THREE.Vector2(cabeza.x - centro.x, cabeza.z - centro.z);
    if (d.length() > radio) {
      d.setLength(radio);
      this.app.rig.position.x += centro.x + d.x - cabeza.x;
      this.app.rig.position.z += centro.z + d.y - cabeza.z;
    }
  }
}
