import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Sentidos: el estudiante es reportero en un lugar impresionante (el mirador del
 * Cotopaxi en erupción) y lo describe con los cinco sentidos. Al tocar cada sentido
 * se "activa" (rayos, rugidos, olor a azufre, ceniza en la piel…) y elige la
 * descripción más VIVA entre una pobre, una viva (con detalles y comparación) y una
 * falsa. La audiencia del noticiero sube con cada buena descripción.
 * datos: { titulo, instruccion, mensajeFinal,
 *   sentidos: [{ id: 'vista'|'oido'|'olfato'|'tacto'|'gusto', emoji, nombre, pregunta,
 *                opciones: [{ texto, tipo: 'viva'|'pobre'|'falsa', retro? }] }] }
 */
export class EscenaSentidos extends EscenaBase {
  construir() {
    const { H } = this;
    this.sentidos = this.datos.sentidos ?? [];
    this.actual = 0;
    this.reporte = [];
    this.audiencia = 1200;
    this.fase = 'intro';

    // El encabezado va a la derecha: al frente, arriba, está el volcán.
    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion ?? '', ancho: 1.05, alto: 0.56 });
    this.cabecera.position.set(1.12, H + 0.12, -1.05);
    this.cabecera.lookAt(0, H, 0.3);
    this._actualizarAudiencia();

    // Íconos de los cinco sentidos en un arco
    const n = this.sentidos.length;
    this.iconos = this.sentidos.map((s, i) => {
      const estado = { activo: false, hecho: false, encima: false };
      const ic = new PanelLienzo(0.2, 0.26, (ctx, w, h) => {
        const color = estado.hecho ? COLORES.verde : estado.activo ? COLORES.amarillo : '#5b6886';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(w / 2, w / 2, w / 2 - 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.strokeStyle = estado.encima && estado.activo ? '#ffffff' : 'rgba(255,255,255,0.4)';
        ctx.stroke();
        escribir(ctx, estado.hecho ? '✔' : s.emoji, w / 2, w / 2 + 4, { tam: 96, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
        escribir(ctx, s.nombre, w / 2, w + 30, { tam: 34, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle' });
      });
      const angulo = THREE.MathUtils.degToRad((i - (n - 1) / 2) * 15);
      ic.position.set(Math.sin(angulo) * 1.15, H - 0.12, -Math.cos(angulo) * 1.15);
      ic.lookAt(0, H, 0);
      ic.userData.estado = estado;
      this.raiz.add(ic);
      this.presentar(ic, 0.3 + i * 0.08);
      this.interactivo(ic, {
        alPasar: (v) => {
          estado.encima = v;
          ic.redibujar();
        },
        alSeleccionar: () => this._activar(i),
      });
      this.m.entrada.habilitar(ic, false);
      this.cadaCuadro((_dt, t) => {
        ic.scale.setScalar(estado.activo && !estado.hecho ? 1 + Math.max(0, Math.sin(t * 4)) * 0.12 : 1);
      });
      return ic;
    });

    // Opciones (aparecen al activar un sentido)
    this.zonaOpciones = new THREE.Group();
    this.raiz.add(this.zonaOpciones);

    // Reporte que se va armando (a la izquierda)
    this.panelReporte = new PanelLienzo(0.62, 0.84, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 30, borde: '#d62839', grosor: 8 });
      escribir(ctx, this.t('tuReporte'), 26, 22, { tam: 40, peso: 800 });
      let y = 86;
      if (!this.reporte.length) escribir(ctx, this.t('reporteVacio'), 26, y, { tam: 26, color: COLORES.suave, maxAncho: w - 52 });
      for (const r of this.reporte) y = escribir(ctx, `${r.emoji} ${r.texto}`, 26, y, { tam: 30, tamMin: 20, peso: 600, maxAncho: w - 52, maxAlto: 150, interlineado: 1.12 }) + 12;
    });
    this.panelReporte.position.set(-1.12, H - 0.05, -0.95);
    this.panelReporte.lookAt(0, H, 0.3);
    this.raiz.add(this.panelReporte);
    this.presentar(this.panelReporte, 0.5);
  }

  get volcan() {
    return this.m.entorno?.api;
  }

  async vozInicial() {
    await super.vozInicial();
    if (this._destruida) return;
    this.fase = 'sentidos';
    this._siguiente();
  }

  _actualizarAudiencia() {
    this.cabecera.derecha(this.t('televidentes', { n: this.audiencia.toLocaleString('es-EC') }));
  }

  _siguiente() {
    const s = this.sentidos[this.actual];
    if (!s) return this._completar();
    const ic = this.iconos[this.actual];
    ic.userData.estado.activo = true;
    ic.redibujar();
    this.m.entrada.habilitar(ic, true);
    this.cabecera.mensaje(`${s.emoji} ${s.pregunta}`, COLORES.primario);
    this.voz(s.pregunta);
  }

  /** El sentido se activa: el mundo reacciona y aparecen las descripciones. */
  _activar(i) {
    if (i !== this.actual || this.fase !== 'sentidos' || this.abierto) return;
    this.abierto = true;
    const s = this.sentidos[i];
    this.m.entrada.habilitar(this.iconos[i], false);
    this._efecto(s.id);
    this._mostrarOpciones(s);
  }

  _efecto(id) {
    const v = this.volcan;
    const vibrar = (fuerza, ms) => this.m.entrada.punteros.forEach((p) => p.vibrar(fuerza, ms));
    if (id === 'vista') {
      v?.relampago();
      v?.retumbar(0.5);
    } else if (id === 'oido') {
      this.m.audio.volumenAmbiente(0.2);
      v?.retumbar(1.3);
      vibrar(0.5, 400);
      this.esperar(1.2).then(() => !this._destruida && v?.retumbar(0.9));
      this.esperar(4.5).then(() => !this._destruida && this.m.audio.volumenAmbiente(1));
    } else if (id === 'olfato') {
      v?.azufre(1);
      this.m.audio.rafaga({ duracion: 2.5, frecuencia: 400, volumen: 0.05 });
      this.esperar(7).then(() => !this._destruida && v?.azufre(0.25));
    } else if (id === 'tacto') {
      v?.ceniza(1);
      for (let k = 0; k < 5; k++) this.esperar(0.4 + k * 0.6).then(() => !this._destruida && vibrar(0.25, 120));
      this.esperar(8).then(() => !this._destruida && v?.ceniza(0.5));
    } else if (id === 'gusto') {
      v?.ceniza(1);
      const cab = this.m.app.camara.getWorldPosition(V(0, 0, 0));
      this.m.fx.pixeles(cab.add(this.m.app.camara.getWorldDirection(V(0, 0, 0)).multiplyScalar(0.5)), '#7a7470', 50, 0.4);
      this.m.audio.rafaga({ duracion: 0.25, filtro: 'bandpass', frecuencia: 700, volumen: 0.12 });
      this.m.audio.rafaga({ duracion: 0.25, filtro: 'bandpass', frecuencia: 650, volumen: 0.1, retardo: 0.35 });
    }
  }

  _mostrarOpciones(s) {
    const { H } = this;
    for (const b of [...this.zonaOpciones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    const lista = barajar(s.opciones);
    lista.forEach((op, k) => {
      const b = this.boton(op.texto, () => this._elegir(s, op, b), { ancho: 0.62, alto: 0.2, color: '#ffffff', colorTexto: COLORES.texto, tam: 30 });
      const angulo = THREE.MathUtils.degToRad((k - (lista.length - 1) / 2) * 33);
      b.position.set(Math.sin(angulo) * 1.12 + 0.1, H - 0.43, -Math.cos(angulo) * 1.12);
      b.lookAt(0, H, 0);
      this.zonaOpciones.add(b);
      this.m.fx.aparecer(b, 0.35, 0.2 + k * 0.08);
    });
  }

  _elegir(s, op, boton) {
    const pos = this.posMundo(boton);
    if (op.tipo !== 'viva') {
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.audiencia = Math.max(0, this.audiencia - 150);
      this._actualizarAudiencia();
      this.cabecera.mensaje(`🤔 ${op.retro ?? this.t(op.tipo === 'pobre' ? 'descripcionPobre' : 'descripcionFalsa')}`, COLORES.naranja);
      return;
    }
    for (const b of this.zonaOpciones.children) this.m.entrada.habilitar(b, false);
    boton.setModo('correcto');
    this.m.audio.acierto(pos);
    this.ganar(pos, 200);
    this.audiencia += 3500 + Math.round(Math.random() * 1500);
    this._actualizarAudiencia();
    this.cabecera.mensaje(`✅ ${op.retro ?? this.t('descripcionViva')}`, COLORES.verde);
    this.reporte.push({ emoji: s.emoji, texto: op.texto });
    this.panelReporte.redibujar();
    this.m.fx.latido(this.panelReporte, 0.05);
    const ic = this.iconos[this.actual];
    ic.userData.estado.hecho = true;
    ic.redibujar();
    this.m.fx.confeti(this.posMundo(ic), 20);
    this.actual++;
    this.esperar(2.2).then(() => {
      if (this._destruida) return;
      for (const b of [...this.zonaOpciones.children]) {
        this.m.entrada.desregistrar(b);
        b.removeFromParent();
      }
      this.abierto = false;
      this._siguiente();
    });
  }

  async _completar() {
    this.fase = 'fin';
    this.m.audio.exito();
    this.volcan?.retumbar(0.7);
    this.m.fx.confeti(this.posMundo(this.panelReporte).add(V(0, 0.3, 0)), 80);
    this.cabecera.mensaje(this.datos.mensajeFinal, COLORES.verde);
    this.mostrarContinuar(V(0.1, this.H - 0.4, -1.1));
    await this.voz(this.datos.mensajeFinal);
  }
}
