// Resolve displayName/spritePath de uma linha do CSV de balanceamento.
// Espécie existente: preserva os campos atuais (não vêm no CSV).
// Espécie nova (id sem `prev`): deriva defaults — nome capitalizado e sprite por id.

export function resolveDisplayAndSprite(
  id: number,
  name: string,
  prev?: { displayName: string; spritePath: string },
): { displayName: string; spritePath: string } {
  if (prev) return { displayName: prev.displayName, spritePath: prev.spritePath }
  return {
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    spritePath: `/sprites/pokemons/gen1/${id}.png`,
  }
}
