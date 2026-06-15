// Passivas (PLAN §4.3 / §4.6). Os efeitos são aplicados pela engine (Fases 2–5).

import type { PassiveData } from './types.ts'

export const PASSIVES: PassiveData[] = [
  {
    id: 'fly',
    name: 'Fly',
    description: 'Voa em linha reta do ginásio até o local — bem mais rápido. Só sozinho na tarefa.',
  },
  {
    id: 'run-away',
    name: 'Run Away',
    description: 'Reduz o tempo de viagem (move-se mais rápido pela cidade).',
  },
  {
    id: 'keen-eye',
    name: 'Keen Eye',
    description: 'Acelera a busca por Pokémon nas áreas de captura.',
  },
  {
    id: 'quick-claw',
    name: 'Quick Claw',
    description: 'Aumenta a chance de agir primeiro nas batalhas de defesa.',
  },
]

export function getPassive(id: string): PassiveData {
  const passive = PASSIVES.find((p) => p.id === id)
  if (!passive) throw new Error(`Passiva ${id} não encontrada`)
  return passive
}
