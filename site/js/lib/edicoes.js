// Edições do texto das táticas: o time melhora uma tática com o tempo sem mexer no playbook.json.
//
// Cada edição guarda só os campos que mudaram, por cima do que está no playbook.json (que continua sendo o
// texto importado do PDF). Dá para voltar ao original a qualquer hora, e o que o PDF não mudou continua valendo.
// Este módulo é puro (sem DOM): roda no navegador, no build e nos testes.

export const VERSAO = 1;
export const LIMITES = { titulo: 80, texto: 600 };

/** Campos que a edição pode mudar (o id, o mapa e o número da tática não mudam). */
export const CAMPOS_TEXTO = ['objetivo', 'economia', 'posPlant', 'planoB'];
export const SITES = ['A', 'B'];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const CHAVES = ['atualizadoEm', 'titulo', 'tipos', 'alvo', 'objetivo', 'economia', 'funcoes', 'posPlant', 'planoB'];

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const slug = (v) => typeof v === 'string' && SLUG.test(v);
const colapsar = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const ordenarSites = (alvo) => SITES.filter((s) => alvo.includes(s));

// ------------------------------------------------------------ valores do formulário
/** Os campos editáveis de uma tática, no formato que o formulário usa. */
export function camposDaTatica(t) {
  return {
    titulo: t?.titulo ?? '',
    tipos: [...(t?.tipos ?? [])],
    alvo: ordenarSites(t?.alvo ?? []),
    objetivo: t?.objetivo ?? '',
    economia: t?.economia ?? '',
    funcoes: { ...(t?.funcoes ?? {}) },
    posPlant: t?.posPlant ?? '',
    planoB: t?.planoB ?? '',
  };
}

/** Texto como será gravado: espaços repetidos viram um só. */
export function limparValores(v) {
  const texto = (s, max = LIMITES.texto) => colapsar(s, max);
  return {
    titulo: texto(v.titulo, LIMITES.titulo),
    tipos: [...new Set((v.tipos ?? []).filter(slug))],
    alvo: ordenarSites(v.alvo ?? []),
    objetivo: texto(v.objetivo),
    economia: texto(v.economia),
    funcoes: Object.fromEntries(Object.entries(v.funcoes ?? {}).filter(([k]) => slug(k)).map(([k, s]) => [k, texto(s)])),
    posPlant: texto(v.posPlant),
    planoB: texto(v.planoB),
  };
}

/** Junta um rascunho cru (qualquer JSON) sobre os valores de partida; só aceita campos conhecidos e do tipo certo. */
export function mesclarValores(base, cru) {
  if (!ehObjeto(cru)) return base;
  const v = { ...base, funcoes: { ...base.funcoes } };
  for (const c of ['titulo', ...CAMPOS_TEXTO]) if (typeof cru[c] === 'string') v[c] = cru[c].slice(0, LIMITES.texto);
  if (Array.isArray(cru.tipos)) v.tipos = cru.tipos.filter(slug);
  if (Array.isArray(cru.alvo)) v.alvo = ordenarSites(cru.alvo);
  if (ehObjeto(cru.funcoes)) for (const [k, s] of Object.entries(cru.funcoes)) if (k in v.funcoes && typeof s === 'string') v.funcoes[k] = s.slice(0, LIMITES.texto);
  return v;
}

/** Erros do formulário por campo (`funcoes.p1`, `titulo`…), para mostrar embaixo de cada um. Vazio = pode salvar. */
export function validarFormulario(v, funcoes = []) {
  const erros = {};
  const texto = (chave, valor, { obrigatorio, max }) => {
    const s = (valor ?? '').trim();
    if (obrigatorio && !s) erros[chave] = 'Preencha este campo.';
    else if (s.length > max) erros[chave] = `Use no máximo ${max} caracteres.`;
  };
  texto('titulo', v.titulo, { obrigatorio: true, max: LIMITES.titulo });
  if (!erros.titulo && /^\d+\.\s/.test(v.titulo.trim())) erros.titulo = 'Não comece o título com número: o número da tática já aparece ao lado.';
  texto('objetivo', v.objetivo, { obrigatorio: true, max: LIMITES.texto });
  for (const c of ['economia', 'posPlant', 'planoB']) texto(c, v[c], { obrigatorio: false, max: LIMITES.texto });
  for (const f of funcoes) texto(`funcoes.${f}`, v.funcoes?.[f], { obrigatorio: true, max: LIMITES.texto });
  if (!v.tipos?.length) erros.tipos = 'Escolha ao menos um tipo.';
  return erros;
}

// ------------------------------------------------------------ edição = só o que mudou
/** Campos de `atual` que diferem de `base`. Resultado vazio = nenhuma mudança. */
export function diferencas(base, atual) {
  const d = {};
  if (atual.titulo !== undefined && atual.titulo !== base.titulo) d.titulo = atual.titulo;
  if (atual.tipos !== undefined && JSON.stringify(atual.tipos) !== JSON.stringify(base.tipos)) d.tipos = atual.tipos;
  if (atual.alvo !== undefined && JSON.stringify(atual.alvo) !== JSON.stringify(base.alvo)) d.alvo = atual.alvo;
  if (atual.objetivo !== undefined && atual.objetivo !== base.objetivo) d.objetivo = atual.objetivo;
  if (atual.economia !== undefined && atual.economia !== base.economia) d.economia = atual.economia;
  const funcoes = Object.fromEntries(Object.entries(atual.funcoes ?? {}).filter(([k, s]) => s !== base.funcoes?.[k]));
  if (Object.keys(funcoes).length) d.funcoes = funcoes;
  if (atual.posPlant !== undefined && atual.posPlant !== base.posPlant) d.posPlant = atual.posPlant;
  if (atual.planoB !== undefined && atual.planoB !== base.planoB) d.planoB = atual.planoB;
  return d;
}

/** Aceita qualquer JSON e devolve uma edição bem formada (só campos conhecidos, na ordem do arquivo). */
export function sanearEdicao(cru) {
  if (!ehObjeto(cru)) return {};
  const e = {};
  if (typeof cru.atualizadoEm === 'string' && DATA.test(cru.atualizadoEm)) e.atualizadoEm = cru.atualizadoEm;
  const titulo = colapsar(cru.titulo, LIMITES.titulo);
  if (titulo) e.titulo = titulo;
  if (Array.isArray(cru.tipos)) {
    const tipos = [...new Set(cru.tipos.filter(slug))];
    if (tipos.length) e.tipos = tipos;
  }
  if (Array.isArray(cru.alvo)) e.alvo = ordenarSites(cru.alvo); // vazio vale: "o site é decidido na hora"
  const objetivo = colapsar(cru.objetivo, LIMITES.texto);
  if (objetivo) e.objetivo = objetivo;
  if (typeof cru.economia === 'string') e.economia = colapsar(cru.economia, LIMITES.texto);
  if (ehObjeto(cru.funcoes)) {
    const funcoes = Object.fromEntries(
      Object.entries(cru.funcoes).filter(([k]) => slug(k)).map(([k, s]) => [k, colapsar(s, LIMITES.texto)]).filter(([, s]) => s),
    );
    if (Object.keys(funcoes).length) e.funcoes = funcoes;
  }
  for (const c of ['posPlant', 'planoB']) if (typeof cru[c] === 'string') e[c] = colapsar(cru[c], LIMITES.texto);
  return e;
}

export const temEdicao = (e) => !!e && Object.keys(e).some((k) => k !== 'atualizadoEm');
const semData = ({ atualizadoEm, ...resto }) => resto;
/** Mesma edição, sem contar a data. */
export const mesmaEdicao = (a, b) => JSON.stringify(semData(sanearEdicao(a))) === JSON.stringify(semData(sanearEdicao(b)));

/** A tática com a edição por cima. Sem edição, a mesma tática. */
export function aplicarEdicao(t, e) {
  if (!temEdicao(e)) return t;
  const { atualizadoEm, funcoes, ...resto } = e;
  return { ...t, ...resto, funcoes: { ...t.funcoes, ...(funcoes ?? {}) } };
}

/**
 * Aplica as edições no conteúdo cru do playbook.json (antes de montar o índice, para a busca enxergar o texto novo).
 * A tática editada ganha `edicao: { origem, atualizadoEm, campos }`, que a tela usa para mostrar "Atualizada em…".
 * @param {Record<string, object>} edicoes por id da tática
 * @param {Record<string, 'aparelho'|'site'>} origens
 */
export function aplicarEdicoes(cru, edicoes = {}, origens = {}) {
  if (!Array.isArray(cru?.taticas)) return cru;
  return {
    ...cru,
    taticas: cru.taticas.map((t) => {
      const e = edicoes[t.id];
      if (!temEdicao(e)) return t;
      return {
        ...aplicarEdicao(t, e),
        edicao: { origem: origens[t.id] ?? 'site', atualizadoEm: e.atualizadoEm ?? null, campos: Object.keys(semData(e)) },
      };
    }),
  };
}

// ------------------------------------------------------------------- arquivo
const texto = (s) => JSON.stringify(s);

function camposDoArquivo(e) {
  const linhas = [];
  for (const chave of CHAVES) {
    if (e[chave] === undefined) continue;
    if (chave === 'funcoes') {
      linhas.push(`      "funcoes": {\n${Object.entries(e.funcoes).map(([k, s]) => `        ${texto(k)}: ${texto(s)}`).join(',\n')}\n      }`);
    } else {
      linhas.push(`      ${texto(chave)}: ${texto(e[chave])}`);
    }
  }
  return linhas.join(',\n');
}

/** Escreve o edicoes.json: um campo por linha (e uma função por linha), então o diff do GitHub mostra o que mudou. */
export function formatarArquivo(edicoes = {}) {
  const ids = Object.keys(edicoes).sort().filter((id) => temEdicao(sanearEdicao(edicoes[id])));
  const bloco = ids.length
    ? `{\n${ids.map((id) => `    ${texto(id)}: {\n${camposDoArquivo(sanearEdicao(edicoes[id]))}\n    }`).join(',\n')}\n  }`
    : '{}';
  return `{\n  "versao": ${VERSAO},\n  "taticas": ${bloco}\n}\n`;
}

/** Lê o conteúdo cru do arquivo já limpo: { id: edição }. Edições vazias ou com id inválido ficam de fora. */
export function lerArquivo(cru) {
  const edicoes = {};
  if (ehObjeto(cru?.taticas)) {
    for (const [id, bruta] of Object.entries(cru.taticas)) {
      const e = sanearEdicao(bruta);
      if (slug(id) && temEdicao(e)) edicoes[id] = e;
    }
  }
  return edicoes;
}

// ----------------------------------------------------------------- validação
/**
 * Confere o conteúdo do edicoes.json (build, testes e `npm run validar`).
 * @param {{taticas?: Set<string>, funcoes?: Set<string>, tipos?: Set<string>}} contexto ids que existem no playbook
 */
export function validarEdicoes(dados, { taticas = null, funcoes = null, tipos = null } = {}) {
  const erros = [];
  const avisos = [];
  if (!ehObjeto(dados)) return { erros: ['edicoes.json precisa conter um objeto JSON.'], avisos };
  if (dados.versao !== VERSAO) erros.push(`edicoes.json: "versao" precisa ser ${VERSAO}.`);
  if (!ehObjeto(dados.taticas)) {
    erros.push('edicoes.json: "taticas" precisa ser um objeto com uma edição por tática.');
    return { erros, avisos };
  }

  const eTexto = (v, max) => typeof v === 'string' && v.length <= max;
  for (const [id, e] of Object.entries(dados.taticas)) {
    const nome = `edição "${id}"`;
    if (taticas && !taticas.has(id)) avisos.push(`${nome}: a tática não existe mais no playbook (a edição é ignorada).`);
    if (!ehObjeto(e)) {
      erros.push(`${nome}: precisa ser um objeto com os campos editados.`);
      continue;
    }
    for (const chave of Object.keys(e)) if (!CHAVES.includes(chave)) erros.push(`${nome}: o campo "${chave}" não pode ser editado (use ${CHAVES.join(', ')}).`);
    if (e.atualizadoEm !== undefined && !(typeof e.atualizadoEm === 'string' && DATA.test(e.atualizadoEm))) erros.push(`${nome}: "atualizadoEm" precisa ser uma data como "2026-10-01".`);
    if (e.titulo !== undefined) {
      if (!(eTexto(e.titulo, LIMITES.titulo) && e.titulo.trim())) erros.push(`${nome}: "titulo" precisa ter de 1 a ${LIMITES.titulo} caracteres.`);
      else if (/^\d+\.\s/.test(e.titulo)) erros.push(`${nome}: o título não deve começar com numeração ("${e.titulo}").`);
    }
    if (e.objetivo !== undefined && !(eTexto(e.objetivo, LIMITES.texto) && e.objetivo.trim())) erros.push(`${nome}: "objetivo" precisa ter de 1 a ${LIMITES.texto} caracteres.`);
    for (const c of ['economia', 'posPlant', 'planoB']) {
      if (e[c] !== undefined && !eTexto(e[c], LIMITES.texto)) erros.push(`${nome}: "${c}" precisa ser um texto de até ${LIMITES.texto} caracteres (vazio apaga o campo).`);
    }
    if (e.tipos !== undefined) {
      if (!Array.isArray(e.tipos) || !e.tipos.length) erros.push(`${nome}: "tipos" precisa ser uma lista com ao menos um tipo.`);
      else for (const t of e.tipos) if (tipos && !tipos.has(t)) erros.push(`${nome}: o tipo "${t}" não existe em "tipos".`);
    }
    if (e.alvo !== undefined && !(Array.isArray(e.alvo) && e.alvo.every((s) => SITES.includes(s)))) erros.push(`${nome}: "alvo" aceita só "A" e "B".`);
    if (e.funcoes !== undefined) {
      if (!ehObjeto(e.funcoes) || !Object.keys(e.funcoes).length) erros.push(`${nome}: "funcoes" precisa ser { "p1": "…" } com o que mudou.`);
      else {
        for (const [f, s] of Object.entries(e.funcoes)) {
          if (funcoes && !funcoes.has(f)) erros.push(`${nome}: a função "${f}" não existe em "funcoes".`);
          if (!(eTexto(s, LIMITES.texto) && s.trim())) erros.push(`${nome}: funcoes."${f}" precisa ter de 1 a ${LIMITES.texto} caracteres.`);
        }
      }
    }
    if (!Object.keys(e).some((k) => k !== 'atualizadoEm') && !erros.some((m) => m.startsWith(nome))) avisos.push(`${nome}: não muda nada (pode sair do arquivo).`);
  }
  return { erros, avisos };
}
