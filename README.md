# Playbook T — CS2

Playbook de táticas do lado **T** para o time de Counter-Strike 2, feito para o celular.
Importado do *Playbook TR — CS2* (32 páginas): 7 mapas × 10 táticas. Cada tática traz o **objetivo**, a **economia**,
**o que cada um dos 5 jogadores faz (P1 a P5)**, o **pós-plant** e o **plano B**.

- **Abre por link** e instala na tela inicial (Android e iPhone). **Funciona sem internet** depois da primeira abertura.
- **Para o IGL no jogo:** abre direto no mapa da partida, texto grande, tema escuro, 1 toque até a tática, "Chamar" por tipo de round e opção de manter a tela acesa.
- **Para cada jogador:** escolha a sua função (P1 a P5) e o app destaca o que você faz em cada tática e mostra o seu papel nas listas.
- **Para estudar:** filtros por tipo, busca sem acento (também no texto das funções), favoritas e link direto para cada tática.
- Sem servidor, sem conta, sem dependências. É um site estático.

## Telas

| Tela | Para quê |
| --- | --- |
| **Táticas** | As 10 táticas do mapa da partida, com filtro por tipo (as mesmas cores do PDF), selo do site (A/B) e a descrição do mapa. |
| **Tática** | Objetivo, economia, o que cada função faz (P1–P5), pós-plant e plano B. A "call" no rádio é o mapa + o número (ex.: *Mirage 2*), como o PDF sugere. |
| **Chamar** | "Qual tática chamar?": as táticas do mapa agrupadas por tipo de round (Pistol, Default, Execução, Split, Fake, Rápida, Contato, Force), com a descrição de cada tipo. |
| **Guia** | "Como usar", funções fixas do time, tipos de tática e regras gerais (a introdução do PDF). Dá para marcar a sua função aqui. |
| **Favoritas** | Táticas fixadas neste aparelho. |
| **Busca / Ajustes** | Busca por nome, call, posição, função ou texto; tema, tamanho do texto, **Minha função**, tela acesa, instalação e atualização. |

**Minha função:** em *Ajustes*, no *Guia* ou dentro de qualquer tática, escolha P1 a P5. Na tela da tática o seu cartão sobe para o topo
com a marca "Você"; nas listas aparece um trecho do que você faz em cada tática. A escolha fica só neste aparelho.

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
  "id": "mirage-02",              // único; aparece no link da tática
  "mapa": "mirage",               // id de um mapa em "mapas"
  "numero": 2,                    // número da tática no mapa (a call é "Mirage 2")
  "titulo": "Execução A padrão",
  "tipos": ["execucao"],          // ids de "tipos"; o primeiro é o tipo principal (agrupa em "Chamar")
  "alvo": ["A"],                  // site que a tática realmente ataca: ["A"], ["B"] ou []
  "objetivo": "Tomar A com as três smokes clássicas e trocar as duas primeiras mortes.",
  "economia": "Full buy: 3 smokes, 2 molotovs, 4 flashes",
  "funcoes": {                    // o que cada função faz; precisa ter todas as funções cadastradas
    "p1": "Espera no fim de Ramp. Na queda das smokes, entra checando Tetris, depois Triple e Default.",
    "p2": "...", "p3": "...", "p4": "...", "p5": "..."
  },
  "posPlant": "Plant em Default ou atrás de Triple. Posições: Palace, Firebox, Triple, Ramp e AWP olhando Jungle/Connector.",
  "planoB": "Se houver 3 CTs em A, o IGL chama 'Mid-B'..."
}
```

- **Obrigatórios:** `id`, `mapa`, `numero`, `titulo`, `objetivo` e `funcoes` completo. `economia`, `posPlant` e `planoB` são recomendados
  (a validação só avisa se faltarem).
- **Novo mapa / mapa que saiu do pool:** adicione em `"mapas"` (com `"matiz"` de 0 a 360 para a cor do cartão e `"descricao"` com a introdução do mapa)
  ou marque `"ativo": false` (some do app, as táticas ficam guardadas).
- **Tipos, funções e regras gerais** estão no topo do arquivo (`"tipos"` com `"cor"` em hexadecimal, `"funcoes"` P1–P5, `"regras"`).
- **`"revisar"`** (opcional) guarda uma nota interna. Não aparece no app, só nos avisos de `npm run validar`.

### Granadas, ordem de execução e radar (opcionais)

O app já mostra estes blocos quando a tática os tiver. Não precisa mudar código:

```jsonc
{
  "id": "mirage-02",
  // ...campos acima...
  "granadas": ["P3: smoke CT", "P2: flash por cima de Ramp"],
  "ordem": ["Smokes", "Flash e entrada pela Ramp", "Plant"],
  "radio": ["Go A", "Flash out"],
  "radar": [{ "src": "img/radar/mirage-02.webp", "legenda": "Rotas da execução A" }]
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

- O texto das 70 táticas, das funções, dos tipos, das regras e das introduções dos mapas foi extraído do PDF por programa
  (lendo a posição de cada palavra, então as quebras de linha das tabelas não atrapalham). A conferência é palavra por palavra:
  as 11.924 palavras do PDF (fora cabeçalho, rodapé e as etiquetas de tipo) são exatamente as do `playbook.json`. **Nada foi reescrito.**
- O título e o tipo de cada tática conferem com o índice do PDF, e as cores dos tipos são as do próprio PDF.
- **Campos derivados** (não existem no PDF e podem ser ajustados): `alvo` (o site A/B vem da linha de pós-plant; sem ela, da última letra A/B do título;
  táticas "Default" cujo site é decidido na hora ficam sem site), o rótulo curto das funções (`curto`) e a sigla/cor de cada mapa.
- O PDF antigo (*Livro de Táticas T*) tinha uma "cola rápida" por situação do round e um vocabulário de calls (Default, Control, Split, Go, Abort, Save…).
  O PDF novo não traz essas partes, então elas saíram do app. Continuam no histórico do git (commit `1a04c56`) se quiserem trazer de volta.
- "Ancient 10" é de dois tipos (*Default/Execução*). Na tela *Chamar* ela aparece no primeiro tipo (Default), com a etiqueta Execução na linha.
