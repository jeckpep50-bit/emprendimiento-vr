import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { liberar } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';

/**
 * Quiz de opción múltiple con retroalimentación inmediata.
 * datos: { titulo, preguntas: [{ pregunta, opciones: [..2-4], correcta: índice, explicacion, modelo?, opciones3d? }] }
 */
export class EscenaQuiz extends EscenaBase {
  construir() {
    const { H } = this;
    this.preguntas = this.datos.preguntas ?? [];
    this.actual = 0;
    this.puntos = 0;
    this.respondida = null; // índice elegido
    this.final = false;

    this.panel = new PanelLienzo(1.3, 0.56, (ctx, w, h) => this._dibujar(ctx, w, h));
    this.panel.position.set(0, H + 0.26, -1.55);
    this.panel.lookAt(0, H, 0);
    this.raiz.add(this.panel);
    this.presentar(this.panel);

    this.soporte = new THREE.Group();
    this.soporte.position.set(-0.98, H + 0.12, -1.3);
    this.raiz.add(this.soporte);
    this.cadaCuadro((dt) => (this.soporte.rotation.y += dt * 0.5));

    this.botones = [0, 1, 2, 3].map((i) => {
      const b = this.boton('', () => this._responder(i), { ancho: 0.62, alto: 0.15, color: '#e6ebf8', colorTexto: COLORES.texto, alinear: 'left', tam: 38 });
      this.raiz.add(b);
      return b;
    });
    this.btnSiguiente = this.boton(this.t('siguiente'), () => this._avanzar(), { ancho: 0.46, alto: 0.13 });
    this.btnSiguiente.position.set(0, H - 0.6, -1.3);
    this.btnSiguiente.lookAt(0, H, 0);
    this.raiz.add(this.btnSiguiente);
    this._mostrarPregunta();
  }

  _mostrarPregunta() {
    const { H } = this;
    const p = this.preguntas[this.actual];
    this.respondida = null;
    this.btnSiguiente.visible = false;
    const letras = ['A', 'B', 'C', 'D'];
    this.botones.forEach((b, i) => {
      const texto = p.opciones[i];
      b.visible = texto !== undefined;
      if (!b.visible) return;
      const fila = Math.floor(i / 2);
      const enFila = Math.min(2, p.opciones.length - fila * 2);
      const x = enFila === 1 ? 0 : (i % 2 ? 0.33 : -0.33);
      b.position.set(x, H - 0.15 - fila * 0.2, -1.45);
      b.lookAt(0, H, 0);
      b.setModo('normal');
      b.setTexto(`${letras[i]}.  ${texto}`);
      this.m.entrada.habilitar(b, true);
      this.m.fx.aparecer(b, 0.35, i * 0.06);
    });

    for (const hijo of [...this.soporte.children]) {
      this.soporte.remove(hijo);
      liberar(hijo);
    }
    if (p.modelo) this.soporte.add(this.modelo(p.modelo, { tamano: 0.34, ...p.opciones3d }));

    this.panel.redibujar();
    this.narrar(p.pregunta);
  }

  _responder(i) {
    if (this.respondida !== null) return;
    const p = this.preguntas[this.actual];
    this.respondida = i;
    const bien = i === p.correcta;
    if (bien) this.puntos++;
    this.botones.forEach((b, k) => {
      this.m.entrada.habilitar(b, false);
      if (k === p.correcta) b.setModo('correcto');
      else if (k === i) b.setModo('incorrecto');
      else b.setModo('apagado');
    });
    const pos = this.posMundo(this.botones[i]);
    if (bien) {
      this.m.audio.acierto(pos);
      this.ganar(pos, 200);
      this.m.fx.confeti(pos, 30);
    } else {
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.sacudir(this.botones[i]);
    }
    this.panel.redibujar();
    this.m.fx.latido(this.panel, 0.03);
    this.narrar(p.explicacion);
    this.btnSiguiente.setTexto(this.actual === this.preguntas.length - 1 ? this.t('continuar') : this.t('siguiente'));
    this.btnSiguiente.visible = true;
    this.m.fx.aparecer(this.btnSiguiente, 0.35, 0.2);
  }

  _avanzar() {
    if (this.final) return this.terminar();
    this.actual++;
    if (this.actual < this.preguntas.length) return this._mostrarPregunta();

    this.final = true;
    this.botones.forEach((b) => (b.visible = false));
    for (const hijo of [...this.soporte.children]) {
      this.soporte.remove(hijo);
      liberar(hijo);
    }
    this.soporte.add(this.modelo('trofeo', { tamano: 0.36 }));
    this.panel.redibujar();
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.panel).add(new THREE.Vector3(0, 0, 0.3)), 90);
    this.btnSiguiente.setTexto(this.t('continuar'));
    this.btnSiguiente.position.y = this.H - 0.2;
    this.narrar(this._frase());
  }

  _frase() {
    const r = this.puntos / Math.max(this.preguntas.length, 1);
    return this.t(r === 1 ? 'resultadoPerfecto' : r >= 0.6 ? 'resultadoBueno' : 'resultadoRepasar');
  }

  _dibujar(ctx, w, h) {
    tarjeta(ctx, w, h, { radio: 48 });
    const total = this.preguntas.length;

    if (this.final) {
      pastilla(ctx, this.datos.titulo ?? '', 48, 40, { tam: 28 });
      const estrellas = Math.max(1, Math.round((this.puntos / Math.max(total, 1)) * 3));
      ctx.font = fuente(110, 400);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('⭐'.repeat(estrellas) + '☆'.repeat(3 - estrellas), w / 2, 110);
      escribir(ctx, this.t('resultado', { n: this.puntos, total }), w / 2, 270, { tam: 64, peso: 800, alinear: 'center', maxAncho: w - 96 });
      escribir(ctx, this._frase(), w / 2, 370, { tam: 46, color: COLORES.suave, alinear: 'center', maxAncho: w - 96 });
      return;
    }

    const p = this.preguntas[this.actual];
    pastilla(ctx, this.t('pregunta', { n: this.actual + 1, total }), 48, 40, { tam: 28 });
    ctx.font = fuente(30, 700);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORES.suave;
    ctx.fillText(`⭐ ${this.puntos}`, w - 52, 50);

    const conExplicacion = this.respondida !== null;
    const yFin = conExplicacion ? h - 190 : h - 50;
    escribir(ctx, p.pregunta, 48, 116, { tam: 54, peso: 800, maxAncho: w - 96, maxAlto: yFin - 116, interlineado: 1.2 });

    if (conExplicacion) {
      const bien = this.respondida === p.correcta;
      const color = bien ? COLORES.verde : COLORES.naranja;
      ctx.fillStyle = color + '22';
      ctx.beginPath();
      ctx.roundRect(32, h - 176, w - 64, 140, 28);
      ctx.fill();
      const prefijo = bien ? `✅ ${this.t('correcto')} ` : `💡 `;
      escribir(ctx, prefijo + (p.explicacion ?? ''), 56, h - 106, { tam: 36, peso: 600, color: bien ? '#1b7f4f' : '#9a4b00', maxAncho: w - 112, maxAlto: 128, base: 'middle', interlineado: 1.2 });
    }
  }
}
