import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/ — engine tests run em ambiente 'node' (lógica pura).
export default defineConfig({
  plugins: [react()],
  // Versão do jogo (package.json) exposta ao bundle — usada no rodapé da Home.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
