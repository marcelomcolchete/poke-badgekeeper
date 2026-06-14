// Captura (PLAN §4.5): escolher quem procura, acompanhar a busca e resolver o
// encontro (capturar 1 / trazer de volta / seguir procurando). Com o time cheio a
// captura continua possível: o jogador escolhe um Pokémon para descartar (ajuste).

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { rosterIsFull } from '../../engine/capture.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { previewPokemon } from '../common/preview.ts'
import { Overlay } from '../common/Overlay.tsx'
import { RenameModal } from './RenameModal.tsx'
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
  // Candidato escolhido (índice + espécie) aguardando a escolha de quem descartar (roster cheio).
  const [discardFor, setDiscardFor] = useState<{ index: number; speciesId: number } | null>(null)
  // Após capturar, abre o modal de apelido para o Pokémon recém-pego (último capturado).
  const [awaitingRename, setAwaitingRename] = useState(false)
  const lastCapturedId = state.today.capturedIds.at(-1) ?? null
  const justCaught = awaitingRename
    ? state.roster.find((p) => p.id === lastCapturedId) ?? null
    : null

  if (justCaught) {
    return (
      <RenameModal
        pokemon={justCaught}
        dispatch={dispatch}
        onDone={() => {
          setAwaitingRename(false)
          onClose()
        }}
      />
    )
  }

  const capture = (candidateIndex: number, releaseId?: string): void => {
    if (!encounter) return
    dispatch({ type: 'CAPTURE_PICK', searcherId: encounter.searcherId, candidateIndex, releaseId })
    setAwaitingRename(true)
  }

  // Passo de descarte: time cheio + candidato escolhido → escolher quem liberar.
  if (encounter && discardFor !== null) {
    const newcomer = getSpecies(discardFor.speciesId).displayName
    return (
      <Overlay title="TIME CHEIO" onClose={onClose}>
        <div className={styles.capture}>
          <p className={styles.warn}>
            Seu time está cheio. Escolha quem liberar para receber <b>{newcomer}</b> — o escolhido
            é descartado para sempre.
          </p>
          <div className={styles.picker}>
            {state.roster
              .filter((mon) => mon.id !== encounter.searcherId)
              .map((mon) => (
                <PokemonCard
                  key={mon.id}
                  pokemon={mon}
                  onClick={() => capture(discardFor.index, mon.id)}
                />
              ))}
          </div>
          <div className={styles.captureActions}>
            <button
              type="button"
              className={styles.ghost}
              data-sound="deselect"
              onClick={() => setDiscardFor(null)}
            >
              Voltar
            </button>
          </div>
        </div>
      </Overlay>
    )
  }

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
                pokemon={previewPokemon(id, encounter.level, { seed: encounter.candidateSeeds?.[i] })}
                onClick={() => (full ? setDiscardFor({ index: i, speciesId: id }) : capture(i))}
              />
            ))}
          </div>
          {full && (
            <p className={styles.warn}>
              Time cheio — ao capturar, você escolhe um Pokémon do time para descartar.
            </p>
          )}
          <div className={styles.captureActions}>
            <button
              type="button"
              className={styles.ghost}
              data-sound="deselect"
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
