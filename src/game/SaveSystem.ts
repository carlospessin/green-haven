import { CropType } from '../data/crops';
import { Inventory } from './EconomySystem';
import { AnimalProduct } from '../data/animals';
import { BiomeId } from '../data/biomes';
import { Quest } from './QuestSystem';

export interface ZoneSave {
  biome: BiomeId; owned: boolean; fences: string[];
  tiles: { ix: number; iz: number; tilled: boolean; crop: CropType | null; plantedAt: number; obstacle: 'tree' | 'rock' | 'water' | null; pasture: boolean }[];
}

export interface SaveData {
  v: 8; coins: number; inventory: Inventory; fences: number;
  unlockedCrops: CropType[]; siloTier: number; hasAxe: boolean; hasPickaxe: boolean;
  freeSeeds: Partial<Record<CropType, number>>; quest?: Quest;
  hasCoop: boolean; coopTier: number; chickens: number; cows: number; sheep: number;
  animalInventory: Record<AnimalProduct, number>; lastCollected: Record<AnimalProduct, number>;
  activeZone: number; zones: ZoneSave[];
  truck?: { departedAt: number; cargo: Inventory; tier: number };
}
const KEY = 'fazenda3d-save-v1';

/** Trocar por backend no futuro: manter a mesma interface load/save. */
export const SaveSystem = {
  load(): SaveData | null {
    try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as SaveData) : null; } catch { return null; }
  },
  save(d: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } },
};
