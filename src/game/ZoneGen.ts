import { BiomeConfig } from '../data/biomes';
import { Farm } from './Farm';

function rand(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

/** Lago grande e irregular: flood-fill aleatório a partir de um tile semente, 10 a 15 blocos conectados. */
function generateLake(seed: number): Set<string> {
  const startIx = 1 + Math.floor(rand(seed) * 7), startIz = 1 + Math.floor(rand(seed + 1) * 7);
  const target = 10 + Math.floor(rand(seed + 2) * 6); // 10..15
  const visited = new Set<string>();
  const frontier: [number, number][] = [[startIx, startIz]];
  let sc = seed + 10;
  while (visited.size < target && frontier.length) {
    const idx = Math.floor(rand(sc++) * frontier.length);
    const [ix, iz] = frontier.splice(idx, 1)[0];
    const key = `${ix},${iz}`;
    if (visited.has(key) || ix < 0 || iz < 0 || ix > 8 || iz > 8) continue;
    visited.add(key);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nk = `${ix + dx},${iz + dz}`;
      if (!visited.has(nk) && rand(sc++) < 0.85) frontier.push([ix + dx, iz + dz]); // irregular, não simétrico
    }
  }
  return visited;
}

/**
 * Espalha árvores/pedras/tesouro pela zona conforme o bioma, e talvez um lago grande.
 * Chamado uma única vez, quando a zona nasce (mesmo antes de ser comprada — o conteúdo já existe).
 */
export function generateZoneContent(farm: Farm, biome: BiomeConfig, seed: number): { treasureBonus: number | null } {
  const lake = rand(seed + 999) < biome.lakeChance ? generateLake(seed + 2000) : new Set<string>();
  for (const key of lake) {
    const [ix, iz] = key.split(',').map(Number);
    const t = farm.get(ix, iz); if (t) t.obstacle = 'water';
  }
  let treasureBonus: number | null = null, treasurePlaced = false;
  for (const t of farm.tiles) {
    if (lake.has(`${t.ix},${t.iz}`)) continue;
    const r = rand(t.ix * 31 + t.iz * 17 + seed);
    if (!treasurePlaced && r < biome.treasureChance) {
      treasurePlaced = true; treasureBonus = 120 + Math.floor(rand(t.ix * 53 + t.iz * 19 + seed) * 220); continue;
    }
    const rr = rand(t.ix * 13 + t.iz * 29 + seed * 3);
    if (rr < biome.treeChance) t.obstacle = 'tree';
    else if (rr < biome.treeChance + biome.rockChance) t.obstacle = 'rock';
  }
  return { treasureBonus };
}
