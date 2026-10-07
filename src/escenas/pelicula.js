import { EscenaBase } from './base.js';
import { Director } from '../pelicula/director.js';
import { PELICULAS } from '../pelicula/index.js';

/**
 * Película inmersiva: un video en 3D que avanza solo, con narración, subtítulos,
 * música y momentos para participar. En las Quest se ve en realidad aumentada
 * (el aula real de fondo) cuando la lección tiene "modo": "ar".
 * datos: { titulo, guion: id de la película (ver src/pelicula/index.js) }
 * En la vista previa, ?capitulo=N empieza en ese capítulo.
 */
export class EscenaPelicula extends EscenaBase {
  construir() {
    this.m.app.sinLocomocion = true;
    this.director = new Director(this, PELICULAS[this.datos.guion]);
  }

  iniciar() {
    super.iniciar();
    const capitulo = Number(new URLSearchParams(location.search).get('capitulo') ?? 1);
    this.director.reproducir(Math.max(0, capitulo - 1));
  }

  destruir() {
    this.director.detener();
    this.m.app.sinLocomocion = false;
    super.destruir();
  }
}
