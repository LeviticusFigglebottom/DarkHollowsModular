import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — PROLOGUE: THE ASHEN CITY
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GRAPHICS PRESETS - User-selectable quality settings
// ═══════════════════════════════════════════════════════════════
const GRAPHICS_PRESETS = {
  ultra: {
    name: "Ultra Quality",
    desc: "Maximum visual fidelity. Full lighting, particles, and effects.",
    lighting: true,
    lightingQuality: 2,       // 2=smooth gradients, 1=simple circles, 0=off
    atmosphericEffects: true,
    atmosphericDensity: 1.0,
    tileDetail: 2,            // 2=full detail, 1=simplified, 0=flat colors
    animatedTiles: true,
    vignette: true,
    particleLimit: 40,
    maxEnemyAIDistance: 800,
    enemyAISkipFrames: 1,     // Process all enemies every frame
    renderSkipFrames: 1,      // Render effects every frame
  },
  balanced: {
    name: "Balanced",
    desc: "Good visuals with solid performance. Recommended for most systems.",
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
let GFX = {...GRAPHICS_PRESETS.balanced};
const setGraphicsPreset = (presetName) => {
  if(GRAPHICS_PRESETS[presetName]){
    GFX = {...GRAPHICS_PRESETS[presetName]};
    try { localStorage.setItem('darkHollowsGraphics', presetName); } catch(e){}
  }
};
// Load saved preset on startup
try {
  const saved = localStorage.getItem('darkHollowsGraphics');
  if(saved && GRAPHICS_PRESETS[saved]) GFX = {...GRAPHICS_PRESETS[saved]};
} catch(e){}

const TILE = 40;
const VIEW_W = 21;
const VIEW_H = 15;
const CANVAS_W = VIEW_W * TILE;
const CANVAS_H = VIEW_H * TILE;
const PLAYER_SPEED = 2.0;
const SPRINT_MULT = 1.65;
const SPRINT_COST = 0.18;
const STAMINA_REGEN = 0.04;
const STAMINA_REGEN_IDLE = 0.08;

// Performance: Cached canvases to avoid creating new ones each frame
let _lightCanvas = null;
let _lightCtx = null;
const getLightingCanvas = () => {
  if(!_lightCanvas){
    _lightCanvas = document.createElement('canvas');
    _lightCanvas.width = CANVAS_W;
    _lightCanvas.height = CANVAS_H;
    _lightCtx = _lightCanvas.getContext('2d');
  }
  return { canvas: _lightCanvas, ctx: _lightCtx };
};

// Performance: Tile cache for static tiles (unused but kept for potential future use)
const _tileCache = new Map();
const _tileCacheCanvas = document.createElement('canvas');
_tileCacheCanvas.width = TILE;
_tileCacheCanvas.height = TILE;
const _tileCacheCtx = _tileCacheCanvas.getContext('2d');

// NOTE: Background layer caching was removed - caused jitter/teleport bugs
// Keeping simpler optimizations that work reliably

// Performance: Pre-cached vignette gradients (one per zone type)
let _vignetteCanvases = {};
const getVignetteCanvas = (alpha) => {
  const key = alpha.toFixed(2);
  if(!_vignetteCanvases[key]){
    const vc = document.createElement('canvas');
    vc.width = CANVAS_W;
    vc.height = CANVAS_H;
    const vctx = vc.getContext('2d');
    const vg = vctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2,CANVAS_W*0.3,CANVAS_W/2,CANVAS_H/2,CANVAS_W*0.65);
    vg.addColorStop(0,"rgba(0,0,0,0)");
    vg.addColorStop(0.7,`rgba(0,0,0,${alpha*0.25})`);
    vg.addColorStop(1,`rgba(0,0,0,${alpha})`);
    vctx.fillStyle = vg;
    vctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    _vignetteCanvases[key] = vc;
  }
  return _vignetteCanvases[key];
};

// Performance: Floating text pool for object reuse
const _ftPool = [];
const MAX_FLOATING_TEXTS = 30; // Cap to prevent too many on screen
const getFloatingText = (g, x, y, text, color, life, crit) => {
  // Cap floating texts to prevent performance issues
  if(g.floatingTexts.length >= MAX_FLOATING_TEXTS){
    // Remove oldest
    const removed = g.floatingTexts.shift();
    if(removed)_ftPool.push(removed);
  }
  // Reuse from pool or create new
  let ft = _ftPool.pop();
  if(ft){
    ft.x = x; ft.y = y; ft.text = text; ft.color = color; ft.life = life; ft.crit = crit;
  }else{
    ft = {x, y, text, color, life, crit};
  }
  g.floatingTexts.push(ft);
  return ft;
};
const releaseFloatingText = (ft) => {
  if(_ftPool.length < 50) _ftPool.push(ft); // Keep pool capped
};

// Performance: Spatial grid for enemy partitioning (speeds up collision detection)
const GRID_CELL_SIZE = 160; // 4 tiles per cell
const _spatialGrid = new Map();
const clearSpatialGrid = () => _spatialGrid.clear();
const getGridKey = (x, y) => `${Math.floor(x/GRID_CELL_SIZE)},${Math.floor(y/GRID_CELL_SIZE)}`;
const addToSpatialGrid = (entity) => {
  const key = getGridKey(entity.x, entity.y);
  if(!_spatialGrid.has(key)) _spatialGrid.set(key, []);
  _spatialGrid.get(key).push(entity);
};
const getNearbyEnemies = (x, y, radius = 200) => {
  const results = [];
  const cellRadius = Math.ceil(radius / GRID_CELL_SIZE);
  const cx = Math.floor(x / GRID_CELL_SIZE);
  const cy = Math.floor(y / GRID_CELL_SIZE);
  for(let dx = -cellRadius; dx <= cellRadius; dx++){
    for(let dy = -cellRadius; dy <= cellRadius; dy++){
      const key = `${cx+dx},${cy+dy}`;
      const cell = _spatialGrid.get(key);
      if(cell) results.push(...cell);
    }
  }
  return results;
};

// Animated tiles that should NOT be cached
const ANIMATED_TILES = new Set(['TORCH_WALL', 'EMBER_GROUND', 'WATER_PUDDLE', 'STAINED_GLASS', 'CAMP_FIRE', 'MUSHROOM', 'CRYSTAL', 'SOUL_FLAME', 'BONFIRE']);

// ═══════════════════════════════════════════════════════════════
// SOUND SYSTEM (Web Audio API) - Realistic procedural sounds
// ═══════════════════════════════════════════════════════════════
const SoundSystem = {
  ctx: null,
  enabled: true,
  volume: 0.35,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { this.enabled = false; }
  },
  noise(duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=Math.random()*2-1;
    const noise=this.ctx.createBufferSource();
    noise.buffer=buffer;
    return noise;
  },
  play(type) {
    if(!this.enabled||!this.ctx) return;
    if(this.ctx.state==='suspended') this.ctx.resume();
    const now=this.ctx.currentTime;
    const v=this.volume;
    
    switch(type) {
      case 'slash': { // Sword swing - sharp swoosh
        const n=this.noise(0.12);
        const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=3000;f.Q.value=1;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.25*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.1);
        n.connect(f);f.connect(g);g.connect(this.ctx.destination);n.start(now);n.stop(now+0.12);
        break;
      }
      case 'chop': { // Axe - heavy thunk
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(100,now);o.frequency.exponentialRampToValueAtTime(40,now+0.15);
        g.gain.setValueAtTime(0.3*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.18);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.18);
        break;
      }
      case 'thrust': { // Spear jab - quick stab
        const n=this.noise(0.08);
        const f=this.ctx.createBiquadFilter();f.type='highpass';f.frequency.value=2500;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.2*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.08);
        n.connect(f);f.connect(g);g.connect(this.ctx.destination);n.start(now);n.stop(now+0.08);
        break;
      }
      case 'shoot': { // Bow twang
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='triangle';o.frequency.setValueAtTime(200,now);o.frequency.exponentialRampToValueAtTime(50,now+0.15);
        g.gain.setValueAtTime(0.18*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.15);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.15);
        break;
      }
      case 'hit': { // Impact thud
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(150,now);o.frequency.exponentialRampToValueAtTime(50,now+0.1);
        g.gain.setValueAtTime(0.35*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.12);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.12);
        break;
      }
      case 'hurt': { // Player damage
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sawtooth';o.frequency.setValueAtTime(180,now);o.frequency.exponentialRampToValueAtTime(60,now+0.18);
        g.gain.setValueAtTime(0.22*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.2);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.2);
        break;
      }
      case 'kill': { // Enemy death
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sawtooth';o.frequency.setValueAtTime(200,now);o.frequency.exponentialRampToValueAtTime(25,now+0.4);
        g.gain.setValueAtTime(0.2*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.45);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.45);
        break;
      }
      case 'fireball': { // Enemy projectile
        const n=this.noise(0.2);
        const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=600;f.Q.value=1;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.15*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.2);
        n.connect(f);f.connect(g);g.connect(this.ctx.destination);n.start(now);n.stop(now+0.2);
        break;
      }
      case 'slam': { // Ground slam
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(60,now);o.frequency.exponentialRampToValueAtTime(20,now+0.25);
        g.gain.setValueAtTime(0.4*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.3);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.3);
        break;
      }
      case 'pickup': { // Item chime
        [880,1100,1320].forEach((freq,i)=>{
          const o=this.ctx.createOscillator();const g=this.ctx.createGain();
          o.type='sine';o.frequency.value=freq;
          g.gain.setValueAtTime(0,now+i*0.04);g.gain.linearRampToValueAtTime(0.08*v,now+i*0.04+0.02);
          g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
          o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.25);
        });
        break;
      }
      case 'potion': { // Drinking sound
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(300,now);o.frequency.setValueAtTime(400,now+0.08);o.frequency.setValueAtTime(350,now+0.15);
        g.gain.setValueAtTime(0.12*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.2);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.2);
        break;
      }
      case 'levelup': { // Level up fanfare
        [400,500,600,800].forEach((freq,i)=>{
          const o=this.ctx.createOscillator();const g=this.ctx.createGain();
          o.type='square';o.frequency.value=freq;
          g.gain.setValueAtTime(0,now+i*0.1);g.gain.linearRampToValueAtTime(0.1*v,now+i*0.1+0.05);
          g.gain.exponentialRampToValueAtTime(0.001,now+0.7);
          o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.7);
        });
        break;
      }
      case 'door': { // Door creak
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sawtooth';o.frequency.setValueAtTime(55,now);o.frequency.linearRampToValueAtTime(85,now+0.15);o.frequency.linearRampToValueAtTime(65,now+0.3);
        g.gain.setValueAtTime(0.1*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.35);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.35);
        break;
      }
      case 'step': { // Footstep
        const n=this.noise(0.05);
        const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=400;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.04*v,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.05);
        n.connect(f);f.connect(g);g.connect(this.ctx.destination);n.start(now);n.stop(now+0.05);
        break;
      }
      case 'woosh': { // Dodge roll
        const n=this.noise(0.18);
        const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1500;f.Q.value=0.8;
        f.frequency.setValueAtTime(2200,now);f.frequency.exponentialRampToValueAtTime(700,now+0.15);
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.2*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.18);
        n.connect(f);f.connect(g);g.connect(this.ctx.destination);n.start(now);n.stop(now+0.18);
        break;
      }
      case 'coin': { // Gold clink
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(2500,now);o.frequency.setValueAtTime(3000,now+0.03);
        g.gain.setValueAtTime(0.1*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.1);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.1);
        break;
      }
      case 'break': { // Jar shatter
        const n=this.noise(0.15);
        const f=this.ctx.createBiquadFilter();f.type='highpass';f.frequency.value=1200;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.3*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.12);
        n.connect(f);f.connect(g);g.connect(this.ctx.destination);n.start(now);n.stop(now+0.15);
        break;
      }
      case 'ui': { // Menu click
        const o=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.value=700;
        g.gain.setValueAtTime(0.05*v,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.04);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.04);
        break;
      }
      case 'magic': { // Ultimate ability
        const o=this.ctx.createOscillator();const o2=this.ctx.createOscillator();const g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(440,now);o.frequency.linearRampToValueAtTime(880,now+0.3);
        o2.type='sine';o2.frequency.setValueAtTime(554,now);o2.frequency.linearRampToValueAtTime(1108,now+0.3);
        g.gain.setValueAtTime(0.15*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.45);
        o.connect(g);o2.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.45);o2.start(now);o2.stop(now+0.45);
        break;
      }
      case 'save': { // Save game chime
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        const o2=this.ctx.createOscillator(),o3=this.ctx.createOscillator();
        o.type='sine';o.frequency.setValueAtTime(523,now);
        o2.type='sine';o2.frequency.setValueAtTime(659,now);o2.start(now+0.1);o2.stop(now+0.35);
        o3.type='sine';o3.frequency.setValueAtTime(784,now);o3.start(now+0.2);o3.stop(now+0.45);
        g.gain.setValueAtTime(0.12*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.5);
        o.connect(g);o2.connect(g);o3.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.25);
        break;
      }
      case 'boss_roar': { // Deep rumbling roar
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        const o2=this.ctx.createOscillator();
        const noise=this.noise(0.8);
        const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(200,now);
        o.type='sawtooth';o.frequency.setValueAtTime(60,now);o.frequency.linearRampToValueAtTime(40,now+0.6);
        o2.type='sawtooth';o2.frequency.setValueAtTime(80,now);o2.frequency.linearRampToValueAtTime(55,now+0.5);
        g.gain.setValueAtTime(0.25*v,now);g.gain.linearRampToValueAtTime(0.35*v,now+0.15);g.gain.exponentialRampToValueAtTime(0.01,now+0.8);
        o.connect(g);o2.connect(g);noise.connect(lp);lp.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.8);o2.start(now);o2.stop(now+0.6);noise.start(now);noise.stop(now+0.7);
        break;
      }
      case 'poison': { // Sizzle/bubble
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(180,now);o.frequency.linearRampToValueAtTime(120,now+0.15);
        g.gain.setValueAtTime(0.08*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.2);
        o.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.2);
        break;
      }
      case 'venom': { // Aggressive hiss/spit
        const noise=this.noise(0.18);
        const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.setValueAtTime(2500,now);bp.Q.value=3;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.12*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.18);
        const o=this.ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(300,now);o.frequency.linearRampToValueAtTime(150,now+0.1);
        const g2=this.ctx.createGain();g2.gain.setValueAtTime(0.05*v,now);g2.gain.exponentialRampToValueAtTime(0.01,now+0.12);
        noise.connect(bp);bp.connect(g);g.connect(this.ctx.destination);
        o.connect(g2);g2.connect(this.ctx.destination);
        noise.start(now);noise.stop(now+0.18);o.start(now);o.stop(now+0.12);
        break;
      }
      case 'dodge': { // Quick whoosh
        const noise=this.noise(0.15);
        const hp=this.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.setValueAtTime(2000,now);
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.12*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.15);
        noise.connect(hp);hp.connect(g);g.connect(this.ctx.destination);
        noise.start(now);noise.stop(now+0.15);
        break;
      }
      case 'freeze': { // Ice crystallize
        const o=this.ctx.createOscillator(),o2=this.ctx.createOscillator(),g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(1800,now);o.frequency.linearRampToValueAtTime(2400,now+0.1);
        o2.type='sine';o2.frequency.setValueAtTime(2200,now);o2.frequency.linearRampToValueAtTime(2800,now+0.08);
        g.gain.setValueAtTime(0.08*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.15);
        o.connect(g);o2.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.15);o2.start(now);o2.stop(now+0.12);
        break;
      }
      case 'bleed': { // Wet slice
        const noise=this.noise(0.1);
        const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.setValueAtTime(800,now);bp.Q.value=2;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.1*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.1);
        noise.connect(bp);bp.connect(g);g.connect(this.ctx.destination);
        noise.start(now);noise.stop(now+0.1);
        break;
      }
      case 'burn': { // Fire crackle
        const noise=this.noise(0.2);
        const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.setValueAtTime(1200,now);bp.Q.value=1;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.1*v,now);g.gain.linearRampToValueAtTime(0.15*v,now+0.05);g.gain.exponentialRampToValueAtTime(0.01,now+0.2);
        noise.connect(bp);bp.connect(g);g.connect(this.ctx.destination);
        noise.start(now);noise.stop(now+0.2);
        break;
      }
      case 'teleport': { // Ethereal phase sound
        const o=this.ctx.createOscillator(),o2=this.ctx.createOscillator(),g=this.ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(600,now);o.frequency.linearRampToValueAtTime(1200,now+0.15);
        o2.type='sine';o2.frequency.setValueAtTime(900,now);o2.frequency.linearRampToValueAtTime(400,now+0.2);
        g.gain.setValueAtTime(0.1*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.25);
        o.connect(g);o2.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.2);o2.start(now);o2.stop(now+0.25);
        break;
      }
      case 'dagger': { // Quick stab
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        o.type='triangle';o.frequency.setValueAtTime(1500,now);o.frequency.exponentialRampToValueAtTime(800,now+0.06);
        g.gain.setValueAtTime(0.1*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.08);
        o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+0.08);
        break;
      }
      case 'heavy_swing': { // Heavy weapon whoosh
        const noise=this.noise(0.2);
        const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.setValueAtTime(300,now);bp.frequency.linearRampToValueAtTime(150,now+0.2);bp.Q.value=1;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.12*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.25);
        noise.connect(bp);bp.connect(g);g.connect(this.ctx.destination);
        noise.start(now);noise.stop(now+0.25);
        break;
      }
      case 'slam_heavy': { // Heavy ground impact
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();
        const noise=this.noise(0.2);
        const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(150,now);
        o.type='sine';o.frequency.setValueAtTime(50,now);o.frequency.exponentialRampToValueAtTime(20,now+0.3);
        g.gain.setValueAtTime(0.3*v,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.35);
        o.connect(g);noise.connect(lp);lp.connect(g);g.connect(this.ctx.destination);
        o.start(now);o.stop(now+0.35);noise.start(now);noise.stop(now+0.25);
        break;
      }
      default: break;
    }
  }
};
const ATTACK_STAM_COST = 12;
const ATTACK_COOLDOWN = 24;
const XP_THRESHOLDS = [0,50,120,220,360,550,800,1100,1500,2000,2600,3400,4400,5600,7000,8700,10700,13000,15600,18500];

const T = {
  VOID:0,COBBLE:1,COBBLE_DARK:2,WALL:3,WALL_BROKEN:4,RUBBLE:5,BURNT_WOOD:6,
  ASH:7,BLOOD:8,BLOOD_TRAIL:9,DOOR_BROKEN:10,PILLAR:11,PILLAR_BROKEN:12,
  CATHEDRAL_FLOOR:13,PEW:14,PEW_BROKEN:15,ALTAR:16,STAINED_GLASS:17,
  TORCH_WALL:18,IRON_FENCE:19,COLLAPSED_ROOF:20,CART_WRECK:21,BARREL:22,
  CHAIN:23,STATUE:24,STATUE_BROKEN:25,ARCH:26,CARPET_RED:27,BONE_PILE:28,
  EMBER_GROUND:29,WATER_PUDDLE:30,HANGING_BODY:31,GATE:32,FOUNDATION:33,
  DEBRIS:34,GALLOWS:36,WELL:37,BANNER_TORN:38,WINDOW_BROKEN:39,
  CRATE:40,WEAPON_RACK:41,BLOOD_POOL:42,CANDLE:43,RELIC:44,JAR:45,DOOR_CLOSED:46,
  GRASS:50,GRASS_DARK:51,PATH:52,WOOD_FLOOR:53,MARKET_STALL:54,
  FLOWER:55,HAY:56,FENCE:57,LAMP_POST:58,DOOR:59,ROOF:60,
  CHIMNEY:61,FOUNTAIN:62,WATER:63,COBBLE_CLEAN:64,BANNER:65,
  PLANTER:66,BENCH:67,TREE:68,BUSH:69,WINDOW:70,CARPET:71,
  STATUE_INTACT:72,GARDEN:73,SIGN_POST:74,
  // Forest tiles
  DIRT:75,DENSE_TREE:76,FALLEN_LOG:77,CAMP_FIRE:78,TENT:79,SWAMP:80,MOSS_STONE:81,
  // Cave tiles
  CAVE_FLOOR:82,CAVE_WALL:83,MUSHROOM:84,STALACTITE:85,SPIDER_WEB:86,UNDERGROUND_WATER:87,CRYSTAL:88,
  // Hazard tiles
  SPIKE_TRAP:89,POISON_PUDDLE:90,LAVA:91,ICE:92,FIRE_TRAP:93,
  // Interactive tiles
  LEVER:94,PRESSURE_PLATE:95,TREASURE_CHEST:96,LOCKED_CHEST:97,
  SECRET_WALL:98,CRACKED_WALL:99,BONFIRE:100,
  // Crypt tiles
  CRYPT_FLOOR:101,CRYPT_WALL:102,SARCOPHAGUS:103,TOMB:104,SKULL_PILE:105,
  CRYPT_PILLAR:106,GRAVE:107,COFFIN:108,CRYPT_ALTAR:109,SOUL_FLAME:110,
  // Desert tiles
  SAND:111,SAND_DARK:112,DUNE:113,CACTUS:114,DEAD_TREE:115,OASIS:116,SANDSTONE:117,SANDSTONE_WALL:118,BONES:119,DESERT_ROCK:120,
  // Graveyard tiles  
  GRAVE_DIRT:121,GRAVESTONE:122,MAUSOLEUM:123,DEAD_GRASS:124,CRYPT_ENTRANCE:125,IRON_GATE:126,ANGEL_STATUE:127,WILLOW:128,
  // ═══════════════════════════════════════════════════════════════
  // ICE BIOME TILES (130-145)
  // ═══════════════════════════════════════════════════════════════
  SNOW:130,SNOW_DEEP:131,ICE_FLOOR:132,ICE_WALL:133,FROZEN_TREE:134,
  ICE_CRYSTAL:135,FROST_VENT:136,FROZEN_LAKE:137,SNOW_DRIFT:138,ICE_PILLAR:139,
  FROZEN_CORPSE:140,ICE_STALAGMITE:141,AURORA_STONE:142,FROST_SHRINE:143,
  CRACKED_ICE:144,ICICLE:145,
  // ═══════════════════════════════════════════════════════════════
  // VOLCANIC BIOME TILES (150-165)
  // ═══════════════════════════════════════════════════════════════
  VOLCANIC_ROCK:150,MAGMA:151,OBSIDIAN:152,VOLCANIC_VENT:153,ASH_GROUND:154,
  LAVA_FLOW:155,BASALT:156,FIRE_GEYSER:157,VOLCANIC_GLASS:158,SULFUR_POOL:159,
  CHARRED_BONES:160,EMBER_CRYSTAL:161,FLAME_PILLAR:162,INFERNAL_ALTAR:163,
  COOLED_LAVA:164,SMOKE_VENT:165,
};

const SOLID = new Set([
  T.VOID,T.WALL,T.WALL_BROKEN,T.PILLAR,T.PILLAR_BROKEN,
  T.IRON_FENCE,T.COLLAPSED_ROOF,T.CART_WRECK,T.BARREL,
  T.STATUE,T.STATUE_BROKEN,T.PEW,T.PEW_BROKEN,
  T.GATE,T.CRATE,T.WEAPON_RACK,T.WELL,T.GALLOWS,
  T.CHAIN,T.HANGING_BODY,T.STAINED_GLASS,T.BANNER_TORN,
  T.FOUNTAIN,T.TREE,T.MARKET_STALL,T.FENCE,T.PLANTER,T.WATER,
  T.CHIMNEY,T.BUSH,T.LAMP_POST,T.STATUE_INTACT,T.SIGN_POST,
  T.DENSE_TREE,T.FALLEN_LOG,T.TENT,T.CAVE_WALL,T.STALACTITE,T.UNDERGROUND_WATER,
  T.WINDOW,T.WINDOW_BROKEN,T.ALTAR,T.JAR,T.DOOR_CLOSED,T.TORCH_WALL,
  T.TREASURE_CHEST,T.LOCKED_CHEST,T.BONFIRE,
  T.CRYPT_WALL,T.SARCOPHAGUS,T.TOMB,T.CRYPT_PILLAR,T.COFFIN,T.CRYPT_ALTAR,
  T.DUNE,T.CACTUS,T.DEAD_TREE,T.SANDSTONE_WALL,T.DESERT_ROCK,
  T.GRAVESTONE,T.MAUSOLEUM,T.IRON_GATE,T.ANGEL_STATUE,T.WILLOW,
  // Ice biome solids
  T.ICE_WALL,T.FROZEN_TREE,T.ICE_PILLAR,T.ICE_STALAGMITE,T.ICICLE,T.FROZEN_LAKE,
  // Volcanic biome solids
  T.OBSIDIAN,T.MAGMA,T.LAVA_FLOW,T.FLAME_PILLAR,T.SULFUR_POOL,
]);

// Hazard tiles - cause damage/effects when stepped on
const HAZARD_TILES = {
  [T.SPIKE_TRAP]: { dmg: 15, type: "physical" },
  [T.POISON_PUDDLE]: { dmg: 1, type: "poison", effect: "poison", duration: 3600 }, // 1 min regen block
  [T.LAVA]: { dmg: 8, type: "fire", effect: "burn", duration: 180 },
  [T.FIRE_TRAP]: { dmg: 20, type: "fire" },
  // Ice biome hazards
  [T.FROST_VENT]: { dmg: 5, type: "cold", effect: "freeze", duration: 120 },
  [T.CRACKED_ICE]: { dmg: 10, type: "cold" },
  // Volcanic biome hazards
  [T.MAGMA]: { dmg: 12, type: "fire", effect: "burn", duration: 180 },
  [T.LAVA_FLOW]: { dmg: 15, type: "fire", effect: "burn", duration: 240 },
  [T.FIRE_GEYSER]: { dmg: 20, type: "fire" },
  [T.VOLCANIC_VENT]: { dmg: 8, type: "fire", effect: "burn", duration: 120 },
};

const LIGHT_SOURCES_RUIN = new Set([T.TORCH_WALL, T.CANDLE, T.EMBER_GROUND, T.BONFIRE]);
const LIGHT_SOURCES_FOREST = new Set([T.CAMP_FIRE, T.LAMP_POST, T.CANDLE, T.BONFIRE]);
const LIGHT_SOURCES_CAVE = new Set([T.TORCH_WALL, T.CANDLE, T.MUSHROOM, T.CRYSTAL, T.BONFIRE]);
const LIGHT_SOURCES_CRYPT = new Set([T.TORCH_WALL, T.CANDLE, T.SOUL_FLAME, T.BONFIRE]);
const LIGHT_SOURCES_DESERT = new Set([T.TORCH_WALL, T.BONFIRE, T.OASIS]);
const LIGHT_SOURCES_GRAVEYARD = new Set([T.TORCH_WALL, T.CANDLE, T.SOUL_FLAME, T.BONFIRE]);
const LIGHT_SOURCES_ICE = new Set([T.TORCH_WALL, T.BONFIRE, T.ICE_CRYSTAL, T.AURORA_STONE, T.FROST_SHRINE]);
const LIGHT_SOURCES_VOLCANIC = new Set([T.TORCH_WALL, T.BONFIRE, T.MAGMA, T.LAVA_FLOW, T.FIRE_GEYSER, T.EMBER_CRYSTAL, T.FLAME_PILLAR, T.VOLCANIC_VENT]);

// ═══════════════════════════════════════════════════════════════
// ITEMS & EQUIPMENT
// ═══════════════════════════════════════════════════════════════
const ITEMS = {
  ashen_blade:{ id:"ashen_blade",name:"Ashen Blade",icon:"sword",type:"weapon",count:1,stats:{dmg:12,stam:8,range:85},desc:"A blade blackened by fire.",slot:"weapon" },
  blood_philter:{ id:"blood_philter",name:"Blood Philter",icon:"potion_red",type:"consumable",count:1,stats:{heal:30},desc:"Restores 30 health." },
  verdant_tonic:{ id:"verdant_tonic",name:"Verdant Tonic",icon:"potion_green",type:"consumable",count:1,stats:{stam:50},desc:"Restores 50 stamina." },
  torch_item:{ id:"torch_item",name:"Guttering Torch",icon:"torch",type:"tool",count:1,stats:{},desc:"Illuminates nearby area." },
  wanderer_garb:{ id:"wanderer_garb",name:"Wanderer's Garb",icon:"armor",type:"armor",count:1,stats:{def:0},desc:"Worn traveling clothes.",slot:"armor" },
  chain_mail:{ id:"chain_mail",name:"Chain Mail Vest",icon:"armor",type:"armor",count:1,stats:{def:6},desc:"Solid iron links.",slot:"armor" },
  iron_spear:{ id:"iron_spear",name:"Iron Spear",icon:"spear",type:"weapon",count:1,stats:{dmg:18,stam:14,range:95},desc:"Long reach, heavy strikes.",slot:"weapon" },
  hunting_bow:{ id:"hunting_bow",name:"Hunting Bow",icon:"bow",type:"weapon",count:1,stats:{dmg:14,stam:10,range:200,ranged:true},desc:"Requires arrows. Silent and deadly.",slot:"weapon" },
  war_axe:{ id:"war_axe",name:"War Axe",icon:"axe",type:"weapon",count:1,stats:{dmg:16,stam:12,range:70},desc:"Heavy cleaving power.",slot:"weapon" },
  arrows:{ id:"arrows",name:"Arrows",icon:"arrows",type:"ammo",count:1,stats:{},desc:"Ammunition for bows." },
  antidote:{ id:"antidote",name:"Antidote",icon:"potion_blue",type:"consumable",count:1,stats:{heal:10,cleanse:true},desc:"Cures poison and venom, restores 10 HP." },
  // New weapons with status effects
  serrated_dagger:{ id:"serrated_dagger",name:"Serrated Dagger",icon:"dagger",type:"weapon",count:1,stats:{dmg:8,stam:5,range:55,bleedChance:0.35,bleedDmg:2},desc:"Jagged edges cause bleeding wounds.",slot:"weapon" },
  flame_brand:{ id:"flame_brand",name:"Flame Brand",icon:"sword_fire",type:"weapon",count:1,stats:{dmg:15,stam:10,range:80,burnChance:0.25,burnDmg:3},desc:"Wreathed in eternal flame.",slot:"weapon" },
  frost_blade:{ id:"frost_blade",name:"Frost Blade",icon:"sword_frost",type:"weapon",count:1,stats:{dmg:13,stam:9,range:82,freezeChance:0.20,freezeDur:150},desc:"Chills to the bone.",slot:"weapon" },
  venom_fang:{ id:"venom_fang",name:"Venom Fang",icon:"dagger",type:"weapon",count:1,stats:{dmg:10,stam:6,range:58,venomChance:0.45,venomDmg:4},desc:"Dripping with deadly spider venom.",slot:"weapon" },
  poison_blade:{ id:"poison_blade",name:"Poison Blade",icon:"dagger",type:"weapon",count:1,stats:{dmg:11,stam:7,range:60,poisonChance:0.30},desc:"Coated in a toxin that halts regeneration.",slot:"weapon" },
  executioner_axe:{ id:"executioner_axe",name:"Executioner's Axe",icon:"axe",type:"weapon",count:1,stats:{dmg:24,stam:18,range:75,bleedChance:0.5,bleedDmg:3},desc:"One swing, one kill.",slot:"weapon" },
};

const HELD_MAP = {sword:"sword",potion_red:"potion_red",potion_green:"potion_green",potion_blue:"potion_blue",torch:"torch",shield:"shield",bone:null,key:null,ring:null,spear:"spear",bow:"bow",axe:"axe",arrows:null,armor:null,dagger:"dagger",sword_fire:"sword_fire",sword_frost:"sword_frost"};

const ENEMY_INFO = {
  hollow:{name:"Hollow Soldier",xp:15,dmg:8,color:"#1a1018",kb:10},
  hollow_knight:{name:"Hollow Knight",xp:30,dmg:14,color:"#2a2030",kb:7},
  timber_wolf:{name:"Timber Wolf",xp:18,dmg:10,color:"#4a3a20",kb:12},
  forest_bandit:{name:"Forest Bandit",xp:22,dmg:11,color:"#3a4030",kb:9},
  bandit_chief:{name:"Bandit Chief",xp:45,dmg:16,color:"#5a3020",kb:5},
  cave_spider:{name:"Cave Spider",xp:20,dmg:9,color:"#2a2828",kb:14},
  cave_lurker:{name:"Cave Lurker",xp:35,dmg:15,color:"#1a2030",kb:7},
  // New enemy types
  skeleton_archer:{name:"Skeleton Archer",xp:25,dmg:12,color:"#c8c0a8",kb:15,isRanged:true},
  shadow_wraith:{name:"Shadow Wraith",xp:40,dmg:18,color:"#3a2050",kb:8,canTeleport:true},
  fire_elemental:{name:"Fire Elemental",xp:35,dmg:14,color:"#ff6020",kb:10,appliesEffect:"burn"},
  poison_slime:{name:"Poison Slime",xp:18,dmg:6,color:"#50a040",kb:16,appliesEffect:"venom"},
  frost_shade:{name:"Frost Shade",xp:32,dmg:11,color:"#80c0e0",kb:12,appliesEffect:"freeze"},
  // Graveyard enemies
  grave_zombie:{name:"Grave Zombie",xp:20,dmg:10,color:"#3a4838",kb:9},
  restless_spirit:{name:"Restless Spirit",xp:28,dmg:12,color:"#6080a0",kb:12,canTeleport:true},
  bone_guard:{name:"Bone Guard",xp:35,dmg:15,color:"#c8c0b0",kb:6},
  // Desert enemies
  desert_scorpion:{name:"Desert Scorpion",xp:25,dmg:11,color:"#8a6a40",kb:11,appliesEffect:"venom"},
  sand_wraith:{name:"Sand Wraith",xp:30,dmg:13,color:"#c4a060",kb:10},
  dune_stalker:{name:"Dune Stalker",xp:35,dmg:14,color:"#6a5a40",kb:8},
  // Boss enemies
  hollow_lord:{name:"Hollow Lord",xp:150,dmg:25,color:"#3a2848",kb:3,isBoss:true},
  alpha_wolf:{name:"Alpha Wolf",xp:100,dmg:20,color:"#5a4028",kb:4,isBoss:true},
  spider_queen:{name:"Spider Queen",xp:120,dmg:18,color:"#3a3040",kb:4,isBoss:true},
  oasis_guardian:{name:"Oasis Guardian",xp:110,dmg:20,color:"#2a6a60",kb:4,isBoss:true},
  // ═══════════════════════════════════════════════════════════════
  // ICE BIOME ENEMIES
  // ═══════════════════════════════════════════════════════════════
  frost_wolf:{name:"Frost Wolf",xp:28,dmg:12,color:"#a0c8d8",kb:10,appliesEffect:"freeze"},
  ice_wraith:{name:"Ice Wraith",xp:35,dmg:14,color:"#80b8d0",kb:8,canTeleport:true,appliesEffect:"freeze"},
  frozen_knight:{name:"Frozen Knight",xp:40,dmg:16,color:"#5080a0",kb:5},
  snow_stalker:{name:"Snow Stalker",xp:30,dmg:13,color:"#d0e0f0",kb:12},
  crystal_golem:{name:"Crystal Golem",xp:45,dmg:18,color:"#60a0c0",kb:3},
  ice_titan:{name:"Ice Titan",xp:140,dmg:24,color:"#4080a0",kb:2,isBoss:true,appliesEffect:"freeze"},
  // ═══════════════════════════════════════════════════════════════
  // VOLCANIC BIOME ENEMIES
  // ═══════════════════════════════════════════════════════════════
  magma_hound:{name:"Magma Hound",xp:30,dmg:14,color:"#ff6030",kb:10,appliesEffect:"burn"},
  ember_wraith:{name:"Ember Wraith",xp:38,dmg:16,color:"#ff4020",kb:8,canTeleport:true,appliesEffect:"burn"},
  obsidian_golem:{name:"Obsidian Golem",xp:50,dmg:20,color:"#202028",kb:2},
  flame_imp:{name:"Flame Imp",xp:25,dmg:10,color:"#ff8040",kb:14,isRanged:true,appliesEffect:"burn"},
  ash_crawler:{name:"Ash Crawler",xp:22,dmg:11,color:"#4a4040",kb:12},
  infernal_lord:{name:"Infernal Lord",xp:160,dmg:28,color:"#c02010",kb:2,isBoss:true,appliesEffect:"burn"},
};

// Loot tables - item drops by enemy type
const LOOT_TABLES = {
  hollow:[{item:"blood_philter",chance:0.15},{item:"gold",min:2,max:8,chance:0.4}],
  hollow_knight:[{item:"blood_philter",chance:0.25},{item:"verdant_tonic",chance:0.15},{item:"gold",min:5,max:15,chance:0.5}],
  timber_wolf:[{item:"gold",min:1,max:5,chance:0.3}],
  forest_bandit:[{item:"blood_philter",chance:0.2},{item:"gold",min:3,max:12,chance:0.5},{item:"verdant_tonic",chance:0.1},{item:"serrated_dagger",chance:0.05}],
  bandit_chief:[{item:"blood_philter",chance:0.5},{item:"verdant_tonic",chance:0.4},{item:"gold",min:15,max:40,chance:0.8},{item:"executioner_axe",chance:0.15}],
  cave_spider:[{item:"gold",min:1,max:6,chance:0.25},{item:"venom_fang",chance:0.03}],
  cave_lurker:[{item:"blood_philter",chance:0.2},{item:"verdant_tonic",chance:0.15},{item:"gold",min:4,max:14,chance:0.45}],
  skeleton_archer:[{item:"gold",min:3,max:10,chance:0.4},{item:"verdant_tonic",chance:0.15}],
  shadow_wraith:[{item:"blood_philter",chance:0.3},{item:"gold",min:8,max:20,chance:0.5},{item:"frost_blade",chance:0.08}],
  fire_elemental:[{item:"blood_philter",chance:0.25},{item:"gold",min:5,max:15,chance:0.45},{item:"flame_brand",chance:0.10}],
  poison_slime:[{item:"verdant_tonic",chance:0.2},{item:"gold",min:2,max:8,chance:0.35},{item:"venom_fang",chance:0.05}],
  frost_shade:[{item:"blood_philter",chance:0.2},{item:"gold",min:6,max:16,chance:0.4},{item:"frost_blade",chance:0.06}],
  hollow_lord:[{item:"blood_philter",chance:1.0,count:3},{item:"verdant_tonic",chance:1.0,count:2},{item:"gold",min:50,max:100,chance:1.0},{item:"flame_brand",chance:0.4}],
  alpha_wolf:[{item:"blood_philter",chance:1.0,count:2},{item:"gold",min:30,max:60,chance:1.0},{item:"serrated_dagger",chance:0.5}],
  spider_queen:[{item:"verdant_tonic",chance:1.0,count:2},{item:"blood_philter",chance:0.8,count:2},{item:"gold",min:40,max:80,chance:1.0},{item:"venom_fang",chance:0.6}],
  // Graveyard enemies
  grave_zombie:[{item:"blood_philter",chance:0.15},{item:"gold",min:3,max:10,chance:0.35},{item:"bone_charm",chance:0.03}],
  restless_spirit:[{item:"blood_philter",chance:0.25},{item:"gold",min:5,max:15,chance:0.45}],
  bone_guard:[{item:"blood_philter",chance:0.3},{item:"verdant_tonic",chance:0.15},{item:"gold",min:8,max:20,chance:0.5}],
  // Desert enemies
  desert_scorpion:[{item:"verdant_tonic",chance:0.2},{item:"gold",min:4,max:12,chance:0.4},{item:"venom_fang",chance:0.05}],
  sand_wraith:[{item:"blood_philter",chance:0.2},{item:"gold",min:6,max:16,chance:0.45}],
  dune_stalker:[{item:"blood_philter",chance:0.25},{item:"verdant_tonic",chance:0.15},{item:"gold",min:8,max:18,chance:0.5}],
  oasis_guardian:[{item:"blood_philter",chance:1.0,count:2},{item:"verdant_tonic",chance:1.0,count:3},{item:"gold",min:40,max:80,chance:1.0},{item:"frost_blade",chance:0.35}],
  // ═══════════════════════════════════════════════════════════════
  // ICE BIOME ENEMY LOOT
  // ═══════════════════════════════════════════════════════════════
  frost_wolf:[{item:"blood_philter",chance:0.2},{item:"gold",min:5,max:14,chance:0.45},{item:"frost_blade",chance:0.04}],
  ice_wraith:[{item:"blood_philter",chance:0.25},{item:"gold",min:8,max:18,chance:0.5},{item:"frost_blade",chance:0.08}],
  frozen_knight:[{item:"blood_philter",chance:0.3},{item:"verdant_tonic",chance:0.2},{item:"gold",min:10,max:25,chance:0.55}],
  snow_stalker:[{item:"gold",min:6,max:15,chance:0.4},{item:"verdant_tonic",chance:0.15}],
  crystal_golem:[{item:"blood_philter",chance:0.35},{item:"gold",min:15,max:35,chance:0.6},{item:"frost_blade",chance:0.12}],
  ice_titan:[{item:"blood_philter",chance:1.0,count:3},{item:"verdant_tonic",chance:1.0,count:2},{item:"gold",min:60,max:120,chance:1.0},{item:"frost_blade",chance:0.7}],
  // ═══════════════════════════════════════════════════════════════
  // VOLCANIC BIOME ENEMY LOOT
  // ═══════════════════════════════════════════════════════════════
  magma_hound:[{item:"blood_philter",chance:0.2},{item:"gold",min:6,max:16,chance:0.45},{item:"flame_brand",chance:0.05}],
  ember_wraith:[{item:"blood_philter",chance:0.25},{item:"gold",min:10,max:22,chance:0.5},{item:"flame_brand",chance:0.1}],
  obsidian_golem:[{item:"blood_philter",chance:0.4},{item:"verdant_tonic",chance:0.25},{item:"gold",min:18,max:40,chance:0.65}],
  flame_imp:[{item:"verdant_tonic",chance:0.2},{item:"gold",min:5,max:12,chance:0.4},{item:"flame_brand",chance:0.03}],
  ash_crawler:[{item:"gold",min:4,max:10,chance:0.35},{item:"blood_philter",chance:0.15}],
  infernal_lord:[{item:"blood_philter",chance:1.0,count:3},{item:"verdant_tonic",chance:1.0,count:3},{item:"gold",min:70,max:140,chance:1.0},{item:"flame_brand",chance:0.75}],
};

function generateLoot(enemyType){
  const table=LOOT_TABLES[enemyType];
  if(!table)return[];
  const drops=[];
  table.forEach(entry=>{
    if(Math.random()<entry.chance){
      if(entry.item==="gold"){
        const amount=entry.min+Math.floor(Math.random()*(entry.max-entry.min+1));
        drops.push({type:"gold",amount});
      }else{
        const count=entry.count||1;
        drops.push({type:"item",id:entry.item,count});
      }
    }
  });
  return drops;
}
const PLAYER_KB = 12; // knockback applied to player when hit
const HP_REGEN = 0.012; // passive health regen per frame (~0.7/sec)
const HP_REGEN_COMBAT_DELAY = 180; // frames before regen starts after taking damage

// ═══════════════════════════════════════════════════════════════
// SKILL TREE DEFINITIONS — 3 Paths + Ultimates
// ═══════════════════════════════════════════════════════════════
const SKILL_TREE = {
  warrior: {
    name: "Ashen Warrior", color: "#c44040", icon: "⚔",
    desc: "Raw power. Hit harder. Fear nothing.",
    skills: [
      { id:"w1",name:"Iron Grip",desc:"Increase weapon damage by 15%",cost:1,tier:1,effect:{dmgMult:0.15}},
      { id:"w2",name:"Heavy Strikes",desc:"Attacks have +25% knockback on enemies",cost:1,tier:2,effect:{kbMult:0.25},requires:"w1"},
      { id:"w3",name:"Bloodthirst",desc:"Heal 5 HP per enemy killed",cost:2,tier:3,effect:{killHeal:5},requires:"w2"},
      { id:"w4",name:"Savage Blow",desc:"20% chance for double damage strikes",cost:2,tier:4,effect:{critChance:0.20},requires:"w3"},
      { id:"w_ult",name:"Berserker Rage",desc:"ULTIMATE: Activate for 8s of 2× damage and life steal. 60s cooldown.",cost:3,tier:5,effect:{ultimate:"berserker"},requires:"w4",isUltimate:true},
    ]
  },
  shadow: {
    name: "Hollow Shadow", color: "#8b5cf6", icon: "◈",
    desc: "Speed and cunning. Strike from the dark.",
    skills: [
      { id:"s1",name:"Swift Feet",desc:"Move 12% faster",cost:1,tier:1,effect:{speedMult:0.12}},
      { id:"s2",name:"Evasion",desc:"15% chance to dodge attacks entirely",cost:1,tier:2,effect:{dodgeChance:0.15},requires:"s1"},
      { id:"s3",name:"Quick Recovery",desc:"Stamina regen increased by 40%",cost:2,tier:3,effect:{stamRegenMult:0.40},requires:"s2"},
      { id:"s4",name:"Lethal Precision",desc:"30% crit chance for 1.8× damage",cost:2,tier:4,effect:{critChance:0.30,critMult:0.8},requires:"s3"},
      { id:"s_ult",name:"Shadow Step",desc:"ULTIMATE: Teleport behind nearest enemy and stun for 3s. 45s cooldown.",cost:3,tier:5,effect:{ultimate:"shadowstep"},requires:"s4",isUltimate:true},
    ]
  },
  warden: {
    name: "Iron Warden", color: "#40a060", icon: "🛡",
    desc: "Endurance and resilience. Outlast everything.",
    skills: [
      { id:"d1",name:"Tough Hide",desc:"Reduce all damage taken by 15%",cost:1,tier:1,effect:{dmgReduce:0.15}},
      { id:"d2",name:"Second Wind",desc:"Double passive health regeneration",cost:1,tier:2,effect:{hpRegenMult:1.0},requires:"d1"},
      { id:"d3",name:"Fortify",desc:"Reduce knockback received by 50%",cost:2,tier:3,effect:{kbResist:0.50},requires:"d2"},
      { id:"d4",name:"Stalwart",desc:"Gain +20 max health",cost:2,tier:4,effect:{maxHpBonus:20},requires:"d3"},
      { id:"d_ult",name:"Iron Will",desc:"ULTIMATE: Become invulnerable for 5s and taunt nearby enemies. 60s cooldown.",cost:3,tier:5,effect:{ultimate:"ironwill"},requires:"d4",isUltimate:true},
    ]
  },
};

// ═══════════════════════════════════════════════════════════════
// TOWN NPCs
// ═══════════════════════════════════════════════════════════════
function createTownNPCs(){
  return [
    {id:"aldric",name:"Aldric",title:"Master Blacksmith",x:12*TILE,y:11*TILE,dir:2,
     tunic:"#8a4a20",hair:"#3a2010",isTrader:true,
     lines:["Well met, traveler. I'm Aldric, this city's blacksmith.","If you need a blade or armor, you've found your man.","Also, I could use help with some bandits who stole my ore..."],
     questId:"forge_ahead",
     shop:[
       {item:"iron_spear",price:45,stock:2},
       {item:"hunting_bow",price:55,stock:2},
       {item:"war_axe",price:40,stock:2},
       {item:"arrows",price:8,stock:10},
     ]},
    {id:"marta",name:"Marta",title:"Innkeeper",x:54*TILE,y:14*TILE,dir:2,
     tunic:"#6a3040",hair:"#5a3020",
     lines:["Welcome to the Ember Hearth! Warmest beds in Ashenmoor.","You look like you could use a rest... and maybe a stiff drink.","If you're staying, I could use a hand with something in the cellar."],
     questId:"cellar_spirits"},
    {id:"cedric",name:"Cedric",title:"Traveling Merchant",x:12*TILE,y:44*TILE,dir:1,
     tunic:"#2a5050",hair:"#2a1a10",
     lines:["Ah, a customer! Cedric's the name, rare goods are my trade.","I've wares from every corner of the realm... for the right price.","I need crystals from the caves, and a lost caravan in the desert..."],
     questId:"trade_routes",secondQuest:"lost_caravan"},
    {id:"aldren",name:"Captain Aldren",title:"Guard Captain",x:12*TILE,y:59*TILE,dir:1,
     tunic:"#3a3a5a",hair:"#1a1a20",
     lines:["Stand fast. I'm Captain Aldren of the Ashenmoor Guard.","Strange sightings beyond the eastern wall. Hollow shapes in the fog.","I need capable scouts. Also, scorpions in the desert are disrupting trade."],
     questId:"hollow_threat",secondQuest:"scorpion_threat"},
    {id:"osric",name:"Father Osric",title:"Cathedral Priest",x:60*TILE,y:48*TILE,dir:3,
     tunic:"#5a4a60",hair:"#8a8080",
     lines:["Blessings upon you, child. I am Father Osric.","The cathedral has stood for centuries, but lately... the relics stir.","The old graveyard is overrun with restless dead. And the catacombs below..."],
     questId:"restless_dead",secondQuest:"crypt_key"},
    {id:"miriam",name:"Elder Miriam",title:"Village Elder",x:29*TILE,y:14*TILE,dir:2,
     tunic:"#4a3a28",hair:"#a0a0a0",
     lines:["Ah, a new face. I am Miriam, elder of Ashenmoor.","This city has deep roots. Older than the kingdom itself.","There are ruins in the forest and desert... remnants of the old ways."],
     questId:"old_ways",secondQuest:"desert_ruins"},
    {id:"trader",name:"Helena",title:"Apothecary",x:66*TILE,y:26*TILE,dir:3,
     tunic:"#4a6a6a",hair:"#6a3a20",isTrader:true,
     lines:["Welcome, traveler! Helena's Remedies at your service.","I stock the finest tonics and philters this side of the mountains.","Browse my wares — you won't find better prices anywhere."],
     shop:[
       {item:"blood_philter",price:15,stock:5},
       {item:"verdant_tonic",price:12,stock:5},
       {item:"antidote",price:10,stock:3},
     ]},
    // New NPCs for graveyard/desert quests
    {id:"silas",name:"Silas",title:"Wanderer",x:40*TILE,y:66*TILE,dir:0,
     tunic:"#5a4a30",hair:"#4a3020",
     lines:["You... you have the look of someone who seeks danger.","I've wandered the Scorched Desert. There's an oasis out there... but it's guarded.","Something ancient protects those waters. If you're brave, or foolish... you might claim it."],
     questId:"oasis_guardian"},
    {id:"grim",name:"Hunter Grim",title:"Beast Hunter",x:8*TILE,y:28*TILE,dir:1,
     tunic:"#3a3a28",hair:"#2a2020",
     lines:["Name's Grim. I hunt things that hunt us.","There's an Alpha Wolf in the eastern Darkwood. Bigger than a man.","Bring me its head and I'll make it worth your while."],
     questId:"alpha_hunt"},
  ];
}

// ═══════════════════════════════════════════════════════════════
// QUEST DEFINITIONS
// ═══════════════════════════════════════════════════════════════
const QUEST_DEFS = {
  prologue:{id:"prologue",name:"The Ashen Relic",giver:"The Dying Knight",
    desc:"A dying knight in the ruined cathedral spoke of a relic hidden behind the altar. Find it before the Hollow Legion does.",
    objectives:["Find the dying knight in the cathedral","Listen to his final words","Retrieve the Ashen Relic from behind the altar"],
    status:"active",category:"main",gold:0},
  forge_ahead:{id:"forge_ahead",name:"Forged in Fire",giver:"Aldric",
    desc:"Aldric's shipment of star-iron was stolen by forest bandits. Infiltrate their camp in the Darkwood and recover the ore before they melt it down.",
    objectives:["Speak to Aldric","Travel to the Darkwood Forest (north exit)","Find the bandit camp and defeat the Bandit Chief","Return to Aldric with the ore"],
    status:"available",category:"side",gold:40,reward:"chain_mail"},
  cellar_spirits:{id:"cellar_spirits",name:"Whispers Below",giver:"Marta",
    desc:"Strange sounds echo from beneath the inn — not rats, something worse. Marta fears something crawled up from the old caves. Investigate the Hollow Caves and clear out whatever lurks there.",
    objectives:["Speak to Marta","Enter the Hollow Caves (via Darkwood east)","Slay 4 Cave Spiders in the depths","Return to Marta"],
    status:"available",category:"side",gold:35},
  trade_routes:{id:"trade_routes",name:"The Merchant's Gambit",giver:"Cedric",
    desc:"Cedric needs rare glowing crystals from the Hollow Caves for his trade caravan. He'll pay handsomely, but the caves are dangerous.",
    objectives:["Accept Cedric's offer","Enter the Hollow Caves","Find the Crystal Chamber (east cave)","Return to Cedric"],
    status:"available",category:"side",gold:45},
  hollow_threat:{id:"hollow_threat",name:"Wolves at the Gate",giver:"Captain Aldren",
    desc:"Timber wolves have been prowling closer to town. Captain Aldren needs you to thin their numbers in the Darkwood before they become a real threat.",
    objectives:["Report to Captain Aldren","Travel to the Darkwood Forest","Slay 3 Timber Wolves","Return with your report"],
    status:"available",category:"side",gold:30},
  sacred_relics:{id:"sacred_relics",name:"The Deep Shrine",giver:"Father Osric",
    desc:"Father Osric senses a holy resonance from deep within the caves — an old shrine predating the cathedral. He needs you to find it and light its candles.",
    objectives:["Speak with Father Osric","Enter the Hollow Caves","Find the old shrine (north cave chamber)","Return to Father Osric"],
    status:"available",category:"side",gold:30},
  old_ways:{id:"old_ways",name:"The Forest Shrine",giver:"Elder Miriam",
    desc:"Elder Miriam speaks of a moss-covered shrine hidden in the Darkwood, a relic of the old religion. She needs you to find it and report what you see.",
    objectives:["Accept Miriam's request","Travel to the Darkwood Forest","Find the moss stone shrine (northeast clearing)","Return to Elder Miriam"],
    status:"available",category:"side",gold:35},
  // New quests
  alpha_hunt:{id:"alpha_hunt",name:"The Pack Leader",giver:"Hunter Grim",
    desc:"The wolves are growing bold because a massive Alpha leads them. Hunter Grim knows its lair in the deep woods. Bring him its head.",
    objectives:["Speak to Hunter Grim","Track the Alpha Wolf to the eastern Darkwood","Slay the Alpha Wolf","Claim your bounty"],
    status:"available",category:"side",gold:75,reward:"serrated_dagger"},
  spider_depths:{id:"spider_depths",name:"Queen of the Dark",giver:"Marta",
    desc:"The cave spiders keep coming because their Queen still lives in the deepest chamber. Only by slaying the Spider Queen will the threat truly end.",
    objectives:["Return to Marta after clearing spiders","Enter the Hollow Caves' deepest chamber","Slay the Spider Queen","Bring proof back to Marta"],
    status:"locked",category:"side",gold:100,reward:"venom_fang",requires:"cellar_spirits"},
  catacombs:{id:"catacombs",name:"Into the Catacombs",giver:"Father Osric",
    desc:"Father Osric has discovered an entrance to ancient catacombs beneath the ruined cathedral. The dead do not rest easy there. Something must be done.",
    objectives:["Speak with Father Osric about the catacombs","Enter the Catacombs (beneath cathedral altar)","Explore the undead-infested depths","Report your findings"],
    status:"available",category:"main",gold:60},
  hollow_lord:{id:"hollow_lord",name:"The Hollow Lord",giver:"Father Osric",
    desc:"Deep in the catacombs lies the Hollow Lord, an ancient evil that commands the undead. He must be destroyed to end the threat forever.",
    objectives:["Descend into the Catacombs","Fight through the undead","Confront the Hollow Lord in his sanctum","End the threat once and for all"],
    status:"locked",category:"main",gold:150,reward:"flame_brand",requires:"catacombs"},
  // Graveyard quests
  restless_dead:{id:"restless_dead",name:"Restless Spirits",giver:"Father Osric",
    desc:"The old graveyard east of town has become overrun with restless dead. The souls cannot find peace. Clear the graveyard of these tormented spirits.",
    objectives:["Speak with Father Osric","Travel to the Old Graveyard (town east exit)","Slay 6 undead in the graveyard","Return to Father Osric"],
    status:"available",category:"side",gold:45,reward:"bone_charm"},
  grave_robbers:{id:"grave_robbers",name:"Defiled Ground",giver:"Grave Keeper Mortis",
    desc:"Someone — or something — has been desecrating the graves. Grave Keeper Mortis suspects cultists are responsible. Find evidence of their rituals.",
    objectives:["Find Mortis in the graveyard","Investigate the disturbed graves","Find the cultist altar near the mausoleum","Report to Mortis"],
    status:"available",category:"side",gold:40},
  crypt_key:{id:"crypt_key",name:"Key to the Depths",giver:"Grave Keeper Mortis",
    desc:"The catacombs beneath the graveyard were sealed long ago. Mortis knows where the key is hidden — in the angel statue's base. But the dead guard it jealously.",
    objectives:["Accept Mortis's task","Defeat the guardians near the angel statues","Retrieve the Crypt Key","Open the catacombs entrance"],
    status:"available",category:"main",gold:50},
  // Desert quests  
  oasis_guardian:{id:"oasis_guardian",name:"Guardian of the Oasis",giver:"Wanderer Silas",
    desc:"A wanderer named Silas camps near the town's southern gate. He speaks of a hidden oasis in the Scorched Desert, but something ancient guards its waters.",
    objectives:["Find Silas near the south gate","Travel to the Scorched Desert","Locate the oasis","Defeat the Oasis Guardian"],
    status:"available",category:"side",gold:55,reward:"verdant_tonic"},
  lost_caravan:{id:"lost_caravan",name:"The Lost Caravan",giver:"Cedric",
    desc:"Cedric's trade partner vanished crossing the desert weeks ago. His caravan was carrying valuable goods. Find what remains and return anything of value.",
    objectives:["Accept Cedric's request","Enter the Scorched Desert","Find the ruined caravan in the eastern dunes","Return the trade ledger to Cedric"],
    status:"available",category:"side",gold:60},
  desert_ruins:{id:"desert_ruins",name:"Echoes of the Ancients",giver:"Elder Miriam",
    desc:"Elder Miriam has heard tales of ancient ruins in the desert — temples from before the kingdom's founding. She wants you to explore them and document what you find.",
    objectives:["Speak with Elder Miriam","Travel to the Scorched Desert","Explore both ruined structures","Return with your findings"],
    status:"available",category:"side",gold:50,reward:"sigil_ring"},
  scorpion_threat:{id:"scorpion_threat",name:"Sting of the Sands",giver:"Captain Aldren",
    desc:"Giant scorpions have been spotted in the desert, and caravans are refusing to travel. Thin their numbers so trade can resume.",
    objectives:["Report to Captain Aldren","Enter the Scorched Desert","Slay 4 Desert Scorpions","Return with proof"],
    status:"available",category:"side",gold:40},
};

// ═══════════════════════════════════════════════════════════════
// ENEMIES
// ═══════════════════════════════════════════════════════════════
function createEnemies() {
  return [
    {id:0,x:28*TILE,y:65*TILE,hp:30,maxHp:30,type:"hollow",speed:0.8,dir:2,frame:0,aggroRange:150,atkRange:42,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,returning:false,homeX:28*TILE,homeY:65*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,patrol:{cx:28*TILE,cy:65*TILE,r:60,a:0}},
    {id:1,x:32*TILE,y:58*TILE,hp:30,maxHp:30,type:"hollow",speed:0.9,dir:3,frame:0,aggroRange:140,atkRange:42,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,returning:false,homeX:32*TILE,homeY:58*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,patrol:{cx:32*TILE,cy:58*TILE,r:50,a:Math.PI}},
    {id:2,x:25*TILE,y:48*TILE,hp:40,maxHp:40,type:"hollow_knight",speed:0.7,dir:2,frame:0,aggroRange:170,atkRange:48,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,returning:false,homeX:25*TILE,homeY:48*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,patrol:{cx:25*TILE,cy:48*TILE,r:70,a:0.5}},
    {id:3,x:35*TILE,y:44*TILE,hp:30,maxHp:30,type:"hollow",speed:0.85,dir:1,frame:0,aggroRange:130,atkRange:42,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,returning:false,homeX:35*TILE,homeY:44*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,patrol:{cx:35*TILE,cy:44*TILE,r:55,a:2}},
    {id:4,x:30*TILE,y:36*TILE,hp:40,maxHp:40,type:"hollow_knight",speed:0.75,dir:0,frame:0,aggroRange:160,atkRange:48,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,returning:false,homeX:30*TILE,homeY:36*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,patrol:{cx:30*TILE,cy:36*TILE,r:40,a:3}},
    {id:5,x:22*TILE,y:55*TILE,hp:25,maxHp:25,type:"hollow",speed:1.0,dir:1,frame:0,aggroRange:120,atkRange:40,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,returning:false,homeX:22*TILE,homeY:55*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,patrol:{cx:22*TILE,cy:55*TILE,r:45,a:1}},
  ];
}

function makeEnemy(id,x,y,type,opts={}){
  const defaults={hollow:{hp:30,speed:0.8,aggroRange:150,atkRange:42},hollow_knight:{hp:40,speed:0.7,aggroRange:170,atkRange:48},
    timber_wolf:{hp:25,speed:1.3,aggroRange:180,atkRange:44},forest_bandit:{hp:35,speed:0.9,aggroRange:160,atkRange:44},
    bandit_chief:{hp:65,speed:0.75,aggroRange:200,atkRange:50},cave_spider:{hp:28,speed:1.1,aggroRange:140,atkRange:40},
    cave_lurker:{hp:55,speed:0.65,aggroRange:190,atkRange:50},
    // New enemy types
    skeleton_archer:{hp:22,speed:0.6,aggroRange:220,atkRange:180},
    shadow_wraith:{hp:45,speed:0.7,aggroRange:200,atkRange:60},
    fire_elemental:{hp:40,speed:0.8,aggroRange:160,atkRange:50},
    poison_slime:{hp:35,speed:0.5,aggroRange:120,atkRange:38},
    frost_shade:{hp:38,speed:0.75,aggroRange:170,atkRange:45},
    // Graveyard enemies
    grave_zombie:{hp:32,speed:0.6,aggroRange:130,atkRange:42},
    restless_spirit:{hp:28,speed:0.85,aggroRange:160,atkRange:50},
    bone_guard:{hp:50,speed:0.55,aggroRange:140,atkRange:46},
    // Desert enemies
    desert_scorpion:{hp:30,speed:1.0,aggroRange:150,atkRange:44},
    sand_wraith:{hp:35,speed:0.9,aggroRange:170,atkRange:48},
    dune_stalker:{hp:42,speed:0.8,aggroRange:180,atkRange:46},
    // Bosses
    hollow_lord:{hp:300,speed:0.55,aggroRange:280,atkRange:55},
    alpha_wolf:{hp:200,speed:0.9,aggroRange:260,atkRange:50},
    spider_queen:{hp:250,speed:0.5,aggroRange:240,atkRange:48},
    oasis_guardian:{hp:220,speed:0.65,aggroRange:250,atkRange:52}};
  const d=defaults[type]||defaults.hollow;
  const baseSpeed=d.speed;
  const info=ENEMY_INFO[type]||{};
  return {id,x:x*TILE,y:y*TILE,hp:opts.hp||d.hp,maxHp:opts.hp||d.hp,type,speed:d.speed,baseSpeed,dir:2,frame:0,
    aggroRange:d.aggroRange,atkRange:d.atkRange,atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,
    returning:false,homeX:x*TILE,homeY:y*TILE,aggroTimer:0,specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,
    enraged:false,wasEnraged:false,speedBuff:0,teleportCd:0,rangedCd:0,
    isRanged:info.isRanged||false,canTeleport:info.canTeleport||false,appliesEffect:info.appliesEffect||null,
    patrol:{cx:x*TILE,cy:y*TILE,r:opts.r||50,a:Math.random()*Math.PI*2}};
}

function createForestEnemies(){
  return [
    makeEnemy(0,20,20,"timber_wolf",{r:60}),makeEnemy(1,35,15,"timber_wolf",{r:70}),
    makeEnemy(2,50,25,"timber_wolf",{r:55}),makeEnemy(3,15,40,"timber_wolf",{r:45}),
    makeEnemy(4,28,35,"forest_bandit",{r:40}),makeEnemy(5,32,38,"forest_bandit",{r:35}),
    makeEnemy(6,30,32,"forest_bandit",{r:30}),makeEnemy(7,35,35,"bandit_chief",{r:25,hp:65}),
    makeEnemy(8,55,45,"timber_wolf",{r:65}),makeEnemy(9,10,55,"forest_bandit",{r:50}),
    makeEnemy(10,45,50,"timber_wolf",{r:60}),
    // Ranged bandits
    makeEnemy(11,40,30,"skeleton_archer",{r:35}),makeEnemy(12,25,50,"skeleton_archer",{r:40}),
    // Wolf pack with alpha
    makeEnemy(13,60,35,"timber_wolf",{r:50}),makeEnemy(14,62,38,"timber_wolf",{r:45}),
    makeEnemy(15,58,40,"alpha_wolf",{r:30}), // Mini-boss
  ];
}

function createCaveEnemies(){
  return [
    makeEnemy(0,15,12,"cave_spider",{r:40}),makeEnemy(1,25,15,"cave_spider",{r:35}),
    makeEnemy(2,10,25,"cave_spider",{r:45}),makeEnemy(3,30,28,"cave_spider",{r:30}),
    makeEnemy(4,20,35,"cave_lurker",{r:25}),makeEnemy(5,35,20,"cave_lurker",{r:30}),
    makeEnemy(6,25,42,"cave_spider",{r:50}),makeEnemy(7,15,48,"cave_lurker",{r:35}),
    makeEnemy(8,38,45,"cave_spider",{r:40}),
    // New special enemies
    makeEnemy(9,28,38,"poison_slime",{r:35}),makeEnemy(10,12,32,"poison_slime",{r:30}),
    makeEnemy(11,40,30,"shadow_wraith",{r:25}), // Teleporter in dark cave
    makeEnemy(12,22,50,"fire_elemental",{r:30}), // Near lava area
    // Spider Queen's lair
    makeEnemy(13,30,55,"cave_spider",{r:40}),makeEnemy(14,35,55,"cave_spider",{r:35}),
    makeEnemy(15,32,58,"spider_queen",{r:25}), // Boss
  ];
}

function createCryptEnemies(){
  return [
    // Entry area
    makeEnemy(0,20,6,"hollow",{r:30}),
    makeEnemy(1,24,8,"skeleton_archer",{r:25}), // Ranged enemy
    // West wing - undead and wraiths
    makeEnemy(2,10,12,"hollow",{r:35}),makeEnemy(3,14,16,"hollow_knight",{r:30}),
    makeEnemy(4,8,18,"shadow_wraith",{r:30}), // Teleporting enemy
    // East wing - skeletons  
    makeEnemy(5,30,14,"skeleton_archer",{r:35}),makeEnemy(6,34,16,"hollow",{r:30}),
    makeEnemy(7,36,12,"skeleton_archer",{r:25}),
    // Central hall - mixed
    makeEnemy(8,16,28,"hollow_knight",{r:40}),makeEnemy(9,28,30,"hollow_knight",{r:35}),
    makeEnemy(10,22,26,"shadow_wraith",{r:30}),makeEnemy(11,22,32,"hollow",{r:30}),
    makeEnemy(12,18,30,"skeleton_archer",{r:25}),
    // Boss corridor
    makeEnemy(13,22,36,"hollow_knight",{r:25}),makeEnemy(14,18,38,"shadow_wraith",{r:20}),
    // Boss arena guards
    makeEnemy(15,14,42,"hollow_knight",{r:35}),makeEnemy(16,30,42,"hollow_knight",{r:35}),
    makeEnemy(17,20,40,"skeleton_archer",{r:30}),makeEnemy(18,24,40,"skeleton_archer",{r:30}),
    // BOSS: Hollow Lord at sarcophagus
    makeEnemy(19,22,44,"hollow_lord",{r:20}),
  ];
}

function createGraveyardEnemies(){
  return [
    // Scattered undead among graves
    makeEnemy(0,10,10,"grave_zombie",{r:40}),makeEnemy(1,12,30,"grave_zombie",{r:35}),
    makeEnemy(2,30,10,"skeleton_archer",{r:30}),makeEnemy(3,32,35,"grave_zombie",{r:40}),
    makeEnemy(4,20,15,"bone_guard",{r:35}),makeEnemy(5,25,25,"restless_spirit",{r:30}),
    // Near mausoleum
    makeEnemy(6,12,35,"bone_guard",{r:30}),makeEnemy(7,14,38,"skeleton_archer",{r:25}),
    makeEnemy(8,38,12,"restless_spirit",{r:30}),
    // Near crypt entrance
    makeEnemy(9,28,28,"bone_guard",{r:30}),makeEnemy(10,35,26,"grave_zombie",{r:35}),
    makeEnemy(11,22,32,"restless_spirit",{r:25}),
  ];
}

function createDesertEnemies(){
  return [
    // Scattered across dunes
    makeEnemy(0,12,20,"desert_scorpion",{r:50}),makeEnemy(1,18,45,"desert_scorpion",{r:45}),
    makeEnemy(2,30,15,"dune_stalker",{r:60}),makeEnemy(3,35,40,"dune_stalker",{r:55}),
    makeEnemy(4,45,25,"desert_scorpion",{r:50}),makeEnemy(5,50,35,"sand_wraith",{r:45}),
    // Near ruins
    makeEnemy(6,28,12,"sand_wraith",{r:40}),makeEnemy(7,30,48,"dune_stalker",{r:35}),
    makeEnemy(8,10,40,"desert_scorpion",{r:45}),
    // Oasis area - boss
    makeEnemy(9,22,28,"desert_scorpion",{r:45}),makeEnemy(10,28,32,"sand_wraith",{r:40}),
    makeEnemy(11,25,30,"oasis_guardian",{r:20}), // Mini-boss at oasis
  ];
}

// ═══════════════════════════════════════════════════════════════
// ICE BIOME ENEMIES
// ═══════════════════════════════════════════════════════════════
function createIceEnemies(){
  return [
    // Entrance area
    makeEnemy(0,12,55,"frost_wolf",{r:50}),makeEnemy(1,18,52,"frost_wolf",{r:45}),
    makeEnemy(2,25,58,"snow_stalker",{r:40}),
    // Mid-field
    makeEnemy(3,35,45,"frost_wolf",{r:55}),makeEnemy(4,42,48,"frozen_knight",{r:35}),
    makeEnemy(5,15,40,"ice_wraith",{r:30}),makeEnemy(6,28,42,"snow_stalker",{r:45}),
    // Frozen lake area
    makeEnemy(7,30,25,"frost_wolf",{r:50}),makeEnemy(8,38,22,"frost_wolf",{r:45}),
    makeEnemy(9,25,20,"crystal_golem",{r:25}),
    // Boss approach
    makeEnemy(10,30,15,"frozen_knight",{r:40}),makeEnemy(11,22,12,"ice_wraith",{r:30}),
    makeEnemy(12,38,12,"frozen_knight",{r:35}),
    // Boss arena
    makeEnemy(13,25,55,"frozen_knight",{r:30}),makeEnemy(14,35,55,"frozen_knight",{r:30}),
    makeEnemy(15,30,56,"ice_titan",{r:15}), // BOSS
  ];
}

// ═══════════════════════════════════════════════════════════════
// VOLCANIC BIOME ENEMIES
// ═══════════════════════════════════════════════════════════════
function createVolcanicEnemies(){
  return [
    // Entrance area
    makeEnemy(0,30,6,"ash_crawler",{r:45}),makeEnemy(1,35,8,"ash_crawler",{r:40}),
    makeEnemy(2,25,10,"magma_hound",{r:50}),
    // Lava fields
    makeEnemy(3,15,18,"magma_hound",{r:55}),makeEnemy(4,40,20,"flame_imp",{r:35}),
    makeEnemy(5,22,22,"ember_wraith",{r:30}),makeEnemy(6,48,25,"ash_crawler",{r:45}),
    // Central area
    makeEnemy(7,30,28,"magma_hound",{r:50}),makeEnemy(8,38,32,"obsidian_golem",{r:25}),
    makeEnemy(9,20,35,"flame_imp",{r:40}),makeEnemy(10,45,35,"ember_wraith",{r:30}),
    // Boss approach
    makeEnemy(11,25,42,"magma_hound",{r:45}),makeEnemy(12,35,42,"obsidian_golem",{r:30}),
    makeEnemy(13,30,45,"flame_imp",{r:35}),
    // Boss arena
    makeEnemy(14,22,52,"obsidian_golem",{r:25}),makeEnemy(15,38,52,"obsidian_golem",{r:25}),
    makeEnemy(16,30,55,"infernal_lord",{r:15}), // BOSS
  ];
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — ASHEN CITY (same as before)
// ═══════════════════════════════════════════════════════════════
function generateRuinMap() {
  const W=60,H=80;
  const m=Array.from({length:H},()=>Array(W).fill(T.VOID));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};
  const rect=(x,y,w,h,t)=>{for(let i=x;i<x+w&&i<W;i++){if(y>=0&&y<H)m[y][i]=t;if(y+h-1>=0&&y+h-1<H)m[y+h-1][i]=t;}for(let j=y;j<y+h&&j<H;j++){if(x>=0&&x<W)m[j][x]=t;if(x+w-1>=0&&x+w-1<W)m[j][x+w-1]=t;}};
  const scatter=(x,y,w,h,t,ch)=>{for(let j=y;j<y+h&&j<H;j++)for(let i=x;i<x+w&&i<W;i++)if(Math.random()<ch&&!SOLID.has(m[j][i])&&m[j][i]!==T.VOID)m[j][i]=t;};

  fill(15,71,30,8,T.COBBLE);fill(18,72,24,6,T.COBBLE_DARK);
  m[71][18]=T.PILLAR;m[71][38]=T.PILLAR;m[71][19]=T.IRON_FENCE;m[71][37]=T.IRON_FENCE;
  fill(10,70,8,2,T.WALL);fill(38,70,12,2,T.WALL);fill(10,72,5,6,T.WALL_BROKEN);fill(42,72,5,6,T.WALL_BROKEN);
  scatter(16,72,5,5,T.RUBBLE,0.3);scatter(35,72,6,5,T.RUBBLE,0.25);
  m[74][20]=T.CART_WRECK;m[75][21]=T.BARREL;m[73][36]=T.BARREL;m[73][37]=T.CRATE;
  m[75][25]=T.BONE_PILE;m[74][33]=T.BONE_PILE;m[76][30]=T.WEAPON_RACK;
  scatter(18,73,20,4,T.ASH,0.15);
  // Torches on the pillars at gate entrance
  m[72][18]=T.TORCH_WALL;m[72][38]=T.TORCH_WALL;

  fill(20,50,20,21,T.COBBLE);fill(22,50,16,21,T.COBBLE_DARK);
  rect(10,62,10,8,T.WALL);fill(11,63,8,6,T.FOUNDATION);m[63][13]=T.BURNT_WOOD;m[64][15]=T.BURNT_WOOD;
  fill(11,63,4,3,T.COLLAPSED_ROOF);m[69][14]=T.DOOR_CLOSED;m[62][12]=T.TORCH_WALL;
  rect(10,52,10,8,T.WALL);fill(11,53,8,6,T.FOUNDATION);m[56][14]=T.BARREL;m[54][16]=T.CRATE;
  scatter(11,53,8,6,T.RUBBLE,0.2);m[59][15]=T.DOOR_BROKEN;m[52][14]=T.WINDOW_BROKEN;
  rect(40,60,10,8,T.WALL);fill(41,61,8,6,T.FOUNDATION);fill(43,62,5,3,T.COLLAPSED_ROOF);
  m[67][44]=T.DOOR_CLOSED;m[63][42]=T.WEAPON_RACK;m[60][43]=T.TORCH_WALL;
  rect(40,52,10,7,T.WALL);fill(41,53,8,5,T.FOUNDATION);m[58][44]=T.DOOR_BROKEN;
  m[55][43]=T.BARREL;m[54][45]=T.BARREL;scatter(41,53,8,5,T.DEBRIS,0.2);
  m[68][28]=T.CART_WRECK;m[67][29]=T.RUBBLE;m[64][25]=T.GALLOWS;m[64][26]=T.HANGING_BODY;
  m[60][30]=T.WELL;m[55][24]=T.STATUE_BROKEN;
  scatter(22,55,14,14,T.ASH,0.08);scatter(22,58,14,10,T.EMBER_GROUND,0.06);
  m[57][28]=T.WATER_PUDDLE;m[66][23]=T.WATER_PUDDLE;m[63][31]=T.WATER_PUDDLE;
  m[56][29]=T.BLOOD;m[55][27]=T.BLOOD;m[53][30]=T.BLOOD;
  m[65][22]=T.EMBER_GROUND;m[65][36]=T.EMBER_GROUND;m[55][22]=T.EMBER_GROUND;m[55][36]=T.EMBER_GROUND;

  fill(16,42,28,11,T.COBBLE);fill(18,43,24,9,T.COBBLE_DARK);
  m[47][30]=T.STATUE_BROKEN;fill(28,46,5,3,T.WATER_PUDDLE);
  m[44][22]=T.BONE_PILE;m[45][35]=T.BONE_PILE;m[48][20]=T.BONE_PILE;m[43][38]=T.BONE_PILE;
  m[46][24]=T.BLOOD;m[47][25]=T.BLOOD;m[44][33]=T.BLOOD;m[49][30]=T.BLOOD;
  m[45][28]=T.BLOOD_POOL;m[48][34]=T.BLOOD_POOL;
  scatter(18,43,24,9,T.RUBBLE,0.1);scatter(18,43,24,9,T.ASH,0.08);
  fill(10,42,6,10,T.WALL_BROKEN);fill(44,42,6,10,T.WALL_BROKEN);
  m[42][15]=T.TORCH_WALL;m[42][44]=T.TORCH_WALL;m[43][15]=T.BANNER_TORN;m[43][44]=T.BANNER_TORN;
  m[50][19]=T.CART_WRECK;m[43][42]=T.CART_WRECK;

  fill(22,30,16,13,T.COBBLE);fill(24,31,12,11,T.COBBLE_DARK);
  fill(14,32,8,8,T.WALL_BROKEN);fill(38,32,8,8,T.WALL_BROKEN);
  [[40,29],[39,29],[38,30],[37,30],[36,29],[35,29],[34,30],[33,30],[32,29],[31,29]].forEach(([y,x])=>{if(y<H&&x<W)m[y][x]=T.BLOOD_TRAIL;});
  m[38][28]=T.BLOOD;m[36][31]=T.BLOOD;m[34][28]=T.BLOOD;m[32][31]=T.BLOOD;
  scatter(23,32,14,8,T.RUBBLE,0.12);m[35][25]=T.PILLAR_BROKEN;m[37][34]=T.PILLAR_BROKEN;
  m[34][24]=T.CHAIN;m[36][36]=T.CHAIN;m[33][35]=T.BONE_PILE;
  m[32][14]=T.TORCH_WALL;m[32][38]=T.TORCH_WALL;

  fill(23,26,14,6,T.COBBLE_DARK);m[26][24]=T.PILLAR;m[26][36]=T.PILLAR;m[28][24]=T.PILLAR;m[28][36]=T.PILLAR;
  fill(25,26,10,2,T.ARCH);m[30][29]=T.BLOOD_TRAIL;m[29][30]=T.BLOOD_TRAIL;m[28][29]=T.BLOOD_TRAIL;m[27][30]=T.BLOOD_TRAIL;

  rect(18,6,24,21,T.WALL);fill(19,7,22,19,T.CATHEDRAL_FLOOR);fill(28,8,4,18,T.CARPET_RED);
  [[25,29],[24,30],[23,29],[22,30],[21,29],[20,29],[19,30],[18,29],[17,30],[16,29],[15,30],[14,29],[13,30],[12,29],[11,30]].forEach(([y,x])=>{if(y<H&&x<W)m[y][x]=T.BLOOD_TRAIL;});
  fill(27,9,6,3,T.BLOOD_POOL);
  for(let r=14;r<=22;r+=2){m[r][21]=T.PEW;m[r][22]=T.PEW;m[r][24]=T.PEW;m[r][25]=T.PEW;m[r][34]=r<18?T.PEW_BROKEN:T.PEW;m[r][35]=r<18?T.PEW_BROKEN:T.PEW;m[r][37]=T.PEW;m[r][38]=T.PEW;}
  for(let r=10;r<=22;r+=4){m[r][20]=T.PILLAR;m[r][39]=T.PILLAR;}m[14][20]=T.PILLAR_BROKEN;
  fill(19,7,1,19,T.COBBLE_DARK);fill(40,7,1,19,T.COBBLE_DARK);
  for(let r=9;r<=23;r+=3){m[r][18]=T.STAINED_GLASS;m[r][41]=T.STAINED_GLASS;}
  m[10][19]=T.TORCH_WALL;m[16][19]=T.TORCH_WALL;m[22][19]=T.TORCH_WALL;
  m[10][40]=T.TORCH_WALL;m[16][40]=T.TORCH_WALL;m[22][40]=T.TORCH_WALL;
  m[10][27]=T.CANDLE;m[10][32]=T.CANDLE;m[8][26]=T.CANDLE;m[8][33]=T.CANDLE;
  fill(26,8,8,2,T.ALTAR);m[8][30]=T.RELIC;
  fill(34,8,5,5,T.COLLAPSED_ROOF);scatter(19,7,6,8,T.RUBBLE,0.15);
  m[9][22]=T.BONE_PILE;m[12][37]=T.DEBRIS;m[26][29]=T.CATHEDRAL_FLOOR;m[26][30]=T.CATHEDRAL_FLOOR;
  // Destructible jars
  m[64][22]=T.JAR;m[64][36]=T.JAR;m[56][16]=T.JAR;m[53][43]=T.JAR;
  m[45][21]=T.JAR;m[45][38]=T.JAR;m[38][25]=T.JAR;m[38][34]=T.JAR;
  m[12][22]=T.JAR;m[12][36]=T.JAR;m[18][30]=T.JAR;
  // Bonfires (save points)
  m[70][30]=T.BONFIRE; // Near entrance
  m[32][30]=T.BONFIRE; // Before cathedral

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — LIVING TOWN (Expanded)
// ═══════════════════════════════════════════════════════════════
function generateTownMap() {
  const W=80,H=80;
  const m=Array.from({length:H},()=>Array(W).fill(T.VOID));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};
  const rect=(x,y,w,h,t)=>{for(let i=x;i<Math.min(x+w,W);i++){if(y>=0&&y<H)m[y][i]=t;if(y+h-1>=0&&y+h-1<H)m[y+h-1][i]=t;}for(let j=y;j<Math.min(y+h,H);j++){if(x>=0&&x<W)m[j][x]=t;if(x+w-1>=0&&x+w-1<W)m[j][x+w-1]=t;}};

  // Grass base
  fill(1,1,W-2,H-2,T.GRASS);
  fill(1,1,W-2,3,T.GRASS_DARK);fill(1,H-4,W-2,3,T.GRASS_DARK);
  fill(1,1,3,H-2,T.GRASS_DARK);fill(W-4,1,3,H-2,T.GRASS_DARK);
  // Clear exit paths - wide north path (y=1-6, x=34-45)
  fill(34,1,12,6,T.GRASS);

  for(let i=0;i<80;i++){const x=3+Math.floor(Math.random()*(W-6)),y=6+Math.floor(Math.random()*(H-9));if(m[y][x]===T.GRASS)m[y][x]=T.FLOWER;}
  for(let i=3;i<W-3;i+=4){if(i<34||i>45)m[2][i]=T.TREE;m[H-3][i]=T.TREE;}
  // North exit path to forest - wide clear corridor
  fill(36,1,8,6,T.COBBLE_CLEAN);fill(38,1,4,6,T.PATH);
  m[6][34]=T.LAMP_POST;m[6][45]=T.LAMP_POST; // Lamps far outside path
  m[7][39]=T.SIGN_POST; // Sign well south of exit zone
  for(let j=8;j<H-3;j+=4){m[j][2]=T.TREE;m[j][W-3]=T.TREE;}

  // === MAIN ROADS ===
  fill(4,38,W-8,3,T.COBBLE_CLEAN);fill(4,39,W-8,1,T.PATH);
  fill(39,4,3,H-8,T.COBBLE_CLEAN);fill(40,4,1,H-8,T.PATH);
  fill(18,22,24,2,T.COBBLE_CLEAN);fill(48,22,20,2,T.COBBLE_CLEAN);
  fill(18,54,50,2,T.COBBLE_CLEAN);
  fill(18,22,2,32,T.COBBLE_CLEAN);fill(66,22,2,34,T.COBBLE_CLEAN);

  for(let i=8;i<W-6;i+=6){m[37][i]=T.LAMP_POST;m[41][i]=T.LAMP_POST;}
  for(let j=8;j<H-6;j+=6){m[j][38]=T.LAMP_POST;m[j][42]=T.LAMP_POST;}

  // === TOWN SQUARE ===
  fill(32,32,16,12,T.COBBLE_CLEAN);fill(34,34,12,8,T.COBBLE_CLEAN);
  m[37][40]=T.FOUNTAIN;m[37][39]=T.FOUNTAIN;m[38][40]=T.FOUNTAIN;m[38][39]=T.FOUNTAIN;
  m[33][34]=T.BENCH;m[33][44]=T.BENCH;m[42][34]=T.BENCH;m[42][44]=T.BENCH;
  m[33][38]=T.PLANTER;m[33][41]=T.PLANTER;m[42][38]=T.PLANTER;m[42][41]=T.PLANTER;
  m[32][35]=T.BANNER;m[32][44]=T.BANNER;
  m[35][40]=T.STATUE_INTACT;
  m[34][36]=T.SIGN_POST;

  // === BUILDINGS ===
  // Blacksmith (upper left)
  rect(8,8,10,8,T.WALL);fill(9,9,8,6,T.WOOD_FLOOR);
  m[15][12]=T.DOOR_CLOSED;m[8][11]=T.TORCH_WALL;m[8][15]=T.TORCH_WALL;
  m[8][10]=T.WINDOW;m[8][16]=T.WINDOW;m[10][10]=T.WEAPON_RACK;fill(9,9,2,2,T.CHIMNEY);

  // Inn (upper right)
  rect(48,8,16,12,T.WALL);fill(49,9,14,10,T.WOOD_FLOOR);
  fill(53,10,6,6,T.CARPET);m[19][54]=T.DOOR_CLOSED;
  m[8][51]=T.TORCH_WALL;m[8][58]=T.TORCH_WALL;m[8][52]=T.WINDOW;m[8][60]=T.WINDOW;
  m[10][50]=T.BARREL;m[10][51]=T.BARREL;m[12][61]=T.CRATE;m[14][50]=T.BENCH;

  // Market row (left side)
  rect(8,24,10,6,T.WALL);fill(9,25,8,4,T.WOOD_FLOOR);
  m[29][12]=T.DOOR_CLOSED;m[24][11]=T.TORCH_WALL;m[24][10]=T.WINDOW;
  m[26][10]=T.MARKET_STALL;m[26][14]=T.MARKET_STALL;

  // Bakery (near market)
  rect(22,24,10,6,T.WALL);fill(23,25,8,4,T.WOOD_FLOOR);
  m[29][26]=T.DOOR_CLOSED;m[24][25]=T.TORCH_WALL;m[24][29]=T.WINDOW;m[26][24]=T.BARREL;m[26][30]=T.CRATE;

  // Merchant shop (left of square)
  rect(8,40,10,8,T.WALL);fill(9,41,8,6,T.WOOD_FLOOR);
  m[47][12]=T.DOOR_CLOSED;m[40][11]=T.TORCH_WALL;m[40][15]=T.WINDOW;
  m[42][10]=T.CRATE;m[42][14]=T.BARREL;m[44][10]=T.MARKET_STALL;

  // Large house (upper center)
  rect(24,10,12,8,T.WALL);fill(25,11,10,6,T.WOOD_FLOOR);
  fill(28,12,4,3,T.CARPET);m[17][28]=T.DOOR_CLOSED;
  m[10][27]=T.TORCH_WALL;m[10][33]=T.TORCH_WALL;m[10][26]=T.WINDOW;m[10][34]=T.WINDOW;

  // Cathedral (right side - large)
  rect(52,40,18,16,T.WALL);fill(53,41,16,14,T.CATHEDRAL_FLOOR);
  fill(58,42,6,12,T.CARPET_RED);m[55][61]=T.DOOR_CLOSED;
  // Torches on top wall and side walls
  m[40][55]=T.TORCH_WALL;m[40][66]=T.TORCH_WALL;
  m[44][52]=T.TORCH_WALL;m[44][69]=T.TORCH_WALL;
  m[50][52]=T.TORCH_WALL;m[50][69]=T.TORCH_WALL;
  // Windows on walls
  m[40][56]=T.WINDOW;m[40][65]=T.WINDOW;
  m[45][52]=T.WINDOW;m[45][69]=T.WINDOW;
  m[50][52]=T.WINDOW;m[50][69]=T.WINDOW;
  fill(57,42,8,2,T.ALTAR);m[43][58]=T.CANDLE;m[43][63]=T.CANDLE;
  for(let r=46;r<=52;r+=2){m[r][57]=T.PEW;m[r][58]=T.PEW;m[r][63]=T.PEW;m[r][64]=T.PEW;}
  m[49][54]=T.PILLAR;m[49][67]=T.PILLAR;m[45][54]=T.PILLAR;m[45][67]=T.PILLAR;

  // Guard house (bottom left)
  rect(8,56,10,8,T.WALL);fill(9,57,8,6,T.WOOD_FLOOR);
  m[63][12]=T.DOOR;m[56][11]=T.TORCH_WALL;m[56][15]=T.WINDOW;m[59][10]=T.WEAPON_RACK;

  // Houses row (bottom right)
  rect(48,58,10,8,T.WALL);fill(49,59,8,6,T.WOOD_FLOOR);m[65][52]=T.DOOR;m[58][51]=T.TORCH_WALL;m[58][55]=T.WINDOW;
  rect(60,58,10,8,T.WALL);fill(61,59,8,6,T.WOOD_FLOOR);m[65][64]=T.DOOR;m[58][63]=T.TORCH_WALL;m[58][67]=T.WINDOW;

  // Library (upper right area)
  rect(48,24,12,8,T.WALL);fill(49,25,10,6,T.WOOD_FLOOR);
  m[31][54]=T.DOOR_CLOSED;m[24][51]=T.TORCH_WALL;m[24][57]=T.TORCH_WALL;
  m[24][52]=T.WINDOW;m[24][56]=T.WINDOW;m[26][50]=T.CRATE;m[26][56]=T.CRATE;

  // Apothecary (right side)
  rect(62,24,10,6,T.WALL);fill(63,25,8,4,T.WOOD_FLOOR);
  m[29][66]=T.DOOR;m[24][65]=T.TORCH_WALL;m[24][69]=T.WINDOW;m[26][64]=T.BARREL;m[26][68]=T.BARREL;

  // Stable (bottom center)
  rect(24,58,12,8,T.WALL);fill(25,59,10,6,T.WOOD_FLOOR);
  m[65][28]=T.DOOR;m[58][27]=T.TORCH_WALL;
  m[60][26]=T.HAY;m[60][28]=T.HAY;m[62][26]=T.HAY;m[61][32]=T.BARREL;

  // Town gate (south)
  fill(34,72,12,4,T.COBBLE_CLEAN);
  m[72][35]=T.PILLAR;m[72][44]=T.PILLAR;m[74][35]=T.PILLAR;m[74][44]=T.PILLAR;
  fill(30,72,4,4,T.WALL);fill(46,72,4,4,T.WALL);
  m[72][37]=T.TORCH_WALL;m[72][42]=T.TORCH_WALL;m[73][40]=T.BANNER;

  // Gardens & park area (expanded)
  fill(22,44,14,8,T.GRASS);
  for(let i=0;i<12;i++){const gx=23+Math.floor(Math.random()*12),gy=45+Math.floor(Math.random()*6);if(m[gy][gx]===T.GRASS)m[gy][gx]=T.FLOWER;}
  m[46][24]=T.BENCH;m[46][30]=T.BENCH;m[48][27]=T.PLANTER;m[44][26]=T.PLANTER;m[44][30]=T.PLANTER;
  // Garden paths
  fill(27,46,1,4,T.PATH);fill(24,48,8,1,T.PATH);

  // Central flower gardens around square
  for(let i=0;i<8;i++){const gx=30+Math.floor(Math.random()*20),gy=28+Math.floor(Math.random()*16);if(m[gy][gx]===T.GRASS)m[gy][gx]=T.FLOWER;}

  // Small pond/park (east side)
  fill(56,28,6,4,T.GRASS);
  m[29][57]=T.WATER;m[29][58]=T.WATER;m[30][57]=T.WATER;m[30][58]=T.WATER;m[30][59]=T.WATER;
  m[28][57]=T.BUSH;m[28][59]=T.BUSH;m[31][58]=T.BENCH;

  // Additional paths connecting buildings
  fill(12,16,1,6,T.PATH);fill(12,29,1,11,T.PATH);fill(12,48,1,8,T.PATH);
  fill(54,20,1,2,T.PATH);fill(54,32,1,8,T.PATH);fill(28,18,1,4,T.PATH);
  fill(52,56,1,2,T.PATH);fill(64,56,1,2,T.PATH);fill(28,66,1,6,T.PATH);

  // More trees for depth
  m[12][6]=T.TREE;m[24][6]=T.TREE;m[36][6]=T.TREE;m[48][6]=T.TREE;m[60][6]=T.TREE;
  m[12][W-7]=T.TREE;m[24][W-7]=T.TREE;m[36][W-7]=T.TREE;m[48][W-7]=T.TREE;m[60][W-7]=T.TREE;

  // Additional decorative elements
  m[20][30]=T.PLANTER;m[20][36]=T.PLANTER;
  m[55][36]=T.BENCH;m[55][42]=T.BENCH;
  m[66][40]=T.LAMP_POST;m[66][46]=T.LAMP_POST;

  // Farm area
  fill(10,66,20,6,T.GRASS);
  m[67][12]=T.HAY;m[67][15]=T.HAY;m[68][13]=T.HAY;m[67][22]=T.HAY;m[68][24]=T.HAY;
  fill(10,66,2,6,T.FENCE);fill(28,66,2,6,T.FENCE);fill(10,66,20,1,T.FENCE);fill(10,71,20,1,T.FENCE);

  m[35][34]=T.WELL;

  const bushPos=[[6,6],[6,20],[6,36],[6,50],[6,66],[17,6],[17,56],[28,6],[42,6],[56,6],[66,6],
    [66,20],[66,36],[66,50],[66,66],[17,70],[28,70],[42,70],[56,70]];
  bushPos.forEach(([j,i])=>{if(j<H&&i<W&&m[j][i]===T.GRASS)m[j][i]=T.BUSH;});
  // Decorative jars in buildings (inside floor areas, not walls)
  m[12][10]=T.JAR;m[12][16]=T.JAR;m[14][52]=T.JAR;m[26][26]=T.JAR;
  m[42][12]=T.JAR;m[58][10]=T.JAR;m[60][56]=T.JAR;m[44][60]=T.JAR;

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — DARKWOOD FOREST
// ═══════════════════════════════════════════════════════════════
function generateForestMap(){
  const W=70,H=65;
  const m=Array.from({length:H},()=>Array(W).fill(T.GRASS_DARK));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};
  const rect=(x,y,w,h,t)=>{for(let i=x;i<Math.min(x+w,W);i++){if(y>=0&&y<H)m[y][i]=t;if(y+h-1>=0&&y+h-1<H)m[y+h-1][i]=t;}for(let j=y;j<Math.min(y+h,H);j++){if(x>=0&&x<W)m[j][x]=t;if(x+w-1>=0&&x+w-1<W)m[j][x+w-1]=t;}};

  // Dense tree border
  for(let i=0;i<W;i++){m[0][i]=T.DENSE_TREE;m[1][i]=T.DENSE_TREE;m[H-1][i]=T.DENSE_TREE;m[H-2][i]=T.DENSE_TREE;}
  for(let j=0;j<H;j++){m[j][0]=T.DENSE_TREE;m[j][1]=T.DENSE_TREE;m[j][W-1]=T.DENSE_TREE;m[j][W-2]=T.DENSE_TREE;}

  // Scatter trees throughout
  for(let i=0;i<250;i++){const x=2+Math.floor(Math.random()*(W-4)),y=2+Math.floor(Math.random()*(H-4));if(m[y][x]===T.GRASS_DARK)m[y][x]=T.DENSE_TREE;}

  // Main path from south (town entrance) to north
  for(let y=H-3;y>=3;y--){const wx=34+Math.floor(Math.sin(y*0.15)*3);fill(wx-1,y,3,1,T.DIRT);m[y][wx-2]=T.GRASS;m[y][wx+2]=T.GRASS;}
  // Branch path east
  for(let x=37;x<W-4;x++){const wy=25+Math.floor(Math.sin(x*0.12)*2);fill(x,wy-1,1,3,T.DIRT);}
  // Branch path west to wolf den
  for(let x=5;x<34;x++){const wy=42+Math.floor(Math.sin(x*0.1)*2);fill(x,wy,2,1,T.DIRT);}

  // South entrance clearing (connects to town)
  fill(28,H-6,14,4,T.GRASS);fill(31,H-5,8,3,T.DIRT);
  m[H-3][34]=T.SIGN_POST;m[H-4][31]=T.LAMP_POST;m[H-4][38]=T.LAMP_POST;

  // Clearing 1 - small camp ruin
  fill(18,18,10,8,T.GRASS);fill(20,20,6,4,T.DIRT);
  m[21][22]=T.CAMP_FIRE;m[20][20]=T.FALLEN_LOG;m[23][24]=T.FALLEN_LOG;
  m[20][25]=T.BARREL;m[22][25]=T.CRATE;

  // Clearing 2 - moss stones / old shrine
  fill(48,10,12,10,T.GRASS);
  m[14][52]=T.MOSS_STONE;m[14][56]=T.MOSS_STONE;m[16][54]=T.MOSS_STONE;
  m[13][54]=T.CANDLE;m[15][52]=T.CANDLE;m[15][56]=T.CANDLE;
  fill(52,15,4,3,T.COBBLE_DARK);m[16][53]=T.ALTAR;m[16][54]=T.ALTAR;

  // Bandit camp (main quest objective)
  fill(25,30,16,12,T.GRASS);fill(27,32,12,8,T.DIRT);
  m[33][30]=T.CAMP_FIRE;m[33][36]=T.CAMP_FIRE;
  m[32][28]=T.TENT;m[32][37]=T.TENT;m[36][28]=T.TENT;m[36][37]=T.TENT;
  m[34][29]=T.BARREL;m[34][38]=T.BARREL;m[35][30]=T.CRATE;m[35][37]=T.CRATE;
  m[38][33]=T.WEAPON_RACK;
  m[31][32]=T.CAMP_FIRE;m[31][37]=T.CAMP_FIRE;
  // Stolen goods marker (quest item)
  m[34][33]=T.CRATE;

  // Wolf den area (west)
  fill(5,38,14,10,T.GRASS);fill(7,40,10,6,T.DIRT);
  m[42][10]=T.BONE_PILE;m[43][12]=T.BONE_PILE;m[41][8]=T.BONE_PILE;
  m[44][11]=T.FALLEN_LOG;m[40][14]=T.FALLEN_LOG;

  // Swampy area (northeast)
  fill(50,35,16,12,T.GRASS);
  for(let i=0;i<12;i++){const x=51+Math.floor(Math.random()*14),y=36+Math.floor(Math.random()*10);if(m[y][x]===T.GRASS)m[y][x]=T.SWAMP;}
  m[38][55]=T.WATER;m[39][56]=T.WATER;m[40][55]=T.WATER;m[39][54]=T.WATER;
  m[41][57]=T.FALLEN_LOG;

  // Flowers and bushes
  for(let i=0;i<30;i++){const x=3+Math.floor(Math.random()*(W-6)),y=3+Math.floor(Math.random()*(H-6));if(m[y][x]===T.GRASS||m[y][x]===T.GRASS_DARK)m[y][x]=Math.random()<0.5?T.FLOWER:T.BUSH;}

  // Cave entrance (east side - connects to cave)
  fill(W-6,22,4,5,T.COBBLE_DARK);m[23][W-7]=T.CAMP_FIRE;m[25][W-7]=T.CAMP_FIRE;
  m[24][W-3]=T.CAVE_FLOOR;
  // Jars near bandit camp
  m[32][28]=T.JAR;m[34][30]=T.JAR;m[36][33]=T.JAR;m[38][28]=T.JAR;
  // Bonfires (save points)
  m[58][35]=T.BONFIRE; // Near town exit
  m[24][58]=T.BONFIRE; // Near cave entrance

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — HOLLOW CAVES
// ═══════════════════════════════════════════════════════════════
function generateCaveMap(){
  const W=50,H=55;
  const m=Array.from({length:H},()=>Array(W).fill(T.CAVE_WALL));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};

  // Carve out main chambers connected by tunnels
  // Entrance chamber (west)
  fill(2,20,8,10,T.CAVE_FLOOR);fill(3,22,6,6,T.CAVE_FLOOR);
  m[24][3]=T.TORCH_WALL;m[24][8]=T.TORCH_WALL;

  // Tunnel east from entrance
  fill(10,23,10,4,T.CAVE_FLOOR);

  // Central chamber
  fill(18,16,14,16,T.CAVE_FLOOR);fill(20,18,10,12,T.CAVE_FLOOR);
  m[20][20]=T.STALACTITE;m[20][28]=T.STALACTITE;m[26][24]=T.STALACTITE;
  m[22][22]=T.MUSHROOM;m[24][26]=T.MUSHROOM;m[18][25]=T.MUSHROOM;
  m[19][20]=T.TORCH_WALL;m[19][29]=T.TORCH_WALL;m[28][20]=T.TORCH_WALL;

  // North tunnel
  fill(23,6,4,12,T.CAVE_FLOOR);fill(22,8,6,3,T.CAVE_FLOOR);

  // North chamber (spider nest)
  fill(16,2,16,8,T.CAVE_FLOOR);fill(18,3,12,6,T.CAVE_FLOOR);
  m[4][20]=T.SPIDER_WEB;m[4][28]=T.SPIDER_WEB;m[6][22]=T.SPIDER_WEB;m[5][26]=T.SPIDER_WEB;
  m[3][24]=T.SPIDER_WEB;
  m[5][19]=T.BONE_PILE;m[7][27]=T.BONE_PILE;

  // East tunnel
  fill(30,22,8,4,T.CAVE_FLOOR);

  // East chamber (underground lake)
  fill(36,18,12,12,T.CAVE_FLOOR);fill(38,20,8,8,T.CAVE_FLOOR);
  fill(40,22,4,4,T.UNDERGROUND_WATER);
  m[20][39]=T.CRYSTAL;m[20][44]=T.CRYSTAL;m[26][40]=T.CRYSTAL;m[26][45]=T.CRYSTAL;
  m[19][38]=T.TORCH_WALL;m[19][46]=T.TORCH_WALL;

  // South tunnel from central
  fill(23,30,4,8,T.CAVE_FLOOR);

  // South chamber (lurker den)
  fill(16,36,18,12,T.CAVE_FLOOR);fill(18,38,14,8,T.CAVE_FLOOR);
  m[40][22]=T.MUSHROOM;m[42][28]=T.MUSHROOM;m[38][20]=T.MUSHROOM;
  m[39][25]=T.BONE_PILE;m[43][30]=T.BONE_PILE;
  m[37][18]=T.TORCH_WALL;m[37][31]=T.TORCH_WALL;
  // Deep treasure (quest objective)
  m[44][25]=T.CRATE;m[44][26]=T.CANDLE;

  // Additional tunnels for exploration
  fill(15,26,5,3,T.CAVE_FLOOR);fill(10,24,7,6,T.CAVE_FLOOR);
  m[26][12]=T.MUSHROOM;m[28][14]=T.CRYSTAL;

  // Scatter decorations
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){
    if(m[j][i]===T.CAVE_FLOOR&&Math.random()<0.03)m[j][i]=T.MOSS_STONE;
  }
  // Cave jars
  m[8][10]=T.JAR;m[8][38]=T.JAR;m[22][20]=T.JAR;m[35][25]=T.JAR;m[45][12]=T.JAR;
  // Bonfires (save points)
  m[24][6]=T.BONFIRE; // Entrance chamber

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — CRYPT (beneath cathedral)
// ═══════════════════════════════════════════════════════════════
function generateCryptMap(){
  const W=45,H=50;
  const m=Array.from({length:H},()=>Array(W).fill(T.VOID));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};
  const rect=(x,y,w,h,t)=>{for(let i=x;i<Math.min(x+w,W);i++){if(y>=0&&y<H)m[y][i]=t;if(y+h-1>=0&&y+h-1<H)m[y+h-1][i]=t;}for(let j=y;j<Math.min(y+h,H);j++){if(x>=0&&x<W)m[j][x]=t;if(x+w-1>=0&&x+w-1<W)m[j][x+w-1]=t;}};

  // Entry chamber (top) - stairs from cathedral
  fill(18,3,9,7,T.CRYPT_FLOOR);rect(18,3,9,7,T.CRYPT_WALL);
  // Clear entry point at top
  m[3][22]=T.CRYPT_FLOOR;m[3][21]=T.CRYPT_FLOOR;m[3][23]=T.CRYPT_FLOOR;
  fill(20,4,5,3,T.CARPET_RED);
  m[5][19]=T.SOUL_FLAME;m[5][25]=T.SOUL_FLAME;
  m[4][22]=T.CRYPT_ALTAR;
  m[7][19]=T.COFFIN;m[7][25]=T.COFFIN;

  // Main corridor
  fill(20,9,5,16,T.CRYPT_FLOOR);
  // Connect entry chamber to corridor
  m[9][22]=T.CRYPT_FLOOR;m[9][21]=T.CRYPT_FLOOR;m[9][23]=T.CRYPT_FLOOR;
  for(let j=11;j<24;j+=4){m[j][20]=T.CRYPT_PILLAR;m[j][24]=T.CRYPT_PILLAR;m[j][22]=T.TORCH_WALL;}

  // West wing - tomb chambers
  fill(6,10,13,10,T.CRYPT_FLOOR);rect(6,10,13,10,T.CRYPT_WALL);
  // Clear doorway to corridor
  m[14][19]=T.CRYPT_FLOOR;m[15][19]=T.CRYPT_FLOOR;
  m[12][8]=T.SARCOPHAGUS;m[12][10]=T.SARCOPHAGUS;m[12][14]=T.SARCOPHAGUS;m[12][16]=T.SARCOPHAGUS;
  m[17][8]=T.TOMB;m[17][10]=T.TOMB;m[17][14]=T.TOMB;m[17][16]=T.TOMB;
  m[11][9]=T.CANDLE;m[11][15]=T.CANDLE;
  m[16][11]=T.SKULL_PILE;m[16][17]=T.BONE_PILE;
  fill(10,13,4,4,T.BLOOD_POOL);
  m[10][7]=T.TORCH_WALL;m[10][17]=T.TORCH_WALL;

  // East wing - catacombs
  fill(26,10,13,10,T.CRYPT_FLOOR);rect(26,10,13,10,T.CRYPT_WALL);
  // Clear doorway to corridor
  m[14][25]=T.CRYPT_FLOOR;m[15][25]=T.CRYPT_FLOOR;
  for(let j=12;j<18;j+=2){m[j][28]=T.GRAVE;m[j][30]=T.GRAVE;m[j][34]=T.GRAVE;m[j][36]=T.GRAVE;}
  m[12][32]=T.SKULL_PILE;m[14][32]=T.SKULL_PILE;m[16][32]=T.SKULL_PILE;
  m[11][29]=T.SOUL_FLAME;m[11][35]=T.SOUL_FLAME;
  m[18][31]=T.COFFIN;m[18][33]=T.COFFIN;
  m[10][27]=T.TORCH_WALL;m[10][37]=T.TORCH_WALL;

  // Central hall
  fill(12,24,21,12,T.CRYPT_FLOOR);rect(12,24,21,12,T.CRYPT_WALL);
  // Clear doorway from corridor
  m[24][22]=T.CRYPT_FLOOR;m[24][21]=T.CRYPT_FLOOR;m[24][23]=T.CRYPT_FLOOR;
  for(let i=15;i<30;i+=4){m[27][i]=T.CRYPT_PILLAR;m[32][i]=T.CRYPT_PILLAR;}
  fill(19,28,7,5,T.CATHEDRAL_FLOOR);fill(21,29,3,3,T.CARPET_RED);
  m[30][22]=T.CRYPT_ALTAR;
  m[29][20]=T.SOUL_FLAME;m[29][24]=T.SOUL_FLAME;m[31][20]=T.CANDLE;m[31][24]=T.CANDLE;
  m[26][14]=T.SKULL_PILE;m[26][30]=T.SKULL_PILE;
  m[33][16]=T.BONE_PILE;m[33][28]=T.BONE_PILE;
  m[25][13]=T.TORCH_WALL;m[25][31]=T.TORCH_WALL;
  m[34][14]=T.TORCH_WALL;m[34][30]=T.TORCH_WALL;

  // South corridor to boss
  fill(19,35,7,4,T.CRYPT_FLOOR);

  // Boss arena
  fill(10,38,25,10,T.CRYPT_FLOOR);rect(10,38,25,10,T.CRYPT_WALL);
  m[38][22]=T.CRYPT_FLOOR;
  m[41][13]=T.CRYPT_PILLAR;m[41][31]=T.CRYPT_PILLAR;
  m[45][13]=T.CRYPT_PILLAR;m[45][31]=T.CRYPT_PILLAR;
  fill(19,42,7,4,T.CATHEDRAL_FLOOR);
  m[44][22]=T.SARCOPHAGUS; // Boss marker
  m[43][20]=T.SOUL_FLAME;m[43][24]=T.SOUL_FLAME;
  m[45][19]=T.CANDLE;m[45][25]=T.CANDLE;
  m[40][12]=T.TREASURE_CHEST;m[40][32]=T.TREASURE_CHEST;
  m[39][11]=T.TORCH_WALL;m[39][33]=T.TORCH_WALL;
  m[46][17]=T.TORCH_WALL;m[46][27]=T.TORCH_WALL;

  // Scatter decorations
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){
    if(m[j][i]===T.CRYPT_FLOOR){
      if(Math.random()<0.015)m[j][i]=T.BONE_PILE;
      else if(Math.random()<0.01)m[j][i]=T.BLOOD;
    }
  }
  m[5][20]=T.JAR;m[15][8]=T.JAR;m[15][36]=T.JAR;m[28][15]=T.JAR;m[28][29]=T.JAR;
  // Bonfires (save points)
  m[7][22]=T.BONFIRE; // Entry chamber

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — GRAVEYARD (east of town, contains crypt entrance)
// ═══════════════════════════════════════════════════════════════
function generateGraveyardMap(){
  const W=50,H=45;
  const m=Array.from({length:H},()=>Array(W).fill(T.DEAD_GRASS));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};

  // Paths
  fill(0,20,W,3,T.GRAVE_DIRT);fill(24,0,3,H,T.GRAVE_DIRT);
  
  // Iron fence perimeter
  for(let i=2;i<W-2;i++){m[2][i]=T.IRON_FENCE;m[H-3][i]=T.IRON_FENCE;}
  for(let j=2;j<H-2;j++){m[j][2]=T.IRON_FENCE;m[j][W-3]=T.IRON_FENCE;}
  // Gates
  m[2][24]=T.GRAVE_DIRT;m[2][25]=T.GRAVE_DIRT;m[2][26]=T.GRAVE_DIRT;
  m[H-3][24]=T.GRAVE_DIRT;m[H-3][25]=T.GRAVE_DIRT;m[H-3][26]=T.GRAVE_DIRT;
  m[21][2]=T.GRAVE_DIRT;m[21][W-3]=T.GRAVE_DIRT;

  // Gravestones scattered
  const gravePositions=[[6,8],[6,14],[6,20],[6,32],[6,38],[10,6],[10,12],[10,18],[10,30],[10,36],[10,42],
    [14,8],[14,14],[14,32],[14,38],[26,8],[26,14],[26,32],[26,38],[30,6],[30,12],[30,18],[30,30],[30,36],
    [34,8],[34,14],[34,20],[34,32],[34,38],[38,6],[38,12],[38,36],[38,42]];
  gravePositions.forEach(([y,x])=>{if(y<H&&x<W&&m[y][x]===T.DEAD_GRASS)m[y][x]=T.GRAVESTONE;});

  // Large mausoleum (center-east)
  fill(32,10,8,6,T.SANDSTONE);fill(33,11,6,4,T.CRYPT_FLOOR);
  m[10][35]=T.SANDSTONE_WALL;m[10][36]=T.SANDSTONE_WALL;m[10][37]=T.SANDSTONE_WALL;
  m[15][36]=T.DOOR_BROKEN;m[12][34]=T.SARCOPHAGUS;

  // Crypt entrance - the main feature
  fill(20,30,10,8,T.GRAVE_DIRT);
  m[32][24]=T.CRYPT_ENTRANCE;m[32][25]=T.CRYPT_ENTRANCE;m[32][26]=T.CRYPT_ENTRANCE;
  m[31][23]=T.ANGEL_STATUE;m[31][27]=T.ANGEL_STATUE;
  m[33][24]=T.SOUL_FLAME;m[33][26]=T.SOUL_FLAME;

  // Willow trees
  m[8][5]=T.WILLOW;m[8][44]=T.WILLOW;m[36][5]=T.WILLOW;m[36][44]=T.WILLOW;m[18][25]=T.WILLOW;

  // Dead trees
  m[12][20]=T.DEAD_TREE;m[28][40]=T.DEAD_TREE;m[5][30]=T.DEAD_TREE;m[40][15]=T.DEAD_TREE;

  // Bone piles
  m[15][10]=T.BONE_PILE;m[25][35]=T.BONE_PILE;m[35][12]=T.BONE_PILE;m[8][38]=T.BONE_PILE;

  // Torches along path
  m[20][6]=T.TORCH_WALL;m[20][44]=T.TORCH_WALL;m[6][24]=T.TORCH_WALL;m[40][24]=T.TORCH_WALL;

  // Bonfire near entrance
  m[4][25]=T.BONFIRE;

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — DESERT (south of town)
// ═══════════════════════════════════════════════════════════════
function generateDesertMap(){
  const W=60,H=50;
  const m=Array.from({length:H},()=>Array(W).fill(T.SAND));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};

  // Darker sand patches
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(Math.random()<0.2)m[j][i]=T.SAND_DARK;}

  // Dunes (impassable)
  fill(5,8,8,4,T.DUNE);fill(45,12,10,5,T.DUNE);fill(20,35,12,4,T.DUNE);fill(50,38,8,6,T.DUNE);
  fill(2,30,5,3,T.DUNE);fill(55,3,4,3,T.DUNE);

  // Path from north
  fill(28,0,4,20,T.SAND_DARK);fill(26,18,8,4,T.SAND_DARK);

  // Oasis (center) - boss area
  fill(25,22,10,8,T.SAND);fill(27,24,6,4,T.OASIS);
  m[23][28]=T.DEAD_TREE;m[23][32]=T.DEAD_TREE;m[29][27]=T.DEAD_TREE;m[26][33]=T.DEAD_TREE;

  // Ancient Ruins NORTH (for desert_ruins quest)
  fill(8,8,12,10,T.SANDSTONE);fill(9,9,10,8,T.SAND);
  m[8][10]=T.SANDSTONE_WALL;m[8][17]=T.SANDSTONE_WALL;m[17][10]=T.SANDSTONE_WALL;m[17][17]=T.SANDSTONE_WALL;
  m[12][12]=T.PILLAR_BROKEN;m[12][15]=T.PILLAR_BROKEN;m[10][13]=T.BONE_PILE;
  m[14][14]=T.RELIC; // Ancient artifact

  // Ancient Ruins SOUTH (for desert_ruins quest)
  fill(42,38,12,10,T.SANDSTONE);fill(43,39,10,8,T.SAND);
  m[38][44]=T.SANDSTONE_WALL;m[38][51]=T.SANDSTONE_WALL;m[47][44]=T.SANDSTONE_WALL;m[47][51]=T.SANDSTONE_WALL;
  m[42][46]=T.PILLAR_BROKEN;m[42][49]=T.PILLAR_BROKEN;m[44][48]=T.BONE_PILE;
  m[40][47]=T.ALTAR; // Ancient altar

  // Lost Caravan (for lost_caravan quest)
  fill(44,22,8,6,T.SAND_DARK);
  m[23][46]=T.CART_WRECK;m[24][48]=T.CART_WRECK;
  m[25][45]=T.CRATE;m[25][47]=T.BARREL;m[26][49]=T.CRATE;
  m[24][50]=T.BONES;m[25][46]=T.BONES;m[26][48]=T.BONE_PILE;
  m[27][47]=T.BONES; // Scattered remains

  // Cacti
  const cacti=[[4,20],[8,45],[15,30],[18,52],[25,5],[32,55],[38,8],[42,15],[46,28],[12,35],[6,38],[34,5]];
  cacti.forEach(([y,x])=>{if(y<H&&x<W)m[y][x]=T.CACTUS;});

  // Rocks
  const rocks=[[6,30],[12,48],[22,8],[35,25],[40,55],[45,5],[10,22],[28,42],[16,5],[32,48]];
  rocks.forEach(([y,x])=>{if(y<H&&x<W)m[y][x]=T.DESERT_ROCK;});

  // Bones scattered
  const bones=[[8,18],[15,40],[30,10],[38,35],[44,15],[20,50],[5,50],[35,2]];
  bones.forEach(([y,x])=>{if(y<H&&x<W&&m[y][x]===T.SAND)m[y][x]=T.BONES;});

  // Torches near ruins
  m[9][10]=T.TORCH_WALL;m[9][17]=T.TORCH_WALL;m[39][44]=T.TORCH_WALL;m[39][51]=T.TORCH_WALL;

  // Bonfire at oasis
  m[26][30]=T.BONFIRE;

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — ICE BIOME (Frozen Wastes - west of town)
// ═══════════════════════════════════════════════════════════════
function generateIceMap(){
  const W=60,H=65;
  const m=Array.from({length:H},()=>Array(W).fill(T.SNOW));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};

  // Ice wall borders
  for(let i=0;i<W;i++){m[0][i]=T.ICE_WALL;m[H-1][i]=T.ICE_WALL;}
  for(let j=0;j<H;j++){m[j][0]=T.ICE_WALL;m[j][W-1]=T.ICE_WALL;}

  // Deep snow patches
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(Math.random()<0.15)m[j][i]=T.SNOW_DEEP;}

  // Frozen lake (center-north)
  fill(20,15,20,12,T.ICE_FLOOR);fill(22,17,16,8,T.FROZEN_LAKE);
  m[18][25]=T.CRACKED_ICE;m[20][30]=T.CRACKED_ICE;m[22][22]=T.CRACKED_ICE;

  // Abandoned camp (west side)
  fill(5,25,12,10,T.SNOW);fill(7,27,8,6,T.ICE_FLOOR);
  m[28][8]=T.FROZEN_CORPSE;m[30][10]=T.CRATE;m[29][12]=T.BARREL;
  m[27][9]=T.CAMP_FIRE; // Extinguished fire
  m[26][8]=T.TORCH_WALL;m[26][13]=T.TORCH_WALL;

  // Ice spire formation (center-south)
  fill(25,40,10,8,T.ICE_FLOOR);
  m[42][28]=T.ICE_PILLAR;m[42][32]=T.ICE_PILLAR;m[44][30]=T.ICE_PILLAR;
  m[43][26]=T.ICE_STALAGMITE;m[43][34]=T.ICE_STALAGMITE;
  m[41][29]=T.ICE_CRYSTAL;m[41][31]=T.ICE_CRYSTAL;m[45][30]=T.AURORA_STONE;

  // Boss arena (south)
  fill(15,52,30,10,T.ICE_FLOOR);fill(20,54,20,6,T.SNOW);
  m[55][20]=T.ICE_PILLAR;m[55][40]=T.ICE_PILLAR;m[58][25]=T.ICE_PILLAR;m[58][35]=T.ICE_PILLAR;
  m[56][30]=T.FROST_SHRINE; // Boss spawn marker
  m[54][22]=T.ICE_CRYSTAL;m[54][38]=T.ICE_CRYSTAL;
  m[53][16]=T.TORCH_WALL;m[53][44]=T.TORCH_WALL;

  // Frost vent hazards
  m[20][12]=T.FROST_VENT;m[35][45]=T.FROST_VENT;m[45][15]=T.FROST_VENT;m[50][40]=T.FROST_VENT;

  // Frozen trees
  const frozenTrees=[[8,35],[15,8],[25,5],[40,10],[48,20],[52,45],[10,50],[35,55],[45,52]];
  frozenTrees.forEach(([y,x])=>{if(y<H-1&&x<W-1&&m[y][x]===T.SNOW)m[y][x]=T.FROZEN_TREE;});

  // Snow drifts
  fill(40,30,8,4,T.SNOW_DRIFT);fill(8,45,6,4,T.SNOW_DRIFT);fill(48,50,8,4,T.SNOW_DRIFT);

  // Ice crystals scattered
  const crystals=[[12,20],[30,8],[45,35],[38,48],[15,58],[50,12]];
  crystals.forEach(([y,x])=>{if(m[y][x]===T.SNOW||m[y][x]===T.SNOW_DEEP)m[y][x]=T.ICE_CRYSTAL;});

  // Icicles on walls
  m[2][15]=T.ICICLE;m[2][30]=T.ICICLE;m[2][45]=T.ICICLE;
  m[H-3][20]=T.ICICLE;m[H-3][40]=T.ICICLE;

  // Exit to town (east side, y=30-40)
  fill(W-4,30,4,12,T.SNOW);m[35][W-2]=T.SIGN_POST;

  // Bonfire (save point)
  m[30][50]=T.BONFIRE;
  m[60][30]=T.BONFIRE; // Near exit

  // Jars
  m[28][10]=T.JAR;m[43][28]=T.JAR;m[55][25]=T.JAR;m[55][35]=T.JAR;

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
// MAP GENERATION — VOLCANIC BIOME (Volcanic Depths - south of desert)
// ═══════════════════════════════════════════════════════════════
function generateVolcanicMap(){
  const W=60,H=65;
  const m=Array.from({length:H},()=>Array(W).fill(T.VOLCANIC_ROCK));
  const fill=(x,y,w,h,t)=>{for(let j=y;j<Math.min(y+h,H);j++)for(let i=x;i<Math.min(x+w,W);i++)if(i>=0&&j>=0&&i<W)m[j][i]=t;};

  // Obsidian borders
  for(let i=0;i<W;i++){m[0][i]=T.OBSIDIAN;m[H-1][i]=T.OBSIDIAN;}
  for(let j=0;j<H;j++){m[j][0]=T.OBSIDIAN;m[j][W-1]=T.OBSIDIAN;}

  // Ash ground patches
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(Math.random()<0.2)m[j][i]=T.ASH_GROUND;}

  // Entry area from desert (north)
  fill(25,2,10,8,T.BASALT);fill(27,3,6,5,T.COOLED_LAVA);
  m[4][28]=T.TORCH_WALL;m[4][33]=T.TORCH_WALL;

  // Lava rivers
  fill(10,15,4,25,T.LAVA_FLOW);fill(46,20,4,20,T.LAVA_FLOW);
  fill(20,30,20,3,T.MAGMA);

  // Central platform
  fill(22,18,16,10,T.BASALT);fill(24,20,12,6,T.VOLCANIC_ROCK);
  m[21][26]=T.FLAME_PILLAR;m[21][32]=T.FLAME_PILLAR;m[25][24]=T.EMBER_CRYSTAL;m[25][34]=T.EMBER_CRYSTAL;

  // Fire geyser field
  m[12][25]=T.FIRE_GEYSER;m[15][35]=T.FIRE_GEYSER;m[18][42]=T.FIRE_GEYSER;m[25][50]=T.FIRE_GEYSER;
  m[35][12]=T.FIRE_GEYSER;m[40][22]=T.FIRE_GEYSER;

  // Volcanic vents
  m[10][18]=T.VOLCANIC_VENT;m[22][45]=T.VOLCANIC_VENT;m[38][8]=T.VOLCANIC_VENT;m[45][38]=T.VOLCANIC_VENT;

  // Sulfur pools
  fill(5,35,6,4,T.SULFUR_POOL);fill(50,40,6,4,T.SULFUR_POOL);

  // Smoke vents
  const smokeVents=[[8,30],[15,50],[28,15],[42,48],[55,25]];
  smokeVents.forEach(([y,x])=>{if(m[y][x]===T.VOLCANIC_ROCK)m[y][x]=T.SMOKE_VENT;});

  // Boss arena (south)
  fill(15,48,30,14,T.BASALT);fill(20,50,20,10,T.VOLCANIC_ROCK);
  m[52][18]=T.FLAME_PILLAR;m[52][42]=T.FLAME_PILLAR;m[56][22]=T.FLAME_PILLAR;m[56][38]=T.FLAME_PILLAR;
  fill(26,54,8,4,T.MAGMA); // Lava pool behind boss
  m[55][30]=T.INFERNAL_ALTAR; // Boss spawn marker
  m[51][25]=T.EMBER_CRYSTAL;m[51][35]=T.EMBER_CRYSTAL;
  m[49][16]=T.TORCH_WALL;m[49][44]=T.TORCH_WALL;

  // Charred bones scattered
  const bones=[[12,8],[18,48],[32,5],[38,52],[45,15],[50,32]];
  bones.forEach(([y,x])=>{if(m[y][x]===T.VOLCANIC_ROCK||m[y][x]===T.ASH_GROUND)m[y][x]=T.CHARRED_BONES;});

  // Cooled lava paths
  fill(14,15,6,3,T.COOLED_LAVA);fill(40,25,6,3,T.COOLED_LAVA);fill(30,42,8,3,T.COOLED_LAVA);

  // Exit to desert (north)
  fill(27,1,6,3,T.BASALT);

  // Bonfires (save points)
  m[8][30]=T.BONFIRE; // Near entrance
  m[45][30]=T.BONFIRE; // Before boss

  // Jars
  m[6][28]=T.JAR;m[22][24]=T.JAR;m[22][34]=T.JAR;m[52][20]=T.JAR;m[52][40]=T.JAR;

  return {map:m,w:W,h:H};
}

// ═══════════════════════════════════════════════════════════════
function getTileColor(t){
  return {
    [T.VOID]:"#050508",[T.COBBLE]:"#252018",[T.COBBLE_DARK]:"#1c1812",
    [T.WALL]:"#1a1520",[T.WALL_BROKEN]:"#181320",[T.RUBBLE]:"#1c1818",
    [T.BURNT_WOOD]:"#151010",[T.ASH]:"#1c1812",[T.BLOOD]:"#1c1812",
    [T.BLOOD_TRAIL]:"#1c1812",[T.BLOOD_POOL]:"#1c1812",
    [T.DOOR_BROKEN]:"#1c1812",[T.PILLAR]:"#1c1820",
    [T.PILLAR_BROKEN]:"#1c1812",[T.CATHEDRAL_FLOOR]:"#1a1825",
    [T.PEW]:"#1a1825",[T.PEW_BROKEN]:"#1a1825",[T.ALTAR]:"#1a1828",
    [T.STAINED_GLASS]:"#1a1520",[T.TORCH_WALL]:"#1a1520",
    [T.IRON_FENCE]:"#1c1812",[T.COLLAPSED_ROOF]:"#141018",
    [T.CART_WRECK]:"#1c1812",[T.BARREL]:"#1c1812",
    [T.CHAIN]:"#1c1812",[T.STATUE]:"#1c1820",
    [T.STATUE_BROKEN]:"#1c1812",[T.ARCH]:"#1c1820",
    [T.CARPET_RED]:"#1a1825",[T.BONE_PILE]:"#1c1812",
    [T.EMBER_GROUND]:"#1c1812",[T.WATER_PUDDLE]:"#1c1812",
    [T.HANGING_BODY]:"#1c1812",[T.GALLOWS]:"#1c1812",
    [T.WELL]:"#1c1820",[T.BANNER_TORN]:"#1c1812",
    [T.WINDOW_BROKEN]:"#1a1520",[T.CRATE]:"#1c1812",
    [T.WEAPON_RACK]:"#1c1812",[T.CANDLE]:"#1a1825",
    [T.DEBRIS]:"#1c1812",[T.FOUNDATION]:"#1c1820",[T.RELIC]:"#1a1828",
    [T.GRASS]:"#2a5420",[T.GRASS_DARK]:"#1e4018",[T.PATH]:"#8a7a60",
    [T.WOOD_FLOOR]:"#5a4830",[T.MARKET_STALL]:"#6a4a28",
    [T.FLOWER]:"#2a5420",[T.HAY]:"#8a7a40",[T.FENCE]:"#5a4428",
    [T.LAMP_POST]:"#2a5420",[T.DOOR]:"#5a3a1a",[T.ROOF]:"#6a3020",
    [T.CHIMNEY]:"#3a3040",[T.FOUNTAIN]:"#3a5a6a",[T.WATER]:"#1a3a50",
    [T.COBBLE_CLEAN]:"#7a7060",[T.BANNER]:"#8a2020",[T.PLANTER]:"#3a5a28",
    [T.BENCH]:"#5a4428",[T.TREE]:"#1a3812",[T.BUSH]:"#2a4a1a",
    [T.WINDOW]:"#3a5a7a",[T.CARPET]:"#6a3040",
    [T.STATUE_INTACT]:"#5a5868",[T.SIGN_POST]:"#5a4428",
    // Forest
    [T.DIRT]:"#4a3a20",[T.DENSE_TREE]:"#0a2808",[T.FALLEN_LOG]:"#3a2a14",
    [T.CAMP_FIRE]:"#4a3a20",[T.TENT]:"#5a4a30",[T.SWAMP]:"#1a3a18",
    [T.MOSS_STONE]:"#2a3a28",
    // Cave
    [T.CAVE_FLOOR]:"#1a1820",[T.CAVE_WALL]:"#0c0a10",[T.MUSHROOM]:"#1a1820",
    [T.STALACTITE]:"#0c0a10",[T.SPIDER_WEB]:"#1a1820",[T.UNDERGROUND_WATER]:"#0a1828",
    [T.CRYSTAL]:"#1a1820",
    [T.STATUE_INTACT]:"#5a5a68",[T.GARDEN]:"#2a6a20",[T.SIGN_POST]:"#5a4428",
    // Desert
    [T.SAND]:"#c4a868",[T.SAND_DARK]:"#a89050",[T.DUNE]:"#d4b878",[T.CACTUS]:"#3a6a28",
    [T.DEAD_TREE]:"#4a3820",[T.OASIS]:"#2a6a70",[T.SANDSTONE]:"#b89860",[T.SANDSTONE_WALL]:"#8a7048",
    [T.BONES]:"#c8c0a8",[T.DESERT_ROCK]:"#6a5a48",
    // Graveyard
    [T.GRAVE_DIRT]:"#3a3028",[T.GRAVESTONE]:"#5a5860",[T.MAUSOLEUM]:"#4a4850",
    [T.DEAD_GRASS]:"#4a4830",[T.CRYPT_ENTRANCE]:"#1a1820",[T.IRON_GATE]:"#3a3840",
    [T.ANGEL_STATUE]:"#8a8890",[T.WILLOW]:"#2a3a20",
    // ═══════════════════════════════════════════════════════════════
    // ICE BIOME COLORS
    // ═══════════════════════════════════════════════════════════════
    [T.SNOW]:"#e8f0f8",[T.SNOW_DEEP]:"#d0e0f0",[T.ICE_FLOOR]:"#a0d0e8",
    [T.ICE_WALL]:"#6090b0",[T.FROZEN_TREE]:"#4a6878",[T.ICE_CRYSTAL]:"#80c0e0",
    [T.FROST_VENT]:"#b0d8f0",[T.FROZEN_LAKE]:"#5088a8",[T.SNOW_DRIFT]:"#f0f8ff",
    [T.ICE_PILLAR]:"#7ab0d0",[T.FROZEN_CORPSE]:"#8090a0",[T.ICE_STALAGMITE]:"#6898b8",
    [T.AURORA_STONE]:"#60d0a0",[T.FROST_SHRINE]:"#90c8e8",[T.CRACKED_ICE]:"#88b8d0",
    [T.ICICLE]:"#a8d8f0",
    // ═══════════════════════════════════════════════════════════════
    // VOLCANIC BIOME COLORS
    // ═══════════════════════════════════════════════════════════════
    [T.VOLCANIC_ROCK]:"#2a2028",[T.MAGMA]:"#ff4020",[T.OBSIDIAN]:"#101018",
    [T.VOLCANIC_VENT]:"#3a2020",[T.ASH_GROUND]:"#3a3838",[T.LAVA_FLOW]:"#ff6030",
    [T.BASALT]:"#282830",[T.FIRE_GEYSER]:"#ff8040",[T.VOLCANIC_GLASS]:"#181820",
    [T.SULFUR_POOL]:"#a0a020",[T.CHARRED_BONES]:"#2a2828",[T.EMBER_CRYSTAL]:"#ff5030",
    [T.FLAME_PILLAR]:"#ff4010",[T.INFERNAL_ALTAR]:"#4a2028",[T.COOLED_LAVA]:"#383038",
    [T.SMOKE_VENT]:"#484850",
  }[t]||"#0a0a0f";
}

function drawTile(ctx,type,px,py,time,isTown,simplified=false,animated=true,wx=0,wy=0){
  // wx,wy = world tile coordinates (stable), px,py = screen position (changes with camera)
  ctx.fillStyle=getTileColor(type);ctx.fillRect(px,py,TILE,TILE);
  // Performance: skip complex tile details in simplified mode
  if(simplified&&(type===T.COBBLE||type===T.COBBLE_CLEAN||type===T.COBBLE_DARK||type===T.GRASS||type===T.DIRT||type===T.SAND||type===T.SAND_DARK||type===T.DEAD_GRASS))return;
  // Performance: skip animated tiles if animations disabled
  if(!animated&&(type===T.TORCH_WALL||type===T.CAMP_FIRE||type===T.BONFIRE||type===T.SOUL_FLAME||type===T.WATER||type===T.WATER_PUDDLE))return;
  switch(type){
    case T.COBBLE:case T.COBBLE_CLEAN:{
      const bright=isTown?1:0.6;
      ctx.strokeStyle=isTown?"rgba(90,80,70,0.35)":"rgba(40,35,30,0.5)";ctx.lineWidth=0.5;
      ctx.strokeRect(px+2,py+2,18,18);ctx.strokeRect(px+20,py+1,18,16);ctx.strokeRect(px+1,py+20,16,18);ctx.strokeRect(px+18,py+18,20,20);
      // Add subtle highlights and shadows for depth
      ctx.fillStyle=`rgba(255,255,255,${0.03*bright})`;ctx.fillRect(px+3,py+3,8,2);ctx.fillRect(px+21,py+2,8,1);
      ctx.fillStyle=`rgba(0,0,0,${0.08*bright})`;ctx.fillRect(px+10,py+18,8,2);ctx.fillRect(px+28,py+15,6,2);
      // Random pebbles
      if((wx+wy)%3===0){ctx.fillStyle=`rgba(80,70,60,${0.3*bright})`;ctx.beginPath();ctx.arc(px+12+(wx%8),py+25+(wy%6),2,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.COBBLE_DARK:{
      ctx.strokeStyle="rgba(30,25,22,0.6)";ctx.lineWidth=0.5;ctx.strokeRect(px+3,py+3,16,16);ctx.strokeRect(px+20,py+2,17,14);
      ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(px+8,py+22,12,8);
      break;
    }
    case T.WALL:ctx.fillStyle=isTown?"#4a4050":"#1a1520";ctx.fillRect(px+1,py+1,TILE-2,TILE-2);ctx.fillStyle=isTown?"#5a5060":"#282030";ctx.fillRect(px+2,py+2,TILE-4,4);ctx.fillRect(px+2,py+TILE/2-1,TILE-4,3);ctx.fillRect(px+2,py+TILE-6,TILE-4,4);ctx.strokeStyle=isTown?"#3a3040":"#100c18";ctx.lineWidth=1;ctx.strokeRect(px,py,TILE,TILE);break;
    case T.WALL_BROKEN:ctx.fillStyle="#1a1520";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#242030";const hh=15+((wx*7+wy*3)%20);ctx.fillRect(px+2,py+TILE-hh,TILE-4,hh);break;
    case T.RUBBLE:ctx.fillStyle="#2a2430";ctx.fillRect(px+5,py+8,12,8);ctx.fillRect(px+20,py+15,10,6);ctx.fillStyle="#332c3a";ctx.fillRect(px+8,py+22,15,7);break;
    case T.BURNT_WOOD:ctx.fillStyle="#1a1410";ctx.fillRect(px+5,py+10,30,5);ctx.fillRect(px+12,py+8,5,24);break;
    case T.ASH:ctx.fillStyle="rgba(60,55,50,0.3)";ctx.fillRect(px+4,py+6,14,10);break;
    case T.BLOOD:{
      // Enhanced blood splatter with variation
      const seed=(wx*17+wy*23)%100;
      const age=((wx+wy)%3)*0.15; // Simulate drying (0=fresh, 0.3=dried)
      const baseR=100-age*40, baseG=15-age*10, baseB=15-age*10;
      // Main splatter
      ctx.fillStyle=`rgba(${baseR},${baseG},${baseB},${0.7-age*0.2})`;
      ctx.beginPath();ctx.arc(px+15+((wx*7)%10),py+15+((wy*5)%10),6+((wx+wy)%4),0,Math.PI*2);ctx.fill();
      // Secondary droplets
      ctx.fillStyle=`rgba(${baseR+20},${baseG+5},${baseB+5},${0.5-age*0.15})`;
      ctx.beginPath();ctx.arc(px+8+(seed%12),py+10+(seed%8),2+seed%2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(px+25-(seed%10),py+22+(seed%6),1.5+seed%2,0,Math.PI*2);ctx.fill();
      // Edge feathering
      if(seed>50){
        ctx.fillStyle=`rgba(${baseR-20},${baseG},${baseB},0.3)`;
        ctx.beginPath();ctx.arc(px+18+(seed%8),py+8,1,0,Math.PI*2);ctx.fill();
      }
      break;
    }
    case T.BLOOD_TRAIL:{
      // Realistic smeared blood trail - organic flowing shape
      const trailSeed=(wx*13+wy*19)%100;
      const trailAge=((wx+wy)%2)*0.15;
      const tR=Math.floor(115-trailAge*40), tG=Math.floor(15-trailAge*8), tB=Math.floor(15-trailAge*8);
      
      // Main smear using bezier curve for organic shape
      ctx.fillStyle=`rgba(${tR},${tG},${tB},${0.7-trailAge*0.15})`;
      ctx.beginPath();
      const xOff=trailSeed%6-3;
      ctx.moveTo(px+14+xOff,py+2);
      ctx.bezierCurveTo(px+20+trailSeed%4,py+10,px+12-trailSeed%3,py+22,px+16+xOff,py+TILE-3);
      ctx.bezierCurveTo(px+22+trailSeed%5,py+TILE-6,px+24-trailSeed%4,py+20,px+22+xOff,py+2);
      ctx.closePath();
      ctx.fill();
      
      // Darker center streak for depth
      ctx.fillStyle=`rgba(${tR-25},${tG-5},${tB-5},${0.6-trailAge*0.1})`;
      ctx.beginPath();
      ctx.moveTo(px+16+xOff,py+5);
      ctx.quadraticCurveTo(px+14+trailSeed%3,py+18,px+17+xOff,py+TILE-6);
      ctx.quadraticCurveTo(px+20-trailSeed%2,py+20,px+19+xOff,py+5);
      ctx.closePath();
      ctx.fill();
      
      // Drip pools where blood accumulated
      ctx.fillStyle=`rgba(${tR-15},${tG-3},${tB-3},${0.65-trailAge*0.12})`;
      ctx.beginPath();ctx.ellipse(px+16+(trailSeed%5),py+8+(trailSeed%4),4+trailSeed%2,3,0.2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(px+15-(trailSeed%3),py+26+(trailSeed%3),5,3.5,0,0,Math.PI*2);ctx.fill();
      
      // Small splatter droplets around edges
      ctx.fillStyle=`rgba(${tR+5},${tG},${tB},0.45)`;
      const dropCount=3+trailSeed%3;
      for(let d=0;d<dropCount;d++){
        const dx=px+8+(d*8+trailSeed*d)%24;
        const dy=py+6+(d*11+trailSeed)%28;
        const dr=1+((trailSeed+d*7)%10)/10;
        ctx.beginPath();ctx.arc(dx,dy,dr,0,Math.PI*2);ctx.fill();
      }
      
      // Wet highlight on fresh blood
      if(trailAge<0.1){
        ctx.fillStyle="rgba(160,50,50,0.2)";
        ctx.beginPath();ctx.ellipse(px+18,py+12,3,1.5,0.5,0,Math.PI*2);ctx.fill();
      }
      break;
    }
    case T.BLOOD_POOL:{
      // Enhanced blood pool with depth and edge variation
      const poolSeed=(wx*11+wy*17)%100;
      const poolAge=((wx+wy)%3)*0.1;
      // Outer edge (dried/lighter)
      ctx.fillStyle=`rgba(${70-poolAge*20},${8},${8},${0.6-poolAge*0.1})`;
      ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2,17+poolSeed%3,14+poolSeed%2,0,0,Math.PI*2);ctx.fill();
      // Main pool (darker center)
      ctx.fillStyle=`rgba(${90-poolAge*30},${10},${10},${0.8-poolAge*0.15})`;
      ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2,14,11,0,0,Math.PI*2);ctx.fill();
      // Deep center reflection
      ctx.fillStyle=`rgba(${60},${5},${5},0.9)`;
      ctx.beginPath();ctx.ellipse(px+TILE/2-2,py+TILE/2-1,8,6,0,0,Math.PI*2);ctx.fill();
      // Surface highlight (wet look)
      ctx.fillStyle="rgba(140,40,40,0.25)";
      ctx.beginPath();ctx.ellipse(px+TILE/2+3,py+TILE/2-3,4,2,0.3,0,Math.PI*2);ctx.fill();
      break;
    }
    case T.DOOR_BROKEN:ctx.fillStyle="#3a2a18";ctx.fillRect(px+10,py+2,TILE-20,TILE-4);break;
    case T.PILLAR:ctx.fillStyle="#3a3448";ctx.fillRect(px+12,py+2,16,36);ctx.fillStyle="#4a4458";ctx.fillRect(px+10,py+0,20,5);ctx.fillRect(px+10,py+35,20,5);break;
    case T.PILLAR_BROKEN:ctx.fillStyle="#3a3448";ctx.fillRect(px+12,py+18,16,20);ctx.fillStyle="#4a4458";ctx.fillRect(px+10,py+35,20,5);break;
    case T.CATHEDRAL_FLOOR:{
      ctx.fillStyle=isTown?"#3a3848":"#1e1c28";ctx.fillRect(px,py,TILE,TILE);
      ctx.strokeStyle="rgba(40,35,50,0.5)";ctx.lineWidth=0.5;ctx.strokeRect(px+1,py+1,TILE-2,TILE-2);
      // Decorative inlay pattern
      const inlay=(wx+wy)%2===0;
      if(inlay){ctx.fillStyle=isTown?"rgba(60,55,70,0.2)":"rgba(30,28,40,0.3)";ctx.fillRect(px+8,py+8,24,24);}
      // Subtle wear marks
      if((wx*13+wy*7)%20<2){ctx.fillStyle="rgba(0,0,0,0.1)";ctx.beginPath();ctx.arc(px+20,py+20,6,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.CARPET_RED:ctx.fillStyle=isTown?"#7a2530":"#3a1518";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle=isTown?"#8a2a38":"#4a1a20";ctx.fillRect(px+2,py,TILE-4,TILE);break;
    case T.PEW:ctx.fillStyle=isTown?"#6a5030":"#3a2a1a";ctx.fillRect(px+2,py+8,TILE-4,6);ctx.fillRect(px+2,py+24,TILE-4,6);ctx.fillStyle=isTown?"#7a6040":"#4a3a2a";ctx.fillRect(px+4,py+6,3,26);ctx.fillRect(px+TILE-7,py+6,3,26);break;
    case T.PEW_BROKEN:ctx.fillStyle="#3a2a1a";ctx.fillRect(px+2,py+15,20,5);ctx.fillRect(px+15,py+8,12,4);break;
    case T.ALTAR:ctx.fillStyle=isTown?"#4a4260":"#2a2240";ctx.fillRect(px+2,py+8,TILE-4,TILE-12);ctx.fillStyle="#c4a43e";ctx.fillRect(px+17,py+10,6,18);ctx.fillRect(px+12,py+14,16,4);break;
    case T.STAINED_GLASS:{ctx.fillStyle="#1a1520";ctx.fillRect(px,py,TILE,TILE);const cols=["rgba(80,20,20,0.6)","rgba(20,40,80,0.6)","rgba(80,60,20,0.6)","rgba(30,60,30,0.5)"];const pulse=Math.sin(time*0.001+py*0.1)*0.2+0.5;for(let i=0;i<4;i++){ctx.fillStyle=cols[i];ctx.globalAlpha=pulse;ctx.fillRect(px+4+(i%2)*18,py+4+Math.floor(i/2)*18,14,14);}ctx.globalAlpha=1;break;}
    case T.TORCH_WALL:{
      // Wall background
      const bg=isTown?"#4a4050":"#1a1520";
      ctx.fillStyle=bg;ctx.fillRect(px,py,TILE,TILE);
      // Wall detail
      if(!isTown){
        ctx.fillStyle="#282030";ctx.fillRect(px+2,py+2,TILE-4,4);
        ctx.strokeStyle="#100c18";ctx.lineWidth=1;ctx.strokeRect(px,py,TILE,TILE);
      }else{
        ctx.fillStyle="#5a5060";ctx.fillRect(px+2,py+2,TILE-4,4);
        ctx.strokeStyle="#3a3040";ctx.lineWidth=1;ctx.strokeRect(px,py,TILE,TILE);
      }
      // Metal bracket
      ctx.fillStyle="#4a4040";
      ctx.fillRect(px+14,py+20,12,4); // Horizontal bracket
      ctx.fillRect(px+18,py+18,4,8); // Vertical support
      ctx.fillStyle="#5a5050";
      ctx.fillRect(px+15,py+21,10,2); // Bracket highlight
      // Wooden torch handle
      ctx.fillStyle="#5a4030";
      ctx.fillRect(px+18,py+10,4,14);
      ctx.fillStyle="#6a5040";
      ctx.fillRect(px+19,py+11,2,12); // Wood grain highlight
      // Dynamic flame with multiple oscillations
      const fl1=Math.sin(time*0.006+px*0.5)*2;
      const fl2=Math.sin(time*0.009+px*0.3)*1.5;
      const fl3=Math.cos(time*0.007+py*0.4)*1;
      const flicker=Math.sin(time*0.02+px)*0.15+0.85; // Brightness flicker
      // Outer glow (warm falloff with multiple stops)
      const gr=ctx.createRadialGradient(px+20,py+6+fl1,2,px+20,py+10,22);
      gr.addColorStop(0,`rgba(255,200,100,${0.9*flicker})`);
      gr.addColorStop(0.25,`rgba(255,150,50,${0.6*flicker})`);
      gr.addColorStop(0.5,`rgba(255,100,30,${0.35*flicker})`);
      gr.addColorStop(0.75,`rgba(200,60,10,${0.15*flicker})`);
      gr.addColorStop(1,"rgba(100,30,0,0)");
      ctx.fillStyle=gr;
      ctx.beginPath();ctx.arc(px+20,py+8,22,0,Math.PI*2);ctx.fill();
      // Inner flame layers
      ctx.fillStyle=`rgba(255,180,60,${0.8*flicker})`;
      ctx.beginPath();ctx.arc(px+20+fl3*0.5,py+7+fl1,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,220,100,${0.9*flicker})`;
      ctx.beginPath();ctx.arc(px+20,py+6+fl1*0.8,4.5,0,Math.PI*2);ctx.fill();
      // Hot core
      ctx.fillStyle="#fffae0";
      ctx.beginPath();ctx.arc(px+20,py+6+fl2*0.6,2.5,0,Math.PI*2);ctx.fill();
      // Flame tip (flickering tongue)
      ctx.fillStyle=`rgba(255,200,80,${0.7*flicker})`;
      ctx.beginPath();
      ctx.moveTo(px+20,py+2+fl1*0.5);
      ctx.quadraticCurveTo(px+18+fl3,py+5+fl1,px+20,py+8+fl1);
      ctx.quadraticCurveTo(px+22-fl3,py+5+fl1,px+20,py+2+fl1*0.5);
      ctx.fill();
      // Smoke particles rising
      for(let i=0;i<2;i++){
        const smokePhase=(time*0.015+i*40+px)%50;
        const smokeY=py-smokePhase*0.6;
        const smokeX=px+20+Math.sin(time*0.004+i*2+px)*3;
        const smokeAlpha=Math.max(0,0.2-smokePhase*0.004);
        if(smokeAlpha>0&&smokeY>py-25){
          ctx.fillStyle=`rgba(60,55,50,${smokeAlpha})`;
          ctx.beginPath();ctx.arc(smokeX,smokeY,2+smokePhase*0.05,0,Math.PI*2);ctx.fill();
        }
      }
      break;
    }
    case T.IRON_FENCE:ctx.fillStyle="#2a2830";for(let i=0;i<4;i++)ctx.fillRect(px+4+i*10,py+2,3,TILE-4);break;
    case T.COLLAPSED_ROOF:ctx.fillStyle="#1a1418";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a2228";ctx.fillRect(px+2,py+5,20,12);ctx.fillRect(px+10,py+18,22,10);break;
    case T.CART_WRECK:ctx.fillStyle="#2a2018";ctx.fillRect(px+2,py+12,36,16);ctx.strokeStyle="#4a3828";ctx.lineWidth=2;ctx.beginPath();ctx.arc(px+8,py+30,7,0,Math.PI*2);ctx.stroke();break;
    case T.BARREL:{
      const base=isTown?"#6a4a28":"#3a2a1a";
      const band=isTown?"#8a6838":"#5a4830";
      ctx.fillStyle=base;ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2+2,12,14,0,0,Math.PI*2);ctx.fill();
      // Wood grain
      ctx.fillStyle=isTown?"#7a5a30":"#4a3a22";ctx.fillRect(px+10,py+10,3,20);ctx.fillRect(px+18,py+8,3,24);ctx.fillRect(px+26,py+10,3,20);
      // Metal bands
      ctx.strokeStyle=band;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(px+TILE/2,py+12,11,3,0,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.ellipse(px+TILE/2,py+28,11,3,0,0,Math.PI*2);ctx.stroke();
      // Top
      ctx.fillStyle=isTown?"#5a3a20":"#2a1a12";ctx.beginPath();ctx.ellipse(px+TILE/2,py+8,10,4,0,0,Math.PI*2);ctx.fill();
      break;
    }
    case T.STATUE_BROKEN:ctx.fillStyle="#3a3548";ctx.fillRect(px+8,py+20,24,18);ctx.fillStyle="#2a2538";ctx.fillRect(px+3,py+8,14,10);break;
    case T.STATUE_INTACT:ctx.fillStyle=getTileColor(T.COBBLE_CLEAN);ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a5a68";ctx.fillRect(px+10,py+18,20,20);ctx.fillStyle="#6a6a78";ctx.fillRect(px+14,py+4,12,16);ctx.fillStyle="#7a7a88";ctx.fillRect(px+16,py+2,8,6);break;
    case T.SIGN_POST:{
      ctx.fillStyle=getTileColor(isTown?T.COBBLE_CLEAN:T.GRASS);ctx.fillRect(px,py,TILE,TILE);
      // Post
      ctx.fillStyle="#4a3420";ctx.fillRect(px+18,py+16,4,24);
      ctx.fillStyle="#5a4428";ctx.fillRect(px+19,py+18,2,20);
      // Sign board
      ctx.fillStyle="#6a5030";ctx.fillRect(px+6,py+8,28,12);
      ctx.fillStyle="#7a6040";ctx.fillRect(px+8,py+10,24,8);
      // Arrow indicator
      ctx.fillStyle="#4a3820";
      ctx.beginPath();ctx.moveTo(px+28,py+14);ctx.lineTo(px+34,py+14);ctx.lineTo(px+31,py+11);ctx.lineTo(px+34,py+14);ctx.lineTo(px+31,py+17);ctx.fill();
      // Text lines
      ctx.fillStyle="#3a2818";ctx.fillRect(px+10,py+12,16,1);ctx.fillRect(px+10,py+15,12,1);
      break;
    }
    case T.ARCH:ctx.fillStyle="#3a3448";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a2438";ctx.beginPath();ctx.arc(px+TILE/2,py+TILE,TILE/2-2,Math.PI,0);ctx.fill();break;
    case T.BONE_PILE:ctx.fillStyle="#c8c0a8";ctx.fillRect(px+8,py+14,14,2);ctx.fillRect(px+18,py+20,12,2);ctx.fillStyle="#a8a088";ctx.beginPath();ctx.arc(px+20,py+26,5,0,Math.PI*2);ctx.fill();break;
    case T.EMBER_GROUND:{const g=Math.sin(time*0.003+wx+wy)*0.3+0.5;ctx.fillStyle=`rgba(200,80,20,${g*0.4})`;ctx.beginPath();ctx.arc(px+12+((wx*7)%16),py+10+((wy*5)%18),3,0,Math.PI*2);ctx.fill();break;}
    case T.WATER_PUDDLE:{const w=Math.sin(time*0.002+px*0.1)*0.15;ctx.fillStyle=`rgba(20,25,45,${0.5+w})`;ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2,14,10,0,0,Math.PI*2);ctx.fill();break;}
    case T.GALLOWS:ctx.fillStyle="#2a2018";ctx.fillRect(px+14,py+4,6,36);ctx.fillRect(px+14,py+4,22,4);break;
    case T.HANGING_BODY:ctx.fillStyle="#3a3020";ctx.fillRect(px+20,py+0,2,12);ctx.fillStyle="#2a1a20";ctx.fillRect(px+16,py+12,10,18);break;
    case T.CHAIN:ctx.strokeStyle="#505860";ctx.lineWidth=1.5;for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(px+20,py+4+i*8,3,0,Math.PI*2);ctx.stroke();}break;
    case T.WELL:{
      ctx.fillStyle=isTown?"#5a5568":"#2a2535";ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,15,0,Math.PI*2);ctx.fill();
      // Stone rim detail
      ctx.strokeStyle=isTown?"#6a6578":"#3a3545";ctx.lineWidth=2;ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,14,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=isTown?"#4a4558":"#1a1525";ctx.lineWidth=1;ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,12,0,Math.PI*2);ctx.stroke();
      // Dark water inside
      ctx.fillStyle="#080810";ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,9,0,Math.PI*2);ctx.fill();
      // Subtle water reflection
      const wr=Math.sin(time*0.002)*0.2;
      ctx.fillStyle=`rgba(40,60,100,${0.3+wr})`;ctx.beginPath();ctx.arc(px+TILE/2-2,py+TILE/2-2,4,0,Math.PI*2);ctx.fill();
      // Wooden frame
      ctx.fillStyle=isTown?"#5a4030":"#3a2820";ctx.fillRect(px+8,py+2,4,12);ctx.fillRect(px+28,py+2,4,12);
      ctx.fillRect(px+6,py+2,28,3);
      break;
    }
    case T.BANNER_TORN:ctx.fillStyle="#3a1520";ctx.fillRect(px+16,py+4,10,28);break;
    case T.WINDOW_BROKEN:ctx.fillStyle="#1a1520";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#0a0810";ctx.fillRect(px+8,py+6,24,20);break;
    case T.CRATE:ctx.fillStyle=isTown?"#6a5030":"#3a2a1a";ctx.fillRect(px+6,py+6,28,28);ctx.strokeStyle=isTown?"#8a6838":"#4a3828";ctx.lineWidth=1.5;ctx.strokeRect(px+6,py+6,28,28);break;
    case T.WEAPON_RACK:ctx.fillStyle=isTown?"#4a3828":"#2a2018";ctx.fillRect(px+4,py+4,32,32);ctx.fillStyle="#808890";ctx.fillRect(px+10,py+12,2,20);ctx.fillRect(px+20,py+14,2,16);ctx.fillStyle="#a0a8b0";ctx.fillRect(px+28,py+10,3,22);break;
    case T.CANDLE:{ctx.fillStyle="#e8e0c0";ctx.fillRect(px+18,py+18,4,14);const fl=Math.sin(time*0.008+px*0.7+py*0.3)*1.5;ctx.fillStyle="rgba(255,180,60,0.4)";ctx.beginPath();ctx.arc(px+20,py+16+fl,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,220,100,0.6)";ctx.beginPath();ctx.arc(px+20,py+16+fl,5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffe080";ctx.beginPath();ctx.arc(px+20,py+16+fl,2.5,0,Math.PI*2);ctx.fill();break;}
    case T.DEBRIS:ctx.fillStyle="#2a2430";ctx.fillRect(px+3,py+10,10,6);ctx.fillRect(px+18,py+5,14,8);break;
    case T.FOUNDATION:ctx.fillStyle="#1c1820";ctx.fillRect(px,py,TILE,TILE);break;
    case T.RELIC:{ctx.fillStyle="#1a1828";ctx.fillRect(px,py,TILE,TILE);const glow=Math.sin(time*0.003)*0.4+0.6;ctx.fillStyle=`rgba(160,120,60,${glow*0.3})`;ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,16,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(200,180,100,${glow*0.6})`;ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,10,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(255,220,120,${glow})`;ctx.fillRect(px+16,py+14,8,12);ctx.fillStyle="#c4a43e";ctx.fillRect(px+15,py+12,10,3);ctx.fillRect(px+15,py+25,10,3);break;}
    case T.JAR:{ctx.fillStyle=isTown?"#5a4830":"#1c1812";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#8a6a48";ctx.beginPath();ctx.ellipse(px+20,py+28,10,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#9a7a58";ctx.beginPath();ctx.ellipse(px+20,py+20,8,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#6a5038";ctx.fillRect(px+16,py+8,8,6);ctx.fillStyle="#aa8a68";ctx.beginPath();ctx.ellipse(px+20,py+18,6,4,0,0,Math.PI*2);ctx.fill();break;}
    case T.DOOR_CLOSED:{ctx.fillStyle=isTown?"#5a4830":"#1c1812";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a3a1a";ctx.fillRect(px+6,py+2,28,36);ctx.fillStyle="#7a5a30";ctx.fillRect(px+8,py+4,24,32);ctx.strokeStyle="#4a2a10";ctx.lineWidth=2;ctx.strokeRect(px+8,py+4,24,32);ctx.fillStyle="#c4a43e";ctx.beginPath();ctx.arc(px+28,py+20,3,0,Math.PI*2);ctx.fill();break;}
    case T.GRASS:{
      ctx.fillStyle="#2a5420";ctx.fillRect(px,py,TILE,TILE);
      // Grass blades variation
      const seed=(wx*31+wy*17)%100;
      ctx.fillStyle="#2e5c24";for(let i=0;i<6;i++){const gx=px+((i*17+wy)%TILE),gy=py+((i*13+wx)%TILE);ctx.fillRect(gx,gy,1,3+seed%2);}
      ctx.fillStyle="#265018";for(let i=0;i<3;i++){const gx=px+((i*23+wy)%TILE),gy=py+((i*19+wx)%TILE);ctx.fillRect(gx,gy,1,2);}
      // Subtle ground texture
      if(seed<15){ctx.fillStyle="rgba(60,40,20,0.15)";ctx.beginPath();ctx.arc(px+10+seed%20,py+15+seed%15,3,0,Math.PI*2);ctx.fill();}
      if(seed>85){ctx.fillStyle="rgba(80,100,40,0.2)";ctx.fillRect(px+5+seed%25,py+8+seed%20,4,2);}
      break;
    }
    case T.GRASS_DARK:{
      ctx.fillStyle="#1e4018";ctx.fillRect(px,py,TILE,TILE);
      ctx.fillStyle="#224418";for(let i=0;i<4;i++){const gx=px+((i*19+wy)%TILE),gy=py+((i*11+wx)%TILE);ctx.fillRect(gx,gy,1,4);}
      // Shadow patches
      ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(px+2+(wx%12),py+5+(wy%10),12,8);
      // Fallen leaves
      const seed=(wx*7+wy*13)%100;
      if(seed<20){ctx.fillStyle="#4a3a18";ctx.fillRect(px+8+seed%20,py+12+seed%15,3,2);}
      break;
    }
    case T.PATH:{
      ctx.fillStyle="#8a7a60";ctx.fillRect(px,py,TILE,TILE);
      // Dirt patches
      ctx.fillStyle="#7a6a50";ctx.fillRect(px+5,py+8,8,5);ctx.fillRect(px+20,py+20,10,6);
      ctx.fillStyle="#9a8a68";ctx.fillRect(px+15,py+5,6,4);
      // Subtle footprint impressions
      const seed=(wx*13+wy*17)%100;
      if(seed<25){ctx.fillStyle="rgba(100,85,60,0.4)";ctx.beginPath();ctx.ellipse(px+12+seed%10,py+18,3,5,0.2,0,Math.PI*2);ctx.fill();}
      if(seed>75){ctx.fillStyle="rgba(100,85,60,0.3)";ctx.beginPath();ctx.ellipse(px+25-seed%8,py+12,3,5,-0.2,0,Math.PI*2);ctx.fill();}
      // Edge grass tufts
      if(seed<15){ctx.fillStyle="#4a6a30";ctx.fillRect(px+2,py+seed%30,1,3);}
      if(seed>85){ctx.fillStyle="#4a6a30";ctx.fillRect(px+36,py+seed%25,1,3);}
      break;
    }
    case T.WOOD_FLOOR:{
      ctx.fillStyle="#5a4830";ctx.fillRect(px,py,TILE,TILE);
      // Wood plank lines
      ctx.strokeStyle="rgba(80,60,40,0.5)";ctx.lineWidth=0.5;
      ctx.beginPath();ctx.moveTo(px,py+10);ctx.lineTo(px+TILE,py+10);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px,py+20);ctx.lineTo(px+TILE,py+20);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px,py+30);ctx.lineTo(px+TILE,py+30);ctx.stroke();
      // Wood grain
      ctx.fillStyle="rgba(90,70,50,0.2)";
      const gr=(wx+wy)%4;ctx.fillRect(px+gr*3+5,py+4,12,2);ctx.fillRect(px+gr*5+2,py+24,10,1);
      // Knots
      if((wx*7+wy*11)%15<1){ctx.fillStyle="rgba(60,40,25,0.4)";ctx.beginPath();ctx.arc(px+15+(wx%10),py+15+(wy%10),2,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.MARKET_STALL:ctx.fillStyle="#6a4a28";ctx.fillRect(px+2,py+8,TILE-4,TILE-12);ctx.fillStyle="#8a5a30";ctx.fillRect(px,py+4,TILE,6);ctx.fillStyle="#aa3030";ctx.fillRect(px+2,py,TILE-4,6);break;
    case T.FLOWER:{
      ctx.fillStyle="#2a5420";ctx.fillRect(px,py,TILE,TILE);
      // Grass base
      ctx.fillStyle="#2e5c24";for(let i=0;i<4;i++){ctx.fillRect(px+((i*11+wy)%TILE),py+((i*7+wx)%TILE),1,3);}
      // Flowers with slight animation
      const cols=["#e05080","#e0c040","#5080e0","#e08040","#e060a0","#80e060"];
      const ci=(wx*7+wy*13)%6;
      const sway=Math.sin(time*0.002+wx*0.1)*1;
      // Main flower
      ctx.fillStyle="#3a6a28";ctx.fillRect(px+13,py+14,2,12); // stem
      ctx.fillStyle=cols[ci];ctx.beginPath();ctx.arc(px+14+sway,py+12,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ffe060";ctx.beginPath();ctx.arc(px+14+sway,py+12,1.5,0,Math.PI*2);ctx.fill(); // center
      // Secondary flower
      ctx.fillStyle="#3a6a28";ctx.fillRect(px+26,py+18,2,10);
      ctx.fillStyle=cols[(ci+3)%6];ctx.beginPath();ctx.arc(px+27-sway*0.5,py+16,3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ffe060";ctx.beginPath();ctx.arc(px+27-sway*0.5,py+16,1,0,Math.PI*2);ctx.fill();
      break;
    }
    case T.HAY:ctx.fillStyle="#8a7a40";ctx.fillRect(px+4,py+4,TILE-8,TILE-8);ctx.fillStyle="#9a8a48";ctx.fillRect(px+6,py+6,TILE-12,4);ctx.fillRect(px+8,py+14,TILE-16,4);break;
    case T.FENCE:ctx.fillStyle="#5a4428";ctx.fillRect(px+2,py+12,TILE-4,4);ctx.fillRect(px+2,py+24,TILE-4,4);ctx.fillRect(px+8,py+6,4,28);ctx.fillRect(px+28,py+6,4,28);break;
    case T.LAMP_POST:{
      ctx.fillStyle=getTileColor(T.GRASS);ctx.fillRect(px,py,TILE,TILE);
      // Shadow
      ctx.fillStyle="rgba(0,0,0,0.2)";ctx.beginPath();ctx.ellipse(px+22,py+38,6,2,0,0,Math.PI*2);ctx.fill();
      // Post
      ctx.fillStyle="#3a3535";ctx.fillRect(px+18,py+16,4,24);
      ctx.fillStyle="#4a4545";ctx.fillRect(px+19,py+18,2,20);
      // Lantern housing
      ctx.fillStyle="#5a5555";ctx.fillRect(px+14,py+10,12,8);
      ctx.fillStyle="#6a6565";ctx.fillRect(px+15,py+11,10,6);
      // Top ornament
      ctx.fillStyle="#4a4545";ctx.fillRect(px+17,py+6,6,5);
      ctx.fillRect(px+19,py+4,2,3);
      // Light glow
      const fl=Math.sin(time*0.005+px)*1.5;
      const gr=ctx.createRadialGradient(px+20,py+14+fl,3,px+20,py+14,25);
      gr.addColorStop(0,"rgba(255,220,140,0.85)");gr.addColorStop(0.3,"rgba(255,180,80,0.4)");gr.addColorStop(0.6,"rgba(255,120,40,0.15)");gr.addColorStop(1,"rgba(200,80,20,0)");
      ctx.fillStyle=gr;ctx.fillRect(px-5,py-8,TILE+10,35);
      // Flame
      ctx.fillStyle="#fff8e0";ctx.beginPath();ctx.arc(px+20,py+14+fl,2.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ffe080";ctx.beginPath();ctx.arc(px+20,py+13+fl*0.8,1.5,0,Math.PI*2);ctx.fill();
      break;
    }
    case T.DOOR:ctx.fillStyle="#5a3a1a";ctx.fillRect(px+10,py+2,TILE-20,TILE-4);ctx.fillStyle="#7a5a30";ctx.fillRect(px+12,py+4,TILE-24,TILE-8);ctx.fillStyle="#c4a43e";ctx.fillRect(px+TILE/2+4,py+TILE/2,3,3);break;
    case T.FOUNTAIN:{
      ctx.fillStyle="#4a5a68";ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,17,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#5a6a78";ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#2a4a60";ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,11,0,Math.PI*2);ctx.fill();
      // Animated water ripples
      const w1=Math.sin(time*0.004+px)*2,w2=Math.sin(time*0.003+py)*1.5;
      ctx.strokeStyle="rgba(100,180,240,0.3)";ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,6+w1,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,9+w2,0,Math.PI*2);ctx.stroke();
      // Center spout
      ctx.fillStyle="#6a7a88";ctx.fillRect(px+18,py+14,4,12);
      // Water spray particles
      for(let i=0;i<3;i++){
        const spray=Math.sin(time*0.008+i*2)*3;
        ctx.fillStyle=`rgba(150,200,255,${0.5-i*0.15})`;
        ctx.beginPath();ctx.arc(px+20+spray,py+12-i*3,2-i*0.5,0,Math.PI*2);ctx.fill();
      }
      break;
    }
    case T.WATER:{
      ctx.fillStyle="#1a3a50";ctx.fillRect(px,py,TILE,TILE);
      // Animated waves
      const w=Math.sin(time*0.002+px*0.1+py*0.05);
      ctx.fillStyle=`rgba(30,70,120,${0.4+w*0.1})`;ctx.fillRect(px,py,TILE,TILE);
      // Wave lines
      ctx.strokeStyle=`rgba(60,120,180,${0.3+w*0.1})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(px,py+10+w*2);ctx.quadraticCurveTo(px+20,py+8+w*3,px+TILE,py+12+w*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px,py+25-w*2);ctx.quadraticCurveTo(px+20,py+28-w*3,px+TILE,py+24-w*2);ctx.stroke();
      // Sparkle
      if((px+py+Math.floor(time*0.01))%80<5){ctx.fillStyle="rgba(200,230,255,0.5)";ctx.beginPath();ctx.arc(px+15+(px%15),py+15+(py%10),1.5,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.BANNER:ctx.fillStyle=getTileColor(T.COBBLE_CLEAN);ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#8a2020";ctx.fillRect(px+15,py+4,10,28);ctx.fillStyle="#aa3030";ctx.fillRect(px+13,py+2,14,4);ctx.fillStyle="#c4a43e";ctx.fillRect(px+17,py+10,6,6);break;
    case T.PLANTER:ctx.fillStyle="#5a4428";ctx.fillRect(px+6,py+6,28,28);ctx.fillStyle="#3a6a28";ctx.beginPath();ctx.arc(px+20,py+14,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#4a7a30";ctx.beginPath();ctx.arc(px+16,py+10,6,0,Math.PI*2);ctx.fill();break;
    case T.BENCH:ctx.fillStyle="#5a4428";ctx.fillRect(px+4,py+14,TILE-8,12);ctx.fillRect(px+6,py+10,4,20);ctx.fillRect(px+TILE-10,py+10,4,20);break;
    case T.TREE:{
      ctx.fillStyle=getTileColor(isTown?T.GRASS:T.COBBLE);ctx.fillRect(px,py,TILE,TILE);
      // Shadow
      ctx.fillStyle="rgba(0,0,0,0.2)";ctx.beginPath();ctx.ellipse(px+20,py+36,12,4,0,0,Math.PI*2);ctx.fill();
      // Trunk with bark texture
      ctx.fillStyle="#3a2810";ctx.fillRect(px+16,py+22,8,18);
      ctx.fillStyle="#4a3818";ctx.fillRect(px+17,py+24,2,14);
      ctx.fillStyle="#2a1808";ctx.fillRect(px+21,py+26,2,10);
      // Foliage layers
      ctx.fillStyle="#1a4a14";ctx.beginPath();ctx.arc(px+20,py+18,14,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#1e5a18";ctx.beginPath();ctx.arc(px+16,py+14,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#226820";ctx.beginPath();ctx.arc(px+24,py+12,8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#2a7828";ctx.beginPath();ctx.arc(px+20,py+8,6,0,Math.PI*2);ctx.fill();
      // Leaf highlights
      const fl=Math.sin(time*0.001+px*0.1)*0.5;
      ctx.fillStyle="rgba(60,140,50,0.3)";ctx.beginPath();ctx.arc(px+14+fl,py+10,3,0,Math.PI*2);ctx.fill();
      break;
    }
    case T.BUSH:{
      ctx.fillStyle=getTileColor(T.GRASS);ctx.fillRect(px,py,TILE,TILE);
      // Shadow
      ctx.fillStyle="rgba(0,0,0,0.15)";ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2+6,12,5,0,0,Math.PI*2);ctx.fill();
      // Bush layers
      ctx.fillStyle="#1e3a12";ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2+2,15,11,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#2a4a1a";ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2,14,10,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#345a22";ctx.beginPath();ctx.ellipse(px+TILE/2-3,py+TILE/2-2,9,7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#3e6a2a";ctx.beginPath();ctx.ellipse(px+TILE/2+4,py+TILE/2-4,7,5,0,0,Math.PI*2);ctx.fill();
      // Berries (sometimes)
      const seed=(wx*11+wy*19)%100;
      if(seed<40){
        ctx.fillStyle=seed<20?"#c04040":"#4040c0";
        ctx.beginPath();ctx.arc(px+12+seed%8,py+16,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+24-seed%6,py+20,2,0,Math.PI*2);ctx.fill();
      }
      break;
    }
    case T.WINDOW:{const bg=isTown?"#4a4050":"#1a1520";ctx.fillStyle=bg;ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a5a7a";ctx.fillRect(px+8,py+6,24,20);ctx.strokeStyle="#5a5060";ctx.lineWidth=1.5;ctx.strokeRect(px+8,py+6,24,20);ctx.strokeRect(px+20,py+6,0.5,20);const glow=Math.sin(time*0.002+wy)*0.15+0.35;ctx.fillStyle=`rgba(255,200,100,${glow})`;ctx.fillRect(px+9,py+7,22,18);break;}
    case T.CARPET:ctx.fillStyle="#6a3040";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#7a3848";ctx.fillRect(px+2,py+2,TILE-4,TILE-4);break;
    case T.CHIMNEY:ctx.fillStyle="#3a3040";ctx.fillRect(px+10,py+6,20,28);ctx.fillStyle="#4a4050";ctx.fillRect(px+8,py+4,24,6);break;
    // Forest tiles
    case T.DIRT:{
      ctx.fillStyle="#4a3a20";ctx.fillRect(px,py,TILE,TILE);
      // Dirt texture variation
      const seed=(wx*17+wy*23)%100;
      ctx.fillStyle="#3a2a18";ctx.fillRect(px+8,py+12,10,5);ctx.fillRect(px+22,py+24,8,4);
      ctx.fillStyle="#5a4a28";ctx.fillRect(px+3+seed%10,py+5+seed%8,6,3);
      // Small pebbles
      if(seed<30){ctx.fillStyle="#6a5a38";ctx.beginPath();ctx.arc(px+10+seed%15,py+28-seed%10,2,0,Math.PI*2);ctx.fill();}
      if(seed>70){ctx.fillStyle="#4a3a25";ctx.beginPath();ctx.arc(px+25-seed%10,py+10+seed%12,1.5,0,Math.PI*2);ctx.fill();}
      // Occasional grass sprout
      if(seed>90){ctx.fillStyle="#3a5a20";ctx.fillRect(px+15+seed%10,py+20,1,4);}
      break;
    }
    case T.DENSE_TREE:{
      ctx.fillStyle="#0a2808";ctx.fillRect(px,py,TILE,TILE);
      // Heavy shadow
      ctx.fillStyle="rgba(0,0,0,0.3)";ctx.beginPath();ctx.ellipse(px+20,py+36,14,5,0,0,Math.PI*2);ctx.fill();
      // Thick trunk
      ctx.fillStyle="#1a1808";ctx.fillRect(px+14,py+20,12,20);
      ctx.fillStyle="#221a0a";ctx.fillRect(px+16,py+22,4,16);
      // Dense canopy layers
      ctx.fillStyle="#0a3008";ctx.beginPath();ctx.arc(px+20,py+16,18,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#0c3a0a";ctx.beginPath();ctx.arc(px+14,py+12,14,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#0c3a0a";ctx.beginPath();ctx.arc(px+26,py+14,12,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#0e440c";ctx.beginPath();ctx.arc(px+20,py+8,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#10500e";ctx.beginPath();ctx.arc(px+18,py+4,6,0,Math.PI*2);ctx.fill();
      break;
    }
    case T.FALLEN_LOG:{const bg=isTown?T.GRASS:T.GRASS_DARK;ctx.fillStyle=getTileColor(bg);ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a2a14";ctx.fillRect(px+2,py+16,36,10);ctx.fillStyle="#4a3a20";ctx.fillRect(px+4,py+18,32,6);break;}
    case T.CAMP_FIRE:{
      ctx.fillStyle="#4a3a20";ctx.fillRect(px,py,TILE,TILE);
      // Fire pit stones
      ctx.fillStyle="#3a3030";ctx.beginPath();ctx.arc(px+20,py+26,9,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#4a4040";for(let i=0;i<6;i++){const ang=i*Math.PI/3;ctx.beginPath();ctx.arc(px+20+Math.cos(ang)*8,py+26+Math.sin(ang)*4,3,0,Math.PI*2);ctx.fill();}
      // Fire glow
      const fl=Math.sin(time*0.007+px)*2;
      const gr=ctx.createRadialGradient(px+20,py+18+fl,2,px+20,py+22,22);
      gr.addColorStop(0,"rgba(255,200,60,0.95)");gr.addColorStop(0.3,"rgba(255,120,20,0.6)");gr.addColorStop(0.6,"rgba(200,40,0,0.2)");gr.addColorStop(1,"rgba(100,20,0,0)");
      ctx.fillStyle=gr;ctx.fillRect(px,py,TILE,TILE);
      // Fire core
      ctx.fillStyle="#fff8e0";ctx.beginPath();ctx.arc(px+20,py+20+fl,3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ffcc40";ctx.beginPath();ctx.arc(px+18,py+18+fl*0.8,4,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(px+22,py+16+fl*1.2,3,0,Math.PI*2);ctx.fill();
      // Smoke particles
      for(let i=0;i<3;i++){
        const smokeY=py+10-i*6-(time*0.02+i*20)%30;
        const smokeX=px+20+Math.sin(time*0.003+i*2)*3;
        ctx.fillStyle=`rgba(60,55,50,${0.3-i*0.1})`;ctx.beginPath();ctx.arc(smokeX,smokeY,3+i,0,Math.PI*2);ctx.fill();
      }
      // Sparks
      if((time+px)%40<10){ctx.fillStyle="rgba(255,200,80,0.8)";ctx.beginPath();ctx.arc(px+15+(time%10),py+12-((time*0.1)%8),1,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.TENT:ctx.fillStyle=getTileColor(T.GRASS_DARK);ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a4a30";ctx.beginPath();ctx.moveTo(px+20,py+4);ctx.lineTo(px+2,py+36);ctx.lineTo(px+38,py+36);ctx.closePath();ctx.fill();ctx.fillStyle="#6a5a38";ctx.fillRect(px+14,py+24,12,12);break;
    case T.SWAMP:{ctx.fillStyle="#1a3a18";ctx.fillRect(px,py,TILE,TILE);const sw=Math.sin(time*0.002+wx*0.1+wy*0.1)*0.1;ctx.fillStyle=`rgba(30,60,20,${0.4+sw})`;ctx.beginPath();ctx.ellipse(px+20,py+20,14,10,0,0,Math.PI*2);ctx.fill();break;}
    case T.MOSS_STONE:ctx.fillStyle=getTileColor(T.CAVE_FLOOR);ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a4a38";ctx.fillRect(px+6,py+8,28,24);ctx.fillStyle="#4a5a40";ctx.fillRect(px+8,py+6,12,8);break;
    // Cave tiles
    case T.CAVE_FLOOR:{
      ctx.fillStyle="#1a1820";ctx.fillRect(px,py,TILE,TILE);
      const seed=(wx*19+wy*29)%100;
      // Rocky texture
      ctx.fillStyle="#1e1c24";ctx.fillRect(px+5,py+8,8,5);ctx.fillRect(px+20,py+20,10,6);
      ctx.fillStyle="#161418";ctx.fillRect(px+15+seed%10,py+5+seed%8,7,4);
      // Damp spots
      if(seed<20){ctx.fillStyle="rgba(30,40,60,0.3)";ctx.beginPath();ctx.ellipse(px+12+seed%15,py+25-seed%10,5,3,0,0,Math.PI*2);ctx.fill();}
      // Small rocks
      if(seed>60){ctx.fillStyle="#24222a";ctx.beginPath();ctx.arc(px+28-seed%12,py+8+seed%15,2,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.CAVE_WALL:{
      ctx.fillStyle="#0c0a10";ctx.fillRect(px,py,TILE,TILE);
      // Rock layers
      ctx.fillStyle="#141218";ctx.fillRect(px+2,py+2,TILE-4,5);ctx.fillRect(px+2,py+TILE-7,TILE-4,5);
      ctx.fillStyle="#181620";ctx.fillRect(px+2,py+14,TILE-4,4);
      // Cracks and texture
      const seed=(wx*13+wy*17)%100;
      ctx.strokeStyle="rgba(30,25,40,0.5)";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(px+5+seed%10,py+8);ctx.lineTo(px+15+seed%8,py+20);ctx.lineTo(px+25,py+28);ctx.stroke();
      // Embedded minerals occasionally
      if(seed<15){ctx.fillStyle="rgba(80,70,100,0.4)";ctx.beginPath();ctx.arc(px+12+seed%15,py+20+seed%10,2,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.MUSHROOM:{ctx.fillStyle="#1a1820";ctx.fillRect(px,py,TILE,TILE);const gl=Math.sin(time*0.004+wx+wy)*0.3+0.7;ctx.fillStyle="#4a3a2a";ctx.fillRect(px+18,py+22,4,12);ctx.fillStyle=`rgba(40,120,100,${gl*0.3})`;ctx.beginPath();ctx.arc(px+20,py+18,12,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(80,200,160,${gl*0.6})`;ctx.beginPath();ctx.arc(px+20,py+18,7,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(100,220,180,${gl*0.8})`;ctx.beginPath();ctx.ellipse(px+20,py+18,10,6,0,0,Math.PI*2);ctx.fill();break;}
    case T.STALACTITE:{
      ctx.fillStyle="#0c0a10";ctx.fillRect(px,py,TILE,TILE);
      // Main stalactite
      ctx.fillStyle="#2a2838";ctx.beginPath();ctx.moveTo(px+12,py);ctx.lineTo(px+20,py+30);ctx.lineTo(px+28,py);ctx.fill();
      ctx.fillStyle="#3a3848";ctx.beginPath();ctx.moveTo(px+16,py);ctx.lineTo(px+20,py+26);ctx.lineTo(px+24,py);ctx.fill();
      // Smaller ones
      ctx.fillStyle="#252530";ctx.beginPath();ctx.moveTo(px+32,py);ctx.lineTo(px+35,py+16);ctx.lineTo(px+38,py);ctx.fill();
      ctx.fillStyle="#252530";ctx.beginPath();ctx.moveTo(px+2,py);ctx.lineTo(px+6,py+12);ctx.lineTo(px+10,py);ctx.fill();
      // Dripping water effect
      const drip=(time*0.05+wy)%40;
      if(drip<30){ctx.fillStyle=`rgba(100,140,180,${0.6-drip/50})`;ctx.beginPath();ctx.arc(px+20,py+30+drip*0.5,1.5-drip/60,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.SPIDER_WEB:{
      ctx.fillStyle="#1a1820";ctx.fillRect(px,py,TILE,TILE);
      // Web structure
      ctx.strokeStyle="rgba(200,200,210,0.3)";ctx.lineWidth=0.5;
      for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(px+20,py+20);ctx.lineTo(px+20+Math.cos(a)*18,py+20+Math.sin(a)*18);ctx.stroke();}
      // Spiral rings
      ctx.strokeStyle="rgba(200,200,210,0.2)";
      for(let r=5;r<=17;r+=4){ctx.beginPath();ctx.arc(px+20,py+20,r,0,Math.PI*2);ctx.stroke();}
      // Dew drops
      const seed=(wx*7+wy*11)%100;
      if(seed<40){ctx.fillStyle="rgba(180,200,220,0.4)";ctx.beginPath();ctx.arc(px+10+seed%15,py+12+seed%12,1,0,Math.PI*2);ctx.fill();}
      break;
    }
    case T.UNDERGROUND_WATER:{
      ctx.fillStyle="#0a1828";ctx.fillRect(px,py,TILE,TILE);
      // Water surface with bioluminescent glow
      const uw=Math.sin(time*0.002+wx*0.15+wy*0.1);
      ctx.fillStyle=`rgba(15,45,90,${0.5+uw*0.1})`;ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
      // Ripple lines
      ctx.strokeStyle=`rgba(40,80,140,${0.3+uw*0.1})`;ctx.lineWidth=0.5;
      ctx.beginPath();ctx.moveTo(px,py+12+uw*2);ctx.quadraticCurveTo(px+20,py+10+uw*3,px+TILE,py+14+uw*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px,py+28-uw*2);ctx.quadraticCurveTo(px+20,py+30-uw*3,px+TILE,py+26-uw*2);ctx.stroke();
      // Bioluminescent spots
      const seed=(wx*11+wy*7)%100;
      if(seed<30){
        const glow=Math.sin(time*0.003+seed)*0.3+0.5;
        ctx.fillStyle=`rgba(60,180,200,${glow*0.4})`;ctx.beginPath();ctx.arc(px+8+seed%20,py+10+seed%18,3,0,Math.PI*2);ctx.fill();
      }
      break;
    }
    case T.CRYSTAL:{ctx.fillStyle="#1a1820";ctx.fillRect(px,py,TILE,TILE);const cg=Math.sin(time*0.003+wy*0.2)*0.4+0.6;ctx.fillStyle=`rgba(60,80,200,${cg*0.3})`;ctx.beginPath();ctx.arc(px+20,py+20,16,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(120,160,255,${cg*0.6})`;ctx.beginPath();ctx.arc(px+20,py+20,10,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(140,180,255,${cg})`;ctx.beginPath();ctx.moveTo(px+16,py+28);ctx.lineTo(px+20,py+8);ctx.lineTo(px+24,py+28);ctx.fill();break;}
    // Hazard tiles
    case T.SPIKE_TRAP:{ctx.fillStyle="#2a2020";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#505058";for(let i=0;i<3;i++)for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(px+8+i*12,py+32);ctx.lineTo(px+12+i*12,py+8+j*4);ctx.lineTo(px+16+i*12,py+32);ctx.fill();}break;}
    case T.POISON_PUDDLE:{ctx.fillStyle="#203020";ctx.fillRect(px,py,TILE,TILE);const pg=Math.sin(time*0.003+wx)*0.2+0.6;ctx.fillStyle=`rgba(80,180,80,${pg})`;ctx.beginPath();ctx.ellipse(px+20,py+22,14,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(60,140,60,${pg*0.7})`;ctx.beginPath();ctx.ellipse(px+20,py+20,10,7,0,0,Math.PI*2);ctx.fill();if(Math.random()<0.05){ctx.fillStyle="rgba(100,200,100,0.6)";ctx.beginPath();ctx.arc(px+15+Math.random()*10,py+18,2,0,Math.PI*2);ctx.fill();}break;}
    case T.LAVA:{ctx.fillStyle="#4a2010";ctx.fillRect(px,py,TILE,TILE);const lg=Math.sin(time*0.004+wx*0.1+wy*0.1)*0.3+0.7;ctx.fillStyle=`rgba(255,100,20,${lg})`;ctx.fillRect(px+2,py+2,TILE-4,TILE-4);ctx.fillStyle=`rgba(255,180,40,${lg*0.8})`;ctx.fillRect(px+6,py+6,TILE-12,TILE-12);ctx.fillStyle=`rgba(255,220,100,${lg*0.5})`;ctx.beginPath();ctx.arc(px+15+Math.sin(time*0.002)*5,py+20,4,0,Math.PI*2);ctx.fill();break;}
    case T.ICE:{ctx.fillStyle="#405060";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="rgba(150,180,220,0.4)";ctx.fillRect(px+2,py+2,TILE-4,TILE-4);ctx.strokeStyle="rgba(200,220,255,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+5,py+10);ctx.lineTo(px+35,py+15);ctx.moveTo(px+10,py+25);ctx.lineTo(px+30,py+30);ctx.stroke();break;}
    case T.FIRE_TRAP:{ctx.fillStyle="#3a2010";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a1808";ctx.beginPath();ctx.arc(px+20,py+20,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#4a3020";ctx.beginPath();ctx.arc(px+20,py+20,8,0,Math.PI*2);ctx.fill();break;}
    // Interactive tiles
    case T.LEVER:{ctx.fillStyle="#4a4040";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a3030";ctx.fillRect(px+16,py+30,8,8);ctx.fillStyle="#606060";ctx.fillRect(px+18,py+10,4,22);ctx.fillStyle="#808080";ctx.beginPath();ctx.arc(px+20,py+10,5,0,Math.PI*2);ctx.fill();break;}
    case T.PRESSURE_PLATE:{ctx.fillStyle="#3a3030";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#4a4040";ctx.fillRect(px+4,py+4,TILE-8,TILE-8);ctx.strokeStyle="#2a2020";ctx.lineWidth=2;ctx.strokeRect(px+6,py+6,TILE-12,TILE-12);break;}
    case T.TREASURE_CHEST:{ctx.fillStyle="#5a4830";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#6a5020";ctx.fillRect(px+6,py+14,28,18);ctx.fillStyle="#8a6a30";ctx.fillRect(px+8,py+16,24,14);ctx.fillStyle="#c4a43e";ctx.fillRect(px+17,py+20,6,6);ctx.fillStyle="#5a4020";ctx.fillRect(px+6,py+12,28,4);break;}
    case T.LOCKED_CHEST:{ctx.fillStyle="#4a3820";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a4020";ctx.fillRect(px+6,py+14,28,18);ctx.fillStyle="#6a5030";ctx.fillRect(px+8,py+16,24,14);ctx.fillStyle="#808080";ctx.fillRect(px+16,py+18,8,10);ctx.fillStyle="#606060";ctx.beginPath();ctx.arc(px+20,py+22,4,0,Math.PI*2);ctx.fill();break;}
    case T.CRACKED_WALL:{ctx.fillStyle="#282030";ctx.fillRect(px,py,TILE,TILE);ctx.strokeStyle="#1a1520";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+10,py+5);ctx.lineTo(px+20,py+20);ctx.lineTo(px+15,py+35);ctx.moveTo(px+25,py+8);ctx.lineTo(px+30,py+25);ctx.stroke();break;}
    case T.BONFIRE:{ctx.fillStyle=isTown?"#2a5420":"#1c1812";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a2a18";ctx.fillRect(px+12,py+28,16,10);ctx.fillRect(px+10,py+30,20,8);const fl=Math.sin(time*0.007+px)*2;ctx.fillStyle="rgba(255,100,30,0.4)";ctx.beginPath();ctx.arc(px+20,py+20+fl,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,180,60,0.6)";ctx.beginPath();ctx.arc(px+20,py+20+fl,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffe080";ctx.beginPath();ctx.arc(px+20,py+20+fl,5,0,Math.PI*2);ctx.fill();break;}
    // Crypt tiles
    case T.CRYPT_FLOOR:{ctx.fillStyle="#181820";ctx.fillRect(px,py,TILE,TILE);ctx.strokeStyle="rgba(30,30,40,0.5)";ctx.lineWidth=0.5;ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);break;}
    case T.CRYPT_WALL:{ctx.fillStyle="#101018";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#181828";ctx.fillRect(px+2,py+2,TILE-4,4);ctx.fillRect(px+2,py+TILE/2-1,TILE-4,3);ctx.strokeStyle="#080810";ctx.lineWidth=1;ctx.strokeRect(px,py,TILE,TILE);break;}
    case T.SARCOPHAGUS:{ctx.fillStyle="#2a2830";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a3848";ctx.fillRect(px+4,py+6,TILE-8,TILE-12);ctx.fillStyle="#4a4858";ctx.fillRect(px+6,py+8,TILE-12,TILE-16);ctx.fillStyle="#c4a43e";ctx.fillRect(px+16,py+14,8,12);ctx.fillRect(px+12,py+18,16,4);break;}
    case T.TOMB:{ctx.fillStyle="#202028";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a2a38";ctx.fillRect(px+8,py+4,24,32);ctx.fillStyle="#3a3a48";ctx.fillRect(px+10,py+6,20,28);ctx.fillStyle="#1a1a28";ctx.fillRect(px+14,py+10,12,20);break;}
    case T.SKULL_PILE:{ctx.fillStyle="#181820";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#c8c0a8";for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(px+12+i*8,py+24+((i+1)%2)*4,6,0,Math.PI*2);ctx.fill();}ctx.fillStyle="#0a0a10";ctx.fillRect(px+10,py+22,3,2);ctx.fillRect(px+14,py+22,3,2);ctx.fillRect(px+18,py+26,3,2);ctx.fillRect(px+22,py+26,3,2);ctx.fillRect(px+26,py+22,3,2);ctx.fillRect(px+30,py+22,3,2);break;}
    case T.CRYPT_PILLAR:{ctx.fillStyle="#181820";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#252530";ctx.fillRect(px+10,py+2,20,36);ctx.fillStyle="#303040";ctx.fillRect(px+8,py,24,5);ctx.fillRect(px+8,py+35,24,5);break;}
    case T.GRAVE:{ctx.fillStyle="#1a1a20";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a3840";ctx.fillRect(px+12,py+8,16,4);ctx.fillRect(px+16,py+8,8,24);ctx.fillStyle="#2a2830";ctx.fillRect(px+8,py+28,24,8);break;}
    case T.COFFIN:{ctx.fillStyle="#181820";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a2028";ctx.beginPath();ctx.moveTo(px+12,py+4);ctx.lineTo(px+28,py+4);ctx.lineTo(px+32,py+12);ctx.lineTo(px+28,py+36);ctx.lineTo(px+12,py+36);ctx.lineTo(px+8,py+12);ctx.closePath();ctx.fill();ctx.fillStyle="#3a2838";ctx.fillRect(px+14,py+8,12,24);break;}
    case T.CRYPT_ALTAR:{ctx.fillStyle="#181820";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a2838";ctx.fillRect(px+4,py+12,TILE-8,TILE-16);ctx.fillStyle="#3a3848";ctx.fillRect(px+6,py+10,TILE-12,4);ctx.fillStyle="#8a3040";ctx.fillRect(px+16,py+16,8,14);ctx.fillRect(px+12,py+20,16,4);break;}
    case T.SOUL_FLAME:{ctx.fillStyle="#182030";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#1a2838";ctx.fillRect(px+16,py+24,8,14);const sf=Math.sin(time*0.006+px)*2;ctx.fillStyle="rgba(60,100,200,0.3)";ctx.beginPath();ctx.arc(px+20,py+16+sf,14,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(100,150,255,0.6)";ctx.beginPath();ctx.arc(px+20,py+16+sf,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(150,200,255,0.8)";ctx.beginPath();ctx.arc(px+20,py+16+sf,4,0,Math.PI*2);ctx.fill();break;}
    // Desert tiles
    case T.SAND:{ctx.fillStyle="#c4a868";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="rgba(180,150,80,0.3)";ctx.fillRect(px+((wx*3)%20),py+((wy*7)%20),8,3);break;}
    case T.SAND_DARK:{ctx.fillStyle="#a89050";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="rgba(140,110,50,0.3)";ctx.fillRect(px+5,py+12,12,4);break;}
    case T.DUNE:{ctx.fillStyle="#d4b878";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#c4a868";ctx.beginPath();ctx.moveTo(px,py+TILE);ctx.quadraticCurveTo(px+TILE/2,py+5,px+TILE,py+TILE);ctx.fill();ctx.fillStyle="#e4c888";ctx.fillRect(px+8,py+10,24,3);break;}
    case T.CACTUS:{ctx.fillStyle="#c4a868";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a6a28";ctx.fillRect(px+16,py+8,8,30);ctx.fillRect(px+8,py+16,8,6);ctx.fillRect(px+24,py+20,8,6);ctx.fillStyle="#2a5a18";ctx.fillRect(px+18,py+10,4,26);break;}
    case T.DEAD_TREE:{ctx.fillStyle=getTileColor(T.SAND);ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#4a3820";ctx.fillRect(px+16,py+18,8,22);ctx.fillStyle="#3a2810";ctx.fillRect(px+8,py+10,10,4);ctx.fillRect(px+22,py+6,12,3);ctx.fillRect(px+6,py+18,6,3);break;}
    case T.OASIS:{ctx.fillStyle="#2a6a70";ctx.fillRect(px,py,TILE,TILE);const ow=Math.sin(time*0.003+px*0.1)*0.15;ctx.fillStyle=`rgba(60,140,160,${0.4+ow})`;ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE/2,14,10,0,0,Math.PI*2);ctx.fill();break;}
    case T.SANDSTONE:{ctx.fillStyle="#b89860";ctx.fillRect(px,py,TILE,TILE);ctx.strokeStyle="rgba(160,130,80,0.4)";ctx.lineWidth=0.5;ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);break;}
    case T.SANDSTONE_WALL:{ctx.fillStyle="#8a7048";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#9a8058";ctx.fillRect(px+2,py+2,TILE-4,6);ctx.fillRect(px+2,py+TILE-8,TILE-4,6);ctx.strokeStyle="#6a5038";ctx.lineWidth=1;ctx.strokeRect(px,py,TILE,TILE);break;}
    case T.BONES:{ctx.fillStyle="#c4a868";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#c8c0a8";ctx.fillRect(px+8,py+14,14,2);ctx.fillRect(px+18,py+20,12,2);ctx.beginPath();ctx.arc(px+25,py+28,4,0,Math.PI*2);ctx.fill();break;}
    case T.DESERT_ROCK:{ctx.fillStyle="#c4a868";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#6a5a48";ctx.beginPath();ctx.ellipse(px+20,py+22,12,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#7a6a58";ctx.fillRect(px+12,py+16,16,6);break;}
    // Graveyard tiles
    case T.GRAVE_DIRT:{ctx.fillStyle="#3a3028";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="rgba(60,50,40,0.3)";ctx.fillRect(px+5,py+8,15,4);break;}
    case T.GRAVESTONE:{ctx.fillStyle="#4a4830";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a5860";ctx.fillRect(px+12,py+8,16,4);ctx.fillRect(px+14,py+4,12,28);ctx.fillStyle="#4a4850";ctx.fillRect(px+16,py+6,8,22);break;}
    case T.MAUSOLEUM:{ctx.fillStyle="#4a4850";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a5860";ctx.fillRect(px+4,py+4,TILE-8,TILE-8);ctx.fillStyle="#3a3840";ctx.fillRect(px+14,py+TILE-12,12,10);break;}
    case T.DEAD_GRASS:{ctx.fillStyle="#4a4830";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#5a5838";for(let i=0;i<4;i++){ctx.fillRect(px+((i*11+py)%TILE),py+((i*7+px)%TILE),1,4);}break;}
    case T.CRYPT_ENTRANCE:{ctx.fillStyle="#1a1820";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#0a0810";ctx.fillRect(px+8,py+4,24,32);ctx.fillStyle="#2a2830";ctx.fillRect(px+6,py+2,28,4);const eg=Math.sin(time*0.004)*0.2+0.4;ctx.fillStyle=`rgba(100,150,255,${eg})`;ctx.fillRect(px+12,py+8,16,24);break;}
    case T.IRON_GATE:{ctx.fillStyle="#4a4830";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#3a3840";for(let i=0;i<4;i++)ctx.fillRect(px+6+i*9,py+4,3,TILE-8);ctx.fillRect(px+4,py+12,32,3);ctx.fillRect(px+4,py+24,32,3);break;}
    case T.ANGEL_STATUE:{ctx.fillStyle="#3a3028";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#8a8890";ctx.fillRect(px+14,py+20,12,18);ctx.fillRect(px+12,py+10,16,14);ctx.fillStyle="#9a98a0";ctx.beginPath();ctx.arc(px+20,py+8,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#7a7880";ctx.fillRect(px+6,py+14,8,10);ctx.fillRect(px+26,py+14,8,10);break;}
    case T.WILLOW:{ctx.fillStyle="#4a4830";ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle="#2a2a18";ctx.fillRect(px+16,py+20,8,20);ctx.fillStyle="#2a3a20";ctx.beginPath();ctx.arc(px+20,py+14,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#1a2a18";ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(px+8+i*6,py+18);ctx.lineTo(px+4+i*7,py+38);ctx.stroke();}break;}
    default:break;
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRITES
// ═══════════════════════════════════════════════════════════════
function drawPlayer(ctx,px,py,dir,frame,time,swinging,swingProg,heldItem,aimAngle=0){
  const f=Math.floor(frame)%4,bobY=Math.sin(f*Math.PI/2)*1.5;
  const sw=swinging?swingProg:0;
  ctx.fillStyle="rgba(0,0,0,0.4)";ctx.beginPath();ctx.ellipse(px+20,py+38,11,4,0,0,Math.PI*2);ctx.fill();
  // Draw held item behind player if aiming up
  const aimUp=aimAngle<-Math.PI/4&&aimAngle>-3*Math.PI/4;
  if(aimUp&&heldItem)drawHeld(ctx,px,py,dir,heldItem,time,sw,bobY,aimAngle);
  ctx.fillStyle="#1a1218";
  if(Math.abs(bobY)>0.5){ctx.fillRect(px+14,py+30+bobY,5,8);ctx.fillRect(px+21,py+32+bobY,5,6);}
  else{ctx.fillRect(px+14,py+30,5,8);ctx.fillRect(px+21,py+30,5,8);}
  ctx.fillStyle="#1a1520";ctx.fillRect(px+12,py+16+bobY,16,16);
  ctx.fillStyle="#221830";ctx.fillRect(px+10,py+18+bobY,20,14);
  ctx.fillStyle="#282038";ctx.fillRect(px+8,py+16+bobY,24,5);
  ctx.fillStyle="#b89870";ctx.fillRect(px+14,py+6+bobY,12,12);
  // Eyes follow aim direction
  const eyeOffX=Math.cos(aimAngle)*2;
  const eyeOffY=Math.sin(aimAngle)*1.5;
  const showEyes=aimAngle>-2.5&&aimAngle<2.5; // Hide eyes when facing away
  if(showEyes){
    ctx.fillStyle="#cc2020";
    ctx.fillRect(px+16+eyeOffX,py+10+bobY+Math.max(0,eyeOffY),2,3);
    ctx.fillRect(px+22+eyeOffX,py+10+bobY+Math.max(0,eyeOffY),2,3);
    ctx.fillStyle="rgba(200,30,30,0.3)";
    ctx.fillRect(px+15+eyeOffX,py+9+bobY+Math.max(0,eyeOffY),4,5);
    ctx.fillRect(px+21+eyeOffX,py+9+bobY+Math.max(0,eyeOffY),4,5);
  }
  ctx.fillStyle="#1a1028";ctx.fillRect(px+12,py+4+bobY,16,9);ctx.fillRect(px+10,py+8+bobY,20,5);
  ctx.fillStyle="rgba(0,0,0,0.3)";ctx.fillRect(px+14,py+8+bobY,12,4);
  if(!aimUp&&heldItem)drawHeld(ctx,px,py,dir,heldItem,time,sw,bobY,aimAngle);
}

function drawHeld(ctx,px,py,dir,item,time,sw,bobY,aimAngle=0){
  ctx.save();
  const pcx=px+20,pcy=py+20+bobY; // Player center
  if(item==="sword"){
    const swAngle=sw>0?(sw<0.4?sw/0.4*2.8:2.8-(sw-0.4)/0.6*0.6):0;
    // Position sword based on aim angle
    const dist=14;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    const baseAngle=aimAngle+Math.PI/2; // Perpendicular to aim
    const angle=baseAngle+(sw>0?swAngle-1.4:0);
    ctx.translate(sx,sy);ctx.rotate(angle);
    ctx.fillStyle="#a8b0c0";ctx.fillRect(-2,-24,4,24);ctx.fillStyle="#c8d0e0";ctx.fillRect(-1,-22,2,20);
    ctx.fillStyle="#d0d8e8";ctx.beginPath();ctx.moveTo(-2,-24);ctx.lineTo(0,-30);ctx.lineTo(2,-24);ctx.fill();
    ctx.fillStyle="#c4a43e";ctx.fillRect(-6,-1,12,3);ctx.fillStyle="#3a2818";ctx.fillRect(-2,2,4,10);ctx.fillStyle="#c4a43e";ctx.fillRect(-3,11,6,3);
    if(sw>0){
      ctx.strokeStyle=`rgba(200,210,230,${0.5*(1-sw)})`;ctx.lineWidth=3;ctx.beginPath();
      ctx.arc(0,0,26,-Math.PI/2-0.3,-Math.PI/2+swAngle*0.8);ctx.stroke();
      if(sw<0.5){ctx.fillStyle=`rgba(255,230,180,${0.8*(1-sw*2)})`;for(let i=0;i<3;i++){const sa=(-Math.PI/2+swAngle*0.6)+i*0.2;ctx.beginPath();ctx.arc(Math.cos(sa)*28,Math.sin(sa)*28,2-i*0.5,0,Math.PI*2);ctx.fill();}}
    }
  }else if(item==="spear"){
    const thrustDist=sw>0?(sw<0.3?sw/0.3*20:20-(sw-0.3)/0.7*20):0;
    const dist=16+thrustDist;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    ctx.translate(sx,sy);ctx.rotate(aimAngle);
    ctx.fillStyle="#6a5040";ctx.fillRect(-30,-2,45,4);
    ctx.fillStyle="#a8b0c0";ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(12,-5);ctx.lineTo(12,5);ctx.closePath();ctx.fill();
    ctx.fillStyle="#c8d0e0";ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(13,-3);ctx.lineTo(13,3);ctx.closePath();ctx.fill();
    if(sw>0&&sw<0.4){ctx.strokeStyle=`rgba(200,210,230,${0.6*(1-sw*2.5)})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(28,0);ctx.stroke();}
  }else if(item==="bow"){
    const drawBack=sw>0?(sw<0.5?sw/0.5:1-(sw-0.5)/0.5):0;
    const dist=14;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    ctx.translate(sx,sy);ctx.rotate(aimAngle+Math.PI/2);
    // Bow limbs (curved wood)
    ctx.strokeStyle="#5a3a20";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,16,-Math.PI*0.7,Math.PI*0.7);ctx.stroke();
    ctx.strokeStyle="#7a5a30";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,16,-Math.PI*0.65,Math.PI*0.65);ctx.stroke();
    // Bowstring
    const stringPull=drawBack*8;
    ctx.strokeStyle="#c0b090";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(-stringPull,-14);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(-stringPull,14);ctx.stroke();
    // Arrow nocked when drawing
    if(sw>0){
      ctx.save();ctx.rotate(-Math.PI/2);
      ctx.fillStyle="#6a5040";ctx.fillRect(-stringPull-2,-1,18,2);
      ctx.fillStyle="#a0a8b8";ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(14,-2);ctx.lineTo(14,2);ctx.closePath();ctx.fill();
      ctx.restore();
    }
  }else if(item==="axe"){
    const swAngle=sw>0?(sw<0.35?sw/0.35*2.5:2.5-(sw-0.35)/0.65*0.8):0;
    const dist=14;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    const baseAngle=aimAngle+Math.PI/2;
    const angle=baseAngle+(sw>0?swAngle-1.2:0);
    ctx.translate(sx,sy);ctx.rotate(angle);
    ctx.fillStyle="#6a5040";ctx.fillRect(-2,-20,4,28);
    ctx.fillStyle="#707880";ctx.beginPath();ctx.moveTo(1,-18);ctx.lineTo(12,-14);ctx.lineTo(12,-4);ctx.lineTo(1,-8);ctx.closePath();ctx.fill();
    ctx.fillStyle="#808890";ctx.beginPath();ctx.moveTo(2,-16);ctx.lineTo(10,-13);ctx.lineTo(10,-6);ctx.lineTo(2,-9);ctx.closePath();ctx.fill();
    if(sw>0){ctx.strokeStyle=`rgba(180,190,200,${0.4*(1-sw)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,22,-Math.PI/2-0.2,-Math.PI/2+swAngle*0.7);ctx.stroke();}
  }else if(item==="shield"){
    const dist=12;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    ctx.translate(sx,sy);ctx.rotate(aimAngle);
    ctx.fillStyle="#506070";ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(2,-8);ctx.lineTo(-6,-6);ctx.lineTo(-8,0);ctx.lineTo(-6,6);ctx.lineTo(2,8);ctx.closePath();ctx.fill();
    ctx.fillStyle="#c4a43e";ctx.fillRect(-1,-5,2,10);ctx.fillRect(-4,-1,8,2);
  }else if(item==="torch"){
    const dist=14;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    ctx.translate(sx,sy);ctx.rotate(aimAngle+Math.PI/2);
    ctx.fillStyle="#5a4030";ctx.fillRect(-2,0,4,18);
    const fl=Math.sin(time*0.008)*2;
    const gr=ctx.createRadialGradient(0,-4+fl,2,0,-4,24);
    gr.addColorStop(0,"rgba(255,210,80,0.98)");gr.addColorStop(0.3,"rgba(255,150,40,0.65)");gr.addColorStop(0.6,"rgba(255,80,20,0.25)");gr.addColorStop(1,"rgba(255,50,10,0)");
    ctx.fillStyle=gr;ctx.fillRect(-20,-22,40,32);
    ctx.fillStyle="#ffe890";ctx.beginPath();ctx.arc(0,-4+fl,4.5,0,Math.PI*2);ctx.fill();
  }else if(item==="potion_red"||item==="potion_green"||item==="potion_blue"){
    const dist=12;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    ctx.translate(sx,sy);
    ctx.fillStyle="#3a3030";ctx.fillRect(-3,-8,6,4);
    ctx.fillStyle=item==="potion_red"?"#c62828":item==="potion_green"?"#2e7d32":"#2850a0";ctx.fillRect(-4,-4,8,12);
  }else if(item==="dagger"){
    const swAngle=sw>0?(sw<0.3?sw/0.3*2.0:2.0-(sw-0.3)/0.7*0.5):0;
    const dist=10;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    const baseAngle=aimAngle+Math.PI/2;
    const angle=baseAngle+(sw>0?swAngle-1.0:0);
    ctx.translate(sx,sy);ctx.rotate(angle);
    ctx.fillStyle="#909098";ctx.fillRect(-1.5,-14,3,14);
    ctx.fillStyle="#b0b0b8";ctx.beginPath();ctx.moveTo(-1.5,-14);ctx.lineTo(0,-20);ctx.lineTo(1.5,-14);ctx.fill();
    // Serrated edge
    ctx.fillStyle="#707078";
    for(let i=0;i<4;i++){ctx.fillRect(1.5,-13+i*3,2,2);}
    ctx.fillStyle="#5a4030";ctx.fillRect(-2,0,4,8);
    if(sw>0){ctx.strokeStyle=`rgba(180,180,190,${0.4*(1-sw)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,18,-Math.PI/2-0.2,-Math.PI/2+swAngle*0.6);ctx.stroke();}
  }else if(item==="sword_fire"){
    const swAngle=sw>0?(sw<0.4?sw/0.4*2.8:2.8-(sw-0.4)/0.6*0.6):0;
    const dist=14;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    const baseAngle=aimAngle+Math.PI/2;
    const angle=baseAngle+(sw>0?swAngle-1.4:0);
    ctx.translate(sx,sy);ctx.rotate(angle);
    ctx.fillStyle="#a85020";ctx.fillRect(-2,-24,4,24);ctx.fillStyle="#ff6030";ctx.fillRect(-1,-22,2,20);
    ctx.fillStyle="#ff8040";ctx.beginPath();ctx.moveTo(-2,-24);ctx.lineTo(0,-30);ctx.lineTo(2,-24);ctx.fill();
    // Fire effect on blade
    const fl=Math.sin(time*0.01)*2;
    ctx.fillStyle=`rgba(255,150,40,${0.4+Math.sin(time*0.02)*0.2})`;
    for(let i=0;i<3;i++){
      const fy=-8-i*7+fl*(i+1)*0.5;
      ctx.beginPath();ctx.arc(0,fy,3-i*0.5,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#c4a43e";ctx.fillRect(-6,-1,12,3);ctx.fillStyle="#5a2818";ctx.fillRect(-2,2,4,10);ctx.fillStyle="#c4a43e";ctx.fillRect(-3,11,6,3);
    if(sw>0){ctx.strokeStyle=`rgba(255,150,80,${0.5*(1-sw)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,26,-Math.PI/2-0.3,-Math.PI/2+swAngle*0.8);ctx.stroke();}
  }else if(item==="sword_frost"){
    const swAngle=sw>0?(sw<0.4?sw/0.4*2.8:2.8-(sw-0.4)/0.6*0.6):0;
    const dist=14;
    const sx=pcx+Math.cos(aimAngle)*dist;
    const sy=pcy+Math.sin(aimAngle)*dist;
    const baseAngle=aimAngle+Math.PI/2;
    const angle=baseAngle+(sw>0?swAngle-1.4:0);
    ctx.translate(sx,sy);ctx.rotate(angle);
    ctx.fillStyle="#80a0c0";ctx.fillRect(-2,-24,4,24);ctx.fillStyle="#a0c8e8";ctx.fillRect(-1,-22,2,20);
    ctx.fillStyle="#c0e0ff";ctx.beginPath();ctx.moveTo(-2,-24);ctx.lineTo(0,-30);ctx.lineTo(2,-24);ctx.fill();
    // Ice crystals on blade
    ctx.fillStyle=`rgba(180,220,255,${0.5+Math.sin(time*0.008)*0.2})`;
    ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(-4,-16);ctx.lineTo(0,-12);ctx.lineTo(4,-16);ctx.closePath();ctx.fill();
    ctx.fillStyle="#5080a0";ctx.fillRect(-6,-1,12,3);ctx.fillStyle="#304860";ctx.fillRect(-2,2,4,10);ctx.fillStyle="#5080a0";ctx.fillRect(-3,11,6,3);
    if(sw>0){ctx.strokeStyle=`rgba(150,200,255,${0.5*(1-sw)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,26,-Math.PI/2-0.3,-Math.PI/2+swAngle*0.8);ctx.stroke();}
  }
  ctx.restore();
}

function drawEnemyBody(ctx,e,px,py,bobY,hit,time){
  if(e.type==="timber_wolf"){
    ctx.fillStyle=hit?"#ff6644":"#5a4a28";ctx.fillRect(px+4,py+22+bobY,32,12);
    ctx.fillStyle=hit?"#ff8844":"#6a5a30";ctx.fillRect(px+6,py+24+bobY,28,8);
    ctx.fillStyle="#4a3a20";ctx.fillRect(px+8,py+32+bobY,4,6);ctx.fillRect(px+16,py+32+bobY,4,6);ctx.fillRect(px+24,py+32+bobY,4,6);ctx.fillRect(px+30,py+32+bobY,4,5);
    ctx.fillStyle=hit?"#ff6644":"#5a4a28";ctx.fillRect(px+(e.dir===3?0:26),py+18+bobY,14,10);
    const ex=e.dir===3?6:30;ctx.fillStyle="#e0c020";ctx.fillRect(px+ex,py+20+bobY,2,2);ctx.fillRect(px+ex+5,py+20+bobY,2,2);
    ctx.fillStyle="#4a3a20";ctx.fillRect(px+(e.dir===3?32:0),py+20+bobY,6,3);
  }else if(e.type==="cave_spider"){
    ctx.fillStyle=hit?"#ff4444":"#2a2828";ctx.beginPath();ctx.ellipse(px+20,py+24+bobY,12,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hit?"#ff6666":"#3a3030";ctx.beginPath();ctx.ellipse(px+20,py+18+bobY,7,5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#3a3838";ctx.lineWidth=1.5;
    for(let i=0;i<4;i++){
      ctx.beginPath();ctx.moveTo(px+12,py+24+bobY);ctx.lineTo(px+4-i*2,py+20+i*4+bobY);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px+28,py+24+bobY);ctx.lineTo(px+36+i*2,py+20+i*4+bobY);ctx.stroke();}
    const eg=Math.sin(time*0.005+e.id)*0.3+0.7;
    ctx.fillStyle=`rgba(200,40,40,${eg})`;
    ctx.fillRect(px+16,py+16+bobY,2,2);ctx.fillRect(px+22,py+16+bobY,2,2);
    ctx.fillRect(px+14,py+18+bobY,1,1);ctx.fillRect(px+25,py+18+bobY,1,1);
  }else if(e.type==="forest_bandit"||e.type==="bandit_chief"){
    const chief=e.type==="bandit_chief";
    ctx.fillStyle=hit?"#ff4444":(chief?"#3a2018":"#2a3020");ctx.fillRect(px+12,py+16+bobY,16,16);
    ctx.fillStyle=hit?"#ff6666":(chief?"#4a2a20":"#3a4030");ctx.fillRect(px+10,py+18+bobY,20,12);
    ctx.fillStyle="#b89870";ctx.fillRect(px+14,py+6+bobY,12,12);
    ctx.fillStyle=chief?"#1a0a08":"#2a2a10";ctx.fillRect(px+12,py+4+bobY,16,8);
    ctx.fillStyle=chief?"#8a2020":"#2a5a2a";ctx.fillRect(px+12,py+6+bobY,16,3);
    ctx.fillStyle=chief?"#a0a8b0":"#6a6a5a";
    if(e.dir===1||e.dir===2)ctx.fillRect(px+30,py+14+bobY,3,20);else ctx.fillRect(px+7,py+14+bobY,3,20);
    ctx.fillStyle="#2a2018";ctx.fillRect(px+15,py+30+bobY,5,8);ctx.fillRect(px+21,py+30+bobY,5,8);
  }else if(e.type==="cave_lurker"){
    ctx.fillStyle=hit?"#ff4444":"#1a2030";ctx.fillRect(px+8,py+12+bobY,24,22);
    ctx.fillStyle=hit?"#ff6666":"#2a3040";ctx.fillRect(px+10,py+14+bobY,20,18);
    const eg=Math.sin(time*0.003+e.id)*0.3+0.7;
    ctx.fillStyle=`rgba(100,200,255,${eg})`;ctx.fillRect(px+13,py+16+bobY,4,4);ctx.fillRect(px+23,py+16+bobY,4,4);
    ctx.strokeStyle=`rgba(40,60,100,0.6)`;ctx.lineWidth=2;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(px+10+i*8,py+32+bobY);ctx.lineTo(px+6+i*8+Math.sin(time*0.004+i)*4,py+38);ctx.stroke();}
  // === NEW ENEMY TYPES ===
  }else if(e.type==="skeleton_archer"){
    // Skeleton body
    ctx.fillStyle=hit?"#ffccaa":"#d0c8b0";ctx.fillRect(px+14,py+8+bobY,12,10); // Skull
    ctx.fillStyle="#0a0808";ctx.fillRect(px+16,py+12+bobY,2,2);ctx.fillRect(px+22,py+12+bobY,2,2); // Eye sockets
    ctx.fillStyle=hit?"#ff8866":"#c0b8a0";ctx.fillRect(px+12,py+18+bobY,16,14); // Ribcage
    ctx.fillStyle="#1a1a18";ctx.fillRect(px+15,py+20+bobY,2,10);ctx.fillRect(px+19,py+20+bobY,2,10);ctx.fillRect(px+23,py+20+bobY,2,10); // Ribs
    ctx.fillStyle="#c0b8a0";ctx.fillRect(px+14,py+32+bobY,4,6);ctx.fillRect(px+22,py+32+bobY,4,6); // Legs
    // Bow
    ctx.strokeStyle="#5a4030";ctx.lineWidth=2;
    const bx=e.dir===3?px+4:px+32;
    ctx.beginPath();ctx.arc(bx,py+20+bobY,10,e.dir===3?0.3:Math.PI-0.3,e.dir===3?Math.PI*2-0.3:0.3);ctx.stroke();
    ctx.strokeStyle="#a08060";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx,py+10+bobY);ctx.lineTo(bx,py+30+bobY);ctx.stroke();
    // Wind-up indicator - arrow drawn back and red glow
    if(e.rangedWindup>0){
      const pullBack=Math.min(1,e.rangedWindup/45)*8;
      const arrowX=e.dir===3?bx+pullBack:bx-pullBack;
      ctx.strokeStyle="#606060";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(arrowX,py+18+bobY);ctx.lineTo(arrowX+(e.dir===3?-12:12),py+20+bobY);ctx.stroke();
      // Warning glow
      const glowAlpha=0.3+0.3*Math.sin(time*0.015);
      ctx.fillStyle=`rgba(255,100,50,${glowAlpha})`;
      ctx.beginPath();ctx.arc(px+20,py+20+bobY,16,0,Math.PI*2);ctx.fill();
    }
  }else if(e.type==="shadow_wraith"){
    // Ethereal floating form
    const floatY=Math.sin(time*0.004+e.id)*4;
    const alpha=0.7+Math.sin(time*0.003)*0.2;
    ctx.globalAlpha=alpha;
    ctx.fillStyle=hit?"#8060c0":"#3030508";
    ctx.beginPath();ctx.ellipse(px+20,py+25+floatY+bobY,14,18,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hit?"#a080e0":"#404060";
    ctx.beginPath();ctx.ellipse(px+20,py+12+floatY+bobY,10,8,0,0,Math.PI*2);ctx.fill();
    // Glowing eyes
    const eg=Math.sin(time*0.006+e.id)*0.3+0.7;
    ctx.fillStyle=`rgba(150,100,255,${eg})`;
    ctx.fillRect(px+14,py+10+floatY+bobY,3,3);ctx.fillRect(px+23,py+10+floatY+bobY,3,3);
    // Wispy tendrils
    ctx.strokeStyle=`rgba(80,60,120,${alpha*0.5})`;ctx.lineWidth=2;
    for(let i=0;i<3;i++){
      ctx.beginPath();ctx.moveTo(px+12+i*8,py+35+floatY+bobY);
      ctx.quadraticCurveTo(px+10+i*8+Math.sin(time*0.005+i)*6,py+42+floatY,px+12+i*8,py+48);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }else if(e.type==="giant_rat"){
    // Fat rat body
    ctx.fillStyle=hit?"#ff6644":"#4a4040";
    ctx.beginPath();ctx.ellipse(px+20,py+26+bobY,14,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hit?"#ff8866":"#5a5050";
    ctx.beginPath();ctx.ellipse(px+20,py+24+bobY,12,8,0,0,Math.PI*2);ctx.fill();
    // Head
    const hx=e.dir===3?px+4:px+28;
    ctx.fillStyle=hit?"#ff6644":"#4a4040";
    ctx.beginPath();ctx.ellipse(hx,py+22+bobY,8,6,0,0,Math.PI*2);ctx.fill();
    // Eyes
    ctx.fillStyle="#ff2020";ctx.fillRect(hx-4,py+20+bobY,2,2);ctx.fillRect(hx+2,py+20+bobY,2,2);
    // Ears
    ctx.fillStyle="#5a4848";ctx.beginPath();ctx.arc(hx-5,py+16+bobY,3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(hx+5,py+16+bobY,3,0,Math.PI*2);ctx.fill();
    // Tail
    ctx.strokeStyle="#4a3838";ctx.lineWidth=2;
    const tx=e.dir===3?px+34:px+6;
    ctx.beginPath();ctx.moveTo(tx,py+26+bobY);ctx.quadraticCurveTo(tx+(e.dir===3?8:-8),py+30+bobY,tx+(e.dir===3?12:-12),py+24+bobY);ctx.stroke();
    // Legs
    ctx.fillStyle="#3a3030";ctx.fillRect(px+10,py+32+bobY,4,6);ctx.fillRect(px+26,py+32+bobY,4,6);
  }else if(e.type==="slime"){
    // Blob body with pulse
    const pulse=Math.sin(time*0.005+e.id)*0.15+1;
    const w=16*pulse,h=12*pulse;
    ctx.fillStyle=hit?"#80ff80":`rgba(60,180,60,0.8)`;
    ctx.beginPath();ctx.ellipse(px+20,py+28+bobY,w,h,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hit?"#a0ffa0":`rgba(80,200,80,0.6)`;
    ctx.beginPath();ctx.ellipse(px+20,py+26+bobY,w*0.7,h*0.7,0,0,Math.PI*2);ctx.fill();
    // Eyes
    ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(px+15,py+24+bobY,3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(px+25,py+24+bobY,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#202020";ctx.beginPath();ctx.arc(px+15,py+24+bobY,1.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(px+25,py+24+bobY,1.5,0,Math.PI*2);ctx.fill();
    // Poison drip
    if(e.poisonous&&Math.random()<0.1){
      ctx.fillStyle="rgba(100,200,100,0.5)";ctx.beginPath();ctx.arc(px+18+Math.random()*4,py+36+bobY,2,0,Math.PI*2);ctx.fill();
    }
  // === BOSSES ===
  }else if(e.type==="hollow_lord"){
    // Giant armored undead
    const scale=1.5;
    const cx=px+20,cy=py+20;
    ctx.save();ctx.translate(cx,cy+bobY);ctx.scale(scale,scale);ctx.translate(-20,-20);
    // Body
    ctx.fillStyle=hit?"#ff4444":"#1a1028";ctx.fillRect(8,12,24,22);
    ctx.fillStyle=hit?"#ff6666":"#2a1838";ctx.fillRect(10,14,20,18);
    // Armor plates
    ctx.fillStyle="#3a3448";ctx.fillRect(6,10,6,16);ctx.fillRect(28,10,6,16);
    ctx.fillStyle="#4a4458";ctx.fillRect(12,8,16,4);
    // Head with crown
    ctx.fillStyle="#3a2840";ctx.fillRect(12,0,16,14);
    ctx.fillStyle="#c4a43e";ctx.fillRect(10,-4,20,4);ctx.fillRect(12,-8,4,4);ctx.fillRect(18,-6,4,2);ctx.fillRect(24,-8,4,4);
    // Eyes
    const eg=Math.sin(time*0.003)*0.3+0.7;
    ctx.fillStyle=`rgba(255,50,80,${eg})`;ctx.fillRect(14,4,3,4);ctx.fillRect(23,4,3,4);
    // Greatsword
    ctx.fillStyle="#606870";ctx.fillRect(e.dir===3?-4:36,0,5,36);
    ctx.fillStyle="#808890";ctx.fillRect(e.dir===3?-3:37,2,3,32);
    ctx.fillStyle="#c4a43e";ctx.fillRect(e.dir===3?-6:34,32,9,4);
    ctx.restore();
    // Boss aura
    if(!hit){
      const aura=Math.sin(time*0.002)*0.15+0.2;
      ctx.strokeStyle=`rgba(180,40,100,${aura})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(px+20,py+20+bobY,35,0,Math.PI*2);ctx.stroke();
    }
  }else if(e.type==="alpha_wolf"){
    // Giant wolf
    const scale=1.4;
    ctx.save();ctx.translate(px+20,py+20+bobY);ctx.scale(scale,scale);ctx.translate(-20,-20);
    ctx.fillStyle=hit?"#ff6644":"#3a3030";ctx.fillRect(2,18,36,16);
    ctx.fillStyle=hit?"#ff8866":"#4a4040";ctx.fillRect(4,20,32,12);
    // Legs
    ctx.fillStyle="#2a2020";ctx.fillRect(6,32,5,8);ctx.fillRect(14,32,5,8);ctx.fillRect(22,32,5,8);ctx.fillRect(30,32,5,7);
    // Head
    ctx.fillStyle=hit?"#ff6644":"#3a3030";ctx.fillRect(e.dir===3?-4:28,12,16,14);
    // Fangs
    ctx.fillStyle="#ffffff";
    const fx=e.dir===3?0:38;
    ctx.fillRect(fx,22,2,4);ctx.fillRect(fx+6,22,2,4);
    // Eyes
    ctx.fillStyle="#ff4040";ctx.fillRect(e.dir===3?2:32,16,3,3);ctx.fillRect(e.dir===3?8:38,16,3,3);
    // Mane
    ctx.fillStyle="#2a2828";
    for(let i=0;i<4;i++){ctx.fillRect(10+i*6,10-i%2*2,4,6);}
    ctx.restore();
    // Rage aura when enraged
    if(e.enraged){
      const rage=Math.sin(time*0.004)*0.2+0.3;
      ctx.fillStyle=`rgba(255,60,40,${rage})`;ctx.beginPath();ctx.arc(px+20,py+20+bobY,40,0,Math.PI*2);ctx.fill();
    }
  }else if(e.type==="spider_queen"){
    // Giant spider
    const scale=1.6;
    ctx.save();ctx.translate(px+20,py+20+bobY);ctx.scale(scale,scale);ctx.translate(-20,-20);
    // Abdomen
    ctx.fillStyle=hit?"#ff4444":"#2a2030";ctx.beginPath();ctx.ellipse(20,28,16,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#3a2840";ctx.beginPath();ctx.ellipse(20,26,12,8,0,0,Math.PI*2);ctx.fill();
    // Pattern
    ctx.fillStyle="#8a2040";ctx.beginPath();ctx.ellipse(20,28,6,4,0,0,Math.PI*2);ctx.fill();
    // Thorax/head
    ctx.fillStyle=hit?"#ff6666":"#3a2838";ctx.beginPath();ctx.ellipse(20,12,10,8,0,0,Math.PI*2);ctx.fill();
    // Eyes (8 of them)
    const eg=Math.sin(time*0.004)*0.3+0.7;
    ctx.fillStyle=`rgba(200,40,60,${eg})`;
    ctx.fillRect(14,8,2,2);ctx.fillRect(18,6,2,2);ctx.fillRect(22,6,2,2);ctx.fillRect(26,8,2,2);
    ctx.fillRect(15,12,2,2);ctx.fillRect(19,10,2,2);ctx.fillRect(23,10,2,2);ctx.fillRect(27,12,2,2);
    // Legs
    ctx.strokeStyle="#3a3040";ctx.lineWidth=3;
    for(let i=0;i<4;i++){
      const angle=0.3+i*0.35;
      ctx.beginPath();ctx.moveTo(8,20);ctx.lineTo(-6-i*4,14+i*8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(32,20);ctx.lineTo(46+i*4,14+i*8);ctx.stroke();
    }
    // Fangs
    ctx.fillStyle="#c0a080";ctx.fillRect(16,18,3,6);ctx.fillRect(23,18,3,6);
    ctx.restore();
    // Web strands around
    if(!hit){
      ctx.strokeStyle="rgba(200,200,200,0.2)";ctx.lineWidth=1;
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3+time*0.001;
        ctx.beginPath();ctx.moveTo(px+20,py+20+bobY);
        ctx.lineTo(px+20+Math.cos(a)*50,py+20+Math.sin(a)*50+bobY);ctx.stroke();
      }
    }
  }else{
    const isKnight=e.type==="hollow_knight";
    ctx.fillStyle=hit?"#ff4444":(isKnight?"#2a2030":"#1a1018");ctx.fillRect(px+12,py+16+bobY,16,16);
    ctx.fillStyle=hit?"#ff6666":(isKnight?"#302040":"#201020");ctx.fillRect(px+10,py+18+bobY,20,12);
    ctx.fillStyle=isKnight?"#4a3848":"#3a2830";ctx.fillRect(px+14,py+6+bobY,12,12);
    const eg=Math.sin(time*0.004+e.id)*0.3+0.7;
    ctx.fillStyle=`rgba(180,40,255,${eg})`;ctx.fillRect(px+16,py+10+bobY,2,3);ctx.fillRect(px+22,py+10+bobY,2,3);
    if(isKnight){ctx.fillStyle="#3a3448";ctx.fillRect(px+12,py+4+bobY,16,10);ctx.fillStyle="#4a4458";ctx.fillRect(px+10,py+4+bobY,20,4);ctx.fillStyle="#2a2030";ctx.fillRect(px+14,py+10+bobY,12,3);}
    ctx.fillStyle=isKnight?"#808890":"#5a5060";
    if(e.dir===1||e.dir===2)ctx.fillRect(px+30,py+14+bobY,3,18);else ctx.fillRect(px+7,py+14+bobY,3,18);
    ctx.fillStyle="#1a1218";ctx.fillRect(px+14,py+30+bobY,5,8);ctx.fillRect(px+21,py+30+bobY,5,8);
  }
}

function drawEnemy(ctx,e,camX,camY,time){
  if(e.dead)return;
  const px=Math.floor(e.x-camX),py=Math.floor(e.y-camY);
  if(px<-TILE*2||px>CANVAS_W+TILE||py<-TILE*2||py>CANVAS_H+TILE)return;
  const bobY=Math.sin(e.frame*Math.PI/2)*1;
  const hit=e.hitCd>0;
  
  // Lunge ghost trail effect
  if(e.lunging&&e.lungeTimer>0){
    const trailAlpha=e.lungeTimer/12;
    ctx.globalAlpha=trailAlpha*0.4;
    const trailOff=e.lungeTimer*3;
    drawEnemyBody(ctx,e,px+e.lungeDirX*trailOff,py+e.lungeDirY*trailOff,bobY,hit,time);
    ctx.globalAlpha=trailAlpha*0.2;
    drawEnemyBody(ctx,e,px+e.lungeDirX*trailOff*1.8,py+e.lungeDirY*trailOff*1.8,bobY,hit,time);
    ctx.globalAlpha=1;
  }
  
  // Slam shockwave effect
  if(e.slamming&&e.slamTimer>0){
    const progress=1-e.slamTimer/15;
    const radius=180*progress;
    ctx.strokeStyle=`rgba(255,100,50,${(1-progress)*0.6})`;
    ctx.lineWidth=4-progress*3;
    ctx.beginPath();ctx.arc(px+20,py+20,radius,0,Math.PI*2);ctx.stroke();
    // Inner ring
    ctx.strokeStyle=`rgba(255,150,80,${(1-progress)*0.4})`;
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(px+20,py+20,radius*0.6,0,Math.PI*2);ctx.stroke();
  }
  
  ctx.fillStyle="rgba(0,0,0,0.35)";ctx.beginPath();ctx.ellipse(px+20,py+38,10,3,0,0,Math.PI*2);ctx.fill();
  drawEnemyBody(ctx,e,px,py,bobY,hit,time);
  
  // Special attack indicator (warning!)
  if(e.specialWindupStart>0){
    const pulse=Math.sin(time*0.015)*0.3+0.7;
    ctx.strokeStyle=`rgba(255,60,60,${pulse})`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(px+20,py+20,22+pulse*4,0,Math.PI*2);ctx.stroke();
    // Exclamation mark
    ctx.fillStyle=`rgba(255,80,80,${pulse})`;
    ctx.font="bold 14px sans-serif";ctx.textAlign="center";
    ctx.fillText("!",px+20,py-4);ctx.textAlign="left";
    // Attack direction indicator - dynamically tracks player (world coords for angle)
    if(e.specialType==="lunge"){
      const ang=Math.atan2((e.targetY||e.y+20)-(e.y+20),(e.targetX||e.x+20)-(e.x+20));
      const lungeRange=160; // actual damage range
      // Draw danger zone line showing exact lunge path
      ctx.strokeStyle=`rgba(255,100,100,${pulse*0.7})`;ctx.lineWidth=4;
      ctx.setLineDash([8,4]);ctx.beginPath();ctx.moveTo(px+20,py+20);
      ctx.lineTo(px+20+Math.cos(ang)*lungeRange,py+20+Math.sin(ang)*lungeRange);ctx.stroke();
      ctx.setLineDash([]);
      // Arrow head at end showing attack direction
      const endX=px+20+Math.cos(ang)*lungeRange,endY=py+20+Math.sin(ang)*lungeRange;
      ctx.fillStyle=`rgba(255,80,80,${pulse*0.9})`;
      ctx.beginPath();
      ctx.moveTo(endX,endY);
      ctx.lineTo(endX-Math.cos(ang-0.5)*14,endY-Math.sin(ang-0.5)*14);
      ctx.lineTo(endX-Math.cos(ang+0.5)*14,endY-Math.sin(ang+0.5)*14);
      ctx.closePath();ctx.fill();
    }else if(e.specialType==="ranged"){
      const ang=Math.atan2((e.targetY||e.y+20)-(e.y+20),(e.targetX||e.x+20)-(e.x+20));
      // Show projectile path direction
      ctx.strokeStyle=`rgba(255,180,60,${pulse*0.6})`;ctx.lineWidth=2;
      ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(px+20,py+20);
      ctx.lineTo(px+20+Math.cos(ang)*100,py+20+Math.sin(ang)*100);ctx.stroke();
      ctx.setLineDash([]);
      // Small projectile indicator
      ctx.fillStyle=`rgba(255,150,50,${pulse})`;
      ctx.beginPath();ctx.arc(px+20+Math.cos(ang)*40,py+20+Math.sin(ang)*40,5,0,Math.PI*2);ctx.fill();
    }else if(e.specialType==="slam"){
      // Slam AoE indicator circle - exact 180px range
      ctx.strokeStyle=`rgba(255,100,60,${pulse*0.6})`;ctx.lineWidth=3;
      ctx.setLineDash([10,5]);
      ctx.beginPath();ctx.arc(px+20,py+20,180,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=`rgba(255,80,40,${pulse*0.12})`;
      ctx.beginPath();ctx.arc(px+20,py+20,180,0,Math.PI*2);ctx.fill();
    }
  }
  
  // Boss-specific visual effects
  const info=ENEMY_INFO[e.type];
  if(info?.isBoss){
    // Boss aura - simplified circles
    const auraPhase=Math.sin(time*0.003)*0.3+0.7;
    const auraColor=e.type==="hollow_lord"?"140,60,200":e.type==="alpha_wolf"?"200,120,40":"80,180,100";
    ctx.fillStyle=`rgba(${auraColor},${auraPhase*0.08})`;ctx.beginPath();ctx.arc(px+20,py+22,45,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=`rgba(${auraColor},${auraPhase*0.15})`;ctx.beginPath();ctx.arc(px+20,py+22,30,0,Math.PI*2);ctx.fill();
    
    // Enrage effects
    if(e.enraged){
      // Red pulsing overlay
      const enrageGlow=Math.sin(time*0.012)*0.15+0.25;
      ctx.fillStyle=`rgba(255,40,40,${enrageGlow})`;
      ctx.beginPath();ctx.arc(px+20,py+22,35,0,Math.PI*2);ctx.fill();
    }
    
    // Boss name and HP bar (larger)
    ctx.font="bold 10px monospace";ctx.fillStyle=e.enraged?"#ff6060":"#ffd080";ctx.textAlign="center";
    ctx.fillText(info.name+(e.enraged?" [ENRAGED]":""),px+20,py-14);ctx.textAlign="left";
    ctx.fillStyle="rgba(0,0,0,0.8)";ctx.fillRect(px-6,py-6,52,8);
    ctx.fillStyle=e.enraged?"#ff4040":"#c62828";ctx.fillRect(px-5,py-5,50*(e.hp/e.maxHp),6);
    // HP bar border
    ctx.strokeStyle=e.enraged?"#ff8080":"#804040";ctx.lineWidth=1;
    ctx.strokeRect(px-6,py-6,52,8);
    return; // Skip normal HP bar
  }
  
  // HP bar
  if(e.hp<e.maxHp){
    const info=ENEMY_INFO[e.type];
    ctx.font="bold 8px monospace";ctx.fillStyle="rgba(200,180,160,0.8)";ctx.textAlign="center";
    ctx.fillText(info.name,px+20,py-8);ctx.textAlign="left";
    ctx.fillStyle="rgba(0,0,0,0.7)";ctx.fillRect(px+4,py-2,32,5);
    ctx.fillStyle="#c62828";ctx.fillRect(px+5,py-1,30*(e.hp/e.maxHp),3);
  }
  // Status effect visual indicators
  if(e.statusEffects&&e.statusEffects.length>0){
    let effX=px+5;
    e.statusEffects.forEach(eff=>{
      const pulse=Math.sin(time*0.01)*0.2+0.8;
      if(eff.type==="bleed"){
        ctx.fillStyle=`rgba(200,30,30,${pulse*0.7})`;ctx.beginPath();ctx.arc(effX,py+42,4,0,Math.PI*2);ctx.fill();
        // Drip effect
        const dripY=py+44+(time*0.02+effX)%12;
        ctx.fillStyle="rgba(180,20,20,0.5)";ctx.beginPath();ctx.ellipse(effX,dripY,2,3,0,0,Math.PI*2);ctx.fill();
      }else if(eff.type==="burn"){
        ctx.fillStyle=`rgba(255,120,40,${pulse*0.8})`;ctx.beginPath();ctx.arc(effX,py+42,5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgba(255,200,80,${pulse})`;ctx.beginPath();ctx.arc(effX,py+41,2,0,Math.PI*2);ctx.fill();
        // Flame particles above enemy
        for(let i=0;i<2;i++){
          const fy=py+10-(time*0.03+i*10)%20;
          const fx=px+12+Math.sin(time*0.01+i)*8+i*8;
          ctx.fillStyle=`rgba(255,${150+Math.random()*50},40,${0.4+Math.random()*0.3})`;
          ctx.beginPath();ctx.arc(fx,fy,2+Math.random(),0,Math.PI*2);ctx.fill();
        }
      }else if(eff.type==="freeze"){
        ctx.fillStyle=`rgba(120,180,255,${pulse*0.7})`;ctx.beginPath();ctx.arc(effX,py+42,4,0,Math.PI*2);ctx.fill();
        // Ice crystals
        ctx.strokeStyle=`rgba(180,220,255,${0.5+pulse*0.3})`;ctx.lineWidth=1;
        for(let i=0;i<3;i++){
          const cx=px+10+i*10,cy=py+15;
          ctx.beginPath();ctx.moveTo(cx,cy-5);ctx.lineTo(cx,cy+5);ctx.moveTo(cx-3,cy-2);ctx.lineTo(cx+3,cy+2);ctx.stroke();
        }
      }else if(eff.type==="poison"){
        ctx.fillStyle=`rgba(80,180,60,${pulse*0.7})`;ctx.beginPath();ctx.arc(effX,py+42,4,0,Math.PI*2);ctx.fill();
        // Poison bubbles (slow, regen-blocking)
        const bubbleY=py+35-(time*0.015+effX)%15;
        ctx.fillStyle="rgba(100,200,80,0.4)";ctx.beginPath();ctx.arc(effX+2,bubbleY,2,0,Math.PI*2);ctx.fill();
      }else if(eff.type==="venom"){
        ctx.fillStyle=`rgba(128,255,64,${pulse*0.9})`;ctx.beginPath();ctx.arc(effX,py+42,5,0,Math.PI*2);ctx.fill();
        // Aggressive venom drips (fast DOT visual)
        for(let i=0;i<2;i++){
          const dripY=py+44+(time*0.04+effX+i*7)%14;
          const dripX=effX-2+i*4;
          ctx.fillStyle=`rgba(100,255,50,${0.6-((dripY-py-44)/14)*0.4})`;
          ctx.beginPath();ctx.ellipse(dripX,dripY,2,4,0,0,Math.PI*2);ctx.fill();
        }
      }
      effX+=10;
    });
  }
}

function drawTownNPC(ctx,npc,camX,camY,time,hasQuest,questComplete){
  const px=Math.floor(npc.x-camX),py=Math.floor(npc.y-camY);
  if(px<-TILE*2||px>CANVAS_W+TILE||py<-TILE*2||py>CANVAS_H+TILE)return;
  ctx.fillStyle="rgba(0,0,0,0.3)";ctx.beginPath();ctx.ellipse(px+20,py+38,10,3,0,0,Math.PI*2);ctx.fill();
  // Legs
  ctx.fillStyle="#3a2818";ctx.fillRect(px+15,py+30,5,8);ctx.fillRect(px+21,py+30,5,8);
  // Body
  ctx.fillStyle=npc.tunic;ctx.fillRect(px+12,py+16,16,16);ctx.fillStyle=npc.tunic;ctx.fillRect(px+10,py+18,20,12);
  // Head
  ctx.fillStyle="#c8a878";ctx.fillRect(px+14,py+6,12,12);
  // Eyes
  ctx.fillStyle="#2a1a10";ctx.fillRect(px+16,py+10,2,2);ctx.fillRect(px+22,py+10,2,2);
  // Hair
  ctx.fillStyle=npc.hair;ctx.fillRect(px+12,py+4,16,6);ctx.fillRect(px+12,py+4,4,10);
  if(questComplete){
    const bob=Math.sin(time*0.005)*3;
    ctx.fillStyle="#50c878";ctx.font="bold 14px monospace";ctx.textAlign="center";
    ctx.fillText("?",px+20,py-4+bob);ctx.textAlign="left";
  }else if(hasQuest){
    const bob=Math.sin(time*0.005)*3;
    ctx.fillStyle="#f0c040";ctx.font="bold 14px monospace";ctx.textAlign="center";
    ctx.fillText("!",px+20,py-4+bob);ctx.textAlign="left";
  }
  // Name
  ctx.font="bold 8px monospace";ctx.fillStyle="rgba(200,180,160,0.7)";ctx.textAlign="center";
  ctx.fillText(npc.name,px+20,py+46);ctx.textAlign="left";
}

function drawDyingMan(ctx,px,py,time,isDead){
  ctx.fillStyle="rgba(90,10,10,0.65)";ctx.beginPath();ctx.ellipse(px+20,py+30,18,10,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#506068";ctx.fillRect(px+4,py+18,32,14);ctx.fillStyle="#3a4850";ctx.fillRect(px+6,py+16,28,10);
  ctx.fillStyle="#b89870";ctx.fillRect(px+2,py+10,12,10);ctx.fillStyle="#3a2a20";ctx.fillRect(px+2,py+8,12,5);
  if(!isDead){ctx.fillStyle="#4080b0";ctx.fillRect(px+4,py+14,2,2);ctx.fillRect(px+9,py+14,2,2);}
  else{ctx.fillStyle="#8a6848";ctx.fillRect(px+4,py+15,3,1);ctx.fillRect(px+9,py+15,3,1);}
  ctx.fillStyle="#808890";ctx.fillRect(px+34,py+24,2,14);ctx.fillStyle="#c4a43e";ctx.fillRect(px+32,py+22,6,3);
}

function drawItemIcon(ctx,icon,px,py,sz){
  const s=sz||28,cx=px+s/2,cy=py+s/2;
  switch(icon){
    case "sword":ctx.fillStyle="#a0a8b8";ctx.fillRect(cx-1,cy-s*0.4,3,s*0.6);ctx.fillStyle="#c4a43e";ctx.fillRect(cx-5,cy+s*0.15,11,3);ctx.fillStyle="#5a3a20";ctx.fillRect(cx-1,cy+s*0.2,3,s*0.2);break;
    case "spear":ctx.fillStyle="#6a5040";ctx.fillRect(cx-1,cy-s*0.1,3,s*0.55);ctx.fillStyle="#a0a8b8";ctx.beginPath();ctx.moveTo(cx,cy-s*0.45);ctx.lineTo(cx+4,cy-s*0.15);ctx.lineTo(cx-4,cy-s*0.15);ctx.closePath();ctx.fill();break;
    case "bow":ctx.strokeStyle="#6a4a30";ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx+2,cy,s*0.35,Math.PI*0.6,Math.PI*1.4);ctx.stroke();ctx.strokeStyle="#a08060";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx+2,cy-s*0.32);ctx.lineTo(cx+2,cy+s*0.32);ctx.stroke();break;
    case "axe":ctx.fillStyle="#6a5040";ctx.fillRect(cx-1,cy-s*0.1,3,s*0.5);ctx.fillStyle="#707880";ctx.beginPath();ctx.moveTo(cx+1,cy-s*0.35);ctx.lineTo(cx+8,cy-s*0.2);ctx.lineTo(cx+8,cy+s*0.05);ctx.lineTo(cx+1,cy-s*0.1);ctx.closePath();ctx.fill();break;
    case "arrows":ctx.fillStyle="#6a5040";ctx.fillRect(cx-6,cy-1,12,2);ctx.fillStyle="#a0a8b8";ctx.beginPath();ctx.moveTo(cx+8,cy);ctx.lineTo(cx+4,cy-3);ctx.lineTo(cx+4,cy+3);ctx.closePath();ctx.fill();ctx.fillStyle="#8a6a50";ctx.fillRect(cx-8,cy-2,3,1);ctx.fillRect(cx-8,cy+1,3,1);break;
    case "shield":ctx.fillStyle="#506070";ctx.beginPath();ctx.moveTo(cx,cy-s*0.35);ctx.lineTo(cx+s*0.3,cy-s*0.15);ctx.lineTo(cx+s*0.25,cy+s*0.3);ctx.lineTo(cx,cy+s*0.4);ctx.lineTo(cx-s*0.25,cy+s*0.3);ctx.lineTo(cx-s*0.3,cy-s*0.15);ctx.closePath();ctx.fill();ctx.fillStyle="#c4a43e";ctx.fillRect(cx-1,cy-s*0.2,3,s*0.4);break;
    case "potion_red":ctx.fillStyle="#4a3030";ctx.fillRect(cx-4,cy-s*0.3,9,s*0.15);ctx.fillStyle="#c62828";ctx.fillRect(cx-6,cy-s*0.15,13,s*0.45);break;
    case "potion_green":ctx.fillStyle="#304a30";ctx.fillRect(cx-4,cy-s*0.3,9,s*0.15);ctx.fillStyle="#2e7d32";ctx.fillRect(cx-6,cy-s*0.15,13,s*0.45);break;
    case "potion_blue":ctx.fillStyle="#303a4a";ctx.fillRect(cx-4,cy-s*0.3,9,s*0.15);ctx.fillStyle="#2850a0";ctx.fillRect(cx-6,cy-s*0.15,13,s*0.45);break;
    case "torch":ctx.fillStyle="#5a4030";ctx.fillRect(cx-2,cy-s*0.1,4,s*0.4);ctx.fillStyle="#ffa040";ctx.beginPath();ctx.arc(cx,cy-s*0.2,5,0,Math.PI*2);ctx.fill();break;
    case "ring":ctx.strokeStyle="#c4a43e";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(cx,cy,s*0.22,0,Math.PI*2);ctx.stroke();break;
    case "key":ctx.fillStyle="#c4a43e";ctx.beginPath();ctx.arc(cx-3,cy-s*0.15,5,0,Math.PI*2);ctx.fill();ctx.fillRect(cx,cy-s*0.1,s*0.3,3);break;
    case "bone":ctx.fillStyle="#d8d0c0";ctx.fillRect(cx-s*0.3,cy-1,s*0.6,3);ctx.beginPath();ctx.arc(cx-s*0.3,cy,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+s*0.3,cy,3,0,Math.PI*2);ctx.fill();break;
    case "relic":ctx.fillStyle="#c4a43e";ctx.fillRect(cx-4,cy-6,8,12);ctx.fillRect(cx-6,cy-4,12,3);ctx.fillRect(cx-6,cy+2,12,3);break;
    case "armor":ctx.fillStyle="#506070";ctx.fillRect(cx-8,cy-6,16,14);ctx.fillRect(cx-10,cy-8,6,12);ctx.fillRect(cx+4,cy-8,6,12);break;
    case "dagger":ctx.fillStyle="#909098";ctx.fillRect(cx-1,cy-s*0.35,3,s*0.5);ctx.fillStyle="#b0b0b8";ctx.beginPath();ctx.moveTo(cx,cy-s*0.45);ctx.lineTo(cx+2,cy-s*0.35);ctx.lineTo(cx-2,cy-s*0.35);ctx.closePath();ctx.fill();ctx.fillStyle="#5a4030";ctx.fillRect(cx-2,cy+s*0.1,5,s*0.2);break;
    case "sword_fire":ctx.fillStyle="#ff6030";ctx.fillRect(cx-1,cy-s*0.4,3,s*0.6);ctx.fillStyle="#c4a43e";ctx.fillRect(cx-5,cy+s*0.15,11,3);ctx.fillStyle="#5a2818";ctx.fillRect(cx-1,cy+s*0.2,3,s*0.2);ctx.fillStyle="rgba(255,150,50,0.6)";ctx.beginPath();ctx.arc(cx,cy-s*0.25,4,0,Math.PI*2);ctx.fill();break;
    case "sword_frost":ctx.fillStyle="#80c0e0";ctx.fillRect(cx-1,cy-s*0.4,3,s*0.6);ctx.fillStyle="#5080a0";ctx.fillRect(cx-5,cy+s*0.15,11,3);ctx.fillStyle="#304860";ctx.fillRect(cx-1,cy+s*0.2,3,s*0.2);ctx.fillStyle="rgba(150,200,255,0.5)";ctx.beginPath();ctx.moveTo(cx,cy-s*0.3);ctx.lineTo(cx-4,cy-s*0.15);ctx.lineTo(cx+4,cy-s*0.15);ctx.closePath();ctx.fill();break;
    default:ctx.fillStyle="#555";ctx.fillRect(px+4,py+4,s-8,s-8);
  }
}

function drawPortrait(ctx,type,w,h){
  ctx.fillStyle="#0a0810";ctx.fillRect(0,0,w,h);
  if(type==="alive"){
    ctx.fillStyle="#b89870";ctx.fillRect(16,22,48,48);ctx.fillStyle="#3a2a20";ctx.fillRect(14,16,52,14);ctx.fillRect(14,16,8,30);ctx.fillRect(56,16,8,28);
    ctx.fillStyle="#4080b0";ctx.fillRect(24,38,5,4);ctx.fillRect(46,38,5,4);ctx.fillStyle="#3a2a20";ctx.fillRect(22,34,10,2);ctx.fillRect(44,34,10,2);
    ctx.fillStyle="#8a5838";ctx.fillRect(30,56,18,3);ctx.fillStyle="rgba(160,20,20,0.6)";ctx.fillRect(52,42,8,16);ctx.fillRect(20,50,6,12);
    ctx.fillStyle="#a08060";ctx.fillRect(36,42,6,10);ctx.fillStyle="#3a4850";ctx.fillRect(10,66,60,18);ctx.fillStyle="#506068";ctx.fillRect(12,68,56,14);ctx.fillStyle="#c4a43e";ctx.fillRect(36,70,8,8);
  }else{
    ctx.fillStyle="#8a7858";ctx.fillRect(16,22,48,48);ctx.fillStyle="#3a2a20";ctx.fillRect(14,16,52,14);ctx.fillRect(14,16,8,30);ctx.fillRect(56,16,8,28);
    ctx.fillStyle="#6a5840";ctx.fillRect(24,40,8,1);ctx.fillRect(44,40,8,1);ctx.fillStyle="#6a4830";ctx.fillRect(32,56,14,4);
    ctx.fillStyle="rgba(130,15,15,0.5)";ctx.fillRect(52,42,8,20);ctx.fillRect(20,50,6,14);
    ctx.fillStyle="#7a6050";ctx.fillRect(36,42,6,10);ctx.fillStyle="#3a4850";ctx.fillRect(10,66,60,18);ctx.fillStyle="#506068";ctx.fillRect(12,68,56,14);ctx.fillStyle="#c4a43e";ctx.fillRect(36,70,8,8);
  }
}

// ═══════════════════════════════════════════════════════════════
// LIGHTING — Quality-aware rendering
// ═══════════════════════════════════════════════════════════════
function renderLighting(ctx,mapData,camX,camY,playerX,playerY,time,heldTorch,zone){
  if(zone==="town"||!GFX.lighting)return; // Skip if lighting disabled
  
  const {canvas: lightCanvas, ctx: lctx} = getLightingCanvas();
  lctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  const darkness=zone==="cave"?0.55:zone==="forest"?0.25:zone==="crypt"?0.58:zone==="desert"?0.15:zone==="ice"?0.20:zone==="volcanic"?0.30:0.35;
  lctx.fillStyle=`rgba(0,0,0,${darkness})`;
  lctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  lctx.globalCompositeOperation='destination-out';

  // Player light
  const psx=Math.floor(playerX)-camX+20,psy=Math.floor(playerY)-camY+20;
  const baseR=zone==="cave"?150:zone==="forest"?280:zone==="desert"?300:230;
  const playerRadius=heldTorch?baseR*2.2:baseR;
  
  if(GFX.lightingQuality>=2){
    // Ultra: Smooth gradient with multiple stops
    const pGrad=lctx.createRadialGradient(psx,psy,0,psx,psy,playerRadius);
    pGrad.addColorStop(0,'rgba(0,0,0,1)');
    pGrad.addColorStop(0.3,'rgba(0,0,0,0.9)');
    pGrad.addColorStop(0.6,'rgba(0,0,0,0.4)');
    pGrad.addColorStop(0.85,'rgba(0,0,0,0.1)');
    pGrad.addColorStop(1,'rgba(0,0,0,0)');
    lctx.fillStyle=pGrad;
    lctx.beginPath();lctx.arc(psx,psy,playerRadius,0,Math.PI*2);lctx.fill();
  }else{
    // Balanced: Simple gradient
    const pGrad=lctx.createRadialGradient(psx,psy,0,psx,psy,playerRadius);
    pGrad.addColorStop(0,'rgba(0,0,0,1)');
    pGrad.addColorStop(0.5,'rgba(0,0,0,0.5)');
    pGrad.addColorStop(1,'rgba(0,0,0,0)');
    lctx.fillStyle=pGrad;
    lctx.beginPath();lctx.arc(psx,psy,playerRadius,0,Math.PI*2);lctx.fill();
  }

  // Light sources
  const lightSet=zone==="cave"?LIGHT_SOURCES_CAVE:zone==="forest"?LIGHT_SOURCES_FOREST:zone==="crypt"?LIGHT_SOURCES_CRYPT:zone==="graveyard"?LIGHT_SOURCES_GRAVEYARD:zone==="desert"?LIGHT_SOURCES_DESERT:zone==="ice"?LIGHT_SOURCES_ICE:zone==="volcanic"?LIGHT_SOURCES_VOLCANIC:LIGHT_SOURCES_RUIN;
  const stx=Math.floor(camX/TILE)-1,sty=Math.floor(camY/TILE)-1;
  const etx=stx+VIEW_W+2,ety=sty+VIEW_H+2;
  
  for(let my=sty;my<=ety;my++){
    for(let mx=stx;mx<=etx;mx++){
      if(mx<0||mx>=mapData.w||my<0||my>=mapData.h)continue;
      const tile=mapData.map[my][mx];
      if(!lightSet.has(tile))continue;
      const lx=mx*TILE+TILE/2-camX,ly=my*TILE+TILE/2-camY;
      const r=tile===T.TORCH_WALL?160:tile===T.CANDLE?100:tile===T.CAMP_FIRE?140:tile===T.MUSHROOM?70:tile===T.CRYSTAL?90:tile===T.SOUL_FLAME?120:tile===T.BONFIRE?180:tile===T.OASIS?200:60;
      
      if(GFX.lightingQuality>=2){
        // Ultra: Proper gradients for each light
        const grad=lctx.createRadialGradient(lx,ly,0,lx,ly,r);
        grad.addColorStop(0,'rgba(0,0,0,0.95)');
        grad.addColorStop(0.4,'rgba(0,0,0,0.6)');
        grad.addColorStop(0.7,'rgba(0,0,0,0.2)');
        grad.addColorStop(1,'rgba(0,0,0,0)');
        lctx.fillStyle=grad;
        lctx.beginPath();lctx.arc(lx,ly,r,0,Math.PI*2);lctx.fill();
      }else{
        // Balanced: Simple solid circle with soft edge
        lctx.fillStyle='rgba(0,0,0,0.8)';
        lctx.beginPath();lctx.arc(lx,ly,r*0.6,0,Math.PI*2);lctx.fill();
        lctx.fillStyle='rgba(0,0,0,0.3)';
        lctx.beginPath();lctx.arc(lx,ly,r,0,Math.PI*2);lctx.fill();
      }
    }
  }
  lctx.globalCompositeOperation='source-over';
  ctx.drawImage(lightCanvas,0,0);
}

// ═══════════════════════════════════════════════════════════════
// DIALOGUE
// ═══════════════════════════════════════════════════════════════
const DM_LINES = [
  {type:"action",text:"*A wet, rattling cough echoes through the cathedral*"},
  {type:"speech",text:"You... you're not one of them."},
  {type:"speech",text:"Thank the gods... or what remains of them."},
  {type:"speech",text:"Listen... I haven't long. The blood... it's not all mine."},
  {type:"speech",text:"They came at dawn. The Hollow Legion. Poured through the eastern gate like black water."},
  {type:"speech",text:"The King ordered the cathedral sealed. Said the relic would protect us."},
  {type:"speech",text:"He was wrong."},
  {type:"speech",text:"The relic didn't protect. It called to them."},
  {type:"speech",text:"I managed to hide it. Behind the altar, beneath the cracked sigil stone."},
  {type:"speech",text:"You must take it far from here. If they find it..."},
  {type:"speech",text:"...everything falls. Not just this city. Everything."},
  {type:"speech",text:"Promise me... *cough* ...promise me you'll—"},
  {type:"action",text:"*His eyes fix on something beyond you... then go still*"},
  {type:"action",text:"*Silence returns to the cathedral*"},
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Game(){
  const canvasRef=useRef(null);
  const ruinData=useRef(generateRuinMap());
  const townData=useRef(generateTownMap());
  const forestData=useRef(generateForestMap());
  const caveData=useRef(generateCaveMap());
  const cryptData=useRef(generateCryptMap());
  const graveyardData=useRef(generateGraveyardMap());
  const desertData=useRef(generateDesertMap());
  const iceData=useRef(generateIceMap());
  const volcanicData=useRef(generateVolcanicMap());
  const townNPCs=useRef(createTownNPCs());
  
  // Settings menu state - show before game starts
  const [gameStarted,setGameStarted]=useState(false);
  const [graphicsPreset,setGraphicsPresetState]=useState(()=>{
    try { return localStorage.getItem('darkHollowsGraphics')||'balanced'; } catch(e){ return 'balanced'; }
  });
  
  const [phase,setPhase]=useState("ruin"); // Start in ruins (prologue)
  const [transAlpha,setTransAlpha]=useState(0);

  const gameRef=useRef({
    player:{x:29*TILE,y:76*TILE,dir:2,frame:0,moving:false,kbx:0,kby:0,dodging:false,dodgeTimer:0,dodgeDir:{x:0,y:0},aimAngle:0},
    mouse:{x:CANVAS_W/2,y:CANVAS_H/2},
    keys:{},time:0,camera:{x:0,y:0},
    swinging:false,swingTimer:0,swingDur:16,attackCd:0,spaceHeld:false,sprintLocked:false,
    npcMet:false,npcDead:false,relicPickedUp:false,flashbackComplete:false,inFlashback:false,
    lastBonfire:null, // {zone, x, y} - last rested bonfire position
    enemies:createEnemies(),
    dmgCooldown:0,
    talkingNpc:null,npcLine:0,
    questProgress:{forge_chiefKilled:false,cellar_spidersKilled:0,trade_crystalFound:false,hollow_wolvesKilled:0,sacred_shrineFound:false,old_shrineFound:false,
      graveyardKilled:0,mausoleumFound:false,cryptKeyFound:false,oasisFound:false,caravanFound:false,desertRuinsExplored:0,scorpionsKilled:0},
    dead:false,deathTimer:0,zoneTransitCd:0,
    projectiles:[],enemyProjectiles:[],doors:{},destructibles:[],floatingTexts:[],
    combo:0,comboTimer:0, // Kill combo system
    _ftPool:[], // Floating text pool for recycling
    screenShake:0, // Store in ref to avoid re-renders
    frameCount:0, // Frame counter for tick-based effects
    _stamina:100, // Internal stamina tracking (synced to React every 10 frames)
    _combatTimer:0, // Internal combat timer (synced to React periodically)
    _fpsData:{frames:0,lastCheck:0,fps:60}, // FPS tracking
  });

  const [health,setHealth]=useState(100);
  const [maxHealth]=useState(100);
  const [stamina,setStamina]=useState(100);
  const [maxStamina]=useState(100);
  const [xp,setXp]=useState(0);
  const [level,setLevel]=useState(1);
  const [killCount,setKillCount]=useState(0);
  const [gold,setGold]=useState(0);
  const [skillPoints,setSkillPoints]=useState(0);
  const [skills,setSkills]=useState({}); // {skillId: true}
  const [ultCooldowns,setUltCooldowns]=useState({berserker:0,shadowstep:0,ironwill:0});
  const [activeUlt,setActiveUlt]=useState(null); // {type, timer}
  const [statusEffects,setStatusEffects]=useState([]); // [{type, duration, tickDmg, source}]
  const [combatTimer,setCombatTimer]=useState(0); // frames since last damage for hp regen delay
  const [playerDead,setPlayerDead]=useState(false);
  const [menuTab,setMenuTab]=useState(null); // null,"character","inventory","quests","map","levelup"
  const [hotbarSlot,setHotbarSlot]=useState(0);
  const [hotbar,setHotbar]=useState(()=>[
    {...ITEMS.ashen_blade},{...ITEMS.blood_philter,count:3},{...ITEMS.verdant_tonic,count:2},{...ITEMS.torch_item},null,null,null,null
  ]);
  const [equipped,setEquipped]=useState({weapon:ITEMS.ashen_blade,armor:ITEMS.wanderer_garb,relic:null});
  const [quests,setQuests]=useState(()=>{
    const q={};
    Object.keys(QUEST_DEFS).forEach(k=>{q[k]={...QUEST_DEFS[k]};});
    return q;
  });
  const [dialogue,setDialogue]=useState(null);
  const [shopOpen,setShopOpen]=useState(null); // NPC id when shop is open
  const [dialogueLine,setDialogueLine]=useState(0);
  const [npcDead,setNpcDead]=useState(false);
  const [nearNpc,setNearNpc]=useState(false);
  const [nearRelic,setNearRelic]=useState(false);
  const [nearBonfire,setNearBonfire]=useState(false);
  const [zoneExitInfo,setZoneExitInfo]=useState(null); // {label, dir}
  const [nearTownNpc,setNearTownNpc]=useState(null);
  const [notification,setNotification]=useState(null);
  const [killNotifs,setKillNotifs]=useState([]);
  const healthRef=useRef(health);healthRef.current=health;
  const staminaRef=useRef(stamina);staminaRef.current=stamina;
  const phaseRef=useRef(phase);phaseRef.current=phase;
  const menuRef=useRef(menuTab);menuRef.current=menuTab;
  const dialogueRef=useRef(dialogue);dialogueRef.current=dialogue;
  const shopOpenRef=useRef(shopOpen);shopOpenRef.current=shopOpen;
  const skillsRef=useRef(skills);skillsRef.current=skills;
  const activeUltRef=useRef(activeUlt);activeUltRef.current=activeUlt;
  const combatTimerRef=useRef(combatTimer);combatTimerRef.current=combatTimer;
  const statusEffectsRef=useRef(statusEffects);statusEffectsRef.current=statusEffects; // Real-time status effect tracking
  const deadRef=useRef(false);

  const showNotif=useCallback((msg,dur)=>{setNotification(msg);setTimeout(()=>setNotification(null),dur||3000);},[]);

  // Compute aggregate skill bonuses
  // Memoized skill bonuses - only recalculates when skills change
  const skillBonusCache=useRef({skills:{},result:null});
  const getSkillBonuses=useCallback(()=>{
    // Check if skills changed (cheap reference comparison)
    const currentSkills=skillsRef.current;
    if(skillBonusCache.current.result&&skillBonusCache.current.skills===currentSkills){
      return skillBonusCache.current.result;
    }
    const b={dmgMult:0,kbMult:0,killHeal:0,critChance:0,critMult:0,speedMult:0,dodgeChance:0,stamRegenMult:0,dmgReduce:0,hpRegenMult:0,kbResist:0,maxHpBonus:0,hasUlt:{}};
    Object.values(SKILL_TREE).forEach(path=>{
      path.skills.forEach(s=>{
        if(currentSkills[s.id]){
          Object.entries(s.effect).forEach(([k,v])=>{
            if(k==="ultimate")b.hasUlt[v]=true;
            else if(typeof v==="number")b[k]=(b[k]||0)+v;
          });
        }
      });
    });
    skillBonusCache.current={skills:currentSkills,result:b};
    return b;
  },[]);

  const canUnlockSkill=useCallback((skill)=>{
    if(skillsRef.current[skill.id])return false;
    if(skill.requires&&!skillsRef.current[skill.requires])return false;
    if(skillPoints<skill.cost)return false;
    return true;
  },[skillPoints]);

  const unlockSkill=useCallback((skill)=>{
    if(!canUnlockSkill(skill))return;
    setSkills(prev=>({...prev,[skill.id]:true}));
    setSkillPoints(prev=>prev-skill.cost);
    SoundSystem.play('pickup');
    showNotif(`Unlocked: ${skill.name}!`,3000);
    if(skill.effect.maxHpBonus){/* maxHp bonus applied dynamically via getSkillBonuses */}
  },[canUnlockSkill,showNotif]);

  // Apply status effect to player
  const applyStatusEffect=useCallback((type,duration,tickDmg=0)=>{
    // Update ref IMMEDIATELY (synchronous) for game loop access
    const existing=statusEffectsRef.current.find(e=>e.type===type);
    if(existing){
      statusEffectsRef.current=statusEffectsRef.current.map(e=>
        e.type===type?{...e,duration:Math.max(e.duration,duration),tickDmg:Math.max(e.tickDmg||0,tickDmg)}:e
      );
    }else{
      statusEffectsRef.current=[...statusEffectsRef.current,{type,duration,tickDmg,startTime:Date.now()}];
    }
    // Also update React state for UI rendering
    setStatusEffects(statusEffectsRef.current);
    // Show notification
    const effectNames={poison:"Poisoned!",venom:"Envenomed!",burn:"Burning!",freeze:"Slowed!",bleed:"Bleeding!"};
    showNotif(effectNames[type]||type,1500);
    // Play sound for status effect
    if(type==="poison")SoundSystem.play('poison');
    else if(type==="venom")SoundSystem.play('venom');
    else if(type==="burn")SoundSystem.play('burn');
    else if(type==="freeze")SoundSystem.play('freeze');
    else if(type==="bleed")SoundSystem.play('bleed');
  },[showNotif]);

  // Check if player has status effect
  const hasStatusEffect=useCallback((type)=>{
    return statusEffectsRef.current.some(e=>e.type===type);
  },[]);

  const activateUltimate=useCallback((type)=>{
    const cds={berserker:0,shadowstep:0,ironwill:0};
    // Check cooldown from gameRef
    const g=gameRef.current;
    if(g.ultCds&&g.ultCds[type]>0){showNotif("Ultimate still on cooldown!",1500);return;}
    const dur={berserker:480,shadowstep:1,ironwill:300}[type]||300;
    const cd={berserker:3600,shadowstep:2700,ironwill:3600}[type]||3600;
    if(!g.ultCds)g.ultCds={berserker:0,shadowstep:0,ironwill:0};
    g.ultCds[type]=cd;
    if(type==="shadowstep"){
      // Teleport behind nearest enemy
      const p=g.player,enemies=g.enemies;
      let nearest=null,minD=Infinity;
      enemies.forEach(e=>{if(e.dead)return;const dx=e.x-p.x,dy=e.y-p.y;const d=Math.sqrt(dx*dx+dy*dy);if(d<minD){minD=d;nearest=e;}});
      if(nearest&&minD<400){
        const dx=nearest.x-p.x,dy=nearest.y-p.y,d=Math.sqrt(dx*dx+dy*dy);
        p.x=nearest.x-(dx/d)*50;p.y=nearest.y-(dy/d)*50;
        nearest.atkCd=180; // stunned for ~3s
        nearest.hitCd=12;
        showNotif("Shadow Step!",2000);
        g.screenShake=10;
        SoundSystem.play('magic');
      }else{showNotif("No target nearby!",1500);}
    }else{
      setActiveUlt({type,timer:dur});
      showNotif(type==="berserker"?"BERSERKER RAGE!":"IRON WILL!",2000);
      g.screenShake=8;
      SoundSystem.play('magic');
    }
  },[showNotif]);

  const buyItem=useCallback((npcId,itemId,price)=>{
    if(gold<price){showNotif("Not enough gold!",1500);return;}
    const npc=townNPCs.current.find(n=>n.id===npcId);
    if(!npc||!npc.shop)return;
    const shopItem=npc.shop.find(s=>s.item===itemId);
    if(!shopItem||shopItem.stock<=0){showNotif("Out of stock!",1500);return;}
    shopItem.stock--;
    setGold(g=>g-price);
    SoundSystem.play('coin');
    // Add to hotbar or increase count
    const itemDef=ITEMS[itemId];
    setHotbar(prev=>{
      const n=[...prev];
      const existing=n.findIndex(h=>h&&h.id===itemId);
      if(existing>=0){n[existing]={...n[existing],count:n[existing].count+1};}
      else{
        const empty=n.findIndex(h=>h===null);
        if(empty>=0)n[empty]={...itemDef,count:1};
        else showNotif("Inventory full!",1500);
      }
      return n;
    });
    showNotif(`Bought ${itemDef.name}!`,1500);
  },[gold,showNotif]);

  const showKillNotif=useCallback((name,xpGain)=>{
    const id=Date.now();
    setKillNotifs(p=>[...p,{id,name,xp:xpGain,t:0}]);
    setTimeout(()=>setKillNotifs(p=>p.filter(n=>n.id!==id)),2500);
  },[]);


  const handleDeath=useCallback(()=>{
    if(deadRef.current)return;deadRef.current=true;setPlayerDead(true);
    const g=gameRef.current;g.dead=true;g.deathTimer=0;
    SoundSystem.play('kill'); // Death sound (reuse kill sound for dramatic effect)
  },[]);
  const handleRespawn=useCallback(()=>{
    const g=gameRef.current;g.dead=false;g.deathTimer=0;deadRef.current=false;setPlayerDead(false);
    setHealth(100);setStamina(100);g._stamina=100;g._combatTimer=0;g.player.kbx=0;g.player.kby=0;
    const threshold=XP_THRESHOLDS[level-1]||0;setXp(threshold);
    
    // If flashback is complete, never respawn in ruins - redirect to town
    const currentZone=phaseRef.current;
    const shouldRedirectToTown=g.flashbackComplete&&(currentZone==="ruin"||(g.lastBonfire?.zone==="ruin"));
    
    if(shouldRedirectToTown){
      // Post-flashback: always spawn in town
      setPhase("town");phaseRef.current="town";
      g.player.x=40*TILE;g.player.y=40*TILE;
      g.enemies=[];
    }else if(g.lastBonfire&&g.lastBonfire.zone!=="ruin"){
      // Use bonfire if set (and not in ruins)
      const bf=g.lastBonfire;
      setPhase(bf.zone);phaseRef.current=bf.zone;
      g.player.x=bf.x;g.player.y=bf.y;
      // Recreate enemies for the zone
      if(bf.zone==="forest")g.enemies=createForestEnemies();
      else if(bf.zone==="cave")g.enemies=createCaveEnemies();
      else if(bf.zone==="crypt")g.enemies=createCryptEnemies();
      else if(bf.zone==="graveyard")g.enemies=createGraveyardEnemies();
      else if(bf.zone==="desert")g.enemies=createDesertEnemies();
      else if(bf.zone==="town")g.enemies=[];
      else g.enemies=createEnemies();
    }else{
      // Default respawn positions by zone
      const z=phaseRef.current;
      if(z==="town"){g.player.x=40*TILE;g.player.y=40*TILE;g.enemies=[];}
      else if(z==="forest"){g.player.x=34*TILE;g.player.y=62*TILE;g.enemies=createForestEnemies();}
      else if(z==="cave"){g.player.x=4*TILE;g.player.y=24*TILE;g.enemies=createCaveEnemies();}
      else if(z==="crypt"){g.player.x=22*TILE;g.player.y=6*TILE;g.enemies=createCryptEnemies();}
      else if(z==="graveyard"){g.player.x=25*TILE;g.player.y=4*TILE;g.enemies=createGraveyardEnemies();}
      else if(z==="desert"){g.player.x=29*TILE;g.player.y=2*TILE;g.enemies=createDesertEnemies();}
      else{g.player.x=29*TILE;g.player.y=76*TILE;g.enemies=createEnemies();} // Ruins default
    }
    g.camera.x=g.player.x+20-CANVAS_W/2;g.camera.y=g.player.y+20-CANVAS_H/2;
    g.player.dir=2;g.dmgCooldown=60;setCombatTimer(99);
    setTransAlpha(0);
    showNotif(g.lastBonfire&&!shouldRedirectToTown?"Risen at bonfire.":"You have fallen. Rise again.",3000);
    SoundSystem.play('potion');
  },[level,showNotif]);

  const changeZone=useCallback((newZone,px,py)=>{
    const g=gameRef.current;
    if(g.zoneTransitCd>0)return;
    g.zoneTransitCd=30;
    g._cameraSnapFrames=30; // Skip camera lerp for 30 frames after zone change
    // Quick fade effect
    setTransAlpha(0.6);
    setTimeout(()=>{
      setPhase(newZone);phaseRef.current=newZone;
      g.player.x=px*TILE;g.player.y=py*TILE;g.player.kbx=0;g.player.kby=0;
      if(newZone==="forest")g.enemies=createForestEnemies();
      else if(newZone==="cave")g.enemies=createCaveEnemies();
      else if(newZone==="crypt")g.enemies=createCryptEnemies();
      else if(newZone==="graveyard")g.enemies=createGraveyardEnemies();
      else if(newZone==="desert")g.enemies=createDesertEnemies();
      else if(newZone==="ice")g.enemies=createIceEnemies();
      else if(newZone==="volcanic")g.enemies=createVolcanicEnemies();
      else if(newZone==="town")g.enemies=[];
      else g.enemies=createEnemies();
      // Snap camera directly to player position (no lerp)
      g.camera.x=g.player.x+20-CANVAS_W/2;g.camera.y=g.player.y+20-CANVAS_H/2;
      g._cameraSnapFrames=20; // Reset snap frames after position set
    },100);
    setTimeout(()=>setTransAlpha(0),300);
    const labels={town:"Ashenmoor",forest:"The Darkwood",cave:"Hollow Caves",ruin:"The Ashen City",crypt:"The Catacombs",graveyard:"Old Graveyard",desert:"Scorched Desert",ice:"Frozen Wastes",volcanic:"Volcanic Depths"};
    setTimeout(()=>showNotif(labels[newZone]||newZone,2500),150);
  },[showNotif]);

  useEffect(()=>{if(health<=0&&!deadRef.current)handleDeath();},[health,handleDeath]);

  useEffect(()=>{
    // Only show prologue messages when starting in the ruin zone
    if(phaseRef.current !== "ruin") return;
    const t1=setTimeout(()=>showNotif("The Ashen City...",3000),800);
    const t2=setTimeout(()=>showNotif("Find a way through the ruins",4000),4500);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[showNotif]);

  const usePotion=useCallback((slot)=>{
    const item=hotbar[slot];
    if(!item||item.type!=="consumable"||item.count<=0)return false;
    const g=gameRef.current;
    SoundSystem.play('potion');
    if(item.icon==="potion_red"){const mhp=100+(getSkillBonuses().maxHpBonus||0);setHealth(h=>Math.min(mhp,h+item.stats.heal));showNotif(`Used ${item.name} (+${item.stats.heal} HP)`,2000);}
    else if(item.icon==="potion_green"){g._stamina=Math.min(100,g._stamina+item.stats.stam);setStamina(g._stamina);showNotif(`Used ${item.name} (+${item.stats.stam} Stamina)`,2000);}
    setHotbar(prev=>{const n=[...prev];n[slot]={...n[slot],count:n[slot].count-1};if(n[slot].count<=0)n[slot]=null;return n;});
    return true;
  },[hotbar,showNotif]);

  // Save/Load System
  const saveGame=useCallback(()=>{
    const g=gameRef.current;
    const saveData={
      version:1,
      player:{x:g.player.x,y:g.player.y,dir:g.player.dir},
      health,stamina,xp,level,skillPoints,
      hotbar:hotbar.map(i=>i?{id:i.id,count:i.count}:null),
      equipped,skills,
      zone:phaseRef.current,
      npcMet:g.npcMet,npcDead:g.npcDead,relicPickedUp:g.relicPickedUp,flashbackComplete:g.flashbackComplete,inFlashback:g.inFlashback,
      lastBonfire:g.lastBonfire,
      quests,gold,
      timestamp:Date.now()
    };
    try{
      localStorage.setItem('darkHollowsSave',JSON.stringify(saveData));
      SoundSystem.play('save');
      showNotif("Game Saved",2000);
      return true;
    }catch(e){showNotif("Save failed!",2000);return false;}
  },[health,stamina,xp,level,skillPoints,hotbar,equipped,skills,quests,gold,showNotif]);

  const loadGame=useCallback(()=>{
    try{
      const data=JSON.parse(localStorage.getItem('darkHollowsSave'));
      if(!data||!data.version)return false;
      const g=gameRef.current;
      g.player.x=data.player.x;g.player.y=data.player.y;g.player.dir=data.player.dir;
      setHealth(data.health);setStamina(data.stamina);g._stamina=data.stamina;g._combatTimer=0;
      setXp(data.xp);setLevel(data.level);setSkillPoints(data.skillPoints);
      // Restore hotbar items
      const restoredHotbar=data.hotbar.map(saved=>{
        if(!saved)return null;
        const template=Object.values(ITEMS).find(i=>i.id===saved.id);
        return template?{...template,count:saved.count}:null;
      });
      setHotbar(restoredHotbar);
      setEquipped(data.equipped);setSkills(data.skills||{});
      setQuests(data.quests||[]);setGold(data.gold||0);
      g.npcMet=data.npcMet;g.npcDead=data.npcDead;g.relicPickedUp=data.relicPickedUp;g.flashbackComplete=data.flashbackComplete||false;g.inFlashback=data.inFlashback||false;
      g.lastBonfire=data.lastBonfire||null;
      // Change zone if different
      if(data.zone&&data.zone!==phaseRef.current){
        setPhase(data.zone);phaseRef.current=data.zone;
        if(data.zone==="forest")g.enemies=createForestEnemies();
        else if(data.zone==="cave")g.enemies=createCaveEnemies();
        else if(data.zone==="crypt")g.enemies=createCryptEnemies();
        else if(data.zone==="graveyard")g.enemies=createGraveyardEnemies();
        else if(data.zone==="desert")g.enemies=createDesertEnemies();
        else if(data.zone==="town")g.enemies=[];
        else g.enemies=createEnemies();
      }
      g.camera.x=g.player.x-CANVAS_W/2;g.camera.y=g.player.y-CANVAS_H/2;
      showNotif("Game Loaded",2000);
      return true;
    }catch(e){showNotif("No save found",2000);return false;}
  },[showNotif]);

  const hasSaveData=useCallback(()=>{
    try{return!!localStorage.getItem('darkHollowsSave');}catch{return false;}
  },[]);

  const startTransition=useCallback(()=>{
    setPhase("transition");
    let alpha=0;
    const fadeOut=setInterval(()=>{
      alpha+=0.02;setTransAlpha(alpha);
      if(alpha>=1){
        clearInterval(fadeOut);
        const g=gameRef.current;
        g.player.x=40*TILE;g.player.y=40*TILE;g.player.dir=2;g.player.kbx=0;g.player.kby=0;g.enemies=[];
        g.inFlashback=true; // Mark that we're in the flashback
        setPhase("town");phaseRef.current="town";
        setTimeout(()=>showNotif("Three months earlier...",4000),500);
        setTimeout(()=>showNotif("Ashenmoor, before the fall",5000),5000);
        let a2=1;
        const fadeIn=setInterval(()=>{a2-=0.02;setTransAlpha(Math.max(0,a2));if(a2<=0)clearInterval(fadeIn);},30);
      }
    },30);
  },[showNotif]);

  // Input
  useEffect(()=>{
    if(!gameStarted)return; // Don't attach input handlers until game starts
    const g=gameRef.current;
    const canvas=canvasRef.current;
    const onDown=(e)=>{
      SoundSystem.init(); // Initialize sound on first input
      const k=e.key.toLowerCase();
      g.keys[k]=true;
      if(deadRef.current){if(k===" "||k==="enter"){e.preventDefault();handleRespawn();}return;}
      const inMenu=menuRef.current!==null||shopOpenRef.current!==null;
      const inDlg=dialogueRef.current!==null;

      // Tab: toggle menu
      if(k==="tab"){e.preventDefault();SoundSystem.play('ui');setMenuTab(v=>v?null:"character");return;}
      if(k==="escape"){setMenuTab(null);setDialogue(null);dialogueRef.current=null;setShopOpen(null);return;}
      if(k==="m"&&!inDlg){e.preventDefault();setMenuTab(v=>v==="map"?null:"map");return;}
      if(k==="i"&&!inDlg){e.preventDefault();setMenuTab(v=>v==="inventory"?null:"inventory");return;}
      if(k==="q"&&!inDlg){e.preventDefault();setMenuTab(v=>v==="quests"?null:"quests");return;}
      if(k==="k"&&!inDlg){e.preventDefault();setMenuTab(v=>v==="skills"?null:"skills");return;}
      // Save/Load with F5/F9
      if(e.key==="F5"){e.preventDefault();saveGame();return;}
      if(e.key==="F9"){e.preventDefault();loadGame();return;}
      if(k==="r"&&!inDlg&&!inMenu){
        // Activate ultimate
        const sb=getSkillBonuses();
        if(sb.hasUlt.berserker)activateUltimate("berserker");
        else if(sb.hasUlt.shadowstep)activateUltimate("shadowstep");
        else if(sb.hasUlt.ironwill)activateUltimate("ironwill");
      }

      if(inMenu)return;

      if(k>="1"&&k<="8"){setHotbarSlot(parseInt(k)-1);SoundSystem.play('ui');}

      // Dodge roll on space
      if(k===" "&&!inDlg){
        e.preventDefault();
        if(!g.spaceHeld&&!g.player.dodging&&g._stamina>=20){
          g.spaceHeld=true;
          const p=g.player;
          // Dodge in movement direction, or facing direction if standing still
          let ddx=0,ddy=0;
          if(g.keys["w"]||g.keys["arrowup"])ddy=-1;
          if(g.keys["s"]||g.keys["arrowdown"])ddy=1;
          if(g.keys["a"]||g.keys["arrowleft"])ddx=-1;
          if(g.keys["d"]||g.keys["arrowright"])ddx=1;
          if(ddx===0&&ddy===0){
            // Use facing direction based on mouse
            const mx=g.mouse.x,my=g.mouse.y;
            const psx=p.x-g.camera.x+20,psy=p.y-g.camera.y+20;
            ddx=mx-psx;ddy=my-psy;
            const mag=Math.sqrt(ddx*ddx+ddy*ddy)||1;
            ddx/=mag;ddy/=mag;
          }else{
            const mag=Math.sqrt(ddx*ddx+ddy*ddy)||1;
            ddx/=mag;ddy/=mag;
          }
          p.dodging=true;p.dodgeTimer=18;p.dodgeDir={x:ddx,y:ddy};
          g._stamina=Math.max(0,g._stamina-20);
          SoundSystem.play('woosh');
        }
      }

      // Interact
      if(k==="e"&&!inDlg){
        // Check for crypt entrance (graveyard zone, at crypt entrance tiles)
        const z=phaseRef.current;
        const ptx=Math.floor(g.player.x/TILE),pty=Math.floor(g.player.y/TILE);
        if(z==="graveyard"&&ptx>=23&&ptx<=27&&pty>=30&&pty<=35){
          changeZone("crypt",22,5);
          return;
        }
        if(nearBonfire){
          // Rest at bonfire - full heal, save, and set respawn point
          setHealth(100+(getSkillBonuses().maxHpBonus||0));
          setStamina(100);g._stamina=100;g._combatTimer=0;
          setStatusEffects([]);
          // Save bonfire position as respawn point
          g.lastBonfire={zone:phaseRef.current,x:g.player.x,y:g.player.y};
          saveGame();
          showNotif("Rested at bonfire. Respawn point set.",3000);
          SoundSystem.play('save');
        }else if(nearNpc&&!g.npcDead){setDialogue("knight");dialogueRef.current="knight";setDialogueLine(0);}
        else if(nearRelic&&!g.relicPickedUp){
          g.relicPickedUp=true;
          ruinData.current.map[8][30]=T.CATHEDRAL_FLOOR;
          showNotif("Acquired: The Ashen Relic",3000);
          setQuests(prev=>{const n={...prev};n.prologue={...n.prologue,status:"complete"};return n;});
          // Trigger flashback sequence
          setTimeout(()=>showNotif("A vision floods your mind...",4000),3500);
          setTimeout(()=>startTransition(),8000);
        }else if(nearTownNpc){
          const npc=nearTownNpc;
          // Trader: open shop directly or after brief greeting
          if(npc.isTrader){
            g.talkingNpc=npc;g.npcLine=0;
            setDialogue("town_npc");dialogueRef.current="town_npc";setDialogueLine(0);
            return;
          }
          const qid=npc.questId;const qp=g.questProgress;
          const canComplete=
            (qid==="forge_ahead"&&qp.forge_chiefKilled)||
            (qid==="cellar_spirits"&&qp.cellar_spidersKilled>=4)||
            (qid==="trade_routes"&&qp.trade_crystalFound)||
            (qid==="hollow_threat"&&qp.hollow_wolvesKilled>=3)||
            (qid==="sacred_relics"&&qp.sacred_shrineFound)||
            (qid==="old_ways"&&qp.old_shrineFound)||
            (qid==="alpha_hunt"&&qp.alpha_wolfKilled)||
            (qid==="spider_depths"&&qp.spider_queenKilled)||
            (qid==="catacombs"&&qp.catacombs_explored)||
            // Graveyard quests
            (qid==="restless_dead"&&qp.graveyardKilled>=6)||
            (qid==="grave_robbers"&&qp.mausoleumFound)||
            (qid==="crypt_key"&&qp.cryptKeyFound)||
            // Desert quests
            (qid==="oasis_guardian"&&qp.oasisGuardianKilled)||
            (qid==="lost_caravan"&&qp.caravanFound)||
            (qid==="desert_ruins"&&qp.desertRuinsExplored>=2)||
            (qid==="scorpion_threat"&&qp.scorpionsKilled>=4);
          if(canComplete&&quests[qid]?.status==="active"){
            setQuests(prev=>{
              const n={...prev};
              n[qid]={...n[qid],status:"complete"};
              // Unlock chained quests
              if(qid==="cellar_spirits"&&n.spider_depths?.status==="locked"){n.spider_depths.status="available";}
              if(qid==="catacombs"&&n.hollow_lord?.status==="locked"){n.hollow_lord.status="available";}
              return n;
            });
            const gld=QUEST_DEFS[qid]?.gold||0;if(gld>0)setGold(g2=>g2+gld);
            const rwd=QUEST_DEFS[qid]?.reward;
            SoundSystem.play('levelup'); // Quest complete fanfare
            if(rwd&&ITEMS[rwd]){setEquipped(prev=>({...prev,armor:ITEMS[rwd]}));showNotif("Quest Complete! +"+gld+"g + "+ITEMS[rwd].name,4000);}
            else showNotif("Quest Complete! +"+gld+" gold",3500);
            return;
          }
          g.talkingNpc=npc;g.npcLine=0;
          setDialogue("town_npc");dialogueRef.current="town_npc";setDialogueLine(0);
        }
      }

      // Advance dialogue
      if((k===" "||k==="enter"||k==="e")&&inDlg){
        e.preventDefault();
        if(dialogueRef.current==="knight"){
          setDialogueLine(prev=>{
            const next=prev+1;
            if(next>=DM_LINES.length){setDialogue(null);dialogueRef.current=null;setNpcDead(true);g.npcDead=true;setTimeout(()=>showNotif("The knight has passed.",4000),500);return prev;}
            if(next===DM_LINES.length-1)setTimeout(()=>{setNpcDead(true);g.npcDead=true;},800);
            return next;
          });
        }else if(dialogueRef.current==="town_npc"){
          const npc=g.talkingNpc;
          if(!npc)return;
          setDialogueLine(prev=>{
            const next=prev+1;
            if(next>=npc.lines.length){
              setDialogue(null);dialogueRef.current=null;
              // Activate quest if available
              if(npc.questId){
                setQuests(prev2=>{
                  const n={...prev2};
                  if(n[npc.questId]&&n[npc.questId].status==="available"){
                    n[npc.questId]={...n[npc.questId],status:"active"};
                    SoundSystem.play('pickup'); // Quest start sound
                    setTimeout(()=>showNotif(`Quest Started: ${n[npc.questId].name}`,3000),300);
                  }
                  return n;
                });
              }
              // Trader: open shop
              if(npc.isTrader){
                setShopOpen(npc.id);
              }
              return prev;
            }
            return next;
          });
        }
      }
    };
    const onUp=(e)=>{const k=e.key.toLowerCase();g.keys[k]=false;if(k===' ')g.spaceHeld=false;};
    const onMouseMove=(e)=>{
      if(!canvas)return;
      const rect=canvas.getBoundingClientRect();
      g.mouse.x=e.clientX-rect.left;
      g.mouse.y=e.clientY-rect.top;
    };
    const onClick=(e)=>{
      SoundSystem.init(); // Initialize sound on first click
      if(deadRef.current||menuRef.current||dialogueRef.current||shopOpenRef.current)return;
      const ci=hotbar[hotbarSlot];
      if(ci&&ci.type==="consumable"){usePotion(hotbarSlot);return;}
      if(!g.swinging&&g.attackCd<=0&&!g.player.dodging){
        const wpn=equipped.weapon;
        const stam=wpn?.stats?.stam||ATTACK_STAM_COST;
        // Bow needs arrows
        if(wpn?.stats?.ranged){
          const arrowSlot=hotbar.findIndex(h=>h&&h.id==="arrows"&&h.count>0);
          if(arrowSlot<0){showNotif("No arrows!",1200);return;}
        }
        if(g._stamina>=stam){
          g.swinging=true;g.swingTimer=0;g.attackCd=ATTACK_COOLDOWN;
          g._stamina=Math.max(0,g._stamina-stam);
          // Weapon-specific attack sounds
          const wpnIcon=wpn?.icon||'sword';
          if(wpn?.stats?.ranged)SoundSystem.play('shoot');
          else if(wpnIcon==='axe')SoundSystem.play('chop');
          else if(wpnIcon==='spear')SoundSystem.play('thrust');
          else SoundSystem.play('slash');
          // Consume arrow for bow
          if(wpn?.stats?.ranged){
            setHotbar(prev=>{
              const n=[...prev];
              const arrowSlot=n.findIndex(h=>h&&h.id==="arrows"&&h.count>0);
              if(arrowSlot>=0){n[arrowSlot]={...n[arrowSlot],count:n[arrowSlot].count-1};if(n[arrowSlot].count<=0)n[arrowSlot]=null;}
              return n;
            });
            // Fire projectile
            const mx=g.mouse.x,my=g.mouse.y;
            const psxC=g.player.x-g.camera.x+20,psyC=g.player.y-g.camera.y+20;
            const angle=Math.atan2(my-psyC,mx-psxC);
            g.projectiles.push({x:g.player.x+20,y:g.player.y+20,vx:Math.cos(angle)*4.5,vy:Math.sin(angle)*4.5,dmg:wpn.stats.dmg,life:90});
          }
        }else{
          showNotif("Not enough stamina!",1200);
        }
      }
    };
    window.addEventListener("keydown",onDown);window.addEventListener("keyup",onUp);
    if(canvas){canvas.addEventListener("mousemove",onMouseMove);canvas.addEventListener("click",onClick);}
    return()=>{
      window.removeEventListener("keydown",onDown);window.removeEventListener("keyup",onUp);
      if(canvas){canvas.removeEventListener("mousemove",onMouseMove);canvas.removeEventListener("click",onClick);}
    };
  },[gameStarted,dialogue,nearNpc,nearRelic,nearTownNpc,showNotif,hotbar,hotbarSlot,usePotion,startTransition,handleRespawn,changeZone,saveGame,loadGame]);

  // Game loop
  useEffect(()=>{
    if(!gameStarted)return; // Don't start game loop until settings menu is dismissed
    const canvas=canvasRef.current;
    if(!canvas)return; // Guard against null ref
    const ctx=canvas.getContext("2d");
    let animId;const g=gameRef.current;
    let lastTime=0;
    const TARGET_FPS=60;
    const FRAME_TIME=1000/TARGET_FPS;

    const loop=(ts)=>{
      // Delta time calculation for frame-independent timing
      const deltaTime=lastTime?Math.min(ts-lastTime,50):16.67; // Cap at 50ms to prevent huge jumps
      const dtMult=deltaTime/FRAME_TIME; // Multiplier for frame-based values
      lastTime=ts;
      
      g.time=ts;
      g.frameCount++; // Persistent frame counter for tick effects
      const p=g.player,keys=g.keys;
      const zone=phaseRef.current;
      const isTown=zone==="town";const isForest=zone==="forest";const isCave=zone==="cave";const isCrypt=zone==="crypt";const isGraveyard=zone==="graveyard";const isDesert=zone==="desert";const isIce=zone==="ice";const isVolcanic=zone==="volcanic";
      const md=isTown?townData.current:isForest?forestData.current:isCave?caveData.current:isCrypt?cryptData.current:isGraveyard?graveyardData.current:isDesert?desertData.current:isIce?iceData.current:isVolcanic?volcanicData.current:ruinData.current;
      const MAP_W=md.w,MAP_H=md.h;
      const inMenu=menuRef.current!==null||shopOpenRef.current!==null;
      const inDlg=dialogueRef.current!==null;
      // Use GFX preset settings for quality (user-selected, not dynamic)
      const doExpensiveEffects=GFX.atmosphericEffects&&(g.frameCount%GFX.renderSkipFrames===0);
      const doParticles=GFX.atmosphericEffects&&GFX.particleLimit>0;
      if(g.zoneTransitCd>0)g.zoneTransitCd-=dtMult;

      // Attack cooldown
      if(g.attackCd>0)g.attackCd-=dtMult;

      // Swing - DELTA TIME BASED
      if(g.swinging){
        const prevTimer=g.swingTimer;
        g.swingTimer+=dtMult;
        if(g.swingTimer>=g.swingDur){g.swinging=false;g.swingTimer=0;}
        // Trigger hit when timer crosses the 6-frame mark (only once)
        if(prevTimer<6&&g.swingTimer>=6&&!isTown){
          const wpn=equipped.weapon;
          // Ranged weapons (bow) don't do melee damage
          if(wpn?.stats?.ranged)return;
          const sb=getSkillBonuses();
          let baseDmg=wpn?wpn.stats.dmg:5;
          const range=wpn?.stats?.range||85;
          baseDmg=Math.floor(baseDmg*(1+sb.dmgMult));
          if(activeUltRef.current?.type==="berserker")baseDmg=Math.floor(baseDmg*2);
          g.enemies.forEach(e=>{
            if(e.dead)return;
            const dx=(e.x+20)-(p.x+20),dy=(e.y+20)-(p.y+20);
            const dist=Math.sqrt(dx*dx+dy*dy);
            // Check if enemy is within attack arc (150 degree cone toward mouse)
            const angleToEnemy=Math.atan2(dy,dx);
            let angleDiff=Math.abs(angleToEnemy-p.aimAngle);
            if(angleDiff>Math.PI)angleDiff=2*Math.PI-angleDiff;
            const inArc=angleDiff<Math.PI*0.42; // ~75 degrees each side = 150 degree cone
            if(dist<range&&inArc){
              let dmg=baseDmg;
              // Crit check
              if(sb.critChance>0&&Math.random()<sb.critChance){
                dmg=Math.floor(dmg*(1.5+(sb.critMult||0)));
                g.screenShake=6;
                g.floatingTexts.push({x:e.x+20,y:e.y,text:dmg+"!",color:"#ffa040",life:45,crit:true});
              }else{
                g.floatingTexts.push({x:e.x+20+(Math.random()*10-5),y:e.y,text:dmg,color:"#ffffff",life:35,crit:false});
              }
              e.hp-=dmg;e.hitCd=10;
              SoundSystem.play('hit');
              // Life steal from berserker
              if(activeUltRef.current?.type==="berserker"){setHealth(h=>Math.min(maxHealth+(sb.maxHpBonus||0),h+Math.ceil(dmg*0.15)));}
              // Knockback: push enemy away from player
              const kbStr=(ENEMY_INFO[e.type]?.kb||6)*(1+sb.kbMult);
              if(dist>0){e.kbx=(dx/dist)*kbStr;e.kby=(dy/dist)*kbStr;}
              // Weapon status effect application
              const wpn=equipped.weapon;
              if(wpn?.stats?.bleedChance&&Math.random()<wpn.stats.bleedChance){
                e.statusEffects=e.statusEffects||[];
                if(!e.statusEffects.find(s=>s.type==="bleed")){
                  e.statusEffects.push({type:"bleed",duration:150,tickDmg:wpn.stats.bleedDmg||2});
                  g.floatingTexts.push({x:e.x+20,y:e.y-15,text:"BLEED",color:"#c03030",life:30,crit:false});
                  SoundSystem.play('bleed');
                }
              }
              if(wpn?.stats?.burnChance&&Math.random()<wpn.stats.burnChance){
                e.statusEffects=e.statusEffects||[];
                if(!e.statusEffects.find(s=>s.type==="burn")){
                  e.statusEffects.push({type:"burn",duration:180,tickDmg:wpn.stats.burnDmg||3});
                  g.floatingTexts.push({x:e.x+20,y:e.y-15,text:"BURN",color:"#ff8040",life:30,crit:false});
                  SoundSystem.play('burn');
                }
              }
              if(wpn?.stats?.freezeChance&&Math.random()<wpn.stats.freezeChance){
                e.statusEffects=e.statusEffects||[];
                if(!e.statusEffects.find(s=>s.type==="freeze")){
                  e.statusEffects.push({type:"freeze",duration:wpn.stats.freezeDur||120});
                  g.floatingTexts.push({x:e.x+20,y:e.y-15,text:"FROZEN",color:"#80c0ff",life:30,crit:false});
                  SoundSystem.play('freeze');
                }
              }
              if(wpn?.stats?.poisonChance&&Math.random()<wpn.stats.poisonChance){
                e.statusEffects=e.statusEffects||[];
                if(!e.statusEffects.find(s=>s.type==="poison")){
                  // Poison: lasts 1 minute (3600 frames), blocks regen, NO damage
                  e.statusEffects.push({type:"poison",duration:3600});
                  g.floatingTexts.push({x:e.x+20,y:e.y-15,text:"POISON",color:"#60c060",life:30,crit:false});
                  SoundSystem.play('poison');
                }
              }
              if(wpn?.stats?.venomChance&&Math.random()<wpn.stats.venomChance){
                e.statusEffects=e.statusEffects||[];
                if(!e.statusEffects.find(s=>s.type==="venom")){
                  // Venom: short duration (~4 seconds), high damage
                  e.statusEffects.push({type:"venom",duration:240,tickDmg:wpn.stats.venomDmg||4});
                  g.floatingTexts.push({x:e.x+20,y:e.y-15,text:"VENOM",color:"#80ff40",life:30,crit:false});
                  SoundSystem.play('venom');
                }
              }
              if(e.hp<=0){
                e.dead=true;
                SoundSystem.play('kill');
                const info=ENEMY_INFO[e.type];
                // Combo system
                g.combo++;g.comboTimer=180; // 3 seconds to continue combo
                const comboMult=Math.min(2,1+g.combo*0.1);
                const bonusXp=Math.floor(info.xp*comboMult);
                showKillNotif(info.name,bonusXp);
                setXp(x=>x+bonusXp);setKillCount(c=>c+1);
                if(g.combo>=2){
                  g.floatingTexts.push({x:e.x+20,y:e.y-20,text:g.combo+"x COMBO!",color:"#ffa040",life:60,crit:true});
                  g.floatingTexts.push({x:e.x+20,y:e.y-5,text:"+"+bonusXp+" XP",color:"#60ff60",life:50,crit:false});
                }else{
                  g.floatingTexts.push({x:e.x+20,y:e.y-10,text:"+"+bonusXp+" XP",color:"#60ff60",life:50,crit:false});
                }
                // Kill heal skill
                if(sb.killHeal>0)setHealth(h=>Math.min(maxHealth+(sb.maxHpBonus||0),h+sb.killHeal));
                // Quest kill tracking
                const qp=g.questProgress;
                if(e.type==="timber_wolf"&&quests.hollow_threat?.status==="active"){
                  qp.hollow_wolvesKilled=(qp.hollow_wolvesKilled||0)+1;
                  if(qp.hollow_wolvesKilled>=3&&!qp._wolfNotif){qp._wolfNotif=true;showNotif("Wolves thinned. Return to Captain Aldren.",3000);}
                }
                if(e.type==="bandit_chief"&&quests.forge_ahead?.status==="active"){
                  qp.forge_chiefKilled=true;showNotif("Bandit Chief defeated! Recover the ore and return to Aldric.",3500);
                }
                if(e.type==="cave_spider"&&quests.cellar_spirits?.status==="active"){
                  qp.cellar_spidersKilled=(qp.cellar_spidersKilled||0)+1;
                  if(qp.cellar_spidersKilled>=4&&!qp._spiderNotif){qp._spiderNotif=true;showNotif("Cave spiders cleared. Return to Marta.",3000);}
                }
                // Boss kill tracking for new quests
                if(e.type==="alpha_wolf"&&quests.alpha_hunt?.status==="active"){
                  qp.alpha_wolfKilled=true;
                  showNotif("The Alpha Wolf falls! Claim your bounty from Hunter Grim.",4000);
                  g.screenShake=12;
                }
                if(e.type==="spider_queen"&&quests.spider_depths?.status==="active"){
                  qp.spider_queenKilled=true;
                  showNotif("The Spider Queen is slain! Return to Marta with proof of your deed.",4000);
                  g.screenShake=12;
                }
                if(e.type==="hollow_lord"&&quests.hollow_lord?.status==="active"){
                  qp.hollow_lordKilled=true;
                  showNotif("THE HOLLOW LORD IS DESTROYED! The catacombs grow silent...",5000);
                  g.screenShake=15;
                  // Unlock completion
                  setQuests(prev=>{const n={...prev};if(n.hollow_lord)n.hollow_lord.status="complete";return n;});
                }
                // Graveyard quest tracking
                if((e.type==="grave_zombie"||e.type==="restless_spirit"||e.type==="bone_guard")&&quests.restless_dead?.status==="active"){
                  qp.graveyardKilled=(qp.graveyardKilled||0)+1;
                  if(qp.graveyardKilled>=6&&!qp._graveyardNotif){qp._graveyardNotif=true;showNotif("The restless dead are quelled. Return to Father Osric.",3500);}
                }
                // Desert quest tracking
                if(e.type==="desert_scorpion"&&quests.scorpion_threat?.status==="active"){
                  qp.scorpionsKilled=(qp.scorpionsKilled||0)+1;
                  if(qp.scorpionsKilled>=4&&!qp._scorpionNotif){qp._scorpionNotif=true;showNotif("Scorpion threat neutralized. Return to Captain Aldren.",3500);}
                }
                if(e.type==="oasis_guardian"&&quests.oasis_guardian?.status==="active"){
                  qp.oasisGuardianKilled=true;
                  showNotif("The Oasis Guardian falls! The waters are safe once more.",4000);
                  g.screenShake=12;
                }
                // Generate and apply loot drops
                const loot=generateLoot(e.type);
                let yOffset=10;
                loot.forEach(drop=>{
                  if(drop.type==="gold"){
                    setGold(g2=>g2+drop.amount);
                    g.floatingTexts.push({x:e.x+20,y:e.y-yOffset,text:"+"+drop.amount+"g",color:"#ffd700",life:45,crit:false});
                  }else if(drop.type==="item"){
                    // Try to add to hotbar
                    const template=Object.values(ITEMS).find(it=>it.id===drop.id);
                    if(template){
                      setHotbar(prev=>{
                        const newBar=[...prev];
                        // Find existing stack or empty slot
                        let found=false;
                        for(let s=0;s<newBar.length;s++){
                          if(newBar[s]&&newBar[s].id===drop.id&&template.type==="consumable"){
                            newBar[s]={...newBar[s],count:newBar[s].count+drop.count};
                            found=true;break;
                          }
                        }
                        if(!found){
                          for(let s=0;s<newBar.length;s++){
                            if(!newBar[s]){newBar[s]={...template,count:drop.count};found=true;break;}
                          }
                        }
                        if(found)g.floatingTexts.push({x:e.x+20,y:e.y-yOffset-15,text:"+"+template.name,color:"#80c0ff",life:50,crit:false});
                        return newBar;
                      });
                    }
                  }
                  yOffset+=15;
                });
                // Boss death special effects
                if(info.isBoss){
                  SoundSystem.play('level_up');
                  g.screenShake=12;
                  showNotif(`${info.name} DEFEATED!`,4000);
                }
              }
            }
          });
          // Check for destructible jars in attack range
          const atkDirX=Math.cos(p.aimAngle),atkDirY=Math.sin(p.aimAngle);
          for(let r=1;r<=Math.ceil(range/TILE)+1;r++){
            const jtx=Math.floor((p.x+20+atkDirX*r*TILE*0.5)/TILE);
            const jty=Math.floor((p.y+20+atkDirY*r*TILE*0.5)/TILE);
            if(jtx>=0&&jtx<MAP_W&&jty>=0&&jty<MAP_H&&md.map[jty][jtx]===T.JAR){
              // Destroy jar
              md.map[jty][jtx]=isTown?T.WOOD_FLOOR:isForest?T.DIRT:isCave?T.CAVE_FLOOR:T.COBBLE;
              SoundSystem.play('break');
              // Spawn loot
              const roll=Math.random();
              if(roll<0.25){
                const goldAmt=Math.floor(Math.random()*8)+3;
                setGold(g2=>g2+goldAmt);
                g.floatingTexts.push({x:jtx*TILE+20,y:jty*TILE,text:"+"+goldAmt+"g",color:"#ffd700",life:40,crit:false});
                SoundSystem.play('coin');
              }
              else if(roll<0.35){
                setHotbar(prev=>{const n=[...prev];const si=n.findIndex(s=>s&&s.id==="blood_philter");if(si>=0){n[si]={...n[si],count:n[si].count+1};return n;}const ei=n.findIndex(s=>s===null);if(ei>=0)n[ei]={...ITEMS.blood_philter,count:1};return n;});
                showNotif("Found a Blood Philter!",1500);
                SoundSystem.play('pickup');
              }else if(roll<0.4){
                setHotbar(prev=>{const n=[...prev];const si=n.findIndex(s=>s&&s.id==="verdant_tonic");if(si>=0){n[si]={...n[si],count:n[si].count+1};return n;}const ei=n.findIndex(s=>s===null);if(ei>=0)n[ei]={...ITEMS.verdant_tonic,count:1};return n;});
                showNotif("Found a Verdant Tonic!",1500);
                SoundSystem.play('pickup');
              }
              break;
            }
          }
        }
      }

      // Projectile processing
      g.projectiles=g.projectiles.filter(proj=>{
        proj.x+=proj.vx*dtMult;proj.y+=proj.vy*dtMult;proj.life-=dtMult; // DELTA TIME
        if(proj.life<=0)return false;
        // Check enemy collision
        for(const e of g.enemies){
          if(e.dead)continue;
          const dx=proj.x-(e.x+20),dy=proj.y-(e.y+20);
          if(Math.sqrt(dx*dx+dy*dy)<25){
            const sb=getSkillBonuses();
            let dmg=Math.floor(proj.dmg*(1+sb.dmgMult));
            if(activeUltRef.current?.type==="berserker")dmg=Math.floor(dmg*2);
            let isCrit=false;
            if(sb.critChance>0&&Math.random()<sb.critChance){dmg=Math.floor(dmg*(1.5+(sb.critMult||0)));g.screenShake=4;isCrit=true;}
            g.floatingTexts.push({x:e.x+20+(Math.random()*10-5),y:e.y,text:isCrit?dmg+"!":dmg,color:isCrit?"#ffa040":"#ffffff",life:35,crit:isCrit});
            e.hp-=dmg;e.hitCd=10;
            SoundSystem.play('hit');
            if(activeUltRef.current?.type==="berserker")setHealth(h=>Math.min(maxHealth+(sb.maxHpBonus||0),h+Math.ceil(dmg*0.15)));
            if(e.hp<=0){
              e.dead=true;
              SoundSystem.play('kill');
              const info=ENEMY_INFO[e.type];
              // Combo system
              g.combo++;g.comboTimer=180;
              const comboMult=Math.min(2,1+g.combo*0.1);
              const bonusXp=Math.floor(info.xp*comboMult);
              showKillNotif(info.name,bonusXp);
              setXp(x=>x+bonusXp);setKillCount(c=>c+1);
              if(g.combo>=2){
                g.floatingTexts.push({x:e.x+20,y:e.y-20,text:g.combo+"x COMBO!",color:"#ffa040",life:60,crit:true});
              }
              g.floatingTexts.push({x:e.x+20,y:e.y-5,text:"+"+bonusXp+" XP",color:"#60ff60",life:50,crit:false});
              if(sb.killHeal>0)setHealth(h=>Math.min(maxHealth+(sb.maxHpBonus||0),h+sb.killHeal));
              // Generate loot drops
              const loot=generateLoot(e.type);
              let yOffset=25;
              loot.forEach(drop=>{
                if(drop.type==="gold"){
                  setGold(g2=>g2+drop.amount);
                  g.floatingTexts.push({x:e.x+20,y:e.y-yOffset,text:"+"+drop.amount+"g",color:"#ffd700",life:45,crit:false});
                }else if(drop.type==="item"){
                  const template=Object.values(ITEMS).find(it=>it.id===drop.id);
                  if(template){
                    setHotbar(prev=>{
                      const newBar=[...prev];
                      let found=false;
                      for(let s=0;s<newBar.length;s++){
                        if(newBar[s]&&newBar[s].id===drop.id&&template.type==="consumable"){
                          newBar[s]={...newBar[s],count:newBar[s].count+drop.count};found=true;break;
                        }
                      }
                      if(!found){for(let s=0;s<newBar.length;s++){if(!newBar[s]){newBar[s]={...template,count:drop.count};found=true;break;}}}
                      if(found)g.floatingTexts.push({x:e.x+20,y:e.y-yOffset-15,text:"+"+template.name,color:"#80c0ff",life:50,crit:false});
                      return newBar;
                    });
                  }
                }
                yOffset+=15;
              });
              if(info.isBoss){SoundSystem.play('level_up');g.screenShake=12;showNotif(`${info.name} DEFEATED!`,4000);}
            }
            return false;
          }
        }
        // Check destructible JAR collision
        const jtx=Math.floor(proj.x/TILE),jty=Math.floor(proj.y/TILE);
        if(jtx>=0&&jtx<MAP_W&&jty>=0&&jty<MAP_H&&md.map[jty][jtx]===T.JAR){
          md.map[jty][jtx]=isTown?T.WOOD_FLOOR:isForest?T.DIRT:isCave?T.CAVE_FLOOR:T.COBBLE;
          const roll=Math.random();
          if(roll<0.2)setGold(gold2=>gold2+Math.floor(Math.random()*6)+2);
          return false;
        }
        return true;
      });

      // Enemy projectile processing - DELTA TIME BASED
      g.enemyProjectiles=g.enemyProjectiles.filter(proj=>{
        proj.x+=proj.vx*dtMult;proj.y+=proj.vy*dtMult;proj.life-=dtMult;
        if(proj.life<=0)return false;
        // Check player collision
        const dx=proj.x-(p.x+20),dy=proj.y-(p.y+20);
        if(Math.sqrt(dx*dx+dy*dy)<22){
          if(!p.dodging&&activeUltRef.current?.type!=="ironwill"){
            const sb=getSkillBonuses();
            const def=(equipped.armor?.stats?.def||0);
            let dmg=Math.max(1,proj.dmg-Math.floor(def*0.3));
            dmg=Math.max(1,Math.floor(dmg*(1-sb.dmgReduce)));
            setHealth(h=>Math.max(0,h-dmg));g._combatTimer=0;g.screenShake=4;
            SoundSystem.play('hurt');
          }
          return false;
        }
        return true;
      });

      // Player knockback (collision-safe) - DELTA TIME BASED
      if(Math.abs(p.kbx)>0.1||Math.abs(p.kby)>0.1){
        // Apply knockback scaled by delta time
        const kbMove = dtMult; // Move knockback distance proportional to time
        // Try X knockback
        const nkx=p.x+p.kbx*kbMove;
        let kxOk=true;
        for(let ty=Math.floor((p.y+12)/TILE);ty<=Math.floor((p.y+38)/TILE);ty++){
          const txL=Math.floor((nkx+10)/TILE),txR=Math.floor((nkx+28)/TILE);
          if(txL<0||txR>=MAP_W||ty<0||ty>=MAP_H){kxOk=false;break;}
          if(SOLID.has(md.map[ty][txL])||SOLID.has(md.map[ty][txR])){kxOk=false;break;}
        }
        if(kxOk)p.x=Math.max(TILE,Math.min(nkx,(MAP_W-2)*TILE));
        else p.kbx=0; // stop X knockback on collision

        // Try Y knockback
        const nky=p.y+p.kby*kbMove;
        let kyOk=true;
        for(let tx=Math.floor((p.x+10)/TILE);tx<=Math.floor((p.x+28)/TILE);tx++){
          const tyT=Math.floor((nky+12)/TILE),tyB=Math.floor((nky+38)/TILE);
          if(tx<0||tx>=MAP_W||tyT<0||tyB>=MAP_H){kyOk=false;break;}
          if(SOLID.has(md.map[tyT][tx])||SOLID.has(md.map[tyB][tx])){kyOk=false;break;}
        }
        if(kyOk)p.y=Math.max(TILE,Math.min(nky,(MAP_H-2)*TILE));
        else p.kby=0; // stop Y knockback on collision

        // Decay knockback (frame-independent: ~72% per frame at 60fps = ~0.28^60 per second)
        const kbDecay=Math.pow(0.72, dtMult);
        p.kbx*=kbDecay;p.kby*=kbDecay;
        if(Math.abs(p.kbx)<0.1)p.kbx=0;if(Math.abs(p.kby)<0.1)p.kby=0;
      }

      // Dodge roll processing - DELTA TIME BASED
      if(p.dodging){
        p.dodgeTimer-=dtMult;
        const dodgeSpd=6*dtMult; // Scale dodge speed by delta time
        const dnx=p.x+p.dodgeDir.x*dodgeSpd,dny=p.y+p.dodgeDir.y*dodgeSpd;
        // Collision check for dodge
        let dCanX=true,dCanY=true;
        for(let ty=Math.floor((p.y+12)/TILE);ty<=Math.floor((p.y+38)/TILE);ty++){
          const txL=Math.floor((dnx+10)/TILE),txR=Math.floor((dnx+28)/TILE);
          if(txL<0||txR>=MAP_W||ty<0||ty>=MAP_H||SOLID.has(md.map[ty][txL])||SOLID.has(md.map[ty][txR]))dCanX=false;
        }
        for(let tx=Math.floor((p.x+10)/TILE);tx<=Math.floor((p.x+28)/TILE);tx++){
          const tyT=Math.floor((dny+12)/TILE),tyB=Math.floor((dny+38)/TILE);
          if(tx<0||tx>=MAP_W||tyT<0||tyB>=MAP_H||SOLID.has(md.map[tyT][tx])||SOLID.has(md.map[tyB][tx]))dCanY=false;
        }
        if(dCanX)p.x=Math.max(TILE,Math.min(dnx,(MAP_W-2)*TILE));
        if(dCanY)p.y=Math.max(TILE,Math.min(dny,(MAP_H-2)*TILE));
        p.frame+=0.25*dtMult;
        if(p.dodgeTimer<=0)p.dodging=false;
      }

      // Mouse-based facing direction (360 degrees)
      const psx=p.x-g.camera.x+20,psy=p.y-g.camera.y+20;
      const mdx=g.mouse.x-psx,mdy=g.mouse.y-psy;
      const mouseAngle=Math.atan2(mdy,mdx);
      // Convert to 4-direction for sprite (0=up,1=right,2=down,3=left)
      if(Math.abs(mdx)>Math.abs(mdy)){
        p.dir=mdx>0?1:3;
      }else{
        p.dir=mdy>0?2:0;
      }
      // Store actual angle for weapon rendering
      p.aimAngle=mouseAngle;

      // Movement - DELTA TIME BASED
      if(!inDlg&&!inMenu&&!p.dodging){
        let dx=0,dy=0;
        if(keys["w"]||keys["arrowup"])dy=-1;
        if(keys["s"]||keys["arrowdown"])dy=1;
        if(keys["a"]||keys["arrowleft"])dx=-1;
        if(keys["d"]||keys["arrowright"])dx=1;
        // Sprint lockout: lock when <5, unlock when >=25
        if(g._stamina<5)g.sprintLocked=true;
        if(g._stamina>=25)g.sprintLocked=false;
        const sprinting=keys["shift"]&&!g.sprintLocked&&g._stamina>5;
        const _sb=getSkillBonuses();
        let spd=PLAYER_SPEED*(1+_sb.speedMult)*(sprinting?SPRINT_MULT:1)*dtMult; // Scale by delta time
        if(activeUltRef.current?.type==="berserker")spd*=1.15;
        // Status effect: freeze slows movement by 50%
        if(statusEffectsRef.current.some(e=>e.type==="freeze"))spd*=0.5;
        if(dx!==0&&dy!==0)spd*=0.707;
        p.moving=dx!==0||dy!==0;
        const stamRegenRate=STAMINA_REGEN_IDLE*(1+_sb.stamRegenMult)*dtMult; // Scale by delta time
        if(p.moving){
          if(sprinting)g._stamina=Math.max(0,g._stamina-SPRINT_COST*dtMult); // Scale cost by delta time
          else g._stamina=Math.min(maxStamina,g._stamina+stamRegenRate);
          const prevFrame=Math.floor(p.frame);
          p.frame+=0.1*(sprinting?1.4:1)*dtMult; // Scale animation by delta time
          const newFrame=Math.floor(p.frame);
          // Play footstep on frame change (every ~10 frames)
          if(newFrame!==prevFrame&&newFrame%2===0)SoundSystem.play('step');
          const nx=p.x+dx*spd,ny=p.y+dy*spd;
          let canX=true,canY=true;
          for(let ty=Math.floor((p.y+12)/TILE);ty<=Math.floor((p.y+38)/TILE);ty++){
            const txL=Math.floor((nx+10)/TILE),txR=Math.floor((nx+28)/TILE);
            if(txL>=0&&txL<MAP_W&&ty>=0&&ty<MAP_H&&SOLID.has(md.map[ty][txL]))canX=false;
            if(txR>=0&&txR<MAP_W&&ty>=0&&ty<MAP_H&&SOLID.has(md.map[ty][txR]))canX=false;
          }
          for(let tx=Math.floor((p.x+10)/TILE);tx<=Math.floor((p.x+28)/TILE);tx++){
            const tyT=Math.floor((ny+12)/TILE),tyB=Math.floor((ny+38)/TILE);
            if(tx>=0&&tx<MAP_W&&tyT>=0&&tyT<MAP_H&&SOLID.has(md.map[tyT][tx]))canY=false;
            if(tx>=0&&tx<MAP_W&&tyB>=0&&tyB<MAP_H&&SOLID.has(md.map[tyB][tx]))canY=false;
          }
          if(canX)p.x=Math.max(TILE,Math.min(nx,(MAP_W-2)*TILE));
          if(canY)p.y=Math.max(TILE,Math.min(ny,(MAP_H-2)*TILE));
        }else{
          g._stamina=Math.min(maxStamina,g._stamina+stamRegenRate);
        }
      }else if(!p.dodging){
        g._stamina=Math.min(maxStamina,g._stamina+STAMINA_REGEN_IDLE*0.7*dtMult); // Scale by delta time
      }
      
      // Sync stamina to React state periodically for UI update (time-based)
      if(!g._lastStaminaSync)g._lastStaminaSync=ts;
      if(ts-g._lastStaminaSync>166){setStamina(g._stamina);g._lastStaminaSync=ts;} // ~6 times/sec

      // Passive HP regen (delayed after combat, blocked by poison) - TIME BASED
      const isPoisoned=statusEffectsRef.current.some(e=>e.type==="poison");
      g._combatTimer+=dtMult;
      // Trigger HP regen check every ~0.5 seconds
      if(!g._lastHpRegen)g._lastHpRegen=ts;
      if(ts-g._lastHpRegen>500&&!isPoisoned&&g._combatTimer>HP_REGEN_COMBAT_DELAY&&healthRef.current<(maxHealth+(getSkillBonuses().maxHpBonus||0))&&!g.dead){
        const regenMult=1+(getSkillBonuses().hpRegenMult||0);
        setHealth(h=>Math.min(maxHealth+(getSkillBonuses().maxHpBonus||0),h+HP_REGEN*regenMult));
        g._lastHpRegen=ts;
      }
      // Sync combat timer to React periodically
      if(!g._lastCombatSync)g._lastCombatSync=ts;
      if(ts-g._lastCombatSync>1000){setCombatTimer(g._combatTimer);g._lastCombatSync=ts;}

      // Ultimate tick - DELTA TIME BASED
      if(activeUltRef.current){
        setActiveUlt(prev=>{
          if(!prev)return null;
          const next={...prev,timer:prev.timer-dtMult}; // Scale by delta time
          if(next.timer<=0){showNotif("Ultimate expired",1500);return null;}
          return next;
        });
      }
      // Ult cooldowns - DELTA TIME BASED
      if(g.ultCds){Object.keys(g.ultCds).forEach(k=>{if(g.ultCds[k]>0)g.ultCds[k]-=dtMult;});}
      // Combo timer decay - DELTA TIME BASED
      if(g.comboTimer>0){g.comboTimer-=dtMult;if(g.comboTimer<=0)g.combo=0;}
      // Screen shake decay
      if(g.screenShake>0)g.screenShake=Math.max(0,g.screenShake-0.5*dtMult);

      // Status effects processing using REF for real-time access
      const currentEffects=statusEffectsRef.current;
      if(currentEffects.length>0){
        // Apply DOT damage based on real time (every ~500ms)
        if(!g._lastDotTime)g._lastDotTime=ts;
        if(ts-g._lastDotTime>=1000){
          g._lastDotTime=ts;
          let dotDamage=0;
          let dotColor='#ffffff';
          let dotType=null;
          currentEffects.forEach(eff=>{
            // Poison: NO damage, just blocks regen. Freeze: slow only, no damage.
            // Venom/Burn/Bleed: Apply tick damage
            if(eff.type!=="poison"&&eff.type!=="freeze"&&eff.tickDmg&&eff.tickDmg>0){
              dotDamage+=eff.tickDmg;
              dotType=eff.type;
              dotColor=eff.type==="venom"?"#80ff40":eff.type==="burn"?"#ff8040":eff.type==="bleed"?"#c03030":"#ffffff";
            }
          });
          if(dotDamage>0){
            setHealth(h=>Math.max(1,h-dotDamage));
            g.floatingTexts.push({x:p.x+20,y:p.y-10,text:dotDamage,color:dotColor,life:25,crit:false});
            if(dotType==="venom")SoundSystem.play('venom');
            else if(dotType==="burn")SoundSystem.play('burn');
          }
        }
        // Decrement durations using DELTA TIME (FPS-independent) - dtMult=1 at 60fps
        const prevLen=currentEffects.length;
        statusEffectsRef.current=currentEffects.map(eff=>({...eff,duration:eff.duration-dtMult})).filter(eff=>eff.duration>0);
        // Sync to React state periodically so UI shows countdown, or when effects change
        if(g.frameCount%20===0||statusEffectsRef.current.length!==prevLen){
          setStatusEffects([...statusEffectsRef.current]);
        }
      }

      // Check hazard tiles
      if(!g.hazardCd)g.hazardCd=0;
      if(g.hazardCd>0)g.hazardCd--;
      const ptx=Math.floor((p.x+20)/TILE),pty=Math.floor((p.y+20)/TILE);
      if(ptx>=0&&ptx<MAP_W&&pty>=0&&pty<MAP_H){
        const tile=md.map[pty][ptx];
        const hazard=HAZARD_TILES[tile];
        if(hazard&&g.hazardCd<=0){
          g.hazardCd=30; // Cooldown between hazard damage
          setHealth(h=>Math.max(1,h-hazard.dmg));
          g.floatingTexts.push({x:p.x+20,y:p.y-10,text:hazard.dmg,color:hazard.type==="fire"?"#ff8040":hazard.type==="poison"?"#60c060":"#ff4040",life:30,crit:false});
          g.screenShake=3;
          g._combatTimer=0;
          if(hazard.effect&&hazard.duration){
            // Poison: no tick damage (just blocks regen), Burn: tick damage
            const tickDmg=hazard.effect==="poison"?0:3;
            applyStatusEffect(hazard.effect,hazard.duration,tickDmg);
          }
          SoundSystem.play(hazard.type==="fire"?"fireball":"hurt");
        }
      }

      // Camera (smooth lerp, but snap directly after zone transitions) - DELTA TIME BASED
      const targetCx=p.x+20-CANVAS_W/2;const targetCy=p.y+20-CANVAS_H/2;
      const clampedTx=Math.max(0,Math.min(targetCx,MAP_W*TILE-CANVAS_W));
      const clampedTy=Math.max(0,Math.min(targetCy,MAP_H*TILE-CANVAS_H));
      if(g._cameraSnapFrames>0){
        // Snap camera directly (no lerp) after zone change
        g.camera.x=clampedTx;g.camera.y=clampedTy;
        g._cameraSnapFrames-=dtMult; // Scale by delta time
      }else{
        // Normal smooth follow - frame-independent lerp
        const camLerp=1-Math.pow(0.88, dtMult); // ~0.12 at 60fps, scales with time
        g.camera.x+=(clampedTx-g.camera.x)*camLerp;
        g.camera.y+=(clampedTy-g.camera.y)*camLerp;
      }

      // Automatic door handling with animation
      const doorRange=4;
      for(let dy=-doorRange;dy<=doorRange;dy++){
        for(let dx=-doorRange;dx<=doorRange;dx++){
          const tx=ptx+dx,ty=pty+dy;
          if(tx<0||tx>=MAP_W||ty<0||ty>=MAP_H)continue;
          const tile=md.map[ty][tx];
          const doorKey=`${tx},${ty}`;
          const distToPlayer=Math.sqrt((tx*TILE+20-p.x-20)**2+(ty*TILE+20-p.y-20)**2);
          if(tile===T.DOOR_CLOSED&&distToPlayer<80&&!g.doors[doorKey]){
            // Start opening animation
            g.doors[doorKey]={progress:0,opening:true,closing:false};
            SoundSystem.play('door');
          }
          if(g.doors[doorKey]){
            const door=g.doors[doorKey];
            if(door.opening){
              door.progress=Math.min(1,door.progress+0.08*dtMult); // DELTA TIME
              if(door.progress>=1){door.opening=false;md.map[ty][tx]=T.DOOR;}
            }else if(door.closing){
              door.progress=Math.max(0,door.progress-0.08*dtMult); // DELTA TIME
              if(door.progress<=0){md.map[ty][tx]=T.DOOR_CLOSED;delete g.doors[doorKey];}
            }else if(tile===T.DOOR&&distToPlayer>90){
              // Start closing animation
              door.closing=true;
              SoundSystem.play('door');
            }
          }
        }
      }

      // Proximity checks
      // === ENEMY AI (all combat zones) ===
      if(!isTown){
        // Build spatial grid for collision optimization
        clearSpatialGrid();
        g.enemies.forEach(e => { if(!e.dead) addToSpatialGrid(e); });
        
        // Ruin-specific NPC checks
        if(zone==="ruin"){
          const npcPx=29*TILE,npcPy=10*TILE;
          const nd=Math.sqrt((npcPx+20-p.x-20)**2+(npcPy+20-p.y-20)**2);
          const isNear=nd<80;setNearNpc(isNear);
          if(isNear&&!g.npcMet){g.npcMet=true;if(!g.npcDead){setDialogue("knight");dialogueRef.current="knight";setDialogueLine(0);}}
          const relicDist=Math.sqrt((30*TILE+20-p.x-20)**2+(8*TILE+20-p.y-20)**2);
          setNearRelic(relicDist<60&&!g.relicPickedUp&&g.npcDead);
        }else{setNearNpc(false);setNearRelic(false);}

        // Check for bonfire proximity (all zones)
        let foundBonfire=false;
        const ptxB=Math.floor((p.x+20)/TILE),ptyB=Math.floor((p.y+20)/TILE);
        for(let dy=-2;dy<=2&&!foundBonfire;dy++){
          for(let dx=-2;dx<=2&&!foundBonfire;dx++){
            const tx=ptxB+dx,ty=ptyB+dy;
            if(tx>=0&&tx<MAP_W&&ty>=0&&ty<MAP_H&&md.map[ty][tx]===T.BONFIRE){
              const bfDist=Math.sqrt((tx*TILE+20-p.x-20)**2+(ty*TILE+20-p.y-20)**2);
              if(bfDist<70)foundBonfire=true;
            }
          }
        }
        setNearBonfire(foundBonfire);

        if(g.dmgCooldown>0)g.dmgCooldown-=dtMult; // DELTA TIME
        g.enemies.forEach((e,idx)=>{
          if(e.dead)return;
          // Performance: Skip detailed AI for far enemies based on GFX preset
          const distToPlayer=Math.abs(e.x-p.x)+Math.abs(e.y-p.y);
          const distToCamera=Math.abs(e.x-g.camera.x-CANVAS_W/2)+Math.abs(e.y-g.camera.y-CANVAS_H/2);
          // Skip enemies beyond preset distance
          if(distToPlayer>GFX.maxEnemyAIDistance&&distToCamera>GFX.maxEnemyAIDistance*0.8&&!e.aggroTimer){e.atkCd=Math.max(e.atkCd,10);return;}
          // Skip frames for enemies based on preset
          if(GFX.enemyAISkipFrames>1&&(idx+g.frameCount)%GFX.enemyAISkipFrames!==0&&distToPlayer>150){e.atkCd=Math.max(e.atkCd,5);return;}
          // Enemy timers - DELTA TIME BASED
          if(e.hitCd>0)e.hitCd-=dtMult;if(e.atkCd>0)e.atkCd-=dtMult;if(e.specialCd>0)e.specialCd-=dtMult;
          if(e.lungeTimer>0){e.lungeTimer-=dtMult;if(e.lungeTimer<=0)e.lunging=false;}
          if(e.slamTimer>0){e.slamTimer-=dtMult;if(e.slamTimer<=0)e.slamming=false;}
          // Apply knockback with friction (collision-safe) - DELTA TIME BASED
          if(Math.abs(e.kbx)>0.2||Math.abs(e.kby)>0.2){
            const kbMove=dtMult; // Scale knockback movement
            const enx=e.x+e.kbx*kbMove,eny=e.y+e.kby*kbMove;
            let exOk=true;
            const etxL=Math.floor((enx+8)/TILE),etxR=Math.floor((enx+32)/TILE);
            for(let ety=Math.floor((e.y+8)/TILE);ety<=Math.floor((e.y+38)/TILE);ety++){
              if(etxL<0||etxR>=MAP_W||ety<0||ety>=MAP_H||SOLID.has(md.map[ety][etxL])||SOLID.has(md.map[ety][etxR])){exOk=false;break;}
            }
            if(exOk)e.x=enx; else e.kbx=0;
            let eyOk=true;
            const etyT=Math.floor((eny+8)/TILE),etyB=Math.floor((eny+38)/TILE);
            for(let etx=Math.floor((e.x+8)/TILE);etx<=Math.floor((e.x+32)/TILE);etx++){
              if(etx<0||etx>=MAP_W||etyT<0||etyB>=MAP_H||SOLID.has(md.map[etyT][etx])||SOLID.has(md.map[etyB][etx])){eyOk=false;break;}
            }
            if(eyOk)e.y=eny; else e.kby=0;
            // Decay knockback (frame-independent)
            const ekbDecay=Math.pow(0.7, dtMult);
            e.kbx*=ekbDecay;e.kby*=ekbDecay;
            if(Math.abs(e.kbx)<0.2)e.kbx=0;if(Math.abs(e.kby)<0.2)e.kby=0;
            return;
          }
          // Enemy status effect processing
          if(e.statusEffects&&e.statusEffects.length>0){
            e.statusEffects=e.statusEffects.filter(eff=>{
              eff.duration-=dtMult; // Use delta time for FPS-independent timing
              // Apply DOT damage based on real time (using _lastDotTime)
              if(eff.type!=="poison"&&eff.type!=="freeze"&&eff.tickDmg&&ts-g._lastDotTime<50){
                e.hp-=eff.tickDmg;
                const col=eff.type==="bleed"?"#c03030":eff.type==="burn"?"#ff8040":eff.type==="venom"?"#80ff40":"#ffffff";
                g.floatingTexts.push({x:e.x+20+(Math.random()*8-4),y:e.y-5,text:eff.tickDmg,color:col,life:20,crit:false});
                if(e.hp<=0&&!e.dead){
                  e.dead=true;SoundSystem.play('kill');
                  const info=ENEMY_INFO[e.type]||{name:"Enemy",xp:10};
                  g.combo++;g.comboTimer=180;
                  const comboMult=Math.min(2,1+g.combo*0.1);
                  const bonusXp=Math.floor((info.xp||10)*comboMult);
                  showKillNotif(info.name,bonusXp);
                  setXp(x=>x+bonusXp);setKillCount(c=>c+1);
                  g.floatingTexts.push({x:e.x+20,y:e.y-10,text:"+"+bonusXp+" XP",color:"#60ff60",life:50,crit:false});
                }
              }
              // Poison blocks enemy healing (enemies don't really heal, so mostly visual/thematic)
              // Freeze slows enemy (handled in movement)
              return eff.duration>0;
            });
          }
          // Freeze effect slows enemy movement
          const freezeMult=e.statusEffects?.find(s=>s.type==="freeze")?0.4:1;
          const dx=(p.x+20)-(e.x+20),dy=(p.y+20)-(e.y+20);
          const distSq=dx*dx+dy*dy; // Use squared distance to avoid sqrt where possible
          let _dist=0; const getDist=()=>_dist||(_dist=Math.sqrt(distSq)); // Lazy sqrt
          const leashDistSq=(e.aggroRange*4)**2;
          const homeDx=e.x-e.homeX,homeDy=e.y-e.homeY;
          const homeDSq=homeDx*homeDx+homeDy*homeDy;
          
          // Special attack windup (time-based in milliseconds)
          if(e.specialWindupStart>0){
            const windupElapsed=ts-e.specialWindupStart;
            e.frame+=0.02; // slow animation during windup
            // Dynamically track player position for indicator
            e.targetX=p.x+20;e.targetY=p.y+20;
            if(windupElapsed>=e.specialWindupDur){
              e.specialWindupStart=0;
              const dist=getDist();
              // Execute special attack
              if(e.specialType==="lunge"){
                // Lunge toward player - start lunge animation
                const lx=dx/dist*28,ly=dy/dist*28;
                e.kbx=lx;e.kby=ly;
                e.lunging=true;e.lungeTimer=12;e.lungeDirX=dx/dist;e.lungeDirY=dy/dist;
                SoundSystem.play('woosh');
                if(distSq<25600){ // 160^2
                  if(!p.dodging&&activeUltRef.current?.type!=="ironwill"){
                    const info=ENEMY_INFO[e.type];
                    const def=(equipped.armor?.stats?.def||0);
                    let dmg=Math.max(1,Math.floor(info.dmg*1.5)-Math.floor(def*0.3));
                    setHealth(h=>Math.max(0,h-dmg));g.screenShake=8;g._combatTimer=0;
                    SoundSystem.play('hurt');
                  }
                }
              }else if(e.specialType==="ranged"){
                // Fire projectile at player
                const angle=Math.atan2(dy,dx);
                g.enemyProjectiles.push({x:e.x+20,y:e.y+20,vx:Math.cos(angle)*4,vy:Math.sin(angle)*4,dmg:ENEMY_INFO[e.type]?.dmg||8,life:240,type:"enemy"});
                SoundSystem.play('fireball');
              }else if(e.specialType==="slam"){
                // AoE slam with ground pound animation
                e.slamming=true;e.slamTimer=15;
                SoundSystem.play('slam');
                if(distSq<32400){ // 180^2
                  if(!p.dodging&&activeUltRef.current?.type!=="ironwill"){
                    const info=ENEMY_INFO[e.type];
                    let dmg=Math.max(1,Math.floor(info.dmg*2));
                    setHealth(h=>Math.max(0,h-dmg));g.screenShake=12;g._combatTimer=0;
                    SoundSystem.play('hurt');
                    p.kbx=(dx/dist)*15;p.kby=(dy/dist)*15;
                  }
                }
              }
              e.specialType=null;e.atkCd=90;
            }
            return; // don't move during windup
          }

          // Aggro management: extended chase (use squared distance) - DELTA TIME BASED
          const aggroRangeSq=e.aggroRange*e.aggroRange;
          if(distSq<aggroRangeSq){
            e.aggroTimer=360; // ~6 seconds of chase after losing sight (at 60fps)
          }else if(e.aggroTimer>0){
            e.aggroTimer-=dtMult; // Scale by delta time
          }

          if((distSq<aggroRangeSq||e.aggroTimer>0)&&homeDSq<leashDistSq){
            // Chase player - DELTA TIME BASED
            e.returning=false;
            const dist=getDist(); // Need actual dist for direction normalization
            const chaseSpeed=(e.aggroTimer>0&&distSq>aggroRangeSq?e.speed*0.7:e.speed)*freezeMult*dtMult;
            const nx=dx/dist*chaseSpeed,ny=dy/dist*chaseSpeed;e.x+=nx;e.y+=ny;
            e.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0);e.frame+=0.08*dtMult;
            
            // Special attack check (260^2 = 67600)
            const canSpecial=e.specialCd<=0&&distSq<67600;
            if(canSpecial&&Math.random()<0.01){
              // Start special attack windup - store target position and start time
              e.targetX=p.x+20;e.targetY=p.y+20;
              e.specialWindupStart=ts;
              if(e.type==="hollow_knight"||e.type==="bandit_chief"){
                e.specialType="lunge";e.specialWindupDur=900;e.specialCd=360;
              }else if(e.type==="forest_bandit"){
                e.specialType="ranged";e.specialWindupDur=750;e.specialCd=300;
              }else if(e.type==="cave_lurker"){
                e.specialType=Math.random()<0.5?"lunge":"slam";e.specialWindupDur=1000;e.specialCd=400;
              }else if(e.type==="hollow"||e.type==="timber_wolf"){
                e.specialType="lunge";e.specialWindupDur=800;e.specialCd=340;
              }
            }
            
            // Boss-specific AI enhancements
            const info=ENEMY_INFO[e.type];
            if(info?.isBoss){
              // Enrage at low HP (below 30%)
              const enraged=e.hp<e.maxHp*0.3;
              if(enraged&&!e.wasEnraged){
                e.wasEnraged=true;
                SoundSystem.play('boss_roar');
                showNotif(`${info.name} is ENRAGED!`,2500);
                g.screenShake=8;
              }
              e.enraged=enraged;
              
              // Boss special attacks (more frequent when enraged) (300^2=90000)
              const bossSpecialChance=enraged?0.025:0.015;
              if(e.specialCd<=0&&distSq<90000&&Math.random()<bossSpecialChance&&!e.specialWindupStart){
                e.targetX=p.x+20;e.targetY=p.y+20;
                e.specialWindupStart=ts;
                
                if(e.type==="hollow_lord"){
                  // Hollow Lord: slam, dark wave, or summon
                  const roll=Math.random();
                  if(roll<0.4){e.specialType="slam";e.specialWindupDur=1200;e.specialCd=enraged?200:300;}
                  else if(roll<0.7){e.specialType="darkwave";e.specialWindupDur=1000;e.specialCd=enraged?250:400;}
                  else{e.specialType="lunge";e.specialWindupDur=800;e.specialCd=enraged?180:280;}
                }else if(e.type==="alpha_wolf"){
                  // Alpha Wolf: lunge, howl (buff self), or pounce
                  const roll=Math.random();
                  if(roll<0.5){e.specialType="lunge";e.specialWindupDur=600;e.specialCd=enraged?150:240;}
                  else if(roll<0.8){e.specialType="pounce";e.specialWindupDur=900;e.specialCd=enraged?200:320;}
                  else{e.specialType="howl";e.specialWindupDur=1200;e.specialCd=enraged?350:500;}
                }else if(e.type==="spider_queen"){
                  // Spider Queen: web shot, poison spit, or spawn
                  const roll=Math.random();
                  if(roll<0.35){e.specialType="ranged";e.specialWindupDur=700;e.specialCd=enraged?180:280;}
                  else if(roll<0.65){e.specialType="slam";e.specialWindupDur=1100;e.specialCd=enraged?220:350;}
                  else{e.specialType="spawn";e.specialWindupDur=1500;e.specialCd=enraged?400:600;}
                }
              }
              
              // Boss special attack execution (extend windup execution)
              if(e.specialType==="darkwave"&&e.specialWindupStart===0){
                // Dark wave fires multiple projectiles
                for(let i=-2;i<=2;i++){
                  const angle=Math.atan2(dy,dx)+i*0.3;
                  g.enemyProjectiles.push({x:e.x+20,y:e.y+20,vx:Math.cos(angle)*5,vy:Math.sin(angle)*5,dmg:18,life:180,type:"dark"});
                }
              }else if(e.specialType==="howl"&&e.specialWindupStart===0){
                // Howl buffs speed temporarily
                e.speedBuff=180;SoundSystem.play('boss_roar');g.screenShake=4;
              }else if(e.specialType==="pounce"&&e.specialWindupStart===0){
                // Long-range pounce
                e.kbx=(dx/dist)*35;e.kby=(dy/dist)*35;e.lunging=true;e.lungeTimer=18;
                if(dist<200&&!p.dodging&&activeUltRef.current?.type!=="ironwill"){
                  const dmg=Math.max(1,Math.floor(info.dmg*1.8));
                  setHealth(h=>Math.max(0,h-dmg));g.screenShake=10;g._combatTimer=0;
                }
              }else if(e.specialType==="spawn"&&e.specialWindupStart===0){
                // Spider Queen spawns minions
                for(let i=0;i<2;i++){
                  const spawnAngle=Math.random()*Math.PI*2;
                  const spawnDist=60+Math.random()*40;
                  g.enemies.push(makeEnemy(g.enemies.length,
                    Math.floor((e.x+Math.cos(spawnAngle)*spawnDist)/TILE),
                    Math.floor((e.y+Math.sin(spawnAngle)*spawnDist)/TILE),
                    "cave_spider",{r:40}
                  ));
                }
                showNotif("The Queen calls her brood!",2000);
              }
              
              // Apply speed buff - DELTA TIME BASED
              if(e.speedBuff>0){e.speedBuff-=dtMult;e.speed=e.baseSpeed*1.5;}
              else{e.speed=e.baseSpeed||(enraged?e.speed*1.2:e.speed);}
            }
            
            // Ranged enemy AI (skeleton_archer, etc.)
            if(e.isRanged&&dist<e.atkRange&&dist>80){
              // Wind-up system for ranged attacks - DELTA TIME BASED
              if(!e.rangedWindup&&e.rangedCd<=0){
                e.rangedWindup=45; // Start wind-up (0.75 seconds at 60fps)
                e.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0); // Face player
              }
              if(e.rangedWindup>0){
                e.rangedWindup-=dtMult;
                // Fire at end of wind-up
                if(e.rangedWindup<=0){
                  e.rangedCd=120; // Cooldown between shots (2 seconds at 60fps)
                  const angle=Math.atan2(dy,dx);
                  const projSpeed=4.5;
                  g.enemyProjectiles.push({
                    x:e.x+20,y:e.y+15,
                    vx:Math.cos(angle)*projSpeed,vy:Math.sin(angle)*projSpeed,
                    dmg:ENEMY_INFO[e.type]?.dmg||10,life:180,type:"arrow"
                  });
                  SoundSystem.play('shoot');
                  e.frame+=0.5; // Animation bump
                }
              }
            }else{
              e.rangedWindup=0; // Cancel wind-up if player moves out of range
            }
            if(e.rangedCd>0)e.rangedCd-=dtMult; // DELTA TIME
            // Ranged enemies try to maintain distance (100^2=10000) - DELTA TIME BASED
            if(e.isRanged&&distSq<10000){
              const dist=getDist();
              // Back away from player
              const backX=-dx/dist*e.speed*0.8*dtMult,backY=-dy/dist*e.speed*0.8*dtMult;
              e.x+=backX;e.y+=backY;
              e.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?3:1):(dy>0?0:2); // Face player while retreating
            }
            
            // Teleporting enemy AI (shadow_wraith) (180^2=32400, 50^2=2500)
            if(e.canTeleport&&e.teleportCd<=0&&distSq<32400&&distSq>2500){
              if(Math.random()<0.02*dtMult){ // Scale chance by delta time
                e.teleportCd=240; // 4 second cooldown
                // Teleport behind player
                const behindDist=50;
                const playerAngle=Math.atan2(p.kby||0.001,p.kbx||0.001)||Math.atan2(dy,dx);
                const targetX=p.x-Math.cos(playerAngle)*behindDist;
                const targetY=p.y-Math.sin(playerAngle)*behindDist;
                // Check if target position is valid
                const ttx=Math.floor(targetX/TILE),tty=Math.floor(targetY/TILE);
                if(ttx>=0&&ttx<MAP_W&&tty>=0&&tty<MAP_H&&!SOLID.has(md.map[tty][ttx])){
                  // Teleport effect at old position
                  g.floatingTexts.push({x:e.x+20,y:e.y+10,text:"~",color:"#8040c0",life:20,crit:false});
                  e.x=targetX;e.y=targetY;
                  // Teleport effect at new position
                  g.floatingTexts.push({x:e.x+20,y:e.y+10,text:"~",color:"#c060ff",life:20,crit:false});
                  SoundSystem.play('woosh');
                  e.atkCd=20; // Quick attack after teleport
                }
              }
            }
            if(e.teleportCd>0)e.teleportCd-=dtMult; // DELTA TIME
            
            // Normal attack (use squared attack range)
            const atkRangeSq=e.atkRange*e.atkRange;
            if(distSq<atkRangeSq&&e.atkCd<=0&&g.dmgCooldown<=0&&!e.specialWindupStart&&!e.isRanged){
              e.atkCd=60;g.dmgCooldown=30;
              const sb=getSkillBonuses();
              if(activeUltRef.current?.type==="ironwill")return;
              if(p.dodging)return;
              if(sb.dodgeChance>0&&Math.random()<sb.dodgeChance){showNotif("Dodged!",800);SoundSystem.play('dodge');return;}
              const info=ENEMY_INFO[e.type];
              const def=(equipped.armor?.stats?.def||0)+(equipped.relic?.stats?.def||0);
              let dmg=Math.max(1,(info.dmg||8)-Math.floor(def*0.3));
              dmg=Math.max(1,Math.floor(dmg*(1-sb.dmgReduce)));
              setHealth(h=>Math.max(0,h-dmg));g._combatTimer=0;g.screenShake=5;
              SoundSystem.play('hurt');
              const kbAmt=PLAYER_KB*(1-sb.kbResist);
              const dist=getDist();
              if(distSq>0){p.kbx=(dx/dist)*kbAmt;p.kby=(dy/dist)*kbAmt;}
              // Apply status effects from enemies with appliesEffect
              if(e.appliesEffect){
                // Venom: short DOT (4s), Poison: long regen block (60s), Freeze: slow (2s), Burn: DOT (3s)
                const effDur=e.appliesEffect==="venom"?240:e.appliesEffect==="poison"?3600:e.appliesEffect==="freeze"?120:180;
                const effDmg=e.appliesEffect==="venom"?4:e.appliesEffect==="burn"?3:0; // Poison has NO damage
                applyStatusEffect(e.appliesEffect,effDur,effDmg);
              }
              // Legacy status effect checks - convert to new system
              if(e.type==="slime"||e.poisonous){applyStatusEffect("venom",240,2);} // Old slimes now apply venom
              if(e.type==="cave_spider"&&Math.random()<0.3){applyStatusEffect("venom",240,2);}
            }
          }else if(homeDSq>900){ // 30^2=900
            // Walk back toward home slowly - DELTA TIME BASED
            e.returning=true;e.aggroTimer=0;
            const hx=e.homeX-e.x,hy=e.homeY-e.y;
            const hd=Math.sqrt(hx*hx+hy*hy);
            e.x+=hx/hd*e.speed*0.4*dtMult;e.y+=hy/hd*e.speed*0.4*dtMult;
            e.dir=Math.abs(hx)>Math.abs(hy)?(hx>0?1:3):(hy>0?2:0);e.frame+=0.03*dtMult;
            if(e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+0.05*dtMult); // Scale regen
          }else{
            // Patrol movement - DELTA TIME BASED
            e.returning=false;e.aggroTimer=0;
            e.patrol.a+=0.008*dtMult;
            const px2=e.homeX+Math.cos(e.patrol.a)*e.patrol.r;
            const py2=e.homeY+Math.sin(e.patrol.a)*e.patrol.r;
            const patrolLerp=1-Math.pow(0.95, dtMult); // Frame-independent lerp
            e.x+=(px2-e.x)*patrolLerp;e.y+=(py2-e.y)*patrolLerp;
            e.frame+=0.04*dtMult;
          }
        });

        // Zone-specific quest triggers
        const qp=g.questProgress;const ptx=Math.floor(p.x/TILE),pty=Math.floor(p.y/TILE);
        if(isForest){
          // Moss stone shrine (northeast)
          if(ptx>=48&&ptx<=59&&pty>=10&&pty<=19&&quests.old_ways?.status==="active"&&!qp.old_shrineFound){
            qp.old_shrineFound=true;showNotif("An ancient shrine... the stones hum with power.",3500);
          }
        }
        if(isCave){
          // Crystal chamber (east)
          if(ptx>=36&&ptx<=47&&pty>=18&&pty<=29&&quests.trade_routes?.status==="active"&&!qp.trade_crystalFound){
            qp.trade_crystalFound=true;showNotif("Glowing crystals! Cedric will pay well for these.",3500);
          }
          // Spider nest / north shrine
          if(ptx>=16&&ptx<=31&&pty>=2&&pty<=9&&quests.sacred_relics?.status==="active"&&!qp.sacred_shrineFound){
            qp.sacred_shrineFound=true;showNotif("The ancient shrine resonates with holy energy.",3500);
          }
        }
        if(isGraveyard){
          // Mausoleum (center-east)
          if(ptx>=30&&ptx<=42&&pty>=18&&pty<=28&&quests.grave_robbers?.status==="active"&&!qp.mausoleumFound){
            qp.mausoleumFound=true;showNotif("Dark symbols mark the stones... cultist activity confirmed.",3500);
          }
          // Angel statues near crypt entrance
          if(ptx>=22&&ptx<=28&&pty>=28&&pty<=36&&quests.crypt_key?.status==="active"&&!qp.cryptKeyFound){
            qp.cryptKeyFound=true;showNotif("The Crypt Key gleams in the angel's grip. You take it.",3500);
          }
        }
        if(isDesert){
          // Oasis area
          if(ptx>=20&&ptx<=32&&pty>=26&&pty<=34&&quests.oasis_guardian?.status==="active"&&!qp.oasisFound){
            qp.oasisFound=true;showNotif("The oasis... something stirs beneath the waters.",3500);
          }
          // Ruined caravan (eastern dunes)
          if(ptx>=42&&ptx<=52&&pty>=20&&pty<=28&&quests.lost_caravan?.status==="active"&&!qp.caravanFound){
            qp.caravanFound=true;showNotif("The lost caravan... Cedric's trade ledger lies among the bones.",3500);
          }
          // Ancient ruins (two locations)
          if(((ptx>=8&&ptx<=18&&pty>=8&&pty<=18)||(ptx>=40&&ptx<=52&&pty>=38&&pty<=48))&&quests.desert_ruins?.status==="active"){
            if(ptx<=25&&!qp._ruinsNorth){qp._ruinsNorth=true;qp.desertRuinsExplored++;showNotif("Ancient carvings depict a fallen civilization...",3500);}
            if(ptx>=35&&!qp._ruinsSouth){qp._ruinsSouth=true;qp.desertRuinsExplored++;showNotif("More ruins... Elder Miriam will want to hear of this.",3500);}
          }
        }


        // Zone transitions and exit prompts - EXPLICIT per zone
        let exitInfo=null;
        if(g.zoneTransitCd<=0){
          if(zone==="forest"){
            // FOREST: South -> Town, East -> Cave
            if(pty>=MAP_H-6){exitInfo={label:"Ashenmoor",dir:"south"};if(pty>=MAP_H-4)changeZone("town",40,6);}
            if(ptx>=MAP_W-6&&pty>=20&&pty<=28){exitInfo={label:"Hollow Caves",dir:"east"};if(ptx>=MAP_W-4)changeZone("cave",4,24);}
            // North: Ruins are PERMANENTLY inaccessible - intro is a one-way sequence
            if(pty<=5){exitInfo={label:"(Dense undergrowth blocks the path)",dir:"north"};}
          }else if(zone==="cave"){
            // CAVE: West -> Forest
            if(ptx<=3){exitInfo={label:"Darkwood Forest",dir:"west"};if(ptx<=1)changeZone("forest",65,24);}
          }else if(zone==="crypt"){
            // CRYPT: North -> Graveyard
            if(pty<=4&&ptx>=20&&ptx<=24){exitInfo={label:"Graveyard",dir:"up"};if(pty<=2)changeZone("graveyard",25,35);}
            if(pty>=30&&!g.questProgress.catacombs_explored&&quests.catacombs?.status==="active"){
              g.questProgress.catacombs_explored=true;
              showNotif("You have explored the depths of the catacombs.",4000);
            }
          }else if(zone==="ruin"){
            // RUIN: LOCKED during prologue - no exits until flashback triggers
            // After picking up relic, the flashback auto-teleports to town
            if(pty>=MAP_H-6){exitInfo={label:"(Collapsed rubble blocks the path)",dir:"south"};}
            if(pty<=5){exitInfo={label:"(The northern ruins are impassable)",dir:"north"};}
            // NO changeZone - player is trapped until flashback sequence
          }else if(zone==="graveyard"){
            // GRAVEYARD: West -> Town, has crypt entrance
            if(ptx<=3){exitInfo={label:"Ashenmoor",dir:"west"};if(ptx<=1)changeZone("town",68,35);}
            if(ptx>=23&&ptx<=27&&pty>=30&&pty<=34){exitInfo={label:"The Catacombs [E]",dir:"down"};}
          }else if(zone==="desert"){
            // DESERT: North -> Town, South -> Volcanic
            if(pty<=5){exitInfo={label:"Ashenmoor",dir:"north"};if(pty<=3)changeZone("town",40,68);}
            if(pty>=45){exitInfo={label:"Volcanic Depths",dir:"south"};if(pty>=48)changeZone("volcanic",30,4);}
          }else if(zone==="ice"){
            // ICE: East -> Town
            if(ptx>=56){exitInfo={label:"Ashenmoor",dir:"east"};if(ptx>=58)changeZone("town",5,38);}
          }else if(zone==="volcanic"){
            // VOLCANIC: North -> Desert
            if(pty<=5){exitInfo={label:"Scorched Desert",dir:"north"};if(pty<=3)changeZone("desert",30,45);}
          }
        }
        setZoneExitInfo(exitInfo);
      }else{
        // === TOWN ZONE ===
        setNearNpc(false);setNearRelic(false);
        let closest=null,closestDist=80;
        townNPCs.current.forEach(npc=>{
          const dx=(npc.x+20)-(p.x+20),dy=(npc.y+20)-(p.y+20);
          const d=Math.sqrt(dx*dx+dy*dy);
          if(d<closestDist){closestDist=d;closest=npc;}
        });
        setNearTownNpc(closest);

        // Town transitions - different during flashback vs normal gameplay
        const ptx=Math.floor(p.x/TILE),pty=Math.floor(p.y/TILE);
        let exitInfo=null;
        if(g.zoneTransitCd<=0){
          if(g.inFlashback){
            // FLASHBACK: South exit ends flashback, player "awakens" in town present day
            if(pty>=68){
              exitInfo={label:"Awaken...",dir:"south"};
              if(pty>=70){
                g.inFlashback=false;
                g.flashbackComplete=true;
                // White flash transition - stay in town but "present day"
                setTransAlpha(1);
                setTimeout(()=>{
                  g.player.x=40*TILE;g.player.y=40*TILE;
                  g.camera.x=g.player.x-CANVAS_W/2;g.camera.y=g.player.y-CANVAS_H/2;
                },200);
                setTimeout(()=>setTransAlpha(0),500);
                setTimeout(()=>showNotif("Present day... Ashenmoor",4000),600);
                setTimeout(()=>showNotif("The ruins haunt your memories",4000),5000);
              }
            }
          }else{
            // NORMAL GAMEPLAY: Town exits (ruins inaccessible)
            // North exit to Darkwood Forest - bounded corridor x=28-48
            if(pty<=10 && ptx>=28 && ptx<=48){exitInfo={label:"Darkwood Forest",dir:"north"};if(pty<=5)changeZone("forest",34,58);}
            // West exit to Ice Biome - bounded corridor
            if(ptx<=6 && pty>=30 && pty<=45){exitInfo={label:"Frozen Wastes",dir:"west"};if(ptx<=3)changeZone("ice",55,35);}
            if(ptx>=66){exitInfo={label:"Old Graveyard",dir:"east"};if(ptx>=68)changeZone("graveyard",4,21);}
            if(pty>=66){exitInfo={label:"Scorched Desert",dir:"south"};if(pty>=68)changeZone("desert",30,6);}
          }
        }
        setZoneExitInfo(exitInfo);
      }


      // === RENDER ===
      // Use GFX preset for quality settings
      const simplifiedTiles=GFX.tileDetail===0;
      const shakeX=g.screenShake>0?(Math.random()-0.5)*g.screenShake*2:0;
      const shakeY=g.screenShake>0?(Math.random()-0.5)*g.screenShake*2:0;
      // Floored camera for pixel-perfect rendering (prevents sub-pixel jitter)
      const camX=Math.floor(g.camera.x),camY=Math.floor(g.camera.y);
      ctx.save();
      ctx.translate(shakeX,shakeY);
      const bgColor=isTown?"#1a3a18":isForest?"#0a1a08":isCave?"#060610":isGraveyard?"#0a0a10":isDesert?"#c4a060":isIce?"#d0e0f0":isVolcanic?"#1a1010":"#06060a";
      ctx.fillStyle=bgColor;ctx.fillRect(-10,-10,CANVAS_W+20,CANVAS_H+20);
      const stx=Math.floor(camX/TILE),sty=Math.floor(camY/TILE);
      const ox=-(camX%TILE),oy=-(camY%TILE);
      
      // Tile rendering with GFX-based detail level
      for(let ty=0;ty<=VIEW_H+1;ty++){
        for(let tx=0;tx<=VIEW_W+1;tx++){
          const mx=stx+tx,my=sty+ty;
          if(mx>=0&&mx<MAP_W&&my>=0&&my<MAP_H){
            drawTile(ctx,md.map[my][mx],ox+tx*TILE,oy+ty*TILE,ts,isTown,simplifiedTiles,GFX.animatedTiles,mx,my);
          }
        }
      }

      // Render animated doors
      Object.entries(g.doors).forEach(([key,door])=>{
        const [tx,ty]=key.split(',').map(Number);
        const dpx=tx*TILE-camX,dpy=ty*TILE-camY;
        if(dpx<-TILE||dpx>CANVAS_W+TILE||dpy<-TILE||dpy>CANVAS_H+TILE)return;
        const prog=door.progress;
        // Background
        ctx.fillStyle=isTown?"#5a4830":"#1c1812";ctx.fillRect(dpx,dpy,TILE,TILE);
        // Door frame
        ctx.fillStyle="#4a2a10";ctx.fillRect(dpx+4,dpy+2,4,36);ctx.fillRect(dpx+32,dpy+2,4,36);ctx.fillRect(dpx+4,dpy,32,4);
        // Animated door panel - swings open
        const doorWidth=24*(1-prog*0.7);
        const doorX=dpx+8+prog*16;
        ctx.fillStyle="#5a3a1a";ctx.fillRect(doorX,dpy+4,doorWidth,32);
        ctx.fillStyle="#7a5a30";ctx.fillRect(doorX+2,dpy+6,Math.max(0,doorWidth-4),28);
        // Handle
        if(prog<0.5){
          ctx.fillStyle="#c4a43e";
          ctx.beginPath();ctx.arc(doorX+doorWidth-4,dpy+20,2,0,Math.PI*2);ctx.fill();
        }
        // Shadow for depth
        if(prog>0){
          ctx.fillStyle=`rgba(0,0,0,${prog*0.3})`;
          ctx.fillRect(dpx+8,dpy+4,prog*12,32);
        }
      });

      if(!isTown){
        // Ruin-specific entities
        if(zone==="ruin"){
          const nsx=29*TILE-camX,nsy=10*TILE-camY;
          if(nsx>-80&&nsx<CANVAS_W+80&&nsy>-80&&nsy<CANVAS_H+80){
            drawDyingMan(ctx,nsx,nsy,ts,g.npcDead);
            if(nearNpc&&!dialogue&&!g.npcDead){
              ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(nsx-10,nsy-16,60,14);
              ctx.font="bold 9px monospace";ctx.fillStyle="#90caf9";ctx.textAlign="center";
              ctx.fillText("[E] Speak",nsx+20,nsy-5);ctx.textAlign="left";
            }
          }
          if(nearRelic){
            const rx=30*TILE-camX,ry=8*TILE-camY;
            ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(rx-15,ry-16,70,14);
            ctx.font="bold 9px monospace";ctx.fillStyle="#c4a43e";ctx.textAlign="center";
            ctx.fillText("[E] Take Relic",rx+20,ry-5);ctx.textAlign="left";
          }
        }
        // All enemies (works for ruin, forest, cave)
        g.enemies.forEach(e=>drawEnemy(ctx,e,camX,camY,ts));
        // Render projectiles
        g.projectiles.forEach(proj=>{
          const prx=proj.x-camX,pry=proj.y-camY;
          const angle=Math.atan2(proj.vy,proj.vx);
          ctx.save();
          ctx.translate(prx,pry);
          ctx.rotate(angle);
          // Arrow shaft
          ctx.fillStyle="#6a5040";ctx.fillRect(-8,-1,16,2);
          // Arrow head
          ctx.fillStyle="#a0a8b8";ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(5,-3);ctx.lineTo(5,3);ctx.closePath();ctx.fill();
          // Arrow fletching
          ctx.fillStyle="#8a6a50";ctx.fillRect(-10,-2,4,1);ctx.fillRect(-10,1,4,1);
          // Trail effect
          ctx.strokeStyle="rgba(160,140,120,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-20,0);ctx.stroke();
          ctx.restore();
        });
        // Render enemy projectiles
        g.enemyProjectiles.forEach(proj=>{
          const prx=proj.x-camX,pry=proj.y-camY;
          ctx.save();
          const angle=Math.atan2(proj.vy,proj.vx);
          ctx.translate(prx,pry);
          ctx.rotate(angle);
          if(proj.type==="arrow"){
            // Enemy arrow - darker than player's
            ctx.fillStyle="#5a4030";ctx.fillRect(-8,-1.5,16,3);
            ctx.fillStyle="#808890";ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(3,-3);ctx.lineTo(3,3);ctx.closePath();ctx.fill();
            ctx.fillStyle="#4a3020";ctx.fillRect(-10,-2,4,1);ctx.fillRect(-10,1,4,1);
            ctx.strokeStyle="rgba(80,60,40,0.4)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-16,0);ctx.stroke();
          }else if(proj.type==="dark"){
            // Dark magic projectile - purple swirling energy
            const pulse=Math.sin(ts*0.02)*0.2+0.8;
            ctx.fillStyle=`rgba(100,40,160,${pulse})`;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();
            ctx.fillStyle="#c060ff";ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
            // Swirling particles
            for(let i=0;i<3;i++){
              const pa=(ts*0.01+i*2.1)%(Math.PI*2);
              const pr=6+Math.sin(ts*0.02+i)*2;
              ctx.fillStyle=`rgba(160,80,220,${0.6-i*0.15})`;
              ctx.beginPath();ctx.arc(Math.cos(pa)*pr,Math.sin(pa)*pr,2,0,Math.PI*2);ctx.fill();
            }
            // Dark trail
            ctx.strokeStyle="rgba(80,30,120,0.5)";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-20,0);ctx.stroke();
          }else if(proj.type==="web"){
            // Spider web projectile
            ctx.fillStyle="rgba(200,200,200,0.7)";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle="rgba(180,180,180,0.5)";ctx.lineWidth=1;
            for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*Math.PI/3)*8,Math.sin(i*Math.PI/3)*8);ctx.stroke();}
            ctx.strokeStyle="rgba(150,150,150,0.3)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-12,0);ctx.stroke();
          }else if(proj.type==="fire"){
            // Fire projectile
            const flicker=Math.sin(ts*0.05)*2;
            ctx.fillStyle="#ff4020";ctx.beginPath();ctx.arc(0,0,7+flicker,0,Math.PI*2);ctx.fill();
            ctx.fillStyle="#ffaa40";ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
            ctx.fillStyle="#ffe080";ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle="rgba(255,120,40,0.5)";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-15-flicker,0);ctx.stroke();
          }else if(proj.type==="poison"){
            // Poison spit
            ctx.fillStyle="#40a030";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
            ctx.fillStyle="#80e060";ctx.beginPath();ctx.arc(-1,-1,3,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle="rgba(60,160,40,0.4)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-12,0);ctx.stroke();
          }else{
            // Default enemy projectile
            ctx.fillStyle="#8a3030";ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle="#ff6040";ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle="rgba(255,80,40,0.4)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-8,0);ctx.stroke();
          }
          ctx.restore();
        });
        // Render floating damage texts (capped for performance) - DELTA TIME BASED
        const newFloatingTexts = [];
        g.floatingTexts.forEach(ft=>{
          ft.y-=1.2*dtMult;ft.life-=dtMult; // Scale by delta time
          if(ft.life<=0){
            releaseFloatingText(ft); // Return to pool
            return;
          }
          const ftx=ft.x-camX,fty=ft.y-camY;
          const alpha=Math.min(1,ft.life/15);
          const scale=ft.crit?1+Math.sin(ft.life*0.3)*0.1:1;
          ctx.save();ctx.translate(ftx,fty);ctx.scale(scale,scale);
          ctx.font=ft.crit?"bold 14px monospace":"bold 11px monospace";
          // Parse hex color and add alpha
          const col=ft.color||"#ffffff";
          const r=parseInt(col.slice(1,3),16),g2=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
          ctx.fillStyle=`rgba(${r},${g2},${b},${alpha})`;
          ctx.textAlign="center";
          // Outline for visibility
          ctx.strokeStyle=`rgba(0,0,0,${alpha*0.7})`;ctx.lineWidth=3;ctx.strokeText(ft.text,0,0);
          ctx.fillText(ft.text,0,0);
          ctx.restore();ctx.textAlign="left";
          newFloatingTexts.push(ft);
        });
        g.floatingTexts = newFloatingTexts;
      }else{
        // Draw town NPCs
        townNPCs.current.forEach(npc=>{
          const q=quests[npc.questId];const hasQuest=q&&(q.status==="available"||q.status==="active");
          const qp=g.questProgress;const qid=npc.questId;
          const canTurnIn=
            (qid==="forge_ahead"&&qp.forge_chiefKilled)||
            (qid==="cellar_spirits"&&qp.cellar_spidersKilled>=4)||
            (qid==="trade_routes"&&qp.trade_crystalFound)||
            (qid==="hollow_threat"&&qp.hollow_wolvesKilled>=3)||
            (qid==="sacred_relics"&&qp.sacred_shrineFound)||
            (qid==="old_ways"&&qp.old_shrineFound)||
            (qid==="alpha_hunt"&&qp.alpha_wolfKilled)||
            (qid==="spider_depths"&&qp.spider_queenKilled)||
            (qid==="catacombs"&&qp.catacombs_explored)||
            // Graveyard quests
            (qid==="restless_dead"&&qp.graveyardKilled>=6)||
            (qid==="grave_robbers"&&qp.mausoleumFound)||
            (qid==="crypt_key"&&qp.cryptKeyFound)||
            // Desert quests
            (qid==="oasis_guardian"&&qp.oasisGuardianKilled)||
            (qid==="lost_caravan"&&qp.caravanFound)||
            (qid==="desert_ruins"&&qp.desertRuinsExplored>=2)||
            (qid==="scorpion_threat"&&qp.scorpionsKilled>=4);
          drawTownNPC(ctx,npc,camX,camY,ts,hasQuest,canTurnIn&&q?.status==="active");
        });
        // NPC interact prompt
        if(nearTownNpc&&!dialogue){
          const npx=nearTownNpc.x-camX,npy=nearTownNpc.y-camY;
          ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(npx-20,npy-16,80,14);
          ctx.font="bold 9px monospace";ctx.fillStyle="#90caf9";ctx.textAlign="center";
          ctx.fillText(`[E] ${nearTownNpc.name}`,npx+20,npy-5);ctx.textAlign="left";
        }
      }

      // Player
      const psxR=Math.floor(p.x)-camX,psyR=Math.floor(p.y)-camY;
      const ci=hotbar[hotbarSlot];const hi=ci?HELD_MAP[ci.icon]:null;
      const swProg=g.swinging?g.swingTimer/g.swingDur:0;
      // Dodge ghost trail
      if(p.dodging){
        ctx.globalAlpha=0.3;
        const trailOff=p.dodgeTimer*2;
        drawPlayer(ctx,psxR+p.dodgeDir.x*trailOff,psyR+p.dodgeDir.y*trailOff,p.dir,p.frame,ts,false,0,null,p.aimAngle);
        ctx.globalAlpha=0.15;
        drawPlayer(ctx,psxR+p.dodgeDir.x*trailOff*1.8,psyR+p.dodgeDir.y*trailOff*1.8,p.dir,p.frame,ts,false,0,null,p.aimAngle);
        ctx.globalAlpha=1;
      }
      drawPlayer(ctx,psxR,psyR,p.dir,p.frame,ts,g.swinging,swProg,hi,p.aimAngle);

      // Footstep dust when moving
      if(p.moving&&Math.floor(p.frame*2)%2===0){
        const dustCol=isTown?"rgba(120,110,90,0.3)":isForest?"rgba(80,100,60,0.3)":isCave?"rgba(60,60,80,0.25)":"rgba(100,80,60,0.3)";
        ctx.fillStyle=dustCol;
        const dox=(Math.random()-0.5)*8,doy=Math.random()*4;
        ctx.beginPath();ctx.arc(psxR+20+dox,psyR+38+doy,2+Math.random()*1.5,0,Math.PI*2);ctx.fill();
      }

      // Lighting (controlled by GFX.lighting)
      const heldTorch=ci&&ci.icon==="torch";
      if(GFX.lighting){
        renderLighting(ctx,md,camX,camY,p.x,p.y,ts,heldTorch,zone);
      }

      // Atmosphere (controlled by GFX.atmosphericEffects)
      if(GFX.atmosphericEffects&&zone==="ruin"){
        // Ash and ember particles - layered
        if(GFX.particleLimit>=20){
          for(let layer=0;layer<2;layer++){
            const alpha=0.08+layer*0.05;
            ctx.fillStyle=`rgba(180,120,60,${alpha})`;
            const count=Math.min(6,Math.floor(GFX.particleLimit/4));
            for(let i=0;i<count;i++){
              const ax=Math.floor(((ts*(0.01+layer*0.005)+i*180+layer*70)%(CANVAS_W+80))-40);
              const ay=Math.floor(((Math.sin(ts*0.001+i*1.5+layer)*40+CANVAS_H*0.5+ts*(0.006+layer*0.003)*(i%3+1)))%CANVAS_H);
              ctx.beginPath();ctx.arc(ax,ay,1.5-layer*0.3,0,Math.PI*2);ctx.fill();
            }
          }
        }
        // Floating ash flakes
        if(GFX.particleLimit>=10){
          ctx.fillStyle="rgba(90,80,70,0.22)";
          const count=Math.min(6,Math.floor(GFX.particleLimit/3));
          for(let i=0;i<count;i++){
            const ax=Math.floor(((ts*0.004+i*130)%(CANVAS_W+50))-25);
            const ay=Math.floor((ts*0.003+i*100)%CANVAS_H);
            const sway=Math.floor(Math.sin(ts*0.002+i)*5);
            const rot=ts*0.001+i*0.5;
            ctx.save();ctx.translate(ax+sway,ay);ctx.rotate(rot);
            ctx.beginPath();ctx.ellipse(0,0,2.5,1,0,0,Math.PI*2);ctx.fill();
            ctx.restore();
          }
        }
        // Glowing embers
        if(doExpensiveEffects&&GFX.particleLimit>=5){
          for(let i=0;i<Math.min(4,GFX.particleLimit/5);i++){
            const emberPhase=(ts*0.008+i*400)%(CANVAS_H*2);
            if(emberPhase<CANVAS_H){
              const ex=Math.floor((i*180+Math.sin(ts*0.002+i)*30)%CANVAS_W);
              const ey=Math.floor(CANVAS_H-emberPhase);
              const glow=Math.sin(ts*0.02+i)*0.2+0.5;
              ctx.fillStyle=`rgba(255,180,80,${glow})`;
              ctx.beginPath();ctx.arc(ex,ey,2,0,Math.PI*2);ctx.fill();
            }
          }
        }
        // Smoke wisps (always on if atmospheric enabled)
        ctx.fillStyle="rgba(50,40,35,0.04)";
        ctx.beginPath();ctx.ellipse(CANVAS_W*0.3,CANVAS_H-80,70,100,0,0,Math.PI*2);ctx.fill();
      }else if(GFX.atmosphericEffects&&zone==="forest"){
        // Forest: dappled green light, floating leaves
        ctx.fillStyle="rgba(80,160,60,0.04)";ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        // Volumetric light rays
        if(GFX.lightingQuality>=1){
          for(let r=0;r<2;r++){
            const rayPhase=ts*0.0002+r*2;
            const rayAlpha=(Math.sin(rayPhase)*0.5+0.5)*0.03+0.01;
            const rayX=(r*0.35+0.15+Math.sin(ts*0.0001+r)*0.05)*CANVAS_W;
            const rayWidth=0.1;
            ctx.fillStyle=`rgba(200,255,140,${rayAlpha})`;
            ctx.beginPath();
            ctx.moveTo(rayX,0);ctx.lineTo(rayX-30,CANVAS_H);ctx.lineTo(rayX+CANVAS_W*rayWidth-30,CANVAS_H);ctx.lineTo(rayX+CANVAS_W*rayWidth,0);
            ctx.fill();
          }
        }
        // Dust motes
        if(GFX.particleLimit>=5){
          ctx.fillStyle="rgba(255,255,200,0.3)";
          const moteCount=Math.min(6,Math.floor(GFX.particleLimit/3));
          for(let i=0;i<moteCount;i++){
            const mx=Math.floor(((ts*0.003+i*150)%(CANVAS_W+40))-20);
            const my=Math.floor((ts*0.004+i*110)%CANVAS_H);
            ctx.beginPath();ctx.arc(mx,my,1.5,0,Math.PI*2);ctx.fill();
          }
        }
        // Floating leaves
        if(GFX.particleLimit>=5){
          ctx.fillStyle="rgba(70,120,40,0.15)";
          for(let i=0;i<Math.min(3,GFX.particleLimit/6);i++){
            const lx=Math.floor(((ts*0.006+i*250)%(CANVAS_W+80))-40);
            const ly=Math.floor((ts*0.003+i*140+Math.sin(ts*0.002+i)*40)%CANVAS_H);
            ctx.beginPath();ctx.ellipse(lx,ly,4,2,ts*0.002+i,0,Math.PI*2);ctx.fill();
          }
        }
        // Fireflies
        if(doExpensiveEffects&&GFX.particleLimit>=10){
          for(let i=0;i<Math.min(6,GFX.particleLimit/4);i++){
            const ffPhase=ts*0.003+i*1.7;
            const ffGlow=Math.sin(ffPhase)*0.5+0.5;
            if(ffGlow>0.4){
              const ffAlpha=ffGlow*0.6;
              ctx.fillStyle=`rgba(180,255,100,${ffAlpha})`;
              const fx=Math.floor((i*140+Math.sin(ts*0.001+i*2)*60)%CANVAS_W);
              const fy=Math.floor((i*100+Math.cos(ts*0.0012+i*1.5)*40)%CANVAS_H);
              ctx.beginPath();ctx.arc(fx,fy,2+ffGlow,0,Math.PI*2);ctx.fill();
              // Simplified glow halo (no gradient)
              ctx.fillStyle=`rgba(180,255,100,${ffAlpha*0.25})`;
              ctx.beginPath();ctx.arc(fx,fy,6,0,Math.PI*2);ctx.fill();
            }
          }
        }
      }else if(zone==="cave"){
        // Cave: drip particles, bioluminescent glow, wet surfaces
        ctx.fillStyle="rgba(10,20,40,0.06)";ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        // Water drips (reduced count, skip ripples every other frame)
        for(let i=0;i<5;i++){
          const dx2=80+i*160;
          const dropY=Math.floor((ts*0.02+i*220)%(CANVAS_H+60)-30);
          const dropX=Math.floor(dx2+Math.sin(ts*0.001+i)*5);
          if(dropY<CANVAS_H-20){
            ctx.fillStyle="rgba(120,180,230,0.4)";
            ctx.beginPath();ctx.ellipse(dropX%CANVAS_W,dropY,1.5,3,0,0,Math.PI*2);ctx.fill();
          }
          // Ripple on ground (only on expensive frames)
          if(doExpensiveEffects){
            const ripplePhase=(ts*0.02+i*220)%(CANVAS_H+60);
            if(ripplePhase>CANVAS_H-20&&ripplePhase<CANVAS_H+40){
              const rippleAge=(ripplePhase-(CANVAS_H-20))/60;
              const rippleAlpha=Math.max(0,0.3-rippleAge*0.3);
              ctx.strokeStyle=`rgba(120,180,230,${rippleAlpha})`;
              ctx.lineWidth=1;
              ctx.beginPath();ctx.ellipse(dropX%CANVAS_W,CANVAS_H-15,5+rippleAge*15,2+rippleAge*4,0,0,Math.PI*2);ctx.stroke();
            }
          }
        }
        // Bioluminescent fungi glow spots (simplified - no gradient)
        if(doExpensiveEffects){
          for(let i=0;i<4;i++){
            const glowPhase=ts*0.002+i*1.3;
            const glow=Math.sin(glowPhase)*0.15+0.2;
            const gx=Math.floor((i*250+80)%CANVAS_W);
            const gy=Math.floor((i*170+120)%CANVAS_H);
            ctx.fillStyle=`rgba(50,200,160,${glow*0.4})`;
            ctx.beginPath();ctx.arc(gx,gy,20,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=`rgba(60,220,180,${glow})`;
            ctx.beginPath();ctx.arc(gx,gy,8,0,Math.PI*2);ctx.fill();
          }
          // Crystal reflections
          for(let i=0;i<3;i++){
            const sparkle=Math.sin(ts*0.01+i*3)>0.7?0.4:0;
            if(sparkle>0){
              ctx.fillStyle=`rgba(200,230,255,${sparkle})`;
              const sx=Math.floor((i*220+ts*0.01)%CANVAS_W);
              const sy=Math.floor((i*150+50)%CANVAS_H);
              ctx.beginPath();ctx.arc(sx,sy,1.5,0,Math.PI*2);ctx.fill();
            }
          }
          // Ambient fog/mist (simplified - no gradient)
          ctx.fillStyle="rgba(30,50,70,0.03)";
          ctx.fillRect(0,CANVAS_H*0.7,CANVAS_W,CANVAS_H*0.3);
        }
      }else if(isCrypt){
        // Crypt: spectral wisps, cold blue lighting, dust motes
        ctx.fillStyle="rgba(20,20,40,0.06)";ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        // Spectral wisps (simplified - no gradient, only on expensive frames)
        if(doExpensiveEffects){
          for(let i=0;i<3;i++){
            const wispPhase=ts*0.001+i*1.5;
            const wispAlpha=(Math.sin(wispPhase)*0.3+0.4)*0.12;
            const wx=Math.floor((i*250+Math.sin(ts*0.0005+i)*80)%CANVAS_W);
            const wy=Math.floor((i*140+Math.cos(ts*0.0007+i)*60+30)%CANVAS_H);
            ctx.fillStyle=`rgba(80,100,200,${wispAlpha*0.3})`;
            ctx.beginPath();ctx.arc(wx,wy,25,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=`rgba(140,160,255,${wispAlpha})`;
            ctx.beginPath();ctx.arc(wx,wy,10,0,Math.PI*2);ctx.fill();
          }
        }
        // Floating dust particles - reduced count
        ctx.fillStyle="rgba(150,160,180,0.25)";
        for(let i=0;i<8;i++){
          const dx=Math.floor(((ts*0.002+i*100)%(CANVAS_W+30))-15);
          const dy=Math.floor((ts*0.001+i*80+Math.sin(ts*0.001+i)*20)%CANVAS_H);
          const dsize=0.8+Math.sin(ts*0.003+i)*0.3;
          ctx.beginPath();ctx.arc(dx,dy,dsize,0,Math.PI*2);ctx.fill();
        }
        // Cold fog from ground
        const cryptFog=Math.sin(ts*0.0003)*0.02+0.05;
        const cryptGrd=ctx.createLinearGradient(0,CANVAS_H*0.7,0,CANVAS_H);
        cryptGrd.addColorStop(0,"rgba(60,60,100,0)");
        cryptGrd.addColorStop(1,`rgba(60,60,100,${cryptFog})`);
        ctx.fillStyle=cryptGrd;
        ctx.fillRect(0,CANVAS_H*0.7,CANVAS_W,CANVAS_H*0.3);
        // Occasional soul flame flicker
        if(Math.random()<0.02){
          const flareX=Math.random()*CANVAS_W;
          const flareY=Math.random()*CANVAS_H*0.6+CANVAS_H*0.2;
          ctx.fillStyle="rgba(100,150,255,0.15)";
          ctx.beginPath();ctx.arc(flareX,flareY,8,0,Math.PI*2);ctx.fill();
        }
      }else if(isTown){
        // Town: warm golden hour sunlight with god rays
        ctx.fillStyle="rgba(255,240,200,0.05)";ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        // Multiple soft god rays from upper right
        for(let r=0;r<4;r++){
          const rayPhase=ts*0.0001+r*0.8;
          const rayAlpha=(Math.sin(rayPhase)*0.3+0.7)*0.025;
          const startX=CANVAS_W*(0.6+r*0.12);
          const rayAngle=-0.3+r*0.08;
          ctx.fillStyle=`rgba(255,230,180,${rayAlpha})`;
          ctx.save();
          ctx.translate(startX,-20);
          ctx.rotate(rayAngle);
          ctx.fillRect(-20,0,40+r*10,CANVAS_H*1.5);
          ctx.restore();
        }
        // Floating dust/pollen particles with varied sizes
        for(let i=0;i<12;i++){
          const px=Math.floor(((ts*0.006+i*80)%(CANVAS_W+50))-25);
          const py=Math.floor((Math.sin(ts*0.0006+i*1.8)*50+CANVAS_H*0.25+i*40)%CANVAS_H);
          const psize=0.8+Math.sin(i*2.3)*0.5;
          const palpha=0.2+Math.sin(ts*0.003+i)*0.1;
          ctx.fillStyle=`rgba(255,240,180,${palpha})`;
          ctx.beginPath();ctx.arc(px,py,psize,0,Math.PI*2);ctx.fill();
        }
        // Occasional bird silhouettes - small flock
        const birdT=(ts*0.0002)%6;
        if(birdT<3){
          ctx.fillStyle="rgba(40,30,20,0.12)";
          for(let b=0;b<3;b++){
            const bx=((ts*0.012+b*30)%(CANVAS_W+150))-75;
            const by=25+Math.sin(ts*0.003+b*2)*12+b*8;
            const wingPhase=Math.sin(ts*0.02+b*1.5);
            ctx.beginPath();
            ctx.moveTo(bx,by);
            ctx.quadraticCurveTo(bx-5,by-3-wingPhase*2,bx-8,by-2+wingPhase);
            ctx.moveTo(bx,by);
            ctx.quadraticCurveTo(bx+5,by-3-wingPhase*2,bx+8,by-2+wingPhase);
            ctx.stroke();
          }
        }
        // Warm color gradient overlay at edges
        const warmGrd=ctx.createRadialGradient(CANVAS_W*0.8,0,0,CANVAS_W*0.8,0,CANVAS_W);
        warmGrd.addColorStop(0,"rgba(255,200,150,0.08)");
        warmGrd.addColorStop(0.5,"rgba(255,220,180,0.03)");
        warmGrd.addColorStop(1,"rgba(255,240,200,0)");
        ctx.fillStyle=warmGrd;
        ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
      }

      // Low health warning effect
      const currentHp=healthRef.current;
      const maxHp=maxHealth+(getSkillBonuses().maxHpBonus||0);
      if(currentHp<maxHp*0.3&&currentHp>0){
        const pulse=Math.sin(ts*0.008)*0.15+0.25;
        const lowHpVg=ctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2,CANVAS_W*0.35,CANVAS_W/2,CANVAS_H/2,CANVAS_W*0.65);
        lowHpVg.addColorStop(0,"rgba(0,0,0,0)");
        lowHpVg.addColorStop(0.6,`rgba(80,0,0,${pulse*0.3})`);
        lowHpVg.addColorStop(1,`rgba(120,0,0,${pulse})`);
        ctx.fillStyle=lowHpVg;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
      }

      // Vignette (controlled by GFX.vignette)
      if(GFX.vignette){
        const vigAlpha=isTown?0.12:isCave?0.35:isForest?0.18:isDesert?0.08:0.30;
        ctx.drawImage(getVignetteCanvas(vigAlpha),0,0);
      }


      // Death overlay
      if(g.dead){
        g.deathTimer++;
        const da=Math.min(1,g.deathTimer/60);
        ctx.fillStyle=`rgba(20,0,0,${da*0.75})`;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        // Blood vignette
        const bvg=ctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2,50,CANVAS_W/2,CANVAS_H/2,CANVAS_W*0.6);
        bvg.addColorStop(0,"rgba(0,0,0,0)");bvg.addColorStop(1,`rgba(80,0,0,${da*0.5})`);
        ctx.fillStyle=bvg;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        if(da>0.3){
          ctx.fillStyle=`rgba(180,20,20,${Math.min(1,(da-0.3)*1.4)})`;
          ctx.font="bold 28px 'Courier New',monospace";ctx.textAlign="center";
          ctx.fillText("YOU HAVE FALLEN",CANVAS_W/2,CANVAS_H/2-20);
          ctx.fillStyle=`rgba(180,160,120,${Math.min(1,(da-0.5)*2)})`;
          ctx.font="14px 'Courier New',monospace";
          ctx.fillText("Level XP progress lost",CANVAS_W/2,CANVAS_H/2+15);
          ctx.fillStyle=`rgba(200,200,180,${Math.min(1,(da-0.6)*2.5)})`;
          ctx.font="12px 'Courier New',monospace";
          ctx.fillText("[Space] to rise again",CANVAS_W/2,CANVAS_H/2+45);
          ctx.textAlign="left";
        }
      }

      // Ultimate visual effects (simplified - no gradients)
      if(activeUltRef.current){
        const ut=activeUltRef.current;
        if(ut.type==="berserker"){
          const pulse=Math.sin(ts*0.01)*0.06+0.08;
          ctx.fillStyle=`rgba(200,40,20,${pulse})`;ctx.fillRect(-10,-10,CANVAS_W+20,CANVAS_H+20);
          // Aura around player (simplified circles instead of gradient)
          const psx2=Math.floor(p.x)-camX+20,psy2=Math.floor(p.y)-camY+20;
          ctx.fillStyle=`rgba(255,40,10,${0.1+Math.sin(ts*0.008)*0.05})`;
          ctx.beginPath();ctx.arc(psx2,psy2,45,0,Math.PI*2);ctx.fill();
          ctx.fillStyle=`rgba(255,80,20,${0.2+Math.sin(ts*0.008)*0.1})`;
          ctx.beginPath();ctx.arc(psx2,psy2,25,0,Math.PI*2);ctx.fill();
        }
        if(ut.type==="ironwill"){
          const pulse=Math.sin(ts*0.008)*0.05+0.06;
          ctx.fillStyle=`rgba(40,160,80,${pulse})`;ctx.fillRect(-10,-10,CANVAS_W+20,CANVAS_H+20);
          const psx2=Math.floor(p.x)-camX+20,psy2=Math.floor(p.y)-camY+20;
          ctx.fillStyle=`rgba(40,160,80,${0.1+Math.sin(ts*0.006)*0.05})`;
          ctx.beginPath();ctx.arc(psx2,psy2,50,0,Math.PI*2);ctx.fill();
          ctx.fillStyle=`rgba(80,200,120,${0.2+Math.sin(ts*0.006)*0.1})`;
          ctx.beginPath();ctx.arc(psx2,psy2,30,0,Math.PI*2);ctx.fill();
        }
      }

      // FPS tracking
      g._fpsData.frames++;
      if(ts-g._fpsData.lastCheck>1000){
        g._fpsData.fps=g._fpsData.frames;
        g._fpsData.frames=0;
        g._fpsData.lastCheck=ts;
      }
      // FPS display (bottom-left, clear of UI)
      ctx.fillStyle=g._fpsData.fps<30?'#ff4040':g._fpsData.fps<50?'#ffa040':'#40ff40';
      ctx.font='bold 12px monospace';
      ctx.fillText(`FPS: ${g._fpsData.fps}`,10,CANVAS_H-8);

      // Damage flash
      if(g.dmgCooldown>20&&!g.dead){
        const flash=(g.dmgCooldown-20)/10;
        ctx.fillStyle=`rgba(200,0,0,${flash*0.15})`;ctx.fillRect(-10,-10,CANVAS_W+20,CANVAS_H+20);
      }

      ctx.restore(); // end screen shake transform

      animId=requestAnimationFrame(loop);
    };
    animId=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animId);
  },[gameStarted,dialogue,menuTab,hotbarSlot,hotbar,nearNpc,nearRelic,nearTownNpc,maxStamina,showNotif,showKillNotif,equipped,quests,changeZone,getSkillBonuses]);

  // Level up check
  useEffect(()=>{
    const thresholds=[0,50,120,220,360,550,800,1100];
    let newLevel=1;
    for(let i=thresholds.length-1;i>=0;i--){if(xp>=thresholds[i]){newLevel=i+1;break;}}
    if(newLevel>level){setLevel(newLevel);setSkillPoints(sp=>sp+1);showNotif(`Level Up! You are now level ${newLevel} (+1 Skill Point)`,3500);SoundSystem.play('levelup');}
  },[xp,level,showNotif]);

  // Minimap
  const minimapRef=useRef(null);
  const minimapFrameRef=useRef(0);
  useEffect(()=>{
    if(!gameStarted)return; // Don't render minimap until game starts
    const mc=minimapRef.current;if(!mc)return;
    const mctx=mc.getContext("2d"),g=gameRef.current,s=2;let aid;
    const draw=()=>{
      // Performance: Only update minimap every 2nd frame
      minimapFrameRef.current++;
      if(minimapFrameRef.current%2!==0){aid=requestAnimationFrame(draw);return;}
      const isTown=phaseRef.current==="town";const zone2=phaseRef.current;
      const md=isTown?townData.current:zone2==="forest"?forestData.current:zone2==="cave"?caveData.current:zone2==="crypt"?cryptData.current:zone2==="graveyard"?graveyardData.current:zone2==="desert"?desertData.current:ruinData.current;
      mc.width=md.w*s;mc.height=md.h*s;
      mctx.fillStyle=isTown?"rgba(20,40,18,0.95)":zone2==="forest"?"rgba(10,20,8,0.95)":zone2==="cave"?"rgba(6,6,16,0.95)":zone2==="crypt"?"rgba(10,10,18,0.95)":zone2==="graveyard"?"rgba(10,10,14,0.95)":zone2==="desert"?"rgba(40,35,20,0.95)":"rgba(5,5,10,0.95)";mctx.fillRect(0,0,md.w*s,md.h*s);
      for(let y=0;y<md.h;y++)for(let x=0;x<md.w;x++){
        const t=md.map[y][x];let c=isTown?"#1a3018":"#0a0a0f";
        if(isTown){if(t===T.WALL)c="#4a4050";else if(t===T.GRASS||t===T.GRASS_DARK)c="#2a5420";else if(t===T.COBBLE_CLEAN||t===T.PATH)c="#6a6050";else if(t===T.WOOD_FLOOR)c="#5a4830";else if(t===T.WATER||t===T.FOUNTAIN)c="#2a5a6a";else if(t===T.TREE)c="#1a3812";else if(SOLID.has(t))c="#3a3830";}
        else if(zone2==="forest"){if(t===T.DENSE_TREE)c="#0a2808";else if(t===T.GRASS||t===T.GRASS_DARK)c="#1a3a14";else if(t===T.DIRT||t===T.PATH)c="#4a3a20";else if(t===T.CAMP_FIRE)c="#8a4020";else if(SOLID.has(t))c="#1a2a10";else c="#142a10";}
        else if(zone2==="cave"){if(t===T.CAVE_WALL)c="#0a0810";else if(t===T.CAVE_FLOOR)c="#1a1828";else if(t===T.UNDERGROUND_WATER)c="#0a2040";else if(t===T.MUSHROOM||t===T.CRYSTAL)c="#2a4a40";else if(SOLID.has(t))c="#0c0a14";else c="#141220";}
        else if(zone2==="crypt"){if(t===T.CRYPT_WALL)c="#101018";else if(t===T.CRYPT_FLOOR)c="#181820";else if(t===T.SOUL_FLAME)c="#304060";else if(t===T.SARCOPHAGUS||t===T.TOMB)c="#2a2838";else if(SOLID.has(t))c="#0c0c14";else c="#141418";}
        else if(zone2==="graveyard"){if(t===T.GRAVESTONE)c="#5a5860";else if(t===T.GRAVE_DIRT)c="#3a3028";else if(t===T.DEAD_GRASS)c="#4a4830";else if(t===T.CRYPT_ENTRANCE)c="#304060";else if(SOLID.has(t))c="#2a2830";else c="#3a3828";}
        else if(zone2==="desert"){if(t===T.SAND)c="#c4a868";else if(t===T.SAND_DARK)c="#a89050";else if(t===T.DUNE)c="#d4b878";else if(t===T.OASIS)c="#2a6a70";else if(SOLID.has(t))c="#8a7048";else c="#b89858";}
        else{if(t===T.VOID)c="#050508";else if(t===T.WALL||t===T.TORCH_WALL||t===T.WALL_BROKEN)c="#2a2040";else if(t===T.COBBLE||t===T.COBBLE_DARK)c="#1a1810";else if(t===T.CATHEDRAL_FLOOR||t===T.CARPET_RED)c="#1a1828";else if(t===T.BLOOD||t===T.BLOOD_TRAIL||t===T.BLOOD_POOL)c="#3a1010";else if(SOLID.has(t))c="#1e1830";else c="#141210";}
        mctx.fillStyle=c;mctx.fillRect(x*s,y*s,s,s);
      }
      if(!isTown){g.enemies.forEach(e=>{if(!e.dead){mctx.fillStyle="#c03030";mctx.fillRect(Math.floor(e.x/TILE)*s,Math.floor(e.y/TILE)*s,s+1,s+1);}});if(zone2==="ruin"&&!g.npcDead){mctx.fillStyle="#50c878";mctx.fillRect(29*s,10*s,s+1,s+1);}}
      else{townNPCs.current.forEach(n=>{mctx.fillStyle=n.isTrader?"#c4a43e":"#50c878";mctx.fillRect(Math.floor(n.x/TILE)*s,Math.floor(n.y/TILE)*s,s+1,s+1);});}
      const ppx=Math.floor(g.player.x/TILE),ppy=Math.floor(g.player.y/TILE);
      mctx.fillStyle="#e8e040";mctx.fillRect(ppx*s-1,ppy*s-1,s+2,s+2);
      aid=requestAnimationFrame(draw);
    };
    aid=requestAnimationFrame(draw);return()=>cancelAnimationFrame(aid);
  },[gameStarted]);

  const currentLine=dialogue==="knight"?DM_LINES[dialogueLine]:null;
  const isDead=npcDead||dialogueLine>=DM_LINES.length-2;
  const isTown=phase==="town";
  const townNpcLine=dialogue==="town_npc"?gameRef.current.talkingNpc:null;

  const activeQuests=Object.values(quests).filter(q=>q.status==="active");
  const availableQuests=Object.values(quests).filter(q=>q.status==="available");
  const completeQuests=Object.values(quests).filter(q=>q.status==="complete");

  const xpForLevel=XP_THRESHOLDS[level]||XP_THRESHOLDS[XP_THRESHOLDS.length-1]+300;
  const xpForPrev=XP_THRESHOLDS[level-1]||0;
  const xpProgress=xpForLevel>xpForPrev?((xp-xpForPrev)/(xpForLevel-xpForPrev))*100:100;
  const totalDmg=(equipped.weapon?.stats?.dmg||0)+(equipped.relic?.stats?.dmg||0);
  const totalDef=(equipped.armor?.stats?.def||0)+(equipped.relic?.stats?.def||0);
  const effectiveMaxHp=maxHealth+(getSkillBonuses().maxHpBonus||0);

  // Styles
  const S={
    panel:{background:"rgba(8,6,14,0.97)",border:"1px solid #1a1528",borderRadius:6,padding:16},
    tabBtn:(active)=>({padding:"8px 16px",background:active?"rgba(139,92,246,0.2)":"transparent",border:"none",borderBottom:active?"2px solid #8b5cf6":"2px solid transparent",color:active?"#c4a43e":"#5a5060",fontSize:11,fontFamily:"'Courier New',monospace",cursor:"pointer",letterSpacing:1}),
    slotBox:{width:56,height:56,background:"rgba(14,12,22,0.85)",border:"2px solid #1a1528",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  };

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS MENU (shown before game starts)
  // ═══════════════════════════════════════════════════════════════
  if(!gameStarted){
    return(
      <div style={{width:"100vw",height:"100vh",background:"linear-gradient(180deg,#030308 0%,#0a0810 50%,#0c0612 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",color:"#d4c5a9"}}>
        <div style={{background:"rgba(8,6,14,0.98)",border:"1px solid #2a1f38",borderRadius:8,padding:32,width:480,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          <h1 style={{fontSize:28,color:"#c4a43e",textAlign:"center",marginBottom:8,letterSpacing:3,textShadow:"0 2px 8px rgba(196,164,62,0.3)"}}>DARK HOLLOWS</h1>
          <p style={{fontSize:10,color:"#5a5060",textAlign:"center",marginBottom:24,letterSpacing:2}}>PROLOGUE: THE ASHEN CITY</p>
          
          <div style={{marginBottom:24}}>
            <h3 style={{fontSize:12,color:"#8b5cf6",marginBottom:12,letterSpacing:1}}>⚙ GRAPHICS SETTINGS</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {Object.entries(GRAPHICS_PRESETS).map(([key,preset])=>(
                <button
                  key={key}
                  onClick={()=>{setGraphicsPreset(key);setGraphicsPresetState(key);}}
                  style={{
                    padding:"12px 16px",
                    background:graphicsPreset===key?"rgba(139,92,246,0.2)":"rgba(20,16,30,0.8)",
                    border:graphicsPreset===key?"2px solid #8b5cf6":"2px solid #2a1f38",
                    borderRadius:6,
                    cursor:"pointer",
                    textAlign:"left",
                    transition:"all 0.15s ease"
                  }}
                >
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,color:graphicsPreset===key?"#c4a43e":"#a09080",fontWeight:"bold"}}>{preset.name}</span>
                    {graphicsPreset===key&&<span style={{fontSize:10,color:"#8b5cf6"}}>✓ SELECTED</span>}
                  </div>
                  <p style={{fontSize:9,color:"#5a5060",marginTop:4}}>{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>
          
          <div style={{background:"rgba(20,16,30,0.5)",padding:12,borderRadius:4,marginBottom:24}}>
            <h4 style={{fontSize:10,color:"#8b5cf6",marginBottom:8}}>PRESET DETAILS</h4>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:9,color:"#6a6070"}}>
              <span>Lighting: {GFX.lighting?"ON":"OFF"}</span>
              <span>Particles: {GFX.particleLimit>0?GFX.particleLimit:"OFF"}</span>
              <span>Atmospheric: {GFX.atmosphericEffects?"ON":"OFF"}</span>
              <span>Tile Detail: {GFX.tileDetail===2?"High":GFX.tileDetail===1?"Medium":"Low"}</span>
              <span>Vignette: {GFX.vignette?"ON":"OFF"}</span>
              <span>Animations: {GFX.animatedTiles?"ON":"OFF"}</span>
            </div>
          </div>
          
          <button
            onClick={()=>{SoundSystem.init();setGameStarted(true);}}
            style={{
              width:"100%",
              padding:"16px 24px",
              background:"linear-gradient(180deg,#8b5cf6 0%,#6d28d9 100%)",
              border:"none",
              borderRadius:6,
              color:"#fff",
              fontSize:14,
              fontWeight:"bold",
              letterSpacing:2,
              cursor:"pointer",
              boxShadow:"0 4px 12px rgba(139,92,246,0.4)",
              transition:"transform 0.1s ease"
            }}
            onMouseOver={e=>e.target.style.transform="scale(1.02)"}
            onMouseOut={e=>e.target.style.transform="scale(1)"}
          >
            ▶ START GAME
          </button>
          
          <p style={{fontSize:8,color:"#3a3040",textAlign:"center",marginTop:16}}>
            Settings are saved automatically. Press ESC in-game to change graphics.
          </p>
        </div>
      </div>
    );
  }

  return(
    <div style={{width:"100vw",height:"100vh",background:"#030308",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",color:"#d4c5a9",overflow:"hidden",position:"relative"}}>
      <div style={{position:"relative",width:CANVAS_W,height:CANVAS_H}}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{display:"block",imageRendering:"pixelated",border:`2px solid ${isTown?"#3a5a30":"#1a1225"}`,cursor:"crosshair"}}/>

        {transAlpha>0&&<div style={{position:"absolute",inset:0,background:`rgba(255,255,255,${transAlpha})`,pointerEvents:"none",zIndex:50}}/>}

        {/* Zone name indicator */}
        <div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",fontSize:10,letterSpacing:3,color:isTown?"rgba(200,180,100,0.6)":"rgba(100,90,110,0.5)",textTransform:"uppercase",pointerEvents:"none",zIndex:5,textShadow:"0 1px 2px rgba(0,0,0,0.5)"}}>
          {phase==="town"?"Ashenmoor":phase==="forest"?"Darkwood Forest":phase==="cave"?"Hollow Caves":phase==="graveyard"?"Old Graveyard":phase==="desert"?"Scorched Desert":phase==="crypt"?"Catacombs":"The Ashen City"}
        </div>

        {/* HUD: Health/Stamina/XP */}
        <div style={{position:"absolute",top:10,left:10,width:220,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:12,color:"#c62828",width:16}}>♥</span>
            <div style={{flex:1,height:14,background:"rgba(20,8,8,0.85)",border:"1px solid #4a1a1a",borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${(health/effectiveMaxHp)*100}%`,height:"100%",background:health<30?"linear-gradient(90deg,#8a1010,#cc2020)":"linear-gradient(90deg,#5a1010,#c62828)",borderRadius:2}}/>
            </div>
            <span style={{fontSize:9,color:health<30?"#ff4444":"#a08080",minWidth:36}}>{Math.floor(health)}/{effectiveMaxHp}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:12,color:"#2e7d32",width:16}}>◆</span>
            <div style={{flex:1,height:10,background:"rgba(8,18,8,0.85)",border:"1px solid #1a4a1a",borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${(stamina/maxStamina)*100}%`,height:"100%",background:`linear-gradient(90deg,#1a4a20,${stamina<20?"#aa4400":"#2e7d32"})`,borderRadius:2}}/>
            </div>
            <span style={{fontSize:9,color:stamina<20?"#cc6600":"#80a080",minWidth:36}}>{Math.floor(stamina)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10,color:"#c4a43e",width:16}}>★</span>
            <div style={{flex:1,height:6,background:"rgba(18,14,8,0.85)",border:"1px solid #3a3020",borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100,xpProgress)}%`,height:"100%",background:"linear-gradient(90deg,#5a4010,#c4a43e)",borderRadius:2}}/>
            </div>
            <span style={{fontSize:9,color:"#a09060",minWidth:36}}>Lv{level}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
            <span style={{fontSize:10,color:"#c4a43e"}}>●</span>
            <span style={{fontSize:9,color:"#c4a43e"}}>{gold}g</span>
            {skillPoints>0&&<span style={{fontSize:9,color:"#b388ff",marginLeft:8,animation:"pulse 1.5s infinite"}}>⬥ {skillPoints} SP [K]</span>}
          </div>
          {gameRef.current.combo>=2&&<div style={{marginTop:4,fontSize:11,color:"#ffa040",animation:"pulse 0.5s infinite",textShadow:"0 0 8px rgba(255,160,64,0.5)"}}>
            🔥 {gameRef.current.combo}x COMBO
          </div>}
          {activeUlt&&<div style={{marginTop:4,fontSize:9,color:activeUlt.type==="berserker"?"#ff4040":activeUlt.type==="ironwill"?"#40c080":"#b388ff",animation:"pulse 1.5s infinite"}}>
            {activeUlt.type==="berserker"?"⚔ BERSERKER RAGE":activeUlt.type==="ironwill"?"🛡 IRON WILL":"◈ SHADOW"} ({Math.ceil(activeUlt.timer/60)}s)
          </div>}
          {!activeUlt&&gameRef.current.ultCds&&Object.entries(gameRef.current.ultCds).some(([k,v])=>v>0&&getSkillBonuses().hasUlt[k])&&
            <div style={{marginTop:4,fontSize:8,color:"#5a5060"}}>[R] CD: {Math.ceil(Math.max(...Object.values(gameRef.current.ultCds||{}))/60)}s</div>
          }
          {/* Status Effects Display */}
          {statusEffects.length>0&&<div style={{display:"flex",gap:4,marginTop:6}}>
            {statusEffects.map((eff,i)=>(
              <div key={i} style={{
                width:24,height:24,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                background:eff.type==="poison"?"rgba(60,140,60,0.8)":eff.type==="venom"?"rgba(80,200,40,0.8)":eff.type==="burn"?"rgba(200,80,20,0.8)":eff.type==="freeze"?"rgba(60,120,180,0.8)":"rgba(180,40,40,0.8)",
                border:`1px solid ${eff.type==="poison"?"#80ff80":eff.type==="venom"?"#a0ff60":eff.type==="burn"?"#ffa040":eff.type==="freeze"?"#80c0ff":"#ff6060"}`,
                animation:"pulse 1s infinite",position:"relative"
              }}>
                {eff.type==="poison"?"☠":eff.type==="venom"?"🐍":eff.type==="burn"?"🔥":eff.type==="freeze"?"❄":"💧"}
                <span style={{position:"absolute",bottom:-2,right:-2,fontSize:7,color:"#fff",background:"#000",borderRadius:2,padding:"0 2px"}}>
                  {Math.ceil(eff.duration/60)}
                </span>
              </div>
            ))}
          </div>}
        </div>

        {/* Minimap */}
        <div style={{position:"absolute",top:10,right:10,border:`1px solid ${isTown?"#3a5a30":"#1a1528"}`,borderRadius:3,background:"rgba(5,5,10,0.88)",padding:3,zIndex:10}}>
          <div style={{fontSize:7,textAlign:"center",color:isTown?"#6a8a50":"#6a5080",marginBottom:2,letterSpacing:1}}>
            {phase==="town"?"ASHENMOOR":phase==="forest"?"DARKWOOD":phase==="cave"?"CAVES":phase==="graveyard"?"GRAVEYARD":phase==="desert"?"DESERT":phase==="crypt"?"CATACOMBS":"RUINS"}
          </div>
          <canvas ref={minimapRef} width={120} height={160} style={{display:"block",imageRendering:"pixelated",maxHeight:160}}/>
          <div style={{fontSize:7,textAlign:"center",color:"#5a5060",marginTop:2}}>[Tab] Menu · [M] Map</div>
        </div>

        {/* Hotbar */}
        <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:3,background:"rgba(6,4,12,0.9)",padding:"5px 8px",borderRadius:4,border:"1px solid #1a1528",zIndex:10}}>
          {hotbar.map((item,i)=>(
            <div key={i} onClick={()=>{setHotbarSlot(i);if(item&&item.type==="consumable")usePotion(i);}} style={{
              width:44,height:44,background:i===hotbarSlot?"rgba(139,92,246,0.2)":"rgba(14,12,22,0.85)",
              border:`2px solid ${i===hotbarSlot?"#8b5cf6":"#0e0c18"}`,borderRadius:4,cursor:"pointer",
              position:"relative",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",
            }}>
              {item&&<canvas width={32} height={32} ref={el=>{if(el){const c=el.getContext("2d");c.clearRect(0,0,32,32);drawItemIcon(c,item.icon,2,2,28);}}} style={{imageRendering:"pixelated"}}/>}
              <span style={{position:"absolute",top:1,left:3,fontSize:8,color:i===hotbarSlot?"#b388ff":"#3a3048"}}>{i+1}</span>
              {item?.count>1&&<span style={{position:"absolute",bottom:1,right:3,fontSize:8,color:"#d4c5a9"}}>{item.count}</span>}
            </div>
          ))}
        </div>

        <div style={{position:"absolute",bottom:68,left:10,fontSize:8,color:"rgba(100,90,80,0.5)",lineHeight:1.6,zIndex:10}}>
          WASD Move · Shift Sprint · Click Attack · Space Dodge · [E] Interact · [R] Ultimate · F5 Save · F9 Load
        </div>

        {/* Kill notifications */}
        <div style={{position:"absolute",top:"40%",right:20,zIndex:20,pointerEvents:"none"}}>
          {killNotifs.map(n=>(
            <div key={n.id} style={{background:"rgba(6,4,10,0.85)",border:"1px solid #4a2020",padding:"4px 12px",borderRadius:3,marginBottom:4,animation:"fadeSlideUp 2.5s forwards"}}>
              <div style={{fontSize:11,color:"#e04040",fontWeight:"bold"}}>✦ {n.name} slain</div>
              <div style={{fontSize:10,color:"#c4a43e"}}>+{n.xp} XP</div>
            </div>
          ))}
        </div>

        {notification&&<div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",background:"rgba(6,4,10,0.92)",border:"1px solid rgba(196,164,62,0.4)",padding:"10px 28px",borderRadius:4,fontSize:13,letterSpacing:1,color:"#c4a43e",textAlign:"center",pointerEvents:"none",zIndex:20}}>{notification}</div>}

        {nearNpc&&!dialogue&&!npcDead&&!isTown&&(
          <div style={{position:"absolute",bottom:68,left:"50%",transform:"translateX(-50%)",background:"rgba(6,4,12,0.9)",border:"1px solid #1a3050",padding:"4px 14px",borderRadius:3,fontSize:11,color:"#90caf9",zIndex:10}}>
            <span style={{color:"#5a5060"}}>[E]</span> Speak with the dying knight
          </div>
        )}

        {nearRelic&&!isTown&&(
          <div style={{position:"absolute",bottom:68,left:"50%",transform:"translateX(-50%)",background:"rgba(6,4,12,0.9)",border:"1px solid #c4a43e",padding:"4px 14px",borderRadius:3,fontSize:11,color:"#c4a43e",zIndex:10}}>
            <span style={{color:"#5a5060"}}>[E]</span> Take the Ashen Relic
          </div>
        )}

        {nearBonfire&&!dialogue&&(
          <div style={{position:"absolute",bottom:68,left:"50%",transform:"translateX(-50%)",background:"rgba(6,4,12,0.9)",border:"1px solid #ff8040",padding:"4px 14px",borderRadius:3,fontSize:11,color:"#ff8040",zIndex:10}}>
            <span style={{color:"#5a5060"}}>[E]</span> Rest at Bonfire
          </div>
        )}

        {zoneExitInfo&&!dialogue&&(
          <div style={{position:"absolute",
            top:zoneExitInfo.dir==="south"?undefined:zoneExitInfo.dir==="north"?20:undefined,
            bottom:zoneExitInfo.dir==="south"?68:undefined,
            left:zoneExitInfo.dir==="west"?20:zoneExitInfo.dir==="east"?undefined:"50%",
            right:zoneExitInfo.dir==="east"?20:undefined,
            transform:zoneExitInfo.dir==="north"||zoneExitInfo.dir==="south"?"translateX(-50%)":"none",
            background:"rgba(6,4,12,0.85)",border:"1px solid #5a7090",padding:"6px 16px",borderRadius:4,fontSize:11,color:"#90b0d0",zIndex:10,textAlign:"center"}}>
            <div style={{fontSize:9,color:"#5a6080",marginBottom:2}}>
              {zoneExitInfo.dir==="north"?"↑":zoneExitInfo.dir==="south"?"↓":zoneExitInfo.dir==="east"?"→":"←"} EXIT
            </div>
            <div>{zoneExitInfo.label}</div>
          </div>
        )}

        {/* Dying Knight Dialogue */}
        {dialogue==="knight"&&(
          <div style={{position:"absolute",inset:0,background:"rgba(3,2,6,0.6)",display:"flex",flexDirection:"column",justifyContent:"flex-end",zIndex:30}}>
            <div style={{background:"rgba(8,6,14,0.97)",borderTop:"2px solid #4080b0",padding:0,display:"flex",minHeight:150}}>
              <div style={{width:120,minHeight:150,background:"#0a0810",borderRight:"2px solid #1a2a3a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 0"}}>
                <canvas width={80} height={88} ref={el=>{if(el){const c=el.getContext("2d");c.clearRect(0,0,80,88);drawPortrait(c,isDead?"dead":"alive",80,88);}}} style={{imageRendering:"pixelated",border:"1px solid #1a2a3a",borderRadius:2}}/>
                <div style={{fontSize:9,color:"#90caf9",marginTop:6,textAlign:"center"}}>The Dying Knight</div>
                {!isDead&&<div style={{fontSize:8,color:"#c62828",marginTop:2}}>⬤ Wounded</div>}
                {isDead&&<div style={{fontSize:8,color:"#5a5060",marginTop:2}}>✦ Departed</div>}
              </div>
              <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                <div>
                  {currentLine?.type==="action"&&<div style={{fontSize:11,color:"#5a5060",fontStyle:"italic",lineHeight:1.6}}>{currentLine.text}</div>}
                  {currentLine?.type==="speech"&&<div style={{fontSize:13,color:"#c8c0b0",lineHeight:1.7}}>"{currentLine.text}"</div>}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
                  <span style={{fontSize:9,color:"#3a3048"}}>{dialogueLine+1}/{DM_LINES.length}</span>
                  <span style={{fontSize:10,color:"#5a6080",animation:"pulse 1.5s infinite"}}>{dialogueLine<DM_LINES.length-1?"[Space/E] Continue ▸":"[Space/E] Close"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Town NPC Dialogue */}
        {dialogue==="town_npc"&&townNpcLine&&(
          <div style={{position:"absolute",inset:0,background:"rgba(3,2,6,0.5)",display:"flex",flexDirection:"column",justifyContent:"flex-end",zIndex:30}}>
            <div style={{background:"rgba(8,6,14,0.97)",borderTop:"2px solid #50a878",padding:0,display:"flex",minHeight:130}}>
              <div style={{width:120,minHeight:130,background:"#0a0810",borderRight:"2px solid #1a3a2a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 0"}}>
                <div style={{width:60,height:60,background:townNpcLine.tunic,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #1a3a2a"}}>
                  <div style={{fontSize:24}}>👤</div>
                </div>
                <div style={{fontSize:9,color:"#90caf9",marginTop:6,textAlign:"center"}}>{townNpcLine.name}</div>
                <div style={{fontSize:7,color:"#5a8060",marginTop:1}}>{townNpcLine.title}</div>
              </div>
              <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                <div style={{fontSize:13,color:"#c8c0b0",lineHeight:1.7}}>"{townNpcLine.lines[dialogueLine]}"</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <span style={{fontSize:9,color:"#3a3048"}}>{dialogueLine+1}/{townNpcLine.lines.length}</span>
                  <span style={{fontSize:10,color:"#5a8060",animation:"pulse 1.5s infinite"}}>{dialogueLine<townNpcLine.lines.length-1?"[Space/E] Continue ▸":"[Space/E] Close"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === TAB MENU === */}
        {menuTab&&(
          <div style={{position:"absolute",inset:0,background:"rgba(3,2,8,0.94)",display:"flex",flexDirection:"column",zIndex:40}}>
            {/* Tab bar */}
            <div style={{display:"flex",background:"rgba(10,8,16,0.98)",borderBottom:"1px solid #1a1528",padding:"0 12px"}}>
              {[["character","Character"],["inventory","Inventory [I]"],["skills","Skills [K]"],["quests","Quests [Q]"],["map","Map [M]"]].map(([id,label])=>(
                <button key={id} onClick={()=>setMenuTab(id)} style={S.tabBtn(menuTab===id)}>{label}</button>
              ))}
              <div style={{flex:1}}/>
              <button onClick={()=>setMenuTab(null)} style={{...S.tabBtn(false),color:"#8a6060"}}>✕ Close [Esc]</button>
            </div>

            <div style={{flex:1,overflow:"auto",padding:16}}>
              {/* CHARACTER TAB */}
              {menuTab==="character"&&(
                <div style={{display:"flex",gap:20}}>
                  <div style={{...S.panel,width:220}}>
                    <div style={{fontSize:14,color:"#c4a43e",marginBottom:12,letterSpacing:2}}>CHARACTER</div>
                    <div style={{fontSize:11,color:"#b0a890",marginBottom:6}}>Level {level} Wanderer</div>
                    <div style={{fontSize:10,color:"#8a8070",marginBottom:4}}>XP: {xp} · Kills: {killCount}</div>
                    <div style={{fontSize:10,color:"#c4a43e",marginBottom:12}}>Gold: {gold}g</div>
                    <div style={{borderTop:"1px solid #1a1528",paddingTop:10}}>
                      <div style={{fontSize:10,color:"#a08080",marginBottom:4}}>♥ Health: {Math.floor(health)}/{effectiveMaxHp}</div>
                      <div style={{fontSize:10,color:"#80a080",marginBottom:4}}>◆ Stamina: {Math.floor(stamina)}/{maxStamina}</div>
                      <div style={{fontSize:10,color:"#c0a080",marginBottom:4}}>⚔ Attack: {totalDmg}</div>
                      <div style={{fontSize:10,color:"#80a0c0",marginBottom:4}}>🛡 Defense: {totalDef}</div>
                      {Object.keys(skills).length>0&&(
                        <div style={{borderTop:"1px solid #1a1528",paddingTop:8,marginTop:8}}>
                          <div style={{fontSize:9,color:"#b388ff",marginBottom:4}}>Skills Unlocked: {Object.keys(skills).length}</div>
                          {(()=>{const sb=getSkillBonuses();return(<>
                            {sb.dmgMult>0&&<div style={{fontSize:8,color:"#c06060"}}>+{Math.round(sb.dmgMult*100)}% damage</div>}
                            {sb.critChance>0&&<div style={{fontSize:8,color:"#c0a060"}}>{Math.round(sb.critChance*100)}% crit chance</div>}
                            {sb.speedMult>0&&<div style={{fontSize:8,color:"#60a0c0"}}>+{Math.round(sb.speedMult*100)}% speed</div>}
                            {sb.dodgeChance>0&&<div style={{fontSize:8,color:"#a080c0"}}>{Math.round(sb.dodgeChance*100)}% dodge</div>}
                            {sb.dmgReduce>0&&<div style={{fontSize:8,color:"#60c080"}}>{Math.round(sb.dmgReduce*100)}% dmg reduce</div>}
                            {sb.maxHpBonus>0&&<div style={{fontSize:8,color:"#c08080"}}>+{sb.maxHpBonus} max HP</div>}
                          </>);})()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{...S.panel,flex:1}}>
                    <div style={{fontSize:12,color:"#c4a43e",marginBottom:12,letterSpacing:2}}>EQUIPMENT</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {[["weapon","Weapon",equipped.weapon],["armor","Armor",equipped.armor],["relic","Relic",equipped.relic]].map(([slot,label,item])=>(
                        <div key={slot} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(14,12,22,0.6)",padding:8,borderRadius:4,border:"1px solid #1a1528"}}>
                          <div style={S.slotBox}>
                            {item&&<canvas width={36} height={36} ref={el=>{if(el){const c=el.getContext("2d");c.clearRect(0,0,36,36);drawItemIcon(c,item.icon,4,4,28);}}} style={{imageRendering:"pixelated"}}/>}
                            <span style={{position:"absolute",top:2,left:4,fontSize:7,color:"#5a5060"}}>{label}</span>
                          </div>
                          <div>
                            <div style={{fontSize:11,color:item?"#c8c0b0":"#3a3048"}}>{item?item.name:"— Empty —"}</div>
                            {item&&<div style={{fontSize:9,color:"#5a5060"}}>{item.desc}</div>}
                            {item?.stats?.dmg?<div style={{fontSize:9,color:"#c0a060"}}>+{item.stats.dmg} DMG</div>:null}
                            {item?.stats?.def?<div style={{fontSize:9,color:"#60a0c0"}}>+{item.stats.def} DEF</div>:null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* INVENTORY TAB */}
              {menuTab==="inventory"&&(
                <div style={S.panel}>
                  <div style={{fontSize:14,color:"#c4a43e",marginBottom:16,letterSpacing:2}}>INVENTORY</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                    {hotbar.filter(Boolean).map((item,i)=>(
                      <div key={i} style={{background:"rgba(14,12,22,0.85)",border:"1px solid #1a1528",borderRadius:4,padding:8,cursor:"pointer",transition:"all 0.15s"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#3a2a5a"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1528"}>
                        <div style={{display:"flex",justifyContent:"center",marginBottom:6}}>
                          <canvas width={36} height={36} ref={el=>{if(el){const c=el.getContext("2d");c.clearRect(0,0,36,36);drawItemIcon(c,item.icon,4,4,28);}}} style={{imageRendering:"pixelated"}}/>
                        </div>
                        <div style={{fontSize:9,color:"#b0a890",textAlign:"center"}}>{item.name}</div>
                        <div style={{fontSize:8,color:"#5a5060",textAlign:"center"}}>{item.type}{item.count>1?` (${item.count})`:""}</div>
                        {item.desc&&<div style={{fontSize:7,color:"#3a3548",textAlign:"center",marginTop:3,fontStyle:"italic"}}>{item.desc}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* QUESTS TAB */}
              {menuTab==="quests"&&(
                <div style={S.panel}>
                  <div style={{fontSize:14,color:"#c4a43e",marginBottom:16,letterSpacing:2}}>QUEST LOG</div>
                  {activeQuests.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,color:"#c4a43e",marginBottom:8,borderBottom:"1px solid #2a2020",paddingBottom:4}}>— Active Quests —</div>
                      {activeQuests.map(q=>(
                        <div key={q.id} style={{background:"rgba(14,12,22,0.6)",border:"1px solid #3a2a1a",borderRadius:4,padding:10,marginBottom:6}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:12,color:"#e0d0a0",fontWeight:"bold"}}>{q.category==="main"?"⬥ ":"◇ "}{q.name}</div><span style={{fontSize:9,color:"#c4a43e"}}>{q.gold>0?`+${q.gold}g`:""}{q.reward?` + ${ITEMS[q.reward]?.name||"item"}`:""}</span></div>
                          <div style={{fontSize:9,color:"#8a7a60",marginTop:2}}>From: {q.giver}</div>
                          <div style={{fontSize:10,color:"#a09880",marginTop:4}}>{q.desc}</div>
                          <div style={{marginTop:6}}>
                            {q.objectives.map((obj,i)=>(
                              <div key={i} style={{fontSize:9,color:q.status==="complete"?"#50a850":"#6a6050",marginBottom:2}}>
                                {q.status==="complete"?"☑":"☐"} {obj}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableQuests.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,color:"#5a8060",marginBottom:8,borderBottom:"1px solid #1a2a1a",paddingBottom:4}}>— Available Quests —</div>
                      {availableQuests.map(q=>(
                        <div key={q.id} style={{background:"rgba(14,12,22,0.4)",border:"1px solid #1a2a1a",borderRadius:4,padding:10,marginBottom:6}}>
                          <div style={{fontSize:12,color:"#90b080"}}>◇ {q.name}</div>
                          <div style={{fontSize:9,color:"#5a7050",marginTop:2}}>From: {q.giver}</div>
                          <div style={{fontSize:10,color:"#6a8060",marginTop:4}}>{q.desc}</div>
                          <div style={{fontSize:9,color:"#4a5a40",marginTop:4,fontStyle:"italic"}}>Speak to {q.giver} to begin this quest.</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {completeQuests.length>0&&(
                    <div>
                      <div style={{fontSize:11,color:"#5a5060",marginBottom:8,borderBottom:"1px solid #1a1528",paddingBottom:4}}>— Completed —</div>
                      {completeQuests.map(q=>(
                        <div key={q.id} style={{background:"rgba(14,12,22,0.3)",border:"1px solid #1a1528",borderRadius:4,padding:8,marginBottom:4,opacity:0.7}}>
                          <div style={{fontSize:11,color:"#8a8070"}}>✓ {q.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeQuests.length===0&&availableQuests.length===0&&completeQuests.length===0&&(
                    <div style={{fontSize:11,color:"#3a3048",textAlign:"center",padding:20}}>No quests yet. Explore the world to find them.</div>
                  )}
                </div>
              )}

              {/* MAP TAB */}
              {menuTab==="map"&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{fontSize:13,color:"#c4a43e",marginBottom:8,letterSpacing:3}}>── {isTown?"ASHENMOOR":phase==="forest"?"THE DARKWOOD":phase==="cave"?"HOLLOW CAVES":"THE ASHEN CITY"} ──</div>
                  <canvas ref={el=>{
                    if(!el)return;const mctx=el.getContext("2d"),g=gameRef.current;
                    const md=isTown?townData.current:phase==="forest"?forestData.current:phase==="cave"?caveData.current:phase==="crypt"?cryptData.current:ruinData.current;const s=6;
                    el.width=md.w*s;el.height=md.h*s;
                    mctx.fillStyle=isTown?"#1a3018":"#06060a";mctx.fillRect(0,0,md.w*s,md.h*s);
                    for(let y=0;y<md.h;y++)for(let x=0;x<md.w;x++){mctx.fillStyle=getTileColor(md.map[y][x]);mctx.fillRect(x*s,y*s,s,s);}
                    const ppx=Math.floor(g.player.x/TILE),ppy=Math.floor(g.player.y/TILE);
                    mctx.fillStyle="#e8e040";mctx.fillRect(ppx*s-2,ppy*s-2,s+4,s+4);
                    mctx.fillStyle="#fff";mctx.font="bold 10px monospace";mctx.fillText("YOU",ppx*s-4,ppy*s-6);
                    if(isTown){townNPCs.current.forEach(n=>{const nx=Math.floor(n.x/TILE),ny=Math.floor(n.y/TILE);mctx.fillStyle="#50c878";mctx.fillRect(nx*s,ny*s,s+2,s+2);mctx.fillStyle="#90e0b0";mctx.font="bold 8px monospace";mctx.fillText(n.name,nx*s+s+4,ny*s+s);});}
                  }} style={{border:"1px solid #1a1528",borderRadius:4,maxWidth:"100%",maxHeight:"70vh"}}/>
                  <div style={{fontSize:9,color:"#5a5060",marginTop:8}}><span style={{color:"#e8e040"}}>■</span> You{isTown?<> · <span style={{color:"#50c878"}}>■</span> NPCs</>:""}</div>
                </div>
              )}

              {/* SKILL TREE TAB */}
              {menuTab==="skills"&&(
                <div style={S.panel}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={{fontSize:14,color:"#c4a43e",letterSpacing:2}}>SKILL TREE</div>
                    <div style={{display:"flex",gap:16,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#c4a43e"}}>Level {level}</span>
                      <span style={{fontSize:11,color:"#b388ff"}}>⬥ {skillPoints} Skill Points</span>
                      <div style={{width:120,height:6,background:"rgba(18,14,8,0.85)",border:"1px solid #3a3020",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${xpProgress}%`,height:"100%",background:"linear-gradient(90deg,#5a4010,#c4a43e)",borderRadius:3}}/>
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                    {Object.entries(SKILL_TREE).map(([pathId,path])=>(
                      <div key={pathId} style={{background:"rgba(14,12,22,0.6)",border:`1px solid ${path.color}30`,borderRadius:6,padding:12}}>
                        <div style={{textAlign:"center",marginBottom:10}}>
                          <span style={{fontSize:18}}>{path.icon}</span>
                          <div style={{fontSize:12,color:path.color,fontWeight:"bold",marginTop:4}}>{path.name}</div>
                          <div style={{fontSize:8,color:"#5a5060",marginTop:2}}>{path.desc}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {path.skills.map(skill=>{
                            const unlocked=skills[skill.id];
                            const canGet=canUnlockSkill(skill);
                            const locked=!unlocked&&!canGet;
                            const reqMet=!skill.requires||skills[skill.requires];
                            return(
                              <div key={skill.id} onClick={()=>canGet&&unlockSkill(skill)}
                                style={{
                                  background:unlocked?`${path.color}18`:"rgba(10,8,16,0.8)",
                                  border:`1px solid ${unlocked?path.color:canGet?"#c4a43e50":"#1a1528"}`,
                                  borderRadius:4,padding:"6px 8px",cursor:canGet?"pointer":"default",
                                  opacity:locked&&!reqMet?0.4:1,transition:"all 0.15s",
                                  position:"relative",
                                }}>
                                {skill.isUltimate&&<div style={{position:"absolute",top:-1,right:6,fontSize:7,color:path.color,letterSpacing:1}}>★ ULTIMATE</div>}
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <span style={{fontSize:10,color:unlocked?path.color:"#b0a890",fontWeight:unlocked?"bold":"normal"}}>{unlocked?"✓ ":""}{skill.name}</span>
                                  {!unlocked&&<span style={{fontSize:8,color:canGet?"#c4a43e":"#3a3048"}}>{skill.cost} SP</span>}
                                </div>
                                <div style={{fontSize:8,color:unlocked?"#8a8070":"#5a5060",marginTop:2}}>{skill.desc}</div>
                                {!reqMet&&skill.requires&&<div style={{fontSize:7,color:"#5a3030",marginTop:2}}>Requires: {path.skills.find(s=>s.id===skill.requires)?.name}</div>}
                                {/* Connector line */}
                                {skill.tier>1&&<div style={{position:"absolute",top:-7,left:"50%",width:1,height:7,background:unlocked?path.color:"#1a1528"}}/>}
                              </div>
                            );
                          })}
                        </div>
                        {/* Ultimate activation hint */}
                        {skills[path.skills[path.skills.length-1].id]&&(
                          <div style={{textAlign:"center",marginTop:8,fontSize:9,color:path.color,padding:"4px 0",borderTop:`1px solid ${path.color}30`}}>
                            Press [R] to activate
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shop UI */}
        {shopOpen&&(()=>{
          const npc=townNPCs.current.find(n=>n.id===shopOpen);
          if(!npc||!npc.shop)return null;
          return(
            <div style={{position:"absolute",inset:0,background:"rgba(3,2,8,0.94)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:45}}>
              <div style={{background:"rgba(10,8,16,0.98)",border:"1px solid #4a6a6a",borderRadius:8,padding:20,minWidth:320}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,borderBottom:"1px solid #2a4a4a",paddingBottom:10}}>
                  <div>
                    <div style={{fontSize:14,color:"#4a8a8a",letterSpacing:2}}>{npc.name}'s Shop</div>
                    <div style={{fontSize:9,color:"#5a6a6a"}}>{npc.title}</div>
                  </div>
                  <div style={{fontSize:12,color:"#c4a43e"}}>● {gold}g</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {npc.shop.map((si,i)=>{
                    const item=ITEMS[si.item];
                    const canBuy=gold>=si.price&&si.stock>0;
                    return(
                      <div key={i} onClick={()=>canBuy&&buyItem(npc.id,si.item,si.price)}
                        style={{display:"flex",alignItems:"center",gap:12,background:canBuy?"rgba(40,80,80,0.3)":"rgba(20,20,30,0.5)",
                          border:`1px solid ${canBuy?"#4a8a8a":"#2a3a3a"}`,borderRadius:4,padding:10,cursor:canBuy?"pointer":"not-allowed",
                          opacity:si.stock<=0?0.4:1,transition:"all 0.15s"}}>
                        <canvas width={36} height={36} ref={el=>{if(el){const c=el.getContext("2d");c.clearRect(0,0,36,36);drawItemIcon(c,item.icon,4,4,28);}}} style={{imageRendering:"pixelated"}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,color:"#c8c0b0"}}>{item.name}</div>
                          <div style={{fontSize:8,color:"#6a6a6a"}}>{item.desc}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:12,color:gold>=si.price?"#c4a43e":"#8a4040"}}>{si.price}g</div>
                          <div style={{fontSize:8,color:si.stock>0?"#6a8a6a":"#8a4040"}}>{si.stock>0?`×${si.stock}`:"Sold out"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={()=>setShopOpen(null)} style={{marginTop:16,width:"100%",padding:"8px 16px",background:"rgba(60,50,40,0.5)",border:"1px solid #5a4a3a",borderRadius:4,color:"#a09080",fontSize:10,cursor:"pointer",fontFamily:"'Courier New',monospace"}}>Close [Esc]</button>
              </div>
            </div>
          );
        })()}
      </div>
      <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",fontSize:10,letterSpacing:5,color:"rgba(80,60,40,0.3)",textTransform:"uppercase",pointerEvents:"none"}}>
        Dark Hollows — {isTown?"Ashenmoor":phase==="forest"?"Darkwood":phase==="cave"?"Hollow Caves":"Prologue"}
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes fadeSlideUp{0%{opacity:1;transform:translateY(0)}70%{opacity:1;transform:translateY(-10px)}100%{opacity:0;transform:translateY(-30px)}}
      `}</style>
    </div>
  );
}
