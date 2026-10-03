import { CROP_LIST, CropType } from '../data/crops';
import { AnimalProduct } from '../data/animals';
import { currentPrice } from './PriceSystem';
import { SEED_UNLOCK_ORDER, SILO_TIERS } from '../data/upgrades';

export type Inventory = Record<CropType, number>;
export const FENCE_PRICE = 6;

export class EconomySystem {
  coins = 100;
  fences = 0; // cercas compradas, ainda não colocadas
  inventory: Inventory = { wheat: 0, corn: 0, tomato: 0 };
  unlockedCrops = new Set<CropType>(['wheat']);
  siloTier = 1;
  hasAxe = false;
  hasPickaxe = false;
  freeSeeds: Partial<Record<CropType, number>> = {};
  hasCoop = false;
  coopTier = 1;
  chickens = 0;
  cows = 0;
  sheep = 0;
  wood = 0;
  dockTier = 1;
  animalInventory: Record<AnimalProduct, number> = { egg: 0, milk: 0, wool: 0, fish: 0 };
  lastCollected: Record<AnimalProduct, number> = { egg: Date.now(), milk: Date.now(), wool: Date.now(), fish: Date.now() };

  capacity() { return SILO_TIERS[this.siloTier - 1].capacity; }
  stored(): number { return CROP_LIST.reduce((s, c) => s + this.inventory[c.id], 0); }
  free(): number { return Math.max(0, this.capacity() - this.stored()); }
  spend(n: number): boolean { if (this.coins < n) return false; this.coins -= n; return true; }
  addItem(t: CropType, n = 1) { this.inventory[t] += n; }

  /** Preço de venda no momento (flutua com o tempo). */
  sell(t: CropType, qty: number, now: number): number {
    const q = Math.min(qty, this.inventory[t]);
    const gain = q * currentPrice(t, now);
    this.inventory[t] -= q; this.coins += gain;
    return gain;
  }
  nextLockedCrop(): CropType | null {
    for (const c of SEED_UNLOCK_ORDER) if (!this.unlockedCrops.has(c)) return c;
    return null;
  }
}
