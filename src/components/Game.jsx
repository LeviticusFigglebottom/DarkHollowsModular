// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — MAIN GAME COMPONENT
// Refactored modular architecture
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Constants & Configuration
import { 
  TILE, VIEW_W, VIEW_H, CANVAS_W, CANVAS_H, 
  XP_THRESHOLDS, getGFX, setGraphicsPreset,
  ZONE_BACKGROUNDS
} from '../constants/config.js';

// Data
import { T, SOLID, HAZARD_TILES, LIGHT_SOURCES } from '../data/tiles.js';
import { ITEMS, SHOP_INVENTORY, generateLoot } from '../data/items.js';
import { ENEMY_INFO, getEnemyCreatorForZone } from '../data/enemies.js';
import { SKILL_TREE, calculateSkillBonuses, canUnlockSkill as checkCanUnlockSkill } from '../data/skills.js';

// Systems
import { SoundSystem } from '../systems/SoundSystem.js';

// Maps
import { 
  generateRuinMap, generateTownMap, generateForestMap, generateCaveMap,
  generateCryptMap, generateGraveyardMap, generateDesertMap,
  generateIceMap, generateVolcanicMap
} from '../maps/MapGenerator.js';

// Hooks
import { useInput } from '../hooks/useInput.js';

// UI Components
import { HUD } from './HUD.jsx';
import { Hotbar } from './Hotbar.jsx';
import { MenuPanel } from './MenuPanel.jsx';
import { Minimap } from './Minimap.jsx';
import { DialogueBox } from './DialogueBox.jsx';
import { DeathScreen } from './DeathScreen.jsx';
import { StartMenu } from './StartMenu.jsx';
import { ShopPanel } from './ShopPanel.jsx';

// Rendering
import { drawTile } from '../rendering/drawTile.js';
import { drawPlayer, drawEnemy, drawProjectile, drawFloatingText, drawNPC } from '../rendering/drawEntities.js';

// Systems
import { renderLighting, renderVignette } from '../systems/LightingSystem.js';
import { processEnemyAI, processEnemyKnockback, processEnemyStatusEffects } from '../systems/CombatSystem.js';
import { processPlayerMovement, processDodgeRoll, processPlayerKnockback } from '../systems/MovementSystem.js';

// Utilities
import { 
  getFloatingText, releaseFloatingText, rebuildSpatialGrid, getNearbyEnemies,
  saveGame, loadGame, deleteSave, clamp
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════
// DIALOGUE CONTENT
// ═══════════════════════════════════════════════════════════════
const DM_LINES = [
  "You... you came back...",
  "I tried to hold them off... but there were too many...",
  "The hollows... they came from the catacombs beneath the city...",
  "Take this... the Ashen Blade... it was my father's...",
  "Find the survivors... they fled to the eastern village...",
  "Beware the one who leads them... the Hollow King...",
  "Promise me... you'll end this nightmare...",
  "Go now... before more come... I'll hold... this... position...",
];

const ZONE_LABELS = {
  ruin: "The Ashen City",
  town: "Ashenmoor",
  forest: "The Darkwood",
  cave: "Hollow Caves",
  crypt: "The Catacombs",
  graveyard: "Old Graveyard",
  desert: "Scorched Desert",
  ice: "Frozen Wastes",
  volcanic: "Volcanic Depths",
};

// ═══════════════════════════════════════════════════════════════
// MAIN GAME COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Game() {
  // ═══════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════
  const canvasRef = useRef(null);
  const minimapRef = useRef(null);
  const gameRef = useRef({
    player: { x: 15 * TILE, y: 25 * TILE, dir: 2, frame: 0, kbx: 0, kby: 0, dodging: false, dodgeTimer: 0, dodgeDir: { x: 0, y: 0 }, aimAngle: 0 },
    camera: { x: 0, y: 0 },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    floatingTexts: [],
    doors: {},
    mouse: { x: 0, y: 0 },
    time: 0,
    frameCount: 0,
    swinging: false,
    swingTimer: 0,
    swingHit: false,
    attackCd: 0,
    dmgCooldown: 0,
    screenShake: 0,
    dead: false,
    zoneTransitCd: 0,
    hazardCd: 0,
    _stamina: 100,
    _combatTimer: 180,
    _cameraSnapFrames: 0,
    _lastDotTime: 0,
    ultCds: { berserker: 0, shadowstep: 0, ironwill: 0 },
    sprintLocked: false,
    showFps: false,
    relicCollected: false,
    flashbackComplete: false,
    talkingNpc: null,
  });

  // Map data refs
  const ruinData = useRef(null);
  const townData = useRef(null);
  const forestData = useRef(null);
  const caveData = useRef(null);
  const cryptData = useRef(null);
  const graveyardData = useRef(null);
  const desertData = useRef(null);
  const iceData = useRef(null);
  const volcanicData = useRef(null);

  // NPC refs
  const npcsRef = useRef([]);
  const townNPCsRef = useRef([]);

  // Phase ref for game loop access
  const phaseRef = useRef('ruin');
  const deadRef = useRef(false);
  const skillsRef = useRef({});
  const statusEffectsRef = useRef([]);
  const activeUltRef = useRef(null);

  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════
  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState('ruin');
  const [health, setHealth] = useState(100);
  const [maxHealth] = useState(100);
  const [stamina, setStamina] = useState(100);
  const [maxStamina] = useState(100);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [gold, setGold] = useState(0);
  const [skillPoints, setSkillPoints] = useState(0);
  const [skills, setSkills] = useState({});
  const [statusEffects, setStatusEffects] = useState([]);
  const [activeUlt, setActiveUlt] = useState(null);

  // Equipment & Inventory
  const [equipped, setEquipped] = useState({ weapon: null, armor: null, relic: null });
  const [hotbar, setHotbar] = useState([null, null, null, null, null]);
  const [hotbarSlot, setHotbarSlot] = useState(0);

  // UI State
  const [menuTab, setMenuTab] = useState(null);
  const [dialogue, setDialogue] = useState(null);
  const [dialogueLine, setDialogueLine] = useState(0);
  const [npcDead, setNpcDead] = useState(false);
  const [nearNpc, setNearNpc] = useState(null);
  const [nearRelic, setNearRelic] = useState(false);
  const [nearTownNpc, setNearTownNpc] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [transAlpha, setTransAlpha] = useState(0);
  const [quests, setQuests] = useState({
    main: { id: 'main', name: 'Escape the Ruins', desc: 'Find a way out of the Ashen City', status: 'active' },
  });

  // Shop state
  const [shopOpen, setShopOpen] = useState(false);
  const [currentShop, setCurrentShop] = useState(null);

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // Generate all maps on mount
    ruinData.current = generateRuinMap();
    townData.current = generateTownMap();
    forestData.current = generateForestMap();
    caveData.current = generateCaveMap();
    cryptData.current = generateCryptMap();
    graveyardData.current = generateGraveyardMap();
    desertData.current = generateDesertMap();
    iceData.current = generateIceMap();
    volcanicData.current = generateVolcanicMap();

    // Initialize ruin NPCs
    npcsRef.current = [
      { id: 'knight', type: 'knight', name: 'Dying Knight', x: 18 * TILE, y: 28 * TILE, dead: false },
    ];

    // Initialize town NPCs
    townNPCsRef.current = [
      { id: 'blacksmith', type: 'merchant', name: 'Blacksmith', x: 25 * TILE, y: 20 * TILE, shop: SHOP_INVENTORY.town },
      { id: 'alchemist', type: 'merchant', name: 'Alchemist', x: 35 * TILE, y: 25 * TILE, shop: SHOP_INVENTORY.town },
    ];

    // Initialize enemies for starting zone
    const g = gameRef.current;
    const createEnemies = getEnemyCreatorForZone('ruin');
    g.enemies = createEnemies();

    // Initialize sound system
    SoundSystem.init();

    // Check for saved game
    const saved = loadGame();
    if (saved) {
      // Restore saved state (could implement full save restoration here)
    }
  }, []);

  // Sync refs with state
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { deadRef.current = health <= 0; }, [health]);
  useEffect(() => { skillsRef.current = skills; }, [skills]);
  useEffect(() => { statusEffectsRef.current = statusEffects; }, [statusEffects]);
  useEffect(() => { activeUltRef.current = activeUlt; }, [activeUlt]);

  // ═══════════════════════════════════════════════════════════
  // MAP DATA REFS OBJECT
  // ═══════════════════════════════════════════════════════════
  const mapDataRefs = useMemo(() => ({
    ruin: ruinData,
    town: townData,
    forest: forestData,
    cave: caveData,
    crypt: cryptData,
    graveyard: graveyardData,
    desert: desertData,
    ice: iceData,
    volcanic: volcanicData,
  }), []);

  // ═══════════════════════════════════════════════════════════
  // SKILL BONUSES (cached)
  // ═══════════════════════════════════════════════════════════
  const skillBonusCache = useRef({ skills: {}, result: null });
  
  const getSkillBonuses = useCallback(() => {
    const currentSkills = skillsRef.current;
    if (skillBonusCache.current.result && skillBonusCache.current.skills === currentSkills) {
      return skillBonusCache.current.result;
    }
    const result = calculateSkillBonuses(currentSkills);
    skillBonusCache.current = { skills: currentSkills, result };
    return result;
  }, []);

  const canUnlockSkill = useCallback((skill) => {
    return checkCanUnlockSkill(skill, skillsRef.current, skillPoints);
  }, [skillPoints]);

  const unlockSkill = useCallback((skill) => {
    if (!canUnlockSkill(skill)) return;
    setSkills(prev => ({ ...prev, [skill.id]: true }));
    setSkillPoints(prev => prev - skill.cost);
    SoundSystem.play('pickup');
    showNotif(`Unlocked: ${skill.name}!`, 3000);
  }, [canUnlockSkill]);

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  const showNotif = useCallback((text, duration = 3000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text, fade: 1 }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // STATUS EFFECTS
  // ═══════════════════════════════════════════════════════════
  const applyStatusEffect = useCallback((type, duration, tickDmg = 0) => {
    const existing = statusEffectsRef.current.find(e => e.type === type);
    if (existing) {
      statusEffectsRef.current = statusEffectsRef.current.map(e =>
        e.type === type ? { ...e, duration: Math.max(e.duration, duration), tickDmg: Math.max(e.tickDmg || 0, tickDmg) } : e
      );
    } else {
      statusEffectsRef.current = [...statusEffectsRef.current, { type, duration, tickDmg, startTime: Date.now() }];
    }
    setStatusEffects([...statusEffectsRef.current]);
    
    const effectNames = { poison: "Poisoned!", venom: "Envenomed!", burn: "Burning!", freeze: "Slowed!", bleed: "Bleeding!" };
    showNotif(effectNames[type] || type, 1500);
    
    const sounds = { poison: 'hurt', venom: 'hurt', burn: 'fireball', freeze: 'hit', bleed: 'hurt' };
    SoundSystem.play(sounds[type] || 'hurt');
  }, [showNotif]);

  // ═══════════════════════════════════════════════════════════
  // ULTIMATE ABILITIES
  // ═══════════════════════════════════════════════════════════
  const activateUltimate = useCallback((type) => {
    const g = gameRef.current;
    if (g.ultCds?.[type] > 0) {
      showNotif("Ultimate still on cooldown!", 1500);
      return;
    }

    const durations = { berserker: 480, shadowstep: 1, ironwill: 300 };
    const cooldowns = { berserker: 3600, shadowstep: 2700, ironwill: 3600 };
    
    if (!g.ultCds) g.ultCds = { berserker: 0, shadowstep: 0, ironwill: 0 };
    g.ultCds[type] = cooldowns[type];

    if (type === 'shadowstep') {
      // Teleport behind nearest enemy
      const p = g.player;
      let nearest = null, minD = Infinity;
      g.enemies.forEach(e => {
        if (e.dead) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) { minD = d; nearest = e; }
      });
      
      if (nearest && minD < 400) {
        const dx = nearest.x - p.x, dy = nearest.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        p.x = nearest.x - (dx / d) * 50;
        p.y = nearest.y - (dy / d) * 50;
        nearest.atkCd = 180;
        nearest.hitCd = 12;
        showNotif("Shadow Step!", 2000);
        g.screenShake = 10;
        SoundSystem.play('teleport');
      } else {
        showNotif("No target nearby!", 1500);
      }
    } else {
      setActiveUlt({ type, timer: durations[type] });
      showNotif(type === 'berserker' ? "BERSERKER RAGE!" : "IRON WILL!", 2000);
      g.screenShake = 8;
      SoundSystem.play('levelup');
    }
  }, [showNotif]);

  // ═══════════════════════════════════════════════════════════
  // ZONE TRANSITIONS
  // ═══════════════════════════════════════════════════════════
  const changeZone = useCallback((newZone, px, py) => {
    const g = gameRef.current;
    if (g.zoneTransitCd > 0) return;
    
    g.zoneTransitCd = 30;
    g._cameraSnapFrames = 30;
    
    setTransAlpha(0.6);
    
    setTimeout(() => {
      setPhase(newZone);
      phaseRef.current = newZone;
      g.player.x = px * TILE;
      g.player.y = py * TILE;
      g.player.kbx = 0;
      g.player.kby = 0;
      
      // Create enemies for new zone
      const createEnemies = getEnemyCreatorForZone(newZone);
      g.enemies = createEnemies();
      
      // Snap camera
      g.camera.x = g.player.x + 20 - CANVAS_W / 2;
      g.camera.y = g.player.y + 20 - CANVAS_H / 2;
      g._cameraSnapFrames = 20;
    }, 100);
    
    setTimeout(() => setTransAlpha(0), 300);
    setTimeout(() => showNotif(ZONE_LABELS[newZone] || newZone, 2500), 150);
  }, [showNotif]);

  // ═══════════════════════════════════════════════════════════
  // DEATH & RESPAWN
  // ═══════════════════════════════════════════════════════════
  const handleDeath = useCallback(() => {
    const g = gameRef.current;
    g.dead = true;
    deadRef.current = true;
    SoundSystem.play('hurt');
    setGold(prev => Math.floor(prev * 0.9)); // Lose 10% gold
  }, []);

  const handleRespawn = useCallback(() => {
    const g = gameRef.current;
    const z = phaseRef.current;
    
    g.dead = false;
    deadRef.current = false;
    setHealth(100);
    setStamina(100);
    setStatusEffects([]);
    statusEffectsRef.current = [];
    
    // Respawn positions per zone
    const respawnPositions = {
      ruin: { x: 15, y: 25 },
      town: { x: 30, y: 30 },
      forest: { x: 34, y: 58 },
      cave: { x: 5, y: 35 },
      crypt: { x: 32, y: 5 },
      graveyard: { x: 5, y: 30 },
      desert: { x: 30, y: 6 },
      ice: { x: 55, y: 30 },
      volcanic: { x: 30, y: 6 },
    };
    
    const pos = respawnPositions[z] || { x: 15, y: 25 };
    g.player.x = pos.x * TILE;
    g.player.y = pos.y * TILE;
    g.player.kbx = 0;
    g.player.kby = 0;
    
    // Respawn enemies
    const createEnemies = getEnemyCreatorForZone(z);
    g.enemies = createEnemies();
    
    g._cameraSnapFrames = 30;
    
    const hasBonfire = z === 'town';
    showNotif(hasBonfire ? "Risen at bonfire." : "You have fallen. Rise again.", 3000);
    SoundSystem.play('potion');
  }, [showNotif]);

  useEffect(() => {
    if (health <= 0 && !deadRef.current) handleDeath();
  }, [health, handleDeath]);

  // ═══════════════════════════════════════════════════════════
  // POTIONS & ITEMS
  // ═══════════════════════════════════════════════════════════
  const usePotion = useCallback((slotIdx) => {
    const item = hotbar[slotIdx];
    if (!item || item.type !== 'consumable' || item.count <= 0) return;
    
    if (item.stats?.heal) {
      const sb = getSkillBonuses();
      const maxHp = maxHealth + (sb.maxHpBonus || 0);
      setHealth(h => Math.min(maxHp, h + item.stats.heal));
      gameRef.current.floatingTexts.push(getFloatingText(
        gameRef.current.player.x + 20,
        gameRef.current.player.y - 10,
        '+' + item.stats.heal,
        '#60ff60',
        40,
        false
      ));
    }
    
    if (item.stats?.stamina) {
      setStamina(s => Math.min(maxStamina, s + item.stats.stamina));
    }
    
    // Remove status effects if antidote
    if (item.id === 'antidote') {
      statusEffectsRef.current = statusEffectsRef.current.filter(e => e.type !== 'poison' && e.type !== 'venom');
      setStatusEffects([...statusEffectsRef.current]);
    }
    
    SoundSystem.play('potion');
    
    // Decrement count
    setHotbar(prev => {
      const newBar = [...prev];
      if (newBar[slotIdx].count > 1) {
        newBar[slotIdx] = { ...newBar[slotIdx], count: newBar[slotIdx].count - 1 };
      } else {
        newBar[slotIdx] = null;
      }
      return newBar;
    });
  }, [hotbar, maxHealth, maxStamina, getSkillBonuses]);

  // ═══════════════════════════════════════════════════════════
  // SHOP
  // ═══════════════════════════════════════════════════════════
  const buyItem = useCallback((shopItem) => {
    if (gold < shopItem.price) {
      showNotif("Not enough gold!", 1500);
      return;
    }
    if (shopItem.stock <= 0) {
      showNotif("Out of stock!", 1500);
      return;
    }
    
    setGold(prev => prev - shopItem.price);
    shopItem.stock--;
    
    // Add to hotbar
    const template = Object.values(ITEMS).find(it => it.id === shopItem.item);
    if (template) {
      setHotbar(prev => {
        const newBar = [...prev];
        let found = false;
        
        // Try to stack
        for (let i = 0; i < newBar.length; i++) {
          if (newBar[i]?.id === shopItem.item && template.type === 'consumable') {
            newBar[i] = { ...newBar[i], count: newBar[i].count + 1 };
            found = true;
            break;
          }
        }
        
        // Find empty slot
        if (!found) {
          for (let i = 0; i < newBar.length; i++) {
            if (!newBar[i]) {
              newBar[i] = { ...template, count: 1 };
              found = true;
              break;
            }
          }
        }
        
        if (!found) showNotif("Inventory full!", 1500);
        return newBar;
      });
    }
    
    SoundSystem.play('pickup');
    showNotif(`Purchased ${shopItem.name}!`, 2000);
  }, [gold, showNotif]);

  // ═══════════════════════════════════════════════════════════
  // EQUIPMENT
  // ═══════════════════════════════════════════════════════════
  const equipItem = useCallback((item) => {
    if (!item || !['weapon', 'armor', 'relic'].includes(item.type)) return;
    
    setEquipped(prev => {
      const newEquipped = { ...prev };
      const oldItem = newEquipped[item.type];
      newEquipped[item.type] = item;
      
      // Move old item back to hotbar
      if (oldItem) {
        setHotbar(hb => {
          const newBar = [...hb];
          const emptyIdx = newBar.findIndex(s => !s);
          if (emptyIdx >= 0) newBar[emptyIdx] = oldItem;
          return newBar;
        });
      }
      
      // Remove from hotbar
      setHotbar(hb => {
        const newBar = [...hb];
        const idx = newBar.findIndex(s => s?.id === item.id);
        if (idx >= 0) newBar[idx] = null;
        return newBar;
      });
      
      return newEquipped;
    });
    
    SoundSystem.play('pickup');
  }, []);

  const unequipItem = useCallback((slot) => {
    setEquipped(prev => {
      if (!prev[slot]) return prev;
      
      const item = prev[slot];
      setHotbar(hb => {
        const newBar = [...hb];
        const emptyIdx = newBar.findIndex(s => !s);
        if (emptyIdx >= 0) newBar[emptyIdx] = item;
        return newBar;
      });
      
      return { ...prev, [slot]: null };
    });
    
    SoundSystem.play('pickup');
  }, []);

  // ═══════════════════════════════════════════════════════════
  // DIALOGUE
  // ═══════════════════════════════════════════════════════════
  const advanceDialogue = useCallback(() => {
    if (dialogueLine < DM_LINES.length - 1) {
      setDialogueLine(prev => prev + 1);
    } else {
      // End dialogue, give rewards
      setDialogue(null);
      setNpcDead(true);
      
      // Give Ashen Blade
      const ashenBlade = ITEMS.ashen_blade;
      if (ashenBlade) {
        setEquipped(prev => ({ ...prev, weapon: { ...ashenBlade } }));
        showNotif("Received: Ashen Blade", 3000);
      }
      
      // Mark knight as dead
      if (npcsRef.current) {
        const knight = npcsRef.current.find(n => n.id === 'knight');
        if (knight) knight.dead = true;
      }
      
      gameRef.current.flashbackComplete = true;
    }
  }, [dialogueLine, showNotif]);

  // ═══════════════════════════════════════════════════════════
  // LEVEL UP CHECK
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    let newLevel = 1;
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= XP_THRESHOLDS[i]) {
        newLevel = i + 1;
        break;
      }
    }
    if (newLevel > level) {
      setLevel(newLevel);
      setSkillPoints(sp => sp + 1);
      showNotif(`Level Up! You are now level ${newLevel} (+1 Skill Point)`, 3500);
      SoundSystem.play('levelup');
    }
  }, [xp, level, showNotif]);

  // ═══════════════════════════════════════════════════════════
  // PROLOGUE MESSAGES
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!gameStarted || phaseRef.current !== 'ruin') return;
    const g = gameRef.current;
    if (g.flashbackComplete) return;
    
    const t1 = setTimeout(() => showNotif("The Ashen City...", 3000), 800);
    const t2 = setTimeout(() => showNotif("Find a way through the ruins", 4000), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [gameStarted, showNotif]);

  // ═══════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ═══════════════════════════════════════════════════════════
  const { keys } = useInput({
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
  });

  // ═══════════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════════
  const lastTimeRef = useRef(0);
  const fpsDataRef = useRef({ lastFpsUpdate: 0, frameCount: 0, fps: 60 });

  useEffect(() => {
    if (!gameStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const g = gameRef.current;

    const TARGET_FPS = 60;
    const FRAME_TIME = 1000 / TARGET_FPS;

    const loop = (ts) => {
      // Delta time
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

      // Get current map data
      const md = mapDataRefs[zone]?.current;
      if (!md) { animId = requestAnimationFrame(loop); return; }
      
      const MAP_W = md.w;
      const MAP_H = md.h;
      const p = g.player;

      const inDlg = !!dialogue;
      const inMenu = menuTab !== null;

      // Cooldowns
      if (g.zoneTransitCd > 0) g.zoneTransitCd -= dtMult;
      if (g._combatTimer !== undefined) g._combatTimer += dtMult;
      else g._combatTimer = 180;
      if (g.attackCd > 0) g.attackCd -= dtMult;
      if (g.dmgCooldown > 0) g.dmgCooldown -= dtMult;

      // Ultimate timer
      if (activeUltRef.current) {
        const newTimer = activeUltRef.current.timer - dtMult;
        if (newTimer <= 0) {
          setActiveUlt(null);
          activeUltRef.current = null;
        } else {
          activeUltRef.current = { ...activeUltRef.current, timer: newTimer };
        }
      }

      // Ultimate cooldowns
      if (g.ultCds) {
        Object.keys(g.ultCds).forEach(k => {
          if (g.ultCds[k] > 0) g.ultCds[k] -= dtMult;
        });
      }

      // Skip updates if dead
      if (!g.dead) {
        // Player knockback
        processPlayerKnockback(p, md, SOLID, dtMult);

        // Dodge roll
        if (p.dodging) {
          processDodgeRoll(p, md, SOLID, MAP_W, MAP_H, dtMult);
        }

        // Facing direction
        const psx = p.x - g.camera.x + 20;
        const psy = p.y - g.camera.y + 20;
        const mdx = g.mouse.x - psx;
        const mdy = g.mouse.y - psy;
        p.aimAngle = Math.atan2(mdy, mdx);
        p.dir = Math.abs(mdx) > Math.abs(mdy) ? (mdx > 0 ? 1 : 3) : (mdy > 0 ? 2 : 0);

        // Movement
        if (!inDlg && !inMenu && !p.dodging) {
          const sb = getSkillBonuses();
          const freezeEffect = statusEffectsRef.current.find(e => e.type === 'freeze');
          processPlayerMovement(p, g, keys, md, SOLID, MAP_W, MAP_H, sb, freezeEffect, dtMult);
        }

        // Stamina regen
        const sb = getSkillBonuses();
        const isMoving = keys['w'] || keys['s'] || keys['a'] || keys['d'];
        const regenRate = isMoving ? 0.04 : 0.08;
        const regenMult = 1 + (sb.stamRegenMult || 0);
        if (!keys['shift'] && g._stamina < 100) {
          g._stamina = Math.min(100, g._stamina + regenRate * regenMult * dtMult);
          setStamina(g._stamina);
        }

        // HP regen
        if (g._combatTimer > 180 && !statusEffectsRef.current.some(e => e.type === 'poison' || e.type === 'venom')) {
          const hpRegen = 0.012 * (1 + (sb.hpRegenMult || 0)) * dtMult;
          setHealth(h => Math.min(100 + (sb.maxHpBonus || 0), h + hpRegen));
        }

        // Status effect DOT
        if (statusEffectsRef.current.length > 0 && g.frameCount % 30 === 0) {
          let dotDmg = 0, dotColor = '#ffffff';
          statusEffectsRef.current.forEach(eff => {
            if (eff.type !== 'poison' && eff.type !== 'freeze' && eff.tickDmg > 0) {
              dotDmg += eff.tickDmg;
              dotColor = eff.type === 'venom' ? '#80ff40' : eff.type === 'burn' ? '#ff8040' : '#c03030';
            }
          });
          if (dotDmg > 0) {
            setHealth(h => Math.max(1, h - dotDmg));
            g.floatingTexts.push(getFloatingText(p.x + 20, p.y - 10, dotDmg, dotColor, 25, false));
          }
        }

        // Decrement effect durations
        statusEffectsRef.current = statusEffectsRef.current
          .map(eff => ({ ...eff, duration: eff.duration - dtMult }))
          .filter(eff => eff.duration > 0);
        if (g.frameCount % 20 === 0) setStatusEffects([...statusEffectsRef.current]);

        // Hazard tiles
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
            g.floatingTexts.push(getFloatingText(p.x + 20, p.y - 10, hazard.dmg,
              hazard.type === 'fire' ? '#ff8040' : hazard.type === 'poison' ? '#60c060' : '#ff4040', 30, false));
            g.screenShake = 3;
            g._combatTimer = 0;
            if (hazard.effect && hazard.duration) {
              applyStatusEffect(hazard.effect, hazard.duration, hazard.effect === 'poison' ? 0 : 3);
            }
            SoundSystem.play(hazard.type === 'fire' ? 'fireball' : 'hurt');
          }
        }

        // Zone transitions
        if (g.zoneTransitCd <= 0) {
          const ptx = Math.floor((p.x + 20) / TILE);
          const pty = Math.floor((p.y + 20) / TILE);
          
          if (isTown) {
            if (pty <= 8 && ptx >= 28 && ptx <= 48) changeZone('forest', 34, 58);
            if (ptx >= MAP_W - 5 && pty >= 20 && pty <= 40) changeZone('graveyard', 5, 30);
            if (pty >= MAP_H - 5 && ptx >= 20 && ptx <= 45) changeZone('desert', 30, 6);
            if (ptx <= 8 && pty >= 25 && pty <= 45) changeZone('ice', 55, 30);
          }
          if (zone === 'forest') {
            if (pty >= MAP_H - 5) changeZone('town', 38, 10);
            if (ptx >= MAP_W - 5 && pty >= 25 && pty <= 45) changeZone('cave', 5, 35);
          }
          if (zone === 'cave') {
            if (ptx <= 5 && pty >= 25 && pty <= 45) changeZone('forest', 55, 35);
          }
          if (zone === 'graveyard') {
            if (ptx <= 5 && pty >= 20 && pty <= 40) changeZone('town', 55, 30);
            if (pty >= MAP_H - 5 && ptx >= 25 && ptx <= 40) changeZone('crypt', 32, 5);
          }
          if (zone === 'crypt') {
            if (pty <= 5 && ptx >= 25 && ptx <= 40) changeZone('graveyard', 32, 55);
          }
          if (zone === 'desert') {
            if (pty <= 5) changeZone('town', 32, 55);
            if (pty >= MAP_H - 5) changeZone('volcanic', 30, 6);
          }
          if (zone === 'ice') {
            if (ptx >= MAP_W - 5 && pty >= 26 && pty <= 35) changeZone('town', 10, 35);
          }
          if (zone === 'volcanic') {
            if (pty <= 5) changeZone('desert', 30, 45);
          }
          if (zone === 'ruin') {
            if (pty >= MAP_H - 5) changeZone('town', 38, 10);
          }
        }

        // Attack swing
        if (g.swinging) {
          g.swingTimer += dtMult;
          const swingDur = 12;
          
          if (g.swingTimer >= 4 && g.swingTimer < 8 && !g.swingHit) {
            const wpn = equipped.weapon;
            const baseDmg = wpn?.stats?.dmg || 5;
            const range = wpn?.stats?.range || 50;
            const arc = wpn?.stats?.arc || 0.8;

            if (!wpn?.stats?.ranged) {
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

                e.hitCd = 20;
                const dmgMult = 1 + (sb.dmgMult || 0);
                const isCrit = Math.random() < (sb.critChance || 0);
                const critMult = isCrit ? (1.5 + (sb.critMult || 0)) : 1;
                let dmg = Math.floor(baseDmg * dmgMult * critMult);
                if (activeUltRef.current?.type === 'berserker') dmg = Math.floor(dmg * 1.5);
                
                e.hp -= dmg;
                g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 10, dmg, isCrit ? '#ffa040' : '#ffffff', isCrit ? 45 : 35, isCrit));

                const kbBase = wpn?.stats?.kb || 12;
                const kbMult = 1 + (sb.kbMult || 0);
                const kb = kbBase * kbMult / Math.max(1, dist / 40);
                e.kbx = (dx / dist) * kb;
                e.kby = (dy / dist) * kb;

                SoundSystem.play('hit');
                g._combatTimer = 0;
                g.swingHit = true;

                if (e.hp <= 0) {
                  e.dead = true;
                  e.deathTime = ts;
                  const info = ENEMY_INFO[e.type];
                  const bonusXp = info?.xp || 10;
                  setXp(x => x + bonusXp);
                  if (isCrit) g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 25, 'CRITICAL!', '#ffa040', 60, true));
                  g.floatingTexts.push(getFloatingText(e.x + 20, e.y - 5, '+' + bonusXp + ' XP', '#60ff60', 50, false));
                  if (sb.killHeal > 0) setHealth(h => Math.min(100 + (sb.maxHpBonus || 0), h + sb.killHeal));

                  const loot = generateLoot(e.type);
                  let yOff = 25;
                  loot.forEach(drop => {
                    if (drop.type === 'gold') {
                      setGold(gld => gld + drop.amount);
                      g.floatingTexts.push(getFloatingText(e.x + 20, e.y - yOff, '+' + drop.amount + 'g', '#ffd700', 45, false));
                    }
                    yOff += 15;
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

        // Projectiles
        g.projectiles = g.projectiles.filter(proj => {
          proj.x += proj.vx * dtMult;
          proj.y += proj.vy * dtMult;
          proj.life -= dtMult;
          if (proj.life <= 0) return false;

          for (const e of g.enemies) {
            if (e.dead || e.hitCd > 0) continue;
            const dx = proj.x - (e.x + 20), dy = proj.y - (e.y + 20);
            if (dx * dx + dy * dy < 900) {
              e.hitCd = 20;
              const dmg = Math.floor(proj.dmg * (1 + (sb.dmgMult || 0)));
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
                setXp(x => x + (ENEMY_INFO[e.type]?.xp || 10));
                SoundSystem.play('kill');
              }
              return false;
            }
          }

          const tx = Math.floor(proj.x / TILE), ty = Math.floor(proj.y / TILE);
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || SOLID.has(md.map[ty][tx])) return false;
          return true;
        });

        // Enemy projectiles
        g.enemyProjectiles = g.enemyProjectiles.filter(proj => {
          proj.x += proj.vx * dtMult;
          proj.y += proj.vy * dtMult;
          proj.life -= dtMult;
          if (proj.life <= 0) return false;

          const dx = proj.x - (p.x + 20), dy = proj.y - (p.y + 20);
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
            if (proj.effect && proj.effectDuration) applyStatusEffect(proj.effect, proj.effectDuration, proj.effectDmg || 0);
            return false;
          }

          const tx = Math.floor(proj.x / TILE), ty = Math.floor(proj.y / TILE);
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || SOLID.has(md.map[ty][tx])) return false;
          return true;
        });

        // Enemy AI
        const aiSkip = GFX.enemyAISkipFrames || 1;
        g.enemies.forEach((e, idx) => {
          if (e.dead) {
            if (ts - e.deathTime > 800) e.remove = true;
            return;
          }

          processEnemyKnockback(e, md, SOLID, MAP_W, MAP_H, dtMult);
          if (Math.abs(e.kbx) > 0.5 || Math.abs(e.kby) > 0.5) return;

          processEnemyStatusEffects(e, g, ts, dtMult);

          const distToPlayer = Math.sqrt((e.x - p.x) ** 2 + (e.y - p.y) ** 2);
          if (distToPlayer > GFX.maxEnemyAIDistance && g.frameCount % aiSkip !== idx % aiSkip) return;

          processEnemyAI(e, p, g, md, SOLID, MAP_W, MAP_H, ts, dtMult, equipped, sb, activeUltRef, setHealth, applyStatusEffect);
        });

        g.enemies = g.enemies.filter(e => !e.remove);

        // NPC proximity
        if (zone === 'ruin' && npcsRef.current) {
          let found = false;
          npcsRef.current.forEach(npc => {
            const dist = Math.sqrt((p.x - npc.x) ** 2 + (p.y - npc.y) ** 2);
            if (dist < 80 && !npc.dead) { setNearNpc(npc); found = true; }
          });
          if (!found && nearNpc) setNearNpc(null);
        }

        if (isTown && townNPCsRef.current) {
          let found = null;
          townNPCsRef.current.forEach(npc => {
            const dist = Math.sqrt((p.x - npc.x) ** 2 + (p.y - npc.y) ** 2);
            if (dist < 80) found = npc;
          });
          if (found !== nearTownNpc) setNearTownNpc(found);
        }
      }

      // Floating text cleanup
      g.floatingTexts = g.floatingTexts.filter(ft => {
        ft.life -= dtMult;
        ft.y -= 0.5 * dtMult;
        if (ft.life <= 0) { releaseFloatingText(ft); return false; }
        return true;
      });

      // Camera
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

      // ═══════════════════════════════════════════════════════
      // RENDERING
      // ═══════════════════════════════════════════════════════
      const camX = Math.floor(g.camera.x);
      const camY = Math.floor(g.camera.y);

      ctx.save();
      if (g.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * g.screenShake, (Math.random() - 0.5) * g.screenShake);
        g.screenShake *= 0.9;
        if (g.screenShake < 0.5) g.screenShake = 0;
      }

      // Background
      ctx.fillStyle = ZONE_BACKGROUNDS[zone] || '#06060a';
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
          drawTile(ctx, tile, tx * TILE - camX, ty * TILE - camY, TILE, g.frameCount);
        }
      }

      // NPCs
      if (zone === 'ruin' && npcsRef.current) {
        npcsRef.current.forEach(npc => {
          if (!npc.dead) drawNPC(ctx, npc, camX, camY);
        });
      }
      if (isTown && townNPCsRef.current) {
        townNPCsRef.current.forEach(npc => drawNPC(ctx, npc, camX, camY));
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
      if (GFX.lighting && zone !== 'town') {
        renderLighting(ctx, md, camX, camY, p, zone, TILE, VIEW_W, VIEW_H, CANVAS_W, CANVAS_H);
      }

      // Vignette
      if (GFX.vignette) {
        renderVignette(ctx, CANVAS_W, CANVAS_H);
      }

      // FPS
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
  }, [gameStarted, dialogue, menuTab, equipped, keys, changeZone, applyStatusEffect, getSkillBonuses, showNotif, nearNpc, nearTownNpc, mapDataRefs]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const sb = getSkillBonuses();
  const hasSaveData = !!loadGame();

  return (
    <div style={styles.container}>
      {/* Start Menu */}
      <StartMenu
        isOpen={!gameStarted}
        hasSaveData={hasSaveData}
        onNewGame={() => setGameStarted(true)}
        onContinue={() => setGameStarted(true)}
      />

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={styles.canvas}
      />

      {/* HUD */}
      {gameStarted && (
        <HUD
          health={health}
          maxHealth={maxHealth}
          stamina={stamina}
          maxStamina={maxStamina}
          xp={xp}
          level={level}
          gold={gold}
          statusEffects={statusEffects}
          skillBonuses={sb}
          equipped={equipped}
          notifications={notifications}
        />
      )}

      {/* Hotbar */}
      {gameStarted && (
        <Hotbar
          hotbar={hotbar}
          selectedSlot={hotbarSlot}
          onSlotClick={setHotbarSlot}
        />
      )}

      {/* Minimap */}
      {gameStarted && mapDataRefs[phase]?.current && (
        <Minimap
          gameRef={gameRef}
          mapData={mapDataRefs[phase].current}
          zone={phase}
          playerX={gameRef.current.player.x}
          playerY={gameRef.current.player.y}
          enemies={gameRef.current.enemies}
          npcs={phase === 'town' ? townNPCsRef.current : npcsRef.current}
        />
      )}

      {/* Menu Panel */}
      <MenuPanel
        isOpen={menuTab !== null}
        activeTab={menuTab}
        onTabChange={setMenuTab}
        onClose={() => setMenuTab(null)}
        hotbar={hotbar}
        onHotbarChange={setHotbar}
        equipped={equipped}
        onEquipItem={equipItem}
        onUnequipItem={unequipItem}
        skills={skills}
        skillPoints={skillPoints}
        onUnlockSkill={unlockSkill}
        getSkillBonuses={getSkillBonuses}
        quests={quests}
      />

      {/* Dialogue Box */}
      <DialogueBox
        isOpen={dialogue === 'knight'}
        npcName="Dying Knight"
        npcType="knight"
        lines={DM_LINES}
        currentLine={dialogueLine}
        isDead={npcDead}
        onAdvance={advanceDialogue}
        onClose={() => setDialogue(null)}
      />

      {/* Shop Panel */}
      <ShopPanel
        isOpen={shopOpen}
        shopName={currentShop?.name}
        shopInventory={currentShop?.shop}
        playerGold={gold}
        onBuy={buyItem}
        onClose={() => { setShopOpen(false); setCurrentShop(null); }}
      />

      {/* Death Screen */}
      <DeathScreen
        isOpen={health <= 0}
        zoneName={ZONE_LABELS[phase]}
        level={level}
        gold={gold}
        onRespawn={handleRespawn}
        onMainMenu={() => window.location.reload()}
      />

      {/* Zone Transition Overlay */}
      {transAlpha > 0 && (
        <div style={{ ...styles.transitionOverlay, opacity: transAlpha }} />
      )}

      {/* Interaction Prompts */}
      {gameStarted && nearNpc && !dialogue && (
        <div style={styles.prompt}>Press [E] to talk to {nearNpc.name}</div>
      )}
      {gameStarted && nearTownNpc && !shopOpen && (
        <div style={styles.prompt}>Press [E] to interact with {nearTownNpc.name}</div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: CANVAS_W,
    height: CANVAS_H,
    margin: '20px auto',
    background: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0,0,0,0.8)',
  },
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
  transitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#000',
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease',
  },
  prompt: {
    position: 'absolute',
    bottom: 70,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 16px',
    background: 'rgba(0,0,0,0.8)',
    border: '1px solid rgba(139,92,246,0.4)',
    borderRadius: 6,
    color: '#c0b8f0',
    fontSize: 12,
    fontFamily: 'monospace',
    pointerEvents: 'none',
  },
};
