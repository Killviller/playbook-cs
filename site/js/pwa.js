// Instalação, offline, atualização e "manter a tela acesa".
import { store } from './store.js';

export const eventos = new EventTarget();
export const info = { build: null, offlinePronto: false };

let promptInstalacao = null;
let registro = null;
let sentinela = null;

// ---------------------------------------------------------------- instalação
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  promptInstalacao = ev;
  eventos.dispatchEvent(new Event('instalavel'));
});

window.addEventListener('appinstalled', () => {
  promptInstalacao = null;
  eventos.dispatchEvent(new Event('instalado'));
});

export const pwa = {
  instalado: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  ios: () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  podeInstalar: () => promptInstalacao !== null,

  async instalar() {
    if (!promptInstalacao) return false;
    promptInstalacao.prompt();
    const { outcome } = await promptInstalacao.userChoice;
    promptInstalacao = null;
    return outcome === 'accepted';
  },
};

// ------------------------------------------------------- service worker/offline
export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const tinhaControlador = Boolean(navigator.serviceWorker.controller);
    registro = await navigator.serviceWorker.register('./sw.js');

    // Só avisa de atualização se já havia uma versão controlando a página;
    // na primeira visita o controllerchange é apenas a instalação inicial.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (tinhaControlador) eventos.dispatchEvent(new Event('atualizacao-pronta'));
    });

    navigator.serviceWorker.ready.then(() => {
      info.offlinePronto = true;
      eventos.dispatchEvent(new Event('offline-pronto'));
    });

    // App instalado fica dias em segundo plano: confere atualização ao voltar.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update().catch(() => {});
    });
  } catch (erro) {
    console.warn('Service worker indisponível:', erro);
  }
}

/** @returns {Promise<'nova'|'atual'|'indisponivel'>} */
export async function verificarAtualizacao() {
  if (!registro) return 'indisponivel';
  try {
    await registro.update();
    return registro.installing || registro.waiting ? 'nova' : 'atual';
  } catch {
    return 'indisponivel';
  }
}

export async function carregarInfoBuild() {
  try {
    const res = await fetch('./build.json', { cache: 'no-cache' });
    if (res.ok) info.build = await res.json();
  } catch {
    /* sem build.json em desenvolvimento ou offline sem cache */
  }
}

// -------------------------------------------------------------- tela acesa
async function adquirirTela() {
  try {
    sentinela = await navigator.wakeLock.request('screen');
    sentinela.addEventListener('release', () => {
      sentinela = null;
    });
    return true;
  } catch {
    sentinela = null;
    return false;
  }
}

export const telaAcesa = {
  suportado: () => 'wakeLock' in navigator,

  async ligar() {
    const ok = await adquirirTela();
    store.set('tela', ok);
    return ok;
  },

  async desligar() {
    store.set('tela', false);
    try {
      await sentinela?.release();
    } catch {
      /* já liberada */
    }
    sentinela = null;
  },

  restaurar() {
    if (telaAcesa.suportado() && store.get('tela', false)) adquirirTela();
  },
};

// O navegador solta o bloqueio quando a aba some; pede de novo ao voltar.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !sentinela) telaAcesa.restaurar();
});
