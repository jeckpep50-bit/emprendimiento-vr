import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { suavizado } from '../core/efectos.js';
import { posar } from '../mundo/prefabs/personas.js';
import { noticias } from '../mundo/prefabs/noticias.js';
import { crearModelo } from '../mundo/prefabs/index.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z, orden = 'XYZ') => new THREE.Euler(x, y, z, orden);
const tramo = (a, b, x) => THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);

/**
 * Congelado: un choque en el mercado se detiene en el instante del impacto. El
 * estudiante camina alrededor de la escena congelada y:
 *  1. busca objetos por su ubicación (encima de, debajo de, entre, dentro de);
 *  2. completa frases que describen la escena (hay que observarla);
 *  3. elige la frase objetiva (sin opiniones), como en un reporte.
 * Al final el tiempo sigue y se ve que nadie salió herido.
 * datos: { titulo, instruccion, mensajeFinal,
 *   busqueda: { rondas: [{ texto, objetivo: 'n1'..'n6' }] }, ubicaciones: { n1: 'texto', … },
 *   completar: { instruccion, rondas: [{ frase (con ___), opciones, correcta, explicacion }] },
 *   objetividad: { instruccion, rondas: [{ opciones: [2 frases], correcta, explicacion }] },
 *   frases: { aviso, majoBien, vendedoraAyuda } }
 */
export class EscenaCongelado extends EscenaBase {
  construir() {
    const { H } = this;
    this.fase = 'aviso';
    this.reloj = -1;
    this.objetos = [];
    this.naranjas = {};

    // Toda la escena del choque, un poco más lejos del estudiante
    this.mundo = new THREE.Group();
    this.mundo.position.z = -0.25;
    this.raiz.add(this.mundo);
    this._crearEscena();
    this.cadaCuadro((dt, t) => this._animar(dt, t));

    // Libreta del reportero: sigue la mirada, abajo, como si la tuviera en la mano
    this.libreta = new THREE.Group();
    this.raiz.add(this.libreta);
    this.panel = new PanelLienzo(0.64, 0.25, (ctx, w, h) => this._dibujarLibreta(ctx, w, h));
    this.libreta.add(this.panel);
    this.botones = new THREE.Group();
    this.libreta.add(this.botones);
    this.seguirMirada(this.libreta, { distancia: 1.0, altura: H - 0.42, umbral: 0.9 });
    this.libreta.visible = false;
    this.texto = '';
    this.mensaje = null;
    this.etiqueta = '';

    // Tinte azul del tiempo congelado
    this.tinte = new THREE.Mesh(
      new THREE.SphereGeometry(4, 24, 14),
      new THREE.MeshBasicMaterial({ color: '#7fb8ff', transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, depthTest: false }),
    );
    this.tinte.renderOrder = 800;
    this.raiz.add(this.tinte);
  }

  // ── La escena del choque ─────────────────────────────────────────────────

  /** Agrega un objeto con su pose inicial (antes del choque) y su pose congelada. */
  _objeto(obj, ini, fin, { rotIni = E(0, 0, 0), rotFin = rotIni, arco = 0, padre = this.mundo } = {}) {
    obj.position.copy(ini);
    obj.rotation.copy(rotIni);
    padre.add(obj);
    const o = { obj, ini, fin, rotIni, rotFin, arco, vel: V(0, 0, 0), suelo: 0 };
    this.objetos.push(o);
    return o;
  }

  _crearEscena() {
    const modelo = (n, op = {}) => {
      const m = crearModelo(n, { normalizar: false, ...op });
      return m;
    };
    // Carrito de frutas (se inclina con el golpe)
    this.carrito = this._objeto(noticias.carrito_frutas(), V(-0.55, 0, -1.6), V(-0.55, 0.05, -1.6), { rotFin: E(0, 0, 0.16) });
    // Bicicleta de Majo (llega desde la derecha y se clava de frente)
    const bici = new THREE.Group();
    bici.add(noticias.bicicleta({ color: '#2f8be6' }));
    bici.rotation.order = 'YXZ';
    this.bici = this._objeto(bici, V(3.4, 0, -1.5), V(0.45, 0.12, -1.5), { rotIni: E(0, Math.PI, 0, 'YXZ'), rotFin: E(0.28, Math.PI, -0.38, 'YXZ') });
    // Naranja dentro de la canasta de la bici (viaja con ella)
    const n4 = this._naranja('n4');
    n4.position.set(0.62, 0.86, 0.03);
    bici.children[0].add(n4);
    // Panes en la canasta que salen volando
    this.panes = [0, 1, 2, 3].map((i) => {
      const p = modelo('pan', { escala: 0.9 });
      const o = this._objeto(p, V(0.02, 0.86, -1.5 + (i - 1.5) * 0.06), V(0.05 + i * 0.12, 1.05 + (i % 2) * 0.32, -1.38 - i * 0.1), { rotFin: E(i * 0.7, i * 1.3, i * 0.5), arco: 0.5 });
      p.position.x = 2.8;
      return o;
    });

    // Majo, la ciclista (con casco rojo)
    this.majo = this.crearPersona({ edad: 'adulto', estatura: 1.5, peinado: 'cola', cabello: '#3b2416', piel: '#c98b5e', superior: '#ffc23c', inferior: '#2f3b52', falda: false, cuello: null, gorra: '#e5484d', expresion: 'feliz' }, [3.4 + 0.24, 0.09, -1.5], { padre: this.mundo });
    this.majoO = this._objeto(this.majo, V(3.64, 0.09, -1.5), V(0.02, 0.62, -1.5), { rotIni: E(0, -Math.PI / 2, 0, 'YXZ'), rotFin: E(0.95, -Math.PI / 2, 0, 'YXZ'), arco: 0.3 });

    // La vendedora y su sombrero
    this.vendedora = this.crearPersona({ edad: 'adulto', estatura: 1.52, peinado: 'mono', cabello: '#2b1d14', piel: '#a8704a', superior: '#e85d8a', inferior: '#3a4256', falda: true, cuello: null, delantal: '#ffffff', expresion: 'feliz' }, [-1.4, 0, -2.0], { ry: 1.0, padre: this.mundo });
    this.sombrero = this._objeto(noticias.sombrero(), V(-1.4, 1.52, -2.0), V(-1.05, 1.74, -1.62), { rotFin: E(0.5, 0.3, 0.7), arco: 0.25 });
    // Perro que salta del susto
    this.perro = this._objeto(noticias.perro({ color: '#c8914c', salto: true }), V(1.7, 0, -0.75), V(1.15, 0.38, -1.0), { rotIni: E(0, -Math.PI / 2, 0), rotFin: E(0, -Math.PI / 2, 0.15), arco: 0.4 });

    // Naranjas (las que hay que buscar) y otras frutas en el aire
    const salida = V(-0.4, 0.82, -1.55);
    const posiciones = {
      n1: V(-1.05, 1.86, -1.62),
      n2: V(-0.42, 0.07, -1.52),
      n3: V(0.82, 0.6, -1.22),
      n5: V(-0.25, 1.32, -1.45),
      n6: V(-1.2, 0.98, -1.42),
    };
    for (const [id, fin] of Object.entries(posiciones)) {
      const n = this._naranja(id);
      this._objeto(n, salida.clone().add(V(Math.random() * 0.3, 0, Math.random() * 0.2)), fin, { arco: id === 'n2' ? 0 : 0.35, rotFin: E(Math.random() * 3, Math.random() * 3, 0) });
    }
    for (const [n, fin] of [['banano', V(-0.7, 1.2, -1.3)], ['manzana', V(-0.05, 1.5, -1.7)], ['manzana', V(-0.85, 1.42, -1.75)], ['banano', V(0.25, 1.62, -1.55)]]) {
      this._objeto(modelo(n, { escala: 1.1 }), salida.clone(), fin, { arco: 0.4, rotFin: E(Math.random() * 3, Math.random() * 3, Math.random() * 3) });
    }
  }

  _naranja(id) {
    const g = new THREE.Group();
    const m = crearModelo('naranja', { normalizar: false, escala: 1.35 });
    m.position.y = -0.095;
    g.add(m);
    const halo = this.halo(0.3, COLORES.verde);
    halo.userData.encendido = false;
    g.add(halo);
    this.mirarAlUsuario([halo]);
    g.userData = { ...g.userData, id, halo, hallada: false };
    this.naranjas[id] = g;
    this.interactivo(g, {
      proxy: true,
      alPasar: (v) => this.fase === 'buscar' && !g.userData.hallada && m.scale.setScalar(v ? 1.2 : 1),
      alSeleccionar: () => this._tocarNaranja(g),
    });
    this.m.entrada.habilitar(g, false);
    return g;
  }

  // ── Tiempo: la acción, el congelamiento y el final ───────────────────────

  async vozInicial() {
    const f = this.datos.frases?.aviso;
    await this.esperar(0.4);
    if (f) await this.voz(f.texto, f.quien);
    if (this._destruida) return;
    this.fase = 'accion';
    this.reloj = 0;
  }

  _animar(dt, t) {
    if (this.fase === 'accion') this._accion(dt);
    if (this.fase === 'final') this._caer(dt);
    this.tinte.material.opacity += ((this.fase === 'congelado' ? 0.14 : 0) - this.tinte.material.opacity) * Math.min(1, dt * 4);
    const cab = this.m.app.camara.getWorldPosition(new THREE.Vector3());
    this.tinte.position.copy(this.raiz.worldToLocal(cab));
  }

  _accion(dt) {
    this.reloj += dt;
    const r = this.reloj;
    const choque = 1.8;
    // Majo pedalea hacia el carrito
    const pedal = Math.sin(r * 14) * 0.6;
    if (r < choque) {
      const k = r / choque;
      const x = THREE.MathUtils.lerp(3.4, 0.62, k);
      this.bici.obj.position.set(x, 0, -1.5);
      this.majo.position.set(x + 0.24, 0.09, -1.5);
      this.majo.rotation.set(0, -Math.PI / 2, 0);
      posar(this.majo, { piernaI: [-1.1 + pedal, 0, 0], piernaD: [-1.1 - pedal, 0, 0], brazoI: [-1.3, 0, -0.15], brazoD: [-1.3, 0, 0.15] }, 0.5);
      for (const p of this.panes) p.obj.position.set(x - 0.6, 0.86, p.ini.z);
      if (Math.random() < dt * 6) this.m.audio.clac(this.posMundo(this.bici.obj));
      return;
    }
    if (!this._golpe) {
      this._golpe = true;
      this.m.audio.rafaga({ duracion: 0.5, filtro: 'lowpass', frecuencia: 500, volumen: 0.3, pos: this.posMundo(this.carrito.obj) });
      this.m.audio.sello(this.posMundo(this.carrito.obj));
      this.vendedora.userData.setExpresion('sorpresa');
      this.majo.userData.setExpresion('sorpresa');
    }
    // Del choque al congelamiento (medio segundo): todo sale disparado
    const k = suavizado.salida(tramo(choque, choque + 0.5, r));
    for (const o of this.objetos) {
      if (o === this.bici || o === this.majoO) continue;
      o.obj.position.lerpVectors(o.ini, o.fin, k);
      o.obj.position.y += Math.sin(k * Math.PI) * o.arco * (1 - k);
      o.obj.quaternion.slerpQuaternions(new THREE.Quaternion().setFromEuler(o.rotIni), new THREE.Quaternion().setFromEuler(o.rotFin), k);
    }
    for (const o of [this.bici, this.majoO]) {
      const desde = o === this.bici ? V(0.62, 0, -1.5) : V(0.86, 0.09, -1.5);
      o.obj.position.lerpVectors(desde, o.fin, k);
      o.obj.rotation.set(o.rotFin.x * k, o.rotFin.y, o.rotFin.z * k);
      if (o === this.majoO) o.obj.rotation.set(o.rotFin.x * k, -Math.PI / 2, 0);
    }
    posar(this.majo, { brazoI: [-2.6, 0, -0.3], brazoD: [-2.6, 0, 0.3], piernaI: [0.4, 0, 0], piernaD: [0.6, 0, 0] }, 0.4);
    posar(this.vendedora, { brazoI: [-2.9, 0, -0.45], brazoD: [-2.9, 0, 0.45], cabeza: [-0.2, 0, 0] }, 0.4);
    if (r >= choque + 0.5) this._congelar();
  }

  _congelar() {
    this.fase = 'congelado';
    this.m.entornoPausado = true;
    this.m.audio.volumenAmbiente(0.15);
    this.m.audio.tono(900, 0.6, { hasta: 120, volumen: 0.12 });
    this.m.audio.rafaga({ duracion: 0.8, frecuencia: 2400, hasta: 200, volumen: 0.1 });
    // Las personas también se congelan: se guarda su pose y deja de animarse la respiración
    for (const p of [this.majo, this.vendedora]) p.userData.congelado = true;
    this.libreta.visible = true;
    this.m.fx.aparecer(this.libreta, 0.4);
    this.etiqueta = this.t('tiempoCongelado');
    this.texto = this.datos.instruccion;
    this.panel.redibujar();
    this.voz(this.datos.instruccion).then(() => !this._destruida && this._empezarBusqueda());
  }

  // ── 1. Buscar por la ubicación ───────────────────────────────────────────

  _empezarBusqueda() {
    this.fase = 'buscar';
    this.ronda = 0;
    for (const n of Object.values(this.naranjas)) this.m.entrada.habilitar(n, true);
    this._rondaBusqueda();
  }

  _rondaBusqueda() {
    const r = this.datos.busqueda.rondas[this.ronda];
    this.etiqueta = this.t('buscaRonda', { n: this.ronda + 1, total: this.datos.busqueda.rondas.length });
    this.texto = r.texto;
    this.mensaje = null;
    this.fallos = 0;
    this.panel.redibujar();
    this.m.fx.latido(this.panel, 0.05);
    this.voz(r.texto);
  }

  _tocarNaranja(n) {
    if (this.fase !== 'buscar' || n.userData.hallada) return;
    const r = this.datos.busqueda.rondas[this.ronda];
    const pos = this.posMundo(n);
    if (n.userData.id !== r.objetivo) {
      this.m.audio.error(pos);
      this.perder();
      this.fallos++;
      this.m.fx.sacudir(n, 0.02);
      this.mensaje = { texto: `🤔 ${this.t('naranjaEsta', { donde: this.datos.ubicaciones?.[n.userData.id] ?? '…' })}`, color: '#b35a00' };
      this.panel.redibujar();
      return;
    }
    n.userData.hallada = true;
    n.userData.halo.userData.encendido = true;
    this.m.entrada.habilitar(n, false);
    this.m.audio.acierto(pos);
    this.ganar(pos, this.fallos ? 60 : 120);
    this.m.fx.confeti(pos, 24);
    this.mensaje = { texto: `✅ ${this.t('bienEncontrada')}`, color: '#1b7f4f' };
    this.panel.redibujar();
    this.ronda++;
    this.esperar(1.4).then(() => {
      if (this._destruida) return;
      if (this.ronda < this.datos.busqueda.rondas.length) this._rondaBusqueda();
      else this._empezarCompletar();
    });
  }

  // ── 2 y 3. Completar la descripción y elegir lo objetivo ─────────────────

  _empezarCompletar() {
    this.fase = 'completar';
    for (const n of Object.values(this.naranjas)) this.m.entrada.habilitar(n, false);
    this.rondas = this.datos.completar.rondas.map((r) => ({ ...r, tipo: 'completar' })).concat(this.datos.objetividad.rondas.map((r) => ({ ...r, tipo: 'objetividad' })));
    this.ronda = 0;
    this.voz(this.datos.completar.instruccion);
    this._rondaOpciones();
  }

  _rondaOpciones() {
    const r = this.rondas[this.ronda];
    const total = this.rondas.length;
    if (r.tipo === 'objetividad' && this.rondas[this.ronda - 1]?.tipo !== 'objetividad') this.voz(this.datos.objetividad.instruccion);
    this.etiqueta = r.tipo === 'completar' ? this.t('completaRonda', { n: this.ronda + 1, total }) : this.t('objetivoRonda', { n: this.ronda + 1, total });
    this.texto = r.tipo === 'completar' ? r.frase : this.datos.objetividad.pregunta;
    this.mensaje = null;
    this.panel.redibujar();
    this.m.fx.latido(this.panel, 0.05);
    for (const b of [...this.botones.children]) {
      this.m.entrada.desregistrar(b);
      b.removeFromParent();
    }
    const opciones = barajar(r.opciones.map((texto, i) => ({ texto, i })));
    // Palabras cortas en fila; frases completas, una debajo de otra
    const fila = r.tipo === 'completar';
    opciones.forEach((op, k) => {
      const b = this.boton(op.texto, () => this._elegir(r, op.i, b), { ancho: fila ? 0.2 : 0.62, alto: fila ? 0.08 : 0.085, color: '#ffffff', colorTexto: COLORES.texto, tam: fila ? 34 : 28 });
      if (fila) b.position.set((k - (opciones.length - 1) / 2) * 0.21, -0.18, 0.01);
      else b.position.set(0, -0.18 - k * 0.095, 0.01);
      this.botones.add(b);
      this.m.fx.aparecer(b, 0.3, k * 0.06);
    });
  }

  _elegir(r, i, boton) {
    const pos = this.posMundo(boton);
    if (i !== r.correcta) {
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.mensaje = { texto: `🤔 ${r.pista ?? this.t('miraLaEscena')}`, color: '#b35a00' };
      this.panel.redibujar();
      return;
    }
    for (const b of this.botones.children) this.m.entrada.habilitar(b, false);
    boton.setModo('correcto');
    this.m.audio.acierto(pos);
    this.ganar(pos, 120);
    if (r.tipo === 'completar') this.texto = r.frase.replace('___', r.opciones[r.correcta].toUpperCase());
    this.mensaje = { texto: `✅ ${r.explicacion}`, color: '#1b7f4f' };
    this.panel.redibujar();
    this.ronda++;
    this.esperar(2.4).then(() => {
      if (this._destruida) return;
      if (this.ronda < this.rondas.length) this._rondaOpciones();
      else this._descongelar();
    });
  }

  // ── El tiempo sigue: nadie salió herido ──────────────────────────────────

  _descongelar() {
    this.fase = 'final';
    this.m.entornoPausado = false;
    this.m.audio.volumenAmbiente(1);
    this.m.audio.tono(150, 0.6, { hasta: 900, volumen: 0.1 });
    for (const b of [...this.botones.children]) b.visible = false;
    this.libreta.visible = false;
    // Cada objeto sigue su movimiento y cae al suelo
    for (const o of this.objetos) {
      o.vel.copy(o.fin).sub(o.ini).multiplyScalar(0.35);
      o.vel.y = 0.6;
    }
    this.finReloj = 0;
  }

  _caer(dt) {
    this.finReloj += dt;
    const g = 9.8;
    for (const o of this.objetos) {
      if (o === this.majoO || o === this.carrito) continue;
      if (o.quieto) continue;
      o.vel.y -= g * dt;
      o.obj.position.addScaledVector(o.vel, dt);
      o.vel.x *= 0.98;
      o.vel.z *= 0.98;
      const suelo = o === this.bici ? 0.05 : 0.06;
      if (o.obj.position.y <= suelo) {
        o.obj.position.y = suelo;
        if (Math.abs(o.vel.y) > 1) o.vel.y *= -0.3;
        else o.quieto = true;
        o.vel.x *= 0.5;
        o.vel.z *= 0.5;
      }
    }
    // El carrito se endereza; la bici queda acostada; Majo cae de pie y se ríe
    const k = Math.min(1, dt * 4);
    this.carrito.obj.rotation.z += (0 - this.carrito.obj.rotation.z) * k;
    this.carrito.obj.position.y += (0 - this.carrito.obj.position.y) * k;
    this.bici.obj.rotation.z += (-1.45 - this.bici.obj.rotation.z) * k * 0.5;
    this.bici.obj.rotation.x += (0 - this.bici.obj.rotation.x) * k;
    const majo = this.majo;
    majo.userData.congelado = false;
    this.vendedora.userData.congelado = false;
    const destino = V(0.8, 0, -0.8);
    majo.position.lerp(destino, k * 0.5);
    majo.rotation.x += (0 - majo.rotation.x) * k;
    majo.rotation.y += (Math.atan2(-destino.x, -destino.z) - majo.rotation.y) * k * 0.5;
    posar(majo, { brazoD: this.finReloj > 2 ? [-2.6, 0, 0.4 + Math.sin(this.finReloj * 8) * 0.3] : [0, 0, 0.12] }, k);
    posar(this.vendedora, {}, k);
    if (this.finReloj > 1.0 && !this._dijo) {
      this._dijo = true;
      this._cierre();
    }
  }

  async _cierre() {
    const f = this.datos.frases ?? {};
    this.majo.userData.setExpresion('feliz');
    this.vendedora.userData.setExpresion('feliz');
    if (f.majoBien) await this.hablarPersona(this.majo, f.majoBien.texto, f.majoBien.quien);
    if (this._destruida) return;
    if (f.vendedoraAyuda) await this.hablarPersona(this.vendedora, f.vendedoraAyuda.texto, f.vendedoraAyuda.quien);
    if (this._destruida) return;
    this.m.audio.exito();
    this.libreta.visible = true;
    this.etiqueta = this.t('noticiaLista');
    this.texto = this.datos.mensajeFinal;
    this.mensaje = null;
    this.panel.redibujar();
    this.mostrarContinuar(V(-0.62, this.H - 0.12, -1.0));
    await this.voz(this.datos.mensajeFinal);
  }

  _dibujarLibreta(ctx, w, h) {
    tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 30, borde: '#23304a', grosor: 8 });
    if (this.etiqueta) pastilla(ctx, this.etiqueta, 24, 16, { tam: 24, fondo: this.fase === 'congelado' || this.fase === 'buscar' ? '#2f6fd0' : '#23304a', color: '#ffffff' });
    const y = escribir(ctx, this.texto, 26, 66, { tam: 34, tamMin: 24, peso: 800, maxAncho: w - 52, maxAlto: this.mensaje ? 120 : h - 80, interlineado: 1.15 });
    if (this.mensaje) escribir(ctx, this.mensaje.texto, 26, y + 6, { tam: 26, tamMin: 20, peso: 700, color: this.mensaje.color, maxAncho: w - 52, maxAlto: h - y - 14, interlineado: 1.12 });
  }
}
