import { html, raw } from '../lib/html.js';
import { store } from '../store.js';
import { acoesPadrao, cartaoInstalar } from '../ui.js';

/** Seletor do mapa da partida (primeira abertura ou "Trocar mapa"). */
export function mapas({ index }) {
  const atual = store.get('mapa');

  const tiles = index.mapas.map((m) => {
    const n = index.porMapa.get(m.id).length;
    const sigla = m.sigla ?? m.nome.slice(0, 3).toUpperCase();
    return html`
      <a class="tile" href="#/mapa/${m.id}" style="--h:${m.matiz ?? 210}" ${m.id === atual ? raw('aria-current="true"') : ''}>
        <span class="tile__sigla" aria-hidden="true">${sigla}</span>
        <span class="tile__nome">${m.nome}</span>
        <span class="tile__info">${m.id === atual ? 'Mapa da partida · ' : ''}${n} ${n === 1 ? 'tática' : 'táticas'}</span>
      </a>`;
  });

  return {
    titulo: 'Playbook T',
    aba: 'taticas',
    acoes: acoesPadrao(),
    corpo: html`
      ${cartaoInstalar({ dispensavel: true, compacto: true })}
      <p class="intro">Escolha o mapa da partida. O app lembra dele na próxima vez que você abrir.${index.meta.pool ? html` <span class="muted">${index.meta.pool}.</span>` : ''}</p>
      <div class="tiles">${tiles}</div>`,
  };
}
