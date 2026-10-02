// Conversa com a API do GitHub para publicar os radares e os textos editados direto no repositório.
//
// O token fica só neste aparelho (localStorage, chave "pb.github"): nunca vai para o repositório, para o arquivo exportado
// nem para outro endereço que não seja api.github.com. Quem tem o token pode alterar o repositório, por isso a tela de
// conexão pede um token só deste repositório, com validade, e deixa desconectar a qualquer hora.
import { store } from './store.js';
import { deBase64, mensagemDeErro, normalizarRepo, paraBase64 } from './lib/github.js';

const API = 'https://api.github.com';
const TENTATIVAS = 3;

export class ErroGitHub extends Error {
  constructor(status, detalhe) {
    super(mensagemDeErro(status, detalhe));
    this.status = status;
  }
}

/** { token, repo, branch, auto } ou null. `auto`: publicar sozinho ao salvar (liga na hora em que conecta). */
export const conexao = {
  obter() {
    const v = store.get('github', null);
    return v && typeof v.token === 'string' && v.token && typeof v.repo === 'string'
      ? { token: v.token, repo: v.repo, branch: v.branch ?? null, auto: v.auto !== false }
      : null;
  },
  salvar: (c) => store.set('github', c),
  remover: () => store.remover('github'),
};

async function chamar(token, caminho, { metodo = 'GET', corpo = null } = {}) {
  let res;
  try {
    res = await fetch(`${API}${caminho}`, {
      method: metodo,
      cache: 'no-store', // nunca uma resposta velha: o `sha` do arquivo precisa ser o de agora
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroGitHub(0);
  }
  let dados = null;
  try {
    dados = await res.json();
  } catch {
    /* resposta sem corpo */
  }
  if (!res.ok) throw new ErroGitHub(res.status, dados?.message);
  return dados;
}

/** Confere o token no repositório e guarda a conexão (com a publicação automática ligada). */
export async function conectar({ token, repo }) {
  const nome = normalizarRepo(repo);
  if (!nome) throw new Error('Escreva o repositório como usuário/nome, por exemplo killviller/playbook-cs.');
  const limpo = String(token ?? '').trim();
  if (!limpo) throw new Error('Cole o token do GitHub.');

  const info = await chamar(limpo, `/repos/${nome}`);
  if (info.permissions && info.permissions.push === false) throw new ErroGitHub(403);
  const c = { token: limpo, repo: info.full_name ?? nome, branch: info.default_branch ?? null, auto: true };
  conexao.salvar(c);
  return c;
}

/** O ramo que o site publica é o padrão do repositório; pergunta a cada vez, caso ele tenha mudado. */
export async function ramoPadrao(c) {
  const info = await chamar(c.token, `/repos/${c.repo}`);
  return info.default_branch;
}

/** { texto, sha } do arquivo no repositório, ou null se ainda não existe. */
export async function lerRemoto(c, ramo, caminho) {
  try {
    const dados = await chamar(c.token, `/repos/${c.repo}/contents/${caminho}?ref=${encodeURIComponent(ramo)}`);
    return { texto: deBase64(dados.content ?? ''), sha: dados.sha };
  } catch (erro) {
    if (erro.status === 404) return null;
    throw erro;
  }
}

/**
 * Lê o arquivo de agora, aplica `transformar(textoAtual)` e grava (um commit). Se alguém gravou no meio, lê de novo e repete.
 * `transformar` devolve o texto novo, ou o mesmo/null quando não há o que mudar (aí não faz commit).
 * @returns {Promise<{mudou: boolean}>}
 */
export async function atualizarArquivo(c, ramo, caminho, transformar, mensagem) {
  for (let tentativa = 1; ; tentativa++) {
    const atual = await lerRemoto(c, ramo, caminho);
    const novo = transformar(atual?.texto ?? null);
    if (novo === null || novo === atual?.texto) return { mudou: false };
    try {
      await chamar(c.token, `/repos/${c.repo}/contents/${caminho}`, {
        metodo: 'PUT',
        corpo: { message: mensagem, content: paraBase64(novo), branch: ramo, ...(atual ? { sha: atual.sha } : {}) },
      });
      return { mudou: true };
    } catch (erro) {
      if ((erro.status === 409 || erro.status === 422) && tentativa < TENTATIVAS) continue;
      throw erro;
    }
  }
}
