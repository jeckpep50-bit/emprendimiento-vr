import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { holograma } from '../mundo/holograma.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla } from '../ui/lienzo.js';

const COLOR_ETIQUETA = { bueno: COLORES.verde, malo: COLORES.rojo, neutral: COLORES.primario };

/**
 * Exploración: modelos flotando en arco; al tocarlos se descubre un dato.
 * datos: { titulo, instruccion, minimo?, elementos: [{ modelo, nombre, texto, etiqueta?, tamano?, opciones? }] }
 */
export class EscenaExploracion extends EscenaBase {
  construir() {
    const { H } = this;
    const elementos = this.datos.elementos ?? [];
    this.minimo = Math.min(this.datos.minimo ?? elementos.length, elementos.length);
    this.descubiertos = new Set();

    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion || this.t('apuntaExplorar'), alto: 0.34, y: H + 0.55, conMensajes: false });
    this.cabecera.derecha(this.t('descubiertos', { n: 0, total: elementos.length }));

    // Panel de información (inclinado hacia arriba, debajo de la línea de visión)
    this.seleccion = null;
    this.info = new PanelLienzo(1.1, 0.4, (ctx, w, h) => this._dibujarInfo(ctx, w, h));
    this.info.position.set(0, H - 0.36, -1.12);
    this.info.lookAt(0, H + 0.1, 0.1);
    this.raiz.add(this.info);
    this.presentar(this.info, 0.15);

    // Una sola fila en arco: con muchos elementos el arco se abre hasta 160°
    // y el estudiante gira la cabeza para explorar (nada queda tapado por el panel).
    const n = elementos.length;
    const paso = THREE.MathUtils.degToRad(Math.min(24, 160 / Math.max(n - 1, 1)));
    this.nodos = elementos.map((el, i) => {
      const angulo = (i - (n - 1) / 2) * paso;
      const nodo = this._crearElemento(el, angulo, H + 0.03 + (i % 2) * 0.07);
      this.presentar(nodo, 0.3 + i * 0.12, true);
      return nodo;
    });
    this.mirarAlUsuario(this.nodos);
  }

  _crearElemento(el, angulo, y) {
    const nodo = new THREE.Group();
    const tam = el.tamano ?? 0.3;
    const modelo = this.modelo(el.modelo, { tamano: tam, ...el.opciones });
    if (el.holograma) holograma(modelo, el.color ?? '#5ff7ff');
    nodo.add(modelo);
    const etiqueta = this.etiqueta(el.nombre, { ancho: 0.32, alto: 0.07, tam: 32 });
    etiqueta.position.set(0, -modelo.userData.tam.y / 2 - 0.07, 0);
    nodo.add(etiqueta);
    const halo = this.halo(tam * 1.5, el.color ?? COLOR_ETIQUETA[el.etiqueta ?? 'neutral']);
    halo.position.z = -tam * 0.4;
    nodo.add(halo);
    this.enArco(nodo, angulo, 1.45, y);
    nodo.userData.base = nodo.position.clone();
    nodo.userData.modelo = modelo;
    nodo.userData.el = el;
    nodo.userData.etiqueta = etiqueta;
    nodo.userData.halo = halo;
    this.raiz.add(nodo);

    this.interactivo(nodo, {
      proxy: true,
      alPasar: (v) => {
        modelo.scale.setScalar(v ? 1.12 : 1);
        halo.userData.encendido = v;
      },
      alSeleccionar: () => this._descubrir(el, nodo, etiqueta),
    });
    return nodo;
  }

  /** El microbio elegido se acerca al estudiante dando una vuelta y luego regresa a su lugar. */
  _acercar(nodo) {
    if (this._cerca && this._cerca !== nodo) this._alejar(this._cerca);
    this._cerca = nodo;
    const destino = nodo.userData.base.clone().multiplyScalar(0.6);
    destino.y = this.H + 0.13;
    this.m.fx.moverA(nodo, destino, 0.7, suavizado.entradaSalida);
    this.m.fx.girar(nodo.userData.modelo, 1.1);
    const turno = (nodo.userData.turno = (nodo.userData.turno ?? 0) + 1);
    this.m.fx.tween({ duracion: 7 }).then(() => {
      if (!this._destruida && this._cerca === nodo && nodo.userData.turno === turno) this._alejar(nodo);
    });
  }

  _alejar(nodo) {
    if (this._cerca === nodo) this._cerca = null;
    this.m.fx.moverA(nodo, nodo.userData.base, 0.8, suavizado.entradaSalida);
  }

  _descubrir(el, nodo, etiqueta) {
    const nuevo = !this.descubiertos.has(el);
    this.descubiertos.add(el);
    this.seleccion = el;
    this.info.redibujar();
    this.m.fx.latido(this.info, 0.04);
    this._acercar(nodo);
    this.m.audio.pop(this.posMundo(nodo));
    this.narrar(`${el.nombre}. ${el.texto}`);
    if (!nuevo) return;

    etiqueta.actualizar({ texto: `✔ ${el.nombre}`, fondo: el.color ?? COLOR_ETIQUETA[el.etiqueta ?? 'neutral'], color: '#ffffff' });
    this.m.fx.confeti(this.posMundo(nodo), 14);
    const total = this.datos.elementos.length;
    this.cabecera.derecha(this.t('descubiertos', { n: this.descubiertos.size, total }));
    if (this.descubiertos.size === this.minimo) {
      this.m.audio.acierto();
      this.m.fx.confeti(this.posMundo(this.info).add(new THREE.Vector3(0, 0.3, 0)), 40);
      this.mostrarContinuar(new THREE.Vector3(0.86, this.H - 0.36, -0.92));
    }
  }

  _dibujarInfo(ctx, w, h) {
    const el = this.seleccion;
    if (!el) {
      tarjeta(ctx, w, h, { radio: 40, fondo: 'rgba(255, 253, 247, 0.92)' });
      escribir(ctx, this.textoAyuda ?? this.t('apuntaExplorar'), w / 2, h / 2, { tam: 40, peso: 600, color: COLORES.suave, maxAncho: w - 120, alinear: 'center', base: 'middle' });
      return;
    }
    const tipo = el.etiqueta ?? 'neutral';
    const color = el.color ?? COLOR_ETIQUETA[tipo];
    tarjeta(ctx, w, h, { radio: 40, borde: color, grosor: 10 });
    const clave = { bueno: 'etiquetaBueno', malo: 'etiquetaMalo', neutral: 'etiquetaNeutral' }[tipo];
    const anchoPastilla = pastilla(ctx, el.insignia ?? this.t(clave), 40, 32, { tam: 28, fondo: color, color: '#ffffff' });
    escribir(ctx, el.nombre, 40 + anchoPastilla + 20, 34, { tam: 44, peso: 800, maxAncho: w - anchoPastilla - 110, maxAlto: 50 });
    escribir(ctx, el.texto, 40, 108, { tam: 40, maxAncho: w - 80, maxAlto: h - 140 });
  }
}
