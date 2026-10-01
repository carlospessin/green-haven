import { CROPS, CropType } from '../data/crops';
import { ECON_DAY_MS } from './EconomyTime';

export const QUEST_DAY_MS = ECON_DAY_MS;

export interface Quest {
  seed: number; crop: CropType; qty: number;
  rewardType: 'coins' | 'seeds'; rewardCoins: number; rewardSeeds: number;
  createdAt: number; deadlineMs: number;
}

function rand(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

/**
 * A maioria dos pedidos é pequena e cabe num "dia". Uma parte (30%) é grande — quantidade bem
 * maior — e ganha um prazo maior (2-3 dias), mas ainda apertado (85% do tempo total disponível).
 */
export function generateQuest(seed: number, unlocked: CropType[], now: number): Quest {
  const pool = unlocked.length ? unlocked : (['wheat'] as CropType[]);
  const r1 = rand(seed + 1), r2 = rand(seed + 2), r3 = rand(seed + 3), r4 = rand(seed + 4);
  const crop = pool[Math.floor(r1 * pool.length)] ?? 'wheat';
  const big = r4 < 0.3;
  const qty = big ? 28 + Math.floor(r2 * 45) : 6 + Math.floor(r2 * 10);
  const days = big ? 2 + Math.floor(r2 * 2) : 1;
  const deadlineMs = Math.round(days * QUEST_DAY_MS * 0.85);
  const rewardType: 'coins' | 'seeds' = r3 < 0.6 ? 'coins' : 'seeds';
  return {
    seed, crop, qty, rewardType,
    rewardCoins: Math.round(qty * CROPS[crop].sellPrice * (big ? 1.8 : 1.5)),
    rewardSeeds: Math.max(2, Math.round(qty / 2)),
    createdAt: now, deadlineMs,
  };
}
