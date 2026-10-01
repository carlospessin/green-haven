import { IsometricCamera } from '../camera/IsometricCamera';
import { CROPS } from '../data/crops';
import { Farm } from '../game/Farm';
import { FarmTile } from '../game/FarmTile';
import { FarmScene } from '../scenes/FarmScene';

/** Balões HTML ancorados no mundo 3D, sobre cada colheita pronta. */
export class Balloons {
  private root = document.createElement('div');
  private els = new Map<FarmTile, HTMLDivElement>();

  constructor(private cam: IsometricCamera, private scene: FarmScene, private farm: Farm) {
    this.root.className = 'balloons';
    document.body.appendChild(this.root);
  }

  update(now: number) {
    for (const t of this.farm.tiles) {
      let el = this.els.get(t);
      if (t.state(now) !== 'ready' || !t.crop) { if (el) { el.remove(); this.els.delete(t); } continue; }
      if (!el) {
        el = document.createElement('div'); el.className = 'balloon';
        el.innerHTML = `<span>${CROPS[t.crop].emoji}</span>`;
        this.root.appendChild(el); this.els.set(t, el);
      }
      const p = this.scene.cellToWorld(t.ix, t.iz); p.y = 1.7;
      const s = this.cam.toScreen(p);
      el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    }
  }
}
