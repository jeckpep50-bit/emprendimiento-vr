import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { suavizado } from '../core/efectos.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';
import { mat, malla, fusionar } from '../mundo/materiales.js';
import { mesa } from '../mundo/prefabs/objetos.js';
import { diseno } from '../mundo/prefabs/diseno.js';
import { persona, posar } from '../mundo/prefabs/personas.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Taller de prototipo en dos etapas:
 *  1. Materiales: en un estante hay materiales; al tocar uno, el estudiante decide si
 *     sirve para el prototipo. Los que sirven viajan a la mesa de trabajo.
 *  2. Medida: con una simulación a tamaño real (Camila frente al bebedero), prueba
 *     alturas para el escalón hasta encontrar la que funciona.
 * datos: { titulo, instruccion, instruccionMedida, mensajeFinal?,
 *   materiales: [{ modelo, opciones?, nombre, sirve: bool, explicacion }],
 *   medidas: [{ texto, alto (m), correcta: bool, explicacion }],
 *   frases?: { logro: { quien, texto } } }
 */
export class EscenaPrototipo extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.etapa = 'materiales';
    this.activo = null;
    // Se mezclan: los que sirven no deben quedar todos juntos en el mismo nivel.
    this.materiales = barajar(d.materiales ?? []);
    this.utiles = this.materiales.filter((m) => m.sirve).length;
    this.enMesa = 0;
    this.decididos = 0;

    this.cabecera = this.encabezado({ instruccion: d.instruccion ?? '', y: H + 0.62 });
    this.cabecera.derecha(this.t('materialesProgreso', { n: 0, total: this.materiales.length }));

    this._crearEstante();
    this._crearMesa();
    this._crearFicha();
  }

  // ── Etapa 1: materiales ──────────────────────────────────────────────────

  _crearEstante() {
    const { H } = this;
    this.estante = new THREE.Group();
    this.estante.position.set(-0.62, 0, -1.45);
    this.estante.lookAt(0, 0, 0);
    this.estante.rotateY(0.18);
    this.raiz.add(this.estante);
    const niveles = [Math.max(0.45, H - 0.62), Math.max(0.85, H - 0.18)];
    const madera = new THREE.Group();
    for (const y of niveles) madera.add(malla(new THREE.BoxGeometry(1.25, 0.03, 0.34), mat('#c89f7a'), [0, y - 0.015, 0]));
    for (const x of [-0.62, 0.62]) madera.add(malla(new THREE.BoxGeometry(0.04, niveles[1] + 0.25, 0.34), mat('#a87f4c'), [x, (niveles[1] + 0.25) / 2, 0]));
    madera.add(malla(new THREE.BoxGeometry(1.25, niveles[1] + 0.25, 0.02), mat('#e8dcc0'), [0, (niveles[1] + 0.25) / 2, -0.17]));
    fusionar(madera);
    this.estante.add(madera);
    const cartel = this.etiqueta(this.t('estanteMateriales'), { ancho: 0.62, alto: 0.08, tam: 34, fondo: '#23304a', color: '#ffffff' });
    cartel.position.set(0, niveles[1] + 0.32, 0);
    this.estante.add(cartel);
    this.presentar(this.estante, 0.2);

    const porNivel = Math.ceil(this.materiales.length / 2);
    this.nodos = this.materiales.map((m, i) => {
      const nivel = Math.floor(i / porNivel);
      const k = i % porNivel;
      const enNivel = nivel === 0 ? porNivel : this.materiales.length - porNivel;
      const nodo = new THREE.Group();
      const modelo = this.modelo(m.modelo, { tamano: 0.17, ...m.opciones });
      modelo.position.y = modelo.userData.tam.y / 2;
      nodo.add(modelo);
      const nombre = this.etiqueta(m.nombre, { ancho: 0.22, alto: 0.06, tam: 26 });
      nombre.position.set(0, -0.06, 0.2);
      nombre.rotation.x = -0.25;
      nodo.add(nombre);
      nodo.position.set((k - (enNivel - 1) / 2) * 0.235, niveles[nivel], 0.02);
      Object.assign(nodo.userData, { m, modelo, nombre, estado: 'pendiente', origen: nodo.position.clone(), fallos: 0 });
      this.estante.add(nodo);
      this.interactivo(nodo, {
        proxy: true,
        alPasar: (v) => !this.activo && nodo.userData.estado === 'pendiente' && modelo.scale.setScalar(v ? 1.18 : 1),
        alSeleccionar: () => this._abrir(nodo),
      });
      return nodo;
    });
  }

  _crearMesa() {
    const { H } = this;
    const alto = THREE.MathUtils.clamp(H - 0.55, 0.5, 0.8);
    this.mesa = new THREE.Group();
    this.mesa.position.set(0.72, 0, -1.3);
    this.mesa.lookAt(0, 0, 0);
    this.mesa.add(mesa(0.95, 0.6, alto, '#c89f7a'));
    const plano = new PanelLienzo(0.85, 0.5, (ctx, w, h) => {
      ctx.fillStyle = '#1f5fa8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      escribir(ctx, this.t('mesaPrototipo'), 24, 18, { tam: 36, peso: 800, color: '#ffffff' });
    });
    plano.rotation.x = -Math.PI / 2;
    plano.position.y = alto + 0.003;
    this.mesa.add(plano);
    this.altoMesa = alto;
    this.raiz.add(this.mesa);
    this.presentar(this.mesa, 0.3);
  }

  _crearFicha() {
    this.ficha = new THREE.Group();
    this.ficha.visible = false;
    this.raiz.add(this.ficha);
    this.panelFicha = new PanelLienzo(0.66, 0.32, (ctx, w, h) => this._dibujarFicha(ctx, w, h));
    this.panelFicha.position.y = 0.18;
    this.ficha.add(this.panelFicha);
    this.btnSi = this.boton(this.t('materialSirve'), () => this._decidir(true, this.btnSi), { ancho: 0.32, alto: 0.1, color: COLORES.verde, tam: 30 });
    this.btnNo = this.boton(this.t('materialNoSirve'), () => this._decidir(false, this.btnNo), { ancho: 0.32, alto: 0.1, color: COLORES.rojo, tam: 30 });
    this.btnSi.position.set(-0.165, -0.04, 0.01);
    this.btnNo.position.set(0.165, -0.04, 0.01);
    this.btnOk = this.boton(this.t('entendido'), () => this._cerrar(), { ancho: 0.36, alto: 0.1, color: COLORES.primario });
    this.btnOk.position.set(0, -0.04, 0.01);
    this.ficha.add(this.btnSi, this.btnNo, this.btnOk);
  }

  _abrir(nodo) {
    if (this.activo || nodo.userData.estado !== 'pendiente' || this.etapa !== 'materiales') return;
    this.activo = nodo;
    const u = nodo.userData;
    u.mensaje = '';
    u.modelo.scale.setScalar(1.3);
    this.anteMirada(this.ficha, { distancia: 0.85, dy: -0.12, dx: 0.12 });
    for (const b of [this.btnSi, this.btnNo]) {
      b.visible = true;
      b.setModo('normal');
      b.setEncima(false);
      this.m.entrada.habilitar(b, true);
    }
    this.btnOk.visible = false;
    this.ficha.visible = true;
    this.panelFicha.redibujar();
    this.m.fx.aparecer(this.ficha, 0.35);
    this.m.audio.pop(this.posMundo(nodo));
    this.m.fx.girar(u.modelo, 0.8);
  }

  _decidir(sirve, boton) {
    const nodo = this.activo;
    if (!nodo) return;
    const u = nodo.userData;
    const pos = this.posMundo(boton);
    if (sirve !== u.m.sirve) {
      u.fallos++;
      boton.setModo('incorrecto');
      this.m.entrada.habilitar(boton, false);
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.sacudir(this.panelFicha, 0.02);
      u.mensaje = `🤔 ${u.m.pista ?? (u.m.sirve ? this.t('materialPiensaSi') : this.t('materialPiensaNo'))}`;
      this.panelFicha.redibujar();
      return;
    }
    u.estado = sirve ? 'mesa' : 'descartado';
    this.decididos++;
    this.cabecera.derecha(this.t('materialesProgreso', { n: this.decididos, total: this.materiales.length }));
    for (const b of [this.btnSi, this.btnNo]) {
      b.visible = false;
      this.m.entrada.habilitar(b, false);
    }
    this.btnOk.visible = true;
    this.m.entrada.habilitar(this.btnOk, true);
    this.m.fx.aparecer(this.btnOk, 0.3, 0.15);
    this.m.audio.acierto(pos);
    this.ganar(this.posMundo(nodo), u.fallos ? 60 : 120);
    u.mensaje = `✅ ${u.m.explicacion}`;
    this.panelFicha.redibujar();
  }

  _cerrar() {
    const nodo = this.activo;
    if (!nodo) return;
    this.activo = null;
    this.ficha.visible = false;
    const u = nodo.userData;
    u.modelo.scale.setScalar(1);
    this.m.entrada.habilitar(nodo, false);
    if (u.estado === 'mesa') {
      // Vuela a la mesa de trabajo (de la raíz del estante a la de la escena).
      const i = this.enMesa++;
      const lugar = V(-0.3 + (i % 3) * 0.3, this.altoMesa + 0.01, -0.1 + Math.floor(i / 3) * 0.2);
      const destino = this.raiz.worldToLocal(this.mesa.localToWorld(lugar));
      const desde = this.raiz.worldToLocal(this.posMundo(nodo));
      this.raiz.add(nodo);
      nodo.position.copy(desde);
      nodo.quaternion.copy(this.mesa.quaternion);
      u.nombre.visible = false;
      this.m.fx.tween({
        duracion: 0.8,
        curva: suavizado.entradaSalida,
        alActualizar: (k) => {
          nodo.position.lerpVectors(desde, destino, k);
          nodo.position.y += Math.sin(k * Math.PI) * 0.3;
        },
      }).then(() => !this._destruida && this.m.audio.burbuja(this.posMundo(nodo)));
      this.m.fx.escalarA(nodo, 1.25, 0.8);
    } else {
      // Se queda en el estante, apagado y con una ✖.
      u.nombre.actualizar({ texto: `✖ ${u.m.nombre}`, fondo: '#ffd6d6', color: '#b42318' });
      this.m.fx.escalarA(u.modelo, 0.75, 0.4);
    }
    if (this.decididos === this.materiales.length) this._materialesListos();
  }

  _dibujarFicha(ctx, w, h) {
    const nodo = this.activo;
    if (!nodo) return;
    const u = nodo.userData;
    const listo = u.estado !== 'pendiente';
    tarjeta(ctx, w, h, { radio: 36, borde: listo ? COLORES.verde : '#23304a', grosor: 10 });
    pastilla(ctx, `🧰 ${u.m.nombre}`, 30, 22, { tam: 32, fondo: '#23304a', color: '#ffffff' });
    if (!u.mensaje) {
      escribir(ctx, this.t('materialPregunta'), 34, 100, { tam: 40, peso: 800, maxAncho: w - 68 });
      return;
    }
    escribir(ctx, u.mensaje, 34, 92, { tam: 32, tamMin: 24, peso: 700, color: listo ? '#1b7f4f' : '#b35a00', maxAncho: w - 68, maxAlto: h - 110, interlineado: 1.16 });
  }

  _materialesListos() {
    this.m.audio.exito();
    this.cabecera.mensaje(this.t('materialesListos'), COLORES.verde);
    const b = this.boton(this.t('siguienteMedida'), () => {
      b.visible = false;
      this.m.entrada.habilitar(b, false);
      this._etapaMedida();
    }, { ancho: 0.56, alto: 0.13, color: COLORES.verde });
    b.position.set(0, this.H - 0.25, -1.3);
    b.lookAt(0, this.H, 0);
    this.raiz.add(b);
    this.m.fx.aparecer(b, 0.4, 0.4);
  }

  // ── Etapa 2: la medida del escalón ──────────────────────────────────────

  _etapaMedida() {
    const { H } = this;
    this.etapa = 'medida';
    // El estante y la mesa se apartan; aparece la simulación a tamaño real.
    this.m.fx.escalarA(this.estante, 0.001, 0.4).then(() => (this.estante.visible = false));
    this.m.fx.moverA(this.mesa, this.mesa.position.clone().add(V(0.9, 0, 0.35)), 0.6);
    this.cabecera.instruccion(this.datos.instruccionMedida ?? '');
    this.cabecera.mensaje('');
    this.cabecera.derecha(this.t('simulacion'));
    this.voz(this.datos.instruccionMedida);

    this.sim = new THREE.Group();
    this.sim.position.set(-0.1, 0, -2.2);
    this.raiz.add(this.sim);
    const piso = malla(new THREE.CircleGeometry(1.0, 40), mat('#5ff7ff', { tipo: 'basica', opacidad: 0.18 }), [0, 0.004, 0], [-Math.PI / 2, 0, 0]);
    piso.userData.noFusionar = true;
    this.sim.add(piso);
    // Bebedero visto de perfil (a la izquierda) y Camila frente a él.
    this.fuente = diseno.bebedero_doble();
    this.fuente.position.set(-0.42, 0, -0.27);
    this.fuente.rotation.y = Math.PI / 2;
    this.sim.add(this.fuente);
    this.cadaCuadro((_dt, t) => this.fuente.userData.animar(t));
    this.camila = persona({ peinado: 'colitas', estatura: 1.12, superior: '#2f4a8a', inferior: '#4d5566', cuello: '#ffffff', expresion: 'neutral' });
    this.camila.position.set(-0.04, 0, 0);
    this.camila.rotation.y = -Math.PI / 2;
    this.sim.add(this.camila);
    this.pose = {};
    this.cadaCuadro((dt, t) => {
      this.camila.userData.animar(t);
      posar(this.camila, this.pose, Math.min(1, dt * 6));
    });
    // Regla vertical para comparar alturas
    const regla = new PanelLienzo(0.1, 1.5, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#23304a';
      for (let cm = 0; cm <= 150; cm += 10) {
        const y = h - (cm / 150) * h;
        ctx.fillRect(0, y - 2, cm % 50 === 0 ? w * 0.7 : w * 0.4, 4);
      }
    });
    regla.position.set(0.42, 0.75, 0.05);
    this.sim.add(regla);
    this.escalon = null;
    this.m.fx.aparecer(this.sim, 0.6);

    // Opciones de altura
    const medidas = this.datos.medidas ?? [];
    this.botonesMedida = medidas.map((md, i) => {
      const b = this.boton(md.texto, () => this._probarMedida(md, b), { ancho: 0.27, alto: 0.12, color: '#ffffff', colorTexto: COLORES.texto, tam: 36 });
      // En columna, a la derecha: así no tapan a Camila.
      b.position.set(0.62, H + 0.16 - i * 0.15, -1.25);
      b.lookAt(0, H, 0);
      this.raiz.add(b);
      this.m.fx.aparecer(b, 0.4, 0.5 + i * 0.1);
      return b;
    });
  }

  _probarMedida(md, boton) {
    if (this.probando) return;
    this.probando = true;
    for (const b of this.botonesMedida) this.m.entrada.habilitar(b, false);
    // Nuevo escalón de la altura elegida (la maqueta mide 22 cm: se estira o encoge).
    if (this.escalon) {
      this.sim.remove(this.escalon);
    }
    this.escalon = this.modelo('maqueta_escalon', { normalizar: false, etapa: 5, cartelEn: 99 });
    this.escalon.scale.set(1, md.alto / 0.22, 1);
    this.escalon.position.set(0, 0, 0);
    this.escalon.rotation.y = Math.PI / 2;
    this.sim.add(this.escalon);
    this.m.fx.tween({ duracion: 0.5, curva: suavizado.rebote, alActualizar: (k) => this.escalon.scale.set(1, Math.max(0.01, (md.alto / 0.22) * k), 1) });
    this.m.fx.tween({ duracion: 0.6, alActualizar: (k) => (this.camila.position.y = md.alto * k) });
    this.m.audio.clac(this.posMundo(this.sim));
    this.pose = {};
    this.camila.userData.setExpresion('neutral');
    const pos = this.posMundo(boton);

    // Camila intenta beber con esa altura.
    this.esperar(0.9).then(async () => {
      if (this._destruida) return;
      if (md.correcta) {
        this.pose = { inclinacion: 0.12, cabeza: [0.3, 0, 0], brazoD: [-0.9, 0, -0.1] };
        this.fuente.userData.setAgua(0, true);
        this.camila.userData.setExpresion('feliz');
        boton.setModo('correcto');
        this.m.audio.acierto(pos);
        this.ganar(pos, this._fallosMedida ? 150 : 300);
        this.cabecera.mensaje(`✅ ${md.explicacion}`, COLORES.verde);
        const logro = this.datos.frases?.logro;
        if (logro) {
          this.camila.userData.fuenteHabla = () => this.m.audio.nivelVoz();
          await this.voz(logro.texto, logro.quien, { pos: this.camila.localToWorld(V(0, 1, 0)) });
          this.camila.userData.fuenteHabla = null;
        }
        await this.esperar(0.6);
        if (this._destruida) return;
        this.fuente.userData.setAgua(0, false);
        this.m.fx.confeti(this.posMundo(this.camila).add(V(0, 1.4, 0)), 90);
        this.m.audio.exito();
        this.cabecera.mensaje(this.datos.mensajeFinal ?? md.explicacion, COLORES.verde);
        if (this.datos.mensajeFinal) this.voz(this.datos.mensajeFinal);
        this.mostrarContinuar(V(0.62, this.H - 0.5, -1.25));
        return;
      }
      // No funciona: se muestra por qué (de puntitas o demasiado agachada).
      const bajo = md.alto < 0.2;
      this.pose = bajo ? { cuerpoY: 0.05, cabeza: [-0.4, 0, 0], brazoI: [-1.4, 0, 0.1], brazoD: [-1.4, 0, -0.1] } : { inclinacion: 0.3, cabeza: [0.55, 0, 0], brazoI: [0, 0, -0.9], brazoD: [0, 0, 0.9] };
      this.camila.userData.setExpresion(bajo ? 'triste' : 'sorpresa');
      boton.setModo('incorrecto');
      this.m.audio.error(pos);
      this.perder();
      this._fallosMedida = (this._fallosMedida ?? 0) + 1;
      this.cabecera.mensaje(`🤔 ${md.explicacion}`, COLORES.naranja);
      await this.esperar(1.6);
      if (this._destruida) return;
      this.probando = false;
      for (const b of this.botonesMedida) if (b.estado.modo === 'normal') this.m.entrada.habilitar(b, true);
    });
  }
}
