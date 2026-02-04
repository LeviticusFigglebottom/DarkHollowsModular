// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — SOUND SYSTEM (Web Audio API)
// Realistic procedural sounds with no external audio files
// ═══════════════════════════════════════════════════════════════

class SoundSystemClass {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.35;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  // Generate white noise buffer
  noise(duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    return noise;
  }

  play(type) {
    if (!this.enabled || !this.ctx) return;
    
    const now = this.ctx.currentTime;
    const v = this.volume;

    switch (type) {
      case 'swing': {
        // Sword swing - whoosh sound
        const n = this.noise(0.15);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 800;
        f.Q.value = 1.5;
        f.frequency.setValueAtTime(1200, now);
        f.frequency.exponentialRampToValueAtTime(400, now + 0.12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.25 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.15);
        break;
      }

      case 'hit': {
        // Weapon impact
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(150, now);
        o.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        g.gain.setValueAtTime(0.3 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.15);
        // Impact noise
        const n = this.noise(0.08);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.15 * v, now);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        n.connect(f);
        f.connect(g2);
        g2.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.08);
        break;
      }

      case 'hurt': {
        // Player damage sound
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(250, now);
        o.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        g.gain.setValueAtTime(0.2 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.2);
        break;
      }

      case 'kill': {
        // Enemy death
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(200, now);
        o.frequency.exponentialRampToValueAtTime(25, now + 0.4);
        g.gain.setValueAtTime(0.2 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.45);
        break;
      }

      case 'shoot': {
        // Bow release
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(600, now);
        o.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        g.gain.setValueAtTime(0.15 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.12);
        // String vibration
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.value = 150;
        g2.gain.setValueAtTime(0.08 * v, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o2.connect(g2);
        g2.connect(this.ctx.destination);
        o2.start(now);
        o2.stop(now + 0.2);
        break;
      }

      case 'fireball': {
        // Enemy projectile
        const n = this.noise(0.2);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 600;
        f.Q.value = 1;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.15 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.2);
        break;
      }

      case 'slam': {
        // Ground slam
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(60, now);
        o.frequency.exponentialRampToValueAtTime(20, now + 0.25);
        g.gain.setValueAtTime(0.4 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.3);
        break;
      }

      case 'step': {
        // Footstep
        const n = this.noise(0.05);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.04 * v, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.05);
        break;
      }

      case 'woosh': {
        // Dodge roll
        const n = this.noise(0.18);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1500;
        f.Q.value = 0.8;
        f.frequency.setValueAtTime(2200, now);
        f.frequency.exponentialRampToValueAtTime(700, now + 0.15);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.2 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.18);
        break;
      }

      case 'coin': {
        // Gold clink
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(2500, now);
        o.frequency.setValueAtTime(3000, now + 0.03);
        g.gain.setValueAtTime(0.1 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.1);
        break;
      }

      case 'break': {
        // Jar shatter
        const n = this.noise(0.15);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.3 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.15);
        break;
      }

      case 'pickup': {
        // Item chime
        [880, 1100, 1320].forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0, now + i * 0.04);
          g.gain.linearRampToValueAtTime(0.08 * v, now + i * 0.04 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now);
          o.stop(now + 0.25);
        });
        break;
      }

      case 'potion': {
        // Drinking sound
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(300, now);
        o.frequency.setValueAtTime(400, now + 0.08);
        o.frequency.setValueAtTime(350, now + 0.15);
        g.gain.setValueAtTime(0.12 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.2);
        break;
      }

      case 'levelup':
      case 'level_up': {
        // Level up fanfare
        [400, 500, 600, 800].forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'square';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0, now + i * 0.1);
          g.gain.linearRampToValueAtTime(0.1 * v, now + i * 0.1 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now);
          o.stop(now + 0.7);
        });
        break;
      }

      case 'door': {
        // Door creak
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(55, now);
        o.frequency.linearRampToValueAtTime(85, now + 0.15);
        o.frequency.linearRampToValueAtTime(65, now + 0.3);
        g.gain.setValueAtTime(0.1 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.35);
        break;
      }

      case 'ui': {
        // Menu click
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 700;
        g.gain.setValueAtTime(0.05 * v, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.04);
        break;
      }

      case 'magic': {
        // Ultimate ability
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200, now);
        o.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        g.gain.setValueAtTime(0.2 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.4);
        // Shimmer
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(1200, now);
        o2.frequency.setValueAtTime(1600, now + 0.1);
        o2.frequency.setValueAtTime(1400, now + 0.2);
        g2.gain.setValueAtTime(0.1 * v, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        o2.connect(g2);
        g2.connect(this.ctx.destination);
        o2.start(now);
        o2.stop(now + 0.35);
        break;
      }

      case 'freeze': {
        // Ice/freeze effect
        const n = this.noise(0.2);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.15 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.2);
        break;
      }

      case 'burn': {
        // Fire/burn effect
        const n = this.noise(0.25);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 400;
        f.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12 * v, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        n.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        n.start(now);
        n.stop(now + 0.25);
        break;
      }

      case 'teleport': {
        // Teleport whoosh
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(100, now);
        o.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
        g.gain.setValueAtTime(0.15 * v, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now);
        o.stop(now + 0.2);
        break;
      }

      default:
        // Unknown sound type - silent
        break;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

// Export singleton instance
export const SoundSystem = new SoundSystemClass();
