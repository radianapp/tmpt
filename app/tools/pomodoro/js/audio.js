// app/tools/pomodoro/js/audio.js

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.tickInterval = null;
  }

  getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  async playNotification(soundName = 'bell', volume = 60) {
    try {
      const ctx = this.getContext();
      const time = ctx.currentTime;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(volume / 100, time);
      gainNode.connect(ctx.destination);

      switch (soundName) {
        case 'bell':
          // Synthesize metallic bell chime
          this.synthesizeBell(ctx, gainNode, time);
          break;
        case 'chime':
          // Synthesize a pleasant chime arpeggio
          this.synthesizeChime(ctx, gainNode, time);
          break;
        case 'digital':
          // Synthesize classic digital double beep
          this.synthesizeDigital(ctx, gainNode, time);
          break;
        case 'gong':
          // Synthesize deep resonant zen gong
          this.synthesizeGong(ctx, gainNode, time);
          break;
        case 'wood_block':
          // Synthesize wood block blocky click
          this.synthesizeWoodBlock(ctx, gainNode, time);
          break;
        default:
          break;
      }
    } catch (e) {
      console.warn('Audio synthesis failed or was blocked by autoplay policy:', e);
    }
  }

  synthesizeBell(ctx, output, time) {
    const freqs = [587.33, 880, 1174.66, 1760]; // D5, A5, D6, A6
    const durations = [1.5, 1.2, 0.8, 0.5];
    
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.25 / freqs.length, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + durations[idx]);
      
      osc.connect(gain);
      gain.connect(output);
      
      osc.start(time);
      osc.stop(time + durations[idx]);
    });
  }

  synthesizeChime(ctx, output, time) {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteStart = time + idx * 0.15;
      const duration = 1.0;
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.0, noteStart);
      gain.gain.linearRampToValueAtTime(0.2, noteStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);
      
      osc.connect(gain);
      gain.connect(output);
      
      osc.start(noteStart);
      osc.stop(noteStart + duration);
    });
  }

  synthesizeDigital(ctx, output, time) {
    // Beep 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.value = 987.77; // B5
    gain1.gain.setValueAtTime(0.15, time);
    gain1.gain.setValueAtTime(0.15, time + 0.1);
    gain1.gain.linearRampToValueAtTime(0.001, time + 0.12);
    
    osc1.connect(gain1);
    gain1.connect(output);
    osc1.start(time);
    osc1.stop(time + 0.13);

    // Beep 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 987.77;
    gain2.gain.setValueAtTime(0.15, time + 0.18);
    gain2.gain.setValueAtTime(0.15, time + 0.28);
    gain2.gain.linearRampToValueAtTime(0.001, time + 0.3);
    
    osc2.connect(gain2);
    gain2.connect(output);
    osc2.start(time + 0.18);
    osc2.stop(time + 0.31);
  }

  synthesizeGong(ctx, output, time) {
    const duration = 4.0;
    const baseFreq = 110; // Low A2
    const partials = [1, 1.5, 2, 2.3, 3, 3.7]; // Harmonics and inharmonics
    
    partials.forEach((part) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = baseFreq * part;
      
      gain.gain.setValueAtTime(0.2 / partials.length, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      
      osc.connect(gain);
      gain.connect(output);
      
      osc.start(time);
      osc.stop(time + duration);
    });
  }

  synthesizeWoodBlock(ctx, output, time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(800, time + 0.05);
    
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    
    osc.connect(gain);
    gain.connect(output);
    
    osc.start(time);
    osc.stop(time + 0.07);
  }

  playTick(soundType = 'clock', volume = 30) {
    try {
      const ctx = this.getContext();
      const time = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime((volume / 100) * 0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      
      osc.connect(gain);
      
      if (soundType === 'soft') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, time);
      } else if (soundType === 'mechanical') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, time);
      } else { // 'clock'
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, time);
      }
      
      osc.start(time);
      osc.stop(time + 0.05);
    } catch (e) {
      // Ignored if blocked
    }
  }
}
