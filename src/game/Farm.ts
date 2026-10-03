import { FarmTile } from './FarmTile';

export type FenceDir = 'n' | 's' | 'e' | 'w';
const STEP: Record<FenceDir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Grid fixa de uma zona/fase do mapa. Diferente do sistema antigo, aqui não há mais anéis bloqueados: a zona inteira já nasce liberada assim que é comprada. */
export class Farm {
  readonly size = 9;
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
  /** Toda a grid da zona está sempre liberada; o método existe só para manter a mesma checagem de bordas. */
  unlocked(_ix: number, _iz: number): boolean { return true; }
  isBoundary(ix: number, iz: number, dir: FenceDir): boolean {
    const [dx, dz] = STEP[dir];
    return !this.get(ix + dx, iz + dz);
  }
  fenceKey(ix: number, iz: number, dir: FenceDir) { return `${ix},${iz},${dir}`; }
  pastureCount(): number { return this.tiles.filter(t => t.pasture).length; }
  hasFence(ix: number, iz: number, dir: FenceDir) { return this.fences.has(this.fenceKey(ix, iz, dir)); }
}
