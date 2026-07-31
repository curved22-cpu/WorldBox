import { createGame, tickDay } from './sim.js';
import { hasSave, loadGame, saveGame, catchUp, clearSave } from './save.js';
import { setupOnboarding, setupGameUI } from './ui.js';
import { setupInput } from './input.js';
import { Camera, Renderer, TILE } from './render.js';
import { getTool } from './tools.js';
import { MS_PER_DAY_AT_X1 } from './time.js';
import { addEvent } from './events.js';
import { updateAllTasks } from './tasks.js';

const canvas = document.getElementById('game');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

let game = null, camera = null, renderer = null, ui = null, inputApi = null;
let acc = 0, last = performance.now();

function applyTool(toolId, target) {
  const tool = getTool(toolId);
  if (tool) tool.apply(game, target);
  ui.syncAll();
}

function newGame() {
  clearSave();
  location.reload();
}

function startLoop() {
  document.getElementById('game-ui').style.display = 'flex';
  camera = new Camera(canvas);
  camera.zoom = 2.2;
  const s0 = game.settlements[0];
  camera.x = s0.x * TILE; camera.y = s0.y * TILE;
  renderer = new Renderer(canvas, game.terrain);
  ui = setupGameUI(game, applyTool, newGame);
  inputApi = setupInput(canvas, camera, game, renderer, hit => ui.selectTarget(hit));
  document.getElementById('zoom-in-btn').addEventListener('click', () => inputApi.zoomBy(1.25));
  document.getElementById('zoom-out-btn').addEventListener('click', () => inputApi.zoomBy(1 / 1.25));
  last = performance.now(); acc = 0;
  setInterval(() => { if (game) saveGame(game); }, 4000);
  window.addEventListener('beforeunload', () => saveGame(game));
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(now - last, 250);
  last = now;
  if (game.speedMult > 0) {
    const simMs = dt * game.speedMult;
    updateAllTasks(game, simMs / 1000);
    acc += simMs;
    let days = 0;
    while (acc >= MS_PER_DAY_AT_X1 && days < 80) { tickDay(game, true); acc -= MS_PER_DAY_AT_X1; days++; }
  } else {
    acc = 0;
  }
  renderer.render(camera, game, null);
  ui.syncAll();
  requestAnimationFrame(loop);
}

function boot() {
  const loaded = hasSave() ? loadGame() : null;
  if (loaded) {
    game = loaded;
    const daysPassed = catchUp(game);
    if (daysPassed > 5) {
      addEvent(game.events, game.day, `Пока тебя не было, прошло примерно ${Math.round(daysPassed / 100)} лет.`, 'major');
    }
    saveGame(game);
    startLoop();
  } else {
    setupOnboarding((settlementName, f1, f2) => {
      game = createGame(Math.floor(Math.random() * 1e9), settlementName, f1, f2);
      saveGame(game);
      startLoop();
    });
  }
}

try {
  boot();
} catch (err) {
  // An incompatible or corrupted save must never leave a blank screen —
  // wipe it and start a fresh saga instead.
  console.error('Failed to resume saved game, starting fresh:', err);
  clearSave();
  try {
    setupOnboarding((settlementName, f1, f2) => {
      game = createGame(Math.floor(Math.random() * 1e9), settlementName, f1, f2);
      saveGame(game);
      startLoop();
    });
  } catch (err2) {
    console.error('Fatal error setting up onboarding:', err2);
  }
}
