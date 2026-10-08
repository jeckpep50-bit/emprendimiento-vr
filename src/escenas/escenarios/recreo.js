import * as THREE from 'three';
import { persona, posar, poseCaminar } from '../../mundo/prefabs/personas.js';
import { diseno } from '../../mundo/prefabs/diseno.js';

// El recreo de la escuela, vivo: Camila intenta tomar agua en un bebedero demasiado
// alto, Mateo se sube a un ladrillo, Doña Rosa trapea el charco, un estudiante grande
// bebe sin problema, otros juegan fútbol o saltan la cuerda. Lo usa la escena
// "observacion": devuelve las anclas donde van las marcas 👁️ de cada observación.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tramo = (a, b, x) => THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
const suave = (a, b, x) => {
  const k = tramo(a, b, x);
  return k * k * (3 - 2 * k);
};
const UNIFORME = { superior: '#2f4a8a', inferior: '#4d5566', cuello: '#ffffff', medias: '#ffffff' };
const DEPORTE = { superior: '#ffffff', inferior: '#2f6fd0', falda: false, cuello: null, medias: '#ffffff' };

/** Ángulo (rotación en Y) para mirar desde `a` hacia `b`. */
const rumbo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

function girarHacia(p, angulo, k) {
  const d = Math.atan2(Math.sin(angulo - p.rotation.y), Math.cos(angulo - p.rotation.y));
  p.rotation.y += d * k;
}

function expresion(p, e) {
  if (p.userData.expresion !== e) p.userData.setExpresion(e);
}

/**
 * esc: la escena (para voz, efectos y audio). Devuelve { anclas, actualizar(dt, t), personajes }.
 * Las anclas son { pos } (punto fijo) o { obj, alto } (sigue a un personaje).
 */
export function crearRecreo(esc) {
  const g = new THREE.Group();
  esc.raiz.add(g);
  const tareas = [];
  const cada = (fn) => tareas.push(fn);
  const animados = [];
  const agregar = (obj, x, y, z, ry = 0) => {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    g.add(obj);
    if (obj.userData.animar) animados.push(obj);
    return obj;
  };

  // ── Decorado de la escena ──
  const fuente = agregar(diseno.bebedero_doble(), 0, 0, -2.45);
  agregar(diseno.ladrillo(), 0.37, 0, -2.04, 0.15);
  const charco = agregar(diseno.charco(), 0.1, 0, -1.78);
  charco.scale.setScalar(1.15);
  agregar(diseno.mochila({ color: '#8b5cf6', abierta: true }), -2.8, 0.48, -0.95, Math.PI / 2);

  // ── Personajes ──
  const camila = agregar(persona({ peinado: 'colitas', estatura: 1.12, ...UNIFORME }), -2.68, 0, -1.65, Math.PI / 2);
  const mateo = agregar(persona({ peinado: 'corto', estatura: 1.14, piel: '#b9794f', cabello: '#1d1d27', ...UNIFORME, falda: false }), 0.37, 0.1, -2.04, Math.PI);
  const andres = agregar(persona({ peinado: 'corto', estatura: 1.42, piel: '#d9a06f', cabello: '#2b1d14', ...UNIFORME, falda: false }), -1.25, 0, -2.5, 0);
  const rosa = agregar(
    persona({ edad: 'adulto', estatura: 1.55, peinado: 'mono', cabello: '#7a7a80', piel: '#a8704a', superior: '#3d6fb5', inferior: '#2f3b52', falda: false, cuello: null, delantal: '#9fd3ff', expresion: 'feliz' }),
    1.1,
    0,
    -2.05,
    0,
  );
  rosa.rotation.y = rumbo(rosa.position, charco.position);
  const mopa = diseno.trapeador();
  mopa.position.set(0, 0, 0.52);
  mopa.rotation.x = 0.48;
  rosa.add(mopa);

  // Fútbol en la cancha (personajes lejanos: sin articulaciones)
  const futbolistas = [
    { colores: { superior: '#ffffff' }, piel: '#c98b5e' },
    { colores: { superior: '#ffc23c' }, piel: '#8d5a3b' },
    { colores: { superior: '#e5484d' }, piel: '#d9a06f' },
  ].map((f, i) => agregar(persona({ peinado: i === 1 ? 'cola' : 'corto', estatura: 1.25 + i * 0.05, piel: f.piel, ...DEPORTE, ...f.colores, detalle: 'bajo' }), -7 + i, 0, -2 + i));
  const balon = agregar(diseno.balon(), -6.5, 0.11, -1.5);
  const bola = { desde: V(-6.5, 0.11, -1.5), hasta: V(-6.5, 0.11, -1.5), t0: 0, dur: 0 };

  // Saltar la cuerda junto a la rayuela
  const cuerdaX = 4.7;
  const cuerdaZ = -3.4;
  agregar(persona({ peinado: 'cola', estatura: 1.2, piel: '#c98b5e', ...UNIFORME, detalle: 'bajo', expresion: 'feliz' }), cuerdaX - 0.78, 0, cuerdaZ, Math.PI / 2);
  agregar(persona({ peinado: 'colitas', estatura: 1.18, piel: '#a8704a', ...UNIFORME, detalle: 'bajo', expresion: 'feliz' }), cuerdaX + 0.78, 0, cuerdaZ, -Math.PI / 2);
  const saltadora = agregar(persona({ peinado: 'largo', estatura: 1.16, piel: '#d9a06f', cabello: '#5a3a22', ...UNIFORME, detalle: 'bajo', expresion: 'feliz' }), cuerdaX, 0, cuerdaZ, 0);
  const puntos = [];
  for (let i = 0; i <= 20; i++) {
    const x = -0.62 + (1.24 * i) / 20;
    puntos.push(V(x, -0.7 * Math.sin((Math.PI * i) / 20), 0));
  }
  const cuerda = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos), 30, 0.009, 5), new THREE.MeshLambertMaterial({ color: '#ff5aa5' }));
  cuerda.position.set(cuerdaX, 0.76, cuerdaZ);
  g.add(cuerda);

  // ── Coreografía ──
  const disparados = new Set();
  /** Ejecuta `fn` una sola vez por vuelta cuando el reloj de la vuelta pasa `enT`. */
  const evento = (nombre, vuelta, tt, enT, fn) => {
    const clave = `${nombre}-${vuelta}`;
    if (tt >= enT && !disparados.has(clave)) {
      disparados.add(clave);
      fn();
    }
  };
  /** Un personaje dice una frase del guion (solo si nadie más está hablando). */
  const decir = (p, clave, canal = 'principal') => {
    const frase = esc.datos.frases?.[clave];
    if (!frase || esc._destruida) return;
    if (canal === 'principal' && esc.m.audio.hablando) return;
    const pos = p.localToWorld(V(0, p.userData.alturaOjos ?? 1, 0));
    if (canal === 'principal') p.userData.fuenteHabla = () => esc.m.audio.nivelVoz();
    esc.voz(frase.texto, frase.quien, { pos, canal }).then(() => (p.userData.fuenteHabla = null));
  };

  // Camila: va al bebedero, no alcanza, se moja, se rinde y se sienta con sed (26 s).
  const S = V(-2.3, 0, -1.65);
  const F = V(-0.3, 0, -2.0);
  const SENT = V(-2.68, 0, -1.65);
  const poseSentada = { piernaI: [-1.45, 0, -0.05], piernaD: [-1.45, 0, 0.05], cuerpoY: 0.05 };
  cada((dt, t) => {
    const T = 26;
    const tt = t % T;
    const vuelta = Math.floor(t / T);
    const k = Math.min(1, dt * 9);
    if (tt < 1) {
      camila.position.lerpVectors(SENT, S, suave(0, 1, tt));
      girarHacia(camila, rumbo(S, F), k * 0.6);
      posar(camila, {}, k);
      expresion(camila, 'neutral');
    } else if (tt < 5) {
      camila.position.lerpVectors(S, F, tramo(1, 5, tt));
      girarHacia(camila, rumbo(S, F), k);
      posar(camila, poseCaminar(tt * 8, 0.45), k);
    } else if (tt < 7) {
      camila.position.copy(F);
      girarHacia(camila, Math.PI, k);
      // De puntitas, estirando el cuello y los brazos hacia el bebedero
      posar(camila, { cuerpoY: 0.05, cabeza: [-0.4, 0, 0], brazoI: [-1.35, 0, 0.15], brazoD: [-1.35, 0, -0.15] }, k);
      evento('aguaC', vuelta, tt, 5.6, () => {
        fuente.userData.setAgua(0, true);
        esc.m.audio.rafaga({ duracion: 2.2, filtro: 'highpass', frecuencia: 3000, volumen: 0.025, pos: esc.posMundo(fuente) });
      });
    } else if (tt < 9) {
      evento('salpica', vuelta, tt, 7, () => {
        expresion(camila, 'sorpresa');
        esc.m.fx.pixeles(camila.localToWorld(V(0, 0.8, 0.12)), '#8fd3ff', 36, 0.5);
        esc.m.audio.gota(esc.posMundo(camila));
        decir(camila, 'camilaMojada');
      });
      evento('apagaC', vuelta, tt, 8, () => fuente.userData.setAgua(0, false));
      camila.position.lerpVectors(F, V(F.x, 0, F.z + 0.18), suave(7, 7.6, tt));
      // Se seca la ropa con las manos
      const s = Math.sin(t * 11) * 0.25;
      posar(camila, { cabeza: [0.35, 0, 0], brazoI: [-0.85 + s, 0, 0.45], brazoD: [-0.85 - s, 0, -0.45] }, k);
    } else if (tt < 11) {
      camila.position.lerpVectors(V(F.x, 0, F.z + 0.18), F, suave(9, 9.5, tt));
      posar(camila, { cuerpoY: 0.05, cabeza: [-0.45, 0, 0], brazoI: [-1.5, 0, 0.1], brazoD: [-1.5, 0, -0.1] }, k);
      evento('triste', vuelta, tt, 10.2, () => expresion(camila, 'triste'));
    } else if (tt < 12.5) {
      posar(camila, { cabeza: [0.42, 0, 0] }, k);
      evento('noAlcanzo', vuelta, tt, 11.1, () => decir(camila, 'camilaNoAlcanzo'));
    } else if (tt < 16.5) {
      camila.position.lerpVectors(F, S, tramo(12.5, 16.5, tt));
      girarHacia(camila, rumbo(F, S), k);
      posar(camila, { ...poseCaminar(tt * 7, 0.35), cabeza: [0.3, 0, 0] }, k);
    } else if (tt < 17.5) {
      camila.position.lerpVectors(S, SENT, suave(16.5, 17.5, tt));
      girarHacia(camila, Math.PI / 2, k);
      posar(camila, poseSentada, k * 0.7);
    } else {
      camila.position.copy(SENT);
      girarHacia(camila, Math.PI / 2, k);
      // Sentada, se abanica con la mano y mira el bebedero
      posar(camila, { ...poseSentada, cabeza: [0.08, 0.3, 0], brazoD: [-2.5, 0, 0.35 + Math.sin(t * 10) * 0.22], brazoI: [-0.5, 0, -0.25] }, k);
      evento('sed', vuelta, tt, 19.5, () => vuelta % 2 === 1 && decir(camila, 'camilaSed'));
    }
  });

  // Andrés (un estudiante grande): espera su turno y bebe sin problema.
  const W = V(-1.25, 0, -2.5);
  const F2 = V(-0.3, 0, -2.06);
  cada((dt, t) => {
    const tt = t % 26;
    const vuelta = Math.floor(t / 26);
    const k = Math.min(1, dt * 8);
    if (tt < 17) {
      andres.position.copy(W);
      girarHacia(andres, rumbo(W, camila.position), k * 0.5);
      posar(andres, { brazoI: [0, 0, -0.12], brazoD: [0, 0, 0.12] }, k);
    } else if (tt < 18.5) {
      andres.position.lerpVectors(W, F2, tramo(17, 18.5, tt));
      girarHacia(andres, rumbo(W, F2), k);
      posar(andres, poseCaminar(tt * 8, 0.45), k);
    } else if (tt < 22.6) {
      girarHacia(andres, Math.PI, k);
      posar(andres, { inclinacion: 0.3, cabeza: [0.35, 0, 0], brazoI: [-0.5, 0, 0.1], brazoD: [-0.95, 0, -0.1] }, k);
      evento('aguaA', vuelta, tt, 19.3, () => fuente.userData.setAgua(0, true));
    } else if (tt < 23) {
      evento('apagaA', vuelta, tt, 22.6, () => fuente.userData.setAgua(0, false));
      evento('rica', vuelta, tt, 22.7, () => decir(andres, 'andresRica'));
      posar(andres, {}, k);
    } else if (tt < 25) {
      andres.position.lerpVectors(F2, W, tramo(23, 25, tt));
      girarHacia(andres, rumbo(F2, W), k);
      posar(andres, poseCaminar(tt * 8, 0.45), k);
    } else {
      andres.position.copy(W);
      posar(andres, {}, k);
    }
  });

  // Mateo: de pie sobre un ladrillo flojo, se tambalea mientras bebe.
  cada((dt, t) => {
    const k = Math.min(1, dt * 8);
    const ciclo = t % 9;
    const vuelta = Math.floor(t / 9);
    const fuerte = ciclo > 6 && ciclo < 7.6;
    mateo.rotation.z = Math.sin(t * 3.3) * 0.035 + (fuerte ? Math.sin(t * 15) * 0.11 : 0);
    fuente.userData.setAgua(1, !fuerte);
    if (fuerte) {
      expresion(mateo, 'sorpresa');
      posar(mateo, { brazoI: [0, 0, -1.35], brazoD: [0, 0, 1.35], cabeza: [-0.1, 0, 0] }, k);
      evento('tambaleo', vuelta, ciclo, 6.05, () => {
        esc.m.audio.clac(esc.posMundo(mateo));
        esc.m.audio.clac(esc.posMundo(mateo));
        if (vuelta % 3 === 1) decir(mateo, 'mateoUy');
      });
    } else {
      expresion(mateo, 'neutral');
      posar(mateo, { inclinacion: 0.12, cabeza: [0.28, 0, 0], brazoD: [-1.05, 0, -0.1], brazoI: [-0.45, 0, -0.2] }, k);
    }
  });

  // Doña Rosa trapea el charco que dejan los niños.
  cada((dt, t) => {
    const s = Math.sin(t * 2.2);
    mopa.position.x = s * 0.2;
    mopa.rotation.z = -s * 0.2;
    posar(rosa, { brazoI: [-0.78, 0.0, 0.42 + s * 0.12], brazoD: [-0.78, 0.0, -0.42 + s * 0.12], cabeza: [0.3, s * 0.1, 0] }, Math.min(1, dt * 8));
    evento('cuidado', Math.floor(t / 40), t % 40, 15, () => decir(rosa, 'rosaCuidado'));
  });

  // Fútbol: los jugadores persiguen el balón; al alcanzarlo, lo patean.
  const limites = { x: [-9, -4.2], z: [-5.3, 2.3] };
  cada((dt, t) => {
    const enVuelo = t < bola.t0 + bola.dur;
    if (enVuelo) {
      const k = tramo(bola.t0, bola.t0 + bola.dur, t);
      balon.position.lerpVectors(bola.desde, bola.hasta, k);
      balon.position.y = 0.11 + Math.sin(k * Math.PI) * 0.35;
      balon.rotation.x += dt * 9;
    }
    futbolistas.forEach((p, i) => {
      const meta = balon.position.clone().add(V(Math.cos(i * 2.1) * 0.25 * i, 0, Math.sin(i * 2.1) * 0.25 * i));
      meta.y = 0;
      const falta = meta.sub(p.position).setY(0);
      const d = falta.length();
      if (d > 0.08) {
        p.position.addScaledVector(falta.normalize(), Math.min(d, dt * (1.5 + i * 0.25)));
        girarHacia(p, Math.atan2(falta.x, falta.z), Math.min(1, dt * 8));
        posar(p, { cuerpoY: Math.abs(Math.sin(t * 9 + i)) * 0.04 }, 0.5);
      } else posar(p, {}, 0.3);
      if (!enVuelo && p.position.distanceTo(V(balon.position.x, 0, balon.position.z)) < 0.35) {
        bola.desde.copy(balon.position).setY(0.11);
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 2;
        bola.hasta.set(
          THREE.MathUtils.clamp(balon.position.x + Math.cos(a) * r, ...limites.x),
          0.11,
          THREE.MathUtils.clamp(balon.position.z + Math.sin(a) * r, ...limites.z),
        );
        bola.t0 = t;
        bola.dur = bola.desde.distanceTo(bola.hasta) / 4.5;
        esc.m.audio.clac(esc.posMundo(balon));
        if (Math.random() < 0.15) decir(p, Math.random() < 0.6 ? 'futbolPasala' : 'futbolGol', 'ambiente');
      }
    });
  });

  // Saltar la cuerda
  cada((dt, t) => {
    const angulo = t * 5.2;
    cuerda.rotation.x = -angulo;
    saltadora.position.y = 0.13 * Math.max(0, Math.cos(angulo)) ** 2;
    evento('cuenta', Math.floor(t / 21), t % 21, 6, () => decir(saltadora, 'cuerdaCuenta', 'ambiente'));
  });

  return {
    personajes: { camila, mateo, andres, rosa },
    anclas: {
      puntitas: { pos: V(-0.3, 1.66, -2.2) },
      mojada: { pos: V(-0.82, 1.08, -2.0) },
      grande: { obj: andres, alto: 1.78 },
      mateo: { obj: mateo, alto: 1.5 },
      charco: { pos: V(0.1, 0.42, -1.75) },
      banca: { pos: V(-2.6, 1.45, -1.65) },
      mochila: { pos: V(-2.8, 1.02, -0.95) },
      sol: { pos: V(-1.75, 5.4, -4.1) },
      futbol: { pos: V(-5.8, 1.7, -1.9) },
      bandera: { pos: V(3.9, 3.5, -5.0) },
      cuerda: { pos: V(cuerdaX, 1.9, cuerdaZ) },
      rayuela: { pos: V(3.6, 0.5, -0.45) },
    },
    actualizar(dt, t) {
      for (const p of animados) p.userData.animar(t);
      for (const fn of tareas) fn(dt, t);
    },
  };
}
