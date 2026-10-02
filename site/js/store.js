// Preferências e favoritas ficam só neste aparelho (localStorage).
// Se o navegador bloquear o armazenamento (aba anônima, por exemplo), o app
// continua funcionando com uma cópia em memória até a página ser fechada.

const PREFIXO = 'pb.';
// trabalho feito à mão (radares e textos editados, com seus rascunhos) tem botão próprio no editor
const PROTEGIDAS = [`${PREFIXO}radar`, `${PREFIXO}edic`];
const protegida = (k) => PROTEGIDAS.some((p) => k.startsWith(p));
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

  remover(chave) {
    const k = PREFIXO + chave;
    memoria.delete(k);
    try {
      localStorage.removeItem(k);
    } catch {
      /* nada a fazer */
    }
  },

  /** Apaga favoritas e preferências. Radares e textos editados (chaves "pb.radar*" e "pb.edic*") ficam: são trabalho feito à mão.
   * A conexão com o GitHub (token) também sai: é uma credencial, não deve sobrar num aparelho "limpo". */
  limpar() {
    for (const k of [...memoria.keys()]) if (!protegida(k)) memoria.delete(k);
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIXO) && !protegida(k))
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
