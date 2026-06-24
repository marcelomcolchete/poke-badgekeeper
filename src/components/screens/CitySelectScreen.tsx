// Tela inicial: escolha da cidade de Kanto (PLAN §3). Todas as 8 cidades estão
// calibradas e jogáveis.

import { CITIES } from '../../data/cities.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import styles from './CitySelectScreen.module.css'

/** Cidades com conteúdo pronto (todas as 8 de Kanto). */
const PLAYABLE_CITIES = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7])

export function CitySelectScreen({ onChoose }: { onChoose: (cityIndex: number) => void }) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.title}>POKE BADGEKEEPER</span>
        <span className={styles.sub}>Escolha a cidade de Kanto</span>
      </header>

      <div className={styles.grid}>
        {CITIES.map((city) => {
          const playable = PLAYABLE_CITIES.has(city.index)
          return (
            <button
              key={city.index}
              type="button"
              className={`${styles.city} ${playable ? '' : styles.locked}`}
              disabled={!playable}
              onClick={playable ? () => onChoose(city.index) : undefined}
            >
              <img
                className={styles.cover}
                src={city.coverImage}
                alt={`Capa de ${city.name}`}
                width={396}
                height={228}
                draggable={false}
              />
              <span className={playable ? styles.play : styles.soon}>
                {playable ? 'Jogar ▶' : 'Em breve'}
              </span>
              <div className={styles.cardInfo}>
                <span className={styles.cityName}>{city.name}</span>
                <TypeBadge type={city.primaryType} />
              </div>
            </button>
          )
        })}
      </div>

      <Textbox>As 8 cidades de Kanto estão prontas. Escolha por onde começar.</Textbox>
    </div>
  )
}
