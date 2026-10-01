import * as THREE from 'three';
import { crearModelo } from '../mundo/prefabs/index.js';
import { liberar } from '../mundo/materiales.js';
import { crearBoton, crearEtiqueta } from '../ui/componentes.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';

let texturaHalo = null;

/**
 * Base de todas las escenas. `m` es el motor: { app, entrada, audio, fx, t, leccion }.
 * Sistema de coordenadas de `raiz`: el usuario está en el origen mirando a -Z,
 * `this.H` es la altura de sus ojos (se adapta a si está sentado o de pie).
 */
export class EscenaBase {
  constructor(m, datos, indice, total) {
    this.m = m;
    this.datos = datos;
    this.indice = indice;
    this.total = total;
    this.raiz = new THREE.Group();
    this.H = m.app.alturaOjos;
    this._interactivos = [];
    this._quitar = [];
    this._terminada = false;
    this._presentaciones = [];
    this.alTerminar = null;
  }

  construir() {}

  /** Se llama cuando termina el fundido: aquí aparecen los objetos marcados con presentar(). */
  iniciar() {
    for (const { obj, retardo, sonido } of this._presentaciones) {
      this.m.fx.aparecer(obj, 0.5, retardo);
      if (sonido) this.m.fx.tween({ duracion: 0.01, retardo }).then(() => !this._destruida && this.m.audio.burbuja(this.posMundo(obj)));
    }
    this._presentaciones = [];
  }

  terminar() {
    if (this._terminada) return;
    this._terminada = true;
    this.alTerminar?.();
  }

  destruir() {
    this._destruida = true;
    for (const obj of this._interactivos) this.m.entrada.desregistrar(obj);
    for (const quitar of this._quitar) quitar();
    this.m.audio.callar();
    liberar(this.raiz);
    this.raiz.removeFromParent();
  }

  // ── Utilidades para las escenas ───────────────────────────────────────────

  get t() {
    return this.m.t;
  }

  /** Oculta el objeto y lo hace aparecer con un rebote al empezar la escena (en cascada según el retardo). */
  presentar(obj, retardo = 0, sonido = false) {
    obj.userData.escalaAparecer = obj.scale.x || 1;
    obj.scale.setScalar(0.001);
    this._presentaciones.push({ obj, retardo, sonido });
    return obj;
  }

  /**
   * Hace que los objetos giren suavemente para mirar al usuario (solo en el eje
   * vertical). Así siguen de frente aunque el estudiante se mueva por la escena.
   * Los objetos con userData.fijo = true no giran.
   */
  mirarAlUsuario(objetos) {
    const cabeza = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const q0 = new THREE.Quaternion();
    this.cadaCuadro((dt) => {
      this.m.app.camara.getWorldPosition(cabeza);
      const k = 1 - Math.exp(-dt * 5);
      for (const o of objetos) {
        if (o.userData.fijo || !o.parent) continue;
        o.getWorldPosition(pos);
        q0.copy(o.quaternion);
        o.lookAt(cabeza.x, pos.y, cabeza.z);
        o.quaternion.copy(q0.slerp(o.quaternion, k));
      }
    });
  }

  /**
   * Resplandor circular detrás de un objeto. Brilla y late cuando
   * userData.encendido = true (al apuntarlo).
   */
  halo(tam, color = COLORES.amarillo) {
    if (!texturaHalo) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      texturaHalo = new THREE.CanvasTexture(c);
      texturaHalo.userData.compartido = true;
    }
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(tam, tam),
      new THREE.MeshBasicMaterial({ map: texturaHalo, color, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.cadaCuadro((dt, t) => {
      const meta = halo.userData.encendido ? 0.75 + Math.sin(t * 6) * 0.15 : 0.12;
      halo.material.opacity += (meta - halo.material.opacity) * Math.min(1, dt * 8);
      halo.scale.setScalar(halo.userData.encendido ? 1.15 : 1);
    });
    return halo;
  }

  /**
   * Objetos de decorado propios de la escena (p. ej. el prototipo junto al bebedero).
   * Cada uno: { modelo, posicion: [x, y, z], rotacion?: grados, tamano?, opciones? }.
   * Sin "tamano" se usa el tamaño real del modelo con su base en "posicion".
   */
  colocarUtileria(lista = []) {
    for (const u of lista) {
      const normalizar = u.tamano !== undefined;
      const obj = this.modelo(u.modelo, { ...u.opciones, normalizar, tamano: u.tamano ?? 0.3 });
      const [x = 0, y = 0, z = -1.5] = u.posicion ?? [];
      obj.position.set(x, y, z);
      obj.rotation.y = THREE.MathUtils.degToRad(u.rotacion ?? 0);
      this.raiz.add(obj);
      this.presentar(obj, 0.2);
    }
  }

  /** Balanceo suave de flotación (sobre el hijo, para no chocar con los movimientos del nodo). */
  flotar(obj, amplitud = 0.012) {
    const fase = Math.random() * Math.PI * 2;
    this.cadaCuadro((_dt, t) => {
      if (!obj.userData.quieto) obj.position.y = Math.sin(t * 1.4 + fase) * amplitud;
    });
  }

  cadaCuadro(fn) {
    this._quitar.push(this.m.app.alActualizar(fn));
  }

  interactivo(obj, cfg) {
    this.m.entrada.registrar(obj, cfg);
    this._interactivos.push(obj);
    return obj;
  }

  /** Botón que se ilumina al apuntarlo y ejecuta `accion` al seleccionarlo. */
  boton(texto, accion, opciones = {}) {
    const b = crearBoton({ texto, ...opciones });
    this.interactivo(b, {
      alPasar: (v) => b.setEncima(v),
      alSeleccionar: (p) => {
        this.m.audio.pop(b.getWorldPosition(new THREE.Vector3()));
        this.m.fx.latido(b, 0.08);
        accion(p);
      },
    });
    return b;
  }

  /** Modelo del catálogo con su animación ya conectada. */
  modelo(nombre, opciones = {}) {
    const obj = crearModelo(nombre, opciones);
    const animaciones = [];
    obj.traverse((o) => o.userData.animar && animaciones.push(o.userData.animar));
    if (animaciones.length) this.cadaCuadro((_dt, t) => animaciones.forEach((a) => a(t)));
    return obj;
  }

  etiqueta(texto, opciones) {
    return crearEtiqueta(texto, opciones);
  }

  /** Coloca `obj` en un arco alrededor del usuario y lo orienta hacia él. */
  enArco(obj, angulo, radio, y) {
    obj.position.set(Math.sin(angulo) * radio, y, -Math.cos(angulo) * radio);
    obj.lookAt(0, y, 0);
    return obj;
  }

  narrar(texto) {
    if (this.m.leccion.narracion) this.m.audio.narrar(texto, this.m.leccion.idioma);
  }

  /**
   * Panel de encabezado estándar: parte X de N, título, instrucción y una zona
   * de mensajes (retroalimentación) que se actualiza con `mensaje()`.
   */
  encabezado({ instruccion = '', ancho = 1.6, alto = 0.48, y = this.H + 0.47, z = -1.85, conMensajes = true } = {}) {
    const estado = { instruccion, mensaje: '', colorMensaje: COLORES.texto, derecha: '' };
    const titulo = this.datos.titulo ?? '';
    const panel = new PanelLienzo(ancho, alto, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 44 });
      pastilla(ctx, this.t('escenaDe', { n: this.indice + 1, total: this.total }), 40, 30, { tam: 30 });
      if (estado.derecha) {
        ctx.font = fuente(30, 700);
        const ancho = ctx.measureText(estado.derecha).width + 36;
        pastilla(ctx, estado.derecha, w - 40 - ancho, 30, { tam: 30, fondo: '#fff4d6' });
      }
      escribir(ctx, titulo, 44, 94, { tam: 58, peso: 800, maxAncho: w - 88, maxAlto: 78 });
      const yMsg = h - 136;
      const finInstruccion = conMensajes ? yMsg - 8 : h - 30;
      escribir(ctx, estado.instruccion, 44, 174, { tam: 38, tamMin: 30, color: COLORES.suave, maxAncho: w - 88, maxAlto: finInstruccion - 174 });
      if (estado.mensaje) {
        ctx.fillStyle = estado.colorMensaje + '22';
        ctx.beginPath();
        ctx.roundRect(28, yMsg, w - 56, 104, 26);
        ctx.fill();
        escribir(ctx, estado.mensaje, 50, yMsg + 52, { tam: 38, tamMin: 28, peso: 700, color: estado.colorMensaje, maxAncho: w - 100, maxAlto: 96, base: 'middle', interlineado: 1.15 });
      }
    });
    panel.position.set(0, y, z);
    panel.lookAt(0, this.H, 0);
    this.presentar(panel);
    panel.mensaje = (texto, color = COLORES.texto) => {
      estado.mensaje = texto;
      estado.colorMensaje = color;
      panel.redibujar();
    };
    panel.instruccion = (texto) => {
      estado.instruccion = texto;
      panel.redibujar();
    };
    panel.derecha = (texto) => {
      estado.derecha = texto;
      panel.redibujar();
    };
    this.raiz.add(panel);
    return panel;
  }

  /** Botón "Continuar" que aparece con una animación. */
  mostrarContinuar(posicion = new THREE.Vector3(0, this.H - 0.05, -1.45)) {
    if (this._continuar) return;
    this._continuar = this.boton(this.t('continuar'), () => this.terminar(), { ancho: 0.5, alto: 0.14, color: COLORES.verde });
    this._continuar.position.copy(posicion);
    this._continuar.lookAt(0, this.H, 0);
    this.raiz.add(this._continuar);
    this.m.fx.aparecer(this._continuar);
  }

  posMundo(obj) {
    return obj.getWorldPosition(new THREE.Vector3());
  }
}
