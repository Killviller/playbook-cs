// Servidor estático mínimo para testar o app localmente (sem dependências).
//   npm run dev        -> site/ em http://localhost:5173/
//   npm run preview    -> dist/ em http://localhost:4173/playbook-cs/ (mesmo caminho do GitHub Pages)
// Uso: node scripts/servir.mjs <pasta> [porta] [prefixo]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function iniciarServidor({ pasta, porta = 0, prefixo = '' }) {
  const raiz = resolve(pasta);
  const base = prefixo.replace(/\/$/, '');

  const servidor = createServer(async (req, res) => {
    try {
      let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (base) {
        if (caminho === base) {
          res.writeHead(301, { Location: `${base}/` }).end();
          return;
        }
        if (!caminho.startsWith(`${base}/`)) throw Object.assign(new Error('fora do prefixo'), { codigo: 404 });
        caminho = caminho.slice(base.length);
      }
      if (caminho.endsWith('/')) caminho += 'index.html';

      const arquivo = resolve(join(raiz, caminho));
      if (arquivo !== raiz && !arquivo.startsWith(raiz + sep)) throw Object.assign(new Error('proibido'), { codigo: 403 });
      if (!(await stat(arquivo)).isFile()) throw Object.assign(new Error('não é arquivo'), { codigo: 404 });

      res.writeHead(200, {
        'Content-Type': MIME[extname(arquivo)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(await readFile(arquivo));
    } catch (erro) {
      res.writeHead(erro.codigo ?? 404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
    }
  });

  return new Promise((ok) => servidor.listen(porta, '127.0.0.1', () => ok(servidor)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raizProjeto = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [, , pasta = 'site', porta = '5173', prefixo = ''] = process.argv;
  const servidor = await iniciarServidor({ pasta: resolve(raizProjeto, pasta), porta: Number(porta), prefixo });
  console.log(`Servindo ${pasta}/ em http://localhost:${servidor.address().port}${prefixo ? `${prefixo.replace(/\/$/, '')}/` : '/'}`);
}
