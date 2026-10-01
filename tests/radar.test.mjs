// Lógica do radar com dados sintéticos: não depende do conteúdo real das táticas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Historico, MAX_FASES, canonico, comIds, comprimento, deEntrada, etapaContinuando, formatarArquivo, lerArquivo, limitar,
  mesclarRadares, nomeDaFase, novoDiagrama, paraEntrada, posicoesDoDiagrama, sanearDiagrama, simplificarTraco, temConteudo, validarRadares,
} from '../site/js/lib/radar.js';
import { corDaFuncao, desenharCamada, desenharSvg, legendaDosExtras } from '../site/js/lib/radar-svg.js';

const FUNCOES = [
  { id: 'p1', sigla: 'P1', nome: 'Entry', curto: 'Entry' },
  { id: 'p2', sigla: 'P2', nome: 'Suporte 1 - Flash', curto: 'Flash' },
  { id: 'p3', sigla: 'P3', nome: 'Smoke / IGL', curto: 'Smoke/IGL' },
];
const CONTEXTO = { taticas: new Set(['alfa-01', 'alfa-02']), funcoes: new Set(['p1', 'p2', 'p3']), mapas: new Set(['alfa']) };

const exemplo = () => ({
  etapas: [
    {
      titulo: 'Posições',
      nota: 'Todos no spawn.',
      itens: [
        { tipo: 'jogador', funcao: 'p1', x: 0.31, y: 0.74 },
        { tipo: 'jogador', funcao: 'p2', x: 0.35, y: 0.7 },
        { tipo: 'rota', funcao: 'p1', estilo: 'rota', pontos: [[0.31, 0.74], [0.4, 0.6], [0.55, 0.5]] },
        { tipo: 'granada', granada: 'smoke', funcao: 'p2', x: 0.5, y: 0.45 },
        { tipo: 'bomba', x: 0.6, y: 0.4 },
        { tipo: 'texto', texto: 'Palace', x: 0.2, y: 0.2 },
      ],
    },
  ],
});

// ---------------------------------------------------------------- limpeza
test('limitar mantém o valor dentro do radar, com 3 casas', () => {
  assert.equal(limitar(-0.2), 0);
  assert.equal(limitar(1.7), 1);
  assert.equal(limitar(0.123456), 0.123);
  assert.equal(limitar('lixo'), 0);
});

test('sanearDiagrama descarta o que não faz sentido e tira os ids do editor', () => {
  const sujo = {
    etapas: [
      {
        titulo: '  Etapa   1 ',
        itens: [
          { id: 'i1', tipo: 'jogador', funcao: 'p1', x: 2, y: -1, extra: 'x' },
          { tipo: 'jogador', funcao: 'P1 ruim', x: 0.5, y: 0.5 }, // função inválida
          { tipo: 'granada', granada: 'bazuca', x: 0.5, y: 0.5 }, // granada desconhecida
          { tipo: 'rota', funcao: 'p1', pontos: [[0.1, 0.1]] }, // rota com 1 ponto
          { tipo: 'texto', texto: '   ', x: 0.1, y: 0.1 }, // texto vazio
          { tipo: 'nave', x: 0.1, y: 0.1 },
          null,
        ],
      },
      { titulo: 5, itens: 'não é lista' },
    ],
  };
  const limpo = sanearDiagrama(sujo);
  assert.equal(limpo.etapas[0].titulo, 'Etapa 1');
  assert.deepEqual(limpo.etapas[0].itens, [{ tipo: 'jogador', funcao: 'p1', x: 1, y: 0 }]);
  assert.deepEqual(limpo.etapas[1], { titulo: '', nota: '', itens: [] });
  assert.deepEqual(sanearDiagrama(null), { etapas: [] });
});

test('sanearDiagrama respeita os limites (etapas, itens e pontos)', () => {
  const muitas = { etapas: Array.from({ length: 30 }, () => ({ itens: [] })) };
  assert.equal(sanearDiagrama(muitas).etapas.length, MAX_FASES); // o minimapa mostra até 4 fases

  const traco = Array.from({ length: 300 }, (_, i) => [i / 300, Math.sin(i / 7) * 0.2 + 0.5]);
  const rota = sanearDiagrama({ etapas: [{ itens: [{ tipo: 'rota', funcao: 'p1', pontos: traco }] }] }).etapas[0].itens[0];
  assert.ok(rota.pontos.length <= 80 && rota.pontos.length >= 2);
});

test('canonico ignora etapas vazias e temConteudo só vale com itens', () => {
  assert.deepEqual(canonico(novoDiagrama()), { etapas: [] });
  assert.equal(temConteudo(novoDiagrama()), false);
  assert.equal(temConteudo(exemplo()), true);
  assert.equal(canonico({ etapas: [{ titulo: 'Só título', itens: [] }] }).etapas.length, 1);
});

test('comIds dá um id a cada item sem alterar o original', () => {
  let n = 0;
  const original = exemplo();
  const com = comIds(original, () => `i${++n}`);
  assert.equal(com.etapas[0].itens.every((i) => /^i\d+$/.test(i.id)), true);
  assert.equal(original.etapas[0].itens[0].id, undefined);
  assert.deepEqual(sanearDiagrama(com), sanearDiagrama(original)); // o id some na limpeza
});

// -------------------------------------------------------------- traço à mão
test('simplificarTraco: uma reta feita de muitos pontos vira dois', () => {
  const reta = Array.from({ length: 50 }, (_, i) => [i / 49, 0.5]);
  assert.deepEqual(simplificarTraco(reta), [[0, 0.5], [1, 0.5]]);
});

test('simplificarTraco guarda as quinas e o fim do caminho', () => {
  const ele = [];
  for (let i = 0; i <= 20; i++) ele.push([0.1, 0.1 + (i / 20) * 0.5]); // desce
  for (let i = 1; i <= 20; i++) ele.push([0.1 + (i / 20) * 0.5, 0.6]); // vira à direita
  const s = simplificarTraco(ele);
  assert.equal(s.length, 3);
  assert.deepEqual(s[0], [0.1, 0.1]);
  assert.deepEqual(s[1], [0.1, 0.6]);
  assert.deepEqual(s[2], [0.6, 0.6]);
});

test('simplificarTraco respeita o máximo de pontos e comprimento soma os trechos', () => {
  const onda = Array.from({ length: 400 }, (_, i) => [i / 400, 0.5 + Math.sin(i / 3) * 0.1]);
  assert.ok(simplificarTraco(onda, 0.0005, 30).length <= 30);
  assert.equal(Math.round(comprimento([[0, 0], [0.3, 0.4], [0.3, 0.9]]) * 1000) / 1000, 1);
});

// ------------------------------------------------------------------ etapas
test('etapaContinuando leva cada jogador ao fim da própria rota e deixa o resto', () => {
  const e = exemplo().etapas[0];
  const nova = etapaContinuando(e);
  const p1 = nova.itens.find((i) => i.funcao === 'p1');
  const p2 = nova.itens.find((i) => i.funcao === 'p2');
  assert.deepEqual([p1.x, p1.y], [0.55, 0.5]); // fim da rota do P1
  assert.deepEqual([p2.x, p2.y], [0.35, 0.7]); // sem rota: fica onde estava
  assert.equal(nova.itens.some((i) => i.tipo === 'granada' || i.tipo === 'rota' || i.tipo === 'texto'), false);
  assert.equal(nova.itens.some((i) => i.tipo === 'bomba'), true); // a bomba plantada continua lá
});

test('etapaContinuando ignora rotas de arremesso (a granada não anda com o jogador)', () => {
  const e = { itens: [{ tipo: 'jogador', funcao: 'p1', x: 0.1, y: 0.1 }, { tipo: 'rota', funcao: 'p1', estilo: 'arremesso', pontos: [[0.1, 0.1], [0.9, 0.9]] }] };
  const [p1] = etapaContinuando(e).itens;
  assert.deepEqual([p1.x, p1.y], [0.1, 0.1]);
});

// ------------------------------------------------------- desfazer / refazer
test('Historico desfaz, refaz e descarta o futuro depois de uma nova edição', () => {
  const h = new Historico({ v: 0 });
  assert.equal(h.podeDesfazer(), false);
  assert.equal(h.registrar({ v: 0 }), false); // nada mudou
  h.registrar({ v: 1 });
  h.registrar({ v: 2 });
  assert.deepEqual(h.desfazer(), { v: 1 });
  assert.deepEqual(h.desfazer(), { v: 0 });
  assert.equal(h.desfazer(), null);
  assert.deepEqual(h.refazer(), { v: 1 });
  h.registrar({ v: 9 }); // edição nova: o "2" some
  assert.equal(h.podeRefazer(), false);
  assert.deepEqual(h.desfazer(), { v: 1 });
});

test('Historico guarda só o limite de passos', () => {
  const h = new Historico({ v: 0 }, 5);
  for (let v = 1; v <= 20; v++) h.registrar({ v });
  let passos = 0;
  while (h.desfazer()) passos++;
  assert.equal(passos, 4);
});

// ------------------------------------------------- formato do arquivo (posicoes em %)
test('MAX_FASES e os nomes padrão das fases batem com o minimapa', () => {
  assert.equal(MAX_FASES, 4);
  assert.deepEqual([0, 1, 2].map((i) => nomeDaFase(3, i)), ['Setup', 'Execução', 'Plant']);
  assert.deepEqual([0, 1].map((i) => nomeDaFase(2, i)), ['Início', 'Final']);
  assert.equal(nomeDaFase(1, 0), 'Fase 1');
});

const duasFases = () => ({
  etapas: [
    { titulo: '', nota: '', itens: [jog('p2', 0.17, 0.74), jog('p1', 0.22, 0.7), { tipo: 'bomba', x: 0.8, y: 0.2 }] },
    {
      titulo: '',
      nota: 'Smoke cai.',
      itens: [
        jog('p1', 0.62, 0.44),
        { tipo: 'rota', funcao: 'p1', estilo: 'rota', pontos: [[0.22, 0.7], [0.62, 0.44]] },
        { tipo: 'granada', granada: 'smoke', funcao: 'p2', x: 0.5, y: 0.45 },
      ],
    },
  ],
});
const jog = (funcao, x, y) => ({ tipo: 'jogador', funcao, x, y });

test('posicoesDoDiagrama devolve % por fase, na ordem das funções, completando quem faltou numa fase', () => {
  const { posicoes, fases } = posicoesDoDiagrama(duasFases(), ['p1', 'p2', 'p3']);
  assert.deepEqual(Object.keys(posicoes), ['p1', 'p2']); // P1 antes de P2 mesmo tendo sido posicionado depois
  assert.deepEqual(posicoes.p1, [[22, 70], [62, 44]]);
  assert.deepEqual(posicoes.p2, [[17, 74], [17, 74]]); // não foi posicionado na fase 2: fica onde estava
  assert.equal(fases, undefined); // ninguém deu nome às fases: o minimapa usa os padrões
});

test('quem só aparece numa fase posterior vale também para as anteriores (o minimapa precisa de um ponto por fase)', () => {
  const d = { etapas: [{ titulo: '', nota: '', itens: [jog('p1', 0.1, 0.1)] }, { titulo: '', nota: '', itens: [jog('p1', 0.2, 0.2), jog('p3', 0.9, 0.9)] }] };
  assert.deepEqual(posicoesDoDiagrama(d, ['p1', 'p2', 'p3']).posicoes.p3, [[90, 90], [90, 90]]);
});

test('fases: nome escrito vale, as que ficaram sem nome recebem o padrão', () => {
  const d = duasFases();
  d.etapas[1].titulo = 'Execução A';
  assert.deepEqual(posicoesDoDiagrama(d, ['p1', 'p2']).fases, ['Início', 'Execução A']);
});

test('paraEntrada: posicoes, notas e extras (rotas, granadas, bomba) em %, sem repetir os jogadores', () => {
  const e = paraEntrada(duasFases(), ['p1', 'p2']);
  assert.deepEqual(Object.keys(e), ['posicoes', 'notas', 'extras']); // sem "fases": ninguém deu nome
  assert.deepEqual(e.notas, ['', 'Smoke cai.']);
  assert.deepEqual(e.extras[0], [{ tipo: 'bomba', x: 80, y: 20 }]);
  assert.deepEqual(e.extras[1][0], { tipo: 'rota', funcao: 'p1', estilo: 'rota', pontos: [[22, 70], [62, 44]] });
  assert.deepEqual(e.extras[1][1], { tipo: 'granada', granada: 'smoke', funcao: 'p2', x: 50, y: 45 });
  assert.equal(paraEntrada(novoDiagrama()), null);
});

test('paraEntrada só com extras (sem jogadores) ainda vale', () => {
  const e = paraEntrada({ etapas: [{ titulo: '', nota: '', itens: [{ tipo: 'bomba', x: 0.5, y: 0.5 }] }] });
  assert.deepEqual(e.posicoes, {});
  assert.equal(e.extras[0].length, 1);
});

test('ida e volta: diagrama → entrada → diagrama não perde nada (com os jogadores completados)', () => {
  const original = duasFases();
  original.etapas[0].titulo = 'Setup';
  original.etapas[1].titulo = 'Execução';
  const volta = deEntrada(paraEntrada(original, ['p1', 'p2']));
  const jogadores = (d, i) => d.etapas[i].itens.filter((x) => x.tipo === 'jogador').map((x) => `${x.funcao}:${x.x},${x.y}`).sort();
  assert.deepEqual(jogadores(volta, 0), jogadores(original, 0));
  assert.deepEqual(jogadores(volta, 1), ['p1:0.62,0.44', 'p2:0.17,0.74']); // P2 completado na fase 2
  assert.deepEqual(volta.etapas.map((e) => e.titulo), ['Setup', 'Execução']);
  assert.equal(volta.etapas[1].nota, 'Smoke cai.');
  const extras = (d, i) => d.etapas[i].itens.filter((x) => x.tipo !== 'jogador');
  assert.deepEqual(extras(volta, 1), extras(original, 1));
  assert.deepEqual(extras(volta, 0), extras(original, 0));
});

test('deEntrada aproveita o `posicoes` escrito à mão no playbook.json (e ignora o que não presta)', () => {
  const d = deEntrada({
    posicoes: { p1: [[22, 70], [62, 44], [79, 22]], p2: [[17, 74], [57, 48], [73, 27]], 'Função ruim': [[1, 1], [2, 2], [3, 3]], p3: 'não é lista' },
    fases: ['Setup', 'Execução', 'Plant'],
  });
  assert.equal(d.etapas.length, 3);
  assert.deepEqual(d.etapas.map((e) => e.titulo), ['Setup', 'Execução', 'Plant']);
  assert.deepEqual(d.etapas[1].itens.map((i) => [i.funcao, i.x, i.y]), [['p1', 0.62, 0.44], ['p2', 0.57, 0.48]]);
  assert.deepEqual(deEntrada(null), { etapas: [] });
  assert.deepEqual(deEntrada({ posicoes: {} }), { etapas: [] });
  assert.equal(deEntrada({ posicoes: { p1: Array.from({ length: 9 }, () => [1, 1]) } }).etapas.length, MAX_FASES);
});

test('mesclarRadares: o salvo no aparelho vence o do site, por tática', () => {
  const site = { 'alfa-01': { etapas: [{ itens: [] }] }, 'alfa-02': 'do site' };
  const local = { 'alfa-01': 'local' };
  assert.deepEqual(mesclarRadares(site, local), { 'alfa-01': 'local', 'alfa-02': 'do site' });
});

test('formatarArquivo escreve o formato posicoes: JSON válido, um jogador por linha e um extra por linha', () => {
  const texto = formatarArquivo({
    imagens: { alfa: 'img/radar/alfa.webp' },
    radares: { 'alfa-02': duasFases(), 'alfa-01': novoDiagrama(), 'alfa-03': { etapas: [{ titulo: 'x', itens: [] }] } },
    funcoes: ['p1', 'p2'],
  });
  const lido = JSON.parse(texto);
  assert.equal(lido.versao, 1);
  assert.deepEqual(Object.keys(lido.radares), ['alfa-02']); // vazios ficam de fora
  assert.deepEqual(lido.radares['alfa-02'].posicoes.p1, [[22, 70], [62, 44]]);
  assert.match(texto, /"p1": \[\[22, 70\], \[62, 44\]\]/); // como no README: [[22, 70], [62, 44]]
  assert.equal(texto.split('\n').filter((l) => l.includes('"tipo"')).length, 3); // bomba, rota e granada, um por linha
  assert.ok(texto.endsWith('}\n'));
});

test('formatarArquivo vazio continua sendo um arquivo válido', () => {
  assert.deepEqual(JSON.parse(formatarArquivo()), { versao: 1, imagens: {}, radares: {} });
});

test('o arquivo escrito é lido de volta igual (formatar → JSON → lerArquivo)', () => {
  const arquivo = formatarArquivo({ radares: { 'alfa-02': duasFases() }, funcoes: ['p1', 'p2'] });
  const { radares } = lerArquivo(JSON.parse(arquivo));
  assert.equal(radares['alfa-02'].etapas.length, 2);
  assert.equal(radares['alfa-02'].etapas[1].itens.filter((i) => i.tipo === 'jogador').length, 2);
});

test('lerArquivo aproveita o que presta e ignora o resto', () => {
  const lido = lerArquivo({
    imagens: { alfa: 'img/radar/alfa.webp', ruim: 'https://exemplo.com/x.png', 'Mapa Ruim': 'img/a.png' },
    radares: { 'alfa-01': { posicoes: { p1: [[10, 10], [20, 20]] } }, 'alfa-02': { posicoes: {} }, 'ID ruim': { posicoes: { p1: [[10, 10], [20, 20]] } } },
  });
  assert.deepEqual(Object.keys(lido.imagens), ['alfa']);
  assert.deepEqual(Object.keys(lido.radares), ['alfa-01']);
  assert.deepEqual(lerArquivo(null), { imagens: {}, radares: {} });
});

// ------------------------------------------------------------------ validação
const valido = () => ({
  versao: 1,
  imagens: { alfa: 'img/radar/alfa.webp' },
  radares: {
    'alfa-01': {
      fases: ['Setup', 'Execução'],
      posicoes: { p1: [[22, 70], [62, 44]], p2: [[17, 74], [57, 48]] },
      notas: ['', 'Smoke cai.'],
      extras: [
        [{ tipo: 'bomba', x: 80, y: 20 }],
        [
          { tipo: 'rota', funcao: 'p1', estilo: 'rota', pontos: [[22, 70], [62, 44]] },
          { tipo: 'granada', granada: 'smoke', funcao: 'p2', x: 50, y: 45 },
          { tipo: 'texto', texto: 'Palace', x: 20, y: 20 },
        ],
      ],
    },
  },
});

test('validarRadares aceita um arquivo correto, inclusive o que o próprio editor escreve', () => {
  const { erros, avisos } = validarRadares(valido(), CONTEXTO);
  assert.deepEqual(erros, []);
  assert.deepEqual(avisos, []);
  const escrito = JSON.parse(formatarArquivo({ radares: { 'alfa-01': duasFases() }, funcoes: ['p1', 'p2', 'p3'] }));
  assert.deepEqual(validarRadares(escrito, CONTEXTO).erros, []);
});

test('validarRadares explica cada erro', () => {
  const casos = [
    [(d) => { d.versao = 2; }, /versao/],
    [(d) => { d.imagens.alfa = 'https://x.com/a.png'; }, /caminho relativo/],
    [(d) => { d.imagens.zeta = 'img/z.png'; }, /mapa "zeta"/],
    [(d) => { d.radares['alfa-01'].posicoes.p1[0][0] = 150; }, /posicoes\."p1" precisa ter de 1 a 4 pontos/],
    [(d) => { d.radares['alfa-01'].posicoes.p9 = [[1, 1], [2, 2]]; }, /posicoes\."p9" não é uma função/],
    [(d) => { d.radares['alfa-01'].posicoes.p2 = [[1, 1]]; }, /mesmo número de fases/],
    [(d) => { d.radares['alfa-01'].fases = ['só uma']; }, /mesmo número de fases/],
    [(d) => { d.radares['alfa-01'].extras.pop(); }, /mesmo número de fases/],
    [(d) => { d.radares['alfa-01'].fases = ['', 'x']; }, /cada nome em "fases"/],
    [(d) => { d.radares['alfa-01'].extras[0][0].x = 101; }, /"x" precisa ser um número de 0 a 100/],
    [(d) => { d.radares['alfa-01'].extras[1][1].granada = 'bazuca'; }, /"granada" precisa ser/],
    [(d) => { d.radares['alfa-01'].extras[1][0].pontos = [[1, 1]]; }, /"pontos" precisa ter/],
    [(d) => { d.radares['alfa-01'].extras[1][2].texto = ''; }, /"texto" precisa ter/],
    [(d) => { d.radares['alfa-01'].extras[1][1].funcao = 'p9'; }, /função "p9"/],
    [(d) => { d.radares['alfa-01'].extras[0].push({ tipo: 'jogador', funcao: 'p1', x: 1, y: 1 }); }, /jogadores vão em "posicoes"/],
    [(d) => { d.radares['alfa-01'].extras[0].push({ tipo: 'nave' }); }, /"tipo" precisa ser/],
    [(d) => { d.radares['alfa-01'] = { fases: ['a', 'b'] }; }, /sem nenhuma posição nem extra/],
    [(d) => { d.radares['alfa-01'] = []; }, /precisa ser um objeto/],
    [(d) => { d.radares = []; }, /"radares" precisa ser um objeto/],
  ];
  for (const [quebrar, esperado] of casos) {
    const dados = valido();
    quebrar(dados);
    const { erros } = validarRadares(dados, CONTEXTO);
    assert.ok(erros.some((e) => esperado.test(e)), `esperava ${esperado}, veio: ${JSON.stringify(erros)}`);
  }
});

test('radar de tática que saiu do playbook vira só um aviso (não derruba o deploy)', () => {
  const dados = valido();
  dados.radares['alfa-99'] = valido().radares['alfa-01'];
  const { erros, avisos } = validarRadares(dados, CONTEXTO);
  assert.deepEqual(erros, []);
  assert.ok(avisos.some((a) => a.includes('alfa-99')));
});

// ------------------------------------------------------------------- desenho
test('desenharSvg desenha cada peça e escapa o texto vindo dos dados', () => {
  const etapa = exemplo().etapas[0];
  etapa.itens.push({ tipo: 'texto', texto: '<img src=x onerror=alert(1)>', x: 0.5, y: 0.9 });
  const svg = desenharSvg(etapa, { funcoes: FUNCOES, imagem: 'img/radar/alfa.webp' });
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('href="img/radar/alfa.webp"'));
  assert.equal((svg.match(/class="rd-item rd-jogador/g) ?? []).length, 2);
  assert.ok(svg.includes('rd-seta') && svg.includes('rd-bomba') && svg.includes('rd-granada'));
  assert.ok(svg.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!svg.includes('<img'));
  assert.ok(!svg.includes('data-item')); // fora do editor, nada de áreas de toque
});

test('desenharSvg sem imagem mostra a grade e avisa', () => {
  const svg = desenharSvg({ itens: [] }, { funcoes: FUNCOES });
  assert.ok(svg.includes('Sem imagem do radar') && !svg.includes('<image'));
});

test('desenharSvg no editor marca os itens, a seleção e as alças da rota', () => {
  const etapa = comIds(exemplo(), (() => { let n = 0; return () => `i${++n}`; })()).etapas[0];
  const rota = etapa.itens.find((i) => i.tipo === 'rota');
  const svg = desenharSvg(etapa, { funcoes: FUNCOES, editor: true, selecionado: rota.id });
  assert.equal((svg.match(/data-item=/g) ?? []).length, etapa.itens.length);
  assert.equal((svg.match(/data-alca=/g) ?? []).length, rota.pontos.length - 1); // o começo está preso ao P1
  const semSel = desenharSvg(etapa, { funcoes: FUNCOES, editor: true });
  assert.ok(!semSel.includes('data-alca'));
});

test('desenharCamada sem jogadores deixa só rotas, granadas, bomba e textos (o minimapa desenha os blips)', () => {
  const camada = desenharCamada(exemplo().etapas[0], { funcoes: FUNCOES, semJogadores: true });
  assert.ok(!camada.includes('rd-jogador'));
  assert.ok(camada.includes('rd-rota') && camada.includes('rd-granada') && camada.includes('rd-bomba') && camada.includes('Palace'));
  assert.ok(desenharCamada(exemplo().etapas[0], { funcoes: FUNCOES }).includes('rd-jogador'));
});

test('desenharSvg com "minha função" esmaece os outros jogadores, mas não os textos', () => {
  const svg = desenharSvg(exemplo().etapas[0], { funcoes: FUNCOES, destaque: 'p1' });
  assert.equal((svg.match(/rd-esmaece/g) ?? []).length, 2); // granada do P2 e jogador P2
  assert.ok(svg.includes('rd-voce'));
});

test('o zoom do editor muda o recorte e mantém o tamanho dos marcadores na tela', () => {
  const etapa = { itens: [{ tipo: 'jogador', funcao: 'p1', x: 0.5, y: 0.5 }] };
  const normal = desenharSvg(etapa, { funcoes: FUNCOES });
  const zoom = desenharSvg(etapa, { funcoes: FUNCOES, vista: { x: 0.25, y: 0.25, w: 0.5 } });
  assert.ok(normal.includes('viewBox="0 0 1000 1000"') && normal.includes('scale(1)'));
  assert.ok(zoom.includes('viewBox="250 250 500 500"') && zoom.includes('scale(0.5)'));
});

test('cores: as mesmas dos blips do minimapa, uma por função, e função desconhecida fica neutra', () => {
  const cores = FUNCOES.map((f) => corDaFuncao(FUNCOES, f.id));
  assert.deepEqual(cores, ['#4aa8ff', '#3ddc97', '#ffd23f']); // --p1, --p2, --p3 de app.css
  assert.equal(corDaFuncao(FUNCOES, 'zzz'), '#cbd5e1');
});

test('legendaDosExtras lista só o que aparece nos extras de todas as fases', () => {
  const l = legendaDosExtras(duasFases().etapas);
  assert.deepEqual(l.granadas, ['smoke']);
  assert.equal(l.temBomba, true);
  assert.equal(l.temRota, true);
  assert.equal(l.temArremesso, false);
  assert.deepEqual(legendaDosExtras(null), { granadas: [], temBomba: false, temArremesso: false, temRota: false });
});

test('a rota que sai de um jogador não tem alça no primeiro ponto (fica presa ao jogador)', () => {
  const etapa = comIds(exemplo(), (() => { let n = 0; return () => `i${++n}`; })()).etapas[0];
  const rota = etapa.itens.find((i) => i.tipo === 'rota'); // começa em (0.31, 0.74), onde está o P1
  const svg = desenharSvg(etapa, { funcoes: FUNCOES, editor: true, selecionado: rota.id });
  assert.equal((svg.match(/data-alca=/g) ?? []).length, rota.pontos.length - 1);
  assert.ok(!svg.includes('data-alca="0"'));

  // se o começo não está em cima de um jogador, a alça existe
  const solta = { ...etapa, itens: etapa.itens.filter((i) => i.tipo !== 'jogador') };
  const svg2 = desenharSvg(solta, { funcoes: FUNCOES, editor: true, selecionado: rota.id });
  assert.equal((svg2.match(/data-alca=/g) ?? []).length, rota.pontos.length);
});
