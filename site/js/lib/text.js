// Utilidades de texto sem DOM (testáveis no Node).

/** minúsculas e sem acentos, para busca tolerante */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

const COUNT_RE = /^(\d+(?:\s?[–-]\s?\d+)?)\s+(\S.*)$/;

/**
 * Separa a contagem de jogadores no começo da linha, para destacá-la na tela:
 * "3–4 jogadores Long." -> { count: "3–4", rest: "jogadores Long." }
 */
export function separarContagem(line) {
  const m = COUNT_RE.exec(line);
  return m ? { count: m[1].replace(/\s/g, ''), rest: m[2] } : { count: null, rest: line };
}

export const ehObjetivo = (line) => /\bobjetivo\b/i.test(line);

export const pad2 = (n) => String(n).padStart(2, '0');
