import * as THREE from 'three';
import { mat, malla, ponerCara, fusionar } from '../materiales.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Flagelo ondulado que sale de `inicio` en dirección `dir`. */
function flagelo(inicio, dir, largo, color, grosor = 0.006) {
  const d = dir.clone().normalize();
  const lateral = new THREE.Vector3(0, 1, 0).cross(d);
  if (lateral.lengthSq() < 0.01) lateral.set(1, 0, 0);
  lateral.normalize();
  const puntos = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    puntos.push(inicio.clone().addScaledVector(d, largo * k).addScaledVector(lateral, Math.sin(k * Math.PI * 3) * largo * 0.12));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos), 24, grosor, 5), mat(color));
}

/** Envoltorio común: cuerpo estático fusionado + animación de flotar/balancearse. */
function microbio(construir, { velocidad = 1, balanceo = 0.12 } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  construir(cuerpo);
  fusionar(cuerpo);
  g.add(cuerpo);
  const fase = Math.random() * Math.PI * 2;
  g.userData.animar = (t) => {
    cuerpo.position.y = Math.sin(t * 1.6 * velocidad + fase) * 0.015;
    cuerpo.rotation.z = Math.sin(t * 1.1 * velocidad + fase) * balanceo;
    cuerpo.rotation.y = Math.sin(t * 0.7 * velocidad + fase) * 0.18;
  };
  g.userData.anclaje = 'centro';
  return g;
}

export const microbios = {
  coco: ({ color = '#b56cff', caracter = 'malo' } = {}) =>
    microbio((c) => {
      c.add(malla(new THREE.SphereGeometry(0.12, 28, 20), mat(color)));
      ponerCara(c, { r: 0.12, caracter });
    }),

  estafilococo: ({ color = '#f5a623', caracter = 'malo' } = {}) =>
    microbio((c) => {
      const geo = new THREE.SphereGeometry(0.06, 18, 14);
      const posiciones = [[-0.07, 0.05, -0.03], [0.07, 0.05, -0.03], [0, 0.1, -0.05], [-0.09, -0.04, -0.02], [0.09, -0.04, -0.02], [0, -0.09, -0.03], [-0.03, 0.02, -0.08], [0.04, -0.01, -0.09]];
      for (const p of posiciones) c.add(malla(geo, mat(color), p));
      c.add(malla(new THREE.SphereGeometry(0.075, 22, 16), mat(color), [0, 0, 0.03]));
      ponerCara(c, { r: 0.075, caracter, z: 0.03 + 0.075 });
    }),

  estreptococo: ({ color = '#ff7a59', caracter = 'malo' } = {}) =>
    microbio((c) => {
      const geo = new THREE.SphereGeometry(0.05, 18, 14);
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.085;
        const y = Math.cos(i * 0.5) * 0.05 - 0.03;
        c.add(malla(geo, mat(color), [x, y, 0]));
      }
      ponerCara(c, { r: 0.05, caracter, y: 0.02 });
    }),

  bacilo: ({ color = '#4fc08d', caracter = 'malo' } = {}) =>
    microbio((c) => {
      c.add(malla(new THREE.CapsuleGeometry(0.075, 0.2, 8, 20), mat(color), [0, 0, 0], [0, 0, Math.PI / 2]));
      c.add(flagelo(V(-0.17, 0, 0), V(-1, -0.2, 0), 0.16, color));
      c.add(flagelo(V(0.17, 0, 0), V(1, 0.15, 0), 0.14, color));
      ponerCara(c, { r: 0.075, caracter });
    }),

  salmonela: ({ color = '#e2574c', caracter = 'malo' } = {}) =>
    microbio(
      (c) => {
        c.add(malla(new THREE.CapsuleGeometry(0.07, 0.19, 8, 20), mat(color), [0, 0, 0], [0, 0, Math.PI / 2]));
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const inicio = V(Math.cos(a) * 0.15, Math.sin(a) * 0.065, -0.01);
          c.add(flagelo(inicio, V(Math.cos(a), Math.sin(a) * 1.2, -0.3), 0.13, '#b8342b', 0.004));
        }
        ponerCara(c, { r: 0.07, caracter });
      },
      { velocidad: 1.6 },
    ),

  espirilo: ({ color = '#5b8def', caracter = 'malo' } = {}) =>
    microbio(
      (c) => {
        const puntos = [];
        for (let i = 0; i <= 60; i++) {
          const k = i / 60;
          puntos.push(V(-0.2 + k * 0.4, Math.sin(k * Math.PI * 5) * 0.045, Math.cos(k * Math.PI * 5) * 0.045 - 0.02));
        }
        c.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos), 90, 0.022, 8), mat(color)));
        c.add(malla(new THREE.SphereGeometry(0.06, 20, 14), mat(color), [0.2, 0, 0.02]));
        ponerCara(c, { r: 0.06, caracter, x: 0.2, z: 0.08 });
      },
      { velocidad: 2 },
    ),

  virus: ({ color = '#ff5a8a', caracter = 'malo' } = {}) =>
    microbio((c) => {
      const r = 0.1;
      c.add(malla(new THREE.SphereGeometry(r, 28, 20), mat(color)));
      const puntas = new THREE.IcosahedronGeometry(1, 1).getAttribute('position');
      const vistos = new Set();
      const geoTallo = new THREE.CylinderGeometry(0.008, 0.01, 0.045, 6);
      const geoBola = new THREE.SphereGeometry(0.018, 10, 8);
      for (let i = 0; i < puntas.count; i++) {
        const n = V(puntas.getX(i), puntas.getY(i), puntas.getZ(i)).normalize();
        const clave = n.toArray().map((v) => v.toFixed(2)).join();
        if (vistos.has(clave) || n.z > 0.55) continue; // deja libre la cara
        vistos.add(clave);
        const tallo = malla(geoTallo, mat('#d8436f'));
        tallo.position.copy(n).multiplyScalar(r + 0.018);
        tallo.quaternion.setFromUnitVectors(V(0, 1, 0), n);
        c.add(tallo);
        const bola = malla(geoBola, mat('#ffd166'));
        bola.position.copy(n).multiplyScalar(r + 0.045);
        c.add(bola);
      }
      ponerCara(c, { r, caracter });
    }),

  moho: ({ color = '#7fbf6a', caracter = 'malo' } = {}) =>
    microbio(
      (c) => {
        c.add(malla(new THREE.SphereGeometry(0.11, 24, 16), mat('#e8efd9'), [0, -0.05, 0], [0, 0, 0], [1.25, 0.6, 1]));
        const geoTallo = new THREE.CylinderGeometry(0.006, 0.008, 1, 5);
        const geoEspora = new THREE.SphereGeometry(0.03, 12, 10);
        const alturas = [0.16, 0.2, 0.13, 0.18, 0.15, 0.22, 0.12];
        alturas.forEach((h, i) => {
          const a = (i / alturas.length) * Math.PI * 2;
          const x = Math.cos(a) * 0.07;
          const z = Math.sin(a) * 0.05 - 0.03;
          c.add(malla(geoTallo, mat('#cfe3b8'), [x, -0.02 + h / 2, z], [0, 0, 0], [1, h, 1]));
          c.add(malla(geoEspora, mat(i % 2 ? color : '#3d7a5a'), [x, -0.02 + h, z]));
        });
        ponerCara(c, { r: 0.1, caracter, y: -0.04, z: 0.1 });
      },
      { balanceo: 0.05 },
    ),

  levadura: ({ color = '#f3d9a4', caracter = 'bueno' } = {}) =>
    microbio((c) => {
      c.add(malla(new THREE.SphereGeometry(0.11, 26, 18), mat(color), [0, 0, 0], [0, 0, 0], [1, 1.2, 1]));
      c.add(malla(new THREE.SphereGeometry(0.055, 18, 14), mat('#ead0a0'), [0.09, 0.12, -0.02], [0, 0, 0], [1, 1.15, 1]));
      ponerCara(c, { r: 0.11, caracter });
    }),

  lactobacilo: ({ color = '#6cc4ff', caracter = 'bueno' } = {}) =>
    microbio((c) => {
      const geo = new THREE.CapsuleGeometry(0.045, 0.14, 6, 16);
      c.add(malla(geo, mat(color), [-0.19, -0.04, -0.02], [0, 0, Math.PI / 2 - 0.25]));
      c.add(malla(geo, mat(color), [0, 0, 0], [0, 0, Math.PI / 2]));
      c.add(malla(geo, mat(color), [0.19, -0.04, -0.02], [0, 0, Math.PI / 2 + 0.25]));
      ponerCara(c, { r: 0.05, caracter });
    }),

  protozoo: ({ color = '#c792ea', caracter = 'malo' } = {}) => {
    const g = microbio(
      (c) => {
        const m = mat(color);
        c.add(malla(new THREE.SphereGeometry(0.12, 26, 18), m, [0, 0, 0], [0, 0, 0], [1.2, 0.9, 0.8]));
        c.add(malla(new THREE.SphereGeometry(0.06, 16, 12), m, [-0.15, -0.03, 0], [0, 0, 0], [1.4, 0.8, 0.8]));
        c.add(malla(new THREE.SphereGeometry(0.05, 16, 12), m, [0.14, 0.06, -0.02], [0, 0, 0], [1.3, 0.8, 0.8]));
        c.add(malla(new THREE.SphereGeometry(0.045, 16, 12), m, [0.05, -0.1, 0], [0, 0, 0], [1, 1.3, 0.8]));
        c.add(malla(new THREE.SphereGeometry(0.035, 14, 10), mat('#7a4fa3'), [-0.06, 0.02, -0.02]));
        ponerCara(c, { r: 0.1, caracter, x: 0.02, z: 0.095 });
      },
      { velocidad: 0.7 },
    );
    const cuerpo = g.children[0];
    const animarBase = g.userData.animar;
    g.userData.animar = (t) => {
      animarBase(t);
      cuerpo.scale.set(1 + Math.sin(t * 2) * 0.05, 1 - Math.sin(t * 2) * 0.05, 1);
    };
    return g;
  },

  celula: ({ color = '#ffb3c7', caracter = 'neutral' } = {}) =>
    microbio(
      (c) => {
        c.add(malla(new THREE.SphereGeometry(0.14, 28, 20), mat(color, { opacidad: 0.75 }), [0, 0, 0], [0, 0, 0], [1.1, 1, 0.9]));
        c.add(malla(new THREE.SphereGeometry(0.05, 18, 14), mat('#9b4dca'), [-0.03, 0.02, -0.02]));
        const geoOrg = new THREE.CapsuleGeometry(0.012, 0.03, 4, 8);
        [[0.07, -0.05, 0.02], [-0.08, -0.06, 0.01], [0.06, 0.07, -0.03]].forEach((p, i) => c.add(malla(geoOrg, mat('#ff7a59'), p, [0, 0, i])));
        ponerCara(c, { r: 0.11, caracter, z: 0.12 });
      },
      { balanceo: 0.04 },
    ),
};
