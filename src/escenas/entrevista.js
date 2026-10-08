import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { apiModelo } from '../mundo/prefabs/index.js';
import { persona } from '../mundo/prefabs/personas.js';
import { personajesDe } from '../leccion/voces.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const MAX_VISIBLES = 6;
const COLORES_PERSONAJE = ['#ff5aa5', '#22b8cf', '#8b5cf6', '#ff9f43'];

/**
 * Entrevista: el estudiante conversa con uno o varios personajes de tamaño real
 * eligiendo preguntas. Las buenas (abiertas, sin juzgar) revelan hallazgos que se
 * anotan en un cuaderno y pueden abrir preguntas para profundizar ("sigue"); las
 * malas reciben una explicación de por qué no sirven.
 * datos: {
 *   titulo, instruccion?, saludo?, mensajeFinal?, minimo?,
 *   personaje: { nombre, modelo?, expresion?, posicion?: [x,y,z], opciones?, voz? }
 *   — o varios — personajes: [{ id, nombre, emoji?, modelo?, opciones?, posicion?, voz?, saludo?, expresion? }],
 *   preguntas: [{ texto, tipo: 'buena'|'mala', a? (id del personaje), respuesta?, hallazgo?,
 *                 expresion?, retro?, error?: 'cerrada'|'juzga'|'sugiere'|'irrelevante', sigue?: [preguntas] }]
 * }
 * Con "modelo": "persona" se usa una persona articulada (opciones de personas.js).
 */
export class EscenaEntrevista extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.personajes = personajesDe(d).map((p, i, lista) => this._crearPersonaje(p, i, lista.length));
    this.pendientes = barajar(d.preguntas ?? []);
    const contarBuenas = (lista) => lista.reduce((n, q) => n + (q.tipo === 'buena' && q.hallazgo ? 1 : 0) + contarBuenas(q.sigue ?? []), 0);
    const buenas = contarBuenas(d.preguntas ?? []);
    this.minimo = Math.min(d.minimo ?? buenas, buenas);
    this.hallazgos = [];
    this.preguntoAlgo = false;
    this.varios = this.personajes.length > 1;

    const nombre = this.personajes.map((p) => p.datos.nombre).join(' y ');
    // Con varios adultos, el encabezado sube para no tapar sus caras ni sus globos.
    const cabezas = Math.max(...this.personajes.map((p) => p.modelo.position.y + p.alto));
    const yCabecera = this.varios ? Math.max(H + 0.47, cabezas + 0.42) : undefined;
    this.cabecera = this.encabezado({ instruccion: d.instruccion || this.t('entrevistaInstruccion', { nombre }), y: yCabecera });
    this.cabecera.derecha(this.t('hallazgosProgreso', { n: 0, total: this.minimo }));

    // Preguntas (izquierda): se muestran hasta 6; las respondidas dejan su lugar a otras.
    this.botones = new Map();
    this.zonaPreguntas = new THREE.Group();
    this.zonaPreguntas.position.set(-1.05, H + 0.2, -1.0);
    this.zonaPreguntas.lookAt(0, H, 0.3);
    this.raiz.add(this.zonaPreguntas);
    this._acomodarPreguntas(true);

    // Cuaderno de hallazgos (derecha)
    const altoCuaderno = this.minimo > 4 ? 0.78 : 0.66;
    this.cuaderno = new PanelLienzo(0.72, altoCuaderno, (ctx, w, h) => this._dibujarCuaderno(ctx, w, h));
    this.cuaderno.position.set(1.05, H - 0.08 - (altoCuaderno - 0.66) / 2, -1.0);
    this.cuaderno.lookAt(0, H, 0.3);
    this.raiz.add(this.cuaderno);
    this.presentar(this.cuaderno, 0.4);
  }

  // ── Personajes ───────────────────────────────────────────────────────────

  _crearPersonaje(datos, i, total) {
    const { H } = this;
    const porDefecto = total === 1 ? [0, 0, -1.75] : [(i - (total - 1) / 2) * 1.05, 0, -1.95];
    const [px, py, pz] = datos.posicion ?? porDefecto;
    let modelo;
    if (datos.modelo === 'persona') {
      modelo = persona({ expresion: datos.expresion ?? 'neutral', ...datos.opciones });
      this.cadaCuadro((_dt, t) => modelo.userData.animar(t));
    } else {
      modelo = this.modelo(datos.modelo ?? 'estudiante', { normalizar: false, expresion: datos.expresion ?? 'neutral', ...datos.opciones });
    }
    modelo.position.set(px, py, pz);
    modelo.lookAt(0, py, 0);
    this.raiz.add(modelo);
    this.mirarAlUsuario([modelo]);
    const alto = modelo.userData.tam?.y ?? new THREE.Box3().setFromObject(modelo).getSize(new THREE.Vector3()).y;
    const p = {
      datos,
      modelo,
      alto,
      color: datos.color ?? COLORES_PERSONAJE[i % COLORES_PERSONAJE.length],
      setExpresion: modelo.userData.setExpresion ?? apiModelo(modelo, 'setExpresion') ?? (() => {}),
      hablar: modelo.userData.hablar ?? apiModelo(modelo, 'hablar') ?? (() => {}),
      texto: '',
    };
    // Globo de diálogo junto a la cabeza: a la derecha (un personaje) o hacia el centro
    // (varios), con la "cola" apuntando a quien habla.
    const haciaCentro = total === 1 || px <= 0 ? 1 : -1;
    p.lado = haciaCentro > 0 ? 'izq' : 'der';
    p.globo = new PanelLienzo(total === 1 ? 0.92 : 0.84, total === 1 ? 0.36 : 0.34, (ctx, w, h) => this._dibujarGlobo(ctx, w, h, p));
    if (total === 1) p.globo.position.set(px + 0.6, py + alto - 0.02, pz + 0.08);
    else p.globo.position.set(px + haciaCentro * 0.56, py + alto - 0.08, pz + 0.12);
    p.globo.lookAt(0, H, 0);
    p.globo.visible = false;
    this.raiz.add(p.globo);
    return p;
  }

  _personaje(id) {
    return this.personajes.find((p) => p.datos.id === id) ?? this.personajes[0];
  }

  /** El personaje dice algo: globo, expresión y voz (o un movimiento de cabeza si no hay audio). */
  decir(p, texto, expresion) {
    for (const otro of this.personajes) if (otro !== p) otro.globo.visible = false;
    p.texto = texto;
    p.globo.redibujar();
    p.globo.visible = true;
    this.m.fx.aparecer(p.globo, 0.35);
    if (expresion) p.setExpresion(expresion);
    const quien = p.datos.voz;
    const pos = p.modelo.localToWorld(new THREE.Vector3(0, (p.modelo.userData.alturaOjos ?? p.alto * 0.85) / (p.modelo.scale.x || 1), 0));
    if (quien && this.tieneVoz(texto, quien)) {
      if (p.modelo.userData.fuenteHabla !== undefined) p.modelo.userData.fuenteHabla = () => this.m.audio.nivelVoz();
      else p.hablar(this.duracionVoz(texto, quien));
      return this.voz(texto, quien, { pos }).then((completa) => {
        if (p.modelo.userData.fuenteHabla) p.modelo.userData.fuenteHabla = null;
        return completa;
      });
    }
    p.hablar(Math.min(4, 1 + texto.length / 25));
    this.m.audio.tono(523, 0.12, { tipo: 'triangle', volumen: 0.05, pos });
    this.narrar(texto);
    return Promise.resolve(false);
  }

  /** Primero la guía lee la instrucción; después cada personaje saluda. */
  async vozInicial() {
    await super.vozInicial();
    for (const p of this.personajes) {
      const saludo = p.datos.saludo ?? (p === this.personajes[0] ? this.datos.saludo : null);
      if (!saludo) continue;
      await this.esperar(0.4);
      if (this._destruida || this.preguntoAlgo) return;
      await this.decir(p, saludo, p.datos.expresion);
    }
  }

  // ── Preguntas ────────────────────────────────────────────────────────────

  _botonPregunta(q) {
    if (this.botones.has(q)) return this.botones.get(q);
    const p = this._personaje(q.a);
    const prefijo = q._profundiza ? '↪ ' : '';
    const texto = this.varios ? `${prefijo}${p.datos.emoji ?? '👤'} ${q.texto}` : `${prefijo}${q.texto}`;
    const b = this.boton(texto, () => this._preguntar(q, b), {
      ancho: 0.7,
      alto: 0.135,
      color: q._profundiza ? '#fff1c9' : '#ffffff',
      colorTexto: COLORES.texto,
      tam: 30,
      alinear: 'left',
    });
    this.zonaPreguntas.add(b);
    this.botones.set(q, b);
    return b;
  }

  /** Coloca en columna las preguntas visibles (las nuevas aparecen con un rebote). */
  _acomodarPreguntas(inicial = false) {
    const visibles = this.pendientes.slice(0, MAX_VISIBLES);
    const paso = 0.155;
    const n = visibles.length;
    visibles.forEach((q, i) => {
      const nuevo = !this.botones.has(q);
      const b = this._botonPregunta(q);
      const destino = new THREE.Vector3(0, -i * paso + (n > 5 ? 0.05 : 0), 0);
      if (nuevo) {
        b.position.copy(destino);
        if (inicial) this.presentar(b, 0.3 + i * 0.08);
        else this.m.fx.aparecer(b, 0.4, 0.15);
      } else {
        this.m.fx.moverA(b, destino, 0.35);
      }
    });
  }

  _quitarBoton(q) {
    const b = this.botones.get(q);
    if (!b) return;
    this.botones.delete(q);
    this.m.entrada.desregistrar(b);
    this.m.fx.escalarA(b, 0.01, 0.25).then(() => b.removeFromParent());
  }

  _preguntar(q, boton) {
    this.preguntoAlgo = true;
    this.m.entrada.habilitar(boton, false);
    const p = this._personaje(q.a);
    if (q.tipo !== 'buena') {
      boton.setModo('incorrecto');
      this.decir(p, q.respuesta || '…', q.expresion ?? 'sorpresa');
      this.m.audio.error(this.posMundo(boton));
      this.perder();
      const tipo = q.error ? `${this.t(`errorPregunta_${q.error}`)} ` : '';
      this.cabecera.mensaje(`🤔 ${tipo}${q.retro || this.t('preguntaMala')}`, COLORES.naranja);
      // Después de un momento, la pregunta mala deja su lugar a otra.
      this.esperar(2.6).then(() => {
        if (this._destruida) return;
        this.pendientes = this.pendientes.filter((x) => x !== q);
        this._quitarBoton(q);
        this._acomodarPreguntas();
      });
      return;
    }
    boton.setModo('correcto');
    this.decir(p, q.respuesta ?? '', q.expresion ?? 'feliz');
    // Las preguntas de seguimiento aparecen primero en la lista.
    const seguimiento = (q.sigue ?? []).map((s) => ({ ...s, a: s.a ?? q.a, _profundiza: true }));
    this.pendientes = [...seguimiento, ...this.pendientes.filter((x) => x !== q)];
    this.esperar(1.2).then(() => {
      if (this._destruida) return;
      this._quitarBoton(q);
      this._acomodarPreguntas();
    });
    if (seguimiento.length) this.m.audio.burbuja(this.posMundo(this.zonaPreguntas));
    if (!q.hallazgo) return;
    this.hallazgos.push(q.hallazgo);
    this.cuaderno.redibujar();
    this.m.fx.latido(this.cuaderno, 0.06);
    this.m.audio.acierto(this.posMundo(this.cuaderno));
    this.ganar(this.cuaderno, q._profundiza ? 150 : 100);
    this.m.fx.confeti(this.posMundo(this.cuaderno).add(new THREE.Vector3(0, 0.25, 0)), 18);
    this.cabecera.mensaje(seguimiento.length ? this.t('buenaPreguntaSigue') : this.t('buenaPregunta'), COLORES.verde);
    this.cabecera.derecha(this.t('hallazgosProgreso', { n: Math.min(this.hallazgos.length, this.minimo), total: this.minimo }));

    if (this.hallazgos.length === this.minimo) {
      this.esperar(2.2).then(async () => {
        if (this._destruida) return;
        this.m.audio.exito();
        for (const per of this.personajes) per.setExpresion('feliz');
        const final = this.datos.mensajeFinal || this.t('entrevistaCompleta', { nombre: p.datos.nombre });
        this.cabecera.mensaje(final, COLORES.verde);
        this.mostrarContinuar(new THREE.Vector3(1.05, this.cuaderno.position.y - this.cuaderno.alto / 2 - 0.13, -0.95));
        if (this.datos.mensajeFinal) {
          // Espera a que termine de hablar el personaje para felicitar.
          while (this.m.audio.hablando && !this._destruida) await this.esperar(0.3);
          if (!this._destruida) this.voz(this.datos.mensajeFinal);
        }
      });
    }
  }

  _dibujarGlobo(ctx, w, h, p) {
    // Cuerpo del globo con una "cola" que apunta a la cara del personaje (a la izquierda o a la derecha).
    const cola = 50;
    const izq = p.lado !== 'der';
    const x0 = izq ? cola : 0;
    const ancho = w - cola - 8;
    const alto = h - 32;
    ctx.fillStyle = 'rgba(10, 20, 45, 0.25)';
    ctx.beginPath();
    ctx.roundRect(x0, 16, ancho, alto, 44);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x0, 8, ancho, alto, 44);
    ctx.fill();
    ctx.beginPath();
    if (izq) {
      ctx.moveTo(x0 + 6, h * 0.42);
      ctx.lineTo(4, h * 0.62);
      ctx.lineTo(x0 + 6, h * 0.66);
    } else {
      ctx.moveTo(x0 + ancho - 6, h * 0.42);
      ctx.lineTo(w - 4, h * 0.62);
      ctx.lineTo(x0 + ancho - 6, h * 0.66);
    }
    ctx.fill();
    const nombre = p.datos.nombre;
    if (nombre) pastilla(ctx, nombre, x0 + 24, 22, { tam: 28, fondo: p.color, color: '#ffffff' });
    escribir(ctx, p.texto, x0 + ancho / 2, (alto + 60) / 2 + 8, { tam: 40, tamMin: 24, peso: 600, maxAncho: ancho - 52, maxAlto: alto - 70, alinear: 'center', base: 'middle', interlineado: 1.18 });
  }

  _dibujarCuaderno(ctx, w, h) {
    tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 34 });
    // Renglones y margen, como un cuaderno
    ctx.strokeStyle = 'rgba(79, 124, 255, 0.25)';
    ctx.lineWidth = 3;
    for (let y = 150; y < h - 30; y += 62) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(w - 30, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 90, 95, 0.4)';
    ctx.beginPath();
    ctx.moveTo(80, 110);
    ctx.lineTo(80, h - 30);
    ctx.stroke();
    escribir(ctx, this.t('cuadernoTitulo'), 40, 36, { tam: 46, peso: 800 });
    if (!this.hallazgos.length) {
      escribir(ctx, this.t('cuadernoVacio'), w / 2, h / 2 + 30, { tam: 32, color: COLORES.suave, alinear: 'center', base: 'middle', maxAncho: w - 120 });
      return;
    }
    // Con muchos hallazgos la letra se achica para que quepan todos.
    const n = this.hallazgos.length;
    const tam = n > 6 ? 26 : n > 4 ? 29 : 36;
    let y = 112;
    for (const hallazgo of this.hallazgos) {
      y = escribir(ctx, `✔ ${hallazgo}`, 96, y + (n > 4 ? 8 : 14), { tam, tamMin: 22, peso: 600, color: '#1b5e3f', maxAncho: w - 130, maxAlto: 120, interlineado: 1.14 });
    }
  }
}
