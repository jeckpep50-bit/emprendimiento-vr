import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Ilustración del Cotopaxi en erupción para la pared de LED (canvas). */
function dibujarVolcan(ctx, w, h, t) {
  const cielo = ctx.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, '#4a3f45');
  cielo.addColorStop(1, '#e2a06a');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h);
  // Columna de ceniza que se mueve
  for (let i = 0; i < 16; i++) {
    const k = ((i / 16 + t * 0.04) % 1);
    ctx.fillStyle = `rgba(${70 + i * 3}, ${66 + i * 3}, ${64 + i * 3}, 0.9)`;
    ctx.beginPath();
    ctx.arc(w * 0.5 + Math.sin(i * 2.1 + t * 0.3) * w * 0.05 * k + k * w * 0.12, h * 0.45 - k * h * 0.42, h * (0.05 + k * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }
  // El volcán
  ctx.fillStyle = '#4a4240';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h);
  ctx.lineTo(w * 0.46, h * 0.47);
  ctx.lineTo(w * 0.54, h * 0.47);
  ctx.lineTo(w * 0.9, h);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.moveTo(w * 0.385, h * 0.565);
  ctx.lineTo(w * 0.46, h * 0.47);
  ctx.lineTo(w * 0.54, h * 0.47);
  ctx.lineTo(w * 0.615, h * 0.565);
  ctx.lineTo(w * 0.55, h * 0.54);
  ctx.lineTo(w * 0.5, h * 0.58);
  ctx.lineTo(w * 0.45, h * 0.54);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 110, 40, ${0.6 + Math.sin(t * 4) * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.47, w * 0.05, h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Transmisión: el estudio sale al aire con el reporte del estudiante. La presentadora
 * abre, el reportero lee cada frase (que aparece en la pared de LED y en el monitor),
 * la audiencia crece y al final queda un resumen de lo aprendido.
 * datos: { titulo, instruccion, mensajeFinal, presentador?: { opciones, posicion },
 *   apertura: { quien, texto }, reporte: [{ quien, texto, emoji }], cierre: { quien, texto },
 *   resumen: [textos] }
 */
export class EscenaTransmision extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.linea = null;
    this.audiencia = 25000;
    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', y: H + 0.62, z: -1.75 });
    this.cabecera.derecha(this.t('estudio'));

    if (d.presentador) {
      this.sofia = this.crearPersona({ edad: 'adulto', expresion: 'feliz', ...d.presentador.opciones }, d.presentador.posicion ?? [0, 0, -2.45], { mirar: true });
      this.gestosAlHablar(this.sofia);
    }

    // Monitor de retorno: lo que se ve "al aire" en grande
    this.monitor = new PanelLienzo(0.95, 0.42, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(13, 20, 38, 0.92)';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 30);
      ctx.fill();
      ctx.fillStyle = '#d62839';
      ctx.fillRect(0, 0, 250, 62);
      escribir(ctx, this.alAire ? '● EN VIVO' : '○ LISTO', 125, 32, { tam: 34, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
      escribir(ctx, this.t('televidentes', { n: Math.round(this.audiencia).toLocaleString('es-EC') }), w - 24, 32, { tam: 30, peso: 800, color: '#ffc23c', alinear: 'right', base: 'middle' });
      const l = this.linea;
      if (l) escribir(ctx, `${l.emoji ?? '🎙️'} ${l.texto}`, 30, 84, { tam: 38, tamMin: 24, peso: 700, color: '#ffffff', maxAncho: w - 60, maxAlto: h - 100, interlineado: 1.15 });
    });
    // A la derecha: así no tapa a la presentadora
    this.monitor.position.set(1.05, H - 0.02, -1.2);
    this.monitor.lookAt(0, H, 0.2);
    this.raiz.add(this.monitor);
    this.presentar(this.monitor, 0.2);
  }

  get estudio() {
    return this.m.entorno?.api;
  }

  async vozInicial() {
    const d = this.datos;
    await this.esperar(0.5);
    if (d.instruccion) await (this.sofia ? this.hablarPersona(this.sofia, d.instruccion, 'guia') : this.voz(d.instruccion));
    if (this._destruida) return;
    // El gran botón rojo
    this.btnAire = this.boton(this.t('botonAlAire'), () => this._transmitir(), { ancho: 0.5, alto: 0.16, color: '#d62839', tam: 46 });
    this.btnAire.position.set(0, this.H - 0.35, -1.1);
    this.btnAire.lookAt(0, this.H, 0);
    this.raiz.add(this.btnAire);
    this.m.fx.aparecer(this.btnAire, 0.4);
    this.cadaCuadro((_dt, t) => this.btnAire.visible && this.btnAire.scale.setScalar(1 + Math.max(0, Math.sin(t * 4)) * 0.06));
  }

  async _transmitir() {
    if (this.alAire) return;
    this.alAire = true;
    const d = this.datos;
    this.btnAire.visible = false;
    this.m.entrada.habilitar(this.btnAire, false);
    this.estudio?.alAire(true);
    this.cabecera.derecha(this.t('enVivo'));
    // Cortina musical
    [523, 659, 784, 1047].forEach((f, i) => this.m.audio.tono(f, 0.22, { tipo: 'square', volumen: 0.06, retardo: i * 0.13 }));
    this.m.audio.tono(1047, 0.8, { tipo: 'triangle', volumen: 0.08, retardo: 0.55 });
    let reloj = 0;
    this.estudio?.pantalla((ctx, w, h) => {
      dibujarVolcan(ctx, w, h, reloj);
      ctx.fillStyle = 'rgba(214, 40, 57, 0.95)';
      ctx.fillRect(0, h * 0.05, w * 0.36, h * 0.13);
      escribir(ctx, '● EN VIVO · COTOPAXI', w * 0.02, h * 0.115, { tam: h * 0.065, peso: 900, color: '#ffffff', base: 'middle' });
      if (this.linea) {
        ctx.fillStyle = 'rgba(13, 20, 38, 0.85)';
        ctx.fillRect(0, h * 0.74, w, h * 0.26);
        escribir(ctx, `${this.linea.emoji ?? '🎙️'} ${this.linea.texto}`, w * 0.03, h * 0.87, { tam: h * 0.06, tamMin: h * 0.035, peso: 700, color: '#ffffff', base: 'middle', maxAncho: w * 0.94, maxAlto: h * 0.22 });
      }
    });
    this.cadaCuadro((dt) => {
      reloj += dt;
      if (Math.floor(reloj * 8) !== Math.floor((reloj - dt) * 8)) {
        this.estudio?.redibujarPantalla();
        this.monitor.redibujar();
      }
      this.audiencia += dt * (this.linea ? 2600 : 600);
    });
    await this.esperar(1.2);
    for (const l of [d.apertura, ...(d.reporte ?? []), d.cierre]) {
      if (!l || this._destruida) continue;
      this.linea = l;
      this.monitor.redibujar();
      this.m.fx.latido(this.monitor, 0.03);
      if (l.quien === 'guia' && this.sofia) await this.hablarPersona(this.sofia, l.texto, l.quien);
      else await this.voz(l.texto, l.quien);
      if (this._destruida) return;
      await this.esperar(0.35);
    }
    if (this._destruida) return;
    // Aplausos del estudio
    for (let i = 0; i < 18; i++) this.m.audio.rafaga({ duracion: 0.12, filtro: 'bandpass', frecuencia: 1800 + Math.random() * 1200, volumen: 0.05, retardo: i * 0.09 + Math.random() * 0.05 });
    this.m.audio.exito();
    this.estudio?.alAire(false);
    this.linea = null;
    this._resumen();
  }

  async _resumen() {
    const { H } = this;
    const d = this.datos;
    const panel = new PanelLienzo(1.15, 0.7, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 40, borde: COLORES.amarillo, grosor: 10 });
      escribir(ctx, this.t('loAprendido'), 36, 30, { tam: 46, peso: 900 });
      let y = 104;
      for (const r of d.resumen ?? []) y = escribir(ctx, `✔ ${r}`, 40, y, { tam: 38, tamMin: 26, peso: 600, color: '#1b5e3f', maxAncho: w - 80, interlineado: 1.15 }) + 14;
    });
    panel.position.set(0, H - 0.05, -1.3);
    panel.lookAt(0, H, 0);
    this.monitor.visible = false;
    this.raiz.add(panel);
    this.m.fx.aparecer(panel, 0.5);
    this.m.fx.confeti(this.posMundo(panel).add(V(0, 0.4, 0)), 120);
    this.cabecera.mensaje(d.mensajeFinal, COLORES.verde);
    this.mostrarContinuar(V(0, H - 0.5, -1.1));
    if (d.mensajeFinal) await (this.sofia ? this.hablarPersona(this.sofia, d.mensajeFinal, 'guia') : this.voz(d.mensajeFinal));
  }

  destruir() {
    this.estudio?.pantalla(null);
    super.destruir();
  }
}
