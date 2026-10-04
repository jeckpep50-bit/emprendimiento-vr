import * as THREE from 'three';
import { PanelLienzo, fuente } from '../ui/lienzo.js';

export const suavizado = {
  lineal: (t) => t,
  salida: (t) => 1 - (1 - t) ** 3,
  entradaSalida: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  rebote: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
};

const COLORES_CONFETI = ['#ff5a5f', '#ffc23c', '#2dbe78', '#4f7cff', '#b56cff', '#ff8fd1'];

/** Animaciones por código (tweens), confeti, sacudidas y fundido a negro. */
export class Efectos {
  constructor(app) {
    this.app = app;
    this.tweens = new Set();
    this._crearFundido();
    app.alActualizar((dt) => this._actualizar(dt));
  }

  tween({ duracion = 0.4, retardo = 0, alActualizar, alTerminar, curva = suavizado.salida, persistente = false }) {
    let resolver;
    const promesa = new Promise((r) => (resolver = r));
    const tw = { duracion, retardo, t: 0, alActualizar, curva, persistente, resolver, alTerminar };
    this.tweens.add(tw);
    // Permite detener una animación a medias (p. ej. un objeto que cambia de destino).
    promesa.cancelar = () => {
      this.tweens.delete(tw);
      resolver();
    };
    return promesa;
  }

  /** Mueve `obj` a `destino`; si ya se estaba moviendo, reemplaza el movimiento anterior. */
  moverA(obj, destino, duracion = 0.45, curva = suavizado.salida, retardo = 0) {
    obj.userData.movimiento?.cancelar();
    const inicio = obj.position.clone();
    const fin = destino.clone();
    const tw = this.tween({
      duracion,
      retardo,
      curva,
      alActualizar: (k) => obj.position.lerpVectors(inicio, fin, k),
    });
    obj.userData.movimiento = tw;
    return tw;
  }

  /** Gira `obj` una vuelta completa sobre su eje vertical. */
  girar(obj, duracion = 0.8) {
    const y0 = obj.rotation.y;
    return this.tween({ duracion, curva: suavizado.entradaSalida, alActualizar: (k) => (obj.rotation.y = y0 + k * Math.PI * 2) });
  }

  escalarA(obj, escala, duracion = 0.35, curva = suavizado.salida) {
    const inicio = obj.scale.x;
    return this.tween({ duracion, curva, alActualizar: (k) => obj.scale.setScalar(inicio + (escala - inicio) * k) });
  }

  aparecer(obj, duracion = 0.45, retardo = 0) {
    // Se recuerda la escala original: si se llama dos veces seguidas no queda "encogido".
    obj.userData.escalaAparecer ??= obj.scale.x > 0.01 ? obj.scale.x : 1;
    const final = obj.userData.escalaAparecer;
    obj.scale.setScalar(0.001);
    return this.tween({ duracion, retardo, curva: suavizado.rebote, alActualizar: (k) => obj.scale.setScalar(Math.max(0.001, final * k)) });
  }

  latido(obj, fuerza = 0.18) {
    // Si el objeto todavía está "apareciendo", se usa su escala final.
    obj.userData.escalaBase ??= obj.userData.escalaAparecer ?? obj.scale.x;
    const base = obj.userData.escalaBase;
    return this.tween({
      duracion: 0.45,
      curva: suavizado.lineal,
      alActualizar: (k) => obj.scale.setScalar(base * (1 + Math.sin(k * Math.PI) * fuerza)),
    });
  }

  sacudir(obj, amplitud = 0.035) {
    const x0 = obj.position.x;
    return this.tween({
      duracion: 0.4,
      curva: suavizado.lineal,
      alActualizar: (k) => (obj.position.x = x0 + Math.sin(k * Math.PI * 6) * amplitud * (1 - k)),
    });
  }

  /** Detiene todas las animaciones de la escena actual. */
  limpiar() {
    for (const tw of this.tweens) {
      if (!tw.persistente) {
        this.tweens.delete(tw);
        tw.resolver();
      }
    }
  }

  /**
   * Explosión de "píxeles": cubitos brillantes que salen disparados y se
   * desvanecen. Se usa cuando un microbio se desintegra.
   */
  pixeles(posMundo, color = '#7dff9a', cantidad = 40, radio = 0.6) {
    const geo = new THREE.BoxGeometry(0.012, 0.012, 0.012);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const malla = new THREE.InstancedMesh(geo, mat, cantidad);
    malla.frustumCulled = false;
    const piezas = Array.from({ length: cantidad }, () => ({
      p: posMundo.clone(),
      v: new THREE.Vector3().randomDirection().multiplyScalar(radio * (0.4 + Math.random())),
      s: 0.6 + Math.random() * 1.2,
    }));
    this.app.escena.add(malla);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Vector3();
    this.tween({
      duracion: 1.1,
      persistente: true,
      curva: suavizado.lineal,
      alActualizar: (k, dt) => {
        mat.opacity = 1 - k;
        piezas.forEach((pz, i) => {
          pz.v.multiplyScalar(0.94);
          pz.p.addScaledVector(pz.v, dt);
          e.setScalar(pz.s * (1 - k * 0.7));
          malla.setMatrixAt(i, m.compose(pz.p, q, e));
        });
        malla.instanceMatrix.needsUpdate = true;
      },
      alTerminar: () => {
        malla.removeFromParent();
        geo.dispose();
        mat.dispose();
        malla.dispose();
      },
    });
  }

  /** Texto que sube y se desvanece (p. ej. "+100" al ganar puntos). */
  textoFlotante(posMundo, texto, extra = '') {
    const panel = new PanelLienzo(0.36, 0.16, (ctx, w, h) => {
      ctx.lineJoin = 'round';
      ctx.font = fuente(78, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#1d1d27';
      ctx.strokeText(texto, w / 2, h * 0.42);
      ctx.fillStyle = '#ffc23c';
      ctx.fillText(texto, w / 2, h * 0.42);
      if (extra) {
        ctx.font = fuente(34, 800);
        ctx.lineWidth = 8;
        ctx.strokeText(extra, w / 2, h * 0.86);
        ctx.fillStyle = '#ff8a5c';
        ctx.fillText(extra, w / 2, h * 0.86);
      }
    }, { pxPorMetro: 900 });
    panel.material.depthTest = false;
    panel.renderOrder = 900;
    const inicio = posMundo.clone().add(new THREE.Vector3(0, 0.12, 0));
    panel.position.copy(inicio);
    panel.lookAt(this.app.camara.getWorldPosition(new THREE.Vector3()));
    this.app.escena.add(panel);
    this.tween({
      duracion: 1.3,
      persistente: true,
      curva: suavizado.salida,
      alActualizar: (k) => {
        panel.position.y = inicio.y + k * 0.3;
        panel.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        panel.scale.setScalar(k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1);
      },
      alTerminar: () => {
        panel.removeFromParent();
        panel.geometry.dispose();
        panel.textura.dispose();
        panel.material.dispose();
      },
    });
  }

  confeti(posMundo, cantidad = 50) {
    const geo = new THREE.PlaneGeometry(0.022, 0.012);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const malla = new THREE.InstancedMesh(geo, mat, cantidad);
    const color = new THREE.Color();
    const piezas = [];
    for (let i = 0; i < cantidad; i++) {
      malla.setColorAt(i, color.set(COLORES_CONFETI[i % COLORES_CONFETI.length]));
      const ang = Math.random() * Math.PI * 2;
      const vel = 0.6 + Math.random() * 1.2;
      piezas.push({
        p: posMundo.clone(),
        v: new THREE.Vector3(Math.cos(ang) * vel * 0.6, 1.2 + Math.random() * 1.4, Math.sin(ang) * vel * 0.6),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
        w: (Math.random() - 0.5) * 16,
      });
    }
    this.app.escena.add(malla);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    this.tween({
      duracion: 1.8,
      persistente: true,
      curva: suavizado.lineal,
      alActualizar: (_k, dt) => {
        piezas.forEach((pz, i) => {
          pz.v.y -= 3.2 * dt;
          pz.v.multiplyScalar(0.985);
          pz.p.addScaledVector(pz.v, dt);
          pz.r.x += pz.w * dt;
          pz.r.y += pz.w * 0.7 * dt;
          malla.setMatrixAt(i, m.compose(pz.p, q.setFromEuler(pz.r), s));
        });
        malla.instanceMatrix.needsUpdate = true;
      },
      alTerminar: () => {
        malla.removeFromParent();
        geo.dispose();
        mat.dispose();
        malla.dispose();
      },
    });
  }

  /** Fundido a negro alrededor de la cabeza: hace cómodos los cambios de escena en VR. */
  fundido(aNegro, duracion = 0.35) {
    const mat = this._fundido.material;
    const desde = mat.opacity;
    const hasta = aNegro ? 1 : 0;
    this._fundido.visible = true;
    return this.tween({
      duracion,
      persistente: true,
      curva: suavizado.lineal,
      alActualizar: (k) => (mat.opacity = desde + (hasta - desde) * k),
      alTerminar: () => (this._fundido.visible = aNegro),
    });
  }

  _crearFundido() {
    this._fundido = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x05070d, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }),
    );
    this._fundido.renderOrder = 1000;
    this._fundido.visible = false;
    this.app.camara.add(this._fundido);
  }

  _actualizar(dt) {
    for (const tw of this.tweens) {
      if (tw.retardo > 0) {
        tw.retardo -= dt;
        continue;
      }
      tw.t = Math.min(tw.t + dt / tw.duracion, 1);
      tw.alActualizar?.(tw.curva(tw.t), dt);
      if (tw.t >= 1) {
        this.tweens.delete(tw);
        tw.alTerminar?.();
        tw.resolver();
      }
    }
  }
}
