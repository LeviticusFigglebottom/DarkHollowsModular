// ═══════════════════════════════════════════════════════════════════
// DARK HOLLOWS — COMBAT SYSTEM
// ═══════════════════════════════════════════════════════════════════

import { TILE, ATTACK_STAM_COST, ATTACK_COOLDOWN, PLAYER_KB, HP_REGEN, HP_REGEN_COMBAT_DELAY } from '../constants/config.js';
import { ENEMY_INFO } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { SoundSystem } from './SoundSystem.js';
import { getFloatingText, releaseFloatingText, getNearbyEnemies, distance, normalize } from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════
// STATUS EFFECTS
// ═══════════════════════════════════════════════════════════════════

export const STATUS_EFFECTS = {
  burn: {
    name: 'Burning',
    color: '#ff6030',
    duration: 180,
    tickDamage: 1,
    tickRate: 30,
    stackable: false,
  },
  venom: {
    name: 'Poisoned',
    color: '#50a040',
    duration: 240,
    tickDamage: 0.5,
    tickRate: 20,
    stackable: true,
    maxStacks: 3,
  },
  freeze: {
    name: 'Frozen',
    color: '#80c0e0',
    duration: 120,
    slowAmount: 0.5,
    stackable: false,
  },
  bleed: {
    name: 'Bleeding',
    color: '#c02020',
    duration: 150,
    tickDamage: 1.5,
    tickRate: 25,
    stackable: true,
    maxStacks: 5,
  },
  stun: {
    name: 'Stunned',
    color: '#ffff40',
    duration: 60,
    immobilize: true,
    stackable: false,
  },
};

// ═══════════════════════════════════════════════════════════════════
// COMBAT CALCULATIONS
// ═══════════════════════════════════════════════════════════════════

export const calculateDamage = (baseDamage, attacker, defender, skillBonuses = {}) => {
  let damage = baseDamage;
  
  // Apply skill bonuses
  if (skillBonuses.damageBonus) {
    damage *= (1 + skillBonuses.damageBonus);
  }
  
  // Critical hit check
  const critChance = skillBonuses.critChance || 0;
  const critMult = skillBonuses.critMultiplier || 1.5;
  const isCrit = Math.random() < critChance;
  
  if (isCrit) {
    damage *= critMult;
  }
  
  // Apply defender's resistance if any
  if (defender.resistance) {
    damage *= (1 - defender.resistance);
  }
  
  // Randomize slightly (+/- 15%)
  damage *= 0.85 + Math.random() * 0.3;
  
  return { damage: Math.round(damage), isCrit };
};

export const calculateKnockback = (source, target, baseKb, skillBonuses = {}) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  
  let kb = baseKb;
  if (skillBonuses.knockbackBonus) {
    kb *= (1 + skillBonuses.knockbackBonus);
  }
  
  return {
    kbx: (dx / dist) * kb,
    kby: (dy / dist) * kb,
  };
};

// ═══════════════════════════════════════════════════════════════════
// PLAYER ATTACK HANDLING
// ═══════════════════════════════════════════════════════════════════

export const performPlayerAttack = (player, enemies, aimAngle, equipped, skillBonuses, projectiles) => {
  const weapon = ITEMS[equipped.weapon];
  
  if (!weapon) return { hit: false };
  
  // Bow - ranged attack
  if (weapon.type === 'bow') {
    return performRangedAttack(player, aimAngle, weapon, skillBonuses, projectiles);
  }
  
  // Melee attack
  return performMeleeAttack(player, enemies, aimAngle, weapon, skillBonuses);
};

const performMeleeAttack = (player, enemies, aimAngle, weapon, skillBonuses) => {
  const attackRange = weapon.range || 50;
  const attackArc = weapon.arc || Math.PI / 2; // 90 degree arc
  const baseDamage = weapon.damage || 10;
  
  let hitCount = 0;
  const results = [];
  
  // Check enemies in range
  const nearbyEnemies = getNearbyEnemies(player.x, player.y, attackRange + TILE);
  
  for (const enemy of nearbyEnemies) {
    if (enemy.dead || enemy.hitCd > 0) continue;
    
    const dx = (enemy.x + TILE / 2) - (player.x + TILE / 2);
    const dy = (enemy.y + TILE / 2) - (player.y + TILE / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > attackRange) continue;
    
    // Check if enemy is within attack arc
    const angleToEnemy = Math.atan2(dy, dx);
    let angleDiff = angleToEnemy - aimAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    if (Math.abs(angleDiff) > attackArc / 2) continue;
    
    // Apply damage
    const { damage, isCrit } = calculateDamage(baseDamage, player, enemy, skillBonuses);
    enemy.hp -= damage;
    enemy.hitCd = 30;
    hitCount++;
    
    // Knockback
    const enemyInfo = ENEMY_INFO[enemy.type] || {};
    const kb = calculateKnockback(player, enemy, PLAYER_KB / (enemyInfo.kb || 10), skillBonuses);
    enemy.kbx = kb.kbx;
    enemy.kby = kb.kby;
    
    // Apply weapon effect
    if (weapon.effect) {
      applyStatusEffect(enemy, weapon.effect);
    }
    
    // Create floating text
    const ft = getFloatingText();
    if (ft) {
      ft.x = enemy.x + TILE / 2;
      ft.y = enemy.y;
      ft.text = isCrit ? `${damage}!` : `${damage}`;
      ft.color = isCrit ? '#ffff00' : '#ffffff';
      ft.life = 60;
      ft.active = true;
    }
    
    results.push({ enemy, damage, isCrit });
    
    // Check for kill
    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.deathTimer = 30;
      SoundSystem.play('kill');
    } else {
      SoundSystem.play('hit');
    }
  }
  
  if (hitCount > 0) {
    SoundSystem.play('swing');
  }
  
  return { hit: hitCount > 0, results, hitCount };
};

const performRangedAttack = (player, aimAngle, weapon, skillBonuses, projectiles) => {
  const speed = weapon.projectileSpeed || 8;
  const damage = weapon.damage || 8;
  
  const projectile = {
    x: player.x + TILE / 2,
    y: player.y + TILE / 2,
    vx: Math.cos(aimAngle) * speed,
    vy: Math.sin(aimAngle) * speed,
    damage: damage * (1 + (skillBonuses.damageBonus || 0)),
    type: 'arrow',
    owner: 'player',
    life: 120,
    effect: weapon.effect,
  };
  
  projectiles.push(projectile);
  SoundSystem.play('shoot');
  
  return { hit: true, projectile };
};

// ═══════════════════════════════════════════════════════════════════
// ENEMY ATTACK HANDLING
// ═══════════════════════════════════════════════════════════════════

export const performEnemyAttack = (enemy, player, projectiles) => {
  const info = ENEMY_INFO[enemy.type] || {};
  
  if (info.isRanged) {
    return performEnemyRangedAttack(enemy, player, info, projectiles);
  }
  
  return performEnemyMeleeAttack(enemy, player, info);
};

const performEnemyMeleeAttack = (enemy, player, info) => {
  const dx = (player.x + TILE / 2) - (enemy.x + TILE / 2);
  const dy = (player.y + TILE / 2) - (enemy.y + TILE / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > TILE * 1.2) return { hit: false };
  
  const baseDamage = info.dmg || 10;
  const damage = Math.round(baseDamage * (0.9 + Math.random() * 0.2));
  
  // Apply status effect if enemy has one
  if (info.appliesEffect) {
    applyStatusEffect(player, info.appliesEffect);
  }
  
  // Knockback player
  const kb = calculateKnockback(enemy, player, info.kb || 8);
  
  SoundSystem.play('hurt');
  
  return {
    hit: true,
    damage,
    knockback: kb,
  };
};

const performEnemyRangedAttack = (enemy, player, info, projectiles) => {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const angle = Math.atan2(dy, dx);
  const speed = 5;
  
  const projectile = {
    x: enemy.x + TILE / 2,
    y: enemy.y + TILE / 2,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: info.dmg || 10,
    type: info.type === 'flame_imp' ? 'fireball' : 'arrow',
    owner: 'enemy',
    life: 100,
    effect: info.appliesEffect,
  };
  
  projectiles.push(projectile);
  SoundSystem.play(projectile.type === 'fireball' ? 'fireball' : 'shoot');
  
  return { hit: true, projectile };
};

// ═══════════════════════════════════════════════════════════════════
// STATUS EFFECT HANDLING
// ═══════════════════════════════════════════════════════════════════

export const applyStatusEffect = (target, effectType) => {
  const effectDef = STATUS_EFFECTS[effectType];
  if (!effectDef) return;
  
  if (!target.statusEffects) {
    target.statusEffects = [];
  }
  
  const existing = target.statusEffects.find(e => e.type === effectType);
  
  if (existing) {
    if (effectDef.stackable) {
      existing.stacks = Math.min((existing.stacks || 1) + 1, effectDef.maxStacks || 5);
      existing.duration = effectDef.duration; // Refresh duration
    } else {
      existing.duration = effectDef.duration; // Just refresh
    }
  } else {
    target.statusEffects.push({
      type: effectType,
      duration: effectDef.duration,
      stacks: 1,
      tickTimer: 0,
    });
  }
};

export const updateStatusEffects = (target, deltaMult = 1) => {
  if (!target.statusEffects) return { totalDamage: 0 };
  
  let totalDamage = 0;
  let isSlowed = false;
  let isImmobilized = false;
  
  for (let i = target.statusEffects.length - 1; i >= 0; i--) {
    const effect = target.statusEffects[i];
    const def = STATUS_EFFECTS[effect.type];
    
    if (!def) continue;
    
    // Tick damage
    if (def.tickDamage) {
      effect.tickTimer += deltaMult;
      if (effect.tickTimer >= def.tickRate) {
        effect.tickTimer = 0;
        const dmg = def.tickDamage * (effect.stacks || 1);
        totalDamage += dmg;
        
        // Floating text for DoT
        const ft = getFloatingText();
        if (ft) {
          ft.x = target.x + TILE / 2;
          ft.y = target.y;
          ft.text = `-${Math.round(dmg)}`;
          ft.color = def.color;
          ft.life = 40;
          ft.active = true;
        }
      }
    }
    
    // Movement effects
    if (def.slowAmount) isSlowed = def.slowAmount;
    if (def.immobilize) isImmobilized = true;
    
    // Reduce duration
    effect.duration -= deltaMult;
    
    // Remove expired effects
    if (effect.duration <= 0) {
      target.statusEffects.splice(i, 1);
    }
  }
  
  return { totalDamage, isSlowed, isImmobilized };
};

export const clearStatusEffects = (target) => {
  target.statusEffects = [];
};

export const hasStatusEffect = (target, effectType) => {
  return target.statusEffects?.some(e => e.type === effectType) || false;
};

// ═══════════════════════════════════════════════════════════════════
// PROJECTILE HANDLING
// ═══════════════════════════════════════════════════════════════════

export const updateProjectiles = (projectiles, player, enemies, map, deltaMult = 1) => {
  const hits = [];
  
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    // Move projectile
    proj.x += proj.vx * deltaMult;
    proj.y += proj.vy * deltaMult;
    proj.life -= deltaMult;
    
    // Check lifetime
    if (proj.life <= 0) {
      projectiles.splice(i, 1);
      continue;
    }
    
    // Check map collision
    const tileX = Math.floor(proj.x / TILE);
    const tileY = Math.floor(proj.y / TILE);
    if (tileX < 0 || tileY < 0 || tileX >= map[0].length || tileY >= map.length) {
      projectiles.splice(i, 1);
      continue;
    }
    
    // Check entity collision
    if (proj.owner === 'player') {
      // Check enemy hits
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        
        const dx = proj.x - (enemy.x + TILE / 2);
        const dy = proj.y - (enemy.y + TILE / 2);
        if (dx * dx + dy * dy < (TILE / 2) ** 2) {
          // Hit enemy
          enemy.hp -= proj.damage;
          enemy.hitCd = 20;
          
          // Knockback
          const angle = Math.atan2(proj.vy, proj.vx);
          enemy.kbx = Math.cos(angle) * 6;
          enemy.kby = Math.sin(angle) * 6;
          
          // Apply effect
          if (proj.effect) {
            applyStatusEffect(enemy, proj.effect);
          }
          
          // Floating text
          const ft = getFloatingText();
          if (ft) {
            ft.x = enemy.x + TILE / 2;
            ft.y = enemy.y;
            ft.text = `${Math.round(proj.damage)}`;
            ft.color = '#ffffff';
            ft.life = 50;
            ft.active = true;
          }
          
          // Check kill
          if (enemy.hp <= 0) {
            enemy.dead = true;
            enemy.deathTimer = 30;
            SoundSystem.play('kill');
          } else {
            SoundSystem.play('hit');
          }
          
          hits.push({ type: 'enemy', target: enemy, projectile: proj });
          projectiles.splice(i, 1);
          break;
        }
      }
    } else {
      // Enemy projectile - check player hit
      const dx = proj.x - (player.x + TILE / 2);
      const dy = proj.y - (player.y + TILE / 2);
      if (dx * dx + dy * dy < (TILE / 2) ** 2) {
        hits.push({ type: 'player', damage: proj.damage, effect: proj.effect, projectile: proj });
        projectiles.splice(i, 1);
      }
    }
  }
  
  return hits;
};

// ═══════════════════════════════════════════════════════════════════
// HP REGENERATION
// ═══════════════════════════════════════════════════════════════════

export const updateHPRegen = (player, combatTimer, skillBonuses, deltaMult = 1) => {
  if (combatTimer > 0) return 0;
  
  let regenRate = HP_REGEN;
  
  // Skill bonus
  if (skillBonuses.hpRegen) {
    regenRate += skillBonuses.hpRegen;
  }
  
  const healAmount = regenRate * deltaMult;
  return healAmount;
};

// ═══════════════════════════════════════════════════════════════════
// DODGE ROLL
// ═══════════════════════════════════════════════════════════════════

export const performDodgeRoll = (player, aimAngle, skillBonuses) => {
  const dodgeDistance = 80;
  const dodgeFrames = 15;
  const iframes = skillBonuses.dodgeIframes || 10;
  
  return {
    active: true,
    dx: Math.cos(aimAngle) * (dodgeDistance / dodgeFrames),
    dy: Math.sin(aimAngle) * (dodgeDistance / dodgeFrames),
    framesLeft: dodgeFrames,
    iframes: iframes,
  };
};

// ═══════════════════════════════════════════════════════════════════
// XP AND LEVELING
// ═══════════════════════════════════════════════════════════════════

export const grantXP = (player, amount, xpThresholds) => {
  player.xp += amount;
  
  // Check level up
  const currentLevel = player.level || 1;
  const nextThreshold = xpThresholds[currentLevel] || Infinity;
  
  if (player.xp >= nextThreshold && currentLevel < xpThresholds.length) {
    player.level = currentLevel + 1;
    player.skillPoints = (player.skillPoints || 0) + 1;
    
    // Full heal on level up
    player.hp = player.maxHp;
    
    SoundSystem.play('levelup');
    
    return { leveledUp: true, newLevel: player.level };
  }
  
  return { leveledUp: false };
};
