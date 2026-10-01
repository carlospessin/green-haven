import { CROPS, CropType } from '../data/crops';

export type CropStage = 'seedling' | 'growing' | 'mature';

/** 0..1, derivado sempre de Date.now() - plantedAt (nunca de um timer incremental). */
export function growthProgress(type: CropType, plantedAt: number, now: number): number {
  return Math.max(0, Math.min(1, (now - plantedAt) / CROPS[type].growTimeMs));
}
export function stageOf(progress: number): CropStage {
  return progress >= 1 ? 'mature' : progress >= 1 / 3 ? 'growing' : 'seedling';
}
