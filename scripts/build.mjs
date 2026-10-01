// Gera a pasta dist/ pronta para publicar:
//  1. valida os dados;  2. copia site/;  3. carimba o service worker com um hash do
//  conteúdo e a lista de arquivos para uso offline;  4. escreve build.json.
// Uso: npm run build
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatarRelatorio, validarPlaybook, validarRadaresDoSite } from './lib/validar.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function listar(dir, base = dir) {
  const achados = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) achados.push(...(await listar(caminho, base)));
    else achados.push(caminho.slice(base.length + 1).split('\\').join('/'));
  }
  return achados.sort();
}

function commitAtual() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function trocar(texto, antigo, novo) {
  if (!texto.includes(antigo)) throw new Error(`Marcador não encontrado no sw.js: ${antigo}`);
  return texto.replace(antigo, () => novo);
}

export async function construir({ origem = join(raiz, 'site'), destino = join(raiz, 'dist') } = {}) {
  const dados = JSON.parse(await readFile(join(origem, 'data/playbook.json'), 'utf8'));
  const relatorio = await validarPlaybook(dados, { siteDir: origem });
  const radares = await validarRadaresDoSite(dados, { siteDir: origem });
  relatorio.erros.push(...radares.erros);
  relatorio.avisos.push(...radares.avisos);
  if (relatorio.erros.length) throw new Error(`Dados inválidos:\n${formatarRelatorio(relatorio)}`);

  await rm(destino, { recursive: true, force: true });
  await cp(origem, destino, { recursive: true });

  // o hash cobre todos os arquivos (inclusive o sw.js ainda sem carimbo): mudou algo, muda o cache
  const arquivos = await listar(destino);
  const hash = createHash('sha256');
  for (const arq of arquivos) {
    hash.update(arq);
    hash.update(await readFile(join(destino, arq)));
  }
  const id = hash.digest('hex').slice(0, 10);

  const info = { id, commit: commitAtual(), geradoEm: new Date().toISOString() };
  await writeFile(join(destino, 'build.json'), `${JSON.stringify(info, null, 2)}\n`);

  const precache = ['./', ...(await listar(destino)).filter((a) => a !== 'sw.js' && a !== 'robots.txt').map((a) => `./${a}`)];
  let sw = await readFile(join(destino, 'sw.js'), 'utf8');
  sw = trocar(sw, "const BUILD_ID = '__BUILD_ID__';", `const BUILD_ID = '${id}';`);
  sw = trocar(sw, '/*__PRECACHE__*/ []', JSON.stringify(precache));
  await writeFile(join(destino, 'sw.js'), sw);

  return { destino, id, precache, avisos: relatorio.avisos };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = await construir();
    console.log(`dist/ pronto · versão ${r.id} · ${r.precache.length} itens no cache offline`);
    for (const a of r.avisos) console.log(`  ! ${a}`);
  } catch (erro) {
    console.error(erro.message);
    process.exit(1);
  }
}
