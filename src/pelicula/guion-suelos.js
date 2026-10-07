// Guion de la película "Types of Soil" (3.º EGB). Solo datos: lo usan el
// reproductor (subtítulos) y scripts/generar-narracion.mjs (audios con voz).
// quien: "n" = narrador, "w" = Wiggles (el gusano; su voz suena un poco más aguda).
//
// Narración HÍBRIDA para niños con nivel de inglés inicial: las explicaciones e
// instrucciones van en español y lo clave (vocabulario, ideas principales y frases
// cortas del aula) va en inglés. Lo que está entre *asteriscos* se dice en inglés
// (voz en inglés) y se resalta en naranja en los subtítulos; el resto, en español.

export const CARPETA_AUDIO = 'peliculas/types-of-soil';

export const CAPITULOS = [
  { id: 'c1', titulo: 'Hello, Wiggles!', emoji: '🪱' },
  { id: 'c2', titulo: 'What Is Soil?', emoji: '🟫' },
  { id: 'c3', titulo: 'How Is Soil Made?', emoji: '🪨' },
  { id: 'c4', titulo: 'The Layers of Soil', emoji: '🍰' },
  { id: 'c5', titulo: 'Sandy Soil', emoji: '🏖️' },
  { id: 'c6', titulo: 'Clay Soil', emoji: '🏺' },
  { id: 'c7', titulo: 'Loamy Soil', emoji: '🌱' },
  { id: 'c8', titulo: 'The Water Test', emoji: '💧' },
  { id: 'c9', titulo: 'Soil Helpers', emoji: '🐜' },
  { id: 'c10', titulo: 'Soil Quiz and Song', emoji: '🎵' },
];

export const LINEAS = {
  // Títulos de los capítulos
  t1: ['n', 'Parte uno. *Hello, Wiggles!*'],
  t2: ['n', 'Parte dos. *What is soil?* ¿Qué es el suelo?'],
  t3: ['n', 'Parte tres. *How is soil made?* ¿Cómo se forma el suelo?'],
  t4: ['n', 'Parte cuatro. *The layers of soil.* Las capas del suelo.'],
  t5: ['n', 'Parte cinco. *Sandy soil.* El suelo de arena.'],
  t6: ['n', 'Parte seis. *Clay soil.* El suelo de arcilla.'],
  t7: ['n', 'Parte siete. *Loamy soil.* La tierra de cultivo.'],
  t8: ['n', 'Parte ocho. *The water test.* El experimento del agua.'],
  t9: ['n', 'Parte nueve. *Soil helpers.* Los ayudantes del suelo.'],
  t10: ['n', 'Parte diez. *Quiz and song.* Juego y canción.'],

  // 1. Hello, Wiggles!
  c1_1: ['n', '*Hello, friends!* ¡Hola, amigos! Bienvenidos a una aventura muy especial.'],
  c1_2: ['n', '*Look down!* Mira el piso, delante de ti. ¡Algo se está moviendo!'],
  c1_3: ['w', '*Hi! Hello!* ¡Hola! ¿Me ves? *I am Wiggles, the earthworm!* Soy un gusano de tierra.'],
  c1_4: ['w', 'Yo vivo bajo la tierra, en el *soil*. *Soil* significa suelo. ¡El *soil* es mi casa!'],
  c1_5: ['w', '*Wave hello!* ¡Salúdame con tu mano!'],
  c1_6: ['w', '*Hello, hello! Great job!* ¡Muy bien!'],
  c1_7: ['w', 'Hoy vamos a aprender los *types of soil*, los tipos de suelo.'],
  c1_8: ['w', 'Vamos a conocer la *sand*, la arena; la *clay*, la arcilla; y el *loam*, la tierra de cultivo.'],
  c1_9: ['w', '*Say it with me!* Repite conmigo: *soil!*'],
  c1_10: ['w', '*Great job!* ¡Muy bien! *Let’s go!* ¡Vamos!'],
  c1_11: ['w', 'Un consejo: cuando veas un anillo amarillo, apunta y presiona el gatillo para tocarlo. *Touch!*'],
  c1_12: ['w', '*Touch the soil!* Toca los tres montoncitos de tierra.'],
  c1_13: ['w', '*Great!* ¡Ya sabes jugar! Ahora sube conmigo a mi hoja mágica. *Let’s fly!*'],

  // 2. What is soil?
  c2_1: ['n', '*This is soil.* Este es el suelo. El *soil* cubre casi toda la tierra del planeta.'],
  c2_2: ['w', 'El *soil* parece solo tierra, ¡pero tiene muchas cosas adentro!'],
  c2_3: ['w', '*Let’s look inside!* ¡Miremos adentro!'],
  c2_4: ['w', 'Primero: *rocks*, rocas. Pedacitos muy, muy pequeños de roca.'],
  c2_5: ['w', 'Después: hojas viejas y plantas que se pudren. Se vuelven negras y suaves. Esto se llama *humus*.'],
  c2_6: ['w', 'Repite conmigo: *humus!*'],
  c2_7: ['w', 'El suelo tiene *water*, agua. Las plantas beben el agua con sus raíces.'],
  c2_8: ['w', 'El suelo también tiene *air*, aire, en los espacios pequeñitos entre los pedacitos.'],
  c2_9: ['w', '¡Y tiene *living things*, seres vivos, como yo! Gusanos, hormigas y bichitos muy pequeñitos.'],
  c2_10: ['w', '*Touch!* Toca cada cosa para saludarla.'],
  c2_11: ['n', 'Entonces, el *soil* tiene *rocks*, *humus*, *water*, *air* y *living things*.'],
  c2_12: ['w', '¡Contemos con los dedos! *Rocks, one. Humus, two. Water, three. Air, four. Living things, five!*'],
  c2_13: ['w', 'El *soil* es muy importante: las *plants*, las plantas, crecen en el suelo. ¡Y nosotros comemos plantas!'],
  c2_14: ['w', 'Frutas, verduras, arroz y maíz crecen en el suelo. *Fruits and vegetables!* *Yummy!*'],
  c2_15: ['w', 'Mmm... ¿pero de dónde viene el suelo? *Let’s find out!* ¡Descubrámoslo!'],
  c2_16: ['n', 'Las rocas hacen la tierra áspera o suave. El *humus* la hace negra y rica. El agua y el aire ayudan a las raíces a beber y a respirar.'],
  p_rocas: ['w', '*Rocks!*'],
  p_humus: ['w', '*Humus!*'],
  p_agua: ['w', '*Water!*'],
  p_aire: ['w', '*Air!*'],
  p_vida: ['w', '*Living things!*'],

  // 3. How is soil made?
  c3_1: ['n', '*Close your eyes...* cierra los ojos... *and open them!* ¡Ábrelos! Estamos en las montañas.'],
  c3_2: ['w', '¡Guau! Mira esta *rock*, esta roca grande. Es muy vieja y muy dura.'],
  c3_3: ['w', 'En el día, el *sun*, el sol, calienta la roca. *Hot!* ¡Caliente!'],
  c3_4: ['w', 'En la noche, la roca se enfría. *Cold!* ¡Frío! *Hot, cold, hot, cold.* Y aparecen grietas pequeñitas.'],
  c3_5: ['w', 'Luego llega la *rain*, la lluvia. El agua entra en las grietas.'],
  c3_6: ['w', 'Con mucho frío, el agua se vuelve *ice*, hielo. El hielo empuja, empuja y... *crack!*'],
  c3_7: ['w', 'Las *roots*, las raíces de las plantas, también entran en las grietas y empujan la roca.'],
  c3_8: ['w', 'Y el *wind*, el viento, sopla arena contra la roca. Frota, frota y frota.'],
  c3_9: ['w', '*Your turn!* ¡Te toca! Toca la roca para ayudar a romperla.'],
  c3_10: ['w', '¡Mira! La roca grande se rompe en rocas pequeñas, y las pequeñas en pedacitos diminutos.'],
  c3_11: ['n', 'Caen hojas y se pudren. Llegan gusanos y bichitos. Los pedacitos de roca y el *humus* se mezclan.'],
  c3_12: ['n', '¡Y así se forma el *soil*!'],
  c3_13: ['w', 'Pero es muy, muy lento. Se necesitan cientos de años, *hundreds of years*, para hacer un poquito de suelo.'],
  c3_14: ['w', 'Por eso el suelo es un tesoro. *Take care of the soil!* ¡Cuidemos el suelo!'],

  // 4. The layers of soil
  c4_1: ['w', '*Let’s go down!* ¡Vamos debajo de la tierra! Estamos en un ascensor. *Hold on!* ¡Agárrate!'],
  c4_2: ['n', 'El suelo tiene capas, *layers*, como un pastel de chocolate. Mira las paredes a tu alrededor.'],
  c4_3: ['w', 'Esta es la capa de arriba: el *topsoil*. Es oscura y suave.'],
  c4_4: ['w', 'El *topsoil* tiene mucho *humus*. Aquí viven raíces, gusanos y hormigas. ¡Aquí vivo yo!'],
  c4_5: ['w', '*Let’s go down!* Bajemos un poco más.'],
  c4_6: ['w', 'Esta capa es el *subsoil*. Es más clara y tiene más rocas y arcilla.'],
  c4_7: ['w', 'Solo las raíces largas, como las de los árboles, llegan al *subsoil*.'],
  c4_8: ['w', 'Y ahora, hasta el fondo...'],
  c4_9: ['w', '¡Esta es la *bedrock*, la roca madre! Es roca sólida, muy, muy dura. El suelo viene de rocas como esta.'],
  c4_10: ['n', 'Recordemos: *topsoil* arriba, *subsoil* en el medio y *bedrock* abajo.'],
  c4_11: ['w', '*Quiz time!* ¿Qué capa tiene más seres vivos? *Choose!* ¡Elige!'],
  c4_12: ['w', '¡Es el *topsoil*! Tiene raíces, gusanos y mucho *humus*.'],
  c4_13: ['w', 'Ahora subamos para conocer tres *types of soil*. *Let’s go up!*'],
  c4_r1: ['w', 'Repite conmigo: *topsoil!*'],
  c4_r2: ['w', 'Repite conmigo: *subsoil!*'],
  c4_r3: ['w', 'Repite conmigo: *bedrock!*'],

  // 5. Sandy soil
  c5_1: ['n', '*Welcome to the beach!* ¡Bienvenidos a la playa! Aquí está el primer tipo de suelo: el *sandy soil*, el suelo de arena.'],
  c5_2: ['w', 'La *sand* tiene pedacitos grandes de roca llamados *grains*, granos. ¡Mira, los hice gigantes!'],
  c5_3: ['w', 'La arena se siente áspera y seca: *rough and dry*. Repite conmigo: *rough!*'],
  c5_4: ['w', 'Los granos son grandes y dejan espacios grandes entre ellos. *Watch the water!* ¡Mira el agua!'],
  c5_5: ['w', '*Whoosh!* El agua baja muy rápido. El *sandy soil* no guarda el agua.'],
  c5_6: ['n', 'El suelo de arena se seca rápido y tiene poco *humus*. A muchas plantas no les gusta.'],
  c5_7: ['w', '¡Pero a algunas plantas les encanta! Como el *cactus* y la palmera de coco, la *coconut palm*. No necesitan mucha agua.'],
  c5_8: ['w', '*Touch the sand!* Toca los granos y hazlos brillar.'],
  c5_9: ['w', '*Remember: sandy soil is rough and dry.* Recuerda: el suelo de arena es áspero, seco, y el agua pasa rápido.'],
  c5_10: ['w', 'La arena de la playa viene de rocas y conchas que las olas rompen en pedacitos, una y otra vez.'],
  c5_11: ['w', 'Repite conmigo: *sandy soil!*'],

  // 6. Clay soil
  c6_1: ['n', 'Ahora estamos junto a un río. Aquí encontramos el *clay soil*, el suelo de arcilla.'],
  c6_2: ['w', 'La *clay*, la arcilla, tiene pedacitos diminutos. ¡Mucho más pequeños que la arena!'],
  c6_3: ['w', 'Mojada, la arcilla es pegajosa: *sticky!* *Squish, squish!* Y cuando se seca, se pone muy dura.'],
  c6_4: ['w', 'Sus pedacitos están tan juntos que el agua casi no puede pasar. *Watch!* ¡Mira!'],
  c6_5: ['w', '*Splash!* ¡Un charco! El *clay soil* guarda el agua: *it holds water*.'],
  c6_6: ['n', 'Algunas plantas, como el arroz, crecen bien en el suelo de arcilla mojado.'],
  c6_7: ['w', 'Con la *clay* hacemos cosas: ollas, platos y ladrillos para las casas. *Pots and bricks!*'],
  c6_8: ['w', '*Let’s make a pot!* ¡Hagamos una olla! Toca la arcilla.'],
  c6_9: ['w', '*Wow!* ¡Hiciste una olla hermosa!'],
  c6_10: ['w', '*Remember: clay soil is sticky.* Recuerda: el suelo de arcilla es pegajoso y guarda mucha agua.'],
  c6_11: ['w', 'Repite conmigo: *clay soil!*'],
  c6_12: ['n', 'Cuando la arcilla se seca al sol, se agrieta. ¡Mira el suelo a tu alrededor!'],

  // 7. Loamy soil
  c7_1: ['n', 'Nuestra última parada es una granja en las montañas del Ecuador. Aquí está el *loamy soil*, la tierra de cultivo.'],
  c7_2: ['w', '¡El *loam* es mi favorito! Es una mezcla de *sand*, de *clay*, de *silt*, que es un polvito fino, y de mucho *humus*.'],
  c7_3: ['w', 'El *loam* es café oscuro. Es suave: *soft!* Se desmorona como migas de pastel.'],
  c7_4: ['w', 'Guarda la cantidad justa de agua y de aire: ni mucha, ni poca. *Just right!*'],
  c7_5: ['n', 'Por eso a los agricultores les encanta el *loamy soil*. Casi todas las plantas crecen muy bien en él.'],
  c7_6: ['w', 'Maíz, papas, fréjoles, lechuga y muchas frutas crecen en el *loam*. *Yum, yum!*'],
  c7_7: ['w', '*Let’s plant!* ¡Vamos a sembrar! Toca los huequitos para poner las semillas.'],
  c7_8: ['w', '*Look!* ¡Tus semillas están creciendo! *You are a great farmer!* ¡Eres un gran agricultor!'],
  c7_9: ['w', '*Remember: loamy soil is soft.* Recuerda: la tierra de cultivo es oscura, suave y perfecta para las plantas.'],
  c7_10: ['n', '¡En Ecuador los volcanes también ayudan! Hace mucho tiempo, su ceniza cayó sobre la tierra y la hizo muy rica.'],
  c7_11: ['w', 'Por eso en Ecuador hay tantas comidas ricas: maíz, papas, fréjoles, guineos y cacao para el chocolate. *Yummy!*'],
  c7_12: ['w', 'Repite conmigo: *loamy soil!*'],

  // 8. The water test
  c8_1: ['n', 'Volvimos al aula. *Let’s do an experiment!* ¡Hagamos un experimento!'],
  c8_2: ['w', 'Aquí hay tres macetas: una con *sand*, otra con *clay* y otra con *loam*.'],
  c8_3: ['w', 'Vamos a echar la misma cantidad de agua en cada una. El agua que pasa cae al vaso de abajo.'],
  c8_4: ['w', '*Think!* ¡Piensa! ¿En cuál pasará el agua más rápido? *Choose one!* ¡Elige una!'],
  c8_5: ['n', '*Let’s watch!* Miremos con atención.'],
  c8_6: ['w', '¡Mira la *sand*! El agua pasa rapidísimo. ¡El vaso está lleno!'],
  c8_7: ['w', 'El *loam* deja pasar un poco de agua, pero guarda otro poco para las plantas.'],
  c8_8: ['w', '¿Y la *clay*? ¡Solo unas gotitas! La arcilla guarda el agua.'],
  c8_9: ['n', 'Entonces: la *sand* deja pasar el agua rápido, la *clay* la guarda, y el *loam* está *just right*, justo bien.'],

  // 9. Soil helpers
  c9_1: ['w', '¿Sabes quién ayuda al suelo? ¡Yo! Los gusanos somos *soil helpers*, ayudantes del suelo.'],
  c9_2: ['w', 'Yo hago túneles. Por mis túneles entran el aire y el agua.'],
  c9_3: ['w', 'Como hojas viejas, ¡y mi popó hace que el suelo esté sano! *Ha ha!*'],
  c9_4: ['w', 'Las hormigas, los escarabajos y unos bichitos diminutos también ayudan: convierten las hojas en *humus*.'],
  c9_5: ['n', 'Nosotros también podemos ayudar al suelo. *Three ways!* ¡De tres formas!'],
  c9_6: ['w', '*One:* uno, no botes basura al suelo. *Clean up!* Toca la basura para ponerla en el tacho.'],
  c9_7: ['w', '*Thank you!* ¡Gracias! *Clean soil is happy soil!* ¡Suelo limpio, suelo feliz!'],
  c9_8: ['w', '*Two:* dos, siembra árboles y plantas. Sus raíces sujetan el suelo para que la lluvia y el viento no se lo lleven.'],
  c9_9: ['w', '*Three:* tres, haz *compost*, abono: las cáscaras de fruta y las hojas se convierten en *humus* nuevo.'],
  c9_10: ['w', '*You are great soil helpers!* ¡Son grandes ayudantes del suelo!'],
  c9_11: ['w', '¿Quieres saber un secreto? ¡No tengo ojos, ni orejas, ni patas!'],
  c9_12: ['w', 'Respiro por la piel, por eso me gusta la tierra húmeda. ¡Cuando llueve mucho, salgo a la superficie!'],

  // 10. Quiz and song
  c10_1: ['w', '*Let’s play!* ¡Juguemos! Yo describo un suelo y tú eliges el correcto.'],
  c10_2: ['w', 'Es áspero y seco, y el agua pasa muy rápido. *Which soil is it?* ¿Cuál es?'],
  c10_3: ['w', '*It’s sand!* ¡Es la arena!'],
  c10_4: ['w', 'Es pegajoso cuando está mojado y forma charcos. *Which soil is it?* ¿Cuál es?'],
  c10_5: ['w', '*It’s clay!* ¡Es la arcilla!'],
  c10_6: ['w', 'Es oscuro y suave, y es perfecto para las plantas. *Which soil is it?* ¿Cuál es?'],
  c10_7: ['w', '*It’s loam!* ¡Es la tierra de cultivo!'],
  c10_8: ['w', '*Last one!* ¡La última! ¿Cuál de estos NO es parte del suelo?'],
  c10_9: ['w', '¡El *plastic*, el plástico! El plástico es basura y no pertenece al suelo.'],
  c10_10: ['w', '*Let’s sing the soil song!* ¡Cantemos la canción del suelo! *Repeat after me!* Repite después de mí.'],
  c10_11: ['w', '*Sand is rough, and sand is dry!*'],
  c10_12: ['w', '*Clay is sticky, oh my, oh my!*'],
  c10_13: ['w', '*Loam is soft, and loam is just right!*'],
  c10_14: ['w', '*Take care of soil, day and night!*'],
  c10_15: ['w', '*You are amazing soil scientists!* ¡Son unos científicos del suelo increíbles!'],
  c10_16: ['w', 'Recuerda: *take care of the soil*, cuida el suelo, y el suelo te cuidará a ti.'],
  c10_17: ['w', 'Ahora tengo que volver a mi casa. *Bye-bye, friends!* ¡Adiós, amigos! *See you in the garden!*'],
  c10_18: ['n', '*The end!* Fin. *Thank you for watching!* ¡Gracias por ver!'],
  c10_19: ['n', '*Let’s review!* Repasemos lo que aprendimos hoy.'],
  c10_20: ['w', 'El *soil* tiene *rocks*, *humus*, *water*, *air* y *living things*.'],
  c10_21: ['w', 'El suelo tiene capas: *topsoil*, *subsoil* y *bedrock*.'],
  c10_22: ['w', 'Y hay tipos de suelo: *sandy soil*, *clay soil* y *loamy soil*.'],
  c10_23: ['w', '*Wave goodbye!* ¡Dime adiós con tu mano!'],

  // Frases cortas de reacción
  bien_1: ['w', '*Yes! Well done!* ¡Muy bien!'],
  bien_2: ['w', '*Correct! Super!* ¡Correcto!'],
  bien_3: ['w', '*Great job!* ¡Excelente!'],
  intento: ['w', '*Good try!* ¡Buen intento!'],
  wow: ['w', '*Wow!*'],
};

/** Texto sin las marcas de resaltado. */
export function textoPlano(texto) {
  return texto.replace(/\*/g, '');
}

/** Divide una línea en tramos de voz: lo que va entre *asteriscos* es inglés y el resto, español. */
export function tramos(texto) {
  return texto
    .split('*')
    .map((t, i) => ({ idioma: i % 2 ? 'en' : 'es', texto: t.trim() }))
    .filter((t) => /[\p{L}\p{N}]/u.test(t.texto));
}
