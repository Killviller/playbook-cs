// Casco do app: barra superior, abas inferiores, avisos (toast) e tela de erro.
import { html, raw } from './lib/html.js';
import { store } from './store.js';
import { icone } from './ui.js';

const $ = (id) => document.getElementById(id);

const ABAS = [
  { id: 'taticas', rotulo: 'Táticas', icone: 'map', href: () => (store.get('mapa') ? `#/mapa/${store.get('mapa')}` : '#/mapas') },
  { id: 'chamar', rotulo: 'Chamar', icone: 'call', href: () => '#/chamar' },
  { id: 'guia', rotulo: 'Guia', icone: 'book', href: () => '#/guia' },
  { id: 'favoritas', rotulo: 'Favoritas', icone: 'star', href: () => '#/favoritas' },
];

const NOME_APP = 'Playbook T';

/**
 * tela = { titulo, tituloDocumento?, tituloNoCorpo?, voltar?, aba?, semAbas?, acoes?, corpo }
 *  - voltar: caminho-pai usado quando não há histórico (link aberto direto)
 *  - tituloNoCorpo: a tela traz o próprio <h1>; senão um <h1> invisível é inserido
 *  - semAbas: esconde a barra de abas (editor de radar)
 */
export function pintar(tela) {
  const titulo = tela.titulo ?? NOME_APP;
  const docTitulo = tela.tituloDocumento ?? titulo;
  document.title = docTitulo === NOME_APP ? NOME_APP : `${docTitulo} · ${NOME_APP}`;

  const esquerda = tela.voltar
    ? html`<button type="button" class="icon-btn" data-action="voltar" data-alternativa="${tela.voltar}" aria-label="Voltar">${icone('chevL')}</button>`
    : html`<img class="marca" src="icons/favicon.svg" alt="" width="32" height="32">`;

  $('appbar').innerHTML = String(html`
    <div class="appbar__inner">
      ${esquerda}
      <span class="appbar__titulo">${titulo}</span>
      <div class="appbar__acoes">${tela.acoes ?? ''}</div>
    </div>`);

  // telas de trabalho (editor de radar) escondem as abas para ganhar espaço
  $('tabbar').hidden = !!tela.semAbas;
  document.body.classList.toggle('sem-abas', !!tela.semAbas);
  $('tabbar').innerHTML = tela.semAbas
    ? ''
    : String(html`
    <div class="tabbar__inner">${ABAS.map(
      (a) => html`<a class="tab" href="${a.href()}" data-replace ${a.id === tela.aba ? raw('aria-current="page"') : ''}>
        ${icone(a.icone)}<span>${a.rotulo}</span></a>`,
    )}</div>`);

  const h1 = tela.tituloNoCorpo ? '' : html`<h1 class="sr-only">${titulo}</h1>`;
  $('main').innerHTML = String(html`${h1}${tela.corpo}`);
}

/** Centraliza o chip ativo em cada faixa de chips (a faixa rola na horizontal). */
export function centralizarChips() {
  document.querySelectorAll('.chips').forEach((faixa) => {
    const ativo = faixa.querySelector('[aria-current="page"], [aria-pressed="true"]');
    if (!ativo) return;
    faixa.scrollLeft = Math.max(0, ativo.offsetLeft - (faixa.clientWidth - ativo.offsetWidth) / 2);
  });
}

// -------------------------------------------------------------------- avisos
let timer = null;
let aoAcionar = null;

export function aviso(mensagem, { acao = null, aoAcionar: cb = null, fixo = false } = {}) {
  const el = $('toast');
  aoAcionar = cb;
  el.innerHTML = String(html`<span class="toast__msg">${mensagem}</span>${
    acao ? html`<button type="button" class="toast__btn" data-action="toast-acao">${acao}</button>` : ''
  }`);
  el.classList.add('is-on');
  clearTimeout(timer);
  if (!fixo) timer = setTimeout(esconderAviso, 3200);
}

export function esconderAviso() {
  $('toast').classList.remove('is-on');
  aoAcionar = null;
}

export function acionarAviso() {
  const cb = aoAcionar;
  esconderAviso();
  cb?.();
}

// --------------------------------------------------------------------- erro
export function mostrarErro(mensagem) {
  $('main').innerHTML = String(html`
    <section class="vazio" role="alert">
      <h1 class="vazio__titulo">Não deu para abrir o playbook</h1>
      <p>${mensagem}</p>
      <p class="muted">Confira a conexão. Se você já abriu o app antes com internet, ele deveria funcionar offline.</p>
      <button type="button" class="btn btn--primario" data-action="atualizar">Tentar de novo</button>
    </section>`);
}
