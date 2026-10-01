import { store } from './store.js';

export const TEMAS = ['escuro', 'claro', 'sistema'];
export const TEXTOS = ['normal', 'grande', 'extra'];

/** Aplica tema e tamanho do texto no <html> (o CSS reage aos atributos). */
export function aplicarPreferencias() {
  const raiz = document.documentElement;
  const tema = store.get('tema', 'escuro');
  const texto = store.get('texto', 'normal');
  raiz.dataset.tema = TEMAS.includes(tema) ? tema : 'escuro';
  raiz.dataset.texto = TEXTOS.includes(texto) ? texto : 'normal';
}
