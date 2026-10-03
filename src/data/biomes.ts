export type BiomeId = 'pradaria' | 'floresta' | 'pantano' | 'deserto';

export interface BiomeConfig {
  id: BiomeId; name: string; emoji: string;
  ground: string;                         // cor do gramado/terreno base
  treeChance: number; rockChance: number; waterChance: number; treasureChance: number; // pesos de geração
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  pradaria: { id: 'pradaria', name: 'Pradaria', emoji: '🌾', ground: '#9fd06a', treeChance: 0, rockChance: 0, waterChance: 0, treasureChance: 0 },
  floresta: { id: 'floresta', name: 'Floresta', emoji: '🌲', ground: '#5c9a52', treeChance: 0.42, rockChance: 0.1, waterChance: 0.06, treasureChance: 0.05 },
  pantano:  { id: 'pantano',  name: 'Pântano',  emoji: '🐸', ground: '#7a9a5e', treeChance: 0.18, rockChance: 0.06, waterChance: 0.28, treasureChance: 0.05 },
  deserto:  { id: 'deserto',  name: 'Deserto',  emoji: '🏜️', ground: '#d8c389', treeChance: 0.04, rockChance: 0.3, waterChance: 0.015, treasureChance: 0.07 },
};

export type CornerId = 'ne' | 'nw' | 'se' | 'sw';
export const ZONE_SPACING = 27; // distância do centro da fazenda até o centro de cada terreno vizinho
export const ZONE_BASE_COST = 500;

export interface CornerConfig { id: CornerId; biome: BiomeId; dx: number; dz: number; label: string }
export const CORNERS: CornerConfig[] = [
  { id: 'ne', biome: 'floresta', dx: ZONE_SPACING, dz: -ZONE_SPACING, label: 'Nordeste' },
  { id: 'nw', biome: 'pantano', dx: -ZONE_SPACING, dz: -ZONE_SPACING, label: 'Noroeste' },
  { id: 'se', biome: 'deserto', dx: ZONE_SPACING, dz: ZONE_SPACING, label: 'Sudeste' },
  { id: 'sw', biome: 'floresta', dx: -ZONE_SPACING, dz: ZONE_SPACING, label: 'Sudoeste' },
];
