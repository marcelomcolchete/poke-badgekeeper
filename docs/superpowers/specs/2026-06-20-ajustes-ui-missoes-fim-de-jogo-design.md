# Ajustes de UI: manhã, captura, defesa e fim de jogo

Data: 2026-06-20

Lote de 7 ajustes independentes de UI/UX. São localizados; o item B5 (breakdown
de habilidades/itens na missão) concentra ~60% do esforço por exigir uma função
nova na engine + testes. Os demais são pequenos e isolados.

---

## A1 — Caixa dos contadores do dia

**Arquivos:** `src/components/screens/DayForecastPanel.tsx`,
`src/components/screens/DayForecastPanel.module.css`

Hoje as 3 contagens (Missões / Batalhas / Missões Rocket) são linhas `<dl>`
soltas, sem fundo, difíceis de ler. Trocar por **uma caixa** com o mesmo estilo
dos painéis neutros do jogo (fundo `--c-panel`, borda `--c-panel-border`, radius
`--radius-pixel`, padding) — não o gradiente azul do bloco "Previsão do Tempo",
que permanece como está.

Dentro da caixa, 3 mini-células lado a lado, cada uma com **símbolo em cima,
valor no meio, rótulo curto embaixo**:

| Símbolo | Valor | Rótulo |
|---|---|---|
| 🎯 | `missions` | Missões |
| ⚔️ (espadas cruzadas) | `defenses` | Batalhas |
| "R" vermelho | `???` | Rocket |

- O "R" do Rocket usa o mesmo estilo do marcador no mapa: fonte `--font-pixel`,
  bold, cor `--c-dialog-cursor` (#e02020). Não é emoji.
- O valor Rocket continua mascarado (`???`, com o `title` atual) para preservar
  o mistério.

Sem mudança de lógica — só apresentação.

---

## A2 — Aura de velocidade → "streaks de movimento"

**Arquivos:** `src/components/day/CityMap.module.css` (`.speedAura`,
`.speedAura::before`, `.speedy .traveler`), animações relacionadas.

O efeito atual (borrão ciano radial + box-shadow arredondado + risquinhos) é
considerado feio. Redesenhar como **linhas de velocidade horizontais** (estilo
"speed lines") que fluem para trás do grupo e somem, sem o brilho redondo.

- ~3 traços finos horizontais atrás do grupo, animados deslizando para trás com
  fade. Tom ciano/branco sutil, finos — sem o halo/blob.
- Remover o `radial-gradient` arredondado e o `box-shadow` da aura.
- Suavizar o "bob" dos sprites (`.speedy .traveler`) para não competir com os
  traços.
- **Nenhum emoji.** Fly e Surf (emblemas 🪽/🌊) ficam inalterados.

Só CSS; nenhuma mudança em `teamIsSpeedy` ou na engine.

---

## B1 — Atributos coloridos + total no encontro de captura

**Arquivos:** `src/components/day/EncounterChoice.tsx` (bloco `.encStats`),
`src/components/day/Panels.module.css`

No encontro de captura os 6 atributos aparecem todos em preto, enquanto a
natureza (vantagem/desvantagem) já aparece em verde/vermelho acima. Alinhar:

- O atributo **aumentado pela natureza** (`nature.boosted`) → valor verde.
- O atributo **reduzido pela natureza** (`nature.reduced`) → valor vermelho.
- Demais atributos → preto (como hoje).
- Reaproveitar as cores já usadas em `encNatureUp` / `encNatureDown`.
- Pokémon de natureza neutra (sem boosted/reduced) → tudo preto.

Adicionar uma célula **TOTAL** ao lado dos 6 atributos: soma de
`effectiveAttr(mon, k)` sobre `ATTR_KEYS`, destacada (negrito, rótulo "TOT"),
para ajudar a decidir qual capturar.

---

## B2 — Ginásio indefeso = 0 estrelas de batalha + fim

**Arquivos:** `src/game/defenseFlow.ts` (`loseRunByUndefendedGym`),
teste novo em `src/game/defenseFlow.test.ts` (ou onde couber).

`loseRunByUndefendedGym` já encerra a run (phase `GAMEOVER`, motivo `gym`,
`clock.speed = 0`). Falta refletir 0 estrelas de batalha na tela final.

- Adicionar `s.approval.battleStars = 0` dentro de `loseRunByUndefendedGym`.
- Teste: defesa ativa que expira sem luta → `approval.battleStars === 0`,
  `run.phase === 'GAMEOVER'`, `run.gameOverReason === 'gym'`.

---

## B3 — Sprite do líder do ginásio por cidade

**Arquivos:** `src/data/endgameVerdict.ts` (`GYM_LEADERS`, `FALLBACK_LEADER`),
teste em `src/data/endgameVerdict.test.ts` (ou onde couber).

Hoje só Pewter (Brock) e Cerulean (Misty) estão mapeados; as demais caem no
fallback que mostra Brock — por isso Vermilion aparece com Brock. Completar o
mapa com os 8 líderes de Kanto (todos os sprites gen3 já existem):

| Índice | Cidade | Líder | Sprite |
|---|---|---|---|
| 0 | Pewter | Brock | `/sprites/trainers/gen3/brock-gen3.png` (já) |
| 1 | Cerulean | Misty | `/sprites/trainers/gen3/misty-gen3.png` (já) |
| 2 | Vermilion | Lt. Surge | `/sprites/trainers/gen3/ltsurge-gen3.png` |
| 3 | Celadon | Erika | `/sprites/trainers/gen3/erika-gen3.png` |
| 4 | Fuchsia | Koga | `/sprites/trainers/gen3/koga-gen3.png` |
| 5 | Saffron | Sabrina | `/sprites/trainers/gen3/sabrina-gen3.png` |
| 6 | Cinnabar | Blaine | `/sprites/trainers/gen3/blaine-gen3.png` |
| 7 | Viridian | Giovanni | `/sprites/trainers/gen3/giovanni-gen3.png` |

- Com as 8 cidades cobertas, o fallback genérico deixa de mostrar Brock para
  outras cidades. Manter um `FALLBACK_LEADER` defensivo (nome genérico) só para
  índices fora da faixa, mas ele não deve mais ser alcançado pelas cidades reais.
- Teste: `gymLeaderFor(2).name === 'Lt. Surge'` (e demais), garantindo que
  nenhuma cidade 0–7 retorna o fallback.

---

## B4 — Fontes amarelas da tela final

**Arquivos:** `src/components/screens/EndGameScreen.module.css`

O amarelo `--c-hud-accent` (#ffcb05) sobre os painéis claros (`--c-panel`
#f4fbf2) tem contraste ruim. Trocar **apenas nos elementos sobre painel claro**:

- `.panelTitle` (títulos "Top 3 do time", "Pokémons enfrentados", "Capturados",
  "Time final", "Itens comprados") → `--c-ink` (verde-tinta escuro #1c4a2c).
- `.tilePct` (% de Missões / Defesas) → `--c-panel-border` (verde #2f8f50),
  mantendo distinção do valor escuro ao lado.

**Não mexer** em `.colHeading` (faixa-herói, sobre o scrim escuro — lá o amarelo
contrasta bem), nem nas cores literais do herói (`.title`, `.win`, `.loss`,
`.avgNum`).

---

## B5 — Breakdown por habilidade/item na missão *(o maior)*

**Arquivos:** `src/engine/secretEffects.ts` (função pura nova +
testes em `src/engine/secretEffects.test.ts`),
`src/components/day/MissionDispatch.tsx`,
`src/components/day/Panels.module.css`

Hoje, no despacho de missão, aparece uma única linha genérica "✦ Habilidade
Secreta ativa nesta missão" sempre que qualquer efeito de atributo está ativo, e
nada para itens que mudam atributo/velocidade. Trocar por uma **lista detalhada
por efeito**, mostrando quanto cada habilidade/item ganha ou perde e por quê.

### Função pura (engine)

Criar algo como `missionEffectBreakdown(ctx: MissionSecretCtx): EffectEntry[]`,
que percorre o **time selecionado** e devolve uma entrada por efeito ATIVO.
Forma sugerida da entrada:

```ts
interface EffectEntry {
  id: string                 // ex.: 'hustle', 'eviolite'
  source: 'ability' | 'item'
  label: string              // ex.: 'Hustle', 'Eviolite'
  kind: 'attr' | 'speed'     // o que é afetado
  direction: 'gain' | 'loss'
  value: string              // já formatado, ex.: '+50%', '−10%', '×2'
  reason: string             // motivo curto, ex.: 'aliado Água na missão'
}
```

Efeitos a cobrir (derivar valores das constantes em `engine/balance.ts` e
`engine/itemEffects.ts` — não hardcodar números soltos):

**Atributos (multiplicador de missão):**
- Eviolite — `+X%` se o Pokémon ainda evolui
- Lagging Tail — `+50%` atributos (par com a perda de velocidade abaixo)
- Rivalry — `+10%` por aliado do mesmo gênero (mostrar o total agregado)
- Rock Head — `+` em Escolta / `−` em Ensino
- Analytic — `+` em Ensino / `−` em Patrulha
- Torrent — `+50%` se houver outro aliado Água
- Battle Armor — `+` na próxima missão após batalhar (flag `battleArmorPending`)
- Hustle — `−10%` atributos (perda; o + de batalha não vale aqui)
- Electirizer — `+X%` por raio recebido (`electirizerBonus`)
- Clear Body — anula debuffs de atributo do time (nota informativa)

**Velocidade de viagem:**
- Weak Armor — `+20%` por ponto de HP faltante (mostrar o efetivo)
- Fly — bônus ao voar
- Quick Feet — `+100%` quando sozinho
- Lagging Tail — viagem mais lenta (perda)

Regras:
- Uma entrada por efeito presente no time; agregar quando fizer sentido (ex.:
  Rivalry soma os aliados; Weak Armor soma o HP faltante dos portadores).
- Não listar efeito inativo (ex.: Torrent sem aliado Água, Battle Armor sem a
  flag, Eviolite em Pokémon já final).
- Função pura e testável isoladamente (TDD).

### UI (MissionDispatch)

No `radarSide`, substituir a linha `boosted` genérica pela lista:
- Ganhos (`direction: 'gain'`) em verde; perdas (`direction: 'loss'`) em
  vermelho — estilos próprios e distintos.
- Cada linha: nome do efeito + valor formatado + motivo curto.
- Atualiza ao (de)selecionar Pokémon, como o radar/probabilidade já fazem.
- Manter as linhas dedicadas existentes de Fly/Surf/Sniper/bloqueio por água
  (ou integrá-las à lista de forma consistente — decidir na implementação,
  preferindo não duplicar informação).

---

## Fora de escopo

- B1 só vale no encontro de captura (`EncounterChoice`), não nas cartas de
  missão (`PokemonCard`).
- Nenhuma mudança de balanceamento; B5 apenas *exibe* o que a engine já calcula.

## Verificação

- `npm run build` (tsc -b) + `npm test` verdes.
- Testes novos: B2 (battleStars zerado), B3 (líderes por cidade), B5 (breakdown).
- Conferência visual leve do DOM onde fizer sentido (A1, A2, B1, B4) — sem
  depender de screenshot, conforme preferência registrada.
