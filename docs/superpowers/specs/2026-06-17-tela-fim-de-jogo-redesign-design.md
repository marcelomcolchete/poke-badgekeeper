# Redesign da Tela de Fim de Jogo

**Data:** 2026-06-17
**Componente:** `src/components/screens/EndGameScreen.tsx` (+ `.module.css`) e `src/engine/finalReport.ts`

## 1. Contexto e objetivo

A tela de fim de jogo (vitória no dia 10 com média ≥ 3, ou derrota por GAMEOVER / dia 10 com
média < 3) hoje empilha verticalmente: cabeçalho, grade de stats, colunas (MVP + lateral),
capturados e time final, terminando num único botão que muda conforme o caso. Em telas menores
isso gera bastante scroll vertical, e o tema arcade claro (tinta escura sobre painel claro) não
combina com as novas ilustrações de fundo.

Objetivos do redesign:

1. **Sempre** existir o botão **Voltar** (→ tela inicial), em qualquer desfecho.
2. **Agrupar** o conteúdo em seções (Estatísticas, Time, Itens) para reduzir a altura e
   **evitar ao máximo o scroll vertical** em telas menores.
3. Visual mais agradável, com **tipografia contrastando melhor com o fundo** e que **passe a
   sensação de vitória ou derrota**.

## 2. Decisões tomadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Imagem de fundo | Ilustração `Nstar` **apenas na faixa-herói** (topo), escolhida pela **média de estrelas**. Resto da tela mantém o tema arcade claro. |
| Layout | **Cabeçalho-herói fixo + abas** (Estatísticas / Time / Itens). Só uma seção renderiza por vez. |
| Botões | Na vitória com próximo ginásio: **dois botões** — `Próximo Ginásio ▶` (primário) + `Voltar` (secundário). Demais casos: só `Voltar`. |
| Seção Itens | Mostra o que foi **comprado** na run, agrupado por **Pokébolas** e **Cura/Revive (potions)** (mais "Outros"), com a contagem de quantas vezes foi comprado. **Não** há rastreamento de "uso/arremesso" (a mecânica não tem arremesso que falha). |
| Aba padrão | Estatísticas. |

## 3. Layout

```
┌──────────────────────────────────────────────────┐
│  FAIXA-HERÓI  (ilustração Nstar ao fundo + scrim)  │  ← sempre visível
│    ★ VOCÊ VENCEU! ★      (ou  FIM DE JOGO)          │
│    Efetivado em Cerulean · média 3,8/5             │
│    🎯 Missões 4,2/5   ⚔️ Batalhas 3,4/5   [Média 3,8]│
│    [ Próximo Ginásio ▶ ]      [ Voltar ]           │
├──────────────────────────────────────────────────┤
│   ⟨ Estatísticas ⟩   ⟨ Time ⟩   ⟨ Itens ⟩          │  ← barra de abas
├──────────────────────────────────────────────────┤
│                                                    │
│        conteúdo de UMA aba por vez                 │
│                                                    │
└──────────────────────────────────────────────────┘
```

### 3.1 Faixa-herói (sempre visível)

- **Fundo:** `background-image` com a ilustração `Nstar` escolhida pela média (ver 3.2),
  `background-size: cover; background-position: center; image-rendering: auto` (as artes são
  suaves, anulam o `pixelated` global, como já faz a HomeScreen).
- **Scrim:** gradiente escuro por cima (ex.: `linear-gradient(rgba(8,16,10,.55), rgba(8,16,10,.82))`)
  para garantir contraste do texto sobre qualquer arte (inclusive as mais claras como `5star`).
- **Texto claro:** título e subtítulo em branco/dourado com `text-shadow` para legibilidade.
  - **Vitória:** título dourado com brilho pulsante (reaproveitar `winGlow`). Ex.: `★ VOCÊ VENCEU! ★`.
  - **Derrota:** título vermelho sóbrio: `FIM DE JOGO`.
- **Subtítulo:** na vitória, `Efetivado no Ginásio de {cidade} com média {x}/5!`; na derrota, a
  mensagem de motivo (`LOSS_MESSAGE`) ou o texto de média < 3 (lógica atual preservada).
- **Linha de notas:** `🎯 Missões {n}/5`, `⚔️ Batalhas {n}/5` e o selo de **Média** (verde se
  efetivado, vermelho caso contrário) — reaproveita os estilos `scores`/`avg`.
- **Botões** ficam **dentro do herói** (sempre visíveis sem rolar): ver Seção 6.

### 3.2 Mapeamento imagem ↔ média de estrelas

A imagem segue a **média** (`r.avgStars`, 0–5), igual para vitória e derrota (clima épico no topo,
melancólico embaixo):

| Média | Imagem |
|-------|--------|
| `[0, 1)` | `/background/jpg/1star.jpg` |
| `[1, 2)` | `/background/jpg/2star.jpg` |
| `[2, 3)` | `/background/jpg/3star.jpg` |
| `[3, 4)` | `/background/jpg/4star.jpg` |
| `[4, 5]` | `/background/jpg/5star.jpg` |

Usar os **`.jpg`** (menores; os `.png` ficam sem uso por ora). Helper puro:
`const tier = Math.min(5, Math.max(1, Math.floor(avgStars) + 1))` → `\`/background/jpg/${tier}star.jpg\``.

### 3.3 Abas

- Estado local no componente: `const [tab, setTab] = useState<'stats' | 'team' | 'items'>('stats')`.
- Barra de 3 botões-aba; o ativo recebe destaque visual. Acessibilidade: `role="tab"`/
  `aria-selected` na barra e `role="tabpanel"` no conteúdo.
- Só o painel da aba ativa é renderizado → altura curta e estável em qualquer viewport.

## 4. Conteúdo das abas

### 4.1 ⟨ Estatísticas ⟩ (padrão)

- **Grade de tiles** (reaproveita `Tile`): Missões `{completas}/{total}`, Defesas `{won}/{total}`,
  Média de coração, Ouro ganho (accent), Pokémon mortos (danger se > 0), Derrotados.
- **Destaque do Jogo (MVP)** e **Inimigo mais forte** lado a lado (mesma dupla de hoje, componentes
  `GameMvp` e `StrongestEnemy` reaproveitados).

### 4.2 ⟨ Time ⟩

- **Capturados** — `⚪ Capturados — {capturedCount}`: grade de miniaturas com badge de rank
  (componente atual reaproveitado).
- **Time final** — `👥 Time final`: membros com sprite, nome, rank e corações (atual reaproveitado).

### 4.3 ⟨ Itens ⟩ (compras agrupadas)

Mostra o que foi **comprado** na run, agrupado:

- **Pokébolas** — bolas evolutivas compradas (`poke-ball`, `great-ball`, `ultra-ball`,
  `master-ball`) + `premier-ball`, com a contagem (`×N`).
- **Cura / Revive** — itens com `effect.kind` `heal`/`revive` (`potion`, `super-potion`, `revive`,
  `max-revive`, `fresh-water`), com a contagem.
- **Outros** — demais compras (buffs `x_*`, passivos, `rare-candy`, `fossil-stone`).

Cada item: sprite + nome + `×N` (reaproveita `PurchasedItems`/`itemRow`). Grupo vazio é omitido.

> **Correção de bug latente:** o `finalReport` atual resolve `purchasedItems` só via `ITEMS`, e as
> bolas evolutivas vivem em `balls.ts` — então hoje as pokébolas compradas são **descartadas** e
> nunca aparecem. O redesign passa a resolvê-las via `BALLS`.

## 5. Mudança de dados (`finalReport.ts`)

Os dados de compra **já existem** em `LifetimeStats.purchasedItems` (`Record<itemId, count>`,
incluindo ids de bolas). **Não** há mudança em `DayTally`/`LifetimeStats`/`marketFlow`/
`captureFlow`. A única mudança é na montagem do relatório:

- Resolver cada id comprado por `findItem` (ITEMS) **e**, se não achar, por `BALLS` (id → `BallDef`).
- Anexar uma **categoria** a cada compra: `'ball' | 'healing' | 'other'`.
  - `ball`: id pertence a `BALLS` ou é `premier-ball`.
  - `healing`: `item.effect.kind` é `heal` ou `revive`.
  - `other`: o resto.
- Expor no `FinalReport` uma estrutura normalizada por compra:
  `{ id: string; name: string; sprite: string; count: number; category: 'ball'|'healing'|'other' }[]`,
  ordenada (por categoria e depois por `count` desc). A UI agrupa por `category`.
- Ids desconhecidos (saves antigos/itens removidos) são ignorados (comportamento atual mantido).

## 6. Botões de ação

Reusar a lógica de desfecho atual:

- `canAdvance` (vitória + próxima cidade + `onNextGym`): renderiza **`Próximo Ginásio: {cidade} ▶`**
  (primário) **e** **`Voltar`** (secundário).
- Vitória sem próxima cidade (último ginásio): **`Voltar`** (substitui o antigo "Concluir" para
  manter a consistência do "sempre Voltar"). *Decisão de cópia a confirmar na revisão — pode-se
  manter "Concluir ▶" se preferir.*
- Derrota: **`Voltar`**.

Todos os botões ficam na faixa-herói. `onBack` e `onNextGym` permanecem as mesmas props.

## 7. Contraste / acessibilidade

- Faixa-herói: texto claro sobre scrim escuro → contraste garantido sobre qualquer arte.
- Corpo das abas: mantém os painéis claros do tema (`--c-panel` / `--c-ink`), já com bom contraste.
- Abas com `role=tab`/`aria-selected`; painel com `role=tabpanel`.
- Sem dependências novas; CSS Modules como no restante do projeto.

## 8. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/screens/EndGameScreen.tsx` | Reestrutura para herói + abas (`useState`); botão Voltar sempre presente; aba Itens agrupada. Reaproveita `Tile`/`GameMvp`/`StrongestEnemy`/`PurchasedItems`/`RankBadge`/`Hearts`. |
| `src/components/screens/EndGameScreen.module.css` | Estilos da faixa-herói (fundo + scrim + texto claro), barra de abas, grupos de itens. Reaproveita estilos existentes onde possível. |
| `src/engine/finalReport.ts` | Resolver compras via `ITEMS` **e** `BALLS`; anexar categoria; expor estrutura normalizada agrupável. Atualiza a interface `FinalReport`. |
| `src/engine/finalReport.test.ts` | Casos: bolas compradas aparecem; categorização correta (ball/healing/other); contagem preservada. |

Fora de escopo: nenhuma mudança na engine de jogo, salvar/carregar, ou no fluxo de captura/itens.

## 9. Testes

- **`finalReport.test.ts`:** dado um `purchasedItems` com `great-ball`, `potion` e `exp-share`,
  o relatório resolve os três, categoriza como `ball`/`healing`/`other` e preserva as contagens;
  ids desconhecidos são ignorados.
- **Verificação visual:** conforme a preferência registrada de economia, priorizar os testes
  unitários acima e uma checagem leve de DOM (renderiza herói, 3 abas, alterna aba, botão Voltar
  presente nos três desfechos) em vez de screenshots/preview, salvo se solicitado.

## 10. Riscos / pontos de atenção

- A faixa-herói deve permanecer compacta (imagem como fundo da faixa, não um bloco alto) para não
  reintroduzir scroll. Definir uma altura/`max-height` razoável e deixar título/notas/botões sobre
  ela.
- As ilustrações `Nstar` ainda não estão commitadas (`public/background/jpg|png`) — entram junto.
- Mapeamento por média trata vitória e derrota igual; um GAMEOVER com média alta mostra arte
  "épica". Aceito por ora (decisão 2). Ajuste futuro possível: rebaixar a arte em GAMEOVER.

## 11. Adendo (2026-06-17) — Aba Estatísticas reformulada

Iteração após o redesign inicial, na aba **Estatísticas**:

- **Top 3 do time** (substitui o "Destaque do Jogo" único): os 3 Pokémon com mais feitos
  acumulados (missões + derrotas), desempate por missões e ordem de registro. `finalReport.mvp`
  → `finalReport.topTeam: FinalReportMvp[]`.
- **Pokémons enfrentados** (substitui "Mais forte enfrentado"): os **3 inimigos mais fortes**
  (maior Poder de Batalha) derrotados na run. `LifetimeStats.strongestEnemy` (único) →
  `strongestEnemies: EnemyRef[]` (top 3, acumulado no fold) e `finalReport.strongestEnemies`.
- **Carrasco**: a espécie inimiga que mais venceu duelos contra o seu time (defesas **e** Rocket);
  empate → a primeira a aparecer. Exige rastrear os duelos perdidos: nova `DayTally.defenseLosses`
  (simétrica a `defenseKills`, registrada em `defenseFlow`/`missionFlow`), acumulada em
  `LifetimeStats.defeatedBy` (espécie → contagem, em ordem de 1ª aparição) e exposta como
  `finalReport.tormentor`.
- **% concluído** nas tiles de ratio (Missões, Defesas): ex. `10/20` mostra `50%`.
- **Cor do coração** da tile "Média de coração": agora vermelho (`--c-hp-low`) — antes saía branco
  e sumia no painel claro.

Migração de save **v31 → v32**: `today.defenseLosses = []`; `lifetime` troca `strongestEnemy`
(único) pela lista `strongestEnemies` (com o antigo, se houver) e ganha `defeatedBy: []`.

Nota de mecânica: "carrasco" conta **duelos vencidos** pelo inimigo contra os seus Pokémon (não
arremessos/KO exatos), simétrico ao `defenseKills` que conta os seus duelos vencidos.
