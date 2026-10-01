import test from 'node:test';
import assert from 'node:assert/strict';
import { ehObjetivo, normalizar, pad2, separarContagem } from '../site/js/lib/text.js';
import { bool, esc, html, raw } from '../site/js/lib/html.js';

test('separarContagem destaca só a contagem de jogadores no começo da linha', () => {
  assert.deepEqual(separarContagem('2 jogadores pressionam Mid.'), { count: '2', rest: 'jogadores pressionam Mid.' });
  assert.deepEqual(separarContagem('3–4 jogadores Long.'), { count: '3–4', rest: 'jogadores Long.' });
  assert.deepEqual(separarContagem('4-5 B Main'), { count: '4-5', rest: 'B Main' });
  assert.deepEqual(separarContagem('1 Mid.'), { count: '1', rest: 'Mid.' });
});

test('separarContagem ignora números que não estão no começo', () => {
  for (const linha of ['Entrada com 4–5.', 'Jogar default por 45–50 segundos.', 'Não executar até ~30 segundos.', '5']) {
    assert.equal(separarContagem(linha).count, null, linha);
    assert.equal(separarContagem(linha).rest, linha);
  }
});

test('ehObjetivo reconhece as variações usadas no PDF', () => {
  assert.ok(ehObjetivo('Objetivo: descobrir a distribuição CT.'));
  assert.ok(ehObjetivo('O objetivo é impedir que os CTs defendam B de apenas uma posição.'));
  assert.ok(ehObjetivo('Primeiro objetivo é eliminar as posições capazes de travar a entrada.'));
  assert.ok(!ehObjetivo('Entrada rápida em B.'));
});

test('normalizar tira acento e caixa', () => {
  assert.equal(normalizar('Explosão A — Água'), 'explosao a — agua');
  assert.equal(normalizar(null), '');
});

test('pad2 completa com zero', () => {
  assert.equal(pad2(4), '04');
  assert.equal(pad2(10), '10');
});

test('html escapa texto por padrão', () => {
  const nome = '<img src=x onerror=alert(1)> & "aspas"';
  assert.equal(String(html`<p>${nome}</p>`), '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;aspas&quot;</p>');
});

test('html aceita fragmentos html``, listas e ignora false/null', () => {
  const item = (n) => html`<li>${n}</li>`;
  assert.equal(String(html`<ul>${[1, 2].map(item)}${false}${null}${undefined}</ul>`), '<ul><li>1</li><li>2</li></ul>');
  assert.equal(String(html`<b>${0}</b>`), '<b>0</b>');
});

test('raw é a única forma de inserir HTML sem escape', () => {
  assert.equal(String(html`<p ${raw('class="x"')}>${'<b>'}</p>`), '<p class="x">&lt;b&gt;</p>');
  assert.equal(esc(`'`), '&#39;');
  assert.equal(bool(0), 'false');
  assert.equal(bool('x'), 'true');
});
