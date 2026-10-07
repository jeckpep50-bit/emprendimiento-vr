import * as THREE from 'three';
import { suavizado } from '../core/efectos.js';
import { mat, malla, fusionar, liberar } from '../mundo/materiales.js';
import { crearModelo } from '../mundo/prefabs/index.js';
import { mercado as prefabsMercado } from '../mundo/prefabs/mercado.js';
import { cielo, texturaLienzo, matTextura } from '../mundo/entornos.js';
import { PanelLienzo, COLORES, escribir } from '../ui/lienzo.js';
import { LINEAS, CAPITULOS, CARPETA_AUDIO } from './guion-suelos.js';
import * as arte from './arte-suelos.js';

// Película "Types of Soil" (3.º EGB, en inglés): coreografía de los 10 capítulos.
// Coordenadas de la escena: el usuario en el origen mirando a -Z, suelo en y = 0.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ── Ayudas comunes ──────────────────────────────────────────────────────────

/** Gira un objeto (hijo de la raíz) para que mire al usuario. */
function mirarAlUsuario(d, obj) {
  const p = obj.position;
  obj.lookAt(d.raiz.localToWorld(V(0, p.y, 0.2)));
}

/** Wiggles viaja en su hoja voladora, a la derecha del estudiante. */
function wigglesEnHoja(d, { x = 0.6, dy = -0.62, z = -0.95 } = {}) {
  const { guia, wiggles } = d.extra;
  guia.visible = true;
  guia.add(wiggles.grupo);
  wiggles.grupo.position.set(0, 0.035, 0.04);
  wiggles.grupo.rotation.set(0, 0, 0);
  wiggles.grupo.scale.setScalar(0.85);
  guia.position.set(x, d.H + dy, z);
  guia.userData.baseY = guia.position.y;
  mirarAlUsuario(d, guia);
}

/** Wiggles en el piso (o donde se indique), sin la hoja. */
function wigglesEn(d, pos, escala = 1) {
  const { guia, wiggles } = d.extra;
  guia.visible = false;
  d.raiz.add(wiggles.grupo);
  wiggles.grupo.position.copy(pos);
  wiggles.grupo.scale.setScalar(escala);
  mirarAlUsuario(d, wiggles.grupo);
}

/** Cartel flotante con una palabra (vocabulario). */
function palabra(texto, color = '#23304a', ancho = 0.42) {
  const p = new PanelLienzo(ancho, 0.12, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, (h - 8) / 2);
    ctx.fill();
    escribir(ctx, texto, w / 2, h / 2, { tam: 64, peso: 900, color: '#ffffff', alinear: 'center', base: 'middle', maxAncho: w - 30 });
  });
  return p;
}

function chispas(d, obj, color = '#ffe27a', n = 30) {
  d.m.fx.pixeles(obj.getWorldPosition(V(0, 0, 0)), color, n, 0.5);
}

/** Animación que se repite cada cuadro mientras dure el capítulo (respeta la pausa). */
function flotarEn(d, obj, amplitud = 0.02, velocidad = 1.4) {
  const base = obj.position.y;
  const fase = Math.random() * 6;
  d.cada((_dt, t) => (obj.position.y = base + Math.sin(t * velocidad + fase) * amplitud));
}

async function retroalimentar(d, elegida, correcta) {
  if (elegida === correcta) await d.di(Math.random() < 0.5 ? 'bien_1' : 'bien_2');
  else if (elegida >= 0) await d.di('intento');
}

// ── 1. Hello, Wiggles! (aula, realidad aumentada) ───────────────────────────

async function cap1(d) {
  const { wiggles } = d.extra;
  await d.escenario('aula', { fundido: false });
  d.musica.iniciar('alegre');
  d.extra.guia.visible = false;
  wigglesEn(d, V(0, -0.7, -1.3));
  await d.titulo(0);
  const agujero = arte.crearAgujero(0.42, { tapa: !d.enAR });
  agujero.scale.setScalar(0.001);
  d.poner(agujero, 0, 0.004, -1.3);
  const linea = d.di('c1_1');
  d.m.audio.tono(80, 2.2, { tipo: 'sawtooth', hasta: 50, volumen: 0.06 });
  d.m.audio.rafaga({ duracion: 2, filtro: 'lowpass', frecuencia: 300, volumen: 0.12 });
  d.escalar(agujero, 1, 2.2, suavizado.salida);
  d.espera(1).then(() => d.m.fx.pixeles(d.raiz.localToWorld(V(0, 0.05, -1.3)), '#8d6e4a', 60, 0.6), () => {});
  await linea;
  await d.di('c1_2');
  // ¡Wiggles sale del hueco!
  d.m.audio.tono(300, 0.3, { hasta: 900, volumen: 0.12 });
  d.m.fx.pixeles(d.raiz.localToWorld(V(0, 0.1, -1.3)), '#6b4428', 70, 0.8);
  await d.mover(wiggles.grupo, V(0, 0.02, -1.3), 1.0, suavizado.rebote);
  await d.di('c1_3');
  wiggles.saludar();
  await d.di('c1_4');
  wiggles.saludar();
  await d.di('c1_5');
  d.aviso('👋 Wave hello!');
  await d.espera(3.5);
  await d.di('c1_6');
  await d.di('c1_7');
  // Tres montoncitos: sand, clay y loam
  const suelos = [
    ['arena', 'SAND', '#d9a35e', -0.6],
    ['arcilla', 'CLAY', '#b8653f', 0],
    ['franco', 'LOAM', '#5a3b22', 0.6],
  ].map(([tipo, texto, color, x]) => {
    const g = new THREE.Group();
    const m = arte.montoncito(tipo, 0.13);
    const p = palabra(texto, color, 0.3);
    p.position.y = 0.22;
    g.add(m, p);
    g.scale.setScalar(0.001);
    d.poner(g, x, 0, -0.85 - Math.abs(x) * 0.3);
    mirarAlUsuario(d, g);
    return g;
  });
  await d.diCon('c1_8', suelos.map((g, i) => [0.25 + i * 0.2, () => (g.userData.escalaFinal = 1, d.aparecer(g, 0.5), d.m.audio.pop(g.getWorldPosition(V(0, 0, 0))))]));
  await d.di('c1_9');
  d.aviso('🗣️ Soil!');
  await d.espera(2.5);
  await d.di('c1_10');
  await d.di('c1_11');
  await d.di('c1_12');
  for (const g of suelos) g.userData.centroBrillo = V(0, 0.1, 0);
  await d.tocar(suelos, { tiempo: 10, brillo: 0.2, alTocar: (g) => {
    chispas(d, g, '#ffe27a', 30);
    d.escalar(g, 1.3, 0.25).then(() => d.escalar(g, 1, 0.3), () => {});
    d.decir('wow');
  } });
  await d.di('c1_13');
  // Llega la hoja voladora y Wiggles sube a ella
  const { guia } = d.extra;
  const destino = V(0.6, d.H - 0.62, -0.95);
  guia.visible = true;
  guia.position.set(2.5, d.H, -1.5);
  mirarAlUsuario(d, guia);
  d.m.audio.tono(500, 0.8, { hasta: 1200, volumen: 0.06 });
  await d.mover(guia, V(0, 0.06, -1.15), 1.2);
  d.m.audio.tono(400, 0.25, { hasta: 1000, volumen: 0.1 });
  wigglesEnHoja(d, { x: 0, dy: 0.06 - d.H, z: -1.15 });
  guia.userData.baseY = undefined;
  await d.mover(guia, destino, 1.4);
  wigglesEnHoja(d);
  await d.espera(0.6);
}

// ── 2. What is soil? (aula) ─────────────────────────────────────────────────

async function cap2(d) {
  await d.escenario('aula');
  wigglesEnHoja(d);
  await d.titulo(1);
  d.poner(arte.mesa(1.0, 0.55, 0.6), 0, 0, -1.1);
  const mont = d.poner(arte.monticuloSuelo(), 0, 0.6, -1.1);
  d.aparecer(mont, 0.7);
  await d.di('c2_1');
  await d.di('c2_2');
  await d.di('c2_3');
  const datos = [
    ['rocas', 'p_rocas', 'Rock pieces', '#7d8794', 'c2_4'],
    ['humus', 'p_humus', 'Humus', '#3b2416', 'c2_5'],
    ['agua', 'p_agua', 'Water', '#2f8be6', 'c2_7'],
    ['aire', 'p_aire', 'Air', '#7fb3d6', 'c2_8'],
    ['vida', 'p_vida', 'Living things', '#2dbe78', 'c2_9'],
  ];
  const nodos = [];
  for (const [i, [tipo, , nombre, color, linea]] of datos.entries()) {
    const nodo = new THREE.Group();
    const modelo = arte.ingredientes[tipo]();
    modelo.scale.setScalar(1.5);
    const etiqueta = palabra(nombre, color, 0.34);
    etiqueta.scale.setScalar(0.75);
    etiqueta.position.y = -0.17;
    nodo.add(modelo, etiqueta);
    nodo.userData.modelo = modelo;
    nodo.userData.tamBrillo = 0.55;
    nodo.position.set(0, 0.75, -1.1);
    nodo.scale.setScalar(0.001);
    d.plato.add(nodo);
    const ang = THREE.MathUtils.degToRad(-44 + i * 22);
    const destino = V(Math.sin(ang) * 1.15, d.H - 0.12 + (i % 2) * 0.06, -Math.cos(ang) * 1.15);
    const vuelo = (async () => {
      d.m.audio.pop(d.raiz.localToWorld(V(0, 0.8, -1.1)));
      d.escalar(nodo, 1, 0.6);
      await d.mover(nodo, destino, 0.9, suavizado.salida);
      mirarAlUsuario(d, nodo);
      flotarEn(d, nodo, 0.015);
    })();
    vuelo.catch(() => {});
    nodos.push(nodo);
    d.cada((dt) => (modelo.rotation.y += dt * 0.6));
    await d.di(linea);
    if (tipo === 'humus') {
      await d.di('c2_6');
      d.aviso('🗣️ Humus!');
      await d.espera(2);
    }
  }
  await d.di('c2_10');
  await d.tocar(nodos, {
    tiempo: 14,
    alTocar: (nodo, i) => {
      chispas(d, nodo, datos[i][3] === '#3b2416' ? '#c98a2b' : '#ffe27a');
      d.escalar(nodo.userData.modelo, 2.0, 0.3).then(() => d.escalar(nodo.userData.modelo, 1.5, 0.4), () => {});
      d.decir(datos[i][1]);
    },
  });
  await d.espera(0.6);
  await d.di('c2_11');
  await d.di('c2_16');
  // Contamos con los dedos: cada ingrediente late y aparece su número
  await d.diCon(
    'c2_12',
    nodos.map((nodo, i) => [
      0.22 + i * 0.16,
      () => {
        d.escalar(nodo, 1.3, 0.25).then(() => d.escalar(nodo, 1, 0.3), () => {});
        const n = palabra(String(i + 1), COLORES.naranja, 0.12);
        n.position.set(0, 0.2, 0);
        nodo.add(n);
        d.aparecer(n, 0.4);
        d.m.audio.tono(523 + i * 110, 0.15, { tipo: 'triangle', volumen: 0.1 });
      },
    ]),
  );
  await d.di('c2_13');
  // Alimentos que crecen en el suelo
  const comidas = ['manzana', 'banano', 'zanahoria', 'naranja', 'pan'].map((nombre, i) => {
    const m = crearModelo(nombre, { tamano: 0.2 });
    m.scale.setScalar(0.001);
    d.poner(m, -0.45 + i * 0.22, 0.75, -0.95);
    return m;
  });
  await d.diCon('c2_14', comidas.map((m, i) => [0.1 + i * 0.13, () => (m.userData.escalaFinal = 1, d.aparecer(m, 0.5), d.m.audio.pop(m.getWorldPosition(V(0, 0, 0))))]));
  for (const m of comidas) d.cada((dt) => (m.rotation.y += dt));
  await d.di('c2_15');
}

// ── 3. How is soil made? (montaña) ──────────────────────────────────────────

async function cap3(d) {
  const { wiggles } = d.extra;
  await d.titulo(2);
  const linea = d.di('c3_1');
  await d.espera(1.8);
  await d.escenario('montana');
  wigglesEnHoja(d);
  await linea;
  d.musica.iniciar('naturaleza');
  const roca = arte.rocaGrande();
  d.poner(roca.grupo, 0, 0, -2.2);
  wiggles.mirar(d.raiz.localToWorld(V(0, 0.6, -2.2)));
  await d.di('c3_2');
  // Sol, calor y frío
  const sol = crearModelo('sol', { tamano: 0.9 });
  sol.scale.setScalar(0.001);
  d.poner(sol, 1.8, 2.6, -3.4);
  d.cada((dt) => (sol.rotation.z += dt * 0.3));
  const brillo = malla(new THREE.SphereGeometry(0.85, 24, 16), new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0, depthWrite: false }), [0, 0.55, 0]);
  roca.grupo.add(brillo);
  const { app } = d.m;
  const luzDia = app.hemi.intensity;
  sol.userData.escalaFinal = 1;
  d.aparecer(sol, 0.8);
  d.animar({ duracion: 1.5, alActualizar: (k) => (brillo.material.opacity = k * 0.3) });
  await d.di('c3_3');
  // Noches y días: la roca se enfría y se calienta; aparecen grietas
  const dur = await d.duracion('c3_4');
  d.animar({
    duracion: dur,
    curva: suavizado.lineal,
    alActualizar: (k) => {
      const ciclo = Math.sin(k * Math.PI * 4);
      app.hemi.intensity = luzDia * (0.55 + 0.45 * (ciclo * 0.5 + 0.5));
      brillo.material.color.set(ciclo > 0 ? '#ff9f43' : '#6cc4ff');
      brillo.material.opacity = 0.12 + Math.abs(ciclo) * 0.25;
      sol.visible = ciclo > -0.2;
      roca.grietas.forEach((g, i) => (g.visible = k > 0.3 + i * 0.15));
    },
  }).then(() => {
    app.hemi.intensity = luzDia;
    brillo.material.opacity = 0;
  }, () => {});
  await d.di('c3_4');
  // Lluvia
  const nube = arte.nubeLluvia();
  nube.grupo.scale.setScalar(0.001);
  d.poner(nube.grupo, 0, 2.6, -2.2);
  nube.grupo.userData.escalaFinal = 1;
  d.aparecer(nube.grupo, 0.8);
  d.cada((dt) => nube.animar(dt, 2.4));
  d.m.audio.rafaga({ duracion: 4, filtro: 'bandpass', frecuencia: 3000, volumen: 0.05 });
  await d.di('c3_5');
  // Hielo en las grietas
  const hielo = new THREE.Group();
  [[-0.1, 0.65, 0.47], [0.12, 0.42, 0.5], [0.15, 0.85, 0.4]].forEach(([x, y, z]) => hielo.add(malla(new THREE.OctahedronGeometry(0.07, 0), mat('#cfefff', { opacidad: 0.85 }), [x, y, z], [0, 0.5, 0.3])));
  hielo.scale.setScalar(0.001);
  roca.grupo.add(hielo);
  await d.diCon('c3_6', [
    [0.1, () => (nube.grupo.visible = false, hielo.userData.escalaFinal = 1, d.aparecer(hielo, 0.8), app.hemi.intensity = luzDia * 0.75)],
    [0.85, () => {
      d.m.audio.sello(roca.grupo.getWorldPosition(V(0, 0, 0)));
      d.m.fx.sacudir(roca.grupo, 0.05);
      roca.piezas.forEach((p, i) => p.position.copy(p.userData.base).add(V((i % 2 ? 1 : -1) * 0.03, 0, 0)));
      app.hemi.intensity = luzDia;
    }],
  ]);
  // Raíces que se meten en las grietas
  const raices = [
    arte.raiz([V(-0.9, 0, -1.8), V(-0.6, 0.15, -1.85), V(-0.25, 0.45, -1.75), V(-0.1, 0.62, -1.72)], 0.025),
    arte.raiz([V(0.9, 0, -1.9), V(0.55, 0.2, -1.85), V(0.2, 0.42, -1.72)], 0.022),
  ];
  for (const r of raices) d.plato.add(r);
  d.animar({ duracion: 3.5, alActualizar: (k) => raices.forEach((r) => r.userData.crecer(k)) });
  await d.di('c3_7');
  // Viento
  const aire = arte.viento();
  d.poner(aire.grupo, 0, 0, -2.0);
  d.cada((_dt, t) => aire.animar(t));
  d.m.audio.rafaga({ duracion: 3.5, frecuencia: 500, hasta: 1500, volumen: 0.08 });
  await d.di('c3_8');
  // ¡Tu turno! Cada toque afloja una pieza
  await d.di('c3_9');
  await d.tocar(roca.piezas, {
    tiempo: 10,
    brillo: 0.5,
    alTocar: (pieza) => {
      d.m.audio.sello(pieza.getWorldPosition(V(0, 0, 0)));
      chispas(d, pieza, '#c9c9c9', 24);
      pieza.position.add(pieza.position.clone().sub(V(0, 0.5, 0)).setY(0).normalize().multiplyScalar(0.08));
    },
  });
  // La roca se rompe en pedacitos y se convierte en un montón de suelo
  const pila = arte.montoncito('arena', 0.5);
  pila.scale.setScalar(0.001);
  d.poner(pila, 0, 0, -2.2);
  await d.diCon('c3_10', [
    [0.05, () => {
      d.m.audio.rafaga({ duracion: 1.2, filtro: 'lowpass', frecuencia: 600, volumen: 0.15 });
      roca.piezas.forEach((p, i) => {
        const a = (i / 4) * Math.PI * 2;
        d.mover(p, V(Math.cos(a) * 0.7, 0.15, Math.sin(a) * 0.5), 1.2, suavizado.salida);
        d.escalar(p, 0.45, 1.2, suavizado.salida);
      });
      roca.grietas.forEach((g) => (g.visible = false));
    }],
    [0.55, () => {
      roca.piezas.forEach((p) => {
        chispas(d, p, '#d9c49a', 40);
        d.escalar(p, 0.001, 0.8, suavizado.entradaSalida);
      });
      pila.userData.escalaFinal = 1;
      d.aparecer(pila, 1.2);
    }],
  ]);
  // Hojas que caen y bichitos: el montón se vuelve suelo oscuro
  const hojas = [];
  const hojaGeo = new THREE.SphereGeometry(0.05, 8, 6);
  for (let i = 0; i < 10; i++) {
    const h = malla(hojaGeo, mat(['#c98a2b', '#a0522d', '#7cb342'][i % 3]), [THREE.MathUtils.randFloat(-0.5, 0.5), 2.2 + i * 0.2, -2.2 + THREE.MathUtils.randFloat(-0.3, 0.3)], [0, i, 0], [1.4, 0.15, 0.8]);
    d.plato.add(h);
    hojas.push(h);
  }
  d.cada((dt, t) => {
    for (const [i, h] of hojas.entries()) {
      if (h.position.y > 0.2) {
        h.position.y -= dt * 0.5;
        h.position.x += Math.sin(t * 2 + i) * dt * 0.2;
        h.rotation.z += dt;
      }
    }
  });
  const pilaOscura = arte.montoncito('franco', 0.52);
  pilaOscura.scale.setScalar(0.001);
  d.poner(pilaOscura, 0, 0.005, -2.2);
  const bichos = [0, 1, 2].map((i) => {
    const b = arte.gusanito(['#f4899c', '#ff9fb1', '#f4899c'][i], 7, 0.025);
    b.scale.setScalar(0.001);
    d.poner(b, -0.25 + i * 0.25, 0.3, -1.85);
    return b;
  });
  await d.diCon('c3_11', [
    [0.4, () => (pilaOscura.userData.escalaFinal = 1, d.aparecer(pilaOscura, 1.2))],
    [0.6, () => bichos.forEach((b, i) => (b.userData.escalaFinal = 1, d.aparecer(b, 0.6, i * 0.2)))],
  ]);
  d.cada((_dt, t) => bichos.forEach((b, i) => (b.rotation.y = Math.sin(t * 2 + i) * 0.6)));
  await d.di('c3_12');
  // Contador de años
  const estado = { anios: 0 };
  const contador = new PanelLienzo(0.7, 0.24, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(20, 30, 60, 0.9)';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 40);
    ctx.fill();
    escribir(ctx, `⏳ ${Math.round(estado.anios)} years`, w / 2, h / 2, { tam: 90, peso: 900, color: '#ffc23c', alinear: 'center', base: 'middle' });
  });
  d.poner(contador, 0, d.H + 0.3, -1.6);
  mirarAlUsuario(d, contador);
  d.aparecer(contador, 0.5);
  let ultimo = 0;
  d.animar({
    duracion: 5,
    curva: suavizado.entradaSalida,
    alActualizar: (k) => {
      estado.anios = k * 500;
      if (Math.floor(estado.anios / 25) !== ultimo) {
        ultimo = Math.floor(estado.anios / 25);
        contador.redibujar();
        d.m.audio.tic();
      }
    },
  });
  await d.di('c3_13');
  await d.di('c3_14');
  wiggles.mirar(null);
}

// ── 4. The layers of soil (ascensor bajo tierra) ────────────────────────────

function texturaCapas() {
  return texturaLienzo(512, 2048, (x, w, h) => {
    const capas = [
      [0, 0.185, '#3b2416', ['#24160c', '#5a3b22', '#e8d9b0']],
      [0.185, 0.49, '#9c7650', ['#7d5a3a', '#b8956a', '#c9c9c9']],
      [0.49, 1, '#7d8794', ['#5f6875', '#9aa3ad', '#4a525c']],
    ];
    for (const [a, b, color, motas] of capas) {
      x.fillStyle = color;
      x.fillRect(0, a * h, w, (b - a) * h);
      for (let i = 0; i < 500; i++) {
        x.fillStyle = motas[i % 3];
        const r = 2 + ((i * 7) % 9);
        x.beginPath();
        x.ellipse((i * 97) % w, a * h + ((i * 61) % Math.floor((b - a) * h)), r * (b > 0.5 ? 2.2 : 1), r, (i % 5) * 0.6, 0, Math.PI * 2);
        x.fill();
      }
    }
    // Bordes ondulados entre capas
    for (const y of [0.185, 0.49]) {
      x.strokeStyle = 'rgba(0,0,0,0.25)';
      x.lineWidth = 8;
      x.beginPath();
      for (let i = 0; i <= w; i += 16) x.lineTo(i, y * h + Math.sin(i * 0.05) * 10);
      x.stroke();
    }
    // Grietas de la roca madre
    x.strokeStyle = 'rgba(40,40,50,0.6)';
    x.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      x.beginPath();
      const x0 = (i * 131) % w;
      const y0 = 0.55 * h + ((i * 211) % (0.4 * h));
      x.moveTo(x0, y0);
      x.lineTo(x0 + 40, y0 + 60);
      x.lineTo(x0 + 20, y0 + 130);
      x.stroke();
    }
  }, [4, 1]);
}

async function cap4(d) {
  const { app } = d.m;
  await d.escenario('montana');
  wigglesEnHoja(d);
  await d.titulo(3);
  const linea = d.di('c4_1');
  await d.espera(1.2);
  await d.escenario('vacio');
  // Mundo que se mueve hacia arriba (nosotros bajamos en el ascensor)
  const mundo = new THREE.Group();
  d.plato.add(mundo);
  const PROF = 6.5;
  const superficie = new THREE.Group();
  superficie.add(cielo('#6fbcf5', '#e9f6ff'));
  superficie.add(malla(new THREE.RingGeometry(1.6, 40, 48, 1), mat('#7cb35a', { tipo: 'lambert' }), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 5 + (i % 3) * 2;
    superficie.add(malla(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 8), mat('#6d4c41'), [Math.cos(a) * r, 0.8, Math.sin(a) * r]));
    superficie.add(malla(new THREE.SphereGeometry(1, 12, 10), mat('#43a047'), [Math.cos(a) * r, 2.1, Math.sin(a) * r]));
  }
  mundo.add(fusionar(superficie));
  const pozo = new THREE.Group();
  pozo.add(malla(new THREE.CylinderGeometry(1.6, 1.6, PROF, 48, 1, true), new THREE.MeshLambertMaterial({ map: texturaCapas(), side: THREE.BackSide }), [0, -PROF / 2, 0]));
  pozo.add(malla(new THREE.CircleGeometry(1.6, 48), mat('#5f6875'), [0, -PROF, 0], [-Math.PI / 2, 0, 0]));
  // Raíces, gusanos y piedras incrustados en las paredes
  const enPared = (ang, y, r = 1.56) => V(Math.sin(ang) * r, y, -Math.cos(ang) * r);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = arte.raiz([enPared(a, -0.02), enPared(a + 0.1, -0.5, 1.5), enPared(a - 0.05, -1.1 - (i % 3) * 0.3, 1.52)], 0.018, '#e8d9b0');
    r.userData.crecer(1);
    pozo.add(r);
  }
  const raizArbol = arte.raiz([enPared(0.5, -0.05), enPared(0.55, -1.0, 1.48), enPared(0.42, -2.0, 1.5), enPared(0.5, -2.9, 1.53)], 0.035, '#a1887f');
  raizArbol.userData.crecer(1);
  pozo.add(raizArbol);
  const piedra = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const y = -1.3 - (i % 8) * 0.24;
    pozo.add(malla(piedra, mat(i % 2 ? '#9aa3ad' : '#c49a72'), enPared(a, y, 1.55).toArray(), [i, i, 0], 0.06 + (i % 3) * 0.03));
  }
  mundo.add(pozo);
  const gusanos = [0.2, -0.4, 1.0, -1.1].map((a, i) => {
    const g = arte.gusanito('#f4899c', 7, 0.025);
    g.position.copy(enPared(a, -0.35 - i * 0.18, 1.52));
    g.lookAt(0, g.position.y, 0);
    mundo.add(g);
    return g;
  });
  d.cada((_dt, t) => gusanos.forEach((g, i) => (g.rotation.z = Math.sin(t * 2 + i) * 0.4)));
  // Carteles de cada capa en la pared del frente
  const carteles = [
    ['TOPSOIL', '#3b2416', -0.6],
    ['SUBSOIL', '#9c7650', -2.2],
    ['BEDROCK', '#5f6875', -4.4],
  ].map(([texto, color, y]) => {
    const p = palabra(texto, color, 0.62);
    p.position.copy(enPared(0, y + 0.55, 1.5));
    p.lookAt(0, p.position.y, 0);
    mundo.add(p);
    return p;
  });
  // Plataforma del ascensor (se queda con el usuario)
  const plataforma = new THREE.Group();
  plataforma.add(malla(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 32), mat('#9aa7b8'), [0, -0.03, 0]));
  plataforma.add(malla(new THREE.TorusGeometry(0.75, 0.02, 6, 40), mat('#ffc23c'), [0, 0.85, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) < 0) continue;
    plataforma.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 0.85, 6), mat('#ffc23c'), [Math.cos(a) * 0.75, 0.425, Math.sin(a) * 0.75]));
  }
  d.plato.add(fusionar(plataforma));
  const lampara = malla(new THREE.SphereGeometry(0.05, 12, 10), mat('#fff6d8', { tipo: 'basica' }), [-0.6, 1.0, -0.4]);
  d.plato.add(lampara);
  await linea;
  d.musica.iniciar('misterio');
  const bajar = async (y, seg, luz) => {
    const desde = app.hemi.intensity;
    d.m.audio.tono(90, seg, { tipo: 'sawtooth', volumen: 0.03 });
    d.animar({ duracion: seg, alActualizar: (k) => (app.hemi.intensity = desde + (luz - desde) * k) });
    await d.mover(mundo, V(0, y, 0), seg, suavizado.entradaSalida);
    d.m.audio.clac();
    d.m.audio.tono(140, 0.2, { tipo: 'triangle', volumen: 0.1 });
  };
  const H = d.H;
  await d.di('c4_2');
  await bajar(H + 0.6, 4, 2.2);
  await d.di('c4_3');
  await d.di('c4_r1');
  d.aviso('🗣️ Topsoil!');
  await d.espera(2.2);
  await d.di('c4_4');
  await d.di('c4_5');
  await bajar(H + 2.2, 4, 1.9);
  await d.di('c4_6');
  await d.di('c4_r2');
  d.aviso('🗣️ Subsoil!');
  await d.espera(2.2);
  await d.di('c4_7');
  await d.di('c4_8');
  await bajar(H + 4.4, 4, 1.7);
  await d.di('c4_9');
  await d.di('c4_r3');
  d.aviso('🗣️ Bedrock!');
  await d.espera(2.2);
  await d.di('c4_10');
  await d.di('c4_11');
  const r = await d.pregunta(
    [
      { texto: 'Topsoil', emoji: '🌱', color: '#3b2416' },
      { texto: 'Subsoil', emoji: '🟫', color: '#9c7650' },
      { texto: 'Bedrock', emoji: '🪨', color: '#5f6875' },
    ],
    0,
  );
  await retroalimentar(d, r, 0);
  d.retirar(d.ultimaPregunta).catch(() => {});
  await d.di('c4_12');
  const subir = d.di('c4_13');
  await bajar(0, 6, 2.6);
  await subir;
  await d.espera(0.5);
}

// ── 5. Sandy soil (playa) ───────────────────────────────────────────────────

async function cap5(d) {
  const { wiggles } = d.extra;
  await d.escenario('playa');
  wigglesEnHoja(d);
  d.musica.iniciar('alegre');
  await d.titulo(4);
  await d.di('c5_1');
  const granos = arte.granosArena();
  granos.grupo.position.set(-0.15, d.H - 0.05, -1.3);
  d.plato.add(granos.grupo);
  mirarAlUsuario(d, granos.grupo);
  granos.granos.forEach((g) => {
    g.userData.tamOriginal = g.scale.x;
    g.scale.setScalar(0.001);
  });
  d.cada((dt, t) => granos.granos.forEach((g) => {
    g.rotation.x += dt * 0.3;
    g.rotation.y += dt * 0.4;
    g.position.y = g.userData.base.y + Math.sin(t * 1.3 + g.userData.fase) * 0.02;
  }));
  const etiqueta = palabra('GRAINS', '#d9a35e', 0.36);
  etiqueta.position.set(-0.15, d.H - 0.36, -1.3);
  etiqueta.scale.setScalar(0.001);
  d.plato.add(etiqueta);
  mirarAlUsuario(d, etiqueta);
  await d.diCon('c5_2', [
    [0.35, () => granos.granos.forEach((g, i) => d.escalar(g, g.userData.tamOriginal, 0.5, suavizado.rebote, i * 0.05))],
    [0.45, () => (etiqueta.userData.escalaFinal = 1, d.aparecer(etiqueta, 0.5))],
  ]);
  await d.di('c5_3');
  d.aviso('🗣️ Rough!');
  await d.espera(2.2);
  await d.di('c5_10');
  // Experimento: el agua pasa muy rápido por la arena
  d.animar({ duracion: 1, alActualizar: (k) => (granos.grupo.position.x = -0.15 - k * 0.55) });
  d.poner(arte.mesa(0.5, 0.4, 0.55, '#c49a72'), 0.25, 0, -1.0);
  const maceta = arte.macetaExperimento('arena');
  d.poner(maceta.grupo, 0.25, 0.55, -1.0);
  mirarAlUsuario(d, maceta.grupo);
  d.aparecer(maceta.grupo, 0.6);
  d.cada((dt) => maceta.paso(dt));
  wiggles.mirar(maceta.grupo.getWorldPosition(V(0, 0, 0)));
  await d.di('c5_4');
  maceta.verter(2);
  d.m.audio.rafaga({ duracion: 2.2, filtro: 'bandpass', frecuencia: 1800, volumen: 0.06 });
  await d.espera(2.8);
  await d.di('c5_5');
  wiggles.mirar(null);
  await d.di('c5_6');
  // Cactus y palmera (están en la playa, a la derecha y atrás)
  const etiquetas = [
    ['Cactus', V(2.75, 1.9, 0.9)],
    ['Coconut palm', V(2.8, 4.75, -2.5)],
  ].map(([texto, pos]) => {
    const p = palabra(texto, '#2e7d32', 0.5);
    p.position.copy(pos);
    p.scale.setScalar(0.001);
    d.plato.add(p);
    mirarAlUsuario(d, p);
    return p;
  });
  await d.diCon('c5_7', etiquetas.map((p, i) => [0.3 + i * 0.2, () => (p.userData.escalaFinal = i ? 2 : 1.2, d.aparecer(p, 0.5))]));
  await d.di('c5_8');
  await d.tocar(granos.granos.slice(0, 8), {
    tiempo: 10,
    brillo: 0.22,
    alTocar: (g) => {
      chispas(d, g, '#fff2a8', 40);
      d.escalar(g, g.userData.tamOriginal * 1.6, 0.25).then(() => d.escalar(g, g.userData.tamOriginal, 0.4), () => {});
      if (Math.random() < 0.4) d.decir('wow');
    },
  });
  await d.di('c5_9');
  await d.di('c5_11');
  d.aviso('🗣️ Sandy soil!');
  await d.espera(2.5);
}

// ── 6. Clay soil (río) ──────────────────────────────────────────────────────

async function cap6(d) {
  const { wiggles } = d.extra;
  await d.escenario('rio');
  wigglesEnHoja(d);
  await d.titulo(5);
  await d.di('c6_1');
  // Comparación: un grano de arena junto a muchas partículas diminutas de arcilla
  const comparacion = new THREE.Group();
  const grano = malla(new THREE.IcosahedronGeometry(0.08, 0), mat('#e5b45f'), [-0.3, 0, 0]);
  const arcilla = arte.particulasArcilla();
  arcilla.position.set(0.1, -0.04, 0);
  comparacion.add(grano, arcilla);
  const e1 = palabra('sand', '#d9a35e', 0.22);
  e1.position.set(-0.3, -0.16, 0);
  const e2 = palabra('clay', '#b8653f', 0.22);
  e2.position.set(0.05, -0.16, 0);
  comparacion.add(e1, e2);
  comparacion.scale.setScalar(0.001);
  d.poner(comparacion, -0.05, d.H - 0.08, -1.1);
  mirarAlUsuario(d, comparacion);
  d.cada((dt) => (grano.rotation.y += dt));
  await d.diCon('c6_2', [[0.2, () => (comparacion.userData.escalaFinal = 1.3, d.aparecer(comparacion, 0.6))]]);
  await d.di('c6_3');
  d.aviso('🗣️ Sticky!');
  await d.espera(2);
  // Experimento: la arcilla casi no deja pasar el agua
  await d.retirar(comparacion);
  d.poner(arte.mesa(0.5, 0.4, 0.55, '#a1887f'), 0.2, 0, -1.0);
  const maceta = arte.macetaExperimento('arcilla');
  d.poner(maceta.grupo, 0.2, 0.55, -1.0);
  mirarAlUsuario(d, maceta.grupo);
  d.aparecer(maceta.grupo, 0.6);
  d.cada((dt) => maceta.paso(dt));
  wiggles.mirar(maceta.grupo.getWorldPosition(V(0, 0, 0)));
  await d.di('c6_4');
  maceta.verter(2);
  d.m.audio.rafaga({ duracion: 2.2, filtro: 'bandpass', frecuencia: 1800, volumen: 0.06 });
  await d.espera(3);
  d.m.audio.gota();
  await d.di('c6_5');
  wiggles.mirar(null);
  await d.di('c6_6');
  await d.di('c6_12');
  // Cosas hechas de arcilla
  const cosas = [arte.ollaBarro(1.2), arte.ollaBarro(0.8, '#a3532f')];
  const ladrillos = new THREE.Group();
  for (let i = 0; i < 3; i++) ladrillos.add(malla(new THREE.BoxGeometry(0.2, 0.07, 0.1), mat(i % 2 ? '#c0714a' : '#b5653d'), [0, 0.035 + i * 0.072, 0], [0, i * 0.3, 0]));
  cosas.push(fusionar(ladrillos));
  cosas.forEach((c, i) => {
    c.scale.setScalar(0.001);
    d.poner(c, -0.75 + i * 0.28, 0.55 + (i === 2 ? 0 : 0), -1.2 + i * 0.05);
  });
  d.poner(arte.mesa(0.9, 0.4, 0.55, '#a1887f'), -0.5, 0, -1.2);
  await d.diCon('c6_7', cosas.map((c, i) => [0.25 + i * 0.2, () => (c.userData.escalaFinal = 1, d.aparecer(c, 0.5), d.m.audio.pop(c.getWorldPosition(V(0, 0, 0))))]));
  // ¡Hagamos una olla! (tres toques)
  const masa = arte.arcillaModelable();
  masa.grupo.userData.tamBrillo = 0.6;
  d.poner(masa.grupo, -0.1, d.H - 0.45, -0.85);
  mirarAlUsuario(d, masa.grupo);
  d.aparecer(masa.grupo, 0.5);
  await d.di('c6_8');
  for (let paso = 1; paso <= 2; paso++) {
    await d.tocar([masa.grupo], { tiempo: 6, brillo: 0.3 });
    masa.formas.forEach((f, i) => (f.visible = i === paso));
    chispas(d, masa.grupo, '#e0a07a', 36);
    d.m.audio.tono(300 + paso * 150, 0.25, { tipo: 'triangle', volumen: 0.1 });
    d.escalar(masa.grupo, 1.25, 0.2).then(() => d.escalar(masa.grupo, 1, 0.3), () => {});
  }
  d.cada((dt) => (masa.grupo.rotation.y += dt * 1.5));
  d.m.fx.confeti(masa.grupo.getWorldPosition(V(0, 0.2, 0)), 50);
  await d.di('c6_9');
  await d.di('c6_10');
  await d.di('c6_11');
  d.aviso('🗣️ Clay soil!');
  await d.espera(2.5);
}

// ── 7. Loamy soil (granja andina) ───────────────────────────────────────────

async function cap7(d) {
  const { wiggles } = d.extra;
  await d.escenario('granja');
  wigglesEnHoja(d);
  d.musica.iniciar('naturaleza');
  await d.titulo(6);
  // Agricultor que saluda
  const agricultor = prefabsMercado.vendedor({ camisa: '#2f8be6', delantal: '#c49a72', gorro: 'sombrero', piel: '#b9794f' });
  d.poner(agricultor, -1.8, 0, -2.6);
  mirarAlUsuario(d, agricultor);
  d.cada((_dt, t) => agricultor.userData.animar(t));
  await d.di('c7_1');
  // La receta del loam: cuatro ingredientes que se mezclan
  const ingredientes = [
    ['arena', 'sand', '#d9a35e'],
    ['arcilla', 'clay', '#b8653f'],
    ['limo', 'silt', '#a88a6a'],
    ['humus', 'humus', '#3b2416'],
  ].map(([tipo, texto, color], i) => {
    const g = new THREE.Group();
    g.add(malla(new THREE.SphereGeometry(0.08, 18, 12), mat(arte.COLOR_SUELO[tipo])));
    const p = palabra(texto, color, 0.22);
    p.position.y = 0.13;
    g.add(p);
    g.scale.setScalar(0.001);
    d.poner(g, -0.45 + i * 0.3, d.H - 0.05, -1.15);
    mirarAlUsuario(d, g);
    return g;
  });
  d.poner(arte.mesa(0.6, 0.45, 0.6, '#c49a72'), 0, 0, -1.1);
  const tazon = malla(new THREE.SphereGeometry(0.16, 22, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#e8dcc0', { lados: THREE.DoubleSide }), [0, 0.76, -1.1]);
  d.plato.add(tazon);
  const loam = arte.montoncito('franco', 0.15);
  loam.scale.setScalar(0.001);
  d.poner(loam, 0, 0.71, -1.1);
  await d.diCon('c7_2', [
    ...ingredientes.map((g, i) => [0.2 + i * 0.15, () => (g.userData.escalaFinal = 1, d.aparecer(g, 0.5), d.m.audio.pop(g.getWorldPosition(V(0, 0, 0))))]),
    [0.9, () => ingredientes.forEach((g, i) => {
      d.mover(g, V(0, 0.8, -1.1), 0.8, suavizado.entradaSalida, i * 0.1);
      d.escalar(g, 0.001, 0.8, suavizado.entradaSalida, i * 0.1 + 0.3);
    })],
  ]);
  loam.userData.escalaFinal = 1;
  d.aparecer(loam, 0.8);
  chispas(d, loam, '#c49a72', 40);
  d.m.audio.tono(400, 0.4, { hasta: 800, volumen: 0.1 });
  await d.di('c7_3');
  d.aviso('🗣️ Soft!');
  await d.espera(2);
  await d.di('c7_4');
  await d.di('c7_5');
  // Verduras que aparecen en la mesa
  const verduras = ['zanahoria', 'manzana', 'banano'].map((n, i) => {
    const m = crearModelo(n, { tamano: 0.16 });
    m.scale.setScalar(0.001);
    d.poner(m, -0.22 + i * 0.22, 0.86, -0.95);
    return m;
  });
  const choclo = arte.plantita('maiz');
  choclo.userData.crecer(1);
  choclo.scale.setScalar(0.001);
  d.poner(choclo, 0.42, 0.6, -1.15);
  await d.diCon('c7_6', [...verduras, choclo].map((m, i) => [0.1 + i * 0.15, () => (m.userData.escalaFinal = i === 3 ? 1.6 : 1, d.aparecer(m, 0.5))]));
  wiggles.mirar(d.raiz.localToWorld(V(4, 12, -34)));
  await d.di('c7_10');
  wiggles.mirar(null);
  await d.di('c7_11');
  // ¡A sembrar! Cinco hoyos en el surco delante del estudiante
  const tipos = ['lechuga', 'maiz', 'flor', 'lechuga', 'maiz'];
  const hoyos = tipos.map((tipo, i) => {
    const g = new THREE.Group();
    g.add(malla(new THREE.CircleGeometry(0.06, 16), mat('#1d1209', { tipo: 'basica' }), [0, 0.006, 0], [-Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.TorusGeometry(0.07, 0.02, 6, 16), mat('#5a3b22'), [0, 0.01, 0], [Math.PI / 2, 0, 0]));
    const planta = arte.plantita(tipo);
    planta.scale.setScalar(1.8);
    g.add(planta);
    g.userData.planta = planta;
    g.userData.tamBrillo = 0.35;
    const a = THREE.MathUtils.degToRad(-40 + i * 20);
    g.position.set(Math.sin(a) * 0.95, 0, -Math.cos(a) * 0.95);
    d.plato.add(g);
    return g;
  });
  const sembrar = (g) => {
    if (g.userData.sembrado) return;
    g.userData.sembrado = true;
    const semilla = malla(new THREE.SphereGeometry(0.018, 8, 6), mat('#8d6e4a'), [0, 0.5, 0]);
    g.add(semilla);
    d.mover(semilla, V(0, 0.01, 0), 0.6, (k) => k * k).then(() => {
      semilla.visible = false;
      d.m.audio.pop(g.getWorldPosition(V(0, 0, 0)));
      return d.animar({ duracion: 3, curva: suavizado.salida, alActualizar: (k) => g.userData.planta.userData.crecer(k) });
    }, () => {});
  };
  wiggles.mirar(d.raiz.localToWorld(V(0, 0, -0.9)));
  await d.di('c7_7');
  await d.tocar(hoyos, { tiempo: 14, brillo: 0.35, alTocar: (g) => sembrar(g) });
  hoyos.forEach(sembrar);
  await d.espera(2.5);
  wiggles.mirar(null);
  d.m.fx.confeti(d.raiz.localToWorld(V(0, 0.4, -0.9)), 60);
  await d.di('c7_8');
  await d.di('c7_9');
  await d.di('c7_12');
  d.aviso('🗣️ Loamy soil!');
  await d.espera(2.5);
}

// ── 8. The water test (aula) ────────────────────────────────────────────────

async function cap8(d) {
  const { wiggles } = d.extra;
  await d.titulo(7);
  const linea = d.di('c8_1');
  await d.espera(0.8);
  await d.escenario('aula');
  wigglesEnHoja(d, { x: 0.75 });
  d.musica.iniciar('alegre');
  await linea;
  d.poner(arte.mesa(1.2, 0.5, 0.55), 0, 0, -1.05);
  const macetas = ['arena', 'arcilla', 'franco'].map((tipo, i) => {
    const m = arte.macetaExperimento(tipo);
    d.poner(m.grupo, -0.4 + i * 0.4, 0.55, -1.05);
    mirarAlUsuario(d, m.grupo);
    d.aparecer(m.grupo, 0.6, i * 0.15);
    d.cada((dt) => m.paso(dt));
    return m;
  });
  await d.di('c8_2');
  await d.di('c8_3');
  await d.di('c8_4');
  const r = await d.pregunta(
    [
      { texto: 'Sand', emoji: '🏖️', color: '#d9a35e' },
      { texto: 'Clay', emoji: '🏺', color: '#b8653f' },
      { texto: 'Loam', emoji: '🌱', color: '#5a3b22' },
    ],
    0,
    { tiempo: 14 },
  );
  await retroalimentar(d, r, 0);
  await d.retirar(d.ultimaPregunta);
  await d.di('c8_5');
  for (const m of macetas) m.verter(2);
  d.m.audio.rafaga({ duracion: 2.4, filtro: 'bandpass', frecuencia: 1800, volumen: 0.07 });
  await d.espera(4.5);
  const senalar = async (m, linea) => {
    wiggles.mirar(m.grupo.getWorldPosition(V(0, 0, 0)));
    d.escalar(m.etiqueta, 1.5, 0.3).then(() => d.escalar(m.etiqueta, 1, 0.4), () => {});
    chispas(d, m.etiqueta, '#ffe27a', 30);
    await d.di(linea);
  };
  await senalar(macetas[0], 'c8_6');
  await senalar(macetas[2], 'c8_7');
  await senalar(macetas[1], 'c8_8');
  wiggles.mirar(null);
  await d.di('c8_9');
}

// ── 9. Soil helpers (aula) ──────────────────────────────────────────────────

async function cap9(d) {
  const { wiggles } = d.extra;
  await d.escenario('aula');
  wigglesEnHoja(d, { x: 0.75 });
  await d.titulo(8);
  d.poner(arte.mesa(1.1, 0.4, 0.55), 0, 0, -1.1);
  const terrario = arte.terrario();
  d.poner(terrario.grupo, 0, 0.55, -1.1);
  mirarAlUsuario(d, terrario.grupo);
  d.aparecer(terrario.grupo, 0.7);
  d.cada((_dt, t) => terrario.animar(t));
  wiggles.mirar(terrario.grupo.getWorldPosition(V(0, 0.3, 0)));
  await d.di('c9_1');
  await d.di('c9_2');
  await d.di('c9_3');
  await d.di('c9_4');
  wiggles.mirar(null);
  wiggles.saludar();
  await d.di('c9_11');
  await d.di('c9_12');
  await d.di('c9_5');
  // 1. Recoger la basura del piso
  const bote = crearModelo('basurero', { tamano: 0.5 });
  d.poner(bote, -0.9, 0.25, -0.75);
  d.aparecer(bote, 0.5);
  const basuras = ['botella', 'lata', 'papel', 'bolsa'].map((tipo, i) => {
    const b = arte.basura(tipo);
    b.scale.setScalar(1.6);
    b.userData.tamBrillo = 0.45;
    b.userData.centroBrillo = V(0, 0.04, 0);
    const a = THREE.MathUtils.degToRad(-55 + i * 37);
    d.poner(b, Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0 + 0.1);
    return b;
  });
  await d.di('c9_6');
  const tirar = (b) => {
    if (b.userData.tirada) return;
    b.userData.tirada = true;
    const inicio = b.position.clone();
    const fin = V(-0.9, 0.55, -0.75);
    d.animar({
      duracion: 0.8,
      alActualizar: (k) => {
        b.position.lerpVectors(inicio, fin, k);
        b.position.y += Math.sin(k * Math.PI) * 0.5;
        b.scale.setScalar(Math.max(0.001, 1.6 * (1 - k * 0.7)));
      },
    }).then(() => {
      b.visible = false;
      d.m.audio.clac(bote.getWorldPosition(V(0, 0, 0)));
      chispas(d, bote, '#7dff9a', 20);
    }, () => {});
  };
  await d.tocar(basuras, { tiempo: 15, alTocar: (b) => tirar(b) });
  basuras.forEach(tirar);
  await d.espera(1);
  d.m.audio.exito();
  await d.di('c9_7');
  // 2. Plantar árboles: las raíces sujetan el suelo
  await d.retirar(terrario.grupo);
  const arbol = arte.arbolConRaices();
  arbol.scale.setScalar(1.3);
  d.poner(arbol, 0.1, 0.55, -1.1);
  mirarAlUsuario(d, arbol);
  d.animar({ duracion: 4, curva: suavizado.salida, alActualizar: (k) => arbol.userData.crecer(k) });
  await d.di('c9_8');
  // 3. Compost
  const compost = arte.compostera();
  d.poner(compost, 0.55, 0, -0.55);
  mirarAlUsuario(d, compost);
  d.aparecer(compost, 0.5);
  const cascaras = ['banano', 'manzana', 'hoja', 'banano', 'hoja'].map((t, i) => {
    const c = arte.cascara(t);
    c.scale.setScalar(1.5);
    d.poner(c, 0.55 + (i - 2) * 0.05, 1.2 + i * 0.15, -0.55);
    return c;
  });
  const dur = await d.duracion('c9_9');
  d.cada((dt, t) => cascaras.forEach((c, i) => {
    if (c.position.y > 0.12) {
      c.position.y -= dt * 0.35;
      c.rotation.z += dt * 2;
    } else if (c.visible) {
      c.visible = false;
      d.m.audio.pop();
    }
  }));
  d.animar({ duracion: dur, retardo: 1, alActualizar: (k) => compost.userData.humus(k) });
  await d.di('c9_9');
  await d.di('c9_10');
}

// ── 10. Soil quiz and song (aula) ───────────────────────────────────────────

async function cap10(d) {
  const { wiggles, guia } = d.extra;
  await d.escenario('aula');
  wigglesEnHoja(d, { x: 0.75 });
  d.musica.iniciar('alegre');
  await d.titulo(9);
  // Repaso con un panel que cambia en cada frase
  const repaso = { texto: '' };
  const panel = new PanelLienzo(1.0, 0.3, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255, 253, 247, 0.96)';
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 44);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffc23c';
    ctx.stroke();
    escribir(ctx, repaso.texto, w / 2, h / 2, { tam: 70, peso: 900, alinear: 'center', base: 'middle', maxAncho: w - 60, maxAlto: h - 40 });
  });
  d.escena.anteMirada(panel, { distancia: 1.4, dy: -0.1 });
  d.plato.add(panel);
  const mostrar = (t) => {
    repaso.texto = t;
    panel.redibujar();
    d.m.fx.latido(panel, 0.08);
    d.m.audio.pop();
  };
  mostrar('📚 Review time!');
  d.aparecer(panel, 0.5);
  await d.di('c10_19');
  mostrar('🪨 + 🍂 + 💧 + 💨 + 🐛');
  await d.di('c10_20');
  mostrar('Topsoil · Subsoil · Bedrock');
  await d.di('c10_21');
  mostrar('🏖️ Sand · 🏺 Clay · 🌱 Loam');
  await d.di('c10_22');
  await d.retirar(panel);
  await d.di('c10_1');
  const suelos = [
    { texto: 'Sand', emoji: '🏖️', color: '#d9a35e' },
    { texto: 'Clay', emoji: '🏺', color: '#b8653f' },
    { texto: 'Loam', emoji: '🌱', color: '#5a3b22' },
  ];
  const preguntas = [
    ['c10_2', 'c10_3', 0, suelos],
    ['c10_4', 'c10_5', 1, suelos],
    ['c10_6', 'c10_7', 2, suelos],
    ['c10_8', 'c10_9', 2, [
      { texto: 'Humus', emoji: '🍂', color: '#3b2416' },
      { texto: 'Air', emoji: '💨', color: '#7fb3d6' },
      { texto: 'Plastic', emoji: '🥤', color: '#e5484d' },
    ]],
  ];
  let aciertos = 0;
  for (const [preg, resp, correcta, opciones] of preguntas) {
    await d.di(preg);
    const r = await d.pregunta(opciones, correcta, { tiempo: 14 });
    if (r === correcta) aciertos++;
    await retroalimentar(d, r, correcta);
    await d.di(resp);
    await d.retirar(d.ultimaPregunta);
  }
  // Marcador de estrellas del quiz
  const estrellas = new PanelLienzo(0.7, 0.2, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(20, 30, 60, 0.9)';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 40);
    ctx.fill();
    escribir(ctx, '⭐'.repeat(aciertos) + '☆'.repeat(4 - aciertos), w / 2, h / 2, { tam: 100, alinear: 'center', base: 'middle' });
  });
  d.escena.anteMirada(estrellas, { distancia: 1.5, dy: 0.25 });
  d.plato.add(estrellas);
  d.aparecer(estrellas, 0.6);
  d.m.audio.exito();
  await d.espera(2.5);
  await d.retirar(estrellas);
  // ¡La canción del suelo! (dos veces)
  d.musica.iniciar('cancion');
  // Los tres suelos bailan al ritmo; el que se canta brilla y crece.
  const bailarines = [
    ['arena', 'SAND', '#d9a35e', -0.55],
    ['arcilla', 'CLAY', '#b8653f', 0],
    ['franco', 'LOAM', '#5a3b22', 0.55],
  ].map(([tipo, texto, color, x], i) => {
    const g = new THREE.Group();
    const m = arte.montoncito(tipo, 0.13);
    const p = palabra(texto, color, 0.3);
    p.position.y = 0.22;
    g.add(m, p);
    d.poner(g, x, 0, -1.0 - Math.abs(x) * 0.25);
    mirarAlUsuario(d, g);
    d.aparecer(g, 0.5, i * 0.15);
    return g;
  });
  let cantando = -1;
  const pulso = 60 / 104;
  d.cada((_dt, t) => {
    const golpe = Math.max(0, Math.cos(((t % pulso) / pulso) * Math.PI * 2));
    bailarines.forEach((g, i) => {
      const activo = cantando === i || cantando === 3;
      g.position.y = golpe * (activo ? 0.06 : 0.025);
      g.scale.setScalar((activo ? 1.25 : 1) * (1 + golpe * 0.05));
      g.rotation.z = Math.sin(t * 3 + i) * 0.08;
    });
  });
  await d.di('c10_10');
  const versos = ['c10_11', 'c10_12', 'c10_13', 'c10_14'];
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (const [i, v] of versos.entries()) {
      wiggles.saludar();
      cantando = i;
      if (i < 3) chispas(d, bailarines[i], '#ffe27a', 30);
      await d.di(v, { pausa: 0.2 });
      d.aviso('🎤 Your turn!');
      await d.espera(3.6);
    }
  }
  cantando = 3;
  d.musica.iniciar('alegre');
  d.m.fx.confeti(d.raiz.localToWorld(V(0, d.H + 0.3, -1.2)), 120);
  d.m.audio.exito();
  await d.di('c10_15');
  await d.di('c10_16');
  // Wiggles se despide y vuelve a su casa bajo el piso
  const agujero = arte.crearAgujero(0.42, { tapa: !d.enAR });
  agujero.scale.setScalar(0.001);
  d.poner(agujero, 0, 0.004, -1.3);
  d.escalar(agujero, 1, 1.5, suavizado.salida);
  const despedida = d.di('c10_17');
  guia.userData.baseY = undefined;
  await d.mover(guia, V(0, 0.15, -1.3), 1.5);
  wigglesEn(d, V(0, 0.02, -1.3));
  guia.visible = false;
  wiggles.saludar();
  await despedida;
  wiggles.saludar();
  await d.di('c10_23');
  d.aviso('👋 Bye-bye!');
  wiggles.saludar();
  await d.espera(3);
  d.m.audio.tono(900, 0.5, { hasta: 200, volumen: 0.1 });
  await d.mover(wiggles.grupo, V(0, -0.7, -1.3), 1.0, (k) => k * k);
  await d.escalar(agujero, 0.001, 1.2, suavizado.entradaSalida);
  await d.di('c10_18');
  await d.espera(1);
}

// ── Guion completo ──────────────────────────────────────────────────────────

export const peliculaTiposDeSuelo = {
  lineas: Object.fromEntries(Object.entries(LINEAS).map(([id, [quien, texto]]) => [id, [quien, texto]])),
  carpeta: CARPETA_AUDIO,
  capitulos: CAPITULOS.map((c, i) => ({ ...c, correr: [cap1, cap2, cap3, cap4, cap5, cap6, cap7, cap8, cap9, cap10][i] })),
  escenarios: {
    aula: (d) => arte.escenarioAula(d),
    montana: () => arte.escenarioMontana(),
    vacio: () => arte.escenarioVacio(),
    playa: () => arte.escenarioPlaya(),
    rio: () => arte.escenarioRio(),
    granja: () => arte.escenarioGranja(),
  },
  /** Personaje y hoja voladora que acompañan toda la película. */
  preparar(d) {
    const wiggles = arte.crearWiggles();
    const guia = new THREE.Group();
    const hoja = arte.crearHoja();
    guia.add(hoja);
    d.raiz.add(guia, wiggles.grupo);
    guia.visible = false;
    d.extra = { wiggles, guia, hoja };
    d.personajes.w = { objeto: wiggles.cabeza, hablar: (n) => wiggles.hablar(n) };
    // Por defecto Wiggles mira al estudiante; wiggles.mirar(p) le da otro objetivo.
    const mirarA = wiggles.mirar;
    let objetivo = null;
    wiggles.mirar = (p) => (objetivo = p ? p.clone() : null);
    const cabeza = V(0, 0, 0);
    d.escena.cadaCuadro((dt, t) => {
      if (d.pausado) return;
      mirarA(objetivo ?? d.m.app.camara.getWorldPosition(cabeza));
      wiggles.animar(dt, t);
      if (guia.visible && guia.userData.baseY !== undefined) {
        guia.position.y = guia.userData.baseY + Math.sin(t * 1.4) * 0.025;
        guia.rotation.z = Math.sin(t * 1.1) * 0.03;
      }
    });
  },
};
