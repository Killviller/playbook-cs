// Utilidades de texto sem DOM (testáveis no Node).

/** minúsculas e sem acentos, para busca tolerante */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** "2026-10-01" → "01/10/2026" (texto que não é data volta como veio) */
export function dataBr(iso) {
  const [a, m, d] = String(iso ?? '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : (iso ?? '');
}
