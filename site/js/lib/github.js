// Ajudantes puros para falar com a API do GitHub (sem fetch e sem DOM): rodam no navegador e nos testes.

export const CAMINHOS = { radares: 'site/data/radares.json', edicoes: 'site/data/edicoes.json' };

/** Texto UTF-8 → base64 (a API do GitHub só recebe o conteúdo dos arquivos assim). */
export function paraBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

/** base64 (com ou sem quebras de linha, como o GitHub devolve) → texto UTF-8. */
export function deBase64(base64) {
  const binario = atob(String(base64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

/** "killviller.github.io/playbook-cs/" → "killviller/playbook-cs"; fora do GitHub Pages devolve null. */
export function repoDaPagina(local) {
  const dono = /^([a-z0-9-]+)\.github\.io$/i.exec(local?.hostname ?? '')?.[1];
  const nome = (local?.pathname ?? '').split('/').filter(Boolean)[0];
  return dono && nome ? `${dono}/${nome}` : null;
}

/** Aceita "usuário/repo" ou o endereço do GitHub e devolve "usuário/repo"; texto inválido devolve null. */
export function normalizarRepo(texto) {
  const limpo = String(texto ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(limpo) ? limpo : null;
}

/** Mensagem em português para cada tipo de falha (o token nunca entra no texto). */
export function mensagemDeErro(status, detalhe = '') {
  const d = String(detalhe ?? '');
  if (status === 0) return 'Sem conexão com o GitHub. Confira a internet e tente de novo.';
  if (status === 401) return 'O GitHub não aceitou o token (expirou ou foi colado errado). Conecte de novo com um token novo.';
  if (status === 403 && /rate limit/i.test(d)) return 'O GitHub limitou as chamadas por um tempo. Tente de novo em alguns minutos.';
  if (status === 403) return 'O token não tem permissão para gravar neste repositório. Ao criar o token, escolha este repositório e, em Contents, "Read and write".';
  if (status === 404) return 'O GitHub não achou o repositório, ou o token não enxerga ele. Confira o nome (usuário/repositório) e se o token inclui este repositório.';
  if (status === 409 || status === 422) return 'Outra alteração entrou ao mesmo tempo. Tente de novo.';
  if (status >= 500) return 'O GitHub está com problema agora. Tente de novo daqui a pouco.';
  return `O GitHub recusou a publicação (${status})${d ? `: ${d}` : ''}.`;
}

/** Mensagem do commit: "Radar: ancient-01" / "Textos: mirage-02, mirage-05" / "Radares: 4 táticas". */
export function mensagemDeCommit(tipo, ids) {
  const rotulos = { radares: ['Radar', 'Radares'], edicoes: ['Texto', 'Textos'] }[tipo];
  const lista = ids.length <= 3 ? ids.join(', ') : `${ids.length} táticas`;
  return `${ids.length === 1 ? rotulos[0] : rotulos[1]}: ${lista} (editor do app)`;
}
