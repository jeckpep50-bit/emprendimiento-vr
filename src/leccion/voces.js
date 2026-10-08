// Voces grabadas de las lecciones. Cada línea que dice un personaje se guarda como
// MP3 en public/<voces.carpeta>/<clave>.mp3; la clave sale de quién habla y del texto,
// así un texto corregido genera un audio nuevo. Este archivo no importa three.js:
// lo usan el motor (para saber qué audio tocar) y scripts/generar-voces.mjs.

/** Hash FNV-1a de 32 bits en base 36 (corto y estable entre Node y el navegador). */
function hash(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

export function claveVoz(quien, texto) {
  return `${quien}-${hash(String(texto ?? '').trim())}`;
}

// Palabras que la voz en español pronuncia mejor escritas "como suenan".
const PRONUNCIACION = [
  [/Design Thinking/gi, 'Disáin Tínkin'],
  [/\bcoach\b/gi, 'cóuch'],
];

/**
 * Texto listo para la voz sintética: sin emojis, comillas ni flechas, con los
 * ordinales escritos y las MAYÚSCULAS de énfasis en minúsculas (si no, la voz
 * podría deletrearlas).
 */
export function textoHablado(texto) {
  const ordinales = { 1: 'primero', 2: 'segundo', 3: 'tercero', 4: 'cuarto', 5: 'quinto', 6: 'sexto', 7: 'séptimo' };
  let t = String(texto ?? '')
    .replace(/✅/g, ' visto ')
    .replace(/❌/g, ' equis ')
    .replace(/👁️?/g, ' ojo ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/\b([1-7])\.º/g, (_, n) => ordinales[n])
    .replace(/[«»“”"*]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\?{2,}/g, '?')
    .replace(/(?<!\p{L})(\p{Lu}{2,})(?!\p{L})/gu, (p) => p.toLowerCase());
  for (const [patron, dicho] of PRONUNCIACION) t = t.replace(patron, dicho);
  return t
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:]+/, '')
    .trim();
}

/** Personajes de una entrevista: la lista "personajes" o, si no hay, el único "personaje". */
export function personajesDe(escena) {
  const lista = escena.personajes ?? (escena.personaje ? [{ id: 'principal', ...escena.personaje }] : []);
  return lista.map((p, i) => ({ ...p, id: p.id ?? `p${i}` }));
}

/**
 * Recorre las preguntas de una entrevista, incluidas las de seguimiento ("sigue").
 * Una pregunta de seguimiento sin "a" va dirigida al mismo personaje que la anterior.
 */
export function todasLasPreguntas(preguntas = []) {
  const salida = [];
  const visitar = (lista, a) => {
    for (const q of lista ?? []) {
      const conPersonaje = q.a === undefined && a !== undefined ? { ...q, a } : q;
      salida.push(conPersonaje);
      visitar(q.sigue, conPersonaje.a);
    }
  };
  visitar(preguntas);
  return salida;
}

/**
 * Todas las líneas con voz de una lección: [{ quien, texto }].
 * - Instrucción de cada escena y "mensajeFinal" → la guía (o "vozInstruccion").
 * - Pasos de una narrativa → "voz" del paso, de la escena o la guía.
 * - Entrevistas → saludo y respuestas con la voz de cada personaje.
 * - "frases" de una escena → { clave: { quien, texto } } (diálogos de una escena animada).
 */
export function lineasDeVoz(leccion) {
  if (!leccion?.voces) return [];
  const lineas = new Map();
  for (const e of leccion.escenas ?? []) for (const l of lineasDeEscena(e)) lineas.set(l.clave, l);
  return [...lineas.values()];
}

/** Líneas con voz de una sola escena (el motor las precarga al entrar). */
export function lineasDeEscena(e) {
  const lineas = new Map();
  const agregar = (quien, texto) => {
    if (!quien || typeof texto !== 'string' || !textoHablado(texto)) return;
    const clave = claveVoz(quien, texto);
    lineas.set(clave, { clave, quien, texto });
  };
  if (!e) return [];
  const guia = e.vozInstruccion ?? 'guia';
  if (e.vozInstruccion !== false) {
    agregar(guia, e.instruccion);
    agregar(guia, e.instruccionElegir);
    agregar(guia, e.instruccionMedida);
    agregar(guia, e.pregunta?.instruccion);
    if (e.vozFinal !== false) agregar(guia, e.mensajeFinal);
  }
  if (e.tipo === 'narrativa') for (const p of e.pasos ?? []) agregar(p.voz ?? e.voz ?? 'guia', p.texto);
  if (e.tipo === 'entrevista') {
    const personajes = personajesDe(e);
    const vozDe = (id) => (personajes.find((p) => p.id === id) ?? personajes[0])?.voz;
    for (const p of personajes) agregar(p.voz, p.saludo);
    agregar(personajes[0]?.voz, e.saludo);
    for (const q of todasLasPreguntas(e.preguntas)) agregar(vozDe(q.a), q.respuesta);
  }
  for (const f of Object.values(e.frases ?? {})) agregar(f.quien, f.texto);
  return [...lineas.values()];
}
