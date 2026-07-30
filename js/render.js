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
const JOB_LABEL = {
  farmer: 'земледелец', woodcutter: 'дровосек', miner: 'горняк',
  builder: 'строитель', researcher: 'учёный', soldier: 'воин',
};
export { JOB_LABEL };

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

function personOffset(person) {
  const ang = (person.id * 2.399963) % (Math.PI * 2);
  const radius = 1.1 + (person.id % 5) * 0.55;
  return [Math.cos(ang) * radius, Math.sin(ang) * radius];
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

  drawSettlement(ctx, s, selected) {
    const px = s.x * TILE, py = s.y * TILE;
    const era = s.era;
    const size = 10 + era * 3;
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(px - size / 2, py - size * 0.15, size, size * 0.7);
    ctx.fillStyle = ['#7c6a52', '#a97c50', '#8a8f96', '#7d8a63', '#5c6773', '#455060', '#3a3f47'][era];
    ctx.beginPath();
    ctx.moveTo(px - size / 2 - 2, py - size * 0.15);
    ctx.lineTo(px, py - size * 0.15 - size * 0.7);
    ctx.lineTo(px + size / 2 + 2, py - size * 0.15);
    ctx.closePath();
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#ffe37a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, size * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawSettlementLabel(ctx, s, game) {
    const px = s.x * TILE, py = s.y * TILE - (10 + s.era * 3) - 6;
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

  drawPerson(ctx, person, s, day, selected) {
    const [ox, oy] = personOffset(person);
    const px = (s.x + ox) * TILE, py = (s.y + oy) * TILE;
    const adult = isAdult(person, day);
    const r = adult ? 3.2 : 2.1;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = person.job ? JOB_COLOR[person.job] : (person.sex === 'f' ? '#e0a8c0' : '#a8c0e0');
    ctx.fill();
    ctx.lineWidth = selected ? 1.6 : 0.8;
    ctx.strokeStyle = selected ? '#ffe37a' : 'rgba(0,0,0,0.5)';
    ctx.stroke();
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
      const selected = game.selected && game.selected.type === 'settlement' && game.selected.id === s.id;
      this.drawSettlement(ctx, s, selected);
    }
    for (const s of game.settlements) {
      for (const p of livingPeople(s, game)) {
        const selected = game.selected && game.selected.type === 'person' && game.selected.id === p.id;
        this.drawPerson(ctx, p, s, game.day, selected);
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
        const [ox, oy] = personOffset(p);
        const d = Math.hypot(wx - (s.x + ox), wy - (s.y + oy));
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
