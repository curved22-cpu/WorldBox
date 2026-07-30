import { TILE } from './render.js';

export function setupInput(canvas, camera, game, renderer, onSelect) {
  let dragButton = null;
  let lastPan = null;
  let dragMoved = false;
  const activePointers = new Map();
  const pinch = { active: false, startDist: 1, startZoom: 1, lastMid: { x: 0, y: 0 } };

  function startPinch() {
    const pts = [...activePointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    pinch.active = true; pinch.startDist = dist; pinch.startZoom = camera.zoom;
    pinch.lastMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }

  function updatePinch() {
    const pts = [...activePointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const dx = mid.x - pinch.lastMid.x, dy = mid.y - pinch.lastMid.y;
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    const rect = canvas.getBoundingClientRect();
    const sx = mid.x - rect.left, sy = mid.y - rect.top;
    const [wxBefore, wyBefore] = camera.screenToWorld(sx, sy);
    camera.zoom = Math.max(0.4, Math.min(6, pinch.startZoom * (dist / pinch.startDist)));
    const [wxAfter, wyAfter] = camera.screenToWorld(sx, sy);
    camera.x += (wxBefore - wxAfter) * TILE;
    camera.y += (wyBefore - wyAfter) * TILE;
    camera.clamp(game.terrain);
    pinch.lastMid = mid;
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size >= 2) { dragButton = null; lastPan = null; startPinch(); return; }
    dragMoved = false;
    if (e.button === 2 || e.button === 1) {
      dragButton = 'pan';
      lastPan = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0) {
      dragButton = 'maybe-pan';
      lastPan = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size >= 2) { if (!pinch.active) startPinch(); updatePinch(); return; }
    if ((dragButton === 'pan' || dragButton === 'maybe-pan') && lastPan) {
      const dx = e.clientX - lastPan.x, dy = e.clientY - lastPan.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      if (dragMoved) {
        camera.x -= dx / camera.zoom;
        camera.y -= dy / camera.zoom;
        camera.clamp(game.terrain);
      }
      lastPan = { x: e.clientX, y: e.clientY };
    }
  });

  function release(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinch.active = false;
    if (dragButton === 'maybe-pan' && !dragMoved) {
      const rect = canvas.getBoundingClientRect();
      const hit = renderer.hitTest(camera, game, e.clientX - rect.left, e.clientY - rect.top);
      onSelect(hit);
    }
    if (activePointers.size === 0) { dragButton = null; lastPan = null; }
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const [wxBefore, wyBefore] = camera.screenToWorld(sx, sy);
    camera.zoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12;
    camera.zoom = Math.max(0.4, Math.min(6, camera.zoom));
    const [wxAfter, wyAfter] = camera.screenToWorld(sx, sy);
    camera.x += (wxBefore - wxAfter) * TILE;
    camera.y += (wyBefore - wyAfter) * TILE;
    camera.clamp(game.terrain);
  }, { passive: false });

  const panKeys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  const held = new Set();
  window.addEventListener('keydown', e => { if (panKeys[e.key]) held.add(e.key); });
  window.addEventListener('keyup', e => held.delete(e.key));
  function panTick() {
    if (held.size) {
      let dx = 0, dy = 0;
      for (const k of held) { dx += panKeys[k][0]; dy += panKeys[k][1]; }
      camera.x += dx * 8 / camera.zoom;
      camera.y += dy * 8 / camera.zoom;
      camera.clamp(game.terrain);
    }
    requestAnimationFrame(panTick);
  }
  panTick();

  return {
    zoomBy(factor) { camera.zoom = Math.max(0.4, Math.min(6, camera.zoom * factor)); camera.clamp(game.terrain); },
  };
}
