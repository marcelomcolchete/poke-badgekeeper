// Tela de derrota: ou o ginásio ficou indefeso (defesa expirada sem luta — PLAN §4.4),
// ou a reputação zerou (não bater a meta sem estrelas). Só resta começar um novo jogo.

import type { RunInfo } from '../../engine/state.ts'
import { Textbox } from '../Textbox/Textbox.tsx'
import styles from './GameOverScreen.module.css'

interface Props {
  reason: RunInfo['gameOverReason']
  onRestart: () => void
}

const MESSAGE: Record<NonNullable<RunInfo['gameOverReason']>, string> = {
  gym: 'O ginásio ficou indefeso! Você não enfrentou o ataque a tempo e foi demitido na hora — não importa o dia nem as estrelas.',
  stars:
    'Sua reputação chegou a zero. Sem estrelas e sem bater a meta do dia, a liga encerrou seu período de testes.',
}

export function GameOverScreen({ reason, onRestart }: Props) {
  return (
    <div className={styles.screen}>
      <span className={styles.title}>FIM DE JOGO</span>
      <div className={styles.box}>
        <Textbox>{MESSAGE[reason ?? 'gym']}</Textbox>
      </div>
      <button type="button" className={styles.primary} onClick={onRestart}>
        Novo jogo ▶
      </button>
    </div>
  )
}
