// Genera los audios de narración de una película con la voz en inglés de Windows
// (Microsoft Zira) y los guarda como MP3 en public/<carpeta>/<id>.mp3.
// Uso: npm run narracion            (solo las líneas nuevas o cambiadas)
//      npm run narracion -- --forzar (todas)
// Necesita Windows con la voz "Microsoft Zira Desktop" instalada.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Mp3Encoder } from '@breezystack/lamejs';
import { LINEAS, CARPETA_AUDIO, textoPlano } from '../src/pelicula/guion-suelos.js';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SALIDA = path.join(RAIZ, 'public', CARPETA_AUDIO);
const MANIFIESTO = path.join(SALIDA, 'manifiesto.json');
const MUESTREO = 22050;
// Wiggles se graba más lento: en la app suena 12 % más rápido y más agudo.
const VELOCIDAD = { n: '-12%', w: '-22%' };

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
    wav: path.join(temporal, `${id}.wav`),
    ssml: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody rate="${VELOCIDAD[quien] ?? '-12%'}">${escaparXml(textoPlano(texto).replace(/’/g, "'"))}</prosody></speak>`,
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
$s.SelectVoice('Microsoft Zira Desktop')
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${MUESTREO}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($l in $lista) {
  $s.SetOutputToWaveFile($l.wav, $fmt)
  $s.SpeakSsml($l.ssml)
  $s.SetOutputToNull()
}
$s.Dispose()
`,
  'utf8',
);
const lista = path.join(temporal, 'lista.json');
fs.writeFileSync(lista, JSON.stringify(pendientes.map(({ wav, ssml }) => ({ wav, ssml }))), 'utf8');
const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-entrada', lista], { encoding: 'utf8' });
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

let total = 0;
for (const l of pendientes) {
  const pcm = leerWav(l.wav);
  const codificador = new Mp3Encoder(1, MUESTREO, 40);
  const partes = [];
  for (let i = 0; i < pcm.length; i += 1152) partes.push(codificador.encodeBuffer(pcm.subarray(i, i + 1152)));
  partes.push(codificador.flush());
  const mp3 = Buffer.concat(partes.map((x) => Buffer.from(x.buffer, x.byteOffset, x.length)));
  fs.writeFileSync(path.join(SALIDA, `${l.id}.mp3`), mp3);
  const seg = pcm.length / MUESTREO;
  manifiesto[l.id] = { quien: l.quien, texto: l.texto, seg: Math.round(seg * 100) / 100 };
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
