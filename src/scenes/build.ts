import * as pc from 'playcanvas';

export type V3 = [number, number, number];
const cache = new Map<string, pc.StandardMaterial>();

export function mat(hex: string): pc.StandardMaterial {
  let m = cache.get(hex);
  if (!m) {
    m = new pc.StandardMaterial();
    m.diffuse = new pc.Color().fromString(hex);
    m.useMetalness = true; m.metalness = 0; m.gloss = 0.25;
    m.update(); cache.set(hex, m);
  }
  return m;
}

/** Primitiva 3D. Ponto de extensão: trocar por instância de um .glb carregado. */
export function prim(parent: pc.Entity, type: 'box' | 'cylinder' | 'sphere' | 'cone' | 'capsule', color: string,
                     pos: V3, scale: V3, rot: V3 = [0, 0, 0]): pc.Entity {
  const e = new pc.Entity();
  e.addComponent('render', { type, material: mat(color), castShadows: true, receiveShadows: true });
  e.setLocalPosition(pos[0], pos[1], pos[2]);
  e.setLocalEulerAngles(rot[0], rot[1], rot[2]);
  e.setLocalScale(scale[0], scale[1], scale[2]);
  parent.addChild(e);
  return e;
}

export function group(parent: pc.Entity, x = 0, y = 0, z = 0, name = 'group'): pc.Entity {
  const g = new pc.Entity(name); g.setLocalPosition(x, y, z); parent.addChild(g); return g;
}

let ghost: pc.StandardMaterial | null = null;
export function ghostMat(op = 0.35): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color(1, 0.85, 0.35);
  m.opacity = op; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.update();
  ghost = m; return m;
}

export function lerpColor(a: pc.Color, b: pc.Color, t: number): pc.Color {
  const u = Math.max(0, Math.min(1, t));
  return new pc.Color(a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u);
}
