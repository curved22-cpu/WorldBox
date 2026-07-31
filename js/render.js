import { Biome } from './terrain.js';
import { ERAS } from './eras.js';
import { isAdult } from './person.js';
import { livingPeople, housingCap } from './settlement.js';

export const TILE = 10;

const BIOME_COLOR = {
  [Biome.DEEP_WATER]: '#1b4f72',
  [Biome.WATER]: '#2e86c1',
  [Biome.SAND]: '#e8d6a0',
  [Biome.GRASS]: '#5aa657',
  [Biome.FOREST]: '#3f7a45',
  [Biome.ROCK]: '#8b8b8b',
  [Biome.SNOW]: '#f2f5f7',
};

const JOB_COLOR = {
  farmer: '#e0c34c', woodcutter: '#8a5a34', miner: '#9aa0a6',
  builder: '#e08a3a', researcher: '#5aa0e0', soldier: '#d0453a',
};
export const JOB_LABEL = {
  farmer: 'земледелец', woodcutter: 'дровосек', miner: 'горняк',
  builder: 'строитель', researcher: 'учёный', soldier: 'воин',
};
const ERA_MATERIAL = ['#7c6a52', '#a97c50', '#8a8f96', '#7d8a63', '#5c6773', '#455060', '#3a3f47'];

export class Camera {
  constructor(canvas) { this.canvas = canvas; this.x = 0; this.y = 0; this.zoom = 1; }
  worldToScreen(wx, wy) {
    return [(wx * TILE - this.x) * this.zoom + this.canvas.width / 2, (wy * TILE - this.y) * this.zoom + this.canvas.height / 2];
  }
  screenToWorld(sx, sy) {
    return [((sx - this.canvas.width / 2) / this.zoom + this.x) / TILE, ((sy - this.canvas.height / 2) / this.zoom + this.y) / TILE];
  }
  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.canvas.width / 2 - this.x * this.zoom, this.canvas.height / 2 - this.y * this.zoom);
  }
  clamp(world) {
    const maxX = world.width * TILE, maxY = world.height * TILE;
    this.zoom = Math.max(0.4, Math.min(6, this.zoom));
    const halfW = this.canvas.width / 2 / this.zoom, halfH = this.canvas.height / 2 / this.zoom;
    this.x = Math.max(-halfW * 0.3, Math.min(maxX + halfW * 0.3, this.x));
    this.y = Math.max(-halfH * 0.3, Math.min(maxY + halfH * 0.3, this.y));
  }
}

export class Renderer {
  constructor(canvas, terrain) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrainImg = document.createElement('canvas');
    this.terrainImg.width = terrain.width * TILE;
    this.terrainImg.height = terrain.height * TILE;
    const tctx = this.terrainImg.getContext('2d');
    for (let y = 0; y < terrain.height; y++) {
      for (let x = 0; x < terrain.width; x++) {
        tctx.fillStyle = BIOME_COLOR[terrain.biome[terrain.idx(x, y)]];
        tctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
      }
    }
  }

  drawTree(ctx, x, y, alive) {
    const px = x * TILE, py = y * TILE;
    if (!alive) {
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(px - 1.6, py - 1, 3.2, 2);
      return;
    }
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(px - 0.8, py - 1, 1.6, 3.5);
    ctx.fillStyle = '#2f6b3c';
    ctx.beginPath();
    ctx.arc(px, py - 2.5, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRock(ctx, x, y) {
    const px = x * TILE, py = y * TILE;
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d7d7d';
    ctx.beginPath();
    ctx.arc(px + 1.5, py + 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawField(ctx, field) {
    if (!field) return;
    const px = field.x * TILE, py = field.y * TILE;
    ctx.fillStyle = 'rgba(224,195,76,0.35)';
    ctx.beginPath();
    ctx.arc(px, py, TILE * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawStorageMarker(ctx, s, selected) {
    const px = s.x * TILE, py = s.y * TILE;
    ctx.fillStyle = '#caa15a';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(px - 3, py - 6, 6, 3);
    if (selected) {
      ctx.strokeStyle = '#ffe37a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawBuildingAt(ctx, x, y, era) {
    const px = x * TILE, py = y * TILE;
    const size = 8 + era * 1.6;
    ctx.fillStyle = ERA_MATERIAL[era];
    ctx.fillRect(px - size / 2, py - size * 0.1, size, size * 0.65);
    ctx.fillStyle = '#caa15a';
    ctx.beginPath();
    ctx.moveTo(px - size / 2 - 1.5, py - size * 0.1);
    ctx.lineTo(px, py - size * 0.1 - size * 0.6);
    ctx.lineTo(px + size / 2 + 1.5, py - size * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  drawConstructionSite(ctx, queue) {
    const px = queue.pos.x * TILE, py = queue.pos.y * TILE;
    const pct = Math.max(0, Math.min(1, queue.progress / queue.laborCost));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 5, py - 4, 10, 8);
    ctx.fillStyle = '#caa15a';
    ctx.fillRect(px - 5, py + 4 - 8 * pct, 10, 8 * pct);
  }

  drawSettlementLabel(ctx, s, game) {
    const px = s.x * TILE, py = s.y * TILE - 16;
    const living = livingPeople(s, game).length;
    const text = `${s.name} · ${living}/${housingCap(s)} · ${ERAS[s.era].short}`;
    ctx.font = `${11 / this.camZoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 / this.camZoom;
    ctx.strokeStyle = 'rgba(10,14,20,0.85)';
    ctx.strokeText(text, px, py);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, px, py);
  }

  drawPerson(ctx, person, day, selected) {
    const px = person.pos.x * TILE, py = person.pos.y * TILE;
    const adult = isAdult(person, day);
    const r = adult ? 3.2 : 2.1;
    const t = person.task;
    const working = t && (t.phase === 'working' || t.phase === 'building');
    const bob = working ? Math.sin(performance.now() / 90) * 1.2 : 0;

    if (t && t.carrying > 0) {
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(px - 2, py - r - 5, 4, 3);
    }
    ctx.beginPath();
    ctx.arc(px, py + bob * 0.2, r, 0, Math.PI * 2);
    ctx.fillStyle = person.job ? JOB_COLOR[person.job] : (person.sex === 'f' ? '#e0a8c0' : '#a8c0e0');
    ctx.fill();
    ctx.lineWidth = selected ? 1.6 : 0.8;
    ctx.strokeStyle = selected ? '#ffe37a' : 'rgba(0,0,0,0.5)';
    ctx.stroke();

    if (working) {
      const ang = Math.sin(performance.now() / 110) * 0.9;
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + r * 0.6, py);
      ctx.lineTo(px + r * 0.6 + Math.cos(ang) * 4, py - 2 + Math.sin(ang) * 4);
      ctx.stroke();
    }

    if (person.needs.hunger < 25 || person.needs.health < 30) {
      ctx.fillStyle = 'rgba(255,60,60,0.9)';
      ctx.fillRect(px - 2.5, py - r - 4, 5, 1.4);
    }
    if (this.camZoom > 2.2 || selected) {
      ctx.font = `${9 / this.camZoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.5 / this.camZoom;
      ctx.strokeStyle = 'rgba(10,14,20,0.85)';
      ctx.strokeText(person.name, px, py - r - 5);
      ctx.fillStyle = '#fff';
      ctx.fillText(person.name, px, py - r - 5);
    }
  }

  render(camera, game, hoverWorld) {
    const { ctx, canvas } = this;
    const terrain = game.terrain;
    this.camZoom = camera.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const worldPxW = terrain.width * TILE, worldPxH = terrain.height * TILE;
    let sx = camera.x - canvas.width / 2 / camera.zoom;
    let sy = camera.y - canvas.height / 2 / camera.zoom;
    let sw = canvas.width / camera.zoom, sh = canvas.height / camera.zoom;
    let dx = 0, dy = 0;
    if (sx < 0) { dx = -sx * camera.zoom; sw += sx; sx = 0; }
    if (sy < 0) { dy = -sy * camera.zoom; sh += sy; sy = 0; }
    if (sx + sw > worldPxW) sw = worldPxW - sx;
    if (sy + sh > worldPxH) sh = worldPxH - sy;
    if (sw > 0 && sh > 0) ctx.drawImage(this.terrainImg, sx, sy, sw, sh, dx, dy, sw * camera.zoom, sh * camera.zoom);

    camera.applyTransform(ctx);

    for (const s of game.settlements) {
      this.drawField(ctx, s.field);
      for (const r of s.rocks) this.drawRock(ctx, r.x, r.y);
      for (const t of s.trees) this.drawTree(ctx, t.x, t.y, t.alive);
    }
    for (const s of game.settlements) {
      const selected = game.selected && game.selected.type === 'settlement' && game.selected.id === s.id;
      this.drawStorageMarker(ctx, s, selected);
      for (const b of s.buildings) this.drawBuildingAt(ctx, b.x, b.y, s.era);
      if (s.constructionQueue) this.drawConstructionSite(ctx, s.constructionQueue);
    }
    for (const s of game.settlements) {
      for (const p of livingPeople(s, game)) {
        const selected = game.selected && game.selected.type === 'person' && game.selected.id === p.id;
        this.drawPerson(ctx, p, game.day, selected);
      }
    }
    for (const s of game.settlements) this.drawSettlementLabel(ctx, s, game);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  hitTest(camera, game, sx, sy) {
    const [wx, wy] = camera.screenToWorld(sx, sy);
    let best = null, bestD = 1.1;
    for (const s of game.settlements) {
      for (const p of livingPeople(s, game)) {
        const d = Math.hypot(wx - p.pos.x, wy - p.pos.y);
        if (d < bestD) { bestD = d; best = { type: 'person', id: p.id }; }
      }
    }
    if (best) return best;
    let bestS = null, bestSD = 2.2;
    for (const s of game.settlements) {
      const d = Math.hypot(wx - s.x, wy - s.y);
      if (d < bestSD) { bestSD = d; bestS = { type: 'settlement', id: s.id }; }
    }
    return bestS;
  }
}
