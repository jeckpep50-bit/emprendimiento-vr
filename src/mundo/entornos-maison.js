import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from './materiales.js';
import { texturaLienzo, matTextura } from './entornos.js';
import { motas } from './vida.js';

// Chez Coco: el departamento de la lección de francés A1. El estudiante entra por la
// puerta (origen, mirando a -Z) y recorre el lugar por huellas: del pasillo salen
// cuatro puertas en abanico (la chambre, le salon, la cuisine, la salle de bain).
// Aquí va solo lo estático (paredes y muebles, fusionado en pocas mallas); lo que se
// toca (tablet, control, interruptor, puertas, letreros) lo pone la escena "maison".

/**
 * Plano del departamento que comparten el entorno y la escena. Las medidas están en
 * "coordenadas del plano"; el estudiante empieza en `origen` (la entrada), así que el
 * entorno y la escena se desplazan para que ese punto quede bajo sus pies.
 * nodos: dónde queda parado el estudiante en cada lugar y hacia dónde mira
 *   (yaw = rotation.y; 0 mira a -Z). "hud" es la distancia del panel de diálogo.
 * puertas: centro del vano, huella en el pasillo y letrero sobre la puerta.
 * local: posiciones dentro del marco de cada cuarto (estudiante en el origen mirando a -Z).
 */
export const MAISON = {
  alto: 2.7,
  puertaAlto: 2.05,
  origen: [0, 0.8],
  nodos: {
    entree: { pos: [0, 0.8], yaw: 0, hud: 1.7 },
    couloir: { pos: [0, -0.4], yaw: 0, hud: 1.7 },
    chambre: { pos: [-4.25, -2.6], yaw: Math.PI / 2, hud: 1.6 },
    salon: { pos: [-2.0, -5.5], yaw: 0, hud: 2.0 },
    cuisine: { pos: [2.1, -5.6], yaw: -Math.PI / 2, hud: 1.5 },
    bain: { pos: [3.45, -2.6], yaw: -Math.PI / 2, hud: 1.6 },
  },
  puertas: {
    chambre: { centro: [-1.75, -2.6], huella: [-1.12, -2.6], letrero: [-1.45, -2.6] },
    salon: { centro: [-1.05, -4.15], huella: [-1.05, -3.5], letrero: [-1.3, -3.94] },
    cuisine: { centro: [1.05, -4.15], huella: [1.05, -3.5], letrero: [1.3, -3.94] },
    bain: { centro: [1.75, -2.6], huella: [1.12, -2.6], letrero: [1.45, -2.6] },
  },
  /** Vano de las puertas laterales (a lo largo de Z) y de los arcos del fondo (a lo largo de X). */
  vanoLateral: [-3.05, -2.15],
  vanoFondo: [0.575, 1.525],
  cocoPasillo: [0, -2.35],
  local: {
    chambre: { coco: [-0.95, -1.42], salida: [0.62, -0.78], tablette: [0.1, 0.78, -1.36], livre: [-0.5, 0.78, -1.38], lampe: [0.6, 0.78, -1.52] },
    salon: { coco: [-0.85, -1.55], salida: [0.68, -0.74], tele: [0.55, 1.3, -2.725], telecommande: [-0.25, 0.925, -1.25], canape: [-1.5, 0.5, -1.15], lampe: [1.6, 1.25, -2.5] },
    cuisine: { coco: [-1.0, -1.0], salida: [0.62, -0.75], interrupteur: [0.75, 1.28, -1.88], frigo: [-1.0, 0.95, -1.55], robinet: [0.25, 1.06, -1.74], plafonnier: [0, 2.32, -0.9] },
    bain: { coco: [-0.85, -0.7], salida: [0.62, -0.7], baignoire: [-0.1, 0.4, -1.37] },
  },
};

const caja = (g, w, h, d, color, x, y, z, ry = 0, opciones) => {
  const m = malla(new THREE.BoxGeometry(w, h, d), mat(color, opciones), [x, y, z], [0, ry, 0]);
  g.add(m);
  return m;
};
const redonda = (g, w, h, d, color, x, y, z, ry = 0, r = 0.04) => {
  const m = malla(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat(color), [x, y, z], [0, ry, 0]);
  g.add(m);
  return m;
};
const cil = (g, rArriba, rAbajo, h, color, x, y, z, opciones, seg = 18) => {
  const m = malla(new THREE.CylinderGeometry(rArriba, rAbajo, h, seg), mat(color, opciones), [x, y, z]);
  g.add(m);
  return m;
};
const bola = (g, r, color, x, y, z, opciones, escala = null) => {
  const m = malla(new THREE.SphereGeometry(r, 16, 12), mat(color, opciones), [x, y, z], [0, 0, 0], escala);
  g.add(m);
  return m;
};

/** Grupo colocado en el marco de un cuarto: dentro, el estudiante está en el origen mirando a -Z. */
function marco(g, nombre) {
  const n = MAISON.nodos[nombre];
  const m = new THREE.Group();
  m.position.set(n.pos[0], 0, n.pos[1]);
  m.rotation.y = n.yaw;
  g.add(m);
  return m;
}

/**
 * Cara de una pared. eje 'x': va de a a b en X con Z = fijo; eje 'z': va en Z con X = fijo.
 * mira: +1 / -1, hacia dónde da la cara. vanos: tramos sin pared hasta la altura de la puerta.
 */
function pared(g, { eje, fijo, a, b, mira, color, vanos = [] }) {
  const material = mat(color, { tipo: 'lambert' });
  const { alto, puertaAlto } = MAISON;
  const giro = eje === 'x' ? (mira > 0 ? 0 : Math.PI) : mira > 0 ? Math.PI / 2 : -Math.PI / 2;
  const tramo = (p, q, y0, y1) => {
    if (q - p <= 0.001) return;
    const c = (p + q) / 2;
    g.add(malla(new THREE.PlaneGeometry(q - p, y1 - y0), material, eje === 'x' ? [c, (y0 + y1) / 2, fijo] : [fijo, (y0 + y1) / 2, c], [0, giro, 0]));
  };
  let p = a;
  for (const [v0, v1] of [...vanos].sort((m, n) => m[0] - n[0])) {
    tramo(p, v0, 0, alto);
    tramo(v0, v1, puertaAlto, alto);
    p = v1;
  }
  tramo(p, b, 0, alto);
}

/** Marco de madera de un vano (cubre el grosor de la pared). */
function marcoPuerta(g, eje, centro, [v0, v1], color = '#fffaf0') {
  const { puertaAlto } = MAISON;
  for (const v of [v0 - 0.03, v1 + 0.03]) {
    if (eje === 'x') caja(g, 0.07, puertaAlto, 0.17, color, v, puertaAlto / 2, centro);
    else caja(g, 0.17, puertaAlto, 0.07, color, centro, puertaAlto / 2, v);
  }
  const largo = v1 - v0 + 0.13;
  if (eje === 'x') caja(g, largo, 0.08, 0.17, color, (v0 + v1) / 2, puertaAlto + 0.04, centro);
  else caja(g, 0.17, 0.08, largo, color, centro, puertaAlto + 0.04, (v0 + v1) / 2);
}

function piso(g, textura, [x0, x1], [z0, z1], cada = 1) {
  const t = textura.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((x1 - x0) / cada, (z1 - z0) / cada);
  t.needsUpdate = true;
  g.add(malla(new THREE.PlaneGeometry(x1 - x0, z1 - z0), matTextura(t), [(x0 + x1) / 2, 0, (z0 + z1) / 2], [-Math.PI / 2, 0, 0]));
}

function parquet(c1, c2, c3) {
  return texturaLienzo(256, 256, (x, w) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      x.fillStyle = [c1, c2, c3][i % 3];
      x.fillRect(0, (i * w) / n, w, w / n + 1);
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(0, (i * w) / n, w, 2);
      x.fillRect((i * 97) % w, (i * w) / n, 2, w / n);
    }
  });
}

function baldosa(c1, c2) {
  return texturaLienzo(128, 128, (x, w) => {
    x.fillStyle = c1;
    x.fillRect(0, 0, w, w);
    x.fillStyle = c2;
    x.fillRect(0, 0, w / 2, w / 2);
    x.fillRect(w / 2, w / 2, w / 2, w / 2);
    x.strokeStyle = 'rgba(0,0,0,0.12)';
    x.lineWidth = 2;
    x.strokeRect(0, 0, w / 2, w / 2);
    x.strokeRect(w / 2, w / 2, w / 2, w / 2);
  });
}

/** París al anochecer con la torre Eiffel iluminada (para las ventanas). */
function texturaParis(conTorre = true) {
  return texturaLienzo(512, 400, (x, w, h) => {
    const cielo = x.createLinearGradient(0, 0, 0, h);
    cielo.addColorStop(0, '#1b2a5c');
    cielo.addColorStop(0.55, '#7a5a9a');
    cielo.addColorStop(0.85, '#f08a5d');
    cielo.addColorStop(1, '#ffd9a0');
    x.fillStyle = cielo;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) x.fillRect((i * 83) % w, (i * 47) % (h * 0.5), 2, 2);
    x.fillStyle = '#fff4c9';
    x.beginPath();
    x.arc(w * 0.82, h * 0.2, 22, 0, Math.PI * 2);
    x.fill();
    // Edificios con ventanas encendidas
    for (let i = 0; i < 9; i++) {
      const bw = 50 + ((i * 37) % 40);
      const bh = 70 + ((i * 53) % 90);
      const bx = i * 60 - 10;
      x.fillStyle = i % 2 ? '#20264a' : '#2a3160';
      x.fillRect(bx, h - bh, bw, bh);
      x.fillStyle = '#ffd77a';
      for (let f = 0; f < 5; f++) for (let c = 0; c < 3; c++) if ((i + f * 2 + c) % 3) x.fillRect(bx + 8 + c * 14, h - bh + 10 + f * 16, 7, 9);
    }
    if (!conTorre) return;
    const cx = w * 0.36;
    x.fillStyle = '#141a3a';
    x.beginPath();
    x.moveTo(cx - 74, h);
    x.quadraticCurveTo(cx - 26, h * 0.62, cx - 9, h * 0.3);
    x.lineTo(cx - 3, h * 0.07);
    x.lineTo(cx + 3, h * 0.07);
    x.lineTo(cx + 9, h * 0.3);
    x.quadraticCurveTo(cx + 26, h * 0.62, cx + 74, h);
    x.lineTo(cx + 44, h);
    x.quadraticCurveTo(cx, h * 0.66, cx - 44, h);
    x.closePath();
    x.fill();
    x.fillRect(cx - 34, h * 0.69, 68, 9);
    x.fillRect(cx - 16, h * 0.42, 32, 7);
    x.fillStyle = '#ffe9a8';
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const y = h * (0.07 + k * 0.9);
      const media = 3 + k * k * 68;
      x.fillRect(cx - media - 1, y, 3, 3);
      x.fillRect(cx + media - 1, y, 3, 3);
    }
    x.fillRect(cx - 2, h * 0.04, 4, 6);
  });
}

function ventana(g, x, y, z, ry, ancho, alto, textura, cortina = '#c8322e') {
  const v = new THREE.Group();
  v.position.set(x, y, z);
  v.rotation.y = ry;
  v.add(malla(new THREE.PlaneGeometry(ancho, alto), matTextura(textura, 'basica'), [0, 0, 0.012]));
  const blanco = '#fffaf0';
  caja(v, ancho + 0.1, 0.06, 0.07, blanco, 0, alto / 2 + 0.03, 0.03);
  caja(v, ancho + 0.14, 0.05, 0.12, blanco, 0, -alto / 2 - 0.025, 0.05);
  for (const s of [-1, 1]) caja(v, 0.06, alto + 0.06, 0.07, blanco, (s * (ancho + 0.06)) / 2, 0, 0.03);
  caja(v, 0.035, alto, 0.03, blanco, 0, 0, 0.03);
  caja(v, ancho, 0.035, 0.03, blanco, 0, 0, 0.03);
  if (cortina) {
    for (const s of [-1, 1]) caja(v, 0.24, alto + 0.3, 0.05, cortina, s * (ancho / 2 + 0.1), -0.05, 0.08);
    caja(v, ancho + 0.5, 0.035, 0.035, '#5b3a22', 0, alto / 2 + 0.13, 0.08);
  }
  g.add(v);
}

function cuadro(g, x, y, z, ry, ancho, alto, dibujar, marcoColor = '#3b2a20') {
  const c = new THREE.Group();
  c.position.set(x, y, z);
  c.rotation.y = ry;
  caja(c, ancho + 0.07, alto + 0.07, 0.03, marcoColor, 0, 0, 0.015);
  c.add(malla(new THREE.PlaneGeometry(ancho, alto), matTextura(texturaLienzo(256, Math.round((256 * alto) / ancho), dibujar), 'basica'), [0, 0, 0.032]));
  g.add(c);
}

function lamparaTecho(g, x, z, { encendida = true, color = '#f2c45a' } = {}) {
  const y = MAISON.alto;
  cil(g, 0.006, 0.006, 0.3, '#2b2b33', x, y - 0.15, z, undefined, 6);
  g.add(malla(new THREE.ConeGeometry(0.2, 0.2, 24, 1, true), mat(color, { lados: THREE.DoubleSide }), [x, y - 0.38, z]));
  if (encendida) bola(g, 0.06, '#fff1c2', x, y - 0.45, z, { tipo: 'basica' });
}

function planta(g, x, z, r = 0.3) {
  cil(g, 0.17, 0.12, 0.32, '#c96b3c', x, 0.16, z, undefined, 14);
  for (let k = 0; k < 5; k++) bola(g, r * (0.55 + (k % 2) * 0.2), k % 2 ? '#3f8f3a' : '#2f7a33', x + Math.sin(k * 1.3) * 0.11, 0.45 + k * 0.1, z + Math.cos(k * 1.3) * 0.09);
}

const afiche = (titulo, c1, c2) => (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, c1);
  gr.addColorStop(1, c2);
  x.fillStyle = gr;
  x.fillRect(0, 0, w, h);
  // Torre sencilla
  const cx = w / 2;
  x.fillStyle = '#23304a';
  x.beginPath();
  x.moveTo(cx - 62, h * 0.9);
  x.quadraticCurveTo(cx - 20, h * 0.6, cx - 4, h * 0.2);
  x.lineTo(cx + 4, h * 0.2);
  x.quadraticCurveTo(cx + 20, h * 0.6, cx + 62, h * 0.9);
  x.lineTo(cx + 36, h * 0.9);
  x.quadraticCurveTo(cx, h * 0.62, cx - 36, h * 0.9);
  x.closePath();
  x.fill();
  x.fillRect(cx - 28, h * 0.63, 56, 8);
  x.fillStyle = '#ffffff';
  x.font = `900 ${Math.round(h * 0.11)}px system-ui, sans-serif`;
  x.textAlign = 'center';
  x.fillText(titulo, cx, h * 0.14);
};

function appartement(entorno, ctx) {
  const { alto, vanoLateral, vanoFondo } = MAISON;
  // Todo se construye en coordenadas del plano y se desplaza para que la entrada quede en el origen.
  const g = new THREE.Group();
  g.position.set(-MAISON.origen[0], 0, -MAISON.origen[1]);
  entorno.add(g);
  const vanoIzq = [-vanoFondo[1], -vanoFondo[0]];
  const madera = parquet('#c79a66', '#bd8f5c', '#d1a571');
  const maderaOscura = parquet('#9a6a42', '#8f6039', '#a6744a');

  // ── Pisos y techo ──
  piso(g, madera, [-1.8, 1.8], [-4.2, 1.8]);
  piso(g, parquet('#d9c3a0', '#cfb891', '#e2cdab'), [-6.0, -1.8], [-4.1, -0.3]);
  piso(g, maderaOscura, [-4.0, -0.05], [-8.4, -4.2]);
  piso(g, baldosa('#f4efe4', '#c8322e'), [0.05, 4.0], [-8.4, -4.2], 0.8);
  piso(g, baldosa('#eaf6f4', '#8fd0c8'), [1.8, 5.2], [-4.1, -0.3], 0.6);
  g.add(malla(new THREE.PlaneGeometry(11.4, 10.4), mat('#efe6d6', { tipo: 'basica' }), [-0.4, alto, -3.3], [Math.PI / 2, 0, 0]));

  // ── Paredes ──
  const PASILLO = '#f4e6cc';
  pared(g, { eje: 'z', fijo: -1.7, a: -4.1, b: 1.8, mira: 1, color: PASILLO, vanos: [vanoLateral] });
  pared(g, { eje: 'z', fijo: 1.7, a: -4.1, b: 1.8, mira: -1, color: PASILLO, vanos: [vanoLateral] });
  pared(g, { eje: 'x', fijo: -4.1, a: -1.7, b: 1.7, mira: 1, color: PASILLO, vanos: [vanoIzq, vanoFondo] });
  pared(g, { eje: 'x', fijo: 1.8, a: -1.7, b: 1.7, mira: -1, color: PASILLO });
  const CHAMBRE = '#cfe3f2';
  pared(g, { eje: 'z', fijo: -1.8, a: -4.1, b: -0.3, mira: -1, color: CHAMBRE, vanos: [vanoLateral] });
  pared(g, { eje: 'z', fijo: -6.0, a: -4.1, b: -0.3, mira: 1, color: CHAMBRE });
  pared(g, { eje: 'x', fijo: -4.1, a: -6.0, b: -1.8, mira: 1, color: CHAMBRE });
  pared(g, { eje: 'x', fijo: -0.3, a: -6.0, b: -1.8, mira: -1, color: CHAMBRE });
  const BAIN = '#bfe6e0';
  pared(g, { eje: 'z', fijo: 1.8, a: -4.1, b: -0.3, mira: 1, color: BAIN, vanos: [vanoLateral] });
  pared(g, { eje: 'z', fijo: 5.2, a: -4.1, b: -0.3, mira: -1, color: BAIN });
  pared(g, { eje: 'x', fijo: -4.1, a: 1.8, b: 5.2, mira: 1, color: BAIN });
  pared(g, { eje: 'x', fijo: -0.3, a: 1.8, b: 5.2, mira: -1, color: BAIN });
  const SALON = '#f3dcc0';
  pared(g, { eje: 'x', fijo: -4.2, a: -4.0, b: -0.05, mira: -1, color: SALON, vanos: [vanoIzq] });
  pared(g, { eje: 'x', fijo: -8.4, a: -4.0, b: -0.05, mira: 1, color: '#e9b98f' });
  pared(g, { eje: 'z', fijo: -4.0, a: -8.4, b: -4.2, mira: 1, color: SALON });
  pared(g, { eje: 'z', fijo: -0.05, a: -8.4, b: -4.2, mira: -1, color: SALON });
  const CUISINE = '#fbf0d6';
  pared(g, { eje: 'x', fijo: -4.2, a: 0.05, b: 4.0, mira: -1, color: CUISINE, vanos: [vanoFondo] });
  pared(g, { eje: 'x', fijo: -8.4, a: 0.05, b: 4.0, mira: 1, color: CUISINE });
  pared(g, { eje: 'z', fijo: 0.05, a: -8.4, b: -4.2, mira: 1, color: CUISINE });
  pared(g, { eje: 'z', fijo: 4.0, a: -8.4, b: -4.2, mira: -1, color: CUISINE });
  marcoPuerta(g, 'z', -1.75, vanoLateral);
  marcoPuerta(g, 'z', 1.75, vanoLateral);
  marcoPuerta(g, 'x', -4.15, vanoIzq);
  marcoPuerta(g, 'x', -4.15, vanoFondo);

  // ── Pasillo (l'entrée) ──
  caja(g, 1.0, 2.12, 0.06, '#2f6b8a', 0, 1.06, 1.775);
  caja(g, 0.8, 0.5, 0.02, '#3d83a6', 0, 1.55, 1.74);
  caja(g, 0.8, 0.9, 0.02, '#3d83a6', 0, 0.6, 1.74);
  bola(g, 0.035, '#e8c25a', 0.38, 1.05, 1.73);
  g.add(malla(new THREE.PlaneGeometry(0.9, 0.5), matTextura(texturaLienzo(360, 200, (x, w, h) => {
    x.fillStyle = '#8a5a36';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#f2c45a';
    x.lineWidth = 10;
    x.strokeRect(12, 12, w - 24, h - 24);
    x.fillStyle = '#fff4d6';
    x.font = '800 56px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('Bienvenue', w / 2, h / 2);
  })), [0, 0.006, 1.35], [-Math.PI / 2, 0, 0]));
  // Alfombra larga, consola con flores, espejo, perchero y cuadros
  caja(g, 1.05, 0.008, 2.3, '#b5523b', 0, 0.004, -2.35, 0, { tipo: 'lambert' });
  for (const s of [-1, 1]) caja(g, 0.06, 0.009, 2.3, '#f2c45a', s * 0.42, 0.005, -2.35, 0, { tipo: 'lambert' });
  redonda(g, 0.36, 0.05, 0.9, '#8a5a36', -1.5, 0.78, -0.55);
  for (const dz of [-0.38, 0.38]) caja(g, 0.05, 0.76, 0.05, '#5b3a22', -1.5, 0.38, -0.55 + dz);
  cil(g, 0.07, 0.05, 0.2, '#2347b8', -1.5, 0.9, -0.4, undefined, 14);
  for (let k = 0; k < 5; k++) bola(g, 0.045, ['#e3262c', '#ffffff', '#f6b623'][k % 3], -1.5 + Math.sin(k * 1.4) * 0.06, 1.08 + (k % 2) * 0.05, -0.4 + Math.cos(k * 1.4) * 0.06);
  caja(g, 0.03, 0.9, 0.6, '#5b3a22', -1.685, 1.5, -0.55);
  g.add(malla(new THREE.PlaneGeometry(0.5, 0.8), mat('#dff2ff', { tipo: 'basica' }), [-1.668, 1.5, -0.55], [0, Math.PI / 2, 0]));
  caja(g, 0.04, 0.08, 0.9, '#5b3a22', 1.675, 1.65, 1.0);
  for (const dz of [-0.3, 0, 0.3]) cil(g, 0.012, 0.012, 0.09, '#e8c25a', 1.63, 1.63, 1.0 + dz, undefined, 8).rotation.z = Math.PI / 2;
  caja(g, 0.1, 0.75, 0.3, '#c8322e', 1.6, 1.22, 1.3);
  bola(g, 0.11, '#26316e', 1.6, 1.63, 0.7, undefined, [1, 0.4, 1]);
  redonda(g, 0.36, 0.34, 0.8, '#c98a45', 1.5, 0.17, 1.05);
  cuadro(g, 1.688, 1.55, -1.1, -Math.PI / 2, 0.5, 0.68, afiche('PARIS', '#ffb347', '#e3262c'));
  cuadro(g, -1.688, 1.55, -1.45, Math.PI / 2, 0.5, 0.68, afiche('FRANCE', '#2347b8', '#8fd0ff'));
  planta(g, -1.35, 1.5, 0.28);
  lamparaTecho(g, 0, 0.6);
  lamparaTecho(g, 0, -1.5);

  // ── La chambre ──
  const ch = marco(g, 'chambre');
  // Escritorio contra la pared del frente
  redonda(ch, 1.5, 0.05, 0.6, '#d9b98a', 0, 0.755, -1.45);
  for (const [dx, dz] of [[-0.7, -0.25], [0.7, -0.25], [-0.7, 0.25], [0.7, 0.25]]) caja(ch, 0.05, 0.73, 0.05, '#b08a5a', dx, 0.365, -1.45 + dz);
  caja(ch, 0.4, 0.5, 0.5, '#c9a878', -0.5, 0.48, -1.45);
  caja(ch, 0.3, 0.02, 0.02, '#8a5a36', -0.5, 0.6, -1.19);
  caja(ch, 0.3, 0.02, 0.02, '#8a5a36', -0.5, 0.42, -1.19);
  // Libros, lámpara de escritorio y soporte de la tablet
  redonda(ch, 0.26, 0.035, 0.19, '#c8322e', -0.5, 0.798, -1.38, 0.15, 0.008);
  redonda(ch, 0.24, 0.035, 0.18, '#2f9c8f', -0.5, 0.833, -1.38, -0.1, 0.008);
  cil(ch, 0.075, 0.085, 0.02, '#2347b8', 0.6, 0.79, -1.52, undefined, 20);
  cil(ch, 0.012, 0.012, 0.3, '#2347b8', 0.6, 0.94, -1.52, undefined, 8);
  ch.add(malla(new THREE.ConeGeometry(0.11, 0.13, 20, 1, true), mat('#2347b8', { lados: THREE.DoubleSide }), [0.6, 1.12, -1.52]));
  bola(ch, 0.04, '#fff1c2', 0.6, 1.08, -1.52, { tipo: 'basica' });
  caja(ch, 0.2, 0.012, 0.1, '#5b6886', 0.1, 0.786, -1.36);
  cil(ch, 0.045, 0.04, 0.1, '#f6b623', -0.15, 0.83, -1.6, undefined, 12);
  for (let k = 0; k < 4; k++) cil(ch, 0.006, 0.006, 0.14, ['#e3262c', '#2347b8', '#2dbe78', '#1d1d27'][k], -0.15 + (k - 1.5) * 0.012, 0.92, -1.6 + (k % 2) * 0.012, undefined, 6);
  // Cama con manta de rayas
  redonda(ch, 1.1, 0.3, 2.0, '#b08a5a', -1.7, 0.15, -0.75);
  redonda(ch, 1.04, 0.18, 1.94, '#ffffff', -1.7, 0.39, -0.75);
  for (let k = 0; k < 5; k++) redonda(ch, 1.08, 0.06, 0.27, k % 2 ? '#ffffff' : '#2347b8', -1.7, 0.5, -0.82 + k * 0.27, 0, 0.02);
  redonda(ch, 0.7, 0.12, 0.36, '#fff7e6', -1.7, 0.54, -1.5, 0, 0.05);
  redonda(ch, 1.16, 0.95, 0.07, '#8a5a36', -1.7, 0.475, -1.715);
  // Armario, alfombra, ventana, afiche y lámpara
  redonda(ch, 0.55, 2.0, 1.1, '#c79a66', 1.22, 1.0, -1.15);
  caja(ch, 0.012, 1.9, 0.012, '#8a5a36', 0.94, 1.0, -1.15);
  for (const dz of [-0.08, 0.08]) bola(ch, 0.022, '#e8c25a', 0.935, 1.0, -1.15 + dz);
  ch.add(malla(new THREE.CircleGeometry(0.85, 36), mat('#7fb6e6', { tipo: 'lambert' }), [0, 0.005, -0.35], [-Math.PI / 2, 0, 0]));
  ch.add(malla(new THREE.RingGeometry(0.7, 0.76, 40), mat('#ffffff', { tipo: 'lambert' }), [0, 0.007, -0.35], [-Math.PI / 2, 0, 0]));
  ventana(ch, -1.7, 1.6, -1.745, 0, 0.9, 0.85, texturaParis(false), '#2347b8');
  cuadro(ch, -2.288, 1.5, -0.2, Math.PI / 2, 0.55, 0.75, afiche('PARIS', '#8fd0ff', '#ffd9a0'), '#ffffff');
  cuadro(ch, 0.55, 1.95, -1.738, 0, 0.42, 0.3, (x, w, h) => {
    ['#2347b8', '#ffffff', '#e3262c'].forEach((c, i) => {
      x.fillStyle = c;
      x.fillRect((i * w) / 3, 0, w / 3 + 1, h);
    });
  }, '#ffffff');
  // Estante con juguetes en la pared izquierda
  caja(ch, 0.2, 0.03, 0.9, '#c79a66', -2.2, 1.0, 0.75);
  bola(ch, 0.09, '#f6b623', -2.2, 1.1, 0.55);
  bola(ch, 0.07, '#e3262c', -2.2, 1.085, 0.8);
  caja(ch, 0.12, 0.14, 0.12, '#2dbe78', -2.2, 1.085, 1.02);
  lamparaTecho(ch, 0, -0.5, { color: '#7fb6e6' });

  // ── Le salon ──
  const sa = marco(g, 'salon');
  sa.add(malla(new THREE.PlaneGeometry(2.3, 1.7), mat('#b5523b', { tipo: 'lambert' }), [0.1, 0.005, -1.6], [-Math.PI / 2, 0, 0]));
  sa.add(malla(new THREE.PlaneGeometry(2.0, 1.4), mat('#f2c45a', { tipo: 'lambert' }), [0.1, 0.007, -1.6], [-Math.PI / 2, 0, 0]));
  sa.add(malla(new THREE.PlaneGeometry(1.86, 1.26), mat('#c8643f', { tipo: 'lambert' }), [0.1, 0.009, -1.6], [-Math.PI / 2, 0, 0]));
  // Mueble y cuerpo de la tele (la pantalla la dibuja la escena)
  redonda(sa, 1.6, 0.45, 0.42, '#5b3a22', 0.55, 0.225, -2.66);
  for (const dx of [-0.4, 0.4]) caja(sa, 0.7, 0.36, 0.012, '#7a4b2c', 0.55 + dx, 0.225, -2.445);
  caja(sa, 0.3, 0.05, 0.2, '#1d1d27', 0.55, 0.475, -2.68);
  caja(sa, 0.08, 0.38, 0.05, '#1d1d27', 0.55, 0.67, -2.72);
  redonda(sa, 1.38, 0.82, 0.05, '#1d1d27', 0.55, 1.3, -2.76, 0, 0.02);
  // Ventana con París
  ventana(sa, -1.15, 1.5, -2.895, 0, 1.3, 1.15, texturaParis(true), '#c8322e');
  // Sofá azul con cojines
  redonda(sa, 0.85, 0.42, 1.9, '#3d6fb8', -1.52, 0.21, -1.15);
  redonda(sa, 0.22, 0.85, 1.9, '#3565aa', -1.86, 0.425, -1.15);
  for (const dz of [-0.98, 0.98]) redonda(sa, 0.85, 0.62, 0.16, '#3565aa', -1.52, 0.31, -1.15 + dz);
  for (const [dz, c] of [[-0.5, '#ffffff'], [0, '#e3262c'], [0.5, '#f6b623']]) redonda(sa, 0.14, 0.34, 0.36, c, -1.68, 0.6, -1.15 + dz, 0, 0.06).rotation.z = -0.2;
  // Mesa de centro, mesita del control y sillón
  redonda(sa, 0.95, 0.05, 0.5, '#8a5a36', 0.05, 0.4, -1.95);
  for (const [dx, dz] of [[-0.42, -0.2], [0.42, -0.2], [-0.42, 0.2], [0.42, 0.2]]) caja(sa, 0.04, 0.38, 0.04, '#5b3a22', 0.05 + dx, 0.19, -1.95 + dz);
  redonda(sa, 0.26, 0.03, 0.2, '#2f9c8f', -0.15, 0.44, -1.95, 0.3, 0.008);
  cil(sa, 0.045, 0.04, 0.08, '#ffffff', 0.3, 0.465, -2.0, undefined, 14);
  cil(sa, 0.19, 0.19, 0.03, '#8a5a36', -0.25, 0.905, -1.3, undefined, 24);
  cil(sa, 0.03, 0.03, 0.88, '#5b3a22', -0.25, 0.45, -1.3, undefined, 10);
  cil(sa, 0.15, 0.15, 0.02, '#5b3a22', -0.25, 0.01, -1.3, undefined, 20);
  caja(sa, 0.1, 0.05, 0.06, '#5b6886', -0.25, 0.945, -1.33);
  redonda(sa, 0.7, 0.4, 0.7, '#c8643f', 1.4, 0.2, -1.45, -0.5);
  redonda(sa, 0.7, 0.75, 0.16, '#b85a38', 1.62, 0.5, -1.33, -0.5 + Math.PI / 2);
  // Lámpara de pie, librero, cuadro y planta
  cil(sa, 0.13, 0.15, 0.03, '#2b2b33', 1.6, 0.015, -2.5, undefined, 20);
  cil(sa, 0.012, 0.012, 1.3, '#2b2b33', 1.6, 0.66, -2.5, undefined, 8);
  sa.add(malla(new THREE.CylinderGeometry(0.11, 0.18, 0.28, 24, 1, true), mat('#fff1c2', { tipo: 'basica', lados: THREE.DoubleSide }), [1.6, 1.42, -2.5]));
  redonda(sa, 0.3, 1.9, 1.0, '#8a5a36', 1.78, 0.95, -0.35);
  for (let f = 0; f < 4; f++) for (let k = 0; k < 7; k++) caja(sa, 0.2, 0.3 + ((k * 7 + f) % 3) * 0.03, 0.09, ['#c8322e', '#2347b8', '#2dbe78', '#f6b623', '#7a2f45', '#ffffff'][(k + f * 2) % 6], 1.7, 0.3 + f * 0.45, -0.75 + k * 0.12);
  cuadro(sa, -3.95 + 2.0, 1.75, -1.15, Math.PI / 2, 0.9, 0.55, (x, w, h) => {
    x.fillStyle = '#fff4d6';
    x.fillRect(0, 0, w, h);
    x.font = `${Math.round(h * 0.6)}px system-ui, "Segoe UI Emoji", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('🥐 ☕', w / 2, h * 0.55);
  });
  planta(sa, -1.75, -2.65, 0.3);
  lamparaTecho(sa, 0.1, -1.4, { color: '#c8322e' });

  // ── La cuisine ──
  // (los muebles se midieron con el estudiante a 1,5 m de la pared; ahora se para a 1,9 m)
  const cu = new THREE.Group();
  cu.position.z = -0.4;
  marco(g, 'cuisine').add(cu);
  // Mesón con fregadero y cocina
  caja(cu, 2.0, 0.86, 0.58, '#3d83a6', 0.4, 0.43, -1.21);
  redonda(cu, 2.04, 0.05, 0.64, '#f4efe4', 0.4, 0.885, -1.19, 0, 0.015);
  for (let k = 0; k < 4; k++) {
    caja(cu, 0.44, 0.7, 0.012, '#4a93b8', -0.35 + k * 0.5, 0.45, -0.915);
    bola(cu, 0.018, '#e8c25a', -0.2 + k * 0.5, 0.62, -0.905);
  }
  caja(cu, 0.46, 0.012, 0.36, '#9aa6b5', 0.25, 0.913, -1.2);
  caja(cu, 0.4, 0.014, 0.3, '#5b6886', 0.25, 0.916, -1.2);
  cil(cu, 0.016, 0.016, 0.2, '#c9ccd4', 0.25, 1.01, -1.4, undefined, 10);
  cil(cu, 0.014, 0.014, 0.14, '#c9ccd4', 0.25, 1.1, -1.34, undefined, 10).rotation.x = Math.PI / 2;
  caja(cu, 0.56, 0.012, 0.5, '#1d1d27', 1.0, 0.915, -1.2);
  for (const [dx, dz] of [[-0.13, -0.11], [0.13, -0.11], [-0.13, 0.11], [0.13, 0.11]]) cu.add(malla(new THREE.RingGeometry(0.06, 0.075, 24), mat('#c8322e', { tipo: 'basica' }), [1.0 + dx, 0.923, -1.2 + dz], [-Math.PI / 2, 0, 0]));
  cil(cu, 0.09, 0.1, 0.13, '#e3262c', 1.13, 0.99, -1.31, undefined, 16);
  // Azulejos y repisa con frascos
  const azulejo = texturaLienzo(128, 128, (x, w) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, w);
    x.fillStyle = '#8fd0ff';
    x.fillRect(0, 0, w / 2 - 2, w / 2 - 2);
    x.fillRect(w / 2, w / 2, w / 2 - 2, w / 2 - 2);
  }, [8, 2.5]);
  cu.add(malla(new THREE.PlaneGeometry(2.0, 0.66), matTextura(azulejo), [0.4, 1.24, -1.494]));
  caja(cu, 2.0, 0.035, 0.2, '#8a5a36', 0.4, 1.7, -1.4);
  for (let k = 0; k < 7; k++) cil(cu, 0.055, 0.055, 0.16, ['#e8b04a', '#c8322e', '#2dbe78', '#f5f1e8', '#7a4a2a'][k % 5], -0.4 + k * 0.27, 1.8, -1.4, undefined, 12);
  // Panes en una canasta
  cil(cu, 0.14, 0.11, 0.1, '#c98a45', -0.3, 0.96, -1.22, undefined, 16);
  for (let k = 0; k < 3; k++) cu.add(malla(new THREE.CapsuleGeometry(0.03, 0.34, 4, 10), mat('#d9a35c'), [-0.33 + k * 0.035, 1.1, -1.22], [0.15, 0, -0.25 + k * 0.2]));
  // Refrigeradora
  redonda(cu, 0.7, 1.85, 0.66, '#dfe6ee', -1.0, 0.925, -1.17);
  caja(cu, 0.66, 0.012, 0.012, '#9aa6b5', -1.0, 1.25, -0.838);
  for (const y of [1.45, 1.05]) caja(cu, 0.03, 0.26, 0.03, '#9aa6b5', -0.73, y, -0.825);
  for (const [dx, dy, c] of [[-0.15, 1.6, '#e3262c'], [0.05, 1.55, '#2347b8'], [-0.05, 1.72, '#f6b623']]) caja(cu, 0.06, 0.06, 0.012, c, -1.0 + dx, dy, -0.836);
  // Mesa con mantel, queso y frutas, y dos sillas
  cil(cu, 0.5, 0.5, 0.04, '#e3262c', -2.0, 0.76, 0.55, undefined, 28);
  cil(cu, 0.46, 0.46, 0.045, '#ffffff', -2.0, 0.762, 0.55, undefined, 28);
  cil(cu, 0.05, 0.05, 0.74, '#5b3a22', -2.0, 0.37, 0.55, undefined, 10);
  cil(cu, 0.24, 0.24, 0.03, '#5b3a22', -2.0, 0.015, 0.55, undefined, 20);
  cil(cu, 0.15, 0.1, 0.08, '#2347b8', -2.0, 0.83, 0.55, undefined, 16);
  for (let k = 0; k < 4; k++) bola(cu, 0.05, ['#e3262c', '#f6b623', '#2dbe78', '#ff9a1f'][k], -2.0 + Math.cos(k * 1.6) * 0.06, 0.9, 0.55 + Math.sin(k * 1.6) * 0.06);
  cu.add(malla(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 3), mat('#f6c94a'), [-1.75, 0.81, 0.4]));
  for (const [dx, dz, ry] of [[-0.75, 0, Math.PI / 2], [0.75, 0, -Math.PI / 2]]) {
    const silla = new THREE.Group();
    silla.position.set(-2.0 + dx, 0, 0.55 + dz);
    silla.rotation.y = ry;
    caja(silla, 0.4, 0.04, 0.4, '#c98a45', 0, 0.45, 0);
    for (const [ax, az] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) caja(silla, 0.035, 0.45, 0.035, '#5b3a22', ax, 0.225, az);
    caja(silla, 0.4, 0.42, 0.04, '#c98a45', 0, 0.7, -0.19);
    cu.add(silla);
  }
  // Ventana con la persiana cerrada (por eso la cocina está oscura)
  ventana(cu, -2.795, 1.55, -0.4, Math.PI / 2, 1.0, 0.9, texturaLienzo(64, 64, (x, w) => {
    x.fillStyle = '#39405e';
    x.fillRect(0, 0, w, w);
    x.fillStyle = '#2a3050';
    for (let i = 0; i < 8; i++) x.fillRect(0, i * 8, w, 2);
  }), null);
  // Lámpara del techo: la bombilla la enciende la escena
  cil(cu, 0.006, 0.006, 0.25, '#2b2b33', 0, alto - 0.125, -0.5, undefined, 6);
  cu.add(malla(new THREE.ConeGeometry(0.26, 0.22, 24, 1, true), mat('#f6b623', { lados: THREE.DoubleSide }), [0, alto - 0.34, -0.5]));

  // ── La salle de bain ──
  const ba = marco(g, 'bain');
  redonda(ba, 1.7, 0.56, 0.76, '#ffffff', -0.1, 0.28, -1.37, 0, 0.08);
  caja(ba, 1.5, 0.02, 0.56, '#8fd8f0', -0.1, 0.5, -1.37, 0, { tipo: 'basica' });
  cil(ba, 0.018, 0.018, 0.22, '#c9ccd4', -0.82, 0.66, -1.37, undefined, 10);
  cil(ba, 0.015, 0.015, 0.16, '#c9ccd4', -0.76, 0.77, -1.37, undefined, 10).rotation.z = Math.PI / 2;
  cil(ba, 0.012, 0.012, 0.24, '#bfe9ff', -0.69, 0.63, -1.37, { tipo: 'basica', opacidad: 0.7 }, 8);
  // Lavamanos con espejo (pared izquierda)
  cil(ba, 0.07, 0.09, 0.78, '#ffffff', -1.3, 0.39, -0.1, undefined, 14);
  redonda(ba, 0.36, 0.14, 0.5, '#ffffff', -1.3, 0.83, -0.1, 0, 0.05);
  cil(ba, 0.012, 0.012, 0.14, '#c9ccd4', -1.43, 0.97, -0.1, undefined, 8);
  caja(ba, 0.03, 0.75, 0.55, '#fffaf0', -1.485, 1.5, -0.1);
  ba.add(malla(new THREE.PlaneGeometry(0.47, 0.67), mat('#dff2ff', { tipo: 'basica' }), [-1.468, 1.5, -0.1], [0, Math.PI / 2, 0]));
  // Toallas, alfombrita, repisa con frascos y ventana
  caja(ba, 0.9, 0.025, 0.025, '#c9ccd4', 1.15, 1.3, -1.72);
  ['#2347b8', '#ffffff', '#e3262c'].forEach((c, i) => caja(ba, 0.24, 0.5, 0.03, c, 0.87 + i * 0.28, 1.06, -1.7));
  redonda(ba, 0.8, 0.02, 0.5, '#2f9c8f', 0.3, 0.012, -0.7, 0, 0.008);
  caja(ba, 0.6, 0.03, 0.16, '#fffaf0', -0.95, 1.35, -1.66);
  for (let k = 0; k < 3; k++) cil(ba, 0.035, 0.04, 0.14, ['#f6b623', '#e87ab0', '#7fb6e6'][k], -1.15 + k * 0.2, 1.435, -1.66, undefined, 12);
  ventana(ba, 1.2, 1.95, -1.745, 0, 0.6, 0.45, texturaParis(false), null);
  lamparaTecho(ba, 0, -0.5, { color: '#8fd0c8' });
  // Patito de hule que flota
  const pato = new THREE.Group();
  bola(pato, 0.06, '#f6c21c', 0, 0.03, 0, undefined, [1.2, 0.8, 1]);
  bola(pato, 0.04, '#f6c21c', 0.05, 0.085, 0);
  pato.add(malla(new THREE.ConeGeometry(0.016, 0.04, 8), mat('#ff8a1f'), [0.095, 0.08, 0], [0, 0, -Math.PI / 2]));
  for (const s of [-1, 1]) bola(pato, 0.007, '#1d1d27', 0.075, 0.098, s * 0.022, { tipo: 'basica' });
  fusionar(pato);
  pato.userData.noFusionar = true;
  pato.position.set(0.25, 0.51, -1.37);
  ba.add(pato);
  ctx.cada((_dt, t) => {
    pato.position.y = 0.51 + Math.sin(t * 1.8) * 0.008;
    pato.position.x = 0.25 + Math.sin(t * 0.4) * 0.25;
    pato.rotation.y = Math.sin(t * 0.3) * 1.2;
  });
  // Vapor sobre la tina
  motas(g, ctx, { caja: [4.5, 5.15, 0.55, 1.7, -3.5, -1.9], cantidad: 26, color: '#ffffff', tam: 0.05, opacidad: 0.3, velocidad: 0.1 });
  // Brillo cálido en el pasillo
  motas(g, ctx, { caja: [-1.5, 1.5, 0.6, 2.4, -3.9, 1.6], cantidad: 34, color: '#ffe9b0', tam: 0.016, opacidad: 0.4, velocidad: 0.02 });

  return { fondo: '#141a33', luz: [0xfff2e0, 0x9a8468, 2.45], api: { maison: MAISON } };
}

export const entornosMaison = { appartement };
