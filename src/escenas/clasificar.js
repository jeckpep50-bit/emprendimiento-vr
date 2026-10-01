import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { PanelLienzo, COLORES, escribir } from '../ui/lienzo.js';
import { mat, malla } from '../mundo/materiales.js';

const PALETA = [COLORES.verde, COLORES.rojo, COLORES.primario, COLORES.morado];

export function barajar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Clasificar: arrastrar cada elemento a su caja (o tocar elemento y luego caja).
 * datos: { titulo, instruccion, categorias: [{ id, nombre, emoji?, color? }],
 *          elementos: [{ nombre, categoria, explicacion, pista?, modelo?, texto?, emoji?, tamano?, opciones? }] }
 */
export class EscenaClasificar extends EscenaBase {
  construir() {
    const { H } = this;
    this.elementos = barajar(this.datos.elementos ?? []);
    this.aciertos = 0;
    this.pendiente = null;

    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion || this.t('apuntaClasificar') });
    this.cabecera.derecha(`0 / ${this.elementos.length}`);

    const categorias = this.datos.categorias ?? [];
    const sep = categorias.length <= 2 ? 0.62 : 0.54;
    this.cajas = categorias.map((cat, k) => this._crearCaja(cat, (k - (categorias.length - 1) / 2) * sep, PALETA[k % PALETA.length]));
    this.cajas.forEach((caja, k) => this.presentar(caja, 0.15 + k * 0.15));

    const n = this.elementos.length;
    const filas = n > 5 ? 2 : 1;
    const porFila = Math.ceil(n / filas);
    const paso = THREE.MathUtils.degToRad(Math.min(24, 120 / Math.max(porFila - 1, 1)));
    const nodos = this.elementos.map((el, i) => {
      const fila = Math.floor(i / porFila);
      const col = i % porFila;
      const enFila = fila === filas - 1 ? n - porFila * fila : porFila;
      const nodo = this._crearElemento(el, (col - (enFila - 1) / 2) * paso, H - 0.02 - fila * 0.3);
      this.presentar(nodo, 0.5 + i * 0.1, true);
      return nodo;
    });
    this.mirarAlUsuario(nodos);
  }

  _crearCaja(cat, x, colorBase) {
    const { H } = this;
    const color = cat.color ?? colorBase;
    const caja = new THREE.Group();
    const m = mat(color);
    const [w, h, d, g] = [0.42, 0.16, 0.3, 0.015];
    caja.add(malla(new THREE.BoxGeometry(w, g, d), mat('#ffffff'), [0, g / 2, 0]));
    caja.add(malla(new THREE.BoxGeometry(w, h, g), m, [0, h / 2, -d / 2]));
    caja.add(malla(new THREE.BoxGeometry(w, h, g), m, [0, h / 2, d / 2]));
    caja.add(malla(new THREE.BoxGeometry(g, h, d), m, [-w / 2, h / 2, 0]));
    caja.add(malla(new THREE.BoxGeometry(g, h, d), m, [w / 2, h / 2, 0]));

    const cartel = new PanelLienzo(0.44, 0.13, (ctx, cw, ch) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(4, 4, cw - 8, ch - 8, 36);
      ctx.fill();
      if (caja.userData.resaltada) {
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      const texto = cat.emoji ? `${cat.emoji} ${cat.nombre}` : cat.nombre;
      escribir(ctx, texto, cw / 2, ch / 2, { tam: 46, tamMin: 26, peso: 800, color: '#ffffff', maxAncho: cw - 40, maxAlto: ch - 16, alinear: 'center', base: 'middle', interlineado: 1.1 });
    });
    cartel.position.set(0, h + 0.075, d / 2 + 0.01);
    cartel.rotation.x = -0.35;
    caja.add(cartel);

    caja.position.set(x, H - 0.64, -0.95);
    caja.lookAt(0, H - 0.64, 0);
    caja.userData.cat = cat;
    caja.userData.resaltar = (v) => {
      if (caja.userData.resaltada === v) return;
      caja.userData.resaltada = v;
      caja.scale.setScalar(v ? 1.08 : 1);
      cartel.redibujar();
    };
    this.raiz.add(caja);
    this.interactivo(caja, {
      proxy: true,
      alPasar: (v) => this.pendiente && caja.userData.resaltar(v),
      alSeleccionar: () => this.pendiente && this._evaluar(this.pendiente, caja),
    });
    return caja;
  }

  _crearElemento(el, angulo, y) {
    const nodo = new THREE.Group();
    const esTarjeta = !el.modelo || el.modelo === 'tarjeta';
    const modelo = esTarjeta
      ? this.modelo('tarjeta', { texto: el.texto ?? el.nombre, emoji: el.emoji, tamano: 0.3 })
      : this.modelo(el.modelo, { tamano: el.tamano ?? 0.2, ...el.opciones });
    nodo.add(modelo);
    let etiqueta = null;
    if (!esTarjeta) {
      etiqueta = this.etiqueta(el.nombre, { ancho: 0.3, alto: 0.065, tam: 30 });
      etiqueta.position.set(0, -modelo.userData.tam.y / 2 - 0.05, 0.02);
      nodo.add(etiqueta);
    }
    const halo = this.halo(esTarjeta ? 0.42 : 0.34, COLORES.amarillo);
    halo.position.z = -0.08;
    nodo.add(halo);
    this.enArco(nodo, angulo, 1.25, y);
    nodo.userData = { ...nodo.userData, el, etiqueta, origen: nodo.position.clone(), modelo };
    this.raiz.add(nodo);
    this.flotar(modelo);

    // Al arrastrar, el objeto se inclina según la velocidad (como si tuviera peso).
    const previa = new THREE.Vector3();
    const inclinacion = { x: 0, z: 0 };
    this.cadaCuadro((dt) => {
      const k = Math.min(1, dt * 10);
      modelo.rotation.z += (inclinacion.z - modelo.rotation.z) * k;
      modelo.rotation.x += (inclinacion.x - modelo.rotation.x) * k;
      inclinacion.x *= 0.9;
      inclinacion.z *= 0.9;
    });

    this.interactivo(nodo, {
      proxy: true,
      agarrable: true,
      alPasar: (v) => {
        if (nodo !== this.pendiente) modelo.scale.setScalar(v ? 1.1 : 1);
        halo.userData.encendido = v;
      },
      alAgarrar: () => {
        this._marcarPendiente(null);
        modelo.userData.quieto = true;
        modelo.scale.setScalar(1.15);
        nodo.getWorldPosition(previa);
      },
      alMoverAgarrado: (_p, pos) => {
        const vel = pos.clone().sub(previa);
        previa.copy(pos);
        inclinacion.z = THREE.MathUtils.clamp(-vel.x * 25, -0.6, 0.6);
        inclinacion.x = THREE.MathUtils.clamp(vel.z * 25, -0.5, 0.5);
        this._resaltarCaja(this._cajaBajo(pos));
      },
      alSoltar: (_p, pos, movido) => {
        modelo.userData.quieto = false;
        modelo.scale.setScalar(1);
        const caja = this._cajaBajo(pos);
        this._resaltarCaja(null);
        if (caja) this._evaluar(nodo, caja);
        else {
          this._volver(nodo);
          if (movido < 0.05) this._marcarPendiente(nodo);
        }
      },
    });
    return nodo;
  }

  _cajaBajo(pos) {
    let mejor = null;
    let dMin = 0.3;
    for (const caja of this.cajas) {
      const c = this.posMundo(caja);
      const d = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (d < dMin && pos.y < c.y + 0.5) {
        dMin = d;
        mejor = caja;
      }
    }
    return mejor;
  }

  _resaltarCaja(caja) {
    for (const c of this.cajas) c.userData.resaltar(c === caja);
  }

  _marcarPendiente(nodo) {
    const anterior = this.pendiente;
    if (anterior) {
      anterior.userData.modelo.scale.setScalar(1);
      anterior.userData.etiqueta?.actualizar({ fondo: 'rgba(255, 253, 247, 0.95)', color: COLORES.texto });
    }
    this.pendiente = nodo;
    if (!nodo) return;
    nodo.userData.modelo.scale.setScalar(1.18);
    nodo.userData.etiqueta?.actualizar({ fondo: COLORES.amarillo, color: COLORES.texto });
    this.cabecera.mensaje(this.t('elegido', { nombre: nodo.userData.el.nombre }), COLORES.primario);
  }

  _volver(nodo) {
    this.m.fx.moverA(nodo, nodo.userData.origen, 0.35);
  }

  _evaluar(nodo, caja) {
    const { el } = nodo.userData;
    this._marcarPendiente(null);
    this._resaltarCaja(null);
    const pos = this.posMundo(caja);

    if (el.categoria !== caja.userData.cat.id) {
      this.m.audio.error(pos);
      this.cabecera.mensaje(`🤔 ${el.pista || this.t('pistaGenerica')}`, COLORES.naranja);
      this._volver(nodo);
      this.m.fx.tween({ duracion: 0.35 }).then(() => !this._destruida && this.m.fx.sacudir(nodo));
      return;
    }

    this.m.entrada.habilitar(nodo, false);
    this.m.audio.acierto(pos);
    this.m.fx.confeti(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 30);
    this.cabecera.mensaje(`✅ ${this.t('correcto')} ${el.explicacion ?? ''}`, COLORES.verde);
    this.narrar(el.explicacion);
    // Salta dando una vuelta hasta el fondo de la caja, y la caja rebota al recibirlo.
    const dentro = caja.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.12, (Math.random() - 0.5) * 0.1));
    const inicio = nodo.position.clone();
    nodo.userData.movimiento?.cancelar();
    nodo.userData.fijo = true;
    nodo.userData.modelo.userData.quieto = true;
    this.m.fx.girar(nodo.userData.modelo, 0.6);
    this.m.fx.escalarA(nodo, 0.55, 0.6);
    this.m.fx
      .tween({
        duracion: 0.6,
        curva: suavizado.entradaSalida,
        alActualizar: (k) => {
          nodo.position.lerpVectors(inicio, dentro, k);
          nodo.position.y += Math.sin(k * Math.PI) * 0.2;
        },
      })
      .then(() => !this._destruida && this.m.fx.latido(caja, 0.12));
    nodo.userData.etiqueta && (nodo.userData.etiqueta.visible = false);

    this.aciertos++;
    this.cabecera.derecha(`${this.aciertos} / ${this.elementos.length}`);
    if (this.aciertos === this.elementos.length) {
      this.m.fx.tween({ duracion: 1.6 }).then(() => {
        if (this._destruida) return;
        this.m.audio.exito();
        this.m.fx.confeti(this.posMundo(this.cabecera).add(new THREE.Vector3(0, -0.4, 0.4)), 80);
        this.cabecera.mensaje(this.t('todoClasificado'), COLORES.verde);
        this.mostrarContinuar(new THREE.Vector3(0, this.H - 0.05, -1.35));
      });
    }
  }
}

