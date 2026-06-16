// Configurações (acessível pela Home): idioma e volume.
// Idioma: só PT-BR está ativo por enquanto (ENG fica desabilitado, sem i18n ainda).
// Volume: slider ligado ao volume mestre da camada de áudio (sounds.ts), persistido.

import { useSyncExternalStore } from 'react'
import { getVolume, setVolume, subscribeVolume } from '../../audio/sounds.ts'
import { Overlay } from '../common/Overlay.tsx'
import styles from './SettingsModal.module.css'

type Lang = 'pt-BR' | 'en'

const LANGS: { id: Lang; label: string; enabled: boolean }[] = [
  { id: 'pt-BR', label: 'PT-BR', enabled: true },
  { id: 'en', label: 'ENG', enabled: false },
]

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const volume = useSyncExternalStore(subscribeVolume, getVolume, getVolume)

  return (
    <Overlay title="Configurações" onClose={onClose}>
      <div className={styles.body}>
        <section className={styles.group}>
          <span className={styles.label}>Idioma</span>
          <div className={styles.langRow}>
            {LANGS.map((lang) => (
              <button
                key={lang.id}
                type="button"
                className={`${styles.langBtn} ${lang.id === 'pt-BR' ? styles.langActive : ''}`}
                disabled={!lang.enabled}
                aria-pressed={lang.id === 'pt-BR'}
                title={lang.enabled ? lang.label : 'Em breve'}
              >
                {lang.label}
                {!lang.enabled && <span className={styles.soon}>Em breve</span>}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <span className={styles.label}>
            Volume <span className={styles.value}>{Math.round(volume * 100)}%</span>
          </span>
          <div className={styles.volumeRow}>
            <span aria-hidden>🔈</span>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(volume * 100)}
              aria-label="Volume"
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
            />
            <span aria-hidden>🔊</span>
          </div>
        </section>
      </div>
    </Overlay>
  )
}
