// Radar na tela da tática (somente leitura): etapas, legenda e destaque da função da pessoa.
import { html, raw, bool } from '../lib/html.js';
import { desenharSvg, glifoGranada, legendaDaEtapa } from '../lib/radar-svg.js';
import { GRANADAS } from '../lib/radar.js';
import { imagemDoMapa, imagemDoSite, radarDaTatica } from '../radares.js';
import { store } from '../store.js';
import { icone, minhaFuncao } from '../ui.js';

const etapaVista = new Map(); // etapa que a pessoa estava vendo em cada tática (sobrevive a um redesenho da tela)

const miniatura = (tipo) =>
  raw(`<svg class="rl-glifo" viewBox="-34 -34 68 68" aria-hidden="true"><circle r="29" fill="#0f141b" stroke="#94a3b8" stroke-width="5"/>${glifoGranada(tipo)}</svg>`);

function legenda(l) {
  const itens = [
    ...l.funcoes.map(
      (f) => html`<li><span class="rl-ponto" style="--c:${f.cor}">${f.sigla}</span>${f.curto}</li>`,
    ),
    ...l.granadas.map((g) => html`<li>${miniatura(g)}${GRANADAS[g].nome}</li>`),
    l.temBomba ? html`<li><span class="rl-bomba">C4</span>Bomba</li>` : '',
    l.temRota ? html`<li><span class="rl-traco"></span>Rota</li>` : '',
    l.temArremesso ? html`<li><span class="rl-traco rl-traco--tracejado"></span>Arremesso</li>` : '',
  ];
  return itens.length ? html`<ul class="radar-legenda" aria-label="Legenda do radar">${itens}</ul>` : '';
}

function textoDaEtapa(etapa, i, total) {
  const titulo = etapa.titulo ? ` · ${etapa.titulo}` : '';
  return html`${total > 1 || etapa.titulo ? html`<strong class="radar-leitor__etapa">Etapa ${i + 1}${titulo}</strong>` : ''}
    ${etapa.nota ? html`<p class="radar-leitor__nota">${etapa.nota}</p>` : ''}`;
}

const svgDaEtapa = (index, etapa, imagem, minha) =>
  raw(desenharSvg(etapa, { funcoes: index.funcoes, imagem, destaque: minha }));

/** Bloco "Radar" da tela da tática. Sem radar, só aparece (com o botão de criar) para quem ligou o atalho do editor. */
export function blocoRadar(index, t) {
  const radar = radarDaTatica(t.id);
  const atalho = store.get('editor', false);
  if (!radar && !atalho) return '';

  if (!radar) {
    return html`<section class="bloco radar-leitor radar-leitor--vazio" aria-label="Radar">
      <h2 class="bloco__titulo">Radar</h2>
      <a class="btn" href="#/editor/${t.id}">${icone('radar')} Criar o radar desta tática</a>
    </section>`;
  }

  const { diagrama, origem } = radar;
  const total = diagrama.etapas.length;
  const i = Math.min(etapaVista.get(t.id) ?? 0, total - 1);
  const etapa = diagrama.etapas[i];
  const minha = minhaFuncao(index);
  const funcao = minha ? index.funcoesById.get(minha) : null;

  return html`<section class="bloco radar-leitor" data-radar="${t.id}" aria-label="Radar">
    <div class="radar-leitor__cab">
      <h2 class="bloco__titulo">Radar</h2>
      ${origem === 'aparelho' ? html`<span class="tag" title="Ainda não foi publicado para o time">Salvo só neste aparelho</span>` : ''}
      ${atalho ? html`<a class="link" href="#/editor/${t.id}">${icone('edit', 'ic--inline')}Editar</a>` : ''}
    </div>
    <div class="radar-leitor__quadro" data-quadro>${svgDaEtapa(index, etapa, imagemDoSite(t.mapa), minha)}</div>
    ${total > 1
      ? html`<div class="chips radar-etapas" role="group" aria-label="Etapas do radar">${diagrama.etapas.map(
          (e, n) => html`<button type="button" class="chip chip--etapa" data-etapa="${n}" aria-pressed="${bool(n === i)}">${n + 1}${e.titulo ? html`<span class="chip__rotulo">${e.titulo}</span>` : ''}</button>`,
        )}</div>`
      : ''}
    <div class="radar-leitor__texto" data-texto>${textoDaEtapa(etapa, i, total)}</div>
    <div data-legenda>${legenda(legendaDaEtapa(etapa, index.funcoes))}</div>
    ${funcao ? html`<p class="radar-leitor__voce muted">Em destaque: a sua função, <strong>${funcao.sigla}</strong>.</p>` : ''}
  </section>`;
}

/** Liga as etapas e carrega a imagem do radar (a escolhida neste aparelho vence a do site). */
export function montarRadar(main, index, t) {
  const raiz = main.querySelector('[data-radar]');
  const radar = radarDaTatica(t.id);
  if (!raiz || !radar) return;

  const { diagrama } = radar;
  const quadro = raiz.querySelector('[data-quadro]');
  let imagem = imagemDoSite(t.mapa);
  let atual = Math.min(etapaVista.get(t.id) ?? 0, diagrama.etapas.length - 1);

  const desenhar = () => {
    const etapa = diagrama.etapas[atual];
    quadro.innerHTML = String(svgDaEtapa(index, etapa, imagem, minhaFuncao(index)));
    raiz.querySelector('[data-texto]').innerHTML = String(textoDaEtapa(etapa, atual, diagrama.etapas.length));
    raiz.querySelector('[data-legenda]').innerHTML = String(legenda(legendaDaEtapa(etapa, index.funcoes)));
    raiz.querySelectorAll('[data-etapa]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.etapa) === atual)));
  };

  raiz.addEventListener('click', (ev) => {
    const botao = ev.target instanceof Element ? ev.target.closest('[data-etapa]') : null;
    if (!botao) return;
    atual = Number(botao.dataset.etapa);
    etapaVista.set(t.id, atual);
    desenhar();
  });

  imagemDoMapa(t.mapa).then((img) => {
    if (img && img.url !== imagem) {
      imagem = img.url;
      desenhar();
    }
  });
}
