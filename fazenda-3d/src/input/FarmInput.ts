import { IsometricCamera } from '../camera/IsometricCamera';
import { Game } from '../game/Game';
import { FarmScene } from '../scenes/FarmScene';

export class FarmInput {
  private dragging = false;
  private lastCell = '';
  private pastureAnchor: [number, number] | null = null;

  constructor(private canvas: HTMLCanvasElement, private cam: IsometricCamera, private scene: FarmScene, private game: Game) {
    canvas.addEventListener('pointerdown', e => this.act(e, true));
    canvas.addEventListener('pointermove', e => this.act(e, false));
    window.addEventListener('pointerup', () => { this.dragging = false; this.lastCell = ''; this.pastureAnchor = null; });
    canvas.addEventListener('pointerleave', () => { this.scene.setHover(null); this.scene.setHoverEdge(null); });
  }

  private worldXZ(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const { origin, dir } = this.cam.ray(e.clientX - r.left, e.clientY - r.top);
    const t = (0.1 - origin.y) / dir.y; // plano do solo cultivável
    return [origin.x + dir.x * t, origin.z + dir.z * t] as const;
  }

  private act(e: PointerEvent, start: boolean) {
    if (start && !this.game.pastureSelecting) {
      const r = this.canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
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

