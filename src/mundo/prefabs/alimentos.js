import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from '../materiales.js';
import { mosca } from './objetos.js';

// Todos los alimentos tienen la base en y = 0 y miden entre 8 y 25 cm (escala real);
// la escena los agranda según el campo `tamano` de la lección.

function estatico(construir) {
  const g = new THREE.Group();
  construir(g);
  fusionar(g);
  g.userData.anclaje = 'base';
  return g;
}

function manchas(g, cantidad, radio, centro, colores, escalaY = 0.35, semilla = 1) {
  let s = semilla;
  const azar = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const geo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < cantidad; i++) {
    const a = azar() * Math.PI * 2;
    const b = azar() * Math.PI * 0.45;
    const n = new THREE.Vector3(Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b));
    const m = malla(geo, mat(colores[i % colores.length]));
    m.position.copy(centro).addScaledVector(n, radio);
    m.scale.set(0.018 + azar() * 0.02, (0.018 + azar() * 0.02) * escalaY, 0.018 + azar() * 0.02);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.add(m);
  }
}

function manzanaBase(g, color) {
  g.add(malla(new THREE.SphereGeometry(0.075, 28, 20), mat(color), [0, 0.068, 0], [0, 0, 0], [1, 0.92, 1]));
  g.add(malla(new THREE.CylinderGeometry(0.005, 0.006, 0.035, 6), mat('#6b4423'), [0, 0.145, 0], [0, 0, 0.15]));
  g.add(malla(new THREE.SphereGeometry(0.022, 10, 8), mat('#4caf50'), [0.02, 0.15, 0], [0, 0, -0.6], [1, 0.3, 0.55]));
}

function vaso(g, colorLiquido, opacidadLiquido = 0.9) {
  g.add(malla(new THREE.CylinderGeometry(0.042, 0.035, 0.12, 24, 1, true), mat('#dff4ff', { opacidad: 0.35, lados: THREE.DoubleSide }), [0, 0.06, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 24), mat('#dff4ff', { opacidad: 0.4 }), [0, 0.002, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.039, 0.034, 0.09, 24), mat(colorLiquido, { opacidad: opacidadLiquido }), [0, 0.048, 0]));
}

export const alimentos = {
  manzana: () => estatico((g) => manzanaBase(g, '#e53935')),

  manzana_podrida: () =>
    estatico((g) => {
      manzanaBase(g, '#9c5b3b');
      manchas(g, 9, 0.066, new THREE.Vector3(0, 0.068, 0), ['#4a2c1d', '#5d7a3a', '#e8efd9'], 0.4, 3);
    }),

  banano: () =>
    estatico((g) => {
      const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.1, 0.07, 0), new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.1, 0.07, 0));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 20, 0.026, 10), mat('#ffd54f')));
      g.add(malla(new THREE.SphereGeometry(0.026, 10, 8), mat('#ffd54f'), [0.1, 0.07, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.008, 0.012, 0.03, 6), mat('#6d4c41'), [-0.11, 0.085, 0], [0, 0, 0.8]));
      g.add(malla(new THREE.SphereGeometry(0.012, 8, 6), mat('#4e342e'), [0.12, 0.075, 0]));
      g.position.y = 0;
    }),

  naranja: () =>
    estatico((g) => {
      g.add(malla(new THREE.SphereGeometry(0.07, 26, 18), mat('#ff9f1c'), [0, 0.07, 0]));
      g.add(malla(new THREE.SphereGeometry(0.018, 10, 8), mat('#4caf50'), [0.012, 0.138, 0], [0, 0, -0.5], [1, 0.35, 0.6]));
    }),

  zanahoria: () =>
    estatico((g) => {
      g.add(malla(new THREE.ConeGeometry(0.03, 0.2, 16), mat('#ff8a1f'), [0, 0.03, 0], [0, 0, Math.PI / 2 + 0.1]));
      const hoja = new THREE.ConeGeometry(0.008, 0.07, 6);
      [-0.4, 0, 0.4].forEach((a) => g.add(malla(hoja, mat('#43a047'), [-0.12, 0.05 + a * 0.02, a * 0.02], [a, 0, Math.PI / 2 + 0.4])));
    }),

  pan: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.24, 0.1, 0.13, 4, 0.045), mat('#d99a4e'), [0, 0.05, 0]));
      g.add(malla(new RoundedBoxGeometry(0.22, 0.04, 0.11, 3, 0.02), mat('#b8742f'), [0, 0.092, 0]));
      const corte = new THREE.BoxGeometry(0.012, 0.012, 0.09);
      [-0.06, 0, 0.06].forEach((x) => g.add(malla(corte, mat('#f2d19b'), [x, 0.112, 0], [0, 0.5, 0])));
    }),

  pan_con_moho: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.24, 0.1, 0.13, 4, 0.045), mat('#c8914c'), [0, 0.05, 0]));
      g.add(malla(new RoundedBoxGeometry(0.22, 0.04, 0.11, 3, 0.02), mat('#a86d33'), [0, 0.092, 0]));
      const geo = new THREE.SphereGeometry(1, 10, 8);
      const manchasMoho = [[-0.07, 0.03, '#4f8a4b'], [0.02, -0.02, '#2f6f73'], [0.08, 0.025, '#6fae5c'], [-0.02, 0.035, '#e8efd9'], [0.05, -0.035, '#e8efd9'], [-0.09, -0.03, '#2f6f73']];
      manchasMoho.forEach(([x, z, c], i) => g.add(malla(geo, mat(c), [x, 0.112, z], [0, 0, 0], [0.028 + (i % 3) * 0.006, 0.01, 0.024])));
    }),

  leche: () =>
    estatico((g) => {
      g.add(malla(new THREE.BoxGeometry(0.08, 0.17, 0.08), mat('#ffffff'), [0, 0.085, 0]));
      g.add(malla(new THREE.BoxGeometry(0.082, 0.06, 0.082), mat('#4f7cff'), [0, 0.07, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.001, 0.058, 0.05, 4), mat('#f3f6ff'), [0, 0.195, 0], [0, Math.PI / 4, 0]));
      g.add(malla(new THREE.SphereGeometry(0.018, 12, 10), mat('#ffffff'), [0, 0.075, 0.042], [0, 0, 0], [1, 1, 0.2]));
    }),

  queso: () =>
    estatico((g) => {
      const forma = new THREE.Shape();
      forma.moveTo(0, 0);
      forma.lineTo(0.15, 0.05);
      forma.lineTo(0.15, -0.05);
      forma.closePath();
      const cuna = new THREE.ExtrudeGeometry(forma, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
      g.add(malla(cuna, mat('#ffcf40'), [-0.075, 0.006, 0], [-Math.PI / 2, 0, 0]));
      const hueco = new THREE.SphereGeometry(0.012, 10, 8);
      [[0.02, 0.077, 0.01], [0.05, 0.077, -0.02], [-0.02, 0.077, 0]].forEach((p) => g.add(malla(hueco, mat('#e0a800'), p, [0, 0, 0], [1, 0.25, 1])));
    }),

  yogur: () =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 24), mat('#ffffff'), [0, 0.045, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.0455, 0.041, 0.03, 24), mat('#ff8fd1'), [0, 0.055, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.048, 0.048, 0.006, 24), mat('#cfd8e3'), [0, 0.092, 0]));
    }),

  huevo: () =>
    estatico((g) => {
      g.add(malla(new THREE.SphereGeometry(0.035, 22, 16), mat('#f7ead6'), [0, 0.045, 0], [0, 0, 0], [1, 1.3, 1]));
    }),

  carne_cruda: () =>
    estatico((g) => {
      g.add(malla(new THREE.SphereGeometry(0.1, 24, 14), mat('#d6455d'), [0, 0.025, 0], [0, 0, 0], [1.1, 0.25, 0.75]));
      const vena = new THREE.SphereGeometry(1, 10, 8);
      [[-0.04, 0.02], [0.03, -0.025], [0.05, 0.03]].forEach(([x, z]) => g.add(malla(vena, mat('#f8d7dc'), [x, 0.049, z], [0, x * 10, 0], [0.03, 0.004, 0.008])));
    }),

  pollo_crudo: () =>
    estatico((g) => {
      g.add(malla(new THREE.SphereGeometry(0.06, 22, 16), mat('#f4c7b8'), [-0.03, 0.05, 0], [0, 0, 0], [1.3, 0.9, 0.9]));
      g.add(malla(new THREE.CylinderGeometry(0.012, 0.014, 0.08, 10), mat('#fff4e6'), [0.075, 0.05, 0], [0, 0, Math.PI / 2]));
      g.add(malla(new THREE.SphereGeometry(0.018, 10, 8), mat('#fff4e6'), [0.118, 0.05, 0]));
    }),

  pescado: () =>
    estatico((g) => {
      g.add(malla(new THREE.SphereGeometry(0.06, 22, 16), mat('#8fb3c9'), [0, 0.045, 0], [0, 0, 0], [2, 0.8, 0.45]));
      g.add(malla(new THREE.ConeGeometry(0.045, 0.07, 3), mat('#6e93aa'), [-0.14, 0.045, 0], [0, 0, Math.PI / 2], [1, 1, 0.3]));
      g.add(malla(new THREE.SphereGeometry(0.01, 8, 6), mat('#1d1d27', { tipo: 'basica' }), [0.085, 0.055, 0.025]));
    }),

  sandwich: () =>
    estatico((g) => {
      const rebanada = new RoundedBoxGeometry(0.15, 0.025, 0.15, 3, 0.01);
      g.add(malla(rebanada, mat('#e8c07d'), [0, 0.0125, 0]));
      g.add(malla(new THREE.BoxGeometry(0.155, 0.008, 0.155), mat('#7cc36b'), [0, 0.029, 0], [0, 0.2, 0]));
      g.add(malla(new THREE.BoxGeometry(0.14, 0.012, 0.14), mat('#f29ba6'), [0, 0.039, 0]));
      g.add(malla(new THREE.BoxGeometry(0.13, 0.008, 0.13), mat('#ffd54f'), [0, 0.049, 0], [0, 0.4, 0]));
      g.add(malla(rebanada, mat('#e8c07d'), [0, 0.066, 0]));
    }),

  plato_comida: ({ moscas = false } = {}) => {
    const g = estatico((p) => {
      p.add(malla(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 32), mat('#ffffff'), [0, 0.01, 0]));
      p.add(malla(new THREE.SphereGeometry(0.06, 18, 12), mat('#fbf7ee'), [-0.03, 0.025, 0.01], [0, 0, 0], [1, 0.45, 1]));
      p.add(malla(new RoundedBoxGeometry(0.07, 0.025, 0.05, 2, 0.01), mat('#9c5b3b'), [0.05, 0.035, -0.02], [0, 0.4, 0]));
      const hoja = new THREE.SphereGeometry(0.02, 10, 8);
      [[0.05, 0.04], [0.07, 0.03], [0.03, 0.06]].forEach(([x, z]) => p.add(malla(hoja, mat('#66bb6a'), [x, 0.03, z], [0, 0, 0], [1, 0.5, 1])));
    });
    if (moscas) {
      for (let i = 0; i < 2; i++) {
        const m = mosca();
        m.scale.setScalar(0.8);
        g.add(m);
        const fase = i * Math.PI;
        const animarAlas = m.userData.animar;
        m.userData.animar = null;
        g.userData.animar = ((anterior) => (t) => {
          anterior?.(t);
          m.position.set(Math.cos(t * 1.8 + fase) * 0.09, 0.12 + Math.sin(t * 3 + fase) * 0.02, Math.sin(t * 1.8 + fase) * 0.09);
          m.rotation.y = -(t * 1.8 + fase);
          animarAlas(t);
        })(g.userData.animar);
      }
    }
    return g;
  },

  vaso_agua: () => estatico((g) => vaso(g, '#8fd3ff', 0.55)),

  agua_sucia: () =>
    estatico((g) => {
      vaso(g, '#9a8b5a', 0.85);
      manchas(g, 5, 0.02, new THREE.Vector3(0, 0.05, 0), ['#5c4d2a', '#c792ea'], 1, 7);
    }),

  jugo: ({ color = '#ff9f1c' } = {}) => estatico((g) => vaso(g, color, 0.95)),
};
