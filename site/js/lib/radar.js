// Modelo do radar: cada tática pode ter um diagrama feito de etapas, e cada etapa guarda
// jogadores (P1–P5), rotas, granadas, a bomba e textos.
//
// As coordenadas vão sempre de 0 a 1 (esquerda→direita, cima→baixo) em relação à imagem do radar.
// Quem monta o radar nunca digita coordenadas: o editor visual (#/editor) cuida disso.
// Este módulo é puro (sem DOM): roda no navegador, no build e nos testes.

export const VERSAO = 1;

export const GRANADAS = {
  smoke: { nome: 'Smoke' },
  flash: { nome: 'Flash' },
  molotov: { nome: 'Molotov' },
  he: { nome: 'HE' },
};

export const ESTILOS_ROTA = {
  rota: { nome: 'Rota' },
  arremesso: { nome: 'Arremesso' },
};

const TIPOS = ['jogador', 'rota', 'granada', 'bomba', 'texto'];
export const LIMITES = { etapas: 12, itens: 60, pontos: 80, titulo: 60, nota: 300, texto: 40 };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Mantém o valor dentro do radar e com 3 casas (1 px em 1000): arquivo pequeno e diffs legíveis. */
export const limitar = (v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 1000) / 1000;

const slug = (v) => (typeof v === 'string' && SLUG.test(v) ? v : null);
const linha = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const paragrafo = (v, max) =>
  typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '';

// --------------------------------------------------------------------- criação
export const novaEtapa = (titulo = '') => ({ titulo, nota: '', itens: [] });
export const novoDiagrama = () => ({ etapas: [novaEtapa()] });
export const clonar = (v) => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------------- limpeza
function pontosValidos(pontos) {
  if (!Array.isArray(pontos)) return null;
  const lista = pontos
    .filter((p) => Array.isArray(p) && ehNumero(p[0]) && ehNumero(p[1]))
    .map((p) => [limitar(p[0]), limitar(p[1])]);
  if (lista.length < 2) return null;
  return lista.length > LIMITES.pontos ? simplificarTraco(lista, 0.004, LIMITES.pontos) : lista;
}

function sanearItem(i) {
  if (!ehObjeto(i)) return null;
  const funcao = slug(i.funcao);
  const temPonto = ehNumero(i.x) && ehNumero(i.y);
  const xy = () => ({ x: limitar(i.x), y: limitar(i.y) });

  switch (i.tipo) {
    case 'jogador':
      return funcao && temPonto ? { tipo: 'jogador', funcao, ...xy() } : null;
    case 'rota': {
      const pontos = pontosValidos(i.pontos);
      if (!pontos) return null;
      return { tipo: 'rota', ...(funcao ? { funcao } : {}), estilo: i.estilo === 'arremesso' ? 'arremesso' : 'rota', pontos };
    }
    case 'granada':
      return GRANADAS[i.granada] && temPonto
        ? { tipo: 'granada', granada: i.granada, ...(funcao ? { funcao } : {}), ...xy() }
        : null;
    case 'bomba':
      return temPonto ? { tipo: 'bomba', ...xy() } : null;
    case 'texto': {
      const texto = linha(i.texto, LIMITES.texto);
      return texto && temPonto ? { tipo: 'texto', texto, ...xy() } : null;
    }
    default:
      return null;
  }
}

/** Aceita qualquer JSON e devolve um diagrama bem formado (descarta o que não faz sentido; tira os `id` do editor). */
export function sanearDiagrama(cru) {
  const etapas = (Array.isArray(cru?.etapas) ? cru.etapas : []).slice(0, LIMITES.etapas).map((e) => ({
    titulo: linha(e?.titulo, LIMITES.titulo),
    nota: paragrafo(e?.nota, LIMITES.nota),
    itens: (Array.isArray(e?.itens) ? e.itens : []).slice(0, LIMITES.itens).map(sanearItem).filter(Boolean),
  }));
  return { etapas };
}

/** Forma canônica para guardar e comparar: sem etapas totalmente vazias. */
export function canonico(diagrama) {
  const { etapas } = sanearDiagrama(diagrama);
  return { etapas: etapas.filter((e) => e.itens.length || e.titulo || e.nota) };
}

export const temConteudo = (diagrama) => !!diagrama?.etapas?.some((e) => e.itens?.length);

export function resumo(diagrama) {
  const etapas = diagrama?.etapas ?? [];
  return { etapas: etapas.length, itens: etapas.reduce((n, e) => n + (e.itens?.length ?? 0), 0) };
}

/** Dá um `id` a cada item (o editor precisa para selecionar). O `id` nunca vai para o arquivo. */
export function comIds(diagrama, gerar) {
  const copia = clonar(diagrama);
  for (const e of copia.etapas) for (const i of e.itens) i.id = gerar();
  return copia;
}

// ------------------------------------------------------------------- geometria
export function distanciaAoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const tam2 = dx * dx + dy * dy;
  const t = tam2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / tam2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export const comprimento = (pontos) => pontos.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pontos[i - 1][0], p[1] - pontos[i - 1][1]) : 0), 0);

/**
 * Simplifica um traço feito à mão (Ramer–Douglas–Peucker): de dezenas de pontos do dedo
 * sobra um caminho limpo, com poucos pontos que dá para ajustar um a um.
 * Se ainda passar de `maximo`, aumenta a tolerância até caber.
 */
export function simplificarTraco(pontos, tolerancia = 0.006, maximo = LIMITES.pontos) {
  const arredondar = (p) => [limitar(p[0]), limitar(p[1])];
  if (pontos.length < 3) return pontos.map(arredondar);

  const ultimo = pontos.length - 1;
  let eps = tolerancia;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const manter = new Uint8Array(pontos.length);
    manter[0] = manter[ultimo] = 1;
    const pilha = [[0, ultimo]];
    while (pilha.length) {
      const [a, b] = pilha.pop();
      let maior = 0;
      let indice = -1;
      for (let i = a + 1; i < b; i++) {
        const d = distanciaAoSegmento(pontos[i], pontos[a], pontos[b]);
        if (d > maior) {
          maior = d;
          indice = i;
        }
      }
      if (indice >= 0 && maior > eps) {
        manter[indice] = 1;
        pilha.push([a, indice], [indice, b]);
      }
    }
    const resultado = pontos.filter((_, i) => manter[i]);
    if (resultado.length <= maximo) return resultado.map(arredondar);
    eps *= 1.5;
  }
  return [pontos[0], pontos[ultimo]].map(arredondar);
}

// -------------------------------------------------------------------- etapas
/** Nova etapa que continua de onde esta terminou: cada jogador vai para o fim da sua rota; granadas, rotas e textos ficam para trás. */
export function etapaContinuando(etapa) {
  const nova = novaEtapa('');
  for (const j of etapa.itens.filter((i) => i.tipo === 'jogador')) {
    const rotas = etapa.itens.filter((i) => i.tipo === 'rota' && i.estilo !== 'arremesso' && i.funcao === j.funcao);
    const fim = rotas.at(-1)?.pontos.at(-1);
    nova.itens.push({ tipo: 'jogador', funcao: j.funcao, x: fim ? fim[0] : j.x, y: fim ? fim[1] : j.y });
  }
  for (const b of etapa.itens.filter((i) => i.tipo === 'bomba')) nova.itens.push({ tipo: 'bomba', x: b.x, y: b.y });
  return nova;
}

// ------------------------------------------------------------ desfazer / refazer
export class Historico {
  constructor(inicial, limite = 100) {
    this.pilha = [JSON.stringify(inicial)];
    this.i = 0;
    this.limite = limite;
  }

  /** @returns {boolean} false se nada mudou desde o último registro */
  registrar(estado) {
    const s = JSON.stringify(estado);
    if (s === this.pilha[this.i]) return false;
    this.pilha.length = this.i + 1;
    this.pilha.push(s);
    if (this.pilha.length > this.limite) this.pilha.shift();
    this.i = this.pilha.length - 1;
    return true;
  }

  podeDesfazer() {
    return this.i > 0;
  }

  podeRefazer() {
    return this.i < this.pilha.length - 1;
  }

  desfazer() {
    return this.podeDesfazer() ? JSON.parse(this.pilha[--this.i]) : null;
  }

  refazer() {
    return this.podeRefazer() ? JSON.parse(this.pilha[++this.i]) : null;
  }
}

// ----------------------------------------------------------------- arquivo
/** O que vale para cada tática: o salvo no aparelho vence o publicado no site. */
export function mesclarRadares(site = {}, local = {}) {
  return { ...site, ...local };
}

const texto = (s) => JSON.stringify(s);

/**
 * Escreve o radares.json com um item por linha: o arquivo fica compacto e o diff do GitHub mostra
 * exatamente o que mudou. Diagramas sem nenhum item não vão para o arquivo.
 */
export function formatarArquivo({ imagens = {}, radares = {} } = {}) {
  const mapas = Object.keys(imagens).sort();
  const ids = Object.keys(radares)
    .sort()
    .filter((id) => temConteudo(radares[id]));

  const blocoImagens = mapas.length
    ? `{\n${mapas.map((m) => `    ${texto(m)}: ${texto(imagens[m])}`).join(',\n')}\n  }`
    : '{}';

  const blocoRadares = ids.length
    ? `{\n${ids
        .map((id) => {
          const etapas = canonico(radares[id]).etapas.map((e) => {
            const campos = [];
            if (e.titulo) campos.push(`          "titulo": ${texto(e.titulo)}`);
            if (e.nota) campos.push(`          "nota": ${texto(e.nota)}`);
            campos.push(
              e.itens.length
                ? `          "itens": [\n${e.itens.map((i) => `            ${texto(i)}`).join(',\n')}\n          ]`
                : '          "itens": []',
            );
            return `        {\n${campos.join(',\n')}\n        }`;
          });
          return `    ${texto(id)}: {\n      "etapas": [\n${etapas.join(',\n')}\n      ]\n    }`;
        })
        .join(',\n')}\n  }`
    : '{}';

  return `{\n  "versao": ${VERSAO},\n  "imagens": ${blocoImagens},\n  "radares": ${blocoRadares}\n}\n`;
}

/** Lê o conteúdo cru do arquivo já limpo (usado ao carregar e ao importar). */
export function lerArquivo(cru) {
  const imagens = {};
  if (ehObjeto(cru?.imagens)) {
    for (const [mapa, caminho] of Object.entries(cru.imagens)) {
      if (slug(mapa) && typeof caminho === 'string' && caminhoRelativo(caminho)) imagens[mapa] = caminho;
    }
  }
  const radares = {};
  if (ehObjeto(cru?.radares)) {
    for (const [id, d] of Object.entries(cru.radares)) {
      const limpo = sanearDiagrama(d);
      if (slug(id) && temConteudo(limpo)) radares[id] = limpo;
    }
  }
  return { imagens, radares };
}

export const caminhoRelativo = (c) => typeof c === 'string' && c.trim() !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(c) && !c.split('/').includes('..');

// -------------------------------------------------------------------- validação
/**
 * Confere o conteúdo do radares.json (build, testes e `npm run validar`).
 * @param {object} dados
 * @param {{taticas?: Set<string>, funcoes?: Set<string>, mapas?: Set<string>}} contexto ids que existem no playbook
 */
export function validarRadares(dados, { taticas = null, funcoes = null, mapas = null } = {}) {
  const erros = [];
  const avisos = [];

  if (!ehObjeto(dados)) return { erros: ['radares.json precisa conter um objeto JSON.'], avisos };
  if (dados.versao !== VERSAO) erros.push(`radares.json: "versao" precisa ser ${VERSAO}.`);

  if (dados.imagens !== undefined) {
    if (!ehObjeto(dados.imagens)) erros.push('"imagens" precisa ser um objeto { "mirage": "img/radar/mirage.webp" }.');
    for (const [mapa, caminho] of Object.entries(ehObjeto(dados.imagens) ? dados.imagens : {})) {
      if (mapas && !mapas.has(mapa)) erros.push(`imagens: o mapa "${mapa}" não existe em "mapas".`);
      if (!caminhoRelativo(caminho)) erros.push(`imagens.${mapa}: precisa ser um caminho relativo (ex.: "img/radar/${mapa}.webp").`);
    }
  }

  if (!ehObjeto(dados.radares)) {
    erros.push('"radares" precisa ser um objeto com um diagrama por tática.');
    return { erros, avisos };
  }

  for (const [id, d] of Object.entries(dados.radares)) {
    const nome = `radar "${id}"`;
    if (taticas && !taticas.has(id)) avisos.push(`${nome}: a tática não existe mais no playbook (o radar é ignorado).`);
    if (!Array.isArray(d?.etapas) || !d.etapas.length) {
      erros.push(`${nome}: precisa de "etapas" com ao menos uma etapa.`);
      continue;
    }
    if (d.etapas.length > LIMITES.etapas) erros.push(`${nome}: no máximo ${LIMITES.etapas} etapas.`);

    d.etapas.forEach((e, ei) => {
      const lugar = `${nome}, etapa ${ei + 1}`;
      if (!Array.isArray(e?.itens)) return erros.push(`${lugar}: "itens" precisa ser uma lista.`);
      if (e.itens.length > LIMITES.itens) erros.push(`${lugar}: no máximo ${LIMITES.itens} itens.`);
      if (e.titulo !== undefined && typeof e.titulo !== 'string') erros.push(`${lugar}: "titulo" precisa ser um texto.`);
      if (e.nota !== undefined && typeof e.nota !== 'string') erros.push(`${lugar}: "nota" precisa ser um texto.`);

      const jogadores = new Set();
      e.itens.forEach((i, ii) => {
        const onde = `${lugar}, item ${ii + 1}`;
        if (!ehObjeto(i) || !TIPOS.includes(i.tipo)) return erros.push(`${onde}: "tipo" precisa ser ${TIPOS.join(', ')}.`);

        const coordenada = (v, eixo) => {
          if (!ehNumero(v) || v < 0 || v > 1) erros.push(`${onde}: "${eixo}" precisa ser um número de 0 a 1.`);
        };
        if (i.tipo !== 'rota') {
          coordenada(i.x, 'x');
          coordenada(i.y, 'y');
        }
        if (i.funcao !== undefined && funcoes && !funcoes.has(i.funcao)) erros.push(`${onde}: a função "${i.funcao}" não existe em "funcoes".`);

        if (i.tipo === 'jogador') {
          if (!i.funcao) erros.push(`${onde}: jogador precisa de "funcao".`);
          else if (jogadores.has(i.funcao)) erros.push(`${onde}: o jogador "${i.funcao}" aparece duas vezes na mesma etapa.`);
          jogadores.add(i.funcao);
        }
        if (i.tipo === 'granada' && !GRANADAS[i.granada]) erros.push(`${onde}: "granada" precisa ser ${Object.keys(GRANADAS).join(', ')}.`);
        if (i.tipo === 'texto' && !(typeof i.texto === 'string' && i.texto.trim() && i.texto.length <= LIMITES.texto)) {
          erros.push(`${onde}: "texto" precisa ter de 1 a ${LIMITES.texto} caracteres.`);
        }
        if (i.tipo === 'rota') {
          if (i.estilo !== undefined && !ESTILOS_ROTA[i.estilo]) erros.push(`${onde}: "estilo" precisa ser ${Object.keys(ESTILOS_ROTA).join(' ou ')}.`);
          const ok = Array.isArray(i.pontos) && i.pontos.length >= 2 && i.pontos.length <= LIMITES.pontos
            && i.pontos.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => ehNumero(v) && v >= 0 && v <= 1));
          if (!ok) erros.push(`${onde}: "pontos" precisa ter de 2 a ${LIMITES.pontos} pares [x, y] entre 0 e 1.`);
        }
      });
    });
  }
  return { erros, avisos };
}
