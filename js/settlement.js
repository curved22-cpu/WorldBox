import { ERAS, BUILDING_INFO, eraForSettlement, HOUSING_TYPES } from './eras.js';
import {
  isAdult, dailyDecay, applyFood, updateHealthAndMood, checkDeath, killPerson, mixStats, createPerson,
} from './person.js';
import { ageInYears } from './time.js';
import { addEvent } from './events.js';
import { nextBuildingSlot, nearestLandSpot } from './tasks.js';
import { isCoastal } from './resources.js';

let nextSettlementId = 1;
export function getNextSettlementId() { return nextSettlementId; }
export function setNextSettlementId(n) { nextSettlementId = n; }

export function createSettlement(opts) {
  return {
    id: nextSettlementId++,
    name: opts.name,
    x: opts.x, y: opts.y,
    foundedDay: opts.foundedDay,
    peopleIds: [],
    stock: {
      wood: 10, stone: 0, ore: 0, knowledge: 0,
      grain: 20, flour: 0, bread: 10, meat: 0, fish: 0,
      tools: 0, clothes: 0,
    },
    buildings: [],
    constructionQueue: null,
    era: 0,
    milestones: { firstTree: false },
    atWarWith: [],
    field: null,
  };
}

export function housingCap(settlement) {
  let cap = 2;
  for (const b of settlement.buildings) if (HOUSING_TYPES.includes(b.type)) cap += BUILDING_INFO[b.type].cap;
  return cap;
}

function assignHousing(settlement, living) {
  const housingIdx = [];
  for (let i = 0; i < settlement.buildings.length; i++) {
    const b = settlement.buildings[i];
    if (HOUSING_TYPES.includes(b.type)) { b.residents.length = 0; housingIdx.push(i); }
  }
  for (const p of living) {
    if (p.homeIndex != null && housingIdx.includes(p.homeIndex)) {
      const b = settlement.buildings[p.homeIndex];
      if (b.residents.length < BUILDING_INFO[b.type].cap) { b.residents.push(p.id); continue; }
    }
    p.homeIndex = null;
  }
  for (const p of living) {
    if (p.homeIndex != null) continue;
    for (const i of housingIdx) {
      const b = settlement.buildings[i];
      if (b.residents.length < BUILDING_INFO[b.type].cap) { b.residents.push(p.id); p.homeIndex = i; break; }
    }
  }
}

function planNextBuilding(settlement, livingCount, terrain) {
  if (settlement.constructionQueue) return false;
  const unlocked = [];
  for (let i = 0; i <= settlement.era; i++) unlocked.push(...ERAS[i].buildings);
  const cap = housingCap(settlement);
  const coastal = isCoastal(terrain, settlement.x, settlement.y);
  let target = null;
  if (livingCount + 1 > cap) {
    const housing = unlocked.filter(t => HOUSING_TYPES.includes(t));
    target = housing[housing.length - 1];
  } else {
    const nonHousing = unlocked.filter(t => !HOUSING_TYPES.includes(t) && (t !== 'dock' || coastal));
    target = nonHousing.find(t => !settlement.buildings.some(b => b.type === t));
  }
  if (!target) return false;
  const info = BUILDING_INFO[target];
  for (const res in info.cost) if ((settlement.stock[res] || 0) < info.cost[res]) return false;
  for (const res in info.cost) settlement.stock[res] -= info.cost[res];
  const pos = nearestLandSpot(nextBuildingSlot(settlement, settlement.buildings.length), terrain);
  settlement.constructionQueue = { type: target, label: info.label, progress: 0, laborCost: info.laborCost, pos };
  return true;
}

function assignJobs(settlement, adults) {
  const needWood = settlement.stock.wood < adults.length * 4;
  const needMineral = settlement.era >= 2 && settlement.stock.stone < adults.length * 3;
  const hasHunterHut = settlement.buildings.some(b => b.type === 'hunterHut');
  const hasDock = settlement.buildings.some(b => b.type === 'dock');
  const targets = [
    ['farmer', Math.max(1, Math.ceil(adults.length / 5)), 'strength'],
    ['hunter', hasHunterHut ? Math.max(1, Math.ceil(adults.length / 7)) : 0, 'strength'],
    ['fisherman', hasDock ? Math.max(1, Math.ceil(adults.length / 7)) : 0, 'strength'],
    ['builder', settlement.constructionQueue ? Math.min(3, Math.max(1, Math.ceil(adults.length / 6))) : 0, 'strength'],
    ['woodcutter', needWood ? Math.max(1, Math.ceil(adults.length / 8)) : 0, 'strength'],
    ['miner', needMineral ? Math.max(1, Math.ceil(adults.length / 9)) : 0, 'strength'],
    ['researcher', adults.length >= 2 ? Math.min(3, Math.floor(adults.length / 6) + 1) : 0, 'intelligence'],
    ['soldier', settlement.era >= 3 ? Math.min(Math.floor(adults.length / 4), settlement.atWarWith.length ? 6 : 1) : 0, 'strength'],
  ];
  const validJobs = new Set(targets.filter(t => t[1] > 0).map(t => t[0]));
  for (const p of adults) if (p.job && !validJobs.has(p.job)) p.job = null;
  for (let ti = 0; ti < targets.length; ti++) {
    const [job, target, statKey] = targets[ti];
    let have = adults.filter(p => p.job === job).length;
    if (have >= target) continue;
    // Prefer whoever's already practiced this trade, then raw aptitude —
    // keeps people from thrashing between jobs they have no skill in.
    const skillKey = { farmer: 'farming', woodcutter: 'woodcutting', builder: 'building', researcher: 'research', soldier: 'combat' }[job];
    const score = p => p.stats[statKey] + (skillKey ? (p.skills[skillKey] || 0) * 1.5 : 0);
    let candidates = adults.filter(p => !p.job).sort((a, b) => score(b) - score(a));
    for (const c of candidates) {
      if (have >= target) break;
      c.job = job; have++;
    }
    if (have >= target) continue;
    // no free hands left — pull someone from a lower-priority role instead
    const laterJobs = new Set(targets.slice(ti + 1).map(t => t[0]));
    candidates = adults.filter(p => laterJobs.has(p.job)).sort((a, b) => score(b) - score(a));
    for (const c of candidates) {
      if (have >= target) break;
      c.job = job; have++;
    }
  }
}

export function tickSettlement(settlement, world, day, liveMode) {
  const people = settlement.peopleIds.map(id => world.people.get(id)).filter(Boolean);
  const living = people.filter(p => p.alive);
  if (living.length === 0) return;
  const adults = living.filter(p => isAdult(p, day));

  assignJobs(settlement, adults);
  assignHousing(settlement, living);

  const farmBonus = settlement.buildings.some(b => b.type === 'farm') ? 1.3 : 1;
  const huntBonus = settlement.buildings.some(b => b.type === 'hunterHut') ? 1.3 : 1;
  const woodBonus = settlement.buildings.some(b => b.type === 'sawmill') ? 1.3 : 1;
  const mineBonus = (settlement.buildings.some(b => b.type === 'forge') ? 1.25 : 1) *
    (settlement.buildings.some(b => b.type === 'factory') ? 1.3 : 1) *
    (settlement.buildings.some(b => b.type === 'mine') ? 1.2 : 1);
  const labBonus = (settlement.buildings.some(b => b.type === 'laboratory') ? 1.4 : 1) *
    (settlement.buildings.some(b => b.type === 'library') ? 1.3 : 1) *
    (settlement.buildings.some(b => b.type === 'school') ? 1.3 : 1);
  const railBonus = settlement.buildings.some(b => b.type === 'railway') ? 1.1 : 1;
  const refineryBonus = settlement.buildings.some(b => b.type === 'refinery') ? 1.2 : 1;
  const hasWell = settlement.buildings.some(b => b.type === 'well');
  const hasGranary = settlement.buildings.some(b => b.type === 'granary');
  const hasChurch = settlement.buildings.some(b => b.type === 'church');
  const hasMill = settlement.buildings.some(b => b.type === 'mill');
  const hasBakery = settlement.buildings.some(b => b.type === 'bakery');
  const hasWorkshop = settlement.buildings.some(b => b.type === 'workshop');

  // Tools/clothes are settlement-wide crafted goods rather than per-person
  // equipment slots: enough tools per capita speeds up physical work, enough
  // clothes per capita keeps people healthier.
  const toolsBonus = 1 + Math.min(0.25, (settlement.stock.tools / Math.max(1, living.length * 4)) * 0.25);
  const clothesCoverage = Math.min(1, settlement.stock.clothes / Math.max(1, living.length * 3));

  // In live mode, farmer/woodcutter/miner/builder/hunter/fisherman output instead
  // comes from the continuous walk-work-carry task loop (tasks.js) so it can be
  // watched happening. During offline catch-up there's nothing to watch, so
  // these formulas stand in for a whole day of that same work at once.
  for (const p of adults) {
    if (p.job === 'farmer' && !liveMode) {
      settlement.stock.grain += (12 + p.stats.strength / 6) * farmBonus * railBonus * toolsBonus;
      p.skills.farming = Math.min(100, p.skills.farming + 0.03);
    } else if (p.job === 'hunter' && !liveMode) {
      settlement.stock.meat += (9 + p.stats.strength / 10) * huntBonus * toolsBonus;
      p.skills.combat = Math.min(100, p.skills.combat + 0.02);
    } else if (p.job === 'fisherman' && !liveMode) {
      settlement.stock.fish += (8 + p.stats.strength / 10) * toolsBonus;
    } else if (p.job === 'woodcutter' && !liveMode) {
      settlement.stock.wood += (5 + p.stats.strength / 12) * woodBonus * railBonus * toolsBonus;
      p.skills.woodcutting = Math.min(100, p.skills.woodcutting + 0.03);
      if (!settlement.milestones.firstTree) {
        settlement.milestones.firstTree = true;
        addEvent(world.events, day, `${p.name} срубил${p.sex === 'f' ? 'а' : ''} первое дерево поселения «${settlement.name}».`, 'milestone');
      }
    } else if (p.job === 'miner' && !liveMode) {
      settlement.stock.stone += (4 + p.stats.strength / 14) * mineBonus * railBonus * toolsBonus;
      if (settlement.era >= 5) settlement.stock.ore += (3 + p.stats.strength / 16) * mineBonus * refineryBonus * toolsBonus;
    } else if (p.job === 'builder' && settlement.constructionQueue && !liveMode) {
      settlement.constructionQueue.progress += 1 + p.stats.strength / 20 + p.skills.building * 0.1;
      p.skills.building = Math.min(100, p.skills.building + 0.03);
    } else if (p.job === 'researcher') {
      settlement.stock.knowledge += (1 + p.stats.intelligence / 18) * labBonus;
      p.skills.research = Math.min(100, p.skills.research + 0.03);
    } else if (p.job === 'soldier') {
      p.skills.combat = Math.min(100, p.skills.combat + 0.03);
    }
  }
  if (settlement.buildings.some(b => b.type === 'market')) settlement.stock.bread += 1;

  // Production chain: grain -> flour (mill) -> bread (bakery).
  if (hasMill) {
    const conv = Math.min(settlement.stock.grain, 8 + living.length * 0.6);
    settlement.stock.grain -= conv;
    settlement.stock.flour += conv * 0.9;
  }
  if (hasBakery) {
    const conv = Math.min(settlement.stock.flour, 8 + living.length * 0.6);
    settlement.stock.flour -= conv;
    settlement.stock.bread += conv * 0.95;
  }
  // Crafting chain: wood+stone -> tools, wood+meat(hides) -> clothes.
  if (hasWorkshop) {
    const craftCap = 2 + living.length * 0.15;
    const toolUnits = Math.max(0, Math.min(craftCap, settlement.stock.wood / 2, settlement.stock.stone / 1.5));
    if (toolUnits > 0) {
      settlement.stock.wood -= toolUnits * 2;
      settlement.stock.stone -= toolUnits * 1.5;
      settlement.stock.tools += toolUnits;
    }
    const clothUnits = Math.max(0, Math.min(craftCap, settlement.stock.wood, settlement.stock.meat / 3));
    if (clothUnits > 0) {
      settlement.stock.wood -= clothUnits;
      settlement.stock.meat -= clothUnits * 3;
      settlement.stock.clothes += clothUnits;
    }
  }

  const FOOD_PER_PERSON = hasGranary ? 4 : 5;
  const totalNeeded = living.length * FOOD_PER_PERSON;
  let remaining = totalNeeded;
  let fed = 0, typesUsed = 0;
  const consume = (key, valuePerUnit) => {
    if (remaining <= 0.001) return;
    const have = settlement.stock[key] || 0;
    const wantUnits = remaining / valuePerUnit;
    const use = Math.min(have, wantUnits);
    if (use > 0.001) {
      settlement.stock[key] = have - use;
      remaining -= use * valuePerUnit;
      fed += use * valuePerUnit;
      typesUsed++;
    }
  };
  consume('bread', 1);
  consume('meat', 1);
  consume('fish', 1);
  consume('flour', 0.85);
  consume('grain', 0.6);
  const fedRatio = totalNeeded > 0 ? Math.min(1, fed / totalNeeded) : 1;
  for (const p of living) applyFood(p, 45 * fedRatio);
  if (typesUsed >= 2) for (const p of living) p.needs.mood = Math.min(100, p.needs.mood + 0.5);

  for (const p of living) {
    dailyDecay(p);
    if (hasWell) p.needs.hunger = Math.min(100, p.needs.hunger + 1);
    updateHealthAndMood(p);
    if (hasChurch) p.needs.mood = Math.min(100, p.needs.mood + 1.5);
    if (clothesCoverage > 0) p.needs.health = Math.min(100, p.needs.health + clothesCoverage * 0.5);
  }

  if (settlement.constructionQueue && settlement.constructionQueue.progress >= settlement.constructionQueue.laborCost) {
    const done = settlement.constructionQueue;
    const newBuilding = { type: done.type, builtDay: day, x: done.pos.x, y: done.pos.y };
    if (HOUSING_TYPES.includes(done.type)) newBuilding.residents = [];
    settlement.buildings.push(newBuilding);
    settlement.constructionQueue = null;
    addEvent(world.events, day, `«${settlement.name}»: закончено строительство — ${done.label}.`, 'milestone');
  }
  if (!settlement.constructionQueue) {
    const started = planNextBuilding(settlement, living.length, world.terrain);
    if (started) {
      addEvent(world.events, day, `«${settlement.name}»: заложена стройка — ${settlement.constructionQueue.label}.`, 'normal');
    }
  }

  const newEra = eraForSettlement(settlement.stock.knowledge, living.length);
  if (newEra > settlement.era) {
    settlement.era = newEra;
    addEvent(world.events, day, `Поселение «${settlement.name}» вступает в ${ERAS[newEra].name.toLowerCase()}!`, 'major');
  }

  for (const p of living) {
    const cause = checkDeath(p, day);
    if (cause) {
      killPerson(p, day, cause);
      addEvent(world.events, day,
        `${p.name} умер${p.sex === 'f' ? 'ла' : ''} ${cause} в возрасте ${Math.floor(ageInYears(day, p.birthDay))} лет.`,
        p.founder ? 'major' : 'normal');
      if (p.partnerId) {
        const partner = world.people.get(p.partnerId);
        if (partner) { partner.partnerId = null; partner.needs.mood = Math.max(0, partner.needs.mood - 25); }
      }
    }
  }

  const stillLiving = living.filter(p => p.alive);
  for (const p of stillLiving) {
    if (p.sex === 'f' && p.pregnancy && day >= p.pregnancy.dueDay) {
      const father = world.people.get(p.pregnancy.fatherId);
      const child = createPerson({
        birthDay: day, settlementId: settlement.id,
        parents: [p.id, father ? father.id : null],
        stats: father ? mixStats(p.stats, father.stats) : p.stats,
        pos: { x: settlement.x, y: settlement.y },
      });
      world.people.set(child.id, child);
      settlement.peopleIds.push(child.id);
      p.childrenIds.push(child.id);
      if (father) father.childrenIds.push(child.id);
      p.pregnancy = null;
      p.needs.mood = Math.min(100, p.needs.mood + 15);
      addEvent(world.events, day,
        `В «${settlement.name}» родил${child.sex === 'm' ? 'ся' : 'ась'} ${child.sex === 'm' ? 'мальчик' : 'девочка'} — ${child.name}.`,
        'milestone');
    }
  }

  const singles = stillLiving.filter(p => isAdult(p, day) && !p.partnerId && p.needs.health > 30);
  for (const p of singles) {
    if (p.partnerId) continue;
    const candidate = singles.find(o => o !== p && !o.partnerId && o.sex !== p.sex);
    if (candidate && Math.random() < 0.01) {
      p.partnerId = candidate.id; candidate.partnerId = p.id;
      addEvent(world.events, day, `${p.name} и ${candidate.name} стали парой в «${settlement.name}».`, 'normal');
    }
  }
  for (const p of stillLiving) {
    if (p.sex === 'f' && p.partnerId && !p.pregnancy && isAdult(p, day) && p.needs.health > 45 && p.needs.mood > 35) {
      const chance = 0.006 * (p.stats.charisma / 60);
      if (Math.random() < chance) p.pregnancy = { dueDay: day + 35, fatherId: p.partnerId };
    }
  }
}

export function livingPeople(settlement, world) {
  return settlement.peopleIds.map(id => world.people.get(id)).filter(p => p && p.alive);
}
