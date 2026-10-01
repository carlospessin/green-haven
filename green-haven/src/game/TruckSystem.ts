import { CROP_LIST } from '../data/crops';
import { Inventory } from './EconomySystem';
import { currentPrice } from './PriceSystem';
import { TRUCK_TIERS } from '../data/upgrades';

export const TRIP_MS = 60_000;
export const LOAD_MS = 1800;   // tempo de carregamento antes de partir
export const FLIGHT_MS = 550;  // duração do voo de cada item silo -> caminhão
export const staggerMs = (n: number) => Math.min(80, (LOAD_MS - FLIGHT_MS - 150) / Math.max(1, n));
const zero = (): Inventory => ({ wheat: 0, corn: 0, tomato: 0 });

/** Estado do caminhão derivado de departedAt (sobrevive a fechar a página). */
export class TruckSystem {
  departedAt = 0;
  cargo: Inventory = zero();
  tier = 1;

  capacity() { return TRUCK_TIERS[this.tier - 1].capacity; }
  loading(now: number) { return this.departedAt > now; }
  isAway(now: number) { return this.departedAt > 0 && now - this.departedAt < TRIP_MS; }
  remainingMs(now: number) { return Math.max(0, this.departedAt + TRIP_MS - now); }
  cargoCount(c: Inventory = this.cargo) { return CROP_LIST.reduce((s, x) => s + c[x.id], 0); }
  value(c: Inventory, now: number) { return CROP_LIST.reduce((s, x) => s + c[x.id] * currentPrice(x.id, now), 0); }

  /** O que seria carregado do inventário (prioriza o item mais valioso no momento, até a capacidade). */
  plan(inv: Inventory, now: number): Inventory {
    const out = zero(); let room = this.capacity();
    for (const c of [...CROP_LIST].sort((a, b) => currentPrice(b.id, now) - currentPrice(a.id, now))) {
      const n = Math.min(room, inv[c.id]); out[c.id] = n; room -= n;
    }
    return out;
  }
  load(inv: Inventory, now: number): number {
    const p = this.plan(inv, now);
    for (const c of CROP_LIST) { inv[c.id] -= p[c.id]; this.cargo[c.id] = p[c.id]; }
    return this.cargoCount(p);
  }
  /** Se o caminhão já voltou, entrega a carga e devolve o pagamento (ao preço de quando partiu). */
  collect(now: number): number {
    if (this.departedAt === 0 || this.isAway(now)) return 0;
    const v = this.value(this.cargo, this.departedAt - LOAD_MS);
    this.cargo = zero(); this.departedAt = 0;
    return v;
  }
}
