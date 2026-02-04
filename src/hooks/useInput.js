// ═══════════════════════════════════════════════════════════════════
// DARK HOLLOWS — INPUT HANDLING HOOK
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { TILE, ATTACK_COOLDOWN, ATTACK_STAM_COST } from '../constants/config.js';
import { SoundSystem } from '../systems/SoundSystem.js';

// ═══════════════════════════════════════════════════════════════════
// USE INPUT HOOK
// ═══════════════════════════════════════════════════════════════════

export const useInput = ({
  canvasRef,
  gameRef,
  gameStarted,
  dialogue,
  menuTab,
  nearNpc,
  nearRelic,
  nearTownNpc,
  equipped,
  hotbar,
  hotbarSlot,
  setHotbarSlot,
  setMenuTab,
  setDialogue,
  setDialogueLine,
  setShopOpen,
  setCurrentShop,
  usePotion,
  advanceDialogue,
  handleRespawn,
  changeZone,
  activateUltimate,
  getSkillBonuses,
  showNotif,
  applyStatusEffect,
  setHealth,
  setGold,
  setHotbar,
  setXp,
}) => {
  const [keys, setKeys] = useState({});
  const keysRef = useRef({});

  useEffect(() => {
    if (!gameStarted) return;
    const canvas = canvasRef.current;
    const g = gameRef.current;

    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      
      // Prevent default for game keys
      if (['w', 'a', 's', 'd', ' ', 'tab', 'e', 'shift', 'q', 'r'].includes(key) || 
          ['1', '2', '3', '4', '5'].includes(key)) {
        e.preventDefault();
      }

      keysRef.current[key] = true;
      setKeys(prev => ({ ...prev, [key]: true }));

      // Dead state - R to respawn
      if (g.dead && key === 'r') {
        handleRespawn();
        return;
      }

      // Dialogue controls
      if (dialogue) {
        if (key === ' ' || key === 'e') {
          advanceDialogue();
        }
        if (key === 'escape') {
          setDialogue(null);
        }
        return;
      }

      // Menu toggle
      if (key === 'tab' || key === 'i') {
        e.preventDefault();
        setMenuTab(prev => prev === null ? 'inventory' : null);
        return;
      }

      if (key === 'escape') {
        if (menuTab !== null) {
          setMenuTab(null);
        }
        return;
      }

      // Skip if in menu
      if (menuTab !== null) return;

      // Hotbar slots
      if (['1', '2', '3', '4', '5'].includes(key)) {
        const idx = parseInt(key) - 1;
        setHotbarSlot(idx);
        
        // Use consumable if double-tap or holding shift
        if (e.shiftKey || hotbarSlot === idx) {
          usePotion(idx);
        }
      }

      // Interact
      if (key === 'e' || key === 'f') {
        // Talk to ruin NPC
        if (nearNpc && !nearNpc.dead) {
          setDialogue('knight');
          setDialogueLine(0);
          return;
        }
        
        // Interact with town NPC
        if (nearTownNpc) {
          if (nearTownNpc.shop) {
            setCurrentShop(nearTownNpc);
            setShopOpen(true);
          }
          return;
        }
      }

      // Dodge roll
      if (key === ' ' && !g.player.dodging && g._stamina >= 20) {
        const p = g.player;
        let dx = 0, dy = 0;
        if (keysRef.current['w']) dy = -1;
        if (keysRef.current['s']) dy = 1;
        if (keysRef.current['a']) dx = -1;
        if (keysRef.current['d']) dx = 1;
        
        // Default to facing direction if no movement keys
        if (dx === 0 && dy === 0) {
          if (p.dir === 0) dy = -1;
          else if (p.dir === 1) dx = 1;
          else if (p.dir === 2) dy = 1;
          else dx = -1;
        }
        
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        p.dodging = true;
        p.dodgeTimer = 12;
        p.dodgeDir = { x: dx / len, y: dy / len };
        g._stamina -= 20;
        SoundSystem.play('woosh');
      }

      // Ultimate abilities
      if (key === 'q') {
        const sb = getSkillBonuses();
        if (sb.hasUlt?.berserker) activateUltimate('berserker');
        else if (sb.hasUlt?.shadowstep) activateUltimate('shadowstep');
        else if (sb.hasUlt?.ironwill) activateUltimate('ironwill');
      }

      // FPS toggle
      if (key === 'f3') {
        g.showFps = !g.showFps;
      }
    };

    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
      setKeys(prev => ({ ...prev, [key]: false }));
    };

    const onMouseMove = (e) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      g.mouse.x = e.clientX - rect.left;
      g.mouse.y = e.clientY - rect.top;
    };

    const onClick = (e) => {
      if (g.dead || dialogue || menuTab !== null) return;
      
      // Attack
      const wpn = equipped.weapon;
      const sb = getSkillBonuses();
      const stam = ATTACK_STAM_COST * (1 - (sb.stamRegenMult || 0) * 0.2);
      
      if (g.attackCd > 0) return;
      
      // Check for arrows if using ranged weapon
      if (wpn?.stats?.ranged) {
        const hasArrows = hotbar.some(h => h?.id === 'arrows' && h.count > 0);
        if (!hasArrows) {
          showNotif("No arrows!", 1200);
          return;
        }
      }
      
      if (g._stamina >= stam) {
        g.swinging = true;
        g.swingTimer = 0;
        g.attackCd = ATTACK_COOLDOWN;
        g._stamina = Math.max(0, g._stamina - stam);
        
        // Play attack sound
        const wpnIcon = wpn?.icon || 'sword';
        if (wpn?.stats?.ranged) {
          SoundSystem.play('shoot');
          
          // Fire projectile
          const mx = g.mouse.x, my = g.mouse.y;
          const psx = g.player.x - g.camera.x + 20;
          const psy = g.player.y - g.camera.y + 20;
          const angle = Math.atan2(my - psy, mx - psx);
          g.projectiles.push({
            x: g.player.x + 20,
            y: g.player.y + 20,
            vx: Math.cos(angle) * 4.5,
            vy: Math.sin(angle) * 4.5,
            dmg: wpn.stats.dmg,
            life: 90,
          });
          
          // Consume arrow
          setHotbar(prev => {
            const n = [...prev];
            const arrowSlot = n.findIndex(h => h?.id === 'arrows' && h.count > 0);
            if (arrowSlot >= 0) {
              n[arrowSlot] = { ...n[arrowSlot], count: n[arrowSlot].count - 1 };
              if (n[arrowSlot].count <= 0) n[arrowSlot] = null;
            }
            return n;
          });
        } else if (wpnIcon === 'axe') {
          SoundSystem.play('chop');
        } else if (wpnIcon === 'spear') {
          SoundSystem.play('thrust');
        } else {
          SoundSystem.play('slash');
        }
      } else {
        showNotif("Not enough stamina!", 1200);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    if (canvas) {
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('click', onClick);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (canvas) {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('click', onClick);
      }
    };
  }, [
    gameStarted, canvasRef, gameRef, dialogue, menuTab, nearNpc, nearRelic, nearTownNpc,
    equipped, hotbar, hotbarSlot, setHotbarSlot, setMenuTab, setDialogue, setDialogueLine,
    setShopOpen, setCurrentShop, usePotion, advanceDialogue, handleRespawn, changeZone,
    activateUltimate, getSkillBonuses, showNotif, setHotbar
  ]);

  return { keys: keysRef.current };
};
