/**
 * Upgraded 16-Bit Arcade Samba-Funk & Stadium Brass Procedural Audio Engine
 * (Web Audio API + Tone.js integration).
 */

declare global {
  interface Window {
    Tone?: {
      start: () => Promise<void>;
    };
    webkitAudioContext?: typeof AudioContext;
  }
}

export class IndieSoundEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  crowdGain: GainNode | null = null;
  crowdFilter: BiquadFilterNode | null = null;
  muted = false;
  isPlayingMusic = false;
  stepIndex = 0;
  musicTimer: ReturnType<typeof setInterval> | null = null;
  toneReady = false;
  getGameState: () => string;
  getFlowCombo: () => number;

  lastStepTime = 0;

  // Warm, infectious pentatonic marimba/synth hook with musical breathing room (0 = rest)
  melodySectionA = [
    523.25, 0, 659.25, 0, 783.99, 0, 659.25, 523.25,
    0, 587.33, 0, 659.25, 523.25, 0, 440.0, 0,
    523.25, 0, 659.25, 783.99, 880.0, 0, 783.99, 659.25,
    587.33, 0, 523.25, 0, 440.0, 0, 0, 0,
  ];

  // Section B: Uplifting call-and-response phrase
  melodySectionB = [
    659.25, 0, 783.99, 0, 880.0, 0, 783.99, 659.25,
    587.33, 0, 659.25, 0, 783.99, 0, 587.33, 0,
    523.25, 0, 659.25, 0, 880.0, 0, 783.99, 659.25,
    587.33, 523.25, 440.0, 0, 523.25, 0, 0, 0,
  ];

  // Section C: Deep Rhodes & Bass Pocket Breakdown (sparse airy bells)
  melodySectionC = [
    0, 0, 783.99, 0, 659.25, 0, 523.25, 0,
    0, 0, 587.33, 0, 523.25, 0, 440.0, 0,
    0, 0, 880.0, 0, 783.99, 0, 659.25, 0,
    587.33, 0, 523.25, 0, 440.0, 0, 0, 0,
  ];

  // Section D: Warm Octave Hook
  melodySectionD = [
    880.0, 0, 783.99, 659.25, 523.25, 0, 659.25, 0,
    587.33, 0, 659.25, 783.99, 659.25, 0, 523.25, 0,
    880.0, 0, 1046.5, 0, 880.0, 783.99, 659.25, 0,
    587.33, 0, 523.25, 0, 659.25, 0, 0, 0,
  ];

  // Soft 3rd/6th Counter-Harmony
  harmonyNotes = [
    392.0, 0, 523.25, 0, 587.33, 0, 523.25, 392.0,
    0, 440.0, 0, 523.25, 392.0, 0, 329.63, 0,
    392.0, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25,
    440.0, 0, 392.0, 0, 329.63, 0, 0, 0,
  ];

  // Syncopated Nu-Disco / French-Touch Sub Bassline (0 = rest for pocket groove)
  bassNotesA = [
    87.31, 0, 87.31, 174.61, 0, 87.31, 130.81, 0,   // Fmaj9
    82.41, 0, 82.41, 164.81, 0, 82.41, 123.47, 0,   // Em7
    73.42, 0, 73.42, 146.83, 0, 73.42, 110.0, 0,    // Dm9
    98.0,  0, 98.0,  196.0,  0, 110.0, 123.47, 130.81, // G13 turnaround
  ];
  bassNotesB = [
    87.31, 0, 130.81, 174.61, 0, 87.31, 0, 130.81,
    82.41, 0, 123.47, 164.81, 0, 82.41, 0, 123.47,
    73.42, 0, 110.0,  146.83, 0, 73.42, 0, 110.0,
    98.0,  0, 146.83, 196.0,  0, 123.47, 130.81, 146.83,
  ];

  // Lush Warm Rhodes Electric Piano Voicings (Fmaj9 -> Em7 -> Dm9 -> G13)
  chordVoicings = [
    [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
    [164.81, 196.0, 246.94, 293.66, 392.0], // Em7
    [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9
    [196.0,  246.94, 293.66, 349.23, 440.0], // G13
  ];

  // Super-Flow Gentle Bell Shimmer Notes
  arpNotes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1046.5, 783.99, 659.25];

  private iosUnlocked = false;
  private htmlAudioUnlockEl: HTMLAudioElement | null = null;
  private silentWavUrl: string | null = null;

  constructor(
    getGameState: () => string = () => 'PLAYING',
    getFlowCombo: () => number = () => 0
  ) {
    this.getGameState = getGameState;
    this.getFlowCombo = getFlowCombo;
  }

  private getSilentWavUrl(): string {
    if (this.silentWavUrl) return this.silentWavUrl;
    try {
      const numSamples = 2000;
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true);
      view.setUint32(28, 8000, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples, true);
      for (let i = 0; i < numSamples; i++) {
        view.setUint8(44 + i, 128);
      }
      const blob = new Blob([buffer], { type: 'audio/wav' });
      this.silentWavUrl = URL.createObjectURL(blob);
      return this.silentWavUrl;
    } catch {
      return 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    }
  }

  init() {
    try {
      // Configure iOS 16.4+ WebKit AudioSession to 'playback' so sound plays even if iPhone physical Silent Switch is on
      const navWithAudioSession = navigator as Navigator & {
        audioSession?: { type: string };
      };
      if (navWithAudioSession.audioSession) {
        try {
          navWithAudioSession.audioSession.type = 'playback';
        } catch {}
      }

      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-16, this.ctx.currentTime);
          comp.knee.setValueAtTime(12, this.ctx.currentTime);
          comp.ratio.setValueAtTime(3.2, this.ctx.currentTime);

          this.master = this.ctx.createGain();
          this.master.gain.setValueAtTime(this.muted ? 0 : 1.08, this.ctx.currentTime);
          this.master.connect(comp);
          comp.connect(this.ctx.destination);

          const sampleRate = this.ctx.sampleRate || 44100;
          this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2.0, sampleRate);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const crowdSrc = this.ctx.createBufferSource();
          crowdSrc.buffer = this.noiseBuffer;
          crowdSrc.loop = true;

          this.crowdFilter = this.ctx.createBiquadFilter();
          this.crowdFilter.type = 'bandpass';
          this.crowdFilter.frequency.setValueAtTime(680, this.ctx.currentTime);
          this.crowdFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);

          this.crowdGain = this.ctx.createGain();
          this.crowdGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

          crowdSrc.connect(this.crowdFilter);
          this.crowdFilter.connect(this.crowdGain);
          this.crowdGain.connect(this.master);
          crowdSrc.start(0);
        }
      }

      if (this.ctx) {
        const stateStr = this.ctx.state as string;
        if (stateStr !== 'running') {
          this.ctx.resume().catch(() => {});
        }
      }
    } catch {
      // Ignore Web Audio restriction errors
    }
  }

  /**
   * Explicitly unlocks iOS Safari / Chrome WebKit & Android audio within a direct user gesture.
   * Plays a silent AudioBuffer + micro-oscillator + silent HTMLAudioElement WAV so iOS promotes WebAudio
   * to the active media playback channel (bypassing the hardware silent switch).
   */
  unlock() {
    try {
      const navWithAudioSession = navigator as Navigator & {
        audioSession?: { type: string };
      };
      if (navWithAudioSession.audioSession) {
        try {
          navWithAudioSession.audioSession.type = 'playback';
        } catch {}
      }

      this.init();
      if (!this.ctx) return;

      const stateStr = this.ctx.state as string;
      if (stateStr !== 'running') {
        this.ctx.resume().catch(() => {});
      }

      if (!this.iosUnlocked || stateStr !== 'running') {
        try {
          const silentBuf = this.ctx.createBuffer(1, 1, 22050);
          const silentSrc = this.ctx.createBufferSource();
          silentSrc.buffer = silentBuf;
          silentSrc.connect(this.ctx.destination);
          silentSrc.start(0);
        } catch {}

        try {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          g.gain.value = 0.00001;
          osc.connect(g);
          g.connect(this.ctx.destination);
          osc.start(0);
          osc.stop(this.ctx.currentTime + 0.005);
        } catch {}

        try {
          if (!this.htmlAudioUnlockEl && typeof Audio !== 'undefined') {
            const a = new Audio(this.getSilentWavUrl());
            a.setAttribute('playsinline', 'true');
            a.setAttribute('webkit-playsinline', 'true');
            a.volume = 0.01;
            this.htmlAudioUnlockEl = a;
          }
          if (this.htmlAudioUnlockEl) {
            const p = this.htmlAudioUnlockEl.play();
            if (p && typeof p.then === 'function') {
              p.then(() => {
                this.iosUnlocked = true;
              }).catch(() => {});
            }
          }
        } catch {}

        if ((this.ctx.state as string) === 'running') {
          this.iosUnlocked = true;
        }
      }

      if (!this.isPlayingMusic) {
        this.startMusic();
      }
    } catch {}
  }

  ensureReady(): boolean {
    this.init();
    if (this.ctx) {
      const stateStr = this.ctx.state as string;
      if (stateStr === 'suspended' || stateStr === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    }
    return Boolean(!this.muted && this.ctx && this.master);
  }

  updateCrowdAmbience(excitement = 0, isPlaying = false) {
    if (!this.crowdGain || !this.crowdFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetGain = !this.muted && isPlaying ? 0.022 + excitement * 0.1 : 0.001;
    const targetFreq = 620 + excitement * 580;
    this.crowdGain.gain.setTargetAtTime(targetGain, now, 0.18);
    this.crowdFilter.frequency.setTargetAtTime(targetFreq, now, 0.18);
  }

  toggleMute(): boolean {
    this.init();
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : 1.08, this.ctx.currentTime);
    }
    return this.muted;
  }

  playNoiseBurst(duration = 0.08, filterFreq = 1200, volume = 0.3, q = 1.0) {
    if (!this.ensureReady() || !this.noiseBuffer || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.015);
  }

  startMusic(
    stateGetter?: () => {
      gameState?: string;
      isPlaying?: boolean;
      isSuperFlow?: boolean;
      flowCombo: number;
    }
  ) {
    if (stateGetter) {
      this.getGameState = () => {
        const s = stateGetter();
        if (s.gameState) return s.gameState;
        return s.isPlaying ? 'PLAYING' : 'MENU';
      };
      this.getFlowCombo = () => stateGetter().flowCombo;
    }
    this.init();
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const stateStr = this.ctx.state as string;
      if (stateStr !== 'running') {
        this.ctx.resume().catch(() => {});
        return;
      }
      const st = this.getGameState ? this.getGameState() : 'PLAYING';
      if (st === 'PAUSED') {
        this.updateCrowdAmbience(0, false);
        return;
      }
      this.playMusicStep(st);
    }, 125); // 120 BPM 16th-note pocket
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.isPlayingMusic = false;
  }

  isMenuMode = true;

  setMenuMode(isMenu: boolean) {
    this.isMenuMode = isMenu;
    if (isMenu) {
      this.updateCrowdAmbience(0, false);
    }
  }

  playMusicStep(currentState = 'PLAYING') {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    // Prevent step stacking if browser tab was backgrounded or timer jittered
    if (now - this.lastStepTime < 0.075) return;
    this.lastStepTime = now;

    const cycleStep = this.stepIndex % 128;
    const step = cycleStep % 32;
    const barStep = cycleStep % 16;
    const section = Math.floor(cycleStep / 32); // 0 = A, 1 = B, 2 = C (Pocket), 3 = D (Chorus)
    const isMenuGroove =
      this.isMenuMode ||
      currentState === 'MENU' ||
      currentState === 'SPLASH' ||
      currentState === 'MATCH_OVER';
    const superFlow = !isMenuGroove && this.getFlowCombo() >= 3;
    const volScale = isMenuGroove ? 0.62 : 0.85;

    // 1. Warm Round Kick Drum (Four-on-the-floor + subtle syncopation)
    if (barStep % 4 === 0 || (!isMenuGroove && barStep === 14 && section % 2 === 1)) {
      const kick = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(132, now);
      kick.frequency.exponentialRampToValueAtTime(42, now + 0.11);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.18 * volScale, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      kick.connect(g);
      g.connect(this.master);
      kick.start(now);
      kick.stop(now + 0.14);
    }

    // 2. Lush Rhodes Electric Piano Chords (Smooth attack, warm lowpass, zero clicks)
    if (barStep === 0 || barStep === 6 || (!isMenuGroove && barStep === 12)) {
      const chordIdx = Math.floor(cycleStep / 16) % this.chordVoicings.length;
      const chord = this.chordVoicings[chordIdx];
      const holdDur = barStep === 0 ? 0.52 : 0.28;
      const peakGain = (barStep === 0 ? 0.022 : 0.015) * volScale;

      chord.forEach((freq, idx) => {
        if (!this.ctx || !this.master) return;
        const cOsc = this.ctx.createOscillator();
        const cFilter = this.ctx.createBiquadFilter();
        const cGain = this.ctx.createGain();
        cOsc.type = idx === 0 ? 'sine' : 'triangle';
        cFilter.type = 'lowpass';
        cFilter.frequency.setValueAtTime(isMenuGroove ? 820 : 1280, now);
        cFilter.frequency.exponentialRampToValueAtTime(480, now + holdDur);
        cOsc.frequency.setValueAtTime(freq, now);
        cGain.gain.setValueAtTime(0.0001, now);
        cGain.gain.linearRampToValueAtTime(peakGain, now + 0.016);
        cGain.gain.exponentialRampToValueAtTime(0.0001, now + holdDur);
        cOsc.connect(cFilter);
        cFilter.connect(cGain);
        cGain.connect(this.master);
        cOsc.start(now);
        cOsc.stop(now + holdDur + 0.02);
      });
    }

    // 3. Deep Sub-Funk Bassline (Warm filtered triangle with pocket rests)
    const activeBassPool = section >= 2 ? this.bassNotesB : this.bassNotesA;
    const bassFreq = activeBassPool[step % activeBassPool.length];
    if (bassFreq > 0) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isMenuGroove ? 340 : 520, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.16);
      osc.frequency.setValueAtTime(bassFreq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.12 * volScale, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.185);
    }

    // 4. Silky Brushed Hat & Warm Rim-Snare
    if (barStep % 2 === 0) {
      this.playNoiseBurst(0.022, 7200, (barStep % 4 === 2 ? 0.028 : 0.015) * volScale, 2.4);
    }
    if (barStep % 8 === 4) {
      this.playNoiseBurst(0.065, 1950, (isMenuGroove ? 0.04 : 0.075) * volScale, 1.5);
    }

    // 5. Rounded Marimba / Bell-Synth Lead Melody (Smooth sine+triangle, never harsh)
    const activeMelody =
      section === 0
        ? this.melodySectionA
        : section === 1
          ? this.melodySectionB
          : section === 2
            ? this.melodySectionC
            : this.melodySectionD;
    const noteFreq = activeMelody[step];
    if (noteFreq > 0 && (!isMenuGroove || step % 4 === 0)) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isMenuGroove ? 980 : superFlow ? 1850 : 1450, now);
      filter.frequency.exponentialRampToValueAtTime(620, now + 0.2);
      osc.frequency.setValueAtTime(isMenuGroove ? noteFreq * 0.5 : noteFreq, now);
      const leadPeak = isMenuGroove ? 0.026 : 0.044;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(leadPeak, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.225);

      const harmFreq = this.harmonyNotes[step];
      if (!isMenuGroove && (section === 1 || section === 3 || superFlow) && harmFreq > 0) {
        const hOsc = this.ctx.createOscillator();
        const hG = this.ctx.createGain();
        hOsc.type = 'sine';
        hOsc.frequency.setValueAtTime(harmFreq, now);
        hG.gain.setValueAtTime(0.0001, now);
        hG.gain.linearRampToValueAtTime(0.024, now + 0.012);
        hG.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        hOsc.connect(hG);
        hG.connect(this.master);
        hOsc.start(now);
        hOsc.stop(now + 0.195);
      }
    }

    // 6. Super-Flow Gentle Bell Shimmer
    if (superFlow && barStep % 2 === 0) {
      const arpFreq = this.arpNotes[this.stepIndex % this.arpNotes.length];
      const arpOsc = this.ctx.createOscillator();
      const arpG = this.ctx.createGain();
      arpOsc.type = 'sine';
      arpOsc.frequency.setValueAtTime(arpFreq, now);
      arpG.gain.setValueAtTime(0.0001, now);
      arpG.gain.linearRampToValueAtTime(0.018, now + 0.008);
      arpG.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      arpOsc.connect(arpG);
      arpG.connect(this.master);
      arpOsc.start(now);
      arpOsc.stop(now + 0.1);
    }

    this.stepIndex++;
  }

  playUiHover() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.028);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  playUiClick() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.055);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playUiSelect() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 880.0].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.032);
      g.gain.setValueAtTime(0.0001, now + idx * 0.032);
      g.gain.linearRampToValueAtTime(0.12, now + idx * 0.032 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.032 + 0.075);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.032);
      osc.stop(now + idx * 0.032 + 0.085);
    });
  }

  playUiBack() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.065);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }


  playDribbleTap() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.04);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playChargeTick(power = 0.5, inSweetSpot = false) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = inSweetSpot ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(inSweetSpot ? 880 : 340 + power * 420, now);
    g.gain.setValueAtTime(inSweetSpot ? 0.13 : 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (inSweetSpot ? 0.075 : 0.04));
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playPass(isCurved = false) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(215, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.095);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
    this.playNoiseBurst(0.045, 1650, 0.2);
    if (isCurved) {
      this.playCurveWhoosh();
    }
  }

  playCurveWhoosh() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
    this.playNoiseBurst(0.12, 2400, 0.18, 2.2);
  }

  playCatch(comboCount = 1) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const baseFreq = scale[Math.min(comboCount - 1, scale.length - 1)] || 440;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.09);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playShoot(isSuper = false) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isSuper ? 310 : 230, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
    g.gain.setValueAtTime(isSuper ? 0.62 : 0.48, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.27);

    this.playNoiseBurst(isSuper ? 0.19 : 0.11, isSuper ? 2200 : 1400, isSuper ? 0.42 : 0.26, 0.9);
    if (isSuper) {
      this.playCurveWhoosh();
    }
  }

  playPostClang() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [820, 1290, 1940].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === 1 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.32);
      g.gain.setValueAtTime(0.28 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  playNetSwish() {
    this.playNoiseBurst(0.24, 2900, 0.34, 1.8);
  }

  playKeeperSave() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(105, now + 0.15);
    g.gain.setValueAtTime(0.52, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
    this.playNoiseBurst(0.09, 950, 0.3);
  }

  playWallBounce() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(255, now);
    osc.frequency.exponentialRampToValueAtTime(84, now + 0.08);
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);

    // 16-bit metallic cage spark ping
    const ping = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1180, now);
    ping.frequency.exponentialRampToValueAtTime(640, now + 0.045);
    pg.gain.setValueAtTime(0.09, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    ping.connect(pg);
    pg.connect(this.master);
    ping.start(now);
    ping.stop(now + 0.055);
  }

  playTackle() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);
    this.playNoiseBurst(0.08, 800, 0.25);
  }

  playSwitch() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.setValueAtTime(860, now + 0.032);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playPerfectStrike() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 880.0, 1174.66, 1760.0].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.024);
      g.gain.setValueAtTime(0.28, now + idx * 0.024);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.024 + 0.22);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.024);
      osc.stop(now + idx * 0.024 + 0.24);
    });
  }

  playComboBonus() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      g.gain.setValueAtTime(0.26, now + idx * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.03);
      osc.stop(now + idx * 0.03 + 0.22);
    });
  }

  playGoal() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.playNetSwish();
    [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((freq, i) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, now + i * 0.052);
      osc.frequency.setValueAtTime(freq, now + i * 0.052);
      g.gain.setValueAtTime(0.3, now + i * 0.052);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.052 + 0.55);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now + i * 0.052);
      osc.stop(now + i * 0.052 + 0.58);
    });
    this.playNoiseBurst(0.95, 1100, 0.52, 0.8);
  }

  playWhistle() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2780, now);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(48, now);
    lfoGain.gain.setValueAtTime(140, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    g.gain.setValueAtTime(0.34, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.master);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.29);
    osc.stop(now + 0.29);
  }

  playMatchmakingTick(step = 0) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + (step % 3) * 80, now);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playMatchFound() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 880.0, 1174.66].forEach((freq, i) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      g.gain.setValueAtTime(0.28, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.24);
    });
  }

  playTournamentWin() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const fanfareNotes = [
      { f: 523.25, d: 0.0, len: 0.16 },  // C5
      { f: 659.25, d: 0.11, len: 0.16 }, // E5
      { f: 783.99, d: 0.22, len: 0.16 }, // G5
      { f: 1046.5, d: 0.33, len: 0.32 }, // C6
      { f: 987.77, d: 0.58, len: 0.16 }, // B5
      { f: 1046.5, d: 0.72, len: 0.65 }, // C6
      { f: 1318.5, d: 0.72, len: 0.65 }, // E6
      { f: 1567.98, d: 0.72, len: 0.75 }, // G6
    ];
    fanfareNotes.forEach(({ f, d, len }) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + d);
      gain.gain.setValueAtTime(0.0001, t + d);
      gain.gain.linearRampToValueAtTime(0.28, t + d + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + d);
      osc.stop(t + d + len + 0.03);
    });
    // Celebratory crowd & snare burst
    this.playNoiseBurst(0.55, 1600, 0.22, 1.2);
  }
}

/**
 * Triggers Gamepad haptic dual-rumble if a controller with vibrationActuator is connected.
 */
export function triggerGamepadRumble(durationMs = 70, weakMagnitude = 0.35, strongMagnitude = 0.6) {
  try {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i] as (Gamepad & {
        vibrationActuator?: {
          playEffect: (
            type: string,
            params: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number }
          ) => Promise<void>;
        };
      }) | null;
      if (gp && gp.connected && gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
        gp.vibrationActuator
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude,
            strongMagnitude,
          })
          .catch(() => {});
      }
    }
  } catch {
    // Ignore vibration API errors
  }
}
