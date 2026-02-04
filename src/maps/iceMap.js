// ═══════════════════════════════════════════════════════════════
// ICE BIOME MAP GENERATOR - The Frozen Wastes
// ═══════════════════════════════════════════════════════════════

// Copy this function into Game.jsx after the other map generators

function generateIceMap() {
  const W = 60, H = 65;
  const m = Array.from({ length: H }, () => Array(W).fill(T.SNOW));
  const fill = (x, y, w, h, t) => { 
    for (let j = y; j < Math.min(y + h, H); j++) 
      for (let i = x; i < Math.min(x + w, W); i++) 
        if (i >= 0 && j >= 0 && i < W) m[j][i] = t; 
  };
  const scatter = (x, y, w, h, t, ch) => { 
    for (let j = y; j < y + h && j < H; j++) 
      for (let i = x; i < x + w && i < W; i++) 
        if (Math.random() < ch && !SOLID.has(m[j][i])) m[j][i] = t; 
  };

  // ═══════════════════════════════════════════════════════════════
  // BORDER - Ice walls around perimeter
  // ═══════════════════════════════════════════════════════════════
  for (let i = 0; i < W; i++) { 
    m[0][i] = T.ICE_WALL; m[1][i] = T.ICE_WALL; 
    m[H - 1][i] = T.ICE_WALL; m[H - 2][i] = T.ICE_WALL; 
  }
  for (let j = 0; j < H; j++) { 
    m[j][0] = T.ICE_WALL; m[j][1] = T.ICE_WALL; 
    m[j][W - 1] = T.ICE_WALL; m[j][W - 2] = T.ICE_WALL; 
  }

  // ═══════════════════════════════════════════════════════════════
  // FROZEN TREES - Scattered throughout
  // ═══════════════════════════════════════════════════════════════
  for (let i = 0; i < 80; i++) {
    const x = 3 + Math.floor(Math.random() * (W - 6));
    const y = 3 + Math.floor(Math.random() * (H - 6));
    if (m[y][x] === T.SNOW) m[y][x] = T.FROZEN_TREE;
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN PATH - From east (town entrance) going west
  // ═══════════════════════════════════════════════════════════════
  for (let x = W - 4; x >= 4; x--) {
    const wy = 30 + Math.floor(Math.sin(x * 0.12) * 3);
    fill(x, wy - 1, 1, 3, T.SNOW_PATH);
    m[wy - 2][x] = T.SNOW;
    m[wy + 2][x] = T.SNOW;
  }

  // ═══════════════════════════════════════════════════════════════
  // EAST ENTRANCE - Connection to town
  // ═══════════════════════════════════════════════════════════════
  fill(W - 8, 26, 6, 10, T.SNOW);
  fill(W - 6, 28, 4, 6, T.SNOW_PATH);
  m[30][W - 4] = T.SIGN_POST;
  m[28][W - 5] = T.TORCH_WALL;
  m[34][W - 5] = T.TORCH_WALL;

  // ═══════════════════════════════════════════════════════════════
  // FROZEN LAKE - Center-north feature
  // ═══════════════════════════════════════════════════════════════
  fill(18, 12, 20, 12, T.ICE);
  fill(20, 14, 16, 8, T.FROZEN_WATER);
  m[12][20] = T.ICE_CRYSTAL; m[12][32] = T.ICE_CRYSTAL;
  m[22][18] = T.ICE_CRYSTAL; m[22][36] = T.ICE_CRYSTAL;
  scatter(18, 12, 20, 12, T.ICICLE, 0.05);

  // ═══════════════════════════════════════════════════════════════
  // ABANDONED CAMP - West side
  // ═══════════════════════════════════════════════════════════════
  fill(6, 35, 12, 10, T.SNOW);
  fill(8, 37, 8, 6, T.ICE);
  m[38][10] = T.BONFIRE;
  m[37][8] = T.FROZEN_CORPSE; m[40][12] = T.FROZEN_CORPSE;
  m[36][9] = T.CRATE; m[41][13] = T.BARREL;
  m[39][14] = T.FROZEN_CHEST;

  // ═══════════════════════════════════════════════════════════════
  // ICE SPIRE FORMATION - Center-south
  // ═══════════════════════════════════════════════════════════════
  fill(22, 40, 16, 10, T.ICE);
  m[42][26] = T.ICE_SPIRE; m[42][30] = T.ICE_SPIRE; m[42][34] = T.ICE_SPIRE;
  m[44][28] = T.ICE_PILLAR; m[44][32] = T.ICE_PILLAR;
  m[46][30] = T.ICE_ALTAR;
  scatter(22, 40, 16, 10, T.ICE_CRYSTAL, 0.08);

  // ═══════════════════════════════════════════════════════════════
  // FROST VENT HAZARDS
  // ═══════════════════════════════════════════════════════════════
  m[20][25] = T.FROST_VENT; m[35][15] = T.FROST_VENT;
  m[45][40] = T.FROST_VENT; m[15][45] = T.FROST_VENT;

  // ═══════════════════════════════════════════════════════════════
  // SNOW DRIFTS - Impassable obstacles
  // ═══════════════════════════════════════════════════════════════
  for (let i = 0; i < 25; i++) {
    const x = 4 + Math.floor(Math.random() * (W - 8));
    const y = 4 + Math.floor(Math.random() * (H - 8));
    if (m[y][x] === T.SNOW && Math.random() < 0.4) m[y][x] = T.SNOW_DRIFT;
  }

  // ═══════════════════════════════════════════════════════════════
  // BOSS ARENA - Ice Titan's lair (south)
  // ═══════════════════════════════════════════════════════════════
  fill(18, 52, 24, 12, T.ICE);
  fill(20, 54, 20, 8, T.SNOW);
  // Corner pillars
  m[54][22] = T.ICE_PILLAR; m[54][36] = T.ICE_PILLAR;
  m[58][22] = T.ICE_PILLAR; m[58][36] = T.ICE_PILLAR;
  // Side spires
  m[56][20] = T.ICE_SPIRE; m[56][38] = T.ICE_SPIRE;
  // Altar platform
  fill(26, 58, 8, 3, T.ICE);
  m[59][29] = T.ICE_ALTAR; m[59][30] = T.ICE_ALTAR;
  // Frozen remains
  scatter(20, 54, 20, 8, T.FROZEN_BONE, 0.06);
  // Entrance torches
  m[52][28] = T.TORCH_WALL; m[52][31] = T.TORCH_WALL;

  // ═══════════════════════════════════════════════════════════════
  // DECORATION - Additional crystals and icicles
  // ═══════════════════════════════════════════════════════════════
  scatter(3, 3, W - 6, H - 6, T.ICE_CRYSTAL, 0.02);

  // Icicles along top and side borders
  for (let i = 4; i < W - 4; i += 5) {
    if (Math.random() < 0.6) m[2][i] = T.ICICLE;
  }
  for (let j = 4; j < H - 4; j += 5) {
    if (Math.random() < 0.6) m[j][2] = T.ICICLE;
    if (Math.random() < 0.6) m[j][W - 3] = T.ICICLE;
  }

  return { map: m, w: W, h: H };
}
