import { CropType } from '../data/crops';
import { CropStage, growthProgress, stageOf } from './Crop';

export type TileState = 'empty' | 'tilled' | 'planted' | 'growing' | 'ready';
export type Obstacle = 'tree' | 'rock' | 'water' | null;

/** Estado lógico puro: não conhece nenhum mesh. */
export class FarmTile {
  tilled = false;
  crop: CropType | null = null;
  plantedAt = 0;
  obstacle: Obstacle = null;
  pasture = false;
  constructor(readonly ix: number, readonly iz: number) {}

  stage(now: number): CropStage | null {
    return this.crop ? stageOf(growthProgress(this.crop, this.plantedAt, now)) : null;
  }
  state(now: number): TileState {
    const s = this.stage(now);
    if (!s) return this.tilled ? 'tilled' : 'empty';
    return s === 'mature' ? 'ready' : s === 'growing' ? 'growing' : 'planted';
  }
}
