import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { apiModelo } from '../mundo/prefabs/index.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

/**
 * Entrevista: el estudiante conversa con un personaje de tamaño real eligiendo
 * preguntas. Las buenas (abiertas, sin juzgar) revelan hallazgos que se anotan
 * en un cuaderno; las malas reciben una explicación de por qué no sirven.
 * datos: {
 *   titulo, instruccion?, saludo?, mensajeFinal?, minimo?,
 *   personaje: { nombre, modelo?, expresion?, posicion?: [x,y,z], opciones? },
 *   preguntas: [{ texto, tipo: 'buena'|'mala', respuesta?, hallazgo?, expresion?, retro? }]
 * }
 */
export class EscenaEntrevista extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    const p = d.personaje ?? {};
    this.nombre = p.nombre ?? '';
    this.preguntas = barajar(d.preguntas ?? []);
    const buenas = this.preguntas.filter((q) => q.tipo === 'buena' && q.hallazgo);
    this.minimo = Math.min(d.minimo ?? buenas.length, buenas.length);
    this.hallazgos = [];

    this.cabecera = this.encabezado({ instruccion: d.instruccion || this.t('entrevistaInstruccion', { nombre: this.nombre }) });
    this.cabecera.derecha(this.t('hallazgosProgreso', { n: 0, total: this.minimo }));

    // Personaje a tamaño real, de pie en el suelo
    const [px, py, pz] = p.posicion ?? [0, 0, -1.75];
    this.personaje = this.modelo(p.modelo ?? 'estudiante', { normalizar: false, expresion: p.expresion ?? 'neutral', ...p.opciones });
    this.personaje.position.set(px, py, pz);
    this.personaje.lookAt(0, py, 0);
    this.raiz.add(this.personaje);
    this.mirarAlUsuario([this.personaje]);
    this.setExpresion = apiModelo(this.personaje, 'setExpresion') ?? (() => {});
    this.hablar = apiModelo(this.personaje, 'hablar') ?? (() => {});
    const alto = this.personaje.userData.tam.y;

    // Globo de diálogo junto a la cabeza (a la altura de los ojos, sin tapar el encabezado)
    this.texto = '';
    this.globo = new PanelLienzo(0.92, 0.36, (ctx, w, h) => this._dibujarGlobo(ctx, w, h));
    this.globo.position.set(px + 0.6, py + alto - 0.02, pz + 0.08);
    this.globo.lookAt(0, this.H, 0);
    this.globo.visible = false;
    this.raiz.add(this.globo);

    // Preguntas (izquierda)
    const n = this.preguntas.length;
    const paso = 0.155;
    this.botones = this.preguntas.map((q, i) => {
      const b = this.boton(q.texto, () => this._preguntar(q, b), { ancho: 0.7, alto: 0.135, color: '#ffffff', colorTexto: COLORES.texto, tam: 30, alinear: 'left' });
      b.position.set(-1.05, H + 0.2 - i * paso + (n > 5 ? 0.05 : 0), -1.0);
      b.lookAt(0, H, 0.3);
      this.raiz.add(b);
      this.presentar(b, 0.3 + i * 0.08);
      return b;
    });

    // Cuaderno de hallazgos (derecha)
    this.cuaderno = new PanelLienzo(0.72, 0.66, (ctx, w, h) => this._dibujarCuaderno(ctx, w, h));
    this.cuaderno.position.set(1.05, H - 0.08, -1.0);
    this.cuaderno.lookAt(0, H, 0.3);
    this.raiz.add(this.cuaderno);
    this.presentar(this.cuaderno, 0.4);
  }

  iniciar() {
    super.iniciar();
    if (this.datos.saludo) this.m.fx.tween({ duracion: 0.01, retardo: 0.8 }).then(() => !this._destruida && this.decir(this.datos.saludo, this.datos.personaje?.expresion));
  }

  /** El personaje dice algo: aparece el globo, mueve la cabeza y cambia la expresión. */
  decir(texto, expresion) {
    this.texto = texto;
    this.globo.redibujar();
    this.globo.visible = true;
    this.m.fx.aparecer(this.globo, 0.35);
    if (expresion) this.setExpresion(expresion);
    this.hablar(Math.min(4, 1 + texto.length / 25));
    this.m.audio.nota?.(523, { timbre: 'marimba', volumen: 0.06, pos: this.posMundo(this.globo) });
    this.narrar(texto);
  }

  _preguntar(q, boton) {
    this.m.entrada.habilitar(boton, false);
    if (q.tipo !== 'buena') {
      boton.setModo('incorrecto');
      this.decir(q.respuesta || '…', q.expresion ?? 'sorpresa');
      this.m.audio.error(this.posMundo(boton));
      this.cabecera.mensaje(`🤔 ${q.retro || this.t('preguntaMala')}`, COLORES.naranja);
      return;
    }
    boton.setModo('correcto');
    this.decir(q.respuesta ?? '', q.expresion ?? 'feliz');
    if (!q.hallazgo) return;
    this.hallazgos.push(q.hallazgo);
    this.cuaderno.redibujar();
    this.m.fx.latido(this.cuaderno, 0.06);
    this.m.audio.acierto(this.posMundo(this.cuaderno));
    this.m.fx.confeti(this.posMundo(this.cuaderno).add(new THREE.Vector3(0, 0.25, 0)), 18);
    this.cabecera.mensaje(this.t('buenaPregunta'), COLORES.verde);
    this.cabecera.derecha(this.t('hallazgosProgreso', { n: Math.min(this.hallazgos.length, this.minimo), total: this.minimo }));

    if (this.hallazgos.length === this.minimo) {
      this.m.fx.tween({ duracion: 2.2 }).then(() => {
        if (this._destruida) return;
        this.m.audio.exito();
        this.setExpresion('feliz');
        this.cabecera.mensaje(this.datos.mensajeFinal || this.t('entrevistaCompleta', { nombre: this.nombre }), COLORES.verde);
        this.mostrarContinuar(new THREE.Vector3(1.05, this.H - 0.55, -0.95));
      });
    }
  }

  _dibujarGlobo(ctx, w, h) {
    // Cuerpo del globo con la "cola" a la izquierda, apuntando a la cara del personaje.
    const cola = 50;
    const x0 = cola;
    ctx.fillStyle = 'rgba(10, 20, 45, 0.25)';
    ctx.beginPath();
    ctx.roundRect(x0, 16, w - x0 - 8, h - 24, 44);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x0, 8, w - x0 - 8, h - 24, 44);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0 + 6, h * 0.42);
    ctx.lineTo(4, h * 0.62);
    ctx.lineTo(x0 + 6, h * 0.66);
    ctx.fill();
    if (this.nombre) pastilla(ctx, this.nombre, x0 + 24, 22, { tam: 28, fondo: '#ff5aa5', color: '#ffffff' });
    escribir(ctx, this.texto, (w + x0) / 2, (h + 52) / 2, { tam: 40, tamMin: 26, peso: 600, maxAncho: w - x0 - 60, maxAlto: h - 100, alinear: 'center', base: 'middle', interlineado: 1.18 });
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
    let y = 112;
    for (const hallazgo of this.hallazgos) {
      y = escribir(ctx, `✔ ${hallazgo}`, 96, y + 14, { tam: 36, tamMin: 26, peso: 600, color: '#1b5e3f', maxAncho: w - 130, maxAlto: 120, interlineado: 1.18 });
    }
  }
}
