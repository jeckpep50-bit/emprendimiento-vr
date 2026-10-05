import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { liberar, malla } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ICONOS = { boca: '👄', estomago: '🧪', intestino: '🌀', defensas: '🛡️' };
const LETRAS = ['A', 'B', 'C'];

/**
 * Viaje por el cuerpo humano (entorno "cuerpo"). En cada parada hay una acción
 * interactiva propia de la zona y luego una pregunta; entre paradas se viaja por
 * un túnel con fundidos suaves (cómodo en VR).
 * datos: { titulo, estaciones: [{ zona: boca|estomago|intestino|defensas, nombre, texto,
 *          tarea, pregunta, opciones: [2-3], correcta, explicacion }] }
 */
export class EscenaViaje extends EscenaBase {
  construir() {
    const { H } = this;
    this.estaciones = this.datos.estaciones ?? [];
    this.api = this.m.entorno?.api ?? null;
    this.actores = new THREE.Group();
    this.raiz.add(this.actores);
    this._registrados = [];
    this._animaciones = [];

    this.panel = new PanelLienzo(0.98, 0.64, (ctx, w, h) => this._dibujar(ctx, w, h));
    this.panel.position.set(-0.48, H + 0.02, -1.35);
    this.panel.lookAt(0, H, 0);
    this.raiz.add(this.panel);
    this.presentar(this.panel);

    this.botones = LETRAS.map((_, i) => {
      const b = this.boton('', () => this._responder(i), { ancho: 0.96, alto: 0.1, color: '#e6ebf8', colorTexto: COLORES.texto, alinear: 'left', tam: 32 });
      b.position.set(-0.48, H - 0.39 - i * 0.115, -1.3);
      b.lookAt(0, H, 0);
      b.visible = false;
      this.raiz.add(b);
      return b;
    });
    this.btnSiguiente = this.boton(this.t('siguienteParada'), () => this._siguiente(), { ancho: 0.48, alto: 0.13, color: COLORES.verde });
    this.btnSiguiente.position.set(0.38, H - 0.42, -1.15);
    this.btnSiguiente.lookAt(0, H, 0);
    this.btnSiguiente.visible = false;
    this.raiz.add(this.btnSiguiente);

    this.tunel = this._crearTunel();
    this.cadaCuadro((dt, t) => {
      for (const fn of this._animaciones) fn(dt, t);
      if (this.tunel.visible) this.tunel.userData.textura.offset.y -= dt * this.tunel.userData.velocidad;
    });
    this._llegar(0);
  }

  // ── Paradas ──────────────────────────────────────────────────────────────

  _llegar(i) {
    this.indiceEstacion = i;
    const est = this.estaciones[i];
    this.fase = 'tarea';
    this.hechos = 0;
    this.respuesta = null;
    this.api?.mostrar(est.zona);
    this._limpiarActores();
    const preparar = { boca: this._zonaBoca, estomago: this._zonaEstomago, intestino: this._zonaIntestino, defensas: this._zonaDefensas }[est.zona];
    this.objetivo = preparar ? preparar.call(this) : 0;
    for (const b of this.botones) b.visible = false;
    this.btnSiguiente.visible = false;
    this.panel.redibujar();
    this.narrar(`${est.nombre}. ${est.texto}`);
    if (!this.objetivo) this._mostrarPregunta();
  }

  /** Una acción de la tarea quedó hecha. */
  _hecho(pos) {
    this.hechos++;
    this.ganar(pos, 50);
    this.panel.redibujar();
    if (this.hechos === this.objetivo) {
      this.m.fx.tween({ duracion: 1.2 }).then(() => !this._destruida && this._mostrarPregunta());
    }
  }

  _mostrarPregunta() {
    const est = this.estaciones[this.indiceEstacion];
    this.fase = 'pregunta';
    this.m.audio.acierto();
    this.botones.forEach((b, i) => {
      const texto = est.opciones[i];
      b.visible = texto !== undefined;
      if (!b.visible) return;
      b.setModo('normal');
      b.setTexto(`${LETRAS[i]}.  ${texto}`);
      this.m.entrada.habilitar(b, true);
      this.m.fx.aparecer(b, 0.35, i * 0.08);
    });
    this.panel.redibujar();
    this.m.fx.latido(this.panel, 0.03);
    this.narrar(est.pregunta);
  }

  _responder(i) {
    if (this.fase !== 'pregunta') return;
    const est = this.estaciones[this.indiceEstacion];
    this.fase = 'respuesta';
    this.respuesta = i;
    const bien = i === est.correcta;
    this.botones.forEach((b, k) => {
      this.m.entrada.habilitar(b, false);
      b.setModo(k === est.correcta ? 'correcto' : k === i ? 'incorrecto' : 'apagado');
    });
    const pos = this.posMundo(this.botones[i]);
    if (bien) {
      this.m.audio.acierto(pos);
      this.ganar(pos, 200);
      this.m.fx.confeti(pos, 30);
    } else {
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.sacudir(this.botones[i]);
    }
    this.panel.redibujar();
    this.narrar(est.explicacion);
    const ultima = this.indiceEstacion === this.estaciones.length - 1;
    this.btnSiguiente.setTexto(ultima ? this.t('continuar') : this.t('siguienteParada'));
    this.btnSiguiente.visible = true;
    this.m.fx.aparecer(this.btnSiguiente, 0.35, 0.3);
  }

  _siguiente() {
    if (this.indiceEstacion >= this.estaciones.length - 1) return this.terminar();
    this._viajar(this.indiceEstacion + 1);
  }

  /** Fundido → túnel en movimiento con "¡fiuuu!" → fundido → nueva zona. */
  async _viajar(i) {
    if (this._viajando) return;
    this._viajando = true;
    const fx = this.m.fx;
    for (const b of [...this.botones, this.btnSiguiente]) b.visible = false;
    this.m.audio.soplido();
    await fx.fundido(true, 0.3);
    if (this._destruida) return;
    this.panel.visible = false;
    this._limpiarActores();
    for (const z of Object.values(this.api?.zonas ?? {})) z.visible = false;
    const destino = this.estaciones[i];
    this.tunel.userData.aviso.actualizar({ texto: this.t('viajando', { destino: destino.nombre }) });
    this.tunel.visible = true;
    await fx.fundido(false, 0.3);
    await fx.tween({
      duracion: 1.6,
      persistente: true,
      curva: suavizado.lineal,
      alActualizar: (k) => (this.tunel.userData.velocidad = 0.6 + Math.sin(k * Math.PI) * 2.2),
    });
    if (this._destruida) return;
    await fx.fundido(true, 0.3);
    if (this._destruida) return;
    this.tunel.visible = false;
    this.panel.visible = true;
    this._llegar(i);
    await fx.fundido(false, 0.45);
    this._viajando = false;
  }

  _crearTunel() {
    const { H } = this;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#7a1424');
    g.addColorStop(0.5, '#e5627a');
    g.addColorStop(1, '#7a1424');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 256);
    const textura = new THREE.CanvasTexture(c);
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(6, 10);
    const tunel = new THREE.Group();
    tunel.add(malla(new THREE.CylinderGeometry(1.9, 1.9, 30, 32, 1, true), new THREE.MeshBasicMaterial({ map: textura, side: THREE.BackSide, fog: false }), [0, H, 0], [Math.PI / 2, 0, 0]));
    const aviso = this.etiqueta('', { ancho: 1.1, alto: 0.12, fondo: 'rgba(13, 20, 38, 0.85)', color: '#ffffff', tam: 50 });
    aviso.position.set(0, H + 0.1, -1.6);
    tunel.add(aviso);
    tunel.userData = { textura, aviso, velocidad: 0 };
    tunel.visible = false;
    this.raiz.add(tunel);
    return tunel;
  }

  // ── Actores de cada zona ─────────────────────────────────────────────────

  _limpiarActores() {
    for (const o of this._registrados) this.m.entrada.desregistrar(o);
    this._registrados = [];
    this._animaciones = [];
    for (const hijo of [...this.actores.children]) {
      this.actores.remove(hijo);
      liberar(hijo);
    }
  }

  /** Objeto que se puede tocar una sola vez. */
  _tocable(obj, accion) {
    this.m.entrada.registrar(obj, {
      proxy: true,
      alPasar: (v) => obj.scale.setScalar(v ? 1.18 : 1),
      alSeleccionar: () => {
        this.m.entrada.desregistrar(obj);
        obj.scale.setScalar(1);
        accion();
      },
    });
    this._registrados.push(obj);
  }

  /** Microbio con halo de color que flota en su lugar. */
  _microbio(tipo, pos, { tamano = 0.14, color = COLORES.rojo, caracter = 'malo' } = {}) {
    const nodo = new THREE.Group();
    const m = this.modelo(tipo, { tamano, caracter });
    const halo = this.halo(tamano * 2.2, color);
    halo.userData.encendido = true;
    halo.position.z = -0.04;
    nodo.add(m, halo);
    nodo.position.copy(pos);
    nodo.lookAt(0, pos.y, 0);
    nodo.userData.base = pos.clone();
    nodo.userData.halo = halo;
    this.actores.add(nodo);
    this.m.fx.aparecer(nodo, 0.4, Math.random() * 0.3);
    const fase = Math.random() * 6;
    this._animaciones.push((_dt, t) => {
      if (!nodo.userData.libre) nodo.position.y = nodo.userData.base.y + Math.sin(t * 1.5 + fase) * 0.03;
    });
    return nodo;
  }

  /** Arco de posiciones delante y a la derecha del panel. */
  _arco(n, { radio = 1.5, desde = -10, hasta = 60, y = 0 } = {}) {
    return Array.from({ length: n }, (_, i) => {
      const a = THREE.MathUtils.degToRad(desde + ((hasta - desde) * i) / Math.max(1, n - 1));
      return V(Math.sin(a) * radio, this.H + y + (i % 2 ? 0.12 : -0.06), -Math.cos(a) * radio);
    });
  }

  _aviso(pos, texto, color) {
    const e = this.etiqueta(texto, { ancho: 0.42, alto: 0.08, fondo: color, color: '#ffffff', tam: 36 });
    e.material.depthTest = false;
    e.renderOrder = 800;
    e.position.copy(this.raiz.worldToLocal(pos.clone())).add(V(0, 0.15, 0));
    this.raiz.add(e);
    const cabeza = this.m.app.camara.getWorldPosition(V(0, 0, 0));
    e.lookAt(cabeza.x, this.posMundo(e).y, cabeza.z);
    const y0 = e.position.y;
    this.m.fx.tween({
      duracion: 1.6,
      curva: suavizado.lineal,
      alActualizar: (k) => {
        e.position.y = y0 + k * 0.2;
        e.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      },
      alTerminar: () => {
        e.removeFromParent();
        liberar(e);
      },
    });
  }

  /** Boca: los microbios viajan pegados al bocado; la saliva atrapa a algunos. */
  _zonaBoca() {
    const { H } = this;
    const grupo = new THREE.Group();
    grupo.position.set(0.5, H - 0.1, -1.25);
    grupo.add(this.modelo('sandwich', { tamano: 0.42 }));
    this.actores.add(grupo);
    this.m.fx.aparecer(grupo, 0.5);
    this._animaciones.push((_dt, t) => {
      grupo.rotation.y = Math.sin(t * 0.6) * 0.4;
      grupo.position.y = H - 0.1 + Math.sin(t * 1.2) * 0.03;
    });
    const tipos = ['salmonela', 'bacilo', 'virus', 'estafilococo'];
    const escapan = new Set([1, 3]);
    tipos.forEach((tipo, i) => {
      const a = (i / tipos.length) * Math.PI * 2 + 0.4;
      const m = this.modelo(tipo, { tamano: 0.13, caracter: 'malo' });
      m.position.set(Math.cos(a) * 0.24, 0.05 + Math.sin(a) * 0.12, 0.14);
      grupo.add(m);
      this._tocable(m, () => {
        const pos = this.posMundo(m);
        if (escapan.has(i)) {
          this._aviso(pos, this.t('avisoEscapo'), COLORES.naranja);
          this.m.audio.tono(500, 0.6, { hasta: 120, volumen: 0.08, pos });
          const inicio = m.position.clone();
          const destino = grupo.worldToLocal(this.raiz.localToWorld(V(0, 1.2, -5.5)));
          this.m.fx.tween({
            duracion: 1.3,
            curva: suavizado.entradaSalida,
            alActualizar: (k) => {
              m.position.lerpVectors(inicio, destino, k);
              m.scale.setScalar(Math.max(0.01, 1 - k * 0.8));
            },
            alTerminar: () => (m.visible = false),
          });
        } else {
          this._aviso(pos, this.t('avisoAtrapado'), COLORES.primario);
          const burbuja = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.5, depthWrite: false }));
          burbuja.position.copy(m.position);
          grupo.add(burbuja);
          this.m.audio.burbuja(pos);
          this.m.fx.tween({
            duracion: 0.9,
            alActualizar: (k) => {
              burbuja.scale.setScalar(0.3 + k * 0.9);
              m.scale.setScalar(Math.max(0.01, 1 - k));
            },
            alTerminar: () => {
              m.visible = false;
              burbuja.visible = false;
              this.m.fx.pixeles(this.posMundo(burbuja), '#bfe9ff', 24, 0.35);
            },
          });
        }
        this._hecho(pos);
      });
    });
    return tipos.length;
  }

  /** Estómago: los microbios caen al lago de ácido; uno resiste. */
  _zonaEstomago() {
    const tipos = ['bacilo', 'coco', 'virus', 'espirilo', 'salmonela'];
    const resistente = Math.floor(Math.random() * tipos.length);
    this._arco(tipos.length, { radio: 1.55, desde: -5, hasta: 65, y: -0.05 }).forEach((pos, i) => {
      const nodo = this._microbio(tipos[i], pos);
      this._tocable(nodo, () => {
        nodo.userData.libre = true;
        const inicio = nodo.position.clone();
        const superficie = inicio.clone().setY(0.02);
        this.m.audio.tono(700, 0.5, { hasta: 200, volumen: 0.06, pos: this.posMundo(nodo) });
        this.m.fx.tween({ duracion: 0.7, curva: (k) => k * k, alActualizar: (k) => nodo.position.lerpVectors(inicio, superficie, k) }).then(() => {
          if (this._destruida) return;
          const pos = this.posMundo(nodo);
          this.m.fx.pixeles(pos, '#d8ff6a', 30, 0.5);
          if (i === resistente) {
            nodo.userData.halo.material.color.set(COLORES.amarillo);
            this._aviso(pos, this.t('avisoResistio'), COLORES.naranja);
            this.m.audio.tono(300, 0.4, { hasta: 900, volumen: 0.1, tipo: 'square', pos });
            const arriba = inicio.clone().add(V(0, 0.15, 0));
            const lejos = V(inicio.x * 1.5, this.H - 0.2, -6);
            this.m.fx
              .tween({ duracion: 0.6, alActualizar: (k) => nodo.position.lerpVectors(superficie, arriba, k) })
              .then(() => !this._destruida && this.m.fx.tween({ duracion: 2, curva: suavizado.entradaSalida, alActualizar: (k) => nodo.position.lerpVectors(arriba, lejos, k), alTerminar: () => (nodo.visible = false) }));
          } else {
            this._aviso(pos, this.t('avisoDisuelto'), COLORES.verde);
            this.m.audio.chisporroteo(pos);
            this.m.fx.tween({ duracion: 0.7, alActualizar: (k) => nodo.scale.setScalar(Math.max(0.01, 1 - k)), alTerminar: () => (nodo.visible = false) });
          }
          this._hecho(pos);
        });
      });
    });
    return tipos.length;
  }

  /** Intestino: al tocar a un invasor, la microbiota (bacterias amigas) lo empuja fuera. */
  _zonaIntestino() {
    const amigas = this._arco(7, { radio: 1.15, desde: -15, hasta: 75, y: -0.3 }).map((pos, i) => {
      const nodo = this._microbio(i % 2 ? 'lactobacilo' : 'levadura', pos, { tamano: 0.1, color: COLORES.verde, caracter: 'bueno' });
      nodo.userData.casa = pos.clone();
      return nodo;
    });
    const invasores = ['salmonela', 'bacilo', 'salmonela', 'estafilococo', 'virus'];
    this._arco(invasores.length, { radio: 1.75, desde: -8, hasta: 68, y: 0.05 }).forEach((pos, i) => {
      const nodo = this._microbio(invasores[i], pos);
      this._tocable(nodo, () => {
        nodo.userData.libre = true;
        const destino = nodo.position.clone();
        const cerca = [...amigas].sort((a, b) => a.position.distanceTo(destino) - b.position.distanceTo(destino)).slice(0, 3);
        cerca.forEach((a, k) => {
          a.userData.libre = true;
          const junto = destino.clone().add(V((k - 1) * 0.12, -0.08 + k * 0.05, 0.1));
          this.m.fx.moverA(a, junto, 0.5, suavizado.salida).then(() => {
            if (this._destruida) return;
            this.m.fx.moverA(a, a.userData.casa, 0.8, suavizado.entradaSalida, 0.4).then(() => (a.userData.libre = false));
          });
        });
        this.m.fx.tween({ duracion: 0.55 }).then(() => {
          if (this._destruida) return;
          const pos = this.posMundo(nodo);
          this._aviso(pos, this.t('avisoMicrobiota'), COLORES.verde);
          this.m.audio.tono(400, 0.3, { hasta: 1200, volumen: 0.1, pos });
          this.m.fx.pixeles(pos, '#7dff9a', 24, 0.4);
          const inicio = nodo.position.clone();
          const fuera = inicio.clone().multiplyScalar(2.6).setY(this.H + 1.2);
          this.m.fx.tween({
            duracion: 1.0,
            alActualizar: (k) => {
              nodo.position.lerpVectors(inicio, fuera, k);
              nodo.scale.setScalar(Math.max(0.01, 1 - k));
            },
            alTerminar: () => (nodo.visible = false),
          });
          this._hecho(pos);
        });
      });
    });
    return invasores.length;
  }

  /** Defensas: el glóbulo blanco persigue y "se come" a las bacterias que el estudiante señala. */
  _zonaDefensas() {
    const { H } = this;
    const casa = V(0.62, H + 0.16, -1.35);
    const globulo = this.modelo('globulo_blanco', { tamano: 0.42 });
    globulo.position.copy(casa);
    this.actores.add(globulo);
    this.m.fx.aparecer(globulo, 0.5);
    let ocupado = Promise.resolve();
    const tipos = ['bacilo', 'coco', 'estafilococo', 'salmonela', 'espirilo'];
    this._arco(tipos.length, { radio: 1.7, desde: -5, hasta: 70, y: 0.05 }).forEach((pos, i) => {
      const nodo = this._microbio(tipos[i], pos);
      this._tocable(nodo, () => {
        nodo.userData.libre = true;
        ocupado = ocupado.then(async () => {
          if (this._destruida) return;
          const objetivo = nodo.position.clone().add(nodo.position.clone().normalize().multiplyScalar(-0.12));
          await this.m.fx.moverA(globulo, objetivo, 0.6, suavizado.entradaSalida);
          if (this._destruida) return;
          const inicio = nodo.position.clone();
          await this.m.fx.tween({
            duracion: 0.5,
            alActualizar: (k) => {
              nodo.position.lerpVectors(inicio, globulo.position, k);
              nodo.scale.setScalar(Math.max(0.01, 1 - k));
            },
          });
          if (this._destruida) return;
          nodo.visible = false;
          const p = this.posMundo(globulo);
          this.m.fx.latido(globulo, 0.25);
          this.m.audio.tono(220, 0.35, { hasta: 90, volumen: 0.14, tipo: 'triangle', pos: p });
          this._aviso(p, this.t('avisoFagocitado'), COLORES.primario);
          this._hecho(p);
          await this.m.fx.moverA(globulo, casa, 0.7, suavizado.entradaSalida);
        });
      });
    });
    return tipos.length;
  }

  // ── Panel ────────────────────────────────────────────────────────────────

  _dibujar(ctx, w, h) {
    const est = this.estaciones[this.indiceEstacion];
    if (!est) return;
    tarjeta(ctx, w, h, { radio: 44, borde: '#e5486f', grosor: 10 });
    pastilla(ctx, this.t('paradaDe', { n: this.indiceEstacion + 1, total: this.estaciones.length }), 40, 30, { tam: 28 });
    // Mapa del recorrido
    const n = this.estaciones.length;
    this.estaciones.forEach((e, i) => {
      const x = w - 60 - (n - 1 - i) * 74;
      if (i < n - 1) {
        ctx.strokeStyle = i < this.indiceEstacion ? '#e5486f' : '#d5dcec';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, 55);
        ctx.lineTo(x + 74, 55);
        ctx.stroke();
      }
      ctx.fillStyle = i === this.indiceEstacion ? '#e5486f' : i < this.indiceEstacion ? '#f6b6c4' : '#e6ebf8';
      ctx.beginPath();
      ctx.arc(x, 55, i === this.indiceEstacion ? 30 : 24, 0, Math.PI * 2);
      ctx.fill();
      escribir(ctx, ICONOS[e.zona] ?? '•', x, 56, { tam: i === this.indiceEstacion ? 34 : 26, alinear: 'center', base: 'middle' });
    });
    let y = escribir(ctx, est.nombre, 40, 104, { tam: 52, peso: 800, maxAncho: w - 80, maxAlto: 70 });
    if (this.fase === 'tarea') {
      y = escribir(ctx, est.texto, 40, y + 10, { tam: 36, maxAncho: w - 80, maxAlto: h - y - 150 });
      ctx.fillStyle = '#4f7cff22';
      ctx.beginPath();
      ctx.roundRect(28, h - 128, w - 56, 100, 24);
      ctx.fill();
      escribir(ctx, `👉 ${est.tarea ?? ''} (${this.hechos}/${this.objetivo})`, 50, h - 78, { tam: 34, peso: 800, color: COLORES.primario, maxAncho: w - 100, maxAlto: 92, base: 'middle', interlineado: 1.15 });
      return;
    }
    if (this.fase === 'pregunta') y = escribir(ctx, this.t('tareaHecha'), 40, y + 8, { tam: 32, peso: 700, color: '#1b7f4f', maxAncho: w - 80 });
    y = escribir(ctx, est.pregunta, 40, y + 12, { tam: 44, peso: 800, maxAncho: w - 80, maxAlto: this.fase === 'respuesta' ? 150 : h - y - 40, interlineado: 1.2 });
    if (this.fase === 'respuesta') {
      const bien = this.respuesta === est.correcta;
      ctx.fillStyle = (bien ? COLORES.verde : COLORES.naranja) + '22';
      ctx.beginPath();
      ctx.roundRect(28, y + 10, w - 56, h - y - 34, 24);
      ctx.fill();
      escribir(ctx, `${bien ? `✅ ${this.t('correcto')} ` : '💡 '}${est.explicacion}`, 50, y + 24, { tam: 33, peso: 600, color: bien ? '#1b7f4f' : '#9a4b00', maxAncho: w - 100, maxAlto: h - y - 60, interlineado: 1.2 });
    }
  }
}

