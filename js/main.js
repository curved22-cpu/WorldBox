import { World, isLand } from './world.js';
import { Camera, Renderer, TILE } from './render.js';
import { updateEntities, spawnEntity } from './entities.js';
import { setupUI } from './ui.js';
import { setupInput } from './input.js';
import { getTool } from './tools.js';

const WORLD_W = 180, WORLD_H = 110;
const BASE_TICK_MS = 1000 / 8;

const canvas = document.getElementById('game');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const world = new World(WORLD_W, WORLD_H, Date.now() % 1e9);
const camera = new Camera(canvas);
camera.zoom = Math.min(canvas.width / (WORLD_W * TILE), canvas.height / (WORLD_H * TILE)) * 0.95;
camera.zoom = Math.max(0.3, Math.min(4, camera.zoom));
camera.x = WORLD_W * TILE / 2;
camera.y = WORLD_H * TILE / 2;

const renderer = new Renderer(canvas, world);

const state = { toolId: 'raise', brushRadius: 1, paused: false, speed: 1, hover: null };

function randomLandSpot() {
  for (let tries = 0; tries < 400; tries++) {
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    if (isLand(world.biome[world.idx(x, y)])) return { x, y };
  }
  return { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

function seedCluster(type, count, center, spread) {
  let placed = 0, attempts = 0;
  while (placed < count && attempts < count * 40) {
    attempts++;
    const x = Math.round(center.x + (Math.random() * 2 - 1) * spread);
    const y = Math.round(center.y + (Math.random() * 2 - 1) * spread);
    if (world.inBounds(x, y) && isLand(world.biome[world.idx(x, y)])) {
      if (spawnEntity(world, type, x, y, { energy: 0.9, age: Math.floor(Math.random() * 200) })) placed++;
    }
  }
}

function seedScattered(type, count) {
  let placed = 0, attempts = 0;
  while (placed < count && attempts < count * 30) {
    attempts++;
    const { x, y } = randomLandSpot();
    if (spawnEntity(world, type, x, y, { energy: 0.9, age: Math.floor(Math.random() * 200) })) placed++;
  }
}

function seedPopulation() {
  for (const race of ['human', 'elf', 'orc']) {
    seedCluster(race, 14, randomLandSpot(), 5);
  }
  seedScattered('sheep', 26);
  seedScattered('rabbit', 26);
  seedScattered('cow', 10);
  seedScattered('wolf', 6);
  seedScattered('bear', 5);
}
seedPopulation();

const ui = setupUI(state, world);
setupInput(canvas, camera, world, state, ui);

let last = performance.now();
let acc = 0;

function loop(now) {
  const dt = Math.min(now - last, 200);
  last = now;
  if (!state.paused) {
    const interval = BASE_TICK_MS / state.speed;
    acc += dt;
    let steps = 0;
    while (acc >= interval && steps < 12) {
      world.step();
      updateEntities(world);
      acc -= interval;
      steps++;
    }
  } else {
    acc = 0;
  }

  let hover = null;
  if (state.hover && world.inBounds(state.hover.x, state.hover.y)) {
    const tool = getTool(state.toolId);
    hover = { x: state.hover.x, y: state.hover.y, radius: tool && tool.brush ? state.brushRadius : 0.3 };
  }
  renderer.render(camera, hover);
  ui.syncStats();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
