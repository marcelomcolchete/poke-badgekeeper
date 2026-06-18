# Fim de jogo em 3 colunas (ginásio · cidade · veredito)

**Data:** 2026-06-18
**Branch:** `feat/fim-de-jogo-3-colunas` (a partir de `origin/main`)

## Objetivo

Refazer o cabeçalho do `EndGameScreen` (o `div.heroContent` da faixa-herói) em **três colunas**,
substituindo o título grande + scores centrados por uma leitura mais rica do desempenho da run:

1. **Ginásio (seu emprego):** o líder do ginásio reage ao seu desempenho nas **batalhas/defesas**.
2. **Cidade (sua popularidade):** a Enfermeira Joy, em nome do povo, reage ao seu desempenho nas **missões**.
3. **Veredito:** média das estrelas, aprovado/reprovado, resultado da run (venceu/fim de jogo + motivo)
   e os botões **Voltar** / **Próximo Ginásio**.

O fundo dessa faixa passa a ser o **mapa jogável da cidade** (`/maps/kanto/N.png`) com uma sombra
(scrim) por cima para contraste/leitura.

As três **abas** abaixo (Estatísticas / Time / Itens) permanecem **intactas**.

## Contexto / estado atual

- `origin/main` já tem `EndGameScreen.tsx` + `EndGameScreen.module.css`, e o relatório puro
  `engine/finalReport.ts` (`buildFinalReport`).
- O `finalReport` já expõe tudo necessário: `missionStars` (0–5), `battleStars` (0–5),
  `avgStars`, `hired`, `cityName`, `nextCityName`, `nextCityIndex`, `reason` (derrota).
- `approval.ts` já separa as duas frentes: `missionStarDelta`, `battleStarDelta`,
  `averageStars(missionStars, battleStars)`, `isHired(...)`.
- Assets existentes: `/sprites/trainers/gen3/brock-gen3.png`, `/sprites/trainers/gen3/misty-gen3.png`,
  `/sprites/trainers/nurse.png` (Joy); mapas `/maps/kanto/{1..8}.png`.
- Componente reaproveitável: `components/common/Stars.tsx` (estrelas 0–5 contínuas por sobreposição).

Hoje o `.heroContent` contém: `.title` (VOCÊ VENCEU! / FIM DE JOGO), `.subtitle` (efetivado/motivo),
`.scores` (🎯 Missões / ⚔️ Batalhas / Média) e `.actions` (Próximo Ginásio / Voltar). **Tudo isso é
reorganizado nas 3 colunas** — nada de novo na engine.

## Mapeamento de dados

| Coluna | Fonte (de `buildFinalReport`) | Persona |
| ------ | ------------------------------ | ------- |
| 1 — Ginásio | `battleStars` | Líder do ginásio (Brock/Misty…) |
| 2 — Cidade | `missionStars` | Enfermeira Joy (povo) |
| 3 — Veredito | `avgStars`, `hired`, `outcome`, `reason`, `cityName`, `nextCityName`, `nextCityIndex` | — |

## Selo a partir das estrelas (floor — "perfeito" só em 5,0)

```
bucket(stars) = min(5, floor(stars))   // stars ∈ [0, 5]
```

| bucket | selo | regra |
| ------ | ---- | ----- |
| 0 | Horrível    | `stars < 1` |
| 1 | Muito ruim  | `1 ≤ stars < 2` |
| 2 | Ruim        | `2 ≤ stars < 3` |
| 3 | Bom         | `3 ≤ stars < 4` |
| 4 | Muito bom   | `4 ≤ stars < 5` |
| 5 | Perfeito    | `stars === 5` |

O mesmo `bucket` indexa a **fala** (0–5) e o **selo**. As estrelas exibidas continuam **contínuas**
(ex.: `Stars value={3.5}` + texto `3,5/5`), só o selo/fala usam o bucket.

Cores dos selos (0→5): vermelho-escuro → vermelho → laranja → verde → azul → ouro (com brilho no 5,
reaproveitando o visual de "perfeito" já existente no projeto).

## Falas (genéricas por estrela — contextos distintos)

Quanto **maior** a estrela, mais **elogios**; quanto **menor**, mais **julgamento**. O ginásio é o
seu **emprego** (chefe avaliando seu trabalho de defesa); a cidade é a sua **popularidade** com o
povo (ajuda nas missões) — tom propositalmente diferente.

### Ginásio (`GYM_SPEECHES[0..5]`)

| ★ | Fala |
| - | ---- |
| 0 | "Você deixou o ginásio à mercê de qualquer um. Não sei como ainda está de pé aqui." |
| 1 | "Quase toda invasão passou por você. Um líder não pode falhar assim." |
| 2 | "Segurou o básico, mas perdeu batalhas que não podia perder. Treine mais." |
| 3 | "Defendeu o ginásio com competência. É o que se espera de quem ocupa o posto." |
| 4 | "Impressionante! Poucos chegaram perto de te derrotar. O ginásio está em boas mãos." |
| 5 | "Nenhuma derrota, nenhuma falha. Defendeu este ginásio como um mestre — tenho orgulho de você." |

### Cidade (`CITY_SPEECHES[0..5]`)

| ★ | Fala |
| - | ---- |
| 0 | "As pessoas mal sabem quem você é... e quem sabe, prefere esquecer. Ninguém recebeu sua ajuda." |
| 1 | "O povo anda decepcionado. Pediram socorro tantas vezes e você quase não apareceu." |
| 2 | "Algumas pessoas foram ajudadas, mas a cidade esperava bem mais de você." |
| 3 | "Os moradores gostam de te ter por perto. Você ajudou bastante gente por aí." |
| 4 | "A cidade inteira comenta seus feitos! Você virou alguém em quem todos confiam." |
| 5 | "Você é o herói da cidade! Cada pedido foi atendido — todos te adoram e jamais vão te esquecer." |

## Líder do ginásio por cidade

Mapa `cityIndex → { name, sprite }`:

- `0` (Pewter) → **Brock** — `/sprites/trainers/gen3/brock-gen3.png`
- `1` (Cerulean) → **Misty** — `/sprites/trainers/gen3/misty-gen3.png`
- demais (não jogáveis ainda) → **fallback genérico** (usa Brock como placeholder + rótulo "Líder do Ginásio").

Joy é fixa: `/sprites/trainers/nurse.png`. As fotos são sprites pixelados (`image-rendering: pixelated`).

## Layout

```
┌──────────── faixa-herói (fundo = mapa N.png + scrim escuro) ────────────┐
│  ┌─ Ginásio ──────┐  ┌─ Cidade ───────┐  ┌─ Veredito ─────────────────┐ │
│  │ [foto líder]   │  │ [foto Joy]     │  │ ★ VOCÊ VENCEU! / FIM DE JOGO│ │
│  │ Selo + ★3,5/5  │  │ Selo + ★4,0/5  │  │ [APROVADO/REPROVADO]        │ │
│  │ "fala do líder"│  │ "fala da Joy"  │  │ Média 3,8/5                 │ │
│  │                │  │                │  │ motivo (vitória/derrota)    │ │
│  │                │  │                │  │ [Próximo Ginásio] [Voltar]  │ │
│  └────────────────┘  └────────────────┘  └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
  [ Estatísticas | Time | Itens ]   ← abas inalteradas
```

- Grid de 3 colunas (`1fr 1fr 1fr`); em telas estreitas (`max-width: 480px`) empilha em 1 coluna.
- Colunas 1 e 2: foto no topo, selo + estrelas, fala (texto curto). Cartão translúcido escuro sobre o
  scrim para leitura.
- Coluna 3: título do desfecho (compacto), badge aprovado/reprovado (reaproveita `.avgGood/.avgBad`),
  média, motivo (na vitória: "Efetivado em {cidade} com média X/5!"; na derrota: texto do motivo já
  existente em `LOSS_MESSAGE`/fallback do dia 10), e os botões.
- **Sempre 3 colunas**, na vitória e na derrota (inclusive GAMEOVER). Em GAMEOVER, as colunas 1/2
  ainda mostram as estrelas reais do relatório; a coluna 3 explica o motivo da demissão.

## Fundo

`backgroundImage: url('/maps/kanto/{cityIndex+1}.png')` no elemento da faixa (`background-size: cover;
background-position: center`). Um scrim escuro por cima (gradiente vertical ~`rgba(8,16,10,0.62)` →
`rgba(8,16,10,0.82)`) garante contraste — substitui o `heroBackground(avgStars)` atual (a arte por
nota deixa de ser usada nesta faixa). `cityIndex` vem de `state.run.cityIndex`.

## Arquivos

- **Novo** `src/data/endgameVerdict.ts` (puro):
  - `GYM_SPEECHES: string[6]`, `CITY_SPEECHES: string[6]`, `BADGE_LABELS: string[6]`.
  - `BADGE_COLORS: string[6]` (escala de cor por bucket).
  - `starBucket(stars: number): number` — `min(5, floor(clamp(stars,0,5)))`.
  - `gymLeaderFor(cityIndex: number): { name: string; sprite: string }`.
  - `NURSE_JOY_SPRITE` (const).
- **`src/components/screens/EndGameScreen.tsx`**: troca o interior do `.heroContent` por três
  subcomponentes — `<GymColumn report>`, `<CityColumn report>`, `<VerdictColumn report onBack onNextGym>`.
  Mantém props (`state, outcome, onBack, onNextGym`), as abas e todos os subcomponentes das abas.
  Remove o uso de `heroBackground(avgStars)`; passa `state.run.cityIndex` ao fundo.
- **`src/components/screens/EndGameScreen.module.css`**: grid de 3 colunas, fundo-mapa, cartões das
  colunas, selos coloridos, foto-persona. Remove/reaproveita `.title/.subtitle/.scores` antigos
  (migram para a coluna 3). `.avgGood/.avgBad`, `.primary`, `.back` permanecem.
- **Novo** `src/data/endgameVerdict.test.ts`: limites do `starBucket` (`0`, `0.9`, `1`, `4.9`, `5`),
  `gymLeaderFor` (Pewter→Brock, Cerulean→Misty, fallback), e que cada conjunto tem 6 entradas.

Nenhuma mudança na engine, nas ações ou no `finalReport` — só apresentação + um módulo de dados novo.

## Verificação (econômica — ver memória do projeto)

- `tsc` (tsconfig.app.json) + `eslint` + `vitest` passam.
- Conferência leve de DOM se necessário (sem screenshots, salvo se pedido):
  - 3 colunas presentes; foto correta por cidade (Brock em Pewter, Misty em Cerulean, Joy na cidade).
  - Selo/fala batem com o bucket esperado para valores de estrela conhecidos.
  - Fundo aponta para `/maps/kanto/{N}.png`; botões Voltar/Próximo Ginásio funcionam.

## Fora de escopo (YAGNI)

- Falas personalizadas por líder (fica o conjunto genérico por estrela).
- Arte/líderes próprios das 6 cidades ainda não jogáveis (só fallback).
- Novas animações além do brilho de "perfeito" já existente.
- Qualquer alteração nas abas Estatísticas/Time/Itens.
