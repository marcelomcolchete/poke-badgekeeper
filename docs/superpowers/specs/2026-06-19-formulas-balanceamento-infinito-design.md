# Fórmulas de balanceamento por dia (preparação para o modo infinito)

**Data:** 2026-06-19
**Status:** aprovado (brainstorming)

## Problema

Hoje quatro grandezas que escalam com o dia da run dependem de **arrays fixos de 10
posições** (uma entrada por dia, dias 1–10), com `clamp(dia, 1, 10)` para dias fora da
faixa. Isso trava a curva no valor do dia 10 e não serve para um futuro **modo infinito**
(mais de 10 dias). Queremos substituir os arrays por **fórmulas em função de `dia`**, sem
ainda construir o modo infinito — só preparando o terreno. As grandezas:

1. Quantos treinadores invadem por dia.
2. Quantos Pokémon cada treinador traz.
3. Chance/raridade das medalhas dos invasores.
4. Dano recebido por golpe (defesa e falha de missão).

Decisão de game feel já tomada: a curva de medalhas é a variante **"quente, abertura em
10%"** (medalhas começam a aparecer cedo e o ouro fica comum mais rápido do que o número
literal de "50% no dia 10" sugeria).

## Princípio comum

Todas as fórmulas dependem **apenas de `dia`**. Sai o `clamp(dia, 1, TOTAL_DAYS)` de
`enemySquadSizeForDay`, `defensesForDay` e `damageForDay`; fica só um **piso no dia 1**
(dias ≤ 1 tratados como dia 1) e os tetos próprios de cada fórmula. Assim valem para
qualquer dia. `TOTAL_DAYS` continua sendo 10 para a run atual (a UI e o calendário não
mudam aqui) — a mudança é só nas fórmulas de escala.

Regra "sem magic numbers" mantida: os *knobs* (inclinações, dias de abertura/saturação,
piso de 10%, teto 6) viram constantes nomeadas em `balance.ts`/`constants.ts`.

---

## 1. Treinadores por dia

```
treinadores(dia) = Math.ceil(dia / 2)
```

| dia | 1 | 2 | 5 | 7 | 9 | 10 | 15 | 20 | 25 | 30 |
|-----|---|---|---|---|---|----|----|----|----|----|
| treinadores | 1 | 1 | 3 | 4 | 5 | 5 | 8 | 10 | 13 | 15 |

Bate os âncoras (dia 10 = 5, dia 20 = 10, dia 30 = 15). **Diferença vs. hoje** (array
`[1,1,2,2,2,3,3,4,4,5]`): nos dias 5, 7 e 9 vem +1 treinador (2/3/4 → 3/4/5). Aceito de
propósito (jogo está fácil demais hoje).

Substitui `DEFENSES_PER_DAY` (lido por `defensesForDay` em `timeline.ts`).

---

## 2. Pokémon por treinador (faixa min–max sorteada por treinador)

Cada treinador sorteia o **próprio** tamanho de esquadrão na faixa `[min(dia), max(dia)]`,
usando o RNG que o evento já possui — dois treinadores no mesmo dia podem trazer
quantidades diferentes. Dois ramos que convergem em 6:

```
min(dia) = clamp(round(1 + (dia - 1) * 5/14), 1, 6)        // teto 6 ~dia 15 (sobe devagar)
max(dia) = clamp(round(1 + 5 * sqrt((dia - 1) / 9)), 1, 6) // teto 6 ~dia 9  (côncava, abre rápido)
tamanho  = rng.int(min(dia), max(dia))
```

| dia | 1 | 2 | 5 | 6 | 10 | 15+ |
|-----|---|---|---|---|----|-----|
| min | 1 | 1 | 2 | 3 | 4 | 6 |
| max | 1 | 3 | 4 | 5 | 6 | 6 |
| exemplo pedido (min/max) | 1/1 | 1/3 | 2/5 | 3/5 | 4/6 | 6/6 |

`max` usa raiz (côncava) porque os âncoras pedem que a variância abra rápido (dia 2 já vai
a 3) e desacelere depois — uma reta não pega o salto do dia 2. Folga de ±1 só em `max` no
dia 5 (dá 4, pedido era 5). Do dia 15 em diante é sempre 6/6, então o modo infinito fica
constante nesse eixo.

Substitui `DEFENSE_SQUAD_BY_DAY`. A função `enemySquadSizeForDay(dia): number` vira:

- `squadSizeRange(dia): { min: number; max: number }` — pura, para UI/testes.
- `rollSquadSize(rng, dia): number` — sorteia na faixa, usada na engine.

---

## 3. Medalhas dos invasores ("piso de 10% na abertura + rampa até 100%")

Cada tier abre num dia **já com 10%** e sobe linearmente até 100% no seu dia de saturação.
Chance **acumulada** ("pelo menos esse tier"):

```
acum(dia; abre, satura) =
    dia < abre ? 0
               : clamp(0.10 + 0.90 * (dia - abre) / (satura - abre), 0, 1)

bronze: abre dia 2,  satura dia 10
prata:  abre dia 3,  satura dia 20
ouro:   abre dia 4,  satura dia 30
```

Distribuição por Pokémon (a partir das acumuladas):

```
P(ouro)   = acum_ouro
P(prata)  = acum_prata  - acum_ouro
P(bronze) = acum_bronze - acum_prata
P(nada)   = 1 - acum_bronze
```

Ordenação `acum_bronze ≥ acum_prata ≥ acum_ouro` é garantida em todo dia (bronze abre
antes e satura antes; as diferenças `bronze−prata` e `prata−ouro` são sempre ≥ 0).

| dia | P(nada) | P(bronze) | P(prata) | P(ouro) | ≥1 ouro no esquadrão* |
|-----|---------|-----------|----------|---------|------------------------|
| 1   | 100%    | 0         | 0        | 0       | 0%    |
| 2   | 90%     | 10%       | 0        | 0       | 0%    |
| 3   | 79%     | 11%       | 10%      | 0       | 0%    |
| 4   | 67%     | 17%       | 5%       | 10%     | ~26%  |
| 10  | 0%      | 53%       | 16%      | 31%     | ~84%  |
| 20  | 0%      | 0         | 35%      | 65%     | ~99,8% |
| 30+ | 0%      | 0         | 0        | 100%    | 100%  |

*\*usando o esquadrão típico daquele dia.*

No dia 10 todo invasor já tem ≥ bronze e ~84% dos esquadrões têm ≥ 1 ouro (acima dos 50%
citados — variante "quente" escolhida). Aberturas batem os 10% (bronze d2, prata d3, ouro
d4). Do dia 30 em diante todo invasor sai ouro (modo infinito).

O bônus de Batalha por medalha **não muda**: Bronze +10 / Prata +20 / Ouro +50
(`DEFENSE_MEDAL_BATTLE`).

Substitui a fórmula atual de `medalChancesForDay` (que usava `MEDAL_UNLOCK_DAY` +
`MEDAL_FULL_DAY` único de 30). Novos parâmetros:

- abertura por tier: bronze 2, prata 3, ouro 4.
- saturação por tier: bronze 10, prata 20, ouro 30.
- piso de abertura: 0,10.

---

## 4. Dano recebido por golpe

```
dano(dia) = Math.ceil(dia / 2)   // +1 a cada 2 dias, sem teto
```

| dia | 1–2 | 3–4 | 5–6 | 7–8 | 9–10 | 11–12 | … |
|-----|-----|-----|-----|-----|------|-------|---|
| dano | 1 | 2 | 3 | 4 | 5 | 6 | … |

Exato ao pedido. **Diferença vs. hoje** (array `[…,3,3,3,4]`, máx. 4 no dia 10): passa a 5
no dia 10. Leve aumento de letalidade no fim, coerente com "está fácil".

Substitui `HP_LOSS_BY_DAY` (lido por `damageForDay` em `constants.ts`).

---

## Pontos de integração

- **`constants.ts`:** remover `DEFENSE_SQUAD_BY_DAY` e `HP_LOSS_BY_DAY`; `damageForDay`
  vira fórmula (`Math.ceil(max(1, dia)/2)`). Adicionar constantes nomeadas (teto 6, etc.).
- **`balance.ts`:** remover `DEFENSES_PER_DAY`; substituir `MEDAL_FULL_DAY`/`MEDAL_UNLOCK_DAY`
  pelos parâmetros novos de medalha (abertura, saturação, piso). Adicionar inclinações do
  esquadrão (min `5/14`, max via raiz com base 9) e da contagem de treinadores se preciso.
  Avaliar remover `ENEMY_BASE_BATTLE`/`ENEMY_BATTLE_PER_DAY` se continuarem sem uso (ver
  fora de escopo).
- **`gymDefense.ts`:** `enemySquadSizeForDay` → `squadSizeRange` + `rollSquadSize`;
  `medalChancesForDay` com a nova fórmula. `generateDefenseEnemies` continua recebendo
  `size` já sorteado (sem mudança de assinatura).
- **`timeline.ts`:** `defensesForDay` usa `Math.ceil(max(1, dia)/2)`.
- **`setup.ts` (`buildDefense`) e `missionFlow.ts` (`setupRocketBattle`):** trocar
  `const size = enemySquadSizeForDay(...)` por `rollSquadSize(rng, dia)` (ambos já têm RNG
  semeado à mão).
- **Testes:** reescrever `gymDefense.test.ts`, `timeline.test.ts` e o bloco de
  `damageForDay` em `balls.test.ts` para validar **âncoras + monotonicidade + dia 1
  zerado + comportamento no infinito** (ex.: dia 45 = todo invasor ouro; esquadrão 6/6;
  treinadores e dano crescendo sem teto), no lugar das tabelas fixas.

## Save / migração

Nenhuma mudança de schema: as fórmulas recalculam tudo a cada `setupDay`. Não exige bump
de `SAVE_VERSION` (nada novo é persistido; valores derivados do dia).

## Fora de escopo

- O poder bruto de cada inimigo continua `Batalha-base ± IV` (sem escala por dia). As
  medalhas passam a ser a fonte de escala de poder ao longo dos dias. Ligar o
  escalonamento de Batalha por dia (`ENEMY_BASE_BATTLE`/`ENEMY_BATTLE_PER_DAY`, hoje sem
  uso) é um ajuste separado, se desejado depois.
- O modo infinito em si (calendário > 10 dias, fim de jogo, etc.) não é construído aqui —
  só as fórmulas que ele vai consumir.

## Critérios de aceitação

- `treinadores(10)=5`, `(20)=10`, `(30)=15`; cresce monotonicamente sem teto.
- `squadSizeRange`: dia 1 = {1,1}; dia 15+ = {6,6}; `min ≤ max` sempre; teto 6.
- Medalhas: dia 1 = 0 em tudo; bronze abre dia 2 (~10%), prata dia 3, ouro dia 4; ordenação
  bronze ≥ prata ≥ ouro em todo dia; dia 30+ = ouro 100%.
- `dano(dia)=ceil(dia/2)`; +1 a cada 2 dias; sem teto.
- Suíte de testes verde (`npm run build` + testes), sem arrays fixos remanescentes.
