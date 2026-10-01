import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from './materiales.js';
import { objetos, mesa } from './prefabs/objetos.js';
import { diseno } from './prefabs/diseno.js';
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
  const { fondo, niebla, luz } = ENTORNOS[nombre](grupo, contexto);
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
    actualizar: (dt, t) => actualizadores.forEach((fn) => fn(dt, t)),
    detener: () => detenedores.splice(0).forEach((fn) => fn()),
  };
}
