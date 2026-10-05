import * as THREE from 'three';
import { microbios } from './prefabs/microbios.js';
import { objetos, mosca } from './prefabs/objetos.js';
import { mercado as prefabsMercado } from './prefabs/mercado.js';
import { mat, malla, fusionar } from './materiales.js';
import { envolver, fuente } from '../ui/lienzo.js';
import { holograma } from './holograma.js';

// Elementos animados que dan vida a cada entorno (se agregan después de fusionar
// el decorado estático). `ctx` ofrece: app, audio, titulo, subtitulo,
// cada(fn(dt, t)) y alDetener(fn).

const AMBIENTES = {
  aula: { frecuencia: 500, volumen: 0.012 },
  cocina: { frecuencia: 420, volumen: 0.012 },
  microscopico: { frecuencia: 260, volumen: 0.07, oleaje: 0.12 },
  lavabo: { frecuencia: 900, volumen: 0.01 },
  naturaleza: { frecuencia: 900, filtro: 'bandpass', volumen: 0.03, oleaje: 0.15 },
  espacio: { frecuencia: 140, volumen: 0.05, oleaje: 0.05 },
  taller: { frecuencia: 480, volumen: 0.012 },
  patio: { frecuencia: 900, filtro: 'bandpass', volumen: 0.025, oleaje: 0.15 },
  laboratorio: { frecuencia: 160, volumen: 0.04, oleaje: 0.08 },
  mercado: { frecuencia: 700, filtro: 'bandpass', volumen: 0.04, oleaje: 0.35 },
  planta: { frecuencia: 140, volumen: 0.05, oleaje: 0.6 },
  cuerpo: { frecuencia: 120, volumen: 0.07, oleaje: 0.9 },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const azar = (a, b) => a + Math.random() * (b - a);

let texturaPunto = null;
function puntoSuave() {
  if (!texturaPunto) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    texturaPunto = new THREE.CanvasTexture(c);
    texturaPunto.userData.compartido = true;
  }
  return texturaPunto;
}

/** Ejecuta `fn` a intervalos al azar entre min y max segundos. */
function cadaTanto(ctx, [min, max], fn) {
  let espera = azar(min, max);
  ctx.cada((dt) => {
    espera -= dt;
    if (espera <= 0) {
      espera = azar(min, max);
      fn();
    }
  });
}

/** Motas de polvo o partículas flotando despacio dentro de una caja [x0,x1,y0,y1,z0,z1]. */
function motas(g, ctx, { cantidad = 120, caja, color = '#fff6d8', tam = 0.025, opacidad = 0.7, velocidad = 0.04 }) {
  const [x0, x1, y0, y1, z0, z1] = caja;
  const pos = new Float32Array(cantidad * 3);
  const fases = new Float32Array(cantidad);
  for (let i = 0; i < cantidad; i++) {
    pos.set([azar(x0, x1), azar(y0, y1), azar(z0, z1)], i * 3);
    fases[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const puntos = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ map: puntoSuave(), color, size: tam, transparent: true, opacity: opacidad, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  puntos.frustumCulled = false;
  g.add(puntos);
  ctx.cada((dt, t) => {
    for (let i = 0; i < cantidad; i++) {
      const f = fases[i];
      let y = pos[i * 3 + 1] + (Math.sin(t * 0.4 + f) * 0.5 + 0.15) * velocidad * dt;
      if (y > y1) y = y0;
      pos[i * 3] += Math.sin(t * 0.3 + f * 1.7) * velocidad * 0.6 * dt;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] += Math.cos(t * 0.25 + f) * velocidad * 0.6 * dt;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

// ── Aula ───────────────────────────────────────────────────────────────────

/** Pizarra con el título de la lección escrito con tiza, línea por línea. */
function pizarra(g, ctx) {
  const c = document.createElement('canvas');
  c.width = 1350;
  c.height = 600;
  const x = c.getContext('2d');
  const tiza = `700 {t}px "Comic Sans MS", "Chalkboard SE", "Segoe Print", ${fuente(1).split('px ')[1]}`;
  x.font = tiza.replace('{t}', 74);
  const lineas = envolver(x, ctx.titulo ?? '', 1180).slice(0, 3);
  const textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  const plano = malla(new THREE.PlaneGeometry(2.7, 1.2), new THREE.MeshBasicMaterial({ map: textura, transparent: true }), [0, 1.65, -4.42]);
  g.add(plano);

  const dibujar = (progreso) => {
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(255, 255, 255, 0.88)';
    x.textBaseline = 'top';
    x.font = tiza.replace('{t}', 74);
    lineas.forEach((linea, i) => {
      const k = THREE.MathUtils.clamp(progreso - i, 0, 1);
      if (k <= 0) return;
      const ancho = x.measureText(linea).width;
      x.save();
      x.beginPath();
      x.rect(80, 60 + i * 100, ancho * k + 4, 100);
      x.clip();
      x.fillText(linea, 80, 70 + i * 100);
      x.restore();
    });
    const extra = progreso - lineas.length;
    if (extra > 0 && ctx.subtitulo) {
      x.globalAlpha = Math.min(1, extra);
      x.font = tiza.replace('{t}', 44);
      x.fillStyle = 'rgba(255, 236, 150, 0.9)';
      x.fillText(ctx.subtitulo, 80, 90 + lineas.length * 100);
      // Dibujitos de tiza
      x.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      x.lineWidth = 5;
      x.beginPath();
      x.arc(1170, 470, 48, 0, Math.PI * 2);
      x.stroke();
      for (const [dx, dy] of [[-16, -12], [16, -12]]) {
        x.beginPath();
        x.arc(1170 + dx, 470 + dy, 6, 0, Math.PI * 2);
        x.stroke();
      }
      x.beginPath();
      x.arc(1170, 478, 22, 0.2, Math.PI - 0.2);
      x.stroke();
      x.globalAlpha = 1;
    }
    textura.needsUpdate = true;
  };

  let progreso = 0;
  const final = lineas.length + 1;
  dibujar(0);
  ctx.cada((dt) => {
    if (progreso >= final) return;
    progreso = Math.min(final, progreso + dt * 0.9);
    dibujar(progreso);
  });
}

function reloj(g, ctx, posicion) {
  const r = 0.22;
  const grupo = new THREE.Group();
  grupo.position.copy(posicion);
  grupo.add(malla(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.04, 40), mat('#4f7cff'), [0, 0, 0], [Math.PI / 2, 0, 0]));
  grupo.add(malla(new THREE.CircleGeometry(r, 40), mat('#ffffff', { tipo: 'basica' }), [0, 0, 0.021]));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    grupo.add(malla(new THREE.BoxGeometry(0.012, i % 3 ? 0.025 : 0.045, 0.004), mat('#23304a', { tipo: 'basica' }), [Math.sin(a) * r * 0.85, Math.cos(a) * r * 0.85, 0.024], [0, 0, -a]));
  }
  const aguja = (largo, grosor, color) => {
    const pivote = new THREE.Group();
    pivote.position.z = 0.028;
    pivote.add(malla(new THREE.BoxGeometry(grosor, largo, 0.004), mat(color, { tipo: 'basica' }), [0, largo / 2 - 0.02, 0]));
    grupo.add(pivote);
    return pivote;
  };
  const horas = aguja(r * 0.55, 0.018, '#23304a');
  const minutos = aguja(r * 0.8, 0.012, '#23304a');
  const segundos = aguja(r * 0.85, 0.005, '#ff5a5f');
  g.add(grupo);
  ctx.cada(() => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    segundos.rotation.z = -(s / 60) * Math.PI * 2;
    minutos.rotation.z = -(m / 60) * Math.PI * 2;
    horas.rotation.z = -(h / 12) * Math.PI * 2;
  });
}

// ── Microscópico ───────────────────────────────────────────────────────────

/** Microbios que nadan en círculos a lo lejos, mirando hacia donde avanzan. */
function nadadores(g, ctx) {
  const tipos = ['bacilo', 'coco', 'espirilo', 'virus', 'levadura', 'lactobacilo', 'protozoo', 'estreptococo'];
  const destino = new THREE.Vector3();
  tipos.forEach((tipo, i) => {
    const m = microbios[tipo]({ caracter: tipo === 'levadura' || tipo === 'lactobacilo' ? 'bueno' : 'malo' });
    m.scale.setScalar(azar(1.3, 2.1));
    const r = 3.3 + (i % 4) * 1.2;
    const h = 0.7 + (i % 3) * 0.9;
    const w = azar(0.1, 0.2) * (i % 2 ? 1 : -1);
    const a0 = (i / tipos.length) * Math.PI * 2;
    g.add(m);
    ctx.cada((_dt, t) => {
      const a = a0 + t * w;
      const y = h + Math.sin(t * 0.7 + i) * 0.35;
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const ad = a + Math.sign(w) * 0.15;
      destino.set(Math.cos(ad) * r, y, Math.sin(ad) * r);
      m.lookAt(g.localToWorld(destino));
      m.userData.animar?.(t * 1.6);
    });
  });
  cadaTanto(ctx, [0.5, 1.6], () => {
    const a = Math.random() * Math.PI * 2;
    ctx.audio.burbuja(g.localToWorld(V(Math.cos(a) * azar(1.5, 5), azar(0.3, 3), Math.sin(a) * azar(1.5, 5))));
  });
}

// ── Cocina ─────────────────────────────────────────────────────────────────

function moscas(g, ctx, cantidad = 2) {
  for (let i = 0; i < cantidad; i++) {
    const m = mosca();
    m.scale.setScalar(1.5);
    g.add(m);
    const sonido = ctx.audio.fuenteEspacial('zumbido');
    ctx.alDetener(() => sonido.detener());
    const previa = new THREE.Vector3();
    const mundo = new THREE.Vector3();
    const cx = i ? 1.6 : -1.9;
    ctx.cada((_dt, t) => {
      const k = t * (0.55 + i * 0.12) + i * 3;
      previa.copy(m.position);
      m.position.set(
        cx + Math.sin(k) * 1.1 + Math.sin(k * 3.1) * 0.15,
        1.55 + Math.sin(k * 1.7) * 0.45 + Math.sin(k * 5.3) * 0.05,
        -2.7 + Math.cos(k * 0.8) * 1.1 + Math.cos(k * 2.9) * 0.12,
      );
      m.lookAt(g.localToWorld(mundo.copy(m.position).sub(previa).add(m.position)));
      m.rotateY(-Math.PI / 2); // el cuerpo de la mosca mira hacia +X
      m.userData.animar?.(t);
      sonido.mover(g.localToWorld(mundo.copy(m.position)));
    });
  }
}

// ── Baño ───────────────────────────────────────────────────────────────────

function goteo(g, ctx) {
  const inicio = V(0, 0.962, -2.7);
  const fondo = 0.778;
  const gota = malla(new THREE.SphereGeometry(0.009, 10, 8), mat('#8fd3ff', { tipo: 'basica', opacidad: 0.85 }), inicio.toArray());
  const onda = malla(new THREE.RingGeometry(0.01, 0.016, 28), new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0, depthWrite: false }), [inicio.x, fondo, inicio.z], [-Math.PI / 2, 0, 0]);
  g.add(gota, onda);
  const ciclo = 2.2;
  let tAnterior = 0;
  ctx.cada((_dt, t) => {
    const k = t % ciclo;
    if (k < 0.6) {
      gota.position.y = inicio.y;
      gota.scale.setScalar(0.3 + (k / 0.6) * 0.7);
    } else {
      const caida = k - 0.6;
      gota.scale.setScalar(1);
      gota.position.y = inicio.y - 0.5 * 9.8 * caida * caida;
    }
    gota.visible = gota.position.y > fondo;
    const tImpacto = 0.6 + Math.sqrt((2 * (inicio.y - fondo)) / 9.8);
    const tr = k - tImpacto;
    if (tr >= 0 && tr < 0.8) {
      onda.scale.setScalar(1 + tr * 6);
      onda.material.opacity = 0.8 * (1 - tr / 0.8);
    } else {
      onda.material.opacity = 0;
    }
    if (tAnterior < tImpacto && k >= tImpacto) ctx.audio.gota(g.localToWorld(onda.position.clone()));
    tAnterior = k;
  });
}

function burbujasJabon(g, ctx) {
  const origen = V(0.24, 0.9, -2.72);
  const geo = new THREE.SphereGeometry(1, 12, 8);
  const lista = Array.from({ length: 6 }, (_, i) => {
    const b = malla(geo, mat('#e3f6ff', { opacidad: 0.5 }));
    g.add(b);
    return { b, fase: i / 6, lado: azar(-1, 1) };
  });
  ctx.cada((_dt, t) => {
    for (const { b, fase, lado } of lista) {
      const k = (t * 0.18 + fase) % 1;
      b.position.set(origen.x + Math.sin(k * 9 + lado * 3) * 0.04 + lado * k * 0.1, origen.y + k * 0.9, origen.z + Math.cos(k * 7) * 0.03);
      b.scale.setScalar((0.008 + k * 0.014) * (k > 0.93 ? (1 - k) * 14 : 1));
    }
  });
}

// ── Naturaleza y espacio ───────────────────────────────────────────────────

function mariposas(g, ctx) {
  ['#ff8fd1', '#ffc23c', '#8fd3ff'].forEach((color, i) => {
    const m = new THREE.Group();
    const ala = new THREE.CircleGeometry(0.06, 12);
    const material = mat(color, { tipo: 'basica', lados: THREE.DoubleSide });
    const izq = new THREE.Group();
    const der = new THREE.Group();
    izq.add(malla(ala, material, [-0.055, 0, 0], [Math.PI / 2, 0, 0], [1, 1.2, 1]));
    der.add(malla(ala, material, [0.055, 0, 0], [Math.PI / 2, 0, 0], [1, 1.2, 1]));
    m.add(izq, der, malla(new THREE.CapsuleGeometry(0.008, 0.06, 4, 6), mat('#2b2b33'), [0, 0, 0], [Math.PI / 2, 0, 0]));
    g.add(m);
    const r = 2 + i * 0.8;
    ctx.cada((_dt, t) => {
      const a = t * (0.3 + i * 0.05) + i * 2;
      m.position.set(Math.cos(a) * r, 1.3 + Math.sin(t * 1.3 + i) * 0.4, Math.sin(a) * r - 1);
      m.rotation.y = -a;
      const aleteo = Math.sin(t * 18 + i) * 0.9;
      izq.rotation.z = aleteo;
      der.rotation.z = -aleteo;
    });
  });
  cadaTanto(ctx, [2, 5], () => {
    const a = Math.random() * Math.PI * 2;
    ctx.audio.pajaro(g.localToWorld(V(Math.cos(a) * 8, 3, Math.sin(a) * 8)));
  });
}

function nubes(g, ctx) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 6; i++) {
    const nube = new THREE.Group();
    for (let j = 0; j < 4; j++) nube.add(malla(geo, mat('#ffffff', { tipo: 'basica' }), [j * 1.6 - 2.4, Math.sin(j) * 0.4, 0], [0, 0, 0], [1.6 + (j % 2), 1, 1.2]));
    g.add(nube);
    const r = 24 + (i % 3) * 5;
    const a0 = (i / 6) * Math.PI * 2;
    const y = 13 + (i % 3) * 2;
    ctx.cada((_dt, t) => {
      const a = a0 + t * 0.006;
      nube.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      nube.lookAt(g.localToWorld(V(0, y, 0)));
    });
  }
}

function estrellasFugaces(g, ctx) {
  const estela = malla(new THREE.CylinderGeometry(0.02, 0.08, 3, 6), mat('#ffffff', { tipo: 'basica', opacidad: 0.9 }));
  estela.visible = false;
  g.add(estela);
  let vida = 0;
  const desde = new THREE.Vector3();
  const vel = new THREE.Vector3();
  cadaTanto(ctx, [3, 7], () => {
    const a = Math.random() * Math.PI * 2;
    desde.set(Math.cos(a) * 26, azar(12, 20), Math.sin(a) * 26);
    vel.set(-Math.sin(a), -0.35, Math.cos(a)).normalize().multiplyScalar(28);
    estela.quaternion.setFromUnitVectors(V(0, 1, 0), vel.clone().normalize().negate());
    vida = 1;
  });
  ctx.cada((dt) => {
    if (vida <= 0) return (estela.visible = false);
    vida -= dt;
    estela.visible = true;
    estela.position.copy(desde).addScaledVector(vel, 1 - vida);
    estela.material.opacity = Math.min(1, vida * 2) * 0.9;
  });
}

// ── Laboratorio de innovación y patio ─────────────────────────────────────

function lamparasColgantes(g, ctx) {
  for (const [x, z] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]]) {
    const pivote = new THREE.Group();
    pivote.position.set(x, 3.2, z);
    pivote.add(malla(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6), mat('#2b2b33'), [0, -0.3, 0]));
    pivote.add(malla(new THREE.ConeGeometry(0.2, 0.18, 24, 1, true), mat('#ffc23c', { lados: THREE.DoubleSide }), [0, -0.66, 0]));
    pivote.add(malla(new THREE.SphereGeometry(0.06, 12, 10), mat('#fff6d8', { tipo: 'basica' }), [0, -0.72, 0]));
    g.add(pivote);
    const fase = Math.random() * 6;
    ctx.cada((_dt, t) => {
      pivote.rotation.z = Math.sin(t * 0.9 + fase) * 0.03;
      pivote.rotation.x = Math.cos(t * 0.7 + fase) * 0.02;
    });
  }
}

function notasQueSeMueven(g, ctx) {
  ['#ffe066', '#ff8fd1', '#8fd3ff'].forEach((color, i) => {
    const pivote = new THREE.Group();
    pivote.position.set(-4.93, 2.25 - i * 0.55, 1.75);
    pivote.add(malla(new THREE.PlaneGeometry(0.18, 0.18), mat(color, { tipo: 'lambert', lados: THREE.DoubleSide }), [0, -0.09, 0], [0, Math.PI / 2, 0]));
    g.add(pivote);
    ctx.cada((_dt, t) => (pivote.rotation.z = Math.max(0, Math.sin(t * 1.7 + i * 2)) * 0.35));
  });
}

function banderaEcuador(g, ctx) {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 200;
  const x = c.getContext('2d');
  x.fillStyle = '#ffd100';
  x.fillRect(0, 0, 300, 100);
  x.fillStyle = '#034ea2';
  x.fillRect(0, 100, 300, 50);
  x.fillStyle = '#ed1c24';
  x.fillRect(0, 150, 300, 50);
  // Escudo simplificado
  x.fillStyle = '#7a5c2e';
  x.beginPath();
  x.ellipse(150, 100, 22, 28, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#5fa8d3';
  x.beginPath();
  x.ellipse(150, 102, 15, 20, 0, 0, Math.PI * 2);
  x.fill();
  const textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(1.35, 0.9, 18, 8);
  const tela = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: textura, side: THREE.DoubleSide }));
  tela.position.set(3.8 + 0.675, 4.5, -5.2);
  g.add(tela);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  ctx.cada((_dt, t) => {
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const k = (bx + 0.675) / 1.35; // 0 en el asta, 1 en la punta
      pos.setZ(i, Math.sin(bx * 5 - t * 5) * 0.09 * k + Math.sin(t * 2 + base[i * 3 + 1] * 3) * 0.02 * k);
      pos.setY(i, base[i * 3 + 1] - k * k * 0.04);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

// ── Laboratorio de microbiología ──────────────────────────────────────────

/** Pantalla de pared con un canvas que se redibuja ~12 veces por segundo. */
function pantalla(g, ctx, { x, y, z, ancho = 1.6, alto = 0.9, titulo, dibujar }) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const x2 = c.getContext('2d');
  const textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  g.add(malla(new THREE.BoxGeometry(ancho + 0.08, alto + 0.08, 0.04), mat('#0d1426'), [x, y, z - 0.02]));
  g.add(malla(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: textura }), [x, y, z + 0.002]));
  let acumulado = 1;
  ctx.cada((dt, t) => {
    acumulado += dt;
    if (acumulado < 0.08) return;
    acumulado = 0;
    x2.fillStyle = '#071022';
    x2.fillRect(0, 0, 640, 360);
    x2.strokeStyle = 'rgba(95, 247, 255, 0.12)';
    x2.lineWidth = 1;
    for (let i = 0; i < 640; i += 32) {
      x2.beginPath();
      x2.moveTo(i, 0);
      x2.lineTo(i, 360);
      x2.stroke();
    }
    for (let j = 0; j < 360; j += 32) {
      x2.beginPath();
      x2.moveTo(0, j);
      x2.lineTo(640, j);
      x2.stroke();
    }
    dibujar(x2, t);
    x2.fillStyle = '#5ff7ff';
    x2.font = fuente(30, 800);
    x2.textAlign = 'left';
    x2.textBaseline = 'top';
    x2.fillText(titulo, 20, 14);
    textura.needsUpdate = true;
  });
}

function pantallasLaboratorio(g, ctx) {
  pantalla(g, ctx, {
    x: -2.9,
    y: 1.75,
    z: -4.43,
    titulo: '📈 CRECIMIENTO BACTERIANO',
    dibujar: (c, t) => {
      const k = (t * 0.25) % 1.15;
      c.strokeStyle = '#7dff9a';
      c.lineWidth = 6;
      c.beginPath();
      for (let i = 0; i <= 100 * Math.min(k, 1); i++) {
        const u = i / 100;
        const xx = 40 + u * 560;
        const yy = 320 - (Math.pow(2, u * 8) / 256) * 250;
        i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
      }
      c.stroke();
      const u = Math.min(k, 1);
      c.fillStyle = '#ffffff';
      c.font = fuente(34, 800);
      c.fillText(`${Math.round(Math.pow(2, u * 8))} bacterias`, 400, 60);
    },
  });
  const celulas = Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08, r: 6 + Math.random() * 12, c: ['#7dff9a', '#ff8fd1', '#ffc23c', '#5ff7ff'][Math.floor(Math.random() * 4)] }));
  let ultimo = 0;
  pantalla(g, ctx, {
    x: 0,
    y: 1.75,
    z: -4.43,
    titulo: '🔬 MICROSCOPIO EN VIVO',
    dibujar: (c, t) => {
      const dt = Math.min(0.2, t - ultimo);
      ultimo = t;
      c.save();
      c.beginPath();
      c.arc(320, 195, 150, 0, Math.PI * 2);
      c.fillStyle = '#10304a';
      c.fill();
      c.clip();
      for (const cel of celulas) {
        cel.x = (cel.x + cel.vx * dt + 1) % 1;
        cel.y = (cel.y + cel.vy * dt + 1) % 1;
        c.fillStyle = cel.c;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.ellipse(170 + cel.x * 300, 45 + cel.y * 300, cel.r, cel.r * 0.6, t + cel.x * 6, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      c.globalAlpha = 1;
      c.strokeStyle = '#5ff7ff';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(320, 195, 150, 0, Math.PI * 2);
      c.stroke();
    },
  });
  pantalla(g, ctx, {
    x: 2.9,
    y: 1.75,
    z: -4.43,
    titulo: '🌡️ TEMPERATURA',
    dibujar: (c, t) => {
      c.fillStyle = 'rgba(255, 90, 95, 0.18)';
      c.fillRect(30, 110, 580, 120);
      c.fillStyle = '#ff8a8d';
      c.font = fuente(22, 700);
      c.fillText('ZONA DE PELIGRO 5 °C – 60 °C', 40, 116);
      c.strokeStyle = '#ffc23c';
      c.lineWidth = 5;
      c.beginPath();
      for (let i = 0; i <= 580; i += 6) {
        const yy = 230 - (Math.sin(i * 0.03 + t * 3) * 0.5 + 0.5) * 100 - Math.sin(i * 0.11 + t * 7) * 8;
        i ? c.lineTo(30 + i, yy) : c.moveTo(30, yy);
      }
      c.stroke();
      c.fillStyle = '#ffffff';
      c.font = fuente(46, 800);
      c.fillText(`${(36.8 + Math.sin(t * 2) * 0.3).toFixed(1)} °C`, 410, 270);
    },
  });
}

function proyectorHolografico(g, ctx) {
  const base = new THREE.Vector3(-2.7, 0, -2.6);
  const anillos = [0.35, 0.95, 1.55].map((y, i) => {
    const a = malla(new THREE.TorusGeometry(0.42 - i * 0.06, 0.008, 6, 48), mat('#5ff7ff', { tipo: 'basica', opacidad: 0.7 }), [base.x, y, base.z], [Math.PI / 2, 0, 0]);
    g.add(a);
    return a;
  });
  const haz = malla(new THREE.CylinderGeometry(0.35, 0.45, 1.8, 32, 1, true), mat('#5ff7ff', { tipo: 'basica', opacidad: 0.08, lados: THREE.DoubleSide }), [base.x, 1.0, base.z]);
  g.add(haz);
  const tipos = ['virus', 'bacilo', 'levadura', 'protozoo'];
  const soporte = new THREE.Group();
  soporte.position.set(base.x, 1.35, base.z);
  g.add(soporte);
  let actual = null;
  let indice = -1;
  const cambiar = () => {
    indice = (indice + 1) % tipos.length;
    if (actual) soporte.remove(actual);
    actual = holograma(microbios[tipos[indice]](), ['#5ff7ff', '#7dff9a', '#ffc23c', '#ff8fd1'][indice]);
    actual.scale.setScalar(2.6);
    soporte.add(actual);
  };
  cambiar();
  let reloj = 0;
  ctx.cada((dt, t) => {
    reloj += dt;
    if (reloj > 7) {
      reloj = 0;
      cambiar();
    }
    const transicion = Math.min(1, reloj / 0.6, (7 - reloj) / 0.6);
    soporte.scale.setScalar(Math.max(0.01, transicion));
    soporte.rotation.y = t * 0.6;
    soporte.position.y = 1.35 + Math.sin(t * 1.2) * 0.05;
    actual.userData.animar?.(t);
    anillos.forEach((a, i) => {
      a.rotation.z = t * (0.6 + i * 0.4) * (i % 2 ? -1 : 1);
      a.position.y = [0.35, 0.95, 1.55][i] + Math.sin(t * 1.5 + i) * 0.04;
    });
    haz.material.opacity = 0.07 + Math.sin(t * 3) * 0.02;
  });
}

// ── Mercado ────────────────────────────────────────────────────────────────

function vendedores(g, ctx) {
  const lista = [
    [{ camisa: '#e5484d', delantal: '#ffffff', gorro: 'sombrero', piel: '#b9794f' }, [0.55, 0, -3.25], 0],
    [{ camisa: '#ffffff', delantal: '#e5484d', gorro: 'gorra', piel: '#c98b5e', cabello: '#1d1d27' }, [-3.25, 0, 0.35], Math.PI / 2],
    [{ camisa: '#2dbe78', delantal: '#ffc23c', gorro: 'ninguno', piel: '#8d5a3b' }, [3.25, 0, -1.0], -Math.PI / 2],
    [{ camisa: '#8b5cf6', delantal: '#ffffff', gorro: 'sombrero', piel: '#d9a06f' }, [0.7, 0, 3.05], Math.PI],
  ];
  for (const [opciones, [x, y, z], ry] of lista) {
    const v = prefabsMercado.vendedor(opciones);
    v.position.set(x, y, z);
    v.rotation.y = ry;
    g.add(v);
    ctx.cada((_dt, t) => v.userData.animar(t));
  }
}

/** Cuerdas de banderines de colores que cruzan sobre el mercado y se mecen con el viento. */
function banderines(g, ctx) {
  const cuerdas = [[[-4.5, -4.5], [4.5, 4.5]], [[4.5, -4.5], [-4.5, 4.5]], [[-5, 0.2], [5, 0.2]], [[0, -5], [0, 5]]];
  const porCuerda = 18;
  const forma = new THREE.Shape();
  forma.moveTo(-0.11, 0);
  forma.lineTo(0.11, 0);
  forma.lineTo(0, -0.26);
  forma.closePath();
  const banderas = new THREE.InstancedMesh(new THREE.ShapeGeometry(forma), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), cuerdas.length * porCuerda);
  banderas.frustumCulled = false;
  const colores = ['#ff5a5f', '#ffc23c', '#2dbe78', '#4f7cff', '#ff8fd1', '#ffffff'];
  const color = new THREE.Color();
  const datos = [];
  const puntosCuerda = [];
  cuerdas.forEach(([a, b], c) => {
    const yuyu = (k) => 3.35 - Math.sin(k * Math.PI) * 0.45; // la cuerda cuelga en el centro
    for (let i = 0; i < porCuerda; i++) {
      const k = (i + 0.5) / porCuerda;
      datos.push({ pos: V(a[0] + (b[0] - a[0]) * k, yuyu(k), a[1] + (b[1] - a[1]) * k), giro: Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2, fase: i * 0.7 + c });
      banderas.setColorAt(c * porCuerda + i, color.set(colores[(i + c) % colores.length]));
    }
    for (let i = 0; i < 16; i++) {
      for (const k of [i / 16, (i + 1) / 16]) puntosCuerda.push(V(a[0] + (b[0] - a[0]) * k, yuyu(k) + 0.005, a[1] + (b[1] - a[1]) * k));
    }
  });
  g.add(banderas);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(puntosCuerda), new THREE.LineBasicMaterial({ color: '#5d4037' })));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const uno = V(1, 1, 1);
  ctx.cada((_dt, t) => {
    datos.forEach((d, i) => {
      e.set(Math.sin(t * 2.2 + d.fase) * 0.35, d.giro, 0, 'YXZ');
      banderas.setMatrixAt(i, m.compose(d.pos, q.setFromEuler(e), uno));
    });
    banderas.instanceMatrix.needsUpdate = true;
  });
}

/** Palomas que caminan y picotean el piso. */
function palomas(g, ctx) {
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Group();
    const cuerpo = new THREE.Group();
    cuerpo.add(malla(new THREE.SphereGeometry(0.09, 14, 10), mat('#8a94a3'), [0, 0.11, 0], [0, 0, 0], [1, 0.85, 1.5]));
    cuerpo.add(malla(new THREE.ConeGeometry(0.05, 0.12, 8), mat('#5f6875'), [0, 0.12, -0.15], [-Math.PI / 2 - 0.3, 0, 0]));
    for (const lado of [-1, 1]) cuerpo.add(malla(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4), mat('#d0574a'), [lado * 0.03, 0.03, 0]));
    fusionar(cuerpo);
    const cabeza = new THREE.Group();
    cabeza.add(malla(new THREE.SphereGeometry(0.045, 12, 10), mat('#6a7b8f'), [0, 0, 0]));
    cabeza.add(malla(new THREE.ConeGeometry(0.012, 0.035, 6), mat('#d9a35e'), [0, -0.005, 0.05], [Math.PI / 2, 0, 0]));
    fusionar(cabeza);
    cabeza.position.set(0, 0.2, 0.1);
    p.add(cuerpo, cabeza);
    g.add(p);
    const centro = i ? V(3.9, 0, 3.6) : V(-3.8, 0, -3.7);
    let destino = centro.clone();
    let espera = azar(1, 3);
    p.position.copy(centro);
    ctx.cada((dt, t) => {
      const falta = destino.clone().sub(p.position).setY(0);
      if (falta.length() > 0.05) {
        p.position.addScaledVector(falta.normalize(), dt * 0.35);
        p.rotation.y = Math.atan2(falta.x, falta.z);
        cabeza.position.z = 0.1 + Math.abs(Math.sin(t * 9)) * 0.03;
        cabeza.position.y = 0.2;
      } else {
        // Picotea
        cabeza.position.y = 0.2 - Math.max(0, Math.sin(t * 6 + i)) * 0.12;
        espera -= dt;
        if (espera <= 0) {
          espera = azar(2, 5);
          destino = centro.clone().add(V(azar(-0.9, 0.9), 0, azar(-0.9, 0.9)));
        }
      }
    });
  }
}

// ── Planta procesadora ─────────────────────────────────────────────────────

/** Brazo robótico que empaca cajas sin parar. */
function robotEmpacador(g, ctx, posicion) {
  const base = new THREE.Group();
  base.position.copy(posicion);
  const amarillo = mat('#ffb300');
  const gris = mat('#3a4250');
  base.add(malla(new THREE.CylinderGeometry(0.32, 0.38, 0.25, 24), gris, [0, 0.125, 0]));
  const torre = new THREE.Group();
  torre.position.y = 0.25;
  torre.add(malla(new THREE.CylinderGeometry(0.22, 0.24, 0.35, 20), amarillo, [0, 0.175, 0]));
  const hombro = new THREE.Group();
  hombro.position.y = 0.4;
  hombro.add(malla(new THREE.BoxGeometry(0.16, 0.9, 0.16), amarillo, [0, 0.45, 0]));
  hombro.add(malla(new THREE.SphereGeometry(0.12, 14, 10), gris));
  const codo = new THREE.Group();
  codo.position.y = 0.9;
  codo.add(malla(new THREE.SphereGeometry(0.1, 14, 10), gris));
  codo.add(malla(new THREE.BoxGeometry(0.12, 0.75, 0.12), amarillo, [0, 0.375, 0]));
  const pinza = new THREE.Group();
  pinza.position.y = 0.78;
  pinza.add(malla(new THREE.BoxGeometry(0.24, 0.05, 0.1), gris));
  const caja = malla(new THREE.BoxGeometry(0.3, 0.24, 0.26), mat('#c8a06a'), [0, -0.15, 0]);
  pinza.add(caja);
  codo.add(pinza);
  hombro.add(codo);
  torre.add(hombro);
  base.add(torre);
  g.add(base);
  ctx.cada((_dt, t) => {
    const k = (t * 0.25) % 1;
    const ida = Math.sin(k * Math.PI * 2);
    torre.rotation.y = ida * 1.1;
    hombro.rotation.z = 0.5 + Math.sin(k * Math.PI * 4) * 0.25;
    codo.rotation.z = 1.4 + Math.sin(k * Math.PI * 4 + 1) * 0.3;
    pinza.rotation.z = -1.9 - hombro.rotation.z - codo.rotation.z + Math.PI;
    caja.visible = k < 0.5;
  });
}

function balizas(g, ctx, posiciones) {
  for (const p of posiciones) {
    const b = new THREE.Group();
    b.position.copy(p);
    b.add(malla(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 14), mat('#3a4250')));
    b.add(malla(new THREE.SphereGeometry(0.08, 14, 10), mat('#ff9f1c', { tipo: 'basica' }), [0, 0.08, 0]));
    const haz = malla(new THREE.ConeGeometry(0.5, 2.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 0.08, 1.1], [-Math.PI / 2, 0, 0]);
    const giro = new THREE.Group();
    giro.add(haz);
    b.add(giro);
    g.add(b);
    ctx.cada((dt) => (giro.rotation.y += dt * 3));
  }
}

function vapor(g, ctx, origen) {
  const nubes = Array.from({ length: 6 }, () => {
    const n = malla(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    g.add(n);
    return n;
  });
  let vida = -1;
  cadaTanto(ctx, [6, 11], () => {
    vida = 0;
    ctx.audio.rafaga({ duracion: 1.2, filtro: 'highpass', frecuencia: 1800, volumen: 0.05, pos: g.localToWorld(origen.clone()) });
  });
  ctx.cada((dt) => {
    if (vida < 0) return;
    vida += dt;
    nubes.forEach((n, i) => {
      const k = THREE.MathUtils.clamp(vida * 0.8 - i * 0.12, 0, 1);
      n.position.set(origen.x + Math.sin(i * 2) * k * 0.3, origen.y + k * 1.2, origen.z + Math.cos(i * 3) * k * 0.2);
      n.scale.setScalar(0.5 + k * 2.5);
      n.material.opacity = k > 0 && k < 1 ? 0.45 * (1 - k) : 0;
    });
    if (vida > 2.5) vida = -1;
  });
}

// ── Cuerpo humano ──────────────────────────────────────────────────────────

/** Burbujas que suben del lago de ácido y revientan. */
function burbujasAcido(zona, ctx) {
  const n = 70;
  const malla_ = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#e4ff7a', transparent: true, opacity: 0.65, depthWrite: false }), n);
  malla_.frustumCulled = false;
  zona.add(malla_);
  const datos = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = azar(1.5, 5.8);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r - 1, k: Math.random(), v: azar(0.25, 0.6), s: azar(0.03, 0.09) };
  });
  const m = new THREE.Matrix4();
  ctx.cada((dt) => {
    if (!zona.visible) return;
    datos.forEach((d, i) => {
      d.k += dt * d.v;
      if (d.k > 1) d.k = 0;
      const s = d.s * (d.k > 0.85 ? (1 - d.k) * 6.7 : 0.4 + d.k);
      m.makeScale(s, s, s).setPosition(d.x, -0.04 + d.k * 0.35, d.z);
      malla_.setMatrixAt(i, m);
    });
    malla_.instanceMatrix.needsUpdate = true;
  });
  cadaTanto(ctx, [0.3, 0.9], () => {
    if (!zona.visible) return;
    const d = datos[Math.floor(Math.random() * n)];
    ctx.audio.burbuja(zona.localToWorld(V(d.x, 0.2, d.z)));
  });
}

/** Vellosidades del intestino que se mecen y la microbiota que nada entre ellas. */
function vellosidades(zona, ctx) {
  const lista = [];
  for (let i = 0; i < 420 && lista.length < 260; i++) {
    const enPared = i % 3 === 0;
    let pos;
    let normal;
    if (enPared) {
      const a = azar(-1.25, 1.25) + (i % 2 ? Math.PI : 0);
      const z = azar(-20, 8);
      pos = V(Math.sin(a) * 3.85, 1.4 + Math.cos(a) * 3.85, z);
      normal = V(-Math.sin(a), -Math.cos(a), 0);
      if (pos.y < 0.3) continue;
    } else {
      pos = V(azar(-3.6, 3.6), 0, azar(-20, 8));
      normal = V(0, 1, 0);
      if (Math.hypot(pos.x, pos.z) < 1.5 || (Math.abs(pos.x) < 1.2 && pos.z > -2.6 && pos.z < 0)) continue;
    }
    lista.push({ pos, q: new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), normal), fase: Math.random() * 6, s: azar(0.8, 1.3) });
  }
  const geo = new THREE.CapsuleGeometry(0.11, 0.5, 4, 10);
  geo.translate(0, 0.36, 0);
  const villi = new THREE.InstancedMesh(geo, mat('#f2a5b0'), lista.length);
  villi.frustumCulled = false;
  const color = new THREE.Color();
  lista.forEach((_, i) => villi.setColorAt(i, color.set(i % 3 ? '#f2a5b0' : '#e8899a')));
  zona.add(villi);

  const n = 140;
  const geoBicho = new THREE.CapsuleGeometry(0.03, 0.09, 4, 8);
  geoBicho.rotateZ(Math.PI / 2);
  const bichos = new THREE.InstancedMesh(geoBicho, mat('#ffffff', { emisivo: 0.4 }), n);
  bichos.frustumCulled = false;
  const coloresBichos = ['#6cc4ff', '#7fdc6b', '#b56cff', '#ffc23c'];
  const datosBichos = Array.from({ length: n }, (_, i) => {
    bichos.setColorAt(i, color.set(coloresBichos[i % 4]));
    return { c: V(azar(-3, 3), azar(0.3, 2.6), azar(-16, 6)), r: azar(0.15, 0.6), w: azar(0.4, 1.2) * (i % 2 ? 1 : -1), f: Math.random() * 6 };
  });
  datosBichos.forEach((d) => {
    if (Math.hypot(d.c.x, d.c.z) < 1.4) d.c.x += d.c.x < 0 ? -1.6 : 1.6;
  });
  zona.add(bichos);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const ondula = new THREE.Quaternion();
  const eje = V(1, 0, 0);
  const escala = V();
  const p = V();
  ctx.cada((_dt, t) => {
    if (!zona.visible) return;
    lista.forEach((d, i) => {
      ondula.setFromAxisAngle(eje, Math.sin(t * 1.6 + d.fase + d.pos.z * 0.4) * 0.25);
      q.copy(d.q).multiply(ondula);
      escala.set(1, d.s * (1 + Math.sin(t * 2 + d.fase) * 0.06), 1);
      villi.setMatrixAt(i, m.compose(d.pos, q, escala));
    });
    villi.instanceMatrix.needsUpdate = true;
    datosBichos.forEach((d, i) => {
      const a = t * d.w + d.f;
      p.set(d.c.x + Math.cos(a) * d.r, d.c.y + Math.sin(a * 1.3) * 0.15, d.c.z + Math.sin(a) * d.r);
      q.setFromAxisAngle(V(0, 1, 0), -a);
      bichos.setMatrixAt(i, m.compose(p, q, escala.set(1, 1, 1)));
    });
    bichos.instanceMatrix.needsUpdate = true;
  });
}

/** Glóbulos rojos que pasan por el vaso sanguíneo dando vueltas. */
function torrenteSanguineo(zona, ctx) {
  const perfil = [[0, 0.03], [0.075, 0.04], [0.15, 0.065], [0.19, 0.045], [0.2, 0], [0.19, -0.045], [0.15, -0.065], [0.075, -0.04], [0, -0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  const n = 150;
  const celulas = new THREE.InstancedMesh(new THREE.LatheGeometry(perfil, 20), mat('#d8323f'), n);
  celulas.frustumCulled = false;
  zona.add(celulas);
  const datos = [];
  while (datos.length < n) {
    const r = Math.sqrt(Math.random()) * 3.0;
    const a = Math.random() * Math.PI * 2;
    const y = 1.5 + Math.sin(a) * r;
    const z = -0.5 + Math.cos(a) * r;
    if (Math.hypot(y - 1.4, z) < 1.4) continue; // no atraviesan la cabeza del usuario
    datos.push({ x: azar(-20, 20), y, z, v: azar(1.0, 1.8), giro: V(Math.random(), Math.random(), Math.random()).normalize(), f: Math.random() * 6 });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = V();
  const uno = V(1, 1, 1);
  ctx.cada((dt, t) => {
    if (!zona.visible) return;
    datos.forEach((d, i) => {
      d.x += d.v * dt;
      if (d.x > 20) d.x = -20;
      q.setFromAxisAngle(d.giro, t * 0.8 + d.f);
      p.set(d.x, d.y + Math.sin(t + d.f) * 0.1, d.z);
      celulas.setMatrixAt(i, m.compose(p, q, uno));
    });
    celulas.instanceMatrix.needsUpdate = true;
  });
}

function vidaCuerpo(g, ctx) {
  const { boca, estomago, intestino, defensas } = ctx.zonas;
  motas(boca, ctx, { caja: [-3, 3, 0.3, 3.5, -5, 3], cantidad: 110, color: '#e8f6ff', tam: 0.05, opacidad: 0.6, velocidad: 0.05 });
  burbujasAcido(estomago, ctx);
  motas(estomago, ctx, { caja: [-5, 5, 0.2, 4, -6, 4], cantidad: 120, color: '#f4ff9a', tam: 0.06, opacidad: 0.45, velocidad: 0.15 });
  vellosidades(intestino, ctx);
  torrenteSanguineo(defensas, ctx);
  motas(defensas, ctx, { caja: [-6, 6, -1, 4, -3.5, 2.5], cantidad: 140, color: '#ffd38a', tam: 0.04, opacidad: 0.6, velocidad: 0.2 });
  // Latido del corazón de fondo: "pum-pum" grave cada segundo.
  let reloj = 0;
  ctx.cada((dt) => {
    reloj += dt;
    if (reloj < 1.0) return;
    reloj = 0;
    ctx.audio.tono(58, 0.16, { tipo: 'triangle', volumen: 0.16 });
    ctx.audio.tono(52, 0.2, { tipo: 'triangle', volumen: 0.12, retardo: 0.22 });
  });
}

const VIDA = {
  mercado(g, ctx) {
    vendedores(g, ctx);
    banderines(g, ctx);
    palomas(g, ctx);
    motas(g, ctx, { caja: [-5, 5, 0.3, 3, -5, 5], cantidad: 80, color: '#fffbd0', tam: 0.03 });
    cadaTanto(ctx, [3, 7], () => {
      const a = Math.random() * Math.PI * 2;
      ctx.audio.pajaro(g.localToWorld(V(Math.cos(a) * 7, 4, Math.sin(a) * 7)));
    });
    cadaTanto(ctx, [4, 9], () => {
      const a = Math.random() * Math.PI * 2;
      const pos = g.localToWorld(V(Math.cos(a) * 3.5, 1, Math.sin(a) * 3.5));
      ctx.audio.tono(2600, 0.05, { tipo: 'square', volumen: 0.015, pos });
      ctx.audio.tono(3100, 0.08, { tipo: 'square', volumen: 0.012, retardo: 0.06, pos });
    });
  },
  planta(g, ctx) {
    robotEmpacador(g, ctx, V(4.7, 0, -3.6));
    balizas(g, ctx, [V(-6.85, 3.3, 2.5), V(6.85, 3.3, -3.5)]);
    vapor(g, ctx, V(-5.4, 4.0, -4.4));
    const motor = ctx.audio.fuenteEspacial('motor', g.localToWorld(V(-4.5, 1.5, -4.5)));
    ctx.alDetener(() => motor.detener());
    motas(g, ctx, { caja: [-6, 6, 0.4, 4.5, -5, 5], cantidad: 90, color: '#ffffff', tam: 0.025, opacidad: 0.4 });
  },
  cuerpo: vidaCuerpo,
  laboratorio(g, ctx) {
    pantallasLaboratorio(g, ctx);
    proyectorHolografico(g, ctx);
    motas(g, ctx, { caja: [-4.5, 4.5, 0.2, 3.2, -4, 4], cantidad: 160, color: '#5ff7ff', tam: 0.025, opacidad: 0.5, velocidad: 0.05 });
  },
  taller(g, ctx) {
    lamparasColgantes(g, ctx);
    notasQueSeMueven(g, ctx);
    motas(g, ctx, { caja: [-4, 4, 0.4, 2.8, 2, 4.2], cantidad: 120 });
  },
  patio(g, ctx) {
    banderaEcuador(g, ctx);
    nubes(g, ctx);
    mariposas(g, ctx);
    motas(g, ctx, { caja: [-5, 5, 0.2, 2.5, -5, 3], cantidad: 70, color: '#fffbd0', tam: 0.03 });
  },
  aula(g, ctx) {
    pizarra(g, ctx);
    reloj(g, ctx, V(2.1, 2.55, -4.47));
    motas(g, ctx, { caja: [-4.2, -1.4, 0.4, 2.8, -2.8, 3.2], cantidad: 140 });
  },
  cocina(g, ctx) {
    const olla = objetos.olla();
    olla.scale.setScalar(1.3);
    olla.position.set(0.82, 0.95, -3.55);
    g.add(olla);
    ctx.cada((_dt, t) => olla.userData.animar?.(t));
    moscas(g, ctx, 2);
    const refri = ctx.audio.fuenteEspacial('motor', g.localToWorld(V(2.45, 1.2, -3.55)));
    ctx.alDetener(() => refri.detener());
    motas(g, ctx, { caja: [-2.2, -0.2, 0.9, 2.4, -3.8, -1.8], cantidad: 90 });
  },
  microscopico(g, ctx) {
    nadadores(g, ctx);
    motas(g, ctx, { caja: [-6, 6, 0, 4, -6, 6], cantidad: 220, color: '#9ff7ff', tam: 0.035, opacidad: 0.6, velocidad: 0.12 });
  },
  lavabo(g, ctx) {
    goteo(g, ctx);
    burbujasJabon(g, ctx);
  },
  naturaleza(g, ctx) {
    mariposas(g, ctx);
    nubes(g, ctx);
    motas(g, ctx, { caja: [-5, 5, 0.2, 2.5, -5, 5], cantidad: 80, color: '#fffbd0', tam: 0.03 });
  },
  espacio(g, ctx) {
    estrellasFugaces(g, ctx);
    motas(g, ctx, { caja: [-6, 6, 0.3, 5, -6, 6], cantidad: 160, color: '#cfd8ff', tam: 0.03, velocidad: 0.02 });
  },
};

/** Agrega animaciones y sonido ambiente al entorno `nombre`. */
export function darVida(nombre, g, ctx) {
  VIDA[nombre]?.(g, ctx);
  ctx.audio.ambiente(AMBIENTES[nombre]);
  ctx.alDetener(() => ctx.audio.detenerAmbiente());
}
