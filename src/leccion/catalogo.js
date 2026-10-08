// Catálogo de lo que el motor sabe dibujar. Lo usan el validador, el generador
// con IA (para no inventar modelos que no existen) y el propio motor.
// Este archivo no importa three.js para poder usarse también desde Node.

export const MODELOS = {
  // Microbios (se muestran "gigantes", con carita). Admiten `caracter` y `color`.
  coco: 'Bacteria redonda (coco).',
  estafilococo: 'Racimo de bacterias redondas, como uvas (estafilococo; vive en la piel y la nariz).',
  estreptococo: 'Cadena de bacterias redondas (estreptococo).',
  bacilo: 'Bacteria con forma de bastón (bacilo, p. ej. E. coli).',
  salmonela: 'Bacilo con muchos flagelos (Salmonela; huevos y pollo mal cocinados).',
  espirilo: 'Bacteria en espiral (espirilo).',
  virus: 'Virus con espículas (p. ej. norovirus, hepatitis A).',
  moho: 'Hongo moho: pelusa con esporas (aparece en pan y fruta viejos).',
  levadura: 'Levadura: hongo amigo que hace crecer el pan.',
  lactobacilo: 'Lactobacilo: bacteria amiga que convierte la leche en yogur.',
  protozoo: 'Protozoo/ameba: parásito del agua sin hervir.',
  celula: 'Célula animal genérica con núcleo.',
  // Alimentos
  manzana: 'Manzana fresca.',
  manzana_podrida: 'Manzana podrida con manchas y moho.',
  banano: 'Banano (guineo).',
  naranja: 'Naranja.',
  zanahoria: 'Zanahoria.',
  pan: 'Pan fresco.',
  pan_con_moho: 'Pan con manchas de moho verde.',
  leche: 'Cartón de leche.',
  queso: 'Trozo de queso.',
  yogur: 'Vaso de yogur.',
  huevo: 'Huevo.',
  carne_cruda: 'Filete de carne cruda.',
  pollo_crudo: 'Presa de pollo cruda.',
  pescado: 'Pescado.',
  sandwich: 'Sánduche.',
  plato_comida: 'Plato de comida servido (arroz, carne, ensalada). Opción `moscas: true` para mostrarlo destapado con moscas.',
  vaso_agua: 'Vaso de agua limpia.',
  agua_sucia: 'Vaso de agua turbia sin hervir.',
  jugo: 'Vaso de jugo (color configurable).',
  // Objetos
  mosca: 'Mosca (transporta microbios).',
  jabon: 'Barra de jabón con burbujas.',
  gel_antibacterial: 'Botella de gel antibacterial.',
  toalla: 'Toalla doblada.',
  lavamanos: 'Lavamanos con grifo.',
  refrigeradora: 'Refrigeradora.',
  basurero: 'Basurero con tapa.',
  recipiente_tapado: 'Recipiente con tapa para guardar comida.',
  olla: 'Olla con vapor (cocinar bien los alimentos).',
  mano_sucia: 'Mano con manchas de microbios.',
  mano_limpia: 'Mano limpia y brillante.',
  lupa: 'Lupa.',
  microscopio: 'Microscopio.',
  termometro: 'Termómetro.',
  cepillo_dientes: 'Cepillo de dientes.',
  planta: 'Planta en maceta.',
  sol: 'Sol sonriente.',
  corazon: 'Corazón (símbolo de salud).',
  trofeo: 'Trofeo dorado.',
  estrella: 'Estrella dorada.',
  tarjeta: 'Tarjeta con `texto` y `emoji` (sirve para hábitos, pasos y conceptos sin modelo 3D).',
  // Personas, escuela y Design Thinking
  estudiante: 'Estudiante de tamaño real con uniforme escolar. Opciones: peinado ("colitas" | "corto"), expresion. Ideal como personaje de una entrevista.',
  bebedero: 'Bebedero escolar de pedestal (~1 m). Opción `agua: true` muestra el chorro.',
  bombilla: 'Bombilla encendida (símbolo de Idear).',
  binoculares: 'Binoculares (observar, Empatizar).',
  pieza_rompecabezas: 'Pieza de rompecabezas con la palabra PROBLEMA (Definir).',
  nota_adhesiva: 'Nota adhesiva (post-it). Opción `color`.',
  caja_carton: 'Caja de cartón abierta (prototipar con material reciclado).',
  botella_plastica: 'Botella plástica reciclada.',
  cinta_adhesiva: 'Rollo de cinta adhesiva.',
  maqueta_escalon: 'Maqueta de un escalón hecho con caja y botellas recicladas. Opción `etapa` 1..5 para verla a medio construir.',
  portapapeles: 'Portapapeles con lista de chequeo (Testear).',
  lapiz: 'Lápiz.',
  globo_dialogo: 'Globo de diálogo con signo de pregunta (hacer preguntas).',
  // Cocina avanzada y laboratorio
  tabla_picar: 'Tabla de picar. Opción `color` (p. ej. roja para carnes crudas, verde para verduras).',
  esponja: 'Esponja de cocina (uno de los lugares con más bacterias de una cocina).',
  celular: 'Teléfono celular.',
  mazorca_cacao: 'Mazorca de cacao ecuatoriano. Opción `abierta: true` muestra las pepas.',
  frasco_conserva: 'Frasco de conserva o encurtido en vinagre. Opción `color`.',
  lata: 'Lata de conserva. Opción `abombada: true` (señal de peligro: botulismo).',
  placa_petri: 'Placa de Petri con colonias de microbios.',
  torta: 'Torta de cumpleaños.',
  frasco_mayonesa: 'Frasco de mayonesa casera.',
  tubo_ensayo: 'Tubo de ensayo con líquido de color. Opción `color`.',
  // Mercado, planta procesadora y cuerpo humano
  hamburguesa: 'Hamburguesa. Opción `cruda: true`: la carne está rosada (mal cocinada).',
  balde: 'Balde plástico con agua. Opción `sucia: true`: agua turbia.',
  canasta_frutas: 'Canasta de mimbre con frutas sanas.',
  hielera: 'Hielera abierta con pescado y camarones sobre hielo.',
  huevo_roto: 'Huevo trizado (las bacterias pueden entrar).',
  cuchillo: 'Cuchillo de cocina. Opción `sucio: true`: con restos de carne cruda.',
  vendedor: 'Persona adulta de tamaño real con delantal (vendedor o cocinero). Opciones: camisa, delantal, piel, cabello, gorro ("sombrero" | "gorra" | "ninguno"), expresion.',
  globulo_blanco: 'Glóbulo blanco: célula de defensa del cuerpo.',
  globulo_rojo: 'Glóbulo rojo (disco rojo).',
  // Personas articuladas y el recreo (Design Thinking de 7.º)
  persona:
    'Persona articulada de tamaño real (brazos, piernas y boca que se mueve al hablar). Opciones: edad ("nino" | "adulto"), estatura, peinado ("colitas" | "corto" | "cola" | "mono" | "largo"), piel, cabello, superior, inferior, falda (bool), cuello, delantal, mochila, lentes, gorra, expresion.',
  bebedero_doble: 'Bebedero doble de pared, alto (borde a 1,08 m): hecho a la medida de los estudiantes grandes.',
  ladrillo: 'Ladrillo suelto (inestable para pararse encima).',
  mochila: 'Mochila escolar. Opciones: color, abierta (bool), botella (bool).',
  trapeador: 'Trapeador (palo y mopa).',
  balon: 'Balón de fútbol.',
  charco: 'Charco de agua en el piso.',
  periodico: 'Pila de papel periódico.',
  frasco_vidrio: 'Frasco de vidrio.',
  clavos: 'Caja de clavos.',
  tapete_caucho: 'Rollo de caucho antideslizante.',
  pintura: 'Tarros de pintura de colores con brocha.',
  plastico_liso: 'Láminas de plástico liso y resbaloso.',
};

export const ENTORNOS = {
  aula: 'Salón de clases luminoso con pizarra.',
  cocina: 'Cocina con mesón, refrigeradora y ventana.',
  microscopico: 'Mundo microscópico: fondo azul profundo con burbujas flotando.',
  lavabo: 'Baño con lavamanos, espejo y azulejos.',
  naturaleza: 'Prado al aire libre con árboles y cielo.',
  espacio: 'Espacio exterior con estrellas.',
  taller: 'Laboratorio de innovación: pizarra con las 5 fases del Design Thinking, muro de notas adhesivas y estantes con material reciclado.',
  laboratorio: 'Laboratorio de microbiología futurista: mesones con microscopios, pantallas animadas y un proyector holográfico de microbios.',
  patio: 'Patio de una escuela ecuatoriana: bebedero al frente, cancha, bancas, edificio escolar, bandera del Ecuador y volcanes al fondo.',
  recreo: 'El mismo patio a la hora del recreo (sin bebedero fijo: lo pone la escena), con rayuela, tienda escolar y sol de mediodía de Quito. Lo usa la escena "observacion" con escenario "recreo".',
  mercado: 'Mercado ecuatoriano con 4 puestos bajo toldos alrededor del usuario: frutas (al frente, mesón en z = -2,6), carnes y mariscos (izquierda, x = -2,6), comidas y jugos (derecha, x = 2,6) y lácteos y abarrotes (atrás, z = 2,4). Los mesones miden 0,9 m de alto.',
  planta: 'Planta procesadora de alimentos: nave industrial con tanques, tuberías, robot empacador y luces de seguridad.',
  ninguno: 'Sin decorado (lo pone la propia escena; p. ej. una película en realidad aumentada).',
  cuerpo: 'Interior del cuerpo humano en cuatro zonas: boca, estómago (lago de ácido), intestino (vellosidades y microbiota) y vaso sanguíneo (glóbulos rojos). Lo usa la escena "viaje".',
};

export const TIPOS_ESCENA = {
  narrativa: 'Paneles de texto que se avanzan con "Siguiente", opcionalmente con un modelo 3D girando al lado.',
  exploracion: 'Modelos flotando alrededor; el estudiante los toca para descubrir un dato de cada uno.',
  clasificar: 'El estudiante arrastra cada elemento a la caja (categoría) correcta.',
  ordenar: 'El estudiante toca tarjetas en el orden correcto de una secuencia.',
  quiz: 'Preguntas de opción múltiple con retroalimentación inmediata.',
  entrevista: 'Conversación con un personaje de tamaño real: el estudiante elige preguntas; las buenas revelan hallazgos y las malas reciben una explicación.',
  simulacion: 'Simulador de crecimiento bacteriano: el estudiante predice cuántas bacterias habrá según temperatura y tiempo, y lo comprueba en una placa de Petri.',
  atrapar: 'Minijuego arcade: microbios vuelan hacia un alimento y el estudiante dispara a los dañinos sin tocar a los amigos. Campos: duracion (s), vidas, meta, objetivo { modelo }, malos [modelos], buenos [modelos].',
  linterna: 'Linterna UV: escena a oscuras; al iluminar cada objeto se revelan microbios escondidos y un dato (mismos campos que exploracion).',
  inspeccion: 'Inspección sanitaria: objetos repartidos alrededor (hay que girar y moverse). Al tocar uno, se acerca y el estudiante elige qué clave (categoría) se incumple o si todo está bien. Campos: categorias [{ id, nombre, emoji, color }], elementos [{ modelo, posicion [x,y,z], nombre, categoria (id o "ok"), texto, pista?, acompanantes?, moscas? }].',
  cinta: 'Control de calidad en una banda transportadora: los productos avanzan y el estudiante dispara a los que NO son seguros; los buenos se dejan pasar. Campos: hoy (fecha), vidas, productos [{ modelo, nombre, etiqueta, apto, explicacion }].',
  viaje: 'Viaje por el cuerpo humano (entorno cuerpo): paradas en boca, estómago, intestino y defensas; en cada una hay una acción interactiva y una pregunta. Campos: estaciones [{ zona, nombre, texto, tarea, pregunta, opciones, correcta, explicacion }].',
  caos: 'Minijuego contra reloj: aparecen problemas alrededor del estudiante y debe tocar cada uno y elegir la clave (categoría) que lo soluciona antes de que se acabe su tiempo. Campos: categorias, incidentes [{ modelo, nombre, categoria, explicacion, resuelto? }], duracion, vidas, meta.',
  pelicula: 'Película inmersiva que avanza sola (narración, subtítulos, música y momentos para participar). Campo: guion (id de la película, ver PELICULAS_DISPONIBLES).',
  lluvia: 'Lluvia de ideas: al tocar una bombilla salen ideas en notas adhesivas; luego se elige la que cumple los criterios. Con "chispas" hay varias bombillas (técnicas "¿Y si…?") y cada idea dice su chispa; con elegir: false no se elige (se hace en otra actividad).',
  observacion:
    'Observación en una escena viva (escenario "recreo"): marcas 👁️ alrededor del estudiante; al tocar una decide si lo que ve es importante para el reto (bitácora) o no. Campos: escenario, observaciones [{ lugar, texto, corto?, relevante, explicacion, pista? }], frases { clave: { quien, texto } }.',
  frase: 'Armar una frase por partes eligiendo la opción correcta de cada parte (p. ej. el reto: QUIÉN · NECESITA · PORQUE) y, opcionalmente, la mejor pregunta "¿Cómo podríamos…?". Campos: partes [{ etiqueta, opciones [{ texto, correcta, retro }] }], pregunta? { instruccion, opciones }.',
  matriz: 'Matriz de decisión: ideas (filas) × criterios (columnas); el estudiante marca ✅/❌ en cada casilla y comprueba. Campos: criterios [{ texto, emoji? }], ideas [{ texto, emoji?, cumple [bool], porque [texto] }].',
  prototipo:
    'Taller de prototipo: (1) elegir en un estante los materiales que sirven; (2) probar alturas del escalón en una simulación a tamaño real con Camila frente al bebedero. Campos: materiales [{ modelo, nombre, sirve, explicacion, pista? }], instruccionMedida, medidas [{ texto, alto, correcta, explicacion }], frases? { logro }.',
};

/** Escenarios vivos de la escena "observacion". */
export const ESCENARIOS_OBSERVACION = ['recreo'];
/** Lugares del escenario "recreo" donde pueden ir las marcas 👁️. */
export const LUGARES_RECREO = ['puntitas', 'mojada', 'grande', 'mateo', 'charco', 'banca', 'mochila', 'sol', 'futbol', 'bandera', 'cuerda', 'rayuela'];

export const PELICULAS_DISPONIBLES = ['tipos-de-suelo'];
export const MODOS = ['vr', 'ar'];
export const IDIOMAS = ['es', 'en'];
export const CARACTERES = ['bueno', 'malo', 'neutral'];
export const EXPRESIONES = ['neutral', 'feliz', 'triste', 'sorpresa', 'bueno', 'malo'];
