import { CROPS, CropType } from '../data/crops';
import { AXE_PRICE, PICKAXE_PRICE, SEED_UNLOCK_COST, SILO_TIERS, TRUCK_TIERS } from '../data/upgrades';
import { CropSystem } from './CropSystem';
import { EconomySystem, FENCE_PRICE, Inventory } from './EconomySystem';
import { Farm, FenceDir } from './Farm';
import { SaveSystem } from './SaveSystem';
import { generateQuest, Quest } from './QuestSystem';
import { pendingEggs, pendingMilk, pendingWool } from './AnimalSystem';
import { AnimalProduct, CHICKEN_PRICE, COOP_BASE_COST, COOP_TIERS, COW_PRICE, PASTURE_TILE_PRICE, PRODUCTS, SHEEP_PRICE } from '../data/animals';

export interface PastureSel { x0: number; z0: number; x1: number; z1: number }
import { LOAD_MS, TruckSystem } from './TruckSystem';

export type Tool = { kind: 'seed'; crop: CropType } | { kind: 'hoe' } | { kind: 'fence' } | { kind: 'demolish' } | { kind: 'axe' } | { kind: 'pickaxe' };
export type GameEvent =
  | { type: 'harvest'; ix: number; iz: number; crop: CropType; order: number }
  | { type: 'load'; cargo: Inventory };

const sameTool = (a: Tool | null, b: Tool) => !!a && a.kind === b.kind && (a.kind !== 'seed' || b.kind !== 'seed' || a.crop === b.crop);

/** Ponto único do estado lógico. Extensões futuras (clima, missões, NPCs) entram como sistemas aqui. */
export class Game {
  readonly farm = new Farm();
  readonly crops = new CropSystem();
  readonly economy = new EconomySystem();
  readonly truck = new TruckSystem();
  selectedTool: Tool | null = null;
  mailboxOpen = false;
  private quest: Quest | null = null;
  pastureSelecting = false;
  pastureSel: PastureSel | null = null;
  private listeners = new Set<() => void>();
  private evListeners = new Set<(e: GameEvent) => void>();
  private msgFn: (m: string) => void = () => {};

  constructor() {
    const s = SaveSystem.load();
    if (s) {
      this.economy.coins = s.coins;
      this.economy.inventory = { ...this.economy.inventory, ...s.inventory };
      this.economy.fences = s.fences ?? 0;
      this.economy.siloTier = s.siloTier ?? 1;
      this.economy.hasAxe = s.hasAxe ?? false;
      this.economy.hasPickaxe = s.hasPickaxe ?? false;
      if (s.unlockedCrops) this.economy.unlockedCrops = new Set(s.unlockedCrops);
      if (s.freeSeeds) this.economy.freeSeeds = { ...s.freeSeeds };
      if (s.quest) this.quest = s.quest;
      this.economy.hasCoop = s.hasCoop ?? false; this.economy.coopTier = s.coopTier ?? 1;
      this.economy.chickens = s.chickens ?? 0; this.economy.cows = s.cows ?? 0; this.economy.sheep = s.sheep ?? 0;
      if (s.animalInventory) this.economy.animalInventory = { ...this.economy.animalInventory, ...s.animalInventory };
      if (s.lastCollected) this.economy.lastCollected = { ...this.economy.lastCollected, ...s.lastCollected };
      if (s.farmRadius) this.farm.radius = s.farmRadius;
      if (s.farmFences) for (const k of s.farmFences) this.farm.fences.add(k);
      for (const d of s.tiles) {
        const t = this.farm.get(d.ix, d.iz);
        if (t) { t.tilled = d.tilled; t.crop = d.crop; t.plantedAt = d.plantedAt; t.obstacle = d.obstacle ?? null; t.pasture = d.pasture ?? false; }
      }
      if (s.truck) { this.truck.departedAt = s.truck.departedAt; this.truck.cargo = { ...this.truck.cargo, ...s.truck.cargo }; this.truck.tier = s.truck.tier ?? 1; }
    }
    this.tick(Date.now()); // entrega pendente se o caminhão voltou com a página fechada
  }
  onChange(fn: () => void) { this.listeners.add(fn); }
  onMessage(fn: (m: string) => void) { this.msgFn = fn; }
  onEvent(fn: (e: GameEvent) => void) { this.evListeners.add(fn); }
  private fire(e: GameEvent) { this.evListeners.forEach(f => f(e)); }

  selectTool(t: Tool) { this.selectedTool = sameTool(this.selectedTool, t) ? null : t; this.emit(); }

  /** Chamado periodicamente: caminhão que voltou paga a carga. */
  tick(now: number) {
    const pay = this.truck.collect(now);
    if (pay > 0) { this.economy.coins += pay; this.msgFn(`🚚 Caminhão voltou: +${pay} 🪙`); this.commit(); }
  }

  readyCount(now: number) { return this.farm.tiles.filter(t => t.state(now) === 'ready').length; }

  /** Clique ou passo de arraste sobre uma célula do terreno. */
  clickTile(ix: number, iz: number) {
    const tile = this.farm.get(ix, iz); if (!tile) return;
    if (!this.farm.unlocked(ix, iz)) { this.msgFn('Terreno bloqueado — expanda no Mercado'); return; }
    if (tile.pasture) { this.msgFn('Isso é pasto — use a aba Animais'); return; }
    const now = Date.now(), st = tile.state(now);
    if (st === 'ready') {
      if (this.economy.free() <= 0) { this.msgFn('Silo cheio!'); return; }
      const c = this.crops.harvest(tile, now);
      if (c) { this.economy.addItem(c); this.fire({ type: 'harvest', ix, iz, crop: c, order: 0 }); this.msgFn(`+1 ${CROPS[c].name}`); this.commit(); }
      return;
    }
    if (st === 'planted' || st === 'growing') return;
    const tool = this.selectedTool;
    if (tool?.kind === 'axe' || tool?.kind === 'pickaxe') {
      if (!tile.obstacle) return;
      if (tile.obstacle === 'water') { this.msgFn('É água — quem sabe dá pra pescar aqui um dia'); return; }
      if (this.crops.clear(tile, tool.kind)) { this.commit(); } else this.msgFn(tool.kind === 'axe' ? 'Use a picareta na pedra' : 'Use o machado na árvore');
      return;
    }
    if (tile.obstacle) { this.msgFn(tile.obstacle === 'water' ? 'Terreno alagado — não dá pra arar aqui' : tile.obstacle === 'tree' ? 'Corte a árvore com o machado' : 'Quebre a pedra com a picareta'); return; }
    if (!tool || tool.kind === 'fence' || tool.kind === 'demolish') {
      if (tool) this.msgFn('Use essa ferramenta nas bordas do terreno');
      else this.msgFn(tile.tilled ? 'Selecione uma semente' : 'Are o terreno primeiro (enxada)');
      return;
    }
    if (tool.kind === 'hoe') { if (this.crops.till(tile)) this.commit(); return; }
    if (!this.economy.unlockedCrops.has(tool.crop)) { this.msgFn('Semente ainda não liberada'); return; }
    if (!tile.tilled) { this.msgFn('Are o terreno primeiro'); return; }
    const def = CROPS[tool.crop], free = this.economy.freeSeeds[tool.crop] ?? 0;
    if (free > 0) this.economy.freeSeeds[tool.crop] = free - 1;
    else if (!this.economy.spend(def.seedCost)) { this.msgFn('Moedas insuficientes'); return; }
    this.crops.plant(tile, tool.crop, now);
    this.commit();
  }

  /** Clique numa borda do terreno (para colocar/demolir cerca). */
  clickEdge(ix: number, iz: number, dir: FenceDir) {
    const tool = this.selectedTool; if (!tool) return;
    if (tool.kind === 'fence') {
      if (!this.farm.isBoundary(ix, iz, dir)) { this.msgFn('Só nas bordas do terreno liberado'); return; }
      if (this.farm.hasFence(ix, iz, dir)) return;
      if (this.economy.fences <= 0) { this.msgFn('Sem cercas — compre no Mercado'); return; }
      this.economy.fences--; this.farm.fences.add(this.farm.fenceKey(ix, iz, dir)); this.farm.fenceVersion++;
      this.commit();
    } else if (tool.kind === 'demolish') {
      const k = this.farm.fenceKey(ix, iz, dir);
      if (!this.farm.fences.has(k)) return;
      this.farm.fences.delete(k); this.farm.fenceVersion++;
      this.msgFn('Cerca demolida'); this.commit();
    }
  }

  harvestAll() {
    const now = Date.now(); let n = 0, full = false;
    for (const t of this.farm.tiles) {
      if (!this.farm.unlocked(t.ix, t.iz) || t.state(now) !== 'ready') continue;
      if (this.economy.free() <= 0) { full = true; break; }
      const c = this.crops.harvest(t, now);
      if (c) { this.economy.addItem(c); this.fire({ type: 'harvest', ix: t.ix, iz: t.iz, crop: c, order: n }); n++; }
    }
    if (n) { this.msgFn(full ? `+${n} colhidos — silo cheio!` : `+${n} colhidos`); this.commit(); }
    else this.msgFn(full ? 'Silo cheio!' : 'Nada pronto para colher');
  }

  /** Carrega o caminhão (respeita a capacidade do nível atual) e o envia; o pagamento chega quando ele volta. */
  sellAll() {
    const now = Date.now();
    this.tick(now);
    if (this.truck.isAway(now)) { this.msgFn('Caminhão em viagem…'); return; }
    const n = this.truck.load(this.economy.inventory, now);
    if (!n) { this.msgFn('Nada para vender'); return; }
    this.truck.departedAt = now + LOAD_MS; // parte logo após o carregamento
    this.msgFn(`🚚 Carregando ${n} itens…`);
    this.fire({ type: 'load', cargo: { ...this.truck.cargo } });
    this.commit();
  }

  buyFence() {
    if (!this.economy.spend(FENCE_PRICE)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.fences++; this.msgFn('+1 cerca'); this.commit();
  }
  expandFarm() {
    const cost = this.farm.expandCost();
    if (cost === null) { this.msgFn('Terreno já no tamanho máximo'); return; }
    if (!this.economy.spend(cost)) { this.msgFn('Moedas insuficientes'); return; }
    const { treasureBonus } = this.farm.expand();
    if (treasureBonus) { this.economy.coins += treasureBonus; this.msgFn(`🚜 Terreno expandido! Achou um tesouro enterrado: +${treasureBonus} 🪙`); }
    else this.msgFn('🚜 Terreno expandido! Tem árvores, pedras... e talvez algo mais.');
    this.commit();
  }

  openMailbox() { this.mailboxOpen = !this.mailboxOpen; this.emit(); }
  /** Um único pedido ativo por vez; troca quando entregue ou quando o prazo estoura. */
  currentQuest(now = Date.now()): Quest {
    if (!this.quest || now > this.quest.createdAt + this.quest.deadlineMs) {
      this.quest = generateQuest(now, [...this.economy.unlockedCrops], now);
    }
    return this.quest;
  }
  deliverQuest() {
    const now = Date.now(), q = this.currentQuest(now);
    if (this.economy.inventory[q.crop] < q.qty) { this.msgFn('Itens insuficientes'); return; }
    this.economy.inventory[q.crop] -= q.qty;
    if (q.rewardType === 'coins') { this.economy.coins += q.rewardCoins; this.msgFn(`📬 Pedido entregue! +${q.rewardCoins} 🪙`); }
    else { this.economy.freeSeeds[q.crop] = (this.economy.freeSeeds[q.crop] ?? 0) + q.rewardSeeds; this.msgFn(`📬 Pedido entregue! +${q.rewardSeeds} sementes grátis de ${CROPS[q.crop].name}`); }
    this.quest = generateQuest(now + 1, [...this.economy.unlockedCrops], now); // novo pedido já disponível
    this.commit();
  }
  buySeedLicense() {
    const crop = this.economy.nextLockedCrop();
    if (!crop) { this.msgFn('Todas as sementes já liberadas'); return; }
    const cost = SEED_UNLOCK_COST[crop]!;
    if (!this.economy.spend(cost)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.unlockedCrops.add(crop);
    this.msgFn(`🔓 ${CROPS[crop].name} liberado!`); this.commit();
  }
  upgradeSilo() {
    const next = SILO_TIERS[this.economy.siloTier];
    if (!next) { this.msgFn('Silo já no nível máximo'); return; }
    if (!this.economy.spend(next.cost)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.siloTier = next.level;
    this.msgFn(`🏚️ ${next.name} construído!`); this.commit();
  }
  upgradeTruck() {
    const next = TRUCK_TIERS[this.truck.tier];
    if (!next) { this.msgFn('Caminhão já no nível máximo'); return; }
    if (!this.economy.spend(next.cost)) { this.msgFn('Moedas insuficientes'); return; }
    this.truck.tier = next.level;
    this.msgFn(`🚚 ${next.name} adquirido!`); this.commit();
  }
  buyAxe() {
    if (this.economy.hasAxe) return;
    if (!this.economy.spend(AXE_PRICE)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.hasAxe = true; this.msgFn('🪓 Machado comprado!'); this.commit();
  }
  buyPickaxe() {
    if (this.economy.hasPickaxe) return;
    if (!this.economy.spend(PICKAXE_PRICE)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.hasPickaxe = true; this.msgFn('⛏️ Picareta comprada!'); this.commit();
  }

  // --- Animais: curral/galinhas ---
  buyCoop() {
    if (this.economy.hasCoop) return;
    if (!this.economy.spend(COOP_BASE_COST)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.hasCoop = true; this.economy.coopTier = 1;
    this.msgFn('🐔 Curral construído!'); this.commit();
  }
  upgradeCoop() {
    const next = COOP_TIERS[this.economy.coopTier];
    if (!next) { this.msgFn('Curral já no nível máximo'); return; }
    if (!this.economy.spend(next.cost)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.coopTier = next.level;
    this.msgFn(`🐔 ${next.name} construído!`); this.commit();
  }
  buyChicken() {
    if (!this.economy.hasCoop) { this.msgFn('Compre o curral primeiro'); return; }
    if (this.economy.chickens >= COOP_TIERS[this.economy.coopTier - 1].capacity) { this.msgFn('Curral cheio'); return; }
    if (!this.economy.spend(CHICKEN_PRICE)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.chickens++; this.msgFn('+1 🐔'); this.commit();
  }

  // --- Animais: pasto (comprado por bloco, seleção por arraste) ---
  pastureCapacity() { return this.farm.pastureCount(); }
  startPastureMode() { this.pastureSelecting = true; this.pastureSel = null; this.emit(); }
  cancelPastureMode() { this.pastureSelecting = false; this.pastureSel = null; this.emit(); }
  setPastureSelection(a: [number, number], b: [number, number]) {
    this.pastureSel = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
    this.emit();
  }
  private pastureTiles(sel: PastureSel) {
    const out: { ix: number; iz: number }[] = [];
    for (let iz = sel.z0; iz <= sel.z1; iz++) for (let ix = sel.x0; ix <= sel.x1; ix++) out.push({ ix, iz });
    return out;
  }
  pastureSelectionValid(): boolean {
    if (!this.pastureSel) return false;
    for (const { ix, iz } of this.pastureTiles(this.pastureSel)) {
      if (!this.farm.unlocked(ix, iz)) return false;
      const t = this.farm.get(ix, iz);
      if (!t || t.obstacle || t.crop || t.pasture) return false;
    }
    return true;
  }
  pastureSelectionCost(): number { return this.pastureSel ? this.pastureTiles(this.pastureSel).length * PASTURE_TILE_PRICE : 0; }
  confirmPasture() {
    if (!this.pastureSelectionValid() || !this.pastureSel) { this.msgFn('Área inválida'); return; }
    const cost = this.pastureSelectionCost();
    if (!this.economy.spend(cost)) { this.msgFn('Moedas insuficientes'); return; }
    const sel = this.pastureSel, tiles = this.pastureTiles(sel);
    for (const { ix, iz } of tiles) { const t = this.farm.get(ix, iz)!; t.pasture = true; t.tilled = false; }
    const inRect = (ix: number, iz: number) => ix >= sel.x0 && ix <= sel.x1 && iz >= sel.z0 && iz <= sel.z1;
    const STEP: Record<'n' | 's' | 'e' | 'w', [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    for (const { ix, iz } of tiles) for (const dir of ['n', 's', 'e', 'w'] as const) {
      const [dx, dz] = STEP[dir];
      if (!inRect(ix + dx, iz + dz)) this.farm.fences.add(this.farm.fenceKey(ix, iz, dir));
    }
    this.farm.fenceVersion++;
    this.pastureSelecting = false; this.pastureSel = null;
    this.msgFn('🐄 Pasto criado, já cercado!'); this.commit();
  }

  buyCow() {
    if (this.economy.cows + this.economy.sheep >= this.pastureCapacity()) { this.msgFn('Pasto cheio — compre mais área'); return; }
    if (!this.economy.spend(COW_PRICE)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.cows++; this.msgFn('+1 🐄'); this.commit();
  }
  buySheep() {
    if (this.economy.cows + this.economy.sheep >= this.pastureCapacity()) { this.msgFn('Pasto cheio — compre mais área'); return; }
    if (!this.economy.spend(SHEEP_PRICE)) { this.msgFn('Moedas insuficientes'); return; }
    this.economy.sheep++; this.msgFn('+1 🐑'); this.commit();
  }

  pendingProduct(kind: AnimalProduct, now = Date.now()): number {
    const e = this.economy, lc = e.lastCollected[kind];
    return kind === 'egg' ? pendingEggs(e.chickens, lc, now) : kind === 'milk' ? pendingMilk(e.cows, lc, now) : pendingWool(e.sheep, lc, now);
  }
  collectProduct(kind: AnimalProduct) {
    const now = Date.now(), pend = this.pendingProduct(kind, now);
    if (pend <= 0) return;
    this.economy.animalInventory[kind] += pend; this.economy.lastCollected[kind] = now;
    this.msgFn(`+${pend} ${PRODUCTS[kind].emoji}`); this.commit();
  }
  sellAnimalProduct(kind: AnimalProduct) {
    const qty = this.economy.animalInventory[kind]; if (!qty) return;
    const gain = qty * PRODUCTS[kind].sellPrice;
    this.economy.animalInventory[kind] = 0; this.economy.coins += gain;
    this.msgFn(`+${gain} 🪙`); this.commit();
  }

  private commit() {
    SaveSystem.save({
      v: 6, coins: this.economy.coins, inventory: this.economy.inventory, fences: this.economy.fences,
      unlockedCrops: [...this.economy.unlockedCrops], siloTier: this.economy.siloTier,
      hasAxe: this.economy.hasAxe, hasPickaxe: this.economy.hasPickaxe,
      freeSeeds: this.economy.freeSeeds, quest: this.quest ?? undefined,
      hasCoop: this.economy.hasCoop, coopTier: this.economy.coopTier,
      chickens: this.economy.chickens, cows: this.economy.cows, sheep: this.economy.sheep,
      animalInventory: this.economy.animalInventory, lastCollected: this.economy.lastCollected,
      farmRadius: this.farm.radius, farmFences: [...this.farm.fences],
      truck: { departedAt: this.truck.departedAt, cargo: this.truck.cargo, tier: this.truck.tier },
      tiles: this.farm.tiles.map(t => ({ ix: t.ix, iz: t.iz, tilled: t.tilled, crop: t.crop, plantedAt: t.plantedAt, obstacle: t.obstacle, pasture: t.pasture })),
    });
    this.emit();
  }
  private emit() { this.listeners.forEach(f => f()); }
}
