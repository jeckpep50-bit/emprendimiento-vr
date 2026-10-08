import * as THREE from 'three';
import { microbios } from './microbios.js';
import { alimentos } from './alimentos.js';
import { objetos } from './objetos.js';
import { diseno } from './diseno.js';
import { laboratorio } from './laboratorio.js';
import { mercado } from './mercado.js';
import { persona } from './personas.js';
import { crearTarjetaTexto } from '../../ui/componentes.js';
import { cajaLocal } from '../../core/entrada.js';

const FABRICAS = {
  ...microbios,
  ...alimentos,
  ...objetos,
  ...diseno,
  ...laboratorio,
  ...mercado,
  persona,
  tarjeta: (op) => crearTarjetaTexto({ texto: op.texto ?? '', emoji: op.emoji ?? '', ancho: 0.3, alto: 0.22, color: op.color }),
};

export const modelosDisponibles = Object.keys(FABRICAS);

/**
 * Crea un modelo del catálogo. Devuelve un grupo con:
 *   userData.tam    → Vector3 con el tamaño final
 *   userData.animar → animación opcional (t) del modelo
 *
 * Por defecto lo centra en el origen y lo escala para que su lado más largo
 * mida `tamano` metros. Con `normalizar: false` conserva su tamaño real
 * (multiplicado por `escala`) y su origen (p. ej. los pies de un personaje).
 */
export function crearModelo(nombre, { tamano = 0.3, normalizar = true, escala = 1, ...opciones } = {}) {
  const fabrica = FABRICAS[nombre];
  const modelo = fabrica ? fabrica(opciones) : crearTarjetaTexto({ texto: nombre, emoji: '❓' });
  if (!fabrica) console.warn(`Modelo desconocido: "${nombre}"`);

  const caja = cajaLocal(modelo);
  const tam = caja.getSize(new THREE.Vector3());
  if (normalizar) {
    const factor = tamano / Math.max(tam.x, tam.y, tam.z, 0.001);
    const centro = caja.getCenter(new THREE.Vector3());
    modelo.scale.multiplyScalar(factor);
    modelo.position.copy(centro).multiplyScalar(-factor);
    tam.multiplyScalar(factor);
  } else {
    modelo.scale.multiplyScalar(escala);
    tam.multiplyScalar(escala);
  }

  const envoltorio = new THREE.Group();
  envoltorio.add(modelo);
  envoltorio.userData.tam = tam;
  envoltorio.userData.nombreModelo = nombre;
  return envoltorio;
}

/** Busca en un modelo creado una función de su API (p. ej. setExpresion). */
export function apiModelo(envoltorio, nombre) {
  let fn = null;
  envoltorio.traverse((o) => {
    if (!fn && typeof o.userData[nombre] === 'function') fn = o.userData[nombre];
  });
  return fn;
}
