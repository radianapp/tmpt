// app/tools/pomodoro/js/ambient.js

export class AmbientPlayer {
  constructor() {
    this.ctx = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.keyboardInterval = null;
    this.currentSound = 'none';
    this.volume = 60;
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

  async play(soundName, volume = 60) {
    this.volume = volume;
    this.stop();
    this.currentSound = soundName;
    if (soundName === 'none') return;

    try {
      const ctx = this.getContext();
      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume / 100, ctx.currentTime);
      this.gainNode.connect(ctx.destination);

      if (soundName === 'white_noise') {
        this.playWhiteNoise(ctx);
      } else if (soundName === 'brown_noise') {
        this.playBrownNoise(ctx);
      } else if (soundName === 'rain' || soundName === 'heavy_rain') {
        this.playRain(ctx, soundName === 'heavy_rain');
      } else if (soundName === 'ocean_waves') {
        this.playOceanWaves(ctx);
      } else if (soundName === 'fireplace') {
        this.playFireplace(ctx);
      } else if (soundName === 'keyboard') {
        this.playKeyboard(ctx);
      } else {
        // Fallback simple white noise if sound name unknown
        this.playWhiteNoise(ctx);
      }
    } catch (err) {
      console.warn('Autoplay or Audio synthesis failed:', err);
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(v / 100, this.ctx.currentTime);
    }
  }

  stop() {
    this.currentSound = 'none';
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    if (this.keyboardInterval) {
      clearInterval(this.keyboardInterval);
      this.keyboardInterval = null;
    }
  }

  // Create White Noise buffer
  createWhiteNoiseBuffer(ctx) {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // Create Brown Noise buffer
  createBrownNoiseBuffer(ctx) {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }
    return noiseBuffer;
  }

  playWhiteNoise(ctx) {
    const buffer = this.createWhiteNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gainNode);
    source.start(0);
    this.sourceNode = source;
  }

  playBrownNoise(ctx) {
    const buffer = this.createBrownNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gainNode);
    source.start(0);
    this.sourceNode = source;
  }

  playRain(ctx, isHeavy = false) {
    // Rain is filtered white noise with random crackles
    const noiseBuffer = this.createWhiteNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isHeavy ? 600 : 900;
    filter.Q.value = 1.0;

    noiseSource.connect(filter);
    filter.connect(this.gainNode);
    noiseSource.start(0);
    this.sourceNode = noiseSource;

    // Simulate crackle pops
    const triggerPop = () => {
      if (this.currentSound !== 'rain' && this.currentSound !== 'heavy_rain') return;
      const osc = ctx.createOscillator();
      const popGain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isHeavy ? 100 + Math.random() * 300 : 200 + Math.random() * 400, ctx.currentTime);
      
      popGain.gain.setValueAtTime(0.02 * (Math.random() * 0.5 + 0.5), ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      
      osc.connect(popGain);
      popGain.connect(this.gainNode);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);

      setTimeout(triggerPop, Math.random() * (isHeavy ? 200 : 600) + 50);
    };

    triggerPop();
  }

  playOceanWaves(ctx) {
    // Ocean waves: LFO modulating brown noise bandpass frequency
    const noiseBuffer = this.createBrownNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    // LFO for wave modulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08; // 12 seconds per wave cycle

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250; // Sweeps between 150Hz and 650Hz

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noiseSource.connect(filter);
    filter.connect(this.gainNode);

    lfo.start(0);
    noiseSource.start(0);

    this.sourceNode = {
      disconnect: () => {
        noiseSource.stop();
        lfo.stop();
        noiseSource.disconnect();
        lfo.disconnect();
        filter.disconnect();
        lfoGain.disconnect();
      }
    };
  }

  playFireplace(ctx) {
    // Fireplace: Low frequency rumble + sharp crackles
    const rumbleBuffer = this.createBrownNoiseBuffer(ctx);
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = rumbleBuffer;
    rumbleSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150; // Only low rumble

    rumbleSource.connect(filter);
    filter.connect(this.gainNode);
    rumbleSource.start(0);

    const triggerCrackle = () => {
      if (this.currentSound !== 'fireplace') return;
      const time = ctx.currentTime;
      const osc = ctx.createOscillator();
      const popGain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1500 + Math.random() * 1500, time);
      osc.frequency.exponentialRampToValueAtTime(100, time + 0.02);
      
      popGain.gain.setValueAtTime(0.04 * (Math.random() * 0.6 + 0.4), time);
      popGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
      
      osc.connect(popGain);
      popGain.connect(this.gainNode);
      osc.start(time);
      osc.stop(time + 0.03);

      setTimeout(triggerCrackle, Math.random() * 900 + 100);
    };

    triggerCrackle();

    this.sourceNode = {
      disconnect: () => {
        rumbleSource.stop();
        rumbleSource.disconnect();
        filter.disconnect();
      }
    };
  }

  playKeyboard(ctx) {
    // Keyboard typing simulator
    this.keyboardInterval = setInterval(() => {
      if (this.currentSound !== 'keyboard') return;
      // 35% chance to type a key every 150ms
      if (Math.random() > 0.35) {
        const time = ctx.currentTime;
        const osc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        
        osc.type = Math.random() > 0.8 ? 'triangle' : 'sine';
        const isSpace = Math.random() > 0.9;
        
        osc.frequency.setValueAtTime(isSpace ? 350 + Math.random() * 50 : 800 + Math.random() * 400, time);
        
        clickGain.gain.setValueAtTime(0.05 * (isSpace ? 1.5 : 0.8), time);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, time + (isSpace ? 0.08 : 0.04));
        
        osc.connect(clickGain);
        clickGain.connect(this.gainNode);
        osc.start(time);
        osc.stop(time + 0.1);
      }
    }, 150);
  }
}
