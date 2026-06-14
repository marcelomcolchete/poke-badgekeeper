# 🎵 Sons do Poke BadgeKeeper

Coloque aqui os 6 arquivos `.mp3` com **exatamente** estes nomes (tudo minúsculo,
hífen, sem acento). O Vite serve `public/` direto, então em código o caminho é
`/sounds/<arquivo>.mp3`.

| Arquivo | Quando toca | Caráter sugerido |
|---|---|---|
| `mission-new.mp3` | Surge uma nova missão no mapa | notificação curta, "pling!" |
| `mission-success.mp3` | Missão concluída com sucesso | jingle positivo curto |
| `mission-fail.mp3` | Missão fracassou | tom descendente / "buzz" |
| `time-warning.mp3` | Missão **ou** defesa de ginásio prestes a expirar sem ação | alerta tenso, tique-taque |
| `level-up.mp3` | Pokémon subiu de nível | fanfarra clássica de level-up ⭐ |
| `select.mp3` | Confirmar / selecionar algo (default de qualquer botão) | "blip" curto e baixo, ascendente |
| `deselect.mp3` | Cancelar / fechar / desmarcar algo | "blip" curto e baixo, descendente |

## Dicas
- **Formato:** `.mp3` (pedido), mono, ~96–128 kbps já basta. Mantenha curtos (< 2 s,
  exceto talvez o level-up). `click.mp3` idealmente < 150 ms.
- **Volume:** normalize para não estourar. O `click` já é tocado a volume reduzido no código.
- **Estética:** chiptune / 8-16 bits combina com a pixel-art retrô.
- **Onde achar (livres/CC0):** freesound.org (filtrar CC0), opengameart.org,
  pixabay.com/sound-effects, ou gere efeitos retrô em jsfxr.frozenfractal.com / sfxr.me.

> Enquanto um arquivo não existir, o jogo simplesmente não toca aquele som (sem erro).
> O botão 🔊/🔇 (canto inferior direito) silencia tudo e lembra a escolha entre sessões.
