// ═══════════════════════════════════════════════════════════════════
// DARK HOLLOWS — MOVEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════

import { TILE, PLAYER_SPEED, SPRINT_MULT, SPRINT_COST, STAMINA_REGEN, STAMINA_REGEN_IDLE, getGFX } from '../constants/config.js';
import { T, SOLID, HAZARD_TILES, SLIPPERY } from '../data/tiles.js';
import { SoundSystem } from './SoundSystem.js';
import { getFloatingText, clamp } from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════
// COLLISION DETECTION
// ═══════════════════════════════════════════════════════════════════

export const checkMapCollision = (map, x, y, width = TILE - 8, height = TILE - 8) => {
  const padding = 4;
  const left = x + padding;
  const right = x + width - padding;
  const top = y + padding;
  const bottom = y + height - padding;
  
  // Check all four corners and center points
  const checkPoints = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
    [(left + right) / 2, top],
    [(left + right) / 2, bottom],
    [left, (top + bottom) / 2],
    [right, (top + bottom) / 2],
  ];
  
  for (const [px, py] of checkPoints) {
    const tileX = Math.floor(px / TILE);
    const tileY = Math.floor(py / TILE);
    
    if (tileX < 0 || tileY < 0 || tileY >= map.length || tileX >= map[0].length) {
      return true; // Out of bounds = collision
    }
    
    const tile = map[tileY][tileX];
    if (SOLID.has(tile)) {
      return true;
    }
  }
  
  return false;
};

export const checkTileAt = (map, x, y) => {
  const tileX = Math.floor(x / TILE);
  const tileY = Math.floor(y / TILE);
  
  if (tileX < 0 || tileY < 0 || tileY >= map.length || tileX >= map[0].length) {
    return T.VOID;
  }
  
  return map[tileY][tileX];
};

export const isOnSlipperyTile = (map, x, y) => {
  const centerTile = checkTileAt(map, x + TILE / 2, y + TILE / 2);
  return SLIPPERY.has(centerTile);
};

export const getHazardAt = (map, x, y) => {
  const centerTile = checkTileAt(map, x + TILE / 2, y + TILE / 2);
  return HAZARD_TILES[centerTile] || null;
};

// ═══════════════════════════════════════════════════════════════════
// PLAYER MOVEMENT
// ═══════════════════════════════════════════════════════════════════

export const calculateMovement = (input, stamina, skillBonuses, isDodging, isImmobilized) => {
  if (isDodging || isImmobilized) {
    return { dx: 0, dy: 0, sprinting: false };
  }
  
  let dx = 0, dy = 0;
  
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  
  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }
  
  // Apply speed
  let speed = PLAYER_SPEED;
  
  // Skill speed bonus
  if (skillBonuses.speedBonus) {
    speed *= (1 + skillBonuses.speedBonus);
  }
  
  // Sprint
  let sprinting = false;
  if (input.sprint && stamina > SPRINT_COST * 2) {
    speed *= SPRINT_MULT;
    sprinting = true;
  }
  
  return {
    dx: dx * speed,
    dy: dy * speed,
    sprinting,
  };
};

export const applyMovement = (entity, dx, dy, map, deltaMult = 1) => {
  const newX = entity.x + dx * deltaMult;
  const newY = entity.y + dy * deltaMult;
  
  let finalX = entity.x;
  let finalY = entity.y;
  
  // Try X movement
  if (!checkMapCollision(map, newX, entity.y)) {
    finalX = newX;
  } else {
    // Slide along wall
    entity.kbx = 0;
  }
  
  // Try Y movement
  if (!checkMapCollision(map, finalX, newY)) {
    finalY = newY;
  } else {
    entity.kby = 0;
  }
  
  return { x: finalX, y: finalY };
};

// ═══════════════════════════════════════════════════════════════════
// ICE PHYSICS
// ═══════════════════════════════════════════════════════════════════

export const applyIcePhysics = (entity, map, input, deltaMult = 1) => {
  const onIce = isOnSlipperyTile(map, entity.x, entity.y);
  
  if (!onIce) {
    // Reset ice velocity when not on ice
    entity.iceVx = 0;
    entity.iceVy = 0;
    return { applied: false };
  }
  
  // Initialize ice velocity
  if (entity.iceVx === undefined) entity.iceVx = 0;
  if (entity.iceVy === undefined) entity.iceVy = 0;
  
  const friction = 0.98;
  const acceleration = 0.15;
  const maxSpeed = 4;
  
  // Apply input acceleration
  if (input.left) entity.iceVx -= acceleration;
  if (input.right) entity.iceVx += acceleration;
  if (input.up) entity.iceVy -= acceleration;
  if (input.down) entity.iceVy += acceleration;
  
  // Apply friction
  entity.iceVx *= friction;
  entity.iceVy *= friction;
  
  // Clamp speed
  entity.iceVx = clamp(entity.iceVx, -maxSpeed, maxSpeed);
  entity.iceVy = clamp(entity.iceVy, -maxSpeed, maxSpeed);
  
  // Try to move
  const newX = entity.x + entity.iceVx * deltaMult;
  const newY = entity.y + entity.iceVy * deltaMult;
  
  let finalX = entity.x;
  let finalY = entity.y;
  
  if (!checkMapCollision(map, newX, entity.y)) {
    finalX = newX;
  } else {
    entity.iceVx *= -0.5; // Bounce off walls
  }
  
  if (!checkMapCollision(map, finalX, newY)) {
    finalY = newY;
  } else {
    entity.iceVy *= -0.5;
  }
  
  return { applied: true, x: finalX, y: finalY };
};

// ═══════════════════════════════════════════════════════════════════
// KNOCKBACK
// ═══════════════════════════════════════════════════════════════════

export const applyKnockback = (entity, map, deltaMult = 1) => {
  if (!entity.kbx && !entity.kby) return { x: entity.x, y: entity.y };
  
  const friction = 0.85;
  const minKb = 0.1;
  
  const newX = entity.x + entity.kbx * deltaMult;
  const newY = entity.y + entity.kby * deltaMult;
  
  let finalX = entity.x;
  let finalY = entity.y;
  
  if (!checkMapCollision(map, newX, entity.y)) {
    finalX = newX;
  } else {
    entity.kbx = 0;
  }
  
  if (!checkMapCollision(map, finalX, newY)) {
    finalY = newY;
  } else {
    entity.kby = 0;
  }
  
  // Apply friction
  entity.kbx *= friction;
  entity.kby *= friction;
  
  // Stop small knockback
  if (Math.abs(entity.kbx) < minKb) entity.kbx = 0;
  if (Math.abs(entity.kby) < minKb) entity.kby = 0;
  
  return { x: finalX, y: finalY };
};

// ═══════════════════════════════════════════════════════════════════
// STAMINA MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

export const updateStamina = (stamina, maxStamina, sprinting, moving, skillBonuses, deltaMult = 1) => {
  let newStamina = stamina;
  
  if (sprinting) {
    newStamina -= SPRINT_COST * deltaMult;
  } else {
    // Regen rate depends on movement
    let regenRate = moving ? STAMINA_REGEN : STAMINA_REGEN_IDLE;
    
    // Skill bonus
    if (skillBonuses.staminaRegen) {
      regenRate *= (1 + skillBonuses.staminaRegen);
    }
    
    newStamina += regenRate * deltaMult;
  }
  
  return clamp(newStamina, 0, maxStamina);
};

// ═══════════════════════════════════════════════════════════════════
// HAZARD PROCESSING
// ═══════════════════════════════════════════════════════════════════

export const processHazards = (entity, map, hazardCooldowns, deltaMult = 1) => {
  const hazard = getHazardAt(map, entity.x, entity.y);
  
  if (!hazard) return { damage: 0, effect: null };
  
  // Check cooldown
  const tileKey = `${Math.floor((entity.x + TILE/2) / TILE)}_${Math.floor((entity.y + TILE/2) / TILE)}`;
  const cooldown = hazardCooldowns.get(tileKey) || 0;
  
  if (cooldown > 0) {
    hazardCooldowns.set(tileKey, cooldown - deltaMult);
    return { damage: 0, effect: null };
  }
  
  // Apply hazard damage
  const damage = hazard.damage || 0;
  const effect = hazard.effect || null;
  
  if (damage > 0) {
    hazardCooldowns.set(tileKey, hazard.cooldown || 30);
    
    // Floating text
    const ft = getFloatingText();
    if (ft) {
      ft.x = entity.x + TILE / 2;
      ft.y = entity.y;
      ft.text = `-${damage}`;
      ft.color = hazard.color || '#ff6030';
      ft.life = 40;
      ft.active = true;
    }
    
    SoundSystem.play('hurt');
  }
  
  return { damage, effect };
};

// ═══════════════════════════════════════════════════════════════════
// ENEMY MOVEMENT
// ═══════════════════════════════════════════════════════════════════

export const moveEnemyToward = (enemy, targetX, targetY, map, speed = 1.2, deltaMult = 1) => {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 1) return { x: enemy.x, y: enemy.y };
  
  const moveX = (dx / dist) * speed * deltaMult;
  const moveY = (dy / dist) * speed * deltaMult;
  
  const result = applyMovement(enemy, moveX, moveY, map, 1);
  
  // Update direction for animation
  if (Math.abs(dx) > Math.abs(dy)) {
    enemy.dir = dx > 0 ? 1 : 3;
  } else {
    enemy.dir = dy > 0 ? 2 : 0;
  }
  
  return result;
};

export const moveEnemyAway = (enemy, targetX, targetY, map, speed = 1.5, deltaMult = 1) => {
  const dx = enemy.x - targetX;
  const dy = enemy.y - targetY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 1) return { x: enemy.x, y: enemy.y };
  
  const moveX = (dx / dist) * speed * deltaMult;
  const moveY = (dy / dist) * speed * deltaMult;
  
  return applyMovement(enemy, moveX, moveY, map, 1);
};

export const moveEnemyRandom = (enemy, map, speed = 0.8, deltaMult = 1) => {
  // Random walk
  const angle = Math.random() * Math.PI * 2;
  const moveX = Math.cos(angle) * speed * deltaMult;
  const moveY = Math.sin(angle) * speed * deltaMult;
  
  return applyMovement(enemy, moveX, moveY, map, 1);
};

// ═══════════════════════════════════════════════════════════════════
// TELEPORTATION (for wraith enemies)
// ═══════════════════════════════════════════════════════════════════

export const teleportNearTarget = (enemy, targetX, targetY, map, minDist = TILE * 2, maxDist = TILE * 5) => {
  const attempts = 10;
  
  for (let i = 0; i < attempts; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    
    const newX = targetX + Math.cos(angle) * dist;
    const newY = targetY + Math.sin(angle) * dist;
    
    if (!checkMapCollision(map, newX, newY)) {
      enemy.x = newX;
      enemy.y = newY;
      SoundSystem.play('teleport');
      return true;
    }
  }
  
  return false;
};

// ═══════════════════════════════════════════════════════════════════
// ZONE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════

export const checkZoneExit = (player, map) => {
  const tileX = Math.floor((player.x + TILE / 2) / TILE);
  const tileY = Math.floor((player.y + TILE / 2) / TILE);
  
  if (tileY < 0 || tileY >= map.length || tileX < 0 || tileX >= map[0].length) {
    return null;
  }
  
  const tile = map[tileY][tileX];
  
  if (tile === T.ZONE_EXIT) {
    return { tileX, tileY };
  }
  
  return null;
};

// ═══════════════════════════════════════════════════════════════════
// DOOR INTERACTION
// ═══════════════════════════════════════════════════════════════════

export const interactWithDoor = (player, map, inventory) => {
  // Check adjacent tiles for doors
  const checkPositions = [
    [0, -1], [0, 1], [-1, 0], [1, 0]
  ];
  
  const centerX = Math.floor((player.x + TILE / 2) / TILE);
  const centerY = Math.floor((player.y + TILE / 2) / TILE);
  
  for (const [dx, dy] of checkPositions) {
    const tileX = centerX + dx;
    const tileY = centerY + dy;
    
    if (tileY < 0 || tileY >= map.length || tileX < 0 || tileX >= map[0].length) continue;
    
    const tile = map[tileY][tileX];
    
    if (tile === T.DOOR_CLOSED) {
      // Check for key
      // For now, just open the door
      map[tileY][tileX] = T.DOOR_OPEN;
      SoundSystem.play('door');
      return { opened: true, x: tileX, y: tileY };
    }
  }
  
  return { opened: false };
};

// ═══════════════════════════════════════════════════════════════════
// CAMERA FOLLOW
// ═══════════════════════════════════════════════════════════════════

export const updateCamera = (camX, camY, playerX, playerY, mapPixelWidth, mapPixelHeight, canvasW, canvasH, smoothing = 0.1) => {
  // Target camera position (centered on player)
  const targetX = playerX - canvasW / 2 + TILE / 2;
  const targetY = playerY - canvasH / 2 + TILE / 2;
  
  // Smooth interpolation
  let newCamX = camX + (targetX - camX) * smoothing;
  let newCamY = camY + (targetY - camY) * smoothing;
  
  // Clamp to map bounds
  newCamX = clamp(newCamX, 0, Math.max(0, mapPixelWidth - canvasW));
  newCamY = clamp(newCamY, 0, Math.max(0, mapPixelHeight - canvasH));
  
  return { camX: newCamX, camY: newCamY };
};
