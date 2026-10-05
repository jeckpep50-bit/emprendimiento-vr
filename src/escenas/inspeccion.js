import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { mosca } from '../mundo/prefabs/objetos.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Inspección sanitaria: objetos repartidos por el lugar (hay que girar y caminar).
 * Al tocar uno, se acerca al estudiante y aparece una ficha: ¿qué clave se incumple?
 * ¿o todo está bien? Se termina cuando se encuentran todos los riesgos.
 * datos: { titulo, instruccion?, radio?, textoSeguro?,
 *          categorias: [{ id, nombre, emoji?, color? }],
 *          elementos: [{ modelo, opciones?, tamano?, posicion: [x,y,z], rotacion?, nombre,
 *                        categoria: id | "ok", texto, pista?, moscas?,
 *                        acompanantes?: [{ modelo, posicion: [dx,dy,dz], tamano?, opciones?, rotacion? }] }] }
 */
export class EscenaInspeccion extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.categorias = d.categorias ?? [];
    this.riesgos = (d.elementos ?? []).filter((el) => el.categoria !== 'ok').length;
    this.encontrados = 0;
    this.activo = null;
    this._ultimaPista = -99;

    // Se puede caminar por todo el lugar: el área se centra donde empezó el usuario.
    const { app, anclaje } = this.m;
    app.limites.radio = d.radio ?? 1.8;
    app.limites.centro.set(anclaje.position.x, 0, anclaje.position.z);

    // Encabezado y botón de pista: acompañan la mirada del estudiante mientras recorre.
    this.hud = new THREE.Group();
    this.raiz.add(this.hud);
    this.cabecera = this.encabezado({ instruccion: d.instruccion || this.t('inspeccionInstruccion'), ancho: 1.4, alto: 0.46 });
    this.cabecera.position.set(0, 0, 0);
    this.cabecera.rotation.set(0, 0, 0);
    this.hud.add(this.cabecera);
    this.cabecera.derecha(this.t('riesgosProgreso', { n: 0, total: this.riesgos }));
    this.btnPista = this.boton(this.t('pistaBoton'), () => this._pista(), { ancho: 0.26, alto: 0.09, color: COLORES.amarillo, colorTexto: COLORES.texto, tam: 34 });
    this.btnPista.position.set(0.5, -0.3, 0.01);
    this.hud.add(this.btnPista);
    this.presentar(this.btnPista, 0.3);
    this.seguirMirada(this.hud, { distancia: 1.8, altura: H + 0.55 });

    this.nodos = (d.elementos ?? []).map((el, i) => this._crearElemento(el, i));
    this.mirarAlUsuario(this.nodos.map((n) => n.userData.cartel));
    this._crearFicha();

    this.cadaCuadro((dt, t) => {
      for (const n of this.nodos) {
        const u = n.userData;
        if (n === this.activo) u.contenido.rotation.y += dt * 0.7;
        else u.contenido.rotation.y *= Math.max(0, 1 - dt * 4);
        const meta = n === this.activo ? u.escalaInspeccion : u.encima ? 1.12 : 1;
        u.contenido.scale.setScalar(u.contenido.scale.x + (meta - u.contenido.scale.x) * Math.min(1, dt * 8));
        u.cartel.position.y = u.altoCartel + Math.sin(t * 2 + u.fase) * 0.015;
      }
    });
  }

  /** Envuelve un modelo centrado para que su base quede en y = 0. */
  _apoyar(modelo) {
    const g = new THREE.Group();
    modelo.position.y = modelo.userData.tam.y / 2;
    g.add(modelo);
    g.userData.tam = modelo.userData.tam;
    return g;
  }

  _crearElemento(el, i) {
    const nodo = new THREE.Group();
    const [x, y, z] = el.posicion;
    nodo.position.set(x, y, z);
    nodo.rotation.y = THREE.MathUtils.degToRad(el.rotacion ?? 0);
    const contenido = new THREE.Group();
    nodo.add(contenido);
    const principal = this._apoyar(this.modelo(el.modelo, { tamano: el.tamano ?? 0.28, ...el.opciones }));
    contenido.add(principal);
    let alto = principal.userData.tam.y;
    for (const a of el.acompanantes ?? []) {
      const m = this._apoyar(this.modelo(a.modelo, { tamano: a.tamano ?? 0.2, ...a.opciones }));
      const [ax = 0, ay = 0, az = 0] = a.posicion ?? [];
      m.position.set(ax, ay, az);
      m.rotation.y = THREE.MathUtils.degToRad(a.rotacion ?? 0);
      contenido.add(m);
      alto = Math.max(alto, ay + m.userData.tam.y);
    }
    if (el.moscas) this._moscas(nodo, contenido, el.moscas, alto);

    // Cartelito con lupa y nombre (gira para mirar al usuario)
    const cartel = new THREE.Group();
    const marca = new PanelLienzo(0.16, 0.16, (ctx, w, h) => this._dibujarMarca(ctx, w, h, nodo));
    const nombre = this.etiqueta(el.nombre, { ancho: 0.5, alto: 0.095, tam: 42 });
    nombre.position.y = -0.135;
    cartel.add(marca, nombre);
    nodo.add(cartel);
    Object.assign(nodo.userData, {
      el,
      contenido,
      cartel,
      marca,
      altoCartel: alto + 0.27,
      fase: i * 1.3,
      origen: nodo.position.clone(),
      resuelto: false,
      fallos: 0,
      escalaInspeccion: 1,
      mensaje: '',
    });
    cartel.position.y = nodo.userData.altoCartel;
    this.raiz.add(nodo);
    this.presentar(nodo, 0.2 + i * 0.06);

    this.interactivo(nodo, {
      proxy: true,
      alPasar: (v) => {
        if (this.activo) return;
        nodo.userData.encima = v;
        marca.redibujar();
      },
      alSeleccionar: () => this._inspeccionar(nodo),
    });
    return nodo;
  }

  _dibujarMarca(ctx, w, h, nodo) {
    const u = nodo.userData;
    const color = u.resuelto ? (u.el.categoria === 'ok' ? COLORES.primario : COLORES.verde) : COLORES.amarillo;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = u.encima ? '#ffffff' : 'rgba(20, 30, 60, 0.5)';
    ctx.stroke();
    escribir(ctx, u.resuelto ? '✔' : '🔍', w / 2, h / 2, { tam: 88, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
  }

  /** Moscas que vuelan alrededor del objeto (con su zumbido en 3D). */
  _moscas(nodo, contenido, cantidad, alto) {
    const lista = [];
    for (let i = 0; i < cantidad; i++) {
      const m = mosca();
      m.scale.setScalar(1.3);
      contenido.add(m);
      lista.push(m);
    }
    const sonido = this.m.audio.fuenteEspacial('zumbido');
    this._quitar.push(() => sonido.detener());
    const previa = V(0, 0, 0);
    this.cadaCuadro((_dt, t) => {
      if (nodo.userData.sinMoscas) return;
      lista.forEach((m, i) => {
        const a = t * (2.2 + i * 0.7) + i * 2;
        previa.copy(m.position);
        m.position.set(Math.cos(a) * 0.17, alto + 0.06 + Math.sin(t * 5 + i) * 0.04, Math.sin(a) * 0.17);
        m.rotation.y = -a;
        m.userData.animar?.(t);
      });
      sonido.mover(this.posMundo(lista[0]));
    });
    nodo.userData.moscas = { lista, sonido };
  }

  _espantarMoscas(nodo) {
    const moscas = nodo.userData.moscas;
    if (!moscas) return;
    nodo.userData.sinMoscas = true;
    moscas.sonido.detener();
    for (const m of moscas.lista) {
      this.m.fx.pixeles(this.posMundo(m), '#7dff9a', 16, 0.4);
      m.visible = false;
    }
  }

  // ── Ficha de inspección ──────────────────────────────────────────────────

  _crearFicha() {
    this.ficha = new THREE.Group();
    this.ficha.visible = false;
    this.raiz.add(this.ficha);
    this.panelFicha = new PanelLienzo(0.64, 0.38, (ctx, w, h) => this._dibujarFicha(ctx, w, h));
    this.panelFicha.position.y = 0.22;
    this.ficha.add(this.panelFicha);
    const opciones = [
      ...this.categorias.map((c) => ({ id: c.id, texto: `${c.emoji ?? ''} ${c.nombre}`.trim(), color: c.color ?? COLORES.primario })),
      { id: 'ok', texto: `✅ ${this.datos.textoSeguro ?? this.t('todoBien')}`, color: '#5b6886' },
    ];
    this.botones = opciones.map((op, i) => {
      const b = this.boton(op.texto, () => this._responder(op.id, b), { ancho: 0.31, alto: 0.09, color: op.color, tam: 30 });
      b.position.set(i % 2 ? 0.16 : -0.16, -0.03 - Math.floor(i / 2) * 0.1, 0.01);
      this.ficha.add(b);
      return b;
    });
    if (opciones.length % 2) this.botones.at(-1).position.x = 0;
    this.btnEntendido = this.boton(this.t('entendido'), () => this._cerrarFicha(), { ancho: 0.36, alto: 0.1, color: COLORES.verde });
    this.btnEntendido.position.set(0, -0.03 - Math.ceil(opciones.length / 2) * 0.1, 0.01);
    this.ficha.add(this.btnEntendido);
  }

  _inspeccionar(nodo) {
    if (this.activo || nodo.userData.resuelto) return;
    this.activo = nodo;
    const u = nodo.userData;
    u.mensaje = '';
    u.encima = false;
    for (const n of this.nodos) this.m.entrada.habilitar(n, false);
    u.cartel.visible = false;
    // De cerca se ve a un tamaño cómodo (máximo unos 24 cm).
    const tam = new THREE.Box3().setFromObject(u.contenido).getSize(V(0, 0, 0));
    u.escalaInspeccion = Math.min(1, 0.24 / Math.max(tam.x, tam.y, tam.z, 0.01)) * u.contenido.scale.x;

    // El objeto viene hacia el estudiante (a su izquierda) y la ficha aparece a su derecha.
    // Se ubica según hacia dónde mira la cabeza (ahí lo verá cómodo).
    const { cab, dir, der } = this.mirada();
    const destino = cab.clone().addScaledVector(dir, 0.75).addScaledVector(der, -0.36);
    destino.y = cab.y - 0.2;
    this.m.fx.moverA(nodo, destino, 0.6, suavizado.entradaSalida);
    this.m.audio.pop(this.posMundo(nodo));

    this.ficha.position.copy(cab).addScaledVector(dir, 0.9).addScaledVector(der, 0.12);
    this.ficha.position.y = cab.y - 0.1;
    this.ficha.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    for (const b of this.botones) {
      b.setModo('normal');
      b.setEncima(false);
      this.m.entrada.habilitar(b, true);
    }
    this.btnEntendido.visible = false;
    this.ficha.visible = true;
    this.panelFicha.redibujar();
    this.m.fx.aparecer(this.ficha, 0.4, 0.15);
    this.narrar(`${u.el.nombre}. ${this.t('fichaPregunta')}`);
  }

  _responder(id, boton) {
    const nodo = this.activo;
    if (!nodo || nodo.userData.resuelto) return;
    const u = nodo.userData;
    const el = u.el;
    const pos = this.posMundo(boton);
    if (id === el.categoria) {
      u.resuelto = true;
      for (const b of this.botones) {
        this.m.entrada.habilitar(b, false);
        b.setModo(b === boton ? 'correcto' : 'apagado');
      }
      this.m.audio.acierto(pos);
      this.ganar(pos, u.fallos ? 100 : 200);
      const cat = this.categorias.find((c) => c.id === el.categoria);
      u.mensaje = el.categoria === 'ok' ? this.t('fichaSegura') : `${this.t('fichaCorrecta')} ${cat ? `${cat.emoji ?? ''} ${cat.nombre}` : ''}`;
      if (el.categoria !== 'ok') {
        this.encontrados++;
        this.cabecera.derecha(this.t('riesgosProgreso', { n: this.encontrados, total: this.riesgos }));
        this._espantarMoscas(nodo);
      }
      this.m.fx.confeti(this.posMundo(nodo).add(V(0, 0.15, 0)), 30);
      this.btnEntendido.visible = true;
      this.m.entrada.habilitar(this.btnEntendido, true);
      this.m.fx.aparecer(this.btnEntendido, 0.35, 0.3);
      this.narrar(el.texto);
    } else {
      u.fallos++;
      this.m.entrada.habilitar(boton, false);
      boton.setModo('incorrecto');
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.sacudir(this.panelFicha, 0.02);
      const base = el.categoria === 'ok' ? this.t('fichaErrorSeguro') : id === 'ok' ? this.t('fichaErrorRiesgo') : this.t('fichaErrorClave');
      u.mensaje = el.pista ? `${base} ${el.pista}` : base;
    }
    this.panelFicha.redibujar();
    u.marca.redibujar();
  }

  _cerrarFicha() {
    const nodo = this.activo;
    if (!nodo) return;
    this.activo = null;
    this.ficha.visible = false;
    const u = nodo.userData;
    this.m.fx.moverA(nodo, u.origen, 0.6, suavizado.entradaSalida).then(() => {
      if (!this._destruida) u.cartel.visible = true;
    });
    for (const n of this.nodos) this.m.entrada.habilitar(n, !n.userData.resuelto);
    if (this.encontrados === this.riesgos && !this._completa) this._completar();
  }

  _dibujarFicha(ctx, w, h) {
    const nodo = this.activo;
    if (!nodo) return;
    const u = nodo.userData;
    const el = u.el;
    tarjeta(ctx, w, h, { radio: 40, borde: u.resuelto ? COLORES.verde : '#23304a', grosor: 10 });
    pastilla(ctx, `🔍 ${el.nombre}`, 32, 26, { tam: 34, fondo: '#23304a', color: '#ffffff' });
    if (u.resuelto) {
      const y = escribir(ctx, u.mensaje, 36, 100, { tam: 38, peso: 800, color: '#1b7f4f', maxAncho: w - 72, maxAlto: 100 });
      escribir(ctx, el.texto, 36, y + 8, { tam: 32, maxAncho: w - 72, maxAlto: h - y - 34 });
      return;
    }
    const y = escribir(ctx, this.t('fichaPregunta'), 36, 104, { tam: 44, peso: 800, maxAncho: w - 72 });
    if (u.mensaje) escribir(ctx, u.mensaje, 36, y + 12, { tam: 32, peso: 700, color: '#b35a00', maxAncho: w - 72, maxAlto: h - y - 40 });
  }

  // ── Pistas y final ───────────────────────────────────────────────────────

  /** Un haz de luz marca un riesgo que falta y suena desde allí (ayuda a ubicarlo). */
  _pista() {
    if (this.activo) return;
    const ahora = this.m.app.tiempo;
    if (ahora - this._ultimaPista < 12) return this.cabecera.mensaje(this.t('pistaEspera'), COLORES.naranja);
    const pendientes = this.nodos.filter((n) => !n.userData.resuelto && n.userData.el.categoria !== 'ok');
    if (!pendientes.length) return;
    this._ultimaPista = ahora;
    const nodo = pendientes[Math.floor(Math.random() * pendientes.length)];
    const haz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 3, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    haz.position.copy(nodo.userData.origen).add(V(0, 1.5, 0));
    this.raiz.add(haz);
    this.m.fx.tween({
      duracion: 6,
      curva: suavizado.lineal,
      alActualizar: (k) => (haz.material.opacity = Math.sin(k * Math.PI) * (0.35 + Math.sin(k * 40) * 0.1)),
      alTerminar: () => {
        haz.removeFromParent();
        haz.geometry.dispose();
        haz.material.dispose();
      },
    });
    for (let i = 0; i < 3; i++) this.m.audio.tono(1200, 0.25, { hasta: 1700, volumen: 0.12, retardo: i * 0.5, pos: this.posMundo(nodo) });
    this.cabecera.mensaje(this.t('pistaMensaje'), COLORES.naranja);
  }

  _completar() {
    this._completa = true;
    this.m.audio.exito();
    this.cabecera.mensaje(this.t('inspeccionCompleta'), COLORES.verde);
    this.btnPista.visible = false;
    const continuar = this.boton(this.t('continuar'), () => this.terminar(), { ancho: 0.5, alto: 0.14, color: COLORES.verde });
    continuar.position.set(0, -0.36, 0.02);
    this.hud.add(continuar);
    this.m.fx.aparecer(continuar);
    this.m.fx.confeti(this.posMundo(this.hud), 80);
  }
}
