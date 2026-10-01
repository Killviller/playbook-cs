// Utilidades de texto sem DOM (testáveis no Node).

/** minúsculas e sem acentos, para busca tolerante */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export const pad2 = (n) => String(n).padStart(2, '0');
