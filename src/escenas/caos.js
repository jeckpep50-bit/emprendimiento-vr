import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { suavizado } from '../core/efectos.js';
import { mat, malla, fusionar, liberar } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Lugares alrededor del estudiante donde aparecen los problemas (grados; 0 = al frente).
const ANGULOS = [0, -42, 42, -85, 85, -130, 130, 180];
const RADIO = 1.5;

/**
 * "¡Cocina en caos!": aparecen problemas alrededor del estudiante (360°). Debe
 * tocar cada uno y elegir la clave que lo soluciona antes de que se acabe su
 * tiempo. Si se acaba, alguien se enferma (pierde una vida).
 * datos: { titulo, instruccion?, duracion?, vidas?, meta?, categorias: [{ id, nombre, emoji?, color? }],
 *          incidentes: [{ modelo, opciones?, tamano?, nombre, categoria, explicacion, resuelto?: { modelo, opciones? } }] }
 */
export class EscenaCaos extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.categorias = d.categorias ?? [];
    this.incidentes = d.incidentes ?? [];
    this.duracion = d.duracion ?? 75;
    this.vidasMax = d.vidas ?? 4;
    this.meta = d.meta ?? 12;
    this.estado = 'espera';
    this.activos = [];
    this.lugares = ANGULOS.map((g) => {
      const a = THREE.MathUtils.degToRad(g);
      return V(Math.sin(a) * RADIO, H - 0.12, -Math.cos(a) * RADIO);
    });
    this._reiniciar();

    // Plataformas holográficas donde aparecen los problemas
    const plataformas = new THREE.Group();
    for (const p of this.lugares) {
      plataformas.add(malla(new THREE.CircleGeometry(0.2, 32), mat('#5ff7ff', { tipo: 'basica', opacidad: 0.18 }), [p.x, p.y - 0.3, p.z], [-Math.PI / 2, 0, 0]));
      plataformas.add(malla(new THREE.RingGeometry(0.19, 0.215, 40), mat('#5ff7ff', { tipo: 'basica', opacidad: 0.7 }), [p.x, p.y - 0.298, p.z], [-Math.PI / 2, 0, 0]));
    }
    this.raiz.add(fusionar(plataformas));

    // Encabezado que acompaña la mirada (los problemas aparecen por todos lados)
    this.hud = new THREE.Group();
    this.raiz.add(this.hud);
    this.cabecera = this.encabezado({ instruccion: d.instruccion || this.t('caosInstruccion'), ancho: 1.5, alto: 0.46 });
    this.cabecera.position.set(0, 0, 0);
    this.cabecera.rotation.set(0, 0, 0);
    this.hud.add(this.cabecera);
    this.seguirMirada(this.hud, { distancia: 2.0, altura: H + 0.62 });
    this._actualizarMarcador();

    this._crearMenu();

    this.btnEmpezar = this.boton(this.t('empezarJuego'), () => this._empezar(), { ancho: 0.5, alto: 0.15, color: COLORES.verde });
    this.btnEmpezar.position.set(0, H + 0.08, -1.15);
    this.btnEmpezar.lookAt(0, H, 0);
    this.raiz.add(this.btnEmpezar);
    this.presentar(this.btnEmpezar, 0.4);

    let reloj = 0;
    this.cadaCuadro((dt, t) => {
      if (this.estado !== 'jugando') return;
      this._actualizar(dt, t);
      reloj += dt;
      if (reloj > 0.2) {
        reloj = 0;
        this._actualizarMarcador();
        for (const n of this.activos) n.userData.globo.redibujar();
      }
    });
  }

  _reiniciar() {
    this.restante = this.duracion;
    this.vidas = this.vidasMax;
    this.resueltos = 0;
    this.proximo = 0.8;
    this.bolsa = [];
  }

  _actualizarMarcador() {
    this.cabecera.derecha(`⏱ ${Math.max(0, Math.ceil(this.restante))} s · ${'❤️'.repeat(Math.max(0, this.vidas))} · ✅ ${this.resueltos}/${this.meta}`);
  }

  // ── Menú con las claves ──────────────────────────────────────────────────

  _crearMenu() {
    this.menu = new THREE.Group();
    this.menu.visible = false;
    this.raiz.add(this.menu);
    const titulo = this.etiqueta(this.t('caosElige'), { ancho: 0.62, alto: 0.075, fondo: 'rgba(13, 20, 38, 0.88)', color: '#ffffff', tam: 34 });
    titulo.position.y = 0.13;
    this.menu.add(titulo);
    const n = this.categorias.length;
    this.botonesMenu = this.categorias.map((c, i) => {
      const b = this.boton(`${c.emoji ?? ''}\n${c.nombre}`, () => this._responder(c.id, b), { ancho: 0.25, alto: 0.17, color: c.color ?? COLORES.primario, tam: 30 });
      b.position.set((i - (n - 1) / 2) * 0.265, 0, 0);
      this.menu.add(b);
      return b;
    });
  }

  _abrirMenu(nodo) {
    if (this.estado !== 'jugando' || nodo.userData.resuelto) return;
    if (this.seleccionado && this.seleccionado !== nodo) this.seleccionado.userData.halo.scale.setScalar(1);
    this.seleccionado = nodo;
    nodo.userData.halo.scale.setScalar(1.35);
    const { cab } = this.mirada();
    const dir = nodo.position.clone().sub(cab).setY(0).normalize();
    this.menu.position.copy(cab).addScaledVector(dir, 1.0);
    this.menu.position.y = nodo.position.y - 0.36;
    this.menu.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    for (const b of this.botonesMenu) {
      b.setModo('normal');
      this.m.entrada.habilitar(b, true);
    }
    this.menu.visible = true;
    this.m.fx.aparecer(this.menu, 0.3);
  }

  _cerrarMenu() {
    this.menu.visible = false;
    if (this.seleccionado) this.seleccionado.userData.halo.scale.setScalar(1);
    this.seleccionado = null;
  }

  _responder(id, boton) {
    const nodo = this.seleccionado;
    if (!nodo || nodo.userData.resuelto || this.estado !== 'jugando') return;
    const u = nodo.userData;
    const pos = this.posMundo(nodo);
    if (id !== u.datos.categoria) {
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(this.posMundo(boton));
      this.perder();
      this.cabecera.mensaje(this.t('caosError'), COLORES.naranja);
      return;
    }
    u.resuelto = true;
    this.resueltos++;
    this.m.entrada.desregistrar(nodo);
    this._cerrarMenu();
    this.m.audio.acierto(pos);
    this.ganar(pos, 100 + Math.round((50 * Math.max(0, u.vida)) / u.total / 10) * 10);
    this.cabecera.mensaje(this.t('caosResuelto', { explicacion: u.datos.explicacion }), COLORES.verde);
    u.halo.material.color.set(COLORES.verde);
    u.globo.visible = false;
    this.m.fx.confeti(pos, 24);
    const resuelto = u.datos.resuelto;
    if (resuelto?.modelo) {
      u.modelo.removeFromParent();
      liberar(u.modelo);
      const nuevo = this.modelo(resuelto.modelo, { tamano: u.datos.tamano ?? 0.26, ...resuelto.opciones });
      nodo.add(nuevo);
      this.m.fx.aparecer(nuevo, 0.4);
      this.m.fx.pixeles(pos, '#7dff9a', 30, 0.45);
    } else {
      this.m.fx.pixeles(pos, '#7dff9a', 40, 0.6);
      this.m.fx.escalarA(u.modelo, 0.01, 0.5);
    }
    if (this.resueltos === this.meta) this.m.audio.exito();
    this.m.fx.tween({ duracion: 1.4 }).then(() => !this._destruida && this._retirar(nodo));
    this._actualizarMarcador();
  }

  // ── Juego ────────────────────────────────────────────────────────────────

  _empezar() {
    if (this.estado === 'jugando') return;
    for (const n of [...this.activos]) this._retirar(n);
    this._reiniciar();
    this.estado = 'jugando';
    this.btnEmpezar.visible = false;
    this.m.entrada.habilitar(this.btnEmpezar, false);
    if (this.fin) this.fin.visible = false;
    this.m.audio.transicion();
    this.cabecera.mensaje(this.t('caosEmpieza'), COLORES.primario);
    this._actualizarMarcador();
  }

  _actualizar(dt, t) {
    this.restante -= dt;
    this.proximo -= dt;
    const progreso = 1 - Math.max(0, this.restante) / this.duracion;
    const maximo = progreso > 0.6 ? 4 : 3;
    const pendientes = this.activos.filter((n) => !n.userData.resuelto).length;
    if (this.restante > 3 && this.proximo <= 0 && pendientes < maximo) {
      this._lanzar(progreso);
      this.proximo = 4.6 - progreso * 1.6;
    }
    for (const nodo of [...this.activos]) {
      const u = nodo.userData;
      if (u.resuelto) continue;
      u.vida -= dt;
      const urgente = u.vida < 3;
      u.halo.userData.encendido = urgente ? Math.sin(t * 14) > 0 : true;
      u.modelo.position.x = urgente ? Math.sin(t * 40) * 0.008 : 0;
      if (u.vida <= 0) this._expirar(nodo);
    }
    if (this.restante <= 0 || this.vidas <= 0) this._terminarJuego();
  }

  _lanzar(progreso) {
    const ocupados = new Set(this.activos.map((n) => n.userData.lugar));
    const libres = this.lugares.filter((p) => !ocupados.has(p));
    if (!libres.length) return;
    // Al principio aparecen adelante; después, por todos lados.
    const candidatos = progreso < 0.15 ? libres.filter((p) => p.z < -0.9) : libres;
    const lugar = (candidatos.length ? candidatos : libres)[Math.floor(Math.random() * (candidatos.length || libres.length))];
    if (!this.bolsa.length) this.bolsa = barajar(this.incidentes);
    const datos = this.bolsa.shift();
    const vida = 13 - progreso * 4;

    const nodo = new THREE.Group();
    nodo.position.copy(lugar);
    nodo.lookAt(0, lugar.y, 0);
    const modelo = this.modelo(datos.modelo, { tamano: datos.tamano ?? 0.26, ...datos.opciones });
    const halo = this.halo(0.55, COLORES.rojo);
    halo.position.z = -0.1;
    halo.userData.encendido = true;
    const globo = new PanelLienzo(0.44, 0.17, (ctx, w, h) => this._dibujarGlobo(ctx, w, h, nodo));
    globo.position.y = modelo.userData.tam.y / 2 + 0.15;
    nodo.add(modelo, halo, globo);
    Object.assign(nodo.userData, { datos, modelo, halo, globo, lugar, vida, total: vida, resuelto: false });
    globo.redibujar();
    this.raiz.add(nodo);
    this.m.fx.aparecer(nodo, 0.35);
    this.interactivo(nodo, {
      proxy: true,
      alPasar: (v) => !nodo.userData.resuelto && modelo.scale.setScalar(v ? 1.15 : 1),
      alSeleccionar: () => this._abrirMenu(nodo),
    });
    this.activos.push(nodo);
    this.m.audio.alarma(this.posMundo(nodo));
  }

  _expirar(nodo) {
    const u = nodo.userData;
    u.resuelto = true;
    this.vidas--;
    this.perder();
    this.m.entrada.desregistrar(nodo);
    if (this.seleccionado === nodo) this._cerrarMenu();
    const pos = this.posMundo(nodo);
    this.m.audio.error(pos);
    this.m.fx.pixeles(pos, '#ff5a5f', 30, 0.5);
    this.m.fx.sacudir(nodo, 0.05);
    u.globo.visible = false;
    this.cabecera.mensaje(this.t('alguienEnfermo', { explicacion: `${u.datos.nombre}: ${u.datos.explicacion}` }), COLORES.rojo);
    this.m.fx.escalarA(nodo, 0.01, 0.8, suavizado.entradaSalida).then(() => !this._destruida && this._retirar(nodo));
    this._actualizarMarcador();
  }

  _retirar(nodo) {
    this.m.entrada.desregistrar(nodo);
    this.activos = this.activos.filter((n) => n !== nodo);
    if (this.seleccionado === nodo) this._cerrarMenu();
    if (!nodo.parent) return;
    nodo.removeFromParent();
    liberar(nodo);
  }

  _terminarJuego() {
    if (this.estado !== 'jugando') return;
    this.estado = 'fin';
    this._cerrarMenu();
    for (const n of [...this.activos]) {
      this.m.fx.pixeles(this.posMundo(n), '#9fdcff', 12, 0.3);
      this._retirar(n);
    }
    const perdio = this.vidas <= 0;
    const estrellas = 1 + (this.resueltos >= this.meta ? 1 : 0) + (this.resueltos >= this.meta && this.vidas >= this.vidasMax - 1 ? 1 : 0);
    this._actualizarMarcador();
    this.cabecera.mensaje(
      `${'⭐'.repeat(estrellas)}${'☆'.repeat(3 - estrellas)} ${perdio ? this.t('caosPerdido', { n: this.resueltos }) : this.t('caosTerminado', { n: this.resueltos })}`,
      perdio ? COLORES.naranja : COLORES.verde,
    );
    this.m.audio.exito();

    // Botones delante de donde mira el estudiante
    if (!this.fin) {
      this.fin = new THREE.Group();
      const otra = this.boton(this.t('jugarOtraVez'), () => this._empezar(), { ancho: 0.42, alto: 0.12, color: '#e6ebf8', colorTexto: COLORES.texto });
      otra.position.x = -0.26;
      const seguir = this.boton(this.t('continuar'), () => this.terminar(), { ancho: 0.42, alto: 0.12, color: COLORES.verde });
      seguir.position.x = 0.26;
      this.fin.add(otra, seguir);
      this.raiz.add(this.fin);
    }
    this.anteMirada(this.fin, { distancia: 1.2, dy: -0.25 });
    this.fin.visible = true;
    this.m.fx.aparecer(this.fin, 0.4);
    this.m.fx.confeti(this.posMundo(this.fin).add(V(0, 0.4, 0)), 70);
  }

  _dibujarGlobo(ctx, w, h, nodo) {
    const u = nodo.userData;
    if (!u.datos) return;
    const k = Math.max(0, u.vida / u.total);
    tarjeta(ctx, w, h, { radio: 30, borde: k < 0.25 ? COLORES.rojo : COLORES.naranja, grosor: 8, sombra: false });
    escribir(ctx, `⚠️ ${u.datos.nombre}`, w / 2, 16, { tam: 36, peso: 800, alinear: 'center', maxAncho: w - 36, maxAlto: h - 52, interlineado: 1.1 });
    ctx.fillStyle = '#e6ebf8';
    ctx.beginPath();
    ctx.roundRect(24, h - 34, w - 48, 16, 8);
    ctx.fill();
    ctx.fillStyle = k > 0.5 ? COLORES.verde : k > 0.25 ? COLORES.amarillo : COLORES.rojo;
    ctx.beginPath();
    ctx.roundRect(24, h - 34, Math.max(16, (w - 48) * k), 16, 8);
    ctx.fill();
  }
}
