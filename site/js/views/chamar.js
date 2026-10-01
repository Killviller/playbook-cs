import { html } from '../lib/html.js';
import { taticasParaSituacao } from '../data.js';
import { acoesPadrao, chipsDeMapas, icone, listaTaticas, mapaAtual } from '../ui.js';
import { favoritas } from '../store.js';

/** "Qual tática chamar?": a cola rápida da pág. 13 do PDF, situação por situação. */
export function chamar({ index }) {
  const linhas = index.situacoes.map(
    (s) => html`<li><a class="row row--situacao" href="#/chamar/${s.id}">
      <span class="row__main">
        <span class="row__title">${s.situacao}</span>
        <span class="row__sub">${s.recomendacao}</span>
      </span>
      <span class="row__end">${icone('chevR', 'row__chev')}</span>
    </a></li>`,
  );

  return {
    titulo: 'Qual tática chamar?',
    aba: 'chamar',
    acoes: acoesPadrao(),
    corpo: html`
      <p class="intro">Toque na situação do round. O app mostra o que o playbook recomenda e as táticas do mapa que servem.</p>
      <ul class="rows">${linhas}</ul>`,
  };
}

export function situacao({ index, params }) {
  const s = index.situacoes.find((x) => x.id === params.id);
  if (!s) return null;

  const mapaId = mapaAtual(index);
  const mapa = index.mapasById.get(mapaId);
  const { melhores, outras, relaxado } = taticasParaSituacao(index, s, mapaId);
  const favs = favoritas.ids();

  let resultado;
  if (!melhores.length && !outras.length) {
    // sem beco sem saída: explica e já mostra todas as táticas do mapa
    const pedidos = s.tipos.map((id) => index.tiposById.get(id)?.nome ?? id).join(' ou ');
    resultado = html`
      <p class="aviso-inline">Nenhuma tática do ${mapa.nome} está marcada como ${pedidos}. Veja todas as táticas do mapa:</p>
      ${listaTaticas(index, index.porMapa.get(mapaId), { favs })}`;
  } else if (relaxado) {
    resultado = html`
      <p class="aviso-inline">O ${mapa.nome} não tem uma tática exatamente assim. Estas são as outras opções para o site ${s.alvo}:</p>
      ${listaTaticas(index, outras, { favs })}`;
  } else {
    resultado = html`
      <h2 class="secao">Melhores no ${mapa.nome}</h2>
      ${listaTaticas(index, melhores, { favs })}
      ${outras.length
        ? html`<details class="mais"><summary>Também servem (${outras.length})</summary>${listaTaticas(index, outras, { favs })}</details>`
        : ''}`;
  }

  return {
    titulo: 'Situação',
    tituloDocumento: s.situacao,
    tituloNoCorpo: true,
    voltar: '/chamar',
    aba: 'chamar',
    acoes: acoesPadrao(),
    corpo: html`
      <h1 class="pagina-titulo">${s.situacao}</h1>
      <p class="recomendacao"><span class="recomendacao__rotulo">O playbook recomenda</span>${s.recomendacao}</p>
      ${chipsDeMapas(index, mapaId, 'botao')}
      ${resultado}`,
  };
}
