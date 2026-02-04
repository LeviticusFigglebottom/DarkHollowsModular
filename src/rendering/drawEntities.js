// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — ENTITY RENDERING
// Player, enemies, projectiles, and effects
// ═══════════════════════════════════════════════════════════════

import { TILE } from '../constants/config.js';
import { ENEMY_INFO } from '../data/enemies.js';

// ═══════════════════════════════════════════════════════════════
// PLAYER RENDERING
// ═══════════════════════════════════════════════════════════════

export const drawPlayer = (ctx, player, camX, camY, equipped, activeUlt, statusEffects = []) => {
  const px = player.x - camX;
  const py = player.y - camY;
  const ts = TILE;
  
  // Don't draw if dodging with invulnerability frames
  if (player.dodging && Math.floor(player.dodgeTimer * 4) % 2 === 0) {
    return;
  }
  
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(px + 20, py + 38, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Ultimate effect aura
  if (activeUlt) {
    const auraColor = activeUlt.type === "berserker" ? "rgba(255,60,60,0.3)" :
                      activeUlt.type === "ironwill" ? "rgba(60,180,100,0.3)" :
                      "rgba(150,100,255,0.3)";
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(px + 20, py + 25, 25 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Status effect visuals
  statusEffects.forEach(eff => {
    if (eff.type === "burn") {
      ctx.fillStyle = "rgba(255,100,30,0.4)";
      ctx.beginPath();
      ctx.arc(px + 20, py + 20, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (eff.type === "freeze") {
      ctx.fillStyle = "rgba(100,180,255,0.3)";
      ctx.beginPath();
      ctx.arc(px + 20, py + 20, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (eff.type === "poison" || eff.type === "venom") {
      ctx.fillStyle = "rgba(100,200,60,0.3)";
      ctx.beginPath();
      ctx.arc(px + 20, py + 20, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Body
  const bodyColor = activeUlt?.type === "berserker" ? "#a02020" :
                    activeUlt?.type === "ironwill" ? "#208040" : "#3a5060";
  ctx.fillStyle = bodyColor;
  ctx.fillRect(px + 12, py + 14, 16, 20);
  
  // Cloak/armor
  const armorColor = equipped?.armor ? "#4a4050" : "#2a3040";
  ctx.fillStyle = armorColor;
  ctx.fillRect(px + 10, py + 16, 20, 16);
  
  // Head
  ctx.fillStyle = "#d8c8b0";
  ctx.fillRect(px + 14, py + 6, 12, 12);
  
  // Eyes (direction-based)
  ctx.fillStyle = "#1a1a1a";
  if (player.dir === 0) { // Up
    ctx.fillRect(px + 16, py + 8, 2, 2);
    ctx.fillRect(px + 22, py + 8, 2, 2);
  } else if (player.dir === 2) { // Down
    ctx.fillRect(px + 16, py + 12, 2, 2);
    ctx.fillRect(px + 22, py + 12, 2, 2);
  } else if (player.dir === 1) { // Right
    ctx.fillRect(px + 22, py + 10, 2, 2);
  } else { // Left
    ctx.fillRect(px + 16, py + 10, 2, 2);
  }
  
  // Legs (animated)
  const legOffset = Math.sin(player.frame * 0.5) * 3;
  ctx.fillStyle = "#2a3040";
  ctx.fillRect(px + 14, py + 32, 5, 8 + legOffset);
  ctx.fillRect(px + 21, py + 32, 5, 8 - legOffset);
  
  // Weapon
  if (equipped?.weapon) {
    drawWeapon(ctx, px, py, player.aimAngle, player.attackFrame, equipped.weapon);
  }
};

const drawWeapon = (ctx, px, py, aimAngle, attackFrame, weapon) => {
  ctx.save();
  ctx.translate(px + 20, py + 20);
  ctx.rotate(aimAngle);
  
  // Weapon swing animation
  const swingOffset = attackFrame > 0 ? Math.sin(attackFrame * 0.5) * 20 : 0;
  ctx.rotate(swingOffset * Math.PI / 180);
  
  if (weapon.stats?.isRanged) {
    // Bow
    ctx.strokeStyle = "#5a4030";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(15, 0, 12, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
    // String
    ctx.strokeStyle = "#a0a0a0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, -8);
    ctx.lineTo(15, 8);
    ctx.stroke();
  } else {
    // Sword
    const bladeColor = weapon.stats?.effect === "freeze" ? "#80c0e0" :
                       weapon.stats?.effect === "burn" ? "#ff6030" : "#a0a8b8";
    ctx.fillStyle = bladeColor;
    ctx.fillRect(10, -2, 25, 4);
    // Hilt
    ctx.fillStyle = "#4a3020";
    ctx.fillRect(5, -4, 8, 8);
    // Pommel
    ctx.fillStyle = "#6a5040";
    ctx.fillRect(2, -2, 4, 4);
  }
  
  ctx.restore();
};

// ═══════════════════════════════════════════════════════════════
// ENEMY RENDERING
// ═══════════════════════════════════════════════════════════════

export const drawEnemy = (ctx, enemy, camX, camY, ts) => {
  const ex = enemy.x - camX;
  const ey = enemy.y - camY;
  const info = ENEMY_INFO[enemy.type] || {};
  
  // Death animation
  if (enemy.dead) {
    const alpha = 1 - (enemy.deathTimer / 30);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
  }
  
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(ex + 20, ey + 38, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Status effect aura
  if (enemy.statusEffects?.length > 0) {
    enemy.statusEffects.forEach(eff => {
      if (eff.type === "burn") {
        ctx.fillStyle = "rgba(255,100,30,0.3)";
        ctx.beginPath();
        ctx.arc(ex + 20, ey + 20, 22, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === "freeze") {
        ctx.fillStyle = "rgba(100,180,255,0.25)";
        ctx.beginPath();
        ctx.arc(ex + 20, ey + 20, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  
  // Body based on enemy type
  const baseColor = info.color || "#3a3040";
  ctx.fillStyle = baseColor;
  
  if (info.canTeleport) {
    // Wraith-like enemies - ethereal
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(ex + 10, ey + 35);
    ctx.quadraticCurveTo(ex + 5, ey + 15, ex + 20, ey + 5);
    ctx.quadraticCurveTo(ex + 35, ey + 15, ex + 30, ey + 35);
    ctx.fill();
    ctx.globalAlpha = enemy.dead ? ctx.globalAlpha : 1;
  } else if (info.isRanged) {
    // Archer/ranged enemies - thinner
    ctx.fillRect(ex + 14, ey + 10, 12, 25);
    // Bow
    ctx.strokeStyle = "#5a4030";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex + 30, ey + 20, 10, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  } else if (info.isBoss) {
    // Boss enemies - larger
    ctx.fillRect(ex + 5, ey + 5, 30, 35);
    // Crown/horns
    ctx.fillStyle = "#c4a43e";
    ctx.beginPath();
    ctx.moveTo(ex + 10, ey + 5);
    ctx.lineTo(ex + 15, ey - 5);
    ctx.lineTo(ex + 20, ey + 5);
    ctx.lineTo(ex + 25, ey - 5);
    ctx.lineTo(ex + 30, ey + 5);
    ctx.fill();
  } else {
    // Standard enemies
    ctx.fillRect(ex + 10, ey + 10, 20, 28);
    // Head
    ctx.beginPath();
    ctx.arc(ex + 20, ey + 12, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Eyes
  ctx.fillStyle = info.isBoss ? "#ff4040" : "#ff6060";
  ctx.fillRect(ex + 14, ey + 14, 3, 3);
  ctx.fillRect(ex + 23, ey + 14, 3, 3);
  
  // Health bar (if damaged)
  if (enemy.hp < enemy.maxHp) {
    const barWidth = 30;
    const hpPercent = enemy.hp / enemy.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(ex + 5, ey - 5, barWidth, 4);
    ctx.fillStyle = hpPercent > 0.5 ? "#40c040" : hpPercent > 0.25 ? "#c0c040" : "#c04040";
    ctx.fillRect(ex + 5, ey - 5, barWidth * hpPercent, 4);
  }
  
  // Boss name
  if (info.isBoss && !enemy.dead) {
    ctx.fillStyle = "#c4a43e";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(info.name, ex + 20, ey - 10);
    ctx.textAlign = "left";
  }
  
  ctx.globalAlpha = 1;
};

// ═══════════════════════════════════════════════════════════════
// PROJECTILE RENDERING
// ═══════════════════════════════════════════════════════════════

export const drawProjectile = (ctx, proj, camX, camY) => {
  const prx = proj.x - camX;
  const pry = proj.y - camY;
  const angle = Math.atan2(proj.vy, proj.vx);
  
  ctx.save();
  ctx.translate(prx, pry);
  ctx.rotate(angle);
  
  if (proj.isEnemy) {
    // Enemy projectile - darker
    ctx.fillStyle = "#5a4030";
    ctx.fillRect(-8, -1.5, 16, 3);
    ctx.fillStyle = "#808890";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(3, -3);
    ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.fill();
  } else {
    // Player arrow
    ctx.fillStyle = "#6a5040";
    ctx.fillRect(-8, -1, 16, 2);
    // Arrow head
    ctx.fillStyle = "#a0a8b8";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(5, -3);
    ctx.lineTo(5, 3);
    ctx.closePath();
    ctx.fill();
    // Fletching
    ctx.fillStyle = "#8a6a50";
    ctx.fillRect(-10, -2, 4, 1);
    ctx.fillRect(-10, 1, 4, 1);
    // Trail
    ctx.strokeStyle = "rgba(160,140,120,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-20, 0);
    ctx.stroke();
  }
  
  ctx.restore();
};

// ═══════════════════════════════════════════════════════════════
// FLOATING TEXT RENDERING
// ═══════════════════════════════════════════════════════════════

export const drawFloatingText = (ctx, ft, camX, camY) => {
  const alpha = ft.life / 50;
  const rise = (50 - ft.life) * 0.5;
  
  ctx.globalAlpha = alpha;
  ctx.font = ft.crit ? "bold 14px monospace" : "12px monospace";
  ctx.fillStyle = ft.color;
  ctx.textAlign = "center";
  ctx.fillText(ft.text, ft.x - camX, ft.y - camY - rise);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
};

// ═══════════════════════════════════════════════════════════════
// ITEM ICON RENDERING
// ═══════════════════════════════════════════════════════════════

export const drawItemIcon = (ctx, iconType, x, y, size) => {
  const s = size / 28; // Scale factor
  
  switch (iconType) {
    case "sword":
    case "sword_rusted":
    case "sword_silver":
    case "sword_ice":
    case "sword_fire":
      drawSwordIcon(ctx, x, y, s, iconType);
      break;
    case "bow":
      drawBowIcon(ctx, x, y, s);
      break;
    case "potion_red":
    case "potion_red_large":
      drawPotionIcon(ctx, x, y, s, "#c04040");
      break;
    case "potion_green":
      drawPotionIcon(ctx, x, y, s, "#40a040");
      break;
    case "potion_blue":
      drawPotionIcon(ctx, x, y, s, "#4080c0");
      break;
    case "potion_purple":
      drawPotionIcon(ctx, x, y, s, "#8040a0");
      break;
    case "potion_orange":
      drawPotionIcon(ctx, x, y, s, "#c08040");
      break;
    case "armor_cloth":
    case "armor_leather":
    case "armor_chain":
    case "armor_plate":
    case "armor_ice":
    case "armor_fire":
      drawArmorIcon(ctx, x, y, s, iconType);
      break;
    case "relic_dark":
    case "relic_red":
    case "relic_green":
    case "relic_purple":
    case "relic_ice":
    case "relic_fire":
      drawRelicIcon(ctx, x, y, s, iconType);
      break;
    case "key":
    case "key_green":
      drawKeyIcon(ctx, x, y, s, iconType === "key_green");
      break;
    default:
      // Generic item
      ctx.fillStyle = "#5a5060";
      ctx.fillRect(x + 4 * s, y + 4 * s, 20 * s, 20 * s);
      break;
  }
};

const drawSwordIcon = (ctx, x, y, s, type) => {
  // Blade
  const bladeColor = type === "sword_ice" ? "#80c0e0" :
                     type === "sword_fire" ? "#ff6030" :
                     type === "sword_silver" ? "#d0d8e0" :
                     type === "sword_rusted" ? "#8a6a50" : "#a0a8b8";
  ctx.fillStyle = bladeColor;
  ctx.save();
  ctx.translate(x + 14 * s, y + 14 * s);
  ctx.rotate(-Math.PI / 4);
  ctx.fillRect(-2 * s, -12 * s, 4 * s, 18 * s);
  ctx.restore();
  // Hilt
  ctx.fillStyle = "#4a3020";
  ctx.fillRect(x + 10 * s, y + 16 * s, 8 * s, 4 * s);
  // Guard
  ctx.fillStyle = "#6a5040";
  ctx.fillRect(x + 8 * s, y + 14 * s, 12 * s, 3 * s);
};

const drawBowIcon = (ctx, x, y, s) => {
  ctx.strokeStyle = "#5a4030";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x + 14 * s, y + 14 * s, 10 * s, -Math.PI * 0.7, Math.PI * 0.7);
  ctx.stroke();
  ctx.strokeStyle = "#a0a0a0";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y + 6 * s);
  ctx.lineTo(x + 8 * s, y + 22 * s);
  ctx.stroke();
};

const drawPotionIcon = (ctx, x, y, s, color) => {
  // Bottle
  ctx.fillStyle = "#3a3a4a";
  ctx.fillRect(x + 10 * s, y + 4 * s, 8 * s, 6 * s);
  // Liquid
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 6 * s, y + 24 * s);
  ctx.lineTo(x + 8 * s, y + 10 * s);
  ctx.lineTo(x + 20 * s, y + 10 * s);
  ctx.lineTo(x + 22 * s, y + 24 * s);
  ctx.closePath();
  ctx.fill();
  // Cork
  ctx.fillStyle = "#6a5040";
  ctx.fillRect(x + 11 * s, y + 2 * s, 6 * s, 4 * s);
};

const drawArmorIcon = (ctx, x, y, s, type) => {
  const color = type === "armor_plate" ? "#6a6a7a" :
                type === "armor_chain" ? "#8a8a9a" :
                type === "armor_ice" ? "#80b0d0" :
                type === "armor_fire" ? "#c06040" :
                type === "armor_leather" ? "#6a5040" : "#4a4050";
  ctx.fillStyle = color;
  // Torso
  ctx.fillRect(x + 8 * s, y + 8 * s, 12 * s, 14 * s);
  // Shoulders
  ctx.fillRect(x + 4 * s, y + 8 * s, 6 * s, 6 * s);
  ctx.fillRect(x + 18 * s, y + 8 * s, 6 * s, 6 * s);
  // Neckline
  ctx.fillStyle = "#2a2a3a";
  ctx.beginPath();
  ctx.arc(x + 14 * s, y + 8 * s, 4 * s, 0, Math.PI);
  ctx.fill();
};

const drawRelicIcon = (ctx, x, y, s, type) => {
  const color = type === "relic_red" ? "#c04040" :
                type === "relic_green" ? "#40a040" :
                type === "relic_purple" ? "#8040a0" :
                type === "relic_ice" ? "#60a0c0" :
                type === "relic_fire" ? "#c06030" : "#4a4060";
  // Gem
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y + 4 * s);
  ctx.lineTo(x + 22 * s, y + 14 * s);
  ctx.lineTo(x + 14 * s, y + 24 * s);
  ctx.lineTo(x + 6 * s, y + 14 * s);
  ctx.closePath();
  ctx.fill();
  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y + 6 * s);
  ctx.lineTo(x + 18 * s, y + 14 * s);
  ctx.lineTo(x + 14 * s, y + 14 * s);
  ctx.closePath();
  ctx.fill();
};

const drawKeyIcon = (ctx, x, y, s, isGreen) => {
  ctx.fillStyle = isGreen ? "#60a060" : "#c4a43e";
  // Handle
  ctx.beginPath();
  ctx.arc(x + 10 * s, y + 10 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2a3a";
  ctx.beginPath();
  ctx.arc(x + 10 * s, y + 10 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  // Shaft
  ctx.fillStyle = isGreen ? "#60a060" : "#c4a43e";
  ctx.fillRect(x + 12 * s, y + 8 * s, 12 * s, 4 * s);
  // Teeth
  ctx.fillRect(x + 20 * s, y + 12 * s, 2 * s, 4 * s);
  ctx.fillRect(x + 16 * s, y + 12 * s, 2 * s, 3 * s);
};

// ═══════════════════════════════════════════════════════════════
// NPC RENDERING
// ═══════════════════════════════════════════════════════════════

export const drawNPC = (ctx, npc, camX, camY) => {
  const nx = npc.x - camX;
  const ny = npc.y - camY;
  
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(nx + 20, ny + 38, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body based on NPC type
  if (npc.type === "knight") {
    // Wounded knight
    ctx.fillStyle = "#4a4858";
    ctx.fillRect(nx + 8, ny + 14, 24, 22);
    // Head
    ctx.fillStyle = "#d8c8b0";
    ctx.fillRect(nx + 12, ny + 6, 16, 12);
    // Blood
    ctx.fillStyle = "#8a2020";
    ctx.fillRect(nx + 14, ny + 28, 12, 6);
  } else if (npc.type === "merchant") {
    // Merchant
    ctx.fillStyle = "#5a4030";
    ctx.fillRect(nx + 10, ny + 12, 20, 24);
    ctx.fillStyle = "#d8c8b0";
    ctx.fillRect(nx + 14, ny + 4, 12, 12);
    // Hat
    ctx.fillStyle = "#6a5040";
    ctx.fillRect(nx + 12, ny + 2, 16, 4);
  } else {
    // Generic NPC
    ctx.fillStyle = "#5a5868";
    ctx.fillRect(nx + 12, ny + 14, 16, 20);
    ctx.fillStyle = "#d8c8b0";
    ctx.fillRect(nx + 14, ny + 6, 12, 12);
  }
  
  // Interaction indicator
  ctx.fillStyle = "#c4a43e";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("!", nx + 20, ny - 5);
  ctx.textAlign = "left";
};
