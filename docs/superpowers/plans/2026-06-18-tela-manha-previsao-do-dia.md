# Tela da manhã: "Previsão do Dia" + time compacto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a tela da manhã em duas colunas no topo — "Previsão do Dia" (clima + contagens de missões/batalhas/Rocket) e "Seu Time" compacto com botão Computador — mantendo Mercado, itens ativos e "Começar o dia" embaixo.

**Architecture:** Um helper puro novo em `engine/weather.ts` calcula a chance de chuva combinada. Dois componentes de apresentação novos (`DayForecastPanel`, `TeamSummary`) substituem o `WeatherForecastPanel` e a seção de time com radar. `MorningScreen` vira o esqueleto de layout (2 colunas + rodapé). `WeatherForecastPanel` e `TeamPanel` são removidos (código morto).

**Tech Stack:** React 19 + TypeScript, CSS Modules, Vitest (`environment: 'node'`).

## Global Constraints

- Comentários e textos de UI em **português** (padrão do repo).
- Testes coletados **apenas** de `src/**/*.test.ts`, ambiente **node** — sem harness de DOM. Lógica testável = função pura `.ts`; componentes finos verificados por `typecheck`/`lint`/`build`.
- Determinismo do clima preservado: **não** alterar a engine de clima além de **adicionar** o helper puro `rainAtLeastOnceChance` (consumir `buildWeatherSchedule`/`missionsForDay`/`defensesForDay` existentes, sem mudar suas assinaturas).
- Imports relativos **com extensão** `.ts`/`.tsx` (padrão do repo).
- Cor/tipografia via CSS variables existentes (`--c-*`, `--font-pixel`, `--font-text`, `--radius-pixel`).
- Comandos: testes `npx vitest run <arquivo>`; checagens `npm run typecheck`, `npm run lint`, `npm run build`.

---

## File Structure

- `src/engine/weather.ts` — **modificar**: adicionar `rainAtLeastOnceChance(perEventPercent, count)`.
- `src/engine/weather.test.ts` — **modificar**: testes do helper.
- `src/components/screens/DayForecastPanel.tsx` + `.module.css` — **criar**: "PREVISÃO DO DIA".
- `src/components/screens/TeamSummary.tsx` + `.module.css` — **criar**: "SEU TIME" compacto.
- `src/components/screens/MorningScreen.tsx` — **modificar**: layout 2 colunas + rodapé.
- `src/components/screens/MorningScreen.module.css` — **modificar**: grid do topo; remover estilos do time antigo.
- `src/components/screens/WeatherForecastPanel.tsx` + `.module.css` — **remover** (código morto).
- `src/components/TeamPanel/TeamPanel.tsx` + `.module.css` — **remover** (código morto).

---

## Task 1: Helper puro `rainAtLeastOnceChance`

**Files:**
- Modify: `src/engine/weather.ts` (após `rainChanceForDay`, ~linha 118)
- Test: `src/engine/weather.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `rainAtLeastOnceChance(perEventPercent: number, count: number): number` — recebe a chance por pancada (0–100) e a quantidade de pancadas potenciais; devolve a chance inteira (0–100) de chover **ao menos uma vez** no dia = `round((1 − (1 − p/100)^n) × 100)`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `src/engine/weather.test.ts`. O import de `./weather.ts` já existe no topo do arquivo — **incluir `rainAtLeastOnceChance` nessa lista de import** (junto de `buildWeatherSchedule`, `rainChanceForDay`, etc.).

```ts
describe('rainAtLeastOnceChance (chance de ao menos uma pancada)', () => {
  it('combina chance por pancada com a quantidade de pancadas', () => {
    expect(rainAtLeastOnceChance(60, 3)).toBe(94) // 1 - 0.4^3 = 0.936 -> 94
    expect(rainAtLeastOnceChance(50, 2)).toBe(75) // 1 - 0.5^2 = 0.75 -> 75
  })

  it('chance 0 ou 0 pancadas → 0%', () => {
    expect(rainAtLeastOnceChance(0, 3)).toBe(0)
    expect(rainAtLeastOnceChance(80, 0)).toBe(0)
  })

  it('chance 100 com ao menos 1 pancada → 100%', () => {
    expect(rainAtLeastOnceChance(100, 1)).toBe(100)
    expect(rainAtLeastOnceChance(100, 4)).toBe(100)
  })

  it('uma única pancada devolve a própria chance (arredondada)', () => {
    expect(rainAtLeastOnceChance(37, 1)).toBe(37)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/weather.test.ts`
Expected: FAIL — `rainAtLeastOnceChance is not exported` / `is not a function`.

- [ ] **Step 3: Implementar o helper**

Em `src/engine/weather.ts`, logo **após** a função `rainChanceForDay` (antes da seção `// ---- Geração da agenda ----`), inserir:

```ts
/**
 * Chance (0–100) de chover ao menos UMA vez no dia, combinando a chance por pancada
 * (`perEventPercent`) com a quantidade de pancadas potenciais (`count`). Eventos independentes:
 * P(≥1) = 1 − (1 − p)^n. Usada na previsão da manhã para um número único e honesto.
 */
export function rainAtLeastOnceChance(perEventPercent: number, count: number): number {
  if (perEventPercent <= 0 || count <= 0) return 0
  const p = clamp(perEventPercent, 0, 100) / 100
  return Math.round((1 - (1 - p) ** count) * 100)
}
```

(`clamp` já está importado de `./math.ts` no topo do arquivo.)

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/weather.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os 4 novos).

- [ ] **Step 5: Commit**

```bash
git add src/engine/weather.ts src/engine/weather.test.ts
git commit -m "feat: rainAtLeastOnceChance — chance de chuva combinada por dia"
```

---

## Task 2: `DayForecastPanel` ("PREVISÃO DO DIA")

**Files:**
- Create: `src/components/screens/DayForecastPanel.tsx`
- Create: `src/components/screens/DayForecastPanel.module.css`

**Interfaces:**
- Consumes: `rainAtLeastOnceChance` (Task 1); `getCityWeather`, `cityHasRain` (`data/cityWeather.ts`); `getCity` (`data/cities.ts`); `buildWeatherSchedule` (`engine/weather.ts`); `missionsForDay`, `defensesForDay` (`engine/timeline.ts`); `hasCloudNine` (`engine/secretEffects.ts`); `CLOUD_NINE_RAIN_CHANCE_BONUS_PP` (`engine/balance.ts`); `GameState` (`engine/state.ts`).
- Produces: `export function DayForecastPanel({ state }: { state: GameState }): JSX.Element` — sempre renderiza a seção "PREVISÃO DO DIA".

- [ ] **Step 1: Criar o CSS**

Create `src/components/screens/DayForecastPanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sectionTitle {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--c-hud-muted);
}

.subTitle {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--c-hud-muted);
}

/* Bloco "Previsão do Tempo" (céu azul-água) — cresce com o nº de efeitos. */
.weather {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: linear-gradient(160deg, #e9f2ff 0%, var(--c-panel) 70%);
  border: 3px solid var(--c-panel-border);
  border-radius: var(--radius-pixel);
  padding: 12px 14px;
}

.effects {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.effect {
  display: flex;
  align-items: center;
  gap: 10px;
}

.effectIcon {
  font-size: 26px;
  line-height: 1;
}

.effectName {
  font-family: var(--font-pixel);
  font-size: 11px;
  color: var(--c-ink);
}

.effectChance {
  font-family: var(--font-text);
  font-size: 18px;
  font-weight: bold;
  color: var(--c-ink);
}

.calm {
  font-family: var(--font-text);
  font-size: 17px;
  color: var(--c-ink-muted);
}

/* Contagens do dia. */
.counts {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
}

.count {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-family: var(--font-text);
}

.count dt {
  font-size: 15px;
  color: var(--c-ink-muted);
}

.count dd {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: var(--c-ink);
}

.rocket dd {
  color: var(--c-hp-low);
  letter-spacing: 2px;
}
```

- [ ] **Step 2: Criar o componente**

Create `src/components/screens/DayForecastPanel.tsx`:

```tsx
// "Previsão do Dia" (topo da manhã): o bloco interno "Previsão do Tempo" (efeitos climáticos do dia,
// hoje só chuva; sem clima/chance zero = sol com tempo firme) somado às contagens do dia
// (missões normais, batalhas e missões Rocket — esta sempre mascarada para preservar o mistério).

import type { GameState } from '../../engine/state.ts'
import { getCity } from '../../data/cities.ts'
import { getCityWeather, type WeatherEffectKind } from '../../data/cityWeather.ts'
import { buildWeatherSchedule, rainAtLeastOnceChance } from '../../engine/weather.ts'
import { missionsForDay, defensesForDay } from '../../engine/timeline.ts'
import { hasCloudNine } from '../../engine/secretEffects.ts'
import { CLOUD_NINE_RAIN_CHANCE_BONUS_PP } from '../../engine/balance.ts'
import styles from './DayForecastPanel.module.css'

const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva' }

export function DayForecastPanel({ state }: { state: GameState }) {
  const city = getCity(state.run.cityIndex)
  const weather = getCityWeather(state.run.cityIndex)

  // Previsão = mesma função determinística que arma o dia (setupDay), com o MESMO bônus de Cloud
  // Nine — assim a % "bate com o que vai acontecer".
  const cloudNine = state.roster.filter(hasCloudNine).length
  const forecast = buildWeatherSchedule(
    state.run.seed,
    state.run.day,
    city,
    cloudNine * CLOUD_NINE_RAIN_CHANCE_BONUS_PP,
  ).forecast
  const rainChance = rainAtLeastOnceChance(forecast.rainChancePercent, forecast.potentialRainCount)

  const missions = missionsForDay(state.run.day)
  const defenses = defensesForDay(state.run.day)

  return (
    <section className={styles.panel}>
      <span className={styles.sectionTitle}>PREVISÃO DO DIA</span>

      <div className={styles.weather}>
        <span className={styles.subTitle}>PREVISÃO DO TEMPO</span>
        <div className={styles.effects}>
          {weather && rainChance > 0 ? (
            weather.effects.map((effect) =>
              effect.kind === 'rain' ? (
                <div key="rain" className={styles.effect}>
                  <span className={styles.effectIcon} aria-hidden="true">
                    {EFFECT_ICON.rain}
                  </span>
                  <span className={styles.effectName}>{EFFECT_NAME.rain}</span>
                  <span className={styles.effectChance}>{rainChance}%</span>
                </div>
              ) : null,
            )
          ) : (
            <div className={styles.effect}>
              <span className={styles.effectIcon} aria-hidden="true">
                ☀️
              </span>
              <span className={styles.calm}>Tempo firme hoje</span>
            </div>
          )}
        </div>
      </div>

      <dl className={styles.counts}>
        <div className={styles.count}>
          <dt>Quantidade de Missões</dt>
          <dd>{missions}</dd>
        </div>
        <div className={styles.count}>
          <dt>Quantidade de Batalhas</dt>
          <dd>{defenses}</dd>
        </div>
        <div className={`${styles.count} ${styles.rocket}`}>
          <dt>Quantidade de Missões Rocket</dt>
          <dd title="A previsão não revela os dias da Equipe Rocket">???</dd>
        </div>
      </dl>
    </section>
  )
}
```

- [ ] **Step 3: Checar tipos e lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (sem erros). Se `cityHasRain` aparecer como import não usado, removê-lo — o componente usa só `getCityWeather`.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/DayForecastPanel.tsx src/components/screens/DayForecastPanel.module.css
git commit -m "feat: DayForecastPanel (Previsão do Dia: clima + contagens)"
```

---

## Task 3: `TeamSummary` ("SEU TIME" compacto)

**Files:**
- Create: `src/components/screens/TeamSummary.tsx`
- Create: `src/components/screens/TeamSummary.module.css`

**Interfaces:**
- Consumes: `GameState` (`engine/state.ts`); `MAX_ROSTER_SIZE` (`engine/constants.ts`); `getSpecies` (`data/pokemon/index.ts`); `Hearts` (`components/common/Hearts.tsx`); `displayNameOf` (`components/common/naming.ts`).
- Produces: `export function TeamSummary({ state, onOpenBox }: { state: GameState; onOpenBox: () => void }): JSX.Element` — cartas compactas (sprite + nome + Nv + corações) + botão "Computador (n) ▸".

- [ ] **Step 1: Criar o CSS**

Create `src/components/screens/TeamSummary.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sectionTitle {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--c-hud-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--c-panel);
  border: 3px solid var(--c-panel-border);
  border-radius: var(--radius-pixel);
  padding: 8px 6px;
}

.sprite {
  width: 44px;
  height: 44px;
  object-fit: contain;
  image-rendering: pixelated;
}

.name {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--c-ink);
  text-align: center;
}

.level {
  font-family: var(--font-text);
  font-size: 13px;
  color: var(--c-ink-muted);
}

.ghostBtn {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--c-btn-text);
  background: var(--c-btn-bg);
  border: 2px solid var(--c-btn-border);
  border-radius: 4px;
  padding: 6px 8px;
}
```

- [ ] **Step 2: Criar o componente**

Create `src/components/screens/TeamSummary.tsx`:

```tsx
// "Seu Time" da manhã: cartas compactas (sprite + nome + Nv + corações), sem radar/HP/EXP, para
// caber ao lado da "Previsão do Dia". O botão Computador abre o PC (troca time ↔ box). Sem
// "Gerenciar" — a distribuição de pontos pendentes acontece no dia (MemberDetail).

import type { GameState } from '../../engine/state.ts'
import { MAX_ROSTER_SIZE } from '../../engine/constants.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Hearts } from '../common/Hearts.tsx'
import { displayNameOf } from '../common/naming.ts'
import styles from './TeamSummary.module.css'

export function TeamSummary({ state, onOpenBox }: { state: GameState; onOpenBox: () => void }) {
  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.sectionTitle}>
          SEU TIME ({state.roster.length}/{MAX_ROSTER_SIZE})
        </span>
        <button type="button" className={styles.ghostBtn} onClick={onOpenBox}>
          Computador ({state.box.length}) ▸
        </button>
      </div>
      <div className={styles.grid}>
        {state.roster.map((mon) => {
          const species = getSpecies(mon.speciesId)
          return (
            <div key={mon.id} className={styles.card}>
              <img className={styles.sprite} src={species.spritePath} alt={species.displayName} />
              <span className={styles.name}>{displayNameOf(mon)}</span>
              <span className={styles.level}>Nv {mon.level}</span>
              <Hearts value={mon.hearts} />
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Checar tipos e lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/TeamSummary.tsx src/components/screens/TeamSummary.module.css
git commit -m "feat: TeamSummary (time compacto da manhã + botão Computador)"
```

---

## Task 4: Integrar no `MorningScreen` (layout 2 colunas + rodapé) e remover código morto

**Files:**
- Modify: `src/components/screens/MorningScreen.tsx`
- Modify: `src/components/screens/MorningScreen.module.css`
- Delete: `src/components/screens/WeatherForecastPanel.tsx`, `src/components/screens/WeatherForecastPanel.module.css`
- Delete: `src/components/TeamPanel/TeamPanel.tsx`, `src/components/TeamPanel/TeamPanel.module.css`

**Interfaces:**
- Consumes: `DayForecastPanel` (Task 2), `TeamSummary` (Task 3).
- Produces: nada novo (tela montada).

- [ ] **Step 1: Reescrever os imports do `MorningScreen.tsx`**

No topo de `src/components/screens/MorningScreen.tsx`, **remover** estas linhas:

```tsx
import { ATTR_KEYS } from '../../types/index.ts'
import { MAX_ROSTER_SIZE, LEVEL_MAX, TOTAL_DAYS } from '../../engine/constants.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { TeamPanel } from '../TeamPanel/TeamPanel.tsx'
import { Hearts } from '../common/Hearts.tsx'
import { WeatherForecastPanel } from './WeatherForecastPanel.tsx'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
```

E **inserir** no lugar (o `getSpecies`, `LEVEL_MAX`, `ATTR_KEYS`, `effectiveAttr`, `displayNameOf`, `ATTR_SHORT_PT` continuam sendo usados pelo seletor do Rare Candy — mantê-los):

```tsx
import { ATTR_KEYS } from '../../types/index.ts'
import { LEVEL_MAX, TOTAL_DAYS } from '../../engine/constants.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { DayForecastPanel } from './DayForecastPanel.tsx'
import { TeamSummary } from './TeamSummary.tsx'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
```

> Nota: `MAX_ROSTER_SIZE`, `Hearts` e `PokemonCard` deixam de ser usados no `MorningScreen` (migraram para `TeamSummary`). `BoxPanel`, `TeamPanel` (modal de gerência) — só `TeamPanel` sai; `BoxPanel` permanece.

- [ ] **Step 2: Remover o estado `teamOpen` e simplificar**

Em `src/components/screens/MorningScreen.tsx`, na função `MorningScreen`, **remover** a linha:

```tsx
const [teamOpen, setTeamOpen] = useState(false)
```

(`boxOpen` e `candyOpen` permanecem.)

- [ ] **Step 3: Reescrever o corpo do JSX**

Substituir todo o bloco `return ( … )` por este (mantém header, mercado, ItemsBar, startBlock, BoxPanel e o seletor de Rare Candy; troca clima/time pelas duas colunas e remove o modal TeamPanel):

```tsx
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.title}>
          MANHÃ — DIA {state.run.day}/{TOTAL_DAYS}
        </span>
        <span className={styles.meta}>
          <span className={styles.gold}>$ {state.gold}</span>
          <span className={styles.starTrack} title="Estrelas de missões">
            🎯 <Stars value={state.approval.missionStars} />
          </span>
          <span className={styles.starTrack} title="Estrelas de batalhas">
            ⚔️ <Stars value={state.approval.battleStars} />
          </span>
        </span>
      </header>

      <div className={styles.topColumns}>
        <DayForecastPanel state={state} />
        <TeamSummary state={state} onOpenBox={() => setBoxOpen(true)} />
      </div>

      <section className={styles.market}>
        <span className={styles.sectionTitle}>MERCADO — 5 ITENS DO DIA</span>
        <div className={styles.shop}>
          {ballToShow && (
            <BallCard
              ball={ballToShow}
              sold={ballBoughtToday}
              gold={state.gold}
              onBuy={() => dispatch({ type: 'BUY_BALL' })}
            />
          )}
          {shop.map((item) => {
            const s = shopState(item, state)
            return (
              <div key={item.id} className={`${styles.card} ${s.sold ? styles.cardSold : ''}`}>
                <span className={styles.cardKind}>
                  {item.type === 'passive' ? 'PASSIVO' : 'CONSUMÍVEL'}
                </span>
                <img className={styles.cardImg} src={item.sprite} alt={item.name} />
                <span className={styles.cardName}>{item.name}</span>
                <span className={styles.cardEffect}>{item.description}</span>
                <button
                  type="button"
                  className={styles.buyBtn}
                  disabled={s.disabled}
                  onClick={() => buy(item)}
                  data-sound="select"
                >
                  {s.label}
                </button>
                {s.sold && <span className={styles.soldStamp}>VENDIDO</span>}
              </div>
            )
          })}
        </div>
      </section>

      <ItemsBar state={state} dispatch={dispatch} />

      {/* Aviso + começar o dia abaixo do mercado. */}
      <div className={styles.startBlock}>
        <Textbox>Prepare-se: compre itens e monte seu time. Pronto para começar o dia?</Textbox>
        <button
          type="button"
          className={styles.primary}
          onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}
        >
          Começar o dia ▶
        </button>
      </div>

      {boxOpen && <BoxPanel state={state} dispatch={dispatch} onClose={() => setBoxOpen(false)} />}

      {candyOpen && (
        <Overlay title="RARE CANDY — ESCOLHA UM POKÉMON" onClose={() => setCandyOpen(false)}>
          <p className={styles.candyHint}>O Pokémon escolhido sobe +1 nível na hora.</p>
          <div className={styles.candyList}>
            {state.roster.map((mon) => {
              const species = getSpecies(mon.speciesId)
              const atMax = mon.level >= LEVEL_MAX
              return (
                <button
                  key={mon.id}
                  type="button"
                  className={styles.candyRow}
                  disabled={atMax}
                  onClick={() => pickCandyTarget(mon.id)}
                  data-sound="select"
                >
                  <img className={styles.candyImg} src={species.spritePath} alt="" />
                  <span className={styles.candyMain}>
                    <span className={styles.candyName}>
                      {displayNameOf(mon)}
                      <span className={styles.candyLvl}>Nv {mon.level}{atMax ? ' (máx)' : ''}</span>
                    </span>
                    <span className={styles.candyAttrs}>
                      {ATTR_KEYS.map((k) => (
                        <span key={k} className={styles.candyAttr}>
                          {ATTR_SHORT_PT[k]} <b>{effectiveAttr(mon, k)}</b>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={styles.candyPlus}>{atMax ? '—' : '+1 Nv'}</span>
                </button>
              )
            })}
          </div>
        </Overlay>
      )}
    </div>
  )
```

- [ ] **Step 4: Atualizar o CSS do `MorningScreen`**

Em `src/components/screens/MorningScreen.module.css`:

(a) **Adicionar** o grid do topo (após o bloco `.screen`):

```css
/* Topo da manhã: Previsão do Dia × Seu Time lado a lado; empilha em telas estreitas. */
.topColumns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

@media (max-width: 720px) {
  .topColumns {
    grid-template-columns: 1fr;
  }
}
```

(b) **Remover** os seletores que só serviam ao time antigo e seus botões: `.team`, `.teamHead`, `.teamActions`, `.ghostBtn`, `.roster`, `.rosterCard`, `.rosterHearts`. (Manter `.market`, `.sectionTitle`, `.shop`, `.card*`, `.buyBtn`, `.startBlock`, `.primary`, `.candy*`, header e meta.)

> Nota: a regra combinada `.market, .team { … }` deve perder o `.team` — deixar só `.market { … }`.

- [ ] **Step 5: Apagar os arquivos de código morto**

```bash
git rm src/components/screens/WeatherForecastPanel.tsx src/components/screens/WeatherForecastPanel.module.css src/components/TeamPanel/TeamPanel.tsx src/components/TeamPanel/TeamPanel.module.css
```

- [ ] **Step 6: Checar tipos, lint e build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS, sem imports não usados nem referências a `WeatherForecastPanel`/`TeamPanel`. Se o lint apontar algum import remanescente não usado em `MorningScreen.tsx` (ex.: `Hearts`, `PokemonCard`, `MAX_ROSTER_SIZE`), removê-lo.

- [ ] **Step 7: Rodar a suíte completa**

Run: `npm test`
Expected: PASS (nenhum teste dependia de `WeatherForecastPanel`/`TeamPanel`; o helper novo já tem cobertura).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tela da manhã em 2 colunas (Previsão do Dia + time compacto)"
```

---

## Self-Review (autor do plano)

**Cobertura do spec:**
- "Previsão do Dia" com clima + 3 contagens → Task 2. ✓
- % de chuva combinada (`1 − (1 − p)^n`) → Task 1 (helper) + Task 2 (uso). ✓
- Sol "tempo firme" sem clima/chance 0 → Task 2 (ramo `else`). ✓
- Fidelidade Cloud Nine → Task 2 (bônus repassado). ✓
- Missões (normais) / Batalhas / Rocket "???" → Task 2. ✓
- Time compacto (sprite+nome+Nv+corações) + Computador, sem Gerenciar → Task 3 + Task 4. ✓
- Mercado + itens ativos + prepare-se/começar embaixo → Task 4. ✓
- Remoção de `WeatherForecastPanel` e `TeamPanel` → Task 4. ✓
- Testes node-only (helper puro; componentes via typecheck/lint/build) → Tasks 1–4. ✓

**Placeholders:** nenhum "TBD"/"TODO"; todo passo traz código/comando concretos. ✓

**Consistência de tipos/nomes:** `rainAtLeastOnceChance(perEventPercent, count)` definida na Task 1 e chamada com `(forecast.rainChancePercent, forecast.potentialRainCount)` na Task 2. `DayForecastPanel({ state })` e `TeamSummary({ state, onOpenBox })` batem com o uso na Task 4. ✓
