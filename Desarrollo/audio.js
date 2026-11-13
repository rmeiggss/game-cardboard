/**
 * audio.js - Sintetizador Procedural de Audio y Háptica
 * 100% Offline con Web Audio API pura (sin archivos de audio externos).
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.rollingNode = null;
    this.rollingGain = null;
    this.rollingFilter = null;
    this.isRollingPlaying = false;
    this.lastImpactTime = 0;
    this.lastVictoryTime = 0;
  }

  // Inicializa el contexto en el primer gesto de usuario
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupRollingSound();
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Sonido de clic en la interfaz (tacto de botón)
  playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.04);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  // Sonido de golpe sordo contra el cartón Kraft
  playImpact(intensity = 0.5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = performance.now();
    // Prevenir saturación de sonidos en impactos repetidos muy rápidos
    if (now - this.lastImpactTime < 60) return;
    this.lastImpactTime = now;

    const clampedIntensity = Math.max(0.1, Math.min(1.0, intensity));
    const t = this.ctx.currentTime;

    // Componente 1: Impacto grave resonante de la caja (tono bajo)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = 160 + clampedIntensity * 40;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);

    const baseVol = 0.3 * clampedIntensity;
    oscGain.gain.setValueAtTime(baseVol, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);

    // Componente 2: Ruido sordo (textura de fibra de cartón)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.Q.setValueAtTime(1.8, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25 * clampedIntensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.07);

    // Respuesta háptica en dispositivos móviles
    if (clampedIntensity > 0.35 && 'vibrate' in navigator) {
      try {
        const vibeTime = Math.min(25, Math.floor(10 + clampedIntensity * 20));
        navigator.vibrate(vibeTime);
      } catch (e) {
        // Ignorar si el navegador bloquea vibración no iniciada por tap
      }
    }
  }

  // Prepara el nodo continuo de rodamiento
  setupRollingSound() {
    if (!this.ctx) return;
    try {
      // Buffer de ruido blanco con longitud de 1 segundo en bucle
      const bufferSize = this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      // Ruido rosa/marrón filtrado para que no suene a estática de TV
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }

      this.rollingNode = this.ctx.createBufferSource();
      this.rollingNode.buffer = noiseBuffer;
      this.rollingNode.loop = true;

      this.rollingFilter = this.ctx.createBiquadFilter();
      this.rollingFilter.type = 'bandpass';
      this.rollingFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
      this.rollingFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.rollingGain = this.ctx.createGain();
      this.rollingGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.rollingNode.connect(this.rollingFilter);
      this.rollingFilter.connect(this.rollingGain);
      this.rollingGain.connect(this.ctx.destination);

      this.rollingNode.start();
      this.isRollingPlaying = true;
    } catch (e) {
      console.warn("No se pudo iniciar el sonido continuo de rodadura:", e);
    }
  }

  // Modula el sonido de rodadura proporcional a la velocidad de la canica
  updateRolling(speed, maxSpeed = 15) {
    if (this.isMuted || !this.ctx || !this.rollingGain || !this.rollingFilter) return;

    if (this.ctx.state === 'suspended') return;

    const ratio = Math.max(0, Math.min(1.0, speed / maxSpeed));
    const t = this.ctx.currentTime;

    if (ratio < 0.05) {
      this.rollingGain.gain.setTargetAtTime(0, t, 0.05);
    } else {
      // Volumen suave y frecuencia que sube con la velocidad
      const targetVolume = 0.03 + ratio * 0.12;
      const targetFreq = 220 + ratio * 380;
      this.rollingGain.gain.setTargetAtTime(targetVolume, t, 0.05);
      this.rollingFilter.frequency.setTargetAtTime(targetFreq, t, 0.05);
    }
  }

  // Detiene o silencia el rodamiento (ej. cuando la bola cae en un hoyo o gana)
  stopRolling() {
    if (this.rollingGain && this.ctx) {
      try {
        this.rollingGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch (e) {
        this.rollingGain.gain.value = 0;
      }
    }
  }

  // Sonido de caída al vacío en un agujero trampa
  playHoleDrop() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopRolling();
    const t = this.ctx.currentTime;

    // Tono descendente sordo simulando caída
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.35);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.4);

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([30, 40, 60]);
      } catch (e) {}
    }
  }

  // Fanfarria alegre al alcanzar la meta dorada
  playVictory() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = performance.now();
    if (now - this.lastVictoryTime < 1800) return;
    this.lastVictoryTime = now;

    this.stopRolling();
    const t = this.ctx.currentTime;

    // Arpegio pentatónico brillante: Do5, Mi5, Sol5, Do6, Sol6
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.28, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([50, 60, 50, 60, 120]);
      } catch (e) {}
    }
  }

  // Alternar silencio
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopRolling();
    }
    return this.isMuted;
  }
}

// Exportar instancia global
window.soundEffects = new SoundEffects();
