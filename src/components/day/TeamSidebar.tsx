// Coluna fixa à esquerda na fase Dia: visão geral do time sempre visível — foto, nome,
// nível, tipos, HP, raridade, EXP e os 6 atributos por escrito, além do que cada Pokémon
// está fazendo agora. Quem volta de uma missão cumprida que vai SUBIR DE NÍVEL brilha em
// dourado (o level-up só "aparece" ao chegar ao ginásio). Clicar abre o detalhe.

import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { getMissionTemplate } from '../../data/missionTemplates.ts'
import { secretAbilityFor, secretLevelOf, SECRET_TIER_LABEL } from '../../data/secretAbilities.ts'
import { ATTR_MAX, ATTR_PER_POINT, LEVEL_MAX } from '../../engine/constants.ts'
import { effectiveAttr, perPointGain } from '../../engine/attributes.ts'
import { addXp, pendingPoints, xpToNext } from '../../engine/leveling.ts'
import { pokemonRank } from '../../engine/ranking.ts'
import { isAvailable, sortRoster } from '../../engine/roster.ts'
import { HpBar } from '../common/HpBar.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import {
  ATTR_SHORT_PT,
  RANK_COLOR,
  RARITY_COLOR,
  RARITY_LABEL_PT,
  SECRET_MEDAL,
  STATUS_LABEL_PT,
} from '../common/visual.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import styles from './TeamSidebar.module.css'

/** Cor da faixa por tipo de atividade (cada coisa que o Pokémon faz tem a sua). */
const ACTIVITY_COLOR = {
  mission: '#f0c020', // Em missão → amarelo
  traveling: '#a05fd0', // A caminho → roxo
  hunting: '#5fbf6f', // Explorando/caçando → verde
  returning: '#57a6dc', // Voltando → azul
  defending: '#e0683c', // Defendendo → laranja-vermelho
  center: '#9b6cff', // No Centro → lilás
  other: '#8a8f9c', // fallback
} as const

/** Cor da faixa de Pokémon derrotado (vermelho-escuro acinzentado, com caveira). */
const FAINTED_COLOR = '#8a3a3a'

/**
 * O que o Pokémon está fazendo agora: rótulo contextual + cor da faixa. Cada atividade
 * tem cor própria (missão amarelo, a caminho roxo, explorando verde, etc.).
 */
function activityInfo(state: GameState, mon: Pokemon): { label: string; color: string } {
  if (mon.status === 'defending') {
    return { label: 'Defendendo ginásio', color: ACTIVITY_COLOR.defending }
  }
  if (state.captureSearches.some((c) => c.searcherId === mon.id)) {
    return { label: 'Explorando a grama', color: ACTIVITY_COLOR.hunting }
  }
  if (state.captureReturns.some((r) => r.searcherId === mon.id)) {
    return { label: 'Voltando da caça', color: ACTIVITY_COLOR.hunting }
  }
  if (mon.status === 'atCenter') {
    return { label: STATUS_LABEL_PT.atCenter, color: ACTIVITY_COLOR.center }
  }
  const base = STATUS_LABEL_PT[mon.status]
  const mission = state.missions.find(
    (m) => m.teamIds.includes(mon.id) && m.status !== 'resolved',
  )
  if (mission) {
    const label = `${base}: ${getMissionTemplate(mission.templateId).name}`
    const color =
      mon.status === 'traveling'
        ? ACTIVITY_COLOR.traveling
        : mon.status === 'returning'
          ? ACTIVITY_COLOR.returning
          : ACTIVITY_COLOR.mission
    return { label, color }
  }
  return { label: base, color: ACTIVITY_COLOR.other }
}

/**
 * Segundos (de jogo) até o Pokémon voltar a ficar disponível, ou null quando não dá para
 * estimar (caça ainda procurando, indisponível sem marco de tempo). Usado na faixa diagonal.
 */
function availableInSeconds(state: GameState, mon: Pokemon): number | null {
  const now = state.clock.dayElapsedMs
  const ret = state.captureReturns.find((r) => r.searcherId === mon.id)
  if (ret) return Math.max(0, Math.round((ret.arriveAtMs - now) / 1000))
  // Caça em andamento: o retorno só é agendado após o encontro — sem ETA confiável.
  if (state.captureSearches.some((c) => c.searcherId === mon.id)) return null
  const mission = state.missions.find(
    (m) => m.teamIds.includes(mon.id) && m.status !== 'resolved' && m.returnEndsAtMs !== null,
  )
  if (mission && mission.returnEndsAtMs !== null) {
    return Math.max(0, Math.round((mission.returnEndsAtMs - now) / 1000))
  }
  return null
}

/**
 * O Pokémon está voltando de uma missão CUMPRIDA cujo XP vai fazê-lo subir de nível?
 * O XP só é aplicado ao chegar ao ginásio — aqui antecipamos o brilho de "vai subir".
 */
function willLevelUpOnReturn(state: GameState, mon: Pokemon): boolean {
  if (mon.status !== 'returning') return false
  const mission = state.missions.find(
    (m) => m.teamIds.includes(mon.id) && m.status === 'returning' && m.result === 'success',
  )
  if (!mission) return false
  // XP que ele vai receber ao chegar = seu share do pool da missão (dividido pelo time).
  return addXp(mon, mission.xpAwards?.[mon.id] ?? 0).levelsGained > 0
}

interface Props {
  state: GameState
  onSelect: (pokemonId: string) => void
}

export function TeamSidebar({ state, onSelect }: Props) {
  return (
    <aside className={styles.panel} aria-label="Seu time">
      <header className={styles.head}>
        <span className={styles.title}>TIME</span>
        <span className={styles.count}>{state.roster.length}</span>
      </header>

      <ul className={styles.list}>
        {sortRoster(state.roster).map((mon) => {
          const species = getSpecies(mon.speciesId)
          const pending = pendingPoints(mon)
          const fainted = mon.currentHp <= 0
          const rank = pokemonRank(mon)
          const willLevelUp = willLevelUpOnReturn(state, mon)
          // Habilidade Secreta desbloqueada no indivíduo → medalha do nível + tooltip.
          const secret = secretAbilityFor(mon.speciesId)
          const secretLevel = secretLevelOf(mon)
          const secretActive = secretLevel > 0
          const secretTip =
            secretActive && secret
              ? `Habilidade Secreta ATIVA: ${secret.name} (${SECRET_TIER_LABEL[secretLevel]})`
              : undefined
          const atMax = mon.level >= LEVEL_MAX
          const xpNeeded = xpToNext(mon.level)
          const xpPct = atMax ? 100 : Math.min(100, (mon.xp / xpNeeded) * 100)
          // Ocupado = não está livre e não está desmaiado: ganha a faixa diagonal
          // dizendo o que faz e quando volta a ficar disponível.
          const busy = !isAvailable(mon) && !fainted
          const etaS = busy ? availableInSeconds(state, mon) : null
          const activity = busy ? activityInfo(state, mon) : null
          const memberClass = [
            styles.member,
            fainted ? styles.faintedMember : '',
            busy ? styles.busyMember : '',
            willLevelUp ? styles.willLevelUp : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={mon.id}>
              <button
                type="button"
                className={memberClass}
                onClick={() => onSelect(mon.id)}
                title={secretTip}
              >
                <div className={styles.top}>
                  <span className={styles.avatar}>
                    <img src={species.spritePath} alt={species.displayName} draggable={false} />
                    <span
                      className={styles.rank}
                      style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }}
                      aria-label={`Rank ${rank}`}
                    >
                      {rank}
                    </span>
                    {pending > 0 && <span className={styles.badge}>+{pending}</span>}
                    {secretActive && secret && (
                      <span className={styles.secretBadge} title={secretTip} aria-label={secretTip}>
                        {SECRET_MEDAL[secretLevel]}
                      </span>
                    )}
                    {willLevelUp && (
                      <span className={styles.levelTag} aria-label="Vai subir de nível">
                        ↑Nv
                      </span>
                    )}
                  </span>

                  <span className={styles.info}>
                    <span className={styles.nameRow}>
                      <span className={styles.name}>
                        {displayNameOf(mon)}
                        {genderSymbol(mon.gender) && (
                          <span
                            className={styles.gender}
                            style={{ color: genderColor(mon.gender) }}
                          >
                            {genderSymbol(mon.gender)}
                          </span>
                        )}
                      </span>
                      <span className={styles.lvl}>Nv {mon.level}</span>
                    </span>

                    <span className={styles.subRow}>
                      <span className={styles.types}>
                        {mon.types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </span>
                      <span
                        className={styles.rarity}
                        style={{ color: RARITY_COLOR[species.rarity] }}
                      >
                        {RARITY_LABEL_PT[species.rarity]}
                      </span>
                    </span>
                  </span>
                </div>

                {/* HP (esquerda) + EXP (direita) na mesma linha — economiza espaço. */}
                <div className={styles.vitals}>
                  <span className={styles.vitalHp}>
                    <HpBar current={mon.currentHp} max={mon.maxHp} light />
                  </span>
                  <span className={styles.expRow}>
                    <span className={styles.expTrack}>
                      <span className={styles.expFill} style={{ width: `${xpPct}%` }} />
                    </span>
                    <span className={styles.expText}>
                      {atMax ? 'EXP máx.' : `EXP ${mon.xp}/${xpNeeded}`}
                    </span>
                  </span>
                </div>

                {/* Atributos: 6 eixos numa linha (abreviados). Dourado = maximizado;
                    verde "+" = favorecido / vermelho "−" = penalizado pela natureza. */}
                <dl className={styles.attrs}>
                  {ATTR_KEYS.map((k) => {
                    const val = effectiveAttr(mon, k)
                    const gain = perPointGain(mon, k)
                    const boosted = gain > ATTR_PER_POINT
                    const reduced = gain < ATTR_PER_POINT
                    // Prioridade: maximizado (dourado) > natureza (verde favorecido / vermelho penalizado).
                    const color =
                      val >= ATTR_MAX
                        ? '#e0a020'
                        : boosted
                          ? '#6fd47a'
                          : reduced
                            ? '#ff8a8a'
                            : undefined
                    const sign = val >= ATTR_MAX ? '' : boosted ? '+' : reduced ? '−' : ''
                    return (
                      <div key={k} className={styles.attr}>
                        <dt className={styles.attrName} style={color ? { color } : undefined}>
                          {ATTR_SHORT_PT[k]}
                          {sign}
                        </dt>
                        <dd
                          className={styles.attrVal}
                          style={color ? { color, fontWeight: 'bold' } : undefined}
                        >
                          {val}
                        </dd>
                      </div>
                    )
                  })}
                </dl>

                {fainted ? (
                  <span className={styles.busyOverlay}>
                    <span
                      className={styles.busyBanner}
                      style={{
                        background: `linear-gradient(180deg, ${FAINTED_COLOR}, color-mix(in srgb, ${FAINTED_COLOR} 65%, #000))`,
                      }}
                    >
                      <span className={styles.busyText}>💀 Derrotado</span>
                      <span className={styles.busyEta}>Sem condições de lutar</span>
                    </span>
                  </span>
                ) : (
                  busy &&
                  activity && (
                    <span className={styles.busyOverlay}>
                      <span
                        className={styles.busyBanner}
                        style={{
                          background: `linear-gradient(180deg, ${activity.color}, color-mix(in srgb, ${activity.color} 70%, #000))`,
                        }}
                      >
                        <span className={styles.busyText}>{activity.label}</span>
                        <span className={styles.busyEta}>
                          {etaS !== null ? `Disponível em ~${etaS}s` : 'Indisponível'}
                        </span>
                      </span>
                    </span>
                  )
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
