import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar, ponerCara, liberar } from '../materiales.js';

// Personas articuladas: brazos, piernas y cabeza se mueven por separado, así las
// escenas pueden hacerlas caminar, estirarse, sentarse o hablar. Cada parte se
// fusiona por su cuenta (pocas "draw calls") y no se vuelve a fusionar después.

const pivote = (x, y, z = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
};

/** Fusiona una parte y la protege para que nadie la vuelva a fusionar con el resto. */
function parte(grupo) {
  fusionar(grupo);
  grupo.userData.noFusionar = true;
  return grupo;
}

/**
 * Persona de tamaño real. opciones:
 *  edad: 'nino' (≈1,15 m) | 'adulto' (≈1,62 m) · estatura (m)
 *  peinado: 'colitas' | 'corto' | 'cola' | 'mono' | 'largo'
 *  piel, cabello, superior (suéter, blusa o camiseta), inferior (falda o pantalón), falda (bool),
 *  zapatos, medias, cuello (color del cuello de camisa o null), delantal (color o null),
 *  mochila (color o null), lentes (bool), gorra (color o null), expresion,
 *  detalle: 'alto' (articulada) | 'bajo' (brazos y piernas fijos: para personajes lejanos)
 * API (userData): articulaciones { torso, cabeza, brazoI, brazoD, piernaI, piernaD },
 *  setExpresion(e), hablar(segundos), fuenteHabla (función 0..1 que mueve la boca),
 *  alturaOjos, alturaCadera.
 */
export function persona({
  edad = 'nino',
  estatura = null,
  peinado = 'colitas',
  piel = '#c98b5e',
  cabello = '#3b2416',
  superior = '#2f4a8a',
  inferior = '#4d5566',
  falda = true,
  zapatos = '#1d1d27',
  medias = '#ffffff',
  cuello = '#ffffff',
  delantal = null,
  mochila = null,
  lentes = false,
  gorra = null,
  expresion = 'neutral',
  detalle = 'alto',
} = {}) {
  const nino = edad !== 'adulto';
  // Medidas de la figura base (niño 1,15 m o adulto 1,62 m); después se escala a la estatura.
  const D = nino
    ? { alto: 1.15, cadera: 0.46, sepPierna: 0.07, rPierna: 0.042, largoPierna: 0.42, hombro: 0.83, sepHombro: 0.165, rBrazo: 0.038, largoBrazo: 0.31, rTorso: 0.135, largoTorso: 0.2, yTorso: 0.72, yCabeza: 1.0, rCabeza: 0.15, zapato: [0.09, 0.06, 0.15], rMano: 0.042 }
    : { alto: 1.62, cadera: 0.82, sepPierna: 0.1, rPierna: 0.058, largoPierna: 0.78, hombro: 1.3, sepHombro: 0.225, rBrazo: 0.05, largoBrazo: 0.5, rTorso: 0.17, largoTorso: 0.3, yTorso: 1.1, yCabeza: 1.5, rCabeza: 0.125, zapato: [0.11, 0.07, 0.22], rMano: 0.052 };
  const escala = (estatura ?? D.alto) / D.alto;
  const g = new THREE.Group();
  g.userData.noFusionar = true;
  const cuerpo = new THREE.Group();
  cuerpo.scale.setScalar(escala);
  g.add(cuerpo);
  const pielM = mat(piel);
  const supM = mat(superior);
  const infM = mat(inferior);

  // ── Torso: cadera, falda o pantalón, tronco, cuello, delantal y mochila ──
  const torso = new THREE.Group();
  if (falda) torso.add(malla(new THREE.CylinderGeometry(D.rTorso * 0.95, D.rTorso * 1.42, D.cadera * (nino ? 0.4 : 0.5), 20), infM, [0, D.cadera + (nino ? 0.04 : 0.0), 0]));
  else torso.add(malla(new RoundedBoxGeometry(D.rTorso * 1.95, D.cadera * 0.36, D.rTorso * 1.2, 2, 0.04), infM, [0, D.cadera + 0.03, 0]));
  torso.add(malla(new THREE.CapsuleGeometry(D.rTorso, D.largoTorso, 6, 16), supM, [0, D.yTorso, 0], [0, 0, 0], [1, 1, 0.75]));
  if (cuello) torso.add(malla(new THREE.ConeGeometry(D.rTorso * 0.45, D.rTorso * 0.45, 3), mat(cuello), [0, D.hombro + D.rTorso * 0.35, D.rTorso * 0.52], [Math.PI, 0, 0], [1.4, 1, 0.4]));
  torso.add(malla(new THREE.CylinderGeometry(D.rCabeza * 0.32, D.rCabeza * 0.36, D.rCabeza * 0.6, 12), pielM, [0, D.yCabeza - D.rCabeza * 0.95, 0]));
  if (delantal) {
    torso.add(malla(new RoundedBoxGeometry(D.rTorso * 1.7, D.yTorso * 0.62, 0.02, 2, 0.008), mat(delantal), [0, D.yTorso - D.yTorso * 0.17, D.rTorso * 0.78]));
    torso.add(malla(new THREE.BoxGeometry(D.rTorso * 1.1, D.rTorso * 0.45, 0.006), mat('#ffffff'), [0, D.cadera + 0.06, D.rTorso * 0.8 + 0.008]));
  }
  if (mochila) {
    torso.add(malla(new RoundedBoxGeometry(D.rTorso * 1.7, D.rTorso * 2.1, D.rTorso * 0.9, 3, 0.04), mat(mochila), [0, D.yTorso, -D.rTorso * 1.1]));
    torso.add(malla(new RoundedBoxGeometry(D.rTorso * 1.2, D.rTorso * 0.8, D.rTorso * 0.4, 2, 0.03), mat('#ffc23c'), [0, D.yTorso - D.rTorso * 0.4, -D.rTorso * 1.6]));
  }
  cuerpo.add(parte(torso));

  // ── Piernas (pivote en la cadera) ──
  const crearPierna = (lado) => {
    const p = pivote(lado * D.sepPierna, D.cadera);
    const largo = D.largoPierna;
    const colorPierna = falda ? pielM : infM;
    const [zx, zy, zz] = D.zapato;
    if (nino) {
      p.add(malla(new THREE.CapsuleGeometry(D.rPierna, largo * 0.55, 4, 10), colorPierna, [0, -largo * 0.42, 0]));
      p.add(malla(new THREE.CylinderGeometry(D.rPierna * 1.02, D.rPierna * 0.95, largo * 0.35, 12), mat(medias), [0, -largo * 0.8, 0]));
    } else {
      // Adultos: la pierna llega desde la cadera hasta el zapato.
      const tobillo = D.cadera - zy;
      p.add(malla(new THREE.CapsuleGeometry(D.rPierna, tobillo - D.rPierna * 2, 4, 10), colorPierna, [0, -tobillo / 2, 0]));
    }
    p.add(malla(new RoundedBoxGeometry(zx, zy, zz, 2, zy * 0.4), mat(zapatos), [0, -D.cadera + zy / 2, zz * 0.18]));
    return parte(p);
  };
  // ── Brazos (pivote en el hombro; cuelgan hacia abajo) ──
  const crearBrazo = (lado) => {
    const b = pivote(lado * D.sepHombro, D.hombro);
    b.add(malla(new THREE.CapsuleGeometry(D.rBrazo, D.largoBrazo * 0.72, 4, 10), supM, [0, -D.largoBrazo * 0.45, 0]));
    b.add(malla(new THREE.SphereGeometry(D.rMano, 12, 10), pielM, [0, -D.largoBrazo - D.rMano * 0.4, 0.005]));
    b.rotation.z = lado * 0.12;
    return parte(b);
  };
  const piernaI = crearPierna(-1);
  const piernaD = crearPierna(1);
  const brazoI = crearBrazo(-1);
  const brazoD = crearBrazo(1);
  cuerpo.add(piernaI, piernaD, brazoI, brazoD);

  // ── Cabeza ──
  const cabeza = pivote(0, D.yCabeza);
  const r = D.rCabeza;
  const craneo = new THREE.Group();
  const pelo = mat(cabello);
  // La cabeza de los adultos es más alargada: el cabello se estira igual para cubrirla.
  const alargar = nino ? 1 : 1.1;
  craneo.add(malla(new THREE.SphereGeometry(r, 28, 20), pielM, [0, 0, 0], [0, 0, 0], [1, alargar, 1]));
  craneo.add(malla(new THREE.SphereGeometry(r * 1.06, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), pelo, [0, 0.005, -0.01], [-0.45, 0, 0], [1, alargar, 1]));
  craneo.add(malla(new THREE.SphereGeometry(r * 1.02, 24, 16), pelo, [0, 0.01, -0.035], [0, 0, 0], [1, alargar, 0.9]));
  for (const lado of [-1, 1]) craneo.add(malla(new THREE.SphereGeometry(r * 0.2, 10, 8), pielM, [lado * r * 0.98, -0.01, 0], [0, 0, 0], [0.6, 1, 1]));
  if (peinado === 'colitas') {
    for (const lado of [-1, 1]) {
      craneo.add(malla(new THREE.SphereGeometry(r * 0.37, 14, 10), pelo, [lado * r * 1.13, 0, -r * 0.33], [0, 0, 0], [0.8, 1.3, 0.8]));
      craneo.add(malla(new THREE.SphereGeometry(r * 0.15, 10, 8), mat('#e5484d'), [lado * r * 0.97, r * 0.4, -r * 0.27]));
    }
  } else if (peinado === 'cola') {
    craneo.add(malla(new THREE.CapsuleGeometry(r * 0.24, r * 1.1, 4, 10), pelo, [0, -r * 0.35, -r * 1.05], [0.35, 0, 0]));
    craneo.add(malla(new THREE.SphereGeometry(r * 0.15, 10, 8), mat('#ff5aa5'), [0, r * 0.25, -r * 0.98]));
  } else if (peinado === 'mono') {
    craneo.add(malla(new THREE.SphereGeometry(r * 0.42, 16, 12), pelo, [0, r * 0.55, -r * 0.75]));
  } else if (peinado === 'largo') {
    craneo.add(malla(new RoundedBoxGeometry(r * 1.9, r * 2.1, r * 0.5, 3, r * 0.2), pelo, [0, -r * 0.65, -r * 0.62]));
  }
  if (gorra) {
    craneo.add(malla(new THREE.SphereGeometry(r * 1.1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(gorra), [0, r * 0.18, 0]));
    craneo.add(malla(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.01, 20, 1, false, -Math.PI / 2, Math.PI), mat(gorra), [0, r * 0.45, r * 0.45], [0.15, 0, 0]));
  }
  if (lentes) {
    const negro = mat('#1d1d27');
    for (const lado of [-1, 1]) craneo.add(malla(new THREE.TorusGeometry(r * 0.2, r * 0.03, 6, 18), negro, [lado * r * 0.36, r * 0.17, r * 0.95]));
    craneo.add(malla(new THREE.BoxGeometry(r * 0.3, r * 0.04, r * 0.04), negro, [0, r * 0.2, r * 0.98]));
  }
  cabeza.add(parte(craneo));
  const cara = new THREE.Group();
  cara.userData.noFusionar = true;
  cabeza.add(cara);
  const cachetes = new THREE.Group();
  for (const lado of [-1, 1]) cachetes.add(malla(new THREE.CircleGeometry(r * 0.15, 16), mat('#ff8fa3', { tipo: 'basica', opacidad: 0.55 }), [lado * r * 0.57, -r * 0.23, r * 0.95], [0, lado * 0.45, 0]));
  cabeza.add(parte(cachetes));
  // Boca que se abre al hablar (se dibuja encima de la expresión).
  const bocaHabla = malla(new THREE.CircleGeometry(r * 0.13, 16), mat('#6b1d2a', { tipo: 'basica' }), [0, -r * 0.26, r * 0.985]);
  bocaHabla.visible = false;
  cabeza.add(bocaHabla);
  cuerpo.add(cabeza);

  if (detalle === 'bajo') {
    // Personajes lejanos: todo el cuerpo en una sola malla (sin articulaciones).
    for (const p of [piernaI, piernaD, brazoI, brazoD, torso]) p.userData.noFusionar = false;
    const fijo = new THREE.Group();
    for (const p of [torso, piernaI, piernaD, brazoI, brazoD]) fijo.add(p);
    cuerpo.add(parte(fijo));
  }

  const setExpresion = (e) => {
    for (const hijo of [...cara.children]) {
      cara.remove(hijo);
      liberar(hijo);
    }
    ponerCara(cara, { r, caracter: e, z: r, escalaBoca: nino ? 1.45 : 1.3 });
    fusionar(cara);
    g.userData.expresion = e;
  };
  setExpresion(expresion);

  const articulaciones = detalle === 'bajo' ? { cuerpo, cabeza } : { cuerpo, torso, cabeza, brazoI, brazoD, piernaI, piernaD };
  cabeza.userData.base = new THREE.Euler();
  let hablaHasta = 0;
  let tActual = 0;
  const fase = Math.random() * 6;
  Object.assign(g.userData, {
    articulaciones,
    setExpresion,
    hablar: (segundos = 2) => (hablaHasta = tActual + segundos),
    fuenteHabla: null,
    alturaOjos: (D.yCabeza + r * 0.18) * escala,
    alturaCadera: D.cadera * escala,
    escalaCuerpo: escala,
    anclaje: 'pies',
  });
  g.userData.animar = (t) => {
    tActual = t;
    const nivel = g.userData.fuenteHabla ? g.userData.fuenteHabla() : t < hablaHasta ? Math.abs(Math.sin(t * 11)) * 0.8 : 0;
    const habla = nivel > 0.04;
    bocaHabla.visible = habla;
    if (habla) bocaHabla.scale.set(1, 0.25 + nivel * 1.1, 1);
    const base = cabeza.userData.base;
    torso.scale.y = 1 + Math.sin(t * 2.1 + fase) * 0.006;
    cabeza.rotation.set(
      base.x + (habla ? Math.sin(t * 7) * 0.035 : Math.sin(t * 0.5 + fase) * 0.025),
      base.y + Math.sin(t * 0.3 + fase) * 0.05,
      base.z + Math.sin(t * 0.7 + fase) * 0.04 + (habla ? Math.sin(t * 4.3) * 0.03 : 0),
    );
  };
  return g;
}

// ── Ayudas para animar personas ────────────────────────────────────────────

/**
 * Acerca suavemente las articulaciones a una pose. pose: { brazoI, brazoD, piernaI,
 * piernaD, cabeza: [x, y, z] (radianes), torso: [x, y, z], cuerpoY: metros }.
 * Lo que no aparece en la pose vuelve al reposo. k: 0..1 (cuánto se acerca este cuadro).
 */
export function posar(p, pose = {}, k = 0.15) {
  const a = p.userData.articulaciones;
  const reposo = { brazoI: [0, 0, -0.12], brazoD: [0, 0, 0.12], piernaI: [0, 0, 0], piernaD: [0, 0, 0], torso: [0, 0, 0] };
  for (const nombre of ['brazoI', 'brazoD', 'piernaI', 'piernaD', 'torso']) {
    const art = a[nombre];
    if (!art) continue;
    const [x, y, z] = pose[nombre] ?? reposo[nombre];
    art.rotation.x += (x - art.rotation.x) * k;
    art.rotation.y += (y - art.rotation.y) * k;
    art.rotation.z += (z - art.rotation.z) * k;
  }
  const base = a.cabeza.userData.base;
  const [cx, cy, cz] = pose.cabeza ?? [0, 0, 0];
  base.set(base.x + (cx - base.x) * k, base.y + (cy - base.y) * k, base.z + (cz - base.z) * k);
  const yMeta = pose.cuerpoY ?? 0;
  a.cuerpo.position.y += (yMeta - a.cuerpo.position.y) * k;
  // Inclinarse hacia adelante (todo el cuerpo, desde los pies): beber, mirar algo abajo.
  a.cuerpo.rotation.x += ((pose.inclinacion ?? 0) - a.cuerpo.rotation.x) * k;
}

/** Pose de caminar: piernas y brazos se balancean según `fase` (radianes). */
export function poseCaminar(fase, amplitud = 0.5) {
  const s = Math.sin(fase) * amplitud;
  return {
    piernaI: [s, 0, 0],
    piernaD: [-s, 0, 0],
    brazoI: [-s * 0.7, 0, -0.1],
    brazoD: [s * 0.7, 0, 0.1],
    cuerpoY: Math.abs(Math.cos(fase)) * 0.018,
  };
}

/** Gira a la persona (en su eje vertical) para mirar un punto local; devuelve el ángulo. */
export function mirarHacia(p, x, z, k = 0.12) {
  const meta = Math.atan2(x - p.position.x, z - p.position.z);
  let d = meta - p.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  p.rotation.y += d * k;
  return meta;
}

