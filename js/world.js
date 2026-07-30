import { Noise2D } from './noise.js';

export const Biome = {
  DEEP_WATER: 0,
  WATER: 1,
  SAND: 2,
  DIRT: 3,
  GRASS: 4,
  DESERT: 5,
  ROCK: 6,
  SNOW: 7,
};

const H = {
  DEEP_WATER: 0.30,
  WATER: 0.38,
  SAND: 0.43,
  GRASS: 0.78,
  ROCK: 0.90,
};

export function isWater(b) { return b === Biome.DEEP_WATER || b === Biome.WATER; }
export function isLand(b) { return !isWater(b); }

export class World {
  constructor(width, height, seed) {
    this.width = width;
    this.height = height;
    this.tick = 0;
    this.trees = new Map(); // idx -> { growth: 0..1 }
    this.fires = new Map(); // idx -> { life }
    this.entities = [];
    this.terrainDirty = true;
    this.regenerate(seed);
  }

  regenerate(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    const heightNoise = new Noise2D(seed);
    const moistNoise = new Noise2D(seed ^ 0x9e3779b9);
    const n = this.width * this.height;
    this.heightMap = new Float32Array(n);
    this.moisture = new Float32Array(n);
    this.biome = new Uint8Array(n);
    this.trees.clear();
    this.fires.clear();
    this.entities.length = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.idx(x, y);
        const nx = x / this.width, ny = y / this.height;
        let h = heightNoise.fbm(nx * 3.2, ny * 3.2, 5, 2.05, 0.5); // ~[-1,1]
        // push edges toward water for an island-ish continent
        const dx = nx - 0.5, dy = ny - 0.5;
        const edge = Math.min(1, (dx * dx + dy * dy) * 2.6);
        h = h * 0.5 + 0.5; // [0,1]
        h = h * (1 - edge * 0.9);
        this.heightMap[i] = h;
        let m = moistNoise.fbm(nx * 4 + 100, ny * 4 + 100, 4, 2.0, 0.5) * 0.5 + 0.5;
        this.moisture[i] = m;
        this.recomputeBiome(i);
      }
    }

    // scatter initial trees on suitable grass tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.idx(x, y);
        if (this.biome[i] !== Biome.GRASS) continue;
        const chance = Math.max(0, this.moisture[i] - 0.35) * 0.5;
        if (Math.random() < chance) {
          this.trees.set(i, { growth: 0.6 + Math.random() * 0.4 });
        }
      }
    }
    this.terrainDirty = true;
  }

  idx(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  recomputeBiome(i) {
    const h = this.heightMap[i];
    const m = this.moisture[i];
    let b;
    if (h < H.DEEP_WATER) b = Biome.DEEP_WATER;
    else if (h < H.WATER) b = Biome.WATER;
    else if (h < H.SAND) b = Biome.SAND;
    else if (h < H.GRASS) b = (m < 0.32 ? Biome.DESERT : Biome.GRASS);
    else if (h < H.ROCK) b = Biome.ROCK;
    else b = Biome.SNOW;
    this.biome[i] = b;
    if (isWater(b) && this.trees.has(i)) this.trees.delete(i);
    return b;
  }

  forEachInRadius(cx, cy, radius, fn) {
    const r = Math.ceil(radius);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= radius) fn(x, y, this.idx(x, y), d);
      }
    }
  }

  terraform(cx, cy, radius, delta) {
    this.forEachInRadius(cx, cy, radius, (x, y, i, d) => {
      const falloff = 1 - d / (radius + 0.001);
      this.heightMap[i] = Math.min(1, Math.max(0, this.heightMap[i] + delta * falloff));
      this.recomputeBiome(i);
    });
    this.terrainDirty = true;
  }

  addWater(cx, cy, radius) {
    this.forEachInRadius(cx, cy, radius, (x, y, i) => {
      this.heightMap[i] = Math.min(this.heightMap[i], H.WATER - 0.03);
      this.recomputeBiome(i);
    });
    this.terrainDirty = true;
  }

  plantTree(x, y) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.biome[i] !== Biome.GRASS && this.biome[i] !== Biome.DESERT) return false;
    if (this.trees.has(i)) return false;
    this.trees.set(i, { growth: 0.05 });
    this.terrainDirty = true;
    return true;
  }

  removeTree(x, y) {
    const i = this.idx(x, y);
    if (this.trees.delete(i)) this.terrainDirty = true;
  }

  igniteFire(x, y) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    const b = this.biome[i];
    if (isWater(b)) return;
    if (b !== Biome.GRASS && b !== Biome.DESERT && !this.trees.has(i)) return;
    if (!this.fires.has(i)) this.fires.set(i, { life: this.trees.has(i) ? 10 : 5 });
  }

  lightning(x, y) {
    if (!this.inBounds(x, y)) return;
    const victim = this.entities.find(e => e.alive && Math.round(e.x) === x && Math.round(e.y) === y);
    if (victim) { victim.alive = false; victim.deathCause = 'lightning'; }
    this.igniteFire(x, y);
  }

  meteor(cx, cy, radius = 4) {
    this.forEachInRadius(cx, cy, radius, (x, y, i, d) => {
      const falloff = 1 - d / (radius + 0.001);
      this.heightMap[i] = Math.max(0, this.heightMap[i] - 0.55 * falloff);
      this.recomputeBiome(i);
      this.trees.delete(i);
      if (d > radius * 0.55 && d < radius) this.igniteFire(x, y);
    });
    for (const e of this.entities) {
      if (!e.alive) continue;
      const dx = e.x - cx, dy = e.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) { e.alive = false; e.deathCause = 'meteor'; }
    }
    this.terrainDirty = true;
  }

  killAt(x, y) {
    const i = this.idx(x, y);
    if (this.trees.has(i)) { this.trees.delete(i); this.terrainDirty = true; return; }
    const victim = this.entities.find(e => e.alive && Math.round(e.x) === x && Math.round(e.y) === y);
    if (victim) { victim.alive = false; victim.deathCause = 'erased'; }
  }

  stepFire() {
    if (this.fires.size === 0) return;
    const toIgnite = [];
    for (const [i, f] of this.fires) {
      f.life -= 1;
      const x = i % this.width, y = Math.floor(i / this.width);
      if (Math.random() < 0.35) {
        const nx = x + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 0);
        const ny = y + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 0);
        if (this.inBounds(nx, ny)) {
          const ni = this.idx(nx, ny);
          const b = this.biome[ni];
          if (!this.fires.has(ni) && (b === Biome.GRASS || b === Biome.DESERT || this.trees.has(ni))) {
            toIgnite.push(ni);
          }
        }
      }
      for (const e of this.entities) {
        if (!e.alive) continue;
        if (Math.round(e.x) === x && Math.round(e.y) === y && Math.random() < 0.4) {
          e.alive = false; e.deathCause = 'fire';
        }
      }
      if (f.life <= 0) {
        this.trees.delete(i);
        if (this.biome[i] === Biome.GRASS || this.biome[i] === Biome.DESERT) this.biome[i] = Biome.DIRT;
        this.fires.delete(i);
        this.terrainDirty = true;
      }
    }
    for (const ni of toIgnite) this.fires.set(ni, { life: this.trees.has(ni) ? 10 : 5 });
  }

  stepTrees() {
    const newTrees = [];
    for (const [i, t] of this.trees) {
      if (t.growth < 1) {
        t.growth = Math.min(1, t.growth + 0.004);
        if (t.growth >= 1) this.terrainDirty = true;
      } else if (Math.random() < 0.0015) {
        const x = i % this.width, y = Math.floor(i / this.width);
        const nx = x + Math.floor(Math.random() * 3) - 1;
        const ny = y + Math.floor(Math.random() * 3) - 1;
        if (this.inBounds(nx, ny)) {
          const ni = this.idx(nx, ny);
          const b = this.biome[ni];
          if ((b === Biome.GRASS || b === Biome.DESERT) && !this.trees.has(ni)) {
            newTrees.push(ni);
          }
        }
      }
    }
    for (const ni of newTrees) { this.trees.set(ni, { growth: 0.05 }); this.terrainDirty = true; }
  }

  stepDirtRegrowth() {
    if (this.tick % 20 !== 0) return;
    for (let i = 0; i < this.biome.length; i++) {
      if (this.biome[i] === Biome.DIRT && Math.random() < 0.02) {
        this.biome[i] = Biome.GRASS;
        this.terrainDirty = true;
      }
    }
  }

  step() {
    this.tick++;
    this.stepFire();
    this.stepTrees();
    this.stepDirtRegrowth();
  }
}
