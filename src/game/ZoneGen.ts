import { BiomeConfig } from '../data/biomes';
import { Farm } from './Farm';

function rand(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

/** Espalha obstáculos/água pela zona inteira conforme o bioma, e no máximo um tesouro. Chamado uma única vez, quando a zona é comprada. */
export function generateZoneContent(farm: Farm, biome: BiomeConfig, seed: number): { treasureBonus: number | null } {
  let treasureBonus: number | null = null, treasurePlaced = false;
  for (const t of farm.tiles) {
    const r = rand(t.ix * 31 + t.iz * 17 + seed);
    if (!treasurePlaced && r < biome.treasureChance) {
      treasurePlaced = true; treasureBonus = 120 + Math.floor(rand(t.ix * 53 + t.iz * 19 + seed) * 220); continue;
    }
    const rr = rand(t.ix * 13 + t.iz * 29 + seed * 3);
    if (rr < biome.waterChance) t.obstacle = 'water';
    else if (rr < biome.waterChance + biome.treeChance) t.obstacle = 'tree';
    else if (rr < biome.waterChance + biome.treeChance + biome.rockChance) t.obstacle = 'rock';
  }
  return { treasureBonus };
}
