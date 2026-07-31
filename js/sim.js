import { generateTerrain, findLandSpot } from './terrain.js';
import { createPerson, killPerson, isAdult } from './person.js';
import { createSettlement, tickSettlement, livingPeople, housingCap } from './settlement.js';
import { createEventLog, addEvent } from './events.js';
import { ERAS } from './eras.js';
import { DAYS_PER_YEAR } from './time.js';
import { initSites } from './tasks.js';

export const WORLD_W = 220, WORLD_H = 140;

const SETTLEMENT_NAMES = [
  'Новоград', 'Заречье', 'Дубровка', 'Белые Пруды', 'Каменный Брод', 'Северск',
  'Речной Стан', 'Сосновка', 'Ольховка', 'Гранитово', 'Туманный Дол', 'Ясная Поляна',
  'Светлый Яр', 'Волчий Лог', 'Тихая Заводь', 'Медное Устье',
];
let nameIdx = 0;
export function getNameIdx() { return nameIdx; }
export function setNameIdx(n) { nameIdx = n; }
function nextSettlementName() {
  const name = SETTLEMENT_NAMES[nameIdx % SETTLEMENT_NAMES.length];
  nameIdx++;
  return nameIdx > SETTLEMENT_NAMES.length ? `${name} (${Math.ceil(nameIdx / SETTLEMENT_NAMES.length)})` : name;
}

export function createGame(seed, settlementName, founder1, founder2) {
  const terrain = generateTerrain(WORLD_W, WORLD_H, seed);
  const spot = findLandSpot(terrain, null);
  const game = {
    day: 0, seed, terrain,
    people: new Map(),
    settlements: [],
    events: createEventLog(),
    liveWithoutMe: true,
    lastSavedRealMs: Date.now(),
    speedMult: 1,
    selected: null,
  };
  const settlement = createSettlement({ name: settlementName || 'Первое поселение', x: spot.x, y: spot.y, foundedDay: 0 });
  initSites(settlement, terrain);
  const pos = { x: spot.x, y: spot.y };
  const p1 = createPerson({
    name: founder1.name, sex: founder1.sex, stats: founder1.stats,
    birthDay: -Math.round((founder1.age ?? 20) * DAYS_PER_YEAR),
    settlementId: settlement.id, founder: true, pos,
  });
  const p2 = createPerson({
    name: founder2.name, sex: founder2.sex, stats: founder2.stats,
    birthDay: -Math.round((founder2.age ?? 20) * DAYS_PER_YEAR),
    settlementId: settlement.id, founder: true, pos,
  });
  p1.partnerId = p2.id; p2.partnerId = p1.id;
  game.people.set(p1.id, p1);
  game.people.set(p2.id, p2);
  settlement.peopleIds.push(p1.id, p2.id);
  game.settlements.push(settlement);
  addEvent(game.events, 0, `${p1.name} и ${p2.name} приходят на новые земли и решают обосноваться здесь.`, 'major');
  return game;
}

function battleStrength(settlement, game) {
  const soldiers = livingPeople(settlement, game).filter(p => p.job === 'soldier');
  const eraInfo = ERAS[settlement.era];
  const power = eraInfo.military ? eraInfo.military.power : 1;
  return soldiers.reduce((sum, p) => sum + (1 + p.skills.combat / 40 + p.stats.strength / 80), 0.4) * power;
}

function resolveBattle(game, a, b, day) {
  const sa = battleStrength(a, game), sb = battleStrength(b, game);
  const aWins = Math.random() < sa / (sa + sb);
  const winner = aWins ? a : b, loser = aWins ? b : a;
  const loserSoldiers = livingPeople(loser, game).filter(p => p.job === 'soldier');
  const pool = loserSoldiers.length ? loserSoldiers : livingPeople(loser, game);
  const casualties = Math.min(pool.length, Math.max(1, Math.round(pool.length * (0.15 + Math.random() * 0.35))));
  for (let k = 0; k < casualties; k++) {
    const victim = pool[k];
    if (victim && victim.alive) killPerson(victim, day, 'в бою');
  }
  const eraInfo = ERAS[winner.era];
  const unit = eraInfo.military ? eraInfo.military.unit : 'ополченцы';
  addEvent(game.events, day,
    `Битва между «${a.name}» и «${b.name}»: победила «${winner.name}» (в бою участвовали: ${unit}). Потери проигравшей стороны: ${casualties}.`,
    'major');
  if (Math.random() < 0.3) {
    a.atWarWith = a.atWarWith.filter(id => id !== b.id);
    b.atWarWith = b.atWarWith.filter(id => id !== a.id);
    addEvent(game.events, day, `«${a.name}» и «${b.name}» заключают мир.`, 'normal');
  }
}

function tickWars(game, day) {
  const eligible = game.settlements.filter(s => s.era >= 3 && livingPeople(s, game).length > 0);
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i], b = eligible[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 90) continue;
      const atWar = a.atWarWith.includes(b.id);
      if (!atWar && Math.random() < 0.0006) {
        a.atWarWith.push(b.id); b.atWarWith.push(a.id);
        addEvent(game.events, day, `«${a.name}» объявляет войну «${b.name}»!`, 'major');
      } else if (atWar && Math.random() < 0.02) {
        resolveBattle(game, a, b, day);
      }
    }
  }
}

function maybeColonize(game, settlement, day) {
  const living = livingPeople(settlement, game);
  const cap = housingCap(settlement);
  if (living.length < cap + 6) return;
  if (Math.random() > 0.015) return;
  const adults = living.filter(p => isAdult(p, day));
  if (adults.length < 5) return;
  const shuffled = [...adults].sort(() => Math.random() - 0.5);
  const group = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));
  const spot = findLandSpot(game.terrain, { x: settlement.x, y: settlement.y });
  const newSettlement = createSettlement({ name: nextSettlementName(), x: spot.x, y: spot.y, foundedDay: day });
  initSites(newSettlement, game.terrain);
  for (const p of group) {
    settlement.peopleIds = settlement.peopleIds.filter(id => id !== p.id);
    newSettlement.peopleIds.push(p.id);
    p.settlementId = newSettlement.id;
    p.pos = { x: spot.x, y: spot.y };
    p.task = null;
  }
  newSettlement.stock.food = 15;
  game.settlements.push(newSettlement);
  addEvent(game.events, day,
    `Группа переселенцев (${group.map(p => p.name).join(', ')}) покидает «${settlement.name}» и основывает новое поселение «${newSettlement.name}».`,
    'major');
}

export function tickDay(game, liveMode = false) {
  for (const s of game.settlements) tickSettlement(s, game, game.day, liveMode);
  tickWars(game, game.day);
  for (const s of [...game.settlements]) maybeColonize(game, s, game.day);
  if (game.day % 20 === 0) {
    game.settlements = game.settlements.filter(s => livingPeople(s, game).length > 0);
  }
  game.day++;
}

export function allLivingPeople(game) {
  return [...game.people.values()].filter(p => p.alive);
}
