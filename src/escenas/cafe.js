import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { PanelLienzo, COLORES, escribir, tarjeta, rectRedondeado } from '../ui/lienzo.js';
import { gallo } from '../mundo/prefabs/cafe.js';
import { MOSTRADOR } from '../mundo/entornos-cafe.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const METAS = [
  ['saludar', 'Saludar', '👋'],
  ['pedido', 'Construir el pedido', '🥪'],
  ['bebida', 'Identificar la bebida', '💧'],
  ['responder', 'Responder al camarero', '💬'],
  ['comprobar', 'Comprobar el pedido', '🔎'],
  ['despedirse', 'Despedirse', '🙋'],
];

const QUIEN = { camarero: ['🐓', 'Coco'], cliente: ['🧒', 'Customer'], estudiante: ['🙂', 'You'] };

/**
 * Cafetería de inglés A1 (entorno "cafeteria"). Coco, un gallo camarero, atiende al
 * estudiante en cinco etapas: saludo, escuchar la carta (y un pedido modelo), pedir con
 * tarjetas y con toda la ayuda, una misión con menos ayuda y la comprobación con la
 * despedida. Sin micrófono: todo es escuchar, elegir, ordenar y tocar productos.
 * Ante un error: pista del camarero y repetición de la pregunta; al segundo, se muestra
 * la respuesta. Registra por meta si se logró sola o con ayuda y cuántos reintentos hubo
 * (solo en memoria; no se guarda nada).
 * datos: { titulo, fases [{ en, es }], pasos { clave: texto }, productos [{ id, modelo, opciones?,
 *   tipo, emoji, tarjeta?, nombre, pedido?, confirma? }], guiado { comidas, inicio, fin },
 *   escucha { objetivo, opciones }, modelo { producto, cliente }, mision { comida, bebida,
 *   opcionesComida, extra }, lineas { clave: { quien, en, es } }, preguntas { grupo: [opciones] } }
 */
export class EscenaCafe extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.lin = d.lineas ?? {};
    this.prod = Object.fromEntries((d.productos ?? []).map((p) => [p.id, p]));
    this.traducir = true;
    this.usosTraduccion = 0;
    this.fase = 0;
    this.paso = '';
    this.linea = null;
    this.repetible = null;
    this.ayuda = null;
    this.mision = null;
    this.dialogo = null;
    this.enMostrador = [];
    this.reg = Object.fromEntries(METAS.map(([id]) => [id, { hecho: false, errores: 0, ayuda: false }]));
    this.inicio = performance.now();

    // Coco detrás del mostrador (sobre una tarima escondida)
    this.coco = gallo();
    this.coco.position.set(0, 0.5, -1.95);
    this.raiz.add(this.coco);
    this.cadaCuadro((_dt, t) => this.coco.userData.animar(t));
    this.mirarAlUsuario([this.coco]);
    this.presentar(this.coco, 0.1);
    this._animarGestos();

    // Globo de diálogo (lo que se dice, con traducción opcional)
    this.burbuja = new PanelLienzo(0.92, 0.42, (ctx, w, h) => this._dibujarBurbuja(ctx, w, h));
    this.burbuja.position.set(-0.64, H + 0.15, -1.4);
    this.burbuja.lookAt(0, H, 0.2);
    this.raiz.add(this.burbuja);
    this.presentar(this.burbuja, 0.3);

    // Panel de la etapa, la instrucción y la misión
    this.cabecera = new PanelLienzo(0.8, 0.46, (ctx, w, h) => this._dibujarCabecera(ctx, w, h));
    this.cabecera.position.set(0.68, H + 0.15, -1.38);
    this.cabecera.lookAt(0, H, 0.2);
    this.raiz.add(this.cabecera);
    this.presentar(this.cabecera, 0.4);

    // Zona de opciones y tarjetas
    this.zona = new THREE.Group();
    this.raiz.add(this.zona);

    this._crearHerramientas();
  }

  // ── Dibujo de paneles ────────────────────────────────────────────────────

  _dibujarBurbuja(ctx, w, h) {
    const l = this.linea;
    tarjeta(ctx, w, h - 30, { radio: 44, borde: '#f2c45a', grosor: 8 });
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w - 150, h - 34);
    ctx.lineTo(w - 70, h);
    ctx.lineTo(w - 70, h - 34);
    ctx.fill();
    if (!l) return;
    const [emoji, nombre] = QUIEN[l.quien] ?? ['💬', ''];
    escribir(ctx, `${emoji} ${nombre}`, 40, 30, { tam: 30, peso: 800, color: '#b06a1f' });
    const conEs = this.traducir && l.es;
    const fin = escribir(ctx, l.en, 40, 76, { tam: 50, tamMin: 34, peso: 800, color: COLORES.texto, maxAncho: w - 80, maxAlto: conEs ? 200 : 290, interlineado: 1.12 });
    if (conEs) escribir(ctx, l.es, 40, fin + 12, { tam: 32, tamMin: 24, peso: 600, color: COLORES.suave, maxAncho: w - 80, maxAlto: h - fin - 50 });
  }

  _dibujarCabecera(ctx, w, h) {
    tarjeta(ctx, w, h, { fondo: '#23304a', radio: 40 });
    const f = this.datos.fases?.[this.fase];
    ctx.fillStyle = '#f2c45a';
    rectRedondeado(ctx, 26, 22, 250, 50, 25);
    ctx.fill();
    escribir(ctx, `Parte ${this.fase + 1} de 5`, 151, 48, { tam: 28, peso: 900, color: '#23304a', alinear: 'center', base: 'middle' });
    // Estrellas: metas logradas
    METAS.forEach(([id], i) => {
      const r = this.reg[id];
      escribir(ctx, r.hecho ? '⭐' : '☆', w - 40 - (METAS.length - 1 - i) * 46, 48, { tam: 36, color: r.hecho ? '#ffd23c' : '#5b6886', alinear: 'center', base: 'middle' });
    });
    let y = 90;
    if (f) {
      y = escribir(ctx, f.en, 28, y, { tam: 46, peso: 900, color: '#ffffff' });
      if (this.traducir) y = escribir(ctx, f.es, 28, y + 2, { tam: 28, peso: 600, color: '#c9d4ee' });
    }
    if (this.dialogo) {
      y += 10;
      for (const l of this.dialogo) {
        const [emoji] = QUIEN[l.quien] ?? ['💬'];
        y = escribir(ctx, `${emoji} ${l.en}`, 28, y + 4, { tam: 32, peso: 700, color: '#ffffff', maxAncho: w - 56 });
        if (this.traducir) y = escribir(ctx, l.es, 70, y, { tam: 24, color: '#c9d4ee', maxAncho: w - 100 });
      }
      return;
    }
    if (this.mision) {
      ctx.fillStyle = '#fffbea';
      rectRedondeado(ctx, 28, y + 12, w - 56, 150, 30);
      ctx.fill();
      escribir(ctx, '🎯 MISSION', 50, y + 50, { tam: 28, peso: 900, color: '#b06a1f', base: 'middle' });
      this.mision.forEach((m, i) => {
        const x = 330 + i * 200;
        escribir(ctx, m.emoji, x, y + 92, { tam: 96, alinear: 'center', base: 'middle' });
        if (m.ok) escribir(ctx, '✅', x + 52, y + 132, { tam: 42, alinear: 'center', base: 'middle' });
        if (i === 0) escribir(ctx, '+', x + 100, y + 92, { tam: 60, peso: 900, color: '#23304a', alinear: 'center', base: 'middle' });
      });
      y += 176;
    }
    if (this.paso) escribir(ctx, this.paso, 28, y + 6, { tam: 32, tamMin: 24, peso: 700, color: '#ffe9a8', maxAncho: w - 56, maxAlto: h - y - 16 });
  }

  _actualizarCabecera() {
    this.cabecera.redibujar();
  }

  _ponerPaso(clave, extra = '') {
    this.paso = `${this.datos.pasos?.[clave] ?? ''}${extra}`;
    this._actualizarCabecera();
  }

  // ── Herramientas: repetir, traducir, ayuda, reiniciar y salir ────────────

  _crearHerramientas() {
    const { H } = this;
    const crear = (texto, accion, i, color = '#2f4a8a') => {
      const b = this.boton(texto, accion, { ancho: 0.22, alto: 0.075, color, tam: 28 });
      b.position.set((i - 2) * 0.24, H - 0.5, -1.0 + Math.abs(i - 2) * 0.03);
      b.lookAt(0, H, 0.2);
      this.raiz.add(b);
      this.presentar(b, 0.5 + i * 0.05);
      return b;
    };
    crear('🔊 Repetir', () => this.repetir(), 0);
    this.btnTraducir = crear('🌐 Español: sí', () => this.alternarTraduccion(), 1, '#21a366');
    this.btnAyuda = crear('💡 Ayuda', () => this.pedirAyuda(), 2, '#d98a00');
    crear('↺ Reiniciar', () => this.m.irA(this.indice, true), 3, '#5b6886');
    crear('⏏ Salir', () => this.salir(), 4, '#a33a4a');
  }

  repetir() {
    const l = this.repetible ?? this.linea;
    if (l) this.decir(l);
  }

  alternarTraduccion(valor = !this.traducir, contar = true) {
    this.traducir = valor;
    if (valor && contar) this.usosTraduccion++;
    this.btnTraducir.estado.texto = `🌐 Español: ${valor ? 'sí' : 'no'}`;
    this.btnTraducir.redibujar();
    this.burbuja.redibujar();
    this._actualizarCabecera();
    for (const o of this.zona.children) o.userData.redibujar?.();
  }

  pedirAyuda() {
    if (!this.ayuda) {
      this.decir(this.repetible ?? this.linea);
      return;
    }
    const { meta, fn } = this.ayuda;
    this.reg[meta].ayuda = true;
    fn();
  }

  salir() {
    if (this.m.app.renderer.xr.isPresenting) this.m.app.salirVR();
    else document.getElementById('salir-pantalla')?.click();
  }

  // ── Voz y gestos de Coco ─────────────────────────────────────────────────

  /** Dice una línea (objeto { quien, en, es } o clave de "lineas") y la muestra en el globo. */
  async decir(l, { repetible = false } = {}) {
    if (typeof l === 'string') l = this.lin[l];
    if (!l || this._destruida) return;
    this.linea = l;
    if (repetible) this.repetible = l;
    this.burbuja.redibujar();
    this.m.fx.latido(this.burbuja, 0.03);
    if (l.quien === 'camarero') return this.hablarPersona(this.coco, l.en, 'camarero');
    if (l.quien === 'cliente' && this.cliente) return this.hablarPersona(this.cliente, l.en, 'cliente');
    const sono = await this.voz(l.en, l.quien);
    if (!sono && !this._destruida) await this.esperar(this.duracionVoz(l.en, l.quien));
  }

  gesto(tipo, duracion = 1.4) {
    this._gesto = { tipo, desde: this._t ?? 0, duracion };
    this.coco.userData.setExpresion(tipo === 'duda' ? 'duda' : tipo === 'celebra' || tipo === 'saludo' ? 'sorpresa' : 'feliz');
  }

  _animarGestos() {
    const a = this.coco.userData.articulaciones;
    const boinaY = a.boina.position.y;
    this.cadaCuadro((dt, t) => {
      this._t = t;
      const g = this._gesto;
      const k = g ? (t - g.desde) / g.duracion : 1;
      if (g && k >= 1) {
        this._gesto = null;
        this.coco.userData.setExpresion('feliz');
      }
      const habla = Boolean(this.coco.userData.fuenteHabla) && this.m.audio.hablando;
      let alaI = -0.12;
      let alaD = habla ? 0.45 + Math.sin(t * 3.1) * 0.25 : 0.12;
      let alaDx = habla ? -0.3 : 0;
      let ladeo = 0;
      let salto = 0;
      let inclina = 0;
      let boina = 0;
      const tipo = this._gesto?.tipo;
      if (tipo === 'saludo') {
        alaD = 2.3 + Math.sin(t * 12) * 0.35;
        alaDx = 0;
      } else if (tipo === 'celebra') {
        alaI = -2.3 - Math.sin(t * 14) * 0.2;
        alaD = 2.3 + Math.sin(t * 14) * 0.2;
        salto = Math.abs(Math.sin(k * Math.PI * 2)) * 0.07;
      } else if (tipo === 'duda') {
        ladeo = 0.3;
        alaD = 1.5;
        alaDx = -0.5;
      } else if (tipo === 'entrega') {
        inclina = 0.22;
        alaD = 0.9;
        alaDx = -1.1;
      } else if (tipo === 'adios') {
        alaD = 2.3 + Math.sin(t * 10) * 0.35;
        boina = Math.sin(Math.min(1, k) * Math.PI);
      }
      const s = 1 - Math.exp(-dt * 10);
      a.alaI.rotation.z += (alaI - a.alaI.rotation.z) * s;
      a.alaD.rotation.z += (alaD - a.alaD.rotation.z) * s;
      a.alaD.rotation.x += (alaDx - a.alaD.rotation.x) * s;
      a.cabeza.rotation.z += (ladeo - a.cabeza.rotation.z) * s;
      a.torso.rotation.x += (inclina - a.torso.rotation.x) * s;
      a.boina.position.y = boinaY + boina * 0.09;
      this.coco.position.y = 0.5 + salto;
    });
  }

  // ── Piezas interactivas ──────────────────────────────────────────────────

  /** Botón de respuesta grande con el inglés y (si está activa) la traducción. */
  _opcion(en, es, alTocar, { ancho = 0.54, alto = 0.17, color = '#ffffff' } = {}) {
    const estado = { encima: false, modo: 'normal', resaltar: false, en, es };
    const panel = new PanelLienzo(ancho, alto, (ctx, w, h) => {
      const fondo = { normal: estado.encima ? '#fff2c2' : color, correcto: COLORES.verde, incorrecto: COLORES.rojo, apagado: '#c9d0e0' }[estado.modo];
      rectRedondeado(ctx, 6, 14, w - 12, h - 18, 40);
      ctx.fillStyle = 'rgba(10, 20, 45, 0.3)';
      ctx.fill();
      rectRedondeado(ctx, 6, 6, w - 12, h - 18, 40);
      ctx.fillStyle = fondo;
      ctx.fill();
      if (estado.resaltar || estado.encima) {
        ctx.lineWidth = estado.resaltar ? 14 : 10;
        ctx.strokeStyle = estado.resaltar ? '#ffb000' : '#2f8be6';
        ctx.stroke();
      }
      const blanco = estado.modo !== 'normal';
      const conEs = this.traducir && estado.es;
      escribir(ctx, estado.en, w / 2, conEs ? h * 0.38 : h * 0.47, { tam: 48, tamMin: 30, peso: 800, color: blanco ? '#ffffff' : COLORES.texto, alinear: 'center', base: 'middle', maxAncho: w - 50 });
      if (conEs) escribir(ctx, estado.es, w / 2, h * 0.72, { tam: 28, peso: 600, color: blanco ? '#ffffff' : COLORES.suave, alinear: 'center', base: 'middle', maxAncho: w - 50 });
    });
    panel.userData.redibujar = () => panel.redibujar();
    panel.userData.opcion = estado;
    this.interactivo(panel, {
      alPasar: (v) => {
        estado.encima = v;
        panel.redibujar();
      },
      alSeleccionar: () => {
        if (estado.modo !== 'normal') return;
        this.m.audio.pop(this.posMundo(panel));
        alTocar();
      },
    });
    let pulso = null;
    return {
      obj: panel,
      estado,
      marcar: (modo) => {
        estado.modo = modo;
        panel.redibujar();
      },
      resaltar: (v) => {
        estado.resaltar = v;
        panel.redibujar();
        pulso?.();
        pulso = v ? this._pulsar(panel) : null;
      },
      habilitar: (v) => this.m.entrada.habilitar(panel, v),
    };
  }

  /** Late suavemente un objeto mientras esté resaltado; devuelve la función para pararlo. */
  _pulsar(obj) {
    let activo = true;
    const base = obj.scale.x || 1;
    this.cadaCuadro((_dt, t) => {
      if (activo) obj.scale.setScalar(base * (1 + Math.max(0, Math.sin(t * 6)) * 0.08));
    });
    return () => {
      activo = false;
      obj.scale.setScalar(base);
    };
  }

  /** Producto 3D que se puede tocar, con etiqueta (oculta hasta que se muestre). */
  _producto(id, posicion, { tam = 0.17, alTocar, etiqueta = false } = {}) {
    const p = this.prod[id];
    const nodo = new THREE.Group();
    nodo.position.copy(posicion);
    const m = this.modelo(p.modelo, { tamano: tam, ...(p.opciones ?? {}) });
    nodo.add(m);
    m.userData.producto = id;
    const estado = { visible: etiqueta, marca: '' };
    const nombreEn = (p.tarjeta ?? p.nombre?.en ?? id).replace(/\.$/, '');
    const nombreEs = (p.nombre?.es ?? '').replace(/\.$/, '');
    const cartel = new PanelLienzo(0.27, 0.09, (ctx, w, h) => {
      if (!estado.visible && !estado.marca) return;
      const color = estado.marca === '✗' ? COLORES.rojo : estado.marca === '✓' ? COLORES.verde : '#23304a';
      rectRedondeado(ctx, 4, 4, w - 8, h - 8, 34);
      ctx.fillStyle = color;
      ctx.fill();
      const texto = estado.visible ? `${estado.marca ? estado.marca + ' ' : ''}${nombreEn}` : estado.marca;
      const conEs = this.traducir && estado.visible && nombreEs;
      escribir(ctx, texto, w / 2, conEs ? h * 0.36 : h / 2, { tam: 36, tamMin: 22, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30 });
      if (conEs) escribir(ctx, nombreEs, w / 2, h * 0.74, { tam: 22, peso: 600, color: '#dfe6f5', alinear: 'center', base: 'middle', maxAncho: w - 30 });
    });
    cartel.position.set(0, -tam / 2 - 0.07, 0);
    nodo.add(cartel);
    nodo.userData.redibujar = () => cartel.redibujar();
    this.zona.add(nodo);
    this.m.fx.aparecer(nodo, 0.4);
    this.cadaCuadro((_dt, t) => {
      m.rotation.y = Math.sin(t * 0.8 + posicion.x * 3) * 0.5;
    });
    this.interactivo(m, {
      alPasar: (v) => m.scale.setScalar(v ? 1.18 : 1),
      alSeleccionar: () => {
        this.m.audio.pop(this.posMundo(m));
        alTocar?.();
      },
    });
    let pulso = null;
    return {
      obj: nodo,
      modelo: m,
      id,
      mostrarNombre: () => {
        estado.visible = true;
        cartel.redibujar();
      },
      marcar: (modo) => {
        estado.marca = modo === 'correcto' ? '✓' : modo === 'incorrecto' ? '✗' : '';
        if (modo === 'correcto') estado.visible = true;
        cartel.redibujar();
        if (modo === 'correcto') this.m.fx.giro?.(m) ?? this.m.fx.latido(m, 0.25);
        if (modo === 'incorrecto') this.m.fx.latido(m, -0.15);
      },
      resaltar: (v) => {
        pulso?.();
        pulso = v ? this._pulsar(nodo) : null;
      },
      habilitar: (v) => this.m.entrada.habilitar(m, v),
    };
  }

  _limpiarZona() {
    for (const o of [...this.zona.children]) {
      o.traverse((x) => this.m.entrada.desregistrar(x));
      o.removeFromParent();
    }
    this.ayuda = null;
  }

  _posFila(i, n, { y = this.H - 0.32, separacion = 0.58, z = -0.95 } = {}) {
    const x = (i - (n - 1) / 2) * separacion;
    return V(x, y, z + Math.abs(x) * 0.12);
  }

  _fallo(meta) {
    this.reg[meta].errores++;
    this.perder();
    this.gesto('duda', 1.6);
  }

  _logro(meta, pos, puntos) {
    this.ganar(pos, puntos);
    if (this.reg[meta].hecho) return;
    this.reg[meta].hecho = true;
    this._actualizarCabecera();
  }

  /**
   * Elegir entre opciones (botones o productos). Al elegir se dice la opción (si tiene voz).
   * Correcta: se celebra. Incorrecta: pista del camarero y se repite la pregunta; al
   * segundo error se resalta la correcta (cuenta como ayuda). Resuelve con la opción correcta.
   */
  _elegir(meta, items, { pregunta = null } = {}) {
    return new Promise((resolver) => {
      let bloqueado = false;
      let errores = 0;
      const correctas = items.filter((it) => it.correcta);
      const mostrarRespuesta = () => {
        correctas.forEach((c) => c.resaltar(true));
        if (!this.traducir) this.alternarTraduccion(true, false);
      };
      this.ayuda = { meta, fn: mostrarRespuesta };
      for (const it of items) {
        it.alElegir = async () => {
          if (bloqueado) return;
          bloqueado = true;
          items.forEach((x) => x.habilitar(false));
          if (it.linea) await this.decir(it.linea);
          if (this._destruida) return;
          if (it.correcta) {
            it.marcar('correcto');
            correctas.forEach((c) => c.resaltar(false));
            this.m.audio.acierto(this.posMundo(it.obj));
            this._logro(meta, it.obj, errores ? 50 : 100);
            this.gesto('celebra', 1.2);
            await this.esperar(0.6);
            this.ayuda = null;
            resolver(it);
            return;
          }
          errores++;
          it.fallado = true;
          it.marcar('incorrecto');
          this.m.audio.error(this.posMundo(it.obj));
          this._fallo(meta);
          if (it.retro) await this.decir(it.retro);
          if (errores >= 2) {
            this.reg[meta].ayuda = true;
            mostrarRespuesta();
          } else if (pregunta) await this.decir(pregunta, { repetible: true });
          if (this._destruida) return;
          it.marcar(it.obj.isMesh || it.estado ? 'apagado' : '');
          items.forEach((x) => !x.fallado && x.habilitar(true));
          bloqueado = false;
        };
      }
    });
  }

  /** Botones de respuesta para un grupo de "preguntas". */
  _opcionesDe(grupo) {
    const lista = barajar(this.datos.preguntas?.[grupo] ?? []).slice(0, 3);
    return lista.map((op, i) => {
      const it = this._opcion(op.en, op.es, () => it.alElegir?.());
      it.obj.position.copy(this._posFila(i, lista.length));
      it.obj.lookAt(0, this.H, 0.2);
      this.zona.add(it.obj);
      this.m.fx.aparecer(it.obj, 0.35, 0.1 + i * 0.08);
      return Object.assign(it, { correcta: op.correcta, linea: op, retro: op.retro, op });
    });
  }

  /**
   * Armar la frase tocando tarjetas en orden. Con "guias" se numeran los espacios.
   * Al terminar aparece "Confirm" y se escucha la frase completa (línea "pedido").
   */
  _ordenar(meta, partes, pedido, { guias = true } = {}) {
    const { H } = this;
    return new Promise((resolver) => {
      const llenas = [];
      let errores = 0;
      let erroresAqui = 0;
      const slots = new PanelLienzo(1.3, 0.2, (ctx, w, h) => {
        const ancho = (w - 80) / 3;
        partes.forEach((p, i) => {
          const x = 20 + i * (ancho + 20);
          rectRedondeado(ctx, x, 14, ancho, 110, 26);
          ctx.fillStyle = llenas[i] ? '#e8f7ee' : 'rgba(255,255,255,0.92)';
          ctx.fill();
          ctx.lineWidth = i === llenas.length ? 10 : 5;
          ctx.strokeStyle = llenas[i] ? COLORES.verde : i === llenas.length ? '#ffb000' : '#9aa6c2';
          ctx.setLineDash(llenas[i] ? [] : [18, 12]);
          ctx.stroke();
          ctx.setLineDash([]);
          if (llenas[i]) escribir(ctx, llenas[i], x + ancho / 2, 70, { tam: 44, tamMin: 28, peso: 800, color: COLORES.texto, alinear: 'center', base: 'middle', maxAncho: ancho - 20 });
          else if (guias) escribir(ctx, String(i + 1), x + ancho / 2, 70, { tam: 52, peso: 900, color: '#c3cbe0', alinear: 'center', base: 'middle' });
        });
        if (this.traducir && guias && pedido?.es) escribir(ctx, pedido.es, w / 2, 160, { tam: 30, peso: 600, color: '#ffffff', alinear: 'center', base: 'middle' });
      });
      slots.position.set(0, H - 0.07, -1.0);
      slots.lookAt(0, H, 0.2);
      slots.userData.redibujar = () => slots.redibujar();
      this.zona.add(slots);
      this.m.fx.aparecer(slots, 0.35);

      let orden = barajar(partes);
      for (let k = 0; k < 5 && orden.every((p, i) => p === partes[i]); k++) orden = barajar(partes);
      const tarjetas = orden.map((texto, i) => {
        const t = this._opcion(texto, null, () => tocar(t), { ancho: 0.4, alto: 0.15, color: '#fff4cc' });
        t.texto = texto;
        t.obj.position.copy(this._posFila(i, orden.length, { separacion: 0.46 }));
        t.obj.lookAt(0, H, 0.2);
        this.zona.add(t.obj);
        this.m.fx.aparecer(t.obj, 0.35, 0.15 + i * 0.08);
        return t;
      });
      const resaltarSiguiente = () => tarjetas.forEach((t) => t.resaltar(t.texto === partes[llenas.length]));
      this.ayuda = { meta, fn: resaltarSiguiente };

      const tocar = async (t) => {
        if (t.texto === partes[llenas.length]) {
          llenas.push(t.texto);
          erroresAqui = 0;
          t.resaltar(false);
          t.habilitar(false);
          this.m.audio.tono(700 + llenas.length * 160, 0.12, { volumen: 0.12 });
          const destino = V(-0.43 + (llenas.length - 1) * 0.43, H - 0.07, -0.99);
          this.m.fx.moverA(t.obj, destino, 0.3);
          this.m.fx.tween({ duracion: 0.3, alActualizar: (k) => t.obj.scale.setScalar(Math.max(0.001, 1 - k)) });
          slots.redibujar();
          if (llenas.length === partes.length) confirmar();
          return;
        }
        errores++;
        erroresAqui++;
        t.marcar('incorrecto');
        this.m.audio.error(this.posMundo(t.obj));
        this.m.fx.latido(t.obj, -0.12);
        this._fallo(meta);
        setTimeout(() => !this._destruida && t.marcar('normal'), 450);
        await this.decir(`pista${llenas.length + 1}`);
        if (erroresAqui >= 2) {
          this.reg[meta].ayuda = true;
          resaltarSiguiente();
        }
      };

      const confirmar = () => {
        this.ayuda = null;
        const b = this._opcion('✔ Confirm', 'Confirmar', async () => {
          b.habilitar(false);
          b.marcar('correcto');
          await this.decir(pedido);
          this.m.audio.acierto(this.posMundo(b.obj));
          this._logro(meta, b.obj, errores ? 60 : 150);
          await this.esperar(0.3);
          this._limpiarZona();
          resolver();
        }, { ancho: 0.46, alto: 0.15, color: '#bff0d4' });
        b.obj.position.set(0, H - 0.32, -0.95);
        b.obj.lookAt(0, H, 0.2);
        this.zona.add(b.obj);
        this.m.fx.aparecer(b.obj, 0.35);
        b.resaltar(true);
      };
    });
  }

  /** Coco pone un producto en el mostrador (vuela de su ala al mostrador). */
  entregar(id, x) {
    const p = this.prod[id];
    const nodo = new THREE.Group();
    const m = this.modelo(p.modelo, { tamano: p.tipo === 'bebida' ? 0.17 : 0.2, ...(p.opciones ?? {}) });
    const alto = m.userData.tam?.y ?? 0.15;
    m.position.y = alto / 2;
    nodo.add(m);
    const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.014, 28), new THREE.MeshToonMaterial({ color: '#ffffff' }));
    plato.position.y = -0.006;
    if (p.tipo === 'comida') nodo.add(plato);
    const ini = V(0.28, 1.2, -1.75);
    const fin = V(x, MOSTRADOR.alto + 0.008, MOSTRADOR.z + 0.06);
    nodo.position.copy(ini);
    nodo.scale.setScalar(0.4);
    this.raiz.add(nodo);
    m.userData.producto = id;
    this.enMostrador.push({ id, nodo, modelo: m });
    this.gesto('entrega', 0.9);
    this.m.fx.tween({
      duracion: 0.75,
      alActualizar: (k) => {
        nodo.position.lerpVectors(ini, fin, k);
        nodo.position.y += Math.sin(k * Math.PI) * 0.18;
        nodo.scale.setScalar(0.4 + 0.6 * k);
      },
      alTerminar: () => {
        this.m.audio.tono(520, 0.06, { volumen: 0.12, pos: this.posMundo(nodo) });
        this.m.audio.tono(380, 0.08, { volumen: 0.08, retardo: 0.05, pos: this.posMundo(nodo) });
      },
    });
    return this.enMostrador[this.enMostrador.length - 1];
  }

  _vaciarMostrador() {
    for (const { nodo, modelo } of this.enMostrador.splice(0)) {
      this.m.entrada.desregistrar(modelo);
      this.m.fx.tween({ duracion: 0.4, alActualizar: (k) => nodo.scale.setScalar(Math.max(0.001, 1 - k)), alTerminar: () => nodo.removeFromParent() });
    }
  }

  _etapa(n) {
    this.fase = n;
    this.dialogo = null;
    this._actualizarCabecera();
    this.m.audio.tono(880, 0.1, { volumen: 0.08 });
    this.m.audio.tono(1320, 0.14, { volumen: 0.08, retardo: 0.1 });
  }

  // ── Las cinco etapas ─────────────────────────────────────────────────────

  async vozInicial() {
    try {
      await this.esperar(0.6);
      await this.bienvenida();
      await this.explorar();
      await this.pedidoGuiado();
      await this.misionFinal();
      await this.comprobarYDespedir();
    } catch (e) {
      if (!this._destruida) throw e;
    }
  }

  async bienvenida() {
    this._etapa(0);
    this._ponerPaso('controles');
    this.gesto('saludo', 2.2);
    await this.decir('hola', { repetible: true });
    this._ponerPaso('saludo', `\n${this.datos.pasos?.controles ?? ''}`);
    await this._elegir('saludar', this._opcionesDe('saludo'), { pregunta: 'hola' });
    this._limpiarZona();
    this.gesto('saludo', 1.2);
    await this.decir('encantado');
  }

  async explorar() {
    const { H } = this;
    this._etapa(1);
    this._ponerPaso('explora', ' (0/5)');
    const ids = this.datos.productos.map((p) => p.id);
    const vistos = new Set();
    let listo = null;
    const terminado = new Promise((r) => (listo = r));
    let boton = null;
    const items = ids.map((id, i) => {
      const angulo = THREE.MathUtils.degToRad((i - (ids.length - 1) / 2) * 15.5);
      const pos = V(Math.sin(angulo) * 1.02, H - 0.1, -Math.cos(angulo) * 1.02);
      const it = this._producto(id, pos, {
        alTocar: async () => {
          it.mostrarNombre();
          this.m.fx.latido(it.modelo, 0.3);
          vistos.add(id);
          this._ponerPaso('explora', ` (${Math.min(vistos.size, 5)}/5)`);
          await this.decir(this.prod[id].nombre);
          if (vistos.size >= 5 && !boton) {
            boton = this.boton(`I'm ready ▶`, () => listo(), { ancho: 0.42, alto: 0.13, color: COLORES.verde, tam: 40 });
            boton.position.set(0, H - 0.36, -0.92);
            boton.lookAt(0, H, 0.2);
            this.zona.add(boton);
            this.m.fx.aparecer(boton, 0.4);
          }
          if (vistos.size === ids.length) listo();
        },
      });
      return it;
    });
    await this.decir('mira', { repetible: true });
    await terminado;
    items.forEach((it) => it.habilitar(false));
    this._limpiarZona();
    this.ayuda = null;

    // Pedido modelo: un cliente pide una galleta
    const m = this.datos.modelo;
    this._ponerPaso('modelo');
    this.cliente = this.crearPersona({ expresion: 'feliz', ...m.cliente }, [0.62, 0, -0.62], { ry: Math.atan2(-0.62, -1.33) });
    this.gestosAlHablar(this.cliente);
    this.presentar(this.cliente, 0.1);
    await this.decir('otroCliente');
    this.dialogo = [];
    const linea = async (clave) => {
      this.dialogo.push(this.lin[clave]);
      this._actualizarCabecera();
      await this.decir(clave);
      await this.esperar(0.3);
    };
    await linea('clientePide');
    const galleta = this.entregar(m.producto, 0.4);
    await linea('seguro');
    await linea('clienteGracias');
    const ini = galleta.nodo.position.clone();
    this.m.fx.tween({ duracion: 0.6, alActualizar: (k) => galleta.nodo.position.lerpVectors(ini, V(0.6, 0.85, -0.8), k), alTerminar: () => galleta.nodo.removeFromParent() });
    this.enMostrador = this.enMostrador.filter((x) => x !== galleta);
    const c = this.cliente;
    const p0 = c.position.clone();
    this.m.fx.tween({
      duracion: 1.4,
      alActualizar: (k) => {
        c.rotation.y = THREE.MathUtils.lerp(c.rotation.y, 0.4, 0.1);
        c.position.lerpVectors(p0, V(2.2, 0, 0.6), k);
        if (k > 0.75) c.scale.setScalar(Math.max(0.001, (1 - k) / 0.25));
      },
      alTerminar: () => c.removeFromParent(),
    });
    this.cliente = null;
    await this.esperar(0.6);

    // Escucha: ¿dónde está el jugo?
    this.dialogo = null;
    this._ponerPaso('escucha');
    const e = this.datos.escucha;
    const opciones = barajar(e.opciones);
    const productos = opciones.map((id, i) => {
      const it = this._producto(id, this._posFila(i, opciones.length, { y: H - 0.18, separacion: 0.42 }), { tam: 0.18, alTocar: () => it.alElegir?.() });
      return Object.assign(it, { correcta: id === e.objetivo, retro: 'escuchaRetro' });
    });
    await this.decir('escucha', { repetible: true });
    const bien = await this._elegir('bebida', productos, { pregunta: 'escucha' });
    bien.mostrarNombre();
    await this.decir('bien');
    await this.esperar(0.4);
    this._limpiarZona();
  }

  async pedidoGuiado() {
    const { H } = this;
    const g = this.datos.guiado;
    this._etapa(2);
    this._ponerPaso('eligeComida');
    let elegida = null;
    let listo = null;
    const terminado = new Promise((r) => (listo = r));
    const items = g.comidas.map((id, i) => {
      const it = this._producto(id, this._posFila(i, g.comidas.length, { y: H - 0.18, separacion: 0.42 }), {
        tam: 0.2,
        etiqueta: true,
        alTocar: async () => {
          if (elegida) return;
          elegida = id;
          items.forEach((x) => x.habilitar(false));
          it.marcar('correcto');
          await this.decir(this.prod[id].nombre);
          listo();
        },
      });
      return it;
    });
    await this.decir('queQuiere', { repetible: true });
    await terminado;
    await this.esperar(0.4);
    this._limpiarZona();
    const comida = this.prod[elegida];
    this._ponerPaso('ordena');
    await this.decir('conTarjetas', { repetible: true });
    await this._ordenar('pedido', [g.inicio, comida.tarjeta, g.fin], comida.pedido, { guias: true });
    this.gesto('celebra', 1.2);
    await this.decir(comida.confirma);
    this.entregar(elegida, -0.25);
    await this.esperar(0.5);

    this._ponerPaso('bebida');
    const opciones = this._opcionesDe('aguaOJugo');
    await this.decir('aguaOJugo', { repetible: true });
    const r = await this._elegir('responder', opciones, { pregunta: 'aguaOJugo' });
    this._limpiarZona();
    this.entregar(r.op.producto, 0.25);
    await this.decir('aquiTiene');
    await this.esperar(0.6);
    this.gesto('celebra', 1.2);
    await this.decir('disfruta');
    this._vaciarMostrador();
  }

  async misionFinal() {
    const { H } = this;
    const mi = this.datos.mision;
    this._etapa(3);
    this.mision = [
      { id: mi.comida, emoji: this.prod[mi.comida].emoji, ok: false },
      { id: mi.bebida, emoji: this.prod[mi.bebida].emoji, ok: false },
    ];
    // Menos ayuda: sin traducción (se puede recuperar con 🇪🇸 o 💡)
    if (this.traducir) this.alternarTraduccion(false, false);
    this._ponerPaso('misionComida');
    await this.decir('mision', { repetible: true });

    const comidas = barajar(mi.opcionesComida);
    const tarjetas = comidas.map((id, i) => {
      const it = this._opcion(this.prod[id].tarjeta, this.prod[id].nombre?.es, () => it.alElegir?.(), { ancho: 0.42, color: '#fff4cc' });
      it.obj.position.copy(this._posFila(i, comidas.length, { separacion: 0.48 }));
      it.obj.lookAt(0, H, 0.2);
      this.zona.add(it.obj);
      this.m.fx.aparecer(it.obj, 0.35, 0.1 + i * 0.08);
      return Object.assign(it, { correcta: id === mi.comida, retro: 'misionComidaRetro' });
    });
    await this._elegir('pedido', tarjetas, { pregunta: 'mision' });
    this._limpiarZona();
    const comida = this.prod[mi.comida];
    this._ponerPaso('misionOrdena');
    await this._ordenar('pedido', [this.datos.guiado.inicio, comida.tarjeta, this.datos.guiado.fin], comida.pedido, { guias: false });
    this.mision[0].ok = true;
    this._actualizarCabecera();
    await this.decir(comida.confirma);

    this._ponerPaso('misionBebida');
    await this.decir('beber', { repetible: true });
    await this._elegir('bebida', this._opcionesDe('misionBebida'), { pregunta: 'beber' });
    this._limpiarZona();
    this.mision[1].ok = true;
    this._actualizarCabecera();

    this._ponerPaso('algoMas');
    await this.decir('algoMas', { repetible: true });
    await this._elegir('responder', this._opcionesDe('algoMas'), { pregunta: 'algoMas' });
    this._limpiarZona();
    await this.decir('entrega');
    this.entregar(mi.comida, -0.32);
    await this.esperar(0.35);
    this.entregar(mi.bebida, -0.02);
    await this.esperar(0.35);
    this.entregar(mi.extra, 0.36);
    await this.esperar(0.8);
  }

  async comprobarYDespedir() {
    const mi = this.datos.mision;
    this._etapa(4);
    this._ponerPaso('comprueba');
    this.mision.forEach((m) => (m.ok = false));
    this._actualizarCabecera();
    await this.decir('esTuPedido', { repetible: true });
    const meta = 'comprobar';
    const pedidos = new Set([mi.comida, mi.bebida]);
    const tocados = new Set();
    let errores = 0;
    await new Promise((resolver) => {
      const resaltar = () => this.enMostrador.forEach((x) => pedidos.has(x.id) && !tocados.has(x.id) && this.m.fx.latido(x.modelo, 0.3));
      this.ayuda = { meta, fn: resaltar };
      for (const x of this.enMostrador) {
        this.interactivo(x.modelo, {
          alPasar: (v) => x.modelo.scale.setScalar(v ? 1.15 : 1),
          alSeleccionar: async () => {
            if (tocados.has(x.id)) return;
            if (pedidos.has(x.id)) {
              tocados.add(x.id);
              this.m.entrada.habilitar(x.modelo, false);
              this.m.audio.acierto(this.posMundo(x.modelo));
              this.m.fx.latido(x.modelo, 0.3);
              const m = this.mision.find((y) => y.id === x.id);
              if (m) m.ok = true;
              this._actualizarCabecera();
              await this.decir(this.prod[x.id].nombre);
              if (tocados.size === pedidos.size) {
                this._logro(meta, x.modelo, errores ? 50 : 100);
                this.ayuda = null;
                resolver();
              }
              return;
            }
            errores++;
            this.m.audio.error(this.posMundo(x.modelo));
            this.m.fx.latido(x.modelo, -0.15);
            this._fallo(meta);
            await this.decir('noPediste');
            if (errores >= 2) {
              this.reg[meta].ayuda = true;
              resaltar();
            }
          },
        });
      }
    });
    for (const x of this.enMostrador) this.m.entrada.desregistrar(x.modelo);
    this.gesto('celebra', 1.2);
    await this.decir('siEsTuPedido');
    await this.decir('disfrutaComida', { repetible: true });

    this._ponerPaso('despedida');
    await this._elegir('despedirse', this._opcionesDe('despedida'), { pregunta: 'disfrutaComida' });
    this._limpiarZona();
    this.gesto('adios', 2.4);
    await this.decir('adios');
    this._resultados();
  }

  // ── Cierre: logros ───────────────────────────────────────────────────────

  _resultados() {
    const { H } = this;
    this.ayuda = null;
    this.m.audio.exito();
    const seg = Math.round((performance.now() - this.inicio) / 1000);
    const solos = METAS.filter(([id]) => this.reg[id].hecho && !this.reg[id].errores && !this.reg[id].ayuda).length;
    this.registro = {
      metas: Object.fromEntries(METAS.map(([id]) => [id, { ...this.reg[id], independiente: this.reg[id].hecho && !this.reg[id].errores && !this.reg[id].ayuda }])),
      usosTraduccion: this.usosTraduccion,
      segundos: seg,
    };
    this.burbuja.visible = false;
    const panel = new PanelLienzo(1.04, 0.72, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 40, borde: '#f2c45a', grosor: 10 });
      escribir(ctx, '🏆 Your achievements · Tus logros', 36, 26, { tam: 42, peso: 900 });
      let y = 96;
      for (const [id, nombre, emoji] of METAS) {
        const r = this.reg[id];
        const estado = (!r.hecho ? '—' : !r.errores && !r.ayuda ? '⭐ Solo' : r.ayuda ? '✔ Con ayuda' : '✔ Con reintentos') + (r.errores ? ` · ↺ ${r.errores}` : '');
        const color = !r.hecho ? COLORES.suave : !r.errores && !r.ayuda ? '#1b7a45' : '#b06a1f';
        escribir(ctx, `${emoji} ${nombre}`, 40, y, { tam: 34, peso: 700 });
        escribir(ctx, estado, w - 40, y, { tam: 30, peso: 800, color, alinear: 'right' });
        y += 62;
      }
      const msg = solos === METAS.length ? '🎉 ¡Excelente! Pediste en inglés sin ayuda.' : solos >= 4 ? '👏 ¡Muy bien! Ya casi lo logras todo solo.' : '💪 ¡Buen trabajo! Repite la cafetería para hacerlo con menos ayuda.';
      escribir(ctx, msg, 40, y + 8, { tam: 30, peso: 700, color: '#23304a', maxAncho: w - 80 });
      escribir(ctx, `🌐 Traducción usada: ${this.usosTraduccion} · ⏱ ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`, 40, y + 58, { tam: 26, color: COLORES.suave });
    });
    panel.position.set(-0.4, H + 0.04, -1.22);
    panel.lookAt(0, H, 0.2);
    this.raiz.add(panel);
    this.m.fx.aparecer(panel, 0.5);
    this.m.fx.confeti(this.posMundo(this.coco).add(V(0, 1.4, 0.3)), 120);
    this.paso = '';
    this._actualizarCabecera();
    this.mostrarContinuar(V(0.6, H - 0.36, -0.95));
  }
}
