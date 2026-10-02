// Modelo do radar: cada tática pode ter um diagrama feito de etapas (as "fases" do minimapa), e cada etapa guarda
// jogadores (P1–P5), rotas, granadas, a bomba e textos.
//
// Dentro do app (editor, localStorage) as coordenadas vão de 0 a 1 (esquerda→direita, cima→baixo) em relação à imagem
// do radar. No arquivo `radares.json` elas são % (0 a 100), o mesmo formato de `posicoes` do playbook.json.
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
/** O minimapa mostra de 1 a 4 fases (Setup, Execução, Plant…). */
export const MAX_FASES = 4;
export const LIMITES = { etapas: MAX_FASES, itens: 60, pontos: 80, titulo: 60, nota: 300, texto: 40 };

/** Nomes das fases quando a tática não define os seus (os mesmos que o minimapa usa). */
export const FASES_PADRAO = { 2: ['Início', 'Final'], 3: ['Setup', 'Execução', 'Plant'], 4: ['Setup', 'Meio', 'Execução', 'Plant'] };
export const nomeDaFase = (total, i) => FASES_PADRAO[total]?.[i] ?? `Fase ${i + 1}`;

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

// ------------------------------------------------- do diagrama para o formato do arquivo
const pct = (v) => Math.round(v * 1000) / 10; // 0–1 → % com 1 casa
const dePct = (v) => limitar(v / 100);

function itemParaPct(item) {
  const { x, y, pontos, ...resto } = item;
  return pontos ? { ...resto, pontos: pontos.map(([a, b]) => [pct(a), pct(b)]) } : { ...resto, x: pct(x), y: pct(y) };
}

function itemDePct(item) {
  if (!ehObjeto(item)) return null;
  if (Array.isArray(item.pontos)) {
    return { ...item, pontos: item.pontos.map((p) => (Array.isArray(p) ? [Number(p[0]) / 100, Number(p[1]) / 100] : p)) };
  }
  return { ...item, x: Number(item.x) / 100, y: Number(item.y) / 100 };
}

/**
 * Posição de cada jogador em cada fase, em % (o formato `posicoes` do playbook.json). Quem não foi posicionado numa fase
 * fica onde estava na anterior, porque o minimapa precisa de um ponto por fase para todos.
 * @returns {{posicoes: Record<string, number[][]>, fases?: string[]}}
 */
export function posicoesDoDiagrama(diagrama, ordem = []) {
  const { etapas } = canonico(diagrama);
  const ids = [];
  for (const e of etapas) for (const i of e.itens) if (i.tipo === 'jogador' && !ids.includes(i.funcao)) ids.push(i.funcao);
  const lugar = (id) => (ordem.includes(id) ? ordem.indexOf(id) : ordem.length);
  ids.sort((a, b) => lugar(a) - lugar(b) || a.localeCompare(b));

  const posicoes = {};
  for (const funcao of ids) {
    const pontos = etapas.map((e) => e.itens.find((i) => i.tipo === 'jogador' && i.funcao === funcao));
    let ultimo = pontos.find(Boolean);
    posicoes[funcao] = pontos.map((j) => {
      if (j) ultimo = j;
      return [pct(ultimo.x), pct(ultimo.y)];
    });
  }

  const titulos = etapas.map((e) => e.titulo);
  return {
    posicoes,
    ...(titulos.some(Boolean) ? { fases: titulos.map((t, i) => t || nomeDaFase(etapas.length, i)) } : {}),
  };
}

/** Diagrama interno → entrada do radares.json: `posicoes` (% por fase) + `fases`, `notas` e `extras` quando existirem. */
export function paraEntrada(diagrama, ordem = []) {
  const { etapas } = canonico(diagrama);
  if (!etapas.some((e) => e.itens.length)) return null;
  const { posicoes, fases } = posicoesDoDiagrama(diagrama, ordem);
  const notas = etapas.map((e) => e.nota);
  const extras = etapas.map((e) => e.itens.filter((i) => i.tipo !== 'jogador').map(itemParaPct));
  return {
    ...(fases ? { fases } : {}),
    posicoes,
    ...(notas.some(Boolean) ? { notas } : {}),
    ...(extras.some((g) => g.length) ? { extras } : {}),
  };
}

/** Entrada do radares.json (ou { posicoes, fases } escritos à mão no playbook.json) → diagrama interno editável. */
export function deEntrada(entrada) {
  if (!ehObjeto(entrada)) return { etapas: [] };
  const posicoes = ehObjeto(entrada.posicoes) ? entrada.posicoes : {};
  const extras = Array.isArray(entrada.extras) ? entrada.extras : [];
  const notas = Array.isArray(entrada.notas) ? entrada.notas : [];
  const fases = Array.isArray(entrada.fases) ? entrada.fases : [];
  const n = Math.min(
    MAX_FASES,
    Math.max(0, ...Object.values(posicoes).map((l) => (Array.isArray(l) ? l.length : 0)), extras.length, notas.length, fases.length),
  );

  const etapas = Array.from({ length: n }, (_, i) => ({ titulo: linha(fases[i], LIMITES.titulo), nota: paragrafo(notas[i], LIMITES.nota), itens: [] }));
  for (const [funcao, lista] of Object.entries(posicoes)) {
    if (!slug(funcao) || !Array.isArray(lista)) continue;
    lista.slice(0, n).forEach((p, i) => {
      if (Array.isArray(p) && ehNumero(p[0]) && ehNumero(p[1])) etapas[i].itens.push({ tipo: 'jogador', funcao, x: dePct(p[0]), y: dePct(p[1]) });
    });
  }
  extras.slice(0, n).forEach((grupo, i) => {
    for (const bruto of Array.isArray(grupo) ? grupo : []) {
      const item = sanearItem(itemDePct(bruto));
      if (item && item.tipo !== 'jogador') etapas[i].itens.push(item);
    }
  });
  return sanearDiagrama({ etapas });
}

// ----------------------------------------------------------------- arquivo
/** O que vale para cada tática: o salvo no aparelho vence o publicado no site. */
export function mesclarRadares(site = {}, local = {}) {
  return { ...site, ...local };
}

const texto = (s) => JSON.stringify(s);
const listaDePontos = (l) => texto(l).replace(/,/g, ', '); // [[22, 70], [62, 44]]: só números, então o espaço é seguro

function camposDaEntrada(e) {
  const campos = [];
  if (e.fases) campos.push(`      "fases": ${texto(e.fases)}`);
  const jogadores = Object.entries(e.posicoes);
  campos.push(
    jogadores.length
      ? `      "posicoes": {\n${jogadores.map(([f, l]) => `        ${texto(f)}: ${listaDePontos(l)}`).join(',\n')}\n      }`
      : '      "posicoes": {}',
  );
  if (e.notas) campos.push(`      "notas": ${texto(e.notas)}`);
  if (e.extras) {
    const grupos = e.extras.map((g) => (g.length ? `        [\n${g.map((i) => `          ${texto(i)}`).join(',\n')}\n        ]` : '        []'));
    campos.push(`      "extras": [\n${grupos.join(',\n')}\n      ]`);
  }
  return campos.join(',\n');
}

/**
 * Escreve o radares.json: um jogador por linha em `posicoes` e um item por linha em `extras`, então o diff do GitHub mostra
 * exatamente o que mudou. Diagramas sem nenhum item não vão para o arquivo.
 * @param {{imagens?: object, radares?: Record<string, object>, funcoes?: string[]}} o `funcoes`: ids na ordem do playbook (P1…P5)
 */
export function formatarArquivo({ imagens = {}, radares = {}, funcoes = [] } = {}) {
  const mapas = Object.keys(imagens).sort();
  const entradas = Object.keys(radares)
    .sort()
    .map((id) => [id, paraEntrada(radares[id], funcoes)])
    .filter(([, e]) => e);

  const blocoImagens = mapas.length
    ? `{\n${mapas.map((m) => `    ${texto(m)}: ${texto(imagens[m])}`).join(',\n')}\n  }`
    : '{}';
  const blocoRadares = entradas.length
    ? `{\n${entradas.map(([id, e]) => `    ${texto(id)}: {\n${camposDaEntrada(e)}\n    }`).join(',\n')}\n  }`
    : '{}';

  return `{\n  "versao": ${VERSAO},\n  "imagens": ${blocoImagens},\n  "radares": ${blocoRadares}\n}\n`;
}

/** Lê o conteúdo cru do arquivo e devolve diagramas internos já limpos (usado ao carregar e ao importar). */
export function lerArquivo(cru) {
  const imagens = {};
  if (ehObjeto(cru?.imagens)) {
    for (const [mapa, caminho] of Object.entries(cru.imagens)) {
      if (slug(mapa) && typeof caminho === 'string' && caminhoRelativo(caminho)) imagens[mapa] = caminho;
    }
  }
  const radares = {};
  if (ehObjeto(cru?.radares)) {
    for (const [id, entrada] of Object.entries(cru.radares)) {
      const diagrama = deEntrada(entrada);
      if (slug(id) && temConteudo(diagrama)) radares[id] = diagrama;
    }
  }
  return { imagens, radares };
}

/**
 * Põe as mudanças (por tática) no conteúdo do radares.json que está no repositório e devolve o texto novo.
 * Parte do arquivo atual, não do que este aparelho carregou: assim não apaga o que outra pessoa publicou nesse meio-tempo.
 * @param {string|null} texto conteúdo atual do arquivo (null se ainda não existe)
 * @param {Record<string, object|null>} mudancas diagrama novo por tática; sem conteúdo (ou null) tira o radar do arquivo
 * @param {string[]} funcoes ids na ordem do playbook (P1…P5)
 */
export function aplicarMudancasRadares(texto, mudancas, funcoes = []) {
  let cru = {};
  if (texto) {
    try {
      cru = JSON.parse(texto);
    } catch {
      throw new Error('O radares.json que está no GitHub tem erro de JSON. Corrija lá antes de publicar.');
    }
  }
  const { imagens, radares } = lerArquivo(cru);
  for (const [id, diagrama] of Object.entries(mudancas)) {
    if (diagrama && temConteudo(diagrama)) radares[id] = sanearDiagrama(diagrama);
    else delete radares[id];
  }
  return formatarArquivo({ imagens, radares, funcoes });
}

export const caminhoRelativo = (c) => typeof c === 'string' && c.trim() !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(c) && !c.split('/').includes('..');

// -------------------------------------------------------------------- validação
const EXTRAS = TIPOS.filter((t) => t !== 'jogador');

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
    erros.push('"radares" precisa ser um objeto com uma entrada por tática.');
    return { erros, avisos };
  }

  const par = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => ehNumero(v) && v >= 0 && v <= 100);

  for (const [id, e] of Object.entries(dados.radares)) {
    const nome = `radar "${id}"`;
    if (taticas && !taticas.has(id)) avisos.push(`${nome}: a tática não existe mais no playbook (o radar é ignorado).`);
    if (!ehObjeto(e)) {
      erros.push(`${nome}: precisa ser um objeto com "posicoes" (e, se quiser, "fases", "notas" e "extras").`);
      continue;
    }

    // posicoes: { p1: [[x, y], ...], ... } em % do radar, um ponto por fase, igual para todos
    const tamanhos = new Set();
    if (e.posicoes !== undefined && !ehObjeto(e.posicoes)) erros.push(`${nome}: "posicoes" precisa ser { "p1": [[x, y], …], … }.`);
    for (const [f, lista] of Object.entries(ehObjeto(e.posicoes) ? e.posicoes : {})) {
      if (funcoes && !funcoes.has(f)) erros.push(`${nome}: posicoes."${f}" não é uma função cadastrada.`);
      if (!(Array.isArray(lista) && lista.length >= 1 && lista.length <= MAX_FASES && lista.every(par))) {
        erros.push(`${nome}: posicoes."${f}" precisa ter de 1 a ${MAX_FASES} pontos [x, y] com valores de 0 a 100.`);
      } else {
        tamanhos.add(lista.length);
      }
    }
    if (tamanhos.size > 1) erros.push(`${nome}: todos os jogadores de "posicoes" precisam ter o mesmo número de fases.`);

    // fases, notas e extras: uma entrada por fase
    for (const [campo, valor] of Object.entries({ fases: e.fases, notas: e.notas, extras: e.extras })) {
      if (valor === undefined) continue;
      if (!Array.isArray(valor) || valor.length < 1 || valor.length > MAX_FASES) {
        erros.push(`${nome}: "${campo}" precisa ser uma lista com uma entrada por fase (de 1 a ${MAX_FASES}).`);
      } else {
        tamanhos.add(valor.length);
      }
    }
    if (tamanhos.size > 1) erros.push(`${nome}: "posicoes", "fases", "notas" e "extras" precisam ter o mesmo número de fases.`);
    if (Array.isArray(e.fases) && !e.fases.every((t) => typeof t === 'string' && t.trim() && t.length <= LIMITES.titulo)) {
      erros.push(`${nome}: cada nome em "fases" precisa ter de 1 a ${LIMITES.titulo} caracteres.`);
    }
    if (Array.isArray(e.notas) && !e.notas.every((t) => typeof t === 'string' && t.length <= LIMITES.nota)) {
      erros.push(`${nome}: cada texto em "notas" precisa ser um texto de até ${LIMITES.nota} caracteres.`);
    }

    let algo = tamanhos.size > 0 && ehObjeto(e.posicoes) && Object.keys(e.posicoes).length > 0;
    (Array.isArray(e.extras) ? e.extras : []).forEach((grupo, fi) => {
      const lugar = `${nome}, fase ${fi + 1}`;
      if (!Array.isArray(grupo)) return erros.push(`${lugar}: "extras" precisa ter uma lista de itens por fase.`);
      if (grupo.length > LIMITES.itens) erros.push(`${lugar}: no máximo ${LIMITES.itens} itens.`);
      grupo.forEach((i, ii) => {
        const onde = `${lugar}, item ${ii + 1}`;
        algo = true;
        if (ehObjeto(i) && i.tipo === 'jogador') return erros.push(`${onde}: jogadores vão em "posicoes", não em "extras".`);
        if (!ehObjeto(i) || !EXTRAS.includes(i.tipo)) return erros.push(`${onde}: "tipo" precisa ser ${EXTRAS.join(', ')}.`);

        if (i.tipo !== 'rota') {
          for (const eixo of ['x', 'y']) if (!ehNumero(i[eixo]) || i[eixo] < 0 || i[eixo] > 100) erros.push(`${onde}: "${eixo}" precisa ser um número de 0 a 100.`);
        }
        if (i.funcao !== undefined && funcoes && !funcoes.has(i.funcao)) erros.push(`${onde}: a função "${i.funcao}" não existe em "funcoes".`);
        if (i.tipo === 'granada' && !GRANADAS[i.granada]) erros.push(`${onde}: "granada" precisa ser ${Object.keys(GRANADAS).join(', ')}.`);
        if (i.tipo === 'texto' && !(typeof i.texto === 'string' && i.texto.trim() && i.texto.length <= LIMITES.texto)) {
          erros.push(`${onde}: "texto" precisa ter de 1 a ${LIMITES.texto} caracteres.`);
        }
        if (i.tipo === 'rota') {
          if (i.estilo !== undefined && !ESTILOS_ROTA[i.estilo]) erros.push(`${onde}: "estilo" precisa ser ${Object.keys(ESTILOS_ROTA).join(' ou ')}.`);
          if (!(Array.isArray(i.pontos) && i.pontos.length >= 2 && i.pontos.length <= LIMITES.pontos && i.pontos.every(par))) {
            erros.push(`${onde}: "pontos" precisa ter de 2 a ${LIMITES.pontos} pares [x, y] entre 0 e 100.`);
          }
        }
      });
    });
    if (!algo && !erros.some((m) => m.startsWith(nome))) erros.push(`${nome}: sem nenhuma posição nem extra.`);
  }
  return { erros, avisos };
}
