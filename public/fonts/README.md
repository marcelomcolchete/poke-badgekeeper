# Fontes bitmap (licença aberta)

O jogo usa duas fontes pixel, **auto-hospedadas** (sem CDN externo — PLAN §2.1 / §10):

| Arquivo esperado          | Fonte           | Licença  | Uso              |
| ------------------------- | --------------- | -------- | ---------------- |
| `press-start-2p.woff2`    | Press Start 2P  | SIL OFL  | títulos / HUD    |
| `vt323.woff2`             | VT323           | SIL OFL  | textos / diálogo |

Os dois `.woff2` já estão incluídos (extraídos do Fontsource, ambos OFL — redistribuição
permitida). Se removidos, o `@font-face` (em `src/styles/globals.css`) cai no fallback
`monospace` e o app continua rodando.

Origem: pacotes `@fontsource/press-start-2p` e `@fontsource/vt323` (npm), equivalentes ao
Google Fonts oficial (ambos SIL OFL).
