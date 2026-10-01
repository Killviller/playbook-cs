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

    for (const essencial of ['./', './index.html', './data/playbook.json', './data/radares.json', './js/main.js', './js/views/editor-tatica.js', './css/app.css', './manifest.webmanifest', './build.json', './icons/icon-192.png']) {
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
    versao: 1, imagens: {}, radares: { [id]: { etapas: [{ itens: [{ tipo: 'jogador', funcao: 'p1', x: 3, y: 0.5 }] }] } },
  });
  try {
    await assert.rejects(rodar(), /radares\.json.*"x" precisa ser um número de 0 a 1/s);
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
  const { raiz, construir: rodar } = await construirComRadares({
    versao: 1,
    imagens: { [mapa]: `img/radar/${mapa}.webp` },
    radares: { [id]: { etapas: [{ titulo: 'Posições', itens: [{ tipo: 'jogador', funcao: 'p1', x: 0.3, y: 0.4 }] }] } },
  });
  try {
    const r = await rodar();
    assert.ok(r.precache.includes('./data/radares.json'));
    assert.ok(r.avisos.some((a) => a.includes(`img/radar/${mapa}.webp`) && a.includes('ainda não está')), JSON.stringify(r.avisos));
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
