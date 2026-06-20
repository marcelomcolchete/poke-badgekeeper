# Escala 0→100, resto evolutivo e ajuste de special5 — Design

**Data:** 2026-06-20

## Contexto

A geração da exigência das missões e a cobertura do time compartilham um único teto
`TEAM_ATTR_MAX = 70`. A dificuldade por dia escala via um termo do dia (`10 × dia / 3`)
somado às faixas-base de principal/secundário; o eixo "resto" é fixo em `rand(5..20)` e
não evolui. Com o teto em 70, o principal satura cedo (dia 15) e o gráfico tem pouco
espaço de progressão no fim do jogo.

Este design altera quatro pontos do balanceamento de missões.

## Mudanças

### 1. Escala inteira 0 → 100

`TEAM_ATTR_MAX: 70 → 100` em `src/engine/constants.ts`.

Esse valor é o teto compartilhado de três coisas, e todas sobem juntas:

- **Exigência da missão** — cada eixo do hexágono pode chegar a 100.
- **Cobertura do time** — a soma do time por eixo (`teamAxisSum`, `teamSecretSum`)
  passa a contar até 100. Subir só a exigência tornaria missões de dia alto impossíveis,
  por isso a cobertura sobe junto.
- **Gráfico HexRadar** — `axisMax` nas telas de missão (já lê `TEAM_ATTR_MAX`).

Efeito: principal só satura por volta do **dia 24** e secundário no **dia 27** (antes
dia 15), dando muito mais espaço de progressão.

### 2. Resto evolui com o dia

Hoje fixo em `rand(5..20)`. Nova fórmula:

```
resto = round(rand(5..20) + 0,8 × (dia − 6))   → clamp [0, 100]
```

- Inclinação suave de **0,8/dia** ancorada no dia 6.
- Começa **abaixo** de 5–20 nos primeiros dias, cruza exatamente **5–20 no dia 6**, e
  sobe devagar depois (vs. ~3,3/dia do principal).

Implementação: `restValue(rng, day)` passa a receber o `day` e aplicar o termo. Sugere-se
constantes em `balance.ts` no mesmo padrão das outras (ex.: `MISSION_REST_DAY_SLOPE = 0.8`,
`MISSION_REST_DAY_PIVOT = 6`).

### 3. Piso de tempo

`MISSION_TIME_FLOOR: 0.3 → 0.1` em `src/engine/balance.ts`.

A redução de tempo de Agilidade (deslocamento) e Inteligência (execução) continua a
−1%/ponto, mas o teto de redução vai de **−70% para −90%** — atingido com 90 pontos no
eixo (91–100 ficam travados no piso 0,1).

Interação com Run Away (mantida, sem tratamento especial): o fator de Run Away (×0,5)
é aplicado **depois** do piso, então Run Away + 90 de Agilidade chega a `0,1 × 0,5 = 0,05`
(−95% de deslocamento). É comportamento aceito.

### 4. special5

De **5 principais + 1 forçado ao máximo** para **3 principais + 2 secundários + 1 resto**,
**nenhum eixo forçado** ao teto.

- `balance.ts`: `SPECIAL5_PRINCIPALS: 5 → 3`; adicionar `SPECIAL5_SECONDARIES = 2`.
- `missions.ts` `generateRequirement`: o ramo `special5` passa a sortear 3 principais +
  2 secundários (como o special2 generaliza) e **remove** a linha que força um eixo ao
  máximo (`out[...] = TEAM_ATTR_MAX`).

## Inalterado

- Termo do dia (`10 × dia / 3`) e faixas-base de principal (`20..30`) e secundário
  (`10..20`).
- Fórmula de chance de sucesso (interseção/área), dano em falha, Vital Spirit, tempos
  de viagem/execução (exceto o piso).
- Quantidade de missões por dia, categorias, special2, caso "mega" (principal+secundário
  no mesmo eixo, agora capado em 100).

## Tabela de referência (faixa mín–máx por eixo)

| Dia | Principal | Secundário | Resto |
|----:|:---------:|:----------:|:-----:|
| 1  | 23 – 33  | 13 – 23  | 1 – 16  |
| 2  | 27 – 37  | 17 – 27  | 2 – 17  |
| 3  | 30 – 40  | 20 – 30  | 3 – 18  |
| 4  | 33 – 43  | 23 – 33  | 3 – 18  |
| 5  | 37 – 47  | 27 – 37  | 4 – 19  |
| 6  | 40 – 50  | 30 – 40  | 5 – 20  |
| 7  | 43 – 53  | 33 – 43  | 6 – 21  |
| 8  | 47 – 57  | 37 – 47  | 7 – 22  |
| 9  | 50 – 60  | 40 – 50  | 7 – 22  |
| 10 | 53 – 63  | 43 – 53  | 8 – 23  |
| 11 | 57 – 67  | 47 – 57  | 9 – 24  |
| 12 | 60 – 70  | 50 – 60  | 10 – 25 |
| 13 | 63 – 73  | 53 – 63  | 11 – 26 |
| 14 | 67 – 77  | 57 – 67  | 11 – 26 |
| 15 | 70 – 80  | 60 – 70  | 12 – 27 |
| 16 | 73 – 83  | 63 – 73  | 13 – 28 |
| 17 | 77 – 87  | 67 – 77  | 14 – 29 |
| 18 | 80 – 90  | 70 – 80  | 15 – 30 |
| 19 | 83 – 93  | 73 – 83  | 15 – 30 |
| 20 | 87 – 97  | 77 – 87  | 16 – 31 |
| 21 | 90 – 100 | 80 – 90  | 17 – 32 |
| 22 | 93 – 100 | 83 – 93  | 18 – 33 |
| 23 | 97 – 100 | 87 – 97  | 19 – 34 |
| 24 | 100 – 100| 90 – 100 | 19 – 34 |
| 25 | 100 – 100| 93 – 100 | 20 – 35 |
| 26 | 100 – 100| 97 – 100 | 21 – 36 |
| 27 | 100 – 100| 100 – 100| 22 – 37 |
| 28 | 100 – 100| 100 – 100| 23 – 38 |
| 29 | 100 – 100| 100 – 100| 23 – 38 |
| 30 | 100 – 100| 100 – 100| 24 – 39 |

## Testes a ajustar

- `src/engine/missions.test.ts` — espera teto 70 (`toBeLessThanOrEqual(TEAM_ATTR_MAX)`
  continua válido com 100), o caso "mega" saturando em 70 no dia 8 (recalcular), e o
  invariante do special5 (um eixo no máximo) — esse último **deixa de valer** e deve
  ser substituído por: special5 tem 3 principais + 2 secundários, nenhum forçado.
- `src/engine/attributes.test.ts` — cap do time em 70 (`teamAxisSum` → `TEAM_ATTR_MAX`)
  passa a ser 100; ajustar os valores esperados.

## Critérios de sucesso

- `npm run build` (tsc -b) sem erros.
- Suite de testes verde após os ajustes.
- Exigências e cobertura respeitando o teto 100; resto seguindo a tabela; special5 com
  3+2+1 sem forçado; piso de tempo permitindo −90%.
