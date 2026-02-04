// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — START MENU COMPONENT
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { GRAPHICS_PRESETS, setGraphicsPreset, getGFX } from '../constants/config.js';

/**
 * StartMenu Component - initial game menu with graphics settings
 */
export function StartMenu({
  isOpen,
  hasSaveData,
  onNewGame,
  onContinue,
  onLoadGame,
}) {
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [showSettings, setShowSettings] = useState(false);

  const handleStartGame = (isNewGame = true) => {
    setGraphicsPreset(selectedPreset);
    if (isNewGame) {
      onNewGame?.();
    } else {
      onContinue?.();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Title */}
        <div style={styles.titleSection}>
          <h1 style={styles.title}>DARK HOLLOWS</h1>
          <p style={styles.subtitle}>Prologue: The Ashen City</p>
        </div>

        {/* Main buttons */}
        <div style={styles.menuButtons}>
          {hasSaveData && (
            <button style={styles.primaryBtn} onClick={() => handleStartGame(false)}>
              Continue
            </button>
          )}
          <button 
            style={hasSaveData ? styles.secondaryBtn : styles.primaryBtn} 
            onClick={() => handleStartGame(true)}
          >
            New Game
          </button>
          <button style={styles.settingsBtn} onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? 'Hide Settings' : 'Graphics Settings'}
          </button>
        </div>

        {/* Graphics settings panel */}
        {showSettings && (
          <div style={styles.settingsPanel}>
            <h3 style={styles.settingsTitle}>Graphics Quality</h3>
            <div style={styles.presetGrid}>
              {Object.entries(GRAPHICS_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  style={{
                    ...styles.presetBtn,
                    ...(selectedPreset === key ? styles.presetBtnActive : {}),
                  }}
                  onClick={() => setSelectedPreset(key)}
                >
                  <span style={styles.presetName}>{preset.name}</span>
                  <span style={styles.presetDesc}>{preset.desc}</span>
                </button>
              ))}
            </div>
            
            {/* Current preset details */}
            <div style={styles.presetDetails}>
              <h4 style={styles.detailsTitle}>Settings Preview</h4>
              <div style={styles.detailsGrid}>
                <DetailRow label="Lighting" value={GRAPHICS_PRESETS[selectedPreset].lighting ? 'On' : 'Off'} />
                <DetailRow label="Lighting Quality" value={['Off', 'Simple', 'Full'][GRAPHICS_PRESETS[selectedPreset].lightingQuality]} />
                <DetailRow label="Atmospheric Effects" value={GRAPHICS_PRESETS[selectedPreset].atmosphericEffects ? 'On' : 'Off'} />
                <DetailRow label="Tile Detail" value={['Flat', 'Medium', 'Full'][GRAPHICS_PRESETS[selectedPreset].tileDetail]} />
                <DetailRow label="Animated Tiles" value={GRAPHICS_PRESETS[selectedPreset].animatedTiles ? 'On' : 'Off'} />
                <DetailRow label="Vignette" value={GRAPHICS_PRESETS[selectedPreset].vignette ? 'On' : 'Off'} />
                <DetailRow label="Particle Limit" value={GRAPHICS_PRESETS[selectedPreset].particleLimit} />
              </div>
            </div>
          </div>
        )}

        {/* Controls hint */}
        <div style={styles.controlsHint}>
          <p style={styles.hintTitle}>Controls</p>
          <p style={styles.hintText}>WASD - Move • Shift - Sprint • Space - Dodge</p>
          <p style={styles.hintText}>Mouse - Aim • Click - Attack • E - Interact</p>
          <p style={styles.hintText}>Tab - Menu • 1-5 - Hotbar Items</p>
        </div>

        {/* Version */}
        <p style={styles.version}>v1.2.0</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
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
    background: 'linear-gradient(135deg, #0a0812 0%, #1a1028 50%, #0a0812 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 500,
    padding: 40,
  },
  titleSection: {
    marginBottom: 40,
  },
  title: {
    color: '#e0d0f0',
    fontSize: 48,
    fontFamily: 'Georgia, serif',
    fontWeight: 'normal',
    letterSpacing: 6,
    margin: 0,
    marginBottom: 8,
    textShadow: '0 0 30px rgba(139,92,246,0.4)',
  },
  subtitle: {
    color: '#8070a0',
    fontSize: 16,
    fontStyle: 'italic',
    margin: 0,
  },
  menuButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: 260,
    marginBottom: 30,
  },
  primaryBtn: {
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #6030a0 0%, #8040c0 100%)',
    border: '1px solid #a060e0',
    borderRadius: 6,
    color: '#f0e8ff',
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    padding: '12px 28px',
    background: 'rgba(96,48,160,0.3)',
    border: '1px solid rgba(160,96,224,0.4)',
    borderRadius: 6,
    color: '#c0b0e0',
    fontSize: 14,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  settingsBtn: {
    padding: '10px 24px',
    background: 'transparent',
    border: '1px solid rgba(128,112,160,0.4)',
    borderRadius: 6,
    color: '#8070a0',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  settingsPanel: {
    width: '100%',
    background: 'rgba(20,16,30,0.9)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
  },
  settingsTitle: {
    color: '#c0b0e0',
    fontSize: 14,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 0,
    marginBottom: 16,
  },
  presetGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    padding: '12px 16px',
    background: 'rgba(40,30,60,0.6)',
    border: '1px solid rgba(80,60,120,0.4)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  presetBtnActive: {
    background: 'rgba(139,92,246,0.2)',
    borderColor: '#8b5cf6',
    boxShadow: '0 0 10px rgba(139,92,246,0.3)',
  },
  presetName: {
    display: 'block',
    color: '#e0d0f0',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  presetDesc: {
    display: 'block',
    color: '#8070a0',
    fontSize: 10,
    lineHeight: 1.4,
  },
  presetDetails: {
    background: 'rgba(30,25,45,0.6)',
    borderRadius: 6,
    padding: 12,
  },
  detailsTitle: {
    color: '#a090c0',
    fontSize: 11,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 0,
    marginBottom: 10,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px 16px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: '#706080',
    fontSize: 10,
  },
  detailValue: {
    color: '#a090c0',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  controlsHint: {
    marginBottom: 20,
    padding: 16,
    background: 'rgba(20,16,30,0.5)',
    borderRadius: 6,
  },
  hintTitle: {
    color: '#8070a0',
    fontSize: 12,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 0,
    marginBottom: 8,
  },
  hintText: {
    color: '#605070',
    fontSize: 11,
    margin: '4px 0',
  },
  version: {
    color: '#403050',
    fontSize: 10,
    fontFamily: 'monospace',
  },
};

export default StartMenu;
