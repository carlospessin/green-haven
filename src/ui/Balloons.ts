import { IsometricCamera } from '../camera/IsometricCamera';
import { CROPS } from '../data/crops';
import { FarmTile } from '../game/FarmTile';
import { Game } from '../game/Game';
import { FarmScene } from '../scenes/FarmScene';

/** Balões HTML ancorados no mundo 3D, sobre cada colheita pronta da zona ativa. */
export class Balloons {
  private root = document.createElement('div');
  private els = new Map<FarmTile, HTMLDivElement>();

  constructor(private cam: IsometricCamera, private scene: FarmScene, private game: Game) {
    this.root.className = 'balloons';
    document.body.appendChild(this.root);
  }

  update(now: number) {
    const farm = this.game.farm, live = new Set<FarmTile>();
    for (const t of farm.tiles) {
      if (t.state(now) !== 'ready' || !t.crop) continue;
      live.add(t);
      let el = this.els.get(t);
      if (!el) {
        el = document.createElement('div'); el.className = 'balloon';
        el.innerHTML = `<span>${CROPS[t.crop].emoji}</span>`;
        this.root.appendChild(el); this.els.set(t, el);
      }
      const p = this.scene.cellToWorld(t.ix, t.iz); p.y = 1.7;
      const s = this.cam.toScreen(p);
      el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    }
    for (const [t, el] of this.els) if (!live.has(t)) { el.remove(); this.els.delete(t); }
  }
}
