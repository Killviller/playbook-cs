// Início do editor (#/editor): escolhe a tática para editar o radar (modo Radar) ou o texto (modo Texto), cuida da imagem
// do radar de cada mapa e exporta tudo para publicar no repositório.
import { html, raw } from '../lib/html.js';
import { dataBr, pad2 } from '../lib/text.js';
import { baixar, copiarTexto, lerImagem, nomeDoArquivo, prepararImagem, removerImagem, salvarImagem } from '../imagens.js';
import * as textos from '../edicoes.js';
import {
  contagem, exportarArquivo, imagemDoMapa, importarArquivo, imagensParaEnviar, rascunhos, salvos, situacao,
} from '../radares.js';
import { aviso } from '../shell.js';
import { icone, mapaAtual } from '../ui.js';

const redesenhar = () => document.dispatchEvent(new Event('pb:redesenhar'));

const ORIGENS = { aparelho: 'Só neste aparelho', site: 'Publicado', playbook: 'Posições do playbook.json' };

function selo(s) {
  if (!s.etapas) return html`<span class="tag">Sem radar</span>`;
  const quantas = `${s.etapas} ${s.etapas === 1 ? 'fase' : 'fases'}`;
  return html`<span class="tag tag--ok">${quantas}</span><span class="tag">${ORIGENS[s.origem] ?? ''}</span>`;
}

function linhaEditor(t) {
  const s = situacao(t);
  return html`<li><a class="row" href="#/editor/${t.id}">
    <span class="row__num" aria-hidden="true">${pad2(t.numero)}</span>
    <span class="row__main">
      <span class="row__title">${t.titulo}</span>
      <span class="row__meta">${selo(s)}${s.rascunho ? html`<span class="tag tag--aviso">Edição não salva</span>` : ''}</span>
    </span>
    <span class="row__end">${icone('edit')}</span>
  </a></li>`;
}

function linhaTexto(t) {
  const s = textos.situacao(t.id);
  const origem = s.origem === 'aparelho' ? 'Só neste aparelho' : 'Publicada';
  return html`<li><a class="row" href="#/tatica/${t.id}/editar">
    <span class="row__num" aria-hidden="true">${pad2(t.numero)}</span>
    <span class="row__main">
      <span class="row__title">${t.titulo}</span>
      <span class="row__meta">
        ${s.editada
          ? html`<span class="tag tag--ok">Editada${s.atualizadoEm ? ` em ${dataBr(s.atualizadoEm)}` : ''}</span><span class="tag">${origem}</span>`
          : html`<span class="tag">Texto original</span>`}
        ${s.rascunho ? html`<span class="tag tag--aviso">Edição não salva</span>` : ''}
      </span>
    </span>
    <span class="row__end">${icone('edit')}</span>
  </a></li>`;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function resumoDe(r, { um, varios }) {
  if (!r.total) return html`Nenhuma tática ${varios}.`;
  return html`<strong>${plural(r.total, `tática ${um}`, `táticas ${varios}`)}</strong>${r.soNoAparelho
    ? html`, <strong>${r.soNoAparelho}</strong> ainda só neste aparelho.`
    : '. Tudo já está publicado.'}`;
}

export function editor({ index, query }) {
  const pedido = query.get('mapa');
  const mapaId = index.mapasById.has(pedido) ? pedido : mapaAtual(index);
  const mapa = index.mapasById.get(mapaId);
  const taticas = index.porMapa.get(mapaId) ?? [];
  const modoTexto = query.get('modo') === 'texto';
  const radares = contagem();
  const edicoes = textos.contagem();

  return {
    titulo: 'Editor',
    voltar: '/ajustes',
    semAbas: true,
    corpo: html`
      <div data-editor-home>
        <nav class="seg editor__modos" aria-label="O que editar">
          <a class="seg__op" href="#/editor?mapa=${mapaId}" data-replace ${!modoTexto ? raw('aria-current="page"') : ''}>Radar</a>
          <a class="seg__op" href="#/editor?modo=texto&mapa=${mapaId}" data-replace ${modoTexto ? raw('aria-current="page"') : ''}>Texto das táticas</a>
        </nav>

        ${modoTexto
          ? html`<p class="intro">Tática melhora com o tempo: reescreva o objetivo, o que cada um faz, o pós-plant… O texto original do PDF fica guardado
              e cada campo alterado mostra o <strong>Antes</strong>. O que você salva fica neste aparelho; para o time ver, publique (no fim desta tela).</p>`
          : html`<p class="intro">Marque as posições de cada tática no radar (as fases do minimapa) arrastando os jogadores e desenhando as rotas com o dedo, sem digitar coordenadas.
              O que você salva fica neste aparelho. Para o time ver, publique (no fim desta tela).</p>`}

        <div class="chips" role="group" aria-label="Mapa">${index.mapas.map(
          (m) => html`<a class="chip chip--mapa" href="#/editor?${modoTexto ? 'modo=texto&' : ''}mapa=${m.id}" data-replace ${m.id === mapaId ? raw('aria-current="page"') : ''}>${m.nome}</a>`,
        )}</div>

        ${modoTexto
          ? ''
          : html`<section class="cartao" aria-labelledby="img-titulo">
              <h2 class="cartao__titulo" id="img-titulo">Imagem do radar · ${mapa.nome}</h2>
              <div data-r="imagem"><p class="muted">Verificando…</p></div>
            </section>`}

        <h2 class="secao">Táticas de ${mapa.nome}</h2>
        <ul class="rows">${taticas.map(modoTexto ? linhaTexto : linhaEditor)}</ul>

        <section class="cartao editor-publicar" aria-labelledby="pub-titulo">
          <h2 class="cartao__titulo" id="pub-titulo">Publicar para o time</h2>
          <p>${resumoDe(radares, { um: 'tem radar', varios: 'têm radar' })}</p>
          <p>${resumoDe(edicoes, { um: 'tem texto editado', varios: 'têm texto editado' })}</p>
          <ol class="passos">
            <li>Baixe (ou copie) o arquivo que mudou: <strong>radares.json</strong> para os radares, <strong>edicoes.json</strong> para os textos.</li>
            <li>No GitHub, abra <strong>site/data/</strong> com o mesmo nome do arquivo, toque no lápis (<em>Edit</em>), apague tudo e cole o conteúdo.</li>
            <li>Toque em <strong>Commit changes</strong>. Em cerca de 2 minutos o time recebe o aviso <em>Nova versão disponível</em>.</li>
          </ol>
          <div class="botoes">
            <button type="button" class="btn ${modoTexto ? '' : 'btn--primario'}" data-ed="baixar-json">${icone('download')} Baixar radares.json</button>
            <button type="button" class="btn" data-ed="copiar-json">${icone('copy')} Copiar</button>
          </div>
          <div class="botoes">
            <button type="button" class="btn ${modoTexto ? 'btn--primario' : ''}" data-ed="baixar-edicoes">${icone('download')} Baixar edicoes.json</button>
            <button type="button" class="btn" data-ed="copiar-edicoes">${icone('copy')} Copiar</button>
          </div>
          <div data-r="envio"></div>
        </section>

        <section class="cartao" aria-labelledby="mov-titulo">
          <h2 class="cartao__titulo" id="mov-titulo">Trazer de outro aparelho</h2>
          <p class="muted">Quer continuar no computador o que fez no celular? Baixe o arquivo aqui e importe lá (serve para o radares.json e para o edicoes.json). O que vem no arquivo entra como salvo neste aparelho.</p>
          <div class="botoes">
            <button type="button" class="btn" data-ed="importar">${icone('upload')} Importar arquivo</button>
            <button type="button" class="btn btn--perigo" data-ed="apagar-tudo">${icone('trash')} Apagar radares e textos deste aparelho</button>
          </div>
        </section>

        <input type="file" accept="image/*" hidden data-r="arquivo-imagem">
        <input type="file" accept="application/json,.json" hidden data-r="arquivo-json">
      </div>`,
    montar: (main) => montar(main, { mapa, ordem: index.funcoes.map((f) => f.id) }),
  };
}

function montar(main, { mapa, ordem }) {
  const raiz = main.querySelector('[data-editor-home]');
  const q = (n) => raiz.querySelector(`[data-r="${n}"]`);

  // ------------------------------------------------------------ imagem do mapa
  async function desenharImagem() {
    const atual = await imagemDoMapa(mapa.id, mapa.radar);
    const local = atual?.origem === 'aparelho' ? await lerImagem(mapa.id) : null;
    q('imagem').innerHTML = String(html`
      <div class="img-radar">
        ${atual ? html`<img class="img-radar__miniatura" src="${atual.url}" alt="Radar de ${mapa.nome}" width="96" height="96">` : html`<span class="img-radar__vazia">${icone('image')}</span>`}
        <p class="img-radar__texto">${!atual
          ? html`<strong>Ainda sem imagem.</strong> Sem ela o radar aparece só com uma grade. Escolha um print ou foto do radar de ${mapa.nome}.`
          : atual.origem === 'aparelho'
            ? html`<strong>Imagem escolhida neste aparelho.</strong> Para o time ver, envie o arquivo para <code>site/img/radar/</code> (veja em Publicar).`
            : html`<strong>${atual.origem === 'playbook' ? 'Radar do playbook.' : 'Imagem publicada no site.'}</strong> Já está pronto para usar. Se escolher outra imagem, ela vale só neste aparelho até você publicar.`}</p>
      </div>
      <div class="botoes">
        <button type="button" class="btn btn--sm" data-ed="escolher-imagem">${icone('image')} ${atual ? 'Usar outra imagem' : 'Escolher imagem'}</button>
        ${local ? html`<button type="button" class="btn btn--sm" data-ed="baixar-imagem">${icone('download')} Baixar a imagem pronta</button>
          <button type="button" class="btn btn--sm btn--perigo" data-ed="remover-imagem">Remover daqui</button>` : ''}
      </div>
      <p class="muted">O app deixa a imagem quadrada e leve (até 1024 px). Os radares são desenhados em cima dela.</p>`);
  }

  async function desenharEnvio() {
    const lista = (await imagensParaEnviar()).filter((i) => !i.noSite);
    q('envio').innerHTML = lista.length
      ? String(html`<div class="envio">
          <p><strong>Imagens para enviar antes do JSON</strong> (no GitHub, abra a pasta <code>site/img/radar/</code> → <em>Add file → Upload files</em>):</p>
          <ul class="envio__lista">${lista.map(
            (i) => html`<li><span>${i.caminho.replace('img/radar/', '')}</span>
              <button type="button" class="btn btn--sm" data-ed="baixar-imagem-envio" data-mapa="${i.mapaId}">${icone('download')} Baixar</button></li>`,
          )}</ul></div>`)
      : '';
  }

  // O texto do arquivo fica pronto antes do toque: o Safari só deixa copiar logo depois do gesto, sem esperar nada.
  let textoPronto = '';
  const preparar = async () => {
    textoPronto = await exportarArquivo(ordem);
  };

  if (q('imagem')) desenharImagem(); // só no modo Radar
  desenharEnvio();
  preparar();

  // ------------------------------------------------------------------- ações
  const acoes = {
    'escolher-imagem': () => q('arquivo-imagem').click(),

    async 'baixar-imagem'() {
      const img = await lerImagem(mapa.id);
      if (img) baixar(nomeDoArquivo(mapa.id, img.tipo), img.blob);
    },

    async 'baixar-imagem-envio'(b) {
      const img = await lerImagem(b.dataset.mapa);
      if (img) baixar(nomeDoArquivo(b.dataset.mapa, img.tipo), img.blob);
    },

    async 'remover-imagem'() {
      if (!confirm(`Remover a imagem de ${mapa.nome} deste aparelho?`)) return;
      await removerImagem(mapa.id);
      await desenharImagem();
      await desenharEnvio();
      await preparar();
      aviso('Imagem removida deste aparelho');
    },

    'baixar-json'() {
      baixar('radares.json', textoPronto, 'application/json');
      aviso('radares.json baixado');
    },

    async 'copiar-json'() {
      aviso((await copiarTexto(textoPronto)) ? 'radares.json copiado. Agora cole no GitHub.' : 'O navegador não deixou copiar: use Baixar');
    },

    // o edicoes.json sai na hora (sem esperar nada): o Safari só deixa copiar logo depois do toque
    'baixar-edicoes'() {
      baixar('edicoes.json', textos.exportarArquivo(), 'application/json');
      aviso('edicoes.json baixado');
    },

    async 'copiar-edicoes'() {
      aviso((await copiarTexto(textos.exportarArquivo())) ? 'edicoes.json copiado. Agora cole no GitHub.' : 'O navegador não deixou copiar: use Baixar');
    },

    importar: () => q('arquivo-json').click(),

    'apagar-tudo'() {
      if (!confirm('Apagar TODOS os radares e textos editados (e os rascunhos) salvos neste aparelho? O que já foi publicado para o time não muda.')) return;
      salvos.limpar();
      rascunhos.limpar();
      textos.salvas.limpar();
      textos.rascunhos.limpar();
      document.dispatchEvent(new Event('pb:indice'));
      aviso('Radares e textos deste aparelho apagados');
      redesenhar();
    },
  };

  raiz.addEventListener('click', (ev) => {
    const botao = ev.target instanceof Element ? ev.target.closest('[data-ed]') : null;
    if (!botao) return;
    ev.preventDefault();
    acoes[botao.dataset.ed]?.(botao);
  });

  q('arquivo-imagem')?.addEventListener('change', async (ev) => {
    const arquivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!arquivo) return;
    try {
      aviso('Preparando a imagem…', { fixo: true });
      await salvarImagem(mapa.id, await prepararImagem(arquivo));
      await desenharImagem();
      await desenharEnvio();
      await preparar();
      aviso('Imagem salva neste aparelho');
    } catch (erro) {
      aviso(erro.message || 'Não consegui usar essa imagem');
    }
  });

  q('arquivo-json').addEventListener('change', async (ev) => {
    const arquivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!arquivo) return;
    try {
      const cru = JSON.parse(await arquivo.text());
      // o arquivo diz o que é: "radares" (radares.json) ou "taticas" (edicoes.json)
      if (cru && typeof cru === 'object' && cru.taticas && !cru.radares) {
        const n = textos.importarArquivo(cru);
        document.dispatchEvent(new Event('pb:indice'));
        aviso(n ? `${plural(n, 'texto de tática importado', 'textos de táticas importados')}` : 'Esse arquivo não tem textos editados');
      } else {
        const n = importarArquivo(cru);
        aviso(n ? `${plural(n, 'radar importado', 'radares importados')}` : 'Esse arquivo não tem radares');
      }
      redesenhar();
    } catch {
      aviso('Esse arquivo não é um radares.json nem um edicoes.json válido');
    }
  });
}
