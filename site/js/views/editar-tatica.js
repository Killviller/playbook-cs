// Edição do texto de uma tática (#/tatica/mirage-02/editar). Tática melhora com o tempo: o texto novo vale por cima do
// playbook.json (o texto do PDF continua guardado e dá para voltar a ele). Salvar fica neste aparelho; o rascunho é
// guardado sozinho. Para o time ver, a edição vai para o repositório (Editor → Publicar para o time).
import { html, bool } from '../lib/html.js';
import { SITES, LIMITES, limparValores, validarFormulario } from '../lib/edicoes.js';
import {
  pontoDePartida, rascunhos, salvas, salvarValores, valoresOriginais, valoresPublicados, voltarAoPublicado,
} from '../edicoes.js';
import { aviso } from '../shell.js';
import { aposSalvar } from '../publicacao-ui.js';
import { icone } from '../ui.js';

const clonar = (v) => JSON.parse(JSON.stringify(v));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function editarTatica({ index, params }) {
  const t = index.taticasById.get(params.id);
  if (!t) return null; // main mostra "não encontrada"

  return {
    titulo: `Editar · ${t.chamada}`,
    tituloDocumento: `Editar ${t.chamada}`,
    voltar: `/tatica/${t.id}`,
    semAbas: true,
    acoes: html`<a class="icon-btn" href="#/tatica/${t.id}" aria-label="Ver a tática" title="Ver a tática">${icone('eye')}</a>`,
    corpo: html`
      <div class="edicao" data-edicao>
        <div class="edicao__barra">
          <span class="edicao__estado" data-ref="estado" role="status"></span>
          <button type="button" class="btn btn--sm" data-ed="salvar" data-ref="salvar">${icone('check')}<span data-ref="salvar-texto">Salvo</span></button>
        </div>
        <div data-r="alerta"></div>
        <p class="intro">Melhore o texto desta tática. O que estava antes fica guardado: cada campo alterado mostra o <strong>Antes</strong> e
          um botão para restaurar. Para o time ver a mudança, publique depois (Editor → Texto).</p>
        <div data-r="formulario"></div>
        <section class="cartao edicao__acoes" data-r="acoes" aria-label="Mais opções"></section>
      </div>`,
    montar: (main) => iniciar(main.querySelector('[data-edicao]'), { index, t }),
  };
}

function iniciar(raiz, { index, t }) {
  const id = t.id;
  const q = (n) => raiz.querySelector(`[data-r="${n}"]`);
  const ref = (n) => raiz.querySelector(`[data-ref="${n}"]`);
  const el = { alerta: q('alerta'), formulario: q('formulario'), acoes: q('acoes') };
  const funcoes = index.funcoes.filter((f) => t.funcoes[f.id] !== undefined);

  let valores;
  let salvosLimpos = ''; // JSON do último salvo (já limpo): serve para saber se há alteração pendente
  let recuperado = false;
  let temporizador = null;
  let vivo = true;

  const publicado = valoresPublicados(id);
  const original = valoresOriginais(id);

  // ------------------------------------------------------------ valores por chave
  // chaves: titulo, objetivo, economia, posPlant, planoB, funcoes.p1…
  const ler = (v, chave) => (chave.startsWith('funcoes.') ? v.funcoes[chave.slice(8)] : v[chave]) ?? '';
  const escrever = (chave, valor) => {
    if (chave.startsWith('funcoes.')) valores.funcoes[chave.slice(8)] = valor;
    else valores[chave] = valor;
  };
  const sujo = () => JSON.stringify(limparValores(valores)) !== salvosLimpos;
  const nomeDoTipo = (tid) => index.tiposById.get(tid)?.nome ?? tid;

  function carregar(partida) {
    valores = clonar(partida.inicial);
    salvosLimpos = JSON.stringify(limparValores(partida.salvos));
    recuperado = partida.recuperado;
  }

  // ------------------------------------------------------------------- desenho
  const campo = ({ chave, rotulo, linhas = 3, curto = false }) => html`
    <div class="campo campo--edicao" data-campo="${chave}">
      <label class="campo__rotulo" for="ed-${chave}">${rotulo}</label>
      ${curto
        ? html`<input class="campo__input" id="ed-${chave}" data-ed-campo="${chave}" maxlength="${LIMITES.titulo}" value="${ler(valores, chave)}" autocomplete="off">`
        : html`<textarea class="campo__input campo__input--auto" id="ed-${chave}" data-ed-campo="${chave}" rows="${linhas}" maxlength="${LIMITES.texto}">${ler(valores, chave)}</textarea>`}
      <p class="campo__erro" data-erro hidden></p>
      <div class="campo__antes" data-antes hidden>
        <p><strong>Antes:</strong> <span data-antes-texto>${ler(publicado, chave) || '(vazio)'}</span></p>
        <button type="button" class="btn btn--sm" data-ed="restaurar" data-campo="${chave}">Restaurar</button>
      </div>
    </div>`;

  function htmlTipos() {
    const marcados = valores.tipos;
    return html`
      <div class="campo campo--edicao" data-campo="tipos">
        <span class="campo__rotulo" id="ed-tipos">Tipos</span>
        <div class="chips chips--quebra" role="group" aria-labelledby="ed-tipos">${index.tipos.map(
          (tp) => html`<button type="button" class="chip chip--tipo" style="--tc:${tp.cor ?? '#6b6b6b'}" data-ed="tipo" data-valor="${tp.id}" aria-pressed="${bool(marcados.includes(tp.id))}"><span class="ponto"></span>${tp.nome}</button>`,
        )}</div>
        ${marcados.length > 1
          ? html`<span class="campo__rotulo" id="ed-principal">Tipo principal (agrupa em "Chamar")</span>
              <div class="seg editor__seg" role="radiogroup" aria-labelledby="ed-principal">${marcados.map(
                (tid, i) => html`<button type="button" role="radio" class="seg__op" data-ed="principal" data-valor="${tid}" aria-checked="${bool(i === 0)}">${nomeDoTipo(tid)}</button>`,
              )}</div>`
          : ''}
        <p class="campo__erro" data-erro hidden></p>
        <div class="campo__antes" data-antes hidden>
          <p><strong>Antes:</strong> <span data-antes-texto>${publicado.tipos.map(nomeDoTipo).join(' + ') || '(nenhum)'}</span></p>
          <button type="button" class="btn btn--sm" data-ed="restaurar" data-campo="tipos">Restaurar</button>
        </div>
      </div>
      <div class="campo campo--edicao" data-campo="alvo">
        <span class="campo__rotulo" id="ed-alvo">Site que a tática ataca</span>
        <div class="chips chips--quebra" role="group" aria-labelledby="ed-alvo">${SITES.map(
          (s) => html`<button type="button" class="chip chip--site" data-ed="alvo" data-valor="${s}" aria-pressed="${bool(valores.alvo.includes(s))}">Site ${s}</button>`,
        )}</div>
        <p class="muted campo__dica">Deixe sem site quando ele é decidido na hora (a tática não fica marcada com A nem B).</p>
        <div class="campo__antes" data-antes hidden>
          <p><strong>Antes:</strong> <span data-antes-texto>${publicado.alvo.length ? publicado.alvo.map((s) => `Site ${s}`).join(' + ') : 'sem site'}</span></p>
          <button type="button" class="btn btn--sm" data-ed="restaurar" data-campo="alvo">Restaurar</button>
        </div>
      </div>`;
  }

  function desenharFormulario() {
    el.formulario.innerHTML = String(html`
      <section class="cartao" aria-label="Identificação">
        ${campo({ chave: 'titulo', rotulo: 'Título', curto: true })}
        <div data-r="tipos">${htmlTipos()}</div>
      </section>
      <section class="cartao" aria-label="Objetivo e economia">
        ${campo({ chave: 'objetivo', rotulo: 'Objetivo', linhas: 2 })}
        ${campo({ chave: 'economia', rotulo: 'Economia (opcional)', linhas: 1 })}
      </section>
      <section class="cartao" aria-label="O que cada um faz">
        <h2 class="cartao__titulo">O que cada um faz</h2>
        ${funcoes.map((f) => campo({ chave: `funcoes.${f.id}`, rotulo: `${f.sigla} · ${f.nome}`, linhas: 3 }))}
      </section>
      <section class="cartao" aria-label="Depois do plant">
        <h2 class="cartao__titulo">Depois do plant</h2>
        ${campo({ chave: 'posPlant', rotulo: 'Pós-plant (opcional)', linhas: 2 })}
        ${campo({ chave: 'planoB', rotulo: 'Plano B (opcional)', linhas: 2 })}
      </section>`);
    el.formulario.querySelectorAll('textarea').forEach(ajustar);
    atualizarMarcas();
  }

  function desenharTipos() {
    q('tipos').innerHTML = String(htmlTipos());
    atualizarMarcas();
  }

  function htmlAlerta() {
    return recuperado && sujo()
      ? html`<div class="editor__alerta" role="status"><span>Recuperamos alterações desta tática que ainda não tinham sido salvas.</span>
          <button type="button" class="btn btn--sm" data-ed="desfazer-pendentes">Descartar</button></div>`
      : '';
  }

  function desenharAcoes() {
    const mudouDoOriginal = !igual(limparValores(valores), limparValores(original));
    el.acoes.innerHTML = String(html`
      <h2 class="cartao__titulo">Mais opções</h2>
      <div class="botoes">
        ${sujo() ? html`<button type="button" class="btn btn--sm" data-ed="desfazer-pendentes">Desfazer alterações não salvas</button>` : ''}
        ${salvas.tem(id) ? html`<button type="button" class="btn btn--sm" data-ed="voltar-publicada">Voltar à versão publicada</button>` : ''}
        ${mudouDoOriginal ? html`<button type="button" class="btn btn--sm btn--perigo" data-ed="voltar-original">Voltar ao texto original do PDF</button>` : ''}
      </div>
      <p class="muted">Para o time ver o que você salvou, publique em <a class="link" href="#/editor?modo=texto&mapa=${t.mapa}">Editor → Texto → Publicar para o time</a>.</p>`);
  }

  /** Auto-ajusta a altura da caixa de texto ao que está escrito. */
  function ajustar(area) {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  }

  /** Marca os campos que diferem do publicado, mostra o "Antes" e atualiza o botão Salvar. Não mexe nos campos de texto. */
  function atualizarMarcas() {
    const limpos = limparValores(valores);
    const mudou = (chave) => (chave === 'tipos' || chave === 'alvo' ? !igual(limpos[chave], publicado[chave]) : ler(limpos, chave) !== ler(publicado, chave));
    for (const bloco of raiz.querySelectorAll('.campo--edicao[data-campo]')) {
      const chave = bloco.dataset.campo;
      const diferente = mudou(chave);
      bloco.classList.toggle('campo--alterado', diferente);
      bloco.querySelector('[data-antes]').hidden = !diferente;
    }
    const pendente = sujo();
    const alterados = ['titulo', 'tipos', 'alvo', 'objetivo', 'economia', 'posPlant', 'planoB', ...funcoes.map((f) => `funcoes.${f.id}`)].filter(mudou).length;
    const botao = ref('salvar');
    botao.classList.toggle('btn--primario', pendente);
    ref('salvar-texto').textContent = pendente ? 'Salvar' : 'Salvo';
    ref('estado').textContent = pendente
      ? 'Alterações não salvas'
      : alterados
        ? `${alterados} ${alterados === 1 ? 'campo alterado' : 'campos alterados'} · ainda não publicado`
        : 'Sem alterações';
    ref('estado').classList.toggle('edicao__estado--pendente', pendente);
  }

  function mostrarErros(erros) {
    for (const bloco of raiz.querySelectorAll('.campo--edicao[data-campo]')) {
      const p = bloco.querySelector('[data-erro]');
      if (!p) continue;
      const msg = erros[bloco.dataset.campo];
      p.textContent = msg ?? '';
      p.hidden = !msg;
      bloco.classList.toggle('campo--erro', !!msg);
    }
  }

  // ----------------------------------------------------------- rascunho e salvar
  function guardarRascunho() {
    clearTimeout(temporizador);
    temporizador = null;
    if (sujo()) rascunhos.guardar(id, valores);
    else rascunhos.descartar(id);
  }

  const agendarRascunho = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(guardarRascunho, 250);
  };

  function aoMudar() {
    atualizarMarcas();
    desenharAcoes();
    el.alerta.innerHTML = String(htmlAlerta());
    agendarRascunho();
  }

  function salvar() {
    if (!sujo()) return aviso('Nada novo para salvar');
    const limpos = limparValores(valores);
    const erros = validarFormulario(limpos, funcoes.map((f) => f.id));
    mostrarErros(erros);
    const primeiro = Object.keys(erros)[0];
    if (primeiro) {
      aviso('Confira os campos marcados em vermelho');
      raiz.querySelector(`.campo--edicao[data-campo="${primeiro}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const { mudou } = salvarValores(id, limpos);
    rascunhos.descartar(id);
    clearTimeout(temporizador);
    valores = clonar(limpos);
    salvosLimpos = JSON.stringify(limpos);
    recuperado = false;
    document.dispatchEvent(new Event('pb:indice')); // as próximas telas já usam o texto novo
    for (const area of raiz.querySelectorAll('[data-ed-campo]')) area.value = ler(valores, area.dataset.edCampo); // mostra o texto já arrumado
    raiz.querySelectorAll('textarea').forEach(ajustar);
    desenharTipos();
    aoMudar();
    return aposSalvar({
      tipo: 'texto',
      id,
      textoSalvo: mudou ? 'Texto salvo só neste aparelho.' : 'Volta ao texto original salva só neste aparelho.',
      textoPublicado: mudou ? 'Texto publicado para todos.' : 'Texto original restaurado para todos.',
    });
  }

  function recarregar(mensagem) {
    carregar(pontoDePartida(id));
    mostrarErros({});
    desenharFormulario();
    desenharAcoes();
    el.alerta.innerHTML = String(htmlAlerta());
    if (mensagem) aviso(mensagem);
  }

  // ------------------------------------------------------------------- ações
  const acoes = {
    salvar,

    tipo(b) {
      const tid = b.dataset.valor;
      valores.tipos = valores.tipos.includes(tid) ? valores.tipos.filter((x) => x !== tid) : [...valores.tipos, tid];
      desenharTipos();
      aoMudar();
    },

    principal(b) {
      const tid = b.dataset.valor;
      valores.tipos = [tid, ...valores.tipos.filter((x) => x !== tid)];
      desenharTipos();
      aoMudar();
    },

    alvo(b) {
      const s = b.dataset.valor;
      valores.alvo = SITES.filter((x) => (x === s ? !valores.alvo.includes(x) : valores.alvo.includes(x)));
      desenharTipos();
      aoMudar();
    },

    restaurar(b) {
      const chave = b.dataset.campo;
      if (chave === 'tipos' || chave === 'alvo') {
        valores[chave] = clonar(publicado[chave]);
        desenharTipos();
      } else {
        escrever(chave, ler(publicado, chave));
        const area = raiz.querySelector(`[data-ed-campo="${chave}"]`);
        area.value = ler(valores, chave);
        if (area.tagName === 'TEXTAREA') ajustar(area);
      }
      aoMudar();
    },

    'desfazer-pendentes'() {
      rascunhos.descartar(id);
      recarregar('Alterações não salvas descartadas');
    },

    'voltar-publicada'() {
      if (!confirm('Descartar o que foi salvo neste aparelho e voltar ao texto publicado para o time?')) return;
      voltarAoPublicado(id);
      document.dispatchEvent(new Event('pb:indice'));
      recarregar('Voltou à versão publicada');
    },

    'voltar-original'() {
      // só preenche o formulário com o texto do PDF: vale depois de Salvar (e dá para desfazer antes)
      valores = clonar(original);
      mostrarErros({});
      desenharFormulario();
      aoMudar();
      aviso('Texto original do PDF carregado. Toque em Salvar para valer.');
    },
  };

  raiz.addEventListener('click', (ev) => {
    const botao = ev.target instanceof Element ? ev.target.closest('[data-ed]') : null;
    if (!botao || botao.disabled) return;
    ev.preventDefault();
    acoes[botao.dataset.ed]?.(botao);
  });

  raiz.addEventListener('input', (ev) => {
    const campoEl = ev.target;
    if (!(campoEl instanceof HTMLElement) || !campoEl.matches('[data-ed-campo]')) return;
    escrever(campoEl.dataset.edCampo, campoEl.value);
    if (campoEl.tagName === 'TEXTAREA') ajustar(campoEl);
    const erro = campoEl.closest('.campo--edicao')?.querySelector('[data-erro]');
    if (erro && !erro.hidden) {
      erro.hidden = true;
      campoEl.closest('.campo--edicao').classList.remove('campo--erro');
    }
    aoMudar();
  });

  function aoTecla(ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      salvar();
    }
  }
  document.addEventListener('keydown', aoTecla);
  // o navegador pode fechar a página sem aviso: grava o rascunho ao esconder a aba
  const aoEsconder = () => {
    if (document.visibilityState === 'hidden') guardarRascunho();
  };
  document.addEventListener('visibilitychange', aoEsconder);

  // ------------------------------------------------------------------- partida
  carregar(pontoDePartida(id));
  desenharFormulario();
  desenharAcoes();
  el.alerta.innerHTML = String(htmlAlerta());

  return () => {
    if (!vivo) return;
    vivo = false;
    guardarRascunho();
    document.removeEventListener('keydown', aoTecla);
    document.removeEventListener('visibilitychange', aoEsconder);
  };
}
