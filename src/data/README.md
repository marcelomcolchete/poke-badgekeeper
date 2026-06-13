# `data/` — dados estáticos (Fase 1)

Dados curados importados como constantes (sem fetch em runtime). A preencher na **Fase 1**:

- `pokemon/` — 151 espécies da Gen 1: tipos, atributos base (10–50), cadeia de evolução + nível de jogo, passivas.
- `typeChart.ts` — tabela de efetividade da Gen 1 (15 tipos).
- `cities.ts` — 8 cidades: tipo primário, curva de dificuldade, arte do mapa + âncoras (spawns de missão, áreas de captura, posição do ginásio).
- `items.ts` — itens do mercado (Potion, Revive, passivos…).
- `missionTemplates.ts` — modelos de missão por tipo/tema.
- `passives.ts` — passivas (Fly, etc.) e seus efeitos.

Gerados/auxiliados por `scripts/buildPokemonData.ts`.
