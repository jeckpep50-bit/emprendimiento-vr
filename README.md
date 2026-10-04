# Emprendimiento VR · Design Thinking

Experiencia 100 % inmersiva de **Emprendimiento para 6.º de básica** (Ecuador) en **Meta Quest 2**:
**«Design Thinking: el reto del bebedero»**. Los estudiantes recorren las 5 fases (Empatizar, Definir,
Idear, Prototipar y Testear) ayudando a Camila, una niña de 2.º que no alcanza el bebedero del patio.

Es una app web (WebXR).
No se instala nada en las gafas: se abre una página en el navegador de las Quest y se pulsa
**«Entrar en realidad virtual»**.

Cada tema de clase es un archivo JSON en `public/lecciones/`. El motor lo convierte en una
experiencia con escenas, modelos 3D, sonido espacial y actividades. Las lecciones nuevas se
pueden **generar con IA** a partir del tema.

## Puesta en marcha (PC)

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

La consola muestra dos direcciones: `Local` y `Network` (por ejemplo `https://192.168.1.50:5173`).

- **En las gafas:** abre el navegador de las Quest, escribe la dirección `Network` y acepta el
  aviso del certificado (*Avanzado → Continuar*). Las gafas y el PC deben estar en el mismo Wi-Fi.
  No hace falta activar el modo desarrollador.
- **En el PC:** `npm run dev:local` abre `http://localhost:5174`, con vista previa manejada con el ratón (WASD o flechas para caminar).

Atajos útiles: `?leccion=<id>` abre una lección y `?escena=4` empieza en la escena 4.

## Uso en clase (20 gafas)

La app se publica sola en **GitHub Pages** cada vez que se sube un cambio a `main`
(por ejemplo, una lección nueva). La acción `.github/workflows/pages.yml` valida las lecciones,
compila y publica; en los pull requests solo valida y compila. La dirección es:

**https://jeckpep50-bit.github.io/emprendimiento-vr/**

En cada gafa, abre esa dirección y guárdala en favoritos. La portada muestra las actividades:
**Microorganismos en los alimentos** (5.º EGB), **Detectives de microbios: ciencia de los alimentos** (6.º EGB)
y **Design Thinking: el reto del bebedero** (6.º EGB).
También se puede abrir una directamente con `?leccion=microorganismos-alimentos` o `?leccion=design-thinking-reto-bebedero`.

Si una lección tiene errores, el validador detiene la publicación y la versión anterior sigue en línea.

No hay cuentas ni se guardan datos de los estudiantes. Cada gafa funciona por su cuenta.

## Controles dentro de la VR

- **Mandos:** apunta con el rayo y presiona el **gatillo**. Mantenlo presionado para agarrar y arrastrar.
  El botón lateral también sirve para agarrar.
- **Manos:** junta la punta del **índice** con el **pulgar** (pellizco).
- **Moverse:** empuja la **palanca hacia adelante**, apunta el arco al suelo y suéltala para teletransportarte.
  Empuja la palanca **a los lados** para girar 30°. El movimiento se limita a unos 2 m alrededor de la actividad.
- **Recentrar:** mantén presionado el botón Meta. El contenido se vuelve a colocar delante del estudiante.

El contenido se adapta a la altura de los ojos, así se puede usar de pie o sentado.

## Crear lecciones con IA

```bash
# Necesita una clave de la API de Anthropic
set ANTHROPIC_API_KEY=sk-ant-...        # Windows (cmd)
$env:ANTHROPIC_API_KEY="sk-ant-..."     # Windows (PowerShell)

npm run generar -- --tema "El ciclo del agua" --materia "Ciencias Naturales" --grado "5.º EGB"
npm run generar -- --tema "Parts of a plant" --idioma en --narracion
npm run generar -- --tema "Los sentidos" --notas "Incluir ejemplos de comida ecuatoriana"
```

El generador:

- usa Claude (`claude-opus-5`) con salidas estructuradas;
- solo permite modelos 3D y entornos que el motor sabe dibujar;
- revisa el resultado con el mismo validador del motor y, si encuentra errores, le pide la
  corrección a Claude (hasta 3 intentos);
- guarda la lección en `public/lecciones/` y la agrega a `index.json`.

Tiene activado el respaldo automático del servidor (`fallbacks: "default"`): si el modelo declina
una solicitud, la API la reintenta con otro modelo.

`--solo-prompt` muestra el prompt que se enviaría, sin llamar a la API.

**Revisa siempre una lección generada antes de usarla en clase.** Ábrela con la vista previa del PC
y lee los textos.

## Formato de una lección

```jsonc
{
  "id": "mi-tema",                 // igual que el nombre del archivo
  "titulo": "…", "materia": "…", "grado": "5.º EGB",
  "idioma": "es",                  // "es" | "en"
  "duracionMinutos": 20,
  "narracion": false,              // true = lee los textos en voz alta si las gafas tienen voz
  "objetivos": ["…"],
  "escenas": [
    { "tipo": "narrativa",   "entorno": "aula", "titulo": "…", "pasos": [{ "texto": "…", "emoji": "👋", "modelo": "microscopio" }] },
    { "tipo": "exploracion", "entorno": "microscopico", "titulo": "…", "instruccion": "…",
      "elementos": [{ "modelo": "virus", "nombre": "…", "texto": "…", "etiqueta": "malo" }] },
    { "tipo": "clasificar",  "entorno": "cocina", "titulo": "…",
      "categorias": [{ "id": "si", "nombre": "Seguro", "emoji": "✅" }, { "id": "no", "nombre": "¡Cuidado!" }],
      "elementos": [{ "modelo": "manzana", "nombre": "…", "categoria": "si", "explicacion": "…", "pista": "…" }] },
    { "tipo": "ordenar",     "entorno": "lavabo", "titulo": "…", "pasos": [{ "texto": "…", "emoji": "💧" }] },
    { "tipo": "quiz",        "entorno": "aula", "titulo": "…",
      "preguntas": [{ "pregunta": "…", "opciones": ["…", "…"], "correcta": 0, "explicacion": "…" }] }
  ]
}
```

Actividades adicionales (ver la lección `design-thinking-reto-bebedero.json`):

- `entrevista`: un personaje de tamaño real (`personaje: { nombre, modelo: "estudiante", expresion, posicion }`) y preguntas
  `{ texto, tipo: "buena" | "mala", respuesta, hallazgo, expresion, retro }`. Las buenas llenan el cuaderno de hallazgos.
- `lluvia`: `ideas: [{ texto, emoji, correcta, retro }]` + `instruccionElegir`. Primero se generan tocando la bombilla y luego se elige una.
- `ordenar` con `construccion: { modelo: "maqueta_escalon" }`: el prototipo se arma por etapas en una mesa de trabajo.
- `simulacion`: simulador de crecimiento bacteriano con retos de predicción `{ pregunta, opciones, correcta, explicacion, temperatura, horas, inicial }`.
- `linterna`: linterna UV en una escena a oscuras; mismos campos que `exploracion`.
- En `exploracion`, `holograma: true` muestra el modelo como holograma.
- `utileria` (en cualquier escena): objetos colocados en la escena, p. ej. `{ modelo, posicion: [x, y, z], opciones }`.

- Modelos 3D disponibles y entornos: [`src/leccion/catalogo.js`](src/leccion/catalogo.js).
- `npm run validar` revisa todas las lecciones.

## Estructura del código

| Carpeta | Contenido |
|---|---|
| `src/core/` | Renderizador y sesión WebXR, entrada (mandos, manos y ratón), audio espacial, efectos y textos de la interfaz |
| `src/ui/` | Paneles, botones y tarjetas dibujados en canvas |
| `src/mundo/` | Entornos y modelos 3D generados por código (sin archivos externos) |
| `src/escenas/` | Los 5 tipos de actividad y la pantalla final |
| `src/leccion/` | Motor que reproduce la lección, catálogo y validador |
| `scripts/` | Generador con IA, validador y servidor local |

## Rendimiento en Quest 2

- Los modelos se fusionan en pocas mallas: de 1 a 7 llamadas de dibujo por modelo.
- Las escenas usan entre 12 y 85 llamadas de dibujo y hasta ~60.000 triángulos.
- Tiene *foveated rendering* activado y ninguna sombra en tiempo real.
- Todo se genera por código, así que la app pesa ~200 KB comprimida y carga rápido con 20 gafas en el mismo Wi-Fi.
