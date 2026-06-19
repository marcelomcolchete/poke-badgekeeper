// Fluxo de novo jogo (PLAN §3): tipos do ginásio são FIXOS da cidade; o jogador escolhe,
// para cada inicial fixo (espécie + nível), entre 3 VERSÕES aleatórias (IVs/natureza/rank/sexo).

import { useMemo, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import type { StarterPick } from '../../game/setup.ts'
import { getCity } from '../../data/cities.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { deriveSeed } from '../../engine/rng.ts'
import { shinyFor } from '../../engine/shiny.ts'
import { DRAFT_CHOICES, STARTER_SLOT_SALTS } from '../../engine/constants.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { previewPokemon } from '../common/preview.ts'
import styles from './NewGameScreen.module.css'

/** Versão escolhida (sem apelido — só é aplicado na confirmação). */
type Chosen = { speciesId: number; level: number; seed: number }

type Stage = { kind: 'intro' } | { kind: 'pick'; slot: number } | { kind: 'confirm' }

/** Seed estável de uma versão (slot, roll): preview = Pokémon obtido. */
function rollSeed(runSeed: number, slot: number, roll: number): number {
  const salt = STARTER_SLOT_SALTS[slot] ?? STARTER_SLOT_SALTS[0]
  return deriveSeed(runSeed, salt as number, roll)
}

export function NewGameScreen({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const city = getCity(state.run.cityIndex)
  const seed = state.run.seed
  const starters = city.starters
  const [stage, setStage] = useState<Stage>({ kind: 'intro' })
  const [picks, setPicks] = useState<Chosen[]>([])
  const [names, setNames] = useState<string[]>(() => starters.map(() => ''))

  // As 3 versões do slot atual (mesma espécie/nível, seeds distintos → IVs/natureza variam).
  const choices = useMemo(() => {
    if (stage.kind !== 'pick') return []
    const starter = starters[stage.slot]
    if (!starter) return []
    return Array.from({ length: DRAFT_CHOICES }, (_, roll) => {
      const s = rollSeed(seed, stage.slot, roll)
      return {
        roll,
        seed: s,
        pokemon: previewPokemon(starter.speciesId, starter.level, { seed: s, shiny: shinyFor(s) }),
      }
    })
  }, [stage, seed, starters])

  const pickVersion = (slot: number, chosen: Chosen): void => {
    const next = [...picks]
    next[slot] = chosen
    setPicks(next)
    if (slot + 1 < starters.length) setStage({ kind: 'pick', slot: slot + 1 })
    else setStage({ kind: 'confirm' })
  }

  const setName = (slot: number, value: string): void => {
    setNames((prev) => prev.map((n, i) => (i === slot ? value : n)))
  }

  const confirm = (): void => {
    const finalPicks: StarterPick[] = picks.map((p, i) => ({
      speciesId: p.speciesId,
      level: p.level,
      seed: p.seed,
      nickname: names[i]?.trim() || undefined,
    }))
    dispatch({ type: 'START_RUN', picks: finalPicks })
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.title}>GINÁSIO DE {city.name.toUpperCase()}</span>
        <span className={styles.sub}>
          Tipos do ginásio <TypeBadge type={city.primaryType} /> <TypeBadge type={city.secondaryType} />
        </span>
      </header>

      {stage.kind === 'intro' && (
        <Section hint="Os tipos do ginásio são fixos. Você recebe 2 Pokémon iniciais — para cada um, escolha entre 3 versões (atributos, ranking e natureza variam).">
          <div className={styles.gymTypes}>
            <TypeBadge type={city.primaryType} />
            <TypeBadge type={city.secondaryType} />
          </div>
          <ul className={styles.starterList}>
            {starters.map((st) => {
              const sp = getSpecies(st.speciesId)
              return (
                <li key={st.speciesId} className={styles.starterRow}>
                  <img src={sp.spritePath} alt={sp.displayName} draggable={false} />
                  <span>
                    {sp.displayName} <small>Nv {st.level}</small>
                  </span>
                </li>
              )
            })}
          </ul>
          <button type="button" className={styles.primary} onClick={() => setStage({ kind: 'pick', slot: 0 })}>
            Escolher versões ▶
          </button>
        </Section>
      )}

      {stage.kind === 'pick' && starters[stage.slot] && (
        <Section
          hint={`Inicial ${stage.slot + 1} de ${starters.length}: ${getSpecies(starters[stage.slot]!.speciesId).displayName} (Nv ${starters[stage.slot]!.level}) — escolha 1 das 3 versões.`}
        >
          <div className={styles.cardGrid}>
            {choices.map((c) => (
              <PokemonCard
                key={c.roll}
                pokemon={c.pokemon}
                onClick={() =>
                  pickVersion(stage.slot, {
                    speciesId: starters[stage.slot]!.speciesId,
                    level: starters[stage.slot]!.level,
                    seed: c.seed,
                  })
                }
              />
            ))}
          </div>
        </Section>
      )}

      {stage.kind === 'confirm' && (
        <Section hint="Seu time inicial está pronto. Boa sorte, líder!">
          <div className={styles.cardGrid}>
            {picks.map((p, i) => (
              <PokemonCard
                key={i}
                pokemon={previewPokemon(p.speciesId, p.level, {
                  nickname: names[i]?.trim(),
                  seed: p.seed,
                  shiny: shinyFor(p.seed),
                })}
              />
            ))}
          </div>
          {picks.map((p, i) => (
            <NameField
              key={i}
              label={`Apelido para ${getSpecies(p.speciesId).displayName}?`}
              value={names[i] ?? ''}
              speciesId={p.speciesId}
              onChange={(v) => setName(i, v)}
            />
          ))}
          <div className={styles.gymTypes}>
            Ginásio: <TypeBadge type={city.primaryType} /> <TypeBadge type={city.secondaryType} />
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
