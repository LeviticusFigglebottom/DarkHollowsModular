# Dark Hollows - The Ashen City

A 2D action RPG built with React 18 and Vite.

## Version 1.2.0 - Changelog

### Bug Fixes

1. **Forest Access Bug Fixed**
   - Town north exit now properly bounded to x coordinates 28-48
   - Previously, players could exit to the forest from anywhere along the north edge

2. **Desert Spawn Position Fixed**
   - Entering the desert from town now spawns at (30, 6) instead of (29, 2)
   - Prevents immediate zone re-entry due to spawning too close to exit

3. **Prologue Messages Fixed**
   - "The Ashen City..." and "Find a way through the ruins" messages now only appear when starting in the ruin zone
   - Previously these messages would show regardless of starting zone

### New Content

#### Ice Biome - Frozen Wastes (West of Town)
- 60x65 map with frozen tundra, ice formations, and aurora effects
- **New Tile Types**: Snow, Ice Floor, Frozen Lake, Ice Crystals, Frost Vents, Aurora Stones
- **New Enemies**:
  - Frost Wolf (applies freeze effect)
  - Ice Wraith (teleports, applies freeze)
  - Frozen Knight (heavy melee)
  - Snow Stalker (fast hunter)
  - Crystal Golem (slow, tanky)
  - **Boss: Ice Titan** (140 XP, freeze attacks)
- Darkness level: 0.20 (bright snowy atmosphere)
- Hazards: Frost Vents (cold damage), Cracked Ice

#### Volcanic Biome - Volcanic Depths (South of Desert)
- 60x65 map with lava rivers, obsidian formations, and fire geysers
- **New Tile Types**: Volcanic Rock, Magma, Lava Flow, Fire Geysers, Obsidian, Sulfur Pools
- **New Enemies**:
  - Magma Hound (applies burn effect)
  - Ember Wraith (teleports, applies burn)
  - Obsidian Golem (very tanky)
  - Flame Imp (ranged, applies burn)
  - Ash Crawler (basic enemy)
  - **Boss: Infernal Lord** (160 XP, devastating burn attacks)
- Darkness level: 0.30 (dim volcanic glow)
- Hazards: Magma, Lava Flow, Fire Geysers, Volcanic Vents

### Zone Connections

```
                    ┌─────────────┐
                    │   FOREST    │
                    │ (Darkwood)  │
                    └──────┬──────┘
                           │ South
    ┌─────────────┐        ▼        ┌─────────────┐
    │     ICE     │◄──West/East──►│    TOWN     │◄──East/West──►│  GRAVEYARD  │
    │   (Frozen   │               │ (Ashenmoor) │               │             │
    │   Wastes)   │               └──────┬──────┘               └──────┬──────┘
    └─────────────┘                      │ South                       │ Down
                                         ▼                             ▼
                               ┌─────────────┐               ┌─────────────┐
                               │   DESERT    │               │    CRYPT    │
                               │ (Scorched)  │               │ (Catacombs) │
                               └──────┬──────┘               └─────────────┘
                                      │ South
                                      ▼
                               ┌─────────────┐
                               │  VOLCANIC   │
                               │  (Depths)   │
                               └─────────────┘
```

## Installation

```bash
npm install
npm run dev
```

## Building for Production

```bash
npm run build
```

## Deployment to Vercel

Simply connect the repository to Vercel and deploy. The `vercel.json` configuration is already included.

## Controls

- **WASD/Arrow Keys**: Move
- **Shift**: Sprint
- **Space**: Dodge roll
- **Left Click**: Attack
- **E**: Interact (NPCs, objects)
- **1-8**: Hotbar slots
- **Tab**: Character menu
- **I**: Inventory
- **Q**: Quest log
- **M**: Map

## Technical Notes

- React 18.3 with Vite 5.3
- Pure canvas-based rendering
- Procedural audio (Web Audio API)
- 16 tile types for Ice biome, 16 tile types for Volcanic biome
- Dynamic lighting system with zone-specific darkness levels
