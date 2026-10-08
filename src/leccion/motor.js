import * as THREE from 'three';
import { crearTraductor } from '../core/i18n.js';
import { suavizado } from '../core/efectos.js';
import { PanelLienzo, escribir } from '../ui/lienzo.js';
import { actualizarHologramas } from '../mundo/holograma.js';
import { crearEntorno } from '../mundo/entornos.js';
import { liberar } from '../mundo/materiales.js';
import { lineasDeEscena } from './voces.js';
import { EscenaNarrativa } from '../escenas/narrativa.js';
import { EscenaExploracion } from '../escenas/exploracion.js';
import { EscenaClasificar } from '../escenas/clasificar.js';
import { EscenaOrdenar } from '../escenas/ordenar.js';
import { EscenaQuiz } from '../escenas/quiz.js';
import { EscenaEntrevista } from '../escenas/entrevista.js';
import { EscenaLluvia } from '../escenas/lluvia.js';
import { EscenaSimulacion } from '../escenas/simulacion.js';
import { EscenaLinterna } from '../escenas/linterna.js';
import { EscenaAtrapar } from '../escenas/atrapar.js';
import { EscenaInspeccion } from '../escenas/inspeccion.js';
import { EscenaCinta } from '../escenas/cinta.js';
import { EscenaViaje } from '../escenas/viaje.js';
import { EscenaCaos } from '../escenas/caos.js';
import { EscenaPelicula } from '../escenas/pelicula.js';
import { EscenaObservacion } from '../escenas/observacion.js';
import { EscenaFrase } from '../escenas/frase.js';
import { EscenaMatriz } from '../escenas/matriz.js';
import { EscenaPrototipo } from '../escenas/prototipo.js';
import { EscenaFinal } from '../escenas/final.js';

const RADIO_MOVIMIENTO = 2.3;

const TIPOS = {
  narrativa: EscenaNarrativa,
  exploracion: EscenaExploracion,
  clasificar: EscenaClasificar,
  ordenar: EscenaOrdenar,
  quiz: EscenaQuiz,
  entrevista: EscenaEntrevista,
  lluvia: EscenaLluvia,
  simulacion: EscenaSimulacion,
  linterna: EscenaLinterna,
  atrapar: EscenaAtrapar,
  inspeccion: EscenaInspeccion,
  cinta: EscenaCinta,
  viaje: EscenaViaje,
  caos: EscenaCaos,
  pelicula: EscenaPelicula,
  observacion: EscenaObservacion,
  frase: EscenaFrase,
  matriz: EscenaMatriz,
  prototipo: EscenaPrototipo,
};

/** Reproduce una lección: crea cada escena, cambia de entorno y hace las transiciones. */
export class Motor {
  constructor({ app, entrada, audio, fx }) {
    Object.assign(this, { app, entrada, audio, fx });
    this.anclaje = new THREE.Group();
    app.escena.add(this.anclaje);
    this.escena = null;
    this.entorno = null;
    this.nombreEntorno = null;
    this._ocupado = false;
    app.alActualizar((dt, t) => {
      this.entorno?.actualizar?.(dt, t);
      actualizarHologramas(t);
      audio.actualizarOyente(app.camara);
    });
    app.alReiniciarReferencia(() => this.escena && this.irA(this.indice, true));
  }

  cargar(leccion) {
    this.leccion = leccion;
    this.t = crearTraductor(leccion.idioma);
    this.audio.idioma = leccion.idioma;
    // El marcador se rehace: su tamaño depende de si la lección tiene rangos.
    if (this.marcador) {
      this.marcador.removeFromParent();
      liberar(this.marcador);
      this.marcador = null;
    }
    this._reiniciarPuntos();
    // Voces grabadas de los personajes (si la lección las tiene). Devuelve la promesa de carga.
    return this.audio.cargarVoces(leccion.voces?.carpeta);
  }

  // ── Gamificación (solo si la lección tiene "gamificacion": true) ─────────

  get gamificado() {
    return Boolean(this.leccion?.gamificacion);
  }

  _reiniciarPuntos() {
    this.puntaje = { puntos: 0, racha: 0, mejorRacha: 0, aciertos: 0, errores: 0 };
    this.insignias = [];
    this.rangoActual = this._rangoPara(0);
    this.marcador?.redibujar();
  }

  /** Rangos opcionales de la lección: [{ nombre, emoji, puntos }] en orden creciente. */
  get rangos() {
    const r = this.leccion?.rangos;
    return this.gamificado && Array.isArray(r) && r.length ? r : null;
  }

  _rangoPara(puntos) {
    const lista = this.rangos;
    if (!lista) return null;
    let actual = lista[0];
    for (const r of lista) if (puntos >= r.puntos) actual = r;
    return actual;
  }

  _revisarRango() {
    const nuevo = this._rangoPara(this.puntaje.puntos);
    if (!nuevo || nuevo === this.rangoActual) return;
    const sube = this.rangos.indexOf(nuevo) > this.rangos.indexOf(this.rangoActual);
    this.rangoActual = nuevo;
    this.marcador?.redibujar();
    if (sube) {
      this.audio.fanfarria();
      this._anuncio({ titulo: this.t('ascenso'), texto: this.t('ahoraEres', { rango: nuevo.nombre }), emoji: nuevo.emoji ?? '🎖️', color: '#ffc23c' });
    }
  }

  /** Al completar una misión con "insignia" se muestra la insignia ganada. Resuelve al terminar la animación. */
  otorgarInsignia(insignia) {
    if (!this.gamificado || !insignia) return Promise.resolve();
    this.insignias.push(insignia);
    this.audio.exito();
    return this._anuncio({ titulo: this.t('insigniaDesbloqueada'), texto: insignia.nombre, emoji: insignia.emoji ?? '🏅', color: '#8b5cf6', grande: true });
  }

  /**
   * Anuncio flotante delante del usuario (insignia o ascenso de rango). No se puede
   * tocar: aparece con un rebote, se queda un momento y se desvanece hacia arriba.
   */
  _anuncio({ titulo, texto, emoji, color, grande = false }) {
    const [ancho, alto] = grande ? [0.62, 0.5] : [0.66, 0.2];
    const panel = new PanelLienzo(ancho, alto, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(13, 20, 38, 0.92)';
      ctx.beginPath();
      ctx.roundRect(6, 6, w - 12, h - 12, grande ? 60 : (h - 12) / 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = color;
      ctx.stroke();
      if (grande) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(w / 2, 150, 104, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#ffc23c';
        ctx.stroke();
        escribir(ctx, emoji, w / 2, 150, { tam: 120, alinear: 'center', base: 'middle' });
        escribir(ctx, titulo, w / 2, 282, { tam: 40, peso: 800, color: '#ffc23c', alinear: 'center', maxAncho: w - 60 });
        escribir(ctx, texto, w / 2, 350, { tam: 56, peso: 900, color: '#ffffff', alinear: 'center', maxAncho: w - 60, maxAlto: h - 370 });
        return;
      }
      escribir(ctx, emoji, 70, h / 2, { tam: 96, alinear: 'center', base: 'middle' });
      escribir(ctx, titulo, 140, 34, { tam: 40, peso: 800, color, maxAncho: w - 170 });
      escribir(ctx, texto, 140, 92, { tam: 46, peso: 900, color: '#ffffff', maxAncho: w - 170, maxAlto: h - 100 });
    });
    panel.material.depthTest = false;
    panel.renderOrder = 950;
    const cam = this.app.camara;
    const cabeza = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3()).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const pos = cabeza.clone().addScaledVector(dir, grande ? 0.95 : 1.25);
    pos.y += grande ? 0.02 : 0.34;
    panel.position.copy(pos);
    panel.lookAt(cabeza.x, pos.y, cabeza.z);
    this.app.escena.add(panel);
    for (const p of this.entrada.punteros) p.vibrar(0.7, 90);
    if (grande) this.fx.confeti(pos.clone().add(new THREE.Vector3(0, 0.15, 0)), 70);

    const visible = grande ? 1.9 : 2.3;
    const y0 = pos.y;
    this.fx.tween({
      duracion: visible + 0.45,
      persistente: true,
      curva: suavizado.lineal,
      alActualizar: (k) => {
        const s = k * (visible + 0.45);
        panel.scale.setScalar(s < 0.4 ? Math.max(0.01, suavizado.rebote(s / 0.4)) : 1);
        const salida = Math.max(0, (s - visible) / 0.45);
        panel.material.opacity = 1 - salida;
        panel.position.y = y0 + salida * 0.15;
      },
      alTerminar: () => {
        panel.removeFromParent();
        panel.geometry.dispose();
        panel.textura.dispose();
        panel.material.dispose();
      },
    });
    return this.fx.tween({ duracion: visible, persistente: true });
  }

  /** Suma puntos con bono por racha (3 o más aciertos seguidos) y muestra "+100" flotando. */
  premiar(posMundo, valor = 100) {
    if (!this.gamificado) return;
    const p = this.puntaje;
    p.racha++;
    p.aciertos++;
    p.mejorRacha = Math.max(p.mejorRacha, p.racha);
    const bono = p.racha >= 3 ? Math.min(p.racha - 2, 5) * 0.2 : 0;
    const total = Math.round((valor * (1 + bono)) / 10) * 10;
    p.puntos += total;
    this.fx.textoFlotante(posMundo, `+${total}`, p.racha >= 3 ? `🔥 x${p.racha}` : '');
    this.audio.moneda(posMundo);
    if (this.marcador) {
      this.marcador.redibujar();
      this.fx.latido(this.marcador, 0.15);
    }
    this._revisarRango();
  }

  fallar() {
    if (!this.gamificado) return;
    this.puntaje.racha = 0;
    this.puntaje.errores++;
    this.marcador?.redibujar();
  }

  /** Marcador de puntos flotante arriba a la izquierda (sigue a la escena). */
  _colocarMarcador() {
    if (!this.gamificado) {
      this.marcador?.removeFromParent();
      return;
    }
    if (!this.marcador) {
      // Con rangos, el marcador tiene una segunda línea con el rango actual.
      const conRango = Boolean(this.rangos);
      this.marcador = new PanelLienzo(conRango ? 0.56 : 0.5, conRango ? 0.2 : 0.13, (ctx, w, h) => {
        const p = this.puntaje;
        ctx.fillStyle = 'rgba(13, 20, 38, 0.88)';
        ctx.beginPath();
        ctx.roundRect(4, 4, w - 8, h - 8, conRango ? 50 : (h - 8) / 2);
        ctx.fill();
        ctx.strokeStyle = '#ffc23c';
        ctx.lineWidth = 6;
        ctx.stroke();
        const yPuntos = conRango ? 62 : h / 2;
        escribir(ctx, `⭐ ${p.puntos.toLocaleString('es-EC')}`, 34, yPuntos, { tam: 58, peso: 800, color: '#ffc23c', base: 'middle' });
        if (p.racha >= 2) escribir(ctx, `🔥 ${p.racha}`, w - 34, yPuntos, { tam: 50, peso: 800, color: '#ff8a5c', alinear: 'right', base: 'middle' });
        if (conRango && this.rangoActual) {
          const r = this.rangoActual;
          escribir(ctx, `${r.emoji ?? '🎖️'} ${r.nombre}`, 34, 148, { tam: 44, peso: 800, color: '#ffffff', base: 'middle', maxAncho: w - 68 });
        }
      });
    }
    const H = this.app.alturaOjos;
    this.marcador.position.set(-1.1, H + 0.62, -1.7);
    this.marcador.lookAt(0, H, 0);
    this.anclaje.add(this.marcador);
    this.marcador.redibujar();
  }

  get total() {
    return this.leccion.escenas.length;
  }

  async irA(indice, forzar = false) {
    if (this._ocupado && !forzar) return;
    this._ocupado = true;
    this.indice = indice;
    this.audio.transicion();
    await this.fx.fundido(true, 0.3);

    if (this.escena) {
      this.escena.destruir();
      this.escena = null;
    }
    this.fx.limpiar();
    this.entrada.reiniciar();

    const datos = this.leccion.escenas[indice];
    // Las voces de esta escena y de la siguiente se descargan antes de necesitarlas.
    this.audio.precargarVoces([...lineasDeEscena(datos), ...lineasDeEscena(this.leccion.escenas[indice + 1])].map((l) => l.clave));
    const nombreEntorno = datos?.entorno ?? this.nombreEntorno ?? 'aula';
    const entornoNuevo = nombreEntorno !== this.nombreEntorno;
    if (entornoNuevo) {
      this._quitarEntorno();
      this.entorno = crearEntorno(nombreEntorno, this.app, {
        audio: this.audio,
        titulo: this.leccion.titulo,
        subtitulo: [this.leccion.materia, this.leccion.grado].filter(Boolean).join(' · '),
      });
      this.nombreEntorno = nombreEntorno;
      this.anclaje.add(this.entorno.grupo);
    }
    this.app.anclarDelanteDelUsuario(this.anclaje);
    // Cada escena puede ampliar el área de movimiento (p. ej. recorrer el mercado).
    this.app.limites.radio = RADIO_MOVIMIENTO;
    if (entornoNuevo) this._entradaAlEntorno(nombreEntorno);
    this._colocarMarcador();

    const Clase = datos ? TIPOS[datos.tipo] : EscenaFinal;
    const escena = new Clase(this, datos ?? { titulo: this.leccion.titulo }, indice, this.total);
    escena.alTerminar = () => this.irA(indice + 1);
    escena.construir();
    escena.colocarUtileria(datos?.utileria);
    this.anclaje.add(escena.raiz);
    this.escena = escena;

    await this.fx.fundido(false, 0.45);
    this._ocupado = false;
    escena.iniciar();
  }

  reiniciar() {
    this._reiniciarPuntos();
    this.irA(0);
  }

  /**
   * El entorno nuevo aparece "creciendo" alrededor del usuario. En el mundo
   * microscópico crece mucho más: se siente como encogerse al tamaño de un microbio.
   */
  _entradaAlEntorno(nombre) {
    const grupo = this.entorno.grupo;
    const desde = nombre === 'microscopico' ? 0.25 : 0.9;
    grupo.scale.setScalar(desde);
    this.fx.tween({
      duracion: nombre === 'microscopico' ? 2.2 : 0.9,
      persistente: true,
      curva: suavizado.salida,
      alActualizar: (k) => grupo.scale.setScalar(desde + (1 - desde) * k),
    });
    if (nombre === 'microscopico') this.audio.tono(900, 1.6, { hasta: 120, volumen: 0.06 });
  }

  _quitarEntorno() {
    if (!this.entorno) return;
    this.entorno.detener();
    liberar(this.entorno.grupo);
    this.entorno.grupo.removeFromParent();
    this.entorno = null;
    this.nombreEntorno = null;
  }

  detener() {
    this.escena?.destruir();
    this.escena = null;
    this._quitarEntorno();
    this.fx.limpiar();
    this.audio.callar();
    this._ocupado = false;
  }
}
