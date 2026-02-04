// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — DIALOGUE BOX COMPONENT
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';

/**
 * DialogueBox Component - displays NPC dialogue with typewriter effect
 */
export function DialogueBox({
  isOpen,
  npcName,
  npcType,
  lines,
  currentLine,
  isDead,
  choices,
  onAdvance,
  onChoice,
  onClose,
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Typewriter effect
  useEffect(() => {
    if (!isOpen || !lines || currentLine >= lines.length) return;

    const fullText = lines[currentLine];
    if (!fullText) return;

    setIsTyping(true);
    setDisplayedText('');
    
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < fullText.length) {
        setDisplayedText(fullText.slice(0, idx + 1));
        idx++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isOpen, lines, currentLine]);

  if (!isOpen) return null;

  const canAdvance = !isTyping && currentLine < (lines?.length || 0) - 1;
  const isLastLine = currentLine >= (lines?.length || 0) - 1;

  // Get NPC portrait style based on type
  const portraitStyle = getPortraitStyle(npcType, isDead);

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* NPC Portrait */}
        <div style={{ ...styles.portrait, ...portraitStyle }}>
          <span style={styles.portraitEmoji}>{getPortraitEmoji(npcType, isDead)}</span>
        </div>

        {/* Dialogue content */}
        <div style={styles.content}>
          {/* Name plate */}
          <div style={styles.nameplate}>
            <span style={styles.npcName}>{npcName || 'Unknown'}</span>
            {isDead && <span style={styles.deadIndicator}>(Dying)</span>}
          </div>

          {/* Dialogue text */}
          <div style={styles.textBox}>
            <p style={styles.dialogueText}>
              {displayedText}
              {isTyping && <span style={styles.cursor}>▌</span>}
            </p>
          </div>

          {/* Choices or continue prompt */}
          <div style={styles.actions}>
            {choices && choices.length > 0 && !isTyping ? (
              <div style={styles.choices}>
                {choices.map((choice, idx) => (
                  <button
                    key={idx}
                    style={styles.choiceBtn}
                    onClick={() => onChoice?.(idx)}
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            ) : (
              <div style={styles.prompts}>
                {isTyping ? (
                  <span style={styles.hint}>Press [Space] to skip...</span>
                ) : canAdvance ? (
                  <button style={styles.continueBtn} onClick={onAdvance}>
                    Continue ▶
                  </button>
                ) : isLastLine ? (
                  <button style={styles.closeBtn} onClick={onClose}>
                    Close [E]
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Close button */}
        <button style={styles.xBtn} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

/**
 * Get portrait emoji based on NPC type
 */
function getPortraitEmoji(type, isDead) {
  if (isDead) return '💀';
  
  const emojiMap = {
    knight: '🛡️',
    merchant: '🏪',
    blacksmith: '⚒️',
    alchemist: '⚗️',
    priest: '⛪',
    guard: '🗡️',
    elder: '👴',
    villager: '👤',
    mysterious: '🎭',
  };
  
  return emojiMap[type] || '👤';
}

/**
 * Get portrait background style based on NPC type
 */
function getPortraitStyle(type, isDead) {
  if (isDead) {
    return {
      background: 'linear-gradient(135deg, #1a0808 0%, #301010 100%)',
      borderColor: '#602020',
    };
  }

  const styleMap = {
    knight: {
      background: 'linear-gradient(135deg, #1a2030 0%, #2a3545 100%)',
      borderColor: '#506080',
    },
    merchant: {
      background: 'linear-gradient(135deg, #2a2810 0%, #403820 100%)',
      borderColor: '#806820',
    },
    blacksmith: {
      background: 'linear-gradient(135deg, #201510 0%, #352520 100%)',
      borderColor: '#704030',
    },
    alchemist: {
      background: 'linear-gradient(135deg, #102010 0%, #203020 100%)',
      borderColor: '#408040',
    },
  };

  return styleMap[type] || {
    background: 'linear-gradient(135deg, #1a1828 0%, #252535 100%)',
    borderColor: '#404060',
  };
}

const styles = {
  overlay: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: 20,
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
    pointerEvents: 'auto',
    zIndex: 1000,
  },
  container: {
    display: 'flex',
    gap: 16,
    maxWidth: 700,
    width: '100%',
    background: 'rgba(8,6,14,0.97)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
    boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
  },
  portrait: {
    width: 80,
    height: 80,
    borderRadius: 8,
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  portraitEmoji: {
    fontSize: 36,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 100,
  },
  nameplate: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  npcName: {
    color: '#e0d8f0',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  deadIndicator: {
    color: '#c04040',
    fontSize: 11,
    fontStyle: 'italic',
  },
  textBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-start',
  },
  dialogueText: {
    color: '#c0b8d0',
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
    fontFamily: 'Georgia, serif',
  },
  cursor: {
    color: '#8b5cf6',
    animation: 'blink 1s infinite',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  prompts: {},
  hint: {
    color: '#606080',
    fontSize: 11,
    fontStyle: 'italic',
  },
  continueBtn: {
    padding: '8px 16px',
    background: 'rgba(139,92,246,0.2)',
    border: '1px solid rgba(139,92,246,0.4)',
    borderRadius: 4,
    color: '#c0b8f0',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  closeBtn: {
    padding: '8px 16px',
    background: 'rgba(80,80,100,0.2)',
    border: '1px solid rgba(80,80,100,0.4)',
    borderRadius: 4,
    color: '#a0a0b0',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  choiceBtn: {
    padding: '10px 16px',
    background: 'rgba(40,35,60,0.6)',
    border: '1px solid rgba(80,70,100,0.4)',
    borderRadius: 4,
    color: '#c0b8d0',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  xBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    color: '#606080',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
};

// Add CSS keyframes for cursor blink
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export default DialogueBox;
