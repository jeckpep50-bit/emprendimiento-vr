import * as THREE from 'three';
import { suavizado } from '../core/efectos.js';
import { liberar } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, fuente, tarjeta, pastilla } from '../ui/lienzo.js';

export const CANCELADO = Symbol('cancelado');
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ETIQUETAS = {
  w: { nombre: '🪱 Wiggles', color: '#e5487a' },
  n: { nombre: '🎬 Narrator', color: '#4f7cff' },
};

/**
 * Director de una película inmersiva: reproduce capítulos escritos como funciones
 * async (`await d.di('linea')`, `await d.espera(2)`, `await d.tocar(...)`), con
 * narración en audio, subtítulos, música, pausa y salto de capítulo.
 * Todo lo que espera respeta la pausa y se cancela al cambiar de capítulo.
 *
 * guion: { lineas, carpeta, capitulos: [{ id, titulo, emoji, correr(d) }],
 *          escenarios: { nombre: (d) => { grupo, animar?, opaco?, luz?, fondo?, niebla? } },
 *          preparar?(d) }
 */
export class Director {
  constructor(escena, guion) {
    this.escena = escena;
    this.m = escena.m;
    this.H = escena.H;
    this.raiz = escena.raiz;
    this.guion = guion;
    this.pausado = false;
    this.capitulo = 0;
    this._token = 0;
    this._esperas = new Set();
    this._animaciones = new Set();
    this._cada = [];
    this._interactivos = [];
    this._buffers = new Map();
    this._voz = null;
    this.personajes = {};
    this.plato = new THREE.Group();
    this.raiz.add(this.plato);
    this.set = null;
    this.musica = new Musica(this.m.audio);
    this._crearHud();
    escena.cadaCuadro((dt, t) => this._cuadro(dt, t));
    guion.preparar?.(this);
  }

  get enAR() {
    return Boolean(this.m.app.enAR);
  }

  // ── Reproducción ─────────────────────────────────────────────────────────

  async reproducir(desde = 0) {
    this._detenido = false;
    this.musica.iniciar('alegre');
    let i = Math.max(0, Math.min(desde, this.guion.capitulos.length - 1));
    while (i < this.guion.capitulos.length && !this._detenido) {
      this.capitulo = i;
      this._saltoA = null;
      this._actualizarMenu();
      this._precargar(i);
      try {
        await this.guion.capitulos[i].correr(this);
      } catch (e) {
        if (e !== CANCELADO) console.error('Error en el capítulo', i + 1, e);
      }
      this._limpiarCapitulo();
      if (this._detenido) return;
      i = this._saltoA ?? i + 1;
    }
    if (!this._detenido) this._final();
  }

  detener() {
    this._detenido = true;
    this._cancelar();
    this.musica.detener();
    this.m.app.sinLocomocion = false;
  }

  /** Salta a otro capítulo (cancela lo que se esté reproduciendo). */
  irACapitulo(i) {
    this.reanudar();
    this._saltoA = Math.max(0, Math.min(i, this.guion.capitulos.length - 1));
    this._cancelar();
  }

  pausar() {
    if (this.pausado) return;
    this.pausado = true;
    this._voz?.pausar();
    this.musica.pausar();
    window.speechSynthesis?.pause?.();
    this.menu.visible = true;
    this.m.fx.aparecer(this.menu, 0.3);
    this._actualizarBotonPausa();
  }

  reanudar() {
    if (!this.pausado) return;
    this.pausado = false;
    this._voz?.reanudar();
    this.musica.reanudar();
    window.speechSynthesis?.resume?.();
    this.menu.visible = false;
    this._actualizarBotonPausa();
  }

  _cancelar() {
    this._token++;
    this._voz?.detener();
    this._voz = null;
    window.speechSynthesis?.cancel?.();
    for (const e of [...this._esperas]) e.rechazar(CANCELADO);
    this._esperas.clear();
    this._animaciones.clear();
  }

  /** Lanza CANCELADO si el capítulo cambió mientras se esperaba algo. */
  verificar(token) {
    if (token !== this._token || this._detenido) throw CANCELADO;
  }

  _limpiarCapitulo() {
    this._cancelar();
    for (const o of this._interactivos) this.m.entrada.desregistrar(o);
    this._interactivos = [];
    this._cada = [];
    for (const hijo of [...this.plato.children]) {
      this.plato.remove(hijo);
      liberar(hijo);
    }
    this.subtitulo.visible = false;
    this.m.fx.fundido(false, 0.2);
  }

  _cuadro(dt, t) {
    this._actualizarVoz();
    if (this.pausado) return;
    for (const e of [...this._esperas]) {
      if (e.resta === undefined) continue;
      e.resta -= dt;
      if (e.resta <= 0) e.resolver();
    }
    for (const a of [...this._animaciones]) {
      if (a.retardo > 0) {
        a.retardo -= dt;
        continue;
      }
      a.t = Math.min(1, a.t + dt / a.duracion);
      a.alActualizar(a.curva(a.t), dt);
      if (a.t >= 1) {
        this._animaciones.delete(a);
        a.resolver();
      }
    }
    for (const fn of this._cada) fn(dt, t);
    this.set?.animar?.(dt, t);
  }

  // ── Primitivas para los capítulos ────────────────────────────────────────

  /** Promesa que se puede cancelar. `iniciar(resolver)` puede devolver una función de limpieza. */
  _esperar(iniciar, resta) {
    let entrada;
    const promesa = new Promise((resolver, rechazar) => {
      entrada = { resta, limpiar: null };
      entrada.resolver = (v) => {
        if (!this._esperas.has(entrada)) return;
        this._esperas.delete(entrada);
        entrada.limpiar?.();
        resolver(v);
      };
      entrada.rechazar = (e) => {
        this._esperas.delete(entrada);
        entrada.limpiar?.();
        rechazar(e);
      };
      this._esperas.add(entrada);
    });
    entrada.limpiar = iniciar?.(entrada.resolver) ?? null;
    promesa.catch(() => {});
    return promesa;
  }

  /** Espera `seg` segundos (se detiene durante la pausa). */
  espera(seg) {
    return this._esperar(null, seg);
  }

  /** Animación que respeta la pausa: alActualizar(k) con k de 0 a 1. */
  animar({ duracion = 1, alActualizar, curva = suavizado.entradaSalida, retardo = 0 }) {
    let a;
    const promesa = new Promise((resolver) => {
      a = { duracion, alActualizar, curva, retardo, t: 0, resolver };
      this._animaciones.add(a);
    });
    return promesa;
  }

  /** Mueve un objeto (coordenadas de su padre). */
  mover(obj, destino, duracion = 1, curva = suavizado.entradaSalida, retardo = 0) {
    const inicio = obj.position.clone();
    const fin = destino.clone();
    return this.animar({ duracion, curva, retardo, alActualizar: (k) => obj.position.lerpVectors(inicio, fin, k) });
  }

  escalar(obj, escala, duracion = 0.6, curva = suavizado.rebote, retardo = 0) {
    const inicio = obj.scale.x;
    return this.animar({ duracion, curva, retardo, alActualizar: (k) => obj.scale.setScalar(Math.max(0.001, inicio + (escala - inicio) * k)) });
  }

  /** Hace aparecer un objeto con un rebote. */
  aparecer(obj, duracion = 0.6, retardo = 0) {
    const final = obj.userData.escalaFinal ?? (obj.userData.escalaFinal = obj.scale.x || 1);
    obj.scale.setScalar(0.001);
    return this.animar({ duracion, retardo, curva: suavizado.rebote, alActualizar: (k) => obj.scale.setScalar(Math.max(0.001, final * k)) });
  }

  /** Función que se ejecuta cada cuadro mientras dure el capítulo. */
  cada(fn) {
    this._cada.push(fn);
  }

  /** Agrega un objeto al plato del capítulo (se borra al terminar el capítulo). */
  poner(obj, x = 0, y = 0, z = 0) {
    obj.position.set(x, y, z);
    this.plato.add(obj);
    return obj;
  }

  // ── Voz y subtítulos ─────────────────────────────────────────────────────

  _url(id) {
    return `${this.guion.carpeta}/${id}.mp3`;
  }

  _cargar(id) {
    if (!this._buffers.has(id)) {
      const ctx = this.m.audio.ctx;
      const p = ctx
        ? fetch(this._url(id))
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => ctx.decodeAudioData(b))
            .catch(() => null)
        : Promise.resolve(null);
      this._buffers.set(id, p);
    }
    return this._buffers.get(id);
  }

  /** Precarga los audios del capítulo actual y del siguiente; libera los demás. */
  _precargar(i) {
    const prefijos = [this.guion.capitulos[i]?.id, this.guion.capitulos[i + 1]?.id].filter(Boolean);
    const necesarias = new Set(Object.keys(this.guion.lineas).filter((id) => prefijos.some((p) => id.startsWith(`${p}_`)) || /^(t\d+|bien_|intento|wow|p_)/.test(id)));
    for (const id of [...this._buffers.keys()]) if (!necesarias.has(id)) this._buffers.delete(id);
    for (const id of necesarias) this._cargar(id);
  }

  /**
   * Dice una línea del guion: subtítulos + voz. Resuelve cuando termina de hablar.
   * opciones: { pausa: segundos de silencio después (0.35) }
   */
  async di(id, { pausa = 0.35 } = {}) {
    const token = this._token;
    this.verificar(token);
    const [quien, texto] = this.guion.lineas[id] ?? ['n', id];
    const buffer = await this._cargar(id);
    this.verificar(token);
    this._mostrarSubtitulo(quien, texto);
    await this._hablar(buffer, quien, texto);
    this.verificar(token);
    if (pausa) await this.espera(pausa);
  }

  /** Duración (s) que tendrá una línea al decirse (para sincronizar animaciones con la voz). */
  async duracion(id) {
    const buffer = await this._cargar(id);
    const [quien, texto] = this.guion.lineas[id] ?? ['n', id];
    if (buffer) return buffer.duration / (quien === 'w' ? 1.12 : 1);
    return Math.max(1.5, texto.split(/\s+/).length * 0.42);
  }

  /** Dice una línea y, a la vez, ejecuta `acciones` en momentos de la línea: [[fracción 0..1, fn], ...]. */
  async diCon(id, acciones, opciones) {
    const dur = await this.duracion(id);
    for (const [fraccion, fn] of acciones) this.espera(Math.max(0.01, dur * fraccion)).then(fn, () => {});
    await this.di(id, opciones);
  }

  /** Frase corta de reacción que no detiene la película (solo si nadie está hablando). */
  decir(id) {
    if (this._voz) return;
    const [quien, texto] = this.guion.lineas[id] ?? [];
    if (!texto) return;
    this._cargar(id).then((buffer) => {
      if (!buffer || this._voz || this.pausado) return;
      this._mostrarSubtitulo(quien, texto);
      this._hablar(buffer, quien, texto).catch(() => {});
    });
  }

  _hablar(buffer, quien, texto) {
    const ctx = this.m.audio.ctx;
    if (!buffer || !ctx) {
      // Sin audio: se usa la voz del navegador (si existe) y una duración estimada.
      const palabras = texto.split(/\s+/).length;
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const f = new SpeechSynthesisUtterance(texto.replace(/\*/g, ''));
          f.lang = 'en-US';
          f.rate = 0.9;
          f.pitch = quien === 'w' ? 1.4 : 1;
          window.speechSynthesis.speak(f);
        }
      } catch {}
      this._progresoVoz = { inicio: this.m.app.tiempo, duracion: Math.max(1.5, palabras * 0.42) };
      return this.espera(this._progresoVoz.duracion);
    }
    const velocidad = quien === 'w' ? 1.12 : 1;
    const personaje = this.personajes[quien];
    const salida = this.m.audio.maestro;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 1.15;
    const analizador = ctx.createAnalyser();
    analizador.fftSize = 512;
    ganancia.connect(analizador);
    let panner = null;
    if (personaje?.objeto) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.2;
      analizador.connect(panner).connect(salida);
    } else {
      analizador.connect(salida);
    }
    this._voz?.detener();
    this.musica.atenuar(true);
    return this._esperar((resolver) => {
      let fuente = null;
      let inicio = 0;
      let offset = 0;
      let activa = true;
      const duracion = buffer.duration / velocidad;
      const arrancar = () => {
        fuente = ctx.createBufferSource();
        fuente.buffer = buffer;
        fuente.playbackRate.value = velocidad;
        fuente.connect(ganancia);
        fuente.onended = () => {
          if (activa && !this.pausado) terminar();
        };
        inicio = ctx.currentTime;
        fuente.start(0, offset);
      };
      const terminar = () => {
        activa = false;
        if (this._voz === control) this._voz = null;
        this.musica.atenuar(false);
        personaje?.hablar?.(0);
        resolver();
      };
      const control = {
        quien,
        analizador,
        panner,
        personaje,
        datos: new Uint8Array(analizador.fftSize),
        progreso: () => Math.min(1, (offset / velocidad + (activa && fuente && !this.pausado ? ctx.currentTime - inicio : 0)) / duracion),
        pausar: () => {
          if (!fuente) return;
          offset += (ctx.currentTime - inicio) * velocidad;
          fuente.onended = null;
          fuente.stop();
          fuente = null;
        },
        reanudar: () => {
          if (activa && !fuente) arrancar();
        },
        detener: () => {
          activa = false;
          if (fuente) {
            fuente.onended = null;
            try {
              fuente.stop();
            } catch {}
          }
          personaje?.hablar?.(0);
          this.musica.atenuar(false);
        },
      };
      this._voz = control;
      arrancar();
      return () => {
        if (activa) control.detener();
        setTimeout(() => ganancia.disconnect(), 200);
      };
    });
  }

  _actualizarVoz() {
    const v = this._voz;
    if (v) {
      v.analizador.getByteTimeDomainData(v.datos);
      let suma = 0;
      for (let i = 0; i < v.datos.length; i += 4) {
        const x = (v.datos[i] - 128) / 128;
        suma += x * x;
      }
      const nivel = Math.min(1, Math.sqrt(suma / (v.datos.length / 4)) * 5);
      v.personaje?.hablar?.(this.pausado ? 0 : nivel);
      if (v.panner && v.personaje.objeto) {
        const p = v.personaje.objeto.getWorldPosition(V(0, 0, 0));
        const t = this.m.audio.ctx.currentTime;
        v.panner.positionX.setTargetAtTime(p.x, t, 0.05);
        v.panner.positionY.setTargetAtTime(p.y, t, 0.05);
        v.panner.positionZ.setTargetAtTime(p.z, t, 0.05);
      }
    }
    // Subtítulos tipo karaoke: las palabras ya dichas se ven más fuertes.
    const progreso = v ? v.progreso() : this._progresoVoz ? Math.min(1, (this.m.app.tiempo - this._progresoVoz.inicio) / this._progresoVoz.duracion) : 1;
    if (this.subtitulo.visible && Math.abs(progreso - this._sub.progreso) > 0.04) {
      this._sub.progreso = progreso;
      this.subtitulo.redibujar();
    }
  }

  // ── HUD: subtítulos, pausa y menú ────────────────────────────────────────

  _crearHud() {
    const { escena, H } = this;
    this.hud = new THREE.Group();
    this.raiz.add(this.hud);
    this._sub = { quien: 'n', texto: '', progreso: 1, extra: '' };
    this.subtitulo = new PanelLienzo(1.2, 0.27, (ctx, w, h) => this._dibujarSubtitulo(ctx, w, h));
    this.subtitulo.visible = false;
    this.hud.add(this.subtitulo);

    this.btnPausa = escena.boton('⏸', () => (this.pausado ? this.reanudar() : this.pausar()), { ancho: 0.11, alto: 0.11, color: '#23304a', tam: 54 });
    this.btnPausa.position.set(-0.68, 0.06, 0.01);
    this.hud.add(this.btnPausa);

    // Menú de pausa
    this.menu = new THREE.Group();
    this.menu.position.set(0, -0.42, 0.02);
    this.menu.visible = false;
    const fondo = new PanelLienzo(0.9, 0.5, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 40, borde: '#23304a', grosor: 8 });
      escribir(ctx, '⏸ Paused', w / 2, 30, { tam: 56, peso: 900, alinear: 'center' });
      escribir(ctx, this._textoMenu ?? '', w / 2, 110, { tam: 34, color: COLORES.suave, alinear: 'center', maxAncho: w - 60 });
    });
    this.menuFondo = fondo;
    this.menu.add(fondo);
    const opciones = [
      ['▶ Continue', () => this.reanudar(), COLORES.verde, -0.03],
      ['↺ Repeat part', () => this.irACapitulo(this.capitulo), COLORES.primario, -0.15],
      ['⏭ Next part', () => this.irACapitulo(this.capitulo + 1), COLORES.morado, -0.27 + 0.0],
    ];
    for (const [texto, accion, color, y] of opciones) {
      const b = escena.boton(texto, accion, { ancho: 0.5, alto: 0.1, color, tam: 36 });
      b.position.set(0, y + 0.02, 0.01);
      this.menu.add(b);
    }
    this.hud.add(this.menu);
    // Los subtítulos van un poco arriba de la vista: la acción ocurre a la altura de la mesa y del piso.
    escena.seguirMirada(this.hud, { distancia: 1.35, altura: H + 0.28, umbral: 0.75 });
  }

  _actualizarBotonPausa() {
    this.btnPausa.setTexto(this.pausado ? '▶' : '⏸');
  }

  _actualizarMenu() {
    const c = this.guion.capitulos[this.capitulo];
    this._textoMenu = `Part ${this.capitulo + 1} of ${this.guion.capitulos.length}: ${c?.titulo ?? ''}`;
    this.menuFondo?.redibujar();
  }

  _mostrarSubtitulo(quien, texto) {
    this._sub.quien = quien;
    this._sub.texto = texto;
    this._sub.progreso = 0;
    this._sub.extra = '';
    this._progresoVoz = null;
    this.subtitulo.visible = true;
    this.subtitulo.redibujar();
  }

  /** Texto grande extra debajo del subtítulo (p. ej. "🎤 Your turn!"). */
  aviso(texto) {
    this._sub.extra = texto;
    this.subtitulo.visible = true;
    this.subtitulo.redibujar();
  }

  _dibujarSubtitulo(ctx, w, h) {
    const s = this._sub;
    ctx.fillStyle = 'rgba(255, 253, 247, 0.96)';
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 40);
    ctx.fill();
    const et = ETIQUETAS[s.quien] ?? ETIQUETAS.n;
    ctx.lineWidth = 8;
    ctx.strokeStyle = et.color;
    ctx.stroke();
    pastilla(ctx, et.nombre, 30, 18, { tam: 30, fondo: et.color, color: '#ffffff' });
    if (s.extra) {
      escribir(ctx, s.extra, w / 2, h / 2 + 22, { tam: 70, peso: 900, color: COLORES.naranja, alinear: 'center', base: 'middle', maxAncho: w - 60 });
      return;
    }
    escribirRico(ctx, s.texto, 34, 76, w - 68, h - 92, s.progreso);
  }

  // ── Títulos, interacción y preguntas ─────────────────────────────────────

  /** Tarjeta de título del capítulo (con su narración). */
  async titulo(i) {
    const token = this._token;
    const c = this.guion.capitulos[i];
    const panel = new PanelLienzo(0.9, 0.42, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(20, 30, 60, 0.9)';
      ctx.beginPath();
      ctx.roundRect(6, 6, w - 12, h - 12, 50);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffc23c';
      ctx.stroke();
      escribir(ctx, `PART ${i + 1}`, w / 2, 36, { tam: 44, peso: 900, color: '#ffc23c', alinear: 'center' });
      escribir(ctx, c.emoji, w / 2, 170, { tam: 120, alinear: 'center', base: 'middle' });
      escribir(ctx, c.titulo, w / 2, 280, { tam: 76, peso: 900, color: '#ffffff', alinear: 'center', maxAncho: w - 60 });
    });
    panel.material.depthTest = false;
    panel.renderOrder = 900;
    this.escena.anteMirada(panel, { distancia: 1.4, dy: -0.12 });
    this.plato.add(panel);
    [523, 659, 784, 1047].forEach((f, k) => this.m.audio.tono(f, 0.25, { tipo: 'triangle', volumen: 0.08, retardo: k * 0.09 }));
    this.aparecer(panel, 0.6);
    await this.di(`t${i + 1}`, { pausa: 0.8 });
    this.verificar(token);
    await this.escalar(panel, 0.001, 0.4, suavizado.entradaSalida);
    panel.removeFromParent();
    liberar(panel);
  }

  /**
   * El estudiante puede tocar los objetos (con brillo). Resuelve cuando tocó todos
   * o cuando pasa el tiempo. alTocar(obj, i) se llama con cada uno. Devuelve cuántos tocó.
   */
  tocar(objetos, { tiempo = 12, alTocar, brillo = 0.45 } = {}) {
    let tocados = 0;
    const pendientes = new Set(objetos);
    const brillos = [];
    return this._esperar((resolver) => {
      for (const [i, obj] of objetos.entries()) {
        const b = crearBrillo(brillo * (obj.userData.tamBrillo ?? 1));
        if (obj.userData.centroBrillo) b.position.copy(obj.userData.centroBrillo);
        obj.add(b);
        brillos.push(b);
        this.m.entrada.registrar(obj, {
          proxy: true,
          alPasar: (v) => (b.userData.encima = v),
          alSeleccionar: () => {
            if (!pendientes.has(obj) || this.pausado) return;
            pendientes.delete(obj);
            this.m.entrada.desregistrar(obj);
            b.visible = false;
            tocados++;
            this.m.audio.pop(obj.getWorldPosition(V(0, 0, 0)));
            alTocar?.(obj, i);
            if (!pendientes.size) resolver(tocados);
          },
        });
        this._interactivos.push(obj);
      }
      const cam = this.m.app.camara;
      const cabeza = V(0, 0, 0);
      const fn = (_dt, t) => {
        cam.getWorldPosition(cabeza);
        for (const b of brillos) {
          b.lookAt(cabeza);
          b.material.opacity = (b.userData.encima ? 0.9 : 0.45) + Math.sin(t * 5) * 0.15;
          b.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
        }
      };
      this._cada.push(fn);
      return () => {
        for (const o of pendientes) this.m.entrada.desregistrar(o);
        for (const b of brillos) {
          b.removeFromParent();
          b.geometry.dispose();
          b.material.dispose();
        }
        this._cada = this._cada.filter((f) => f !== fn);
      };
    }, tiempo).then((v) => v ?? tocados);
  }

  /**
   * Pregunta con tarjetas grandes. opciones: [{ texto, emoji, color? }].
   * Devuelve el índice elegido o -1 si se acabó el tiempo. Marca la correcta.
   */
  pregunta(opciones, correcta, { tiempo = 15 } = {}) {
    const grupo = new THREE.Group();
    this.escena.anteMirada(grupo, { distancia: 1.3, dy: -0.12 });
    this.plato.add(grupo);
    this.ultimaPregunta = grupo;
    const estados = opciones.map(() => ({ modo: 'normal', encima: false }));
    const tarjetas = opciones.map((op, i) => {
      const est = estados[i];
      const color = op.color ?? COLORES.primario;
      const t = new PanelLienzo(0.32, 0.36, (ctx, w, h) => {
        const borde = est.modo === 'bien' ? COLORES.verde : est.modo === 'mal' ? COLORES.rojo : est.encima ? '#ffc23c' : color;
        tarjeta(ctx, w, h, { radio: 40, borde, grosor: est.encima || est.modo !== 'normal' ? 18 : 12, fondo: est.modo === 'bien' ? '#e6fff1' : COLORES.tarjeta });
        escribir(ctx, op.emoji ?? '', w / 2, h * 0.4, { tam: 150, alinear: 'center', base: 'middle' });
        escribir(ctx, op.texto, w / 2, h * 0.78, { tam: 58, peso: 900, color: COLORES.texto, alinear: 'center', base: 'middle', maxAncho: w - 40 });
        if (est.modo === 'bien') escribir(ctx, '✔', w - 60, 60, { tam: 80, peso: 900, color: COLORES.verde, alinear: 'center', base: 'middle' });
        if (est.modo === 'mal') escribir(ctx, '✖', w - 60, 60, { tam: 80, peso: 900, color: COLORES.rojo, alinear: 'center', base: 'middle' });
      });
      t.position.x = (i - (opciones.length - 1) / 2) * 0.37;
      grupo.add(t);
      this.aparecer(t, 0.5, i * 0.1);
      return t;
    });
    let elegida = -1;
    const promesa = this._esperar((resolver) => {
      tarjetas.forEach((t, i) => {
        this.m.entrada.registrar(t, {
          alPasar: (v) => {
            estados[i].encima = v;
            t.scale.setScalar(v ? 1.07 : 1);
            t.redibujar();
          },
          alSeleccionar: () => {
            if (this.pausado) return;
            elegida = i;
            resolver(i);
          },
        });
        this._interactivos.push(t);
      });
      return () => tarjetas.forEach((t) => this.m.entrada.desregistrar(t));
    }, tiempo);
    return promesa.then(async (i) => {
      const indice = i ?? elegida;
      estados[correcta].modo = 'bien';
      if (indice >= 0 && indice !== correcta) estados[indice].modo = 'mal';
      tarjetas.forEach((t) => t.redibujar());
      const pos = tarjetas[correcta].getWorldPosition(V(0, 0, 0));
      if (indice === correcta) {
        this.m.audio.acierto(pos);
        this.m.fx.confeti(pos, 50);
      } else if (indice >= 0) this.m.audio.error(tarjetas[indice].getWorldPosition(V(0, 0, 0)));
      else this.m.audio.tono(660, 0.3, { volumen: 0.08 });
      this.m.fx.latido(tarjetas[correcta], 0.15);
      return indice;
    });
  }

  /** Quita las tarjetas de una pregunta (o cualquier grupo del plato) con una animación. */
  async retirar(obj, duracion = 0.4) {
    await this.escalar(obj, 0.001, duracion, suavizado.entradaSalida);
    obj.removeFromParent();
    liberar(obj);
  }

  // ── Escenarios ───────────────────────────────────────────────────────────

  /** Cambia de escenario con un fundido (el aula en AR o un mundo completo en VR). */
  async escenario(nombre, { fundido = true } = {}) {
    if (this.set?.nombre === nombre) return;
    const token = this._token;
    if (fundido && this.set) {
      this.m.audio.tono(400, 0.7, { hasta: 1600, volumen: 0.06 });
      this.m.audio.rafaga({ duracion: 0.8, frecuencia: 3000, filtro: 'highpass', volumen: 0.03 });
      await this.m.fx.fundido(true, 0.45);
    }
    if (this.set) {
      this.set.destruir?.();
      this.set.grupo.removeFromParent();
      liberar(this.set.grupo);
    }
    const crear = this.guion.escenarios[nombre];
    this.set = { nombre, ...crear(this) };
    this.raiz.add(this.set.grupo);
    const { app } = this.m;
    const [cieloColor, sueloColor, intensidad] = this.set.luz ?? [0xffffff, 0x8a7a66, 2.3];
    app.hemi.color.set(cieloColor);
    app.hemi.groundColor.set(sueloColor);
    app.hemi.intensity = intensidad;
    app.escena.background = this.set.fondo ? new THREE.Color(this.set.fondo) : null;
    app.escena.fog = this.set.niebla ? new THREE.Fog(...this.set.niebla) : null;
    if (fundido) await this.m.fx.fundido(false, 0.6);
    this.verificar(token);
  }

  // ── Final ────────────────────────────────────────────────────────────────

  _final() {
    this.musica.iniciar('alegre');
    this.hud.visible = false;
    const grupo = new THREE.Group();
    const panel = new PanelLienzo(0.9, 0.36, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 46, borde: '#ffc23c', grosor: 12 });
      escribir(ctx, '🎬 The End!', w / 2, 40, { tam: 80, peso: 900, alinear: 'center' });
      escribir(ctx, 'Great job, soil scientist! 🌱', w / 2, 170, { tam: 50, peso: 700, color: COLORES.suave, alinear: 'center', maxAncho: w - 60 });
    });
    panel.position.y = 0.2;
    const otra = this.escena.boton('↺ Watch again', () => {
      grupo.removeFromParent();
      liberar(grupo);
      this.hud.visible = true;
      this.reproducir(0);
    }, { ancho: 0.4, alto: 0.12, color: '#e6ebf8', colorTexto: COLORES.texto, tam: 40 });
    otra.position.set(-0.23, -0.06, 0.01);
    const fin = this.escena.boton('Finish ✔', () => this.escena.terminar(), { ancho: 0.4, alto: 0.12, color: COLORES.verde, tam: 40 });
    fin.position.set(0.23, -0.06, 0.01);
    grupo.add(panel, otra, fin);
    this.escena.anteMirada(grupo, { distancia: 1.4, dy: 0 });
    this.raiz.add(grupo);
    this.m.fx.aparecer(grupo, 0.6);
    this.m.fx.confeti(grupo.getWorldPosition(V(0, 0, 0)).add(V(0, 0.4, 0)), 120);
    this.m.audio.exito();
  }
}

/** Anillo brillante que indica que algo se puede tocar. */
function crearBrillo(radio) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radio * 0.82, radio, 40),
    new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  m.renderOrder = 5;
  return m;
}

/** Escribe un texto con palabras *resaltadas*; las palabras ya dichas se ven más fuertes. */
function escribirRico(ctx, texto, x, y, maxAncho, maxAlto, progreso) {
  const palabras = [];
  texto.split('*').forEach((trozo, i) => {
    for (const p of trozo.split(/\s+/).filter(Boolean)) {
      // La puntuación suelta entre tramos (", " o ".") se pega a la palabra anterior.
      if (/^[,.;:!?…]+$/.test(p) && palabras.length) palabras.at(-1).p += p;
      else palabras.push({ p, resaltada: i % 2 === 1 });
    }
  });
  let tam = 48;
  let lineas;
  for (;;) {
    lineas = [[]];
    let ancho = 0;
    for (const pal of palabras) {
      ctx.font = fuente(tam, pal.resaltada ? 900 : 700);
      const a = ctx.measureText(`${pal.p} `).width;
      if (ancho + a > maxAncho && lineas.at(-1).length) {
        lineas.push([]);
        ancho = 0;
      }
      lineas.at(-1).push({ ...pal, a });
      ancho += a;
    }
    if (lineas.length * tam * 1.25 <= maxAlto || tam <= 30) break;
    tam -= 3;
  }
  const dichas = Math.ceil(progreso * palabras.length);
  let k = 0;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  lineas.forEach((linea, j) => {
    let xx = x;
    for (const pal of linea) {
      const ya = k++ < dichas;
      ctx.font = fuente(tam, pal.resaltada ? 900 : 700);
      ctx.fillStyle = pal.resaltada ? (ya ? '#d9480f' : '#f4a77f') : ya ? '#23304a' : '#9aa3b8';
      ctx.fillText(pal.p, xx, y + j * tam * 1.25);
      xx += pal.a;
    }
  });
}

/**
 * Música de fondo generada en el momento (sin archivos): acordes alegres en
 * arpegio. Baja de volumen cuando alguien habla.
 */
class Musica {
  constructor(audio) {
    this.audio = audio;
    this.estilo = null;
  }

  iniciar(estilo = 'alegre') {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    if (this.estilo === estilo && this._intervalo) return;
    this.detener();
    this.estilo = estilo;
    this.config = ESTILOS[estilo] ?? ESTILOS.alegre;
    this.salida = ctx.createGain();
    this.salida.gain.value = 0;
    this.salida.gain.linearRampToValueAtTime(this._volumen(), ctx.currentTime + 1.5);
    this.salida.connect(this.audio.maestro);
    this.paso = 0;
    this.proximo = ctx.currentTime + 0.2;
    this._intervalo = setInterval(() => this._programar(), 60);
  }

  _volumen() {
    return (this.config?.volumen ?? 0.05) * (this._atenuada ? 0.4 : 1) * (this._pausada ? 0 : 1);
  }

  _ajustar() {
    if (!this.salida) return;
    const t = this.audio.ctx.currentTime;
    this.salida.gain.cancelScheduledValues(t);
    this.salida.gain.setTargetAtTime(this._volumen(), t, 0.15);
  }

  atenuar(v) {
    this._atenuada = v;
    this._ajustar();
  }

  pausar() {
    this._pausada = true;
    this._ajustar();
  }

  reanudar() {
    this._pausada = false;
    this.proximo = Math.max(this.proximo, this.audio.ctx?.currentTime ?? 0);
    this._ajustar();
  }

  detener() {
    clearInterval(this._intervalo);
    this._intervalo = null;
    if (this.salida) {
      const s = this.salida;
      const t = this.audio.ctx.currentTime;
      s.gain.cancelScheduledValues(t);
      s.gain.setTargetAtTime(0, t, 0.2);
      setTimeout(() => s.disconnect(), 1200);
    }
    this.salida = null;
    this.estilo = null;
  }

  _programar() {
    const ctx = this.audio.ctx;
    if (!ctx || this._pausada) return;
    const c = this.config;
    const corchea = 60 / c.bpm / 2;
    while (this.proximo < ctx.currentTime + 0.3) {
      const compas = Math.floor(this.paso / 8) % c.acordes.length;
      const acorde = c.acordes[compas];
      const k = this.paso % 8;
      const nota = acorde[c.arpegio[k] % acorde.length];
      this._nota(nota * (c.arpegio[k] >= acorde.length ? 2 : 1), this.proximo, corchea * 1.6, c.onda, 0.5);
      if (k === 0 || k === 4) this._nota(acorde[0] / 2, this.proximo, corchea * 3, 'sine', 0.9);
      if (c.bateria) {
        if (k === 0 || k === 4) this._golpe(this.proximo, 'bombo');
        if (k === 2 || k === 6) this._golpe(this.proximo, 'palma');
      }
      this.proximo += corchea;
      this.paso++;
    }
  }

  _nota(f, t, dur, onda, vol) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = onda;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.salida);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _golpe(t, tipo) {
    const ctx = this.audio.ctx;
    if (tipo === 'bombo') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      g.gain.setValueAtTime(1.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(this.salida);
      o.start(t);
      o.stop(t + 0.25);
      return;
    }
    const f = ctx.createBufferSource();
    f.buffer = this.audio._ruidoBlanco();
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    f.connect(filtro).connect(g).connect(this.salida);
    f.start(t, Math.random());
    f.stop(t + 0.15);
  }
}

// Frecuencias (Hz) de los acordes de cada estilo.
const DO = [261.6, 329.6, 392.0];
const SOL = [196.0, 246.9, 293.7];
const LAm = [220.0, 261.6, 329.6];
const FA = [174.6, 220.0, 261.6];
const REm = [146.8, 174.6, 220.0];
const MIm = [164.8, 196.0, 246.9];
const ESTILOS = {
  alegre: { bpm: 96, acordes: [DO, SOL, LAm, FA], arpegio: [0, 1, 2, 3, 2, 1, 0, 2], onda: 'triangle', volumen: 0.05 },
  misterio: { bpm: 70, acordes: [LAm, MIm, FA, MIm], arpegio: [0, 2, 1, 2, 0, 2, 1, 2], onda: 'sine', volumen: 0.06 },
  naturaleza: { bpm: 84, acordes: [FA, DO, SOL, DO], arpegio: [0, 1, 2, 1, 3, 1, 2, 1], onda: 'triangle', volumen: 0.045 },
  cancion: { bpm: 104, acordes: [DO, FA, SOL, DO], arpegio: [0, 2, 1, 2, 0, 2, 1, 2], onda: 'square', volumen: 0.035, bateria: true },
  calma: { bpm: 72, acordes: [DO, REm, FA, SOL], arpegio: [0, 1, 2, 1, 0, 1, 2, 1], onda: 'sine', volumen: 0.05 },
};
