// Fluxo de novo jogo (PLAN §3): inicial do tipo primário + uma rodada de
// "sorteia 3 tipos → escolhe 1 → sorteia 3 recrutas → escolhe 1".

import { useMemo, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { PokemonType } from '../../types/index.ts'
import { POKEMON_TYPES } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { getCity } from '../../data/cities.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { createRng, deriveSeed } from '../../engine/rng.ts'
import { rollRecruitChoices, rollTypeChoices } from '../../engine/recruit.ts'
import { STARTER_LEVEL } from '../../engine/constants.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { TYPE_LABEL_PT, typeColorVar } from '../common/visual.ts'
import { previewPokemon } from '../common/preview.ts'
import styles from './NewGameScreen.module.css'

type Stage =
  | { kind: 'intro' }
  | { kind: 'type'; round: number }
  | { kind: 'recruit'; round: number; type: PokemonType }
  | { kind: 'confirm' }

export function NewGameScreen({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const city = getCity(state.run.cityIndex)
  const seed = state.run.seed
  const [stage, setStage] = useState<Stage>({ kind: 'intro' })
  const [chosenTypes, setChosenTypes] = useState<PokemonType[]>([])
  const [chosenExtras, setChosenExtras] = useState<number[]>([])
  const [starterName, setStarterName] = useState('')
  const [recruitName, setRecruitName] = useState('')

  const typeChoices = useMemo(() => {
    if (stage.kind !== 'type') return []
    return rollTypeChoices(createRng(deriveSeed(seed, 1000 + stage.round)), [city.primaryType, ...chosenTypes])
  }, [stage, seed, city.primaryType, chosenTypes])

  const recruitChoices = useMemo(() => {
    if (stage.kind !== 'recruit') return []
    const salt = 2000 + stage.round * 100 + POKEMON_TYPES.indexOf(stage.type)
    return rollRecruitChoices(createRng(deriveSeed(seed, salt)), stage.type)
  }, [stage, seed])

  const pickType = (type: PokemonType): void => {
    if (stage.kind === 'type') setStage({ kind: 'recruit', round: stage.round, type })
  }
  const pickRecruit = (speciesId: number): void => {
    if (stage.kind !== 'recruit') return
    const types = [...chosenTypes, stage.type]
    const extras = [...chosenExtras, speciesId]
    setChosenTypes(types)
    setChosenExtras(extras)
    setStage({ kind: 'confirm' })
  }
  const confirm = (): void => {
    dispatch({
      type: 'START_RUN',
      gymTypes: [city.primaryType, ...chosenTypes],
      starterSpeciesId: city.starterSpeciesId,
      extraSpeciesIds: chosenExtras,
      starterNickname: starterName.trim() || undefined,
      extraNicknames: [recruitName.trim() || ''],
    })
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.title}>GINÁSIO DE {city.name.toUpperCase()}</span>
        <span className={styles.sub}>
          Tipo primário <TypeBadge type={city.primaryType} />
        </span>
      </header>

      {stage.kind === 'intro' && (
        <Section
          hint={`Seu inicial é um Pokémon de ${TYPE_LABEL_PT[city.primaryType]}, nível ${STARTER_LEVEL}. Em seguida você escolhe mais 1 tipo do ginásio.`}
        >
          <div className={styles.single}>
            <PokemonCard pokemon={previewPokemon(city.starterSpeciesId, STARTER_LEVEL)} />
          </div>
          <NameField
            label="Dar um apelido ao seu inicial?"
            value={starterName}
            speciesId={city.starterSpeciesId}
            onChange={setStarterName}
          />
          <button type="button" className={styles.primary} onClick={() => setStage({ kind: 'type', round: 0 })}>
            Começar ▶
          </button>
        </Section>
      )}

      {stage.kind === 'type' && (
        <Section hint="Escolha o tipo secundário do ginásio.">
          <div className={styles.typeGrid}>
            {typeChoices.map((type) => (
              <button
                key={type}
                type="button"
                className={styles.typeChoice}
                style={{ backgroundColor: typeColorVar(type) }}
                onClick={() => pickType(type)}
              >
                {TYPE_LABEL_PT[type]}
              </button>
            ))}
          </div>
        </Section>
      )}

      {stage.kind === 'recruit' && (
        <Section hint={`Tipo ${TYPE_LABEL_PT[stage.type]} — escolha 1 dos 3 recrutas (nível 1).`}>
          <div className={styles.cardGrid}>
            {recruitChoices.map((species, i) => (
              <PokemonCard
                key={`${species.id}-${i}`}
                pokemon={previewPokemon(species.id, 1)}
                onClick={() => pickRecruit(species.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {stage.kind === 'confirm' && (
        <Section hint="Seu time inicial está pronto. Boa sorte, líder!">
          <div className={styles.cardGrid}>
            <PokemonCard pokemon={previewPokemon(city.starterSpeciesId, STARTER_LEVEL, starterName.trim())} />
            {chosenExtras.map((id, i) => (
              <PokemonCard key={`${id}-${i}`} pokemon={previewPokemon(id, 1, recruitName.trim())} />
            ))}
          </div>
          {chosenExtras[0] !== undefined && (
            <NameField
              label="Dar um apelido ao seu recruta?"
              value={recruitName}
              speciesId={chosenExtras[0]}
              onChange={setRecruitName}
            />
          )}
          <div className={styles.gymTypes}>
            Ginásio: {[city.primaryType, ...chosenTypes].map((t) => <TypeBadge key={t} type={t} />)}
          </div>
          <button type="button" className={styles.primary} onClick={confirm}>
            Iniciar período de testes ▶
          </button>
        </Section>
      )}
    </div>
  )
}

const MAX_NAME_LEN = 16

function NameField({
  label,
  value,
  speciesId,
  onChange,
}: {
  label: string
  value: string
  speciesId: number
  onChange: (v: string) => void
}) {
  return (
    <label className={styles.nameField}>
      <span className={styles.nameLabel}>{label}</span>
      <input
        className={styles.nameInput}
        type="text"
        value={value}
        maxLength={MAX_NAME_LEN}
        placeholder={getSpecies(speciesId).displayName}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function Section({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.body}>{children}</div>
      <Textbox>{hint}</Textbox>
    </div>
  )
}
