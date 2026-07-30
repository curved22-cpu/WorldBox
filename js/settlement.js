import { ERAS, BUILDING_INFO, eraForSettlement } from './eras.js';
import {
  isAdult, dailyDecay, applyFood, updateHealthAndMood, checkDeath, killPerson, mixStats, createPerson,
} from './person.js';
import { ageInYears } from './time.js';
import { addEvent } from './events.js';

const HOUSING_TYPES = ['shack', 'hut', 'house', 'castle'];

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
    stock: { wood: 10, food: 30, stone: 0, ore: 0, knowledge: 0 },
    buildings: [],
    constructionQueue: null,
    era: 0,
    milestones: { firstTree: false },
    atWarWith: [],
  };
}

export function housingCap(settlement) {
  let cap = 2;
  for (const b of settlement.buildings) if (HOUSING_TYPES.includes(b.type)) cap += BUILDING_INFO[b.type].cap;
  return cap;
}

function planNextBuilding(settlement, livingCount) {
  if (settlement.constructionQueue) return false;
  const unlocked = [];
  for (let i = 0; i <= settlement.era; i++) unlocked.push(...ERAS[i].buildings);
  const cap = housingCap(settlement);
  let target = null;
  if (livingCount + 1 > cap) {
    const housing = unlocked.filter(t => HOUSING_TYPES.includes(t));
    target = housing[housing.length - 1];
  } else {
    const nonHousing = unlocked.filter(t => !HOUSING_TYPES.includes(t));
    target = nonHousing.find(t => !settlement.buildings.some(b => b.type === t));
  }
  if (!target) return false;
  const info = BUILDING_INFO[target];
  for (const res in info.cost) if ((settlement.stock[res] || 0) < info.cost[res]) return false;
  for (const res in info.cost) settlement.stock[res] -= info.cost[res];
  settlement.constructionQueue = { type: target, label: info.label, progress: 0, laborCost: info.laborCost };
  return true;
}

function assignJobs(settlement, adults) {
  const needWood = settlement.stock.wood < adults.length * 4;
  const needMineral = settlement.era >= 2 && settlement.stock.stone < adults.length * 3;
  const targets = [
    ['farmer', Math.max(1, Math.ceil(adults.length / 5)), 'strength'],
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
    let candidates = adults.filter(p => !p.job).sort((a, b) => b.stats[statKey] - a.stats[statKey]);
    for (const c of candidates) {
      if (have >= target) break;
      c.job = job; have++;
    }
    if (have >= target) continue;
    // no free hands left — pull someone from a lower-priority role instead
    const laterJobs = new Set(targets.slice(ti + 1).map(t => t[0]));
    candidates = adults.filter(p => laterJobs.has(p.job)).sort((a, b) => b.stats[statKey] - a.stats[statKey]);
    for (const c of candidates) {
      if (have >= target) break;
      c.job = job; have++;
    }
  }
}

export function tickSettlement(settlement, world, day) {
  const people = settlement.peopleIds.map(id => world.people.get(id)).filter(Boolean);
  const living = people.filter(p => p.alive);
  if (living.length === 0) return;
  const adults = living.filter(p => isAdult(p, day));

  assignJobs(settlement, adults);

  const farmBonus = settlement.buildings.some(b => b.type === 'farm') ? 1.3 : 1;
  const mineBonus = (settlement.buildings.some(b => b.type === 'forge') ? 1.25 : 1) *
    (settlement.buildings.some(b => b.type === 'factory') ? 1.3 : 1) *
    (settlement.buildings.some(b => b.type === 'mine') ? 1.2 : 1);
  const labBonus = settlement.buildings.some(b => b.type === 'laboratory') ? 1.4 : 1;
  const railBonus = settlement.buildings.some(b => b.type === 'railway') ? 1.1 : 1;
  const refineryBonus = settlement.buildings.some(b => b.type === 'refinery') ? 1.2 : 1;
  const hasWell = settlement.buildings.some(b => b.type === 'well');

  for (const p of adults) {
    if (p.job === 'farmer') {
      settlement.stock.food += (3 + p.stats.strength / 25) * farmBonus * railBonus;
      p.skills.farming = Math.min(100, p.skills.farming + 0.03);
    } else if (p.job === 'woodcutter') {
      settlement.stock.wood += (3 + p.stats.strength / 25) * railBonus;
      p.skills.woodcutting = Math.min(100, p.skills.woodcutting + 0.03);
      if (!settlement.milestones.firstTree) {
        settlement.milestones.firstTree = true;
        addEvent(world.events, day, `${p.name} срубил${p.sex === 'f' ? 'а' : ''} первое дерево поселения «${settlement.name}».`, 'milestone');
      }
    } else if (p.job === 'miner') {
      settlement.stock.stone += (2 + p.stats.strength / 28) * mineBonus * railBonus;
      if (settlement.era >= 5) settlement.stock.ore += (1.5 + p.stats.strength / 30) * mineBonus * refineryBonus;
    } else if (p.job === 'builder' && settlement.constructionQueue) {
      settlement.constructionQueue.progress += 1 + p.stats.strength / 20 + p.skills.building * 0.1;
      p.skills.building = Math.min(100, p.skills.building + 0.03);
    } else if (p.job === 'researcher') {
      settlement.stock.knowledge += (1 + p.stats.intelligence / 18) * labBonus;
      p.skills.research = Math.min(100, p.skills.research + 0.03);
    } else if (p.job === 'soldier') {
      p.skills.combat = Math.min(100, p.skills.combat + 0.03);
    }
  }
  if (settlement.buildings.some(b => b.type === 'market')) settlement.stock.food += 1;

  const FOOD_PER_PERSON = 5;
  const needed = living.length * FOOD_PER_PERSON;
  if (settlement.stock.food >= needed) {
    settlement.stock.food -= needed;
    for (const p of living) applyFood(p, 45);
  } else if (settlement.stock.food > 0) {
    const share = settlement.stock.food / living.length;
    settlement.stock.food = 0;
    for (const p of living) applyFood(p, share * 8);
  }
  for (const p of living) {
    dailyDecay(p);
    if (hasWell) p.needs.hunger = Math.min(100, p.needs.hunger + 1);
    updateHealthAndMood(p);
  }

  if (settlement.constructionQueue && settlement.constructionQueue.progress >= settlement.constructionQueue.laborCost) {
    const done = settlement.constructionQueue;
    settlement.buildings.push({ type: done.type, builtDay: day });
    settlement.constructionQueue = null;
    addEvent(world.events, day, `«${settlement.name}»: закончено строительство — ${done.label}.`, 'milestone');
  }
  if (!settlement.constructionQueue) {
    const started = planNextBuilding(settlement, living.length);
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
