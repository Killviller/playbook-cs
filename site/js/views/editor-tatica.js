// Editor visual do radar de uma tática (#/editor/mirage-02).
//
// Nada de coordenadas: toque para posicionar, arraste para mover, desenhe as rotas com o dedo.
//  - Jogadores: toque no P1…P5 e depois no radar (ele já passa para o próximo que falta).
//  - Rotas e arremessos: ligue a ferramenta e arraste. Começar em cima de um jogador usa a cor dele.
//  - Granadas, bomba e texto: toque na ferramenta e depois no radar.
//  - Etapas: o mesmo radar em momentos diferentes (posições iniciais, execução, pós-plant…).
//  - Salvar fica neste aparelho; o rascunho é guardado sozinho para não perder nada.
import { html, raw, bool } from '../lib/html.js';
import {
  GRANADAS, Historico, LIMITES, canonico, clonar, comIds, comprimento, etapaContinuando, limitar,
  novoDiagrama, simplificarTraco, temConteudo,
} from '../lib/radar.js';
import { corDaFuncao, desenharCamada, desenharSvg, glifoGranada, viewBox } from '../lib/radar-svg.js';
import { imagemDoMapa, imagemDoSite, pontoDePartida, radarDaTatica, rascunhos, salvos } from '../radares.js';
import { prepararImagem, salvarImagem } from '../imagens.js';
import { aviso } from '../shell.js';
import * as roteador from '../router.js';
import { icone } from '../ui.js';

const ZOOM_MIN = 0.25;
const LIMIAR_TOQUE = 8; // px: menos que isso é um toque, não um arrasto

export function editorTatica({ index, params }) {
  const t = index.taticasById.get(params.id);
  if (!t) return null; // main mostra "não encontrada"

  return {
    titulo: `Radar · ${t.chamada}`,
    tituloDocumento: `Radar de ${t.chamada}`,
    voltar: `/editor?mapa=${t.mapa}`,
    semAbas: true,
    acoes: html`<a class="icon-btn" href="#/tatica/${t.id}" aria-label="Ver a tática" title="Ver a tática">${icone('eye')}</a>`,
    corpo: html`
      <div class="editor" data-editor>
        <div class="editor__palco">
          <div class="editor__barra" data-r="barra">
            <button type="button" class="icon-btn icon-btn--sm" data-ed="desfazer" aria-label="Desfazer">${icone('undo')}</button>
            <button type="button" class="icon-btn icon-btn--sm" data-ed="refazer" aria-label="Refazer">${icone('redo')}</button>
            <span class="editor__sep" aria-hidden="true"></span>
            <button type="button" class="icon-btn icon-btn--sm" data-ed="zoom-menos" aria-label="Afastar o radar">${icone('minus')}</button>
            <button type="button" class="icon-btn icon-btn--sm" data-ed="zoom-mais" aria-label="Aproximar o radar">${icone('plus')}</button>
            <button type="button" class="btn btn--sm" data-ed="zoom-reset" hidden>1×</button>
            <span class="editor__espaco"></span>
            <button type="button" class="btn btn--sm" data-ed="salvar" data-ref="salvar">
              ${icone('check')}<span data-ref="salvar-texto">Salvo</span>
            </button>
          </div>
          <div class="editor__radar" data-r="radar"></div>
        </div>
        <div class="editor__lado">
          <div data-r="alerta"></div>
          <div data-r="painel"></div>
          <div data-r="ferramentas"></div>
          <div data-r="etapas"></div>
          <div data-r="form"></div>
          <div data-r="mais"></div>
        </div>
        <input type="file" accept="image/*" hidden data-r="arquivo">
      </div>`,
    montar: (main) => iniciar(main.querySelector('[data-editor]'), { index, t }),
  };
}

function iniciar(raiz, { index, t }) {
  const funcoes = index.funcoes;
  const mapa = index.mapasById.get(t.mapa);
  const q = (nome) => raiz.querySelector(`[data-r="${nome}"]`);
  const el = Object.fromEntries(['barra', 'radar', 'alerta', 'painel', 'ferramentas', 'etapas', 'form', 'mais', 'arquivo'].map((n) => [n, q(n)]));

  // ------------------------------------------------------------------- estado
  let seq = 0;
  const gerarId = () => `i${++seq}`;
  let diag;
  let hist;
  let baseJson = '';
  let recuperado = false;
  let etapaI = 0;
  let selecionado = null;
  let ferramenta = null; // { tipo: 'jogador'|'granada'|'bomba'|'texto'|'rota', funcao?, granada?, estilo? }
  let vista = { x: 0, y: 0, w: 1 };
  let tracando = null;
  let imagem = imagemDoSite(t.mapa);
  let ultimoDono = funcoes[0]?.id ?? null;
  let vivo = true;

  const etapa = () => diag.etapas[etapaI];
  const item = (id) => etapa().itens.find((i) => i.id === id);
  const jogadorDe = (funcao) => etapa().itens.find((i) => i.tipo === 'jogador' && i.funcao === funcao);
  const funcaoPor = (id) => funcoes.find((f) => f.id === id);
  const nomeFuncao = (id) => {
    const f = funcaoPor(id);
    return f ? `${f.sigla} · ${f.curto ?? f.nome}` : 'Sem jogador';
  };
  const sujo = () => JSON.stringify(canonico(diag)) !== baseJson;

  function carregar(partida) {
    diag = comIds(partida.inicial.etapas.length ? partida.inicial : novoDiagrama(), gerarId);
    baseJson = JSON.stringify(partida.base);
    recuperado = partida.recuperado;
    hist = new Historico(diag);
    etapaI = 0;
    selecionado = null;
    ferramenta = null;
    vista = { x: 0, y: 0, w: 1 };
  }

  // -------------------------------------------------------------- desenho
  function desenharRadar({ completo = false } = {}) {
    if (!vivo) return;
    const opcoes = {
      funcoes, imagem, vista, editor: true, tracando,
      selecionado: ferramenta ? null : selecionado,
      rotulo: `Radar editável de ${t.chamada}, etapa ${etapaI + 1}`,
    };
    const svg = el.radar.querySelector('svg');
    if (completo || !svg) {
      el.radar.innerHTML = desenharSvg(etapa(), opcoes);
    } else {
      svg.setAttribute('viewBox', viewBox(vista));
      svg.querySelector('.rd-camada').innerHTML = desenharCamada(etapa(), opcoes);
    }
    el.radar.classList.toggle('editor__radar--armado', !!ferramenta);
  }

  let agendado = false;
  const agendar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      desenharRadar();
    });
  };

  const donos = (atual, { nenhum = false } = {}) => html`<div class="donos" role="radiogroup" aria-label="Quem faz">
    ${funcoes.map(
      (f) => html`<button type="button" role="radio" class="dono" style="--c:${corDaFuncao(funcoes, f.id)}" data-ed="dono" data-valor="${f.id}" aria-checked="${bool(f.id === atual)}" aria-label="${f.sigla}, ${f.curto ?? f.nome}">${f.sigla}</button>`,
    )}
    ${nenhum ? html`<button type="button" role="radio" class="dono dono--nenhum" data-ed="dono" data-valor="" aria-checked="${bool(!atual)}">Ninguém</button>` : ''}
  </div>`;

  const segmentado = (rotulo, acao, opcoes, atual) => html`<div class="seg editor__seg" role="radiogroup" aria-label="${rotulo}">${opcoes.map(
    ([valor, nome]) => html`<button type="button" role="radio" class="seg__op" data-ed="${acao}" data-valor="${valor}" aria-checked="${bool(valor === atual)}">${nome}</button>`,
  )}</div>`;

  function htmlPainel() {
    if (ferramenta) {
      const f = ferramenta;
      const dica = {
        jogador: html`Toque (ou clique) no radar para posicionar <strong>${nomeFuncao(f.funcao)}</strong>.`,
        granada: html`Toque no radar onde a <strong>${GRANADAS[f.granada]?.nome}</strong> cai. Pode tocar mais de uma vez.`,
        bomba: html`Toque no radar onde a bomba é plantada.`,
        texto: html`Toque no radar onde o texto deve ficar.`,
        rota: f.estilo === 'arremesso'
          ? html`Arraste no radar de onde a granada sai até onde ela cai.`
          : html`Arraste no radar para desenhar a rota. Comece em cima de um jogador para usar a cor dele.`,
      }[f.tipo];
      return html`<div class="editor__modo" role="status">
        <p class="editor__dica">${dica}</p>
        ${f.tipo === 'rota' ? donos(f.funcao) : ''}
        <button type="button" class="btn btn--sm btn--primario" data-ed="concluir">${icone('check')} Concluir</button>
      </div>`;
    }

    const it = selecionado ? item(selecionado) : null;
    if (!it) {
      return html`<p class="editor__dica editor__dica--solta">Toque em um item para editar e arraste para mover. Com dois dedos (ou a roda do mouse), aproxime ou afaste o radar.</p>`;
    }

    const excluir = html`<button type="button" class="btn btn--sm btn--perigo" data-ed="excluir">${icone('trash')} Excluir</button>`;
    const cab = (titulo) => html`<div class="editor__selecao-cab"><strong>${titulo}</strong>${excluir}</div>`;
    let corpo;
    switch (it.tipo) {
      case 'jogador':
        corpo = html`${cab(nomeFuncao(it.funcao))}<p class="muted">Arraste o marcador para mudar de lugar.</p>`;
        break;
      case 'rota':
        corpo = html`${cab(it.estilo === 'arremesso' ? 'Arremesso' : 'Rota')}
          ${segmentado('Tipo de linha', 'estilo', [['rota', 'Rota (linha cheia)'], ['arremesso', 'Arremesso (tracejada)']], it.estilo)}
          ${donos(it.funcao)}
          <p class="muted">Arraste os pontos brancos para ajustar o caminho, ou a linha para mover tudo.</p>`;
        break;
      case 'granada':
        corpo = html`${cab(GRANADAS[it.granada].nome)}
          ${segmentado('Tipo de granada', 'tipo-granada', Object.entries(GRANADAS).map(([id, g]) => [id, g.nome]), it.granada)}
          <span class="editor__rotulo">Quem joga</span>
          ${donos(it.funcao, { nenhum: true })}`;
        break;
      case 'bomba':
        corpo = html`${cab('Bomba (C4)')}<p class="muted">Arraste para mudar o lugar do plant.</p>`;
        break;
      default:
        corpo = html`${cab('Texto')}
          <label class="campo"><span class="sr-only">Texto no radar</span>
            <input class="campo__input" data-ed-texto maxlength="${LIMITES.texto}" value="${it.texto}" autocomplete="off" enterkeyhint="done"></label>`;
    }
    return html`<div class="editor__selecao">${corpo}</div>`;
  }

  function htmlFerramentas() {
    const ativa = (tipo, chave, valor) => !!ferramenta && ferramenta.tipo === tipo && (!chave || ferramenta[chave] === valor);
    const botao = (valor, miolo, rotulo, ligado, classe = '') =>
      html`<button type="button" class="ed-ficha ${classe}" data-ed="ferr" data-valor="${valor}" aria-pressed="${bool(ligado)}">${miolo}<span class="ed-ficha__nome">${rotulo}</span></button>`;
    const glifo = (g) => raw(`<svg class="ed-glifo" viewBox="-34 -34 68 68" aria-hidden="true"><circle r="29" fill="#0f141b" stroke="#94a3b8" stroke-width="5"/>${glifoGranada(g)}</svg>`);

    return html`
      <section class="ed-grupo" aria-labelledby="ed-jog"><h3 class="ed-grupo__titulo" id="ed-jog">Jogadores</h3>
        <div class="ed-grade ed-grade--5">${funcoes.map((f) => {
          const colocado = !!jogadorDe(f.id);
          return html`<button type="button" class="ed-ficha ed-ficha--jogador ${colocado ? 'is-no-radar' : ''}" style="--c:${corDaFuncao(funcoes, f.id)}" data-ed="ferr" data-valor="jogador:${f.id}"
            aria-pressed="${bool(ativa('jogador', 'funcao', f.id))}" aria-label="${f.sigla}, ${f.curto ?? f.nome}${colocado ? ', já está no radar' : ''}">
            <span class="ed-ficha__ponto">${f.sigla}</span><span class="ed-ficha__nome">${f.curto ?? f.nome}</span></button>`;
        })}</div>
      </section>
      <section class="ed-grupo" aria-labelledby="ed-rot"><h3 class="ed-grupo__titulo" id="ed-rot">Desenhar</h3>
        <div class="ed-grade ed-grade--2">
          ${botao('rota:rota', icone('rota'), 'Rota', ativa('rota', 'estilo', 'rota'))}
          ${botao('rota:arremesso', icone('arremesso'), 'Arremesso', ativa('rota', 'estilo', 'arremesso'))}
        </div>
      </section>
      <section class="ed-grupo" aria-labelledby="ed-gra"><h3 class="ed-grupo__titulo" id="ed-gra">Granadas e marcas</h3>
        <div class="ed-grade ed-grade--3">
          ${Object.entries(GRANADAS).map(([id, g]) => botao(`granada:${id}`, glifo(id), g.nome, ativa('granada', 'granada', id)))}
          ${botao('bomba', icone('bomba'), 'Bomba', ativa('bomba'))}
          ${botao('texto', icone('texto'), 'Texto', ativa('texto'))}
        </div>
      </section>`;
  }

  function htmlEtapas() {
    return html`<section class="ed-grupo" aria-labelledby="ed-eta"><h3 class="ed-grupo__titulo" id="ed-eta">Etapas</h3>
      <div class="chips editor__etapas" role="group" aria-label="Etapas do radar">
        ${diag.etapas.map(
          (e, n) => html`<button type="button" class="chip chip--etapa" data-ed="etapa" data-valor="${n}" aria-pressed="${bool(n === etapaI)}">${n + 1}${e.titulo ? html`<span class="chip__rotulo">${e.titulo}</span>` : ''}</button>`,
        )}
        ${diag.etapas.length < LIMITES.etapas
          ? html`<button type="button" class="chip" data-ed="nova-etapa" title="Cria a próxima etapa com os jogadores onde as rotas terminam">${icone('plus', 'ic--inline')} Nova etapa</button>`
          : ''}
      </div></section>`;
  }

  function htmlForm() {
    const e = etapa();
    return html`<section class="cartao editor__form">
      <label class="campo"><span class="campo__rotulo">Título da etapa</span>
        <input class="campo__input" data-ed-campo="titulo" maxlength="${LIMITES.titulo}" value="${e.titulo}" placeholder="Ex.: Posições iniciais" autocomplete="off"></label>
      <label class="campo"><span class="campo__rotulo">O que acontece nesta etapa</span>
        <textarea class="campo__input" data-ed-campo="nota" rows="3" maxlength="${LIMITES.nota}" placeholder="Ex.: P3 joga a smoke de CT, P2 flasha por cima da Ramp.">${e.nota}</textarea></label>
      <div class="botoes">
        <button type="button" class="btn btn--sm" data-ed="duplicar-etapa">${icone('copy')} Duplicar</button>
        <button type="button" class="btn btn--sm" data-ed="limpar-etapa">Limpar</button>
        <button type="button" class="btn btn--sm btn--perigo" data-ed="excluir-etapa" ${diag.etapas.length < 2 ? raw('disabled') : ''}>${icone('trash')} Excluir etapa</button>
      </div>
    </section>`;
  }

  function htmlAlerta() {
    return html`
      ${recuperado && sujo()
        ? html`<div class="editor__alerta" role="status"><span>Recuperamos alterações desta tática que ainda não tinham sido salvas.</span>
            <button type="button" class="btn btn--sm" data-ed="descartar-rascunho">Descartar</button></div>`
        : ''}
      ${!imagem
        ? html`<div class="editor__alerta editor__alerta--imagem" role="status"><span><strong>Falta a imagem do radar de ${mapa.nome}.</strong> Escolha um print ou foto do radar para posicionar com precisão.</span>
            <button type="button" class="btn btn--sm btn--primario" data-ed="escolher-imagem">${icone('image')} Escolher imagem</button></div>`
        : ''}`;
  }

  function htmlMais(aberto) {
    const outras = (index.porMapa.get(t.mapa) ?? []).filter((o) => o.id !== t.id && radarDaTatica(o.id));
    return html`<details class="sobre editor__mais" ${aberto ? raw('open') : ''}>
      <summary>Mais opções</summary>
      <div class="editor__mais-corpo">
        ${outras.length
          ? html`<label class="campo"><span class="campo__rotulo">Começar a partir de outra tática</span>
              <select class="campo__input" data-ed-copiar>
                <option value="">Escolher uma tática com radar…</option>
                ${outras.map((o) => html`<option value="${o.id}">${o.chamada} · ${o.titulo}</option>`)}
              </select></label>`
          : ''}
        <div class="botoes">
          <button type="button" class="btn btn--sm" data-ed="escolher-imagem">${icone('image')} ${imagem ? 'Trocar a imagem do radar' : 'Escolher imagem do radar'}</button>
          ${salvos.tem(t.id) ? html`<button type="button" class="btn btn--sm" data-ed="voltar-publicada">Voltar à versão publicada</button>` : ''}
          <button type="button" class="btn btn--sm btn--perigo" data-ed="limpar-tudo">${icone('trash')} Apagar todo este radar</button>
        </div>
        <p class="muted">Para o time ver o que você salvou, publique em <a class="link" href="#/editor?mapa=${t.mapa}">Editor de radar → Publicar para o time</a>.</p>
      </div>
    </details>`;
  }

  const escrever = (nome, conteudo) => {
    el[nome].innerHTML = String(conteudo);
  };
  const desenharPainel = () => escrever('painel', htmlPainel());
  const desenharFerramentas = () => escrever('ferramentas', htmlFerramentas());
  const desenharEtapas = () => escrever('etapas', htmlEtapas());
  const desenharForm = () => escrever('form', htmlForm());
  const desenharAlerta = () => escrever('alerta', htmlAlerta());
  const desenharMais = () => escrever('mais', htmlMais(el.mais.querySelector('details')?.open));

  function atualizarBarra() {
    const set = (acao, desligado) => {
      const b = el.barra.querySelector(`[data-ed="${acao}"]`);
      if (b) b.disabled = desligado;
    };
    set('desfazer', !hist.podeDesfazer());
    set('refazer', !hist.podeRefazer());
    set('zoom-menos', vista.w >= 1);
    set('zoom-mais', vista.w <= ZOOM_MIN);
    el.barra.querySelector('[data-ed="zoom-reset"]').hidden = vista.w >= 1;
    const salvar = el.barra.querySelector('[data-ref="salvar"]');
    const pendente = sujo();
    salvar.classList.toggle('btn--primario', pendente);
    salvar.querySelector('[data-ref="salvar-texto"]').textContent = pendente ? 'Salvar' : 'Salvo';
  }

  function tudo() {
    desenharRadar();
    desenharPainel();
    desenharFerramentas();
    desenharEtapas();
    desenharForm();
    desenharAlerta();
    desenharMais();
    atualizarBarra();
  }

  // ----------------------------------------------------------- edição e histórico
  function guardarRascunho() {
    if (sujo()) rascunhos.guardar(t.id, diag);
    else rascunhos.descartar(t.id);
  }

  /** Registra a edição no histórico (sem mexer nos controles: pode ser chamado enquanto a pessoa digita). */
  function registrarEdicao() {
    hist.registrar(diag);
    guardarRascunho();
    atualizarBarra();
  }

  /** Edição feita pelo radar ou pelos botões: registra e redesenha o que depende dela. */
  function confirmar() {
    registrarEdicao();
    desenharRadar();
    desenharPainel();
    desenharFerramentas();
    desenharEtapas();
    desenharAlerta();
  }

  function aposHistorico() {
    etapaI = Math.min(etapaI, diag.etapas.length - 1);
    if (selecionado && !item(selecionado)) selecionado = null;
    guardarRascunho();
    tudo();
  }

  function desfazer() {
    const antes = hist.desfazer();
    if (!antes) return;
    diag = antes;
    aposHistorico();
  }

  function refazer() {
    const depois = hist.refazer();
    if (!depois) return;
    diag = depois;
    aposHistorico();
  }

  function salvar() {
    if (!sujo()) return aviso('Nada novo para salvar');
    const limpo = canonico(diag);
    salvos.salvar(t.id, limpo);
    rascunhos.descartar(t.id);
    baseJson = JSON.stringify(limpo);
    recuperado = false;
    atualizarBarra();
    desenharAlerta();
    aviso(temConteudo(limpo) ? 'Radar salvo neste aparelho' : 'Radar vazio salvo', {
      acao: 'Publicar',
      aoAcionar: () => roteador.ir(`/editor?mapa=${t.mapa}`),
    });
  }

  // ------------------------------------------------------------- ferramentas
  function armar(valor) {
    const [tipo, extra = null] = valor.split(':');
    const atual = ferramenta && (ferramenta.funcao ?? ferramenta.granada ?? ferramenta.estilo ?? null);
    if (ferramenta?.tipo === tipo && atual === extra) {
      ferramenta = null;
    } else {
      selecionado = null;
      ferramenta =
        tipo === 'jogador' ? { tipo, funcao: extra }
        : tipo === 'granada' ? { tipo, granada: extra }
        : tipo === 'rota' ? { tipo, estilo: extra, funcao: funcaoPor(ultimoDono) ? ultimoDono : funcoes[0]?.id }
        : { tipo };
    }
    desenharPainel();
    desenharFerramentas();
    desenharRadar();
  }

  function selecionar(id) {
    selecionado = id;
    desenharPainel();
    agendar();
  }

  function colocar(p) {
    const e = etapa();
    const x = limitar(p[0]);
    const y = limitar(p[1]);
    const ocupado = ferramenta.tipo === 'jogador' ? !!jogadorDe(ferramenta.funcao) : ferramenta.tipo === 'bomba' && e.itens.some((i) => i.tipo === 'bomba');
    if (!ocupado && e.itens.length >= LIMITES.itens) return aviso(`Esta etapa já tem ${LIMITES.itens} itens`);

    let novo = null;
    switch (ferramenta.tipo) {
      case 'jogador': {
        novo = jogadorDe(ferramenta.funcao);
        const jaEstava = !!novo;
        if (novo) Object.assign(novo, { x, y });
        else e.itens.push((novo = { id: gerarId(), tipo: 'jogador', funcao: ferramenta.funcao, x, y }));
        // colocando um por um: já arma o próximo da fila que ainda não está no radar (depois do P2 vem o P3)
        const posicao = funcoes.findIndex((f) => f.id === ferramenta.funcao);
        const faltam = funcoes.filter((f) => !jogadorDe(f.id));
        const proximo = jaEstava ? null : (faltam.find((f) => funcoes.indexOf(f) > posicao) ?? faltam[0]);
        ferramenta = proximo ? { tipo: 'jogador', funcao: proximo.id } : null;
        break;
      }
      case 'granada':
        e.itens.push((novo = { id: gerarId(), tipo: 'granada', granada: ferramenta.granada, ...(funcaoPor(ultimoDono) ? { funcao: ultimoDono } : {}), x, y }));
        break;
      case 'bomba':
        novo = e.itens.find((i) => i.tipo === 'bomba');
        if (novo) Object.assign(novo, { x, y });
        else e.itens.push((novo = { id: gerarId(), tipo: 'bomba', x, y }));
        ferramenta = null;
        break;
      case 'texto':
        e.itens.push((novo = { id: gerarId(), tipo: 'texto', texto: 'Texto', x, y }));
        ferramenta = null;
        break;
      default:
        return;
    }
    selecionado = novo.id;
    confirmar();
    if (novo.tipo === 'texto') {
      const campo = el.painel.querySelector('[data-ed-texto]');
      campo?.focus();
      campo?.select();
    }
  }

  function finalizarTraco(a) {
    tracando = null;
    if (comprimento(a.pontos) < 0.03 * vista.w) {
      aviso('Arraste o dedo no radar para desenhar');
      return desenharRadar();
    }
    const e = etapa();
    if (e.itens.length >= LIMITES.itens) {
      aviso(`Esta etapa já tem ${LIMITES.itens} itens`);
      return desenharRadar();
    }
    const pontos = simplificarTraco(a.pontos, 0.006 * vista.w);
    const novo = { id: gerarId(), tipo: 'rota', funcao: a.funcao, estilo: ferramenta.estilo, pontos };
    e.itens.push(novo);
    ultimoDono = a.funcao;
    ferramenta.funcao = a.funcao;
    selecionado = novo.id;
    confirmar();
  }

  function excluir() {
    const i = etapa().itens.findIndex((x) => x.id === selecionado);
    if (i < 0) return;
    etapa().itens.splice(i, 1);
    selecionado = null;
    confirmar();
  }

  function escolherDono(valor) {
    if (ferramenta?.tipo === 'rota') {
      ferramenta.funcao = valor;
      ultimoDono = valor;
      return desenharPainel();
    }
    const it = selecionado && item(selecionado);
    if (!it || (it.tipo !== 'rota' && it.tipo !== 'granada')) return;
    if (valor) {
      it.funcao = valor;
      ultimoDono = valor;
    } else {
      delete it.funcao;
    }
    confirmar();
  }

  // ------------------------------------------------------------------- etapas
  function irParaEtapa(n) {
    etapaI = Math.max(0, Math.min(n, diag.etapas.length - 1));
    selecionado = null;
    ferramenta = null;
    tracando = null;
    desenharRadar();
    desenharPainel();
    desenharFerramentas();
    desenharEtapas();
    desenharForm();
  }

  function inserirEtapa(nova) {
    diag.etapas.splice(etapaI + 1, 0, nova);
    registrarEdicao();
    irParaEtapa(etapaI + 1);
  }

  const novaContinuando = () => comIds({ etapas: [etapaContinuando(etapa())] }, gerarId).etapas[0];

  // --------------------------------------------------------------------- zoom
  const ajustarVista = () => {
    vista.w = Math.min(1, Math.max(ZOOM_MIN, vista.w));
    vista.x = Math.min(1 - vista.w, Math.max(0, vista.x));
    vista.y = Math.min(1 - vista.w, Math.max(0, vista.y));
  };

  function zoomar(fator, cx = 0.5, cy = 0.5) {
    const px = vista.x + cx * vista.w;
    const py = vista.y + cy * vista.w;
    vista.w *= fator;
    vista.w = Math.min(1, Math.max(ZOOM_MIN, vista.w));
    vista.x = px - cx * vista.w;
    vista.y = py - cy * vista.w;
    ajustarVista();
    desenharRadar();
    atualizarBarra();
  }

  // ------------------------------------------------------------- ponteiro/toque
  const ponteiros = new Map();
  let arrasto = null;
  let pinca = null;

  const retangulo = () => (el.radar.querySelector('svg') ?? el.radar).getBoundingClientRect();
  const fracao = (px, py) => {
    const r = retangulo();
    return [(px - r.left) / r.width, (py - r.top) / r.height];
  };
  const noMapa = (ev) => {
    const [fx, fy] = fracao(ev.clientX, ev.clientY);
    return [vista.x + fx * vista.w, vista.y + fy * vista.w];
  };

  function aoBaixar(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    const foco = document.activeElement;
    if (foco instanceof HTMLElement && foco.matches('input, textarea')) foco.blur(); // dispara o "change" e registra o que foi digitado
    try {
      el.radar.setPointerCapture(ev.pointerId);
    } catch {
      /* sem captura: segue com os eventos normais */
    }
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (ponteiros.size === 2) {
      encerrarArrasto(null, { cancelar: true });
      const [a, b] = [...ponteiros.values()];
      const [cx, cy] = fracao((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, w0: vista.w, mx: vista.x + cx * vista.w, my: vista.y + cy * vista.w };
      return;
    }
    if (ponteiros.size > 2) return;

    const p = noMapa(ev);
    const alvo = ev.target instanceof Element ? ev.target : null;
    const alca = alvo?.closest('[data-alca]');
    const noItem = alvo?.closest('[data-item]');
    const it = noItem ? item(noItem.dataset.item) : null;
    const base = { x0: ev.clientX, y0: ev.clientY };

    // com uma ferramenta de colocar armada, tocar num jogador continua movendo o jogador (só a rota desenha por cima)
    const moverJogador = !!ferramenta && ferramenta.tipo !== 'rota' && it?.tipo === 'jogador';
    if (!ferramenta || moverJogador) {
      if (alca && selecionado && !ferramenta) {
        arrasto = { ...base, tipo: 'alca', idx: Number(alca.dataset.alca), mudou: false };
      } else if (it) {
        if (moverJogador) selecionado = it.id;
        else if (selecionado !== it.id) selecionar(it.id);
        arrasto = it.tipo === 'rota'
          ? { ...base, tipo: 'rota', p0: p, original: clonar(it.pontos), id: it.id, mudou: false }
          : { ...base, tipo: 'item', id: it.id, ox: it.x - p[0], oy: it.y - p[1], mudou: false };
      } else {
        arrasto = { ...base, tipo: 'fundo', vx: vista.x, vy: vista.y, mudou: false };
      }
    } else if (ferramenta.tipo === 'rota') {
      const dono = it?.tipo === 'jogador' ? it : null;
      const inicio = dono ? [dono.x, dono.y] : p;
      const funcao = dono?.funcao ?? ferramenta.funcao;
      arrasto = { ...base, tipo: 'traco', funcao, pontos: [inicio] };
      tracando = { funcao, estilo: ferramenta.estilo, pontos: arrasto.pontos };
    } else {
      arrasto = { ...base, tipo: 'toque', vx: vista.x, vy: vista.y, mudou: false };
    }
  }

  function aoMover(ev) {
    const ponteiro = ponteiros.get(ev.pointerId);
    if (!ponteiro) return;
    ponteiro.x = ev.clientX;
    ponteiro.y = ev.clientY;

    if (pinca && ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      const [cx, cy] = fracao((a.x + b.x) / 2, (a.y + b.y) / 2);
      vista.w = Math.min(1, Math.max(ZOOM_MIN, (pinca.w0 * pinca.d0) / (Math.hypot(a.x - b.x, a.y - b.y) || 1)));
      vista.x = pinca.mx - cx * vista.w;
      vista.y = pinca.my - cy * vista.w;
      ajustarVista();
      agendar();
      atualizarBarra();
      return;
    }
    if (!arrasto) return;

    const moveu = Math.hypot(ev.clientX - arrasto.x0, ev.clientY - arrasto.y0) >= LIMIAR_TOQUE;
    const p = noMapa(ev);

    switch (arrasto.tipo) {
      case 'item': {
        if (!arrasto.mudou && !moveu) return;
        arrasto.mudou = true;
        const it = item(arrasto.id);
        it.x = limitar(p[0] + arrasto.ox);
        it.y = limitar(p[1] + arrasto.oy);
        return agendar();
      }
      case 'rota': {
        if (!arrasto.mudou && !moveu) return;
        arrasto.mudou = true;
        const it = item(arrasto.id);
        const dx = p[0] - arrasto.p0[0];
        const dy = p[1] - arrasto.p0[1];
        const xs = arrasto.original.map((q) => q[0]);
        const ys = arrasto.original.map((q) => q[1]);
        const fx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), dx)); // a rota inteira fica dentro do radar
        const fy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
        it.pontos = arrasto.original.map((q) => [limitar(q[0] + fx), limitar(q[1] + fy)]);
        return agendar();
      }
      case 'alca': {
        if (!arrasto.mudou && !moveu) return;
        arrasto.mudou = true;
        item(selecionado).pontos[arrasto.idx] = [limitar(p[0]), limitar(p[1])];
        return agendar();
      }
      case 'traco': {
        const ult = arrasto.pontos.at(-1);
        if (Math.hypot(p[0] - ult[0], p[1] - ult[1]) >= 0.007 * vista.w) {
          arrasto.pontos.push([limitar(p[0]), limitar(p[1])]);
          agendar();
        }
        return;
      }
      case 'fundo':
      case 'toque': {
        if (moveu) arrasto.mudou = true;
        if (arrasto.mudou && vista.w < 1) {
          const r = retangulo();
          vista.x = arrasto.vx - ((ev.clientX - arrasto.x0) / r.width) * vista.w;
          vista.y = arrasto.vy - ((ev.clientY - arrasto.y0) / r.height) * vista.w;
          ajustarVista();
          agendar();
        }
        return;
      }
      default:
    }
  }

  /** Conclui (ou cancela) o gesto em andamento. `ev` é o evento de soltar, quando existe. */
  function encerrarArrasto(ev, { cancelar = false } = {}) {
    const a = arrasto;
    arrasto = null;
    if (!a) return;

    switch (a.tipo) {
      case 'item':
      case 'rota':
      case 'alca':
        if (a.mudou) confirmar();
        break;
      case 'traco':
        if (cancelar) {
          tracando = null;
          desenharRadar();
        } else {
          finalizarTraco(a);
        }
        break;
      case 'toque':
        if (!cancelar && !a.mudou && ev) colocar(noMapa(ev));
        break;
      case 'fundo':
        if (!a.mudou && !cancelar && selecionado) {
          selecionado = null;
          desenharPainel();
          desenharRadar();
        }
        break;
      default:
    }
  }

  function aoSoltar(ev) {
    ponteiros.delete(ev.pointerId);
    if (pinca) {
      if (ponteiros.size < 2) pinca = null;
      return;
    }
    encerrarArrasto(ev, { cancelar: ev.type === 'pointercancel' });
  }

  function aoRolar(ev) {
    ev.preventDefault();
    const [cx, cy] = fracao(ev.clientX, ev.clientY);
    zoomar(ev.deltaY < 0 ? 0.85 : 1 / 0.85, cx, cy);
  }

  el.radar.addEventListener('pointerdown', aoBaixar);
  el.radar.addEventListener('pointermove', aoMover);
  el.radar.addEventListener('pointerup', aoSoltar);
  el.radar.addEventListener('pointercancel', aoSoltar);
  el.radar.addEventListener('wheel', aoRolar, { passive: false });
  el.radar.addEventListener('contextmenu', (ev) => ev.preventDefault());

  // ------------------------------------------------------------ botões e campos
  const acoes = {
    desfazer,
    refazer,
    salvar,
    ferr: (b) => armar(b.dataset.valor),
    concluir() {
      ferramenta = null;
      tracando = null;
      desenharPainel();
      desenharFerramentas();
      desenharRadar();
    },
    excluir,
    dono: (b) => escolherDono(b.dataset.valor),
    estilo(b) {
      const it = selecionado && item(selecionado);
      if (it?.tipo === 'rota') {
        it.estilo = b.dataset.valor;
        confirmar();
      }
    },
    'tipo-granada'(b) {
      const it = selecionado && item(selecionado);
      if (it?.tipo === 'granada') {
        it.granada = b.dataset.valor;
        confirmar();
      }
    },
    'zoom-mais': () => zoomar(0.7),
    'zoom-menos': () => zoomar(1 / 0.7),
    'zoom-reset': () => {
      vista = { x: 0, y: 0, w: 1 };
      desenharRadar();
      atualizarBarra();
    },
    etapa: (b) => irParaEtapa(Number(b.dataset.valor)),
    'nova-etapa': () => inserirEtapa(novaContinuando()),
    'duplicar-etapa'() {
      const copia = clonar(etapa());
      for (const i of copia.itens) i.id = gerarId();
      inserirEtapa(copia);
    },
    'limpar-etapa'() {
      if (!etapa().itens.length) return;
      etapa().itens = [];
      selecionado = null;
      confirmar();
      aviso('Etapa limpa', { acao: 'Desfazer', aoAcionar: desfazer });
    },
    'excluir-etapa'() {
      if (diag.etapas.length < 2) return;
      if (etapa().itens.length && !confirm(`Excluir a etapa ${etapaI + 1} e o que há nela?`)) return;
      diag.etapas.splice(etapaI, 1);
      registrarEdicao();
      irParaEtapa(Math.min(etapaI, diag.etapas.length - 1));
    },
    'escolher-imagem': () => el.arquivo.click(),
    'descartar-rascunho'() {
      rascunhos.descartar(t.id);
      carregar(pontoDePartida(t.id));
      tudo();
      aviso('Alterações não salvas descartadas');
    },
    'voltar-publicada'() {
      if (!confirm('Descartar o que foi salvo neste aparelho e voltar à versão publicada para o time?')) return;
      salvos.remover(t.id);
      rascunhos.descartar(t.id);
      carregar(pontoDePartida(t.id));
      tudo();
      aviso('Voltou à versão publicada');
    },
    'limpar-tudo'() {
      if (!diag.etapas.some((e) => e.itens.length) && diag.etapas.length < 2) return;
      if (!confirm('Apagar todas as etapas deste radar? (Dá para desfazer antes de salvar.)')) return;
      diag = comIds(novoDiagrama(), gerarId);
      etapaI = 0;
      selecionado = null;
      ferramenta = null;
      registrarEdicao();
      tudo();
    },
  };

  raiz.addEventListener('click', (ev) => {
    const botao = ev.target instanceof Element ? ev.target.closest('[data-ed]') : null;
    if (!botao || botao.disabled) return;
    ev.preventDefault();
    acoes[botao.dataset.ed]?.(botao);
  });

  // Enquanto a pessoa digita só o radar muda (os botões ficam como estão, senão o toque no botão seguinte se perde).
  raiz.addEventListener('input', (ev) => {
    const campo = ev.target;
    if (!(campo instanceof HTMLElement)) return;
    if (campo.matches('[data-ed-texto]')) {
      const it = selecionado && item(selecionado);
      if (it?.tipo === 'texto') {
        it.texto = campo.value.slice(0, LIMITES.texto);
        agendar();
      }
    } else if (campo.matches('[data-ed-campo]')) {
      etapa()[campo.dataset.edCampo] = campo.value;
      if (campo.dataset.edCampo === 'titulo') desenharEtapas();
    }
  });

  raiz.addEventListener('change', (ev) => {
    const campo = ev.target;
    if (!(campo instanceof HTMLElement)) return;
    if (campo.matches('[data-ed-texto]')) {
      const it = selecionado && item(selecionado);
      if (it?.tipo === 'texto' && !it.texto.trim()) {
        // texto apagado: o item sai
        etapa().itens.splice(etapa().itens.indexOf(it), 1);
        selecionado = null;
        confirmar();
      } else {
        registrarEdicao();
      }
    } else if (campo.matches('[data-ed-campo]')) {
      registrarEdicao();
    } else if (campo.matches('[data-ed-copiar]')) {
      copiarDe(campo.value);
      campo.value = '';
    }
  });

  /** Traz as etapas de outra tática do mapa (muitas começam do mesmo spawn) para depois ajustar aqui. */
  function copiarDe(id) {
    const origem = id && radarDaTatica(id);
    if (!origem) return;
    if (diag.etapas.some((e) => e.itens.length) && !confirm('Substituir o que há neste radar pelo da outra tática? (Dá para desfazer antes de salvar.)')) return;
    diag = comIds(origem.diagrama, gerarId);
    etapaI = 0;
    selecionado = null;
    ferramenta = null;
    registrarEdicao();
    tudo();
    aviso('Radar copiado. Ajuste o que for diferente.');
  }

  el.arquivo.addEventListener('change', async () => {
    const arquivo = el.arquivo.files?.[0];
    el.arquivo.value = '';
    if (!arquivo) return;
    try {
      aviso('Preparando a imagem…', { fixo: true });
      await salvarImagem(t.mapa, await prepararImagem(arquivo));
      imagem = (await imagemDoMapa(t.mapa))?.url ?? null;
      desenharRadar({ completo: true });
      desenharAlerta();
      desenharMais();
      aviso('Imagem do radar salva neste aparelho');
    } catch (erro) {
      aviso(erro.message || 'Não consegui usar essa imagem');
    }
  });

  // ------------------------------------------------------------------ teclado
  function aoTecla(ev) {
    const alvo = ev.target instanceof Element ? ev.target : null;
    if (alvo?.closest('input, textarea, select, [contenteditable]')) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const tecla = ev.key.toLowerCase();

    if (mod && tecla === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) refazer();
      else desfazer();
    } else if (mod && tecla === 'y') {
      ev.preventDefault();
      refazer();
    } else if (mod && tecla === 's') {
      ev.preventDefault();
      salvar();
    } else if (ev.key === 'Escape') {
      if (ferramenta) acoes.concluir();
      else if (selecionado) {
        selecionado = null;
        desenharPainel();
        desenharRadar();
      }
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selecionado && !ferramenta) {
      ev.preventDefault();
      excluir();
    } else if (ev.key.startsWith('Arrow') && selecionado && !ferramenta) {
      const it = item(selecionado);
      if (!it) return;
      ev.preventDefault();
      const passo = (ev.shiftKey ? 0.02 : 0.005) * vista.w;
      const dx = ev.key === 'ArrowLeft' ? -passo : ev.key === 'ArrowRight' ? passo : 0;
      const dy = ev.key === 'ArrowUp' ? -passo : ev.key === 'ArrowDown' ? passo : 0;
      if (it.tipo === 'rota') it.pontos = it.pontos.map((q) => [limitar(q[0] + dx), limitar(q[1] + dy)]);
      else Object.assign(it, { x: limitar(it.x + dx), y: limitar(it.y + dy) });
      registrarEdicao();
      agendar();
    }
  }
  document.addEventListener('keydown', aoTecla);

  // ------------------------------------------------------------------- partida
  carregar(pontoDePartida(t.id));
  tudo();
  imagemDoMapa(t.mapa).then((img) => {
    if (!vivo || (img?.url ?? null) === imagem) return;
    imagem = img?.url ?? null;
    desenharRadar({ completo: true });
    desenharAlerta();
    desenharMais();
  });

  return () => {
    vivo = false;
    document.removeEventListener('keydown', aoTecla);
  };
}
