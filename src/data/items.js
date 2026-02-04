// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — ITEMS & EQUIPMENT
// ═══════════════════════════════════════════════════════════════

export const ITEMS = {
  // ═══════════════════════════════════════════════════════════════
  // WEAPONS
  // ═══════════════════════════════════════════════════════════════
  ashen_blade: {
    id: "ashen_blade",
    name: "Ashen Blade",
    icon: "sword",
    type: "weapon",
    count: 1,
    stats: { dmg: 12, stam: 8, range: 85 },
    desc: "A blade blackened by fire.",
    slot: "weapon"
  },
  rusted_sword: {
    id: "rusted_sword",
    name: "Rusted Sword",
    icon: "sword_rusted",
    type: "weapon",
    count: 1,
    stats: { dmg: 8, stam: 6, range: 75 },
    desc: "A worn blade, still serviceable.",
    slot: "weapon"
  },
  silver_blade: {
    id: "silver_blade",
    name: "Silver Blade",
    icon: "sword_silver",
    type: "weapon",
    count: 1,
    stats: { dmg: 18, stam: 10, range: 90 },
    desc: "Blessed silver, effective against undead.",
    slot: "weapon"
  },
  hunters_bow: {
    id: "hunters_bow",
    name: "Hunter's Bow",
    icon: "bow",
    type: "weapon",
    count: 1,
    stats: { dmg: 10, stam: 12, range: 280, isRanged: true },
    desc: "A sturdy bow for ranged combat.",
    slot: "weapon"
  },
  frost_blade: {
    id: "frost_blade",
    name: "Frost Blade",
    icon: "sword_ice",
    type: "weapon",
    count: 1,
    stats: { dmg: 16, stam: 9, range: 85, effect: "freeze" },
    desc: "A blade of eternal ice.",
    slot: "weapon"
  },
  flame_sword: {
    id: "flame_sword",
    name: "Flame Sword",
    icon: "sword_fire",
    type: "weapon",
    count: 1,
    stats: { dmg: 20, stam: 11, range: 90, effect: "burn" },
    desc: "Burns with volcanic fury.",
    slot: "weapon"
  },

  // ═══════════════════════════════════════════════════════════════
  // CONSUMABLES
  // ═══════════════════════════════════════════════════════════════
  blood_philter: {
    id: "blood_philter",
    name: "Blood Philter",
    icon: "potion_red",
    type: "consumable",
    count: 1,
    stats: { heal: 30 },
    desc: "Restores 30 health."
  },
  verdant_tonic: {
    id: "verdant_tonic",
    name: "Verdant Tonic",
    icon: "potion_green",
    type: "consumable",
    count: 1,
    stats: { stam: 50 },
    desc: "Restores 50 stamina."
  },
  greater_philter: {
    id: "greater_philter",
    name: "Greater Philter",
    icon: "potion_red_large",
    type: "consumable",
    count: 1,
    stats: { heal: 60 },
    desc: "Restores 60 health."
  },
  antidote: {
    id: "antidote",
    name: "Antidote",
    icon: "potion_purple",
    type: "consumable",
    count: 1,
    stats: { curePoison: true },
    desc: "Cures poison and venom."
  },
  fire_ward: {
    id: "fire_ward",
    name: "Fire Ward",
    icon: "potion_orange",
    type: "consumable",
    count: 1,
    stats: { fireResist: 60 },
    desc: "Grants fire resistance for 60 seconds."
  },
  frost_ward: {
    id: "frost_ward",
    name: "Frost Ward",
    icon: "potion_blue",
    type: "consumable",
    count: 1,
    stats: { coldResist: 60 },
    desc: "Grants cold resistance for 60 seconds."
  },

  // ═══════════════════════════════════════════════════════════════
  // ARMOR
  // ═══════════════════════════════════════════════════════════════
  tattered_cloak: {
    id: "tattered_cloak",
    name: "Tattered Cloak",
    icon: "armor_cloth",
    type: "armor",
    count: 1,
    stats: { def: 2 },
    desc: "Worn cloth, minimal protection.",
    slot: "armor"
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    icon: "armor_leather",
    type: "armor",
    count: 1,
    stats: { def: 5 },
    desc: "Sturdy leather protection.",
    slot: "armor"
  },
  chain_mail: {
    id: "chain_mail",
    name: "Chain Mail",
    icon: "armor_chain",
    type: "armor",
    count: 1,
    stats: { def: 8 },
    desc: "Linked metal rings.",
    slot: "armor"
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    icon: "armor_plate",
    type: "armor",
    count: 1,
    stats: { def: 12, speedPenalty: 0.1 },
    desc: "Heavy but protective.",
    slot: "armor"
  },
  frost_cloak: {
    id: "frost_cloak",
    name: "Frost Cloak",
    icon: "armor_ice",
    type: "armor",
    count: 1,
    stats: { def: 6, coldResist: 50 },
    desc: "Woven from eternal frost.",
    slot: "armor"
  },
  volcanic_plate: {
    id: "volcanic_plate",
    name: "Volcanic Plate",
    icon: "armor_fire",
    type: "armor",
    count: 1,
    stats: { def: 10, fireResist: 50 },
    desc: "Forged in volcanic fire.",
    slot: "armor"
  },

  // ═══════════════════════════════════════════════════════════════
  // RELICS
  // ═══════════════════════════════════════════════════════════════
  ashen_relic: {
    id: "ashen_relic",
    name: "Ashen Relic",
    icon: "relic_dark",
    type: "relic",
    count: 1,
    stats: { dmgBonus: 0.1 },
    desc: "A relic from the ashes. +10% damage.",
    slot: "relic"
  },
  bloodstone_amulet: {
    id: "bloodstone_amulet",
    name: "Bloodstone Amulet",
    icon: "relic_red",
    type: "relic",
    count: 1,
    stats: { lifeSteal: 0.05 },
    desc: "Heal 5% of damage dealt.",
    slot: "relic"
  },
  stamina_charm: {
    id: "stamina_charm",
    name: "Stamina Charm",
    icon: "relic_green",
    type: "relic",
    count: 1,
    stats: { stamRegen: 0.5 },
    desc: "+50% stamina regeneration.",
    slot: "relic"
  },
  shadow_ring: {
    id: "shadow_ring",
    name: "Shadow Ring",
    icon: "relic_purple",
    type: "relic",
    count: 1,
    stats: { dodgeBonus: 0.1 },
    desc: "+10% dodge chance.",
    slot: "relic"
  },
  frost_heart: {
    id: "frost_heart",
    name: "Frost Heart",
    icon: "relic_ice",
    type: "relic",
    count: 1,
    stats: { coldResist: 75, slowOnHit: true },
    desc: "Heart of an ice titan. Slows attackers.",
    slot: "relic"
  },
  infernal_core: {
    id: "infernal_core",
    name: "Infernal Core",
    icon: "relic_fire",
    type: "relic",
    count: 1,
    stats: { fireResist: 75, burnOnHit: true },
    desc: "Core of the infernal lord. Burns attackers.",
    slot: "relic"
  },

  // ═══════════════════════════════════════════════════════════════
  // KEY ITEMS
  // ═══════════════════════════════════════════════════════════════
  crypt_key: {
    id: "crypt_key",
    name: "Crypt Key",
    icon: "key",
    type: "key",
    count: 1,
    stats: {},
    desc: "Opens the crypt entrance."
  },
  forest_key: {
    id: "forest_key",
    name: "Forest Key",
    icon: "key_green",
    type: "key",
    count: 1,
    stats: {},
    desc: "Opens the forest gate."
  },
};

// Shop inventory definitions
export const SHOP_INVENTORY = {
  town: [
    { itemId: "blood_philter", price: 25, stock: 10 },
    { itemId: "verdant_tonic", price: 20, stock: 10 },
    { itemId: "antidote", price: 30, stock: 5 },
    { itemId: "leather_armor", price: 80, stock: 2 },
    { itemId: "rusted_sword", price: 50, stock: 1 },
  ],
  desert: [
    { itemId: "fire_ward", price: 40, stock: 5 },
    { itemId: "greater_philter", price: 50, stock: 5 },
  ],
  ice: [
    { itemId: "frost_ward", price: 40, stock: 5 },
    { itemId: "frost_cloak", price: 150, stock: 1 },
  ],
};

// Loot tables for enemies
export const LOOT_TABLES = {
  common: [
    { type: "gold", min: 3, max: 8, chance: 0.6 },
    { type: "item", id: "blood_philter", count: 1, chance: 0.15 },
  ],
  uncommon: [
    { type: "gold", min: 8, max: 15, chance: 0.7 },
    { type: "item", id: "blood_philter", count: 1, chance: 0.2 },
    { type: "item", id: "verdant_tonic", count: 1, chance: 0.15 },
  ],
  rare: [
    { type: "gold", min: 15, max: 30, chance: 0.8 },
    { type: "item", id: "greater_philter", count: 1, chance: 0.2 },
  ],
  boss: [
    { type: "gold", min: 50, max: 100, chance: 1.0 },
    { type: "item", id: "greater_philter", count: 2, chance: 0.5 },
  ],
};

// Generate loot from enemy type
export const generateLoot = (enemyType) => {
  const drops = [];
  const table = LOOT_TABLES[enemyType] || LOOT_TABLES.common;
  
  table.forEach(entry => {
    if (Math.random() < entry.chance) {
      if (entry.type === "gold") {
        drops.push({
          type: "gold",
          amount: Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min
        });
      } else if (entry.type === "item") {
        drops.push({
          type: "item",
          id: entry.id,
          count: entry.count
        });
      }
    }
  });
  
  return drops;
};
