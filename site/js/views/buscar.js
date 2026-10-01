import { html } from '../lib/html.js';
import { buscar } from '../data.js';
import { favoritas } from '../store.js';
import { trocarUrlSemRender } from '../router.js';
import { icone, listaTaticas } from '../ui.js';

const SUGESTOES = ['pistol', 'force', 'awp', 'lurker', 'plano b', 'smoke', 'banana'];

function resultados(index, consulta) {
  if (!consulta.trim()) {
    return html`<p class="intro">Busque por nome da tática, posição, função ou tipo.</p>
      <div class="sugestoes">${SUGESTOES.map(
        (s) => html`<button type="button" class="chip" data-action="sugestao" data-q="${s}">${s}</button>`,
      )}</div>`;
  }
  const achadas = buscar(index, consulta);
  if (!achadas.length) {
    return html`<section class="vazio"><p class="vazio__texto">Nada encontrado para “${consulta}”.</p></section>`;
  }
  return html`<p class="cabecalho-lista__info">${achadas.length} ${achadas.length === 1 ? 'resultado' : 'resultados'}</p>
    ${listaTaticas(index, achadas, { mostrarMapa: true, favs: favoritas.ids() })}`;
}

export function buscarTela({ index, query }) {
  const q = query.get('q') ?? '';
  return {
    titulo: 'Buscar',
    voltar: '/',
    corpo: html`
      <div class="busca" role="search">
        <span class="busca__icone">${icone('search')}</span>
        <label class="sr-only" for="q">Buscar táticas</label>
        <input id="q" class="busca__campo" type="search" inputmode="search" enterkeyhint="search"
          autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ex.: pistol, awp, banana" value="${q}">
      </div>
      <div id="resultados" aria-live="polite">${resultados(index, q)}</div>`,
    montar(raiz) {
      const campo = raiz.querySelector('#q');
      const caixa = raiz.querySelector('#resultados');
      campo.addEventListener('input', () => {
        caixa.innerHTML = String(resultados(index, campo.value));
        trocarUrlSemRender(campo.value ? `#/buscar?q=${encodeURIComponent(campo.value)}` : '#/buscar');
      });
      campo.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') campo.blur(); // fecha o teclado
      });
      if (!q) campo.focus();
    },
  };
}
