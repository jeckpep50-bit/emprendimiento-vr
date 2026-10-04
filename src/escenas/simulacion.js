import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';
import { mat, malla } from '../mundo/materiales.js';

const MAX_PUNTOS = 1024;
const RADIO_PLACA = 0.26;

/**
 * Modelo simplificado de crecimiento bacteriano (para fines didácticos):
 * duplicación cada 20 min a 30–45 °C, cada 40 min a 20–30 °C, cada 60 min a
 * 45–60 °C, cada 120 min a 5–20 °C; bajo 5 °C casi no crecen; desde 60 °C mueren.
 */
export function poblacion(inicial, temperatura, minutos) {
  if (temperatura >= 60) return inicial * Math.pow(0.5, minutos / 1.5);
  if (temperatura < 5) return inicial;
  const duplicacion = temperatura >= 30 && temperatura <= 45 ? 20 : temperatura >= 20 && temperatura < 30 ? 40 : temperatura > 45 ? 60 : 120;
  return inicial * Math.pow(2, minutos / duplicacion);
}

function lugarTemperatura(t) {
  if (t >= 60) return '♨️ Cocción';
  if (t >= 30) return '🧍 Cuerpo humano';
  if (t >= 18) return '🏠 Ambiente';
  if (t < 5) return '❄️ Refrigeradora';
  return '🌥️ Lugar fresco';
}

function colorTemperatura(t) {
  if (t >= 60) return '#ff9f43';
  if (t >= 5) return '#ff5a5f';
  return '#5ab8ff';
}

const formato = (n) => Math.floor(n + 1e-9).toLocaleString('es-EC');

function textoTiempo(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/**
 * Simulador de crecimiento bacteriano con retos de predicción.
 * Para cada reto el estudiante PREDICE la respuesta y luego ve en una placa de
 * Petri cómo las bacterias se multiplican (o mueren) según la temperatura.
 * datos: { titulo, instruccion?, retos: [{ pregunta, opciones, correcta, explicacion,
 *          temperatura, horas, inicial? }] }
 */
export class EscenaSimulacion extends EscenaBase {
  construir() {
    const { H } = this;
    this.retos = this.datos.retos ?? [];
    this.actual = 0;
    this.aciertos = 0;
    this.estado = 'pregunta';
    this.n = 1;
    this.minutos = 0;
    this.posiciones = [];

    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion || this.t('simInstruccion'), y: H + 0.66, z: -1.95 });

    this._crearPlaca();

    this.termometro = new PanelLienzo(0.55, 0.62, (ctx, w, h) => this._dibujarTermometro(ctx, w, h));
    this.termometro.position.set(-0.95, H - 0.05, -1.05);
    this.termometro.lookAt(0, H, 0.2);
    this.contador = new PanelLienzo(0.6, 0.62, (ctx, w, h) => this._dibujarContador(ctx, w, h));
    this.contador.position.set(0.95, H - 0.05, -1.05);
    this.contador.lookAt(0, H, 0.2);
    this.panel = new PanelLienzo(1.05, 0.36, (ctx, w, h) => this._dibujarPregunta(ctx, w, h));
    this.panel.position.set(0, H + 0.1, -1.32);
    this.panel.lookAt(0, H, 0);
    this.raiz.add(this.termometro, this.contador, this.panel);
    this.presentar(this.termometro, 0.2);
    this.presentar(this.contador, 0.3);
    this.presentar(this.panel, 0.1);

    this.botones = [0, 1, 2, 3].map((i) => {
      const b = this.boton('', () => this._responder(i), { ancho: 0.33, alto: 0.13, color: '#ffffff', colorTexto: COLORES.texto, tam: 34 });
      this.raiz.add(b);
      return b;
    });
    this.btnSiguiente = this.boton(this.t('siguienteReto'), () => this._avanzar(), { ancho: 0.46, alto: 0.13, color: COLORES.primario });
    this.btnSiguiente.position.set(0, H - 0.17, -1.22);
    this.btnSiguiente.lookAt(0, H, 0);
    this.raiz.add(this.btnSiguiente);

    let redibujo = 0;
    this.cadaCuadro((dt) => {
      if (this.estado !== 'simulando') return;
      redibujo += dt;
      if (redibujo > 0.1) {
        redibujo = 0;
        this.contador.redibujar();
      }
    });
    this._mostrarReto();
  }

  _crearPlaca() {
    const { H } = this;
    this.placa = new THREE.Group();
    this.placa.position.set(0, H - 0.5, -0.95);
    this.placa.rotation.x = 0.95;
    this.placa.add(malla(new THREE.CylinderGeometry(RADIO_PLACA, RADIO_PLACA, 0.015, 48), mat('#ffe9a3', { opacidad: 0.92 })));
    this.placa.add(malla(new THREE.CylinderGeometry(RADIO_PLACA + 0.012, RADIO_PLACA + 0.012, 0.045, 48, 1, true), mat('#dff4ff', { opacidad: 0.35, lados: THREE.DoubleSide }), [0, 0.012, 0]));
    const anillo = malla(new THREE.RingGeometry(RADIO_PLACA + 0.015, RADIO_PLACA + 0.035, 64), new THREE.MeshBasicMaterial({ color: '#5ff7ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), [0, 0.03, 0], [-Math.PI / 2, 0, 0]);
    this.placa.add(anillo);
    this.cadaCuadro((_dt, t) => (anillo.material.opacity = 0.55 + Math.sin(t * 3) * 0.25));

    this.colonias = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0065, 6, 4), new THREE.MeshBasicMaterial({ color: '#1f9d5a' }), MAX_PUNTOS);
    this.colonias.count = 0;
    this.colonias.frustumCulled = false;
    this.placa.add(this.colonias);
    this.pelicula = malla(new THREE.CircleGeometry(RADIO_PLACA - 0.01, 48), new THREE.MeshBasicMaterial({ color: '#2dbe78', transparent: true, opacity: 0, depthWrite: false }), [0, 0.0095, 0], [-Math.PI / 2, 0, 0]);
    this.placa.add(this.pelicula);
    this.raiz.add(this.placa);
    this.presentar(this.placa, 0.15);
  }

  /** Ajusta los puntos visibles: las nuevas bacterias nacen junto a otras (forman colonias). */
  _ajustarPuntos(n) {
    const objetivo = Math.min(Math.floor(n + 1e-9), MAX_PUNTOS);
    const m = new THREE.Matrix4();
    while (this.posiciones.length < objetivo) {
      let p;
      if (!this.posiciones.length || Math.random() < 0.04) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * RADIO_PLACA * 0.85;
        p = new THREE.Vector3(Math.cos(a) * r, 0.0105, Math.sin(a) * r);
      } else {
        const madre = this.posiciones[Math.floor(Math.random() * this.posiciones.length)];
        const a = Math.random() * Math.PI * 2;
        const r = 0.008 + Math.random() * 0.012;
        p = new THREE.Vector3(madre.x + Math.cos(a) * r, 0.0105, madre.z + Math.sin(a) * r);
        if (Math.hypot(p.x, p.z) > RADIO_PLACA * 0.92) p.multiplyScalar(0.9).setY(0.0105);
      }
      this.colonias.setMatrixAt(this.posiciones.length, m.makeTranslation(p.x, p.y, p.z));
      this.posiciones.push(p);
    }
    if (this.posiciones.length > objetivo) {
      this.posiciones.length = objetivo;
      const ahora = this.m.app.tiempo;
      if (!this._ultimoEstallido || ahora - this._ultimoEstallido > 0.15) {
        this._ultimoEstallido = ahora;
        this.m.fx.pixeles(this.posMundo(this.placa), '#ff8a5c', 18, 0.35);
      }
    }
    this.colonias.count = objetivo;
    this.colonias.instanceMatrix.needsUpdate = true;
    this.pelicula.material.opacity = n > MAX_PUNTOS ? Math.min(0.75, (Math.log2(n) - 10) * 0.15) : 0;
  }

  _mostrarReto() {
    const { H } = this;
    const r = this.retos[this.actual];
    this.estado = 'pregunta';
    this.n = r.inicial ?? 1;
    this.minutos = 0;
    this.posiciones = [];
    this.colonias.count = 0;
    this._ajustarPuntos(this.n);
    this.btnSiguiente.visible = false;
    this.cabecera.derecha(this.t('retoDe', { n: this.actual + 1, total: this.retos.length }));
    const letras = ['A', 'B', 'C', 'D'];
    const n = r.opciones.length;
    this.botones.forEach((b, i) => {
      b.visible = i < n;
      if (!b.visible) return;
      b.position.set((i - (n - 1) / 2) * 0.36, H - 0.17, -1.22);
      b.lookAt(0, H, 0);
      b.setModo('normal');
      b.setTexto(`${letras[i]}. ${r.opciones[i]}`);
      this.m.entrada.habilitar(b, true);
      this.m.fx.aparecer(b, 0.35, i * 0.06);
    });
    this.panel.redibujar();
    this.termometro.redibujar();
    this.contador.redibujar();
    this.narrar(r.pregunta);
  }

  _responder(i) {
    if (this.estado !== 'pregunta') return;
    const r = this.retos[this.actual];
    const bien = i === r.correcta;
    if (bien) this.aciertos++;
    this.botones.forEach((b, k) => {
      this.m.entrada.habilitar(b, false);
      b.setModo(k === r.correcta ? 'correcto' : k === i ? 'incorrecto' : 'apagado');
    });
    const pos = this.posMundo(this.botones[i]);
    if (bien) {
      this.m.audio.acierto(pos);
      this.ganar(pos, 200);
    } else {
      this.m.audio.error(pos);
      this.perder();
    }
    this.cabecera.mensaje(`${bien ? '✅' : '💡'} ${r.explicacion}`, bien ? COLORES.verde : COLORES.naranja);
    this.narrar(r.explicacion);
    this._simular(r);
  }

  /** Avanza el reloj de la simulación y muestra cómo cambia la población. */
  _simular(r) {
    this.estado = 'simulando';
    const inicial = r.inicial ?? 1;
    const total = r.horas * 60;
    let duplicaciones = 0;
    this.m.fx
      .tween({
        duracion: 4.5,
        retardo: 0.6,
        curva: (k) => k,
        alActualizar: (k) => {
          this.minutos = k * total;
          this.n = poblacion(inicial, r.temperatura, this.minutos);
          this._ajustarPuntos(this.n);
          const d = Math.floor(Math.log2(Math.max(this.n, 1) / inicial));
          if (d > duplicaciones) {
            duplicaciones = d;
            this.m.audio.burbuja(this.posMundo(this.placa));
            this.m.fx.latido(this.placa, 0.04);
          }
        },
      })
      .then(() => {
        if (this._destruida) return;
        this.estado = 'listo';
        this.contador.redibujar();
        this.btnSiguiente.setTexto(this.actual === this.retos.length - 1 ? this.t('verResultado') : this.t('siguienteReto'));
        // Las opciones ya se vieron coloreadas durante la simulación; ahora deja paso al botón.
        this.botones.forEach((b) => (b.visible = false));
        this.btnSiguiente.visible = true;
        this.m.fx.aparecer(this.btnSiguiente, 0.4);
      });
  }

  _avanzar() {
    if (this.estado === 'final') return this.terminar();
    if (this.estado !== 'listo') return;
    this.actual++;
    if (this.actual < this.retos.length) return this._mostrarReto();
    this.estado = 'final';
    this.botones.forEach((b) => (b.visible = false));
    this.panel.redibujar();
    this.m.audio.exito();
    this.m.fx.confeti(this.posMundo(this.panel).add(new THREE.Vector3(0, 0, 0.3)), 80);
    this.cabecera.mensaje(this.t('simCompleta'), COLORES.verde);
    this.btnSiguiente.setTexto(this.t('continuar'));
    this.btnSiguiente.setModo('normal');
  }

  // ── Paneles ─────────────────────────────────────────────────────────────

  _dibujarPregunta(ctx, w, h) {
    tarjeta(ctx, w, h, { radio: 40 });
    if (this.estado === 'final') {
      escribir(ctx, '🧪', w / 2, 40, { tam: 90, alinear: 'center' });
      escribir(ctx, this.t('resultado', { n: this.aciertos, total: this.retos.length }), w / 2, 170, { tam: 54, peso: 800, alinear: 'center', maxAncho: w - 80 });
      escribir(ctx, this.t('simResumen'), w / 2, 250, { tam: 34, color: COLORES.suave, alinear: 'center', maxAncho: w - 80 });
      return;
    }
    const r = this.retos[this.actual];
    const ancho = pastilla(ctx, this.t('retoDe', { n: this.actual + 1, total: this.retos.length }), 36, 26, { tam: 26, fondo: '#e8f6ff' });
    const condiciones = `🌡️ ${r.temperatura} °C  ·  ⏱ ${textoTiempo(r.horas * 60)}  ·  🦠 ${this.t('inicio')}: ${formato(r.inicial ?? 1)}`;
    escribir(ctx, condiciones, 36 + ancho + 16, 32, { tam: 28, peso: 700, color: COLORES.primario, maxAncho: w - ancho - 90 });
    escribir(ctx, r.pregunta, 36, 92, { tam: 40, tamMin: 28, peso: 700, maxAncho: w - 72, maxAlto: h - 116, interlineado: 1.18 });
  }

  _dibujarTermometro(ctx, w, h) {
    const r = this.retos[this.actual] ?? this.retos[this.retos.length - 1];
    const t = r.temperatura;
    ctx.fillStyle = '#0d1426';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 36);
    ctx.fill();
    ctx.strokeStyle = '#5ff7ff';
    ctx.lineWidth = 6;
    ctx.stroke();
    escribir(ctx, this.t('temperatura'), 30, 26, { tam: 34, peso: 800, color: '#5ff7ff' });
    escribir(ctx, `${t} °C`, 30, 82, { tam: 92, peso: 800, color: colorTemperatura(t) });
    escribir(ctx, lugarTemperatura(t), 30, 190, { tam: 34, peso: 700, color: '#ffffff', maxAncho: w - 60 });
    // Barra vertical de -10 °C a 80 °C con la zona de peligro
    const x = w - 120;
    const y0 = 90;
    const y1 = h - 50;
    const aY = (grados) => y1 - ((grados + 10) / 90) * (y1 - y0);
    ctx.fillStyle = '#1f2b4a';
    ctx.fillRect(x, y0, 46, y1 - y0);
    ctx.fillStyle = 'rgba(255, 90, 95, 0.45)';
    ctx.fillRect(x, aY(60), 46, aY(5) - aY(60));
    ctx.fillStyle = colorTemperatura(t);
    ctx.fillRect(x + 10, aY(t), 26, y1 - aY(t));
    ctx.beginPath();
    ctx.arc(x + 23, y1 + 14, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = fuente(22, 700);
    ctx.textAlign = 'right';
    for (const g of [0, 5, 37, 60, 75]) ctx.fillText(`${g}°`, x - 8, aY(g) + 8);
    ctx.textAlign = 'left';
    escribir(ctx, this.t('zonaPeligro'), 30, h - 150, { tam: 28, peso: 700, color: '#ff8a8d', maxAncho: w - 190, interlineado: 1.15 });
  }

  _dibujarContador(ctx, w, h) {
    const r = this.retos[this.actual] ?? this.retos[this.retos.length - 1];
    ctx.fillStyle = '#0d1426';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 36);
    ctx.fill();
    ctx.strokeStyle = '#7dff9a';
    ctx.lineWidth = 6;
    ctx.stroke();
    escribir(ctx, this.t('poblacion'), 30, 26, { tam: 34, peso: 800, color: '#7dff9a' });
    escribir(ctx, formato(this.n), 30, 76, { tam: 84, tamMin: 50, peso: 800, color: '#ffffff', maxAncho: w - 60 });
    escribir(ctx, `⏱ ${textoTiempo(this.minutos)}`, 30, 176, { tam: 34, peso: 700, color: '#ffc23c' });
    if (this.n > MAX_PUNTOS) escribir(ctx, this.t('demasiadas'), 30, 222, { tam: 24, color: '#9fb3c8', maxAncho: w - 60 });
    // Gráfico de barras cada 20 minutos (escala lineal: se nota la curva exponencial)
    const pasos = Math.max(1, Math.round((r.horas * 60) / 20));
    const inicial = r.inicial ?? 1;
    const valores = Array.from({ length: pasos + 1 }, (_, j) => poblacion(inicial, r.temperatura, Math.min(j * 20, r.horas * 60)));
    const maximo = Math.max(...valores, 1);
    const x0 = 30;
    const ancho = w - 60;
    const base = h - 40;
    const alto = 230;
    const bw = ancho / valores.length;
    valores.forEach((v, j) => {
      if (j * 20 > this.minutos + 0.01) return;
      const bh = Math.max(3, (v / maximo) * alto);
      ctx.fillStyle = r.temperatura >= 60 ? '#ff8a5c' : r.temperatura < 5 ? '#5ab8ff' : '#7dff9a';
      ctx.fillRect(x0 + j * bw + 3, base - bh, bw - 6, bh);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, base + 2);
    ctx.lineTo(x0 + ancho, base + 2);
    ctx.stroke();
  }
}
