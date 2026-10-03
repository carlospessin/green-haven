export const DOCK_PRICE = 80; // moedas pra construir um deck (não precisa de madeira)
export const BARN_WOOD_COST = 40; // madeira pra erguer um galpão num terreno novo
export const ZONE_SILO_COST = 300; // moedas pra erguer o armazém desse terreno

export interface DockTier { level: number; name: string; yieldPerDay: number; cost: number }
export const DOCK_TIERS: DockTier[] = [
  { level: 1, name: 'Deck simples', yieldPerDay: 5, cost: 0 },
  { level: 2, name: 'Deck reforçado', yieldPerDay: 9, cost: 300 },
  { level: 3, name: 'Deck com rede', yieldPerDay: 14, cost: 700 },
];
