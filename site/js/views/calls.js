import { html } from '../lib/html.js';
import { acoesPadrao, icone, mapaAtual } from '../ui.js';

/** Vocabulário de chamadas curtas do IGL (pág. 12–13 do PDF). */
export function calls({ index }) {
  const mapa = index.mapasById.get(mapaAtual(index));

  const itens = index.calls.map((c) => {
    const tipo = c.tipo ? index.tiposById.get(c.tipo) : null;
    const atalho =
      tipo && mapa
        ? html`<a class="link" href="#/mapa/${mapa.id}?tipo=${tipo.id}">Ver ${tipo.nome} no ${mapa.nome}${icone('chevR', 'ic--inline')}</a>`
        : '';
    return html`<li class="call">
      <p class="call__termo">${c.termo}</p>
      <p class="call__significado">${c.significado}</p>
      ${atalho}
    </li>`;
  });

  return {
    titulo: 'Calls',
    aba: 'calls',
    acoes: acoesPadrao(),
    corpo: html`
      <p class="intro">Chamadas curtas para o IGL usar no rádio durante a partida.</p>
      <ul class="calls">${itens}</ul>`,
  };
}
