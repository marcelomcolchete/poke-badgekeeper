// Botão flutuante de mute, renderizado no App (logo, presente em todas as telas).
// Lê o estado de mute compartilhado via useSyncExternalStore — fica em sincronia com
// qualquer outro disparo de setMuted e persiste entre sessões (localStorage).

import { useSyncExternalStore } from 'react'
import { isMuted, subscribeMuted, toggleMuted } from './sounds.ts'
import styles from './MuteButton.module.css'

export function MuteButton() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, isMuted)
  return (
    <button
      type="button"
      className={styles.muteBtn}
      onClick={toggleMuted}
      aria-label={muted ? 'Ativar som' : 'Silenciar som'}
      aria-pressed={muted}
      title={muted ? 'Ativar som' : 'Silenciar som'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
