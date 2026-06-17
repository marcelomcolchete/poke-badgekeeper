// Tela de FIM DE JOGO (PLAN — fim de jogo): mostra o resumo da run inteira na vitória (dia 10 com
// média ≥ 3) ou na derrota (GAMEOVER, ou dia 10 com média < 3). Reúne missões, defesas, corações,
// ouro, mortes, itens, capturados, derrotados (+ mais forte), o Destaque do Jogo e o time final.
// Vitória → "Próximo Ginásio" (começo limpo na próxima cidade); derrota → "Voltar" (menu).

import type { GameState, RunInfo } from '../../engine/state.ts'
import { buildFinalReport, type EndOutcome } from '../../engine/finalReport.ts'
import type { Rank } from '../../engine/ranking.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Hearts } from '../common/Hearts.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { MEDAL_TIER_RANK, RANK_COLOR, SECRET_MEDAL, SECRET_TIER_LABEL } from '../common/visual.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import styles from './EndGameScreen.module.css'

interface Props {
  state: GameState
  outcome: EndOutcome
  /** Volta ao menu principal (botão único na derrota / "Concluir" no último ginásio). */
  onBack: () => void
  /** Avança para a próxima cidade (começo limpo) — só na vitória com próximo ginásio disponível. */
  onNextGym?: (cityIndex: number) => void
}

/** Mensagem da derrota por GAMEOVER (mesmo texto da tela antiga) ou por não efetivar no dia 10. */
const LOSS_MESSAGE: Record<NonNullable<RunInfo['gameOverReason']>, string> = {
  gym: 'O ginásio ficou indefeso! Você não enfrentou o ataque a tempo e foi demitido na hora.',
  stars: 'Sua reputação chegou a zero. Sem estrelas e sem bater a meta, a liga encerrou seu período de testes.',
  rocket: 'A Equipe Rocket invadiu e você não despachou ninguém para detê-los! Seu período de testes acabou.',
  fainted: 'Todo o seu time foi derrotado! Sem ninguém em condições de lutar, seu período de testes foi encerrado.',
}

export function EndGameScreen({ state, outcome, onBack, onNextGym }: Props) {
  const r = buildFinalReport(state, outcome)
  const won = outcome === 'win'

  const lossText = r.reason
    ? LOSS_MESSAGE[r.reason]
    : `Período encerrado em ${r.cityName} com média ${r.avgStars.toFixed(2)}. Não foi dessa vez — a efetivação exige média ≥ 3.`

  const canAdvance = won && r.nextCityIndex !== null && onNextGym !== undefined

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={`${styles.title} ${won ? styles.win : styles.loss}`}>
          {won ? '★ VOCÊ VENCEU! ★' : 'FIM DE JOGO'}
        </span>
        <span className={styles.subtitle}>
          {won
            ? `Efetivado no Ginásio de ${r.cityName} com média ${r.avgStars.toFixed(2)}/5!`
            : lossText}
        </span>
        <div className={styles.scores}>
          <span className={styles.score}>🎯 Missões <b>{r.missionStars.toFixed(1)}</b>/5</span>
          <span className={styles.score}>⚔️ Batalhas <b>{r.battleStars.toFixed(1)}</b>/5</span>
          <span className={`${styles.avg} ${r.hired ? styles.avgGood : styles.avgBad}`}>
            Média <b>{r.avgStars.toFixed(2)}</b>/5
          </span>
        </div>
      </header>

      {/* ---- Estatísticas gerais da run ---- */}
      <div className={styles.statsGrid}>
        <Tile icon="🎯" label="Missões" value={`${r.missionsCompleted}/${r.missionsTotal}`} />
        <Tile icon="🛡️" label="Defesas" value={`${r.defensesWon}/${r.defensesTotal}`} />
        <Tile icon="♥" label="Média de coração" value={r.avgHearts.toFixed(1).replace('.', ',')} />
        <Tile icon="💰" label="Ouro ganho" value={`$${r.goldEarned}`} accent />
        <Tile icon="💀" label="Pokémon mortos" value={`${r.faints}`} danger={r.faints > 0} />
        <Tile icon="⚔️" label="Derrotados" value={`${r.defeats}`} />
      </div>

      <div className={styles.columns}>
        {/* ---- Destaque do jogo (Pokémon mais utilizado) ---- */}
        <GameMvp mvp={r.mvp} />

        <div className={styles.sideCol}>
          {/* ---- Inimigo mais forte enfrentado ---- */}
          <StrongestEnemy enemy={r.strongestEnemy} />
          {/* ---- Itens comprados ---- */}
          <PurchasedItems items={r.purchasedItems} />
        </div>
      </div>

      {/* ---- Pokémon capturados (miniaturas + rank) ---- */}
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

      {/* ---- Time final com corações ---- */}
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

      {/* ---- Ação final ---- */}
      {canAdvance ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => onNextGym!(r.nextCityIndex as number)}
        >
          Próximo Ginásio: {r.nextCityName} ▶
        </button>
      ) : won ? (
        <button type="button" className={styles.primary} onClick={onBack}>
          Concluir ▶
        </button>
      ) : (
        <button type="button" className={styles.back} onClick={onBack}>
          Voltar
        </button>
      )}
    </div>
  )
}

function GameMvp({ mvp }: { mvp: ReturnType<typeof buildFinalReport>['mvp'] }) {
  if (!mvp) {
    return (
      <div className={`${styles.mvp} ${styles.mvpEmpty}`}>
        <span className={styles.mvpBadge}>★ DESTAQUE DO JOGO</span>
        <span className={styles.empty}>Nenhum feito registrado.</span>
      </div>
    )
  }
  const species = getSpecies(mvp.pokemon.speciesId)
  const symbol = genderSymbol(mvp.pokemon.gender)
  return (
    <div className={styles.mvp}>
      <span className={styles.mvpBadge}>★ DESTAQUE DO JOGO</span>
      <div className={styles.mvpTop}>
        <RankBadge rank={mvp.rank} />
        {mvp.medalIndex > 0 && (
          <span className={styles.mvpMedal} title={`Habilidade Secreta ${SECRET_TIER_LABEL[mvp.medalIndex]}`}>
            {SECRET_MEDAL[mvp.medalIndex]}
          </span>
        )}
      </div>
      <img className={styles.mvpSprite} src={species.spritePath} alt={species.displayName} />
      <span className={styles.mvpName}>
        {displayNameOf(mvp.pokemon)}
        {symbol && (
          <span className={styles.mvpGender} style={{ color: genderColor(mvp.pokemon.gender) }}>
            {symbol}
          </span>
        )}
      </span>
      <span className={styles.mvpTypes}>
        {mvp.pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </span>
      <ol className={styles.mvpDeeds}>
        <li className={styles.mvpDeed}>
          <span>🎯</span> <b>{mvp.missions}</b> {mvp.missions === 1 ? 'missão concluída' : 'missões concluídas'}
        </li>
        <li className={styles.mvpDeed}>
          <span>⚔️</span> <b>{mvp.defeats}</b> {mvp.defeats === 1 ? 'derrotado' : 'derrotados'}
        </li>
        <li className={styles.mvpDeed}>
          <span>♥</span> <Hearts value={mvp.pokemon.hearts} />
        </li>
      </ol>
    </div>
  )
}

function StrongestEnemy({ enemy }: { enemy: ReturnType<typeof buildFinalReport>['strongestEnemy'] }) {
  if (!enemy) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelTitle}>🔥 Mais forte enfrentado</span>
        <span className={styles.empty}>Nenhum inimigo derrotado.</span>
      </div>
    )
  }
  const species = enemy.speciesId !== undefined ? getSpecies(enemy.speciesId) : null
  const medalIndex = enemy.medal ? MEDAL_TIER_RANK[enemy.medal] : 0
  return (
    <div className={styles.panel}>
      <span className={styles.panelTitle}>🔥 Mais forte enfrentado</span>
      <div className={styles.enemyRow}>
        {species && (
          <img className={styles.enemySprite} src={species.spritePath} alt={species.displayName} />
        )}
        <div className={styles.enemyInfo}>
          <span className={styles.enemyName}>{species?.displayName ?? 'Invasor'}</span>
          <span className={styles.enemyTypes}>
            {enemy.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
          <span className={styles.enemyMeta}>
            <span className={styles.enemyPower} title="Poder de Batalha">⚔️ {enemy.battle}</span>
            {medalIndex > 0 && (
              <span className={styles.enemyMedal} title={`Medalha ${SECRET_TIER_LABEL[medalIndex]}`}>
                {SECRET_MEDAL[medalIndex]} {SECRET_TIER_LABEL[medalIndex]}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function PurchasedItems({ items }: { items: ReturnType<typeof buildFinalReport>['purchasedItems'] }) {
  return (
    <div className={styles.panel}>
      <span className={styles.panelTitle}>🛒 Itens comprados</span>
      {items.length === 0 ? (
        <span className={styles.empty}>Nenhum item comprado.</span>
      ) : (
        <ul className={styles.itemList}>
          {items.map(({ item, count }) => (
            <li key={item.id} className={styles.itemRow}>
              <img className={styles.itemSprite} src={item.sprite} alt={item.name} />
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemCount}>×{count}</span>
            </li>
          ))}
        </ul>
      )}
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
}: {
  icon: string
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  const cls = [styles.tile, accent ? styles.tileAccent : '', danger ? styles.tileDanger : ''].join(' ')
  return (
    <div className={cls}>
      <span className={styles.tileIcon}>{icon}</span>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}
