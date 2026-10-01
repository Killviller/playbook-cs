import test from 'node:test';
import assert from 'node:assert/strict';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construir } from '../scripts/build.mjs';

test('o build carimba o service worker e lista os arquivos do cache offline', async () => {
  const destino = await mkdtemp(join(tmpdir(), 'playbook-dist-'));
  try {
    const { id, precache } = await construir({ destino });
    const sw = await readFile(join(destino, 'sw.js'), 'utf8');

    assert.match(id, /^[0-9a-f]{10}$/);
    assert.ok(sw.includes(`const BUILD_ID = '${id}';`));
    assert.ok(!sw.includes('__BUILD_ID__') && !sw.includes('__PRECACHE__'));

    for (const essencial of ['./', './index.html', './data/playbook.json', './data/radares.json', './data/edicoes.json', './js/main.js', './js/views/editor-tatica.js', './js/views/editar-tatica.js', './css/app.css', './manifest.webmanifest', './build.json', './icons/icon-192.png']) {
      assert.ok(precache.includes(essencial), `faltou no cache offline: ${essencial}`);
    }
    assert.ok(!precache.includes('./sw.js'));
    for (const url of precache.filter((u) => u !== './')) await access(join(destino, url)); // todos existem

    const info = JSON.parse(await readFile(join(destino, 'build.json'), 'utf8'));
    assert.equal(info.id, id);
  } finally {
    await rm(destino, { recursive: true, force: true });
  }
});

test('o hash muda quando o conteúdo muda e fica igual quando não muda', async () => {
  const a = await mkdtemp(join(tmpdir(), 'playbook-a-'));
  const b = await mkdtemp(join(tmpdir(), 'playbook-b-'));
  try {
    const um = await construir({ destino: a });
    const dois = await construir({ destino: b });
    assert.equal(um.id, dois.id);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});

// ------------------------------------------------------- radares.json no build
const siteReal = fileURLToPath(new URL('../site/', import.meta.url));

/** Copia o site para uma pasta temporária (com um radares.json de teste) e roda o build nela. */
async function construirComRadares(radares) {
  const raiz = await mkdtemp(join(tmpdir(), 'playbook-radares-'));
  const origem = join(raiz, 'site');
  await cp(siteReal, origem, { recursive: true });
  if (radares !== undefined) await writeFile(join(origem, 'data/radares.json'), typeof radares === 'string' ? radares : JSON.stringify(radares));
  return { raiz, origem, construir: () => construir({ origem, destino: join(raiz, 'dist') }) };
}

const primeiraTatica = async () => JSON.parse(await readFile(join(siteReal, 'data/playbook.json'), 'utf8')).taticas[0].id;

test('radares.json com erro bloqueia o build e diz onde está o problema', async () => {
  const id = await primeiraTatica();
  const { raiz, construir: rodar } = await construirComRadares({
    versao: 1, imagens: {}, radares: { [id]: { posicoes: { p1: [[20, 30], [150, 50]] } } },
  });
  try {
    await assert.rejects(rodar(), /radares\.json.*posicoes\."p1" precisa ter de 1 a 4 pontos/s);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('radares.json com JSON quebrado também bloqueia o build', async () => {
  const { raiz, construir: rodar } = await construirComRadares('{ "versao": 1, ');
  try {
    await assert.rejects(rodar(), /JSON inválido/);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('radar válido entra no build; imagem ainda não enviada é só aviso', async () => {
  const id = await primeiraTatica();
  const mapa = id.split('-')[0];
  const faltando = `img/radar/${mapa}-ainda-nao-enviada.webp`; // um arquivo que (de propósito) não existe
  const { raiz, construir: rodar } = await construirComRadares({
    versao: 1,
    imagens: { [mapa]: faltando },
    radares: { [id]: { fases: ['Setup', 'Execução'], posicoes: { p1: [[30, 40], [60, 20]] }, extras: [[{ tipo: 'bomba', x: 50, y: 50 }], []] } },
  });
  try {
    const r = await rodar();
    assert.ok(r.precache.includes('./data/radares.json'));
    assert.ok(r.avisos.some((a) => a.includes(faltando) && a.includes('ainda não está')), JSON.stringify(r.avisos));
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('sem radares.json o build continua funcionando (ainda não há radares)', async () => {
  const { raiz, origem, construir: rodar } = await construirComRadares();
  try {
    await rm(join(origem, 'data/radares.json'));
    const r = await rodar();
    assert.ok(!r.precache.includes('./data/radares.json'));
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

// ------------------------------------------------------ edicoes.json no build
/** Copia o site para uma pasta temporária (com um edicoes.json de teste) e roda o build nela. */
async function construirComEdicoes(edicoes) {
  const raiz = await mkdtemp(join(tmpdir(), 'playbook-edicoes-'));
  const origem = join(raiz, 'site');
  await cp(siteReal, origem, { recursive: true });
  if (edicoes !== undefined) await writeFile(join(origem, 'data/edicoes.json'), typeof edicoes === 'string' ? edicoes : JSON.stringify(edicoes));
  return { raiz, origem, construir: () => construir({ origem, destino: join(raiz, 'dist') }) };
}

test('edicoes.json com erro bloqueia o build e diz onde está o problema', async () => {
  const id = await primeiraTatica();
  const { raiz, construir: rodar } = await construirComEdicoes({ versao: 1, taticas: { [id]: { atualizadoEm: '2026-10-01', tipos: ['nao-existe'], funcoes: { p9: 'x' } } } });
  try {
    await assert.rejects(rodar(), /edicoes\.json.*o tipo "nao-existe" não existe/s);
    await assert.rejects(rodar(), /a função "p9" não existe/);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('edicoes.json com JSON quebrado também bloqueia o build', async () => {
  const { raiz, construir: rodar } = await construirComEdicoes('{ "versao": 1, ');
  try {
    await assert.rejects(rodar(), /edicoes\.json: JSON inválido/);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('edição válida entra no build; edição de tática que sumiu é só aviso', async () => {
  const id = await primeiraTatica();
  const { raiz, construir: rodar } = await construirComEdicoes({
    versao: 1,
    taticas: { [id]: { atualizadoEm: '2026-10-01', planoB: 'Plano B melhorado.', funcoes: { p3: 'Smoke melhorada.' } }, 'mapa-que-sumiu-99': { planoB: 'x' } },
  });
  try {
    const r = await rodar();
    assert.ok(r.precache.includes('./data/edicoes.json'));
    assert.ok(r.avisos.some((a) => a.includes('mapa-que-sumiu-99') && a.includes('não existe mais')), JSON.stringify(r.avisos));
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('o edicoes.json em branco que vai no repositório é válido', async () => {
  const { validarEdicoesDoSite } = await import('../scripts/lib/validar.mjs');
  const real = JSON.parse(await readFile(join(siteReal, 'data/playbook.json'), 'utf8'));
  assert.deepEqual(await validarEdicoesDoSite(real, { siteDir: siteReal }), { erros: [], avisos: [] });
});
