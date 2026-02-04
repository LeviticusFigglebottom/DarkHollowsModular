// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — GAME LOOP HOOK
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import { TILE, VIEW_W, VIEW_H, CANVAS_W, CANVAS_H, getGFX, ZONE_DARKNESS, ZONE_BACKGROUNDS } from '../constants/config.js';
import { T, SOLID, HAZARD_TILES, LIGHT_SOURCES } from '../data/tiles.js';
import { ENEMY_INFO } from '../data/enemies.js';
import { ITEMS, generateLoot } from '../data/items.js';
import { SoundSystem } from '../systems/SoundSystem.js';
import { processEnemyAI, processEnemyKnockback, processEnemyStatusEffects } from '../systems/CombatSystem.js';
import { processPlayerMovement, processDodgeRoll, processPlayerKnockback } from '../systems/MovementSystem.js';
import { renderLighting, renderVignette } from '../systems/LightingSystem.js';
import { drawTile } from '../rendering/drawTile.js';
import { drawPlayer, drawEnemy, drawProjectile, drawFloatingText, drawNPC } from '../rendering/drawEntities.js';
import { getFloatingText, releaseFloatingText, rebuildSpatialGrid, getNearbyEnemies } from '../utils/helpers.js';

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

/**
 * Main game loop hook - handles all game logic and rendering
 */
export function useGameLoop({
  canvasRef,
  gameRef,
  gameStarted,
  phase,
  phaseRef,
  mapDataRefs,
  equipped,
  setHealth,
  setStamina,
  setXp,
  setGold,
  setHotbar,
  statusEffectsRef,
  setStatusEffects,
  activeUltRef,
  setActiveUlt,
  getSkillBonuses,
  applyStatusEffect,
  showNotif,
  showKillNotif,
  changeZone,
  dialogue,
  menuTab,
  keys,
  npcs,
  townNPCs,
  nearNpc,
  nearRelic,
  nearTownNpc,
  setNearNpc,
  setNearRelic,
  setNearTownNpc,
}) {
  const lastTimeRef = useRef(0);
  const fpsDataRef = useRef({ lastFpsUpdate: 0, frameCount: 0, fps: 60 });

  useEffect(() => {
    if (!gameStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const g = gameRef.current;

    const loop = (ts) => {
      // Delta time calculation
      const deltaTime = lastTimeRef.current ? Math.min(ts - lastTimeRef.current, 50) : 16.67;
      const dtMult = deltaTime / FRAME_TIME;
      lastTimeRef.current = ts;

      g.time = ts;
      g.frameCount++;

      // FPS tracking
      fpsDataRef.current.frameCount++;
      if (ts - fpsDataRef.current.lastFpsUpdate >= 1000) {
        fpsDataRef.current.fps = fpsDataRef.current.frameCount;
        fpsDataRef.current.frameCount = 0;
        fpsDataRef.current.lastFpsUpdate = ts;
      }

      const GFX = getGFX();
      const zone = phaseRef.current;
      const isTown = zone === 'town';
      const isForest = zone === 'forest';
      const isCave = zone === 'cave';
      const isCrypt = zone === 'crypt';
      const isGraveyard = zone === 'graveyard';
      const isDesert = zone === 'desert';
      const isIce = zone === 'ice';
      const isVolcanic = zone === 'volcanic';

      // Get current map data
      const md = mapDataRefs[zone]?.current || mapDataRefs.ruin.current;
      const MAP_W = md.w;
      const MAP_H = md.h;
      const p = g.player;

      // Dialogue and menu flags
      const inDlg = !!dialogue;
      const inMenu = menuTab !== null;

      // Zone transition cooldown
      if (g.zoneTransitCd > 0) g.zoneTransitCd -= dtMult;

      // Combat timer
      if (g._combatTimer !== undefined) g._combatTimer += dtMult;
      else g._combatTimer = 180;

      // Attack cooldown
      if (g.attackCd > 0) g.attackCd -= dtMult;
      if (g.dmgCooldown > 0) g.dmgCooldown -= dtMult;

      // Ultimate ability timer
      if (activeUltRef.current) {
        const newTimer = activeUltRef.current.timer - dtMult;
        if (newTimer <= 0) {
          setActiveUlt(null);
          activeUltRef.current = null;
        } else {
          activeUltRef.current = { ...activeUltRef.current, timer: newTimer };
          setActiveUlt(activeUltRef.current);
        }
      }

      // Ultimate cooldowns
      if (g.ultCds) {
        Object.keys(g.ultCds).forEach(k => {
          if (g.ultCds[k] > 0) g.ultCds[k] -= dtMult;
        });
      }

      // ═══════════════════════════════════════════════════════════
      // PLAYER UPDATES
      // ═══════════════════════════════════════════════════════════

      // Knockback processing
      processPlayerKnockback(p, md, SOLID, dtMult);

      // Dodge roll processing
      if (p.dodging) {
        processDodgeRoll(p, md, SOLID, MAP_W, MAP_H, dtMult);
      }

      // Mouse-based facing direction
      const psx = p.x - g.camera.x + 20;
      const psy = p.y - g.camera.y + 20;
      const mdx = g.mouse.x - psx;
      const mdy = g.mouse.y - psy;
      const mouseAngle = Math.atan2(mdy, mdx);
      p.dir = Math.abs(mdx) > Math.abs(mdy) ? (mdx > 0 ? 1 : 3) : (mdy > 0 ? 2 : 0);
      p.aimAngle = mouseAngle;

      // Movement
      if (!inDlg && !inMenu && !p.dodging) {
        const sb = getSkillBonuses();
        const freezeEffect = statusEffectsRef.current.find(e => e.type === 'freeze');
        const moveResult = processPlayerMovement(p, g, keys, md, SOLID, MAP_W, MAP_H, sb, freezeEffect, dtMult);
        
        if (moveResult.staminaChange !== 0) {
          g._stamina = Math.max(0, Math.min(100, g._stamina + moveResult.staminaChange));
          setStamina(g._stamina);
        }
      }

      // Stamina regeneration
      const sb = getSkillBonuses();
      const isMoving = keys['w'] || keys['s'] || keys['a'] || keys['d'];
      const regenRate = isMoving ? 0.04 : 0.08;
      const regenMult = 1 + (sb.stamRegenMult || 0);
      if (!keys['shift'] && g._stamina < 100) {
        g._stamina = Math.min(100, g._stamina + regenRate * regenMult * dtMult);
        setStamina(g._stamina);
      }

      // HP regeneration (out of combat)
      if (g._combatTimer > 180 && !statusEffectsRef.current.some(e => e.type === 'poison' || e.type === 'venom')) {
        const hpRegen = 0.012 * (1 + (sb.hpRegenMult || 0)) * dtMult;
        setHealth(h => Math.min(100 + (sb.maxHpBonus || 0), h + hpRegen));
      }

      // Status effect processing
      if (statusEffectsRef.current.length > 0 && g.frameCount % 30 === 0) {
        let dotDamage = 0;
        let dotColor = '#ffffff';
        
        statusEffectsRef.current.forEach(eff => {
          if (eff.type !== 'poison' && eff.type !== 'freeze' && eff.tickDmg > 0) {
            dotDamage += eff.tickDmg;
            dotColor = eff.type === 'venom' ? '#80ff40' : eff.type === 'burn' ? '#ff8040' : '#c03030';
          }
        });

        if (dotDamage > 0) {
          setHealth(h => Math.max(1, h - dotDamage));
          g.floatingTexts.push(getFloatingText(p.x + 20, p.y - 10, dotDamage, dotColor, 25, false));
        }
      }

      // Decrement effect durations
      statusEffectsRef.current = statusEffectsRef.current
        .map(eff => ({ ...eff, duration: eff.duration - dtMult }))
        .filter(eff => eff.duration > 0);
      
      if (g.frameCount % 20 === 0) {
        setStatusEffects([...statusEffectsRef.current]);
      }

      // ═══════════════════════════════════════════════════════════
      // HAZARD TILES
      // ═══════════════════════════════════════════════════════════

      if (!g.hazardCd) g.hazardCd = 0;
      if (g.hazardCd > 0) g.hazardCd -= dtMult;

      const ptx = Math.floor((p.x + 20) / TILE);
      const pty = Math.floor((p.y + 20) / TILE);

      if (ptx >= 0 && ptx < MAP_W && pty >= 0 && pty < MAP_H) {
        const tile = md.map[pty][ptx];
        const hazard = HAZARD_TILES[tile];
        
        if (hazard && g.hazardCd <= 0) {
          g.hazardCd = 30;
          setHealth(h => Math.max(1, h - hazard.dmg));
          g.floatingTexts.push(getFloatingText(
            p.x + 20, p.y - 10, hazard.dmg,
            hazard.type === 'fire' ? '#ff8040' : hazard.type === 'poison' ? '#60c060' : '#ff4040',
            30, false
          ));
          g.screenShake = 3;
          g._combatTimer = 0;
          
          if (hazard.effect && hazard.duration) {
            const tickDmg = hazard.effect === 'poison' ? 0 : 3;
            applyStatusEffect(hazard.effect, hazard.duration, tickDmg);
          }
          
          SoundSystem.play(hazard.type === 'fire' ? 'fireball' : 'hurt');
        }
      }

      // ═══════════════════════════════════════════════════════════
      // CAMERA
      // ═══════════════════════════════════════════════════════════

      const targetCx = p.x + 20 - CANVAS_W / 2;
      const targetCy = p.y + 20 - CANVAS_H / 2;
      const clampedTx = Math.max(0, Math.min(targetCx, MAP_W * TILE - CANVAS_W));
      const clampedTy = Math.max(0, Math.min(targetCy, MAP_H * TILE - CANVAS_H));

      if (g._cameraSnapFrames > 0) {
        g.camera.x = clampedTx;
        g.camera.y = clampedTy;
        g._cameraSnapFrames -= dtMult;
      } else {
        const camLerp = 1 - Math.pow(0.88, dtMult);
        g.camera.x += (clampedTx - g.camera.x) * camLerp;
        g.camera.y += (clampedTy - g.camera.y) * camLerp;
      }

      // ═══════════════════════════════════════════════════════════
      // ZONE TRANSITIONS
      // ═══════════════════════════════════════════════════════════

      if (g.zoneTransitCd <= 0) {
        // Town transitions
        if (isTown) {
          if (pty <= 8 && ptx >= 28 && ptx <= 48) changeZone('forest', 34, 58);
          if (ptx >= MAP_W - 5 && pty >= 20 && pty <= 40) changeZone('graveyard', 5, 30);
          if (pty >= MAP_H - 5 && ptx >= 20 && ptx <= 45) changeZone('desert', 30, 6);
          if (ptx <= 8 && pty >= 25 && pty <= 45) changeZone('ice', 55, 30);
        }
        // Forest transitions
        if (isForest) {
          if (pty >= MAP_H - 5) changeZone('town', 38, 10);
          if (ptx >= MAP_W - 5 && pty >= 25 && pty <= 45) changeZone('cave', 5, 35);
        }
        // Cave transitions
        if (isCave) {
          if (ptx <= 5 && pty >= 25 && pty <= 45) changeZone('forest', 55, 35);
        }
        // Graveyard transitions
        if (isGraveyard) {
          if (ptx <= 5 && pty >= 20 && pty <= 40) changeZone('town', 55, 30);
          if (pty >= MAP_H - 5 && ptx >= 25 && ptx <= 40) changeZone('crypt', 32, 5);
        }
        // Crypt transitions
        if (isCrypt) {
          if (pty <= 5 && ptx >= 25 && ptx <= 40) changeZone('graveyard', 32, 55);
        }
        // Desert transitions
        if (isDesert) {
          if (pty <= 5) changeZone('town', 32, 55);
          if (pty >= MAP_H - 5) changeZone('volcanic', 30, 6);
        }
        // Ice transitions
        if (isIce) {
          if (ptx >= MAP_W - 5 && pty >= 26 && pty <= 35) changeZone('town', 10, 35);
        }
        // Volcanic transitions
        if (isVolcanic) {
          if (pty <= 5) changeZone('desert', 30, 45);
        }
        // Ruin transitions
        if (zone === 'ruin') {
          if (pty >= MAP_H - 5) changeZone('town', 38, 10);
        }
      }

      // ═══════════════════════════════════════════════════════════
      // DOOR HANDLING
      // ═══════════════════════════════════════════════════════════

      const doorRange = 4;
      for (let dy = -doorRange; dy <= doorRange; dy++) {
        for (let dx = -doorRange; dx <= doorRange; dx++) {
          const tx = ptx + dx;
          const ty = pty + dy;
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) continue;
          
          const tile = md.map[ty][tx];
          const doorKey = `${tx},${ty}`;
          const distToPlayer = Math.sqrt((tx * TILE + 20 - p.x - 20) ** 2 + (ty * TILE + 20 - p.y - 20) ** 2);

          if (tile === T.DOOR_CLOSED && distToPlayer < 80 && !g.doors[doorKey]) {
            g.doors[doorKey] = { progress: 0, opening: true, closing: false };
            SoundSystem.play('door');
          }

          if (g.doors[doorKey]) {
            const door = g.doors[doorKey];
            if (door.opening) {
              door.progress = Math.min(1, door.progress + 0.08 * dtMult);
              if (door.progress >= 1) {
                door.opening = false;
                md.map[ty][tx] = T.DOOR;
              }
            }
            if (distToPlayer > 120 && !door.closing && door.progress >= 1) {
              door.closing = true;
              door.opening = false;
            }
            if (door.closing) {
              door.progress = Math.max(0, door.progress - 0.06 * dtMult);
              if (door.progress <= 0) {
                md.map[ty][tx] = T.DOOR_CLOSED;
                delete g.doors[doorKey];
              }
            }
          }
        }
      }

      // ═══════════════════════════════════════════════════════════
      // ATTACK SWING
      // ═══════════════════════════════════════════════════════════

      if (g.swinging) {
        g.swingTimer += dtMult;
        const swingDur = 12;
        
        if (g.swingTimer >= 4 && g.swingTimer < 8 && !g.swingHit) {
          const wpn = equipped.weapon;
          const baseDmg = wpn?.stats?.dmg || 5;
          const range = wpn?.stats?.range || 50;
          const arc = wpn?.stats?.arc || 0.8;

          if (!wpn?.stats?.ranged) {
            // Melee attack
            rebuildSpatialGrid(g.enemies);
            const nearby = getNearbyEnemies(p.x, p.y, range + 40);
            
            nearby.forEach(e => {
              if (e.dead || e.hitCd > 0) return;
              
              const dx = (e.x + 20) - (p.x + 20);
              const dy = (e.y + 20) - (p.y + 20);
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist > range) return;
              
              const angleToEnemy = Math.atan2(dy, dx);
              let angleDiff = Math.abs(angleToEnemy - p.aimAngle);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
              
              if (angleDiff > arc) return;

              // Hit enemy
              e.hitCd = 20;
              const dmgMult = 1 + (sb.dmgMult || 0);
              const critRoll = Math.random();
              const isCrit = critRoll < (sb.critChance || 0);
              const critMult = isCrit ? (1.5 + (sb.critMult || 0)) : 1;
              
              let dmg = Math.floor(baseDmg * dmgMult * critMult);
              if (activeUltRef.current?.type === 'berserker') dmg = Math.floor(dmg * 1.5);
              
              e.hp -= dmg;
              g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 10, dmg, isCrit ? '#ffa040' : '#ffffff', isCrit ? 45 : 35, isCrit));

              // Knockback
              const kbBase = equipped.weapon?.stats?.kb || 12;
              const kbMult = 1 + (sb.kbMult || 0);
              const kb = kbBase * kbMult / Math.max(1, dist / 40);
              e.kbx = (dx / dist) * kb;
              e.kby = (dy / dist) * kb;

              SoundSystem.play('hit');
              g._combatTimer = 0;
              g.swingHit = true;

              // Check for kill
              if (e.hp <= 0) {
                e.dead = true;
                e.deathTime = ts;
                const info = ENEMY_INFO[e.type];
                const bonusXp = info?.xp || 10;
                setXp(x => x + bonusXp);
                
                if (isCrit) {
                  g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 25, 'CRITICAL!', '#ffa040', 60, true));
                }
                g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 5, '+' + bonusXp + ' XP', '#60ff60', 50, false));
                
                if (sb.killHeal > 0) setHealth(h => Math.min(100 + (sb.maxHpBonus || 0), h + sb.killHeal));

                // Loot drops
                const loot = generateLoot(e.type);
                let yOffset = 25;
                loot.forEach(drop => {
                  if (drop.type === 'gold') {
                    setGold(gld => gld + drop.amount);
                    g.floatingTexts.push(getFloatingText(e.x + 20, e.y - yOffset, '+' + drop.amount + 'g', '#ffd700', 45, false));
                  } else if (drop.type === 'item') {
                    const template = Object.values(ITEMS).find(it => it.id === drop.id);
                    if (template) {
                      setHotbar(prev => {
                        const newBar = [...prev];
                        let found = false;
                        for (let s = 0; s < newBar.length; s++) {
                          if (newBar[s]?.id === drop.id && template.type === 'consumable') {
                            newBar[s] = { ...newBar[s], count: newBar[s].count + drop.count };
                            found = true;
                            break;
                          }
                        }
                        if (!found) {
                          for (let s = 0; s < newBar.length; s++) {
                            if (!newBar[s]) {
                              newBar[s] = { ...template, count: drop.count };
                              found = true;
                              break;
                            }
                          }
                        }
                        if (found) g.floatingTexts.push(getFloatingText(e.x + 20, e.y - yOffset - 15, '+' + template.name, '#80c0ff', 50, false));
                        return newBar;
                      });
                    }
                  }
                  yOffset += 15;
                });

                if (info?.isBoss) {
                  SoundSystem.play('levelup');
                  g.screenShake = 12;
                  showNotif(`${info.name} DEFEATED!`, 4000);
                }
                
                SoundSystem.play('kill');
              }
            });
          }
        }

        if (g.swingTimer >= swingDur) {
          g.swinging = false;
          g.swingTimer = 0;
          g.swingHit = false;
        }
      }

      // ═══════════════════════════════════════════════════════════
      // PROJECTILES
      // ═══════════════════════════════════════════════════════════

      // Player projectiles
      g.projectiles = g.projectiles.filter(proj => {
        proj.x += proj.vx * dtMult;
        proj.y += proj.vy * dtMult;
        proj.life -= dtMult;

        if (proj.life <= 0) return false;

        // Check enemy collision
        for (const e of g.enemies) {
          if (e.dead || e.hitCd > 0) continue;
          const dx = proj.x - (e.x + 20);
          const dy = proj.y - (e.y + 20);
          if (dx * dx + dy * dy < 900) {
            e.hitCd = 20;
            const dmgMult = 1 + (sb.dmgMult || 0);
            const dmg = Math.floor(proj.dmg * dmgMult);
            e.hp -= dmg;
            g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 10, dmg, '#ffffff', 35, false));

            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            e.kbx = (dx / dist) * 8;
            e.kby = (dy / dist) * 8;

            SoundSystem.play('hit');
            g._combatTimer = 0;

            if (e.hp <= 0) {
              e.dead = true;
              e.deathTime = ts;
              const info = ENEMY_INFO[e.type];
              setXp(x => x + (info?.xp || 10));
              g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 5, '+' + (info?.xp || 10) + ' XP', '#60ff60', 50, false));
              SoundSystem.play('kill');
            }
            return false;
          }
        }

        // Wall collision
        const tx = Math.floor(proj.x / TILE);
        const ty = Math.floor(proj.y / TILE);
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || SOLID.has(md.map[ty][tx])) {
          return false;
        }

        return true;
      });

      // Enemy projectiles
      g.enemyProjectiles = g.enemyProjectiles.filter(proj => {
        proj.x += proj.vx * dtMult;
        proj.y += proj.vy * dtMult;
        proj.life -= dtMult;

        if (proj.life <= 0) return false;

        // Player collision
        const dx = proj.x - (p.x + 20);
        const dy = proj.y - (p.y + 20);
        if (dx * dx + dy * dy < 625 && !p.dodging && activeUltRef.current?.type !== 'ironwill') {
          const def = equipped.armor?.stats?.def || 0;
          const dmgReduce = sb.dmgReduce || 0;
          let dmg = Math.max(1, Math.floor(proj.dmg - def * 0.3 - dmgReduce));
          setHealth(h => Math.max(0, h - dmg));
          g.floatingTexts.push(getFloatingText(p.x + 20, p.y - 10, dmg, '#ff4040', 35, false));
          g.screenShake = 5;
          g._combatTimer = 0;
          g.dmgCooldown = 30;
          SoundSystem.play('hurt');
          
          if (proj.effect && proj.effectDuration) {
            applyStatusEffect(proj.effect, proj.effectDuration, proj.effectDmg || 0);
          }
          return false;
        }

        // Wall collision
        const tx = Math.floor(proj.x / TILE);
        const ty = Math.floor(proj.y / TILE);
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || SOLID.has(md.map[ty][tx])) {
          return false;
        }

        return true;
      });

      // ═══════════════════════════════════════════════════════════
      // ENEMY AI
      // ═══════════════════════════════════════════════════════════

      const aiSkip = GFX.enemyAISkipFrames || 1;
      g.enemies.forEach((e, idx) => {
        if (e.dead) {
          // Death animation timer
          if (ts - e.deathTime > 800) {
            e.remove = true;
          }
          return;
        }

        // Process knockback
        processEnemyKnockback(e, md, SOLID, MAP_W, MAP_H, dtMult);
        if (Math.abs(e.kbx) > 0.5 || Math.abs(e.kby) > 0.5) return;

        // Process status effects
        processEnemyStatusEffects(e, g, ts, dtMult);

        // Skip AI for distant enemies on some frames
        const distToPlayer = Math.sqrt((e.x - p.x) ** 2 + (e.y - p.y) ** 2);
        if (distToPlayer > GFX.maxEnemyAIDistance && g.frameCount % aiSkip !== idx % aiSkip) {
          return;
        }

        // Run AI
        processEnemyAI(e, p, g, md, SOLID, MAP_W, MAP_H, ts, dtMult, equipped, sb, activeUltRef, setHealth, applyStatusEffect);
      });

      // Remove dead enemies after animation
      g.enemies = g.enemies.filter(e => !e.remove);

      // ═══════════════════════════════════════════════════════════
      // NPC PROXIMITY
      // ═══════════════════════════════════════════════════════════

      // Check ruin NPC proximity
      if (npcs.current && zone === 'ruin') {
        let foundNpc = false;
        npcs.current.forEach(npc => {
          const dist = Math.sqrt((p.x - npc.x) ** 2 + (p.y - npc.y) ** 2);
          if (dist < 80 && !npc.dead) {
            setNearNpc(npc);
            foundNpc = true;
          }
        });
        if (!foundNpc && nearNpc) setNearNpc(null);
      }

      // Check relic proximity
      if (md.relicPos && !g.relicCollected) {
        const dist = Math.sqrt((p.x - md.relicPos.x * TILE) ** 2 + (p.y - md.relicPos.y * TILE) ** 2);
        if (dist < 60) {
          setNearRelic(true);
        } else if (nearRelic) {
          setNearRelic(false);
        }
      }

      // Check town NPC proximity
      if (isTown && townNPCs.current) {
        let foundTownNpc = null;
        townNPCs.current.forEach(npc => {
          const dist = Math.sqrt((p.x - npc.x) ** 2 + (p.y - npc.y) ** 2);
          if (dist < 80) foundTownNpc = npc;
        });
        if (foundTownNpc !== nearTownNpc) setNearTownNpc(foundTownNpc);
      }

      // ═══════════════════════════════════════════════════════════
      // FLOATING TEXT CLEANUP
      // ═══════════════════════════════════════════════════════════

      g.floatingTexts = g.floatingTexts.filter(ft => {
        ft.life -= dtMult;
        ft.y -= 0.5 * dtMult;
        if (ft.life <= 0) {
          releaseFloatingText(ft);
          return false;
        }
        return true;
      });

      // ═══════════════════════════════════════════════════════════
      // RENDERING
      // ═══════════════════════════════════════════════════════════

      const camX = Math.floor(g.camera.x);
      const camY = Math.floor(g.camera.y);

      // Screen shake
      ctx.save();
      if (g.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * g.screenShake;
        const shakeY = (Math.random() - 0.5) * g.screenShake;
        ctx.translate(shakeX, shakeY);
        g.screenShake *= 0.9;
        if (g.screenShake < 0.5) g.screenShake = 0;
      }

      // Background
      const bgColor = ZONE_BACKGROUNDS[zone] || '#06060a';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Tiles
      const startTx = Math.floor(camX / TILE);
      const startTy = Math.floor(camY / TILE);
      const endTx = Math.min(startTx + VIEW_W + 1, MAP_W);
      const endTy = Math.min(startTy + VIEW_H + 1, MAP_H);

      for (let ty = startTy; ty < endTy; ty++) {
        for (let tx = startTx; tx < endTx; tx++) {
          if (ty < 0 || ty >= MAP_H || tx < 0 || tx >= MAP_W) continue;
          const tile = md.map[ty][tx];
          const rx = tx * TILE - camX;
          const ry = ty * TILE - camY;
          drawTile(ctx, tile, rx, ry, TILE, g.frameCount);
        }
      }

      // NPCs
      if (zone === 'ruin' && npcs.current) {
        npcs.current.forEach(npc => drawNPC(ctx, npc, camX, camY));
      }
      if (isTown && townNPCs.current) {
        townNPCs.current.forEach(npc => drawNPC(ctx, npc, camX, camY));
      }

      // Enemies
      g.enemies.forEach(e => drawEnemy(ctx, e, camX, camY, TILE));

      // Player
      drawPlayer(ctx, p, camX, camY, equipped, activeUltRef.current, statusEffectsRef.current, g.swinging ? g.swingTimer : 0);

      // Projectiles
      g.projectiles.forEach(proj => drawProjectile(ctx, proj, camX, camY, 'player'));
      g.enemyProjectiles.forEach(proj => drawProjectile(ctx, proj, camX, camY, proj.type || 'enemy'));

      // Floating text
      g.floatingTexts.forEach(ft => drawFloatingText(ctx, ft, camX, camY));

      // Lighting
      if (GFX.lighting) {
        const darkness = ZONE_DARKNESS[zone] || 0.35;
        const lightSources = LIGHT_SOURCES[zone] || LIGHT_SOURCES.ruin;
        renderLighting(ctx, md, camX, camY, p, darkness, lightSources, GFX, TILE, VIEW_W, VIEW_H);
      }

      // Vignette
      if (GFX.vignette) {
        renderVignette(ctx, CANVAS_W, CANVAS_H);
      }

      // FPS counter (debug)
      if (g.showFps) {
        ctx.fillStyle = fpsDataRef.current.fps < 45 ? '#ffa040' : '#40ff40';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`FPS: ${fpsDataRef.current.fps}`, 10, CANVAS_H - 8);
      }

      // Damage flash
      if (g.dmgCooldown > 20 && !g.dead) {
        const flash = (g.dmgCooldown - 20) / 10;
        ctx.fillStyle = `rgba(200,0,0,${flash * 0.15})`;
        ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);
      }

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    gameStarted, canvasRef, gameRef, phaseRef, mapDataRefs, equipped, 
    setHealth, setStamina, setXp, setGold, setHotbar,
    statusEffectsRef, setStatusEffects, activeUltRef, setActiveUlt,
    getSkillBonuses, applyStatusEffect, showNotif, showKillNotif, changeZone,
    dialogue, menuTab, keys, npcs, townNPCs, nearNpc, nearRelic, nearTownNpc,
    setNearNpc, setNearRelic, setNearTownNpc
  ]);
}

export default useGameLoop;
