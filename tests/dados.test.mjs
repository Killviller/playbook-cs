// Testes da lógica com dados sintéticos: assim editar as táticas do time não quebra o CI.
// O único teste amarrado ao conteúdo real é a validação (ele protege o deploy de um JSON quebrado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validarPlaybook } from '../scripts/lib/validar.mjs';
import { agruparPorTipo, buscar, funcoesDaTatica, montarIndice, tiposDoMapa, vizinhas } from '../site/js/data.js';

const siteDir = fileURLToPath(new URL('../site/', import.meta.url));

const FUNCOES = [
  { id: 'p1', sigla: 'P1', nome: 'Entry', curto: 'Entry', descricao: 'Primeiro a entrar.' },
  { id: 'p2', sigla: 'P2', nome: 'Suporte 1 - Flash', curto: 'Flash', descricao: 'Joga as flashes.' },
  { id: 'p3', sigla: 'P3', nome: 'Suporte 2 - Smoke / IGL', curto: 'Smoke/IGL', descricao: 'Lê o round.' },
  { id: 'p4', sigla: 'P4', nome: 'AWP', curto: 'AWP', descricao: 'Segura a rotação.' },
  { id: 'p5', sigla: 'P5', nome: 'Lurker', curto: 'Lurker', descricao: 'Joga separado.' },
];

const tatica = (mapa, numero, titulo, tipos, alvo, extra = {}) => ({
  id: `${mapa}-${String(numero).padStart(2, '0')}`,
  mapa,
  numero,
  titulo,
  tipos,
  alvo,
  objetivo: `Objetivo de ${titulo}.`,
  economia: 'Full buy',
  funcoes: { p1: 'Abre o espaço.', p2: 'Flash no call.', p3: 'Smoke no CT.', p4: 'Segura o meio.', p5: 'Vigia as costas.' },
  posPlant: 'Plant em A.',
  planoB: 'Recuar.',
  ...extra,
});

const exemplo = () => ({
  meta: { titulo: 'Teste' },
  funcoes: structuredClone(FUNCOES),
  tipos: [
    { id: 'pistol', nome: 'Pistol', descricao: 'Primeiro round da metade.', cor: '#8e5bd0' },
    { id: 'default', nome: 'Default', descricao: 'Coletar informação.', cor: '#3c9a5f' },
    { id: 'execucao', nome: 'Execução', descricao: 'Ataque coordenado.', cor: '#d14b3f' },
    { id: 'split', nome: 'Split', cor: '#2f7dd1' },
    { id: 'contato', nome: 'Contato', cor: '#3a8c9a' },
    { id: 'force', nome: 'Force', cor: '#6b6b6b' },
  ],
  regras: [{ titulo: 'Trade sempre', texto: 'ninguém entra sozinho.' }],
  mapas: [
    { id: 'alfa', nome: 'Alfa', descricao: 'Mapa de controle de Mid.' },
    { id: 'bravo', nome: 'Bravo' },
    { id: 'charlie', nome: 'Charlie', ativo: false },
  ],
  taticas: [
    tatica('alfa', 1, 'Pistol - Rush A Main', ['pistol'], ['A']),
    tatica('alfa', 2, 'Controle de Mid para A', ['execucao'], ['A']),
    tatica('alfa', 3, 'Execução B padrão', ['execucao'], ['B']),
    tatica('alfa', 4, 'Split B (Mid + Ramp)', ['split'], ['B'], {
      funcoes: { p1: 'Em B Ramp.', p2: 'Flash em Cave.', p3: 'Smoke CT de B.', p4: 'Segura Elbow durante o call.', p5: 'Em A Main.' },
    }),
    tatica('alfa', 5, 'Default lenta + Lurk B', ['default', 'execucao'], []),
    tatica('alfa', 6, 'Tática sem tipo conhecido', [], []),
    tatica('bravo', 1, 'Contato B (Banana)', ['contato'], ['B']),
    tatica('bravo', 2, 'Force buy - Rush A', ['force'], ['A']),
    tatica('charlie', 1, 'Tática de mapa fora do pool', ['default'], []),
  ],
});

const indice = montarIndice(exemplo());
const ids = (lista) => lista.map((t) => t.id);

// ------------------------------------------------------------- dados reais
test('o playbook.json real passa na validação (erros bloqueiam o deploy)', async () => {
  const cru = JSON.parse(await readFile(`${siteDir}data/playbook.json`, 'utf8'));
  const { erros } = await validarPlaybook(cru, { siteDir });
  assert.deepEqual(erros, []);
  const idx = montarIndice(cru);
  assert.ok(idx.mapas.length > 0 && idx.funcoes.length > 0 && idx.tipos.length > 0);
});

// --------------------------------------------------------------- validador
test('o validador aceita o exemplo (tática sem tipo vira só aviso)', async () => {
  const { erros, avisos } = await validarPlaybook(exemplo(), { siteDir });
  assert.deepEqual(erros, []);
  assert.match(avisos.join('\n'), /alfa-06.*sem "tipos"/);
});

test('o validador pega erros comuns de edição', async () => {
  const q = exemplo();
  q.taticas[1].id = q.taticas[0].id; // id repetido
  q.taticas[2].mapa = 'overpass'; // mapa que não existe
  q.taticas[3].tipos = ['inexistente'];
  q.taticas[4].funcoes.p1 = '**sobra de markdown**';
  q.taticas[5].titulo = '6. Com numeração';
  q.taticas[6].radar = [{ src: 'img/nao-existe.webp' }];
  q.taticas[7].alvo = ['C'];
  q.taticas[0].granadas = 'não é lista';
  q.tipos[0].cor = 'roxo';
  const texto = (await validarPlaybook(q, { siteDir })).erros.join('\n');
  for (const trecho of [
    'id repetido', 'overpass', 'inexistente', 'sobra de formatação', 'numeração',
    'não existe dentro de site/', '"alvo" aceita só', '"granadas" precisa', 'hexadecimal',
  ]) {
    assert.match(texto, new RegExp(trecho), `faltou o erro sobre: ${trecho}`);
  }
});

test('o validador exige o objetivo e o que cada função faz, e recusa função desconhecida', async () => {
  const q = exemplo();
  delete q.taticas[0].objetivo;
  delete q.taticas[1].funcoes.p3;
  q.taticas[2].funcoes.p9 = 'função que não existe';
  q.taticas[3].funcoes = ['p1'];
  const texto = (await validarPlaybook(q, { siteDir })).erros.join('\n');
  assert.match(texto, /"alfa-01": falta o "objetivo"/);
  assert.match(texto, /"alfa-02": falta o que a função "p3" faz/);
  assert.match(texto, /"alfa-03": a função "p9" não existe/);
  assert.match(texto, /"alfa-04": "funcoes" precisa ser um objeto/);
});

test('campos opcionais ausentes são só avisos', async () => {
  const q = exemplo();
  delete q.taticas[0].economia;
  delete q.taticas[0].posPlant;
  delete q.taticas[0].planoB;
  const { erros, avisos } = await validarPlaybook(q, { siteDir });
  assert.deepEqual(erros, []);
  const texto = avisos.join('\n');
  for (const campo of ['economia', 'posPlant', 'planoB']) assert.match(texto, new RegExp(`"alfa-01": sem "${campo}"`));
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
  assert.match(avisos.join('\n'), /alfa-01.*Conferir/);
});

// ------------------------------------------------------------------- índice
test('mapa com ativo:false some do app junto com as suas táticas', () => {
  assert.deepEqual(indice.mapas.map((m) => m.id), ['alfa', 'bravo']);
  assert.equal(indice.taticasById.has('charlie-01'), false);
  assert.equal(indice.taticas.length, 8);
});

test('cada tática ganha a "chamada" que o time usa no rádio (mapa + número)', () => {
  assert.equal(indice.taticasById.get('alfa-04').chamada, 'Alfa 4');
  assert.equal(indice.taticasById.get('bravo-01').chamada, 'Bravo 1');
});

test('vizinhas dá anterior/próxima dentro do mesmo mapa', () => {
  const primeira = indice.taticasById.get('alfa-01');
  const ultima = indice.taticasById.get('alfa-06');
  assert.equal(vizinhas(indice, primeira).anterior, null);
  assert.equal(vizinhas(indice, primeira).proxima.id, 'alfa-02');
  assert.equal(vizinhas(indice, ultima).proxima, null);
  assert.deepEqual([vizinhas(indice, ultima).pos, vizinhas(indice, ultima).total], [6, 6]);
});

test('tiposDoMapa lista só os tipos presentes, na ordem do cadastro', () => {
  assert.deepEqual(tiposDoMapa(indice, 'alfa').map((t) => t.id), ['pistol', 'default', 'execucao', 'split']);
  assert.deepEqual(tiposDoMapa(indice, 'bravo').map((t) => t.id), ['contato', 'force']);
});

// ------------------------------------------------------- "Chamar": por tipo
test('agruparPorTipo usa o tipo principal (o primeiro) e a ordem do cadastro de tipos', () => {
  const grupos = agruparPorTipo(indice, 'alfa');
  assert.deepEqual(
    grupos.map((g) => [g.tipo?.id ?? null, ids(g.taticas)]),
    [['pistol', ['alfa-01']], ['default', ['alfa-05']], ['execucao', ['alfa-02', 'alfa-03']], ['split', ['alfa-04']], [null, ['alfa-06']]],
  );
  // alfa-05 é Default/Execução: aparece uma vez só, no grupo Default
  assert.equal(grupos.flatMap((g) => ids(g.taticas)).filter((id) => id === 'alfa-05').length, 1);
});

// ---------------------------------------------------- "Minha função" (P1–P5)
test('funcoesDaTatica mantém a ordem P1–P5 quando não há função escolhida', () => {
  const lista = funcoesDaTatica(indice, indice.taticasById.get('alfa-04'));
  assert.deepEqual(lista.map((f) => f.id), ['p1', 'p2', 'p3', 'p4', 'p5']);
  assert.ok(lista.every((f) => f.minha === false));
  assert.equal(lista[3].texto, 'Segura Elbow durante o call.');
});

test('com função escolhida, ela vem primeiro e marcada; o resto segue em ordem', () => {
  const lista = funcoesDaTatica(indice, indice.taticasById.get('alfa-04'), 'p4');
  assert.deepEqual(lista.map((f) => f.id), ['p4', 'p1', 'p2', 'p3', 'p5']);
  assert.deepEqual(lista.map((f) => f.minha), [true, false, false, false, false]);
  assert.equal(funcoesDaTatica(indice, indice.taticasById.get('alfa-04'), 'p1')[0].id, 'p1');
});

test('função desconhecida é ignorada e função sem texto na tática fica de fora', () => {
  const t = indice.taticasById.get('alfa-04');
  assert.deepEqual(funcoesDaTatica(indice, t, 'p9').map((f) => f.id), ['p1', 'p2', 'p3', 'p4', 'p5']);
  const sem = montarIndice({ ...exemplo(), taticas: [{ ...exemplo().taticas[0], funcoes: { p1: 'a', p3: 'c' } }] });
  assert.deepEqual(funcoesDaTatica(sem, sem.taticas[0], 'p3').map((f) => f.id), ['p3', 'p1']);
});

// --------------------------------------------------------------------- busca
test('busca ignora acento e caixa', () => {
  assert.deepEqual(ids(buscar(indice, 'EXECUÇÃO')), ['alfa-02', 'alfa-03', 'alfa-05']);
  assert.deepEqual(ids(buscar(indice, 'banana')), ['bravo-01']);
});

test('busca olha o texto das funções e o objetivo, não só o título', () => {
  assert.deepEqual(ids(buscar(indice, 'elbow')), ['alfa-04']); // só no que o AWP faz
  assert.deepEqual(ids(buscar(indice, 'objetivo de contato')), ['bravo-01']); // objetivo
});

test('busca pela chamada do rádio ("alfa 4")', () => {
  assert.equal(buscar(indice, 'alfa 4')[0].id, 'alfa-04');
  assert.deepEqual(ids(buscar(indice, 'alfa 4')), ['alfa-04']);
});

test('busca exige todos os termos e devolve vazio sem consulta ou sem resultado', () => {
  assert.deepEqual(ids(buscar(indice, 'split ramp')), ['alfa-04']);
  assert.deepEqual(buscar(indice, '   '), []);
  assert.deepEqual(buscar(indice, 'zzzzzz'), []);
});

test('letra solta só casa como palavra inteira ("b" não casa com "Bravo" nem "buy")', () => {
  assert.deepEqual(ids(buscar(indice, 'b')), ['alfa-03', 'alfa-04', 'alfa-05', 'bravo-01']);
});

test('busca: título pesa mais que o corpo', () => {
  const r = buscar(indice, 'mid');
  assert.deepEqual(ids(r), ['alfa-02', 'alfa-04']); // "Mid" no título das duas
  assert.equal(r.length, 2);
  const corpo = buscar(indice, 'smoke'); // só no texto das funções
  assert.ok(corpo.length >= 6 && corpo.every((t) => !/smoke/i.test(t.titulo)));
});

test('o validador confere "posicoes" e imagens de mapa', async () => {
  const d = exemplo();
  d.taticas[0].posicoes = { p1: [[10, 10], [50, 50], [90, 90]], p2: [[10, 10], [50, 50], [90, 90]] };
  assert.equal((await validarPlaybook(d)).erros.length, 0);
  d.taticas[0].posicoes.p2 = [[10, 10], [50, 50]];
  assert.ok((await validarPlaybook(d)).erros.some((e) => e.includes('mesmo número de fases')));
  d.taticas[0].posicoes = { p1: [[10, 10], [150, 50]] };
  assert.ok((await validarPlaybook(d)).erros.some((e) => e.includes('0 a 100')));
  const m = exemplo();
  m.mapas[0].radar = '/img/radar.webp';
  assert.ok((await validarPlaybook(m)).erros.some((e) => e.includes('caminho relativo')));
});
