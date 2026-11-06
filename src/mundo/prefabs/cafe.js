import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from '../materiales.js';

// Modelos de la cafetería de inglés A1: Coco, el gallo camarero, y los productos
// de la carta (pizza, galleta, muffin y bebidas en vaso).

function estatico(construir, anclaje = 'base') {
  const g = new THREE.Group();
  construir(g);
  fusionar(g);
  g.userData.anclaje = anclaje;
  return g;
}

/** Fusiona un grupo y lo protege para que nadie lo vuelva a fusionar (partes que se animan). */
function parte(g) {
  fusionar(g);
  g.userData.noFusionar = true;
  return g;
}

const esfera = (r = 1, s = 20) => new THREE.SphereGeometry(r, s, Math.round(s * 0.75));

// ── Coco, el gallo camarero ────────────────────────────────────────────────

/**
 * Gallo de caricatura (≈1,2 m con la boina) que mira hacia +Z, con boina azul,
 * cinta tricolor, cola azul y roja, brújula y bolso de cuero con libros.
 * userData: articulaciones { torso, cabeza, alaI, alaD, cola, picoInf, boina },
 *  animar(t), hablar(segundos), fuenteHabla (0..1 abre el pico), setExpresion(e),
 *  alturaOjos. Las alas se posan con rotation.z (positivo = levantar, signo por lado).
 */
export function gallo() {
  const g = new THREE.Group();
  const blanco = mat('#f6f1e8');
  const crema = mat('#e9dfd0');
  const amarillo = mat('#f6b623');
  const una = mat('#f3e9da');
  const rojo = mat('#e3262c');
  const azul = mat('#2347b8');
  const marino = mat('#26316e');
  const negro = mat('#1d1d27', { tipo: 'basica' });
  const blancoOjo = mat('#ffffff', { tipo: 'basica' });

  // Patas con tres dedos al frente y uno atrás (estáticas)
  for (const s of [-1, 1]) {
    g.add(malla(new THREE.CylinderGeometry(0.032, 0.038, 0.3, 10), amarillo, [s * 0.09, 0.15, 0]));
    for (const a of [-0.55, 0, 0.55, Math.PI]) {
      const dedo = new THREE.Group();
      const largo = a === Math.PI ? 0.05 : 0.085;
      dedo.add(malla(new THREE.CapsuleGeometry(0.021, largo, 4, 8), amarillo, [0, 0, largo / 2 + 0.01], [Math.PI / 2, 0, 0]));
      dedo.add(malla(new THREE.ConeGeometry(0.014, 0.035, 8), una, [0, -0.004, largo + 0.04], [Math.PI / 2, 0, 0]));
      dedo.position.set(s * 0.09, 0.02, 0.01);
      dedo.rotation.y = a;
      g.add(dedo);
    }
  }

  // Torso (se balancea al respirar)
  const torso = new THREE.Group();
  torso.position.y = 0.3;
  g.add(torso);
  torso.add(malla(esfera(1, 28), blanco, [0, 0.2, 0], [0, 0, 0], [0.25, 0.28, 0.23]));
  torso.add(malla(esfera(1, 20), blanco, [0, 0.3, 0.12], [0, 0, 0], [0.17, 0.13, 0.12]));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    torso.add(malla(esfera(0.075, 12), i % 2 ? blanco : crema, [Math.sin(a) * 0.12, 0.42, Math.cos(a) * 0.1 + 0.01]));
  }
  // Correa cruzada (sobre un hombro hasta la cadera)
  const correa = new THREE.Group();
  correa.position.set(0, 0.2, 0);
  correa.rotation.z = -0.62;
  correa.add(malla(new THREE.TorusGeometry(0.262, 0.013, 6, 40), mat('#3a3a42'), [0, 0, 0], [0, Math.PI / 2, 0], [1, 1.08, 0.93]));
  torso.add(correa);
  // Brújula dorada colgada de la correa
  torso.add(malla(new THREE.TorusGeometry(0.042, 0.008, 8, 24), mat('#d9a520', { emisivo: 0.15 }), [0.07, 0.27, 0.21], [-0.25, 0, 0]));
  torso.add(malla(new THREE.CylinderGeometry(0.038, 0.038, 0.008, 24), blancoOjo, [0.07, 0.27, 0.212], [Math.PI / 2 - 0.25, 0, 0]));
  torso.add(malla(new THREE.BoxGeometry(0.008, 0.06, 0.006), mat('#2347b8', { tipo: 'basica' }), [0.07, 0.27, 0.218], [-0.25, 0, 0.5]));
  torso.add(malla(new THREE.BoxGeometry(0.008, 0.06, 0.006), mat('#e3262c', { tipo: 'basica' }), [0.07, 0.27, 0.218], [-0.25, 0, -0.5]));
  // Bolso de cuero con libros
  const bolso = new THREE.Group();
  bolso.position.set(0.19, 0.03, 0.12);
  bolso.rotation.y = 0.45;
  bolso.add(malla(new RoundedBoxGeometry(0.2, 0.15, 0.08, 3, 0.025), mat('#c98a45'), [0, 0, 0]));
  bolso.add(malla(new RoundedBoxGeometry(0.205, 0.08, 0.02, 3, 0.01), mat('#b27735'), [0, 0.035, 0.043], [0.12, 0, 0]));
  bolso.add(malla(new THREE.BoxGeometry(0.035, 0.03, 0.01), mat('#c9ccd4'), [0, 0.0, 0.056]));
  ['#c43a3a', '#2f9c8f', '#7a2f45'].forEach((c, i) => bolso.add(malla(new THREE.BoxGeometry(0.035, 0.12, 0.06), mat(c), [-0.05 + i * 0.045, 0.09, -0.005], [0, 0, (i - 1) * 0.08])));
  torso.add(bolso);

  // Alas (giran en el hombro)
  const alas = [-1, 1].map((s) => {
    const ala = new THREE.Group();
    ala.position.set(s * 0.215, 0.32, 0.01);
    ala.add(malla(esfera(1, 18), blanco, [s * 0.035, -0.13, 0.02], [0, 0, s * 0.12], [0.075, 0.19, 0.15]));
    for (let k = 0; k < 3; k++) ala.add(malla(esfera(1, 10), crema, [s * 0.05, -0.29 + k * 0.012, 0.08 - k * 0.07], [0, 0, 0], [0.04, 0.07, 0.035]));
    ala.rotation.z = s * 0.12;
    ala.userData.lado = s;
    torso.add(parte(ala));
    return ala;
  });

  // Cola azul y roja (se mece)
  const cola = new THREE.Group();
  cola.position.set(0, 0.24, -0.12);
  [
    [0.25, -0.34, azul, 0.05],
    [0.27, 0, azul, 0.05],
    [0.25, 0.34, azul, 0.05],
    [0.19, -0.17, rojo, 0.042],
    [0.19, 0.17, rojo, 0.042],
  ].forEach(([r, abanico, m, grosor]) => {
    const pluma = new THREE.Group();
    pluma.rotation.set(0, Math.PI / 2, abanico);
    pluma.add(malla(new THREE.TorusGeometry(r, grosor, 8, 24, 2.5), m, [0, 0, 0], [0, 0, -1.05], [1, 1, 0.55]));
    pluma.position.y = r - 0.2;
    cola.add(pluma);
  });
  torso.add(parte(cola));

  // Cabeza
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.45, 0.02);
  torso.add(cabeza);
  cabeza.add(malla(esfera(0.18, 28), blanco, [0, 0.17, 0], [0, 0, 0], [1, 1.02, 0.95]));
  for (const s of [-1, 1]) cabeza.add(malla(esfera(0.085, 14), blanco, [s * 0.11, 0.08, 0.05]));
  // Cresta roja asomando bajo la boina y barbillas
  for (const [x, y, r] of [[-0.03, 0.32, 0.038], [0.01, 0.335, 0.043], [0.045, 0.32, 0.035]]) cabeza.add(malla(esfera(r, 12), rojo, [x, y, 0.1]));
  for (const s of [-1, 1]) cabeza.add(malla(esfera(1, 14), rojo, [s * 0.028, 0.03, 0.15], [0, 0, 0], [0.035, 0.045, 0.03]));

  // Ojos (parpadean)
  const ojos = new THREE.Group();
  for (const s of [-1, 1]) {
    ojos.add(malla(esfera(1, 18), blancoOjo, [s * 0.07, 0.21, 0.135], [0, 0, 0], [0.058, 0.074, 0.04]));
    ojos.add(malla(esfera(1, 14), mat('#1f6fd6', { tipo: 'basica' }), [s * 0.064, 0.205, 0.168], [0, 0, 0], [0.034, 0.04, 0.012]));
    ojos.add(malla(esfera(1, 12), negro, [s * 0.062, 0.204, 0.177], [0, 0, 0], [0.019, 0.023, 0.008]));
    ojos.add(malla(esfera(0.009, 8), blancoOjo, [s * 0.056 + 0.008, 0.218, 0.184]));
  }
  ojos.position.y = 0;
  cabeza.add(parte(ojos));
  // Cejas (expresiones)
  const cejas = [-1, 1].map((s) => {
    const c = new THREE.Group();
    c.position.set(s * 0.072, 0.29, 0.14);
    c.add(malla(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), negro, [0, 0, 0], [0, 0, Math.PI / 2]));
    c.rotation.z = s * 0.12;
    c.userData.lado = s;
    cabeza.add(parte(c));
    return c;
  });

  // Pico: arriba fijo, abajo se abre al hablar
  cabeza.add(malla(new THREE.ConeGeometry(0.06, 0.13, 18), amarillo, [0, 0.13, 0.205], [Math.PI / 2, 0, 0], [1.25, 1, 0.62]));
  cabeza.add(malla(esfera(1, 12), mat('#9b1c2a'), [0, 0.105, 0.17], [0, 0, 0], [0.045, 0.02, 0.03]));
  const picoInf = new THREE.Group();
  picoInf.position.set(0, 0.11, 0.155);
  picoInf.add(malla(new THREE.ConeGeometry(0.048, 0.1, 16), mat('#eba51c'), [0, -0.006, 0.05], [Math.PI / 2, 0, 0], [1.2, 1, 0.45]));
  picoInf.add(malla(esfera(1, 10), mat('#f28a9a'), [0, 0.006, 0.035], [0, 0, 0], [0.03, 0.01, 0.035]));
  picoInf.rotation.x = 0.06;
  cabeza.add(parte(picoInf));

  // Boina azul marino inclinada con la cinta tricolor
  const boina = new THREE.Group();
  boina.position.set(0.02, 0.33, -0.01);
  boina.rotation.set(-0.12, 0, -0.22);
  boina.add(malla(esfera(1, 28), marino, [0, 0.03, 0], [0, 0, 0], [0.23, 0.08, 0.215]));
  boina.add(malla(new THREE.TorusGeometry(0.152, 0.024, 10, 32), marino, [0, -0.02, 0], [Math.PI / 2, 0, 0]));
  boina.add(malla(new THREE.CylinderGeometry(0.014, 0.02, 0.045, 10), marino, [0, 0.12, 0]));
  ['#2347b8', '#ffffff', '#e3262c'].forEach((c, i) => {
    boina.add(malla(new THREE.PlaneGeometry(0.03, 0.2), mat(c, { lados: THREE.DoubleSide }), [0.155 + i * 0.024, -0.12 - i * 0.012, 0.04], [0, 0.5, 0.18]));
  });
  cabeza.add(parte(boina));
  parte(cabeza);
  parte(torso);
  fusionar(g);

  // ── Animación ──
  let hablaHasta = 0;
  let tActual = 0;
  let expresion = 'feliz';
  const POSES = {
    feliz: { ceja: 0.12, alto: 0.29, ojo: 1 },
    sorpresa: { ceja: 0, alto: 0.315, ojo: 1.12 },
    duda: { ceja: -0.25, alto: 0.285, ojo: 0.92 },
    neutral: { ceja: 0.05, alto: 0.29, ojo: 1 },
  };
  g.userData.articulaciones = { torso, cabeza, alaI: alas[0], alaD: alas[1], cola, picoInf, boina };
  g.userData.alturaOjos = 0.3 + 0.45 + 0.21;
  g.userData.hablar = (seg) => (hablaHasta = tActual + seg);
  g.userData.setExpresion = (e) => (expresion = POSES[e] ? e : 'neutral');
  g.userData.animar = (t) => {
    tActual = t;
    const nivel = g.userData.fuenteHabla ? g.userData.fuenteHabla() : t < hablaHasta ? Math.abs(Math.sin(t * 11)) * 0.8 : 0;
    picoInf.rotation.x = THREE.MathUtils.lerp(picoInf.rotation.x, 0.06 + Math.min(1, nivel) * 0.5, 0.5);
    torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
    cola.rotation.z = Math.sin(t * 1.3) * 0.05;
    if (!g.userData.sinCabeceo) cabeza.rotation.x = nivel > 0.05 ? Math.sin(t * 7) * 0.04 : THREE.MathUtils.lerp(cabeza.rotation.x, 0, 0.1);
    const p = POSES[expresion];
    const parpadeo = (t % 3.7) < 0.12 ? 0.1 : 1;
    ojos.scale.y = THREE.MathUtils.lerp(ojos.scale.y, parpadeo * p.ojo, 0.6);
    ojos.position.y = (1 - ojos.scale.y) * 0.21;
    for (const c of cejas) {
      c.rotation.z = THREE.MathUtils.lerp(c.rotation.z, c.userData.lado * p.ceja, 0.2);
      c.position.y = THREE.MathUtils.lerp(c.position.y, p.alto, 0.2);
    }
  };
  return g;
}

// ── Productos de la carta ──────────────────────────────────────────────────

/** Porción de pizza con queso y pepperoni (punta hacia +Z). */
function pizza() {
  return estatico((g) => {
    const forma = new THREE.Shape();
    forma.moveTo(-0.11, 0);
    forma.lineTo(0.11, 0);
    forma.lineTo(0, 0.24);
    forma.closePath();
    const masa = new THREE.ExtrudeGeometry(forma, { depth: 0.018, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.005, bevelSegments: 2 });
    g.add(malla(masa, mat('#f2c45a'), [0, 0.012, -0.08], [Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.024, 0.024, 0.24, 14), mat('#c98a3b'), [0, 0.022, -0.085], [0, 0, Math.PI / 2]));
    for (const [x, z] of [[-0.04, -0.03], [0.04, -0.02], [0, 0.04], [-0.015, 0.1]]) {
      g.add(malla(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), mat('#c8322e'), [x, 0.036, z]));
    }
    for (const [x, z] of [[0.03, 0.06], [-0.05, 0.01]]) g.add(malla(esfera(0.007, 8), mat('#3f8f3a'), [x, 0.038, z]));
  });
}

/** Galleta con chispas de chocolate. */
function galleta() {
  return estatico((g) => {
    g.add(malla(new THREE.CylinderGeometry(0.09, 0.085, 0.022, 28), mat('#d9a35c'), [0, 0.011, 0]));
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = 0.02 + (i % 3) * 0.022;
      g.add(malla(esfera(0.011, 8), mat('#4a2a17'), [Math.cos(a) * r, 0.023, Math.sin(a) * r]));
    }
  });
}

/** Muffin de arándanos en su capacillo a rayas. */
function muffin() {
  return estatico((g) => {
    g.add(malla(new THREE.CylinderGeometry(0.075, 0.058, 0.08, 20), mat('#ef7aa0'), [0, 0.04, 0]));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(malla(new THREE.BoxGeometry(0.008, 0.08, 0.004), mat('#ffffff'), [Math.cos(a) * 0.067, 0.04, Math.sin(a) * 0.067], [0, -a, -0.11]));
    }
    g.add(malla(esfera(0.09, 22), mat('#b9733a'), [0, 0.085, 0], [0, 0, 0], [1, 0.62, 1]));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.1;
      g.add(malla(esfera(0.012, 8), mat('#3a3c8f'), [Math.cos(a) * 0.05, 0.125 - (i % 2) * 0.012, Math.sin(a) * 0.05]));
    }
  });
}

/**
 * Vaso con bebida. opciones: { tipo: 'agua' | 'jugo' | 'leche' }.
 * El agua lleva hielo; el jugo, una rodaja de naranja y un sorbete.
 */
function bebida({ tipo = 'agua' } = {}) {
  return estatico((g) => {
    const liquido = { agua: ['#8fd3ff', 0.55], jugo: ['#ff9a1f', 0.95], leche: ['#fbfbf6', 1] }[tipo] ?? ['#8fd3ff', 0.55];
    g.add(malla(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 24, 1, true), mat('#e8f6ff', { opacidad: 0.35, lados: THREE.DoubleSide }), [0, 0.08, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 24), mat('#dff2ff', { opacidad: 0.5 }), [0, 0.004, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.05, 0.044, 0.12, 24), mat(liquido[0], { opacidad: liquido[1] }), [0, 0.068, 0]));
    if (tipo === 'agua') {
      for (const [x, z, r] of [[0.015, 0.01, 0.3], [-0.016, -0.006, 0.9]]) g.add(malla(new THREE.BoxGeometry(0.03, 0.028, 0.03), mat('#ffffff', { opacidad: 0.7 }), [x, 0.12, z], [r, r, 0]));
    }
    if (tipo === 'jugo') {
      g.add(malla(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8), mat('#2dbe78'), [0.02, 0.15, 0], [0, 0, -0.25]));
      g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 20, 1, false, 0, Math.PI), mat('#ffb347'), [-0.04, 0.16, 0], [Math.PI / 2, 0, 0.3]));
    }
  });
}

export const cafe = { gallo, pizza, galleta, muffin, bebida };
