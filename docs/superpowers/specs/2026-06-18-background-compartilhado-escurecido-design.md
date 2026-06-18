# Background compartilhado com escurecimento na run

**Data:** 2026-06-18
**Branch:** feat/fim-de-jogo-estatisticas (ou nova a partir de `main`)

## Objetivo

Reaproveitar o background da tela inicial (`/background/background.jpg`) atrás de **todas** as telas do jogo, substituindo o verde chapado do `body`. Enquanto a run está ativa, um véu neutro (preto/cinza translúcido) escurece a foto para dar o efeito de "em jogo" e melhorar a leitura dos painéis.

## Comportamento

A foto fica visível atrás de todas as telas. O véu de escurecimento liga/desliga conforme a fase:

| Tela / fase                        | Estado    | Véu        |
| ---------------------------------- | --------- | ---------- |
| Home (`!started`)                  | claro     | invisível  |
| Seleção de Cidade (`needsSetup`)   | claro     | invisível  |
| Escolha de Iniciais (`needsSetup`) | claro     | invisível  |
| Manhã (run ativa)                  | escuro    | visível    |
| Dia / mapa (run ativa)             | escuro    | visível    |
| Resumo (run ativa)                 | escuro    | visível    |
| Fim de Jogo (run ativa)            | escuro    | visível    |

Booleano de controle, em `App.tsx`:

```ts
const darkened = started && !needsSetup
```

- `!started` → Home → véu invisível.
- `started && needsSetup` → setup (CitySelect/NewGame) → véu invisível.
- `started && !needsSetup` → run ativa (Morning/Day/Summary/EndGame) → véu visível.

A transição entre claro e escuro é um fade suave de opacidade (~350ms) ao entrar na run.

## Arquitetura

Abordagem escolhida: **camada de fundo global no root do App** (uma vez), em vez de cada tela setar seu próprio background (que duplicaria a imagem em ~6 lugares e dificultaria o fade).

### 1. Camada de fundo (`App.tsx` + `App.module.css`)

Dois elementos fixos cobrindo a viewport, no fundo da pilha de z-index:

- `.bgImage`: `position: fixed; inset: 0; z-index: -2;` com `background-image: url('/background/background.jpg')`, `background-size: cover`, `background-position: center`, `background-repeat: no-repeat`, `image-rendering: auto` (a arte é ilustração suave). `pointer-events: none`.
- `.bgVeil`: `position: fixed; inset: 0; z-index: -1;` `pointer-events: none;` `background: rgba(10, 12, 14, 0.5)` (preto/cinza neutro). `opacity: 0` por padrão; `opacity: 1` quando `[data-dark]`. `transition: opacity 350ms ease`.

Como ambos ficam em z-index negativo, **todo o conteúdo das telas renderiza por cima** — o véu escurece somente a foto, nunca os painéis.

No JSX de `App`, renderizar os dois divs como primeiros filhos de `.app`:

```tsx
<div className={styles.app} onClickCapture={handleClickSound}>
  <div className={styles.bgImage} aria-hidden />
  <div className={styles.bgVeil} aria-hidden data-dark={darkened || undefined} />
  <MuteButton />
  ...
</div>
```

`data-dark={darkened || undefined}` para o atributo só existir quando `true` (seletor `[data-dark]`).

### 2. Ajuste das telas

- **HomeScreen** (`HomeScreen.module.css`): remover o `background-image` (e `background-size/position/repeat`) do `.screen` — passa a herdar a foto do root. Manter o `.overlay` verde próprio (contraste do título). `.screen` continua `position: fixed; inset: 0` mas sem foto própria.
- **CitySelect / NewGame / Morning / Summary**: já são painéis sobre fundo transparente; passam a mostrar a foto automaticamente. CitySelect já tem scrim próprio. Não adicionar véu global a essas (ficam claras). Se algum título "solto" (fora de painel) perder leitura sobre a foto clara, aplicar scrim local pontual **apenas onde necessário** — não preventivamente.
- **DayScreen** (`DayScreen.module.css`): `.screen` permanece sem background (transparente) → a foto escurecida aparece atrás das sidebars translúcidas (`TeamSidebar`/`ReportSidebar` já usam `rgba(8,26,14,0.72)` + `backdrop-filter: blur`). O mapa central (`CityMap`, `absolute inset:0`) continua cobrindo sua coluna com arte própria. Nenhuma mudança estrutural — apenas confirmar que nada seta um background opaco em `.screen`/`.stage`.
- **EndGameScreen** (`EndGameScreen.module.css`): mantém a faixa-herói (`.hero`) com `background-image` próprio (arte por desfecho). O resto da tela fica sobre a foto escurecida do root. Nenhuma mudança necessária além de garantir que `.screen` não tem fundo opaco (hoje não tem).

### 3. Fallback

O `body` mantém `background: #123322` como cor de segurança caso `background.jpg` não carregue (a `.bgImage` fica em z-index negativo, então o verde do body aparece por baixo se a imagem falhar).

## Z-index (resumo)

| Camada                       | z-index |
| ---------------------------- | ------- |
| `.bgImage` (foto)            | -2      |
| `.bgVeil` (véu)              | -1      |
| Conteúdo das telas / painéis | ≥ 0     |
| HomeScreen `.screen`         | 50      |

## Fora de escopo (YAGNI)

- Vinheta, dessaturação ou qualquer véu não-uniforme (decidido: véu uniforme neutro).
- Backgrounds diferentes por cidade/fase para a camada compartilhada (mapa já tem arte própria).
- Tornar a intensidade do véu configurável em runtime/settings. Fica um valor fixo calibrável no CSS (faixa alvo ~0.4–0.55).

## Verificação

Conforme preferência de verificação econômica do projeto:

- `tsc` (tsconfig.app.json) + `eslint` + `vitest` devem passar.
- Conferência visual leve via DOM se necessário (sem screenshots, salvo se pedido):
  - Em Home/setup: `.bgVeil` com `opacity` computado `0`.
  - Em Manhã/Dia/Resumo/Fim: `.bgVeil` com `opacity` computado `1` e `data-dark` presente.
  - `.bgImage` com `background-image` apontando para `/background/background.jpg`.
