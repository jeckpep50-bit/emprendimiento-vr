import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from './materiales.js';
import { texturaLienzo, matTextura, habitacion, cartel } from './entornos.js';
import { cafe } from './prefabs/cafe.js';
import { laboratorio } from './prefabs/laboratorio.js';
import { motas, cadaTanto } from './vida.js';

// Coco's Café: una cafetería acogedora para la lección de inglés A1. El mostrador
// queda frente al estudiante (a ~1 m) y detrás está el camarero. Todo lo estático
// se fusiona en pocas mallas para que vaya fluido en Quest.

/** Medidas que usa la escena para poner productos sobre el mostrador. */
export const MOSTRADOR = { alto: 0.86, z: -1.32, frente: -1.02, ancho: 3.4 };

/** Fusiona un grupo animado aparte para que el entorno no lo junte con lo estático. */
function fusionarAparte(grupo) {
  fusionar(grupo);
  grupo.userData.noFusionar = true;
  return grupo;
}

const TIZA ='"Comic Sans MS", "Segoe Print", "Chalkboard SE", system-ui, sans-serif';

function pizarraCarta() {
  const tex = texturaLienzo(1000, 760, (x, w, h) => {
    x.fillStyle = '#25302b';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 120, 6);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffe9a8';
    x.font = `800 92px ${TIZA}`;
    x.fillText('MENU', w / 2, 80);
    x.strokeStyle = 'rgba(255,255,255,0.5)';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(140, 140);
    x.lineTo(w - 140, 140);
    x.stroke();
    x.textAlign = 'left';
    const filas = (titulo, items, x0) => {
      x.fillStyle = '#9fe0c9';
      x.font = `800 52px ${TIZA}`;
      x.fillText(titulo, x0, 200);
      items.forEach(([emoji, nombre], i) => {
        x.font = `60px system-ui, "Segoe UI Emoji", sans-serif`;
        x.fillStyle = '#ffffff';
        x.fillText(emoji, x0, 290 + i * 110);
        x.font = `700 54px ${TIZA}`;
        x.fillText(nombre, x0 + 80, 292 + i * 110);
      });
    };
    filas('Food', [['🥪', 'sandwich'], ['🍕', 'pizza'], ['🍪', 'cookie'], ['🧁', 'muffin']], 70);
    filas('Drinks', [['💧', 'water'], ['🧃', 'juice'], ['🥛', 'milk']], 560);
  });
  return matTextura(tex);
}

function cafeteria(g, ctx) {
  // Piso de madera y paredes cálidas
  const piso = texturaLienzo(512, 512, (x, w) => {
    for (let i = 0; i < 8; i++) {
      x.fillStyle = ['#a46a3f', '#9a6139', '#ad7347', '#93603a'][i % 4];
      x.fillRect(0, (i * w) / 8, w, w / 8);
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(0, (i * w) / 8, w, 3);
      x.fillRect(((i * 197) % w), (i * w) / 8, 3, w / 8);
    }
  });
  piso.wrapS = piso.wrapT = THREE.RepeatWrapping;
  piso.repeat.set(4, 4);
  habitacion(g, { ancho: 8, fondo: 8, alto: 3.2, suelo: matTextura(piso), pared: mat('#f1dfc2', { tipo: 'lambert' }), techo: mat('#5a3d2b', { tipo: 'lambert' }) });
  const zocalo = mat('#7a4b2c', { tipo: 'lambert' });
  for (const [x, z, ry, largo] of [[0, 3.97, 0, 8], [-3.97, 0, Math.PI / 2, 8], [3.97, 0, Math.PI / 2, 8]]) {
    g.add(malla(new THREE.BoxGeometry(largo, 1, 0.04), zocalo, [x, 0.5, z], [0, ry, 0]));
  }
  // Vigas del techo
  for (const z of [-2, 0, 2]) g.add(malla(new THREE.BoxGeometry(8, 0.14, 0.18), mat('#4a3122'), [0, 3.1, z]));
  // Alfombra redonda bajo el estudiante
  g.add(malla(new THREE.CircleGeometry(1.1, 40), mat('#b5523b', { tipo: 'lambert' }), [0, 0.004, -0.1], [-Math.PI / 2, 0, 0]));
  g.add(malla(new THREE.RingGeometry(0.9, 0.98, 48), mat('#f2c45a', { tipo: 'lambert' }), [0, 0.006, -0.1], [-Math.PI / 2, 0, 0]));

  // Pared de azulejos detrás de la barra
  const azulejo = texturaLienzo(256, 256, (x, w) => {
    x.fillStyle = '#2f6b5e';
    x.fillRect(0, 0, w, w);
    x.fillStyle = 'rgba(255,255,255,0.12)';
    for (let f = 0; f < 8; f++) for (let c = 0; c < 4; c++) x.fillRect(c * 64 + (f % 2) * 32 + 2, f * 32 + 2, 60, 28);
  });
  azulejo.wrapS = azulejo.wrapT = THREE.RepeatWrapping;
  azulejo.repeat.set(6, 3);
  g.add(malla(new THREE.BoxGeometry(6.4, 3.2, 0.1), matTextura(azulejo), [0, 1.6, -2.95]));

  // Mostrador de madera
  const { alto, z } = MOSTRADOR;
  g.add(malla(new THREE.BoxGeometry(3.4, alto - 0.04, 0.58), mat('#8a5a36'), [0, (alto - 0.04) / 2, z]));
  g.add(malla(new RoundedBoxGeometry(3.56, 0.05, 0.7, 2, 0.02), mat('#5b3a22'), [0, alto - 0.02, z]));
  for (let i = 0; i < 8; i++) g.add(malla(new THREE.BoxGeometry(0.34, 0.56, 0.02), mat('#a06a40'), [-1.47 + i * 0.42, 0.42, z + 0.3]));
  g.add(malla(new THREE.BoxGeometry(3.4, 0.06, 0.04), mat('#f2c45a'), [0, 0.1, z + 0.31]));
  // Vitrina con dulces (a la derecha)
  g.add(malla(new THREE.BoxGeometry(0.62, 0.36, 0.5), mat('#dff2ff', { opacidad: 0.22 }), [1.35, alto + 0.18, z - 0.02]));
  g.add(malla(new THREE.BoxGeometry(0.64, 0.02, 0.52), mat('#5b3a22'), [1.35, alto + 0.37, z - 0.02]));
  for (const [i, f] of [[0, cafe.muffin], [1, cafe.muffin], [2, cafe.galleta]]) {
    const d = f();
    d.scale.setScalar(0.9);
    d.position.set(1.17 + i * 0.18, alto + 0.01, z - 0.05);
    g.add(d);
  }
  // Barra trasera con la cafetera, tazas y una torta
  g.add(malla(new THREE.BoxGeometry(4.6, 0.9, 0.5), mat('#6e4630'), [0, 0.45, -2.62]));
  g.add(malla(new THREE.BoxGeometry(4.7, 0.04, 0.56), mat('#3b2a20'), [0, 0.92, -2.62]));
  g.add(malla(new RoundedBoxGeometry(0.62, 0.48, 0.4, 3, 0.04), mat('#c9ccd4'), [1.2, 1.18, -2.66]));
  g.add(malla(new THREE.BoxGeometry(0.6, 0.08, 0.38), mat('#c8322e'), [1.2, 1.38, -2.66]));
  for (const x of [1.06, 1.34]) {
    g.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), mat('#3a3a42'), [x, 1.0, -2.5]));
    g.add(malla(new THREE.CylinderGeometry(0.035, 0.03, 0.06, 12), mat('#ffffff'), [x, 0.97, -2.46]));
  }
  for (let i = 0; i < 6; i++) g.add(malla(new THREE.CylinderGeometry(0.04, 0.034, 0.07, 12), mat(['#ffffff', '#f2c45a', '#9fe0c9'][i % 3]), [-0.4 + (i % 3) * 0.1, 0.98 + Math.floor(i / 3) * 0.07, -2.55]));
  const torta = laboratorio.torta?.();
  if (torta) {
    torta.scale.setScalar(0.8);
    torta.position.set(-1.0, 0.94, -2.6);
    g.add(torta);
  }
  // Repisas con frascos
  for (const y of [1.65, 2.15]) {
    g.add(malla(new THREE.BoxGeometry(1.8, 0.04, 0.24), mat('#5b3a22'), [0.95, y, -2.8]));
    for (let i = 0; i < 6; i++) {
      const c = ['#e8b04a', '#c8322e', '#2dbe78', '#f5f1e8', '#7a4a2a', '#ff9a1f'][(i + y * 3) % 6 | 0];
      g.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 14), mat('#dff2ff', { opacidad: 0.45 }), [0.25 + i * 0.27, y + 0.11, -2.78]));
      g.add(malla(new THREE.CylinderGeometry(0.052, 0.052, 0.12, 12), mat(c), [0.25 + i * 0.27, y + 0.08, -2.78]));
    }
  }
  // Pizarra con la carta (a la izquierda, bien visible)
  g.add(malla(new THREE.BoxGeometry(1.42, 1.1, 0.06), mat('#7a4b2c'), [-1.45, 1.75, -2.88]));
  g.add(malla(new THREE.PlaneGeometry(1.3, 0.99), pizarraCarta(), [-1.45, 1.75, -2.845]));
  // Letrero
  const letrero = cartel("☕ Coco's Café", 1.6, 0.34, { fondo: '#3b2a20', color: '#ffd77a', borde: '#ffd77a' });
  letrero.position.set(0.7, 2.62, -2.88);
  g.add(letrero);

  // Lámparas colgantes cálidas
  for (const x of [-1.1, 0, 1.1]) {
    g.add(malla(new THREE.CylinderGeometry(0.006, 0.006, 0.7, 6), mat('#2b2b33'), [x, 2.85, z]));
    g.add(malla(new THREE.ConeGeometry(0.17, 0.2, 24, 1, true), mat('#2f6b5e', { lados: THREE.DoubleSide }), [x, 2.42, z]));
    g.add(malla(new THREE.SphereGeometry(0.06, 14, 10), mat('#fff1c2', { tipo: 'basica' }), [x, 2.33, z]));
  }
  // Mesas con sillas y tazas (a los lados y atrás)
  for (const [x, zz] of [[-2.6, 0.6], [2.6, 0.4], [-1.2, 2.7], [1.5, 2.6]]) {
    g.add(malla(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 28), mat('#8a5a36'), [x, 0.74, zz]));
    g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 10), mat('#3b2a20'), [x, 0.37, zz]));
    g.add(malla(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), mat('#3b2a20'), [x, 0.015, zz]));
    g.add(malla(new THREE.CylinderGeometry(0.045, 0.04, 0.08, 14), mat('#ffffff'), [x + 0.1, 0.8, zz]));
    for (const s of [-1, 1]) {
      const sx = x + s * 0.62;
      g.add(malla(new THREE.BoxGeometry(0.4, 0.04, 0.4), mat('#c98a45'), [sx, 0.45, zz]));
      for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) g.add(malla(new THREE.BoxGeometry(0.03, 0.45, 0.03), mat('#3b2a20'), [sx + dx, 0.225, zz + dz]));
      g.add(malla(new THREE.BoxGeometry(0.04, 0.42, 0.4), mat('#c98a45'), [sx + s * 0.19, 0.68, zz]));
    }
  }
  // Plantas en macetas
  for (const [x, zz, r] of [[-3.4, -2.4, 0.4], [3.4, -2.4, 0.36], [3.4, 3.2, 0.42], [-3.4, 3.2, 0.34]]) {
    g.add(malla(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 16), mat('#c96b3c'), [x, 0.2, zz]));
    for (let k = 0; k < 5; k++) g.add(malla(new THREE.SphereGeometry(r * (0.6 + (k % 2) * 0.2), 14, 10), mat(k % 2 ? '#3f8f3a' : '#2f7a33'), [x + Math.sin(k * 1.3) * 0.15, 0.55 + k * 0.12, zz + Math.cos(k * 1.3) * 0.12]));
  }
  // Ventanas con luz de tarde
  const cieloVentana = matTextura(texturaLienzo(256, 256, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#8fd0ff');
    gr.addColorStop(1, '#ffe1a8');
    x.fillStyle = gr;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#5b8f4a';
    x.beginPath();
    x.ellipse(w * 0.3, h, w * 0.5, h * 0.25, 0, Math.PI, 0);
    x.fill();
  }), 'basica');
  for (const zz of [-1.2, 1.4]) {
    g.add(malla(new THREE.PlaneGeometry(1.3, 1.2), cieloVentana, [-3.95, 1.7, zz], [0, Math.PI / 2, 0]));
    g.add(malla(new THREE.BoxGeometry(0.06, 1.3, 1.4), mat('#ffffff'), [-3.98, 1.7, zz]));
    g.add(malla(new THREE.BoxGeometry(0.08, 0.04, 1.3), mat('#ffffff'), [-3.93, 1.7, zz]));
  }
  // Cuadros en la pared derecha
  for (const [zz, c] of [[-1.0, '#ff9a1f'], [1.0, '#2347b8']]) {
    g.add(malla(new THREE.BoxGeometry(0.04, 0.7, 0.55), mat('#3b2a20'), [3.96, 1.75, zz]));
    g.add(malla(new THREE.PlaneGeometry(0.48, 0.62), mat(c, { tipo: 'lambert' }), [3.935, 1.75, zz], [0, -Math.PI / 2, 0]));
  }

  // Puerta de entrada (pared derecha, adelante): por aquí llegan los clientes
  const puerta = { x: 3.95, z: 1.7 };
  g.add(malla(new THREE.BoxGeometry(0.08, 2.25, 1.15), mat('#5b3a22'), [puerta.x, 1.125, puerta.z]));
  g.add(malla(new THREE.BoxGeometry(0.06, 2.1, 1.0), mat('#8a5a36'), [puerta.x - 0.03, 1.05, puerta.z]));
  g.add(malla(new THREE.PlaneGeometry(0.7, 0.8), cieloVentana, [puerta.x - 0.065, 1.45, puerta.z], [0, -Math.PI / 2, 0]));
  g.add(malla(new THREE.SphereGeometry(0.035, 12, 8), mat('#e8c25a'), [puerta.x - 0.08, 1.05, puerta.z - 0.38]));
  g.add(malla(new THREE.ConeGeometry(0.05, 0.08, 16, 1, true), mat('#e8c25a', { lados: THREE.DoubleSide }), [puerta.x - 0.1, 2.3, puerta.z - 0.45]));
  // Caja registradora y una taza caliente con vapor sobre el mostrador
  g.add(malla(new RoundedBoxGeometry(0.34, 0.16, 0.26, 2, 0.02), mat('#3b4a6b'), [-1.42, alto + 0.08, z - 0.08]));
  g.add(malla(new THREE.BoxGeometry(0.26, 0.1, 0.02), mat('#9fe0c9', { tipo: 'basica' }), [-1.42, alto + 0.2, z - 0.18], [-0.4, 0, 0]));
  const tazaCaliente = cafe.taza();
  tazaCaliente.position.set(-1.05, alto, z + 0.05);
  g.add(tazaCaliente);
  motas(g, ctx, { caja: [-1.08, -1.02, alto + 0.09, alto + 0.35, z + 0.03, z + 0.07], cantidad: 10, color: '#ffffff', tam: 0.03, opacidad: 0.4, velocidad: 0.1 });

  // Ventilador de techo que gira despacio
  const ventilador = new THREE.Group();
  ventilador.position.set(0.2, 2.95, 0.6);
  ventilador.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), mat('#3b2a20'), [0, 0.12, 0]));
  ventilador.add(malla(new THREE.CylinderGeometry(0.09, 0.07, 0.1, 16), mat('#3b2a20')));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ventilador.add(malla(new THREE.BoxGeometry(0.55, 0.012, 0.12), mat('#8a5a36'), [Math.cos(a) * 0.33, -0.02, Math.sin(a) * 0.33], [0, -a, 0.06]));
  }
  fusionarAparte(ventilador);
  g.add(ventilador);
  ctx.cada((dt) => (ventilador.rotation.y += dt * 1.6));

  // Vapor suave sobre la cafetera y brillo cálido en el aire
  motas(g, ctx, { caja: [1.05, 1.35, 1.45, 2.0, -2.75, -2.55], cantidad: 18, color: '#ffffff', tam: 0.04, opacidad: 0.35, velocidad: 0.12 });
  motas(g, ctx, { caja: [-3, 3, 0.6, 2.8, -2.6, 2.5], cantidad: 60, color: '#ffe9b0', tam: 0.018, opacidad: 0.45, velocidad: 0.02 });
  // Tintineo lejano de tazas
  cadaTanto(ctx, [6, 13], () => {
    const pos = new THREE.Vector3(-2 + Math.random() * 4, 0.9, 1 + Math.random() * 2);
    ctx.audio?.tono(2300 + Math.random() * 500, 0.07, { volumen: 0.018, pos });
    ctx.audio?.tono(3100 + Math.random() * 400, 0.06, { volumen: 0.012, retardo: 0.09, pos });
  });

  return { fondo: '#3b2a20', luz: [0xfff1dc, 0x7a5236, 2.6], api: { mostrador: MOSTRADOR, puerta: new THREE.Vector3(puerta.x - 0.5, 0, puerta.z) } };
}

export const entornosCafe = { cafeteria };
