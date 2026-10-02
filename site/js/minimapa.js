// Minimapa da tática: radar do mapa + um blip por jogador que se move entre as fases.
// Dados: mapa.radar (imagem quadrada) e tatica.posicoes { p1: [[x,y], …], … } em % do radar (de 1 a 4 fases).
// Os radares feitos no editor (#/editor) entram pelos mesmos campos e ainda trazem, por fase, rotas, granadas, bomba,
// textos e uma nota (opcoes.etapas). A troca de fase e de jogador é feita só com atributos data-* (ver actions.js e app.css).
import { html, raw } from './lib/html.js';
import { GRANADAS, MAX_FASES, nomeDaFase } from './lib/radar.js';
import { desenharCamada, glifoGranada, legendaDosExtras } from './lib/radar-svg.js';
import { imagemDoMapa, imagemDoSite } from './radares.js';
import { icone } from './ui.js';

export { MAX_FASES };

const miniatura = (tipo) =>
  raw(`<svg class="rl-glifo" viewBox="-34 -34 68 68" aria-hidden="true"><circle r="29" fill="#0f141b" stroke="#94a3b8" stroke-width="5"/>${glifoGranada(tipo)}</svg>`);

function legenda(etapas) {
  const l = legendaDosExtras(etapas);
  const itens = [
    ...l.granadas.map((g) => html`<li>${miniatura(g)}${GRANADAS[g].nome}</li>`),
    l.temBomba ? html`<li><span class="rl-bomba">C4</span>Bomba</li>` : '',
    l.temRota ? html`<li><span class="rl-traco"></span>Rota</li>` : '',
    l.temArremesso ? html`<li><span class="rl-traco rl-traco--tracejado"></span>Arremesso</li>` : '',
  ];
  return itens.some(Boolean) ? html`<ul class="radar-legenda mm__legenda" aria-label="Legenda do radar">${itens}</ul>` : '';
}

function cabecalho(mapa, { titulo = 'Minimapa', origem = null, editarId = null } = {}) {
  return html`<div class="mm__cab"><strong>${titulo}</strong>
    <span class="mm__cab-dir">
      ${origem === 'aparelho' ? html`<span class="tag" title="Ainda não foi publicado para o time">Só neste aparelho</span>` : ''}
      ${origem === 'publicando' ? html`<span class="tag" title="Já foi enviado: chega a todos os aparelhos em cerca de 2 minutos">Publicando para todos</span>` : ''}
      ${editarId ? html`<a class="mm__editar" href="#/editor/${editarId}">${icone('edit', 'ic--inline')}Editar</a>` : ''}
      <span>${mapa.nome}</span>
    </span></div>`;
}

/**
 * @param {object} opcoes
 * @param {{titulo: string, nota: string, itens: object[]}[]|null} [opcoes.etapas] radar feito no editor: extras e notas por fase
 * @param {'aparelho'|'publicando'|'site'|null} [opcoes.origem] de onde veio esse radar ('aparelho' = ainda não publicado, 'publicando' = já enviado e a caminho)
 * @param {boolean} [opcoes.atalho] mostra os atalhos "Editar" / "Criar o radar" (Ajustes → Atalho de edição)
 */
export function minimapa(index, mapa, t, minha, { etapas = null, origem = null, atalho = false } = {}) {
  const pos = t.posicoes ?? null;
  const extras = (etapas ?? []).some((e) => e.itens.some((i) => i.tipo !== 'jogador'));
  const imagem = imagemDoSite(mapa.id) ?? mapa.radar ?? null;
  const editarId = atalho ? t.id : null;
  const jogadores = pos ? index.funcoes.filter((f) => pos[f.id]) : [];

  if (!jogadores.length && !extras) {
    if (!imagem) return '';
    return html`<section class="mm mm--so-radar" aria-label="Radar">
      ${cabecalho(mapa, { titulo: 'Radar' })}
      <div class="mm__mapa"><img src="${imagem}" alt="Radar de ${mapa.nome}"></div>
      <p class="mm__nota">As posições dos jogadores desta tática ainda não foram marcadas.</p>
      ${atalho ? html`<p class="mm__nota"><a class="link" href="#/editor/${t.id}">${icone('radar', 'ic--inline')}Criar o radar desta tática</a></p>` : ''}
    </section>`;
  }

  const n = Math.min(MAX_FASES, jogadores.length ? pos[jogadores[0].id].length : (etapas?.length ?? 1));
  const fases = t.fases ?? Array.from({ length: n }, (_, i) => nomeDaFase(n, i));
  const sel = jogadores.find((f) => f.id === minha)?.id ?? jogadores[0]?.id ?? '';
  const cor = (f) => `--c:var(--${f.id})`;
  const notas = (etapas ?? []).slice(0, n);

  const sobreposicao = extras
    ? raw(
        `<svg class="mm__extras" viewBox="0 0 1000 1000" aria-hidden="true">${notas
          .map((e, i) => `<g class="mm__extras-fase" data-fase="${i}">${desenharCamada(e, { funcoes: index.funcoes, semJogadores: true })}</g>`)
          .join('')}</svg>`,
      )
    : '';

  return html`
    <section class="mm" data-fase="0" data-sel="${sel}" aria-label="Minimapa da tática">
      ${cabecalho(mapa, { origem, editarId })}
      <div class="mm__mapa">
        ${imagem ? html`<img src="${imagem}" alt="Radar de ${mapa.nome}">` : html`<span class="mm__vazio">sem imagem do radar</span>`}
        ${sobreposicao}
        ${jogadores.map((f) => {
          const xy = pos[f.id].map(([x, y], i) => `--x${i}:${x}%;--y${i}:${y}%`).join(';');
          return html`<button type="button" class="mm__blip" data-action="blip" data-id="${f.id}" aria-pressed="${f.id === sel}" aria-label="${f.sigla} ${f.curto ?? f.nome}" style="${xy};${cor(f)}"><span class="mm__ponto">${f.sigla}</span></button>`;
        })}
      </div>
      ${n > 1
        ? html`<div class="mm__fases" role="group" aria-label="Fase da jogada">
            ${fases.map((nome, i) => html`<button type="button" class="mm__fase" data-action="fase" data-fase="${i}" aria-pressed="${i === 0}"><small>FASE 0${i + 1}</small><span>${nome}</span></button>`)}
          </div>`
        : ''}
      ${notas.map((e, i) => (e.nota ? html`<p class="mm__fase-nota" data-fase="${i}">${e.nota}</p>` : ''))}
      ${legenda(etapas)}
      ${jogadores.length
        ? html`<div class="mm__jogadores" role="group" aria-label="Jogador">
            ${jogadores.map((f) => html`<button type="button" class="mm__chip" data-action="blip" data-id="${f.id}" aria-pressed="${f.id === sel}" style="${cor(f)}"><b>${f.sigla}</b><small>${f.curto ?? f.nome}</small></button>`)}
          </div>`
        : ''}
      ${jogadores.map((f) => html`<div class="mm__papel" data-id="${f.id}" style="${cor(f)}"><b>${f.sigla} · ${f.nome}</b><p>${t.funcoes[f.id] ?? ''}</p></div>`)}
    </section>`;
}

/** Depois de pintar a tela: troca a imagem do radar pela escolhida neste aparelho (se houver), que o HTML não sabe. */
export function montarMinimapa(main, mapa) {
  const img = main.querySelector('.mm__mapa > img');
  if (!img) return;
  imagemDoMapa(mapa.id, mapa.radar).then((r) => {
    if (r && img.isConnected && img.getAttribute('src') !== r.url) img.src = r.url;
  });
}
