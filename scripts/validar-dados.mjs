// Confere o playbook.json e os arquivos que estão ao lado dele (radares.json e edicoes.json).
// Uso: npm run validar  [caminho/do/playbook.json]
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatarRelatorio, validarEdicoesDoSite, validarPlaybook, validarRadaresDoSite } from './lib/validar.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const caminho = resolve(process.argv[2] ?? `${raiz}/site/data/playbook.json`);

let dados;
try {
  dados = JSON.parse(await readFile(caminho, 'utf8'));
} catch (erro) {
  console.error(`Não consegui ler ${caminho}: ${erro.message}`);
  console.error('Dica: confira vírgulas e aspas no JSON (uma vírgula sobrando no fim da lista quebra tudo).');
  process.exit(1);
}

const siteDir = resolve(dirname(caminho), '..');
const relatorio = await validarPlaybook(dados, { siteDir });
// site/data/radares.json e site/data/edicoes.json, se existirem
for (const extra of [await validarRadaresDoSite(dados, { siteDir }), await validarEdicoesDoSite(dados, { siteDir })]) {
  relatorio.erros.push(...extra.erros);
  relatorio.avisos.push(...extra.avisos);
}
console.log(formatarRelatorio(relatorio));
process.exit(relatorio.erros.length ? 1 : 0);
