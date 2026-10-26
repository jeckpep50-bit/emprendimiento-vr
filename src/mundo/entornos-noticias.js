import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla } from './materiales.js';
import { texturaLienzo, matTextura, cielo, cartel, habitacion } from './entornos.js';
import { noticias, logoNoticiero } from './prefabs/noticias.js';
import { motas, nubes, palomas, cadaTanto, puntoSuave } from './vida.js';
import { PanelLienzo, escribir, FUENTE } from '../ui/lienzo.js';

// Entornos de la lección de la descripción: el estudio del noticiero, la Plaza
// Grande de Quito y un mirador frente al Cotopaxi en erupción. Lo que se anima
// lleva userData.noFusionar (el resto se fusiona en pocas mallas).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const azar = (a, b) => a + Math.random() * (b - a);

function animado(obj) {
  obj.userData.noFusionar = true;
  return obj;
}

// ── Estudio de televisión ─────────────────────────────────────────────────

/** Silueta de Quito: montañas, el Panecillo con la Virgen y casas. */
function dibujarQuito(ctx, w, h, { cielo1 = '#1b3a6b', cielo2 = '#e8875a' } = {}) {
  const gr = ctx.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, cielo1);
  gr.addColorStop(1, cielo2);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2c3e66';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  [[0.15, 0.4], [0.3, 0.52], [0.45, 0.35], [0.6, 0.5], [0.78, 0.38], [1, 0.55]].forEach(([x, y]) => ctx.lineTo(w * x, h * y));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // El Panecillo con la Virgen
  ctx.fillStyle = '#22314f';
  ctx.beginPath();
  ctx.ellipse(w * 0.7, h * 0.78, w * 0.12, h * 0.16, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(w * 0.697, h * 0.5, w * 0.006, h * 0.13);
  ctx.beginPath();
  ctx.moveTo(w * 0.7, h * 0.47);
  ctx.lineTo(w * 0.685, h * 0.53);
  ctx.lineTo(w * 0.715, h * 0.53);
  ctx.fill();
  // Casas con ventanas encendidas
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * w;
    const alto = h * (0.12 + ((i * 37) % 9) * 0.015);
    ctx.fillStyle = '#18233d';
    ctx.fillRect(x, h - alto, w / 28, alto);
    ctx.fillStyle = '#ffd77a';
    for (let k = 0; k < 3; k++) if ((i + k) % 3) ctx.fillRect(x + w * 0.008, h - alto + 8 + k * alto * 0.3, w * 0.008, w * 0.008);
  }
}

function estudio(g, ctx) {
  const piso = texturaLienzo(256, 256, (x, w) => {
    x.fillStyle = '#141a2c';
    x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(120, 160, 255, 0.18)';
    x.lineWidth = 3;
    x.strokeRect(0, 0, w, w);
  });
  piso.wrapS = piso.wrapT = THREE.RepeatWrapping;
  piso.repeat.set(10, 9);
  habitacion(g, { ancho: 10, fondo: 9, alto: 3.8, suelo: matTextura(piso), pared: mat('#1b2033', { tipo: 'lambert' }), techo: mat('#0e121c', { tipo: 'basica' }) });
  // Círculo del set
  g.add(malla(new THREE.CircleGeometry(2.2, 48), mat('#22305a', { tipo: 'lambert' }), [0, 0.004, -2.2], [-Math.PI / 2, 0, 0]));
  g.add(malla(new THREE.RingGeometry(2.14, 2.22, 64), mat('#d62839', { tipo: 'basica' }), [0, 0.006, -2.2], [-Math.PI / 2, 0, 0]));

  // Escritorio de noticias (curvo) con el logo
  // Escritorio curvo: su frente queda a unos 2,3 m del estudiante
  g.add(malla(new THREE.CylinderGeometry(1.3, 1.3, 0.95, 40, 1, false, -0.7, 1.4), mat('#e6ebf8'), [0, 0.475, -3.6]));
  g.add(malla(new THREE.CylinderGeometry(1.36, 1.36, 0.05, 40, 1, false, -0.75, 1.5), mat('#2b3550'), [0, 0.97, -3.6]));
  const logoMesa = logoNoticiero(1.0, 0.2);
  logoMesa.position.set(0, 0.62, -2.29);
  g.add(logoMesa);

  // Cámaras, luces y monitores
  for (const [x, z, ry] of [[-2.2, -0.6, -2.4], [2.2, -0.6, 2.4], [-3.4, 2.6, -1.0]]) {
    const c = noticias.camara_tv();
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    g.add(c);
  }
  for (const x of [-3, 3]) {
    g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), mat('#2b2b33'), [x, 0.65, -2.6]));
    g.add(malla(new RoundedBoxGeometry(1.1, 0.66, 0.06, 2, 0.02), mat('#2b2b33'), [x, 1.6, -2.6], [0, -Math.sign(x) * 0.5, 0]));
  }
  // Rieles de luces en el techo
  for (const z of [-2.5, 0.5]) {
    g.add(malla(new THREE.BoxGeometry(8, 0.08, 0.08), mat('#3a4250'), [0, 3.4, z]));
    for (let i = 0; i < 5; i++) {
      g.add(malla(new THREE.CylinderGeometry(0.1, 0.14, 0.24, 14), mat('#2b2b33'), [-3 + i * 1.5, 3.22, z], [0.5, 0, 0]));
      g.add(malla(new THREE.CircleGeometry(0.1, 14), mat('#fff6c2', { tipo: 'basica' }), [-3 + i * 1.5, 3.12, z + 0.06], [Math.PI / 2 + 0.5, 0, 0]));
    }
  }

  // Pared de LED detrás del escritorio (la escena puede dibujar en ella)
  g.add(malla(new THREE.BoxGeometry(6.4, 2.9, 0.1), mat('#0b0f18'), [0, 1.85, -4.42]));
  const porDefecto = (c, w, h) => {
    dibujarQuito(c, w, h);
    c.fillStyle = 'rgba(214, 40, 57, 0.92)';
    c.fillRect(0, h * 0.06, w * 0.42, h * 0.16);
    escribir(c, '● QUITO EN VIVO', w * 0.03, h * 0.14, { tam: h * 0.09, peso: 900, color: '#ffffff', base: 'middle' });
  };
  let dibujar = porDefecto;
  const pared = animado(new PanelLienzo(6.2, 2.7, (c, w, h) => dibujar(c, w, h), { pxPorMetro: 200 }));
  pared.position.set(0, 1.85, -4.36);
  g.add(pared);
  // Letrero "AL AIRE" (se enciende en la transmisión)
  const alAire = animado(cartel('AL AIRE', 1.0, 0.26, { fondo: '#5a1a22', color: '#ffb3b3' }));
  alAire.position.set(0, 3.45, -4.3);
  g.add(alAire);
  // Cinta de noticias que corre al pie de la pared
  const cinta = animado(new PanelLienzo(6.2, 0.22, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#d62839';
    c.fillRect(0, 0, h * 3.2, h);
    escribir(c, 'ÚLTIMA HORA', h * 1.6, h / 2, { tam: h * 0.5, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle' });
    const texto = 'Heroína misteriosa en la Plaza Grande  ·  Choque en el mercado: nadie salió herido  ·  El Cotopaxi en erupción: mirador seguro  ·  ';
    c.font = `800 ${h * 0.5}px ${FUENTE}`;
    const ancho = c.measureText(texto).width;
    const x0 = h * 3.4 - ((performance.now() * 0.12) % ancho);
    c.fillStyle = '#23304a';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    for (let x = x0; x < w; x += ancho) c.fillText(texto, x, h / 2);
  }, { pxPorMetro: 220 }));
  cinta.position.set(0, 0.6, -4.35);
  g.add(cinta);
  let reloj = 0;
  ctx.cada((dt) => {
    reloj += dt;
    if (reloj > 0.08) {
      reloj = 0;
      cinta.redibujar();
    }
  });
  motas(g, ctx, { caja: [-3, 3, 0.5, 3.2, -3.5, 1], cantidad: 90, color: '#ffe9b0', tam: 0.02, opacidad: 0.5, velocidad: 0.02 });

  return {
    fondo: '#141824',
    luz: [0xffffff, 0x2a3050, 2.5],
    api: {
      /** Cambia lo que muestra la pared de LED (función ctx, w, h) o vuelve a la de siempre. */
      pantalla(fn) {
        dibujar = fn ?? porDefecto;
        pared.redibujar();
      },
      redibujarPantalla: () => pared.redibujar(),
      alAire(v) {
        alAire.material.color.set(v ? '#ffffff' : '#7a7a7a');
        alAire.scale.setScalar(v ? 1.1 : 1);
      },
    },
  };
}

// ── Plaza Grande de Quito ──────────────────────────────────────────────────

function arcos(g, { x, z, ry, largo, alto, pisos = 2, color = '#f7f3ea', arco = '#3b3f4a', columnas = true }) {
  const f = new THREE.Group();
  f.add(malla(new THREE.BoxGeometry(largo, alto, 1.2), mat(color, { tipo: 'lambert' }), [0, alto / 2, 0]));
  f.add(malla(new THREE.BoxGeometry(largo + 0.4, 0.3, 1.5), mat('#c0543c'), [0, alto + 0.15, 0]));
  const n = Math.floor(largo / 2.2);
  for (let i = 0; i < n; i++) {
    const ax = (i - (n - 1) / 2) * 2.2;
    // Arcos de los portales (planta baja)
    f.add(malla(new THREE.PlaneGeometry(1.5, 2.4), mat(arco, { tipo: 'basica' }), [ax, 1.2, 0.61]));
    f.add(malla(new THREE.CircleGeometry(0.75, 16, 0, Math.PI), mat(arco, { tipo: 'basica' }), [ax, 2.4, 0.61]));
    // Balcones y ventanas (pisos altos)
    for (let p = 1; p < pisos; p++) {
      f.add(malla(new THREE.PlaneGeometry(0.9, 1.4), mat('#5e86a8', { tipo: 'basica' }), [ax, 2.4 + p * 2.8, 0.61]));
      f.add(malla(new THREE.BoxGeometry(1.3, 0.08, 0.45), mat('#3a2a20'), [ax, 1.75 + p * 2.8, 0.8]));
      f.add(malla(new THREE.BoxGeometry(1.3, 0.5, 0.04), mat('#3a2a20'), [ax, 2.0 + p * 2.8, 1.02]));
    }
    if (columnas) f.add(malla(new THREE.CylinderGeometry(0.16, 0.18, 3.0, 12), mat('#ffffff'), [ax + 1.1, 1.5, 0.75]));
  }
  f.position.set(x, 0, z);
  f.rotation.y = ry;
  g.add(f);
  return f;
}

function palmera(g, x, z, alto = 5) {
  g.add(malla(new THREE.CylinderGeometry(0.12, 0.2, alto, 8), mat('#8d6e63'), [x, alto / 2, z]));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(malla(new THREE.ConeGeometry(0.25, 1.9, 6), mat(i % 2 ? '#2e7d32' : '#43a047'), [x + Math.cos(a) * 0.75, alto - 0.2, z + Math.sin(a) * 0.75], [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25], [1, 1, 0.25]));
  }
}

function plaza(g, ctx) {
  g.add(cielo('#4aa3f0', '#e6f6ff'));
  g.add(malla(new THREE.CircleGeometry(60, 48), mat('#8fa36b', { tipo: 'lambert' }), [0, -0.02, 0], [-Math.PI / 2, 0, 0]));
  const adoquin = texturaLienzo(256, 256, (x, w) => {
    x.fillStyle = '#cfc8b8';
    x.fillRect(0, 0, w, w);
    x.strokeStyle = '#b4ab98';
    x.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      x.beginPath();
      x.moveTo(0, i * 32);
      x.lineTo(w, i * 32);
      x.stroke();
      for (let j = 0; j < 8; j++) {
        x.beginPath();
        x.moveTo(j * 32 + (i % 2) * 16, i * 32);
        x.lineTo(j * 32 + (i % 2) * 16, i * 32 + 32);
        x.stroke();
      }
    }
  });
  adoquin.wrapS = adoquin.wrapT = THREE.RepeatWrapping;
  adoquin.repeat.set(14, 14);
  g.add(malla(new THREE.PlaneGeometry(32, 32), matTextura(adoquin), [0, 0, -4], [-Math.PI / 2, 0, 0]));

  // Monumento a los Héroes de la Independencia (centro de la plaza)
  const mx = 0;
  const mz = -8;
  [[3.2, 0.3], [2.4, 0.6], [1.6, 0.9]].forEach(([lado, y]) => g.add(malla(new THREE.BoxGeometry(lado, 0.3, lado), mat('#d8d2c4', { tipo: 'lambert' }), [mx, y - 0.15, mz])));
  g.add(malla(new THREE.BoxGeometry(1.2, 2.2, 1.2), mat('#e8e2d4', { tipo: 'lambert' }), [mx, 2.0, mz]));
  g.add(malla(new THREE.CylinderGeometry(0.42, 0.5, 8.5, 20), mat('#efe9dc', { tipo: 'lambert' }), [mx, 7.35, mz]));
  g.add(malla(new THREE.BoxGeometry(1.0, 0.35, 1.0), mat('#d8d2c4'), [mx, 11.7, mz]));
  // La Libertad (estatua) arriba y el cóndor de bronce abajo
  g.add(malla(new THREE.ConeGeometry(0.35, 1.4, 12), mat('#c9a94a'), [mx, 12.6, mz]));
  g.add(malla(new THREE.SphereGeometry(0.18, 12, 10), mat('#c9a94a'), [mx, 13.45, mz]));
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), mat('#c9a94a'), [mx + 0.3, 13.4, mz], [0, 0, -0.3]));
  for (const lado of [-1, 1]) g.add(malla(new THREE.BoxGeometry(1.2, 0.06, 0.4), mat('#5a4a2a'), [mx + lado * 0.75, 3.3, mz + 0.65], [0, 0, lado * 0.25]));
  g.add(malla(new THREE.SphereGeometry(0.28, 12, 10), mat('#5a4a2a'), [mx, 3.25, mz + 0.65], [0, 0, 0], [0.8, 1, 1.3]));
  // Jardines alrededor del monumento
  for (const [x, z] of [[-4, -4.5], [4, -4.5], [-4, -11.5], [4, -11.5]]) {
    g.add(malla(new THREE.BoxGeometry(3.6, 0.35, 3.6), mat('#b5a98f'), [x, 0.17, z]));
    g.add(malla(new THREE.BoxGeometry(3.3, 0.06, 3.3), mat('#4caf50', { tipo: 'lambert' }), [x, 0.37, z]));
    palmera(g, x, z, 5.5 + ((x + z) % 2));
    for (let i = 0; i < 6; i++) g.add(malla(new THREE.SphereGeometry(0.22, 10, 8), mat(['#ff5aa5', '#ffc23c', '#e5484d'][i % 3]), [x - 1.3 + (i % 3) * 1.3, 0.5, z + (i < 3 ? -1.3 : 1.3)]));
  }
  // Bancas y faroles
  for (const [x, z, ry] of [[-6.5, -2, Math.PI / 2], [6.5, -2, -Math.PI / 2], [-6.5, -14, Math.PI / 2], [6.5, -14, -Math.PI / 2]]) {
    const b = new THREE.Group();
    b.add(malla(new RoundedBoxGeometry(1.6, 0.07, 0.45, 2, 0.02), mat('#3a6b3f'), [0, 0.45, 0]));
    b.add(malla(new RoundedBoxGeometry(1.6, 0.35, 0.06, 2, 0.02), mat('#3a6b3f'), [0, 0.72, -0.2]));
    for (const bx of [-0.7, 0.7]) b.add(malla(new THREE.BoxGeometry(0.06, 0.45, 0.4), mat('#2b2b33'), [bx, 0.22, 0]));
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    g.add(b);
  }
  for (const [x, z] of [[-8, 2], [8, 2], [-8, -10], [8, -10], [-3, 3], [3, 3]]) {
    g.add(malla(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 8), mat('#2b2b33'), [x, 1.7, z]));
    g.add(malla(new THREE.BoxGeometry(0.34, 0.45, 0.34), mat('#2b2b33'), [x, 3.55, z]));
    g.add(malla(new THREE.BoxGeometry(0.26, 0.35, 0.26), mat('#fff2b3', { tipo: 'basica' }), [x, 3.55, z]));
  }

  // Edificios alrededor: Carondelet (al frente), la Catedral (izquierda), el Palacio Arzobispal (derecha) y el Municipio (atrás)
  arcos(g, { x: 0, z: -21, ry: 0, largo: 26, alto: 9, pisos: 3 });
  const tim = cartel('PALACIO DE CARONDELET', 6, 0.6, { fondo: '#f7f3ea', color: '#3b3f4a' });
  tim.position.set(0, 8.4, -20.38);
  g.add(tim);
  g.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 4, 8), mat('#c9d2de'), [0, 11.0, -20.6]));
  arcos(g, { x: -15, z: -6, ry: Math.PI / 2, largo: 22, alto: 8.5, pisos: 2, columnas: false });
  // Torre y cúpulas verdes de la Catedral
  g.add(malla(new THREE.BoxGeometry(3, 15, 3), mat('#f7f3ea', { tipo: 'lambert' }), [-15, 7.5, -12]));
  g.add(malla(new THREE.BoxGeometry(2.2, 2.6, 2.2), mat('#f7f3ea'), [-15, 16.3, -12]));
  for (const [x, z] of [[1.11, 0], [-1.11, 0], [0, 1.11], [0, -1.11]]) g.add(malla(new THREE.PlaneGeometry(0.8, 1.6), mat('#3b3f4a', { tipo: 'basica' }), [-15 + x, 16.3, -12 + z], [0, Math.atan2(x, z), 0]));
  g.add(malla(new THREE.ConeGeometry(1.7, 2.6, 4), mat('#2e8b57'), [-15, 18.9, -12], [0, Math.PI / 4, 0]));
  g.add(malla(new THREE.SphereGeometry(2.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2e8b57'), [-17, 8.5, -3]));
  g.add(malla(new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2e8b57'), [-17, 8.5, 3.5]));
  arcos(g, { x: 15, z: -6, ry: -Math.PI / 2, largo: 22, alto: 8, pisos: 2, color: '#f6efd8' });
  arcos(g, { x: 0, z: 12, ry: Math.PI, largo: 26, alto: 10, pisos: 3, color: '#e9e6df', arco: '#4a5260' });
  // Pichincha al fondo
  for (const [x, z, h, r] of [[-40, -40, 22, 26], [-10, -55, 18, 24], [30, -50, 14, 20], [-50, 10, 16, 22]]) g.add(malla(new THREE.ConeGeometry(r, h, 20), mat('#5f7d55', { tipo: 'lambert' }), [x, h / 2 - 1, z]));

  // Bandera del Ecuador sobre Carondelet (ondea)
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 200;
  const x2 = c.getContext('2d');
  [['#ffd100', 0, 100], ['#034ea2', 100, 50], ['#ed1c24', 150, 50]].forEach(([col, y, h]) => {
    x2.fillStyle = col;
    x2.fillRect(0, y, 300, h);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(2.4, 1.6, 16, 6);
  const bandera = animado(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })));
  bandera.position.set(1.2, 12.1, -20.6);
  g.add(bandera);
  const base = Float32Array.from(geo.attributes.position.array);
  ctx.cada((_dt, t) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const k = (bx + 1.2) / 2.4;
      pos.setZ(i, Math.sin(bx * 3 - t * 4) * 0.15 * k);
    }
    pos.needsUpdate = true;
  });

  const vivos = new THREE.Group();
  vivos.userData.noFusionar = true;
  g.add(vivos);
  palomas(vivos, ctx);
  nubes(vivos, ctx);
  motas(vivos, ctx, { caja: [-6, 6, 0.3, 3, -8, 3], cantidad: 60, color: '#fffbd0', tam: 0.03 });
  cadaTanto(ctx, [3, 7], () => {
    const a = Math.random() * Math.PI * 2;
    ctx.audio.pajaro(g.localToWorld(V(Math.cos(a) * 8, 4, Math.sin(a) * 8)));
  });
  return { fondo: '#bfe6ff', niebla: ['#d5efff', 30, 90], luz: [0xffffff, 0x9c8a74, 2.6] };
}

// ── Mirador frente al Cotopaxi en erupción ─────────────────────────────────

function volcan(g, ctx) {
  // Cielo más grande que el de siempre: el volcán está a 75 m y su ceniza sube mucho
  const firmamento = cielo('#6f6463', '#e2b48a');
  firmamento.scale.setScalar(2.8);
  g.add(firmamento);
  g.add(malla(new THREE.CircleGeometry(80, 48), mat('#a39d5c', { tipo: 'lambert' }), [0, -0.01, 0], [-Math.PI / 2, 0, 0]));
  // Paja de páramo (ichu) en una sola malla instanciada
  const paja = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.45, 5), new THREE.MeshLambertMaterial({ color: '#c9b860' }), 260);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 22;
    const s = 0.6 + Math.random() * 0.9;
    m.compose(V(Math.cos(a) * r, 0.2 * s, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(azar(-0.2, 0.2), 0, azar(-0.2, 0.2))), V(s, s, s));
    paja.setMatrixAt(i, m);
  }
  g.add(animado(paja));
  // Carretera detrás del mirador
  g.add(malla(new THREE.PlaneGeometry(60, 4), mat('#4a4a52', { tipo: 'lambert' }), [0, 0.005, 3.6], [-Math.PI / 2, 0, 0]));
  for (let i = -14; i <= 14; i++) g.add(malla(new THREE.PlaneGeometry(1.2, 0.12), mat('#ffc23c', { tipo: 'basica' }), [i * 2.2, 0.01, 3.6], [-Math.PI / 2, 0, 0]));
  // Baranda de madera del mirador
  for (let i = -5; i <= 5; i++) g.add(malla(new THREE.CylinderGeometry(0.05, 0.06, 1.05, 8), mat('#6d4c41'), [i * 0.7, 0.52, -1.45]));
  for (const y of [0.55, 0.98]) g.add(malla(new THREE.BoxGeometry(7.2, 0.06, 0.08), mat('#8d6e63'), [0, y, -1.45]));
  const letrero = cartel('MIRADOR · VOLCÁN COTOPAXI · 5 897 m', 2.6, 0.32, { fondo: '#2e5d34', color: '#ffffff', tam: 0.48 });
  letrero.position.set(-2.4, 1.45, -1.5);
  g.add(letrero);
  g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), mat('#6d4c41'), [-2.4, 0.65, -1.52]));
  // Furgoneta del noticiero y la cámara
  const van = noticias.furgoneta_tv();
  van.position.set(-2.6, 0, 3.4);
  g.add(van);
  const cam = noticias.camara_tv();
  cam.position.set(1.7, 0, -0.8);
  cam.rotation.y = -2.2;
  g.add(cam);

  // El Cotopaxi: cono perfecto con nieve y el cráter encendido
  const vz = -75;
  g.add(malla(new THREE.ConeGeometry(46, 36, 40, 1, true), mat('#5a504c', { tipo: 'lambert' }), [0, 18, vz]));
  g.add(malla(new THREE.CylinderGeometry(3.2, 14, 9, 40, 1, true), mat('#f2f2f2', { tipo: 'lambert' }), [0, 31.5, vz]));
  g.add(malla(new THREE.CylinderGeometry(3.3, 3.2, 0.6, 30), mat('#2b2523'), [0, 36.2, vz]));
  for (const [x, z, h, r, c] of [[-60, -70, 22, 30, '#6b6a62'], [55, -80, 18, 28, '#77705f'], [-30, -110, 14, 24, '#7f7a6d']]) g.add(malla(new THREE.ConeGeometry(r, h, 18), mat(c, { tipo: 'lambert' }), [x, h / 2 - 1, z]));

  // Lo que se anima: resplandor del cráter, columna de ceniza, rayos, ceniza que cae y azufre
  const vivos = new THREE.Group();
  vivos.userData.noFusionar = true;
  g.add(vivos);
  const brillo = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 12), new THREE.MeshBasicMaterial({ color: '#ff7a2f', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  brillo.position.set(0, 37, vz);
  vivos.add(brillo);

  const n = 46;
  const columna = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ fog: false }), n);
  columna.frustumCulled = false;
  const bolas = Array.from({ length: n }, (_, i) => ({ fase: i / n, giro: Math.random() * 6, lado: azar(-1, 1), gris: azar(0.25, 0.5) }));
  const col = new THREE.Color();
  bolas.forEach((b, i) => columna.setColorAt(i, col.setRGB(b.gris, b.gris * 0.95, b.gris * 0.92)));
  vivos.add(columna);

  const rayo = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 9 }, () => V())), new THREE.LineBasicMaterial({ color: '#ffffff', fog: false }));
  rayo.visible = false;
  vivos.add(rayo);
  let vidaRayo = 0;
  let empuje = 0;

  const cantidad = 380;
  const posCeniza = new Float32Array(cantidad * 3);
  for (let i = 0; i < cantidad; i++) posCeniza.set([azar(-5, 5), azar(0, 5), azar(-6, 3)], i * 3);
  const geoCeniza = new THREE.BufferGeometry();
  geoCeniza.setAttribute('position', new THREE.BufferAttribute(posCeniza, 3));
  const ceniza = new THREE.Points(geoCeniza, new THREE.PointsMaterial({ map: puntoSuave(), color: '#5e5a58', size: 0.04, transparent: true, opacity: 0.85, depthWrite: false }));
  ceniza.frustumCulled = false;
  vivos.add(ceniza);
  let fuerzaCeniza = 0.35;

  const azufre = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 12), new THREE.MeshBasicMaterial({ color: '#d9c94a', transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false }));
  vivos.add(azufre);
  let metaAzufre = 0;

  const app = ctx.app;
  const luzBase = 2.2;
  ctx.cada((dt, t) => {
    brillo.material.opacity = 0.35 + Math.sin(t * 3.1) * 0.08 + Math.sin(t * 7.3) * 0.05 + empuje * 0.3;
    empuje = Math.max(0, empuje - dt * 0.25);
    // La columna sube, se ensancha y se oscurece; cuando hay "empuje" sube más rápido
    bolas.forEach((b, i) => {
      b.fase = (b.fase + dt * (0.035 + empuje * 0.06)) % 1;
      const k = b.fase;
      const alto = 38 + k * 32;
      const r = 3 + k * 14;
      const deriva = k * k * 18;
      const x = Math.sin(b.giro + t * 0.2) * r * 0.5 * b.lado + deriva;
      const s = 3 + k * 9;
      m.compose(V(x, alto, vz + Math.cos(b.giro) * r * 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(b.giro + t * 0.1, b.giro, 0)), V(s, s * 0.9, s));
      columna.setMatrixAt(i, m);
    });
    columna.instanceMatrix.needsUpdate = true;
    // Rayos dentro de la nube
    if (vidaRayo > 0) {
      vidaRayo -= dt;
      rayo.visible = Math.sin(vidaRayo * 60) > -0.3;
      if (vidaRayo <= 0) {
        rayo.visible = false;
        app.hemi.intensity = luzBase;
      }
    }
    // Ceniza que cae alrededor del mirador
    for (let i = 0; i < cantidad; i++) {
      let y = posCeniza[i * 3 + 1] - dt * (0.18 + fuerzaCeniza * 0.5) * (0.6 + (i % 5) * 0.12);
      if (y < 0) y = 5;
      posCeniza[i * 3 + 1] = y;
      posCeniza[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.08 + dt * 0.12;
      if (posCeniza[i * 3] > 5) posCeniza[i * 3] = -5;
    }
    geoCeniza.attributes.position.needsUpdate = true;
    ceniza.material.opacity = 0.25 + fuerzaCeniza * 0.7;
    ceniza.material.size = 0.03 + fuerzaCeniza * 0.03;
    azufre.material.opacity += (metaAzufre - azufre.material.opacity) * Math.min(1, dt * 1.5);
    const cam = app.camara.getWorldPosition(new THREE.Vector3());
    azufre.position.copy(g.worldToLocal(cam));
  });

  const api = {
    /** Un rayo en la columna de ceniza, con destello y trueno. */
    relampago() {
      const pts = [];
      let p = V(azar(-6, 6), 70, vz);
      for (let i = 0; i < 9; i++) {
        pts.push(p.clone());
        p = p.add(V(azar(-3, 3), -3.2, azar(-1, 1)));
      }
      rayo.geometry.setFromPoints(pts);
      vidaRayo = 0.45;
      app.hemi.intensity = luzBase * 1.7;
      ctx.audio.rafaga({ duracion: 1.6, filtro: 'lowpass', frecuencia: 260, hasta: 60, volumen: 0.3, retardo: 0.5 });
    },
    /** Un rugido grave del volcán (y la columna sube con más fuerza). */
    retumbar(fuerza = 1) {
      empuje = Math.min(1.5, empuje + fuerza);
      ctx.audio.rafaga({ duracion: 3.5, filtro: 'lowpass', frecuencia: 140, hasta: 45, volumen: 0.38 * fuerza });
      ctx.audio.tono(42, 3, { tipo: 'sine', volumen: 0.25 * fuerza });
    },
    /** Intensidad de la ceniza que cae (0..1). */
    ceniza(v) {
      fuerzaCeniza = v;
    },
    /** Nube amarilla de azufre alrededor del reportero (0 = nada). */
    azufre(v) {
      metaAzufre = v * 0.32;
    },
  };
  cadaTanto(ctx, [7, 13], () => api.relampago());
  return { fondo: '#8a7a74', niebla: ['#b39b8a', 30, 150], luz: [0xffe6cc, 0x5a4a40, luzBase], api };
}

export const entornosNoticias = { estudio, plaza, volcan };
