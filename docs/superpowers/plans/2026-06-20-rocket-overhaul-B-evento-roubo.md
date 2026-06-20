# Evento de Roubo Rocket — Implementation Plan (Feature B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o **Evento de Roubo Rocket 🚨** (Feature B do design): uma rolagem por dia que, ao acertar, ARMA um roubo; quando há um Pokémon elegível no ginásio, a Equipe Rocket surge num nó adjacente, marca um Pokémon como `'stolen'` e foge em tempo real até o nó mais distante do ginásio. O jogador despacha até 3 perseguidores idle que pathfindam até a posição da Rocket; ao interceptar (ou na janela de 5s no nó final) abre uma batalha de resgate modal. Vitória recupera o Pokémon (mesmo HP) + 3× XP de batalha de ginásio; derrota/fuga remove o Pokémon e tira 1 coração de todo o roster. Em qualquer desfecho a chance reseta para 1%.

**Architecture:** Lógica pura de posicionamento/distância na engine (`pathfinding` ganha farthest-node; `travelerPositions` ganha posição da Rocket e dos perseguidores). Um novo módulo de orquestração `game/theftFlow.ts` espelha `defenseFlow`/`rocketFlow`: roll no dia-aberto, spawn com disparo adiado, avanço da fuga e detecção de interceptação processados em `dayClock.tick` (concorrente com o relógio, como missões/defesas/buscas), e a resolução da batalha reusa `resolveDefense`. A batalha de resgate é um modal que **pausa o relógio** (`clock.speed = 0`), igual à defesa (ver Decisão de design abaixo). Estado novo em `GameState.theft?: TheftEvent` + `run.theftChance`. UI: traveler "R" vermelho + perseguidores no `CityMap`, banner `'stolen'` no `TeamSidebar`, painel de dispatch + painel de batalha (reusa `BattleView`), e bloco "Chance de Rocket" na previsão.

**Tech Stack:** React + TypeScript + Vite + vitest.

## Global Constraints
- Build/type-check com `npm run build` (roda `tsc -b`). **Não** usar `tsc --noEmit` (o tsconfig raiz é solution-only).
- Testes com `npx vitest run` (arquivo único: `npx vitest run src/path/file.test.ts`).
- TypeScript strict, **sem `any`**. Comentários em **português** (padrão do repositório), explicando o "porquê".
- Engine (`engine/`) e dados (`data/`) **puros**: sem React, sem `Date.now()`/`Math.random()` — só `Rng` semeado (`createRng`/`deriveSeed`).
- Determinismo TOTAL do evento: rolagem do roubo, escolha do alvo, escolha dos nós (spawn/destino), tempo de fuga, esquadrão — tudo via `takeRng(s)` (no fluxo do dia) ou `createRng(seed)` (na engine pura). Nunca `Math.random()`.
- Sem magic numbers: knobs de balanceamento em `engine/balance.ts`; salts/invariantes estruturais e `SAVE_VERSION` em `engine/constants.ts`.
- O evento de roubo é processado em `dayClock.tick` como os demais eventos do dia (concorrente). A batalha de resgate é modal e pausa o relógio.
- Distâncias do mapa usam o grafo do dia (`graphWithTunnels(city.graph, today.digTunnels)`) e a métrica 16:9 já embutida em `pathDistance`/`segmentLength` (`engine/pathfinding.ts`).

## Prerequisites
- Este plano aplica-se **DEPOIS** de `2026-06-20-rocket-overhaul-A-missoes-especiais.md` (a renomeação que libera o nome "rocket"). Após o Plano A:
  - `MissionStatus 'battle'`, `RocketBattle` (em `state.ts`), `MissionInstance.rocket`, `getMissionTemplate(...).isRocket`, `loseRunByRocket`, `resolveRocketBattle`/`completeRocketBattle` (do fluxo de MISSÃO), o template `'rocket'`, a categoria `MissionCategory 'rocket'` e o `SiteKind`/`CitySiteNodes.museum` **deixaram de existir** no domínio de MISSÃO.
  - `run.gameOverReason` não tem mais a opção `'rocket'` ligada a missão.
  - `DayForecastPanel` ainda tem o bloco "Rocket / ???" (a substituição é a Task 11 **deste** plano — o Plano A NÃO a remove).
  - O `SAVE_VERSION` atual no `main` é **34**. O Plano A pode (ou não) ter bumpado para 35. **Antes de começar a Task 2**, leia `SAVE_VERSION` em `src/engine/constants.ts` e use `SAVE_VERSION_ATUAL → SAVE_VERSION_ATUAL + 1` (este plano chama de v→v+1; nos exemplos usamos 35→36 supondo que o Plano A bumpou 34→35). Ajuste os números literais conforme o estado real.
- O efeito **Tempestade** (`paralyzeHold`, `paralyzedBattleIds`, `engine/storm.ts`, `game/stormFlow.ts`) JÁ existe no `main` — reusamos `paralyzedIds` na batalha de resgate, sem mexer na Tempestade.

---

## File Structure

```
src/
  engine/
    balance.ts                 (M) constantes THEFT_*
    constants.ts               (M) THEFT_SEED_SALT + bump SAVE_VERSION
    pathfinding.ts             (M) farthestNodeFrom + nodeDistancesFrom
    pathfinding.test.ts        (M) testes do farthest-node
    state.ts                   (M) RunInfo.theftChance + TheftEvent + GameState.theft + gameOverReason 'theft'
    travelerPositions.ts       (M) theftPos + chaserPositionsAt + theftInterceptorIds
    travelerPositions.test.ts  (M) testes de posição da Rocket/perseguidores
    theft.ts                   (C) helpers PUROS: rollNextTheftChance, theftFleeMs, theftChanceLabel
    theft.test.ts              (C) testes dos helpers puros
  game/
    theftFlow.ts               (C) orquestração: roll, eligibility, spawn adiado, tick, dispatch, resolve
    theftFlow.test.ts          (C) testes do fluxo
    dayClock.ts                (M) processTheft no tick + rollTheftAtDayOpen
    phaseFlow.ts               (M) chama rollTheftAtDayOpen ao abrir o DAY; resolveLeftovers fecha o roubo
    setup.ts                   (M) run.theftChance inicia em 1
    actions.ts                 (M) DISPATCH_THEFT_CHASERS + RESOLVE_THEFT_BATTLE
    reducer.ts                 (M) wiring das ações
  persistence/
    saveLoad.ts                (M) migração v→v+1
    saveLoad.test.ts           (M) caso de migração
  audio/
    useGameSounds.ts           (M) 'timeWarning' quando a Rocket chega ao nó final
  components/
    day/
      CityMap.tsx              (M) render do "R" vermelho + perseguidores
      CityMap.module.css       (M) estilos do marcador Rocket
      TeamSidebar.tsx          (M) banner 'stolen' 🚨 Roubado
      TeamSidebar.module.css   (M) (reusa busyOverlay/busyBanner — nada novo obrigatório)
      TheftChasePanel.tsx      (C) painel de dispatch dos perseguidores
      TheftBattlePanel.tsx     (C) painel da batalha de resgate (reusa BattleView)
      DayScreen.tsx            (M) monta os painéis + abre por seleção
    screens/
      DayForecastPanel.tsx     (M) bloco "Chance de Rocket"
      DayForecastPanel.module.css (M) estilo do bloco (reusa .count/.rocketIcon)
```

---

### Task 1: Constantes de balanceamento (Feature B)

**Files:**
- Modify: `src/engine/balance.ts` (após o bloco "Tempestade", ~linha 322)

**Interfaces:**
- Consumes: nada.
- Produces (em `balance.ts`):
  - `THEFT_CHANCE_START = 1`
  - `THEFT_CHANCE_MAX = 100`
  - `THEFT_CHASERS_MAX = 3`
  - `THEFT_FLEE_AGILITY = 10`
  - `THEFT_GRACE_MS = 5_000`
  - `THEFT_XP_MULTIPLIER = 3`
  - `THEFT_INTERCEPT_DISTANCE = 0.03`

- [ ] **Step 1: Adicionar as constantes**

Adicionar ao fim de `src/engine/balance.ts` (após `PARALYZE_BATTLE_MULT`):

```ts
// ---- Evento de Roubo Rocket 🚨 (Feature B) ------------------------------------------------
/** Chance-base (%) de o roubo ARMAR no dia; dobra a cada dia sem disparar (1→2→4→…→100). */
export const THEFT_CHANCE_START = 1
/** Teto da chance de roubo (%) — a duplicação satura aqui. */
export const THEFT_CHANCE_MAX = 100
/** Máximo de perseguidores idle que podem ir atrás da Rocket. */
export const THEFT_CHASERS_MAX = 3
/**
 * Agilidade EFETIVA da Rocket na fuga: o tempo de viagem dela usa a MESMA curva de um time
 * com 10 de agilidade (agilityTravelFactor → fator 0,90). Lenta o bastante para Pokémon
 * rápidos alcançarem, rápida o bastante para os lentos não.
 */
export const THEFT_FLEE_AGILITY = 10
/** Janela (ms de jogo) parada no nó mais distante antes de a Rocket escapar de vez. */
export const THEFT_GRACE_MS = 5_000
/** Recompensa: a batalha de resgate rende 3× o XP de uma batalha de ginásio (só na vitória). */
export const THEFT_XP_MULTIPLIER = 3
/**
 * Limiar de proximidade (em coordenadas normalizadas 0–1, métrica 16:9 de segmentLength) para um
 * perseguidor INTERCEPTAR a Rocket. 0,03 ≈ 3% da largura do mapa: maior que o passo típico de um
 * tick a x3 (`graphTravelMs` dá pernas de vários segundos → << 0,03 por frame), evitando que a
 * interceptação "pule por cima" da Rocket entre dois ticks, e pequeno o bastante para exigir
 * encostar de fato. Ajustável na Fase 5.
 */
export const THEFT_INTERCEPT_DISTANCE = 0.03
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (só novas constantes não usadas ainda — `tsc -b` não reclama de export não usado).

- [ ] **Step 3: Commit**

```bash
git add src/engine/balance.ts
git commit -m "feat(theft): constantes de balanceamento do Evento de Roubo Rocket"
```

---

### Task 2: Estado + tipos + salt + bump de save

**Files:**
- Modify: `src/engine/constants.ts` (salt + bump `SAVE_VERSION` + comentário)
- Modify: `src/engine/state.ts` (`RunInfo.theftChance`, `TheftEvent`, `GameState.theft`, `gameOverReason 'theft'`, init)
- Modify: `src/types/index.ts` (`PokemonStatus: 'stolen'`)

**Interfaces:**
- Consumes: `EnemyUnit`, `DuelLog`, `MapPos`, `TrainerId` (já importados em `state.ts`).
- Produces:
  - Em `types/index.ts`: `PokemonStatus` ganha `'stolen'`.
  - Em `constants.ts`: `THEFT_SEED_SALT`; `SAVE_VERSION` +1.
  - Em `state.ts`:
    - `RunInfo.theftChance: number`
    - `type TheftPhase = 'armed' | 'fleeing' | 'atFarNode' | 'battle' | 'resolved'`
    - `interface TheftEvent { phase; stolenId; fromNode; targetNode; startedAtMs; arriveAtMs; graceUntilMs; chaserIds; trainerId; enemies; duels?; won?; resolved?; xpSeed? }`
    - `GameState.theft?: TheftEvent`
    - `RunInfo.gameOverReason` ganha `'theft'` (não dispara game over neste plano, mas reservamos para coerência; ver nota)
    - `createInitialState` inicia `theftChance: THEFT_CHANCE_START` e **não** define `theft`.

- [ ] **Step 1: Adicionar `'stolen'` ao `PokemonStatus`**

Em `src/types/index.ts`, na união `PokemonStatus` (após `'atCenter'`):

```ts
export type PokemonStatus =
  | 'idle'
  | 'traveling' // a caminho da missão/área (ida)
  | 'onMission'
  | 'defending'
  | 'returning' // voltando ao ginásio (só fica 'idle' ao chegar)
  | 'fainted'
  | 'atCenter'
  | 'stolen' // roubado pela Equipe Rocket (fora do roster jogável até o desfecho) — Feature B
```

- [ ] **Step 2: Adicionar o salt e bumpar o save em `constants.ts`**

Em `src/engine/constants.ts`, após `STORM_SEED_SALT`:

```ts
/** Sub-seed do Evento de Roubo Rocket: rolagem da chance/alvo/nós/esquadrão por dia. */
export const THEFT_SEED_SALT = 0x54686566 // 'Thef'
```

Bumpar a versão (ler o valor ATUAL primeiro; exemplo supondo 35 → 36):

```ts
export const SAVE_VERSION = 36
```

Adicionar ao bloco de histórico de versões (antes de `export const SAVE_VERSION`):

```ts
 * v36: Evento de Roubo Rocket. run.theftChance (1%, dobra por dia sem disparar) e
 * GameState.theft (TheftEvent opcional: fase/alvo/nós/timers/esquadrão). PokemonStatus ganha
 * 'stolen'. A migração inicia theftChance=1 e NÃO cria theft (eventos em voo não persistem;
 * recalculados no próximo dia-aberto). */
```

> **NÃO** confiar nos números 35/36 cegamente: confirme `SAVE_VERSION` real em `constants.ts` e use atual→atual+1. O comentário/migração da Task 10 devem casar com esses números.

- [ ] **Step 3: Estender `RunInfo` e adicionar `TheftEvent` em `state.ts`**

Em `src/engine/state.ts`, na interface `RunInfo`, adicionar após `ballLevel`:

```ts
  /** Chance corrente (%) de o roubo ARMAR no dia. Inicia em 1; dobra a cada dia sem disparar. */
  theftChance: number
```

E trocar a linha do `gameOverReason` para incluir `'theft'` (reservado p/ coerência; a Feature B não causa game over):

```ts
  gameOverReason?: 'gym' | 'stars' | 'theft' | 'fainted'
```

> Nota: o Plano A já removeu `'rocket'` daqui. Se ainda houver `'rocket'`, é sinal de que o Plano A não foi aplicado — pare e aplique o Plano A antes.

Adicionar o tipo do evento (perto de `DefenseEvent`, p.ex. após `RocketBattle`/`DefenseEvent`):

```ts
/** Fase do Evento de Roubo Rocket (Feature B). */
export type TheftPhase =
  | 'armed' // rolado e armado; aguardando um alvo elegível no ginásio (disparo adiado)
  | 'fleeing' // alvo roubado; Rocket fugindo do nó adjacente ao nó mais distante
  | 'atFarNode' // chegou ao nó mais distante; janela de graça antes de escapar
  | 'battle' // perseguidor interceptou; batalha de resgate aberta (relógio pausado)
  | 'resolved' // desfecho aplicado (vitória/derrota/fuga); chance já resetada p/ 1%

/**
 * Evento de Roubo Rocket do dia (no máx. 1×/dia). Nasce 'armed' (sem alvo) e dispara ('fleeing')
 * quando há um Pokémon elegível no ginásio. Tudo é determinístico (seed do dia). Persistência: o
 * evento em voo NÃO é salvo (a migração não o recria) — só o run.theftChance persiste.
 */
export interface TheftEvent {
  phase: TheftPhase
  /** Pokémon roubado (status 'stolen'); null enquanto 'armed' sem alvo. */
  stolenId: string | null
  /** Nó adjacente ao ginásio onde a Rocket surge (origem da fuga). Vazio enquanto 'armed'. */
  fromNode: string
  /** Nó mais distante do ginásio (destino da fuga). Vazio enquanto 'armed'. */
  targetNode: string
  /** Início da fuga (ms de jogo) — base da interpolação. -1 enquanto 'armed'. */
  startedAtMs: number
  /** Chegada ao nó mais distante (ms de jogo). -1 enquanto 'armed'. */
  arriveAtMs: number
  /** Fim da janela de graça no nó final (= arriveAtMs + THEFT_GRACE_MS). -1 enquanto 'armed'. */
  graceUntilMs: number
  /** Perseguidores despachados (ids do roster). Vazio = ninguém perseguindo. */
  chaserIds: string[]
  /** Treinador Rocket sorteado (arte da batalha de resgate). */
  trainerId: TrainerId
  /** Esquadrão inimigo (dimensionado pelo dia, como a defesa de ginásio). */
  enemies: EnemyUnit[]
  /** Log de duelos da batalha de resgate, preenchido ao resolver. */
  duels?: DuelLog[]
  /** Venceu a batalha de resgate? (definido ao resolver). */
  won?: boolean
  /** Batalha já resolvida (HP/recuperação aplicados)? Idempotência. */
  resolved?: boolean
  /** Sub-seed de evolução do XP da vitória, sorteado ao resolver. */
  xpSeed?: number
}
```

Em `GameState`, adicionar após `weather`:

```ts
  /** Evento de Roubo Rocket do dia (Feature B), se houver. Não persiste entre saves. */
  theft?: TheftEvent
```

Em `createInitialState`, no objeto `run`, adicionar `theftChance: THEFT_CHANCE_START`. Importar a constante no topo de `state.ts`:

```ts
import { DAY_LENGTH_MS, STARS_START, STARTING_GOLD } from './constants.ts'
import { THEFT_CHANCE_START } from './balance.ts'
```

e:

```ts
    run: { cityIndex: 0, day: 1, seed, phase: 'MORNING', ballLevel: 0, theftChance: THEFT_CHANCE_START },
```

- [ ] **Step 4: Type-check (espera FALHAR onde o save tem caso pendente)**

Run: `npm run build`
Expected: PASS de tipos (a migração da Task 10 ainda não foi tocada; o bump do `SAVE_VERSION` sozinho não quebra o `tsc`, só os testes de save — que rodaremos/ajustaremos na Task 10). Se algum `.test.ts` que constrói `RunInfo` literal quebrar por faltar `theftChance`, anote para corrigir junto (é esperado; veja a nota).

> Vários testes constroem `createInitialState` (que já passa a preencher `theftChance`), então não quebram. Os que montam `RunInfo` por literal precisarão de `theftChance` — corrigir no ato (adicionar `theftChance: 1`).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/engine/constants.ts src/engine/state.ts
git commit -m "feat(theft): estado (TheftEvent), run.theftChance, status 'stolen' e bump de save"
```

---

### Task 3: Helpers PUROS de pathfinding — nó mais distante do ginásio

**Files:**
- Modify: `src/engine/pathfinding.ts`
- Modify: `src/engine/pathfinding.test.ts`

**Interfaces:**
- Consumes: `CityGraph` (de `data/types.ts`); `shortestPath`/`pathDistance` (existentes neste arquivo).
- Produces:
  - `nodeDistancesFrom(graph: CityGraph, from: string): Record<string, number>` — distância de caminho do `from` a cada nó alcançável.
  - `farthestNodeFrom(graph: CityGraph, from: string, candidates?: readonly string[]): string | null` — o nó (entre `candidates`, default = todos) com MAIOR distância de caminho a partir de `from`; desempate alfabético; ignora inalcançáveis e o próprio `from`.

- [ ] **Step 1: Escrever os testes**

Adicionar a `src/engine/pathfinding.test.ts`:

```ts
import { farthestNodeFrom, nodeDistancesFrom } from './pathfinding.ts'

describe('farthestNodeFrom', () => {
  // Linha: a — b — c — d (b,c,d à direita de a)
  const line: CityGraph = {
    nodes: { a: { x: 0, y: 0 }, b: { x: 0.25, y: 0 }, c: { x: 0.5, y: 0 }, d: { x: 0.75, y: 0 } },
    adj: { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: ['c'] },
    markers: {},
  }

  it('nodeDistancesFrom cresce monotonicamente na linha', () => {
    const dist = nodeDistancesFrom(line, 'a')
    expect(dist.a).toBe(0)
    expect(dist.d).toBeGreaterThan(dist.c as number)
    expect(dist.c).toBeGreaterThan(dist.b as number)
  })

  it('escolhe o nó com MAIOR distância de caminho (não a euclidiana)', () => {
    expect(farthestNodeFrom(line, 'a')).toBe('d')
  })

  it('restringe aos candidatos quando informados', () => {
    expect(farthestNodeFrom(line, 'a', ['b', 'c'])).toBe('c')
  })

  it('ignora inalcançáveis e devolve null quando não há candidato', () => {
    const isolated: CityGraph = {
      nodes: { a: { x: 0, y: 0 }, z: { x: 1, y: 1 } },
      adj: { a: [], z: [] },
      markers: {},
    }
    expect(farthestNodeFrom(isolated, 'a')).toBeNull()
  })

  it('desempata alfabeticamente entre distâncias iguais', () => {
    // a no centro; b e c equidistantes (mesma distância de caminho).
    const star: CityGraph = {
      nodes: { a: { x: 0.5, y: 0.5 }, b: { x: 0.5, y: 0.2 }, c: { x: 0.5, y: 0.8 } },
      adj: { a: ['b', 'c'], b: ['a'], c: ['a'] },
      markers: {},
    }
    expect(farthestNodeFrom(star, 'a')).toBe('b')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/pathfinding.test.ts`
Expected: FAIL — `farthestNodeFrom`/`nodeDistancesFrom` não existem.

- [ ] **Step 3: Implementar em `pathfinding.ts`**

Adicionar ao fim de `src/engine/pathfinding.ts`:

```ts
/**
 * Distância de CAMINHO (não euclidiana) de `from` a cada nó alcançável, reusando shortestPath +
 * pathDistance (com o custo de túnel do Dig já embutido). Nós inalcançáveis ficam de fora.
 */
export function nodeDistancesFrom(graph: CityGraph, from: string): Record<string, number> {
  const out: Record<string, number> = {}
  if (!graph.nodes[from]) return out
  for (const id of Object.keys(graph.nodes)) {
    if (id === from) {
      out[id] = 0
      continue
    }
    const path = shortestPath(graph, from, id)
    if (path.length > 0) out[id] = pathDistance(graph, path)
  }
  return out
}

/**
 * Nó com MAIOR distância de caminho a partir de `from` (destino da fuga da Rocket — Feature B).
 * Restrito a `candidates` quando informado (default = todos os nós, exceto `from`). Ignora
 * inalcançáveis; desempate alfabético. Null se não há candidato alcançável.
 */
export function farthestNodeFrom(
  graph: CityGraph,
  from: string,
  candidates?: readonly string[],
): string | null {
  const dist = nodeDistancesFrom(graph, from)
  const pool = candidates ?? Object.keys(graph.nodes)
  let best: string | null = null
  let bestDist = -1
  for (const id of pool) {
    if (id === from) continue
    const d = dist[id]
    if (d === undefined) continue // inalcançável
    if (d > bestDist || (d === bestDist && best !== null && id < best)) {
      bestDist = d
      best = id
    }
  }
  return best
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/pathfinding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/pathfinding.ts src/engine/pathfinding.test.ts
git commit -m "feat(theft): farthestNodeFrom/nodeDistancesFrom (nó mais distante do ginásio)"
```

---

### Task 4: Helpers PUROS do roubo (`engine/theft.ts`) — chance, tempo de fuga, rótulo

**Files:**
- Create: `src/engine/theft.ts`
- Create: `src/engine/theft.test.ts`

**Interfaces:**
- Consumes: `Pokemon` (de `types`); `THEFT_CHANCE_MAX`, `THEFT_FLEE_AGILITY` (Task 1); `graphTravelMs` (de `missions.ts`); `clamp`/`lerp` (de `math.ts`); cores via números puros.
- Produces:
  - `rollNextTheftChance(current: number): number` — dobra com teto `THEFT_CHANCE_MAX`.
  - `theftFleeMs(distance: number): number` — tempo de fuga usando a curva de viagem com agilidade efetiva `THEFT_FLEE_AGILITY` (sem habilidades/itens, sozinha).
  - `theftChanceLabel(percent: number): { label: string; color: string }` — buckets B9 + interpolação verde→vermelho.

- [ ] **Step 1: Escrever os testes**

Criar `src/engine/theft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { rollNextTheftChance, theftFleeMs, theftChanceLabel } from './theft.ts'
import { THEFT_CHANCE_MAX, THEFT_FLEE_AGILITY } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import { makeMon, makeAttrs } from './testkit.ts'

describe('theft — chance', () => {
  it('dobra 1→2→4→…→64', () => {
    expect(rollNextTheftChance(1)).toBe(2)
    expect(rollNextTheftChance(32)).toBe(64)
  })
  it('satura em THEFT_CHANCE_MAX (64→100, 100→100)', () => {
    expect(rollNextTheftChance(64)).toBe(THEFT_CHANCE_MAX)
    expect(rollNextTheftChance(100)).toBe(THEFT_CHANCE_MAX)
  })
})

describe('theft — tempo de fuga', () => {
  it('usa a curva de viagem com agilidade efetiva 10 (= um mon com agilidade 10, sozinho)', () => {
    const flee = makeMon({ id: 'rkt', baseAttrs: makeAttrs({ agilidade: THEFT_FLEE_AGILITY }, 0) })
    // graphTravelMs aplica agilityTravelFactor = clamp(1 - 10*0.01, 0.3, 1) = 0.90.
    expect(theftFleeMs(0.5)).toBeCloseTo(graphTravelMs(0.5, [flee], 1), 5)
  })
  it('distância 0 → tempo 0', () => {
    expect(theftFleeMs(0)).toBe(0)
  })
})

describe('theftChanceLabel — B9', () => {
  it('mapeia os buckets da sequência 1→…→100', () => {
    expect(theftChanceLabel(1).label).toBe('Muito Improvável')
    expect(theftChanceLabel(4).label).toBe('Muito Improvável')
    expect(theftChanceLabel(8).label).toBe('Improvável')
    expect(theftChanceLabel(16).label).toBe('Possível')
    expect(theftChanceLabel(32).label).toBe('Provável')
    expect(theftChanceLabel(64).label).toBe('Muito Provável')
    expect(theftChanceLabel(100).label).toBe('Inevitável')
  })
  it('verde no piso, vermelho no teto (interpola)', () => {
    expect(theftChanceLabel(1).color).toBe('#2ec16a') // verde
    expect(theftChanceLabel(100).color).toBe('#e23b3b') // vermelho
  })
  it('é robusto a valores intermediários (5, 50, 80)', () => {
    expect(theftChanceLabel(5).label).toBe('Improvável') // 4 < 5 ≤ 8
    expect(theftChanceLabel(50).label).toBe('Muito Provável') // 32 < 50 ≤ 64
    expect(theftChanceLabel(80).label).toBe('Inevitável') // 64 < 80 ≤ 100
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/theft.test.ts`
Expected: FAIL — `./theft.ts` não existe.

- [ ] **Step 3: Implementar `engine/theft.ts`**

Criar `src/engine/theft.ts`:

```ts
// Núcleo PURO do Evento de Roubo Rocket (Feature B): progressão da chance, tempo de fuga e o
// rótulo/cor da previsão. Sem RNG e sem React — funções determinísticas reusadas pelo fluxo do
// dia (game/theftFlow.ts) e pela UI (previsão). A orquestração (alvo/spawn/tick) vive em theftFlow.

import type { Pokemon } from '../types/index.ts'
import { THEFT_CHANCE_MAX, THEFT_FLEE_AGILITY } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import { makeFleeTeam } from './theftInternal.ts'
import { clamp, lerp } from './math.ts'

/** Próxima chance de roubo (%): dobra a corrente, saturando em THEFT_CHANCE_MAX. */
export function rollNextTheftChance(current: number): number {
  return Math.min(THEFT_CHANCE_MAX, Math.max(1, Math.round(current)) * 2)
}

/**
 * Tempo (ms de jogo) da Rocket percorrer `distance` (distância de caminho do ginásio ao nó final):
 * usa a MESMA curva de viagem de um Pokémon com THEFT_FLEE_AGILITY de agilidade, sozinho e sem
 * habilidades/itens — então a fuga reaproveita exatamente o tuning de velocidade das missões.
 */
export function theftFleeMs(distance: number): number {
  if (distance <= 0) return 0
  return graphTravelMs(distance, makeFleeTeam(), 1)
}

/** Buckets do rótulo "Chance de Rocket" (B9): limite superior (≤) → palavra. */
const THEFT_LABEL_BUCKETS: readonly { upTo: number; label: string }[] = [
  { upTo: 4, label: 'Muito Improvável' },
  { upTo: 8, label: 'Improvável' },
  { upTo: 16, label: 'Possível' },
  { upTo: 32, label: 'Provável' },
  { upTo: 64, label: 'Muito Provável' },
  { upTo: 100, label: 'Inevitável' },
]

/** Componente RGB interpolado verde→vermelho por t∈[0,1], em hex de 2 dígitos. */
function hex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
}

/**
 * Rótulo + cor da chance de roubo (B9): palavra por bucket (sequência 1→2→4→…→100) e cor que
 * interpola do verde (#2ec16a, perigo baixo) ao vermelho (#e23b3b, perigo máximo) por percent/100.
 */
export function theftChanceLabel(percent: number): { label: string; color: string } {
  const p = clamp(percent, 0, 100)
  const bucket = THEFT_LABEL_BUCKETS.find((b) => p <= b.upTo) ?? THEFT_LABEL_BUCKETS[THEFT_LABEL_BUCKETS.length - 1]!
  const t = p / 100
  // verde (46,193,106) → vermelho (226,59,59)
  const r = lerp(46, 226, t)
  const g = lerp(193, 59, t)
  const b = lerp(106, 59, t)
  return { label: bucket.label, color: `#${hex2(r)}${hex2(g)}${hex2(b)}` }
}
```

> `theftFleeMs` precisa de um "time de fuga" com agilidade 10 para alimentar `graphTravelMs`. Para manter `engine/theft.ts` sem dependência de `testkit` (que NÃO entra no bundle), criar um helper minúsculo:

Criar `src/engine/theftInternal.ts`:

```ts
// Time de fuga PURO da Rocket (agilidade efetiva THEFT_FLEE_AGILITY): um único Pokémon sintético
// usado só para alimentar a curva de graphTravelMs (agilityTravelFactor). Isolado aqui para
// theft.ts não importar testkit (fora do bundle) nem montar Pokémon inline.

import type { Pokemon } from '../types/index.ts'
import { THEFT_FLEE_AGILITY } from './balance.ts'

/** Um "time" de 1 Pokémon com agilidade = THEFT_FLEE_AGILITY e o resto neutro (sem passivas). */
export function makeFleeTeam(): Pokemon[] {
  const zero = {
    batalha: 0,
    inteligencia: 0,
    carisma: 0,
    agilidade: 0,
    resistencia: 0,
    percepcao: 0,
  }
  const mon: Pokemon = {
    id: '__rocket_flee__',
    speciesId: 1,
    level: 1,
    xp: 0,
    types: ['normal'],
    baseAttrs: { ...zero, agilidade: THEFT_FLEE_AGILITY },
    ivs: { ...zero },
    allocations: { ...zero },
    currentHp: 1,
    maxHp: 1,
    status: 'idle',
    passives: [],
    gender: 'genderless',
    nickname: null,
    nature: null,
  }
  return [mon]
}
```

> Em `theft.ts`, ajustar o import para `import { makeFleeTeam } from './theftInternal.ts'` (já está no código acima) e remover o import não usado de `Pokemon` se o lint reclamar.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/theft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/theft.ts src/engine/theftInternal.ts src/engine/theft.test.ts
git commit -m "feat(theft): helpers puros — chance dobrando, tempo de fuga (agi 10), rótulo B9"
```

---

### Task 5: Posições da Rocket e dos perseguidores (`travelerPositions`)

**Files:**
- Modify: `src/engine/travelerPositions.ts`
- Modify: `src/engine/travelerPositions.test.ts`

**Interfaces:**
- Consumes: `TheftEvent`, `GameState` (de `state.ts`); `getCity` (de `cities.ts`); `graphWithTunnels`, `pointAlongPath`, `shortestPath`, `pathDistance`, `segmentLength` (de `pathfinding.ts`); `elapsedFraction` (já existe neste arquivo); `THEFT_INTERCEPT_DISTANCE` (Task 1).
- Produces:
  - `theftPos(graph, theft, now): MapPos | null` — posição da Rocket: interpola `fromNode → targetNode` enquanto `'fleeing'`; trava no `targetNode` em `'atFarNode'`; null em `'armed'/'battle'/'resolved'`.
  - `chaserPositionsAt(s, now): { id: string; pos: MapPos }[]` — cada perseguidor pathfinda do GINÁSIO até a posição ATUAL da Rocket (aproximação: caminho até `targetNode`, interpolado pela fração de tempo desde o dispatch).
  - `theftInterceptorIds(s, now): string[]` — perseguidores cuja posição está a < `THEFT_INTERCEPT_DISTANCE` da Rocket.

> **Modelo do movimento dos perseguidores (documentado):** persistimos apenas `chaserIds` + os timers do evento. A posição de cada perseguidor é DERIVADA (pura) a cada tick: ele segue o menor caminho do ginásio ao `targetNode` (o destino conhecido da Rocket), avançando pela fração `elapsedFraction(now, theft.startedAtMs_doDispatch, chegadaEstimada)`. Como cada perseguidor tem a sua velocidade (via `graphTravelMs` no dispatch), guardamos por perseguidor um `arriveAtMs` no fluxo (Task 7) — mas para a posição usamos um campo simples: o fluxo grava `s.theft.chaserIds` e, no dispatch, um mapa `chaserArriveAtMs` (ver Task 7). Aqui a posição usa esse `arriveAtMs`. Isto evita re-pathfinding por frame e mantém tudo determinístico/persistível (timers, não posições).

> Para não inflar o `TheftEvent` com um `Record`, guardamos os perseguidores como `chaserIds: string[]` + `chaserArriveAtMs: number[]` PARALELO (mesma ordem). Acrescente `chaserArriveAtMs: number[]` ao `TheftEvent` na Task 2 caso ainda não esteja — **AÇÃO:** volte à Task 2 e adicione o campo agora (antes de implementar esta task):
>
> ```ts
>   /** Chegada estimada (ms de jogo) de cada perseguidor ao destino — paralelo a chaserIds. */
>   chaserArriveAtMs: number[]
>   /** Início (ms de jogo) da perseguição de cada perseguidor — paralelo a chaserIds. */
>   chaserStartAtMs: number[]
> ```

- [ ] **Step 0 (pré-req): completar `TheftEvent`**

Em `src/engine/state.ts`, no `TheftEvent`, garantir os campos paralelos `chaserArriveAtMs: number[]` e `chaserStartAtMs: number[]` (ver bloco acima). Commit junto desta task.

- [ ] **Step 1: Escrever os testes**

Adicionar a `src/engine/travelerPositions.test.ts`:

```ts
import { theftPos, chaserPositionsAt, theftInterceptorIds } from './travelerPositions.ts'
import type { TheftEvent } from './state.ts'
import { THEFT_INTERCEPT_DISTANCE } from './balance.ts'

function fleeingTheft(over: Partial<TheftEvent> = {}): TheftEvent {
  return {
    phase: 'fleeing',
    stolenId: 'p9',
    fromNode: 'a',
    targetNode: 'b',
    startedAtMs: 0,
    arriveAtMs: 1000,
    graceUntilMs: 6000,
    chaserIds: [],
    chaserArriveAtMs: [],
    chaserStartAtMs: [],
    trainerId: 'ROCKET_TEAM_MALE',
    enemies: [],
    ...over,
  }
}

describe('theftPos', () => {
  it('interpola fromNode→targetNode na fuga', () => {
    const pos = theftPos(graph, fleeingTheft(), 500) // graph: a={0,0} b={1,0}
    expect(pos?.x).toBeCloseTo(0.5)
  })
  it("trava no targetNode em 'atFarNode'", () => {
    const pos = theftPos(graph, fleeingTheft({ phase: 'atFarNode' }), 5000)
    expect(pos?.x).toBeCloseTo(1)
  })
  it("retorna null em 'armed'/'battle'/'resolved'", () => {
    expect(theftPos(graph, fleeingTheft({ phase: 'armed' }), 500)).toBeNull()
    expect(theftPos(graph, fleeingTheft({ phase: 'battle' }), 500)).toBeNull()
  })
})
```

> Reusar o `graph` já definido no topo do arquivo de teste (a={x:0,y:0}, b={x:1,y:0}). Se o `graph` de teste não tiver os nós necessários, estenda-o no escopo do novo `describe`.

Para `chaserPositionsAt`/`theftInterceptorIds`, montar um estado mínimo via `autoSeedRun` + `s.theft` (parecido com `stormFlow.test.ts`). Como esses dependem do grafo real da cidade 0, derivar a posição-alvo a partir de `theftPos` e checar a relação de proximidade. Casos:

```ts
describe('chaserPositionsAt / theftInterceptorIds', () => {
  it('perseguidor que já chegou ao destino fica em cima da Rocket (intercepta)', () => {
    const s = autoSeedRun(7)
    s.run.phase = 'DAY'
    const id = s.roster[0]!.id
    // Monta um theft cujo fromNode/targetNode são nós reais adjacentes do grafo da cidade 0.
    const { from, target } = pickAdjacentPair(s) // helper local (ver nota)
    s.theft = fleeingTheftReal(from, target, id) // phase 'atFarNode', Rocket parada no target
    const interceptors = theftInterceptorIds(s, /*now*/ 999_999)
    expect(interceptors).toContain(id)
  })

  it('perseguidor que mal começou está longe (não intercepta)', () => {
    const s = autoSeedRun(7)
    s.run.phase = 'DAY'
    const id = s.roster[0]!.id
    const { from, target } = pickAdjacentPair(s)
    s.theft = {
      ...fleeingTheftReal(from, target, id),
      phase: 'fleeing',
      chaserStartAtMs: [1000],
      chaserArriveAtMs: [50_000], // ainda no comecinho
      startedAtMs: 0,
      arriveAtMs: 1000, // Rocket já no destino
    }
    expect(theftInterceptorIds(s, 1100)).not.toContain(id)
  })
})
```

> Nota de teste: `pickAdjacentPair(s)` e `fleeingTheftReal(...)` são helpers LOCAIS simples que leem `getCity(s.run.cityIndex).graph`, pegam o ginásio e um vizinho como `from`, e usam `farthestNodeFrom` como `target`. Reaproveite `farthestNodeFrom` (Task 3). O ponto do teste é a RELAÇÃO (chegou→intercepta; mal começou→não), não coordenadas exatas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/travelerPositions.test.ts`
Expected: FAIL — `theftPos`/`chaserPositionsAt`/`theftInterceptorIds` não existem.

- [ ] **Step 3: Implementar em `travelerPositions.ts`**

Adicionar imports no topo:

```ts
import type { TheftEvent } from './state.ts'
import { pathDistance, segmentLength, shortestPath } from './pathfinding.ts'
import { THEFT_INTERCEPT_DISTANCE } from './balance.ts'
```

Adicionar ao fim do arquivo:

```ts
/**
 * Posição da Rocket em `now` (Feature B): interpola fromNode→targetNode pelo menor caminho
 * enquanto foge; trava no targetNode na janela de graça. Null fora da fuga (armada/batalha/feito).
 */
export function theftPos(graph: CityGraph, theft: TheftEvent, now: number): MapPos | null {
  if (theft.phase === 'fleeing') {
    const path = shortestPath(graph, theft.fromNode, theft.targetNode)
    if (path.length === 0) return null
    return pointAlongPath(graph, path, elapsedFraction(now, theft.startedAtMs, theft.arriveAtMs))
  }
  if (theft.phase === 'atFarNode') {
    const node = graph.nodes[theft.targetNode]
    return node ? { ...node } : null
  }
  return null
}

/**
 * Posições dos perseguidores em `now`: cada um segue o menor caminho do GINÁSIO ao targetNode
 * (destino conhecido da Rocket), avançando pela fração de tempo da SUA perna (chaserStartAtMs →
 * chaserArriveAtMs). Modelo persistível por timers (não por posição). Lista vazia sem perseguição.
 */
export function chaserPositionsAt(s: GameState, now: number): { id: string; pos: MapPos }[] {
  const theft = s.theft
  if (!theft || theft.chaserIds.length === 0) return []
  if (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode') return []
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym
  const path = shortestPath(graph, gym, theft.targetNode)
  if (path.length === 0) return []
  const out: { id: string; pos: MapPos }[] = []
  for (let i = 0; i < theft.chaserIds.length; i++) {
    const id = theft.chaserIds[i] as string
    const start = theft.chaserStartAtMs[i] ?? theft.startedAtMs
    const arrive = theft.chaserArriveAtMs[i] ?? theft.arriveAtMs
    out.push({ id, pos: pointAlongPath(graph, path, elapsedFraction(now, start, arrive)) })
  }
  return out
}

/** Perseguidores cuja posição está a < THEFT_INTERCEPT_DISTANCE da Rocket em `now`. */
export function theftInterceptorIds(s: GameState, now: number): string[] {
  const theft = s.theft
  if (!theft) return []
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const rocket = theftPos(graph, theft, now)
  if (!rocket) return []
  const hit: string[] = []
  for (const { id, pos } of chaserPositionsAt(s, now)) {
    if (segmentLength(rocket, pos) < THEFT_INTERCEPT_DISTANCE * 16) hit.push(id)
  }
  return hit
}
```

> **Nota importante sobre o limiar:** `segmentLength` já multiplica por `MAP_ASPECT_W`(=16)/`MAP_ASPECT_H`(=9). Como `THEFT_INTERCEPT_DISTANCE` é uma fração da LARGURA, comparamos com `THEFT_INTERCEPT_DISTANCE * 16` (igual ao padrão do `pointInCircle` da Tempestade: `radius * MAP_ASPECT_W`). Importar `MAP_ASPECT_W` de `./constants.ts` e usar `THEFT_INTERCEPT_DISTANCE * MAP_ASPECT_W` em vez do literal 16 (DRY).

Ajuste o import: `import { MAP_ASPECT_W } from './constants.ts'` e troque `* 16` por `* MAP_ASPECT_W`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/travelerPositions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/travelerPositions.ts src/engine/travelerPositions.test.ts
git commit -m "feat(theft): posições puras da Rocket + perseguidores + interceptação"
```

---

### Task 6: Fluxo do roubo — roll, elegibilidade e spawn (`game/theftFlow.ts` parte 1)

**Files:**
- Create: `src/game/theftFlow.ts`
- Create: `src/game/theftFlow.test.ts`

**Interfaces:**
- Consumes: `GameState`, `TheftEvent`, `markActive` (de `state.ts`); `rollNextTheftChance`, `theftFleeMs` (Task 4); `farthestNodeFrom`, `nodeDistancesFrom`, `shortestPath`, `pathDistance` (Task 3 / pathfinding); `graphWithTunnels` (pathfinding); `getCity` (cities); `generateDefenseEnemies`, `rollSquadSize` (gymDefense); `getTrainer` (trainers); `takeRng`, `findMon`, `replaceMon` (runtime); `ROCKET_TRAINER_IDS` (types); `THEFT_CHANCE_START` (balance).
- Produces:
  - `AWAY_FROM_GYM_STATUSES: ReadonlySet<Pokemon['status']>` (export, p/ reuso/teste)
  - `eligibleTheftTargets(s): Pokemon[]` — idle ou fainted E fisicamente no ginásio.
  - `rollTheftAtDayOpen(s): void` — uma rolagem; acerta→arma (`s.theft` fase 'armed'); erra→`run.theftChance` dobra.
  - `spawnTheft(s, now): void` — se armado e há alvo elegível: escolhe alvo→'stolen', fromNode (adjacente ao ginásio), targetNode (mais distante), arma timers, esquadrão, e reseta `run.theftChance = 1`.

> **Como derivar "fisicamente no ginásio" do `PokemonStatus` (documentado):** um Pokémon é roubável quando está `idle` OU `fainted` (KO no ginásio) E **não** está fora. Estão "fora": os status de `AWAY_STATUSES` do `dayClock` (`traveling`, `onMission`, `returning`, `defending`), além de `atCenter` (no Centro) e dos buscadores de captura (id presente em `s.captureSearches`/`s.captureReturns`/`s.encounters`). `'stolen'` também é excluído (não pode ser roubado duas vezes). Resumo:
> - elegível ⟺ `status ∈ {idle, fainted}` E `id ∉ buscadores` E `status ≠ atCenter`.
> - (idle/fainted já excluem traveling/onMission/returning/defending/stolen por definição.)

- [ ] **Step 1: Escrever os testes**

Criar `src/game/theftFlow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { eligibleTheftTargets, rollTheftAtDayOpen, spawnTheft } from './theftFlow.ts'
import { THEFT_CHANCE_START } from '../engine/balance.ts'
import { makeMon } from '../engine/testkit.ts'
import type { GameState } from '../engine/state.ts'

function dayState(seed = 1): GameState {
  const s = autoSeedRun(seed)
  s.run.phase = 'DAY'
  return s
}

describe('eligibleTheftTargets', () => {
  it('inclui idle e fainted no ginásio; exclui fora/centro/buscadores/stolen', () => {
    const s = dayState()
    s.roster = [
      makeMon({ id: 'i', status: 'idle' }),
      makeMon({ id: 'f', status: 'fainted', currentHp: 0 }),
      makeMon({ id: 't', status: 'traveling' }),
      makeMon({ id: 'c', status: 'atCenter' }),
      makeMon({ id: 'd', status: 'defending' }),
      makeMon({ id: 'b', status: 'idle' }), // buscador
      makeMon({ id: 's', status: 'stolen' }),
    ]
    s.captureSearches = [
      { searcherId: 'b', spotIndex: 0, node: 'x', path: ['x'], phase: 'searching', departAtMs: 0, arriveAtMs: 0, readyAtMs: 0 },
    ]
    const ids = eligibleTheftTargets(s).map((p) => p.id)
    expect(ids.sort()).toEqual(['f', 'i'])
  })
})

describe('rollTheftAtDayOpen', () => {
  it('na falha, a chance dobra e nada é armado', () => {
    const s = dayState()
    s.run.theftChance = 1 // 1% → quase certo falhar com a maioria das seeds
    // Forçar falha: chance baixa; se a seed acertar, repetir com outra seed no helper.
    rollTheftAtDayOpen(s)
    if (!s.theft) {
      expect(s.run.theftChance).toBe(2)
    } else {
      expect(s.theft.phase).toBe('armed')
    }
  })

  it('na vitória, arma o evento (fase armed) e NÃO reseta a chance ainda', () => {
    const s = dayState()
    s.run.theftChance = 100 // acerto garantido
    rollTheftAtDayOpen(s)
    expect(s.theft?.phase).toBe('armed')
    expect(s.run.theftChance).toBe(100) // só reseta ao DISPARAR (spawn)
  })
})

describe('spawnTheft', () => {
  it('arma → dispara quando há alvo: marca stolen, define nós/timers e reseta a chance p/ 1', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s) // fase 'armed'
    s.roster = [makeMon({ id: 'p1', status: 'idle' })]
    spawnTheft(s, 0)
    const t = s.theft!
    expect(t.phase).toBe('fleeing')
    expect(t.stolenId).toBe('p1')
    expect(s.roster.find((p) => p.id === 'p1')!.status).toBe('stolen')
    expect(t.fromNode).not.toBe('')
    expect(t.targetNode).not.toBe('')
    expect(t.arriveAtMs).toBeGreaterThan(0)
    expect(t.graceUntilMs).toBe(t.arriveAtMs + 5_000)
    expect(t.enemies.length).toBeGreaterThan(0)
    expect(s.run.theftChance).toBe(THEFT_CHANCE_START) // reset SÓ ao disparar
  })

  it('armado sem alvo: NÃO dispara e NÃO reseta (disparo adiado)', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'traveling' })] // ninguém no ginásio
    spawnTheft(s, 0)
    expect(s.theft!.phase).toBe('armed')
    expect(s.run.theftChance).toBe(100)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/theftFlow.test.ts`
Expected: FAIL — `./theftFlow.ts` não existe.

- [ ] **Step 3: Implementar a parte 1 de `game/theftFlow.ts`**

Criar `src/game/theftFlow.ts`:

```ts
// Orquestração do Evento de Roubo Rocket (Feature B). Espelha defenseFlow/rocketFlow: rolagem no
// dia-aberto, spawn com DISPARO ADIADO (espera um alvo no ginásio), avanço da fuga/perseguição no
// tick e resolução da batalha de resgate (reusa resolveDefense). O relógio CORRE concorrente
// durante a fuga; a batalha de resgate é modal e pausa o relógio (set speed 0), igual à defesa.

import type { Pokemon } from '../types/index.ts'
import type { GameState, TheftEvent } from '../engine/state.ts'
import { markActive } from '../engine/state.ts'
import { ROCKET_TRAINER_IDS } from '../types/index.ts'
import { getCity } from '../data/cities.ts'
import { getTrainer } from '../data/trainers.ts'
import { graphWithTunnels, shortestPath, pathDistance, farthestNodeFrom } from '../engine/pathfinding.ts'
import { generateDefenseEnemies, rollSquadSize } from '../engine/gymDefense.ts'
import { rollNextTheftChance, theftFleeMs } from '../engine/theft.ts'
import { THEFT_CHANCE_START, THEFT_GRACE_MS } from '../engine/balance.ts'
import { findMon, replaceMon, takeRng } from './runtime.ts'

/** Status que põem o Pokémon FORA do ginásio (não roubável). Espelha AWAY_STATUSES do dayClock. */
const AWAY_FROM_GYM_STATUSES: ReadonlySet<Pokemon['status']> = new Set([
  'traveling',
  'onMission',
  'returning',
  'defending',
  'atCenter',
  'stolen',
])

/** Ids ocupados em exploração/captura (buscando, voltando ou em encontro) — fora do ginásio. */
function captureBusyIds(s: GameState): Set<string> {
  const ids = new Set<string>()
  for (const c of s.captureSearches) ids.add(c.searcherId)
  for (const r of s.captureReturns) ids.add(r.searcherId)
  for (const e of s.encounters) ids.add(e.searcherId)
  return ids
}

/**
 * Pokémon roubáveis = presentes no ginásio: idle OU derrotado (fainted), e NÃO fora (viajando/
 * em missão/voltando/defendendo/no Centro/já roubado) nem buscando captura. (B2.)
 */
export function eligibleTheftTargets(s: GameState): Pokemon[] {
  const busy = captureBusyIds(s)
  return s.roster.filter(
    (p) => (p.status === 'idle' || p.status === 'fainted') && !AWAY_FROM_GYM_STATUSES.has(p.status) && !busy.has(p.id),
  )
}

/** Esqueleto de um evento 'armed' (sem alvo/nós/timers ainda). */
function armedTheft(trainerId: TheftEvent['trainerId']): TheftEvent {
  return {
    phase: 'armed',
    stolenId: null,
    fromNode: '',
    targetNode: '',
    startedAtMs: -1,
    arriveAtMs: -1,
    graceUntilMs: -1,
    chaserIds: [],
    chaserArriveAtMs: [],
    chaserStartAtMs: [],
    trainerId,
    enemies: [],
  }
}

/**
 * Rolagem ÚNICA no início do dia (B1): acerta → arma o evento (fase 'armed', sem alvo); erra →
 * run.theftChance DOBRA. A chance só reseta ao DISPARAR de fato (spawnTheft). No máx. 1×/dia.
 */
export function rollTheftAtDayOpen(s: GameState): void {
  if (s.theft) return // já existe evento hoje (idempotente)
  const rng = takeRng(s)
  const hit = rng.bool(s.run.theftChance / 100)
  if (!hit) {
    s.run.theftChance = rollNextTheftChance(s.run.theftChance)
    return
  }
  // Treinador Rocket sorteado já aqui (estável para o evento do dia).
  const trainerId = rng.pick(ROCKET_TRAINER_IDS)
  s.theft = armedTheft(trainerId)
}

/**
 * Dispara o roubo quando há alvo elegível (B2/B3): escolhe um alvo aleatório → 'stolen', define o
 * nó de spawn (adjacente ao ginásio) e o destino (nó mais distante por caminho), arma timers de
 * fuga (theftFleeMs) e a janela de graça, gera o esquadrão (dimensionado pelo dia) e RESETA a
 * chance p/ 1. Sem alvo, NÃO dispara nem reseta (disparo adiado).
 */
export function spawnTheft(s: GameState, now: number): void {
  const theft = s.theft
  if (!theft || theft.phase !== 'armed') return
  const targets = eligibleTheftTargets(s)
  if (targets.length === 0) return // disparo adiado — espera um alvo

  const rng = takeRng(s)
  const target = rng.pick(targets)
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym

  // Nó de spawn: um vizinho do ginásio (adjacente). Fallback = o próprio ginásio.
  const neighbors = (graph.adj[gym] ?? []).filter((n) => graph.nodes[n])
  const fromNode = neighbors.length > 0 ? rng.pick(neighbors) : gym
  // Destino: nó mais distante do ginásio por distância de caminho.
  const targetNode = farthestNodeFrom(graph, gym) ?? fromNode

  const path = shortestPath(graph, fromNode, targetNode)
  const distance = pathDistance(graph, path)
  const flee = theftFleeMs(distance)
  const arriveAtMs = now + Math.max(1, Math.round(flee))

  // Esquadrão de resgate: igual à defesa de ginásio (tamanho pelo dia + inimigos + medalhas).
  const trainer = getTrainer(theft.trainerId)
  const size = rollSquadSize(rng, s.run.day)
  const enemies = generateDefenseEnemies(rng, trainer, size, s.run.day)

  replaceMon(s, { ...target, status: 'stolen' })
  s.theft = {
    ...theft,
    phase: 'fleeing',
    stolenId: target.id,
    fromNode,
    targetNode,
    startedAtMs: now,
    arriveAtMs,
    graceUntilMs: arriveAtMs + THEFT_GRACE_MS,
    enemies,
  }
  // A chance só zera quando o roubo DISPARA (B1).
  s.run.theftChance = THEFT_CHANCE_START
}
```

> Importar o tipo `TheftEvent['trainerId']` exige `TrainerId`; ajuste o import: `import type { TrainerId } from '../types/index.ts'` e use `armedTheft(trainerId: TrainerId)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/game/theftFlow.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/theftFlow.ts src/game/theftFlow.test.ts
git commit -m "feat(theft): roll no dia-aberto + elegibilidade + spawn com disparo adiado"
```

---

### Task 7: Fluxo do roubo — tick, dispatch e resolução (`game/theftFlow.ts` parte 2)

**Files:**
- Modify: `src/game/theftFlow.ts`
- Modify: `src/game/theftFlow.test.ts`

**Interfaces:**
- Consumes: `theftPos`, `theftInterceptorIds` (Task 5); `resolveDefense`, `gymWinXp`, `canDefend` (gymDefense); `applyBattleSecretRuntime` (defenseFlow); `applyXpGains` (itemFlow); `applyHeartDelta`, `heartsOf` (hearts); `settleFaintTracked`, `findMon`, `replaceMon`, `takeRng` (runtime); `createRng` (rng); `damageForDay` (constants); `sturdyAvailable` (secretEffects); `markActive`; `THEFT_CHASERS_MAX`, `THEFT_XP_MULTIPLIER`, `THEFT_GRACE_MS` (balance); `graphTravelMs` (missions) p/ o tempo de chegada do perseguidor.
- Produces:
  - `processTheft(s, now): void` — avança a fase: 'armed'→tenta `spawnTheft`; 'fleeing'→detecta chegada ao destino (→'atFarNode' + flag de aviso) e interceptação (→`enterTheftBattle`); 'atFarNode'→interceptação OU expiração da graça (→`resolveTheftLoss`).
  - `dispatchTheftChasers(s, chaserIds): void` — até 3 idle; grava timers de chegada por perseguidor; marca `defending`? (ver nota de status) e `markActive`.
  - `enterTheftBattle(s, now): void` — pausa o relógio e muda a fase p/ 'battle'.
  - `resolveTheftBattle(s): void` — reusa `resolveDefense`; vitória → recupera o Pokémon (idle, mesmo HP) + 3× XP de ginásio; derrota → `resolveTheftLoss`; reseta chance; libera perseguidores.
  - `completeTheftBattle(s): void` — aplica o XP (após a animação), idempotente; libera perseguidores; fase 'resolved'.
  - `resolveTheftLoss(s): void` — remove o Pokémon roubado do roster + todo roster −1 coração; fase 'resolved'.

> **Status dos perseguidores (documentado):** ao despachar, os perseguidores saem do ginásio. Não há status dedicado; reusamos `'defending'` (já é "ocupado, fora do roster jogável" e impede o fim do dia via `AWAY_STATUSES`). Eles voltam a `'idle'` ao resolver/perder o evento. (Alternativa seria `'traveling'`, mas `'defending'` evita que o `dayComplete` precise de uma missão associada.)

> **Pausa do relógio na batalha (documentado e confirmado):** `assignDefense` resolve a batalha na hora e o painel só anima; mas a defesa, quando o painel está aberto, mantém o jogador atento; o relógio NÃO é pausado pela defesa porque a resolução é instantânea no dispatch. Para o RESGATE, a interceptação acontece no tick (concorrente), então pausamos o relógio ao ENTRAR na batalha (`enterTheftBattle` faz `s.clock.speed = 0`) — espelhando o efeito prático do modal de defesa (que abre via seleção e o jogador clica). Isso evita que outras missões resolvam "por baixo" enquanto a animação roda. Documentar no header do módulo.

- [ ] **Step 1: Escrever os testes (tick/dispatch/resolução)**

Adicionar a `src/game/theftFlow.test.ts`:

```ts
import {
  dispatchTheftChasers,
  processTheft,
  resolveTheftBattle,
  completeTheftBattle,
  resolveTheftLoss,
} from './theftFlow.ts'
import { heartsOf } from '../engine/hearts.ts'

describe('processTheft — fuga e chegada', () => {
  it("fleeing → atFarNode quando now ≥ arriveAtMs", () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' })]
    spawnTheft(s, 0)
    const arrive = s.theft!.arriveAtMs
    processTheft(s, arrive + 1)
    expect(s.theft!.phase).toBe('atFarNode')
  })

  it("atFarNode → resolved (perda) quando a graça expira sem interceptação", () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0)
    const grace = s.theft!.graceUntilMs
    const heartsBefore = heartsOf(s.roster.find((p) => p.id === 'p2')!.hearts)
    processTheft(s, grace + 1)
    expect(s.theft!.phase).toBe('resolved')
    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined() // removido
    expect(heartsOf(s.roster.find((p) => p.id === 'p2')!.hearts)).toBe(heartsBefore - 0.5)
  })
})

describe('dispatchTheftChasers', () => {
  it('despacha no máx. 3 idle e marca defending', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle' }), // será o alvo
      makeMon({ id: 'c1', status: 'idle' }),
      makeMon({ id: 'c2', status: 'idle' }),
      makeMon({ id: 'c3', status: 'idle' }),
      makeMon({ id: 'c4', status: 'idle' }),
    ]
    spawnTheft(s, 0)
    dispatchTheftChasers(s, ['c1', 'c2', 'c3', 'c4'])
    expect(s.theft!.chaserIds.length).toBe(3)
    expect(s.roster.find((p) => p.id === 'c1')!.status).toBe('defending')
  })
})

describe('resolveTheftBattle', () => {
  it('vitória recupera o Pokémon (idle, mesmo HP) e reseta a perseguição', () => {
    const s = dayState()
    s.run.day = 1
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle', currentHp: 3 }), // alvo (HP 3)
      makeMon({ id: 'c1', status: 'idle', baseAttrs: { ...zero, batalha: 60 } }),
    ]
    spawnTheft(s, 0)
    s.theft!.enemies = [{ battle: 1, types: ['normal'] }] // garante vitória do c1
    dispatchTheftChasers(s, ['c1'])
    s.theft!.phase = 'battle'
    resolveTheftBattle(s)
    expect(s.theft!.won).toBe(true)
    const recovered = s.roster.find((p) => p.id === 'p1')!
    expect(recovered.status).toBe('idle')
    expect(recovered.currentHp).toBe(3) // mesmo HP
  })

  it('derrota perde o Pokémon e tira 1 coração de todo o roster', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle' }),
      makeMon({ id: 'c1', status: 'idle', baseAttrs: { ...zero, batalha: 1 } }),
    ]
    spawnTheft(s, 0)
    s.theft!.enemies = [{ battle: 60, types: ['normal'] }] // c1 perde
    dispatchTheftChasers(s, ['c1'])
    s.theft!.phase = 'battle'
    const before = heartsOf(s.roster.find((p) => p.id === 'c1')!.hearts)
    resolveTheftBattle(s)
    expect(s.theft!.won).toBe(false)
    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined()
    expect(heartsOf(s.roster.find((p) => p.id === 'c1')!.hearts)).toBe(before - 0.5)
  })
})
```

> `zero` é um Attrs zerado local (`import { zeroAttrs } from '../engine/attributes.ts'; const zero = zeroAttrs()`). `makeMon` deriva HP da Resistência; para HP 3 fixe `currentHp:3, maxHp:3` no override. Em "vitória", o esquadrão inimigo é substituído por 1 fraco — isso desvia do `enemies` gerado no spawn, o que é proposital para tornar o duelo determinístico no teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/theftFlow.test.ts`
Expected: FAIL — funções de tick/dispatch/resolução não existem.

- [ ] **Step 3: Implementar a parte 2 de `theftFlow.ts`**

Adicionar imports no topo de `theftFlow.ts`:

```ts
import { resolveDefense, gymWinXp, canDefend } from '../engine/gymDefense.ts'
import { applyBattleSecretRuntime } from './defenseFlow.ts'
import { sturdyAvailable } from '../engine/secretEffects.ts'
import { applyXpGains } from './itemFlow.ts'
import { applyHeartDelta, heartsOf } from '../engine/hearts.ts'
import { settleFaintTracked } from './runtime.ts'
import { createRng } from '../engine/rng.ts'
import { damageForDay } from '../engine/constants.ts'
import { graphTravelMs } from '../engine/missions.ts'
import { theftInterceptorIds } from '../engine/travelerPositions.ts'
import { THEFT_CHASERS_MAX, THEFT_XP_MULTIPLIER, HP_LOSS_PER_DEFENSE_LOSS } from '../engine/balance.ts'
```

> `HP_LOSS_PER_DEFENSE_LOSS` está em `constants.ts`, não em `balance.ts` — importar de `'../engine/constants.ts'` junto de `damageForDay`. Ajuste os imports conforme os módulos reais.

Adicionar ao fim de `theftFlow.ts`:

```ts
/** Libera os perseguidores (voltam a idle) e zera a lista — fim da perseguição. */
function releaseChasers(s: GameState): void {
  const theft = s.theft
  if (!theft) return
  for (const id of theft.chaserIds) {
    const mon = findMon(s, id)
    if (mon && mon.status === 'defending') replaceMon(s, { ...mon, status: 'idle' })
  }
}

/** Tira 1 coração de TODO o roster (desfecho de falha — B7). */
function allRosterMinusOneHeart(s: GameState): void {
  s.roster = s.roster.map((p) => ({ ...p, hearts: applyHeartDelta(p.hearts, -1) }))
}

/**
 * Desfecho de FALHA (perda da batalha OU fuga na janela de graça — B7): remove o Pokémon roubado
 * do roster e tira 1 coração de todo o resto. Reseta a perseguição e marca 'resolved'.
 */
export function resolveTheftLoss(s: GameState): void {
  const theft = s.theft
  if (!theft || theft.phase === 'resolved') return
  releaseChasers(s)
  if (theft.stolenId) s.roster = s.roster.filter((p) => p.id !== theft.stolenId)
  allRosterMinusOneHeart(s)
  s.theft = { ...theft, phase: 'resolved', won: false, resolved: true }
}

/** Entra na batalha de resgate: pausa o relógio (modal) e muda a fase p/ 'battle'. */
export function enterTheftBattle(s: GameState, _now: number): void {
  const theft = s.theft
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return
  s.theft = { ...theft, phase: 'battle' }
  s.clock.speed = 0
}

/**
 * Avança o evento de roubo no tick (concorrente com o dia):
 * - 'armed': tenta disparar (spawnTheft) — disparo adiado até haver alvo.
 * - 'fleeing': se um perseguidor interceptou → batalha; senão, ao chegar ao destino → 'atFarNode'.
 * - 'atFarNode': interceptou na graça → batalha; graça expirou → perda.
 */
export function processTheft(s: GameState, now: number): void {
  const theft = s.theft
  if (!theft) return
  if (theft.phase === 'armed') {
    spawnTheft(s, now)
    return
  }
  if (theft.phase === 'fleeing') {
    if (theftInterceptorIds(s, now).length > 0) {
      enterTheftBattle(s, now)
      return
    }
    if (now >= theft.arriveAtMs) {
      s.theft = { ...theft, phase: 'atFarNode' }
    }
    return
  }
  if (theft.phase === 'atFarNode') {
    if (theftInterceptorIds(s, now).length > 0) {
      enterTheftBattle(s, now)
      return
    }
    if (now >= theft.graceUntilMs) resolveTheftLoss(s)
  }
}

/**
 * Despacha até THEFT_CHASERS_MAX Pokémon idle atrás da Rocket (B4). Cada perseguidor recebe o seu
 * tempo de chegada ao destino (pela própria velocidade via graphTravelMs), gravado em paralelo a
 * chaserIds. Sai do ginásio como 'defending' (ocupado) e conta como participante do dia.
 */
export function dispatchTheftChasers(s: GameState, chaserIds: readonly string[]): void {
  const theft = s.theft
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return
  const now = s.clock.dayElapsedMs
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym
  const distance = pathDistance(graph, shortestPath(graph, gym, theft.targetNode))

  const picked: string[] = []
  const arriveAt: number[] = []
  const startAt: number[] = []
  for (const id of chaserIds) {
    if (picked.length >= THEFT_CHASERS_MAX) break
    if (theft.chaserIds.includes(id)) continue
    const mon = findMon(s, id)
    if (!mon || mon.status !== 'idle') continue
    const travel = graphTravelMs(distance, [mon], 1)
    picked.push(id)
    startAt.push(now)
    arriveAt.push(now + Math.max(1, Math.round(travel)))
    replaceMon(s, { ...mon, status: 'defending' })
    markActive(s.today, id)
  }
  if (picked.length === 0) return
  s.theft = {
    ...theft,
    chaserIds: [...theft.chaserIds, ...picked],
    chaserArriveAtMs: [...theft.chaserArriveAtMs, ...arriveAt],
    chaserStartAtMs: [...theft.chaserStartAtMs, ...startAt],
  }
}

/**
 * Resolve a batalha de resgate (cadeia de duelos 1v1; reusa resolveDefense — perseguidores tomam
 * dano/desmaiam). Vitória: recupera o Pokémon roubado (idle, MESMO HP) e marca a vitória; derrota:
 * resolveTheftLoss. Idempotente (não resolve duas vezes). O XP é APLICADO em completeTheftBattle.
 */
export function resolveTheftBattle(s: GameState): void {
  const theft = s.theft
  if (!theft || theft.phase !== 'battle' || theft.resolved) return
  const squad = theft.chaserIds
    .map((id) => findMon(s, id))
    .filter((p): p is Pokemon => p !== undefined)
  // Sem perseguidor disponível: trata como derrota (ninguém para lutar).
  if (!canDefend(squad)) {
    resolveTheftLoss(s)
    return
  }
  for (const p of squad) markActive(s.today, p.id)
  const sturdyAvailableIds = new Set(
    squad.filter((p) => sturdyAvailable(p, s.today.secretRuntime)).map((p) => p.id),
  )
  const resolution = resolveDefense(takeRng(s), squad, theft.enemies, {
    sturdyAvailableIds,
    runItems: s.runItems,
    damagePerLoss: damageForDay(s.run.day),
    paralyzedIds: new Set(s.today.paralyzedBattleIds),
  })
  for (const member of resolution.squad) replaceMon(s, settleFaintTracked(s, member))
  applyBattleSecretRuntime(s, squad, resolution)

  if (resolution.won) {
    // Recupera o Pokémon roubado: volta a idle mantendo o HP que tinha (derrotado continua KO).
    const stolen = theft.stolenId
      ? s.roster.find((p) => p.id === theft.stolenId)
      : undefined
    if (stolen) {
      replaceMon(s, { ...stolen, status: stolen.currentHp > 0 ? 'idle' : 'fainted' })
    }
    s.theft = {
      ...theft,
      phase: 'battle',
      duels: resolution.duels,
      won: true,
      resolved: true,
      xpSeed: takeRng(s).int(0, 0x7fffffff),
    }
  } else {
    // Derrota: aplica o log antes de perder, p/ a animação mostrar a batalha; depois o desfecho.
    s.theft = { ...theft, duels: resolution.duels, won: false }
    resolveTheftLoss(s)
  }
}

/**
 * Conclui a batalha de resgate ao fim da animação (só na vitória): aplica 3× o XP de uma batalha de
 * ginásio por duelo vencido, libera os perseguidores e marca 'resolved'. Idempotente.
 */
export function completeTheftBattle(s: GameState): void {
  const theft = s.theft
  if (!theft || theft.phase === 'resolved') return
  if (theft.won && theft.duels) {
    const xpById = new Map<string, number>()
    let theirs = 0
    for (const duel of theft.duels) {
      if (!duel.youWon) continue
      const enemy = theft.enemies[theirs]
      if (enemy) {
        const base = gymWinXp(enemy.battle) * THEFT_XP_MULTIPLIER
        xpById.set(duel.yourId, (xpById.get(duel.yourId) ?? 0) + base)
      }
      theirs += 1
    }
    applyXpGains(s, xpById, createRng(theft.xpSeed ?? 0))
    for (const xp of xpById.values()) s.today.xpEarned += xp
  }
  releaseChasers(s)
  s.theft = { ...theft, phase: 'resolved', resolved: true }
}
```

> `_now` em `enterTheftBattle` é intencionalmente não usado (mantém assinatura simétrica/legível). Se o lint reclamar de parâmetro não usado, renomeie para `enterTheftBattle(s: GameState): void` e ajuste os chamadores.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/game/theftFlow.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/theftFlow.ts src/game/theftFlow.test.ts
git commit -m "feat(theft): tick (fuga/interceptação/graça), dispatch e batalha de resgate"
```

---

### Task 8: Integração no relógio + abertura/fechamento do dia

**Files:**
- Modify: `src/game/dayClock.ts` (chamar `processTheft` no tick)
- Modify: `src/game/phaseFlow.ts` (rolar no dia-aberto; fechar o roubo no `resolveLeftovers`)
- Modify: `src/game/setup.ts` (garantir `run.theftChance` inicial — já vem de `createInitialState`; nada extra além de NÃO recriar `s.theft`)
- Modify: `src/game/dayClock.test.ts` (se existir) ou cobrir via `theftFlow.test.ts` (já feito)

**Interfaces:**
- Consumes: `processTheft`, `rollTheftAtDayOpen`, `resolveTheftBattle`, `completeTheftBattle`, `resolveTheftLoss` (Tasks 6/7).
- Produces: o evento é avançado a cada tick; rolado uma vez ao entrar no DAY; fechado no fim do dia.

- [ ] **Step 1: Ligar `processTheft` no `dayClock.tick`**

Em `src/game/dayClock.ts`:
- Adicionar import: `import { processTheft } from './theftFlow.ts'`.
- Em `tick`, após `processSearches(s, now)` e antes de `processStorms`:

```ts
  processSearches(s, now)

  processTheft(s, now)
  processStorms(s, prevMs, now)
```

> Ordem: o roubo antes da tempestade não importa para correção (são independentes); mantemos perto dos demais eventos do dia. `processTheft` pode mudar `clock.speed` para 0 (entrar em batalha) — o `tick` corrente termina normalmente; o próximo frame fica pausado (o jogador resolve o modal).

- [ ] **Step 2: Rolar no dia-aberto em `phaseFlow.advancePhase`**

Em `src/game/phaseFlow.ts`:
- Adicionar import: `import { rollTheftAtDayOpen, resolveTheftBattle, completeTheftBattle, resolveTheftLoss } from './theftFlow.ts'`.
- No `advancePhase`, no case `'MORNING'`, APÓS `setupDay(s)`:

```ts
    case 'MORNING':
      s.run.phase = 'DAY'
      setupDay(s)
      rollTheftAtDayOpen(s) // B1: uma rolagem por dia (arma ou dobra a chance)
      return
```

> `setupDay` chama `takeRng` várias vezes; `rollTheftAtDayOpen` usa `takeRng(s)` DEPOIS, mantendo o cursor estável e isolando o salt via `deriveSeed(seed, day, cursor)` (o `takeRng` já compõe o dia). Para isolar ainda mais o roubo de outras sequências, NÃO é necessário um salt aqui — o cursor garante reprodutibilidade. (O `THEFT_SEED_SALT` fica reservado para usos puros futuros; documente que o fluxo usa `takeRng`.)

- [ ] **Step 3: Fechar o roubo em `resolveLeftovers` (fim do dia)**

Em `src/game/phaseFlow.ts`, dentro de `resolveLeftovers(s)`, ao final (após o loop de defesas/captura), adicionar:

```ts
  // Evento de Roubo Rocket pendente no fechamento: armado sem disparar fica como estava (a chance
  // segue dobrando amanhã); em fuga/graça vira perda; em batalha resolve automaticamente.
  const theft = s.theft
  if (theft) {
    if (theft.phase === 'fleeing' || theft.phase === 'atFarNode') {
      resolveTheftLoss(s)
    } else if (theft.phase === 'battle') {
      resolveTheftBattle(s)
      completeTheftBattle(s)
    }
    // 'armed' (sem alvo) e 'resolved' não exigem ação.
  }
```

> O `dayComplete`/`AWAY_STATUSES` já impede o dia de fechar com perseguidores `defending` fora; mas no fechamento forçado (`finalizeDay`), `releaseChasers` (chamado por `resolveTheftLoss`/`completeTheftBattle`) os devolve a idle, então o `healRoster` da virada do dia os cura normalmente.

- [ ] **Step 4: Limpar `s.theft` na virada do dia**

Em `src/game/phaseFlow.ts`, em `startNextDay(s)`, junto da limpeza de `missions/defenses/...`, adicionar:

```ts
  s.theft = undefined
```

(O `run.theftChance` PERSISTE entre dias — só reseta ao disparar.)

- [ ] **Step 5: Rodar a suíte de orquestração + type-check**

Run: `npx vitest run src/game` e `npm run build`
Expected: PASS / sem erros de tipo.

> Se algum teste de `phaseFlow`/`dayClock` montava o estado esperando `s.theft` ausente e agora `rollTheftAtDayOpen` cria um evento (quando `theftChance` é alto), ajuste: a maioria das runs começa com `theftChance = 1` (raríssimo armar). Testes determinísticos que avançam MORNING→DAY com seed fixa podem, por azar, armar — nesse caso afirme apenas o que o teste valida e/ou force `s.run.theftChance = 0`? Não: a chance mínima é 1. Se um teste existente quebrar por isso, defina `s.theft = undefined` logo após `advancePhase` no teste, OU verifique que `theftChance` baixo quase nunca arma (1%). Documente qualquer ajuste pontual.

- [ ] **Step 6: Commit**

```bash
git add src/game/dayClock.ts src/game/phaseFlow.ts
git commit -m "feat(theft): integra no tick, rola no dia-aberto e fecha no fim do dia"
```

---

### Task 9: Ações + reducer (DISPATCH_THEFT_CHASERS / RESOLVE_THEFT_BATTLE / COMPLETE_THEFT_BATTLE)

**Files:**
- Modify: `src/game/actions.ts`
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts` (adicionar casos, espelhando os de defesa/rocket existentes)

**Interfaces:**
- Consumes: `dispatchTheftChasers`, `resolveTheftBattle`, `completeTheftBattle` (Task 7).
- Produces:
  - `GameAction` ganha `{ type: 'DISPATCH_THEFT_CHASERS'; chaserIds: string[] }`, `{ type: 'RESOLVE_THEFT_BATTLE' }`, `{ type: 'COMPLETE_THEFT_BATTLE' }`.

- [ ] **Step 1: Escrever o teste do wiring**

Adicionar a `src/game/reducer.test.ts` um caso que arma+dispara um roubo, despacha um perseguidor via ação e confirma a mudança de estado (sem mutar a entrada):

```ts
import { reducer } from './reducer.ts'

it('DISPATCH_THEFT_CHASERS adiciona perseguidores ao evento (sem mutar a entrada)', () => {
  const base = autoSeedRun(3)
  base.run.phase = 'DAY'
  base.run.theftChance = 100
  rollTheftAtDayOpen(base)
  base.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'c1', status: 'idle' })]
  spawnTheft(base, 0)
  const next = reducer(base, { type: 'DISPATCH_THEFT_CHASERS', chaserIds: ['c1'] })
  expect(next.theft!.chaserIds).toContain('c1')
  expect(base.theft!.chaserIds).not.toContain('c1') // entrada intacta
})
```

> Importar `rollTheftAtDayOpen`, `spawnTheft` de `./theftFlow.ts`, `autoSeedRun` de `./setup.ts`, `makeMon` de `../engine/testkit.ts`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/reducer.test.ts`
Expected: FAIL — ação desconhecida / sem case.

- [ ] **Step 3: Adicionar as ações em `actions.ts`**

Em `src/game/actions.ts`, no union `GameAction` (após `COMPLETE_DEFENSE`, mantendo o estilo):

```ts
  /** Despacha até 3 Pokémon idle atrás da Rocket no Evento de Roubo (Feature B). */
  | { type: 'DISPATCH_THEFT_CHASERS'; chaserIds: string[] }
  /** Resolve a batalha de resgate (cadeia de duelos) — Feature B. */
  | { type: 'RESOLVE_THEFT_BATTLE' }
  /** Conclui a batalha de resgate (após a animação): aplica 3× XP na vitória — Feature B. */
  | { type: 'COMPLETE_THEFT_BATTLE' }
```

> Se o Plano A removeu `RESOLVE_ROCKET_BATTLE`/`COMPLETE_ROCKET_BATTLE` (eram da missão), estas NÃO conflitam (nomes diferentes: THEFT vs ROCKET).

- [ ] **Step 4: Wiring no `reducer.ts`**

Em `src/game/reducer.ts`:
- Import: `import { dispatchTheftChasers, resolveTheftBattle, completeTheftBattle } from './theftFlow.ts'`.
- No `switch`, adicionar:

```ts
    case 'DISPATCH_THEFT_CHASERS':
      dispatchTheftChasers(s, action.chaserIds)
      break
    case 'RESOLVE_THEFT_BATTLE':
      resolveTheftBattle(s)
      break
    case 'COMPLETE_THEFT_BATTLE':
      completeTheftBattle(s)
      break
```

- [ ] **Step 5: Rodar e ver passar + type-check**

Run: `npx vitest run src/game/reducer.test.ts` e `npm run build`
Expected: PASS / sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/game/actions.ts src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat(theft): ações DISPATCH_THEFT_CHASERS / RESOLVE / COMPLETE_THEFT_BATTLE"
```

---

### Task 10: Migração de save (v→v+1)

**Files:**
- Modify: `src/persistence/saveLoad.ts`
- Modify: `src/persistence/saveLoad.test.ts`

**Interfaces:**
- Consumes: `SAVE_VERSION` (Task 2).
- Produces: migração que inicia `run.theftChance = 1` e garante `theft` ausente.

- [ ] **Step 1: Escrever o teste de migração**

Adicionar a `src/persistence/saveLoad.test.ts` (espelhar os casos existentes; usar a versão ANTERIOR real — exemplo v35 → v36):

```ts
it('migra v35 → v36: inicia run.theftChance=1 e não cria theft', () => {
  // Reaproveitar o factory/save "atual menos 1" do arquivo; aqui um esqueleto:
  const prev = {
    version: 35,
    savedAtMs: 0,
    state: {
      ...minimalState(), // helper existente no arquivo de teste
      run: { cityIndex: 0, day: 1, seed: 1, phase: 'MORNING', ballLevel: 0 }, // SEM theftChance
    },
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(prev))
  const loaded = loadGame()
  expect(loaded).not.toBeNull()
  expect(loaded!.run.theftChance).toBe(1)
  expect(loaded!.theft).toBeUndefined()
})
```

> Reusar os helpers de save já presentes no arquivo. Se o teste atual carrega o save "atual" e o reescreve, espelhe esse padrão para a versão anterior.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: FAIL — sem a migração, `run.theftChance` fica undefined.

- [ ] **Step 3: Implementar a migração**

Em `src/persistence/saveLoad.ts`, ANTES de `if (version !== SAVE_VERSION) return null`, adicionar (ajustar os números para os reais):

```ts
  // v35 → v36: Evento de Roubo Rocket. run.theftChance inicia em 1 (dobra por dia sem disparar);
  // o evento em voo (theft) NÃO é recriado (eventos do dia não persistem) — recalculado no próximo
  // dia-aberto. PokemonStatus 'stolen' só existe durante o evento, então não há roster a corrigir.
  if (version === 35) {
    const run = state.run as Record<string, unknown> | undefined
    state = {
      ...state,
      run: run && typeof run === 'object' ? { theftChance: 1, ...run } : run,
    } as typeof state
    version = 36
  }
```

> Se o Plano A NÃO bumpou (save atual ainda 34), encadeie a partir de 34 (o caso `version === 34` existente deve continuar válido; o seu novo caso começa do número que o Plano A deixou). Garanta que a cadeia chega exatamente a `SAVE_VERSION`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: PASS.

- [ ] **Step 5: Suíte inteira + type-check**

Run: `npx vitest run` e `npm run build`
Expected: PASS / sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/persistence/saveLoad.ts src/persistence/saveLoad.test.ts
git commit -m "feat(theft): migração de save (theftChance inicial = 1)"
```

---

### Task 11: Previsão do dia — "Chance de Rocket" (B9)

**Files:**
- Modify: `src/components/screens/DayForecastPanel.tsx`
- Modify: `src/components/screens/DayForecastPanel.module.css` (se precisar de cor inline; provavelmente reusa `.count`)

**Interfaces:**
- Consumes: `theftChanceLabel` (Task 4); `state.run.theftChance`.
- Produces: substitui o bloco "Rocket / ???" por "Chance de Rocket" (palavra + cor).

- [ ] **Step 1: (TDD light) Confirmar o mapeamento via unit test do helper**

O mapeamento já é testado em `engine/theft.test.ts` (Task 4). A UI só consome `theftChanceLabel`. Não há lógica nova testável na UI; pular teste de componente (segue a verificação econômica do repositório — DOM/preview opcional no final).

- [ ] **Step 2: Substituir o bloco no `DayForecastPanel.tsx`**

Em `src/components/screens/DayForecastPanel.tsx`:
- Import: `import { theftChanceLabel } from '../../engine/theft.ts'`.
- Calcular o rótulo: `const theft = theftChanceLabel(state.run.theftChance)`.
- Trocar o terceiro `.count` (o de "Rocket / ???") por:

```tsx
        <div className={styles.count}>
          <span className={`${styles.countIcon} ${styles.rocketIcon}`} aria-hidden="true">🚨</span>
          <span
            className={`${styles.countValue} ${styles.rocketValue}`}
            style={{ color: theft.color }}
            title={`Chance de roubo hoje: ${state.run.theftChance}%`}
          >
            {theft.label}
          </span>
          <span className={styles.countLabel}>Chance de Rocket</span>
        </div>
```

> Manter `aria-hidden` no ícone. O `title` revela a % numérica no hover (não estraga o "mistério" do design — o design pede palavra+cor; a % no tooltip é auxiliar e pode ser removida se preferirem).

- [ ] **Step 3: CSS (se necessário)**

Em `DayForecastPanel.module.css`, garantir que `.rocketValue` permita cor inline (remover qualquer `color` fixo que sobreponha o inline). Se o `.rocketValue` antigo tinha cor vermelha fixa, troque por uma cor neutra/herança para o inline valer. Ajustar `font-size` se "Inevitável" estourar a coluna (ex.: `font-size: 11px; line-height: 1.1; text-align: center`).

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/DayForecastPanel.tsx src/components/screens/DayForecastPanel.module.css
git commit -m "feat(theft): previsão 'Chance de Rocket' (palavra + cor) no lugar de ???"
```

---

### Task 12: Áudio — alerta quando a Rocket chega ao nó final (B5)

**Files:**
- Modify: `src/audio/useGameSounds.ts`

**Interfaces:**
- Consumes: `playSound('timeWarning')` (existente); `state.theft`.
- Produces: toca `'timeWarning'` UMA vez quando o roubo entra em `'atFarNode'`.

- [ ] **Step 1: Implementar o disparo único**

Em `src/audio/useGameSounds.ts`, dentro de `useGameSounds`:
- Adicionar uma ref: `const theftWarned = useRef(false)`.
- No corpo do `useEffect`, após o bloco de tempo/raio (antes de `ready.current = true`):

```ts
    // 7) Roubo Rocket chegou ao nó mais distante: toca o alerta (mesmo da defesa acabando) uma vez.
    if (!first && state.theft?.phase === 'atFarNode' && !theftWarned.current) {
      theftWarned.current = true
      playSound('timeWarning')
    }
    // Rearma o aviso quando não há evento em janela final (próximo dia/evento).
    if (!state.theft || (state.theft.phase !== 'atFarNode' && state.theft.phase !== 'battle')) {
      theftWarned.current = false
    }
```

> Segue o padrão `warnedIds`/`warnIfExpiring` (dispara uma vez por entrada na janela). Reusa `'timeWarning'` como pede o design (B5).

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/audio/useGameSounds.ts
git commit -m "feat(theft): alerta sonoro quando a Rocket chega ao nó final"
```

---

### Task 13: UI — Rocket "R" vermelho + perseguidores no CityMap (B3/B4)

**Files:**
- Modify: `src/components/day/CityMap.tsx`
- Modify: `src/components/day/CityMap.module.css`

**Interfaces:**
- Consumes: `theftPos`, `chaserPositionsAt` (Task 5); `posStyle`/`TravelerGroup` (locais do CityMap); `state.theft`.
- Produces: o marcador "R" da Rocket e os sprites dos perseguidores no mapa.

- [ ] **Step 1: Renderizar a Rocket e os perseguidores**

Em `src/components/day/CityMap.tsx`:
- Importar: `import { theftPos, chaserPositionsAt } from '../../engine/travelerPositions.ts'`.
- Dentro de `MapTravelers` (que já recebe `state, graph, now`), após os blocos de missões/captura, adicionar:

```tsx
      {state.theft && (() => {
        const rocketPos = theftPos(graph, state.theft, now)
        return (
          <>
            {rocketPos && (
              <div className={styles.rocket} style={posStyle(rocketPos)} aria-label="Equipe Rocket">
                R
              </div>
            )}
            {chaserPositionsAt(state, now).map(({ id, pos }) => (
              <TravelerGroup key={`chaser-${id}`} pos={pos} ids={[id]} roster={state.roster} />
            ))}
          </>
        )
      })()}
```

> Os perseguidores reusam `TravelerGroup` (sprites do roster). A Rocket é um marcador simples "R" vermelho (não é um sprite do roster). `posStyle` e `TravelerGroup` já existem no arquivo.

- [ ] **Step 2: Estilo do marcador Rocket**

Em `src/components/day/CityMap.module.css`, adicionar (espelhando o `.anchor`/marcadores existentes; centralizado, vermelho):

```css
/* Marcador da Equipe Rocket no roubo: "R" vermelho pulsante. */
.rocket {
  position: absolute;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #c0223a;
  color: #fff;
  font-family: var(--font-pixel);
  font-size: 14px;
  font-weight: bold;
  border: 2px solid #fff;
  box-shadow: 0 0 8px rgba(192, 34, 58, 0.9);
  z-index: 6;
  pointer-events: none;
  animation: rocketPulse 0.8s ease-in-out infinite;
}
@keyframes rocketPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.12); }
}
```

> Use as variáveis CSS do projeto (`var(--font-pixel)`) já usadas no CityMap. Ajuste z-index para ficar acima dos travelers/abaixo de modais.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/day/CityMap.tsx src/components/day/CityMap.module.css
git commit -m "feat(theft): render do 'R' vermelho da Rocket + perseguidores no mapa"
```

---

### Task 14: UI — banner 'stolen' no TeamSidebar (B8)

**Files:**
- Modify: `src/components/day/TeamSidebar.tsx`
- (CSS: reusa `busyOverlay`/`busyBanner`/`busyText`/`busyEta` — sem mudança obrigatória)

**Interfaces:**
- Consumes: `mon.status === 'stolen'`; padrão de overlay já existente.
- Produces: banner "🚨 Roubado" roxo (#6b3d6e) espelhando o de "💀 Derrotado".

- [ ] **Step 1: Adicionar a cor e o ramo do banner**

Em `src/components/day/TeamSidebar.tsx`:
- Após `const FAINTED_COLOR = '#8a3a3a'`, adicionar:

```ts
/** Cor do banner de Pokémon roubado pela Rocket (roxo Rocket). */
const STOLEN_COLOR = '#6b3d6e'
```

- Dentro do `.map(...)`, derivar `const stolen = mon.status === 'stolen'`. Incluir no `memberClass` (usa a mesma classe de "ocupado"):

```ts
          const stolen = mon.status === 'stolen'
          const memberClass = [
            styles.member,
            fainted ? styles.faintedMember : '',
            busy ? styles.busyMember : '',
            stolen ? styles.busyMember : '',
            willLevelUp ? styles.willLevelUp : '',
          ]
            .filter(Boolean)
            .join(' ')
```

- No bloco do overlay, trocar a estrutura `fainted ? (...) : (busy && activity && (...))` por uma cadeia que trata `stolen` PRIMEIRO (um roubado pode estar `fainted` — KO roubado — então o banner de roubo tem prioridade visual):

```tsx
                {stolen ? (
                  <span className={styles.busyOverlay}>
                    <span
                      className={styles.busyBanner}
                      style={{
                        background: `linear-gradient(180deg, ${STOLEN_COLOR}, color-mix(in srgb, ${STOLEN_COLOR} 65%, #000))`,
                      }}
                    >
                      <span className={styles.busyText}>🚨 Roubado</span>
                      <span className={styles.busyEta}>Em posse da Equipe Rocket</span>
                    </span>
                  </span>
                ) : fainted ? (
                  /* ...banner de Derrotado existente... */
                ) : (
                  busy && activity && (
                    /* ...banner de ocupado existente... */
                  )
                )}
```

> Reusar EXATAMENTE as classes `busyOverlay/busyBanner/busyText/busyEta` (já estilizadas). Cuidado: `fainted` é derivado de `currentHp <= 0`; um roubado KO entra em `stolen` primeiro (prioridade), então não mostra "Derrotado" enquanto roubado. Ajuste o `busy` para não conflitar: `const busy = !isAvailable(mon) && !fainted && !stolen`.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/day/TeamSidebar.tsx
git commit -m "feat(theft): banner '🚨 Roubado' (roxo) no TeamSidebar"
```

---

### Task 15: UI — painel de dispatch de perseguidores + painel de batalha de resgate

**Files:**
- Create: `src/components/day/TheftChasePanel.tsx`
- Create: `src/components/day/TheftBattlePanel.tsx`
- Modify: `src/components/day/DayScreen.tsx`

**Interfaces:**
- Consumes: `DISPATCH_THEFT_CHASERS`, `RESOLVE_THEFT_BATTLE`, `COMPLETE_THEFT_BATTLE` (Task 9); `BattleView` (existente); `Overlay` (existente); `getTrainer`; `isAvailable`/`sortRoster` (roster); `state.theft`.
- Produces: dois modais — um para escolher até 3 idle e despachar; outro que resolve+anima a batalha (reusa `BattleView`, modelado em `RocketBattlePanel`).

- [ ] **Step 1: `TheftBattlePanel.tsx` (reusa BattleView)**

Criar `src/components/day/TheftBattlePanel.tsx` (espelha `RocketBattlePanel`):

```tsx
// Batalha de resgate do Evento de Roubo Rocket (Feature B): os perseguidores enfrentam o esquadrão
// Rocket na ordem despachada (reusa a animação BattleView). Resolve ao abrir; recompensas (3× XP)
// só ao concluir a animação e apenas na vitória.

import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { getTrainer } from '../../data/trainers.ts'
import { Overlay } from '../common/Overlay.tsx'
import { BattleView } from './BattleView.tsx'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

export function TheftBattlePanel({ state, dispatch, onClose }: Props) {
  const theft = state.theft

  useEffect(() => {
    if (theft && theft.phase === 'battle' && !theft.resolved) {
      dispatch({ type: 'RESOLVE_THEFT_BATTLE' })
    }
  }, [theft, theft?.resolved, theft?.phase, dispatch])

  if (!theft || theft.phase !== 'battle') return null

  if (!theft.resolved || !theft.duels) {
    return (
      <Overlay title="EQUIPE ROCKET — RESGATE" wide>
        <p style={{ textAlign: 'center', padding: '24px 0' }}>Preparando a batalha…</p>
      </Overlay>
    )
  }

  return (
    <BattleView
      state={state}
      trainer={getTrainer(theft.trainerId)}
      squadIds={theft.chaserIds}
      enemies={theft.enemies}
      duels={theft.duels}
      won={theft.won === true}
      title="EQUIPE ROCKET — RESGATE"
      wonText="POKÉMON RESGATADO! ✓ Recompensa: 3× XP"
      lostText="A Equipe Rocket fugiu com o seu Pokémon…"
      onFinish={() => {
        dispatch({ type: 'COMPLETE_THEFT_BATTLE' })
        onClose()
      }}
    />
  )
}
```

> Nota: `resolveTheftBattle` na DERROTA já chama `resolveTheftLoss` (remove o Pokémon + corações), e marca `won:false` com `duels` preenchido — então `BattleView` ainda anima a derrota antes do `COMPLETE_THEFT_BATTLE` (que na derrota só libera/seta 'resolved'). Como `resolveTheftLoss` muda a fase para 'resolved', o `if (theft.phase !== 'battle') return null` fecharia o painel cedo demais. **Correção:** em `resolveTheftBattle` na derrota, NÃO chamar `resolveTheftLoss` imediatamente — em vez disso gravar `duels/won:false` mantendo `phase:'battle'` e `resolved:true`, e mover a perda (`resolveTheftLoss`) para `completeTheftBattle` quando `won === false`. **AÇÃO:** volte à Task 7 e ajuste:
> - `resolveTheftBattle` (derrota): `s.theft = { ...theft, phase: 'battle', duels: resolution.duels, won: false, resolved: true }` (NÃO chamar `resolveTheftLoss` aqui).
> - `completeTheftBattle`: se `won === false`, chamar `resolveTheftLoss(s)` (que seta 'resolved'); se `won`, aplicar XP e setar 'resolved'. Mantém a animação de derrota visível.
> Atualizar os testes da Task 7 conforme: após `resolveTheftBattle` na derrota, o Pokémon ainda existe (perda só em `completeTheftBattle`). Reescreva o teste de derrota para chamar `resolveTheftBattle` + `completeTheftBattle` antes de afirmar a remoção/corações.

- [ ] **Step 2: `TheftChasePanel.tsx` (dispatch de até 3)**

Criar `src/components/day/TheftChasePanel.tsx`:

```tsx
// Painel de perseguição (Feature B): escolhe até 3 Pokémon idle para ir atrás da Rocket. Espelha o
// seletor de esquadrão da defesa. Despacha via DISPATCH_THEFT_CHASERS; o relógio segue correndo.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { isAvailable, sortRoster } from '../../engine/roster.ts'
import { THEFT_CHASERS_MAX } from '../../engine/balance.ts'
import { Overlay } from '../common/Overlay.tsx'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

export function TheftChasePanel({ state, dispatch, onClose }: Props) {
  const theft = state.theft
  const [picked, setPicked] = useState<string[]>([])
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return null

  const candidates = sortRoster(state.roster).filter((p) => isAvailable(p) && p.status === 'idle')
  const toggle = (id: string): void =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < THEFT_CHASERS_MAX ? [...cur, id] : cur,
    )

  return (
    <Overlay title="EQUIPE ROCKET — PERSEGUIÇÃO">
      <p>Escolha até {THEFT_CHASERS_MAX} Pokémon para perseguir a Rocket.</p>
      <ul>
        {candidates.map((mon) => (
          <li key={mon.id}>
            <label>
              <input type="checkbox" checked={picked.includes(mon.id)} onChange={() => toggle(mon.id)} />
              {mon.nickname ?? mon.id}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={picked.length === 0}
        onClick={() => {
          dispatch({ type: 'DISPATCH_THEFT_CHASERS', chaserIds: picked })
          onClose()
        }}
      >
        Perseguir ({picked.length})
      </button>
    </Overlay>
  )
}
```

> Estilizar com os módulos CSS existentes do projeto (ex.: reusar classes de `MissionDispatch`/`DefensePanel`). Aqui o markup é mínimo/funcional; o executor deve adequar ao visual dos outros painéis (sprites, HpBar, etc.) reusando os componentes comuns já existentes (`displayNameOf`, sprite, etc.) — seguir `MissionDispatch.tsx` como referência de layout.

- [ ] **Step 3: Montar no `DayScreen.tsx`**

Em `src/components/day/DayScreen.tsx`:
- Importar os dois painéis.
- Abrir o `TheftBattlePanel` automaticamente quando `state.theft?.phase === 'battle'` (modal sem seleção do usuário — espelha como a defesa abre). Adicionar, perto de onde os outros modais condicionais são renderizados:

```tsx
      {state.theft?.phase === 'battle' && (
        <TheftBattlePanel state={state} dispatch={dispatch} onClose={() => { /* nada: fase vira 'resolved' */ }} />
      )}
```

- Para o `TheftChasePanel`, abrir via um botão/indicador quando `state.theft?.phase` é `'fleeing'`/`'atFarNode'` e ainda não há perseguidores (ou para adicionar mais até 3). Adicionar um botão flutuante simples (reusar o padrão de selos flutuantes do DayScreen) que abre o painel; controlar a abertura com um `useState` local `const [chaseOpen, setChaseOpen] = useState(false)`:

```tsx
      {(state.theft?.phase === 'fleeing' || state.theft?.phase === 'atFarNode') && (
        <button type="button" className={styles.theftAlert} onClick={() => setChaseOpen(true)}>
          🚨 Perseguir a Rocket
        </button>
      )}
      {chaseOpen && (
        <TheftChasePanel state={state} dispatch={dispatch} onClose={() => setChaseOpen(false)} />
      )}
```

> Reusar o estilo dos selos flutuantes do DayScreen (`styles.weatherFloat`-like). Se não houver classe adequada, adicionar `.theftAlert` em `DayScreen.module.css` (botão vermelho fixo no canto). Fechar `chaseOpen` quando o evento sair de fuga/graça (efeito ou condição de render já cuida, pois o painel retorna null).

- [ ] **Step 4: Type-check + suíte**

Run: `npm run build` e `npx vitest run`
Expected: PASS / sem erros.

- [ ] **Step 5: Verificação econômica no preview (opcional, DOM/console — sem screenshot)**

Conforme a preferência registrada (verificação econômica): se a engine compila e os testes passam, validar via DOM/console (sem screenshot). Não pedir validação manual ao usuário.

- [ ] **Step 6: Commit**

```bash
git add src/components/day/TheftChasePanel.tsx src/components/day/TheftBattlePanel.tsx src/components/day/DayScreen.tsx src/components/day/DayScreen.module.css
git commit -m "feat(theft): painéis de perseguição e de batalha de resgate no DayScreen"
```

---

## Decisões de design resolvidas (documentadas)

- **Relógio concorrente + pausa na batalha:** a fuga/perseguição é processada em `dayClock.tick` junto de missões/defesas/buscas (o dia CORRE). Ao interceptar, `enterTheftBattle` faz `s.clock.speed = 0` — a batalha de resgate é modal e pausa o relógio, espelhando o efeito prático do modal de defesa (que o jogador resolve com o jogo parado). Confirmado contra `defenseFlow`/`dayClock`: a defesa resolve no dispatch (instantâneo) e o painel só anima; o resgate, por interceptar no tick, precisa pausar explicitamente para não deixar outros eventos resolverem por baixo durante a animação.
- **"Fisicamente no ginásio" derivado do `PokemonStatus`:** elegível ⟺ `status ∈ {idle, fainted}` E `id ∉ buscadores (captureSearches/Returns/encounters)` E `status ≠ atCenter`. Os `AWAY_STATUSES` do `dayClock` (`traveling/onMission/returning/defending`) e `'stolen'` já são excluídos por não serem `idle`/`fainted`. (Replicado em `AWAY_FROM_GYM_STATUSES` + `captureBusyIds`.)
- **Movimento dos perseguidores (modelado/persistido por TIMERS):** persistimos `chaserIds` + `chaserStartAtMs[]` + `chaserArriveAtMs[]` (paralelos). A posição é DERIVADA pura por frame (`pointAlongPath` do ginásio ao `targetNode` pela fração de tempo de cada perseguidor) — nada de posição salva, nada de re-pathfinding por frame; determinístico e save-reload-safe.
- **Interceptação × granularidade do tick:** `THEFT_INTERCEPT_DISTANCE = 0.03` (3% da largura) é maior que o deslocamento típico de um perseguidor por tick (mesmo a x3, `graphTravelMs` produz pernas de vários segundos → << 0,03 por frame de ~16 ms), então a interceptação não "pula por cima" da Rocket entre dois ticks. A comparação usa `segmentLength(rocket, chaser) < THEFT_INTERCEPT_DISTANCE * MAP_ASPECT_W` (mesma convenção 16:9 do `pointInCircle` da Tempestade).
- **Agilidade → velocidade (constante/fórmula encontrada):** `engine/missions.ts` → `agilityTravelFactor(team) = clamp(1 - teamAxisSum(agilidade)*AGILITY_TIME_REDUCTION_PER_POINT, MISSION_TIME_FLOOR, 1)` com `AGILITY_TIME_REDUCTION_PER_POINT = 0.01` e `MISSION_TIME_FLOOR = 0.3`; o tempo de uma perna é `graphTravelMs(distance, team, speedMult) = distance * TRAVEL_MS_PER_DISTANCE * agilityTravelFactor(team) / max(speedMult, 0.0001)`. A Rocket usa `THEFT_FLEE_AGILITY = 10` → fator `0,90`. `theftFleeMs(distance)` chama `graphTravelMs(distance, [monAgi10], 1)`.

---

## Self-Review

### Cobertura do spec (cada item B → task)
- **B1 (gatilho/chance dobrando, reset só ao disparar):** Task 1 (constantes), Task 4 (`rollNextTheftChance`), Task 6 (`rollTheftAtDayOpen` dobra na falha), Task 6/7 (`spawnTheft` reseta p/ 1 ao disparar), Task 8 (roll no dia-aberto).
- **B2 (alvo + disparo adiado + elegibilidade):** Task 6 (`eligibleTheftTargets`, `spawnTheft` adiado, alvo aleatório via `rng.pick`).
- **B3 (aparição/fuga em tempo real, nó adjacente → nó mais distante, agi 10, concorrente, render):** Task 3 (`farthestNodeFrom`), Task 4 (`theftFleeMs` agi 10), Task 6 (`fromNode` vizinho do gym, `targetNode` farthest), Task 8 (tick concorrente), Task 13 (render "R").
- **B4 (perseguição posicional, até 3 idle, pathfind contínuo, limiar):** Task 5 (`chaserPositionsAt`/`theftInterceptorIds`/`THEFT_INTERCEPT_DISTANCE`), Task 7 (`dispatchTheftChasers` ≤3), Task 13 (render perseguidores).
- **B5 (nó final + janela 5s + som):** Task 7 (`'atFarNode'` + `graceUntilMs = arrive + THEFT_GRACE_MS`), Task 12 (`'timeWarning'`).
- **B6 (batalha de resgate, squad pelo dia, duelos 1v1 com dano, vitória recupera HP + 3× XP):** Task 6 (`generateDefenseEnemies`/`rollSquadSize`), Task 7 (`resolveTheftBattle` reusa `resolveDefense`, recupera idle mesmo HP, `completeTheftBattle` 3× `gymWinXp`).
- **B7 (falha: perde Pokémon + roster −1 coração; reset chance em qualquer desfecho):** Task 7 (`resolveTheftLoss`), Task 6/7 (reset ao disparar + a perda no `completeTheftBattle`). Nota: o reset da chance ocorre no DISPARO (B1 é explícito: "reseta para 1% quando o roubo de fato dispara"); todos os desfechos pós-disparo já têm a chance em 1.
- **B8 (status 'stolen' + banner roxo):** Task 2 (`PokemonStatus 'stolen'`), Task 14 (banner `#6b3d6e`).
- **B9 (previsão "Chance de Rocket"):** Task 4 (`theftChanceLabel` + teste), Task 11 (substituição do bloco `???`).
- **B10 (constantes):** Task 1 (todas as `THEFT_*`, `THEFT_INTERCEPT_DISTANCE = 0.03` justificada).
- **B11 (arquivos tocados):** state/types/saveLoad (Tasks 2/10), `game/theftFlow.ts` (Tasks 6/7) integrado no tick (Task 8), pathfinding/travelerPositions (Tasks 3/5), CityMap (Task 13), TeamSidebar (Task 14), painéis (Task 15), `useGameSounds` (Task 12), DayForecastPanel (Task 11).
- **B9 forecast (lê a chance corrente):** Task 11 lê `state.run.theftChance`.

### Varredura de placeholders
- Nenhum "TBD"/"handle edge cases". Os únicos pontos que dependem de helpers de teste pré-existentes (saveLoad factories; `pickAdjacentPair`/`fleeingTheftReal` em `travelerPositions.test.ts`) estão marcados como "reusar/criar helper local" com a intenção explícita — todo o código de PRODUÇÃO é literal e completo.
- **Ajuste cruzado importante** (sinalizado na Task 15, com AÇÃO de volta à Task 7): na DERROTA, `resolveTheftBattle` deve manter `phase:'battle'` (com `duels`/`won:false`/`resolved:true`) e a perda (`resolveTheftLoss`) move-se para `completeTheftBattle`, para a animação de derrota aparecer. Os testes da Task 7 (derrota) foram especificados para chamar `resolveTheftBattle` + `completeTheftBattle` antes de afirmar a remoção/corações.

### Consistência de tipos
- `TheftEvent`/`TheftPhase` (Task 2) com `chaserArriveAtMs[]`/`chaserStartAtMs[]` (Task 5 Step 0) usados em Tasks 5,7,13,15.
- `theftPos`/`chaserPositionsAt`/`theftInterceptorIds` (Task 5) consumidos em Tasks 7,13.
- `farthestNodeFrom`/`nodeDistancesFrom` (Task 3) consumidos em Tasks 5,6.
- `rollNextTheftChance`/`theftFleeMs`/`theftChanceLabel` (Task 4) consumidos em Tasks 6,11.
- `dispatchTheftChasers`/`resolveTheftBattle`/`completeTheftBattle`/`processTheft`/`rollTheftAtDayOpen`/`resolveTheftLoss` (Tasks 6/7) consumidos em Tasks 8,9,15.
- Ações `DISPATCH_THEFT_CHASERS`/`RESOLVE_THEFT_BATTLE`/`COMPLETE_THEFT_BATTLE` (Task 9) consumidas em Task 15.
- `PokemonStatus 'stolen'` (Task 2) consumido em Tasks 6,14; `run.theftChance` (Task 2) consumido em Tasks 6,8,10,11.
- Reuso de engine existente: `resolveDefense`/`ResolveDefenseOpts.paralyzedIds`/`gymWinXp`/`generateDefenseEnemies`/`rollSquadSize` (gymDefense), `applyBattleSecretRuntime` (defenseFlow), `applyXpGains` (itemFlow), `applyHeartDelta` (hearts), `graphTravelMs`/`agilityTravelFactor` (missions), `pointAlongPath`/`segmentLength`/`shortestPath`/`pathDistance` (pathfinding) — todas com assinaturas confirmadas no código atual.
