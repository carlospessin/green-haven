import * as pc from 'playcanvas';

const smooth = (u: number) => u * u * (3 - 2 * u);

export class IsometricCamera {
  readonly entity = new pc.Entity('camera');
  private target = new pc.Vec3(0, 0.5, 0);
  private offset = new pc.Vec3();
  private panFrom = { x: 0, z: 0 };
  private panDest = { x: 0, z: 0 };
  private panT0 = 0;
  private panDur = 900;

  constructor(private app: pc.Application, private canvas: HTMLCanvasElement) {
    this.entity.addComponent('camera', {
      projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 9, nearClip: 1, farClip: 250,
      clearColor: new pc.Color(0.96, 0.91, 0.82),
    });
    const yaw = (45 * Math.PI) / 180, el = (33 * Math.PI) / 180, d = 90;
    this.offset.set(d * Math.cos(el) * Math.sin(yaw), d * Math.sin(el), d * Math.cos(el) * Math.cos(yaw));
    this.entity.setPosition(this.target.x + this.offset.x, this.target.y + this.offset.y, this.target.z + this.offset.z);
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

  /** Centraliza suavemente a câmera num novo ponto (x,z do mundo) — usado ao trocar de terreno. */
  panTo(x: number, z: number) {
    this.panFrom = { x: this.target.x, z: this.target.z };
    this.panDest = { x, z };
    this.panT0 = performance.now();
  }
  /** Avança a animação de pan; chamar a cada frame. */
  update() {
    const u = Math.min(1, (performance.now() - this.panT0) / this.panDur), s = smooth(u);
    this.target.x = this.panFrom.x + (this.panDest.x - this.panFrom.x) * s;
    this.target.z = this.panFrom.z + (this.panDest.z - this.panFrom.z) * s;
    this.entity.setPosition(this.target.x + this.offset.x, this.target.y + this.offset.y, this.target.z + this.offset.z);
    this.entity.lookAt(this.target);
  }

  toScreen(p: pc.Vec3) { return this.entity.camera!.worldToScreen(p); }
  setSky(color: pc.Color) { this.entity.camera!.clearColor = color; }

  /** Raio de picking (em pixels CSS relativos ao canvas). Em ortográfica a direção é sempre a mesma. */
  ray(x: number, y: number) {
    const cam = this.entity.camera!;
    return { origin: cam.screenToWorld(x, y, cam.nearClip), dir: this.entity.forward.clone() };
  }
}
