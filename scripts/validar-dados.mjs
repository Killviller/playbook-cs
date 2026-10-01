// Uso: npm run validar  [caminho/do/playbook.json]
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatarRelatorio, validarPlaybook } from './lib/validar.mjs';

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

const relatorio = await validarPlaybook(dados, { siteDir: resolve(dirname(caminho), '..') });
console.log(formatarRelatorio(relatorio));
process.exit(relatorio.erros.length ? 1 : 0);
