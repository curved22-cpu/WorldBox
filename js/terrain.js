import { Noise2D } from './noise.js';

export const Biome = { DEEP_WATER: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, ROCK: 5, SNOW: 6 };
const H = { DEEP_WATER: 0.30, WATER: 0.38, SAND: 0.43, GRASS: 0.66, ROCK: 0.90 };

export function isWater(b) { return b === Biome.DEEP_WATER || b === Biome.WATER; }
export function isLand(b) { return !isWater(b); }

export function generateTerrain(width, height, seed) {
  const heightNoise = new Noise2D(seed);
  const moistNoise = new Noise2D(seed ^ 0x9e3779b9);
  const n = width * height;
  const heightMap = new Float32Array(n);
  const moisture = new Float32Array(n);
  const biome = new Uint8Array(n);
  const idx = (x, y) => y * width + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      const nx = x / width, ny = y / height;
      let h = heightNoise.fbm(nx * 3.2, ny * 3.2, 5, 2.05, 0.5);
      const dx = nx - 0.5, dy = ny - 0.5;
      const edge = Math.min(1, (dx * dx + dy * dy) * 2.6);
      h = h * 0.5 + 0.5;
      h = h * (1 - edge * 0.9);
      heightMap[i] = h;
      const m = moistNoise.fbm(nx * 4 + 100, ny * 4 + 100, 4, 2.0, 0.5) * 0.5 + 0.5;
      moisture[i] = m;
      let b;
      if (h < H.DEEP_WATER) b = Biome.DEEP_WATER;
      else if (h < H.WATER) b = Biome.WATER;
      else if (h < H.SAND) b = Biome.SAND;
      else if (h < H.GRASS) b = Biome.GRASS;
      else if (h < H.ROCK) b = (m > 0.45 ? Biome.FOREST : Biome.GRASS);
      else b = (h > 0.94 ? Biome.SNOW : Biome.ROCK);
      biome[i] = b;
    }
  }
  return { width, height, heightMap, moisture, biome, idx };
}

export function findLandSpot(terrain, near) {
  const { width, height, biome, idx } = terrain;
  let best = null, bestScore = -Infinity;
  const minR = near ? 25 : 0, maxR = near ? 70 : Math.max(width, height) * 0.6;
  for (let tries = 0; tries < 600; tries++) {
    let xx, yy;
    if (near) {
      const ang = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      xx = Math.round(near.x + Math.cos(ang) * r);
      yy = Math.round(near.y + Math.sin(ang) * r);
    } else {
      xx = Math.round(Math.random() * width);
      yy = Math.round(Math.random() * height);
    }
    if (xx < 2 || yy < 2 || xx >= width - 2 || yy >= height - 2) continue;
    const b = biome[idx(xx, yy)];
    if (b !== Biome.GRASS && b !== Biome.FOREST) continue;
    let waterNearby = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (isWater(biome[idx(xx + dx, yy + dy)])) waterNearby++;
    }
    const score = waterNearby + Math.random() * 2;
    if (score > bestScore) { bestScore = score; best = { x: xx, y: yy }; }
  }
  return best || { x: Math.floor(terrain.width / 2), y: Math.floor(terrain.height / 2) };
}
