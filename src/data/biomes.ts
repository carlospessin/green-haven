export type BiomeId = 'pradaria' | 'floresta' | 'pantano' | 'deserto';

export interface BiomeConfig {
  id: BiomeId; name: string; emoji: string;
  ground: string;                         // cor do gramado/terreno base
  treeChance: number; rockChance: number; treasureChance: number; // pesos de geração (fora do lago)
  lakeChance: number;                      // chance desse bioma ter UM lago grande (10-15 blocos, irregular)
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  pradaria: { id: 'pradaria', name: 'Pradaria', emoji: '🌾', ground: '#9fd06a', treeChance: 0, rockChance: 0, treasureChance: 0, lakeChance: 0 },
  floresta: { id: 'floresta', name: 'Floresta', emoji: '🌲', ground: '#5c9a52', treeChance: 0.42, rockChance: 0.1, treasureChance: 0.05, lakeChance: 0.3 },
  pantano:  { id: 'pantano',  name: 'Pântano',  emoji: '🐸', ground: '#7a9a5e', treeChance: 0.18, rockChance: 0.06, treasureChance: 0.05, lakeChance: 0.8 },
  deserto:  { id: 'deserto',  name: 'Deserto',  emoji: '🏜️', ground: '#d8c389', treeChance: 0.04, rockChance: 0.3, treasureChance: 0.07, lakeChance: 0.08 },
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
