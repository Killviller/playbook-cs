import { html, raw, bool } from '../lib/html.js';
import { dataBr } from '../lib/text.js';
import { store } from '../store.js';
import { cartaoInstalar, icone, minhaFuncao, seletorDeFuncao } from '../ui.js';
import { info, pwa, telaAcesa } from '../pwa.js';

const TEMAS = [['escuro', 'Escuro'], ['claro', 'Claro'], ['sistema', 'Sistema']];
const TEXTOS = [['normal', 'Normal'], ['grande', 'Grande'], ['extra', 'Extra']];

function segmentado(rotulo, acao, opcoes, atual) {
  return html`<div class="ajuste ajuste--coluna">
    <span class="ajuste__titulo" id="rot-${acao}">${rotulo}</span>
    <div class="seg" role="radiogroup" aria-labelledby="rot-${acao}">${opcoes.map(
      ([valor, nome]) => html`<button type="button" role="radio" class="seg__op" data-action="${acao}" data-valor="${valor}" aria-checked="${bool(valor === atual)}">${nome}</button>`,
    )}</div>
  </div>`;
}

export function ajustes({ index }) {
  const meta = index.meta;
  const minha = minhaFuncao(index);
  const funcao = minha ? index.funcoesById.get(minha) : null;
  const build = info.build;
  const versao = build ? `Versão ${build.id} · gerada em ${dataBr(String(build.geradoEm).slice(0, 10))}` : 'Versão de desenvolvimento';
  const offline = info.offlinePronto
    ? html`<span class="ok">${icone('check', 'ic--inline')}Pronto para usar sem internet</span>`
    : html`<span class="muted">O uso sem internet é preparado depois da primeira abertura online.</span>`;

  return {
    titulo: 'Ajustes',
    voltar: '/',
    corpo: html`
      <section class="cartao">
        <h2 class="cartao__titulo">Aparência</h2>
        ${segmentado('Tema', 'tema', TEMAS, store.get('tema', 'escuro'))}
        ${segmentado('Tamanho do texto', 'texto', TEXTOS, store.get('texto', 'normal'))}
      </section>

      <section class="cartao">
        <h2 class="cartao__titulo">Minha função</h2>
        <p class="muted">Destaca o que você faz em cada tática e mostra o seu papel nas listas.</p>
        ${seletorDeFuncao(index, minha)}
        ${funcao ? html`<p><strong>${funcao.sigla} · ${funcao.nome}.</strong> <span class="muted">${funcao.descricao}</span></p>` : ''}
      </section>

      ${telaAcesa.suportado()
        ? html`<section class="cartao">
            <h2 class="cartao__titulo">Durante a partida</h2>
            <label class="ajuste">
              <span class="ajuste__texto">
                <span class="ajuste__titulo">Manter a tela acesa</span>
                <span class="ajuste__desc">Evita que o celular bloqueie enquanto o app estiver aberto.</span>
              </span>
              <span class="switch">
                <input type="checkbox" role="switch" data-action="tela" ${store.get('tela', false) ? raw('checked') : ''}>
                <span class="switch__trilho" aria-hidden="true"></span>
              </span>
            </label>
          </section>`
        : ''}

      ${pwa.instalado()
        ? html`<section class="cartao"><h2 class="cartao__titulo">Instalação</h2>
            <p class="ok">${icone('check', 'ic--inline')}App instalado neste aparelho</p></section>`
        : cartaoInstalar()}

      <section class="cartao">
        <h2 class="cartao__titulo">Sem internet e atualizações</h2>
        <p>${offline}</p>
        <p class="muted">${versao}</p>
        <p class="muted">Conteúdo atualizado em ${dataBr(meta.atualizadoEm)}.</p>
        <div class="botoes">
          <button type="button" class="btn" data-action="verificar">${icone('refresh')} Verificar atualização</button>
          <button type="button" class="btn" data-action="compartilhar-app">${icone('share')} Compartilhar o app</button>
        </div>
      </section>

      <section class="cartao">
        <h2 class="cartao__titulo">Sobre o playbook</h2>
        <p><strong>${meta.titulo}</strong> · ${meta.subtitulo}</p>
        <p class="muted">${meta.descricao}</p>
        <p class="muted">Mapas: ${index.mapas.map((m) => m.nome).join(' · ')}</p>
        <p class="muted">${meta.pool}</p>
      </section>

      <section class="cartao">
        <h2 class="cartao__titulo">Editar táticas e radares</h2>
        <p class="muted">Tática melhora com o tempo: reescreva o texto e marque as posições no radar. É para quem mantém o playbook do time.</p>
        <label class="ajuste">
          <span class="ajuste__texto">
            <span class="ajuste__titulo">Atalho de edição nas táticas</span>
            <span class="ajuste__desc">Mostra o lápis e "Editar" / "Criar radar" na tela de cada tática.</span>
          </span>
          <span class="switch">
            <input type="checkbox" role="switch" data-action="atalho-editor" ${store.get('editor', false) ? raw('checked') : ''}>
            <span class="switch__trilho" aria-hidden="true"></span>
          </span>
        </label>
        <div class="botoes">
          <a class="btn" href="#/editor?modo=texto">${icone('edit')} Editar o texto das táticas</a>
          <a class="btn" href="#/editor">${icone('radar')} Editar os radares</a>
        </div>
      </section>

      <section class="cartao">
        <h2 class="cartao__titulo">Dados deste aparelho</h2>
        <p class="muted">Favoritas, mapa da partida e preferências ficam só aqui, no seu celular. Os radares e os textos que você editou não são apagados por este botão (eles têm botão próprio no editor).</p>
        <div class="botoes">
          <button type="button" class="btn btn--perigo" data-action="limpar">${icone('trash')} Apagar dados</button>
        </div>
      </section>`,
  };
}
