# Background Compartilhado com Escurecimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reaproveitar `/background/background.jpg` atrás de todas as telas e escurecer com um véu neutro uniforme enquanto a run está ativa (Manhã/Dia/Resumo/Fim), mantendo Home/CitySelect/NewGame claras.

**Architecture:** Uma camada de fundo global (foto + véu) renderizada uma única vez no root do `App`, em z-index negativo, de modo que todo o conteúdo das telas fique por cima. Um booleano `darkened = started && !needsSetup` liga a opacidade do véu com fade suave. As telas individuais apenas deixam de pintar seu próprio fundo opaco.

**Tech Stack:** React 18 + TypeScript, CSS Modules, Vite. Sem libs novas.

## Global Constraints

- **Sem dependências novas.** Mudança é só CSS Modules + JSX existente.
- **Spec de referência:** `docs/superpowers/specs/2026-06-18-background-compartilhado-escurecido-design.md`.
- **Véu:** preto/cinza neutro `rgba(10, 12, 14, 0.5)`, uniforme (sem vinheta/dessaturação). Faixa de calibração aceitável ~0.40–0.55.
- **Z-index:** `.bgImage` = -2, `.bgVeil` = -1, conteúdo das telas ≥ 0.
- **Fallback:** `body { background: #123322 }` permanece como cor de segurança.
- **Verificação:** não há ambiente de teste de componente (vitest roda em `environment: 'node'`, só lógica pura) — adicionar jsdom/testing-library para uma mudança de CSS é YAGNI. O ciclo de cada task é `npm run typecheck` + `npm run lint`. O fechamento usa `npm run build` + uma checagem leve de DOM (sem screenshots, conforme preferência do projeto).
- **Boundary exato do escurecimento:** `started && !needsSetup`. `started` é a flag que vira `true` ao clicar "Modo História" ([App.tsx:54](../../../src/App.tsx)); `needsSetup = state.gym.types.length === 0` ([App.tsx:57](../../../src/App.tsx)) é `true` durante CitySelect/NewGame.

---

### Task 1: Camada de fundo global (foto + véu) no root do App

Cria a foto e o véu uma única vez no `App`, controlados por `darkened`. Esta é a entrega central — depois dela a foto já aparece atrás de tudo e o véu já escurece nas telas de run.

**Files:**
- Modify: `src/App.tsx` (computar `darkened`; renderizar dois divs como primeiros filhos de `.app`)
- Modify: `src/App.module.css` (adicionar `.bgImage` e `.bgVeil`)

**Interfaces:**
- Consumes: `started` (estado existente), `needsSetup` (const existente em `App.tsx`).
- Produces: classes CSS `.bgImage` e `.bgVeil`; o atributo `data-dark` no `.bgVeil` (presente só quando escuro). Nada é exportado para outras tasks além dessas convenções de markup.

- [ ] **Step 1: Adicionar `.bgImage` e `.bgVeil` em `src/App.module.css`**

Inserir no fim do arquivo (após a regra `.frame`):

```css
/* Camada de fundo global: a mesma arte da Home atrás de todas as telas.
   Fixos e em z-index negativo → todo conteúdo das telas renderiza por cima. */
.bgImage {
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background-image: url('/background/background.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* A arte é ilustração suave — anula o pixelated global. */
  image-rendering: auto;
}

/* Véu neutro: invisível por padrão (Home/setup), visível quando a run roda.
   Escurece só a foto (fica atrás do conteúdo); fade suave ao entrar na run. */
.bgVeil {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: rgba(10, 12, 14, 0.5);
  opacity: 0;
  transition: opacity 350ms ease;
}

.bgVeil[data-dark] {
  opacity: 1;
}
```

- [ ] **Step 2: Computar `darkened` e renderizar as camadas em `src/App.tsx`**

Logo após a linha `const wonLastDay = ...` (antes do `return`), adicionar:

```tsx
  // A foto fica atrás de tudo; o véu escurece só quando a run está ativa
  // (Manhã/Dia/Resumo/Fim). Home e setup (CitySelect/NewGame) ficam claros.
  const darkened = started && !needsSetup
```

Depois, no JSX, trocar a abertura atual:

```tsx
    <div className={styles.app} onClickCapture={handleClickSound}>
      <MuteButton />
```

por:

```tsx
    <div className={styles.app} onClickCapture={handleClickSound}>
      <div className={styles.bgImage} aria-hidden />
      <div className={styles.bgVeil} aria-hidden data-dark={darkened || undefined} />
      <MuteButton />
```

(`data-dark={darkened || undefined}` faz o atributo existir só quando `true`, casando com o seletor `.bgVeil[data-dark]`.)

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos passam sem erros (0 problemas).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat: camada de fundo global (foto + véu) escurecida na run"
```

---

### Task 2: Tornar a HomeScreen transparente (herdar a foto do root)

A Home hoje pinta seu próprio `background-image`. Com a camada global, isso vira duplicação — remover para a Home herdar a mesma foto do root. O véu verde próprio da Home (`.overlay`) permanece (contraste do título).

**Files:**
- Modify: `src/components/screens/HomeScreen.module.css:12-17` (remover as 5 linhas de `background-*` e `image-rendering` do `.screen`)

**Interfaces:**
- Consumes: `.bgImage` da Task 1 (a foto que a Home passa a herdar).
- Produces: nada novo. O `.overlay` verde e o resto da Home seguem iguais.

- [ ] **Step 1: Remover o background próprio do `.screen` da Home**

Em `src/components/screens/HomeScreen.module.css`, no seletor `.screen`, apagar estas linhas:

```css
  background-image: url('/background/background.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* A arte é uma ilustração suave — anula o pixelated global. */
  image-rendering: auto;
```

O `.screen` deve continuar com `position: fixed; inset: 0; z-index: 50;` e o resto das regras (flex/overflow) intactos. O comentário do topo do arquivo pode ser ajustado de "Tela cheia com o background da Home" para refletir que a foto agora vem do root, mas não é obrigatório.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: ambos passam (mudança é só CSS; o typecheck não deve regredir).

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/HomeScreen.module.css
git commit -m "refactor: Home herda a foto de fundo do root (remove duplicação)"
```

---

### Task 3: Conferir telas da run, contraste, e verificação final

As telas de run (CitySelect/NewGame/Morning/Summary/Day/EndGame) já usam painéis sobre fundo transparente, então a foto deve aparecer atrás delas sem mudança estrutural. Esta task confirma isso, ajusta contraste **só se** algum texto "solto" ficar ilegível, e roda a verificação de fechamento.

**Files:**
- Verify (sem editar, salvo se necessário): `src/components/day/DayScreen.module.css` (`.screen`/`.stage` não têm fundo opaco), `src/components/screens/EndGameScreen.module.css` (`.screen` sem fundo opaco), `src/components/screens/CitySelectScreen.module.css`, `src/components/screens/NewGameScreen.module.css`, `src/components/screens/MorningScreen.module.css`, `src/components/screens/SummaryScreen.module.css` (containers raiz sem fundo opaco que esconda a foto)
- Modify (condicional): qualquer um acima, só para adicionar scrim local se um título fora de painel perder leitura

**Interfaces:**
- Consumes: `.bgImage` e `.bgVeil` da Task 1.
- Produces: nada exportado.

- [ ] **Step 1: Confirmar que nenhum container raiz das telas pinta fundo opaco**

Inspecionar os seletores raiz (`.screen`, `.wrap`, `.page` ou equivalente) de cada arquivo listado. O esperado:
- `DayScreen.module.css` `.screen` → sem `background` (hoje não tem). As sidebars translúcidas (`rgba(8,26,14,0.72)` + `backdrop-filter: blur`) deixam a foto escurecida vazar — comportamento desejado.
- `EndGameScreen.module.css` `.screen` → sem `background` (a faixa-herói `.hero` mantém o `background-image` próprio).
- CitySelect/NewGame/Morning/Summary → o container raiz não deve ter `background` opaco cobrindo a viewport. Painéis internos (creme `var(--c-panel)`) seguem opacos por cima — correto.

Se algum tiver um fundo opaco de tela cheia escondendo a foto, removê-lo (a foto do root assume).

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: `tsc -b` + `vite build` concluem sem erro; bundle gerado em `dist/`.

- [ ] **Step 3: Checagem leve de DOM (sem screenshots)**

Subir o preview e validar o comportamento do véu por valores computados — não por imagem. Sugerido:

Run: `npm run dev` (ou usar o preview já ativo).

No console do navegador / via `preview_eval`, em **Home** (antes de clicar Modo História):
```js
getComputedStyle(document.querySelector('[class*="bgVeil"]')).opacity
// Esperado: "0"
getComputedStyle(document.querySelector('[class*="bgImage"]')).backgroundImage
// Esperado: contém "background/background.jpg"
```

Avançar até a **fase Dia** (Modo História → cidade → iniciais → manhã → dia) e repetir:
```js
document.querySelector('[class*="bgVeil"]').hasAttribute('data-dark')
// Esperado: true
getComputedStyle(document.querySelector('[class*="bgVeil"]')).opacity
// Esperado: "1"
```

Confirmar visualmente (a olho, sem capturar) que em CitySelect/NewGame a foto aparece **clara** e que em Manhã/Dia/Resumo/Fim aparece **escurecida**, e que os textos seguem legíveis.

- [ ] **Step 4: (Condicional) Ajuste de contraste pontual**

Apenas se um título/legenda **fora de painel** ficar ilegível sobre a foto clara (telas claras) — adicionar um scrim local sutil atrás daquele texto. Exemplo de padrão já usado no projeto (CitySelect tem `.scrim`):

```css
.tituloSolto {
  text-shadow: 2px 2px 0 #000, 0 0 10px rgba(0, 0, 0, 0.6);
}
```

Não aplicar preventivamente — só onde a leitura realmente piorar. Se nenhum ajuste for necessário, pular este step.

- [ ] **Step 5: Commit (se houve ajuste no Step 1 ou 4)**

```bash
git add -A
git commit -m "fix: garante foto de fundo visível e contraste nas telas da run"
```

Se nenhuma edição foi necessária nos steps 1/4, não há o que commitar — a verificação só confirma o comportamento das Tasks 1 e 2.

---

## Self-Review

**Cobertura do spec:**
- Foto atrás de todas as telas → Task 1 (`.bgImage`).
- Véu neutro uniforme `rgba(10,12,14,0.5)` → Task 1 (`.bgVeil`).
- Boundary `darkened = started && !needsSetup` (Home/setup claros; Manhã/Dia/Resumo/Fim escuros) → Task 1 (Step 2) + tabela em Global Constraints.
- Fade suave 350ms → Task 1 (`transition`).
- Home herda a foto, mantém véu verde próprio → Task 2.
- DayScreen: mapa intacto, sidebars deixam a foto escurecida vazar → Task 3 (Step 1).
- EndGame: faixa-herói própria preservada → Task 3 (Step 1).
- Fallback `#123322` → preservado (nenhuma task toca `body`); registrado em Global Constraints.
- Z-index -2/-1/≥0 → Task 1 (CSS) + Global Constraints.

**Placeholder scan:** sem TBD/TODO; todo CSS/JSX está escrito por extenso; o único step condicional (Task 3 Step 4) traz exemplo concreto e critério de quando aplicar.

**Consistência de tipos/nomes:** `.bgImage`/`.bgVeil`/`data-dark` usados de forma idêntica em App.module.css e App.tsx; `darkened`/`started`/`needsSetup` batem com os nomes reais em `src/App.tsx`.
