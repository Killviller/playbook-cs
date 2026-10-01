// Testes da lógica com dados sintéticos: assim editar as táticas do time não quebra o CI.
// O único teste amarrado ao conteúdo real é a validação (ele protege o deploy de um JSON quebrado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validarPlaybook } from '../scripts/lib/validar.mjs';
import { buscar, montarIndice, taticasParaSituacao, tiposDoMapa, vizinhas } from '../site/js/data.js';

const siteDir = fileURLToPath(new URL('../site/', import.meta.url));

const tatica = (mapa, numero, titulo, tipos, alvo, linhas = ['1 Mid.']) => ({
  id: `${mapa}-${String(numero).padStart(2, '0')}`,
  mapa,
  numero,
  titulo,
  tipos,
  alvo,
  linhas,
});

const exemplo = () => ({
  meta: { titulo: 'Teste' },
  tipos: ['default', 'controle', 'execute', 'split', 'fake', 'lento'].map((id) => ({ id, nome: id[0].toUpperCase() + id.slice(1) })),
  mapas: [
    { id: 'mapa-a', nome: 'Alfa' },
    { id: 'mapa-b', nome: 'Bravo' },
    { id: 'mapa-c', nome: 'Charlie', ativo: false },
  ],
  taticas: [
    tatica('mapa-a', 1, 'Default simples', ['default'], [], ['2 jogadores Mid.', '3 B Main.']),
    tatica('mapa-a', 2, 'Controle lento de Mid', ['controle', 'lento'], []),
    tatica('mapa-a', 3, 'Explosão B', ['execute'], ['B']),
    tatica('mapa-a', 4, 'Split A pelo Long', ['split'], ['A'], ['2 Long.', '3 Short.', 'Entrada com 4–5.']),
    tatica('mapa-a', 5, 'Fake B → A', ['fake'], ['A']),
    tatica('mapa-b', 1, 'Controle de Banana', ['controle'], []),
    tatica('mapa-b', 2, 'Execute A', ['execute'], ['A']),
    tatica('mapa-b', 3, 'Rush Banana', ['execute'], ['B'], ['4–5 jogadores Banana.']),
    tatica('mapa-c', 1, 'Tática de mapa fora do pool', ['default'], []),
  ],
  situacoes: [
    { id: 'recuados', situacao: 'CTs recuados', recomendacao: 'Controle + tardio', tipos: ['controle', 'lento'] },
    { id: 'b-fraco', situacao: 'B fraco', recomendacao: 'Explosão B', tipos: ['execute'], alvo: 'B' },
    { id: 'a-fraco', situacao: 'A fraco', recomendacao: 'Split A', tipos: ['split'], alvo: 'A' },
    { id: 'default', situacao: 'Quer default', recomendacao: 'Default', tipos: ['default'] },
  ],
  calls: [{ termo: 'Default', significado: 'Cada um na sua posição.', tipo: 'default' }],
});

const indice = montarIndice(exemplo());
const situacao = (id) => indice.situacoes.find((s) => s.id === id);
const ids = (lista) => lista.map((t) => t.id);

// ------------------------------------------------------------- dados reais
test('o playbook.json real passa na validação (erros bloqueiam o deploy)', async () => {
  const cru = JSON.parse(await readFile(`${siteDir}data/playbook.json`, 'utf8'));
  const { erros } = await validarPlaybook(cru, { siteDir });
  assert.deepEqual(erros, []);
  assert.ok(montarIndice(cru).mapas.length > 0);
});

// --------------------------------------------------------------- validador
test('o validador aceita o exemplo e pega erros comuns de edição', async () => {
  assert.deepEqual((await validarPlaybook(exemplo(), { siteDir })).erros, []);

  const quebrado = exemplo();
  quebrado.taticas[1].id = quebrado.taticas[0].id; // id repetido
  quebrado.taticas[2].mapa = 'overpass'; // mapa que não existe
  quebrado.taticas[3].tipos = ['inexistente'];
  quebrado.taticas[4].linhas = ['**sobra de markdown**'];
  quebrado.taticas[5].titulo = '6. Com numeração';
  quebrado.taticas[6].radar = [{ src: 'img/nao-existe.webp' }];
  quebrado.taticas[7].alvo = ['C'];
  quebrado.taticas[0].granadas = 'não é lista';
  const texto = (await validarPlaybook(quebrado, { siteDir })).erros.join('\n');
  for (const trecho of ['id repetido', 'overpass', 'inexistente', 'sobra de formatação', 'numeração', 'não existe dentro de site/', '"alvo" aceita só', '"granadas" precisa']) {
    assert.match(texto, new RegExp(trecho), `faltou o erro sobre: ${trecho}`);
  }
});

test('o validador recusa caminhos de radar absolutos ou com protocolo', async () => {
  for (const src of ['/img/x.webp', 'https://exemplo.com/x.webp', 'javascript:alert(1)']) {
    const d = exemplo();
    d.taticas[0].radar = [{ src }];
    assert.match((await validarPlaybook(d, { siteDir })).erros.join('\n'), /caminho relativo/, src);
  }
});

test('"revisar" vira aviso e não bloqueia', async () => {
  const d = exemplo();
  d.taticas[0].revisar = 'Conferir o número de jogadores.';
  const { erros, avisos } = await validarPlaybook(d, { siteDir });
  assert.equal(erros.length, 0);
  assert.match(avisos.join('\n'), /mapa-a-01.*Conferir/);
});

// ------------------------------------------------------------------- índice
test('mapa com ativo:false some do app junto com as suas táticas', () => {
  assert.deepEqual(indice.mapas.map((m) => m.id), ['mapa-a', 'mapa-b']);
  assert.equal(indice.taticasById.has('mapa-c-01'), false);
  assert.equal(indice.taticas.length, 8);
});

test('vizinhas dá anterior/próxima dentro do mesmo mapa', () => {
  const primeira = indice.taticasById.get('mapa-a-01');
  const ultima = indice.taticasById.get('mapa-a-05');
  assert.equal(vizinhas(indice, primeira).anterior, null);
  assert.equal(vizinhas(indice, primeira).proxima.id, 'mapa-a-02');
  assert.equal(vizinhas(indice, ultima).proxima, null);
  assert.deepEqual([vizinhas(indice, ultima).pos, vizinhas(indice, ultima).total], [5, 5]);
});

test('tiposDoMapa lista só os tipos presentes, na ordem do cadastro', () => {
  assert.deepEqual(tiposDoMapa(indice, 'mapa-a').map((t) => t.id), ['default', 'controle', 'execute', 'split', 'fake', 'lento']);
  assert.deepEqual(tiposDoMapa(indice, 'mapa-b').map((t) => t.id), ['controle', 'execute']);
});

// ------------------------------------------------- "qual tática chamar?"
test('quem casa mais tipos vem primeiro; o resto vai para "também servem"', () => {
  const r = taticasParaSituacao(indice, situacao('recuados'), 'mapa-a');
  assert.deepEqual(ids(r.melhores), ['mapa-a-02']); // controle + lento
  assert.deepEqual(ids(r.outras), []);
  const b = taticasParaSituacao(indice, situacao('recuados'), 'mapa-b');
  assert.deepEqual(ids(b.melhores), ['mapa-b-01']); // só controle
  assert.equal(b.relaxado, false);
});

test('o alvo A/B da situação filtra as táticas', () => {
  assert.deepEqual(ids(taticasParaSituacao(indice, situacao('b-fraco'), 'mapa-a').melhores), ['mapa-a-03']);
  assert.deepEqual(ids(taticasParaSituacao(indice, situacao('b-fraco'), 'mapa-b').melhores), ['mapa-b-03']);
});

test('sem o tipo pedido, cai para as táticas do site (relaxado)', () => {
  const r = taticasParaSituacao(indice, situacao('a-fraco'), 'mapa-b'); // mapa-b não tem split
  assert.equal(r.relaxado, true);
  assert.deepEqual(r.melhores, []);
  assert.deepEqual(ids(r.outras), ['mapa-b-02']); // Execute A
});

test('sem nada que sirva, devolve vazio para a tela explicar (não quebra)', () => {
  const r = taticasParaSituacao(indice, situacao('default'), 'mapa-b'); // mapa-b não tem default
  assert.deepEqual([r.melhores.length, r.outras.length, r.relaxado], [0, 0, true]);
  assert.deepEqual(taticasParaSituacao(indice, situacao('default'), 'mapa-inexistente').melhores, []);
});

// --------------------------------------------------------------------- busca
test('busca ignora acento e caixa', () => {
  assert.deepEqual(ids(buscar(indice, 'EXPLOSAO')), ['mapa-a-03']);
  assert.deepEqual(ids(buscar(indice, 'banana')), ['mapa-b-01', 'mapa-b-03']);
});

test('busca exige todos os termos e devolve vazio sem consulta ou sem resultado', () => {
  assert.deepEqual(ids(buscar(indice, 'rush banana')), ['mapa-b-03']);
  assert.deepEqual(buscar(indice, '   '), []);
  assert.deepEqual(buscar(indice, 'zzzzzz'), []);
});

test('letra solta só casa como palavra inteira ("b" não casa com "banana")', () => {
  const r = buscar(indice, 'b');
  assert.ok(r.every((t) => /(^|[^a-z0-9])b([^a-z0-9]|$)/.test(t.busca)), 'todas têm "b" como palavra');
  assert.ok(!ids(r).includes('mapa-b-01')); // "Controle de Banana": só tem "b" dentro de palavras
  assert.ok(ids(r).includes('mapa-a-01')); // "3 B Main."
});

test('busca: título pesa mais que o corpo', () => {
  const r = buscar(indice, 'mid');
  assert.equal(r[0].id, 'mapa-a-02'); // "Mid" no título vem antes do "Mid" só no corpo
  assert.equal(r[1].id, 'mapa-a-01');
});
