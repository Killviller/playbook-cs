import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construir } from '../scripts/build.mjs';

test('o build carimba o service worker e lista os arquivos do cache offline', async () => {
  const destino = await mkdtemp(join(tmpdir(), 'playbook-dist-'));
  try {
    const { id, precache } = await construir({ destino });
    const sw = await readFile(join(destino, 'sw.js'), 'utf8');

    assert.match(id, /^[0-9a-f]{10}$/);
    assert.ok(sw.includes(`const BUILD_ID = '${id}';`));
    assert.ok(!sw.includes('__BUILD_ID__') && !sw.includes('__PRECACHE__'));

    for (const essencial of ['./', './index.html', './data/playbook.json', './js/main.js', './css/app.css', './manifest.webmanifest', './build.json', './icons/icon-192.png']) {
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
