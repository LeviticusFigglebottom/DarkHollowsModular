// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — CORE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Display & Canvas
export const TILE = 40;
export const VIEW_W = 21;
export const VIEW_H = 15;
export const CANVAS_W = VIEW_W * TILE;
export const CANVAS_H = VIEW_H * TILE;

// Player Movement
export const PLAYER_SPEED = 2.0;
export const SPRINT_MULT = 1.65;
export const SPRINT_COST = 0.18;
export const STAMINA_REGEN = 0.04;
export const STAMINA_REGEN_IDLE = 0.08;

// Combat
export const ATTACK_STAM_COST = 12;
export const ATTACK_COOLDOWN = 24;
export const PLAYER_KB = 12;
export const HP_REGEN = 0.012;
export const HP_REGEN_COMBAT_DELAY = 180;

// Progression
export const XP_THRESHOLDS = [
  0, 50, 120, 220, 360, 550, 800, 1100, 1500, 2000,
  2600, 3400, 4400, 5600, 7000, 8700, 10700, 13000, 15600, 18500
];

// Performance Settings
export const MAX_FLOATING_TEXTS = 30;
export const GRID_CELL_SIZE = 160; // 4 tiles per cell for spatial partitioning

// Animated tiles that should NOT be cached
export const ANIMATED_TILES = new Set([
  'TORCH_WALL', 'EMBER_GROUND', 'WATER_PUDDLE', 'STAINED_GLASS',
  'CAMP_FIRE', 'MUSHROOM', 'CRYSTAL', 'SOUL_FLAME', 'BONFIRE'
]);

// ═══════════════════════════════════════════════════════════════
// GRAPHICS PRESETS
// ═══════════════════════════════════════════════════════════════
export const GRAPHICS_PRESETS = {
  ultra: {
    name: "Ultra",
    desc: "Maximum quality with all effects enabled. May impact performance on lower-end devices.",
    lighting: true,
    lightingQuality: 2,
    atmosphericEffects: true,
    atmosphericDensity: 1.0,
    tileDetail: 2,
    animatedTiles: true,
    vignette: true,
    particleLimit: 50,
    maxEnemyAIDistance: 800,
    enemyAISkipFrames: 1,
    renderSkipFrames: 1,
  },
  balanced: {
    name: "Balanced",
    desc: "Good balance of quality and performance. Recommended for most systems.",
    lighting: true,
    lightingQuality: 1,
    atmosphericEffects: true,
    atmosphericDensity: 0.5,
    tileDetail: 1,
    animatedTiles: true,
    vignette: true,
    particleLimit: 20,
    maxEnemyAIDistance: 500,
    enemyAISkipFrames: 2,
    renderSkipFrames: 2,
  },
  performance: {
    name: "Performance",
    desc: "Minimal effects for maximum FPS. Best for older/slower hardware.",
    lighting: false,
    lightingQuality: 0,
    atmosphericEffects: false,
    atmosphericDensity: 0,
    tileDetail: 0,
    animatedTiles: false,
    vignette: false,
    particleLimit: 5,
    maxEnemyAIDistance: 250,
    enemyAISkipFrames: 3,
    renderSkipFrames: 4,
  }
};

// Active graphics settings (mutable reference for performance - avoids React re-renders)
let GFX = { ...GRAPHICS_PRESETS.balanced };

export const getGFX = () => GFX;

export const setGraphicsPreset = (presetName) => {
  if (GRAPHICS_PRESETS[presetName]) {
    GFX = { ...GRAPHICS_PRESETS[presetName] };
    try {
      localStorage.setItem('darkHollowsGraphics', presetName);
    } catch (e) { /* ignore storage errors */ }
  }
};

// Load saved preset on startup
try {
  const saved = localStorage.getItem('darkHollowsGraphics');
  if (saved && GRAPHICS_PRESETS[saved]) {
    GFX = { ...GRAPHICS_PRESETS[saved] };
  }
} catch (e) { /* ignore storage errors */ }

// Zone darkness levels
export const ZONE_DARKNESS = {
  ruin: 0.35,
  town: 0.0,
  forest: 0.25,
  cave: 0.55,
  crypt: 0.58,
  desert: 0.15,
  graveyard: 0.40,
  ice: 0.20,
  volcanic: 0.30,
};

// Zone background colors
export const ZONE_BACKGROUNDS = {
  ruin: "#06060a",
  town: "#1a3a18",
  forest: "#0a1a08",
  cave: "#060610",
  crypt: "#080610",
  desert: "#c4a060",
  graveyard: "#0a0a10",
  ice: "#1a2030",
  volcanic: "#1a0808",
};
