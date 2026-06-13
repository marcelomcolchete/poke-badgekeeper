// Tela de derrota (PLAN §4.4): deixar uma defesa de ginásio expirar sem lutar encerra a
// run na hora, independente do dia e da reputação. Só resta começar um novo jogo.

import { Textbox } from '../Textbox/Textbox.tsx'
import styles from './GameOverScreen.module.css'

interface Props {
  onRestart: () => void
}

export function GameOverScreen({ onRestart }: Props) {
  return (
    <div className={styles.screen}>
      <span className={styles.title}>FIM DE JOGO</span>
      <div className={styles.box}>
        <Textbox>
          O ginásio ficou indefeso! Você não enfrentou o ataque a tempo e foi demitido na hora —
          não importa o dia nem as estrelas.
        </Textbox>
      </div>
      <button type="button" className={styles.primary} onClick={onRestart}>
        Novo jogo ▶
      </button>
    </div>
  )
}
