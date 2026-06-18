# Skill `managing-pokemon-species` — cadastrar/alterar Pokémon

**Data:** 2026-06-18
**Estado:** aprovado (design), pronto para plano de implementação

## Contexto

O jogo tem um dataset fixo de Gen 1 (151 espécies), gerado originalmente da
PokéAPI mas hoje balanceado à mão via `scripts/data/pokemon-balance.csv`, que é a
**fonte de verdade**. `scripts/importPokemonCsv.ts` reimporta o CSV e regenera 4
arquivos:

- `src/data/pokemon/species.generated.ts` (id, name, displayName, types, baseAttrs, rarity, spritePath)
- `src/data/pokemon/evolutions.generated.ts` (from, to, atLevel)
- `src/data/pokemon/genders.generated.ts` (gender_rate)
- `src/data/pokemon/minWildLevels.generated.ts` (minWildLevel)

As **habilidades secretas** vivem em `src/data/secretAbilities.ts`: o union
`SecretId`, o catálogo `SECRET_KINDS` (nome + texto), a tripla por linha em
`SECRET_LINES` (chaveada pela raiz via `lineRootId`) e overrides por espécie em
`SECRET_LINE_BY_SPECIES` (linhas divergentes, ex.: Vaporeon). Cada linha tem 3
habilidades distintas, desbloqueadas em ordem ao virar Destaque do Dia; o
progresso fica no indivíduo (`pokemon.secretCount`) e sobrevive à evolução. A
**lógica** de cada efeito mora em `src/engine/secretEffects.ts` (predicados `hasX`
+ costuras nos fluxos da engine), amarrada pelo id.

Queremos uma skill-procedimento (no estilo de `.claude/skills/adding-kanto-city`)
que guie **cadastrar** uma espécie nova ou **alterar** uma existente, com foco em
raridade, nível de evolução e habilidades secretas — implementando habilidade nova
quando for o caso.

## Decisões de design

- **Escopo:** suporta tanto **alterar** existentes quanto **cadastrar** novas
  (id ≥ 152, furando a premissa "Gen 1 fixa").
- **Pipeline único via CSV:** o CSV continua fonte única de verdade; criar e
  alterar passam por *editar CSV → rodar import → regenerar os `.generated.ts`*.
- **Importador evoluído 1×:** `importPokemonCsv.ts` passa a aceitar id novo (hoje
  ele lança `id X não existe nas espécies atuais`). Para id ausente em
  `existingById`, usa defaults: `displayName` = nome capitalizado, `spritePath` =
  `/sprites/pokemons/gen1/<id>.png`. Espécies existentes mantêm o comportamento
  atual (preserva displayName/spritePath atuais).
- **Habilidade nova — viabilidade primeiro:** se o efeito é implementável com os
  sistemas atuais, implementar de verdade (catálogo + predicado + lógica + testes,
  espelhando o spec swift-swim/cloud-nine). Se depende de sistema inexistente
  (status de confusão, tempestade de areia, calor/frio), apenas catalogar com
  aviso `(sem efeito até existir …)` e sinalizar como follow-up.

## Arquitetura

### 1. Pré-requisito (mudança única no código) — `scripts/importPokemonCsv.ts`

No laço de importação, ao encontrar um id sem entrada em `existingById`:

- **não** lançar erro;
- derivar `displayName` capitalizando `name` do CSV (primeira letra maiúscula);
- derivar `spritePath` = `/sprites/pokemons/gen1/<id>.png`.

Manter o aviso de `name` divergente apenas quando existe `prev`. O resto do script
(serialização dos 4 arquivos, ordenação por id) não muda. Espécies existentes
seguem preservando displayName/spritePath atuais.

### 2. A skill — `.claude/skills/managing-pokemon-species/SKILL.md`

Frontmatter:

- `name: managing-pokemon-species`
- `description`: gatilhos em PT — "cadastrar/alterar um Pokémon (espécie) no
  poke-badgekeeper: raridade, nível de evolução, habilidades secretas (linha de 3),
  e implementar habilidade secreta nova". Deixa claro que é Gen 1 + CSV como fonte
  de verdade.

Corpo do SKILL.md:

1. **Step 0 — ler o estado vivo** (código vence a skill se divergir):
   - `scripts/data/pokemon-balance.csv` (header/colunas atuais);
   - `src/data/secretAbilities.ts` (`SecretId`, `SECRET_KINDS`, `SECRET_LINES`,
     `SECRET_LINE_BY_SPECIES`, `lineRootId`);
   - `src/engine/secretEffects.ts` (predicados e costuras existentes);
   - `src/types/index.ts` (`RARITIES`).
2. **Perguntar: criar ou alterar?** e qual espécie (id/nome).
3. **Coletar campos** — sempre pergunta os 3 destacados; ao **criar**, também o
   conjunto obrigatório completo:
   - **Sempre:** raridade (`common|uncommon|rare|epic|legend`); nível de evolução
     (`evolve_atLevel` + `evolvesTo_id`, ou vazio se não evolui); as 3 habilidades
     secretas da linha, em ordem de desbloqueio.
   - **Só ao criar:** `id`, `name`, `displayName`, `type1`/`type2`, os 6 `baseAttrs`
     (batalha, inteligencia, carisma, agilidade, resistencia, percepcao),
     `gender_rate`, `minWildLevel`, e a **sprite** em
     `public/sprites/pokemons/gen1/<id>.png` (a skill avisa que o arquivo precisa
     existir antes de verificar).
4. **Aplicar dados não-secretos:** editar/adicionar a linha no CSV (todas as
   colunas do header) → `node --experimental-strip-types scripts/importPokemonCsv.ts`.
   Conferir que os 4 `.generated.ts` foram regravados.
5. **Aplicar habilidades secretas** em `secretAbilities.ts`:
   - achar a raiz com `lineRootId(speciesId)`;
   - gravar a tripla em `SECRET_LINES[root]` **ou** em `SECRET_LINE_BY_SPECIES[id]`
     se a linha for divergente (raiz compartilhada por evoluções diferentes —
     padrão Eevee/Vaporeon).
6. **Habilidade NOVA** (id de habilidade ainda inexistente):
   - adicionar o id ao union `SecretId` e ao catálogo `SECRET_KINDS` (name + effect);
   - avaliar viabilidade com os sistemas atuais:
     - **viável** → implementar: predicado `hasX` em `secretEffects.ts`, lógica do
       efeito na(s) costura(s) certa(s) da engine, constantes em `engine/balance.ts`,
       e testes (espelhar o padrão swift-swim/cloud-nine);
     - **inviável** (depende de sistema inexistente) → catalogar com
       `(sem efeito até existir …)` e registrar como follow-up.
7. **Verificar:** `npx tsc --noEmit && npx vitest run`. Preferir testes ao preview
   (preferência do projeto: evitar preview salvo se pedido).

Seções de referência embutidas no SKILL.md:

- **Tabela campo → coluna do CSV / arquivo destino.**
- **Raridades + pesos de sorteio** (Common 40 / Uncommon 30 / Rare 15 / Epic 10 /
  Legend 5 — ler `RARITY_DRAW_WEIGHT` em `engine/balance.ts` para o valor vivo).
- **Modelo das habilidades secretas** (3 por linha; desbloqueio por Destaque;
  progresso no indivíduo; conteúdo por id, lógica na engine).
- **Checklist de implementação de habilidade nova** + lista de "sistemas que ainda
  não existem" (referência viva: ler os ids marcados `(sem efeito …)` no catálogo).
- **Gotchas:** linha divergente (Eevee → usar `SECRET_LINE_BY_SPECIES`); o
  importador regenera os 4 arquivos (não editar `.generated.ts` à mão); sprite
  obrigatória para espécie nova; sempre rodar `tsc` + `vitest` no fim.

## Testes

A skill é um documento de procedimento; a verificação de cada execução é
`npx tsc --noEmit && npx vitest run`. A única mudança de código deste design é o
importador:

- **`importPokemonCsv.ts` (id novo):** rodar o import com uma linha de CSV de id
  inédito gera entrada em `species.generated.ts` com `displayName` capitalizado e
  `spritePath` `/sprites/pokemons/gen1/<id>.png`, sem lançar erro; ids existentes
  continuam preservando displayName/spritePath. (Validável manualmente ou com um
  teste pequeno se o projeto tiver cobertura de scripts.)

## Fora de escopo

- Editar a UI de seleção/captura para exibir espécies novas (o jogo lê os
  `.generated.ts`; a skill só garante dado consistente + tsc/vitest verdes).
- Gerar sprites automaticamente (a sprite é um asset fornecido pelo usuário).
- Implementar sistemas faltantes (clima de areia, status de confusão/congelamento)
  para destravar habilidades dependentes — essas ficam catalogadas com aviso.
