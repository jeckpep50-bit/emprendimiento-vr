// Genera las voces de los personajes de las lecciones que tienen "voces" (con las
// voces de Windows) y las guarda como MP3 en public/<voces.carpeta>/<clave>.mp3.
// Cada personaje se distingue con su tono y velocidad (prosodia SSML), p. ej.
// Camila (niña de 7 años) suena más aguda que la profesora.
// Uso: npm run voces                         (todas las lecciones, solo lo nuevo)
//      npm run voces -- <id-de-leccion>      (una lección)
//      npm run voces -- --forzar             (regenerar todo)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Mp3Encoder } from '@breezystack/lamejs';
import { lineasDeVoz, textoHablado } from '../src/leccion/voces.js';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const LECCIONES = path.join(RAIZ, 'public', 'lecciones');
const MUESTREO = 22050;
const VOZ_POR_DEFECTO = { voz: 'Microsoft Sabina Desktop', idioma: 'es-MX', tono: '+0%', velocidad: '-5%' };

const argumentos = process.argv.slice(2);
const forzar = argumentos.includes('--forzar');
const soloId = argumentos.find((a) => !a.startsWith('--'));

const escaparXml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lee las muestras PCM de 16 bits de un WAV (busca el bloque "data"). */
function leerWav(archivo) {
  const b = fs.readFileSync(archivo);
  let p = 12;
  while (p < b.length - 8) {
    const nombre = b.toString('ascii', p, p + 4);
    const tam = b.readUInt32LE(p + 4);
    if (nombre === 'data') {
      const copia = Buffer.from(b.subarray(p + 8, p + 8 + tam));
      return new Int16Array(copia.buffer, copia.byteOffset, Math.floor(copia.length / 2));
    }
    p += 8 + tam + (tam % 2);
  }
  throw new Error(`WAV sin datos: ${archivo}`);
}

/** Quita el silencio de los bordes y lleva el volumen a un nivel parejo. */
function preparar(pcm) {
  const umbral = 600;
  let a = 0;
  let b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < umbral) a++;
  while (b > a && Math.abs(pcm[b]) < umbral) b--;
  const margen = Math.round(MUESTREO * 0.03);
  const recorte = pcm.subarray(Math.max(0, a - margen), Math.min(pcm.length, b + margen));
  let suma = 0;
  for (const v of recorte) suma += v * v;
  const rms = Math.sqrt(suma / Math.max(1, recorte.length));
  const ganancia = rms > 0 ? Math.min(3, 3600 / rms) : 1;
  return Int16Array.from(recorte, (v) => Math.max(-32767, Math.min(32767, Math.round(v * ganancia))));
}

function codificarMp3(pcm) {
  const codificador = new Mp3Encoder(1, MUESTREO, 40);
  const bloques = [];
  for (let i = 0; i < pcm.length; i += 1152) bloques.push(codificador.encodeBuffer(pcm.subarray(i, i + 1152)));
  bloques.push(codificador.flush());
  return Buffer.concat(bloques.map((x) => Buffer.from(x.buffer, x.byteOffset, x.length)));
}

function sintetizar(pendientes, temporal) {
  const ps1 = path.join(temporal, 'voz.ps1');
  fs.writeFileSync(
    ps1,
    `param([string]$entrada)
Add-Type -AssemblyName System.Speech
$lista = Get-Content -Raw -Encoding UTF8 $entrada | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${MUESTREO}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($l in $lista) {
  $s.SelectVoice($l.voz)
  $s.SetOutputToWaveFile($l.wav, $fmt)
  $s.SpeakSsml($l.ssml)
  $s.SetOutputToNull()
}
$s.Dispose()
`,
    'utf8',
  );
  const lista = path.join(temporal, 'lista.json');
  fs.writeFileSync(lista, JSON.stringify(pendientes.map(({ wav, ssml, voz }) => ({ wav, ssml, voz }))), 'utf8');
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-entrada', lista], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}

function generarLeccion(leccion) {
  const salida = path.join(RAIZ, 'public', leccion.voces.carpeta);
  const archivoManifiesto = path.join(salida, 'manifiesto.json');
  fs.mkdirSync(salida, { recursive: true });
  const manifiesto = fs.existsSync(archivoManifiesto) ? JSON.parse(fs.readFileSync(archivoManifiesto, 'utf8')) : {};
  const lineas = lineasDeVoz(leccion);
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'voces-'));

  const pendientes = lineas
    .filter((l) => forzar || !manifiesto[l.clave] || !fs.existsSync(path.join(salida, `${l.clave}.mp3`)))
    .map((l) => {
      const p = { ...VOZ_POR_DEFECTO, ...leccion.voces.personajes?.[l.quien] };
      const texto = escaparXml(textoHablado(l.texto));
      return {
        ...l,
        voz: p.voz,
        wav: path.join(temporal, `${l.clave}.wav`),
        ssml: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${p.idioma}"><prosody pitch="${p.tono}" rate="${p.velocidad}">${texto}</prosody></speak>`,
      };
    });

  if (pendientes.length) {
    console.log(`${leccion.id}: generando ${pendientes.length} de ${lineas.length} voces...`);
    sintetizar(pendientes, temporal);
    for (const l of pendientes) {
      const voz = preparar(leerWav(l.wav));
      const pcm = new Int16Array(voz.length + Math.round(MUESTREO * 0.06));
      pcm.set(voz);
      fs.writeFileSync(path.join(salida, `${l.clave}.mp3`), codificarMp3(pcm));
      manifiesto[l.clave] = { quien: l.quien, texto: l.texto, seg: Math.round((pcm.length / MUESTREO) * 100) / 100 };
    }
  }
  // Se quitan las líneas que ya no están en la lección.
  const vigentes = new Set(lineas.map((l) => l.clave));
  for (const clave of Object.keys(manifiesto)) {
    if (!vigentes.has(clave)) {
      delete manifiesto[clave];
      fs.rmSync(path.join(salida, `${clave}.mp3`), { force: true });
    }
  }
  fs.writeFileSync(archivoManifiesto, JSON.stringify(manifiesto, null, 1) + '\n');
  fs.rmSync(temporal, { recursive: true, force: true });
  const segundos = Object.values(manifiesto).reduce((s, x) => s + x.seg, 0);
  const bytes = fs.readdirSync(salida).reduce((s, f) => s + fs.statSync(path.join(salida, f)).size, 0);
  console.log(`✓ ${leccion.id}: ${Object.keys(manifiesto).length} voces · ${Math.floor(segundos / 60)} min ${Math.round(segundos % 60)} s · ${(bytes / 1024).toFixed(0)} KB`);
}

const archivos = fs.readdirSync(LECCIONES).filter((f) => f.endsWith('.json') && f !== 'index.json');
let hechas = 0;
for (const f of archivos) {
  const leccion = JSON.parse(fs.readFileSync(path.join(LECCIONES, f), 'utf8'));
  if (!leccion.voces || (soloId && leccion.id !== soloId)) continue;
  generarLeccion(leccion);
  hechas++;
}
if (!hechas) console.log(soloId ? `No hay una lección "${soloId}" con voces.` : 'Ninguna lección tiene voces.');
