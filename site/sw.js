// Service worker do Playbook T: deixa o app abrir na hora e funcionar sem internet.
//
// O build (scripts/build.mjs) troca BUILD_ID por um hash do conteúdo e PRECACHE pela
// lista de arquivos. Cada deploy gera um cache novo; o antigo é apagado na ativação.
// Sem o build (desenvolvimento) os marcadores ficam intactos e o worker não faz cache.

const BUILD_ID = '__BUILD_ID__';
const PRECACHE = /*__PRECACHE__*/ [];

const DEV = BUILD_ID.startsWith('__');
const CACHE = `playbook-${BUILD_ID}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!DEV) {
        const cache = await caches.open(CACHE);
        // cache:'reload' ignora o cache HTTP do host, para nunca guardar arquivo velho
        await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const chave of await caches.keys()) {
        if (chave.startsWith('playbook-') && chave !== CACHE) await caches.delete(chave);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (DEV || request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(responder(request));
});

async function responder(request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request, { ignoreSearch: true });
  if (guardada) return guardada;

  try {
    const resposta = await fetch(request);
    if (resposta.ok && resposta.type === 'basic') cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    // sem rede e sem cache: navegação cai no app (ele resolve a rota pelo hash)
    if (request.mode === 'navigate') {
      const app = await cache.match('./');
      if (app) return app;
    }
    throw erro;
  }
}
