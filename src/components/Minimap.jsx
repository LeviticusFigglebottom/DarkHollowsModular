// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — MINIMAP COMPONENT
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { TILE } from '../constants/config.js';
import { TILE_COLORS } from '../data/tiles.js';

const MINIMAP_SCALE = 2;

const ZONE_BG_COLORS = {
  ruin: 'rgba(5,5,10,0.95)',
  town: 'rgba(20,40,18,0.95)',
  forest: 'rgba(10,20,8,0.95)',
  cave: 'rgba(6,6,16,0.95)',
  crypt: 'rgba(10,10,18,0.95)',
  graveyard: 'rgba(10,10,14,0.95)',
  desert: 'rgba(40,35,20,0.95)',
  ice: 'rgba(20,30,45,0.95)',
  volcanic: 'rgba(30,15,10,0.95)',
};

const TILE_MINIMAP_COLORS = {
  // Solid/walls
  wall: '#404050',
  // Floors
  floor: '#282830',
  cobble: '#383840',
  grass: '#2a4020',
  dirt: '#4a3828',
  path: '#484038',
  sand: '#b8a060',
  snow: '#c0d0e0',
  ice: '#80b0d0',
  volcanic: '#403020',
  // Water
  water: '#304060',
  magma: '#c04020',
  // Special
  door: '#806020',
  chest: '#c0a040',
  npc: '#50c878',
  merchant: '#c4a43e',
  enemy: '#ff4040',
  boss: '#ff8040',
  player: '#e8e040',
};

/**
 * Minimap Component - shows overhead map view
 */
export function Minimap({
  gameRef,
  mapData,
  zone,
  playerX,
  playerY,
  enemies,
  npcs,
  showNpcs = true,
  showEnemies = true,
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext('2d');
    let animId;

    const draw = () => {
      // Update every 2nd frame for performance
      frameRef.current++;
      if (frameRef.current % 2 !== 0) {
        animId = requestAnimationFrame(draw);
        return;
      }

      const md = mapData;
      const s = MINIMAP_SCALE;
      
      // Set canvas size
      canvas.width = md.w * s;
      canvas.height = md.h * s;

      // Background
      ctx.fillStyle = ZONE_BG_COLORS[zone] || ZONE_BG_COLORS.ruin;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw tiles
      for (let y = 0; y < md.h; y++) {
        for (let x = 0; x < md.w; x++) {
          const t = md.map[y][x];
          const color = getTileColor(t, zone);
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * s, y * s, s, s);
          }
        }
      }

      // Draw enemies
      if (showEnemies && enemies) {
        enemies.forEach(e => {
          if (e.dead) return;
          const info = e.isBoss ? 'boss' : 'enemy';
          ctx.fillStyle = TILE_MINIMAP_COLORS[info];
          const ex = Math.floor(e.x / TILE);
          const ey = Math.floor(e.y / TILE);
          ctx.fillRect(ex * s, ey * s, s + 1, s + 1);
        });
      }

      // Draw NPCs
      if (showNpcs && npcs) {
        npcs.forEach(n => {
          if (n.dead) return;
          const color = n.shop ? TILE_MINIMAP_COLORS.merchant : TILE_MINIMAP_COLORS.npc;
          ctx.fillStyle = color;
          const nx = Math.floor(n.x / TILE);
          const ny = Math.floor(n.y / TILE);
          ctx.fillRect(nx * s, ny * s, s + 1, s + 1);
        });
      }

      // Draw player
      const ppx = Math.floor(playerX / TILE);
      const ppy = Math.floor(playerY / TILE);
      ctx.fillStyle = TILE_MINIMAP_COLORS.player;
      ctx.fillRect(ppx * s - 1, ppy * s - 1, s + 2, s + 2);

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [mapData, zone, playerX, playerY, enemies, npcs, showNpcs, showEnemies]);

  return (
    <div style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: TILE_MINIMAP_COLORS.player }} />
          You
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: TILE_MINIMAP_COLORS.enemy }} />
          Enemy
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: TILE_MINIMAP_COLORS.npc }} />
          NPC
        </span>
      </div>
    </div>
  );
}

/**
 * Get minimap color for a tile based on zone context
 */
function getTileColor(tileId, zone) {
  // Check predefined colors first
  if (TILE_COLORS[tileId]) {
    return TILE_COLORS[tileId];
  }

  // Default zone-based floor colors
  const zoneFloorColors = {
    ruin: '#282830',
    town: '#283028',
    forest: '#1a2a18',
    cave: '#181820',
    crypt: '#1a1a28',
    graveyard: '#1a1a20',
    desert: '#403828',
    ice: '#384858',
    volcanic: '#302018',
  };

  // Return zone floor color or default
  return zoneFloorColors[zone] || '#202028';
}

const styles = {
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    pointerEvents: 'none',
    zIndex: 100,
  },
  canvas: {
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    fontSize: 9,
    color: '#808090',
    fontFamily: 'monospace',
    background: 'rgba(0,0,0,0.6)',
    padding: '3px 6px',
    borderRadius: 3,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
};

export default Minimap;
