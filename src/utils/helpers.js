// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — UTILITY FUNCTIONS
// Performance optimizations: object pooling, spatial grid, caching
// ═══════════════════════════════════════════════════════════════

import { CANVAS_W, CANVAS_H, MAX_FLOATING_TEXTS, GRID_CELL_SIZE } from '../constants/config.js';

// ═══════════════════════════════════════════════════════════════
// FLOATING TEXT POOL
// Reuse objects to avoid garbage collection
// ═══════════════════════════════════════════════════════════════

const _ftPool = [];
const POOL_MAX_SIZE = 50;

export const getFloatingText = (gameState, x, y, text, color, life, crit) => {
  // Cap floating texts to prevent performance issues
  if (gameState.floatingTexts.length >= MAX_FLOATING_TEXTS) {
    const removed = gameState.floatingTexts.shift();
    if (removed) _ftPool.push(removed);
  }
  
  // Reuse from pool or create new
  let ft = _ftPool.pop();
  if (ft) {
    ft.x = x;
    ft.y = y;
    ft.text = text;
    ft.color = color;
    ft.life = life;
    ft.crit = crit;
  } else {
    ft = { x, y, text, color, life, crit };
  }
  
  gameState.floatingTexts.push(ft);
  return ft;
};

export const releaseFloatingText = (ft) => {
  if (_ftPool.length < POOL_MAX_SIZE) {
    _ftPool.push(ft);
  }
};

// ═══════════════════════════════════════════════════════════════
// SPATIAL GRID
// Speeds up collision detection by partitioning space
// ═══════════════════════════════════════════════════════════════

const _spatialGrid = new Map();

export const clearSpatialGrid = () => {
  _spatialGrid.clear();
};

export const getGridKey = (x, y) => {
  return `${Math.floor(x / GRID_CELL_SIZE)},${Math.floor(y / GRID_CELL_SIZE)}`;
};

export const addToSpatialGrid = (entity) => {
  const key = getGridKey(entity.x, entity.y);
  if (!_spatialGrid.has(key)) {
    _spatialGrid.set(key, []);
  }
  _spatialGrid.get(key).push(entity);
};

export const getNearbyEnemies = (x, y, radius = 200) => {
  const results = [];
  const cellRadius = Math.ceil(radius / GRID_CELL_SIZE);
  const cx = Math.floor(x / GRID_CELL_SIZE);
  const cy = Math.floor(y / GRID_CELL_SIZE);
  
  for (let dx = -cellRadius; dx <= cellRadius; dx++) {
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      const key = `${cx + dx},${cy + dy}`;
      const cell = _spatialGrid.get(key);
      if (cell) results.push(...cell);
    }
  }
  
  return results;
};

export const rebuildSpatialGrid = (enemies) => {
  clearSpatialGrid();
  enemies.forEach(enemy => {
    if (!enemy.dead) {
      addToSpatialGrid(enemy);
    }
  });
};

// ═══════════════════════════════════════════════════════════════
// CANVAS CACHING
// Pre-rendered canvases for vignette and lighting
// ═══════════════════════════════════════════════════════════════

let _lightCanvas = null;
let _lightCtx = null;

export const getLightingCanvas = () => {
  if (!_lightCanvas) {
    _lightCanvas = document.createElement('canvas');
    _lightCanvas.width = CANVAS_W;
    _lightCanvas.height = CANVAS_H;
    _lightCtx = _lightCanvas.getContext('2d');
  }
  return { canvas: _lightCanvas, ctx: _lightCtx };
};

// Vignette cache by alpha level
const _vignetteCanvases = {};

export const getVignetteCanvas = (alpha) => {
  const key = alpha.toFixed(2);
  if (!_vignetteCanvases[key]) {
    const vc = document.createElement('canvas');
    vc.width = CANVAS_W;
    vc.height = CANVAS_H;
    const vctx = vc.getContext('2d');
    const vg = vctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.3,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.65
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.7, `rgba(0,0,0,${alpha * 0.25})`);
    vg.addColorStop(1, `rgba(0,0,0,${alpha})`);
    vctx.fillStyle = vg;
    vctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _vignetteCanvases[key] = vc;
  }
  return _vignetteCanvases[key];
};

// ═══════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════

export const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

export const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

export const distance = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

export const normalize = (x, y) => {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
};

export const randomRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

export const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// ═══════════════════════════════════════════════════════════════
// COLLISION HELPERS
// ═══════════════════════════════════════════════════════════════

export const rectIntersects = (ax, ay, aw, ah, bx, by, bw, bh) => {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
};

export const circleIntersects = (x1, y1, r1, x2, y2, r2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distSq = dx * dx + dy * dy;
  const radSum = r1 + r2;
  return distSq < radSum * radSum;
};

export const pointInRect = (px, py, rx, ry, rw, rh) => {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
};

// ═══════════════════════════════════════════════════════════════
// DELTA TIME HELPERS
// ═══════════════════════════════════════════════════════════════

const TARGET_FPS = 60;
const TARGET_FRAME_TIME = 1000 / TARGET_FPS;

export const calculateDeltaMult = (deltaTime) => {
  // Clamp delta to prevent huge jumps
  const clampedDelta = Math.min(deltaTime, TARGET_FRAME_TIME * 3);
  return clampedDelta / TARGET_FRAME_TIME;
};

// ═══════════════════════════════════════════════════════════════
// SAVE/LOAD HELPERS
// ═══════════════════════════════════════════════════════════════

const SAVE_KEY = 'darkHollowsSave';

export const saveGame = (gameState) => {
  try {
    const saveData = JSON.stringify(gameState);
    localStorage.setItem(SAVE_KEY, saveData);
    return true;
  } catch (e) {
    console.error('Failed to save game:', e);
    return false;
  }
};

export const loadGame = () => {
  try {
    const saveData = localStorage.getItem(SAVE_KEY);
    if (saveData) {
      return JSON.parse(saveData);
    }
  } catch (e) {
    console.error('Failed to load game:', e);
  }
  return null;
};

export const deleteSave = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    console.error('Failed to delete save:', e);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
// EFFECT NAME MAPPING
// ═══════════════════════════════════════════════════════════════

export const getEffectName = (effectType) => {
  const names = {
    poison: "Poisoned!",
    venom: "Envenomed!",
    burn: "Burning!",
    freeze: "Slowed!",
    bleed: "Bleeding!",
  };
  return names[effectType] || effectType;
};

export const getEffectColor = (effectType) => {
  const colors = {
    poison: "#60ff60",
    venom: "#a0ff60",
    burn: "#ffa040",
    freeze: "#80c0ff",
    bleed: "#ff6060",
  };
  return colors[effectType] || "#ffffff";
};
