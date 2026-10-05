import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from './materiales.js';
import { objetos, mesa } from './prefabs/objetos.js';
import { diseno } from './prefabs/diseno.js';
import { laboratorio as labPrefabs } from './prefabs/laboratorio.js';
import { darVida } from './vida.js';
import { FUENTE } from '../ui/lienzo.js';

const FUENTE_TIZA = FUENTE;

// Cada entorno es un decorado estático (fusionado en pocas mallas) alrededor
// del usuario, que está en el origen mirando hacia -Z. Todo el contenido
// interactivo va dentro de ~2 m, así el estudiante no necesita caminar.

function texturaLienzo(ancho, alto, dibujar, repetir = null) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  dibujar(c.getContext('2d'), ancho, alto);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repetir);
  }
  t.anisotropy = 4;
  return t;
}

function matTextura(textura, tipo = 'lambert') {
  return tipo === 'basica' ? new THREE.MeshBasicMaterial({ map: textura }) : new THREE.MeshLambertMaterial({ map: textura });
}

function baldosas(color1, color2, n = 8) {
  return texturaLienzo(256, 256, (ctx, w) => {
    const l = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? color1 : color2;
        ctx.fillRect(i * l, j * l, l, l);
      }
  });
}

function azulejos(fondo, junta, n = 8) {
  return texturaLienzo(256, 256, (ctx, w) => {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = junta;
    ctx.lineWidth = 3;
    const l = w / n;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * l, 0);
      ctx.lineTo(i * l, w);
      ctx.moveTo(0, i * l);
      ctx.lineTo(w, i * l);
      ctx.stroke();
    }
  });
}

function madera() {
  return texturaLienzo(256, 256, (ctx, w) => {
    const colores = ['#c89f7a', '#bf946c', '#d2a983', '#c49a72'];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = colores[i % colores.length];
      ctx.fillRect(0, i * 32, w, 32);
      ctx.fillStyle = 'rgba(90, 60, 30, 0.35)';
      ctx.fillRect(0, i * 32, w, 2);
      ctx.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
    }
  });
}

function degradado(arriba, abajo) {
  return texturaLienzo(16, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, arriba);
    g.addColorStop(1, abajo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function cielo(arriba, abajo) {
  const m = new THREE.MeshBasicMaterial({ map: degradado(arriba, abajo), side: THREE.BackSide, fog: false });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), m);
  esfera.userData.noFusionar = true;
  return esfera;
}

/** Suelo, cuatro paredes y techo. Las paredes miran hacia dentro. */
function habitacion(g, { ancho = 9, fondo = 9, alto = 3.2, suelo, pared, techo = mat('#f7f4ee', { tipo: 'basica' }) }) {
  g.add(malla(new THREE.PlaneGeometry(ancho, fondo), suelo, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  g.add(malla(new THREE.PlaneGeometry(ancho, fondo), techo, [0, alto, 0], [Math.PI / 2, 0, 0]));
  g.add(malla(new THREE.PlaneGeometry(ancho, alto), pared, [0, alto / 2, -fondo / 2]));
  g.add(malla(new THREE.PlaneGeometry(ancho, alto), pared, [0, alto / 2, fondo / 2], [0, Math.PI, 0]));
  g.add(malla(new THREE.PlaneGeometry(fondo, alto), pared, [-ancho / 2, alto / 2, 0], [0, Math.PI / 2, 0]));
  g.add(malla(new THREE.PlaneGeometry(fondo, alto), pared, [ancho / 2, alto / 2, 0], [0, -Math.PI / 2, 0]));
}

function ventana(g, x, y, z, ry, ancho = 1.4, alto = 1.1) {
  const marco = mat('#ffffff');
  const vidrio = mat('#a9dcff', { tipo: 'basica' });
  const grupo = new THREE.Group();
  grupo.add(malla(new THREE.PlaneGeometry(ancho, alto), vidrio));
  grupo.add(malla(new THREE.BoxGeometry(ancho + 0.1, 0.06, 0.06), marco, [0, alto / 2, 0]));
  grupo.add(malla(new THREE.BoxGeometry(ancho + 0.1, 0.06, 0.06), marco, [0, -alto / 2, 0]));
  grupo.add(malla(new THREE.BoxGeometry(0.06, alto, 0.06), marco, [ancho / 2, 0, 0]));
  grupo.add(malla(new THREE.BoxGeometry(0.06, alto, 0.06), marco, [-ancho / 2, 0, 0]));
  grupo.add(malla(new THREE.BoxGeometry(0.04, alto, 0.04), marco));
  grupo.position.set(x, y, z);
  grupo.rotation.y = ry;
  g.add(grupo);
}

/** Cartel con texto centrado (letreros de puestos, señales de la planta). */
function cartel(texto, ancho, alto, { fondo = '#23304a', color = '#ffffff', borde = null, tam = 0.58, px = 1400 } = {}) {
  const tex = texturaLienzo(px, Math.round((px * alto) / ancho), (x, w, h) => {
    x.fillStyle = fondo;
    x.beginPath();
    x.roundRect(0, 0, w, h, h * 0.25);
    x.fill();
    if (borde) {
      x.strokeStyle = borde;
      x.lineWidth = h * 0.07;
      x.stroke();
    }
    x.fillStyle = color;
    x.font = `800 ${Math.round(h * tam)}px ${FUENTE_TIZA}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(texto, w / 2, h * 0.54, w * 0.92);
  });
  return malla(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

function rayas(c1, c2, n = 10) {
  return texturaLienzo(256, 64, (x, w, h) => {
    for (let i = 0; i < n; i++) {
      x.fillStyle = i % 2 ? c2 : c1;
      x.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  });
}

/** Borde de toldo con rayas y ondas (la parte de abajo es transparente). */
function feston(c1, c2, n = 10) {
  return texturaLienzo(512, 64, (x, w, h) => {
    const a = w / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = i % 2 ? c2 : c1;
      x.fillRect(i * a, 0, a + 1, h * 0.45);
      x.beginPath();
      x.arc(i * a + a / 2, h * 0.45, a / 2, 0, Math.PI);
      x.fill();
    }
  });
}

/**
 * Puesto de mercado mirando hacia +Z: mesón de 0,9 m, postes, toldo de rayas,
 * panel trasero con repisas y letrero. `decorar(p)` agrega la mercadería.
 */
function puestoMercado(g, { x, z, rot, toldo: [c1, c2], frente, nombre, fondoPanel = '#c49a72', decorar }) {
  const p = new THREE.Group();
  const madera = mat('#a8774f');
  // Toldos del mismo color comparten material (menos draw calls después de fusionar).
  const cache = (g.userData.cacheToldos ??= new Map());
  if (!cache.has(c1 + c2)) {
    cache.set(c1 + c2, [
      new THREE.MeshLambertMaterial({ map: rayas(c1, c2), side: THREE.DoubleSide }),
      new THREE.MeshLambertMaterial({ map: feston(c1, c2), side: THREE.DoubleSide, transparent: true, alphaTest: 0.4 }),
    ]);
  }
  const [lona, borde] = cache.get(c1 + c2);
  p.add(malla(new THREE.BoxGeometry(2.6, 0.85, 0.8), madera, [0, 0.425, 0]));
  p.add(malla(new THREE.PlaneGeometry(2.6, 0.8), mat(frente, { tipo: 'lambert' }), [0, 0.43, 0.401]));
  p.add(malla(new THREE.BoxGeometry(2.7, 0.05, 0.86), mat('#efe3c8'), [0, 0.875, 0]));
  const poste = mat('#6d4c41');
  for (const [px, pz, h] of [[-1.3, -0.95, 2.5], [1.3, -0.95, 2.5], [-1.3, 0.75, 2.15], [1.3, 0.75, 2.15]]) p.add(malla(new THREE.CylinderGeometry(0.035, 0.04, h, 8), poste, [px, h / 2, pz]));
  p.add(malla(new THREE.PlaneGeometry(3.0, Math.hypot(1.7, 0.35)), lona, [0, 2.325, -0.1], [-Math.PI / 2 + Math.atan2(0.35, 1.7), 0, 0]));
  p.add(malla(new THREE.PlaneGeometry(3.0, 0.24), borde, [0, 2.04, 0.76]));
  p.add(malla(new THREE.BoxGeometry(2.6, 1.55, 0.05), mat(fondoPanel), [0, 1.67, -0.98]));
  for (const y of [1.25, 1.65]) p.add(malla(new THREE.BoxGeometry(2.5, 0.03, 0.22), madera, [0, y, -0.86]));
  if (nombre) {
    const letrero = cartel(nombre, 1.9, 0.26, { fondo: c1 === '#ffffff' ? c2 : c1, color: '#ffffff' });
    letrero.position.set(0, 2.22, -0.95);
    p.add(letrero);
  }
  decorar?.(p);
  p.position.set(x, 0, z);
  p.rotation.y = rot;
  g.add(p);
  return p;
}

function piramide(p, x, z, color, { r = 0.045, base = 3 } = {}) {
  const geo = new THREE.SphereGeometry(r, 14, 10);
  for (let nivel = 0; nivel < base; nivel++) {
    const n = base - nivel;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) p.add(malla(geo, mat(color), [x + (i - (n - 1) / 2) * r * 2, 0.9 + r + nivel * r * 1.5, z + (j - (n - 1) / 2) * r * 2]));
  }
}

function racimoBananos(p, x, y, z) {
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, -0.1, 0), new THREE.Vector3(0.02, -0.2, 0));
  const geo = new THREE.TubeGeometry(curva, 8, 0.022, 6);
  for (let i = 0; i < 9; i++) {
    const b = malla(geo, mat(i % 3 ? '#ffd54f' : '#c5d94a'), [x, y - Math.floor(i / 3) * 0.09, z], [0, (i * Math.PI * 2) / 3 + i * 0.3, 0.3]);
    p.add(b);
  }
  p.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), mat('#6d4c41'), [x, y - 0.05, z]));
}

/** Fachada sencilla de una casa de la ciudad (fondo del mercado). */
function edificio(g, angulo, radio, ancho, alto, color) {
  const e = new THREE.Group();
  e.add(malla(new THREE.BoxGeometry(ancho, alto, 1.2), mat(color, { tipo: 'lambert' }), [0, alto / 2, 0]));
  e.add(malla(new THREE.BoxGeometry(ancho + 0.3, 0.25, 1.5), mat('#b5533c'), [0, alto + 0.12, 0]));
  const vidrio = mat('#5e86a8', { tipo: 'basica' });
  const marco = mat('#ffffff');
  for (let piso = 0; piso < Math.floor(alto / 1.8); piso++) {
    for (let i = 0; i < Math.max(1, Math.floor(ancho / 1.4)); i++) {
      const vx = (i - (Math.floor(ancho / 1.4) - 1) / 2) * 1.4;
      const vy = 1.3 + piso * 1.8;
      e.add(malla(new THREE.PlaneGeometry(0.7, 0.95), vidrio, [vx, vy, 0.61]));
      e.add(malla(new THREE.BoxGeometry(0.85, 0.08, 0.2), marco, [vx, vy - 0.52, 0.65]));
      if (piso > 0) e.add(malla(new THREE.BoxGeometry(1.0, 0.06, 0.4), mat('#2e7d5b'), [vx, vy - 0.55, 0.78]));
    }
  }
  e.position.set(Math.sin(angulo) * radio, 0, -Math.cos(angulo) * radio);
  e.lookAt(0, 0, 0);
  g.add(e);
}

function volcanes(g, lista) {
  for (const [x, z, h, r] of lista) {
    g.add(malla(new THREE.ConeGeometry(r, h, 24), mat('#6d8a96', { tipo: 'lambert' }), [x, h / 2, z]));
    g.add(malla(new THREE.ConeGeometry(r * 0.3, h * 0.3, 24), mat('#ffffff', { tipo: 'lambert' }), [x, h * 0.85 + 0.01, z]));
  }
}

// ── Cuerpo humano: cuatro zonas, cada una fusionada por separado ─────────────

const ZONAS_CUERPO = {
  boca: { fondo: '#4a1019', niebla: ['#4a1019', 6, 18], luz: [0xffd6d6, 0x7a2a35, 2.4] },
  estomago: { fondo: '#3a1a0a', niebla: ['#4a2510', 9, 26], luz: [0xfff0c0, 0x7a4a20, 2.3] },
  intestino: { fondo: '#5a1f2a', niebla: ['#6a2a35', 5, 16], luz: [0xffe6ea, 0x8a3a45, 2.3] },
  defensas: { fondo: '#2a050b', niebla: ['#3a0812', 5, 18], luz: [0xffc0c0, 0x5a1020, 2.2] },
};

function zonaBoca() {
  const z = new THREE.Group();
  z.add(malla(new THREE.SphereGeometry(1, 40, 24), mat('#b9505f', { tipo: 'lambert', lados: THREE.BackSide }), [0, 1.2, -0.5], [0, 0, 0], [5.5, 3.2, 6.5]));
  z.add(malla(new THREE.SphereGeometry(1, 40, 20), mat('#e98593'), [0, -0.5, -0.8], [0, 0, 0], [2.6, 0.5, 4.2]));
  z.add(malla(new THREE.BoxGeometry(0.08, 0.02, 5), mat('#d8707f'), [0, 0.005, -1.2]));
  // Arcos dentales: la "U" se cierra detrás del usuario y se abre hacia la garganta.
  const diente = new RoundedBoxGeometry(0.5, 0.7, 0.42, 3, 0.12);
  const muela = new RoundedBoxGeometry(0.62, 0.62, 0.55, 3, 0.14);
  const encia = mat('#e2707f');
  const blanco = mat('#fbf6ea');
  for (let i = 0; i < 14; i++) {
    const a = THREE.MathUtils.degToRad(-105 + (i * 210) / 13);
    const x = Math.sin(a) * 2.7;
    const zz = Math.cos(a) * 3.1 + 0.2;
    const lateral = Math.abs(a) > 1.1;
    for (const [y, rx] of [[2.35, Math.PI], [0.32, 0]]) {
      const d = malla(lateral ? muela : diente, blanco, [x, y, zz], [rx, 0, 0]);
      d.lookAt(0, y, 0);
      z.add(d);
    }
  }
  z.add(malla(new THREE.TorusGeometry(2.95, 0.32, 10, 48, Math.PI * 1.2), encia, [0, 2.75, 0.2], [Math.PI / 2, 0, -0.3]));
  z.add(malla(new THREE.TorusGeometry(2.95, 0.3, 10, 48, Math.PI * 1.2), encia, [0, -0.02, 0.2], [Math.PI / 2, 0, -0.3]));
  // Garganta y úvula al frente; luz de afuera detrás (los labios)
  z.add(malla(new THREE.CircleGeometry(1.5, 32), mat('#2a060c', { tipo: 'basica' }), [0, 1.3, -6.3]));
  z.add(malla(new THREE.CapsuleGeometry(0.22, 0.55, 6, 14), mat('#cf5a6c'), [0, 2.75, -5.4]));
  z.add(malla(new THREE.CircleGeometry(2, 32), mat('#ffe2d0', { tipo: 'basica', opacidad: 0.5 }), [0, 1.3, 5.8], [0, Math.PI, 0]));
  // Hilos de saliva que cuelgan del paladar
  for (const [x, zz, l] of [[-1.6, -2.4, 0.9], [1.3, -3.1, 1.2], [-0.6, -4, 0.7], [2, -1.2, 0.6]]) z.add(malla(new THREE.CylinderGeometry(0.018, 0.03, l, 8), mat('#e8f6ff', { opacidad: 0.55 }), [x, 4.0 - l / 2, zz]));
  return z;
}

function zonaEstomago() {
  const z = new THREE.Group();
  z.add(malla(new THREE.SphereGeometry(1, 40, 24), mat('#cf6f55', { tipo: 'lambert', lados: THREE.BackSide }), [0, 1.5, -1], [0, 0, 0], [7, 4.5, 7]));
  // Pliegues de la pared del estómago
  for (let i = 0; i < 14; i++) {
    const pliegue = malla(new THREE.TorusGeometry(5.6, 0.2, 8, 40, Math.PI * 0.55), mat(i % 2 ? '#b8563f' : '#c46048'));
    pliegue.position.set(0, 1.5, -1);
    pliegue.rotation.set(Math.PI / 2 + Math.sin(i * 1.7) * 0.5, (i / 14) * Math.PI * 2, Math.cos(i) * 0.4);
    z.add(pliegue);
  }
  // Lago de jugo gástrico y "balsa" de comida donde está el usuario
  z.add(malla(new THREE.CircleGeometry(6.6, 64), mat('#9fc433', { tipo: 'basica' }), [0, -0.04, -1], [-Math.PI / 2, 0, 0]));
  for (const r of [1.8, 2.6, 3.5, 4.5, 5.6]) z.add(malla(new THREE.RingGeometry(r - 0.04, r, 64), mat('#d8f06a', { tipo: 'basica', opacidad: 0.5 }), [0, -0.03, -1], [-Math.PI / 2, 0, 0]));
  // Trozos de comida a medio digerir flotando en el ácido
  const trozo = new THREE.DodecahedronGeometry(0.22, 0);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39 + 0.5;
    const r = 2.2 + (i % 4) * 0.9;
    z.add(malla(trozo, mat(['#c48a45', '#8d6e63', '#d9a35e', '#7cb342'][i % 4]), [Math.cos(a) * r, -0.06, Math.sin(a) * r - 1], [i, i * 2, 0], [1 + (i % 3) * 0.4, 0.45, 1]));
  }
  z.add(malla(new THREE.CylinderGeometry(1.15, 1.3, 0.2, 28), mat('#d9a35e'), [0, -0.1, 0]));
  const miga = new THREE.SphereGeometry(0.08, 8, 6);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.1;
    const r = 0.3 + (i % 5) * 0.18;
    z.add(malla(miga, mat(i % 2 ? '#c48a45' : '#e8bb7a'), [Math.cos(a) * r, 0.0, Math.sin(a) * r], [0, 0, 0], [1, 0.35, 1]));
  }
  return z;
}

function zonaIntestino() {
  const z = new THREE.Group();
  z.add(malla(new THREE.CylinderGeometry(4, 4, 40, 40, 1, true), mat('#d98290', { tipo: 'lambert', lados: THREE.BackSide }), [0, 1.4, -4], [Math.PI / 2, 0, 0]));
  z.add(malla(new THREE.PlaneGeometry(8, 40), mat('#c86f7d', { tipo: 'lambert' }), [0, 0, -4], [-Math.PI / 2, 0, 0]));
  // Anillos de músculo (dan sensación de túnel)
  for (let i = 0; i < 9; i++) z.add(malla(new THREE.TorusGeometry(3.85, 0.18, 8, 40), mat('#c26a78'), [0, 1.4, 4 - i * 4.2]));
  return z;
}

function zonaDefensas() {
  const z = new THREE.Group();
  z.add(malla(new THREE.CylinderGeometry(3.4, 3.4, 44, 40, 1, true), mat('#8e1b2b', { tipo: 'lambert', lados: THREE.BackSide }), [0, 1.5, -0.5], [0, 0, Math.PI / 2]));
  // Manchas en la pared del vaso
  const mancha = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996;
    const x = -18 + ((i * 7.3) % 36);
    z.add(malla(mancha, mat(i % 2 ? '#a3283a' : '#7a1424'), [x, 1.5 + Math.sin(a) * 3.3, -0.5 + Math.cos(a) * 3.3], [0, 0, 0], [0.5, 0.25 + (i % 3) * 0.1, 0.5]));
  }
  // Plataforma holográfica bajo el usuario
  z.add(malla(new THREE.CircleGeometry(1.3, 48), mat('#9ff7ff', { tipo: 'basica', opacidad: 0.14 }), [0, 0.01, 0], [-Math.PI / 2, 0, 0]));
  for (const r of [0.7, 1.3]) z.add(malla(new THREE.RingGeometry(r - 0.025, r, 64), mat('#9ff7ff', { tipo: 'basica', opacidad: 0.6 }), [0, 0.012, 0], [-Math.PI / 2, 0, 0]));
  return z;
}

const ENTORNOS = {
  aula(g) {
    const suelo = madera();
    suelo.wrapS = suelo.wrapT = THREE.RepeatWrapping;
    suelo.repeat.set(5, 5);
    habitacion(g, { suelo: matTextura(suelo), pared: mat('#f6ecd9', { tipo: 'lambert' }) });
    // Pizarra
    g.add(malla(new THREE.BoxGeometry(2.9, 1.35, 0.06), mat('#8d6e63'), [0, 1.65, -4.46]));
    g.add(malla(new THREE.PlaneGeometry(2.75, 1.2), mat('#2f5d50', { tipo: 'lambert' }), [0, 1.65, -4.425]));
    g.add(malla(new THREE.BoxGeometry(2.9, 0.05, 0.12), mat('#8d6e63'), [0, 0.96, -4.4]));
    // Ventanas
    for (const z of [-2, 0.5, 3]) ventana(g, -4.47, 1.7, z, Math.PI / 2);
    // Pupitres a los lados y atrás
    for (const [x, z] of [[-2.6, -1.2], [2.6, -1.2], [-2.6, 1.2], [2.6, 1.2], [-1, 2.8], [1, 2.8]]) {
      const p = mesa(0.9, 0.55, 0.7);
      p.position.set(x, 0, z);
      g.add(p);
    }
    // Lámparas
    for (const x of [-2, 2]) for (const z of [-2, 2]) g.add(malla(new THREE.BoxGeometry(1.2, 0.04, 0.3), mat('#ffffff', { tipo: 'basica' }), [x, 3.17, z]));
    // Carteles en la pared lateral
    const colores = ['#ffc23c', '#4f7cff', '#2dbe78', '#ff8fd1'];
    colores.forEach((c, i) => g.add(malla(new THREE.PlaneGeometry(0.6, 0.8), mat(c, { tipo: 'lambert' }), [4.47, 1.7, -2.5 + i * 1.4], [0, -Math.PI / 2, 0])));
    return { fondo: '#f6ecd9', luz: [0xffffff, 0x9c8a74, 2.4] };
  },

  cocina(g) {
    habitacion(g, { ancho: 8, fondo: 8, suelo: matTextura(baldosas('#e9eef5', '#9fb3c8', 8)), pared: mat('#fff1c9', { tipo: 'lambert' }) });
    const tex = g.children[0].material.map;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    // Mesón y alacenas en la pared del fondo
    g.add(malla(new RoundedBoxGeometry(4.2, 0.88, 0.62, 2, 0.02), mat('#5b8def'), [-0.6, 0.44, -3.65]));
    g.add(malla(new THREE.BoxGeometry(4.3, 0.05, 0.68), mat('#eceff4'), [-0.6, 0.905, -3.63]));
    for (let i = 0; i < 4; i++) g.add(malla(new RoundedBoxGeometry(0.98, 0.7, 0.36, 2, 0.02), mat('#7aa5f5'), [-2.18 + i * 1.05, 2.15, -3.8]));
    // Cocina (estufa)
    g.add(malla(new THREE.BoxGeometry(0.7, 0.02, 0.5), mat('#2b2b33'), [0.9, 0.94, -3.62]));
    for (const [x, z] of [[0.75, -3.5], [1.05, -3.5], [0.75, -3.75], [1.05, -3.75]]) g.add(malla(new THREE.TorusGeometry(0.07, 0.012, 6, 20), mat('#555c66'), [x, 0.955, z], [Math.PI / 2, 0, 0]));
    // Fregadero
    g.add(malla(new THREE.BoxGeometry(0.6, 0.02, 0.4), mat('#b8c4d6'), [-1.4, 0.935, -3.6]));
    g.add(malla(new THREE.CylinderGeometry(0.018, 0.02, 0.3, 10), mat('#b8c4d6'), [-1.4, 1.08, -3.85]));
    ventana(g, -1.2, 1.75, -3.97, 0, 1.6, 0.8);
    const refri = objetos.refrigeradora();
    refri.position.set(2.45, 0, -3.55);
    g.add(refri);
    // Frutero sobre el mesón
    g.add(malla(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#8d6e63', { lados: THREE.DoubleSide }), [-2.3, 1.08, -3.6]));
    for (const [x, c] of [[-2.36, '#e53935'], [-2.24, '#ff9f1c'], [-2.3, '#ffd54f']]) g.add(malla(new THREE.SphereGeometry(0.06, 12, 10), mat(c), [x, 1.02, -3.6 + (x + 2.3) * 0.8]));
    // Mesa del comedor a la izquierda
    const m = mesa(1.3, 0.8, 0.74, '#e0b48a');
    m.position.set(-2.9, 0, 0.8);
    g.add(m);
    return { fondo: '#fff1c9', luz: [0xffffff, 0xb0a080, 2.4] };
  },

  microscopico(g, contexto) {
    g.add(cielo('#06203d', '#0f6f7d'));
    g.add(malla(new THREE.CircleGeometry(4.5, 64), mat('#6fe3e8', { tipo: 'basica', opacidad: 0.12 }), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    for (const r of [1.2, 2.2, 3.4, 4.5]) {
      g.add(malla(new THREE.RingGeometry(r - 0.02, r, 96), mat('#9ff7ff', { tipo: 'basica', opacidad: 0.4 }), [0, 0.003, 0], [-Math.PI / 2, 0, 0]));
    }
    // Burbujas flotando (una sola malla instanciada = una sola draw call)
    const n = 140;
    const burbujas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#9ff7ff', transparent: true, opacity: 0.18, depthWrite: false }), n);
    burbujas.userData.noFusionar = true;
    const datos = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 14;
      datos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: Math.random() * 8, s: 0.05 + Math.random() * 0.25, v: 0.05 + Math.random() * 0.15 });
    }
    g.add(burbujas);
    const m = new THREE.Matrix4();
    contexto.cada((dt, t) => {
      datos.forEach((d, i) => {
        d.y = (d.y + d.v * dt) % 9;
        m.makeScale(d.s, d.s, d.s).setPosition(d.x + Math.sin(t * 0.3 + i) * 0.3, d.y - 0.5, d.z);
        burbujas.setMatrixAt(i, m);
      });
      burbujas.instanceMatrix.needsUpdate = true;
    });
    // Células gigantes a lo lejos
    for (const [x, y, z, s, c] of [[-8, 3, -12, 2, '#ff8fd1'], [9, 4, -10, 1.6, '#b56cff'], [-11, 2, 4, 1.8, '#4fc08d'], [10, 2.5, 6, 1.4, '#ffc23c']]) {
      g.add(malla(new THREE.SphereGeometry(s, 24, 16), mat(c, { tipo: 'basica', opacidad: 0.22 }), [x, y, z]));
      g.add(malla(new THREE.SphereGeometry(s * 0.35, 16, 12), mat(c, { tipo: 'basica', opacidad: 0.35 }), [x + s * 0.2, y, z]));
    }
    return { fondo: '#0a3350', niebla: ['#0a3350', 8, 30], luz: [0xcff8ff, 0x21526b, 2.6] };
  },

  lavabo(g) {
    habitacion(g, { ancho: 6, fondo: 6, alto: 2.8, suelo: matTextura(baldosas('#dfe6ee', '#c3cfdb', 8)), pared: matTextura(azulejos('#dff1fb', '#b7d3e6', 10)) });
    for (const m of [g.children[0].material.map, g.children[2].material.map]) {
      m.wrapS = m.wrapT = THREE.RepeatWrapping;
      m.repeat.set(3, 2);
    }
    const lavamanos = objetos.lavamanos();
    lavamanos.position.set(0, 0, -2.65);
    g.add(lavamanos);
    g.add(malla(new RoundedBoxGeometry(0.9, 0.7, 0.03, 2, 0.02), mat('#a7b6c8'), [0, 1.55, -2.97]));
    g.add(malla(new THREE.PlaneGeometry(0.82, 0.62), mat('#e8f6ff', { tipo: 'basica' }), [0, 1.55, -2.95]));
    const jabon = objetos.jabon();
    jabon.position.set(0.24, 0.87, -2.72);
    g.add(jabon);
    // Toallero
    g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8), mat('#b8c4d6'), [1.2, 1.2, -2.95], [0, 0, Math.PI / 2]));
    g.add(malla(new THREE.BoxGeometry(0.5, 0.6, 0.03), mat('#5aa9e6'), [1.2, 0.92, -2.93]));
    g.add(malla(new THREE.BoxGeometry(0.5, 0.05, 0.035), mat('#ffffff'), [1.2, 0.75, -2.93]));
    // Puerta
    g.add(malla(new THREE.BoxGeometry(0.9, 2.05, 0.05), mat('#c89f7a'), [-2.97, 1.025, 1], [0, Math.PI / 2, 0]));
    g.add(malla(new THREE.SphereGeometry(0.03, 10, 8), mat('#ffc23c'), [-2.93, 1.0, 0.65]));
    return { fondo: '#dff1fb', luz: [0xffffff, 0x9fb3c8, 2.5] };
  },

  naturaleza(g) {
    g.add(cielo('#5bb8ff', '#e6f6ff'));
    g.add(malla(new THREE.CircleGeometry(38, 48), mat('#7cc36b', { tipo: 'lambert' }), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    const tronco = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8);
    const copa = new THREE.SphereGeometry(0.9, 14, 10);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.3;
      const r = 6 + (i % 3) * 3;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      g.add(malla(tronco, mat('#8d6e63'), [x, 0.8, z]));
      g.add(malla(copa, mat(i % 2 ? '#43a047' : '#2e7d32'), [x, 2.1, z], [0, 0, 0], [1, 1.1, 1]));
    }
    // Volcanes nevados a lo lejos
    for (const [x, z, h, r] of [[-14, -26, 9, 8], [6, -30, 12, 9], [22, -20, 7, 7]]) {
      g.add(malla(new THREE.ConeGeometry(r, h, 24), mat('#6d8a96', { tipo: 'lambert' }), [x, h / 2, z]));
      g.add(malla(new THREE.ConeGeometry(r * 0.3, h * 0.3, 24), mat('#ffffff', { tipo: 'lambert' }), [x, h * 0.85 + 0.01, z]));
    }
    const flor = new THREE.SphereGeometry(0.05, 8, 6);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 6;
      g.add(malla(flor, mat(['#ff8fd1', '#ffd54f', '#ffffff', '#b56cff'][i % 4]), [Math.cos(a) * r, 0.05, Math.sin(a) * r]));
    }
    return { fondo: '#bfe6ff', niebla: ['#d5efff', 20, 60], luz: [0xffffff, 0x6f9a5a, 2.6] };
  },

  taller(g) {
    const suelo = madera();
    suelo.wrapS = suelo.wrapT = THREE.RepeatWrapping;
    suelo.repeat.set(5, 5);
    habitacion(g, { ancho: 10, fondo: 9, suelo: matTextura(suelo), pared: mat('#eef3f8', { tipo: 'lambert' }) });
    // Alfombra circular bajo el usuario
    g.add(malla(new THREE.CircleGeometry(1.7, 48), mat('#2f4a8a', { tipo: 'lambert' }), [0, 0.004, -0.6], [-Math.PI / 2, 0, 0]));
    ['#ff5aa5', '#22b8cf', '#ffc23c', '#2dbe78', '#8b5cf6'].forEach((c, i) => g.add(malla(new THREE.RingGeometry(1.45 - i * 0.22, 1.53 - i * 0.22, 48), mat(c, { tipo: 'lambert' }), [0, 0.006, -0.6], [-Math.PI / 2, 0, 0])));

    // Pizarra con las 5 fases (colores del portafolio)
    g.add(malla(new THREE.BoxGeometry(3.6, 1.7, 0.06), mat('#9aa7b8'), [0, 1.75, -4.47]));
    const pizarra = texturaLienzo(1800, 800, (x, w, h) => {
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#23304a';
      x.font = `800 96px ${FUENTE_TIZA}`;
      x.textAlign = 'center';
      x.fillText('Design Thinking', w / 2, 130);
      const fases = [['Empatizar', '#ff5aa5', '❤️'], ['Definir', '#22b8cf', '🔍'], ['Idear', '#ffc23c', '💡'], ['Prototipar', '#2dbe78', '📦'], ['Testear', '#8b5cf6', '📋']];
      fases.forEach(([nombre, color, emoji], i) => {
        const cx = 190 + i * 355;
        const cy = 420;
        if (i < 4) {
          x.strokeStyle = '#9aa7b8';
          x.lineWidth = 10;
          x.beginPath();
          x.moveTo(cx + 130, cy);
          x.lineTo(cx + 225, cy);
          x.lineTo(cx + 205, cy - 18);
          x.moveTo(cx + 225, cy);
          x.lineTo(cx + 205, cy + 18);
          x.stroke();
        }
        x.fillStyle = color;
        x.beginPath();
        x.arc(cx, cy, 120, 0, Math.PI * 2);
        x.fill();
        x.font = `400 110px ${FUENTE_TIZA}`;
        x.fillText(emoji, cx, cy + 38);
        x.fillStyle = '#23304a';
        x.font = `800 58px ${FUENTE_TIZA}`;
        x.fillText(`${i + 1}. ${nombre}`, cx, cy + 210);
      });
    });
    g.add(malla(new THREE.PlaneGeometry(3.45, 1.55), matTextura(pizarra, 'basica'), [0, 1.75, -4.43]));
    const cartel = texturaLienzo(1400, 160, (x, w, h) => {
      x.fillStyle = '#23304a';
      x.beginPath();
      x.roundRect(0, 0, w, h, 50);
      x.fill();
      x.fillStyle = '#ffffff';
      x.font = `800 70px ${FUENTE_TIZA}`;
      x.textAlign = 'center';
      x.fillText('🚀 LABORATORIO DE INNOVACIÓN', w / 2, 105, w - 80);
    });
    g.add(malla(new THREE.PlaneGeometry(2.8, 0.32), new THREE.MeshBasicMaterial({ map: cartel, transparent: true }), [0, 2.88, -4.46]));

    // Muro de ideas (corcho con notas adhesivas) en la pared izquierda
    g.add(malla(new THREE.BoxGeometry(0.04, 1.6, 3.2), mat('#c69c6d'), [-4.97, 1.6, 0]));
    const colores = ['#ffe066', '#ff8fd1', '#8fd3ff', '#b6f09c', '#ffb26b'];
    const nota = new THREE.PlaneGeometry(0.18, 0.18);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 5; j++) {
        if ((i * 7 + j * 3) % 5 === 0) continue;
        g.add(malla(nota, mat(colores[(i + j) % 5], { tipo: 'lambert' }), [-4.94, 1.0 + j * 0.28 + ((i * 13) % 5) * 0.01, -1.3 + i * 0.37], [0, Math.PI / 2, ((i * 17 + j * 11) % 7 - 3) * 0.05]));
      }

    // Estantes con material reciclado en la pared derecha
    for (const y of [0.6, 1.2, 1.8]) g.add(malla(new THREE.BoxGeometry(0.35, 0.03, 2.4), mat('#c89f7a'), [4.8, y, -1.2]));
    for (const [y, z] of [[0.62, -2.0], [0.62, -0.6], [1.22, -1.6], [1.82, -0.9]]) {
      const c = diseno.caja_carton();
      c.scale.setScalar(0.9);
      c.position.set(4.8, y, z);
      c.rotation.y = -Math.PI / 2;
      g.add(c);
    }
    for (let i = 0; i < 4; i++) {
      const b = diseno.botella_plastica({ color: ['#8fd3ff', '#b6f09c', '#ffb26b', '#8fd3ff'][i] });
      b.position.set(4.8, 1.215, -0.6 + i * 0.1);
      g.add(b);
    }
    for (let i = 0; i < 3; i++) {
      const c = diseno.cinta_adhesiva({ color: ['#ff9f43', '#22b8cf', '#ff5aa5'][i] });
      c.position.set(4.8, 1.815, -2.0 + i * 0.16);
      c.rotation.y = Math.PI / 2;
      g.add(c);
    }

    // Ventanas al fondo y plantas
    for (const x of [-2.4, 0, 2.4]) ventana(g, x, 1.7, 4.47, Math.PI, 1.6, 1.2);
    for (const [x, z] of [[-4.4, -4], [4.4, -4], [-4.4, 4], [4.4, 4]]) {
      const p = objetos.planta();
      p.scale.setScalar(3);
      p.position.set(x, 0, z);
      g.add(p);
    }
    return { fondo: '#eef3f8', luz: [0xffffff, 0xa59a8a, 2.5] };
  },

  patio(g) {
    g.add(cielo('#4aa8f0', '#e6f6ff'));
    g.add(malla(new THREE.CircleGeometry(45, 48), mat('#7cc36b', { tipo: 'lambert' }), [0, -0.01, 0], [-Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.PlaneGeometry(20, 15), mat('#d6d1c8', { tipo: 'lambert' }), [0, 0, -1.5], [-Math.PI / 2, 0, 0]));
    // Cancha a la izquierda
    g.add(malla(new THREE.PlaneGeometry(6, 9), mat('#3d9be9', { tipo: 'lambert' }), [-6.5, 0.003, -1.5], [-Math.PI / 2, 0, 0]));
    const linea = mat('#ffffff', { tipo: 'basica' });
    for (const [w, d, x, z] of [[6, 0.06, -6.5, -6], [6, 0.06, -6.5, 3], [0.06, 9, -9.5, -1.5], [0.06, 9, -3.5, -1.5], [6, 0.06, -6.5, -1.5]]) g.add(malla(new THREE.PlaneGeometry(w, d), linea, [x, 0.006, z], [-Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.RingGeometry(0.9, 0.96, 40), linea, [-6.5, 0.006, -1.5], [-Math.PI / 2, 0, 0]));

    // Edificio de la escuela
    g.add(malla(new THREE.BoxGeometry(17, 4.4, 1.2), mat('#f3d27a', { tipo: 'lambert' }), [0, 2.2, -8.6]));
    g.add(malla(new THREE.BoxGeometry(17.4, 0.3, 1.5), mat('#c0543c'), [0, 4.5, -8.5]));
    for (const piso of [1.2, 3.1])
      for (let i = -3; i <= 3; i++) {
        if (piso === 1.2 && i === 0) continue;
        g.add(malla(new THREE.PlaneGeometry(1.3, 1.0), mat('#a9dcff', { tipo: 'basica' }), [i * 2.2, piso, -7.98]));
        g.add(malla(new THREE.BoxGeometry(1.4, 0.08, 0.1), mat('#ffffff'), [i * 2.2, piso - 0.54, -7.95]));
      }
    g.add(malla(new THREE.BoxGeometry(1.4, 2.2, 0.1), mat('#8d5a3b'), [0, 1.1, -7.95]));
    const letrero = texturaLienzo(1200, 200, (x, w, h) => {
      x.fillStyle = '#2f4a8a';
      x.beginPath();
      x.roundRect(0, 0, w, h, 40);
      x.fill();
      x.fillStyle = '#ffffff';
      x.font = `800 100px ${FUENTE_TIZA}`;
      x.textAlign = 'center';
      x.fillText('UNIDAD EDUCATIVA', w / 2, 135);
    });
    g.add(malla(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshBasicMaterial({ map: letrero, transparent: true }), [0, 2.55, -7.94]));
    // Mural de colores
    ['#ff5aa5', '#22b8cf', '#ffc23c', '#2dbe78', '#8b5cf6'].forEach((c, i) => g.add(malla(new THREE.CircleGeometry(0.35, 32), mat(c, { tipo: 'lambert' }), [5.2 + (i % 3) * 0.8, 0.9 + Math.floor(i / 3) * 0.8, -7.97])));

    // Bebedero frente al usuario
    const beb = diseno.bebedero();
    beb.position.set(0, 0, -2.6);
    g.add(beb);

    // Bancas
    for (const lado of [-1, 1]) {
      const banca = new THREE.Group();
      banca.add(malla(new RoundedBoxGeometry(1.4, 0.06, 0.4, 2, 0.02), mat('#b5835a'), [0, 0.45, 0]));
      banca.add(malla(new RoundedBoxGeometry(1.4, 0.3, 0.05, 2, 0.02), mat('#b5835a'), [0, 0.7, -0.18]));
      for (const x of [-0.6, 0.6]) banca.add(malla(new THREE.BoxGeometry(0.06, 0.45, 0.35), mat('#555c66'), [x, 0.225, 0]));
      banca.position.set(lado * 2.8, 0, -1.4);
      banca.rotation.y = -lado * Math.PI / 2;
      g.add(banca);
    }
    // Árboles
    const tronco = new THREE.CylinderGeometry(0.15, 0.22, 2, 8);
    const copa = new THREE.SphereGeometry(1.1, 14, 10);
    for (const [x, z] of [[6.5, 1.5], [7.5, -4.5], [-10.5, 2.5], [-11, -5.5], [3.5, 5.5], [-3.5, 6]]) {
      g.add(malla(tronco, mat('#8d6e63'), [x, 1, z]));
      g.add(malla(copa, mat('#43a047'), [x, 2.6, z], [0, 0, 0], [1, 1.1, 1]));
      g.add(malla(copa, mat('#2e7d32'), [x + 0.5, 2.3, z + 0.3], [0, 0, 0], 0.7));
    }
    // Volcanes nevados a lo lejos
    for (const [x, z, h, r] of [[-18, -32, 11, 9], [8, -36, 14, 10], [26, -26, 9, 8], [-30, -10, 8, 8]]) {
      g.add(malla(new THREE.ConeGeometry(r, h, 24), mat('#6d8a96', { tipo: 'lambert' }), [x, h / 2, z]));
      g.add(malla(new THREE.ConeGeometry(r * 0.3, h * 0.3, 24), mat('#ffffff', { tipo: 'lambert' }), [x, h * 0.85 + 0.01, z]));
    }
    // Asta de la bandera (la bandera ondea en vida.js)
    g.add(malla(new THREE.CylinderGeometry(0.04, 0.05, 5, 10), mat('#c9d2de'), [3.8, 2.5, -5.2]));
    g.add(malla(new THREE.SphereGeometry(0.08, 12, 10), mat('#ffc23c'), [3.8, 5.05, -5.2]));
    return { fondo: '#bfe6ff', niebla: ['#d5efff', 25, 75], luz: [0xffffff, 0x8fb06a, 2.6] };
  },

  laboratorio(g) {
    const piso = texturaLienzo(256, 256, (x, w) => {
      x.fillStyle = '#1c2740';
      x.fillRect(0, 0, w, w);
      x.strokeStyle = 'rgba(95, 247, 255, 0.35)';
      x.lineWidth = 3;
      x.strokeRect(0, 0, w, w);
    });
    piso.wrapS = piso.wrapT = THREE.RepeatWrapping;
    piso.repeat.set(10, 9);
    habitacion(g, { ancho: 10, fondo: 9, alto: 3.4, suelo: matTextura(piso), pared: mat('#2a3a60', { tipo: 'lambert' }), techo: mat('#18213a', { tipo: 'basica' }) });
    // Tiras de luz de neón
    const neon = mat('#5ff7ff', { tipo: 'basica' });
    for (const [w, d, x, z] of [[10, 0.03, 0, -4.47], [10, 0.03, 0, 4.47], [0.03, 9, -4.97, 0], [0.03, 9, 4.97, 0]]) {
      g.add(malla(new THREE.BoxGeometry(w, 0.04, d), neon, [x, 3.1, z]));
      g.add(malla(new THREE.BoxGeometry(w, 0.02, d), mat('#b56cff', { tipo: 'basica' }), [x, 0.05, z]));
    }
    for (const x of [-2.5, 0, 2.5]) g.add(malla(new THREE.BoxGeometry(1.6, 0.03, 0.2), mat('#e8f6ff', { tipo: 'basica' }), [x, 3.38, -1]));

    // Letrero
    const letrero = texturaLienzo(1600, 170, (x, w, h) => {
      x.fillStyle = '#0d1426';
      x.beginPath();
      x.roundRect(0, 0, w, h, 40);
      x.fill();
      x.strokeStyle = '#5ff7ff';
      x.lineWidth = 6;
      x.stroke();
      x.fillStyle = '#5ff7ff';
      x.font = `800 78px ${FUENTE_TIZA}`;
      x.textAlign = 'center';
      x.fillText('🔬 LABORATORIO DE MICROBIOLOGÍA', w / 2, 112, w - 80);
    });
    g.add(malla(new THREE.PlaneGeometry(3.2, 0.34), new THREE.MeshBasicMaterial({ map: letrero, transparent: true }), [0, 2.95, -4.45]));

    // Mesones blancos con equipo a los lados
    for (const lado of [-1, 1]) {
      const x = lado * 3.9;
      g.add(malla(new RoundedBoxGeometry(0.9, 0.06, 5, 2, 0.02), mat('#eef3f8'), [x, 0.92, -0.5]));
      g.add(malla(new THREE.BoxGeometry(0.85, 0.88, 4.9), mat('#b8c4d6'), [x, 0.44, -0.5]));
      for (let i = 0; i < 3; i++) {
        const micro = objetos.microscopio();
        micro.scale.setScalar(1.6);
        micro.position.set(x, 0.95, -2.3 + i * 1.6);
        micro.rotation.y = -lado * Math.PI / 2;
        g.add(micro);
      }
      for (let i = 0; i < 6; i++) {
        const tubo = labPrefabs.tubo_ensayo({ color: ['#7fdc6b', '#ff8fd1', '#ffc23c'][i % 3] });
        tubo.position.set(x + lado * -0.15, 0.95, -1.6 + i * 0.08);
        g.add(tubo);
      }
      for (let i = 0; i < 3; i++) {
        const placa = labPrefabs.placa_petri();
        placa.position.set(x - lado * 0.1, 0.95, 0.5 + i * 0.22);
        g.add(placa);
      }
      // Matraces
      for (let i = 0; i < 2; i++) {
        g.add(malla(new THREE.ConeGeometry(0.08, 0.16, 20, 1, true), mat('#dff4ff', { opacidad: 0.45, lados: THREE.DoubleSide }), [x + lado * 0.2, 1.03, 1.5 + i * 0.3]));
        g.add(malla(new THREE.ConeGeometry(0.065, 0.09, 20), mat(i ? '#b56cff' : '#5ff7ff', { opacidad: 0.8, emisivo: 0.4 }), [x + lado * 0.2, 0.995, 1.5 + i * 0.3]));
      }
    }
    // Incubadora al fondo
    g.add(malla(new RoundedBoxGeometry(1.2, 1.8, 0.7, 3, 0.05), mat('#dfe6ee'), [3.4, 0.9, -3.9]));
    g.add(malla(new THREE.PlaneGeometry(0.8, 0.9), mat('#ffb26b', { tipo: 'basica', opacidad: 0.85 }), [3.4, 1.1, -3.54]));
    // Proyector holográfico (la parte animada está en vida.js)
    g.add(malla(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 40), mat('#3a4a72'), [-2.7, 0.06, -2.6]));
    g.add(malla(new THREE.RingGeometry(0.4, 0.5, 48), mat('#5ff7ff', { tipo: 'basica' }), [-2.7, 0.125, -2.6], [-Math.PI / 2, 0, 0]));
    return { fondo: '#16203a', luz: [0xdff7ff, 0x3a3f6a, 2.1] };
  },

  mercado(g) {
    g.add(cielo('#5fb4f5', '#e9f6ff'));
    const piso = texturaLienzo(256, 256, (x, w) => {
      x.fillStyle = '#cfc6b6';
      x.fillRect(0, 0, w, w);
      for (let i = 0; i < 400; i++) {
        x.fillStyle = `rgba(80, 70, 55, ${(i % 7) * 0.02})`;
        x.fillRect((i * 97) % w, (i * 57) % w, 3, 3);
      }
      x.strokeStyle = '#b3a993';
      x.lineWidth = 4;
      x.strokeRect(0, 0, w, w);
    });
    piso.wrapS = piso.wrapT = THREE.RepeatWrapping;
    piso.repeat.set(10, 10);
    g.add(malla(new THREE.PlaneGeometry(22, 22), matTextura(piso), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.CircleGeometry(45, 48), mat('#b9b3a5', { tipo: 'lambert' }), [0, -0.01, 0], [-Math.PI / 2, 0, 0]));

    // Los 4 puestos principales alrededor del usuario (los usa la escena de inspección)
    puestoMercado(g, {
      x: 0, z: -2.6, rot: 0, toldo: ['#2dbe78', '#ffffff'], frente: '#2e9e64', nombre: '🍎 FRUTAS Y VERDURAS',
      decorar: (p) => {
        piramide(p, -1.0, -0.22, '#ff9f1c');
        piramide(p, 0.05, -0.24, '#e53935', { base: 2 });
        piramide(p, 1.05, -0.22, '#c5d94a', { r: 0.04 });
        racimoBananos(p, -1.05, 1.95, 0.6);
        racimoBananos(p, 1.05, 1.95, 0.6);
        for (const [x, y] of [[-0.8, 1.29], [0.3, 1.29], [-0.3, 1.69], [0.8, 1.69]]) {
          p.add(malla(new THREE.SphereGeometry(0.07, 14, 10), mat('#e0a030'), [x, y + 0.07, -0.86], [0, 0, 0], [1, 1.35, 1]));
          p.add(malla(new THREE.ConeGeometry(0.05, 0.12, 6), mat('#4caf50'), [x, y + 0.22, -0.86]));
        }
      },
    });
    puestoMercado(g, {
      x: -2.6, z: -0.3, rot: Math.PI / 2, toldo: ['#e5484d', '#ffffff'], frente: '#c0392b', nombre: '🥩 CARNES Y MARISCOS', fondoPanel: '#f1f4f8',
      decorar: (p) => {
        p.add(malla(new RoundedBoxGeometry(0.3, 0.12, 0.25, 2, 0.02), mat('#dfe6ee'), [1.0, 0.96, -0.22]));
        p.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20), mat('#ffffff'), [1.0, 1.07, -0.12], [Math.PI / 2, 0, 0]));
        p.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 14), mat('#f4ead2'), [-1.0, 0.93, -0.25], [0, 0, Math.PI / 2]));
        p.add(malla(new THREE.PlaneGeometry(0.6, 0.4), mat('#2f5d50', { tipo: 'lambert' }), [0.8, 1.45, -0.95]));
      },
    });
    puestoMercado(g, {
      x: 2.6, z: -0.3, rot: -Math.PI / 2, toldo: ['#ffc23c', '#2f8be6'], frente: '#2f8be6', nombre: '🍔 COMIDAS Y JUGOS',
      decorar: (p) => {
        p.add(malla(new THREE.CylinderGeometry(0.2, 0.18, 0.3, 22), mat('#b8c4d6'), [-1.0, 1.05, -0.2]));
        p.add(malla(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 22), mat('#9aa7b8'), [-1.0, 1.215, -0.2]));
        p.add(malla(new THREE.BoxGeometry(0.6, 0.06, 0.32), mat('#2b2b33'), [0.1, 0.93, -0.24]));
        for (const [x, c] of [[0.95, '#7b2d8b'], [1.15, '#d8e04a']]) {
          p.add(malla(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 18), mat('#dff4ff', { opacidad: 0.45 }), [x, 1.02, -0.25]));
          p.add(malla(new THREE.CylinderGeometry(0.065, 0.065, 0.17, 18), mat(c), [x, 0.99, -0.25]));
        }
        for (const x of [-0.8, 0, 0.8]) {
          p.add(malla(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), mat('#e5484d'), [x, 0.58, 0.75]));
          p.add(malla(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 6), mat('#555c66'), [x, 0.28, 0.75]));
        }
        for (let i = 0; i < 6; i++) p.add(malla(new THREE.CylinderGeometry(0.11, 0.09, 0.012, 20), mat('#ffffff'), [-0.45, 0.91 + i * 0.014, -0.25]));
      },
    });
    puestoMercado(g, {
      x: 0, z: 2.4, rot: Math.PI, toldo: ['#2f8be6', '#ffffff'], frente: '#2a6fb5', nombre: '🧀 LÁCTEOS Y ABARROTES',
      decorar: (p) => {
        // Vitrina refrigerada con quesos (así SÍ se guardan los lácteos)
        p.add(malla(new THREE.BoxGeometry(0.62, 0.08, 0.34), mat('#2f8be6'), [-0.92, 0.94, -0.2]));
        p.add(malla(new THREE.BoxGeometry(0.62, 0.32, 0.34), mat('#dff4ff', { opacidad: 0.35 }), [-0.92, 1.14, -0.2]));
        for (const x of [-1.08, -0.84]) p.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 18), mat('#ffe08a'), [x, 1.02, -0.2]));
        const lata = new THREE.CylinderGeometry(0.04, 0.04, 0.11, 14);
        for (let i = 0; i < 12; i++) p.add(malla(lata, mat(['#e5484d', '#2dbe78', '#ffc23c'][i % 3]), [-1.1 + i * 0.2, i < 6 ? 1.32 : 1.72, -0.86]));
        for (let i = 0; i < 5; i++) p.add(malla(new THREE.BoxGeometry(0.16, 0.22, 0.1), mat(['#ffffff', '#8fd3ff'][i % 2]), [0.2 + i * 0.22, i % 2 ? 1.37 : 1.77, -0.86]));
        for (const x of [-1.6, 1.6]) {
          p.add(malla(new THREE.SphereGeometry(0.28, 14, 10), mat('#e8dcc0'), [x, 0.3, 0.1], [0, 0, 0], [1, 1.2, 0.9]));
          p.add(malla(new THREE.CylinderGeometry(0.12, 0.2, 0.12, 12), mat('#d9cba8'), [x, 0.64, 0.1]));
        }
      },
    });

    // Más puestos al fondo (solo decorado) y la entrada del mercado
    for (const [ang, c1, c2] of [[0.8, '#ff8fd1', '#ffffff'], [-0.8, '#8b5cf6', '#ffffff'], [2.4, '#ff9f43', '#ffffff'], [-2.4, '#22b8cf', '#ffffff']]) {
      puestoMercado(g, { x: Math.sin(ang) * 6.2, z: -Math.cos(ang) * 6.2, rot: -ang, toldo: [c1, c2], frente: c1, decorar: (p) => piramide(p, 0, -0.2, c1, { base: 3, r: 0.06 }) });
    }
    for (const x of [-2.3, 2.3]) g.add(malla(new THREE.BoxGeometry(0.4, 3.8, 0.4), mat('#f3e2c0'), [x, 1.9, -5.6]));
    g.add(malla(new THREE.BoxGeometry(5.2, 0.5, 0.45), mat('#f3e2c0'), [0, 3.95, -5.6]));
    const entrada = cartel('MERCADO CENTRAL', 3.6, 0.42, { fondo: '#b5533c', color: '#fff4d6' });
    entrada.position.set(0, 3.95, -5.36);
    g.add(entrada);

    // Ciudad y volcanes alrededor
    const colores = ['#f7f1e3', '#f3d27a', '#a9d6e5', '#f6b6a4', '#ffffff', '#cde7b0'];
    for (let i = 0; i < 12; i++) edificio(g, (i / 12) * Math.PI * 2 + 0.26, 11.5 + (i % 3) * 0.8, 3.4 + (i % 2) * 1.2, 4.5 + (i % 4) * 1.2, colores[i % colores.length]);
    volcanes(g, [[-18, -32, 12, 10], [9, -36, 15, 11], [28, -24, 9, 8], [-32, 8, 9, 8]]);
    return { fondo: '#bfe6ff', niebla: ['#dcefff', 18, 60], luz: [0xffffff, 0x9c8a74, 2.6] };
  },

  planta(g) {
    const piso = texturaLienzo(256, 256, (x, w) => {
      x.fillStyle = '#9aa4ae';
      x.fillRect(0, 0, w, w);
      x.strokeStyle = 'rgba(60, 70, 80, 0.35)';
      x.lineWidth = 3;
      x.strokeRect(0, 0, w, w);
    });
    piso.wrapS = piso.wrapT = THREE.RepeatWrapping;
    piso.repeat.set(7, 6);
    habitacion(g, { ancho: 14, fondo: 12, alto: 5, suelo: matTextura(piso), pared: mat('#e3e8ee', { tipo: 'lambert' }), techo: mat('#2f3642', { tipo: 'basica' }) });
    // Zócalo azul y franjas en las paredes
    for (const [w, x, z, ry] of [[14, 0, -5.97, 0], [14, 0, 5.97, Math.PI], [12, -6.97, 0, Math.PI / 2], [12, 6.97, 0, -Math.PI / 2]]) {
      g.add(malla(new THREE.PlaneGeometry(w, 1.0), mat('#2f6fb0', { tipo: 'lambert' }), [x, 0.5, z], [0, ry, 0]));
      g.add(malla(new THREE.PlaneGeometry(w, 0.08), mat('#ffc23c', { tipo: 'basica' }), [x, 1.04, z], [0, ry, 0]));
      g.add(malla(new THREE.PlaneGeometry(w * 0.9, 0.5), mat('#cfeaff', { tipo: 'basica' }), [x * 0.999, 4.25, z * 0.999], [0, ry, 0]));
    }
    // Líneas amarillas de seguridad en el piso
    const amarillo = mat('#ffc23c', { tipo: 'basica' });
    for (const [w, d, x, z] of [[6.6, 0.08, 0, -2.4], [6.6, 0.08, 0, 1.8], [0.08, 4.2, -3.3, -0.3], [0.08, 4.2, 3.3, -0.3]]) g.add(malla(new THREE.PlaneGeometry(w, d), amarillo, [x, 0.004, z], [-Math.PI / 2, 0, 0]));
    // Tanques de acero
    const acero = mat('#c3ccd6');
    for (const [x, z] of [[-5.4, -4.4], [-3.7, -4.7], [5.5, 4.2]]) {
      g.add(malla(new THREE.CylinderGeometry(0.75, 0.75, 2.8, 28), acero, [x, 1.9, z]));
      g.add(malla(new THREE.SphereGeometry(0.75, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), acero, [x, 3.3, z]));
      g.add(malla(new THREE.ConeGeometry(0.75, 0.4, 28), acero, [x, 0.3, z], [Math.PI, 0, 0]));
      for (const a of [0, 2.1, 4.2]) g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), mat('#555c66'), [x + Math.cos(a) * 0.6, 0.3, z + Math.sin(a) * 0.6]));
      g.add(malla(new THREE.TorusGeometry(0.76, 0.03, 6, 32), mat('#8a98ad'), [x, 2.2, z], [Math.PI / 2, 0, 0]));
      g.add(malla(new THREE.BoxGeometry(0.5, 0.3, 0.02), mat('#2f8be6'), [x, 2.6, z + 0.76]));
    }
    // Tuberías
    for (const [y, c] of [[3.7, '#e5484d'], [4.0, '#2f8be6'], [3.4, '#2dbe78']]) g.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 14, 12), mat(c), [0, y, -5.85], [0, 0, Math.PI / 2]));
    for (const x of [-5.4, -3.7]) g.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 10), mat('#8a98ad'), [x, 3.95, -5.2]));
    // Lámparas industriales
    for (const x of [-4, 0, 4])
      for (const z of [-3, 1.5]) {
        g.add(malla(new THREE.BoxGeometry(1.6, 0.06, 0.3), mat('#f4fbff', { tipo: 'basica' }), [x, 4.6, z]));
        g.add(malla(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), mat('#2b2b33'), [x, 4.8, z]));
      }
    // Letreros
    const letrero = cartel('🏭 PLANTA PROCESADORA · CONTROL DE CALIDAD', 5, 0.42, { fondo: '#23304a', borde: '#ffc23c', color: '#ffc23c', tam: 0.5 });
    letrero.position.set(0, 3.0, -5.95);
    g.add(letrero);
    const aviso = cartel('⚠️ USA COFIA, MASCARILLA Y GUANTES', 2.6, 0.36, { fondo: '#ffc23c', color: '#23304a', tam: 0.46 });
    aviso.position.set(6.95, 2.2, -1.5);
    aviso.rotation.y = -Math.PI / 2;
    g.add(aviso);
    const manos = cartel('🧼 LÁVATE LAS MANOS ANTES DE ENTRAR', 2.6, 0.36, { fondo: '#2dbe78', color: '#ffffff', tam: 0.44 });
    manos.position.set(-6.95, 2.2, 1.5);
    manos.rotation.y = Math.PI / 2;
    g.add(manos);
    // Palets con cajas
    const carton = mat('#c8a06a');
    for (const [x, z, pisos] of [[5.0, -1.8, 3], [5.0, 0.4, 2], [-5.0, 1.6, 3], [-5.1, -1.2, 1]]) {
      g.add(malla(new THREE.BoxGeometry(1.2, 0.14, 1.0), mat('#b5835a'), [x, 0.07, z]));
      for (let k = 0; k < pisos; k++)
        for (const [dx, dz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) {
          g.add(malla(new THREE.BoxGeometry(0.56, 0.4, 0.46), carton, [x + dx, 0.34 + k * 0.42, z + dz]));
          g.add(malla(new THREE.BoxGeometry(0.565, 0.05, 0.08), mat('#e8d9b0'), [x + dx, 0.54 + k * 0.42, z + dz]));
        }
    }
    // Tablero de control en la pared izquierda
    g.add(malla(new THREE.BoxGeometry(0.3, 1.4, 1.8), mat('#3a4250'), [-6.8, 1.2, -1.5]));
    g.add(malla(new THREE.PlaneGeometry(1.1, 0.6), mat('#0d1426', { tipo: 'basica' }), [-6.64, 1.55, -1.5], [0, Math.PI / 2, 0]));
    for (let i = 0; i < 8; i++) g.add(malla(new THREE.CircleGeometry(0.05, 14), mat(['#2dbe78', '#ff5a5f', '#ffc23c', '#4f7cff'][i % 4], { tipo: 'basica' }), [-6.64, 0.95 - Math.floor(i / 4) * 0.15, -2.1 + (i % 4) * 0.4], [0, Math.PI / 2, 0]));
    // Portón enrollable al fondo a la derecha
    g.add(malla(new THREE.PlaneGeometry(3, 3.4), matTextura(rayas('#9aa7b8', '#8a96a6', 24)), [3.6, 1.7, -5.96]));
    return { fondo: '#e3e8ee', luz: [0xffffff, 0x8a96a6, 2.4] };
  },

  cuerpo(g, contexto) {
    const zonas = { boca: zonaBoca(), estomago: zonaEstomago(), intestino: zonaIntestino(), defensas: zonaDefensas() };
    for (const [nombre, zona] of Object.entries(zonas)) {
      fusionar(zona);
      zona.userData.noFusionar = true;
      zona.visible = nombre === 'boca';
      g.add(zona);
    }
    contexto.zonas = zonas;
    const app = contexto.app;
    const api = {
      zonas,
      actual: 'boca',
      /** Muestra solo la zona indicada y cambia el color del aire y la luz. */
      mostrar(nombre) {
        if (!zonas[nombre]) return;
        api.actual = nombre;
        for (const [n, z] of Object.entries(zonas)) z.visible = n === nombre;
        const { fondo, niebla, luz } = ZONAS_CUERPO[nombre];
        app.escena.background = new THREE.Color(fondo);
        app.escena.fog = new THREE.Fog(niebla[0], niebla[1], niebla[2]);
        app.hemi.color.set(luz[0]);
        app.hemi.groundColor.set(luz[1]);
        app.hemi.intensity = luz[2];
      },
    };
    return { ...ZONAS_CUERPO.boca, api };
  },

  espacio(g, contexto) {
    g.add(cielo('#02030a', '#0b1030'));
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 6);
      v.y = Math.abs(v.y) * 0.9 + 1;
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const estrellas = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, fog: false }));
    estrellas.userData.noFusionar = true;
    g.add(estrellas);
    g.add(malla(new THREE.CircleGeometry(4, 64), mat('#2a3257', { tipo: 'lambert' }), [0, 0, 0], [-Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.RingGeometry(3.9, 4, 96), mat('#7aa5f5', { tipo: 'basica' }), [0, 0.003, 0], [-Math.PI / 2, 0, 0]));
    const planeta = malla(new THREE.SphereGeometry(4, 32, 24), mat('#4f7cff'), [-12, 7, -22]);
    planeta.userData.noFusionar = true;
    g.add(planeta);
    g.add(malla(new THREE.SphereGeometry(2.5, 28, 20), mat('#ffb74d'), [16, 10, -18]));
    contexto.cada((dt) => (planeta.rotation.y += dt * 0.05));
    return { fondo: '#02030a', luz: [0xdfe7ff, 0x1a1f3a, 2.2] };
  },
};

/**
 * Crea un entorno por nombre. Devuelve { grupo, actualizar(dt, t), detener() }.
 * opciones: { audio, titulo, subtitulo } (el título se escribe en la pizarra del aula).
 */
export function crearEntorno(nombre, app, { audio, titulo = '', subtitulo = '' } = {}) {
  if (!ENTORNOS[nombre]) nombre = 'aula';
  const grupo = new THREE.Group();
  const actualizadores = [];
  const detenedores = [];
  const contexto = {
    app,
    audio,
    titulo,
    subtitulo,
    cada: (fn) => actualizadores.push(fn),
    alDetener: (fn) => detenedores.push(fn),
  };
  // `api` (opcional): funciones propias del entorno para las escenas (p. ej. cambiar de zona en el cuerpo).
  const { fondo, niebla, luz, api = null } = ENTORNOS[nombre](grupo, contexto);
  fusionar(grupo);
  // Lo animado se agrega después de fusionar para que siga moviéndose.
  darVida(nombre, grupo, contexto);
  app.escena.background = new THREE.Color(fondo);
  app.escena.fog = niebla ? new THREE.Fog(niebla[0], niebla[1], niebla[2]) : null;
  app.hemi.color.set(luz[0]);
  app.hemi.groundColor.set(luz[1]);
  app.hemi.intensity = luz[2];
  return {
    nombre,
    grupo,
    api,
    actualizar: (dt, t) => actualizadores.forEach((fn) => fn(dt, t)),
    detener: () => detenedores.splice(0).forEach((fn) => fn()),
  };
}
