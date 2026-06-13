import type { ReactNode } from 'react'
import styles from './Textbox.module.css'

/** Caixa de diálogo clássica do Pokémon: branca, borda azul, texto azul, ▼ vermelho (PLAN §2.1). */
export function Textbox({ children, cursor = true }: { children: ReactNode; cursor?: boolean }) {
  return (
    <div className={styles.dialog}>
      <span className={styles.text}>{children}</span>
      {cursor && <span className={styles.cursor}>▼</span>}
    </div>
  )
}
