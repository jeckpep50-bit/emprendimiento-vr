// Genera una lección VR completa (JSON) a partir de un tema de clase usando Claude.
//
// Uso:
//   npm run generar -- --tema "El ciclo del agua" --grado "5.º EGB" --materia "Ciencias Naturales"
//   npm run generar -- --tema "Parts of a plant" --idioma en --narracion
//   npm run generar -- --tema "..." --solo-prompt     (muestra el prompt sin llamar a la API)
//
// Opciones: --tema (obligatorio) --grado --materia --idioma es|en --minutos --notas --narracion
// Credenciales: ANTHROPIC_API_KEY (o un perfil de `ant auth login`).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { MODELOS, ENTORNOS, TIPOS_ESCENA, IDIOMAS, CARACTERES, EXPRESIONES } from '../src/leccion/catalogo.js';
import { validarLeccion } from '../src/leccion/validar.js';

const MODELO_IA = 'claude-opus-5';
const MAX_INTENTOS = 3;
const carpeta = new URL('../public/lecciones/', import.meta.url);

const { values: op } = parseArgs({
  options: {
    tema: { type: 'string' },
    grado: { type: 'string', default: '5.º EGB' },
    materia: { type: 'string', default: '' },
    idioma: { type: 'string', default: 'es' },
    minutos: { type: 'string', default: '20' },
    notas: { type: 'string', default: '' },
    narracion: { type: 'boolean', default: false },
    'solo-prompt': { type: 'boolean', default: false },
  },
});

if (!op.tema) {
  console.error('Falta el tema. Ejemplo: npm run generar -- --tema "El ciclo del agua"');
  process.exit(1);
}
if (!IDIOMAS.includes(op.idioma)) {
  console.error(`--idioma debe ser uno de: ${IDIOMAS.join(', ')}`);
  process.exit(1);
}

// ── Esquema JSON (salidas estructuradas) ───────────────────────────────────
// Los campos opcionales se piden como "" para mantener el esquema simple;
// luego se limpian. Longitudes y rangos los revisa validarLeccion().
const texto = { type: 'string' };
const modeloOVacio = { type: 'string', enum: ['', ...Object.keys(MODELOS)] };
const objeto = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const lista = (items) => ({ type: 'array', items });
const base = (tipo) => ({ tipo: { type: 'string', const: tipo }, entorno: { type: 'string', enum: Object.keys(ENTORNOS) }, titulo: texto });

const ESQUEMA = objeto({
  id: texto,
  titulo: texto,
  materia: texto,
  grado: texto,
  idioma: { type: 'string', enum: IDIOMAS },
  duracionMinutos: { type: 'integer' },
  emoji: texto,
  narracion: { type: 'boolean' },
  descripcion: texto,
  objetivos: lista(texto),
  escenas: lista({
    anyOf: [
      objeto({ ...base('narrativa'), pasos: lista(objeto({ texto, emoji: texto, modelo: modeloOVacio })) }),
      objeto({
        ...base('exploracion'),
        instruccion: texto,
        elementos: lista(objeto({ modelo: { type: 'string', enum: Object.keys(MODELOS) }, nombre: texto, texto, etiqueta: { type: 'string', enum: CARACTERES } })),
      }),
      objeto({
        ...base('clasificar'),
        instruccion: texto,
        categorias: lista(objeto({ id: texto, nombre: texto, emoji: texto })),
        elementos: lista(objeto({ nombre: texto, categoria: texto, explicacion: texto, pista: texto, modelo: modeloOVacio, emoji: texto })),
      }),
      objeto({ ...base('ordenar'), instruccion: texto, mensajeFinal: texto, pasos: lista(objeto({ texto, emoji: texto, pista: texto })) }),
      objeto({
        ...base('entrevista'),
        instruccion: texto,
        saludo: texto,
        mensajeFinal: texto,
        personaje: objeto({ nombre: texto, modelo: { type: 'string', enum: ['estudiante'] }, expresion: { type: 'string', enum: EXPRESIONES } }),
        preguntas: lista(objeto({ texto, tipo: { type: 'string', enum: ['buena', 'mala'] }, respuesta: texto, hallazgo: texto, expresion: { type: 'string', enum: EXPRESIONES }, retro: texto })),
      }),
      objeto({
        ...base('lluvia'),
        instruccion: texto,
        instruccionElegir: texto,
        ideas: lista(objeto({ texto, emoji: texto, correcta: { type: 'boolean' }, retro: texto })),
      }),
      objeto({
        ...base('quiz'),
        preguntas: lista(objeto({ pregunta: texto, opciones: lista(texto), correcta: { type: 'integer' }, explicacion: texto, modelo: modeloOVacio })),
      }),
    ],
  }),
});

/** Quita los campos opcionales que llegaron vacíos (""), como espera el motor. */
function limpiar(valor) {
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== '').map(([k, v]) => [k, limpiar(v)]));
  }
  return valor;
}

// ── Prompt ─────────────────────────────────────────────────────────────────
const catalogo = (obj) => Object.entries(obj).map(([k, v]) => `- ${k}: ${v}`).join('\n');
const ejemplo = readFileSync(new URL('design-thinking-reto-bebedero.json', carpeta), 'utf8');

const SISTEMA = `Diseñas experiencias educativas de realidad virtual para estudiantes de Educación General Básica de Ecuador, que se juegan con gafas Meta Quest 2 dentro de un motor WebXR. Tu salida es el JSON de una lección que el motor reproduce tal cual.

Cómo se vive la experiencia:
- Cada estudiante usa sus propias gafas, de pie o sentado, sin caminar. Apunta con un rayo y selecciona con el gatillo o pellizcando con los dedos.
- Todo el texto aparece en paneles flotantes. Una lección de 20 minutos suele tener entre 6 y 8 escenas. Comienza con una narrativa de bienvenida que explique cómo apuntar y seleccionar, y termina con un quiz (el motor añade solo la pantalla de cierre).
- Alterna tipos de escena para mantener la atención: explorar, clasificar y ordenar son más memorables que leer. Usa cada tipo donde tenga sentido para el tema.

Tipos de escena:
${catalogo(TIPOS_ESCENA)}

Límites que el motor necesita:
- narrativa: 1 a 5 pasos; cada texto de 1 a 3 oraciones cortas (máximo ~220 caracteres).
- exploracion: 4 a 8 elementos, cada uno con un modelo 3D del catálogo; "texto" de máximo ~180 caracteres. "etiqueta": bueno (útil/amigo), malo (peligroso/dañino) o neutral (dato).
- clasificar: 2 o 3 categorías (id corto sin espacios) y 5 a 8 elementos. Cada elemento lleva un modelo del catálogo o, si ningún modelo lo representa bien, modelo "" y un emoji (se muestra como tarjeta con su nombre). "nombre" de máximo ~45 caracteres. "pista" orienta sin dar la respuesta.
- ordenar: 3 a 6 pasos en el orden correcto, cada uno de máximo ~50 caracteres, con emoji.
- quiz: 4 a 6 preguntas, 2 a 4 opciones cortas (máximo ~60 caracteres), "correcta" es el índice desde 0. Varía la posición de la respuesta correcta.
- entrevista: un personaje (modelo "estudiante") y 4 a 7 preguntas. Las "buenas" son abiertas y sin juzgar, con "respuesta" del personaje (máx. ~110 caracteres) y "hallazgo" corto (lo que aprendimos). Las "malas" (cerradas, que juzgan o que empujan una respuesta) llevan "retro" explicando por qué no sirven. Úsala para empatizar, entrevistar o pedir opiniones.
- lluvia: 6 a 8 ideas con emoji para resolver un problema; exactamente una "correcta" (la que cumple los criterios de "instruccionElegir") y las demás con "retro" amable que reconozca su creatividad y diga qué criterio no cumplen.
- Usa solo modelos y entornos de estos catálogos. Si ningún modelo encaja, usa "" (o una tarjeta con emoji en clasificar). Nunca inventes nombres de modelos.

Modelos 3D disponibles:
${catalogo(MODELOS)}

Entornos disponibles:
${catalogo(ENTORNOS)}

Estilo:
- Lenguaje claro y cálido adecuado al grado indicado; oraciones cortas; vocabulario del español de Ecuador (refrigeradora, guineo/banano, llave de agua) y ejemplos de la vida diaria del país cuando aporten.
- Contenido científicamente correcto y alineado al currículo ecuatoriano del subnivel. No incluyas nada que asuste o que no sea apropiado para niños.
- Los campos opcionales que no uses van como "" (cadena vacía).
- "id": minúsculas-con-guiones, derivado del tema.

Esta es una lección ya aprobada por el equipo docente; imita su nivel de calidad, tono y ritmo (no su tema):
${ejemplo}`;

function pedido() {
  const partes = [
    `Tema de clase: ${op.tema}`,
    `Grado: ${op.grado}`,
    op.materia && `Materia: ${op.materia}`,
    `Idioma de la lección: ${op.idioma === 'en' ? 'inglés (en)' : 'español (es)'}`,
    `Duración objetivo: ${op.minutos} minutos`,
    `Narración por voz: ${op.narracion ? 'sí (narracion: true)' : 'no (narracion: false)'}`,
    op.notas && `Indicaciones del docente: ${op.notas}`,
  ];
  return partes.filter(Boolean).join('\n');
}

if (op['solo-prompt']) {
  console.log(`${SISTEMA}\n\n──────── Pedido ────────\n${pedido()}`);
  process.exit(0);
}

// ── Llamada a Claude con validación y reintentos ──────────────────────────
const client = new Anthropic();

async function generar() {
  const mensajes = [{ role: 'user', content: pedido() }];

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    console.log(`Generando lección (intento ${intento} de ${MAX_INTENTOS})…`);
    const respuesta = await client.beta.messages
      .stream({
        model: MODELO_IA,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: ESQUEMA } },
        system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
        messages: mensajes,
      })
      .finalMessage();

    if (respuesta.stop_reason === 'refusal') {
      throw new Error(`El modelo declinó generar esta lección (${respuesta.stop_details?.category ?? 'sin categoría'}). Reformula el tema.`);
    }
    if (respuesta.stop_reason === 'max_tokens') {
      throw new Error('La respuesta se cortó por longitud. Pide menos escenas o una duración menor.');
    }

    const bloque = respuesta.content.find((b) => b.type === 'text');
    let leccion;
    let errores;
    try {
      leccion = limpiar(JSON.parse(bloque?.text ?? ''));
      errores = validarLeccion(leccion);
    } catch (e) {
      errores = [`El JSON no se pudo leer: ${e.message}`];
    }
    if (errores.length === 0) return leccion;

    console.log(`  La lección tiene ${errores.length} problema(s); se pide corrección:\n  - ${errores.slice(0, 10).join('\n  - ')}`);
    mensajes.push({ role: 'assistant', content: respuesta.content });
    mensajes.push({
      role: 'user',
      content: `El validador del motor encontró estos problemas. Devuelve la lección completa corregida:\n- ${errores.join('\n- ')}`,
    });
  }
  throw new Error(`No se obtuvo una lección válida después de ${MAX_INTENTOS} intentos.`);
}

function guardar(leccion) {
  let id = leccion.id;
  for (let n = 2; existsSync(new URL(`${id}.json`, carpeta)); n++) id = `${leccion.id}-${n}`;
  leccion.id = id;
  writeFileSync(new URL(`${id}.json`, carpeta), `${JSON.stringify(leccion, null, 2)}\n`);

  const rutaIndice = new URL('index.json', carpeta);
  const indice = JSON.parse(readFileSync(rutaIndice, 'utf8'));
  const { titulo, materia, grado, duracionMinutos, idioma, emoji } = leccion;
  indice.push({ id, titulo, materia, grado, duracionMinutos, idioma, emoji });
  writeFileSync(rutaIndice, `${JSON.stringify(indice, null, 2)}\n`);
  return id;
}

try {
  const leccion = await generar();
  const id = guardar(leccion);
  console.log(`\n✓ Lección creada: public/lecciones/${id}.json (${leccion.escenas.length} escenas)`);
  console.log(`  Ábrela en: https://<IP-de-tu-PC>:5173/?leccion=${id}`);
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError) {
    console.error('Credenciales inválidas. Configura ANTHROPIC_API_KEY o ejecuta `ant auth login`.');
  } else if (e instanceof Anthropic.RateLimitError) {
    console.error('Límite de uso alcanzado. Espera un momento y vuelve a intentar.');
  } else if (e instanceof Anthropic.BadRequestError) {
    console.error(`La API rechazó la solicitud: ${e.message}`);
  } else if (e instanceof Anthropic.APIError) {
    console.error(`Error de la API (${e.status}): ${e.message}`);
  } else {
    console.error(e.message ?? e);
  }
  process.exit(1);
}
