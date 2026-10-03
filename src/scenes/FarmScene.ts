import * as pc from 'playcanvas';
import { CropType } from '../data/crops';
import { CropStage } from '../game/Crop';
import { FenceDir } from '../game/Farm';
import { FarmTile } from '../game/FarmTile';
import type { Game, GameEvent } from '../game/Game';
import { FLIGHT_MS, LOAD_MS, TRIP_MS, TruckSystem, staggerMs } from '../game/TruckSystem';
import { SILO_TIERS, TRUCK_TIERS } from '../data/upgrades';
import { BIOMES } from '../data/biomes';
import { ghostMat, group, lerpColor, mat, prim } from './build';
import { dayNightPhase } from '../game/DayNight';

export const CELL = 1.1, PLOT_X = -2, PLOT_Z = 1;
const TRUCK_X = 6.2, SILO_X = 8.0, SILO_Z = -6.6;
const ITEM_COLOR: Record<CropType, string> = { wheat: '#e9b84a', corn: '#f4e07a', tomato: '#e0574a' };
const WOOD = '#9a6a45', WOOD2 = '#8a5a3a', RED = '#c8483c', SLATE = '#46546a';

/**
 * Fábrica de modelo por (cultura, estágio). Para usar .glb depois: carregue os assets
 * e devolva `asset.resource.instantiateRenderEntity()` aqui, sem tocar no gameplay.
 */
export function createCropModel(type: CropType, stage: CropStage): pc.Entity {
  const root = new pc.Entity(`crop-${type}-${stage}`);
  root.setLocalPosition(0, 0.1, 0);
  const si = stage === 'seedling' ? 0 : stage === 'growing' ? 1 : 2;
  const spots: [number, number][] = [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28], [0, 0]];
  for (const [dx, dz] of spots) {
    if (type !== 'tomato') {
      if (dx !== 0 || dz !== 0) continue; // trigo e milho: 3 fileiras contínuas por célula
      const wheat = type === 'wheat';
      const th = wheat ? [0.12, 0.28, 0.38][si] : [0.16, 0.55, 0.9][si];
      const w = wheat ? 0.26 : 0.24;
      const col = wheat ? ['#8fd06a', '#c4d45a', '#f2ab2e'][si] : ['#8fd06a', '#6cbb55', '#d6c34a'][si];
      for (const z of [-0.33, 0, 0.33]) prim(root, 'capsule', col, [0, th / 2, z], [th, 0.5, w], [0, 0, 90]);
    } else {
      if (dx === 0) continue;
      const r = [0.16, 0.3, 0.4][si];
      prim(root, 'sphere', ['#7fbf62', '#66a851', '#559a48'][si], [dx * 0.8, r * 0.5, dz * 0.8], [r * 1.6, r * 1.3, r * 1.6]);
      if (si === 2) prim(root, 'sphere', '#e0574a', [dx * 0.8 + 0.12, r * 0.95, dz * 0.8 + 0.1], [0.16, 0.16, 0.16]);
    }
  }
  return root;
}

/** Árvore, pedra ou água bloqueando um tile; some ao ser limpa com machado/picareta (água é permanente). */
function createObstacleModel(kind: 'tree' | 'rock' | 'water'): pc.Entity {
  const root = new pc.Entity(`obstacle-${kind}`);
  if (kind === 'tree') {
    prim(root, 'cylinder', '#8b6a45', [0, 0.28, 0], [0.14, 0.56, 0.14]);
    prim(root, 'sphere', '#6fb078', [0, 0.62, 0], [0.5, 0.55, 0.5]);
  } else if (kind === 'rock') {
    prim(root, 'sphere', '#9a9a94', [0.06, 0.1, 0.04], [0.34, 0.24, 0.3]);
    prim(root, 'sphere', '#b2b2ab', [-0.14, 0.06, -0.08], [0.22, 0.16, 0.2]);
  } else {
    prim(root, 'box', '#3e8fc9', [0, 0.02, 0], [CELL * 0.94, 0.04, CELL * 0.94]); // poça: só decorativa por enquanto
    prim(root, 'box', '#6bb6e0', [0, 0.05, 0], [CELL * 0.6, 0.02, CELL * 0.6]);
  }
  return root;
}

/** Deck de pesca: tábuas de madeira sobre a água, com um poste no canto. */
function createDockModel(): pc.Entity {
  const root = new pc.Entity('dock');
  for (let i = 0; i < 4; i++) prim(root, 'box', '#9a6a45', [-0.33 + i * 0.22, 0.07, 0], [0.18, 0.04, 0.78]);
  prim(root, 'cylinder', '#7a5236', [-0.4, 0.2, -0.33], [0.05, 0.4, 0.05]);
  return root;
}

interface ZoneView { key: string; entity: pc.Entity }

export class FarmScene {
  readonly root = new pc.Entity('farm');
  private zoneGroups: pc.Entity[] = [];
  private zoneFenceGroups: pc.Entity[] = [];
  private zoneViews: Map<FarmTile, ZoneView>[] = [];
  private zoneFenceKey: string[] = [];
  private zoneCloud: (pc.Entity | null)[] = [];
  private zoneMarker: (pc.Entity | null)[] = [];
  private zoneBarn: (pc.Entity | null)[] = [];
  private zoneSilo: (pc.Entity | null)[] = [];
  private zoneBuiltShown: string[] = [];
  private activeZoneIndex = 0;
  private hover!: pc.Entity;
  private hoverEdge!: pc.Entity;
  private activeToolKind: string | null = null;
  private blades!: pc.Entity;
  private animals: { e: pc.Entity; bx: number; bz: number; ph: number; sp: number; r: number }[] = [];
  private t = 0;
  private truck!: pc.Entity;
  private silo!: pc.Entity;
  private siloTierShown = 0;
  private truckTierShown = 0;
  private sun!: pc.Entity;
  private moon!: pc.Entity;
  private sunDisc!: pc.Entity;
  private moonDisc!: pc.Entity;
  private mailbox!: pc.Entity;
  private coopGroup!: pc.Entity;
  private coopPen!: pc.Entity;
  private coopBuilt = false;
  private coopTierShown = 0;
  private chickenCountShown = -1;
  private herdGroup!: pc.Entity;
  private herdKey = '';
  private pastureSelBox!: pc.Entity;
  skyColor = new pc.Color(0.96, 0.91, 0.82);
  private pulse = 0;
  private fx: { e: pc.Entity; a: pc.Vec3; b: pc.Vec3; t0: number; dur: number; h: number; onLand?: () => void }[] = [];
  private cargo!: pc.Entity;
  private cargoKey = '';

  constructor(private app: pc.Application, private game: Game) {
    app.root.addChild(this.root);
    this.buildLight();
    this.buildSharedTable();
    for (let i = 0; i < game.zones.length; i++) this.buildZone(i);
    this.buildHover();
    for (let i = 0; i < game.zones.length; i++) this.syncFencesFor(i);
  }

  private buildZone(i: number) {
    const z = this.game.zones[i];
    const grp = group(this.root, z.dx, 0, z.dz, `zone${i}`);
    this.zoneGroups[i] = grp;
    this.zoneViews[i] = new Map();
    this.zoneFenceGroups[i] = group(grp, 0, 0, 0, 'fences');
    this.zoneFenceKey[i] = '';
    this.buildIsland(grp, BIOMES[z.biome].ground);
    if (i === 0) {
      this.buildBuildings(grp); this.buildNature(grp); this.buildTruck(grp); this.buildMailbox(grp); this.buildCoopBase(grp);
    } else {
      this.zoneCloud[i] = z.owned ? null : this.buildCloudCover(grp);
      this.zoneMarker[i] = this.buildMarker(grp);
      this.zoneBuiltShown[i] = '';
    }
  }

  /** Galpão e armazém simples (menores que os da fazenda) — aparecem quando construídos num terreno vizinho. */
  syncZoneBuildings(i: number) {
    if (i === 0) return;
    const z = this.game.zones[i], key = `${z.hasBarn}|${z.hasSilo}`;
    if (key === this.zoneBuiltShown[i]) return;
    this.zoneBuiltShown[i] = key;
    const grp = this.zoneGroups[i];
    this.zoneBarn[i]?.destroy(); this.zoneBarn[i] = null;
    this.zoneSilo[i]?.destroy(); this.zoneSilo[i] = null;
    if (z.hasBarn) {
      const b = group(grp, -3.2, 0, -3.2, 'zonebarn');
      prim(b, 'box', '#8c5a44', [0, 0.7, 0], [1.8, 1.4, 1.6]);
      prim(b, 'box', SLATE, [0, 1.55, 0], [2.0, 0.14, 1.8], [0, 0, 0]);
      prim(b, 'box', '#f3efe6', [0, 0.5, 0.81], [0.6, 0.8, 0.05]);
      this.zoneBarn[i] = b;
    }
    if (z.hasSilo) {
      const s = group(grp, -1.6, 0, -3.6, 'zonesilo');
      prim(s, 'cylinder', '#ebe8e0', [0, 1.1, 0], [0.75, 2.2, 0.75]);
      prim(s, 'sphere', '#c4c7cc', [0, 2.2, 0], [0.78, 0.55, 0.78]);
      this.zoneSilo[i] = s;
    }
  }

  /** Revela um terreno comprado: some com a nuvem que cobria o interior. */
  revealZone(i: number) {
    const c = this.zoneCloud[i]; if (c) { c.destroy(); this.zoneCloud[i] = null; }
  }

  /** Troca qual terreno recebe cliques de ferramenta (plantar/arar/cercar); também reancora os marcadores de hover nele. */
  setActiveZone(i: number) {
    if (i === this.activeZoneIndex) return;
    this.activeZoneIndex = i;
    const grp = this.zoneGroups[i];
    grp.addChild(this.hover); grp.addChild(this.hoverEdge); grp.addChild(this.pastureSelBox);
    this.hover.enabled = false; this.hoverEdge.enabled = false; this.pastureSelBox.enabled = false;
  }

  // --- coordenadas lógica (local à zona) <-> mundo ---
  cellToWorld(ix: number, iz: number) {
    const n = 9;
    return new pc.Vec3(PLOT_X + (ix - (n - 1) / 2) * CELL, 0, PLOT_Z + (iz - (n - 1) / 2) * CELL);
  }
  /** Picking sempre na zona ativa: converte mundo -> local subtraindo o deslocamento dessa zona. */
  cellFromWorld(x: number, z: number): [number, number] | null {
    const zo = this.game.zones[this.activeZoneIndex], n = 9;
    const lx = x - zo.dx, lz = z - zo.dz;
    const ix = Math.floor((lx - PLOT_X) / CELL + n / 2), iz = Math.floor((lz - PLOT_Z) / CELL + n / 2);
    return ix < 0 || iz < 0 || ix >= n || iz >= n ? null : [ix, iz];
  }
  setHover(c: [number, number] | null) {
    this.hover.enabled = !!c;
    if (c) { const p = this.cellToWorld(c[0], c[1]); this.hover.setPosition(p.x, 0.12, p.z); }
  }
  setHoverEdge(e: [number, number, FenceDir] | null) {
    this.hoverEdge.enabled = !!e;
    if (e) { const p = this.edgeWorld(e[0], e[1], e[2]); this.hoverEdge.setPosition(p.x, 0.15, p.z); this.hoverEdge.setEulerAngles(0, e[2] === 'n' || e[2] === 's' ? 0 : 90, 0); }
  }
  setActiveTool(kind: string | null) { this.activeToolKind = kind; }

  private edgeWorld(ix: number, iz: number, dir: FenceDir) {
    const c = this.cellToWorld(ix, iz), o = CELL / 2;
    return dir === 'n' ? new pc.Vec3(c.x, 0, c.z - o) : dir === 's' ? new pc.Vec3(c.x, 0, c.z + o)
      : dir === 'e' ? new pc.Vec3(c.x + o, 0, c.z) : new pc.Vec3(c.x - o, 0, c.z);
  }
  /** Encontra a borda de célula mais próxima de um ponto do mundo, na zona ativa. */
  edgeFromWorld(x: number, z: number): [number, number, FenceDir] | null {
    const zo = this.game.zones[this.activeZoneIndex], n = 9;
    const lx = x - zo.dx, lz = z - zo.dz;
    const fx = (lx - PLOT_X) / CELL + n / 2, fz = (lz - PLOT_Z) / CELL + n / 2;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    if (ix < 0 || iz < 0 || ix >= n || iz >= n) return null;
    const flx = fx - ix - 0.5, flz = fz - iz - 0.5;
    if (Math.max(Math.abs(flx), Math.abs(flz)) < 0.28) return null; // clique muito no centro da célula
    const dir: FenceDir = Math.abs(flx) > Math.abs(flz) ? (flx > 0 ? 'e' : 'w') : (flz > 0 ? 's' : 'n');
    return [ix, iz, dir];
  }

  zoneMarkerWorldPos(i: number): pc.Vec3 | null { return this.zoneMarker[i]?.getPosition() ?? null; }

  /** Reconstrói as cercas de uma zona: colocadas (bordas do terreno ou perímetro de pasto) + "fantasmas" só na zona ativa com a ferramenta cerca ligada. */
  private syncFencesFor(i: number) {
    const z = this.game.zones[i];
    const key = `${z.farm.fenceVersion}|${i === this.activeZoneIndex && this.activeToolKind === 'fence'}`;
    if (key === this.zoneFenceKey[i]) return;
    this.zoneFenceKey[i] = key;
    const fg = this.zoneFenceGroups[i];
    fg.children.slice().forEach(c => (c as pc.Entity).destroy());
    const dirs: FenceDir[] = ['n', 's', 'e', 'w'];
    const drawFence = (ix: number, iz: number, dir: FenceDir) => {
      const p = this.edgeWorld(ix, iz, dir), yaw = dir === 'n' || dir === 's' ? 0 : 90;
      prim(fg, 'box', WOOD, [p.x, 0.28, p.z], [0.1, 0.56, 0.1], [0, yaw, 0]);
      for (const y of [0.2, 0.4]) prim(fg, 'box', WOOD2, [p.x, y, p.z], [0.05, 0.05, CELL * 0.95], [0, yaw, 0]);
    };
    for (const fk of z.farm.fences) {
      const [ix, iz, dir] = fk.split(',') as [string, string, FenceDir];
      drawFence(+ix, +iz, dir);
    }
    if (i === this.activeZoneIndex && this.activeToolKind === 'fence') {
      for (const t of z.farm.tiles) for (const dir of dirs) {
        if (!z.farm.isBoundary(t.ix, t.iz, dir) || z.farm.hasFence(t.ix, t.iz, dir)) continue;
        const p = this.edgeWorld(t.ix, t.iz, dir), yaw = dir === 'n' || dir === 's' ? 0 : 90;
        const g = prim(fg, 'box', '#ffe27a', [p.x, 0.32, p.z], [0.06, 0.5, CELL * 0.8], [0, yaw, 0]);
        g.render!.material = ghostMat();
      }
    }
  }

  /** Reconstrói só as células cujo estado visual mudou, em todas as zonas. Terrenos ainda não comprados só mostram a borda. */
  sync(now: number) {
    for (let i = 0; i < this.game.zones.length; i++) this.syncZoneTiles(i, now);
  }
  private syncZoneTiles(i: number, now: number) {
    const z = this.game.zones[i], views = this.zoneViews[i], grp = this.zoneGroups[i];
    const borderOnly = i > 0 && !z.owned;
    for (const t of z.farm.tiles) {
      if (borderOnly && t.ix !== 0 && t.ix !== 8 && t.iz !== 0 && t.iz !== 8) {
        const v = views.get(t); if (v) { v.entity.destroy(); views.delete(t); }
        continue;
      }
      const st = t.stage(now);
      const key = `${t.obstacle ?? ''}|${t.dock ? 1 : 0}|${t.pasture ? 1 : 0}|${t.tilled ? 1 : 0}|${t.crop ?? ''}|${st ?? ''}`;
      const v = views.get(t);
      if (v && v.key === key) continue;
      v?.entity.destroy();
      const e = new pc.Entity('tile');
      e.setPosition(this.cellToWorld(t.ix, t.iz));
      if (t.pasture) prim(e, 'box', '#8fcf6a', [0, 0.025, 0], [CELL * 0.96, 0.05, CELL * 0.96]); // pasto: gramado claro cercado
      else if (t.obstacle) { e.addChild(createObstacleModel(t.obstacle)); if (t.obstacle === 'water' && t.dock) e.addChild(createDockModel()); }
      else {
        if (t.tilled || t.crop) prim(e, 'box', '#5e412b', [0, 0.075, 0], [CELL * 0.92, 0.05, CELL * 0.92]);
        if (t.crop && st) e.addChild(createCropModel(t.crop, st));
      }
      grp.addChild(e);
      views.set(t, { key, entity: e });
    }
    this.syncFencesFor(i);
  }

  update(dt: number) {
    this.t += dt;
    this.blades.rotate(0, 0, -dt * 50);
    for (let i = this.fx.length - 1; i >= 0; i--) { // itens em voo (colheita -> silo, silo -> caminhão, ou "poof" local)
      const f = this.fx[i], u = (this.t - f.t0) / f.dur;
      if (u < 0) continue;
      if (u >= 1) { f.e.destroy(); f.onLand?.(); this.fx.splice(i, 1); continue; }
      f.e.enabled = true;
      f.e.setPosition(f.a.x + (f.b.x - f.a.x) * u, f.a.y + (f.b.y - f.a.y) * u + f.h * 4 * u * (1 - u), f.a.z + (f.b.z - f.a.z) * u);
      f.e.rotate(dt * 200, dt * 300, 0);
    }
    if (this.pulse > 0) { this.pulse = Math.max(0, this.pulse - dt * 5); this.silo.setLocalScale(1, 1 + 0.06 * this.pulse, 1); }
    for (const a of this.animals) {
      const th = this.t * a.sp + a.ph;
      a.e.setPosition(a.bx + Math.sin(th) * a.r, Math.abs(Math.sin(th * 5)) * 0.03, a.bz + Math.cos(th) * a.r);
      a.e.setEulerAngles(0, (th * 180) / Math.PI + 90, 0);
    }
  }

  // --- construção da cena ---
  private buildLight() {
    const shadowOpts = { castShadows: true, shadowDistance: 140, normalOffsetBias: 0.04, shadowBias: 0.1 };
    this.sun = new pc.Entity('sun');
    this.sun.addComponent('light', { type: 'directional', color: new pc.Color(1, 0.92, 0.78), intensity: 1.8, shadowType: pc.SHADOW_PCF5_32F, shadowResolution: 4096, ...shadowOpts });
    this.moon = new pc.Entity('moon');
    this.moon.addComponent('light', { type: 'directional', color: new pc.Color(0.55, 0.62, 0.85), intensity: 0.3, shadowType: pc.SHADOW_PCF3_32F, shadowResolution: 2048, ...shadowOpts });
    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: new pc.Color(0.7, 0.8, 1), intensity: 0.2, castShadows: false });
    fill.setEulerAngles(35, 200, 0);
    this.root.addChild(this.sun); this.root.addChild(this.moon); this.root.addChild(fill);
    this.sunDisc = this.makeDisc('#fff3c4');
    this.moonDisc = this.makeDisc('#dfe6f0');
    this.root.addChild(this.sunDisc); this.root.addChild(this.moonDisc);
    this.applyDayNight(Date.now());
  }
  private makeDisc(color: string): pc.Entity {
    const m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color().fromString(color); m.update();
    const e = new pc.Entity('disc');
    e.addComponent('render', { type: 'sphere', material: m, castShadows: false, receiveShadows: false });
    e.setLocalScale(2, 2, 2);
    return e;
  }
  private buildMailbox(r: pc.Entity) {
    this.mailbox = group(r, 9.5, 0, -6.1, 'mailbox'); // ao lado do silo (SILO_X=8, SILO_Z=-6.6)
    prim(this.mailbox, 'cylinder', '#8b6a45', [0, 0.35, 0], [0.07, 0.7, 0.07]);
    prim(this.mailbox, 'box', '#c8483c', [0, 0.78, 0], [0.32, 0.24, 0.5]);
    prim(this.mailbox, 'box', '#f3efe6', [0, 0.9, 0.22], [0.05, 0.05, 0.16], [0, 0, -20]); // bandeirinha
  }
  mailboxWorldPos(): pc.Vec3 { return this.mailbox.getPosition(); }

  /**
   * Sol e lua ficam sempre ligados; só a intensidade/cor deles varia continuamente com `now`
   * (curva senoidal suave), então a troca dia/noite nunca dá um salto — é sempre gradual.
   */
  applyDayNight(now: number) {
    const ph = dayNightPhase(now);
    this.sun.setEulerAngles(15 + ph.dayFactor * 65, ph.azimuthDeg, 0);
    this.moon.setEulerAngles(15 + ph.nightFactor * 65, ph.azimuthDeg + 180, 0);
    this.sun.light!.color = lerpColor(new pc.Color(1, 0.55, 0.35), new pc.Color(1, 0.95, 0.85), ph.dayFactor);
    this.sun.light!.intensity = ph.dayFactor * (0.9 + ph.dayFactor * 1.1);
    this.moon.light!.color = new pc.Color(0.55, 0.62, 0.85);
    this.moon.light!.intensity = ph.nightFactor * (0.15 + ph.nightFactor * 0.35);
    this.app.scene.ambientLight = lerpColor(new pc.Color(0.05, 0.06, 0.11), new pc.Color(0.42, 0.44, 0.52), ph.dayFactor);
    const horizon = new pc.Color(0.97, 0.78, 0.6), noon = new pc.Color(0.96, 0.91, 0.82), night = new pc.Color(0.06, 0.07, 0.14);
    this.skyColor = lerpColor(night, lerpColor(horizon, noon, ph.dayFactor), ph.dayFactor);
    this.sunDisc.enabled = ph.dayFactor > 0.02; this.moonDisc.enabled = ph.nightFactor > 0.02;
    const dist = 26;
    if (this.sunDisc.enabled) { const rad = (ph.azimuthDeg * Math.PI) / 180; this.sunDisc.setPosition(Math.sin(rad) * dist, 2 + ph.dayFactor * 16, -Math.cos(rad) * dist * 0.4 - 6); }
    if (this.moonDisc.enabled) { const rad = ((ph.azimuthDeg + 180) * Math.PI) / 180; this.moonDisc.setPosition(Math.sin(rad) * dist, 2 + ph.nightFactor * 16, -Math.cos(rad) * dist * 0.4 - 6); }
  }

  /** Mesa/chão compartilhado que recebe as sombras sob todas as zonas — uma só vez, cobre o mundo inteiro. */
  private buildSharedTable() {
    prim(this.root, 'box', '#f0e0c6', [0, -1.65, 0], [320, 1, 320]);
  }

  /** Ilha de uma zona: camadas de terra + gramado (cor pelo bioma) + cerca decorativa nas bordas. */
  private buildIsland(r: pc.Entity, groundColor: string) {
    const S = 18;
    prim(r, 'box', '#d9a468', [0, -1.0, 0], [S, 0.3, S]);
    prim(r, 'box', '#8b5e3c', [0, -0.55, 0], [S, 0.6, S]);
    prim(r, 'box', groundColor, [0, -0.15, 0], [S, 0.3, S]);
    this.fence(r, -8.6, -8.6, 8.6, -8.6); this.fence(r, -8.6, -8.6, -8.6, 8.6);
    this.fence(r, -8.6, 8.6, 8.6, 8.6); this.fence(r, 8.6, -8.6, 8.6, 8.6);
  }

  /** Nuvens cobrindo o interior de um terreno ainda não comprado; a borda continua visível por baixo. */
  private buildCloudCover(r: pc.Entity): pc.Entity {
    const cloudGrp = group(r, 0, 0, 0, 'cloudcover');
    const m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(1, 1, 1); m.emissive = new pc.Color(0.9, 0.92, 0.95);
    m.opacity = 0.93; m.blendType = pc.BLEND_NORMAL; m.useMetalness = true; m.metalness = 0; m.update();
    const puff = (x: number, y: number, z: number, s: number) => {
      const e = new pc.Entity('cloud');
      e.addComponent('render', { type: 'sphere', material: m, castShadows: false, receiveShadows: false });
      e.setLocalPosition(x, y, z); e.setLocalScale(s, s * 0.65, s);
      cloudGrp.addChild(e);
    };
    for (let gz = -3; gz <= 3; gz++) for (let gx = -3; gx <= 3; gx++) {
      const wx = PLOT_X + gx * CELL, wz = PLOT_Z + gz * CELL;
      puff(wx + (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 1.1, wz + (Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 0.45);
    }
    return cloudGrp;
  }

  /** Placa indicando o terreno vizinho: mostra bioma/preço (via tooltip de hover) e serve de alvo de clique p/ comprar ou centralizar. */
  private buildMarker(r: pc.Entity): pc.Entity {
    const m = group(r, 0, 0, 0, 'marker');
    prim(m, 'cylinder', '#8b6a45', [0, 0.45, 0], [0.09, 0.9, 0.09]);
    prim(m, 'box', '#f3efe6', [0, 1.0, 0], [0.9, 0.5, 0.06]);
    return m;
  }

  private fence(r: pc.Entity, x1: number, z1: number, x2: number, z2: number) {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.round(len / 1.1), yaw = (Math.atan2(x2 - x1, z2 - z1) * 180) / Math.PI;
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n, z = z1 + ((z2 - z1) * i) / n;
      prim(r, 'box', WOOD, [x, 0.28, z], [0.13, 0.56, 0.13]);
      if (i < n) {
        const mx = x1 + ((x2 - x1) * (i + 0.5)) / n, mz = z1 + ((z2 - z1) * (i + 0.5)) / n;
        for (const y of [0.22, 0.42]) prim(r, 'box', WOOD2, [mx, y, mz], [0.06, 0.06, len / n], [0, yaw, 0]);
      }
    }
  }

  private buildBuildings(r: pc.Entity) {
    const barn = group(r, 4.3, 0, -5.6, 'barn');
    barn.setLocalEulerAngles(0, 90, 0); // porta (+z local) fica voltada para o caminho
    prim(barn, 'box', RED, [0, 1, 0], [3, 2, 2.6]);
    prim(barn, 'box', SLATE, [-0.8, 2.4, 0], [1.95, 0.16, 3.0], [0, 0, 35]);
    prim(barn, 'box', SLATE, [0.8, 2.4, 0], [1.95, 0.16, 3.0], [0, 0, -35]);
    prim(barn, 'box', '#f3efe6', [0, 0.7, 1.31], [1.3, 1.4, 0.06]);
    prim(barn, 'box', '#c8483c', [0, 0.65, 1.35], [1.1, 1.2, 0.05]);
    prim(barn, 'box', '#f3efe6', [0, 0.65, 1.38], [0.08, 1.2, 0.03]);
    prim(barn, 'box', '#f3efe6', [0, 1.7, 1.33], [0.5, 0.35, 0.05]);
    prim(barn, 'box', '#c8483c', [-2.1, 0.6, 0.3], [1.5, 1.2, 2.0]); // puxadinho
    prim(barn, 'box', SLATE, [-2.15, 1.35, 0.3], [1.7, 0.1, 2.2], [0, 0, 22]);
    this.silo = group(r, SILO_X, 0, SILO_Z, 'silo');
    this.syncSiloTier(1);
    const mill = group(r, 6.4, 0, 4.6, 'windmill');
    prim(mill, 'cone', '#efe8d8', [0, 1.7, 0], [1.9, 3.4, 1.9]);
    prim(mill, 'cone', RED, [0, 3.6, 0], [1.5, 0.9, 1.5]);
    const hub = group(mill, 0, 3.0, 0.85, 'hub');
    prim(hub, 'sphere', '#8c4a3a', [0, 0, 0], [0.4, 0.4, 0.4]);
    this.blades = group(hub, 0, 0, 0.15, 'blades');
    prim(this.blades, 'box', '#f3efe6', [0, 0, 0], [0.22, 2.7, 0.05]);
    prim(this.blades, 'box', '#f3efe6', [0, 0, 0], [2.7, 0.22, 0.05]);
    prim(r, 'box', '#e8dfcf', [3.7, 0.02, PLOT_Z], [5.0, 0.04, 1.3]);
    prim(r, 'box', '#e8dfcf', [6.2, 0.02, -1.98], [1.3, 0.04, 7.25]);
    prim(r, 'box', '#e8dfcf', [7.9, 0.02, -1.5], [3.4, 0.04, 1.3]); // saída do caminhão
  }

  private buildNature(r: pc.Entity) {
    const trees: [number, number, number][] = [[-7, -6.5, 1], [-5.5, -7.5, 0.8], [7.5, 7.2, 1.1], [-7.5, 5.5, 1], [1.5, -7.5, 0.9], [-4.5, 7.6, 0.8], [7.8, 0.6, 0.9]];
    trees.forEach(([x, z, s], i) => {
      const t = group(r, x, 0, z, 'tree'); t.setLocalScale(s, s, s);
      prim(t, 'cylinder', '#8b6a45', [0, 0.5, 0], [0.32, 1, 0.32]);
      if (i % 3 === 2) { prim(t, 'cone', '#5fa06a', [0, 1.9, 0], [1.3, 2.4, 1.3]); }
      else { prim(t, 'sphere', i % 2 ? '#8ccc4c' : '#7fc23f', [0, 1.9, 0], [1.35, 2.0, 1.35]); }
    });
    const kinds = [
      { k: 'sheep', x: -6.5, z: -3.2, s: 1 }, { k: 'sheep', x: -5.2, z: -5, s: 0.9 },
      { k: 'cow', x: -6.6, z: 6.2, s: 1.25 }, { k: 'pig', x: 1.8, z: 6.4, s: 0.9 },
    ];
    kinds.forEach((a, i) => {
      const e = group(r, a.x, 0, a.z, a.k); e.setLocalScale(a.s, a.s, a.s);
      const body = a.k === 'pig' ? '#f2b3b0' : '#f4f0e6', head = a.k === 'sheep' ? '#4a4038' : a.k === 'pig' ? '#f0a6a4' : '#e0c3a4';
      prim(e, 'sphere', body, [0, 0.42, 0], [0.55, 0.45, 0.85]);
      prim(e, 'sphere', head, [0, 0.55, 0.5], [0.32, 0.3, 0.32]);
      if (a.k === 'cow') prim(e, 'sphere', '#5a4636', [0.12, 0.55, -0.05], [0.3, 0.2, 0.35]);
      for (const [lx, lz] of [[-0.15, -0.25], [0.15, -0.25], [-0.15, 0.25], [0.15, 0.25]]) prim(e, 'cylinder', head, [lx, 0.12, lz], [0.09, 0.25, 0.09]);
      this.animals.push({ e, bx: a.x, bz: a.z, ph: i * 1.7, sp: 0.25 + i * 0.04, r: 0.9 });
    });
  }

  private buildTruck(r: pc.Entity) {
    this.truck = group(r, 6.2, 0, -1.5, 'truck');
    this.truck.setEulerAngles(0, 90, 0);
    this.truck.enabled = true;
    this.syncTruckTier(1);
  }
  /** Reconstrói a picape/caminhão com a cor da cabine e o tamanho da caçamba do nível comprado. */
  syncTruckTier(tier: number) {
    if (tier === this.truckTierShown) return;
    this.truckTierShown = tier;
    const t = this.truck;
    t.children.slice().forEach(c => (c as pc.Entity).destroy());
    const cfg = TRUCK_TIERS[tier - 1], s = cfg.scale, bed = 2.8 * (1 + (s - 1) * 0.6);
    prim(t, 'box', '#3a3f4a', [0, 0.4 * s, 0], [1.0 * s, 0.2 * s, bed]);
    prim(t, 'box', '#b08a5a', [0, 0.52 * s, -bed * 0.18], [1.2 * s, 0.12 * s, bed * 0.6]);
    for (const x of [-0.6 * s, 0.6 * s]) prim(t, 'box', '#c9a06c', [x, 0.78 * s, -bed * 0.18], [0.08, 0.36 * s, bed * 0.6]);
    prim(t, 'box', '#c9a06c', [0, 0.78 * s, -bed * 0.48], [1.2 * s, 0.36 * s, 0.08]);
    prim(t, 'box', '#c9a06c', [0, 0.85 * s, bed * 0.13], [1.2 * s, 0.5 * s, 0.08]);
    prim(t, 'box', cfg.color, [0, 0.95 * s, bed * 0.34], [1.15 * s, 0.85 * s, 0.95 * s]);
    prim(t, 'box', cfg.color, [0, 0.65 * s, bed * 0.58], [1.1 * s, 0.4 * s, 0.5 * s]);
    prim(t, 'box', '#cfe8f2', [0, 1.1 * s, bed * 0.51], [0.95 * s, 0.35 * s, 0.05]);
    for (const x of [-0.55 * s, 0.55 * s]) for (const z of [bed * 0.34, -bed * 0.33]) prim(t, 'cylinder', '#2e2e33', [x, 0.28 * s, z], [0.56 * s, 0.25 * s, 0.56 * s], [0, 0, 90]);
    this.cargo = group(t, 0, 0, 0, 'cargo');
    this.cargoKey = '';
  }

  /** Reconstrói o silo com a cor/tamanho do nível comprado. */
  syncSiloTier(tier: number) {
    if (tier === this.siloTierShown) return;
    this.siloTierShown = tier;
    this.silo.children.slice().forEach(c => (c as pc.Entity).destroy());
    const cfg = SILO_TIERS[tier - 1], s = cfg.scale;
    prim(this.silo, 'cylinder', cfg.color, [0, 2 * s, 0], [1.4 * s, 4 * s, 1.4 * s]);
    prim(this.silo, 'sphere', '#c4c7cc', [0, 4 * s, 0], [1.45 * s, 1.0 * s, 1.45 * s]);
    prim(this.silo, 'cone', '#9da1a8', [0, 4.6 * s, 0], [0.3 * s, 0.45 * s, 0.3 * s]);
    if (tier >= 2) for (const a of [0, 90, 180, 270]) {
      const rad = (a * Math.PI) / 180;
      prim(this.silo, 'box', cfg.color, [Math.sin(rad) * 1.42 * s, 2 * s, Math.cos(rad) * 1.42 * s], [0.05, 3.6 * s, 0.05]);
    }
    if (tier >= 3) prim(this.silo, 'cylinder', '#6f7a86', [0, 0.15, 1.6 * s], [0.18, 0.3, 0.18], [90, 0, 0]); // calha de descarga
  }

  private fly(a: pc.Vec3, b: pc.Vec3, color: string, delay: number, dur: number, h: number, onLand?: () => void) {
    const e = prim(this.root, 'box', color, [a.x, a.y, a.z], [0.26, 0.26, 0.26]);
    e.enabled = false;
    this.fx.push({ e, a, b, t0: this.t + delay, dur, h, onLand });
  }
  private boxLocal(i: number): [number, number, number] { return [-0.44 + (i % 5) * 0.22, 0.7, -1.0 + Math.floor(i / 5) * 0.3]; }
  private static MAX_VISUAL_CRATES = 30; // caixas extras (níveis maiores) só contam no número, não no visual
  private boxWorld(i: number) { const l = this.boxLocal(i); return new pc.Vec3(TRUCK_X + l[2], l[1], -1.5 - l[0]); } // caminhão estacionado, yaw 90

  /** Eventos lógicos -> animações. O estado do jogo já foi atualizado; aqui é só apresentação. */
  handleEvent(e: GameEvent) {
    if (e.type === 'harvest') {
      const zo = this.game.zones[this.activeZoneIndex];
      const local = this.cellToWorld(e.ix, e.iz);
      const p = new pc.Vec3(local.x + zo.dx, 0.8, local.z + zo.dz);
      if (this.activeZoneIndex === 0) {
        // em casa, o item realmente voa até o silo
        this.fly(p, new pc.Vec3(SILO_X, 4.3, SILO_Z), ITEM_COLOR[e.crop], e.order * 0.09, 0.9, 2.6, () => { this.pulse = 1; });
      } else {
        // longe demais do silo pra voar até lá: só um "poof" no lugar (o item entra no silo de qualquer forma)
        this.fly(p, p, ITEM_COLOR[e.crop], e.order * 0.09, 0.7, 2.2, () => { this.pulse = 1; });
      }
    } else {
      let i = 0;
      const n = e.cargo.wheat + e.cargo.corn + e.cargo.tomato, st = staggerMs(n) / 1000;
      for (const ct of ['wheat', 'corn', 'tomato'] as const)
        for (let k = 0; k < e.cargo[ct] && i < FarmScene.MAX_VISUAL_CRATES; k++, i++)
          this.fly(new pc.Vec3(SILO_X, 2.6, SILO_Z), this.boxWorld(i), ITEM_COLOR[ct], i * st, FLIGHT_MS / 1000, 1.6);
    }
  }

  /** Caminhão: carregando (parado), saindo, fora, voltando. Tudo derivado de departedAt. */
  updateTruck(now: number, ts: TruckSystem) {
    const P = TRUCK_X, FAR = 34, OUT = 4500, BACK = 4500, sm = (u: number) => u * u * (3 - 2 * u);
    let x = P, vis = true, yaw = 90, showCargo = false, landed = 0;
    const n = ts.cargoCount();
    if (ts.isAway(now)) {
      const t = now - ts.departedAt;
      showCargo = t < TRIP_MS - BACK;
      if (t < OUT) x = P + (FAR - P) * sm(Math.max(0, t) / OUT);
      else if (t > TRIP_MS - BACK) { x = FAR - (FAR - P) * sm((t - (TRIP_MS - BACK)) / BACK); yaw = -90; }
      else vis = false;
      landed = t < 0 ? Math.max(0, Math.min(n, Math.floor((now - (ts.departedAt - LOAD_MS) - FLIGHT_MS) / staggerMs(n)) + 1)) : n;
    }
    this.truck.enabled = vis;
    if (vis) { this.truck.setPosition(x, 0, -1.5); this.truck.setEulerAngles(0, yaw, 0); }
    const c = ts.cargo, key = showCargo ? `${c.wheat},${c.corn},${c.tomato}|${landed}` : 'none';
    if (key === this.cargoKey) return;
    this.cargoKey = key;
    this.cargo.children.slice().forEach(ch => (ch as pc.Entity).destroy());
    if (!showCargo) return;
    let i = 0;
    for (const ct of ['wheat', 'corn', 'tomato'] as const)
      for (let k = 0; k < c[ct] && i < landed && i < FarmScene.MAX_VISUAL_CRATES; k++, i++) prim(this.cargo, 'box', ITEM_COLOR[ct], this.boxLocal(i), [0.19, 0.19, 0.24]);
  }

  // --- Animais: curral de galinhas ---
  private buildCoopBase(r: pc.Entity) {
    this.coopGroup = group(r, 0.6, 0, -4.6, 'coop');
    this.coopGroup.enabled = false;
  }
  /** Constrói/reconstrói o curral quando é comprado ou melhorado de nível. */
  syncCoopTier(hasCoop: boolean, tier: number) {
    if (hasCoop === this.coopBuilt && tier === this.coopTierShown) return;
    this.coopBuilt = hasCoop; this.coopTierShown = tier;
    this.coopGroup.enabled = hasCoop;
    if (!hasCoop) return;
    this.coopGroup.children.slice().forEach(c => (c as pc.Entity).destroy());
    const s = 0.9 + (tier - 1) * 0.25;
    const half = 0.85 * s;
    for (const [x1, z1, x2, z2] of [[-half, -half, half, -half], [-half, half, half, half], [-half, -half, -half, half], [half, -half, half, half]] as const) {
      const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 0.55)), yaw = (Math.atan2(x2 - x1, z2 - z1) * 180) / Math.PI;
      for (let i = 0; i <= n; i++) prim(this.coopGroup, 'box', WOOD, [x1 + (x2 - x1) * i / n, 0.16, z1 + (z2 - z1) * i / n], [0.05, 0.32, 0.05]);
      for (const y of [0.12, 0.24]) prim(this.coopGroup, 'box', WOOD2, [(x1 + x2) / 2, y, (z1 + z2) / 2], [0.03, 0.03, len], [0, yaw, 0]);
    }
    this.coopPen = group(this.coopGroup, half * 0.55, 0, half * 0.55, 'henhouse');
    prim(this.coopPen, 'box', '#f3efe6', [0, 0.18, 0], [0.34 * s, 0.36 * s, 0.34 * s]);
    prim(this.coopPen, 'cone', RED, [0, 0.4 * s, 0], [0.28 * s, 0.24 * s, 0.28 * s]);
    this.chickenCountShown = -1;
  }
  /** Galinhas espalhadas dentro do curral (limitado visualmente a 10; o resto só conta no número). */
  syncChickens(count: number) {
    if (count === this.chickenCountShown || !this.coopBuilt) return;
    this.chickenCountShown = count;
    this.coopGroup.children.filter(c => c.name === 'chicken').forEach(c => (c as pc.Entity).destroy());
    const half = (0.85 * (0.9 + (this.coopTierShown - 1) * 0.25)) * 0.75, n = Math.min(count, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = half * 0.6;
      const c = group(this.coopGroup, Math.cos(a) * r, 0, Math.sin(a) * r, 'chicken');
      prim(c, 'sphere', '#f6f2e6', [0, 0.09, 0], [0.09, 0.08, 0.11]);
      prim(c, 'sphere', '#e0574a', [0, 0.15, 0.06], [0.03, 0.03, 0.03]);
    }
  }

  // --- Animais: pasto (vacas/ovelhas) — sempre na zona 0 ---
  /** Vacas e ovelhas espalhadas pelos tiles de pasto (limitado visualmente a 14; o resto só conta no número). */
  syncHerd(cows: number, sheep: number) {
    const homeFarm = this.game.zones[0].farm;
    const key = `${cows},${sheep},${homeFarm.fenceVersion}`;
    if (key === this.herdKey) return;
    this.herdKey = key;
    if (!this.herdGroup) this.herdGroup = group(this.zoneGroups[0], 0, 0, 0, 'herd');
    this.herdGroup.children.slice().forEach(c => (c as pc.Entity).destroy());
    const spots = homeFarm.tiles.filter(t => t.pasture).map(t => this.cellToWorld(t.ix, t.iz));
    if (!spots.length) return;
    const total = Math.min(cows + sheep, 14);
    for (let i = 0; i < total; i++) {
      const isCow = i < Math.min(cows, total);
      const p = spots[i % spots.length];
      const e = group(this.herdGroup, p.x + (Math.random() - 0.5) * CELL * 0.5, 0, p.z + (Math.random() - 0.5) * CELL * 0.5, isCow ? 'cow' : 'sheep');
      const body = '#f4f0e6', head = isCow ? '#e0c3a4' : '#4a4038';
      prim(e, 'sphere', body, [0, 0.28, 0], [isCow ? 0.34 : 0.26, isCow ? 0.28 : 0.22, isCow ? 0.5 : 0.4]);
      prim(e, 'sphere', head, [0, 0.34, isCow ? 0.32 : 0.24], [0.2, 0.18, 0.2]);
      if (isCow) prim(e, 'sphere', '#5a4636', [0.07, 0.34, 0.2], [0.18, 0.12, 0.2]);
    }
  }

  private buildHover() {
    const home = this.zoneGroups[0];
    this.hoverEdge = new pc.Entity('hoverEdge');
    this.hoverEdge.addComponent('render', { type: 'box', material: ghostMat(0.55), castShadows: false, receiveShadows: false });
    this.hoverEdge.setLocalScale(0.08, 0.5, CELL * 0.85);
    this.hoverEdge.enabled = false;
    home.addChild(this.hoverEdge);
    const m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color(1, 1, 0.85);
    m.opacity = 0.3; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.update();
    this.hover = new pc.Entity('hover');
    this.hover.addComponent('render', { type: 'box', material: m, castShadows: false, receiveShadows: false });
    this.hover.setLocalScale(CELL * 0.96, 0.03, CELL * 0.96);
    this.hover.enabled = false;
    home.addChild(this.hover);
    this.pastureSelBox = new pc.Entity('pastureSel');
    this.pastureSelBox.addComponent('render', { type: 'box', material: ghostMat(0.4), castShadows: false, receiveShadows: false });
    this.pastureSelBox.enabled = false;
    home.addChild(this.pastureSelBox);
  }

  setPastureSelection(sel: { x0: number; z0: number; x1: number; z1: number } | null) {
    this.pastureSelBox.enabled = !!sel;
    if (!sel) return;
    const a = this.cellToWorld(sel.x0, sel.z0), b = this.cellToWorld(sel.x1, sel.z1);
    this.pastureSelBox.setPosition((a.x + b.x) / 2, 0.14, (a.z + b.z) / 2);
    this.pastureSelBox.setLocalScale(Math.abs(b.x - a.x) + CELL * 0.9, 0.06, Math.abs(b.z - a.z) + CELL * 0.9);
  }
}
