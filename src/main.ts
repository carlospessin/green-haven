import * as pc from 'playcanvas';
import { IsometricCamera } from './camera/IsometricCamera';
import { Game } from './game/Game';
import { FarmInput } from './input/FarmInput';
import { FarmScene } from './scenes/FarmScene';
import { Balloons } from './ui/Balloons';
import { HUD } from './ui/HUD';

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  // WebGPU quando disponível, senão WebGL 2
  const device = await pc.createGraphicsDevice(canvas, { deviceTypes: ['webgpu', 'webgl2'], antialias: true });
  const app = new pc.Application(canvas, { graphicsDevice: device });
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  window.addEventListener('resize', () => app.resizeCanvas());

  const game = new Game();
  const scene = new FarmScene(app, game);
  const cam = new IsometricCamera(app, canvas);
  const hud = new HUD(game);
  const balloons = new Balloons(cam, scene, game);
  new FarmInput(canvas, cam, scene, game);
  game.onEvent(e => scene.handleEvent(e));

  let acc = 0, lastZone = 0, lastOwned = game.zones.map(z => z.owned);
  scene.setActiveTool(game.selectedTool?.kind ?? null);
  scene.sync(Date.now());
  app.on('update', (dt: number) => {
    const now = Date.now();
    if (game.activeZone !== lastZone) {
      lastZone = game.activeZone;
      const z = game.zones[lastZone];
      scene.setActiveZone(lastZone);
      cam.panTo(z.dx, z.dz);
    }
    game.zones.forEach((z, i) => { if (z.owned && !lastOwned[i]) { lastOwned[i] = true; scene.revealZone(i); } });
    cam.update();
    scene.setActiveTool(game.selectedTool?.kind ?? null);
    scene.update(dt);
    scene.applyDayNight(now); cam.setSky(scene.skyColor);
    scene.syncSiloTier(game.economy.siloTier);
    scene.syncTruckTier(game.truck.tier);
    scene.syncCoopTier(game.economy.hasCoop, game.economy.coopTier);
    scene.syncChickens(game.economy.chickens);
    scene.syncHerd(game.economy.cows, game.economy.sheep);
    for (let i = 1; i < game.zones.length; i++) scene.syncZoneBuildings(i);
    scene.setPastureSelection(game.pastureSelecting ? game.pastureSel : null);
    scene.updateTruck(now, game.truck);
    balloons.update(now);
    acc += dt;
    if (acc > 0.25) { acc = 0; game.tick(now); scene.sync(now); hud.refresh(); }
  });
  app.start();
}
boot();
