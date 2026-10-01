// Radares das táticas: o que está publicado no site (data/radares.json) + o que foi salvo neste aparelho.
// O salvo no aparelho vence o do site, tática por tática. Os rascunhos são cópias automáticas de uma edição
// ainda não salva: protegem o trabalho contra fechar a aba ou apertar "voltar" sem querer.
import { store } from './store.js';
import { canonico, formatarArquivo, lerArquivo, mesclarRadares, sanearDiagrama, temConteudo } from './lib/radar.js';
import { extensao, lerImagem, mapasComImagemLocal, urlDaImagemLocal } from './imagens.js';

// Chaves "pb.radar*": o botão "Apagar dados" dos Ajustes não mexe nelas (ver store.limpar).
const SALVOS = 'radares';
const RASCUNHOS = 'radar-rascunho';

let site = { imagens: {}, radares: {} };

/** Carrega o radares.json do site. Se não existir ou estiver quebrado, o app segue sem radares do site. */
export async function carregarRadares(url = './data/radares.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    site = lerArquivo(await res.json());
    limparRedundantes();
  } catch {
    site = { imagens: {}, radares: {} };
  }
  return site;
}

const mesmo = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

/**
 * Depois de publicar, a cópia salva neste aparelho fica igual à do site e só atrapalharia: se alguém mudasse o radar no
 * site, a cópia antiga continuaria vencendo aqui. Cópia idêntica à publicada (ou "vazia" sobre algo que não existe) sai.
 * Nada se perde: o conteúdo é o mesmo.
 */
function limparRedundantes() {
  for (const id of salvos.ids()) {
    const local = salvos.obter(id);
    const publicado = site.radares[id];
    if (publicado ? mesmo(local, publicado) : !temConteudo(local)) salvos.remover(id);
  }
}

const lerMapa = (chave) => {
  const v = store.get(chave, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

function gravar(chave, id, diagrama) {
  const todos = lerMapa(chave);
  if (diagrama) todos[id] = diagrama;
  else delete todos[id];
  store.set(chave, todos);
}

/** Salvos neste aparelho. Um diagrama salvo vazio ({etapas: []}) esconde o do site: é como "apagar" o radar. */
export const salvos = {
  ids: () => Object.keys(lerMapa(SALVOS)),
  tem: (id) => id in lerMapa(SALVOS),
  obter: (id) => (salvos.tem(id) ? sanearDiagrama(lerMapa(SALVOS)[id]) : null),
  salvar: (id, diagrama) => gravar(SALVOS, id, canonico(diagrama)),
  remover: (id) => gravar(SALVOS, id, null),
  limpar: () => store.set(SALVOS, {}),
};

export const rascunhos = {
  ids: () => Object.keys(lerMapa(RASCUNHOS)),
  tem: (id) => id in lerMapa(RASCUNHOS),
  obter: (id) => (rascunhos.tem(id) ? sanearDiagrama(lerMapa(RASCUNHOS)[id]) : null),
  guardar: (id, diagrama) => gravar(RASCUNHOS, id, canonico(diagrama)),
  descartar: (id) => gravar(RASCUNHOS, id, null),
  limpar: () => store.set(RASCUNHOS, {}),
};

export const doSite = (id) => site.radares[id] ?? null;

/** Diagrama que vale para a tática e de onde veio; null se não houver nada para mostrar. */
export function radarDaTatica(id) {
  if (salvos.tem(id)) {
    const d = salvos.obter(id);
    if (!temConteudo(d)) return null;
    return { diagrama: d, origem: doSite(id) && mesmo(d, doSite(id)) ? 'site' : 'aparelho' };
  }
  const d = doSite(id);
  return d && temConteudo(d) ? { diagrama: d, origem: 'site' } : null;
}

/** O que a pessoa vê ao abrir o editor: rascunho > salvo no aparelho > site > em branco. */
export function pontoDePartida(id) {
  const base = salvos.tem(id) ? salvos.obter(id) : (doSite(id) ?? { etapas: [] });
  const rascunho = rascunhos.obter(id);
  return { base: canonico(base), inicial: rascunho ?? base, recuperado: !!rascunho };
}

export function situacao(id) {
  const radar = radarDaTatica(id);
  return {
    etapas: radar?.diagrama.etapas.length ?? 0,
    origem: radar?.origem ?? null,
    rascunho: rascunhos.tem(id),
    noSite: !!doSite(id) && temConteudo(doSite(id)),
  };
}

// ---------------------------------------------------------------- imagens
export const imagemDoSite = (mapaId) => site.imagens[mapaId] ?? null;

/** Imagem escolhida neste aparelho vence a do site. Devolve { url, origem } ou null. */
export async function imagemDoMapa(mapaId) {
  const local = await urlDaImagemLocal(mapaId);
  if (local) return { url: local, origem: 'aparelho' };
  const publicada = imagemDoSite(mapaId);
  return publicada ? { url: publicada, origem: 'site' } : null;
}

/** Imagens escolhidas aqui que ainda não estão no site: precisam ser enviadas ao repositório. */
export async function imagensParaEnviar() {
  const locais = await mapasComImagemLocal();
  const lista = [];
  for (const mapaId of locais) {
    const img = await lerImagem(mapaId);
    if (img) lista.push({ mapaId, blob: img.blob, caminho: `img/radar/${mapaId}.${extensao(img.tipo)}`, noSite: !!imagemDoSite(mapaId) });
  }
  return lista.sort((a, b) => a.mapaId.localeCompare(b.mapaId));
}

// ---------------------------------------------------------------- exportar
/** O radares.json completo (site + aparelho), pronto para colar no repositório. */
export async function exportarArquivo() {
  const radares = mesclarRadares(site.radares, lerMapa(SALVOS));
  const imagens = { ...site.imagens };
  for (const img of await imagensParaEnviar()) if (!imagens[img.mapaId]) imagens[img.mapaId] = img.caminho;
  return formatarArquivo({ imagens, radares });
}

/** Traz radares de um arquivo para este aparelho (como salvos). @returns {number} quantos radares entraram */
export function importarArquivo(cru) {
  const { radares } = lerArquivo(cru);
  const ids = Object.keys(radares);
  for (const id of ids) salvos.salvar(id, radares[id]);
  return ids.length;
}

/** Quantos radares valem hoje (site + aparelho, sem os vazios). */
export function contagem() {
  const todos = mesclarRadares(site.radares, lerMapa(SALVOS));
  const ids = Object.keys(todos).filter((id) => temConteudo(sanearDiagrama(todos[id])));
  return { total: ids.length, soNoAparelho: ids.filter((id) => !(doSite(id) && JSON.stringify(canonico(doSite(id))) === JSON.stringify(canonico(todos[id])))).length };
}
