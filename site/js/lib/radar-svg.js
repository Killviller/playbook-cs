// Desenha uma etapa do radar como SVG (texto). Usado pelo leitor (tela da tática) e pelo editor.
// Puro e sem DOM: dá para testar no Node. Todo texto vindo dos dados passa por esc().
import { esc } from './html.js';
import { GRANADAS } from './radar.js';

/**
 * Uma cor por posição na lista de funções (P1…P5), as mesmas dos blips do minimapa (--p1…--p5 em app.css).
 * A sigla também aparece no marcador: a cor nunca é a única pista.
 */
export const CORES_FUNCAO = ['#4aa8ff', '#3ddc97', '#ffd23f', '#ff8a3d', '#b58cff'];
const NEUTRA = '#cbd5e1';
const TINTA = '#0b0f14';
const S = 1000; // o desenho usa 1000 unidades; os dados guardam 0 a 1

export const corDaFuncao = (funcoes, id) => {
  const i = funcoes.findIndex((f) => f.id === id);
  return i < 0 ? NEUTRA : CORES_FUNCAO[i % CORES_FUNCAO.length];
};

const n = (v) => Math.round(v * 10) / 10;
const px = (v) => n(v * S);
const k3 = (v) => Math.round(v * 1000) / 1000;

// -------------------------------------------------------------- glifos das granadas
const ESTRELA = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 ? 8 : 18;
  const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
  return `${n(Math.cos(a) * r)},${n(Math.sin(a) * r)}`;
}).join(' ');

const GLIFOS = {
  smoke: '<g fill="#e2e8f0"><circle cx="-10" cy="5" r="10"/><circle cx="10" cy="5" r="10"/><circle cx="0" cy="-6" r="12"/></g>',
  flash: `<polygon fill="#ffe14d" points="${ESTRELA}"/>`,
  molotov:
    '<path fill="#ff8a3d" d="M0-20C9-9 15-1 11 9 8 17-8 17-11 9-15-1-6-8 0-20Z"/>' +
    '<path fill="#ffd36b" d="M0-2C5 4 7 8 4 11 2 13-2 13-4 11-7 8-4 3 0-2Z"/>',
  he: '<g fill="#6ee06e"><circle cx="0" cy="4" r="13"/><rect x="-4" y="-19" width="8" height="9" rx="2"/></g>',
};

/** Miniatura de uma granada (para legendas e paleta): disco escuro com o glifo. */
export const glifoGranada = (tipo) => GLIFOS[tipo] ?? '';

// ---------------------------------------------------------------------- peças
function grupo(tipo, x, y, k, interior, { id = null, esmaecer = false, extra = '', editor = false, raioToque = 58 } = {}) {
  const alvo = editor && id ? `<circle r="${raioToque}" fill="transparent"/>` : '';
  return (
    `<g class="rd-item rd-${tipo}${esmaecer ? ' rd-esmaece' : ''}" transform="translate(${px(x)} ${px(y)}) scale(${k3(k)})"` +
    `${id ? ` data-item="${esc(id)}"` : ''}${esmaecer ? ' opacity="0.28"' : ''}>${alvo}${extra}${interior}</g>`
  );
}

const anel = (r, aoSelecionar) =>
  aoSelecionar
    ? `<circle r="${r}" fill="none" stroke="${TINTA}" stroke-width="9"/><circle class="rd-sel" r="${r}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 8"/>`
    : '';

function jogador(it, c) {
  const cor = corDaFuncao(c.funcoes, it.funcao);
  const sigla = c.funcoes.find((f) => f.id === it.funcao)?.sigla ?? '?';
  const voce = c.destaque && c.destaque === it.funcao;
  const interior =
    (voce ? `<circle class="rd-voce" r="48" fill="none" stroke="#fff" stroke-width="6"/>` : '') +
    anel(46, c.selecionado === it.id) +
    `<circle r="34" fill="${cor}" stroke="${TINTA}" stroke-width="5"/>` +
    `<text class="rd-sigla" text-anchor="middle" dy=".35em" font-size="30" font-weight="800" fill="${TINTA}">${esc(sigla)}</text>`;
  return grupo('jogador', it.x, it.y, c.k, interior, { ...c.opcoes(it), id: it.id });
}

function granada(it, c) {
  const cor = it.funcao ? corDaFuncao(c.funcoes, it.funcao) : '#94a3b8';
  const interior =
    anel(40, c.selecionado === it.id) +
    `<circle r="28" fill="#0f141b" stroke="${cor}" stroke-width="6"/>${GLIFOS[it.granada] ?? ''}`;
  return grupo('granada', it.x, it.y, c.k, interior, { ...c.opcoes(it), id: it.id, raioToque: 50 });
}

function bomba(it, c) {
  const interior =
    anel(46, c.selecionado === it.id) +
    `<rect x="-26" y="-17" width="52" height="34" rx="7" fill="#e5483d" stroke="${TINTA}" stroke-width="5"/>` +
    `<text text-anchor="middle" dy=".35em" font-size="20" font-weight="800" fill="#fff">C4</text>`;
  return grupo('bomba', it.x, it.y, c.k, interior, { ...c.opcoes(it), id: it.id });
}

function textoNoRadar(it, c) {
  const largura = Math.max(56, it.texto.length * 19 + 24);
  const interior =
    (c.selecionado === it.id
      ? `<rect x="${-largura / 2 - 4}" y="-26" width="${largura + 8}" height="52" rx="10" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="9 7"/>`
      : '') +
    (c.editor ? `<rect x="${-largura / 2}" y="-24" width="${largura}" height="48" fill="transparent"/>` : '') +
    `<text class="rd-letra" text-anchor="middle" dy=".35em" font-size="32" font-weight="800" fill="#fff" stroke="${TINTA}" stroke-width="8" stroke-linejoin="round" paint-order="stroke">${esc(it.texto)}</text>`;
  return grupo('texto', it.x, it.y, c.k, interior, { ...c.opcoes(it), id: it.id, editor: false });
}

/** Triângulo da ponta da seta, com a ponta exatamente no último ponto da rota. */
function ponta(pontos, tamanho) {
  const fim = pontos.at(-1);
  let ant = null;
  for (let i = pontos.length - 2; i >= 0; i--) {
    if (Math.hypot(pontos[i][0] - fim[0], pontos[i][1] - fim[1]) * S > tamanho * 0.4) {
      ant = pontos[i];
      break;
    }
  }
  ant ??= pontos[0];
  const dx = (fim[0] - ant[0]) * S;
  const dy = (fim[1] - ant[1]) * S;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const tx = fim[0] * S;
  const ty = fim[1] * S;
  const bx = tx - ux * tamanho;
  const by = ty - uy * tamanho;
  const l = tamanho * 0.55;
  return `${n(tx)},${n(ty)} ${n(bx - uy * l)},${n(by + ux * l)} ${n(bx + uy * l)},${n(by - ux * l)}`;
}

function caminho(it, c, { rascunho = false } = {}) {
  const cor = corDaFuncao(c.funcoes, it.funcao);
  const k = c.k;
  const pts = it.pontos.map(([x, y]) => `${px(x)},${px(y)}`).join(' ');
  const arremesso = it.estilo === 'arremesso';
  const larg = (arremesso ? 7 : 9) * k;
  const tracejado = arremesso ? ` stroke-dasharray="${n(18 * k)} ${n(13 * k)}"` : '';
  const sel = c.selecionado === it.id;
  const base = `points="${pts}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const { esmaecer } = c.opcoes(it);
  return (
    `<g class="rd-item rd-rota${rascunho ? ' rd-rascunho' : ''}${esmaecer ? ' rd-esmaece' : ''}"${!rascunho && it.id ? ` data-item="${esc(it.id)}"` : ''}${esmaecer ? ' opacity="0.28"' : ''}>` +
    (sel ? `<polyline ${base} stroke="#fff" stroke-width="${n(larg + 9 * k)}"/>` : '') +
    `<polyline ${base} stroke="${TINTA}" stroke-opacity="0.55" stroke-width="${n(larg + 5 * k)}"/>` +
    `<polyline class="rd-linha" ${base} stroke="${cor}" stroke-width="${n(larg)}"${tracejado}${rascunho ? ' stroke-opacity="0.8"' : ''}/>` +
    `<polygon class="rd-seta" points="${ponta(it.pontos, 32 * k)}" fill="${cor}" stroke="${TINTA}" stroke-width="${n(2.5 * k)}" stroke-linejoin="round"/>` +
    (c.editor && !rascunho ? `<polyline ${base} stroke="transparent" stroke-width="${n(46 * k)}"/>` : '') +
    '</g>'
  );
}

function alcas(it, c) {
  const cor = corDaFuncao(c.funcoes, it.funcao);
  const k = c.k;
  // o começo de uma rota que sai de um jogador fica preso a ele: sem alça, para não cobrir a sigla
  const [x0, y0] = it.pontos[0];
  const presa = c.itens.some((j) => j.tipo === 'jogador' && Math.hypot(j.x - x0, j.y - y0) < 0.035);
  return it.pontos
    .map(
      ([x, y], i) =>
        (i === 0 && presa) ? '' : `<g data-alca="${i}"><circle cx="${px(x)}" cy="${px(y)}" r="${n(30 * k)}" fill="transparent"/>` +
        `<circle cx="${px(x)}" cy="${px(y)}" r="${n(14 * k)}" fill="#fff" stroke="${cor}" stroke-width="${n(5 * k)}"/></g>`,
    )
    .join('');
}

const grade = () => {
  const linhas = [];
  for (let v = 100; v < S; v += 100) linhas.push(`<path d="M${v} 0V${S}M0 ${v}H${S}"/>`);
  return (
    `<g stroke="#ffffff" stroke-opacity="0.07" stroke-width="2" fill="none">${linhas.join('')}</g>` +
    `<text x="${S / 2}" y="${S / 2}" text-anchor="middle" dy=".35em" font-size="34" font-weight="700" fill="#ffffff" fill-opacity="0.28">Sem imagem do radar</text>`
  );
};

const contexto = (etapa, { funcoes, destaque = null, vista = { x: 0, y: 0, w: 1 }, editor = false, selecionado = null }) => ({
  funcoes,
  destaque,
  k: vista.w, // marcadores mantêm o tamanho na tela quando há zoom
  editor,
  selecionado,
  itens: etapa?.itens ?? [],
  opcoes: (it) => ({ editor, esmaecer: !!destaque && !!it.funcao && it.funcao !== destaque }),
});

/**
 * Só a camada de itens (rotas, granadas, bomba, textos, jogadores e alças). O editor troca apenas isto ao arrastar,
 * assim a imagem de fundo não é recarregada a cada movimento.
 * @param {{itens: object[]}} etapa
 * @param {object} o mesmas opções de desenharSvg
 */
export function desenharCamada(etapa, o) {
  const c = contexto(etapa, o);
  const de = (tipo) => (tipo === 'jogador' && o.semJogadores ? [] : c.itens.filter((i) => i.tipo === tipo));
  const rota = c.editor && c.selecionado ? c.itens.find((i) => i.id === c.selecionado && i.tipo === 'rota') : null;
  return [
    de('rota').map((i) => caminho(i, c)).join(''),
    o.tracando ? caminho({ ...o.tracando, tipo: 'rota' }, { ...c, selecionado: null }, { rascunho: true }) : '',
    de('bomba').map((i) => bomba(i, c)).join(''),
    de('granada').map((i) => granada(i, c)).join(''),
    de('texto').map((i) => textoNoRadar(i, c)).join(''),
    de('jogador').map((i) => jogador(i, c)).join(''),
    rota ? alcas(rota, c) : '',
  ].join('');
}

/** O recorte visível (zoom e deslocamento), no formato do atributo viewBox. */
export const viewBox = (vista = { x: 0, y: 0, w: 1 }) => `${px(vista.x)} ${px(vista.y)} ${px(vista.w)} ${px(vista.w)}`;

/**
 * @param {{itens: object[]}} etapa
 * @param {object} o
 * @param {{id: string, sigla: string}[]} o.funcoes lista de funções do playbook (define cor e sigla)
 * @param {string|null} [o.imagem] endereço da imagem do radar (relativo, "blob:" ou "data:")
 * @param {string|null} [o.destaque] id da função da pessoa: as outras ficam esmaecidas
 * @param {{x:number,y:number,w:number}} [o.vista] recorte visível em 0–1 (zoom do editor)
 * @param {boolean} [o.editor] liga as áreas de toque e as alças
 * @param {string|null} [o.selecionado] id do item selecionado (só editor)
 * @param {object|null} [o.tracando] rota em andamento (só editor)
 * @param {boolean} [o.semJogadores] só rotas, granadas, bomba e textos (o minimapa já desenha os jogadores como blips)
 */
export function desenharSvg(etapa, o) {
  const { imagem = null, vista = { x: 0, y: 0, w: 1 }, rotulo = 'Radar da tática' } = o;
  return (
    `<svg class="radar-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(vista)}" role="img" aria-label="${esc(rotulo)}">` +
    `<rect width="${S}" height="${S}" fill="#11161d"/>` +
    (imagem
      ? `<image class="rd-imagem" href="${esc(imagem)}" x="0" y="0" width="${S}" height="${S}" preserveAspectRatio="xMidYMid meet"/>`
      : grade()) +
    `<g class="rd-camada">${desenharCamada(etapa, o)}</g></svg>`
  );
}

/** O que aparece nos extras de todas as fases (para a legenda do minimapa; os jogadores já têm os seus chips). */
export function legendaDosExtras(etapas) {
  const itens = (etapas ?? []).flatMap((e) => e?.itens ?? []);
  return {
    granadas: Object.keys(GRANADAS).filter((g) => itens.some((i) => i.tipo === 'granada' && i.granada === g)),
    temBomba: itens.some((i) => i.tipo === 'bomba'),
    temArremesso: itens.some((i) => i.tipo === 'rota' && i.estilo === 'arremesso'),
    temRota: itens.some((i) => i.tipo === 'rota' && i.estilo !== 'arremesso'),
  };
}
