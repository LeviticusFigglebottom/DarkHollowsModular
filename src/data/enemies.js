// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — ENEMIES
// ═══════════════════════════════════════════════════════════════

import { TILE } from './tiles.js';

export const ENEMY_INFO = {
  // Ruin enemies
  hollow:{name:"Hollow Soldier",xp:15,dmg:8,color:"#1a1018",kb:10},
  hollow_knight:{name:"Hollow Knight",xp:30,dmg:14,color:"#2a2030",kb:7},
  // Forest enemies
  timber_wolf:{name:"Timber Wolf",xp:18,dmg:10,color:"#4a3a20",kb:12},
  forest_bandit:{name:"Forest Bandit",xp:22,dmg:11,color:"#3a4030",kb:9},
  bandit_chief:{name:"Bandit Chief",xp:45,dmg:16,color:"#5a3020",kb:5},
  // Cave enemies
  cave_spider:{name:"Cave Spider",xp:20,dmg:9,color:"#2a2828",kb:14},
  cave_lurker:{name:"Cave Lurker",xp:35,dmg:15,color:"#1a2030",kb:7},
  // Special enemies
  skeleton_archer:{name:"Skeleton Archer",xp:25,dmg:12,color:"#c8c0a8",kb:15,isRanged:true},
  shadow_wraith:{name:"Shadow Wraith",xp:40,dmg:18,color:"#3a2050",kb:8,canTeleport:true},
  fire_elemental:{name:"Fire Elemental",xp:35,dmg:14,color:"#ff6020",kb:10,appliesEffect:"burn"},
  poison_slime:{name:"Poison Slime",xp:18,dmg:6,color:"#50a040",kb:16,appliesEffect:"venom"},
  frost_shade:{name:"Frost Shade",xp:32,dmg:11,color:"#80c0e0",kb:12,appliesEffect:"freeze"},
  // Graveyard enemies
  grave_zombie:{name:"Grave Zombie",xp:20,dmg:10,color:"#3a4838",kb:9},
  restless_spirit:{name:"Restless Spirit",xp:28,dmg:12,color:"#6080a0",kb:12,canTeleport:true},
  bone_guard:{name:"Bone Guard",xp:35,dmg:15,color:"#c8c0b0",kb:6},
  // Desert enemies
  desert_scorpion:{name:"Desert Scorpion",xp:25,dmg:11,color:"#8a6a40",kb:11,appliesEffect:"venom"},
  sand_wraith:{name:"Sand Wraith",xp:30,dmg:13,color:"#c4a060",kb:10},
  dune_stalker:{name:"Dune Stalker",xp:35,dmg:14,color:"#6a5a40",kb:8},
  
  // ═══════════════════════════════════════════════════════════════
  // ICE BIOME ENEMIES
  // ═══════════════════════════════════════════════════════════════
  frost_wolf:{name:"Frost Wolf",xp:28,dmg:12,color:"#a0c8d8",kb:10,appliesEffect:"freeze"},
  ice_wraith:{name:"Ice Wraith",xp:35,dmg:14,color:"#80b8d0",kb:8,canTeleport:true,appliesEffect:"freeze"},
  frozen_knight:{name:"Frozen Knight",xp:40,dmg:16,color:"#5080a0",kb:5},
  snow_stalker:{name:"Snow Stalker",xp:30,dmg:13,color:"#d0e0f0",kb:12},
  crystal_golem:{name:"Crystal Golem",xp:45,dmg:18,color:"#60a0c0",kb:3},
  
  // ═══════════════════════════════════════════════════════════════
  // VOLCANIC BIOME ENEMIES
  // ═══════════════════════════════════════════════════════════════
  magma_hound:{name:"Magma Hound",xp:30,dmg:14,color:"#ff6030",kb:10,appliesEffect:"burn"},
  ember_wraith:{name:"Ember Wraith",xp:38,dmg:16,color:"#ff4020",kb:8,canTeleport:true,appliesEffect:"burn"},
  obsidian_golem:{name:"Obsidian Golem",xp:50,dmg:20,color:"#202028",kb:2},
  flame_imp:{name:"Flame Imp",xp:25,dmg:10,color:"#ff8040",kb:14,isRanged:true,appliesEffect:"burn"},
  ash_crawler:{name:"Ash Crawler",xp:22,dmg:11,color:"#4a4040",kb:12},
  
  // ═══════════════════════════════════════════════════════════════
  // BOSS ENEMIES
  // ═══════════════════════════════════════════════════════════════
  hollow_lord:{name:"Hollow Lord",xp:150,dmg:25,color:"#3a2848",kb:3,isBoss:true},
  alpha_wolf:{name:"Alpha Wolf",xp:100,dmg:20,color:"#5a4028",kb:4,isBoss:true},
  spider_queen:{name:"Spider Queen",xp:120,dmg:18,color:"#3a3040",kb:4,isBoss:true},
  oasis_guardian:{name:"Oasis Guardian",xp:110,dmg:20,color:"#2a6a60",kb:4,isBoss:true},
  // New Bosses
  ice_titan:{name:"Ice Titan",xp:140,dmg:24,color:"#4080a0",kb:2,isBoss:true,appliesEffect:"freeze"},
  infernal_lord:{name:"Infernal Lord",xp:160,dmg:28,color:"#c02010",kb:2,isBoss:true,appliesEffect:"burn"},
};

// Loot tables - item drops by enemy type
export const LOOT_TABLES = {
  hollow:[{item:"blood_philter",chance:0.15},{item:"gold",min:2,max:8,chance:0.4}],
  hollow_knight:[{item:"blood_philter",chance:0.25},{item:"verdant_tonic",chance:0.15},{item:"gold",min:5,max:15,chance:0.5}],
  timber_wolf:[{item:"gold",min:1,max:5,chance:0.3}],
  forest_bandit:[{item:"blood_philter",chance:0.2},{item:"gold",min:3,max:12,chance:0.5},{item:"verdant_tonic",chance:0.1},{item:"serrated_dagger",chance:0.05}],
  bandit_chief:[{item:"blood_philter",chance:0.5},{item:"verdant_tonic",chance:0.4},{item:"gold",min:15,max:40,chance:0.8},{item:"executioner_axe",chance:0.15}],
  cave_spider:[{item:"gold",min:1,max:6,chance:0.25},{item:"venom_fang",chance:0.03}],
  cave_lurker:[{item:"blood_philter",chance:0.2},{item:"verdant_tonic",chance:0.15},{item:"gold",min:4,max:14,chance:0.45}],
  skeleton_archer:[{item:"gold",min:3,max:10,chance:0.4},{item:"verdant_tonic",chance:0.15}],
  shadow_wraith:[{item:"blood_philter",chance:0.3},{item:"gold",min:8,max:20,chance:0.5},{item:"frost_blade",chance:0.08}],
  fire_elemental:[{item:"blood_philter",chance:0.25},{item:"gold",min:5,max:15,chance:0.45},{item:"flame_brand",chance:0.10}],
  poison_slime:[{item:"verdant_tonic",chance:0.2},{item:"gold",min:2,max:8,chance:0.35},{item:"venom_fang",chance:0.05}],
  frost_shade:[{item:"blood_philter",chance:0.2},{item:"gold",min:6,max:16,chance:0.4},{item:"frost_blade",chance:0.06}],
  // Graveyard
  grave_zombie:[{item:"blood_philter",chance:0.15},{item:"gold",min:3,max:10,chance:0.35}],
  restless_spirit:[{item:"blood_philter",chance:0.25},{item:"gold",min:5,max:15,chance:0.45}],
  bone_guard:[{item:"blood_philter",chance:0.3},{item:"verdant_tonic",chance:0.15},{item:"gold",min:8,max:20,chance:0.5}],
  // Desert
  desert_scorpion:[{item:"verdant_tonic",chance:0.2},{item:"gold",min:4,max:12,chance:0.4},{item:"venom_fang",chance:0.05}],
  sand_wraith:[{item:"blood_philter",chance:0.2},{item:"gold",min:6,max:16,chance:0.45}],
  dune_stalker:[{item:"blood_philter",chance:0.25},{item:"verdant_tonic",chance:0.15},{item:"gold",min:8,max:18,chance:0.5}],
  // Ice enemies
  frost_wolf:[{item:"blood_philter",chance:0.2},{item:"gold",min:5,max:14,chance:0.45},{item:"frost_blade",chance:0.04}],
  ice_wraith:[{item:"blood_philter",chance:0.25},{item:"gold",min:8,max:18,chance:0.5},{item:"frost_blade",chance:0.08}],
  frozen_knight:[{item:"blood_philter",chance:0.3},{item:"verdant_tonic",chance:0.2},{item:"gold",min:10,max:25,chance:0.55}],
  snow_stalker:[{item:"gold",min:6,max:15,chance:0.4},{item:"verdant_tonic",chance:0.15}],
  crystal_golem:[{item:"blood_philter",chance:0.35},{item:"gold",min:15,max:35,chance:0.6},{item:"frost_blade",chance:0.12}],
  // Volcanic enemies
  magma_hound:[{item:"blood_philter",chance:0.2},{item:"gold",min:6,max:16,chance:0.45},{item:"flame_brand",chance:0.05}],
  ember_wraith:[{item:"blood_philter",chance:0.25},{item:"gold",min:10,max:22,chance:0.5},{item:"flame_brand",chance:0.1}],
  obsidian_golem:[{item:"blood_philter",chance:0.4},{item:"verdant_tonic",chance:0.25},{item:"gold",min:18,max:40,chance:0.65}],
  flame_imp:[{item:"verdant_tonic",chance:0.2},{item:"gold",min:5,max:12,chance:0.4},{item:"flame_brand",chance:0.03}],
  ash_crawler:[{item:"gold",min:4,max:10,chance:0.35},{item:"blood_philter",chance:0.15}],
  // Bosses
  hollow_lord:[{item:"blood_philter",chance:1.0,count:3},{item:"verdant_tonic",chance:1.0,count:2},{item:"gold",min:50,max:100,chance:1.0},{item:"flame_brand",chance:0.4}],
  alpha_wolf:[{item:"blood_philter",chance:1.0,count:2},{item:"gold",min:30,max:60,chance:1.0},{item:"serrated_dagger",chance:0.5}],
  spider_queen:[{item:"verdant_tonic",chance:1.0,count:2},{item:"blood_philter",chance:0.8,count:2},{item:"gold",min:40,max:80,chance:1.0},{item:"venom_fang",chance:0.6}],
  oasis_guardian:[{item:"blood_philter",chance:1.0,count:2},{item:"verdant_tonic",chance:1.0,count:3},{item:"gold",min:40,max:80,chance:1.0},{item:"frost_blade",chance:0.35}],
  ice_titan:[{item:"blood_philter",chance:1.0,count:3},{item:"verdant_tonic",chance:1.0,count:2},{item:"gold",min:60,max:120,chance:1.0},{item:"frost_blade",chance:0.7}],
  infernal_lord:[{item:"blood_philter",chance:1.0,count:3},{item:"verdant_tonic",chance:1.0,count:3},{item:"gold",min:70,max:140,chance:1.0},{item:"flame_brand",chance:0.75}],
};

// Create a single enemy
export function makeEnemy(id,x,y,type,opts={}){
  const info=ENEMY_INFO[type]||ENEMY_INFO.hollow;
  const baseHp=type.includes('boss')||info.isBoss?200:type.includes('golem')?80:type.includes('knight')||type.includes('chief')||type.includes('lurker')?50:type.includes('wraith')||type.includes('guard')?45:35;
  const hp=opts.hp||baseHp;
  const speed=type.includes('wolf')||type.includes('stalker')?1.2:type.includes('golem')?0.5:type.includes('slime')?0.6:0.8;
  return {
    id,x:x*TILE,y:y*TILE,hp,maxHp:hp,type,
    speed,dir:2,frame:0,aggroRange:type.includes('archer')?250:180,atkRange:type.includes('archer')?200:50,
    atkCd:0,hitCd:0,dead:false,kbx:0,kby:0,dmg:info.dmg||8,
    returning:false,homeX:x*TILE,homeY:y*TILE,aggroTimer:0,
    specialCd:0,specialWindupStart:0,specialWindupDur:0,specialType:null,
    lunging:false,lungeTimer:0,lungeDirX:0,lungeDirY:0,
    slamming:false,slamTimer:0,
    enraged:false,wasEnraged:false,speedBuff:0,teleportCd:0,rangedCd:0,
    isRanged:info.isRanged||false,canTeleport:info.canTeleport||false,appliesEffect:info.appliesEffect||null,
    isBoss:info.isBoss||false,
    patrol:{cx:x*TILE,cy:y*TILE,r:opts.r||50,a:Math.random()*Math.PI*2}
  };
}

// Zone enemy creation functions
export function createEnemies(){
  return [
    makeEnemy(0,28,65,"hollow",{r:60}),makeEnemy(1,32,58,"hollow",{r:50}),
    makeEnemy(2,25,48,"hollow_knight",{r:70}),makeEnemy(3,35,44,"hollow",{r:55}),
    makeEnemy(4,30,36,"hollow_knight",{r:40}),makeEnemy(5,22,55,"hollow",{r:45}),
  ];
}

export function createForestEnemies(){
  return [
    makeEnemy(0,20,20,"timber_wolf",{r:60}),makeEnemy(1,35,15,"timber_wolf",{r:70}),
    makeEnemy(2,50,25,"timber_wolf",{r:55}),makeEnemy(3,15,40,"timber_wolf",{r:45}),
    makeEnemy(4,28,35,"forest_bandit",{r:40}),makeEnemy(5,32,38,"forest_bandit",{r:35}),
    makeEnemy(6,30,32,"forest_bandit",{r:30}),makeEnemy(7,35,35,"bandit_chief",{r:25,hp:65}),
    makeEnemy(8,55,45,"timber_wolf",{r:65}),makeEnemy(9,10,55,"forest_bandit",{r:50}),
    makeEnemy(10,45,50,"timber_wolf",{r:60}),
    makeEnemy(11,40,30,"skeleton_archer",{r:35}),makeEnemy(12,25,50,"skeleton_archer",{r:40}),
    makeEnemy(13,60,35,"timber_wolf",{r:50}),makeEnemy(14,62,38,"timber_wolf",{r:45}),
    makeEnemy(15,58,40,"alpha_wolf",{r:30}),
  ];
}

export function createCaveEnemies(){
  return [
    makeEnemy(0,15,12,"cave_spider",{r:40}),makeEnemy(1,25,15,"cave_spider",{r:35}),
    makeEnemy(2,10,25,"cave_spider",{r:45}),makeEnemy(3,30,28,"cave_spider",{r:30}),
    makeEnemy(4,20,35,"cave_lurker",{r:25}),makeEnemy(5,35,20,"cave_lurker",{r:30}),
    makeEnemy(6,25,42,"cave_spider",{r:50}),makeEnemy(7,15,48,"cave_lurker",{r:35}),
    makeEnemy(8,38,45,"cave_spider",{r:40}),
    makeEnemy(9,28,38,"poison_slime",{r:35}),makeEnemy(10,12,32,"poison_slime",{r:30}),
    makeEnemy(11,40,30,"shadow_wraith",{r:25}),
    makeEnemy(12,22,50,"fire_elemental",{r:30}),
    makeEnemy(13,30,55,"cave_spider",{r:40}),makeEnemy(14,35,55,"cave_spider",{r:35}),
    makeEnemy(15,32,58,"spider_queen",{r:25}),
  ];
}

export function createCryptEnemies(){
  return [
    makeEnemy(0,20,6,"hollow",{r:30}),
    makeEnemy(1,24,8,"skeleton_archer",{r:25}),
    makeEnemy(2,10,12,"hollow",{r:35}),makeEnemy(3,14,16,"hollow_knight",{r:30}),
    makeEnemy(4,8,18,"shadow_wraith",{r:30}),
    makeEnemy(5,30,14,"skeleton_archer",{r:35}),makeEnemy(6,34,16,"hollow",{r:30}),
    makeEnemy(7,36,12,"skeleton_archer",{r:25}),
    makeEnemy(8,16,28,"hollow_knight",{r:40}),makeEnemy(9,28,30,"hollow_knight",{r:35}),
    makeEnemy(10,22,26,"shadow_wraith",{r:30}),makeEnemy(11,22,32,"hollow",{r:30}),
    makeEnemy(12,18,30,"skeleton_archer",{r:25}),
    makeEnemy(13,22,36,"hollow_knight",{r:25}),makeEnemy(14,18,38,"shadow_wraith",{r:20}),
    makeEnemy(15,14,42,"hollow_knight",{r:35}),makeEnemy(16,30,42,"hollow_knight",{r:35}),
    makeEnemy(17,20,40,"skeleton_archer",{r:30}),makeEnemy(18,24,40,"skeleton_archer",{r:30}),
    makeEnemy(19,22,44,"hollow_lord",{r:20}),
  ];
}

export function createGraveyardEnemies(){
  return [
    makeEnemy(0,10,10,"grave_zombie",{r:40}),makeEnemy(1,12,30,"grave_zombie",{r:35}),
    makeEnemy(2,30,10,"skeleton_archer",{r:30}),makeEnemy(3,32,35,"grave_zombie",{r:40}),
    makeEnemy(4,20,15,"bone_guard",{r:35}),makeEnemy(5,25,25,"restless_spirit",{r:30}),
    makeEnemy(6,12,35,"bone_guard",{r:30}),makeEnemy(7,14,38,"skeleton_archer",{r:25}),
    makeEnemy(8,38,12,"restless_spirit",{r:30}),
    makeEnemy(9,28,28,"bone_guard",{r:30}),makeEnemy(10,35,26,"grave_zombie",{r:35}),
    makeEnemy(11,22,32,"restless_spirit",{r:25}),
  ];
}

export function createDesertEnemies(){
  return [
    makeEnemy(0,12,20,"desert_scorpion",{r:50}),makeEnemy(1,18,45,"desert_scorpion",{r:45}),
    makeEnemy(2,30,15,"dune_stalker",{r:60}),makeEnemy(3,35,40,"dune_stalker",{r:55}),
    makeEnemy(4,45,25,"desert_scorpion",{r:50}),makeEnemy(5,50,35,"sand_wraith",{r:45}),
    makeEnemy(6,28,12,"sand_wraith",{r:40}),makeEnemy(7,30,48,"dune_stalker",{r:35}),
    makeEnemy(8,10,40,"desert_scorpion",{r:45}),
    makeEnemy(9,22,28,"desert_scorpion",{r:45}),makeEnemy(10,28,32,"sand_wraith",{r:40}),
    makeEnemy(11,25,30,"oasis_guardian",{r:20}),
  ];
}

// ═══════════════════════════════════════════════════════════════
// ICE BIOME ENEMIES
// ═══════════════════════════════════════════════════════════════
export function createIceEnemies(){
  return [
    // Entrance area
    makeEnemy(0,12,55,"frost_wolf",{r:50}),makeEnemy(1,18,52,"frost_wolf",{r:45}),
    makeEnemy(2,25,58,"snow_stalker",{r:40}),
    // Mid-field
    makeEnemy(3,35,45,"frost_wolf",{r:55}),makeEnemy(4,42,48,"frozen_knight",{r:35}),
    makeEnemy(5,15,40,"ice_wraith",{r:30}),makeEnemy(6,28,42,"snow_stalker",{r:45}),
    // Frozen lake area
    makeEnemy(7,30,25,"frost_wolf",{r:50}),makeEnemy(8,38,22,"frost_wolf",{r:45}),
    makeEnemy(9,25,20,"crystal_golem",{r:25}),
    // Boss approach
    makeEnemy(10,30,15,"frozen_knight",{r:40}),makeEnemy(11,22,12,"ice_wraith",{r:30}),
    makeEnemy(12,38,12,"frozen_knight",{r:35}),
    // Boss arena
    makeEnemy(13,25,8,"frozen_knight",{r:30}),makeEnemy(14,35,8,"frozen_knight",{r:30}),
    makeEnemy(15,30,5,"ice_titan",{r:15}),
  ];
}

// ═══════════════════════════════════════════════════════════════
// VOLCANIC BIOME ENEMIES
// ═══════════════════════════════════════════════════════════════
export function createVolcanicEnemies(){
  return [
    // Entrance area
    makeEnemy(0,30,6,"ash_crawler",{r:45}),makeEnemy(1,35,8,"ash_crawler",{r:40}),
    makeEnemy(2,25,10,"magma_hound",{r:50}),
    // Lava fields
    makeEnemy(3,15,18,"magma_hound",{r:55}),makeEnemy(4,40,20,"flame_imp",{r:35}),
    makeEnemy(5,22,22,"ember_wraith",{r:30}),makeEnemy(6,48,25,"ash_crawler",{r:45}),
    // Central area
    makeEnemy(7,30,28,"magma_hound",{r:50}),makeEnemy(8,38,32,"obsidian_golem",{r:25}),
    makeEnemy(9,20,35,"flame_imp",{r:40}),makeEnemy(10,45,35,"ember_wraith",{r:30}),
    // Boss approach
    makeEnemy(11,25,42,"magma_hound",{r:45}),makeEnemy(12,35,42,"obsidian_golem",{r:30}),
    makeEnemy(13,30,45,"flame_imp",{r:35}),
    // Boss arena
    makeEnemy(14,22,52,"obsidian_golem",{r:25}),makeEnemy(15,38,52,"obsidian_golem",{r:25}),
    makeEnemy(16,30,55,"infernal_lord",{r:15}),
  ];
}

// Generate loot from enemy
export function generateLoot(enemyType){
  const table=LOOT_TABLES[enemyType];
  if(!table)return[];
  const drops=[];
  table.forEach(entry=>{
    if(Math.random()<entry.chance){
      if(entry.item==="gold"){
        const amount=entry.min+Math.floor(Math.random()*(entry.max-entry.min+1));
        drops.push({type:"gold",amount});
      }else{
        const count=entry.count||1;
        drops.push({type:"item",id:entry.item,count});
      }
    }
  });
  return drops;
}
