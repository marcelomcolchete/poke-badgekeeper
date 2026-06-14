// Coluna fixa à esquerda na fase Dia: visão geral do time sempre visível — foto, nome,
// nível, tipos, HP, raridade, EXP e os 6 atributos por escrito, além do que cada Pokémon
// está fazendo agora. Quem volta de uma missão cumprida que vai SUBIR DE NÍVEL brilha em
// dourado (o level-up só "aparece" ao chegar ao ginásio). Clicar abre o detalhe.

import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { getMissionTemplate } from '../../data/missionTemplates.ts'
import { ATTR_MAX, LEVEL_MAX } from '../../engine/constants.ts'
import { MISSION_XP_REWARD } from '../../engine/balance.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { addXp, pendingPoints, xpToNext } from '../../engine/leveling.ts'
import { HpBar } from '../common/HpBar.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import {
  ATTR_LABEL_PT,
  RARITY_COLOR,
  RARITY_LABEL_PT,
  STATUS_COLOR,
  STATUS_LABEL_PT,
} from '../common/visual.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import styles from './TeamSidebar.module.css'

/** Texto contextual do que o Pokémon está fazendo (missão pelo nome, defesa, caça…). */
function activityLabel(state: GameState, mon: Pokemon): string {
  const base = STATUS_LABEL_PT[mon.status]
  if (mon.status === 'defending') return 'Defendendo ginásio'
  if (state.captureSearches.some((c) => c.searcherId === mon.id)) return 'Caçando na grama'
  if (state.captureReturns.some((r) => r.searcherId === mon.id)) return 'Voltando da caça'
  const mission = state.missions.find(
    (m) => m.teamIds.includes(mon.id) && m.status !== 'resolved',
  )
  if (mission) return `${base}: ${getMissionTemplate(mission.templateId).name}`
  return base
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
  return addXp(mon, MISSION_XP_REWARD).levelsGained > 0
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
        {state.roster.map((mon) => {
          const species = getSpecies(mon.speciesId)
          const pending = pendingPoints(mon)
          const fainted = mon.currentHp <= 0
          const willLevelUp = willLevelUpOnReturn(state, mon)
          const atMax = mon.level >= LEVEL_MAX
          const xpNeeded = xpToNext(mon.level)
          const xpPct = atMax ? 100 : Math.min(100, (mon.xp / xpNeeded) * 100)
          const memberClass = [
            styles.member,
            fainted ? styles.faintedMember : '',
            willLevelUp ? styles.willLevelUp : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={mon.id}>
              <button type="button" className={memberClass} onClick={() => onSelect(mon.id)}>
                <div className={styles.top}>
                  <span className={styles.avatar}>
                    <img src={species.spritePath} alt={species.displayName} draggable={false} />
                    {pending > 0 && <span className={styles.badge}>+{pending}</span>}
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

                    <HpBar current={mon.currentHp} max={mon.maxHp} light />
                  </span>
                </div>

                {/* EXP — barra + valor por escrito. */}
                <div className={styles.expRow}>
                  <span className={styles.expTrack}>
                    <span className={styles.expFill} style={{ width: `${xpPct}%` }} />
                  </span>
                  <span className={styles.expText}>
                    {atMax ? 'EXP máx.' : `EXP ${mon.xp}/${xpNeeded}`}
                  </span>
                </div>

                {/* Atributos por escrito (6 eixos). */}
                <dl className={styles.attrs}>
                  {ATTR_KEYS.map((k) => {
                    const val = effectiveAttr(mon, k)
                    return (
                      <div key={k} className={styles.attr}>
                        <dt className={styles.attrName}>{ATTR_LABEL_PT[k]}</dt>
                        <dd
                          className={styles.attrVal}
                          style={val >= ATTR_MAX ? { color: '#e0a020', fontWeight: 'bold' } : undefined}
                        >
                          {val}
                        </dd>
                      </div>
                    )
                  })}
                </dl>

                <span className={styles.status}>
                  <span className={styles.dot} style={{ background: STATUS_COLOR[mon.status] }} />
                  {activityLabel(state, mon)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
