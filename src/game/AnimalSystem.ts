import { ECON_DAY_MS } from './EconomyTime';

/** Produção acumulada desde a última coleta — contagem atual × tempo decorrido (simplificação: não pondera mudanças de contagem no meio do período). */
export const pendingEggs = (chickens: number, lastCollected: number, now: number) => Math.floor(chickens * (now - lastCollected) / ECON_DAY_MS);
export const pendingMilk = (cows: number, lastCollected: number, now: number) => Math.floor(cows * (now - lastCollected) / ECON_DAY_MS);
export const pendingWool = (sheep: number, lastCollected: number, now: number) => Math.floor(sheep * (now - lastCollected) / (ECON_DAY_MS * 3));
