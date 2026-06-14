// Coluna fixa à esquerda na fase Dia: visão geral do time sempre visível —
// foto, nome, nível, tipos, HP e o que cada Pokémon está fazendo agora.
// Clicar num membro abre o detalhe (radar + Potion/Revive + distribuir pontos).

import type { GameState } from '../../engine/state.ts'
import type { Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { getMissionTemplate } from '../../data/missionTemplates.ts'
import { pendingPoints } from '../../engine/leveling.ts'
import { HpBar } from '../common/HpBar.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { STATUS_COLOR, STATUS_LABEL_PT } from '../common/visual.ts'
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
          return (
            <li key={mon.id}>
              <button
                type="button"
                className={`${styles.member} ${fainted ? styles.faintedMember : ''}`}
                onClick={() => onSelect(mon.id)}
              >
                <span className={styles.avatar}>
                  <img src={species.spritePath} alt={species.displayName} draggable={false} />
                  {pending > 0 && <span className={styles.badge}>+{pending}</span>}
                </span>

                <span className={styles.info}>
                  <span className={styles.nameRow}>
                    <span className={styles.name}>
                      {displayNameOf(mon)}
                      {genderSymbol(mon.gender) && (
                        <span className={styles.gender} style={{ color: genderColor(mon.gender) }}>
                          {genderSymbol(mon.gender)}
                        </span>
                      )}
                    </span>
                    <span className={styles.lvl}>Nv {mon.level}</span>
                  </span>

                  <span className={styles.types}>
                    {mon.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </span>

                  <HpBar current={mon.currentHp} max={mon.maxHp} light />

                  <span className={styles.status}>
                    <span className={styles.dot} style={{ background: STATUS_COLOR[mon.status] }} />
                    {activityLabel(state, mon)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
