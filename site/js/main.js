import { carregarPlaybook } from './data.js';
import * as roteador from './router.js';
import { aplicarPreferencias } from './prefs.js';
import { iniciarAcoes } from './actions.js';
import { aviso, centralizarChips, mostrarErro, pintar } from './shell.js';
import { carregarInfoBuild, eventos, registrarServiceWorker, telaAcesa } from './pwa.js';
import * as telas from './views/index.js';

const ROTAS = [
  [[], telas.home],
  [['mapas'], telas.mapas],
  [['mapa', ':id'], telas.mapa],
  [['tatica', ':id'], telas.tatica],
  [['chamar'], telas.chamar],
  [['guia'], telas.guia],
  [['favoritas'], telas.favoritas],
  [['buscar'], telas.buscar],
  [['ajustes'], telas.ajustes],
];

let indice = null;
let chaveAnterior = null;
const posicoes = new Map(); // rolagem de cada entrada do histórico

function renderizar({ manterRolagem = false } = {}) {
  const rota = roteador.atual();
  const achou = roteador.casar(ROTAS, rota.segmentos);
  const ctx = { index: indice, params: achou?.params ?? {}, query: rota.query, rota };
  const tela = (achou ? achou.view(ctx) : null) ?? telas.naoEncontrada(ctx);

  if (tela.redirect) {
    roteador.ir(tela.redirect, { replace: true });
    return;
  }

  const yAtual = window.scrollY;
  if (!manterRolagem && chaveAnterior) posicoes.set(chaveAnterior, yAtual);

  pintar(tela);
  centralizarChips();

  const main = document.getElementById('main');
  tela.montar?.(main, ctx);
  window.scrollTo(0, manterRolagem ? yAtual : (posicoes.get(rota.chave) ?? 0));
  if (!manterRolagem) main.focus({ preventScroll: true });
  chaveAnterior = rota.chave;
}

// Telas que mostram estado de instalação/offline precisam redesenhar quando ele muda.
function redesenharSeDependeDoPwa() {
  const primeira = roteador.atual().segmentos[0];
  if (!primeira || primeira === 'mapas' || primeira === 'ajustes') renderizar({ manterRolagem: true });
}

async function iniciar() {
  aplicarPreferencias();
  iniciarAcoes({ renderizar, indice: () => indice });

  try {
    indice = await carregarPlaybook();
  } catch (erro) {
    mostrarErro(erro.message);
    return;
  }

  roteador.iniciar(() => renderizar());

  eventos.addEventListener('atualizacao-pronta', () =>
    aviso('Nova versão do playbook disponível', { acao: 'Atualizar', aoAcionar: () => location.reload(), fixo: true }),
  );
  for (const nome of ['instalavel', 'instalado', 'offline-pronto']) {
    eventos.addEventListener(nome, redesenharSeDependeDoPwa);
  }

  registrarServiceWorker();
  carregarInfoBuild().then(redesenharSeDependeDoPwa);
  telaAcesa.restaurar();
}

iniciar();
