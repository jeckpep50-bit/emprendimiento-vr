import * as THREE from 'three';
import { crearTraductor } from '../core/i18n.js';
import { suavizado } from '../core/efectos.js';
import { PanelLienzo, escribir } from '../ui/lienzo.js';
import { actualizarHologramas } from '../mundo/holograma.js';
import { crearEntorno } from '../mundo/entornos.js';
import { liberar } from '../mundo/materiales.js';
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
import { EscenaFinal } from '../escenas/final.js';

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
    this._reiniciarPuntos();
  }

  // ── Gamificación (solo si la lección tiene "gamificacion": true) ─────────

  get gamificado() {
    return Boolean(this.leccion?.gamificacion);
  }

  _reiniciarPuntos() {
    this.puntaje = { puntos: 0, racha: 0, mejorRacha: 0, aciertos: 0, errores: 0 };
    this.marcador?.redibujar();
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
      this.marcador = new PanelLienzo(0.5, 0.13, (ctx, w, h) => {
        const p = this.puntaje;
        ctx.fillStyle = 'rgba(13, 20, 38, 0.88)';
        ctx.beginPath();
        ctx.roundRect(4, 4, w - 8, h - 8, (h - 8) / 2);
        ctx.fill();
        ctx.strokeStyle = '#ffc23c';
        ctx.lineWidth = 6;
        ctx.stroke();
        escribir(ctx, `⭐ ${p.puntos.toLocaleString('es-EC')}`, 34, h / 2, { tam: 58, peso: 800, color: '#ffc23c', base: 'middle' });
        if (p.racha >= 2) escribir(ctx, `🔥 ${p.racha}`, w - 34, h / 2, { tam: 50, peso: 800, color: '#ff8a5c', alinear: 'right', base: 'middle' });
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
