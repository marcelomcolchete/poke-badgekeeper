# Rebalanceamento de XP, corações e XP de ginásio

**Data:** 2026-06-24
**Branch:** `rebalance/exp-coracoes-ginasio` (a partir da `main`)

## Objetivo

Rebalancear a progressão de XP do jogo em três frentes e melhorar a clareza visual
da afinidade (corações):

1. Trocar o multiplicador de XP por coração por uma curva que penaliza baixa
   afinidade e premia muito a afinidade máxima.
2. Adotar uma nova tabela de XP por nível (custo total quase dobra).
3. Deixar o multiplicador de XP **visível** (rótulo fixo, não só no hover) e dar
   destaque dourado pulsante aos corações no máximo (5).
4. XP de duelo de ginásio passa a ser o poder de Batalha cheio do inimigo derrotado.

A missão especial da cidade **já** funciona como pedido (pool dividido entre
participantes) e **não muda**.

## Escopo

Mudança isolada de balanceamento + um ajuste de UI dos corações. Sem novas features,
sem migração de save (os campos `hearts` e `xp` já existem; só mudam as fórmulas que
os interpretam).

---

## 1. Multiplicador de XP por coração — curva contínua `2^(c − 3)`

`heartXpMultiplier` em [`src/engine/hearts.ts`](../../../src/engine/hearts.ts) passa a
retornar:

```
heartXpMultiplier(c) = 2 ** (heartsOf(c) − 3)
```

A função `heartsOf` continua capando em `[0, 5]` em passos de 0,5, então a curva é
contínua e bate exato nos 6 pontos pedidos:

| ♥ | 0 | 0,5 | 1 | 1,5 | 2 | 2,5 | 3 | 3,5 | 4 | 4,5 | 5 |
|---|---|-----|---|-----|---|-----|---|-----|---|-----|---|
| × | ⅛ | ≈0,18 | ¼ | ≈0,35 | ½ | ≈0,71 | 1 | ≈1,41 | 2 | ≈2,83 | **4** |

Os meios-corações são interpolados geometricamente pela própria curva (decisão do
usuário: "curva contínua").

**Constantes removidas** de [`src/engine/constants.ts`](../../../src/engine/constants.ts):
`HEARTS_XP_PER` e `HEARTS_XP_MAX_BONUS` (não há mais "bônus aditivo com teto"). Os
comentários de `hearts.ts` e do bloco de corações em `constants.ts` são atualizados
para descrever a nova curva.

A fórmula final aplicada em `addXp` ([`src/engine/leveling.ts`](../../../src/engine/leveling.ts))
permanece `floor(amount × rarityXpRate × heartXpMultiplier)` — só muda o valor do
multiplicador.

### Consequência conhecida (aceita)

Pokémon novos nascem com 2 corações = **×½ de XP**. Junto com a tabela maior (§2), o
começo de jogo fica mais lento até o Pokémon ganhar afinidade. É o efeito desejado.

---

## 2. Nova tabela de XP por nível (lookup)

`xpToNext` em [`src/engine/leveling.ts`](../../../src/engine/leveling.ts) deixa de ser
`XP_TO_NEXT_BASE × level` e passa a ler de um array em
[`src/engine/balance.ts`](../../../src/engine/balance.ts):

```ts
/** XP §4.1: XP para subir do nível L → L+1 (índice = L − 1). Nível 10 = topo (Infinity). */
export const XP_TO_NEXT = [100, 300, 500, 700, 900, 1100, 1300, 1500, 2000] as const
```

```ts
export function xpToNext(level: number): number {
  if (level >= LEVEL_MAX) return Infinity
  return XP_TO_NEXT[level - 1] ?? Infinity
}
```

`XP_TO_NEXT_BASE` é **removida** (substituída pelo array).

| Subir de | XP | Acumulada |
|----------|---:|----------:|
| 1 → 2  | 100  | 100 |
| 2 → 3  | 300  | 400 |
| 3 → 4  | 500  | 900 |
| 4 → 5  | 700  | 1.600 |
| 5 → 6  | 900  | 2.500 |
| 6 → 7  | 1.100 | 3.600 |
| 7 → 8  | 1.300 | 4.900 |
| 8 → 9  | 1.500 | 6.400 |
| 9 → 10 | 2.000 | 8.400 |

Total cru para um comum chegar ao nível 10: **8.400** (era 4.500).

---

## 3. Display do multiplicador + corações dourados pulsantes (5)

Em [`src/components/common/Hearts.tsx`](../../../src/components/common/Hearts.tsx):

- **Rótulo fixo do multiplicador** ao lado dos corações (sempre visível, não só no
  tooltip), derivado de `heartXpMultiplier(hearts)`. Formato compacto: frações limpas
  para os corações inteiros (`×⅛`, `×¼`, `×½`, `×1`, `×2`, `×4`) e 2 casas decimais
  para os meios (`×0,71`, `×1,41`, `×2,83`, `×0,18`, `×0,35`). Decisão do usuário:
  "texto fixo ao lado dos corações".
- Como `<Hearts>` é usado em 5 telas (detalhe do membro, resumo do time, fim de jogo,
  relatório do dia, manhã/previsão), o rótulo aparece em todas. O `title`/`aria-label`
  também passam a refletir o multiplicador (`×N de XP`) em vez de `+X% de XP`.

Em [`src/components/common/common.module.css`](../../../src/components/common/common.module.css):

- Nova classe `.heartsGold` com cor dourada e `@keyframes` de pulso (opacidade/escala
  suave). Aplicada condicionalmente quando `heartsOf(value) === HEARTS_MAX` (5),
  substituindo/sobrepondo a cor rosa padrão da camada `.heartsOn`.
- Respeitar `prefers-reduced-motion` (sem pulso quando o usuário pede menos movimento;
  mantém só a cor dourada).

---

## 4. XP de duelo de ginásio = poder de Batalha cheio do derrotado

`gymWinXp` em [`src/engine/gymDefense.ts`](../../../src/engine/gymDefense.ts) passa a:

```ts
export function gymWinXp(enemyBattle: number): number {
  return Math.round(enemyBattle)
}
```

Sem `× 0,5`, sem teto. Inimigo com 90 de Batalha → **90 XP**. As constantes
`GYM_XP_PER_BATTLE_POWER` e `GYM_XP_CAP_PER_WIN` são **removidas** de `balance.ts` e
dos imports de `gymDefense.ts`. O comentário da função é atualizado.

---

## 5. Missão especial da cidade — confirmado, sem mudança

Verificado em [`src/game/missionFlow.ts`](../../../src/game/missionFlow.ts) (`resolveMissionNow`):
a especial usa `MISSION_XP_POOL × SPECIAL_XP_MULTIPLIER` (240 × 5 = **1200**) e divide
com `floor(pool / nº de participantes)`, idêntico a uma missão normal porém pagando
mais. Já é o comportamento pedido. **Nenhuma alteração.** Pools mantidos em 240/1200
(decisão do usuário).

---

## Testes

Atualizar/adicionar:

- [`src/engine/leveling.test.ts`](../../../src/engine/leveling.test.ts): a curva de XP
  agora é não-linear; os testes que assumem `xpToNext` linear ou usam `XP_TO_NEXT_BASE`
  passam a usar os valores da tabela. `xpToNext` segue crescente e `Infinity` no topo.
- Teste do multiplicador de corações (em `hearts`/leveling): novos valores
  `2^(c−3)` nos 6 pontos inteiros e checagem de um meio-coração.
- [`src/engine/gymDefense.test.ts`](../../../src/engine/gymDefense.test.ts) (se houver
  caso de `gymWinXp`): XP cheio, sem teto (ex.: 90 → 90; valor alto não satura).
- Teste da missão especial (`specialMissionFlow.test.ts`) continua válido sem mudança
  de expectativa.

**Verificação:** `npm run build` (tsc -b) + `vitest`. Sem screenshots/preview, conforme
preferência registrada (verificação econômica).
