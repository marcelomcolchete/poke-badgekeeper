# Medalhas por nível, descrições self-contained e remoção do botão Potion

Data: 2026-06-25

Três ajustes independentes na exibição das Habilidades Secretas (mais uma limpeza de UI sem
relação com habilidades). Nenhuma regra de jogo muda — só exibição/textos e a remoção de um botão.

## 1. Medalhas por nível, uma por habilidade

Hoje a medalha da Habilidade Secreta é escolhida por *contagem* (TeamSidebar, EndGame) ou por
*slot* (MemberDetail, SummaryScreen): 1 habilidade/slot 0 → 🥉 bronze, 2 habilidades/slot 1 →
🥈 prata. Isso confunde — a medalha não diz nada sobre o quão forte a habilidade está.

**Regra nova:** a medalha reflete o **nível** da habilidade, e há **uma medalha por habilidade
ativa**:

- Nível 1 → 🥈 **prata**
- Nível 2 → 🥇 **ouro**

Bronze (🥉) deixa de aparecer em habilidades secretas. (O sistema de medalhas de invasores
Rocket — `MEDAL_TIER_RANK`, BattleView/EndGame "Pokémons enfrentados" — é independente e
**não muda**: lá bronze/prata/ouro continuam sendo tiers de combate.)

Consequências da contagem de medalhas:

- 2 habilidades nível 1 (slots 0 e 1) → **duas pratas**.
- 1 habilidade ativa + a outra aprofundada → **prata + ouro**.
- 1 habilidade aprofundada para o nível 2 → **uma ouro**.

Sem número na medalha — apenas os emojis lado a lado.

### Onde muda

- **`src/components/common/visual.ts`**: novo mapa por nível para habilidades secretas:
  - `SECRET_LEVEL_MEDAL: Record<1 | 2, string>` = `{ 1: '🥈', 2: '🥇' }`
  - `SECRET_LEVEL_LABEL: Record<1 | 2, string>` = `{ 1: 'Prata', 2: 'Ouro' }`
  - `SECRET_LEVEL_COLOR` / `SECRET_LEVEL_INK` por nível (reaproveitando os tons de prata/ouro
    já existentes em `SECRET_MEDAL_COLOR`/`SECRET_MEDAL_INK`).
  - `SECRET_MEDAL` (tier 1/2/3 = bronze/prata/ouro) **permanece**, pois é usado pelos invasores.
- **`TeamSidebar`** ([src/components/day/TeamSidebar.tsx]): a medalha única (por contagem) vira
  **uma medalha por habilidade ativa** sobre o sprite, cada uma pelo seu nível.
- **`MemberDetail`** ([src/components/day/MemberDetail.tsx]): cada linha de habilidade usa
  medalha/cor/ink pelo **nível** quando desbloqueada. Linha bloqueada fica em tom neutro
  (cinza) com 🔒, sem tier de medalha.
- **`SummaryScreen`** (banner de desbloqueio): a medalha do banner usa `unlock.level` (prata p/
  nível 1, ouro p/ nível 2) no lugar de `unlock.slot + 1`.
- **`EndGameScreen`** ("Top 3 do time"): hoje mostra 1 medalha pela contagem (`medalIndex`).
  Passa a mostrar **uma medalha por habilidade, pelo nível**.

### Dado no relatório final

`src/engine/finalReport.ts` hoje grava `medalIndex: number` (= quantidade de picks). Troca por
`secretMedals: (1 | 2)[]` — os **níveis** dos picks, em ordem de slot. `EndGameScreen` renderiza
uma medalha por entrada. Atualizar `src/engine/finalReport.test.ts` (a asserção
`medalIndex === 2` vira `secretMedals` igual a `[1, 1]`).

## 2. Descrições self-contained e fiéis (effectL1/effectL2)

Vários `effectL2` em `src/data/secretAbilities.ts` são deltas curtos (`'+20% / +20%.'`,
`'+50%.'`, `'+80% / −80%.'`, `'30%. Não acumula…'`), que só fazem sentido lendo o nível 1
ao lado. O usuário quer que **toda** descrição se leia completa e sozinha, em todos os lugares
onde aparece (banner de desbloqueio, escolha do dia, MemberDetail).

**Regra:** cada `effectL1` e `effectL2` descreve o comportamento **completo** daquele nível,
com os números/efeitos reais. Para habilidades cujo nível 2 **soma** algo ao nível 1
(ex.: Moxie, Static, Vital Spirit, Clear Body, Dry Skin), o texto do nível 2 descreve o
comportamento total (o que já estava + o acréscimo).

**Fonte da verdade:** cada efeito será **cruzado com a engine** (`src/engine/secretEffects.ts`
e arquivos correlatos — `gymDefense.ts`, `economy.ts`, `lifetime.ts`, `missions.ts`, fluxos de
clima/tempestade) para garantir que o texto bate com o número/comportamento real. Não é só
expandir os curtos: descrições imprecisas também são corrigidas.

Exemplos de reescrita:

| Habilidade | effectL2 hoje | effectL2 novo |
|---|---|---|
| Rivalidade | `+20% / +20%.` | `+20% nos atributos por aliado do mesmo gênero na missão; +20% de Batalha contra oponente do mesmo gênero.` |
| Hustle | `+30% / −30%.` | `+30% de Batalha / −30% de atributos em missões.` |
| Battle Armor | `+50%.` | `Após uma batalha (ginásio/Rocket), +50% em todos os atributos na próxima missão.` |
| Rock Head | `+80% / −80%.` | `+80% em escolta / −80% em ensino.` |
| Pressure | `30%. Não acumula…` | `No início do combate, reduz a Batalha dos inimigos em 30%. Não acumula: vale só o de maior nível.` |

Mesmo tratamento para Analytic, Torrent, Water Absorb, Cloud Nine, Overcoat, Volt Absorb,
Overgrow, Swarm, Sand Rush, Weak Armor e qualquer outro com texto curto/parcial. Descrições já
completas (Static, Moxie, Clear Body, Dry Skin, Vital Spirit…) só mudam se a engine divergir.

Nenhum teste assere nessas strings (`secretAbilities.test.ts` só testa linhas/níveis), então a
reescrita não quebra testes.

## 3. Remover o botão Potion do MemberDetail

O botão **Potion** ([src/components/day/MemberDetail.tsx]) é inútil e sai. **Revive permanece.**

- Remover o bloco `hurt && <button … itemId: 'potion' …>`.
- Limpar órfãos: variável `potions` / `count(state, 'potion')` e, como Potion era o único uso
  de `hurt`, o wrapper `(hurt || fainted)` vira só `fainted`.

## Verificação

- `npm run build` (tsc -b — o tsconfig raiz é solution-only) limpo.
- Suíte de testes verde (`finalReport.test.ts` atualizado).
- Conferência leve no DOM/preview só se necessário.
