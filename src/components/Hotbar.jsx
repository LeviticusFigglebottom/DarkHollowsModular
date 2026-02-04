// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — HOTBAR COMPONENT
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { drawItemIcon } from '../rendering/drawEntities.js';

const SLOT_KEYS = ['1', '2', '3', '4', '5'];

/**
 * Hotbar Component - displays quick item slots
 */
export function Hotbar({
  hotbar,
  selectedSlot,
  onSlotClick,
  onSlotDrop,
}) {
  return (
    <div style={styles.container}>
      {hotbar.map((item, idx) => (
        <div
          key={idx}
          style={{
            ...styles.slot,
            ...(selectedSlot === idx ? styles.slotSelected : {}),
          }}
          onClick={() => onSlotClick?.(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('text/plain');
            if (data && onSlotDrop) onSlotDrop(idx, JSON.parse(data));
          }}
        >
          {/* Slot key indicator */}
          <span style={styles.keyHint}>{SLOT_KEYS[idx]}</span>
          
          {/* Item content */}
          {item && (
            <>
              <ItemIconDisplay icon={item.icon} type={item.type} />
              {item.count > 1 && (
                <span style={styles.count}>{item.count}</span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Simple icon display using emoji fallbacks
 */
function ItemIconDisplay({ icon, type }) {
  const iconMap = {
    sword: '⚔️',
    bow: '🏹',
    axe: '🪓',
    spear: '🗡️',
    dagger: '🗡️',
    potion: '🧪',
    armor: '🛡️',
    relic: '💎',
    key: '🔑',
    arrows: '➵',
    scroll: '📜',
  };

  const emoji = iconMap[icon] || iconMap[type] || '❓';

  return (
    <span style={styles.itemIcon}>{emoji}</span>
  );
}

const styles = {
  container: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 4,
    padding: 6,
    background: 'rgba(8,6,14,0.9)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8,
    zIndex: 100,
  },
  slot: {
    position: 'relative',
    width: 48,
    height: 48,
    background: 'rgba(30,25,45,0.8)',
    border: '2px solid rgba(80,70,100,0.6)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  slotSelected: {
    borderColor: '#8b5cf6',
    boxShadow: '0 0 10px rgba(139,92,246,0.4)',
    background: 'rgba(139,92,246,0.15)',
  },
  keyHint: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  itemIcon: {
    fontSize: 24,
  },
  count: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 10,
    color: '#ffd700',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px #000',
  },
};

export default Hotbar;
