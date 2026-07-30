import { TOOLS } from './tools.js';
import { countBySpecies } from './entities.js';

const GROUP_LABEL = { terrain: 'Рельеф', life: 'Жизнь', disaster: 'Бедствия' };
const BRUSH_SIZES = [0, 1, 2, 3, 4];

export function setupUI(state, world) {
  const toolbar = document.getElementById('toolbar');
  const brushRow = document.getElementById('brush-row');
  const stats = document.getElementById('stats');
  const speedRow = document.getElementById('speed-row');
  const newWorldBtn = document.getElementById('new-world-btn');
  const toolLabel = document.getElementById('tool-label');

  const groups = {};
  for (const tool of TOOLS) {
    if (!groups[tool.group]) {
      const g = document.createElement('div');
      g.className = 'tool-group';
      const title = document.createElement('span');
      title.className = 'tool-group-label';
      title.textContent = GROUP_LABEL[tool.group] || tool.group;
      g.appendChild(title);
      groups[tool.group] = g;
      toolbar.appendChild(g);
    }
  }

  const buttons = {};
  for (const tool of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.title = tool.name;
    btn.innerHTML = `<span class="icon">${tool.icon}</span>`;
    btn.addEventListener('click', () => {
      state.toolId = tool.id;
      selectTool(tool);
    });
    buttons[tool.id] = btn;
    groups[tool.group].appendChild(btn);
  }

  function selectTool(tool) {
    for (const id in buttons) buttons[id].classList.toggle('active', id === tool.id);
    toolLabel.textContent = tool.name;
    brushRow.innerHTML = '';
    if (tool.brush) {
      brushRow.style.display = 'flex';
      for (const r of BRUSH_SIZES) {
        const b = document.createElement('button');
        b.className = 'brush-btn';
        b.textContent = r === 0 ? '•' : '●'.repeat(1);
        b.style.fontSize = `${10 + r * 3}px`;
        b.title = `Размер кисти ${r + 1}`;
        b.classList.toggle('active', state.brushRadius === r);
        b.addEventListener('click', () => {
          state.brushRadius = r;
          [...brushRow.children].forEach(c => c.classList.remove('active'));
          b.classList.add('active');
        });
        brushRow.appendChild(b);
      }
    } else {
      brushRow.style.display = 'none';
    }
  }

  selectTool(TOOLS.find(t => t.id === state.toolId));

  const speedButtons = {};
  for (const [label, val] of [['⏸', 'pause'], ['▶', 1], ['▶▶', 2], ['▶▶▶', 4]]) {
    const b = document.createElement('button');
    b.className = 'speed-btn';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (val === 'pause') state.paused = !state.paused;
      else { state.paused = false; state.speed = val; }
      syncSpeed();
    });
    speedButtons[val] = b;
    speedRow.appendChild(b);
  }

  function syncSpeed() {
    speedButtons.pause.classList.toggle('active', state.paused);
    for (const v of [1, 2, 4]) speedButtons[v].classList.toggle('active', !state.paused && state.speed === v);
  }
  syncSpeed();

  newWorldBtn.addEventListener('click', () => {
    world.regenerate();
  });

  function syncStats() {
    const c = countBySpecies(world);
    stats.innerHTML =
      `<span>🧍 ${c.human}</span><span>🐑 ${c.sheep}</span><span>🐺 ${c.wolf}</span>` +
      `<span>🌳 ${world.trees.size}</span><span>⏱ ${world.tick}</span>`;
  }

  return { syncSpeed, syncStats };
}
