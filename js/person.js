import { DAYS_PER_YEAR, ageInYears } from './time.js';

export const STAT_KEYS = ['strength', 'intelligence', 'endurance', 'charisma'];
export const STAT_LABEL = {
  strength: 'Сила', intelligence: 'Ум', endurance: 'Выносливость', charisma: 'Обаяние',
};

const MALE_NAMES = ['Иван', 'Пётр', 'Олег', 'Борис', 'Игорь', 'Степан', 'Фёдор', 'Тимофей',
  'Данила', 'Ярослав', 'Всеволод', 'Григорий', 'Захар', 'Марк', 'Роман', 'Владимир', 'Святослав'];
const FEMALE_NAMES = ['Мария', 'Анна', 'Ольга', 'Дарья', 'Светлана', 'Агафья', 'Полина', 'Варвара',
  'Ксения', 'Евдокия', 'Злата', 'Милена', 'Есения', 'Василиса', 'Марфа', 'Аглая', 'Ярослава'];

let nextPersonId = 1;
export function getNextPersonId() { return nextPersonId; }
export function setNextPersonId(n) { nextPersonId = n; }

export function randomName(sex) {
  const pool = sex === 'm' ? MALE_NAMES : FEMALE_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomStat() { return Math.round(30 + Math.random() * 40); }

export function createPerson(opts) {
  const sex = opts.sex || (Math.random() < 0.5 ? 'm' : 'f');
  const stats = opts.stats || {
    strength: randomStat(), intelligence: randomStat(), endurance: randomStat(), charisma: randomStat(),
  };
  const lifespanYears = 55 + (stats.endurance - 50) * 0.45 + (Math.random() * 20 - 10);
  const p = {
    id: nextPersonId++,
    name: opts.name || randomName(sex),
    sex,
    stats,
    skills: { woodcutting: 0, building: 0, farming: 0, research: 0, combat: 0 },
    needs: { hunger: 85, health: 100, mood: 65 },
    birthDay: opts.birthDay || 0,
    deathDay: null,
    deathCause: null,
    alive: true,
    lifespanDays: Math.max(20, Math.round(lifespanYears * DAYS_PER_YEAR)),
    parents: opts.parents || [],
    partnerId: null,
    childrenIds: [],
    pregnancy: null,
    job: null,
    settlementId: opts.settlementId ?? null,
    founder: !!opts.founder,
  };
  return p;
}

export function isAdult(person, day) { return ageInYears(day, person.birthDay) >= 16; }
export function isChild(person, day) { return ageInYears(day, person.birthDay) < 16; }

export function dailyDecay(person) {
  person.needs.hunger = Math.max(0, person.needs.hunger - 9);
}

export function applyFood(person, amount) {
  person.needs.hunger = Math.min(100, person.needs.hunger + amount);
}

export function updateHealthAndMood(person) {
  if (person.needs.hunger <= 0) {
    person.needs.health = Math.max(0, person.needs.health - 7);
  } else if (person.needs.health < 100) {
    person.needs.health = Math.min(100, person.needs.health + 1.2);
  }
  const target = 50 + (person.needs.health - 60) * 0.35 + (person.needs.hunger - 60) * 0.25;
  person.needs.mood += (target - person.needs.mood) * 0.06;
  person.needs.mood = Math.max(0, Math.min(100, person.needs.mood));
}

export function checkDeath(person, day) {
  if (!person.alive) return null;
  if (person.needs.health <= 0) {
    return 'от голода и болезней';
  }
  const ageDays = day - person.birthDay;
  if (ageDays > person.lifespanDays) {
    const overYears = (ageDays - person.lifespanDays) / DAYS_PER_YEAR;
    const chance = Math.min(0.35, overYears * 0.06);
    if (Math.random() < chance) return 'от старости';
  }
  return null;
}

export function killPerson(person, day, cause) {
  person.alive = false;
  person.deathDay = day;
  person.deathCause = cause;
  person.job = null;
}

export function mixStats(a, b) {
  const stats = {};
  for (const k of STAT_KEYS) {
    const avg = (a[k] + b[k]) / 2;
    stats[k] = Math.max(5, Math.min(95, Math.round(avg + (Math.random() * 24 - 12))));
  }
  return stats;
}
