import { carregarCru, montarIndice } from './data.js';
import { aplicar as aplicarEdicoes, carregarEdicoes, definirBase } from './edicoes.js';
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
  [['tatica', ':id', 'editar'], telas.editarTatica],
  [['chamar'], telas.chamar],
  [['guia'], telas.guia],
  [['favoritas'], telas.favoritas],
  [['buscar'], telas.buscar],
  [['ajustes'], telas.ajustes],
  [['editor'], telas.editor],
  [['editor', ':id'], telas.editorTatica],
];

let cruBase = null; // playbook.json como está no arquivo
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

/** Refaz o índice com as edições de texto (do site e deste aparelho) por cima do playbook.json. */
function reindexar() {
  indice = montarIndice(aplicarEdicoes(cruBase));
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
    cruBase = await carregarCru();
    definirBase(cruBase);
    indice = montarIndice(cruBase);
  } catch (erro) {
    mostrarErro(erro.message);
    return;
  }
  // Radares e textos editados são opcionais: sem eles o app funciona igual. Se a rede estiver lenta, não seguram a
  // abertura; quando chegam, o índice é refeito e as próximas telas já mostram tudo.
  const extras = Promise.all([carregarRadares(), carregarEdicoes()]).then(reindexar);
  await Promise.race([extras, new Promise((ok) => setTimeout(ok, 3000))]);

  roteador.iniciar(() => renderizar());
  // telas que mudam dados locais (ex.: importar radares) pedem para se redesenhar sem perder a rolagem
  document.addEventListener('pb:redesenhar', () => renderizar({ manterRolagem: true }));
  // o editor de texto salvou algo: as próximas telas usam o texto novo (a tela do editor não é redesenhada)
  document.addEventListener('pb:indice', reindexar);

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
