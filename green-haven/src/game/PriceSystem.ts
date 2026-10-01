import { CROPS, CropType } from '../data/crops';

const SEED: Record<CropType, number> = { wheat: 11, corn: 47, tomato: 91 };
const CYCLE_MS = 45_000;

/** Onda lenta e determinística (não aleatória de verdade): mesmo `now` sempre dá o mesmo preço. */
export function priceMultiplier(crop: CropType, now: number): number {
  const phase = now / CYCLE_MS + SEED[crop];
  return 0.82 + 0.36 * (0.5 + 0.5 * Math.sin(phase * 2 * Math.PI));
}
export function currentPrice(crop: CropType, now: number): number {
  return Math.max(1, Math.round(CROPS[crop].sellPrice * priceMultiplier(crop, now)));
}
