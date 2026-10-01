import { html } from '../lib/html.js';
import { store } from '../store.js';
import { mapas } from './mapas.js';

export { mapas } from './mapas.js';
export { mapa } from './mapa.js';
export { tatica } from './tatica.js';
export { chamar, situacao } from './chamar.js';
export { calls } from './calls.js';
export { favoritas } from './favoritas.js';
export { buscarTela as buscar } from './buscar.js';
export { ajustes } from './ajustes.js';

/** Abre direto no mapa da partida; na primeira vez, mostra o seletor de mapas. */
export function home(ctx) {
  const id = store.get('mapa');
  return ctx.index.mapasById.has(id) ? { redirect: `/mapa/${id}` } : mapas(ctx);
}

export function naoEncontrada() {
  return {
    titulo: 'Não encontrada',
    tituloNoCorpo: true,
    voltar: '/',
    corpo: html`<section class="vazio">
      <h1 class="vazio__titulo">Não encontramos essa página</h1>
      <p class="vazio__texto">O link pode estar desatualizado ou a tática saiu do playbook.</p>
      <a class="btn btn--primario" href="#/mapas">Ver mapas</a>
    </section>`,
  };
}
