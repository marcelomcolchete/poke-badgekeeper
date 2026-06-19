# Rank por Percepção (captura/exploração) — Design

**Data:** 2026-06-19
**Status:** aprovado para planejamento

## Objetivo

Substituir a forma como a **Percepção do explorador** influencia o rank (F–S)
dos Pokémon encontrados na **captura/exploração**, de modo que:

- **Cada ponto de Percepção** já altera a distribuição (curva contínua).
- A Percepção define **diretamente a distribuição do rank final** (não mais um
  "centro" estreito derivado da média de eixos).
- No teto de Percepção (60): **≈ 50% S / 40% A / 10% B**.
- O rank **S só é possível acima de 50** de Percepção (em perc ≤ 50, `P(S) = 0`;
  destrava em 51+, abrindo pequeno).
- S "bem mais difícil": só alcança 50% no teto absoluto de Percepção.

Mantém-se o que o modelo atual tem de bom: o rank do Pokémon continua sendo,
literalmente, a **média dos 6 eixos** (`pokemonRank` não muda), e cada Pokémon
preserva **variedade entre eixos**.

## Fora de escopo (YAGNI)

- **Iniciais** (sem explorador): continuam com IV uniforme — inalterados.
- **Fossil Stone** (sem explorador): continua com `rankCenter` aleatório —
  inalterado.
- **Shiny**: continua sempre rank S (todos os eixos na banda S), **vencendo**
  esta fórmula, exatamente como hoje.
- Itens/habilidades que modifiquem a curva de rank.

## Por que NÃO manter o modelo de média-de-eixos puro

O modelo atual sorteia cada eixo em torno de um centro contínuo
(`perceptionRankCenter = percepcao/10`) e o rank emerge da **média dos 6 eixos**.
A média de 6 sorteios concentra fortemente o resultado (lei dos grandes números):
no melhor caso, com centro em S, a distribuição fica ~90% S / ~10% A e **nunca**
espalha até B. Logo, metas como 50/40/10 são **inatingíveis** apenas re-tunando o
centro.

A solução adotada (meio-termo aprovado): a Percepção define a distribuição do
**rank-alvo** diretamente; em seguida os 6 eixos são gerados de forma que a
**média caia exatamente no rank-alvo**, preservando a definição
`pokemonRank = round(média dos eixos)` e a variedade entre eixos.

## A fórmula

Duas peças, com constantes tunáveis em `src/engine/balance.ts`.

### (a) Alcance contínuo

```
c = clamp(percepcao / PERCEPTION_PER_RANK, 0, 6)      // PERCEPTION_PER_RANK = 10
```

`c` é o "rank que a Percepção enxerga", contínuo — cada ponto de Percepção
desloca `c`, então **1 de percepção já muda a distribuição**.

### (b) Peso por rank (janela `W(gap)`)

Para cada índice de rank `k` (0 = F … 6 = S), define-se `gap = c − k` (distância
do rank ao alcance) e um peso por interpolação linear sobre uma tabela de knots:

```
knots (gap → peso):  (-1 → 0)   (0 → 1.0)   (1 → 0.8)   (2 → 0.2)   (3 → 0)
W(gap) = interpolação linear entre os knots vizinhos; 0 fora do intervalo [-1, 3]
```

Forma: pico no rank que está **no** alcance (`gap = 0`), cauda curta **abaixo**
(até 3 ranks) e uma pequena **ultrapassagem acima** (`gap` em [−1, 0]) — é a
ultrapassagem que destrava o rank imediatamente acima do alcance.

A probabilidade de cada rank é `W(c − k)` **normalizada** sobre os 7 ranks.

O **array de knots é o knob de tuning**: alterá-lo reshapeia toda a curva sem
mexer no resto.

### Por que bate as metas

- **perc 60** → `c = 6`: pesos S/A/B = 1.0 / 0.8 / 0.2 → normalizado =
  **50% / 40% / 10%** (exato); ranks abaixo de B ficam fora da janela (peso 0).
- **Portão do S**: `P(S) > 0` exige `W(c − 6) > 0` → `c − 6 > −1` → `c > 5` →
  `percepcao > 50`. Em **perc 50 exato → S = 0%**; **perc 51 → S ≈ 5%**
  (decisão aprovada: "50+" estrito, 50 ainda não permite S).

## Distribuição resultante (referência)

Probabilidade do rank final por Percepção (normalizada; valores arredondados):

| Percepção | F | E | D | C | B | A | S |
|---|---|---|---|---|---|---|---|
| 0 | 100% | — | — | — | — | — | — |
| 1 | 91% | 9% | — | — | — | — | — |
| 5 | 64% | 36% | — | — | — | — | — |
| 10 | 44% | 56% | — | — | — | — | — |
| 15 | 26% | 47% | 26% | — | — | — | — |
| 20 | 10% | 40% | 50% | — | — | — | — |
| 25 | 5% | 25% | 45% | 25% | — | — | — |
| 30 | — | 10% | 40% | 50% | — | — | — |
| 40 | — | — | 10% | 40% | 50% | — | — |
| 45 | — | — | 5% | 25% | 45% | 25% | — |
| 49 | — | — | 1% | 13% | 41% | 45% | — |
| 50 | — | — | — | 10% | 40% | 50% | **0%** |
| 51 | — | — | — | 9% | 37% | 49% | **5%** |
| 55 | — | — | — | 5% | 25% | 45% | 25% |
| 60 | — | — | — | — | **10%** | **40%** | **50%** |

Propriedades: monotônica (centro de massa sobe com a Percepção); S inviável até
perc 50; S só atinge 50% no teto absoluto.

## Geração dos IVs (pipeline)

No caminho de **captura**:

1. **Sorteia o rank-alvo `R`** da distribuição `rankDistribution(percepcao)`
   (1 saque de RNG).
2. Inicia os 6 eixos em `R` e aplica **trocas `+1 / −1` entre pares de eixos**
   (soma preservada, valores em [0, 6]) → **soma = 6·R**, logo **média = R
   exata** e `round(média) = R` sempre, com variedade entre eixos.
3. Converte cada índice de rank de eixo para um IV concreto na banda (reuso de
   `ivForRankIndex`).

Como a soma é preservada, a distribuição **final** do `pokemonRank` é **idêntica
à curva** (sem desvio de arredondamento).

Casos de borda:
- `R = S (6)`: nenhuma troca para cima é possível (teto) → todos os eixos ficam S.
  Aceitável; o **shiny** continua se distinguindo por **sprite + flag**, não por
  ser o único all-S.
- `R = F (0)`: simetricamente, todos os eixos ficam F.

Exemplos reais (perc 60):

```
alvo A → eixos [A, B, S, S, B, A] → média = A
alvo B → eixos [S, B, C, A, E, A] → média = B
alvo S → eixos [S, S, S, S, S, S] → média = S
```

Exemplos (perc 30):

```
alvo D → eixos [C, C, C, E, D, F] → média = D
alvo C → eixos [D, A, B, C, C, E] → média = C
```

## Mudanças de código (alto nível)

- **`src/engine/balance.ts`**: novas constantes `PERCEPTION_PER_RANK` e os knots
  da curva (`RANK_GAP_KNOTS` ou equivalente).
- **`src/engine/ranking.ts`**: novas funções puras
  `rankDistribution(percepcao): number[]` (pesos normalizados por rank) e
  `sampleTargetRank(rng, percepcao): number`. Aposenta o uso de
  `perceptionRankCenter` / `ivForRankCenter` no caminho de captura
  (manter exportadas só se ainda usadas em outro lugar; senão remover).
- **`src/engine/leveling.ts`** (`randomIvs`): o caminho de captura passa a
  sortear `R` e preencher os eixos pinando a média (passo "Geração dos IVs"
  acima). Os caminhos **shiny** (banda S) e **uniforme** (iniciais, sem
  `rankCenter`) ficam intactos. Manter os IVs como **último** consumo de RNG da
  criação (preserva determinismo das sequências de alocação/gênero/natureza).
- **`src/game/captureFlow.ts`**: `readySearch` passa a **Percepção efetiva do
  explorador** ao encontro (em vez do `rankCenter` derivado).
- **`src/engine/state.ts`** (`CaptureEncounter`) e
  **`src/components/common/preview.ts`** / **`EncounterChoice.tsx`**: o campo
  `rankCenter` do encontro vira a **Percepção do explorador** (renomear para algo
  como `searcherPerception`), repassado ao preview/criação para garantir
  **preview == captura**. Saves antigos: ausência do campo cai no comportamento
  uniforme (sem viés), sem migração obrigatória.
- **Fossil Stone** (`marketFlow.ts`) e **iniciais** (`setup.ts`): **inalterados**.

## Determinismo

Mesma garantia atual: o card de preview recria exatamente o Pokémon obtido a
partir do mesmo seed. O rank-alvo `R` e os eixos são derivados do `rng`
(semeado pelo `candidateSeed`), então preview e captura concordam. A Percepção
do explorador entra como parâmetro determinístico do encontro.

## Testes

**Curva (`rankDistribution`):**
- perc 60 ≈ 50% S / 40% A / 10% B.
- `P(S) = 0` em perc ≤ 50; `P(S) > 0` em perc ≥ 51.
- Monotonicidade: centro de massa não-decrescente com a Percepção; perc 1 já
  desloca em relação a perc 0.
- Soma das probabilidades = 1 para qualquer Percepção ≥ 0.

**Pipeline (geração de IVs):**
- `pokemonRank` final == rank-alvo sorteado (média pinada) em N seeds.
- Variedade entre eixos em ranks médios (nem todos os eixos iguais quando
  `0 < R < 6`).
- Distribuição final sobre N seeds bate com `rankDistribution` dentro de
  tolerância.

**Regressões:**
- Shiny continua sempre rank S (todos os eixos na banda S).
- Iniciais (IV uniforme) e Fossil Stone (rankCenter aleatório) inalterados.
- Determinismo: mesmo seed ⇒ mesmo rank/IVs; preview == captura.
