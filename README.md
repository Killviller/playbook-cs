# Playbook T — CS2

Playbook de táticas do lado **T** para o time de Counter-Strike 2, feito para o celular.
Importado do *Livro de Táticas T — CS2*: 7 mapas × 10 táticas, a tabela "qual tática chamar?" e as calls do IGL.

- **Abre por link** e instala na tela inicial (Android e iPhone). **Funciona sem internet** depois da primeira abertura.
- **Para o IGL no jogo:** abre direto no mapa da partida, texto grande, tema escuro, 1 toque até a tática, "Qual tática chamar?" por situação e opção de manter a tela acesa.
- **Para o time estudar:** filtros por tipo (Default, Split, Fake, Lurk…), busca, favoritas e link direto para cada tática (dá para mandar no Discord/WhatsApp).
- Sem servidor, sem conta, sem dependências. É um site estático.

## Telas

| Tela | Para quê |
| --- | --- |
| **Táticas** | As 10 táticas do mapa da partida, com filtro por tipo e selo do site (A/B). |
| **Chamar** | A cola rápida do PDF: toque na situação ("B está fraco", "CTs rotacionam rápido"…) e veja o que o playbook recomenda e quais táticas do mapa servem. |
| **Calls** | Vocabulário do IGL (Default, Control, Explode A/B, Split, Fake, Lurk, Slow, Go, Abort, Save). |
| **Favoritas** | Táticas fixadas neste aparelho. |
| **Busca / Ajustes** | Busca sem acento; tema, tamanho do texto, tela acesa, instalação e atualização. |

## Publicar (GitHub Pages)

1. Deixe o código no branch **`main`**.
2. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. A cada push na `main`, o workflow roda os testes, gera o site e publica. O link fica em
   `https://<usuario>.github.io/playbook-cs/` (aparece em **Actions** e em **Settings → Pages**).
4. Mande o link para o time. No celular, abra o link e instale:
   - **Android (Chrome):** botão *Instalar* no app (ou menu → *Instalar app*).
   - **iPhone (Safari):** *Compartilhar → Adicionar à Tela de Início*.

> **O link é aberto.** Qualquer pessoa com o endereço vê as táticas, e como o repositório é público, o código e os dados
> também estão visíveis no GitHub. O site pede aos buscadores para não indexá-lo (`noindex`), mas isso não é privacidade.

Também dá para publicar a pasta `dist/` (gerada por `npm run build`) em qualquer hospedagem estática (Netlify, Cloudflare Pages…).

## Como atualizar as táticas

Todo o conteúdo está em **`site/data/playbook.json`**. Edite o arquivo (dá para fazer direto no GitHub, pelo ícone de lápis) e faça commit na `main`:
o teste valida o arquivo antes de publicar, então um erro de digitação não derruba o site.

```jsonc
{
  "id": "mirage-04",            // único; aparece no link da tática
  "mapa": "mirage",             // id de um mapa em "mapas"
  "numero": 4,                  // número da tática no mapa
  "titulo": "A execute clássico",
  "tipos": ["execute"],         // filtros e "Qual tática chamar?" (ids de "tipos")
  "alvo": ["A"],                // site que a tática realmente ataca: ["A"], ["B"] ou []
  "linhas": [                   // uma linha por item; número no começo vira selo (ex.: "3 Ramp.")
    "3 Ramp.",
    "1 Palace.",
    "1 Mid.",
    "Utilidade sincronizada.",
    "Entrada em conjunto."
  ]
}
```

- **Novo mapa / mapa que saiu do pool:** adicione em `"mapas"` (com `"matiz"` de 0 a 360 para a cor do cartão) ou marque `"ativo": false`
  (some do app, as táticas ficam guardadas).
- **Como o "Qual tática chamar?" escolhe:** cruza os `tipos` da situação (`"situacoes"`) com os `tipos` das táticas do mapa;
  quem casa mais tipos vem primeiro. Situações de A/B só mostram táticas com o `alvo` correspondente.
- **`"revisar"`** (opcional) guarda uma nota interna para o IGL. Não aparece no app, só nos avisos de `npm run validar`.

### Granadas, ordem de execução e radar (opcionais)

O app já mostra estes blocos quando a tática os tiver. Não precisa mudar código:

```jsonc
{
  "id": "mirage-04",
  // ...campos acima...
  "granadas": ["T2: smoke da conexão", "T3: flash por cima da rampa"],
  "ordem": ["Smoke da conexão", "Flash e entrada pela rampa", "Planta no A"],
  "radio": ["Go A", "Flash out"],
  "radar": [{ "src": "img/radar/mirage-04.webp", "legenda": "Rotas do execute A" }]
}
```

Imagens de radar vão em `site/img/radar/`. Prefira WebP/PNG leves (até ~200 KB): elas entram no cache para uso sem internet.

## Desenvolvimento

Precisa só do Node 20+ (sem `npm install`).

```bash
npm run dev       # http://localhost:5173/        (site/ direto, sem cache offline)
npm run validar   # confere o playbook.json
npm test          # validação + testes da lógica e do build
npm run build     # gera dist/ (service worker carimbado com a versão e a lista de arquivos offline)
npm run preview   # http://localhost:4173/playbook-cs/  (dist/ no mesmo caminho do GitHub Pages)
```

```
site/                 o que vai ao ar
  index.html  manifest.webmanifest  sw.js  robots.txt
  css/app.css         tema escuro/claro, componentes
  js/                 app sem framework: roteador por hash, telas em js/views/
  data/playbook.json  TODO o conteúdo
  icons/              ícones do app
scripts/              validação, build, servidor local
tests/                node --test (lógica com dados sintéticos + validação do JSON real)
.github/workflows/    testes + publicação no Pages
```

Como funciona o uso sem internet: o `sw.js` guarda todos os arquivos na primeira abertura. A cada deploy o build troca a versão do cache;
quando há versão nova o app mostra o aviso **"Nova versão disponível · Atualizar"** (sem recarregar sozinho no meio de uma partida).

## Notas sobre a importação do PDF

- O texto das 70 táticas foi extraído do PDF por programa e conferido linha a linha: **nada foi reescrito**. Só saíram ruídos
  de conversão (numeração duplicada "1. 1.", `**` e `\~` soltos, o "• --" no fim de cada mapa e um resto de texto de chatbot na pág. 12).
- Só o Ancient tinha título de mapa no PDF. Os demais foram deduzidos pelos callouts, na ordem do pool: Anubis (11–20), Cache (21–30),
  Dust II (31–40), Inferno (41–50), Mirage (51–60) e Nuke (61–70).
- **`tipos` e `alvo` são sugestões** derivadas dos títulos e do texto (não existem no PDF). Ajuste à vontade.
- **Para revisar:** em Anubis 2, Dust II 2, Inferno 3 e Mirage 5 o PDF diz "3–4 jogadores" no grupo principal, mas os outros papéis
  já fecham 5 com 3. O texto foi mantido e as táticas ficaram marcadas com `"revisar"`.
- O Dust II não tem nenhuma tática classificada como *Default* ou *Anti-agressão*; por isso "CTs muito agressivos" e "Pouca utilidade"
  mostram um aviso e a lista completa do mapa. Se a abertura "Controle de Long" funciona como default no time, basta incluir `"default"` nos `tipos` dela.
