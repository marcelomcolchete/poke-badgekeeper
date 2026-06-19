# Treinadores temáticos + líder das cidades 3–8

**Data:** 2026-06-19
**Status:** Aprovado (design)

## Objetivo

Dar às cidades 3–8 (Vermilion, Celadon, Fuchsia, Saffron, Cinnabar, Viridian) um
elenco próprio de treinadores invasores do ginásio — incluindo o **líder canônico** —
do mesmo jeito que Pewter (Brock, via lista genérica) e Cerulean (Misty + temáticos)
já têm. Hoje essas seis cidades caem na lista genérica de placeholder
(`GENERIC_TRAINERS`).

Cada cidade ganha: **líder + 5 treinadores** (2 canônicos do tipo do líder + 2 temáticos
da cidade + 1 "curinga" de tipo fora do tema), totalizando a mesma densidade de Cerulean.

A mudança é **100% de dados** — o engine (`game/setup.ts`) já consome `city.trainers`
e sorteia entre eles + rivais sem nenhuma alteração.

## Decisões de design (do brainstorming)

- **Rosters amplos por tipo**, como Misty/Brock: o time de cada treinador sorteia entre
  TODAS as linhas evolutivas Gen1 dos tipos atribuídos a ele (não o time canônico estrito).
- **Classes novas e únicas por cidade**, fiéis ao jogo original (FR/LG), com sprites e
  nomes da gen3. Como o `roster` é global por id, classes que se repetem entre cidades
  (ex.: Juggler, Tamer) recebem **prefixo de cidade** no id para terem times distintos.
- **Pools derivados dos dados** (Abordagem B): um helper `familiesByType(...types)` monta
  o pool a partir das espécies, em vez de listas à mão.
- **Líderes** entram como treinadores `roster` comuns na lista da cidade (sem flag especial),
  exatamente como a Misty em Cerulean. Convencionalmente são o 1º item da lista.
- **Misty/Brock/Cerulean não mudam.**

## Arquitetura

### 1. `src/data/pokemon/index.ts` — seletores de pool

Três funções novas que retornam `number[]` (ids de espécie, ordenados, **sem lendários** —
as 5 espécies `rarity: "legend"`: Articuno 144, Zapdos 145, Moltres 146, Mewtwo 150, Mew 151):

```ts
/** Linhas evolutivas Gen1 que têm algum dos tipos dados — sem lendários, dedup, ordenadas. */
export function familiesByType(...types: PokemonType[]): number[]

/** Formas-base (1ª evolução): espécies SEM pré-evolução — sem lendários, ordenadas. */
export function baseStageSpecies(): number[]

/** Pokémon evoluídos (2ª forma ou mais): espécies COM pré-evolução — ordenadas. */
export function evolvedSpecies(): number[]
```

- `familiesByType`: para cada tipo, `speciesByType(type)` → expande cada uma por
  `evolutionFamily` → junta tudo num `Set` → remove `rarity === 'legend'` → ordena por id.
  (Expandir por família garante que a linha inteira entra mesmo que só um estágio tenha o
  tipo — ex.: Charmander é fire, mas a família traz Charizard fire/flying também.)
- `baseStageSpecies`: percorre todas as espécies, mantém as que **não** têm pré-evolução
  (sem entrada em `EVO_PARENT`), exclui `legend`. Inclui mono-estágio (Tauros, Farfetch'd).
- `evolvedSpecies`: o complemento — espécies que **têm** pré-evolução (em `EVO_PARENT`).
  Lendários Gen1 são todos mono-estágio, então já não aparecem aqui.

`EVO_PARENT` já existe no módulo (hoje é privado); será usado por esses seletores.

### 2. `src/types/index.ts` — ids dos treinadores

Adicionar 36 ids a `TRAINER_IDS` (6 líderes + 30 classes). Líderes sem prefixo; classes
com prefixo de cidade. Nenhuma mudança em `RIVAL_TRAINER_IDS` nem `ROCKET_TRAINER_IDS`.

```ts
// Vermilion (3) — electric/dragon
'SURGE', 'VERMILION_ENGINEER', 'VERMILION_ROCKER', 'VERMILION_SAILOR',
'VERMILION_GENTLEMAN', 'VERMILION_POKEMANIAC',
// Celadon (4) — grass/bug
'ERIKA', 'CELADON_BEAUTY', 'CELADON_LASS', 'CELADON_PICNICKER',
'CELADON_BUGCATCHER', 'CELADON_GAMER',
// Fuchsia (5) — poison/dragon
'KOGA', 'FUCHSIA_JUGGLER', 'FUCHSIA_TAMER', 'FUCHSIA_DRAGONTAMER',
'FUCHSIA_BIRDKEEPER', 'FUCHSIA_SWIMMER',
// Saffron (6) — psychic/ghost
'SABRINA', 'SAFFRON_ACETRAINER', 'SAFFRON_SCIENTIST', 'SAFFRON_CHANNELER',
'SAFFRON_HEXMANIAC', 'SAFFRON_BLACKBELT',
// Cinnabar (7) — fire/fighting
'BLAINE', 'CINNABAR_BURGLAR', 'CINNABAR_SUPERNERD', 'CINNABAR_BLACKBELT',
'CINNABAR_KINDLER', 'CINNABAR_SWIMMER',
// Viridian (8) — ground/normal
'GIOVANNI', 'VIRIDIAN_TAMER', 'VIRIDIAN_ACETRAINER', 'VIRIDIAN_YOUNGSTER',
'VIRIDIAN_CAMPER', 'VIRIDIAN_BIKER',
```

### 3. `src/data/trainers.ts` — definições

Um `TrainerDef` por id novo. Pool via `roster(familiesByType(...))` (ou o seletor especial).
O helper `roster(...)` já aceita `number[]`, então `roster(familiesByType('electric'))` funciona.
Sprites em `/sprites/trainers/gen3/`, com `altSprites` `-gen3rs` quando o arquivo existir.

### 4. `src/data/cities.ts` — listas por cidade

Uma constante `<CIDADE>_TRAINERS: TrainerId[]` por cidade (líder primeiro), preenchendo o
campo `trainers` de cada `CitySeed` em `SEEDS`. Remove a queda dessas cidades em
`GENERIC_TRAINERS`. `GENERIC_TRAINERS` continua só para Pewter (placeholder).

## Escalações por cidade

Formato: **displayName** (`id`) — pool · sprite gen3 (rs = tem `altSprites` `-gen3rs`).

### 3. Vermilion — Surge (electric / dragon)
| displayName | id | pool | sprite |
|---|---|---|---|
| Surge (líder) | `SURGE` | electric | `ltsurge-gen3` |
| Engenheiro | `VERMILION_ENGINEER` | electric | `engineer-gen3` |
| Roqueiro | `VERMILION_ROCKER` | electric | `rocker-gen3` |
| Marinheiro | `VERMILION_SAILOR` | flying + water | `sailor-gen3` (rs) |
| Cavalheiro | `VERMILION_GENTLEMAN` | electric + dragon | `gentleman-gen3` (rs) |
| Pokemaníaco 🃏 | `VERMILION_POKEMANIAC` | ground + rock + poison | `pokemaniac-gen3` (rs) |

### 4. Celadon — Erika (grass / bug)
| displayName | id | pool | sprite |
|---|---|---|---|
| Erika (líder) | `ERIKA` | grass | `erika-gen3` |
| Beldade | `CELADON_BEAUTY` | grass | `beauty-gen3` (rs) |
| Moça | `CELADON_LASS` | grass | `lass-gen3` (rs) |
| Campista | `CELADON_PICNICKER` | normal | `picnicker-gen3` (rs) |
| Caçador de Insetos | `CELADON_BUGCATCHER` | bug | `bugcatcher-gen3` (rs) |
| Jogador 🃏 | `CELADON_GAMER` | fighting | `gamer-gen3` |

### 5. Fuchsia — Koga (poison / dragon)
| displayName | id | pool | sprite |
|---|---|---|---|
| Koga (líder) | `KOGA` | poison | `koga-gen3` |
| Malabarista | `FUCHSIA_JUGGLER` | fire + poison | `juggler-gen3` |
| Domador | `FUCHSIA_TAMER` | poison | `tamer-gen3` |
| Domador de Dragões | `FUCHSIA_DRAGONTAMER` | poison + dragon | `dragontamer-gen3` |
| Criador de Aves | `FUCHSIA_BIRDKEEPER` | flying + dragon | `birdkeeper-gen3` (rs) |
| Nadador 🃏 | `FUCHSIA_SWIMMER` | water | `swimmerm-gen3` (rs) |

### 6. Saffron — Sabrina (psychic / ghost)
| displayName | id | pool | sprite |
|---|---|---|---|
| Sabrina (líder) | `SABRINA` | psychic | `sabrina-gen3` |
| Treinador de Elite | `SAFFRON_ACETRAINER` | fire + psychic | `acetrainer-gen3` (rs) |
| Cientista | `SAFFRON_SCIENTIST` | psychic | `scientist-gen3` |
| Médium | `SAFFRON_CHANNELER` | psychic + ghost | `channeler-gen3` |
| Bruxa | `SAFFRON_HEXMANIAC` | poison + ghost | `hexmaniac-gen3` |
| Faixa-Preta 🃏 | `SAFFRON_BLACKBELT` | fighting | `blackbelt-gen3` (rs) |

### 7. Cinnabar — Blaine (fire / fighting)
| displayName | id | pool | sprite |
|---|---|---|---|
| Blaine (líder) | `BLAINE` | fire | `blaine-gen3` |
| Ladrão | `CINNABAR_BURGLAR` | water + rock | `burglar-gen3` |
| Super Nerd | `CINNABAR_SUPERNERD` | psychic + normal | `supernerd-gen3` |
| Faixa-Preta | `CINNABAR_BLACKBELT` | fighting | `blackbelt-gen3` (rs) |
| Incendiário | `CINNABAR_KINDLER` | fire | `kindler-gen3` |
| Nadador 🃏 | `CINNABAR_SWIMMER` | water | `swimmerm-gen3` (rs) |

### 8. Viridian — Giovanni (ground / normal)
| displayName | id | pool | sprite |
|---|---|---|---|
| Giovanni (líder) | `GIOVANNI` | ground | `giovanni-gen3` |
| Domador | `VIRIDIAN_TAMER` | normal | `tamer-gen3` |
| Treinador de Elite | `VIRIDIAN_ACETRAINER` | ground | `acetrainer-gen3` (rs) |
| Jovem | `VIRIDIAN_YOUNGSTER` | **formas-base** (`baseStageSpecies`) | `youngster-gen3` (rs) |
| Acampador | `VIRIDIAN_CAMPER` | grass + rock + normal | `camper-gen3` (rs) |
| Motoqueiro 🃏 | `VIRIDIAN_BIKER` | **evoluídos** (`evolvedSpecies`) | `biker-gen3` |

> Nota sobre nomes repetidos: "Faixa-Preta" (Saffron/Cinnabar), "Nadador"
> (Fuchsia/Cinnabar), "Treinador de Elite" (Saffron/Viridian), "Domador"
> (Fuchsia/Viridian) e "Malabarista" reaparecem com **ids distintos por cidade** — o
> displayName pode repetir; o que muda é o roster. Sprites podem ser reusados entre cidades.

## Testes

Novo arquivo `src/data/trainersCities.test.ts` (vitest), espelhando o estilo dos testes
de dados existentes:

1. **Resolução de ids** — todo id novo em `TRAINER_IDS` resolve via `getTrainer` sem lançar,
   e tem `displayName` e `spritePath` preenchidos.
2. **Elenco por cidade** — para cada cidade 3–8 (`getCity(2..7)`), `trainers` tem 6 ids,
   o 1º é o líder esperado (`SURGE`/`ERIKA`/`KOGA`/`SABRINA`/`BLAINE`/`GIOVANNI`), e nenhum
   id de rival/Rocket está na lista local (rivais são somados no setup).
3. **Pools não-vazios** — para cada treinador novo, o `pool` resolvido tem ≥1 espécie.
4. **Seletores de pool:**
   - `familiesByType` não inclui nenhuma espécie `rarity === 'legend'`; inclui a família
     inteira (ex.: `familiesByType('fire')` contém Charizard 6 mesmo ele sendo fire/flying);
     pool multi-tipo é a união (ex.: `familiesByType('flying','water')` ⊇ ambos).
   - `baseStageSpecies` não contém espécies com pré-evolução (ex.: não tem Ivysaur 2),
     contém formas-base (ex.: Bulbasaur 1), e exclui lendários.
   - `evolvedSpecies` é o complemento: contém Ivysaur 2, não contém Bulbasaur 1 nem lendários.
   - `baseStageSpecies` e `evolvedSpecies` são disjuntos e cobrem todas as não-lendárias.
5. **Sprites existem** — se houver helper/teste de existência de arquivo no repo, validar que
   cada `spritePath`/`altSprites` aponta para um arquivo real em `public/`. Caso contrário,
   validar o formato do caminho (`/sprites/trainers/gen3/...-gen3(rs)?.png`).

## Fora de escopo (YAGNI)

- Migrar Misty/Brock/Cerulean para `familiesByType` (podem virar follow-up).
- Flag/realce visual de "líder de ginásio" na UI (o líder é só mais um invasor, como hoje).
- Calibrar grafo/sítios das cidades 4–8 (Vermilion já está; as demais herdam Pewter — assunto
  da skill de mapeamento, independente deste trabalho).
- Times canônicos estritos dos líderes (decidiu-se por rosters amplos por tipo).
