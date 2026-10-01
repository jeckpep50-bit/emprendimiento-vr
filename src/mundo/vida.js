import * as THREE from 'three';
import { microbios } from './prefabs/microbios.js';
import { objetos, mosca } from './prefabs/objetos.js';
import { mat, malla } from './materiales.js';
import { envolver, fuente } from '../ui/lienzo.js';

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

const VIDA = {
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
