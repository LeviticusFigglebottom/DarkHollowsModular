// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — HUD COMPONENT
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { XP_THRESHOLDS } from '../constants/config.js';

const STATUS_COLORS = {
  poison: '#60c060',
  venom: '#80ff40',
  burn: '#ff8040',
  freeze: '#80c0ff',
  bleed: '#c03030',
};

const STATUS_NAMES = {
  poison: 'Poisoned',
  venom: 'Envenomed',
  burn: 'Burning',
  freeze: 'Frozen',
  bleed: 'Bleeding',
};

/**
 * HUD Component - displays health, stamina, XP, level, gold, and status effects
 */
export function HUD({
  health,
  maxHealth,
  stamina,
  maxStamina,
  xp,
  level,
  gold,
  statusEffects,
  skillBonuses,
  equipped,
  notifications,
}) {
  // Calculate XP progress
  const xpProgress = useMemo(() => {
    const xpForLevel = XP_THRESHOLDS[level] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1] + 300;
    const xpForPrev = XP_THRESHOLDS[level - 1] || 0;
    return xpForLevel > xpForPrev ? ((xp - xpForPrev) / (xpForLevel - xpForPrev)) * 100 : 100;
  }, [xp, level]);

  // Calculate effective max HP
  const effectiveMaxHp = maxHealth + (skillBonuses?.maxHpBonus || 0);
  const healthPercent = Math.min(100, (health / effectiveMaxHp) * 100);
  const staminaPercent = Math.min(100, (stamina / maxStamina) * 100);

  // Calculate total stats
  const totalDmg = (equipped?.weapon?.stats?.dmg || 0) + (equipped?.relic?.stats?.dmg || 0);
  const totalDef = (equipped?.armor?.stats?.def || 0) + (equipped?.relic?.stats?.def || 0);

  return (
    <div style={styles.container}>
      {/* Health Bar */}
      <div style={styles.barContainer}>
        <div style={styles.barLabel}>
          <span style={styles.labelIcon}>❤</span>
          <span>{Math.floor(health)} / {effectiveMaxHp}</span>
        </div>
        <div style={styles.barOuter}>
          <div style={{ ...styles.barInner, ...styles.healthBar, width: `${healthPercent}%` }} />
        </div>
      </div>

      {/* Stamina Bar */}
      <div style={styles.barContainer}>
        <div style={styles.barLabel}>
          <span style={styles.labelIcon}>⚡</span>
          <span>{Math.floor(stamina)} / {maxStamina}</span>
        </div>
        <div style={styles.barOuter}>
          <div style={{ ...styles.barInner, ...styles.staminaBar, width: `${staminaPercent}%` }} />
        </div>
      </div>

      {/* XP Bar */}
      <div style={styles.barContainer}>
        <div style={styles.barLabel}>
          <span style={styles.labelIcon}>✦</span>
          <span>Level {level}</span>
        </div>
        <div style={styles.barOuter}>
          <div style={{ ...styles.barInner, ...styles.xpBar, width: `${xpProgress}%` }} />
        </div>
      </div>

      {/* Gold */}
      <div style={styles.goldContainer}>
        <span style={styles.goldIcon}>💰</span>
        <span style={styles.goldAmount}>{gold}</span>
      </div>

      {/* Stats Summary */}
      <div style={styles.statsContainer}>
        <span style={styles.stat}>
          <span style={styles.statIcon}>⚔</span> {totalDmg}
        </span>
        <span style={styles.stat}>
          <span style={styles.statIcon}>🛡</span> {totalDef}
        </span>
      </div>

      {/* Status Effects */}
      {statusEffects && statusEffects.length > 0 && (
        <div style={styles.statusContainer}>
          {statusEffects.map((effect, idx) => (
            <div
              key={`${effect.type}-${idx}`}
              style={{
                ...styles.statusEffect,
                borderColor: STATUS_COLORS[effect.type] || '#888',
                color: STATUS_COLORS[effect.type] || '#888',
              }}
            >
              <span style={styles.statusName}>{STATUS_NAMES[effect.type] || effect.type}</span>
              <span style={styles.statusTimer}>{Math.ceil(effect.duration / 60)}s</span>
            </div>
          ))}
        </div>
      )}

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <div style={styles.notifContainer}>
          {notifications.map((notif, idx) => (
            <div
              key={notif.id || idx}
              style={{
                ...styles.notification,
                opacity: notif.fade || 1,
                transform: `translateY(${idx * 30}px)`,
              }}
            >
              {notif.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    pointerEvents: 'none',
    zIndex: 100,
  },
  barContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  barLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: '#e0d8c8',
    fontFamily: 'monospace',
    textShadow: '1px 1px 2px #000',
  },
  labelIcon: {
    fontSize: 12,
  },
  barOuter: {
    width: 160,
    height: 12,
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    transition: 'width 0.15s ease-out',
    borderRadius: 2,
  },
  healthBar: {
    background: 'linear-gradient(to bottom, #e04040 0%, #a02020 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  staminaBar: {
    background: 'linear-gradient(to bottom, #40a0e0 0%, #2060a0 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  xpBar: {
    background: 'linear-gradient(to bottom, #a080ff 0%, #6040c0 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  goldContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  goldIcon: {
    fontSize: 14,
  },
  goldAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffd700',
    fontFamily: 'monospace',
    textShadow: '1px 1px 2px #000',
  },
  statsContainer: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
    fontSize: 11,
    color: '#c0b8a8',
    fontFamily: 'monospace',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 12,
  },
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 8,
  },
  statusEffect: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid',
    borderRadius: 4,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  statusName: {
    fontWeight: 'bold',
  },
  statusTimer: {
    opacity: 0.8,
  },
  notifContainer: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none',
  },
  notification: {
    padding: '8px 20px',
    background: 'rgba(0,0,0,0.8)',
    border: '1px solid rgba(139,92,246,0.5)',
    borderRadius: 6,
    color: '#e0d8c8',
    fontSize: 14,
    fontFamily: 'monospace',
    textAlign: 'center',
    transition: 'opacity 0.3s ease-out',
  },
};

export default HUD;
