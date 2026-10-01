import { FarmTile } from './FarmTile';

export type FenceDir = 'n' | 's' | 'e' | 'w';
const STEP: Record<FenceDir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Gerador determinístico simples (mesmo terreno sempre gera os mesmos obstáculos). */
function rand(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

/** Terreno expansível: grid fixa (size), mas só os tiles dentro de `radius` do centro estão liberados. */
export class Farm {
  readonly size = 9;
  radius = 2; // 2 => 5x5 liberado; máximo 4 => 9x9
  readonly maxRadius = 4;
  readonly tiles: FarmTile[] = [];
  readonly fences = new Set<string>(); // chave `${ix},${iz},${dir}` = cerca colocada nessa borda
  fenceVersion = 0;

  constructor() {
    for (let z = 0; z < this.size; z++) for (let x = 0; x < this.size; x++) this.tiles.push(new FarmTile(x, z));
  }
  get(ix: number, iz: number): FarmTile | undefined {
    if (ix < 0 || iz < 0 || ix >= this.size || iz >= this.size) return undefined;
    return this.tiles[iz * this.size + ix];
  }
  private center() { return (this.size - 1) / 2; }
  private ring(ix: number, iz: number) { return Math.max(Math.abs(ix - this.center()), Math.abs(iz - this.center())); }
  unlocked(ix: number, iz: number): boolean { return this.ring(ix, iz) <= this.radius; }
  /** true se (ix,iz) está liberado e o vizinho nessa direção não está (ou seja, é uma borda do terreno atual). */
  isBoundary(ix: number, iz: number, dir: FenceDir): boolean {
    if (!this.unlocked(ix, iz)) return false;
    const [dx, dz] = STEP[dir];
    return !this.unlocked(ix + dx, iz + dz);
  }
  fenceKey(ix: number, iz: number, dir: FenceDir) { return `${ix},${iz},${dir}`; }
  pastureCount(): number { return this.tiles.filter(t => t.pasture).length; }
  hasFence(ix: number, iz: number, dir: FenceDir) { return this.fences.has(this.fenceKey(ix, iz, dir)); }

  expandCost(): number | null {
    const costs = [300, 700, 1400];
    return this.radius >= this.maxRadius ? null : costs[this.radius - 2];
  }
  /**
   * Expande o raio liberado; a nova faixa nasce com árvores/pedras aleatórias para limpar e,
   * raramente, uma poça d'água (decorativa, permanente) ou um tesouro (bônus imediato de moedas).
   */
  expand(): { treasureBonus: number | null } {
    if (this.radius >= this.maxRadius) return { treasureBonus: null };
    const oldRadius = this.radius;
    this.radius++;
    let treasureBonus: number | null = null, waterPlaced = false, treasurePlaced = false;
    for (const t of this.tiles) {
      if (this.ring(t.ix, t.iz) > oldRadius && this.ring(t.ix, t.iz) <= this.radius) {
        const r = rand(t.ix * 31 + t.iz * 17 + this.radius * 7);
        if (!waterPlaced && r < 0.05) { t.obstacle = 'water'; waterPlaced = true; continue; }
        if (!treasurePlaced && r < 0.11) { treasurePlaced = true; treasureBonus = 80 + Math.floor(rand(t.ix * 53 + t.iz * 19) * 120); continue; }
        t.obstacle = r < 0.46 ? 'tree' : r < 0.71 ? 'rock' : null;
      }
    }
    // cercas que não estão mais na borda (ficaram "por dentro" do terreno expandido) são removidas
    for (const k of [...this.fences]) {
      const [ix, iz, dir] = k.split(',') as [string, string, FenceDir];
      if (!this.isBoundary(+ix, +iz, dir)) this.fences.delete(k);
    }
    this.fenceVersion++;
    return { treasureBonus };
  }
}
