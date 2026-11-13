import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { PanelLienzo, COLORES, escribir, tarjeta, rectRedondeado } from '../ui/lienzo.js';
import { gallo } from '../mundo/prefabs/cafe.js';
import { maison as piezas } from '../mundo/prefabs/maison.js';
import { MAISON } from '../mundo/entornos-maison.js';
import { sombra } from '../mundo/materiales.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Hacia dónde apunta un vector en el plano del suelo (0 = -Z; positivo = hacia la izquierda). */
const yawDe = (v) => Math.atan2(-v.x, -v.z);
const CUARTOS = ['chambre', 'salon', 'cuisine', 'bain'];

const METAS = [
  ['saluer', 'Dire bonjour', 'Saludar', '👋'],
  ['visiter', 'Les pièces de la maison', 'Los cuartos de la casa', '🏠'],
  ['chambre', 'La chambre : éteindre', 'El cuarto: apagar', '📱'],
  ['salon', 'Le salon : baisser', 'La sala: bajar', '📺'],
  ['cuisine', 'La cuisine : allumer', 'La cocina: encender', '💡'],
  ['bain', 'La salle de bain : fermer', 'El baño: cerrar', '🚪'],
];

/** Orienta un panel (cara hacia +Z) para que mire a un punto, dado en las coordenadas de su padre. */
function encarar(obj, punto) {
  const d = punto.clone().sub(obj.position);
  obj.rotation.order = 'YXZ';
  obj.rotation.set(-Math.atan2(d.y, Math.hypot(d.x, d.z)), Math.atan2(d.x, d.z), 0);
  return obj;
}

/**
 * Chez Coco (francés A1, entorno "appartement"). El estudiante ya no se queda quieto:
 * recorre el departamento por huellas con Coco, su acompañante, que le da órdenes en
 * francés. Demuestra que entendió yendo al cuarto correcto y haciendo la acción con sus
 * manos: tomar la tablet y apagarla, tomar el control y bajar el volumen, encender la luz
 * y cerrar la puerta empujándola.
 * Estructura: bienvenida → visita (los cuartos, con «Répète») → cuatro misiones con ayuda
 * decreciente (acompañado, con pistas, solo, solo) → fiesta y logros.
 * Ayuda en tres niveles ante un error: (1) se repite la orden, (2) Coco señala y aparecen
 * los letreros, (3) aparece la traducción. 💡 sube un nivel.
 * Registro por meta (solo en memoria): logrado solo o con ayuda, reintentos y usos de 🔊 💡 🌐.
 */
export class EscenaMaison extends EscenaBase {
  construir() {
    const d = this.datos;
    const { app } = this.m;
    this.lin = d.lineas ?? {};
    this.pieces = Object.fromEntries((d.pieces ?? []).map((p) => [p.id, p]));
    this.objets = d.objets ?? {};
    this.traducir = false;
    this.fase = 0;
    this.paso = null;
    this.pasoEs = false;
    this.linea = null;
    this.repetible = null;
    this.metaActual = 'saluer';
    this.ayuda = null;
    this.dialogo = null;
    this.alLlegar = null;
    this.alObjeto = null;
    // Al volver o repetir una parte, la escena se recarga desde esa parte y conserva el registro.
    const previo = this.m.__maison;
    this.m.__maison = null;
    this.desde = previo?.desde ?? 0;
    this.reg = previo?.reg ?? Object.fromEntries(METAS.map(([id]) => [id, { hecho: false, errores: 0, ayuda: false, repetir: 0, pistas: 0, traduccion: 0 }]));
    this.inicio = previo?.inicio ?? performance.now();
    this.estado = { tablette: true, volume: 8, lumiere: false, porte: false };
    this.nodo = 'entree';
    this.puedeIr = new Set();
    this.pista = null;
    this.letreros = false;
    this.revelados = new Set();
    this.conEtiquetas = new Set();
    this.objetos = {};
    this._ultimoElogio = null;
    this._ultimoGesto = null;
    this.luzBase = { hemi: app.hemi.intensity, sol: app.sol.intensity };
    app.soloGiro = true;
    this._ayudaPantalla = document.querySelector('#ayuda-pantalla span');
    if (this._ayudaPantalla) {
      this._textoAyuda = this._ayudaPantalla.textContent;
      this._ayudaPantalla.textContent = '🖱️ Arrastra para mirar · Clic en las huellas 👣 para caminar · Clic para elegir · Mantén el clic para agarrar';
    }

    // La escena usa las coordenadas del plano: se desplaza para que la entrada quede bajo el estudiante.
    this.raiz.position.set(-MAISON.origen[0], 0, -MAISON.origen[1]);
    // Marcos de cada lugar: dentro de ellos el estudiante está en el origen mirando a -Z.
    this.marcos = {};
    for (const [nombre, n] of Object.entries(MAISON.nodos)) {
      const g = new THREE.Group();
      g.position.set(n.pos[0], 0, n.pos[1]);
      g.rotation.y = n.yaw;
      this.raiz.add(g);
      this.marcos[nombre] = g;
    }

    this._crearHud();
    this._crearCoco();
    this._crearHuellas();
    this._crearLetreros();
    this._crearPuertas();
    this._crearChambre();
    this._crearSalon();
    this._crearCuisine();
    this._crearBain();
    this._actualizarHuellas();
    this.cadaCuadro((dt, t) => this._vidaCasa(dt, t));
  }

  destruir() {
    const { app } = this.m;
    app.soloGiro = false;
    if (this.m.marcador) {
      this.m.marcador.visible = true;
      this.m.marcador.scale.setScalar(1);
    }
    if (this._ayudaPantalla) this._ayudaPantalla.textContent = this._textoAyuda;
    app.hemi.intensity = this.luzBase.hemi;
    app.sol.intensity = this.luzBase.sol;
    super.destruir();
  }

  /** Punto del marco de un lugar en coordenadas de la escena. */
  _enMarco(nombre, x, y, z) {
    const n = MAISON.nodos[nombre];
    const c = Math.cos(n.yaw);
    const s = Math.sin(n.yaw);
    return V(n.pos[0] + x * c + z * s, y, n.pos[1] - x * s + z * c);
  }

  /** Punto de la escena en coordenadas del mundo (para sonidos, gestos y premios). */
  _mundo(v) {
    return this.raiz.localToWorld(v.clone());
  }

  /** Centro del vano de una puerta (mundo), a la altura dada. */
  _puerta(id, y = 1.2) {
    const [x, z] = MAISON.puertas[id].centro;
    return this._mundo(V(x, y, z));
  }

  // ── Panel, herramientas y marcador (siguen al estudiante de un lugar a otro) ──

  _crearHud() {
    const { H } = this;
    const { enVR } = this.m.app;
    this.hud = new THREE.Group();
    this.raiz.add(this.hud);
    this.panelCaja = new THREE.Group();
    this.panel = new PanelLienzo(0.96, 0.46, (ctx, w, h) => this._dibujarPanel(ctx, w, h));
    this.panelCaja.add(this.panel);
    this.hud.add(this.panelCaja);
    this.zona = new THREE.Group();
    this.hud.add(this.zona);
    const crear = (texto, accion, i, color) => {
      const b = this.boton(texto, accion, { ancho: 0.2, alto: 0.075, color, tam: 27 });
      b.position.set((i - 2.5) * 0.215, H - (enVR ? 0.62 : 0.52), (enVR ? -0.85 : -0.95) + Math.abs(i - 2.5) * 0.03);
      encarar(b, V(0, H, 0.2));
      this.hud.add(b);
      return b;
    };
    crear('🔊 Encore', () => this.repetir(), 0, '#2f4a8a');
    this.btnTraducir = crear('🌐 Español', () => this.alternarTraduccion(), 1, '#5b6886');
    crear('💡 Aide', () => this.pedirAyuda(), 2, '#d98a00');
    crear('⏮ Retour', () => this._confirmar('atras'), 3, '#5b6886');
    crear('↺ Rejouer', () => this._confirmar('repetir'), 4, '#5b6886');
    crear('⏏ Sortir', () => this.salir(), 5, '#a33a4a');
    this._colocarHud('entree');
  }

  _colocarHud(nombre) {
    const n = MAISON.nodos[nombre];
    const { H } = this;
    this.hud.position.set(n.pos[0], 0, n.pos[1]);
    this.hud.rotation.y = n.yaw;
    this.panelCaja.position.set(0, H + 0.45, -n.hud);
    this.panelCaja.scale.setScalar(THREE.MathUtils.clamp(n.hud / 1.7, 0.72, 1.1));
    encarar(this.panelCaja, V(0, H, 0));
    // El marcador de puntos del motor va encima del panel.
    const marcador = this.m.marcador;
    if (marcador?.parent) {
      // (el marcador cuelga del anclaje del motor, no de la escena: se suma el desplazamiento del plano)
      marcador.position.copy(this._enMarco(nombre, 0, H + 0.45 + 0.37 * this.panelCaja.scale.x, -n.hud)).add(this.raiz.position);
      marcador.rotation.set(0, n.yaw, 0);
      marcador.scale.setScalar(0.75 * this.panelCaja.scale.x);
    }
  }

  _dibujarPanel(ctx, w, h) {
    tarjeta(ctx, w, h, { radio: 44, borde: '#f2c45a', grosor: 8 });
    // Franja superior: parte actual y estrellas de las cuatro misiones
    ctx.fillStyle = '#23304a';
    rectRedondeado(ctx, 16, 16, w - 32, 72, 32);
    ctx.fill();
    const fases = this.datos.fases ?? [];
    const f = fases[this.fase];
    ctx.fillStyle = '#f2c45a';
    rectRedondeado(ctx, 26, 25, 104, 54, 27);
    ctx.fill();
    escribir(ctx, `${this.fase + 1}/${fases.length || 6}`, 78, 52, { tam: 30, peso: 900, color: '#23304a', alinear: 'center', base: 'middle' });
    if (f) escribir(ctx, f.fr + (this.traducir ? ` · ${f.es}` : ''), 148, 52, { tam: 34, tamMin: 22, peso: 900, color: '#ffffff', base: 'middle', maxAncho: w - 430 });
    METAS.slice(2).forEach(([id], i) => escribir(ctx, this.reg[id].hecho ? '⭐' : '☆', w - 236 + i * 58, 52, { tam: 42, peso: 900, color: '#ffe9a8', alinear: 'center', base: 'middle' }));
    // Franja inferior: qué hay que hacer (el español aparece con 🌐 o tras un rato sin avanzar)
    let fin = h - 18;
    if (this.paso) {
      const conEs = this.traducir || this.pasoEs;
      const alto = conEs ? 112 : 70;
      fin = h - 16 - alto;
      ctx.fillStyle = '#23304a';
      rectRedondeado(ctx, 16, fin, w - 32, alto, 30);
      ctx.fill();
      escribir(ctx, this.paso.fr, 40, fin + (conEs ? 34 : alto / 2), { tam: 36, tamMin: 26, peso: 800, color: '#ffe9a8', base: 'middle', maxAncho: w - 80, maxAlto: 60 });
      if (conEs) escribir(ctx, `🇪🇸 ${this.paso.es}`, 40, fin + 82, { tam: 28, tamMin: 22, peso: 700, color: '#ffffff', base: 'middle', maxAncho: w - 80, maxAlto: 44 });
    }
    // Lo que dice Coco
    const l = this.linea;
    if (!l) return;
    escribir(ctx, '🐓 Coco', 40, 100, { tam: 28, peso: 800, color: '#b06a1f' });
    const conEs = this.traducir && l.es;
    const espacio = fin - 142 - (conEs ? 58 : 4);
    const y = escribir(ctx, l.fr, 40, 138, { tam: 56, tamMin: 32, peso: 800, color: COLORES.texto, maxAncho: w - 80, maxAlto: espacio, interlineado: 1.1 });
    if (conEs) escribir(ctx, l.es, 40, Math.min(y + 6, fin - 54), { tam: 30, tamMin: 22, peso: 600, color: COLORES.suave, maxAncho: w - 80, maxAlto: 50 });
  }

  _ponerPaso(clave) {
    this.paso = this.datos.pasos?.[clave] ?? null;
    this.panel.redibujar();
    this.m.fx.latido(this.panel, 0.02);
  }

  _etapa(n) {
    this.fase = n;
    this.paso = null;
    this.panel.redibujar();
    this.m.audio.tono(880, 0.1, { volumen: 0.06 });
    this.m.audio.tono(1320, 0.14, { volumen: 0.06, retardo: 0.1 });
  }

  /** Pregunta antes de volver a la parte anterior o repetir la actual (con ✓ / ✗ grandes). */
  _confirmar(accion) {
    this.dialogo?.removeFromParent();
    const { H } = this;
    const destino = accion === 'atras' ? Math.max(0, this.fase - 1) : this.fase;
    const g = new THREE.Group();
    g.position.set(0, H - 0.2, -0.85);
    encarar(g, V(0, H, 0.2));
    const titulo = new PanelLienzo(0.66, 0.11, (ctx, w, h) => {
      tarjeta(ctx, w, h, { fondo: '#23304a', radio: 30 });
      const fr = accion === 'atras' ? `⏮ Retourner à la partie ${destino + 1} ?` : `↺ Rejouer la partie ${destino + 1} ?`;
      const es = accion === 'atras' ? `¿Volver a la parte ${destino + 1}?` : `¿Repetir la parte ${destino + 1}?`;
      escribir(ctx, fr, w / 2, h * 0.38, { tam: 38, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30 });
      escribir(ctx, es, w / 2, h * 0.76, { tam: 26, color: '#c9d4ee', alinear: 'center', base: 'middle' });
    });
    titulo.position.set(0, 0.09, 0);
    g.add(titulo);
    const cerrar = () => {
      this.m.entrada.desregistrar(si);
      this.m.entrada.desregistrar(no);
      g.removeFromParent();
      this.dialogo = null;
    };
    const si = this.boton('✓ Oui', () => this._irAEtapa(destino), { ancho: 0.25, alto: 0.1, color: COLORES.verde, tam: 40 });
    const no = this.boton('✗ Non', cerrar, { ancho: 0.25, alto: 0.1, color: '#a33a4a', tam: 40 });
    si.position.set(-0.15, -0.03, 0.01);
    no.position.set(0.15, -0.03, 0.01);
    g.add(si, no);
    this.hud.add(g);
    this.m.fx.aparecer(g, 0.3);
    this.dialogo = g;
  }

  /** Vuelve a cargar la escena empezando en la parte `n`; conserva el registro y el tiempo. */
  _irAEtapa(n) {
    this.m.__maison = { desde: n, reg: this.reg, inicio: this.inicio };
    this.m.irA(this.indice, true);
  }

  repetir() {
    this.reg[this.metaActual].repetir++;
    const l = this.repetible ?? this.linea;
    if (l) this.decir(l);
  }

  alternarTraduccion(valor = !this.traducir) {
    this.traducir = valor;
    this.traduccionDeAyuda = false;
    if (valor) this.reg[this.metaActual].traduccion++;
    this.btnTraducir.setTexto(valor ? '🌐 Français' : '🌐 Español');
    this.panel.redibujar();
    this._redibujarRotulos();
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

  // ── Coco, el acompañante ─────────────────────────────────────────────────

  _crearCoco() {
    this.coco = gallo({ estilo: 'frances' });
    this.coco.position.set(MAISON.cocoPasillo[0] - 0.6, 0, MAISON.cocoPasillo[1] + 0.25);
    this.coco.userData.sinCabeceo = true;
    this.coco.add(sombra(0.3, 0.3));
    this.raiz.add(this.coco);
    this.presentar(this.coco, 0.1);
    this.cuerpoYaw = 0;
    this.gestoActual = null;
    this.verCoco = null;
    this.proximoReposo = 6;
    this.ruta = [];
    this.velCoco = 2.4;
    this.cadaCuadro((dt, t) => this._animarCoco(dt, t));
  }

  /** Gesto breve (segundos). Tipos: saludo, adios, celebra1-3, no, duda, asiente, senalar, oreilles. */
  gesto(tipo, duracion = 1.2, objetivo = null) {
    this.gestoActual = { tipo, desde: this._t ?? 0, duracion, objetivo };
    this._ultimoGesto = tipo;
    const exp = { no: 'duda', duda: 'duda', oreilles: 'sorpresa', saludo: 'sorpresa', celebra2: 'sorpresa', adios: 'feliz' }[tipo] ?? 'feliz';
    this.coco.userData.setExpresion(exp);
  }

  celebrar() {
    this.gesto(azar(['celebra1', 'celebra2', 'celebra3'].filter((g) => g !== this._ultimoGesto)), 1.3);
  }

  async elogio() {
    this.celebrar();
    const clave = azar(['elogio1', 'elogio2', 'elogio3', 'elogio4'].filter((k) => k !== this._ultimoElogio));
    this._ultimoElogio = clave;
    await this.decir(clave);
  }

  /** Coco mira un punto del mundo un rato (si no, mira al estudiante). */
  mirar(punto, segundos = 1.5) {
    this.verCoco = punto ? { punto: punto.clone(), hasta: (this._t ?? 0) + segundos } : null;
  }

  /** Coco camina por una lista de puntos (coordenadas de la escena). Resuelve al llegar. */
  cocoA(puntos, velocidad = 2.4) {
    this.ruta = puntos.map((p) => p.clone());
    this.velCoco = velocidad;
    return new Promise((r) => (this._alLlegarCoco = r));
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
    const cam = this.m.app.camara.getWorldPosition(V());
    const camLocal = this.raiz.worldToLocal(cam.clone());

    // Camina por su ruta con un contoneo; quieto, se gira hacia el estudiante.
    let caminando = false;
    if (this.ruta.length) {
      const meta = this.ruta[0];
      const dx = meta.x - coco.position.x;
      const dz = meta.z - coco.position.z;
      const dist = Math.hypot(dx, dz);
      const paso = this.velCoco * dt;
      if (dist <= paso) {
        coco.position.x = meta.x;
        coco.position.z = meta.z;
        this.ruta.shift();
        if (!this.ruta.length) {
          this._alLlegarCoco?.();
          this._alLlegarCoco = null;
        }
      } else {
        coco.position.x += (dx / dist) * paso;
        coco.position.z += (dz / dist) * paso;
        this.cuerpoYaw = Math.atan2(dx, dz);
        caminando = true;
      }
    }
    if (!caminando) this.cuerpoYaw = Math.atan2(camLocal.x - coco.position.x, camLocal.z - coco.position.z);
    coco.rotation.y += angulo(this.cuerpoYaw - coco.rotation.y) * (1 - Math.exp(-dt * (caminando ? 12 : 5)));
    if (caminando && Math.floor(t * 5.2) !== Math.floor((t - dt) * 5.2)) this.m.audio.tono(190, 0.04, { tipo: 'triangle', volumen: 0.05, pos: this.posMundo(coco) });

    // Mirada: la cabeza sigue al estudiante (o lo que se indique) dentro de sus límites
    let objetivo = cam;
    if (this.verCoco && t < this.verCoco.hasta) objetivo = this.verCoco.punto;
    if (g?.objetivo && tipo === 'senalar') objetivo = g.objetivo;
    const local = coco.worldToLocal(objetivo.clone());
    const girando = Math.abs(angulo(coco.rotation.y - this.cuerpoYaw)) > 0.3;
    let cabY = caminando || girando ? 0 : THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.87, 0.87);
    let cabX = THREE.MathUtils.clamp(-Math.atan2(local.y - 0.96, Math.hypot(local.x, local.z)), -0.35, 0.35) + (habla ? Math.sin(t * 7) * 0.035 : 0);
    let cabZ = 0;

    // Alas, torso y salto
    let alaI = { x: 0, z: -0.12 };
    let alaD = { x: habla ? -0.3 : 0, z: habla ? 0.4 + Math.sin(t * 3.1) * 0.22 : 0.12 };
    let torsoZ = 0;
    let salto = 0;
    let boina = 0;
    const apuntar = (lado, punto) => {
      const hombro = a.torso.localToWorld(V(lado * 0.215, 0.32, 0.01));
      const dir = punto.clone().sub(hombro).applyQuaternion(a.torso.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      return { z: Math.asin(THREE.MathUtils.clamp(dir.x, -1, 1)), x: Math.atan2(-dir.z, -dir.y) };
    };
    if (caminando) {
      const aleteo = Math.sin(t * 16) * 0.25;
      alaI = { x: 0, z: -0.55 - aleteo };
      alaD = { x: 0, z: 0.55 + aleteo };
      salto = Math.abs(Math.sin(t * 16)) * 0.035;
      torsoZ = Math.sin(t * 16) * 0.07;
    } else if (tipo === 'saludo' || tipo === 'adios') {
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
    } else if (tipo === 'oreilles') {
      // Se tapa los oídos: ¡qué ruido!
      alaI = { x: -0.5, z: -2.5 };
      alaD = { x: -0.5, z: 2.5 };
      torsoZ = Math.sin(t * 24) * 0.04;
      cabX += 0.15;
    } else if (tipo === 'senalar') {
      const lado = coco.worldToLocal(g.objetivo.clone()).x >= 0 ? -1 : 1;
      const p = apuntar(lado, g.objetivo);
      if (lado > 0) alaD = p;
      else alaI = p;
    } else if (tipo === 'boina') {
      alaD = { x: -0.9, z: 2.2 };
      boina = Math.sin(k * Math.PI) * 0.4;
    } else if (tipo === 'ladeo') {
      cabZ = Math.sin(k * Math.PI) * 0.28;
    } else if (tipo === 'plumas') {
      torsoZ = Math.sin(t * 28) * 0.05 * Math.sin(k * Math.PI);
    }

    // Microgestos en reposo (al azar, sin repetir el último)
    if (!this.gestoActual && !habla && !caminando && t > this.proximoReposo) {
      this.gesto(azar(['boina', 'ladeo', 'plumas'].filter((x) => x !== this._ultimoGesto)), 1.4);
      this.proximoReposo = t + 6 + Math.random() * 4;
    }

    a.cabeza.rotation.y += (cabY - a.cabeza.rotation.y) * s;
    a.cabeza.rotation.x += (cabX - a.cabeza.rotation.x) * s;
    a.cabeza.rotation.z += (cabZ - a.cabeza.rotation.z) * s;
    a.alaI.rotation.x += (alaI.x - a.alaI.rotation.x) * s;
    a.alaI.rotation.z += (alaI.z - a.alaI.rotation.z) * s;
    a.alaD.rotation.x += (alaD.x - a.alaD.rotation.x) * s;
    a.alaD.rotation.z += (alaD.z - a.alaD.rotation.z) * s;
    a.torso.rotation.z = torsoZ;
    a.boina.position.y = 0.33 + boina * 0.09;
    coco.position.y = salto;
  }

  /** Lugar de Coco junto al estudiante en cada sitio (coordenadas de la escena). */
  _sitioCoco(nombre) {
    if (nombre === 'couloir' || nombre === 'entree') return V(MAISON.cocoPasillo[0], 0, MAISON.cocoPasillo[1]);
    return this._enMarco(nombre, MAISON.local[nombre].coco[0], 0, MAISON.local[nombre].coco[1]);
  }

  /** Coco acompaña al estudiante: entra o sale por la puerta y se queda a su lado. */
  _cocoAcompana(desde, hacia) {
    if (this.cocoLibre) return;
    const enPasillo = (n) => n === 'couloir' || n === 'entree';
    const sitio = this._sitioCoco(hacia);
    const cuarto = enPasillo(hacia) ? (enPasillo(desde) ? null : desde) : hacia;
    if (cuarto) {
      const [x, z] = MAISON.puertas[cuarto].centro;
      this.coco.position.set(x, 0, z);
      this.cocoA([sitio], 2.6);
    } else if (this.coco.position.distanceTo(sitio) > 0.05) this.cocoA([sitio], 2.4);
  }

  // ── Voz ──────────────────────────────────────────────────────────────────

  /** Coco dice una línea (objeto o clave de "lineas"), se muestra en el panel y baja el ambiente. */
  async decir(l, { repetible = false } = {}) {
    if (typeof l === 'string') l = this.lin[l];
    if (!l || this._destruida) return;
    this.linea = l;
    if (repetible) this.repetible = l;
    this.panel.redibujar();
    this.m.fx.latido(this.panel, 0.02);
    this.m.audio.volumenAmbiente(0.3);
    try {
      return await this.hablarPersona(this.coco, l.fr, l.quien ?? 'coco');
    } finally {
      if (!this._destruida && !this.m.audio.hablando) this.m.audio.volumenAmbiente(1);
    }
  }

  // ── Caminar por la casa ──────────────────────────────────────────────────

  /**
   * Huella en el piso: al apuntarla y pulsar, el estudiante camina hasta `destino`.
   * Con `rotulo` lleva un cartelito encima (p. ej. la salida de un cuarto).
   */
  _crearHuella(pos, destino, rotulo = null) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const color = new THREE.Color('#7fe3ff');
    const basico = (opacidad, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad, depthWrite: false, ...extra });
    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 40), basico(0.95));
    const disco = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), basico(0.25));
    for (const m of [anillo, disco]) {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.012;
    }
    const pasos = new PanelLienzo(0.3, 0.3, (ctx, w, h) => escribir(ctx, '👣', w / 2, h / 2, { tam: 190, alinear: 'center', base: 'middle' }));
    pasos.rotation.x = -Math.PI / 2;
    pasos.position.y = 0.016;
    const alto = rotulo ? 0.4 : 1.0;
    const yFlecha = alto + 0.18;
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, alto, 24, 1, true), basico(0.14, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    haz.position.y = alto / 2;
    const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.15, 16), basico(0.95));
    flecha.rotation.x = Math.PI;
    flecha.position.y = yFlecha;
    g.add(anillo, disco, pasos, haz, flecha);
    if (rotulo) {
      const cartel = new PanelLienzo(0.36, 0.09, (ctx, w, h) => {
        rectRedondeado(ctx, 4, 4, w - 8, h - 8, 36);
        ctx.fillStyle = '#23304a';
        ctx.fill();
        const t = this.traducir ? `${rotulo.fr} · ${rotulo.es}` : rotulo.fr;
        escribir(ctx, t, w / 2, h / 2, { tam: 44, tamMin: 24, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30 });
      }, { pxPorMetro: 1400 });
      cartel.position.y = 0.84;
      g.add(cartel);
      g.userData.cartel = cartel;
    }
    g.userData.destino = destino;
    let encima = false;
    g.userData.animar = (t) => {
      const destacada = this.pista && this.pista === g.userData.destino;
      color.set(destacada ? '#ffd23c' : '#7fe3ff');
      for (const m of [anillo, disco, haz, flecha]) m.material.color.copy(color);
      const pulso = 1 + Math.sin(t * (destacada ? 7 : 3.5)) * (destacada ? 0.12 : 0.05);
      anillo.scale.setScalar(pulso * (encima ? 1.15 : 1));
      haz.material.opacity = (destacada ? 0.3 : 0.14) + (encima ? 0.14 : 0);
      flecha.position.y = yFlecha + Math.abs(Math.sin(t * 3)) * 0.08;
      flecha.rotation.y = t * 1.5;
    };
    this.interactivo(g, {
      proxy: true,
      alPasar: (v) => (encima = v),
      alSeleccionar: () => this._irA(destino),
    });
    return g;
  }

  _crearHuellas() {
    this.huellas = {};
    const hub = MAISON.nodos.couloir.pos;
    this.huellas.couloir = this._crearHuella(V(hub[0], 0, hub[1]), 'couloir');
    this.raiz.add(this.huellas.couloir);
    for (const id of CUARTOS) {
      const [x, z] = MAISON.puertas[id].huella;
      this.huellas[id] = this._crearHuella(V(x, 0, z), id);
      this.raiz.add(this.huellas[id]);
    }
    // Dentro de cada cuarto, la huella de salida lleva de vuelta al pasillo.
    this.salidas = {};
    for (const id of CUARTOS) {
      const [x, z] = MAISON.local[id].salida;
      const s = this._crearHuella(V(x, 0, z), 'couloir', this.datos.couloir ?? { fr: '🚪 le couloir', es: 'el pasillo' });
      encarar(s.userData.cartel, V(-x, this.H, -z));
      s.userData.alto = 0.75;
      this.marcos[id].add(s);
      this.salidas[id] = s;
    }
  }

  /** Muestra solo las huellas que sirven desde donde está el estudiante. */
  _actualizarHuellas() {
    const poner = (h, visible) => {
      h.visible = visible;
      this.m.entrada.habilitar(h, visible);
    };
    poner(this.huellas.couloir, this.nodo === 'entree' && this.puedeIr.has('couloir'));
    for (const id of CUARTOS) {
      poner(this.huellas[id], this.nodo === 'couloir' && this.puedeIr.has(id));
      poner(this.salidas[id], this.nodo === id && this.puedeIr.has('couloir'));
    }
    this._habilitarObjetos();
  }

  /**
   * Los objetos de un cuarto solo responden cuando el estudiante está dentro (el rayo
   * atraviesa las paredes). userData.bloqueado: la misión lo tiene en uso; los botones de
   * la tablet y del control solo sirven mientras están en las manos (userData.activo).
   */
  _habilitarObjetos() {
    for (const [cuarto, objs] of Object.entries(this.objetos)) {
      for (const o of Object.values(objs)) this.m.entrada.habilitar(o, this.nodo === cuarto && !o.userData.bloqueado);
    }
    for (const [cuarto, botones] of [['chambre', this.botonesTablette], ['salon', this.botonesTele]]) {
      for (const b of Object.values(botones ?? {})) this.m.entrada.habilitar(b, this.nodo === cuarto && Boolean(b.userData.activo));
    }
  }

  /** Activa o desactiva los botones de un objeto que se tiene en las manos. */
  _activarBotones(botones, activo, mostrar = false) {
    for (const b of Object.values(botones)) {
      b.userData.activo = activo;
      if (mostrar) {
        b.visible = activo;
        if (activo) this.m.fx.aparecer(b, 0.3);
      }
    }
    this._habilitarObjetos();
  }

  /** Lleva al estudiante a un lugar: tres pasos, un fundido corto y aparece allí mirando al frente. */
  async _irA(nombre, { instantaneo = false } = {}) {
    if (this.viajando || this._destruida || nombre === this.nodo) return;
    this.viajando = true;
    const desde = this.nodo;
    if (!instantaneo) {
      for (let i = 0; i < 3; i++) this.m.audio.rafaga({ duracion: 0.07, filtro: 'lowpass', frecuencia: 420, volumen: 0.1, retardo: i * 0.13 });
      await this.m.fx.fundido(true, 0.16);
      if (this._destruida) return;
    }
    this.nodo = nombre;
    this._colocarUsuario(nombre);
    this._colocarHud(nombre);
    this._actualizarHuellas();
    this._cocoAcompana(desde, nombre);
    this._oscurecer();
    if (!instantaneo) await this.m.fx.fundido(false, 0.26);
    this.viajando = false;
    if (!this._destruida) this.alLlegar?.(nombre, desde);
  }

  /**
   * Mueve y gira el "rig" para que el estudiante quede en el lugar mirando al frente.
   * En VR se alinea el frente del cuerpo (no la cabeza, que puede estar girada hacia la
   * puerta que acaba de señalar), así lo importante queda delante aunque esté sentado.
   */
  _colocarUsuario(nombre) {
    const n = MAISON.nodos[nombre];
    const { rig, camara } = this.m.app;
    this.raiz.updateMatrixWorld(true);
    const deseado = yawDe(V(0, 0, -1).applyQuaternion(this.raiz.getWorldQuaternion(new THREE.Quaternion()))) + n.yaw;
    const yawCabeza = yawDe(camara.getWorldDirection(V()));
    let referencia = yawCabeza;
    if (this.m.app.enVR) {
      this.yawNeutro ??= yawCabeza - rig.rotation.y;
      const neutro = rig.rotation.y + this.yawNeutro;
      if (Math.abs(angulo(yawCabeza - neutro)) > 1.3) this.yawNeutro = yawCabeza - rig.rotation.y;
      else referencia = neutro;
    } else {
      camara.rotation.x = -0.04;
    }
    const giro = angulo(deseado - referencia);
    const cabeza = camara.getWorldPosition(V());
    const brazo = rig.position.clone().sub(cabeza).applyAxisAngle(V(0, 1, 0), giro);
    rig.position.copy(cabeza).add(brazo);
    rig.rotation.y += giro;
    rig.updateMatrixWorld(true);
    const destino = this._mundo(V(n.pos[0], 0, n.pos[1]));
    const ahora = camara.getWorldPosition(V());
    rig.position.x += destino.x - ahora.x;
    rig.position.z += destino.z - ahora.z;
    rig.updateMatrixWorld(true);
  }

  /** La cocina está a oscuras hasta que se enciende la luz: baja la luz general al entrar. */
  _oscurecer() {
    const oscuro = this.nodo === 'cuisine' && !this.estado.lumiere;
    if (oscuro === this._oscuro) return;
    this._oscuro = oscuro;
    const { hemi, sol } = this.m.app;
    const h0 = hemi.intensity;
    const s0 = sol.intensity;
    const h1 = this.luzBase.hemi * (oscuro ? 0.17 : 1);
    const s1 = this.luzBase.sol * (oscuro ? 0.06 : 1);
    this.m.fx.tween({
      duracion: 0.5,
      alActualizar: (k) => {
        hemi.intensity = h0 + (h1 - h0) * k;
        sol.intensity = s0 + (s1 - s0) * k;
      },
    });
  }

  // ── Letreros y puertas ───────────────────────────────────────────────────

  _crearLetreros() {
    const hub = MAISON.nodos.couloir.pos;
    this.rotulos = [];
    this.letrero = {};
    this.zonaPuerta = {};
    for (const id of CUARTOS) {
      const p = this.pieces[id] ?? { emoji: '🚪', nom: { fr: id, es: id } };
      const luz = { encendida: false };
      const cartel = new PanelLienzo(0.56, 0.19, (ctx, w, h) => {
        // En la visita se descubren uno por uno; en las misiones solo se ven si hay apoyo (o ayuda).
        const visto = this.fase <= 1 ? this.revelados.has(id) : this.letreros;
        rectRedondeado(ctx, 6, 6, w - 12, h - 12, 44);
        ctx.fillStyle = luz.encendida ? '#f2c45a' : '#23304a';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#f2c45a';
        ctx.stroke();
        const color = luz.encendida ? '#23304a' : '#ffffff';
        if (!visto) return escribir(ctx, '?', w / 2, h / 2, { tam: 110, peso: 900, color, alinear: 'center', base: 'middle' });
        const conEs = this.traducir;
        escribir(ctx, `${p.emoji} ${p.nom.fr}`, w / 2, conEs ? h * 0.38 : h / 2, { tam: 70, tamMin: 30, peso: 900, color, alinear: 'center', base: 'middle', maxAncho: w - 50, maxAlto: h * (conEs ? 0.42 : 0.6) });
        if (conEs) escribir(ctx, p.nom.es, w / 2, h * 0.76, { tam: 36, peso: 700, color, alinear: 'center', base: 'middle', maxAncho: w - 50 });
      });
      const [x, z] = MAISON.puertas[id].letrero;
      cartel.userData.encender = (v) => {
        luz.encendida = v;
        cartel.redibujar();
      };
      cartel.position.set(x, 2.22, z);
      encarar(cartel, V(hub[0], 1.5, hub[1]));
      this.raiz.add(cartel);
      this.letrero[id] = cartel;
      this.rotulos.push(cartel);
      // Cortina de luz en el vano: durante la visita se toca para conocer el cuarto.
      const [cx, cz] = MAISON.puertas[id].centro;
      const lateral = id === 'chambre' || id === 'bain';
      const zona = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      zona.position.set(lateral ? cx + Math.sign(-cx) * 0.07 : cx, 1.0, lateral ? cz : cz + 0.07);
      zona.rotation.y = lateral ? Math.PI / 2 : 0;
      zona.visible = false;
      this.raiz.add(zona);
      this.zonaPuerta[id] = zona;
    }
  }

  _redibujarRotulos() {
    for (const r of this.rotulos) r.redibujar();
    for (const h of Object.values(this.salidas)) h.userData.cartel?.redibujar();
  }

  /** Etiqueta con el nombre de un objeto (se ve en las misiones con apoyo o al pedir ayuda). */
  _etiqueta(cuarto, clave, pos) {
    const o = this.objets[clave] ?? { fr: clave, es: clave };
    const cartel = new PanelLienzo(0.34, 0.075, (ctx, w, h) => {
      if (!this.conEtiquetas.has(cuarto)) return;
      rectRedondeado(ctx, 4, 4, w - 8, h - 8, 32);
      ctx.fillStyle = '#23304a';
      ctx.fill();
      escribir(ctx, this.traducir ? `${o.fr} · ${o.es}` : o.fr, w / 2, h / 2, { tam: 40, tamMin: 18, peso: 800, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30, maxAlto: h - 24 });
    });
    cartel.position.copy(pos);
    encarar(cartel, V(0, this.H, 0));
    this.marcos[cuarto].add(cartel);
    this.rotulos.push(cartel);
    return cartel;
  }

  /** Registra un objeto de un cuarto: al tocarlo avisa a la misión en curso. */
  _objeto(cuarto, clave, nodo, posEtiqueta = null) {
    (this.objetos[cuarto] ??= {})[clave] = nodo;
    if (posEtiqueta) this._etiqueta(cuarto, clave, posEtiqueta);
    this.interactivo(nodo, {
      proxy: true,
      alPasar: (v) => {
        this._resaltar(nodo, v);
        if (v) this.mirar(this.posMundo(nodo), 1.2);
      },
      alSeleccionar: () => this._tocarObjeto(cuarto, clave, nodo),
    });
    return nodo;
  }

  /** Zona invisible sobre un mueble del entorno (el sofá, la lámpara, la refrigeradora). */
  _zonaMueble(cuarto, clave, [x, y, z], [w, h, d], posEtiqueta) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const caja = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    g.add(caja);
    g.userData.tamHalo = Math.min(0.7, Math.max(w, h) * 0.9);
    this.marcos[cuarto].add(g);
    return this._objeto(cuarto, clave, g, posEtiqueta);
  }

  _tocarObjeto(cuarto, clave, nodo) {
    if (this.alObjeto) return this.alObjeto(cuarto, clave, nodo);
    this.m.fx.latido(nodo, 0.06);
  }

  _resaltar(obj, v) {
    obj.userData.halo ??= (() => {
      const h = this.halo(obj.userData.tamHalo ?? 0.34, '#ffd23c');
      h.material.side = THREE.DoubleSide;
      h.material.depthTest = false;
      h.renderOrder = 5;
      h.position.copy(obj.userData.centroHalo ?? V(0, 0.08, 0.02));
      obj.add(h);
      return h;
    })();
    obj.userData.halo.userData.encendido = v;
    obj.userData.halo.visible = v;
    if (v) this.m.audio.tono(1700, 0.025, { volumen: 0.03 });
  }

  /** Botón redondo con un símbolo (sobre la tablet o el control). */
  _botonRedondo(simbolo, color, accion, diametro) {
    const estado = { encima: false, pulso: false };
    const b = new PanelLienzo(diametro, diametro, (ctx, w, h) => {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = estado.encima || estado.pulso ? 12 : 6;
      ctx.strokeStyle = estado.encima ? '#ffffff' : estado.pulso ? '#ffd23c' : 'rgba(255,255,255,0.55)';
      ctx.stroke();
      escribir(ctx, simbolo, w / 2, h / 2 + h * 0.02, { tam: h * 0.56, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
    }, { pxPorMetro: 220 / diametro });
    this.interactivo(b, {
      alPasar: (v) => {
        estado.encima = v;
        b.redibujar();
      },
      alSeleccionar: () => {
        this.m.audio.pop(this.posMundo(b));
        accion();
      },
    });
    b.userData.pulsar = (v) => {
      estado.pulso = v;
      b.redibujar();
    };
    return b;
  }

  /** El estudiante toma un objeto: viene a sus manos, grande y de frente. */
  _tomar(obj, { escala, y = this.H - 0.25, z = -0.58 }) {
    const u = obj.userData;
    u.casa = { pos: obj.position.clone(), rot: obj.rotation.clone(), escala: obj.scale.x };
    const destino = V(0, y, z);
    const rot0 = obj.quaternion.clone();
    const rot1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0));
    this.m.audio.agarrar();
    return this.m.fx.tween({
      duracion: 0.45,
      alActualizar: (k) => {
        obj.position.lerpVectors(u.casa.pos, destino, k);
        obj.position.y += Math.sin(k * Math.PI) * 0.06;
        obj.quaternion.slerpQuaternions(rot0, rot1, k);
        obj.scale.setScalar(u.casa.escala + (escala - u.casa.escala) * k);
      },
    });
  }

  _devolver(obj) {
    const u = obj.userData;
    if (!u.casa) return Promise.resolve();
    const pos0 = obj.position.clone();
    const rot0 = obj.quaternion.clone();
    const rot1 = new THREE.Quaternion().setFromEuler(u.casa.rot);
    const e0 = obj.scale.x;
    const casa = u.casa;
    u.casa = null;
    return this.m.fx.tween({
      duracion: 0.4,
      alActualizar: (k) => {
        obj.position.lerpVectors(pos0, casa.pos, k);
        obj.quaternion.slerpQuaternions(rot0, rot1, k);
        obj.scale.setScalar(e0 + (casa.escala - e0) * k);
      },
    });
  }

  _crearPuertas() {
    this.puertas = {};
    const [z0] = MAISON.vanoLateral;
    for (const [id, x, abierta, cerrada] of [['chambre', -1.67, Math.PI / 2 - 0.12, -Math.PI / 2], ['bain', 1.67, Math.PI / 2 + 0.12, Math.PI * 1.5]]) {
      const p = piezas.porte(id === 'bain' ? { color: '#8fd0c8', panel: '#bfe6e0' } : { color: '#7fb6e6', panel: '#cfe3f2' });
      p.position.set(x, 0, z0);
      p.rotation.y = abierta;
      p.userData = { ...p.userData, id, abierta, cerrada, k: 0, bisagra: V(x, 0, z0), tamHalo: 0.5, centroHalo: V(0.78, 1.0, id === 'bain' ? -0.08 : 0.08) };
      this.raiz.add(p);
      this.puertas[id] = p;
      this.interactivo(p, {
        proxy: true,
        agarrable: true,
        alPasar: (v) => this._resaltar(p, v),
        // El sistema de agarre mueve el objeto: aquí solo gira sobre su bisagra.
        alAgarrar: (puntero) => this.alPuerta?.('agarrar', p, puntero),
        alMoverAgarrado: (puntero) => {
          p.position.copy(p.userData.bisagra);
          this.alPuerta?.('mover', p, puntero);
        },
        alSoltar: (puntero) => {
          p.position.copy(p.userData.bisagra);
          this.alPuerta?.('soltar', p, puntero);
        },
      });
      this.m.entrada.habilitar(p, false);
    }
    // La cocina a oscuras, vista desde el pasillo
    const [cx, cz] = MAISON.puertas.cuisine.centro;
    this.cortina = new THREE.Mesh(new THREE.PlaneGeometry(0.95, MAISON.puertaAlto), new THREE.MeshBasicMaterial({ color: '#060a1c', transparent: true, opacity: 0.82, depthWrite: false }));
    this.cortina.position.set(cx, MAISON.puertaAlto / 2, cz + 0.06);
    this.raiz.add(this.cortina);
  }

  _ponerPuerta(p, k) {
    p.userData.k = k;
    p.rotation.y = p.userData.abierta + (p.userData.cerrada - p.userData.abierta) * k;
  }

  /** ¿Qué tan cerrada quedaría la puerta si la manija siguiera al rayo del puntero? (0 a 1) */
  _puertaSegunRayo(p, puntero) {
    const previo = p.userData.k;
    let mejor = previo;
    let menor = Infinity;
    for (let i = 0; i <= 40; i++) {
      this._ponerPuerta(p, i / 40);
      p.updateMatrixWorld(true);
      const v = p.localToWorld(p.userData.manija.clone()).sub(puntero.origen);
      const d = v.addScaledVector(puntero.dir, -Math.max(0, v.dot(puntero.dir))).length();
      if (d < menor) {
        menor = d;
        mejor = i / 40;
      }
    }
    this._ponerPuerta(p, previo);
    return mejor;
  }

  // ── Los cuartos: lo que se puede tocar ───────────────────────────────────

  _crearChambre() {
    const L = MAISON.local.chambre;
    const m = this.marcos.chambre;
    this.tablette = piezas.tablette();
    this.tablette.position.set(...L.tablette);
    this.tablette.rotation.x = -0.3;
    this.tablette.userData.centroHalo = V(0, 0.1, -0.03);
    this.tablette.userData.tamHalo = 0.5;
    m.add(this.tablette);
    this._objeto('chambre', 'tablette', this.tablette, V(L.tablette[0], L.tablette[1] + 0.28, L.tablette[2]));
    this._zonaMueble('chambre', 'livre', [L.livre[0], L.livre[1] + 0.04, L.livre[2]], [0.3, 0.12, 0.24], V(L.livre[0], L.livre[1] + 0.2, L.livre[2]));
    this._zonaMueble('chambre', 'lampe', [L.lampe[0], L.lampe[1] + 0.2, L.lampe[2]], [0.26, 0.44, 0.26], V(L.lampe[0] + 0.05, L.lampe[1] + 0.52, L.lampe[2]));
    // Botones en la pantalla (solo cuando la tiene en las manos)
    this.botonesTablette = {
      eteindre: this._botonRedondo('⏻', '#e3262c', () => this.alBoton?.('eteindre'), 0.062),
      volume: this._botonRedondo('🔊', '#2f4a8a', () => this.alBoton?.('volume'), 0.062),
    };
    this.botonesTablette.eteindre.position.set(-0.062, 0.058, 0.012);
    this.botonesTablette.volume.position.set(0.062, 0.058, 0.012);
    for (const b of Object.values(this.botonesTablette)) {
      this.tablette.add(b);
      b.visible = false;
    }
    this._dibujarTablette(0);
  }

  _dibujarTablette(t) {
    this.tablette.userData.pantalla.userData.redibujar((ctx, w, h) => {
      if (!this.estado.tablette) {
        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, w, h);
        return;
      }
      const gr = ctx.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#3ec5ff');
      gr.addColorStop(1, '#8f6bff');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      // Un jueguito que no para: estrellas y notas que saltan
      for (let i = 0; i < 6; i++) {
        const x = ((i * 67 + t * 60) % (w + 40)) - 20;
        const y = h * 0.34 + Math.sin(t * 4 + i) * h * 0.16;
        ctx.font = `${Math.round(h * 0.2)}px system-ui, "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(['⭐', '🎵', '🎮', '🎵', '⭐', '🎶'][i], x, y);
      }
    });
  }

  _crearSalon() {
    const L = MAISON.local.salon;
    const m = this.marcos.salon;
    // Pantalla de la tele
    this.ecran = new PanelLienzo(1.28, 0.72, (ctx, w, h) => this._dibujarTele(ctx, w, h), { pxPorMetro: 400 });
    this.ecran.material.alphaTest = 0;
    this.ecran.material.transparent = false;
    this.ecran.position.set(...L.tele);
    m.add(this.ecran);
    this.tele = new THREE.Group();
    this.tele.position.set(...L.tele);
    this.tele.add(new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.72), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    this.tele.children[0].position.z = 0.01;
    this.tele.userData.tamHalo = 0.9;
    this.tele.userData.centroHalo = V(0, 0, 0.03);
    m.add(this.tele);
    this._objeto('salon', 'tele', this.tele, V(L.tele[0] - 0.42, L.tele[1] - 0.46, L.tele[2] + 0.12));
    // Control remoto sobre la mesita
    this.telecommande = piezas.telecommande();
    this.telecommande.position.set(...L.telecommande);
    this.telecommande.rotation.set(-0.45, 0.25, 0);
    this.telecommande.userData.centroHalo = V(0, 0.1, 0.02);
    this.telecommande.userData.tamHalo = 0.32;
    m.add(this.telecommande);
    this._objeto('salon', 'telecommande', this.telecommande, V(L.telecommande[0], L.telecommande[1] + 0.2, L.telecommande[2]));
    this._zonaMueble('salon', 'canape', L.canape, [0.9, 0.9, 1.9], V(L.canape[0] + 0.1, 1.08, L.canape[2]));
    this._zonaMueble('salon', 'lampe', L.lampe, [0.4, 0.6, 0.4], V(L.lampe[0] - 0.1, L.lampe[1] + 0.48, L.lampe[2]));
    const bt = this.telecommande.userData.botones;
    this.botonesTele = {
      eteindre: this._botonRedondo('⏻', '#e3262c', () => this.alBoton?.('eteindre'), 0.034),
      plus: this._botonRedondo('+', '#2f4a8a', () => this.alBoton?.('plus'), 0.034),
      moins: this._botonRedondo('−', '#2f4a8a', () => this.alBoton?.('moins'), 0.034),
    };
    this.botonesTele.eteindre.position.copy(bt.apagar);
    this.botonesTele.plus.position.copy(bt.mas);
    this.botonesTele.moins.position.copy(bt.menos);
    for (const b of Object.values(this.botonesTele)) this.telecommande.add(b);
  }

  _dibujarTele(ctx, w, h) {
    const t = this._t ?? 0;
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ff8a5c');
    gr.addColorStop(1, '#ffd23c');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    // Un concierto de dibujos animados: barras que saltan con la música
    const vol = this.estado.volume;
    for (let i = 0; i < 12; i++) {
      const alto = (0.15 + Math.abs(Math.sin(t * 5 + i * 1.3)) * 0.4) * h * (0.35 + vol / 14);
      ctx.fillStyle = ['#e3262c', '#2347b8', '#ffffff', '#2dbe78'][i % 4];
      ctx.fillRect(30 + i * ((w - 60) / 12), h * 0.72 - alto, (w - 60) / 12 - 8, alto);
    }
    ctx.font = `${Math.round(h * 0.2)}px system-ui, "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎤', w * 0.5 + Math.sin(t * 2) * w * 0.06, h * 0.24);
    ctx.fillText('🎶', w * 0.2, h * 0.2 + Math.sin(t * 3) * 10);
    ctx.fillText('🎵', w * 0.8, h * 0.2 + Math.cos(t * 3) * 10);
    // Barra de volumen
    ctx.fillStyle = 'rgba(13, 20, 38, 0.82)';
    ctx.beginPath();
    ctx.roundRect(w * 0.14, h * 0.78, w * 0.72, h * 0.17, 18);
    ctx.fill();
    ctx.fillText('🔊', w * 0.2, h * 0.868);
    for (let i = 0; i < 10; i++) {
      const x = w * 0.27 + i * (w * 0.055);
      ctx.fillStyle = i < vol ? (vol > 3 ? '#ff5c5c' : '#3ddc84') : 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, h * 0.868 - (8 + i * 2.2), w * 0.04, 16 + i * 4.4);
    }
  }

  _crearCuisine() {
    const L = MAISON.local.cuisine;
    const m = this.marcos.cuisine;
    this.interrupteur = piezas.interrupteur();
    this.interrupteur.position.set(...L.interrupteur);
    const brillo = this.halo(0.34, '#ffb347');
    brillo.position.z = 0.02;
    brillo.userData.encendido = true;
    this.interrupteur.add(brillo);
    this.interrupteur.userData.brillo = brillo;
    this.interrupteur.userData.tamHalo = 0.36;
    this.interrupteur.userData.centroHalo = V(0, 0, 0.03);
    m.add(this.interrupteur);
    this._objeto('cuisine', 'interrupteur', this.interrupteur, V(L.interrupteur[0], L.interrupteur[1] + 0.17, L.interrupteur[2] + 0.03));
    this._zonaMueble('cuisine', 'frigo', L.frigo, [0.7, 1.8, 0.66], V(L.frigo[0], 1.98, L.frigo[2] + 0.3));
    this._zonaMueble('cuisine', 'robinet', L.robinet, [0.3, 0.3, 0.3], V(L.robinet[0], L.robinet[1] + 0.26, L.robinet[2]));
    // Bombilla y resplandor (se ven al encender)
    this.bombilla = new THREE.Group();
    this.bombilla.position.set(...L.plafonnier);
    this.bombilla.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1c2' })));
    const resplandor = this.halo(1.1, '#ffe9a8');
    resplandor.userData.encendido = true;
    resplandor.rotation.x = Math.PI / 2;
    resplandor.position.y = -0.02;
    this.bombilla.add(resplandor);
    this.bombilla.visible = false;
    m.add(this.bombilla);
  }

  _crearBain() {
    const L = MAISON.local.bain;
    this._zonaMueble('bain', 'baignoire', L.baignoire, [1.7, 0.7, 0.76], V(L.baignoire[0], 0.95, L.baignoire[2]));
  }

  _ponerLuz(encendida) {
    this.estado.lumiere = encendida;
    this.interrupteur.userData.poner(encendida);
    this.interrupteur.userData.brillo.visible = !encendida;
    this.bombilla.visible = encendida;
    this.cortina.visible = !encendida;
    this._oscurecer();
  }

  /** La casa tiene vida propia: la tablet y la tele suenan, el agua corre, las huellas laten. */
  _vidaCasa(dt, t) {
    const e = this.estado;
    const audio = this.m.audio;
    const bajo = audio.hablando ? 0.3 : 1;
    for (const h of [...Object.values(this.huellas), ...Object.values(this.salidas)]) if (h.visible) h.userData.animar(t);
    for (const z of Object.values(this.zonaPuerta)) if (z.visible) z.material.opacity = 0.1 + Math.abs(Math.sin(t * 2.4)) * 0.14;
    if (this._destruida || this.silencio) return;
    // Tablet: un jueguito con su musiquita
    if (e.tablette) {
      if (this.nodo === 'chambre' && Math.floor(t * 8) !== Math.floor((t - dt) * 8)) this._dibujarTablette(t);
      if (Math.floor(t * 4.5) !== Math.floor((t - dt) * 4.5)) {
        const nota = [784, 988, 1175, 988, 880, 1175, 1319, 988][Math.floor(t * 4.5) % 8];
        audio.tono(nota, 0.16, { tipo: 'sine', volumen: (this.volTablette ?? 0.05) * bajo, pos: this.posMundo(this.tablette) });
      }
    }
    // Tele: un concierto, más fuerte cuanto más alto el volumen
    if (this.nodo === 'salon' && Math.floor(t * 10) !== Math.floor((t - dt) * 10)) this.ecran.redibujar();
    if (e.volume > 0 && Math.floor(t * 3.6) !== Math.floor((t - dt) * 3.6)) {
      const i = Math.floor(t * 3.6) % 8;
      const pos = this.posMundo(this.ecran);
      const v = 0.021 * e.volume * bajo;
      audio.tono([262, 330, 392, 330, 349, 440, 392, 330][i], 0.24, { tipo: 'triangle', volumen: v, pos });
      if (i % 2 === 0) audio.tono([131, 175, 196, 175][i / 2], 0.3, { tipo: 'triangle', volumen: v * 0.8, pos });
    }
    // Baño: el agua corre hasta que se cierra la puerta
    if (!e.porte && Math.floor(t * 2.6) !== Math.floor((t - dt) * 2.6)) {
      audio.rafaga({ duracion: 0.5, filtro: 'highpass', frecuencia: 3200, volumen: 0.05 * bajo, pos: this._mundo(this._enMarco('bain', -0.7, 0.6, -1.37)) });
    }
  }

  // ── Saludo con la mano ───────────────────────────────────────────────────

  /** Espera que el estudiante mueva la mano de lado a lado (o toque 👋 en la vista previa). */
  _esperarOla(clave = null) {
    return new Promise((resolver) => {
      const { H } = this;
      const historia = new Map();
      let hecho = false;
      let boton = null;
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
      const mostrarBoton = () => {
        if (hecho || boton) return;
        boton = this.boton('👋 Bonjour !', terminar, { ancho: 0.34, alto: 0.12, color: '#21a366', tam: 42 });
        boton.position.set(0, H - 0.3, -0.95);
        encarar(boton, V(0, H, 0.2));
        this.zona.add(boton);
        this.m.fx.aparecer(boton, 0.35);
      };
      if (!this.m.app.enVR) mostrarBoton();
      else this.esperar(7).then(mostrarBoton);
      this.cadaCuadro((_dt, t) => {
        if (hecho || !this.m.app.enVR) return;
        for (const p of this.m.entrada.punteros) {
          if (p.tipo !== 'xr' || !p.activo || !p.objeto) continue;
          // Movimiento de lado a lado respecto a hacia dónde mira el estudiante
          const { der } = this.mirada();
          const x = this.raiz.worldToLocal(p.objeto.getWorldPosition(V())).dot(der);
          const h = historia.get(p) ?? { dir: 0, cambios: [], extremo: x };
          const dx = x - h.extremo;
          if (Math.abs(dx) > 0.06) {
            if (h.dir && Math.sign(dx) !== h.dir) h.cambios.push(t);
            h.dir = Math.sign(dx);
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

  _fallo(meta, pos = null) {
    this.reg[meta].errores++;
    this.perder();
    this.m.audio.error(pos ?? this.posMundo(this.coco));
    this.gesto(azar(['no', 'duda']), 1.1);
  }

  _logro(meta, obj, puntos, completa = true) {
    this.ganar(obj, puntos);
    if (!completa || this.reg[meta].hecho) return;
    this.reg[meta].hecho = true;
    this.panel.redibujar();
  }

  /**
   * Escalera de ayuda: nivel 1 → se repite la orden; 2 → Coco señala y aparecen los
   * nombres; 3 → además aparece la traducción. Los niveles 2 y 3 cuentan como ayuda.
   */
  async _ayudar(meta, nivel, { orden, objetivo = null, resaltar = null, mostrar = null }) {
    if (nivel >= 2) {
      this.reg[meta].ayuda = true;
      mostrar?.();
      resaltar?.(true);
      const punto = objetivo?.();
      if (punto) this.gesto('senalar', 2.4, punto);
      await this.decir('regarde');
    }
    if (nivel >= 3 && !this.traducir) {
      this.alternarTraduccion(true);
      this.traduccionDeAyuda = true;
    }
    if (orden) await this.decir(orden, { repetible: true });
  }

  /** Señal 👆 que rebota sobre un punto del mundo. */
  _senal(punto) {
    const s = new PanelLienzo(0.14, 0.14, (ctx, w, h) => escribir(ctx, '👆', w / 2, h / 2, { tam: 110, alinear: 'center', base: 'middle' }));
    const base = this.raiz.worldToLocal(punto.clone()).add(V(0, 0.18, 0));
    s.position.copy(base);
    this.raiz.add(s);
    this.cadaCuadro((_dt, t) => {
      if (!s.parent) return;
      s.position.y = base.y + Math.abs(Math.sin(t * 4)) * 0.05;
      const { cab } = this.mirada();
      s.lookAt(this._mundo(cab));
    });
    return s;
  }

  /**
   * Si el estudiante lleva un rato sin avanzar, aparece la instrucción en español, Coco
   * repite la orden y (si hay `objetivo`) señala dónde actuar. Devuelve cómo detenerlo.
   */
  _recordar({ clave = null, objetivo = null, cada = 13 } = {}) {
    let activo = true;
    let senal = null;
    let proximo = (this._t ?? 0) + cada;
    this.cadaCuadro((_dt, t) => {
      if (!activo) return;
      const ocupado = this.m.audio.hablando || this.viajando || this.ruta.length || this.dialogo || this.m.entrada.punteros.some((p) => p.agarrado);
      if (ocupado) {
        proximo = Math.max(proximo, t + 4);
        return;
      }
      if (t < proximo) return;
      proximo = t + cada;
      this.pasoEs = true;
      this.panel.redibujar();
      this.m.fx.latido(this.panel, 0.03);
      const p = objetivo?.();
      senal?.removeFromParent();
      senal = null;
      if (p) {
        this.gesto('senalar', 2, p);
        senal = this._senal(p);
      }
      if (clave) this.decir(clave);
    });
    return () => {
      activo = false;
      senal?.removeFromParent();
      if (this.pasoEs) {
        this.pasoEs = false;
        this.panel.redibujar();
      }
    };
  }

  // ── Secuencia ────────────────────────────────────────────────────────────

  async vozInicial() {
    const misiones = this.datos.missions ?? [];
    const etapas = [() => this.bienvenue(), () => this.visite(), ...misiones.map((mi, i) => () => this.mision(mi, i))];
    try {
      const { rig, camara, enVR } = this.m.app;
      if (enVR) this.yawNeutro = yawDe(camara.getWorldDirection(V())) - rig.rotation.y;
      await this.esperar(0.5);
      if (this.desde > 0) this._prepararDesde(this.desde);
      for (let i = this.desde; i < etapas.length; i++) await etapas[i]();
      await this.fete();
    } catch (e) {
      if (!this._destruida) throw e;
    }
  }

  /** Deja la casa como estaría al empezar la parte `n` (al volver o repetir una parte). */
  _prepararDesde(n) {
    this._irA('couloir', { instantaneo: true });
    if (n >= 2) for (const id of CUARTOS) this.revelados.add(id);
    if (n >= 3) this.estado.tablette = false;
    if (n >= 4) this.estado.volume = 2;
    if (n >= 5) this._ponerLuz(true);
    this._dibujarTablette(0);
    this._redibujarRotulos();
    this.panel.redibujar();
  }

  /** Espera a que el estudiante llegue caminando a un lugar. */
  _esperarLlegada(nombre) {
    if (this.nodo === nombre) return Promise.resolve();
    return new Promise((resolver) => {
      this.alLlegar = (n) => {
        if (n !== nombre) return;
        this.alLlegar = null;
        resolver();
      };
    });
  }

  async bienvenue() {
    this._etapa(0);
    this.metaActual = 'saluer';
    // Timbre: el estudiante acaba de llegar a la casa de Coco
    const puerta = this._mundo(V(0, 1.2, 1.7));
    [[784, 0], [659, 0.35]].forEach(([f, r]) => this.m.audio.tono(f, 0.7, { volumen: 0.09, retardo: r, pos: puerta }));
    await this.esperar(0.9);
    this.gesto('saludo', 2.4);
    await this.decir('bonjour', { repetible: true });
    await this.decir('saluerMain', { repetible: true });
    this._ponerPaso('salue');
    await this._esperarOla('saluerMain');
    this.gesto('saludo', 1.6);
    this.m.audio.acierto(this.posMundo(this.coco));
    this._logro('saluer', this.coco, 50);
    // Primeros pasos: caminar hasta donde está Coco
    await this.decir('entre', { repetible: true });
    this._ponerPaso('avance');
    this.puedeIr = new Set(['couloir']);
    this._actualizarHuellas();
    const parar = this._recordar({ clave: 'entre', objetivo: () => this.posMundo(this.huellas.couloir).add(V(0, 1.2, 0)) });
    await this._esperarLlegada('couloir');
    parar();
    this.puedeIr = new Set();
    this._actualizarHuellas();
    this.ganar(this.coco, 50);
    await this.elogio();
  }

  async visite() {
    this._etapa(1);
    this.metaActual = 'visiter';
    await this.decir('maison', { repetible: true });
    this._ponerPaso('portes');
    const vistos = new Set();
    await new Promise((resolver) => {
      let ocupado = false;
      const parar = this._recordar({ clave: 'maison', objetivo: () => this._puerta(CUARTOS.find((id) => !vistos.has(id)) ?? 'chambre', 1.5) });
      const tocar = async (id) => {
        if (ocupado || this.viajando) return;
        ocupado = true;
        const nuevo = !vistos.has(id);
        vistos.add(id);
        this.revelados.add(id);
        const cartel = this.letrero[id];
        cartel.userData.encender(true);
        this.m.fx.latido(cartel, 0.12);
        this.gesto('senalar', 2.6, this._puerta(id, 1.3));
        this.m.audio.tono(1047, 0.12, { volumen: 0.08, pos: this.posMundo(cartel) });
        if (nuevo) this.ganar(cartel, 25);
        await this.decir(this.pieces[id].voici);
        cartel.userData.encender(false);
        ocupado = false;
        if (vistos.size === CUARTOS.length) {
          parar();
          resolver();
        }
      };
      for (const id of CUARTOS) {
        const zona = this.zonaPuerta[id];
        zona.visible = true;
        for (const o of [zona, this.letrero[id]]) this.interactivo(o, { alPasar: (v) => v && this.m.fx.latido(this.letrero[id], 0.05), alSeleccionar: () => tocar(id) });
      }
    });
    for (const id of CUARTOS) {
      this.zonaPuerta[id].visible = false;
      for (const o of [this.zonaPuerta[id], this.letrero[id]]) this.m.entrada.desregistrar(o);
    }
    this.reg.visiter.hecho = true;
    this.panel.redibujar();
    await this.elogio();
    await this.decir('aide');
  }

  /**
   * Una misión: escuchar la orden, caminar al cuarto correcto y hacer la acción.
   * apoyo: "accompagne" (Coco va contigo y señala) · "indices" (letreros y nombres a la
   * vista) · "seul" (sin letreros: de memoria y por lo que ves en cada cuarto).
   */
  async mision(mi, i) {
    this._etapa(2 + i);
    this.metaActual = mi.id;
    const apoyo = mi.appui ?? 'seul';
    this.letreros = apoyo !== 'seul';
    this.conEtiquetas = new Set(apoyo === 'seul' ? [] : [mi.id]);
    this.pista = null;
    this._redibujarRotulos();
    // En la misión de la puerta no se entra a ningún cuarto: sin huellas delante, las puertas quedan libres para agarrarlas.
    this.puedeIr = new Set(mi.id === 'bain' ? ['couloir'] : [...CUARTOS, 'couloir']);
    this._actualizarHuellas();
    this._ponerPaso('ecoute');
    await this.decir(mi.ordre, { repetible: true });
    if (mi.id === 'bain') await this._cerrarPuerta(mi);
    else {
      this._ponerPaso('vaPiece');
      if (apoyo === 'accompagne') await this._cocoGuia(mi);
      const errores = await this._esperarCuarto(mi, apoyo !== 'seul');
      this._logro(mi.id, this.coco, errores ? 50 : 100, false);
      this._ponerPaso('fais');
      await { chambre: () => this._apagarTablette(mi, apoyo), salon: () => this._bajarVolumen(mi, apoyo), cuisine: () => this._encenderLuz(mi, apoyo) }[mi.id]();
    }
    this.alObjeto = null;
    this.alBoton = null;
    this.ayuda = null;
    this.celebrar();
    await this.decir(mi.merci);
    if (this.traduccionDeAyuda) this.alternarTraduccion(false);
  }

  /** Misión acompañada: Coco va delante hasta la puerta y llama al estudiante. */
  async _cocoGuia(mi) {
    this.pista = mi.id;
    this.cocoLibre = true;
    const [x, z] = MAISON.puertas[mi.id].centro;
    const dentro = this._enMarco(mi.id, 0.6, 0, 1.9);
    this.cocoA([V(x * 0.55, 0, z), V(x, 0, z), dentro], 2.2);
    await this.decir('suisMoi', { repetible: false });
  }

  /** Espera a que el estudiante entre al cuarto de la misión; entrar a otro cuenta como error. */
  _esperarCuarto(mi, senalar) {
    const pieza = mi.id;
    return new Promise((resolver) => {
      let errores = 0;
      let nivel = 0;
      const haciaDonde = () => {
        if (this.nodo === 'couloir') return this.posMundo(this.huellas[pieza]).add(V(0, 1.25, 0));
        if (this.nodo !== pieza && this.salidas[this.nodo]) return this.posMundo(this.salidas[this.nodo]).add(V(0, 0.95, 0));
        return null;
      };
      const contexto = () => ({
        orden: mi.ordre,
        objetivo: haciaDonde,
        mostrar: () => {
          this.letreros = true;
          this.pista = pieza;
          this._redibujarRotulos();
        },
      });
      // Sin apoyo, el recordatorio solo repite la orden (y señala la salida si está en otro cuarto).
      const parar = this._recordar({ clave: mi.ordre, objetivo: () => (senalar || this.nodo !== 'couloir' ? haciaDonde() : null), cada: 14 });
      this.ayuda = () => this._ayudar(pieza, (nivel = Math.min(3, Math.max(nivel + 1, 2))), contexto());
      const llegar = async (nodo) => {
        if (nodo === pieza) {
          this.alLlegar = null;
          this.ayuda = null;
          this.pista = null;
          if (this.cocoLibre) {
            this.cocoLibre = false;
            this.cocoA([this._sitioCoco(pieza)], 2.4);
          }
          parar();
          resolver(errores);
          return;
        }
        if (nodo === 'couloir' || nodo === 'entree') return;
        if (this.cocoLibre) {
          // Coco iba delante, pero el estudiante entró a otro cuarto: va a buscarlo.
          this.cocoLibre = false;
          this._cocoAcompana('couloir', nodo);
        }
        errores++;
        nivel = Math.min(3, nivel + 1);
        this._fallo(pieza);
        await this.decir(this.pieces[nodo].non);
        await this._ayudar(pieza, nivel, contexto());
      };
      this.alLlegar = llegar;
      if (this.nodo === pieza) llegar(pieza);
    });
  }

  /** Reacción común cuando el estudiante toca un objeto que no es el de la orden. */
  _alEquivocarObjeto(mi, estado, contexto) {
    return async (cuarto, clave, nodo) => {
      if (estado.ocupado) return true;
      if (estado.correctos.includes(clave)) return false;
      estado.ocupado = true;
      estado.errores++;
      estado.nivel = Math.min(3, estado.nivel + 1);
      this.m.fx.sacudir(nodo, 0.02);
      this._fallo(mi.id, this.posMundo(nodo));
      const o = this.objets[clave];
      if (o?.non) await this.decir(o.non);
      await this._ayudar(mi.id, estado.nivel, contexto());
      estado.ocupado = false;
      return true;
    };
  }

  /** La chambre: tomar la tablet y apagarla con el botón ⏻. */
  _apagarTablette(mi, apoyo) {
    const tab = this.tablette;
    const botones = this.botonesTablette;
    return new Promise((resolver) => {
      const estado = { errores: 0, nivel: 0, ocupado: false, correctos: ['tablette'] };
      let tomada = false;
      const objetivo = () => this.posMundo(tomada ? botones.eteindre : tab).add(V(0, tomada ? 0.04 : 0.16, 0));
      const contexto = () => ({
        orden: mi.ordre,
        objetivo,
        resaltar: () => (tomada ? botones.eteindre.userData.pulsar(true) : this._resaltar(tab, true)),
        mostrar: () => {
          this.conEtiquetas.add('chambre');
          this._redibujarRotulos();
        },
      });
      const parar = this._recordar({ clave: mi.ordre, objetivo: apoyo !== 'seul' ? objetivo : null });
      this.ayuda = () => this._ayudar(mi.id, (estado.nivel = Math.min(3, Math.max(estado.nivel + 1, 2))), contexto());
      const equivocado = this._alEquivocarObjeto(mi, estado, contexto);
      if (apoyo === 'accompagne') {
        this.gesto('senalar', 2.6, this.posMundo(tab).add(V(0, 0.1, 0)));
        this._resaltar(tab, true);
        this.decir('voiciTablette');
      }
      this.alObjeto = async (cuarto, clave, nodo) => {
        if (await equivocado(cuarto, clave, nodo)) return;
        if (tomada) return;
        tomada = true;
        this._resaltar(tab, false);
        tab.userData.bloqueado = true;
        this._habilitarObjetos();
        await this._tomar(tab, { escala: 1.55, y: this.H - 0.3, z: -0.6 });
        this._activarBotones(botones, true, true);
        if (apoyo === 'accompagne') {
          botones.eteindre.userData.pulsar(true);
          this.decir('eteins');
        }
      };
      this.alBoton = async (boton) => {
        if (estado.ocupado) return;
        if (boton !== 'eteindre') {
          estado.ocupado = true;
          estado.errores++;
          estado.nivel = Math.min(3, estado.nivel + 1);
          this.volTablette = 0.12;
          this.gesto('oreilles', 1.6);
          this._fallo(mi.id, this.posMundo(tab));
          await this.decir('eteins');
          this.volTablette = 0.05;
          await this._ayudar(mi.id, estado.nivel, { ...contexto(), orden: null });
          estado.ocupado = false;
          return;
        }
        estado.ocupado = true;
        parar();
        this.estado.tablette = false;
        this._dibujarTablette(0);
        this.m.audio.tono(520, 0.3, { hasta: 120, volumen: 0.1, pos: this.posMundo(tab) });
        this._activarBotones(botones, false, true);
        this.m.audio.acierto(this.posMundo(tab));
        this._logro(mi.id, tab, estado.errores ? 75 : 150);
        await this.esperar(0.5);
        await this._devolver(tab);
        tab.userData.bloqueado = false;
        this._habilitarObjetos();
        resolver();
      };
    });
  }

  /** Le salon: tomar el control y bajar el volumen con el botón − (tres veces). */
  _bajarVolumen(mi, apoyo) {
    const control = this.telecommande;
    const botones = this.botonesTele;
    return new Promise((resolver) => {
      const estado = { errores: 0, nivel: 0, ocupado: false, correctos: ['tele', 'telecommande'] };
      let tomado = false;
      let avisado = false;
      const objetivo = () => this.posMundo(tomado ? botones.moins : control).add(V(0, tomado ? 0.05 : 0.2, 0));
      const contexto = () => ({
        orden: mi.ordre,
        objetivo,
        resaltar: () => (tomado ? botones.moins.userData.pulsar(true) : this._resaltar(control, true)),
        mostrar: () => {
          this.conEtiquetas.add('salon');
          this._redibujarRotulos();
        },
      });
      const parar = this._recordar({ clave: mi.ordre, objetivo: apoyo !== 'seul' ? objetivo : null });
      this.ayuda = () => this._ayudar(mi.id, (estado.nivel = Math.min(3, Math.max(estado.nivel + 1, 2))), contexto());
      const equivocado = this._alEquivocarObjeto(mi, estado, contexto);
      this.alObjeto = async (cuarto, clave, nodo) => {
        if (await equivocado(cuarto, clave, nodo)) return;
        if (tomado) return;
        tomado = true;
        this._resaltar(control, false);
        control.userData.bloqueado = this.tele.userData.bloqueado = true;
        this._habilitarObjetos();
        await this._tomar(control, { escala: 2.3, y: this.H - 0.4, z: -0.52 });
        this._activarBotones(botones, true);
      };
      this.alBoton = async (boton) => {
        if (estado.ocupado) return;
        const pos = this.posMundo(this.ecran);
        if (boton === 'moins') {
          this.estado.volume = Math.max(2, this.estado.volume - 2);
          this.ecran.redibujar();
          this.m.audio.tono(500 - (8 - this.estado.volume) * 30, 0.08, { volumen: 0.08 });
          if (this.estado.volume > 2) {
            if (!avisado) {
              avisado = true;
              this.decir('encore');
            }
            return;
          }
          estado.ocupado = true;
          parar();
          this._activarBotones(botones, false);
          this.m.audio.acierto(pos);
          this._logro(mi.id, this.ecran, estado.errores ? 75 : 150);
          await this.esperar(0.5);
          await this._devolver(control);
          control.userData.bloqueado = this.tele.userData.bloqueado = false;
          this._habilitarObjetos();
          resolver();
          return;
        }
        estado.ocupado = true;
        estado.errores++;
        estado.nivel = Math.min(3, estado.nivel + 1);
        this._fallo(mi.id, pos);
        if (boton === 'plus') {
          this.estado.volume = Math.min(10, this.estado.volume + 1);
          this.ecran.redibujar();
          this.gesto('oreilles', 1.8);
          await this.decir('tropFort');
        } else {
          await this.decir('pasEteindre');
        }
        await this._ayudar(mi.id, estado.nivel, { ...contexto(), orden: null });
        estado.ocupado = false;
      };
    });
  }

  /** La cuisine: está a oscuras; hay que encontrar el interruptor y encender la luz. */
  _encenderLuz(mi, apoyo) {
    const sw = this.interrupteur;
    return new Promise((resolver) => {
      const estado = { errores: 0, nivel: 0, ocupado: false, correctos: ['interrupteur'] };
      const objetivo = () => this.posMundo(sw).add(V(0, 0.1, 0));
      const contexto = () => ({
        orden: mi.ordre,
        objetivo,
        resaltar: () => this._resaltar(sw, true),
        mostrar: () => {
          this.conEtiquetas.add('cuisine');
          this._redibujarRotulos();
        },
      });
      const parar = this._recordar({ clave: mi.ordre, objetivo: apoyo !== 'seul' ? objetivo : null, cada: 15 });
      this.ayuda = () => this._ayudar(mi.id, (estado.nivel = Math.min(3, Math.max(estado.nivel + 1, 2))), contexto());
      const equivocado = this._alEquivocarObjeto(mi, estado, contexto);
      this.decir('noir');
      this.alObjeto = async (cuarto, clave, nodo) => {
        if (await equivocado(cuarto, clave, nodo)) return;
        if (estado.ocupado) return;
        estado.ocupado = true;
        parar();
        this.m.audio.clac(this.posMundo(sw));
        this.m.entrada.punteros.forEach((p) => p.activo && p.vibrar(0.6, 60));
        this._resaltar(sw, false);
        this._ponerLuz(true);
        this.m.audio.acierto(this.posMundo(sw));
        this._logro(mi.id, sw, estado.errores ? 75 : 150);
        await this.esperar(0.7);
        resolver();
      };
    });
  }

  /** La salle de bain: desde el pasillo, tomar la manija y empujar la puerta hasta cerrarla. */
  _cerrarPuerta(mi) {
    const buena = this.puertas.bain;
    this._ponerPaso('vaPiece');
    return new Promise((resolver) => {
      let errores = 0;
      let nivel = 0;
      let ocupado = false;
      let listo = false;
      const objetivo = () => (this.nodo === 'couloir' ? buena.localToWorld(buena.userData.manija.clone()) : this.salidas[this.nodo] ? this.posMundo(this.salidas[this.nodo]).add(V(0, 0.95, 0)) : null);
      const contexto = () => ({
        orden: mi.ordre,
        objetivo,
        resaltar: () => this._resaltar(buena, true),
        mostrar: () => {
          this.letreros = true;
          this._redibujarRotulos();
        },
      });
      const parar = this._recordar({ clave: mi.ordre, objetivo: () => (this.nodo === 'couloir' ? null : objetivo()), cada: 14 });
      this.ayuda = () => this._ayudar(mi.id, (nivel = Math.min(3, Math.max(nivel + 1, 2))), contexto());
      const activar = () => {
        const enPasillo = this.nodo === 'couloir';
        for (const p of Object.values(this.puertas)) this.m.entrada.habilitar(p, enPasillo && !listo);
        if (enPasillo) this._ponerPaso('fais');
      };
      this.alLlegar = () => activar();
      activar();
      this.alPuerta = async (que, p, puntero) => {
        if (listo) return;
        if (p !== buena) {
          // La otra puerta no es: tiembla y Coco dice cuál es
          if (que !== 'agarrar' || ocupado) return;
          ocupado = true;
          errores++;
          nivel = Math.min(3, nivel + 1);
          this.m.fx.tween({ duracion: 0.5, alActualizar: (k) => this._ponerPuerta(p, Math.sin(k * Math.PI) * 0.12) });
          this._fallo(mi.id, p.localToWorld(p.userData.manija.clone()));
          await this.decir(this.lin.nonPorte ?? this.pieces.chambre.non);
          await this._ayudar(mi.id, nivel, contexto());
          ocupado = false;
          return;
        }
        if (que === 'mover') {
          const k = this._puertaSegunRayo(p, puntero);
          this._ponerPuerta(p, p.userData.k + (k - p.userData.k) * 0.35);
          if (Math.random() < 0.08) this.m.audio.tono(140 + Math.random() * 60, 0.05, { tipo: 'sawtooth', volumen: 0.012, pos: this.posMundo(p) });
        } else if (que === 'soltar') {
          if (p.userData.k < 0.8) return;
          listo = true;
          parar();
          this.alLlegar = null;
          for (const q of Object.values(this.puertas)) this.m.entrada.habilitar(q, false);
          this._resaltar(p, false);
          const k0 = p.userData.k;
          await this.m.fx.tween({ duracion: 0.25, alActualizar: (k) => this._ponerPuerta(p, k0 + (1 - k0) * k) });
          const pos = p.localToWorld(p.userData.manija.clone());
          this.m.audio.tono(110, 0.18, { tipo: 'triangle', volumen: 0.2, pos });
          this.m.audio.clac(pos);
          this.m.entrada.punteros.forEach((x) => x.activo && x.vibrar(0.8, 90));
          this.estado.porte = true;
          this.m.audio.acierto(pos);
          this.ganar(p, errores ? 125 : 250);
          this.reg[mi.id].hecho = true;
          this.panel.redibujar();
          await this.esperar(0.4);
          resolver();
        }
      };
    });
  }

  // ── Fiesta y logros ──────────────────────────────────────────────────────

  async fete() {
    this.alPuerta = null;
    this.alLlegar = null;
    this.ayuda = null;
    this.paso = null;
    this.puedeIr = new Set(['couloir']);
    this._actualizarHuellas();
    await this._esperarLlegada('couloir');
    this.puedeIr = new Set();
    this._actualizarHuellas();
    this.letreros = true;
    this._redibujarRotulos();
    this.silencio = true;
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.coco).add(V(0, 1.5, 0.4)), 150);
    this.gesto('celebra2', 1.6);
    await this.decir('fin');
    this.gesto('adios', 2.6);
    await this.decir('auRevoir');
    this._resultados();
  }

  _dibujarResultados(ctx, w, h) {
    tarjeta(ctx, w, h, { fondo: '#23304a', radio: 44 });
    escribir(ctx, '⭐ Bravo ! Tu as réussi !', 44, 34, { tam: 62, peso: 900, color: '#ffe9a8' });
    let y = 128;
    for (const [id, fr, es, emoji] of METAS) {
      const r = this.reg[id];
      const solo = r.hecho && !r.errores && !r.ayuda;
      const estrellas = !r.hecho ? '—' : solo ? '⭐⭐⭐' : r.ayuda ? '⭐' : '⭐⭐';
      escribir(ctx, `${emoji} ${this.traducir ? es : fr}`, 44, y, { tam: 42, tamMin: 30, peso: 700, color: '#ffffff', maxAncho: w * 0.68, maxAlto: 52 });
      escribir(ctx, estrellas, w - 44, y, { tam: 42, peso: 800, color: '#ffd27a', alinear: 'right' });
      y += 62;
    }
    const usos = METAS.reduce((s, [id]) => ({ r: s.r + this.reg[id].repetir, p: s.p + this.reg[id].pistas, t: s.t + this.reg[id].traduccion }), { r: 0, p: 0, t: 0 });
    const seg = this.registro?.segundos ?? 0;
    escribir(ctx, `🔊 ${usos.r} · 💡 ${usos.p} · 🌐 ${usos.t} · ⏱ ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`, 44, y + 4, { tam: 32, color: '#c9d4ee' });
    // Mensaje de cierre, debajo de las estrellas
    const cierre = this.datos.cierre;
    if (!cierre) return;
    const y0 = y + 62;
    ctx.fillStyle = '#fff4d6';
    rectRedondeado(ctx, 30, y0, w - 60, h - y0 - 30, 36);
    ctx.fill();
    escribir(ctx, cierre, w / 2, y0 + (h - y0 - 30) / 2, { tam: 60, tamMin: 36, peso: 900, color: '#23304a', alinear: 'center', base: 'middle', maxAncho: w - 130, maxAlto: h - y0 - 56, interlineado: 1.15 });
  }

  _resultados() {
    const { H } = this;
    this.registro = {
      metas: Object.fromEntries(METAS.map(([id]) => [id, { ...this.reg[id], independiente: this.reg[id].hecho && !this.reg[id].errores && !this.reg[id].ayuda }])),
      segundos: Math.round((performance.now() - this.inicio) / 1000),
    };
    this.panelCaja.visible = false;
    if (this.m.marcador) this.m.marcador.visible = false;
    const alto = this.datos.cierre ? 0.84 : 0.58;
    const panel = new PanelLienzo(1.1, alto, (ctx, w, h) => this._dibujarResultados(ctx, w, h));
    panel.position.set(0, H + (this.datos.cierre ? 0.36 : 0.26), -1.55);
    encarar(panel, V(0, H, 0));
    this.hud.add(panel);
    this.m.fx.aparecer(panel, 0.5);
    this.rotulos.push(panel);
    this.cocoLibre = true;
    this.cocoA([V(-0.95, 0, -2.35)], 2);
    const b = this.boton(this.t('continuar'), () => this.terminar(), { ancho: 0.5, alto: 0.13, color: COLORES.verde });
    b.position.set(0, H - 0.24, -1.2);
    encarar(b, V(0, H, 0.2));
    this.hud.add(b);
    this.m.fx.aparecer(b, 0.4);
  }
}
