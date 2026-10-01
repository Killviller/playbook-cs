// Armazenamento dos radares (site + aparelho) com localStorage e fetch falsos: roda no Node, sem navegador.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const guardado = new Map();
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
  key: (i) => [...guardado.keys()][i] ?? null,
  get length() {
    return guardado.size;
  },
};
// Object.keys(localStorage) é o que store.limpar usa: o objeto falso expõe as chaves como propriedades
const espelho = new Proxy(globalThis.localStorage, {
  ownKeys: () => [...guardado.keys()],
  getOwnPropertyDescriptor: (_, k) => (guardado.has(k) ? { enumerable: true, configurable: true, value: guardado.get(k) } : undefined),
});
globalThis.localStorage = espelho;

const { store, favoritas } = await import('../site/js/store.js');
const radares = await import('../site/js/radares.js');
const { salvos, rascunhos } = radares;

const jogador = (funcao, x = 0.5, y = 0.5) => ({ tipo: 'jogador', funcao, x, y });
const diagrama = (...itens) => ({ etapas: [{ titulo: '', nota: '', itens }] });

const DO_SITE = {
  versao: 1,
  imagens: { alfa: 'img/radar/alfa.webp' },
  radares: { 'alfa-01': diagrama(jogador('p1', 0.1, 0.1)), 'alfa-02': diagrama(jogador('p2')) },
};

function falsoFetch(corpo, { ok = true, status = 200 } = {}) {
  globalThis.fetch = async () => ({ ok, status, json: async () => corpo });
}

beforeEach(async () => {
  salvos.limpar();
  rascunhos.limpar();
  falsoFetch(DO_SITE);
  await radares.carregarRadares();
});

test('carregarRadares lê o do site e ignora o que não presta', async () => {
  falsoFetch({ imagens: { alfa: 'https://x.com/a.png', bravo: 'img/radar/bravo.png' }, radares: { 'alfa-01': { etapas: [] }, 'alfa-02': diagrama(jogador('p1')) } });
  await radares.carregarRadares();
  assert.equal(radares.imagemDoSite('alfa'), null); // endereço externo recusado
  assert.equal(radares.imagemDoSite('bravo'), 'img/radar/bravo.png');
  assert.equal(radares.doSite('alfa-01'), null); // vazio não conta
  assert.ok(radares.doSite('alfa-02'));
});

test('sem radares.json (404) ou com JSON quebrado o app segue sem radares', async () => {
  falsoFetch({}, { ok: false, status: 404 });
  await radares.carregarRadares();
  assert.equal(radares.radarDaTatica('alfa-01'), null);

  globalThis.fetch = async () => {
    throw new Error('sem rede');
  };
  await radares.carregarRadares();
  assert.equal(radares.radarDaTatica('alfa-02'), null);
});

test('radarDaTatica: o salvo no aparelho vence o do site, e salvo vazio esconde o do site', () => {
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'site');

  salvos.salvar('alfa-01', diagrama(jogador('p3', 0.9, 0.9)));
  const local = radares.radarDaTatica('alfa-01');
  assert.equal(local.origem, 'aparelho');
  assert.equal(local.diagrama.etapas[0].itens[0].funcao, 'p3');

  salvos.salvar('alfa-01', { etapas: [] }); // "apaguei este radar"
  assert.equal(radares.radarDaTatica('alfa-01'), null);
  assert.equal(radares.radarDaTatica('alfa-02').origem, 'site'); // as outras não mudam

  salvos.remover('alfa-01');
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'site'); // voltou à versão publicada
});

test('salvar guarda a forma limpa: sem ids do editor e sem etapas vazias', () => {
  salvos.salvar('alfa-03', {
    etapas: [
      { titulo: '', nota: '', itens: [{ id: 'i1', tipo: 'jogador', funcao: 'p1', x: 0.2, y: 0.3 }] },
      { titulo: '', nota: '', itens: [] },
    ],
  });
  const lido = salvos.obter('alfa-03');
  assert.equal(lido.etapas.length, 1);
  assert.equal(lido.etapas[0].itens[0].id, undefined);
});

test('pontoDePartida: rascunho > salvo > site > em branco', () => {
  assert.equal(radares.pontoDePartida('alfa-99').inicial.etapas.length, 0);
  assert.equal(radares.pontoDePartida('alfa-01').inicial.etapas[0].itens[0].x, 0.1);

  salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.4)));
  assert.equal(radares.pontoDePartida('alfa-01').inicial.etapas[0].itens[0].x, 0.4);

  rascunhos.guardar('alfa-01', diagrama(jogador('p1', 0.7, 0.7)));
  const p = radares.pontoDePartida('alfa-01');
  assert.equal(p.recuperado, true);
  assert.equal(p.inicial.etapas[0].itens[0].x, 0.7);
  assert.equal(p.base.etapas[0].itens[0].x, 0.4); // a base é o último salvo: serve para saber se há mudança

  rascunhos.descartar('alfa-01');
  assert.equal(radares.pontoDePartida('alfa-01').recuperado, false);
});

test('situacao resume o estado de cada tática para a lista do editor', () => {
  assert.deepEqual(radares.situacao('alfa-99'), { etapas: 0, origem: null, rascunho: false, noSite: false });
  assert.deepEqual(radares.situacao('alfa-01'), { etapas: 1, origem: 'site', rascunho: false, noSite: true });
  salvos.salvar('alfa-01', diagrama(jogador('p1', 0.8, 0.8)));
  rascunhos.guardar('alfa-01', diagrama(jogador('p1', 0.9, 0.9)));
  assert.deepEqual(radares.situacao('alfa-01'), { etapas: 1, origem: 'aparelho', rascunho: true, noSite: true });
});

test('exportarArquivo junta o site e o aparelho, sem diagramas vazios', async () => {
  salvos.salvar('alfa-01', diagrama(jogador('p3', 0.9, 0.9)));
  salvos.salvar('alfa-02', { etapas: [] }); // apagado
  salvos.salvar('alfa-05', diagrama(jogador('p4', 0.2, 0.2)));

  const arquivo = JSON.parse(await radares.exportarArquivo());
  assert.equal(arquivo.versao, 1);
  assert.deepEqual(arquivo.imagens, { alfa: 'img/radar/alfa.webp' });
  assert.deepEqual(Object.keys(arquivo.radares), ['alfa-01', 'alfa-05']);
  assert.equal(arquivo.radares['alfa-01'].etapas[0].itens[0].funcao, 'p3');
});

test('importarArquivo traz os radares como salvos neste aparelho e conta quantos entraram', () => {
  const n = radares.importarArquivo({ radares: { 'alfa-07': diagrama(jogador('p1')), 'alfa-08': { etapas: [] }, 'ID ruim': diagrama(jogador('p1')) } });
  assert.equal(n, 1);
  assert.equal(radares.radarDaTatica('alfa-07').origem, 'aparelho');
  assert.equal(radares.importarArquivo('lixo'), 0);
});

test('contagem separa o que já está publicado do que só existe neste aparelho', () => {
  assert.deepEqual(radares.contagem(), { total: 2, soNoAparelho: 0 });
  salvos.salvar('alfa-01', diagrama(jogador('p1', 0.1, 0.1))); // igual ao do site: continua "publicado"
  assert.deepEqual(radares.contagem(), { total: 2, soNoAparelho: 0 });
  salvos.salvar('alfa-01', diagrama(jogador('p1', 0.3, 0.3))); // mudou
  salvos.salvar('alfa-09', diagrama(jogador('p2')));
  assert.deepEqual(radares.contagem(), { total: 3, soNoAparelho: 2 });
});

test('"Apagar dados" limpa favoritas e preferências, mas não os radares nem os rascunhos', () => {
  favoritas.alternar('alfa-01');
  store.set('tema', 'claro');
  salvos.salvar('alfa-01', diagrama(jogador('p1')));
  rascunhos.guardar('alfa-02', diagrama(jogador('p2')));

  store.limpar();

  assert.equal(favoritas.tem('alfa-01'), false);
  assert.equal(store.get('tema'), null);
  assert.ok(salvos.tem('alfa-01'));
  assert.ok(rascunhos.tem('alfa-02'));
  assert.ok(guardado.has('pb.radares'), 'continua gravado no localStorage');
});

test('valor corrompido no armazenamento não derruba o app', () => {
  guardado.set('pb.radares', '{isto não é json');
  assert.equal(salvos.tem('alfa-01'), false);
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'site');
});

test('depois de publicar, a cópia local idêntica à do site sai: não vira "só neste aparelho" nem tapa atualizações futuras', async () => {
  // o autor salvou e publicou: o site agora tem exatamente o que está salvo aqui
  salvos.salvar('alfa-01', DO_SITE.radares['alfa-01']);
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'site', 'idêntico ao do site já é "publicado"');
  assert.ok(salvos.tem('alfa-01'));

  await radares.carregarRadares(); // próxima abertura do app
  assert.equal(salvos.tem('alfa-01'), false, 'a cópia redundante foi descartada');

  // alguém muda o radar no site: quem tinha a cópia antiga passa a ver a versão nova
  falsoFetch({ ...DO_SITE, radares: { ...DO_SITE.radares, 'alfa-01': diagrama(jogador('p1', 0.9, 0.9)) } });
  await radares.carregarRadares();
  assert.equal(radares.radarDaTatica('alfa-01').diagrama.etapas[0].itens[0].x, 0.9);
});

test('cópia local diferente da publicada é mantida; vazia sobre o nada é descartada', async () => {
  salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.4))); // editado: difere do site
  salvos.salvar('alfa-77', { etapas: [] }); // "apagado" de algo que nem existe
  salvos.salvar('alfa-02', { etapas: [] }); // apagado de algo que existe no site: precisa continuar escondendo
  await radares.carregarRadares();
  assert.ok(salvos.tem('alfa-01'));
  assert.equal(radares.radarDaTatica('alfa-01').origem, 'aparelho');
  assert.equal(salvos.tem('alfa-77'), false);
  assert.ok(salvos.tem('alfa-02'));
  assert.equal(radares.radarDaTatica('alfa-02'), null);
});

test('sem conseguir ler o radares.json, nada salvo neste aparelho é apagado', async () => {
  salvos.salvar('alfa-01', diagrama(jogador('p1', 0.4, 0.4)));
  salvos.salvar('alfa-02', DO_SITE.radares['alfa-02']);
  globalThis.fetch = async () => {
    throw new Error('sem rede');
  };
  await radares.carregarRadares();
  assert.ok(salvos.tem('alfa-01') && salvos.tem('alfa-02'));
});
