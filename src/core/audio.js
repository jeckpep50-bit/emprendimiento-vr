import * as THREE from 'three';

const VOCES_PREFERIDAS = {
  es: ['es-US', 'es-MX', 'es-419', 'es-ES', 'es'],
  en: ['en-US', 'en-GB', 'en'],
};

/**
 * Efectos de sonido sintetizados (sin archivos) con audio espacial 3D,
 * y narración por voz con la síntesis del navegador cuando está disponible.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.idioma = 'es';
    this._vector = new THREE.Vector3();
    this._adelante = new THREE.Vector3();
    this._arriba = new THREE.Vector3();
  }

  /** Debe llamarse dentro de un gesto del usuario (clic en "Entrar"). */
  desbloquear() {
    if (!this.ctx) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return;
      this.ctx = new Contexto();
      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = 0.9;
      this.maestro.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  /** Mantiene el "oído" virtual en la cabeza del usuario. */
  actualizarOyente(camara) {
    if (!this.ctx) return;
    const oyente = this.ctx.listener;
    camara.getWorldPosition(this._vector);
    camara.getWorldDirection(this._adelante);
    this._arriba.set(0, 1, 0).applyQuaternion(camara.getWorldQuaternion(new THREE.Quaternion()));
    const t = this.ctx.currentTime;
    if (oyente.positionX) {
      oyente.positionX.setValueAtTime(this._vector.x, t);
      oyente.positionY.setValueAtTime(this._vector.y, t);
      oyente.positionZ.setValueAtTime(this._vector.z, t);
      oyente.forwardX.setValueAtTime(this._adelante.x, t);
      oyente.forwardY.setValueAtTime(this._adelante.y, t);
      oyente.forwardZ.setValueAtTime(this._adelante.z, t);
      oyente.upX.setValueAtTime(this._arriba.x, t);
      oyente.upY.setValueAtTime(this._arriba.y, t);
      oyente.upZ.setValueAtTime(this._arriba.z, t);
    }
  }

  /** Tono simple. `pos` (Vector3 en mundo) lo hace sonar desde ese punto del espacio. */
  tono(frecuencia, duracion = 0.12, { tipo = 'sine', volumen = 0.15, retardo = 0, hasta = null, pos = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + retardo;
    const osc = this.ctx.createOscillator();
    const ganancia = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, t0);
    if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, t0 + duracion);
    ganancia.gain.setValueAtTime(0.0001, t0);
    ganancia.gain.exponentialRampToValueAtTime(volumen, t0 + 0.012);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
    osc.connect(ganancia);

    if (pos) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.8;
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
      ganancia.connect(panner);
      panner.connect(this.maestro);
    } else {
      ganancia.connect(this.maestro);
    }
    osc.start(t0);
    osc.stop(t0 + duracion + 0.05);
  }

  tic() {
    this.tono(1400, 0.03, { volumen: 0.03 });
  }

  pop(pos) {
    this.tono(520, 0.14, { hasta: 1100, volumen: 0.18, pos });
  }

  agarrar() {
    this.tono(380, 0.08, { hasta: 620, volumen: 0.08 });
  }

  acierto(pos) {
    this.tono(660, 0.12, { volumen: 0.14, pos });
    this.tono(880, 0.12, { volumen: 0.14, retardo: 0.09, pos });
    this.tono(1320, 0.22, { volumen: 0.14, retardo: 0.18, pos });
  }

  error(pos) {
    this.tono(240, 0.18, { tipo: 'triangle', volumen: 0.16, pos });
    this.tono(180, 0.28, { tipo: 'triangle', volumen: 0.16, retardo: 0.14, pos });
  }

  exito() {
    const notas = [523, 659, 784, 1047, 784, 1047];
    notas.forEach((f, i) => this.tono(f, i === notas.length - 1 ? 0.5 : 0.14, { tipo: 'triangle', volumen: 0.12, retardo: i * 0.11 }));
  }

  transicion() {
    this.tono(300, 0.4, { hasta: 900, volumen: 0.05 });
  }

  burbuja(pos) {
    this.tono(280 + Math.random() * 200, 0.09, { hasta: 900 + Math.random() * 400, volumen: 0.05, pos });
  }

  gota(pos) {
    this.tono(1400, 0.07, { hasta: 520, volumen: 0.09, pos });
  }

  pajaro(pos) {
    const f = 2600 + Math.random() * 900;
    this.tono(f, 0.08, { hasta: f * 1.3, volumen: 0.035, pos });
    this.tono(f * 1.1, 0.1, { hasta: f * 1.45, volumen: 0.035, retardo: 0.12, pos });
  }

  moneda(pos) {
    this.tono(988, 0.08, { tipo: 'square', volumen: 0.05, pos });
    this.tono(1319, 0.22, { tipo: 'square', volumen: 0.05, retardo: 0.07, pos });
  }

  teletransporte() {
    this.tono(900, 0.18, { hasta: 300, volumen: 0.06 });
  }

  giro() {
    this.tono(700, 0.05, { volumen: 0.03 });
  }

  // ── Ambiente ─────────────────────────────────────────────────────────────

  /** Ruido marrón (grave y suave) reutilizable para los ambientes. */
  _ruido() {
    if (!this._bufferRuido) {
      const n = this.ctx.sampleRate * 3;
      this._bufferRuido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const datos = this._bufferRuido.getChannelData(0);
      let ultimo = 0;
      for (let i = 0; i < n; i++) {
        ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        datos[i] = ultimo * 3.5;
      }
    }
    return this._bufferRuido;
  }

  /**
   * Sonido de fondo continuo de un entorno.
   * config: { frecuencia, volumen, filtro ('lowpass'|'bandpass'), oleaje (Hz de la ondulación) }
   */
  ambiente(config) {
    this.detenerAmbiente();
    if (!this.ctx || !config) return;
    const t = this.ctx.currentTime;
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = this._ruido();
    fuente.loop = true;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = config.filtro ?? 'lowpass';
    filtro.frequency.value = config.frecuencia ?? 400;
    const ganancia = this.ctx.createGain();
    ganancia.gain.setValueAtTime(0, t);
    ganancia.gain.linearRampToValueAtTime(config.volumen ?? 0.05, t + 2);
    fuente.connect(filtro).connect(ganancia).connect(this.maestro);
    fuente.start();
    let lfo = null;
    if (config.oleaje) {
      lfo = this.ctx.createOscillator();
      lfo.frequency.value = config.oleaje;
      const profundidad = this.ctx.createGain();
      profundidad.gain.value = (config.volumen ?? 0.05) * 0.6;
      lfo.connect(profundidad).connect(ganancia.gain);
      lfo.start();
    }
    this._ambiente = { fuente, ganancia, lfo };
  }

  detenerAmbiente() {
    const a = this._ambiente;
    if (!a) return;
    this._ambiente = null;
    const t = this.ctx.currentTime;
    a.ganancia.gain.cancelScheduledValues(t);
    a.ganancia.gain.setValueAtTime(a.ganancia.gain.value, t);
    a.ganancia.gain.linearRampToValueAtTime(0, t + 0.5);
    a.fuente.stop(t + 0.6);
    a.lfo?.stop(t + 0.6);
  }

  /**
   * Sonido continuo que sale de un punto del espacio y se puede mover
   * (una mosca que zumba alrededor, una refrigeradora). Devuelve { mover(pos), detener() }.
   */
  fuenteEspacial(tipo, pos) {
    if (!this.ctx) return { mover() {}, detener() {} };
    const ctx = this.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 0.4;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0;
    ganancia.gain.linearRampToValueAtTime(tipo === 'zumbido' ? 0.05 : 0.03, ctx.currentTime + 1);
    const nodos = [];
    if (tipo === 'zumbido') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 190 + Math.random() * 40;
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 23;
      const prof = ctx.createGain();
      prof.gain.value = 18;
      vibrato.connect(prof).connect(osc.frequency);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 700;
      filtro.Q.value = 1.2;
      osc.connect(filtro).connect(ganancia);
      nodos.push(osc, vibrato);
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 118;
      const osc2 = ctx.createOscillator();
      osc2.frequency.value = 236;
      osc.connect(ganancia);
      osc2.connect(ganancia);
      nodos.push(osc, osc2);
    }
    ganancia.connect(panner).connect(this.maestro);
    nodos.forEach((n) => n.start());
    const mover = (p) => {
      const t = ctx.currentTime;
      panner.positionX.setTargetAtTime(p.x, t, 0.05);
      panner.positionY.setTargetAtTime(p.y, t, 0.05);
      panner.positionZ.setTargetAtTime(p.z, t, 0.05);
    };
    if (pos) mover(pos);
    return {
      mover,
      detener: () => {
        const t = ctx.currentTime;
        ganancia.gain.cancelScheduledValues(t);
        ganancia.gain.setValueAtTime(ganancia.gain.value, t);
        ganancia.gain.linearRampToValueAtTime(0, t + 0.3);
        nodos.forEach((n) => n.stop(t + 0.35));
      },
    };
  }

  // ── Narración ────────────────────────────────────────────────────────────

  puedeNarrar(idioma = this.idioma) {
    if (!('speechSynthesis' in window)) return false;
    return Boolean(this._voz(idioma)) || window.speechSynthesis.getVoices().length === 0;
  }

  narrar(texto, idioma = this.idioma) {
    if (!('speechSynthesis' in window) || !texto) return;
    const sintesis = window.speechSynthesis;
    sintesis.cancel();
    const limpio = texto.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
    const frase = new SpeechSynthesisUtterance(limpio);
    const voz = this._voz(idioma);
    if (voz) frase.voice = voz;
    frase.lang = voz?.lang ?? (idioma === 'en' ? 'en-US' : 'es-US');
    frase.rate = 0.95;
    frase.pitch = 1.05;
    sintesis.speak(frase);
  }

  callar() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  _voz(idioma) {
    const voces = window.speechSynthesis.getVoices();
    for (const codigo of VOCES_PREFERIDAS[idioma] ?? VOCES_PREFERIDAS.es) {
      const voz = voces.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(codigo.toLowerCase()));
      if (voz) return voz;
    }
    return null;
  }
}
