// Preferências e favoritas ficam só neste aparelho (localStorage).
// Se o navegador bloquear o armazenamento (aba anônima, por exemplo), o app
// continua funcionando com uma cópia em memória até a página ser fechada.

const PREFIXO = 'pb.';
const memoria = new Map();

export const store = {
  get(chave, padrao = null) {
    const k = PREFIXO + chave;
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return JSON.parse(v);
    } catch {
      /* armazenamento indisponível ou valor corrompido: usa a memória */
    }
    return memoria.has(k) ? memoria.get(k) : padrao;
  },

  set(chave, valor) {
    const k = PREFIXO + chave;
    memoria.set(k, valor);
    try {
      localStorage.setItem(k, JSON.stringify(valor));
    } catch {
      /* só em memória */
    }
  },

  limpar() {
    memoria.clear();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIXO))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* nada a fazer */
    }
  },
};

export const favoritas = {
  ids: () => new Set(store.get('favoritas', [])),
  tem: (id) => favoritas.ids().has(id),
  /** @returns {boolean} novo estado (true = favorita) */
  alternar(id) {
    const ids = favoritas.ids();
    const agora = !ids.has(id);
    if (agora) ids.add(id);
    else ids.delete(id);
    store.set('favoritas', [...ids]);
    return agora;
  },
};
