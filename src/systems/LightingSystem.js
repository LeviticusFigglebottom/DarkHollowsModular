// ═══════════════════════════════════════════════════════════════════
// DARK HOLLOWS — LIGHTING SYSTEM
// ═══════════════════════════════════════════════════════════════════

import { TILE, VIEW_W, VIEW_H, CANVAS_W, CANVAS_H, getGFX, ZONE_DARKNESS } from '../constants/config.js';
import { LIGHT_SOURCES } from '../data/tiles.js';
import { getLightingCanvas, getVignetteCanvas } from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════
// LIGHT SOURCE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

const LIGHT_PROPERTIES = {
  torch: { radius: 120, color: [255, 180, 80], intensity: 0.9, flicker: 0.15 },
  bonfire: { radius: 180, color: [255, 160, 60], intensity: 1.0, flicker: 0.2 },
  campfire: { radius: 140, color: [255, 150, 50], intensity: 0.85, flicker: 0.18 },
  soul_flame: { radius: 100, color: [80, 150, 255], intensity: 0.8, flicker: 0.1 },
  crystal: { radius: 80, color: [150, 200, 255], intensity: 0.6, flicker: 0.05 },
  mushroom: { radius: 60, color: [100, 255, 150], intensity: 0.5, flicker: 0.08 },
  magma: { radius: 100, color: [255, 100, 30], intensity: 0.7, flicker: 0.25 },
  ember: { radius: 70, color: [255, 120, 40], intensity: 0.6, flicker: 0.3 },
  ice_crystal: { radius: 90, color: [180, 220, 255], intensity: 0.65, flicker: 0.03 },
  player: { radius: 140, color: [255, 240, 200], intensity: 0.7, flicker: 0.05 },
};

// ═══════════════════════════════════════════════════════════════════
// LIGHTING SYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════

class LightingSystemClass {
  constructor() {
    this.lightCanvas = null;
    this.lightCtx = null;
    this.vignetteCache = new Map();
    this.frameCount = 0;
  }

  // Initialize or get lighting canvas
  getCanvas() {
    if (!this.lightCanvas) {
      this.lightCanvas = getLightingCanvas();
      this.lightCtx = this.lightCanvas.getContext('2d');
    }
    return { canvas: this.lightCanvas, ctx: this.lightCtx };
  }

  // Get flicker multiplier for a light type
  getFlicker(lightType, frame) {
    const props = LIGHT_PROPERTIES[lightType] || LIGHT_PROPERTIES.torch;
    const flickerAmount = props.flicker;
    return 1 - flickerAmount + Math.sin(frame * 0.15 + Math.random() * 0.3) * flickerAmount;
  }

  // Collect light sources from visible map area
  collectLightSources(map, camX, camY, zone, player) {
    const GFX = getGFX();
    const lights = [];
    const zoneLights = LIGHT_SOURCES[zone] || [];
    
    // Determine visible tile range
    const startTileX = Math.floor(camX / TILE) - 2;
    const startTileY = Math.floor(camY / TILE) - 2;
    const endTileX = startTileX + VIEW_W + 4;
    const endTileY = startTileY + VIEW_H + 4;
    
    // Scan map for light-emitting tiles
    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        if (ty < 0 || ty >= map.length || tx < 0 || tx >= map[0].length) continue;
        
        const tile = map[ty][tx];
        const lightInfo = zoneLights.find(l => l.tile === tile);
        
        if (lightInfo) {
          lights.push({
            x: tx * TILE + TILE / 2 - camX,
            y: ty * TILE + TILE / 2 - camY,
            type: lightInfo.type,
            ...LIGHT_PROPERTIES[lightInfo.type],
          });
        }
      }
    }
    
    // Add player light
    if (player) {
      lights.push({
        x: player.x + TILE / 2 - camX,
        y: player.y + TILE / 2 - camY,
        type: 'player',
        ...LIGHT_PROPERTIES.player,
      });
    }
    
    return lights;
  }

  // Draw a single light source
  drawLight(ctx, light, frame) {
    const flicker = this.getFlicker(light.type, frame);
    const radius = light.radius * flicker;
    const [r, g, b] = light.color;
    const intensity = light.intensity * flicker;
    
    const gradient = ctx.createRadialGradient(
      light.x, light.y, 0,
      light.x, light.y, radius
    );
    
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity})`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${intensity * 0.6})`);
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${intensity * 0.2})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Render complete lighting layer
  render(mainCtx, map, camX, camY, zone, player, frame) {
    const GFX = getGFX();
    if (!GFX.lighting) return;
    
    const { canvas, ctx } = this.getCanvas();
    const darkness = ZONE_DARKNESS[zone] || 0.3;
    
    // Clear to darkness
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    
    // Collect and draw lights using "lighter" blend mode
    ctx.globalCompositeOperation = 'lighter';
    const lights = this.collectLightSources(map, camX, camY, zone, player);
    
    // Quality-based rendering
    const step = GFX.lightingQuality === 2 ? 1 : GFX.lightingQuality === 1 ? 2 : 4;
    
    for (let i = 0; i < lights.length; i += step) {
      this.drawLight(ctx, lights[i], frame);
    }
    
    // Apply lighting to main canvas
    ctx.globalCompositeOperation = 'source-over';
    mainCtx.globalCompositeOperation = 'multiply';
    mainCtx.drawImage(canvas, 0, 0);
    mainCtx.globalCompositeOperation = 'source-over';
  }

  // Render vignette effect
  renderVignette(ctx, alpha = 0.4) {
    const GFX = getGFX();
    if (!GFX.vignette) return;
    
    const vignetteCanvas = getVignetteCanvas(alpha);
    if (vignetteCanvas) {
      ctx.drawImage(vignetteCanvas, 0, 0);
    }
  }

  // Render atmospheric effects (fog, particles)
  renderAtmosphere(ctx, zone, frame, camX, camY) {
    const GFX = getGFX();
    if (!GFX.atmosphericEffects) return;
    
    const density = GFX.atmosphericDensity;
    
    // Zone-specific atmosphere
    switch (zone) {
      case 'graveyard':
        this.renderFog(ctx, frame, density * 0.8);
        break;
      case 'volcanic':
        this.renderEmbers(ctx, frame, density);
        break;
      case 'ice':
        this.renderSnow(ctx, frame, density * 0.6);
        break;
      case 'cave':
        this.renderDust(ctx, frame, density * 0.4);
        break;
      case 'crypt':
        this.renderFog(ctx, frame, density * 0.5);
        break;
    }
  }

  // Fog effect
  renderFog(ctx, frame, density) {
    ctx.save();
    ctx.globalAlpha = density * 0.15;
    
    const fogLayers = 3;
    for (let i = 0; i < fogLayers; i++) {
      const offset = Math.sin(frame * 0.01 + i * 2) * 20;
      ctx.fillStyle = `rgba(100, 100, 120, ${0.05 + i * 0.02})`;
      
      for (let y = 0; y < CANVAS_H; y += 60) {
        for (let x = 0; x < CANVAS_W; x += 80) {
          const wobble = Math.sin(frame * 0.02 + x * 0.01 + y * 0.01) * 10;
          ctx.beginPath();
          ctx.ellipse(x + offset + wobble, y + i * 20, 60, 30, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
  }

  // Ember particles
  renderEmbers(ctx, frame, density) {
    ctx.save();
    const numEmbers = Math.floor(20 * density);
    
    for (let i = 0; i < numEmbers; i++) {
      const seed = i * 1337;
      const x = ((seed * 7919) % CANVAS_W);
      const y = CANVAS_H - ((frame * 0.5 + seed * 13) % (CANVAS_H + 50));
      const size = 2 + (seed % 3);
      const alpha = 0.5 + Math.sin(frame * 0.1 + i) * 0.3;
      
      ctx.fillStyle = `rgba(255, ${100 + (seed % 80)}, 30, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(frame * 0.05 + i) * 5, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Snow particles
  renderSnow(ctx, frame, density) {
    ctx.save();
    const numFlakes = Math.floor(30 * density);
    
    for (let i = 0; i < numFlakes; i++) {
      const seed = i * 2357;
      const x = ((seed * 4919 + frame * 0.2) % CANVAS_W);
      const y = ((frame * 0.8 + seed * 17) % CANVAS_H);
      const size = 1 + (seed % 2);
      
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(i) * 0.2})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(frame * 0.03 + i) * 3, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Dust particles
  renderDust(ctx, frame, density) {
    ctx.save();
    const numDust = Math.floor(15 * density);
    
    for (let i = 0; i < numDust; i++) {
      const seed = i * 3571;
      const x = ((seed * 6173 + Math.sin(frame * 0.01) * 20) % CANVAS_W);
      const y = ((seed * 8831) % CANVAS_H);
      const size = 1 + (seed % 2);
      
      ctx.fillStyle = `rgba(180, 170, 150, ${0.2 + Math.sin(frame * 0.05 + i) * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y + Math.sin(frame * 0.02 + i) * 5, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Full lighting pass
  applyLighting(mainCtx, map, camX, camY, zone, player, frame) {
    this.render(mainCtx, map, camX, camY, zone, player, frame);
    this.renderAtmosphere(mainCtx, zone, frame, camX, camY);
    this.renderVignette(mainCtx);
  }
}

// Export singleton
export const LightingSystem = new LightingSystemClass();

// Export individual functions for direct use
export const applyLighting = (ctx, map, camX, camY, zone, player, frame) => {
  LightingSystem.applyLighting(ctx, map, camX, camY, zone, player, frame);
};

export const renderVignette = (ctx, alpha) => {
  LightingSystem.renderVignette(ctx, alpha);
};
