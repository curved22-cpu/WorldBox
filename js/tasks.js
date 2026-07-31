import { Biome, isLand } from './terrain.js';
import { addEvent } from './events.js';

export const WALK_SPEED = 2.4; // tiles per sim-second
const CHOP_DURATION = 2.5;
const MINE_DURATION = 3;
const FARM_DURATION = 3;
const BUILD_DURATION = 2.5;
const PLANT_DURATION = 2;
const PICKUP_PAUSE = 0.6;
const DROP_PAUSE = 0.5;

// Rough cycles/day a worker completes given the travel distances used below —
// gather/build yields are derived from the old per-day formulas divided by
// these, so watching it happen live gives roughly the same totals as the
// fast offline catch-up simulation.
const CYCLES_PER_DAY = { wood: 3.2, stone: 2.75, ore: 2.75, food: 5.6, build: 6.0 };

// Tree growth: a sapling becomes a bush, then a medium tree, then a large
// tree old enough to harvest. Age is tracked in days since planting.
const TREE_STAGE_AGE = [0, 8, 20, 40]; // days needed to reach stage 0,1,2,3
const MAX_TREES = 26;
const TREE_SPACING = 1.3;

export function initSites(settlement, terrain) {
  settlement.trees = [];
  settlement.nextTreeId = 0;
  for (let i = 0; i < 20; i++) {
    const spot = scatterSpot(settlement, terrain, 4, 16, [Biome.FOREST, Biome.GRASS], null);
    settlement.trees.push({ id: settlement.nextTreeId++, x: spot.x, y: spot.y, stage: 3, plantedDay: -1000 });
  }
  settlement.rocks = [];
  for (let i = 0; i < 10; i++) {
    const spot = scatterSpot(settlement, terrain, 5, 18, [Biome.ROCK, Biome.SAND, Biome.GRASS], null);
    settlement.rocks.push({ id: i, x: spot.x, y: spot.y });
  }
  settlement.field = scatterSpot(settlement, terrain, 2.5, 5, [Biome.GRASS], null);
}

// Always returns a tile on land — first choice is one of the preferred
// biomes (respecting minimum spacing from existing trees if given), then any
// land tile in range, then the settlement's own tile (guaranteed land since
// findLandSpot placed the settlement there).
function scatterSpot(settlement, terrain, minR, maxR, preferredBiomes, avoidList) {
  const tooClose = (x, y) => avoidList && avoidList.some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < TREE_SPACING ** 2);
  for (let tries = 0; tries < 30; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.round(settlement.x + Math.cos(a) * r);
    const y = Math.round(settlement.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    if (tooClose(x, y)) continue;
    if (preferredBiomes.includes(terrain.biome[terrain.idx(x, y)])) return { x, y };
  }
  for (let tries = 0; tries < 60; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.round(settlement.x + Math.cos(a) * r);
    const y = Math.round(settlement.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    if (tooClose(x, y)) continue;
    if (isLand(terrain.biome[terrain.idx(x, y)])) return { x, y };
  }
  return avoidList ? null : { x: settlement.x, y: settlement.y };
}

export function nearestLandSpot(pos, terrain) {
  const x0 = Math.round(pos.x), y0 = Math.round(pos.y);
  if (x0 >= 0 && y0 >= 0 && x0 < terrain.width && y0 < terrain.height &&
    isLand(terrain.biome[terrain.idx(x0, y0)])) return pos;
  for (let r = 1; r <= 6; r++) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = Math.round(pos.x + Math.cos(a) * r), y = Math.round(pos.y + Math.sin(a) * r);
      if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
      if (isLand(terrain.biome[terrain.idx(x, y)])) return { x, y };
    }
  }
  return pos;
}

export function nextBuildingSlot(settlement, index) {
  const ang = index * 2.4 + 0.6;
  const ring = Math.floor(index / 6);
  const r = 2.2 + ring * 1.7;
  return { x: settlement.x + Math.cos(ang) * r, y: settlement.y + Math.sin(ang) * r };
}

export function growTrees(settlement, day) {
  for (const t of settlement.trees) {
    const age = day - t.plantedDay;
    let stage = 0;
    for (let s = TREE_STAGE_AGE.length - 1; s >= 0; s--) if (age >= TREE_STAGE_AGE[s]) { stage = s; break; }
    t.stage = stage;
  }
}

export function maybeSpawnTree(settlement, terrain, day) {
  if (settlement.trees.length >= MAX_TREES) return;
  const hasSawmill = settlement.buildings.some(b => b.type === 'sawmill');
  const chance = hasSawmill ? 0.1 : 0.025;
  if (Math.random() > chance) return;
  const spot = scatterSpot(settlement, terrain, 4, 16, [Biome.FOREST, Biome.GRASS], settlement.trees);
  if (spot) settlement.trees.push({ id: settlement.nextTreeId++, x: spot.x, y: spot.y, stage: 0, plantedDay: day });
}

function findPlantSpot(settlement, terrain) {
  if (settlement.trees.length >= MAX_TREES) return null;
  return scatterSpot(settlement, terrain, 3, 14, [Biome.FOREST, Biome.GRASS], settlement.trees);
}

function moveToward(person, tx, ty, dtSec) {
  const dx = tx - person.pos.x, dy = ty - person.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.15) return true;
  const step = Math.min(d, WALK_SPEED * dtSec);
  person.pos.x += (dx / d) * step;
  person.pos.y += (dy / d) * step;
  return false;
}

// A tile path is "walkable" if a straight line to it never dips into water —
// used to avoid sending someone to a resource across a bay or inlet, which
// would otherwise look like they're walking on water.
function pathIsClear(terrain, x0, y0, x1, y1) {
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    if (x < 0 || y < 0 || x >= terrain.width || y >= terrain.height) continue;
    if (!isLand(terrain.biome[terrain.idx(x, y)])) return false;
  }
  return true;
}

function nearestReachable(list, from, terrain) {
  let best = null, bestD = Infinity;
  let fallback = null, fallbackD = Infinity;
  for (const item of list) {
    const d = (item.x - from.x) ** 2 + (item.y - from.y) ** 2;
    if (d < fallbackD) { fallbackD = d; fallback = item; }
    if (d < bestD && pathIsClear(terrain, from.x, from.y, item.x, item.y)) { bestD = d; best = item; }
  }
  return best || fallback;
}

function nearestTree(settlement, from, terrain) {
  return nearestReachable(settlement.trees.filter(t => t.stage === 3), from, terrain);
}

function nearestRock(settlement, from, terrain) {
  return nearestReachable(settlement.rocks, from, terrain);
}

function assignTask(person, settlement, terrain) {
  const job = person.job;
  if (job === 'woodcutter') {
    const tree = nearestTree(settlement, person.pos, terrain);
    if (tree) {
      person.task = { kind: 'wood', phase: 'toSite', treeId: tree.id, timer: 0, carrying: 0 };
      return;
    }
    const hasSawmill = settlement.buildings.some(b => b.type === 'sawmill');
    const spot = hasSawmill && pathIsClear(terrain, person.pos.x, person.pos.y, person.pos.x, person.pos.y)
      ? findPlantSpot(settlement, terrain) : null;
    person.task = spot ? { kind: 'plant', phase: 'toSite', tx: spot.x, ty: spot.y, timer: 0 } : null;
  } else if (job === 'miner') {
    const rock = nearestRock(settlement, person.pos, terrain);
    const wantOre = settlement.era >= 5 && Math.random() < 0.4;
    person.task = rock ? { kind: wantOre ? 'ore' : 'stone', phase: 'toSite', rockId: rock.id, timer: 0, carrying: 0 } : null;
  } else if (job === 'farmer') {
    person.task = { kind: 'food', phase: 'toSite', timer: 0, carrying: 0 };
  } else if (job === 'builder') {
    person.task = settlement.constructionQueue ? { kind: 'build', phase: 'toStorage', timer: 0, carrying: 0 } : null;
  } else {
    const spot = nearestLandSpot({
      x: settlement.x + (Math.random() * 2 - 1) * 3,
      y: settlement.y + (Math.random() * 2 - 1) * 3,
    }, terrain);
    person.task = { kind: 'idle', phase: 'wander', tx: spot.x, ty: spot.y, timer: 1 + Math.random() * 3 };
  }
}

function updateGather(person, settlement, t, dtSec, day, resKey, yieldPerCycle, siteFn, onWorkDone, game) {
  if (t.phase === 'toSite') {
    const site = siteFn();
    if (!site) { person.task = null; return; }
    if (moveToward(person, site.x, site.y, dtSec)) { t.phase = 'working'; t.timer = t.workDuration; }
  } else if (t.phase === 'working') {
    const site = siteFn();
    if (!site) { person.task = null; return; }
    t.timer -= dtSec;
    if (t.timer <= 0) {
      t.carrying = yieldPerCycle;
      if (onWorkDone) onWorkDone(game);
      t.phase = 'toDrop';
    }
  } else if (t.phase === 'toDrop') {
    if (moveToward(person, settlement.x, settlement.y, dtSec)) { t.phase = 'depositing'; t.timer = DROP_PAUSE; }
  } else if (t.phase === 'depositing') {
    t.timer -= dtSec;
    if (t.timer <= 0) {
      settlement.stock[resKey] = (settlement.stock[resKey] || 0) + t.carrying;
      t.carrying = 0;
      person.task = null;
    }
  }
}

function updateBuild(person, settlement, t, dtSec) {
  if (!settlement.constructionQueue) { person.task = null; return; }
  if (t.phase === 'toStorage') {
    if (moveToward(person, settlement.x, settlement.y, dtSec)) { t.phase = 'pickup'; t.timer = PICKUP_PAUSE; }
  } else if (t.phase === 'pickup') {
    t.timer -= dtSec;
    if (t.timer <= 0) t.phase = 'toSite';
  } else if (t.phase === 'toSite') {
    const site = settlement.constructionQueue.pos;
    if (moveToward(person, site.x, site.y, dtSec)) { t.phase = 'building'; t.timer = BUILD_DURATION; }
  } else if (t.phase === 'building') {
    t.timer -= dtSec;
    if (t.timer <= 0) {
      settlement.constructionQueue.progress += (1 + person.stats.strength / 20 + person.skills.building * 0.1) / CYCLES_PER_DAY.build;
      person.skills.building = Math.min(100, person.skills.building + 0.03);
      person.task = null;
    }
  }
}

function updatePlant(person, settlement, t, dtSec, day) {
  if (t.phase === 'toSite') {
    if (moveToward(person, t.tx, t.ty, dtSec)) { t.phase = 'planting'; t.timer = PLANT_DURATION; }
  } else if (t.phase === 'planting') {
    t.timer -= dtSec;
    if (t.timer <= 0) {
      if (settlement.trees.length < MAX_TREES) {
        settlement.trees.push({ id: settlement.nextTreeId++, x: t.tx, y: t.ty, stage: 0, plantedDay: day });
      }
      person.skills.woodcutting = Math.min(100, person.skills.woodcutting + 0.02);
      person.task = null;
    }
  }
}

function updateIdle(person, settlement, t, dtSec, terrain) {
  t.timer -= dtSec;
  const arrived = moveToward(person, t.tx, t.ty, dtSec);
  if (arrived || t.timer <= 0) {
    const spot = nearestLandSpot({
      x: settlement.x + (Math.random() * 2 - 1) * 3,
      y: settlement.y + (Math.random() * 2 - 1) * 3,
    }, terrain);
    t.tx = spot.x; t.ty = spot.y;
    t.timer = 1 + Math.random() * 3;
  }
}

function jobMatchesTask(job, taskKind) {
  if (job === 'woodcutter') return taskKind === 'wood' || taskKind === 'plant';
  if (job === 'miner') return taskKind === 'stone' || taskKind === 'ore';
  if (job === 'farmer') return taskKind === 'food';
  if (job === 'builder') return taskKind === 'build';
  return taskKind === 'idle';
}

export function updateTask(person, settlement, dtSec, day, bonuses, game) {
  if (!person.task || !jobMatchesTask(person.job, person.task.kind)) assignTask(person, settlement, game.terrain);
  const t = person.task;
  if (!t) return;

  if (t.kind === 'wood') {
    t.workDuration = CHOP_DURATION;
    updateGather(person, settlement, t, dtSec, day, 'wood',
      ((5 + person.stats.strength / 12) * bonuses.wood * bonuses.rail) / CYCLES_PER_DAY.wood,
      () => settlement.trees.find(x => x.id === t.treeId && x.stage === 3) || null,
      () => {
        const idx = settlement.trees.findIndex(x => x.id === t.treeId);
        if (idx !== -1) settlement.trees.splice(idx, 1);
        person.skills.woodcutting = Math.min(100, person.skills.woodcutting + 0.03);
        if (!settlement.milestones.firstTree) {
          settlement.milestones.firstTree = true;
          addEvent(game.events, day, `${person.name} срубил${person.sex === 'f' ? 'а' : ''} первое дерево поселения «${settlement.name}».`, 'milestone');
        }
      }, game);
  } else if (t.kind === 'plant') {
    updatePlant(person, settlement, t, dtSec, day);
  } else if (t.kind === 'stone' || t.kind === 'ore') {
    t.workDuration = MINE_DURATION;
    const yieldPerCycle = t.kind === 'stone'
      ? ((4 + person.stats.strength / 14) * bonuses.mine * bonuses.rail) / CYCLES_PER_DAY.stone
      : ((3 + person.stats.strength / 16) * bonuses.mine * bonuses.refinery) / CYCLES_PER_DAY.ore;
    updateGather(person, settlement, t, dtSec, day, t.kind, yieldPerCycle,
      () => settlement.rocks.find(x => x.id === t.rockId) || null, null, game);
  } else if (t.kind === 'food') {
    t.workDuration = FARM_DURATION;
    updateGather(person, settlement, t, dtSec, day, 'food',
      ((12 + person.stats.strength / 6) * bonuses.farm * bonuses.rail) / CYCLES_PER_DAY.food,
      () => settlement.field,
      () => { person.skills.farming = Math.min(100, person.skills.farming + 0.03); }, game);
  } else if (t.kind === 'build') {
    updateBuild(person, settlement, t, dtSec);
  } else if (t.kind === 'idle') {
    updateIdle(person, settlement, t, dtSec, game.terrain);
  }
}

export function updateAllTasks(game, dtSec) {
  for (const s of game.settlements) {
    const bonuses = {
      farm: (s.buildings.some(b => b.type === 'farm') ? 1.3 : 1) * (s.buildings.some(b => b.type === 'hunterHut') ? 1.15 : 1),
      wood: s.buildings.some(b => b.type === 'sawmill') ? 1.3 : 1,
      mine: (s.buildings.some(b => b.type === 'forge') ? 1.25 : 1) *
        (s.buildings.some(b => b.type === 'factory') ? 1.3 : 1) *
        (s.buildings.some(b => b.type === 'mine') ? 1.2 : 1),
      rail: s.buildings.some(b => b.type === 'railway') ? 1.1 : 1,
      refinery: s.buildings.some(b => b.type === 'refinery') ? 1.2 : 1,
    };
    for (const id of s.peopleIds) {
      const p = game.people.get(id);
      if (p && p.alive) updateTask(p, s, dtSec, game.day, bonuses, game);
    }
  }
}
