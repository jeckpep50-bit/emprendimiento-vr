import { MODELOS, ENTORNOS, TIPOS_ESCENA, IDIOMAS, CARACTERES, EXPRESIONES, PELICULAS_DISPONIBLES, MODOS, ESCENARIOS_OBSERVACION, LUGARES_RECREO } from './catalogo.js';

const ERRORES_PREGUNTA = ['cerrada', 'juzga', 'sugiere', 'irrelevante'];

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
  if (l.gamificacion !== undefined && typeof l.gamificacion !== 'boolean') err('gamificacion', 'debe ser true o false');
  if (l.modo !== undefined && !MODOS.includes(l.modo)) err('modo', `debe ser ${MODOS.join(' | ')}`);
  if (l.objetivos !== undefined && !(Array.isArray(l.objetivos) && l.objetivos.every(texto))) err('objetivos', 'debe ser una lista de textos');
  if (l.rangos !== undefined && lista(l.rangos, 2, 8, 'rangos')) {
    l.rangos.forEach((r, j) => {
      if (!texto(r.nombre)) err(`rangos[${j}].nombre`, 'falta el nombre');
      if (!(Number.isFinite(r.puntos) && r.puntos >= 0)) err(`rangos[${j}].puntos`, 'debe ser un número de 0 o más');
      if (j > 0 && !(r.puntos > l.rangos[j - 1].puntos)) err(`rangos[${j}].puntos`, 'deben ir de menor a mayor');
    });
  }
  if (l.titulosMedalla !== undefined && !['oro', 'plata', 'bronce'].every((k) => l.titulosMedalla[k] === undefined || texto(l.titulosMedalla[k]))) err('titulosMedalla', 'oro, plata y bronce deben ser textos');
  if (l.voces !== undefined) {
    if (!texto(l.voces?.carpeta) || !/^[a-z0-9/_-]+$/.test(l.voces.carpeta)) err('voces.carpeta', 'debe ser una carpeta dentro de public (minúsculas, sin espacios)');
    if (l.voces?.personajes !== undefined && typeof l.voces.personajes !== 'object') err('voces.personajes', 'debe ser un objeto { id: { tono, velocidad, reproduccion? } }');
  }
  if (!lista(l.escenas, 1, 20, 'escenas')) return errores;

  l.escenas.forEach((e, i) => {
    const r = `escenas[${i}]`;
    if (!(e.tipo in TIPOS_ESCENA)) return err(`${r}.tipo`, `tipo desconocido "${e.tipo}"`);
    if (e.entorno !== undefined && !(e.entorno in ENTORNOS)) err(`${r}.entorno`, `entorno desconocido "${e.entorno}"`);
    if (!texto(e.titulo)) err(`${r}.titulo`, 'falta el título');
    if (e.insignia !== undefined && !(texto(e.insignia?.nombre) && (e.insignia.emoji === undefined || texto(e.insignia.emoji)))) err(`${r}.insignia`, 'debe ser { nombre, emoji? }');

    const categoriasValidas = (ruta) => {
      if (!lista(e.categorias, 2, 6, ruta)) return new Set();
      const ids = new Set(e.categorias.map((c) => c.id));
      if (ids.size !== e.categorias.length) err(ruta, 'los id deben ser únicos');
      e.categorias.forEach((c, j) => {
        if (!texto(c.id)) err(`${ruta}[${j}].id`, 'falta el id');
        if (!texto(c.nombre)) err(`${ruta}[${j}].nombre`, 'falta el nombre');
      });
      return ids;
    };
    const posicionValida = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

    if (e.tipo === 'inspeccion') {
      const ids = categoriasValidas(`${r}.categorias`);
      if (lista(e.elementos, 2, 16, `${r}.elementos`)) {
        e.elementos.forEach((el, j) => {
          const rr = `${r}.elementos[${j}]`;
          if (!(el.modelo in MODELOS)) err(`${rr}.modelo`, `modelo desconocido "${el.modelo}"`);
          if (!texto(el.nombre)) err(`${rr}.nombre`, 'falta el nombre');
          if (!texto(el.texto)) err(`${rr}.texto`, 'falta el texto');
          if (!posicionValida(el.posicion)) err(`${rr}.posicion`, 'debe ser [x, y, z]');
          if (el.categoria !== 'ok' && !ids.has(el.categoria)) err(`${rr}.categoria`, `"${el.categoria}" no es una categoría (usa "ok" si no hay riesgo)`);
          (el.acompanantes ?? []).forEach((a, k) => modelo(a.modelo, `${rr}.acompanantes[${k}].modelo`));
        });
        if (!e.elementos.some((el) => el.categoria !== 'ok')) err(`${r}.elementos`, 'debe haber al menos un riesgo');
      }
    }

    if (e.tipo === 'cinta' && lista(e.productos, 4, 24, `${r}.productos`)) {
      e.productos.forEach((p, j) => {
        const rr = `${r}.productos[${j}]`;
        if (!(p.modelo in MODELOS)) err(`${rr}.modelo`, `modelo desconocido "${p.modelo}"`);
        if (!texto(p.nombre)) err(`${rr}.nombre`, 'falta el nombre');
        if (typeof p.apto !== 'boolean') err(`${rr}.apto`, 'debe ser true o false');
        if (!texto(p.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
      });
      if (!e.productos.some((p) => p.apto === false)) err(`${r}.productos`, 'debe haber al menos un producto que se rechace');
    }

    if (e.tipo === 'viaje' && lista(e.estaciones, 1, 4, `${r}.estaciones`)) {
      const zonas = ['boca', 'estomago', 'intestino', 'defensas'];
      e.estaciones.forEach((s, j) => {
        const rr = `${r}.estaciones[${j}]`;
        if (!zonas.includes(s.zona)) err(`${rr}.zona`, `debe ser ${zonas.join(' | ')}`);
        if (!texto(s.nombre)) err(`${rr}.nombre`, 'falta el nombre');
        if (!texto(s.texto)) err(`${rr}.texto`, 'falta el texto');
        if (!texto(s.pregunta)) err(`${rr}.pregunta`, 'falta la pregunta');
        if (lista(s.opciones, 2, 3, `${rr}.opciones`) && !s.opciones.every(texto)) err(`${rr}.opciones`, 'todas deben ser textos');
        if (!(Number.isInteger(s.correcta) && s.correcta >= 0 && s.correcta < (s.opciones?.length ?? 0))) err(`${rr}.correcta`, 'índice fuera de rango');
        if (!texto(s.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
      });
    }

    if (e.tipo === 'pelicula' && !PELICULAS_DISPONIBLES.includes(e.guion)) err(`${r}.guion`, `debe ser ${PELICULAS_DISPONIBLES.join(' | ')}`);

    if (e.tipo === 'caos') {
      const ids = categoriasValidas(`${r}.categorias`);
      if (lista(e.incidentes, 3, 16, `${r}.incidentes`)) {
        e.incidentes.forEach((inc, j) => {
          const rr = `${r}.incidentes[${j}]`;
          if (!(inc.modelo in MODELOS)) err(`${rr}.modelo`, `modelo desconocido "${inc.modelo}"`);
          if (!texto(inc.nombre)) err(`${rr}.nombre`, 'falta el nombre');
          if (!ids.has(inc.categoria)) err(`${rr}.categoria`, `"${inc.categoria}" no es una categoría`);
          if (!texto(inc.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
          if (inc.resuelto !== undefined) modelo(inc.resuelto?.modelo, `${rr}.resuelto.modelo`);
        });
      }
      if (e.duracion !== undefined && !(Number.isFinite(e.duracion) && e.duracion >= 30 && e.duracion <= 180)) err(`${r}.duracion`, 'debe estar entre 30 y 180 segundos');
    }

    if (e.tipo === 'narrativa' && lista(e.pasos, 1, 8, `${r}.pasos`)) {
      e.pasos.forEach((p, j) => {
        if (!texto(p.texto)) err(`${r}.pasos[${j}].texto`, 'falta el texto');
        modelo(p.modelo, `${r}.pasos[${j}].modelo`);
      });
    }

    if ((e.tipo === 'exploracion' || e.tipo === 'linterna') && lista(e.elementos, 2, 10, `${r}.elementos`)) {
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
      // Un personaje ("personaje") o varios ("personajes", cada uno con id).
      const personajes = e.personajes ?? (e.personaje ? [e.personaje] : []);
      if (e.personajes !== undefined) {
        lista(e.personajes, 1, 4, `${r}.personajes`);
        const ids = new Set(e.personajes.map((p) => p.id));
        if (ids.size !== e.personajes.length || e.personajes.some((p) => !texto(p.id))) err(`${r}.personajes`, 'cada personaje necesita un id único');
      }
      if (!personajes.length) err(`${r}.personaje`, 'falta el personaje');
      personajes.forEach((p, k) => {
        const rp = e.personajes ? `${r}.personajes[${k}]` : `${r}.personaje`;
        if (!texto(p?.nombre)) err(`${rp}.nombre`, 'falta el nombre del personaje');
        if (p?.modelo !== undefined) modelo(p.modelo, `${rp}.modelo`);
        if (p?.expresion !== undefined && !EXPRESIONES.includes(p.expresion)) err(`${rp}.expresion`, `debe ser ${EXPRESIONES.join(' | ')}`);
      });
      const idsPersonajes = new Set(personajes.map((p) => p?.id).filter(Boolean));
      let buenas = 0;
      const revisar = (preguntas, ruta, min, max) => {
        if (!lista(preguntas, min, max, ruta)) return;
        preguntas.forEach((q, j) => {
          const rr = `${ruta}[${j}]`;
          if (!texto(q.texto)) err(`${rr}.texto`, 'falta la pregunta');
          if (!['buena', 'mala'].includes(q.tipo)) err(`${rr}.tipo`, 'debe ser "buena" o "mala"');
          if (q.tipo === 'buena') {
            if (!texto(q.respuesta)) err(`${rr}.respuesta`, 'una pregunta buena necesita la respuesta del personaje');
            if (texto(q.hallazgo)) buenas++;
          }
          if (q.tipo === 'mala' && !texto(q.retro)) err(`${rr}.retro`, 'explica por qué la pregunta no sirve');
          if (q.error !== undefined && !ERRORES_PREGUNTA.includes(q.error)) err(`${rr}.error`, `debe ser ${ERRORES_PREGUNTA.join(' | ')}`);
          if (q.a !== undefined && !idsPersonajes.has(q.a)) err(`${rr}.a`, `"${q.a}" no es el id de un personaje`);
          if (q.expresion !== undefined && !EXPRESIONES.includes(q.expresion)) err(`${rr}.expresion`, `debe ser ${EXPRESIONES.join(' | ')}`);
          if (q.sigue !== undefined) revisar(q.sigue, `${rr}.sigue`, 1, 3);
        });
      };
      revisar(e.preguntas, `${r}.preguntas`, 3, 12);
      if (Array.isArray(e.preguntas)) {
        if (buenas === 0) err(`${r}.preguntas`, 'debe haber al menos una pregunta buena con hallazgo');
        if (e.minimo !== undefined && !(Number.isInteger(e.minimo) && e.minimo >= 1 && e.minimo <= buenas)) err(`${r}.minimo`, 'fuera de rango');
      }
    }

    if (e.tipo === 'lluvia' && lista(e.ideas, 4, 12, `${r}.ideas`)) {
      const elige = e.elegir !== false;
      if (e.elegir !== undefined && typeof e.elegir !== 'boolean') err(`${r}.elegir`, 'debe ser true o false');
      if (e.chispas !== undefined && lista(e.chispas, 1, 4, `${r}.chispas`)) e.chispas.forEach((c, j) => texto(c.texto) || err(`${r}.chispas[${j}].texto`, 'falta el texto de la chispa'));
      e.ideas.forEach((idea, j) => {
        if (!texto(idea.texto)) err(`${r}.ideas[${j}].texto`, 'falta el texto de la idea');
        if (elige && typeof idea.correcta !== 'boolean') err(`${r}.ideas[${j}].correcta`, 'debe ser true o false');
        if (elige && idea.correcta === false && !texto(idea.retro)) err(`${r}.ideas[${j}].retro`, 'explica por qué no se elige');
        if (e.chispas && !(Number.isInteger(idea.chispa) && idea.chispa >= 0 && idea.chispa < e.chispas.length)) err(`${r}.ideas[${j}].chispa`, 'debe ser el índice de una chispa');
      });
      if (elige && !e.ideas.some((i) => i.correcta === true)) err(`${r}.ideas`, 'al menos una idea debe ser correcta');
    }

    if (e.frases !== undefined) {
      if (typeof e.frases !== 'object' || Array.isArray(e.frases)) err(`${r}.frases`, 'debe ser un objeto { clave: { quien, texto } }');
      else for (const [k, f] of Object.entries(e.frases)) if (!texto(f?.quien) || !texto(f?.texto)) err(`${r}.frases.${k}`, 'necesita quien y texto');
    }

    if (e.tipo === 'observacion') {
      if (!ESCENARIOS_OBSERVACION.includes(e.escenario)) err(`${r}.escenario`, `debe ser ${ESCENARIOS_OBSERVACION.join(' | ')}`);
      if (lista(e.observaciones, 3, 16, `${r}.observaciones`)) {
        e.observaciones.forEach((o, j) => {
          const rr = `${r}.observaciones[${j}]`;
          if (e.escenario === 'recreo' && !LUGARES_RECREO.includes(o.lugar)) err(`${rr}.lugar`, `debe ser ${LUGARES_RECREO.join(' | ')}`);
          if (!texto(o.texto)) err(`${rr}.texto`, 'falta lo que se observa');
          if (typeof o.relevante !== 'boolean') err(`${rr}.relevante`, 'debe ser true o false');
          if (!texto(o.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
        });
        if (!e.observaciones.some((o) => o.relevante)) err(`${r}.observaciones`, 'al menos una debe ser importante');
      }
    }

    if (e.tipo === 'frase') {
      const opcionesValidas = (ops, ruta) => {
        if (!lista(ops, 2, 4, ruta)) return;
        ops.forEach((o, j) => {
          if (!texto(o.texto)) err(`${ruta}[${j}].texto`, 'falta el texto');
          if (typeof o.correcta !== 'boolean') err(`${ruta}[${j}].correcta`, 'debe ser true o false');
          if (!o.correcta && !texto(o.retro)) err(`${ruta}[${j}].retro`, 'explica por qué no sirve');
        });
        if (ops.filter((o) => o.correcta).length !== 1) err(ruta, 'debe haber exactamente una opción correcta');
      };
      if (lista(e.partes, 1, 5, `${r}.partes`)) {
        e.partes.forEach((p, j) => {
          if (!texto(p.etiqueta)) err(`${r}.partes[${j}].etiqueta`, 'falta la etiqueta');
          opcionesValidas(p.opciones, `${r}.partes[${j}].opciones`);
        });
      }
      if (e.pregunta !== undefined) opcionesValidas(e.pregunta?.opciones, `${r}.pregunta.opciones`);
    }

    if (e.tipo === 'matriz' && lista(e.criterios, 2, 5, `${r}.criterios`) && lista(e.ideas, 2, 5, `${r}.ideas`)) {
      e.criterios.forEach((c, j) => texto(c.texto) || err(`${r}.criterios[${j}].texto`, 'falta el texto'));
      e.ideas.forEach((idea, j) => {
        const rr = `${r}.ideas[${j}]`;
        if (!texto(idea.texto)) err(`${rr}.texto`, 'falta el texto');
        if (!(Array.isArray(idea.cumple) && idea.cumple.length === e.criterios.length && idea.cumple.every((v) => typeof v === 'boolean'))) err(`${rr}.cumple`, `debe tener ${e.criterios.length} valores true/false`);
        if (idea.porque !== undefined && !(Array.isArray(idea.porque) && idea.porque.length === e.criterios.length)) err(`${rr}.porque`, `debe tener ${e.criterios.length} textos`);
      });
      if (e.ideas.filter((i) => i.cumple?.every?.(Boolean)).length !== 1) err(`${r}.ideas`, 'exactamente una idea debe cumplir todos los criterios');
    }

    if (e.tipo === 'prototipo') {
      if (lista(e.materiales, 2, 12, `${r}.materiales`)) {
        e.materiales.forEach((m, j) => {
          const rr = `${r}.materiales[${j}]`;
          if (!(m.modelo in MODELOS)) err(`${rr}.modelo`, `modelo desconocido "${m.modelo}"`);
          if (!texto(m.nombre)) err(`${rr}.nombre`, 'falta el nombre');
          if (typeof m.sirve !== 'boolean') err(`${rr}.sirve`, 'debe ser true o false');
          if (!texto(m.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
        });
        if (!e.materiales.some((m) => m.sirve)) err(`${r}.materiales`, 'al menos un material debe servir');
      }
      if (lista(e.medidas, 2, 5, `${r}.medidas`)) {
        e.medidas.forEach((m, j) => {
          const rr = `${r}.medidas[${j}]`;
          if (!texto(m.texto)) err(`${rr}.texto`, 'falta el texto');
          if (!(Number.isFinite(m.alto) && m.alto > 0 && m.alto <= 0.6)) err(`${rr}.alto`, 'debe estar entre 0 y 0,6 m');
          if (typeof m.correcta !== 'boolean') err(`${rr}.correcta`, 'debe ser true o false');
          if (!texto(m.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
        });
        if (e.medidas.filter((m) => m.correcta).length !== 1) err(`${r}.medidas`, 'exactamente una medida debe ser correcta');
      }
    }

    if (e.tipo === 'atrapar') {
      if (lista(e.malos, 1, 8, `${r}.malos`)) e.malos.forEach((m, j) => modelo(m, `${r}.malos[${j}]`));
      if (e.buenos !== undefined && lista(e.buenos, 0, 8, `${r}.buenos`)) e.buenos.forEach((m, j) => modelo(m, `${r}.buenos[${j}]`));
      if (e.objetivo !== undefined) modelo(e.objetivo?.modelo, `${r}.objetivo.modelo`);
      if (e.duracion !== undefined && !(Number.isFinite(e.duracion) && e.duracion >= 15 && e.duracion <= 120)) err(`${r}.duracion`, 'debe estar entre 15 y 120 segundos');
    }

    if (e.tipo === 'simulacion' && lista(e.retos, 1, 8, `${r}.retos`)) {
      e.retos.forEach((q, j) => {
        const rr = `${r}.retos[${j}]`;
        if (!texto(q.pregunta)) err(`${rr}.pregunta`, 'falta la pregunta');
        if (lista(q.opciones, 2, 4, `${rr}.opciones`) && !q.opciones.every(texto)) err(`${rr}.opciones`, 'todas deben ser textos');
        if (!(Number.isInteger(q.correcta) && q.correcta >= 0 && q.correcta < (q.opciones?.length ?? 0))) err(`${rr}.correcta`, 'índice fuera de rango');
        if (!texto(q.explicacion)) err(`${rr}.explicacion`, 'falta la explicación');
        if (!Number.isFinite(q.temperatura)) err(`${rr}.temperatura`, 'debe ser un número (°C)');
        if (!(Number.isFinite(q.horas) && q.horas > 0 && q.horas <= 6)) err(`${rr}.horas`, 'debe estar entre 0 y 6');
        if (q.inicial !== undefined && !(Number.isFinite(q.inicial) && q.inicial >= 1)) err(`${rr}.inicial`, 'debe ser 1 o más');
      });
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
