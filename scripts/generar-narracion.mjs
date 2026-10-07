// Genera los audios de narración de una película con las voces de Windows y los
// guarda como MP3 en public/<carpeta>/<id>.mp3.
// Narración híbrida: lo que va entre *asteriscos* se dice con la voz en inglés
// (Microsoft Zira) y el resto con la voz en español (Microsoft Sabina). Cada línea
// se arma uniendo sus tramos, sin los silencios de los bordes y con el mismo volumen.
// Uso: npm run narracion            (solo las líneas nuevas o cambiadas)
//      npm run narracion -- --forzar (todas)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Mp3Encoder } from '@breezystack/lamejs';
import { LINEAS, CARPETA_AUDIO, tramos } from '../src/pelicula/guion-suelos.js';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SALIDA = path.join(RAIZ, 'public', CARPETA_AUDIO);
const MANIFIESTO = path.join(SALIDA, 'manifiesto.json');
const MUESTREO = 22050;
const VOCES = { es: 'Microsoft Sabina Desktop', en: 'Microsoft Zira Desktop' };
const LENGUA = { es: 'es-MX', en: 'en-US' };
// Velocidad por idioma y personaje. Wiggles se graba más lento porque en la app
// suena 12 % más rápido y más agudo. El inglés va más pausado para que se entienda.
const VELOCIDAD = { es: { n: '-10%', w: '-18%' }, en: { n: '-18%', w: '-28%' } };
const PAUSA_TRAMOS = 0.16; // segundos entre un tramo y el siguiente

const forzar = process.argv.includes('--forzar');
fs.mkdirSync(SALIDA, { recursive: true });
const manifiesto = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : {};

const escaparXml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'narracion-'));

const pendientes = Object.entries(LINEAS)
  .filter(([id, [quien, texto]]) => forzar || manifiesto[id]?.texto !== texto || manifiesto[id]?.quien !== quien || !fs.existsSync(path.join(SALIDA, `${id}.mp3`)))
  .map(([id, [quien, texto]]) => ({
    id,
    quien,
    texto,
    tramos: tramos(texto).map((t, k) => ({
      ...t,
      wav: path.join(temporal, `${id}_${k}.wav`),
      voz: VOCES[t.idioma],
      ssml: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LENGUA[t.idioma]}"><prosody rate="${VELOCIDAD[t.idioma][quien] ?? '-12%'}">${escaparXml(t.texto.replace(/’/g, "'"))}</prosody></speak>`,
    })),
  }));

if (!pendientes.length) {
  console.log('✓ Todos los audios están al día.');
  process.exit(0);
}
console.log(`Generando ${pendientes.length} audios...`);

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
fs.writeFileSync(lista, JSON.stringify(pendientes.flatMap((l) => l.tramos.map(({ wav, ssml, voz }) => ({ wav, ssml, voz })))), 'utf8');
const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-entrada', lista], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}

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

/** Quita el silencio del principio y del final, y lleva el volumen a un nivel parejo. */
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

let total = 0;
for (const l of pendientes) {
  const silencio = new Int16Array(Math.round(MUESTREO * PAUSA_TRAMOS));
  const partes = [];
  l.tramos.forEach((t, k) => {
    if (k) partes.push(silencio);
    partes.push(preparar(leerWav(t.wav)));
  });
  const n = partes.reduce((s, p) => s + p.length, 0);
  const pcm = new Int16Array(n + Math.round(MUESTREO * 0.08));
  let o = 0;
  for (const p of partes) {
    pcm.set(p, o);
    o += p.length;
  }
  const codificador = new Mp3Encoder(1, MUESTREO, 40);
  const bloques = [];
  for (let i = 0; i < pcm.length; i += 1152) bloques.push(codificador.encodeBuffer(pcm.subarray(i, i + 1152)));
  bloques.push(codificador.flush());
  const mp3 = Buffer.concat(bloques.map((x) => Buffer.from(x.buffer, x.byteOffset, x.length)));
  fs.writeFileSync(path.join(SALIDA, `${l.id}.mp3`), mp3);
  manifiesto[l.id] = { quien: l.quien, texto: l.texto, seg: Math.round((pcm.length / MUESTREO) * 100) / 100 };
  total += mp3.length;
}
// Se quitan del manifiesto (y de la carpeta) las líneas que ya no existen.
for (const id of Object.keys(manifiesto)) {
  if (!(id in LINEAS)) {
    delete manifiesto[id];
    fs.rmSync(path.join(SALIDA, `${id}.mp3`), { force: true });
  }
}
fs.writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 1) + '\n');
fs.rmSync(temporal, { recursive: true, force: true });

const segundos = Object.values(manifiesto).reduce((s, x) => s + x.seg, 0);
console.log(`✓ ${pendientes.length} audios (${(total / 1024).toFixed(0)} KB). Narración total: ${Math.floor(segundos / 60)} min ${Math.round(segundos % 60)} s.`);
