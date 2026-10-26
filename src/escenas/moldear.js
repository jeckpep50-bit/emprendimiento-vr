import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { llama } from '../mundo/prefabs/noticias.js';
import { liberar, mat, malla } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COLORES_CLASE = ['#e5484d', '#1c9ab8', '#8b5cf6', '#21a366', '#f08c00'];

/**
 * Moldear: "palabras que dan forma". Una llama sin detalles cambia en vivo con cada
 * palabra que el estudiante elige (tamaño, color, textura, adorno, actitud) y la
 * frase se va armando. Después, el reto: describir EXACTAMENTE la llama del monitor.
 * datos: { titulo, instruccion, intro?: [textos de la presentadora], presentador?: { opciones, posicion },
 *   pasos: [{ pregunta, clase, rasgo, pista?, opciones: [{ texto, valor }] }],
 *   inicio?: "Una llama", reto: { instruccion, objetivo: { rasgo: valor }, mensajeFinal },
 *   frases?: { tuLlama: { quien, texto } } }
 */
export class EscenaMoldear extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.pasos = d.pasos ?? [];
    this.rasgos = { tamano: 1, color: null, lana: 'lisa', adorno: 'ninguno', actitud: null };
    this.elegidos = [];
    this.fase = 'intro';
    this.paso = 0;
    this.fallos = 0;

    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', y: H + 0.62, z: -1.75 });
    this.cabecera.derecha(this.t('pasoDe', { n: 1, total: this.pasos.length }));

    // La presentadora detrás del escritorio
    if (d.presentador) {
      this.sofia = this.crearPersona({ edad: 'adulto', expresion: 'feliz', ...d.presentador.opciones }, d.presentador.posicion ?? [0, 0, -2.85], { mirar: true });
      this.gestosAlHablar(this.sofia);
    }

    // Plataforma holográfica con la llama
    this.podio = new THREE.Group();
    this.podio.position.set(-1.1, 0, -2.05);
    this.podio.add(malla(new THREE.CylinderGeometry(0.62, 0.68, 0.08, 40), mat('#2b3550'), [0, 0.04, 0]));
    const aro = malla(new THREE.RingGeometry(0.58, 0.64, 48), mat('#5ff7ff', { tipo: 'basica' }), [0, 0.085, 0], [-Math.PI / 2, 0, 0]);
    aro.userData.noFusionar = true;
    this.podio.add(aro);
    this.soporte = new THREE.Group();
    this.soporte.position.y = 0.08;
    this.podio.add(this.soporte);
    this.raiz.add(this.podio);
    this.presentar(this.podio, 0.2);
    this._rehacerLlama(false);
    this.cadaCuadro((dt, t) => this._animarLlama(this.llama, this.rasgos.actitud, dt, t, 1));

    // Panel con la frase que se va armando
    // Abajo, como subtítulos: así no tapa la cara de la presentadora
    this.panelFrase = new PanelLienzo(1.35, 0.3, (ctx, w, h) => this._dibujarFrase(ctx, w, h));
    this.panelFrase.position.set(0.1, H - 0.58, -1.15);
    this.panelFrase.lookAt(0, H, 0);
    this.raiz.add(this.panelFrase);
    this.presentar(this.panelFrase, 0.3);

    // Pregunta y opciones (abajo, al frente)
    this.panelPregunta = new PanelLienzo(1.1, 0.13, (ctx, w, h) => this._dibujarPregunta(ctx, w, h));
    this.panelPregunta.position.set(0.15, H - 0.12, -1.25);
    this.panelPregunta.lookAt(0, H, 0);
    this.panelPregunta.visible = false;
    this.raiz.add(this.panelPregunta);
    this.opciones = new THREE.Group();
    this.raiz.add(this.opciones);

    // Monitor del camarógrafo (aparece en el reto)
    this.monitor = new THREE.Group();
    this.monitor.position.set(1.15, 0, -1.55);
    this.monitor.lookAt(0, 0, 0);
    this.monitor.visible = false;
    this.raiz.add(this.monitor);
  }

  async vozInicial() {
    // La presentadora se presenta y explica; después aparecen las palabras.
    for (const texto of this.datos.intro ?? []) {
      if (this._destruida) return;
      await this._decir(texto);
      await this.esperar(0.25);
    }
    if (this._destruida) return;
    await this._decir(this.datos.instruccion);
    if (this._destruida) return;
    this.fase = 'crear';
    this._mostrarPaso();
  }

  _decir(texto, quien = 'guia') {
    if (this.sofia) return this.hablarPersona(this.sofia, texto, quien);
    return this.voz(texto, quien);
  }

  // ── La llama ─────────────────────────────────────────────────────────────

  _rehacerLlama(pop = true) {
    for (const hijo of [...this.soporte.children]) {
      this.soporte.remove(hijo);
      liberar(hijo);
    }
    const r = this.rasgos;
    this.llama = llama({ color: r.color ?? '#aeb4bf', lana: r.lana, adorno: r.adorno, gris: !r.color });
    this.llama.rotation.y = 0.6;
    this.soporte.add(this.llama);
    const s = r.tamano;
    if (pop) {
      this.llama.scale.setScalar(s * 0.7);
      this.m.fx.tween({ duracion: 0.5, curva: suavizado.rebote, alActualizar: (k) => this.llama.scale.setScalar(s * (0.7 + 0.3 * k)) });
      this.m.fx.confeti(this.posMundo(this.podio).add(V(0, 1.2 * s, 0)), 26);
      this.m.audio.burbuja(this.posMundo(this.podio));
    } else {
      this.llama.scale.setScalar(s);
    }
  }

  /** Posturas según la actitud: tranquila (echada), juguetona (salta) o curiosa (mira todo). */
  _animarLlama(l, actitud, dt, t, escala) {
    if (!l) return;
    const u = l.userData;
    const k = Math.min(1, dt * 5);
    const echada = actitud === 'tranquila';
    u.patas.scale.y += ((echada ? 0.3 : 1) - u.patas.scale.y) * k;
    const bajar = echada ? -0.4 : 0;
    u.cuerpo.position.y += (bajar - u.cuerpo.position.y) * k;
    u.cuello.position.y += (0.86 + bajar - u.cuello.position.y) * k;
    const salto = actitud === 'juguetona' ? Math.abs(Math.sin(t * 5)) * 0.18 : 0;
    l.position.y = salto * escala;
    u.cuello.rotation.y = actitud === 'curiosa' ? Math.sin(t * 0.9) * 0.7 : Math.sin(t * 0.4) * 0.12;
    u.cabeza.rotation.z = actitud === 'curiosa' ? Math.sin(t * 1.7) * 0.25 : 0;
    u.cabeza.rotation.x = echada ? Math.sin(t * 6) * 0.04 : 0;
  }

  // ── Pasos ────────────────────────────────────────────────────────────────

  _mostrarPaso() {
    const { H } = this;
    const paso = this.pasos[this.paso];
    this.cabecera.derecha(this.t('pasoDe', { n: this.paso + 1, total: this.pasos.length }));
    this.panelPregunta.visible = true;
    this.panelPregunta.redibujar();
    this.m.fx.aparecer(this.panelPregunta, 0.3);
    for (const b of [...this.opciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    const n = paso.opciones.length;
    paso.opciones.forEach((op, i) => {
      const b = this.boton(op.texto, () => this._elegir(paso, op, b), { ancho: 0.5, alto: 0.15, color: '#ffffff', colorTexto: COLORES.texto, tam: 34 });
      const angulo = THREE.MathUtils.degToRad((i - (n - 1) / 2) * 24);
      b.position.set(0.15 + Math.sin(angulo) * 1.15, H - 0.33, -Math.cos(angulo) * 1.15);
      b.lookAt(0, H, 0);
      this.opciones.add(b);
      this.m.fx.aparecer(b, 0.35, 0.1 + i * 0.08);
    });
    if (paso.pregunta && this.paso > 0) this._decir(paso.pregunta);
  }

  _elegir(paso, op, boton) {
    const pos = this.posMundo(boton);
    if (this.fase === 'reto') {
      const meta = this.datos.reto.objetivo[paso.rasgo];
      if (op.valor !== meta) {
        boton.setModo('incorrecto');
        this.m.entrada.habilitar(boton, false);
        this.m.audio.error(pos);
        this.perder();
        this.fallos++;
        this.cabecera.mensaje(`🤔 ${paso.pista ?? this.t('mirarMonitor')}`, COLORES.naranja);
        return;
      }
    }
    for (const b of this.opciones.children) this.m.entrada.habilitar(b, false);
    boton.setModo('correcto');
    this.m.audio.acierto(pos);
    this.ganar(pos, this.fase === 'reto' ? (this.fallos ? 60 : 120) : 60);
    this.fallos = 0;
    this.cabecera.mensaje(`✅ ${paso.clase ? `${paso.clase}: ` : ''}«${op.texto}»`, COLORES.verde);
    this.rasgos[paso.rasgo] = op.valor;
    this.elegidos[this.paso] = op.texto;
    this.panelFrase.redibujar();
    this.m.fx.latido(this.panelFrase, 0.04);
    if (paso.rasgo !== 'actitud') this._rehacerLlama();
    else this.m.fx.confeti(this.posMundo(this.podio).add(V(0, 1.2, 0)), 20);
    this.paso++;
    this.esperar(0.9).then(() => {
      if (this._destruida) return;
      if (this.paso < this.pasos.length) this._mostrarPaso();
      else if (this.fase === 'crear') this._fin();
      else this._retoCumplido();
    });
  }

  _limpiarOpciones() {
    for (const b of [...this.opciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    this.panelPregunta.visible = false;
  }

  /** Terminó la llama propia: se celebra y se pasa al reto. */
  async _fin() {
    this._limpiarOpciones();
    this.m.audio.exito();
    this.m.fx.girar(this.llama, 1.2);
    const frase = this.datos.frases?.tuLlama;
    if (frase) await this._decir(frase.texto, frase.quien);
    if (this._destruida) return;
    const b = this.boton(this.t('siguienteReto'), () => {
      b.visible = false;
      this.m.entrada.habilitar(b, false);
      this._empezarReto();
    }, { ancho: 0.5, alto: 0.13, color: COLORES.morado });
    b.position.set(0.15, this.H - 0.33, -1.15);
    b.lookAt(0, this.H, 0);
    this.raiz.add(b);
    this.m.fx.aparecer(b, 0.4);
  }

  _empezarReto() {
    this.fase = 'reto';
    this.paso = 0;
    this.elegidos = [];
    this.rasgos = { tamano: 1, color: null, lana: 'lisa', adorno: 'ninguno', actitud: null };
    this._rehacerLlama();
    this.panelFrase.redibujar();
    this._crearMonitor();
    this.cabecera.instruccion(this.datos.reto.instruccion);
    this.cabecera.mensaje('');
    this._decir(this.datos.reto.instruccion).then(() => !this._destruida && this.fase === 'reto' && this.paso === 0 && this._mostrarPaso());
  }

  /** Monitor con la llama que grabó el camarógrafo (la que hay que describir). */
  _crearMonitor() {
    const m = this.monitor;
    m.visible = true;
    m.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), mat('#2b2b33'), [0, 0.375, -0.12]));
    const marco = new PanelLienzo(0.78, 0.9, (ctx, w, h) => {
      ctx.fillStyle = '#23304a';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 30);
      ctx.fill();
      ctx.fillStyle = '#0d1426';
      ctx.fillRect(22, 70, w - 44, h - 92);
      ctx.fillStyle = '#d62839';
      ctx.beginPath();
      ctx.arc(46, 36, 14, 0, Math.PI * 2);
      ctx.fill();
      escribir(ctx, this.t('monitorCamara'), 70, 36, { tam: 34, peso: 800, color: '#ffffff', base: 'middle' });
    });
    marco.position.set(0, 1.2, -0.14);
    m.add(marco);
    const o = this.datos.reto.objetivo;
    const objetivo = llama({ color: o.color, lana: o.lana, adorno: o.adorno });
    objetivo.scale.setScalar(o.tamano ?? 1);
    // En la toma también sale un niño: así se compara el tamaño de la llama.
    const caja = new THREE.Group();
    caja.position.set(0, 0.86, -0.05);
    caja.scale.setScalar(0.3);
    objetivo.position.x = 0.4;
    caja.add(objetivo);
    this.crearPersona({ peinado: 'corto', estatura: 1.15, superior: '#2dbe78', inferior: '#3a4256', falda: false, cuello: null, expresion: 'feliz' }, [-0.55, 0, 0], { padre: caja });
    m.add(caja);
    this.cadaCuadro((dt, t) => {
      objetivo.rotation.y = Math.sin(t * 0.6) * 0.6 + 0.4;
      this._animarLlama(objetivo, o.actitud, dt, t, 1);
    });
    this.m.fx.aparecer(m, 0.5);
    this.m.audio.pop(this.posMundo(m));
  }

  async _retoCumplido() {
    this._limpiarOpciones();
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.podio).add(V(0, 1.4, 0)), 90);
    this.m.fx.confeti(this.posMundo(this.monitor).add(V(0, 1.2, 0)), 60);
    this.cabecera.mensaje(this.datos.reto.mensajeFinal, COLORES.verde);
    this.mostrarContinuar(V(0.15, this.H - 0.33, -1.15));
    await this._decir(this.datos.reto.mensajeFinal);
  }

  // ── Dibujos ──────────────────────────────────────────────────────────────

  _dibujarFrase(ctx, w, h) {
    tarjeta(ctx, w, h, { radio: 34, borde: '#23304a', grosor: 8 });
    pastilla(ctx, this.fase === 'reto' ? this.t('tuDescripcionReto') : this.t('tuDescripcion'), 28, 18, { tam: 26, fondo: '#23304a', color: '#ffffff' });
    const trozos = [{ texto: this.datos.inicio ?? 'Una llama', color: COLORES.texto }];
    this.pasos.forEach((p, i) => {
      const t = this.elegidos[i];
      trozos.push({ texto: t ? `${t}${i < this.pasos.length - 2 ? ',' : ''}` : '…', color: t ? COLORES_CLASE[i % COLORES_CLASE.length] : '#b8c0d2' });
    });
    trozos.at(-1).texto += this.elegidos[this.pasos.length - 1] ? '.' : '';
    // Escribe palabra por palabra, cada trozo con su color
    ctx.font = fuente(40, 800);
    const espacio = ctx.measureText(' ').width;
    let x = 28;
    let y = 82;
    for (const tr of trozos) {
      for (const pal of tr.texto.split(' ')) {
        const a = ctx.measureText(pal).width;
        if (x + a > w - 28) {
          x = 28;
          y += 50;
        }
        ctx.fillStyle = tr.color;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(pal, x, y);
        x += a + espacio;
      }
    }
  }

  _dibujarPregunta(ctx, w, h) {
    const paso = this.pasos[this.paso];
    if (!paso) return;
    const color = COLORES_CLASE[this.paso % COLORES_CLASE.length];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, (h - 8) / 2);
    ctx.fill();
    escribir(ctx, `${paso.pregunta}${paso.clase ? `  ·  ${paso.clase}` : ''}`, w / 2, h / 2, { tam: 46, tamMin: 30, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 40 });
  }
}
