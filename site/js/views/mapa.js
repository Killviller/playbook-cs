import { html, bool } from '../lib/html.js';
import { favoritas, store } from '../store.js';
import { tiposDoMapa } from '../data.js';
import { acoesPadrao, chipsDeMapas, listaTaticas } from '../ui.js';

/** As 10 táticas de um mapa, com filtro por tipo. */
export function mapa({ index, params, query }) {
  const m = index.mapasById.get(params.id);
  if (!m) return { redirect: '/mapas' };
  store.set('mapa', m.id); // vira o "mapa da partida" lembrado

  const todas = index.porMapa.get(m.id);
  const pedido = query.get('tipo');
  const tipoAtivo = index.tiposById.has(pedido) ? pedido : null;
  const lista = tipoAtivo ? todas.filter((t) => t.tipos.includes(tipoAtivo)) : todas;
  const contagem = tipoAtivo ? `${lista.length} de ${todas.length} táticas` : `${todas.length} táticas`;

  const filtros = tiposDoMapa(index, m.id).map(
    (t) => html`<button type="button" class="chip chip--tipo" style="--tc:${t.cor ?? '#6b6b6b'}" data-action="filtro" data-mapa="${m.id}" data-tipo="${t.id}" aria-pressed="${bool(t.id === tipoAtivo)}"><span class="ponto"></span>${t.nome}</button>`,
  );

  return {
    titulo: m.nome,
    aba: 'taticas',
    acoes: acoesPadrao(),
    corpo: html`
      <div class="hero" style="--h:${m.matiz ?? 210}">
        ${m.capa ? html`<img src="${m.capa}" alt="" loading="lazy">` : ''}
        <div class="hero__texto"><span class="hero__nome">${m.nome}</span><span class="hero__info">${contagem} · lado T</span></div>
      </div>
      ${chipsDeMapas(index, m.id, 'link')}
      <div class="cabecalho-lista">
        <p class="cabecalho-lista__info"></p>
        <a class="link" href="#/mapas">Trocar mapa</a>
      </div>
      ${m.descricao
        ? html`<details class="sobre"><summary>Sobre o ${m.nome}</summary><p>${m.descricao}</p></details>`
        : ''}
      <div class="chips chips--tipos" role="group" aria-label="Filtrar por tipo">
        <button type="button" class="chip chip--tipo" data-action="filtro" data-mapa="${m.id}" data-tipo="" aria-pressed="${bool(!tipoAtivo)}">Todas</button>
        ${filtros}
      </div>
      ${listaTaticas(index, lista, { favs: favoritas.ids() })}`,
  };
}
