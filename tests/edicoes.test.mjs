// Lógica das edições de texto com dados sintéticos: não depende do conteúdo real das táticas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarEdicao, aplicarEdicoes, camposDaTatica, diferencas, formatarArquivo, lerArquivo, limparValores, mesclarValores,
  mesmaEdicao, sanearEdicao, temEdicao, validarEdicoes, validarFormulario,
} from '../site/js/lib/edicoes.js';
import { montarIndice, buscar } from '../site/js/data.js';

const tatica = (extra = {}) => ({
  id: 'alfa-02',
  mapa: 'alfa',
  numero: 2,
  titulo: 'Execução A padrão',
  tipos: ['execucao'],
  alvo: ['A'],
  objetivo: 'Tomar A com as três smokes.',
  economia: 'Full buy',
  funcoes: { p1: 'Abre o espaço.', p2: 'Flash no call.', p3: 'Smoke no CT.' },
  posPlant: 'Plant em Default.',
  planoB: 'Recuar.',
  ...extra,
});
const FUNCOES = ['p1', 'p2', 'p3'];
const CONTEXTO = { taticas: new Set(['alfa-02', 'alfa-03']), funcoes: new Set(FUNCOES), tipos: new Set(['execucao', 'split', 'default']) };

// --------------------------------------------------------------- valores e diferenças
test('camposDaTatica copia só o que é editável e preenche o que falta com vazio', () => {
  const v = camposDaTatica(tatica({ economia: undefined, posPlant: undefined }));
  assert.deepEqual(Object.keys(v), ['titulo', 'tipos', 'alvo', 'objetivo', 'economia', 'funcoes', 'posPlant', 'planoB']);
  assert.equal(v.economia, '');
  v.funcoes.p1 = 'mudou';
  v.tipos.push('x');
  assert.equal(tatica().funcoes.p1, 'Abre o espaço.'); // é cópia
});

test('diferencas devolve só o que mudou, funções uma a uma, sempre na ordem do arquivo', () => {
  const base = camposDaTatica(tatica());
  assert.deepEqual(diferencas(base, structuredClone(base)), {});

  const atual = structuredClone(base);
  atual.planoB = 'Se houver 3 CTs em A, vai para B.';
  atual.funcoes.p3 = 'Smoke CT e Stairs.';
  atual.tipos = ['execucao', 'split'];
  atual.titulo = 'Execução A com Stairs';
  assert.deepEqual(diferencas(base, atual), {
    titulo: 'Execução A com Stairs',
    tipos: ['execucao', 'split'],
    funcoes: { p3: 'Smoke CT e Stairs.' },
    planoB: 'Se houver 3 CTs em A, vai para B.',
  });
  assert.deepEqual(Object.keys(diferencas(base, atual)), ['titulo', 'tipos', 'funcoes', 'planoB']);
});

test('mudar a ordem dos tipos é uma mudança (o primeiro é o principal) e tirar o site de A/B também', () => {
  const base = camposDaTatica(tatica({ tipos: ['execucao', 'split'] }));
  assert.deepEqual(diferencas(base, { ...base, tipos: ['split', 'execucao'] }), { tipos: ['split', 'execucao'] });
  assert.deepEqual(diferencas(base, { ...base, alvo: [] }), { alvo: [] });
});

test('limparValores junta espaços repetidos, tira os de fora e ordena o site', () => {
  const v = limparValores({ ...camposDaTatica(tatica()), objetivo: '  Tomar   A\n com smokes ', alvo: ['B', 'A', 'X'], tipos: ['execucao', 'execucao', 'Tipo ruim'] });
  assert.equal(v.objetivo, 'Tomar A com smokes');
  assert.deepEqual(v.alvo, ['A', 'B']);
  assert.deepEqual(v.tipos, ['execucao']);
});

test('mesclarValores aceita um rascunho cru só com campos conhecidos e do tipo certo', () => {
  const base = camposDaTatica(tatica());
  const v = mesclarValores(base, { objetivo: 'Novo', planoB: 12, funcoes: { p1: 'Novo p1', p9: 'não existe' }, tipos: 'x', alvo: ['B'], intruso: 1 });
  assert.equal(v.objetivo, 'Novo');
  assert.equal(v.planoB, 'Recuar.'); // número não vale
  assert.deepEqual(v.funcoes, { p1: 'Novo p1', p2: 'Flash no call.', p3: 'Smoke no CT.' });
  assert.deepEqual(v.tipos, ['execucao']);
  assert.deepEqual(v.alvo, ['B']);
  assert.equal('intruso' in v, false);
  assert.equal(mesclarValores(base, 'lixo'), base);
});

// ---------------------------------------------------------------- formulário
test('validarFormulario aponta cada campo com problema', () => {
  const ok = camposDaTatica(tatica());
  assert.deepEqual(validarFormulario(ok, FUNCOES), {});

  const ruim = { ...ok, titulo: '  ', objetivo: '', tipos: [], funcoes: { p1: '', p2: 'x'.repeat(601), p3: 'ok' }, planoB: 'y'.repeat(601) };
  const erros = validarFormulario(ruim, FUNCOES);
  assert.deepEqual(Object.keys(erros).sort(), ['funcoes.p1', 'funcoes.p2', 'objetivo', 'planoB', 'tipos', 'titulo']);
  assert.match(erros['funcoes.p2'], /no máximo 600/);

  assert.match(validarFormulario({ ...ok, titulo: '3. Execução' }, FUNCOES).titulo, /número/);
  // economia, pós-plant e plano B podem ficar vazios
  assert.deepEqual(validarFormulario({ ...ok, economia: '', posPlant: '', planoB: '' }, FUNCOES), {});
});

// ----------------------------------------------------------------- edição
test('sanearEdicao descarta o que não presta e mantém a ordem do arquivo', () => {
  const e = sanearEdicao({
    planoB: '  Novo   plano ', intruso: 1, atualizadoEm: '2026-10-01', titulo: '', tipos: ['split', 'Ruim', 'split'], alvo: ['B', 'A', 'Z'],
    objetivo: '   ', funcoes: { p3: ' Smoke ', p9x: '', 'Ruim ID': 'x' }, economia: '',
  });
  assert.deepEqual(e, { atualizadoEm: '2026-10-01', tipos: ['split'], alvo: ['A', 'B'], economia: '', funcoes: { p3: 'Smoke' }, planoB: 'Novo plano' });
  assert.deepEqual(Object.keys(e), ['atualizadoEm', 'tipos', 'alvo', 'economia', 'funcoes', 'planoB']);
  assert.deepEqual(sanearEdicao(null), {});
  assert.deepEqual(sanearEdicao({ atualizadoEm: 'ontem' }), {});
});

test('temEdicao e mesmaEdicao ignoram a data', () => {
  assert.equal(temEdicao({ atualizadoEm: '2026-10-01' }), false);
  assert.equal(temEdicao({}), false);
  assert.equal(temEdicao({ planoB: 'x' }), true);
  assert.equal(mesmaEdicao({ atualizadoEm: '2026-10-01', planoB: 'x' }, { atualizadoEm: '2026-11-05', planoB: ' x ' }), true);
  assert.equal(mesmaEdicao({ planoB: 'x' }, { planoB: 'y' }), false);
});

test('aplicarEdicao põe os campos por cima e mexe só nas funções citadas', () => {
  const t = tatica();
  const nova = aplicarEdicao(t, { atualizadoEm: '2026-10-01', planoB: 'Outro', funcoes: { p3: 'Smoke CT e Stairs.' }, alvo: [] });
  assert.equal(nova.planoB, 'Outro');
  assert.deepEqual(nova.alvo, []);
  assert.deepEqual(nova.funcoes, { p1: 'Abre o espaço.', p2: 'Flash no call.', p3: 'Smoke CT e Stairs.' });
  assert.equal(nova.objetivo, t.objetivo);
  assert.equal(t.planoB, 'Recuar.'); // o original não muda
  assert.equal(aplicarEdicao(t, {}), t);
  assert.equal(aplicarEdicao(t, undefined), t);
  assert.equal(nova.atualizadoEm, undefined);
});

test('aplicarEdicoes marca a tática editada e o índice (busca, tipos) enxerga o texto novo', () => {
  const cru = {
    meta: { titulo: 'T' },
    funcoes: [{ id: 'p1', sigla: 'P1', nome: 'Entry' }, { id: 'p2', sigla: 'P2', nome: 'Flash' }, { id: 'p3', sigla: 'P3', nome: 'Smoke' }],
    tipos: [{ id: 'execucao', nome: 'Execução' }, { id: 'split', nome: 'Split' }],
    mapas: [{ id: 'alfa', nome: 'Alfa' }],
    taticas: [tatica(), tatica({ id: 'alfa-03', numero: 3, titulo: 'Outra' })],
  };
  const aplicado = aplicarEdicoes(cru, { 'alfa-02': { atualizadoEm: '2026-10-01', tipos: ['split'], funcoes: { p3: 'Smoke na Ticket Booth.' } }, 'alfa-03': { atualizadoEm: '2026-10-01' } }, { 'alfa-02': 'aparelho' });

  assert.deepEqual(aplicado.taticas[0].edicao, { origem: 'aparelho', atualizadoEm: '2026-10-01', campos: ['tipos', 'funcoes'] });
  assert.equal(aplicado.taticas[1].edicao, undefined); // edição vazia não marca
  assert.equal(cru.taticas[0].edicao, undefined); // o cru não é alterado

  const indice = montarIndice(aplicado);
  assert.deepEqual(buscar(indice, 'ticket booth').map((t) => t.id), ['alfa-02']);
  assert.deepEqual(buscar(montarIndice(cru), 'ticket booth'), []);
  assert.equal(indice.taticasById.get('alfa-02').tipos[0], 'split');
  assert.equal(indice.taticasById.get('alfa-02').edicao.origem, 'aparelho');
  assert.equal(aplicarEdicoes({ x: 1 }, {}).x, 1);
});

// ------------------------------------------------------------------- arquivo
test('formatarArquivo escreve JSON válido, um campo por linha, e deixa de fora o que não muda nada', () => {
  const texto = formatarArquivo({
    'alfa-03': { atualizadoEm: '2026-10-02', planoB: 'Recuar para Mid.' },
    'alfa-02': { atualizadoEm: '2026-10-01', planoB: 'Novo', funcoes: { p3: 'Smoke CT e Stairs.', p1: 'Entra primeiro.' }, tipos: ['split', 'execucao'], alvo: [] },
    'alfa-04': { atualizadoEm: '2026-10-01' },
    'alfa-05': {},
  });
  const lido = JSON.parse(texto);
  assert.equal(lido.versao, 1);
  assert.deepEqual(Object.keys(lido.taticas), ['alfa-02', 'alfa-03']); // ordenado, sem vazias
  assert.deepEqual(Object.keys(lido.taticas['alfa-02']), ['atualizadoEm', 'tipos', 'alvo', 'funcoes', 'planoB']);
  assert.equal(texto.split('\n').filter((l) => l.includes('"planoB"')).length, 2);
  assert.match(texto, /^ {8}"p3": "Smoke CT e Stairs\."/m); // uma função por linha
  assert.ok(texto.endsWith('}\n'));
});

test('formatarArquivo vazio continua sendo um arquivo válido', () => {
  assert.deepEqual(JSON.parse(formatarArquivo()), { versao: 1, taticas: {} });
});

test('o arquivo escrito é lido de volta igual', () => {
  const edicoes = { 'alfa-02': { atualizadoEm: '2026-10-01', titulo: 'Novo título', economia: '', funcoes: { p2: 'Flash por cima da Ramp.' } } };
  assert.deepEqual(lerArquivo(JSON.parse(formatarArquivo(edicoes))), edicoes);
});

test('lerArquivo ignora entradas vazias, com id inválido ou que não são objetos', () => {
  const lido = lerArquivo({ taticas: { 'alfa-02': { planoB: 'x' }, 'ID ruim': { planoB: 'x' }, 'alfa-03': {}, 'alfa-04': 'texto', 'alfa-05': { atualizadoEm: '2026-10-01' } } });
  assert.deepEqual(Object.keys(lido), ['alfa-02']);
  assert.deepEqual(lerArquivo(null), {});
});

// ------------------------------------------------------------------ validação
const valido = () => ({
  versao: 1,
  taticas: { 'alfa-02': { atualizadoEm: '2026-10-01', titulo: 'Execução A com Stairs', tipos: ['execucao', 'split'], alvo: ['A'], objetivo: 'Tomar A.', economia: '', funcoes: { p3: 'Smoke.' }, posPlant: 'Plant.', planoB: 'Recuar.' } },
});

test('validarEdicoes aceita um arquivo correto, inclusive o que o próprio app escreve', () => {
  assert.deepEqual(validarEdicoes(valido(), CONTEXTO), { erros: [], avisos: [] });
  const escrito = JSON.parse(formatarArquivo({ 'alfa-02': { atualizadoEm: '2026-10-01', planoB: 'x', funcoes: { p1: 'y' }, alvo: [] } }));
  assert.deepEqual(validarEdicoes(escrito, CONTEXTO).erros, []);
});

test('validarEdicoes explica cada erro', () => {
  const casos = [
    [(d) => { d.versao = 2; }, /versao/],
    [(d) => { d.taticas = []; }, /"taticas" precisa ser um objeto/],
    [(d) => { d.taticas['alfa-02'] = 'texto'; }, /precisa ser um objeto/],
    [(d) => { d.taticas['alfa-02'].mapa = 'beta'; }, /o campo "mapa" não pode ser editado/],
    [(d) => { d.taticas['alfa-02'].id = 'x'; }, /o campo "id" não pode ser editado/],
    [(d) => { d.taticas['alfa-02'].atualizadoEm = 'ontem'; }, /"atualizadoEm" precisa ser uma data/],
    [(d) => { d.taticas['alfa-02'].titulo = ''; }, /"titulo" precisa ter de 1 a 80/],
    [(d) => { d.taticas['alfa-02'].titulo = '2. Execução'; }, /numeração/],
    [(d) => { d.taticas['alfa-02'].objetivo = '   '; }, /"objetivo" precisa ter/],
    [(d) => { d.taticas['alfa-02'].planoB = 'x'.repeat(601); }, /"planoB" precisa ser um texto de até 600/],
    [(d) => { d.taticas['alfa-02'].tipos = []; }, /"tipos" precisa ser uma lista/],
    [(d) => { d.taticas['alfa-02'].tipos = ['zzz']; }, /o tipo "zzz" não existe/],
    [(d) => { d.taticas['alfa-02'].alvo = ['C']; }, /"alvo" aceita só/],
    [(d) => { d.taticas['alfa-02'].funcoes = {}; }, /"funcoes" precisa ser/],
    [(d) => { d.taticas['alfa-02'].funcoes = { p9: 'x' }; }, /a função "p9" não existe/],
    [(d) => { d.taticas['alfa-02'].funcoes = { p1: '' }; }, /funcoes\."p1" precisa ter de 1 a 600/],
  ];
  for (const [quebrar, esperado] of casos) {
    const d = valido();
    quebrar(d);
    const { erros } = validarEdicoes(d, CONTEXTO);
    assert.ok(erros.some((e) => esperado.test(e)), `esperava ${esperado}, veio: ${JSON.stringify(erros)}`);
  }
});

test('edição de tática que saiu do playbook, ou que não muda nada, é só aviso (não derruba o deploy)', () => {
  const d = valido();
  d.taticas['alfa-99'] = { planoB: 'x' };
  d.taticas['alfa-03'] = { atualizadoEm: '2026-10-01' };
  const { erros, avisos } = validarEdicoes(d, CONTEXTO);
  assert.deepEqual(erros, []);
  assert.ok(avisos.some((a) => a.includes('alfa-99') && a.includes('não existe mais')));
  assert.ok(avisos.some((a) => a.includes('alfa-03') && a.includes('não muda nada')));
});
