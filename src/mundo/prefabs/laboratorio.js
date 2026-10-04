import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from '../materiales.js';

// Modelos de cocina avanzada y laboratorio de microbiología.

function estatico(construir, anclaje = 'base') {
  const g = new THREE.Group();
  construir(g);
  fusionar(g);
  g.userData.anclaje = anclaje;
  return g;
}

export const laboratorio = {
  tabla_picar: ({ color = '#e5484d' } = {}) =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.34, 0.02, 0.22, 2, 0.008), mat(color), [0, 0.01, 0]));
      g.add(malla(new THREE.TorusGeometry(0.018, 0.006, 6, 16), mat('#ffffff'), [0.14, 0.021, 0], [Math.PI / 2, 0, 0]));
      // Marcas de cortes
      for (let i = 0; i < 4; i++) g.add(malla(new THREE.BoxGeometry(0.12, 0.002, 0.003), mat('#ffffff', { opacidad: 0.35 }), [-0.04 + i * 0.02, 0.0205, -0.03 + i * 0.02], [0, 0.5, 0]));
    }),

  esponja: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.12, 0.035, 0.08, 2, 0.01), mat('#ffd54f'), [0, 0.0175, 0]));
      g.add(malla(new RoundedBoxGeometry(0.12, 0.012, 0.08, 2, 0.004), mat('#2e7d32'), [0, 0.041, 0]));
      const poro = new THREE.SphereGeometry(0.004, 6, 4);
      for (let i = 0; i < 10; i++) g.add(malla(poro, mat('#e0a800'), [-0.05 + (i % 5) * 0.025, 0.02, 0.041]));
    }),

  celular: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.075, 0.15, 0.009, 3, 0.008), mat('#2b2b33'), [0, 0.075, 0]));
      g.add(malla(new THREE.PlaneGeometry(0.066, 0.135), mat('#4f7cff', { tipo: 'basica' }), [0, 0.075, 0.0047]));
      for (let i = 0; i < 6; i++) g.add(malla(new RoundedBoxGeometry(0.014, 0.014, 0.002, 1, 0.003), mat(['#ff5aa5', '#ffc23c', '#2dbe78'][i % 3], { tipo: 'basica' }), [-0.02 + (i % 3) * 0.02, 0.11 - Math.floor(i / 3) * 0.022, 0.0052]));
    }),

  mazorca_cacao: ({ abierta = false } = {}) =>
    estatico((g) => {
      const cascara = new THREE.SphereGeometry(0.06, 20, 14);
      g.add(malla(cascara, mat('#d98a1e'), [0, 0.065, 0], [0, 0, 0], [1, 1.9, 1]));
      // Surcos
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(malla(new THREE.CapsuleGeometry(0.006, 0.17, 3, 6), mat('#a8640f'), [Math.cos(a) * 0.058, 0.065, Math.sin(a) * 0.058]));
      }
      g.add(malla(new THREE.CylinderGeometry(0.008, 0.01, 0.03, 8), mat('#6d4c41'), [0, 0.185, 0]));
      if (abierta) {
        const pepa = new THREE.SphereGeometry(0.014, 10, 8);
        for (let i = 0; i < 6; i++) g.add(malla(pepa, mat('#f3efe6'), [0.075, 0.03 + i * 0.012, 0.02], [0, 0, 0], [1, 1.4, 1]));
      }
    }),

  frasco_conserva: ({ color = '#c792ea' } = {}) =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 22), mat('#dff4ff', { opacidad: 0.4 }), [0, 0.065, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.046, 0.046, 0.1, 22), mat(color, { opacidad: 0.85 }), [0, 0.055, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.053, 0.053, 0.022, 22), mat('#c0543c'), [0, 0.14, 0]));
      const rodaja = new THREE.TorusGeometry(0.02, 0.005, 6, 14);
      for (let i = 0; i < 3; i++) g.add(malla(rodaja, mat('#ffffff', { opacidad: 0.8 }), [-0.015 + i * 0.015, 0.04 + i * 0.025, 0.03]));
    }),

  lata: ({ abombada = false } = {}) =>
    estatico((g) => {
      const metal = mat('#b8c4d6');
      if (abombada) {
        g.add(malla(new THREE.SphereGeometry(0.055, 22, 16), metal, [0, 0.065, 0], [0, 0, 0], [1, 1.25, 1]));
      } else {
        g.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 24), metal, [0, 0.06, 0]));
      }
      g.add(malla(new THREE.CylinderGeometry(0.0505, 0.0505, 0.06, 24, 1, true), mat('#e5484d', { lados: THREE.DoubleSide }), [0, 0.06, 0], [0, 0, 0], abombada ? [1.08, 1, 1.08] : 1));
      g.add(malla(new THREE.TorusGeometry(0.048, 0.004, 6, 24), mat('#9aa7b8'), [0, abombada ? 0.135 : 0.12, 0], [Math.PI / 2, 0, 0]));
    }),

  placa_petri: ({ colonias = true } = {}) =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 32), mat('#fff2a8', { opacidad: 0.9 }), [0, 0.006, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.095, 0.095, 0.02, 32, 1, true), mat('#dff4ff', { opacidad: 0.4, lados: THREE.DoubleSide }), [0, 0.01, 0]));
      if (colonias) {
        const c = new THREE.SphereGeometry(1, 10, 6);
        [[0.03, 0.02, 0.012, '#ff8fd1'], [-0.035, 0.01, 0.016, '#7fdc6b'], [0.0, -0.04, 0.01, '#ffc23c'], [-0.02, 0.045, 0.008, '#ff8fd1'], [0.05, -0.02, 0.007, '#7fdc6b']].forEach(([x, z, r, col]) => g.add(malla(c, mat(col), [x, 0.012, z], [0, 0, 0], [r, r * 0.35, r])));
      }
    }),

  torta: () =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 28), mat('#f6d7b0'), [0, 0.04, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.113, 0.113, 0.025, 28), mat('#ff8fd1'), [0, 0.085, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.15, 0.13, 0.012, 28), mat('#ffffff'), [0, 0.006, 0]));
      const fresa = new THREE.SphereGeometry(0.016, 10, 8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(malla(fresa, mat('#e5484d'), [Math.cos(a) * 0.075, 0.105, Math.sin(a) * 0.075], [0, 0, 0], [1, 1.2, 1]));
      }
      g.add(malla(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), mat('#4f7cff'), [0, 0.12, 0]));
      g.add(malla(new THREE.SphereGeometry(0.007, 8, 6), mat('#ffc23c', { tipo: 'basica' }), [0, 0.15, 0]));
    }),

  frasco_mayonesa: () =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.05, 0.045, 0.12, 22), mat('#fff3c4', { opacidad: 0.9 }), [0, 0.06, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.052, 0.052, 0.025, 22), mat('#2f8be6'), [0, 0.13, 0]));
      g.add(malla(new THREE.BoxGeometry(0.07, 0.045, 0.002), mat('#ffffff'), [0, 0.06, 0.049]));
      g.add(malla(new THREE.CircleGeometry(0.012, 14), mat('#ffc23c', { tipo: 'basica' }), [0, 0.065, 0.051]));
    }),

  tubo_ensayo: ({ color = '#7fdc6b' } = {}) =>
    estatico((g) => {
      g.add(malla(new THREE.CapsuleGeometry(0.016, 0.13, 4, 12), mat('#dff4ff', { opacidad: 0.45 }), [0, 0.08, 0]));
      g.add(malla(new THREE.CapsuleGeometry(0.0135, 0.06, 4, 12), mat(color, { opacidad: 0.9, emisivo: 0.3 }), [0, 0.05, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.019, 0.019, 0.02, 12), mat('#ff5aa5'), [0, 0.16, 0]));
    }),
};
