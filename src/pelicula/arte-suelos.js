import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar, ponerCara } from '../mundo/materiales.js';
import { cielo, texturaLienzo, matTextura, volcanes, habitacion } from '../mundo/entornos.js';
import { PanelLienzo, escribir } from '../ui/lienzo.js';

// Arte de la película "Types of Soil": personaje, escenarios y utilería.
// Coordenadas: el usuario está en el origen mirando a -Z; el suelo está en y = 0.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const azar = (a, b) => a + Math.random() * (b - a);
export const COLOR_SUELO = { arena: '#e8c27a', arcilla: '#b8653f', franco: '#5a3b22', humus: '#3b2416', limo: '#a88a6a' };

// ── Wiggles, el gusano ──────────────────────────────────────────────────────

/**
 * Wiggles (~0,55 m de alto). Devuelve { grupo, cabeza, hablar(nivel), animar(dt, t), mirar(posMundo | null), saludar() }.
 */
export function crearWiggles() {
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  const rosa = mat('#f4899c');
  const banda = mat('#ffb3c1');
  const curva = new THREE.CatmullRomCurve3([V(0, 0.035, 0.22), V(0, 0.035, 0.11), V(0, 0.06, 0.02), V(0, 0.17, -0.01), V(0, 0.29, 0.0), V(0, 0.38, 0.02)]);
  const segmentos = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const p = curva.getPoint(k);
    const s = malla(new THREE.SphereGeometry(0.03 + k * 0.032, 16, 12), i === 8 ? banda : rosa, p.toArray());
    cuerpo.add(s);
    segmentos.push({ s, base: p.clone(), k });
  }
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.45, 0.03);
  grupo.add(cabeza);
  const craneo = new THREE.Group();
  craneo.add(malla(new THREE.SphereGeometry(0.078, 26, 20), rosa));
  // Sombrero de explorador
  craneo.add(malla(new THREE.CylinderGeometry(0.105, 0.105, 0.01, 28), mat('#c9a36a'), [0, 0.062, -0.005], [-0.12, 0, 0]));
  craneo.add(malla(new THREE.SphereGeometry(0.062, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d8b47c'), [0, 0.064, -0.01], [-0.12, 0, 0], [1, 0.85, 1]));
  craneo.add(malla(new THREE.CylinderGeometry(0.063, 0.063, 0.016, 28, 1, true), mat('#2dbe78', { lados: THREE.DoubleSide }), [0, 0.074, -0.012], [-0.12, 0, 0]));
  for (const lado of [-1, 1]) craneo.add(malla(new THREE.CircleGeometry(0.016, 16), mat('#ff6f8f', { tipo: 'basica', opacidad: 0.6 }), [lado * 0.05, -0.018, 0.058], [0, lado * 0.6, 0]));
  fusionar(craneo);
  cabeza.add(craneo);
  const ojos = [];
  for (const lado of [-1, 1]) {
    const ojo = new THREE.Group();
    ojo.position.set(lado * 0.032, 0.022, 0.058);
    ojo.add(malla(new THREE.SphereGeometry(0.026, 18, 14), mat('#ffffff', { tipo: 'basica' })));
    const pupila = new THREE.Group();
    pupila.add(malla(new THREE.SphereGeometry(0.0145, 14, 10), mat('#1d1d27', { tipo: 'basica' }), [0, 0, 0.016]));
    pupila.add(malla(new THREE.SphereGeometry(0.005, 8, 6), mat('#ffffff', { tipo: 'basica' }), [0.005, 0.006, 0.028]));
    ojo.add(pupila);
    const parpado = malla(new THREE.SphereGeometry(0.0275, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), rosa);
    parpado.scale.y = 0.05;
    ojo.add(parpado);
    cabeza.add(ojo);
    ojos.push({ pupila, parpado });
  }
  const sonrisa = malla(new THREE.TorusGeometry(0.022, 0.005, 6, 18, Math.PI), mat('#8b1d36', { tipo: 'basica' }), [0, -0.022, 0.07], [0, 0, Math.PI]);
  const boca = malla(new THREE.SphereGeometry(0.02, 16, 10), mat('#8b1d36', { tipo: 'basica' }), [0, -0.03, 0.066], [0, 0, 0], [1.2, 0.2, 0.6]);
  boca.add(malla(new THREE.SphereGeometry(0.012, 10, 8), mat('#ff6f8f', { tipo: 'basica' }), [0, -0.4, 0.4], [0, 0, 0], [1, 0.6, 0.6]));
  cabeza.add(sonrisa, boca);

  let nivelHabla = 0;
  let objetivo = null;
  let proximoParpadeo = 2;
  let parpadeo = 0;
  let saludo = 0;
  const local = V(0, 0, 0);
  const api = {
    grupo,
    cabeza,
    hablar(nivel) {
      nivelHabla = nivel;
    },
    mirar(posMundo) {
      objetivo = posMundo ? posMundo.clone() : null;
    },
    saludar() {
      saludo = 1.6;
    },
    animar(dt, t) {
      const habla = nivelHabla > 0.05;
      const amp = habla ? 0.03 : 0.02;
      for (const { s, base, k } of segmentos) {
        s.position.x = base.x + Math.sin(t * 3 - k * 5) * amp * k;
        s.position.y = base.y + Math.sin(t * 2.2 - k * 3) * 0.006 * k;
      }
      cabeza.position.x = Math.sin(t * 3 - 5) * amp;
      cabeza.position.y = 0.45 + Math.sin(t * 2.2 - 3) * 0.006 + (habla ? Math.abs(Math.sin(t * 12)) * 0.006 : 0);
      // Saludo: se balancea de lado a lado
      if (saludo > 0) {
        saludo = Math.max(0, saludo - dt);
        grupo.rotation.z = Math.sin(saludo * 12) * 0.25 * Math.min(1, saludo);
      } else grupo.rotation.z *= 0.9;
      // Boca
      const apertura = 0.2 + Math.min(1, nivelHabla) * 1.3;
      boca.scale.y += (apertura - boca.scale.y) * Math.min(1, dt * 18);
      sonrisa.visible = boca.scale.y < 0.45;
      // Mirada
      if (objetivo) {
        cabeza.parent.worldToLocal(local.copy(objetivo));
        local.sub(cabeza.position);
        const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
        const pitch = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.5, 0.5);
        cabeza.rotation.y += (yaw - cabeza.rotation.y) * Math.min(1, dt * 4);
        cabeza.rotation.x += (pitch - cabeza.rotation.x) * Math.min(1, dt * 4);
      } else {
        cabeza.rotation.y *= 0.95;
        cabeza.rotation.x *= 0.95;
      }
      cabeza.rotation.z = Math.sin(t * 1.3) * 0.08;
      // Parpadeo
      proximoParpadeo -= dt;
      if (proximoParpadeo <= 0) {
        parpadeo = 0.18;
        proximoParpadeo = azar(2, 4.5);
      }
      parpadeo = Math.max(0, parpadeo - dt);
      const cerrado = parpadeo > 0 ? Math.sin((parpadeo / 0.18) * Math.PI) : 0;
      for (const o of ojos) o.parpado.scale.y = 0.05 + cerrado * 0.95;
    },
  };
  return api;
}

/** Hoja gigante voladora donde viaja Wiggles. */
export function crearHoja() {
  const g = new THREE.Group();
  const forma = new THREE.Shape();
  forma.moveTo(0, -0.36);
  forma.bezierCurveTo(0.24, -0.22, 0.24, 0.18, 0, 0.36);
  forma.bezierCurveTo(-0.24, 0.18, -0.24, -0.22, 0, -0.36);
  const geo = new THREE.ShapeGeometry(forma, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, (pos.getX(i) ** 2) * 1.6 + (pos.getY(i) + 0.36) ** 2 * 0.15);
  geo.computeVertexNormals();
  g.add(malla(geo, mat('#4caf50', { lados: THREE.DoubleSide }), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  g.add(malla(new THREE.BoxGeometry(0.008, 0.004, 0.7), mat('#2e7d32'), [0, 0.012, 0]));
  for (let i = 0; i < 5; i++) {
    const z = -0.24 + i * 0.12;
    for (const lado of [-1, 1]) g.add(malla(new THREE.BoxGeometry(0.13, 0.003, 0.005), mat('#2e7d32'), [lado * 0.06, 0.008 + 0.02 * (0.06 ** 2) * 1.6, z - 0.03], [0, -lado * 0.6, 0]));
  }
  g.add(malla(new THREE.CylinderGeometry(0.008, 0.005, 0.12, 6), mat('#6d4c41'), [0, 0.0, 0.41], [Math.PI / 2 - 0.3, 0, 0]));
  return fusionar(g);
}

// ── Hueco mágico en el piso ─────────────────────────────────────────────────

/** Hueco redondo en el piso con borde de tierra. Se abre escalándolo. */
export function crearAgujero(radio = 0.42, { tapa = false } = {}) {
  const g = new THREE.Group();
  const fondo = new THREE.Group();
  // En la vista previa hay un piso virtual que tapa el interior: se dibuja la boca oscura.
  if (tapa) fondo.add(malla(new THREE.CircleGeometry(radio * 0.98, 40), mat('#1d1209', { tipo: 'basica' }), [0, 0.003, 0], [-Math.PI / 2, 0, 0]));
  fondo.add(malla(new THREE.CylinderGeometry(radio, radio * 0.85, 0.6, 40, 1, true), mat('#3b2416', { lados: THREE.BackSide }), [0, -0.3, 0]));
  fondo.add(malla(new THREE.CircleGeometry(radio * 0.85, 40), mat('#1d1209', { tipo: 'basica' }), [0, -0.6, 0], [-Math.PI / 2, 0, 0]));
  const terron = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = radio + azar(0.0, 0.05);
    fondo.add(malla(terron, mat(['#6b4428', '#5a3b22', '#7a5233'][i % 3]), [Math.cos(a) * r, 0.02, Math.sin(a) * r], [i, i * 2, 0], azar(0.04, 0.07)));
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    fondo.add(malla(new THREE.ConeGeometry(0.012, 0.09, 5), mat('#5fae4a'), [Math.cos(a) * (radio + 0.08), 0.04, Math.sin(a) * (radio + 0.08)], [0, 0, (i % 2 ? 1 : -1) * 0.3]));
  }
  g.add(fusionar(fondo));
  return g;
}

/** Montoncito de suelo (para mostrar sand / clay / loam). */
export function montoncito(tipo, radio = 0.12) {
  const g = new THREE.Group();
  const color = COLOR_SUELO[tipo] ?? COLOR_SUELO.franco;
  g.add(malla(new THREE.SphereGeometry(radio, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color), [0, 0, 0], [0, 0, 0], [1, 0.6, 1]));
  const grano = tipo === 'arena' ? new THREE.IcosahedronGeometry(0.012, 0) : new THREE.DodecahedronGeometry(0.01, 0);
  for (let i = 0; i < 24; i++) {
    const a = i * 2.4;
    const r = Math.sqrt(i / 24) * radio * 0.9;
    const y = Math.sqrt(Math.max(0, 1 - (r / radio) ** 2)) * radio * 0.6;
    g.add(malla(grano, mat(tipo === 'arena' ? '#f3d699' : tipo === 'arcilla' ? '#a3532f' : '#3b2416'), [Math.cos(a) * r, y, Math.sin(a) * r]));
  }
  if (tipo === 'franco') for (let i = 0; i < 3; i++) g.add(malla(new THREE.SphereGeometry(0.018, 8, 6), mat('#7cb342'), [azar(-0.05, 0.05), radio * 0.5, azar(-0.05, 0.05)], [0, i, 0], [1, 0.2, 0.6]));
  return fusionar(g);
}

// ── Utilería de los capítulos ───────────────────────────────────────────────

export function mesa(ancho = 1.1, fondo = 0.55, alto = 0.62, color = '#c89f7a') {
  const g = new THREE.Group();
  g.add(malla(new RoundedBoxGeometry(ancho, 0.04, fondo, 2, 0.015), mat(color), [0, alto - 0.02, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(malla(new THREE.CylinderGeometry(0.025, 0.025, alto - 0.04, 10), mat('#8d6e63'), [sx * (ancho / 2 - 0.06), (alto - 0.04) / 2, sz * (fondo / 2 - 0.06)]));
  return fusionar(g);
}

/** Montón de suelo sobre una bandeja (capítulo 2). */
export function monticuloSuelo() {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.32, 0.3, 0.03, 32), mat('#8d6e63'), [0, 0.015, 0]));
  g.add(malla(new THREE.SphereGeometry(0.26, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#5a3b22'), [0, 0.03, 0], [0, 0, 0], [1, 0.55, 1]));
  const terron = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39;
    const r = Math.sqrt(i / 40) * 0.24;
    const y = 0.03 + Math.sqrt(Math.max(0, 1 - (r / 0.26) ** 2)) * 0.26 * 0.55;
    g.add(malla(terron, mat(['#3b2416', '#6b4428', '#9aa3ad', '#4caf50'][i % 4]), [Math.cos(a) * r, y, Math.sin(a) * r], [i, i, 0], i % 4 === 3 ? [0.02, 0.004, 0.012] : azar(0.012, 0.022)));
  }
  return fusionar(g);
}

/** Los cinco ingredientes del suelo (capítulo 2). */
export const ingredientes = {
  rocas() {
    const g = new THREE.Group();
    const geo = new THREE.DodecahedronGeometry(1, 0);
    [[0, 0, 0, 0.07, '#9aa3ad'], [0.09, -0.02, 0.02, 0.05, '#7d8794'], [-0.08, -0.03, 0.03, 0.045, '#b0b8c2'], [0.02, 0.06, -0.02, 0.04, '#8a929c']].forEach(([x, y, z, s, c], i) => g.add(malla(geo, mat(c), [x, y, z], [i, i * 2, 0], s)));
    return fusionar(g);
  },
  humus() {
    const g = new THREE.Group();
    g.add(malla(new THREE.SphereGeometry(0.09, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#3b2416'), [0, -0.04, 0], [0, 0, 0], [1, 0.7, 1]));
    const hoja = new THREE.Shape();
    hoja.moveTo(0, -0.05);
    hoja.quadraticCurveTo(0.035, 0, 0, 0.05);
    hoja.quadraticCurveTo(-0.035, 0, 0, -0.05);
    const geo = new THREE.ShapeGeometry(hoja);
    [['#a0522d', 0.02, 0.03, 0.4], ['#c98a2b', -0.04, 0.02, -0.8], ['#6d4c41', 0.05, 0.0, 1.6]].forEach(([c, x, y, r]) => g.add(malla(geo, mat(c, { lados: THREE.DoubleSide }), [x, y, 0.02], [-0.6, 0, r], 1.4)));
    return fusionar(g);
  },
  agua() {
    const g = new THREE.Group();
    g.add(malla(new THREE.SphereGeometry(0.07, 22, 16), mat('#4fb3ff'), [0, -0.02, 0]));
    g.add(malla(new THREE.ConeGeometry(0.05, 0.09, 22), mat('#4fb3ff'), [0, 0.055, 0]));
    g.add(malla(new THREE.SphereGeometry(0.015, 8, 6), mat('#e8f6ff', { tipo: 'basica' }), [0.025, 0.0, 0.06]));
    ponerCara(g, { r: 0.07, caracter: 'feliz', y: -0.025 });
    return fusionar(g);
  },
  aire() {
    const g = new THREE.Group();
    [[0, 0, 0, 0.05], [0.07, 0.04, 0, 0.035], [-0.06, 0.05, 0.01, 0.03], [0.02, 0.09, -0.01, 0.025], [-0.03, -0.06, 0.02, 0.03]].forEach(([x, y, z, r]) => g.add(malla(new THREE.SphereGeometry(r, 16, 12), mat('#e3f6ff', { opacidad: 0.55 }), [x, y, z])));
    for (let i = 0; i < 3; i++) g.add(malla(new THREE.TorusGeometry(0.06 + i * 0.02, 0.004, 4, 20, Math.PI * 0.7), mat('#ffffff', { tipo: 'basica' }), [0, -0.02 + i * 0.03, 0.02], [0, 0, 0.3]));
    return fusionar(g);
  },
  vida() {
    const g = new THREE.Group();
    g.add(gusanito());
    const hormiga = new THREE.Group();
    [[0, 0.03], [0.03, 0.022], [-0.035, 0.026]].forEach(([x, r]) => hormiga.add(malla(new THREE.SphereGeometry(r, 10, 8), mat('#2b2b33'), [x, 0, 0])));
    for (let i = 0; i < 3; i++) for (const l of [-1, 1]) hormiga.add(malla(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 4), mat('#2b2b33'), [-0.01 + i * 0.015, -0.015, l * 0.02], [l * 0.8, 0, 0]));
    hormiga.position.set(0.09, 0.0, 0.02);
    g.add(hormiga);
    const escarabajo = new THREE.Group();
    escarabajo.add(malla(new THREE.SphereGeometry(0.03, 14, 10), mat('#2dbe78'), [0, 0, 0], [0, 0, 0], [1.3, 0.7, 1]));
    escarabajo.add(malla(new THREE.SphereGeometry(0.015, 10, 8), mat('#1d1d27'), [0.04, 0, 0]));
    escarabajo.position.set(-0.09, 0.0, 0.01);
    g.add(escarabajo);
    return fusionar(g);
  },
};

/** Gusanito pequeño (para la tierra, los túneles y el terrario). */
export function gusanito(color = '#f4899c', n = 7, r = 0.016) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(malla(new THREE.SphereGeometry(r * (0.75 + 0.25 * Math.sin((i / (n - 1)) * Math.PI)), 10, 8), mat(color), [(i - (n - 1) / 2) * r * 1.4, Math.sin(i * 0.9) * r * 0.6, 0]));
  g.add(malla(new THREE.SphereGeometry(r * 0.3, 6, 4), mat('#1d1d27', { tipo: 'basica' }), [((n - 1) / 2) * r * 1.4 + r * 0.5, r * 0.5, r * 0.5]));
  return fusionar(g);
}

/** Roca grande formada por piezas que se separan al romperse (capítulo 3). */
export function rocaGrande() {
  const g = new THREE.Group();
  const piezas = [];
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i));
    v.multiplyScalar(1 + Math.sin(v.x * 3.1) * 0.08 + Math.cos(v.y * 2.7 + v.z) * 0.07);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  [[-0.26, 0.42, 0.05, 0.42], [0.27, 0.45, -0.02, 0.44], [0.0, 0.85, 0.02, 0.36], [0.02, 0.32, 0.25, 0.32]].forEach(([x, y, z, s], i) => {
    const pieza = malla(geo, mat(['#8a929c', '#7d8794', '#9aa3ad', '#868e98'][i]), [x, y, z], [i, i * 1.7, 0], [s * 1.15, s, s]);
    pieza.userData.base = pieza.position.clone();
    g.add(pieza);
    piezas.push(pieza);
  });
  // Grietas (aparecen poco a poco)
  const grietas = new THREE.Group();
  [[0, 0.6, 0.45, 0.4, 0.2], [-0.1, 0.4, 0.5, 0.3, -0.5], [0.15, 0.8, 0.38, 0.25, 0.9], [0.05, 0.25, 0.5, 0.2, 0.1]].forEach(([x, y, z, l, r]) => grietas.add(malla(new THREE.BoxGeometry(0.02, l, 0.02), mat('#2b2b33', { tipo: 'basica' }), [x, y, z], [0, 0, r])));
  grietas.children.forEach((c) => (c.visible = false));
  g.add(grietas);
  return { grupo: g, piezas, grietas: grietas.children };
}

/** Nube con lluvia (capítulo 3). */
export function nubeLluvia() {
  const g = new THREE.Group();
  const nube = new THREE.Group();
  [[0, 0, 0, 0.35], [0.35, -0.05, 0, 0.28], [-0.35, -0.05, 0.02, 0.27], [0.15, 0.15, -0.05, 0.25], [-0.15, 0.12, 0.05, 0.24]].forEach(([x, y, z, r]) => nube.add(malla(new THREE.SphereGeometry(r, 18, 12), mat('#c7d2de'), [x, y, z])));
  g.add(fusionar(nube));
  const n = 120;
  const pos = new Float32Array(n * 2 * 3);
  const gotas = Array.from({ length: n }, () => ({ x: azar(-0.6, 0.6), z: azar(-0.35, 0.35), y: azar(-2, 0), v: azar(2.5, 3.5) }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lluvia = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: 0.8 }));
  lluvia.frustumCulled = false;
  g.add(lluvia);
  return {
    grupo: g,
    lluvia,
    animar(dt, alto = 2.2) {
      gotas.forEach((d, i) => {
        d.y -= d.v * dt;
        if (d.y < -alto) d.y = -0.2;
        pos.set([d.x, d.y, d.z, d.x, d.y - 0.09, d.z], i * 6);
      });
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** Raíz que crece (se dibuja de a poco con drawRange). */
export function raiz(puntos, grosor = 0.02, color = '#8d6e4a') {
  const curva = new THREE.CatmullRomCurve3(puntos);
  const geo = new THREE.TubeGeometry(curva, 40, grosor, 6);
  const m = malla(geo, mat(color));
  const total = geo.index ? geo.index.count : geo.attributes.position.count;
  m.userData.crecer = (k) => geo.setDrawRange(0, Math.floor(total * k));
  m.userData.crecer(0);
  return m;
}

/** Líneas de viento que pasan. */
export function viento() {
  const g = new THREE.Group();
  const lineas = [];
  for (let i = 0; i < 8; i++) {
    const curva = new THREE.QuadraticBezierCurve3(V(-0.6, 0, 0), V(0, 0.08 * (i % 2 ? 1 : -1), 0), V(0.6, 0, 0));
    const l = malla(new THREE.TubeGeometry(curva, 16, 0.008, 4), mat('#ffffff', { tipo: 'basica', opacidad: 0.7 }));
    l.userData.fase = Math.random();
    l.userData.y = azar(0.2, 1.4);
    l.userData.z = azar(-0.4, 0.4);
    g.add(l);
    lineas.push(l);
  }
  return {
    grupo: g,
    animar(t) {
      for (const l of lineas) {
        const k = (t * 0.6 + l.userData.fase) % 1;
        l.position.set(-2.5 + k * 5, l.userData.y, l.userData.z);
        l.material.opacity = Math.sin(k * Math.PI) * 0.7;
      }
    },
  };
}

/** Granos gigantes de arena (capítulo 5). */
export function granosArena(n = 14) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const lista = [];
  for (let i = 0; i < n; i++) {
    const m = malla(geo, mat(['#f0c977', '#e5b45f', '#f6dca0', '#d9a35e'][i % 4]), [azar(-0.55, 0.55), azar(-0.25, 0.25), azar(-0.2, 0.2)], [i, i * 2, i * 3], azar(0.05, 0.09));
    m.userData.base = m.position.clone();
    m.userData.fase = Math.random() * 6;
    g.add(m);
    lista.push(m);
  }
  return { grupo: g, granos: lista };
}

/** Muchísimas partículas pequeñas y planas de arcilla, bien juntas (capítulo 6). */
export function particulasArcilla() {
  const n = 260;
  const geo = new THREE.CylinderGeometry(0.012, 0.012, 0.004, 6);
  const m = new THREE.InstancedMesh(geo, mat('#b8653f'), n);
  const color = new THREE.Color();
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const x = (i % 13) * 0.024 - 0.15;
    const y = Math.floor(i / 13) % 10 * 0.008;
    const z = Math.floor(i / 130) * 0.024;
    q.setFromEuler(new THREE.Euler(azar(-0.2, 0.2), azar(0, 3), azar(-0.2, 0.2)));
    mtx.compose(V(x + azar(-0.003, 0.003), y, z), q, V(1, 1, 1));
    m.setMatrixAt(i, mtx);
    m.setColorAt(i, color.set(i % 3 ? '#b8653f' : '#a3532f'));
  }
  return m;
}

/** Bola de arcilla que se convierte en olla en 3 pasos (capítulo 6). */
export function arcillaModelable() {
  const g = new THREE.Group();
  const formas = [
    malla(new THREE.SphereGeometry(0.11, 20, 14), mat('#b8653f'), [0, 0.1, 0], [0, 0, 0], [1, 0.8, 1]),
    malla(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 22), mat('#b8653f'), [0, 0.08, 0]),
    malla(new THREE.LatheGeometry([[0, 0], [0.09, 0.005], [0.13, 0.06], [0.12, 0.15], [0.08, 0.2], [0.09, 0.24], [0.08, 0.24], [0.07, 0.205], [0.11, 0.15], [0.115, 0.07], [0.08, 0.015], [0, 0.015]].map(([x, y]) => new THREE.Vector2(x, y)), 26), mat('#c06a3f'), [0, 0, 0]),
  ];
  formas.forEach((f, i) => {
    f.visible = i === 0;
    g.add(f);
  });
  return { grupo: g, formas };
}

/** Olla de barro decorada. */
export function ollaBarro(escala = 1, color = '#c06a3f') {
  const g = new THREE.Group();
  const perfil = [[0, 0], [0.09, 0.005], [0.13, 0.06], [0.12, 0.15], [0.08, 0.2], [0.09, 0.24], [0.08, 0.24], [0.07, 0.205], [0.11, 0.15], [0.115, 0.07], [0.08, 0.015], [0, 0.015]].map(([x, y]) => new THREE.Vector2(x * escala, y * escala));
  g.add(malla(new THREE.LatheGeometry(perfil, 24), mat(color)));
  g.add(malla(new THREE.TorusGeometry(0.122 * escala, 0.006 * escala, 6, 24), mat('#7a3a1e'), [0, 0.11 * escala, 0], [Math.PI / 2, 0, 0]));
  return fusionar(g);
}

/** Planta que crece desde una semilla: crecer(k) con k de 0 a 1. tipo: "lechuga" | "maiz" | "flor". */
export function plantita(tipo = 'lechuga') {
  const g = new THREE.Group();
  const tallo = malla(new THREE.CylinderGeometry(0.006, 0.008, 1, 6), mat('#4caf50'), [0, 0.5, 0]);
  const tallos = new THREE.Group();
  tallos.add(tallo);
  g.add(tallos);
  const hojas = new THREE.Group();
  const hoja = new THREE.SphereGeometry(0.035, 10, 8);
  const n = tipo === 'maiz' ? 6 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (tipo === 'maiz') hojas.add(malla(new THREE.BoxGeometry(0.02, 0.003, 0.18), mat('#5fae4a'), [Math.cos(a) * 0.06, 0.1 + i * 0.05, Math.sin(a) * 0.06], [0.5, -a, 0]));
    else hojas.add(malla(hoja, mat(i % 2 ? '#7cc36b' : '#5fae4a'), [Math.cos(a) * 0.035, 0.03, Math.sin(a) * 0.035], [0, -a, 0.6], [1.3, 0.35, 0.8]));
  }
  if (tipo === 'maiz') hojas.add(malla(new THREE.CapsuleGeometry(0.018, 0.06, 4, 8), mat('#ffd54f'), [0.03, 0.22, 0], [0, 0, 0.3]));
  if (tipo === 'flor') {
    for (let i = 0; i < 6; i++) hojas.add(malla(new THREE.SphereGeometry(0.02, 8, 6), mat('#ff8fd1'), [Math.cos(i) * 0.025, 0.16, Math.sin(i) * 0.025], [0, 0, 0], [1, 0.4, 1]));
    hojas.add(malla(new THREE.SphereGeometry(0.014, 8, 6), mat('#ffd54f'), [0, 0.165, 0]));
  }
  fusionar(hojas);
  g.add(hojas);
  const alto = tipo === 'maiz' ? 0.32 : tipo === 'flor' ? 0.16 : 0.04;
  g.userData.crecer = (k) => {
    tallos.scale.set(1, Math.max(0.001, k * (alto + 0.02)), 1);
    hojas.scale.setScalar(Math.max(0.001, k));
    hojas.position.y = tipo === 'lechuga' ? 0 : 0;
  };
  g.userData.crecer(0);
  return g;
}

/** Regadera azul que se inclina para verter agua. */
export function regadera() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.add(malla(new THREE.CylinderGeometry(0.07, 0.08, 0.13, 20), mat('#2f8be6'), [0, 0, 0]));
  cuerpo.add(malla(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 10), mat('#2f8be6'), [0.12, 0.05, 0], [0, 0, -1.0]));
  cuerpo.add(malla(new THREE.CylinderGeometry(0.03, 0.02, 0.02, 12), mat('#1d6fc0'), [0.205, 0.105, 0], [0, 0, -1.0]));
  cuerpo.add(malla(new THREE.TorusGeometry(0.05, 0.01, 6, 16, Math.PI), mat('#1d6fc0'), [-0.03, 0.07, 0], [0, 0, 0.3]));
  fusionar(cuerpo);
  g.add(cuerpo);
  return g;
}

/**
 * Maceta de experimento sobre un vaso: se le vierte agua y deja pasar más o
 * menos según el suelo. api.paso(dt) se llama cada cuadro; api.verter(seg) empieza.
 */
export function macetaExperimento(tipo) {
  const g = new THREE.Group();
  const drenaje = { arena: 1.4, franco: 0.45, arcilla: 0.012 }[tipo];
  const retiene = { arena: 0.0, franco: 1.6, arcilla: 0.0 }[tipo];
  // Soporte, vaso y maceta transparente
  const fijo = new THREE.Group();
  fijo.add(malla(new THREE.CylinderGeometry(0.075, 0.065, 0.16, 24, 1, true), mat('#dff4ff', { opacidad: 0.35, lados: THREE.DoubleSide }), [0, 0.08, 0]));
  fijo.add(malla(new THREE.CylinderGeometry(0.065, 0.065, 0.004, 24), mat('#dff4ff', { opacidad: 0.4 }), [0, 0.002, 0]));
  for (const lado of [-1, 1]) fijo.add(malla(new THREE.BoxGeometry(0.012, 0.36, 0.012), mat('#8d6e63'), [lado * 0.11, 0.18, 0]));
  fijo.add(malla(new THREE.TorusGeometry(0.1, 0.008, 6, 24), mat('#8d6e63'), [0, 0.25, 0], [Math.PI / 2, 0, 0]));
  fijo.add(malla(new THREE.CylinderGeometry(0.1, 0.07, 0.17, 24, 1, true), mat('#dff4ff', { opacidad: 0.3, lados: THREE.DoubleSide }), [0, 0.335, 0]));
  fijo.add(malla(new THREE.CylinderGeometry(0.07, 0.07, 0.005, 20), mat('#8d6e63'), [0, 0.252, 0]));
  fijo.add(malla(new THREE.CylinderGeometry(0.093, 0.072, 0.12, 22), mat(COLOR_SUELO[tipo]), [0, 0.315, 0]));
  g.add(fusionar(fijo));
  const etiqueta = new PanelLienzo(0.2, 0.07, (ctx, w, h) => {
    ctx.fillStyle = COLOR_SUELO[tipo];
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 26);
    ctx.fill();
    escribir(ctx, { arena: 'SAND', arcilla: 'CLAY', franco: 'LOAM' }[tipo], w / 2, h / 2, { tam: 46, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
  });
  etiqueta.position.set(0, 0.47, 0.0);
  g.add(etiqueta);
  // Agua: charco arriba, agua en el vaso y gotas que caen
  const charco = malla(new THREE.CylinderGeometry(0.094, 0.094, 1, 22), mat('#4fb3ff', { opacidad: 0.75 }), [0, 0.376, 0]);
  charco.scale.y = 0.001;
  charco.visible = false;
  const vaso = malla(new THREE.CylinderGeometry(0.06, 0.06, 1, 20), mat('#4fb3ff', { opacidad: 0.8 }), [0, 0.005, 0]);
  vaso.scale.y = 0.001;
  vaso.visible = false;
  g.add(charco, vaso);
  const nGotas = 24;
  const gotas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: '#4fb3ff' }), nGotas);
  gotas.frustumCulled = false;
  g.add(gotas);
  const listaGotas = Array.from({ length: nGotas }, () => ({ y: -1, v: 0 }));
  const chorro = malla(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), mat('#4fb3ff', { opacidad: 0.8 }), [0, 0.5, 0]);
  chorro.visible = false;
  g.add(chorro);
  const reg = regadera();
  reg.position.set(-0.2, 0.62, 0);
  reg.visible = false; // aparece solo al verter (no tapa nada antes)
  g.add(reg);

  const estado = { entrada: 0, arriba: 0, retenido: 0, vaso: 0, acumulado: 0 };
  const m = new THREE.Matrix4();
  return {
    grupo: g,
    etiqueta,
    estado,
    verter(seg = 2) {
      reg.visible = true;
      reg.rotation.z = 0.4;
      estado.entrada = seg + 0.5;
    },
    paso(dt) {
      // Regadera: se inclina mientras vierte
      const vertiendo = estado.entrada > 0;
      reg.rotation.z += ((vertiendo ? -0.7 : 0) - reg.rotation.z) * Math.min(1, dt * 5);
      chorro.visible = vertiendo && reg.rotation.z < -0.4;
      chorro.position.set(-0.05, 0.47, 0);
      if (vertiendo) {
        estado.entrada -= dt;
        estado.arriba += dt * 0.5;
      }
      // El agua entra al suelo; parte se queda (retención) y parte drena
      const capacidad = retiene * 0.5;
      const absorbe = Math.min(estado.arriba, dt * 0.6, Math.max(0, capacidad - estado.retenido));
      estado.arriba -= absorbe;
      estado.retenido += absorbe;
      const sale = Math.min(estado.arriba, dt * drenaje * 0.5);
      estado.arriba -= sale;
      estado.vaso = Math.min(1, estado.vaso + sale);
      charco.scale.y = Math.max(0.001, Math.min(0.05, estado.arriba * 0.08));
      charco.visible = estado.arriba > 0.004;
      vaso.scale.y = Math.max(0.001, estado.vaso * 0.15);
      vaso.visible = estado.vaso > 0.002;
      vaso.position.y = 0.005 + vaso.scale.y / 2;
      // Gotas: cuántas salen depende de cuánta agua drena
      estado.acumulado += sale * 60;
      for (const d of listaGotas) {
        if (d.y < 0 && estado.acumulado >= 1) {
          estado.acumulado -= 1;
          d.y = 0.25;
          d.v = 0;
        }
        if (d.y >= 0) {
          d.v += 9.8 * dt * 0.4;
          d.y -= d.v * dt;
          if (d.y < 0.005 + vaso.scale.y) d.y = -1;
        }
      }
      listaGotas.forEach((d, i) => {
        m.makeTranslation((i % 3 - 1) * 0.01, d.y < 0 ? -10 : d.y, 0);
        gotas.setMatrixAt(i, m);
      });
      gotas.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Terrario con túneles de gusanos y hormigas (capítulo 9). */
export function terrario() {
  const g = new THREE.Group();
  const [w, h, d] = [0.9, 0.5, 0.16];
  const fijo = new THREE.Group();
  fijo.add(malla(new THREE.BoxGeometry(w, h * 0.78, d * 0.9), mat('#4a2f1b'), [0, h * 0.39, 0]));
  fijo.add(malla(new THREE.BoxGeometry(w, 0.03, d * 0.9), mat('#3b2416'), [0, h * 0.78, 0]));
  fijo.add(malla(new THREE.BoxGeometry(w + 0.02, 0.02, d + 0.02), mat('#8d6e63'), [0, 0.01, 0]));
  // Piedritas
  const piedra = new THREE.DodecahedronGeometry(0.018, 0);
  for (let i = 0; i < 30; i++) fijo.add(malla(piedra, mat(i % 2 ? '#9aa3ad' : '#c49a72'), [azar(-w / 2 + 0.03, w / 2 - 0.03), azar(0.03, h * 0.7), d * 0.45], [i, i, 0], azar(0.6, 1.3)));
  // Hojas encima
  for (let i = 0; i < 8; i++) fijo.add(malla(new THREE.SphereGeometry(0.03, 8, 6), mat(['#a0522d', '#c98a2b', '#6d4c41'][i % 3]), [azar(-0.4, 0.4), h * 0.8, azar(-0.05, 0.05)], [0, i, 0], [1.4, 0.15, 0.8]));
  g.add(fusionar(fijo));
  // Vidrio
  g.add(malla(new THREE.BoxGeometry(w + 0.02, h, d + 0.02), mat('#dff4ff', { opacidad: 0.18 }), [0, h / 2, 0]));
  // Túneles (curvas) con gusanos que los recorren
  const tuneles = [
    new THREE.CatmullRomCurve3([V(-0.38, 0.36, 0.075), V(-0.2, 0.25, 0.075), V(-0.05, 0.3, 0.075), V(0.1, 0.15, 0.075), V(0.3, 0.2, 0.075)]),
    new THREE.CatmullRomCurve3([V(0.35, 0.37, 0.075), V(0.2, 0.32, 0.075), V(0.05, 0.2, 0.075), V(-0.15, 0.1, 0.075), V(-0.35, 0.12, 0.075)]),
  ];
  for (const c of tuneles) g.add(malla(new THREE.TubeGeometry(c, 40, 0.022, 6), mat('#24160c')));
  const gusanos = tuneles.map((c, i) => {
    const gu = gusanito(i ? '#ff9fb1' : '#f4899c', 8, 0.018);
    g.add(gu);
    return { gu, c, fase: i * 0.5 };
  });
  // Raíces de una plantita encima
  const planta = plantita('flor');
  planta.position.set(0.25, h * 0.8, 0);
  planta.userData.crecer(1);
  g.add(planta);
  for (let i = 0; i < 3; i++) g.add(raiz([V(0.25, h * 0.8, 0.07), V(0.25 + (i - 1) * 0.04, h * 0.6, 0.075), V(0.25 + (i - 1) * 0.08, h * 0.45, 0.075)], 0.004, '#e8d9b0'));
  g.children.filter((c) => c.userData.crecer && c !== planta).forEach((r) => r.userData.crecer(1));
  // Hormigas que caminan sobre la tierra
  const hormigas = [0, 1, 2].map((i) => {
    const hm = new THREE.Group();
    [[0, 0.008], [0.012, 0.006], [-0.013, 0.007]].forEach(([x, r]) => hm.add(malla(new THREE.SphereGeometry(r, 8, 6), mat('#2b2b33'), [x, 0, 0])));
    fusionar(hm);
    g.add(hm);
    return { hm, fase: i * 2.1 };
  });
  return {
    grupo: g,
    animar(t) {
      for (const { gu, c, fase } of gusanos) {
        const k = ((t * 0.06 + fase) % 1);
        const k2 = k < 0.5 ? k * 2 : 2 - k * 2;
        const p = c.getPoint(k2);
        const p2 = c.getPoint(Math.min(1, k2 + 0.01));
        gu.position.copy(p);
        gu.position.z += 0.024; // delante del túnel, pegado al vidrio
        gu.rotation.z = Math.atan2(p2.y - p.y, p2.x - p.x) + (k < 0.5 ? 0 : Math.PI);
      }
      for (const { hm, fase } of hormigas) {
        const x = Math.sin(t * 0.4 + fase) * 0.4;
        hm.position.set(x, h * 0.8 + 0.006, Math.cos(t * 0.5 + fase) * 0.05);
        hm.rotation.y = Math.cos(t * 0.4 + fase) > 0 ? 0 : Math.PI;
      }
    },
  };
}

/** Basura para recoger (capítulo 9). */
export function basura(tipo) {
  const g = new THREE.Group();
  if (tipo === 'botella') {
    g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 14), mat('#8fd3ff', { opacidad: 0.7 }), [0, 0.04, 0], [0, 0, Math.PI / 2]));
    g.add(malla(new THREE.CylinderGeometry(0.015, 0.02, 0.04, 10), mat('#2dbe78'), [0.11, 0.04, 0], [0, 0, Math.PI / 2]));
  } else if (tipo === 'lata') {
    g.add(malla(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), mat('#e5484d'), [0, 0.035, 0], [0.2, 0, Math.PI / 2]));
    g.add(malla(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16), mat('#cfd8e3'), [0.0, 0.035, 0], [0.2, 0, Math.PI / 2]));
  } else if (tipo === 'papel') {
    g.add(malla(new THREE.IcosahedronGeometry(0.05, 0), mat('#f4f7fb'), [0, 0.045, 0]));
  } else {
    g.add(malla(new RoundedBoxGeometry(0.16, 0.025, 0.11, 2, 0.01), mat('#ffc23c'), [0, 0.015, 0], [0, 0.4, 0.1]));
    g.add(malla(new THREE.BoxGeometry(0.06, 0.002, 0.05), mat('#e5484d'), [0, 0.03, 0], [0, 0.4, 0.1]));
  }
  return fusionar(g);
}

/** Árbol en un bloque de tierra cortado (se ven las raíces). crecer(k) de 0 a 1. */
export function arbolConRaices() {
  const g = new THREE.Group();
  const bloque = new THREE.Group();
  bloque.add(malla(new THREE.BoxGeometry(0.5, 0.25, 0.3), mat('#5a3b22'), [0, 0.125, 0]));
  bloque.add(malla(new THREE.BoxGeometry(0.5, 0.03, 0.3), mat('#5fae4a'), [0, 0.26, 0]));
  g.add(fusionar(bloque));
  const tronco = malla(new THREE.CylinderGeometry(0.02, 0.03, 1, 10), mat('#8d6e63'), [0, 0.27, 0]);
  tronco.geometry.translate(0, 0.5, 0);
  const copa = new THREE.Group();
  [[0, 0, 0, 0.13], [0.09, -0.03, 0, 0.09], [-0.09, -0.02, 0.02, 0.1], [0, 0.07, 0, 0.09]].forEach(([x, y, z, r], i) => copa.add(malla(new THREE.SphereGeometry(r, 14, 10), mat(i % 2 ? '#43a047' : '#66bb6a'), [x, y, z])));
  fusionar(copa);
  g.add(tronco, copa);
  const raices = [0, 1, 2, 3].map((i) => raiz([V(0, 0.26, 0.151), V((i - 1.5) * 0.06, 0.16, 0.152), V((i - 1.5) * 0.13, 0.05, 0.152)], 0.008, '#e8d9b0'));
  raices.forEach((r) => g.add(r));
  g.userData.crecer = (k) => {
    tronco.scale.set(1, Math.max(0.001, k * 0.4), 1);
    copa.position.y = 0.27 + k * 0.4;
    copa.scale.setScalar(Math.max(0.001, k));
    raices.forEach((r) => r.userData.crecer(k));
  };
  g.userData.crecer(0);
  return g;
}

/** Compostera con cáscaras (capítulo 9). humus(k) la llena de tierra oscura. */
export function compostera() {
  const g = new THREE.Group();
  const caja = new THREE.Group();
  caja.add(malla(new THREE.BoxGeometry(0.4, 0.02, 0.3), mat('#6d4c41'), [0, 0.01, 0]));
  for (const [w, d, x, z] of [[0.4, 0.02, 0, 0.14], [0.4, 0.02, 0, -0.14], [0.02, 0.3, 0.19, 0], [0.02, 0.3, -0.19, 0]]) for (let i = 0; i < 3; i++) caja.add(malla(new THREE.BoxGeometry(w, 0.06, d), mat(i % 2 ? '#8d6e63' : '#a1887f'), [x, 0.05 + i * 0.075, z]));
  g.add(fusionar(caja));
  const tierra = malla(new THREE.BoxGeometry(0.36, 1, 0.26), mat('#3b2416'), [0, 0.02, 0]);
  tierra.scale.y = 0.001;
  g.add(tierra);
  g.userData.humus = (k) => {
    tierra.scale.y = Math.max(0.001, k * 0.18);
    tierra.position.y = 0.02 + tierra.scale.y / 2;
  };
  return g;
}

export function cascara(tipo) {
  const g = new THREE.Group();
  if (tipo === 'banano') {
    for (let i = 0; i < 3; i++) g.add(malla(new THREE.CapsuleGeometry(0.012, 0.07, 4, 8), mat('#ffd54f'), [0, 0, 0], [0, (i * Math.PI * 2) / 3, 0.9]));
  } else if (tipo === 'manzana') {
    g.add(malla(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 10), mat('#f3e5c0')));
    g.add(malla(new THREE.SphereGeometry(0.03, 10, 8), mat('#e53935'), [0, 0.035, 0], [0, 0, 0], [1, 0.4, 1]));
    g.add(malla(new THREE.SphereGeometry(0.03, 10, 8), mat('#e53935'), [0, -0.035, 0], [0, 0, 0], [1, 0.4, 1]));
  } else {
    g.add(malla(new THREE.SphereGeometry(0.035, 8, 6), mat('#c98a2b'), [0, 0, 0], [0, 0, 0], [1.4, 0.15, 0.8]));
  }
  return fusionar(g);
}

// ── Escenarios ──────────────────────────────────────────────────────────────

function piso(color1, color2, repetir = 20, motas = 600) {
  return texturaLienzo(256, 256, (x, w) => {
    x.fillStyle = color1;
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < motas; i++) {
      x.fillStyle = i % 3 ? color2 : 'rgba(255,255,255,0.12)';
      x.fillRect((i * 97) % w, (i * 57 + i * i) % w, 2 + (i % 3), 2 + (i % 2));
    }
  }, [repetir, repetir]);
}

function sol(g, x, y, z) {
  g.add(malla(new THREE.SphereGeometry(1.4, 24, 16), mat('#fff2b0', { tipo: 'basica' }), [x, y, z]));
  g.add(malla(new THREE.SphereGeometry(2.0, 24, 16), mat('#fff2b0', { tipo: 'basica', opacidad: 0.25 }), [x, y, z]));
}

function nubes(g) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r = 26 + (i % 3) * 4;
    for (let j = 0; j < 4; j++) g.add(malla(geo, mat('#ffffff', { tipo: 'basica' }), [Math.cos(a) * r + j * 1.4 - 2, 13 + (i % 3) * 2 + Math.sin(j) * 0.5, Math.sin(a) * r], [0, -a, 0], [1.6 + (j % 2), 1, 1.2]));
  }
}

function pino(g, x, z, alto = 3) {
  g.add(malla(new THREE.CylinderGeometry(0.12, 0.18, alto * 0.3, 8), mat('#6d4c41'), [x, alto * 0.15, z]));
  for (let i = 0; i < 3; i++) g.add(malla(new THREE.ConeGeometry(alto * (0.32 - i * 0.07), alto * 0.4, 10), mat(i % 2 ? '#2e7d32' : '#388e3c'), [x, alto * (0.38 + i * 0.22), z]));
}

function palmera(g, x, z, inclinacion = 0.2) {
  const curva = new THREE.QuadraticBezierCurve3(V(x, 0, z), V(x + inclinacion * 2, 2, z), V(x + inclinacion * 4, 4, z));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 12, 0.13, 8), mat('#9c7a52')));
  const cima = curva.getPoint(1);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(malla(new THREE.BoxGeometry(1.8, 0.03, 0.35), mat(i % 2 ? '#43a047' : '#2e7d32'), [cima.x + Math.cos(a) * 0.8, cima.y - 0.25, cima.z + Math.sin(a) * 0.8], [0, -a, -0.35]));
  }
  for (let i = 0; i < 3; i++) g.add(malla(new THREE.SphereGeometry(0.13, 10, 8), mat('#6d4c41'), [cima.x + Math.cos(i * 2) * 0.18, cima.y - 0.2, cima.z + Math.sin(i * 2) * 0.18]));
}

function cactus(g, x, z, alto = 1.4) {
  g.add(malla(new THREE.CapsuleGeometry(0.16, alto, 6, 12), mat('#4caf50'), [x, alto / 2 + 0.16, z]));
  g.add(malla(new THREE.CapsuleGeometry(0.09, 0.4, 6, 10), mat('#4caf50'), [x + 0.25, alto * 0.6, z], [0, 0, -0.1]));
  g.add(malla(new THREE.CapsuleGeometry(0.08, 0.3, 6, 10), mat('#4caf50'), [x - 0.24, alto * 0.75, z], [0, 0, 0.1]));
  g.add(malla(new THREE.SphereGeometry(0.06, 8, 6), mat('#ff8fd1'), [x, alto + 0.3, z]));
}

/** El aula: en realidad aumentada no se dibuja nada (se ve el salón real). */
export function escenarioAula(d) {
  const g = new THREE.Group();
  if (!d.enAR) {
    // Vista previa en el PC: un aula gris que imita el "passthrough" de las Quest 2.
    habitacion(g, { ancho: 8, fondo: 8, alto: 3, suelo: mat('#8f8f8f', { tipo: 'lambert' }), pared: mat('#b5b5b5', { tipo: 'lambert' }), techo: mat('#cfcfcf', { tipo: 'basica' }) });
    g.add(malla(new THREE.BoxGeometry(2.6, 1.1, 0.05), mat('#e8e8e8'), [0, 1.5, -3.95]));
    for (const [x, z] of [[-2.2, -1.5], [2.2, -1.5], [-2.2, 1], [2.2, 1], [0, 2.6]]) {
      g.add(malla(new THREE.BoxGeometry(1, 0.05, 0.6), mat('#9a9a9a'), [x, 0.72, z]));
      for (const sx of [-1, 1]) g.add(malla(new THREE.BoxGeometry(0.05, 0.7, 0.5), mat('#7a7a7a'), [x + sx * 0.45, 0.35, z]));
    }
    for (const z of [-1.5, 1]) g.add(malla(new THREE.PlaneGeometry(1.4, 1), mat('#e0e0e0', { tipo: 'basica' }), [-3.97, 1.6, z], [0, Math.PI / 2, 0]));
    fusionar(g);
  }
  return { grupo: g, luz: [0xffffff, 0x9a9a9a, 2.4], fondo: d.enAR ? null : '#b5b5b5' };
}

export function escenarioMontana() {
  const g = new THREE.Group();
  g.add(cielo('#6fbcf5', '#e9f6ff'));
  g.add(malla(new THREE.CircleGeometry(40, 48), matTextura(piso('#7cb35a', 'rgba(60,110,40,0.5)', 30)), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  g.add(malla(new THREE.CircleGeometry(3.2, 40), matTextura(piso('#9c8a6a', 'rgba(80,60,40,0.4)', 6)), [0, 0.003, -1.6], [-Math.PI / 2, 0, 0]));
  volcanes(g, [[-14, -22, 14, 10], [6, -26, 18, 12], [22, -12, 11, 9], [-24, 6, 10, 9], [16, 18, 9, 8]]);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.2;
    const r = 7 + (i % 4) * 2.5;
    pino(g, Math.cos(a) * r, Math.sin(a) * r, 2.5 + (i % 3));
  }
  const piedra = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 20; i++) {
    const a = i * 2.4;
    const r = 2.5 + (i % 5) * 0.9;
    g.add(malla(piedra, mat(i % 2 ? '#9aa3ad' : '#7d8794'), [Math.cos(a) * r, 0.05, Math.sin(a) * r], [i, i, 0], azar(0.08, 0.3)));
  }
  nubes(g);
  return { grupo: fusionar(g), luz: [0xffffff, 0x6f8a55, 2.6], fondo: '#bfe6ff', niebla: ['#d5efff', 20, 70] };
}

export function escenarioVacio() {
  const g = new THREE.Group();
  g.add(malla(new THREE.SphereGeometry(30, 24, 16), mat('#140c07', { tipo: 'basica', lados: THREE.BackSide })));
  return { grupo: g, luz: [0xffe6c8, 0x3a2a1a, 2.2], fondo: '#140c07' };
}

export function escenarioPlaya() {
  const g = new THREE.Group();
  g.add(cielo('#3fa9f5', '#e6f6ff'));
  g.add(malla(new THREE.CircleGeometry(40, 48), matTextura(piso('#f0d39a', 'rgba(190,150,90,0.45)', 40, 900)), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  sol(g, 12, 16, -24);
  palmera(g, -3.5, -3.5, 0.25);
  palmera(g, 4, -2.5, -0.3);
  palmera(g, -4.5, 2.5, 0.2);
  palmera(g, 5, 3.5, -0.2);
  // Castillo de arena y conchas
  const c = new THREE.Group();
  c.add(malla(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 16), mat('#e5c07a'), [0, 0.15, 0]));
  for (const [x, z] of [[-0.3, 0], [0.3, 0], [0, -0.3]]) c.add(malla(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 12), mat('#e5c07a'), [x, 0.2, z]));
  c.position.set(1.8, 0, -2.2);
  g.add(c);
  for (let i = 0; i < 12; i++) g.add(malla(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(['#ffc1d6', '#ffffff', '#ffd59e'][i % 3]), [azar(-3, 3), 0, azar(-3.5, 2)], [0, i, 0], [1, 0.5, 1.2]));
  cactus(g, 2.6, 0.6, 1.0);
  cactus(g, 3.2, 1.4, 0.7);
  nubes(g);
  const fijo = fusionar(g);
  // Mar con olas (animado)
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(80, 30, 60, 20), new THREE.MeshLambertMaterial({ color: '#1e88e5' }));
  mar.rotation.x = -Math.PI / 2;
  mar.position.set(0, 0.02, -21);
  const espuma = malla(new THREE.PlaneGeometry(80, 0.6), mat('#ffffff', { tipo: 'basica', opacidad: 0.85 }), [0, 0.03, -6.1], [-Math.PI / 2, 0, 0]);
  const grupo = new THREE.Group();
  grupo.add(fijo, mar, espuma);
  const cangrejo = new THREE.Group();
  cangrejo.add(malla(new THREE.SphereGeometry(0.12, 14, 10), mat('#e5484d'), [0, 0.08, 0], [0, 0, 0], [1.3, 0.6, 1]));
  for (const l of [-1, 1]) {
    cangrejo.add(malla(new THREE.SphereGeometry(0.05, 10, 8), mat('#e5484d'), [l * 0.2, 0.1, 0.06]));
    cangrejo.add(malla(new THREE.SphereGeometry(0.025, 8, 6), mat('#ffffff', { tipo: 'basica' }), [l * 0.05, 0.18, 0.08]));
  }
  fusionar(cangrejo);
  grupo.add(cangrejo);
  const pos = mar.geometry.attributes.position;
  const base = Float32Array.from(pos.array);
  return {
    grupo,
    luz: [0xffffff, 0xc9a86a, 2.7],
    fondo: '#bfe6ff',
    niebla: ['#d8f0ff', 25, 80],
    animar(_dt, t) {
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(base[i * 3] * 0.4 + t * 1.5) * 0.08 + Math.sin(base[i * 3 + 1] * 0.6 + t) * 0.06);
      pos.needsUpdate = true;
      espuma.position.z = -6.1 + Math.sin(t * 0.8) * 0.25;
      cangrejo.position.set(-1.2 + Math.sin(t * 0.3) * 1.2, 0, -2.5);
      cangrejo.rotation.y = Math.sin(t * 6) * 0.1;
    },
  };
}

export function escenarioRio() {
  const g = new THREE.Group();
  g.add(cielo('#6fbcf5', '#eef7ff'));
  const grietas = texturaLienzo(256, 256, (x, w) => {
    x.fillStyle = '#b5653d';
    x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(90, 40, 20, 0.5)';
    x.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      x.beginPath();
      x.moveTo((i * 53) % w, (i * 31) % w);
      x.lineTo(((i * 53) % w) + 40, ((i * 31) % w) + 25);
      x.lineTo(((i * 53) % w) + 30, ((i * 31) % w) + 70);
      x.stroke();
    }
  }, [16, 16]);
  g.add(malla(new THREE.CircleGeometry(40, 48), matTextura(grietas), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  // Arrozal al fondo (franjas verdes sobre agua)
  g.add(malla(new THREE.PlaneGeometry(30, 10), mat('#7fb7d6', { tipo: 'lambert' }), [0, 0.01, 12], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 18; i++) g.add(malla(new THREE.BoxGeometry(28, 0.25, 0.15), mat('#7cc36b'), [0, 0.12, 7.6 + i * 0.5]));
  // Casa de ladrillo (adobe) y montañas
  g.add(malla(new THREE.BoxGeometry(3, 2.2, 2.4), mat('#c0714a'), [7, 1.1, -5]));
  g.add(malla(new THREE.ConeGeometry(2.4, 1.2, 4), mat('#8d3b22'), [7, 2.8, -5], [0, Math.PI / 4, 0]));
  g.add(malla(new THREE.PlaneGeometry(0.8, 1.4), mat('#5d4037'), [5.49, 0.7, -5], [0, -Math.PI / 2, 0]));
  volcanes(g, [[-20, -28, 13, 10], [10, -30, 16, 11], [28, -8, 10, 9]]);
  // Pilas de ladrillos y ollas
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) g.add(malla(new THREE.BoxGeometry(0.4, 0.15, 0.2), mat(j % 2 ? '#c0714a' : '#b5653d'), [2.6 + j * 0.42 + i * 0.21, 0.08 + i * 0.16, -2.6]));
  for (const [x, z, s] of [[-2.2, -2.3, 1.6], [-1.7, -2.6, 1.2], [-2.6, -2.8, 2]]) {
    const o = ollaBarro(s);
    o.position.set(x, 0, z);
    g.add(o);
  }
  // Charcos
  for (const [x, z, s] of [[-1.2, -1.6, 0.6], [1.0, -1.2, 0.4], [0.2, 1.8, 0.5]]) g.add(malla(new THREE.CircleGeometry(s, 24), mat('#8fb9d6', { tipo: 'lambert' }), [x, 0.006, z], [-Math.PI / 2, 0, 0], [1, 0.7, 1]));
  // Juncos a la orilla del río
  for (let i = 0; i < 26; i++) g.add(malla(new THREE.ConeGeometry(0.03, azar(0.6, 1.1), 5), mat(i % 2 ? '#6d9b3a' : '#88b04b'), [-4.4 + azar(-0.3, 0.3), 0.4, -6 + i * 0.5], [azar(-0.15, 0.15), 0, azar(-0.15, 0.15)]));
  nubes(g);
  const fijo = fusionar(g);
  const tex = texturaLienzo(64, 256, (x, w, h) => {
    x.fillStyle = '#3d8fd1';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 20; i++) x.fillRect((i * 23) % w, (i * 47) % h, 14, 3);
  }, [3, 12]);
  const rio = malla(new THREE.PlaneGeometry(5, 60), new THREE.MeshLambertMaterial({ map: tex }), [-7, 0.01, 0], [-Math.PI / 2, 0, 0]);
  const grupo = new THREE.Group();
  grupo.add(fijo, rio);
  return {
    grupo,
    luz: [0xffffff, 0x9c6a4a, 2.6],
    fondo: '#bfe6ff',
    niebla: ['#dcefff', 20, 70],
    animar(dt) {
      tex.offset.y -= dt * 0.15;
    },
  };
}

export function escenarioGranja() {
  const g = new THREE.Group();
  g.add(cielo('#5fb4f5', '#eaf7ff'));
  g.add(malla(new THREE.CircleGeometry(40, 48), mat('#79b356', { tipo: 'lambert' }), [0, -0.01, 0], [-Math.PI / 2, 0, 0]));
  // Campo de loam con surcos
  g.add(malla(new THREE.PlaneGeometry(10, 12), matTextura(piso('#4a3020', 'rgba(30,18,10,0.5)', 10, 500)), [0, 0.002, -2], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 9; i++) g.add(malla(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 8, 1, false, Math.PI / 2, Math.PI), mat('#5a3b22'), [-4 + i * 1.0, 0.0, -4.3], [Math.PI / 2, 0, 0]));
  // Cultivos: maíz al fondo y lechugas
  for (let f = 0; f < 4; f++)
    for (let i = 0; i < 9; i++) {
      if (f >= 2 && Math.abs(-4 + i * 1.0) < 1.6) continue;
      const x = -4 + i * 1.0;
      const z = -6 + f * 1.2;
      if (f < 2) {
        g.add(malla(new THREE.CylinderGeometry(0.025, 0.035, 1.8, 6), mat('#6d9b3a'), [x, 0.9, z]));
        for (let k = 0; k < 4; k++) g.add(malla(new THREE.BoxGeometry(0.06, 0.01, 0.7), mat('#5fae4a'), [x + Math.cos(k * 1.7) * 0.2, 0.5 + k * 0.3, z + Math.sin(k * 1.7) * 0.2], [0.6, k * 1.7, 0]));
        g.add(malla(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), mat('#ffd54f'), [x + 0.08, 1.2, z], [0, 0, 0.3]));
      } else {
        g.add(malla(new THREE.SphereGeometry(0.2, 12, 8), mat(i % 2 ? '#7cc36b' : '#5fae4a'), [x, 0.12, z], [0, 0, 0], [1, 0.6, 1]));
      }
    }
  // Casa con techo de teja, cerca y volcán nevado (como el Cotopaxi)
  g.add(malla(new THREE.BoxGeometry(3, 2, 2.5), mat('#f3f0e6'), [-6.5, 1, -7]));
  g.add(malla(new THREE.ConeGeometry(2.3, 1.2, 4), mat('#b5533c'), [-6.5, 2.6, -7], [0, Math.PI / 4, 0]));
  g.add(malla(new THREE.PlaneGeometry(0.8, 1.3), mat('#5d4037'), [-6.5, 0.65, -5.74]));
  for (let i = 0; i < 16; i++) {
    g.add(malla(new THREE.BoxGeometry(0.08, 0.9, 0.08), mat('#8d6e63'), [-5 + i * 0.7, 0.45, 3.2]));
  }
  g.add(malla(new THREE.BoxGeometry(11, 0.06, 0.04), mat('#a1887f'), [0.25, 0.7, 3.2]));
  g.add(malla(new THREE.BoxGeometry(11, 0.06, 0.04), mat('#a1887f'), [0.25, 0.4, 3.2]));
  volcanes(g, [[4, -34, 20, 13], [-18, -30, 12, 10], [26, -20, 10, 9]]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(malla(new THREE.SphereGeometry(4 + (i % 3), 16, 10), mat(i % 2 ? '#6aa84f' : '#5c9a42', { tipo: 'lambert' }), [Math.cos(a) * 22, -1.5, Math.sin(a) * 22], [0, 0, 0], [2, 0.6, 1.4]));
  }
  // Espantapájaros
  g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), mat('#8d6e63'), [3.6, 0.9, -3.5]));
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), mat('#8d6e63'), [3.6, 1.4, -3.5], [0, 0, Math.PI / 2]));
  g.add(malla(new THREE.BoxGeometry(0.5, 0.6, 0.2), mat('#e5484d'), [3.6, 1.25, -3.5]));
  g.add(malla(new THREE.SphereGeometry(0.16, 12, 10), mat('#e8cf8f'), [3.6, 1.75, -3.5]));
  g.add(malla(new THREE.ConeGeometry(0.3, 0.25, 12), mat('#c9a36a'), [3.6, 1.95, -3.5]));
  nubes(g);
  return { grupo: fusionar(g), luz: [0xffffff, 0x6f8a55, 2.6], fondo: '#bfe6ff', niebla: ['#d5efff', 22, 75] };
}
