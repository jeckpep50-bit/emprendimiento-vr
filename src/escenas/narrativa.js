import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { liberar } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';

/**
 * Narrativa: una secuencia de pasos de texto, cada uno con emoji y modelo 3D opcionales.
 * datos: { titulo, pasos: [{ texto, emoji?, modelo?, opciones? }] }
 */
export class EscenaNarrativa extends EscenaBase {
  construir() {
    const { H } = this;
    this.pasos = this.datos.pasos ?? [];
    this.paso = 0;
    const conModelo = this.pasos.some((p) => p.modelo);

    this.panel = new PanelLienzo(1.25, 0.74, (ctx, w, h) => this._dibujar(ctx, w, h));
    this.panel.position.set(conModelo ? 0.28 : 0, H + 0.02, -1.5);
    this.panel.lookAt(0, H, 0);
    this.raiz.add(this.panel);

    this.soporte = new THREE.Group();
    this.soporte.position.set(-0.72, H - 0.05, -1.3);
    this.raiz.add(this.soporte);
    this.cadaCuadro((dt) => (this.soporte.rotation.y += dt * 0.5));

    const yBotones = H - 0.47;
    const xBase = this.panel.position.x;
    this.btnAtras = this.boton(this.t('atras'), () => this.ir(this.paso - 1), { ancho: 0.34, alto: 0.12, color: '#e6ebf8', colorTexto: COLORES.texto });
    this.btnAtras.position.set(xBase - 0.42, yBotones, -1.42);
    this.btnSiguiente = this.boton(this.t('siguiente'), () => this.ir(this.paso + 1), { ancho: 0.46, alto: 0.13 });
    this.btnSiguiente.position.set(xBase + 0.36, yBotones, -1.42);
    this.raiz.add(this.btnAtras, this.btnSiguiente);

    if (this.m.leccion.narracion && this.m.audio.puedeNarrar(this.m.leccion.idioma)) {
      this.btnEscuchar = this.boton(this.t('escuchar'), () => this.m.audio.narrar(this.pasos[this.paso].texto, this.m.leccion.idioma), {
        ancho: 0.3,
        alto: 0.11,
        color: COLORES.amarillo,
        colorTexto: COLORES.texto,
      });
      this.btnEscuchar.position.set(xBase - 0.02, yBotones, -1.42);
      this.raiz.add(this.btnEscuchar);
    }
    for (const b of [this.btnAtras, this.btnSiguiente, this.btnEscuchar]) b?.lookAt(0, H, 0);

    // En la primera escena, dentro de las gafas, se recuerda cómo moverse.
    if (this.indice === 0 && this.m.app.enVR) {
      const consejo = this.etiqueta(this.t('consejoMovimiento'), { ancho: 1.0, alto: 0.07, tam: 30, fondo: 'rgba(20, 30, 60, 0.75)', color: '#ffffff' });
      consejo.position.set(xBase, yBotones - 0.13, -1.4);
      consejo.lookAt(0, H, 0);
      this.raiz.add(consejo);
      this.presentar(consejo, 0.6);
    }

    this.ir(0, true);
    this.presentar(this.panel);
    this.presentar(this.btnSiguiente, 0.25);
    if (this.btnEscuchar) this.presentar(this.btnEscuchar, 0.3);
  }

  ir(i, inicial = false) {
    if (i >= this.pasos.length) return this.terminar();
    this.paso = Math.max(0, i);
    const paso = this.pasos[this.paso];
    this.panel.redibujar();
    this.btnAtras.visible = this.paso > 0;
    this.btnSiguiente.setTexto(this.paso === this.pasos.length - 1 ? this.t('continuar') : this.t('siguiente'));

    for (const hijo of [...this.soporte.children]) {
      this.soporte.remove(hijo);
      liberar(hijo);
    }
    if (paso.modelo) {
      const modelo = this.modelo(paso.modelo, { tamano: 0.42, ...paso.opciones });
      this.soporte.add(modelo);
      this.m.fx.aparecer(modelo);
    }
    if (!inicial) this.m.fx.latido(this.panel, 0.03);
    this.narrar(paso.texto);
  }

  _dibujar(ctx, w, h) {
    const paso = this.pasos[this.paso] ?? { texto: '' };
    tarjeta(ctx, w, h, { radio: 48 });
    pastilla(ctx, this.t('escenaDe', { n: this.indice + 1, total: this.total }), 48, 40, { tam: 26 });
    const puntos = this.pasos.length;
    for (let i = 0; i < puntos; i++) {
      ctx.beginPath();
      ctx.arc(w - 60 - (puntos - 1 - i) * 34, 62, i === this.paso ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = i <= this.paso ? COLORES.primario : '#d5dcec';
      ctx.fill();
    }
    let y = escribir(ctx, this.datos.titulo ?? '', 48, 108, { tam: 58, peso: 800, maxAncho: w - 96, maxAlto: 150, interlineado: 1.15 });
    y += 18;
    if (paso.emoji) {
      ctx.font = fuente(84, 400);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(paso.emoji, 48, y);
      escribir(ctx, paso.texto, 160, y + 4, { tam: 44, maxAncho: w - 210, maxAlto: h - y - 50 });
    } else {
      escribir(ctx, paso.texto, 48, y, { tam: 44, maxAncho: w - 96, maxAlto: h - y - 50 });
    }
  }
}
