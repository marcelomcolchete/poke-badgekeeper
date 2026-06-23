# Ajustes: special5, seletor de Habilidade Secreta, Spore e mart de Celadon

**Data:** 2026-06-23
**Status:** aprovado (brainstorming) — pronto para plano de implementação

Quatro mudanças independentes, agrupadas num único spec por serem pequenas e sem
dependência entre si. Cada uma pode virar uma fatia separada do plano.

---

## 1. Missão especial (`special5`): 4 principais + 2 secundários com "mega"

### Hoje
`generateRequirement` ([src/engine/missions.ts](../../../src/engine/missions.ts)) trata
`special2` e `special5` no mesmo laço: sorteia `principals` eixos como principais e
`secondaries` eixos como secundários, **todos distintos entre si** (índices contíguos do
shuffle). Constantes em [src/engine/balance.ts](../../../src/engine/balance.ts):

- `SPECIAL5_PRINCIPALS = 3`, `SPECIAL5_SECONDARIES = 2` (o nome `5` é legado de um desenho antigo `5+0`).
- `SPECIAL2_PRINCIPALS = 2`, `SPECIAL2_SECONDARIES = 1`.

### Mudança
- `balance.ts`: `SPECIAL5_PRINCIPALS: 3 → 4`. `SPECIAL5_SECONDARIES` permanece `2`.
- `missions.ts`: separar o caminho do `special5` do `special2`.
  - **`special2` (center/mart): inalterado** — 2 principais + 1 secundário, todos distintos, sem mega.
  - **`special5`:**
    1. `axes = rng.shuffle(ATTR_KEYS)`; os **4 primeiros** viram principais (`principalValue`), distintos. Guardar `principalSet = new Set(axes.slice(0, 4))`.
    2. Sortear **2 eixos secundários distintos entre si, dentre os 6 eixos** (ex.: `rng.shuffle(ATTR_KEYS).slice(0, 2)`).
    3. Para cada eixo secundário `ax`:
       - se `ax ∈ principalSet` → **mega**: `out[ax] = clamp(out[ax] + secondaryValue(...), 0, TEAM_ATTR_MAX)`.
       - senão → secundário normal: `out[ax] = secondaryValue(...)`.
    4. Eixos não tocados ficam no `restValue` já preenchido no topo da função.
    5. Retorna `secondaryAttr: null` (como hoje nas especiais; o mega aparece só pelo valor alto no hexágono).

### Comportamento resultante
Com 6 eixos e 4 principais, os 2 secundários distintos podem cair em principal (mega) ou
nos 2 eixos livres. Resultado típico: 1–2 megas e quase todos os eixos carregados — a
missão mais difícil do jogo. Valores por eixo seguem as faixas atuais (principal 20–30 +
termo do dia; secundário 10–20 + termo do dia); **não** há faixa nova.

### Determinismo
A geração consome `rng` em ordem fixa (shuffle dos principais → shuffle dos secundários →
`principalValue`/`secondaryValue` por eixo). Mesmo seed/dia → mesma exigência.

### Testes
- Atualizar testes de exigência do `special5` (contagem de principais/secundários, presença
  possível de mega).
- Garantir que `special2` continua igual (regressão).
- Atualizar o comentário legado em `missions.ts` que ainda diz "special5 = 3 princ + 2 sec".

---

## 2. Seletor de Habilidade Secreta — redesign "Direção A" (cartas claras)

### Hoje
`SecretChoiceButtons` ([src/components/screens/SummaryScreen.tsx](../../../src/components/screens/SummaryScreen.tsx))
renderiza 1–2 botões `<button class="secretChoiceBtn"><b>nome</b><span>efeito</span></button>`.
O CSS ([SummaryScreen.module.css](../../../src/components/screens/SummaryScreen.module.css))
usa fundo translúcido escuro (`rgba(0,0,0,.25)`), `color: inherit` e `opacity:.9` no efeito
— daí o texto pálido, chapado e sem afordância de clique.

### Mudança (Direção A)
Cada opção vira um **cartão claro de alto contraste**, em 3 partes:

- **Header** — banner amarelo (`--c-hud-accent`); nome da habilidade em fonte pixel
  (`--font-pixel`) na cor tinta escura; selo de nível à direita (ex.: `Nv.1`, ou o prefixo
  já existente `Aprofundar —`/`Ampliar —`).
- **Corpo** — texto do efeito em `--font-text` (VT323), cor tinta escura, tamanho legível
  (~18px), **sem** `opacity` reduzida.
- **Rodapé (CTA)** — faixa verde (`--c-panel-border`) com "▶ ESCOLHER" em fonte pixel, cor
  clara; deixa explícito que o cartão é clicável. Hover escurece levemente o verde.

Estilo do cartão: fundo creme (`#f7fdf4`/`--c-panel`), borda verde 3px, sombra-pixel
(`box-shadow: 0 4px 0 <verde-escuro>`), `transform: translateY(-3px)` no hover.

### Detalhes
- A estrutura JSX do botão passa a ter os três blocos (header/corpo/CTA); continua sendo um
  `<button type="button">` único (acessibilidade/click mantidos), `data-sound` se já houver.
- O título amarelo acima ("★ … escolha sua Habilidade Secreta") permanece.
- **Variante inline** (`.secretChoiceInline` dentro do quadro do MVP, [SummaryScreen.tsx](../../../src/components/screens/SummaryScreen.tsx)):
  manter o destaque de atenção, trocando o `secretChoiceGlow` amarelo (que combinava com o
  fundo escuro) por um pulso compatível com o cartão claro (ex.: pulsar a sombra/borda verde).
- Sem mudança de lógica/estado (`CHOOSE_SECRET` intacto); é só apresentação.

### Verificação
Conferir os dois lugares onde o seletor aparece: standalone (Destaque ≠ MVP) e inline
(Destaque = MVP), nos casos de 1 botão (já tem pick L1, oferece L2/ampliar) e 2 botões
(primeira escolha).

---

## 3. Spore — remover o "item x" fantasma

### Diagnóstico
O +10% do Spore **já é por-Pokémon** (`sporeDayBuffs` calcula sobre o `baseAttrs` de cada
Pokémon; quem não tem Spore não recebe nada — [src/engine/secretEffects.ts](../../../src/engine/secretEffects.ts)).
O problema é só visual: o Spore grava em `pokemon.dayBuffs`, **o mesmo campo** usado pelos
itens x_* de mercado (`marketFlow` aplica `statBuff` a todo o roster — [src/game/marketFlow.ts](../../../src/game/marketFlow.ts)).
A `ItemsBar` ([src/components/common/ItemsBar.tsx](../../../src/components/common/ItemsBar.tsx))
não distingue a origem e pinta o buff do Spore como um "item x" (usando o máximo do roster),
o que também faz **parecer** que é buff de time inteiro.

### Mudança
Separar o buff de habilidade do buff de item, dando ao Spore um campo próprio.

- **Tipo** ([src/types/index.ts](../../../src/types/index.ts)): novo campo opcional
  `secretBuffs?: Partial<Attrs>` no `Pokemon`, irmão de `dayBuffs` (aditivo flat, efêmero,
  some na virada do dia).
- **`effectiveAttr`** ([src/engine/attributes.ts](../../../src/engine/attributes.ts)): somar
  `dayBuffs[key] + secretBuffs[key]`. Como `recomputeMaxHp` lê `effectiveAttr`, o HP máximo
  (via `resistencia`) continua correto sem mudança extra.
- **`applySpore`** ([src/game/setup.ts](../../../src/game/setup.ts)): gravar os incrementos em
  `secretBuffs` em vez de `dayBuffs` (e `recomputeMaxHp` depois, como hoje).
- **Virada do dia** ([src/game/phaseFlow.ts](../../../src/game/phaseFlow.ts)): limpar
  `secretBuffs` junto com `dayBuffs` (mesmo ponto que hoje faz `dayBuffs: undefined`), para o
  buff durar exatamente um dia.
- **`ItemsBar`**: **sem alteração** — continua lendo só `dayBuffs`. Efeito: Spore some da
  barra de itens; itens x_* de mercado seguem aparecendo normalmente.
- **`testkit.ts`** ([src/engine/testkit.ts](../../../src/engine/testkit.ts)): aceitar override
  de `secretBuffs`.

### Persistência
`secretBuffs` é opcional e efêmero (zerado a cada virada de dia), como `dayBuffs`. Não exige
migração de save dedicada — a migração segue passthrough. Verificar que `saveLoad` não
rejeita o campo novo (não há validação estrita de chaves extras hoje).

### Testes
- `setup.test.ts`: o teste que checa `dayBuffs` após `applySpore` passa a checar `secretBuffs`.
- Acrescentar/ajustar teste de que o Spore **não** entra como entrada de item na `ItemsBar`
  (ou ao menos que `dayBuffs` permanece intacto após `applySpore`).
- Regressão: item x_* de mercado **continua** aparecendo na `ItemsBar`.

---

## 4. Mart central de Celadon — andável por cima, Surf como atalho

### Hoje
Em [src/data/cities.ts](../../../src/data/cities.ts), Celadon tem `mart: ['j','n']`. O nó `n`
(`{x:0.446, y:0.498}`, prédio central junto ao laguinho) está em `surfNodes: ['n']` e só tem
a aresta `['n','x']` (água). `graphWithoutSurf` ([src/engine/pathfinding.ts](../../../src/engine/pathfinding.ts))
remove `n` inteiro para quem não surfa → o mart central fica inalcançável, e Celadon não tem
Pokémon com Surf. Tornou-se frustrante quando a missão de mart sorteia `n`.

### Mudança
Tornar `n` alcançável a pé pelo ponto de cima e manter o Surf como **atalho mais rápido** pela
água, sem perder o bônus de velocidade na travessia.

Modelo (alinhado às primitivas atuais de grafo):

- `n` **deixa de ser bloqueio de Surf** (sai de `surfNodes`) e ganha uma **aresta a pé** ligando-o
  ao ponto de parada terrestre mais próximo acima do prédio central (rota de chegada a pé,
  mais longa).
- A travessia da água por baixo passa a usar um **nó de água dedicado** (novo `surfNode`)
  entre `x` e `n` — ex.: substituir a aresta `['n','x']` por `['x', <agua>]` + `['<agua>', 'n']`,
  com `<agua>` em `surfNodes`. Assim:
  - **Sem Surf**: `graphWithoutSurf` remove só o nó de água → a rota por baixo some, mas `n`
    continua alcançável pela aresta de cima (a pé).
  - **Com Surf**: cruza o nó de água por baixo (caminho geometricamente mais curto, reto) com
    as arestas incidentes à água custando metade (`SURF_WATER_TIME_MULT`) → "anda menos".
- `mart: ['j','n']` permanece; agora **ambos a pé**. A seleção de site (`buildDaySchedule` em
  [src/engine/timeline.ts](../../../src/engine/timeline.ts)) já sorteia entre os dois — nenhuma
  mudança de spawn necessária.

### A finalizar na implementação
- Coordenada exata do **ponto de cima** (parada terrestre acima do prédio central) e do **nó de
  água**, calibradas contra a arte `public/maps/kanto/4.png` (e, se útil, o DEV picker do
  CityMap). Pode-se reaproveitar um nó superior existente (ex.: `k`/`c`) ou adicionar um nó
  terrestre dedicado, conforme ficar coerente com o desenho. Marcadores (`CELADON_MARKERS`)
  ajustados se um nó novo entrar.

### Testes
Atualizar [src/data/celadon.test.ts](../../../src/data/celadon.test.ts), que hoje afirma que
`n` **não** é alcançável sem Surf:

- `n` (mart central) **é** alcançável sem Surf (`graphWithoutSurf` → caminho `gym→n` não vazio).
- O caminho até `n` **com** Surf é mais curto que a pé (`surfTravelDistance(rotaSurf) <
  pathDistance(rotaPé)`), confirmando o atalho.
- `mart` continua `['j','n']` e ambos alcançáveis a pé; `nodesForCategory('mart')` inalterado.

---

## Fora de escopo
- `special2` (center/mart) e a escala de valores dos eixos (min/max 20–30 / 10–20) — inalterados.
- Outras cidades e outros nós de Surf.
- Lógica de spawn/seleção de missão (só os dados de Celadon mudam).
