// Área de Captura (PLAN §4.5, redesign): escolher QUEM explora (cartas enxutas com AGI/PER/INT
// + Pokédex da área em silhuetas), acompanhar a busca e resolver o encontro (candidatos lado a
// lado). Com o time cheio, a captura vai automaticamente para o Computador (PC) — sem descarte.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { rosterIsFull } from '../../engine/capture.ts'
import { Overlay } from '../common/Overlay.tsx'
import { RenameModal } from './RenameModal.tsx'
import { ExplorerPick } from './ExplorerPick.tsx'
import { CapturePokedex } from './CapturePokedex.tsx'
import { EncounterChoice } from './EncounterChoice.tsx'
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
  // Após capturar, abre o modal de apelido para o recém-pego (pode estar no time ou no PC).
  const [awaitingRename, setAwaitingRename] = useState(false)
  const lastCapturedId = state.today.capturedIds.at(-1) ?? null
  const justCaught = awaitingRename
    ? [...state.roster, ...state.box].find((p) => p.id === lastCapturedId) ?? null
    : null
  const wentToBox = justCaught ? state.box.some((p) => p.id === justCaught.id) : false

  if (justCaught) {
    return (
      <RenameModal
        pokemon={justCaught}
        dispatch={dispatch}
        note={
          wentToBox
            ? 'Seu time estava cheio — ele foi enviado ao Computador. Troque pela manhã.'
            : undefined
        }
        onDone={() => {
          setAwaitingRename(false)
          onClose()
        }}
      />
    )
  }

  const caught = new Set<number>([
    ...state.caughtSpecies,
    ...state.roster.map((p) => p.speciesId),
    ...state.box.map((p) => p.speciesId),
  ])

  return (
    <Overlay title="ÁREA DE CAPTURA" onClose={onClose} wide>
      {encounter ? (
        <EncounterChoice
          encounter={encounter}
          full={full}
          onPick={(candidateIndex) => {
            dispatch({ type: 'CAPTURE_PICK', searcherId: encounter.searcherId, candidateIndex })
            setAwaitingRename(true)
          }}
          onDismiss={() => {
            dispatch({ type: 'CAPTURE_DISMISS', searcherId: encounter.searcherId })
            onClose()
          }}
        />
      ) : searching ? (
        <p className={styles.hint}>A caminho / explorando… aguarde o encontro surgir aqui.</p>
      ) : (
        <div className={styles.capture}>
          <p className={styles.hint}>
            Quem vai explorar? Maior <b>Percepção</b> encontra mais rápido.
          </p>
          <div className={styles.explorerGrid}>
            {state.roster.map((mon) => (
              <ExplorerPick
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
          <CapturePokedex types={state.gym.types} caught={caught} />
        </div>
      )}
    </Overlay>
  )
}
