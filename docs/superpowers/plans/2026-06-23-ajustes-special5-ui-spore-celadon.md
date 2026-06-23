# Ajustes (special5, seletor de Habilidade, Spore, mart de Celadon) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quatro ajustes independentes de jogo/UI: deixar a Missão Especial (`special5`) mais difícil (4 principais + 2 secundários com "mega"), redesenhar o seletor de Habilidade Secreta (cartas claras legíveis), parar de mostrar o buff do Spore como "item x", e tornar o mart central de Celadon alcançável a pé (Surf vira atalho).

**Architecture:** Mudanças pontuais na engine pura (`missions.ts`, `attributes.ts`), nos dados (`cities.ts`), num hook de dia (`setup.ts`/`phaseFlow.ts`) e na camada de apresentação (`SummaryScreen` + CSS module). Cada tarefa é isolada, com seu próprio ciclo de teste e commit; não há dependência entre elas.

**Tech Stack:** TypeScript, React, Vitest. Build via `tsc -b` (`npm run build`). Testes via `npx vitest run`.

## Global Constraints

- **Determinismo:** toda geração de jogo consome `rng` (seed do dia) em ordem fixa; mesmo seed/dia → mesmo resultado. Não introduzir `Math.random`/`Date.now`.
- **Build/tipos:** validar com `npm run build` (é `tsc -b`; **não** usar `tsc --noEmit` — o tsconfig raiz é solution-only).
- **Escala de atributos inalterada:** faixas dos eixos seguem `MISSION_PRINCIPAL_MIN/MAX = 20/30`, `MISSION_SECONDARY_MIN/MAX = 10/20`; teto de eixo de missão `TEAM_ATTR_MAX = 100`. Nenhuma faixa nova.
- **Fora de escopo:** `special2` (pokecenter/pokemart), outras cidades, outros nós de Surf, e a lógica de spawn/seleção de missão (só dados de Celadon mudam).

---

## Task 1: Missão Especial `special5` — 4 principais + 2 secundários com "mega"

**Files:**
- Modify: `src/engine/balance.ts:123` (constante `SPECIAL5_PRINCIPALS`)
- Modify: `src/engine/missions.ts:107-142` (`generateRequirement` — ramo das especiais e comentário)
- Test: `src/engine/missions.test.ts:176-185` (substituir o teste do `special5`)

**Interfaces:**
- Consumes: `generateRequirement(rng: Rng, day: number, template: MissionTemplate): GeneratedRequirement`; helpers já existentes `principalValue`/`secondaryValue`; `clamp`, `TEAM_ATTR_MAX`, `ATTR_KEYS`; constantes `SPECIAL5_PRINCIPALS`, `SPECIAL5_SECONDARIES`, `SPECIAL2_PRINCIPALS`, `SPECIAL2_SECONDARIES`.
- Produces: comportamento novo do `special5` (4 principais + 2 secundários, secundário pode virar "mega"); assinatura de `generateRequirement` inalterada.

- [ ] **Step 1: Substituir o teste do `special5` (falha esperada)**

Em `src/engine/missions.test.ts`, substituir o bloco `it('special5 ...')` das linhas 176-185 por:

```ts
  it('special5 (Missão Especial): 4 principais + 2 secundários, com mega possível', () => {
    let sawMega = false
    for (let seed = 1; seed <= 40; seed++) {
      const { requirement, secondaryAttr } = generateRequirement(createRng(seed), 3, SPECIAL_TEMPLATE)
      expect(secondaryAttr).toBeNull()
      // 4 principais sempre presentes (no dia 3 o principal cai em 30..40).
      expect(ATTR_KEYS.filter((k) => requirement[k] >= 30).length).toBeGreaterThanOrEqual(4)
      // Entre 4 e 6 eixos reforçados (>=20): 0..2 sobram no "resto" conforme quantos viram mega.
      const loaded = ATTR_KEYS.filter((k) => requirement[k] >= 20).length
      expect(loaded).toBeGreaterThanOrEqual(4)
      expect(loaded).toBeLessThanOrEqual(6)
      // Dia 3 não satura nenhum eixo no teto do time.
      expect(ATTR_KEYS.every((k) => requirement[k] < TEAM_ATTR_MAX)).toBe(true)
      // Mega = principal + secundário no mesmo eixo → no dia 3 passa de 40 (acima do principal puro).
      if (ATTR_KEYS.some((k) => requirement[k] > 40)) sawMega = true
    }
    expect(sawMega, 'a coincidência principal×secundário (mega) ocorre em alguns sorteios').toBe(true)
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/engine/missions.test.ts -t special5`
Expected: FAIL (hoje só há 3 principais e nunca há mega → `count(>=30) >= 4` e/ou `sawMega` falham).

- [ ] **Step 3: Subir `SPECIAL5_PRINCIPALS` para 4**

Em `src/engine/balance.ts`, linha 123:

```ts
export const SPECIAL5_PRINCIPALS = 4
```

(`SPECIAL5_SECONDARIES = 2` permanece.)

- [ ] **Step 4: Reescrever o ramo das especiais em `generateRequirement`**

Em `src/engine/missions.ts`, substituir o trecho atual (linhas 134-141):

```ts
  // Especiais: sorteia os eixos principais/secundários sem repetição (sem nenhum forçado).
  const principals = template.gen === 'special5' ? SPECIAL5_PRINCIPALS : SPECIAL2_PRINCIPALS
  const secondaries = template.gen === 'special5' ? SPECIAL5_SECONDARIES : SPECIAL2_SECONDARIES
  const axes = rng.shuffle(ATTR_KEYS)
  let i = 0
  for (let k = 0; k < principals; k++, i++) out[axes[i] as AttrKey] = principalValue(rng, day)
  for (let k = 0; k < secondaries; k++, i++) out[axes[i] as AttrKey] = secondaryValue(rng, day)
  return { requirement: out, secondaryAttr: null }
```

por:

```ts
  // special5 (Missão Especial): 4 principais + 2 secundários sorteados entre TODOS os eixos
  // (distintos entre si). Um secundário que cai num eixo principal vira "mega" (principal +
  // secundário no mesmo eixo, capado no teto do time). Sobram 0..2 eixos no "resto".
  if (template.gen === 'special5') {
    const principalAxes = rng.shuffle(ATTR_KEYS).slice(0, SPECIAL5_PRINCIPALS)
    const principalSet = new Set(principalAxes)
    for (const ax of principalAxes) out[ax as AttrKey] = principalValue(rng, day)
    const secAxes = rng.shuffle(ATTR_KEYS).slice(0, SPECIAL5_SECONDARIES)
    for (const ax of secAxes) {
      out[ax as AttrKey] = principalSet.has(ax)
        ? clamp(out[ax as AttrKey] + secondaryValue(rng, day), 0, TEAM_ATTR_MAX) // mega
        : secondaryValue(rng, day)
    }
    return { requirement: out, secondaryAttr: null }
  }

  // special2 (pokecenter/pokemart): 2 principais + 1 secundário, todos distintos (sem mega).
  const axes = rng.shuffle(ATTR_KEYS)
  let i = 0
  for (let k = 0; k < SPECIAL2_PRINCIPALS; k++, i++) out[axes[i] as AttrKey] = principalValue(rng, day)
  for (let k = 0; k < SPECIAL2_SECONDARIES; k++, i++) out[axes[i] as AttrKey] = secondaryValue(rng, day)
  return { requirement: out, secondaryAttr: null }
```

Também atualizar o comentário do JSDoc da função (linha 111) que descreve o desenho antigo. Trocar:

```ts
 * Especiais: eixos sorteados (special2 = 2 princ + 1 sec; special5 = 3 princ + 2 sec).
```

por:

```ts
 * Especiais: special2 = 2 princ + 1 sec (distintos); special5 = 4 princ + 2 sec, e um
 * secundário pode coincidir com um principal (vira "mega" naquele eixo).
```

- [ ] **Step 5: Rodar os testes de missões e confirmar que passam**

Run: `npx vitest run src/engine/missions.test.ts`
Expected: PASS (special5 novo, special2 e normal inalterados).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add src/engine/balance.ts src/engine/missions.ts src/engine/missions.test.ts
git commit -m "feat(missoes): special5 com 4 principais + 2 secundarios (mega possivel)"
```

---

## Task 2: Spore — separar o buff de habilidade do buff de item (sem "item x")

**Files:**
- Modify: `src/types/index.ts:192` (novo campo `secretBuffs` no `Pokemon`)
- Modify: `src/engine/testkit.ts:54` (override de `secretBuffs`)
- Modify: `src/engine/attributes.ts:73-83` (`effectiveAttr` soma `secretBuffs`)
- Modify: `src/game/setup.ts:157-174` (`applySpore` grava em `secretBuffs`)
- Modify: `src/game/phaseFlow.ts:274-278` (`healRoster` limpa `secretBuffs`)
- Test: `src/game/setup.test.ts:40-59` (ajustar os testes do `applySpore`)

**Interfaces:**
- Consumes: `Pokemon` (de `src/types/index.ts`); `effectiveAttr(p, key)`; `recomputeMaxHp(p)`; `applySpore(s: GameState)`; `sporeDayBuffs(p, rng)`.
- Produces: campo `Pokemon.secretBuffs?: Partial<Attrs>` (aditivo flat, efêmero); `effectiveAttr` passa a somar `dayBuffs + secretBuffs`. A `ItemsBar` (que lê só `dayBuffs`) deixa de mostrar o Spore.

- [ ] **Step 1: Adicionar o campo `secretBuffs` ao tipo e ao testkit**

Em `src/types/index.ts`, logo após o campo `dayBuffs` (linha 192), inserir:

```ts
  /**
   * Buffs temporários por eixo aplicados por HABILIDADES SECRETAS (ex.: Spore). Somados ao
   * atributo efetivo como o `dayBuffs`, mas separados dos itens x_* — não aparecem na barra de
   * itens. Valem só no dia e são limpos na virada do dia. Ausente = sem buff.
   */
  secretBuffs?: Partial<Attrs>
```

Em `src/engine/testkit.ts`, logo após a linha 54 (`dayBuffs: overrides.dayBuffs,`), inserir:

```ts
    secretBuffs: overrides.secretBuffs,
```

- [ ] **Step 2: Ajustar os testes do `applySpore` (falha esperada)**

Em `src/game/setup.test.ts`, substituir o bloco `describe('applySpore', ...)` (linhas 40-59) por:

```ts
describe('applySpore', () => {
  it('grava secretBuffs (não dayBuffs) e recalcula HP no início do dia (L2 = 3 eixos)', () => {
    const s = autoSeedRun(1)
    // Oddish(43): slot1 = sa-spore L2; resistência alta para o buff poder mexer no maxHp.
    s.roster = [makeMon({ id: 'p', speciesId: 43, baseAttrs: makeAttrs({ resistencia: 50 }, 30), secretPicks: [{ slot: 1, level: 2 }] })]
    const before = s.roster[0]!.maxHp
    applySpore(s)
    const after = s.roster[0]!
    expect(Object.keys(after.secretBuffs ?? {}).length).toBe(3)
    expect(after.dayBuffs, 'Spore não escreve em dayBuffs (não vira item na barra)').toBeUndefined()
    expect(after.currentHp).toBe(after.maxHp) // começa o dia cheio
    expect(after.maxHp).toBeGreaterThanOrEqual(before) // resistência buffada pode subir o HP
  })

  it('não altera Pokémon sem Spore', () => {
    const s = autoSeedRun(1)
    s.roster = [makeMon({ id: 'p', speciesId: 1, baseAttrs: makeAttrs() })]
    applySpore(s)
    expect(s.roster[0]!.secretBuffs).toBeUndefined()
    expect(s.roster[0]!.dayBuffs).toBeUndefined()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/game/setup.test.ts -t applySpore`
Expected: FAIL (`secretBuffs` vem `undefined` e `dayBuffs` vem definido, pois `applySpore` ainda grava `dayBuffs`).

- [ ] **Step 4: `effectiveAttr` passa a somar `secretBuffs`**

Em `src/engine/attributes.ts`, na função `effectiveAttr` (linhas 73-83), incluir o buff de habilidade:

```ts
export function effectiveAttr(p: Pokemon, key: AttrKey): number {
  const perPoint = natureBonusPerPoint(p.nature, key)
  const iv = p.ivs?.[key] ?? 0
  const buff = p.dayBuffs?.[key] ?? 0
  const secret = p.secretBuffs?.[key] ?? 0
  const perma = p.permaBonus?.[key] ?? 0
  return clamp(
    p.baseAttrs[key] + iv + p.allocations[key] * perPoint + buff + secret + perma,
    ATTR_EFFECTIVE_MIN,
    ATTR_MAX,
  )
}
```

- [ ] **Step 5: `applySpore` grava em `secretBuffs`**

Em `src/game/setup.ts`, dentro de `applySpore` (linhas 162-174), trocar o uso de `dayBuffs` por `secretBuffs`:

```ts
  s.roster = s.roster.map((p) => {
    const add = sporeDayBuffs(p, rng)
    if (Object.keys(add).length === 0) return p
    const secretBuffs = { ...(p.secretBuffs ?? {}) }
    for (const key of Object.keys(add) as (keyof typeof add)[]) {
      secretBuffs[key] = (secretBuffs[key] ?? 0) + (add[key] ?? 0)
    }
    const recomputed = recomputeMaxHp({ ...p, secretBuffs })
    return { ...recomputed, currentHp: recomputed.maxHp }
  })
```

Também ajustar o comentário do JSDoc logo acima (linha 159), que diz "Os incrementos somam ao `dayBuffs` existente (itens da manhã)" — trocar por:

```ts
 * Os incrementos somam ao `secretBuffs` existente (buffs de habilidade, separados dos itens x_*),
```

- [ ] **Step 6: `healRoster` limpa `secretBuffs` junto com `dayBuffs`**

Em `src/game/phaseFlow.ts`, na função `healRoster` (linha 276), trocar:

```ts
    const cleared = recomputeMaxHp({ ...p, dayBuffs: undefined })
```

por:

```ts
    const cleared = recomputeMaxHp({ ...p, dayBuffs: undefined, secretBuffs: undefined })
```

Atualizar o comentário do JSDoc da função (linhas 270-272) para mencionar também o `secretBuffs`: trocar "limpa os buffs diários de itens x_* (dayBuffs)" por "limpa os buffs diários de itens x_* (`dayBuffs`) e de habilidades (`secretBuffs`)".

- [ ] **Step 7: Rodar testes e build**

Run: `npx vitest run src/game/setup.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS (suíte completa — confirma que `effectiveAttr`/HP/missões/batalha seguem corretos com o campo novo).

Run: `npm run build`
Expected: sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/engine/testkit.ts src/engine/attributes.ts src/game/setup.ts src/game/phaseFlow.ts src/game/setup.test.ts
git commit -m "fix(spore): buff em campo proprio (secretBuffs); some da barra de itens"
```

---

## Task 3: Seletor de Habilidade Secreta — redesign "Direção A" (cartas claras)

**Files:**
- Modify: `src/components/screens/SummaryScreen.tsx:271-324` (`SecretChoiceButtons` — estrutura header/corpo/CTA)
- Modify: `src/components/screens/SummaryScreen.module.css:431-480` (estilo do cartão + variante inline)

**Interfaces:**
- Consumes: `SECRET_KINDS` (nome/efeito), `dispatch({ type: 'CHOOSE_SECRET', slot, level })`, `styles` do CSS module.
- Produces: mesmo comportamento de clique (`CHOOSE_SECRET`), só apresentação nova. Sem mudança de assinatura/estado.

> **Nota de verificação:** o projeto não tem infraestrutura de teste de componente React (sem `@testing-library`). Esta tarefa é puramente apresentacional; a verificação é `npm run build` + conferência visual no app rodando. Não adicionar infra de teste de DOM (YAGNI).

- [ ] **Step 1: Reescrever o CSS do botão (cartão claro) e a variante inline**

Em `src/components/screens/SummaryScreen.module.css`, substituir o bloco `.secretChoiceBtn` (linhas 431-453) por:

```css
.secretChoiceBtn {
  display: flex;
  flex-direction: column;
  width: 215px;
  max-width: 240px;
  padding: 0;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  border: 3px solid var(--c-panel-border);
  border-radius: 9px;
  background: var(--c-panel);
  color: var(--c-ink);
  box-shadow: 0 4px 0 #14331f;
  transition: transform 0.12s, box-shadow 0.12s;
}
.secretChoiceBtn:hover {
  transform: translateY(-3px);
  box-shadow: 0 7px 0 #14331f;
}
.secretChoiceHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  background: var(--c-hud-accent);
  border-bottom: 3px solid var(--c-panel-border);
}
.secretChoiceName {
  font-family: var(--font-pixel);
  font-size: 9px;
  line-height: 1.4;
  color: var(--c-ink);
}
.secretChoiceBadge {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: #7a5a00;
  white-space: nowrap;
}
.secretChoiceEffect {
  flex: 1;
  font-family: var(--font-text);
  font-size: 18px;
  line-height: 1.15;
  color: var(--c-ink);
  padding: 10px 11px 12px;
}
.secretChoiceCta {
  font-family: var(--font-pixel);
  font-size: 8px;
  letter-spacing: 0.5px;
  color: #fff;
  background: var(--c-panel-border);
  text-align: center;
  padding: 8px;
}
.secretChoiceBtn:hover .secretChoiceCta {
  background: #247a40;
}
```

Em seguida, substituir o bloco da variante inline + keyframes (linhas 474-480) por um pulso verde compatível com o cartão claro:

```css
.secretChoiceInline .secretChoiceBtn {
  animation: secretChoiceGlow 1.3s ease-in-out infinite;
}
@keyframes secretChoiceGlow {
  0%, 100% { box-shadow: 0 4px 0 #14331f; }
  50% { box-shadow: 0 4px 0 #14331f, 0 0 14px 3px rgba(47, 143, 80, 0.7); }
}
```

(As regras antigas `.secretChoiceBtn b` e `.secretChoiceBtn span` deixam de existir — a estrutura nova usa classes próprias.)

- [ ] **Step 2: Reestruturar o JSX em `SecretChoiceButtons`**

Em `src/components/screens/SummaryScreen.tsx`, substituir a função `SecretChoiceButtons` inteira (linhas 271-324) por uma versão com um sub-componente `SecretOption` (header/corpo/CTA), DRY entre os dois ramos:

```tsx
function SecretOption({
  name,
  badge,
  effect,
  onClick,
}: {
  name: string
  badge: string
  effect: string
  onClick: () => void
}) {
  return (
    <button type="button" className={styles.secretChoiceBtn} onClick={onClick}>
      <span className={styles.secretChoiceHead}>
        <b className={styles.secretChoiceName}>{name}</b>
        <span className={styles.secretChoiceBadge}>{badge}</span>
      </span>
      <span className={styles.secretChoiceEffect}>{effect}</span>
      <span className={styles.secretChoiceCta}>▶ ESCOLHER</span>
    </button>
  )
}

function SecretChoiceButtons({
  pair,
  picks,
  dispatch,
}: {
  pair: readonly string[]
  picks: readonly { slot: 0 | 1; level: 1 | 2 }[]
  dispatch: Dispatch<GameAction>
}) {
  if (picks.length === 0) {
    return (
      <>
        {([0, 1] as const).map((slot) => {
          const kind = SECRET_KINDS[pair[slot]! as SecretId]
          return (
            <SecretOption
              key={slot}
              name={kind.name}
              badge="Nv.1"
              effect={kind.effectL1}
              onClick={() => dispatch({ type: 'CHOOSE_SECRET', slot, level: 1 })}
            />
          )
        })}
      </>
    )
  }
  const cur = picks[0]!
  const curKind = SECRET_KINDS[pair[cur.slot]! as SecretId]
  const other = (cur.slot === 0 ? 1 : 0) as 0 | 1
  const otherKind = SECRET_KINDS[pair[other]! as SecretId]
  return (
    <>
      <SecretOption
        name={`Aprofundar — ${curKind.name}+`}
        badge="Nv.2"
        effect={curKind.effectL2}
        onClick={() => dispatch({ type: 'CHOOSE_SECRET', slot: cur.slot, level: 2 })}
      />
      <SecretOption
        name={`Ampliar — ${otherKind.name}`}
        badge="Nv.1"
        effect={otherKind.effectL1}
        onClick={() => dispatch({ type: 'CHOOSE_SECRET', slot: other, level: 1 })}
      />
    </>
  )
}
```

- [ ] **Step 3: Build e suíte de testes**

Run: `npm run build`
Expected: sem erros de tipo.

Run: `npx vitest run`
Expected: PASS (nenhum teste deveria depender da estrutura interna do botão; se algum quebrar, ajustar).

- [ ] **Step 4: Conferência visual (opcional, recomendada)**

Abrir a tela de Resumo onde o Destaque do dia oferece a Habilidade Secreta (caso standalone: Destaque ≠ MVP; caso inline: Destaque = MVP), e conferir os dois estados: primeira escolha (2 cartões Nv.1) e evolução (1 cartão "Aprofundar" Nv.2 + 1 "Ampliar" Nv.1). Texto deve estar escuro/legível e o rodapé "▶ ESCOLHER" visível.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/SummaryScreen.tsx src/components/screens/SummaryScreen.module.css
git commit -m "feat(ui): seletor de Habilidade Secreta em cartas claras legiveis"
```

---

## Task 4: Mart central de Celadon — andável por cima, Surf como atalho

**Files:**
- Modify: `src/data/cities.ts:436-575` (nós, arestas, `surfNodes` e comentários de Celadon)
- Test: `src/data/celadon.test.ts` (imports + teste do ponto de Surf + teste de alcance do mart `n`)

**Interfaces:**
- Consumes: `getCity(3)` → Celadon; `graphWithoutSurf`, `shortestPath`, `surfTravelDistance`, `pathDistance`, `pathUsesSurf` (de `src/engine/pathfinding.ts`); `nodesForCategory`.
- Produces: `n` (mart central) deixa de ser `surfNode` e ganha rota a pé (`nu`); novo `surfNode` de água `nw` faz o atalho de Surf por baixo. `mart: ['j','n']` inalterado.

> **Nota de calibração:** as coordenadas de `nu`/`nw` abaixo são um default coerente com a arte `public/maps/kanto/4.png`. Os testes verificam o COMPORTAMENTO (n alcançável a pé; caminho ótimo usa a água; surf anda menos), não as coordenadas exatas. Se a comparação de distância não passar, ajustar `nu` para mais alto (rota a pé mais longa) e/ou `nw` mais perto de `n`; o DEV picker do CityMap ajuda no posicionamento fino.

- [ ] **Step 1: Atualizar os testes de Celadon (falha esperada)**

Em `src/data/celadon.test.ts`, trocar a linha 2 (imports) por:

```ts
import {
  graphWithoutSurf,
  pathDistance,
  pathUsesSurf,
  shortestPath,
  surfTravelDistance,
} from '../engine/pathfinding.ts'
```

Substituir o teste do ponto de Surf (linhas 36-38) por:

```ts
  it('marca o ponto de água do atalho (nw) como metadado do mapa', () => {
    expect(graph.surfNodes).toEqual(['nw'])
  })
```

Substituir o teste `it('o mart de terra (j) ... a água (n) NÃO', ...)` (linhas 63-69) por:

```ts
  it('o mart de terra (j) é alcançável sem Surf', () => {
    const dry = graphWithoutSurf(graph)
    expect(shortestPath(dry, siteNodes.gym, 'j').length, 'aa→j sem surf').toBeGreaterThan(0)
  })

  it('o mart central (n) é alcançável a pé; o Surf é o atalho (cruza a água, anda menos)', () => {
    const dry = graphWithoutSurf(graph)
    const dryPath = shortestPath(dry, siteNodes.gym, 'n')
    expect(dryPath.length, 'aa→n a pé (sem surf)').toBeGreaterThan(0) // dá pra chegar a pé
    const surfPath = shortestPath(graph, siteNodes.gym, 'n')
    expect(pathUsesSurf(graph, surfPath), 'o caminho ótimo até n cruza a água').toBe(true)
    expect(
      surfTravelDistance(graph, surfPath),
      'com surf (água por baixo) anda menos que a pé por cima',
    ).toBeLessThan(pathDistance(dry, dryPath))
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/data/celadon.test.ts`
Expected: FAIL (`surfNodes` ainda é `['n']`; `n` ainda inalcançável a pé).

- [ ] **Step 3: Editar os dados de Celadon em `cities.ts`**

3a. Em `CELADON_NODES`, trocar a linha do `n` (linha 456) e acrescentar `nu` e `nw` logo abaixo dela:

```ts
  n: { x: 0.446, y: 0.498 }, // mart central — a pé por 'nu' (cima); atalho de Surf por 'nw' (baixo)
  nu: { x: 0.446, y: 0.4 }, // chegada a pé do mart central (acima do prédio)
  nw: { x: 0.446, y: 0.56 }, // (surf) travessia de água — atalho por baixo até 'n'
```

3b. Em `CELADON_EDGES`, remover a aresta `['n', 'x'],` (linha 515) e acrescentar, no lugar, as quatro arestas novas:

```ts
  ['c', 'nu'],
  ['nu', 'n'],
  ['x', 'nw'],
  ['nw', 'n'],
```

3c. Em `CELADON_GRAPH`, trocar `surfNodes` (linha 564):

```ts
  surfNodes: ['nw'],
```

3d. Atualizar o comentário-cabeçalho de Celadon (linhas 440-441) que descreve o `n` como água. Trocar o trecho:

```ts
// Novidades: DOIS marts (a missão de mart surge em 'j' OU 'n'); 'n' é ponto de água (Surf), então
// o mart de 'n' fica atrás de água. DUAS Missões Especiais (SPEC1='j', SPEC2='r'). Sem mão única.
```

por:

```ts
// Novidades: DOIS marts (a missão de mart surge em 'j' OU 'n'). O mart central 'n' é alcançável a
// pé pelo ponto de cima 'nu'; o Surf é um atalho que cruza a água 'nw' por baixo (anda menos).
// DUAS Missões Especiais (SPEC1='j', SPEC2='r'). Sem mão única.
```

- [ ] **Step 4: Rodar os testes de Celadon, a suíte e o build**

Run: `npx vitest run src/data/celadon.test.ts`
Expected: PASS (incluindo "todo sítio é alcançável do ginásio E tem volta", agora com `n` alcançável pelos dois lados).

Run: `npx vitest run`
Expected: PASS (suíte completa — confirma que nenhuma outra cidade/teste dependia de `n` ser surf).

Run: `npm run build`
Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/data/cities.ts src/data/celadon.test.ts
git commit -m "feat(celadon): mart central andavel pelo ponto de cima; Surf vira atalho"
```

---

## Self-Review

**1. Cobertura do spec:**
- §1 special5 4+2 mega → Task 1 (const + lógica + teste, special2 preservado). ✓
- §2 seletor Direção A → Task 3 (CSS + JSX, header/corpo/CTA, variante inline). ✓
- §3 Spore campo próprio → Task 2 (tipo, `effectiveAttr`, `applySpore`, `healRoster`, testkit, testes; ItemsBar intacto). ✓
- §4 mart de Celadon → Task 4 (nós `nu`/`nw`, arestas, `surfNodes`, testes de alcance). ✓

**2. Placeholders:** nenhum "TBD/TODO"; todo passo traz código real. As coordenadas de `nu`/`nw` são valores concretos com nota de calibração apoiada em teste de comportamento. ✓

**3. Consistência de tipos/nomes:** `secretBuffs?: Partial<Attrs>` usado igual em `types`, `testkit`, `attributes`, `setup`, `phaseFlow`. Classes CSS novas (`secretChoiceHead/Name/Badge/Effect/Cta`) batem entre o CSS (Step 1) e o JSX (Step 2) da Task 3. `nw`/`nu` consistentes entre nós, arestas e testes da Task 4. ✓
