// O que acontece logo depois de salvar um radar ou um texto: publicar para todos (se o GitHub está conectado e a
// publicação automática ligada) ou avisar que ficou só neste aparelho e mostrar o caminho.
import { aviso } from './shell.js';
import * as roteador from './router.js';
import { automatico, conectado, publicarRadar, publicarTexto } from './publicar.js';

const PRAZO = 'Chega a todos os aparelhos em cerca de 2 minutos.';

/**
 * @param {{tipo: 'radar'|'texto', id: string, ordem?: string[], textoSalvo: string, textoPublicado: string}} o
 *   textoSalvo: "Radar salvo só neste aparelho."  ·  textoPublicado: "Radar publicado para todos."
 */
export async function aposSalvar({ tipo, id, ordem = [], textoSalvo, textoPublicado }) {
  const enviar = () => (tipo === 'radar' ? publicarRadar(id, ordem) : publicarTexto(id));

  async function tentar() {
    aviso('Publicando para todos…', { fixo: true });
    try {
      await enviar();
      document.dispatchEvent(new Event('pb:indice')); // a tática passa de "só neste aparelho" para "publicando"
      aviso(`${textoPublicado} ${PRAZO}`, { duracao: 6000 });
    } catch (erro) {
      // continua salvo neste aparelho e pendente: dá para tentar de novo agora ou depois, em Editor → Publicar agora
      aviso(`Salvo neste aparelho, mas não publicou: ${erro.message}`, { acao: 'Tentar de novo', aoAcionar: tentar, duracao: 12000 });
    }
  }

  if (automatico()) return tentar();
  aviso(
    textoSalvo,
    conectado()
      ? { acao: 'Publicar', aoAcionar: tentar, duracao: 6000 }
      : { acao: 'Conectar', aoAcionar: () => roteador.ir(tipo === 'radar' ? '/editor' : '/editor?modo=texto'), duracao: 6000 },
  );
  return undefined;
}
