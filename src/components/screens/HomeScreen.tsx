// Página inicial (menu principal): título + botões centrais sobre o background.
// "Jogar" abre um submenu (Modo História = fluxo atual; Modo Infinito = em breve).
// Configurações abre um modal (idioma + volume). Ranking/Wiki ainda não têm conteúdo.

import { useState } from 'react'
import { SettingsModal } from './SettingsModal.tsx'
import styles from './HomeScreen.module.css'

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

/** Sub-tela do menu: lista raiz ou o submenu de modos de jogo. */
type Menu = 'main' | 'play'

export function HomeScreen({ onPlayStory }: { onPlayStory: () => void }) {
  const [menu, setMenu] = useState<Menu>('main')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className={styles.screen}>
      <div className={styles.overlay} />

      <div className={styles.content}>
        <h1 className={styles.title}>POKE BADGEKEEPER</h1>

        <nav className={styles.menu}>
          {menu === 'main' ? (
            <>
              <button type="button" className={styles.btn} onClick={() => setMenu('play')}>
                Jogar
              </button>
              <button type="button" className={styles.btn} onClick={() => setSettingsOpen(true)}>
                Configurações
              </button>
              <button type="button" className={`${styles.btn} ${styles.disabled}`} disabled>
                Ranking <span className={styles.soon}>Em breve</span>
              </button>
              <button type="button" className={`${styles.btn} ${styles.disabled}`} disabled>
                Wiki <span className={styles.soon}>Em breve</span>
              </button>
              <button type="button" className={`${styles.btn} ${styles.discord}`}>
                Discord
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.btn} onClick={onPlayStory}>
                Modo História
              </button>
              <button type="button" className={`${styles.btn} ${styles.disabled}`} disabled>
                Modo Infinito <span className={styles.soon}>Em breve</span>
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.back}`}
                data-sound="deselect"
                onClick={() => setMenu('main')}
              >
                ◀ Voltar
              </button>
            </>
          )}
        </nav>
      </div>

      <footer className={styles.footer}>
        <span className={styles.version}>v{APP_VERSION}</span>
        <p className={styles.disclaimer}>
          Projeto feito por um fã, para fãs, sem qualquer viés comercial. Pokémon e todos os
          personagens, nomes e marcas relacionados são propriedade da Nintendo, Game Freak e The
          Pokémon Company. Nenhum direito autoral é reivindicado.
        </p>
      </footer>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
