// Minimapa da tática: radar do mapa + um blip por jogador que se move entre as fases.
// Dados: mapa.radar (imagem quadrada) e tatica.posicoes { p1: [[x,y], …], … } em % do radar.
// A troca de fase e de jogador é feita só com atributos data-* (ver actions.js e app.css).
import { html } from './lib/html.js';

const NOMES = { 2: ['Início', 'Final'], 3: ['Setup', 'Execução', 'Plant'], 4: ['Setup', 'Meio', 'Execução', 'Plant'] };

export const MAX_FASES = 4;

export function minimapa(index, mapa, t, minha) {
  const pos = t.posicoes;
  if (!pos) {
    if (!mapa.radar) return '';
    return html`<section class="mm mm--so-radar" aria-label="Radar">
      <div class="mm__cab"><strong>Radar</strong><span>${mapa.nome}</span></div>
      <div class="mm__mapa"><img src="${mapa.radar}" alt="Radar de ${mapa.nome}"></div>
      <p class="mm__nota">As posições dos jogadores desta tática ainda não foram marcadas.</p>
    </section>`;
  }
  const jogadores = index.funcoes.filter((f) => pos[f.id]);
  if (!jogadores.length) return '';
  const n = pos[jogadores[0].id].length;
  const fases = t.fases ?? NOMES[n] ?? Array.from({ length: n }, (_, i) => `Fase ${i + 1}`);
  const sel = jogadores.find((f) => f.id === minha)?.id ?? jogadores[0].id;
  const cor = (f) => `--c:var(--${f.id})`;

  return html`
    <section class="mm" data-fase="0" data-sel="${sel}" aria-label="Minimapa da tática">
      <div class="mm__cab"><strong>Minimapa</strong><span>${mapa.nome}</span></div>
      <div class="mm__mapa">
        ${mapa.radar ? html`<img src="${mapa.radar}" alt="Radar de ${mapa.nome}">` : html`<span class="mm__vazio">sem imagem do radar</span>`}
        ${jogadores.map((f) => {
          const xy = pos[f.id].map(([x, y], i) => `--x${i}:${x}%;--y${i}:${y}%`).join(';');
          return html`<button type="button" class="mm__blip" data-action="blip" data-id="${f.id}" aria-pressed="${f.id === sel}" aria-label="${f.sigla} ${f.curto ?? f.nome}" style="${xy};${cor(f)}"><span class="mm__ponto">${f.sigla}</span></button>`;
        })}
      </div>
      <div class="mm__fases" role="group" aria-label="Fase da jogada">
        ${fases.map((nome, i) => html`<button type="button" class="mm__fase" data-action="fase" data-fase="${i}" aria-pressed="${i === 0}"><small>FASE 0${i + 1}</small><span>${nome}</span></button>`)}
      </div>
      <div class="mm__jogadores" role="group" aria-label="Jogador">
        ${jogadores.map((f) => html`<button type="button" class="mm__chip" data-action="blip" data-id="${f.id}" aria-pressed="${f.id === sel}" style="${cor(f)}"><b>${f.sigla}</b><small>${f.curto ?? f.nome}</small></button>`)}
      </div>
      ${jogadores.map((f) => html`<div class="mm__papel" data-id="${f.id}" style="${cor(f)}"><b>${f.sigla} · ${f.nome}</b><p>${t.funcoes[f.id] ?? ''}</p></div>`)}
    </section>`;
}
