import { isLand, Biome } from './world.js';

export const SPECIES = {
  human: {
    label: 'Человек', speed: 0.10, hungerRate: 0.0016, maxAge: 3200, adultAge: 220,
    visionRadius: 9, reproThreshold: 0.65, reproChance: 0.02, reproCooldown: 180,
    cap: 260, diet: 'tree', color: '#e7b88a', outline: '#8a5a34', radius: 2.6,
  },
  sheep: {
    label: 'Овца', speed: 0.09, hungerRate: 0.0022, maxAge: 1800, adultAge: 150,
    visionRadius: 6, reproThreshold: 0.6, reproChance: 0.02, reproCooldown: 140,
    cap: 320, diet: 'grass', color: '#f5f2e6', outline: '#b9ad8f', radius: 3,
  },
  wolf: {
    label: 'Волк', speed: 0.15, hungerRate: 0.0026, maxAge: 2200, adultAge: 180,
    visionRadius: 10, reproThreshold: 0.65, reproChance: 0.012, reproCooldown: 220,
    cap: 90, diet: 'sheep', color: '#585866', outline: '#2c2c33', radius: 3.2,
  },
};

let nextId = 1;

export function spawnEntity(world, type, x, y, opts = {}) {
  const cfg = SPECIES[type];
  const count = world.entities.reduce((n, e) => n + (e.alive && e.type === type ? 1 : 0), 0);
  if (count >= cfg.cap) return null;
  const e = {
    id: nextId++, type, x, y, tx: null, ty: null,
    age: opts.age ?? 0, energy: opts.energy ?? 0.8,
    alive: true, deathCause: null,
    reproCooldownTimer: 40 + Math.random() * 40,
    decisionTimer: Math.floor(Math.random() * 5),
    fleeing: false,
  };
  world.entities.push(e);
  return e;
}

function nearestTree(world, e, radius) {
  const cx = Math.round(e.x), cy = Math.round(e.y);
  let best = null, bestD = Infinity;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!world.inBounds(x, y)) continue;
      const i = world.idx(x, y);
      const t = world.trees.get(i);
      if (!t || t.growth < 0.5) continue;
      const d = (x - e.x) ** 2 + (y - e.y) ** 2;
      if (d < bestD) { bestD = d; best = { x, y, i }; }
    }
  }
  return best;
}

function nearestGrass(world, e, radius) {
  const cx = Math.round(e.x), cy = Math.round(e.y);
  let best = null, bestD = Infinity;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!world.inBounds(x, y)) continue;
      const b = world.biome[world.idx(x, y)];
      if (b !== Biome.GRASS && b !== Biome.DESERT) continue;
      const d = (x - e.x) ** 2 + (y - e.y) ** 2;
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

function nearestEntity(world, e, type, radius) {
  let best = null, bestD = Infinity;
  for (const o of world.entities) {
    if (!o.alive || o === e || o.type !== type) continue;
    const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
    if (d < radius * radius && d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function randomWalkable(world, cx, cy, radius) {
  for (let tries = 0; tries < 8; tries++) {
    const x = Math.round(cx + (Math.random() * 2 - 1) * radius);
    const y = Math.round(cy + (Math.random() * 2 - 1) * radius);
    if (world.inBounds(x, y) && isLand(world.biome[world.idx(x, y)])) return { x, y };
  }
  return null;
}

function stepMove(world, e, speed) {
  if (e.tx == null) return false;
  const dx = e.tx - e.x, dy = e.ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.08) { e.tx = null; e.ty = null; return true; }
  const nx = e.x + (dx / dist) * speed;
  const ny = e.y + (dy / dist) * speed;
  const txi = Math.round(nx), tyi = Math.round(ny);
  if (world.inBounds(txi, tyi) && isLand(world.biome[world.idx(txi, tyi)])) {
    e.x = nx; e.y = ny;
  } else {
    e.tx = null; e.ty = null;
  }
  return false;
}

function tryReproduce(world, e, cfg) {
  if (e.reproCooldownTimer > 0) return;
  if (e.age < cfg.adultAge || e.energy < cfg.reproThreshold) return;
  if (Math.random() > cfg.reproChance) return;
  const partner = nearestEntity(world, e, e.type, 1.6);
  if (!partner || partner.age < cfg.adultAge || partner.reproCooldownTimer > 0) return;
  const spot = randomWalkable(world, e.x, e.y, 1.5);
  if (!spot) return;
  const child = spawnEntity(world, e.type, spot.x, spot.y, { age: 0, energy: 0.5 });
  if (child) {
    e.energy -= 0.25; partner.energy -= 0.25;
    e.reproCooldownTimer = cfg.reproCooldown;
    partner.reproCooldownTimer = cfg.reproCooldown;
  }
}

function updateOne(world, e) {
  const cfg = SPECIES[e.type];
  e.age++;
  e.energy -= cfg.hungerRate;
  if (e.reproCooldownTimer > 0) e.reproCooldownTimer--;

  if (e.energy <= 0) { e.alive = false; e.deathCause = 'starved'; return; }
  if (e.age > cfg.maxAge) { e.alive = false; e.deathCause = 'old age'; return; }

  const hungry = e.energy < 0.55;
  e.decisionTimer--;

  if (e.type === 'wolf') {
    if (hungry) {
      if (e.decisionTimer <= 0 || e.hunting) {
        const prey = nearestEntity(world, e, 'sheep', cfg.visionRadius);
        if (prey) {
          e.tx = prey.x; e.ty = prey.y; e.hunting = prey.id;
          const d = Math.hypot(prey.x - e.x, prey.y - e.y);
          if (d < 0.9) { prey.alive = false; prey.deathCause = 'eaten'; e.energy = Math.min(1, e.energy + 0.6); e.tx = null; e.hunting = null; }
        } else e.hunting = null;
        e.decisionTimer = 6;
      }
    } else e.hunting = null;
  } else if (e.type === 'sheep') {
    const threat = nearestEntity(world, e, 'wolf', 5);
    if (threat) {
      const dx = e.x - threat.x, dy = e.y - threat.y;
      const d = Math.hypot(dx, dy) || 1;
      e.tx = Math.max(0, Math.min(world.width - 1, e.x + (dx / d) * 4));
      e.ty = Math.max(0, Math.min(world.height - 1, e.y + (dy / d) * 4));
      e.fleeing = true;
    } else {
      e.fleeing = false;
      const b = world.biome[world.idx(Math.round(e.x), Math.round(e.y))];
      if (b === Biome.GRASS || b === Biome.DESERT) e.energy = Math.min(1, e.energy + 0.003);
      else if (hungry && e.decisionTimer <= 0) {
        const g = nearestGrass(world, e, cfg.visionRadius);
        if (g) { e.tx = g.x; e.ty = g.y; }
        e.decisionTimer = 8;
      }
    }
  } else if (e.type === 'human') {
    if (hungry && e.decisionTimer <= 0) {
      const tr = nearestTree(world, e, cfg.visionRadius);
      if (tr) {
        e.tx = tr.x; e.ty = tr.y;
        const d = Math.hypot(tr.x - e.x, tr.y - e.y);
        if (d < 0.6) {
          const t = world.trees.get(tr.i);
          if (t) { t.growth = 0.05; world.terrainDirty = true; }
          e.energy = Math.min(1, e.energy + 0.5);
          e.tx = null;
        }
      }
      e.decisionTimer = 6;
    }
  }

  if (e.tx == null && !e.fleeing && !hungry && e.age > cfg.adultAge && e.reproCooldownTimer <= 0) {
    const mate = nearestEntity(world, e, e.type, cfg.visionRadius);
    if (mate && Math.hypot(mate.x - e.x, mate.y - e.y) > 1.2) {
      e.tx = mate.x; e.ty = mate.y;
    }
  }

  if (e.tx == null && !e.fleeing) {
    if (e.decisionTimer <= 0 && Math.random() < 0.5) {
      const w = randomWalkable(world, e.x, e.y, 5);
      if (w) { e.tx = w.x; e.ty = w.y; }
      e.decisionTimer = 15 + Math.floor(Math.random() * 15);
    }
  }

  let moveSpeed = cfg.speed;
  if (e.type === 'sheep' && e.fleeing) moveSpeed = cfg.speed * 1.3;
  else if (e.type === 'wolf' && e.hunting) moveSpeed = cfg.speed * 1.8;
  stepMove(world, e, moveSpeed);
  tryReproduce(world, e, cfg);
}

export function updateEntities(world) {
  for (const e of world.entities) {
    if (e.alive) updateOne(world, e);
  }
  if (world.entities.length > 2000 || world.tick % 30 === 0) {
    world.entities = world.entities.filter(e => e.alive);
  }
}

export function countBySpecies(world) {
  const counts = { human: 0, sheep: 0, wolf: 0 };
  for (const e of world.entities) if (e.alive) counts[e.type]++;
  return counts;
}
