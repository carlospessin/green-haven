import { IsometricCamera } from '../camera/IsometricCamera';
import { BIOMES } from '../data/biomes';
import { Game } from '../game/Game';
import { FarmScene } from '../scenes/FarmScene';

export class FarmInput {
  private dragging = false;
  private lastCell = '';
  private pastureAnchor: [number, number] | null = null;
  private tooltip: HTMLDivElement;

  constructor(private canvas: HTMLCanvasElement, private cam: IsometricCamera, private scene: FarmScene, private game: Game) {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'zonetip';
    this.tooltip.hidden = true;
    document.body.appendChild(this.tooltip);
    canvas.addEventListener('pointerdown', e => this.act(e, true));
    canvas.addEventListener('pointermove', e => this.act(e, false));
    window.addEventListener('pointerup', () => { this.dragging = false; this.lastCell = ''; this.pastureAnchor = null; });
    canvas.addEventListener('pointerleave', () => { this.scene.setHover(null); this.scene.setHoverEdge(null); this.tooltip.hidden = true; });
  }

  private worldXZ(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const { origin, dir } = this.cam.ray(e.clientX - r.left, e.clientY - r.top);
    const t = (0.1 - origin.y) / dir.y; // plano do solo cultivável
    return [origin.x + dir.x * t, origin.z + dir.z * t] as const;
  }

  /** Testa se (sx,sy) na tela está sobre a placa de algum terreno vizinho (1..4); devolve o índice da zona. */
  private markerHit(sx: number, sy: number): number | null {
    for (let i = 1; i < this.game.zones.length; i++) {
      const wp = this.scene.zoneMarkerWorldPos(i); if (!wp) continue;
      const sp = this.cam.toScreen(wp);
      if (Math.hypot(sx - sp.x, sy - sp.y) < 34) return i;
    }
    return null;
  }

  private act(e: PointerEvent, start: boolean) {
    const r = this.canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;

    const hit = this.markerHit(sx, sy);
    if (hit !== null) {
      const z = this.game.zones[hit];
      this.tooltip.hidden = false;
      this.tooltip.style.left = `${sx}px`; this.tooltip.style.top = `${sy}px`;
      this.tooltip.innerHTML = z.owned
        ? `<b>${BIOMES[z.biome].emoji} ${BIOMES[z.biome].name}</b><br><small>clique pra centralizar</small>`
        : `<b>🌫️ ${BIOMES[z.biome].emoji} ${BIOMES[z.biome].name}</b><br>🪙${this.game.zoneCost(hit)} — clique pra desbravar`;
      if (start) { if (z.owned) this.game.switchZone(hit); else this.game.buyCornerZone(hit); }
      return;
    }
    this.tooltip.hidden = true;

    if (start && !this.game.pastureSelecting && this.game.activeZone === 0) {
      const mp = this.cam.toScreen(this.scene.mailboxWorldPos());
      if (Math.hypot(sx - mp.x, sy - mp.y) < 30) { this.game.openMailbox(); return; }
    }
    const [wx, wz] = this.worldXZ(e);

    if (this.game.pastureSelecting) {
      const cell = this.scene.cellFromWorld(wx, wz);
      this.scene.setHover(cell);
      if (!cell) return;
      if (start) this.pastureAnchor = cell;
      if (this.pastureAnchor) this.game.setPastureSelection(this.pastureAnchor, cell);
      return;
    }

    const tool = this.game.selectedTool;
    if (tool && (tool.kind === 'fence' || tool.kind === 'demolish')) {
      const edge = this.scene.edgeFromWorld(wx, wz);
      this.scene.setHoverEdge(edge);
      this.scene.setHover(null);
      if (start && edge) this.game.clickEdge(edge[0], edge[1], edge[2]);
      return;
    }
    const cell = this.scene.cellFromWorld(wx, wz);
    this.scene.setHover(cell);
    this.scene.setHoverEdge(null);
    if (!cell) { this.lastCell = ''; return; }
    const key = `${cell[0]},${cell[1]}`;
    if (start) { this.dragging = true; this.lastCell = key; this.game.clickTile(cell[0], cell[1]); }
    else if (this.dragging && key !== this.lastCell) { this.lastCell = key; this.game.clickTile(cell[0], cell[1]); }
  }
}
