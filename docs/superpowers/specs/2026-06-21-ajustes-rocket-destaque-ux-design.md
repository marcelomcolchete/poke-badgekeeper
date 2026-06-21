# Ajustes de UX — Rocket, Destaque, Forecast e regras

**Data:** 2026-06-21
**Branch:** `feat/ajustes-rocket-destaque-ux` (criado a partir de `main`)
**Tipo:** conjunto de 8 ajustes independentes (UX + regras)

## Contexto

Lote de pequenos ajustes pedidos pelo jogador, todos sobre código já presente em
`main`. São independentes entre si; cada um pode ser implementado e testado isolado.
A fonte de verdade do estado é a engine pura (`src/engine`); efeitos (som, RNG, React)
ficam em `src/game` e `src/components`/`src/audio`.

## Itens

### 1. Som quando a Rocket aparece

- **Hoje:** a Rocket vira `🚨` no mapa sem som. Só toca `timeWarning` ao chegar ao nó
  final (`atFarNode`).
- **Mudança:** em `src/audio/useGameSounds.ts`, tocar `playSound('missionNew')` uma
  única vez quando um `state.theft` entra na fase visível/perseguível (`fleeing`) — o
  mesmo som de "missão nova", atendendo "igual aparece missão".
- **Como:** novo `useRef` `theftAnnounced` (booleano). Toca quando `state.theft` existe
  e a fase é `fleeing` e ainda não anunciou. Rearma (`= false`) quando não há roubo em
  curso (`!state.theft` ou fase `resolved`), espelhando o padrão de `theftWarned`.
- **Arquivos:** `src/audio/useGameSounds.ts`.

### 2. Painel da Rocket com layout de missão + R vermelho

- **Hoje:** `src/components/day/TheftChasePanel.tsx` usa o layout simples `.capture`
  (hint + picker).
- **Mudança:** reestruturar para o mesmo grid de `MissionDispatch.tsx` (`.dispatch` =
  coluna esquerda + picker). Na coluna esquerda, no lugar do `HexRadar`, um **emblema
  "R" vermelho grande e brilhante**; abaixo: linha de recompensa
  (`⚔️ Recompensa: 3× XP`, igual ao `TheftBattlePanel`), stats
  (`Perseguidores x/THEFT_CHASERS_MAX`) e a lista de chips dos selecionados (espelhando
  o `.selectedTeam`/`.chipList` do MissionDispatch). À direita, o mesmo picker (roster
  ordenado, desabilitando quem não está `idle`). Botão `Perseguir ▶ (n)`.
- **Como:** reusar as classes existentes de `Panels.module.css` (`.dispatch`,
  `.radarSide`, `.picker`, `.stats`, `.selectedTeam`, `.chipList`, `.chip*`,
  `.confirm`). Adicionar uma classe nova `.rocketEmblem` (R vermelho centralizado com
  glow, no espaço antes ocupado pelo radar).
- **Arquivos:** `src/components/day/TheftChasePanel.tsx`,
  `src/components/day/Panels.module.css`.

### 3. Derrotas da Rocket contam pro Destaque do Dia

- **Hoje:** só `s.today.defenseKills` (defesa de ginásio) alimenta o MVP
  (`computeMvp`) e as miniaturas do quadro do Destaque.
- **Mudança:** em `src/game/theftFlow.ts` (`completeTheftBattle`, ramo vitória),
  espelhar exatamente o `assignDefense` de `defenseFlow.ts`: para cada duelo vencido,
  `s.today.defenseKills.push({ defeaterId, speciesId, enemyBattle, enemyMedal,
  enemyTypes })` a partir de `theft.enemies[theirs]` (com `theirs` avançando só quando
  `duel.youWon`). Isso alimenta automaticamente `computeMvp` **e** as miniaturas
  (ambos leem `defenseKills`).
- **Decisão (confirmada):** somar junto com os "derrotados na defesa" — não criar linha
  separada.
- **Rótulo:** no `SummaryScreen.tsx`, trocar "derrotado(s) na defesa" por "derrotado(s)"
  (genérico, já que agora inclui Rocket).
- **Arquivos:** `src/game/theftFlow.ts`, `src/components/screens/SummaryScreen.tsx`,
  `src/game/theftFlow.test.ts` (novo teste cobrindo o registro dos kills).

### 4. Habilidades secretas: mostrar os dois nomes (não "???")

- **Hoje:** `src/components/day/MemberDetail.tsx:125` mostra `'? ? ?'` quando a
  habilidade está bloqueada.
- **Mudança:** sempre exibir `kind.name`. Manter todo o tratamento visual de
  "bloqueada" (medalha cadeado `🔒`, sem cor de medalha, texto "Desbloqueie sendo o
  Destaque do Dia.") para deixar claro que ainda não está ativa — só o nome deixa de
  ser escondido.
- **Arquivos:** `src/components/day/MemberDetail.tsx`.

### 5. Ginásio indefendido → −1 estrela (0 = game over)

- **Hoje:** `src/game/defenseFlow.ts:33` `loseRunByUndefendedGym` zera as estrelas de
  batalha e vai a `GAMEOVER` imediatamente.
- **Mudança:** deduzir **1 estrela cheia** (`STARS_STEP * 2`, com piso 0 via
  `applyDomainStars`) na hora. Se o resultado for 0 → `GAMEOVER` (motivo `gym`); senão,
  o jogo continua (NÃO congela o relógio).
- **Sem dupla punição (confirmado):** a defesa não-defendida não pode também derrubar o
  ratio de batalha no `settleDay` (`phaseFlow.ts`), senão penalizaria duas vezes. A
  defesa expirada por timer já é marcada `'lost'` por `expireDefense`; o cálculo diário
  usa `defensesWon/defensesTotal`. Para o net ser exatamente −1, a defesa que disparou
  a penalidade imediata deve ser **excluída do `defensesTotal`** considerado no ratio
  (ou marcada com uma flag que `settleDay` ignora). Implementação deve verificar o
  caminho exato em `phaseFlow.ts`/`defenseFlow.ts` e ajustar para evitar o duplo
  desconto.
- **Estrelas:** valor cumulativo `s.approval.battleStars`; `settleDay` lê o valor atual
  como base (`battleBefore`) e aplica o delta do dia por cima — então o −1 do meio do
  dia persiste corretamente como nova base.
- **Arquivos:** `src/game/defenseFlow.ts`, possivelmente `src/game/phaseFlow.ts` e/ou
  `src/engine/state.ts` (flag na defesa), `src/game/defenseFlow.test.ts`.

### 6. Exploração dá 100 XP ao explorador (ao concluir)

- **Hoje:** capturar ou recusar um encontro não dá XP ao explorador.
- **Mudança:** nova constante `EXPLORATION_XP = 100` em `src/engine/balance.ts`. Ao
  **concluir a exploração** — tanto capturando quanto recusando — dar 100 XP ao
  `searcher` do encontro (via `applyXpGains`, podendo subir nível/evoluir).
- **Decisão (confirmada):** explorador, ao concluir (mesmo recusando).
- **Como:** aplicar nos handlers das ações de captura e de recusa do encontro
  (`src/game/actions.ts` + fluxo de captura). O explorador é o `searcherId` do
  `Encounter`. Usar `applyXpGains` com o `searcherId`.
- **Arquivos:** `src/engine/balance.ts`, fluxo de captura em `src/game` (handler de
  captura e de recusa), teste correspondente.

### 7. Forecast da Rocket: rampa azul→vermelho + padrão visual

- **Hoje:** `src/engine/theft.ts:44` `theftChanceLabel` interpola verde→vermelho; a UI
  (`DayForecastPanel.tsx`) renderiza a **palavra colorida inline** (ex.: "Muito
  Improvável"), longa e fora do padrão dos vizinhos (Missões/Batalhas mostram número
  grande). O % é intencionalmente **mascarado** ("preservar o mistério").
- **Mudança (2 partes):**
  - **Cor:** trocar a interpolação por rampa de 5 paradas **azul → verde → amarelo →
    laranja → vermelho** ao longo de `percent` 0–100. Implementar lerp multi-stop em
    `theft.ts` (mantendo a assinatura `theftChanceLabel`).
  - **Padrão/legibilidade:** manter a palavra (NÃO revelar o %), mas renderizá-la como
    um **chip/pílula colorida centralizada** ocupando o mesmo "slot do número" dos
    vizinhos, com tinta de bom contraste sobre a cor da rampa. Mantém "Chance de Rocket"
    como label.
- **Arquivos:** `src/engine/theft.ts`, `src/components/screens/DayForecastPanel.tsx`,
  `src/components/screens/DayForecastPanel.module.css`, `src/engine/theft.test.ts` (se
  houver teste da rampa).

### 8. Escolha de habilidade dentro do quadro Destaque + brilhando

- **Hoje:** `src/components/screens/SummaryScreen.tsx:118` renderiza o bloco de escolha
  (`.secretChoice`) como seção separada e destacada **por baixo** das duas colunas —
  destoa visualmente.
- **Mudança:** mover a UI de escolha para **dentro do `MvpSquare`**, abaixo dos feitos,
  quando o Destaque tem escolha pendente (`mvp` existe e
  `mvp.id === choice.pokemonId`): título "Escolha sua Habilidade Secreta" + os dois
  botões **brilhando** (animação de glow pulsante via `@keyframes`/`box-shadow`) para
  chamar o clique. Remover a seção solta. Manter o `Textbox` inferior que pede a escolha
  para continuar e bloqueia o avanço do dia.
- **Fallback:** se por algum motivo `choice.pokemonId !== mvp.id`, manter o
  comportamento atual (seção abaixo) para não esconder a escolha.
- **Arquivos:** `src/components/screens/SummaryScreen.tsx`,
  `src/components/screens/SummaryScreen.module.css`.

## Verificação

- Tipos/build: `npm run build` (tsc -b solution), não `tsc --noEmit`.
- Testes da engine/fluxo: `npm test` (Vitest) para os itens 3, 5, 6 e 7.
- UI (itens 2, 4, 8): preferir verificação leve por DOM/teste; screenshots só se pedido.

## Fora de escopo

- Não mexer no balanceamento de outras missões além do XP de exploração (item 6).
- Não criar pop-up automático de aparição da Rocket (decisão: reestilizar o painel de
  perseguição existente, item 2).
- Nenhum refactor não relacionado.
