# Dark Hollows - Ice & Volcanic Biomes Integration Package

This package contains all the code needed to add the **Ice Biome (Frozen Wastes)** and **Volcanic Biome (Volcanic Depths)** to Dark Hollows, plus 3 bug fixes.

## Bug Fixes Included

1. **Forest Access Issue**: Forest now properly accessible from north of town
2. **Desert Spawn Bug**: Player spawns at correct north entrance position
3. **Prologue Messages**: Messages only show in ruins phase, not other zones

## New Content

### Ice Biome (Frozen Wastes)
- **Location**: West of town
- **Features**: Frozen lake, ice crystal formations, abandoned camp, frost vents
- **Enemies**: Frost Wolf, Frozen Hollow, Glacial Spider, Ice Elemental, Ice Wraith
- **Boss**: Ice Titan (280 HP, freeze effect)
- **Lighting**: Dark (0.20), cool blue tones

### Volcanic Biome (Volcanic Depths)  
- **Location**: South of desert
- **Features**: Lava rivers, fire geysers, obsidian formations, volcanic vents
- **Enemies**: Ash Walker, Flame Imp, Magma Slime, Ember Wraith, Lava Lurker
- **Boss**: Infernal Lord (350 HP, burn effect)
- **Lighting**: Dark (0.30), orange/red tones

## Zone Connection Map

```
                [Ruins]
                   ↑
              (prologue)
                   |
[Ice] ←——— [Town] ———→ [Graveyard] ———→ [Crypt]
              |
              ↓
        [Forest] ←——→ [Caves]
              
          [Desert]
              ↓
        [Volcanic]
```

---

# INTEGRATION INSTRUCTIONS

## Step 1: Add New Tile Constants

In `Game.jsx`, find the `T` object and add after `WILLOW: 128`:

```javascript
// === ICE BIOME TILES ===
ICE: 130, SNOW: 131, FROZEN_WATER: 132, ICE_WALL: 133, ICICLE: 134, 
FROZEN_TREE: 135, SNOW_DRIFT: 136, ICE_PILLAR: 137, FROZEN_CORPSE: 138,
ICE_CRYSTAL: 139, FROST_VENT: 140, FROZEN_CHEST: 141, ICE_ALTAR: 142,
SNOW_PATH: 143, FROZEN_BONE: 144, ICE_SPIRE: 145,

// === VOLCANIC BIOME TILES ===
VOLCANIC_ROCK: 150, MAGMA: 151, LAVA_FLOW: 152, OBSIDIAN: 153, VOLCANIC_VENT: 154,
ASH_GROUND: 155, CHARRED_BONE: 156, LAVA_ROCK: 157, EMBER_POOL: 158,
BASALT: 159, FIRE_GEYSER: 160, MOLTEN_CHEST: 161, FIRE_ALTAR: 162,
SCORCHED_PATH: 163, MAGMA_PILLAR: 164, OBSIDIAN_SPIRE: 165,
```

## Step 2: Update SOLID Set

Add these tiles to the `SOLID` set:

```javascript
// Ice biome solids
T.ICE_WALL, T.ICICLE, T.FROZEN_TREE, T.SNOW_DRIFT, T.ICE_PILLAR, T.ICE_SPIRE,
T.FROZEN_CHEST, T.ICE_ALTAR,
// Volcanic biome solids
T.OBSIDIAN_SPIRE, T.MAGMA_PILLAR, T.FIRE_ALTAR, T.MOLTEN_CHEST,
T.VOLCANIC_VENT, T.FIRE_GEYSER,
```

## Step 3: Update HAZARD_TILES

Add to the `HAZARD_TILES` object:

```javascript
// Ice hazards
[T.FROST_VENT]: { dmg: 5, type: "ice", effect: "freeze", duration: 120 },
// Volcanic hazards
[T.MAGMA]: { dmg: 12, type: "fire", effect: "burn", duration: 240 },
[T.LAVA_FLOW]: { dmg: 10, type: "fire", effect: "burn", duration: 180 },
[T.FIRE_GEYSER]: { dmg: 18, type: "fire", effect: "burn", duration: 300 },
[T.EMBER_POOL]: { dmg: 6, type: "fire", effect: "burn", duration: 120 },
```

## Step 4: Add Light Source Sets

Add these new sets:

```javascript
const LIGHT_SOURCES_ICE = new Set([T.TORCH_WALL, T.ICE_CRYSTAL, T.BONFIRE, T.FROST_VENT]);
const LIGHT_SOURCES_VOLCANIC = new Set([T.TORCH_WALL, T.MAGMA, T.LAVA_FLOW, T.FIRE_GEYSER, T.EMBER_POOL, T.BONFIRE, T.VOLCANIC_VENT]);
```

## Step 5: Add Map Generator Functions

Copy the contents of `src/maps/iceMap.js` and `src/maps/volcanicMap.js` into Game.jsx after the other map generators.

## Step 6: Add Enemy Definitions

Add the enemy info from `src/data/newEnemies.js` to the `ENEMY_INFO` and `ENEMY_DEFAULTS` objects.

## Step 7: Add Map Refs in Game Component

In the `Game()` function, after the existing map refs, add:

```javascript
const iceData = useRef(generateIceMap());
const volcanicData = useRef(generateVolcanicMap());
```

## Step 8: Update Zone Detection Variables

In the game loop, add after existing zone checks:

```javascript
const isIce = zone === "ice";
const isVolcanic = zone === "volcanic";
```

## Step 9: Update Map Data Selection

Update the ternary chain for `md`:

```javascript
const md = isTown ? townData.current 
  : isForest ? forestData.current 
  : isCave ? caveData.current 
  : isCrypt ? cryptData.current 
  : isGraveyard ? graveyardData.current 
  : isDesert ? desertData.current 
  : isIce ? iceData.current
  : isVolcanic ? volcanicData.current
  : ruinData.current;
```

## Step 10: Update changeZone Function

Add enemy creation for new zones:

```javascript
else if (newZone === "ice") g.enemies = createIceEnemies();
else if (newZone === "volcanic") g.enemies = createVolcanicEnemies();
```

Update labels:

```javascript
const labels = {
  town: "Ashenmoor", forest: "The Darkwood", cave: "Hollow Caves",
  ruin: "The Ashen City", crypt: "The Catacombs", graveyard: "Old Graveyard",
  desert: "Scorched Desert", ice: "The Frozen Wastes", volcanic: "Volcanic Depths"
};
```

## Step 11: Fix Town Transitions (BUG FIX)

Find the town zone transitions and update:

```javascript
// NORTH EXIT - Forest (FIXED: added x-coordinate bounds)
if (pty <= 8 && ptx >= 28 && ptx <= 48) {
  changeZone("forest", 34, 58);
}

// WEST EXIT - Ice (NEW)
if (ptx <= 8 && pty >= 25 && pty <= 45) {
  changeZone("ice", 55, 30);
}
```

## Step 12: Fix Desert Transitions (BUG FIX)

Update desert spawn coordinates and add volcanic exit:

```javascript
// From town to desert - spawn at north entrance (FIXED coordinates)
changeZone("desert", 30, 6);

// SOUTH EXIT from desert to volcanic (NEW)
if (pty >= MAP_H - 5) {
  changeZone("volcanic", 30, 6);
}
```

## Step 13: Add Ice Zone Transitions

```javascript
// ICE zone transitions
if (isIce) {
  const MAP_W = iceData.current.w, MAP_H = iceData.current.h;
  // EAST EXIT - back to town
  if (ptx >= MAP_W - 5 && pty >= 26 && pty <= 35) {
    changeZone("town", 10, 35);
  }
}
```

## Step 14: Add Volcanic Zone Transitions

```javascript
// VOLCANIC zone transitions
if (isVolcanic) {
  const MAP_W = volcanicData.current.w, MAP_H = volcanicData.current.h;
  // NORTH EXIT - back to desert
  if (pty <= 5) {
    changeZone("desert", 30, 45);
  }
}
```

## Step 15: Fix Prologue Messages (BUG FIX)

Find the useEffect that shows prologue messages and add phase check:

```javascript
useEffect(() => {
  const g = gameRef.current;
  if (phaseRef.current !== "ruin" || g.flashbackComplete) return;
  
  const t1 = setTimeout(() => showNotif("The Ashen City...", 3000), 800);
  const t2 = setTimeout(() => showNotif("Find a way through the ruins", 4000), 4500);
  return () => { clearTimeout(t1); clearTimeout(t2); };
}, [showNotif]);
```

## Step 16: Update handleRespawn

Add ice/volcanic to respawn handling:

```javascript
else if (z === "ice") { g.player.x = 55 * TILE; g.player.y = 30 * TILE; g.enemies = createIceEnemies(); }
else if (z === "volcanic") { g.player.x = 30 * TILE; g.player.y = 6 * TILE; g.enemies = createVolcanicEnemies(); }
```

## Step 17: Update Background Colors

In the game loop, update bgColor:

```javascript
const bgColor = isTown ? "#1a3a18" 
  : isForest ? "#0a1a08" 
  : isCave ? "#060610" 
  : isGraveyard ? "#0a0a10" 
  : isDesert ? "#c4a060"
  : isIce ? "#1a2030"
  : isVolcanic ? "#1a0808"
  : "#06060a";
```

## Step 18: Update Minimap Colors

Add minimap background colors for new zones:

```javascript
: zone2 === "ice" ? "rgba(20,30,45,0.95)"
: zone2 === "volcanic" ? "rgba(30,15,10,0.95)"
```

## Step 19: Update Lighting Darkness

In renderLighting, update darkness values:

```javascript
const darkness = zone === "cave" ? 0.55 
  : zone === "forest" ? 0.25 
  : zone === "crypt" ? 0.58 
  : zone === "desert" ? 0.15
  : zone === "ice" ? 0.20
  : zone === "volcanic" ? 0.30
  : 0.35;
```

## Step 20: Add Tile Rendering

Copy the tile rendering functions from `src/rendering/iceTiles.js` and `src/rendering/volcanicTiles.js` into the drawTile function.

---

## Files Included

- `src/maps/iceMap.js` - Ice map generator
- `src/maps/volcanicMap.js` - Volcanic map generator  
- `src/data/newEnemies.js` - New enemy definitions
- `src/data/newTiles.js` - New tile constants
- `src/enemies/iceEnemies.js` - Ice enemy creation function
- `src/enemies/volcanicEnemies.js` - Volcanic enemy creation function
- `src/rendering/iceTiles.js` - Ice tile rendering
- `src/rendering/volcanicTiles.js` - Volcanic tile rendering

---

## Testing Checklist

- [ ] Can access Ice biome from town's west exit
- [ ] Can return to town from Ice biome's east exit
- [ ] Ice enemies spawn and function correctly
- [ ] Ice Titan boss works with freeze effect
- [ ] Frost vent hazards deal damage and freeze
- [ ] Can access Volcanic biome from desert's south exit
- [ ] Can return to desert from Volcanic biome's north exit
- [ ] Volcanic enemies spawn and function correctly
- [ ] Infernal Lord boss works with burn effect
- [ ] Lava/magma hazards deal damage and burn
- [ ] Forest is accessible from town (bug fix verified)
- [ ] Desert spawns player at north entrance (bug fix verified)
- [ ] Prologue messages only appear in ruins (bug fix verified)
