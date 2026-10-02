// Edições do texto das táticas: o que está publicado no site (data/edicoes.json) + o que foi salvo neste aparelho.
// O salvo no aparelho vence o do site, tática por tática. Os rascunhos são cópias automáticas de uma edição ainda não
// salva: protegem o trabalho contra fechar a aba ou apertar "voltar" sem querer. Mesmo desenho do radar (radares.js).
import { store } from './store.js';
import {
  aplicarEdicao, aplicarEdicoes, camposDaTatica, diferencas, formatarArquivo, lerArquivo, limparValores, mesclarValores,
  mesmaEdicao, sanearEdicao, temEdicao,
} from './lib/edicoes.js';

// Chaves "pb.edic*": o botão "Apagar dados" dos Ajustes não mexe nelas (ver store.limpar).
const SALVAS = 'edicoes';
const RASCUNHOS = 'edicao-rascunho';
const PUBLICADAS = 'edicao-publicadas'; // o que já foi enviado ao GitHub e espera o site novo chegar (o deploy leva uns 2 minutos)
const JANELA_PUBLICANDO = 20 * 60 * 1000; // passou disso sem o site confirmar: volta a valer como "só neste aparelho"

let site = {}; // id → edição publicada em data/edicoes.json
let originais = {}; // id → tática como está no playbook.json (o texto do PDF)

/** Guarda o playbook.json cru: é o "original" de cada tática, para calcular o que mudou e para restaurar. */
export function definirBase(cru) {
  originais = Object.fromEntries((cru?.taticas ?? []).map((t) => [t.id, t]));
}

/** Carrega o edicoes.json do site. Se não existir ou estiver quebrado, o app segue com o texto do playbook.json. */
export async function carregarEdicoes(url = './data/edicoes.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    site = lerArquivo(await res.json());
    limparRedundantes();
  } catch {
    site = {};
  }
  return site;
}

const lerMapa = (chave) => {
  const v = store.get(chave, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

function gravar(chave, id, valor) {
  const todos = lerMapa(chave);
  if (valor === null) delete todos[id];
  else todos[id] = valor;
  store.set(chave, todos);
}

/** Salvas neste aparelho. Uma edição salva vazia ({}) esconde a do site: é como "voltar ao original". */
export const salvas = {
  ids: () => Object.keys(lerMapa(SALVAS)),
  tem: (id) => id in lerMapa(SALVAS),
  obter: (id) => (salvas.tem(id) ? sanearEdicao(lerMapa(SALVAS)[id]) : null),
  salvar: (id, edicao) => gravar(SALVAS, id, sanearEdicao(edicao)),
  remover: (id) => gravar(SALVAS, id, null),
  limpar: () => store.set(SALVAS, {}),
};

export const rascunhos = {
  ids: () => Object.keys(lerMapa(RASCUNHOS)),
  tem: (id) => id in lerMapa(RASCUNHOS),
  obter: (id) => (rascunhos.tem(id) ? lerMapa(RASCUNHOS)[id] : null),
  guardar: (id, valores) => gravar(RASCUNHOS, id, valores),
  descartar: (id) => gravar(RASCUNHOS, id, null),
  limpar: () => store.set(RASCUNHOS, {}),
};

export const doSite = (id) => site[id] ?? null;

const assinatura = (e) => JSON.stringify(sanearEdicao(e));

/** Guarda que esta edição foi enviada ao GitHub: até o site novo chegar, ela aparece como "publicando" e não como "só neste aparelho". */
export function marcarPublicada(id, edicao) {
  gravar(PUBLICADAS, id, { assinatura: assinatura(edicao), em: Date.now() });
}

function emPublicacao(id, edicao) {
  const m = lerMapa(PUBLICADAS)[id];
  return !!m && Date.now() - m.em < JANELA_PUBLICANDO && m.assinatura === assinatura(edicao);
}

/** Táticas com texto editado salvo neste aparelho que o GitHub ainda não tem (nem está recebendo). */
export function idsPendentes() {
  return salvas.ids().filter((id) => {
    const local = salvas.obter(id);
    const publicado = site[id];
    return (publicado ? !mesmaEdicao(local, publicado) : temEdicao(local)) && !emPublicacao(id, local);
  });
}

/** Edição que vale para a tática e de onde veio; null se a tática está como no playbook.json. */
export function edicaoDaTatica(id) {
  if (salvas.tem(id)) {
    const e = salvas.obter(id);
    if (!temEdicao(e)) return null;
    return { edicao: e, origem: site[id] && mesmaEdicao(e, site[id]) ? 'site' : emPublicacao(id, e) ? 'publicando' : 'aparelho' };
  }
  return temEdicao(site[id]) ? { edicao: site[id], origem: 'site' } : null;
}

function efetivas() {
  const edicoes = {};
  const origens = {};
  for (const id of new Set([...Object.keys(site), ...salvas.ids()])) {
    const e = edicaoDaTatica(id);
    if (e) {
      edicoes[id] = e.edicao;
      origens[id] = e.origem;
    }
  }
  return { edicoes, origens };
}

/** O playbook.json cru com as edições por cima (vale o salvo no aparelho, depois o do site). */
export function aplicar(cru) {
  const { edicoes, origens } = efetivas();
  return aplicarEdicoes(cru, edicoes, origens);
}

/**
 * Depois de publicar, a cópia salva neste aparelho fica igual à do site e só atrapalharia: se alguém mudasse o texto no
 * site, a cópia antiga continuaria vencendo aqui. Cópia idêntica à publicada (ou "vazia" sobre algo que não existe) sai.
 */
function limparRedundantes() {
  for (const id of salvas.ids()) {
    const local = salvas.obter(id);
    const publicado = site[id];
    if (publicado ? mesmaEdicao(local, publicado) : !temEdicao(local)) {
      salvas.remover(id);
      gravar(PUBLICADAS, id, null); // o site já confirmou: some o "publicando"
    }
  }
}

// ------------------------------------------------------------- valores do formulário
const valoresDe = (t, edicao) => camposDaTatica(aplicarEdicao(t, edicao));

/** Texto do PDF (playbook.json), sem nenhuma edição. */
export const valoresOriginais = (id) => camposDaTatica(originais[id]);
/** O que o time vê hoje: playbook.json + edições publicadas. */
export const valoresPublicados = (id) => valoresDe(originais[id], site[id]);
/** O que está salvo (no aparelho, senão no site). */
export const valoresSalvos = (id) => valoresDe(originais[id], edicaoDaTatica(id)?.edicao);

/**
 * O que a pessoa vê ao abrir o editor da tática: rascunho > salvo no aparelho > publicado > original.
 * `salvos` serve para saber se há alterações pendentes.
 */
export function pontoDePartida(id) {
  const salvos = valoresSalvos(id);
  const rascunho = rascunhos.obter(id);
  return { salvos, inicial: rascunho ? mesclarValores(salvos, rascunho) : salvos, recuperado: !!rascunho };
}

const hoje = () => {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

/**
 * Salva os valores do formulário como edição deste aparelho (só o que difere do playbook.json).
 * Se nada difere, a tática volta ao original: some a cópia local, ou fica uma "vazia" que esconde a edição do site.
 * @returns {{mudou: boolean}} mudou=false quando a tática ficou igual ao original
 */
export function salvarValores(id, valores) {
  const diff = diferencas(valoresOriginais(id), limparValores(valores));
  if (!Object.keys(diff).length) {
    if (temEdicao(site[id])) salvas.salvar(id, {});
    else salvas.remover(id);
    return { mudou: false };
  }
  const anterior = salvas.obter(id) ?? site[id];
  // a data só muda quando o conteúdo muda
  salvas.salvar(id, { atualizadoEm: anterior?.atualizadoEm && mesmaEdicao(anterior, diff) ? anterior.atualizadoEm : hoje(), ...diff });
  return { mudou: true };
}

/** Descarta o que foi salvo e o rascunho: a tática volta ao que está publicado. */
export function voltarAoPublicado(id) {
  salvas.remover(id);
  rascunhos.descartar(id);
}

export function situacao(id) {
  const e = edicaoDaTatica(id);
  return {
    editada: !!e,
    origem: e?.origem ?? null,
    atualizadoEm: e?.edicao.atualizadoEm ?? null,
    rascunho: rascunhos.tem(id),
  };
}

// ---------------------------------------------------------------- exportar
/** O edicoes.json completo (site + aparelho), pronto para colar no repositório. */
export function exportarArquivo() {
  const todas = { ...site };
  for (const id of salvas.ids()) todas[id] = salvas.obter(id); // vazia esconde a do site: sai do arquivo
  return formatarArquivo(todas);
}

/** Traz edições de um arquivo para este aparelho (como salvas). @returns {number} quantas entraram */
export function importarArquivo(cru) {
  const edicoes = lerArquivo(cru);
  const ids = Object.keys(edicoes);
  for (const id of ids) salvas.salvar(id, edicoes[id]);
  return ids.length;
}

/** Quantas táticas têm texto editado hoje e quantas dessas só existem neste aparelho. */
export function contagem() {
  const { edicoes } = efetivas();
  const ids = Object.keys(edicoes);
  const soNoAparelho = ids.filter((id) => !(site[id] && mesmaEdicao(site[id], edicoes[id])) && !emPublicacao(id, edicoes[id]));
  return { total: ids.length, soNoAparelho: soNoAparelho.length };
}
