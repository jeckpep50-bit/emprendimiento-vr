// Valida todas las lecciones de public/lecciones y el índice.
// Uso: npm run validar
import { readFileSync, readdirSync } from 'node:fs';
import { validarLeccion } from '../src/leccion/validar.js';

const carpeta = new URL('../public/lecciones/', import.meta.url);
const indice = JSON.parse(readFileSync(new URL('index.json', carpeta), 'utf8'));
const idsIndice = new Set(indice.map((l) => l.id));
let fallos = 0;

for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const leccion = JSON.parse(readFileSync(new URL(archivo, carpeta), 'utf8'));
  const errores = validarLeccion(leccion);
  if (`${leccion.id}.json` !== archivo) errores.push(`id: "${leccion.id}" no coincide con el nombre del archivo`);
  if (!idsIndice.has(leccion.id)) errores.push('no aparece en index.json');
  if (errores.length) {
    fallos++;
    console.log(`✗ ${archivo}\n  - ${errores.join('\n  - ')}`);
  } else {
    console.log(`✓ ${archivo} (${leccion.escenas.length} escenas)`);
  }
}
process.exit(fallos ? 1 : 0);
