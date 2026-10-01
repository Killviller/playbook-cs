import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, pad2 } from '../site/js/lib/text.js';
import { bool, esc, html, raw } from '../site/js/lib/html.js';

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
