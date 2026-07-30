import { dayToYear } from './time.js';

export function createEventLog() { return []; }

export function addEvent(log, day, text, level = 'normal') {
  log.push({ day, year: dayToYear(day), text, level });
  if (log.length > 500) log.shift();
}
