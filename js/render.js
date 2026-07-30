import { Biome } from './world.js';

export const TILE = 14;

const BIOME_COLOR = {
  [Biome.DEEP_WATER]: '#1b4f72',
  [Biome.WATER]: '#2e86c1',
  [Biome.SAND]: '#e8d6a0',
  [Biome.DIRT]: '#8a6a4a',
  [Biome.GRASS]: '#5aa657',
  [Biome.DESERT]: '#d9c07a',
  [Biome.ROCK]: '#8b8b8b',
  [Biome.SNOW]: '#f2f5f7',
};

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0; this.y = 0; this.zoom = 1;
  }
  worldToScreen(wx, wy) {
    return [
      (wx * TILE - this.x) * this.zoom + this.canvas.width / 2,
      (wy * TILE - this.y) * this.zoom + this.canvas.height / 2,
    ];
  }
  screenToWorld(sx, sy) {
    return [
      ((sx - this.canvas.width / 2) / this.zoom + this.x) / TILE,
      ((sy - this.canvas.height / 2) / this.zoom + this.y) / TILE,
    ];
  }
  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom,
      this.canvas.width / 2 - this.x * this.zoom,
      this.canvas.height / 2 - this.y * this.zoom);
  }
  clamp(world) {
    const maxX = world.width * TILE, maxY = world.height * TILE;
    this.zoom = Math.max(0.3, Math.min(4, this.zoom));
    const halfW = this.canvas.width / 2 / this.zoom;
    const halfH = this.canvas.height / 2 / this.zoom;
    this.x = Math.max(-halfW * 0.3, Math.min(maxX + halfW * 0.3, this.x));
    this.y = Math.max(-halfH * 0.3, Math.min(maxY + halfH * 0.3, this.y));
  }
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.terrain = document.createElement('canvas');
    this.terrain.width = world.width * TILE;
    this.terrain.height = world.height * TILE;
    this.tctx = this.terrain.getContext('2d');
  }

  rebuildTerrain() {
    const { world, tctx } = this;
    const w = world.width, h = world.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        tctx.fillStyle = BIOME_COLOR[world.biome[world.idx(x, y)]];
        tctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
      }
    }
    for (const [i, t] of world.trees) {
      const x = i % w, y = Math.floor(i / w);
      this.drawTree(tctx, x * TILE + TILE / 2, y * TILE + TILE / 2, t.growth);
    }
    world.terrainDirty = false;
  }

  drawTree(ctx, px, py, growth) {
    const scale = 0.4 + growth * 0.6;
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(px - 1.2 * scale, py, 2.4 * scale, TILE * 0.35 * scale);
    ctx.fillStyle = growth >= 1 ? '#2f6b3c' : '#7fbf6a';
    ctx.beginPath();
    ctx.arc(px, py - TILE * 0.12 * scale, TILE * 0.42 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEntity(ctx, e) {
    const px = e.x * TILE + TILE / 2, py = e.y * TILE + TILE / 2;
    let fill, outline, r;
    if (e.type === 'human') { fill = '#e7b88a'; outline = '#8a5a34'; r = 3; }
    else if (e.type === 'sheep') { fill = e.fleeing ? '#ffe3e3' : '#f5f2e6'; outline = '#b9ad8f'; r = 3.6; }
    else { fill = '#585866'; outline = '#2c2c33'; r = 3.8; }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = outline;
    ctx.stroke();
    if (e.energy < 0.3) {
      ctx.fillStyle = 'rgba(255,60,60,0.85)';
      ctx.fillRect(px - 3, py - r - 4, 6 * Math.max(0, e.energy / 0.3), 1.6);
    }
  }

  drawFire(ctx, x, y) {
    const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    const t = performance.now() / 120 + x * 13 + y * 7;
    const flicker = 0.7 + Math.sin(t) * 0.3;
    const r = TILE * 0.5 * flicker;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, 'rgba(255,240,150,0.95)');
    grad.addColorStop(0.5, 'rgba(255,140,30,0.85)');
    grad.addColorStop(1, 'rgba(180,30,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBrushCursor(ctx, tx, ty, radius) {
    ctx.beginPath();
    ctx.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, Math.max(radius, 0.4) * TILE, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5 / this.camZoom;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5 / this.camZoom;
    ctx.stroke();
  }

  render(camera, hover) {
    const { ctx, world, canvas } = this;
    if (world.terrainDirty) this.rebuildTerrain();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const worldPxW = world.width * TILE, worldPxH = world.height * TILE;
    let sx = camera.x - canvas.width / 2 / camera.zoom;
    let sy = camera.y - canvas.height / 2 / camera.zoom;
    let sw = canvas.width / camera.zoom;
    let sh = canvas.height / camera.zoom;
    let dx = 0, dy = 0;
    if (sx < 0) { dx = -sx * camera.zoom; sw += sx; sx = 0; }
    if (sy < 0) { dy = -sy * camera.zoom; sh += sy; sy = 0; }
    if (sx + sw > worldPxW) sw = worldPxW - sx;
    if (sy + sh > worldPxH) sh = worldPxH - sy;
    if (sw > 0 && sh > 0) {
      ctx.drawImage(this.terrain, sx, sy, sw, sh, dx, dy, sw * camera.zoom, sh * camera.zoom);
    }

    camera.applyTransform(ctx);
    for (const [i] of world.fires) {
      const x = i % world.width, y = Math.floor(i / world.width);
      this.drawFire(ctx, x, y);
    }
    for (const e of world.entities) {
      if (e.alive) this.drawEntity(ctx, e);
    }
    this.camZoom = camera.zoom;
    if (hover) this.drawBrushCursor(ctx, hover.x, hover.y, hover.radius || 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
