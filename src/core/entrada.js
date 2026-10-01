import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const materialProxy = new THREE.MeshBasicMaterial();
materialProxy.userData.compartido = true;

class Puntero {
  constructor(tipo) {
    this.tipo = tipo; // 'xr' | 'raton'
    this.activo = false;
    this.fuente = null; // XRInputSource
    this.origen = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, -1);
    this.pasando = null;
    this.distancia = Infinity;
    this.agarrado = null;
    this.distAgarre = 0;
    this.desplAgarre = new THREE.Vector3();
    this.posInicial = new THREE.Vector3();
    this.presionado = 0;
  }

  vibrar(intensidad = 0.5, ms = 40) {
    this.fuente?.gamepad?.hapticActuators?.[0]?.pulse?.(intensidad, ms);
  }
}

/**
 * Sistema de apuntar y seleccionar unificado para mandos Touch, seguimiento de
 * manos (pellizco = seleccionar) y ratón/táctil en la vista previa.
 *
 * Un objeto interactivo se registra con:
 *   alPasar(activo, puntero)            → resaltar
 *   alSeleccionar(puntero)              → clic / gatillo / pellizco
 *   agarrable: true                     → se puede arrastrar
 *   alMoverAgarrado(puntero, posMundo)  → mientras se arrastra
 *   alSoltar(puntero, posMundo, movido) → al soltar (movido = metros recorridos)
 */
export class Entrada {
  constructor(app, audio) {
    this.app = app;
    this.audio = audio;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 25;
    this.infos = new Set();
    this.punteros = [];
    this._crearPunterosXR();
    this._crearPunteroRaton();
    app.alActualizar(() => this._actualizar());
  }

  registrar(obj, cfg = {}) {
    let objetivo = obj;
    if (cfg.proxy) {
      objetivo = crearProxy(obj);
      obj.add(objetivo);
    }
    const info = { obj, cfg, objetivo, habilitado: true };
    obj.userData.interactivo = info;
    objetivo.userData.duenoInteractivo = info;
    this.infos.add(info);
    return info;
  }

  desregistrar(obj) {
    const info = obj.userData.interactivo;
    if (!info) return;
    this.infos.delete(info);
    for (const p of this.punteros) {
      if (p.pasando === info) p.pasando = null;
      if (p.agarrado === info) p.agarrado = null;
    }
    delete obj.userData.interactivo;
  }

  habilitar(obj, habilitado) {
    const info = obj.userData.interactivo;
    if (!info) return;
    info.habilitado = habilitado;
    if (!habilitado) {
      for (const p of this.punteros) {
        if (p.pasando === info) this._pasar(p, null);
        if (p.agarrado === info) p.agarrado = null;
      }
    }
  }

  /** Suelta cualquier objeto agarrado sin disparar callbacks (cambio de escena). */
  reiniciar() {
    for (const p of this.punteros) {
      p.agarrado = null;
      p.pasando = null;
    }
  }

  _crearPunterosXR() {
    const { renderer } = this.app;
    const fabricaMandos = new XRControllerModelFactory();
    const fabricaManos = new XRHandModelFactory();

    for (let i = 0; i < 2; i++) {
      const p = new Puntero('xr');
      const control = renderer.xr.getController(i);
      this.app.rig.add(control);

      const rayo = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
      );
      rayo.scale.z = 3;
      control.add(rayo);
      p.rayo = rayo;
      p.objeto = control;

      control.addEventListener('connected', (e) => {
        p.activo = true;
        p.fuente = e.data;
      });
      control.addEventListener('disconnected', () => {
        this._pasar(p, null);
        p.activo = false;
        p.fuente = null;
        p.agarrado = null;
        p.presionado = 0;
      });
      control.addEventListener('selectstart', () => this._presionar(p));
      control.addEventListener('selectend', () => this._liberar(p));
      // El botón lateral (grip) también sirve para agarrar: a los niños les resulta natural.
      control.addEventListener('squeezestart', () => this._presionar(p));
      control.addEventListener('squeezeend', () => this._liberar(p));

      const agarre = renderer.xr.getControllerGrip(i);
      agarre.add(fabricaMandos.createControllerModel(agarre));
      this.app.rig.add(agarre);

      const mano = renderer.xr.getHand(i);
      mano.add(fabricaManos.createHandModel(mano, 'mesh'));
      this.app.rig.add(mano);

      p.cursor = crearCursor();
      this.app.escena.add(p.cursor);
      this.punteros.push(p);
    }
  }

  _crearPunteroRaton() {
    const p = new Puntero('raton');
    p.cursor = crearCursor();
    this.app.escena.add(p.cursor);
    this.punteros.push(p);
    this.raton = p;

    const lienzo = this.app.renderer.domElement;
    const ndc = new THREE.Vector2();
    let mirando = null;
    this._ndc = ndc;

    const actualizarNdc = (e) => {
      const r = lienzo.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    lienzo.addEventListener('pointermove', (e) => {
      actualizarNdc(e);
      p.activo = !this.app.enVR && this.habilitarRaton;
      if (mirando && !p.agarrado) {
        const cam = this.app.camara;
        cam.rotation.y += (e.clientX - mirando.x) * 0.004;
        cam.rotation.x = THREE.MathUtils.clamp(cam.rotation.x + (e.clientY - mirando.y) * 0.004, -1.2, 1.2);
        mirando = { x: e.clientX, y: e.clientY };
      }
    });
    lienzo.addEventListener('pointerdown', (e) => {
      if (this.app.enVR || !this.habilitarRaton) return;
      actualizarNdc(e);
      p.activo = true;
      this._calcularRayo(p);
      this._pasar(p, this._lanzar(p));
      lienzo.setPointerCapture(e.pointerId);
      if (p.pasando) this._presionar(p);
      else mirando = { x: e.clientX, y: e.clientY };
    });
    const terminar = () => {
      mirando = null;
      if (p.presionado) this._liberar(p);
    };
    lienzo.addEventListener('pointerup', terminar);
    lienzo.addEventListener('pointercancel', terminar);
    lienzo.addEventListener('pointerleave', () => {
      if (!p.agarrado) {
        this._pasar(p, null);
        p.activo = false;
      }
    });
    this.habilitarRaton = false;
  }

  _calcularRayo(p) {
    if (p.tipo === 'raton') {
      this.raycaster.setFromCamera(this._ndc, this.app.camara);
      p.origen.copy(this.raycaster.ray.origin);
      p.dir.copy(this.raycaster.ray.direction);
    } else {
      const m = p.objeto.matrixWorld;
      p.origen.setFromMatrixPosition(m);
      p.dir.set(0, 0, -1).transformDirection(m);
    }
  }

  _lanzar(p) {
    this.raycaster.set(p.origen, p.dir);
    const objetivos = [];
    for (const info of this.infos) {
      if (info.habilitado && esVisible(info.obj)) objetivos.push(info.objetivo);
    }
    const hits = this.raycaster.intersectObjects(objetivos, true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !o.userData.duenoInteractivo) o = o.parent;
      if (o) {
        p.distancia = hit.distance;
        p.puntoHit = hit.point;
        return o.userData.duenoInteractivo;
      }
    }
    p.distancia = Infinity;
    return null;
  }

  _pasar(p, info) {
    if (p.pasando === info) return;
    p.pasando?.cfg.alPasar?.(false, p);
    p.pasando = info;
    if (p.rayo) {
      p.rayo.material.color.set(info ? '#ffd54f' : '#ffffff');
      p.rayo.material.opacity = info ? 0.95 : 0.45;
    }
    p.cursor.material.color.set(info ? '#ffd54f' : '#ffffff');
    if (info) {
      info.cfg.alPasar?.(true, p);
      p.vibrar(0.15, 12);
      this.audio.tic();
    }
  }

  _presionar(p) {
    if (++p.presionado > 1) return;
    const info = p.pasando;
    if (!info || !info.habilitado) return;
    p.vibrar(0.6, 40);
    if (info.cfg.agarrable) {
      const posObj = info.obj.getWorldPosition(new THREE.Vector3());
      p.agarrado = info;
      p.distAgarre = p.distancia;
      p.posInicial.copy(posObj);
      p.desplAgarre.copy(posObj).sub(p.puntoHit);
      info.cfg.alAgarrar?.(p);
      this.audio.agarrar();
    } else {
      info.cfg.alSeleccionar?.(p);
    }
  }

  _liberar(p) {
    if (p.presionado === 0) return;
    if (--p.presionado > 0) return;
    const info = p.agarrado;
    if (!info) return;
    p.agarrado = null;
    const pos = info.obj.getWorldPosition(new THREE.Vector3());
    info.cfg.alSoltar?.(p, pos, pos.distanceTo(p.posInicial));
  }

  _actualizar() {
    const enVR = this.app.enVR;
    for (const p of this.punteros) {
      const usable = p.activo && (p.tipo === 'xr' ? enVR : !enVR);
      if (p.rayo) p.rayo.visible = usable && !p.suspendido;
      if (!usable || p.suspendido) {
        // suspendido: el mando está apuntando un teletransporte
        if (p.suspendido) this._pasar(p, null);
        p.cursor.visible = false;
        continue;
      }
      this._calcularRayo(p);

      if (p.agarrado) {
        const obj = p.agarrado.obj;
        const destino = p.origen.clone().addScaledVector(p.dir, p.distAgarre).add(p.desplAgarre);
        obj.position.copy(obj.parent.worldToLocal(destino.clone()));
        p.agarrado.cfg.alMoverAgarrado?.(p, destino);
        p.cursor.visible = false;
        if (p.rayo) p.rayo.scale.z = p.distAgarre;
        continue;
      }

      this._pasar(p, this._lanzar(p));
      if (p.pasando) {
        p.cursor.visible = true;
        p.cursor.position.copy(p.puntoHit).addScaledVector(p.dir, -0.004);
        p.cursor.lookAt(p.origen);
        const escala = THREE.MathUtils.clamp(p.distancia, 0.4, 3) * (1 + Math.sin(this.app.tiempo * 8) * 0.15);
        p.cursor.scale.setScalar(escala);
        if (p.rayo) p.rayo.scale.z = p.distancia;
      } else {
        p.cursor.visible = false;
        if (p.rayo) p.rayo.scale.z = 3;
      }
    }
  }
}

function crearCursor() {
  const cursor = new THREE.Mesh(
    new THREE.RingGeometry(0.006, 0.011, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }),
  );
  cursor.renderOrder = 999;
  cursor.visible = false;
  return cursor;
}

function esVisible(obj) {
  let o = obj;
  while (o) {
    if (!o.visible) return false;
    if (o.isScene) return true;
    o = o.parent;
  }
  return false;
}

/** Caja invisible que envuelve el objeto: el rayo prueba 12 triángulos en vez de cientos. */
function crearProxy(obj) {
  const caja = cajaLocal(obj);
  const tam = caja.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.06, 0.06, 0.06));
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(tam.x, tam.y, tam.z), materialProxy);
  caja.getCenter(proxy.position);
  proxy.visible = false;
  return proxy;
}

export function cajaLocal(obj) {
  obj.updateMatrixWorld(true);
  const inversa = obj.matrixWorld.clone().invert();
  const caja = new THREE.Box3();
  const tmp = new THREE.Box3();
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
    caja.union(tmp);
  });
  if (caja.isEmpty()) caja.set(new THREE.Vector3(-0.05, -0.05, -0.05), new THREE.Vector3(0.05, 0.05, 0.05));
  return caja;
}
