import { html } from '../lib/html.js';
import { agruparPorTipo } from '../data.js';
import { favoritas } from '../store.js';
import { acoesPadrao, chipsDeMapas, etiquetaTipo, listaTaticas, mapaAtual } from '../ui.js';

/**
 * "Qual tática chamar?": as táticas do mapa da partida agrupadas pelo tipo de round,
 * com a descrição de cada tipo (a tabela "Tipos de tática" do PDF).
 */
export function chamar({ index }) {
  const mapaId = mapaAtual(index);
  const mapa = index.mapasById.get(mapaId);
  const favs = favoritas.ids();

  const grupos = agruparPorTipo(index, mapaId).map(
    ({ tipo, taticas }) => html`<section class="grupo-tipo">
      <header class="grupo-tipo__cab">
        ${tipo ? etiquetaTipo(tipo) : html`<span class="tag">Outras</span>`}
        ${tipo?.descricao ? html`<p class="grupo-tipo__desc">${tipo.descricao}</p>` : ''}
      </header>
      ${listaTaticas(index, taticas, { favs, ocultarTipo: tipo?.id })}
    </section>`,
  );

  return {
    titulo: 'Qual tática chamar?',
    aba: 'chamar',
    acoes: acoesPadrao(),
    corpo: html`
      <p class="intro">Escolha pelo tipo de round. Aqui estão as táticas do ${mapa.nome}, a do mapa da partida.</p>
      ${chipsDeMapas(index, mapaId, 'botao')}
      ${grupos}`,
  };
}
