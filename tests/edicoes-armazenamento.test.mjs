// Armazenamento das edições de texto (site + aparelho + rascunho) com localStorage e fetch falsos: roda no Node.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

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

const { store, favoritas } = await import('../site/js/store.js');
const ed = await import('../site/js/edicoes.js');
const { salvas, rascunhos } = ed;
const { montarIndice } = await import('../site/js/data.js');

const tatica = (id, extra = {}) => ({
  id, mapa: 'alfa', numero: Number(id.slice(-2)), titulo: `Tática ${id}`, tipos: ['execucao'], alvo: ['A'],
  objetivo: `Objetivo ${id}.`, economia: 'Full buy', funcoes: { p1: 'Abre.', p2: 'Flash.', p3: 'Smoke.' }, posPlant: 'Plant.', planoB: 'Recuar.', ...extra,
});
const CRU = {
  meta: { titulo: 'T' },
  funcoes: [{ id: 'p1', sigla: 'P1', nome: 'Entry' }, { id: 'p2', sigla: 'P2', nome: 'Flash' }, { id: 'p3', sigla: 'P3', nome: 'Smoke' }],
  tipos: [{ id: 'execucao', nome: 'Execução' }, { id: 'split', nome: 'Split' }],
  mapas: [{ id: 'alfa', nome: 'Alfa' }],
  taticas: [tatica('alfa-01'), tatica('alfa-02'), tatica('alfa-03')],
};
const DO_SITE = { versao: 1, taticas: { 'alfa-01': { atualizadoEm: '2026-09-20', planoB: 'Plano do site.' } } };

function falsoFetch(corpo, { ok = true, status = 200 } = {}) {
  globalThis.fetch = async () => ({ ok, status, json: async () => corpo });
}
const valores = (id) => ed.valoresSalvos(id);

beforeEach(async () => {
  salvas.limpar();
  rascunhos.limpar();
  ed.definirBase(CRU);
  falsoFetch(DO_SITE);
  await ed.carregarEdicoes();
});

test('carregarEdicoes lê o do site; sem arquivo (404) ou com falha de rede o app segue com o playbook.json', async () => {
  assert.equal(ed.doSite('alfa-01').planoB, 'Plano do site.');
  falsoFetch({}, { ok: false, status: 404 });
  await ed.carregarEdicoes();
  assert.equal(ed.doSite('alfa-01'), null);
  globalThis.fetch = async () => {
    throw new Error('sem rede');
  };
  await ed.carregarEdicoes();
  assert.equal(ed.edicaoDaTatica('alfa-01'), null);
});

test('valores: original (PDF), publicado (site) e salvo (aparelho) são três coisas diferentes', () => {
  assert.equal(ed.valoresOriginais('alfa-01').planoB, 'Recuar.');
  assert.equal(ed.valoresPublicados('alfa-01').planoB, 'Plano do site.');
  assert.equal(valores('alfa-01').planoB, 'Plano do site.');

  ed.salvarValores('alfa-01', { ...valores('alfa-01'), planoB: 'Meu plano.' });
  assert.equal(valores('alfa-01').planoB, 'Meu plano.');
  assert.equal(ed.valoresPublicados('alfa-01').planoB, 'Plano do site.'); // o que o time vê não mudou
  assert.equal(ed.valoresOriginais('alfa-01').planoB, 'Recuar.');
});

test('salvarValores guarda só o que difere do playbook.json e põe a data de hoje', () => {
  const v = ed.valoresOriginais('alfa-02');
  v.funcoes.p3 = '  Smoke  CT e Stairs. ';
  v.objetivo = 'Tomar A com três smokes.';
  assert.deepEqual(ed.salvarValores('alfa-02', v), { mudou: true });
  const e = salvas.obter('alfa-02');
  assert.match(e.atualizadoEm, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(e), ['atualizadoEm', 'objetivo', 'funcoes']);
  assert.deepEqual(e.funcoes, { p3: 'Smoke CT e Stairs.' }); // só a função que mudou, com espaços arrumados
});

test('a data só muda quando o conteúdo muda', () => {
  const v = ed.valoresOriginais('alfa-02');
  v.planoB = 'Novo.';
  ed.salvarValores('alfa-02', v);
  salvas.salvar('alfa-02', { ...salvas.obter('alfa-02'), atualizadoEm: '2026-01-15' }); // finge uma edição antiga
  ed.salvarValores('alfa-02', v); // salvar o mesmo conteúdo de novo
  assert.equal(salvas.obter('alfa-02').atualizadoEm, '2026-01-15');
  ed.salvarValores('alfa-02', { ...v, planoB: 'Outro.' });
  assert.notEqual(salvas.obter('alfa-02').atualizadoEm, '2026-01-15');
});

test('voltar ao texto do PDF: sem edição no site some a cópia local; com edição no site fica uma "vazia" que a esconde', () => {
  // alfa-02 não tem edição no site
  ed.salvarValores('alfa-02', { ...ed.valoresOriginais('alfa-02'), planoB: 'Novo.' });
  assert.ok(salvas.tem('alfa-02'));
  assert.deepEqual(ed.salvarValores('alfa-02', ed.valoresOriginais('alfa-02')), { mudou: false });
  assert.equal(salvas.tem('alfa-02'), false);

  // alfa-01 tem edição no site: voltar ao original precisa esconder a do site
  assert.equal(ed.edicaoDaTatica('alfa-01').origem, 'site');
  ed.salvarValores('alfa-01', ed.valoresOriginais('alfa-01'));
  assert.ok(salvas.tem('alfa-01'));
  assert.equal(ed.edicaoDaTatica('alfa-01'), null);
  assert.equal(valores('alfa-01').planoB, 'Recuar.');
  assert.doesNotMatch(ed.exportarArquivo(), /alfa-01/); // e a exportação tira a edição do site
});

test('voltarAoPublicado descarta o salvo e o rascunho', () => {
  ed.salvarValores('alfa-01', { ...valores('alfa-01'), planoB: 'Meu plano.' });
  rascunhos.guardar('alfa-01', { ...valores('alfa-01'), planoB: 'Rascunho.' });
  ed.voltarAoPublicado('alfa-01');
  assert.equal(salvas.tem('alfa-01') || rascunhos.tem('alfa-01'), false);
  assert.equal(valores('alfa-01').planoB, 'Plano do site.');
});

test('pontoDePartida: rascunho > salvo no aparelho > publicado > original', () => {
  assert.equal(ed.pontoDePartida('alfa-02').inicial.planoB, 'Recuar.');
  assert.equal(ed.pontoDePartida('alfa-01').inicial.planoB, 'Plano do site.');

  ed.salvarValores('alfa-01', { ...valores('alfa-01'), planoB: 'Meu plano.' });
  assert.equal(ed.pontoDePartida('alfa-01').inicial.planoB, 'Meu plano.');

  rascunhos.guardar('alfa-01', { ...valores('alfa-01'), planoB: 'Rascunho.', funcoes: { p2: 'Flash no rascunho.' } });
  const p = ed.pontoDePartida('alfa-01');
  assert.equal(p.recuperado, true);
  assert.equal(p.inicial.planoB, 'Rascunho.');
  assert.equal(p.inicial.funcoes.p2, 'Flash no rascunho.');
  assert.equal(p.inicial.funcoes.p1, 'Abre.'); // o que o rascunho não traz vem do salvo
  assert.equal(p.salvos.planoB, 'Meu plano.'); // o salvo é a referência para saber se há mudança pendente

  rascunhos.descartar('alfa-01');
  assert.equal(ed.pontoDePartida('alfa-01').recuperado, false);
});

test('aplicar põe as edições (aparelho vence site) por cima do playbook.json e marca a origem', () => {
  ed.salvarValores('alfa-02', { ...ed.valoresOriginais('alfa-02'), objetivo: 'Objetivo melhorado.' });
  const aplicado = ed.aplicar(CRU);
  const por = Object.fromEntries(aplicado.taticas.map((t) => [t.id, t]));
  assert.equal(por['alfa-01'].planoB, 'Plano do site.');
  assert.equal(por['alfa-01'].edicao.origem, 'site');
  assert.equal(por['alfa-02'].objetivo, 'Objetivo melhorado.');
  assert.equal(por['alfa-02'].edicao.origem, 'aparelho');
  assert.equal(por['alfa-03'].edicao, undefined);
  assert.equal(CRU.taticas[1].objetivo, 'Objetivo alfa-02.'); // o cru não muda
  assert.equal(montarIndice(aplicado).taticasById.get('alfa-02').objetivo, 'Objetivo melhorado.');
});

test('edição salva igual à do site é "publicada" (não "só neste aparelho") e sai na próxima abertura', async () => {
  ed.salvarValores('alfa-01', { ...valores('alfa-01'), planoB: 'Plano do site.' }); // igual ao publicado
  salvas.salvar('alfa-01', { ...DO_SITE.taticas['alfa-01'] });
  assert.equal(ed.edicaoDaTatica('alfa-01').origem, 'site');
  assert.ok(salvas.tem('alfa-01'));

  await ed.carregarEdicoes(); // próxima abertura do app
  assert.equal(salvas.tem('alfa-01'), false, 'a cópia redundante foi descartada');

  // alguém muda no site: quem tinha a cópia antiga passa a ver a versão nova
  falsoFetch({ versao: 1, taticas: { 'alfa-01': { atualizadoEm: '2026-10-05', planoB: 'Plano novo do site.' } } });
  await ed.carregarEdicoes();
  assert.equal(valores('alfa-01').planoB, 'Plano novo do site.');
});

test('cópia local diferente da publicada é mantida; "vazia" sobre o nada é descartada; falha de rede não apaga nada', async () => {
  ed.salvarValores('alfa-01', { ...valores('alfa-01'), planoB: 'Meu plano.' });
  salvas.salvar('alfa-02', {}); // "voltei ao original" de algo que nem foi editado
  await ed.carregarEdicoes();
  assert.ok(salvas.tem('alfa-01'));
  assert.equal(salvas.tem('alfa-02'), false);

  globalThis.fetch = async () => {
    throw new Error('sem rede');
  };
  await ed.carregarEdicoes();
  assert.ok(salvas.tem('alfa-01'), 'sem conseguir ler o site, nada salvo é apagado');
});

test('situacao e contagem resumem o que está editado e o que ainda é só deste aparelho', () => {
  assert.deepEqual(ed.situacao('alfa-03'), { editada: false, origem: null, atualizadoEm: null, rascunho: false });
  assert.deepEqual(ed.situacao('alfa-01'), { editada: true, origem: 'site', atualizadoEm: '2026-09-20', rascunho: false });
  assert.deepEqual(ed.contagem(), { total: 1, soNoAparelho: 0 });

  ed.salvarValores('alfa-02', { ...ed.valoresOriginais('alfa-02'), planoB: 'Novo.' });
  rascunhos.guardar('alfa-02', ed.valoresOriginais('alfa-02'));
  assert.equal(ed.situacao('alfa-02').origem, 'aparelho');
  assert.equal(ed.situacao('alfa-02').rascunho, true);
  assert.deepEqual(ed.contagem(), { total: 2, soNoAparelho: 1 });
});

test('exportarArquivo junta o site e o aparelho; importarArquivo traz de outro aparelho', () => {
  ed.salvarValores('alfa-02', { ...ed.valoresOriginais('alfa-02'), planoB: 'Novo.' });
  ed.salvarValores('alfa-01', { ...valores('alfa-01'), planoB: 'Meu plano.' }); // sobrescreve o do site
  const arquivo = JSON.parse(ed.exportarArquivo());
  assert.deepEqual(Object.keys(arquivo.taticas), ['alfa-01', 'alfa-02']);
  assert.equal(arquivo.taticas['alfa-01'].planoB, 'Meu plano.');

  salvas.limpar();
  assert.equal(ed.importarArquivo(arquivo), 2);
  assert.equal(valores('alfa-02').planoB, 'Novo.');
  assert.equal(ed.importarArquivo('lixo'), 0);
  assert.equal(ed.importarArquivo({ taticas: { 'ID ruim': { planoB: 'x' }, 'alfa-03': {} } }), 0);
});

test('"Apagar dados" limpa favoritas e preferências, mas não as edições nem os rascunhos', () => {
  favoritas.alternar('alfa-01');
  store.set('tema', 'claro');
  ed.salvarValores('alfa-02', { ...ed.valoresOriginais('alfa-02'), planoB: 'Novo.' });
  rascunhos.guardar('alfa-03', ed.valoresOriginais('alfa-03'));

  store.limpar();

  assert.equal(favoritas.tem('alfa-01'), false);
  assert.equal(store.get('tema'), null);
  assert.ok(salvas.tem('alfa-02') && rascunhos.tem('alfa-03'));
  assert.ok(guardado.has('pb.edicoes') && guardado.has('pb.edicao-rascunho'), 'continuam gravados no localStorage');
});

test('valor corrompido no armazenamento não derruba o app', () => {
  guardado.set('pb.edicoes', '{isto não é json');
  guardado.set('pb.edicao-rascunho', '[1,2');
  assert.equal(salvas.tem('alfa-01'), false);
  assert.equal(ed.pontoDePartida('alfa-01').inicial.planoB, 'Plano do site.');
});
