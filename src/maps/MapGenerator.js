// ═══════════════════════════════════════════════════════════════════
// DARK HOLLOWS — MAP GENERATION SYSTEM
// ═══════════════════════════════════════════════════════════════════

import { T, SOLID } from '../data/tiles.js';
import { TILE } from '../constants/config.js';

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

const fill = (map, x1, y1, x2, y2, tile) => {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (map[y] && x >= 0 && x < map[0].length) {
        map[y][x] = tile;
      }
    }
  }
};

const rect = (map, x1, y1, x2, y2, wall, floor) => {
  fill(map, x1, y1, x2, y2, floor);
  fill(map, x1, y1, x2, y1, wall);
  fill(map, x1, y2, x2, y2, wall);
  fill(map, x1, y1, x1, y2, wall);
  fill(map, x2, y1, x2, y2, wall);
};

const scatter = (map, x1, y1, x2, y2, tile, chance) => {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (map[y] && map[y][x] && !SOLID.has(map[y][x]) && Math.random() < chance) {
        map[y][x] = tile;
      }
    }
  }
};

const placeTile = (map, x, y, tile) => {
  if (map[y] && map[y][x] !== undefined) {
    map[y][x] = tile;
  }
};

const createEmptyMap = (width, height, defaultTile = T.VOID) => {
  return Array(height).fill(null).map(() => Array(width).fill(defaultTile));
};

// ═══════════════════════════════════════════════════════════════════
// RUIN MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateRuinMap = () => {
  const W = 80, H = 85;
  const map = createEmptyMap(W, H, T.VOID);
  
  // Main corridor from spawn to boss
  fill(map, 30, 70, 50, 84, T.COBBLESTONE);
  
  // Spawn area
  rect(map, 28, 75, 52, 84, T.WALL, T.COBBLESTONE);
  scatter(map, 30, 77, 50, 82, T.RUBBLE, 0.1);
  placeTile(map, 40, 80, T.BONFIRE);
  
  // First chamber
  rect(map, 25, 60, 55, 74, T.WALL, T.COBBLESTONE);
  fill(map, 35, 70, 45, 75, T.COBBLESTONE); // Connect
  scatter(map, 27, 62, 53, 72, T.PILLAR, 0.03);
  placeTile(map, 30, 65, T.TORCH_WALL);
  placeTile(map, 50, 65, T.TORCH_WALL);
  placeTile(map, 40, 62, T.JAR);
  placeTile(map, 42, 62, T.JAR);
  
  // Side rooms
  rect(map, 10, 55, 24, 70, T.WALL, T.COBBLESTONE);
  fill(map, 24, 62, 26, 66, T.COBBLESTONE); // Connector
  scatter(map, 12, 57, 22, 68, T.RUBBLE, 0.15);
  placeTile(map, 17, 60, T.CHEST);
  
  rect(map, 56, 55, 70, 70, T.WALL, T.COBBLESTONE);
  fill(map, 54, 62, 56, 66, T.COBBLESTONE);
  placeTile(map, 63, 60, T.BARREL);
  placeTile(map, 65, 60, T.BARREL);
  
  // Central corridor
  fill(map, 35, 40, 45, 60, T.COBBLESTONE);
  fill(map, 32, 45, 48, 55, T.COBBLESTONE);
  scatter(map, 33, 46, 47, 54, T.PILLAR, 0.02);
  
  // Upper chambers
  rect(map, 20, 30, 40, 44, T.WALL, T.COBBLESTONE);
  fill(map, 35, 40, 45, 45, T.COBBLESTONE);
  placeTile(map, 30, 35, T.TORCH_WALL);
  placeTile(map, 25, 38, T.STAINED_GLASS);
  
  rect(map, 42, 30, 60, 44, T.WALL, T.COBBLESTONE);
  placeTile(map, 51, 35, T.TORCH_WALL);
  scatter(map, 44, 32, 58, 42, T.RUBBLE, 0.08);
  
  // Boss chamber
  rect(map, 25, 5, 55, 28, T.WALL, T.COBBLESTONE);
  fill(map, 35, 28, 45, 32, T.COBBLESTONE);
  placeTile(map, 40, 10, T.BONFIRE);
  placeTile(map, 30, 15, T.PILLAR);
  placeTile(map, 50, 15, T.PILLAR);
  placeTile(map, 30, 20, T.PILLAR);
  placeTile(map, 50, 20, T.PILLAR);
  
  // Zone exit
  placeTile(map, 40, 6, T.ZONE_EXIT);
  
  return { map, spawn: { x: 40, y: 80 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// TOWN MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateTownMap = () => {
  const W = 50, H = 40;
  const map = createEmptyMap(W, H, T.GRASS);
  
  // Paths
  fill(map, 5, 18, 45, 22, T.PATH);
  fill(map, 23, 5, 27, 35, T.PATH);
  
  // Town square
  fill(map, 18, 15, 32, 25, T.COBBLESTONE);
  placeTile(map, 25, 20, T.WELL);
  
  // Buildings
  // Blacksmith
  rect(map, 8, 8, 18, 16, T.WALL, T.WOOD_FLOOR);
  placeTile(map, 13, 16, T.DOOR_CLOSED);
  placeTile(map, 10, 10, T.ANVIL);
  placeTile(map, 15, 10, T.FORGE);
  
  // Inn
  rect(map, 32, 8, 45, 16, T.WALL, T.WOOD_FLOOR);
  placeTile(map, 38, 16, T.DOOR_CLOSED);
  placeTile(map, 35, 10, T.TABLE);
  placeTile(map, 40, 10, T.TABLE);
  placeTile(map, 43, 12, T.BARREL);
  
  // Shop
  rect(map, 8, 24, 18, 32, T.WALL, T.WOOD_FLOOR);
  placeTile(map, 13, 24, T.DOOR_CLOSED);
  placeTile(map, 10, 28, T.CRATE);
  placeTile(map, 15, 28, T.CRATE);
  
  // Temple
  rect(map, 32, 24, 45, 35, T.WALL, T.COBBLESTONE);
  placeTile(map, 38, 24, T.DOOR_CLOSED);
  placeTile(map, 38, 32, T.ALTAR);
  placeTile(map, 35, 30, T.STAINED_GLASS);
  placeTile(map, 41, 30, T.STAINED_GLASS);
  
  // Trees around edges
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(Math.random() * (W - 4)) + 2;
    const y = Math.floor(Math.random() * (H - 4)) + 2;
    if (map[y][x] === T.GRASS) {
      placeTile(map, x, y, T.TREE);
    }
  }
  
  // Bonfire in square
  placeTile(map, 25, 18, T.BONFIRE);
  
  // Zone exits
  placeTile(map, 5, 20, T.ZONE_EXIT);   // To ruin
  placeTile(map, 45, 20, T.ZONE_EXIT);  // To forest
  
  return { map, spawn: { x: 25, y: 20 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// FOREST MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateForestMap = () => {
  const W = 70, H = 65;
  const map = createEmptyMap(W, H, T.GRASS);
  
  // Dense tree coverage
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Math.random() < 0.25) {
        map[y][x] = T.TREE;
      } else if (Math.random() < 0.1) {
        map[y][x] = T.BUSH;
      }
    }
  }
  
  // Clear paths
  const clearPath = (x1, y1, x2, y2) => {
    const dx = x2 > x1 ? 1 : x2 < x1 ? -1 : 0;
    const dy = y2 > y1 ? 1 : y2 < y1 ? -1 : 0;
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
      fill(map, x - 1, y - 1, x + 1, y + 1, T.DIRT);
      if (x !== x2) x += dx;
      if (y !== y2) y += dy;
    }
  };
  
  // Main paths
  clearPath(5, 55, 35, 55);
  clearPath(35, 55, 35, 30);
  clearPath(35, 30, 55, 30);
  clearPath(35, 30, 35, 15);
  
  // Spawn clearing
  fill(map, 2, 52, 12, 60, T.GRASS);
  placeTile(map, 7, 56, T.CAMP_FIRE);
  
  // Bandit camp
  fill(map, 30, 10, 45, 22, T.DIRT);
  placeTile(map, 35, 15, T.CAMP_FIRE);
  placeTile(map, 40, 12, T.TENT);
  placeTile(map, 32, 18, T.CRATE);
  placeTile(map, 42, 18, T.BARREL);
  
  // Swamp area
  fill(map, 8, 35, 25, 48, T.SWAMP);
  scatter(map, 10, 37, 23, 46, T.SWAMP_TREE, 0.15);
  scatter(map, 10, 37, 23, 46, T.WATER_PUDDLE, 0.08);
  
  // Clearing with chest
  fill(map, 50, 40, 60, 50, T.GRASS);
  placeTile(map, 55, 45, T.CHEST);
  
  // Mushroom grove
  fill(map, 55, 15, 65, 28, T.GRASS);
  scatter(map, 56, 16, 64, 27, T.MUSHROOM, 0.2);
  
  // Zone exits
  placeTile(map, 3, 56, T.ZONE_EXIT);   // To town
  placeTile(map, 37, 12, T.ZONE_EXIT);  // To cave
  
  return { map, spawn: { x: 7, y: 56 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// CAVE MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateCaveMap = () => {
  const W = 60, H = 50;
  const map = createEmptyMap(W, H, T.CAVE_WALL);
  
  // Carve out cave system using cellular automata style
  const carve = (cx, cy, radius) => {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= radius + Math.random() * 2 && map[y] && map[y][x] !== undefined) {
          map[y][x] = T.CAVE_FLOOR;
        }
      }
    }
  };
  
  // Main chambers
  carve(15, 40, 8);  // Entrance
  carve(30, 35, 6);  // Mid chamber
  carve(45, 30, 7);  // Spider den
  carve(25, 20, 8);  // Crystal cavern
  carve(50, 15, 6);  // Boss chamber
  
  // Tunnels
  const tunnel = (x1, y1, x2, y2) => {
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
      carve(x, y, 2);
      if (Math.random() < 0.5 && x !== x2) x += x2 > x ? 1 : -1;
      else if (y !== y2) y += y2 > y ? 1 : -1;
    }
  };
  
  tunnel(15, 40, 30, 35);
  tunnel(30, 35, 45, 30);
  tunnel(30, 35, 25, 20);
  tunnel(25, 20, 50, 15);
  
  // Decorations
  scatter(map, 0, 0, W - 1, H - 1, T.STALACTITE, 0.02);
  scatter(map, 0, 0, W - 1, H - 1, T.STALAGMITE, 0.02);
  
  // Crystal cavern
  scatter(map, 18, 14, 32, 26, T.CRYSTAL, 0.1);
  placeTile(map, 25, 20, T.CRYSTAL);
  
  // Spider webs
  scatter(map, 38, 24, 52, 36, T.SPIDER_WEB, 0.08);
  
  // Water pools
  fill(map, 12, 38, 18, 42, T.WATER_PUDDLE);
  
  // Mushrooms
  scatter(map, 10, 35, 20, 44, T.MUSHROOM, 0.05);
  
  // Torches
  placeTile(map, 15, 40, T.TORCH_WALL);
  placeTile(map, 30, 35, T.TORCH_WALL);
  
  // Zone exits
  placeTile(map, 10, 42, T.ZONE_EXIT);  // To forest
  placeTile(map, 52, 12, T.ZONE_EXIT);  // To crypt
  
  return { map, spawn: { x: 15, y: 40 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// CRYPT MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateCryptMap = () => {
  const W = 55, H = 55;
  const map = createEmptyMap(W, H, T.VOID);
  
  // Main halls
  const room = (x1, y1, x2, y2) => {
    rect(map, x1, y1, x2, y2, T.CRYPT_WALL, T.CRYPT_FLOOR);
  };
  
  // Entrance hall
  room(20, 45, 35, 52);
  placeTile(map, 27, 50, T.BONFIRE);
  
  // Corridor system
  fill(map, 25, 35, 30, 45, T.CRYPT_FLOOR);
  
  // Tomb rooms
  room(10, 30, 23, 42);
  placeTile(map, 15, 35, T.SARCOPHAGUS);
  placeTile(map, 18, 38, T.TOMB);
  fill(map, 23, 35, 26, 38, T.CRYPT_FLOOR);
  
  room(32, 30, 45, 42);
  placeTile(map, 38, 35, T.COFFIN);
  placeTile(map, 40, 38, T.COFFIN);
  fill(map, 29, 35, 32, 38, T.CRYPT_FLOOR);
  
  // Central chamber
  room(18, 18, 37, 32);
  fill(map, 25, 32, 30, 35, T.CRYPT_FLOOR);
  placeTile(map, 27, 25, T.SOUL_FLAME);
  placeTile(map, 20, 22, T.PILLAR);
  placeTile(map, 35, 22, T.PILLAR);
  placeTile(map, 20, 28, T.PILLAR);
  placeTile(map, 35, 28, T.PILLAR);
  
  // Upper corridor
  fill(map, 25, 10, 30, 18, T.CRYPT_FLOOR);
  
  // Boss chamber - Lich's throne
  room(15, 2, 40, 12);
  placeTile(map, 27, 5, T.ALTAR);
  placeTile(map, 18, 5, T.SOUL_FLAME);
  placeTile(map, 37, 5, T.SOUL_FLAME);
  scatter(map, 17, 4, 38, 10, T.BONE_PILE, 0.1);
  
  // Decorations
  scatter(map, 0, 0, W - 1, H - 1, T.BONE_PILE, 0.02);
  
  // Zone exits
  placeTile(map, 27, 51, T.ZONE_EXIT);  // To cave
  placeTile(map, 27, 3, T.ZONE_EXIT);   // To graveyard
  
  return { map, spawn: { x: 27, y: 50 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// GRAVEYARD MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateGraveyardMap = () => {
  const W = 60, H = 60;
  const map = createEmptyMap(W, H, T.DEAD_GROUND);
  
  // Paths
  fill(map, 28, 5, 32, 55, T.GRAVEL);
  fill(map, 10, 25, 50, 29, T.GRAVEL);
  
  // Graves in rows
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 10 + col * 5;
      const y = 10 + row * 10;
      if (x < 28 || x > 32) {
        placeTile(map, x, y, Math.random() < 0.3 ? T.TOMB : T.GRAVESTONE);
      }
    }
  }
  
  // Dead trees
  scatter(map, 0, 0, W - 1, H - 1, T.DEAD_TREE, 0.03);
  
  // Fog patches (using empty/special tiles)
  scatter(map, 0, 0, W - 1, H - 1, T.FOG, 0.02);
  
  // Chapel ruins
  rect(map, 22, 45, 38, 58, T.WALL, T.COBBLESTONE);
  placeTile(map, 30, 45, T.DOOR_CLOSED);
  placeTile(map, 30, 55, T.ALTAR);
  placeTile(map, 25, 52, T.SOUL_FLAME);
  placeTile(map, 35, 52, T.SOUL_FLAME);
  
  // Mausoleum
  rect(map, 45, 10, 55, 20, T.CRYPT_WALL, T.CRYPT_FLOOR);
  placeTile(map, 50, 20, T.DOOR_CLOSED);
  placeTile(map, 50, 12, T.SARCOPHAGUS);
  
  // Open grave pits
  fill(map, 8, 35, 15, 42, T.PIT);
  fill(map, 45, 35, 52, 42, T.PIT);
  
  // Zone exits
  placeTile(map, 30, 56, T.ZONE_EXIT);  // To crypt
  placeTile(map, 30, 6, T.ZONE_EXIT);   // To desert
  
  return { map, spawn: { x: 30, y: 52 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// DESERT MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateDesertMap = () => {
  const W = 70, H = 70;
  const map = createEmptyMap(W, H, T.SAND);
  
  // Dunes
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * (W - 10)) + 5;
    const y = Math.floor(Math.random() * (H - 10)) + 5;
    fill(map, x, y, x + 4, y + 2, T.DUNE);
  }
  
  // Rocky outcrops
  scatter(map, 0, 0, W - 1, H - 1, T.DESERT_ROCK, 0.03);
  
  // Cacti
  scatter(map, 0, 0, W - 1, H - 1, T.CACTUS, 0.02);
  
  // Oasis
  fill(map, 30, 30, 40, 40, T.OASIS);
  fill(map, 32, 32, 38, 38, T.WATER_PUDDLE);
  scatter(map, 30, 30, 40, 40, T.PALM_TREE, 0.15);
  
  // Ruins entrance
  rect(map, 25, 55, 45, 68, T.SANDSTONE_WALL, T.SANDSTONE_FLOOR);
  placeTile(map, 35, 55, T.DOOR_CLOSED);
  placeTile(map, 30, 60, T.PILLAR);
  placeTile(map, 40, 60, T.PILLAR);
  placeTile(map, 35, 65, T.BONFIRE);
  
  // Temple ruins
  rect(map, 50, 10, 65, 25, T.SANDSTONE_WALL, T.SANDSTONE_FLOOR);
  fill(map, 55, 25, 60, 28, T.SANDSTONE_FLOOR);
  placeTile(map, 57, 15, T.ALTAR);
  scatter(map, 52, 12, 63, 23, T.RUBBLE, 0.08);
  
  // Scorpion nest
  fill(map, 8, 45, 20, 55, T.SAND);
  scatter(map, 10, 47, 18, 53, T.BONE_PILE, 0.1);
  
  // Market area
  fill(map, 10, 10, 25, 22, T.SANDSTONE_FLOOR);
  placeTile(map, 15, 15, T.TENT);
  placeTile(map, 20, 15, T.CRATE);
  placeTile(map, 17, 18, T.BARREL);
  
  // Zone exits
  placeTile(map, 35, 66, T.ZONE_EXIT);  // To graveyard
  placeTile(map, 57, 11, T.ZONE_EXIT);  // To ice
  
  return { map, spawn: { x: 35, y: 63 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// ICE MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateIceMap = () => {
  const W = 65, H = 70;
  const map = createEmptyMap(W, H, T.SNOW);
  
  // Ice patches
  for (let i = 0; i < 25; i++) {
    const x = Math.floor(Math.random() * (W - 8)) + 4;
    const y = Math.floor(Math.random() * (H - 8)) + 4;
    const size = Math.floor(Math.random() * 4) + 2;
    fill(map, x, y, x + size, y + size, T.ICE_FLOOR);
  }
  
  // Frozen trees
  scatter(map, 0, 0, W - 1, H - 1, T.FROZEN_TREE, 0.04);
  
  // Ice crystals
  scatter(map, 0, 0, W - 1, H - 1, T.ICE_CRYSTAL, 0.02);
  
  // Snow drifts (walls)
  scatter(map, 0, 0, W - 1, H - 1, T.SNOW_DRIFT, 0.03);
  
  // Frozen lake
  fill(map, 20, 25, 45, 40, T.ICE_FLOOR);
  fill(map, 25, 30, 40, 35, T.FROZEN_WATER);
  
  // Ice cave entrance
  rect(map, 25, 55, 40, 68, T.ICE_WALL, T.ICE_FLOOR);
  placeTile(map, 32, 55, T.DOOR_CLOSED);
  placeTile(map, 32, 65, T.BONFIRE);
  scatter(map, 27, 57, 38, 66, T.ICICLE, 0.1);
  
  // Crystal cavern
  rect(map, 45, 10, 60, 25, T.ICE_WALL, T.ICE_FLOOR);
  fill(map, 50, 25, 55, 28, T.ICE_FLOOR);
  scatter(map, 47, 12, 58, 23, T.ICE_CRYSTAL, 0.15);
  placeTile(map, 52, 17, T.ICE_CRYSTAL);
  
  // Frost vent hazards
  scatter(map, 0, 0, W - 1, H - 1, T.FROST_VENT, 0.01);
  
  // Titan's chamber
  rect(map, 10, 5, 35, 20, T.ICE_WALL, T.ICE_FLOOR);
  fill(map, 20, 20, 25, 25, T.ICE_FLOOR);
  placeTile(map, 22, 10, T.ICE_CRYSTAL);
  placeTile(map, 15, 12, T.ICICLE);
  placeTile(map, 30, 12, T.ICICLE);
  
  // Zone exits
  placeTile(map, 32, 66, T.ZONE_EXIT);  // To desert
  placeTile(map, 22, 6, T.ZONE_EXIT);   // To volcanic
  
  return { map, spawn: { x: 32, y: 63 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// VOLCANIC MAP GENERATOR
// ═══════════════════════════════════════════════════════════════════

export const generateVolcanicMap = () => {
  const W = 70, H = 75;
  const map = createEmptyMap(W, H, T.VOLCANIC_ROCK);
  
  // Magma rivers
  fill(map, 15, 10, 20, 60, T.MAGMA);
  fill(map, 50, 15, 55, 65, T.MAGMA);
  fill(map, 20, 35, 50, 40, T.MAGMA);
  
  // Safe paths (obsidian)
  fill(map, 30, 55, 40, 70, T.OBSIDIAN);
  fill(map, 25, 40, 45, 55, T.OBSIDIAN);
  fill(map, 30, 20, 40, 40, T.OBSIDIAN);
  fill(map, 25, 5, 45, 20, T.OBSIDIAN);
  
  // Ember ground (hazard)
  scatter(map, 0, 0, W - 1, H - 1, T.EMBER_GROUND, 0.05);
  
  // Fire geysers
  scatter(map, 0, 0, W - 1, H - 1, T.FIRE_GEYSER, 0.01);
  
  // Volcanic vents
  scatter(map, 0, 0, W - 1, H - 1, T.VOLCANIC_VENT, 0.02);
  
  // Ash ground
  scatter(map, 0, 0, W - 1, H - 1, T.ASH_GROUND, 0.08);
  
  // Ember crystals
  scatter(map, 0, 0, W - 1, H - 1, T.EMBER_CRYSTAL, 0.02);
  
  // Sulfur pools
  fill(map, 8, 50, 14, 58, T.SULFUR_POOL);
  fill(map, 56, 45, 62, 53, T.SULFUR_POOL);
  
  // Spawn area
  rect(map, 28, 60, 42, 72, T.OBSIDIAN_WALL, T.OBSIDIAN);
  placeTile(map, 35, 60, T.DOOR_CLOSED);
  placeTile(map, 35, 68, T.BONFIRE);
  
  // Forge chamber
  rect(map, 10, 20, 25, 35, T.OBSIDIAN_WALL, T.OBSIDIAN);
  fill(map, 22, 25, 26, 30, T.OBSIDIAN);
  placeTile(map, 17, 27, T.FORGE);
  placeTile(map, 15, 30, T.ANVIL);
  
  // Boss chamber - Infernal Lord
  rect(map, 22, 2, 48, 18, T.OBSIDIAN_WALL, T.OBSIDIAN);
  fill(map, 32, 18, 38, 22, T.OBSIDIAN);
  placeTile(map, 35, 8, T.ALTAR);
  placeTile(map, 25, 10, T.EMBER_CRYSTAL);
  placeTile(map, 45, 10, T.EMBER_CRYSTAL);
  fill(map, 30, 5, 40, 7, T.MAGMA);  // Throne lava
  
  // Zone exits
  placeTile(map, 35, 70, T.ZONE_EXIT);  // To ice
  placeTile(map, 35, 4, T.ZONE_EXIT);   // Final exit / victory
  
  return { map, spawn: { x: 35, y: 67 }, width: W, height: H };
};

// ═══════════════════════════════════════════════════════════════════
// MAP GENERATOR FACTORY
// ═══════════════════════════════════════════════════════════════════

export const getMapGeneratorForZone = (zone) => {
  const generators = {
    ruin: generateRuinMap,
    town: generateTownMap,
    forest: generateForestMap,
    cave: generateCaveMap,
    crypt: generateCryptMap,
    graveyard: generateGraveyardMap,
    desert: generateDesertMap,
    ice: generateIceMap,
    volcanic: generateVolcanicMap,
  };
  
  return generators[zone] || generateRuinMap;
};

// Generate map and return full zone data
export const generateZone = (zoneName) => {
  const generator = getMapGeneratorForZone(zoneName);
  const { map, spawn, width, height } = generator();
  
  return {
    name: zoneName,
    map,
    spawn,
    width,
    height,
    pixelWidth: width * TILE,
    pixelHeight: height * TILE,
  };
};
