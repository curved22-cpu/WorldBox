import { spawnEntity } from './entities.js';

export const TOOLS = [
  {
    id: 'raise', name: 'Поднять землю', icon: '⛰️', group: 'terrain',
    brush: true, radius: 2, continuous: true,
    apply(world, x, y, r) { world.terraform(x, y, r, 0.10); },
  },
  {
    id: 'lower', name: 'Опустить землю', icon: '🕳️', group: 'terrain',
    brush: true, radius: 2, continuous: true,
    apply(world, x, y, r) { world.terraform(x, y, r, -0.10); },
  },
  {
    id: 'water', name: 'Вода', icon: '💧', group: 'terrain',
    brush: true, radius: 2, continuous: true,
    apply(world, x, y, r) { world.addWater(x, y, r); },
  },
  {
    id: 'tree', name: 'Дерево', icon: '🌳', group: 'life',
    brush: true, radius: 1, continuous: true,
    apply(world, x, y, r) {
      world.forEachInRadius(x, y, r, (tx, ty) => {
        if (Math.random() < 0.5) world.plantTree(tx, ty);
      });
    },
  },
  {
    id: 'human', name: 'Человек', icon: '🧍', group: 'life',
    brush: false, continuous: true, cooldownMs: 140,
    apply(world, x, y) { spawnEntity(world, 'human', x, y, { energy: 0.9 }); },
  },
  {
    id: 'sheep', name: 'Овца', icon: '🐑', group: 'life',
    brush: false, continuous: true, cooldownMs: 140,
    apply(world, x, y) { spawnEntity(world, 'sheep', x, y, { energy: 0.9 }); },
  },
  {
    id: 'wolf', name: 'Волк', icon: '🐺', group: 'life',
    brush: false, continuous: true, cooldownMs: 200,
    apply(world, x, y) { spawnEntity(world, 'wolf', x, y, { energy: 0.9 }); },
  },
  {
    id: 'fire', name: 'Огонь', icon: '🔥', group: 'disaster',
    brush: true, radius: 1, continuous: true,
    apply(world, x, y, r) {
      world.forEachInRadius(x, y, r, (tx, ty) => world.igniteFire(tx, ty));
    },
  },
  {
    id: 'lightning', name: 'Молния', icon: '⚡', group: 'disaster',
    brush: false, continuous: false,
    apply(world, x, y) { world.lightning(x, y); },
  },
  {
    id: 'meteor', name: 'Метеорит', icon: '☄️', group: 'disaster',
    brush: false, continuous: false,
    apply(world, x, y) { world.meteor(x, y, 4); },
  },
  {
    id: 'erase', name: 'Ластик', icon: '🧹', group: 'disaster',
    brush: true, radius: 1, continuous: true,
    apply(world, x, y, r) {
      world.forEachInRadius(x, y, r, (tx, ty) => world.killAt(tx, ty));
    },
  },
];

export function getTool(id) { return TOOLS.find(t => t.id === id); }
