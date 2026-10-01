// Roteador por hash (#/mapa/mirage). Funciona em qualquer hospedagem estática
// e cada tela tem link próprio, que dá para mandar no Discord/WhatsApp.
//
// history.state guarda a "profundidade" da navegação dentro do app. Com ela o
// botão Voltar sabe se pode usar o histórico ou se deve ir para uma tela-pai
// (caso o app tenha sido aberto direto num link de tática).

let profundidade = 0;
let aoMudar = () => {};

export function atual() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [caminho, qs = ''] = hash.split('?');
  const segmentos = caminho
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return { segmentos, query: new URLSearchParams(qs), bruto: hash, chave: `${profundidade}:${hash}` };
}

/** rotas: [[padrão, view], ...]; segmentos ":x" viram params.x */
export function casar(rotas, segmentos) {
  for (const [padrao, view] of rotas) {
    if (padrao.length !== segmentos.length) continue;
    const params = {};
    const ok = padrao.every((p, i) => {
      if (!p.startsWith(':')) return p === segmentos[i];
      params[p.slice(1)] = segmentos[i];
      return true;
    });
    if (ok) return { view, params };
  }
  return null;
}

function sincronizar() {
  const st = history.state;
  if (st && typeof st.n === 'number') {
    profundidade = st.n;
  } else {
    profundidade += 1;
    history.replaceState({ n: profundidade }, '');
  }
  aoMudar();
}

/** Navega. replace:true troca a entrada atual em vez de empilhar (abas, filtros). */
export function ir(caminho, { replace = false } = {}) {
  const hash = `#${caminho}`;
  if (replace) {
    history.replaceState({ n: Math.max(profundidade, 1) }, '', hash);
    sincronizar();
  } else if (location.hash !== hash) {
    location.hash = caminho;
  }
}

export const podeVoltar = () => profundidade > 1;

export function voltar(alternativa = '/') {
  if (podeVoltar()) history.back();
  else ir(alternativa, { replace: true });
}

/** Troca só a query da rota atual sem disparar render nem empilhar histórico */
export function trocarUrlSemRender(hash) {
  history.replaceState(history.state, '', hash);
}

export function iniciar(callback) {
  aoMudar = callback;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', sincronizar);
  sincronizar();
}
