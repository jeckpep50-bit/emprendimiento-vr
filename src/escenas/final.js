import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';

/** Pantalla de cierre que el motor agrega al final de toda lección. */
export class EscenaFinal extends EscenaBase {
  construir() {
    const { H } = this;
    const leccion = this.m.leccion;
    const panel = new PanelLienzo(1.2, 0.6, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 48, borde: COLORES.amarillo, grosor: 12 });
      escribir(ctx, '🏆', w / 2, 40, { tam: 120, alinear: 'center' });
      escribir(ctx, this.t('leccionCompletada'), w / 2, 200, { tam: 70, peso: 800, alinear: 'center', maxAncho: w - 80 });
      escribir(ctx, leccion.titulo, w / 2, 300, { tam: 42, color: COLORES.suave, alinear: 'center', maxAncho: w - 100, maxAlto: 110 });
      escribir(ctx, this.t('quitateGafas'), w / 2, h - 90, { tam: 36, peso: 600, color: COLORES.primario, alinear: 'center', maxAncho: w - 80 });
    });
    panel.position.set(0, H + 0.12, -1.5);
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
