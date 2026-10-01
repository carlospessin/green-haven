import { CropType } from '../data/crops';
import { FarmTile } from './FarmTile';

export class CropSystem {
  till(tile: FarmTile): boolean {
    if (tile.tilled || tile.crop || tile.obstacle || tile.pasture) return false;
    tile.tilled = true;
    return true;
  }
  /** Só é possível plantar em terra já arada (ferramenta enxada), sem obstáculo e com a cultura liberada. */
  plant(tile: FarmTile, type: CropType, now: number): boolean {
    if (tile.crop || !tile.tilled || tile.obstacle || tile.pasture) return false;
    tile.crop = type; tile.plantedAt = now;
    return true;
  }
  harvest(tile: FarmTile, now: number): CropType | null {
    if (!tile.crop || tile.state(now) !== 'ready') return null;
    const c = tile.crop; tile.crop = null; tile.plantedAt = 0;
    return c;
  }
  clear(tile: FarmTile, tool: 'axe' | 'pickaxe'): boolean {
    const need = tool === 'axe' ? 'tree' : 'rock';
    if (tile.obstacle !== need) return false;
    tile.obstacle = null;
    return true;
  }
}
