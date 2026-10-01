import { html, bool } from '../lib/html.js';
import { favoritas } from '../store.js';
import { funcoesDaTatica, vizinhas } from '../data.js';
import { pad2 } from '../lib/text.js';
import { minimapa } from '../minimapa.js';
import { etiquetasTipo, icone, minhaFuncao, selosSite, seletorDeFuncao } from '../ui.js';
import { blocoRadar, montarRadar } from './radar-leitor.js';

/** Blocos opcionais: só aparecem quando a tática tem esses dados no JSON. */
function extras(t) {
  const blocos = [];
  if (t.granadas?.length) {
    blocos.push(html`<section class="bloco"><h2 class="bloco__titulo">Granadas</h2>
      <ul class="bloco__lista">${t.granadas.map((g) => html`<li>${g}</li>`)}</ul></section>`);
  }
  if (t.ordem?.length) {
    blocos.push(html`<section class="bloco"><h2 class="bloco__titulo">Ordem de execução</h2>
      <ol class="bloco__passos">${t.ordem.map((o) => html`<li>${o}</li>`)}</ol></section>`);
  }
  if (t.radio?.length) {
    blocos.push(html`<section class="bloco"><h2 class="bloco__titulo">Calls de rádio</h2>
      <p class="bloco__chips">${t.radio.map((r) => html`<span class="tag tag--call">${r}</span>`)}</p></section>`);
  }
  if (t.radar?.length) {
    blocos.push(html`<section class="bloco"><h2 class="bloco__titulo">Radar</h2>${t.radar.map(
      (r) => html`<figure class="radar">
        <a href="${r.src}" target="_blank" rel="noopener"><img src="${r.src}" alt="${r.legenda ?? 'Radar com as rotas da tática'}" loading="lazy"></a>
        ${r.legenda ? html`<figcaption>${r.legenda}</figcaption>` : ''}
      </figure>`,
    )}</section>`);
  }
  return blocos;
}

function pager(direcao, t) {
  if (!t) return html`<span></span>`;
  const seta = direcao === 'anterior';
  return html`<a class="pager__item pager__item--${direcao}" href="#/tatica/${t.id}" data-replace>
    <span class="pager__dir">${seta ? icone('chevL', 'ic--inline') : ''}${seta ? 'Anterior' : 'Próxima'}${seta ? '' : icone('chevR', 'ic--inline')}</span>
    <span class="pager__titulo">${pad2(t.numero)} · ${t.titulo}</span>
  </a>`;
}

function ficha(rotulo, texto, classe = '') {
  if (!texto) return '';
  return html`<div class="ficha__item ${classe}"><span class="ficha__rotulo">${rotulo}</span><p class="ficha__texto">${texto}</p></div>`;
}

export function tatica({ index, params }) {
  const t = index.taticasById.get(params.id);
  if (!t) return null; // main mostra "não encontrada"

  const mapa = index.mapasById.get(t.mapa);
  const viz = vizinhas(index, t);
  const fav = favoritas.tem(t.id);
  const minha = minhaFuncao(index);
  const funcoes = funcoesDaTatica(index, t, minha);

  return {
    titulo: mapa.nome,
    tituloDocumento: `${t.titulo} · ${mapa.nome}`,
    tituloNoCorpo: true,
    voltar: `/mapa/${t.mapa}`,
    aba: 'taticas',
    acoes: html`
      <button type="button" class="icon-btn icon-btn--fav ${fav ? 'is-on' : ''}" data-action="fav" data-id="${t.id}" aria-pressed="${bool(fav)}" aria-label="Favorita">${icone('star')}</button>
      <button type="button" class="icon-btn" data-action="compartilhar" data-id="${t.id}" aria-label="Compartilhar">${icone('share')}</button>`,
    montar: (main) => montarRadar(main, index, t),
    corpo: html`
      <article class="detalhe">
        <header class="detalhe__cab">
          <p class="detalhe__contexto">
            <a class="tag tag--mapa" style="--h:${mapa.matiz ?? 210}" href="#/mapa/${mapa.id}">${mapa.nome}</a>
            <span class="muted">Call <strong class="detalhe__call">${t.chamada}</strong> · ${viz.pos} de ${viz.total}</span>
          </p>
          <h1 class="detalhe__titulo"><span class="detalhe__num">${pad2(t.numero)}</span>${t.titulo}</h1>
          <p class="detalhe__tags">${etiquetasTipo(index, t)}${selosSite(t.alvo)}</p>
        </header>

        <div class="detalhe__grade">
        <div class="detalhe__lado">${minimapa(index, mapa, t, minha)}</div>
        <div class="detalhe__principal">
        <div class="ficha">
          ${ficha('Objetivo', t.objetivo, 'ficha__item--objetivo')}
          ${ficha('Economia', t.economia)}
        </div>

        ${blocoRadar(index, t)}

        ${funcoes.length
          ? html`<section class="secao-funcoes" aria-labelledby="titulo-funcoes">
              <div class="secao-funcoes__cab">
                <h2 class="secao" id="titulo-funcoes">O que cada um faz</h2>
              </div>
              ${seletorDeFuncao(index, minha)}
              <ul class="funcoes">${funcoes.map(
                (f) => html`<li class="funcao ${f.minha ? 'funcao--minha' : ''}">
                  <div class="funcao__cab">
                    <span class="funcao__sigla">${f.sigla}</span>
                    <span class="funcao__nome">${f.nome}</span>
                    ${f.minha ? html`<span class="funcao__voce">Você</span>` : ''}
                  </div>
                  <p class="funcao__texto">${f.texto}</p>
                </li>`,
              )}</ul>
            </section>`
          : ''}

        ${t.posPlant || t.planoB
          ? html`<div class="ficha ficha--saida">
              ${ficha('Pós-plant', t.posPlant)}
              ${ficha('Plano B', t.planoB)}
            </div>`
          : ''}

        ${extras(t)}
        </div>
        </div>
        <nav class="pager" aria-label="Outras táticas do mapa">
          ${pager('anterior', viz.anterior)}${pager('proxima', viz.proxima)}
        </nav>
      </article>`,
  };
}
