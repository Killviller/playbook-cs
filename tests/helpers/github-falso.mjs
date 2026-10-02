// Um "GitHub de mentira" para testar a publicação sem rede: a API de conteúdo de arquivos (GET/PUT com `sha`), o token,
// o ramo padrão, permissão de escrita e conflito. Serve aos testes do Node (via fetch falso) e aos testes de navegador
// (via interceptação de rotas do Playwright).
import { createHash } from 'node:crypto';

export function criarGitHubFalso({ token = 'github_pat_TESTE', repo = 'killviller/playbook-cs', ramo = 'principal', arquivos = {}, escrita = true } = {}) {
  const estado = {
    arquivos: new Map(Object.entries(arquivos)),
    commits: [], // { caminho, mensagem, texto }
    chamadas: [], // { metodo, caminho, autorizacao }
    escrita,
    ramo,
    antesDoPut: null, // função(caminho): simula alguém gravando entre a leitura e a gravação do app
    falhaDeRede: false,
  };
  const sha = (texto) => createHash('sha1').update(`blob ${texto.length}\0${texto}`).digest('hex');
  const prefixo = `/repos/${repo.toLowerCase()}`;

  function responder({ url, metodo = 'GET', cabecalhos = {}, corpo = null }) {
    const u = new URL(url, 'https://api.github.com');
    const autorizacao = cabecalhos.Authorization ?? cabecalhos.authorization ?? null;
    estado.chamadas.push({ metodo, caminho: u.pathname, autorizacao, origem: u.origin });
    if (estado.falhaDeRede) return { rede: false };
    if (autorizacao !== `Bearer ${token}`) return { status: 401, json: { message: 'Bad credentials' } };

    const caminho = decodeURIComponent(u.pathname).toLowerCase();
    if (metodo === 'GET' && caminho === prefixo) {
      return { status: 200, json: { full_name: repo, default_branch: estado.ramo, permissions: { push: estado.escrita } } };
    }
    if (!caminho.startsWith(`${prefixo}/contents/`)) return { status: 404, json: { message: 'Not Found' } };
    const arquivo = decodeURIComponent(u.pathname).slice(`/repos/${repo}/contents/`.length);
    const atual = estado.arquivos.get(arquivo);

    if (metodo === 'GET') {
      if (u.searchParams.get('ref') !== estado.ramo || atual === undefined) return { status: 404, json: { message: 'Not Found' } };
      const b64 = Buffer.from(atual, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n'); // o GitHub quebra a linha a cada 60
      return { status: 200, json: { type: 'file', encoding: 'base64', content: b64, sha: sha(atual) } };
    }

    if (metodo === 'PUT') {
      estado.antesDoPut?.(arquivo);
      if (!estado.escrita) return { status: 403, json: { message: 'Resource not accessible by personal access token' } };
      if (corpo.branch !== estado.ramo) return { status: 422, json: { message: 'Branch not found' } };
      const existente = estado.arquivos.get(arquivo);
      if (existente !== undefined && !corpo.sha) return { status: 422, json: { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' } };
      if (existente !== undefined && corpo.sha !== sha(existente)) return { status: 409, json: { message: `${arquivo} does not match ${sha(existente)}` } };
      if (existente === undefined && corpo.sha) return { status: 422, json: { message: 'sha for a file that does not exist' } };
      const texto = Buffer.from(corpo.content, 'base64').toString('utf8');
      estado.arquivos.set(arquivo, texto);
      estado.commits.push({ caminho: arquivo, mensagem: corpo.message, texto });
      return { status: existente === undefined ? 201 : 200, json: { content: { sha: sha(texto) }, commit: { message: corpo.message } } };
    }
    return { status: 404, json: { message: 'Not Found' } };
  }

  /** Um `fetch` para o Node: fala com o GitHub falso e, se `site` for dado, também serve os arquivos do "site publicado". */
  function fetchFalso({ site = null } = {}) {
    return async (url, init = {}) => {
      if (site && !String(url).startsWith('https://')) {
        const texto = site(String(url));
        return texto === null ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => JSON.parse(texto) };
      }
      const r = responder({ url, metodo: init.method, cabecalhos: init.headers ?? {}, corpo: init.body ? JSON.parse(init.body) : null });
      if (r.rede === false) throw new TypeError('Failed to fetch');
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json };
    };
  }

  return { estado, responder, fetchFalso, token, repo };
}
