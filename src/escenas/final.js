import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';

/** Pantalla de cierre que el motor agrega al final de toda lección. */
export class EscenaFinal extends EscenaBase {
  construir() {
    const { H } = this;
    const leccion = this.m.leccion;
    const gamificado = this.m.gamificado;
    const p = this.m.puntaje ?? {};
    // Medalla según el porcentaje de errores en toda la lección: hasta 15 % oro, hasta 35 % plata.
    const tasaError = (p.errores ?? 0) / Math.max(1, (p.aciertos ?? 0) + (p.errores ?? 0));
    const medalla = tasaError <= 0.15 ? ['🥇', 'medallaOro'] : tasaError <= 0.35 ? ['🥈', 'medallaPlata'] : ['🥉', 'medallaBronce'];
    const panel = new PanelLienzo(1.2, gamificado ? 0.78 : 0.6, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 48, borde: COLORES.amarillo, grosor: 12 });
      if (gamificado) {
        // Cada línea se coloca debajo de la anterior (los títulos largos ocupan dos líneas).
        let y = escribir(ctx, medalla[0], w / 2, 24, { tam: 140, alinear: 'center', interlineado: 1.1 });
        y = escribir(ctx, this.t(medalla[1]), w / 2, y + 6, { tam: 56, peso: 800, alinear: 'center', maxAncho: w - 80, interlineado: 1.15 });
        y = escribir(ctx, `⭐ ${p.puntos.toLocaleString('es-EC')} ${this.t('puntos')}`, w / 2, y + 14, { tam: 72, peso: 900, color: '#e09b00', alinear: 'center' });
        y = escribir(ctx, this.t('estadisticas', { aciertos: p.aciertos, racha: p.mejorRacha }), w / 2, y + 8, { tam: 38, peso: 700, color: COLORES.suave, alinear: 'center', maxAncho: w - 80 });
        escribir(ctx, leccion.titulo, w / 2, y + 12, { tam: 32, color: COLORES.suave, alinear: 'center', maxAncho: w - 100, maxAlto: h - y - 110 });
        escribir(ctx, this.t('quitateGafas'), w / 2, h - 80, { tam: 34, peso: 600, color: COLORES.primario, alinear: 'center', maxAncho: w - 80 });
        return;
      }
      escribir(ctx, '🏆', w / 2, 40, { tam: 120, alinear: 'center' });
      escribir(ctx, this.t('leccionCompletada'), w / 2, 200, { tam: 70, peso: 800, alinear: 'center', maxAncho: w - 80 });
      escribir(ctx, leccion.titulo, w / 2, 300, { tam: 42, color: COLORES.suave, alinear: 'center', maxAncho: w - 100, maxAlto: 110 });
      escribir(ctx, this.t('quitateGafas'), w / 2, h - 90, { tam: 36, peso: 600, color: COLORES.primario, alinear: 'center', maxAncho: w - 80 });
    });
    panel.position.set(0, H + (gamificado ? 0.2 : 0.12), -1.5);
    panel.lookAt(0, H, 0);
    this.raiz.add(panel);
    this.panel = panel;
    this.presentar(panel);

    for (const [x, modelo] of [[-0.85, 'estrella'], [0.85, 'estrella']]) {
      const m = this.modelo(modelo, { tamano: 0.22 });
      m.position.set(x, H + 0.3, -1.35);
      this.raiz.add(m);
    }

    const repetir = this.boton(this.t('repetir'), () => this.m.reiniciar(), { ancho: 0.5, alto: 0.13, color: '#e6ebf8', colorTexto: COLORES.texto });
    repetir.position.set(0, H - 0.34, -1.4);
    repetir.lookAt(0, H, 0);
    this.raiz.add(repetir);
  }

  iniciar() {
    super.iniciar();
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.panel).add(new THREE.Vector3(0, 0.1, 0.3)), 120);
    this.narrar(`${this.t('leccionCompletada')} ${this.t('quitateGafas')}`);
  }
}
