import * as THREE from 'three';

// Interfaz dibujada en <canvas> y pegada a un plano 3D. No necesita fuentes
// externas y los emojis funcionan con la fuente del sistema de las Quest.
export const FUENTE = 'system-ui, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';

export const COLORES = {
  tarjeta: '#fffdf7',
  texto: '#23304a',
  suave: '#5b6886',
  primario: '#4f7cff',
  verde: '#2dbe78',
  rojo: '#ff5a5f',
  amarillo: '#ffc23c',
  morado: '#8b5cf6',
  naranja: '#ff9f43',
};

export function fuente(tam, peso = 600) {
  return `${peso} ${Math.round(tam)}px ${FUENTE}`;
}

export function rectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Parte un texto en líneas que caben en `maxAncho` (respeta los saltos de línea). */
export function envolver(ctx, texto, maxAncho) {
  const lineas = [];
  for (const parrafo of String(texto).split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    let linea = '';
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width > maxAncho && linea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    lineas.push(linea);
  }
  return lineas;
}

/**
 * Escribe un texto envuelto. Si no cabe en `maxAlto`, reduce la letra hasta `tamMin`.
 * Devuelve la coordenada y donde terminó.
 */
export function escribir(ctx, texto, x, y, opciones = {}) {
  const {
    tam = 40,
    tamMin = Math.round(tam * 0.7),
    peso = 500,
    color = COLORES.texto,
    maxAncho = 1000,
    maxAlto = Infinity,
    alinear = 'left',
    interlineado = 1.3,
    base = 'top',
  } = opciones;
  let t = tam;
  let lineas;
  for (;;) {
    ctx.font = fuente(t, peso);
    lineas = envolver(ctx, texto, maxAncho);
    if (lineas.length * t * interlineado <= maxAlto || t <= tamMin) break;
    t -= 2;
  }
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'top';
  const alto = lineas.length * t * interlineado;
  let yy = base === 'middle' ? y - alto / 2 : y;
  for (const linea of lineas) {
    ctx.fillText(linea, x, yy + (t * (interlineado - 1)) / 2);
    yy += t * interlineado;
  }
  return yy;
}

export function tarjeta(ctx, w, h, { fondo = COLORES.tarjeta, borde = null, grosor = 8, radio = 40, sombra = true } = {}) {
  const m = grosor / 2 + 4;
  if (sombra) {
    rectRedondeado(ctx, m, m + 6, w - m * 2, h - m * 2, radio);
    ctx.fillStyle = 'rgba(10, 20, 45, 0.25)';
    ctx.fill();
  }
  rectRedondeado(ctx, m, m, w - m * 2, h - m * 2 - 4, radio);
  ctx.fillStyle = fondo;
  ctx.fill();
  if (borde) {
    ctx.lineWidth = grosor;
    ctx.strokeStyle = borde;
    ctx.stroke();
  }
}

export function pastilla(ctx, texto, x, y, { tam = 28, fondo = '#e6ebf8', color = COLORES.texto, peso = 700, relleno = 18 } = {}) {
  ctx.font = fuente(tam, peso);
  const w = ctx.measureText(texto).width + relleno * 2;
  const h = tam * 1.6;
  rectRedondeado(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fondo;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + relleno, y + h / 2 + 1);
  return w;
}

/** Plano 3D con textura de canvas que se puede redibujar. */
export class PanelLienzo extends THREE.Mesh {
  constructor(ancho, alto, dibujar, { pxPorMetro = 1000, maxPx = 2048 } = {}) {
    const escala = Math.min(pxPorMetro, maxPx / Math.max(ancho, alto));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(ancho * escala);
    canvas.height = Math.round(alto * escala);
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    super(
      new THREE.PlaneGeometry(ancho, alto),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.02 }),
    );
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.textura = textura;
    this.dibujar = dibujar;
    this.ancho = ancho;
    this.alto = alto;
    this.redibujar();
  }

  redibujar() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.dibujar(ctx, canvas.width, canvas.height);
    this.textura.needsUpdate = true;
  }
}
