import { PanelLienzo, COLORES, rectRedondeado, fuente, escribir, tarjeta } from './lienzo.js';

function aclarar(hex, cantidad) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.min(255, Math.round(v + (255 - v) * cantidad));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/**
 * Botón 3D. Estados: 'normal' | 'correcto' | 'incorrecto' | 'apagado'.
 * Se registra en la entrada desde la escena (EscenaBase.boton).
 */
export function crearBoton({ texto, ancho = 0.42, alto = 0.12, color = COLORES.primario, colorTexto = '#ffffff', tam = null, alinear = 'center' }) {
  const estado = { encima: false, modo: 'normal', texto };
  const boton = new PanelLienzo(ancho, alto, (ctx, w, h) => {
    const colores = {
      normal: color,
      correcto: COLORES.verde,
      incorrecto: COLORES.rojo,
      apagado: '#c9d0e0',
    };
    const base = colores[estado.modo] ?? color;
    const fondo = estado.encima && estado.modo === 'normal' ? aclarar(base, 0.18) : base;
    const radio = Math.min(h / 2, 60);
    rectRedondeado(ctx, 4, 10, w - 8, h - 14, radio);
    ctx.fillStyle = 'rgba(10, 20, 45, 0.3)';
    ctx.fill();
    rectRedondeado(ctx, 4, 4, w - 8, h - 14, radio);
    ctx.fillStyle = fondo;
    ctx.fill();
    if (estado.encima) {
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    const tamTexto = tam ?? Math.min(h * 0.42, 54);
    const esBlanco = estado.modo !== 'normal' || colorTexto === '#ffffff';
    escribir(ctx, estado.texto, alinear === 'center' ? w / 2 : 36, (h - 10) / 2, {
      tam: tamTexto,
      peso: 700,
      color: esBlanco ? '#ffffff' : colorTexto,
      maxAncho: w - 60,
      maxAlto: h - 30,
      alinear,
      base: 'middle',
      interlineado: 1.15,
    });
  });
  boton.estado = estado;
  boton.setEncima = (v) => {
    if (estado.encima === v) return;
    estado.encima = v;
    boton.scale.setScalar(v ? 1.05 : 1);
    boton.redibujar();
  };
  boton.setModo = (modo) => {
    estado.modo = modo;
    boton.redibujar();
  };
  boton.setTexto = (t) => {
    estado.texto = t;
    boton.redibujar();
  };
  return boton;
}

/** Etiqueta pequeña con fondo redondeado (nombres de objetos). */
export function crearEtiqueta(texto, { ancho = 0.34, alto = 0.075, fondo = 'rgba(255, 253, 247, 0.95)', color = COLORES.texto, tam = 34 } = {}) {
  const estado = { texto, fondo, color };
  const etiqueta = new PanelLienzo(ancho, alto, (ctx, w, h) => {
    rectRedondeado(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
    ctx.fillStyle = estado.fondo;
    ctx.fill();
    escribir(ctx, estado.texto, w / 2, h / 2, {
      tam,
      tamMin: 20,
      peso: 700,
      color: estado.color,
      maxAncho: w - 30,
      maxAlto: h - 8,
      alinear: 'center',
      base: 'middle',
      interlineado: 1.1,
    });
  });
  etiqueta.actualizar = (cambios) => {
    Object.assign(estado, cambios);
    etiqueta.redibujar();
  };
  return etiqueta;
}

/**
 * Tarjeta de texto con emoji grande (hábitos, pasos, conceptos).
 * Se usa como "modelo" `tarjeta` dentro de las lecciones.
 */
export function crearTarjetaTexto({ texto = '', emoji = '', ancho = 0.3, alto = 0.22, color = COLORES.primario }) {
  // Más píxeles por metro que un panel normal: estas tarjetas se miran de cerca.
  const k = 1.6;
  return new PanelLienzo(
    ancho,
    alto,
    (ctx, w, h) => {
      tarjeta(ctx, w, h, { borde: color, grosor: 10 * k, radio: 34 * k });
      let y = 26 * k;
      if (emoji) {
        ctx.font = fuente(h * 0.3, 400);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(emoji, w / 2, y);
        y += h * 0.34;
      }
      escribir(ctx, texto, w / 2, emoji ? y + (h - y - 24 * k) / 2 : h / 2, {
        tam: 40 * k,
        tamMin: 26 * k,
        peso: 700,
        maxAncho: w - 44 * k,
        maxAlto: (emoji ? h - y : h) - 34 * k,
        alinear: 'center',
        base: 'middle',
        interlineado: 1.12,
      });
    },
    { pxPorMetro: 1000 * k },
  );
}
