export const DAYS_PER_YEAR = 100;
export const REAL_MS_PER_GAME_YEAR = 60 * 60 * 1000; // 1 real hour = 1 game year at x1
export const MS_PER_DAY_AT_X1 = REAL_MS_PER_GAME_YEAR / DAYS_PER_YEAR;
export const MAX_CATCHUP_DAYS = 20000; // cap offline simulation to ~200 game years per resume

export function dayToYear(day) { return Math.floor(day / DAYS_PER_YEAR); }
export function ageInYears(day, birthDay) { return (day - birthDay) / DAYS_PER_YEAR; }

export function formatYear(day) {
  return `год ${dayToYear(day)}`;
}

export const SPEEDS = [
  { label: 'II', mult: 0 },   // paused
  { label: '×1', mult: 1 },
  { label: '×5', mult: 5 },
  { label: '×20', mult: 20 },
  { label: '×100', mult: 100 },
];
