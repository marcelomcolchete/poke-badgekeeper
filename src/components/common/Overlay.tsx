import type { ReactNode } from 'react'
import styles from './Overlay.module.css'

interface Props {
  title: string
  children: ReactNode
  onClose?: () => void
  wide?: boolean
}

/** Modal retrô: fundo escurecido + painel com moldura. Fecha ao clicar fora/✕. */
export function Overlay({ title, children, onClose, wide = false }: Props) {
  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={`${styles.panel} ${wide ? styles.wide : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          {onClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
              ✕
            </button>
          )}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
