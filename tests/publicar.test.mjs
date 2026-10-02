// Publicação automática: conexão, leitura/gravação com `sha`, conflito, e o fluxo salvar → publicar → site confirma.
// Usa localStorage falso e o GitHub falso (tests/helpers): nada de rede.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarGitHubFalso } from './helpers/github-falso.mjs';

const guardado = new Map();
const base = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
};
globalThis.localStorage = new Proxy(base, {
  ownKeys: () => [...guardado.keys()],
  getOwnPropertyDescriptor: (_, k) => (guardado.has(k) ? { enumerable: true, configurable: true, value: guardado.get(k) } : undefined),
});

const { store } = await import('../site/js/store.js');
const gh = await import('../site/js/github.js');
const pub = await import('../site/js/publicar.js');
const radares = await import('../site/js/radares.js');
const textos = await import('../site/js/edicoes.js');
const { formatarArquivo: formatarRadares, lerArquivo: lerRadares, paraEntrada } = await import('../site/js/lib/radar.js');
const { formatarArquivo: formatarEdicoes, lerArquivo: lerEdicoes } = await import('../site/js/lib/edicoes.js');

const ORDEM = ['p1', 'p2', 'p3', 'p4', 'p5'];
const jogador = (funcao, x, y) => ({ tipo: 'jogador', funcao, x, y });
const diagrama = (...itens) => ({ etapas: [{ titulo: '', nota: '', itens }] });
const TOKEN = 'github_pat_SEGREDO_DO_TESTE_123';
const RADARES = 'site/data/radares.json';
const EDICOES = 'site/data/edicoes.json';

let falso;
const vazioRadares = () => formatarRadares({ radares: {}, funcoes: ORDEM });
const vazioEdicoes = () => formatarEdicoes({});

function novoGitHub(extra = {}) {
  falso = criarGitHubFalso({
    token: TOKEN,
    arquivos: { [RADARES]: vazioRadares(), [EDICOES]: vazioEdicoes() },
    ...extra,
  });
  // o app lê os arquivos do "site publicado" (./data/...) e fala com a API do GitHub: o falso faz as duas coisas
  globalThis.fetch = falso.fetchFalso({
    site: (url) => (url.includes('radares.json') ? (falso.estado.arquivos.get(RADARES) ?? null) : url.includes('edicoes.json') ? (falso.estado.arquivos.get(EDICOES) ?? null) : null),
  });
}

const CRU = {
  funcoes: ORDEM.map((id) => ({ id, sigla: id.toUpperCase(), nome: id })),
  taticas: [{ id: 'alfa-01', mapa: 'alfa', numero: 1, titulo: 'T1', tipos: ['x'], alvo: ['A'], objetivo: 'Obj', economia: 'E', funcoes: { p1: 'a', p2: 'b', p3: 'c', p4: 'd', p5: 'e' }, posPlant: 'P', planoB: 'B' }],
};

beforeEach(async () => {
  store.limpar();
  radares.salvos.limpar();
  radares.rascunhos.limpar();
  textos.salvas.limpar();
  textos.rascunhos.limpar();
  store.remover('radar-publicados'); // (o store guarda também em memória: apagar só o localStorage não basta)
  store.remover('edicao-publicadas');
  textos.definirBase(CRU);
  novoGitHub();
  await radares.carregarRadares();
  await textos.carregarEdicoes();
});

const conectar = () => gh.conectar({ token: TOKEN, repo: 'killviller/playbook-cs' });

// ------------------------------------------------------------------- conexão
test('conectar confere o token, descobre o ramo padrão e liga a publicação automática', async () => {
  assert.equal(pub.conectado(), false);
  const c = await conectar();
  assert.deepEqual({ ...c, token: '***' }, { token: '***', repo: 'killviller/playbook-cs', branch: 'principal', auto: true });
  assert.equal(pub.conectado(), true);
  assert.equal(pub.automatico(), true, 'por padrão publica ao salvar');
  assert.equal(gh.conexao.obter().token, TOKEN);
});

test('conectar aceita o endereço do repositório e recusa token e nome inválidos com mensagem clara', async () => {
  await gh.conectar({ token: TOKEN, repo: 'https://github.com/killviller/playbook-cs.git' });
  assert.ok(pub.conectado());
  gh.conexao.remover();

  await assert.rejects(gh.conectar({ token: 'token-errado', repo: 'killviller/playbook-cs' }), /não aceitou o token/);
  await assert.rejects(gh.conectar({ token: TOKEN, repo: 'outro/repo-que-nao-existe' }), /não achou o repositório/);
  await assert.rejects(gh.conectar({ token: TOKEN, repo: 'sem-barra' }), /usuário\/nome/);
  await assert.rejects(gh.conectar({ token: '  ', repo: 'killviller/playbook-cs' }), /Cole o token/);
  assert.equal(pub.conectado(), false, 'falha ao conectar não guarda nada');

  falso.estado.escrita = false;
  await assert.rejects(conectar(), /não tem permissão para gravar/);
  assert.equal(pub.conectado(), false);
});

test('o token só vai para api.github.com, no cabeçalho, e não aparece em mais lugar nenhum', async () => {
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.1, 0.1)));
  await pub.publicarRadar('alfa-01', ORDEM);
  assert.ok(falso.estado.chamadas.length >= 3);
  assert.ok(falso.estado.chamadas.every((c) => c.origem === 'https://api.github.com' && c.autorizacao === `Bearer ${TOKEN}`));
  const aparece = [...guardado.entries()].filter(([, v]) => v.includes(TOKEN)).map(([k]) => k);
  assert.deepEqual(aparece, ['pb.github'], 'só a conexão guarda o token');
  for (const commit of falso.estado.commits) assert.ok(!commit.texto.includes(TOKEN) && !commit.mensagem.includes(TOKEN));
  assert.ok(!radares.salvos.ids().some((id) => JSON.stringify(radares.salvos.obter(id)).includes(TOKEN)));
});

test('"Apagar dados" (store.limpar) tira o token, mas não os radares e textos', async () => {
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.1, 0.1)));
  textos.salvas.salvar('alfa-01', { atualizadoEm: '2026-10-02', planoB: 'Novo' });
  store.limpar();
  assert.equal(pub.conectado(), false);
  assert.equal(guardado.has('pb.github'), false);
  assert.ok(radares.salvos.tem('alfa-01') && textos.salvas.tem('alfa-01'));
});

test('desligar a publicação automática mantém a conexão', async () => {
  const c = await conectar();
  gh.conexao.salvar({ ...c, auto: false });
  assert.equal(pub.conectado(), true);
  assert.equal(pub.automatico(), false);
});

// --------------------------------------------------------------- ler e gravar
test('atualizarArquivo cria o arquivo que não existe, atualiza com o sha e não faz commit quando nada muda', async () => {
  const c = await conectar();
  const ramo = await gh.ramoPadrao(c);
  assert.equal(ramo, 'principal');

  const r1 = await gh.atualizarArquivo(c, ramo, 'site/data/novo.json', (t) => (t === null ? '{"a":1}\n' : t), 'cria');
  assert.deepEqual(r1, { mudou: true });
  assert.equal(falso.estado.arquivos.get('site/data/novo.json'), '{"a":1}\n');

  const r2 = await gh.atualizarArquivo(c, ramo, 'site/data/novo.json', (t) => t.replace('1', '2'), 'atualiza');
  assert.deepEqual(r2, { mudou: true });
  assert.equal(falso.estado.arquivos.get('site/data/novo.json'), '{"a":2}\n');

  const antes = falso.estado.commits.length;
  assert.deepEqual(await gh.atualizarArquivo(c, ramo, 'site/data/novo.json', (t) => t, 'igual'), { mudou: false });
  assert.deepEqual(await gh.atualizarArquivo(c, ramo, 'site/data/novo.json', () => null, 'nada'), { mudou: false });
  assert.equal(falso.estado.commits.length, antes, 'sem mudança não gera commit');
});

test('conflito: se alguém gravou no meio, lê de novo e repete (e não apaga o que a pessoa gravou)', async () => {
  const c = await conectar();
  let interferiu = false;
  falso.estado.antesDoPut = (arquivo) => {
    if (interferiu) return;
    interferiu = true;
    falso.estado.arquivos.set(arquivo, '{"outra":"pessoa"}\n'); // outra publicação entrou entre a leitura e a gravação
  };
  const r = await gh.atualizarArquivo(c, 'principal', 'site/data/x.json', (t) => `${t ?? ''}+minha\n`, 'm');
  assert.equal(r.mudou, true);
  falso.estado.arquivos.set('site/data/x.json', falso.estado.arquivos.get('site/data/x.json'));
  assert.equal(falso.estado.arquivos.get('site/data/x.json'), '{"outra":"pessoa"}\n+minha\n', 'a mudança foi refeita em cima do que a outra pessoa gravou');
});

test('conflito que não acaba falha com mensagem em português depois de 3 tentativas', async () => {
  const c = await conectar();
  falso.estado.arquivos.set('site/data/x.json', 'v0\n');
  let n = 0;
  falso.estado.antesDoPut = (arquivo) => falso.estado.arquivos.set(arquivo, `v${++n}\n`);
  await assert.rejects(gh.atualizarArquivo(c, 'principal', 'site/data/x.json', (t) => `${t}+\n`, 'm'), /Outra alteração/);
  assert.equal(n, 3);
});

test('erros da API viram mensagens claras: sem permissão, token vencido e sem internet', async () => {
  const c = await conectar();
  falso.estado.escrita = false;
  await assert.rejects(gh.atualizarArquivo(c, 'principal', 'site/data/y.json', () => 'x\n', 'm'), /não tem permissão para gravar/);
  falso.estado.escrita = true;

  falso.estado.falhaDeRede = true;
  await assert.rejects(gh.atualizarArquivo(c, 'principal', 'site/data/y.json', () => 'x\n', 'm'), /Sem conexão/);
  falso.estado.falhaDeRede = false;

  gh.conexao.salvar({ ...c, token: 'vencido' });
  await assert.rejects(pub.publicarRadar('alfa-01', ORDEM), /não aceitou o token/);
});

// --------------------------------------------------------------- publicar
test('publicar radar: grava no repositório sem apagar o que já estava lá e marca como "publicando"', async () => {
  falso.estado.arquivos.set(RADARES, formatarRadares({ radares: { 'ancient-03': diagrama(jogador('p2', 0.2, 0.2)) }, funcoes: ORDEM }));
  await radares.carregarRadares();
  await conectar();

  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.5)));
  assert.deepEqual(pub.pendentes(), { radares: ['alfa-01'], textos: [], total: 1 });
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'aparelho');

  assert.deepEqual(await pub.publicarRadar('alfa-01', ORDEM), { radares: 1, textos: 0 });
  const remoto = lerRadares(JSON.parse(falso.estado.arquivos.get(RADARES)));
  assert.deepEqual(Object.keys(remoto.radares), ['alfa-01', 'ancient-03']);
  assert.equal(remoto.radares['alfa-01'].etapas[0].itens[0].x, 0.4);
  assert.equal(falso.estado.commits.at(-1).mensagem, 'Radar: alfa-01 (editor do app)');
  assert.equal(falso.estado.commits.at(-1).caminho, RADARES);

  assert.equal(radares.radarDaTatica('alfa-01').origem, 'publicando', 'o site novo ainda não chegou: aparece como publicando');
  assert.deepEqual(pub.pendentes(), { radares: [], textos: [], total: 0 }, 'e já não é pendência');
  assert.deepEqual(radares.contagem(), { total: 2, soNoAparelho: 0 }, 'o do site e o que está sendo publicado: nenhum é "só neste aparelho"');
});

test('quando o site novo chega, a cópia local sai e o radar passa a ser "publicado" (site)', async () => {
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.5)));
  await pub.publicarRadar('alfa-01', ORDEM);
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'publicando');

  await radares.carregarRadares(); // o deploy terminou: o site já tem o radar
  assert.equal(radares.salvos.tem('alfa-01'), false, 'a cópia redundante foi descartada');
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'site');
  assert.equal(guardado.get('pb.radar-publicados') && JSON.parse(guardado.get('pb.radar-publicados'))['alfa-01'], undefined, 'e o marcador também');
});

test('"publicando" só vale para o conteúdo que foi enviado: editar de novo volta a ser "só neste aparelho"', async () => {
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.5)));
  await pub.publicarRadar('alfa-01', ORDEM);
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.9, 0.9))); // mexeu depois
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'aparelho');
  assert.deepEqual(pub.pendentes().radares, ['alfa-01']);
});

test('se o site não confirmar em 20 minutos, volta a valer como pendente (algo deu errado no deploy)', async () => {
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.5)));
  await pub.publicarRadar('alfa-01', ORDEM);
  const marcadores = JSON.parse(guardado.get('pb.radar-publicados'));
  marcadores['alfa-01'].em -= 21 * 60 * 1000;
  guardado.set('pb.radar-publicados', JSON.stringify(marcadores));
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'aparelho');
  assert.deepEqual(pub.pendentes().radares, ['alfa-01']);
});

test('apagar o radar de uma tática e publicar tira do arquivo do repositório', async () => {
  falso.estado.arquivos.set(RADARES, formatarRadares({ radares: { 'alfa-01': diagrama(jogador('p1', 0.1, 0.1)), 'alfa-02': diagrama(jogador('p2', 0.2, 0.2)) }, funcoes: ORDEM }));
  await radares.carregarRadares();
  await conectar();
  radares.salvos.salvar('alfa-01', { etapas: [] }); // "apaguei o radar"
  await pub.publicarRadar('alfa-01', ORDEM);
  assert.deepEqual(Object.keys(lerRadares(JSON.parse(falso.estado.arquivos.get(RADARES))).radares), ['alfa-02']);
});

test('publicar texto: grava só a edição, preserva as outras e marca como "publicando"', async () => {
  falso.estado.arquivos.set(EDICOES, formatarEdicoes({ 'mirage-03': { atualizadoEm: '2026-09-20', planoB: 'Do site.' } }));
  await textos.carregarEdicoes();
  await conectar();

  textos.salvarValores('alfa-01', { ...textos.valoresOriginais('alfa-01'), planoB: 'Plano melhorado.' });
  assert.deepEqual(pub.pendentes(), { radares: [], textos: ['alfa-01'], total: 1 });
  assert.equal(textos.edicaoDaTatica('alfa-01').origem, 'aparelho');

  assert.deepEqual(await pub.publicarTexto('alfa-01'), { radares: 0, textos: 1 });
  const remoto = lerEdicoes(JSON.parse(falso.estado.arquivos.get(EDICOES)));
  assert.deepEqual(Object.keys(remoto), ['alfa-01', 'mirage-03']);
  assert.equal(remoto['alfa-01'].planoB, 'Plano melhorado.');
  assert.equal(falso.estado.commits.at(-1).mensagem, 'Texto: alfa-01 (editor do app)');
  assert.equal(textos.edicaoDaTatica('alfa-01').origem, 'publicando');
  assert.deepEqual(textos.contagem(), { total: 2, soNoAparelho: 0 });

  await textos.carregarEdicoes(); // o site chegou
  assert.equal(textos.salvas.tem('alfa-01'), false);
  assert.equal(textos.edicaoDaTatica('alfa-01').origem, 'site');
});

test('voltar ao texto original e publicar tira a edição do repositório', async () => {
  falso.estado.arquivos.set(EDICOES, formatarEdicoes({ 'alfa-01': { atualizadoEm: '2026-09-20', planoB: 'Do site.' } }));
  await textos.carregarEdicoes();
  await conectar();
  textos.salvarValores('alfa-01', textos.valoresOriginais('alfa-01')); // mascara a edição do site
  await pub.publicarTexto('alfa-01');
  assert.deepEqual(Object.keys(lerEdicoes(JSON.parse(falso.estado.arquivos.get(EDICOES)))), []);
});

test('publicarPendentes envia tudo de uma vez: um commit por arquivo', async () => {
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.1, 0.1)));
  radares.salvos.salvar('alfa-02', diagrama(jogador('p2', 0.2, 0.2)));
  textos.salvarValores('alfa-01', { ...textos.valoresOriginais('alfa-01'), objetivo: 'Objetivo novo.' });
  assert.equal(pub.pendentes().total, 3);

  assert.deepEqual(await pub.publicarPendentes(ORDEM), { radares: 1, textos: 1 });
  assert.equal(falso.estado.commits.length, 2, 'um commit para os radares e um para os textos');
  assert.equal(falso.estado.commits[0].mensagem, 'Radares: alfa-01, alfa-02 (editor do app)');
  assert.equal(pub.pendentes().total, 0);
  assert.deepEqual(await pub.publicarPendentes(ORDEM), { radares: 0, textos: 0 }, 'nada pendente: nada a fazer');
});

test('publicar sem conexão avisa; falha ao publicar não perde o que está salvo no aparelho', async () => {
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.1, 0.1)));
  await assert.rejects(pub.publicarRadar('alfa-01', ORDEM), /Conecte o GitHub/);

  await conectar();
  falso.estado.falhaDeRede = true;
  await assert.rejects(pub.publicarRadar('alfa-01', ORDEM), /Sem conexão/);
  assert.ok(radares.salvos.tem('alfa-01'), 'o radar continua salvo');
  assert.deepEqual(pub.pendentes().radares, ['alfa-01'], 'e continua pendente para tentar de novo');
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'aparelho');

  falso.estado.falhaDeRede = false;
  await pub.publicarRadar('alfa-01', ORDEM);
  assert.equal(pub.pendentes().total, 0);
});

test('o arquivo que o app grava passa no validador do build', async () => {
  const { validarRadares } = await import('../site/js/lib/radar.js');
  const { validarEdicoes } = await import('../site/js/lib/edicoes.js');
  await conectar();
  radares.salvos.salvar('alfa-01', diagrama(jogador('p1', 0.1, 0.1), { tipo: 'bomba', x: 0.5, y: 0.5 }));
  textos.salvarValores('alfa-01', { ...textos.valoresOriginais('alfa-01'), planoB: 'Novo plano.', funcoes: { ...textos.valoresOriginais('alfa-01').funcoes, p3: 'Smoke melhor.' } });
  await pub.publicarPendentes(ORDEM);
  const ctx = { taticas: new Set(['alfa-01']), funcoes: new Set(ORDEM), tipos: new Set(['x']) };
  assert.deepEqual(validarRadares(JSON.parse(falso.estado.arquivos.get(RADARES)), { ...ctx, mapas: new Set(['alfa']) }).erros, []);
  assert.deepEqual(validarEdicoes(JSON.parse(falso.estado.arquivos.get(EDICOES)), ctx).erros, []);
  assert.deepEqual(paraEntrada(lerRadares(JSON.parse(falso.estado.arquivos.get(RADARES))).radares['alfa-01'], ORDEM).posicoes.p1, [[10, 10]]);
});
