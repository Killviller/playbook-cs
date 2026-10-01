// Imagens dos radares escolhidas neste aparelho (IndexedDB, que guarda arquivos grandes melhor que o localStorage).
// Sem IndexedDB (aba anônima, por exemplo) o app continua funcionando com uma cópia em memória até fechar a página.

const BANCO = 'playbook-radar';
const LOJA = 'imagens';
const LADO_MAXIMO = 1024;
const FUNDO = '#11161d'; // mesma cor do fundo do radar: a "moldura" some ao encaixar uma imagem que não é quadrada

const memoria = new Map();
let bancoPronto = null;

function abrir() {
  bancoPronto ??= new Promise((ok) => {
    try {
      const pedido = indexedDB.open(BANCO, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => ok(null);
      pedido.onblocked = () => ok(null);
    } catch {
      ok(null);
    }
  });
  return bancoPronto;
}

async function transacao(modo, usar) {
  const banco = await abrir();
  if (!banco) return undefined;
  return new Promise((ok) => {
    try {
      const tx = banco.transaction(LOJA, modo);
      const resultado = usar(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(resultado?.result);
      tx.onerror = tx.onabort = () => ok(undefined);
    } catch {
      ok(undefined);
    }
  });
}

/** { blob, tipo } da imagem escolhida para o mapa, ou null. */
export async function lerImagem(mapaId) {
  if (memoria.has(mapaId)) return memoria.get(mapaId);
  const guardada = await transacao('readonly', (loja) => loja.get(mapaId));
  return guardada?.blob ? { blob: guardada.blob, tipo: guardada.blob.type } : null;
}

export async function salvarImagem(mapaId, blob) {
  memoria.set(mapaId, { blob, tipo: blob.type });
  await transacao('readwrite', (loja) => loja.put({ blob, salvoEm: Date.now() }, mapaId));
  liberar(mapaId);
}

export async function removerImagem(mapaId) {
  memoria.delete(mapaId);
  await transacao('readwrite', (loja) => loja.delete(mapaId));
  liberar(mapaId);
}

/** Ids dos mapas que têm imagem neste aparelho. */
export async function mapasComImagemLocal() {
  const chaves = (await transacao('readonly', (loja) => loja.getAllKeys())) ?? [];
  return new Set([...chaves, ...memoria.keys()]);
}

// ------------------------------------------------------ endereço para exibir
const urls = new Map();

function liberar(mapaId) {
  const url = urls.get(mapaId);
  if (url) URL.revokeObjectURL(url);
  urls.delete(mapaId);
}

/** Endereço "blob:" da imagem local (reaproveitado enquanto a imagem não muda). */
export async function urlDaImagemLocal(mapaId) {
  if (urls.has(mapaId)) return urls.get(mapaId);
  const img = await lerImagem(mapaId);
  if (!img) return null;
  const url = URL.createObjectURL(img.blob);
  urls.set(mapaId, url);
  return url;
}

// --------------------------------------------------------------- preparo
export const extensao = (tipo) => (tipo === 'image/png' ? 'png' : tipo === 'image/jpeg' ? 'jpg' : 'webp');
export const nomeDoArquivo = (mapaId, tipo) => `${mapaId}.${extensao(tipo)}`;

async function decodificar(arquivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      /* cai no <img> */
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Deixa a imagem pronta para o radar: quadrada (a imagem fica inteira e centralizada), no máximo 1024 px, em WebP
 * (ou PNG, se o navegador não fizer WebP). Coordenadas do radar são sempre relativas a este quadrado.
 */
export async function prepararImagem(arquivo) {
  const img = await decodificar(arquivo);
  const largura = img.width ?? img.naturalWidth;
  const altura = img.height ?? img.naturalHeight;
  if (!largura || !altura) throw new Error('Não consegui ler essa imagem.');

  const lado = Math.min(LADO_MAXIMO, Math.max(largura, altura));
  const escala = lado / Math.max(largura, altura);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = lado;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, lado, lado);
  ctx.imageSmoothingQuality = 'high';
  const w = largura * escala;
  const h = altura * escala;
  ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
  img.close?.();

  const gerar = (tipo, qualidade) => new Promise((ok) => canvas.toBlob(ok, tipo, qualidade));
  const webp = await gerar('image/webp', 0.88);
  if (webp?.type === 'image/webp') return webp;

  // Safari não grava WebP e devolve PNG, que num radar passa fácil de 500 KB: se o JPEG ficar bem menor, usa o JPEG
  const png = webp ?? (await gerar('image/png'));
  const jpeg = await gerar('image/jpeg', 0.88);
  if (jpeg?.type === 'image/jpeg' && (!png || jpeg.size < png.size * 0.6)) return jpeg;
  if (!png) throw new Error('Não consegui preparar essa imagem.');
  return png;
}

// ------------------------------------------------------------- baixar / copiar
export function baixar(nome, conteudo, tipo = 'application/octet-stream') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
