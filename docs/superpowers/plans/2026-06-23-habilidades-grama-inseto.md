# Habilidades Secretas de Grama/Inseto (Celadon) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar as habilidades secretas das 11 linhas evolutivas de tipo Grama/Inseto da Celadon Gym e implementar as 5 habilidades novas com efeito ativo, deixando 3 novas registradas mas inertes até existirem seus pré-requisitos.

**Architecture:** Habilidades secretas são por linha evolutiva (mapa `SECRET_LINES` chaveado pela raiz). O conteúdo (nome + `effectL1`/`effectL2`) vive em `src/data/secretAbilities.ts`; cada efeito é amarrado pelo `SecretId` e implementado na engine (`src/engine/secretEffects.ts` e call sites). O plano primeiro torna os dados consistentes (Task 1), depois implementa cada efeito novo de forma isolada e testável.

**Tech Stack:** TypeScript (ESM, imports com extensão `.ts`), Vitest para testes, funções puras na engine.

## Global Constraints

- Imports relativos sempre com extensão explícita `.ts` (ex.: `from './balance.ts'`).
- Build/tipos verificados com `npm run build` (tsc -b), NÃO `tsc --noEmit`.
- `SECRET_KINDS` é `Record<SecretId, SecretKind>`: TODA entrada da união `SecretId` precisa existir nele ou o build quebra.
- Funções da engine são puras (não mutam o Pokémon recebido; devolvem novos objetos).
- Multiplicadores de atributo em missão são MULTIPLICATIVOS (compõem com os existentes).
- Determinismo: sorteios usam `createRng(deriveSeed(...))`; nunca `Math.random()`.
- `dayBuffs` é aditivo flat em `effectiveAttr` e é zerado por `healRoster` na virada do dia.

---

### Task 1: Cadastro dos dados (SecretId + catálogo + linhas)

**Files:**
- Modify: `src/data/secretAbilities.ts` (união `SecretId` ~linha 15-55; `SECRET_KINDS` ~linha 67-291; `SECRET_LINES` ~linha 315-352)
- Test: `src/data/secretAbilities.test.ts`

**Interfaces:**
- Consumes: tipos existentes `SecretId`, `SecretKind`, `SECRET_KINDS`, `SECRET_LINES`, `secretLineFor`.
- Produces: 8 novos `SecretId` (`sa-chlorophyll`, `sa-overgrow`, `sa-spore`, `sa-gluttony`, `sa-harvest`, `sa-leaf-guard`, `sa-tinted-lens`, `sa-swarm`) com entradas em `SECRET_KINDS`; 11 entradas novas em `SECRET_LINES` (raízes 1, 43, 69, 102, 114, 10, 13, 46, 48, 123, 127).

- [ ] **Step 1: Escrever o teste das 11 linhas (falha)**

No final de `src/data/secretAbilities.test.ts`, dentro do `describe('Linhas (pares) e níveis', ...)`, adicionar:

```typescript
  it('linhas de grama/inseto (Celadon) mapeiam para os pares do spec', () => {
    const CELADON_PAIRS: Record<number, readonly [SecretId, SecretId]> = {
      1: ['sa-chlorophyll', 'sa-overgrow'],
      43: ['sa-chlorophyll', 'sa-spore'],
      69: ['sa-gluttony', 'sa-hustle'],
      102: ['sa-harvest', 'sa-analytic'],
      114: ['sa-regenerator', 'sa-leaf-guard'],
      10: ['sa-tinted-lens', 'sa-fly'],
      13: ['sa-sniper', 'sa-swarm'],
      46: ['sa-spore', 'sa-dig'],
      48: ['sa-fly', 'sa-forewarn'],
      123: ['sa-quick-feet', 'sa-fly'],
      127: ['sa-dig', 'sa-moxie'],
    }
    for (const [root, pair] of Object.entries(CELADON_PAIRS)) {
      expect(secretLineFor(Number(root)), `linha ${root}`).toEqual(pair)
    }
  })

  it('formas evoluídas de grama/inseto herdam a raiz', () => {
    expect(secretLineFor(3)).toEqual(secretLineFor(1)) // Venusaur = Bulbasaur
    expect(secretLineFor(12)).toEqual(secretLineFor(10)) // Butterfree = Caterpie
    expect(secretLineFor(15)).toEqual(secretLineFor(13)) // Beedrill = Weedle
  })
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/data/secretAbilities.test.ts`
Expected: FAIL — `secretLineFor(1)` retorna `null` (linha ainda não cadastrada).

- [ ] **Step 3: Adicionar os 8 novos ids à união `SecretId`**

Em `src/data/secretAbilities.ts`, ao final da união `SecretId` (logo após `| 'sa-volt-absorb'`, antes do fim do tipo na linha ~55), acrescentar:

```typescript
  // Celadon (Grama/Inseto) — habilidades novas com efeito.
  | 'sa-overgrow'
  | 'sa-swarm'
  | 'sa-spore'
  | 'sa-leaf-guard'
  | 'sa-tinted-lens'
  // Celadon — só descrição por ora (dependem de clima de calor / berries ainda não implementados).
  | 'sa-chlorophyll'
  | 'sa-gluttony'
  | 'sa-harvest'
```

- [ ] **Step 4: Adicionar as 8 entradas em `SECRET_KINDS`**

Em `src/data/secretAbilities.ts`, dentro do objeto `SECRET_KINDS`, antes do fechamento `}` (após a entrada `'sa-sand-rush'`, ~linha 290), acrescentar:

```typescript
  // ---- Celadon (Grama/Inseto) ----
  'sa-overgrow': {
    id: 'sa-overgrow',
    name: 'Overgrow',
    effectL1: '+25% nos atributos com outro aliado do tipo Grama na missão.',
    effectL2: '+50%.',
  },
  'sa-swarm': {
    id: 'sa-swarm',
    name: 'Swarm',
    effectL1: '+25% nos atributos com outro aliado do tipo Inseto na missão.',
    effectL2: '+50%.',
  },
  'sa-spore': {
    id: 'sa-spore',
    name: 'Spore',
    effectL1: 'No início do dia, +10% em um atributo aleatório (vale o dia).',
    effectL2: 'No início do dia, +10% em três atributos aleatórios.',
  },
  'sa-leaf-guard': {
    id: 'sa-leaf-guard',
    name: 'Leaf Guard',
    effectL1:
      'Numa missão fracassada, só ele perde vida (dano normal); o resto do time é poupado. Com 2+ portadores, o de maior vida absorve.',
    effectL2:
      'Vale também na defesa do ginásio: no lugar de cada aliado que perderia vida, ele toma metade do dano (4→2); o resto não perde vida.',
  },
  'sa-tinted-lens': {
    id: 'sa-tinted-lens',
    name: 'Tinted Lens',
    effectL1: 'Em desvantagem de tipo no duelo, sua Batalha conta ×1.5 (compensa o golpe fraco).',
    effectL2: 'Em desvantagem de tipo, sua Batalha conta ×2.0.',
  },
  'sa-chlorophyll': {
    id: 'sa-chlorophyll',
    name: 'Chlorophyll',
    effectL1: '+200% de velocidade do time sob sol/calor (sem efeito até existir clima de calor).',
    effectL2: '+300% de velocidade do time sob sol/calor (sem efeito até existir clima de calor).',
  },
  'sa-gluttony': {
    id: 'sa-gluttony',
    name: 'Gluttony',
    effectL1: 'Cada berry usada nele concede +100 de XP (sem efeito até existirem berries).',
    effectL2: '+200 de XP por berry usada (sem efeito até existirem berries).',
  },
  'sa-harvest': {
    id: 'sa-harvest',
    name: 'Harvest',
    effectL1: 'Recebe 1 berry aleatória toda manhã (sem efeito até existirem berries).',
    effectL2: 'Recebe 2 berries aleatórias toda manhã (sem efeito até existirem berries).',
  },
```

- [ ] **Step 5: Adicionar as 11 entradas em `SECRET_LINES`**

Em `src/data/secretAbilities.ts`, dentro de `SECRET_LINES`, antes do fechamento `}` (após a linha `144: ['sa-fly', 'sa-pressure'],` ~linha 351), acrescentar:

```typescript
  // Celadon (Grama/Inseto)
  1: ['sa-chlorophyll', 'sa-overgrow'],
  43: ['sa-chlorophyll', 'sa-spore'],
  69: ['sa-gluttony', 'sa-hustle'],
  102: ['sa-harvest', 'sa-analytic'],
  114: ['sa-regenerator', 'sa-leaf-guard'],
  10: ['sa-tinted-lens', 'sa-fly'],
  13: ['sa-sniper', 'sa-swarm'],
  46: ['sa-spore', 'sa-dig'],
  48: ['sa-fly', 'sa-forewarn'],
  123: ['sa-quick-feet', 'sa-fly'],
  127: ['sa-dig', 'sa-moxie'],
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/data/secretAbilities.test.ts`
Expected: PASS (inclui o teste pré-existente "todo id das linhas existe no catálogo", que agora cobre os 8 ids novos).

- [ ] **Step 7: Verificar o build/tipos**

Run: `npm run build`
Expected: sem erros (a exaustividade de `Record<SecretId, SecretKind>` confirma que os 8 ids têm entrada).

- [ ] **Step 8: Commit**

```bash
git add src/data/secretAbilities.ts src/data/secretAbilities.test.ts
git commit -m "feat(habilidades): cadastra linhas e catálogo de grama/inseto (Celadon)"
```

---

### Task 2: Overgrow e Swarm (bônus de atributo por aliado do tipo)

**Files:**
- Modify: `src/engine/balance.ts` (após a seção do Torrent, ~linha 314)
- Modify: `src/engine/secretEffects.ts` (predicados ~linha 113; `missionAttrMultiplier` ~linha 274-278; `missionEffectBreakdown` ~linha 543-547)
- Test: `src/engine/secretEffects.test.ts`

**Interfaces:**
- Consumes: `SecretId` `sa-overgrow`/`sa-swarm` (Task 1); padrão do Torrent em `missionAttrMultiplier`; `MissionSecretCtx`, `makeMon`, `makeAttrs`.
- Produces: `hasOvergrow(p)`, `hasSwarm(p)`; multiplicador de +25%/+50% por aliado de tipo Grama/Inseto; constantes `OVERGROW_MISSION_MULT_L1/L2`, `SWARM_MISSION_MULT_L1/L2`.

- [ ] **Step 1: Escrever os testes (falham)**

Criar `src/engine/secretEffects.test.ts` (se já existir, adicionar o bloco). Conteúdo:

```typescript
import { describe, expect, it } from 'vitest'
import { makeMon, makeAttrs } from './testkit.ts'
import { missionAttrMultiplier, type MissionSecretCtx } from './secretEffects.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'

// Bulbasaur(1) slot1 = sa-overgrow; Weedle(13) slot1 = sa-swarm (ver SECRET_LINES).
const baseCtx = (team: Parameters<typeof missionAttrMultiplier>[1]['team']): MissionSecretCtx => ({
  team,
  template: getMissionTemplate('patrulha'),
  runtime: {},
  runItems: [],
})

describe('Overgrow', () => {
  it('+25% (L1) com outro aliado do tipo Grama', () => {
    const carrier = makeMon({ id: 'a', speciesId: 1, types: ['grass', 'poison'], secretPicks: [{ slot: 1, level: 1 }] })
    const ally = makeMon({ id: 'b', speciesId: 1, types: ['grass'] })
    const team = [carrier, ally]
    expect(missionAttrMultiplier(carrier, baseCtx(team))).toBeCloseTo(1.25)
  })

  it('+50% (L2) com aliado do tipo Grama', () => {
    const carrier = makeMon({ id: 'a', speciesId: 1, types: ['grass'], secretPicks: [{ slot: 1, level: 2 }] })
    const ally = makeMon({ id: 'b', speciesId: 1, types: ['grass'] })
    expect(missionAttrMultiplier(carrier, baseCtx([carrier, ally]))).toBeCloseTo(1.5)
  })

  it('sem aliado do tipo Grama, sem bônus', () => {
    const carrier = makeMon({ id: 'a', speciesId: 1, types: ['grass'], secretPicks: [{ slot: 1, level: 1 }] })
    const ally = makeMon({ id: 'b', speciesId: 4, types: ['fire'] })
    expect(missionAttrMultiplier(carrier, baseCtx([carrier, ally]))).toBeCloseTo(1)
  })
})

describe('Swarm', () => {
  it('+25% (L1) com outro aliado do tipo Inseto', () => {
    const carrier = makeMon({ id: 'a', speciesId: 13, types: ['bug', 'poison'], secretPicks: [{ slot: 1, level: 1 }] })
    const ally = makeMon({ id: 'b', speciesId: 13, types: ['bug'] })
    expect(missionAttrMultiplier(carrier, baseCtx([carrier, ally]))).toBeCloseTo(1.25)
  })

  it('sem aliado do tipo Inseto, sem bônus', () => {
    const carrier = makeMon({ id: 'a', speciesId: 13, types: ['bug'], secretPicks: [{ slot: 1, level: 1 }] })
    const ally = makeMon({ id: 'b', speciesId: 1, types: ['grass'] })
    expect(missionAttrMultiplier(carrier, baseCtx([carrier, ally]))).toBeCloseTo(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: FAIL — multiplicador é 1 (Overgrow/Swarm ainda não implementados).

- [ ] **Step 3: Adicionar as constantes**

Em `src/engine/balance.ts`, logo após `export const TORRENT_MISSION_MULT_L2 = 1.5` (~linha 314):

```typescript
/** Overgrow: multiplicador de atributos na missão com outro aliado do tipo Grama, por nível. */
export const OVERGROW_MISSION_MULT_L1 = 1.25
export const OVERGROW_MISSION_MULT_L2 = 1.5
/** Swarm: multiplicador de atributos na missão com outro aliado do tipo Inseto, por nível. */
export const SWARM_MISSION_MULT_L1 = 1.25
export const SWARM_MISSION_MULT_L2 = 1.5
```

- [ ] **Step 4: Adicionar os predicados e os imports de constante**

Em `src/engine/secretEffects.ts`, no bloco de imports de `./balance.ts`, acrescentar os 4 nomes (em ordem alfabética junto aos demais):

```typescript
  OVERGROW_MISSION_MULT_L1,
  OVERGROW_MISSION_MULT_L2,
  SWARM_MISSION_MULT_L1,
  SWARM_MISSION_MULT_L2,
```

Logo após `export function hasTorrent(p: Pokemon): boolean { ... }` (~linha 115), adicionar:

```typescript
export function hasOvergrow(p: Pokemon): boolean {
  return hasSecret(p, 'sa-overgrow')
}
export function hasSwarm(p: Pokemon): boolean {
  return hasSecret(p, 'sa-swarm')
}
```

- [ ] **Step 5: Implementar os branches em `missionAttrMultiplier`**

Em `src/engine/secretEffects.ts`, logo após o bloco do Torrent dentro de `missionAttrMultiplier` (após a linha `}` que fecha o `if (hasTorrent(p) && ...)`, ~linha 278), adicionar:

```typescript
  // Overgrow: +25%/+50% se há OUTRO aliado do tipo Grama na missão.
  if (hasOvergrow(p) && ctx.team.some((o) => o.id !== p.id && o.types.includes('grass'))) {
    const lvl = secretLevelOf(p, 'sa-overgrow')
    mult *= lvl === 2 ? OVERGROW_MISSION_MULT_L2 : OVERGROW_MISSION_MULT_L1
  }
  // Swarm: +25%/+50% se há OUTRO aliado do tipo Inseto na missão.
  if (hasSwarm(p) && ctx.team.some((o) => o.id !== p.id && o.types.includes('bug'))) {
    const lvl = secretLevelOf(p, 'sa-swarm')
    mult *= lvl === 2 ? SWARM_MISSION_MULT_L2 : SWARM_MISSION_MULT_L1
  }
```

- [ ] **Step 6: Adicionar as linhas no breakdown (UI)**

Em `src/engine/secretEffects.ts`, dentro de `missionEffectBreakdown`, logo após o bloco do Torrent (após o `push({ id: 'torrent', ... })`, ~linha 547), adicionar:

```typescript
  if (team.some((p) => hasOvergrow(p) && team.some((o) => o.id !== p.id && o.types.includes('grass')))) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-overgrow'))) as 0 | 1 | 2
    push({ id: 'overgrow', source: 'ability', label: 'Overgrow', kind: 'attr', direction: 'gain',
      value: fmtMult(lvl === 2 ? OVERGROW_MISSION_MULT_L2 : OVERGROW_MISSION_MULT_L1), reason: 'com aliado do tipo Grama' })
  }
  if (team.some((p) => hasSwarm(p) && team.some((o) => o.id !== p.id && o.types.includes('bug')))) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-swarm'))) as 0 | 1 | 2
    push({ id: 'swarm', source: 'ability', label: 'Swarm', kind: 'attr', direction: 'gain',
      value: fmtMult(lvl === 2 ? SWARM_MISSION_MULT_L2 : SWARM_MISSION_MULT_L1), reason: 'com aliado do tipo Inseto' })
  }
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/balance.ts src/engine/secretEffects.ts src/engine/secretEffects.test.ts
git commit -m "feat(habilidades): Overgrow (Grama) e Swarm (Inseto) — bônus por aliado do tipo"
```

---

### Task 3: Tinted Lens (compensa desvantagem de tipo no duelo)

**Files:**
- Modify: `src/engine/balance.ts` (após a seção do Pressure, ~linha 329)
- Modify: `src/engine/secretEffects.ts` (predicado, junto aos demais)
- Modify: `src/engine/gymDefense.ts` (imports ~linha 22-56; dentro de `resolveDefense`, após o bloco da Rivalidade, ~linha 335)
- Test: `src/engine/gymDefense.test.ts`

**Interfaces:**
- Consumes: `sa-tinted-lens` (Task 1); `typeAdvantageMultiplier`, `effectiveBattle`, `resolveDefense`, `EnemyUnit`; `secretLevelOf`.
- Produces: `hasTintedLens(p)`; multiplicador de Batalha ×1.5 (L1)/×2.0 (L2) no duelo quando o portador está em desvantagem de tipo; constantes `TINTED_LENS_BATTLE_MULT_L1/L2`.

- [ ] **Step 1: Escrever o teste (falha)**

Em `src/engine/gymDefense.test.ts`, adicionar (criar `import { makeMon } from './testkit.ts'` se faltar):

```typescript
import { createRng } from './rng.ts'
import { resolveDefense, type EnemyUnit } from './gymDefense.ts'

describe('Tinted Lens', () => {
  // Caterpie(10) slot0 = sa-tinted-lens. Inseto vs Fogo = desvantagem (×0.5 contra mim).
  it('em desvantagem de tipo, a Batalha conta ×1.5 (L1) e vence duelo que perderia', () => {
    // Sem Tinted Lens: batalha 20 (bug) vs inimigo 20 (fire). yourEff = 20×0.5 = 10;
    // enemyEff = 20×1.5 = 30 → pWin baixo. Com TL L1: yourEff = 10×1.5 = 15 → pWin = 15/30 = 0.5.
    const you = makeMon({ id: 'a', speciesId: 10, types: ['bug'], baseAttrs: { batalha: 20, inteligencia: 0, carisma: 0, agilidade: 0, resistencia: 30, percepcao: 0 }, secretPicks: [{ slot: 0, level: 1 }] })
    const enemy: EnemyUnit = { battle: 20, types: ['fire'] }
    const res = resolveDefense(createRng(1), [you], [enemy])
    expect(res.duels[0]?.pWin).toBeCloseTo(0.5)
  })

  it('em desvantagem, L2 conta ×2.0', () => {
    const you = makeMon({ id: 'a', speciesId: 10, types: ['bug'], baseAttrs: { batalha: 20, inteligencia: 0, carisma: 0, agilidade: 0, resistencia: 30, percepcao: 0 }, secretPicks: [{ slot: 0, level: 2 }] })
    const enemy: EnemyUnit = { battle: 20, types: ['fire'] }
    const res = resolveDefense(createRng(1), [you], [enemy])
    // yourEff = 10×2.0 = 20; enemyEff = 30 → pWin = 20/30 ≈ 0.667.
    expect(res.duels[0]?.pWin).toBeCloseTo(20 / 30)
  })

  it('sem desvantagem (neutro/vantagem), Tinted Lens não atua', () => {
    // Inseto vs Normal = neutro (×1). yourEff = 20; enemyEff = 20 → pWin = 1 (clamp).
    const you = makeMon({ id: 'a', speciesId: 10, types: ['bug'], baseAttrs: { batalha: 20, inteligencia: 0, carisma: 0, agilidade: 0, resistencia: 30, percepcao: 0 }, secretPicks: [{ slot: 0, level: 1 }] })
    const enemy: EnemyUnit = { battle: 20, types: ['normal'] }
    const res = resolveDefense(createRng(1), [you], [enemy])
    expect(res.duels[0]?.pWin).toBeCloseTo(1)
  })
})
```

> Nota: confira o valor exato do multiplicador de tipo Inseto×Fogo em `src/data/typeChart.ts`. Bug não tem desvantagem canônica contra Fire na tabela de ataque (Bug→Fire é resistido = ×0.5). Se a tabela usada aqui der outro resultado, ajuste o par de tipos do teste para um que produza `typeAdvantageMultiplier(['bug'], [X]) < 1` (ex.: um tipo contra o qual Bug seja "não muito eficaz"). O comportamento testado (desvantagem → ×1.5/×2.0) é o que importa.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts -t "Tinted Lens"`
Expected: FAIL — sem o bônus, `pWin` do 1º teste é 10/30 ≈ 0.333, não 0.5.

- [ ] **Step 3: Adicionar as constantes**

Em `src/engine/balance.ts`, após `export const PRESSURE_ENEMY_MULT_L2 = 0.70` (~linha 329):

```typescript
/** Tinted Lens: multiplicador da Batalha no duelo quando o portador está em desvantagem de tipo. */
export const TINTED_LENS_BATTLE_MULT_L1 = 1.5
export const TINTED_LENS_BATTLE_MULT_L2 = 2.0
```

- [ ] **Step 4: Adicionar o predicado**

Em `src/engine/secretEffects.ts`, junto aos demais predicados (após `hasSwarm`, da Task 2):

```typescript
export function hasTintedLens(p: Pokemon): boolean {
  return hasSecret(p, 'sa-tinted-lens')
}
```

- [ ] **Step 5: Importar constante e implementar em `resolveDefense`**

Em `src/engine/gymDefense.ts`, no import de `./balance.ts` (~linha 22), acrescentar:

```typescript
  TINTED_LENS_BATTLE_MULT_L1,
  TINTED_LENS_BATTLE_MULT_L2,
```

Dentro de `resolveDefense`, logo após o bloco da Rivalidade (após o `}` que fecha `if (enemy.gender !== undefined && ...)`, ~linha 335) e ANTES do bloco do Moxie temporário (~linha 338), adicionar:

```typescript
    // Tinted Lens: em desvantagem de tipo, compensa o golpe fraco (×1.5 / ×2.0). [MULTIPLICATIVO]
    const tintedLevel = secretLevelOf(you, 'sa-tinted-lens')
    if (tintedLevel >= 1 && typeAdvantageMultiplier(you.types, enemy.types) < 1) {
      yourEff *= tintedLevel === 2 ? TINTED_LENS_BATTLE_MULT_L2 : TINTED_LENS_BATTLE_MULT_L1
    }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/engine/gymDefense.test.ts -t "Tinted Lens"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/balance.ts src/engine/secretEffects.ts src/engine/gymDefense.ts src/engine/gymDefense.test.ts
git commit -m "feat(habilidades): Tinted Lens — compensa desvantagem de tipo no duelo"
```

---

### Task 4: Leaf Guard L1 (escudo de dano na missão fracassada)

**Files:**
- Modify: `src/engine/secretEffects.ts` (predicado + seletor de absorvedor)
- Modify: `src/engine/missions.ts` (imports ~linha 48-56; `resolveMission` ~linha 201)
- Test: `src/engine/missions.test.ts`

**Interfaces:**
- Consumes: `sa-leaf-guard` (Task 1); `damageTaken`, `applyDamage`, `resolveMission`; `makeMon`.
- Produces: `hasLeafGuard(p)`; `leafGuardAbsorberId(team, minLevel?)` → `string | null` (id do portador de maior `currentHp` com nível ≥ `minLevel`; desempate: ordem do time); roteamento do dano de falha só para o absorvedor.

- [ ] **Step 1: Escrever os testes (falham)**

Em `src/engine/missions.test.ts`, adicionar:

```typescript
import { resolveMission } from './missions.ts'
import { fixedRng, makeMon, makeAttrs } from './testkit.ts'

describe('Leaf Guard L1 — dano de missão', () => {
  const req = makeAttrs({}, 100) // exigência alta → falha garantida com pSuccessOverride=0
  // Tangela(114) slot1 = sa-leaf-guard.
  it('com 1 portador, só ele perde vida', () => {
    const guard = makeMon({ id: 'g', speciesId: 114, types: ['grass'], baseAttrs: makeAttrs({ resistencia: 50 }), secretPicks: [{ slot: 1, level: 1 }] })
    const ally = makeMon({ id: 'a', speciesId: 1, types: ['grass'], baseAttrs: makeAttrs({ resistencia: 50 }) })
    const out = resolveMission(fixedRng(1), [guard, ally], req, 4, 0, 3)
    const g = out.team.find((p) => p.id === 'g')!
    const a = out.team.find((p) => p.id === 'a')!
    expect(g.maxHp - g.currentHp).toBe(3) // absorvedor toma o dano normal (3)
    expect(a.currentHp).toBe(a.maxHp) // aliado intacto
  })

  it('com 2 portadores, só o de maior vida absorve', () => {
    const low = makeMon({ id: 'low', speciesId: 114, baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 4, secretPicks: [{ slot: 1, level: 1 }] })
    const high = makeMon({ id: 'high', speciesId: 114, baseAttrs: makeAttrs({ resistencia: 50 }), secretPicks: [{ slot: 1, level: 1 }] })
    const out = resolveMission(fixedRng(1), [low, high], req, 4, 0, 3)
    expect(out.team.find((p) => p.id === 'low')!.currentHp).toBe(4) // intacto
    const h = out.team.find((p) => p.id === 'high')!
    expect(h.maxHp - h.currentHp).toBe(3) // o de maior vida absorve
  })

  it('sem portador, o dano é distribuído como antes', () => {
    const a = makeMon({ id: 'a', speciesId: 1, baseAttrs: makeAttrs({ resistencia: 50 }) })
    const b = makeMon({ id: 'b', speciesId: 1, baseAttrs: makeAttrs({ resistencia: 50 }) })
    const out = resolveMission(fixedRng(1), [a, b], req, 4, 0, 3)
    expect(out.team.every((p) => p.maxHp - p.currentHp === 3)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/missions.test.ts -t "Leaf Guard"`
Expected: FAIL — hoje todos os membros tomam dano (aliado não fica intacto).

- [ ] **Step 3: Adicionar predicado e seletor em `secretEffects.ts`**

Em `src/engine/secretEffects.ts`, junto aos demais predicados (após `hasTintedLens`):

```typescript
export function hasLeafGuard(p: Pokemon): boolean {
  return hasSecret(p, 'sa-leaf-guard')
}

/**
 * Id do portador de Leaf Guard que ABSORVE o dano do time: o de maior `currentHp` com nível
 * ≥ `minLevel`. Desempate estável: o primeiro na ordem do time. `null` se nenhum portador.
 * `minLevel` = 1 (missão, qualquer nível) ou 2 (defesa de ginásio, só L2).
 */
export function leafGuardAbsorberId(team: readonly Pokemon[], minLevel: 1 | 2 = 1): string | null {
  let best: Pokemon | null = null
  for (const p of team) {
    if (secretLevelOf(p, 'sa-leaf-guard') < minLevel) continue
    if (!best || p.currentHp > best.currentHp) best = p
  }
  return best?.id ?? null
}
```

- [ ] **Step 4: Implementar o roteamento em `resolveMission`**

Em `src/engine/missions.ts`, no import de `./secretEffects.ts` (~linha 48), acrescentar `leafGuardAbsorberId`:

```typescript
  damageTaken,
  leafGuardAbsorberId,
  teamFlies,
```

Substituir a linha 201 (`const updated = team.map((p) => applyDamage(p, damageTaken(p, damage)))`) por:

```typescript
  // Leaf Guard (L1+): numa falha, só o portador-absorvedor (maior vida) toma o dano; os demais 0.
  const absorberId = leafGuardAbsorberId(team)
  const updated = team.map((p) => {
    const raw = absorberId === null || p.id === absorberId ? damage : 0
    return applyDamage(p, damageTaken(p, raw))
  })
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/engine/missions.test.ts -t "Leaf Guard"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/secretEffects.ts src/engine/missions.ts src/engine/missions.test.ts
git commit -m "feat(habilidades): Leaf Guard L1 — escudo de dano na missão fracassada"
```

---

### Task 5: Leaf Guard L2 (escudo na defesa do ginásio)

**Files:**
- Modify: `src/engine/balance.ts` (após Tinted Lens)
- Modify: `src/engine/secretEffects.ts` (função `redistributeLeafGuardGymDamage`)
- Modify: `src/engine/gymDefense.ts` (imports; final de `resolveDefense` ~linha 429)
- Test: `src/engine/gymDefense.test.ts`

**Interfaces:**
- Consumes: `leafGuardAbsorberId` (Task 4); `applyDamage`; `resolveDefense`, `DefenseResolution`.
- Produces: `redistributeLeafGuardGymDamage(pre, post)` → `Pokemon[]` (pós-processa o resultado: com portador L2, os aliados que perderam vida são restaurados e o absorvedor toma `ceil(dano/2)` de cada um); constante `LEAF_GUARD_GYM_DAMAGE_DIVISOR`.

> **Decisão de design (documentar no código):** o efeito é um pós-processamento — a cadeia de duelos roda normalmente e, ao final, a vida perdida pelos aliados é redistribuída ao absorvedor pela metade. Vale para toda perda de vida da defesa (vitória ou derrota). Interações com Sturdy/Reckless/Explosion nos aliados protegidos são resolvidas pela cadeia ANTES da redistribuição (aproximação aceita).

- [ ] **Step 1: Escrever o teste (falha)**

Em `src/engine/gymDefense.test.ts`, adicionar:

```typescript
describe('Leaf Guard L2 — defesa de ginásio', () => {
  // Tangela(114) slot1 = sa-leaf-guard. damagePerLoss=4 → aliado que perde toma 4; absorvedor toma 2.
  it('o absorvedor toma metade do dano de cada aliado que perderia vida', () => {
    // Aliado fraco (batalha 0) perde o duelo e tomaria 4; o portador L2 absorve ceil(4/2)=2.
    const guard = makeMon({ id: 'g', speciesId: 114, types: ['grass'], baseAttrs: makeAttrs({ batalha: 60, resistencia: 60 }), secretPicks: [{ slot: 1, level: 2 }] })
    const weak = makeMon({ id: 'w', speciesId: 1, types: ['grass'], baseAttrs: makeAttrs({ batalha: 0, resistencia: 60 }) })
    const enemy: EnemyUnit = { battle: 40, types: ['normal'] }
    // sample alto → o lado fraco perde os duelos; guard (batalha alta) vence.
    const res = resolveDefense(createRng(99), [weak, guard], [enemy, enemy], { damagePerLoss: 4 })
    const w = res.squad.find((p) => p.id === 'w')!
    const g = res.squad.find((p) => p.id === 'g')!
    expect(w.currentHp).toBe(w.maxHp) // aliado restaurado (não perde vida)
    expect(g.maxHp - g.currentHp).toBeGreaterThanOrEqual(2) // absorveu pelo menos metade de um aliado
  })

  it('sem portador L2, o dano fica como na cadeia normal', () => {
    const a = makeMon({ id: 'a', speciesId: 1, baseAttrs: makeAttrs({ batalha: 0, resistencia: 60 }) })
    const enemy: EnemyUnit = { battle: 40, types: ['normal'] }
    const res = resolveDefense(createRng(99), [a], [enemy], { damagePerLoss: 4 })
    const after = res.squad.find((p) => p.id === 'a')!
    expect(after.maxHp - after.currentHp).toBeGreaterThan(0) // perdeu vida normalmente
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts -t "Leaf Guard L2"`
Expected: FAIL — o aliado `w` perde vida (não é restaurado).

- [ ] **Step 3: Adicionar a constante**

Em `src/engine/balance.ts`, após `export const TINTED_LENS_BATTLE_MULT_L2 = 2.0` (Task 3):

```typescript
/** Leaf Guard L2: divisor do dano que o absorvedor toma no lugar de cada aliado na defesa (ceil). */
export const LEAF_GUARD_GYM_DAMAGE_DIVISOR = 2
```

- [ ] **Step 4: Implementar `redistributeLeafGuardGymDamage`**

Em `src/engine/secretEffects.ts`, no import de `./balance.ts`, acrescentar `LEAF_GUARD_GYM_DAMAGE_DIVISOR`. Garantir que `applyDamage` está importado de `./attributes.ts` (já há `effectiveAttr, mapAttrs`; acrescentar `applyDamage`). Adicionar a função (após `leafGuardAbsorberId`):

```typescript
/**
 * Leaf Guard L2 (defesa de ginásio): pós-processa o resultado da cadeia. Com um portador L2 no
 * esquadrão, cada aliado que perdeu vida é RESTAURADO ao HP pré-batalha e o absorvedor (portador
 * L2 de maior vida pré-batalha) toma `ceil(perda/2)` no lugar de cada um. Sem portador L2, devolve
 * `post` inalterado. Puro.
 */
export function redistributeLeafGuardGymDamage(
  pre: readonly Pokemon[],
  post: readonly Pokemon[],
): Pokemon[] {
  const absorberId = leafGuardAbsorberId(pre, 2)
  if (absorberId === null) return [...post]
  const preHpById = new Map(pre.map((p) => [p.id, p.currentHp]))
  let absorbed = 0
  const restored = post.map((p) => {
    if (p.id === absorberId) return p
    const before = preHpById.get(p.id) ?? p.currentHp
    const lost = before - p.currentHp
    if (lost <= 0) return p
    absorbed += Math.ceil(lost / LEAF_GUARD_GYM_DAMAGE_DIVISOR)
    return { ...p, currentHp: before, status: 'idle' as const }
  })
  return restored.map((p) => (p.id === absorberId ? applyDamage(p, absorbed) : p))
}
```

- [ ] **Step 5: Chamar no final de `resolveDefense`**

Em `src/engine/gymDefense.ts`, no import de `./secretEffects.ts` (~linha 43), acrescentar `redistributeLeafGuardGymDamage`. Substituir a linha final (~429):

```typescript
  return { won: theirs >= enemies.length, squad: result, duels, sturdyUsedIds: [...sturdyUsed] }
```

por:

```typescript
  const finalSquad = redistributeLeafGuardGymDamage(squad, result)
  return { won: theirs >= enemies.length, squad: finalSquad, duels, sturdyUsedIds: [...sturdyUsed] }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/engine/gymDefense.test.ts -t "Leaf Guard L2"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/balance.ts src/engine/secretEffects.ts src/engine/gymDefense.ts src/engine/gymDefense.test.ts
git commit -m "feat(habilidades): Leaf Guard L2 — escudo de dano na defesa do ginásio"
```

---

### Task 6: Spore (buff diário aleatório de atributo)

**Files:**
- Modify: `src/engine/balance.ts` (após Leaf Guard)
- Modify: `src/engine/constants.ts` (após `TRAINER_SEED_SALT` ~linha 60)
- Modify: `src/engine/secretEffects.ts` (função pura `sporeDayBuffs`)
- Modify: `src/game/setup.ts` (imports; nova `applySpore` + chamada em `setupDay`)
- Test: `src/engine/secretEffects.test.ts` e `src/game/setup.test.ts`

**Interfaces:**
- Consumes: `sa-spore` (Task 1); `dayBuffs`/`effectiveAttr`/`recomputeMaxHp`; `Rng`, `ATTR_KEYS`, `AttrKey`; `secretLevelOf`; `createRng`/`deriveSeed`.
- Produces: `sporeDayBuffs(p, rng)` → `Partial<Record<AttrKey, number>>` (mapa de incrementos por eixo: +`round(0.10×base)` em 1 eixo (L1) ou 3 eixos distintos (L2); vazio sem a habilidade); `applySpore(s)` aplicado em `setupDay`; constantes `SPORE_ATTR_BONUS_FRACTION`, `SPORE_ATTRS_COUNT_L2`, `SPORE_SEED_SALT`.

- [ ] **Step 1: Escrever o teste da função pura (falha)**

Em `src/engine/secretEffects.test.ts`, adicionar:

```typescript
import { sporeDayBuffs } from './secretEffects.ts'
import { fixedRng } from './testkit.ts'

describe('Spore — buff diário', () => {
  // Oddish(43) slot1 = sa-spore. fixedRng.shuffle devolve a ordem original → eixos iniciais.
  // ATTR_KEYS = [batalha, inteligencia, carisma, agilidade, resistencia, percepcao].
  it('L1 dá +10% do base em 1 eixo (o primeiro com fixedRng)', () => {
    const mon = makeMon({ speciesId: 43, baseAttrs: makeAttrs({ batalha: 30 }), secretPicks: [{ slot: 1, level: 1 }] })
    const buffs = sporeDayBuffs(mon, fixedRng(0))
    expect(buffs).toEqual({ batalha: 3 }) // round(0.10 × 30) = 3
  })

  it('L2 dá +10% em 3 eixos distintos', () => {
    const mon = makeMon({ speciesId: 43, baseAttrs: makeAttrs({}, 20), secretPicks: [{ slot: 1, level: 2 }] })
    const buffs = sporeDayBuffs(mon, fixedRng(0))
    expect(Object.keys(buffs)).toHaveLength(3)
    expect(Object.values(buffs).every((v) => v === 2)).toBe(true) // round(0.10 × 20) = 2
  })

  it('sem a habilidade, mapa vazio', () => {
    const mon = makeMon({ speciesId: 43, baseAttrs: makeAttrs() })
    expect(sporeDayBuffs(mon, fixedRng(0))).toEqual({})
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts -t "Spore"`
Expected: FAIL — `sporeDayBuffs` não existe.

- [ ] **Step 3: Adicionar constantes (balance + salt)**

Em `src/engine/balance.ts`, após `export const LEAF_GUARD_GYM_DAMAGE_DIVISOR = 2`:

```typescript
/** Spore: fração do valor-BASE somada como buff do dia em cada eixo sorteado (+10%). */
export const SPORE_ATTR_BONUS_FRACTION = 0.1
/** Spore L2: quantos eixos distintos recebem o buff (L1 = 1). */
export const SPORE_ATTRS_COUNT_L2 = 3
```

Em `src/engine/constants.ts`, após `export const TRAINER_SEED_SALT = 0x713a` (~linha 60):

```typescript
export const SPORE_SEED_SALT = 0x53706f72 // 'Spor'
```

- [ ] **Step 4: Implementar `sporeDayBuffs` em `secretEffects.ts`**

Em `src/engine/secretEffects.ts`: garantir os imports — `ATTR_KEYS` de `'../types/index.ts'` (o arquivo já importa tipos de lá; acrescentar o valor `ATTR_KEYS`), `Rng` de `'./rng.ts'`, e `SPORE_ATTR_BONUS_FRACTION`, `SPORE_ATTRS_COUNT_L2` de `'./balance.ts'`. Adicionar a função (perto de `missionAttrMultiplier` ou junto às demais utilitárias):

```typescript
/**
 * Spore: incrementos de `dayBuffs` a aplicar no INÍCIO do dia. Sorteia 1 eixo (L1) ou 3 eixos
 * distintos (L2) e dá +round(SPORE_ATTR_BONUS_FRACTION × base) em cada. Mapa vazio sem a habilidade.
 * Puro; o `rng` deve ser determinístico (seed do dia) e o call site mescla em `p.dayBuffs`.
 */
export function sporeDayBuffs(p: Pokemon, rng: Rng): Partial<Record<AttrKey, number>> {
  const level = secretLevelOf(p, 'sa-spore')
  if (level < 1) return {}
  const count = level === 2 ? SPORE_ATTRS_COUNT_L2 : 1
  const axes = rng.shuffle(ATTR_KEYS).slice(0, count)
  const out: Partial<Record<AttrKey, number>> = {}
  for (const key of axes) out[key] = Math.round(SPORE_ATTR_BONUS_FRACTION * p.baseAttrs[key])
  return out
}
```

Nota de import: o topo do arquivo tem `import type { Attrs, AttrKey, Pokemon } from '../types/index.ts'`. Trocar para importar `ATTR_KEYS` como valor:

```typescript
import { ATTR_KEYS } from '../types/index.ts'
import type { Attrs, AttrKey, Pokemon } from '../types/index.ts'
```

E adicionar `import type { Rng } from './rng.ts'`.

- [ ] **Step 5: Rodar o teste puro e ver passar**

Run: `npx vitest run src/engine/secretEffects.test.ts -t "Spore"`
Expected: PASS.

- [ ] **Step 6: Escrever o teste do hook `applySpore` (falha)**

Em `src/game/setup.test.ts` (criar se não existir), adicionar:

```typescript
import { describe, expect, it } from 'vitest'
import { autoSeedRun, applySpore } from './setup.ts'
import { makeMon, makeAttrs } from '../engine/testkit.ts'

describe('applySpore', () => {
  it('grava dayBuffs e recalcula HP no início do dia', () => {
    const s = autoSeedRun(1)
    // Oddish(43) slot1 = sa-spore L2; base resistencia alta para o buff mexer no maxHp.
    s.roster = [makeMon({ id: 'p', speciesId: 43, baseAttrs: makeAttrs({ resistencia: 50 }, 30), secretPicks: [{ slot: 1, level: 2 }] })]
    const before = s.roster[0]!.maxHp
    applySpore(s)
    const after = s.roster[0]!
    expect(Object.keys(after.dayBuffs ?? {}).length).toBe(3)
    expect(after.currentHp).toBe(after.maxHp) // começa o dia cheio
    expect(after.maxHp).toBeGreaterThanOrEqual(before) // resistência buffada pode subir o HP
  })

  it('não altera Pokémon sem Spore', () => {
    const s = autoSeedRun(1)
    s.roster = [makeMon({ id: 'p', speciesId: 1, baseAttrs: makeAttrs() })]
    applySpore(s)
    expect(s.roster[0]!.dayBuffs).toBeUndefined()
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/game/setup.test.ts`
Expected: FAIL — `applySpore` não é exportada por `setup.ts`.

- [ ] **Step 8: Implementar `applySpore` e chamar em `setupDay`**

Em `src/game/setup.ts`: nos imports, acrescentar `recomputeMaxHp` a `'../engine/attributes.ts'` (criar o import se não houver), `sporeDayBuffs` a `'../engine/secretEffects.ts'`, e `SPORE_SEED_SALT` a `'../engine/constants.ts'` (junto de `DIG_SEED_SALT, TRAINER_SEED_SALT`). Adicionar a função (perto de `applyForewarn`):

```typescript
/**
 * Spore: no início do dia, cada portador ganha buffs de atributo do dia (1 eixo no L1, 3 no L2).
 * Os incrementos somam ao `dayBuffs` existente (itens da manhã), o HP é recalculado e o Pokémon
 * começa o dia cheio. Determinístico por (seed do dia).
 */
export function applySpore(s: GameState): void {
  const rng = createRng(deriveSeed(s.run.seed, SPORE_SEED_SALT, s.run.day))
  s.roster = s.roster.map((p) => {
    const add = sporeDayBuffs(p, rng)
    if (Object.keys(add).length === 0) return p
    const dayBuffs = { ...(p.dayBuffs ?? {}) }
    for (const key of Object.keys(add) as (keyof typeof add)[]) {
      dayBuffs[key] = (dayBuffs[key] ?? 0) + (add[key] ?? 0)
    }
    const recomputed = recomputeMaxHp({ ...p, dayBuffs })
    return { ...recomputed, currentHp: recomputed.maxHp }
  })
}
```

Em `setupDay`, logo após `applyForewarn(s)` (~linha 150):

```typescript
  applySpore(s)
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/game/setup.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/engine/balance.ts src/engine/constants.ts src/engine/secretEffects.ts src/engine/secretEffects.test.ts src/game/setup.ts src/game/setup.test.ts
git commit -m "feat(habilidades): Spore — buff diário aleatório de atributo"
```

---

### Task 7: Verificação final e PR

**Files:** nenhuma alteração nova (apenas verificação).

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: todos os testes PASS.

- [ ] **Step 2: Verificar build/tipos**

Run: `npm run build`
Expected: sem erros de tipo/lint.

- [ ] **Step 3: Sanidade manual do catálogo**

Conferir que a UI de Habilidade Secreta exibe nome+efeito das 11 linhas de grama/inseto sem texto faltando (a UI lê `SECRET_KINDS` dinamicamente). Verificação leve: abrir `src/data/secretAbilities.ts` e confirmar que cada id usado nas 11 entradas novas de `SECRET_LINES` tem entrada em `SECRET_KINDS` (o teste "todo id das linhas existe no catálogo" já garante isso).

- [ ] **Step 4: Abrir o PR para main**

```bash
git push -u origin HEAD
gh pr create --base main --title "feat: habilidades secretas de grama/inseto (Celadon)" --body "$(cat <<'EOF'
## Resumo
Cadastra as habilidades secretas das 11 linhas de Grama/Inseto (Celadon Gym) e implementa as habilidades novas.

- 11 linhas em `SECRET_LINES` (Bulbasaur, Oddish, Bellsprout, Exeggcute, Tangela, Caterpie, Weedle, Paras, Venonat, Scyther, Pinsir).
- **Novas com efeito:** Overgrow (Grama), Swarm (Inseto), Spore (buff diário), Leaf Guard (escudo de dano L1 missão / L2 ginásio), Tinted Lens (compensa desvantagem de tipo).
- **Novas inertes** (até existir o pré-requisito): Chlorophyll (clima de calor), Gluttony e Harvest (berries).
- **Reaproveitadas:** Hustle, Analytic, Regenerator, Fly, Sniper, Dig, Forewarn, Quick Feet, Moxie.

Spec: `docs/superpowers/specs/2026-06-23-habilidades-grama-inseto-design.md`
Plano: `docs/superpowers/plans/2026-06-23-habilidades-grama-inseto.md`

## Testes
`npx vitest run` e `npm run build` passam. Cobertura nova: Overgrow/Swarm, Tinted Lens, Leaf Guard L1/L2, Spore, e mapeamento das 11 linhas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- 11 linhas de `SECRET_LINES` → Task 1. ✓
- 8 ids novos + catálogo → Task 1. ✓
- Overgrow, Swarm → Task 2. ✓
- Tinted Lens → Task 3. ✓
- Leaf Guard L1 → Task 4; L2 → Task 5. ✓
- Spore → Task 6. ✓
- Tier B inertes (Chlorophyll/Gluttony/Harvest) → catálogo em Task 1; sem fiação (correto, pré-requisitos fora de escopo). ✓
- Reaproveitadas (sem engine) → entram só via `SECRET_LINES` em Task 1. ✓
- Testes por efeito → cada task tem teste TDD; mapeamento de linhas em Task 1. ✓

**Placeholder scan:** nenhum TBD/TODO; todo passo de código tem o código real e comandos com saída esperada.

**Type consistency:** `leafGuardAbsorberId(team, minLevel?)` definido na Task 4 e reusado (minLevel=2) na Task 5. `sporeDayBuffs(p, rng)` definido e usado por `applySpore`. `redistributeLeafGuardGymDamage(pre, post)` definido na Task 5 e chamado em `resolveDefense`. Constantes referenciadas (`OVERGROW_*`, `SWARM_*`, `TINTED_LENS_*`, `LEAF_GUARD_GYM_DAMAGE_DIVISOR`, `SPORE_*`, `SPORE_SEED_SALT`) são todas adicionadas nas suas tasks antes do uso.

## Notas de risco
- **Tinted Lens (Task 3):** o par de tipos do teste depende da tabela `src/data/typeChart.ts`. Confirme um par que produza `typeAdvantageMultiplier(['bug'], [X]) < 1` antes de fixar os números do teste (a nota no Step 1 explica como ajustar).
- **Leaf Guard L2 (Task 5):** é pós-processamento; aproxima interações com Sturdy/Reckless/Explosion (resolvidas pela cadeia antes da redistribuição). Comportamento documentado no código.
- **Spore (Task 6):** `applySpore` é chamada em `setupDay` (transição MORNING→DAY); `healRoster` zera `dayBuffs` na virada do dia, então o buff dura exatamente um dia.
