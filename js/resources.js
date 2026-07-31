import { Biome, isLand, isWater } from './terrain.js';

// World-wide wild resources: trees and rock/ore outcrops are scattered across
// every forest/rock biome tile on the whole map (not just near settlements),
// so the world reads as a real place instead of a decorative ring around
// each village. Fish spots line the coasts. Animals roam and are hunted.

const TREE_STAGE_AGE = [0, 8, 20, 40]; // days needed to reach stage 0,1,2,3
const TREE_SPACING = 1.3;
export const MAX_TREES = 900;
export const MAX_ROCKS = 320;
export const MAX_FISH_SPOTS = 160;
export const MAX_ANIMALS = 150;

export const ANIMAL_KINDS = {
  deer: { label: 'олень', food: 20, icon: '🦌' },
  boar: { label: 'кабан', food: 26, icon: '🐗' },
};

function scatterClusters(terrain, biomeWeights, clusterSize, spacing, cap, out) {
  const cellSize = 5;
  for (let cy = 0; cy < terrain.height && out.length < cap; cy += cellSize) {
    for (let cx = 0; cx < terrain.width && out.length < cap; cx += cellSize) {
      const x = cx + Math.floor(Math.random() * cellSize);
      const y = cy + Math.floor(Math.random() * cellSize);
      if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
      const w = biomeWeights[terrain.biome[terrain.idx(x, y)]] || 0;
      if (w <= 0 || Math.random() > w) continue;
      const n = clusterSize[0] + Math.floor(Math.random() * (clusterSize[1] - clusterSize[0] + 1));
      for (let i = 0; i < n && out.length < cap; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 2.4;
        const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
        if (px < 1 || py < 1 || px >= terrain.width - 1 || py >= terrain.height - 1) continue;
        const pb = terrain.biome[terrain.idx(px, py)];
        if (!(biomeWeights[pb] > 0)) continue;
        if (out.some(o => (o.x - px) ** 2 + (o.y - py) ** 2 < spacing ** 2)) continue;
        out.push({ x: px, y: py });
      }
    }
  }
  return out;
}

export function isCoastal(terrain, x, y) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= terrain.width || yy >= terrain.height) continue;
      if (isWater(terrain.biome[terrain.idx(xx, yy)])) return true;
    }
  }
  return false;
}

function scatterCoastal(terrain, cap, spacing) {
  const out = [];
  for (let y = 1; y < terrain.height - 1 && out.length < cap; y++) {
    for (let x = 1; x < terrain.width - 1 && out.length < cap; x++) {
      const b = terrain.biome[terrain.idx(x, y)];
      if (!isWater(b)) continue;
      if (Math.random() > 0.05) continue;
      let hasLand = false;
      for (let dy = -1; dy <= 1 && !hasLand; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (isLand(terrain.biome[terrain.idx(x + dx, y + dy)])) { hasLand = true; break; }
        }
      }
      if (!hasLand) continue;
      if (out.some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < spacing ** 2)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

export function generateWorldResources(terrain) {
  const treeSpots = scatterClusters(terrain, { [Biome.FOREST]: 0.6, [Biome.GRASS]: 0.07 }, [3, 7], TREE_SPACING, MAX_TREES, []);
  const trees = treeSpots.map((s, i) => ({
    id: i, x: s.x, y: s.y, stage: 3, plantedDay: -Math.round(Math.random() * 70),
  }));

  const rockSpots = scatterClusters(terrain, { [Biome.ROCK]: 0.55, [Biome.SAND]: 0.05, [Biome.GRASS]: 0.015 }, [2, 4], 1.6, MAX_ROCKS, []);
  const rocks = rockSpots.map((s, i) => ({ id: i, x: s.x, y: s.y }));

  const fishSpots = scatterCoastal(terrain, MAX_FISH_SPOTS, 2.2).map((s, i) => ({ id: i, x: s.x, y: s.y }));

  const animalSpots = scatterClusters(terrain, { [Biome.FOREST]: 0.05, [Biome.GRASS]: 0.03 }, [1, 2], 3, MAX_ANIMALS, []);
  const kinds = Object.keys(ANIMAL_KINDS);
  const animals = animalSpots.map((s, i) => ({
    id: i, kind: kinds[Math.floor(Math.random() * kinds.length)],
    x: s.x, y: s.y, homeX: s.x, homeY: s.y, wanderTx: s.x, wanderTy: s.y, wanderTimer: Math.random() * 4,
  }));

  return {
    trees, rocks, fishSpots, animals,
    nextTreeId: trees.length, nextAnimalId: animals.length,
  };
}

export function growTrees(world, day) {
  for (const t of world.trees) {
    const age = day - t.plantedDay;
    let stage = 0;
    for (let s = TREE_STAGE_AGE.length - 1; s >= 0; s--) if (age >= TREE_STAGE_AGE[s]) { stage = s; break; }
    t.stage = stage;
  }
}

export function maybeSpawnTree(world, terrain, day, nearSettlements) {
  if (world.trees.length >= MAX_TREES) return;
  // Slightly more likely near a settlement with a sawmill (managed forestry),
  // otherwise trees just quietly reclaim the wilds over time.
  const boosted = nearSettlements.some(s => s.buildings.some(b => b.type === 'sawmill'));
  if (Math.random() > (boosted ? 0.35 : 0.12)) return;
  for (let tries = 0; tries < 20; tries++) {
    const x = 1 + Math.floor(Math.random() * (terrain.width - 2));
    const y = 1 + Math.floor(Math.random() * (terrain.height - 2));
    const b = terrain.biome[terrain.idx(x, y)];
    if (b !== Biome.FOREST && b !== Biome.GRASS) continue;
    if (world.trees.some(t => (t.x - x) ** 2 + (t.y - y) ** 2 < TREE_SPACING ** 2)) continue;
    world.trees.push({ id: world.nextTreeId++, x, y, stage: 0, plantedDay: day });
    return;
  }
}

export function findPlantSpot(world, terrain, near) {
  if (world.trees.length >= MAX_TREES) return null;
  for (let tries = 0; tries < 24; tries++) {
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 11;
    const x = Math.round(near.x + Math.cos(a) * r), y = Math.round(near.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    const b = terrain.biome[terrain.idx(x, y)];
    if (b !== Biome.FOREST && b !== Biome.GRASS) continue;
    if (world.trees.some(t => (t.x - x) ** 2 + (t.y - y) ** 2 < TREE_SPACING ** 2)) continue;
    return { x, y };
  }
  return null;
}

function moveAnimalToward(a, tx, ty, dtSec, speed) {
  const dx = tx - a.x, dy = ty - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.1) return true;
  const step = Math.min(d, speed * dtSec);
  a.x += (dx / d) * step; a.y += (dy / d) * step;
  return false;
}

export function updateAnimals(world, terrain, dtSec) {
  for (const a of world.animals) {
    a.wanderTimer -= dtSec;
    const arrived = moveAnimalToward(a, a.wanderTx, a.wanderTy, dtSec, 0.9);
    if (arrived || a.wanderTimer <= 0) {
      const ang = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5;
      let tx = a.homeX + Math.cos(ang) * r, ty = a.homeY + Math.sin(ang) * r;
      tx = Math.max(1, Math.min(terrain.width - 2, tx));
      ty = Math.max(1, Math.min(terrain.height - 2, ty));
      if (isLand(terrain.biome[terrain.idx(Math.round(tx), Math.round(ty))])) { a.wanderTx = tx; a.wanderTy = ty; }
      a.wanderTimer = 3 + Math.random() * 5;
    }
  }
}

export function tickWildlife(world, terrain, day) {
  if (world.animals.length >= MAX_ANIMALS) return;
  for (const a of [...world.animals]) {
    if (Math.random() > 0.01) continue;
    if (world.animals.length >= MAX_ANIMALS) break;
    const ang = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
    const x = Math.round(a.x + Math.cos(ang) * r), y = Math.round(a.y + Math.sin(ang) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    if (!isLand(terrain.biome[terrain.idx(x, y)])) continue;
    world.animals.push({
      id: world.nextAnimalId++, kind: a.kind, x, y, homeX: x, homeY: y, wanderTx: x, wanderTy: y, wanderTimer: Math.random() * 4,
    });
  }
}
