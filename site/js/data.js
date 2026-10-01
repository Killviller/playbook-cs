import { normalizar } from './lib/text.js';

/** O playbook.json como está no arquivo (sem edições): o main aplica as edições por cima e monta o índice. */
export async function carregarCru(url = './data/playbook.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar os dados (HTTP ${res.status}).`);
  return res.json();
}

export async function carregarPlaybook(url = './data/playbook.json') {
  return montarIndice(await carregarCru(url));
}

/** Indexa o JSON para consulta rápida. Mapas com ativo:false ficam fora do app. */
export function montarIndice(cru) {
  const tipos = cru.tipos ?? [];
  const tiposById = new Map(tipos.map((t) => [t.id, t]));
  const funcoes = cru.funcoes ?? [];
  const funcoesById = new Map(funcoes.map((f) => [f.id, f]));
  const mapas = (cru.mapas ?? []).filter((m) => m.ativo !== false);
  const mapasById = new Map(mapas.map((m) => [m.id, m]));
  const ordemMapa = new Map(mapas.map((m, i) => [m.id, i]));

  const taticas = (cru.taticas ?? [])
    .filter((t) => mapasById.has(t.mapa))
    .map((t) => ({ ...t, tipos: t.tipos ?? [], alvo: t.alvo ?? [], funcoes: t.funcoes ?? {} }))
    .sort((a, b) => ordemMapa.get(a.mapa) - ordemMapa.get(b.mapa) || a.numero - b.numero);

  const nomeTipo = (id) => tiposById.get(id)?.nome ?? id;
  for (const t of taticas) {
    const tiposTxt = t.tipos.map(nomeTipo).join(' ');
    // "Mirage 4": é assim que o time chama a tática no rádio (o PDF sugere esse padrão)
    t.chamada = `${mapasById.get(t.mapa).nome} ${t.numero}`;
    t.buscaTitulo = normalizar(`${t.chamada} ${t.titulo} ${tiposTxt}`);
    t.busca = normalizar(
      [
        t.chamada, t.titulo, tiposTxt, t.objetivo, t.economia, ...Object.values(t.funcoes), t.posPlant, t.planoB,
        ...(t.granadas ?? []), ...(t.ordem ?? []), ...(t.radio ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  const porMapa = new Map(mapas.map((m) => [m.id, []]));
  for (const t of taticas) porMapa.get(t.mapa).push(t);

  return {
    meta: cru.meta ?? {},
    tipos,
    tiposById,
    funcoes,
    funcoesById,
    regras: cru.regras ?? [],
    mapas,
    mapasById,
    taticas,
    taticasById: new Map(taticas.map((t) => [t.id, t])),
    porMapa,
  };
}

/** Tipos que existem no mapa, na ordem definida em `tipos` */
export function tiposDoMapa(index, mapaId) {
  const usados = new Set((index.porMapa.get(mapaId) ?? []).flatMap((t) => t.tipos));
  return index.tipos.filter((t) => usados.has(t.id));
}

/**
 * Táticas do mapa agrupadas pelo tipo principal (o primeiro de `tipos`), na ordem do cadastro de tipos.
 * Quem não tem tipo conhecido vai para um grupo final com tipo null.
 */
export function agruparPorTipo(index, mapaId) {
  const taticas = index.porMapa.get(mapaId) ?? [];
  const grupos = index.tipos
    .map((tipo) => ({ tipo, taticas: taticas.filter((t) => t.tipos[0] === tipo.id) }))
    .filter((g) => g.taticas.length);
  const soltas = taticas.filter((t) => !index.tiposById.has(t.tipos[0]));
  return soltas.length ? [...grupos, { tipo: null, taticas: soltas }] : grupos;
}

/**
 * O que cada função faz na tática. Com `minhaId`, a função da pessoa vem primeiro e marcada.
 * Funções sem texto na tática ficam de fora.
 */
export function funcoesDaTatica(index, tatica, minhaId = null) {
  const lista = index.funcoes
    .filter((f) => tatica.funcoes[f.id])
    .map((f) => ({ ...f, texto: tatica.funcoes[f.id], minha: f.id === minhaId }));
  const i = lista.findIndex((f) => f.minha);
  return i > 0 ? [lista[i], ...lista.slice(0, i), ...lista.slice(i + 1)] : lista;
}

/** Tática anterior/seguinte dentro do mesmo mapa */
export function vizinhas(index, tatica) {
  const lista = index.porMapa.get(tatica.mapa) ?? [];
  const i = lista.findIndex((t) => t.id === tatica.id);
  return { anterior: lista[i - 1] ?? null, proxima: lista[i + 1] ?? null, pos: i + 1, total: lista.length };
}

function termo(term) {
  if (term.length > 1) return (txt) => txt.includes(term);
  // letra ou número solto ("a", "b", "4") só vale como palavra inteira, senão casa com tudo
  const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
  return (txt) => re.test(txt);
}

/** Busca sem acento/caixa; todos os termos precisam aparecer. Chamada e título pesam mais. */
export function buscar(index, consulta) {
  const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  const casa = termos.map(termo);
  return index.taticas
    .map((t, i) => ({
      t,
      i,
      ok: casa.every((c) => c(t.busca)),
      peso: casa.reduce((n, c) => n + (c(t.buscaTitulo) ? 2 : 0), 0),
    }))
    .filter((r) => r.ok)
    .sort((a, b) => b.peso - a.peso || a.i - b.i)
    .map((r) => r.t);
}
