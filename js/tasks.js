import { Biome } from './terrain.js';
import { addEvent } from './events.js';

export const WALK_SPEED = 2.4; // tiles per sim-second
const CHOP_DURATION = 2.5;
const MINE_DURATION = 3;
const FARM_DURATION = 3;
const BUILD_DURATION = 2.5;
const PICKUP_PAUSE = 0.6;
const DROP_PAUSE = 0.5;

// Rough cycles/day a worker completes given the travel distances used below —
// gather/build yields are derived from the old per-day formulas divided by
// these, so watching it happen live gives roughly the same totals as the
// fast offline catch-up simulation.
const CYCLES_PER_DAY = { wood: 3.2, stone: 2.75, ore: 2.75, food: 5.6, build: 6.0 };

export function initSites(settlement, terrain) {
  settlement.trees = [];
  for (let i = 0; i < 22; i++) {
    const spot = scatterSpot(settlement, terrain, 4, 16, [Biome.FOREST, Biome.GRASS]);
    settlement.trees.push({ id: i, x: spot.x, y: spot.y, alive: true, regrowDay: 0 });
  }
  settlement.rocks = [];
  for (let i = 0; i < 10; i++) {
    const spot = scatterSpot(settlement, terrain, 5, 18, [Biome.ROCK, Biome.SAND, Biome.GRASS]);
    settlement.rocks.push({ id: i, x: spot.x, y: spot.y });
  }
  const ang = Math.random() * Math.PI * 2;
  settlement.field = { x: settlement.x + Math.cos(ang) * 3.5, y: settlement.y + Math.sin(ang) * 3.5 };
}

function scatterSpot(settlement, terrain, minR, maxR, preferredBiomes) {
  for (let tries = 0; tries < 20; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.round(settlement.x + Math.cos(a) * r);
    const y = Math.round(settlement.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= terrain.width - 1 || y >= terrain.height - 1) continue;
    if (preferredBiomes.includes(terrain.biome[terrain.idx(x, y)])) return { x, y };
  }
  const a = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  return { x: settlement.x + Math.cos(a) * r, y: settlement.y + Math.sin(a) * r };
}

export function nextBuildingSlot(settlement, index) {
  const ang = index * 2.4 + 0.6;
  const ring = Math.floor(index / 6);
  const r = 2.2 + ring * 1.7;
  return { x: settlement.x + Math.cos(ang) * r, y: settlement.y + Math.sin(ang) * r };
}

export function regrowTrees(settlement, day) {
  for (const t of settlement.trees) {
    if (!t.alive && day >= t.regrowDay) t.alive = true;
  }
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

function nearestTree(settlement, from) {
  let best = null, bestD = Infinity;
  for (const t of settlement.trees) {
    if (!t.alive) continue;
    const d = (t.x - from.x) ** 2 + (t.y - from.y) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function nearestRock(settlement, from) {
  let best = null, bestD = Infinity;
  for (const r of settlement.rocks) {
    const d = (r.x - from.x) ** 2 + (r.y - from.y) ** 2;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

function assignTask(person, settlement) {
  const job = person.job;
  if (job === 'woodcutter') {
    const tree = nearestTree(settlement, person.pos);
    person.task = tree ? { kind: 'wood', phase: 'toSite', treeId: tree.id, timer: 0, carrying: 0 } : null;
  } else if (job === 'miner') {
    const rock = nearestRock(settlement, person.pos);
    const wantOre = settlement.era >= 5 && Math.random() < 0.4;
    person.task = rock ? { kind: wantOre ? 'ore' : 'stone', phase: 'toSite', rockId: rock.id, timer: 0, carrying: 0 } : null;
  } else if (job === 'farmer') {
    person.task = { kind: 'food', phase: 'toSite', timer: 0, carrying: 0 };
  } else if (job === 'builder') {
    person.task = settlement.constructionQueue ? { kind: 'build', phase: 'toStorage', timer: 0, carrying: 0 } : null;
  } else {
    const ang = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 3;
    person.task = {
      kind: 'idle', phase: 'wander',
      tx: settlement.x + Math.cos(ang) * r, ty: settlement.y + Math.sin(ang) * r,
      timer: 1 + Math.random() * 3,
    };
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

function updateIdle(person, settlement, t, dtSec) {
  t.timer -= dtSec;
  const arrived = moveToward(person, t.tx, t.ty, dtSec);
  if (arrived || t.timer <= 0) {
    const ang = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 3;
    t.tx = settlement.x + Math.cos(ang) * r;
    t.ty = settlement.y + Math.sin(ang) * r;
    t.timer = 1 + Math.random() * 3;
  }
}

function jobMatchesTask(job, taskKind) {
  if (job === 'woodcutter') return taskKind === 'wood';
  if (job === 'miner') return taskKind === 'stone' || taskKind === 'ore';
  if (job === 'farmer') return taskKind === 'food';
  if (job === 'builder') return taskKind === 'build';
  return taskKind === 'idle';
}

export function updateTask(person, settlement, dtSec, day, bonuses, game) {
  if (!person.task || !jobMatchesTask(person.job, person.task.kind)) assignTask(person, settlement);
  const t = person.task;
  if (!t) return;

  if (t.kind === 'wood') {
    t.workDuration = CHOP_DURATION;
    updateGather(person, settlement, t, dtSec, day, 'wood',
      ((5 + person.stats.strength / 12) * bonuses.rail) / CYCLES_PER_DAY.wood,
      () => settlement.trees.find(x => x.id === t.treeId && x.alive) || null,
      () => {
        const tree = settlement.trees.find(x => x.id === t.treeId);
        if (tree) { tree.alive = false; tree.regrowDay = day + 10 + Math.floor(Math.random() * 10); }
        person.skills.woodcutting = Math.min(100, person.skills.woodcutting + 0.03);
        if (!settlement.milestones.firstTree) {
          settlement.milestones.firstTree = true;
          addEvent(game.events, day, `${person.name} срубил${person.sex === 'f' ? 'а' : ''} первое дерево поселения «${settlement.name}».`, 'milestone');
        }
      }, game);
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
    updateIdle(person, settlement, t, dtSec);
  }
}

export function updateAllTasks(game, dtSec) {
  for (const s of game.settlements) {
    const bonuses = {
      farm: s.buildings.some(b => b.type === 'farm') ? 1.3 : 1,
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
