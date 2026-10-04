import * as THREE from 'three';

// Material de holograma: brillo en los bordes, líneas de escaneo que suben y un
// leve parpadeo. Todos comparten el mismo reloj (uTiempo).
const tiempo = { value: 0 };
const cache = new Map();

export function actualizarHologramas(t) {
  tiempo.value = t;
}

export function materialHolograma(color = '#5ff7ff') {
  let m = cache.get(color);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: { uTiempo: tiempo, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vVista;
      varying float vAltura;
      void main() {
        vec4 mundo = modelMatrix * vec4(position, 1.0);
        vec4 vista = viewMatrix * mundo;
        vNormal = normalize(normalMatrix * normal);
        vVista = normalize(-vista.xyz);
        vAltura = mundo.y;
        gl_Position = projectionMatrix * vista;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTiempo;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vVista;
      varying float vAltura;
      void main() {
        float borde = pow(1.0 - abs(dot(normalize(vNormal), vVista)), 2.0);
        float lineas = 0.55 + 0.45 * sin(vAltura * 140.0 - uTiempo * 7.0);
        float parpadeo = 0.92 + 0.08 * sin(uTiempo * 37.0);
        float alfa = (0.18 + borde * 0.95) * lineas * parpadeo;
        gl_FragColor = vec4(uColor * (0.7 + borde * 1.3), alfa);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  m.userData.compartido = true;
  cache.set(color, m);
  return m;
}

/** Convierte todas las mallas de un objeto en holograma (no libera sus materiales compartidos). */
export function holograma(obj, color) {
  const m = materialHolograma(color);
  obj.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) o.material = m;
  });
  return obj;
}
