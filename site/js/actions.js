// Ações disparadas por toque: elementos com data-action="nome".
// Um único listener de clique no documento (delegação) atende o app inteiro.
import { favoritas, store } from './store.js';
import { acionarAviso, aviso } from './shell.js';
import { aplicarPreferencias } from './prefs.js';
import { pwa, telaAcesa, verificarAtualizacao } from './pwa.js';
import * as roteador from './router.js';

let ctx = { renderizar: () => {}, indice: () => null };

async function abrirCompartilhar({ titulo, texto, url }) {
  try {
    if (navigator.share) {
      await navigator.share({ title: titulo, text: texto, url });
      return;
    }
  } catch (erro) {
    if (erro?.name === 'AbortError') return; // a pessoa fechou a folha de compartilhar
  }
  try {
    await navigator.clipboard.writeText(url);
    aviso('Link copiado');
  } catch {
    aviso('Copie o link na barra de endereço do navegador');
  }
}

const rerender = () => ctx.renderizar({ manterRolagem: true });

const acoes = {
  voltar: (el) => roteador.voltar(el.dataset.alternativa || '/'),

  fav(el) {
    const id = el.dataset.id;
    const agora = favoritas.alternar(id);
    document.querySelectorAll('[data-action="fav"]').forEach((b) => {
      if (b.dataset.id !== id) return;
      b.setAttribute('aria-pressed', String(agora));
      b.classList.toggle('is-on', agora);
    });
    aviso(agora ? 'Adicionada às favoritas' : 'Removida das favoritas');
  },

  compartilhar(el) {
    const indice = ctx.indice();
    const t = indice.taticasById.get(el.dataset.id);
    const mapa = indice.mapasById.get(t.mapa);
    return abrirCompartilhar({
      titulo: `${mapa.nome} · ${t.titulo}`,
      texto: `${mapa.nome} #${t.numero}: ${t.titulo}`,
      url: location.href,
    });
  },

  'compartilhar-app': () =>
    abrirCompartilhar({
      titulo: 'Playbook T — CS2',
      texto: 'Playbook de táticas do time',
      url: location.href.split('#')[0],
    }),

  filtro(el) {
    const q = el.dataset.tipo ? `?tipo=${encodeURIComponent(el.dataset.tipo)}` : '';
    roteador.ir(`/mapa/${el.dataset.mapa}${q}`, { replace: true });
  },

  'set-mapa'(el) {
    store.set('mapa', el.dataset.id);
    rerender();
  },

  tema(el) {
    store.set('tema', el.dataset.valor);
    aplicarPreferencias();
    rerender();
  },

  texto(el) {
    store.set('texto', el.dataset.valor);
    aplicarPreferencias();
    rerender();
  },

  async tela(el) {
    if (el.checked) {
      if (!(await telaAcesa.ligar())) {
        el.checked = false;
        aviso('Este aparelho não permitiu manter a tela acesa');
      }
    } else {
      await telaAcesa.desligar();
    }
  },

  async instalar() {
    if (await pwa.instalar()) aviso('App instalado');
    rerender();
  },

  'fechar-dica'() {
    store.set('dica-instalar-fechada', true);
    rerender();
  },

  async verificar() {
    aviso('Verificando…');
    const resultado = await verificarAtualizacao();
    if (resultado === 'nova') aviso('Atualização encontrada, aplicando…');
    else if (resultado === 'atual') aviso('Você já está na versão mais recente');
    else aviso('Não foi possível verificar agora');
  },

  limpar() {
    if (!confirm('Apagar as favoritas e as preferências deste aparelho?')) return;
    store.limpar();
    telaAcesa.desligar();
    aplicarPreferencias();
    aviso('Dados deste aparelho apagados');
    rerender();
  },

  funcao(el) {
    // data-alternar: tocar de novo na função já escolhida desmarca
    const atual = store.get('funcao', null);
    const novo = el.dataset.valor || null;
    store.set('funcao', el.dataset.alternar && novo === atual ? null : novo);
    rerender();
  },

  fase(el) {
    const mm = el.closest('.mm');
    mm.dataset.fase = el.dataset.fase;
    mm.querySelectorAll('[data-action="fase"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  },

  blip(el) {
    const mm = el.closest('.mm');
    mm.dataset.sel = el.dataset.id;
    mm.querySelectorAll('[data-action="blip"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === el.dataset.id)));
  },

  sugestao(el) {
    const campo = document.getElementById('q');
    if (!campo) return;
    campo.value = el.dataset.q;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
  },

  atualizar: () => location.reload(),
  'toast-acao': () => acionarAviso(),
};

export function iniciarAcoes(contexto) {
  ctx = contexto;
  document.addEventListener('click', (ev) => {
    const alvo = ev.target instanceof Element ? ev.target : null;
    if (!alvo) return;

    const el = alvo.closest('[data-action]');
    if (el) {
      const fn = acoes[el.dataset.action];
      if (!fn) return;
      if (el.tagName !== 'INPUT') ev.preventDefault(); // checkbox precisa mudar de estado
      fn(el, ev);
      return;
    }

    // Links de aba/filtro/mapa trocam a entrada do histórico em vez de empilhar.
    const link = alvo.closest('a[data-replace]');
    const href = link?.getAttribute('href');
    if (href?.startsWith('#') && ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
      ev.preventDefault();
      roteador.ir(href.slice(1), { replace: true });
    }
  });
}
