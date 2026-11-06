import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { barajar } from './clasificar.js';
import { PanelLienzo, COLORES, escribir, tarjeta, rectRedondeado } from '../ui/lienzo.js';
import { gallo } from '../mundo/prefabs/cafe.js';
import { posar, poseCaminar, mirarHacia } from '../mundo/prefabs/personas.js';
import { sombra } from '../mundo/materiales.js';
import { MOSTRADOR } from '../mundo/entornos-cafe.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

const METAS = [
  ['saludar', 'Greet', 'Saludar', '👋'],
  ['pedido', 'Order food', 'Pedir la comida', '🥪'],
  ['bebida', 'Find the drink', 'Identificar la bebida', '💧'],
  ['responder', 'Answer Coco', 'Responder a Coco', '💬'],
  ['comprobar', 'Check the tray', 'Comprobar la bandeja', '🍽'],
  ['despedirse', 'Say goodbye', 'Despedirse', '🙋'],
];

const QUIEN = { camarero: ['🐓', 'Coco'], cliente: ['🧒', 'Customer'], estudiante: ['🙂', 'You'] };
const { alto: ALTO } = MOSTRADOR;
const COCO = V(0, 0.58, -1.95);
const PIZARRA = V(-1.45, 1.75, -2.85);
const PUESTO_BANDEJA = V(0, ALTO, -1.17);
const CAMPANA = V(0.8, ALTO, -1.1);

/**
 * Coco's Café (inglés A1, entorno "cafeteria"). El estudiante vive la visita en primera
 * persona: toca la campanilla, saluda con la mano (se detecta el movimiento del mando),
 * toma y acerca los productos, le entrega a Coco lo que pide, arrastra tarjetas para armar
 * su pedido, toma su bebida del ala de Coco y la pone en su bandeja, elige su bandeja y se
 * despide con la mano. Coco (el gallo) mira al estudiante, escucha lo que apunta, sostiene y
 * entrega objetos con las alas y reacciona con gestos que no se repiten.
 * Ayuda en tres niveles ante un error: (1) pista y se repite la pregunta, (2) Coco señala la
 * respuesta, (3) se escucha el modelo y aparece la traducción. 💡 sube un nivel.
 * Registro por meta (solo en memoria): logrado solo o con ayuda, reintentos y usos de 🔊 💡 🌐.
 */
export class EscenaCafe extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.lin = d.lineas ?? {};
    this.prod = Object.fromEntries((d.productos ?? []).map((p) => [p.id, p]));
    this.traducir = false;
    this.fase = 0;
    this.paso = null;
    this.linea = null;
    this.revelado = true;
    this.repetible = null;
    this.mision = null;
    this.metaActual = 'saludar';
    this.ayuda = null;
    this.items = new Set();
    this.sostenidos = new Set();
    // Al volver o repetir una parte, la escena se recarga desde esa parte y conserva el registro.
    const previo = this.m.__cafe;
    this.m.__cafe = null;
    this.desde = previo?.desde ?? 0;
    this.reg = previo?.reg ?? Object.fromEntries(METAS.map(([id]) => [id, { hecho: false, errores: 0, ayuda: false, repetir: 0, pistas: 0, traduccion: 0 }]));
    this.inicio = previo?.inicio ?? performance.now();
    this.pasoEs = false;
    this._ultimoElogio = null;
    this._ultimoGesto = null;

    this._crearCoco();
    this._crearClientesFondo();

    // Globo de diálogo y cabecera (inglés; español solo con 🌐)
    this.burbuja = new PanelLienzo(0.92, 0.42, (ctx, w, h) => this._dibujarBurbuja(ctx, w, h));
    this.burbuja.position.set(-0.64, H + 0.17, -1.4);
    this.burbuja.lookAt(0, H, 0.2);
    this.raiz.add(this.burbuja);
    this.presentar(this.burbuja, 0.3);
    this.cabecera = new PanelLienzo(0.8, 0.44, (ctx, w, h) => this._dibujarCabecera(ctx, w, h));
    this.cabecera.position.set(0.68, H + 0.17, -1.38);
    this.cabecera.lookAt(0, H, 0.2);
    this.raiz.add(this.cabecera);
    this.presentar(this.cabecera, 0.4);

    this.zona = new THREE.Group();
    this.raiz.add(this.zona);
    this._crearHerramientas();

    // Campanilla de servicio
    this.campana = new THREE.Group();
    this.campana.position.copy(CAMPANA);
    const c = this.modelo('campana', { tamano: 0.15 });
    c.position.y = (c.userData.tam?.y ?? 0.1) / 2;
    this.campana.add(c, sombra(0.09, 0.35));
    this.raiz.add(this.campana);
    this.interactivo(this.campana, { proxy: true, alPasar: (v) => this._resaltar(this.campana, v), alSeleccionar: () => this._tocarCampana() });
    this.cadaCuadro(() => this._campanaPorProximidad());
  }

  // ── Coco ─────────────────────────────────────────────────────────────────

  _crearCoco() {
    this.coco = gallo();
    this.coco.position.copy(COCO);
    this.coco.rotation.y = Math.PI; // al llegar está de espaldas, ordenando la barra
    this.coco.userData.sinCabeceo = true;
    this.raiz.add(this.coco);
    this.presentar(this.coco, 0.1);
    this.cuerpoYaw = Math.PI;
    this.pose = 'limpiar';
    this.gestoActual = null;
    this.mirada = null;
    this.proximoReposo = 6;
    this.cadaCuadro((dt, t) => this._animarCoco(dt, t));
  }

  /** Gesto breve (segundos). Tipos: saludo, adios, celebra1-3, no, duda, asiente, senalar, alcanzar. */
  gesto(tipo, duracion = 1.2, objetivo = null) {
    this.gestoActual = { tipo, desde: this._t ?? 0, duracion, objetivo };
    this._ultimoGesto = tipo;
    const exp = { no: 'duda', duda: 'duda', saludo: 'sorpresa', celebra2: 'sorpresa', adios: 'feliz' }[tipo] ?? 'feliz';
    this.coco.userData.setExpresion(exp);
  }

  celebrar() {
    const tipo = azar(['celebra1', 'celebra2', 'celebra3'].filter((g) => g !== this._ultimoGesto));
    this.gesto(tipo, 1.3);
  }

  async elogio() {
    this.celebrar();
    const clave = azar(['elogio1', 'elogio2', 'elogio3', 'elogio4'].filter((k) => k !== this._ultimoElogio));
    this._ultimoElogio = clave;
    await this.decir(clave);
  }

  /** Mira un punto del mundo un rato (o al estudiante si es null). */
  mirar(punto, segundos = 1.5) {
    this.mirada = punto ? { punto: punto.clone(), hasta: (this._t ?? 0) + segundos } : null;
  }

  _animarCoco(dt, t) {
    this._t = t;
    const coco = this.coco;
    const a = coco.userData.articulaciones;
    coco.userData.animar(t);
    const s = 1 - Math.exp(-dt * 9);
    const g = this.gestoActual;
    const k = g ? (t - g.desde) / g.duracion : 1;
    if (g && k >= 1) {
      this.gestoActual = null;
      coco.userData.setExpresion('feliz');
    }
    const tipo = this.gestoActual?.tipo;
    const habla = Boolean(coco.userData.fuenteHabla) && this.m.audio.hablando;

    // Cuerpo: de espaldas al llegar; luego hacia el estudiante
    coco.rotation.y += (this.cuerpoYaw - coco.rotation.y) * (1 - Math.exp(-dt * 5));

    // Mirada: la cabeza sigue al estudiante (o lo que se indique) dentro de sus límites
    const cam = this.m.app.camara.getWorldPosition(V(0, 0, 0));
    let objetivo = cam;
    if (this.mirada && t < this.mirada.hasta) objetivo = this.mirada.punto;
    if (g?.objetivo && (tipo === 'senalar' || tipo === 'alcanzar')) objetivo = g.objetivo;
    const local = coco.worldToLocal(objetivo.clone());
    const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.87, 0.87);
    const pitch = THREE.MathUtils.clamp(-Math.atan2(local.y - 0.96, Math.hypot(local.x, local.z)), -0.35, 0.35);
    let cabY = Math.abs(coco.rotation.y - this.cuerpoYaw) > 0.3 ? 0 : yaw;
    let cabX = pitch + (habla ? Math.sin(t * 7) * 0.035 : 0);
    let cabZ = 0;

    // Alas, torso y salto
    let alaI = { x: 0, z: -0.12 };
    let alaD = { x: habla ? -0.3 : 0, z: habla ? 0.4 + Math.sin(t * 3.1) * 0.22 : 0.12 };
    let torsoX = 0;
    let torsoZ = 0;
    let salto = 0;
    let boina = 0;
    const apuntar = (lado, punto, extra = 0) => {
      const hombro = a.torso.localToWorld(V(lado * 0.215, 0.32, 0.01));
      const dir = punto.clone().sub(hombro).applyQuaternion(a.torso.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      return { z: Math.asin(THREE.MathUtils.clamp(dir.x, -1, 1)), x: Math.atan2(-dir.z, -dir.y) - extra };
    };
    // Poses que se mantienen mientras se espera algo
    if (this.pose === 'limpiar') {
      alaD = { x: -1.1 + Math.sin(t * 5) * 0.2, z: 0.3 + Math.cos(t * 5) * 0.25 };
      cabX = 0.25;
      cabY = 0;
    } else if (this.pose === 'ofrecer') {
      alaI = { x: -1.25, z: -0.18 };
      alaD = { x: -1.25, z: 0.18 };
    } else if (this.pose === 'pedir') {
      alaD = { x: -1.35, z: 0.05 };
    } else if (this.pose?.tipo === 'alcanzar') {
      const lado = this.pose.lado;
      const p = apuntar(lado, this.pose.punto);
      if (lado > 0) alaD = p;
      else alaI = p;
    }
    if (tipo === 'saludo' || tipo === 'adios') {
      alaD = { x: 0, z: 2.3 + Math.sin(t * 12) * 0.35 };
      if (tipo === 'adios') boina = Math.sin(Math.min(1, k) * Math.PI);
    } else if (tipo === 'celebra1') {
      alaD = { x: -0.3, z: 1.9 };
      cabX += Math.sin(k * Math.PI * 4) * 0.15;
    } else if (tipo === 'celebra2') {
      alaI = { x: 0, z: -2.3 - Math.sin(t * 14) * 0.2 };
      alaD = { x: 0, z: 2.3 + Math.sin(t * 14) * 0.2 };
      salto = Math.abs(Math.sin(k * Math.PI * 2)) * 0.07;
    } else if (tipo === 'celebra3') {
      const aplauso = Math.abs(Math.sin(t * 13)) * 0.35;
      alaI = { x: -1.3, z: 0.1 + aplauso };
      alaD = { x: -1.3, z: -0.1 - aplauso };
    } else if (tipo === 'no') {
      cabY = Math.sin(k * Math.PI * 5) * 0.35;
      cabZ = 0.1;
    } else if (tipo === 'duda') {
      cabZ = 0.3;
      alaD = { x: -0.6, z: 1.5 };
    } else if (tipo === 'asiente') {
      cabX += Math.sin(k * Math.PI * 2) * 0.2;
    } else if (tipo === 'senalar' || tipo === 'alcanzar') {
      const lado = g.objetivo.x >= coco.position.x ? 1 : -1;
      const p = apuntar(lado, g.objetivo);
      if (lado > 0) alaD = p;
      else alaI = p;
      if (tipo === 'alcanzar') torsoX = 0.18;
    } else if (tipo === 'mirarCarta') {
      const loc = coco.worldToLocal(PIZARRA.clone());
      cabY = THREE.MathUtils.clamp(Math.atan2(loc.x, loc.z), -0.87, 0.87);
      cabX = 0.05;
    } else if (tipo === 'boina') {
      alaD = { x: -0.9, z: 2.2 };
      boina = Math.sin(k * Math.PI) * 0.4;
    } else if (tipo === 'ladeo') {
      cabZ = Math.sin(k * Math.PI) * 0.28;
    } else if (tipo === 'plumas') {
      torsoZ = Math.sin(t * 28) * 0.05 * Math.sin(k * Math.PI);
    }

    // Microgestos en reposo (al azar, sin repetir el último)
    if (!this.gestoActual && !habla && this.pose === null && t > this.proximoReposo) {
      this.gesto(azar(['mirarCarta', 'boina', 'ladeo', 'plumas'].filter((x) => x !== this._ultimoGesto)), 1.4);
      this.proximoReposo = t + 5 + Math.random() * 4;
    }

    a.cabeza.rotation.y += (cabY - a.cabeza.rotation.y) * s;
    a.cabeza.rotation.x += (cabX - a.cabeza.rotation.x) * s;
    a.cabeza.rotation.z += (cabZ - a.cabeza.rotation.z) * s;
    a.alaI.rotation.x += (alaI.x - a.alaI.rotation.x) * s;
    a.alaI.rotation.z += (alaI.z - a.alaI.rotation.z) * s;
    a.alaD.rotation.x += (alaD.x - a.alaD.rotation.x) * s;
    a.alaD.rotation.z += (alaD.z - a.alaD.rotation.z) * s;
    a.torso.rotation.x += (torsoX - a.torso.rotation.x) * s;
    a.torso.rotation.z = torsoZ;
    a.boina.position.y = 0.33 + boina * 0.09;
    coco.position.y = COCO.y + salto;

    // Lo que Coco sostiene se mantiene derecho (no se inclina con el ala)
    const qRaiz = this.raiz.getWorldQuaternion(new THREE.Quaternion());
    for (const obj of this.sostenidos) {
      if (!obj.parent || obj.parent === this.raiz) continue;
      obj.quaternion.copy(obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qRaiz));
    }
  }

  /** Coco toma un objeto con un ala (aparece en su "mano"). lado: 1 derecha, -1 izquierda. */
  sostener(obj, lado) {
    const mano = lado > 0 ? this.coco.userData.manos.D : this.coco.userData.manos.I;
    mano.add(obj);
    obj.position.set(0, -0.02, 0.04);
    obj.scale.setScalar(0.001);
    this.m.fx.tween({ duracion: 0.3, alActualizar: (k) => obj.scale.setScalar(Math.max(0.001, k)) });
    this.sostenidos.add(obj);
    return obj;
  }

  /** Coco lleva un objeto (que sostiene o que aparece en su ala) hasta un punto o una bandeja. */
  async poner(obj, destino, { lado = destino.x >= 0 ? 1 : -1, en = null } = {}) {
    if (!this.sostenidos.has(obj)) this.sostener(obj, lado);
    const punto = en ? en.localToWorld(destino.clone()) : this.raiz.localToWorld(destino.clone());
    this.pose = { tipo: 'alcanzar', lado, punto: punto.clone().add(V(0, 0.08, 0)) };
    this.mirar(punto, 1.2);
    await this.esperar(0.55);
    if (this._destruida) return;
    this.sostenidos.delete(obj);
    const padre = en ?? this.raiz;
    padre.attach(obj);
    obj.quaternion.identity();
    const ini = obj.position.clone();
    await this.m.fx.tween({
      duracion: 0.3,
      alActualizar: (k) => {
        obj.position.lerpVectors(ini, destino, k);
        obj.position.y += Math.sin(k * Math.PI) * 0.04;
      },
    });
    this.m.audio.tono(520, 0.06, { volumen: 0.12, pos: punto });
    this.m.audio.tono(380, 0.08, { volumen: 0.08, retardo: 0.05, pos: punto });
    this.pose = null;
  }

  // ── Clientes ────────────────────────────────────────────────────────────

  _sentar(p, [x, z], [mx, mz]) {
    p.position.set(x, 0.47 - (p.userData.alturaCadera ?? 0.85), z);
    p.rotation.y = Math.atan2(mx - x, mz - z);
    posar(p, { piernaI: [-1.45, 0, 0.05], piernaD: [-1.45, 0, -0.05] }, 1);
    p.userData.sentado = true;
  }

  _crearClientesFondo() {
    this.fondo = (this.datos.clientesFondo ?? []).map((c, i) => {
      const p = this.crearPersona({ expresion: 'feliz', detalle: 'alto', ...c.opciones }, [0, 0, 0]);
      this._sentar(p, c.silla, c.mira);
      const taza = this.modelo('taza', { tamano: 0.1 });
      taza.position.set(c.mira[0] + (c.silla[0] < c.mira[0] ? -0.18 : 0.18), 0.8, c.mira[1]);
      this.raiz.add(taza);
      let proximo = 3 + i * 4;
      this.cadaCuadro((_dt, t) => {
        if (t > proximo) proximo = t + 7 + Math.random() * 5;
        const sorbo = t < proximo && t > proximo - 1.6 ? 1 : 0;
        if (!p.userData.aplaude) {
          posar(p, { brazoD: sorbo ? [-1.6, 0.3, 0.2] : [-0.7, 0, 0.1], brazoI: [-0.7, 0, -0.1], piernaI: [-1.45, 0, 0.05], piernaD: [-1.45, 0, -0.05] }, 0.08);
          p.userData.articulaciones.cabeza.rotation.y = Math.sin(t * 0.3 + i) * 0.3;
        }
      });
      return p;
    });
  }

  async _caminar(p, hacia, velocidad = 0.9) {
    const desde = p.position.clone();
    const dist = desde.distanceTo(hacia);
    await this.m.fx.tween({
      duracion: dist / velocidad,
      curva: (k) => k,
      alActualizar: (k) => {
        p.position.lerpVectors(desde, hacia, k);
        mirarHacia(p, hacia.x, hacia.z, 0.2);
        posar(p, poseCaminar(k * dist * 3.2, 0.5), 0.3);
      },
    });
    posar(p, {}, 0.5);
  }

  // ── Paneles ──────────────────────────────────────────────────────────────

  _dibujarBurbuja(ctx, w, h) {
    const l = this.linea;
    tarjeta(ctx, w, h - 30, { radio: 44, borde: '#f2c45a', grosor: 8 });
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w - 150, h - 34);
    ctx.lineTo(w - 70, h);
    ctx.lineTo(w - 70, h - 34);
    ctx.fill();
    if (!l) return;
    const [emoji, nombre] = QUIEN[l.quien] ?? ['💬', ''];
    escribir(ctx, `${emoji} ${nombre}`, 40, 30, { tam: 30, peso: 800, color: '#b06a1f' });
    const texto = l.oculto && !this.revelado ? l.en.replace(new RegExp(`\\b${l.oculto}\\b`, 'i'), '…') : l.en;
    const conEs = this.traducir && l.es && (!l.oculto || this.revelado);
    const fin = escribir(ctx, texto, 40, 76, { tam: 52, tamMin: 34, peso: 800, color: COLORES.texto, maxAncho: w - 80, maxAlto: conEs ? 200 : 290, interlineado: 1.12 });
    if (conEs) escribir(ctx, l.es, 40, fin + 12, { tam: 32, tamMin: 24, peso: 600, color: COLORES.suave, maxAncho: w - 80, maxAlto: h - fin - 50 });
  }

  _dibujarCabecera(ctx, w, h) {
    tarjeta(ctx, w, h, { fondo: '#23304a', radio: 40 });
    if (this.resultados) return this._dibujarResultados(ctx, w, h);
    const f = this.datos.fases?.[this.fase];
    ctx.fillStyle = '#f2c45a';
    rectRedondeado(ctx, 26, 22, 110, 50, 25);
    ctx.fill();
    escribir(ctx, `${this.fase + 1}/5`, 81, 48, { tam: 30, peso: 900, color: '#23304a', alinear: 'center', base: 'middle' });
    if (f) escribir(ctx, f.en + (this.traducir ? ` · ${f.es}` : ''), 152, 48, { tam: 36, tamMin: 24, peso: 900, color: '#ffffff', base: 'middle', maxAncho: w - 180 });
    let y = 96;
    if (this.mision) {
      ctx.fillStyle = '#fffbea';
      rectRedondeado(ctx, 28, y, w - 56, 140, 30);
      ctx.fill();
      escribir(ctx, '🎯', 70, y + 70, { tam: 54, alinear: 'center', base: 'middle' });
      this.mision.forEach((m, i) => {
        const x = 250 + i * 230;
        escribir(ctx, m.emoji, x, y + 70, { tam: 92, alinear: 'center', base: 'middle' });
        if (m.ok) escribir(ctx, '✅', x + 54, y + 112, { tam: 40, alinear: 'center', base: 'middle' });
        if (i === 0) escribir(ctx, '+', x + 115, y + 70, { tam: 60, peso: 900, color: '#23304a', alinear: 'center', base: 'middle' });
      });
      y += 156;
    }
    if (this.paso) {
      // El español de la instrucción aparece con 🌐 o solo si el estudiante lleva un rato sin avanzar.
      const conEs = this.traducir || this.pasoEs;
      y = escribir(ctx, this.paso.en, 30, y + 6, { tam: 44, tamMin: 30, peso: 800, color: '#ffe9a8', maxAncho: w - 60, maxAlto: conEs ? 110 : h - y - 20 });
      if (conEs) escribir(ctx, `🇪🇸 ${this.paso.es}`, 30, y + 4, { tam: 30, peso: 700, color: '#ffffff', maxAncho: w - 60 });
    }
  }

  _ponerPaso(clave) {
    this.paso = this.datos.pasos?.[clave] ?? null;
    this.cabecera.redibujar();
    this.m.fx.latido(this.cabecera, 0.03);
  }

  // ── Herramientas ─────────────────────────────────────────────────────────

  _crearHerramientas() {
    const { H } = this;
    const crear = (texto, accion, i, color) => {
      const b = this.boton(texto, accion, { ancho: 0.2, alto: 0.075, color, tam: 27 });
      b.position.set((i - 2.5) * 0.215, H - 0.5, -1.0 + Math.abs(i - 2.5) * 0.03);
      b.lookAt(0, H, 0.2);
      this.raiz.add(b);
      this.presentar(b, 0.5 + i * 0.05);
      return b;
    };
    crear('🔊 Again', () => this.repetir(), 0, '#2f4a8a');
    this.btnTraducir = crear('🌐 Español', () => this.alternarTraduccion(), 1, '#5b6886');
    crear('💡 Help', () => this.pedirAyuda(), 2, '#d98a00');
    crear('⏮ Back', () => this._confirmar('atras'), 3, '#5b6886');
    crear('↺ Restart', () => this._confirmar('repetir'), 4, '#5b6886');
    crear('⏏ Exit', () => this.salir(), 5, '#a33a4a');
  }

  /** Pregunta antes de volver a la parte anterior o repetir la actual (con ✓ / ✗ grandes). */
  _confirmar(accion) {
    this.dialogo?.removeFromParent();
    const { H } = this;
    const destino = accion === 'atras' ? Math.max(0, this.fase - 1) : this.fase;
    const g = new THREE.Group();
    g.position.set(0, H - 0.2, -0.85);
    g.lookAt(0, H, 0.2);
    const titulo = new PanelLienzo(0.62, 0.11, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#23304a', radio: 30 });
      const en = accion === 'atras' ? `⏮ Go back to part ${destino + 1}?` : `↺ Start part ${destino + 1} again?`;
      const es = accion === 'atras' ? `¿Volver a la parte ${destino + 1}?` : `¿Repetir la parte ${destino + 1}?`;
      escribir(ctx, en, w / 2, h * 0.38, { tam: 40, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30 });
      escribir(ctx, es, w / 2, h * 0.76, { tam: 26, color: '#c9d4ee', alinear: 'center', base: 'middle' });
    });
    titulo.position.set(0, 0.09, 0);
    g.add(titulo);
    const si = this.boton('✓ Yes', () => this._irAEtapa(destino), { ancho: 0.25, alto: 0.1, color: COLORES.verde, tam: 40 });
    const no = this.boton('✗ No', () => {
      this.m.entrada.desregistrar(si);
      this.m.entrada.desregistrar(no);
      g.removeFromParent();
      this.dialogo = null;
    }, { ancho: 0.25, alto: 0.1, color: '#a33a4a', tam: 40 });
    si.position.set(-0.15, -0.03, 0.01);
    no.position.set(0.15, -0.03, 0.01);
    g.add(si, no);
    this.raiz.add(g);
    this.m.fx.aparecer(g, 0.3);
    this.dialogo = g;
  }

  /** Vuelve a cargar la escena empezando en la parte `n`; conserva el registro y el tiempo. */
  _irAEtapa(n) {
    this.m.__cafe = { desde: n, reg: this.reg, inicio: this.inicio };
    this.m.irA(this.indice, true);
  }

  repetir() {
    this.reg[this.metaActual].repetir++;
    const l = this.repetible ?? this.linea;
    if (l) this.decir(l);
  }

  alternarTraduccion(valor = !this.traducir) {
    this.traducir = valor;
    if (valor) this.reg[this.metaActual].traduccion++;
    this.btnTraducir.estado.texto = valor ? '🌐 English' : '🌐 Español';
    this.btnTraducir.redibujar();
    this.burbuja.redibujar();
    this.cabecera.redibujar();
    for (const o of this.zona.children) o.userData.redibujar?.();
  }

  pedirAyuda() {
    if (!this.ayuda) return this.repetir();
    this.reg[this.metaActual].pistas++;
    this.reg[this.metaActual].ayuda = true;
    this.ayuda();
  }

  salir() {
    if (this.m.app.renderer.xr.isPresenting) this.m.app.salirVR();
    else document.getElementById('salir-pantalla')?.click();
  }

  // ── Voz ──────────────────────────────────────────────────────────────────

  /** Dice una línea (objeto o clave de "lineas"), la muestra en el globo y baja el ambiente. */
  async decir(l, { repetible = false } = {}) {
    if (typeof l === 'string') l = this.lin[l];
    if (!l || this._destruida) return;
    this.linea = l;
    if (repetible) this.repetible = l;
    this.burbuja.redibujar();
    this.m.fx.latido(this.burbuja, 0.03);
    this.m.audio.volumenAmbiente(0.3);
    try {
      if (l.quien === 'camarero') return await this.hablarPersona(this.coco, l.en, 'camarero');
      if (l.quien === 'cliente' && this.cliente) return await this.hablarPersona(this.cliente, l.en, 'cliente');
      const sono = await this.voz(l.en, l.quien);
      if (!sono && !this._destruida) await this.esperar(this.duracionVoz(l.en, l.quien));
    } finally {
      if (!this._destruida && !this.m.audio.hablando) this.m.audio.volumenAmbiente(1);
    }
  }

  // ── Interacción en primera persona ───────────────────────────────────────

  _resaltar(obj, v) {
    obj.userData.halo ??= (() => {
      const h = this.halo(0.26, '#ffd23c');
      h.position.y = 0.08;
      obj.add(h);
      return h;
    })();
    obj.userData.halo.userData.encendido = v;
    obj.scale.setScalar(v ? 1.12 : 1);
    if (v) this.m.audio.tono(1700, 0.025, { volumen: 0.03 });
  }

  /** Producto sobre el mostrador (base en el origen del nodo) con sombra y etiqueta. */
  _producto(id, pos, { tam = 0.17, padre = this.raiz } = {}) {
    const p = this.prod[id];
    const nodo = new THREE.Group();
    nodo.position.copy(pos);
    const m = this.modelo(p.modelo, { tamano: tam, ...(p.opciones ?? {}) });
    m.position.y = (m.userData.tam?.y ?? tam) / 2;
    nodo.add(m, sombra(tam * 0.55, 0.3));
    const etiqueta = { visible: false };
    const cartel = new PanelLienzo(0.2, 0.065, (ctx, w, h) => {
      if (!etiqueta.visible) return;
      rectRedondeado(ctx, 4, 4, w - 8, h - 8, 30);
      ctx.fillStyle = '#23304a';
      ctx.fill();
      const en = (p.tarjeta ?? p.nombre.en).replace(/\.$/, '');
      escribir(ctx, this.traducir ? `${en} · ${p.nombre.es.replace(/\.$/, '')}` : en, w / 2, h / 2, { tam: 38, tamMin: 22, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30 });
    });
    cartel.position.set(0, (m.userData.tam?.y ?? tam) + 0.06 + (Math.round(pos.x / 0.22) % 2 ? 0.07 : 0), 0);
    nodo.add(cartel);
    nodo.userData = { ...nodo.userData, producto: id, modelo: m, mostrarNombre: () => ((etiqueta.visible = true), cartel.redibujar()), ocultarNombre: () => ((etiqueta.visible = false), cartel.redibujar()), redibujar: () => cartel.redibujar() };
    padre.add(nodo);
    this.items.add(nodo);
    this.m.fx.aparecer(nodo, 0.35);
    return nodo;
  }

  _retirar(nodo, segundos = 0.35) {
    if (!nodo) return;
    this.items.delete(nodo);
    nodo.traverse((x) => this.m.entrada.desregistrar(x));
    this.m.fx.tween({ duracion: segundos, alActualizar: (k) => nodo.scale.setScalar(Math.max(0.001, 1 - k)), alTerminar: () => nodo.removeFromParent() });
  }

  /**
   * Hace que un objeto se pueda tomar con el gatillo (o el grip): se acerca a la mano para
   * mirarlo; al apuntar un destino y soltar, va allí. Un toque rápido cuenta como tocar.
   * opciones: { alTomar, alTocar, destinos: () => [{ id, punto (mundo), radio }], alSoltar(destino) }
   */
  _agarrable(nodo, { alTomar, alTocar, destinos = () => [], alSoltar } = {}) {
    let casa = null;
    let padreCasa = null;
    let desde = 0;
    let elegido = null;
    const volver = () => {
      if (!casa) return;
      padreCasa.attach(nodo);
      const ini = nodo.position.clone();
      this.m.fx.tween({ duracion: 0.35, alActualizar: (k) => nodo.position.lerpVectors(ini, casa, k) });
      nodo.quaternion.identity();
    };
    nodo.userData.volver = volver;
    nodo.userData.soltarEn = (id) => alSoltar?.(destinos().find((d) => d.id === id) ?? null, { volver });
    this.interactivo(nodo, {
      proxy: true,
      agarrable: true,
      alPasar: (v) => {
        this._resaltar(nodo, v);
        if (v) this.mirar(nodo.getWorldPosition(V(0, 0, 0)), 1.2);
      },
      alAgarrar: () => {
        desde = performance.now();
        padreCasa = nodo.parent;
        casa = nodo.position.clone();
        this.raiz.attach(nodo);
        this.m.audio.tono(660, 0.05, { volumen: 0.06 });
        alTomar?.();
      },
      alMoverAgarrado: (p) => {
        const cerca = p.origen.clone().addScaledVector(p.dir, p.tipo === 'raton' ? 0.55 : 0.32);
        nodo.position.copy(this.raiz.worldToLocal(cerca.sub(V(0, 0.05, 0))));
        // ¿Qué destino está apuntando?
        let mejor = null;
        for (const d of destinos()) {
          const v = d.punto.clone().sub(p.origen);
          const t = Math.max(0, v.dot(p.dir));
          const dist = d.punto.distanceTo(p.origen.clone().addScaledVector(p.dir, t));
          if (dist < d.radio && (!mejor || dist < mejor.dist)) mejor = { ...d, dist };
        }
        if (mejor?.id !== elegido?.id) {
          elegido?.resaltar?.(false);
          mejor?.resaltar?.(true);
          if (mejor) this.m.audio.tono(990, 0.03, { volumen: 0.04 });
        }
        elegido = mejor;
      },
      alSoltar: () => {
        const d = elegido;
        d?.resaltar?.(false);
        elegido = null;
        const rapido = performance.now() - desde < 280;
        if (!d && rapido && alTocar) return alTocar(volver);
        if (!alSoltar) return volver();
        alSoltar(d, { volver });
      },
    });
    return nodo;
  }

  // ── Campanilla y saludo con la mano ─────────────────────────────────────

  _tocarCampana() {
    const pos = this.posMundo(this.campana);
    [[2093, 0], [2637, 0.01], [4186, 0.02]].forEach(([f, r]) => this.m.audio.tono(f, 0.9, { volumen: 0.1, retardo: r, pos }));
    this.m.fx.latido(this.campana, 0.2);
    this.m.entrada.punteros.forEach((p) => p.activo && p.vibrar(0.5, 60));
    this.alCampana?.();
  }

  _campanaPorProximidad() {
    if (!this.alCampana || !this.m.app.enVR) return;
    const pos = this.posMundo(this.campana).add(V(0, 0.08, 0));
    for (const p of this.m.entrada.punteros) {
      if (p.tipo !== 'xr' || !p.activo || !p.objeto) continue;
      if (p.objeto.getWorldPosition(V(0, 0, 0)).distanceTo(pos) < 0.12) return this._tocarCampana();
    }
  }

  /** Espera que el estudiante mueva la mano de lado a lado (o toque 👋 en la vista previa). */
  _esperarOla(clave = null) {
    return new Promise((resolver) => {
      const { H } = this;
      const historia = new Map();
      let hecho = false;
      const parar = this._recordar({ clave, cada: 12 });
      const terminar = () => {
        if (hecho) return;
        hecho = true;
        parar();
        if (boton) {
          this.m.entrada.desregistrar(boton);
          boton.removeFromParent();
        }
        resolver();
      };
      let boton = null;
      const mostrarBoton = () => {
        if (hecho || boton) return;
        boton = this.boton('👋 Wave', terminar, { ancho: 0.3, alto: 0.12, color: '#21a366', tam: 44 });
        boton.position.set(0, H - 0.3, -0.95);
        boton.lookAt(0, H, 0.2);
        this.zona.add(boton);
        this.m.fx.aparecer(boton, 0.35);
      };
      if (!this.m.app.enVR) mostrarBoton();
      else this.esperar(7).then(mostrarBoton);
      this.cadaCuadro((_dt, t) => {
        if (hecho || !this.m.app.enVR) return;
        for (const p of this.m.entrada.punteros) {
          if (p.tipo !== 'xr' || !p.activo || !p.objeto) continue;
          const x = p.objeto.getWorldPosition(V(0, 0, 0)).x;
          const h = historia.get(p) ?? { x, dir: 0, cambios: [], extremo: x };
          const dx = x - h.extremo;
          const dir = Math.sign(dx);
          if (Math.abs(dx) > 0.06) {
            if (h.dir && dir !== h.dir) h.cambios.push(t);
            h.dir = dir;
            h.extremo = x;
          }
          h.cambios = h.cambios.filter((c) => t - c < 1.6);
          historia.set(p, h);
          if (h.cambios.length >= 2) {
            p.vibrar(0.4, 80);
            return terminar();
          }
        }
      });
    });
  }

  // ── Registro y ayudas ────────────────────────────────────────────────────

  _fallo(meta) {
    this.reg[meta].errores++;
    this.perder();
    this.gesto(azar(['no', 'duda']), 1.1);
  }

  _logro(meta, pos, puntos) {
    this.ganar(pos, puntos);
    if (this.reg[meta].hecho) return;
    this.reg[meta].hecho = true;
    this.cabecera.redibujar();
  }

  /**
   * Escalera de ayuda: nivel 1 → pista y repetir la pregunta; 2 → Coco señala la respuesta;
   * 3 → se escucha el modelo y aparece la traducción. Los niveles 2 y 3 cuentan como ayuda.
   */
  async _ayudar(meta, nivel, { retro, pregunta, objetivo, modelo, resaltar }) {
    if (nivel === 1) {
      if (retro) await this.decir(retro);
      if (pregunta) await this.decir(pregunta, { repetible: true });
      return;
    }
    this.reg[meta].ayuda = true;
    resaltar?.(true);
    if (objetivo) this.gesto('senalar', 2.2, objetivo());
    await this.decir('mira');
    if (nivel >= 3) {
      if (!this.traducir) this.alternarTraduccion(true);
      this.revelado = true;
      this.burbuja.redibujar();
      if (modelo) await this.decir(modelo);
    }
  }

  // ── Elegir expresiones (máximo 3) ────────────────────────────────────────

  _opcion(en, es, alTocar, { ancho = 0.54, alto = 0.17, color = '#ffffff', agarrable = false } = {}) {
    const estado = { encima: false, modo: 'normal', resaltar: false, en, es };
    const panel = new PanelLienzo(ancho, alto, (ctx, w, h) => {
      const fondo = { normal: estado.encima ? '#fff2c2' : color, correcto: COLORES.verde, incorrecto: COLORES.rojo, apagado: '#c9d0e0' }[estado.modo];
      rectRedondeado(ctx, 6, 14, w - 12, h - 18, 40);
      ctx.fillStyle = 'rgba(10, 20, 45, 0.3)';
      ctx.fill();
      rectRedondeado(ctx, 6, 6, w - 12, h - 18, 40);
      ctx.fillStyle = fondo;
      ctx.fill();
      if (estado.resaltar || estado.encima) {
        ctx.lineWidth = estado.resaltar ? 14 : 10;
        ctx.strokeStyle = estado.resaltar ? '#ffb000' : '#2f8be6';
        ctx.stroke();
      }
      const blanco = estado.modo !== 'normal';
      const conEs = this.traducir && estado.es;
      escribir(ctx, estado.en, w / 2, conEs ? h * 0.38 : h * 0.47, { tam: 48, tamMin: 30, peso: 800, color: blanco ? '#ffffff' : COLORES.texto, alinear: 'center', base: 'middle', maxAncho: w - 50 });
      if (conEs) escribir(ctx, estado.es, w / 2, h * 0.72, { tam: 28, peso: 600, color: blanco ? '#ffffff' : COLORES.suave, alinear: 'center', base: 'middle', maxAncho: w - 50 });
    });
    panel.userData.redibujar = () => panel.redibujar();
    panel.userData.opcion = estado;
    if (!agarrable) {
      this.interactivo(panel, {
        alPasar: (v) => {
          estado.encima = v;
          panel.redibujar();
          if (v) {
            this.mirar(panel.getWorldPosition(V(0, 0, 0)), 1.2);
            this.m.audio.tono(1700, 0.025, { volumen: 0.03 });
          }
        },
        alSeleccionar: () => {
          if (estado.modo !== 'normal') return;
          this.m.audio.pop(this.posMundo(panel));
          alTocar();
        },
      });
    }
    let pulso = null;
    return {
      obj: panel,
      estado,
      marcar: (modo) => {
        estado.modo = modo;
        panel.redibujar();
      },
      resaltar: (v) => {
        estado.resaltar = v;
        panel.redibujar();
        pulso?.();
        pulso = v ? this._pulsar(panel) : null;
      },
      habilitar: (v) => this.m.entrada.habilitar(panel, v),
    };
  }

  /** Late un objeto (tamaño normal 1) hasta llamar a la función devuelta. */
  _pulsar(obj, base = 1) {
    let activo = true;
    // Siempre sobre un tamaño fijo: si el objeto está apareciendo (escala ~0), no debe quedar invisible.
    this.cadaCuadro((_dt, t) => {
      if (activo) obj.scale.setScalar(base * (1 + Math.max(0, Math.sin(t * 6)) * 0.08));
    });
    return () => {
      activo = false;
      obj.scale.setScalar(base);
    };
  }

  _limpiarZona() {
    for (const o of [...this.zona.children]) {
      o.traverse((x) => this.m.entrada.desregistrar(x));
      o.removeFromParent();
    }
    this.ayuda = null;
  }

  _posFila(i, n, { y = this.H - 0.37, separacion = 0.58, z = -0.92 } = {}) {
    const x = (i - (n - 1) / 2) * separacion;
    return V(x, y, z + Math.abs(x) * 0.12);
  }

  /**
   * Elegir una expresión. Se escucha la opción elegida; Coco asiente y responde.
   * alErrar(op) permite una consecuencia visible (p. ej. Coco levanta la bebida pedida).
   */
  _elegir(meta, grupo, { pregunta, alErrar } = {}) {
    this.metaActual = meta;
    const lista = barajar(this.datos.preguntas?.[grupo] ?? []).slice(0, 3);
    const parar = this._recordar({ clave: pregunta, cada: 15 });
    return new Promise((resolver) => {
      let errores = 0;
      let bloqueado = false;
      const items = lista.map((op, i) => {
        const it = this._opcion(op.en, op.es, () => elegir(it, op));
        it.obj.position.copy(this._posFila(i, lista.length));
        it.obj.lookAt(0, this.H, 0.2);
        this.zona.add(it.obj);
        this.m.fx.aparecer(it.obj, 0.35, 0.1 + i * 0.08);
        return Object.assign(it, { op });
      });
      const correctas = items.filter((x) => x.op.correcta);
      const contexto = (nivel, op) => ({
        retro: op?.retro,
        pregunta,
        objetivo: () => correctas[0].obj.getWorldPosition(V(0, 0, 0)),
        modelo: correctas[0].op,
        resaltar: (v) => correctas.forEach((c) => c.resaltar(v)),
      });
      this.ayuda = () => this._ayudar(meta, Math.max(2, errores + 1), contexto(2));
      const elegir = async (it, op) => {
        if (bloqueado) return;
        bloqueado = true;
        items.forEach((x) => x.habilitar(false));
        this.gesto('asiente', 0.6);
        await this.decir(op);
        if (this._destruida) return;
        if (op.correcta) {
          it.marcar('correcto');
          correctas.forEach((c) => c.resaltar(false));
          this.m.audio.acierto(this.posMundo(it.obj));
          this._logro(meta, it.obj, errores ? 50 : 100);
          parar();
          await this.esperar(0.35);
          this._limpiarZona();
          resolver(op);
          return;
        }
        errores++;
        it.fallado = true;
        it.marcar('incorrecto');
        this.m.audio.error(this.posMundo(it.obj));
        this._fallo(meta);
        await alErrar?.(op);
        await this._ayudar(meta, Math.min(3, errores), contexto(errores, op));
        if (this._destruida) return;
        it.marcar('apagado');
        items.forEach((x) => !x.fallado && x.habilitar(true));
        bloqueado = false;
      };
    });
  }

  // ── Armar la frase arrastrando tarjetas ──────────────────────────────────

  _ordenar(meta, partes, pedido, { guias = true } = {}) {
    this.metaActual = meta;
    const { H } = this;
    return new Promise((resolver) => {
      const llenas = [null, null, null];
      let errores = 0;
      const resaltados = new Set();
      const slots = new PanelLienzo(1.3, 0.18, (ctx, w, h) => {
        const ancho = (w - 80) / 3;
        partes.forEach((_p, i) => {
          const x = 20 + i * (ancho + 20);
          rectRedondeado(ctx, x, 14, ancho, 120, 26);
          ctx.fillStyle = llenas[i] ? '#e8f7ee' : resaltados.has(i) ? '#fff2c2' : 'rgba(255,255,255,0.92)';
          ctx.fill();
          ctx.lineWidth = resaltados.has(i) ? 12 : 5;
          ctx.strokeStyle = llenas[i] ? COLORES.verde : resaltados.has(i) ? '#ffb000' : '#9aa6c2';
          ctx.setLineDash(llenas[i] ? [] : [18, 12]);
          ctx.stroke();
          ctx.setLineDash([]);
          if (llenas[i]) escribir(ctx, llenas[i], x + ancho / 2, 74, { tam: 46, tamMin: 28, peso: 800, color: COLORES.texto, alinear: 'center', base: 'middle', maxAncho: ancho - 20 });
          else if (guias) escribir(ctx, String(i + 1), x + ancho / 2, 74, { tam: 54, peso: 900, color: '#c3cbe0', alinear: 'center', base: 'middle' });
        });
        if (this.traducir && pedido?.es) escribir(ctx, pedido.es, w / 2, 160, { tam: 26, peso: 600, color: '#ffffff', alinear: 'center', base: 'middle' });
      });
      slots.position.set(0, H - 0.08, -1.02);
      slots.lookAt(0, H, 0.2);
      slots.userData.redibujar = () => slots.redibujar();
      this.zona.add(slots);
      this.m.fx.aparecer(slots, 0.35);
      const puntoSlot = (i) => slots.localToWorld(V(-0.43 + i * 0.43, 0.01, 0.02));
      const marcarSlot = (i, v) => {
        if (v) resaltados.add(i);
        else resaltados.delete(i);
        slots.redibujar();
      };

      let orden = barajar(partes);
      for (let k = 0; k < 5 && orden.every((p, i) => p === partes[i]); k++) orden = barajar(partes);
      const siguiente = () => llenas.findIndex((x) => !x);
      const tarjetas = orden.map((texto, i) => {
        const t = this._opcion(texto, null, null, { ancho: 0.38, alto: 0.14, color: '#fff4cc', agarrable: true });
        t.texto = texto;
        t.obj.position.copy(this._posFila(i, orden.length, { separacion: 0.44 }));
        t.obj.lookAt(0, H, 0.2);
        this.zona.add(t.obj);
        this.m.fx.aparecer(t.obj, 0.35, 0.15 + i * 0.08);
        this._agarrable(t.obj, {
          alTocar: (volver) => colocar(t, siguiente(), volver),
          destinos: () => [0, 1, 2].filter((i) => !llenas[i]).map((i) => ({ id: i, punto: puntoSlot(i), radio: 0.2, resaltar: (v) => marcarSlot(i, v) })),
          alSoltar: (d, { volver }) => (d ? colocar(t, d.id, volver) : volver()),
        });
        return t;
      });
      const resaltarCorrecta = () => {
        const i = siguiente();
        const t = tarjetas.find((x) => x.texto === partes[i] && !x.puesta);
        tarjetas.forEach((x) => x.resaltar(x === t));
        if (t) this.gesto('senalar', 2, t.obj.getWorldPosition(V(0, 0, 0)));
      };
      this.ayuda = () => {
        this.reg[meta].ayuda = true;
        resaltarCorrecta();
      };
      const siguienteTarjeta = () => tarjetas.find((x) => x.texto === partes[siguiente()] && !x.puesta)?.obj;
      let pararTarjetas = this._recordar({ clave: 'conTarjetas', objetivo: guias ? () => siguienteTarjeta()?.getWorldPosition(V(0, 0, 0)) ?? slots.getWorldPosition(V(0, 0, 0)) : null });

      const colocar = async (t, i, volver = () => t.obj.userData.volver?.()) => {
        if (i < 0) return;
        if (t.texto === partes[i]) {
          llenas[i] = t.texto;
          t.puesta = true;
          t.resaltar(false);
          this.m.entrada.desregistrar(t.obj);
          this.m.audio.tono(700 + i * 160, 0.12, { volumen: 0.12 });
          this.m.fx.tween({ duracion: 0.25, alActualizar: (k) => t.obj.scale.setScalar(Math.max(0.001, 1 - k)), alTerminar: () => (t.obj.visible = false) });
          slots.redibujar();
          if (llenas.every(Boolean)) confirmar();
          return;
        }
        volver();
        errores++;
        t.marcar('incorrecto');
        this.m.audio.error(this.posMundo(t.obj));
        this._fallo(meta);
        setTimeout(() => !this._destruida && t.marcar('normal'), 450);
        const nivel = Math.min(3, errores);
        if (nivel === 1) await this.decir(`pista${siguiente() + 1}`);
        else {
          this.reg[meta].ayuda = true;
          resaltarCorrecta();
          await this.decir(`pista${siguiente() + 1}`);
        }
      };

      const confirmar = () => {
        this.ayuda = null;
        pararTarjetas();
        const b = this._opcion('✔ Ask Coco', 'Pedir', async () => {
          b.habilitar(false);
          b.marcar('correcto');
          await this.decir(pedido);
          this.m.audio.acierto(this.posMundo(b.obj));
          pararTarjetas();
          this._logro(meta, b.obj, errores ? 60 : 150);
          await this.esperar(0.2);
          this._limpiarZona();
          resolver();
        }, { ancho: 0.44, alto: 0.15, color: '#bff0d4' });
        b.obj.position.set(0, H - 0.37, -0.92);
        b.obj.lookAt(0, H, 0.2);
        this.zona.add(b.obj);
        this.m.fx.aparecer(b.obj, 0.35);
        b.resaltar(true);
        pararTarjetas = this._recordar({ objetivo: () => b.obj.getWorldPosition(V(0, 0, 0)), cada: 10 });
      };
    });
  }

  // ── Bandejas ─────────────────────────────────────────────────────────────

  _nuevaBandeja(color = '#b5773f') {
    const b = new THREE.Group();
    const m = this.modelo('bandeja', { tamano: 0.42, color });
    m.position.y = (m.userData.tam?.y ?? 0.035) / 2;
    b.add(m, sombra(0.26, 0.3));
    b.userData.huecos = [V(-0.1, 0.03, 0.01), V(0.11, 0.03, 0.01)];
    b.userData.contenido = [];
    return b;
  }

  /** Coco pone algo en una bandeja (hueco libre). */
  async _ponerEnBandeja(bandeja, id, lado) {
    const p = this.prod[id];
    const obj = this._producto(id, V(0, 0, 0), { tam: p.tipo === 'bebida' ? 0.15 : 0.17, padre: this.raiz });
    this.raiz.remove(obj);
    const hueco = bandeja.userData.huecos[bandeja.userData.contenido.length] ?? V(0, 0.03, 0);
    bandeja.userData.contenido.push(id);
    await this.poner(obj, hueco.clone(), { lado: lado ?? (bandeja.position.x >= 0 ? 1 : -1), en: bandeja });
    return obj;
  }

  // ── Las cinco etapas ─────────────────────────────────────────────────────

  async vozInicial() {
    const etapas = [() => this.llegada(), () => this.descubrir(), () => this.primerPedido(), () => this.misionFinal(), () => this.bandejaYDespedida()];
    try {
      await this.esperar(0.5);
      if (this.desde > 0) this._prepararDesde(this.desde);
      for (let i = this.desde; i < etapas.length; i++) await etapas[i]();
    } catch (e) {
      if (!this._destruida) throw e;
    }
  }

  /** Deja la cafetería como estaría al empezar la parte `n` (al volver o repetir una parte). */
  _prepararDesde(n) {
    this.alCampana = null;
    this.m.entrada.desregistrar(this.campana);
    this.cuerpoYaw = 0;
    this.coco.rotation.y = 0;
    this.pose = null;
    this.revelado = true;
    this._ponerCarta(this._crearCarta());
    if (n >= 4) {
      const mi = this.datos.mision;
      this.mision = [mi.comida, mi.bebida].map((id) => ({ id, emoji: this.prod[id].emoji, ok: true }));
      this._ponerTarjetaMision(this._crearTarjetaMision());
      this.bandeja = this._nuevaBandeja();
      this.bandeja.position.copy(PUESTO_BANDEJA);
      this.raiz.add(this.bandeja);
      for (const id of [mi.comida, mi.bebida]) {
        const p = this.prod[id];
        const hueco = this.bandeja.userData.huecos[this.bandeja.userData.contenido.length];
        this._producto(id, hueco, { tam: p.tipo === 'bebida' ? 0.15 : 0.17, padre: this.bandeja });
        this.bandeja.userData.contenido.push(id);
      }
    }
    this.cabecera.redibujar();
  }

  _crearCarta() {
    return new PanelLienzo(0.36, 0.26, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#25302b', radio: 30, borde: '#c98a45', grosor: 10 });
      escribir(ctx, 'MENU', w / 2, 46, { tam: 50, peso: 900, color: '#ffe9a8', alinear: 'center', base: 'middle' });
      this.datos.productos.forEach((p, i) => {
        const col = p.tipo === 'comida' ? 0 : 1;
        const fila = this.datos.productos.filter((x, j) => x.tipo === p.tipo && j < i).length;
        escribir(ctx, `${p.emoji} ${(p.tarjeta ?? p.nombre.en).replace(/\.$/, '').replace(/^an? /, '')}`, 30 + col * 180, 104 + fila * 40, { tam: 30, peso: 700, color: '#ffffff', base: 'middle' });
      });
    });
  }

  /** La carta queda de pie sobre el mostrador, mirando al estudiante; se puede tomar y acercar. */
  _ponerCarta(carta) {
    if (!carta.parent || carta.parent !== this.raiz) {
      carta.position.set(-0.55, ALTO + 0.14, -1.12);
      this.raiz.add(carta);
    }
    carta.lookAt(this.raiz.worldToLocal(this.m.app.camara.getWorldPosition(V(0, 0, 0))));
    this._agarrable(carta, { alSoltar: (_d, { volver }) => volver() });
    this.carta = carta;
  }

  _crearTarjetaMision() {
    return new PanelLienzo(0.34, 0.17, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#fffbea', radio: 26, borde: '#f2c45a', grosor: 10 });
      escribir(ctx, `🎯 ${this.mision.map((m) => m.emoji).join(' + ')}`, w / 2, h / 2, { tam: 66, alinear: 'center', base: 'middle', maxAncho: w - 30 });
    });
  }

  _ponerTarjetaMision(tarjetaMision) {
    if (!tarjetaMision.parent || tarjetaMision.parent !== this.raiz) {
      tarjetaMision.position.set(0.5, ALTO + 0.1, -1.12);
      this.raiz.add(tarjetaMision);
    }
    tarjetaMision.lookAt(this.raiz.worldToLocal(this.m.app.camara.getWorldPosition(V(0, 0, 0))));
    this._agarrable(tarjetaMision, { alSoltar: (_d, { volver }) => volver() });
    this.tarjetaMision = tarjetaMision;
  }

  /**
   * Recordatorio mientras el estudiante no avanza: una mano 👆 señala qué tocar y, cada
   * `cada` segundos sin progreso, Coco repite la indicación (y señala) y la instrucción
   * aparece también en español. Devuelve la función que lo detiene.
   */
  _recordar({ clave = null, objetivo = null, cada = 12 } = {}) {
    let activo = true;
    let senal = objetivo ? this._senal(objetivo()) : null;
    let proximo = (this._t ?? 0) + cada;
    this.cadaCuadro((_dt, t) => {
      if (!activo) return;
      const ocupado = this.m.audio.hablando || this.m.entrada.punteros.some((p) => p.agarrado) || this.dialogo;
      if (ocupado) {
        proximo = Math.max(proximo, t + 4);
        return;
      }
      if (t < proximo) return;
      proximo = t + cada;
      this.pasoEs = true;
      this.cabecera.redibujar();
      this.m.fx.latido(this.cabecera, 0.05);
      if (objetivo) {
        const p = objetivo();
        this.gesto('senalar', 2, p);
        senal?.removeFromParent();
        senal = this._senal(p);
      }
      if (clave) this.decir(clave);
    });
    return () => {
      activo = false;
      senal?.removeFromParent();
      if (this.pasoEs) {
        this.pasoEs = false;
        this.cabecera.redibujar();
      }
    };
  }

  _etapa(n) {
    this.fase = n;
    this.paso = null;
    this.cabecera.redibujar();
    this.m.audio.tono(880, 0.1, { volumen: 0.06 });
    this.m.audio.tono(1320, 0.14, { volumen: 0.06, retardo: 0.1 });
  }

  _senal(punto) {
    const s = new PanelLienzo(0.14, 0.14, (ctx, w, h) => escribir(ctx, '👆', w / 2, h / 2, { tam: 110, alinear: 'center', base: 'middle' }));
    const base = this.raiz.worldToLocal(punto.clone()).add(V(0, 0.2, 0));
    s.position.copy(base);
    s.lookAt(0, this.H, 0.2);
    this.raiz.add(s);
    this.cadaCuadro((_dt, t) => (s.position.y = base.y + Math.abs(Math.sin(t * 4)) * 0.05));
    return s;
  }

  async llegada() {
    this._etapa(0);
    this.metaActual = 'saludar';
    // Campanilla de la puerta: el estudiante acaba de entrar
    const puerta = this.m.entorno?.api?.puerta ?? V(3.4, 0, 1.7);
    [[1568, 0], [2093, 0.12], [1568, 0.3]].forEach(([f, r]) => this.m.audio.tono(f, 0.5, { volumen: 0.07, retardo: r, pos: puerta.clone().add(V(0, 2.2, 0)) }));
    await this.esperar(0.8);
    this._ponerPaso('llegada');
    const senal = this._senal(this.posMundo(this.campana));
    this.m.fx.latido(this.campana, 0.2);
    const pararCampana = this._recordar({ cada: 10 });
    await new Promise((r) => (this.alCampana = r));
    pararCampana();
    this.alCampana = null;
    this.m.entrada.desregistrar(this.campana);
    senal.removeFromParent();
    // Coco se da vuelta, sorprendido
    this.pose = null;
    this.cuerpoYaw = 0;
    this.coco.userData.setExpresion('sorpresa');
    await this.esperar(0.6);
    this.gesto('saludo', 2.2);
    await this.decir('hola', { repetible: true });
    this._ponerPaso('saludo');
    await this._elegir('saludar', 'saludo', { pregunta: 'hola' });
    this.gesto('celebra1', 1);
    await this.decir('saludaConMano', { repetible: true });
    this._ponerPaso('ola');
    await this._esperarOla('saludaConMano');
    this.gesto('saludo', 1.6);
    this.m.audio.acierto(this.posMundo(this.coco));
    this.ganar(this.coco, 50);
    // Coco ofrece la carta
    const carta = this._crearCarta();
    this.sostener(carta, -1);
    await this.decir('carta');
    await this.poner(carta, V(-0.55, ALTO + 0.14, -1.12), { lado: -1 });
    this._ponerCarta(carta);
  }

  async descubrir() {
    this._etapa(1);
    this._ponerPaso('explora');
    const ids = this.datos.productos.map((p) => p.id);
    const vistos = new Set();
    let listo;
    const terminado = new Promise((r) => (listo = r));
    let boton = null;
    const nodos = ids.map((id, i) => {
      const nodo = this._producto(id, V(-0.66 + i * 0.22, ALTO, -1.32), { tam: 0.15 });
      const nombrar = async () => {
        nodo.userData.mostrarNombre();
        if (!vistos.has(id)) this.ganar(nodo, 20);
        vistos.add(id);
        await this.decir(this.prod[id].nombre);
        if (vistos.size >= 5 && !boton) {
          boton = this.boton(`Ready ▶`, () => listo(), { ancho: 0.34, alto: 0.12, color: COLORES.verde, tam: 42 });
          boton.position.set(0.68, this.H - 0.16, -1.2);
          boton.lookAt(0, this.H, 0.2);
          this.zona.add(boton);
          this.m.fx.aparecer(boton, 0.4);
        }
        if (vistos.size === ids.length) listo();
      };
      this._agarrable(nodo, { alTomar: nombrar, alTocar: (volver) => volver(), alSoltar: (_d, { volver }) => volver() });
      return nodo;
    });
    this.gesto('senalar', 1.6, this.posMundo(nodos[3]));
    await this.decir('toma', { repetible: true });
    const pararToma = this._recordar({ clave: 'toma', objetivo: () => this.posMundo(nodos.find((n) => !vistos.has(n.userData.producto)) ?? nodos[0]) });
    await terminado;
    pararToma();
    this._limpiarZona();
    nodos.forEach((n) => this._retirar(n));

    // Pedido modelo: entra un cliente, pide, Coco lo sirve en su bandeja y se va a una mesa
    this._ponerPaso('modelo');
    const m = this.datos.modelo;
    const puerta = this.m.entorno?.api?.puerta ?? V(3.4, 0, 1.7);
    [[1568, 0], [2093, 0.12]].forEach(([f, r]) => this.m.audio.tono(f, 0.5, { volumen: 0.07, retardo: r, pos: puerta.clone().add(V(0, 2.2, 0)) }));
    this.cliente = this.crearPersona({ expresion: 'feliz', ...m.cliente }, [puerta.x, 0, puerta.z]);
    this.gestosAlHablar(this.cliente);
    const cabezaCliente = () => this.cliente.localToWorld(V(0, this.cliente.userData.alturaOjos ?? 1.1, 0));
    this.mirar(this.posMundo(this.cliente).add(V(0, 1.1, 0)), 3);
    this.decir('otroCliente');
    await this._caminar(this.cliente, V(0.85, 0, -0.62));
    mirarHacia(this.cliente, 0, -1.95, 1);
    this.mirar(cabezaCliente(), 8);
    await this.decir('clientePide');
    const bandejaCliente = this._nuevaBandeja('#8a5a36');
    this.sostener(bandejaCliente, 1);
    await this.poner(bandejaCliente, V(0.55, ALTO, -1.18), { lado: 1 });
    await this._ponerEnBandeja(bandejaCliente, m.producto, 1);
    await this.decir('seguro');
    await this.decir('clienteGracias');
    // El cliente toma su bandeja y se sienta atrás
    this.cliente.attach(bandejaCliente);
    this.m.fx.moverA(bandejaCliente, V(0, 0.75, 0.28), 0.4);
    posar(this.cliente, { brazoI: [-1.2, 0, 0.1], brazoD: [-1.2, 0, -0.1] }, 1);
    this.mirar(null);
    const cliente = this.cliente;
    this.cliente = null;
    this._caminar(cliente, V(1.7, 0, 1.3)).then(() => this._caminar(cliente, V(-0.57, 0, 2.7))).then(() => {
      if (this._destruida) return;
      this.raiz.attach(bandejaCliente);
      this.m.fx.moverA(bandejaCliente, V(-1.2, 0.76, 2.7), 0.3);
      this._sentar(cliente, [-0.58, 2.7], [-1.2, 2.7]);
    });

    // Escucha: «Please, give me the …» y el estudiante le entrega a Coco la bebida
    this._ponerPaso('escucha');
    this.metaActual = 'bebida';
    const e = this.datos.escucha;
    const opciones = barajar(e.opciones);
    const bebidas = opciones.map((id, i) => this._producto(id, V(-0.36 + i * 0.36, ALTO, -1.26), { tam: 0.16 }));
    this.revelado = false;
    this.pose = 'pedir';
    await this.decir('dame', { repetible: true });
    const pararDame = this._recordar({ clave: 'dame', cada: 15 });
    const manoCoco = () => this.coco.userData.manos.D.getWorldPosition(V(0, 0, 0));
    let errores = 0;
    await new Promise((resolver) => {
      let ocupado = false;
      const correcta = () => bebidas.find((b) => b.userData.producto === e.objetivo);
      const contexto = (op) => ({
        retro: op ? this.prod[op].noEs : null,
        pregunta: 'dame',
        objetivo: () => this.posMundo(correcta()),
        modelo: null,
        resaltar: (v) => this._resaltar(correcta(), v),
      });
      this.ayuda = () => this._ayudar('bebida', Math.max(2, errores + 1), contexto(null));
      const entregar = async (nodo, volver) => {
        if (ocupado) return volver?.();
        ocupado = true;
        const id = nodo.userData.producto;
        if (id === e.objetivo) {
          this.items.delete(nodo);
          nodo.traverse((x) => this.m.entrada.desregistrar(x));
          this.revelado = true;
          this.burbuja.redibujar();
          this.sostener(nodo, 1);
          nodo.scale.setScalar(1);
          this.m.audio.acierto(manoCoco());
          pararDame();
          this._logro('bebida', nodo, errores ? 50 : 100);
          this.pose = null;
          this.celebrar();
          await this.decir('graciasJugo');
          this.sostenidos.delete(nodo);
          this._retirar(nodo);
          resolver();
          return;
        }
        volver?.();
        errores++;
        this.m.audio.error(this.posMundo(nodo));
        this._fallo('bebida');
        await this._ayudar('bebida', Math.min(3, errores), contexto(id));
        ocupado = false;
      };
      for (const b of bebidas) {
        this._agarrable(b, {
          alTomar: () => this.mirar(this.posMundo(b), 1),
          alTocar: (volver) => entregar(b, volver),
          destinos: () => [{ id: 'coco', punto: manoCoco(), radio: 0.35 }],
          alSoltar: (d, { volver }) => (d ? entregar(b, volver) : volver()),
        });
      }
    });
    this.pose = null;
    bebidas.forEach((b) => this.items.has(b) && this._retirar(b));
    this.ayuda = null;
  }

  async primerPedido() {
    const g = this.datos.guiado;
    this._etapa(2);
    // Coco pone la bandeja del estudiante
    this.bandeja = this._nuevaBandeja();
    this.sostener(this.bandeja, -1);
    await this.poner(this.bandeja, PUESTO_BANDEJA.clone(), { lado: -1 });
    await this.decir('bandeja');
    this._ponerPaso('eligeComida');
    this.metaActual = 'pedido';
    const comidas = g.comidas.map((id, i) => this._producto(id, V(-0.36 + i * 0.36, ALTO, -1.45), { tam: 0.17 }));
    comidas.forEach((n) => n.userData.mostrarNombre());
    let elegida = null;
    let listo;
    const terminado = new Promise((r) => (listo = r));
    for (const n of comidas) {
      const elegir = async () => {
        if (elegida) return;
        elegida = n.userData.producto;
        comidas.forEach((x) => x.traverse((o) => this.m.entrada.desregistrar(o)));
        n.userData.volver?.();
        this._pulsar(n);
        this.gesto('asiente', 0.6);
        await this.decir(this.prod[elegida].nombre);
        listo();
      };
      this._agarrable(n, { alTomar: elegir, alTocar: (volver) => volver(), alSoltar: (_d, { volver }) => volver() });
    }
    await this.decir('queQuiere', { repetible: true });
    const pararComida = this._recordar({ clave: 'queQuiere', objetivo: () => this.posMundo(comidas[1]) });
    await terminado;
    pararComida();
    const comida = this.prod[elegida];
    this._ponerPaso('ordena');
    await this.decir('conTarjetas', { repetible: true });
    await this._ordenar('pedido', [g.inicio, comida.tarjeta, g.fin], comida.pedido, { guias: true });
    this.gesto('asiente', 0.6);
    await this.decir(comida.confirma);
    const nodoComida = comidas.find((n) => n.userData.producto === elegida);
    this._retirar(nodoComida, 0.2);
    await this._ponerEnBandeja(this.bandeja, elegida, 1);
    comidas.filter((n) => n !== nodoComida).forEach((n) => this._retirar(n));
    this.celebrar();

    // Bebida: Coco levanta agua y jugo
    await this._bebidaEnAlas('aguaOJugo', 'responder', { pregunta: 'aguaOJugo' });
    await this.elogio();
    await this.decir('disfruta');
    const vieja = this.bandeja;
    this.bandeja = null;
    this.m.fx.moverA(vieja, V(-1.0, ALTO, -1.25), 0.6).then?.(() => {});
    this.esperar(1.2).then(() => !this._destruida && this._retirar(vieja, 0.4));
  }

  /** Coco sostiene agua (izquierda) y jugo (derecha), pregunta y el estudiante toma la bebida pedida. */
  async _bebidaEnAlas(grupo, meta, { pregunta, mision = null } = {}) {
    this._ponerPaso(mision ? 'misionBebida' : 'bebida');
    const agua = this._producto('water', V(0, 0, 0), { tam: 0.15 });
    const jugo = this._producto('juice', V(0, 0, 0), { tam: 0.15 });
    this.raiz.remove(agua, jugo);
    this.sostener(agua, -1);
    this.sostener(jugo, 1);
    agua.userData.mostrarNombre();
    jugo.userData.mostrarNombre();
    this.pose = 'ofrecer';
    await this.decir(pregunta, { repetible: true });
    const alErrar = async (op) => {
      // Consecuencia visible: Coco acerca la bebida equivocada
      if (op.producto) this.gesto('alcanzar', 1.2, this.posMundo(op.producto === 'water' ? agua : jugo).add(V(0, -0.1, 0.4)));
      if (mision) this.m.fx.latido(this.cabecera, 0.06);
    };
    const op = await this._elegir(meta, grupo, { pregunta, alErrar });
    const pedida = op.producto === 'juice' ? jugo : agua;
    const otra = pedida === agua ? jugo : agua;
    const lado = pedida === agua ? -1 : 1;
    const oferta = V(lado * 0.17, ALTO + 0.3, -1.48);
    this._retirar(otra);
    this.sostenidos.delete(otra);
    this.sostenidos.delete(pedida);
    this.raiz.attach(pedida);
    pedida.quaternion.identity();
    this.pose = { tipo: 'alcanzar', lado, punto: this.raiz.localToWorld(oferta.clone()) };
    const desdeAla = pedida.position.clone();
    await this.m.fx.tween({ duracion: 0.45, alActualizar: (k) => {
      pedida.position.lerpVectors(desdeAla, oferta, k);
      pedida.scale.setScalar(1 + 0.35 * k);
    } });
    this._resaltar(pedida, true);
    this._ponerPaso('tomaBebida');
    await this.decir('tomala');
    const pararBebida = this._recordar({ clave: 'tomala', objetivo: () => this.posMundo(pedida) });
    const hueco = () => this.bandeja.localToWorld(this.bandeja.userData.huecos[this.bandeja.userData.contenido.length].clone());
    let marcar = null;
    await new Promise((resolver) => {
      const colocar = async () => {
        this.sostenidos.delete(pedida);
        pedida.traverse((x) => this.m.entrada.desregistrar(x));
        const punto = hueco();
        const destino = this.bandeja.worldToLocal(punto.clone());
        this.bandeja.userData.contenido.push(pedida.userData.producto);
        this.bandeja.attach(pedida);
        pedida.quaternion.identity();
        const ini = pedida.position.clone();
        await this.m.fx.tween({ duracion: 0.3, alActualizar: (k) => pedida.position.lerpVectors(ini, destino, k) });
        this.m.audio.tono(520, 0.06, { volumen: 0.12, pos: punto });
        marcar?.();
        this._resaltar(pedida, false);
        pararBebida();
        pedida.userData.ocultarNombre();
        resolver();
      };
      marcar = this._pulsar(pedida, 1.35);
      this._agarrable(pedida, {
        alTomar: () => {
          marcar?.();
          marcar = null;
          pedida.scale.setScalar(1);
          this.pose = null;
        },
        alTocar: colocar,
        destinos: () => [{ id: 'bandeja', punto: this.posMundo(this.bandeja), radio: 0.3, resaltar: (v) => this._resaltar(this.bandeja, v) }],
        alSoltar: () => colocar(),
      });
    });
    this.pose = null;
    if (mision) {
      this.mision[1].ok = true;
      this.cabecera.redibujar();
    }
  }

  async misionFinal() {
    const mi = this.datos.mision;
    this._etapa(3);
    // Coco entrega la tarjeta de misión (solo íconos)
    this.mision = [
      { id: mi.comida, emoji: this.prod[mi.comida].emoji, ok: false },
      { id: mi.bebida, emoji: this.prod[mi.bebida].emoji, ok: false },
    ];
    const tarjetaMision = this._crearTarjetaMision();
    this.sostener(tarjetaMision, 1);
    await this.decir('tarjetaMision');
    await this.poner(tarjetaMision, V(0.5, ALTO + 0.1, -1.12), { lado: 1 });
    this._ponerTarjetaMision(tarjetaMision);
    this.cabecera.redibujar();

    this.bandeja = this._nuevaBandeja();
    this.sostener(this.bandeja, -1);
    await this.poner(this.bandeja, PUESTO_BANDEJA.clone(), { lado: -1 });
    this._ponerPaso('misionComida');
    await this.decir('mision', { repetible: true });

    // Elegir la comida de la misión (tarjetas solo en inglés)
    this.metaActual = 'pedido';
    const ops = barajar(mi.opcionesComida).map((id) => ({ quien: 'estudiante', en: this.prod[id].tarjeta, es: this.prod[id].nombre.es, correcta: id === mi.comida, retro: 'misionComidaRetro', id }));
    this.datos.preguntas._misionComida = ops;
    await this._elegir('pedido', '_misionComida', { pregunta: 'mision', alErrar: async () => this.m.fx.latido(tarjetaMision, 0.15) });
    const comida = this.prod[mi.comida];
    this._ponerPaso('misionOrdena');
    await this._ordenar('pedido', [this.datos.guiado.inicio, comida.tarjeta, this.datos.guiado.fin], comida.pedido, { guias: false });
    this.gesto('asiente', 0.6);
    await this.decir(comida.confirma);
    await this._ponerEnBandeja(this.bandeja, mi.comida, 1);
    this.mision[0].ok = true;
    this.cabecera.redibujar();

    // Comprobación dentro de la escena: Coco levanta agua y jugo
    await this._bebidaEnAlas('misionBebida', 'bebida', { pregunta: 'beber', mision: true });
    this._ponerPaso('algoMas');
    await this.decir('algoMas', { repetible: true });
    await this._elegir('responder', 'algoMas', { pregunta: 'algoMas' });
    this.celebrar();
    await this.decir('entrega');
  }

  async bandejaYDespedida() {
    const mi = this.datos.mision;
    this._etapa(4);
    this.metaActual = 'comprobar';
    // Dos bandejas: la del estudiante y la de la mesa dos (lado al azar)
    const izquierda = Math.random() < 0.5;
    const mia = this.bandeja;
    const xMia = izquierda ? -0.27 : 0.27;
    this.m.fx.moverA(mia, V(xMia, ALTO, -1.25), 0.5);
    const otra = this._nuevaBandeja('#8a5a36');
    this.sostener(otra, izquierda ? 1 : -1);
    await this.poner(otra, V(-xMia, ALTO, -1.25), { lado: izquierda ? 1 : -1 });
    for (const id of mi.otraBandeja) await this._ponerEnBandeja(otra, id);
    this._ponerPaso('comprueba');
    await this.decir('cualBandeja', { repetible: true });
    const pararBandeja = this._recordar({ clave: 'cualBandeja', cada: 15 });
    let errores = 0;
    await new Promise((resolver) => {
      let ocupado = false;
      const contexto = () => ({
        retro: 'noEsTuya',
        pregunta: null,
        objetivo: () => this.posMundo(mia),
        resaltar: (v) => this._resaltar(mia, v),
      });
      this.ayuda = () => this._ayudar('comprobar', Math.max(2, errores + 1), contexto());
      const elegir = async (bandeja, volver) => {
        if (ocupado) return;
        ocupado = true;
        if (bandeja === mia) {
          [mia, otra].forEach((b) => b.traverse((x) => this.m.entrada.desregistrar(x)));
          this.raiz.attach(mia);
          mia.quaternion.identity();
          await this.m.fx.moverA(mia, V(0, ALTO, -1.08), 0.45);
          this.m.entrada.punteros.forEach((p) => p.activo && p.vibrar(0.4, 120));
          this.m.audio.acierto(this.posMundo(mia));
          pararBandeja();
          this._logro('comprobar', mia, errores ? 50 : 100);
          resolver();
          return;
        }
        volver();
        errores++;
        this.m.audio.error(this.posMundo(bandeja));
        this._fallo('comprobar');
        await this._ayudar('comprobar', Math.min(3, errores), contexto());
        ocupado = false;
      };
      for (const b of [mia, otra]) {
        this._agarrable(b, { alTocar: (volver) => elegir(b, volver), alSoltar: (_d, { volver }) => elegir(b, volver) });
      }
    });
    this.ayuda = null;
    this.mision.forEach((m) => (m.ok = true));
    this.cabecera.redibujar();
    this.celebrar();
    await this.decir('lograste');
    // La otra bandeja va a la mesa dos
    this.sostener(otra, izquierda ? 1 : -1);
    this.esperar(0.6).then(() => !this._destruida && this._retirar(otra, 0.4));
    await this.decir('disfrutaComida', { repetible: true });

    this._ponerPaso('despedida');
    await this._elegir('despedirse', 'despedida', { pregunta: 'disfrutaComida' });
    await this.decir('despideMano');
    this._ponerPaso('olaAdios');
    await this._esperarOla('despideMano');
    this.gesto('adios', 2.6);
    this._fiesta();
    await this.decir('adios');
    this._resultados();
  }

  /** Celebración en la cafetería: campanilla, aplausos de los clientes y confeti. */
  _fiesta() {
    this.m.audio.exito();
    this._tocarCampana();
    for (const p of this.fondo) {
      p.userData.aplaude = true;
      this.cadaCuadro((_dt, t) => {
        if (!p.userData.aplaude) return;
        const a = Math.abs(Math.sin(t * 12)) * 0.4;
        posar(p, { brazoI: [-1.3, 0, -0.1 + a], brazoD: [-1.3, 0, 0.1 - a], piernaI: [-1.45, 0, 0.05], piernaD: [-1.45, 0, -0.05] }, 0.5);
      });
      this.esperar(3).then(() => (p.userData.aplaude = false));
    }
    for (let i = 0; i < 14; i++) this.m.audio.rafaga?.({ duracion: 0.1, filtro: 'bandpass', frecuencia: 1600 + Math.random() * 1200, volumen: 0.035, retardo: i * 0.12 + Math.random() * 0.05 });
    this.m.fx.confeti(this.posMundo(this.coco).add(V(0, 1.4, 0.3)), 140);
    this.esperar(1.4).then(() => !this._destruida && this.gesto('celebra2', 1.4));
  }

  // ── Cierre: logros ───────────────────────────────────────────────────────

  _dibujarResultados(ctx, w, h) {
    escribir(ctx, '⭐ You did it!', 30, 34, { tam: 40, peso: 900, color: '#ffe9a8' });
    let y = 92;
    for (const [id, en, es, emoji] of METAS) {
      const r = this.reg[id];
      const solo = r.hecho && !r.errores && !r.ayuda;
      const estado = (!r.hecho ? '—' : solo ? '⭐ On my own' : r.ayuda ? '✔ With help' : '✔ Retried') + (r.errores ? ` ↺${r.errores}` : '');
      escribir(ctx, `${emoji} ${this.traducir ? es : en}`, 30, y, { tam: 30, peso: 700, color: '#ffffff', maxAncho: w * 0.55 });
      escribir(ctx, estado, w - 30, y, { tam: 28, peso: 800, color: solo ? '#7ef0a8' : '#ffd27a', alinear: 'right' });
      y += 48;
    }
    const usos = METAS.reduce((s, [id]) => ({ r: s.r + this.reg[id].repetir, p: s.p + this.reg[id].pistas, t: s.t + this.reg[id].traduccion }), { r: 0, p: 0, t: 0 });
    const seg = this.registro?.segundos ?? 0;
    escribir(ctx, `🔊 ${usos.r} · 💡 ${usos.p} · 🌐 ${usos.t} · ⏱ ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`, 30, y + 6, { tam: 26, color: '#c9d4ee' });
  }

  _resultados() {
    const seg = Math.round((performance.now() - this.inicio) / 1000);
    this.registro = {
      metas: Object.fromEntries(METAS.map(([id]) => [id, { ...this.reg[id], independiente: this.reg[id].hecho && !this.reg[id].errores && !this.reg[id].ayuda }])),
      segundos: seg,
    };
    this.resultados = true;
    this.cabecera.scale.setScalar(1.12);
    this.cabecera.position.set(0.6, this.H + 0.14, -1.4);
    this.cabecera.lookAt(0, this.H, 0.2);
    this.cabecera.redibujar();
    this.burbuja.visible = false;
    this.mostrarContinuar(V(0.6, this.H - 0.32, -0.95));
  }
}
