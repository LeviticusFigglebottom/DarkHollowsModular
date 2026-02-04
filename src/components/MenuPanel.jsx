// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — MENU PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { SKILL_TREE, canUnlockSkill } from '../data/skills.js';
import { ITEMS } from '../data/items.js';

const MENU_TABS = ['inventory', 'equipment', 'skills', 'quests'];

/**
 * MenuPanel Component - main game menu with tabs
 */
export function MenuPanel({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  // Inventory props
  hotbar,
  onHotbarChange,
  // Equipment props
  equipped,
  onEquipItem,
  onUnequipItem,
  // Skills props
  skills,
  skillPoints,
  onUnlockSkill,
  getSkillBonuses,
  // Quest props
  quests,
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Tab bar */}
        <div style={styles.tabBar}>
          {MENU_TABS.map((tab) => (
            <button
              key={tab}
              style={{
                ...styles.tabBtn,
                ...(activeTab === tab ? styles.tabBtnActive : {}),
              }}
              onClick={() => onTabChange(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tab content */}
        <div style={styles.content}>
          {activeTab === 'inventory' && (
            <InventoryTab hotbar={hotbar} onHotbarChange={onHotbarChange} />
          )}
          {activeTab === 'equipment' && (
            <EquipmentTab
              equipped={equipped}
              hotbar={hotbar}
              onEquipItem={onEquipItem}
              onUnequipItem={onUnequipItem}
            />
          )}
          {activeTab === 'skills' && (
            <SkillsTab
              skills={skills}
              skillPoints={skillPoints}
              onUnlockSkill={onUnlockSkill}
              getSkillBonuses={getSkillBonuses}
            />
          )}
          {activeTab === 'quests' && (
            <QuestsTab quests={quests} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inventory Tab
 */
function InventoryTab({ hotbar, onHotbarChange }) {
  const [dragItem, setDragItem] = useState(null);
  const [dragFromSlot, setDragFromSlot] = useState(null);

  const handleDragStart = (idx, item) => {
    setDragItem(item);
    setDragFromSlot(idx);
  };

  const handleDrop = (toIdx) => {
    if (dragFromSlot === null || dragFromSlot === toIdx) return;
    
    const newHotbar = [...hotbar];
    const temp = newHotbar[toIdx];
    newHotbar[toIdx] = newHotbar[dragFromSlot];
    newHotbar[dragFromSlot] = temp;
    
    onHotbarChange(newHotbar);
    setDragItem(null);
    setDragFromSlot(null);
  };

  return (
    <div style={styles.inventoryGrid}>
      <h3 style={styles.sectionTitle}>Inventory</h3>
      <div style={styles.slotGrid}>
        {hotbar.map((item, idx) => (
          <div
            key={idx}
            style={{
              ...styles.invSlot,
              ...(dragFromSlot === idx ? styles.slotDragging : {}),
            }}
            draggable={!!item}
            onDragStart={() => handleDragStart(idx, item)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
          >
            {item && (
              <>
                <span style={styles.itemEmoji}>{getItemEmoji(item)}</span>
                <span style={styles.itemName}>{item.name}</span>
                {item.count > 1 && (
                  <span style={styles.itemCount}>x{item.count}</span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <p style={styles.hint}>Drag items to rearrange • Press 1-5 to use items</p>
    </div>
  );
}

/**
 * Equipment Tab
 */
function EquipmentTab({ equipped, hotbar, onEquipItem, onUnequipItem }) {
  const equipSlots = ['weapon', 'armor', 'relic'];
  
  // Find equippable items in hotbar
  const equippableItems = useMemo(() => {
    return hotbar.filter(item => item && ['weapon', 'armor', 'relic'].includes(item.type));
  }, [hotbar]);

  return (
    <div style={styles.equipmentContainer}>
      <h3 style={styles.sectionTitle}>Equipment</h3>
      
      <div style={styles.equipSlots}>
        {equipSlots.map((slot) => (
          <div key={slot} style={styles.equipSlotContainer}>
            <span style={styles.slotLabel}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</span>
            <div
              style={{
                ...styles.equipSlot,
                ...(equipped[slot] ? styles.equipSlotFilled : {}),
              }}
              onClick={() => equipped[slot] && onUnequipItem(slot)}
            >
              {equipped[slot] ? (
                <>
                  <span style={styles.itemEmoji}>{getItemEmoji(equipped[slot])}</span>
                  <span style={styles.equipName}>{equipped[slot].name}</span>
                  {equipped[slot].stats && (
                    <span style={styles.equipStats}>
                      {Object.entries(equipped[slot].stats)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' ')}
                    </span>
                  )}
                </>
              ) : (
                <span style={styles.emptySlot}>Empty</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Available items to equip */}
      <h4 style={styles.subTitle}>Available Equipment</h4>
      <div style={styles.availableItems}>
        {equippableItems.length > 0 ? (
          equippableItems.map((item, idx) => (
            <div
              key={idx}
              style={styles.availItem}
              onClick={() => onEquipItem(item)}
            >
              <span style={styles.itemEmoji}>{getItemEmoji(item)}</span>
              <span>{item.name}</span>
            </div>
          ))
        ) : (
          <p style={styles.hint}>No equipment in inventory</p>
        )}
      </div>
    </div>
  );
}

/**
 * Skills Tab
 */
function SkillsTab({ skills, skillPoints, onUnlockSkill, getSkillBonuses }) {
  const sb = getSkillBonuses();

  return (
    <div style={styles.skillsContainer}>
      <div style={styles.skillHeader}>
        <h3 style={styles.sectionTitle}>Skills</h3>
        <span style={styles.skillPoints}>Skill Points: {skillPoints}</span>
      </div>

      {/* Skill bonuses summary */}
      <div style={styles.bonusSummary}>
        {sb.dmgMult > 0 && <span>+{Math.round(sb.dmgMult * 100)}% Damage</span>}
        {sb.critChance > 0 && <span>+{Math.round(sb.critChance * 100)}% Crit</span>}
        {sb.speedMult > 0 && <span>+{Math.round(sb.speedMult * 100)}% Speed</span>}
        {sb.maxHpBonus > 0 && <span>+{sb.maxHpBonus} Max HP</span>}
      </div>

      {/* Skill trees */}
      <div style={styles.skillTrees}>
        {Object.entries(SKILL_TREE).map(([pathId, path]) => (
          <div key={pathId} style={styles.skillPath}>
            <h4 style={styles.pathTitle}>{path.name}</h4>
            <div style={styles.skillList}>
              {path.skills.map((skill) => {
                const unlocked = skills[skill.id];
                const canUnlock = canUnlockSkill(skill, skills, skillPoints);
                
                return (
                  <div
                    key={skill.id}
                    style={{
                      ...styles.skillNode,
                      ...(unlocked ? styles.skillUnlocked : {}),
                      ...(canUnlock && !unlocked ? styles.skillAvailable : {}),
                      ...(!canUnlock && !unlocked ? styles.skillLocked : {}),
                    }}
                    onClick={() => canUnlock && onUnlockSkill(skill)}
                    title={skill.desc}
                  >
                    <span style={styles.skillName}>{skill.name}</span>
                    <span style={styles.skillCost}>
                      {unlocked ? '✓' : `${skill.cost} pts`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Quests Tab
 */
function QuestsTab({ quests }) {
  const activeQuests = Object.values(quests || {}).filter(q => q.status === 'active');
  const completedQuests = Object.values(quests || {}).filter(q => q.status === 'complete');

  return (
    <div style={styles.questsContainer}>
      <h3 style={styles.sectionTitle}>Quests</h3>

      <div style={styles.questSection}>
        <h4 style={styles.subTitle}>Active ({activeQuests.length})</h4>
        {activeQuests.length > 0 ? (
          activeQuests.map((quest) => (
            <div key={quest.id} style={styles.questItem}>
              <span style={styles.questName}>{quest.name}</span>
              <span style={styles.questDesc}>{quest.desc}</span>
              {quest.progress && (
                <span style={styles.questProgress}>
                  Progress: {quest.progress}/{quest.goal}
                </span>
              )}
            </div>
          ))
        ) : (
          <p style={styles.hint}>No active quests</p>
        )}
      </div>

      <div style={styles.questSection}>
        <h4 style={styles.subTitle}>Completed ({completedQuests.length})</h4>
        {completedQuests.length > 0 ? (
          completedQuests.map((quest) => (
            <div key={quest.id} style={{ ...styles.questItem, opacity: 0.6 }}>
              <span style={styles.questName}>✓ {quest.name}</span>
            </div>
          ))
        ) : (
          <p style={styles.hint}>No completed quests</p>
        )}
      </div>
    </div>
  );
}

/**
 * Get emoji for item based on type/icon
 */
function getItemEmoji(item) {
  const iconMap = {
    sword: '⚔️',
    bow: '🏹',
    axe: '🪓',
    spear: '🗡️',
    dagger: '🔪',
    potion: '🧪',
    armor: '🛡️',
    relic: '💎',
    key: '🔑',
    arrows: '➵',
    consumable: '🧪',
    weapon: '⚔️',
  };
  return iconMap[item.icon] || iconMap[item.type] || '❓';
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    width: 600,
    maxHeight: '80vh',
    background: 'rgba(8,6,14,0.97)',
    border: '1px solid #1a1528',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #1a1528',
    padding: '0 8px',
  },
  tabBtn: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#8b8890',
    fontSize: 13,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    color: '#e0d8f0',
    borderBottomColor: '#8b5cf6',
    background: 'rgba(139,92,246,0.1)',
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#8b8890',
    fontSize: 16,
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 20,
  },
  sectionTitle: {
    color: '#e0d8f0',
    fontSize: 16,
    fontFamily: 'monospace',
    marginBottom: 16,
    borderBottom: '1px solid rgba(139,92,246,0.3)',
    paddingBottom: 8,
  },
  subTitle: {
    color: '#a0a0b0',
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 16,
    marginBottom: 8,
  },
  hint: {
    color: '#606070',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 12,
  },
  
  // Inventory styles
  inventoryGrid: {},
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
  },
  invSlot: {
    height: 70,
    background: 'rgba(30,25,45,0.6)',
    border: '1px solid rgba(80,70,100,0.4)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    transition: 'all 0.15s ease',
    padding: 4,
  },
  slotDragging: {
    opacity: 0.5,
    border: '1px dashed #8b5cf6',
  },
  itemEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 9,
    color: '#c0b8d0',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  itemCount: {
    fontSize: 9,
    color: '#ffd700',
    fontWeight: 'bold',
  },

  // Equipment styles
  equipmentContainer: {},
  equipSlots: {
    display: 'flex',
    gap: 16,
    marginBottom: 20,
  },
  equipSlotContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  slotLabel: {
    fontSize: 11,
    color: '#808090',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  equipSlot: {
    height: 80,
    background: 'rgba(30,25,45,0.6)',
    border: '1px solid rgba(80,70,100,0.4)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 8,
  },
  equipSlotFilled: {
    borderColor: '#8b5cf6',
    background: 'rgba(139,92,246,0.1)',
  },
  equipName: {
    fontSize: 11,
    color: '#e0d8f0',
    fontWeight: 'bold',
  },
  equipStats: {
    fontSize: 9,
    color: '#80ffa0',
    marginTop: 2,
  },
  emptySlot: {
    color: '#505060',
    fontSize: 11,
  },
  availableItems: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  availItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: 'rgba(30,25,45,0.6)',
    border: '1px solid rgba(80,70,100,0.4)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    color: '#c0b8d0',
    transition: 'all 0.15s ease',
  },

  // Skills styles
  skillsContainer: {},
  skillHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  skillPoints: {
    background: 'rgba(139,92,246,0.2)',
    padding: '6px 12px',
    borderRadius: 4,
    color: '#a080ff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  bonusSummary: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
    fontSize: 11,
    color: '#80ffa0',
  },
  skillTrees: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  skillPath: {
    background: 'rgba(20,18,30,0.6)',
    borderRadius: 6,
    padding: 12,
    border: '1px solid rgba(80,70,100,0.3)',
  },
  pathTitle: {
    fontSize: 12,
    color: '#a080ff',
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  skillList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  skillNode: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  skillUnlocked: {
    background: 'rgba(80,255,80,0.15)',
    border: '1px solid rgba(80,255,80,0.3)',
    color: '#80ffa0',
  },
  skillAvailable: {
    background: 'rgba(139,92,246,0.15)',
    border: '1px solid rgba(139,92,246,0.4)',
    color: '#c0b8f0',
  },
  skillLocked: {
    background: 'rgba(40,35,55,0.4)',
    border: '1px solid rgba(60,55,75,0.4)',
    color: '#606070',
    cursor: 'not-allowed',
  },
  skillName: {
    fontWeight: 'bold',
  },
  skillCost: {
    opacity: 0.7,
  },

  // Quests styles
  questsContainer: {},
  questSection: {
    marginBottom: 20,
  },
  questItem: {
    background: 'rgba(30,25,45,0.6)',
    border: '1px solid rgba(80,70,100,0.4)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  questName: {
    display: 'block',
    color: '#e0d8f0',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  questDesc: {
    display: 'block',
    color: '#a0a0b0',
    fontSize: 11,
    marginBottom: 6,
  },
  questProgress: {
    display: 'block',
    color: '#80c0ff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
};

export default MenuPanel;
