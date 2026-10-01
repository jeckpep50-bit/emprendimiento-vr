import { App } from './core/app.js';
import { Entrada } from './core/entrada.js';
import { Audio } from './core/audio.js';
import { Efectos } from './core/efectos.js';
import { Locomocion } from './core/locomocion.js';
import { Motor } from './leccion/motor.js';
import { validarLeccion } from './leccion/validar.js';

const $ = (id) => document.getElementById(id);

const app = new App($('escenario'));
const audio = new Audio();
const entrada = new Entrada(app, audio);
const fx = new Efectos(app);
const motor = new Motor({ app, entrada, audio, fx });
const locomocion = new Locomocion(app, entrada, audio, fx);

const parametros = new URLSearchParams(location.search);
let indice = [];
let leccionActual = null;

async function cargarIndice() {
  const r = await fetch('./lecciones/index.json', { cache: 'no-cache' });
  indice = await r.json();
  const lista = $('lista');
  lista.replaceChildren(
    ...indice.map((l) => {
      const b = document.createElement('button');
      b.className = 'leccion';
      b.innerHTML = `<span class="leccion__emoji"></span><span class="leccion__titulo"></span><span class="leccion__meta"></span>`;
      b.children[0].textContent = l.emoji ?? '📘';
      b.children[1].textContent = l.titulo;
      b.children[2].textContent = [l.materia, l.grado, l.duracionMinutos && `${l.duracionMinutos} min`, l.idioma?.toUpperCase()].filter(Boolean).join(' · ');
      b.addEventListener('click', () => abrirLeccion(l.id));
      return b;
    }),
  );
}

async function abrirLeccion(id) {
  const r = await fetch(`./lecciones/${id}.json`, { cache: 'no-cache' });
  const leccion = await r.json();
  const errores = validarLeccion(leccion);
  if (errores.length) {
    console.error('Lección con errores:', errores);
    alert(`La lección "${id}" tiene errores:\n\n${errores.slice(0, 8).join('\n')}`);
    return;
  }
  leccionActual = leccion;
  history.replaceState(null, '', `?leccion=${encodeURIComponent(id)}`);

  $('detalle-emoji').textContent = leccion.emoji ?? '📘';
  $('detalle-meta').textContent = [leccion.materia, leccion.grado, leccion.duracionMinutos && `${leccion.duracionMinutos} minutos`].filter(Boolean).join(' · ');
  $('detalle-titulo').textContent = leccion.titulo;
  $('detalle-descripcion').textContent = leccion.descripcion ?? '';
  $('detalle-objetivos').replaceChildren(
    ...(leccion.objetivos ?? []).map((o) => {
      const li = document.createElement('li');
      li.textContent = o;
      return li;
    }),
  );
  $('lista').hidden = true;
  $('detalle').hidden = false;
}

function volverALista() {
  $('detalle').hidden = true;
  $('lista').hidden = false;
  history.replaceState(null, '', location.pathname);
}

async function empezar(enVR) {
  audio.desbloquear();
  motor.cargar(leccionActual);
  $('portada').hidden = true;
  const inicio = Math.max(0, Number(parametros.get('escena') ?? 1) - 1);
  if (enVR) {
    try {
      await app.entrarVR();
    } catch (e) {
      console.error(e);
      $('portada').hidden = false;
      alert('No se pudo entrar en realidad virtual. Abre esta página en el navegador de las Meta Quest.');
      return;
    }
  } else {
    entrada.habilitarRaton = true;
    app.camara.rotation.set(0, 0, 0);
    app.rig.position.set(0, 0, 0);
    $('ayuda-pantalla').hidden = false;
  }
  motor.irA(Math.min(inicio, leccionActual.escenas.length - 1));
}

function salir() {
  motor.detener();
  entrada.habilitarRaton = false;
  $('ayuda-pantalla').hidden = true;
  $('portada').hidden = false;
}

app.alSalirVR(salir);
$('volver').addEventListener('click', volverALista);
$('btn-vr').addEventListener('click', () => empezar(true));
$('btn-pantalla').addEventListener('click', () => empezar(false));
$('salir-pantalla').addEventListener('click', salir);

(async () => {
  const hayVR = await App.vrDisponible();
  $('btn-vr').disabled = !hayVR;
  if (!hayVR) {
    $('aviso-vr').hidden = false;
    $('aviso-vr').textContent = window.isSecureContext
      ? 'Para la experiencia inmersiva abre esta página en el navegador de las Meta Quest. En el computador puedes usar la vista previa.'
      : 'La realidad virtual necesita HTTPS. Abre la dirección que empieza con https://';
  }
  await cargarIndice();
  const id = parametros.get('leccion') ?? (indice.length === 1 ? indice[0].id : null);
  if (id) await abrirLeccion(id);
})();

// Acceso para depurar desde la consola del navegador.
window.aula = { app, motor, entrada, audio, fx, locomocion };
