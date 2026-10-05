import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar, ponerCara, liberar } from '../materiales.js';
import { PanelLienzo, escribir } from '../../ui/lienzo.js';

// Modelos para lecciones de Design Thinking y emprendimiento.

const CARTON = '#c8a06a';
const CARTON_OSCURO = '#a87f4c';

function estatico(construir, anclaje = 'base') {
  const g = new THREE.Group();
  construir(g);
  fusionar(g);
  g.userData.anclaje = anclaje;
  return g;
}

/** Envuelve un grupo y le da una animación `fn(hijo, t)`. */
function animado(hijo, fn) {
  const g = new THREE.Group();
  g.add(hijo);
  g.userData.anclaje = hijo.userData.anclaje ?? 'base';
  g.userData.animar = (t) => fn(hijo, t);
  return g;
}

/** Texto plano pintado sobre un plano (carteles, etiquetas de maquetas). */
function letrero(texto, ancho, alto, { fondo = '#ffffff', color = '#23304a', tam = 80 } = {}) {
  const p = new PanelLienzo(ancho, alto, (ctx, w, h) => {
    ctx.fillStyle = fondo;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.12);
    ctx.fill();
    escribir(ctx, texto, w / 2, h / 2, { tam, tamMin: 20, peso: 800, color, alinear: 'center', base: 'middle', maxAncho: w * 0.9, maxAlto: h * 0.9, interlineado: 1.1 });
  });
  p.userData.noFusionar = true;
  return p;
}

// ── Personaje ──────────────────────────────────────────────────────────────

/**
 * Estudiante de tamaño real (~1,15 m), con uniforme escolar y expresiones.
 * opciones: { peinado: 'colitas' | 'corto', expresion, cabello, piel, sueter, falda }
 * API (en userData): setExpresion(expresion), hablar(segundos)
 */
export function estudiante({ peinado = 'colitas', expresion = 'neutral', cabello = '#3b2416', piel = '#c98b5e', sueter = '#2f4a8a', falda = '#4d5566' } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  const pielM = mat(piel);
  const sueterM = mat(sueter);
  // Zapatos, medias y piernas
  for (const lado of [-1, 1]) {
    cuerpo.add(malla(new RoundedBoxGeometry(0.09, 0.06, 0.15, 2, 0.025), mat('#1d1d27'), [lado * 0.07, 0.03, 0.02]));
    cuerpo.add(malla(new THREE.CylinderGeometry(0.043, 0.04, 0.2, 12), mat('#ffffff'), [lado * 0.07, 0.15, 0]));
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.042, 0.16, 4, 10), peinado === 'colitas' ? pielM : mat(falda), [lado * 0.07, 0.34, 0]));
  }
  // Falda o pantalón, torso y cuello de la camisa
  if (peinado === 'colitas') cuerpo.add(malla(new THREE.CylinderGeometry(0.13, 0.19, 0.18, 20), mat(falda), [0, 0.5, 0]));
  else cuerpo.add(malla(new RoundedBoxGeometry(0.26, 0.16, 0.16, 2, 0.05), mat(falda), [0, 0.5, 0]));
  cuerpo.add(malla(new THREE.CapsuleGeometry(0.135, 0.2, 6, 16), sueterM, [0, 0.72, 0], [0, 0, 0], [1, 1, 0.75]));
  cuerpo.add(malla(new THREE.ConeGeometry(0.06, 0.06, 3), mat('#ffffff'), [0, 0.88, 0.07], [Math.PI, 0, 0], [1.4, 1, 0.4]));
  // Brazos y manos
  for (const lado of [-1, 1]) {
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.038, 0.28, 4, 10), sueterM, [lado * 0.175, 0.68, 0], [0, 0, lado * 0.12]));
    cuerpo.add(malla(new THREE.SphereGeometry(0.042, 12, 10), pielM, [lado * 0.2, 0.5, 0.01]));
  }
  cuerpo.add(malla(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), pielM, [0, 0.9, 0]));
  fusionar(cuerpo);
  g.add(cuerpo);

  // Cabeza (grupo propio para poder inclinarla)
  const cabeza = new THREE.Group();
  cabeza.position.y = 1.0;
  const craneo = new THREE.Group();
  const r = 0.15;
  craneo.add(malla(new THREE.SphereGeometry(r, 28, 20), pielM));
  craneo.add(malla(new THREE.SphereGeometry(r * 1.06, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(cabello), [0, 0.005, -0.01], [-0.45, 0, 0]));
  craneo.add(malla(new THREE.SphereGeometry(r * 1.02, 24, 16), mat(cabello), [0, 0.01, -0.035], [0, 0, 0], [1, 1, 0.9]));
  for (const lado of [-1, 1]) craneo.add(malla(new THREE.SphereGeometry(0.03, 10, 8), pielM, [lado * r * 0.98, -0.01, 0], [0, 0, 0], [0.6, 1, 1]));
  if (peinado === 'colitas') {
    for (const lado of [-1, 1]) {
      craneo.add(malla(new THREE.SphereGeometry(0.055, 14, 10), mat(cabello), [lado * 0.17, 0.0, -0.05], [0, 0, 0], [0.8, 1.3, 0.8]));
      craneo.add(malla(new THREE.SphereGeometry(0.022, 10, 8), mat('#e5484d'), [lado * 0.145, 0.06, -0.04]));
    }
  }
  fusionar(craneo);
  cabeza.add(craneo);
  const cara = new THREE.Group();
  cabeza.add(cara);
  const cachetes = new THREE.Group();
  for (const lado of [-1, 1]) cachetes.add(malla(new THREE.CircleGeometry(0.022, 16), mat('#ff8fa3', { tipo: 'basica', opacidad: 0.55 }), [lado * 0.085, -0.035, r * 0.95], [0, lado * 0.45, 0]));
  cabeza.add(cachetes);
  g.add(cabeza);

  const setExpresion = (e) => {
    for (const hijo of [...cara.children]) {
      cara.remove(hijo);
      liberar(hijo);
    }
    ponerCara(cara, { r, caracter: e, y: 0.0, z: r, escalaBoca: 1.45 });
    fusionar(cara);
    g.userData.expresion = e;
  };
  setExpresion(expresion);

  let hablaHasta = 0;
  let tActual = 0;
  g.userData.setExpresion = setExpresion;
  g.userData.hablar = (segundos = 2) => (hablaHasta = tActual + segundos);
  g.userData.animar = (t) => {
    tActual = t;
    const habla = t < hablaHasta;
    cuerpo.scale.y = 1 + Math.sin(t * 2.1) * 0.008;
    cabeza.position.y = 1.0 + Math.sin(t * 2.1) * 0.006 + (habla ? Math.abs(Math.sin(t * 9)) * 0.01 : 0);
    cabeza.rotation.z = Math.sin(t * 0.7) * 0.06 + (habla ? Math.sin(t * 5) * 0.05 : 0);
    cabeza.rotation.x = habla ? Math.sin(t * 7) * 0.05 : Math.sin(t * 0.5) * 0.03;
  };
  g.userData.anclaje = 'pies';
  return g;
}

// ── Patio ──────────────────────────────────────────────────────────────────

/** Bebedero escolar de pedestal (~1 m de alto). opciones: { agua: true } muestra el chorro. */
export function bebedero({ agua = false } = {}) {
  const g = estatico((b) => {
    const metal = mat('#aeb9c8');
    b.add(malla(new RoundedBoxGeometry(0.5, 0.06, 0.45, 2, 0.02), mat('#8a94a3'), [0, 0.03, 0]));
    b.add(malla(new RoundedBoxGeometry(0.26, 0.82, 0.24, 3, 0.04), metal, [0, 0.47, 0]));
    b.add(malla(new RoundedBoxGeometry(0.46, 0.1, 0.4, 3, 0.04), mat('#c9d2de'), [0, 0.92, 0.02]));
    b.add(malla(new RoundedBoxGeometry(0.38, 0.03, 0.3, 2, 0.012), mat('#5d6b7d'), [0, 0.965, 0.03]));
    b.add(malla(new THREE.CylinderGeometry(0.018, 0.022, 0.06, 12), mat('#7b8798'), [0.05, 1.0, 0.0]));
    b.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), mat('#e5484d'), [0.16, 0.92, 0.22], [Math.PI / 2, 0, 0]));
    b.add(malla(new THREE.BoxGeometry(0.16, 0.1, 0.005), mat('#2f8be6'), [0, 0.6, 0.121]));
    b.add(malla(new THREE.CircleGeometry(0.025, 16), mat('#ffffff', { tipo: 'basica' }), [0, 0.6, 0.125]));
  });
  if (!agua) return g;
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.05, 1.03, 0), new THREE.Vector3(0.02, 1.13, 0.06), new THREE.Vector3(-0.03, 0.98, 0.1));
  const chorro = malla(new THREE.TubeGeometry(curva, 16, 0.008, 6), mat('#8fd3ff', { tipo: 'basica', opacidad: 0.7 }));
  g.add(chorro);
  g.userData.animar = (t) => {
    chorro.scale.y = 1 + Math.sin(t * 12) * 0.03;
  };
  return g;
}

// ── Íconos de las 5 fases ──────────────────────────────────────────────────

export function bombilla({ encendida = true } = {}) {
  const vidrio = new THREE.Group();
  const perfil = [[0, -0.02], [0.045, 0.0], [0.05, 0.04], [0.09, 0.11], [0.1, 0.17], [0.085, 0.235], [0.05, 0.27], [0, 0.28]].map(([x, y]) => new THREE.Vector2(x, y));
  vidrio.add(malla(new THREE.LatheGeometry(perfil, 32), mat(encendida ? '#fff3b0' : '#e8eef5', { opacidad: 0.55, emisivo: encendida ? 0.5 : 0 }), [0, 0.12, 0]));
  vidrio.add(malla(new THREE.TorusGeometry(0.025, 0.006, 6, 16), mat(encendida ? '#ffb300' : '#7b8798', { tipo: encendida ? 'basica' : 'toon' }), [0, 0.27, 0]));
  vidrio.add(malla(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 6), mat('#ffcf40', { tipo: 'basica' }), [-0.02, 0.22, 0], [0, 0, 0.2]));
  vidrio.add(malla(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 6), mat('#ffcf40', { tipo: 'basica' }), [0.02, 0.22, 0], [0, 0, -0.2]));
  const rosca = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24);
  for (let i = 0; i < 4; i++) vidrio.add(malla(rosca, mat(i % 2 ? '#9aa7b8' : '#c9d2de'), [0, 0.105 - i * 0.022, 0]));
  vidrio.add(malla(new THREE.CylinderGeometry(0.02, 0.035, 0.03, 16), mat('#37474f'), [0, 0.02, 0]));
  fusionar(vidrio);
  if (!encendida) return vidrio;
  const brillo = malla(new THREE.SphereGeometry(0.06, 16, 12), mat('#ffe680', { tipo: 'basica', opacidad: 0.6 }), [0, 0.32, 0]);
  vidrio.add(brillo);
  return animado(vidrio, (h, t) => {
    h.rotation.y = Math.sin(t * 0.8) * 0.3;
    brillo.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
  });
}

export function binoculares() {
  return estatico((g) => {
    const negro = mat('#2b2b33');
    for (const lado of [-1, 1]) {
      g.add(malla(new THREE.CylinderGeometry(0.05, 0.055, 0.16, 20), negro, [lado * 0.065, 0.06, 0], [Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 20), mat('#1d1d27'), [lado * 0.065, 0.06, 0.09], [Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.CircleGeometry(0.045, 20), mat('#4f9cff', { emisivo: 0.3 }), [lado * 0.065, 0.06, 0.106]));
      g.add(malla(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 16), mat('#37474f'), [lado * 0.065, 0.06, -0.1], [Math.PI / 2, 0, 0]));
    }
    g.add(malla(new RoundedBoxGeometry(0.06, 0.04, 0.08, 2, 0.015), mat('#37474f'), [0, 0.07, 0]));
  });
}

export function pieza_rompecabezas({ color = '#2f5d73', texto = 'PROBLEMA' } = {}) {
  const s = 0.2;
  const forma = new THREE.Shape();
  forma.moveTo(-s / 2, -s / 2);
  forma.lineTo(s / 2, -s / 2);
  forma.lineTo(s / 2, -0.03);
  forma.absarc(s / 2 + 0.025, 0, 0.035, Math.PI * 1.15, Math.PI * 0.85 + Math.PI * 2, false);
  forma.lineTo(s / 2, s / 2);
  forma.lineTo(0.03, s / 2);
  forma.absarc(0, s / 2 + 0.025, 0.035, -Math.PI * 0.35, Math.PI * 1.35, false);
  forma.lineTo(-s / 2, s / 2);
  forma.lineTo(-s / 2, 0.03);
  forma.absarc(-s / 2 + 0.02, 0, 0.033, Math.PI * 0.5, -Math.PI * 0.5, true);
  forma.lineTo(-s / 2, -s / 2);
  const g = estatico((p) => {
    p.add(malla(new THREE.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }), mat(color), [0, 0, -0.015]));
  }, 'centro');
  const cartel = letrero(texto, 0.17, 0.05, { fondo: color, color: '#ffffff', tam: 70 });
  cartel.position.z = 0.025;
  g.add(cartel);
  return g;
}

export function nota_adhesiva({ color = '#ffe066' } = {}) {
  return estatico((g) => {
    g.add(malla(new THREE.BoxGeometry(0.12, 0.12, 0.004), mat(color), [0, 0.06, 0]));
    g.add(malla(new THREE.BoxGeometry(0.12, 0.03, 0.004), mat(color), [0, 0.0, 0.008], [0.35, 0, 0]));
    g.add(malla(new THREE.SphereGeometry(0.009, 10, 8), mat('#e5484d'), [0, 0.11, 0.006]));
  });
}

// ── Prototipado ────────────────────────────────────────────────────────────

/** Caja de cartón abierta. */
export function caja_carton() {
  return estatico((g) => cajaAbierta(g, 0.3, 0.2, 0.24, true));
}

function cajaAbierta(g, w, h, d, solapas) {
  const c = mat(CARTON);
  const e = 0.008;
  g.add(malla(new THREE.BoxGeometry(w, e, d), mat(CARTON_OSCURO), [0, e / 2, 0]));
  g.add(malla(new THREE.BoxGeometry(w, h, e), c, [0, h / 2, d / 2]));
  g.add(malla(new THREE.BoxGeometry(w, h, e), c, [0, h / 2, -d / 2]));
  g.add(malla(new THREE.BoxGeometry(e, h, d), c, [w / 2, h / 2, 0]));
  g.add(malla(new THREE.BoxGeometry(e, h, d), c, [-w / 2, h / 2, 0]));
  if (solapas) {
    g.add(malla(new THREE.BoxGeometry(w, e, d * 0.45), c, [0, h + 0.03, d / 2 + 0.05], [-0.9, 0, 0]));
    g.add(malla(new THREE.BoxGeometry(w, e, d * 0.45), c, [0, h + 0.03, -d / 2 - 0.05], [0.9, 0, 0]));
    g.add(malla(new THREE.BoxGeometry(w * 0.45, e, d), c, [w / 2 + 0.05, h + 0.02, 0], [0, 0, 1.1]));
  }
  // Líneas de cinta para que se note el cartón
  g.add(malla(new THREE.BoxGeometry(w * 0.6, 0.015, 0.002), mat(CARTON_OSCURO), [0, h * 0.7, d / 2 + 0.005]));
}

export function botella_plastica({ color = '#8fd3ff' } = {}) {
  return estatico((g) => {
    g.add(malla(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 18), mat(color, { opacidad: 0.6 }), [0, 0.08, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.013, 0.032, 0.05, 18), mat(color, { opacidad: 0.6 }), [0, 0.185, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 14), mat('#2f8be6'), [0, 0.218, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.0325, 0.0325, 0.05, 18), mat('#ffffff'), [0, 0.09, 0]));
  });
}

export function cinta_adhesiva({ color = '#ff9f43' } = {}) {
  return estatico((g) => {
    g.add(malla(new THREE.TorusGeometry(0.05, 0.025, 12, 28), mat(color), [0, 0.06, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 20, 1, true), mat('#d9c7a8', { lados: THREE.DoubleSide }), [0, 0.06, 0], [Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.BoxGeometry(0.05, 0.002, 0.045), mat(color), [0.04, 0.012, 0], [0, 0, -0.2]));
  });
}

/**
 * Maqueta del "escalón seguro" hecha con material reciclado, por etapas:
 * 1 caja abierta · 2 rellena con botellas · 3 cerrada y forrada con cinta ·
 * 4 decorada con colores · 5 con caucho antideslizante y cartel.
 */
export function maqueta_escalon({ etapa = 5 } = {}) {
  const [w, h, d] = [0.5, 0.22, 0.36];
  const g = new THREE.Group();
  const s = new THREE.Group();
  if (etapa <= 2) cajaAbierta(s, w, h, d, etapa === 1);
  if (etapa === 2) {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        s.add(malla(new THREE.CylinderGeometry(0.035, 0.035, h * 0.92, 14), mat('#8fd3ff', { opacidad: 0.7 }), [-0.18 + i * 0.12, h * 0.48, -0.11 + j * 0.11]));
        s.add(malla(new THREE.CylinderGeometry(0.016, 0.016, 0.015, 10), mat('#2f8be6'), [-0.18 + i * 0.12, h * 0.95, -0.11 + j * 0.11]));
      }
  }
  if (etapa >= 3) {
    s.add(malla(new RoundedBoxGeometry(w, h, d, 2, 0.012), mat(etapa >= 4 ? '#ffd166' : CARTON), [0, h / 2, 0]));
    const cinta = mat(etapa >= 4 ? '#2f8be6' : '#d9c7a8');
    s.add(malla(new THREE.BoxGeometry(w + 0.004, 0.05, d + 0.004), cinta, [0, h * 0.25, 0]));
    s.add(malla(new THREE.BoxGeometry(w + 0.004, 0.05, d + 0.004), cinta, [0, h * 0.75, 0]));
  }
  if (etapa >= 4) {
    // Rayas de colores en el frente
    ['#e5484d', '#2dbe78', '#8b5cf6'].forEach((c, i) => s.add(malla(new THREE.BoxGeometry(0.06, h * 0.9, 0.004), mat(c), [-0.15 + i * 0.15, h / 2, d / 2 + 0.004])));
  }
  if (etapa >= 5) {
    s.add(malla(new RoundedBoxGeometry(w * 0.92, 0.018, d * 0.88, 2, 0.006), mat('#2b2b33'), [0, h + 0.009, 0]));
    for (let i = 0; i < 6; i++) s.add(malla(new THREE.BoxGeometry(w * 0.85, 0.006, 0.012), mat('#4a4a55'), [0, h + 0.02, -d * 0.36 + i * d * 0.145]));
    s.add(malla(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), mat('#8d6e63'), [w / 2 - 0.03, h + 0.15, -d / 2 + 0.03]));
  }
  fusionar(s);
  g.add(s);
  if (etapa >= 5) {
    const cartel = letrero('¡Para los pequeños!', 0.24, 0.09, { fondo: '#ffffff', color: '#2f4a8a', tam: 60 });
    cartel.position.set(w / 2 - 0.03, h + 0.26, -d / 2 + 0.04);
    g.add(cartel);
  }
  g.userData.anclaje = 'base';
  return g;
}

// ── Testeo ─────────────────────────────────────────────────────────────────

export function portapapeles() {
  return estatico((g) => {
    g.add(malla(new RoundedBoxGeometry(0.22, 0.3, 0.012, 2, 0.01), mat('#b5835a'), [0, 0.15, 0]));
    g.add(malla(new THREE.BoxGeometry(0.19, 0.25, 0.003), mat('#ffffff'), [0, 0.14, 0.008]));
    g.add(malla(new RoundedBoxGeometry(0.09, 0.035, 0.02, 2, 0.008), mat('#9aa7b8'), [0, 0.29, 0.012]));
    for (let i = 0; i < 3; i++) {
      const y = 0.22 - i * 0.06;
      g.add(malla(new THREE.BoxGeometry(0.03, 0.03, 0.003), mat('#ffffff'), [-0.06, y, 0.011]));
      g.add(malla(new THREE.BoxGeometry(0.032, 0.006, 0.004), mat('#2dbe78'), [-0.064, y - 0.004, 0.013], [0, 0, -0.8]));
      g.add(malla(new THREE.BoxGeometry(0.045, 0.006, 0.004), mat('#2dbe78'), [-0.05, y + 0.004, 0.013], [0, 0, 0.9]));
      g.add(malla(new THREE.BoxGeometry(0.09, 0.006, 0.003), mat('#c9d2de'), [0.03, y, 0.011]));
    }
  });
}

export function lapiz() {
  return estatico((g) => {
    g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), mat('#ffc23c'), [0, 0.1, 0]));
    g.add(malla(new THREE.ConeGeometry(0.012, 0.035, 6), mat('#f2d19b'), [0, 0.217, 0]));
    g.add(malla(new THREE.ConeGeometry(0.004, 0.01, 6), mat('#2b2b33'), [0, 0.232, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.0125, 0.0125, 0.02, 6), mat('#b8c4d6'), [0, -0.005, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), mat('#ff8fa3'), [0, -0.025, 0]));
  });
}

export function globo_dialogo({ color = '#22b8cf' } = {}) {
  const forma = new THREE.Shape();
  const [w, h, r] = [0.24, 0.16, 0.05];
  forma.moveTo(-w / 2 + r, -h / 2);
  forma.lineTo(-0.02, -h / 2);
  forma.lineTo(-0.06, -h / 2 - 0.05);
  forma.lineTo(-0.07, -h / 2);
  forma.lineTo(w / 2 - r, -h / 2);
  forma.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  forma.lineTo(w / 2, h / 2 - r);
  forma.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  forma.lineTo(-w / 2 + r, h / 2);
  forma.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  forma.lineTo(-w / 2, -h / 2 + r);
  forma.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = estatico((p) => {
    p.add(malla(new THREE.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }), mat(color), [0, 0, -0.015]));
  }, 'centro');
  const signo = letrero('?', 0.08, 0.1, { fondo: color, color: '#ffffff', tam: 90 });
  signo.position.z = 0.025;
  g.add(signo);
  return animado(g, (hijo, t) => (hijo.rotation.z = Math.sin(t * 1.5) * 0.08));
}

export const diseno = {
  estudiante,
  bebedero,
  bombilla,
  binoculares,
  pieza_rompecabezas,
  nota_adhesiva,
  caja_carton,
  botella_plastica,
  cinta_adhesiva,
  maqueta_escalon,
  portapapeles,
  lapiz,
  globo_dialogo,
};
