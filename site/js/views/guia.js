import { html, bool } from '../lib/html.js';
import { acoesPadrao, etiquetaTipo, icone, mapaAtual, minhaFuncao } from '../ui.js';

/** Guia do playbook: como usar, funções fixas do time, tipos de tática e regras gerais (pág. 2 do PDF). */
export function guia({ index }) {
  const meta = index.meta;
  const minha = minhaFuncao(index);
  const mapa = index.mapasById.get(mapaAtual(index));

  const funcoes = index.funcoes.map((f) => {
    const eMinha = f.id === minha;
    return html`<li class="funcao ${eMinha ? 'funcao--minha' : ''}">
      <div class="funcao__cab">
        <span class="funcao__sigla">${f.sigla}</span>
        <span class="funcao__nome">${f.nome}</span>
        ${eMinha ? html`<span class="funcao__voce">Você</span>` : ''}
      </div>
      <p class="funcao__texto">${f.descricao}</p>
      <button type="button" class="btn btn--sm" data-action="funcao" data-valor="${f.id}" data-alternar="1" aria-pressed="${bool(eMinha)}">
        ${eMinha ? html`${icone('check')} É a minha função` : 'Essa é a minha função'}
      </button>
    </li>`;
  });

  const tipos = index.tipos.map(
    (t) => html`<li class="guia-tipo">
      ${etiquetaTipo(t)}
      <p class="guia-tipo__desc">${t.descricao}</p>
      ${mapa ? html`<a class="link" href="#/mapa/${mapa.id}?tipo=${t.id}">Ver no ${mapa.nome}${icone('chevR', 'ic--inline')}</a>` : ''}
    </li>`,
  );

  const regras = index.regras.map((r) => html`<li class="regra"><strong>${r.titulo}:</strong> ${r.texto}</li>`);

  return {
    titulo: 'Guia',
    aba: 'guia',
    acoes: acoesPadrao(),
    corpo: html`
      ${meta.comoUsar
        ? html`<details class="sobre"><summary>Como usar este playbook</summary><p>${meta.comoUsar}</p></details>`
        : ''}
      <h2 class="secao">Funções fixas do time</h2>
      <ul class="funcoes">${funcoes}</ul>
      <h2 class="secao">Tipos de tática</h2>
      <ul class="guia-tipos">${tipos}</ul>
      <h2 class="secao">Regras gerais para todo round TR</h2>
      <ul class="regras">${regras}</ul>
      ${meta.pool ? html`<p class="rodape-guia muted">${meta.pool}</p>` : ''}`,
  };
}
