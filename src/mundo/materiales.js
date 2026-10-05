import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let rampaToon = null;
function mapaToon() {
  if (!rampaToon) {
    rampaToon = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
    rampaToon.minFilter = rampaToon.magFilter = THREE.NearestFilter;
    rampaToon.needsUpdate = true;
  }
  return rampaToon;
}

const cache = new Map();

/**
 * Material compartido (no se libera al cambiar de escena).
 * tipo: 'toon' (estilo caricatura, por defecto) | 'lambert' | 'basica'
 */
export function mat(color, { tipo = 'toon', emisivo = 0, opacidad = 1, lados = THREE.FrontSide } = {}) {
  const clave = `${color}|${tipo}|${emisivo}|${opacidad}|${lados}`;
  let m = cache.get(clave);
  if (m) return m;
  if (tipo === 'basica') m = new THREE.MeshBasicMaterial({ color });
  else if (tipo === 'lambert') m = new THREE.MeshLambertMaterial({ color });
  else m = new THREE.MeshToonMaterial({ color, gradientMap: mapaToon() });
  if (emisivo && m.emissive) {
    m.emissive.set(color);
    m.emissiveIntensity = emisivo;
  }
  if (opacidad < 1) {
    m.transparent = true;
    m.opacity = opacidad;
    m.depthWrite = false;
  }
  m.side = lados;
  m.userData.compartido = true;
  cache.set(clave, m);
  return m;
}

let texturaSombra = null;
/** Sombra de contacto falsa (un círculo difuminado): más barata que sombras reales. */
export function sombra(radio = 0.15, opacidad = 0.3) {
  if (!texturaSombra) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    texturaSombra = new THREE.CanvasTexture(c);
    texturaSombra.userData.compartido = true;
  }
  const m = new THREE.MeshBasicMaterial({ map: texturaSombra, transparent: true, opacity: opacidad, depthWrite: false });
  const malla = new THREE.Mesh(new THREE.PlaneGeometry(radio * 2, radio * 2), m);
  malla.rotation.x = -Math.PI / 2;
  malla.position.y = 0.002;
  malla.userData.noFusionar = true;
  return malla;
}

/** Atajo: crea una malla y la posiciona. */
export function malla(geometria, material, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = [], escala = null) {
  const m = new THREE.Mesh(geometria, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (escala) Array.isArray(escala) ? m.scale.set(...escala) : m.scale.setScalar(escala);
  return m;
}

/**
 * Ojos y boca de caricatura sobre la cara frontal (+Z) de un cuerpo de radio `r`.
 * caracter: 'bueno' / 'feliz' (sonríe) | 'malo' (cejas enojadas) | 'triste' |
 *           'sorpresa' (boca en O) | 'neutral'
 */
export function ponerCara(grupo, { r = 0.1, caracter = 'neutral', x = 0, y = 0, z = r, escalaBoca = 1 } = {}) {
  const blanco = mat('#ffffff', { tipo: 'basica' });
  const negro = mat('#1d1d27', { tipo: 'basica' });
  const ojoR = r * 0.24;
  const geoOjo = new THREE.SphereGeometry(ojoR, 14, 10);
  const geoPupila = new THREE.SphereGeometry(ojoR * 0.55, 10, 8);
  for (const lado of [-1, 1]) {
    const ox = x + lado * r * 0.36;
    const oy = y + r * 0.18;
    grupo.add(malla(geoOjo, blanco, [ox, oy, z * 0.9]));
    grupo.add(malla(geoPupila, negro, [ox, oy - ojoR * 0.1, z * 0.9 + ojoR * 0.62]));
    if (caracter === 'malo' || caracter === 'triste') {
      // Enojado: extremos internos abajo. Triste: extremos internos arriba.
      const giro = caracter === 'malo' ? lado * 0.5 : -lado * 0.35;
      grupo.add(malla(new THREE.BoxGeometry(ojoR * 2.3, ojoR * 0.45, ojoR * 0.5), negro, [ox, oy + ojoR * 1.3, z * 0.95], [0, 0, giro]));
    }
  }
  if (caracter === 'sorpresa') {
    grupo.add(malla(new THREE.TorusGeometry(r * 0.09 * escalaBoca, r * 0.04 * escalaBoca, 6, 16), negro, [x, y - r * 0.25, z * 0.94]));
    return;
  }
  const sonrisa = !['malo', 'triste'].includes(caracter);
  const grande = caracter === 'feliz';
  const boca = malla(
    new THREE.TorusGeometry(r * (grande ? 0.26 : 0.2) * escalaBoca, r * 0.05 * Math.sqrt(escalaBoca), 6, 16, Math.PI),
    negro,
    [x, y - r * (sonrisa ? 0.12 : 0.3), z * 0.93],
    [0, 0, sonrisa ? Math.PI : 0],
  );
  grupo.add(boca);
}

// Materiales con "colores por vértice": muchas piezas de colores distintos se
// dibujan juntas en una sola llamada (cada vértice guarda su propio color).
const materialesVC = new Map();
function materialVC(tipo, lados) {
  const clave = `${tipo}|${lados}`;
  let m = materialesVC.get(clave);
  if (!m) {
    if (tipo === 'toon') m = new THREE.MeshToonMaterial({ gradientMap: mapaToon(), vertexColors: true });
    else if (tipo === 'lambert') m = new THREE.MeshLambertMaterial({ vertexColors: true });
    else m = new THREE.MeshBasicMaterial({ vertexColors: true });
    m.side = lados;
    m.userData.compartido = true;
    materialesVC.set(clave, m);
  }
  return m;
}

/** Solo los materiales lisos (sin textura, sin transparencia ni brillo propio) se pueden juntar así. */
function tipoVC(m) {
  if (!m || m.map || m.transparent || m.vertexColors || m.alphaTest > 0) return null;
  if (m.emissive && m.emissiveIntensity > 0 && (m.emissive.r || m.emissive.g || m.emissive.b)) return null;
  if (m.isMeshToonMaterial) return m.gradientMap === mapaToon() ? 'toon' : null;
  if (m.isMeshLambertMaterial) return 'lambert';
  if (m.isMeshBasicMaterial) return 'basica';
  return null;
}

/**
 * Fusiona todas las mallas estáticas de un grupo. Las de material liso se juntan
 * en una sola malla con colores por vértice; las demás, en una malla por material.
 * Reduce muchísimo las "draw calls", clave para el rendimiento en Quest 2.
 */
export function fusionar(grupo) {
  grupo.updateMatrixWorld(true);
  const inversa = grupo.matrixWorld.clone().invert();
  const porMaterial = new Map();
  const quitar = [];
  const m = new THREE.Matrix4();

  grupo.traverse((o) => {
    if (!o.isMesh || o.userData.noFusionar || o.isInstancedMesh) return;
    for (let p = o.parent; p && p !== grupo; p = p.parent) if (p.userData.noFusionar) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    // Una pieza que ya venía fusionada con colores por vértice conserva sus colores.
    const yaVC = Boolean(o.material.vertexColors && g.attributes.color?.itemSize === 3);
    for (const nombre of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(nombre) && !(yaVC && nombre === 'color')) g.deleteAttribute(nombre);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.clearGroups();
    g.applyMatrix4(m.multiplyMatrices(inversa, o.matrixWorld));
    const vc = yaVC ? (o.material.isMeshToonMaterial ? 'toon' : o.material.isMeshLambertMaterial ? 'lambert' : 'basica') : tipoVC(o.material);
    if (vc && !yaVC) {
      const { r, g: verde, b } = o.material.color;
      const colores = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colores.length; i += 3) {
        colores[i] = r;
        colores[i + 1] = verde;
        colores[i + 2] = b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    }
    const material = vc ? materialVC(vc, o.material.side) : o.material;
    if (!porMaterial.has(material)) porMaterial.set(material, []);
    porMaterial.get(material).push(g);
    quitar.push(o);
  });

  for (const o of quitar) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const [material, geos] of porMaterial) {
    const unida = mergeGeometries(geos);
    if (unida) {
      geos.forEach((g) => g.dispose());
      grupo.add(new THREE.Mesh(unida, material));
    } else {
      // Nunca se pierde una pieza: si no se pudieron juntar, se agregan por separado.
      console.warn('fusionar: no se pudieron juntar las geometrías; se dibujan por separado');
      for (const g of geos) grupo.add(new THREE.Mesh(g, material));
    }
  }
  return grupo;
}

/** Libera geometrías, materiales y texturas propios (no los compartidos). */
export function liberar(raiz) {
  raiz.traverse((o) => {
    if (o.geometry && !o.geometry.userData.compartida) o.geometry.dispose();
    const materiales = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materiales) {
      if (m.userData.compartido) continue;
      if (m.map && !m.map.userData.compartido) m.map.dispose();
      m.dispose();
    }
  });
}
