import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar, ponerCara, liberar } from '../materiales.js';

// Modelos del mercado, la planta procesadora y el viaje por el cuerpo humano.

function estatico(construir, anclaje = 'base') {
  const g = new THREE.Group();
  construir(g);
  fusionar(g);
  g.userData.anclaje = anclaje;
  return g;
}

/** Puntitos al azar (siempre los mismos gracias a la semilla) sobre un disco. */
function salpicar(g, cantidad, radio, y, colores, tam = 0.006, semilla = 3) {
  let s = semilla;
  const azar = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const geo = new THREE.SphereGeometry(1, 6, 4);
  for (let i = 0; i < cantidad; i++) {
    const a = azar() * Math.PI * 2;
    const r = Math.sqrt(azar()) * radio;
    g.add(malla(geo, mat(colores[i % colores.length]), [Math.cos(a) * r, y, Math.sin(a) * r], [0, 0, 0], [tam, tam * 0.5, tam]));
  }
}

export const mercado = {
  /** Hamburguesa. Con `cruda: true` la carne está rosada (mal cocinada). */
  hamburguesa: ({ cruda = false } = {}) =>
    estatico((g) => {
      const pan = mat('#e3a857');
      g.add(malla(new THREE.CylinderGeometry(0.075, 0.068, 0.03, 26), pan, [0, 0.015, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.083, 0.083, 0.03, 26), mat(cruda ? '#ec8c98' : '#6b3a22'), [0, 0.045, 0]));
      if (cruda) {
        // Franja oscura solo por fuera: por dentro sigue rosada.
        g.add(malla(new THREE.CylinderGeometry(0.0835, 0.0835, 0.008, 26, 1, true), mat('#9c5b4b'), [0, 0.058, 0]));
      }
      g.add(malla(new THREE.CylinderGeometry(0.088, 0.088, 0.006, 26), mat('#7cc36b'), [0, 0.063, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.062, 0.062, 0.008, 22), mat('#e5484d'), [0, 0.07, 0]));
      g.add(malla(new THREE.BoxGeometry(0.12, 0.004, 0.12), mat('#ffc93c'), [0, 0.076, 0], [0, 0.6, 0]));
      g.add(malla(new THREE.SphereGeometry(0.078, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), pan, [0, 0.078, 0], [0, 0, 0], [1, 0.62, 1]));
      const semilla = new THREE.SphereGeometry(0.0045, 6, 4);
      for (let i = 0; i < 12; i++) {
        const a = i * 2.4;
        const r = 0.02 + (i % 4) * 0.012;
        g.add(malla(semilla, mat('#fff4d6'), [Math.cos(a) * r, 0.078 + Math.sqrt(Math.max(0, 0.078 ** 2 - r * r)) * 0.62, Math.sin(a) * r], [0, a, 0], [1.4, 0.6, 1]));
      }
    }),

  /** Balde plástico con agua. `sucia: true` → agua turbia con partículas. */
  balde: ({ sucia = false } = {}) =>
    estatico((g) => {
      const plastico = mat('#3a7bd5', { lados: THREE.DoubleSide });
      g.add(malla(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 28, 1, true), plastico, [0, 0.11, 0]));
      g.add(malla(new THREE.CircleGeometry(0.1, 28), plastico, [0, 0.002, 0], [-Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.TorusGeometry(0.13, 0.008, 6, 32), mat('#2a5ea8'), [0, 0.22, 0], [Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.TorusGeometry(0.12, 0.004, 6, 24, Math.PI), mat('#8a98ad'), [0, 0.22, 0], [0, 0, 0]));
      g.add(malla(new THREE.CircleGeometry(0.122, 28), mat(sucia ? '#8b7d4f' : '#8fd3ff', { opacidad: sucia ? 0.95 : 0.7 }), [0, 0.18, 0], [-Math.PI / 2, 0, 0]));
      if (sucia) salpicar(g, 16, 0.1, 0.182, ['#4a3d22', '#6d8a3a', '#c792ea'], 0.008);
    }),

  /** Canasta con frutas sanas. */
  canasta_frutas: () =>
    estatico((g) => {
      const mimbre = mat('#b5835a', { lados: THREE.DoubleSide });
      g.add(malla(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 24, 1, true), mimbre, [0, 0.06, 0]));
      g.add(malla(new THREE.CircleGeometry(0.13, 24), mimbre, [0, 0.003, 0], [-Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.TorusGeometry(0.17, 0.012, 6, 32), mat('#8d5a3b'), [0, 0.12, 0], [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 3; i++) g.add(malla(new THREE.TorusGeometry(0.15 - i * 0.012, 0.004, 4, 32), mat('#8d5a3b'), [0, 0.03 + i * 0.03, 0], [Math.PI / 2, 0, 0]));
      const fruta = new THREE.SphereGeometry(0.045, 16, 12);
      const frutas = [[0, 0.13, 0, '#e53935'], [0.07, 0.12, 0.04, '#ff9f1c'], [-0.07, 0.12, 0.03, '#ffd54f'], [0.03, 0.12, -0.07, '#7cb342'], [-0.05, 0.12, -0.06, '#e53935'], [0.0, 0.17, 0.02, '#ff9f1c']];
      for (const [x, y, z, c] of frutas) g.add(malla(fruta, mat(c), [x, y, z]));
      g.add(malla(new THREE.TorusGeometry(0.15, 0.01, 6, 20, Math.PI), mat('#8d5a3b'), [0, 0.12, 0]));
    }),

  /** Hielera abierta con mariscos sobre hielo (conservación correcta). */
  hielera: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.36, 0.18, 0.24, 2, 0.02), mat('#f4f7fb'), [0, 0.09, 0]));
      g.add(malla(new THREE.BoxGeometry(0.362, 0.04, 0.242), mat('#2f8be6'), [0, 0.05, 0]));
      g.add(malla(new RoundedBoxGeometry(0.36, 0.03, 0.24, 2, 0.012), mat('#2f8be6'), [0, 0.25, -0.13], [-1.35, 0, 0]));
      // Hielo y mariscos
      g.add(malla(new THREE.BoxGeometry(0.32, 0.02, 0.2), mat('#dff4ff'), [0, 0.17, 0]));
      const hielo = new THREE.BoxGeometry(0.035, 0.03, 0.035);
      for (let i = 0; i < 14; i++) g.add(malla(hielo, mat('#e8f8ff', { opacidad: 0.85 }), [-0.14 + (i % 7) * 0.046, 0.19, -0.06 + Math.floor(i / 7) * 0.12], [0.3 * i, 0.5 * i, 0]));
      for (const [x, z] of [[-0.06, 0.02], [0.07, -0.01]]) {
        g.add(malla(new THREE.SphereGeometry(0.04, 16, 10), mat('#8fb3c9'), [x, 0.2, z], [0, 0.3, 0], [2, 0.6, 0.6]));
        g.add(malla(new THREE.ConeGeometry(0.03, 0.04, 3), mat('#6e93aa'), [x - 0.09, 0.2, z], [0, 0, Math.PI / 2], [1, 1, 0.3]));
      }
      const camaron = new THREE.TorusGeometry(0.018, 0.008, 6, 12, Math.PI * 1.3);
      for (let i = 0; i < 4; i++) g.add(malla(camaron, mat('#ff8a65'), [-0.12 + i * 0.08, 0.205, 0.07], [Math.PI / 2, 0, i]));
    }),

  /** Huevo con una trizadura y la clara saliendo. */
  huevo_roto: () =>
    estatico((g) => {
      g.add(malla(new THREE.SphereGeometry(0.035, 22, 16), mat('#efdcc0'), [0, 0.045, 0], [0, 0, 0], [1, 1.3, 1]));
      const raya = new THREE.BoxGeometry(0.016, 0.003, 0.004);
      [[-0.022, 0.05, 0.6], [-0.008, 0.046, -0.5], [0.006, 0.051, 0.6], [0.02, 0.047, -0.4]].forEach(([x, y, r]) => g.add(malla(raya, mat('#5d4037'), [x, y, 0.034], [0, 0, r])));
      g.add(malla(new THREE.SphereGeometry(0.03, 14, 10), mat('#fff8e6', { opacidad: 0.8 }), [0.012, 0.004, 0.035], [0, 0, 0], [1.4, 0.18, 1.2]));
      g.add(malla(new THREE.SphereGeometry(0.012, 10, 8), mat('#ffc93c'), [0.02, 0.008, 0.045], [0, 0, 0], [1, 0.5, 1]));
    }),

  /** Cuchillo de cocina. `sucio: true` → con restos de carne cruda. */
  cuchillo: ({ sucio = false } = {}) =>
    estatico((g) => {
      const hoja = new THREE.Shape();
      hoja.moveTo(0, 0);
      hoja.lineTo(0.17, 0);
      hoja.quadraticCurveTo(0.2, 0.012, 0.19, 0.035);
      hoja.lineTo(0, 0.035);
      hoja.closePath();
      g.add(malla(new THREE.ExtrudeGeometry(hoja, { depth: 0.003, bevelEnabled: false }), mat('#cfd8e3'), [0, 0.004, 0.017], [-Math.PI / 2, 0, 0]));
      g.add(malla(new RoundedBoxGeometry(0.1, 0.018, 0.026, 2, 0.007), mat('#4e342e'), [-0.05, 0.009, 0]));
      for (const x of [-0.08, -0.05, -0.02]) g.add(malla(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 6), mat('#cfd8e3'), [x, 0.012, 0]));
      if (sucio) {
        const mancha = new THREE.SphereGeometry(1, 8, 6);
        [[0.05, 0.006], [0.1, -0.004], [0.14, 0.004]].forEach(([x, z]) => g.add(malla(mancha, mat('#c0394b'), [x, 0.008, z], [0, 0, 0], [0.016, 0.003, 0.01])));
      }
    }),

  /**
   * Persona adulta de tamaño real (~1,65 m): vendedor del mercado o cocinero.
   * opciones: { piel, camisa, pantalon, delantal, cabello, gorro ('sombrero' | 'gorra' | 'ninguno'), expresion }
   */
  vendedor: ({ piel = '#c98b5e', camisa = '#4f7cff', pantalon = '#3a4256', delantal = '#ffffff', cabello = '#2b1d14', gorro = 'sombrero', expresion = 'feliz' } = {}) => {
    const g = new THREE.Group();
    const cuerpo = new THREE.Group();
    const pielM = mat(piel);
    const camisaM = mat(camisa);
    for (const lado of [-1, 1]) {
      cuerpo.add(malla(new RoundedBoxGeometry(0.12, 0.07, 0.22, 2, 0.03), mat('#2b2b33'), [lado * 0.1, 0.035, 0.03]));
      cuerpo.add(malla(new THREE.CapsuleGeometry(0.06, 0.62, 4, 10), mat(pantalon), [lado * 0.1, 0.42, 0]));
    }
    cuerpo.add(malla(new RoundedBoxGeometry(0.36, 0.16, 0.2, 2, 0.06), mat(pantalon), [0, 0.8, 0]));
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.18, 0.34, 6, 16), camisaM, [0, 1.1, 0], [0, 0, 0], [1, 1, 0.72]));
    // Delantal
    cuerpo.add(malla(new RoundedBoxGeometry(0.3, 0.62, 0.02, 2, 0.01), mat(delantal), [0, 0.92, 0.135]));
    cuerpo.add(malla(new THREE.BoxGeometry(0.2, 0.08, 0.005), mat(delantal === '#ffffff' ? '#e5484d' : '#ffffff'), [0, 0.85, 0.147]));
    for (const lado of [-1, 1]) {
      cuerpo.add(malla(new THREE.CapsuleGeometry(0.05, 0.42, 4, 10), camisaM, [lado * 0.24, 1.05, 0.03], [0.25, 0, lado * 0.1]));
      cuerpo.add(malla(new THREE.SphereGeometry(0.055, 12, 10), pielM, [lado * 0.26, 0.79, 0.12]));
    }
    cuerpo.add(malla(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 12), pielM, [0, 1.38, 0]));
    fusionar(cuerpo);
    g.add(cuerpo);

    const cabeza = new THREE.Group();
    cabeza.position.y = 1.53;
    const craneo = new THREE.Group();
    const r = 0.13;
    craneo.add(malla(new THREE.SphereGeometry(r, 26, 18), pielM, [0, 0, 0], [0, 0, 0], [1, 1.12, 1]));
    craneo.add(malla(new THREE.SphereGeometry(r * 1.05, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(cabello), [0, 0.01, -0.012], [-0.5, 0, 0]));
    for (const lado of [-1, 1]) craneo.add(malla(new THREE.SphereGeometry(0.026, 10, 8), pielM, [lado * r * 0.98, -0.01, 0], [0, 0, 0], [0.6, 1, 1]));
    if (gorro === 'sombrero') {
      craneo.add(malla(new THREE.CylinderGeometry(0.24, 0.24, 0.012, 28), mat('#e8cf8f'), [0, 0.085, 0]));
      craneo.add(malla(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 22), mat('#e8cf8f'), [0, 0.145, 0]));
      craneo.add(malla(new THREE.CylinderGeometry(0.132, 0.132, 0.025, 22), mat('#3a2a20'), [0, 0.105, 0]));
    } else if (gorro === 'gorra') {
      craneo.add(malla(new THREE.SphereGeometry(r * 1.08, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#ffffff'), [0, 0.025, 0]));
      craneo.add(malla(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 20, 1, false, -Math.PI / 2, Math.PI), mat('#ffffff'), [0, 0.06, 0.06], [0.15, 0, 0]));
    }
    fusionar(craneo);
    cabeza.add(craneo);
    const cara = new THREE.Group();
    cabeza.add(cara);
    g.add(cabeza);

    const setExpresion = (e) => {
      for (const hijo of [...cara.children]) {
        cara.remove(hijo);
        liberar(hijo);
      }
      ponerCara(cara, { r, caracter: e, z: r * 1.02, escalaBoca: 1.3 });
      fusionar(cara);
    };
    setExpresion(expresion);
    const fase = Math.random() * 6;
    g.userData.setExpresion = setExpresion;
    g.userData.animar = (t) => {
      cuerpo.scale.y = 1 + Math.sin(t * 1.8 + fase) * 0.006;
      cabeza.rotation.y = Math.sin(t * 0.35 + fase) * 0.35;
      cabeza.rotation.z = Math.sin(t * 0.6 + fase) * 0.05;
    };
    g.userData.anclaje = 'pies';
    return g;
  },

  /** Glóbulo blanco: célula de defensa translúcida con núcleo lobulado. */
  globulo_blanco: ({ caracter = 'bueno' } = {}) => {
    const g = new THREE.Group();
    const cuerpo = new THREE.Group();
    cuerpo.add(malla(new THREE.IcosahedronGeometry(0.16, 3), mat('#f4f7ff', { opacidad: 0.82 })));
    const lobulo = new THREE.SphereGeometry(0.045, 14, 10);
    [[-0.05, 0.02, -0.04], [0.02, 0.05, -0.05], [0.05, -0.02, -0.04], [-0.01, -0.04, -0.05]].forEach((p) => cuerpo.add(malla(lobulo, mat('#9b6dd6'), p)));
    const bulto = new THREE.SphereGeometry(0.03, 10, 8);
    for (let i = 0; i < 14; i++) {
      const n = new THREE.Vector3().setFromSphericalCoords(0.155, Math.acos(1 - (2 * (i + 0.5)) / 14), i * 2.4);
      if (n.z > 0.09) continue;
      cuerpo.add(malla(bulto, mat('#e6ebff'), n.toArray()));
    }
    ponerCara(cuerpo, { r: 0.15, caracter });
    fusionar(cuerpo);
    g.add(cuerpo);
    g.userData.animar = (t) => {
      cuerpo.scale.set(1 + Math.sin(t * 2.3) * 0.05, 1 + Math.sin(t * 2.3 + 1.6) * 0.05, 1);
      cuerpo.position.y = Math.sin(t * 1.4) * 0.012;
    };
    g.userData.anclaje = 'centro';
    return g;
  },

  /** Glóbulo rojo: disco bicóncavo. */
  globulo_rojo: () =>
    estatico((g) => {
      const perfil = [[0, 0.012], [0.03, 0.016], [0.06, 0.026], [0.075, 0.018], [0.08, 0], [0.075, -0.018], [0.06, -0.026], [0.03, -0.016], [0, -0.012]].map(([x, y]) => new THREE.Vector2(x, y));
      g.add(malla(new THREE.LatheGeometry(perfil, 28), mat('#d8323f'), [0, 0, 0], [Math.PI / 2, 0, 0]));
    }, 'centro'),
};
