// Tela de FIM DE JOGO (PLAN — fim de jogo): mostra o resumo da run inteira na vitória (dia 10 com
// média ≥ 3) ou na derrota (GAMEOVER, ou dia 10 com média < 3). Layout: uma FAIXA-HERÓI fixa no
// topo (ilustração de fundo escolhida pela média de estrelas + scrim escuro + título/notas/botões)
// e três ABAS abaixo (Estatísticas, Time, Itens) — só uma renderiza por vez, mantendo a tela curta
// e quase sem scroll. O botão "Voltar" (→ menu) está SEMPRE presente; na vitória com próximo
// ginásio, ele acompanha o "Próximo Ginásio".

import { useState } from 'react'
import type { GameState, RunInfo } from '../../engine/state.ts'
import { buildFinalReport, type EndOutcome, type PurchasedEntry } from '../../engine/finalReport.ts'
import type { Rank } from '../../engine/ranking.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Hearts } from '../common/Hearts.tsx'
import { MEDAL_TIER_RANK, RANK_COLOR, SECRET_MEDAL, SECRET_TIER_LABEL } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
import { Stars } from '../common/Stars.tsx'
import {
  BADGE_COLORS,
  BADGE_LABELS,
  CITY_SPEECHES,
  GYM_SPEECHES,
  NURSE_JOY_SPRITE,
  gymLeaderFor,
  starBucket,
} from '../../data/endgameVerdict.ts'
import styles from './EndGameScreen.module.css'

interface Props {
  state: GameState
  outcome: EndOutcome
  /** Volta ao menu principal (sempre disponível). */
  onBack: () => void
  /** Avança para a próxima cidade (começo limpo) — só na vitória com próximo ginásio disponível. */
  onNextGym?: (cityIndex: number) => void
}

type Tab = 'stats' | 'team' | 'items'

/** Mensagem da derrota por GAMEOVER (mesmo texto da tela antiga) ou por não efetivar no dia 10. */
const LOSS_MESSAGE: Record<NonNullable<RunInfo['gameOverReason']>, string> = {
  gym: 'O ginásio ficou indefeso! Você não enfrentou o ataque a tempo e foi demitido na hora.',
  stars: 'Sua reputação chegou a zero. Sem estrelas e sem bater a meta, a liga encerrou seu período de testes.',
  rocket: 'A Equipe Rocket invadiu e você não despachou ninguém para detê-los! Seu período de testes acabou.',
  fainted: 'Todo o seu time foi derrotado! Sem ninguém em condições de lutar, seu período de testes foi encerrado.',
}


const TABS: { id: Tab; label: string }[] = [
  { id: 'stats', label: 'Estatísticas' },
  { id: 'team', label: 'Time' },
  { id: 'items', label: 'Itens' },
]

export function EndGameScreen({ state, outcome, onBack, onNextGym }: Props) {
  const r = buildFinalReport(state, outcome)
  const won = outcome === 'win'
  const [tab, setTab] = useState<Tab>('stats')

  const lossText = r.reason
    ? LOSS_MESSAGE[r.reason]
    : `Período encerrado em ${r.cityName} com média ${r.avgStars.toFixed(2)}. Não foi dessa vez — a efetivação exige média ≥ 3.`

  const canAdvance = won && r.nextCityIndex !== null && onNextGym !== undefined

  return (
    <div className={styles.screen}>
      {/* ---- Faixa-herói: 3 colunas (Ginásio · Cidade · Veredito) sobre o mapa da cidade ---- */}
      <header
        className={`${styles.hero} ${won ? styles.heroWin : styles.heroLoss}`}
        style={{ backgroundImage: `url('/maps/kanto/${state.run.cityIndex + 1}.png')` }}
      >
        <div className={styles.heroScrim} />
        <div className={styles.heroColumns}>
          <PerformanceColumn
            heading="Ginásio"
            persona={gymLeaderFor(state.run.cityIndex)}
            stars={r.battleStars}
            speeches={GYM_SPEECHES}
          />
          <PerformanceColumn
            heading="Cidade"
            persona={{ name: 'Enfermeira Joy', sprite: NURSE_JOY_SPRITE }}
            stars={r.missionStars}
            speeches={CITY_SPEECHES}
          />
          <VerdictColumn
            won={won}
            report={r}
            lossText={lossText}
            canAdvance={canAdvance}
            onBack={onBack}
            onNextGym={onNextGym}
          />
        </div>
      </header>

      {/* ---- Abas ---- */}
      <div className={styles.tabBar} role="tablist" aria-label="Resumo da run">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabPanel} role="tabpanel">
        {tab === 'stats' && <StatsTab r={r} />}
        {tab === 'team' && <TeamTab r={r} />}
        {tab === 'items' && <ItemsTab items={r.purchasedItems} />}
      </div>
    </div>
  )
}

/** Coluna de desempenho (Ginásio ou Cidade): foto da persona + selo + estrelas + fala do bucket. */
function PerformanceColumn({
  heading,
  persona,
  stars,
  speeches,
}: {
  heading: string
  persona: { name: string; sprite: string }
  stars: number
  speeches: readonly string[]
}) {
  const bucket = starBucket(stars)
  return (
    <section className={styles.col}>
      <span className={styles.colHeading}>{heading}</span>
      <img className={styles.persona} src={persona.sprite} alt={persona.name} />
      <span className={styles.personaName}>{persona.name}</span>
      <span
        className={styles.badge}
        style={{ backgroundColor: BADGE_COLORS[bucket], borderColor: BADGE_COLORS[bucket] }}
      >
        {BADGE_LABELS[bucket]}
      </span>
      <span className={styles.colStars}>
        <Stars value={stars} />
        <span className={styles.colStarsNum}>{stars.toFixed(1).replace('.', ',')}/5</span>
      </span>
      <p className={styles.speech}>{speeches[bucket]}</p>
    </section>
  )
}

/** Coluna do veredito: desfecho da run, aprovado/reprovado, média, motivo e botões. */
function VerdictColumn({
  won,
  report,
  lossText,
  canAdvance,
  onBack,
  onNextGym,
}: {
  won: boolean
  report: Report
  lossText: string
  canAdvance: boolean
  onBack: () => void
  onNextGym?: (cityIndex: number) => void
}) {
  return (
    <section className={`${styles.col} ${styles.verdictCol}`}>
      <span className={`${styles.title} ${won ? styles.win : styles.loss}`}>
        {won ? '★ VOCÊ VENCEU! ★' : 'FIM DE JOGO'}
      </span>
      <span className={`${styles.avg} ${report.hired ? styles.avgGood : styles.avgBad}`}>
        {report.hired ? 'APROVADO' : 'REPROVADO'}
      </span>
      <span className={styles.avgNum}>
        Média {report.avgStars.toFixed(2).replace('.', ',')}/5
      </span>
      <p className={styles.verdictText}>
        {won
          ? `Efetivado no Ginásio de ${report.cityName} com média ${report.avgStars
              .toFixed(2)
              .replace('.', ',')}/5!`
          : lossText}
      </p>
      <div className={styles.actions}>
        {canAdvance && (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onNextGym!(report.nextCityIndex as number)}
          >
            Próximo Ginásio: {report.nextCityName} ▶
          </button>
        )}
        <button type="button" className={styles.back} onClick={onBack}>
          Voltar
        </button>
      </div>
    </section>
  )
}

type Report = ReturnType<typeof buildFinalReport>

/* ---------------------------------- Abas ----------------------------------- */

/** Porcentagem concluída (0 quando não há total) — "10/20" → 50%. */
function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

function StatsTab({ r }: { r: Report }) {
  return (
    <div className={styles.stack}>
      <div className={styles.statsGrid}>
        <Tile
          icon="🎯"
          label="Missões"
          value={`${r.missionsCompleted}/${r.missionsTotal}`}
          pct={pct(r.missionsCompleted, r.missionsTotal)}
        />
        <Tile
          icon="🛡️"
          label="Defesas"
          value={`${r.defensesWon}/${r.defensesTotal}`}
          pct={pct(r.defensesWon, r.defensesTotal)}
        />
        <Tile icon="♥" label="Média de coração" value={r.avgHearts.toFixed(1).replace('.', ',')} heart />
        <Tile icon="💰" label="Ouro ganho" value={`$${r.goldEarned}`} accent />
        <Tile icon="💀" label="Pokémon mortos" value={`${r.faints}`} danger={r.faints > 0} />
        <Tile icon="⚔️" label="Derrotados" value={`${r.defeats}`} />
      </div>
      <div className={styles.columns}>
        <TopTeam team={r.topTeam} />
        <EnemiesFaced enemies={r.strongestEnemies} tormentor={r.tormentor} />
      </div>
    </div>
  )
}

function TeamTab({ r }: { r: Report }) {
  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <span className={styles.panelTitle}>⚪ Capturados — {r.capturedCount}</span>
        {r.captured.length === 0 ? (
          <span className={styles.empty}>Nenhum Pokémon em mãos.</span>
        ) : (
          <ul className={styles.miniGrid}>
            {r.captured.map((c) => (
              <li key={c.pokemon.id} className={styles.miniCell}>
                <RankBadge rank={c.rank} small />
                <img
                  className={styles.miniSprite}
                  src={getSpecies(c.pokemon.speciesId).spritePath}
                  alt={getSpecies(c.pokemon.speciesId).displayName}
                  title={`${displayNameOf(c.pokemon)} — Rank ${c.rank}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.panel}>
        <span className={styles.panelTitle}>👥 Time final</span>
        <ul className={styles.teamGrid}>
          {r.finalTeam.map((m) => (
            <li key={m.pokemon.id} className={styles.teamMember}>
              <RankBadge rank={m.rank} small />
              <img
                className={styles.teamSprite}
                src={getSpecies(m.pokemon.speciesId).spritePath}
                alt={getSpecies(m.pokemon.speciesId).displayName}
              />
              <span className={styles.teamName}>{displayNameOf(m.pokemon)}</span>
              <Hearts value={m.pokemon.hearts} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const ITEM_GROUPS: { title: string; category: PurchasedEntry['category'] }[] = [
  { title: '⚪ Pokébolas', category: 'ball' },
  { title: '🧪 Cura / Revive', category: 'healing' },
  { title: '🎒 Outros', category: 'other' },
]

function ItemsTab({ items }: { items: PurchasedEntry[] }) {
  if (items.length === 0) {
    return (
      <section className={styles.panel}>
        <span className={styles.panelTitle}>🛒 Itens comprados</span>
        <span className={styles.empty}>Nenhum item comprado.</span>
      </section>
    )
  }
  return (
    <div className={styles.itemGroups}>
      {ITEM_GROUPS.map(({ title, category }) => {
        const group = items.filter((i) => i.category === category)
        if (group.length === 0) return null
        return (
          <section key={category} className={styles.panel}>
            <span className={styles.panelTitle}>{title}</span>
            <ul className={styles.itemList}>
              {group.map((entry) => (
                <li key={entry.id} className={styles.itemRow}>
                  <img className={styles.itemSprite} src={entry.sprite} alt={entry.name} />
                  <span className={styles.itemName}>{entry.name}</span>
                  <span className={styles.itemCount}>×{entry.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/* ------------------------------- Subcomponentes ------------------------------ */

function TopTeam({ team }: { team: Report['topTeam'] }) {
  return (
    <div className={styles.panel}>
      <span className={styles.panelTitle}>🏅 Top 3 do time</span>
      {team.length === 0 ? (
        <span className={styles.empty}>Nenhum feito registrado.</span>
      ) : (
        <ol className={styles.topList}>
          {team.map((m, i) => {
            const species = getSpecies(m.pokemon.speciesId)
            return (
              <li key={m.pokemon.id} className={styles.topRow}>
                <span className={styles.topPos}>{i + 1}</span>
                <img className={styles.topSprite} src={species.spritePath} alt={species.displayName} />
                <div className={styles.topInfo}>
                  <span className={styles.topName}>
                    {displayNameOf(m.pokemon)}
                    {m.medalIndex > 0 && (
                      <span
                        className={styles.topMedal}
                        title={`Habilidade Secreta ${SECRET_TIER_LABEL[m.medalIndex]}`}
                      >
                        {SECRET_MEDAL[m.medalIndex]}
                      </span>
                    )}
                  </span>
                  <span className={styles.topDeeds}>
                    🎯 <b>{m.missions}</b> · ⚔️ <b>{m.defeats}</b>
                  </span>
                </div>
                <RankBadge rank={m.rank} />
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function EnemiesFaced({
  enemies,
  tormentor,
}: {
  enemies: Report['strongestEnemies']
  tormentor: Report['tormentor']
}) {
  return (
    <div className={styles.panel}>
      <span className={styles.panelTitle}>⚔️ Pokémons enfrentados</span>
      {enemies.length === 0 ? (
        <span className={styles.empty}>Nenhum inimigo enfrentado.</span>
      ) : (
        <ol className={styles.topList}>
          {enemies.map((e, i) => {
            const species = e.speciesId !== undefined ? getSpecies(e.speciesId) : null
            const medalIndex = e.medal ? MEDAL_TIER_RANK[e.medal] : 0
            return (
              <li key={i} className={styles.topRow}>
                <span className={styles.topPos}>{i + 1}</span>
                {species ? (
                  <img className={styles.enemyMini} src={species.spritePath} alt={species.displayName} />
                ) : (
                  <span className={styles.enemyMini} />
                )}
                <div className={styles.topInfo}>
                  <span className={styles.topName}>{species?.displayName ?? 'Invasor'}</span>
                  <span className={styles.enemyMeta}>
                    <span className={styles.enemyPower} title="Poder de Batalha">⚔️ {e.battle}</span>
                    {medalIndex > 0 && (
                      <span className={styles.enemyMedal} title={`Medalha ${SECRET_TIER_LABEL[medalIndex]}`}>
                        {SECRET_MEDAL[medalIndex]}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {tormentor && <Tormentor tormentor={tormentor} />}
    </div>
  )
}

function Tormentor({ tormentor }: { tormentor: NonNullable<Report['tormentor']> }) {
  const species = getSpecies(tormentor.speciesId)
  return (
    <div className={styles.tormentor}>
      <span className={styles.tormentorBadge}>🔪 CARRASCO</span>
      <img className={styles.enemyMini} src={species.spritePath} alt={species.displayName} />
      <div className={styles.topInfo}>
        <span className={styles.topName}>{species.displayName}</span>
        <span className={styles.tormentorMeta}>
          derrotou seu time <b>{tormentor.count}</b>{tormentor.count === 1 ? ' vez' : ' vezes'}
        </span>
      </div>
    </div>
  )
}

function RankBadge({ rank, small = false }: { rank: Rank; small?: boolean }) {
  return (
    <span
      className={`${styles.rankBadge} ${small ? styles.rankSmall : ''}`}
      style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}

function Tile({
  icon,
  label,
  value,
  accent = false,
  danger = false,
  heart = false,
  pct,
}: {
  icon: string
  label: string
  value: string
  accent?: boolean
  danger?: boolean
  /** Pinta o ícone de coração de vermelho (visível sobre o painel claro). */
  heart?: boolean
  /** Porcentagem concluída exibida ao lado do valor (ex.: 50%). */
  pct?: number
}) {
  const cls = [styles.tile, accent ? styles.tileAccent : '', danger ? styles.tileDanger : ''].join(' ')
  return (
    <div className={cls}>
      <span className={`${styles.tileIcon} ${heart ? styles.tileHeart : ''}`}>{icon}</span>
      <span className={styles.tileValueRow}>
        <span className={styles.tileValue}>{value}</span>
        {pct !== undefined && <span className={styles.tilePct}>{pct}%</span>}
      </span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}
