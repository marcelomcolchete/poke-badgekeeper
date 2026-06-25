// Detalhe de um Pokémon do time (aberto a partir da coluna esquerda na fase Dia):
// card completo + distribuir pontos de level-up + usar Revive.

import type { Dispatch } from 'react'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { getNatureEntry, NATURE_LABEL_PT } from '../../data/natures.ts'
import {
  activeSecrets,
  secretLineFor,
  SECRET_KINDS,
} from '../../data/secretAbilities.ts'
import { ATTR_MAX } from '../../engine/constants.ts'
import { effectiveAttr, realPerPointGain } from '../../engine/attributes.ts'
import { pendingPoints } from '../../engine/leveling.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { Hearts } from '../common/Hearts.tsx'
import {
  ATTR_SHORT_PT,
  gainTier,
  SECRET_LEVEL_COLOR,
  SECRET_LEVEL_INK,
  SECRET_LEVEL_LABEL,
  SECRET_LEVEL_MEDAL,
} from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
import styles from './MemberDetail.module.css'

function count(state: GameState, itemId: string): number {
  return state.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0
}

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  pokemonId: string
  onClose: () => void
}

export function MemberDetail({ state, dispatch, pokemonId, onClose }: Props) {
  const mon = state.roster.find((p) => p.id === pokemonId)
  if (!mon) return null

  const pending = pendingPoints(mon)
  const natureEntry = mon.nature ? getNatureEntry(mon.nature) : null
  const secretLine = secretLineFor(mon.speciesId) // [id0, id1] | null
  const secrets = activeSecrets(mon)
  const secretCount = secrets.length // 0..2
  const fainted = mon.currentHp <= 0
  const revives = count(state, 'revive')

  return (
    <Overlay title={displayNameOf(mon).toUpperCase()} onClose={onClose}>
      <div className={styles.body}>
        <PokemonCard pokemon={mon} />

        <div className={styles.heartsLine}>
          <Hearts value={mon.hearts} />
          <span className={styles.heartsHint}>
            Quanto maior a afinidade do seu pokémon mais experiência é recebida em missões e
            batalhas.
          </span>
        </div>

        {mon.nature && (
          <div className={styles.natureLine}>
            <span className={styles.natureName}>{NATURE_LABEL_PT[mon.nature]}</span>
            {natureEntry?.boosted && (
              <span className={styles.natureBoosted}>+ {ATTR_SHORT_PT[natureEntry.boosted]}</span>
            )}
            {natureEntry?.reduced && (
              <span className={styles.natureReduced}>− {ATTR_SHORT_PT[natureEntry.reduced]}</span>
            )}
            {!natureEntry?.boosted && !natureEntry?.reduced && (
              <span className={styles.natureNeutral}>(neutra)</span>
            )}
          </div>
        )}

        {secretLine && (
          <div className={styles.secret}>
            <span className={styles.secretHead}>
              <span className={styles.secretIcon}>{secretCount > 0 ? '✦' : '🔒'}</span>
              Habilidades Secretas — {secretCount}/2
            </span>
            <ul className={styles.secretTiers}>
              {secretLine.map((id, i) => {
                const kind = SECRET_KINDS[id]
                const pick = secrets.find((s) => s.id === id)
                const unlocked = pick !== undefined
                const level = pick?.level ?? 1
                // Medalha pelo NÍVEL: prata (1) / ouro (2). Bloqueada = sem tier (cadeado).
                const tierClass = [
                  styles.secretTier,
                  unlocked ? styles.secretTierReached : styles.secretTierLocked,
                ]
                  .filter(Boolean)
                  .join(' ')
                const effectText = unlocked
                  ? level === 2
                    ? kind.effectL2
                    : kind.effectL1
                  : 'Desbloqueie sendo o Destaque do Dia.'
                return (
                  <li
                    key={`${id}-${i}`}
                    className={tierClass}
                    // Borda da linha na cor da medalha (prata/ouro) quando desbloqueada.
                    style={unlocked ? { borderColor: SECRET_LEVEL_COLOR[level] } : undefined}
                  >
                    <span
                      className={styles.secretTierMedal}
                      title={unlocked ? SECRET_LEVEL_LABEL[level] : 'Bloqueada'}
                      aria-label={unlocked ? SECRET_LEVEL_LABEL[level] : 'Bloqueada'}
                    >
                      {unlocked ? SECRET_LEVEL_MEDAL[level] : '🔒'}
                    </span>
                    <span className={styles.secretTierBody}>
                      {/* Nome na cor da medalha; "ATIVA"/"NÍVEL 2" abaixo do nome. */}
                      <span
                        className={styles.secretTierName}
                        style={unlocked ? { color: SECRET_LEVEL_INK[level] } : undefined}
                      >
                        {unlocked ? `${kind.name}${level === 2 ? '+' : ''}` : kind.name}
                      </span>
                      {unlocked && (
                        <span className={styles.secretTierFlag}>
                          {level === 2 ? 'NÍVEL 2' : 'ATIVA'}
                        </span>
                      )}
                      <span className={styles.secretTierDesc}>{effectText}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            {secretCount < 2 && (
              <span className={styles.secretFoot}>
                {secretCount === 0
                  ? 'Vire o Destaque do Dia para desbloquear a 1ª habilidade.'
                  : 'Seja o Destaque do Dia de novo para desbloquear a próxima.'}
              </span>
            )}
          </div>
        )}

        {pending > 0 && (
          <div className={styles.alloc}>
            <span className={styles.allocLabel}>Distribuir +{pending}:</span>
            <div className={styles.allocBtns}>
              {ATTR_KEYS.map((attr) => {
                const current = effectiveAttr(mon, attr)
                // Ganho REAL ao alocar: o ponto rende +5/+10/+15 pela natureza, mas o teto 60
                // pode aparar o saldo (ex.: 59 → só +1). Mostramos o número exato.
                const gain = realPerPointGain(mon, attr)
                const maxed = gain <= 0
                // Realce: vermelho (≤5) / amarelo (<10) avisam que o ponto rende pouco.
                const tier = gainTier(gain)
                const gainClass = [
                  styles.allocGain,
                  tier === 'danger'
                    ? styles.allocGainDanger
                    : tier === 'warn'
                      ? styles.allocGainWarn
                      : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={attr}
                    type="button"
                    className={styles.allocBtn}
                    disabled={maxed}
                    title={
                      maxed
                        ? `${ATTR_SHORT_PT[attr]} já está no máximo (${ATTR_MAX})`
                        : `${ATTR_SHORT_PT[attr]}: ${current} → ${current + gain}`
                    }
                    onClick={() => dispatch({ type: 'ALLOCATE_POINT', pokemonId: mon.id, attr })}
                  >
                    <span className={styles.allocName}>{ATTR_SHORT_PT[attr]}</span>
                    <span className={gainClass}>{maxed ? 'máx' : `+${gain}`}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {fainted && (
          <div className={styles.items}>
            {fainted && (
              <button
                type="button"
                className={styles.itemBtn}
                disabled={revives <= 0}
                onClick={() => dispatch({ type: 'USE_ITEM', itemId: 'revive', targetId: mon.id })}
              >
                Revive ({revives})
              </button>
            )}
          </div>
        )}
      </div>
    </Overlay>
  )
}
