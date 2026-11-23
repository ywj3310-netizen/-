class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastChalkAt = 0;
  private lastFootstepAt = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playTone(
    freq: number,
    duration = 0.08,
    type: OscillatorType = 'sine',
    volume = 0.08,
    slideTo?: number,
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  public playChalkTick(nowMs: number) {
    if (nowMs - this.lastChalkAt < 260) return;
    this.lastChalkAt = nowMs;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.035);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400 + Math.random() * 900;
    filter.Q.value = 3.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.028;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playFootstep(nowMs: number) {
    if (nowMs - this.lastFootstepAt < 380) return;
    this.lastFootstepAt = nowMs;
    this.playTone(95 + Math.random() * 20, 0.06, 'triangle', 0.045, 45);
  }

  public playWarningCue() {
    this.playTone(540, 0.09, 'triangle', 0.11, 440);
    window.setTimeout(() => this.playTone(680, 0.12, 'triangle', 0.12, 620), 90);
  }

  public playScanAlert() {
    this.playTone(220, 0.18, 'sawtooth', 0.07, 165);
  }

  public playHidePhone() {
    this.playTone(320, 0.07, 'sine', 0.06, 140);
  }

  public playShowPhone() {
    this.playTone(260, 0.07, 'sine', 0.06, 460);
  }

  public playPop(combo = 1) {
    const pitch = Math.min(1100, 440 + combo * 45);
    this.playTone(pitch, 0.075, 'sine', 0.09, pitch * 1.25);
  }

  public playCoin(combo = 1) {
    const base = Math.min(1040, 580 + combo * 30);
    this.playTone(base, 0.06, 'triangle', 0.08);
    window.setTimeout(() => this.playTone(base * 1.33, 0.09, 'triangle', 0.08), 45);
  }

  public playStack(perfect: boolean, combo = 1) {
    if (perfect) {
      const base = Math.min(980, 520 + combo * 42);
      this.playTone(base, 0.12, 'sine', 0.1, base * 1.5);
    } else {
      this.playTone(240, 0.08, 'triangle', 0.07, 180);
    }
  }

  public playMiniMiss() {
    this.playTone(170, 0.16, 'sawtooth', 0.08, 110);
  }

  public playCloseCall() {
    this.playTone(523.25, 0.07, 'sine', 0.08);
    window.setTimeout(() => this.playTone(659.25, 0.07, 'sine', 0.08), 60);
    window.setTimeout(() => this.playTone(783.99, 0.14, 'sine', 0.09), 120);
  }

  public playCaught() {
    this.playTone(280, 0.18, 'sawtooth', 0.13, 180);
    window.setTimeout(() => this.playTone(185, 0.35, 'sawtooth', 0.15, 90), 150);
  }

  public playBellClear() {
    const notes = [659.25, 523.25, 587.33, 392.0];
    notes.forEach((freq, idx) => {
      window.setTimeout(() => this.playTone(freq, 0.42, 'sine', 0.1), idx * 240);
    });
  }
}

export const soundEngine = new SoundEngine();
