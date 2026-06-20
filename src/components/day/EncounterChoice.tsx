// Resultado da exploração (PLAN §4.5, redesign): os candidatos surgem LADO A LADO em cartas
// grandes (sem rolagem), com sprite, tipos, nota (rank) e os 6 atributos. Cada carta tem o
// botão "Capturar". Com o time cheio, um aviso indica que a captura vai para o Computador.

import { ATTR_KEYS } from '../../types/index.ts'
import type { CaptureEncounter } from '../../engine/state.ts'
import { getSpecies, pokemonSpritePath } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { pokemonRank } from '../../engine/ranking.ts'
import { getNatureEntry, NATURE_LABEL_PT } from '../../data/natures.ts'
import { previewPokemon } from '../common/preview.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { genderColor, genderSymbol } from '../common/naming.ts'
import { ATTR_SHORT_PT, RANK_COLOR } from '../common/visual.ts'
import styles from './Panels.module.css'

interface Props {
  encounter: CaptureEncounter
  /** Time cheio: a captura vai para o Computador (PC). */
  full: boolean
  onPick: (candidateIndex: number) => void
  onDismiss: () => void
}

export function EncounterChoice({ encounter, full, onPick, onDismiss }: Props) {
  const ids = encounter.candidateSpeciesIds

  return (
    <div className={styles.capture}>
      <p className={styles.hint}>
        {ids.length === 1 ? 'Apareceu' : 'Apareceram'} {ids.length} Pokémon! Escolha um para
        capturar.
      </p>

      <div className={styles.encGrid} style={{ gridTemplateColumns: `repeat(${ids.length}, 1fr)` }}>
        {ids.map((id, i) => {
          // Cada candidato tem o SEU nível (saves antigos sem candidateLevels usam o base).
          const level = encounter.candidateLevels?.[i] ?? encounter.level
          const mon = previewPokemon(id, level, {
            seed: encounter.candidateSeeds?.[i],
            searcherPerception: encounter.searcherPerception,
            shiny: encounter.candidateShiny?.[i],
          })
          const species = getSpecies(id)
          const rank = pokemonRank(mon)
          const symbol = genderSymbol(mon.gender)
          const nature = mon.nature ? getNatureEntry(mon.nature) : null
          return (
            <div key={`${id}-${i}`} className={styles.encCard}>
              <span
                className={styles.encRank}
                style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }}
                aria-label={`Rank ${rank}`}
              >
                {rank}
              </span>
              <span className={styles.encLevel}>Nv {level}</span>
              <img className={styles.encSprite} src={pokemonSpritePath(mon)} alt={species.displayName} />
              {mon.shiny && (
                <span className={styles.encShiny} aria-label="Shiny" title="Shiny">
                  ✨
                </span>
              )}
              <span className={styles.encName}>
                {species.displayName}
                {symbol && <span style={{ color: genderColor(mon.gender) }}> {symbol}</span>}
              </span>
              <span className={styles.encTypes}>
                {mon.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </span>
              {mon.nature && (
                <span className={styles.encNature}>
                  <span className={styles.encNatureName}>{NATURE_LABEL_PT[mon.nature]}</span>
                  {nature?.boosted && (
                    <span className={styles.encNatureUp}>+{ATTR_SHORT_PT[nature.boosted]}</span>
                  )}
                  {nature?.reduced && (
                    <span className={styles.encNatureDown}>−{ATTR_SHORT_PT[nature.reduced]}</span>
                  )}
                  {!nature?.boosted && !nature?.reduced && (
                    <span className={styles.encNatureNeutral}>(neutra)</span>
                  )}
                </span>
              )}
              <span className={styles.encStats}>
                {ATTR_KEYS.map((k) => {
                  const cls =
                    nature?.boosted === k
                      ? styles.encStatUp
                      : nature?.reduced === k
                        ? styles.encStatDown
                        : ''
                  return (
                    <span key={k} className={styles.encStat}>
                      <span className={styles.encStatLbl}>{ATTR_SHORT_PT[k]}</span>
                      <b className={cls || undefined}>{effectiveAttr(mon, k)}</b>
                    </span>
                  )
                })}
                <span className={`${styles.encStat} ${styles.encStatTotal}`}>
                  <span className={styles.encStatLbl}>TOT</span>
                  <b>{ATTR_KEYS.reduce((sum, k) => sum + effectiveAttr(mon, k), 0)}</b>
                </span>
              </span>
              <button
                type="button"
                className={styles.encBtn}
                onClick={() => onPick(i)}
                data-sound="select"
              >
                Capturar
              </button>
            </div>
          )
        })}
      </div>

      {full && (
        <p className={styles.warn}>
          Time cheio — o Pokémon capturado vai para o Computador 🖥️ (troque de manhã).
        </p>
      )}

      <div className={styles.captureActions}>
        <button type="button" className={styles.ghost} data-sound="deselect" onClick={onDismiss}>
          Não capturar
        </button>
      </div>
    </div>
  )
}
