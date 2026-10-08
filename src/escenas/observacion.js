import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { crearRecreo } from './escenarios/recreo.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ESCENARIOS = { recreo: crearRecreo };

/**
 * Observación: una escena viva (p. ej. el recreo) que pasa alrededor del estudiante.
 * Hay marcas 👁️ repartidas por todo el lugar; al tocar una aparece lo que se ve y el
 * estudiante decide si es importante para el reto (se anota en la bitácora) o si
 * no tiene que ver (se descarta). Así se practica observar como un diseñador.
 * datos: { titulo, instruccion, escenario: 'recreo', radio?, mensajeFinal?,
 *   observaciones: [{ lugar (ancla del escenario), texto, corto?, relevante: bool, explicacion }],
 *   frases?: { clave: { quien, texto } } (lo que dicen los personajes del escenario) }
 */
export class EscenaObservacion extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.reloj = 0;
    this.activo = null;
    this.relevantes = (d.observaciones ?? []).filter((o) => o.relevante).length;
    this.bitacora = [];
    this.resueltas = 0;

    const { app, anclaje } = this.m;
    app.limites.radio = d.radio ?? 2.0;
    app.limites.centro.set(anclaje.position.x, 0, anclaje.position.z);

    this.mundo = (ESCENARIOS[d.escenario] ?? crearRecreo)(this);
    this.cadaCuadro((dt) => {
      this.reloj += dt;
      this.mundo.actualizar(dt, this.reloj);
    });

    // Encabezado que acompaña la mirada (el estudiante gira para ver todo el patio).
    this.hud = new THREE.Group();
    this.raiz.add(this.hud);
    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', ancho: 1.45, alto: 0.48 });
    this.cabecera.position.set(0, 0, 0);
    this.cabecera.rotation.set(0, 0, 0);
    this.hud.add(this.cabecera);
    this._progreso();
    this.seguirMirada(this.hud, { distancia: 1.85, altura: H + 0.62 });

    this.marcas = (d.observaciones ?? []).map((o, i) => this._crearMarca(o, i));
    this._crearFicha();
  }

  iniciar() {
    super.iniciar();
    // ¡Riiing! Suena el timbre del recreo.
    for (let i = 0; i < 14; i++) this.m.audio.tono(i % 2 ? 1500 : 1250, 0.09, { tipo: 'square', volumen: 0.025, retardo: i * 0.1, pos: this.raiz.localToWorld(V(0, 3.5, -8)) });
  }

  _progreso() {
    const anotadas = this.bitacora.length;
    this.cabecera.derecha(this.t('observacionesProgreso', { n: anotadas, total: this.relevantes }));
  }

  // ── Marcas 👁️ ─────────────────────────────────────────────────────────────

  _crearMarca(o, i) {
    const ancla = this.mundo.anclas[o.lugar] ?? { pos: V(Math.sin(i) * 2, 1.5, -Math.cos(i) * 2) };
    // El estado vive en un objeto propio: el panel se dibuja ya al crearse.
    const u = { o, ancla, estado: 'pendiente', encima: false, fase: i * 1.7 };
    const marca = new PanelLienzo(0.17, 0.17, (ctx, w, h) => this._dibujarMarca(ctx, w, h, u));
    marca.userData = u;
    this.raiz.add(marca);
    // Las marcas lejanas se ven más grandes para que se puedan apuntar.
    const pos = this._posAncla(ancla);
    marca.userData.escala = Math.max(1, Math.hypot(pos.x, pos.z, pos.y - this.H) / 2.3);
    marca.scale.setScalar(marca.userData.escala);
    marca.position.copy(pos);
    const cabeza = new THREE.Vector3();
    this.cadaCuadro((_dt, t) => {
      const p = this._posAncla(ancla);
      marca.position.set(p.x, p.y + Math.sin(t * 2.4 + marca.userData.fase) * 0.025, p.z);
      // Siempre de frente a la cabeza (también las que están arriba, como el sol).
      marca.lookAt(this.m.app.camara.getWorldPosition(cabeza));
      if (marca.userData.estado === 'pendiente' && !this.activo) {
        const latido = 1 + Math.max(0, Math.sin(t * 3 + marca.userData.fase)) * 0.12 + (marca.userData.encima ? 0.15 : 0);
        marca.scale.setScalar(marca.userData.escala * latido);
      }
    });
    this.interactivo(marca, {
      alPasar: (v) => {
        marca.userData.encima = v;
        marca.redibujar();
      },
      alSeleccionar: () => this._abrir(marca),
    });
    return marca;
  }

  _posAncla(ancla) {
    if (ancla.obj) return ancla.obj.position.clone().add(V(0, ancla.alto ?? 1.6, 0));
    return ancla.pos.clone();
  }

  _dibujarMarca(ctx, w, h, u) {
    const { estado, encima } = u;
    const color = estado === 'anotada' ? COLORES.verde : estado === 'descartada' ? '#8a94a3' : COLORES.morado;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = encima ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
    ctx.stroke();
    const icono = estado === 'anotada' ? '📝' : estado === 'descartada' ? '🙈' : '👁️';
    escribir(ctx, icono, w / 2, h / 2 + 4, { tam: 84, alinear: 'center', base: 'middle' });
  }

  // ── Ficha de observación ────────────────────────────────────────────────

  _crearFicha() {
    this.ficha = new THREE.Group();
    this.ficha.visible = false;
    this.raiz.add(this.ficha);
    this.panelFicha = new PanelLienzo(0.7, 0.36, (ctx, w, h) => this._dibujarFicha(ctx, w, h));
    this.panelFicha.position.y = 0.2;
    this.ficha.add(this.panelFicha);
    this.btnAnotar = this.boton(this.t('obsAnotar'), () => this._decidir(true, this.btnAnotar), { ancho: 0.34, alto: 0.1, color: COLORES.verde, tam: 30 });
    this.btnDescartar = this.boton(this.t('obsDescartar'), () => this._decidir(false, this.btnDescartar), { ancho: 0.34, alto: 0.1, color: '#6b7a99', tam: 30 });
    this.btnAnotar.position.set(-0.175, -0.04, 0.01);
    this.btnDescartar.position.set(0.175, -0.04, 0.01);
    this.btnEntendido = this.boton(this.t('entendido'), () => this._cerrar(), { ancho: 0.36, alto: 0.1, color: COLORES.primario });
    this.btnEntendido.position.set(0, -0.04, 0.01);
    this.ficha.add(this.btnAnotar, this.btnDescartar, this.btnEntendido);
  }

  _abrir(marca) {
    if (this.activo || marca.userData.estado !== 'pendiente') return;
    this.activo = marca;
    Object.assign(marca.userData, { mensaje: '', colorMensaje: COLORES.texto, fallos: 0, encima: false });
    for (const m of this.marcas) this.m.entrada.habilitar(m, false);
    marca.scale.setScalar(marca.userData.escala * 1.35);
    this.anteMirada(this.ficha, { distancia: 0.9, dy: -0.2 });
    for (const b of [this.btnAnotar, this.btnDescartar]) {
      b.visible = true;
      b.setModo('normal');
      b.setEncima(false);
      this.m.entrada.habilitar(b, true);
    }
    this.btnEntendido.visible = false;
    this.ficha.visible = true;
    this.panelFicha.redibujar();
    this.m.fx.aparecer(this.ficha, 0.35);
    this.m.audio.pop(this.posMundo(marca));
  }

  _decidir(esRelevante, boton) {
    const marca = this.activo;
    if (!marca) return;
    const u = marca.userData;
    const pos = this.posMundo(boton);
    if (esRelevante !== u.o.relevante) {
      u.fallos++;
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.sacudir(this.panelFicha, 0.02);
      u.mensaje = `🤔 ${u.o.pista ?? (u.o.relevante ? this.t('obsEraImportante') : this.t('obsNoEraImportante'))}`;
      u.colorMensaje = '#b35a00';
      this.panelFicha.redibujar();
      return;
    }
    u.estado = esRelevante ? 'anotada' : 'descartada';
    this.resueltas++;
    for (const b of [this.btnAnotar, this.btnDescartar]) {
      b.visible = false;
      this.m.entrada.habilitar(b, false);
    }
    this.btnEntendido.visible = true;
    this.m.entrada.habilitar(this.btnEntendido, true);
    this.m.fx.aparecer(this.btnEntendido, 0.3, 0.15);
    this.m.audio.acierto(pos);
    this.ganar(this.posMundo(marca), u.fallos ? 75 : 150);
    u.mensaje = `${esRelevante ? this.t('obsBienAnotada') : this.t('obsBienDescartada')} ${u.o.explicacion ?? ''}`;
    u.colorMensaje = '#1b7f4f';
    if (esRelevante) {
      this.bitacora.push(u.o.corto ?? u.o.texto);
      this._progreso();
      this.m.fx.confeti(this.posMundo(marca), 24);
    }
    marca.redibujar();
    this.panelFicha.redibujar();
  }

  _cerrar() {
    const marca = this.activo;
    if (!marca) return;
    this.activo = null;
    this.ficha.visible = false;
    marca.scale.setScalar(marca.userData.escala);
    for (const m of this.marcas) this.m.entrada.habilitar(m, m.userData.estado === 'pendiente');
    if (this.resueltas === this.marcas.length) this._completar();
  }

  _dibujarFicha(ctx, w, h) {
    const marca = this.activo;
    if (!marca) return;
    const u = marca.userData;
    const resuelta = u.estado !== 'pendiente';
    tarjeta(ctx, w, h, { radio: 40, borde: resuelta ? COLORES.verde : COLORES.morado, grosor: 10 });
    pastilla(ctx, this.t('obsTitulo'), 32, 24, { tam: 32, fondo: COLORES.morado, color: '#ffffff' });
    let y = escribir(ctx, u.o.texto, 36, 92, { tam: 40, peso: 700, maxAncho: w - 72, maxAlto: resuelta ? 110 : 150, interlineado: 1.18 });
    if (!resuelta && !u.mensaje) escribir(ctx, this.t('obsPregunta'), 36, y + 12, { tam: 32, peso: 700, color: COLORES.suave, maxAncho: w - 72 });
    if (u.mensaje) escribir(ctx, u.mensaje, 36, y + 12, { tam: 31, peso: 700, color: u.colorMensaje, maxAncho: w - 72, maxAlto: h - y - 34, interlineado: 1.16 });
  }

  // ── Final: la bitácora completa ─────────────────────────────────────────

  _completar() {
    this.m.audio.exito();
    this.cabecera.mensaje(this.datos.mensajeFinal ?? this.t('obsCompleta'), COLORES.verde);
    if (this.datos.mensajeFinal) this.voz(this.datos.mensajeFinal);
    const panel = new PanelLienzo(0.95, 0.72, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 40, borde: COLORES.verde, grosor: 10 });
      escribir(ctx, this.t('bitacoraTitulo'), 40, 34, { tam: 46, peso: 800 });
      let y = 110;
      for (const nota of this.bitacora) y = escribir(ctx, `✔ ${nota}`, 44, y + 6, { tam: 32, peso: 600, color: '#1b5e3f', maxAncho: w - 88, interlineado: 1.15 });
    });
    const grupo = new THREE.Group();
    panel.position.y = 0.12;
    grupo.add(panel);
    const continuar = this.boton(this.t('continuar'), () => this.terminar(), { ancho: 0.5, alto: 0.13, color: COLORES.verde });
    continuar.position.set(0, -0.32, 0.01);
    grupo.add(continuar);
    this.anteMirada(grupo, { distancia: 1.2, dy: -0.05 });
    this.raiz.add(grupo);
    this.m.fx.aparecer(grupo, 0.5, 0.2);
    this.m.fx.confeti(this.posMundo(panel).add(V(0, 0.3, 0)), 90);
  }
}
