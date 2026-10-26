import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { suavizado } from '../core/efectos.js';
import { posar } from '../mundo/prefabs/personas.js';
import { globo } from '../mundo/prefabs/noticias.js';
import { mat, malla } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tramo = (a, b, x) => THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
const suave = (k) => k * k * (3 - 2 * k);

/**
 * Retrato: una noticia en vivo (una heroína rescata el globo de una niña) y después
 * una fila de cuatro personas disfrazadas casi igual. El estudiante describe a la
 * verdadera rasgo por rasgo: cada rasgo PRECISO descarta a quien no coincide; los
 * VAGOS no ayudan y los FALSOS no son lo que vio. Al final describe cómo es por dentro.
 * datos: { titulo, instruccion, instruccionRetrato, mensajeFinal,
 *   heroina: id del candidato verdadero, candidatos: [{ id, opciones (persona) }],
 *   rasgos: [{ nombre, emoji, opciones: [{ texto, quedan?: [ids], vago?: bool, retro? }] }],
 *   etopeya: { instruccion, preguntas: [{ hecho, dice?: bool, opciones: [..3], correcta, explicacion }] },
 *   frases: { ninaGlobo, heroinaEntrega, ninaGracias, heroinaHola, escondida, encontrada, ... } }
 */
export class EscenaRetrato extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.fase = 'noticia';
    this.retratoFisico = [];
    this.retratoCaracter = [];
    this.candidatos = [];
    this.usados = new Set();

    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', y: H + 0.66, z: -1.75 });
    this.cabecera.derecha(this.t('noticiaEnVivo'));

    const verdadera = d.candidatos.find((c) => c.id === d.heroina);
    // La niña del globo y la heroína de la noticia
    this.nina = this.crearPersona({ peinado: 'colitas', estatura: 1.0, superior: '#ff8fa3', inferior: '#ff8fa3', cuello: '#ffffff', expresion: 'feliz' }, [1.35, 0, -3.0], { ry: -0.5 });
    this.heroina = this.crearPersona({ edad: 'adulto', expresion: 'feliz', ...verdadera.opciones }, [12, 14, -14]);
    this.heroina.rotation.order = 'YXZ';
    this.heroina.visible = false;
    this.globo = globo({ color: '#e5484d' });
    this.raiz.add(this.globo);
    this._globoEnMano(this.nina);
    this.cadaCuadro((dt, t) => this._animarNoticia(dt, t));
    this.reloj = -1;
  }

  async vozInicial() {
    await super.vozInicial();
    if (this._destruida) return;
    this._empezarNoticia();
  }

  // ── La noticia: el rescate del globo ─────────────────────────────────────

  _globoEnMano(p) {
    this.globoDe = p;
  }

  _empezarNoticia() {
    this.fase = 'noticia';
    this.reloj = 0;
    this.dichos = new Set();
    this.heroina.visible = true;
    this.heroina.position.set(12, 14, -14);
    this.nina.userData.setExpresion('feliz');
    this._globoEnMano(this.nina);
    this.cabecera.mensaje(this.t('miraBien'), COLORES.primario);
  }

  /** Dice una frase del guion una sola vez por repetición de la noticia. */
  _frase(clave, p) {
    if (this.dichos.has(clave)) return;
    this.dichos.add(clave);
    const f = this.datos.frases?.[clave];
    if (!f) return;
    if (p) this.hablarPersona(p, f.texto, f.quien);
    else this.voz(f.texto, f.quien);
  }

  _animarNoticia(dt, t) {
    const h = this.heroina;
    // Capa de todas las heroínas: ondea siempre (más fuerte al volar)
    h.userData.ondearCapa(t, this.volando ? 0.35 : 0.08);
    for (const c of this.candidatos) c.persona.userData.ondearCapa(t + c.fase, 0.06);
    // El globo sigue a quien lo tiene (o sube solo)
    if (this.globoDe) {
      const mano = this.globoDe.userData.articulaciones.brazoD;
      const pos = mano.localToWorld(V(0, -0.3, 0.02));
      this.globo.position.copy(this.raiz.worldToLocal(pos));
      this.globo.rotation.z = Math.sin(t * 2) * 0.08;
    }
    if (this.fase !== 'noticia' || this.reloj < 0) return;
    this.reloj += dt;
    const r = this.reloj;
    const k = Math.min(1, dt * 7);
    const nina = this.nina;

    // 0 s: el globo se escapa
    if (r < 0.5) {
      posar(nina, { brazoD: [-1.2, 0, 0.2] }, k);
      return;
    }
    this._frase('ninaGlobo', nina);
    const desde = V(1.2, 0.95, -2.85);
    const arriba = V(-2.4, 9.5, -9.5);
    if (r < 5.2) {
      this.globoDe = null;
      nina.userData.setExpresion?.('sorpresa');
      const kg = suave(tramo(0.5, 6.0, r));
      this.globo.position.lerpVectors(desde, arriba, kg);
      this.globo.position.x += Math.sin(r * 2.2) * 0.25;
      posar(nina, { brazoD: [-2.8, 0, 0.2], brazoI: [-2.6, 0, -0.2], cabeza: [-0.5, 0, 0] }, k);
    }
    // 1,8 s: la heroína llega volando hacia el globo
    const p0 = V(12, 14, -14);
    const atrapa = V(-1.9, 8.4, -8.7);
    const aterriza = V(0.45, 0, -2.6);
    if (r >= 1.8 && r < 5.2) this._volar(h, p0, atrapa, suave(tramo(1.8, 5.2, r)), k);
    if (r >= 5.2 && !this.dichos.has('atrapado')) {
      this.dichos.add('atrapado');
      this.globoDe = h;
      this.m.audio.acierto(this.posMundo(h));
    }
    if (r >= 5.2 && r < 8.2) this._volar(h, atrapa, aterriza, suave(tramo(5.2, 8.2, r)), k, true);
    if (r >= 8.2 && r < 16) {
      this.volando = false;
      h.position.copy(aterriza);
      h.rotation.x += (0 - h.rotation.x) * k;
      const haciaNina = Math.atan2(nina.position.x - h.position.x, nina.position.z - h.position.z);
      const haciaUsuario = Math.atan2(-h.position.x, -h.position.z);
      if (r < 12) {
        h.rotation.y += (haciaNina - h.rotation.y) * k;
        posar(h, { brazoD: [-1.2, 0, 0.1] }, k);
        if (r > 9.0) {
          if (this.globoDe === h) this.m.audio.burbuja(this.posMundo(nina));
          this.globoDe = nina;
          nina.userData.setExpresion?.('feliz');
          posar(nina, { brazoD: [-1.3, 0, 0.1], cabeza: [-0.2, 0, 0] }, k);
        }
        this._frase('heroinaEntrega', h);
        if (r > 11.2) this._frase('ninaGracias', nina);
      } else {
        // Posa para la cámara: momento para fijarse en los detalles
        h.rotation.y += (haciaUsuario - h.rotation.y) * k;
        const saludo = r < 13.5;
        posar(h, saludo ? { brazoD: [-2.8, 0, 0.35 + Math.sin(r * 9) * 0.3], brazoI: [0.1, 0, -0.55] } : { brazoD: [0.1, 0, 0.6], brazoI: [0.1, 0, -0.6], cabeza: [-0.05, 0, 0] }, k);
        this._frase('heroinaHola', h);
      }
    }
    // 16 s: se va volando
    if (r >= 16 && r < 18.6) this._volar(h, aterriza, V(-14, 18, 6), suave(tramo(16, 18.6, r)), k);
    if (r >= 18.6 && h.visible) {
      h.visible = false;
      this.reloj = -1;
      this._despuesDeLaNoticia();
    }
  }

  /** Vuela de `a` a `b` (k = 0..1) con el cuerpo inclinado en la dirección del vuelo. */
  _volar(h, a, b, kk, k, aterrizando = false) {
    this.volando = true;
    const antes = h.position.clone();
    h.position.lerpVectors(a, b, kk);
    if (aterrizando) h.position.y = THREE.MathUtils.lerp(a.y, b.y, Math.sin((kk * Math.PI) / 2));
    const dir = h.position.clone().sub(antes);
    if (dir.lengthSq() > 1e-6) {
      const horizontal = Math.hypot(dir.x, dir.z);
      const yaw = Math.atan2(dir.x, dir.z);
      const d = Math.atan2(Math.sin(yaw - h.rotation.y), Math.cos(yaw - h.rotation.y));
      h.rotation.y += d * k;
      const pitch = (aterrizando && kk > 0.8 ? 0 : 1) * Math.atan2(horizontal, Math.abs(dir.y) + 1e-4) * 0.95;
      h.rotation.x += (pitch - h.rotation.x) * k;
    }
    posar(h, { brazoD: [-2.9, 0, 0.12], brazoI: aterrizando ? [-0.4, 0, -0.5] : [0.25, 0, -0.15] }, k);
    if (Math.random() < 0.04) this.m.audio.rafaga({ duracion: 0.5, frecuencia: 900, hasta: 300, volumen: 0.04, pos: this.posMundo(h) });
  }

  async _despuesDeLaNoticia() {
    if (this.fase !== 'noticia') return;
    this.fase = 'transicion';
    const f = this.datos.frases?.escondida;
    if (f) await this.voz(f.texto, f.quien);
    if (this._destruida) return;
    if (this.candidatos.length) {
      // Volvió a ver la noticia: la fila sigue como estaba
      this.fase = 'fila';
      for (const c of this.candidatos) c.nodo.visible = !c.fuera;
      this.cabecera.instruccion(this.datos.instruccionRetrato);
      this._mostrarRasgos(true);
      return;
    }
    this._crearFila();
  }

  // ── La fila de disfrazados ───────────────────────────────────────────────

  _crearFila() {
    const { H } = this;
    this.fase = 'fila';
    this.cabecera.instruccion(this.datos.instruccionRetrato);
    this.cabecera.mensaje('');
    this.voz(this.datos.instruccionRetrato);
    // La niña se hace a un lado para dejar libre la fila
    this.nina.position.set(2.55, 0, -1.7);
    this.nina.rotation.y = -1.2;
    const lista = barajar(this.datos.candidatos);
    const xs = [-1.5, -0.5, 0.5, 1.5];
    this.candidatos = lista.map((c, i) => {
      const nodo = new THREE.Group();
      nodo.position.set(xs[i], 0, -2.75);
      this.raiz.add(nodo);
      nodo.add(malla(new THREE.CircleGeometry(0.36, 28), mat('#23304a', { tipo: 'basica', opacidad: 0.5 }), [0, 0.01, 0], [-Math.PI / 2, 0, 0]));
      const p = this.crearPersona({ edad: 'adulto', expresion: 'feliz', ...c.opciones }, [0, 0, 0], { padre: nodo });
      p.rotation.set(0, Math.atan2(-xs[i], 2.75), 0);
      posar(p, { brazoD: [0.1, 0, 0.6], brazoI: [0.1, 0, -0.6] }, 1);
      const estado = { n: i + 1, fuera: false };
      const tag = new PanelLienzo(0.2, 0.2, (ctx, w, h) => {
        ctx.fillStyle = estado.fuera ? '#8a94a3' : COLORES.amarillo;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        escribir(ctx, estado.fuera ? '✖' : String(estado.n), w / 2, h / 2 + 4, { tam: 120, peso: 900, color: '#23304a', alinear: 'center', base: 'middle' });
      });
      tag.position.set(0, (c.opciones.estatura ?? 1.62) + 0.3, 0);
      nodo.add(tag);
      this.mirarAlUsuario([tag]);
      this.presentar(nodo, 0.1 + i * 0.15);
      this.m.fx.aparecer(nodo, 0.5, 0.1 + i * 0.15);
      return { id: c.id, nodo, persona: p, tag, estado, fuera: false, fase: i * 1.3 };
    });
    this.m.audio.exito();
    this.cabecera.derecha(this.t('quedanSospechosos', { n: this.candidatos.length }));
    this._crearRasgos();
    this._crearRetrato();
  }

  _crearRasgos() {
    const { H } = this;
    this.zonaRasgos = new THREE.Group();
    this.raiz.add(this.zonaRasgos);
    this.botonesRasgo = this.datos.rasgos.map((r, i) => {
      const b = this.boton(`${r.emoji ?? '🔹'} ${r.nombre}`, () => this._abrirRasgo(r, b), { ancho: 0.42, alto: 0.105, color: '#ffffff', colorTexto: COLORES.texto, tam: 32 });
      b.position.set(-1.2, H + 0.3 - i * 0.12, -1.05);
      b.lookAt(0, H, 0.2);
      this.zonaRasgos.add(b);
      this.m.fx.aparecer(b, 0.35, 0.3 + i * 0.06);
      return b;
    });
    this.zonaOpciones = new THREE.Group();
    this.raiz.add(this.zonaOpciones);
    // Botón para volver a ver la noticia
    this.btnRepetir = this.boton(this.t('repetirNoticia'), () => this._repetirNoticia(), { ancho: 0.42, alto: 0.1, color: COLORES.morado, tam: 30 });
    this.btnRepetir.position.set(-1.2, H + 0.3 - this.datos.rasgos.length * 0.12 - 0.04, -1.05);
    this.btnRepetir.lookAt(0, H, 0.2);
    this.zonaRasgos.add(this.btnRepetir);
    this.m.fx.aparecer(this.btnRepetir, 0.35, 0.8);
  }

  _mostrarRasgos(v) {
    this.zonaRasgos.visible = v;
    this.zonaOpciones.visible = v;
    this.panelRetrato.visible = v;
  }

  /** Vuelve a pasar la noticia (la fila se esconde mientras tanto). */
  _repetirNoticia() {
    if (this.fase !== 'fila') return;
    for (const c of this.candidatos) c.nodo.visible = false;
    this._mostrarRasgos(false);
    for (const b of [...this.zonaOpciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    this.cabecera.instruccion(this.datos.instruccion);
    this._empezarNoticia();
  }

  _abrirRasgo(rasgo, boton) {
    if (this.fase !== 'fila' || this.usados.has(rasgo)) return;
    const { H } = this;
    for (const b of [...this.zonaOpciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    for (const b of this.botonesRasgo) if (!b.estado.usado) b.setModo('normal');
    boton.setEncima(false);
    const opciones = barajar(rasgo.opciones);
    opciones.forEach((op, i) => {
      const b = this.boton(op.texto, () => this._elegirOpcion(rasgo, boton, op, b), { ancho: 0.5, alto: 0.16, color: '#fff8e6', colorTexto: COLORES.texto, tam: 30 });
      const angulo = THREE.MathUtils.degToRad((i - 1) * 27);
      b.position.set(Math.sin(angulo) * 1.1, H - 0.4, -Math.cos(angulo) * 1.1);
      b.lookAt(0, H, 0);
      this.zonaOpciones.add(b);
      this.m.fx.aparecer(b, 0.3, i * 0.07);
    });
    this.cabecera.mensaje(`${rasgo.emoji ?? ''} ${this.t('eligeRasgo', { rasgo: rasgo.nombre.toLowerCase() })}`, COLORES.primario);
  }

  _elegirOpcion(rasgo, botonRasgo, op, boton) {
    const pos = this.posMundo(boton);
    const verdadera = this.datos.heroina;
    if (op.vago || !op.quedan?.includes(verdadera)) {
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.cabecera.mensaje(`🤔 ${op.retro ?? (op.vago ? this.t('rasgoVago') : this.t('rasgoFalso'))}`, COLORES.naranja);
      return;
    }
    // Rasgo preciso: los que no coinciden se van de la fila
    this.usados.add(rasgo);
    botonRasgo.estado.usado = true;
    botonRasgo.setModo('correcto');
    this.m.entrada.habilitar(botonRasgo, false);
    for (const b of [...this.zonaOpciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    this.m.audio.acierto(pos);
    this.ganar(pos, 150);
    this.retratoFisico.push(op.texto);
    this.panelRetrato.redibujar();
    let salen = 0;
    for (const c of this.candidatos) {
      if (c.fuera || op.quedan.includes(c.id)) continue;
      c.fuera = true;
      c.estado.fuera = true;
      c.tag.redibujar();
      salen++;
      this._retirar(c);
    }
    const quedan = this.candidatos.filter((c) => !c.fuera);
    this.cabecera.derecha(this.t('quedanSospechosos', { n: quedan.length }));
    this.cabecera.mensaje(salen ? `✅ ${this.t('rasgoPreciso', { n: salen })}` : `✅ ${this.t('rasgoPrecisoNadie')}`, COLORES.verde);
    if (quedan.length === 1) this.esperar(1.6).then(() => !this._destruida && this._encontrada(quedan[0]));
  }

  /** El candidato descartado da media vuelta y se va caminando. */
  _retirar(c) {
    const p = c.persona;
    const inicio = c.nodo.position.clone();
    const fin = inicio.clone().add(V(inicio.x * 0.6, 0, -3));
    this.m.audio.tono(330, 0.25, { hasta: 160, volumen: 0.08, pos: this.posMundo(c.nodo) });
    this.m.fx.tween({
      duracion: 2.4,
      curva: suavizado.lineal,
      alActualizar: (k) => {
        p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, Math.PI + Math.atan2(inicio.x * 0.6, -3), Math.min(1, k * 4));
        if (k > 0.15) c.nodo.position.lerpVectors(inicio, fin, (k - 0.15) / 0.85);
        const s = Math.sin(k * 30) * 0.4;
        posar(p, { piernaI: [s, 0, 0], piernaD: [-s, 0, 0], brazoI: [-s * 0.6, 0, -0.1], brazoD: [s * 0.6, 0, 0.1] }, 0.3);
        if (k > 0.8) c.nodo.scale.setScalar(Math.max(0.001, (1 - k) / 0.2));
      },
      alTerminar: () => (c.nodo.visible = false),
    });
  }

  async _encontrada(c) {
    this.fase = 'encontrada';
    this.zonaRasgos.visible = false;
    this.m.audio.exito();
    const p = c.persona;
    c.tag.visible = false;
    this.m.fx.confeti(this.posMundo(c.nodo).add(V(0, 2, 0)), 100);
    this.m.fx.moverA(c.nodo, V(0, 0, -2.4), 1.2, suavizado.entradaSalida);
    this.m.fx.tween({ duracion: 1.2, alActualizar: (k) => (p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, 0, k)) });
    this.heroinaFila = p;
    this.gestosAlHablar(p);
    const f = this.datos.frases?.encontrada;
    if (f) await this.hablarPersona(p, f.texto, f.quien);
    if (this._destruida) return;
    this._empezarEtopeya();
  }

  // ── Por dentro (carácter) ────────────────────────────────────────────────

  async _empezarEtopeya() {
    this.fase = 'etopeya';
    this.pregunta = 0;
    const e = this.datos.etopeya;
    this.cabecera.instruccion(e.instruccion);
    this.cabecera.derecha(this.t('porDentro'));
    this.cabecera.mensaje('');
    this.panelHecho = new PanelLienzo(1.2, 0.26, (ctx, w, h) => {
      const q = e.preguntas[this.pregunta];
      if (!q) return;
      tarjeta(ctx, w, h, { radio: 32, borde: COLORES.morado, grosor: 8 });
      pastilla(ctx, q.dice ? this.t('ellaDice') : this.t('loQueHizo'), 26, 18, { tam: 26, fondo: COLORES.morado, color: '#ffffff' });
      escribir(ctx, q.hecho, w / 2, h / 2 + 24, { tam: 40, tamMin: 28, peso: 700, alinear: 'center', base: 'middle', maxAncho: w - 60, maxAlto: h - 80 });
    });
    this.panelHecho.position.set(0, this.H - 0.22, -1.3);
    this.panelHecho.lookAt(0, this.H, 0);
    this.raiz.add(this.panelHecho);
    this.panelRetrato.visible = true;
    await this.voz(e.instruccion);
    if (!this._destruida) this._mostrarPregunta();
  }

  async _mostrarPregunta() {
    const { H } = this;
    const q = this.datos.etopeya.preguntas[this.pregunta];
    this.panelHecho.redibujar();
    this.m.fx.aparecer(this.panelHecho, 0.35);
    for (const b of [...this.zonaOpciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    this.zonaOpciones.visible = true;
    q.opciones.forEach((texto, i) => {
      const b = this.boton(texto, () => this._elegirCaracter(q, i, b), { ancho: 0.36, alto: 0.12, color: '#ffffff', colorTexto: COLORES.texto, tam: 40 });
      b.position.set((i - 1) * 0.4, H - 0.48, -1.15);
      b.lookAt(0, H, 0);
      this.zonaOpciones.add(b);
      this.m.fx.aparecer(b, 0.3, i * 0.07);
    });
    if (q.dice && this.heroinaFila && q.voz) await this.hablarPersona(this.heroinaFila, q.hecho, q.voz);
  }

  _elegirCaracter(q, i, boton) {
    const pos = this.posMundo(boton);
    if (i !== q.correcta) {
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.cabecera.mensaje(`🤔 ${q.pista ?? this.t('caracterPista')}`, COLORES.naranja);
      return;
    }
    for (const b of this.zonaOpciones.children) this.m.entrada.habilitar(b, false);
    boton.setModo('correcto');
    this.m.audio.acierto(pos);
    this.ganar(pos, 150);
    this.cabecera.mensaje(`✅ ${q.explicacion}`, COLORES.verde);
    this.retratoCaracter.push(q.opciones[q.correcta]);
    this.panelRetrato.redibujar();
    this.m.fx.latido(this.panelRetrato, 0.05);
    this.pregunta++;
    this.esperar(1.8).then(() => {
      if (this._destruida) return;
      if (this.pregunta < this.datos.etopeya.preguntas.length) this._mostrarPregunta();
      else this._completar();
    });
  }

  async _completar() {
    this.fase = 'fin';
    this.panelHecho.visible = false;
    this.zonaOpciones.visible = false;
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.panelRetrato).add(V(0, 0.3, 0)), 80);
    this.cabecera.mensaje(this.datos.mensajeFinal, COLORES.verde);
    this.mostrarContinuar(V(0, this.H - 0.3, -1.2));
    await this.voz(this.datos.mensajeFinal);
  }

  // ── El retrato que se va escribiendo ────────────────────────────────────

  _crearRetrato() {
    this.panelRetrato = new PanelLienzo(0.66, 0.8, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 34, borde: COLORES.amarillo, grosor: 8 });
      escribir(ctx, this.t('retratoTitulo'), 30, 26, { tam: 42, peso: 800 });
      let y = 92;
      pastilla(ctx, this.t('porFuera'), 30, y, { tam: 26, fondo: '#1c9ab8', color: '#ffffff' });
      y += 54;
      if (!this.retratoFisico.length) y = escribir(ctx, this.t('retratoVacio'), 30, y, { tam: 28, color: COLORES.suave, maxAncho: w - 60 }) + 6;
      for (const t of this.retratoFisico) y = escribir(ctx, `• ${t}`, 30, y, { tam: 28, tamMin: 22, peso: 600, maxAncho: w - 60, interlineado: 1.15 }) + 6;
      if (this.fase === 'etopeya' || this.fase === 'fin' || this.retratoCaracter.length) {
        y += 8;
        pastilla(ctx, this.t('porDentro'), 30, y, { tam: 26, fondo: COLORES.morado, color: '#ffffff' });
        y += 54;
        if (this.retratoCaracter.length) escribir(ctx, `• ${this.t('esCaracter', { rasgos: this.retratoCaracter.join(', ') })}`, 30, y, { tam: 30, peso: 700, color: '#5b21b6', maxAncho: w - 60 });
      }
    });
    this.panelRetrato.position.set(1.2, this.H - 0.05, -1.05);
    this.panelRetrato.lookAt(0, this.H, 0.2);
    this.raiz.add(this.panelRetrato);
    this.m.fx.aparecer(this.panelRetrato, 0.4, 0.5);
  }
}
