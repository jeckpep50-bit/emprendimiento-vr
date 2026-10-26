import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from '../materiales.js';
import { PanelLienzo, escribir } from '../../ui/lienzo.js';

// Modelos para la lección de la descripción (6.º): el noticiero, la llama que cambia
// con las palabras, el choque del mercado y el mirador del volcán.

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

// ── Llama andina ───────────────────────────────────────────────────────────

const COLORES_POMPON = ['#e5484d', '#ffc23c', '#2dbe78', '#ff5aa5', '#4f7cff'];

/**
 * Llama de tamaño real (≈1,6 m hasta la cabeza) que mira hacia +Z.
 * opciones: { color (lana), lana: 'lisa' | 'esponjosa', adorno: 'ninguno' | 'pompones' | 'poncho', gris (sin detalles) }
 * userData: { cuerpo, patas, cuello, cabeza } para animar posturas (echarse, saltar, mirar).
 */
export function llama({ color = '#f5f1e8', lana = 'lisa', adorno = 'ninguno', gris = false } = {}) {
  const lanaM = mat(gris ? '#aeb4bf' : color, { emisivo: !gris && lana === 'lisa' ? 0.08 : 0 });
  const claro = mat(gris ? '#c3c8d1' : new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.25).getStyle());
  const oscuro = mat('#2b2b33');
  const g = new THREE.Group();
  g.userData.noFusionar = true;

  // Cuerpo: liso (una cápsula) o esponjoso (muchas bolitas de lana)
  const cuerpo = new THREE.Group();
  if (lana === 'esponjosa' && !gris) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const z = -0.32 + (i % 8) * 0.09;
      cuerpo.add(malla(new THREE.SphereGeometry(0.15 + (i % 3) * 0.02, 12, 10), lanaM, [Math.cos(a) * 0.1, 0.78 + Math.sin(a) * 0.09, z]));
    }
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.19, 0.5, 6, 14), lanaM, [0, 0.78, 0], [Math.PI / 2, 0, 0]));
  } else {
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.2, 0.55, 6, 16), lanaM, [0, 0.78, 0], [Math.PI / 2, 0, 0]));
  }
  cuerpo.add(malla(new THREE.SphereGeometry(0.08, 10, 8), lanaM, [0, 0.86, -0.5]));
  if (adorno === 'poncho' && !gris) {
    const rojo = mat('#d62839');
    cuerpo.add(malla(new RoundedBoxGeometry(0.5, 0.04, 0.5, 2, 0.015), rojo, [0, 1.0, 0]));
    for (const lado of [-1, 1]) cuerpo.add(malla(new RoundedBoxGeometry(0.04, 0.26, 0.5, 2, 0.015), rojo, [lado * 0.24, 0.88, 0], [0, 0, lado * 0.15]));
    ['#ffc23c', '#2dbe78', '#4f7cff'].forEach((c, i) => {
      cuerpo.add(malla(new THREE.BoxGeometry(0.51, 0.045, 0.04), mat(c), [0, 1.002, -0.16 + i * 0.16]));
      for (const lado of [-1, 1]) cuerpo.add(malla(new THREE.BoxGeometry(0.045, 0.26, 0.04), mat(c), [lado * 0.245, 0.88, -0.16 + i * 0.16], [0, 0, lado * 0.15]));
    });
  }
  g.add(parte(cuerpo));

  // Patas (se acortan cuando la llama se echa)
  const patas = new THREE.Group();
  for (const [x, z] of [[-0.11, 0.3], [0.11, 0.3], [-0.11, -0.3], [0.11, -0.3]]) {
    patas.add(malla(new THREE.CapsuleGeometry(0.045, 0.5, 4, 10), lanaM, [x, 0.33, z]));
    patas.add(malla(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 10), oscuro, [x, 0.03, z + 0.01]));
  }
  g.add(parte(patas));

  // Cuello y cabeza (el cuello gira para mirar alrededor)
  const cuello = new THREE.Group();
  cuello.position.set(0, 0.86, 0.38);
  const cuelloM = new THREE.Group();
  cuelloM.add(malla(new THREE.CapsuleGeometry(0.085, 0.42, 6, 12), lanaM, [0, 0.27, 0.04], [-0.12, 0, 0]));
  if (lana === 'esponjosa' && !gris) for (let i = 0; i < 4; i++) cuelloM.add(malla(new THREE.SphereGeometry(0.1, 10, 8), lanaM, [0, 0.1 + i * 0.11, 0.02]));
  cuello.add(parte(cuelloM));
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.58, 0.08);
  const cabezaM = new THREE.Group();
  cabezaM.add(malla(new THREE.SphereGeometry(0.1, 16, 12), lanaM, [0, 0, 0.02], [0, 0, 0], [0.95, 1, 1.25]));
  cabezaM.add(malla(new THREE.SphereGeometry(0.065, 14, 10), claro, [0, -0.03, 0.12], [0, 0, 0], [1, 0.85, 1]));
  cabezaM.add(malla(new THREE.SphereGeometry(0.012, 8, 6), oscuro, [-0.022, -0.01, 0.18]));
  cabezaM.add(malla(new THREE.SphereGeometry(0.012, 8, 6), oscuro, [0.022, -0.01, 0.18]));
  for (const lado of [-1, 1]) {
    cabezaM.add(malla(new THREE.CapsuleGeometry(0.022, 0.11, 4, 8), lanaM, [lado * 0.05, 0.13, -0.02], [0, 0, lado * -0.25]));
    if (!gris) {
      cabezaM.add(malla(new THREE.SphereGeometry(0.03, 12, 10), mat('#ffffff', { tipo: 'basica' }), [lado * 0.065, 0.035, 0.08]));
      cabezaM.add(malla(new THREE.SphereGeometry(0.018, 10, 8), mat('#1d1d27', { tipo: 'basica' }), [lado * 0.068, 0.035, 0.1]));
    }
    if (adorno === 'pompones' && !gris) {
      for (let k = 0; k < 3; k++) {
        cabezaM.add(malla(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4), mat('#3a2a20'), [lado * (0.065 + k * 0.012), 0.17, -0.02 + k * 0.012]));
        cabezaM.add(malla(new THREE.SphereGeometry(0.024, 10, 8), mat(COLORES_POMPON[(k + (lado > 0 ? 2 : 0)) % COLORES_POMPON.length]), [lado * (0.065 + k * 0.012), 0.14, -0.02 + k * 0.012]));
      }
    }
  }
  cabeza.add(parte(cabezaM));
  cuello.add(cabeza);
  g.add(cuello);

  Object.assign(g.userData, { cuerpo, patas, cuello, cabeza, anclaje: 'pies' });
  return g;
}

// ── El choque del mercado ──────────────────────────────────────────────────

/** Carrito de frutas de madera con dos ruedas, lleno de naranjas. La cama mira hacia +Z. */
export function carrito_frutas() {
  return estatico((g) => {
    const madera = mat('#a8774f');
    g.add(malla(new RoundedBoxGeometry(1.0, 0.08, 0.6, 2, 0.02), madera, [0, 0.62, 0]));
    for (const z of [-0.3, 0.3]) g.add(malla(new THREE.BoxGeometry(1.0, 0.18, 0.04), mat('#8d5a3b'), [0, 0.74, z]));
    for (const x of [-0.5, 0.5]) g.add(malla(new THREE.BoxGeometry(0.04, 0.18, 0.6), mat('#8d5a3b'), [x, 0.74, 0]));
    for (const z of [-0.33, 0.33]) {
      g.add(malla(new THREE.TorusGeometry(0.26, 0.035, 8, 24), mat('#3a2a20'), [0.15, 0.26, z]));
      g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), mat('#7b8798'), [0.15, 0.26, z], [Math.PI / 2, 0, 0]));
    }
    g.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), mat('#7b8798'), [0.15, 0.26, 0], [Math.PI / 2, 0, 0]));
    for (const z of [-0.22, 0.22]) {
      g.add(malla(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), madera, [-0.7, 0.68, z], [0, 0, Math.PI / 2]));
      g.add(malla(new THREE.CylinderGeometry(0.025, 0.025, 0.58, 8), madera, [-0.4, 0.3, z]));
    }
    const naranja = new THREE.SphereGeometry(0.055, 12, 10);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) g.add(malla(naranja, mat(j === 1 && i % 2 ? '#ffc23c' : '#ff9f1c'), [-0.36 + i * 0.18, 0.72, -0.18 + j * 0.18]));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.add(malla(naranja, mat('#ff9f1c'), [-0.27 + i * 0.18, 0.81, -0.09 + j * 0.18]));
  });
}

/** Bicicleta de reparto con canasta adelante (mira hacia +X). opciones: { color } */
export function bicicleta({ color = '#2f8be6' } = {}) {
  return estatico((g) => {
    const cuadro = mat(color);
    const negro = mat('#2b2b33');
    for (const x of [-0.5, 0.5]) {
      g.add(malla(new THREE.TorusGeometry(0.3, 0.025, 8, 28), negro, [x, 0.33, 0]));
      g.add(malla(new THREE.TorusGeometry(0.26, 0.008, 6, 24), mat('#c9d2de'), [x, 0.33, 0]));
      for (let k = 0; k < 4; k++) g.add(malla(new THREE.CylinderGeometry(0.004, 0.004, 0.52, 4), mat('#c9d2de'), [x, 0.33, 0], [0, 0, (k * Math.PI) / 4]));
    }
    const barra = (a, b, r = 0.022) => {
      const va = new THREE.Vector3(...a);
      const vb = new THREE.Vector3(...b);
      const m = malla(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), cuadro);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      g.add(m);
    };
    barra([-0.5, 0.33, 0], [-0.1, 0.33, 0]);
    barra([-0.1, 0.33, 0], [-0.22, 0.75, 0]);
    barra([-0.22, 0.72, 0], [0.38, 0.72, 0]);
    barra([-0.1, 0.33, 0], [0.38, 0.72, 0]);
    barra([0.5, 0.33, 0], [0.38, 0.85, 0]);
    barra([-0.5, 0.33, 0], [-0.22, 0.72, 0]);
    g.add(malla(new RoundedBoxGeometry(0.22, 0.05, 0.12, 2, 0.02), negro, [-0.24, 0.8, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8), negro, [0.38, 0.88, 0], [Math.PI / 2, 0, 0]));
    // Canasta de reparto
    g.add(malla(new THREE.BoxGeometry(0.3, 0.02, 0.32), mat('#b5835a'), [0.6, 0.72, 0]));
    for (const z of [-0.16, 0.16]) g.add(malla(new THREE.BoxGeometry(0.3, 0.16, 0.015), mat('#b5835a'), [0.6, 0.8, z]));
    for (const x of [0.45, 0.75]) g.add(malla(new THREE.BoxGeometry(0.015, 0.16, 0.32), mat('#b5835a'), [x, 0.8, 0]));
  });
}

/** Perro mestizo. opciones: { color, salto } (salto: patas estiradas, como en pleno brinco). Mira hacia +Z. */
export function perro({ color = '#c8914c', salto = false } = {}) {
  return estatico((g) => {
    const pelo = mat(color);
    const oscuro = mat('#3a2a20');
    g.add(malla(new THREE.CapsuleGeometry(0.11, 0.32, 6, 12), pelo, [0, 0.36, 0], [Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.SphereGeometry(0.11, 14, 12), pelo, [0, 0.52, 0.27]));
    g.add(malla(new THREE.SphereGeometry(0.06, 12, 10), mat('#e8d5b5'), [0, 0.49, 0.37], [0, 0, 0], [1, 0.8, 1.2]));
    g.add(malla(new THREE.SphereGeometry(0.022, 8, 6), oscuro, [0, 0.51, 0.44]));
    for (const lado of [-1, 1]) {
      g.add(malla(new THREE.SphereGeometry(0.045, 10, 8), oscuro, [lado * 0.09, 0.6, 0.24], [0, 0, lado * 0.6], [0.6, 1.4, 0.4]));
      g.add(malla(new THREE.SphereGeometry(0.022, 8, 6), mat('#1d1d27', { tipo: 'basica' }), [lado * 0.045, 0.55, 0.36]));
      for (const z of [0.16, -0.16]) {
        const ang = salto ? (z > 0 ? -0.9 : 0.9) : 0;
        g.add(malla(new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), pelo, [lado * 0.07, 0.2 + (salto ? 0.05 : 0), z + Math.sin(ang) * 0.12], [ang, 0, 0]));
      }
    }
    g.add(malla(new THREE.CapsuleGeometry(0.02, 0.18, 4, 8), pelo, [0, 0.46, -0.27], [-0.7, 0, 0]));
  });
}

/** Sombrero de paja toquilla (centro en la copa). */
export function sombrero() {
  return estatico((g) => {
    g.add(malla(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 28), mat('#e8cf8f'), [0, 0.006, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.095, 0.11, 0.1, 22), mat('#e8cf8f'), [0, 0.06, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.112, 0.112, 0.025, 22), mat('#3a2a20'), [0, 0.025, 0]));
  });
}

/** Globo de helio con su piola. opciones: { color } El origen está en la punta de la piola. */
export function globo({ color = '#e5484d' } = {}) {
  return estatico((g) => {
    g.add(malla(new THREE.CylinderGeometry(0.003, 0.003, 0.7, 4), mat('#ffffff'), [0, 0.35, 0]));
    g.add(malla(new THREE.SphereGeometry(0.15, 20, 16), mat(color, { emisivo: 0.1 }), [0, 0.86, 0], [0, 0, 0], [1, 1.18, 1]));
    g.add(malla(new THREE.ConeGeometry(0.025, 0.04, 10), mat(color), [0, 0.7, 0], [Math.PI, 0, 0]));
  });
}

// ── Televisión ─────────────────────────────────────────────────────────────

/** Logo del noticiero dibujado en un panel. */
function logoNoticiero(ancho, alto) {
  const p = new PanelLienzo(ancho, alto, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#d62839');
    gr.addColorStop(1, '#8b1e3f');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, h * 0.25);
    ctx.fill();
    escribir(ctx, '● QUITO EN VIVO', w / 2, h / 2, { tam: h * 0.5, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w * 0.92 });
  });
  p.userData.noFusionar = true;
  return p;
}

/** Cámara de televisión sobre trípode, con luz roja de "al aire". */
export function camara_tv() {
  const g = estatico((c) => {
    const negro = mat('#2b2b33');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      c.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6), negro, [Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22], [Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18]));
    }
    c.add(malla(new RoundedBoxGeometry(0.22, 0.24, 0.42, 2, 0.03), mat('#3a4250'), [0, 1.35, 0]));
    c.add(malla(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 18), negro, [0, 1.35, 0.3], [Math.PI / 2, 0, 0]));
    c.add(malla(new THREE.CircleGeometry(0.07, 18), mat('#4f9cff', { emisivo: 0.3 }), [0, 1.35, 0.415]));
    c.add(malla(new THREE.BoxGeometry(0.05, 0.05, 0.3), negro, [0.16, 1.3, -0.25], [0, 0, 0]));
  });
  const luz = malla(new THREE.SphereGeometry(0.022, 10, 8), mat('#ff2d2d', { tipo: 'basica' }), [0.08, 1.5, 0.15]);
  g.add(luz);
  g.userData.luz = luz;
  return g;
}

/** Furgoneta del noticiero con antena satelital. Mira hacia +X. */
export function furgoneta_tv() {
  const g = estatico((v) => {
    v.add(malla(new RoundedBoxGeometry(2.6, 1.4, 1.5, 3, 0.12), mat('#ffffff'), [0, 1.0, 0]));
    v.add(malla(new RoundedBoxGeometry(0.8, 0.9, 1.5, 3, 0.12), mat('#ffffff'), [1.55, 0.75, 0]));
    v.add(malla(new THREE.BoxGeometry(0.5, 0.45, 1.42), mat('#5e86a8', { tipo: 'basica' }), [1.75, 1.0, 0]));
    v.add(malla(new THREE.BoxGeometry(2.62, 0.18, 1.52), mat('#d62839'), [0, 0.55, 0]));
    for (const [x, z] of [[-0.9, 0.76], [-0.9, -0.76], [1.4, 0.76], [1.4, -0.76]]) v.add(malla(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 18), mat('#2b2b33'), [x, 0.28, z], [Math.PI / 2, 0, 0]));
    v.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), mat('#9aa7b8'), [-0.6, 1.95, 0]));
    v.add(malla(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), mat('#e6ebf8', { lados: THREE.DoubleSide }), [-0.6, 2.1, 0], [-0.9, 0, 0.3]));
  });
  for (const z of [0.76, -0.76]) {
    const logo = logoNoticiero(1.6, 0.3);
    logo.position.set(-0.2, 1.2, z * 1.002);
    if (z < 0) logo.rotation.y = Math.PI;
    g.add(logo);
  }
  return g;
}

export const noticias = {
  llama,
  carrito_frutas,
  bicicleta,
  perro,
  sombrero,
  globo,
  camara_tv,
  furgoneta_tv,
};

export { logoNoticiero };
