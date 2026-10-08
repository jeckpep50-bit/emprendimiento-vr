import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COLORES_RANURA = ['#ff5aa5', '#22b8cf', '#e09b00', '#2dbe78', '#8b5cf6'];

/** El mismo color, más oscuro (para que el texto se lea bien sobre fondo claro). */
function oscurecer(hex, k = 0.62) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * k);
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/**
 * Escribe varios trozos seguidos, cada uno con su color, partiendo las líneas por
 * palabras. Si no cabe en maxAlto, achica la letra. Devuelve la y donde terminó.
 */
function escribirColores(ctx, trozos, x, y, { tam = 42, tamMin = 26, maxAncho, maxAlto, interlineado = 1.2 }) {
  const palabras = trozos.flatMap((t) => t.texto.split(/\s+/).filter(Boolean).map((p) => ({ p, color: t.color })));
  for (let t = tam; ; t -= 2) {
    ctx.font = fuente(t, 700);
    const espacio = ctx.measureText(' ').width;
    const lineas = [[]];
    let ancho = 0;
    for (const pal of palabras) {
      const a = ctx.measureText(pal.p).width;
      if (ancho + a > maxAncho && lineas.at(-1).length) {
        lineas.push([]);
        ancho = 0;
      }
      lineas.at(-1).push({ ...pal, x: ancho });
      ancho += a + espacio;
    }
    const alto = lineas.length * t * interlineado;
    if (alto <= maxAlto || t <= tamMin) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lineas.forEach((linea, i) => {
        for (const pal of linea) {
          ctx.fillStyle = pal.color;
          ctx.fillText(pal.p, x + pal.x, y + i * t * interlineado);
        }
      });
      return y + alto;
    }
  }
}

/**
 * Frase: el estudiante arma una frase importante parte por parte (p. ej. el reto
 * de diseño: QUIÉN · NECESITA · PORQUE). Para cada parte elige una de varias
 * opciones; las incorrectas explican por qué no sirven. Al final, opcionalmente,
 * elige la mejor pregunta "¿Cómo podríamos…?" entre varias.
 * datos: { titulo, instruccion, mensajeFinal?,
 *   partes: [{ etiqueta, opciones: [{ texto, correcta: bool, retro }] }],
 *   pregunta?: { instruccion, opciones: [{ texto, correcta: bool, retro }] } }
 */
export class EscenaFrase extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.partes = d.partes ?? [];
    this.elegidas = [];
    this.actual = 0;
    this.enPregunta = false;

    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', y: H + 0.72 });
    this._progreso();

    // La frase que se va armando (al frente, a la altura de los ojos)
    this.panelFrase = new PanelLienzo(1.7, 0.42, (ctx, w, h) => this._dibujarFrase(ctx, w, h));
    this.panelFrase.position.set(0, H + 0.24, -1.65);
    this.panelFrase.lookAt(0, H, 0);
    this.raiz.add(this.panelFrase);
    this.presentar(this.panelFrase, 0.2);

    // Opciones (abajo, en abanico)
    this.zonaOpciones = new THREE.Group();
    this.raiz.add(this.zonaOpciones);
    this.retro = new PanelLienzo(1.2, 0.17, (ctx, w, h) => this._dibujarRetro(ctx, w, h));
    this.retro.position.set(0, H - 0.6, -1.25);
    this.retro.lookAt(0, H, 0);
    this.retro.visible = false;
    this.raiz.add(this.retro);
    this.mensajeRetro = null;
    this._mostrarOpciones(this.partes[0].opciones, true);
  }

  _progreso() {
    const total = this.partes.length + (this.datos.pregunta ? 1 : 0);
    const hechas = this.elegidas.length + (this._preguntaLista ? 1 : 0);
    this.cabecera.derecha(`${hechas} / ${total}`);
  }

  _mostrarOpciones(opciones, inicial = false) {
    for (const hijo of [...this.zonaOpciones.children]) {
      this.m.entrada.desregistrar(hijo);
      hijo.removeFromParent();
    }
    const { H } = this;
    const lista = barajar(opciones);
    const n = lista.length;
    lista.forEach((op, i) => {
      const b = this.boton(op.texto, () => this._elegir(op, b), { ancho: 0.62, alto: 0.2, color: '#ffffff', colorTexto: COLORES.texto, tam: 32 });
      const angulo = THREE.MathUtils.degToRad((i - (n - 1) / 2) * 30);
      b.position.set(Math.sin(angulo) * 1.25, H - 0.24, -Math.cos(angulo) * 1.25);
      b.lookAt(0, H, 0);
      this.zonaOpciones.add(b);
      if (inicial) this.presentar(b, 0.4 + i * 0.1, true);
      else this.m.fx.aparecer(b, 0.4, 0.1 + i * 0.08);
    });
  }

  _elegir(op, boton) {
    const pos = this.posMundo(boton);
    if (!op.correcta) {
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.sacudir(boton);
      this._retro(`🤔 ${op.retro ?? this.t('fraseNoSirve')}`, COLORES.naranja);
      this._fallos = (this._fallos ?? 0) + 1;
      return;
    }
    boton.setModo('correcto');
    for (const b of this.zonaOpciones.children) this.m.entrada.habilitar(b, false);
    this.m.audio.acierto(pos);
    this.ganar(pos, this._fallos ? 80 : 160);
    this._fallos = 0;
    this._retro(`✅ ${op.retro ?? this.t('correcto')}`, COLORES.verde);

    if (this.enPregunta) {
      this._preguntaLista = true;
      this.preguntaElegida = op.texto;
      this._progreso();
      this.panelFrase.redibujar();
      this.m.fx.latido(this.panelFrase, 0.05);
      this.esperar(1.2).then(() => !this._destruida && this._completar());
      return;
    }
    // La opción vuela a su lugar en la frase.
    this.elegidas.push(op.texto);
    this._progreso();
    const destino = this.panelFrase.position.clone().add(V(0, 0, 0.05));
    this.m.fx.moverA(boton, destino, 0.5);
    this.m.fx.escalarA(boton, 0.2, 0.5).then(() => {
      if (this._destruida) return;
      boton.visible = false;
      this.panelFrase.redibujar();
      this.m.fx.latido(this.panelFrase, 0.04);
      this.m.audio.burbuja(this.posMundo(this.panelFrase));
    });
    this.actual++;
    this.esperar(1.3).then(() => {
      if (this._destruida) return;
      if (this.actual < this.partes.length) {
        this._mostrarOpciones(this.partes[this.actual].opciones);
      } else if (this.datos.pregunta) {
        this.enPregunta = true;
        this.cabecera.instruccion(this.datos.pregunta.instruccion ?? '');
        this.m.audio.exito();
        this.esperar(0.4).then(() => !this._destruida && this.voz(this.datos.pregunta.instruccion));
        this._mostrarOpciones(this.datos.pregunta.opciones);
      } else {
        this._completar();
      }
    });
  }

  _retro(texto, color) {
    this.mensajeRetro = { texto, color };
    this.retro.visible = true;
    this.retro.redibujar();
    this.m.fx.latido(this.retro, 0.04);
  }

  _completar() {
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.panelFrase).add(V(0, 0.2, 0.2)), 90);
    for (const hijo of [...this.zonaOpciones.children]) hijo.visible = false;
    this.retro.visible = false;
    this.cabecera.mensaje(this.datos.mensajeFinal ?? this.t('fraseCompleta'), COLORES.verde);
    if (this.datos.mensajeFinal) this.voz(this.datos.mensajeFinal);
    this.mostrarContinuar(V(0, this.H - 0.3, -1.4));
  }

  _dibujarFrase(ctx, w, h) {
    tarjeta(ctx, w, h, { radio: 40, borde: '#23304a', grosor: 8 });
    const listo = this.elegidas.length === this.partes.length;
    // Fichas de cada parte, con su etiqueta encima
    let x = 36;
    let y = 30;
    this.partes.forEach((parte, i) => {
      const color = COLORES_RANURA[i % COLORES_RANURA.length];
      const anchoEtiqueta = pastilla(ctx, parte.etiqueta, x, y, { tam: 26, fondo: color, color: '#ffffff' });
      x += anchoEtiqueta + 12;
    });
    y = 96;
    if (!this.elegidas.length) {
      escribir(ctx, this.t('fraseVacia'), w / 2, h / 2 + 30, { tam: 40, color: COLORES.suave, alinear: 'center', base: 'middle', maxAncho: w - 80 });
      return;
    }
    // La frase armada hasta ahora (cada parte con el color de su etiqueta) y los huecos que faltan.
    const trozos = this.partes.map((p, i) => ({ texto: this.elegidas[i] ?? '______', color: this.elegidas[i] ? oscurecer(COLORES_RANURA[i % COLORES_RANURA.length]) : '#9aa7b8' }));
    const yy = escribirColores(ctx, trozos, 36, y, { tam: listo ? 44 : 42, tamMin: 28, maxAncho: w - 72, maxAlto: this.datos.pregunta ? 170 : 260 });
    if (this.preguntaElegida) {
      escribir(ctx, `❓ ${this.preguntaElegida}`, 36, yy + 14, { tam: 38, tamMin: 26, peso: 800, color: COLORES.morado, maxAncho: w - 72, maxAlto: h - yy - 30 });
    }
  }

  _dibujarRetro(ctx, w, h) {
    if (!this.mensajeRetro) return;
    const { texto, color } = this.mensajeRetro;
    tarjeta(ctx, w, h, { radio: 30, fondo: '#ffffff', borde: color, grosor: 8 });
    escribir(ctx, texto, w / 2, h / 2, { tam: 34, tamMin: 24, peso: 700, color: color === COLORES.verde ? '#1b7f4f' : '#b35a00', alinear: 'center', base: 'middle', maxAncho: w - 60, maxAlto: h - 30, interlineado: 1.15 });
  }
}
