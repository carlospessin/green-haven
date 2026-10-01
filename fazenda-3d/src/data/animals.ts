export type AnimalProduct = 'egg' | 'milk' | 'wool';

export const CHICKEN_PRICE = 40, COW_PRICE = 120, SHEEP_PRICE = 150;
export const COOP_BASE_COST = 200, PASTURE_TILE_PRICE = 25;

export interface CoopTier { level: number; name: string; capacity: number; cost: number; scale: number }
export const COOP_TIERS: CoopTier[] = [
  { level: 1, name: 'Curral simples', capacity: 5, cost: 0, scale: 1 },
  { level: 2, name: 'Curral reforçado', capacity: 10, cost: 250, scale: 1.3 },
  { level: 3, name: 'Galinheiro grande', capacity: 20, cost: 600, scale: 1.6 },
];

/** Lã rende bem menos vezes (1 a cada 3 dias), então vale bem mais por unidade pra compensar. */
export const PRODUCTS: Record<AnimalProduct, { name: string; emoji: string; sellPrice: number }> = {
  egg: { name: 'Ovo', emoji: '🥚', sellPrice: 8 },
  milk: { name: 'Leite', emoji: '🥛', sellPrice: 14 },
  wool: { name: 'Lã', emoji: '🧶', sellPrice: 70 },
};
