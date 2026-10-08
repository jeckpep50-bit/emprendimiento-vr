import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Matriz de decisión: las ideas finalistas (filas) se evalúan con los criterios del
 * reto (columnas). El estudiante marca cada casilla ✅ (cumple) o ❌ (no cumple) y
 * pulsa "Comprobar". Las filas con errores se marcan con ⚠️ y una pista; si vuelve a
 * fallar, se muestran las casillas exactas. Gana la idea que cumple todos los criterios.
 * datos: { titulo, instruccion, mensajeFinal?,
 *   criterios: [{ texto, emoji? }],
 *   ideas: [{ texto, emoji?, cumple: [bool por criterio], porque: [texto por criterio] }] }
 */
export class EscenaMatriz extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.criterios = d.criterios ?? [];
    this.ideas = d.ideas ?? [];
    this.intentos = 0;
    this.resuelta = false;

    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', y: H + 0.64 });
    this.cabecera.derecha(this.t('matrizProgreso', { n: 0, total: this.ideas.length * this.criterios.length }));

    const nc = this.criterios.length;
    const nf = this.ideas.length;
    const [anchoNombre, anchoCelda, altoCabeza, altoFila] = [0.44, nc > 4 ? 0.23 : 0.25, 0.17, 0.14];
    const ancho = anchoNombre + nc * anchoCelda;
    const alto = altoCabeza + nf * altoFila;
    this.grilla = new THREE.Group();
    this.grilla.position.set(0, H - 0.1, -1.5);
    this.grilla.lookAt(0, H - 0.1, 0);
    this.raiz.add(this.grilla);
    const fondo = new PanelLienzo(ancho + 0.06, alto + 0.06, (ctx, w, h) => tarjeta(ctx, w, h, { fondo: '#f6f2ea', radio: 26, borde: '#9aa7b8', grosor: 6 }));
    fondo.position.z = -0.01;
    this.grilla.add(fondo);
    const x0 = -ancho / 2;
    const y0 = alto / 2;

    // Encabezados de los criterios
    this.criterios.forEach((c, j) => {
      const p = new PanelLienzo(anchoCelda - 0.012, altoCabeza - 0.012, (ctx, w, h) => {
        ctx.fillStyle = '#23304a';
        ctx.beginPath();
        ctx.roundRect(4, 4, w - 8, h - 8, 18);
        ctx.fill();
        escribir(ctx, `${c.emoji ?? ''} ${c.texto}`.trim(), w / 2, h / 2, { tam: 30, tamMin: 20, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 20, maxAlto: h - 14, interlineado: 1.08 });
      });
      p.position.set(x0 + anchoNombre + (j + 0.5) * anchoCelda, y0 - altoCabeza / 2, 0.002);
      this.grilla.add(p);
    });

    // Filas: nombre de la idea + una casilla por criterio
    this.filas = this.ideas.map((idea, i) => {
      const yFila = y0 - altoCabeza - (i + 0.5) * altoFila;
      const fila = { idea, aviso: '', ganadora: false, apagada: false, celdas: [] };
      fila.nombre = new PanelLienzo(anchoNombre - 0.012, altoFila - 0.012, (ctx, w, h) => {
        ctx.fillStyle = fila.ganadora ? '#ffc23c' : '#ffffff';
        ctx.globalAlpha = fila.apagada ? 0.45 : 1;
        ctx.beginPath();
        ctx.roundRect(4, 4, w - 8, h - 8, 18);
        ctx.fill();
        escribir(ctx, `${fila.ganadora ? '🏆' : idea.emoji ?? '💡'} ${idea.texto}`, 18, h / 2, { tam: 32, tamMin: 22, peso: 800, maxAncho: w - (fila.aviso ? 92 : 30), maxAlto: h - 12, base: 'middle', interlineado: 1.08 });
        if (fila.aviso) escribir(ctx, fila.aviso, w - 18, h / 2, { tam: 36, peso: 800, color: '#d9480f', alinear: 'right', base: 'middle' });
        ctx.globalAlpha = 1;
      });
      fila.nombre.position.set(x0 + anchoNombre / 2, yFila, 0.002);
      this.grilla.add(fila.nombre);
      this.criterios.forEach((_c, j) => {
        const celda = { valor: null, bloqueada: false, marcadaMal: false, encima: false };
        celda.panel = new PanelLienzo(anchoCelda - 0.02, altoFila - 0.02, (ctx, w, h) => this._dibujarCelda(ctx, w, h, celda, fila));
        celda.panel.position.set(x0 + anchoNombre + (j + 0.5) * anchoCelda, yFila, 0.004);
        this.grilla.add(celda.panel);
        this.interactivo(celda.panel, {
          alPasar: (v) => {
            celda.encima = v;
            celda.panel.redibujar();
          },
          alSeleccionar: () => this._alternar(celda, fila, i, j),
        });
        fila.celdas.push(celda);
      });
      return fila;
    });
    this.presentar(this.grilla, 0.2);

    this.btnComprobar = this.boton(this.t('comprobar'), () => this._comprobar(), { ancho: 0.46, alto: 0.12, color: COLORES.morado });
    this.btnComprobar.position.set(0, H - 0.1 - alto / 2 - 0.12, -1.42);
    this.btnComprobar.lookAt(0, H, 0);
    this.raiz.add(this.btnComprobar);
    this.presentar(this.btnComprobar, 0.5);
    this.altoGrilla = alto;
  }

  _dibujarCelda(ctx, w, h, celda, fila) {
    const { valor, bloqueada, marcadaMal, encima } = celda;
    const fondo = marcadaMal ? '#ffe3e3' : bloqueada ? '#e3f8ec' : '#ffffff';
    ctx.globalAlpha = fila.apagada ? 0.45 : 1;
    ctx.fillStyle = fondo;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 16);
    ctx.fill();
    ctx.lineWidth = encima && !bloqueada ? 8 : 4;
    ctx.strokeStyle = marcadaMal ? COLORES.rojo : encima && !bloqueada ? COLORES.primario : '#c9d0e0';
    ctx.stroke();
    const icono = valor === true ? '✅' : valor === false ? '❌' : '·';
    escribir(ctx, icono, w / 2, h / 2 + 2, { tam: valor === null ? 60 : 64, color: COLORES.suave, alinear: 'center', base: 'middle' });
    ctx.globalAlpha = 1;
  }

  _alternar(celda, fila, i, j) {
    if (celda.bloqueada || this.resuelta) return;
    celda.valor = celda.valor === true ? false : true;
    this.m.audio.tono(celda.valor ? 880 : 440, 0.07, { volumen: 0.06, pos: this.posMundo(celda.panel) });
    this.m.fx.latido(celda.panel, 0.08);
    // Al corregir una casilla marcada en rojo, se explica por qué.
    if (celda.marcadaMal) {
      celda.marcadaMal = false;
      const porque = fila.idea.porque?.[j];
      if (celda.valor === fila.idea.cumple[j] && porque) this.cabecera.mensaje(`💡 ${porque}`, COLORES.primario);
    }
    celda.panel.redibujar();
  }

  _comprobar() {
    if (this.resuelta) return;
    const todas = this.filas.flatMap((f) => f.celdas);
    if (todas.some((c) => c.valor === null)) {
      this.m.audio.error(this.posMundo(this.btnComprobar));
      this.cabecera.mensaje(this.t('matrizCompleta'), COLORES.naranja);
      return;
    }
    this.intentos++;
    // En la primera revisión solo se dice cuántos errores hay en cada fila (hay que
    // razonar cuál es); desde la segunda, las correctas se fijan y las malas se ven en rojo.
    const revelar = this.intentos >= 2;
    let nuevasBien = 0;
    let errores = 0;
    let pista = null;
    for (const fila of this.filas) {
      let erroresFila = 0;
      fila.celdas.forEach((c, j) => {
        const bien = c.valor === fila.idea.cumple[j];
        if (bien && !c.puntuada) {
          c.puntuada = true;
          nuevasBien++;
        }
        if (bien && revelar) c.bloqueada = true;
        if (!bien) {
          erroresFila++;
          pista ??= fila.idea.porque?.[j] ? `${fila.idea.emoji ?? ''} ${fila.idea.porque[j]}` : null;
          c.marcadaMal = revelar;
        }
        c.panel.redibujar();
      });
      fila.aviso = erroresFila ? `⚠️${erroresFila}` : '';
      fila.nombre.redibujar();
      errores += erroresFila;
    }
    const total = this.filas.length * this.criterios.length;
    this.cabecera.derecha(this.t('matrizProgreso', { n: total - errores, total }));
    if (nuevasBien) this.ganar(this.posMundo(this.grilla), nuevasBien * (this.intentos === 1 ? 50 : 25));
    if (errores) {
      this.perder();
      this.m.audio.error(this.posMundo(this.btnComprobar));
      this.m.fx.sacudir(this.grilla, 0.015);
      const base = this.intentos >= 2 ? this.t('matrizErroresRojo', { n: errores }) : this.t('matrizErrores', { n: errores });
      this.cabecera.mensaje(`${base}${pista && this.intentos < 2 ? ` ${this.t('pista')}: ${pista}` : ''}`, COLORES.naranja);
      return;
    }
    this._ganadora();
  }

  _ganadora() {
    this.resuelta = true;
    this.btnComprobar.visible = false;
    this.m.entrada.habilitar(this.btnComprobar, false);
    const ganadora = this.filas.find((f) => f.idea.cumple.every(Boolean));
    for (const f of this.filas) {
      f.ganadora = f === ganadora;
      f.apagada = f !== ganadora;
      f.nombre.redibujar();
      for (const c of f.celdas) {
        this.m.entrada.habilitar(c.panel, false);
        c.panel.redibujar();
      }
    }
    this.m.audio.exito();
    if (ganadora) {
      this.m.fx.latido(ganadora.nombre, 0.2);
      this.m.fx.confeti(this.posMundo(ganadora.nombre).add(V(0, 0.1, 0.2)), 100);
      this.ganar(this.posMundo(ganadora.nombre), 300);
    }
    this.cabecera.mensaje(this.datos.mensajeFinal ?? this.t('matrizLista'), COLORES.verde);
    if (this.datos.mensajeFinal) this.voz(this.datos.mensajeFinal);
    this.mostrarContinuar(V(0, this.H - 0.1 - this.altoGrilla / 2 - 0.13, -1.42));
  }
}
