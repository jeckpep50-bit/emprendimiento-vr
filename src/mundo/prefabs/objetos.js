import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar, ponerCara } from '../materiales.js';

function estatico(construir, anclaje = 'base') {
  const g = new THREE.Group();
  construir(g);
  fusionar(g);
  g.userData.anclaje = anclaje;
  return g;
}

/** Envuelve un grupo estático y le da una animación `fn(hijo, t)`. */
function animado(hijo, fn) {
  const g = new THREE.Group();
  g.add(hijo);
  g.userData.anclaje = hijo.userData.anclaje ?? 'base';
  g.userData.animar = (t) => fn(hijo, t);
  return g;
}

function flotando(hijo, amplitud = 0.012, velocidad = 1.5) {
  const fase = Math.random() * 6;
  return animado(hijo, (h, t) => {
    h.position.y = Math.sin(t * velocidad + fase) * amplitud;
    h.rotation.y = Math.sin(t * 0.6 + fase) * 0.25;
  });
}

export function mosca() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.add(malla(new THREE.SphereGeometry(0.03, 16, 12), mat('#2b2b33'), [-0.015, 0, 0], [0, 0, 0], [1.5, 0.9, 0.9]));
  cuerpo.add(malla(new THREE.SphereGeometry(0.022, 14, 10), mat('#3a3a44'), [0.035, 0.004, 0]));
  const ojo = new THREE.SphereGeometry(0.013, 12, 10);
  cuerpo.add(malla(ojo, mat('#c62828'), [0.045, 0.014, 0.013]));
  cuerpo.add(malla(ojo, mat('#c62828'), [0.045, 0.014, -0.013]));
  const pata = new THREE.CylinderGeometry(0.002, 0.002, 0.03, 4);
  [-0.02, 0, 0.02].forEach((x) => {
    cuerpo.add(malla(pata, mat('#1d1d27'), [x, -0.028, 0.012], [0.4, 0, 0]));
    cuerpo.add(malla(pata, mat('#1d1d27'), [x, -0.028, -0.012], [-0.4, 0, 0]));
  });
  fusionar(cuerpo);
  g.add(cuerpo);
  const alaGeo = new THREE.SphereGeometry(0.03, 12, 8);
  const alaMat = mat('#dff4ff', { opacidad: 0.55 });
  const alaI = malla(alaGeo, alaMat, [-0.02, 0.02, 0.025], [0, 0, 0], [1.3, 0.12, 0.6]);
  const alaD = malla(alaGeo, alaMat, [-0.02, 0.02, -0.025], [0, 0, 0], [1.3, 0.12, 0.6]);
  g.add(alaI, alaD);
  g.userData.animar = (t) => {
    const a = Math.sin(t * 60) * 0.5;
    alaI.rotation.x = a;
    alaD.rotation.x = -a;
  };
  g.userData.anclaje = 'centro';
  return g;
}

function mano(sucia) {
  const c = new THREE.Group();
  const piel = mat('#f1c27d');
  c.add(malla(new RoundedBoxGeometry(0.09, 0.1, 0.03, 3, 0.012), piel, [0, 0.07, 0]));
  const dedo = new THREE.CapsuleGeometry(0.011, 0.045, 4, 8);
  [-0.032, -0.011, 0.011, 0.032].forEach((x, i) => c.add(malla(dedo, piel, [x, 0.145 + (i === 1 || i === 2 ? 0.008 : 0), 0])));
  c.add(malla(dedo, piel, [-0.058, 0.07, 0.005], [0, 0, 0.9]));
  c.add(malla(new THREE.CylinderGeometry(0.035, 0.038, 0.05, 16), piel, [0, 0.01, 0]));
  if (sucia) {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const puntos = [[-0.02, 0.08], [0.025, 0.055], [0.01, 0.1], [-0.03, 0.14], [0.03, 0.15], [0.0, 0.04]];
    puntos.forEach(([x, y], i) => c.add(malla(geo, mat(['#6b8e23', '#8d6e63', '#9ccc65'][i % 3]), [x, y, 0.016], [0, 0, 0], [0.011, 0.011, 0.004])));
  } else {
    const brillo = new THREE.OctahedronGeometry(0.012);
    [[0.06, 0.16], [-0.07, 0.12], [0.07, 0.06]].forEach(([x, y]) => c.add(malla(brillo, mat('#ffffff', { tipo: 'basica' }), [x, y, 0.01], [0, 0, 0], [0.6, 1.4, 0.6])));
  }
  fusionar(c);
  c.userData.anclaje = 'base';
  return flotando(c, 0.006, 1);
}

export const objetos = {
  mosca,

  mano_sucia: () => mano(true),
  mano_limpia: () => mano(false),

  jabon: () =>
    flotando(
      estatico((g) => {
        g.add(malla(new RoundedBoxGeometry(0.12, 0.04, 0.075, 4, 0.018), mat('#ff9ecb'), [0, 0.02, 0]));
        const burbuja = new THREE.SphereGeometry(1, 14, 10);
        [[0.03, 0.06, 0, 0.018], [-0.02, 0.075, 0.01, 0.013], [0.0, 0.1, -0.01, 0.01]].forEach(([x, y, z, r]) => g.add(malla(burbuja, mat('#e3f6ff', { opacidad: 0.6 }), [x, y, z], [0, 0, 0], r)));
      }),
    ),

  gel_antibacterial: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.07, 0.13, 0.045, 3, 0.015), mat('#8fd3ff', { opacidad: 0.8 }), [0, 0.065, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10), mat('#ffffff'), [0, 0.15, 0]));
      g.add(malla(new THREE.BoxGeometry(0.045, 0.012, 0.014), mat('#ffffff'), [0.015, 0.172, 0]));
      g.add(malla(new THREE.BoxGeometry(0.05, 0.04, 0.002), mat('#4f7cff'), [0, 0.06, 0.0235]));
    }),

  toalla: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.2, 0.035, 0.13, 3, 0.015), mat('#5aa9e6'), [0, 0.0175, 0]));
      g.add(malla(new RoundedBoxGeometry(0.2, 0.035, 0.13, 3, 0.015), mat('#7fc8f8'), [0, 0.05, 0]));
      g.add(malla(new THREE.BoxGeometry(0.202, 0.008, 0.132), mat('#ffffff'), [0, 0.05, 0]));
    }),

  lavamanos: () =>
    estatico((g) => {
      const blanco = mat('#f4f7fb');
      g.add(malla(new THREE.CylinderGeometry(0.07, 0.1, 0.75, 20), blanco, [0, 0.375, 0]));
      const perfil = [[0.02, 0], [0.22, 0.02], [0.27, 0.1], [0.27, 0.14], [0.24, 0.14], [0.2, 0.05], [0.02, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
      g.add(malla(new THREE.LatheGeometry(perfil, 28), blanco, [0, 0.72, 0], [0, 0, 0], [1, 1, 0.7]));
      const metal = mat('#b8c4d6');
      g.add(malla(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 12), metal, [0, 0.92, -0.16]));
      g.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 12), metal, [0, 0.975, -0.11], [Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), metal, [0.07, 0.88, -0.16]));
      g.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), metal, [-0.07, 0.88, -0.16]));
      g.add(malla(new THREE.SphereGeometry(0.012, 8, 6), mat('#ff5a5f'), [-0.07, 0.9, -0.16]));
      g.add(malla(new THREE.SphereGeometry(0.012, 8, 6), mat('#4f7cff'), [0.07, 0.9, -0.16]));
    }),

  refrigeradora: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.7, 1.7, 0.65, 4, 0.05), mat('#e9f1f7'), [0, 0.85, 0]));
      g.add(malla(new THREE.BoxGeometry(0.66, 0.012, 0.01), mat('#b8c4d6'), [0, 1.15, 0.326]));
      const asa = new RoundedBoxGeometry(0.03, 0.3, 0.04, 2, 0.012);
      g.add(malla(asa, mat('#8a98ad'), [0.27, 1.38, 0.34]));
      g.add(malla(asa, mat('#8a98ad'), [0.27, 0.85, 0.34]));
      g.add(malla(new THREE.CircleGeometry(0.05, 20), mat('#4fc3f7', { tipo: 'basica' }), [-0.2, 1.45, 0.327]));
    }),

  basurero: () =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.16, 0.13, 0.42, 24), mat('#43a047'), [0, 0.21, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24), mat('#2e7d32'), [0, 0.44, 0]));
      g.add(malla(new RoundedBoxGeometry(0.1, 0.025, 0.03, 2, 0.01), mat('#1b5e20'), [0, 0.47, 0]));
    }),

  recipiente_tapado: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.18, 0.08, 0.13, 3, 0.02), mat('#dff4ff', { opacidad: 0.6 }), [0, 0.04, 0]));
      g.add(malla(new RoundedBoxGeometry(0.16, 0.05, 0.11, 2, 0.015), mat('#ffb74d'), [0, 0.035, 0]));
      g.add(malla(new RoundedBoxGeometry(0.19, 0.02, 0.14, 3, 0.008), mat('#4f7cff'), [0, 0.09, 0]));
    }),

  olla: () => {
    const g = estatico((p) => {
      const metal = mat('#9aa7b8');
      p.add(malla(new THREE.CylinderGeometry(0.13, 0.12, 0.14, 28), metal, [0, 0.07, 0]));
      p.add(malla(new THREE.CylinderGeometry(0.135, 0.135, 0.015, 28), mat('#7b8798'), [0, 0.147, 0]));
      p.add(malla(new THREE.SphereGeometry(0.018, 10, 8), mat('#2b2b33'), [0, 0.165, 0]));
      const asa = new RoundedBoxGeometry(0.05, 0.02, 0.03, 2, 0.008);
      p.add(malla(asa, mat('#2b2b33'), [0.155, 0.11, 0]));
      p.add(malla(asa, mat('#2b2b33'), [-0.155, 0.11, 0]));
    });
    const vapor = [];
    const geo = new THREE.SphereGeometry(0.025, 10, 8);
    for (let i = 0; i < 4; i++) {
      const v = malla(geo, mat('#ffffff', { opacidad: 0.6 }));
      vapor.push(v);
      g.add(v);
    }
    g.userData.animar = (t) => {
      vapor.forEach((v, i) => {
        const k = (t * 0.5 + i / vapor.length) % 1;
        v.position.set(Math.sin(k * 6 + i) * 0.03, 0.18 + k * 0.2, Math.cos(i) * 0.03);
        v.scale.setScalar(0.6 + k * 1.2);
      });
    };
    return g;
  },

  lupa: () =>
    flotando(
      estatico((g) => {
        g.add(malla(new THREE.TorusGeometry(0.07, 0.012, 10, 32), mat('#37474f'), [0, 0.2, 0]));
        g.add(malla(new THREE.CircleGeometry(0.07, 32), mat('#bfe9ff', { opacidad: 0.45, lados: THREE.DoubleSide }), [0, 0.2, 0]));
        g.add(malla(new RoundedBoxGeometry(0.024, 0.13, 0.024, 2, 0.01), mat('#8d6e63'), [0, 0.07, 0]));
      }),
    ),

  microscopio: () =>
    estatico((g) => {
      const cuerpo = mat('#eef2f7');
      const oscuro = mat('#37474f');
      g.add(malla(new RoundedBoxGeometry(0.2, 0.03, 0.15, 3, 0.01), oscuro, [0, 0.015, 0]));
      g.add(malla(new RoundedBoxGeometry(0.04, 0.25, 0.05, 2, 0.015), cuerpo, [0, 0.15, -0.05], [0.15, 0, 0]));
      g.add(malla(new THREE.BoxGeometry(0.13, 0.012, 0.11), oscuro, [0, 0.11, 0.02]));
      g.add(malla(new THREE.CylinderGeometry(0.022, 0.026, 0.16, 16), cuerpo, [0, 0.25, 0.01], [-0.35, 0, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 12), oscuro, [0, 0.335, -0.02], [-0.35, 0, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.01, 0.014, 0.04, 10), oscuro, [0, 0.15, 0.04]));
      g.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), mat('#4f7cff'), [0.035, 0.18, -0.05], [0, 0, Math.PI / 2]));
    }),

  termometro: () =>
    estatico((g) => {
      g.add(malla(new THREE.CapsuleGeometry(0.018, 0.2, 4, 12), mat('#eef6ff', { opacidad: 0.8 }), [0, 0.13, 0]));
      g.add(malla(new THREE.SphereGeometry(0.024, 14, 10), mat('#ff5a5f'), [0, 0.03, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), mat('#ff5a5f'), [0, 0.09, 0]));
    }),

  cepillo_dientes: () =>
    estatico((g) => {
      g.add(malla(new RoundedBoxGeometry(0.2, 0.018, 0.022, 2, 0.008), mat('#4f7cff'), [0, 0.011, 0]));
      g.add(malla(new RoundedBoxGeometry(0.045, 0.03, 0.02, 2, 0.006), mat('#ffffff'), [0.075, 0.035, 0]));
      g.add(malla(new RoundedBoxGeometry(0.02, 0.012, 0.018, 2, 0.004), mat('#8fd3ff'), [0.075, 0.05, 0]));
    }),

  planta: () =>
    estatico((g) => {
      g.add(malla(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 20), mat('#c9744a'), [0, 0.06, 0]));
      g.add(malla(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 20), mat('#5d4037'), [0, 0.118, 0]));
      const hoja = new THREE.SphereGeometry(0.05, 12, 8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(malla(hoja, mat(i % 2 ? '#43a047' : '#66bb6a'), [Math.cos(a) * 0.05, 0.2 + (i % 3) * 0.03, Math.sin(a) * 0.05], [0, -a, 0.5], [1.4, 0.35, 0.7]));
      }
      g.add(malla(new THREE.CylinderGeometry(0.006, 0.008, 0.1, 6), mat('#2e7d32'), [0, 0.17, 0]));
    }),

  sol: () => {
    const g = estatico((c) => {
      c.add(malla(new THREE.SphereGeometry(0.1, 26, 18), mat('#ffd54f', { emisivo: 0.35 })));
      const rayo = new THREE.ConeGeometry(0.025, 0.07, 8);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        c.add(malla(rayo, mat('#ffb300', { emisivo: 0.3 }), [Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.02], [0, 0, a - Math.PI / 2]));
      }
      ponerCara(c, { r: 0.1, caracter: 'bueno' });
    }, 'centro');
    return animado(g, (h, t) => (h.rotation.z = Math.sin(t * 0.8) * 0.15));
  },

  corazon: () => {
    const forma = new THREE.Shape();
    forma.moveTo(0, -0.08);
    forma.bezierCurveTo(-0.12, 0.0, -0.1, 0.1, 0, 0.05);
    forma.bezierCurveTo(0.1, 0.1, 0.12, 0.0, 0, -0.08);
    const g = estatico((c) => {
      c.add(malla(new THREE.ExtrudeGeometry(forma, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 }), mat('#ff5a5f', { emisivo: 0.15 }), [0, 0, -0.02]));
    }, 'centro');
    return animado(g, (h, t) => h.scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * 0.08));
  },

  trofeo: () =>
    flotando(
      estatico((g) => {
        const oro = mat('#ffc23c', { emisivo: 0.18 });
        g.add(malla(new RoundedBoxGeometry(0.14, 0.04, 0.14, 2, 0.01), mat('#6d4c41'), [0, 0.02, 0]));
        g.add(malla(new THREE.CylinderGeometry(0.02, 0.035, 0.07, 14), oro, [0, 0.075, 0]));
        const perfil = [[0.0, 0], [0.03, 0.005], [0.07, 0.05], [0.085, 0.13], [0.078, 0.13], [0.063, 0.055], [0.0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
        g.add(malla(new THREE.LatheGeometry(perfil, 28), oro, [0, 0.105, 0]));
        const asa = new THREE.TorusGeometry(0.035, 0.008, 8, 16, Math.PI);
        g.add(malla(asa, oro, [0.085, 0.18, 0], [0, 0, -Math.PI / 2]));
        g.add(malla(asa, oro, [-0.085, 0.18, 0], [0, 0, Math.PI / 2]));
        g.add(malla(new THREE.OctahedronGeometry(0.025), mat('#ffffff', { tipo: 'basica' }), [0, 0.17, 0.066], [0, 0, 0], [1, 1, 0.3]));
      }),
    ),

  estrella: () => {
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.045 : 0.1;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i ? forma.lineTo(Math.cos(a) * r, Math.sin(a) * r) : forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = estatico((c) => {
      c.add(malla(new THREE.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }), mat('#ffc23c', { emisivo: 0.3 }), [0, 0, -0.015]));
    }, 'centro');
    return animado(g, (h, t) => (h.rotation.y = t * 1.2));
  },
};

/** Mesa simple (la usan los entornos y las escenas; no está en el catálogo). */
export function mesa(ancho = 1.2, fondo = 0.6, alto = 0.72, color = '#c89f7a') {
  return estatico((g) => {
    g.add(malla(new RoundedBoxGeometry(ancho, 0.04, fondo, 2, 0.015), mat(color), [0, alto - 0.02, 0]));
    const pata = new THREE.BoxGeometry(0.04, alto - 0.04, 0.04);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(malla(pata, mat('#8d6e63'), [sx * (ancho / 2 - 0.05), (alto - 0.04) / 2, sz * (fondo / 2 - 0.05)]));
  });
}
