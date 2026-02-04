// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — TILE RENDERING
// ═══════════════════════════════════════════════════════════════

import { TILE, getGFX } from '../constants/config.js';
import { T, TILE_COLORS } from '../data/tiles.js';

// Draw a single tile at the given position
export const drawTile = (ctx, tileType, x, y, ts, animFrame = 0) => {
  const GFX = getGFX();
  const color = TILE_COLORS[tileType] || "#1a1520";
  
  // Base color fill
  ctx.fillStyle = color;
  ctx.fillRect(x, y, ts, ts);
  
  // Detail rendering based on graphics quality
  if (GFX.tileDetail === 0) return; // Performance mode - no details
  
  switch (tileType) {
    // ═══════════════════════════════════════════════════════════════
    // BASIC TERRAIN
    // ═══════════════════════════════════════════════════════════════
    case T.COBBLE:
    case T.COBBLE_DARK:
    case T.COBBLE_CLEAN:
      drawCobblestone(ctx, x, y, ts, tileType === T.COBBLE_CLEAN);
      break;
      
    case T.WALL:
    case T.WALL_BROKEN:
      drawWall(ctx, x, y, ts, tileType === T.WALL_BROKEN);
      break;
      
    case T.GRASS:
    case T.GRASS_DARK:
      drawGrass(ctx, x, y, ts, tileType === T.GRASS_DARK);
      break;
      
    case T.DIRT:
      drawDirt(ctx, x, y, ts);
      break;
      
    case T.PATH:
      drawPath(ctx, x, y, ts);
      break;

    // ═══════════════════════════════════════════════════════════════
    // ANIMATED TILES
    // ═══════════════════════════════════════════════════════════════
    case T.TORCH_WALL:
      drawTorchWall(ctx, x, y, ts, animFrame);
      break;
      
    case T.EMBER_GROUND:
      drawEmberGround(ctx, x, y, ts, animFrame);
      break;
      
    case T.CAMP_FIRE:
    case T.BONFIRE:
      drawFire(ctx, x, y, ts, animFrame, tileType === T.BONFIRE);
      break;
      
    case T.WATER:
    case T.WATER_PUDDLE:
    case T.UNDERGROUND_WATER:
      drawWater(ctx, x, y, ts, animFrame);
      break;
      
    case T.MUSHROOM:
      drawMushroom(ctx, x, y, ts, animFrame);
      break;
      
    case T.CRYSTAL:
      drawCrystal(ctx, x, y, ts, animFrame);
      break;
      
    case T.SOUL_FLAME:
      drawSoulFlame(ctx, x, y, ts, animFrame);
      break;

    // ═══════════════════════════════════════════════════════════════
    // STRUCTURES
    // ═══════════════════════════════════════════════════════════════
    case T.PILLAR:
    case T.PILLAR_BROKEN:
      drawPillar(ctx, x, y, ts, tileType === T.PILLAR_BROKEN);
      break;
      
    case T.TREE:
    case T.DENSE_TREE:
      drawTree(ctx, x, y, ts, tileType === T.DENSE_TREE);
      break;
      
    case T.DOOR:
    case T.DOOR_BROKEN:
    case T.DOOR_CLOSED:
      drawDoor(ctx, x, y, ts, tileType);
      break;
      
    case T.JAR:
      drawJar(ctx, x, y, ts);
      break;
      
    case T.BARREL:
      drawBarrel(ctx, x, y, ts);
      break;
      
    case T.TREASURE_CHEST:
    case T.LOCKED_CHEST:
      drawChest(ctx, x, y, ts, tileType === T.LOCKED_CHEST);
      break;

    // ═══════════════════════════════════════════════════════════════
    // CAVE TILES
    // ═══════════════════════════════════════════════════════════════
    case T.CAVE_FLOOR:
      drawCaveFloor(ctx, x, y, ts);
      break;
      
    case T.CAVE_WALL:
      drawCaveWall(ctx, x, y, ts);
      break;
      
    case T.STALACTITE:
      drawStalactite(ctx, x, y, ts);
      break;
      
    case T.SPIDER_WEB:
      drawSpiderWeb(ctx, x, y, ts);
      break;

    // ═══════════════════════════════════════════════════════════════
    // CRYPT TILES
    // ═══════════════════════════════════════════════════════════════
    case T.CRYPT_FLOOR:
      drawCryptFloor(ctx, x, y, ts);
      break;
      
    case T.CRYPT_WALL:
      drawCryptWall(ctx, x, y, ts);
      break;
      
    case T.SARCOPHAGUS:
      drawSarcophagus(ctx, x, y, ts);
      break;
      
    case T.TOMB:
      drawTomb(ctx, x, y, ts);
      break;
      
    case T.COFFIN:
      drawCoffin(ctx, x, y, ts);
      break;

    // ═══════════════════════════════════════════════════════════════
    // DESERT TILES
    // ═══════════════════════════════════════════════════════════════
    case T.SAND:
    case T.SAND_DARK:
      drawSand(ctx, x, y, ts, tileType === T.SAND_DARK);
      break;
      
    case T.DUNE:
      drawDune(ctx, x, y, ts);
      break;
      
    case T.CACTUS:
      drawCactus(ctx, x, y, ts);
      break;
      
    case T.OASIS:
      drawOasis(ctx, x, y, ts, animFrame);
      break;

    // ═══════════════════════════════════════════════════════════════
    // GRAVEYARD TILES
    // ═══════════════════════════════════════════════════════════════
    case T.GRAVESTONE:
      drawGravestone(ctx, x, y, ts);
      break;
      
    case T.GRAVE_DIRT:
    case T.DEAD_GRASS:
      drawDeadGround(ctx, x, y, ts, tileType === T.GRAVE_DIRT);
      break;

    // ═══════════════════════════════════════════════════════════════
    // ICE BIOME TILES
    // ═══════════════════════════════════════════════════════════════
    case T.SNOW:
    case T.SNOW_DEEP:
      drawSnow(ctx, x, y, ts, tileType === T.SNOW_DEEP);
      break;
      
    case T.ICE_FLOOR:
    case T.FROZEN_LAKE:
      drawIceFloor(ctx, x, y, ts);
      break;
      
    case T.ICE_WALL:
      drawIceWall(ctx, x, y, ts);
      break;
      
    case T.ICE_CRYSTAL:
    case T.AURORA_STONE:
      drawIceCrystal(ctx, x, y, ts, animFrame, tileType === T.AURORA_STONE);
      break;
      
    case T.FROST_VENT:
      drawFrostVent(ctx, x, y, ts, animFrame);
      break;
      
    case T.FROZEN_TREE:
      drawFrozenTree(ctx, x, y, ts);
      break;
      
    case T.ICICLE:
    case T.ICE_STALAGMITE:
      drawIcicle(ctx, x, y, ts);
      break;

    // ═══════════════════════════════════════════════════════════════
    // VOLCANIC BIOME TILES
    // ═══════════════════════════════════════════════════════════════
    case T.VOLCANIC_ROCK:
    case T.BASALT:
    case T.COOLED_LAVA:
      drawVolcanicRock(ctx, x, y, ts);
      break;
      
    case T.MAGMA:
    case T.LAVA_FLOW:
      drawMagma(ctx, x, y, ts, animFrame);
      break;
      
    case T.OBSIDIAN:
      drawObsidian(ctx, x, y, ts);
      break;
      
    case T.VOLCANIC_VENT:
    case T.SMOKE_VENT:
      drawVolcanicVent(ctx, x, y, ts, animFrame);
      break;
      
    case T.FIRE_GEYSER:
      drawFireGeyser(ctx, x, y, ts, animFrame);
      break;
      
    case T.ASH_GROUND:
      drawAshGround(ctx, x, y, ts);
      break;
      
    case T.EMBER_CRYSTAL:
    case T.FLAME_PILLAR:
      drawEmberCrystal(ctx, x, y, ts, animFrame);
      break;
      
    case T.SULFUR_POOL:
      drawSulfurPool(ctx, x, y, ts, animFrame);
      break;
      
    default:
      // Just use the base color for unknown tiles
      break;
  }
};

// ═══════════════════════════════════════════════════════════════
// TILE DRAWING HELPERS
// ═══════════════════════════════════════════════════════════════

const drawCobblestone = (ctx, x, y, ts, isClean) => {
  ctx.fillStyle = isClean ? "#5a5048" : "#1a1512";
  for (let i = 0; i < 4; i++) {
    const ox = (i % 2) * ts * 0.5 + Math.random() * 4;
    const oy = Math.floor(i / 2) * ts * 0.5 + Math.random() * 4;
    ctx.fillRect(x + ox, y + oy, ts * 0.4, ts * 0.4);
  }
};

const drawWall = (ctx, x, y, ts, isBroken) => {
  ctx.fillStyle = isBroken ? "#100c14" : "#141018";
  ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(x + ts * 0.4, y, 2, ts);
  ctx.fillRect(x, y + ts * 0.5, ts, 2);
  if (isBroken) {
    ctx.fillStyle = "#0a0810";
    ctx.fillRect(x + ts * 0.6, y + ts * 0.3, ts * 0.3, ts * 0.4);
  }
};

const drawGrass = (ctx, x, y, ts, isDark) => {
  ctx.fillStyle = isDark ? "#163010" : "#1e4018";
  for (let i = 0; i < 6; i++) {
    const gx = x + Math.random() * ts;
    const gy = y + ts - Math.random() * 8;
    ctx.fillRect(gx, gy, 1, -3 - Math.random() * 4);
  }
};

const drawDirt = (ctx, x, y, ts) => {
  ctx.fillStyle = "#3a2a18";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + Math.random() * ts, y + Math.random() * ts, 2 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawPath = (ctx, x, y, ts) => {
  ctx.fillStyle = "#6a5a40";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + Math.random() * ts * 0.8, y + Math.random() * ts * 0.8, 4, 4);
  }
};

const drawTorchWall = (ctx, x, y, ts, frame) => {
  ctx.fillStyle = "#2a1a18";
  ctx.fillRect(x + ts * 0.35, y + ts * 0.3, ts * 0.3, ts * 0.5);
  // Flame
  const flicker = Math.sin(frame * 0.3) * 2;
  ctx.fillStyle = `rgb(255,${160 + flicker * 10},${80 + flicker * 5})`;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.25 + flicker, 6 + Math.sin(frame * 0.5) * 2, 0, Math.PI * 2);
  ctx.fill();
};

const drawEmberGround = (ctx, x, y, ts, frame) => {
  for (let i = 0; i < 3; i++) {
    const ex = x + (i * 13 + frame * 0.5) % ts;
    const ey = y + ((i * 17 + frame * 0.3) % ts);
    const alpha = 0.3 + Math.sin(frame * 0.2 + i) * 0.2;
    ctx.fillStyle = `rgba(255,100,30,${alpha})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 2, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawFire = (ctx, x, y, ts, frame, isBonfire) => {
  const size = isBonfire ? 1.5 : 1;
  // Base logs
  ctx.fillStyle = "#3a2a14";
  ctx.fillRect(x + ts * 0.2, y + ts * 0.7, ts * 0.6, ts * 0.15);
  // Flames
  for (let i = 0; i < 3; i++) {
    const fx = x + ts * 0.3 + i * ts * 0.2;
    const fy = y + ts * 0.6 - Math.sin(frame * 0.4 + i) * 4 * size;
    const fh = 12 + Math.sin(frame * 0.3 + i * 2) * 4;
    ctx.fillStyle = i === 1 ? "#ff8040" : "#ffa060";
    ctx.beginPath();
    ctx.moveTo(fx, y + ts * 0.7);
    ctx.quadraticCurveTo(fx + 4, fy, fx, fy - fh * size);
    ctx.quadraticCurveTo(fx - 4, fy, fx, y + ts * 0.7);
    ctx.fill();
  }
};

const drawWater = (ctx, x, y, ts, frame) => {
  ctx.fillStyle = "#1a3a50";
  ctx.fillRect(x, y, ts, ts);
  // Ripples
  const ripple = Math.sin(frame * 0.1) * 2;
  ctx.strokeStyle = "rgba(100,150,200,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts / 2, 8 + ripple, 0, Math.PI * 2);
  ctx.stroke();
};

const drawMushroom = (ctx, x, y, ts, frame) => {
  // Stem
  ctx.fillStyle = "#c0b8a0";
  ctx.fillRect(x + ts * 0.4, y + ts * 0.5, ts * 0.2, ts * 0.4);
  // Cap
  const glow = Math.sin(frame * 0.1) * 0.2 + 0.8;
  ctx.fillStyle = `rgba(100,180,200,${glow})`;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.45, ts * 0.3, Math.PI, 0);
  ctx.fill();
};

const drawCrystal = (ctx, x, y, ts, frame) => {
  const glow = Math.sin(frame * 0.1) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(80,120,200,${glow})`;
  ctx.beginPath();
  ctx.moveTo(x + ts / 2, y + ts * 0.1);
  ctx.lineTo(x + ts * 0.7, y + ts * 0.8);
  ctx.lineTo(x + ts * 0.3, y + ts * 0.8);
  ctx.closePath();
  ctx.fill();
};

const drawSoulFlame = (ctx, x, y, ts, frame) => {
  const flicker = Math.sin(frame * 0.3) * 3;
  ctx.fillStyle = `rgba(60,100,180,${0.6 + Math.sin(frame * 0.2) * 0.2})`;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.4 + flicker, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(100,150,220,0.4)`;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.4, 6, 0, Math.PI * 2);
  ctx.fill();
};

const drawPillar = (ctx, x, y, ts, isBroken) => {
  ctx.fillStyle = "#2a2530";
  if (isBroken) {
    ctx.fillRect(x + ts * 0.25, y + ts * 0.4, ts * 0.5, ts * 0.6);
    ctx.fillStyle = "#1a1520";
    ctx.fillRect(x + ts * 0.3, y + ts * 0.35, ts * 0.15, ts * 0.15);
  } else {
    ctx.fillRect(x + ts * 0.25, y, ts * 0.5, ts);
    ctx.fillStyle = "#1a1520";
    ctx.fillRect(x + ts * 0.2, y, ts * 0.6, 4);
    ctx.fillRect(x + ts * 0.2, y + ts - 4, ts * 0.6, 4);
  }
};

const drawTree = (ctx, x, y, ts, isDense) => {
  // Trunk
  ctx.fillStyle = "#3a2818";
  ctx.fillRect(x + ts * 0.4, y + ts * 0.5, ts * 0.2, ts * 0.5);
  // Canopy
  ctx.fillStyle = isDense ? "#0a2008" : "#1a3812";
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.35, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
};

const drawDoor = (ctx, x, y, ts, type) => {
  ctx.fillStyle = type === T.DOOR_CLOSED ? "#4a3018" : "#3a2010";
  ctx.fillRect(x + ts * 0.15, y + ts * 0.1, ts * 0.7, ts * 0.85);
  if (type !== T.DOOR_BROKEN) {
    ctx.fillStyle = "#2a1a08";
    ctx.fillRect(x + ts * 0.2, y + ts * 0.2, ts * 0.25, ts * 0.3);
    ctx.fillRect(x + ts * 0.55, y + ts * 0.2, ts * 0.25, ts * 0.3);
    // Handle
    ctx.fillStyle = "#6a5a40";
    ctx.beginPath();
    ctx.arc(x + ts * 0.75, y + ts * 0.55, 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawJar = (ctx, x, y, ts) => {
  ctx.fillStyle = "#6a5040";
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.35, y + ts * 0.3);
  ctx.lineTo(x + ts * 0.3, y + ts * 0.8);
  ctx.lineTo(x + ts * 0.7, y + ts * 0.8);
  ctx.lineTo(x + ts * 0.65, y + ts * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5a4030";
  ctx.fillRect(x + ts * 0.38, y + ts * 0.2, ts * 0.24, ts * 0.12);
};

const drawBarrel = (ctx, x, y, ts) => {
  ctx.fillStyle = "#5a4028";
  ctx.fillRect(x + ts * 0.2, y + ts * 0.15, ts * 0.6, ts * 0.7);
  ctx.fillStyle = "#4a3018";
  ctx.fillRect(x + ts * 0.15, y + ts * 0.25, ts * 0.7, 4);
  ctx.fillRect(x + ts * 0.15, y + ts * 0.65, ts * 0.7, 4);
};

const drawChest = (ctx, x, y, ts, isLocked) => {
  ctx.fillStyle = "#5a4020";
  ctx.fillRect(x + ts * 0.15, y + ts * 0.35, ts * 0.7, ts * 0.5);
  ctx.fillStyle = "#4a3018";
  ctx.fillRect(x + ts * 0.15, y + ts * 0.25, ts * 0.7, ts * 0.15);
  // Lock/clasp
  ctx.fillStyle = isLocked ? "#c4a43e" : "#6a5a40";
  ctx.fillRect(x + ts * 0.45, y + ts * 0.45, ts * 0.1, ts * 0.15);
};

// Cave tiles
const drawCaveFloor = (ctx, x, y, ts) => {
  ctx.fillStyle = "#12101a";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + Math.random() * ts * 0.8, y + Math.random() * ts * 0.8, 3, 3);
  }
};

const drawCaveWall = (ctx, x, y, ts) => {
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = "#141018";
  ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
};

const drawStalactite = (ctx, x, y, ts) => {
  ctx.fillStyle = "#2a2838";
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.3, y);
  ctx.lineTo(x + ts * 0.4, y + ts * 0.7);
  ctx.lineTo(x + ts * 0.5, y);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.5, y);
  ctx.lineTo(x + ts * 0.55, y + ts * 0.5);
  ctx.lineTo(x + ts * 0.7, y);
  ctx.fill();
};

const drawSpiderWeb = (ctx, x, y, ts) => {
  ctx.strokeStyle = "rgba(200,200,200,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + ts, y + ts);
  ctx.moveTo(x + ts, y);
  ctx.lineTo(x, y + ts);
  ctx.moveTo(x + ts / 2, y);
  ctx.lineTo(x + ts / 2, y + ts);
  ctx.stroke();
};

// Crypt tiles
const drawCryptFloor = (ctx, x, y, ts) => {
  ctx.fillStyle = "#0c0a10";
  ctx.fillRect(x + ts * 0.1, y + ts * 0.1, ts * 0.8, ts * 0.8);
};

const drawCryptWall = (ctx, x, y, ts) => {
  ctx.fillStyle = "#080610";
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(x + ts * 0.4, y, 2, ts);
};

const drawSarcophagus = (ctx, x, y, ts) => {
  ctx.fillStyle = "#2a2838";
  ctx.fillRect(x + ts * 0.1, y + ts * 0.2, ts * 0.8, ts * 0.6);
  ctx.fillStyle = "#1a1828";
  ctx.fillRect(x + ts * 0.15, y + ts * 0.25, ts * 0.7, ts * 0.1);
};

const drawTomb = (ctx, x, y, ts) => {
  ctx.fillStyle = "#1a1828";
  ctx.fillRect(x + ts * 0.1, y + ts * 0.6, ts * 0.8, ts * 0.3);
  ctx.fillStyle = "#2a2838";
  ctx.fillRect(x + ts * 0.35, y + ts * 0.1, ts * 0.3, ts * 0.55);
};

const drawCoffin = (ctx, x, y, ts) => {
  ctx.fillStyle = "#3a2020";
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.3, y + ts * 0.1);
  ctx.lineTo(x + ts * 0.7, y + ts * 0.1);
  ctx.lineTo(x + ts * 0.8, y + ts * 0.3);
  ctx.lineTo(x + ts * 0.7, y + ts * 0.9);
  ctx.lineTo(x + ts * 0.3, y + ts * 0.9);
  ctx.lineTo(x + ts * 0.2, y + ts * 0.3);
  ctx.closePath();
  ctx.fill();
};

// Desert tiles
const drawSand = (ctx, x, y, ts, isDark) => {
  ctx.fillStyle = isDark ? "#a08060" : "#c4a878";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + Math.random() * ts * 0.8, y + Math.random() * ts * 0.8, 2, 2);
  }
};

const drawDune = (ctx, x, y, ts) => {
  ctx.fillStyle = "#b09060";
  ctx.beginPath();
  ctx.moveTo(x, y + ts);
  ctx.quadraticCurveTo(x + ts / 2, y + ts * 0.3, x + ts, y + ts);
  ctx.fill();
};

const drawCactus = (ctx, x, y, ts) => {
  ctx.fillStyle = "#4a6830";
  ctx.fillRect(x + ts * 0.4, y + ts * 0.2, ts * 0.2, ts * 0.7);
  ctx.fillRect(x + ts * 0.25, y + ts * 0.35, ts * 0.15, ts * 0.3);
  ctx.fillRect(x + ts * 0.6, y + ts * 0.45, ts * 0.15, ts * 0.25);
};

const drawOasis = (ctx, x, y, ts, frame) => {
  ctx.fillStyle = "#2060a0";
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts / 2, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Palm fronds
  ctx.fillStyle = "#306030";
  ctx.fillRect(x + ts * 0.45, y + ts * 0.1, ts * 0.1, ts * 0.3);
};

// Graveyard tiles
const drawGravestone = (ctx, x, y, ts) => {
  ctx.fillStyle = "#505860";
  ctx.fillRect(x + ts * 0.25, y + ts * 0.3, ts * 0.5, ts * 0.6);
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.35, ts * 0.25, Math.PI, 0);
  ctx.fill();
};

const drawDeadGround = (ctx, x, y, ts, isGrave) => {
  ctx.fillStyle = isGrave ? "#2a2820" : "#3a4030";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + Math.random() * ts * 0.8, y + Math.random() * ts * 0.8, 3, 3);
  }
};

// Ice biome tiles
const drawSnow = (ctx, x, y, ts, isDeep) => {
  ctx.fillStyle = isDeep ? "#c0d8e8" : "#d8e8f0";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + Math.random() * ts, y + Math.random() * ts, 1, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawIceFloor = (ctx, x, y, ts) => {
  ctx.fillStyle = "rgba(150,200,230,0.3)";
  ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
  ctx.strokeStyle = "rgba(200,230,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.2, y + ts * 0.3);
  ctx.lineTo(x + ts * 0.8, y + ts * 0.7);
  ctx.stroke();
};

const drawIceWall = (ctx, x, y, ts) => {
  ctx.fillStyle = "#5080a0";
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = "#6090b0";
  ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
};

const drawIceCrystal = (ctx, x, y, ts, frame, isAurora) => {
  const glow = Math.sin(frame * 0.1) * 0.3 + 0.7;
  const color = isAurora ? `rgba(100,200,180,${glow})` : `rgba(100,180,220,${glow})`;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + ts / 2, y + ts * 0.1);
  ctx.lineTo(x + ts * 0.7, y + ts * 0.5);
  ctx.lineTo(x + ts / 2, y + ts * 0.9);
  ctx.lineTo(x + ts * 0.3, y + ts * 0.5);
  ctx.closePath();
  ctx.fill();
};

const drawFrostVent = (ctx, x, y, ts, frame) => {
  ctx.fillStyle = "#8090a0";
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts / 2, ts * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Frost particles
  const pCount = Math.floor(frame * 0.1) % 4;
  for (let i = 0; i < pCount; i++) {
    ctx.fillStyle = `rgba(200,230,255,${0.5 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(x + ts / 2, y + ts * 0.3 - i * 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawFrozenTree = (ctx, x, y, ts) => {
  ctx.fillStyle = "#4080a0";
  ctx.fillRect(x + ts * 0.4, y + ts * 0.5, ts * 0.2, ts * 0.5);
  ctx.fillStyle = "#80b0d0";
  ctx.beginPath();
  ctx.moveTo(x + ts / 2, y + ts * 0.1);
  ctx.lineTo(x + ts * 0.75, y + ts * 0.5);
  ctx.lineTo(x + ts * 0.25, y + ts * 0.5);
  ctx.closePath();
  ctx.fill();
};

const drawIcicle = (ctx, x, y, ts) => {
  ctx.fillStyle = "#80c0e0";
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.4, y);
  ctx.lineTo(x + ts * 0.45, y + ts * 0.8);
  ctx.lineTo(x + ts * 0.55, y);
  ctx.fill();
};

// Volcanic biome tiles
const drawVolcanicRock = (ctx, x, y, ts) => {
  ctx.fillStyle = "#1a1010";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + Math.random() * ts * 0.8, y + Math.random() * ts * 0.8, 4, 4);
  }
};

const drawMagma = (ctx, x, y, ts, frame) => {
  const pulse = Math.sin(frame * 0.1) * 0.2 + 0.8;
  ctx.fillStyle = `rgba(255,80,20,${pulse})`;
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = `rgba(255,160,40,${pulse * 0.5})`;
  ctx.fillRect(x + ts * 0.2, y + ts * 0.2, ts * 0.6, ts * 0.6);
};

const drawObsidian = (ctx, x, y, ts) => {
  ctx.fillStyle = "#080810";
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = "#101018";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + ts * 0.5, y + ts * 0.3);
  ctx.lineTo(x, y + ts * 0.6);
  ctx.fill();
};

const drawVolcanicVent = (ctx, x, y, ts, frame) => {
  ctx.fillStyle = "#402010";
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts / 2, ts * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Smoke
  const smoke = (frame * 0.05) % 1;
  ctx.fillStyle = `rgba(80,80,80,${0.5 - smoke * 0.5})`;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.3 - smoke * 20, 5 + smoke * 5, 0, Math.PI * 2);
  ctx.fill();
};

const drawFireGeyser = (ctx, x, y, ts, frame) => {
  ctx.fillStyle = "#301810";
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts * 0.7, ts * 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Eruption
  const erupting = (Math.floor(frame / 60) % 3) === 0;
  if (erupting) {
    ctx.fillStyle = "#ff6030";
    ctx.beginPath();
    ctx.moveTo(x + ts * 0.4, y + ts * 0.6);
    ctx.lineTo(x + ts * 0.5, y + ts * 0.1);
    ctx.lineTo(x + ts * 0.6, y + ts * 0.6);
    ctx.fill();
  }
};

const drawAshGround = (ctx, x, y, ts) => {
  ctx.fillStyle = "#282020";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + Math.random() * ts, y + Math.random() * ts, 2, 2);
  }
};

const drawEmberCrystal = (ctx, x, y, ts, frame) => {
  const glow = Math.sin(frame * 0.15) * 0.3 + 0.7;
  ctx.fillStyle = `rgba(255,100,40,${glow})`;
  ctx.beginPath();
  ctx.moveTo(x + ts / 2, y + ts * 0.1);
  ctx.lineTo(x + ts * 0.7, y + ts * 0.8);
  ctx.lineTo(x + ts * 0.3, y + ts * 0.8);
  ctx.closePath();
  ctx.fill();
};

const drawSulfurPool = (ctx, x, y, ts, frame) => {
  const bubble = Math.sin(frame * 0.2) * 0.2 + 0.8;
  ctx.fillStyle = `rgba(160,160,40,${bubble})`;
  ctx.beginPath();
  ctx.arc(x + ts / 2, y + ts / 2, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
};
