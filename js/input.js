import { getTool } from './tools.js';
import { TILE } from './render.js';

export function setupInput(canvas, camera, world, state, ui) {
  let dragButton = null;
  let lastPan = null;
  let lastApply = {};

  function tileUnderCursor(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const [wx, wy] = camera.screenToWorld(sx, sy);
    return { x: Math.floor(wx), y: Math.floor(wy) };
  }

  function applyTool(pos) {
    const tool = getTool(state.toolId);
    if (!tool || !world.inBounds(pos.x, pos.y)) return;
    const now = performance.now();
    if (tool.cooldownMs) {
      const last = lastApply[tool.id] || 0;
      if (now - last < tool.cooldownMs) return;
      lastApply[tool.id] = now;
    }
    if (tool.brush) tool.apply(world, pos.x, pos.y, state.brushRadius);
    else tool.apply(world, pos.x, pos.y);
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const pos = tileUnderCursor(e);
    if (e.button === 2 || e.button === 1) {
      dragButton = 'pan';
      lastPan = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0) {
      dragButton = 'tool';
      applyTool(pos);
    }
  });

  canvas.addEventListener('pointermove', e => {
    const pos = tileUnderCursor(e);
    state.hover = pos;
    if (dragButton === 'pan' && lastPan) {
      const dx = e.clientX - lastPan.x, dy = e.clientY - lastPan.y;
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      camera.clamp(world);
      lastPan = { x: e.clientX, y: e.clientY };
    } else if (dragButton === 'tool') {
      const tool = getTool(state.toolId);
      if (tool && tool.continuous) applyTool(pos);
    }
  });

  window.addEventListener('pointerup', () => { dragButton = null; lastPan = null; });
  canvas.addEventListener('pointerleave', () => { state.hover = null; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const [wxBefore, wyBefore] = camera.screenToWorld(sx, sy);
    camera.zoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12;
    camera.zoom = Math.max(0.3, Math.min(4, camera.zoom));
    const [wxAfter, wyAfter] = camera.screenToWorld(sx, sy);
    camera.x += (wxBefore - wxAfter) * TILE;
    camera.y += (wyBefore - wyAfter) * TILE;
    camera.clamp(world);
  }, { passive: false });

  const panKeys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  const held = new Set();
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { state.paused = !state.paused; ui.syncSpeed(); e.preventDefault(); return; }
    if (e.key === '1') { state.speed = 1; ui.syncSpeed(); }
    if (e.key === '2') { state.speed = 2; ui.syncSpeed(); }
    if (e.key === '3') { state.speed = 4; ui.syncSpeed(); }
    if (panKeys[e.key]) held.add(e.key);
  });
  window.addEventListener('keyup', e => held.delete(e.key));

  function panTick() {
    if (held.size) {
      let dx = 0, dy = 0;
      for (const k of held) { dx += panKeys[k][0]; dy += panKeys[k][1]; }
      camera.x += dx * 8 / camera.zoom;
      camera.y += dy * 8 / camera.zoom;
      camera.clamp(world);
    }
    requestAnimationFrame(panTick);
  }
  panTick();
}
