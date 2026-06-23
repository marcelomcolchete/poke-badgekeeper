// Tela inicial: escolha da cidade de Kanto (PLAN §3). As cidades com mapa calibrado
// ficam jogáveis; as demais ficam como "Em breve" (desabilitadas).

import { CITIES } from '../../data/cities.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import styles from './CitySelectScreen.module.css'

/** Cidades com conteúdo pronto (Pewter, Cerulean, Vermilion, Celadon, Fuchsia e Saffron). */
const PLAYABLE_CITIES = new Set<number>([0, 1, 2, 3, 4, 5])

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

      <Textbox>
        Pewter, Cerulean, Vermilion, Celadon, Fuchsia e Saffron estão prontas. As demais cidades de Kanto
        chegam em breve.
      </Textbox>
    </div>
  )
}
