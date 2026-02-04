// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — DEATH SCREEN COMPONENT
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';

/**
 * DeathScreen Component - shown when player dies
 */
export function DeathScreen({
  isOpen,
  zoneName,
  level,
  gold,
  onRespawn,
  onMainMenu,
}) {
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setFadeIn(true), 100);
      return () => clearTimeout(timer);
    } else {
      setFadeIn(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{ ...styles.overlay, opacity: fadeIn ? 1 : 0 }}>
      <div style={styles.content}>
        {/* Skull icon */}
        <div style={styles.icon}>💀</div>

        {/* Death message */}
        <h1 style={styles.title}>YOU DIED</h1>
        <p style={styles.subtitle}>
          Fallen in {zoneName || 'the darkness'}
        </p>

        {/* Stats */}
        <div style={styles.stats}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Level</span>
            <span style={styles.statValue}>{level}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Gold Lost</span>
            <span style={styles.statValueLost}>-{Math.floor(gold * 0.1)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.respawnBtn} onClick={onRespawn}>
            Rise Again
            <span style={styles.keyHint}>[R]</span>
          </button>
          <button style={styles.menuBtn} onClick={onMainMenu}>
            Main Menu
          </button>
        </div>

        {/* Flavor text */}
        <p style={styles.flavorText}>
          "Death is but a door. Time is but a window. I'll be back."
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(8,4,4,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    transition: 'opacity 0.8s ease-in',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 400,
    padding: 40,
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
    animation: 'pulse 2s infinite',
  },
  title: {
    color: '#c02020',
    fontSize: 48,
    fontFamily: 'Georgia, serif',
    fontWeight: 'normal',
    letterSpacing: 8,
    margin: 0,
    marginBottom: 8,
    textShadow: '0 0 20px rgba(192,32,32,0.5)',
  },
  subtitle: {
    color: '#806060',
    fontSize: 16,
    fontStyle: 'italic',
    margin: 0,
    marginBottom: 30,
  },
  stats: {
    display: 'flex',
    gap: 40,
    marginBottom: 30,
    padding: '16px 30px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    border: '1px solid rgba(192,32,32,0.2)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    color: '#605050',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    color: '#a08080',
    fontSize: 24,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  statValueLost: {
    color: '#c04040',
    fontSize: 24,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginBottom: 30,
  },
  respawnBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #802020 0%, #a02020 100%)',
    border: '1px solid #c04040',
    borderRadius: 6,
    color: '#ffd0d0',
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
  },
  keyHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  menuBtn: {
    padding: '10px 24px',
    background: 'transparent',
    border: '1px solid rgba(128,96,96,0.4)',
    borderRadius: 6,
    color: '#806060',
    fontSize: 13,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  flavorText: {
    color: '#504040',
    fontSize: 12,
    fontStyle: 'italic',
    maxWidth: 300,
    lineHeight: 1.6,
  },
};

// Add CSS keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);
}

export default DeathScreen;
