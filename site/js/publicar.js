// Publica os radares e os textos editados no repositório (api.github.com), para valerem em todos os aparelhos.
// Cada publicação lê o arquivo que está no GitHub agora, troca só as táticas que mudaram aqui e grava: o que outra pessoa
// publicou nesse meio-tempo não é apagado. O site novo chega aos aparelhos em cerca de 2 minutos (é o tempo do deploy).
import { atualizarArquivo, conexao, ramoPadrao } from './github.js';
import { CAMINHOS, mensagemDeCommit } from './lib/github.js';
import { aplicarMudancasEdicoes } from './lib/edicoes.js';
import { aplicarMudancasRadares } from './lib/radar.js';
import * as radares from './radares.js';
import * as textos from './edicoes.js';

export const conectado = () => !!conexao.obter();
/** Conectado e com "publicar ao salvar" ligado (o padrão assim que conecta). */
export const automatico = () => !!conexao.obter()?.auto;

/** Quantos radares e textos estão salvos só neste aparelho (o GitHub ainda não tem). */
export function pendentes() {
  const r = radares.idsPendentes();
  const t = textos.idsPendentes();
  return { radares: r, textos: t, total: r.length + t.length };
}

/**
 * @param {{radares?: string[], textos?: string[], ordem?: string[]}} o ids das táticas a publicar; `ordem` são os ids das funções (P1…P5)
 * @returns {Promise<{radares: number, textos: number}>} quantos arquivos receberam commit
 */
export async function publicar({ radares: idsRadares = [], textos: idsTextos = [], ordem = [] }) {
  const c = conexao.obter();
  if (!c) throw new Error('Conecte o GitHub primeiro.');
  const ramo = await ramoPadrao(c);
  const feitos = { radares: 0, textos: 0 };

  if (idsRadares.length) {
    const mudancas = Object.fromEntries(idsRadares.map((id) => [id, radares.salvos.obter(id)]));
    const { mudou } = await atualizarArquivo(c, ramo, CAMINHOS.radares, (texto) => aplicarMudancasRadares(texto, mudancas, ordem), mensagemDeCommit('radares', idsRadares));
    for (const [id, diagrama] of Object.entries(mudancas)) if (diagrama) radares.marcarPublicado(id, diagrama);
    feitos.radares = mudou ? 1 : 0;
  }

  if (idsTextos.length) {
    const mudancas = Object.fromEntries(idsTextos.map((id) => [id, textos.salvas.obter(id)]));
    const { mudou } = await atualizarArquivo(c, ramo, CAMINHOS.edicoes, (texto) => aplicarMudancasEdicoes(texto, mudancas), mensagemDeCommit('edicoes', idsTextos));
    for (const [id, edicao] of Object.entries(mudancas)) if (edicao) textos.marcarPublicada(id, edicao);
    feitos.textos = mudou ? 1 : 0;
  }
  return feitos;
}

export const publicarRadar = (id, ordem) => publicar({ radares: [id], ordem });
export const publicarTexto = (id) => publicar({ textos: [id] });

/** Publica tudo o que está só neste aparelho (um commit por arquivo). */
export function publicarPendentes(ordem) {
  const p = pendentes();
  return publicar({ radares: p.radares, textos: p.textos, ordem });
}
