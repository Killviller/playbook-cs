import { html } from '../lib/html.js';
import { favoritas as guardadas } from '../store.js';
import { acoesPadrao, icone, listaTaticas } from '../ui.js';

/** Táticas fixadas neste aparelho, agrupadas por mapa. */
export function favoritas({ index }) {
  const ids = guardadas.ids();
  const marcadas = index.taticas.filter((t) => ids.has(t.id));

  const corpo = marcadas.length
    ? index.mapas
        .map((m) => ({ m, lista: marcadas.filter((t) => t.mapa === m.id) }))
        .filter((g) => g.lista.length)
        .map(
          (g) => html`<section class="grupo">
            <h2 class="secao">${g.m.nome}</h2>
            ${listaTaticas(index, g.lista, { favs: ids })}
          </section>`,
        )
    : html`<section class="vazio">
        <span class="vazio__icone">${icone('star')}</span>
        <h2 class="vazio__titulo">Nenhuma favorita ainda</h2>
        <p class="vazio__texto">Abra uma tática e toque na estrela para deixá-la aqui, à mão. As favoritas ficam só neste aparelho.</p>
      </section>`;

  return {
    titulo: 'Favoritas',
    aba: 'favoritas',
    acoes: acoesPadrao(),
    corpo,
  };
}
