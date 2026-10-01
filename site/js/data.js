import { normalizar } from './lib/text.js';

export async function carregarPlaybook(url = './data/playbook.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar os dados (HTTP ${res.status}).`);
  return montarIndice(await res.json());
}

/** Indexa o JSON para consulta rápida. Mapas com ativo:false ficam fora do app. */
export function montarIndice(cru) {
  const tipos = cru.tipos ?? [];
  const tiposById = new Map(tipos.map((t) => [t.id, t]));
  const mapas = (cru.mapas ?? []).filter((m) => m.ativo !== false);
  const mapasById = new Map(mapas.map((m) => [m.id, m]));
  const ordemMapa = new Map(mapas.map((m, i) => [m.id, i]));

  const taticas = (cru.taticas ?? [])
    .filter((t) => mapasById.has(t.mapa))
    .map((t) => ({ ...t, tipos: t.tipos ?? [], alvo: t.alvo ?? [], linhas: t.linhas ?? [] }))
    .sort((a, b) => ordemMapa.get(a.mapa) - ordemMapa.get(b.mapa) || a.numero - b.numero);

  const nomeTipo = (id) => tiposById.get(id)?.nome ?? id;
  for (const t of taticas) {
    const tiposTxt = t.tipos.map(nomeTipo).join(' ');
    t.buscaTitulo = normalizar(`${t.titulo} ${tiposTxt}`);
    t.busca = normalizar(`${mapasById.get(t.mapa).nome} ${t.titulo} ${t.linhas.join(' ')} ${tiposTxt}`);
  }

  const porMapa = new Map(mapas.map((m) => [m.id, []]));
  for (const t of taticas) porMapa.get(t.mapa).push(t);

  return {
    meta: cru.meta ?? {},
    tipos,
    tiposById,
    mapas,
    mapasById,
    taticas,
    taticasById: new Map(taticas.map((t) => [t.id, t])),
    porMapa,
    situacoes: cru.situacoes ?? [],
    calls: cru.calls ?? [],
  };
}

/** Tipos que existem no mapa, na ordem definida em `tipos` */
export function tiposDoMapa(index, mapaId) {
  const usados = new Set((index.porMapa.get(mapaId) ?? []).flatMap((t) => t.tipos));
  return index.tipos.filter((t) => usados.has(t.id));
}

/** Tática anterior/seguinte dentro do mesmo mapa */
export function vizinhas(index, tatica) {
  const lista = index.porMapa.get(tatica.mapa) ?? [];
  const i = lista.findIndex((t) => t.id === tatica.id);
  return { anterior: lista[i - 1] ?? null, proxima: lista[i + 1] ?? null, pos: i + 1, total: lista.length };
}

function termo(term) {
  if (term.length > 1) return (txt) => txt.includes(term);
  // letra solta ("a", "b") só vale como palavra inteira, senão casa com tudo
  const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
  return (txt) => re.test(txt);
}

/** Busca sem acento/caixa; todos os termos precisam aparecer. Título pesa mais. */
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

/**
 * "Qual tática chamar?": cruza os tipos da situação (tabela da pág. 13 do PDF)
 * com os tipos das táticas do mapa. Quem casa mais tipos vem primeiro.
 *  - melhores: pontuação máxima; outras: casam menos.
 *  - relaxado: o mapa não tem o tipo pedido para aquele site; lista o que existe no site.
 */
export function taticasParaSituacao(index, situacao, mapaId) {
  const taticas = index.porMapa.get(mapaId) ?? [];
  const quer = new Set(situacao.tipos ?? []);
  const site = situacao.alvo;
  const pontos = (t) => t.tipos.filter((id) => quer.has(id)).length;
  const noSite = (t) => !site || t.alvo.includes(site);

  const cand = taticas.filter((t) => noSite(t) && pontos(t) > 0).map((t) => ({ t, p: pontos(t) }));
  if (cand.length) {
    const max = Math.max(...cand.map((c) => c.p));
    return {
      melhores: cand.filter((c) => c.p === max).map((c) => c.t),
      outras: cand.filter((c) => c.p < max).map((c) => c.t),
      relaxado: false,
    };
  }
  const doSite = site ? taticas.filter((t) => t.alvo.includes(site)) : [];
  return { melhores: [], outras: doSite, relaxado: true };
}
