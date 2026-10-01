import * as pc from 'playcanvas';

export class IsometricCamera {
  readonly entity = new pc.Entity('camera');
  private target = new pc.Vec3(0, 0.5, 0);

  constructor(private app: pc.Application, private canvas: HTMLCanvasElement) {
    this.entity.addComponent('camera', {
      projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 9, nearClip: 1, farClip: 250,
      clearColor: new pc.Color(0.96, 0.91, 0.82),
    });
    const yaw = (45 * Math.PI) / 180, el = (33 * Math.PI) / 180, d = 90;
    this.entity.setPosition(
      this.target.x + d * Math.cos(el) * Math.sin(yaw), this.target.y + d * Math.sin(el), this.target.z + d * Math.cos(el) * Math.cos(yaw));
    this.entity.lookAt(this.target);
    app.root.addChild(this.entity);
    this.fit();
    try {
      // Pós-processamento: ambient occlusion + tonemapping + vinheta suave
      const frame = new pc.CameraFrame(app, this.entity.camera!);
      frame.rendering.toneMapping = pc.TONEMAP_ACES;
      frame.ssao.type = pc.SSAOTYPE_LIGHTING;
      frame.ssao.intensity = 0.7; frame.ssao.radius = 1.6; frame.ssao.samples = 12;
      frame.vignette.intensity = 0.3;
      frame.update();
    } catch (e) { console.warn('CameraFrame indisponível', e); this.entity.camera!.toneMapping = pc.TONEMAP_ACES; }
    window.addEventListener('resize', () => this.fit());
  }

  private fit() {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.entity.camera!.orthoHeight = Math.max(9, 13.5 / aspect);
  }

  toScreen(p: pc.Vec3) { return this.entity.camera!.worldToScreen(p); }
  setSky(color: pc.Color) { this.entity.camera!.clearColor = color; }

  /** Raio de picking (em pixels CSS relativos ao canvas). Em ortográfica a direção é sempre a mesma. */
  ray(x: number, y: number) {
    const cam = this.entity.camera!;
    return { origin: cam.screenToWorld(x, y, cam.nearClip), dir: this.entity.forward.clone() };
  }
}
