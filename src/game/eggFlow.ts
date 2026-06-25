// Fluxo do Poke Egg no GameState: incuba os ovos na virada do dia, eclode os que
// completaram 3 dias e enfileira o resultado para o modal de eclosão.
import type { GameState, IncubatingEgg } from '../engine/state.ts'
import { EGG_INCUBATION_DAYS, MAX_ROSTER_SIZE } from '../engine/constants.ts'
import { hatchEgg } from '../engine/egg.ts'
import { takeId, takeRng } from './runtime.ts'

/** Avança 1 dia de incubação em todos os ovos; eclode os que chegaram a EGG_INCUBATION_DAYS. */
export function incubateEggs(s: GameState): void {
  const eggs = s.eggs ?? []
  const stillIncubating: IncubatingEgg[] = []
  for (const egg of eggs) {
    const daysElapsed = egg.daysElapsed + 1
    if (daysElapsed < EGG_INCUBATION_DAYS) {
      stillIncubating.push({ ...egg, daysElapsed })
      continue
    }
    const pokemon = hatchEgg(takeRng(s), takeId(s, 'p'), s.runItems)
    const toTeam = s.roster.length < MAX_ROSTER_SIZE
    if (toTeam) s.roster = [...s.roster, pokemon]
    else s.box = [...s.box, pokemon]
    if (!s.caughtSpecies.includes(pokemon.speciesId)) {
      s.caughtSpecies = [...s.caughtSpecies, pokemon.speciesId]
    }
    ;(s.pendingHatches ??= []).push({ pokemon, toTeam })
  }
  s.eggs = stillIncubating
}

/** Remove a eclosão da frente da fila (após o jogador fechar o modal). */
export function dismissHatch(s: GameState): void {
  if (!s.pendingHatches?.length) return
  s.pendingHatches = s.pendingHatches.slice(1)
}
