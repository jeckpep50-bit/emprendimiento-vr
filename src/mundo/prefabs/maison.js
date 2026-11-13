import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, malla, fusionar } from '../materiales.js';

// Objetos que el estudiante usa en la lección de francés «Chez Coco»: la tablet, el
// control remoto, el interruptor y la puerta. Cada uno deja en userData las piezas que
// la escena necesita mover o redibujar.

function fusionado(g) {
  fusionar(g);
  g.userData.noFusionar = true;
  return g;
}

/** Pantalla que se dibuja en un lienzo: devuelve la malla y redibujar(fn(ctx, w, h)). */
function pantalla(ancho, alto, px = 256) {
  const lienzo = document.createElement('canvas');
  lienzo.width = px;
  lienzo.height = Math.round((px * alto) / ancho);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: textura }));
  m.userData.noFusionar = true;
  const ctx = lienzo.getContext('2d');
  m.userData.redibujar = (dibujar) => {
    dibujar(ctx, lienzo.width, lienzo.height);
    textura.needsUpdate = true;
  };
  return m;
}

/**
 * Tablet (30 × 20 cm) de pie, con la pantalla hacia +Z y la base en el origen.
 * userData.pantalla.userData.redibujar(fn) dibuja la pantalla.
 */
function tablette() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.add(malla(new RoundedBoxGeometry(0.3, 0.2, 0.014, 3, 0.006), mat('#23304a'), [0, 0.1, 0]));
  cuerpo.add(malla(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 10), mat('#9aa6b5'), [0.14, 0.1, 0.008], [Math.PI / 2, 0, 0]));
  fusionado(cuerpo);
  const p = pantalla(0.27, 0.172, 320);
  p.position.set(0, 0.1, 0.0078);
  g.add(cuerpo, p);
  g.userData.pantalla = p;
  g.userData.anclaje = 'base';
  return g;
}

/**
 * Control remoto (5,5 × 19 cm) de pie, con los botones hacia +Z y la base en el origen.
 * userData.botones = { apagar, mas, menos }: posiciones (Vector3) de cada botón.
 */
function telecommande() {
  const g = new THREE.Group();
  g.add(malla(new RoundedBoxGeometry(0.055, 0.19, 0.02, 3, 0.009), mat('#2b2b33'), [0, 0.095, 0]));
  g.add(malla(new THREE.SphereGeometry(0.006, 8, 6), mat('#e3262c', { tipo: 'basica' }), [0, 0.186, 0.004]));
  for (let f = 0; f < 3; f++) for (let c = 0; c < 3; c++) g.add(malla(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 8), mat('#9aa6b5'), [(c - 1) * 0.014, 0.03 + f * 0.013, 0.0105], [Math.PI / 2, 0, 0]));
  fusionado(g);
  g.userData.botones = { apagar: new THREE.Vector3(0, 0.16, 0.012), mas: new THREE.Vector3(0, 0.118, 0.012), menos: new THREE.Vector3(0, 0.078, 0.012) };
  g.userData.anclaje = 'base';
  return g;
}

/**
 * Interruptor de pared grande (16 cm) con la tecla hacia +Z. userData.poner(encendido)
 * inclina la tecla; userData.piloto es la lucecita que ayuda a encontrarlo a oscuras.
 */
function interrupteur() {
  const g = new THREE.Group();
  const placa = new THREE.Group();
  placa.add(malla(new RoundedBoxGeometry(0.16, 0.16, 0.014, 3, 0.012), mat("#fffaf0"), [0, 0, 0.007]));
  fusionado(placa);
  const tecla = new THREE.Group();
  tecla.add(malla(new RoundedBoxGeometry(0.07, 0.1, 0.018, 3, 0.006), mat("#e8e2d4"), [0, 0, 0.009]));
  fusionado(tecla);
  tecla.position.z = 0.014;
  const piloto = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff8a1f' }));
  piloto.position.set(0, -0.062, 0.016);
  piloto.userData.noFusionar = true;
  g.add(placa, tecla, piloto);
  g.userData.piloto = piloto;
  g.userData.poner = (encendido) => {
    tecla.rotation.x = encendido ? 0.22 : -0.22;
    piloto.material.color.set(encendido ? '#3ddc84' : '#ff8a1f');
  };
  g.userData.poner(false);
  return g;
}

/**
 * Hoja de puerta (88 cm × 2 m): la bisagra está en el origen y la hoja se extiende
 * hacia +X. Se abre y se cierra girando el grupo en Y. userData.manija: punto de agarre.
 */
function porte({ color = '#fffaf0', panel = '#e8dcc4' } = {}) {
  const g = new THREE.Group();
  g.add(malla(new THREE.BoxGeometry(0.88, 2.0, 0.045), mat(color), [0.44, 1.0, 0]));
  for (const y of [0.55, 1.5]) {
    for (const s of [-1, 1]) g.add(malla(new THREE.BoxGeometry(0.66, y < 1 ? 0.75 : 0.72, 0.006), mat(panel), [0.44, y, s * 0.024]));
  }
  for (const s of [-1, 1]) {
    g.add(malla(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), mat('#e8c25a'), [0.8, 1.0, s * 0.045], [Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.CapsuleGeometry(0.014, 0.1, 4, 8), mat('#e8c25a'), [0.75, 1.0, s * 0.07], [0, 0, Math.PI / 2]));
  }
  fusionado(g);
  g.userData.manija = new THREE.Vector3(0.78, 1.0, 0);
  return g;
}

export const maison = { tablette, telecommande, interrupteur, porte };
