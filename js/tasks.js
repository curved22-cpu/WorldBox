import { Biome, isLand } from './terrain.js';
import { addEvent } from './events.js';
import { ANIMAL_KINDS, findPlantSpot, updateAnimals } from './resources.js';
import { capFor } from './eras.js';

export const WALK_SPEED = 2.4; // tiles per sim-second
const CHOP_DURATION = 2.5;
const MINE_DURATION = 3;
const FARM_DURATION = 3;
const HUNT_DURATION = 4;
const FISH_DURATION = 3;
const BUILD_DURATION = 2.5;
const PLANT_DURATION = 2;
const PICKUP_PAUSE = 0.6;
const DROP_PAUSE = 0.5;
const HUNT_CATCH_RADIUS = 3.2;

// Rough cycles/day a worker completes given the travel distances used below —
// gather/build yields are derived from the old per-day formulas divided by
// these, so watching it happen live gives roughly the same totals as the
// fast offline catch-up simulation.
const CYCLES_PER_DAY = { wood: 3.2, stone: 2.75, ore: 2.75, grain: 5.6, hunt: 2.0, fish: 3.4, build: 6.0 };

export function initField(settlement, terrain) {
  settlement.field = scatterSpot(settlement, terrain, 2.5, 5, [Biome.GRASS]);
}

// Always returns a tile on land — first choice is one of the preferred
// biomes, then any land tile in range, then the settlement's own tile
// (which findLandSpot already guaranteed is land when it was founded).
function scatterSpot(settlement, terrain, minR, maxR, preferredBiomes) {
  for (let tries = 0; tries < 30; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.round(settlement.x + Math.cos(a) * r);
    const y = Math.round(settlement.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    if (preferredBiomes.includes(terrain.biome[terrain.idx(x, y)])) return { x, y };
  }
  for (let tries = 0; tries < 60; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.round(settlement.x + Math.cos(a) * r);
    const y = Math.round(settlement.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    if (isLand(terrain.biome[terrain.idx(x, y)])) return { x, y };
  }
  return { x: settlement.x, y: settlement.y };
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
  // Sample roughly every half-tile so long-range world resource searches
  // (now up to ~60 tiles away) don't skip over a thin strait or inlet that a
  // coarse fixed sample count would miss.
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(16, Math.ceil(dist * 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    if (x < 0 || y < 0 || x >= terrain.width || y >= terrain.height) continue;
    if (!isLand(terrain.biome[terrain.idx(x, y)])) return false;
  }
  return true;
}

// Only consider resources within a growing radius of the worker so a huge
// world-wide array doesn't get fully scanned every time, and workers prefer
// what's nearby before ranging further out as it gets scarce locally.
function nearestReachable(list, from, terrain, maxR = 45) {
  let best = null, bestD = Infinity;
  let fallback = null, fallbackD = Infinity;
  const maxD2 = maxR * maxR;
  for (const item of list) {
    const d = (item.x - from.x) ** 2 + (item.y - from.y) ** 2;
    if (d > maxD2) continue;
    if (d < fallbackD) { fallbackD = d; fallback = item; }
    if (d < bestD && pathIsClear(terrain, from.x, from.y, item.x, item.y)) { bestD = d; best = item; }
  }
  return best || fallback;
}

function nearestTree(game, from, terrain) {
  return nearestReachable(game.world.trees.filter(t => t.stage === 3), from, terrain);
}

function nearestRock(game, from, terrain) {
  return nearestReachable(game.world.rocks, from, terrain);
}

function nearestAnimal(game, from, terrain) {
  return nearestReachable(game.world.animals, from, terrain, 60);
}

function nearestFishSpot(game, from, terrain) {
  return nearestReachable(game.world.fishSpots, from, terrain, 60);
}

function makeIdleTask(settlement, terrain) {
  const spot = nearestLandSpot({
    x: settlement.x + (Math.random() * 2 - 1) * 3,
    y: settlement.y + (Math.random() * 2 - 1) * 3,
  }, terrain);
  return { kind: 'idle', phase: 'wander', tx: spot.x, ty: spot.y, timer: 1 + Math.random() * 3 };
}

// Always leaves person.task set to something with somewhere to walk — a job
// with no reachable/needed resource right now falls back to idle wandering
// instead of leaving the task null, which used to freeze people in place
// wherever they last stood (usually right at the storage).
function assignTask(person, settlement, game) {
  const terrain = game.terrain;
  const job = person.job;
  if (job === 'woodcutter') {
    const tree = nearestTree(game, person.pos, terrain);
    if (tree) {
      person.task = { kind: 'wood', phase: 'toSite', treeId: tree.id, timer: 0, carrying: 0 };
      return;
    }
    const hasSawmill = settlement.buildings.some(b => b.type === 'sawmill');
    const spot = hasSawmill ? findPlantSpot(game.world, terrain, person.pos) : null;
    person.task = spot ? { kind: 'plant', phase: 'toSite', tx: spot.x, ty: spot.y, timer: 0 } : makeIdleTask(settlement, terrain);
  } else if (job === 'miner') {
    const rock = nearestRock(game, person.pos, terrain);
    const wantOre = settlement.era >= 5 && Math.random() < 0.4;
    person.task = rock ? { kind: wantOre ? 'ore' : 'stone', phase: 'toSite', rockId: rock.id, timer: 0, carrying: 0 } : makeIdleTask(settlement, terrain);
  } else if (job === 'farmer') {
    person.task = { kind: 'grain', phase: 'toSite', timer: 0, carrying: 0 };
  } else if (job === 'hunter') {
    const animal = nearestAnimal(game, person.pos, terrain);
    person.task = animal ? { kind: 'hunt', phase: 'toSite', animalId: animal.id, tx: animal.x, ty: animal.y, timer: 0, carrying: 0 } : makeIdleTask(settlement, terrain);
  } else if (job === 'fisherman') {
    const spot = nearestFishSpot(game, person.pos, terrain);
    person.task = spot ? { kind: 'fish', phase: 'toSite', fishId: spot.id, timer: 0, carrying: 0 } : makeIdleTask(settlement, terrain);
  } else if (job === 'builder') {
    person.task = settlement.constructionQueue ? { kind: 'build', phase: 'toStorage', timer: 0, carrying: 0 } : makeIdleTask(settlement, terrain);
  } else {
    person.task = makeIdleTask(settlement, terrain);
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
      const cap = capFor(settlement, resKey);
      settlement.stock[resKey] = Math.min(cap, (settlement.stock[resKey] || 0) + t.carrying);
      t.carrying = 0;
      person.task = null;
    }
  }
}

function updateHunt(person, settlement, t, dtSec, game, huntBonus) {
  if (t.phase === 'toSite') {
    if (moveToward(person, t.tx, t.ty, dtSec)) { t.phase = 'working'; t.timer = HUNT_DURATION; }
  } else if (t.phase === 'working') {
    t.timer -= dtSec;
    if (t.timer <= 0) {
      const idx = game.world.animals.findIndex(a => a.id === t.animalId);
      t.carrying = 0;
      if (idx !== -1) {
        const a = game.world.animals[idx];
        if ((a.x - t.tx) ** 2 + (a.y - t.ty) ** 2 < HUNT_CATCH_RADIUS ** 2) {
          t.carrying = (ANIMAL_KINDS[a.kind].food * huntBonus) / CYCLES_PER_DAY.hunt;
          game.world.animals.splice(idx, 1);
        }
      }
      person.skills.combat = Math.min(100, person.skills.combat + 0.02);
      t.phase = 'toDrop';
    }
  } else if (t.phase === 'toDrop') {
    if (moveToward(person, settlement.x, settlement.y, dtSec)) { t.phase = 'depositing'; t.timer = DROP_PAUSE; }
  } else if (t.phase === 'depositing') {
    t.timer -= dtSec;
    if (t.timer <= 0) {
      if (t.carrying > 0) {
        const cap = capFor(settlement, 'meat');
        settlement.stock.meat = Math.min(cap, (settlement.stock.meat || 0) + t.carrying);
      }
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

function updatePlant(person, settlement, t, dtSec, day, game) {
  if (t.phase === 'toSite') {
    if (moveToward(person, t.tx, t.ty, dtSec)) { t.phase = 'planting'; t.timer = PLANT_DURATION; }
  } else if (t.phase === 'planting') {
    t.timer -= dtSec;
    if (t.timer <= 0) {
      const world = game.world;
      if (world.trees.length < 900) world.trees.push({ id: world.nextTreeId++, x: t.tx, y: t.ty, stage: 0, plantedDay: day });
      person.skills.woodcutting = Math.min(100, person.skills.woodcutting + 0.02);
      person.task = null;
    }
  }
}

// While idling (no reachable/needed work right now), retry the real job
// each time the wander leg finishes rather than every single frame — cheap,
// and means someone freed up by a full granary starts farming again the
// moment there's room, without visibly twitching in place meanwhile.
function updateIdle(person, settlement, t, dtSec, game) {
  t.timer -= dtSec;
  const arrived = moveToward(person, t.tx, t.ty, dtSec);
  if (arrived || t.timer <= 0) {
    if (person.job) {
      assignTask(person, settlement, game);
      if (person.task.kind !== 'idle') return;
    }
    const spot = nearestLandSpot({
      x: settlement.x + (Math.random() * 2 - 1) * 3,
      y: settlement.y + (Math.random() * 2 - 1) * 3,
    }, game.terrain);
    t.tx = spot.x; t.ty = spot.y;
    t.timer = 1 + Math.random() * 3;
  }
}

function jobMatchesTask(job, taskKind) {
  if (taskKind === 'idle') return true;
  if (job === 'woodcutter') return taskKind === 'wood' || taskKind === 'plant';
  if (job === 'miner') return taskKind === 'stone' || taskKind === 'ore';
  if (job === 'farmer') return taskKind === 'grain';
  if (job === 'hunter') return taskKind === 'hunt';
  if (job === 'fisherman') return taskKind === 'fish';
  if (job === 'builder') return taskKind === 'build';
  return false;
}

export function updateTask(person, settlement, dtSec, day, bonuses, game) {
  if (!person.task || !jobMatchesTask(person.job, person.task.kind)) assignTask(person, settlement, game);
  const t = person.task;
  if (!t) return;

  if (t.kind === 'wood') {
    t.workDuration = CHOP_DURATION;
    updateGather(person, settlement, t, dtSec, day, 'wood',
      ((5 + person.stats.strength / 12) * bonuses.wood * bonuses.rail) / CYCLES_PER_DAY.wood,
      () => game.world.trees.find(x => x.id === t.treeId && x.stage === 3) || null,
      () => {
        const idx = game.world.trees.findIndex(x => x.id === t.treeId);
        if (idx !== -1) game.world.trees.splice(idx, 1);
        person.skills.woodcutting = Math.min(100, person.skills.woodcutting + 0.03);
        if (!settlement.milestones.firstTree) {
          settlement.milestones.firstTree = true;
          addEvent(game.events, day, `${person.name} срубил${person.sex === 'f' ? 'а' : ''} первое дерево поселения «${settlement.name}».`, 'milestone');
        }
      }, game);
  } else if (t.kind === 'plant') {
    updatePlant(person, settlement, t, dtSec, day, game);
  } else if (t.kind === 'stone' || t.kind === 'ore') {
    t.workDuration = MINE_DURATION;
    const yieldPerCycle = t.kind === 'stone'
      ? ((4 + person.stats.strength / 14) * bonuses.mine * bonuses.rail) / CYCLES_PER_DAY.stone
      : ((3 + person.stats.strength / 16) * bonuses.mine * bonuses.refinery) / CYCLES_PER_DAY.ore;
    updateGather(person, settlement, t, dtSec, day, t.kind, yieldPerCycle,
      () => game.world.rocks.find(x => x.id === t.rockId) || null, null, game);
  } else if (t.kind === 'grain') {
    t.workDuration = FARM_DURATION;
    updateGather(person, settlement, t, dtSec, day, 'grain',
      ((12 + person.stats.strength / 6) * bonuses.farm * bonuses.rail) / CYCLES_PER_DAY.grain,
      () => settlement.field,
      () => { person.skills.farming = Math.min(100, person.skills.farming + 0.03); }, game);
  } else if (t.kind === 'hunt') {
    updateHunt(person, settlement, t, dtSec, game, bonuses.hunt);
  } else if (t.kind === 'fish') {
    t.workDuration = FISH_DURATION;
    // Stand on the shore nearest the fish spot rather than walking into the
    // water tile itself — the net/line reaches the rest of the way.
    updateGather(person, settlement, t, dtSec, day, 'fish',
      ((10 + person.stats.strength / 10) * bonuses.tools) / CYCLES_PER_DAY.fish,
      () => {
        const spot = game.world.fishSpots.find(x => x.id === t.fishId);
        return spot ? nearestLandSpot(spot, game.terrain) : null;
      }, null, game);
  } else if (t.kind === 'build') {
    updateBuild(person, settlement, t, dtSec);
  } else if (t.kind === 'idle') {
    updateIdle(person, settlement, t, dtSec, game);
  }
}

export function updateAllTasks(game, dtSec) {
  updateAnimals(game.world, game.terrain, dtSec);
  for (const s of game.settlements) {
    const toolsBonus = 1 + Math.min(0.25, ((s.stock.tools || 0) / Math.max(1, s.peopleIds.length * 4)) * 0.25);
    const bonuses = {
      farm: (s.buildings.some(b => b.type === 'farm') ? 1.3 : 1) * toolsBonus,
      hunt: (s.buildings.some(b => b.type === 'hunterHut') ? 1.3 : 1) * toolsBonus,
      wood: (s.buildings.some(b => b.type === 'sawmill') ? 1.3 : 1) * toolsBonus,
      mine: (s.buildings.some(b => b.type === 'forge') ? 1.25 : 1) *
        (s.buildings.some(b => b.type === 'factory') ? 1.3 : 1) *
        (s.buildings.some(b => b.type === 'mine') ? 1.2 : 1) * toolsBonus,
      rail: s.buildings.some(b => b.type === 'railway') ? 1.1 : 1,
      refinery: s.buildings.some(b => b.type === 'refinery') ? 1.2 : 1,
      tools: toolsBonus,
    };
    for (const id of s.peopleIds) {
      const p = game.people.get(id);
      if (p && p.alive) updateTask(p, s, dtSec, game.day, bonuses, game);
    }
  }
}
