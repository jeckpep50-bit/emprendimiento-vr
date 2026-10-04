import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { liberar, malla } from '../mundo/materiales.js';
import { PanelLienzo, COLORES, escribir, tarjeta } from '../ui/lienzo.js';

/**
 * Minijuego arcade "¡Defiende el almuerzo!": los microbios vuelan hacia un
 * alimento protegido por un escudo. Se dispara (gatillo, pellizco o clic) a los
 * DAÑINOS antes de que lleguen; a los AMIGOS (halo verde) no se les dispara.
 * datos: { titulo, instruccion?, duracion? (s), vidas?, meta?,
 *          objetivo?: { modelo, opciones }, malos: [modelos], buenos?: [modelos] }
 */
export class EscenaAtrapar extends EscenaBase {
  construir() {
    const { H } = this;
    const d = this.datos;
    this.duracion = d.duracion ?? 45;
    this.vidasMax = d.vidas ?? 5;
    this.meta = d.meta ?? 12;
    this.malos = d.malos?.length ? d.malos : ['bacilo', 'virus', 'moho', 'salmonela'];
    this.buenos = d.buenos ?? ['lactobacilo', 'levadura'];
    this.estado = 'espera';
    this.activos = [];
    this._reiniciarMarcador();

    this.cabecera = this.encabezado({ instruccion: d.instruccion || this.t('atraparInstruccion') });
    this.cabecera.derecha(`⏱ ${this.duracion} s`);

    // Alimento a proteger, dentro de un escudo de energía
    this.objetivo = new THREE.Group();
    this.objetivo.position.set(0, H - 0.32, -1.05);
    const comida = this.modelo(d.objetivo?.modelo ?? 'sandwich', { tamano: 0.3, ...d.objetivo?.opciones });
    this.escudo = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 20),
      new THREE.MeshBasicMaterial({ color: '#5ff7ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    const anillo = malla(new THREE.TorusGeometry(0.3, 0.006, 6, 64), new THREE.MeshBasicMaterial({ color: '#5ff7ff', transparent: true, opacity: 0.7 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
    this.objetivo.add(comida, this.escudo, anillo);
    this.raiz.add(this.objetivo);
    this.presentar(this.objetivo, 0.2);
    this.cadaCuadro((_dt, t) => {
      comida.rotation.y = t * 0.5;
      anillo.rotation.z = t;
      anillo.position.y = Math.sin(t * 2) * 0.12;
    });

    // Tablero del juego (derecha) y leyenda (izquierda)
    this.tablero = new PanelLienzo(0.62, 0.46, (ctx, w, h) => this._dibujarTablero(ctx, w, h));
    this.tablero.position.set(0.98, H + 0.02, -1.2);
    this.tablero.lookAt(0, H, 0.2);
    const leyenda = new PanelLienzo(0.62, 0.46, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 34 });
      escribir(ctx, this.t('leyendaMalos'), 30, 34, { tam: 36, peso: 800, color: '#c0392b', maxAncho: w - 60, interlineado: 1.15 });
      escribir(ctx, this.t('leyendaBuenos'), 30, h / 2 + 20, { tam: 36, peso: 800, color: '#1b7f4f', maxAncho: w - 60, interlineado: 1.15 });
    });
    leyenda.position.set(-0.98, H + 0.02, -1.2);
    leyenda.lookAt(0, H, 0.2);
    this.raiz.add(this.tablero, leyenda);
    this.presentar(this.tablero, 0.3);
    this.presentar(leyenda, 0.3);

    this.btnEmpezar = this.boton(this.t('empezarJuego'), () => this._empezar(), { ancho: 0.5, alto: 0.15, color: COLORES.verde });
    this.btnEmpezar.position.set(0, H + 0.1, -1.3);
    this.btnEmpezar.lookAt(0, H, 0);
    this.raiz.add(this.btnEmpezar);
    this.presentar(this.btnEmpezar, 0.4);

    let reloj = 0;
    this.cadaCuadro((dt, t) => {
      this.escudo.material.opacity += (0.12 - this.escudo.material.opacity) * Math.min(1, dt * 4);
      if (this.estado !== 'jugando') return;
      this._actualizarJuego(dt, t);
      reloj += dt;
      if (reloj > 0.25) {
        reloj = 0;
        this.tablero.redibujar();
        this.cabecera.derecha(`⏱ ${Math.max(0, Math.ceil(this.restante))} s`);
      }
    });
  }

  _reiniciarMarcador() {
    this.atrapados = 0;
    this.vidas = this.vidasMax;
    this.restante = this.duracion;
    this.proximo = 0.6;
  }

  _empezar() {
    if (this.estado === 'jugando') return;
    this._reiniciarMarcador();
    this.estado = 'jugando';
    this.btnEmpezar.visible = false;
    this.m.entrada.habilitar(this.btnEmpezar, false);
    if (this._otraVez) this._otraVez.visible = false;
    if (this._continuar) this._continuar.visible = false;
    this.m.audio.transicion();
    this.cabecera.mensaje(this.t('aJugar'), COLORES.primario);
    this.tablero.redibujar();
  }

  _actualizarJuego(dt, t) {
    this.restante -= dt;
    this.proximo -= dt;
    const progreso = 1 - Math.max(0, this.restante) / this.duracion;
    if (this.proximo <= 0 && this.activos.length < 7) {
      this._lanzar(progreso);
      this.proximo = 1.9 - progreso * 0.9;
    }
    for (const nodo of [...this.activos]) {
      const u = nodo.userData;
      u.vida += dt;
      if (u.bueno) {
        // Los amigos cruzan el campo de un lado a otro y se van.
        const k = Math.min(1, u.vida / u.duracionCruce);
        nodo.position.lerpVectors(u.inicio, u.fin, k);
        nodo.position.y += Math.sin(t * 2 + u.fase) * 0.06;
        if (k >= 1) this._retirar(nodo);
      } else {
        const hacia = u.destino.clone().sub(nodo.position);
        const dist = hacia.length();
        nodo.position.addScaledVector(hacia.normalize(), u.vel * dt);
        nodo.position.x += Math.sin(t * 3 + u.fase) * 0.15 * dt;
        if (dist < 0.24) this._impacto(nodo);
      }
      nodo.lookAt(this.posMundo(this.objetivo));
    }
    if (this.restante <= 0 || this.vidas <= 0) this._terminarJuego();
  }

  _lanzar(progreso) {
    const { H } = this;
    const esBueno = this.buenos.length > 0 && Math.random() < 0.22;
    const lista = esBueno ? this.buenos : this.malos;
    const tipo = lista[Math.floor(Math.random() * lista.length)];
    const nodo = new THREE.Group();
    const modelo = this.modelo(tipo, { tamano: 0.22, caracter: esBueno ? 'bueno' : 'malo' });
    const halo = this.halo(0.38, esBueno ? COLORES.verde : COLORES.rojo);
    halo.userData.encendido = esBueno;
    halo.position.z = -0.08;
    nodo.add(modelo, halo);
    const a = THREE.MathUtils.degToRad(-70 + Math.random() * 140);
    const y = H + (Math.random() - 0.4) * 0.8;
    const inicio = new THREE.Vector3(Math.sin(a) * 3, y, -Math.cos(a) * 3);
    nodo.position.copy(inicio);
    nodo.userData = {
      tipo,
      bueno: esBueno,
      vida: 0,
      fase: Math.random() * 6,
      vel: 0.3 + progreso * 0.3 + Math.random() * 0.08,
      destino: this.objetivo.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0, 0)),
      inicio,
      fin: new THREE.Vector3(-Math.sin(a) * 3, H + (Math.random() - 0.4) * 0.6, -Math.cos(a) * 2.6),
      duracionCruce: 6,
    };
    this.raiz.add(nodo);
    this.interactivo(nodo, {
      proxy: true,
      alPasar: (v) => modelo.scale.setScalar(v ? 1.25 : 1),
      alSeleccionar: (p) => this._disparar(nodo, p),
    });
    this.activos.push(nodo);
    this.m.fx.aparecer(nodo, 0.3);
    this.m.audio.burbuja(this.posMundo(nodo));
  }

  _disparar(nodo, p) {
    if (this.estado !== 'jugando' || !this.activos.includes(nodo)) return;
    const pos = this.posMundo(nodo);
    this._rayo(p, pos);
    if (nodo.userData.bueno) {
      this.m.audio.error(pos);
      this.perder();
      this.m.fx.pixeles(pos, '#ff8fd1', 24, 0.4);
      this.cabecera.mensaje(this.t('eraAmigo'), COLORES.naranja);
    } else {
      this.atrapados++;
      this.m.audio.tono(1200, 0.12, { hasta: 300, volumen: 0.1, tipo: 'square', pos });
      this.m.fx.pixeles(pos, '#7dff9a', 40, 0.7);
      this.ganar(pos, 50);
      if (this.atrapados === this.meta) {
        this.m.audio.exito();
        this.cabecera.mensaje(this.t('metaLograda'), COLORES.verde);
      }
    }
    this._retirar(nodo);
    this.tablero.redibujar();
  }

  _impacto(nodo) {
    const pos = this.posMundo(this.objetivo);
    this.vidas--;
    this.perder();
    this.escudo.material.opacity = 0.7;
    this.escudo.material.color.set('#ff5a5f');
    this.m.fx.tween({ duracion: 0.5 }).then(() => !this._destruida && this.escudo.material.color.set('#5ff7ff'));
    this.m.fx.pixeles(pos, '#ff5a5f', 24, 0.5);
    this.m.audio.error(pos);
    this.cabecera.mensaje(this.t('llegoMicrobio'), COLORES.rojo);
    this._retirar(nodo);
    this.tablero.redibujar();
  }

  _retirar(nodo) {
    this.m.entrada.desregistrar(nodo);
    this.activos = this.activos.filter((n) => n !== nodo);
    nodo.removeFromParent();
    liberar(nodo);
  }

  /** Rayo láser breve desde el mando hasta el microbio. */
  _rayo(p, destino) {
    if (!p?.origen) return;
    const geo = new THREE.BufferGeometry().setFromPoints([p.origen.clone(), destino.clone()]);
    const linea = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 1 }));
    this.m.app.escena.add(linea);
    this.m.fx.tween({
      duracion: 0.18,
      persistente: true,
      alActualizar: (k) => (linea.material.opacity = 1 - k),
      alTerminar: () => {
        linea.removeFromParent();
        geo.dispose();
        linea.material.dispose();
      },
    });
  }

  _terminarJuego() {
    this.estado = 'fin';
    for (const nodo of [...this.activos]) {
      this.m.fx.pixeles(this.posMundo(nodo), '#9fdcff', 12, 0.3);
      this._retirar(nodo);
    }
    this.estrellas = 1 + (this.atrapados >= this.meta ? 1 : 0) + (this.atrapados >= this.meta && this.vidas >= this.vidasMax - 1 ? 1 : 0);
    this.tablero.redibujar();
    this.cabecera.derecha('⏱ 0 s');
    this.cabecera.mensaje(this.t(this.vidas > 0 ? 'juegoTerminado' : 'almuerzoPerdido', { n: this.atrapados }), this.vidas > 0 ? COLORES.verde : COLORES.naranja);
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.objetivo).add(new THREE.Vector3(0, 0.4, 0)), 60);

    if (!this._otraVez) {
      this._otraVez = this.boton(this.t('jugarOtraVez'), () => this._empezar(), { ancho: 0.42, alto: 0.12, color: '#e6ebf8', colorTexto: COLORES.texto });
      this._otraVez.position.set(-0.28, this.H + 0.1, -1.3);
      this._otraVez.lookAt(0, this.H, 0);
      this.raiz.add(this._otraVez);
    }
    this._otraVez.visible = true;
    this.mostrarContinuar(new THREE.Vector3(0.28, this.H + 0.1, -1.3));
    this._continuar.visible = true;
  }

  _dibujarTablero(ctx, w, h) {
    ctx.fillStyle = '#0d1426';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 34);
    ctx.fill();
    ctx.strokeStyle = '#ffc23c';
    ctx.lineWidth = 6;
    ctx.stroke();
    if (this.estado === 'fin') {
      escribir(ctx, '⭐'.repeat(this.estrellas) + '☆'.repeat(3 - this.estrellas), w / 2, 40, { tam: 84, alinear: 'center' });
      escribir(ctx, `🦠 ${this.atrapados}  ·  ❤️ ${Math.max(0, this.vidas)}`, w / 2, 180, { tam: 58, peso: 800, color: '#ffffff', alinear: 'center' });
      escribir(ctx, this.t('meta', { n: this.meta }), w / 2, 280, { tam: 34, color: '#9fb3c8', alinear: 'center' });
      return;
    }
    escribir(ctx, `⏱ ${Math.max(0, Math.ceil(this.restante))} s`, 30, 26, { tam: 54, peso: 800, color: '#ffc23c' });
    escribir(ctx, `🦠 ${this.atrapados} / ${this.meta}`, 30, 120, { tam: 54, peso: 800, color: '#7dff9a' });
    escribir(ctx, this.t('vidaAlmuerzo'), 30, 228, { tam: 30, peso: 700, color: '#9fb3c8' });
    escribir(ctx, '❤️'.repeat(Math.max(0, this.vidas)) + '🖤'.repeat(this.vidasMax - Math.max(0, this.vidas)), 30, 280, { tam: 48 });
  }
}
