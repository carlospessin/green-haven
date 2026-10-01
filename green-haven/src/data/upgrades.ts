import { CropType } from './crops';

export const SEED_UNLOCK_ORDER: CropType[] = ['wheat', 'corn', 'tomato'];
export const SEED_UNLOCK_COST: Partial<Record<CropType, number>> = { corn: 150, tomato: 500 };

export interface SiloTier { level: number; name: string; capacity: number; cost: number; color: string; scale: number }
export const SILO_TIERS: SiloTier[] = [
  { level: 1, name: 'Silo de madeira', capacity: 100, cost: 0, color: '#ebe8e0', scale: 1 },
  { level: 2, name: 'Silo de metal', capacity: 250, cost: 400, color: '#b9c2c9', scale: 1.25 },
  { level: 3, name: 'Elevador de grãos', capacity: 600, cost: 1200, color: '#8a97a6', scale: 1.55 },
];

export interface TruckTier { level: number; name: string; capacity: number; cost: number; color: string; scale: number }
export const TRUCK_TIERS: TruckTier[] = [
  { level: 1, name: 'Picape', capacity: 25, cost: 0, color: '#3e7cb1', scale: 1 },
  { level: 2, name: 'Caminhão médio', capacity: 50, cost: 500, color: '#3a8a5c', scale: 1.3 },
  { level: 3, name: 'Carreta', capacity: 100, cost: 1500, color: '#a13e3e', scale: 1.6 },
];

export const AXE_PRICE = 100, PICKAXE_PRICE = 150;
