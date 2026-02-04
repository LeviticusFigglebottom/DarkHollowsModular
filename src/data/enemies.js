// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — ENEMY DEFINITIONS
// ═══════════════════════════════════════════════════════════════

import { TILE } from './tiles.js';

// Enemy type information
export const ENEMY_INFO = {
  // ═══════════════════════════════════════════════════════════════
  // RUIN ENEMIES
  // ═══════════════════════════════════════════════════════════════
  hollow: { name: "Hollow Soldier", xp: 15, dmg: 8, color: "#1a1018", kb: 10 },
  hollow_knight: { name: "Hollow Knight", xp: 30, dmg: 14, color: "#2a2030", kb: 7 },
  
  // ═══════════════════════════════════════════════════════════════
  // FOREST ENEMIES
  // ═══════════════════════════════════════════════════════════════
  timber_wolf: { name: "Timber Wolf", xp: 18, dmg: 10, color: "#4a3a20", kb: 12 },
  forest_bandit: { name: "Forest Bandit", xp: 22, dmg: 11, color: "#3a4030", kb: 9 },
  bandit_chief: { name: "Bandit Chief", xp: 45, dmg: 16, color: "#5a3020", kb: 5, isBoss: true },
  
  // ═══════════════════════════════════════════════════════════════
  // CAVE ENEMIES
  // ═══════════════════════════════════════════════════════════════
  cave_spider: { name: "Cave Spider", xp: 20, dmg: 9, color: "#2a2828", kb: 14 },
  cave_lurker: { name: "Cave Lurker", xp: 35, dmg: 15, color: "#1a2030", kb: 7 },
  spider_queen: { name: "Spider Queen", xp: 60, dmg: 18, color: "#3a2838", kb: 4, isBoss: true },
  
  // ═══════════════════════════════════════════════════════════════
  // SPECIAL ENEMIES (Multi-zone)
  // ═══════════════════════════════════════════════════════════════
  skeleton_archer: { name: "Skeleton Archer", xp: 25, dmg: 12, color: "#c8c0a8", kb: 15, isRanged: true },
  shadow_wraith: { name: "Shadow Wraith", xp: 40, dmg: 18, color: "#3a2050", kb: 8, canTeleport: true },
  fire_elemental: { name: "Fire Elemental", xp: 35, dmg: 14, color: "#ff6020", kb: 10, appliesEffect: "burn" },
  poison_slime: { name: "Poison Slime", xp: 18, dmg: 6, color: "#50a040", kb: 16, appliesEffect: "venom" },
  frost_shade: { name: "Frost Shade", xp: 32, dmg: 11, color: "#80c0e0", kb: 12, appliesEffect: "freeze" },
  
  // ═══════════════════════════════════════════════════════════════
  // CRYPT ENEMIES
  // ═══════════════════════════════════════════════════════════════
  skeleton: { name: "Skeleton", xp: 18, dmg: 9, color: "#c8c0a8", kb: 12 },
  crypt_shade: { name: "Crypt Shade", xp: 28, dmg: 13, color: "#4060a0", kb: 10, canTeleport: true },
  bone_knight: { name: "Bone Knight", xp: 38, dmg: 16, color: "#a0a0a8", kb: 5 },
  lich: { name: "Ancient Lich", xp: 80, dmg: 22, color: "#5040a0", kb: 3, isBoss: true, isRanged: true },
  
  // ═══════════════════════════════════════════════════════════════
  // GRAVEYARD ENEMIES
  // ═══════════════════════════════════════════════════════════════
  grave_zombie: { name: "Grave Zombie", xp: 20, dmg: 10, color: "#3a4838", kb: 9 },
  restless_spirit: { name: "Restless Spirit", xp: 28, dmg: 12, color: "#6080a0", kb: 12, canTeleport: true },
  bone_guard: { name: "Bone Guard", xp: 35, dmg: 15, color: "#c8c0b0", kb: 6 },
  graveyard_revenant: { name: "Graveyard Revenant", xp: 55, dmg: 18, color: "#4a5060", kb: 4, isBoss: true },
  
  // ═══════════════════════════════════════════════════════════════
  // DESERT ENEMIES
  // ═══════════════════════════════════════════════════════════════
  desert_scorpion: { name: "Desert Scorpion", xp: 25, dmg: 11, color: "#8a6a40", kb: 11, appliesEffect: "venom" },
  sand_wraith: { name: "Sand Wraith", xp: 30, dmg: 13, color: "#c4a060", kb: 10 },
  dune_stalker: { name: "Dune Stalker", xp: 35, dmg: 14, color: "#6a5a40", kb: 8 },
  desert_warlord: { name: "Desert Warlord", xp: 70, dmg: 20, color: "#a08040", kb: 4, isBoss: true },
  
  // ═══════════════════════════════════════════════════════════════
  // ICE BIOME ENEMIES
  // ═══════════════════════════════════════════════════════════════
  frost_wolf: { name: "Frost Wolf", xp: 28, dmg: 12, color: "#a0c8d8", kb: 10, appliesEffect: "freeze" },
  ice_wraith: { name: "Ice Wraith", xp: 35, dmg: 14, color: "#80b8d0", kb: 8, canTeleport: true, appliesEffect: "freeze" },
  frozen_knight: { name: "Frozen Knight", xp: 40, dmg: 16, color: "#5080a0", kb: 5 },
  snow_stalker: { name: "Snow Stalker", xp: 32, dmg: 13, color: "#c0d8e8", kb: 9 },
  crystal_golem: { name: "Crystal Golem", xp: 45, dmg: 18, color: "#60a0c0", kb: 3 },
  ice_titan: { name: "Ice Titan", xp: 140, dmg: 28, color: "#4080b0", kb: 2, isBoss: true, appliesEffect: "freeze" },
  
  // ═══════════════════════════════════════════════════════════════
  // VOLCANIC BIOME ENEMIES
  // ═══════════════════════════════════════════════════════════════
  magma_hound: { name: "Magma Hound", xp: 30, dmg: 13, color: "#c04020", kb: 10, appliesEffect: "burn" },
  ember_wraith: { name: "Ember Wraith", xp: 38, dmg: 15, color: "#ff6040", kb: 8, canTeleport: true, appliesEffect: "burn" },
  obsidian_golem: { name: "Obsidian Golem", xp: 50, dmg: 20, color: "#202028", kb: 3 },
  flame_imp: { name: "Flame Imp", xp: 28, dmg: 11, color: "#ff8040", kb: 12, isRanged: true, appliesEffect: "burn" },
  ash_crawler: { name: "Ash Crawler", xp: 25, dmg: 10, color: "#504040", kb: 11 },
  infernal_lord: { name: "Infernal Lord", xp: 160, dmg: 32, color: "#a02010", kb: 2, isBoss: true, appliesEffect: "burn" },
};

// Helper to create a single enemy object
export const createEnemy = (type, x, y, options = {}) => {
  const info = ENEMY_INFO[type];
  if (!info) {
    console.warn(`Unknown enemy type: ${type}`);
    return null;
  }
  
  return {
    type,
    x: x * TILE,
    y: y * TILE,
    hp: options.hp || (info.isBoss ? 150 + (info.xp * 2) : 30 + (info.xp * 1.5)),
    maxHp: options.maxHp || options.hp || (info.isBoss ? 150 + (info.xp * 2) : 30 + (info.xp * 1.5)),
    dir: options.dir || 2,
    frame: 0,
    dead: false,
    deathTimer: 0,
    kbx: 0,
    kby: 0,
    hitCd: 0,
    aiState: "idle",
    aiTimer: Math.random() * 60,
    teleportCd: 0,
    attackCd: 0,
    statusEffects: [],
    ...options,
  };
};

// ═══════════════════════════════════════════════════════════════
// ZONE ENEMY SPAWNERS
// ═══════════════════════════════════════════════════════════════

export const createRuinEnemies = () => {
  const enemies = [];
  
  // Hollow soldiers scattered throughout
  const hollowPositions = [
    [35, 70], [40, 68], [28, 65], [45, 72], [32, 60],
    [50, 65], [25, 58], [38, 55], [42, 50], [30, 45],
    [48, 40], [35, 35], [40, 30], [28, 25], [45, 20],
    [32, 15], [50, 10], [38, 8], [42, 5],
  ];
  
  hollowPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("hollow", x, y));
  });
  
  // Hollow knights (tougher)
  const knightPositions = [
    [36, 50], [44, 35], [30, 20], [48, 15],
  ];
  
  knightPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("hollow_knight", x, y));
  });
  
  // Add some archers
  enemies.push(createEnemy("skeleton_archer", 40, 45));
  enemies.push(createEnemy("skeleton_archer", 35, 25));
  
  return enemies;
};

export const createForestEnemies = () => {
  const enemies = [];
  
  // Wolves
  const wolfPositions = [
    [20, 55], [45, 50], [15, 40], [50, 35], [25, 30],
    [40, 25], [30, 20], [55, 15],
  ];
  
  wolfPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("timber_wolf", x, y));
  });
  
  // Bandits
  const banditPositions = [
    [35, 45], [42, 40], [28, 35], [48, 30], [32, 25],
  ];
  
  banditPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("forest_bandit", x, y));
  });
  
  // Boss: Bandit Chief
  enemies.push(createEnemy("bandit_chief", 38, 15));
  
  // Poison slimes near swamp
  enemies.push(createEnemy("poison_slime", 12, 45));
  enemies.push(createEnemy("poison_slime", 18, 48));
  
  return enemies;
};

export const createCaveEnemies = () => {
  const enemies = [];
  
  // Cave spiders
  const spiderPositions = [
    [10, 20], [20, 15], [30, 25], [15, 30], [25, 35],
    [35, 20], [40, 30], [45, 25],
  ];
  
  spiderPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("cave_spider", x, y));
  });
  
  // Cave lurkers
  const lurkerPositions = [
    [18, 22], [32, 18], [42, 28],
  ];
  
  lurkerPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("cave_lurker", x, y));
  });
  
  // Boss: Spider Queen
  enemies.push(createEnemy("spider_queen", 50, 20));
  
  // Glowing mushroom area has wraiths
  enemies.push(createEnemy("shadow_wraith", 25, 40));
  
  return enemies;
};

export const createCryptEnemies = () => {
  const enemies = [];
  
  // Skeletons
  const skelPositions = [
    [15, 15], [25, 12], [35, 18], [20, 25], [30, 22],
    [40, 15], [45, 28], [18, 35],
  ];
  
  skelPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("skeleton", x, y));
  });
  
  // Crypt shades
  const shadePositions = [
    [28, 20], [38, 25], [22, 32],
  ];
  
  shadePositions.forEach(([x, y]) => {
    enemies.push(createEnemy("crypt_shade", x, y));
  });
  
  // Bone knights
  enemies.push(createEnemy("bone_knight", 32, 30));
  enemies.push(createEnemy("bone_knight", 42, 20));
  
  // Archers
  enemies.push(createEnemy("skeleton_archer", 20, 18));
  enemies.push(createEnemy("skeleton_archer", 35, 28));
  
  // Boss: Lich
  enemies.push(createEnemy("lich", 30, 45));
  
  return enemies;
};

export const createGraveyardEnemies = () => {
  const enemies = [];
  
  // Zombies
  const zombiePositions = [
    [20, 15], [35, 12], [45, 18], [15, 25], [30, 22],
    [50, 15], [25, 30], [40, 28],
  ];
  
  zombiePositions.forEach(([x, y]) => {
    enemies.push(createEnemy("grave_zombie", x, y));
  });
  
  // Spirits
  const spiritPositions = [
    [28, 18], [42, 25], [18, 32],
  ];
  
  spiritPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("restless_spirit", x, y));
  });
  
  // Bone guards
  enemies.push(createEnemy("bone_guard", 35, 25));
  enemies.push(createEnemy("bone_guard", 22, 35));
  
  // Boss
  enemies.push(createEnemy("graveyard_revenant", 30, 50));
  
  return enemies;
};

export const createDesertEnemies = () => {
  const enemies = [];
  
  // Scorpions
  const scorpPositions = [
    [20, 20], [40, 15], [55, 25], [15, 35], [35, 30],
    [50, 40], [25, 45], [45, 50],
  ];
  
  scorpPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("desert_scorpion", x, y));
  });
  
  // Sand wraiths
  const wraithPositions = [
    [30, 25], [48, 35], [22, 40],
  ];
  
  wraithPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("sand_wraith", x, y));
  });
  
  // Dune stalkers
  enemies.push(createEnemy("dune_stalker", 38, 38));
  enemies.push(createEnemy("dune_stalker", 28, 55));
  
  // Boss
  enemies.push(createEnemy("desert_warlord", 30, 60));
  
  return enemies;
};

export const createIceEnemies = () => {
  const enemies = [];
  
  // Frost wolves
  const wolfPositions = [
    [20, 20], [40, 15], [55, 25], [15, 35], [35, 30],
    [50, 40], [25, 45],
  ];
  
  wolfPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("frost_wolf", x, y));
  });
  
  // Ice wraiths
  const wraithPositions = [
    [30, 25], [48, 35], [22, 50],
  ];
  
  wraithPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("ice_wraith", x, y));
  });
  
  // Frozen knights
  enemies.push(createEnemy("frozen_knight", 38, 20));
  enemies.push(createEnemy("frozen_knight", 42, 45));
  
  // Snow stalkers
  enemies.push(createEnemy("snow_stalker", 15, 28));
  enemies.push(createEnemy("snow_stalker", 52, 32));
  
  // Crystal golem
  enemies.push(createEnemy("crystal_golem", 28, 40));
  
  // Boss: Ice Titan
  enemies.push(createEnemy("ice_titan", 30, 58));
  
  return enemies;
};

export const createVolcanicEnemies = () => {
  const enemies = [];
  
  // Magma hounds
  const houndPositions = [
    [20, 20], [40, 15], [55, 25], [15, 35], [35, 30],
    [50, 40],
  ];
  
  houndPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("magma_hound", x, y));
  });
  
  // Ember wraiths
  const wraithPositions = [
    [30, 25], [48, 35], [22, 50],
  ];
  
  wraithPositions.forEach(([x, y]) => {
    enemies.push(createEnemy("ember_wraith", x, y));
  });
  
  // Flame imps
  enemies.push(createEnemy("flame_imp", 25, 18));
  enemies.push(createEnemy("flame_imp", 45, 28));
  enemies.push(createEnemy("flame_imp", 35, 45));
  
  // Ash crawlers
  enemies.push(createEnemy("ash_crawler", 18, 30));
  enemies.push(createEnemy("ash_crawler", 52, 38));
  
  // Obsidian golem
  enemies.push(createEnemy("obsidian_golem", 40, 50));
  
  // Boss: Infernal Lord
  enemies.push(createEnemy("infernal_lord", 30, 60));
  
  return enemies;
};

// Factory to get enemy creator by zone
export const getEnemyCreatorForZone = (zone) => {
  const creators = {
    ruin: createRuinEnemies,
    forest: createForestEnemies,
    cave: createCaveEnemies,
    crypt: createCryptEnemies,
    graveyard: createGraveyardEnemies,
    desert: createDesertEnemies,
    ice: createIceEnemies,
    volcanic: createVolcanicEnemies,
    town: () => [], // No enemies in town
  };
  
  return creators[zone] || (() => []);
};
