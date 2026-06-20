import { describe, expect, it } from 'vitest'
import type { DefenseEvent, GameState, MissionInstance } from '../engine/state.ts'
import { createInitialState } from '../engine/state.ts'
import type { EnemyUnit, Pokemon, PokemonType } from '../types/index.ts'
import { makeAttrs, makeMon } from '../engine/testkit.ts'
import { HEARTS_MAX, MAX_ROSTER_SIZE, STARTING_GOLD } from '../engine/constants.ts'
import { MISSION_XP_POOL } from '../engine/balance.ts'
import { gymWinXp } from '../engine/gymDefense.ts'
import { reducer } from './reducer.ts'
import { autoSeedRun } from './setup.ts'

const SEED = 777
const GYM: PokemonType[] = ['rock', 'water', 'grass']

function strong(id: string): Pokemon {
  return makeMon({ id, baseAttrs: makeAttrs({}, 50) })
}

function controlledMission(over: Partial<MissionInstance> = {}): MissionInstance {
  return {
    id: 'm1',
    templateId: 'patrulha',
    requirement: makeAttrs({}, 40), // time forte (50/eixo) cobre → P=1
    node: 'q', // grama 3.6 (longe do ginásio) → viagem real de ida/volta
    path: [],
    spawnAtMs: 0,
    expiresAtMs: 10_000,
    status: 'available',
    teamIds: [],
    acceptedAtMs: null,
    arriveAtMs: null,
    resolveAtMs: null,
    returnEndsAtMs: null,
    result: null,
    pSuccess: null,
    ...over,
  }
}

function dayState(over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(SEED), run: { cityIndex: 0, day: 1, seed: SEED, phase: 'DAY', ballLevel: 0, specialChances: [] }, gym: { types: GYM }, ...over }
}

describe('reducer — pureza e determinismo', () => {
  it('não muta a entrada e é determinístico', () => {
    const base = dayState({ roster: [strong('a')], missions: [controlledMission()] })
    const a = reducer(base, { type: 'TICK', deltaMs: 5_000 })
    const b = reducer(base, { type: 'TICK', deltaMs: 5_000 })
    expect(a).toEqual(b)
    expect(base.clock.dayElapsedMs).toBe(0)
    expect(a.clock.dayElapsedMs).toBe(5_000)
  })

  it('SET_SPEED altera a velocidade do relógio', () => {
    const s = reducer(dayState(), { type: 'SET_SPEED', speed: 3 })
    expect(s.clock.speed).toBe(3)
  })

  it('SELECT_CITY grava o índice da cidade escolhida na run', () => {
    const s = reducer(createInitialState(SEED), { type: 'SELECT_CITY', cityIndex: 1 })
    expect(s.run.cityIndex).toBe(1) // Cerulean — o novo jogo usa este índice p/ tipos/iniciais/mapa
  })

  it('TICK não avança fora da fase DAY', () => {
    const morning = createInitialState(SEED) // phase MORNING
    const s = reducer(morning, { type: 'TICK', deltaMs: 5_000 })
    expect(s.clock.dayElapsedMs).toBe(0)
  })
})

describe('fluxo de missão (PLAN §4.2/§4.3)', () => {
  it('aceitar despacha o time; o tempo resolve e concede XP no sucesso', () => {
    let s = dayState({ roster: [strong('a'), strong('b'), strong('c')], missions: [controlledMission()] })
    s = reducer(s, { type: 'ACCEPT_MISSION', missionId: 'm1', teamIds: ['a', 'b', 'c'] })
    expect(s.missions[0]?.status).toBe('traveling')
    expect(s.roster.every((p) => p.status === 'traveling')).toBe(true)

    s = reducer(s, { type: 'TICK', deltaMs: 200_000 }) // passa do resolveAt e do fim do dia
    expect(s.missions[0]?.status).toBe('resolved')
    expect(s.missions[0]?.result).toBe('success') // 3× atributo 50 cobrem a exigência → P=1
    expect(s.roster.every((p) => p.status === 'idle')).toBe(true)
    expect(s.roster.every((p) => p.level > 1 || p.xp > 0)).toBe(true) // ganhou XP
    expect(s.run.phase).toBe('SUMMARY')
    expect(s.today.missionResults).toHaveLength(1)
  })

  it('o XP da missão é um POOL dividido igualmente entre os participantes', () => {
    let s = dayState({
      roster: [strong('a'), strong('b'), strong('c')],
      missions: [controlledMission()],
    })
    s = reducer(s, { type: 'ACCEPT_MISSION', missionId: 'm1', teamIds: ['a', 'b', 'c'] })
    s = reducer(s, { type: 'TICK', deltaMs: 200_000 }) // resolve e volta ao ginásio

    expect(s.missions[0]?.result).toBe('success')
    const share = Math.floor(MISSION_XP_POOL / 3) // 240 / 3 = 80
    expect(s.missions[0]?.xpAwards).toEqual({ a: share, b: share, c: share })
    // A soma dos shares concedidos no dia = o pool inteiro (relatório).
    expect(s.today.xpEarned).toBe(share * 3)
  })

  it('time menor recebe um share MAIOR do pool (solo = pool inteiro)', () => {
    let s = dayState({ roster: [strong('a')], missions: [controlledMission()] })
    s = reducer(s, { type: 'ACCEPT_MISSION', missionId: 'm1', teamIds: ['a'] })
    s = reducer(s, { type: 'TICK', deltaMs: 200_000 })
    expect(s.missions[0]?.xpAwards).toEqual({ a: MISSION_XP_POOL })
  })

  it('o time fica "returning" até voltar ao ginásio; idle só ao chegar', () => {
    let s = dayState({ roster: [strong('a')], missions: [controlledMission()] })
    s = reducer(s, { type: 'ACCEPT_MISSION', missionId: 'm1', teamIds: ['a'] })
    const resolveAt = s.missions[0]?.resolveAtMs ?? 0
    expect(resolveAt).toBeGreaterThan(0)

    // Logo após a resolução (no local), antes de a volta terminar.
    s = reducer(s, { type: 'TICK', deltaMs: resolveAt + 1 })
    expect(s.missions[0]?.status).toBe('returning')
    expect(s.missions[0]?.result).toBe('success')
    expect(s.roster[0]?.status).toBe('returning')

    // Depois de chegar de volta ao ginásio.
    s = reducer(s, { type: 'TICK', deltaMs: 60_000 })
    expect(s.missions[0]?.status).toBe('resolved')
    expect(s.roster[0]?.status).toBe('idle')
  })

  it('aceitar com time inválido (vazio) é no-op', () => {
    let s = dayState({ roster: [strong('a')], missions: [controlledMission()] })
    s = reducer(s, { type: 'ACCEPT_MISSION', missionId: 'm1', teamIds: [] })
    expect(s.missions[0]?.status).toBe('available')
  })

  it('missão disponível ignorada expira no timer', () => {
    let s = dayState({ roster: [strong('a')], missions: [controlledMission({ expiresAtMs: 3_000 })] })
    s = reducer(s, { type: 'TICK', deltaMs: 4_000 })
    expect(s.missions[0]?.status).toBe('resolved')
    expect(s.missions[0]?.result).toBe('expired')
    expect(s.today.missionResults).toHaveLength(1)
  })

  it('pop-up de missão NÃO some ao bater 18h — segue até o próprio timer', () => {
    // Timer da missão vai além do fim do dia (180s).
    let s = dayState({ roster: [strong('a')], missions: [controlledMission({ expiresAtMs: 250_000 })] })
    s = reducer(s, { type: 'TICK', deltaMs: 190_000 }) // cruza o fim do dia, antes do timer
    expect(s.missions[0]?.status).toBe('available') // ainda na tela
    expect(s.run.phase).toBe('DAY') // o dia espera o pop-up resolver

    s = reducer(s, { type: 'TICK', deltaMs: 100_000 }) // agora passa do timer (250s)
    expect(s.missions[0]?.status).toBe('resolved')
    expect(s.missions[0]?.result).toBe('expired')
    expect(s.run.phase).toBe('SUMMARY') // sem pendências, o dia fecha
  })

  it('Missão Especial expirada vai para SUMMARY (sem GAMEOVER — Plan A sem Rocket)', () => {
    const special = controlledMission({ templateId: 'special', expiresAtMs: 250_000 })
    let s = dayState({ roster: [strong('a')], missions: [special] })
    s = reducer(s, { type: 'TICK', deltaMs: 190_000 }) // passa do fim do dia, antes do timer
    expect(s.run.phase).toBe('DAY') // ainda aguarda o pop-up resolver
    expect(s.missions[0]?.status).toBe('available')

    // Timer esgota: missão expira, dia fecha normalmente (SUMMARY, não GAMEOVER).
    s = reducer(s, { type: 'TICK', deltaMs: 100_000 })
    expect(s.missions[0]?.status).toBe('resolved')
    expect(s.missions[0]?.result).toBe('expired')
    expect(s.run.phase).toBe('SUMMARY')
  })
})

describe('fluxo de defesa (PLAN §4.4/§4.6)', () => {
  function defense(enemies: EnemyUnit[]): DefenseEvent {
    return {
      id: 'd1',
      pos: { x: 0.5, y: 0.2 },
      spawnAtMs: 0,
      expiresAtMs: 40_000,
      status: 'active',
      trainerId: 'YOUNGSTER',
      squadIds: [],
      enemies,
      duels: [],
    }
  }

  it('vitória rende ouro e libera o esquadrão', () => {
    const weak: EnemyUnit[] = [
      { battle: 1, types: ['normal'] },
      { battle: 1, types: ['normal'] },
    ]
    let s = dayState({ roster: [strong('a'), strong('b'), strong('c')], defenses: [defense(weak)] })
    s.today.defensesTotal = 1
    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: ['a', 'b', 'c'] })
    expect(s.defenses[0]?.status).toBe('won')
    expect(s.gold).toBeGreaterThan(0)
    expect(s.today.defensesWon).toBe(1)
    expect(s.roster.every((p) => p.status === 'idle')).toBe(true)
  })

  it('XP/level-up das vitórias só é aplicado ao CONCLUIR a batalha (COMPLETE_DEFENSE)', () => {
    const weak: EnemyUnit[] = [
      { battle: 1, types: ['normal'] },
      { battle: 1, types: ['normal'] },
    ]
    let s = dayState({ roster: [strong('a')], defenses: [defense(weak)] })
    s.today.defensesTotal = 1
    const xpBefore = s.roster[0]?.xp ?? 0

    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: ['a'] })
    expect(s.defenses[0]?.status).toBe('won')
    // Ainda NÃO subiu: XP do dia zerado, XP do Pokémon inalterado, marcado como não aplicado.
    expect(s.today.xpEarned).toBe(0)
    expect(s.roster[0]?.xp).toBe(xpBefore)
    expect(s.defenses[0]?.xpApplied).toBe(false)

    s = reducer(s, { type: 'COMPLETE_DEFENSE', defenseId: 'd1' })
    expect(s.today.xpEarned).toBeGreaterThan(0)
    expect(s.defenses[0]?.xpApplied).toBe(true)

    // Idempotente: concluir de novo não aplica XP duas vezes.
    const xpEarnedOnce = s.today.xpEarned
    s = reducer(s, { type: 'COMPLETE_DEFENSE', defenseId: 'd1' })
    expect(s.today.xpEarned).toBe(xpEarnedOnce)
  })

  it('o XP de ginásio escala com o poder de cada desafiante derrotado (teto 30)', () => {
    // Desafiantes normais (sem vantagem de tipo) com poderes 20 e 40; o defensor forte vence ambos.
    const enemies: EnemyUnit[] = [
      { battle: 20, types: ['normal'] },
      { battle: 40, types: ['normal'] },
    ]
    let s = dayState({ roster: [strong('a')], defenses: [defense(enemies)] })
    s.today.defensesTotal = 1
    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: ['a'] })
    expect(s.defenses[0]?.status).toBe('won')

    s = reducer(s, { type: 'COMPLETE_DEFENSE', defenseId: 'd1' })
    // 0,5×20 + 0,5×40 = 10 + 20 = 30.
    expect(s.today.xpEarned).toBe(gymWinXp(20) + gymWinXp(40))
    expect(s.today.xpEarned).toBe(30)
  })

  it('esquadrão vazio é rejeitado', () => {
    let s = dayState({ roster: [strong('a'), strong('b')], defenses: [defense([{ battle: 1, types: ['normal'] }])] })
    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: [] })
    expect(s.defenses[0]?.status).toBe('active')
  })

  it('aceita defender com 1 Pokémon', () => {
    const weak: EnemyUnit[] = [{ battle: 1, types: ['normal'] }]
    let s = dayState({ roster: [strong('a'), strong('b')], defenses: [defense(weak)] })
    s.today.defensesTotal = 1
    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: ['a'] })
    expect(s.defenses[0]?.status).toBe('won')
  })

  it('defesa ativa que expira sem luta encerra a run na hora (GAMEOVER)', () => {
    const enemies: EnemyUnit[] = [{ battle: 1, types: ['normal'] }]
    let s = dayState({ roster: [strong('a')], defenses: [defense(enemies)] })
    s = reducer(s, { type: 'TICK', deltaMs: 40_000 }) // o timer da defesa zera
    expect(s.defenses[0]?.status).toBe('lost')
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.clock.speed).toBe(0)
  })

  it('defender antes do timer zerar evita o GAMEOVER', () => {
    const weak: EnemyUnit[] = [{ battle: 1, types: ['normal'] }]
    let s = dayState({ roster: [strong('a')], defenses: [defense(weak)] })
    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: ['a'] })
    s = reducer(s, { type: 'TICK', deltaMs: 40_000 })
    expect(s.run.phase).toBe('DAY')
    expect(s.defenses[0]?.status).toBe('won')
  })

  it('defesa que surge e expira no mesmo salto de tempo não encerra a run', () => {
    const enemies: EnemyUnit[] = [{ battle: 1, types: ['normal'] }]
    const scheduled: DefenseEvent = { ...defense(enemies), status: 'scheduled', spawnAtMs: 10_000 }
    let s = dayState({ roster: [strong('a')], defenses: [scheduled] })
    s = reducer(s, { type: 'TICK', deltaMs: 60_000 }) // cruza spawn (10s) e expiry (40s) num tick só
    expect(s.defenses[0]?.status).toBe('lost')
    expect(s.run.phase).toBe('DAY')
  })
})

describe('ouro inicial (PLAN §4.6)', () => {
  it('nova run começa com 500 de ouro', () => {
    expect(createInitialState(SEED).gold).toBe(STARTING_GOLD)
    expect(STARTING_GOLD).toBe(500)
  })
})

describe('fluxo de captura (PLAN §4.5)', () => {
  function searching(): GameState {
    // Spot na grama 'q' (precisa de viagem real até lá antes de procurar).
    let s = dayState({
      roster: [makeMon({ id: 'a', baseAttrs: makeAttrs({ percepcao: 50 }) })],
      captureSpots: ['q'],
    })
    s = reducer(s, { type: 'START_SEARCH', searcherId: 'a', spotIndex: 0 })
    return reducer(s, { type: 'TICK', deltaMs: 60_000 }) // cobre viagem + busca (sem encerrar o dia)
  }

  it('buscar gera encontro; capturar adiciona ao roster e a área é encerrada na volta', () => {
    const s = searching()
    expect(s.encounters).toHaveLength(1)
    const pick = s.encounters[0]?.candidateSpeciesIds[0]
    expect(pick).toBeDefined()
    let after = reducer(s, { type: 'CAPTURE_PICK', searcherId: 'a', candidateIndex: 0 })
    expect(after.roster).toHaveLength(2)
    expect(after.today.capturedIds).toHaveLength(1)
    expect(after.today.exploredSpots).toContain(0) // área some do dia
    // O procurador volta ao ginásio antes de ficar disponível.
    expect(after.roster.find((p) => p.id === 'a')?.status).toBe('returning')
    after = reducer(after, { type: 'TICK', deltaMs: 60_000 })
    expect(after.roster.find((p) => p.id === 'a')?.status).toBe('idle')
  })

  it('Love Ball: o Pokémon capturado já vem com o máximo de corações', () => {
    const s = searching()
    s.runItems = ['love-ball']
    const after = reducer(s, { type: 'CAPTURE_PICK', searcherId: 'a', candidateIndex: 0 })
    const caught = after.roster.find((p) => p.id !== 'a')
    expect(caught?.hearts).toBe(HEARTS_MAX)
  })

  it('sem Love Ball, a captura vem com os corações iniciais (não máximos)', () => {
    const s = searching()
    const after = reducer(s, { type: 'CAPTURE_PICK', searcherId: 'a', candidateIndex: 0 })
    const caught = after.roster.find((p) => p.id !== 'a')
    expect(caught?.hearts).toBeLessThan(HEARTS_MAX)
  })

  it('não capturar encerra a área e traz o procurador de volta', () => {
    const s = searching()
    let dismissed = reducer(s, { type: 'CAPTURE_DISMISS', searcherId: 'a' })
    expect(dismissed.encounters).toHaveLength(0)
    expect(dismissed.roster).toHaveLength(1)
    expect(dismissed.today.exploredSpots).toContain(0)
    expect(dismissed.roster[0]?.status).toBe('returning')
    dismissed = reducer(dismissed, { type: 'TICK', deltaMs: 60_000 })
    expect(dismissed.roster[0]?.status).toBe('idle')
  })

  it('com roster cheio a busca continua liberada (captura vai pro PC)', () => {
    const full = Array.from({ length: MAX_ROSTER_SIZE }, (_, i) =>
      makeMon({ id: `r${i}`, baseAttrs: makeAttrs({ percepcao: 50 }) }),
    )
    let s = dayState({ roster: full, captureSpots: ['q'] })
    s = reducer(s, { type: 'START_SEARCH', searcherId: 'r0', spotIndex: 0 })
    expect(s.captureSearches).toHaveLength(1)
  })

  it('capturar com roster cheio envia o Pokémon ao Computador (PC) e mantém 6 no time', () => {
    const full = Array.from({ length: MAX_ROSTER_SIZE }, (_, i) =>
      makeMon({ id: `r${i}`, baseAttrs: makeAttrs({ percepcao: 50 }) }),
    )
    let s = dayState({ roster: full, captureSpots: ['q'] })
    s = reducer(s, { type: 'START_SEARCH', searcherId: 'r0', spotIndex: 0 })
    s = reducer(s, { type: 'TICK', deltaMs: 60_000 })
    const pick = s.encounters[0]?.candidateSpeciesIds[0]
    expect(pick).toBeDefined()

    const after = reducer(s, { type: 'CAPTURE_PICK', searcherId: 'r0', candidateIndex: 0 })
    expect(after.roster).toHaveLength(MAX_ROSTER_SIZE) // time intacto
    expect(after.box).toHaveLength(1) // novo Pokémon foi pro PC
    expect(after.box[0]?.speciesId).toBe(pick)
    expect(after.today.capturedIds).toHaveLength(1)
    expect(after.caughtSpecies).toContain(pick) // registrado na Pokédex
    expect(after.encounters).toHaveLength(0)
    expect(after.today.exploredSpots).toContain(0)
  })
})

describe('Computador / PC (PLAN §4.5, redesign)', () => {
  function morning(over: Partial<GameState> = {}): GameState {
    return { ...createInitialState(SEED), gym: { types: GYM }, ...over } // phase MORNING
  }

  it('depositar move do time pro PC (manhã); manter ≥1 no time', () => {
    let s = morning({ roster: [makeMon({ id: 'a' }), makeMon({ id: 'b' })], box: [] })
    s = reducer(s, { type: 'DEPOSIT_POKEMON', pokemonId: 'b' })
    expect(s.roster.map((p) => p.id)).toEqual(['a'])
    expect(s.box.map((p) => p.id)).toEqual(['b'])

    // Não pode esvaziar o time (resta 1).
    const blocked = reducer(s, { type: 'DEPOSIT_POKEMON', pokemonId: 'a' })
    expect(blocked.roster).toHaveLength(1)
    expect(blocked.box).toHaveLength(1)
  })

  it('retirar move do PC pro time (manhã); exige vaga (< 6)', () => {
    let s = morning({ roster: [makeMon({ id: 'a' })], box: [makeMon({ id: 'x' })] })
    s = reducer(s, { type: 'WITHDRAW_POKEMON', pokemonId: 'x' })
    expect(s.roster.map((p) => p.id)).toEqual(['a', 'x'])
    expect(s.box).toHaveLength(0)

    const full = Array.from({ length: MAX_ROSTER_SIZE }, (_, i) => makeMon({ id: `r${i}` }))
    const noRoom = reducer(morning({ roster: full, box: [makeMon({ id: 'x' })] }), {
      type: 'WITHDRAW_POKEMON',
      pokemonId: 'x',
    })
    expect(noRoom.roster).toHaveLength(MAX_ROSTER_SIZE)
    expect(noRoom.box).toHaveLength(1)
  })

  it('trocar fora da manhã é no-op (só de manhã)', () => {
    const day = dayState({ roster: [makeMon({ id: 'a' }), makeMon({ id: 'b' })], box: [] })
    const after = reducer(day, { type: 'DEPOSIT_POKEMON', pokemonId: 'b' })
    expect(after.roster).toHaveLength(2)
    expect(after.box).toHaveLength(0)
  })
})

describe('mercado e alocação (PLAN §4.6/§4.1)', () => {
  it('comprar debita ouro; usar Potion cura', () => {
    let s = createInitialState(SEED)
    s.gold = 1000
    s.roster = [makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 })]
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'potion', quantity: 2 })
    expect(s.gold).toBe(600)
    expect(s.inventory).toEqual([{ itemId: 'potion', quantity: 2 }])
    s = reducer(s, { type: 'USE_ITEM', itemId: 'potion', targetId: 'a' })
    expect(s.roster[0]?.currentHp).toBeGreaterThan(1)
    expect(s.inventory).toEqual([{ itemId: 'potion', quantity: 1 }])
  })

  it('comprar sem ouro suficiente é no-op', () => {
    let s = createInitialState(SEED)
    s.gold = 50
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'potion' })
    expect(s.gold).toBe(50)
    expect(s.inventory).toHaveLength(0)
  })

  it('alocar gasta o ponto pendente do level-up', () => {
    let s = createInitialState(SEED)
    s.roster = [makeMon({ id: 'a', level: 2 })] // 1 ponto pendente
    s = reducer(s, { type: 'ALLOCATE_POINT', pokemonId: 'a', attr: 'batalha' })
    expect(s.roster[0]?.allocations.batalha).toBe(1)
    const again = reducer(s, { type: 'ALLOCATE_POINT', pokemonId: 'a', attr: 'batalha' })
    expect(again.roster[0]?.allocations.batalha).toBe(1) // sem pontos → no-op
  })
})

describe('ciclo do dia headless (PLAN §3)', () => {
  it('MORNING→DAY agenda eventos; o dia inteiro fecha em SUMMARY', () => {
    let s = autoSeedRun(SEED)
    expect(s.run.phase).toBe('MORNING')
    expect(s.roster).toHaveLength(1)
    expect(s.gym.types).toHaveLength(2)

    s = reducer(s, { type: 'ADVANCE_PHASE' })
    expect(s.run.phase).toBe('DAY')
    expect(s.clock.speed).toBe(1)
    expect(s.missions.length).toBeGreaterThan(0)
    expect(s.missions.every((m) => m.status === 'scheduled')).toBe(true)

    s = reducer(s, { type: 'TICK', deltaMs: s.clock.dayLengthMs })
    expect(s.run.phase).toBe('SUMMARY')
    expect(s.missions.every((m) => m.status === 'resolved')).toBe(true)
    expect(s.history).toHaveLength(1)
  })

  it('SUMMARY→próximo dia cura o roster e limpa eventos', () => {
    let s = autoSeedRun(SEED)
    s = reducer(s, { type: 'ADVANCE_PHASE' }) // DAY
    s = reducer(s, { type: 'TICK', deltaMs: s.clock.dayLengthMs }) // SUMMARY
    s = reducer(s, { type: 'ADVANCE_PHASE' }) // próximo dia
    expect(s.run.day).toBe(2)
    expect(s.run.phase).toBe('MORNING')
    expect(s.missions).toHaveLength(0)
    expect(s.roster.every((p) => p.currentHp === p.maxHp && p.status === 'idle')).toBe(true)
  })
})

describe('economia da defesa (PLAN §4.6, ajuste)', () => {
  function defense(enemies: EnemyUnit[]): DefenseEvent {
    return {
      id: 'd1',
      pos: { x: 0.5, y: 0.2 },
      spawnAtMs: 0,
      expiresAtMs: 40_000,
      status: 'active',
      trainerId: 'YOUNGSTER',
      squadIds: [],
      enemies,
      duels: [],
    }
  }

  it('paga ouro por batalhar (vencendo ou perdendo) e registra defenseGold', () => {
    const enemies: EnemyUnit[] = [
      { battle: 100, types: ['normal'] },
      { battle: 100, types: ['normal'] },
      { battle: 100, types: ['normal'] },
    ]
    let s = dayState({ roster: [strong('a')], defenses: [defense(enemies)] })
    s.today.defensesTotal = 1
    const before = s.gold
    s = reducer(s, { type: 'ASSIGN_DEFENSE', defenseId: 'd1', squadIds: ['a'] })
    expect(['won', 'lost']).toContain(s.defenses[0]?.status)
    expect(s.gold).toBeGreaterThan(before)
    expect(s.today.defenseGold).toBeGreaterThan(0)
    expect(s.defenses[0]?.duels.length).toBeGreaterThan(0)
  })

  it('vencer TODAS as defesas do dia rende +30% sobre o ouro de defesa', () => {
    let s = dayState({ roster: [strong('a')] })
    s.gold = 200
    s.today.defensesTotal = 1
    s.today.defensesWon = 1
    s.today.defenseGold = 200
    s.today.goldEarned = 200
    s = reducer(s, { type: 'ADVANCE_PHASE' }) // DAY → SUMMARY (finalizeDay aplica o bônus)
    expect(s.run.phase).toBe('SUMMARY')
    expect(s.gold).toBe(260) // 200 + 30%
  })

  it('sem dia perfeito não há bônus', () => {
    let s = dayState({ roster: [strong('a')] })
    s.gold = 200
    s.today.defensesTotal = 2
    s.today.defensesWon = 1
    s.today.defenseGold = 200
    s.today.goldEarned = 200
    s = reducer(s, { type: 'ADVANCE_PHASE' })
    expect(s.gold).toBe(200)
  })
})

describe('fim do dia por retorno (PLAN §3, ajuste)', () => {
  it('não fecha no tempo enquanto um Pokémon ainda volta; fecha quando chega', () => {
    const mon: Pokemon = { ...strong('a'), status: 'returning' }
    const mission = controlledMission({
      status: 'returning',
      teamIds: ['a'],
      result: 'success',
      acceptedAtMs: 0,
      arriveAtMs: 100_000,
      resolveAtMs: 170_000,
      returnEndsAtMs: 200_000, // termina o retorno DEPOIS do fim do dia (180s)
    })
    let s = dayState({ roster: [mon], missions: [mission] })

    s = reducer(s, { type: 'TICK', deltaMs: 185_000 }) // passa do fim do dia, antes do retorno
    expect(s.run.phase).toBe('DAY')
    expect(s.roster[0]?.status).toBe('returning')

    s = reducer(s, { type: 'TICK', deltaMs: 20_000 }) // 205s: retorno concluído
    expect(s.roster[0]?.status).toBe('idle')
    expect(s.run.phase).toBe('SUMMARY')
  })
})
