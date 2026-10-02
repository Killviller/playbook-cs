// Ajudantes puros do GitHub e as mudanças aplicadas ao arquivo que está no repositório.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMINHOS, deBase64, mensagemDeCommit, mensagemDeErro, normalizarRepo, paraBase64, repoDaPagina } from '../site/js/lib/github.js';
import { aplicarMudancasRadares, formatarArquivo, lerArquivo } from '../site/js/lib/radar.js';
import { aplicarMudancasEdicoes, formatarArquivo as formatarEdicoes, lerArquivo as lerEdicoes } from '../site/js/lib/edicoes.js';

test('base64: ida e volta com acentos, emoji e quebras de linha como o GitHub devolve', () => {
  for (const texto of ['', 'abc', 'Execução A padrão — plano B → Mid', '😀 smoke', '{\n  "a": "ã"\n}\n'.repeat(500)]) {
    assert.equal(deBase64(paraBase64(texto)), texto);
  }
  const b64 = Buffer.from('Execução', 'utf8').toString('base64');
  assert.equal(paraBase64('Execução'), b64);
  assert.equal(deBase64(`${b64.slice(0, 4)}\n${b64.slice(4)}\n`), 'Execução'); // com quebras de linha
});

test('repoDaPagina descobre usuário/repositório pelo endereço do GitHub Pages', () => {
  assert.equal(repoDaPagina({ hostname: 'killviller.github.io', pathname: '/playbook-cs/' }), 'killviller/playbook-cs');
  assert.equal(repoDaPagina({ hostname: 'Killviller.github.io', pathname: '/playbook-cs/index.html' }), 'Killviller/playbook-cs');
  assert.equal(repoDaPagina({ hostname: 'killviller.github.io', pathname: '/' }), null); // site do usuário, sem repositório
  assert.equal(repoDaPagina({ hostname: 'localhost', pathname: '/playbook-cs/' }), null);
  assert.equal(repoDaPagina(null), null);
});

test('normalizarRepo aceita usuário/repo ou o endereço colado do navegador', () => {
  assert.equal(normalizarRepo(' killviller/playbook-cs '), 'killviller/playbook-cs');
  assert.equal(normalizarRepo('https://github.com/Killviller/playbook-cs'), 'Killviller/playbook-cs');
  assert.equal(normalizarRepo('https://github.com/killviller/playbook-cs.git'), 'killviller/playbook-cs');
  assert.equal(normalizarRepo('github.com/killviller/playbook-cs/'), null); // sem https: não adivinha
  for (const ruim of ['', 'playbook-cs', 'a/b/c', 'killviller/', '/playbook-cs', 'um espaço/repo', null]) assert.equal(normalizarRepo(ruim), null, String(ruim));
});

test('mensagens de erro em português, uma para cada causa, e nunca com o token', () => {
  assert.match(mensagemDeErro(0), /Sem conexão/);
  assert.match(mensagemDeErro(401), /não aceitou o token/);
  assert.match(mensagemDeErro(403, 'Resource not accessible by personal access token'), /Contents.*Read and write/);
  assert.match(mensagemDeErro(403, 'API rate limit exceeded'), /limitou as chamadas/);
  assert.match(mensagemDeErro(404), /não achou o repositório/);
  assert.match(mensagemDeErro(409), /Outra alteração/);
  assert.match(mensagemDeErro(422), /Outra alteração/);
  assert.match(mensagemDeErro(503), /problema agora/);
  assert.match(mensagemDeErro(418, 'teapot'), /\(418\): teapot/);
});

test('mensagem do commit diz o que foi publicado', () => {
  assert.equal(mensagemDeCommit('radares', ['ancient-01']), 'Radar: ancient-01 (editor do app)');
  assert.equal(mensagemDeCommit('radares', ['a-01', 'b-02']), 'Radares: a-01, b-02 (editor do app)');
  assert.equal(mensagemDeCommit('edicoes', ['a-01', 'b-02', 'c-03', 'd-04']), 'Textos: 4 táticas (editor do app)');
  assert.equal(mensagemDeCommit('edicoes', ['mirage-02']), 'Texto: mirage-02 (editor do app)');
  assert.deepEqual(CAMINHOS, { radares: 'site/data/radares.json', edicoes: 'site/data/edicoes.json' });
});

// ------------------------------------------------------- mudanças no arquivo remoto
const jogador = (funcao, x, y) => ({ tipo: 'jogador', funcao, x, y });
const diagrama = (...itens) => ({ etapas: [{ titulo: '', nota: '', itens }] });
const ORDEM = ['p1', 'p2', 'p3', 'p4', 'p5'];

test('aplicarMudancasRadares troca só a tática publicada e mantém as outras e as imagens do arquivo atual', () => {
  const atual = formatarArquivo({
    imagens: { mirage: 'img/radar/mirage-novo.webp' },
    radares: { 'ancient-01': diagrama(jogador('p1', 0.1, 0.1)), 'ancient-03': diagrama(jogador('p2', 0.2, 0.2)) },
    funcoes: ORDEM,
  });
  const novo = aplicarMudancasRadares(atual, { 'ancient-03': diagrama(jogador('p2', 0.9, 0.9)), 'mirage-02': diagrama(jogador('p1', 0.5, 0.5)) }, ORDEM);
  const lido = lerArquivo(JSON.parse(novo));
  assert.deepEqual(Object.keys(lido.radares), ['ancient-01', 'ancient-03', 'mirage-02']);
  assert.equal(lido.radares['ancient-01'].etapas[0].itens[0].x, 0.1, 'o que outra pessoa publicou continua');
  assert.equal(lido.radares['ancient-03'].etapas[0].itens[0].x, 0.9, 'a tática editada é a nova');
  assert.deepEqual(lido.imagens, { mirage: 'img/radar/mirage-novo.webp' }, 'as imagens do arquivo atual são preservadas');
  assert.ok(novo.endsWith('}\n'));
});

test('aplicarMudancasRadares: diagrama vazio ou null tira o radar do arquivo; arquivo ausente começa do zero', () => {
  const atual = formatarArquivo({ radares: { 'ancient-01': diagrama(jogador('p1', 0.1, 0.1)), 'ancient-03': diagrama(jogador('p2', 0.2, 0.2)) }, funcoes: ORDEM });
  const sem = lerArquivo(JSON.parse(aplicarMudancasRadares(atual, { 'ancient-01': { etapas: [] }, 'ancient-03': null }, ORDEM)));
  assert.deepEqual(Object.keys(sem.radares), []);
  const novo = lerArquivo(JSON.parse(aplicarMudancasRadares(null, { 'ancient-01': diagrama(jogador('p1', 0.3, 0.3)) }, ORDEM)));
  assert.deepEqual(Object.keys(novo.radares), ['ancient-01']);
});

test('aplicarMudancasRadares não sobrescreve um arquivo remoto com JSON quebrado', () => {
  assert.throws(() => aplicarMudancasRadares('{ "versao": 1, ', { 'a-01': diagrama(jogador('p1', 0.1, 0.1)) }), /erro de JSON/);
  assert.throws(() => aplicarMudancasEdicoes('{ quebrado', { 'a-01': { planoB: 'x' } }), /erro de JSON/);
});

test('aplicarMudancasEdicoes troca só a tática publicada; edição vazia ou null tira do arquivo', () => {
  const atual = formatarEdicoes({
    'mirage-02': { atualizadoEm: '2026-09-01', planoB: 'Antigo.' },
    'mirage-03': { atualizadoEm: '2026-09-02', objetivo: 'Outro objetivo.' },
  });
  const novo = aplicarMudancasEdicoes(atual, { 'mirage-02': { atualizadoEm: '2026-10-02', planoB: 'Novo.' }, 'mirage-05': { atualizadoEm: '2026-10-02', economia: 'Eco' } });
  const lido = lerEdicoes(JSON.parse(novo));
  assert.deepEqual(Object.keys(lido), ['mirage-02', 'mirage-03', 'mirage-05']);
  assert.equal(lido['mirage-02'].planoB, 'Novo.');
  assert.equal(lido['mirage-03'].objetivo, 'Outro objetivo.', 'o que outra pessoa publicou continua');

  const sem = lerEdicoes(JSON.parse(aplicarMudancasEdicoes(novo, { 'mirage-02': {}, 'mirage-03': null })));
  assert.deepEqual(Object.keys(sem), ['mirage-05']);
  assert.deepEqual(Object.keys(lerEdicoes(JSON.parse(aplicarMudancasEdicoes(null, { 'mirage-02': { planoB: 'x' } })))), ['mirage-02']);
});
