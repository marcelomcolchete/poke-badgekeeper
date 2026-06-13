// Captura (PLAN §4.5): escolher quem procura, acompanhar a busca e resolver o
// encontro (capturar 1 / trazer de volta / seguir procurando).

import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { rosterIsFull } from '../../engine/capture.ts'
import { MAX_ROSTER_SIZE } from '../../engine/constants.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { previewPokemon } from '../common/preview.ts'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  spotIndex: number
  onClose: () => void
}

export function CapturePanel({ state, dispatch, spotIndex, onClose }: Props) {
  const encounter = state.encounters.find((e) => e.spotIndex === spotIndex)
  const searching = state.captureSearches.some((c) => c.spotIndex === spotIndex)
  const full = rosterIsFull(state.roster)

  return (
    <Overlay title="ÁREA DE CAPTURA" onClose={onClose}>
      {encounter ? (
        <div className={styles.capture}>
          <p className={styles.hint}>
            {encounter.candidateSpeciesIds.length === 1 ? 'Apareceu' : 'Apareceram'}{' '}
            {encounter.candidateSpeciesIds.length} Pokémon (nível {encounter.level})! Capture um ou
            continue explorando.
          </p>
          <div className={styles.picker}>
            {encounter.candidateSpeciesIds.map((id, i) => (
              <PokemonCard
                key={`${id}-${i}`}
                pokemon={previewPokemon(id, encounter.level)}
                disabled={full}
                onClick={
                  full
                    ? undefined
                    : () => {
                        dispatch({ type: 'CAPTURE_PICK', searcherId: encounter.searcherId, speciesId: id })
                        onClose()
                      }
                }
              />
            ))}
          </div>
          {full && (
            <p className={styles.warn}>Roster cheio ({MAX_ROSTER_SIZE}) — liberte espaço para capturar.</p>
          )}
          <div className={styles.captureActions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                dispatch({ type: 'CAPTURE_DISMISS', searcherId: encounter.searcherId })
                onClose()
              }}
            >
              Não capturar
            </button>
          </div>
        </div>
      ) : searching ? (
        <p className={styles.hint}>A caminho / explorando… aguarde o encontro surgir aqui.</p>
      ) : full ? (
        <p className={styles.warn}>
          Roster cheio ({MAX_ROSTER_SIZE}) — captura indisponível até liberar espaço.
        </p>
      ) : (
        <div className={styles.capture}>
          <p className={styles.hint}>Quem vai explorar? Maior Percepção encontra mais rápido.</p>
          <div className={styles.picker}>
            {state.roster.map((mon) => (
              <PokemonCard
                key={mon.id}
                pokemon={mon}
                disabled={mon.status !== 'idle'}
                onClick={
                  mon.status === 'idle'
                    ? () => {
                        dispatch({ type: 'START_SEARCH', searcherId: mon.id, spotIndex })
                        onClose()
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </Overlay>
  )
}
