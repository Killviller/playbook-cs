// Validação do site/data/playbook.json. Usada pelo build, pelos testes e por `npm run validar`.
// Erros bloqueiam o build; avisos só chamam atenção (campos opcionais vazios, táticas marcadas para revisão).
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validarEdicoes } from '../../site/js/lib/edicoes.js';
import { caminhoRelativo, validarRadares } from '../../site/js/lib/radar.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COR = /^#[0-9a-fA-F]{6}$/;
const SITES = ['A', 'B'];

const ehTexto = (v) => typeof v === 'string' && v.trim() !== '';
const listaDeTextos = (v) => Array.isArray(v) && v.every(ehTexto);
/** sobras de formatação de conversão: **negrito**, barras invertidas, marcador "•" ou "--" soltos */
const temSobra = (s) => /\*\*|\\|^--$|^•/.test(s.trim());

/**
 * @param {object} dados conteúdo do playbook.json
 * @param {{siteDir?: string}} opcoes siteDir: pasta do site (para conferir se as imagens de radar existem)
 * @returns {Promise<{erros: string[], avisos: string[]}>}
 */
export async function validarPlaybook(dados, { siteDir = null } = {}) {
  const erros = [];
  const avisos = [];
  const erro = (m) => erros.push(m);
  const aviso = (m) => avisos.push(m);

  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return { erros: ['O arquivo precisa conter um objeto JSON.'], avisos };
  }

  if (!ehTexto(dados.meta?.titulo)) erro('meta.titulo é obrigatório.');

  // ---------------------------------------------------------------- funções
  const funcoes = new Set();
  if (!Array.isArray(dados.funcoes) || !dados.funcoes.length) erro('"funcoes" precisa ter ao menos uma função (ex.: P1 Entry).');
  (dados.funcoes ?? []).forEach((f, i) => {
    if (!SLUG.test(f?.id ?? '')) erro(`funcoes[${i}]: "id" inválido (use minúsculas, números e hífen).`);
    else if (funcoes.has(f.id)) erro(`funcoes: id repetido "${f.id}".`);
    else funcoes.add(f.id);
    if (!ehTexto(f?.sigla)) erro(`funcoes[${i}]: falta a "sigla" (ex.: "P1").`);
    if (!ehTexto(f?.nome)) erro(`funcoes[${i}]: falta o "nome".`);
  });

  // ------------------------------------------------------------------ tipos
  const tipos = new Set();
  if (!Array.isArray(dados.tipos) || !dados.tipos.length) erro('"tipos" precisa ter ao menos um tipo.');
  (dados.tipos ?? []).forEach((t, i) => {
    if (!SLUG.test(t?.id ?? '')) erro(`tipos[${i}]: "id" inválido (use minúsculas, números e hífen).`);
    else if (tipos.has(t.id)) erro(`tipos: id repetido "${t.id}".`);
    else tipos.add(t.id);
    if (!ehTexto(t?.nome)) erro(`tipos[${i}]: falta o "nome".`);
    if (t?.cor !== undefined && !COR.test(t.cor)) erro(`tipo "${t?.id}": "cor" precisa ser hexadecimal, como "#8e5bd0".`);
  });

  // ----------------------------------------------------------------- regras
  (dados.regras ?? []).forEach((r, i) => {
    if (!ehTexto(r?.titulo) || !ehTexto(r?.texto)) erro(`regras[${i}]: precisa de "titulo" e "texto".`);
  });

  // ------------------------------------------------------------------ mapas
  const mapas = new Map();
  if (!Array.isArray(dados.mapas) || !dados.mapas.length) erro('"mapas" precisa ter ao menos um mapa.');
  for (const [i, m] of (dados.mapas ?? []).entries()) {
    if (!SLUG.test(m?.id ?? '')) erro(`mapas[${i}]: "id" inválido (use minúsculas, números e hífen).`);
    else if (mapas.has(m.id)) erro(`mapas: id repetido "${m.id}".`);
    else mapas.set(m.id, m);
    if (!ehTexto(m?.nome)) erro(`mapas[${i}]: falta o "nome".`);
    if (m?.matiz !== undefined && !(Number.isFinite(m.matiz) && m.matiz >= 0 && m.matiz <= 360)) {
      erro(`mapa "${m?.id}": "matiz" precisa ser um número de 0 a 360.`);
    }
    for (const campo of ['capa', 'radar']) {
      if (m?.[campo] !== undefined && (!ehTexto(m[campo]) || /^(?:[a-z]+:|\/)/i.test(m[campo]))) {
        erro(`mapa "${m?.id}": "${campo}" precisa ser um caminho relativo (ex.: "img/${campo === 'capa' ? 'mapas' : 'radar'}/${m?.id}.webp").`);
      } else if (m?.[campo] !== undefined && siteDir) {
        try {
          await access(join(siteDir, m[campo]));
        } catch {
          // capa ainda não enviada: só avisa (o card cai no fundo em gradiente)
          (campo === 'capa' ? aviso : erro)(`mapa "${m.id}": a imagem "${m[campo]}" não existe dentro de site/.`);
        }
      }
    }
    if (m?.ativo !== undefined && typeof m.ativo !== 'boolean') erro(`mapa "${m?.id}": "ativo" precisa ser true ou false.`);
    if (m?.descricao !== undefined && !ehTexto(m.descricao)) erro(`mapa "${m?.id}": "descricao" precisa ser um texto.`);
  }

  // ---------------------------------------------------------------- táticas
  const ids = new Set();
  const numeros = new Set();
  const porMapa = new Map([...mapas.keys()].map((id) => [id, 0]));

  if (!Array.isArray(dados.taticas) || !dados.taticas.length) erro('"taticas" precisa ter ao menos uma tática.');
  for (const [i, t] of (dados.taticas ?? []).entries()) {
    const nome = t?.id ? `tática "${t.id}"` : `taticas[${i}]`;

    if (!SLUG.test(t?.id ?? '')) erro(`${nome}: "id" inválido (use minúsculas, números e hífen).`);
    else if (ids.has(t.id)) erro(`${nome}: id repetido.`);
    else ids.add(t.id);

    if (!mapas.has(t?.mapa)) erro(`${nome}: o mapa "${t?.mapa}" não existe em "mapas".`);
    else porMapa.set(t.mapa, porMapa.get(t.mapa) + 1);

    if (!Number.isInteger(t?.numero) || t.numero < 1) erro(`${nome}: "numero" precisa ser um inteiro a partir de 1.`);
    else if (numeros.has(`${t.mapa}#${t.numero}`)) erro(`${nome}: o número ${t.numero} já está em uso no mapa "${t.mapa}".`);
    else numeros.add(`${t.mapa}#${t.numero}`);

    if (!ehTexto(t?.titulo)) erro(`${nome}: falta o "titulo".`);
    else if (/^\d+\.\s/.test(t.titulo)) erro(`${nome}: o título não deve começar com numeração ("${t.titulo}").`);

    if (!Array.isArray(t?.tipos) || !t.tipos.length) aviso(`${nome}: sem "tipos" (não aparece nos filtros nem em "Chamar").`);
    for (const tp of t?.tipos ?? []) if (!tipos.has(tp)) erro(`${nome}: tipo "${tp}" não existe em "tipos".`);

    for (const s of t?.alvo ?? []) if (!SITES.includes(s)) erro(`${nome}: "alvo" aceita só "A" e "B" (achei "${s}").`);

    if (!ehTexto(t?.objetivo)) erro(`${nome}: falta o "objetivo".`);
    for (const campo of ['economia', 'posPlant', 'planoB']) {
      if (t?.[campo] === undefined) aviso(`${nome}: sem "${campo}".`);
      else if (!ehTexto(t[campo])) erro(`${nome}: "${campo}" precisa ser um texto.`);
    }

    // o que cada função faz: precisa ter todas as funções cadastradas, e nenhuma desconhecida
    if (!t?.funcoes || typeof t.funcoes !== 'object' || Array.isArray(t.funcoes)) {
      erro(`${nome}: "funcoes" precisa ser um objeto com o que cada função faz (ex.: "p1": "...").`);
    } else {
      for (const f of funcoes) if (!ehTexto(t.funcoes[f])) erro(`${nome}: falta o que a função "${f}" faz.`);
      for (const f of Object.keys(t.funcoes)) if (!funcoes.has(f)) erro(`${nome}: a função "${f}" não existe em "funcoes".`);
    }

    // sobras de formatação em qualquer texto da tática
    const textos = [
      ['objetivo', t?.objetivo], ['economia', t?.economia], ['posPlant', t?.posPlant], ['planoB', t?.planoB],
      ...Object.entries(t?.funcoes ?? {}).map(([k, v]) => [`funcoes.${k}`, v]),
    ];
    for (const [campo, txt] of textos) {
      if (ehTexto(txt) && temSobra(txt)) erro(`${nome}: sobra de formatação em "${campo}": "${txt}".`);
    }

    for (const campo of ['granadas', 'ordem', 'radio']) {
      if (t?.[campo] !== undefined && !listaDeTextos(t[campo])) erro(`${nome}: "${campo}" precisa ser uma lista de textos.`);
    }

    if (t?.radar !== undefined) {
      if (!Array.isArray(t.radar)) erro(`${nome}: "radar" precisa ser uma lista de { "src", "legenda" }.`);
      for (const [j, r] of (Array.isArray(t.radar) ? t.radar : []).entries()) {
        if (!ehTexto(r?.src) || /^(?:[a-z]+:|\/)/i.test(r.src)) {
          erro(`${nome}: radar[${j}].src precisa ser um caminho relativo (ex.: "img/radar/mirage-04.webp").`);
        } else if (siteDir) {
          try {
            await access(join(siteDir, r.src));
          } catch {
            erro(`${nome}: a imagem "${r.src}" não existe dentro de site/.`);
          }
        }
      }
    }

    if (t?.posicoes !== undefined) {
      const pos = t.posicoes;
      const ok = pos && typeof pos === 'object' && !Array.isArray(pos);
      if (!ok) erro(`${nome}: "posicoes" precisa ser { "p1": [[x, y], …], … }.`);
      else {
        const tamanhos = new Set();
        for (const [fid, lista] of Object.entries(pos)) {
          if (!funcoes.has(fid)) erro(`${nome}: posicoes."${fid}" não é uma função cadastrada.`);
          const pontos = Array.isArray(lista) && lista.length >= 2 && lista.length <= 4 &&
            lista.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 100));
          if (!pontos) erro(`${nome}: posicoes."${fid}" precisa ter de 2 a 4 pontos [x, y] com valores de 0 a 100.`);
          else tamanhos.add(lista.length);
        }
        if (tamanhos.size > 1) erro(`${nome}: todos os jogadores de "posicoes" precisam ter o mesmo número de fases.`);
        if (t.fases !== undefined && !(listaDeTextos(t.fases) && tamanhos.size === 1 && t.fases.length === [...tamanhos][0])) {
          erro(`${nome}: "fases" precisa ser uma lista de textos, um por ponto de "posicoes".`);
        }
      }
    }

    if (t?.revisar) aviso(`${nome}: marcada para revisão. ${t.revisar}`);
  }

  for (const [id, m] of mapas) {
    if (m.ativo !== false && porMapa.get(id) === 0) aviso(`mapa "${id}" está ativo mas não tem táticas.`);
  }

  return { erros, avisos };
}

/**
 * Confere site/data/radares.json (os radares feitos no editor). Arquivo ausente é normal: ainda não há radares.
 * Imagem de radar que não está em site/ vira só aviso (o radar aparece sem fundo até o arquivo ser enviado).
 * @param {object} playbook conteúdo já lido do playbook.json
 * @param {{siteDir: string}} opcoes
 */
export async function validarRadaresDoSite(playbook, { siteDir }) {
  let texto;
  try {
    texto = await readFile(join(siteDir, 'data/radares.json'), 'utf8');
  } catch {
    return { erros: [], avisos: [] };
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    return { erros: [`radares.json: JSON inválido (${e.message}). Confira vírgulas e aspas.`], avisos: [] };
  }

  const contexto = {
    taticas: new Set((playbook?.taticas ?? []).map((t) => t.id)),
    funcoes: new Set((playbook?.funcoes ?? []).map((f) => f.id)),
    mapas: new Set((playbook?.mapas ?? []).map((m) => m.id)),
  };
  const { erros, avisos } = validarRadares(dados, contexto);

  for (const [mapa, caminho] of Object.entries(dados?.imagens && typeof dados.imagens === 'object' ? dados.imagens : {})) {
    if (!caminhoRelativo(caminho)) continue; // já reportado como erro
    try {
      await access(join(siteDir, caminho));
    } catch {
      avisos.push(`imagens.${mapa}: a imagem "${caminho}" ainda não está em site/ (o radar aparece sem o fundo até você enviar o arquivo).`);
    }
  }
  return { erros: erros.map((e) => (e.startsWith('radares.json') ? e : `radares.json: ${e}`)), avisos };
}

/**
 * Confere site/data/edicoes.json (os textos de táticas melhorados no app). Arquivo ausente é normal: ainda não há edições.
 * @param {object} playbook conteúdo já lido do playbook.json
 * @param {{siteDir: string}} opcoes
 */
export async function validarEdicoesDoSite(playbook, { siteDir }) {
  let texto;
  try {
    texto = await readFile(join(siteDir, 'data/edicoes.json'), 'utf8');
  } catch {
    return { erros: [], avisos: [] };
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    return { erros: [`edicoes.json: JSON inválido (${e.message}). Confira vírgulas e aspas.`], avisos: [] };
  }

  const { erros, avisos } = validarEdicoes(dados, {
    taticas: new Set((playbook?.taticas ?? []).map((t) => t.id)),
    funcoes: new Set((playbook?.funcoes ?? []).map((f) => f.id)),
    tipos: new Set((playbook?.tipos ?? []).map((t) => t.id)),
  });
  const prefixar = (m) => (m.startsWith('edicoes.json') ? m : `edicoes.json: ${m}`);
  return { erros: erros.map(prefixar), avisos: avisos.map(prefixar) };
}

export function formatarRelatorio({ erros, avisos }) {
  const linhas = [];
  for (const m of erros) linhas.push(`  ✗ ${m}`);
  for (const m of avisos) linhas.push(`  ! ${m}`);
  linhas.push(erros.length ? `\n${erros.length} erro(s), ${avisos.length} aviso(s).` : `OK. ${avisos.length} aviso(s).`);
  return linhas.join('\n');
}
