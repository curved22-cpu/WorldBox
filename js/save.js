import { generateTerrain } from './terrain.js';
import { getNextPersonId, setNextPersonId } from './person.js';
import { getNextSettlementId, setNextSettlementId } from './settlement.js';
import { tickDay, WORLD_W, WORLD_H, getNameIdx, setNameIdx } from './sim.js';
import { MS_PER_DAY_AT_X1, MAX_CATCHUP_DAYS } from './time.js';

const SAVE_KEY = 'worldbox_saga_save_v1';

export function serializeGame(game) {
  return {
    day: game.day,
    seed: game.seed,
    liveWithoutMe: game.liveWithoutMe,
    speedMult: game.speedMult,
    lastSavedRealMs: Date.now(),
    people: [...game.people.values()],
    settlements: game.settlements,
    events: game.events,
    nextPersonId: getNextPersonId(),
    nextSettlementId: getNextSettlementId(),
    nameIdx: getNameIdx(),
  };
}

export function saveGame(game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeGame(game)));
  } catch { /* storage unavailable or full — progress just won't persist */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return null; }
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  const terrain = generateTerrain(WORLD_W, WORLD_H, data.seed);
  setNextPersonId(data.nextPersonId || 1);
  setNextSettlementId(data.nextSettlementId || 1);
  setNameIdx(data.nameIdx || 0);
  const people = new Map(data.people.map(p => [p.id, p]));
  return {
    day: data.day, seed: data.seed, terrain,
    people, settlements: data.settlements, events: data.events,
    liveWithoutMe: data.liveWithoutMe !== false,
    lastSavedRealMs: data.lastSavedRealMs,
    speedMult: data.speedMult || 1,
    selected: null,
  };
}

export function catchUp(game) {
  if (!game.liveWithoutMe) { game.lastSavedRealMs = Date.now(); return 0; }
  const elapsedMs = Date.now() - game.lastSavedRealMs;
  if (elapsedMs <= 0) return 0;
  let days = Math.floor(elapsedMs / MS_PER_DAY_AT_X1);
  days = Math.min(days, MAX_CATCHUP_DAYS);
  for (let i = 0; i < days; i++) tickDay(game);
  game.lastSavedRealMs = Date.now();
  return days;
}
