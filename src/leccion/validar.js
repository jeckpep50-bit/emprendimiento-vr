import { MODELOS, ENTORNOS, TIPOS_ESCENA, IDIOMAS, CARACTERES, EXPRESIONES } from './catalogo.js';

/**
 * Revisa que una lección (JSON) tenga la forma que espera el motor.
 * Devuelve una lista de errores legibles; vacía si todo está bien.
 * Se usa en el navegador, en `npm run validar` y en el generador con IA.
 */
export function validarLeccion(l) {
  const errores = [];
  const err = (ruta, msg) => errores.push(`${ruta}: ${msg}`);
  const texto = (v) => typeof v === 'string' && v.trim().length > 0;
  const lista = (v, min, max, ruta) => {
    if (!Array.isArray(v)) return err(ruta, 'debe ser una lista'), false;
    if (v.length < min || v.length > max) return err(ruta, `debe tener entre ${min} y ${max} elementos (tiene ${v.length})`), false;
    return true;
  };
  const modelo = (m, ruta) => m === undefined || m in MODELOS || err(ruta, `modelo desconocido "${m}"`);

  if (!l || typeof l !== 'object') return ['La lección no es un objeto JSON'];
  if (!texto(l.id) || !/^[a-z0-9-]+$/.test(l.id)) err('id', 'debe ser un identificador en minúsculas-con-guiones');
  if (!texto(l.titulo)) err('titulo', 'falta el título');
  if (!IDIOMAS.includes(l.idioma)) err('idioma', `debe ser uno de: ${IDIOMAS.join(', ')}`);
  if (l.narracion !== undefined && typeof l.narracion !== 'boolean') err('narracion', 'debe ser true o false');
  if (l.objetivos !== undefined && !(Array.isArray(l.objetivos) && l.objetivos.every(texto))) err('objetivos', 'debe ser una lista de textos');
  if (!lista(l.escenas, 1, 20, 'escenas')) return errores;

  l.escenas.forEach((e, i) => {
    const r = `escenas[${i}]`;
    if (!(e.tipo in TIPOS_ESCENA)) return err(`${r}.tipo`, `tipo desconocido "${e.tipo}"`);
    if (e.entorno !== undefined && !(e.entorno in ENTORNOS)) err(`${r}.entorno`, `entorno desconocido "${e.entorno}"`);
    if (!texto(e.titulo)) err(`${r}.titulo`, 'falta el título');

    if (e.tipo === 'narrativa' && lista(e.pasos, 1, 8, `${r}.pasos`)) {
      e.pasos.forEach((p, j) => {
        if (!texto(p.texto)) err(`${r}.pasos[${j}].texto`, 'falta el texto');
        modelo(p.modelo, `${r}.pasos[${j}].modelo`);
      });
    }

    if (e.tipo === 'exploracion' && lista(e.elementos, 2, 10, `${r}.elementos`)) {
      e.elementos.forEach((el, j) => {
        const rr = `${r}.elementos[${j}]`;
        if (!(el.modelo in MODELOS)) err(`${rr}.modelo`, `modelo desconocido "${el.modelo}"`);
        if (!texto(el.nombre)) err(`${rr}.nombre`, 'falta el nombre');
        if (!texto(el.texto)) err(`${rr}.texto`, 'falta el texto');
        if (el.etiqueta !== undefined && !CARACTERES.includes(el.etiqueta)) err(`${rr}.etiqueta`, `debe ser ${CARACTERES.join(' | ')}`);
      });
      if (e.minimo !== undefined && !(Number.isInteger(e.minimo) && e.minimo >= 1 && e.minimo <= e.elementos.length)) err(`${r}.minimo`, 'fuera de rango');
    }

    if (e.tipo === 'clasificar' && lista(e.categorias, 2, 4, `${r}.categorias`)) {
      const ids = new Set(e.categorias.map((c) => c.id));
      if (ids.size !== e.categorias.length) err(`${r}.categorias`, 'los id deben ser únicos');
      e.categorias.forEach((c, j) => {
        if (!texto(c.id)) err(`${r}.categorias[${j}].id`, 'falta el id');
        if (!texto(c.nombre)) err(`${r}.categorias[${j}].nombre`, 'falta el nombre');
      });
      if (lista(e.elementos, 2, 10, `${r}.elementos`)) {
        e.elementos.forEach((el, j) => {
          const rr = `${r}.elementos[${j}]`;
          if (!texto(el.nombre)) err(`${rr}.nombre`, 'falta el nombre');
          if (!ids.has(el.categoria)) err(`${rr}.categoria`, `"${el.categoria}" no es una categoría`);
          if (!texto(el.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
          modelo(el.modelo, `${rr}.modelo`);
        });
      }
    }

    if (e.tipo === 'ordenar' && lista(e.pasos, 2, 6, `${r}.pasos`)) {
      e.pasos.forEach((p, j) => texto(p.texto) || err(`${r}.pasos[${j}].texto`, 'falta el texto'));
    }

    if (e.utileria !== undefined && lista(e.utileria, 0, 12, `${r}.utileria`)) {
      e.utileria.forEach((u, j) => {
        modelo(u.modelo, `${r}.utileria[${j}].modelo`);
        if (u.posicion !== undefined && !(Array.isArray(u.posicion) && u.posicion.length === 3 && u.posicion.every(Number.isFinite))) err(`${r}.utileria[${j}].posicion`, 'debe ser [x, y, z]');
      });
    }

    if (e.tipo === 'ordenar' && e.construccion !== undefined) modelo(e.construccion?.modelo, `${r}.construccion.modelo`);

    if (e.tipo === 'entrevista') {
      const p = e.personaje;
      if (!p || !texto(p.nombre)) err(`${r}.personaje.nombre`, 'falta el nombre del personaje');
      if (p?.modelo !== undefined) modelo(p.modelo, `${r}.personaje.modelo`);
      if (p?.expresion !== undefined && !EXPRESIONES.includes(p.expresion)) err(`${r}.personaje.expresion`, `debe ser ${EXPRESIONES.join(' | ')}`);
      if (lista(e.preguntas, 3, 8, `${r}.preguntas`)) {
        let buenas = 0;
        e.preguntas.forEach((q, j) => {
          const rr = `${r}.preguntas[${j}]`;
          if (!texto(q.texto)) err(`${rr}.texto`, 'falta la pregunta');
          if (!['buena', 'mala'].includes(q.tipo)) err(`${rr}.tipo`, 'debe ser "buena" o "mala"');
          if (q.tipo === 'buena') {
            if (!texto(q.respuesta)) err(`${rr}.respuesta`, 'una pregunta buena necesita la respuesta del personaje');
            if (texto(q.hallazgo)) buenas++;
          }
          if (q.tipo === 'mala' && !texto(q.retro)) err(`${rr}.retro`, 'explica por qué la pregunta no sirve');
          if (q.expresion !== undefined && !EXPRESIONES.includes(q.expresion)) err(`${rr}.expresion`, `debe ser ${EXPRESIONES.join(' | ')}`);
        });
        if (buenas === 0) err(`${r}.preguntas`, 'debe haber al menos una pregunta buena con hallazgo');
        if (e.minimo !== undefined && !(Number.isInteger(e.minimo) && e.minimo >= 1 && e.minimo <= buenas)) err(`${r}.minimo`, 'fuera de rango');
      }
    }

    if (e.tipo === 'lluvia' && lista(e.ideas, 4, 10, `${r}.ideas`)) {
      e.ideas.forEach((idea, j) => {
        if (!texto(idea.texto)) err(`${r}.ideas[${j}].texto`, 'falta el texto de la idea');
        if (typeof idea.correcta !== 'boolean') err(`${r}.ideas[${j}].correcta`, 'debe ser true o false');
        if (idea.correcta === false && !texto(idea.retro)) err(`${r}.ideas[${j}].retro`, 'explica por qué no se elige');
      });
      if (!e.ideas.some((i) => i.correcta === true)) err(`${r}.ideas`, 'al menos una idea debe ser correcta');
    }

    if (e.tipo === 'quiz' && lista(e.preguntas, 1, 10, `${r}.preguntas`)) {
      e.preguntas.forEach((p, j) => {
        const rr = `${r}.preguntas[${j}]`;
        if (!texto(p.pregunta)) err(`${rr}.pregunta`, 'falta la pregunta');
        if (lista(p.opciones, 2, 4, `${rr}.opciones`) && !p.opciones.every(texto)) err(`${rr}.opciones`, 'todas deben ser textos');
        if (!(Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < (p.opciones?.length ?? 0))) err(`${rr}.correcta`, 'debe ser el índice (desde 0) de la opción correcta');
        if (!texto(p.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
        modelo(p.modelo, `${rr}.modelo`);
      });
    }
  });
  return errores;
}
