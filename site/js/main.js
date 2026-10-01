import { carregarPlaybook } from './data.js';
import { carregarRadares } from './radares.js';
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
  [['editor'], telas.editor],
  [['editor', ':id'], telas.editorTatica],
];

let indice = null;
let chaveAnterior = null;
let limpeza = null; // o que a tela atual pediu para desfazer ao sair (listeners fora do <main>)
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

  limpeza?.();
  limpeza = null;
  pintar(tela);
  centralizarChips();

  const main = document.getElementById('main');
  const retorno = tela.montar?.(main, ctx);
  if (typeof retorno === 'function') limpeza = retorno;
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
  // opcional: sem radares o app funciona igual. Se a rede estiver lenta, não segura a abertura (chega a tempo das próximas telas)
  await Promise.race([carregarRadares(), new Promise((ok) => setTimeout(ok, 3000))]);

  roteador.iniciar(() => renderizar());
  // telas que mudam dados locais (ex.: importar radares) pedem para se redesenhar sem perder a rolagem
  document.addEventListener('pb:redesenhar', () => renderizar({ manterRolagem: true }));

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
