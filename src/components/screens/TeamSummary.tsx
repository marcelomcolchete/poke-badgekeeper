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
