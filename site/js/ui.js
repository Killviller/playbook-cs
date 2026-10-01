// Componentes de interface compartilhados pelas telas.
import { html, raw, bool } from './lib/html.js';
import { pad2, separarContagem, ehObjetivo } from './lib/text.js';
import { store } from './store.js';
import { pwa } from './pwa.js';

// Ícones desenhados em traço (24×24), herdam a cor do texto.
const ICONES = {
  map: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  call: '<path d="M3 10v4a1 1 0 0 0 1 1h2.5L12 19V5L6.5 9H4a1 1 0 0 0-1 1z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6a8 8 0 0 1 0 12"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  share: '<path d="M12 15V3.5M8 7l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4.5h11l-2 3.5 2 3.5H5"/>',
  download: '<path d="M12 4v11M8 11.5l4 4 4-4M5 20h14"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.2 5.6"/><path d="M20 5v6h-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5h6V7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export function icone(nome, classe = '') {
  return raw(
    `<svg class="ic ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES[nome]}</svg>`,
  );
}

/** Mapa escolhido para a partida; se não houver (ou sair do pool), o primeiro ativo. */
export function mapaAtual(index) {
  const id = store.get('mapa');
  return index.mapasById.has(id) ? id : (index.mapas[0]?.id ?? null);
}

export const acoesPadrao = () => html`
  <a class="icon-btn" href="#/buscar" aria-label="Buscar">${icone('search')}</a>
  <a class="icon-btn" href="#/ajustes" aria-label="Ajustes">${icone('sliders')}</a>`;

// ---------------------------------------------------------------- etiquetas
export const selosSite = (alvo) =>
  alvo.map(
    (s) => html`<span class="site site--${s}" title="Ataque ao site ${s}"><span class="sr-only">Site </span>${s}</span>`,
  );

export const etiquetasTipo = (index, tatica) =>
  tatica.tipos.map((id) => html`<span class="tag">${index.tiposById.get(id)?.nome ?? id}</span>`);

// -------------------------------------------------------------------- listas
export function linhaTatica(index, t, { mostrarMapa = false, favorita = false } = {}) {
  const mapa = index.mapasById.get(t.mapa);
  return html`
    <a class="row" href="#/tatica/${t.id}">
      <span class="row__num" aria-hidden="true">${pad2(t.numero)}</span>
      <span class="row__main">
        <span class="row__title"><span class="sr-only">Tática ${t.numero}: </span>${t.titulo}</span>
        <span class="row__meta">
          ${mostrarMapa ? html`<span class="tag tag--mapa" style="--h:${mapa.matiz ?? 210}">${mapa.nome}</span>` : ''}
          ${etiquetasTipo(index, t)}
        </span>
      </span>
      <span class="row__end">
        ${favorita ? html`<span class="row__fav" role="img" aria-label="Favorita">${icone('star')}</span>` : ''}
        ${selosSite(t.alvo)}
        ${icone('chevR', 'row__chev')}
      </span>
    </a>`;
}

export function listaTaticas(index, taticas, opcoes = {}) {
  const favs = opcoes.favs ?? new Set();
  return html`<ul class="rows">${taticas.map(
    (t) => html`<li>${linhaTatica(index, t, { mostrarMapa: opcoes.mostrarMapa, favorita: favs.has(t.id) })}</li>`,
  )}</ul>`;
}

/** Faixa de chips com os mapas. modo "link" navega; "botao" só troca o mapa da partida. */
export function chipsDeMapas(index, ativoId, modo = 'link') {
  const chips = index.mapas.map((m) => {
    const ativo = m.id === ativoId;
    return modo === 'link'
      ? html`<a class="chip chip--mapa" href="#/mapa/${m.id}" data-replace ${ativo ? raw('aria-current="page"') : ''}>${m.nome}</a>`
      : html`<button type="button" class="chip chip--mapa" data-action="set-mapa" data-id="${m.id}" aria-pressed="${bool(ativo)}">${m.nome}</button>`;
  });
  return html`<div class="chips" role="group" aria-label="Mapa">${chips}</div>`;
}

// ------------------------------------------------------------- linha da tática
/** Uma linha do playbook; a contagem de jogadores no começo vira um selo destacado. */
export function linhaDoPlaybook(texto) {
  const { count, rest } = separarContagem(texto);
  if (count) {
    return html`<li class="linha"><span class="linha__qtd">${count}</span><span class="linha__txt">${rest}</span></li>`;
  }
  if (ehObjetivo(texto)) {
    return html`<li class="linha linha--objetivo"><span class="linha__icone">${icone('flag')}</span><span class="linha__txt">${texto}</span></li>`;
  }
  return html`<li class="linha"><span class="linha__ponto" aria-hidden="true"></span><span class="linha__txt">${texto}</span></li>`;
}

// ------------------------------------------------------------ instalar o app
function passosIos() {
  return html`<p>No iPhone/iPad, use o Safari:</p>
    <ol class="passos">
      <li>Toque em <strong>Compartilhar</strong> ${icone('share', 'ic--inline')}</li>
      <li>Escolha <strong>Adicionar à Tela de Início</strong></li>
      <li>Confirme em <strong>Adicionar</strong></li>
    </ol>`;
}

const passosGenerico = () =>
  html`<p>Abra o menu do navegador e escolha <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>). Depois de instalado, funciona sem internet.</p>`;

/**
 * Convite para instalar o app (iPhone não instala sozinho: precisa do passo a passo).
 *  - compacto: faixa curta no topo da primeira tela, com os passos recolhidos
 *  - completo: cartão dos Ajustes
 */
export function cartaoInstalar({ dispensavel = false, compacto = false } = {}) {
  if (pwa.instalado()) return '';
  if (dispensavel && store.get('dica-instalar-fechada', false)) return '';

  const fechar = dispensavel
    ? html`<button type="button" class="icon-btn icon-btn--sm" data-action="fechar-dica" aria-label="Dispensar">${icone('x')}</button>`
    : '';

  if (compacto && pwa.podeInstalar()) {
    return html`<section class="dica" aria-label="Instalar no celular">
      <span class="dica__icone">${icone('download')}</span>
      <p class="dica__texto"><strong>Instale o app</strong> para abrir da tela inicial e usar sem internet.</p>
      <button type="button" class="btn btn--primario btn--sm" data-action="instalar">Instalar</button>
      ${fechar}
    </section>`;
  }

  if (compacto) {
    return html`<section class="dica dica--detalhes" aria-label="Instalar no celular">
      <details>
        <summary>
          <span class="dica__icone">${icone('download')}</span>
          <span class="dica__texto"><strong>Instale no celular</strong> e use sem internet</span>
        </summary>
        <div class="dica__corpo">${pwa.ios() ? passosIos() : passosGenerico()}</div>
      </details>
      ${fechar}
    </section>`;
  }

  const corpo = pwa.podeInstalar()
    ? html`<p>Instale para abrir direto da tela inicial, em tela cheia e sem internet.</p>
        <button type="button" class="btn btn--primario" data-action="instalar">${icone('download')} Instalar app</button>`
    : pwa.ios()
      ? passosIos()
      : passosGenerico();

  return html`
    <section class="cartao cartao--dica" aria-label="Instalar no celular">
      <div class="cartao__cab">
        <h2 class="cartao__titulo">Instale no celular</h2>
        ${fechar}
      </div>
      ${corpo}
    </section>`;
}
