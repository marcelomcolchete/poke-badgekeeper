# Plano de Implementação — Poke BadgeKeeper (v0.1.0)

> **Status:** rascunho para revisão. Nenhum código foi escrito ainda.
> **Repositório:** https://github.com/marcelomcolchete/poke-badgekeeper (privado, vazio)
> **Tipo:** jogo single-player de navegador, fan game **não-comercial** (Gen 1 / Kanto).

---

## 1. Pitch

Você foi contratado para cuidar de um ginásio Pokémon por **10 dias** (período de testes). A cada dia (3 minutos reais, com pausa / x2 / x3) você **despacha** seu time de Pokémon (1–6 por missão) para cumprir missões pela cidade — ganhando aprovação dos cidadãos — enquanto mantém um esquadrão de reserva pronto para **defender o ginásio** em ataques que surgem em momentos aleatórios. No fim do dia você captura novos Pokémon, recebe ouro e tem sua aprovação (estrelas) ajustada. Termine os 10 dias com **mais de 3 estrelas** e seja efetivado, avançando para a próxima cidade de Kanto.

Inspiração de mecânica: **Dispatch** (gerenciamento de missões de heróis), adaptado para Pokémon.

---

## 2. Decisões já confirmadas

| Item | Escolha |
|------|---------|
| Stack | **Vite + React 19 + TypeScript** (SPA 100% client-side) |
| Persistência | **localStorage** (saves locais, offline, com versionamento de schema) |
| Dados Pokémon | **Estáticos no repo** — 151 da Gen 1 curados (tipos, sprites, atributos custom, passivas) |
| Estilo | **CSS Modules** (sem Tailwind / libs CSS) — **estética retrô arcade Game Boy/GBA**: pixel art, fontes bitmap, caixas de diálogo clássicas, paleta por tipo (ver §2.1) |
| Testes | **Vitest** para a engine pura |
| Deploy | **Vercel** (plano gratuito) |
| Save | **Slot único** com autosave |

Princípios de código herdados do seu outro projeto (Dungeons & Decks), por serem bons: **engine pura e determinística** (sem React, sem side effects), **arquivos pequenos (~200 linhas)**, **funções pequenas (~30 linhas)**, **TS strict sem `any`**, **dados estáticos em `data/`**, **sem magic numbers**.

> Diferença-chave vs. Dungeons & Decks: aqui **não há servidor nem multiplayer**. O conceito "server-authoritative" não se aplica — toda a lógica roda no cliente. Em troca, mantemos o rigor de **engine pura + RNG semeado (seeded)** para que o jogo seja testável e o save reproduzível.

### 2.1 Estilo visual (direção de arte)

**Estética: retrô arcade, fiel ao Pokémon clássico de Game Boy / GBA (Gen 1).** Em vez de um tema dark moderno, o jogo adota o visual **pixelado e de alto contraste** dos jogos originais. Referência do usuário: [pokelite.pages.dev](https://pokelite.pages.dev/).

- **Pixel art em tudo.** Sprites das 151 espécies em estilo Gen 1 com `image-rendering: pixelated` (sem anti-aliasing / escala suave). Molduras, ícones e botões também pixelados.
- **Fontes bitmap.** Fonte pixel para títulos/HUD (ex.: *Press Start 2P*) e uma fonte estilo "textbox" do Pokémon para diálogos — todas de **licença aberta** (SIL OFL) e **auto-hospedadas** via `@font-face` (sem CDN externo, sem fontes proprietárias da Nintendo).
- **Textbox clássica do Pokémon original.** A caixa de diálogo é **branca, com borda dupla arredondada azul-clara**, **texto azul** e cursor **▼ vermelho** — exatamente como nos jogos originais (referência enviada pelo usuário). Menus em lista com cursor "▶".
- **Mapa da cidade como tela principal.** A fase Dia roda sobre uma **arte top-down de cidade** (estilo overworld clássico, ex.: Pewter), uma imagem por cidade, com missões/captura/defesa aparecendo **como marcadores sobre o mapa** (ver §3.1).
- **Paleta por tipo.** Cada um dos 15 tipos da Gen 1 com sua cor canônica (Fogo vermelho-laranja, Água azul, Grama verde…), usada em **badges de tipo**, no fundo das cartas de Pokémon e nos **hexágonos do radar** (missão vs. time).
- **HUD de batalha clássico** na defesa de ginásio: barra de HP **verde → amarelo → vermelho**, nome + nível e caixa de status — espelhando a tela de batalha dos jogos originais.
- **Sem gradientes suaves nem sombras modernas.** Cores chapadas, bordas duras, paleta limitada. Efeitos "arcade" pontuais: flash de dano, *shake* de tela, transições de *wipe* entre as fases do dia.
- **Paleta fiel ao Pokémon original** (jogo de fã): overworld colorido (verdes de grama, caminhos claros, telhados dos prédios), textbox branca + azul + ▼ vermelho, HUD do topo em navy/amarelo (mantido) e cores de tipo canônicas como acentos.

> Coerente com a **nota legal (§10)**: usar fontes pixel de licença aberta e sprites de fonte fan já difundida — nada de assets proprietários.

---

## 3. Loop de jogo

```
Novo jogo (Dia 1, Pewter)
  └─ Recebe o inicial: 1 Pokémon do tipo primário da cidade, nível 3 (ex.: Onix)
  └─ Sorteio de tipos extras — DUAS rodadas, uma escolha de cada vez:
       sorteia 3 tipos aleatórios → escolhe 1 → sorteia 3 Pokémon nível 1 daquele tipo → escolhe 1
     (os 2 tipos escolhidos + o primário = os 3 tipos do ginásio → definem o pool capturável)
       │
       ▼
  ┌─ DIA N (1..10) ───────────────────────────────────────────────┐
  │  Fase 1 — Manhã / Mercado (pausado): comprar itens, montar      │
  │           esquadrão de defesa, revisar time                     │
  │  Fase 2 — Dia (180s reais, pausa/x2/x3):                        │
  │            • missões surgem ao longo do dia (mais perto do dia  │
  │              10 = mais missões)                                  │
  │            • você despacha times (1–6) → viagem → execução →    │
  │              resolução (sucesso/falha)                          │
  │            • a missão de CAPTURA fica disponível o dia inteiro  │
  │              (sem recompensa, só consome tempo e traz Pokémon)  │
  │            • defesas de ginásio surgem em momentos aleatórios   │
  │              (precisa de ≥3 Pokémon disponíveis)                │
  │  Fase 3 — Resumo do dia: aprovação (±estrela), ouro, vivos/     │
  │           mortos, destaque, capturados                          │
  └─────────────────────────────────────────────────────────────────┘
       │ (repete por 10 dias)
       ▼
  Resumo final da cidade → se > 3 estrelas: efetivado → próxima cidade
```

**Tensão central do jogo:** Pokémon despachados em missões ficam **ocupados** (viajando/executando). Mas defesas de ginásio surgem a qualquer momento e exigem ≥3 Pokémon disponíveis. Mandar todo mundo nas missões (ou na captura) maximiza aprovação/time, mas te deixa exposto nas defesas (que dão ouro). Com no máximo **9 Pokémon** e HP baixo (1–10), esse trade-off em tempo real é o coração do jogo.

### 3.1 Interface da fase Dia (mapa da cidade)

A fase **Dia** acontece sobre uma **arte de mapa da cidade** (visão top-down estilo Pokémon clássico — uma imagem estática por cidade, ex.: Pewter). Sobre o mapa, em tempo real:

- **Missões = popups de exclamação.** Surgem em pontos espalhados pelo mapa como **mini-popups com ícone/emoji** (um "❗" ou emoji do tema da missão) e um **timer visível** (anel/barra que esvazia). **Clicar aceita** a missão → abre o despacho (escolha do time 1–6 + radar hexagonal). Se o timer zerar sem clique, a missão **some** (oportunidade perdida). Mais perto do dia 10 = mais popups.
- **Áreas de captura = marcadores fixos.** Locais específicos do mapa (mato alto, lago…) ficam **sempre visíveis** como pontos de captura, **sem timer**. Clicar manda um Pokémon "procurar" (§4.5).
- **Defesa de ginásio = símbolo de luta no seu ginásio.** Surge sobre o **prédio do ginásio** como um ícone de combate, também com **timer — porém mais longo** que o das missões (dá mais tempo para reagir). Clicar abre a atribuição do esquadrão de defesa (§4.4).
- **Cabeçalho (HUD) no topo:** dia, relógio do dia, controles de velocidade (pausa/x2/x3), ouro e estrelas — mantido do mockup aprovado.
- **Botões na lateral esquerda (centralizados na vertical):** **Time** (ver/gerenciar Pokémon individualmente) · **Relatório do dia** (relatório completo do dia em andamento) · **Desistir** (abandonar a run).
- **Textbox clássica** na base para diálogos/avisos (branca, borda azul, texto azul, cursor ▼ vermelho).

Posições e horários de spawn (missões/defesas) são **semeados pelo seed do dia** e ancorados em pontos pré-definidos do mapa de cada cidade (ver `data/cities.ts`).

---

## 4. Mecânicas detalhadas (fórmulas — propostas iniciais, ajustáveis na Fase de balanceamento)

### 4.1 Atributos

Cada Pokémon tem **6 atributos** (0–100):

| Atributo | Função no jogo |
|----------|----------------|
| **Batalha** | Atributo principal da defesa de ginásio |
| **Inteligência** | Conclui missões mais rápido (reduz tempo de execução) |
| **Carisma** | Mais ouro no fim do dia |
| **Agilidade** | Move-se mais rápido até a missão (reduz tempo de viagem) |
| **Resistência** | Aumenta a vida total (HP) — evita desmaiar e ir ao Centro Pokémon |
| **Percepção** | Encontra Pokémon de nível mais alto para capturar |

**Base por espécie (10–50):** cada uma das 151 espécies tem valores base curados. O **mínimo de qualquer atributo é 10** e o **máximo natural é 50** (ex.: Ditto ~10 em tudo; Rattata baixo em tudo). A lista completa de atributos por Pokémon você vai me passar depois — por ora os valores base ficam num mapa curado provisório.

**Crescimento por nível (até +50):** níveis vão de **1 a 10**. Cada nível ganho dá **+1 ponto** de atributo = **+10** no atributo escolhido. Subir do nível 1 ao 10 = +9 pontos = até +90, mas o valor final é **limitado a 100** por atributo.

```
atributoEfetivo(p, attr) = clamp(baseEspecie[attr] + alocacoes[attr] * 10, 10, 100)
```

**Alocação dos pontos:**
- **Pokémon do jogador** que sobe de nível → abre um **modal** e o jogador escolhe em qual atributo colocar o ponto.
- **Pokémon selvagem capturado acima do nível 1** → os `(nível − 1)` pontos já vêm **distribuídos aleatoriamente** (ex.: selvagem nível 2 = +10 em um atributo; nível 5 = +40 espalhados). A partir daí, novos níveis abrem o modal normalmente.

**HP derivado da Resistência:** o HP é um inteiro de **1 a 10** = `clamp(round(resistência / 10), 1, 10)`. Resistência 100 → 10 HP; resistência 10 → 1 HP. Como Resistência também cresce com o nível, subir de nível pode aumentar o HP máximo.

#### 4.1.1 Evolução

Como os níveis vão só de **1 a 10**, os níveis canônicos de evolução (16, 32…) são **remapeados** para essa escala — cada espécie evoluída guarda no `data/` o **nível de jogo** em que aparece (ex.: 2ª forma no nível ~4, 3ª forma no nível ~7; valores curados, ajustáveis na Fase 5).

- **Seu Pokémon evolui** ao **subir de nível** e atingir o nível de evolução da espécie. Ao evoluir: a `speciesId` muda para a forma evoluída, os **atributos base** passam a ser os da forma evoluída (em geral maiores) e os **tipos** podem mudar. **Nível, XP, pontos alocados e proporção de HP** são preservados.
- **Selvagens (captura)** seguem o mesmo limiar: uma forma evoluída só aparece num sorteio cujo nível seja **≥ o nível de evolução** dela (§4.5).

Isso exige, no `data/pokemon/`, a **cadeia de evolução** de cada espécie e o **nível de jogo** de cada evolução.

### 4.2 Probabilidade de sucesso da missão (hexágono ∩ hexágono)

Cada **missão** define uma exigência de 0–100 por atributo → desenha um **hexágono** (radar de 6 eixos). O **time despachado** tem seus atributos **somados** por eixo, e a soma é **limitada a 100** por eixo (ex.: Mewtwo +60 de Agilidade com Rapidash +50 de Agilidade = 110 → vira **100**, o máximo da missão). A **interseção** dos dois hexágonos sobre a exigência = **probabilidade de sucesso**.

Eixos em ordem canônica fixa, a 60° entre si: `Batalha, Inteligência, Carisma, Agilidade, Resistência, Percepção`.

```
somaTime_i = min( Σ_(pokémon do time) atributoEfetivo_i , 100 )
```

**Área de um hexágono radar** (raios `r0..r5`):
```
area(r) = 0.5 * sin(60°) * Σ_{i=0..5} r_i * r_{(i+1) mod 6}
```

**Interseção** (aproximação por eixo): `m_i = min(somaTime_i, exigencia_i)`
```
P_sucesso = clamp( area(m) / area(exigencia), 0, 1 )
```

Interpretação: se o time atinge ou supera a exigência em **todos** os eixos → interseção = área da exigência → **100%**. Se fica abaixo em alguns eixos, a probabilidade cai proporcionalmente. **Recompensa o formato** da missão, não só o total bruto — um time só de Batalha vai mal numa missão que exige Inteligência + Agilidade.

> Alternativa mais simples (caso o cálculo de área fique confuso para o jogador): média das razões por eixo — `P = média( min(time_i, exig_i) / exig_i )`. Mantemos a **área** como primária por ser fiel à sua visão ("interseção dos gráficos") e ótima visualmente (hexágonos sobrepostos no SVG).

**Resolução:** um sorteio de Bernoulli com `P_sucesso` (RNG semeado). Em **falha**, cada Pokémon do time perde **HP inteiro** = `max(1, round((1 - P_sucesso) * perigoDaMissão))` (ajustável no balanceamento; como HP vai só de 1 a 10, perder 1–3 já é significativo — ter Resistência alta = mais HP = mais margem). HP a **0** → **desmaia** → Centro Pokémon (indisponível até o fim do dia, salvo item Revive).

### 4.3 Tempo: o dia de 3 minutos

- Dia = **180.000 ms de tempo de jogo**. Velocidade `x1/x2/x3` multiplica o avanço do relógio; **pausa** congela. (Em x3, o dia dura ~60s de relógio de parede.)
- Uma missão tem **localização** (distância no mapa) e **trabalho** (esforço). Tempo total ≈ **viagem + execução**:
```
tempoViagem   = baseViagem   / (1 + mediaAgilidade(time)/50)
tempoExecucao = baseExecucao / (1 + mediaInteligencia(time)/50)
```
  (Em 50 de média, o tempo cai pela metade. Passivas como **Fly** podem zerar/reduzir a viagem.)
- Enquanto viaja/executa, o Pokémon fica **ocupado** e indisponível para defesa.

### 4.4 Defesa de ginásio (cadeia de batalhas 1v1)

Surge em momentos aleatórios como um **símbolo de luta sobre o ginásio** (com **timer mais longo** que o das missões — §3.1). Exige **≥3 Pokémon disponíveis** (esquadrão de defesa). Funciona **como uma missão, mas usando só o atributo Batalha** (um único eixo), com buff/debuff de tipo. Resolve como **cadeia de batalhas 1v1**: se um Pokémon é derrotado numa batalha, entra o próximo — **dos dois lados**.

**Batalha efetiva** (com a **tabela de tipos da Gen 1**, do SEU Pokémon vs. o tipo do oponente):
```
batalhaEfetiva = batalha * multiplicadorDeTipo
```
- cada **vantagem** (super efetivo): **×1,5** — acumula contra alvo de tipo duplo (o "+50% por vantagem")
- cada **desvantagem** (o oponente é forte contra você): **×0,5** (o "−50%")

**Cada batalha 1v1** (mesma lógica de interseção da missão, num eixo só):
```
P(você vence) = clamp( min(suaBatalhaEf, batalhaEf_oponente) / batalhaEf_oponente , 0, 1 )
              = clamp( suaBatalhaEf / batalhaEf_oponente , 0, 1 )
```
(Se sua Batalha efetiva ≥ a do oponente, vitória garantida; abaixo disso, proporcional.)

**Consequência de perder uma batalha:** o Pokémon **perdedor perde 1 de HP** e sai (entra o próximo do seu lado). Isso vale **sempre que um Pokémon perde uma batalha** — então você pode **vencer a defesa inteira** e ainda assim ter Pokémon que perderam batalhas no caminho (cada um −1 HP). Se o HP chegar a **0**, o Pokémon **desmaia** → Centro Pokémon.

**Fim da defesa:** acaba quando um dos lados fica **sem Pokémon** para enviar. Você **vence a defesa** se zerar o esquadrão adversário antes do seu. Cada defesa vencida conta para o **ouro do dia** (seção 4.6).

### 4.5 Captura (missão de dia inteiro)

A captura é uma **missão especial disponível o dia todo**, acessada pelos **marcadores de área de captura fixos no mapa** (mato alto, lago — sempre visíveis, §3.1). Ela **não dá recompensa** (nem ouro, nem aprovação) — só **consome tempo** e pode render um Pokémon novo. Você despacha um Pokémon (idealmente o de maior Percepção) para "procurar":

- **Percepção → velocidade da busca** (quanto maior, mais rápido encontra; *não* afeta o nível encontrado).
- Ao encontrar, aparecem **3 Pokémon aleatórios** dos **3 tipos do ginásio** (podem ser repetidos de espécies que você já tem). Você então:
  1. **captura 1** dos três; ou
  2. **não pega nenhum** e manda o Pokémon **voltar**; ou
  3. **não pega nenhum** e o mantém **procurando** (gera um novo trio depois).
- **Nível do selvagem** = `número do dia ± 1` (variação de 1 pra mais ou pra menos). **Filtro de evolução:** uma espécie evoluída só pode aparecer se o nível sorteado for **≥ o nível em que ela evolui** (ex.: uma 2ª forma que evolui no nível 4 não aparece num sorteio de nível 3) — ver §4.1.1.
- **Limite de 9 Pokémon no total.** Com o roster **cheio (9)**, a missão de captura fica **bloqueada/indisponível** — não dá pra capturar novos até liberar espaço.

Como ocupa um Pokémon por um bom tempo e sem recompensa direta, vale capturar **em dias tranquilos / com folga de tempo** — pensando no risco de uma defesa surgir enquanto seu melhor Pokémon está fora procurando.

### 4.6 Economia e mercado

- **Ouro no fim do dia** ∝ número de **defesas de ginásio vencidas**, ajustado pelo **Carisma** dos participantes:
```
ouro = Σ_(defesas vencidas) [ ouroBase * (1 + mediaCarisma(esquadrão)/100) ]
```
- **Mercado (manhã):** itens **usáveis** (Potion = cura HP, Revive = revive desmaiado, etc.) e **passivos** (Quick Claw, etc.).

### 4.7 Aprovação (estrelas) e progressão

- Estrelas de **1 a 5**, em passos de **meia estrela**. Começa em **1**.
- Por dia: cumprir a **meta de missões** → **+0,5**; cumprir **todas** as missões do dia → **+1,0**; **não** cumprir a meta → **−0,5**.
- Cada cidade tem nível de exigência diferente (curva de metas).
- Fim do jogo (dia 10): **> 3 estrelas** → efetivado → **avança para a próxima cidade**.
- Resumo final: estrelas por dia, Pokémon usados, se foi "carrasco" na defesa, etc.

### 4.8 Curva de dificuldade

Quanto mais perto do dia 10, **mais missões e mais defesas**:
```
missoesNoDia(d) ≈ round( lerp(minMissoes, maxMissoes, (d-1)/9) ) * fatorCidade
defesasNoDia(d) ≈ round( lerp(minDefesas, maxDefesas, (d-1)/9) ) * fatorCidade
```
Horários de surgimento distribuídos ao longo dos 180s (semeados pelo seed do dia).

---

## 5. Arquitetura técnica

Três camadas, com dependências sempre apontando "para dentro":

```
UI (React, CSS Modules)  ──►  game/ (orquestração: relógio, reducer, autosave)  ──►  engine/ (puro)
                                                                                        ▲
                                                                            data/ (estático: 151, tipos, cidades…)
```

- **`engine/` — puro e determinístico.** Recebe `GameState` + ação, retorna **novo** `GameState`. Sem React, sem `Date.now()`/`Math.random()` direto (usa um **RNG semeado**) → 100% testável e reproduzível.
- **`game/` — orquestração em tempo real.** O *game clock* avança o relógio do dia (pausa/x2/x3), dispara eventos agendados (missões/defesas) e chama transições da engine. Mantém o reducer + dispatch e faz **autosave** no localStorage.
- **`components/` — UI.** Recebe apenas os dados de que precisa (memoizado), nunca o `GameState` inteiro. O radar hexagonal (missão vs. time) é um componente SVG central.

### Estrutura de pastas proposta

```
poke-badgekeeper/
├─ public/
│  ├─ sprites/                 # sprites Gen 1 (fonte fan, ver nota legal)
│  └─ maps/                    # arte top-down de cada cidade (fundo da fase Dia)
├─ src/
│  ├─ main.tsx · App.tsx
│  ├─ data/                    # estático, importado como constante
│  │  ├─ pokemon/              # 151 espécies: tipos, atributos base, evolução, passivas
│  │  ├─ typeChart.ts          # tabela de efetividade da Gen 1 (15 tipos)
│  │  ├─ cities.ts             # 8 cidades: tipo primário, curva de dificuldade, arte do mapa + âncoras (spawns de missão, áreas de captura, posição do ginásio)
│  │  ├─ items.ts              # itens do mercado
│  │  ├─ missionTemplates.ts   # modelos de missão por tipo/tema
│  │  └─ passives.ts           # passivas (Fly, etc.) e seus efeitos
│  ├─ engine/                  # PURO — sem React
│  │  ├─ state.ts              # tipos do GameState + estado inicial
│  │  ├─ rng.ts                # RNG semeado (mulberry32/xorshift)
│  │  ├─ attributes.ts         # atributo efetivo, área/interseção de hexágono
│  │  ├─ leveling.ts           # XP, level-up, alocação de pontos
│  │  ├─ missions.ts           # geração, P_sucesso, resolução, dano em falha
│  │  ├─ gymDefense.ts         # cadeia de duelos 1v1 + multiplicador de tipo
│  │  ├─ capture.ts            # encontros por Percepção, captura
│  │  ├─ economy.ts            # ouro, compra no mercado
│  │  ├─ approval.ts           # cálculo de estrelas
│  │  ├─ timeline.ts           # agenda de spawns do dia (semeada, escala com o dia)
│  │  └─ daySummary.ts         # agregação do resumo do dia
│  ├─ game/
│  │  ├─ actions.ts            # tipos de ação (SEND_TEAM, ASSIGN_DEFENSE, BUY_ITEM…)
│  │  ├─ reducer.ts            # aplica ações via engine
│  │  ├─ useGameClock.ts       # loop do dia (rAF/setInterval) + velocidade
│  │  └─ useGameState.ts       # estado + dispatch + autosave
│  ├─ persistence/
│  │  └─ saveLoad.ts           # schema do save + versionamento/migração
│  ├─ components/              # hud · cityMap · missionPopup · captureSpot · gymMarker · sidebar · team · radar · gym · market · capture · summary
│  ├─ hooks/
│  ├─ styles/                  # globals.css + tokens retrô (cores de tipo, fontes pixel, bordas) + @font-face
│  └─ types/                   # tipos compartilhados
├─ scripts/
│  └─ buildPokemonData.ts      # gera o JSON da Gen 1 (PokéAPI p/ nomes/tipos/sprites + mapa curado de atributos)
├─ docs/  (PLAN.md, DESIGN.md, DOCS_INDEX.md)
├─ index.html · package.json · tsconfig.json · vite.config.ts · README.md
```

### Modelo de dados (esboço do `GameState`)

```ts
GameState = {
  run:    { cityIndex, day, seed, phase }          // 'MORNING' | 'DAY' | 'CAPTURE' | 'SUMMARY'
  clock:  { dayElapsedMs, dayLengthMs, speed }      // speed: 0(pausa)|1|2|3
  gym:    { types: [primary, t2, t3] }
  roster: Pokemon[]                                 // 1..9 Pokémon; cada um com status próprio
                                                    // (em cada missão você despacha de 1 a 6 deles)
  missions: MissionInstance[]                       // pos no mapa + expiresAt (timer); available|traveling|inProgress|resolved
  defenses: DefenseEvent[]                           // marcador no ginásio + expiresAt (timer mais longo); scheduled|active|won|lost
  approval: { stars, dailyGoalMet }
  gold, inventory: ItemStack[]
  history: DayLog[]                                  // para resumos
}

Pokemon = {
  id, speciesId, level, xp, types,
  baseAttrs: Attrs, allocations: Attrs,             // efetivo = base + alocação*10
  currentHp, maxHp, status, passives
}
```
(`status` de um Pokémon: `idle | traveling | onMission | defending | fainted | atCenter`.)

---

## 6. Fases de implementação (roadmap)

| Fase | Entrega | Detalhe |
|------|---------|---------|
| **0 — Setup** | Projeto roda | Scaffold Vite+React+TS, tsconfig strict, ESLint, CSS Modules, estrutura de pastas, RNG semeado, esqueleto de save, README + nota legal, config de deploy. **1º commit no repo vazio.** |
| **1 — Dados** | `data/` completo | Script gera as 151 espécies (tipos/sprites via PokéAPI, atributos custom curados), tabela de tipos Gen 1, 8 cidades, itens, modelos de missão, passivas. |
| **2 — Engine** | Lógica + testes | Atributos/hexágono, leveling, missões (P_sucesso/resolução), defesa de ginásio, captura, economia, aprovação, timeline, resumo. **Unit tests (Vitest)** para cada módulo. |
| **3 — Orquestração** | Dia jogável "headless" | Game clock (180s, pausa/x2/x3), reducer/ações, autosave, transição entre as 4 fases do dia. |
| **4 — UI** | Jogo jogável | HUD (relógio/velocidade/ouro/estrelas), mapa + marcadores de missão, atribuição de time + **radar hexagonal sobreposto**, roster/cartas de Pokémon, tela de defesa, mercado, captura, resumos, fluxo de novo jogo/início de cidade. |
| **5 — Conteúdo & balanceamento** | 8 cidades + tuning | Preencher curvas de dificuldade, ajustar fórmulas (P_sucesso, dano, ouro, tempos), passivas e combos. |
| **6 — Polimento** | Release | Animações, áudio, acessibilidade, migração de save, telas de fim de jogo, persistência entre cidades. |

Sugestão: ao concluir cada fase, **bump de versão** (`package.json`) — começamos em `0.1.0`. Mantemos um `DESIGN.md` (bíblia de design) e `DOCS_INDEX.md` espelhando o padrão do seu outro projeto.

---

## 7. Decisões de design

### ✅ Confirmadas

1. **Alocação de pontos de nível** — **modal** para o jogador escolher a cada level-up. Selvagem capturado acima do nível 1 já vem com `(nível − 1)` pontos distribuídos **aleatoriamente**.
2. **Soma do time na missão** — soma por eixo **capada em 100** (o máximo da missão).
3. **Falha de missão** — perde **HP inteiro**; desmaia só se o HP chegar a 0.
4. **Atributo mínimo = 10** (não 0). Base por espécie 10–50; cresce até 100 por nível.
5. **HP = 1–10**, derivado da Resistência (`round(res/10)`, mín. 1).
6. **Defesa de ginásio** — como missão, **só Batalha**, com buff/debuff de tipo; cada batalha perdida custa **−1 HP** ao perdedor (mesmo numa defesa vencida); cadeia 1v1 até um lado ficar sem Pokémon.
7. **Tipos do ginásio** — primário fixo pela cidade + **2 escolhidos** pelo jogador. No dia 1, **duas rodadas**: sorteia 3 tipos → escolhe 1 → sorteia 3 Pokémon nível 1 daquele tipo → escolhe 1. Tipos extras **totalmente aleatórios** (sem pool temático).
8. **Captura** — **missão de dia inteiro**, sem recompensa, só consome tempo. Percepção = **velocidade** da busca. Mostra **3 aleatórios** dos tipos do ginásio (podem ser repetidos); captura 1, ou nenhum (volta), ou nenhum (segue procurando). **Máx. 9 Pokémon.**
9. **Deploy** — **Vercel** (gratuito). **Save** — **slot único** com autosave.
10. **Evolução** — Pokémon evoluem ao subir de nível, com níveis de evolução **remapeados para a escala 1–10** (curados no `data/`). Selvagens evoluídos só aparecem a partir do seu nível de evolução. Ver §4.1.1.
11. **Nível dos selvagens** = `número do dia ± 1`, respeitando o filtro de evolução.
12. **Roster cheio (9)** → missão de captura **bloqueada** (não dá pra capturar sem liberar espaço antes).
13. **Direção de arte** — **retrô arcade Game Boy/GBA**, não tema dark: pixel art (`image-rendering: pixelated`), fontes bitmap de licença aberta, **textbox clássica** (branca, borda azul, texto azul, cursor ▼ vermelho), paleta por tipo, HUD de batalha (HP verde→amarelo→vermelho). Ver §2.1.
14. **Tela do Dia = mapa da cidade.** Arte top-down por cidade como fundo; **missões** aparecem como **popups de exclamação com timer** (clicar aceita / expira se ignorado), **áreas de captura** são **marcadores fixos sempre visíveis**, e a **defesa** é um **símbolo de luta sobre o ginásio** (timer mais longo). **HUD no topo** (mantido) + **botões à esquerda, centralizados na vertical**: Time · Relatório do dia · Desistir. Ver §3.1.

### Fica para a Fase 5 (balanceamento)

Constantes em um `balance.ts` único: **dano exato da falha** de missão, **curvas** de missões/defesas por dia, **ouro base**, **tempos** de viagem/execução, e os **níveis de evolução** na escala 1–10. RNG semeado permite testar cenários reproduzíveis ao afinar esses números.

---

## 8. Riscos

- **Legal / IP (principal).** Pokémon é marca da Nintendo/Game Freak/The Pokémon Company. Mitigação: manter **não-comercial, sem anúncios, sem doações**, repo **privado**, disclaimer no README, e usar sprites de fonte fan já difundida. Ainda assim há risco de takedown se publicado — recomendo manter privado / acesso restrito.
- **Equilíbrio das fórmulas.** P_sucesso por área de hexágono e os multiplicadores de tempo precisam de tuning (Fase 5). Mitigação: todas as constantes ficam em um único `balance.ts`/`data/` para iterar rápido; RNG semeado permite testar cenários reproduzíveis.
- **Curadoria dos 151 atributos custom.** Mapear Batalha/Inteligência/Carisma/Agilidade/Resistência/Percepção para cada espécie é trabalho de design. Mitigação: começar derivando heurísticas dos stats oficiais (ex.: Ataque/Defesa → Batalha/Resistência, Velocidade → Agilidade) e ajustar manualmente os destaques.
- **Sensação de tempo real em 3 min.** Equilibrar quantas missões/defesas cabem em 180s sem virar caos. Mitigação: protótipo "headless" jogável já na Fase 3, antes da UI.

---

## 9. Estimativa (ordem de grandeza)

| Fase | Esforço relativo |
|------|------------------|
| 0 — Setup | pequeno |
| 1 — Dados | médio (curadoria) |
| 2 — Engine + testes | grande |
| 3 — Orquestração | médio |
| 4 — UI | grande |
| 5 — Conteúdo & balance | médio-grande (iterativo) |
| 6 — Polimento | médio |

Um **vertical slice jogável** (1 cidade, 1–2 dias, missões + 1 defesa + resumo) é alcançável ao fim da Fase 4 com dados parciais.

---

## 10. Nota legal (fan game)

Projeto **sem fins lucrativos, feito por fã para fãs**. Pokémon e todos os nomes/sprites são propriedade da Nintendo, Game Freak e The Pokémon Company. Incluir disclaimer no README. Não monetizar. Manter o repositório privado enquanto em desenvolvimento.

---

## 11. Próximo passo

Após sua revisão e respostas às **decisões em aberto (seção 7)**, sigo para a **Fase 0** (scaffold do projeto + 1º commit no repositório). Nada será codificado antes da sua aprovação.

