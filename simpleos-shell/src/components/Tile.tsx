import type { LauncherTile } from '../types'
import { Icon } from './Icons'

interface TileProps {
  tile: LauncherTile
  onSelect: (tile: LauncherTile) => void
}

/** A single large, full-touch-target home screen tile. */
export function Tile({ tile, onSelect }: TileProps) {
  return (
    <button
      type="button"
      className="tile"
      onClick={() => onSelect(tile)}
    >
      <Icon name={tile.icon} />
      <span className="tile__title">{tile.title}</span>
      <span className="tile__subtitle">{tile.subtitle}</span>
    </button>
  )
}
