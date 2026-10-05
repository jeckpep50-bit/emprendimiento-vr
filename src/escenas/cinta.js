import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { suavizado } from '../core/efectos.js';
import { mat, malla, fusionar, liberar } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Z_BANDA = -0.85;
const X_ENTRADA = 2.35;
const X_SALIDA = -2.3;

/**
 * Control de calidad: los productos avanzan por una banda transportadora de
 * derecha a izquierda. El estudiante dispara a los que NO son seguros (se
 * rechazan) y deja pasar los buenos. Cada producto lleva una etiqueta con su
 * fecha, su estado o su registro sanitario.
 * datos: { titulo, instruccion?, hoy, vidas?, productos: [{ modelo, opciones?, tamano?, nombre, etiqueta?, apto, explicacion }] }
 */
export class EscenaCinta extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.productos = d.productos ?? [];
    this.vidasMax = d.vidas ?? 4;
    this.estado = 'espera';
    this.activos = [];
    this.yBanda = THREE.MathUtils.clamp(H - 0.42, 0.72, 1.05);
    this._reiniciar();

    this.cabecera = this.encabezado({ instruccion: d.instruccion || this.t('cintaInstruccion'), y: H + 0.55, z: -1.95 });
    if (d.hoy) this.cabecera.derecha(this.t('hoy', { fecha: d.hoy }));
    this._construirBanda();

    // Tablero (izquierda) y calendario (derecha)
    this.tablero = new PanelLienzo(0.56, 0.4, (ctx, w, h) => this._dibujarTablero(ctx, w, h));
    this.tablero.position.set(-1.3, H + 0.08, -1.35);
    this.tablero.lookAt(0, H, 0.2);
    const calendario = new PanelLienzo(0.46, 0.34, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 30, borde: COLORES.rojo, grosor: 10 });
      ctx.fillStyle = COLORES.rojo;
      ctx.beginPath();
      ctx.roundRect(9, 9, w - 18, 90, [24, 24, 0, 0]);
      ctx.fill();
      escribir(ctx, '📅 HOY', w / 2, 54, { tam: 50, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
      escribir(ctx, d.hoy ?? '', w / 2, (h + 100) / 2, { tam: 72, peso: 900, alinear: 'center', base: 'middle', maxAncho: w - 40 });
    });
    calendario.position.set(1.3, H + 0.08, -1.35);
    calendario.lookAt(0, H, 0.2);
    this.raiz.add(this.tablero, calendario);
    this.presentar(this.tablero, 0.3);
    this.presentar(calendario, 0.35);

    this.btnEmpezar = this.boton(this.t('empezarJuego'), () => this._empezar(), { ancho: 0.5, alto: 0.15, color: COLORES.verde });
    this.btnEmpezar.position.set(0, H + 0.05, -1.3);
    this.btnEmpezar.lookAt(0, H, 0);
    this.raiz.add(this.btnEmpezar);
    this.presentar(this.btnEmpezar, 0.45);

    const cabeza = V(0, 0, 0);
    let reloj = 0;
    this.cadaCuadro((dt, t) => {
      this.luz.material.color.set(this.estado === 'jugando' && Math.sin(t * 8) > 0 ? '#ffb300' : '#6b5520');
      if (this.estado !== 'jugando') return;
      this._actualizar(dt);
      this.m.app.camara.getWorldPosition(cabeza);
      for (const n of this.activos) n.lookAt(cabeza.x, this.posMundo(n).y, cabeza.z);
      reloj += dt;
      if (reloj > 0.3) {
        reloj = 0;
        this.tablero.redibujar();
      }
    });
  }

  _reiniciar() {
    this.cola = barajar(this.productos);
    this.totalProductos = this.cola.length;
    this.procesados = 0;
    this.vidas = this.vidasMax;
    this.errores = 0;
    this.ultimo = null;
    this._fin = 0;
  }

  _construirBanda() {
    const y = this.yBanda;
    const largo = X_ENTRADA - X_SALIDA + 0.3;
    const xc = (X_ENTRADA + X_SALIDA) / 2;
    const estructura = new THREE.Group();
    const gris = mat('#3a4250');
    const acero = mat('#9aa7b8');
    for (const dz of [-0.27, 0.27]) estructura.add(malla(new THREE.BoxGeometry(largo, 0.12, 0.07), acero, [xc, y - 0.05, Z_BANDA + dz]));
    for (const x of [-2.2, -0.75, 0.75, 2.2]) for (const dz of [-0.24, 0.24]) estructura.add(malla(new THREE.BoxGeometry(0.06, y - 0.08, 0.06), gris, [x, (y - 0.08) / 2, Z_BANDA + dz]));
    for (const x of [xc - largo / 2, xc + largo / 2]) estructura.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.48, 16), acero, [x, y - 0.06, Z_BANDA], [Math.PI / 2, 0, 0]));
    // Máquina de entrada (derecha) con cortina de tiras
    estructura.add(malla(new THREE.BoxGeometry(0.62, y + 0.55, 0.8), mat('#2f6fb0'), [X_ENTRADA + 0.42, (y + 0.55) / 2, Z_BANDA]));
    estructura.add(malla(new THREE.PlaneGeometry(0.5, 0.36), mat('#0d1426', { tipo: 'basica' }), [X_ENTRADA + 0.105, y + 0.18, Z_BANDA], [0, -Math.PI / 2, 0]));
    for (let i = 0; i < 6; i++) estructura.add(malla(new THREE.PlaneGeometry(0.075, 0.34), mat('#bfe6ff', { opacidad: 0.55, lados: THREE.DoubleSide }), [X_ENTRADA + 0.1, y + 0.18, Z_BANDA - 0.2 + i * 0.08], [0, -Math.PI / 2, 0]));
    // Contenedores: aprobados al final de la banda, rechazados detrás
    const caja = (color, x, z, alto) => {
      const g = new THREE.Group();
      const m = mat(color);
      g.add(malla(new THREE.BoxGeometry(0.62, 0.03, 0.5), m, [0, 0.015, 0]));
      for (const [w, d, dx, dz] of [[0.62, 0.03, 0, -0.25], [0.62, 0.03, 0, 0.25], [0.03, 0.5, -0.31, 0], [0.03, 0.5, 0.31, 0]]) g.add(malla(new THREE.BoxGeometry(w, alto, d), m, [dx, alto / 2, dz]));
      g.position.set(x, 0, z);
      estructura.add(g);
    };
    caja('#2dbe78', X_SALIDA - 0.45, Z_BANDA, y - 0.2);
    estructura.add(malla(new THREE.BoxGeometry(0.7, y - 0.55, 0.55), gris, [0.95, (y - 0.55) / 2, -1.7]));
    caja('#e5484d', 0.95, -1.7, 0.5);
    estructura.children.at(-1).position.y = y - 0.55;
    fusionar(estructura);
    this.raiz.add(estructura);
    this.bocaRechazo = V(0.95, y - 0.2, -1.7);
    this.bocaAprobado = V(X_SALIDA - 0.45, y - 0.35, Z_BANDA);

    // Carteles de los contenedores
    for (const [texto, color, pos] of [['✅ APROBADOS', COLORES.verde, V(X_SALIDA - 0.45, y + 0.05, Z_BANDA + 0.27)], ['❌ RECHAZADOS', COLORES.rojo, V(0.95, y + 0.15, -1.43)]]) {
      const c = this.etiqueta(texto, { ancho: 0.42, alto: 0.08, fondo: color, color: '#ffffff', tam: 36 });
      c.position.copy(pos);
      c.lookAt(0, pos.y, 0);
      this.raiz.add(c);
    }

    // Superficie de la banda con una textura que avanza
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#2b2f38';
    x.fillRect(0, 0, 64, 16);
    x.fillStyle = '#4a505c';
    x.fillRect(0, 0, 8, 16);
    this.texBanda = new THREE.CanvasTexture(c);
    this.texBanda.wrapS = this.texBanda.wrapT = THREE.RepeatWrapping;
    this.texBanda.repeat.set(largo / 0.2, 1);
    this.raiz.add(malla(new THREE.PlaneGeometry(largo, 0.48), new THREE.MeshLambertMaterial({ map: this.texBanda }), [xc, y + 0.002, Z_BANDA], [-Math.PI / 2, 0, 0]));

    // Luz de la máquina (parpadea mientras funciona)
    this.luz = malla(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: '#6b5520' }), [X_ENTRADA + 0.42, y + 0.62, Z_BANDA]);
    this.raiz.add(this.luz);
  }

  _empezar() {
    if (this.estado === 'jugando') return;
    for (const n of [...this.activos]) this._retirar(n);
    this._reiniciar();
    this.estado = 'jugando';
    this.btnEmpezar.visible = false;
    this.m.entrada.habilitar(this.btnEmpezar, false);
    if (this._otraVez) this._otraVez.visible = false;
    if (this._continuar) this._continuar.visible = false;
    this.m.audio.transicion();
    this.cabecera.mensaje(this.t('bandaEnMarcha'), COLORES.primario);
    this.zumbido = this.m.audio.fuenteEspacial('motor', this.posMundo(this.luz));
    this._quitar.push(() => this.zumbido?.detener());
    this.tablero.redibujar();
  }

  /** Velocidad de la banda: sube poco a poco a medida que pasan los productos. */
  get velocidad() {
    return 0.2 + (this.procesados / Math.max(1, this.totalProductos)) * 0.1;
  }

  _actualizar(dt) {
    const v = this.velocidad;
    this.texBanda.offset.x += (v * dt) / 0.2;
    const separacion = 0.66;
    if (this.cola.length && (!this.ultimo || this.ultimo.userData.resuelto || this.ultimo.position.x < X_ENTRADA - separacion)) this._lanzar();
    for (const nodo of [...this.activos]) {
      nodo.position.x -= v * dt;
      if (nodo.position.x <= X_SALIDA) this._llegar(nodo);
    }
    if (this.vidas <= 0) return this._terminarJuego();
    if (!this.cola.length && !this.activos.length) {
      this._fin += dt;
      if (this._fin > 0.8) this._terminarJuego();
    }
  }

  _lanzar() {
    const datos = this.cola.shift();
    const nodo = new THREE.Group();
    const envoltorio = new THREE.Group();
    const modelo = this.modelo(datos.modelo, { tamano: datos.tamano ?? 0.2, ...datos.opciones });
    modelo.position.y = modelo.userData.tam.y / 2;
    envoltorio.add(modelo);
    nodo.add(envoltorio);
    const etiqueta = new PanelLienzo(
      0.34,
      0.15,
      (ctx, w, h) => {
        tarjeta(ctx, w, h, { radio: 36, borde: '#23304a', grosor: 8 });
        const y = escribir(ctx, datos.nombre, w / 2, 22, { tam: 54, peso: 900, alinear: 'center', maxAncho: w - 40, maxAlto: 70 });
        if (datos.etiqueta) escribir(ctx, datos.etiqueta, w / 2, y + 4, { tam: 44, peso: 700, color: COLORES.suave, alinear: 'center', maxAncho: w - 40, maxAlto: h - y - 24 });
      },
      { pxPorMetro: 1400 },
    );
    etiqueta.position.y = modelo.userData.tam.y + 0.13;
    nodo.add(etiqueta);
    nodo.position.set(X_ENTRADA, this.yBanda + 0.004, Z_BANDA);
    Object.assign(nodo.userData, { datos, envoltorio, etiqueta, resuelto: false });
    this.raiz.add(nodo);
    this.interactivo(nodo, {
      proxy: true,
      alPasar: (v) => envoltorio.scale.setScalar(v ? 1.15 : 1),
      alSeleccionar: (p) => this._rechazar(nodo, p),
    });
    this.activos.push(nodo);
    this.ultimo = nodo;
    this.m.fx.aparecer(nodo, 0.3);
    this.m.audio.clac(this.posMundo(nodo));
  }

  /** El estudiante dispara: el producto se sella como RECHAZADO y vuela al contenedor rojo. */
  _rechazar(nodo, p) {
    const u = nodo.userData;
    if (this.estado !== 'jugando' || u.resuelto) return;
    u.resuelto = true;
    this.procesados++;
    this.activos = this.activos.filter((n) => n !== nodo);
    this.m.entrada.desregistrar(nodo);
    const pos = this.posMundo(nodo);
    this._rayo(p, pos.clone().add(V(0, 0.1, 0)));
    this.m.audio.sello(pos);
    const sello = this.etiqueta(this.t('rechazado'), { ancho: 0.3, alto: 0.08, fondo: 'rgba(229, 72, 77, 0.92)', color: '#ffffff', tam: 40 });
    sello.position.set(0, u.etiqueta.position.y, 0.01);
    sello.rotation.z = 0.18;
    nodo.add(sello);
    this.m.fx.aparecer(sello, 0.25);
    if (u.datos.apto) {
      this.errores++;
      this.perder();
      this.m.audio.error(pos);
      this.cabecera.mensaje(`${this.t('rechazoMal', { nombre: u.datos.nombre })} ${u.datos.explicacion}`, COLORES.naranja);
    } else {
      this.ganar(pos, 100);
      this.m.fx.pixeles(pos.clone().add(V(0, 0.1, 0)), '#ff8a8d', 30, 0.5);
      this.cabecera.mensaje(this.t('rechazoBien', { explicacion: `${u.datos.nombre}: ${u.datos.explicacion}` }), COLORES.verde);
    }
    this._volarA(nodo, this.bocaRechazo, 0.35);
    this.tablero.redibujar();
  }

  /** El producto llegó al final de la banda: se aprueba. Si era peligroso, un cliente se enferma. */
  _llegar(nodo) {
    const u = nodo.userData;
    u.resuelto = true;
    this.procesados++;
    this.activos = this.activos.filter((n) => n !== nodo);
    this.m.entrada.desregistrar(nodo);
    const pos = this.posMundo(nodo);
    if (u.datos.apto) {
      this.ganar(pos, 50);
    } else {
      this.vidas--;
      this.errores++;
      this.perder();
      this.m.audio.error(pos);
      this.m.fx.pixeles(pos, '#ff5a5f', 30, 0.5);
      this.m.fx.sacudir(this.tablero, 0.03);
      this.cabecera.mensaje(this.t('seEscapo', { explicacion: `${u.datos.nombre}: ${u.datos.explicacion}` }), COLORES.rojo);
    }
    this._volarA(nodo, this.bocaAprobado, 0.12);
    this.tablero.redibujar();
  }

  _volarA(nodo, destino, altura) {
    const inicio = nodo.position.clone();
    this.m.fx
      .tween({
        duracion: 0.6,
        curva: suavizado.entradaSalida,
        alActualizar: (k) => {
          nodo.position.lerpVectors(inicio, destino, k);
          nodo.position.y += Math.sin(k * Math.PI) * altura;
          nodo.scale.setScalar(1 - k * 0.5);
        },
      })
      .then(() => this._retirar(nodo));
  }

  _retirar(nodo) {
    this.m.entrada.desregistrar(nodo);
    this.activos = this.activos.filter((n) => n !== nodo);
    if (!nodo.parent) return;
    nodo.removeFromParent();
    liberar(nodo);
  }

  _rayo(p, destino) {
    if (!p?.origen) return;
    const geo = new THREE.BufferGeometry().setFromPoints([p.origen.clone(), destino.clone()]);
    const linea = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ff8a8d', transparent: true }));
    this.m.app.escena.add(linea);
    this.m.fx.tween({
      duracion: 0.2,
      persistente: true,
      alActualizar: (k) => (linea.material.opacity = 1 - k),
      alTerminar: () => {
        linea.removeFromParent();
        geo.dispose();
        linea.material.dispose();
      },
    });
  }

  _terminarJuego() {
    if (this.estado !== 'jugando') return;
    this.estado = 'fin';
    for (const n of [...this.activos]) this._retirar(n);
    this.zumbido?.detener();
    this.zumbido = null;
    const perdio = this.vidas <= 0;
    this.estrellas = perdio ? 1 : this.errores <= 1 ? 3 : this.errores <= 3 ? 2 : 1;
    this.tablero.redibujar();
    this.cabecera.mensaje(perdio ? this.t('cintaPerdida') : this.t('cintaTerminada', { n: this.procesados }), perdio ? COLORES.naranja : COLORES.verde);
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.tablero).add(V(0.4, 0.3, 0.2)), 60);
    if (!this._otraVez) {
      this._otraVez = this.boton(this.t('jugarOtraVez'), () => this._empezar(), { ancho: 0.42, alto: 0.12, color: '#e6ebf8', colorTexto: COLORES.texto });
      this._otraVez.position.set(-0.28, this.H + 0.05, -1.3);
      this._otraVez.lookAt(0, this.H, 0);
      this.raiz.add(this._otraVez);
    }
    this._otraVez.visible = true;
    this.mostrarContinuar(new THREE.Vector3(0.28, this.H + 0.05, -1.3));
    this._continuar.visible = true;
  }

  _dibujarTablero(ctx, w, h) {
    ctx.fillStyle = '#0d1426';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 34);
    ctx.fill();
    ctx.strokeStyle = '#ffc23c';
    ctx.lineWidth = 6;
    ctx.stroke();
    const vidas = Math.max(0, this.vidas);
    if (this.estado === 'fin') {
      escribir(ctx, '⭐'.repeat(this.estrellas) + '☆'.repeat(3 - this.estrellas), w / 2, 40, { tam: 84, alinear: 'center' });
      escribir(ctx, `📦 ${this.procesados}  ·  ❤️ ${vidas}`, w / 2, 190, { tam: 58, peso: 800, color: '#ffffff', alinear: 'center' });
      escribir(ctx, `❌ ${this.errores}`, w / 2, 290, { tam: 44, peso: 700, color: '#9fb3c8', alinear: 'center' });
      return;
    }
    escribir(ctx, this.t('procesados', { n: this.procesados, total: this.totalProductos }), 32, 34, { tam: 52, peso: 800, color: '#ffc23c' });
    escribir(ctx, this.t('clientesProtegidos'), 32, 150, { tam: 34, peso: 700, color: '#9fb3c8' });
    escribir(ctx, '❤️'.repeat(vidas) + '🖤'.repeat(this.vidasMax - vidas), 32, 210, { tam: 56 });
    escribir(ctx, `❌ ${this.errores}`, 32, 300, { tam: 44, peso: 800, color: '#ff8a8d' });
  }
}
