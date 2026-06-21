# Habilidades Secretas nível 1/2 — Fase 1: Fundação (modelo de dados + catálogo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o modelo de dados das Habilidades Secretas de "3 por linha / `secretCount`" para "2 por linha, cada uma com nível 1/2 / `secretPicks`", mantendo o jogo compilando e os efeitos existentes funcionando no nível 1.

**Architecture:** O catálogo (`secretAbilities.ts`) passa a guardar 1 id por habilidade com `effectL1`/`effectL2` (some os ids `*-plus`), e as linhas viram **pares**. O progresso do indivíduo vira `secretPicks: SecretPick[]`. A consulta central passa de `hasSecret(p,id)` (booleano por contagem) para `secretLevelOf(p,id): 0|1|2`, com `hasSecret` reescrito sobre ela. Esta fase NÃO muda magnitudes de efeito nem a UI — só a fundação, mantendo paridade de comportamento no nível 1.

**Tech Stack:** TypeScript (ESM, `.ts` nas importações), Vitest, React. Build com `npm run build` (tsc -b, NÃO `tsc --noEmit`). Testes com `npm test`.

## Global Constraints

- **Verificação:** sempre `npm run build` (tsc -b) e `npm test`. Não usar `tsc --noEmit` (tsconfig raiz é solution-only). Não usar preview (preferência do projeto: testes + DOM leve).
- **Importações com extensão `.ts`** (padrão do projeto, ex.: `from '../types/index.ts'`).
- **Não editar `*.generated.ts`** à mão.
- **Fonte de verdade dos efeitos/linhas:** `docs/superpowers/specs/2026-06-21-habilidades-secretas-nivel-2-design.md` (§3 efeitos, §4 linhas).
- **Ids estáveis** (não renomear): os `SecretId` existentes permanecem; apenas REMOVEM-SE `sa-dig-plus`, `sa-fly-plus`, `sa-surf-plus` (viram nível 2 das bases).
- **Comportamento desta fase:** paridade no nível 1 — nenhum número de efeito muda aqui.

---

### Task 1: Tipo `SecretPick` e campo `secretPicks` no Pokémon

**Files:**
- Modify: `src/types/index.ts:146-186` (interface `Pokemon`)

**Interfaces:**
- Produces: `interface SecretPick { slot: 0 | 1; level: 1 | 2 }`; `Pokemon.secretPicks?: SecretPick[]`. O campo antigo `Pokemon.secretCount?: number` é REMOVIDO.

- [ ] **Step 1: Adicionar o tipo e o campo, remover `secretCount`**

Em `src/types/index.ts`, ANTES da interface `Pokemon`, adicionar:

```ts
/**
 * Uma Habilidade Secreta desbloqueada do PAR da linha do indivíduo, com seu nível.
 * `slot` é qual das duas habilidades (0 ou 1, ver SECRET_LINES); `level` 1 = base, 2 = "+".
 */
export interface SecretPick {
  slot: 0 | 1
  level: 1 | 2
}
```

Dentro de `interface Pokemon`, SUBSTITUIR o bloco `secretCount` (linhas ~162-167):

```ts
  /**
   * Habilidades Secretas desbloqueadas DESTE indivíduo (gravado no Pokémon, preservado na
   * evolução). No máximo 2 destaques na vida: 1º destaque → 1 habilidade nível 1; 2º destaque →
   * a mesma vira nível 2 (aprofundar) OU a outra entra no nível 1 (ampliar). Ausente/[] = nenhuma.
   */
  secretPicks?: SecretPick[]
```

- [ ] **Step 2: Build (vai quebrar — esperado) para mapear os call sites**

Run: `npm run build`
Expected: FALHA com erros em `secretAbilities.ts`, `phaseFlow.ts`, `saveLoad.ts`, `secretEffects.ts`, `TeamSidebar.tsx` etc. citando `secretCount`. Anote a lista — as próximas tasks a zeram.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(secret): tipo SecretPick e campo secretPicks (remove secretCount)"
```

---

### Task 2: Catálogo `SECRET_KINDS` com `effectL1`/`effectL2` e remoção dos ids `*-plus`

**Files:**
- Modify: `src/data/secretAbilities.ts:17-266` (union `SecretId`, `SecretKind`, `SECRET_KINDS`)
- Test: `src/data/secretAbilities.test.ts`

**Interfaces:**
- Produces: `interface SecretKind { id: SecretId; name: string; effectL1: string; effectL2: string }`. `SecretId` SEM `sa-dig-plus`/`sa-fly-plus`/`sa-surf-plus`. `SECRET_KINDS: Record<SecretId, SecretKind>` com os textos L1/L2 do spec §3.

- [ ] **Step 1: Atualizar a interface `SecretKind`**

Em `src/data/secretAbilities.ts`, substituir a interface:

```ts
export interface SecretKind {
  id: SecretId
  name: string
  /** Texto do efeito no nível 1 (regra mora na engine). */
  effectL1: string
  /** Texto do efeito no nível 2 ("+", upgrade que inclui o nível 1). */
  effectL2: string
}
```

- [ ] **Step 2: Remover os 3 ids `*-plus` do union `SecretId`**

Apagar as linhas `| 'sa-dig-plus'`, `| 'sa-fly-plus'`, `| 'sa-surf-plus'` do union.

- [ ] **Step 3: Reescrever `SECRET_KINDS`**

Substituir o objeto inteiro pelos 33 ids restantes, cada um com `name`, `effectL1`, `effectL2`
copiados do spec §3. Apagar as entradas `sa-dig-plus`/`sa-fly-plus`/`sa-surf-plus`. Exemplos
(seguir o spec para os demais — textos exatos da tabela §3):

```ts
export const SECRET_KINDS: Record<SecretId, SecretKind> = {
  'sa-surf': {
    id: 'sa-surf',
    name: 'Surf',
    effectL1: 'Atravessa os pontos de água e, enquanto está na água, ganha +100% de velocidade (só despachado sozinho).',
    effectL2: 'Leva o time inteiro pela água.',
  },
  'sa-fly': {
    id: 'sa-fly',
    name: 'Fly',
    effectL1: 'Voa em linha reta do ginásio à tarefa (caminho curto), sem bônus de velocidade. Risco: um raio mata o time e perde a missão. Só sozinho.',
    effectL2: 'Leva o time inteiro voando (mantém o risco do raio).',
  },
  'sa-dig': {
    id: 'sa-dig',
    name: 'Dig',
    effectL1: 'Abre 2 buracos ligando dois pontos; o time atravessa por baixo da terra.',
    effectL2: 'Um dos buracos aparece sempre no ponto do ginásio.',
  },
  'sa-rollout': {
    id: 'sa-rollout',
    name: 'Rollout',
    effectL1: 'A cada Pokémon derrotado no duelo, o bônus de Batalha para o próximo dobra: +2, +4, +8, +16, +32 (teto). Reinicia a cada batalha.',
    effectL2: 'Começa em +4 e dobra: +4, +8, +16, +32, +64 (teto).',
  },
  // … (sa-sand-rush, sa-rivalry, sa-hustle, sa-sturdy, sa-explosion, sa-weak-armor, sa-rock-head,
  //    sa-battle-armor, sa-lightning-rod, sa-reckless, sa-swift-swim, sa-shell-armor, sa-torrent,
  //    sa-thick-fat, sa-moxie, sa-pressure, sa-regenerator, sa-natural-cure, sa-analytic,
  //    sa-clear-body, sa-sniper, sa-water-absorb, sa-forewarn, sa-cloud-nine, sa-ice-body,
  //    sa-dry-skin, sa-overcoat, sa-own-tempo, sa-static, sa-vital-spirit, sa-quick-feet,
  //    sa-volt-absorb) — copiar effectL1/effectL2 EXATOS da tabela do spec §3.
}
```

> Para inertes (sa-sand-rush; sa-thick-fat L1; sa-ice-body L1; sa-dry-skin calor/frio) manter o
> sufixo "(sem efeito até existir …)" no texto, conforme o spec §3/§8.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: erros restantes só nos consumidores de `SECRET_LINES`/`secretCount` (próximas tasks). O bloco `SECRET_KINDS` deve compilar (todos os 33 ids cobertos, nenhum `*-plus`).

- [ ] **Step 5: Commit**

```bash
git add src/data/secretAbilities.ts
git commit -m "feat(secret): catalogo com effectL1/effectL2 e sem ids *-plus"
```

---

### Task 3: Linhas como PARES e funções derivadas (`secretLevelOf`/`hasSecret`/`activeSecrets`)

**Files:**
- Modify: `src/data/secretAbilities.ts:288-399` (`SECRET_LINES`, `SECRET_LINE_BY_SPECIES`, `SECRET_MAX`, `secretCountOf`, `unlockedSecretIds`, `hasSecret`)
- Test: `src/data/secretAbilities.test.ts`

**Interfaces:**
- Produces:
  - `SECRET_LINES: Record<number, readonly [SecretId, SecretId]>` (pares, do spec §4)
  - `SECRET_LINE_BY_SPECIES: Partial<Record<number, readonly [SecretId, SecretId]>>`
  - `secretLineFor(speciesId: number): readonly [SecretId, SecretId] | null`
  - `secretLevelOf(p: Pokemon, id: SecretId): 0 | 1 | 2`
  - `hasSecret(p: Pokemon, id: SecretId): boolean` (nível ≥ 1)
  - `activeSecrets(p: Pokemon): Array<{ id: SecretId; level: 1 | 2 }>`
  - REMOVE: `SECRET_MAX`, `secretCountOf`, `unlockedSecretIds`.

- [ ] **Step 1: Reescrever o teste de linhas para PARES**

Em `src/data/secretAbilities.test.ts`, substituir `CERULEAN_LINES` e asserts por pares (spec §4) e
trocar a tripla de tipo. Adicionar testes de `secretLevelOf`/`activeSecrets`:

```ts
import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import {
  SECRET_KINDS, SECRET_LINES, secretLineFor, secretLevelOf, hasSecret, activeSecrets,
  type SecretId,
} from './secretAbilities.ts'

const CERULEAN_PAIRS: Record<number, readonly [SecretId, SecretId]> = {
  7: ['sa-surf', 'sa-torrent'],
  54: ['sa-surf', 'sa-cloud-nine'],
  60: ['sa-surf', 'sa-water-absorb'],
  72: ['sa-clear-body', 'sa-surf'],
  79: ['sa-regenerator', 'sa-own-tempo'],
  86: ['sa-surf', 'sa-thick-fat'],
  90: ['sa-shell-armor', 'sa-overcoat'],
  98: ['sa-dig', 'sa-shell-armor'],
  116: ['sa-surf', 'sa-sniper'],
  118: ['sa-surf', 'sa-swift-swim'],
  120: ['sa-analytic', 'sa-natural-cure'],
  124: ['sa-dry-skin', 'sa-forewarn'],
  129: ['sa-surf', 'sa-moxie'],
  131: ['sa-surf', 'sa-shell-armor'],
  138: ['sa-swift-swim', 'sa-shell-armor'],
  140: ['sa-battle-armor', 'sa-swift-swim'],
  144: ['sa-fly', 'sa-pressure'],
}

describe('Linhas (pares) e níveis', () => {
  it('cada raiz mapeia para o par do spec', () => {
    for (const [root, pair] of Object.entries(CERULEAN_PAIRS)) {
      expect(secretLineFor(Number(root)), `linha ${root}`).toEqual(pair)
    }
  })

  it('formas evoluídas herdam a raiz', () => {
    expect(secretLineFor(9)).toEqual(secretLineFor(7)) // Blastoise = Squirtle
  })

  it('eeveelutions têm par próprio sem vazar', () => {
    expect(secretLineFor(134)).toEqual(['sa-surf', 'sa-water-absorb']) // Vaporeon
    expect(secretLineFor(135)).toEqual(['sa-quick-feet', 'sa-volt-absorb']) // Jolteon
    expect(secretLineFor(133)).toBeNull() // Eevee
    expect(secretLineFor(136)).toBeNull() // Flareon
  })

  it('secretLevelOf reflete slot+level dos picks', () => {
    // Squirtle (7): slot 0 = sa-surf, slot 1 = sa-torrent
    const base = makeMon({ speciesId: 7 })
    expect(secretLevelOf(base, 'sa-surf')).toBe(0)

    const l1 = makeMon({ speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] })
    expect(secretLevelOf(l1, 'sa-surf')).toBe(1)
    expect(secretLevelOf(l1, 'sa-torrent')).toBe(0)
    expect(hasSecret(l1, 'sa-surf')).toBe(true)

    const plus = makeMon({ speciesId: 7, secretPicks: [{ slot: 0, level: 2 }] })
    expect(secretLevelOf(plus, 'sa-surf')).toBe(2)

    const wide = makeMon({ speciesId: 7, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] })
    expect(secretLevelOf(wide, 'sa-surf')).toBe(1)
    expect(secretLevelOf(wide, 'sa-torrent')).toBe(1)
    expect(activeSecrets(wide)).toEqual([
      { id: 'sa-surf', level: 1 },
      { id: 'sa-torrent', level: 1 },
    ])
  })

  it('todo id das linhas existe no catálogo', () => {
    const ids = new Set(Object.values(SECRET_LINES).flat() as SecretId[])
    for (const id of ids) expect(SECRET_KINDS[id]).toBeDefined()
  })
})
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npm test -- secretAbilities`
Expected: FALHA (`secretLevelOf`/`activeSecrets` não existem; `SECRET_LINES` ainda é tripla).

- [ ] **Step 3: Converter `SECRET_LINES`/`SECRET_LINE_BY_SPECIES` para pares**

Substituir os tipos e TODAS as entradas pelos pares do spec §4 (lista completa):

```ts
export const SECRET_LINES: Record<number, readonly [SecretId, SecretId]> = {
  // Vermilion
  25: ['sa-static', 'sa-dig'],
  81: ['sa-sturdy', 'sa-analytic'],
  100: ['sa-explosion', 'sa-rollout'],
  125: ['sa-vital-spirit', 'sa-volt-absorb'],
  145: ['sa-fly', 'sa-pressure'],
  // Pewter / Ground / Fóssil
  27: ['sa-rollout', 'sa-dig'],
  29: ['sa-rivalry', 'sa-hustle'],
  32: ['sa-rivalry', 'sa-hustle'],
  50: ['sa-dig', 'sa-sand-rush'],
  74: ['sa-sturdy', 'sa-explosion'],
  95: ['sa-sturdy', 'sa-weak-armor'],
  104: ['sa-battle-armor', 'sa-lightning-rod'],
  111: ['sa-rock-head', 'sa-reckless'],
  138: ['sa-swift-swim', 'sa-shell-armor'],
  140: ['sa-battle-armor', 'sa-swift-swim'],
  142: ['sa-fly', 'sa-rock-head'],
  // Dragão
  147: ['sa-surf', 'sa-fly'],
  // Cerulean
  7: ['sa-surf', 'sa-torrent'],
  54: ['sa-surf', 'sa-cloud-nine'],
  60: ['sa-surf', 'sa-water-absorb'],
  72: ['sa-clear-body', 'sa-surf'],
  79: ['sa-regenerator', 'sa-own-tempo'],
  86: ['sa-surf', 'sa-thick-fat'],
  90: ['sa-shell-armor', 'sa-overcoat'],
  98: ['sa-dig', 'sa-shell-armor'],
  116: ['sa-surf', 'sa-sniper'],
  118: ['sa-surf', 'sa-swift-swim'],
  120: ['sa-analytic', 'sa-natural-cure'],
  124: ['sa-dry-skin', 'sa-forewarn'],
  129: ['sa-surf', 'sa-moxie'],
  131: ['sa-surf', 'sa-shell-armor'],
  144: ['sa-fly', 'sa-pressure'],
}

const SECRET_LINE_BY_SPECIES: Partial<Record<number, readonly [SecretId, SecretId]>> = {
  134: ['sa-surf', 'sa-water-absorb'], // Vaporeon
  135: ['sa-quick-feet', 'sa-volt-absorb'], // Jolteon
}
```

- [ ] **Step 4: Reescrever `secretLineFor` e as funções derivadas**

Substituir `SECRET_MAX`, `secretCountOf`, `unlockedSecretIds`, `hasSecret` por:

```ts
/** As DUAS habilidades (ids, slots 0 e 1) da linha de uma espécie — null se a linha não tem. */
export function secretLineFor(speciesId: number): readonly [SecretId, SecretId] | null {
  return SECRET_LINE_BY_SPECIES[speciesId] ?? SECRET_LINES[lineRootId(speciesId)] ?? null
}

/** Nível desta habilidade no indivíduo: 0 = não desbloqueada, 1 = base, 2 = "+". */
export function secretLevelOf(p: Pokemon, id: SecretId): 0 | 1 | 2 {
  const line = secretLineFor(p.speciesId)
  if (!line) return 0
  const slot = line[0] === id ? 0 : line[1] === id ? 1 : -1
  if (slot < 0) return 0
  const pick = (p.secretPicks ?? []).find((s) => s.slot === slot)
  return pick ? pick.level : 0
}

/** Tem a habilidade desbloqueada (nível ≥ 1)? */
export function hasSecret(p: Pokemon, id: SecretId): boolean {
  return secretLevelOf(p, id) >= 1
}

/** Habilidades ativas (id + nível) do indivíduo, na ordem dos slots. */
export function activeSecrets(p: Pokemon): Array<{ id: SecretId; level: 1 | 2 }> {
  const line = secretLineFor(p.speciesId)
  if (!line) return []
  return (p.secretPicks ?? [])
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({ id: line[s.slot], level: s.level }))
}
```

Atualizar o comentário-cabeçalho do arquivo (linhas 1-8) para o novo modelo (2 por linha, nível 1/2,
2 destaques na vida).

- [ ] **Step 5: Rodar o teste**

Run: `npm test -- secretAbilities`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/secretAbilities.ts src/data/secretAbilities.test.ts
git commit -m "feat(secret): linhas como pares + secretLevelOf/activeSecrets"
```

---

### Task 4: Predicados de nível em `secretEffects.ts` (paridade L1)

**Files:**
- Modify: `src/engine/secretEffects.ts:43-137` (predicados `hasX`/`hasXPlus`)
- Test: `src/engine/secretEffects.test.ts`

**Interfaces:**
- Consumes: `secretLevelOf`, `hasSecret` (Task 3).
- Produces: predicados inalterados na ASSINATURA (`hasSurf(p)`, `hasDig(p)`, …) mas reimplementados
  sobre `secretLevelOf`. Os antigos `hasDigPlus`/`hasSurfPlus`/`hasFlyPlus` viram
  `secretLevelOf(p,'sa-dig') === 2` etc. — manter as funções com o mesmo nome para os call sites.

- [ ] **Step 1: Ajustar os predicados `*Plus`**

Em `src/engine/secretEffects.ts`, as funções que hoje testam `hasSecret(p,'sa-dig-plus')` passam a
testar nível 2 da base. Substituir:

```ts
export function hasDigPlus(p: Pokemon): boolean {
  return secretLevelOf(p, 'sa-dig') === 2
}
```

E nas funções `isFlyer`/`teamFlies`/`teamSurfs` trocar `hasSecret(p,'sa-fly-plus')` por
`secretLevelOf(p,'sa-fly') === 2` e `hasSecret(p,'sa-surf-plus')` por `secretLevelOf(p,'sa-surf') === 2`.
Ajustar `hasSurf` para:

```ts
export function hasSurf(p: Pokemon): boolean {
  return secretLevelOf(p, 'sa-surf') >= 1
}
```

Importar `secretLevelOf` de `../data/secretAbilities.ts` (junto de `hasSecret`).

- [ ] **Step 2: Atualizar os testes que usam `secretCount`/posição de linha**

Em `src/engine/secretEffects.test.ts`, trocar `makeMon({ speciesId, secretCount })` por
`secretPicks`. Ex.: Goldeen(118) Surf é slot 0 → `secretPicks: [{slot:0, level:1}]`. Atualizar o
comentário das linhas 47-49 para os pares novos. (Mapear cada caso usado: Surf+ vira
`{slot:0, level:2}` na linha onde Surf é slot 0.)

- [ ] **Step 3: Build + testes**

Run: `npm run build` (espera-se que sobrem só erros em `phaseFlow.ts`/`saveLoad.ts`/UI)
Run: `npm test -- secretEffects`
Expected: testes de secretEffects PASS (paridade L1 mantida).

- [ ] **Step 4: Commit**

```bash
git add src/engine/secretEffects.ts src/engine/secretEffects.test.ts
git commit -m "feat(secret): predicados *Plus via secretLevelOf (paridade L1)"
```

---

### Task 5: Fluxo de desbloqueio mínimo em `phaseFlow.ts` (1 destaque = 1 slot L1)

**Files:**
- Modify: `src/game/phaseFlow.ts:22` (import) e `:147-167` (`unlockSecretAbility`)
- Modify: `src/engine/state.ts:405-409` (tipo de `today.secretUnlock`)
- Test: `src/game/phaseFlow` (criar/estender teste de unlock)

**Interfaces:**
- Consumes: `secretLineFor`, `secretLevelOf` (Task 3).
- Produces: `today.secretUnlock` novo formato: `{ pokemonId: string; slot: 0 | 1; level: 1 | 2; choice: 'first' | 'deepen' | 'widen' } | null`. Esta fase implementa só o caminho automático mínimo (1º destaque → slot 0 nível 1; 2º destaque → "widen" por padrão). A ESCOLHA do jogador (deepen vs widen, qual slot) entra na Fase 2 (UI). Aqui garantimos que o estado avança sem `secretCount`.

> Nota: o comportamento de escolha real vem na Fase 2. Aqui o padrão é determinístico
> (slot 0 primeiro, depois "widen") só para manter o jogo jogável e o build verde.

- [ ] **Step 1: Atualizar o tipo de `secretUnlock` em `state.ts`**

Substituir o campo (linha ~409):

```ts
  secretUnlock: { pokemonId: string; slot: 0 | 1; level: 1 | 2; choice: 'first' | 'deepen' | 'widen' } | null
```

- [ ] **Step 2: Escrever o teste do fluxo mínimo**

Criar `src/game/secretUnlock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import { secretLevelOf, secretLineFor } from '../data/secretAbilities.ts'
import { unlockSecretAbility } from './phaseFlow.ts'
import { createInitialState } from '../engine/state.ts'

function stateWith(mon: ReturnType<typeof makeMon>) {
  const s = createInitialState(1)
  s.roster = [mon]
  return s
}

describe('unlockSecretAbility (fundação)', () => {
  it('1º destaque grava slot 0 nível 1', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 })) // Squirtle: [surf, torrent]
    unlockSecretAbility(s, 'p1')
    expect(secretLevelOf(s.roster[0], 'sa-surf')).toBe(1)
    expect(s.today.secretUnlock).toMatchObject({ pokemonId: 'p1', slot: 0, level: 1 })
  })

  it('2º destaque (widen) entra na outra no nível 1', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    unlockSecretAbility(s, 'p1')
    expect(secretLevelOf(s.roster[0], 'sa-surf')).toBe(1)
    expect(secretLevelOf(s.roster[0], 'sa-torrent')).toBe(1)
  })

  it('trava no 2º destaque (não há 3º)', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))
    unlockSecretAbility(s, 'p1')
    expect(s.roster[0].secretPicks).toHaveLength(2)
    expect(s.today.secretUnlock).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar (deve falhar — `unlockSecretAbility` não exporta / usa secretCount)**

Run: `npm test -- secretUnlock`
Expected: FALHA.

- [ ] **Step 4: Reescrever `unlockSecretAbility` e exportá-la**

Em `phaseFlow.ts`, trocar o import da linha 22 para
`import { secretLineFor, secretLevelOf } from '../data/secretAbilities.ts'` e substituir a função
(tornando-a `export`):

```ts
/**
 * Destaque do Dia desbloqueia/evolui a Habilidade Secreta (no máx. 2 destaques na vida).
 * Fundação (Fase 1): 1º destaque grava o slot 0 no nível 1; 2º destaque faz "widen" (a outra no
 * nível 1). A ESCOLHA do jogador (qual slot; aprofundar vs ampliar) entra na Fase 2 (UI).
 */
export function unlockSecretAbility(s: GameState, mvpId: string | null): void {
  s.today.secretUnlock = null
  if (!mvpId) return
  const mon = s.roster.find((p) => p.id === mvpId)
  if (!mon) return
  const line = secretLineFor(mon.speciesId)
  if (!line) return
  const picks = mon.secretPicks ?? []
  if (picks.length === 0) {
    const next = [{ slot: 0 as const, level: 1 as const }]
    s.roster = s.roster.map((p) => (p.id === mon.id ? { ...p, secretPicks: next } : p))
    s.today.secretUnlock = { pokemonId: mon.id, slot: 0, level: 1, choice: 'first' }
    return
  }
  if (picks.length === 1 && picks[0].level === 1) {
    const otherSlot = (picks[0].slot === 0 ? 1 : 0) as 0 | 1
    const next = [...picks, { slot: otherSlot, level: 1 as const }]
    s.roster = s.roster.map((p) => (p.id === mon.id ? { ...p, secretPicks: next } : p))
    s.today.secretUnlock = { pokemonId: mon.id, slot: otherSlot, level: 1, choice: 'widen' }
    return
  }
  // Já usou os 2 destaques (1 nível 2, ou 2 nível 1): nada muda.
}
```

Remover o import não usado `SECRET_MAX` (não existe mais).

- [ ] **Step 5: Rodar o teste**

Run: `npm test -- secretUnlock`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/phaseFlow.ts src/engine/state.ts src/game/secretUnlock.test.ts
git commit -m "feat(secret): fluxo de desbloqueio por secretPicks (fundacao)"
```

---

### Task 6: Migração de saves (`secretCount` → `secretPicks`) + bump de versão

**Files:**
- Modify: `src/engine/constants.ts` (`SAVE_VERSION`)
- Modify: `src/persistence/saveLoad.ts` (nova etapa de migração no fim da cadeia)
- Test: `src/persistence/saveLoad.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: nova versão de save (atual + 1). Mapeamento best-effort: `secretCount` `0 → []`;
  `1 → [{slot:0,level:1}]`; `>=2 → [{slot:0,level:1},{slot:1,level:1}]`. Remove `secretCount`.
  Limpa `today.secretUnlock` (formato incompatível) → null.

- [ ] **Step 1: Ler a versão atual**

Run: `npm run build` não é necessário; abrir `src/engine/constants.ts` e localizar
`export const SAVE_VERSION = N`. A nova etapa será `N → N+1`. (Hoje N=29; confirmar no arquivo.)

- [ ] **Step 2: Escrever o teste de migração**

Em `src/persistence/saveLoad.test.ts`, adicionar (ajustar o `version` de origem para o N atual):

```ts
it('migra secretCount (modelo 3-por-linha) para secretPicks', () => {
  const mon = (secretCount: number) => ({
    id: 'p', speciesId: 7, level: 5, xp: 0, types: ['water'], baseAttrs: {}, ivs: {},
    allocations: {}, currentHp: 5, maxHp: 5, status: 'atGym', passives: [], gender: 'male',
    nickname: null, nature: null, secretCount,
  })
  const file = {
    version: 29, savedAtMs: 0,
    state: { roster: [mon(0), mon(1), mon(3)], box: [], today: { secretUnlock: { foo: 1 } } },
  }
  localStorage.setItem('poke-badgekeeper-save', JSON.stringify(file)) // usar SAVE_KEY real
  const loaded = loadGame()!
  expect(loaded.roster[0].secretPicks ?? []).toEqual([])
  expect(loaded.roster[1].secretPicks).toEqual([{ slot: 0, level: 1 }])
  expect(loaded.roster[2].secretPicks).toEqual([{ slot: 0, level: 1 }, { slot: 1, level: 1 }])
  expect((loaded.roster[0] as Record<string, unknown>).secretCount).toBeUndefined()
})
```

> Conferir no topo de `saveLoad.test.ts` como os outros testes montam o save (chave/SAVE_KEY,
> `version` inicial) e seguir o mesmo padrão.

- [ ] **Step 3: Rodar (deve falhar)**

Run: `npm test -- saveLoad`
Expected: FALHA (sem etapa de migração; `secretPicks` ausente).

- [ ] **Step 4: Adicionar a etapa de migração**

No fim da cadeia em `migrate()` (após o bloco `version === 29`), antes do retorno final:

```ts
// v29 → v30: Habilidades Secretas viram 2 por linha com nível 1/2. secretCount → secretPicks
// (best-effort por contagem: 0→[]; 1→slot0 nível1; ≥2→slots 0 e 1 nível1). Limpa o reveal do dia.
if (version === 29) {
  const migrateMon = (p: Record<string, unknown>): Record<string, unknown> => {
    const count = typeof p.secretCount === 'number' ? p.secretCount : 0
    const rest = { ...p }
    delete rest.secretCount
    const picks =
      count <= 0 ? [] : count === 1 ? [{ slot: 0, level: 1 }] : [{ slot: 0, level: 1 }, { slot: 1, level: 1 }]
    return { ...rest, secretPicks: picks }
  }
  const mapRoster = (arr: unknown): unknown =>
    Array.isArray(arr) ? arr.map((p) => migrateMon(p as Record<string, unknown>)) : arr
  const today = state.today as Record<string, unknown> | undefined
  state = {
    ...state,
    roster: mapRoster(state.roster),
    box: mapRoster(state.box),
    today: today && typeof today === 'object' ? { ...today, secretUnlock: null } : today,
  } as typeof state
  version = 30
}
```

Atualizar `SAVE_VERSION` em `constants.ts` para `30`.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -- saveLoad`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/constants.ts src/persistence/saveLoad.ts src/persistence/saveLoad.test.ts
git commit -m "feat(secret): migracao secretCount->secretPicks (save v30)"
```

---

### Task 7: Fechar o build — call sites restantes (UI e outros) com paridade L1

**Files:**
- Modify: `src/components/day/TeamSidebar.tsx:11,135-136,179` (usa `secretCountOf`/`SECRET_MEDAL`/`unlockedSecretIds`)
- Modify: quaisquer outros arquivos que o build apontar (ex.: `MemberDetail.tsx`, `daySummary.ts`, `setup.ts`) ainda referenciando `secretCount`/`unlockedSecretIds`/`SECRET_MAX`/`*-plus`.

**Interfaces:**
- Consumes: `secretLevelOf`, `activeSecrets`, `secretLineFor`, `SECRET_KINDS` (Task 2-3).
- Produces: build verde. UI mostra as habilidades ativas via `activeSecrets(mon)` (id+nível); o
  "medalhão" por contagem é substituído por contagem de `secretPicks.length` (0/1/2) — refinamento
  visual completo fica para a Fase 2.

- [ ] **Step 1: Rodar o build e listar os erros restantes**

Run: `npm run build`
Expected: lista finita de arquivos. Para cada um, trocar:
- `secretCountOf(mon)` → `(mon.secretPicks?.length ?? 0)` (se só precisa da contagem 0/1/2), ou
  `activeSecrets(mon)` quando precisa dos ids/níveis exibidos.
- `unlockedSecretIds(mon)` → `activeSecrets(mon).map((s) => s.id)`.
- Texto do efeito: onde usava `SECRET_KINDS[id].effect`, usar `effectL1`/`effectL2` conforme o
  nível (`activeSecrets` dá o nível).

- [ ] **Step 2: Ajustar `TeamSidebar.tsx`**

Substituir `secretCountOf`/`unlockedSecretIds` por `activeSecrets`. Ex. (manter o `SECRET_MEDAL`
indexado por `picks.length`, 0..2):

```tsx
import { activeSecrets, SECRET_KINDS } from '../../data/secretAbilities.ts'
// …
const secrets = activeSecrets(mon)
const secretCount = secrets.length // 0..2
const secretActive = secretCount > 0
// onde lista as habilidades, usar secrets.map(({id, level}) =>
//   `${SECRET_KINDS[id].name}${level === 2 ? '+' : ''}`)
```

Se `SECRET_MEDAL` tinha 4 posições (0..3), reduzir para 3 (0..2).

- [ ] **Step 3: Repetir para os demais arquivos apontados pelo build** (mesmo padrão do Step 1).

- [ ] **Step 4: Build + suíte completa**

Run: `npm run build`
Expected: PASS (0 erros).
Run: `npm test`
Expected: toda a suíte PASS (com os testes desta fase). Se algum teste antigo usava `secretCount`/
posição-3-da-linha, ajustar para `secretPicks`/pares.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(secret): fechar build dos call sites (paridade L1)"
```

---

## Self-Review (Fase 1)

- **Cobertura do spec (fundação):** §2 modelo de dados (`secretPicks`, `SecretPick`) → Tasks 1,3;
  catálogo `effectL1/L2` sem `*-plus` → Task 2; linhas como pares (§4) → Task 3; `secretLevelOf`/
  `hasSecret`/`activeSecrets` → Task 3; predicados `*Plus` por nível → Task 4; fluxo de 2 destaques
  (mínimo) → Task 5; migração → Task 6; build verde/UI mínima → Task 7. As MAGNITUDES de efeito
  (§3) e a UI de escolha ficam para as Fases 2+ (escopo declarado).
- **Sem placeholders de código:** os `// …` em `SECRET_KINDS` (Task 2) e na lista de call sites
  (Task 7) são listas exaustivas direcionadas ao spec/build, não lógica omitida.
- **Consistência de tipos:** `secretLevelOf(p,id): 0|1|2`, `SecretPick{slot,level}`,
  `secretLineFor → [SecretId, SecretId]` usados igualmente em todas as tasks. `unlockSecretAbility`
  exportada e consumida pelo teste da Task 5.

## Fases seguintes (escopo — planos próprios após esta fase executar)

- **Fase 2 — Desbloqueio + UI de escolha:** `phaseFlow` com escolha real (1º: qual slot; 2º:
  aprofundar vs ampliar), `SummaryScreen` (reveal + escolha), `TeamSidebar`/`MemberDetail` (nível e
  "+"). Limpeza de textos "(sem efeito até existir a tempestade)".
- **Fase 3 — Magnitudes por nível (efeitos já existentes):** Rollout, Rivalry, Hustle, Rock Head,
  Analytic, Battle Armor, Torrent, Weak Armor (sem dobro de dano), Shell Armor (½/⅓), Pressure
  (não-acumula), Swift Swim+, Forewarn+, Quick Feet+, Reckless+, Sturdy+, Explosion+, Regenerator+,
  Natural Cure+, Vital Spirit+, Water Absorb, Sniper. Constantes em `balance.ts`.
- **Fase 4 — Efeitos novos de batalha/clima:** Fly (morte por raio), Lightning Rod (imunidade de
  time + assume duelo), Volt Absorb, Static, Moxie (permanente teto 60), auto-win por tipo (Thick
  Fat+/Ice Body+), Clear Body, Cloud Nine, Overcoat, Own Tempo, Dry Skin.
- **Fase 5 — Skill `managing-pokemon-species`** atualizada (2 por linha, nível 1/2) + PR para `main`.
