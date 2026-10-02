/* Aplica tema e tamanho do texto antes da primeira pintura (evita piscar).
   É um arquivo à parte (e não um <script> dentro do index.html) porque a Content-Security-Policy da página não permite script inline. */
(function () {
  try {
    var raiz = document.documentElement;
    var tema = JSON.parse(localStorage.getItem('pb.tema'));
    var texto = JSON.parse(localStorage.getItem('pb.texto'));
    if (tema === 'claro' || tema === 'sistema') raiz.setAttribute('data-tema', tema);
    if (texto === 'grande' || texto === 'extra') raiz.setAttribute('data-texto', texto);
  } catch (e) { /* sem armazenamento: segue com o padrão */ }
})();
