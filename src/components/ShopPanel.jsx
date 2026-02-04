// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — SHOP PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════

import React from 'react';

/**
 * ShopPanel Component - displays merchant shop interface
 */
export function ShopPanel({
  isOpen,
  shopName,
  shopInventory,
  playerGold,
  onBuy,
  onClose,
}) {
  if (!isOpen || !shopInventory) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{shopName || 'Shop'}</h2>
          <div style={styles.goldDisplay}>
            <span style={styles.goldIcon}>💰</span>
            <span style={styles.goldAmount}>{playerGold}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Shop items */}
        <div style={styles.itemList}>
          {shopInventory.map((shopItem, idx) => {
            const canAfford = playerGold >= shopItem.price;
            const inStock = shopItem.stock > 0;
            const canBuy = canAfford && inStock;

            return (
              <div
                key={idx}
                style={{
                  ...styles.shopItem,
                  ...(canBuy ? {} : styles.shopItemDisabled),
                }}
              >
                <div style={styles.itemInfo}>
                  <span style={styles.itemEmoji}>{getItemEmoji(shopItem)}</span>
                  <div style={styles.itemDetails}>
                    <span style={styles.itemName}>{shopItem.name}</span>
                    <span style={styles.itemDesc}>{shopItem.desc || getItemDescription(shopItem)}</span>
                  </div>
                </div>
                
                <div style={styles.itemRight}>
                  <div style={styles.priceTag}>
                    <span style={styles.goldIcon}>💰</span>
                    <span style={{
                      ...styles.price,
                      color: canAfford ? '#ffd700' : '#c04040',
                    }}>
                      {shopItem.price}
                    </span>
                  </div>
                  
                  <span style={styles.stock}>
                    {inStock ? `${shopItem.stock} left` : 'Sold out'}
                  </span>
                  
                  <button
                    style={{
                      ...styles.buyBtn,
                      ...(canBuy ? {} : styles.buyBtnDisabled),
                    }}
                    onClick={() => canBuy && onBuy(shopItem)}
                    disabled={!canBuy}
                  >
                    {inStock ? (canAfford ? 'Buy' : 'Need Gold') : 'Sold Out'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={styles.footer}>
          <p style={styles.footerText}>Press [E] or click outside to close</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Get emoji for shop item
 */
function getItemEmoji(item) {
  const iconMap = {
    sword: '⚔️',
    bow: '🏹',
    axe: '🪓',
    spear: '🗡️',
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

/**
 * Get description for item based on stats
 */
function getItemDescription(item) {
  if (!item.stats) return 'A mysterious item';
  
  const parts = [];
  if (item.stats.dmg) parts.push(`+${item.stats.dmg} Damage`);
  if (item.stats.def) parts.push(`+${item.stats.def} Defense`);
  if (item.stats.heal) parts.push(`Heals ${item.stats.heal} HP`);
  if (item.stats.stamina) parts.push(`+${item.stats.stamina} Stamina`);
  
  return parts.length > 0 ? parts.join(', ') : 'A useful item';
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
    width: 450,
    maxHeight: '80vh',
    background: 'rgba(12,10,20,0.97)',
    border: '1px solid rgba(196,164,62,0.3)',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 16px',
    borderBottom: '1px solid rgba(196,164,62,0.2)',
    background: 'rgba(196,164,62,0.05)',
  },
  title: {
    flex: 1,
    color: '#e8d8a8',
    fontSize: 18,
    fontFamily: 'Georgia, serif',
    margin: 0,
  },
  goldDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
  },
  goldIcon: {
    fontSize: 14,
  },
  goldAmount: {
    color: '#ffd700',
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  closeBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    color: '#808060',
    fontSize: 16,
    cursor: 'pointer',
    borderRadius: 4,
  },
  itemList: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  shopItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    background: 'rgba(30,25,40,0.6)',
    border: '1px solid rgba(100,90,120,0.3)',
    borderRadius: 6,
    transition: 'all 0.15s ease',
  },
  shopItemDisabled: {
    opacity: 0.5,
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemEmoji: {
    fontSize: 28,
  },
  itemDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  itemName: {
    color: '#e0d8c0',
    fontSize: 13,
    fontWeight: 'bold',
  },
  itemDesc: {
    color: '#908870',
    fontSize: 10,
  },
  itemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  priceTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  stock: {
    color: '#706850',
    fontSize: 9,
  },
  buyBtn: {
    padding: '6px 14px',
    background: 'rgba(196,164,62,0.2)',
    border: '1px solid rgba(196,164,62,0.4)',
    borderRadius: 4,
    color: '#e8d8a8',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  buyBtnDisabled: {
    background: 'rgba(80,70,60,0.2)',
    borderColor: 'rgba(80,70,60,0.3)',
    color: '#605040',
    cursor: 'not-allowed',
  },
  footer: {
    padding: '8px 16px',
    borderTop: '1px solid rgba(196,164,62,0.1)',
    background: 'rgba(0,0,0,0.2)',
  },
  footerText: {
    color: '#605040',
    fontSize: 10,
    textAlign: 'center',
    margin: 0,
  },
};

export default ShopPanel;
