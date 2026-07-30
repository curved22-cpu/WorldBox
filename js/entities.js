import { isLand, Biome, isBuildable, RACES } from './world.js';

export const SENTIENT = new Set(['human', 'elf', 'orc']);

export const SPECIES = {
  human: {
    label: 'Человек', race: 'human', diet: 'tree', speed: 0.10, hungerRate: 0.0016,
    maxAge: 3200, adultAge: 220, visionRadius: 9, reproThreshold: 0.65, reproChance: 0.02,
    reproCooldown: 180, cap: 220, color: '#e7b88a', outline: '#8a5a34', radius: 2.6,
    fearOf: ['zombie', 'dragon'],
  },
  elf: {
    label: 'Эльф', race: 'elf', diet: 'tree', speed: 0.10, hungerRate: 0.0015,
    maxAge: 3600, adultAge: 240, visionRadius: 9, reproThreshold: 0.65, reproChance: 0.018,
    reproCooldown: 190, cap: 180, color: '#a3e0b8', outline: '#3f7a54', radius: 2.6,
    fearOf: ['zombie', 'dragon'],
  },
  orc: {
    label: 'Орк', race: 'orc', diet: 'meat', preyTypes: ['sheep', 'rabbit'],
    speed: 0.11, hungerRate: 0.0016, maxAge: 2600, adultAge: 190, visionRadius: 10,
    reproThreshold: 0.6, reproChance: 0.024, reproCooldown: 160, cap: 200,
    color: '#8fae5c', outline: '#3f4d24', radius: 2.9, fearOf: ['zombie', 'dragon'],
  },
  sheep: {
    label: 'Овца', diet: 'grass', speed: 0.09, hungerRate: 0.0022, maxAge: 1800, adultAge: 150,
    visionRadius: 6, reproThreshold: 0.6, reproChance: 0.02, reproCooldown: 140,
    cap: 260, color: '#f5f2e6', outline: '#b9ad8f', radius: 3,
    fearOf: ['wolf', 'bear', 'zombie', 'dragon'],
  },
  rabbit: {
    label: 'Кролик', diet: 'grass', speed: 0.13, hungerRate: 0.0024, maxAge: 900, adultAge: 70,
    visionRadius: 5, reproThreshold: 0.55, reproChance: 0.035, reproCooldown: 60,
    cap: 220, color: '#e8d9c0', outline: '#a68b64', radius: 2.2,
    fearOf: ['wolf', 'bear', 'zombie', 'dragon'],
  },
  cow: {
    label: 'Корова', diet: 'grass', speed: 0.06, hungerRate: 0.0016, maxAge: 2200, adultAge: 220,
    visionRadius: 5, reproThreshold: 0.65, reproChance: 0.008, reproCooldown: 260,
    cap: 100, color: '#efe6da', outline: '#3a3a3a', radius: 4.2,
    fearOf: ['wolf', 'bear', 'zombie', 'dragon'],
  },
  wolf: {
    label: 'Волк', diet: 'meat', preyTypes: ['sheep', 'rabbit'],
    speed: 0.15, hungerRate: 0.0026, maxAge: 2200, adultAge: 180, visionRadius: 10,
    reproThreshold: 0.65, reproChance: 0.012, reproCooldown: 220, cap: 80,
    color: '#585866', outline: '#2c2c33', radius: 3.2, fearOf: ['zombie', 'dragon'],
  },
  bear: {
    label: 'Медведь', diet: 'meat', preyTypes: ['cow', 'sheep'],
    speed: 0.10, hungerRate: 0.0016, maxAge: 2600, adultAge: 220, visionRadius: 9,
    reproThreshold: 0.65, reproChance: 0.01, reproCooldown: 260, cap: 35,
    color: '#6b4a34', outline: '#2e1f16', radius: 4.4, fearOf: ['zombie', 'dragon'],
  },
  zombie: {
    label: 'Зомби', diet: 'infect', speed: 0.085, hungerRate: 0, maxAge: 1400, adultAge: 0,
    visionRadius: 8, reproChance: 0, cap: 400, color: '#7c8c5a', outline: '#33401f', radius: 3,
  },
  dragon: {
    label: 'Дракон', diet: 'fire', speed: 0.055, hungerRate: 0, maxAge: 999999, adultAge: 0,
    visionRadius: 14, reproChance: 0, cap: 6, color: '#b3273e', outline: '#5c0f1c', radius: 7,
    flies: true,
  },
};

let nextId = 1;

export function spawnEntity(world, type, x, y, opts = {}) {
  const cfg = SPECIES[type];
  const count = world.entities.reduce((n, e) => n + (e.alive && e.type === type ? 1 : 0), 0);
  if (count >= cfg.cap) return null;
  const e = {
    id: nextId++, type, race: cfg.race || null, x, y, tx: null, ty: null,
    age: opts.age ?? 0, energy: opts.energy ?? 0.8, health: 1,
    alive: true, deathCause: null,
    reproCooldownTimer: 40 + Math.random() * 40,
    decisionTimer: Math.floor(Math.random() * 5),
    fleeing: false, hunting: false, combat: false,
  };
  world.entities.push(e);
  return e;
}

function findNearest(world, e, radius, predicate) {
  let best = null, bestD = Infinity;
  const r2 = radius * radius;
  for (const o of world.entities) {
    if (!o.alive || o === e) continue;
    if (!predicate(o)) continue;
    const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
    if (d < r2 && d < bestD) { bestD = d; best = o; }
  }
  return best;
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

function randomWalkable(world, cx, cy, radius) {
  for (let tries = 0; tries < 8; tries++) {
    const x = Math.round(cx + (Math.random() * 2 - 1) * radius);
    const y = Math.round(cy + (Math.random() * 2 - 1) * radius);
    if (world.inBounds(x, y) && isLand(world.biome[world.idx(x, y)])) return { x, y };
  }
  return null;
}

function randomAnywhere(world, cx, cy, radius) {
  const x = Math.max(0, Math.min(world.width - 1, Math.round(cx + (Math.random() * 2 - 1) * radius)));
  const y = Math.max(0, Math.min(world.height - 1, Math.round(cy + (Math.random() * 2 - 1) * radius)));
  return { x, y };
}

function stepMove(world, e, speed, flies = false) {
  if (e.tx == null) return false;
  const dx = e.tx - e.x, dy = e.ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.08) { e.tx = null; e.ty = null; return true; }
  const nx = e.x + (dx / dist) * speed;
  const ny = e.y + (dy / dist) * speed;
  const txi = Math.round(nx), tyi = Math.round(ny);
  if (!world.inBounds(txi, tyi)) { e.tx = null; e.ty = null; return false; }
  if (flies || isLand(world.biome[world.idx(txi, tyi)])) {
    e.x = nx; e.y = ny;
  } else {
    e.tx = null; e.ty = null;
  }
  return false;
}

function handleFear(world, e, cfg) {
  if (!cfg.fearOf || !cfg.fearOf.length) { e.fleeing = false; return false; }
  const threat = findNearest(world, e, 6, o => cfg.fearOf.includes(o.type));
  if (!threat) { e.fleeing = false; return false; }
  const dx = e.x - threat.x, dy = e.y - threat.y;
  const d = Math.hypot(dx, dy) || 1;
  e.tx = Math.max(0, Math.min(world.width - 1, e.x + (dx / d) * 5));
  e.ty = Math.max(0, Math.min(world.height - 1, e.y + (dy / d) * 5));
  e.fleeing = true;
  e.combat = false;
  return true;
}

const COMBAT_AGGRO_RADIUS = 4;
const MIN_WARRING_POPULATION = 6;

function handleCombat(world, e, cfg, racePop) {
  const enemy = findNearest(world, e, COMBAT_AGGRO_RADIUS, o => SENTIENT.has(o.type) && o.race !== e.race);
  if (!enemy) { e.combat = false; return false; }
  if (racePop[e.race] < MIN_WARRING_POPULATION) {
    // too few survivors left to fight — flee and regroup instead of being hunted to extinction
    const dx = e.x - enemy.x, dy = e.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    e.tx = Math.max(0, Math.min(world.width - 1, e.x + (dx / d) * 6));
    e.ty = Math.max(0, Math.min(world.height - 1, e.y + (dy / d) * 6));
    e.fleeing = true; e.combat = false;
    return true;
  }
  e.tx = enemy.x; e.ty = enemy.y; e.combat = true;
  const d = Math.hypot(enemy.x - e.x, enemy.y - e.y);
  if (d < 1.0) {
    const dmg = 0.035 + world.raceEra(e.race) * 0.008;
    enemy.health -= dmg;
    e.health -= dmg;
    if (enemy.health <= 0) { enemy.alive = false; enemy.deathCause = 'war'; }
    if (e.health <= 0) { e.alive = false; e.deathCause = 'war'; }
  }
  return true;
}

function handleRaid(world, e, cfg) {
  const x = Math.round(e.x), y = Math.round(e.y);
  let target = null, bestD = Infinity;
  world.forEachInRadius(x, y, 3, (tx, ty, ti, d) => {
    const b = world.buildings.get(ti);
    if (b && b.race !== e.race && d < bestD) { bestD = d; target = { x: tx, y: ty }; }
  });
  if (!target) return false;
  e.tx = target.x; e.ty = target.y;
  if (bestD < 1.3 && Math.random() < 0.1) world.damageBuilding(target.x, target.y, 1);
  return true;
}

function handleHunt(world, e, cfg, hungry) {
  if (!hungry) { e.hunting = false; return false; }
  if (!e.hunting) {
    if (e.decisionTimer > 0) return false;
    e.decisionTimer = 6;
  }
  const prey = findNearest(world, e, cfg.visionRadius, o => cfg.preyTypes.includes(o.type));
  if (!prey) { e.hunting = false; return false; }
  e.hunting = true;
  e.tx = prey.x; e.ty = prey.y;
  const d = Math.hypot(prey.x - e.x, prey.y - e.y);
  if (d < 0.9) {
    prey.alive = false; prey.deathCause = 'eaten';
    e.energy = Math.min(1, e.energy + 0.6);
    e.tx = null; e.hunting = false;
  }
  return true;
}

function handleForage(world, e, cfg, hungry) {
  if (!hungry) return false;
  if (e.tx != null) return true;
  if (e.decisionTimer > 0) return false;
  const tr = nearestTree(world, e, cfg.visionRadius);
  e.decisionTimer = 6;
  if (!tr) return false;
  const d = Math.hypot(tr.x - e.x, tr.y - e.y);
  if (d < 0.9) {
    const t = world.trees.get(tr.i);
    if (t) { t.growth = 0.05; world.terrainDirty = true; }
    e.energy = Math.min(1, e.energy + 0.5);
    return true;
  }
  e.tx = tr.x; e.ty = tr.y;
  return true;
}

function handleGraze(world, e, cfg, hungry) {
  const b = world.biome[world.idx(Math.round(e.x), Math.round(e.y))];
  const onGrass = b === Biome.GRASS || b === Biome.DESERT;
  if (onGrass) {
    e.energy = Math.min(1, e.energy + 0.0045);
    return e.energy < 0.95;
  }
  if (hungry) {
    if (e.tx != null) return true;
    if (e.decisionTimer <= 0) {
      const g = nearestGrass(world, e, cfg.visionRadius);
      e.decisionTimer = 8;
      if (g) { e.tx = g.x; e.ty = g.y; return true; }
    }
  }
  return false;
}

function handleZombie(world, e, cfg) {
  const victim = findNearest(world, e, cfg.visionRadius, o => o.type !== 'zombie' && o.type !== 'dragon');
  if (victim) {
    e.tx = victim.x; e.ty = victim.y;
    const d = Math.hypot(victim.x - e.x, victim.y - e.y);
    if (d < 0.8) {
      victim.alive = false; victim.deathCause = 'infected';
      spawnEntity(world, 'zombie', victim.x, victim.y, { age: 0, energy: 1 });
      e.tx = null;
    }
    return;
  }
  if (e.tx == null && e.decisionTimer <= 0) {
    const w = randomWalkable(world, e.x, e.y, 6);
    if (w) { e.tx = w.x; e.ty = w.y; }
    e.decisionTimer = 15 + Math.floor(Math.random() * 10);
  }
}

function handleDragon(world, e, cfg) {
  e.breathTimer = (e.breathTimer ?? 40) - 1;
  if (e.breathTimer <= 0) {
    const x = Math.round(e.x), y = Math.round(e.y);
    world.forEachInRadius(x, y, 2, (tx, ty) => world.igniteFire(tx, ty));
    for (const o of world.entities) {
      if (o.alive && o.type !== 'dragon') {
        const dd = Math.hypot(o.x - e.x, o.y - e.y);
        if (dd < 2.3 && Math.random() < 0.5) { o.alive = false; o.deathCause = 'dragon fire'; }
      }
    }
    e.breathTimer = 50 + Math.floor(Math.random() * 40);
  }
  if (e.tx == null && e.decisionTimer <= 0) {
    const w = randomAnywhere(world, e.x, e.y, 10);
    e.tx = w.x; e.ty = w.y;
    e.decisionTimer = 20 + Math.floor(Math.random() * 20);
  }
}

function tryFoundSettlement(world, e, cfg) {
  if (e.age < cfg.adultAge || e.energy < 0.55) return;
  if (Math.random() > 0.015) return;
  const x = Math.round(e.x), y = Math.round(e.y);
  if (!world.inBounds(x, y)) return;
  const i = world.idx(x, y);
  if (world.buildings.has(i) || !isBuildable(world.biome[i])) return;
  let nearbySame = 0;
  for (const o of world.entities) {
    if (o.alive && o.type === e.type) {
      const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
      if (d2 < 16) nearbySame++;
    }
  }
  if (nearbySame < 3) return;
  for (const bi of world.buildings.keys()) {
    const bx = bi % world.width, by = Math.floor(bi / world.width);
    if (Math.hypot(bx - x, by - y) < 4) return;
  }
  const terr = world.territory[i];
  const owner = terr === 0 ? null : RACES[terr - 1];
  if (owner && owner !== e.race) return;
  world.foundBuilding(x, y, e.race);
}

function tryReproduce(world, e, cfg) {
  if (e.reproCooldownTimer > 0) return;
  if (e.age < cfg.adultAge || e.energy < cfg.reproThreshold) return;
  if (Math.random() > cfg.reproChance) return;
  const partner = findNearest(world, e, 1.6, o => o.type === e.type && o.age >= cfg.adultAge && o.reproCooldownTimer <= 0);
  if (!partner) return;
  const spot = randomWalkable(world, e.x, e.y, 1.5);
  if (!spot) return;
  const child = spawnEntity(world, e.type, spot.x, spot.y, { age: 0, energy: 0.5 });
  if (child) {
    e.energy -= 0.25; partner.energy -= 0.25;
    e.reproCooldownTimer = cfg.reproCooldown;
    partner.reproCooldownTimer = cfg.reproCooldown;
  }
}

function updateOne(world, e, racePop) {
  const cfg = SPECIES[e.type];
  e.age++;
  if (e.reproCooldownTimer > 0) e.reproCooldownTimer--;
  if (cfg.hungerRate > 0) {
    e.energy -= cfg.hungerRate;
    if (e.energy <= 0) { e.alive = false; e.deathCause = 'starved'; return; }
  }
  if (e.age > cfg.maxAge) { e.alive = false; e.deathCause = 'old age'; return; }
  e.decisionTimer--;

  if (e.type === 'zombie') { handleZombie(world, e, cfg); stepMove(world, e, cfg.speed); return; }
  if (e.type === 'dragon') { handleDragon(world, e, cfg); stepMove(world, e, cfg.speed, true); return; }

  const hungry = cfg.hungerRate > 0 && e.energy < 0.55;

  if (!handleFear(world, e, cfg)) {
    let handled = false;
    if (SENTIENT.has(e.type)) handled = handleCombat(world, e, cfg, racePop);
    if (!handled && SENTIENT.has(e.type)) handled = handleRaid(world, e, cfg);
    if (!handled && cfg.diet === 'meat') handled = handleHunt(world, e, cfg, hungry);
    if (!handled && cfg.diet === 'tree') handled = handleForage(world, e, cfg, hungry);
    if (!handled && cfg.diet === 'grass') handled = handleGraze(world, e, cfg, hungry);

    if (SENTIENT.has(e.type)) tryFoundSettlement(world, e, cfg);

    if (e.tx == null && !e.fleeing && !hungry && e.age > cfg.adultAge && e.reproCooldownTimer <= 0) {
      const mate = findNearest(world, e, cfg.visionRadius, o => o.type === e.type);
      if (mate && Math.hypot(mate.x - e.x, mate.y - e.y) > 1.2) { e.tx = mate.x; e.ty = mate.y; }
    }
    if (e.tx == null && !e.fleeing && e.decisionTimer <= 0 && Math.random() < 0.5) {
      const w = randomWalkable(world, e.x, e.y, 5);
      if (w) { e.tx = w.x; e.ty = w.y; }
      e.decisionTimer = 15 + Math.floor(Math.random() * 15);
    }
  }

  if (SENTIENT.has(e.type) && !e.combat && e.health < 1) e.health = Math.min(1, e.health + 0.0015);

  let moveSpeed = cfg.speed;
  if (e.fleeing) moveSpeed = cfg.speed * 1.4;
  else if (e.hunting) moveSpeed = cfg.speed * 1.8;
  stepMove(world, e, moveSpeed);
  if (cfg.reproChance > 0) tryReproduce(world, e, cfg);
}

export function updateEntities(world) {
  const racePop = { human: 0, elf: 0, orc: 0 };
  for (const e of world.entities) if (e.alive && e.race) racePop[e.race]++;
  for (const e of world.entities) {
    if (e.alive) updateOne(world, e, racePop);
  }
  if (world.entities.length > 3000 || world.tick % 30 === 0) {
    world.entities = world.entities.filter(e => e.alive);
  }
}

export function countBySpecies(world) {
  const counts = {};
  for (const type in SPECIES) counts[type] = 0;
  for (const e of world.entities) if (e.alive) counts[e.type]++;
  return counts;
}

export function civStats(world) {
  const stats = {};
  for (const race of RACES) {
    stats[race] = {
      population: world.entities.reduce((n, e) => n + (e.alive && e.race === race ? 1 : 0), 0),
      buildings: world.raceBuildingCount(race),
      era: world.raceEra(race),
    };
  }
  return stats;
}
