import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { PanelLienzo, COLORES, escribir, fuente } from '../ui/lienzo.js';

const COLORES_NOTA = ['#ffe066', '#ff9ccf', '#9fdcff', '#b6f09c', '#ffc48a'];

/**
 * Lluvia de ideas en dos fases:
 *  1. Generar: cada toque a la bombilla lanza una idea en una nota adhesiva
 *     ("¡todas las ideas valen!").
 *  2. Elegir: con los criterios a la vista, el estudiante escoge la idea que
 *     mejor resuelve el problema. Las demás explican por qué no.
 * datos: { titulo, instruccion?, instruccionElegir, mensajeFinal?,
 *          ideas: [{ texto, emoji?, correcta: bool, retro, chispa? }],
 *          chispas?: [{ texto, emoji? }], elegir?: bool }
 * Con "chispas" hay varias bombillas, cada una con una técnica para generar ideas
 * ("¿Y si…?"); cada idea dice de qué chispa sale. Con elegir: false, la escena
 * termina al generar todas las ideas (la elección se hace en otra actividad).
 */
export class EscenaLluvia extends EscenaBase {
  construir() {
    const { H } = this;
    this.ideas = this.datos.ideas ?? [];
    this.generadas = 0;
    this.fase = 'generar';
    this.notas = [];

    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion || this.t('lluviaGenerar') });
    this.cabecera.derecha(this.t('ideasProgreso', { n: 0, total: this.ideas.length }));
    if (this.datos.chispas?.length) return this._construirChispas();

    // Bombilla gigante en el centro
    this.foco = new THREE.Group();
    this.foco.position.set(0, H - 0.08, -1.35);
    const bombilla = this.modelo('bombilla', { tamano: 0.55 });
    this.brillo = this.halo(1.1, COLORES.amarillo);
    this.brillo.position.z = -0.15;
    this.foco.add(this.brillo, bombilla);
    this.letrero = this.etiqueta(this.t('tocaBombilla'), { ancho: 0.42, alto: 0.08, tam: 34, fondo: COLORES.amarillo });
    this.letrero.position.set(0, -0.36, 0.05);
    this.foco.add(this.letrero);
    this.foco.lookAt(0, this.foco.position.y, 0);
    this.raiz.add(this.foco);
    this.presentar(this.foco, 0.3, true);
    this.cadaCuadro((_dt, t) => {
      if (this.fase === 'generar') this.brillo.userData.encendido = Math.sin(t * 3) > 0.3 || this._encima;
    });
    this.interactivo(this.foco, {
      proxy: true,
      alPasar: (v) => {
        this._encima = v;
        bombilla.scale.setScalar(v ? 1.08 : 1);
      },
      alSeleccionar: () => this._generar(),
    });

    // Lugares del muro de ideas: a ambos lados de la bombilla, en dos filas
    this.lugares = [];
    const angulos = [32, 52, 72];
    for (const a of angulos)
      for (const fila of [0, 1])
        for (const lado of [-1, 1]) this.lugares.push({ angulo: THREE.MathUtils.degToRad(a * lado), y: H + 0.12 - fila * 0.34 });
  }

  /** Varias bombillas ("chispas"), cada una con una técnica para inventar ideas. */
  _construirChispas() {
    const { H } = this;
    const chispas = this.datos.chispas;
    const n = chispas.length;
    this.chispas = chispas.map((c, k) => {
      const foco = new THREE.Group();
      const angulo = THREE.MathUtils.degToRad((k - (n - 1) / 2) * 23);
      foco.position.set(Math.sin(angulo) * 1.3, H - 0.1, -Math.cos(angulo) * 1.3);
      const bombilla = this.modelo('bombilla', { tamano: 0.34 });
      const brillo = this.halo(0.72, COLORES_NOTA[k % COLORES_NOTA.length]);
      brillo.position.z = -0.1;
      foco.add(brillo, bombilla);
      const letrero = this.etiqueta(`${c.emoji ?? '💡'} ${c.texto}`, { ancho: 0.46, alto: 0.12, tam: 32, fondo: COLORES.amarillo });
      letrero.position.set(0, -0.27, 0.05);
      foco.add(letrero);
      foco.lookAt(0, foco.position.y, 0);
      this.raiz.add(foco);
      this.presentar(foco, 0.3 + k * 0.15, true);
      const pendientes = this.ideas.filter((idea) => (idea.chispa ?? 0) === k);
      const chispa = { foco, bombilla, brillo, letrero, pendientes, encima: false };
      this.interactivo(foco, {
        proxy: true,
        alPasar: (v) => {
          chispa.encima = v;
          bombilla.scale.setScalar(v ? 1.1 : 1);
        },
        alSeleccionar: () => this._generar(chispa),
      });
      return chispa;
    });
    this.cadaCuadro((_dt, t) => {
      this.chispas.forEach((c, k) => {
        c.brillo.userData.encendido = c.pendientes.length > 0 && (Math.sin(t * 3 + k * 2) > 0.3 || c.encima);
      });
    });
    // Muro de ideas a ambos lados de las chispas, en dos filas.
    this.lugares = [];
    for (const a of [40, 57, 74])
      for (const fila of [0, 1])
        for (const lado of [-1, 1]) this.lugares.push({ angulo: THREE.MathUtils.degToRad(a * lado), y: H + 0.12 - fila * 0.34 });
  }

  _generar(chispa = null) {
    if (this.fase !== 'generar' || this.generadas >= this.ideas.length) return;
    if (chispa && !chispa.pendientes.length) {
      this.m.audio.error(this.posMundo(chispa.foco));
      this.cabecera.mensaje(this.t('chispaAgotada'), COLORES.naranja);
      return;
    }
    const origen = chispa?.foco ?? this.foco;
    const i = this.generadas++;
    const idea = chispa ? chispa.pendientes.shift() : this.ideas[i];
    if (chispa && !chispa.pendientes.length) {
      chispa.letrero.actualizar({ fondo: '#d5dcec' });
      this.m.fx.escalarA(chispa.bombilla, 0.8, 0.4);
    }
    if (chispa) this.ganar(origen, 40);
    const lugar = this.lugares[i % this.lugares.length];
    const nota = this._crearNota(idea, COLORES_NOTA[i % COLORES_NOTA.length]);
    const inicio = origen.position.clone().add(new THREE.Vector3(0, 0.15, 0.1));
    const destino = new THREE.Vector3(Math.sin(lugar.angulo) * 1.55, lugar.y, -Math.cos(lugar.angulo) * 1.55);
    nota.position.copy(inicio);
    nota.lookAt(0, inicio.y, 0);
    nota.scale.setScalar(0.2);
    this.raiz.add(nota);
    this.notas.push(nota);

    // Vuela en arco desde la bombilla hasta el muro, girando.
    const q0 = nota.quaternion.clone();
    const tmp = new THREE.Object3D();
    tmp.position.copy(destino);
    tmp.lookAt(0, destino.y, 0);
    tmp.rotateZ((Math.random() - 0.5) * 0.12);
    this.m.fx.tween({
      duracion: 0.75,
      curva: suavizado.salida,
      alActualizar: (k) => {
        nota.position.lerpVectors(inicio, destino, k);
        nota.position.y += Math.sin(k * Math.PI) * 0.3;
        nota.scale.setScalar(0.2 + 0.8 * k);
        nota.quaternion.slerpQuaternions(q0, tmp.quaternion, k);
        nota.rotateY((1 - k) * Math.PI * 2);
      },
    });
    nota.userData.reposo = tmp.quaternion.clone();

    this.m.fx.latido(origen, 0.12);
    this.m.fx.confeti(this.posMundo(origen).add(new THREE.Vector3(0, 0.2, 0)), 12);
    this.m.audio.pop(this.posMundo(origen));
    this.m.audio.burbuja(destino.clone().applyMatrix4(this.raiz.matrixWorld));
    this.cabecera.derecha(this.t('ideasProgreso', { n: this.generadas, total: this.ideas.length }));
    this.cabecera.mensaje(`${idea.emoji ?? '💡'} ${idea.texto}`, COLORES.primario);

    if (this.generadas === this.ideas.length) {
      this.m.fx.tween({ duracion: 1.4 }).then(() => {
        if (this._destruida) return;
        if (this.datos.elegir === false) this._terminarSinElegir();
        else this._pasarAElegir();
      });
    }
  }

  /** Todas las ideas están en el muro: se celebra y se continúa (la elección viene después). */
  _terminarSinElegir() {
    this.fase = 'lista';
    for (const c of this.chispas ?? []) {
      c.brillo.userData.encendido = false;
      this.m.entrada.habilitar(c.foco, false);
    }
    if (this.foco) this.m.entrada.habilitar(this.foco, false);
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.cabecera).add(new THREE.Vector3(0, -0.4, 0.4)), 90);
    this.cabecera.mensaje(this.datos.mensajeFinal ?? this.t('ideasListas'), COLORES.verde);
    if (this.datos.mensajeFinal) this.voz(this.datos.mensajeFinal);
    this.mostrarContinuar(new THREE.Vector3(0, this.H - 0.5, -1.2));
  }

  _pasarAElegir() {
    this.fase = 'elegir';
    const focos = this.chispas ? this.chispas.map((c) => c.foco) : [this.foco];
    for (const c of this.chispas ?? []) c.brillo.userData.encendido = false;
    if (this.brillo) this.brillo.userData.encendido = false;
    if (this.letrero) this.letrero.visible = false;
    for (const foco of focos) {
      this.m.entrada.habilitar(foco, false);
      this.m.fx.escalarA(foco, 0.6, 0.6);
      this.m.fx.moverA(foco, foco.position.clone().add(new THREE.Vector3(0, -0.25, 0)), 0.6);
    }
    this.m.audio.exito();
    this.cabecera.instruccion(this.datos.instruccionElegir || this.t('lluviaElegir'));
    if (this.datos.instruccionElegir) this.voz(this.datos.instruccionElegir);
    this.cabecera.mensaje(this.t('ahoraElige'), COLORES.morado);
    for (const nota of this.notas) {
      this.interactivo(nota, {
        alPasar: (v) => !nota.userData.estado.descartada && nota.scale.setScalar(v ? 1.08 : 1),
        alSeleccionar: () => this._elegir(nota),
      });
    }
  }

  _elegir(nota) {
    const { idea } = nota.userData;
    if (!idea.correcta) {
      nota.userData.estado.descartada = true;
      nota.scale.setScalar(1);
      nota.redibujar();
      this.m.entrada.habilitar(nota, false);
      this.m.fx.sacudir(nota);
      this.m.audio.error(this.posMundo(nota));
      this.perder();
      this.cabecera.mensaje(`🤔 ${idea.retro || this.t('ideaNoCumple')}`, COLORES.naranja);
      return;
    }
    this.fase = 'elegida';
    this.ganar(nota, 300);
    nota.userData.estado.elegida = true;
    nota.redibujar();
    for (const n of this.notas) {
      this.m.entrada.habilitar(n, false);
      if (n !== nota) this.m.fx.escalarA(n, 0.75, 0.5);
    }
    // La idea ganadora viene al frente y crece.
    const destino = new THREE.Vector3(0, this.H - 0.12, -1.0);
    const q0 = nota.quaternion.clone();
    const tmp = new THREE.Object3D();
    tmp.position.copy(destino);
    tmp.lookAt(0, this.H, 0);
    this.m.fx.moverA(nota, destino, 0.8, suavizado.entradaSalida);
    this.m.fx.escalarA(nota, 1.25, 0.8);
    this.m.fx.tween({ duracion: 0.8, alActualizar: (k) => nota.quaternion.slerpQuaternions(q0, tmp.quaternion, k) });
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(nota).add(new THREE.Vector3(0, 0.2, 0.1)), 100);
    this.cabecera.mensaje(`✅ ${idea.retro || this.t('buenaEleccion')}`, COLORES.verde);

    this.m.fx.tween({ duracion: 1.6 }).then(() => !this._destruida && this.mostrarContinuar(new THREE.Vector3(0, this.H - 0.52, -0.95)));
  }

  _crearNota(idea, color) {
    const estado = { descartada: false, elegida: false };
    const nota = new PanelLienzo(
      0.36,
      0.3,
      (ctx, w, h) => {
        const { descartada, elegida } = estado;
        ctx.fillStyle = 'rgba(10, 20, 45, 0.25)';
        ctx.fillRect(14, 22, w - 20, h - 26);
        ctx.fillStyle = descartada ? '#d5d9e2' : color;
        ctx.fillRect(6, 10, w - 20, h - 26);
        // Cinta adhesiva arriba
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(w / 2 - 50, 0, 100, 30);
        if (elegida) {
          ctx.lineWidth = 14;
          ctx.strokeStyle = COLORES.naranja;
          ctx.strokeRect(6, 10, w - 20, h - 26);
          // Franja superior: "1 SOLUCIÓN"
          ctx.fillStyle = COLORES.naranja;
          ctx.fillRect(6, 10, w - 20, 70);
          escribir(ctx, this.t('unaSolucion'), w / 2 - 7, 46, { tam: 44, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 60 });
        }
        ctx.font = fuente(84, 400);
        ctx.fillStyle = COLORES.texto;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.globalAlpha = descartada ? 0.45 : 1;
        ctx.fillText(idea.emoji ?? '💡', w / 2 - 7, elegida ? 90 : 38);
        escribir(ctx, idea.texto, w / 2 - 7, 140 + (h - 160) / 2, { tam: 48, tamMin: 30, peso: 700, maxAncho: w - 60, maxAlto: h - 170, alinear: 'center', base: 'middle', interlineado: 1.12 });
        ctx.globalAlpha = 1;
        if (descartada) {
          ctx.strokeStyle = COLORES.rojo;
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(w - 80, 30);
          ctx.lineTo(w - 36, 74);
          ctx.moveTo(w - 36, 30);
          ctx.lineTo(w - 80, 74);
          ctx.stroke();
        }
      },
      { pxPorMetro: 1400 },
    );
    nota.userData.idea = idea;
    nota.userData.estado = estado;
    return nota;
  }
}
