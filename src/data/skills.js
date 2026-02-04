// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — SKILL TREE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const SKILL_TREE = {
  combat: {
    name: "Combat",
    color: "#c04040",
    icon: "⚔",
    skills: [
      {
        id: "power_strike",
        name: "Power Strike",
        desc: "+15% melee damage",
        cost: 1,
        effect: { dmgMult: 0.15 },
        requires: null,
      },
      {
        id: "heavy_blows",
        name: "Heavy Blows",
        desc: "+20% knockback",
        cost: 1,
        effect: { kbMult: 0.20 },
        requires: "power_strike",
      },
      {
        id: "bloodthirst",
        name: "Bloodthirst",
        desc: "Heal 3 HP on kill",
        cost: 2,
        effect: { killHeal: 3 },
        requires: "heavy_blows",
      },
      {
        id: "critical_eye",
        name: "Critical Eye",
        desc: "10% crit chance, +50% crit dmg",
        cost: 2,
        effect: { critChance: 0.10, critMult: 0.50 },
        requires: "bloodthirst",
      },
      {
        id: "berserker",
        name: "Berserker Rage",
        desc: "[R] 2x damage for 8s (90s CD)",
        cost: 3,
        effect: { ultimate: "berserker" },
        requires: "critical_eye",
      },
    ],
  },
  
  agility: {
    name: "Agility",
    color: "#40a040",
    icon: "◇",
    skills: [
      {
        id: "swift_feet",
        name: "Swift Feet",
        desc: "+10% movement speed",
        cost: 1,
        effect: { speedMult: 0.10 },
        requires: null,
      },
      {
        id: "evasion",
        name: "Evasion",
        desc: "10% chance to dodge attacks",
        cost: 1,
        effect: { dodgeChance: 0.10 },
        requires: "swift_feet",
      },
      {
        id: "second_wind",
        name: "Second Wind",
        desc: "+30% stamina regen",
        cost: 2,
        effect: { stamRegenMult: 0.30 },
        requires: "evasion",
      },
      {
        id: "nimble",
        name: "Nimble",
        desc: "+15% dodge, +10% speed",
        cost: 2,
        effect: { dodgeChance: 0.15, speedMult: 0.10 },
        requires: "second_wind",
      },
      {
        id: "shadow_step",
        name: "Shadow Step",
        desc: "[R] Invuln dash + 5s 50% speed (60s CD)",
        cost: 3,
        effect: { ultimate: "shadow" },
        requires: "nimble",
      },
    ],
  },
  
  fortitude: {
    name: "Fortitude",
    color: "#4080c0",
    icon: "◆",
    skills: [
      {
        id: "toughness",
        name: "Toughness",
        desc: "10% damage reduction",
        cost: 1,
        effect: { dmgReduce: 0.10 },
        requires: null,
      },
      {
        id: "vitality",
        name: "Vitality",
        desc: "+20 max HP",
        cost: 1,
        effect: { maxHpBonus: 20 },
        requires: "toughness",
      },
      {
        id: "regeneration",
        name: "Regeneration",
        desc: "+50% HP regen rate",
        cost: 2,
        effect: { hpRegenMult: 0.50 },
        requires: "vitality",
      },
      {
        id: "resilience",
        name: "Resilience",
        desc: "25% knockback resist",
        cost: 2,
        effect: { kbResist: 0.25 },
        requires: "regeneration",
      },
      {
        id: "iron_will",
        name: "Iron Will",
        desc: "[R] 80% dmg reduce for 6s (90s CD)",
        cost: 3,
        effect: { ultimate: "ironwill" },
        requires: "resilience",
      },
    ],
  },
};

// Calculate total skill bonuses from unlocked skills
export const calculateSkillBonuses = (unlockedSkills) => {
  const bonuses = {
    dmgMult: 0,
    kbMult: 0,
    killHeal: 0,
    critChance: 0,
    critMult: 0,
    speedMult: 0,
    dodgeChance: 0,
    stamRegenMult: 0,
    dmgReduce: 0,
    hpRegenMult: 0,
    kbResist: 0,
    maxHpBonus: 0,
    hasUlt: {},
  };
  
  Object.values(SKILL_TREE).forEach(path => {
    path.skills.forEach(skill => {
      if (unlockedSkills[skill.id]) {
        Object.entries(skill.effect).forEach(([key, value]) => {
          if (key === "ultimate") {
            bonuses.hasUlt[value] = true;
          } else if (typeof value === "number") {
            bonuses[key] = (bonuses[key] || 0) + value;
          }
        });
      }
    });
  });
  
  return bonuses;
};

// Check if a skill can be unlocked
export const canUnlockSkill = (skill, unlockedSkills, availablePoints) => {
  // Already unlocked
  if (unlockedSkills[skill.id]) return false;
  
  // Missing prerequisite
  if (skill.requires && !unlockedSkills[skill.requires]) return false;
  
  // Not enough points
  if (availablePoints < skill.cost) return false;
  
  return true;
};

// Get all skills as a flat array
export const getAllSkills = () => {
  const skills = [];
  Object.values(SKILL_TREE).forEach(path => {
    skills.push(...path.skills);
  });
  return skills;
};

// Get skill by ID
export const getSkillById = (skillId) => {
  for (const path of Object.values(SKILL_TREE)) {
    const skill = path.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
};

// Ultimate ability configurations
export const ULTIMATE_CONFIG = {
  berserker: {
    name: "Berserker Rage",
    duration: 480, // 8 seconds at 60fps
    cooldown: 5400, // 90 seconds
    effect: "2x damage",
    color: "#ff4040",
  },
  shadow: {
    name: "Shadow Step",
    duration: 300, // 5 seconds
    cooldown: 3600, // 60 seconds
    effect: "Invuln + 50% speed",
    color: "#b388ff",
  },
  ironwill: {
    name: "Iron Will",
    duration: 360, // 6 seconds
    cooldown: 5400, // 90 seconds
    effect: "80% damage reduction",
    color: "#40c080",
  },
};
