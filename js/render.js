import { Biome } from './terrain.js';
import { ERAS, BUILDING_INFO } from './eras.js';
import { isAdult } from './person.js';
import { livingPeople, housingCap } from './settlement.js';
import { ANIMAL_KINDS } from './resources.js';

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
  farmer: '#e0c34c', hunter: '#c77b3f', fisherman: '#4fa8c9', woodcutter: '#8a5a34', miner: '#9aa0a6',
  builder: '#e08a3a', researcher: '#5aa0e0', soldier: '#d0453a',
};
export const JOB_LABEL = {
  farmer: 'земледелец', hunter: 'охотник', fisherman: 'рыбак', woodcutter: 'дровосек', miner: 'горняк',
  builder: 'строитель', researcher: 'учёный', soldier: 'воин',
};

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

  drawTree(ctx, x, y, stage) {
    const px = x * TILE, py = y * TILE;
    const sway = Math.sin(performance.now() / 900 + x * 3.1 + y * 1.7) * 0.5;
    if (stage <= 0) {
      ctx.strokeStyle = '#3f7a45';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(px, py + 0.6);
      ctx.lineTo(px + sway * 0.3, py - 1.2);
      ctx.stroke();
      return;
    }
    if (stage === 1) {
      ctx.fillStyle = '#39633e';
      ctx.beginPath();
      ctx.arc(px + sway * 0.2, py - 0.6, 1.9, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const trunkH = stage === 2 ? 2.4 : 3.5;
    const crownR = stage === 2 ? 2.6 : 3.6;
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(px - 0.8, py - 1, 1.6, trunkH);
    ctx.fillStyle = '#2f6b3c';
    ctx.beginPath();
    ctx.arc(px + sway, py - 1 - crownR * 0.6, crownR, 0, Math.PI * 2);
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

  drawFishSpot(ctx, x, y) {
    const px = x * TILE, py = y * TILE;
    const t = performance.now() / 700;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(px, py, 2 + Math.sin(t + x) * 0.5 + 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawAnimal(ctx, a) {
    const px = a.x * TILE, py = a.y * TILE;
    const info = ANIMAL_KINDS[a.kind];
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info ? info.icon : '🐾', px, py);
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

  drawBuildingAt(ctx, b, era, selected) {
    const px = b.x * TILE, py = b.y * TILE;
    const info = BUILDING_INFO[b.type];
    ctx.beginPath();
    ctx.ellipse(px, py + 1.5, 5.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info ? info.icon : '🏚️', px, py);
    if (selected) {
      ctx.strokeStyle = '#ffe37a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, 7.5, 0, Math.PI * 2);
      ctx.stroke();
    }
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

    const [vx0, vy0] = camera.screenToWorld(0, 0);
    const [vx1, vy1] = camera.screenToWorld(canvas.width, canvas.height);
    const minX = Math.min(vx0, vx1) - 3, maxX = Math.max(vx0, vx1) + 3;
    const minY = Math.min(vy0, vy1) - 3, maxY = Math.max(vy0, vy1) + 3;
    const inView = o => o.x >= minX && o.x <= maxX && o.y >= minY && o.y <= maxY;

    for (const s of game.settlements) this.drawField(ctx, s.field);
    for (const r of game.world.rocks) if (inView(r)) this.drawRock(ctx, r.x, r.y);
    for (const t of game.world.trees) if (inView(t)) this.drawTree(ctx, t.x, t.y, t.stage);
    for (const f of game.world.fishSpots) if (inView(f)) this.drawFishSpot(ctx, f.x, f.y);
    for (const a of game.world.animals) if (inView(a)) this.drawAnimal(ctx, a);
    for (const s of game.settlements) {
      const selectedSettlement = game.selected && game.selected.type === 'settlement' && game.selected.id === s.id;
      this.drawStorageMarker(ctx, s, selectedSettlement);
      for (let i = 0; i < s.buildings.length; i++) {
        const selectedBuilding = game.selected && game.selected.type === 'building' &&
          game.selected.settlementId === s.id && game.selected.index === i;
        this.drawBuildingAt(ctx, s.buildings[i], s.era, selectedBuilding);
      }
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

    let bestB = null, bestBD = 0.8;
    for (const s of game.settlements) {
      for (let i = 0; i < s.buildings.length; i++) {
        const b = s.buildings[i];
        const d = Math.hypot(wx - b.x, wy - b.y);
        if (d < bestBD) { bestBD = d; bestB = { type: 'building', settlementId: s.id, index: i }; }
      }
      if (s.constructionQueue) {
        const q = s.constructionQueue;
        const d = Math.hypot(wx - q.pos.x, wy - q.pos.y);
        if (d < bestBD) { bestBD = d; bestB = { type: 'building', settlementId: s.id, index: -1 }; }
      }
    }
    if (bestB) return bestB;

    let bestS = null, bestSD = 2.2;
    for (const s of game.settlements) {
      const d = Math.hypot(wx - s.x, wy - s.y);
      if (d < bestSD) { bestSD = d; bestS = { type: 'settlement', id: s.id }; }
    }
    return bestS;
  }
}
