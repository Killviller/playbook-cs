import { html, raw } from '../lib/html.js';
import { store } from '../store.js';
import { acoesPadrao, cartaoInstalar } from '../ui.js';

/** Seletor do mapa da partida (primeira abertura ou "Trocar mapa"). */
export function mapas({ index }) {
  const atual = store.get('mapa');

  // o mapa da partida vai primeiro (card grande)
  const ordem = [...index.mapas].sort((a, b) => (b.id === atual) - (a.id === atual));
  const tiles = ordem.map((m) => {
    const n = index.porMapa.get(m.id).length;
    const sigla = m.sigla ?? m.nome.slice(0, 3).toUpperCase();
    const agora = m.id === atual;
    return html`
      <a class="tile" href="#/mapa/${m.id}" style="--h:${m.matiz ?? 210}" ${agora ? raw('aria-current="true"') : ''}>
        <span class="tile__capa">
          ${m.capa ? html`<img src="${m.capa}" alt="" loading="lazy">` : ''}
          <span class="tile__sigla" aria-hidden="true">${sigla}</span>
          ${agora ? html`<span class="tile__atual">Mapa da partida</span>` : ''}
        </span>
        <span class="tile__texto">
          <span class="tile__nome">${m.nome}</span>
          <span class="tile__info">${n} ${n === 1 ? 'tática' : 'táticas'}</span>
        </span>
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
