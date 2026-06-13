# Poke BadgeKeeper

Fan game **single-player de navegador**, **não-comercial**, de gerenciamento de ginásio
Pokémon (Gen 1 / Kanto). Você cuida de um ginásio por **10 dias**: despacha seu time em
missões pela cidade, mantém um esquadrão de reserva para defender o ginásio e captura novos
Pokémon — buscando terminar com **mais de 3 estrelas** de aprovação.

> Inspiração de mecânica: _Dispatch_ (gerenciamento de missões), adaptado para Pokémon.

Plano de design completo em [`docs/PLAN.md`](docs/PLAN.md).

## Status

**Fase 0 — Setup** (scaffold). O projeto roda; engine pura, persistência e direção de arte
estão estabelecidas. Próximas fases: dados da Gen 1, engine de jogo, orquestração e UI.

## Stack

- **Vite + React 19 + TypeScript** (SPA 100% client-side, sem servidor)
- **Engine pura e determinística** com **RNG semeado** → testável e save reproduzível
- **localStorage** (slot único + autosave, schema versionado)
- **CSS Modules** + estética retrô arcade (pixel art, fontes bitmap)
- **Vitest** para a engine · **ESLint** (TS strict, sem `any`)

## Comandos

```bash
npm install      # instala dependências
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # typecheck (tsc -b) + build de produção
npm run preview  # serve o build localmente
npm run test     # testes da engine (Vitest)
npm run lint     # ESLint
```

## Estrutura

```
src/
  data/         dados estáticos da Gen 1 (Fase 1)
  engine/       lógica pura — sem React (RNG, estado, mecânicas)
  game/         orquestração em tempo real (Fase 3)
  persistence/  save/load + versionamento
  components/   UI (CSS Modules)
  styles/       globals + tokens de tema retrô
  types/        tipos compartilhados
public/
  sprites/  maps/  fonts/   assets (ver READMEs internos)
```

## Nota legal

Projeto **sem fins lucrativos, feito por fã para fãs**. **Pokémon** e todos os nomes,
personagens e sprites relacionados são propriedade da **Nintendo, Game Freak e The Pokémon
Company**. Este projeto **não é afiliado nem endossado** por essas empresas, **não é
monetizado** (sem anúncios, sem doações) e o repositório é mantido **privado** enquanto em
desenvolvimento. As fontes pixel utilizadas são de **licença aberta (SIL OFL)**.
