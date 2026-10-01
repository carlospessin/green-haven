export type CropType = 'wheat' | 'corn' | 'tomato';
export interface CropDef { id: CropType; name: string; emoji: string; seedCost: number; growTimeMs: number; sellPrice: number }

export const CROPS: Record<CropType, CropDef> = {
  wheat:  { id: 'wheat',  name: 'Wheat',  emoji: '🌾', seedCost: 5,  growTimeMs: 10_000, sellPrice: 12 },
  corn:   { id: 'corn',   name: 'Corn',   emoji: '🌽', seedCost: 10, growTimeMs: 20_000, sellPrice: 25 },
  tomato: { id: 'tomato', name: 'Tomato', emoji: '🍅', seedCost: 20, growTimeMs: 35_000, sellPrice: 50 },
};
export const CROP_LIST = Object.values(CROPS);
