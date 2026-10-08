import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';
import { mat, malla, fusionar } from '../mundo/materiales.js';

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
 *          elementos: [{ nombre, categoria, explicacion, pista?, modelo?, texto?, emoji?, tamano?, opciones? }],
 *          tablero?: { columnas?, centro?: { emoji, texto }, ejeX?, ejeY? } }
 * Con "tablero", las categorías son zonas de un tablero grande al frente (p. ej. un
 * mapa de empatía o una matriz 2×2) y los elementos esperan a los lados.
 */
export class EscenaClasificar extends EscenaBase {
  construir() {
    const { H } = this;
    this.elementos = barajar(this.datos.elementos ?? []);
    this.aciertos = 0;
    this.pendiente = null;

    const conTablero = Boolean(this.datos.tablero);
    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion || this.t('apuntaClasificar'), y: conTablero ? H + 0.68 : undefined });
    this.cabecera.derecha(`0 / ${this.elementos.length}`);

    const categorias = this.datos.categorias ?? [];
    if (conTablero) {
      this._crearTablero(categorias);
      const nodos = this.elementos.map((el, i) => {
        // Mitad a cada lado del tablero, en columnas de hasta 3.
        const lado = i % 2 ? 1 : -1;
        const k = Math.floor(i / 2);
        const angulo = lado * THREE.MathUtils.degToRad(44 + Math.floor(k / 3) * 19);
        const nodo = this._crearElemento(el, angulo, H + 0.2 - (k % 3) * 0.29);
        this.presentar(nodo, 0.5 + i * 0.08, true);
        return nodo;
      });
      this.mirarAlUsuario(nodos);
      return;
    }
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
    // Fondo y paredes fusionados en pocas mallas (menos trabajo para las Quest 2)
    const cuerpo = new THREE.Group();
    cuerpo.add(malla(new THREE.BoxGeometry(w, g, d), mat('#ffffff'), [0, g / 2, 0]));
    cuerpo.add(malla(new THREE.BoxGeometry(w, h, g), m, [0, h / 2, -d / 2]));
    cuerpo.add(malla(new THREE.BoxGeometry(w, h, g), m, [0, h / 2, d / 2]));
    cuerpo.add(malla(new THREE.BoxGeometry(g, h, d), m, [-w / 2, h / 2, 0]));
    cuerpo.add(malla(new THREE.BoxGeometry(g, h, d), m, [w / 2, h / 2, 0]));
    caja.add(fusionar(cuerpo));

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

  /** Tablero con una zona por categoría (en cuadrícula) y, opcionalmente, un centro y ejes. */
  _crearTablero(categorias) {
    const { H } = this;
    const cfg = this.datos.tablero;
    const columnas = cfg.columnas ?? 2;
    const filas = Math.ceil(categorias.length / columnas);
    const [W, A] = [1.72, 0.98];
    this.tablero = new THREE.Group();
    const maxPorZona = Math.max(...categorias.map((c) => (this.datos.elementos ?? []).filter((el) => el.categoria === c.id).length));
    this.tablero.userData.colocacion = maxPorZona <= 3 ? { columnas: 3, escala: 0.72 } : { columnas: 4, escala: 0.5 };
    this.tablero.position.set(0, H - 0.1, -1.7);
    this.tablero.lookAt(0, H - 0.1, 0);
    this.raiz.add(this.tablero);
    const fondo = new PanelLienzo(W + 0.08, A + 0.08, (ctx, w, h) => tarjeta(ctx, w, h, { fondo: '#f6f2ea', radio: 30, borde: '#9aa7b8', grosor: 8 }));
    fondo.position.z = -0.012;
    this.tablero.add(fondo);
    const zw = W / columnas;
    const zh = A / filas;
    this.cajas = categorias.map((cat, k) => {
      const color = cat.color ?? PALETA[k % PALETA.length];
      const estado = { resaltada: false };
      const zona = new PanelLienzo(zw - 0.03, zh - 0.03, (ctx, w, h) => {
        ctx.fillStyle = color + (estado.resaltada ? '60' : '24');
        ctx.beginPath();
        ctx.roundRect(6, 6, w - 12, h - 12, 26);
        ctx.fill();
        ctx.lineWidth = estado.resaltada ? 12 : 6;
        ctx.strokeStyle = estado.resaltada ? '#ffffff' : color;
        ctx.stroke();
        const texto = cat.emoji ? `${cat.emoji} ${cat.nombre}` : cat.nombre;
        escribir(ctx, texto, 30, 22, { tam: 42, tamMin: 28, peso: 800, color, maxAncho: w - 60, maxAlto: 64 });
      });
      zona.position.set(-W / 2 + zw * ((k % columnas) + 0.5), A / 2 - zh * (Math.floor(k / columnas) + 0.5), 0);
      Object.assign(zona.userData, { cat, dentro: 0, tam: [zw, zh] });
      zona.userData.resaltar = (v) => {
        if (estado.resaltada === v) return;
        estado.resaltada = v;
        zona.redibujar();
      };
      this.tablero.add(zona);
      this.interactivo(zona, {
        alPasar: (v) => this.pendiente && zona.userData.resaltar(v),
        alSeleccionar: () => this.pendiente && this._evaluar(this.pendiente, zona),
      });
      return zona;
    });
    if (cfg.centro) {
      const centro = new PanelLienzo(0.26, 0.26, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#23304a';
        ctx.stroke();
        escribir(ctx, cfg.centro.emoji ?? '👤', w / 2, h * 0.42, { tam: 96, alinear: 'center', base: 'middle' });
        escribir(ctx, cfg.centro.texto ?? '', w / 2, h * 0.78, { tam: 34, peso: 800, alinear: 'center', base: 'middle', maxAncho: w - 40 });
      });
      centro.position.z = 0.01;
      this.tablero.add(centro);
    }
    const eje = (texto) => this.etiqueta(texto, { ancho: 0.8, alto: 0.07, tam: 30, fondo: '#23304a', color: '#ffffff' });
    if (cfg.ejeX) {
      const e = eje(cfg.ejeX);
      e.position.set(0, -A / 2 - 0.09, 0.01);
      this.tablero.add(e);
    }
    if (cfg.ejeY) {
      const e = eje(cfg.ejeY);
      e.position.set(-W / 2 - 0.09, 0, 0.01);
      e.rotation.z = Math.PI / 2;
      this.tablero.add(e);
    }
    this.presentar(this.tablero, 0.15);
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
    nodo.userData = { ...nodo.userData, el, etiqueta, origen: nodo.position.clone(), modelo, halo };
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
    if (this.tablero) {
      // Se proyecta sobre el tablero: vale soltar delante de la zona (hasta 90 cm antes).
      const local = this.tablero.worldToLocal(pos.clone());
      if (local.z < -0.2 || local.z > 0.9) return null;
      return this.cajas.find((z) => Math.abs(local.x - z.position.x) < z.userData.tam[0] / 2 && Math.abs(local.y - z.position.y) < z.userData.tam[1] / 2) ?? null;
    }
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
      this.perder();
      this.cabecera.mensaje(`🤔 ${el.pista || this.t('pistaGenerica')}`, COLORES.naranja);
      this._volver(nodo);
      this.m.fx.tween({ duracion: 0.35 }).then(() => !this._destruida && this.m.fx.sacudir(nodo));
      return;
    }

    this.m.entrada.habilitar(nodo, false);
    this.m.audio.acierto(pos);
    this.ganar(pos, 100);
    this.m.fx.confeti(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 30);
    this.cabecera.mensaje(`✅ ${this.t('correcto')} ${el.explicacion ?? ''}`, COLORES.verde);
    this.narrar(el.explicacion);
    // Salta dando una vuelta hasta el fondo de la caja (o a su lugar en el tablero), y la caja rebota al recibirlo.
    let dentro;
    if (this.tablero) {
      const [zw, zh] = caja.userData.tam;
      const i = caja.userData.dentro++;
      // Tarjetas más grandes si caben pocas por zona (3 por fila) y más chicas si son muchas (4 por fila).
      const { columnas, escala } = this.tablero.userData.colocacion;
      const alto = 0.22 * escala;
      const paso = (zw - 0.06) / columnas;
      const lugar = new THREE.Vector3(-zw / 2 + 0.03 + paso * ((i % columnas) + 0.5), zh / 2 - 0.085 - alto / 2 - Math.floor(i / columnas) * (alto + 0.012), 0.025);
      dentro = this.raiz.worldToLocal(caja.localToWorld(lugar));
      const q0 = nodo.quaternion.clone();
      this.m.fx.tween({ duracion: 0.6, alActualizar: (k) => nodo.quaternion.slerpQuaternions(q0, this.tablero.quaternion, k) });
    } else {
      dentro = caja.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.12, (Math.random() - 0.5) * 0.1));
    }
    const inicio = nodo.position.clone();
    nodo.userData.movimiento?.cancelar();
    nodo.userData.fijo = true;
    nodo.userData.modelo.userData.quieto = true;
    if (this.tablero) {
      nodo.userData.modelo.position.y = 0;
      nodo.userData.modelo.rotation.set(0, 0, 0);
    } else {
      this.m.fx.girar(nodo.userData.modelo, 0.6);
    }
    this.m.fx.escalarA(nodo, this.tablero ? this.tablero.userData.colocacion.escala : 0.55, 0.6);
    this.m.fx
      .tween({
        duracion: 0.6,
        curva: suavizado.entradaSalida,
        alActualizar: (k) => {
          nodo.position.lerpVectors(inicio, dentro, k);
          nodo.position.y += Math.sin(k * Math.PI) * (this.tablero ? 0.08 : 0.2);
        },
      })
      .then(() => !this._destruida && this.m.fx.latido(caja, 0.12));
    nodo.userData.etiqueta && (nodo.userData.etiqueta.visible = false);
    nodo.userData.halo.visible = false;

    this.aciertos++;
    this.cabecera.derecha(`${this.aciertos} / ${this.elementos.length}`);
    if (this.aciertos === this.elementos.length) {
      this.m.fx.tween({ duracion: 1.6 }).then(() => {
        if (this._destruida) return;
        this.m.audio.exito();
        this.m.fx.confeti(this.posMundo(this.cabecera).add(new THREE.Vector3(0, -0.4, 0.4)), 80);
        this.cabecera.mensaje(this.datos.mensajeFinal || this.t('todoClasificado'), COLORES.verde);
        if (this.datos.mensajeFinal) this.voz(this.datos.mensajeFinal);
        this.mostrarContinuar(new THREE.Vector3(0, this.tablero ? this.H - 0.74 : this.H - 0.05, this.tablero ? -1.45 : -1.35));
      });
    }
  }
}

