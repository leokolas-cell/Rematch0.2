import React, { useEffect, useRef } from 'react';
import {
  PITCH,
  PASSES_FOR_FLOW_BOOST,
  SWEET_SPOT_MIN,
  SWEET_SPOT_MAX,
  MERCY_RULE_LEAD,
  MATCH_DURATION_SECONDS,
  TOURNAMENT_ROUNDS,
  TOTAL_TOURNAMENT_GAMES,
  GameMode,
  KitChoice,
  ControlGuideTab,
  getContrastingKit,
  getFlowPassBoost,
  computeTackleReach,
  computeKeeperTargetPosition,
  computePassCatchRadius,
  clampDeltaTime,
  isSweetSpotCharge,
  calculateFlowGain,
  pointToSegmentDistance,
  applyRadialDeadzone,
  formatMatchTimer,
  checkMatchEndCondition,
  evaluateKickDecisionPure,
  findBestReceiverForLooseBall,
  computeLaunchVelocityForCurve,
  computeShotSpinAndSpeed,
  computePassSpinAndSpeed,
} from './game/rules';
import { GRAPHICS_CONFIG, PITCH_THEMES, applyPitchTheme, type PitchThemeId } from './game/graphicsConfig';
import { IndieSoundEngine } from './game/soundEngine';
import {
  snapPx,
  fillPxRect,
  drawPixelPlayer,
  drawPixelKeeper,
  drawPixelBall,
  drawPixelGoal,
  drawPixelReticle,
  drawCurvedTrajectoryPreview,
} from './game/pixelRenderer';
import {
  PixelSoccerBallIcon,
  PixelFlameIcon,
  PixelMouseLeftIcon,
  PixelMouseRightIcon,
  PixelSoundOnIcon,
  PixelPauseIcon,
} from './game/PixelIcons';

declare global {
  interface Window {
    Tone?: {
      start: () => Promise<void>;
    };
    webkitAudioContext?: typeof AudioContext;
    GRAPHICS_CONFIG?: typeof GRAPHICS_CONFIG;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    window.GRAPHICS_CONFIG = GRAPHICS_CONFIG;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || '');

    const sound = new IndieSoundEngine();

    // Offscreen static 16-bit pixel stadium apron, bleachers, meadow flowers, turf & chalk line cache
    // Eliminates hundreds of per-frame fillRect calls for locked 60-144Hz butter-smooth performance
    const CACHE_PAD = 380;
    const pitchCacheCanvas = document.createElement('canvas');
    pitchCacheCanvas.width = PITCH.width + CACHE_PAD * 2;
    pitchCacheCanvas.height = PITCH.height + CACHE_PAD * 2;
    const pitchCacheCtx = pitchCacheCanvas.getContext('2d');

    function rebuildStaticPitchCache() {
      if (!pitchCacheCtx) return;
      pitchCacheCtx.imageSmoothingEnabled = false;
      const w = PITCH.width;
      const h = PITCH.height;
      const c = PITCH.cornerChamfer;
      const boxTop = (h - PITCH.boxHeight) / 2;
      const px = GRAPHICS_CONFIG.pixelPipeline.pixelSize;

      pitchCacheCtx.clearRect(0, 0, pitchCacheCanvas.width, pitchCacheCanvas.height);
      pitchCacheCtx.save();
      pitchCacheCtx.translate(CACHE_PAD, CACHE_PAD);

      // 1. Sunny Pastel Coastal Park Apron & Perimeter Track
      pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
      pitchCacheCtx.fillRect(-CACHE_PAD, -CACHE_PAD, w + CACHE_PAD * 2, h + CACHE_PAD * 2);

      // Subtle checkerboard pixel clusters on outer meadow
      pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
      for (let mx = -320; mx < w + 320; mx += 120) {
        for (let my = -280; my < h + 280; my += 120) {
          if (mx > -60 && mx < w + 60 && my > -60 && my < h + 60) continue;
          fillPxRect(pitchCacheCtx, mx, my, px * 4, px * 2, GRAPHICS_CONFIG.palette.apron.dither, px);
          fillPxRect(pitchCacheCtx, mx + px * 2, my - px * 2, px * 2, px * 2, GRAPHICS_CONFIG.palette.apron.dither, px);
        }
      }

      // Soft pastel running track around cage
      fillPxRect(pitchCacheCtx, -48, -48, w + 96, h + 96, GRAPHICS_CONFIG.palette.apron.outerBorder, px);
      fillPxRect(pitchCacheCtx, -40, -40, w + 80, h + 80, GRAPHICS_CONFIG.palette.apron.innerPath, px);

      // 2. Static Pastel Meadow Flowers on Outer Apron
      const flowerPalette = GRAPHICS_CONFIG.palette.apron.flowerColors;
      for (let i = 0; i < 48; i++) {
        const side = i % 4;
        let fx = 0;
        let fy = 0;
        if (side === 0) {
          fx = -220 + ((i * 37) % 130);
          fy = -100 + ((i * 173) % (h + 200));
        } else if (side === 1) {
          fx = w + 90 + ((i * 43) % 130);
          fy = -100 + ((i * 191) % (h + 200));
        } else if (side === 2) {
          fx = (i * 167) % w;
          fy = -210 + ((i * 29) % 60);
        } else {
          fx = (i * 181) % w;
          fy = h + 135 + ((i * 31) % 65);
        }
        const col = flowerPalette[i % flowerPalette.length];
        fillPxRect(pitchCacheCtx, fx, fy + px, px * 2, px * 2, '#34a86c', px);
        fillPxRect(pitchCacheCtx, fx - px, fy, px * 3, px * 2, col, px);
        fillPxRect(pitchCacheCtx, fx, fy - px, px * 2, px * 3, col, px);
        fillPxRect(pitchCacheCtx, fx, fy, px, px, '#fef08a', px);
      }

      // 3. Bright Pastel Stadium Bleachers Along Touchlines
      for (const by of [-126, h + 40]) {
        fillPxRect(pitchCacheCtx, 68, by - 4, w - 136, 68, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(pitchCacheCtx, 72, by, w - 144, 60, GRAPHICS_CONFIG.crowd.bleacherBase, px);
        fillPxRect(pitchCacheCtx, 76, by + 10, w - 152, 14, GRAPHICS_CONFIG.crowd.bleacherStep, px);
        fillPxRect(pitchCacheCtx, 76, by + 34, w - 152, 14, GRAPHICS_CONFIG.crowd.bleacherStep, px);
      }

      // 4. Clipped Chamfered Pitch Turf & Chalk Markings
      pitchCacheCtx.save();
      pitchCacheCtx.beginPath();
      pitchCacheCtx.moveTo(c, 0);
      pitchCacheCtx.lineTo(w - c, 0);
      pitchCacheCtx.lineTo(w, c);
      pitchCacheCtx.lineTo(w, h - c);
      pitchCacheCtx.lineTo(w - c, h);
      pitchCacheCtx.lineTo(c, h);
      pitchCacheCtx.lineTo(0, h - c);
      pitchCacheCtx.lineTo(0, c);
      pitchCacheCtx.closePath();
      pitchCacheCtx.clip();

      const stripeCount = GRAPHICS_CONFIG.pitch.stripeCount;
      const stripeW = w / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        const sx = i * stripeW;
        const isLight = i % 2 === 0;
        pitchCacheCtx.fillStyle = isLight
          ? GRAPHICS_CONFIG.pitch.grassLight
          : GRAPHICS_CONFIG.pitch.grassDark;
        pitchCacheCtx.fillRect(sx, 0, stripeW + 1, h);

        // 16-bit pixel dithered cross-hatch along each stripe seam
        pitchCacheCtx.fillStyle = isLight
          ? GRAPHICS_CONFIG.pitch.ditherDark
          : GRAPHICS_CONFIG.pitch.ditherLight;
        for (let dy = 12; dy < h - 12; dy += px * 6) {
          pitchCacheCtx.fillRect(Math.round(sx), dy, px, px * 2);
          pitchCacheCtx.fillRect(Math.round(sx + px * 2), dy + px * 3, px, px * 2);
        }
      }

      // Hand-crafted pixel grass tufts scattered across the turf
      for (let i = 0; i < 64; i++) {
        const tx = snapPx(95 + ((i * 197) % (w - 190)), px);
        const ty = snapPx(75 + ((i * 313) % (h - 150)), px);
        const tuftCol =
          i % 2 === 0 ? GRAPHICS_CONFIG.pitch.tuftLight : GRAPHICS_CONFIG.pitch.tuftDark;
        fillPxRect(pitchCacheCtx, tx, ty, px, px * 2, tuftCol, px);
        fillPxRect(pitchCacheCtx, tx + px * 2, ty - px, px, px * 3, tuftCol, px);
        fillPxRect(pitchCacheCtx, tx + px * 4, ty, px, px * 2, tuftCol, px);
      }

      // Crisp 16-bit stepped pixel chalk lines
      const lineCol = GRAPHICS_CONFIG.pitch.chalkLine;
      const lineW = px * 2;

      // Halfway line
      fillPxRect(pitchCacheCtx, w / 2 - lineW * 0.5, 0, lineW, h, lineCol, px);

      // Pixel-stepped Center Circle
      const circleR = 152;
      for (let i = 0; i < 76; i++) {
        const a = (i * Math.PI * 2) / 76;
        fillPxRect(
          pitchCacheCtx,
          w / 2 + Math.cos(a) * circleR - px,
          h / 2 + Math.sin(a) * circleR - px,
          px * 2,
          px * 2,
          lineCol,
          px
        );
      }
      // Center kickoff pixel diamond
      fillPxRect(pitchCacheCtx, w / 2 - 8, h / 2 - 8, 16, 16, lineCol, px);

      // Left & Right Penalty Boxes
      fillPxRect(pitchCacheCtx, 0, boxTop, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, 0, boxTop + PITCH.boxHeight - lineW, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, PITCH.boxWidth - lineW, boxTop, lineW, PITCH.boxHeight, lineCol, px);

      fillPxRect(pitchCacheCtx, w - PITCH.boxWidth, boxTop, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, w - PITCH.boxWidth, boxTop + PITCH.boxHeight - lineW, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, w - PITCH.boxWidth, boxTop, lineW, PITCH.boxHeight, lineCol, px);

      // Penalty box D-arcs (stepped pixel arcs)
      for (let i = -14; i <= 14; i++) {
        const aLeft = (i / 14) * Math.PI * 0.38;
        fillPxRect(
          pitchCacheCtx,
          PITCH.boxWidth + Math.cos(aLeft) * 95 - px,
          h / 2 + Math.sin(aLeft) * 95 - px,
          px * 2,
          px * 2,
          lineCol,
          px
        );
        const aRight = Math.PI + (i / 14) * Math.PI * 0.38;
        fillPxRect(
          pitchCacheCtx,
          w - PITCH.boxWidth + Math.cos(aRight) * 95 - px,
          h / 2 + Math.sin(aRight) * 95 - px,
          px * 2,
          px * 2,
          lineCol,
          px
        );
      }

      pitchCacheCtx.restore();
      pitchCacheCtx.restore();
    }

    rebuildStaticPitchCache();

    let viewScale = 1;
    let canvasOffsetY = 18;
    const cam = {
      x: PITCH.width * 0.5,
      y: PITCH.height * 0.5,
      zoom: 1.0,
    };

    interface CrowdFan {
      x: number;
      baseY: number;
      color: string;
      phase: number;
      isHome: boolean;
    }
    interface PitchFlower {
      x: number;
      y: number;
      color: string;
      size: number;
      phase: number;
    }
    interface NetNode {
      baseX: number;
      baseY: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
    }
    interface PlayerEntity {
      team: 'YOU' | 'AI';
      index: number;
      role: string;
      jerseyNum: number;
      hairColor: string;
      homeX: number;
      homeY: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      angle: number;
      baseSpeed: number;
      dribbleSpeed: number;
      speedBoostTimer: number;
      actionCooldown: number;
      lungeTimer: number;
      lungeDirX: number;
      lungeDirY: number;
      stunTimer: number;
      giveAndGoTimer: number;
      commandedRunTimer: number;
      commandedTargetX: number;
      commandedTargetY: number;
      tacticalTargetX: number;
      tacticalTargetY: number;
      runPhase: number;
      stridePhase: number;
      celebrateTimer: number;
      isOpenLane: boolean;
      scaleX: number;
      scaleY: number;
      aiDecisionTimer: number;
    }
    interface KeeperEntity {
      team: 'YOU' | 'AI';
      isAutoKeeper: boolean;
      homeX: number;
      homeY: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      angle: number;
      patrolSpeed: number;
      patrolPhase: number;
      diveTimer: number;
      diveCooldown: number;
      diveDirY: number;
      saveCooldown: number;
      holdTimer: number;
      holdingBall: boolean;
      scaleX: number;
      scaleY: number;
    }

    const crowdFans: CrowdFan[] = [];
    let crowdExcitement = 0;

    let lastFrameTime = performance.now();
    let dtScale = 1;
    let hitStopTimer = 0;
    let slowMoTimer = 0;

    type InternalGameState = 'SPLASH' | 'MENU' | 'PLAYING' | 'PAUSED' | 'GOAL_CELEBRATION' | 'MATCH_OVER';
    let gameState: InternalGameState = 'SPLASH';
    let hasDetectedTouchInput = false;

    function isCoarseTouchHardware(): boolean {
      return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse) and (hover: none)').matches
      );
    }

    function isMobileOrTabletViewport(): boolean {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return w < h || hasDetectedTouchInput || (isCoarseTouchHardware() && w <= 1366);
    }

    function shouldShowMobileTouchControls(): boolean {
      if (gameState !== 'PLAYING' && gameState !== 'GOAL_CELEBRATION') return false;
      const vsOverlay = document.getElementById('preMatchVsOverlay');
      const winOverlay = document.getElementById('tournamentWinOverlay');
      const menuOverlayEl = document.getElementById('menuOverlay');
      const splashEl = document.getElementById('splashScreen');
      if (vsOverlay && !vsOverlay.classList.contains('hidden')) return false;
      if (winOverlay && !winOverlay.classList.contains('hidden')) return false;
      if (menuOverlayEl && !menuOverlayEl.classList.contains('hidden')) return false;
      if (splashEl && !splashEl.classList.contains('hidden')) return false;

      if (hasDetectedTouchInput) return true;
      if (
        isCoarseTouchHardware() &&
        activeControlScheme !== 'MOUSE' &&
        activeControlScheme !== 'KEYBOARD' &&
        activeControlScheme !== 'GAMEPAD'
      ) {
        return true;
      }
      return false;
    }

    function syncMobileControlsVisibility() {
      const mobileControlsEl = document.getElementById('mobileControls');
      if (!mobileControlsEl) return;
      const showTouch = shouldShowMobileTouchControls();
      mobileControlsEl.classList.toggle('hidden', !showTouch);
      mobileControlsEl.classList.toggle('flex', showTouch);
      mobileControlsEl.style.display = showTouch ? 'flex' : 'none';
    }

    function syncBodyStateAttr(state: InternalGameState) {
      if (state === 'SPLASH' || state === 'MENU') document.body.dataset.state = 'title';
      else if (state === 'PLAYING' || state === 'GOAL_CELEBRATION') document.body.dataset.state = 'playing';
      else if (state === 'PAUSED') document.body.dataset.state = 'paused';
      else if (state === 'MATCH_OVER') document.body.dataset.state = 'gameover';

      const hudEl = document.getElementById('hud');
      const splashEl = document.getElementById('splashScreen');
      const homeMenuEl = document.getElementById('menuOverlay');
      const pauseEl = document.getElementById('pauseOverlay');

      const inActiveMatch = state === 'PLAYING' || state === 'PAUSED' || state === 'GOAL_CELEBRATION';
      if (hudEl) {
        hudEl.classList.toggle('hidden', !inActiveMatch);
      }
      if (splashEl) {
        splashEl.classList.toggle('hidden', state !== 'SPLASH');
      }
      if (homeMenuEl) {
        const showMenuOverlay = state === 'MENU' || state === 'PAUSED' || state === 'MATCH_OVER';
        homeMenuEl.classList.toggle('hidden', !showMenuOverlay);
      }
      if (pauseEl) {
        pauseEl.classList.toggle('hidden', state !== 'PAUSED');
      }
      syncMobileControlsVisibility();
    }
    syncBodyStateAttr('SPLASH');

    let currentGameMode: GameMode = 'CASUAL';
    let userKitChoice: KitChoice = 'HOME';
    let selectedPitchTheme: PitchThemeId = 'CLASSIC_TURF';
    let tournamentRound = 0; // 0 = Quarter-Final (Game 1), 1 = Semi-Final (Game 2), 2 = Grand Final (Game 3)

    // User Profile State (Name + Preset Icon or Camera Photo)
    interface UserProfile {
      name: string;
      iconType: 'preset' | 'photo';
      presetIcon: string;
      photoDataUrl: string | null;
    }

    const PRESET_ICONS: { id: string; label: string; html: string }[] = [
      { id: '#10', label: '#10 Playmaker', html: '<span class="font-mono-num font-black text-xs">#10</span>' },
      { id: 'STAR', label: 'All-Star', html: '<i class="fa-solid fa-star text-amber-300 text-sm"></i>' },
      { id: 'BOLT', label: 'Speedster', html: '<i class="fa-solid fa-bolt text-sky-200 text-sm"></i>' },
      { id: 'CROWN', label: 'King of the Cage', html: '<i class="fa-solid fa-crown text-amber-300 text-sm"></i>' },
      { id: 'FIRE', label: 'Super Flow', html: '<i class="fa-solid fa-fire-flame-curved text-orange-300 text-sm"></i>' },
      { id: 'TROPHY', label: 'Champion', html: '<i class="fa-solid fa-trophy text-amber-300 text-sm"></i>' },
    ];

    let userProfile: UserProfile = {
      name: 'Player',
      iconType: 'preset',
      presetIcon: '#10',
      photoDataUrl: null,
    };

    try {
      const saved = localStorage.getItem('rematch_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string') {
          userProfile = {
            name: parsed.name.trim().slice(0, 16) || 'Player',
            iconType: parsed.iconType === 'photo' && parsed.photoDataUrl ? 'photo' : 'preset',
            presetIcon: parsed.presetIcon || '#10',
            photoDataUrl: parsed.photoDataUrl || null,
          };
        }
      }
    } catch {
      // Ignore storage access errors
    }

    let activeCameraStream: MediaStream | null = null;

    function getProfileAvatarInnerHtml(prof: UserProfile, youIsHome: boolean): string {
      if (prof.iconType === 'photo' && prof.photoDataUrl) {
        return `<img src="${prof.photoDataUrl}" alt="${prof.name}" class="w-full h-full object-cover" />`;
      }
      const preset = PRESET_ICONS.find((p) => p.id === prof.presetIcon) || PRESET_ICONS[0];
      const stripeClass = youIsHome ? 'bg-amber-300' : 'bg-rose-900';
      const badgeClass = youIsHome ? 'bg-sky-700 text-white' : 'bg-rose-900 text-white';
      return `
        <div class="w-full h-1.5 ${stripeClass} absolute top-1/2 -translate-y-1/2"></div>
        <span class="relative z-10 ${badgeClass} px-1.5 py-0.5 rounded text-[11px] font-mono-num flex items-center justify-center">${preset.html}</span>
      `;
    }

    const MODE_PRESETS = {
      CASUAL: {
        cpuSpeed: 3.12,
        cpuDribble: 1.68,
        standOff: 225,
        tackleChance: 0.015,
        decisionDelay: 33,
        keeperSpeed: 1.74,
        passCreativity: 0.76,
        interceptScale: 0.88,
        rankLabel: 'Silver I',
        userRankLabel: 'Silver I',
      },
      RANKED: {
        cpuSpeed: 4.52,
        cpuDribble: 2.58,
        standOff: 112,
        tackleChance: 0.056,
        decisionDelay: 9,
        keeperSpeed: 2.38,
        passCreativity: 0.96,
        interceptScale: 1.20,
        rankLabel: 'Diamond I',
        userRankLabel: 'Diamond I',
      },
      TOURNAMENT_QF: {
        cpuSpeed: 3.52,
        cpuDribble: 1.92,
        standOff: 185,
        tackleChance: 0.024,
        decisionDelay: 22,
        keeperSpeed: 1.90,
        passCreativity: 0.82,
        interceptScale: 0.96,
        rankLabel: 'Gold II',
        userRankLabel: 'Gold II • Seed #1',
      },
      TOURNAMENT_SF: {
        cpuSpeed: 3.98,
        cpuDribble: 2.20,
        standOff: 150,
        tackleChance: 0.036,
        decisionDelay: 15,
        keeperSpeed: 2.08,
        passCreativity: 0.90,
        interceptScale: 1.06,
        rankLabel: 'Platinum I',
        userRankLabel: 'Platinum I • Seed #1',
      },
      TOURNAMENT_GF: {
        cpuSpeed: 4.45,
        cpuDribble: 2.52,
        standOff: 118,
        tackleChance: 0.052,
        decisionDelay: 10,
        keeperSpeed: 2.32,
        passCreativity: 0.95,
        interceptScale: 1.16,
        rankLabel: 'Star League',
        userRankLabel: 'Star League • Finalist',
      },
    };

    function getActiveDifficultyPreset() {
      if (currentGameMode === 'CASUAL') return MODE_PRESETS.CASUAL;
      if (currentGameMode === 'RANKED') return MODE_PRESETS.RANKED;
      if (tournamentRound === 0) return MODE_PRESETS.TOURNAMENT_QF;
      if (tournamentRound === 1) return MODE_PRESETS.TOURNAMENT_SF;
      return MODE_PRESETS.TOURNAMENT_GF;
    }

    const AVATAR_COLORS = [
      'bg-rose-500', 'bg-pink-500', 'bg-purple-500', 'bg-indigo-500',
      'bg-amber-500', 'bg-orange-500', 'bg-emerald-500', 'bg-teal-500', 'bg-fuchsia-500',
    ];

    const GAMER_TAGS = [
      'smithstreamer007', 'mentalcase', 'BrissieBaller', 'BondiCurve_99', 'KiwiTikiTaka',
      'Luca_10', 'KairoX', 'Zico_99', 'TikiTaka_7', 'VeloceFC', 'SunnyKicks',
      'Milo_Striker', 'JogaBonito', 'bananaboat', 'PixelPele', 'Rafa_Curl', 'NutmegKing', 'TopBinsOnly', 'Breezy_11',
      'KoopaKick', 'YoshiWing', 'AstroBoy_9', 'Mango_FC', 'Sora_Plays', 'FizzPop', 'Marley_07', 'TobyWan',
      'Kitsune_88', 'Zeph_10', 'OllieFlip', 'Coco_Striker', 'JettStream', 'NovaStar', 'BiscuitFC', 'Leo_Messy',
      'Dinho_10', 'WaffleKick', 'Pocky_7', 'Lachy_98', 'Sammy_G', 'Rory_14', 'FinnTheHuman', 'Cloud9_FC',
      'SaltyPretzel', 'TurboTaco', 'ChaiLatte', 'Niko_Bell', 'Zuzu_Plays', 'Kobe_24', 'Pippin_11',
    ];

    const RANKS = ['Bronze II', 'Silver I', 'Gold II', 'Platinum I', 'Star League'];
    const SERVERS = ['Sydney-1 [OCE]', 'Melbourne-2 [OCE]', 'Auckland-1 [OCE]'];

    const OCEANIA_PLAYERS = GAMER_TAGS.map((tag, idx) => {
      const clean = tag.replace(/[^a-zA-Z0-9]/g, '');
      const initials = clean.slice(0, 2).toUpperCase();
      return {
        tag,
        initials,
        rank: RANKS[idx % RANKS.length],
        mmr: 1120 + ((idx * 37) % 680),
        server: SERVERS[idx % SERVERS.length],
        basePing: 14 + ((idx * 7) % 24),
        badgeBg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
      };
    });

    let currentOpponent = OCEANIA_PLAYERS[0];
    let liveOppPing = 20;
    let isSearchingMatch = false;
    let hasMatchedOpponent = false;
    let matchmakingInterval: ReturnType<typeof setInterval> | null = null;
    let matchLaunchTimeout: ReturnType<typeof setTimeout> | null = null;
    const pitchFlowers: PitchFlower[] = [];

    interface TournamentBracketState {
      initialized: boolean;
      qfOpponent: (typeof OCEANIA_PLAYERS)[0];
      sfOpponent: (typeof OCEANIA_PLAYERS)[0];
      gfOpponent: (typeof OCEANIA_PLAYERS)[0];
      otherQfLoserB: (typeof OCEANIA_PLAYERS)[0];
      otherQfLoserC: (typeof OCEANIA_PLAYERS)[0];
      otherQfLoserD: (typeof OCEANIA_PLAYERS)[0];
      otherSfLoser: (typeof OCEANIA_PLAYERS)[0];
      scores: {
        qfYou: string;
        sfYou: string;
        gfYou: string;
      };
      totalGoalsYou: number;
      totalGoalsAi: number;
    }

    const tournamentBracket: TournamentBracketState = {
      initialized: false,
      qfOpponent: OCEANIA_PLAYERS[2],
      sfOpponent: OCEANIA_PLAYERS[3],
      gfOpponent: OCEANIA_PLAYERS[4],
      otherQfLoserB: OCEANIA_PLAYERS[5],
      otherQfLoserC: OCEANIA_PLAYERS[6],
      otherQfLoserD: OCEANIA_PLAYERS[7],
      otherSfLoser: OCEANIA_PLAYERS[8],
      scores: { qfYou: '', sfYou: '', gfYou: '' },
      totalGoalsYou: 0,
      totalGoalsAi: 0,
    };

    function initTournamentBracket() {
      const shuffled = [...OCEANIA_PLAYERS].sort(() => Math.random() - 0.5);
      const qfPool = shuffled.filter((p) => p.rank === 'Gold II');
      const sfPool = shuffled.filter((p) => p.rank === 'Platinum I');
      const gfPool = shuffled.filter((p) => p.rank === 'Star League');

      tournamentBracket.qfOpponent = qfPool[0] || shuffled[0];
      tournamentBracket.sfOpponent = sfPool[0] || shuffled[1];
      tournamentBracket.gfOpponent = gfPool[0] || shuffled[2];

      const usedTags = new Set([
        tournamentBracket.qfOpponent.tag,
        tournamentBracket.sfOpponent.tag,
        tournamentBracket.gfOpponent.tag,
      ]);
      const rest = shuffled.filter((p) => !usedTags.has(p.tag));
      tournamentBracket.otherQfLoserB = rest[0] || shuffled[3];
      tournamentBracket.otherQfLoserC = rest[1] || shuffled[4];
      tournamentBracket.otherQfLoserD = rest[2] || shuffled[5];
      tournamentBracket.otherSfLoser = rest[3] || shuffled[6];
      tournamentBracket.scores = { qfYou: '', sfYou: '', gfYou: '' };
      tournamentBracket.totalGoalsYou = 0;
      tournamentBracket.totalGoalsAi = 0;
      tournamentBracket.initialized = true;
    }

    function triggerScreenTransition(onMidpoint?: () => void) {
      const veil = document.getElementById('screenTransitionVeil');
      if (!veil) {
        if (onMidpoint) onMidpoint();
        return;
      }
      veil.classList.remove('pointer-events-none', 'opacity-0');
      veil.classList.add('opacity-100');
      setTimeout(() => {
        if (onMidpoint) onMidpoint();
        setTimeout(() => {
          veil.classList.remove('opacity-100');
          veil.classList.add('opacity-0', 'pointer-events-none');
        }, 60);
      }, 140);
    }

    function clearMatchmakingTimers() {
      if (matchmakingInterval) {
        clearInterval(matchmakingInterval);
        matchmakingInterval = null;
      }
      if (matchLaunchTimeout) {
        clearTimeout(matchLaunchTimeout);
        matchLaunchTimeout = null;
      }
      isSearchingMatch = false;
    }

    function syncProfileUI() {
      const youIsHome = userKitChoice === 'HOME';
      const menuNameEl = document.getElementById('menuProfileNameText');
      const menuAvatarImg = document.getElementById('menuProfileAvatarImg') as HTMLImageElement | null;
      const menuAvatarInitials = document.getElementById('menuProfileAvatarInitials');
      const mmYouAvatar = document.getElementById('mmYouAvatar');
      const mmYouTitle = document.getElementById('mmYouTitle');

      const initials =
        userProfile.name
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 2)
          .toUpperCase() || 'PL';

      if (menuNameEl) menuNameEl.innerText = userProfile.name;
      if (menuAvatarImg && menuAvatarInitials) {
        if (userProfile.iconType === 'photo' && userProfile.photoDataUrl) {
          menuAvatarImg.src = userProfile.photoDataUrl;
          menuAvatarImg.classList.remove('hidden');
          menuAvatarInitials.classList.add('hidden');
        } else {
          menuAvatarImg.classList.add('hidden');
          menuAvatarInitials.classList.remove('hidden');
          menuAvatarInitials.innerText = initials;
        }
      }

      if (mmYouAvatar) {
        mmYouAvatar.className = youIsHome
          ? 'w-14 h-14 rounded-2xl bg-sky-400 border-2 border-slate-900 text-slate-900 font-black text-xs flex flex-col items-center justify-center shadow-[0_3px_0_#0f172a] mb-2 relative overflow-hidden transition-colors'
          : 'w-14 h-14 rounded-2xl bg-rose-400 border-2 border-slate-900 text-white font-black text-xs flex flex-col items-center justify-center shadow-[0_3px_0_#0f172a] mb-2 relative overflow-hidden transition-colors';
        mmYouAvatar.innerHTML = getProfileAvatarInnerHtml(userProfile, youIsHome);
      }
      if (mmYouTitle) {
        mmYouTitle.innerText = `${userProfile.name} (${youIsHome ? 'Home Kit' : 'Away Kit'})`;
      }
    }

    function syncUserProfileUI() {
      syncProfileUI();
    }

    function syncKitAndModeUI() {
      const cpuKit = getContrastingKit(userKitChoice);
      const youIsHome = userKitChoice === 'HOME';

      // 1. Update Home Menu Kit Toggle Buttons
      const kitHomeBtn = document.getElementById('kitHomeBtn');
      const kitAwayBtn = document.getElementById('kitAwayBtn');
      if (kitHomeBtn && kitAwayBtn) {
        kitHomeBtn.className = youIsHome
          ? 'kit-btn min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex items-center justify-center gap-2'
          : 'kit-btn min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer bg-slate-100 text-slate-600 hover:text-slate-900 border-2 border-slate-300 flex items-center justify-center gap-2';
        kitAwayBtn.className = !youIsHome
          ? 'kit-btn min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer bg-rose-400 text-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex items-center justify-center gap-2'
          : 'kit-btn min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer bg-slate-100 text-slate-600 hover:text-slate-900 border-2 border-slate-300 flex items-center justify-center gap-2';
      }

      // 2. Update Player Card in Home Menu (Rank shown on Ranked & Tournament; hidden on Casual)
      syncProfileUI();
      const preset = getActiveDifficultyPreset();
      const mmYouPill = document.getElementById('mmYouPill');
      const mmYouDot = document.getElementById('mmYouDot');
      const mmYouMeta = document.getElementById('mmYouMeta');

      if (mmYouPill) {
        mmYouPill.className = youIsHome
          ? 'inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-[11px] font-extrabold text-sky-800'
          : 'inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-[11px] font-extrabold text-rose-800';
      }
      if (mmYouDot) {
        mmYouDot.className = youIsHome ? 'w-2 h-2 rounded-full bg-sky-500' : 'w-2 h-2 rounded-full bg-rose-500';
      }
      if (mmYouMeta) {
        mmYouMeta.innerText =
          currentGameMode === 'CASUAL'
            ? youIsHome
              ? 'Home Kit (Sky)'
              : 'Away Kit (Coral)'
            : preset.userRankLabel;
      }

      // 3. Update Top HUD Scoreboard Pills so HUD matches chosen kit & contrasting CPU kit
      const hudYouPill = document.getElementById('hudYouPill');
      const hudAiPill = document.getElementById('hudAiPill');
      if (hudYouPill) {
        hudYouPill.className = youIsHome
          ? 'flex items-center space-x-1.5 sm:space-x-2 bg-sky-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors'
          : 'flex items-center space-x-1.5 sm:space-x-2 bg-rose-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors';
      }
      if (hudAiPill) {
        hudAiPill.className = cpuKit === 'AWAY'
          ? 'flex items-center space-x-1.5 sm:space-x-2 bg-rose-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors'
          : 'flex items-center space-x-1.5 sm:space-x-2 bg-sky-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors';
      }

      // 4. Update Tournament Knockout Bracket UI
      const bracketWrap = document.getElementById('tournamentBracketWrap');
      const hudTourneyBadge = document.getElementById('hudTourneyBadge');
      if (currentGameMode === 'TOURNAMENT') {
        if (bracketWrap) {
          bracketWrap.classList.remove('hidden');
          bracketWrap.className = 'mt-3 grid grid-cols-3 gap-2';
        }
        if (hudTourneyBadge) {
          hudTourneyBadge.classList.remove('hidden');
          hudTourneyBadge.innerText = `CUP ${tournamentRound + 1}/${TOTAL_TOURNAMENT_GAMES} · ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()}`;
        }
        for (let r = 0; r < TOTAL_TOURNAMENT_GAMES; r++) {
          const stepEl = document.getElementById(`tourneyStep${r}`);
          if (!stepEl) continue;
          if (r < tournamentRound) {
            stepEl.className = 'min-w-0 py-2 px-2 rounded-xl bg-emerald-400 border-2 border-slate-900 text-slate-900 font-black text-[10px] sm:text-xs flex items-center justify-center text-center truncate';
          } else if (r === tournamentRound) {
            stepEl.className = 'min-w-0 py-2 px-2 rounded-xl bg-amber-300 border-2 border-slate-900 text-slate-900 font-black text-[10px] sm:text-xs shadow-[0_2px_0_#0f172a] flex items-center justify-center text-center truncate';
          } else {
            stepEl.className = 'min-w-0 py-2 px-2 rounded-xl bg-white border border-slate-300 text-slate-500 font-bold text-[10px] sm:text-xs flex items-center justify-center text-center truncate';
          }
        }
      } else {
        if (bracketWrap) bracketWrap.classList.add('hidden');
        if (hudTourneyBadge) hudTourneyBadge.classList.add('hidden');
      }
    }

    function setMatchmakingIdleUI() {
      clearMatchmakingTimers();
      hasMatchedOpponent = false;
      syncKitAndModeUI();

      const cpuWearsAway = getContrastingKit(userKitChoice) === 'AWAY';
      const card = document.getElementById('matchmakingCard');
      const statusLabel = document.getElementById('mmStatusLabel');
      const statusIcon = document.getElementById('mmStatusIcon');
      const statusText = document.getElementById('mmStatusText');
      const searchTimer = document.getElementById('mmSearchTimer');
      const oppCard = document.getElementById('mmOpponentSlotCard');
      const mmName = document.getElementById('mmOpponentName');
      const mmAvatar = document.getElementById('mmOpponentAvatar');
      const mmPingPill = document.getElementById('mmOpponentPingPill');
      const progressWrap = document.getElementById('mmProgressWrap');
      const vsBadge = document.getElementById('mmVsBadge');
      const startBtnEl = document.getElementById('startBtn');
      const startBtnTextEl = document.getElementById('startBtnText');
      const startIconEl = document.getElementById('startBtnIcon');
      const vsOverlay = document.getElementById('preMatchVsOverlay');
      if (vsOverlay) vsOverlay.classList.add('hidden');

      if (card) card.className = 'lg:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
      if (statusLabel) statusLabel.className = 'flex items-center space-x-2 text-slate-800 transition-colors';
      if (statusIcon) statusIcon.className = 'fa-solid fa-trophy text-amber-500 text-xs';
      if (statusText) {
        statusText.innerText =
          currentGameMode === 'TOURNAMENT'
            ? `Knockout Cup • ${TOURNAMENT_ROUNDS[tournamentRound]} (Game ${tournamentRound + 1}/3)`
            : currentGameMode === 'RANKED'
              ? 'Ranked 1v1 Matchmaking'
              : 'Casual 1v1 Matchmaking';
      }
      if (searchTimer) searchTimer.classList.add('hidden');
      if (oppCard) {
        oppCard.className = cpuWearsAway
          ? 'bg-gradient-to-b from-rose-50 to-white rounded-2xl p-3.5 sm:p-4 border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-center transition-all duration-300 min-w-0'
          : 'bg-gradient-to-b from-sky-50 to-white rounded-2xl p-3.5 sm:p-4 border-2 border-dashed border-sky-300 flex flex-col items-center justify-center text-center transition-all duration-300 min-w-0';
      }
      if (mmName) {
        mmName.innerText = 'Searching Slot';
        mmName.className = cpuWearsAway
          ? 'text-xs sm:text-sm font-black text-rose-500 truncate max-w-full px-1'
          : 'text-xs sm:text-sm font-black text-sky-600 truncate max-w-full px-1';
      }
      if (mmAvatar) {
        mmAvatar.innerHTML = '<i class="fa-solid fa-user-astronaut text-base"></i>';
        mmAvatar.className = cpuWearsAway
          ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-100/80 border-2 border-dashed border-rose-300 text-rose-500 font-black text-base flex items-center justify-center mb-2 relative transition-all duration-300 shrink-0'
          : 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-100/80 border-2 border-dashed border-sky-300 text-sky-600 font-black text-base flex items-center justify-center mb-2 relative transition-all duration-300 shrink-0';
      }
      if (mmPingPill) {
        mmPingPill.innerHTML = `<span class="truncate">${cpuWearsAway ? 'Away Kit (Coral)' : 'Home Kit (Sky)'}</span>`;
        mmPingPill.className = cpuWearsAway
          ? 'inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-[10px] sm:text-[11px] font-extrabold text-rose-800 max-w-full'
          : 'inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-[10px] sm:text-[11px] font-extrabold text-sky-800 max-w-full';
      }
      if (vsBadge) vsBadge.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-300 text-slate-900 text-xs font-black flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-300';
      if (progressWrap) progressWrap.classList.add('hidden');
      if (startBtnEl) {
        startBtnEl.classList.remove('hidden');
        startBtnEl.removeAttribute('disabled');
        startBtnEl.className = 'indie-cta-btn w-full min-h-[52px] py-3.5 sm:py-4 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm sm:text-lg tracking-wide cursor-pointer flex items-center justify-center space-x-3';
      }
      if (startBtnTextEl) {
        startBtnTextEl.innerText =
          currentGameMode === 'TOURNAMENT'
            ? `FIND ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} MATCH`
            : currentGameMode === 'RANKED'
              ? 'FIND RANKED MATCH'
              : 'FIND CASUAL MATCH';
      }
      if (startIconEl) startIconEl.className = 'fa-solid fa-play text-sm';
    }

    function syncOpponentUi() {
      syncKitAndModeUI();
      const cpuWearsAway = getContrastingKit(userKitChoice) === 'AWAY';
      const tagHud = document.getElementById('opponentTagHud');
      const mmName = document.getElementById('mmOpponentName');
      const mmAvatar = document.getElementById('mmOpponentAvatar');
      const mmPingPill = document.getElementById('mmOpponentPingPill');
      const oppCard = document.getElementById('mmOpponentSlotCard');
      const pauseOppName = document.getElementById('pauseOpponentName');

      if (tagHud) tagHud.innerText = currentOpponent.tag;
      if (pauseOppName) pauseOppName.innerText = currentOpponent.tag;
      if (!hasMatchedOpponent) return;

      if (oppCard) {
        oppCard.className = cpuWearsAway
          ? 'bg-gradient-to-b from-rose-100 to-rose-50 rounded-2xl p-4 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex flex-col items-center justify-center text-center transition-all duration-300 mm-pop'
          : 'bg-gradient-to-b from-sky-100 to-sky-50 rounded-2xl p-4 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex flex-col items-center justify-center text-center transition-all duration-300 mm-pop';
      }
      if (mmName) {
        mmName.innerText = currentOpponent.tag;
        mmName.className = 'text-sm font-black text-slate-900 truncate max-w-[140px]';
      }
      if (mmPingPill) {
        // Show rank ONLY in Ranked and Tournament modes; on Casual mode show kit only
        const oppBadgeLabel =
          currentGameMode === 'CASUAL'
            ? cpuWearsAway
              ? 'Away Kit (Coral)'
              : 'Home Kit (Sky)'
            : currentOpponent.rank;
        mmPingPill.innerHTML = `<span>${oppBadgeLabel}</span>`;
        mmPingPill.className = cpuWearsAway
          ? 'inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-white border border-rose-200 text-[11px] font-extrabold text-rose-700'
          : 'inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-white border border-sky-200 text-[11px] font-extrabold text-sky-700';
      }
      if (mmAvatar) {
        mmAvatar.innerText = currentOpponent.initials;
        mmAvatar.className = cpuWearsAway
          ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-500 border-2 border-slate-900 text-white font-black text-base flex items-center justify-center shadow-[0_3px_0_#0f172a] mb-2'
          : 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-500 border-2 border-slate-900 text-white font-black text-base flex items-center justify-center shadow-[0_3px_0_#0f172a] mb-2';
      }
    }

    function pickRandomOpponent(excludeCurrent = true) {
      if (currentGameMode === 'TOURNAMENT') {
        if (tournamentRound === 0 || !tournamentBracket.initialized) {
          initTournamentBracket();
        }
        currentOpponent =
          tournamentRound === 0
            ? tournamentBracket.qfOpponent
            : tournamentRound === 1
              ? tournamentBracket.sfOpponent
              : tournamentBracket.gfOpponent;
        liveOppPing = currentOpponent.basePing + Math.floor(Math.random() * 5) - 2;
        hasMatchedOpponent = true;
        syncOpponentUi();
        return;
      }

      const preset = getActiveDifficultyPreset();
      const rankFiltered = OCEANIA_PLAYERS.filter(
        (p) => (!excludeCurrent || p.tag !== currentOpponent.tag) && p.rank === preset.rankLabel
      );
      const pool =
        rankFiltered.length > 0
          ? rankFiltered
          : excludeCurrent
            ? OCEANIA_PLAYERS.filter((p) => p.tag !== currentOpponent.tag)
            : OCEANIA_PLAYERS;
      currentOpponent = pool[Math.floor(Math.random() * pool.length)];
      liveOppPing = currentOpponent.basePing + Math.floor(Math.random() * 5) - 2;
      hasMatchedOpponent = true;
      syncOpponentUi();
    }

    const pingInterval = setInterval(() => {
      liveOppPing = Math.max(14, currentOpponent.basePing + Math.floor((Math.random() - 0.5) * 4));
    }, 2000);

    let scoreYou = 0;
    let scoreAi = 0;
    let matchTime = MATCH_DURATION_SECONDS;
    let isGoldenGoal = false;
    let matchTick = 0;

    let flowCombo = 0;
    let cpuPassCombo = 0;
    let maxFlowCombo = 0;
    let totalPassesYou = 0;
    let totalShotsYou = 0;
    let possessionFramesYou = 1;
    let possessionFramesTotal = 2;

    let goalBannerTimer = 0;
    let goalScorerTeam: 'YOU' | 'AI' | '' = '';
    let goalBannerText = '';
    let goalBannerSub = '';
    let screenShake = 0;
    let stadiumFlashAlpha = 0;
    let dribbleSoundTimer = 0;

    let ledBannerMessage = 'REMATCH 0.2 • 3 PASSES = SUPER FLOW';
    let ledBannerTimer = 0;

    interface RippleVfx { x: number; y: number; r: number; maxR: number; alpha: number; color: string; }
    interface ParticleVfx { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string; }
    interface FloatingTextVfx { x: number; y: number; text: string; color: string; vy: number; alpha: number; scale: number; }
    interface WallGlowVfx { x1: number; y1: number; x2: number; y2: number; alpha: number; }
    interface TurfScuffVfx { x: number; y: number; angle: number; alpha: number; color: string; }
    interface AfterimageVfx { x: number; y: number; radius: number; team: 'YOU' | 'AI'; alpha: number; }
    interface ConfettiVfx { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vRot: number; alpha: number; color: string; }

    const ripples: RippleVfx[] = [];
    const particles: ParticleVfx[] = [];
    const floatingTexts: FloatingTextVfx[] = [];
    const wallGlows: WallGlowVfx[] = [];
    const turfScuffs: TurfScuffVfx[] = [];
    const afterimages: AfterimageVfx[] = [];
    const confetti: ConfettiVfx[] = [];

    let netNodesLeft: NetNode[] = [];
    let netNodesRight: NetNode[] = [];

    function initGoalNets() {
      netNodesLeft = [];
      netNodesRight = [];
      const steps = 12;
      const goalTop = (PITCH.height - PITCH.goalWidth) / 2;
      for (let i = 0; i <= steps; i++) {
        const y = goalTop + (PITCH.goalWidth * i) / steps;
        netNodesLeft.push({ baseX: -PITCH.goalDepth, baseY: y, x: -PITCH.goalDepth, y, vx: 0, vy: 0 });
        netNodesRight.push({ baseX: PITCH.width + PITCH.goalDepth, baseY: y, x: PITCH.width + PITCH.goalDepth, y, vx: 0, vy: 0 });
      }

      if (crowdFans.length === 0) {
        const homeColors = ['#38bdf8', '#60a5fa', '#fde047', '#a7f3d0', '#fef08a'];
        const awayColors = ['#fb7185', '#fda4af', '#f472b6', '#fcd34d', '#ffffff'];
        for (let row = 0; row < 2; row++) {
          const topY = -82 - row * 28;
          const botY = PITCH.height + 54 + row * 28;
          for (let x = 110; x <= PITCH.width - 110; x += 48) {
            if (row === 0 && x > PITCH.width * 0.23 && x < PITCH.width * 0.77) continue;
            const isHomeSide = x < PITCH.width * 0.5;
            const palette = isHomeSide ? homeColors : awayColors;
            crowdFans.push({
              x: x + (Math.random() - 0.5) * 10,
              baseY: topY,
              color: palette[Math.floor(Math.random() * palette.length)],
              phase: Math.random() * Math.PI * 2,
              isHome: isHomeSide,
            });
            crowdFans.push({
              x: x + (Math.random() - 0.5) * 10,
              baseY: botY,
              color: palette[Math.floor(Math.random() * palette.length)],
              phase: Math.random() * Math.PI * 2,
              isHome: isHomeSide,
            });
          }
        }
      }

      if (pitchFlowers.length === 0) {
        const flowerPalette = ['#fef08a', '#fbcfe8', '#bae6fd', '#ddd6fe', '#fed7aa'];
        for (let i = 0; i < 42; i++) {
          const side = i % 4;
          let fx = 0;
          let fy = 0;
          if (side === 0) { fx = -190 + Math.random() * 95; fy = -120 + Math.random() * (PITCH.height + 240); }
          else if (side === 1) { fx = PITCH.width + 95 + Math.random() * 95; fy = -120 + Math.random() * (PITCH.height + 240); }
          else if (side === 2) { fx = Math.random() * PITCH.width; fy = -195 + Math.random() * 55; }
          else { fx = Math.random() * PITCH.width; fy = PITCH.height + 125 + Math.random() * 65; }
          pitchFlowers.push({
            x: fx,
            y: fy,
            color: flowerPalette[i % flowerPalette.length],
            size: 4 + (i % 3) * 1.4,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    function triggerNetImpact(isLeftGoal: boolean, impactY: number, impactVx: number, impactVy: number) {
      const nodes = isLeftGoal ? netNodesLeft : netNodesRight;
      for (let i = 1; i < nodes.length - 1; i++) {
        const nd = nodes[i];
        const distY = Math.abs(nd.baseY - impactY);
        if (distY < 165) {
          const falloff = Math.pow(1 - distY / 165, 1.4);
          nd.vx += impactVx * falloff * 1.55;
          nd.vy += impactVy * falloff * 0.65;
        }
      }
    }

    function updateGoalNets() {
      const updateSide = (nodes: NetNode[]) => {
        for (let i = 1; i < nodes.length - 1; i++) {
          const n = nodes[i];
          const kSpring = 0.14;
          const fx = (n.baseX - n.x) * kSpring;
          const fy = (n.baseY - n.y) * kSpring;
          n.vx = (n.vx + fx * dtScale) * 0.84;
          n.vy = (n.vy + fy * dtScale) * 0.84;
          n.x += n.vx * dtScale;
          n.y += n.vy * dtScale;
        }
      };
      updateSide(netNodesLeft);
      updateSide(netNodesRight);
    }

    let players: PlayerEntity[] = [];
    let keepers: KeeperEntity[] = [];
    let controlledPlayer: PlayerEntity | null = null;

    const kickChargeState = { active: false, power: 0, soundTick: 0 };

    const ball = {
      x: PITCH.width / 2,
      y: PITCH.height / 2,
      vx: 0,
      vy: 0,
      spin: 0,
      rotAngle: 0,
      height: 0,
      vz: 0,
      radius: 10.5,
      owner: null as PlayerEntity | null,
      passTarget: null as PlayerEntity | null,
      passTargetX: PITCH.width / 2,
      passTargetY: PITCH.height / 2,
      isThroughBall: false,
      isShot: false,
      isOneTouch: false,
      isSuperStrike: false,
      isPerfectStrike: false,
      wasWallBounce: false,
      passCounted: false,
      threadedBonusGiven: false,
      lastTouchTeam: 'YOU' as 'YOU' | 'AI',
      lastTouchPlayer: null as PlayerEntity | null,
      pickupCooldown: 0,
      trail: [] as { x: number; y: number; r: number; alpha: number; gold: boolean }[],
    };

    const keys: Record<string, boolean> = {};
    type ControlScheme = 'MOUSE' | 'KEYBOARD' | 'JOYSTICK' | 'GAMEPAD';
    let activeControlScheme: ControlScheme = 'MOUSE';
    let activeControlGuideTab: ControlGuideTab = 'COMPUTER';
    let hasUsedKeyboardMove = false;

    const mouseState = {
      screenX: window.innerWidth * 0.5,
      screenY: window.innerHeight * 0.5,
      worldX: PITCH.width * 0.5,
      worldY: PITCH.height * 0.5,
      active: false,
      isDown: false,
      moveTimer: 0,
    };

    const joyVec = { x: 0, y: 0, active: false, pointerId: -1 };
    const gamepadState = {
      moveX: 0,
      moveY: 0,
      moveActive: false,
      aimX: 1,
      aimY: 0,
      aimActive: false,
      prevPrimaryDown: false,
      prevSecondaryDown: false,
      prevStartDown: false,
      prevNavUp: false,
      prevNavDown: false,
      prevNavLeft: false,
      prevNavRight: false,
      prevL1Down: false,
      prevR1Down: false,
      prevTriangleDown: false,
      connectedName: '',
      focusedMenuIndex: 0,
    };

    function triggerControllerRumble(durationMs = 45, weakMag = 0.25, strongMag = 0.15) {
      if (typeof navigator.getGamepads !== 'function') return;
      try {
        const pads = navigator.getGamepads();
        if (!pads) return;
        for (let i = 0; i < pads.length; i++) {
          const pad = pads[i] as (Gamepad & {
            vibrationActuator?: {
              playEffect?: (
                type: string,
                params: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number }
              ) => Promise<void>;
            };
          }) | null;
          if (pad && pad.connected && pad.vibrationActuator && typeof pad.vibrationActuator.playEffect === 'function') {
            pad.vibrationActuator
              .playEffect('dual-rumble', {
                startDelay: 0,
                duration: durationMs,
                weakMagnitude: weakMag,
                strongMagnitude: strongMag,
              })
              .catch(() => {});
            break;
          }
        }
      } catch {}
    }

    let queuedOneTouchTimer = 0;
    let queuedOneTouchAim = { x: 1, y: 0 };

    function makePlayer(team: 'YOU' | 'AI', index: number, x: number, y: number, role: string, jerseyNum: number): PlayerEntity {
      const isYou = team === 'YOU';
      const preset = getActiveDifficultyPreset();
      const hairColors = ['#1e293b', '#78350f', '#f59e0b', '#0f172a', '#b45309', '#334155'];
      return {
        team, index, role, jerseyNum,
        hairColor: hairColors[(index + (isYou ? 0 : 3)) % hairColors.length],
        homeX: x, homeY: y, x, y, vx: 0, vy: 0,
        radius: 16.5, angle: isYou ? 0 : Math.PI,
        baseSpeed: isYou ? 5.12 : preset.cpuSpeed,
        dribbleSpeed: isYou ? 4.98 : preset.cpuDribble,
        speedBoostTimer: 0, actionCooldown: 0, lungeTimer: 0,
        lungeDirX: 0, lungeDirY: 0, stunTimer: 0, giveAndGoTimer: 0,
        commandedRunTimer: 0, commandedTargetX: x, commandedTargetY: y,
        tacticalTargetX: x, tacticalTargetY: y,
        runPhase: index * 2.1 + (isYou ? 0 : 1.4),
        stridePhase: Math.random() * Math.PI * 2,
        celebrateTimer: 0,
        isOpenLane: false, scaleX: 1, scaleY: 1,
        aiDecisionTimer: 0,
      };
    }

    function makeAutoKeeper(team: 'YOU' | 'AI'): KeeperEntity {
      const isYou = team === 'YOU';
      const homeX = isYou ? 42 : PITCH.width - 42;
      const preset = getActiveDifficultyPreset();
      return {
        team, isAutoKeeper: true, homeX, homeY: PITCH.height / 2,
        x: homeX, y: PITCH.height / 2, vx: 0, vy: 0,
        radius: 13.5, angle: isYou ? 0 : Math.PI,
        patrolSpeed: isYou ? 2.08 : preset.keeperSpeed,
        patrolPhase: isYou ? 0 : Math.PI,
        diveTimer: 0, diveCooldown: 0, diveDirY: 0, saveCooldown: 0,
        holdTimer: 0, holdingBall: false, scaleX: 1, scaleY: 1,
      };
    }

    function applyDifficultySettings() {
      const preset = getActiveDifficultyPreset();
      players.forEach((p) => {
        if (p.team === 'AI') {
          p.baseSpeed = preset.cpuSpeed;
          p.dribbleSpeed = preset.cpuDribble;
        }
      });
      keepers.forEach((k) => {
        if (k.team === 'AI') {
          k.patrolSpeed = preset.keeperSpeed;
        }
      });
    }

    function createTeams() {
      initGoalNets();
      players = [
        makePlayer('YOU', 0, PITCH.width * 0.20, PITCH.height * 0.50, 'ANCHOR', 4),
        makePlayer('YOU', 1, PITCH.width * 0.39, PITCH.height * 0.17, 'WING_TOP', 7),
        makePlayer('YOU', 2, PITCH.width * 0.39, PITCH.height * 0.83, 'WING_BOT', 10),

        makePlayer('AI', 0, PITCH.width * 0.80, PITCH.height * 0.50, 'ANCHOR', 5),
        makePlayer('AI', 1, PITCH.width * 0.61, PITCH.height * 0.17, 'WING_TOP', 8),
        makePlayer('AI', 2, PITCH.width * 0.61, PITCH.height * 0.83, 'WING_BOT', 9),
      ];
      keepers = [makeAutoKeeper('YOU'), makeAutoKeeper('AI')];
      controlledPlayer = players[2];
    }

    function resizeCanvas() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const isPortrait = w < h;
      const isMobileOrTablet = isMobileOrTabletViewport();

      if (isPortrait) {
        // Portrait phone & tablet: shift pitch slightly above the bottom thumb controls & zoom for crisp readability
        const isTabletPortrait = w >= 600;
        canvasOffsetY = -Math.round(Math.min(68, h * (isTabletPortrait ? 0.055 : 0.075)));
        const availH = h - (isTabletPortrait ? 200 : 190);
        const pitchFractionX = isTabletPortrait ? 0.58 : 0.44;
        const pitchFractionY = isTabletPortrait ? 0.76 : 0.72;
        viewScale = Math.max(
          isTabletPortrait ? 0.46 : 0.39,
          Math.min(w / (PITCH.width * pitchFractionX), availH / (PITCH.height * pitchFractionY))
        );
      } else if (isMobileOrTablet) {
        // Landscape phone & tablet: generous stadium framing with clearance for top HUD & corner thumb controls
        const isCompactPhoneLandscape = h <= 540;
        canvasOffsetY = isCompactPhoneLandscape ? 6 : 12;
        const pitchFractionX = isCompactPhoneLandscape ? 0.68 : 0.82;
        const pitchFractionY = isCompactPhoneLandscape ? 0.72 : 0.82;
        const scaleX = (w - (isCompactPhoneLandscape ? 12 : 36)) / (PITCH.width * pitchFractionX);
        const scaleY = (h - (isCompactPhoneLandscape ? 16 : 64)) / (PITCH.height * pitchFractionY);
        viewScale = Math.max(isCompactPhoneLandscape ? 0.34 : 0.44, Math.min(scaleX, scaleY));
      } else {
        // Desktop widescreen
        canvasOffsetY = 20;
        const padX = 76;
        const padY = 132;
        const scaleX = (w - padX) / PITCH.width;
        const scaleY = (h - padY) / PITCH.height;
        viewScale = Math.max(0.18, Math.min(scaleX, scaleY));
      }
      syncBodyStateAttr(gameState);
      updateMouseWorldCoords();
    }

    window.addEventListener('resize', resizeCanvas);

    function updateMouseWorldCoords() {
      if (!canvas) return;
      const effScale = viewScale * cam.zoom;
      mouseState.worldX = cam.x + (mouseState.screenX - canvas.width * 0.5) / effScale;
      mouseState.worldY = cam.y + (mouseState.screenY - (canvas.height * 0.5 + canvasOffsetY)) / effScale;
    }

    function updateFlowHud() {
      const dot1 = document.getElementById('passDot1');
      const dot2 = document.getElementById('passDot2');
      const dot3 = document.getElementById('passDot3');
      const flowVal = document.getElementById('flowVal');
      const flowBadge = document.getElementById('flowBadge');

      const charged = flowCombo >= PASSES_FOR_FLOW_BOOST;
      const dots = [dot1, dot2, dot3];
      dots.forEach((d, idx) => {
        if (!d) return;
        if (flowCombo > idx) {
          d.className = charged
            ? 'w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm transition-all duration-200 scale-110'
            : 'w-2.5 h-2.5 rounded-full bg-blue-600 transition-all duration-200';
        } else {
          d.className = 'w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-200';
        }
      });

      if (flowVal) {
        flowVal.innerText = charged ? `SUPER x${flowCombo}` : `FLOW x${flowCombo}`;
        flowVal.className = charged
          ? 'font-mono-num text-[10px] sm:text-xs font-extrabold text-amber-600 whitespace-nowrap'
          : 'font-mono-num text-[10px] sm:text-xs font-extrabold text-slate-800 whitespace-nowrap';
      }
      if (flowBadge) {
        flowBadge.style.boxShadow = charged
          ? '0 0 0 2px rgba(251, 191, 36, 0.75), 0 10px 25px -5px rgba(245, 158, 11, 0.28)'
          : '';
      }
    }

    function isTeamInPossession(team: 'YOU' | 'AI') {
      if (ball.owner && ball.owner.team === team) return true;
      if (!ball.owner && ball.passTarget && ball.passTarget.team === team) return true;
      if (!ball.owner && ball.lastTouchTeam === team && !ball.isShot) return true;
      const myKeeper = keepers.find((k) => k.team === team);
      return Boolean(myKeeper && myKeeper.holdingBall);
    }

    let lastHudStateSignature = '';

    function updateHudState() {
      const inPoss = isTeamInPossession('YOU');
      const charged = flowCombo >= PASSES_FOR_FLOW_BOOST;
      const sig = `${inPoss ? '1' : '0'}:${charged ? '1' : '0'}:${activeControlScheme}:${currentOpponent.tag}:${userKitChoice}`;
      if (sig === lastHudStateSignature) return;
      lastHudStateSignature = sig;

      const dot = document.getElementById('possessionDot');
      const text = document.getElementById('possessionText');
      const mobileActionText = document.getElementById('mobileActionText');
      const mobileSecondaryText = document.getElementById('mobileSecondaryText');

      if (inPoss) {
        if (dot) dot.className = charged ? 'w-2.5 h-2.5 rounded-full bg-amber-400' : 'w-2.5 h-2.5 rounded-full bg-sky-500';
        if (text) {
          if (activeControlScheme === 'GAMEPAD') {
            text.innerText = charged
              ? 'SUPER FLOW! X/R2: Curved Strike • O/R1: Send Runner'
              : 'L-Stick: Move • R-Stick: Aim • X/R2: Pass/Shoot • O/R1: Run';
          } else {
            text.innerText = charged
              ? 'SUPER FLOW! Hold Click: Curved Star Strike • R-Click: Send Run'
              : 'L-Click: Pass / Hold to Curve • R-Click: Send Run';
          }
        }
        if (mobileActionText) mobileActionText.innerText = 'Kick';
        if (mobileSecondaryText) mobileSecondaryText.innerText = 'Send Run';
      } else {
        if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
        if (text) {
          text.innerText =
            activeControlScheme === 'GAMEPAD'
              ? `Defending vs ${currentOpponent.tag} • X/R2: Tackle • O/R1: Switch`
              : `Defending vs ${currentOpponent.tag} • L-Click: Tackle • R-Click: Switch`;
        }
        if (mobileActionText) mobileActionText.innerText = 'Tackle';
        if (mobileSecondaryText) mobileSecondaryText.innerText = 'Switch';
      }
    }

    function resetPositionsForKickoff(kickoffTeam: 'YOU' | 'AI' = 'YOU') {
      ball.x = PITCH.width / 2;
      ball.y = PITCH.height / 2;
      ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.height = 0; ball.vz = 0;
      ball.owner = null; ball.passTarget = null;
      ball.passTargetX = PITCH.width / 2; ball.passTargetY = PITCH.height / 2;
      ball.isThroughBall = false; ball.isShot = false;
      ball.isOneTouch = false; ball.isSuperStrike = false; ball.isPerfectStrike = false;
      ball.wasWallBounce = false; ball.passCounted = false; ball.threadedBonusGiven = false;
      ball.pickupCooldown = 0; ball.trail = [];

      kickChargeState.active = false;
      kickChargeState.power = 0;
      queuedOneTouchTimer = 0;
      flowCombo = 0;
      cpuPassCombo = 0;
      updateFlowHud();

      players.forEach((p) => {
        p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0;
        p.speedBoostTimer = 0; p.lungeTimer = 0; p.actionCooldown = 0;
        p.stunTimer = 0; p.giveAndGoTimer = 0; p.commandedRunTimer = 0;
        p.celebrateTimer = 0;
        p.tacticalTargetX = p.x; p.tacticalTargetY = p.y;
        p.angle = p.team === 'YOU' ? 0 : Math.PI;
        p.scaleX = 1; p.scaleY = 1;
        p.aiDecisionTimer = 18;
      });

      keepers.forEach((k) => {
        k.x = k.homeX; k.y = PITCH.height / 2; k.vx = 0; k.vy = 0;
        k.diveTimer = 0; k.diveCooldown = 0; k.saveCooldown = 0;
        k.holdTimer = 0; k.holdingBall = false;
        k.scaleX = 1; k.scaleY = 1;
      });

      const kicker = players.find((p) => p.team === kickoffTeam && p.index === 2);
      if (kicker) {
        kicker.x = PITCH.width / 2 + (kickoffTeam === 'YOU' ? -32 : 32);
        kicker.y = PITCH.height / 2;
        ball.owner = kicker;
        ball.lastTouchTeam = kickoffTeam;
        ball.lastTouchPlayer = kicker;
      }
      controlledPlayer = players.find((p) => p.team === 'YOU' && p.index === 2) || null;
      updateHudState();
    }

    function setLedBanner(msg: string, duration = 170) {
      ledBannerMessage = msg;
      ledBannerTimer = duration;
    }

    function spawnFloatingText(x: number, y: number, text: string, color = '#ffffff') {
      if (floatingTexts.length > 24) floatingTexts.shift();
      floatingTexts.push({ x, y, text, color, vy: -1.25, alpha: 1.0, scale: 1.15 });
    }

    function spawnRipple(x: number, y: number, color = '#ffffff', maxR = 48) {
      if (ripples.length > 30) ripples.shift();
      ripples.push({ x, y, r: 8, maxR, alpha: 0.88, color });
    }

    function spawnBurst(x: number, y: number, color = '#ffffff', count = 12, maxSpeed = 4.6) {
      for (let i = 0; i < count; i++) {
        if (particles.length > 140) particles.shift();
        const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
        const spd = 1.2 + Math.random() * maxSpeed;
        particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 2.5 + Math.random() * 2.8,
          alpha: 1,
          color,
        });
      }
    }

    function spawnTurfScuff(x: number, y: number, angle: number, color = 'rgba(30, 58, 38, 0.35)') {
      turfScuffs.push({ x, y, angle, alpha: 0.65, color });
      if (turfScuffs.length > 55) turfScuffs.shift();
    }

    function spawnGoalConfetti(goalX: number, goalY: number, team: 'YOU' | 'AI') {
      const teamKit = team === 'YOU' ? userKitChoice : getContrastingKit(userKitChoice);
      const palette =
        teamKit === 'HOME'
          ? ['#38bdf8', '#60a5fa', '#fde047', '#a7f3d0', '#ffffff']
          : ['#fb7185', '#fda4af', '#fcd34d', '#f472b6', '#ffffff'];
      const dirSign = goalX > PITCH.width * 0.5 ? -1 : 1;
      for (let i = 0; i < 65; i++) {
        if (confetti.length > 160) confetti.shift();
        const spreadAngle = (Math.random() - 0.5) * 1.45;
        const speed = 3.5 + Math.random() * 9.5;
        confetti.push({
          x: goalX,
          y: goalY + (Math.random() - 0.5) * PITCH.goalWidth * 0.75,
          vx: Math.cos(spreadAngle) * speed * dirSign,
          vy: Math.sin(spreadAngle) * speed - 1.5,
          w: 6 + Math.random() * 5,
          h: 4 + Math.random() * 4,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          alpha: 1,
          color: palette[i % palette.length],
        });
      }
    }

    function onWallBounce(bx: number, by: number, x1: number, y1: number, x2: number, y2: number) {
      sound.playWallBounce();
      wallGlows.push({ x1, y1, x2, y2, alpha: 0.95 });
      spawnRipple(bx, by, '#38bdf8', 38);
      spawnBurst(bx, by, '#bae6fd', 8, 3.2);
      ball.isThroughBall = false;

      if (!ball.owner && !ball.isShot && ball.lastTouchTeam) {
        ball.wasWallBounce = true;
        const mates = players.filter((p) => p.team === ball.lastTouchTeam);
        const spd = Math.hypot(ball.vx, ball.vy);
        if (spd > 3.2) {
          let bestBankMate: PlayerEntity | null = null;
          let bestDot = 0.55;
          for (const m of mates) {
            const dx = m.x + m.vx * 8 - bx;
            const dy = m.y + m.vy * 8 - by;
            const dist = Math.hypot(dx, dy);
            if (dist > 55 && dist < 1150) {
              const dot = (ball.vx * dx + ball.vy * dy) / (spd * dist);
              if (dot > bestDot) {
                bestDot = dot;
                bestBankMate = m;
              }
            }
          }
          if (bestBankMate) {
            const dx = bestBankMate.x + bestBankMate.vx * 6 - bx;
            const dy = bestBankMate.y + bestBankMate.vy * 6 - by;
            const dist = Math.hypot(dx, dy) || 1;
            ball.vx = ball.vx * 0.50 + (dx / dist) * spd * 0.50;
            ball.vy = ball.vy * 0.50 + (dy / dist) * spd * 0.50;
            ball.passTarget = bestBankMate;
            if (ball.lastTouchTeam === 'YOU') {
              controlledPlayer = bestBankMate;
              bestBankMate.speedBoostTimer = Math.max(bestBankMate.speedBoostTimer, 50);
            }
          }
        }
      }
    }

    function triggerTacticalTeammateRun() {
      const carrier = ball.owner && ball.owner.team === 'YOU' ? ball.owner : controlledPlayer;
      if (!carrier) return;
      const mates = players.filter((p) => p.team === 'YOU' && p !== carrier);
      if (mates.length === 0) return;

      mates.sort(
        (a, b) =>
          Math.hypot(a.x - mouseState.worldX, a.y - mouseState.worldY) -
          Math.hypot(b.x - mouseState.worldX, b.y - mouseState.worldY)
      );
      const chosen = mates[0];
      const aimX =
        activeControlScheme === 'MOUSE' && mouseState.active
          ? Math.max(chosen.x + 260, mouseState.worldX)
          : chosen.x + 420;
      const aimY =
        activeControlScheme === 'MOUSE' && mouseState.active
          ? mouseState.worldY * 0.52 + chosen.y * 0.48
          : chosen.y;

      chosen.commandedTargetX = Math.max(160, Math.min(PITCH.width - 135, aimX));
      chosen.commandedTargetY = Math.max(105, Math.min(PITCH.height - 105, aimY));
      chosen.commandedRunTimer = 195;
      chosen.speedBoostTimer = 140;

      sound.playSwitch();
      spawnRipple(chosen.x, chosen.y, '#38bdf8', 46);
      spawnFloatingText(chosen.x, chosen.y - 26, 'MAKING RUN!', '#38bdf8');
      setLedBanner(`TEAMMATE #${chosen.jerseyNum} MAKING FORWARD RUN INTO SPACE`, 140);
    }

    function isPassingLaneClear(fromPlayer: { team: 'YOU' | 'AI'; x: number; y: number }, toPlayer: { x: number; y: number }) {
      const opponents = players.filter((p) => p.team !== fromPlayer.team);
      for (const opp of opponents) {
        const d = pointToSegmentDistance(opp.x, opp.y, fromPlayer.x, fromPlayer.y, toPlayer.x, toPlayer.y);
        if (d < 46) return false;
      }
      return true;
    }

    function movePlayerToward(p: PlayerEntity, targetX: number, targetY: number, speed: number) {
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const step = Math.min(speed, dist * 0.28);
        p.vx = p.vx * 0.55 + (dx / dist) * step * 0.45;
        p.vy = p.vy * 0.55 + (dy / dist) * step * 0.45;
      } else {
        p.vx *= 0.65;
        p.vy *= 0.65;
      }
    }

    function getActivePlayerAimVector(p: PlayerEntity | null) {
      if (!p) return { x: 1, y: 0 };
      if (activeControlScheme === 'GAMEPAD') {
        if (gamepadState.aimActive) {
          return { x: gamepadState.aimX, y: gamepadState.aimY };
        }
        if (gamepadState.moveActive) {
          const len = Math.hypot(gamepadState.moveX, gamepadState.moveY) || 1;
          return { x: gamepadState.moveX / len, y: gamepadState.moveY / len };
        }
      }
      if (activeControlScheme === 'MOUSE' && mouseState.active) {
        const dx = mouseState.worldX - p.x;
        const dy = mouseState.worldY - p.y;
        const len = Math.hypot(dx, dy);
        if (len > 4) return { x: dx / len, y: dy / len };
      }
      if (joyVec.active && Math.hypot(joyVec.x, joyVec.y) > 0.15) {
        const len = Math.hypot(joyVec.x, joyVec.y);
        return { x: joyVec.x / len, y: joyVec.y / len };
      }
      let kx = 0;
      let ky = 0;
      if (keys['KeyW'] || keys['ArrowUp']) ky -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) ky += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) kx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) kx += 1;
      if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        return { x: kx / len, y: ky / len };
      }
      return { x: Math.cos(p.angle), y: Math.sin(p.angle) };
    }

    function toggleControlledPlayer() {
      if (isTeamInPossession('YOU')) {
        triggerTacticalTeammateRun();
        return;
      }
      const others = players.filter((p) => p.team === 'YOU' && p !== controlledPlayer);
      if (others.length === 0) return;
      others.sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y));
      controlledPlayer = others[0];
      controlledPlayer.scaleX = 1.25;
      controlledPlayer.scaleY = 0.82;
      sound.playSwitch();
      spawnRipple(controlledPlayer.x, controlledPlayer.y, '#ffffff', 40);
    }

    function evaluateKickDecision(actor: PlayerEntity, aimDirX: number, aimDirY: number) {
      return evaluateKickDecisionPure(
        actor,
        aimDirX,
        aimDirY,
        players,
        keepers,
        {
          active: activeControlScheme === 'MOUSE' && mouseState.active,
          x: mouseState.worldX,
          y: mouseState.worldY,
        },
        ball.radius
      );
    }

    function registerCompletedPass(team: 'YOU' | 'AI', receiver: PlayerEntity | KeeperEntity | null, wasWallBounce = false) {
      if (team === 'YOU') {
        const isGiveAndGo = Boolean(receiver && 'giveAndGoTimer' in receiver && receiver.giveAndGoTimer > 0);
        const bonus = calculateFlowGain(wasWallBounce, isGiveAndGo);
        flowCombo += bonus;
        totalPassesYou++;
        if (flowCombo > maxFlowCombo) maxFlowCombo = flowCombo;
        if (receiver && 'speedBoostTimer' in receiver) receiver.speedBoostTimer = 60;
        updateFlowHud();
        sound.playCatch(flowCombo);
        crowdExcitement = Math.min(1.0, crowdExcitement + 0.18);

        if (receiver) {
          spawnRipple(receiver.x, receiver.y, flowCombo >= PASSES_FOR_FLOW_BOOST ? '#facc15' : '#38bdf8', 46);
          if (
            flowCombo === PASSES_FOR_FLOW_BOOST ||
            (flowCombo > PASSES_FOR_FLOW_BOOST && flowCombo - bonus < PASSES_FOR_FLOW_BOOST)
          ) {
            sound.playComboBonus();
            spawnBurst(receiver.x, receiver.y, '#fde047', 16, 5.2);
            spawnFloatingText(receiver.x, receiver.y - 30, 'SUPER FLOW!', '#facc15');
          } else if (isGiveAndGo) {
            sound.playComboBonus();
            spawnFloatingText(receiver.x, receiver.y - 28, `1-2 GIVE & GO! x${flowCombo}`, '#facc15');
          } else if (wasWallBounce) {
            sound.playComboBonus();
            spawnFloatingText(receiver.x, receiver.y - 28, `BANK PASS! x${flowCombo}`, '#38bdf8');
            setLedBanner(`WALL REBOUND BANK PASS! (+2 FLOW • x${flowCombo})`, 160);
          } else {
            spawnFloatingText(receiver.x, receiver.y - 24, `FLOW x${flowCombo}`, '#bae6fd');
          }
        }
      } else {
        cpuPassCombo += wasWallBounce ? 2 : 1;
        flowCombo = 0;
        updateFlowHud();
        sound.playCatch(1);
      }
    }

    function executePassOrShot(actor: PlayerEntity, aimVec: { x: number; y: number }, isOneTouch = false, chargePower = 0) {
      const decision = evaluateKickDecision(actor, aimVec.x, aimVec.y);
      const isYou = actor.team === 'YOU';
      const activeCombo = isYou ? flowCombo : cpuPassCombo;
      const hasSuperFlow = activeCombo >= PASSES_FOR_FLOW_BOOST;
      const isSweetSpot = isYou && isSweetSpotCharge(chargePower);

      // Start ball directly from actor's center so its actual curved trajectory matches the preview arc 1:1
      ball.x = actor.x;
      ball.y = actor.y;
      ball.owner = null;
      ball.pickupCooldown = 8;
      ball.lastTouchTeam = actor.team;
      ball.lastTouchPlayer = actor;
      ball.wasWallBounce = false;
      ball.passCounted = false;
      ball.threadedBonusGiven = false;
      ball.isOneTouch = isOneTouch;
      ball.isPerfectStrike = isSweetSpot;

      actor.actionCooldown = 13;
      actor.scaleX = 1.42;
      actor.scaleY = 0.68;
      actor.giveAndGoTimer = 135;
      actor.speedBoostTimer = 80;

      if (decision.type === 'SHOOT') {
        const isChargedStrike = hasSuperFlow || isOneTouch || chargePower > 0.3;
        const { shotSpeed, appliedSpin } = computeShotSpinAndSpeed(
          decision.suggestedSpin || 0,
          chargePower,
          hasSuperFlow,
          isSweetSpot,
          isOneTouch,
          isYou
        );
        const targetX = decision.shotTargetX ?? actor.x + decision.dirX * 600;
        const targetY = decision.shotTargetY ?? actor.y + decision.dirY * 600;
        const launchVel = computeLaunchVelocityForCurve(
          actor.x,
          actor.y,
          targetX,
          targetY,
          shotSpeed,
          appliedSpin
        );

        ball.vx = launchVel.vx;
        ball.vy = launchVel.vy;
        ball.spin = appliedSpin;
        ball.vz = isOneTouch ? 4.8 : 2.8 + chargePower * 2.1;
        ball.isShot = true;
        ball.isSuperStrike = isChargedStrike || isSweetSpot;
        ball.passTarget = null;

        crowdExcitement = Math.min(1.0, crowdExcitement + 0.45);

        if (isYou) {
          totalShotsYou++;
          screenShake = isSweetSpot || hasSuperFlow ? 7.5 : 4.0;
          if (isSweetSpot) {
            sound.playPerfectStrike();
            spawnFloatingText(actor.x, actor.y - 34, 'PERFECT STRIKE!', '#facc15');
            hitStopTimer = 3.5;
          } else if (isOneTouch) {
            spawnFloatingText(actor.x, actor.y - 32, 'ONE-TOUCH VOLLEY!', '#facc15');
            hitStopTimer = 3.0;
          } else if (chargePower > 0.28) {
            spawnFloatingText(actor.x, actor.y - 30, 'FINESSE CURVE!', '#38bdf8');
          } else if (hasSuperFlow) {
            spawnFloatingText(actor.x, actor.y - 30, 'SUPER STRIKE!', '#facc15');
          }
        }
        spawnRipple(actor.x, actor.y, isChargedStrike || isSweetSpot ? '#facc15' : '#ffffff', 68);
        spawnBurst(actor.x, actor.y, isChargedStrike || isSweetSpot ? '#fde047' : '#ffffff', 18, 6.2);
        sound.playShoot(isChargedStrike || isSweetSpot);
      } else if (decision.type === 'KEEPER_PASS') {
        const passSpeed = 21.0;
        ball.vx = decision.dirX * passSpeed;
        ball.vy = decision.dirY * passSpeed;
        ball.spin = 0;
        ball.vz = 1.6;
        ball.passTarget = null;
        ball.isShot = false;
        ball.isSuperStrike = false;
        spawnRipple(actor.x, actor.y, '#06b6d4', 46);
        sound.playPass();
      } else {
        const { passSpeed, appliedSpin } = computePassSpinAndSpeed(
          decision.suggestedSpin || 0,
          chargePower,
          activeCombo,
          isSweetSpot,
          isOneTouch
        );
        const targetX =
          decision.passTargetX ??
          (decision.bestMate ? decision.bestMate.x : actor.x + decision.dirX * 420);
        const targetY =
          decision.passTargetY ??
          (decision.bestMate ? decision.bestMate.y : actor.y + decision.dirY * 420);

        const launchVel = computeLaunchVelocityForCurve(
          actor.x,
          actor.y,
          targetX,
          targetY,
          passSpeed,
          appliedSpin
        );

        ball.vx = launchVel.vx;
        ball.vy = launchVel.vy;
        ball.spin = appliedSpin;
        ball.vz = isOneTouch ? 3.4 : 1.8 + chargePower * 1.2;
        ball.isShot = false;
        ball.isSuperStrike = isSweetSpot;
        ball.passTargetX = targetX;
        ball.passTargetY = targetY;
        ball.isThroughBall = Boolean(decision.isThroughBall);

        // Seamless receiver selection: lock onto bestMate or nearest teammate who can run onto the pass/through-ball
        let receiver = decision.bestMate || null;
        if (!receiver && isYou) {
          receiver = findBestReceiverForLooseBall(
            { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, lastTouchTeam: 'YOU', isShot: false },
            players,
            actor,
            null
          );
        }
        ball.passTarget = receiver;

        if (receiver && isYou) {
          controlledPlayer = receiver;
          receiver.speedBoostTimer = Math.max(receiver.speedBoostTimer, 72);
          receiver.commandedTargetX = targetX;
          receiver.commandedTargetY = targetY;
          // Do not overwrite receiver velocity or lock manual steering; let other non-controlled teammates make support runs
          spawnRipple(receiver.x, receiver.y, '#38bdf8', 42);
        }

        if (isYou) {
          triggerControllerRumble(isSweetSpot ? 65 : 35, isSweetSpot ? 0.45 : 0.22, isSweetSpot ? 0.3 : 0.12);
        }

        const isCurvedPass = Math.abs(appliedSpin) > 0.002 && chargePower > 0.14;
        if (isSweetSpot && isYou) {
          sound.playPerfectStrike();
          spawnFloatingText(
            actor.x,
            actor.y - 32,
            isCurvedPass ? 'CURVED LASER PASS!' : 'LASER PASS!',
            '#facc15'
          );
        } else if (isCurvedPass && isYou) {
          spawnFloatingText(actor.x, actor.y - 30, 'CURVED PASS!', '#c084fc');
        } else if (decision.isThroughBall && isYou) {
          spawnFloatingText(actor.x, actor.y - 28, 'THROUGH BALL!', '#38bdf8');
        } else if (isOneTouch && isYou) {
          spawnFloatingText(actor.x, actor.y - 30, 'ONE-TOUCH!', '#fde047');
        }
        spawnRipple(actor.x, actor.y, isSweetSpot ? '#facc15' : '#38bdf8', 50);
        spawnBurst(actor.x, actor.y, isSweetSpot ? '#fef08a' : '#bae6fd', 12, 4.4);
        sound.playPass(isCurvedPass);
      }
    }

    function attemptTackleCapture(actor: PlayerEntity, inOwnBox: boolean): boolean {
      const distToBall = Math.hypot(ball.x - actor.x, ball.y - actor.y);
      const reach = computeTackleReach(actor.team === 'YOU', inOwnBox);
      if (distToBall > reach) return false;

      if (ball.owner && ball.owner !== actor) {
        if (ball.owner.team === actor.team) return false;
        if (actor.team === 'YOU') {
          // Human tackling AI stuns the AI carrier
          ball.owner.stunTimer = 38;
          ball.owner.vx = actor.lungeDirX * 3.2;
          ball.owner.vy = actor.lungeDirY * 3.2;
        } else {
          // AI tackling human NEVER stuns, freezes, or pulls the human player's movement!
          ball.pickupCooldown = 15;
        }
      }
      if (inOwnBox && ball.isShot) {
        ball.owner = null;
        ball.isShot = false;
        ball.vx = (actor.team === 'YOU' ? 1 : -1) * 14.5 + actor.lungeDirX * 5;
        ball.vy = actor.lungeDirY * 11.5;
        ball.pickupCooldown = 10;
        sound.playKeeperSave();
        spawnBurst(ball.x, ball.y, '#38bdf8', 14, 5.0);
      } else {
        ball.owner = actor;
        ball.passTarget = null;
        ball.isThroughBall = false;
        ball.isShot = false;
        ball.lastTouchTeam = actor.team;
        ball.lastTouchPlayer = actor;
        if (actor.team === 'YOU') {
          cpuPassCombo = 0;
          controlledPlayer = actor;
          actor.speedBoostTimer = Math.max(actor.speedBoostTimer, 48);
          triggerControllerRumble(55, 0.4, 0.28);
          spawnFloatingText(actor.x, actor.y - 26, 'WON BALL!', '#38bdf8');
        } else {
          flowCombo = 0;
          updateFlowHud();
        }
        spawnBurst(ball.x, ball.y, '#ffffff', 11, 4.0);
      }
      actor.lungeTimer = 0;
      updateHudState();
      return true;
    }

    function triggerContextAction(actor: PlayerEntity | null, aimVec: { x: number; y: number }, chargePower = 0) {
      if (!actor || actor.stunTimer > 0) return;

      if (actor.team === 'YOU' && ball.owner !== actor && isTeamInPossession('YOU')) {
        queuedOneTouchTimer = 32;
        queuedOneTouchAim = { x: aimVec.x, y: aimVec.y };
        spawnRipple(actor.x, actor.y, '#facc15', 34);
        return;
      }

      if (ball.owner === actor) {
        executePassOrShot(actor, aimVec, false, chargePower);
        return;
      }

      if (actor.actionCooldown > 0) return;

      const inOwnBox =
        actor.team === 'YOU'
          ? actor.x < PITCH.boxWidth && Math.abs(actor.y - PITCH.height / 2) < PITCH.boxHeight / 2
          : actor.x > PITCH.width - PITCH.boxWidth && Math.abs(actor.y - PITCH.height / 2) < PITCH.boxHeight / 2;

      const dxToBall = ball.x + ball.vx * 3 - actor.x;
      const dyToBall = ball.y + ball.vy * 3 - actor.y;
      const distToBall = Math.hypot(dxToBall, dyToBall) || 1;
      const lockSnapDist = actor.team === 'YOU' ? 190 : 250;
      const lungeDirX = distToBall < lockSnapDist ? dxToBall / distToBall : aimVec.x;
      const lungeDirY = distToBall < lockSnapDist ? dyToBall / distToBall : aimVec.y;

      actor.lungeDirX = lungeDirX;
      actor.lungeDirY = lungeDirY;
      actor.lungeTimer = inOwnBox ? 16 : 12;
      actor.actionCooldown = actor.team === 'YOU' ? 16 : 30;
      actor.angle = Math.atan2(lungeDirY, lungeDirX);
      actor.scaleX = 1.38;
      actor.scaleY = 0.72;

      sound.playTackle();
      spawnTurfScuff(actor.x, actor.y, actor.angle);
      spawnRipple(actor.x, actor.y, inOwnBox ? '#38bdf8' : '#ffffff', 44);
      if (inOwnBox && actor.team === 'YOU') {
        spawnFloatingText(actor.x, actor.y - 26, 'SLIDE BLOCK!', '#38bdf8');
      }

      attemptTackleCapture(actor, inOwnBox);
    }

    function updateOffBallTeammateAI(teammate: PlayerEntity, carrier: PlayerEntity | null) {
      const refPlayer = carrier || controlledPlayer || players.find((p) => p.team === teammate.team);
      if (!refPlayer) return;
      const isYou = teammate.team === 'YOU';
      const attackSign = isYou ? 1 : -1;
      teammate.runPhase += 0.032 * dtScale;
      teammate.isOpenLane = isPassingLaneClear(refPlayer, teammate);

      if (teammate.commandedRunTimer > 0) {
        teammate.commandedRunTimer = Math.max(0, teammate.commandedRunTimer - dtScale);
        movePlayerToward(teammate, teammate.commandedTargetX, teammate.commandedTargetY, teammate.baseSpeed * 1.26);
        teammate.angle = Math.atan2(ball.y - teammate.y, ball.x - teammate.x);
        return;
      }

      if (!ball.owner && ball.passTarget === teammate) {
        const bSpd = Math.hypot(ball.vx, ball.vy);
        if (bSpd > 1.2) {
          const meetX = ball.isThroughBall ? ball.passTargetX : ball.x + ball.vx * 14;
          const meetY = ball.isThroughBall ? ball.passTargetY : ball.y + ball.vy * 14;
          const interceptX = Math.max(70, Math.min(PITCH.width - 70, meetX));
          const interceptY = Math.max(70, Math.min(PITCH.height - 70, meetY));
          movePlayerToward(teammate, interceptX, interceptY, teammate.baseSpeed * 1.22);
          teammate.angle = Math.atan2(ball.y - teammate.y, ball.x - teammate.x);
          return;
        }
      }

      if (teammate.giveAndGoTimer > 0) {
        teammate.giveAndGoTimer = Math.max(0, teammate.giveAndGoTimer - dtScale);
        const dartX = Math.max(150, Math.min(PITCH.width - 150, teammate.x + attackSign * 340));
        const dartY =
          teammate.role === 'WING_TOP'
            ? PITCH.height * 0.16
            : teammate.role === 'WING_BOT'
              ? PITCH.height * 0.84
              : PITCH.height * 0.5;
        movePlayerToward(teammate, dartX, dartY, teammate.baseSpeed * 1.2);
        teammate.angle = Math.atan2(ball.y - teammate.y, ball.x - teammate.x);
        return;
      }

      // Dynamic attacking support triangles & runs into open space
      let targetX = teammate.homeX;
      let targetY = teammate.homeY;
      const waveX = Math.sin(teammate.runPhase) * 125;
      const waveY = Math.cos(teammate.runPhase * 0.85) * 78;

      if (teammate.role === 'WING_TOP') {
        targetX = refPlayer.x + attackSign * (390 + waveX);
        targetY = PITCH.height * 0.16 + waveY;
      } else if (teammate.role === 'WING_BOT') {
        targetX = refPlayer.x + attackSign * (390 - waveX);
        targetY = PITCH.height * 0.84 - waveY;
      } else {
        // ANCHOR or third teammate dynamically overlaps into the open half-space if carrier is on a wing
        const carrierOnWing = Math.abs(refPlayer.y - PITCH.height * 0.5) > 220;
        targetX = refPlayer.x + attackSign * (carrierOnWing ? 180 : -190) + waveX * 0.55;
        targetY = refPlayer.y < PITCH.height * 0.5 ? PITCH.height * 0.66 : PITCH.height * 0.34;
      }

      // Actively shift away from nearby opponents to find open pockets of space for through-balls
      const opponents = players.filter((p) => p.team !== teammate.team);
      for (const opp of opponents) {
        const odx = targetX - opp.x;
        const ody = targetY - opp.y;
        const od = Math.hypot(odx, ody);
        if (od < 230 && od > 1) {
          targetX += (odx / od) * 95 + attackSign * 45;
          targetY += (ody / od) * 115;
        }
      }

      // If lane from carrier is blocked by a defender, shift laterally into an open pocket of space
      if (!teammate.isOpenLane && isYou) {
        targetY += teammate.y < PITCH.height * 0.5 ? 95 : -95;
      }

      // Anti-crowding separation on larger pitch
      const sepRadius = PITCH.antiCrowdingRadius;
      for (const other of players) {
        if (other.team === teammate.team && other !== teammate) {
          const dx = teammate.x - other.x;
          const dy = teammate.y - other.y;
          const d = Math.hypot(dx, dy);
          if (d < sepRadius && d > 1) {
            const push = ((sepRadius - d) / sepRadius) * 200;
            targetX += (dx / d) * push;
            targetY += (dy / d) * push;
          }
        }
      }

      targetX = Math.max(135, Math.min(PITCH.width - 135, targetX));
      targetY = Math.max(95, Math.min(PITCH.height - 95, targetY));
      teammate.tacticalTargetX = targetX;
      teammate.tacticalTargetY = targetY;

      movePlayerToward(teammate, targetX, targetY, teammate.baseSpeed * 1.08);
      teammate.angle = Math.atan2(ball.y - teammate.y, ball.x - teammate.x);
    }

    function updateDefensiveTeammateAI(defender: PlayerEntity) {
      const isYou = defender.team === 'YOU';
      const ownGoalX = isYou ? 0 : PITCH.width;
      const ownGoalY = PITCH.height / 2;
      const preset = getActiveDifficultyPreset();

      if (!ball.owner) {
        // AI steps up slightly more to intercept passes or loose balls in its vicinity or passing lane
        const isUserPassInFlight = ball.lastTouchTeam === 'YOU' && !ball.isShot && ball.passTarget;
        const teamPlayers = players.filter((p) => p.team === defender.team);
        teamPlayers.sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y));
        const distToLane = pointToSegmentDistance(
          defender.x,
          defender.y,
          ball.x,
          ball.y,
          ball.x + ball.vx * 18,
          ball.y + ball.vy * 18
        );
        const canInterceptPass =
          !isUserPassInFlight ||
          Math.hypot(defender.x - ball.x, defender.y - ball.y) < 350 ||
          distToLane < 165;
        if (
          teamPlayers[0] === defender &&
          (defender.team === 'AI' || defender !== controlledPlayer) &&
          canInterceptPass
        ) {
          const leadBx = Math.max(70, Math.min(PITCH.width - 70, ball.x + ball.vx * 6));
          const leadBy = Math.max(70, Math.min(PITCH.height - 70, ball.y + ball.vy * 6));
          movePlayerToward(defender, leadBx, leadBy, defender.baseSpeed * (isYou ? 1.04 : 0.98));
          defender.angle = Math.atan2(ball.y - defender.y, ball.x - defender.x);
          return;
        }
      }

      const defenders = players.filter((p) => p.team === defender.team);
      const sortedByBall = [...defenders].sort(
        (a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y)
      );

      let targetX = defender.homeX;
      let targetY = defender.homeY;

      if (sortedByBall[0] === defender) {
        // Primary defender jockeys at standOff distance and steps in to challenge the ball carrier
        const distToCarrier = Math.hypot(ball.x - defender.x, ball.y - defender.y);
        const effectiveStandOff = isYou
          ? 130
          : distToCarrier < 240
            ? preset.standOff * 0.62
            : preset.standOff;
        const dirToGoalX = ownGoalX - ball.x;
        const dirToGoalY = ownGoalY - ball.y;
        const distToGoal = Math.hypot(dirToGoalX, dirToGoalY) || 1;
        targetX = ball.x + (dirToGoalX / distToGoal) * effectiveStandOff;
        targetY = ball.y + (dirToGoalY / distToGoal) * effectiveStandOff + Math.sin(matchTick * 0.04 + defender.index) * 24;

        if (!isYou && ball.owner && distToCarrier < 94) {
          if (Math.random() < preset.tackleChance) {
            const d = Math.max(1, distToCarrier);
            const aim = { x: (ball.x - defender.x) / d, y: (ball.y - defender.y) / d };
            triggerContextAction(defender, aim, 0);
          }
        }
      } else if (sortedByBall[1] === defender) {
        // Second defender screens passing lanes & challenges if the carrier dribbles close
        const distToCarrier = Math.hypot(ball.x - defender.x, ball.y - defender.y);
        if (!isYou && ball.owner && distToCarrier < 84 && Math.random() < preset.tackleChance * 0.85) {
          const d = Math.max(1, distToCarrier);
          const aim = { x: (ball.x - defender.x) / d, y: (ball.y - defender.y) / d };
          triggerContextAction(defender, aim, 0);
        }
        const attackers = players.filter((p) => p.team !== defender.team && p !== ball.owner);
        if (attackers.length > 0) {
          attackers.sort((a, b) => Math.abs(a.y - defender.homeY) - Math.abs(b.y - defender.homeY));
          const mark = attackers[0];
          if (isYou) {
            targetX = mark.x * 0.62 + ball.x * 0.38 - 65;
            targetY = mark.y * 0.68 + ball.y * 0.32;
          } else {
            // CPU second defender shades passing lanes to intercept passes more proactively
            targetX = Math.max(PITCH.width * 0.44, mark.x * 0.64 + ball.x * 0.16 + defender.homeX * 0.20 + 45);
            targetY = mark.y * 0.66 + ball.y * 0.18 + defender.homeY * 0.16;
          }
        }
      } else {
        // Third defender anchors back zone near box
        targetX = isYou ? 350 : PITCH.width - 360;
        targetY = PITCH.height * 0.5 + (ball.y - PITCH.height * 0.5) * 0.42;
      }

      for (const other of defenders) {
        if (other !== defender) {
          const dx = defender.x - other.x;
          const dy = defender.y - other.y;
          const d = Math.hypot(dx, dy);
          if (d < PITCH.antiCrowdingRadius && d > 1) {
            targetX += (dx / d) * 110;
            targetY += (dy / d) * 110;
          }
        }
      }

      targetX = Math.max(120, Math.min(PITCH.width - 120, targetX));
      targetY = Math.max(95, Math.min(PITCH.height - 95, targetY));
      movePlayerToward(defender, targetX, targetY, defender.baseSpeed * (isYou ? 0.94 : 0.93));
      defender.angle = Math.atan2(ball.y - defender.y, ball.x - defender.x);
    }

    function vxOrDir(vx: number, fallback: number) { return Math.abs(vx) > 0.2 ? vx : fallback; }
    function vyOrDir(vy: number, fallback: number) { return Math.abs(vy) > 0.2 ? vy : fallback; }

    function updateCpuCarrierAI(cpu: PlayerEntity) {
      const preset = getActiveDifficultyPreset();
      const isCompetitive = currentGameMode !== 'CASUAL';
      const goalX = 0;
      const goalY = PITCH.height / 2;

      // Organic weaving dribble path that seeks open space rather than robotic straight-line running
      let targetX = goalX + (isCompetitive ? 185 : 210);
      let targetY =
        cpu.role === 'WING_TOP'
          ? PITCH.height * 0.24 + Math.sin(matchTick * 0.048 + cpu.index) * 145
          : cpu.role === 'WING_BOT'
            ? PITCH.height * 0.76 + Math.cos(matchTick * 0.048 + cpu.index) * 145
            : goalY + Math.sin(matchTick * 0.052 + cpu.index * 1.7) * 245;

      const humanDefenders = players.filter((p) => p.team === 'YOU');
      let closestThreatDist = 9999;
      for (const def of humanDefenders) {
        const dx = cpu.x - def.x;
        const dy = cpu.y - def.y;
        const d = Math.hypot(dx, dy);
        if (d < closestThreatDist) closestThreatDist = d;
        const avoidRadius = isCompetitive ? 265 : 235;
        if (d < avoidRadius && d > 1) {
          targetY += (dy / d) * (isCompetitive ? 215 : 185);
          targetX += (dx / d) * (isCompetitive ? 55 : 65);
        }
      }

      movePlayerToward(cpu, Math.max(120, targetX), Math.max(105, Math.min(PITCH.height - 105, targetY)), cpu.dribbleSpeed);
      cpu.angle = Math.atan2(vyOrDir(cpu.vy, goalY - cpu.y), vxOrDir(cpu.vx, goalX - cpu.x));

      const pressThreshold = isCompetitive ? 125 : 108;
      const underImmediatePress = closestThreatDist < pressThreshold;
      cpu.aiDecisionTimer -= dtScale * (underImmediatePress ? (isCompetitive ? 2.15 : 1.85) : 1.0);

      if (cpu.aiDecisionTimer <= 0) {
        cpu.aiDecisionTimer = preset.decisionDelay + Math.random() * (isCompetitive ? 12 : 16);

        const mates = players.filter((p) => p.team === 'AI' && p !== cpu);
        mates.sort((a, b) => a.x - b.x);

        // 1. Creative passing first: look for diagonal switches, forward runners, or give-and-go triangles
        if (mates.length > 0 && (Math.random() < preset.passCreativity || underImmediatePress || cpu.x > 660)) {
          for (const m of mates) {
            const leadMx = m.x + m.vx * 12 - (isCompetitive ? 48 : 35);
            const leadMy = m.y + m.vy * 12;
            const isForwardOrSwitch =
              leadMx < cpu.x + 145 || Math.abs(m.y - cpu.y) > PITCH.height * 0.34 || underImmediatePress;
            if (isForwardOrSwitch && isPassingLaneClear(cpu, m)) {
              const pdx = leadMx - cpu.x;
              const pdy = leadMy - cpu.y;
              const plen = Math.hypot(pdx, pdy) || 1;
              const passCharge = Math.abs(m.y - cpu.y) > 360 ? (isCompetitive ? 0.34 : 0.28) : 0.16;
              executePassOrShot(cpu, { x: pdx / plen, y: pdy / plen }, false, passCharge);
              if (isCompetitive) {
                cpu.giveAndGoTimer = 56;
              }
              return;
            }
          }

          // Creative wall-bank pass when near top or bottom boards
          if (cpu.y < 290 || cpu.y > PITCH.height - 290) {
            const targetMate = mates[0];
            if (targetMate.x < cpu.x + 40) {
              const wallY = cpu.y < PITCH.height * 0.5 ? 0 : PITCH.height;
              const bdx = (targetMate.x + cpu.x) * 0.5 - cpu.x;
              const bdy = wallY - cpu.y;
              const blen = Math.hypot(bdx, bdy) || 1;
              executePassOrShot(cpu, { x: bdx / blen, y: bdy / blen }, false, 0.26);
              return;
            }
          }
        }

        // 2. Shoot when in attacking range (aims away from keeper's near-post coverage)
        const shootRangeX = isCompetitive ? 820 : 670;
        if (cpu.x < shootRangeX && Math.abs(cpu.y - goalY) < 430) {
          const youKeeper = keepers.find((k) => k.team === 'YOU');
          const aimCornerY =
            youKeeper && youKeeper.y < goalY
              ? goalY + PITCH.goalWidth * 0.39
              : goalY - PITCH.goalWidth * 0.39;
          const sdx = goalX - cpu.x;
          const sdy = aimCornerY - cpu.y;
          const slen = Math.hypot(sdx, sdy) || 1;
          const chargeAmt = isCompetitive ? (cpuPassCombo >= 1 ? 0.76 : 0.52) : cpuPassCombo >= 2 ? 0.45 : 0.24;
          executePassOrShot(cpu, { x: sdx / slen, y: sdy / slen }, false, chargeAmt);
          return;
        }
      }
    }

    function dismissSplashScreen() {
      if (gameState !== 'SPLASH') return;
      sound.unlock();
      sound.setMenuMode(true);
      sound.startMusic(() => ({
        isPlaying: gameState === 'PLAYING' || gameState === 'GOAL_CELEBRATION',
        isSuperFlow: flowCombo >= PASSES_FOR_FLOW_BOOST,
        flowCombo,
      }));
      sound.playMatchFound();
      triggerScreenTransition(() => {
        const splashEl = document.getElementById('splashScreen');
        const menuOverlayEl = document.getElementById('menuOverlay');
        if (splashEl) splashEl.classList.add('hidden');
        if (menuOverlayEl) menuOverlayEl.classList.remove('hidden');
        gameState = 'MENU';
        syncBodyStateAttr('MENU');
        syncMenuLayoutForState('MENU');
        syncMenuFocusVisual(true);
      });
    }

    function syncMenuLayoutForState(state: InternalGameState) {
      const overlay = document.getElementById('menuOverlay');
      const modalCard = document.getElementById('menuModalCard');
      const topBar = document.getElementById('menuTopBar');
      const mainGrid = document.getElementById('menuMainGrid');
      const leftCol = document.getElementById('menuLeftCol');
      const bottomBar = document.getElementById('menuBottomBar');
      const profileBar = document.getElementById('menuProfileBar');
      const editProfileBtn = document.getElementById('editProfileBtn');
      const mainMenuBtn = document.getElementById('mainMenuBtn');
      const startBtnEl = document.getElementById('startBtn');
      if (!modalCard) return;

      if (state === 'SPLASH' || state === 'PLAYING' || state === 'GOAL_CELEBRATION') {
        if (overlay) {
          overlay.classList.add('hidden');
        }
        syncMobileControlsVisibility();
        return;
      }

      if (state === 'PAUSED' || state === 'MATCH_OVER') {
        if (overlay) {
          overlay.className =
            'absolute inset-0 bg-slate-900/55 flex items-center justify-center z-30 p-3 sm:p-6 transition-opacity duration-150 overflow-y-auto';
        }
        modalCard.className =
          'glass-modal rounded-[28px] max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-7 text-center relative transition-all duration-200 my-auto';
        if (topBar) {
          topBar.className =
            'flex flex-col sm:flex-row items-center justify-center gap-3 pb-4 mb-4 border-b-2 border-slate-200';
        }
        if (mainGrid) mainGrid.className = 'flex flex-col gap-4 text-left mb-4';
        if (leftCol) leftCol.classList.add('hidden');
        if (bottomBar) bottomBar.className = 'flex flex-col space-y-2.5 sm:space-y-3';
        if (profileBar) profileBar.classList.add('hidden');
        if (editProfileBtn) editProfileBtn.classList.add('hidden');
        if (mainMenuBtn) {
          mainMenuBtn.classList.toggle('hidden', state !== 'MATCH_OVER');
        }
        if (startBtnEl && state === 'MATCH_OVER') {
          startBtnEl.classList.remove('hidden');
        }
      } else {
        // Polished, responsive Home Menu layout over the live stadium pitch (zero squishing across screen sizes)
        if (overlay) {
          overlay.className =
            'absolute inset-0 bg-slate-950/25 flex items-center justify-center z-30 p-3 sm:p-5 lg:p-8 transition-opacity duration-150 overflow-y-auto';
        }
        modalCard.className =
          'w-full max-w-2xl lg:max-w-5xl flex flex-col gap-3 sm:gap-4 text-center relative transition-all duration-200 my-auto';
        if (topBar) {
          topBar.className =
            'glass-modal rounded-3xl px-4 py-3 sm:px-6 sm:py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3';
        }
        if (mainGrid) {
          mainGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch text-left';
        }
        if (leftCol) {
          leftCol.className =
            'lg:col-span-7 glass-modal rounded-3xl p-4 sm:p-6 flex flex-col justify-between gap-4';
        }
        if (bottomBar) {
          bottomBar.className = 'glass-modal rounded-3xl p-4 sm:p-5 flex flex-col space-y-2.5 sm:space-y-3';
        }
        if (profileBar) profileBar.classList.remove('hidden');
        if (editProfileBtn) editProfileBtn.classList.remove('hidden');
        if (mainMenuBtn) mainMenuBtn.classList.add('hidden');
        if (startBtnEl) startBtnEl.classList.remove('hidden');
      }
      syncMobileControlsVisibility();
    }

    // Returns currently visible & focusable UI buttons in the active screen/modal for DualShock 5 / Keyboard navigation
    function getFocusableMenuButtons(): HTMLElement[] {
      if (gameState === 'SPLASH') {
        return [];
      }

      const vsOverlay = document.getElementById('preMatchVsOverlay');
      if (vsOverlay && !vsOverlay.classList.contains('hidden')) {
        const vsBtns = Array.from(
          vsOverlay.querySelectorAll<HTMLElement>('#vsKickoffNowBtn, #vsBackToMenuBtn')
        );
        return vsBtns.filter((el) => !el.classList.contains('hidden') && !el.closest('.hidden'));
      }

      const winOverlay = document.getElementById('tournamentWinOverlay');
      if (winOverlay && !winOverlay.classList.contains('hidden')) {
        const winBtns = Array.from(
          winOverlay.querySelectorAll<HTMLElement>('#tourneyCelebrateNewBtn, #tourneyCelebrateHomeBtn')
        );
        return winBtns.filter((el) => !el.classList.contains('hidden') && !el.closest('.hidden'));
      }

      const editModal = document.getElementById('editProfileModal');
      if (editModal && !editModal.classList.contains('hidden')) {
        const modalBtns = Array.from(
          editModal.querySelectorAll<HTMLElement>(
            '#takePhotoBtn, #capturePhotoBtn, #clearPhotoBtn, #saveProfileBtn, #closeProfileModalBtn'
          )
        );
        return modalBtns.filter((el) => !el.classList.contains('hidden') && !el.closest('.hidden'));
      }

      const overlay = document.getElementById('menuOverlay');
      if (!overlay || overlay.classList.contains('hidden')) return [];

      const candidates = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          '.mode-btn, .kit-btn, #editProfileBtn, #startBtn, #rematchSameBtn, #mainMenuBtn, #resumeBtn, #forfeitBtn, #howToPlayBtn, .control-tab-btn'
        )
      );
      return candidates.filter((el) => {
        if (el.classList.contains('hidden') || el.hasAttribute('disabled')) return false;
        let parent = el.parentElement;
        while (parent && parent !== overlay) {
          if (parent.classList.contains('hidden')) return false;
          parent = parent.parentElement;
        }
        return true;
      });
    }

    function syncMenuFocusVisual(showFocusRing = true) {
      const allBtns = document.querySelectorAll<HTMLElement>(
        '#splashStartBtn, .mode-btn, .kit-btn, #editProfileBtn, #startBtn, #rematchSameBtn, #mainMenuBtn, #resumeBtn, #forfeitBtn, #howToPlayBtn, .control-tab-btn, #takePhotoBtn, #capturePhotoBtn, #clearPhotoBtn, #saveProfileBtn, #closeProfileModalBtn'
      );
      allBtns.forEach((b) => b.classList.remove('controller-focused'));
      if (!showFocusRing) return;

      const visibleBtns = getFocusableMenuButtons();
      if (visibleBtns.length === 0) return;

      if (gamepadState.focusedMenuIndex < 0 || gamepadState.focusedMenuIndex >= visibleBtns.length) {
        const primaryIdx = visibleBtns.findIndex(
          (b) => b.id === 'startBtn' || b.id === 'resumeBtn' || b.id === 'splashStartBtn' || b.id === 'saveProfileBtn'
        );
        gamepadState.focusedMenuIndex = primaryIdx >= 0 ? primaryIdx : 0;
      }

      const activeBtn = visibleBtns[gamepadState.focusedMenuIndex];
      if (activeBtn) {
        activeBtn.classList.add('controller-focused');
      }
    }

    function moveMenuFocus(step: number) {
      const visibleBtns = getFocusableMenuButtons();
      if (visibleBtns.length === 0) return;
      gamepadState.focusedMenuIndex =
        (gamepadState.focusedMenuIndex + step + visibleBtns.length) % visibleBtns.length;
      sound.init();
      sound.playSwitch();
      triggerControllerRumble(22, 0.14, 0.05);
      syncMenuFocusVisual(true);
    }

    function setControlGuideTab(tab: ControlGuideTab) {
      activeControlGuideTab = tab;
      const tabButtons = document.querySelectorAll<HTMLElement>('.control-tab-btn');
      tabButtons.forEach((btn) => {
        const isSelected = btn.getAttribute('data-control-tab') === tab;
        const isFocused = btn.classList.contains('controller-focused');
        btn.className = isSelected
          ? `control-tab-btn py-2 px-3 rounded-xl text-xs font-black cursor-pointer bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center space-x-1.5 whitespace-nowrap${isFocused ? ' controller-focused' : ''}`
          : `control-tab-btn py-2 px-3 rounded-xl text-xs font-extrabold cursor-pointer bg-white text-slate-600 hover:text-slate-900 border border-slate-300 flex items-center justify-center space-x-1.5 whitespace-nowrap${isFocused ? ' controller-focused' : ''}`;
      });

      const compGuide = document.getElementById('guideComputer');
      const remGuide = document.getElementById('guideRemote');
      const mobGuide = document.getElementById('guideMobile');
      if (compGuide) compGuide.classList.toggle('hidden', tab !== 'COMPUTER');
      if (remGuide) remGuide.classList.toggle('hidden', tab !== 'REMOTE');
      if (mobGuide) mobGuide.classList.toggle('hidden', tab !== 'MOBILE');
    }

    // Poll HTML5 Gamepad API every frame — optimised foremost for Sony DualSense / DualShock 5 Wireless Controller
    function pollGamepadInput() {
      if (typeof navigator.getGamepads !== 'function') return;
      const pads = navigator.getGamepads();
      if (!pads) return;

      let activePad: Gamepad | null = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i]!.connected) {
          activePad = pads[i];
          break;
        }
      }
      if (!activePad) return;

      if (gamepadState.connectedName !== activePad.id) {
        gamepadState.connectedName = activePad.id;
        const badge = document.getElementById('controllerConnectedPill');
        if (badge) {
          badge.classList.remove('hidden');
          badge.classList.add('inline-flex');
        }
      }

      // Left stick or D-pad movement
      let rawLx = activePad.axes[0] || 0;
      let rawLy = activePad.axes[1] || 0;
      const dpadUp = Boolean(activePad.buttons[12]?.pressed);
      const dpadDown = Boolean(activePad.buttons[13]?.pressed);
      const dpadLeft = Boolean(activePad.buttons[14]?.pressed);
      const dpadRight = Boolean(activePad.buttons[15]?.pressed);

      if (dpadUp) rawLy = -1;
      if (dpadDown) rawLy = 1;
      if (dpadLeft) rawLx = -1;
      if (dpadRight) rawLx = 1;

      const leftStick = applyRadialDeadzone(rawLx, rawLy, 0.16);
      const rightStick = applyRadialDeadzone(activePad.axes[2] || 0, activePad.axes[3] || 0, 0.18);

      // DualSense / DualShock 5 standard W3C mapping:
      // 0 = Cross (✕), 1 = Circle (◯), 2 = Square (□), 3 = Triangle (△)
      // 4 = L1, 5 = R1, 6 = L2, 7 = R2, 9 = Options
      const crossOrR2Down = Boolean(
        activePad.buttons[0]?.pressed || activePad.buttons[7]?.pressed
      );
      const circleOrSquareOrR1Down = Boolean(
        activePad.buttons[1]?.pressed ||
        activePad.buttons[2]?.pressed ||
        activePad.buttons[5]?.pressed
      );
      const l1Down = Boolean(activePad.buttons[4]?.pressed);
      const r1Down = Boolean(activePad.buttons[5]?.pressed);
      const triangleDown = Boolean(activePad.buttons[3]?.pressed);
      const optionsDown = Boolean(activePad.buttons[9]?.pressed);

      const navUp = dpadUp || leftStick.y < -0.58;
      const navDown = dpadDown || leftStick.y > 0.58;
      const navLeft = dpadLeft || leftStick.x < -0.58;
      const navRight = dpadRight || leftStick.x > 0.58;

      if (
        leftStick.active ||
        rightStick.active ||
        crossOrR2Down ||
        circleOrSquareOrR1Down ||
        l1Down ||
        triangleDown ||
        optionsDown
      ) {
        hasDetectedTouchInput = false;
        if (activeControlScheme !== 'GAMEPAD') {
          activeControlScheme = 'GAMEPAD';
          setControlGuideTab('REMOTE');
          syncMenuFocusVisual(gameState !== 'PLAYING');
          syncMobileControlsVisibility();
          updateHudState();
        }
      }

      if (gameState === 'SPLASH') {
        if (
          (crossOrR2Down && !gamepadState.prevPrimaryDown) ||
          (circleOrSquareOrR1Down && !gamepadState.prevSecondaryDown) ||
          (triangleDown && !gamepadState.prevTriangleDown) ||
          (optionsDown && !gamepadState.prevStartDown)
        ) {
          dismissSplashScreen();
          gamepadState.prevPrimaryDown = crossOrR2Down;
          gamepadState.prevSecondaryDown = circleOrSquareOrR1Down;
          gamepadState.prevTriangleDown = triangleDown;
          gamepadState.prevStartDown = optionsDown;
          return;
        }
      }

      gamepadState.moveX = leftStick.x;
      gamepadState.moveY = leftStick.y;
      gamepadState.moveActive = leftStick.active;

      if (rightStick.active) {
        const rLen = Math.hypot(rightStick.x, rightStick.y) || 1;
        gamepadState.aimX = rightStick.x / rLen;
        gamepadState.aimY = rightStick.y / rLen;
        gamepadState.aimActive = true;
      } else if (leftStick.active) {
        const lLen = Math.hypot(leftStick.x, leftStick.y) || 1;
        gamepadState.aimX = leftStick.x / lLen;
        gamepadState.aimY = leftStick.y / lLen;
        gamepadState.aimActive = true;
      } else {
        gamepadState.aimActive = false;
      }

      // Menu Navigation when in MENU, PAUSED, or MATCH_OVER
      if (gameState !== 'PLAYING' && gameState !== 'GOAL_CELEBRATION') {
        if ((navDown || navRight) && !(gamepadState.prevNavDown || gamepadState.prevNavRight)) {
          moveMenuFocus(1);
        } else if ((navUp || navLeft) && !(gamepadState.prevNavUp || gamepadState.prevNavLeft)) {
          moveMenuFocus(-1);
        }

        // L1 / R1 Shoulder buttons quickly cycle Control Guide Tabs (if open) or Game Modes
        const howPanel = document.getElementById('howToPlayPanel');
        const isHowOpen = Boolean(howPanel && !howPanel.classList.contains('hidden'));
        if (r1Down && !gamepadState.prevR1Down) {
          if (isHowOpen) {
            const tabs: ControlGuideTab[] = ['COMPUTER', 'REMOTE', 'MOBILE'];
            const nextTab = tabs[(tabs.indexOf(activeControlGuideTab) + 1) % tabs.length];
            setControlGuideTab(nextTab);
            sound.playSwitch();
          } else if (gameState === 'MENU') {
            const modes: GameMode[] = ['CASUAL', 'RANKED', 'TOURNAMENT'];
            const nextMode = modes[(modes.indexOf(currentGameMode) + 1) % modes.length];
            const targetBtn = document.querySelector<HTMLElement>(`.mode-btn[data-mode="${nextMode}"]`);
            if (targetBtn) targetBtn.click();
          }
        } else if (l1Down && !gamepadState.prevL1Down) {
          if (isHowOpen) {
            const tabs: ControlGuideTab[] = ['COMPUTER', 'REMOTE', 'MOBILE'];
            const prevTab = tabs[(tabs.indexOf(activeControlGuideTab) - 1 + tabs.length) % tabs.length];
            setControlGuideTab(prevTab);
            sound.playSwitch();
          } else if (gameState === 'MENU') {
            const modes: GameMode[] = ['CASUAL', 'RANKED', 'TOURNAMENT'];
            const prevMode = modes[(modes.indexOf(currentGameMode) - 1 + modes.length) % modes.length];
            const targetBtn = document.querySelector<HTMLElement>(`.mode-btn[data-mode="${prevMode}"]`);
            if (targetBtn) targetBtn.click();
          }
        }

        // Triangle (△) toggles Home / Away Kit in lobby
        if (triangleDown && !gamepadState.prevTriangleDown && gameState === 'MENU') {
          const nextKit: KitChoice = userKitChoice === 'HOME' ? 'AWAY' : 'HOME';
          const kitBtn = document.querySelector<HTMLElement>(`.kit-btn[data-kit="${nextKit}"]`);
          if (kitBtn) kitBtn.click();
        }

        // Cross (✕) activates currently focused UI option!
        if (crossOrR2Down && !gamepadState.prevPrimaryDown) {
          sound.init();
          const visibleBtns = getFocusableMenuButtons();
          const focusedBtn = visibleBtns[gamepadState.focusedMenuIndex];
          if (focusedBtn) {
            triggerControllerRumble(35, 0.25, 0.15);
            focusedBtn.click();
          } else {
            startMatch();
          }
        }

        // Circle (◯) closes Edit Profile modal or How to Play panel if open, or resumes from Pause
        if (Boolean(activePad.buttons[1]?.pressed) && !gamepadState.prevSecondaryDown) {
          const editModal = document.getElementById('editProfileModal');
          if (editModal && !editModal.classList.contains('hidden')) {
            const closeBtn = document.getElementById('closeProfileModalBtn');
            if (closeBtn) closeBtn.click();
          } else if (isHowOpen && howPanel) {
            howPanel.classList.add('hidden');
            syncMenuFocusVisual(true);
          } else if (gameState === 'PAUSED') {
            togglePauseMatch();
          }
        }
      } else {
        // Active Gameplay DualSense Controls
        if (crossOrR2Down && !gamepadState.prevPrimaryDown) {
          sound.init();
          if (controlledPlayer) {
            if (ball.owner === controlledPlayer) {
              kickChargeState.active = true;
              kickChargeState.power = 0;
            } else {
              triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), 0);
            }
          }
        } else if (!crossOrR2Down && gamepadState.prevPrimaryDown) {
          if (kickChargeState.active && controlledPlayer) {
            const pwr = kickChargeState.power;
            kickChargeState.active = false;
            kickChargeState.power = 0;
            triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), pwr);
          }
        }

        if (circleOrSquareOrR1Down && !gamepadState.prevSecondaryDown) {
          toggleControlledPlayer();
        }
      }

      // Options button (Pause / Resume)
      if (optionsDown && !gamepadState.prevStartDown) {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          togglePauseMatch();
        } else if (gameState === 'MENU') {
          startMatch();
        }
      }

      gamepadState.prevPrimaryDown = crossOrR2Down;
      gamepadState.prevSecondaryDown = circleOrSquareOrR1Down;
      gamepadState.prevStartDown = optionsDown;
      gamepadState.prevNavUp = navUp;
      gamepadState.prevNavDown = navDown;
      gamepadState.prevNavLeft = navLeft;
      gamepadState.prevNavRight = navRight;
      gamepadState.prevL1Down = l1Down;
      gamepadState.prevR1Down = r1Down;
      gamepadState.prevTriangleDown = triangleDown;
    }

    function updatePlayers() {
      if (queuedOneTouchTimer > 0) {
        queuedOneTouchTimer = Math.max(0, queuedOneTouchTimer - dtScale);
      }
      if (mouseState.moveTimer > 0) {
        mouseState.moveTimer = Math.max(0, mouseState.moveTimer - dtScale);
      }
      updateMouseWorldCoords();

      // Seamless Auto Player Selection:
      // Automatically selects the carrier or dynamically tracks the best receiver along a pass / through-ball trajectory
      if (ball.owner && ball.owner.team === 'YOU') {
        controlledPlayer = ball.owner;
      } else if (!ball.owner && ball.lastTouchTeam === 'YOU' && !ball.isShot) {
        const ballSpd = Math.hypot(ball.vx, ball.vy);
        if (ballSpd < 2.5) {
          ball.passTarget = null;
          ball.isThroughBall = false;
        }
        const excludePasser = ball.pickupCooldown > 0 ? ball.lastTouchPlayer : null;
        const bestReceiver = findBestReceiverForLooseBall(
          ball,
          players,
          excludePasser,
          ball.passTarget || controlledPlayer
        );
        if (bestReceiver) {
          if (ballSpd >= 2.5) {
            ball.passTarget = bestReceiver;
          }
          controlledPlayer = bestReceiver;
        } else if (ball.passTarget && ball.passTarget.team === 'YOU') {
          controlledPlayer = ball.passTarget;
        }
      } else if (!controlledPlayer || controlledPlayer.team !== 'YOU' || controlledPlayer.stunTimer > 0) {
        const unstunnedMates = players.filter((p) => p.team === 'YOU' && p.stunTimer <= 0);
        if (unstunnedMates.length > 0) {
          unstunnedMates.sort(
            (a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y)
          );
          controlledPlayer = unstunnedMates[0];
        } else {
          controlledPlayer = players.find((p) => p.team === 'YOU') || null;
        }
      }

      if (kickChargeState.active && controlledPlayer && ball.owner === controlledPlayer) {
        kickChargeState.power = Math.min(1.0, kickChargeState.power + 0.032 * dtScale);
        kickChargeState.soundTick += dtScale;
        if (kickChargeState.soundTick > 6) {
          kickChargeState.soundTick = 0;
          sound.playChargeTick(kickChargeState.power, isSweetSpotCharge(kickChargeState.power));
        }
      } else if (!kickChargeState.active) {
        kickChargeState.power = Math.max(0, kickChargeState.power - 0.15 * dtScale);
      }

      for (const p of players) {
        if (p.actionCooldown > 0) p.actionCooldown = Math.max(0, p.actionCooldown - dtScale);
        if (p.speedBoostTimer > 0) p.speedBoostTimer = Math.max(0, p.speedBoostTimer - dtScale);
        if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dtScale);

        p.scaleX += (1 - p.scaleX) * 0.22 * dtScale;
        p.scaleY += (1 - p.scaleY) * 0.22 * dtScale;

        // 1. Human-Controlled Player: 100% Free, Unconstrained Movement (never locked out by stunTimer, lungeTimer, or idle mouse)
        if (p === controlledPlayer && p.team === 'YOU') {
          p.stunTimer = 0;
          const hasBall = ball.owner === p;
          const isLunging = p.lungeTimer > 0;
          if (isLunging) {
            p.lungeTimer = Math.max(0, p.lungeTimer - dtScale);
            const inOwnBox =
              p.x < PITCH.boxWidth && Math.abs(p.y - PITCH.height / 2) < PITCH.boxHeight / 2;
            attemptTackleCapture(p, inOwnBox);
          }

          const boostMult =
            (p.speedBoostTimer > 0 || flowCombo >= PASSES_FOR_FLOW_BOOST ? 1.18 : 1.0) *
            (isLunging ? 1.38 : 1.0);
          const topSpeed = (hasBall ? p.dribbleSpeed : p.baseSpeed) * boostMult;

          let mx = 0;
          let my = 0;
          if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
          if (keys['KeyS'] || keys['ArrowDown']) my += 1;
          if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
          if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

          const isReceivingPass =
            !hasBall &&
            !ball.owner &&
            ball.passTarget === p &&
            Math.hypot(ball.vx, ball.vy) > 3.5 &&
            Math.hypot(ball.x - p.x, ball.y - p.y) < 320;

          if (mx !== 0 || my !== 0) {
            const len = Math.hypot(mx, my);
            p.vx = (mx / len) * topSpeed;
            p.vy = (my / len) * topSpeed;
            p.angle = Math.atan2(my, mx);
          } else if (joyVec.active && Math.hypot(joyVec.x, joyVec.y) > 0.06) {
            const jLen = Math.hypot(joyVec.x, joyVec.y) || 1;
            const mag = Math.min(1, Math.max(0.45, jLen));
            p.vx = (joyVec.x / jLen) * topSpeed * mag;
            p.vy = (joyVec.y / jLen) * topSpeed * mag;
            p.angle = Math.atan2(joyVec.y, joyVec.x);
          } else if (activeControlScheme === 'GAMEPAD' && gamepadState.moveActive) {
            const gLen = Math.hypot(gamepadState.moveX, gamepadState.moveY) || 1;
            const mag = Math.min(1, gLen);
            p.vx = (gamepadState.moveX / gLen) * topSpeed * mag;
            p.vy = (gamepadState.moveY / gLen) * topSpeed * mag;
            p.angle = Math.atan2(gamepadState.moveY, gamepadState.moveX);
          } else if (
            activeControlScheme === 'MOUSE' &&
            !hasUsedKeyboardMove &&
            mouseState.active &&
            (mouseState.moveTimer > 0 || mouseState.isDown) &&
            !isMobileOrTabletViewport()
          ) {
            const dx = mouseState.worldX - p.x;
            const dy = mouseState.worldY - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 22) {
              const arrivalScale = Math.min(1, (dist - 12) / 55);
              p.vx = (dx / dist) * topSpeed * arrivalScale;
              p.vy = (dy / dist) * topSpeed * arrivalScale;
            } else {
              p.vx *= 0.65;
              p.vy *= 0.65;
            }
          } else if (isLunging) {
            p.vx = p.lungeDirX * topSpeed;
            p.vy = p.lungeDirY * topSpeed;
          } else if (isReceivingPass) {
            const bSpd = Math.hypot(ball.vx, ball.vy);
            const toPlayerX = p.x - ball.x;
            const toPlayerY = p.y - ball.y;
            const proj = Math.max(3, Math.min(18, (toPlayerX * ball.vx + toPlayerY * ball.vy) / (bSpd * bSpd)));
            const lineX = Math.max(65, Math.min(PITCH.width - 65, ball.x + ball.vx * proj));
            const lineY = Math.max(65, Math.min(PITCH.height - 65, ball.y + ball.vy * proj));
            movePlayerToward(p, lineX, lineY, topSpeed * 1.05);
          } else {
            p.vx *= 0.74;
            p.vy *= 0.74;
          }

          const aim = getActivePlayerAimVector(p);
          p.angle = Math.atan2(aim.y, aim.x);
        } else if (p.stunTimer > 0) {
          p.vx *= 0.82;
          p.vy *= 0.82;
        } else if (p.lungeTimer > 0) {
          p.lungeTimer = Math.max(0, p.lungeTimer - dtScale);
          const lungeSpeed = p.baseSpeed * (p.team === 'YOU' ? 2.12 : 1.92);
          p.vx = p.lungeDirX * lungeSpeed;
          p.vy = p.lungeDirY * lungeSpeed;
          const inOwnBox =
            p.team === 'YOU'
              ? p.x < PITCH.boxWidth && Math.abs(p.y - PITCH.height / 2) < PITCH.boxHeight / 2
              : p.x > PITCH.width - PITCH.boxWidth && Math.abs(p.y - PITCH.height / 2) < PITCH.boxHeight / 2;
          attemptTackleCapture(p, inOwnBox);
        } else if (p.team === 'YOU') {
          if (isTeamInPossession('YOU')) {
            updateOffBallTeammateAI(p, ball.owner || controlledPlayer);
          } else {
            updateDefensiveTeammateAI(p);
          }
        } else {
          if (ball.owner === p) {
            updateCpuCarrierAI(p);
          } else if (isTeamInPossession('AI')) {
            updateOffBallTeammateAI(p, ball.owner || players.find((x) => x.team === 'AI') || null);
          } else {
            updateDefensiveTeammateAI(p);
          }
        }

        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;

        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 0.35) {
          p.stridePhase += spd * 0.14 * dtScale;
          if (spd > 3.8 && matchTick % 5 < 1) {
            if (afterimages.length > 35) afterimages.shift();
            afterimages.push({ x: p.x, y: p.y, radius: p.radius, alpha: 0.28, team: p.team });
          }
        }

        p.x = Math.max(p.radius + 8, Math.min(PITCH.width - p.radius - 8, p.x));
        p.y = Math.max(p.radius + 8, Math.min(PITCH.height - p.radius - 8, p.y));
      }
    }

    function updateAutoKeepers() {
      const goalHalf = PITCH.goalWidth / 2;
      const centerY = PITCH.height / 2;
      const flowBoost = getFlowPassBoost(flowCombo);
      const isPassInFlight = !ball.owner && !ball.isShot && Math.hypot(ball.vx, ball.vy) > 4.2;

      for (const k of keepers) {
        const isYou = k.team === 'YOU';
        k.patrolPhase = (k.patrolPhase || 0) + dtScale;
        if (k.diveCooldown > 0) k.diveCooldown = Math.max(0, k.diveCooldown - dtScale);
        if (k.saveCooldown > 0) k.saveCooldown = Math.max(0, k.saveCooldown - dtScale);
        k.scaleX += (1 - k.scaleX) * 0.2 * dtScale;
        k.scaleY += (1 - k.scaleY) * 0.2 * dtScale;

        // As your Flow builds, the opponent goalkeeper is more easily wrong-footed by quick passing & shots
        const keeperFlowFactor = !isYou && ball.lastTouchTeam === 'YOU' ? flowBoost.keeperReachScale : 1.0;
        const effectivePatrolSpeed = k.patrolSpeed * keeperFlowFactor;

        if (k.holdingBall) {
          ball.owner = null;
          ball.x = k.x + (isYou ? 18 : -18);
          ball.y = k.y;
          ball.vx = 0;
          ball.vy = 0;
          k.holdTimer -= dtScale;
          if (k.holdTimer <= 0) {
            k.holdingBall = false;
            k.saveCooldown = 22;
            const mates = players.filter((p) => p.team === k.team);
            mates.sort((a, b) => (isPassingLaneClear(k, b) ? 1 : 0) - (isPassingLaneClear(k, a) ? 1 : 0));
            const receiver = mates[0];
            if (receiver) {
              const dx = receiver.x + receiver.vx * 8 - k.x;
              const dy = receiver.y + receiver.vy * 8 - k.y;
              const d = Math.hypot(dx, dy) || 1;
              ball.vx = (dx / d) * 21.4;
              ball.vy = (dy / d) * 21.4;
              ball.vz = 2.4;
              ball.passTarget = receiver;
              ball.lastTouchTeam = k.team;
              ball.lastTouchPlayer = null;
              ball.passCounted = false;
              if (isYou) {
                controlledPlayer = receiver;
                spawnFloatingText(k.x, k.y - 24, 'KEEPER OUT!', '#06b6d4');
              }
              sound.playPass();
            }
          }
          continue;
        }

        // Reactive 2D positioning inside the penalty box:
        // Keeper shifts organically toward the ball's Y side & steps slightly off the line,
        // tracking long shots slightly better while cross-pitch passes open up the far post!
        const targetPos = computeKeeperTargetPosition(
          k.team,
          k.homeX,
          ball.x,
          ball.y,
          ball.vx,
          ball.vy,
          ball.isShot || isPassInFlight,
          ball.lastTouchTeam,
          flowCombo
        );

        const shotApproaching =
          !ball.owner && (isYou ? ball.vx < -6.2 && ball.x < 940 : ball.vx > 6.2 && ball.x > PITCH.width - 940);
        if (shotApproaching && k.diveTimer <= 0 && k.diveCooldown <= 0) {
          const tToLine = (k.x - ball.x) / ball.vx;
          if (tToLine > 0 && tToLine < 35) {
            const predictedY = ball.y + ball.vy * tToLine;
            const diffY = predictedY - k.y;
            const maxDiveWindow = 162 * keeperFlowFactor;
            if (Math.abs(diffY) > 15 && Math.abs(diffY) < maxDiveWindow) {
              k.diveTimer = 17;
              k.diveCooldown = 40;
              k.diveDirY = Math.sign(diffY);
              k.scaleX = 0.78;
              k.scaleY = 1.38;
            }
          }
        }

        k.x += (targetPos.targetX - k.x) * 0.165 * dtScale;

        if (k.diveTimer > 0) {
          k.diveTimer = Math.max(0, k.diveTimer - dtScale);
          k.y += k.diveDirY * effectivePatrolSpeed * 2.62 * dtScale;
        } else {
          const desiredY = targetPos.targetY;
          const dy = desiredY - k.y;
          if (Math.abs(dy) > 1.2) {
            const stepSpeed = effectivePatrolSpeed * targetPos.reactionSpeedFactor;
            k.y += Math.sign(dy) * Math.min(stepSpeed, Math.abs(dy) * 0.185) * dtScale;
          }
        }

        const patrolLimit = goalHalf - 26;
        k.y = Math.max(centerY - patrolLimit, Math.min(centerY + patrolLimit, k.y));
        k.angle = Math.atan2(ball.y - k.y, ball.x - k.x);

        if (!ball.owner && k.saveCooldown <= 0) {
          const isFriendlyBackpass = ball.lastTouchTeam === k.team && !ball.isShot;
          const baseReachY = k.diveTimer > 0 ? k.radius + 15 : isFriendlyBackpass ? k.radius + 22 : k.radius + 8;
          const reachY = baseReachY * keeperFlowFactor;
          const reachX = (k.radius + ball.radius + (isFriendlyBackpass ? 18 : 6.5)) * keeperFlowFactor;
          const dx = ball.x - k.x;
          const dy = ball.y - k.y;
          if (Math.abs(dx) <= reachX && Math.abs(dy) <= reachY + ball.radius) {
            if (isFriendlyBackpass) {
              k.holdingBall = true;
              k.holdTimer = 22;
              if (isYou) {
                registerCompletedPass('YOU', k, false);
              }
              spawnRipple(k.x, k.y, '#06b6d4', 44);
            } else {
              k.saveCooldown = 24;
              const outDirX = isYou ? 1 : -1;
              const deflectSignY = dy >= 0 ? 1 : -1;
              const spd = Math.max(11, Math.hypot(ball.vx, ball.vy) * 0.72);
              ball.vx = outDirX * spd * 0.82;
              ball.vy = deflectSignY * spd * 0.58;
              ball.spin = 0;
              ball.isShot = false;
              ball.passTarget = null;
              ball.lastTouchTeam = k.team;
              sound.playKeeperSave();
              screenShake = 6;
              spawnRipple(k.x, k.y, '#facc15', 52);
              spawnBurst(ball.x, ball.y, '#fef08a', 14, 4.8);
              spawnFloatingText(k.x, k.y - 26, 'KEEPER SAVE!', '#facc15');
              setLedBanner(`GREAT SAVE BY ${isYou ? 'YOUR' : currentOpponent.tag.toUpperCase() + "'S"} GOALKEEPER!`, 140);
            }
          }
        }
      }
    }

    function handleGoalScored(scoringTeam: 'YOU' | 'AI') {
      if (gameState === 'GOAL_CELEBRATION') return;
      gameState = 'GOAL_CELEBRATION';
      syncBodyStateAttr(gameState);
      goalScorerTeam = scoringTeam;
      goalBannerTimer = 115;
      screenShake = 18;
      slowMoTimer = 28;
      stadiumFlashAlpha = 0.6;
      crowdExcitement = 1.0;
      kickChargeState.active = false;
      kickChargeState.power = 0;

      const goalX = scoringTeam === 'YOU' ? PITCH.width : 0;
      spawnGoalConfetti(goalX, ball.y, scoringTeam);

      players.forEach((p) => {
        if (p.team === scoringTeam) {
          p.celebrateTimer = 110;
        }
      });

      if (scoringTeam === 'YOU') {
        scoreYou++;
        const syEl = document.getElementById('scoreYou');
        if (syEl) syEl.innerText = String(scoreYou);
        goalBannerText = 'GOAL · YOU SCORE!';
        goalBannerSub = ball.isPerfectStrike
          ? 'SWEET-SPOT PERFECT STRIKE FINISH!'
          : flowCombo >= PASSES_FOR_FLOW_BOOST
            ? `SUPER FLOW x${flowCombo} TEAMWORK FINISH!`
            : ball.isOneTouch
              ? 'INSTANT ONE-TOUCH VOLLEY FINISH!'
              : `CLINICAL CAGE FINISH VS ${currentOpponent.tag.toUpperCase()}!`;
        setLedBanner(`GOOOAAAL! YOU LEAD ${currentOpponent.tag.toUpperCase()} ${scoreYou} - ${scoreAi}`, 220);
        const oppPlayer = players.find((p) => p.team === 'AI');
        if (oppPlayer && Math.random() < 0.65) {
          const chat = ['Nice shot!', 'What a finish!', 'Unlucky!', 'GG!'][Math.floor(Math.random() * 4)];
          spawnFloatingText(oppPlayer.x, oppPlayer.y - 28, `${currentOpponent.tag}: "${chat}"`, '#fda4af');
        }
      } else {
        scoreAi++;
        const saEl = document.getElementById('scoreAi');
        if (saEl) saEl.innerText = String(scoreAi);
        goalBannerText = `${currentOpponent.tag.toUpperCase()} SCORES!`;
        goalBannerSub = `${currentOpponent.rank.toUpperCase()} RIVAL FINISH`;
        setLedBanner(`${currentOpponent.tag.toUpperCase()} GOAL • SCORE ${scoreYou} - ${scoreAi}`, 180);
        if (ball.lastTouchPlayer && ball.lastTouchPlayer.team === 'AI') {
          const chat = ["Let's gooo!", 'Calculated!', 'GG!', 'Nice pass!'][Math.floor(Math.random() * 4)];
          spawnFloatingText(ball.lastTouchPlayer.x, ball.lastTouchPlayer.y - 30, `${currentOpponent.tag}: "${chat}"`, '#fef08a');
        }
      }
      sound.playGoal();
    }

    function updateBall() {
      const flowBoost = getFlowPassBoost(flowCombo);

      if (ball.pickupCooldown > 0) {
        ball.pickupCooldown = Math.max(0, ball.pickupCooldown - dtScale);
      }

      if (ball.height > 0 || ball.vz !== 0) {
        ball.height += ball.vz * dtScale;
        ball.vz -= 0.22 * dtScale;
        if (ball.height <= 0) {
          ball.height = 0;
          if (Math.abs(ball.vz) > 1.2) {
            ball.vz = -ball.vz * 0.48;
          } else {
            ball.vz = 0;
          }
        }
      }

      if (ball.owner) {
        const leadDist = ball.owner.radius + ball.radius + 2;
        const targetBx = ball.owner.x + Math.cos(ball.owner.angle) * leadDist;
        const targetBy = ball.owner.y + Math.sin(ball.owner.angle) * leadDist;
        ball.x += (targetBx - ball.x) * 0.55;
        ball.y += (targetBy - ball.y) * 0.55;
        ball.vx = ball.owner.vx;
        ball.vy = ball.owner.vy;
        ball.spin = 0;
        ball.rotAngle += Math.hypot(ball.vx, ball.vy) * 0.08 * dtScale;

        if (Math.hypot(ball.owner.vx, ball.owner.vy) > 0.6) {
          dribbleSoundTimer += dtScale;
          if (dribbleSoundTimer > 16) {
            dribbleSoundTimer = 0;
            sound.playDribbleTap();
          }
        }
      } else {
        if (Math.abs(ball.spin) > 0.0001) {
          const perpX = -ball.vy;
          const perpY = ball.vx;
          ball.vx += perpX * ball.spin * dtScale;
          ball.vy += perpY * ball.spin * dtScale;
          ball.spin *= Math.pow(0.988, dtScale);
        }

        // Subtle terminal homing only when already well-aligned with receiver so through-balls into space stay true
        if (ball.passTarget && !ball.isShot && Math.abs(ball.spin) < 0.0025) {
          const target = ball.passTarget;
          const dx = target.x + target.vx * 5 - ball.x;
          const dy = target.y + target.vy * 5 - ball.y;
          const dist = Math.hypot(dx, dy);
          const spd = Math.hypot(ball.vx, ball.vy);
          const maxHomingDist = ball.lastTouchTeam === 'YOU' ? 340 : 300;
          if (dist < maxHomingDist && dist > 16 && spd > 3.5) {
            const dot = (ball.vx * dx + ball.vy * dy) / (spd * dist);
            if (dot > 0.76) {
              const baseSteer = ball.lastTouchTeam === 'YOU' ? 0.055 + flowBoost.passHomingSteer : 0.05;
              const steer = baseSteer * dtScale;
              ball.vx = ball.vx * (1 - steer) + (dx / dist) * spd * steer;
              ball.vy = ball.vy * (1 - steer) + (dy / dist) * spd * steer;
            }
          }
        }

        ball.x += ball.vx * dtScale;
        ball.y += ball.vy * dtScale;
        ball.vx *= Math.pow(0.986, dtScale);
        ball.vy *= Math.pow(0.986, dtScale);
        ball.rotAngle += (Math.hypot(ball.vx, ball.vy) * 0.11 + ball.spin * 8) * dtScale;

        if (Math.hypot(ball.vx, ball.vy) > 3.2) {
          ball.trail.push({
            x: ball.x,
            y: ball.y,
            r: ball.radius * 0.88,
            alpha: 0.58,
            gold:
              ball.isSuperStrike ||
              ball.isPerfectStrike ||
              ball.isOneTouch ||
              (ball.lastTouchTeam === 'YOU' && flowCombo >= PASSES_FOR_FLOW_BOOST),
          });
          if (ball.trail.length > 16) ball.trail.shift();
        }

        if (!ball.isShot && !ball.threadedBonusGiven && ball.lastTouchTeam === 'YOU' && Math.hypot(ball.vx, ball.vy) > 7.5) {
          for (const opp of players) {
            if (opp.team === 'AI') {
              const d = Math.hypot(ball.x - opp.x, ball.y - opp.y);
              if (d > opp.radius * 0.5 && d < opp.radius + ball.radius + 26) {
                ball.threadedBonusGiven = true;
                flowCombo++;
                if (flowCombo > maxFlowCombo) maxFlowCombo = flowCombo;
                updateFlowHud();
                sound.playComboBonus();
                spawnBurst(ball.x, ball.y, '#38bdf8', 10, 3.8);
                spawnFloatingText(opp.x, opp.y - 26, 'THREADED! +1', '#38bdf8');
                break;
              }
            }
          }
        }

        const preset = getActiveDifficultyPreset();
        if (
          ball.pickupCooldown <= 0 ||
          (ball.passTarget &&
            Math.hypot(ball.x - ball.passTarget.x, ball.y - ball.passTarget.y) <=
              computePassCatchRadius(
                ball.passTarget.radius,
                ball.radius,
                true,
                ball.lastTouchTeam === ball.passTarget.team,
                ball.passTarget.team === 'YOU',
                flowCombo,
                preset.interceptScale
              ))
        ) {
          for (const p of players) {
            if (p.stunTimer > 0) continue;
            if (ball.pickupCooldown > 0 && p === ball.lastTouchPlayer) continue;

            const isPassTarget = p === ball.passTarget;
            const isSameTeamPass = ball.lastTouchTeam === p.team && !ball.isShot;
            const catchRadius = computePassCatchRadius(
              p.radius,
              ball.radius,
              isPassTarget,
              isSameTeamPass,
              p.team === 'YOU',
              flowCombo,
              preset.interceptScale
            );

            const distToPlayer = Math.hypot(ball.x - p.x, ball.y - p.y);

            // Soft magnetic reception pull when a teammate pass enters the outer first-touch zone
            if (p.team === 'YOU' && isSameTeamPass && distToPlayer <= catchRadius * 1.38 && distToPlayer > catchRadius) {
              const pullX = (p.x - ball.x) / distToPlayer;
              const pullY = (p.y - ball.y) / distToPlayer;
              ball.vx = ball.vx * 0.82 + pullX * 3.2;
              ball.vy = ball.vy * 0.82 + pullY * 3.2;
            }

            if (distToPlayer <= catchRadius) {
              const wasTeammatePass =
                ball.lastTouchTeam === p.team && ball.lastTouchPlayer && ball.lastTouchPlayer !== p && !ball.passCounted;
              if (wasTeammatePass) {
                ball.passCounted = true;
                registerCompletedPass(p.team, p, ball.wasWallBounce);
              } else if (ball.lastTouchTeam !== p.team) {
                if (p.team === 'YOU') {
                  cpuPassCombo = 0;
                  sound.playCatch(1);
                } else {
                  flowCombo = 0;
                  updateFlowHud();
                  sound.playCatch(1);
                }
              }

              ball.owner = p;
              ball.passTarget = null;
              ball.isThroughBall = false;
              ball.isShot = false;
              ball.isSuperStrike = false;
              ball.wasWallBounce = false;
              ball.lastTouchTeam = p.team;
              ball.lastTouchPlayer = p;
              p.scaleX = 1.22;
              p.scaleY = 0.84;

              if (p.team === 'YOU') {
                controlledPlayer = p;
                triggerControllerRumble(28, 0.2, 0.1);
                p.speedBoostTimer = Math.max(p.speedBoostTimer, 42);

                if (queuedOneTouchTimer > 0) {
                  queuedOneTouchTimer = 0;
                  executePassOrShot(p, queuedOneTouchAim, true, 0.35);
                }
              }
              updateHudState();
              break;
            }
          }
        }
      }

      for (let i = ball.trail.length - 1; i >= 0; i--) {
        ball.trail[i].alpha -= 0.042 * dtScale;
        ball.trail[i].r *= 0.95;
        if (ball.trail[i].alpha <= 0.02) ball.trail.splice(i, 1);
      }

      const r = ball.radius;
      const c = PITCH.cornerChamfer;
      const goalTop = (PITCH.height - PITCH.goalWidth) / 2;
      const goalBot = (PITCH.height + PITCH.goalWidth) / 2;
      const rest = PITCH.wallRestitution;

      // Top and Bottom cage barrier rebounds (0.96 restitution)
      if (ball.y - r < 0) {
        ball.y = r;
        ball.vy = Math.abs(ball.vy) * rest;
        onWallBounce(ball.x, 0, Math.max(c, ball.x - 90), 0, Math.min(PITCH.width - c, ball.x + 90), 0);
      } else if (ball.y + r > PITCH.height) {
        ball.y = PITCH.height - r;
        ball.vy = -Math.abs(ball.vy) * rest;
        onWallBounce(ball.x, PITCH.height, Math.max(c, ball.x - 90), PITCH.height, Math.min(PITCH.width - c, ball.x + 90), PITCH.height);
      }

      // 45-degree Chamfered Corners
      const corners = [
        { nx: 0.7071, ny: 0.7071, x1: 0, y1: c, x2: c, y2: 0, check: () => ball.x + ball.y < c + r },
        { nx: -0.7071, ny: 0.7071, x1: PITCH.width - c, y1: 0, x2: PITCH.width, y2: c, check: () => PITCH.width - ball.x + ball.y < c + r },
        { nx: 0.7071, ny: -0.7071, x1: 0, y1: PITCH.height - c, x2: c, y2: PITCH.height, check: () => ball.x + (PITCH.height - ball.y) < c + r },
        { nx: -0.7071, ny: -0.7071, x1: PITCH.width - c, y1: PITCH.height, x2: PITCH.width, y2: PITCH.height - c, check: () => PITCH.width - ball.x + (PITCH.height - ball.y) < c + r },
      ];
      for (const cn of corners) {
        if (cn.check()) {
          const dot = ball.vx * cn.nx + ball.vy * cn.ny;
          if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * cn.nx) * rest;
            ball.vy = (ball.vy - 2 * dot * cn.ny) * rest;
            ball.x += cn.nx * 6;
            ball.y += cn.ny * 6;
            onWallBounce(ball.x, ball.y, cn.x1, cn.y1, cn.x2, cn.y2);
          }
        }
      }

      // Goalpost circular collisions
      const posts = [
        { x: 0, y: goalTop },
        { x: 0, y: goalBot },
        { x: PITCH.width, y: goalTop },
        { x: PITCH.width, y: goalBot },
      ];
      for (const post of posts) {
        const dx = ball.x - post.x;
        const dy = ball.y - post.y;
        const dist = Math.hypot(dx, dy);
        const minDist = r + 8;
        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = post.x + nx * minDist;
          ball.y = post.y + ny * minDist;
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * 0.88;
            ball.vy = (ball.vy - 2 * dot * ny) * 0.88;
            sound.playPostClang();
            screenShake = 8;
            spawnBurst(post.x, post.y, '#facc15', 14, 5.0);
            spawnFloatingText(post.x, post.y - 22, 'POST!', '#facc15');
          }
        }
      }

      // Left and Right End-Lines & Goal Detection
      if (ball.y > goalTop && ball.y < goalBot) {
        if (ball.x < -r * 0.4) {
          triggerNetImpact(true, ball.y, ball.vx, ball.vy);
          handleGoalScored('AI');
          if (ball.x < -PITCH.goalDepth + r) {
            ball.x = -PITCH.goalDepth + r;
            ball.vx = -ball.vx * 0.35;
          }
        } else if (ball.x > PITCH.width + r * 0.4) {
          triggerNetImpact(false, ball.y, ball.vx, ball.vy);
          handleGoalScored('YOU');
          if (ball.x > PITCH.width + PITCH.goalDepth - r) {
            ball.x = PITCH.width + PITCH.goalDepth - r;
            ball.vx = -ball.vx * 0.35;
          }
        }
      } else {
        if (ball.x - r < 0) {
          ball.x = r;
          ball.vx = Math.abs(ball.vx) * rest;
          onWallBounce(0, ball.y, 0, Math.max(c, ball.y - 80), 0, Math.min(PITCH.height - c, ball.y + 80));
        } else if (ball.x + r > PITCH.width) {
          ball.x = PITCH.width - r;
          ball.vx = -Math.abs(ball.vx) * rest;
          onWallBounce(PITCH.width, ball.y, PITCH.width, Math.max(c, ball.y - 80), PITCH.width, Math.min(PITCH.height - c, ball.y + 80));
        }
      }
    }

    function drawPitch() {
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      const w = PITCH.width;
      const h = PITCH.height;
      const c = PITCH.cornerChamfer;
      const goalTop = (h - PITCH.goalWidth) / 2;
      const goalBot = (h + PITCH.goalWidth) / 2;
      const boxTop = (h - PITCH.boxHeight) / 2;
      const superFlowActive = flowCombo >= PASSES_FOR_FLOW_BOOST;
      const px = GRAPHICS_CONFIG.pixelPipeline.pixelSize;

      // 1. Blit pre-rendered static 16-bit pixel stadium apron, meadow flowers, bleachers, turf & chalk lines in a single call
      ctx.drawImage(pitchCacheCanvas, -CACHE_PAD, -CACHE_PAD);

      // 2. Fast Bouncing 16-Bit Crowd Sprites Along Bleachers
      ctx.save();
      const bounceAmp = 2.4 + crowdExcitement * 7.8 + (superFlowActive ? 3.5 : 0);
      const bounceFreq = 0.08 + crowdExcitement * 0.14;
      for (let i = 0; i < crowdFans.length; i++) {
        const fan = crowdFans[i];
        const hop = Math.round(Math.abs(Math.sin(matchTick * bounceFreq + fan.phase)) * bounceAmp);
        const fx = Math.round(fan.x);
        const fy = Math.round(fan.baseY - hop);
        ctx.fillStyle = GRAPHICS_CONFIG.palette.outline;
        ctx.fillRect(fx - 7, fy - 7, 14, 14);
        ctx.fillStyle = fan.color;
        ctx.fillRect(fx - 5, fy - 5, 10, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx - 4, fy - 4, 4, 3);
      }
      ctx.restore();

      // 3. Top Interactive Stadium LED Perimeter Board (16-Bit Pixel Frame)
      ctx.save();
      const boardX = w * 0.22;
      const boardY = -54;
      const boardW = w * 0.56;
      const boardH = 36;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(boardX - 4, boardY - 4, boardW + 8, boardH + 8);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(boardX, boardY, boardW, boardH);

      const ledColor = superFlowActive ? '#fde047' : ledBannerTimer > 0 ? '#38bdf8' : '#f8fafc';
      ctx.fillStyle = ledColor;
      for (let lx = boardX + 14; lx < boardX + boardW - 14; lx += 32) {
        ctx.fillRect(lx, boardY + 4, 4, 4);
        ctx.fillRect(lx, boardY + boardH - 8, 4, 4);
      }

      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayMsg =
        ledBannerTimer > 0
          ? ledBannerMessage
          : superFlowActive
            ? `SUPER FLOW x${flowCombo} ACTIVE • FIRE CURVED STAR STRIKES`
            : currentGameMode === 'TOURNAMENT'
              ? `KNOCKOUT CUP • ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} VS ${currentOpponent.tag.toUpperCase()}`
              : `REMATCH 0.2 • ${userProfile.name.toUpperCase()} VS ${currentOpponent.tag.toUpperCase()}`;
      ctx.fillText(displayMsg, w * 0.5, boardY + boardH * 0.5 + 1);
      ctx.restore();

      // 4. Dynamic pixel turf overlays (scuffs, Super Flow box glow, corner target zones)
      ctx.save();
      for (let i = 0; i < turfScuffs.length; i++) {
        const sc = turfScuffs[i];
        ctx.globalAlpha = sc.alpha * 0.65;
        ctx.fillStyle = GRAPHICS_CONFIG.palette.turf.scuffMark;
        ctx.fillRect(Math.round(sc.x - 9), Math.round(sc.y - 3), 18, 6);
      }
      ctx.globalAlpha = 1;

      if (superFlowActive) {
        ctx.fillStyle = `rgba(254, 240, 138, ${0.14 + Math.sin(matchTick * 0.12) * 0.05})`;
        ctx.fillRect(w - PITCH.boxWidth, boxTop, PITCH.boxWidth, PITCH.boxHeight);
      }

      const cornerZoneH = 74;
      const pulseAlpha = 0.24 + Math.sin(matchTick * 0.12) * 0.08;
      ctx.fillStyle = superFlowActive
        ? `rgba(253, 224, 71, ${pulseAlpha + 0.12})`
        : `rgba(56, 189, 248, ${pulseAlpha})`;
      ctx.fillRect(w - 24, goalTop + 4, 24, cornerZoneH);
      ctx.fillRect(w - 24, goalBot - cornerZoneH - 4, 24, cornerZoneH);
      ctx.restore();

      // 5. Deformable 13-Node Spring Goals with Stepped 16-Bit Pixel Mesh Nets (contrasting kit colors)
      drawPixelGoal(ctx, true, goalTop, goalBot, netNodesLeft, userKitChoice);
      drawPixelGoal(ctx, false, goalTop, goalBot, netNodesRight, userKitChoice);

      // 6. 3D-Extruded Chamfered Cage Boundary Walls + Metallic Corner Caps
      ctx.save();
      ctx.lineCap = 'square';
      ctx.lineJoin = 'bevel';

      const strokeCage = (ox: number, oy: number, width: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(ox, goalTop + oy);
        ctx.lineTo(ox, c + oy);
        ctx.lineTo(c + ox, oy);
        ctx.lineTo(w - c + ox, oy);
        ctx.lineTo(w + ox, c + oy);
        ctx.lineTo(w + ox, goalTop + oy);
        ctx.moveTo(ox, goalBot + oy);
        ctx.lineTo(ox, h - c + oy);
        ctx.lineTo(c + ox, h + oy);
        ctx.lineTo(w - c + ox, h + oy);
        ctx.lineTo(w + ox, h - c + oy);
        ctx.lineTo(w + ox, goalBot + oy);
        ctx.stroke();
      };

      strokeCage(0, 6, 16, GRAPHICS_CONFIG.palette.cage.wallExtrude);
      strokeCage(
        0,
        0,
        11,
        superFlowActive ? '#fef08a' : GRAPHICS_CONFIG.palette.cage.wallTop
      );
      strokeCage(0, -2, 3, '#ffffff');

      const cornerCaps = [
        { x: c, y: 0 },
        { x: 0, y: c },
        { x: w - c, y: 0 },
        { x: w, y: c },
        { x: c, y: h },
        { x: 0, y: h - c },
        { x: w - c, y: h },
        { x: w, y: h - c },
      ];
      for (const pt of cornerCaps) {
        fillPxRect(ctx, pt.x - 8, pt.y - 8, 16, 16, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(
          ctx,
          pt.x - 5,
          pt.y - 5,
          10,
          10,
          superFlowActive
            ? GRAPHICS_CONFIG.palette.cage.cornerCapSuper
            : GRAPHICS_CONFIG.palette.cage.cornerCap,
          px
        );
      }

      // Flashing wall impact sparks
      for (const wg of wallGlows) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${wg.alpha})`;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(wg.x1, wg.y1);
        ctx.lineTo(wg.x2, wg.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawTacticalOverlays() {
      if (!ctx || gameState !== 'PLAYING') return;

      const youPlayers = players.filter((p) => p.team === 'YOU');
      if (youPlayers.length === 3 && isTeamInPossession('YOU')) {
        ctx.save();
        ctx.strokeStyle =
          flowCombo >= PASSES_FOR_FLOW_BOOST
            ? 'rgba(250, 204, 21, 0.24)'
            : 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(youPlayers[0].x, youPlayers[0].y);
        ctx.lineTo(youPlayers[1].x, youPlayers[1].y);
        ctx.lineTo(youPlayers[2].x, youPlayers[2].y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // Clean Modern Non-Pixel Vector Teammate Runner Path & Through-Ball Meeting Ring
      for (const p of youPlayers) {
        if (p.commandedRunTimer > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.88)';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.commandedTargetX, p.commandedTargetY);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
          ctx.beginPath();
          ctx.arc(p.commandedTargetX, p.commandedTargetY, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.commandedTargetX, p.commandedTargetY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (!ball.owner && ball.lastTouchTeam === 'YOU' && !ball.isShot && ball.passTarget && ball.isThroughBall) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(ball.passTarget.x, ball.passTarget.y);
        ctx.lineTo(ball.passTargetX, ball.passTargetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(ball.passTargetX, ball.passTargetY, 18 + Math.sin(matchTick * 0.2) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (controlledPlayer && ball.owner === controlledPlayer) {
        const actor = controlledPlayer;
        const aim = getActivePlayerAimVector(actor);
        const decision = evaluateKickDecision(actor, aim.x, aim.y);
        const superFlowActive = flowCombo >= PASSES_FOR_FLOW_BOOST;
        const isSweet = isSweetSpotCharge(kickChargeState.power);

        if (decision.type === 'SHOOT' && decision.shotTargetX !== undefined && decision.shotTargetY !== undefined) {
          const { shotSpeed, appliedSpin } = computeShotSpinAndSpeed(
            decision.suggestedSpin || 0,
            kickChargeState.power,
            superFlowActive,
            isSweet,
            false,
            true
          );
          drawCurvedTrajectoryPreview(
            ctx,
            actor.x,
            actor.y,
            decision.shotTargetX,
            decision.shotTargetY,
            appliedSpin,
            kickChargeState.power,
            superFlowActive,
            true,
            shotSpeed
          );
        } else if (decision.type === 'PASS' && (decision.bestMate || decision.passTargetX !== undefined)) {
          const targetX = decision.passTargetX ?? (decision.bestMate ? decision.bestMate.x : actor.x + decision.dirX * 360);
          const targetY = decision.passTargetY ?? (decision.bestMate ? decision.bestMate.y : actor.y + decision.dirY * 360);
          const { passSpeed, appliedSpin } = computePassSpinAndSpeed(
            decision.suggestedSpin || 0,
            kickChargeState.power,
            flowCombo,
            isSweet,
            false
          );
          drawCurvedTrajectoryPreview(
            ctx,
            actor.x,
            actor.y,
            targetX,
            targetY,
            appliedSpin,
            kickChargeState.power,
            superFlowActive,
            false,
            passSpeed
          );
        } else if (decision.type === 'KEEPER_PASS' && decision.keeperTarget) {
          const k = decision.keeperTarget;
          drawCurvedTrajectoryPreview(ctx, actor.x, actor.y, k.x, k.y, 0, 0, false, false, 21.0);
        } else if (decision.wallBouncePoint) {
          const wb = decision.wallBouncePoint;
          drawCurvedTrajectoryPreview(ctx, actor.x, actor.y, wb.x, wb.y, 0, kickChargeState.power, true, false, 22.0);
          drawCurvedTrajectoryPreview(ctx, wb.x, wb.y, wb.refX, wb.refY, 0, kickChargeState.power, true, false, 20.0);
        } else {
          drawCurvedTrajectoryPreview(
            ctx,
            actor.x,
            actor.y,
            actor.x + decision.dirX * 260,
            actor.y + decision.dirY * 260,
            0,
            kickChargeState.power,
            superFlowActive,
            false,
            21.5
          );
        }
      }
    }

    function drawEntities() {
      if (!ctx) return;
      const superFlowActive = flowCombo >= PASSES_FOR_FLOW_BOOST;

      // 1. Clean Modern Vector Ripples
      for (const rp of ripples) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, rp.alpha);
        ctx.strokeStyle = rp.color;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Pixel Sprint Afterimages (respecting Home/Away kit selection)
      for (const ai of afterimages) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ai.alpha * 0.72);
        const aiKit = ai.team === 'YOU' ? userKitChoice : getContrastingKit(userKitChoice);
        ctx.fillStyle = aiKit === 'HOME' ? '#38bdf8' : '#fb7185';
        ctx.fillRect(
          Math.round(ai.x - ai.radius * 0.65),
          Math.round(ai.y - ai.radius * 0.65),
          Math.round(ai.radius * 1.3),
          Math.round(ai.radius * 1.3)
        );
        ctx.restore();
      }

      // 3. Draw Auto-Goalkeepers via 16-bit Pixel Renderer
      for (const k of keepers) {
        drawPixelKeeper(ctx, k, userKitChoice);
      }

      // 4. Draw Outfield Players via 16-bit Pixel Renderer (Y-sorted)
      const sortedPlayers = [
        players[0],
        players[1],
        players[2],
        players[3],
        players[4],
        players[5],
      ].filter(Boolean);
      sortedPlayers.sort((a, b) => a.y - b.y);

      const youInPoss = isTeamInPossession('YOU');
      for (const p of sortedPlayers) {
        const isYou = p.team === 'YOU';
        const isControlled = p === controlledPlayer && isYou;
        const aim = isControlled ? getActivePlayerAimVector(p) : { x: Math.cos(p.angle), y: Math.sin(p.angle) };
        const aimAng = Math.atan2(aim.y, aim.x);

        drawPixelPlayer(ctx, p, {
          isControlled,
          superFlow: isYou && superFlowActive,
          matchTick,
          aimAngle: aimAng,
          chargePower: isControlled && ball.owner === p ? kickChargeState.power : 0,
          isOpenLane: isYou && youInPoss && p.isOpenLane,
          queuedOneTouch: isControlled && queuedOneTouchTimer > 0,
          opponentTag: !isYou && ball.owner === p ? currentOpponent.tag : undefined,
          userKit: userKitChoice,
        });
      }

      // 5. Draw Multi-Frame 16-Bit Pixel Soccer Ball & Decoupled Loft Shadow
      const isGoldenBall =
        ball.isSuperStrike || (ball.lastTouchTeam === 'YOU' && superFlowActive);
      drawPixelBall(ctx, ball, isGoldenBall);

      // 6. Pixel Burst Particles & Confetti
      for (const pt of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x - pt.size), Math.round(pt.y - pt.size), Math.round(pt.size * 2), Math.round(pt.size * 2));
        ctx.restore();
      }

      for (const cf of confetti) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, cf.alpha);
        ctx.fillStyle = cf.color;
        ctx.fillRect(Math.round(cf.x - cf.w * 0.5), Math.round(cf.y - cf.h * 0.5), Math.round(cf.w), Math.round(cf.h));
        ctx.restore();
      }

      // 7. Arcade Floating Callouts with Clean Pill Backing Plates
      for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = '800 13.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(ft.text).width + 16;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.roundRect(ft.x - textW / 2, ft.y - 13, textW, 21, 7);
        ctx.fill();
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y + 1);
        ctx.restore();
      }

      // 8. Clean Non-Pixel Modern Vector Mouse Pointer / Arcade Target Reticle
      if (activeControlScheme === 'MOUSE' && mouseState.active && gameState === 'PLAYING') {
        const inSweet = kickChargeState.power >= SWEET_SPOT_MIN && kickChargeState.power <= SWEET_SPOT_MAX;
        drawPixelReticle(
          ctx,
          mouseState.worldX,
          mouseState.worldY,
          controlledPlayer ? controlledPlayer.x : null,
          controlledPlayer ? controlledPlayer.y : null,
          kickChargeState.power,
          inSweet,
          superFlowActive,
          youInPoss,
          matchTick
        );
      }
    }

    function updateCameraAndVFX() {
      if (ledBannerTimer > 0) ledBannerTimer = Math.max(0, ledBannerTimer - dtScale);
      if (stadiumFlashAlpha > 0) stadiumFlashAlpha = Math.max(0, stadiumFlashAlpha - 0.03 * dtScale);
      if (screenShake > 0) screenShake = Math.max(0, screenShake - 0.85 * dtScale);
      if (crowdExcitement > 0) crowdExcitement = Math.max(0, crowdExcitement - 0.008 * dtScale);

      sound.updateCrowdAmbience(crowdExcitement, gameState === 'PLAYING' || gameState === 'GOAL_CELEBRATION');

      // Frame-rate independent exponential damping on current-frame positions (zero 1-frame camera lag)
      const isIdleMenuState = gameState === 'SPLASH' || gameState === 'MENU';
      let targetCamX: number;
      let targetCamY: number;
      let targetZoom = 1.04;

      if (isIdleMenuState) {
        // Gentle scenic stadium pan while in Splash or Home Menu so the pitch never looks like a frozen old match
        targetCamX = PITCH.width * 0.5 + Math.sin(matchTick * 0.008) * 140;
        targetCamY = PITCH.height * 0.5 + Math.cos(matchTick * 0.006) * 55;
        targetZoom = 1.02;
      } else {
        const focusX = ball.x * 0.65 + (controlledPlayer ? controlledPlayer.x * 0.35 : PITCH.width * 0.175);
        const focusY = ball.y * 0.65 + (controlledPlayer ? controlledPlayer.y * 0.35 : PITCH.height * 0.175);
        const isPortrait = canvas ? canvas.width < canvas.height : false;
        const isMobOrTab = isMobileOrTabletViewport();
        const panFactorX = isPortrait ? 0.78 : isMobOrTab ? 0.56 : 0.14;
        const panFactorY = isPortrait ? 0.40 : isMobOrTab ? 0.38 : 0.12;
        const rawCamX = PITCH.width * 0.5 + (focusX - PITCH.width * 0.5) * panFactorX;
        const rawCamY = PITCH.height * 0.5 + (focusY - PITCH.height * 0.5) * panFactorY;
        const clampMarginX = isPortrait ? 0.14 : isMobOrTab ? 0.18 : 0.22;
        const clampMarginY = isPortrait ? 0.20 : isMobOrTab ? 0.22 : 0.28;
        targetCamX = Math.max(PITCH.width * clampMarginX, Math.min(PITCH.width * (1 - clampMarginX), rawCamX));
        targetCamY = Math.max(PITCH.height * clampMarginY, Math.min(PITCH.height * (1 - clampMarginY), rawCamY));
        if (gameState === 'GOAL_CELEBRATION') {
          targetZoom = 1.1;
        } else if (kickChargeState.power > 0.25) {
          targetZoom = 1.04 + kickChargeState.power * 0.035;
        }
      }

      const camLerp = 1 - Math.pow(0.88, dtScale);
      cam.x += (targetCamX - cam.x) * camLerp;
      cam.y += (targetCamY - cam.y) * camLerp;
      cam.zoom += (targetZoom - cam.zoom) * camLerp;
      updateMouseWorldCoords();

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += (rp.maxR - rp.r) * 0.18 * dtScale;
        rp.alpha -= 0.045 * dtScale;
        if (rp.alpha <= 0.02) ripples.splice(i, 1);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * dtScale;
        pt.y += pt.vy * dtScale;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.alpha -= 0.038 * dtScale;
        if (pt.alpha <= 0.02) particles.splice(i, 1);
      }
      for (let i = turfScuffs.length - 1; i >= 0; i--) {
        turfScuffs[i].alpha -= 0.004 * dtScale;
        if (turfScuffs[i].alpha <= 0.02) turfScuffs.splice(i, 1);
      }
      for (let i = afterimages.length - 1; i >= 0; i--) {
        afterimages[i].alpha -= 0.035 * dtScale;
        if (afterimages[i].alpha <= 0.02) afterimages.splice(i, 1);
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const cf = confetti[i];
        cf.x += cf.vx * dtScale;
        cf.y += cf.vy * dtScale;
        cf.vx *= 0.96;
        cf.vy = cf.vy * 0.96 + 0.12 * dtScale;
        cf.rot += cf.vRot * dtScale;
        cf.alpha -= 0.012 * dtScale;
        if (cf.alpha <= 0.02) confetti.splice(i, 1);
      }
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dtScale;
        ft.alpha -= 0.024 * dtScale;
        if (ft.alpha <= 0.02) floatingTexts.splice(i, 1);
      }
      for (let i = wallGlows.length - 1; i >= 0; i--) {
        wallGlows[i].alpha -= 0.05 * dtScale;
        if (wallGlows[i].alpha <= 0.02) wallGlows.splice(i, 1);
      }
    }

    const menuOverlay = document.getElementById('menuOverlay');
    const startBtn = document.getElementById('startBtn');
    const startBtnText = document.getElementById('startBtnText');
    const rematchSameBtn = document.getElementById('rematchSameBtn');
    const mainMenuBtn = document.getElementById('mainMenuBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const forfeitBtn = document.getElementById('forfeitBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const howToPlayBtn = document.getElementById('howToPlayBtn');
    const howToPlayPanel = document.getElementById('howToPlayPanel');

    function clearOldMatchArtifacts() {
      scoreYou = 0;
      scoreAi = 0;
      matchTime = MATCH_DURATION_SECONDS;
      isGoldenGoal = false;
      flowCombo = 0;
      cpuPassCombo = 0;
      goalBannerTimer = 0;
      screenShake = 0;
      stadiumFlashAlpha = 0;
      crowdExcitement = 0.08;
      ripples.length = 0;
      particles.length = 0;
      floatingTexts.length = 0;
      wallGlows.length = 0;
      turfScuffs.length = 0;
      afterimages.length = 0;
      confetti.length = 0;
      ball.trail = [];

      const syEl = document.getElementById('scoreYou');
      const saEl = document.getElementById('scoreAi');
      const tmEl = document.getElementById('timerText');
      if (syEl) syEl.innerText = '0';
      if (saEl) saEl.innerText = '0';
      if (tmEl) tmEl.innerText = formatMatchTimer(MATCH_DURATION_SECONDS);
      updateFlowHud();
      resetPositionsForKickoff('YOU');
      cam.x = PITCH.width * 0.5;
      cam.y = PITCH.height * 0.5;
      cam.zoom = 1.02;
    }

    function returnToHomeMenu() {
      sound.unlock();
      sound.setMenuMode(true);
      clearMatchmakingTimers();
      const winOverlay = document.getElementById('tournamentWinOverlay');
      if (winOverlay) winOverlay.classList.add('hidden');
      const vsOverlay = document.getElementById('preMatchVsOverlay');
      if (vsOverlay) vsOverlay.classList.add('hidden');
      if (currentGameMode === 'TOURNAMENT') {
        tournamentRound = 0;
        tournamentBracket.initialized = false;
      }
      triggerScreenTransition(() => {
        clearOldMatchArtifacts();
        gameState = 'MENU';
        syncBodyStateAttr('MENU');
        syncMenuLayoutForState('MENU');

        const titleEl = document.getElementById('menuTitleVisible');
        const srTitleEl = document.getElementById('menuTitle');
        const subEl = document.getElementById('menuSubtitle');
        const statsRow = document.getElementById('matchStatsRow');
        const playlistWrap = document.getElementById('playlistSelectorWrap');
        const kitWrap = document.getElementById('kitSelectorWrap');
        const pitchWrap = document.getElementById('pitchSelectorWrap');

        if (titleEl) {
          titleEl.innerHTML = `REMATCH <span class="px-2.5 py-0.5 rounded-xl bg-amber-300 border-2 border-slate-900 font-mono-num text-sm md:text-base font-black text-slate-900 shadow-[0_2px_0_#0f172a]">0.2</span>`;
        }
        if (srTitleEl) srTitleEl.innerText = 'REMATCH 0.2';
        if (subEl) {
          subEl.innerText = '';
          subEl.classList.add('hidden');
        }
        if (statsRow) {
          statsRow.classList.add('hidden');
          statsRow.classList.remove('grid');
        }
        if (playlistWrap) playlistWrap.classList.remove('hidden');
        if (kitWrap) kitWrap.classList.remove('hidden');
        if (pitchWrap) pitchWrap.classList.remove('hidden');
        if (resumeBtn) resumeBtn.classList.add('hidden');
        if (forfeitBtn) forfeitBtn.classList.add('hidden');
        if (rematchSameBtn) rematchSameBtn.classList.add('hidden');
        if (mainMenuBtn) mainMenuBtn.classList.add('hidden');

        setMatchmakingIdleUI();
        if (menuOverlay) menuOverlay.classList.remove('hidden');
        syncMenuFocusVisual(true);
      });
    }

    function openTournamentWinCelebration(possPct: number) {
      sound.playTournamentWin();
      spawnGoalConfetti(0, PITCH.height * 0.5, 'YOU');
      spawnGoalConfetti(PITCH.width, PITCH.height * 0.5, 'YOU');
      spawnGoalConfetti(PITCH.width * 0.5, PITCH.height * 0.35, 'YOU');

      const winOverlay = document.getElementById('tournamentWinOverlay');
      const winAvatar = document.getElementById('tourneyWinAvatar');
      const winPlayerName = document.getElementById('tourneyWinPlayerName');
      const winQfRecap = document.getElementById('tourneyWinQfRecap');
      const winSfRecap = document.getElementById('tourneyWinSfRecap');
      const winGfRecap = document.getElementById('tourneyWinGfRecap');
      const winGoalsStat = document.getElementById('tourneyWinGoalsStat');
      const winComboStat = document.getElementById('tourneyWinComboStat');
      const winPassesStat = document.getElementById('tourneyWinPassesStat');
      const winPossStat = document.getElementById('tourneyWinPossStat');

      const youIsHome = userKitChoice === 'HOME';
      if (winAvatar) {
        winAvatar.className = youIsHome
          ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-sky-400 border-[3px] border-slate-900 text-slate-900 font-black text-xl flex flex-col items-center justify-center shadow-[0_5px_0_#0f172a] relative overflow-hidden shrink-0'
          : 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-rose-400 border-[3px] border-slate-900 text-white font-black text-xl flex flex-col items-center justify-center shadow-[0_5px_0_#0f172a] relative overflow-hidden shrink-0';
        winAvatar.innerHTML = getProfileAvatarInnerHtml(userProfile, youIsHome);
      }
      if (winPlayerName) winPlayerName.innerText = userProfile.name;
      if (winQfRecap) {
        winQfRecap.innerText = `vs ${tournamentBracket.qfOpponent.tag} (${tournamentBracket.scores.qfYou || 'W'})`;
      }
      if (winSfRecap) {
        winSfRecap.innerText = `vs ${tournamentBracket.sfOpponent.tag} (${tournamentBracket.scores.sfYou || 'W'})`;
      }
      if (winGfRecap) {
        winGfRecap.innerText = `vs ${tournamentBracket.gfOpponent.tag} (${tournamentBracket.scores.gfYou || 'W'})`;
      }
      if (winGoalsStat) {
        winGoalsStat.innerText = `${tournamentBracket.totalGoalsYou} - ${tournamentBracket.totalGoalsAi}`;
      }
      if (winComboStat) winComboStat.innerText = `x${maxFlowCombo}`;
      if (winPassesStat) winPassesStat.innerText = String(totalPassesYou);
      if (winPossStat) winPossStat.innerText = `${possPct}%`;

      if (menuOverlay) menuOverlay.classList.add('hidden');
      if (winOverlay) winOverlay.classList.remove('hidden');
    }

    function endMatch(reason = '') {
      gameState = 'MATCH_OVER';
      sound.setMenuMode(true);
      syncBodyStateAttr(gameState);
      syncMenuLayoutForState('MATCH_OVER');
      sound.playWhistle();

      const titleEl = document.getElementById('menuTitleVisible');
      const srTitleEl = document.getElementById('menuTitle');
      const subEl = document.getElementById('menuSubtitle');
      const statsRow = document.getElementById('matchStatsRow');
      const rematchSameText = document.getElementById('rematchSameText');
      const playlistWrap = document.getElementById('playlistSelectorWrap');
      const kitWrap = document.getElementById('kitSelectorWrap');
      const pitchWrap = document.getElementById('pitchSelectorWrap');

      const youWon = scoreYou > scoreAi;
      const possPct = Math.round((possessionFramesYou / Math.max(1, possessionFramesTotal)) * 100);
      let nextBtnLabel = 'FIND NEW MATCH';
      let showRematchBtn = true;
      let isTournamentChampion = false;

      if (subEl) subEl.classList.remove('hidden');

      if (currentGameMode === 'TOURNAMENT') {
        showRematchBtn = false;
        const scoreStr = `${scoreYou}-${scoreAi}`;
        tournamentBracket.totalGoalsYou += scoreYou;
        tournamentBracket.totalGoalsAi += scoreAi;
        if (tournamentRound === 0) tournamentBracket.scores.qfYou = scoreStr;
        else if (tournamentRound === 1) tournamentBracket.scores.sfYou = scoreStr;
        else tournamentBracket.scores.gfYou = scoreStr;

        if (youWon) {
          if (tournamentRound < TOTAL_TOURNAMENT_GAMES - 1) {
            tournamentRound++;
            const nextRoundName = TOURNAMENT_ROUNDS[tournamentRound];
            if (titleEl) titleEl.innerHTML = `ROUND WON <span class="font-light text-emerald-500">·</span> ${scoreYou}-${scoreAi}`;
            if (srTitleEl) srTitleEl.innerText = `ROUND WON ${scoreYou}-${scoreAi}`;
            if (subEl) subEl.innerText = `Advanced to ${nextRoundName} (Game ${tournamentRound + 1} of ${TOTAL_TOURNAMENT_GAMES})!`;
            nextBtnLabel = `PLAY ${nextRoundName.toUpperCase()} (${tournamentRound + 1}/${TOTAL_TOURNAMENT_GAMES})`;
          } else {
            isTournamentChampion = true;
            if (titleEl) titleEl.innerHTML = `CHAMPION! <span class="font-light text-amber-500">·</span> ${scoreYou}-${scoreAi}`;
            if (srTitleEl) srTitleEl.innerText = `TOURNAMENT CHAMPION ${scoreYou}-${scoreAi}`;
            if (subEl) subEl.innerText = `3-0 Knockout Sweep! You won the Knockout Cup vs ${currentOpponent.tag}!`;
            tournamentRound = 0;
            tournamentBracket.initialized = false;
            nextBtnLabel = 'ENTER NEW TOURNAMENT';
          }
        } else {
          const knockedOutRound = TOURNAMENT_ROUNDS[tournamentRound];
          if (titleEl) titleEl.innerHTML = `ELIMINATED <span class="font-light text-rose-500">·</span> ${scoreYou}-${scoreAi}`;
          if (srTitleEl) srTitleEl.innerText = `ELIMINATED ${scoreYou}-${scoreAi}`;
          if (subEl) subEl.innerText = `Knocked out in the ${knockedOutRound} by ${currentOpponent.tag}.`;
          tournamentRound = 0;
          tournamentBracket.initialized = false;
          nextBtnLabel = 'ENTER NEW TOURNAMENT';
        }
      } else {
        if (youWon) {
          if (titleEl) titleEl.innerHTML = `VICTORY <span class="font-light text-sky-500">·</span> ${scoreYou}-${scoreAi}`;
          if (srTitleEl) srTitleEl.innerText = `VICTORY ${scoreYou}-${scoreAi}`;
          if (subEl) subEl.innerText = reason || `You defeated ${currentOpponent.tag}!`;
        } else if (scoreAi > scoreYou) {
          if (titleEl) titleEl.innerHTML = `FULL TIME <span class="font-light text-rose-400">·</span> ${scoreYou}-${scoreAi}`;
          if (srTitleEl) srTitleEl.innerText = `FULL TIME ${scoreYou}-${scoreAi}`;
          if (subEl) subEl.innerText = reason || `${currentOpponent.tag} took the win!`;
        } else {
          if (titleEl) titleEl.innerHTML = `DRAW <span class="font-light text-slate-400">·</span> ${scoreYou}-${scoreAi}`;
          if (srTitleEl) srTitleEl.innerText = `DRAW ${scoreYou}-${scoreAi}`;
          if (subEl) subEl.innerText = `Evenly matched against ${currentOpponent.tag}!`;
        }
      }

      const spEl = document.getElementById('statPasses');
      const scEl = document.getElementById('statCombo');
      const ssEl = document.getElementById('statShots');
      const spoEl = document.getElementById('statPossession');

      if (spEl) spEl.innerText = String(totalPassesYou);
      if (scEl) scEl.innerText = `x${maxFlowCombo}`;
      if (ssEl) ssEl.innerText = String(totalShotsYou);
      if (spoEl) spoEl.innerText = `${possPct}%`;

      if (statsRow) {
        statsRow.classList.remove('hidden');
        statsRow.classList.add('grid');
      }
      if (playlistWrap) playlistWrap.classList.add('hidden');
      if (kitWrap) kitWrap.classList.add('hidden');
      if (pitchWrap) pitchWrap.classList.add('hidden');

      setMatchmakingIdleUI();
      if (startBtnText) startBtnText.innerText = nextBtnLabel;

      if (rematchSameBtn && rematchSameText) {
        if (showRematchBtn) {
          rematchSameText.innerText = `Rematch vs ${currentOpponent.tag}`;
          rematchSameBtn.classList.remove('hidden');
        } else {
          rematchSameBtn.classList.add('hidden');
        }
      }
      if (mainMenuBtn) mainMenuBtn.classList.remove('hidden');
      if (resumeBtn) resumeBtn.classList.add('hidden');
      if (forfeitBtn) forfeitBtn.classList.add('hidden');

      // Reset background pitch cleanly so the ended game isn't awkwardly sitting mid-play behind the summary
      resetPositionsForKickoff('YOU');

      triggerScreenTransition(() => {
        if (isTournamentChampion) {
          openTournamentWinCelebration(possPct);
        } else {
          if (menuOverlay) menuOverlay.classList.remove('hidden');
          syncMenuFocusVisual(true);
        }
      });
    }

    function pickRandomPitchArena() {
      const randomTheme = PITCH_THEMES[Math.floor(Math.random() * PITCH_THEMES.length)];
      selectedPitchTheme = randomTheme.id;
      applyPitchTheme(selectedPitchTheme);
      rebuildStaticPitchCache();
    }

    function populateTournamentBracketVisual() {
      const bracketSec = document.getElementById('vsTournamentBracketSection');
      if (!bracketSec) return;
      if (currentGameMode !== 'TOURNAMENT') {
        bracketSec.classList.add('hidden');
        return;
      }
      bracketSec.classList.remove('hidden');

      const setElText = (id: string, txt: string) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
      };

      setElText('brkYouNameQf', userProfile.name);
      setElText('brkOppNameQf', tournamentBracket.qfOpponent.tag);
      setElText('brkScoreQf1', tournamentRound === 0 ? 'NOW' : tournamentBracket.scores.qfYou || 'W');

      setElText('brkB1NameQf', tournamentBracket.sfOpponent.tag);
      setElText('brkB2NameQf', tournamentBracket.otherQfLoserB.tag);
      setElText('brkScoreQf2', tournamentRound >= 1 ? '2-1' : 'QF 2');

      setElText('brkC1NameQf', tournamentBracket.otherSfLoser.tag);
      setElText('brkC2NameQf', tournamentBracket.otherQfLoserC.tag);
      setElText('brkScoreQf3', tournamentRound >= 1 ? '2-0' : 'QF 3');

      setElText('brkD1NameQf', tournamentBracket.gfOpponent.tag);
      setElText('brkD2NameQf', tournamentBracket.otherQfLoserD.tag);
      setElText('brkScoreQf4', tournamentRound >= 1 ? '3-1' : 'QF 4');

      // Semi-Finals
      setElText('brkYouNameSf', tournamentRound >= 1 ? userProfile.name : 'Winner QF 1');
      setElText('brkOppNameSf', tournamentRound >= 1 ? tournamentBracket.sfOpponent.tag : 'Winner QF 2');
      setElText('brkScoreSf1', tournamentRound === 1 ? 'NOW' : tournamentRound > 1 ? tournamentBracket.scores.sfYou || 'W' : 'SF 1');

      setElText('brkGfOppNameSf', tournamentRound >= 1 ? tournamentBracket.gfOpponent.tag : 'Winner QF 4');
      setElText('brkOtherSfName', tournamentRound >= 1 ? tournamentBracket.otherSfLoser.tag : 'Winner QF 3');
      setElText('brkScoreSf2', tournamentRound >= 2 ? '2-1' : 'SF 2');

      // Grand Final
      setElText('brkYouNameGf', tournamentRound >= 2 ? userProfile.name : 'Winner SF 1');
      setElText('brkOppNameGf', tournamentRound >= 2 ? tournamentBracket.gfOpponent.tag : 'Winner SF 2');
      setElText('brkScoreGf', tournamentRound === 2 ? 'FINAL' : 'CUP');

      const qfCard = document.getElementById('brkMatchCardQf1');
      const sfCard = document.getElementById('brkMatchCardSf1');
      const gfCard = document.getElementById('brkMatchCardGf');

      if (qfCard) {
        qfCard.className =
          tournamentRound === 0
            ? 'p-2 rounded-xl bg-amber-200 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left transition-all'
            : 'p-2 rounded-xl bg-emerald-100 border-2 border-emerald-700 text-left opacity-90';
      }
      if (sfCard) {
        sfCard.className =
          tournamentRound === 1
            ? 'p-2.5 rounded-xl bg-amber-200 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left transition-all'
            : tournamentRound > 1
              ? 'p-2.5 rounded-xl bg-emerald-100 border-2 border-emerald-700 text-left opacity-90'
              : 'p-2.5 rounded-xl bg-white border border-slate-300 text-left opacity-75';
      }
      if (gfCard) {
        gfCard.className =
          tournamentRound === 2
            ? 'p-3 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-200 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-left transition-all'
            : 'p-3 rounded-2xl bg-white border-2 border-dashed border-amber-400 text-left opacity-80';
      }
    }

    function populatePreMatchVsOverlay() {
      // Select a random pitch arena for the upcoming match so each game features a fresh aesthetic
      pickRandomPitchArena();

      const vsOverlay = document.getElementById('preMatchVsOverlay');
      const vsModeLabel = document.getElementById('vsOverlayModeLabel');
      const vsPitchLabel = document.getElementById('vsOverlayPitchLabel');
      const vsYouAvatar = document.getElementById('vsOverlayYouAvatar');
      const vsYouName = document.getElementById('vsOverlayYouName');
      const vsYouRankPill = document.getElementById('vsOverlayYouRank');
      const vsOppAvatar = document.getElementById('vsOverlayOppAvatar');
      const vsOppName = document.getElementById('vsOverlayOppName');
      const vsOppRankPill = document.getElementById('vsOverlayOppRank');

      const youIsHome = userKitChoice === 'HOME';
      const cpuWearsAway = getContrastingKit(userKitChoice) === 'AWAY';
      const preset = getActiveDifficultyPreset();
      const activeTheme = PITCH_THEMES.find((t) => t.id === selectedPitchTheme) || PITCH_THEMES[0];
      const showRank = currentGameMode !== 'CASUAL';

      if (vsModeLabel) {
        vsModeLabel.innerText =
          currentGameMode === 'TOURNAMENT'
            ? `KNOCKOUT CUP • ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} (MATCH ${tournamentRound + 1}/3)`
            : currentGameMode === 'RANKED'
              ? 'RANKED 1V1 CHAMPIONSHIP'
              : 'CASUAL 1V1 EXHIBITION';
      }
      if (vsPitchLabel) {
        vsPitchLabel.innerText = `${activeTheme.name.toUpperCase()} ARENA • FIRST TO +${MERCY_RULE_LEAD} OR 02:00`;
      }
      if (vsYouName) vsYouName.innerText = userProfile.name;
      if (vsYouAvatar) {
        vsYouAvatar.className = youIsHome
          ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-sky-400 border-[3px] border-slate-900 text-slate-900 font-black text-lg flex flex-col items-center justify-center shadow-[0_4px_0_#0f172a] mb-2 relative overflow-hidden'
          : 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-rose-400 border-[3px] border-slate-900 text-white font-black text-lg flex flex-col items-center justify-center shadow-[0_4px_0_#0f172a] mb-2 relative overflow-hidden';
        vsYouAvatar.innerHTML = getProfileAvatarInnerHtml(userProfile, youIsHome);
      }
      if (vsYouRankPill) {
        if (showRank) {
          vsYouRankPill.classList.remove('hidden');
          vsYouRankPill.innerText = preset.userRankLabel;
        } else {
          vsYouRankPill.classList.add('hidden');
        }
      }

      if (vsOppName) vsOppName.innerText = currentOpponent.tag;
      if (vsOppAvatar) {
        vsOppAvatar.innerText = currentOpponent.initials;
        vsOppAvatar.className = cpuWearsAway
          ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-rose-500 border-[3px] border-slate-900 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-[0_4px_0_#0f172a] mb-2'
          : 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-sky-500 border-[3px] border-slate-900 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-[0_4px_0_#0f172a] mb-2';
      }
      if (vsOppRankPill) {
        if (showRank) {
          vsOppRankPill.classList.remove('hidden');
          vsOppRankPill.innerText = currentOpponent.rank;
        } else {
          vsOppRankPill.classList.add('hidden');
        }
      }

      populateTournamentBracketVisual();

      const vsStatusPromptText = document.getElementById('vsStatusPromptText');
      const vsKickoffNowBtnEl = document.getElementById('vsKickoffNowBtn');
      const vsBackToMenuBtnEl = document.getElementById('vsBackToMenuBtn');

      if (currentGameMode === 'TOURNAMENT') {
        const roundName = TOURNAMENT_ROUNDS[tournamentRound].toUpperCase();
        if (vsStatusPromptText) {
          vsStatusPromptText.innerText = 'BRACKET READY • PRESS START MATCH TO KICK OFF';
          vsStatusPromptText.className = 'text-xs font-black uppercase tracking-wider text-amber-700';
        }
        if (vsKickoffNowBtnEl) {
          vsKickoffNowBtnEl.innerText = `START ${roundName} MATCH ▶`;
          vsKickoffNowBtnEl.className =
            'indie-cta-btn min-h-[46px] py-2.5 px-6 rounded-2xl bg-amber-300 hover:bg-amber-200 text-slate-900 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer';
        }
        if (vsBackToMenuBtnEl) {
          vsBackToMenuBtnEl.classList.remove('hidden');
        }
      } else {
        if (vsStatusPromptText) {
          vsStatusPromptText.innerText = 'ENTERING STADIUM PITCH...';
          vsStatusPromptText.className = 'text-xs font-black uppercase tracking-widest text-emerald-600 animate-pulse';
        }
        if (vsKickoffNowBtnEl) {
          vsKickoffNowBtnEl.innerText = 'Kick Off Now ▶';
          vsKickoffNowBtnEl.className =
            'btn-clean min-h-[42px] py-2 px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-slate-900 text-slate-900 font-black text-xs uppercase tracking-wider shadow-[0_3px_0_#0f172a] cursor-pointer';
        }
        if (vsBackToMenuBtnEl) {
          vsBackToMenuBtnEl.classList.add('hidden');
        }
      }

      triggerScreenTransition(() => {
        if (vsOverlay) {
          vsOverlay.classList.remove('hidden');
        }
        if (menuOverlay) {
          menuOverlay.classList.add('hidden');
        }
        syncMobileControlsVisibility();
        gamepadState.focusedMenuIndex = 0;
        syncMenuFocusVisual(true);
      });
    }

    function launchMatchNow() {
      clearMatchmakingTimers();
      const vsOverlay = document.getElementById('preMatchVsOverlay');
      const winOverlay = document.getElementById('tournamentWinOverlay');
      if (vsOverlay) vsOverlay.classList.add('hidden');
      if (winOverlay) winOverlay.classList.add('hidden');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      Object.keys(keys).forEach((k) => (keys[k] = false));
      kickChargeState.active = false;
      kickChargeState.power = 0;

      applyPitchTheme(selectedPitchTheme);
      rebuildStaticPitchCache();

      sound.unlock();
      sound.setMenuMode(false);
      sound.startMusic(() => ({
        isPlaying: gameState === 'PLAYING' || gameState === 'GOAL_CELEBRATION',
        isSuperFlow: flowCombo >= PASSES_FOR_FLOW_BOOST,
        flowCombo,
      }));
      sound.playWhistle();
      scoreYou = 0;
      scoreAi = 0;
      matchTime = MATCH_DURATION_SECONDS;
      isGoldenGoal = false;
      maxFlowCombo = 0;
      totalPassesYou = 0;
      totalShotsYou = 0;
      possessionFramesYou = 1;
      possessionFramesTotal = 2;

      const syEl = document.getElementById('scoreYou');
      const saEl = document.getElementById('scoreAi');
      const tmEl = document.getElementById('timerText');
      if (syEl) syEl.innerText = '0';
      if (saEl) saEl.innerText = '0';
      if (tmEl) tmEl.innerText = formatMatchTimer(MATCH_DURATION_SECONDS);

      syncOpponentUi();
      applyDifficultySettings();
      resetPositionsForKickoff('YOU');
      const bannerTitle =
        currentGameMode === 'TOURNAMENT'
          ? `${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} (GAME ${tournamentRound + 1}/3): ${userProfile.name.toUpperCase()} VS ${currentOpponent.tag.toUpperCase()}`
          : `MATCH LIVE: ${userProfile.name.toUpperCase()} VS ${currentOpponent.tag.toUpperCase()}`;
      setLedBanner(bannerTitle, 210);
      gameState = 'PLAYING';
      syncBodyStateAttr(gameState);
      syncMenuLayoutForState('PLAYING');
      if (menuOverlay) menuOverlay.classList.add('hidden');
      updateHudState();
    }

    function applySearchingVisualState(step: number, elapsedSec: string, pct: number) {
      const card = document.getElementById('matchmakingCard');
      const mmStatusLabel = document.getElementById('mmStatusLabel');
      const mmStatusText = document.getElementById('mmStatusText');
      const mmStatusIcon = document.getElementById('mmStatusIcon');
      const oppCard = document.getElementById('mmOpponentSlotCard');
      const mmName = document.getElementById('mmOpponentName');
      const mmAvatar = document.getElementById('mmOpponentAvatar');
      const mmPingPill = document.getElementById('mmOpponentPingPill');
      const vsBadge = document.getElementById('mmVsBadge');
      const progressWrap = document.getElementById('mmProgressWrap');
      const progressBar = document.getElementById('mmProgressBar');
      const timerText = document.getElementById('mmSearchTimer');
      const startIcon = document.getElementById('startBtnIcon');

      const searchStages = [
        'Connecting to Matchmaking Service...',
        'Searching Active Queue for Opponent...',
        'Checking Rival Skill & Lobby Balance...',
        'Verifying Arena Sync & Team Kits...',
        'Locking Match Handshake...',
      ];
      const stageMsg = searchStages[Math.min(step, searchStages.length - 1)];
      const candidatePlayer = OCEANIA_PLAYERS[(step * 3 + tournamentRound) % OCEANIA_PLAYERS.length];

      if (card) card.className = 'lg:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-sky-50 border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
      if (mmStatusLabel) mmStatusLabel.className = 'flex items-center space-x-2 text-sky-800';
      if (mmStatusText) mmStatusText.innerText = stageMsg;
      if (mmStatusIcon) mmStatusIcon.className = 'fa-solid fa-satellite-dish fa-spin text-sky-600 text-xs';

      if (oppCard) oppCard.className = 'bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-sky-400 flex flex-col items-center justify-center text-center transition-all duration-300 min-w-0';
      if (vsBadge) vsBadge.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-sky-400 text-slate-900 text-xs font-black flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 animate-pulse';

      if (mmName) {
        mmName.innerText = step <= 1 ? 'Scanning Queue...' : `Checking ${candidatePlayer.tag.slice(0, 10)}…`;
        mmName.className = 'text-xs sm:text-sm font-black text-sky-700 truncate max-w-full px-1';
      }
      if (mmPingPill) {
        const pillMsg =
          currentGameMode === 'CASUAL'
            ? 'Casual Lobby'
            : step === 0
              ? 'Rank Filter'
              : candidatePlayer.rank;
        mmPingPill.innerHTML = `<span class="truncate">${pillMsg}</span>`;
        mmPingPill.className = 'inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-200 text-[10px] sm:text-[11px] font-extrabold text-sky-800 max-w-full';
      }
      if (mmAvatar) {
        mmAvatar.innerHTML = '<i class="fa-solid fa-tower-broadcast fa-fade text-sm text-sky-600"></i>';
        mmAvatar.className = 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-100 border-2 border-sky-400 text-sky-700 font-black text-base flex items-center justify-center mb-2 relative radar-ring shrink-0';
      }

      // No Skip Queue UI: button displays locked searching state
      if (startBtn) {
        startBtn.setAttribute('disabled', 'true');
        startBtn.className = 'indie-cta-btn w-full min-h-[52px] py-3.5 sm:py-4 px-6 rounded-2xl bg-slate-800 text-slate-200 font-black text-sm sm:text-lg tracking-wide cursor-wait flex items-center justify-center space-x-3 opacity-90';
      }
      if (startBtnText) startBtnText.innerText = 'SEARCHING FOR OPPONENT...';
      if (startIcon) startIcon.className = 'fa-solid fa-circle-notch fa-spin text-sm text-sky-300';

      if (progressWrap) progressWrap.classList.remove('hidden');
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (timerText) {
        timerText.classList.remove('hidden');
        timerText.innerText = `${elapsedSec}s`;
      }
    }

    function startMatch() {
      sound.unlock();
      if (isSearchingMatch || matchLaunchTimeout) {
        return;
      }
      sound.playUiClick();

      const winOverlay = document.getElementById('tournamentWinOverlay');
      if (winOverlay) winOverlay.classList.add('hidden');

      clearMatchmakingTimers();
      isSearchingMatch = true;
      hasMatchedOpponent = false;
      if (resumeBtn) resumeBtn.classList.add('hidden');
      if (forfeitBtn) forfeitBtn.classList.add('hidden');
      if (rematchSameBtn) rematchSameBtn.classList.add('hidden');
      if (mainMenuBtn) mainMenuBtn.classList.add('hidden');

      sound.playMatchmakingTick(0);
      applySearchingVisualState(0, '0.4', 18);

      let step = 0;
      const totalSteps = 5;

      matchmakingInterval = setInterval(() => {
        step++;
        sound.playMatchmakingTick(step);

        const pct = Math.min(100, Math.round(((step + 1) / (totalSteps + 1)) * 100));
        const elapsedSec = ((step + 1) * 0.4).toFixed(1);

        if (step < totalSteps) {
          applySearchingVisualState(step, elapsedSec, pct);
        } else {
          if (matchmakingInterval) clearInterval(matchmakingInterval);
          matchmakingInterval = null;
          isSearchingMatch = false;

          pickRandomOpponent(true);
          sound.playMatchFound();

          const card = document.getElementById('matchmakingCard');
          const mmStatusLabel = document.getElementById('mmStatusLabel');
          const mmStatusText = document.getElementById('mmStatusText');
          const mmStatusIcon = document.getElementById('mmStatusIcon');
          const vsBadge = document.getElementById('mmVsBadge');
          const progressBar = document.getElementById('mmProgressBar');
          const startIcon = document.getElementById('startBtnIcon');

          if (card) card.className = 'lg:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-emerald-50 border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
          if (mmStatusLabel) mmStatusLabel.className = 'flex items-center space-x-2 text-emerald-800';
          if (mmStatusText) mmStatusText.innerText = `Opponent Matched • ${currentOpponent.tag}`;
          if (mmStatusIcon) mmStatusIcon.className = 'fa-solid fa-circle-check text-emerald-600 text-xs';
          if (vsBadge) vsBadge.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-400 text-slate-900 text-xs font-black flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 scale-110 transition-all';
          if (progressBar) progressBar.style.width = '100%';

          if (startBtn) startBtn.className = 'indie-cta-btn w-full min-h-[52px] py-3.5 sm:py-4 px-6 rounded-2xl bg-emerald-400 text-slate-900 font-black text-sm sm:text-lg tracking-wide flex items-center justify-center space-x-3';
          if (startBtnText) startBtnText.innerText = 'LOADING INTO ARENA...';
          if (startIcon) startIcon.className = 'fa-solid fa-bolt text-sm';

          // Show Pre-Match Versus Screen featuring both players' profiles (plus Knockout Bracket in Tournament mode!)
          populatePreMatchVsOverlay();

          // In Tournament mode, stay on the Knockout Bracket screen until the player presses Start Match!
          if (currentGameMode === 'TOURNAMENT') {
            matchLaunchTimeout = null;
          } else {
            matchLaunchTimeout = setTimeout(() => {
              matchLaunchTimeout = null;
              triggerScreenTransition(() => {
                launchMatchNow();
              });
            }, 1900);
          }
        }
      }, 380);
    }

    function togglePauseMatch() {
      sound.init();
      sound.playUiClick();
      if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        sound.setMenuMode(true);
        syncBodyStateAttr(gameState);
        syncMenuLayoutForState('PAUSED');
        const titleEl = document.getElementById('menuTitleVisible');
        const srTitleEl = document.getElementById('menuTitle');
        const subEl = document.getElementById('menuSubtitle');
        const statsRow = document.getElementById('matchStatsRow');

        if (titleEl) titleEl.innerHTML = `PAUSED <span class="font-light text-slate-400">·</span> ${scoreYou}-${scoreAi}`;
        if (srTitleEl) srTitleEl.innerText = `PAUSED ${scoreYou}-${scoreAi}`;
        if (subEl) {
          subEl.classList.remove('hidden');
          subEl.innerText =
            currentGameMode === 'TOURNAMENT'
              ? `${TOURNAMENT_ROUNDS[tournamentRound]} (Game ${tournamentRound + 1}/3) vs ${currentOpponent.tag}`
              : `Match vs ${currentOpponent.tag}`;
        }
        if (statsRow) statsRow.classList.add('hidden');
        hasMatchedOpponent = true;
        syncOpponentUi();

        // In Pause Menu: hide lobby mode/kit selectors and show Resume Match + Forfeit Match
        const playlistWrap = document.getElementById('playlistSelectorWrap');
        const kitWrap = document.getElementById('kitSelectorWrap');
        if (playlistWrap) playlistWrap.classList.add('hidden');
        if (kitWrap) kitWrap.classList.add('hidden');
        if (startBtn) startBtn.classList.add('hidden');
        if (rematchSameBtn) rematchSameBtn.classList.add('hidden');
        if (mainMenuBtn) mainMenuBtn.classList.add('hidden');
        if (resumeBtn) resumeBtn.classList.remove('hidden');
        if (forfeitBtn) forfeitBtn.classList.remove('hidden');
        if (menuOverlay) menuOverlay.classList.remove('hidden');
        gamepadState.focusedMenuIndex = 0;
        syncMenuFocusVisual(true);
      } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        sound.setMenuMode(false);
        syncBodyStateAttr(gameState);
        syncMenuLayoutForState('PLAYING');
        if (menuOverlay) menuOverlay.classList.add('hidden');
      }
    }

    function handleForfeitMatch() {
      sound.init();
      sound.playUiBack();
      sound.playWhistle();
      returnToHomeMenu();
    }

    // --- Edit Profile & Device Camera Photo Capture Logic ---
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const profileNameInput = document.getElementById('profileNameInput') as HTMLInputElement | null;
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const clearPhotoBtn = document.getElementById('clearPhotoBtn');
    const profileCameraVideo = document.getElementById('profileCameraVideo') as HTMLVideoElement | null;
    const modalProfilePreviewImg = document.getElementById('modalProfilePreviewImg') as HTMLImageElement | null;
    const modalProfilePreviewInitials = document.getElementById('modalProfilePreviewInitials');
    const cameraStatusText = document.getElementById('cameraStatusText');
    let pendingAvatarDataUrl: string | null = userProfile.photoDataUrl;

    function stopProfileCameraStream() {
      if (activeCameraStream) {
        activeCameraStream.getTracks().forEach((track) => track.stop());
        activeCameraStream = null;
      }
      if (profileCameraVideo) {
        profileCameraVideo.srcObject = null;
        profileCameraVideo.classList.add('hidden');
      }
      if (capturePhotoBtn) {
        capturePhotoBtn.classList.add('hidden');
      }
      if (takePhotoBtn) {
        takePhotoBtn.classList.remove('hidden');
      }
    }

    function renderModalAvatarPreview(dataUrl: string | null) {
      const currentName = profileNameInput?.value.trim() || userProfile.name || 'Player';
      const initials =
        currentName
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 2)
          .toUpperCase() || 'PL';

      if (modalProfilePreviewImg && modalProfilePreviewInitials) {
        if (dataUrl) {
          modalProfilePreviewImg.src = dataUrl;
          modalProfilePreviewImg.classList.remove('hidden');
          modalProfilePreviewInitials.classList.add('hidden');
        } else {
          modalProfilePreviewImg.classList.add('hidden');
          modalProfilePreviewInitials.classList.remove('hidden');
          modalProfilePreviewInitials.innerText = initials;
        }
      }
      if (clearPhotoBtn) {
        clearPhotoBtn.classList.toggle('hidden', !dataUrl);
      }
    }

    function openEditProfileModal() {
      sound.init();
      sound.playSwitch();
      pendingAvatarDataUrl = userProfile.photoDataUrl;
      if (profileNameInput) {
        profileNameInput.value = userProfile.name;
      }
      if (cameraStatusText) {
        cameraStatusText.innerText = '';
        cameraStatusText.classList.add('hidden');
      }
      renderModalAvatarPreview(pendingAvatarDataUrl);
      if (editProfileModal) {
        editProfileModal.classList.remove('hidden');
      }
      gamepadState.focusedMenuIndex = 0;
      syncMenuFocusVisual(true);
    }

    function closeEditProfileModal() {
      stopProfileCameraStream();
      if (editProfileModal) {
        editProfileModal.classList.add('hidden');
      }
      syncMenuFocusVisual(true);
    }

    async function handleStartCameraCapture() {
      sound.init();
      if (cameraStatusText) {
        cameraStatusText.innerText = 'Requesting camera permission from your device...';
        cameraStatusText.className = 'text-[11px] font-bold text-sky-700 mb-2.5';
        cameraStatusText.classList.remove('hidden');
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        if (cameraStatusText) {
          cameraStatusText.innerText = 'Camera API is not available on this device/browser.';
          cameraStatusText.className = 'text-[11px] font-bold text-rose-600 mb-2.5';
        }
        return;
      }
      try {
        stopProfileCameraStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 320 } },
          audio: false,
        });
        activeCameraStream = stream;
        if (profileCameraVideo) {
          profileCameraVideo.srcObject = stream;
          profileCameraVideo.classList.remove('hidden');
          await profileCameraVideo.play().catch(() => {});
        }
        if (capturePhotoBtn) capturePhotoBtn.classList.remove('hidden');
        if (takePhotoBtn) takePhotoBtn.classList.add('hidden');
        if (cameraStatusText) {
          cameraStatusText.innerText = 'Camera active — click Capture Photo!';
          cameraStatusText.className = 'text-[11px] font-bold text-emerald-700 mb-2.5';
        }
        syncMenuFocusVisual(true);
      } catch {
        if (cameraStatusText) {
          cameraStatusText.innerText = 'Camera permission was declined or no camera was found.';
          cameraStatusText.className = 'text-[11px] font-bold text-rose-600 mb-2.5';
        }
      }
    }

    function handleSnapCameraPhoto() {
      if (!profileCameraVideo) return;
      sound.init();
      sound.playMatchFound();
      const vw = profileCameraVideo.videoWidth || 256;
      const vh = profileCameraVideo.videoHeight || 256;
      const side = Math.min(vw, vh);
      const sx = (vw - side) * 0.5;
      const sy = (vh - side) * 0.5;

      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 160;
      snapCanvas.height = 160;
      const sCtx = snapCanvas.getContext('2d');
      if (sCtx) {
        // Mirror horizontally for natural selfie preview
        sCtx.translate(160, 0);
        sCtx.scale(-1, 1);
        sCtx.drawImage(profileCameraVideo, sx, sy, side, side, 0, 0, 160, 160);
        pendingAvatarDataUrl = snapCanvas.toDataURL('image/jpeg', 0.86);
        renderModalAvatarPreview(pendingAvatarDataUrl);
      }
      stopProfileCameraStream();
      if (cameraStatusText) {
        cameraStatusText.innerText = 'Photo captured! Click Save Profile to apply.';
        cameraStatusText.className = 'text-[11px] font-bold text-emerald-700 mb-2.5';
        cameraStatusText.classList.remove('hidden');
      }
      syncMenuFocusVisual(true);
    }

    function handleClearProfilePhoto() {
      sound.init();
      sound.playSwitch();
      pendingAvatarDataUrl = null;
      renderModalAvatarPreview(null);
      syncMenuFocusVisual(true);
    }

    function handleSaveUserProfile() {
      sound.init();
      sound.playMatchFound();
      const rawName = profileNameInput ? profileNameInput.value.trim().slice(0, 16) : '';
      userProfile = {
        name: rawName || 'Player',
        iconType: pendingAvatarDataUrl ? 'photo' : 'preset',
        presetIcon: userProfile.presetIcon || '#10',
        photoDataUrl: pendingAvatarDataUrl,
      };
      try {
        window.localStorage.setItem('rematch_profile_v1', JSON.stringify(userProfile));
      } catch {}
      syncUserProfileUI();
      closeEditProfileModal();
    }

    if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
    if (closeProfileModalBtn) {
      closeProfileModalBtn.addEventListener('click', () => {
        sound.init();
        sound.playUiBack();
        closeEditProfileModal();
      });
    }
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', handleSaveUserProfile);
    if (takePhotoBtn) {
      takePhotoBtn.addEventListener('click', () => {
        sound.init();
        sound.playUiClick();
        handleStartCameraCapture();
      });
    }
    if (capturePhotoBtn) capturePhotoBtn.addEventListener('click', handleSnapCameraPhoto);
    if (clearPhotoBtn) clearPhotoBtn.addEventListener('click', handleClearProfilePhoto);
    if (profileNameInput) {
      profileNameInput.addEventListener('input', () => {
        if (!pendingAvatarDataUrl) renderModalAvatarPreview(null);
      });
    }

    const splashScreenEl = document.getElementById('splashScreen');
    const splashStartBtn = document.getElementById('splashStartBtn');
    const handleSplashClick = () => dismissSplashScreen();
    if (splashScreenEl) splashScreenEl.addEventListener('click', handleSplashClick);
    if (splashStartBtn) splashStartBtn.addEventListener('click', handleSplashClick);

    const modeButtons = document.querySelectorAll('.mode-btn');
    const handleModeClick = (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      sound.init();
      sound.playUiSelect();
      const selectedMode = (btn.getAttribute('data-mode') as GameMode) || 'CASUAL';
      currentGameMode = selectedMode;
      if (currentGameMode === 'TOURNAMENT') {
        tournamentRound = 0;
      }
      modeButtons.forEach((b) => {
        b.className = 'mode-btn min-h-[42px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer text-slate-600 hover:text-slate-900 flex items-center justify-center';
      });
      btn.className = 'mode-btn min-h-[42px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-colors cursor-pointer bg-amber-300 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center';
      applyDifficultySettings();
      if (gameState !== 'PAUSED') {
        setMatchmakingIdleUI();
      } else {
        syncKitAndModeUI();
      }
      const vis = getFocusableMenuButtons();
      const idx = vis.indexOf(btn);
      if (idx >= 0) gamepadState.focusedMenuIndex = idx;
      syncMenuFocusVisual(true);
    };
    modeButtons.forEach((btn) => btn.addEventListener('click', handleModeClick));

    const kitButtons = document.querySelectorAll('.kit-btn');
    const handleKitClick = (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      sound.init();
      const selectedKit = (btn.getAttribute('data-kit') as KitChoice) || 'HOME';
      userKitChoice = selectedKit;
      sound.playUiSelect();
      if (gameState === 'MENU' && !isSearchingMatch && !hasMatchedOpponent) {
        setMatchmakingIdleUI();
      } else {
        syncOpponentUi();
      }
      const vis = getFocusableMenuButtons();
      const idx = vis.indexOf(btn);
      if (idx >= 0) gamepadState.focusedMenuIndex = idx;
      syncMenuFocusVisual(true);
    };
    kitButtons.forEach((btn) => btn.addEventListener('click', handleKitClick));

    const controlTabButtons = document.querySelectorAll('.control-tab-btn');
    const handleControlTabClick = (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      sound.init();
      sound.playUiSelect();
      const tab = (btn.getAttribute('data-control-tab') as ControlGuideTab) || 'COMPUTER';
      setControlGuideTab(tab);
      const vis = getFocusableMenuButtons();
      const idx = vis.indexOf(btn);
      if (idx >= 0) gamepadState.focusedMenuIndex = idx;
      syncMenuFocusVisual(true);
    };
    controlTabButtons.forEach((btn) => btn.addEventListener('click', handleControlTabClick));

    const handleStartClick = () => startMatch();
    const handleRematchClick = () => {
      sound.init();
      sound.playUiClick();
      hasMatchedOpponent = true;
      syncOpponentUi();
      launchMatchNow();
    };
    const handleMainMenuClick = () => {
      sound.init();
      sound.playUiBack();
      returnToHomeMenu();
    };
    const handleResumeClick = () => {
      sound.init();
      sound.playUiClick();
      if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        sound.setMenuMode(false);
        syncBodyStateAttr(gameState);
        syncMenuLayoutForState('PLAYING');
        if (menuOverlay) menuOverlay.classList.add('hidden');
      }
    };
    const handlePauseClick = (e: Event) => {
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();
      togglePauseMatch();
    };
    const handleMuteClick = (e: Event) => {
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();
      const isMuted = sound.toggleMute();
      if (!isMuted) sound.playUiClick();
      const icon = document.getElementById('muteIcon');
      const label = document.getElementById('soundStatusText');
      if (icon) icon.className = isMuted ? 'fa-solid fa-volume-xmark text-xs text-rose-500' : 'fa-solid fa-volume-high text-xs text-emerald-600';
      if (label) label.innerText = isMuted ? 'Muted' : 'Audio On';
    };
    const handleHowToPlayClick = () => {
      sound.init();
      sound.playUiClick();
      if (howToPlayPanel) {
        howToPlayPanel.classList.toggle('hidden');
        const isOpen = !howToPlayPanel.classList.contains('hidden');
        if (isOpen) {
          const vis = getFocusableMenuButtons();
          const tabIdx = vis.findIndex((b) => b.getAttribute('data-control-tab') === activeControlGuideTab);
          if (tabIdx >= 0) gamepadState.focusedMenuIndex = tabIdx;
        }
        syncMenuFocusVisual(true);
      }
    };

    if (startBtn) startBtn.addEventListener('click', handleStartClick);
    if (rematchSameBtn) rematchSameBtn.addEventListener('click', handleRematchClick);
    if (mainMenuBtn) mainMenuBtn.addEventListener('click', handleMainMenuClick);
    if (resumeBtn) resumeBtn.addEventListener('click', handleResumeClick);
    if (forfeitBtn) forfeitBtn.addEventListener('click', handleForfeitMatch);
    if (pauseBtn) pauseBtn.addEventListener('click', handlePauseClick);
    if (muteBtn) muteBtn.addEventListener('click', handleMuteClick);
    if (howToPlayBtn) howToPlayBtn.addEventListener('click', handleHowToPlayClick);

    // Highlight focused UI button on pointer hover and trigger subtle hover SFX
    const allInteractiveMenuBtns = document.querySelectorAll<HTMLElement>(
      '.mode-btn, .kit-btn, #editProfileBtn, #startBtn, #rematchSameBtn, #mainMenuBtn, #resumeBtn, #forfeitBtn, #howToPlayBtn, .control-tab-btn, #takePhotoBtn, #capturePhotoBtn, #clearPhotoBtn, #saveProfileBtn, #closeProfileModalBtn'
    );
    allInteractiveMenuBtns.forEach((btn) => {
      btn.addEventListener('pointerenter', () => {
        const vis = getFocusableMenuButtons();
        const idx = vis.indexOf(btn);
        if (idx >= 0 && gamepadState.focusedMenuIndex !== idx) {
          gamepadState.focusedMenuIndex = idx;
          sound.playUiHover();
          syncMenuFocusVisual(true);
        }
      });
    });

    const handleContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', handleContextMenu);

    const handleWindowBlur = () => {
      Object.keys(keys).forEach((k) => (keys[k] = false));
      kickChargeState.active = false;
      kickChargeState.power = 0;
      joyVec.active = false;
      joyVec.x = 0;
      joyVec.y = 0;
    };
    window.addEventListener('blur', handleWindowBlur);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore global game shortcuts while typing inside the Profile Name input
      if (document.activeElement === profileNameInput) {
        if (e.code === 'Escape') {
          e.preventDefault();
          closeEditProfileModal();
        } else if (e.code === 'Enter') {
          e.preventDefault();
          handleSaveUserProfile();
        }
        return;
      }

      if (gameState === 'SPLASH' && !e.repeat) {
        e.preventDefault();
        dismissSplashScreen();
        return;
      }

      keys[e.code] = true;
      hasDetectedTouchInput = false;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        activeControlScheme = 'KEYBOARD';
        hasUsedKeyboardMove = true;
      }
      syncMobileControlsVisibility();
      if (gameState !== 'PLAYING' && gameState !== 'GOAL_CELEBRATION' && !e.repeat) {
        if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
          e.preventDefault();
          moveMenuFocus(1);
          return;
        }
        if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
          e.preventDefault();
          moveMenuFocus(-1);
          return;
        }
        if (e.code === 'Enter') {
          e.preventDefault();
          const vis = getFocusableMenuButtons();
          const focused = vis[gamepadState.focusedMenuIndex];
          if (focused) {
            focused.click();
          } else {
            startMatch();
          }
          return;
        }
      }
      if (e.code === 'Space' && gameState === 'MENU' && !e.repeat) {
        const editModal = document.getElementById('editProfileModal');
        if (editModal && !editModal.classList.contains('hidden')) return;
        e.preventDefault();
        const vsOverlay = document.getElementById('preMatchVsOverlay');
        if (vsOverlay && !vsOverlay.classList.contains('hidden')) {
          document.getElementById('vsKickoffNowBtn')?.click();
          return;
        }
        startMatch();
        return;
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        const editModal = document.getElementById('editProfileModal');
        if (editModal && !editModal.classList.contains('hidden')) {
          e.preventDefault();
          closeEditProfileModal();
          return;
        }
        const vsOverlay = document.getElementById('preMatchVsOverlay');
        if (vsOverlay && !vsOverlay.classList.contains('hidden') && currentGameMode === 'TOURNAMENT') {
          e.preventDefault();
          returnToHomeMenu();
          return;
        }
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          togglePauseMatch();
          return;
        }
      }
      if (e.code === 'KeyM' && !e.repeat) {
        handleMuteClick(e);
        return;
      }
      if (e.code === 'Space' && gameState === 'PLAYING' && !e.repeat) {
        e.preventDefault();
        sound.unlock();
        if (controlledPlayer && ball.owner === controlledPlayer) {
          kickChargeState.active = true;
          kickChargeState.power = 0;
        } else if (controlledPlayer) {
          triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), 0);
        }
      }
      if ((e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && gameState === 'PLAYING' && !e.repeat) {
        toggleControlledPlayer();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'Space' && kickChargeState.active) {
        const pwr = kickChargeState.power;
        kickChargeState.active = false;
        kickChargeState.power = 0;
        if (gameState === 'PLAYING' && controlledPlayer) {
          triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), pwr);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Global iOS/Phone Audio Unlock & Foreground Recovery Listeners
    const unlockAudioOnGesture = (e: Event) => {
      if (e.type === 'touchstart' || e.type === 'touchend') {
        hasDetectedTouchInput = true;
        syncMobileControlsVisibility();
      }
      sound.unlock();
      if (gameState !== 'SPLASH') {
        sound.startMusic(() => ({
          isPlaying: gameState === 'PLAYING' || gameState === 'GOAL_CELEBRATION',
          isSuperFlow: flowCombo >= PASSES_FOR_FLOW_BOOST,
          flowCombo,
        }));
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sound.unlock();
      }
    };
    window.addEventListener('touchstart', unlockAudioOnGesture, { passive: true, capture: true });
    window.addEventListener('touchend', unlockAudioOnGesture, { passive: true, capture: true });
    window.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true, capture: true });
    window.addEventListener('pointerup', unlockAudioOnGesture, { passive: true, capture: true });
    window.addEventListener('click', unlockAudioOnGesture, { passive: true, capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        hasDetectedTouchInput = false;
        if (!hasUsedKeyboardMove) {
          activeControlScheme = 'MOUSE';
        }
        mouseState.screenX = e.clientX;
        mouseState.screenY = e.clientY;
        mouseState.active = true;
        mouseState.moveTimer = 18;
        updateMouseWorldCoords();
        syncMobileControlsVisibility();
      }
    };
    window.addEventListener('pointermove', handlePointerMove);

    // Bind Tournament Celebration, Pre-Match Kickoff Now & Back to Lobby Buttons
    const vsKickoffNowBtn = document.getElementById('vsKickoffNowBtn');
    const vsBackToMenuBtn = document.getElementById('vsBackToMenuBtn');
    const tourneyCelebrateNewBtn = document.getElementById('tourneyCelebrateNewBtn');
    const tourneyCelebrateHomeBtn = document.getElementById('tourneyCelebrateHomeBtn');

    if (vsKickoffNowBtn) {
      vsKickoffNowBtn.addEventListener('click', () => {
        sound.unlock();
        sound.playUiClick();
        clearMatchmakingTimers();
        triggerScreenTransition(() => {
          launchMatchNow();
        });
      });
    }
    if (vsBackToMenuBtn) {
      vsBackToMenuBtn.addEventListener('click', () => {
        sound.unlock();
        sound.playUiBack();
        returnToHomeMenu();
      });
    }
    if (tourneyCelebrateNewBtn) {
      tourneyCelebrateNewBtn.addEventListener('click', () => {
        sound.unlock();
        sound.playUiClick();
        currentGameMode = 'TOURNAMENT';
        tournamentRound = 0;
        initTournamentBracket();
        const winOverlay = document.getElementById('tournamentWinOverlay');
        if (winOverlay) winOverlay.classList.add('hidden');
        if (menuOverlay) menuOverlay.classList.remove('hidden');
        syncMenuLayoutForState('MENU');
        startMatch();
      });
    }
    if (tourneyCelebrateHomeBtn) {
      tourneyCelebrateHomeBtn.addEventListener('click', () => {
        sound.unlock();
        sound.playUiBack();
        returnToHomeMenu();
      });
    }

    // Multi-touch Mobile Controls (tracks dedicated Touch ID + Pointer ID so left-thumb move & right-thumb kick never conflict on iPhone/Tablet)
    const joystickZone = document.getElementById('joystickZone');
    const joystickKnob = document.getElementById('joystickKnob');
    const mobileActionBtn = document.getElementById('mobileActionBtn');
    const mobileSwitchBtn = document.getElementById('mobileSwitchBtn');
    let activeJoyTouchId: number | null = null;
    let joyOriginX = 0;
    let joyOriginY = 0;

    const updateJoystickFromCoords = (clientX: number, clientY: number, customOrigin = false) => {
      if (!joystickZone || !joystickKnob) return;
      const rect = joystickZone.getBoundingClientRect();
      const cx = customOrigin ? joyOriginX : rect.left + rect.width / 2;
      const cy = customOrigin ? joyOriginY : rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const maxR = Math.max(42, rect.width * 0.42);
      const dist = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(maxR, dist);
      const nx = dx / dist;
      const ny = dy / dist;
      joystickKnob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
      const filtered = applyRadialDeadzone((nx * clamped) / maxR, (ny * clamped) / maxR, 0.07);
      joyVec.x = filtered.x;
      joyVec.y = filtered.y;
      joyVec.active = filtered.active;
      activeControlScheme = 'JOYSTICK';
    };

    const resetJoystickState = () => {
      activeJoyTouchId = null;
      joyVec.pointerId = -1;
      joyVec.active = false;
      joyVec.x = 0;
      joyVec.y = 0;
      if (joystickKnob) {
        joystickKnob.style.transform = 'translate(0px, 0px)';
      }
    };

    // Native TouchStart on Canvas for Left-Half Floating Thumbstick & Tap-to-Switch (100% immune to iOS multi-touch pointercancel!)
    const handleCanvasTouchStart = (e: TouchEvent) => {
      sound.unlock();
      if (gameState !== 'PLAYING') return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        mouseState.screenX = t.clientX;
        mouseState.screenY = t.clientY;
        updateMouseWorldCoords();

        if (!isTeamInPossession('YOU')) {
          for (const p of players) {
            if (
              p.team === 'YOU' &&
              p !== controlledPlayer &&
              Math.hypot(mouseState.worldX - p.x, mouseState.worldY - p.y) < p.radius + 38
            ) {
              controlledPlayer = p;
              sound.playSwitch();
              spawnRipple(p.x, p.y, '#ffffff', 38);
              return;
            }
          }
        }

        if (t.clientX < window.innerWidth * 0.5 && activeJoyTouchId === null) {
          activeJoyTouchId = t.identifier;
          joyOriginX = t.clientX;
          joyOriginY = t.clientY;
          updateJoystickFromCoords(t.clientX, t.clientY, true);
          break;
        }
      }
    };
    canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: true });

    const handleCanvasPointerDown = (e: PointerEvent) => {
      sound.unlock();
      if (gameState !== 'PLAYING') return;

      // On touch devices, TouchEvent handlers manage multi-touch exclusively so pointercancel never kills the joystick
      if (e.pointerType === 'touch') {
        return;
      }

      activeControlScheme = 'MOUSE';
      mouseState.screenX = e.clientX;
      mouseState.screenY = e.clientY;
      mouseState.active = true;
      mouseState.isDown = true;
      mouseState.moveTimer = 25;
      updateMouseWorldCoords();

      if (e.button === 2) {
        toggleControlledPlayer();
        return;
      }

      if (!isTeamInPossession('YOU')) {
        for (const p of players) {
          if (p.team === 'YOU' && p !== controlledPlayer && Math.hypot(mouseState.worldX - p.x, mouseState.worldY - p.y) < p.radius + 22) {
            controlledPlayer = p;
            sound.playSwitch();
            spawnRipple(p.x, p.y, '#ffffff', 38);
            return;
          }
        }
      }

      if (controlledPlayer && ball.owner === controlledPlayer) {
        kickChargeState.active = true;
        kickChargeState.power = 0;
      } else if (controlledPlayer) {
        triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), 0);
      }
    };
    canvas.addEventListener('pointerdown', handleCanvasPointerDown);

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (joyVec.pointerId !== -1 && e.pointerId === joyVec.pointerId && activeJoyTouchId === null) {
        updateJoystickFromCoords(e.clientX, e.clientY, joyOriginX > 0);
      }
    };
    const handleWindowPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      mouseState.isDown = false;
      if (joyVec.pointerId !== -1 && e.pointerId === joyVec.pointerId && activeJoyTouchId === null) {
        joyOriginX = 0;
        joyOriginY = 0;
        resetJoystickState();
      }
      if (e.pointerType === 'mouse' && e.button === 0 && kickChargeState.active) {
        const pwr = kickChargeState.power;
        kickChargeState.active = false;
        kickChargeState.power = 0;
        if (gameState === 'PLAYING' && controlledPlayer) {
          triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), pwr);
        }
      }
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    // Native iOS WebKit Multi-Touch Joystick Handlers (immune to pointercancel when right thumb taps Kick/Switch)
    const handleWindowTouchMove = (e: TouchEvent) => {
      if (activeJoyTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeJoyTouchId) {
          e.preventDefault();
          updateJoystickFromCoords(t.clientX, t.clientY, joyOriginX > 0);
          break;
        }
      }
    };
    const handleWindowTouchEnd = (e: TouchEvent) => {
      if (activeJoyTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeJoyTouchId) {
          joyOriginX = 0;
          joyOriginY = 0;
          resetJoystickState();
          break;
        }
      }
    };
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: true });

    if (joystickZone && joystickKnob) {
      joystickZone.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          sound.unlock();
          const t = e.changedTouches[0];
          if (t) {
            activeJoyTouchId = t.identifier;
            joyOriginX = 0;
            joyOriginY = 0;
            updateJoystickFromCoords(t.clientX, t.clientY, false);
          }
        },
        { passive: false }
      );

      const onJoyDown = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        sound.unlock();
        joyVec.pointerId = e.pointerId;
        joyOriginX = 0;
        joyOriginY = 0;
        try {
          joystickZone.setPointerCapture(e.pointerId);
        } catch {}
        updateJoystickFromCoords(e.clientX, e.clientY, false);
      };
      joystickZone.addEventListener('pointerdown', onJoyDown);
    }

    if (mobileActionBtn) {
      let actionPointerId = -1;
      const startMobileAction = () => {
        sound.unlock();
        if (gameState !== 'PLAYING' || !controlledPlayer) return;
        if (ball.owner === controlledPlayer) {
          kickChargeState.active = true;
          kickChargeState.power = 0;
        } else {
          triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), 0);
        }
      };
      const endMobileAction = () => {
        actionPointerId = -1;
        if (kickChargeState.active && controlledPlayer) {
          const pwr = kickChargeState.power;
          kickChargeState.active = false;
          kickChargeState.power = 0;
          triggerContextAction(controlledPlayer, getActivePlayerAimVector(controlledPlayer), pwr);
        }
      };
      mobileActionBtn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          startMobileAction();
        },
        { passive: false }
      );
      mobileActionBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        endMobileAction();
      });
      mobileActionBtn.addEventListener('touchcancel', endMobileAction);
      mobileActionBtn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        actionPointerId = e.pointerId;
        startMobileAction();
      });
      mobileActionBtn.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') return;
        if (e.pointerId === actionPointerId || actionPointerId === -1) endMobileAction();
      });
      mobileActionBtn.addEventListener('pointercancel', (e) => {
        if (e.pointerType === 'touch') return;
        endMobileAction();
      });
    }

    if (mobileSwitchBtn) {
      const triggerMobileSwitch = (e: Event) => {
        e.preventDefault();
        sound.init();
        if (gameState === 'PLAYING') toggleControlledPlayer();
      };
      mobileSwitchBtn.addEventListener('touchstart', triggerMobileSwitch, { passive: false });
      mobileSwitchBtn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        triggerMobileSwitch(e);
      });
    }

    let rafId = 0;
    let lastHeadlessRender = 0;
    let lastTimerDisplayed = '';

    function renderLoop(now = performance.now()) {
      rafId = requestAnimationFrame(renderLoop);

      // Throttle software rendering in headless browser environments (~20fps) so screenshots never stall
      if (isHeadless && now - lastHeadlessRender < 48) {
        return;
      }
      lastHeadlessRender = now;

      const { clampedSec, rawDt } = clampDeltaTime(now - lastFrameTime);
      lastFrameTime = now;

      pollGamepadInput();

      if (hitStopTimer > 0) {
        hitStopTimer -= rawDt;
        dtScale = 0.05;
      } else if (slowMoTimer > 0) {
        slowMoTimer -= rawDt;
        dtScale = rawDt * 0.38;
      } else {
        dtScale = rawDt;
      }

      matchTick += dtScale;

      if (gameState === 'PLAYING') {
        updatePlayers();
        updateAutoKeepers();
        updateBall();
        updateHudState();

        possessionFramesTotal++;
        if (isTeamInPossession('YOU')) possessionFramesYou++;

        if (!isGoldenGoal) {
          matchTime -= clampedSec;
          const formatted = formatMatchTimer(matchTime);
          if (formatted !== lastTimerDisplayed) {
            lastTimerDisplayed = formatted;
            const tmEl = document.getElementById('timerText');
            if (tmEl) tmEl.innerText = formatted;
          }

          const check = checkMatchEndCondition(scoreYou, scoreAi, matchTime, isGoldenGoal);
          if (check.ended) {
            endMatch(check.reason);
          } else if (check.enterGoldenGoal) {
            isGoldenGoal = true;
            lastTimerDisplayed = 'GOLDEN';
            const tmEl = document.getElementById('timerText');
            if (tmEl) tmEl.innerText = 'GOLDEN';
            setLedBanner('GOLDEN GOAL OVERTIME • NEXT GOAL WINS!', 260);
            sound.playWhistle();
          }
        } else {
          const check = checkMatchEndCondition(scoreYou, scoreAi, matchTime, isGoldenGoal);
          if (check.ended) {
            endMatch(check.reason);
          }
        }
      } else if (gameState === 'GOAL_CELEBRATION') {
        updateBall();
        goalBannerTimer -= rawDt;
        if (goalBannerTimer <= 0) {
          const check = checkMatchEndCondition(scoreYou, scoreAi, matchTime, isGoldenGoal);
          if (check.ended) {
            endMatch(check.reason);
          } else {
            resetPositionsForKickoff(goalScorerTeam === 'YOU' ? 'AI' : 'YOU');
            gameState = 'PLAYING';
            syncBodyStateAttr(gameState);
          }
        }
      }

      // Update goal nets and camera AFTER entity positions so camera has zero 1-frame lag jitter
      updateGoalNets();
      updateCameraAndVFX();

      if (!ctx || !canvas) return;
      ctx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
      const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
      const effScale = viewScale * cam.zoom;
      ctx.translate(canvas.width * 0.5 + shakeX, canvas.height * 0.5 + canvasOffsetY + shakeY);
      ctx.scale(effScale, effScale);
      ctx.translate(-cam.x, -cam.y);

      drawPitch();
      drawTacticalOverlays();
      drawEntities();
      ctx.restore();

      if (stadiumFlashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${stadiumFlashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (gameState === 'GOAL_CELEBRATION') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        const bw = Math.min(520, canvas.width * 0.88);
        const bh = 96;
        const bx = (canvas.width - bw) / 2;
        const by = canvas.height * 0.16;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 24);
        ctx.fill();
        ctx.strokeStyle = goalScorerTeam === 'YOU' ? '#facc15' : '#fb7185';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(goalBannerText, canvas.width / 2, by + 44);

        ctx.fillStyle = goalScorerTeam === 'YOU' ? '#fde047' : '#fda4af';
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.fillText(goalBannerSub, canvas.width / 2, by + 72);
        ctx.restore();
      }
    }

    setMatchmakingIdleUI();
    setControlGuideTab('COMPUTER');
    createTeams();
    resetPositionsForKickoff('YOU');
    resizeCanvas();
    syncUserProfileUI();
    syncMenuLayoutForState(gameState);
    syncMenuFocusVisual(true);

    // Support ?autostart=1 query parameter to skip straight into active gameplay
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      const splashEl = document.getElementById('splashScreen');
      if (splashEl) splashEl.classList.add('hidden');
      pickRandomOpponent(false);
      launchMatchNow();
    }

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(pingInterval);
      clearMatchmakingTimers();
      stopProfileCameraStream();
      sound.stopMusic();
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
      window.removeEventListener('touchstart', unlockAudioOnGesture, true);
      window.removeEventListener('touchend', unlockAudioOnGesture, true);
      window.removeEventListener('pointerdown', unlockAudioOnGesture, true);
      window.removeEventListener('click', unlockAudioOnGesture, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="app-viewport relative overflow-hidden select-none bg-[#63d297]">
      {/* Boot-Up Start Page ("PRESS ANY BUTTON TO START") over the clean original stadium background */}
      <div
        id="splashScreen"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 sm:p-12 bg-slate-950/10 cursor-pointer overflow-hidden"
      >
        <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-3xl px-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-sky-400 flex items-center justify-center border-[3px] border-slate-900 shadow-[0_6px_0_#0f172a] mb-5">
            <PixelSoccerBallIcon className="w-11 h-11 sm:w-14 sm:h-14" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-14">
            <span className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tight text-white drop-shadow-[0_6px_0_#0f172a]">
              REMATCH
            </span>
            <span className="px-4 py-1.5 sm:px-6 sm:py-2 rounded-2xl bg-amber-300 border-[3px] border-slate-900 font-mono-num text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 shadow-[0_6px_0_#0f172a]">
              0.2
            </span>
          </div>

          <button
            id="splashStartBtn"
            type="button"
            className="bg-transparent border-0 p-0 text-white font-black text-lg sm:text-2xl tracking-[0.22em] uppercase cursor-pointer drop-shadow-[0_3px_0_#0f172a] focus:outline-none"
          >
            <span className="animate-pulse">PRESS ANY BUTTON TO START</span>
          </button>
        </div>
      </div>

      {/* Top Perimeter Indie Sports HUD (Responsive for iPhone Portrait/Landscape, Tablet & Desktop) */}
      <div
        id="hud"
        className="hud-safe-top hidden absolute top-0 left-0 w-full px-2.5 py-1.5 sm:px-5 md:px-7 md:py-2.5 flex justify-between items-center gap-2 sm:gap-3 pointer-events-none z-20"
      >
        {/* Left: Tactile Flow Combo Meter + Live Action Hint */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          <div
            id="flowBadge"
            className="glass-pill rounded-xl sm:rounded-2xl px-2.5 py-1 sm:px-3.5 sm:py-1.5 flex items-center space-x-1.5 sm:space-x-2 transition-colors duration-150"
          >
            <PixelFlameIcon className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
            <div className="hidden sm:flex items-center space-x-1.5" id="passDotsContainer">
              <span id="passDot1" className="w-2.5 h-2.5 rounded-full bg-slate-300 transition-colors duration-150" />
              <span id="passDot2" className="w-2.5 h-2.5 rounded-full bg-slate-300 transition-colors duration-150" />
              <span id="passDot3" className="w-2.5 h-2.5 rounded-full bg-slate-300 transition-colors duration-150" />
            </div>
            <span id="flowVal" className="font-mono-num text-[10px] sm:text-xs font-extrabold text-slate-800 whitespace-nowrap">
              FLOW x0
            </span>
          </div>

          <div
            id="hudTourneyBadge"
            className="hidden md:inline-flex glass-pill rounded-2xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/95 whitespace-nowrap"
          >
            CUP 1/3 · QUARTER-FINAL
          </div>

          <div className="glass-pill rounded-2xl px-3.5 py-2 hidden xl:flex items-center space-x-2">
            <span id="possessionDot" className="w-2.5 h-2.5 rounded-full bg-sky-500 transition-colors duration-150" />
            <span id="possessionText" className="text-[11px] font-extrabold tracking-tight text-slate-700 whitespace-nowrap">
              L-Click: Pass / Hold to Curve • R-Click: Send Run
            </span>
          </div>
        </div>

        {/* Center: Indie Arcade Broadcast Scoreboard */}
        <div className="glass-pill rounded-xl sm:rounded-2xl p-1 sm:p-1.5 flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Player Team (YOU) Pill */}
          <div
            id="hudYouPill"
            className="flex items-center space-x-1.5 sm:space-x-2 bg-sky-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors"
          >
            <span className="text-[9px] sm:text-[10px] md:text-xs font-black tracking-wider uppercase">YOU</span>
            <span
              id="scoreYou"
              className="font-mono-num text-xs sm:text-sm md:text-base font-black min-w-[12px] sm:min-w-[16px] text-center"
            >
              0
            </span>
          </div>

          {/* Match Clock */}
          <div className="bg-slate-900 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl flex items-center justify-center min-w-[44px] sm:min-w-[54px]">
            <span id="timerText" className="font-mono-num text-[10px] sm:text-xs font-black tracking-wider text-amber-300">
              02:00
            </span>
          </div>

          {/* Opponent Team (RIVAL) Pill */}
          <div
            id="hudAiPill"
            className="flex items-center space-x-1.5 sm:space-x-2 bg-rose-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors"
          >
            <span
              id="scoreAi"
              className="font-mono-num text-xs sm:text-sm md:text-base font-black min-w-[12px] sm:min-w-[16px] text-center"
            >
              0
            </span>
            <span
              id="opponentTagHud"
              className="hidden sm:inline text-[11px] font-extrabold tracking-tight max-w-[85px] md:max-w-[120px] truncate"
            >
              smithstreamer007
            </span>
            <span className="inline-block sm:hidden text-[9px] font-black tracking-wider uppercase">
              RIVAL
            </span>
          </div>
        </div>

        {/* Right: Tactile Arcade Utility Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 pointer-events-auto shrink-0">
          <button
            id="muteBtn"
            type="button"
            tabIndex={-1}
            aria-label="Toggle Audio"
            className="glass-pill btn-clean w-9 h-9 sm:w-auto sm:h-auto sm:min-h-[38px] sm:min-w-[38px] px-0 sm:px-3 rounded-xl sm:rounded-2xl flex items-center justify-center space-x-2 text-slate-800 hover:bg-white cursor-pointer"
            title="Toggle Audio [M]"
          >
            <PixelSoundOnIcon className="w-4 h-4 shrink-0" />
            <i id="muteIcon" className="fa-solid fa-volume-high text-xs text-emerald-600 sr-only" />
            <span id="soundStatusText" className="text-[11px] font-extrabold hidden lg:inline whitespace-nowrap">
              Audio On
            </span>
          </button>
          <button
            id="pauseBtn"
            type="button"
            tabIndex={-1}
            aria-label="Pause Match"
            className="glass-pill btn-clean w-9 h-9 sm:w-auto sm:h-auto sm:min-w-[38px] sm:min-h-[38px] rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-800 hover:bg-white cursor-pointer"
            title="Pause Match [P]"
          >
            <PixelPauseIcon className="w-4 h-4 text-slate-800" />
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Touch Controls (Strictly hidden on Computer/Gamepad; displayed only on touch devices during active play) */}
      <div
        id="mobileControls"
        style={{ display: 'none' }}
        className="mobile-controls-safe hidden fixed bottom-0 left-0 w-full justify-between items-end pointer-events-none z-20"
      >
        {/* Left Thumb: Generous 360° Arcade Analog Thumbstick with Directional Guides */}
        <div
          id="joystickZone"
          aria-label="Virtual Movement Joystick"
          className="rounded-full glass-pill relative flex items-center justify-center pointer-events-auto touch-none shadow-xl opacity-95"
        >
          <span className="absolute top-2 text-[9px] font-black text-slate-400 pointer-events-none">▲</span>
          <span className="absolute bottom-2 text-[9px] font-black text-slate-400 pointer-events-none">▼</span>
          <span className="absolute left-2.5 text-[9px] font-black text-slate-400 pointer-events-none">◀</span>
          <span className="absolute right-2.5 text-[9px] font-black text-slate-400 pointer-events-none">▶</span>
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300/90 pointer-events-none absolute" />
          <div
            id="joystickKnob"
            className="rounded-full bg-slate-900 border-[2.5px] border-sky-400 shadow-[0_3px_0_#0f172a] transition-transform duration-75 pointer-events-none relative z-10 flex items-center justify-center"
          >
            <div className="w-4 h-4 rounded-full bg-sky-400/90" />
          </div>
        </div>

        {/* Right Thumb: Ergonomic Arcade Action Cluster (Send Run/Switch + Large Elevated Kick/Curve Button) */}
        <div className="flex items-end space-x-3.5 sm:space-x-5 pointer-events-auto touch-none opacity-95">
          <button
            id="mobileSwitchBtn"
            type="button"
            aria-label="Send Teammate Run or Switch Defender"
            className="rounded-full glass-pill text-slate-900 font-black text-xs sm:text-sm flex flex-col items-center justify-center active:scale-90 transition-transform whitespace-nowrap shadow-[0_5px_0_#0f172a] mb-0.5"
          >
            <i className="fa-solid fa-bolt text-base mb-0.5 text-amber-500" />
            <span id="mobileSecondaryText">Send Run</span>
          </button>
          <button
            id="mobileActionBtn"
            type="button"
            aria-label="Kick, Pass, or Hold for Finesse Shot"
            className="rounded-full bg-sky-500 active:bg-amber-400 border-[3.5px] border-slate-900 text-white active:text-slate-900 font-black text-sm sm:text-base shadow-[0_6px_0_#0f172a] flex flex-col items-center justify-center active:translate-y-1 transition-all whitespace-nowrap mb-3"
          >
            <PixelSoccerBallIcon className="w-7 h-7 sm:w-8 sm:h-8 mb-0.5" />
            <span id="mobileActionText">Kick</span>
          </button>
        </div>
      </div>

      {/* Smooth Screen Transition Veil */}
      <div
        id="screenTransitionVeil"
        className="fixed inset-0 z-50 bg-slate-950/80 opacity-0 pointer-events-none transition-opacity duration-150"
      />

      {/* Pre-Match VS Face-Off & Tournament Knockout Bracket Overlay */}
      <div
        id="preMatchVsOverlay"
        className="hidden fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      >
        <div className="glass-modal screen-enter rounded-[28px] sm:rounded-[32px] max-w-4xl w-full p-4 sm:p-6 md:p-7 text-center border-3 border-slate-900 shadow-[0_10px_0_#0f172a] my-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-300 border-2 border-slate-900 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1.5">
            <i className="fa-solid fa-bolt text-xs" />
            <span id="vsOverlayModeLabel">CASUAL 1V1 EXHIBITION</span>
          </div>
          <div id="vsOverlayPitchLabel" className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3.5 sm:mb-4">
            SUNLIT TURF ARENA • FIRST TO +3 OR 02:00
          </div>

          <div className="grid grid-cols-11 gap-2 sm:gap-4 items-center">
            {/* Player 1 (YOU) */}
            <div className="col-span-5 bg-slate-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border-2 border-slate-900 flex flex-col items-center min-w-0">
              <div
                id="vsOverlayYouAvatar"
                className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-sky-400 border-[3px] border-slate-900 text-slate-900 font-black text-base sm:text-lg flex flex-col items-center justify-center shadow-[0_4px_0_#0f172a] mb-1.5 sm:mb-2 relative overflow-hidden shrink-0"
              />
              <div id="vsOverlayYouName" className="text-xs sm:text-base md:text-lg font-black text-slate-900 truncate max-w-full px-1">
                Player
              </div>
              <div
                id="vsOverlayYouRank"
                className="hidden mt-1 px-2.5 py-0.5 rounded-full bg-amber-200 border border-slate-900 text-[10px] sm:text-xs font-black text-slate-900 truncate max-w-full"
              >
                Diamond I
              </div>
            </div>

            {/* VS Badge */}
            <div className="col-span-1 flex items-center justify-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-300 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] font-black text-[11px] sm:text-sm text-slate-900 flex items-center justify-center shrink-0">
                VS
              </div>
            </div>

            {/* Player 2 (RIVAL) */}
            <div className="col-span-5 bg-slate-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border-2 border-slate-900 flex flex-col items-center min-w-0">
              <div
                id="vsOverlayOppAvatar"
                className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-rose-500 border-[3px] border-slate-900 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-[0_4px_0_#0f172a] mb-1.5 sm:mb-2 shrink-0"
              >
                SM
              </div>
              <div id="vsOverlayOppName" className="text-xs sm:text-base md:text-lg font-black text-slate-900 truncate max-w-full px-1">
                smithstreamer007
              </div>
              <div
                id="vsOverlayOppRank"
                className="hidden mt-1 px-2.5 py-0.5 rounded-full bg-rose-100 border border-slate-900 text-[10px] sm:text-xs font-black text-rose-900 truncate max-w-full"
              >
                Diamond I
              </div>
            </div>
          </div>

          {/* Tournament Knockout Bracket Visual (Shown before each Tournament Match) */}
          <div
            id="vsTournamentBracketSection"
            className="hidden mt-4 pt-3.5 border-t-2 border-slate-200 text-left"
          >
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                <i className="fa-solid fa-trophy text-amber-500" />
                <span>8-Club Knockout Cup Bracket</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">
                Single Elimination
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 items-center bg-slate-100 p-3 rounded-2xl border-2 border-slate-900">
              {/* Column 1: Quarter-Finals */}
              <div className="space-y-1.5 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
                  Quarter-Finals
                </div>
                <div id="brkMatchCardQf1" className="p-2.5 rounded-xl bg-amber-200 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-900">
                    <span id="brkYouNameQf" className="truncate min-w-0">Player</span>
                    <span id="brkScoreQf1" className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono-num text-[9px] shrink-0">NOW</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700 mt-0.5">
                    <span id="brkOppNameQf" className="truncate min-w-0">Rival</span>
                    <span className="text-[9px] font-extrabold text-slate-500 shrink-0">QF 1</span>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-300 text-left">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold text-slate-800">
                    <span id="brkB1NameQf" className="truncate min-w-0">Rival B1</span>
                    <span id="brkScoreQf2" className="font-mono-num text-[9px] text-slate-500 shrink-0">QF 2</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 mt-0.5">
                    <span id="brkB2NameQf" className="truncate min-w-0">Rival B2</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-1.5 rounded-lg bg-white/80 border border-slate-300 text-[9px] min-w-0">
                    <div id="brkC1NameQf" className="font-bold text-slate-700 truncate">Rival C1</div>
                    <div id="brkC2NameQf" className="text-slate-400 truncate">Rival C2</div>
                    <div id="brkScoreQf3" className="font-mono-num text-[8px] font-bold text-emerald-600 mt-0.5">QF 3</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white/80 border border-slate-300 text-[9px] min-w-0">
                    <div id="brkD1NameQf" className="font-bold text-slate-700 truncate">Rival D1</div>
                    <div id="brkD2NameQf" className="text-slate-400 truncate">Rival D2</div>
                    <div id="brkScoreQf4" className="font-mono-num text-[8px] font-bold text-emerald-600 mt-0.5">QF 4</div>
                  </div>
                </div>
              </div>

              {/* Column 2: Semi-Finals */}
              <div className="space-y-2 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
                  Semi-Finals
                </div>
                <div id="brkMatchCardSf1" className="p-2.5 rounded-xl bg-white border border-slate-300 text-left">
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-900">
                    <span id="brkYouNameSf" className="truncate min-w-0">Winner QF 1</span>
                    <span id="brkScoreSf1" className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono-num text-[9px] shrink-0">SF 1</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 mt-1">
                    <span id="brkOppNameSf" className="truncate min-w-0">Winner QF 2</span>
                    <span className="text-[9px] font-extrabold text-slate-400 shrink-0">UPPER</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-300 text-left">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold text-slate-800">
                    <span id="brkGfOppNameSf" className="truncate min-w-0">Winner QF 4</span>
                    <span id="brkScoreSf2" className="font-mono-num text-[9px] text-slate-500 shrink-0">SF 2</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 mt-0.5">
                    <span id="brkOtherSfName" className="truncate min-w-0">Winner QF 3</span>
                    <span className="text-[9px] text-slate-400 shrink-0">LOWER</span>
                  </div>
                </div>
              </div>

              {/* Column 3: Grand Final */}
              <div className="space-y-2 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 px-1 flex items-center space-x-1">
                  <i className="fa-solid fa-crown text-[10px]" />
                  <span>Grand Final</span>
                </div>
                <div id="brkMatchCardGf" className="p-3 rounded-2xl bg-white border-2 border-dashed border-amber-400 text-left">
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-900">
                    <span id="brkYouNameGf" className="truncate min-w-0">Winner SF 1</span>
                    <span id="brkScoreGf" className="px-2 py-0.5 rounded-full bg-amber-300 border border-slate-900 text-slate-900 font-mono-num text-[9px] font-black shrink-0">CUP</span>
                  </div>
                  <div className="text-[10px] font-black text-amber-600 my-1">VS</div>
                  <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-800">
                    <span id="brkOppNameGf" className="truncate min-w-0">Winner SF 2</span>
                    <i className="fa-solid fa-trophy text-amber-500 text-sm shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div id="vsStatusPromptText" className="text-xs font-black uppercase tracking-widest text-emerald-600 animate-pulse">
              ENTERING STADIUM PITCH...
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full sm:w-auto">
              <button
                id="vsBackToMenuBtn"
                type="button"
                className="btn-clean hidden min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-800 font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                Back to Lobby
              </button>
              <button
                id="vsKickoffNowBtn"
                type="button"
                className="btn-clean min-h-[44px] py-2.5 px-6 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_3px_0_#0f172a] cursor-pointer flex-1 sm:flex-initial"
              >
                Kick Off Now ▶
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Special Tournament Champions Celebration Screen */}
      <div
        id="tournamentWinOverlay"
        className="hidden fixed inset-0 z-40 bg-slate-950/85 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      >
        <div className="glass-modal screen-enter rounded-[32px] max-w-2xl w-full p-5 sm:p-8 text-center border-3 border-slate-900 shadow-[0_12px_0_#0f172a] my-auto relative overflow-hidden">
          <div className="inline-flex items-center space-x-2 px-4 py-1 rounded-full bg-amber-300 border-2 border-slate-900 text-xs font-black uppercase tracking-widest text-slate-900 shadow-[0_2px_0_#0f172a] mb-3">
            <i className="fa-solid fa-crown text-amber-600" />
            <span>UNDEFEATED 3-0 KNOCKOUT SWEEP</span>
          </div>

          {/* Animated 16-Bit Gold Trophy Emblem */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto my-2 rounded-3xl bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400 border-3 border-slate-900 shadow-[0_6px_0_#0f172a] flex items-center justify-center trophy-float">
            <svg className="w-16 h-16 sm:w-20 sm:h-20" viewBox="0 0 16 16" shapeRendering="crispEdges">
              <rect x="4" y="2" width="8" height="2" fill="#0f172a" />
              <rect x="2" y="3" width="12" height="4" fill="#0f172a" />
              <rect x="4" y="7" width="8" height="3" fill="#0f172a" />
              <rect x="6" y="10" width="4" height="2" fill="#0f172a" />
              <rect x="4" y="12" width="8" height="3" fill="#0f172a" />
              <rect x="5" y="3" width="6" height="5" fill="#facc15" />
              <rect x="3" y="4" width="2" height="2" fill="#fde047" />
              <rect x="11" y="4" width="2" height="2" fill="#f59e0b" />
              <rect x="6" y="4" width="2" height="3" fill="#fef08a" />
              <rect x="6" y="8" width="4" height="2" fill="#f59e0b" />
              <rect x="7" y="10" width="2" height="2" fill="#facc15" />
              <rect x="5" y="13" width="6" height="1" fill="#fde047" />
            </svg>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-2">
            TOURNAMENT CHAMPIONS!
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-600 mt-1 mb-4">
            You conquered the Quarter-Final, Semi-Final &amp; Grand Final to lift the Rematch Cup!
          </p>

          {/* Champion Club Identity Card */}
          <div className="flex items-center justify-center space-x-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-sky-50 border-2 border-slate-900 shadow-[0_4px_0_#0f172a] mb-4">
            <div
              id="tourneyWinAvatar"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-sky-400 border-2 border-slate-900 flex items-center justify-center relative overflow-hidden shrink-0"
            />
            <div className="text-left min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                GRAND FINAL MVP &amp; CUP WINNER
              </div>
              <div id="tourneyWinPlayerName" className="text-lg sm:text-2xl font-black text-slate-900 truncate">
                Player
              </div>
              <div className="inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-emerald-200 border border-slate-900 text-[10px] font-black text-emerald-950">
                <i className="fa-solid fa-star text-amber-500" />
                <span>Star League Champion</span>
              </div>
            </div>
          </div>

          {/* 3-Round Championship Road Recap */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-left">
            <div className="p-2.5 rounded-xl bg-emerald-50 border-2 border-slate-900 min-w-0">
              <div className="text-[9px] font-black uppercase text-emerald-700">1. Quarter-Final</div>
              <div id="tourneyWinQfRecap" className="text-xs font-black text-slate-900 truncate mt-0.5">
                vs Rival (W)
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border-2 border-slate-900 min-w-0">
              <div className="text-[9px] font-black uppercase text-emerald-700">2. Semi-Final</div>
              <div id="tourneyWinSfRecap" className="text-xs font-black text-slate-900 truncate mt-0.5">
                vs Rival (W)
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100 border-2 border-slate-900 min-w-0">
              <div className="text-[9px] font-black uppercase text-amber-800">3. Grand Final 🏆</div>
              <div id="tourneyWinGfRecap" className="text-xs font-black text-slate-900 truncate mt-0.5">
                vs Rival (W)
              </div>
            </div>
          </div>

          {/* Tournament Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 p-3 rounded-2xl bg-slate-100 border-2 border-slate-900 text-center">
            <div>
              <div className="text-[9px] font-extrabold uppercase text-slate-500">Cup Score</div>
              <div id="tourneyWinGoalsStat" className="font-mono-num text-sm sm:text-base font-black text-emerald-600 mt-0.5">
                9 - 2
              </div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase text-slate-500">Best Flow</div>
              <div id="tourneyWinComboStat" className="font-mono-num text-sm sm:text-base font-black text-amber-600 mt-0.5">
                x5
              </div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase text-slate-500">Final Passes</div>
              <div id="tourneyWinPassesStat" className="font-mono-num text-sm sm:text-base font-black text-slate-900 mt-0.5">
                12
              </div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase text-slate-500">Possession</div>
              <div id="tourneyWinPossStat" className="font-mono-num text-sm sm:text-base font-black text-sky-600 mt-0.5">
                60%
              </div>
            </div>
          </div>

          {/* Celebration Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              id="tourneyCelebrateNewBtn"
              type="button"
              className="indie-cta-btn flex-1 min-h-[48px] py-3.5 px-6 rounded-2xl bg-amber-300 hover:bg-amber-200 text-slate-900 font-black text-xs sm:text-base tracking-wide cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-trophy text-xs" />
              <span>DEFEND THE CROWN (NEW CUP)</span>
            </button>
            <button
              id="tourneyCelebrateHomeBtn"
              type="button"
              className="btn-clean min-h-[48px] py-3.5 px-6 rounded-2xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-house text-xs" />
              <span>Home Menu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Home Menu / Pause Modal / Match Over Modal */}
      <div
        id="menuOverlay"
        className="hidden absolute inset-0 bg-slate-950/25 flex items-center justify-center z-30 p-3 sm:p-5 lg:p-8 transition-opacity duration-150 overflow-y-auto"
      >
        <div
          id="menuModalCard"
          className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-3 sm:gap-4 text-center relative my-auto"
        >
          {/* Top Bar: Title Lockup & Player Profile Bar */}
          <div
            id="menuTopBar"
            className="glass-modal rounded-3xl px-4 py-3 sm:px-6 sm:py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
          >
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-sky-400 flex items-center justify-center border-2 border-slate-900 shadow-[0_3px_0_#0f172a] shrink-0">
                <PixelSoccerBallIcon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="text-left">
                <div
                  id="menuTitleVisible"
                  className="flex items-center space-x-2 text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900"
                >
                  <span>REMATCH</span>
                  <span className="px-2.5 py-0.5 rounded-xl bg-amber-300 border-2 border-slate-900 font-mono-num text-xs sm:text-base font-black text-slate-900 shadow-[0_2px_0_#0f172a]">
                    0.2
                  </span>
                </div>
              </div>
              <h1 id="menuTitle" className="sr-only">
                REMATCH 0.2
              </h1>
            </div>

            {/* Player Profile Pill + Edit Profile Button */}
            <div id="menuProfileBar" className="flex items-center space-x-2 sm:space-x-3 ml-auto sm:ml-0">
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-2xl bg-slate-100 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]">
                <div className="w-8 h-8 rounded-xl bg-sky-400 border-2 border-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    id="menuProfileAvatarImg"
                    alt="Profile Avatar"
                    className="hidden w-full h-full object-cover"
                  />
                  <span
                    id="menuProfileAvatarInitials"
                    className="text-xs font-black text-slate-900"
                  >
                    PL
                  </span>
                </div>
                <div className="text-left pr-1">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    PROFILE
                  </div>
                  <div
                    id="menuProfileNameText"
                    className="text-xs sm:text-sm font-black text-slate-900 max-w-[95px] sm:max-w-[140px] truncate"
                  >
                    Player
                  </div>
                </div>
              </div>

              <button
                id="editProfileBtn"
                type="button"
                className="btn-clean min-h-[42px] py-2 px-3 sm:px-4 rounded-2xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-900 font-black text-xs tracking-wide cursor-pointer shadow-[0_2px_0_#0f172a] flex items-center space-x-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-camera text-xs" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          <p id="menuSubtitle" className="hidden text-slate-600 font-semibold text-xs sm:text-sm mb-1" />

          {/* Main Dashboard Grid (Spacious 2-Column Layout on Desktop, Clean Stacked on Tablet/Mobile so cards never squish) */}
          <div id="menuMainGrid" className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch text-left">
            {/* Left Column: Mode & Kit Selection */}
            <div id="menuLeftCol" className="lg:col-span-7 glass-modal rounded-3xl p-4 sm:p-6 flex flex-col justify-between gap-4">
              {/* 1. Game Mode Selector: Casual / Ranked / Tournament */}
              <div id="playlistSelectorWrap">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 px-1">
                  SELECT MATCH MODE
                </div>
                <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 border-2 border-slate-900">
                  <button
                    type="button"
                    data-mode="CASUAL"
                    className="mode-btn min-h-[42px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-colors cursor-pointer bg-amber-300 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center"
                  >
                    Casual
                  </button>
                  <button
                    type="button"
                    data-mode="RANKED"
                    className="mode-btn min-h-[42px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer text-slate-600 hover:text-slate-900 flex items-center justify-center"
                  >
                    Ranked
                  </button>
                  <button
                    type="button"
                    data-mode="TOURNAMENT"
                    className="mode-btn min-h-[42px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer text-slate-600 hover:text-slate-900 flex items-center justify-center"
                  >
                    Tournament
                  </button>
                </div>

                {/* Knockout Tournament 3-Match Bracket Tracker (shown when Tournament is selected) */}
                <div id="tournamentBracketWrap" className="hidden mt-3 grid grid-cols-3 gap-2">
                  <div
                    id="tourneyStep0"
                    className="min-w-0 py-2 px-2 rounded-xl bg-amber-300 border-2 border-slate-900 text-slate-900 font-black text-[10px] sm:text-xs shadow-[0_2px_0_#0f172a] flex items-center justify-center text-center truncate"
                  >
                    <span className="truncate">1. Quarter-Final</span>
                  </div>
                  <div
                    id="tourneyStep1"
                    className="min-w-0 py-2 px-2 rounded-xl bg-white border border-slate-300 text-slate-500 font-bold text-[10px] sm:text-xs flex items-center justify-center text-center truncate"
                  >
                    <span className="truncate">2. Semi-Final</span>
                  </div>
                  <div
                    id="tourneyStep2"
                    className="min-w-0 py-2 px-2 rounded-xl bg-white border border-slate-300 text-slate-500 font-bold text-[10px] sm:text-xs flex items-center justify-center text-center truncate"
                  >
                    <span className="truncate">3. Grand Final</span>
                  </div>
                </div>
              </div>

              {/* 2. Home / Away Kit Selector */}
              <div id="kitSelectorWrap">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 px-1">
                  SELECT TEAM KIT
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    id="kitHomeBtn"
                    type="button"
                    data-kit="HOME"
                    className="kit-btn min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex items-center justify-center gap-2"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-300 border border-slate-900 shrink-0" />
                    <span className="truncate">Home Kit (Sky)</span>
                  </button>
                  <button
                    id="kitAwayBtn"
                    type="button"
                    data-kit="AWAY"
                    className="kit-btn min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer bg-slate-100 text-slate-600 hover:text-slate-900 border-2 border-slate-300 flex items-center justify-center gap-2"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-slate-900 shrink-0" />
                    <span className="truncate">Away Kit (Coral)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Locker-Room 1v1 Online Matchmaking Card */}
            <div
              id="matchmakingCard"
              className="lg:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider mb-3 px-1">
                <span id="mmStatusLabel" className="flex items-center space-x-2 text-slate-800 transition-colors min-w-0">
                  <i id="mmStatusIcon" className="fa-solid fa-futbol text-sky-500 text-xs shrink-0" />
                  <span id="mmStatusText" className="truncate">Casual 1v1 Queue</span>
                </span>
                <span id="mmSearchTimer" className="font-mono-num text-[11px] font-bold text-sky-600 hidden shrink-0 ml-2">
                  0.0s
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 relative items-stretch my-auto">
                {/* Left Card: YOU */}
                <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border-2 border-slate-900 shadow-[0_3px_0_rgba(15,23,42,0.08)] flex flex-col items-center justify-center text-center min-w-0">
                  <div
                    id="mmYouAvatar"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-400 border-2 border-slate-900 text-slate-900 font-black text-xs flex flex-col items-center justify-center shadow-xs mb-2 relative overflow-hidden transition-colors shrink-0"
                  >
                    <img
                      id="mmYouAvatarImg"
                      alt="Player Avatar"
                      className="hidden absolute inset-0 w-full h-full object-cover z-20"
                    />
                    <div id="mmYouStripe" className="w-full h-1.5 bg-amber-300 absolute top-1/2 -translate-y-1/2" />
                    <span
                      id="mmYouNumber"
                      className="relative z-10 bg-sky-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono-num"
                    >
                      #10
                    </span>
                  </div>
                  <div id="mmYouTitle" className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-full px-1">
                    Player (Home Kit)
                  </div>
                  <div
                    id="mmYouPill"
                    className="inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-[10px] sm:text-[11px] font-extrabold text-sky-800 max-w-full"
                  >
                    <span id="mmYouDot" className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                    <span id="mmYouMeta" className="truncate">Home Kit (Sky)</span>
                  </div>
                </div>

                {/* Center Floating VS Badge */}
                <div
                  id="mmVsBadge"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-300 text-slate-900 font-black text-xs flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-colors duration-200"
                >
                  VS
                </div>

                {/* Right Card: RIVAL SLOT */}
                <div
                  id="mmOpponentSlotCard"
                  className="bg-gradient-to-b from-rose-50 to-white rounded-2xl p-3.5 sm:p-4 border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-center transition-colors duration-200 min-w-0"
                >
                  <div
                    id="mmOpponentAvatar"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-100/80 border-2 border-dashed border-rose-300 text-rose-500 font-black text-sm flex items-center justify-center mb-2 relative transition-colors duration-200 shrink-0"
                  >
                    <i className="fa-solid fa-user-astronaut text-sm" />
                  </div>
                  <div id="mmOpponentName" className="text-xs sm:text-sm font-black text-rose-500 truncate max-w-full px-1">
                    Searching Slot
                  </div>
                  <div
                    id="mmOpponentPingPill"
                    className="inline-flex items-center space-x-1 mt-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-[10px] sm:text-[11px] font-extrabold text-rose-800 max-w-full"
                  >
                    <span id="mmOpponentMeta" className="truncate">Away Kit (Coral)</span>
                  </div>
                </div>
              </div>

              <div id="mmProgressWrap" className="hidden mt-3 pt-1">
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-900">
                  <div id="mmProgressBar" className="h-full w-0 mm-searching-bar rounded-full transition-all duration-150" />
                </div>
              </div>
            </div>
          </div>

          {/* End-of-Match Summary */}
          <div
            id="matchStatsRow"
            className="hidden grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 p-3.5 rounded-2xl bg-slate-100 border-2 border-slate-900 text-center"
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Passes</div>
              <div id="statPasses" className="font-mono-num text-base font-black text-slate-900 mt-0.5">
                0
              </div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Best Flow</div>
              <div id="statCombo" className="font-mono-num text-base font-black text-amber-600 mt-0.5">
                x0
              </div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Shots</div>
              <div id="statShots" className="font-mono-num text-base font-black text-slate-900 mt-0.5">
                0
              </div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Possession</div>
              <div id="statPossession" className="font-mono-num text-base font-black text-sky-600 mt-0.5">
                50%
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div id="menuBottomBar" className="glass-modal rounded-3xl p-4 sm:p-5 flex flex-col space-y-2.5 sm:space-y-3">
            <button
              id="startBtn"
              type="button"
              data-start="true"
              className="indie-cta-btn w-full min-h-[52px] py-3.5 sm:py-4 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm sm:text-lg tracking-wide cursor-pointer flex items-center justify-center space-x-2.5"
            >
              <i id="startBtnIcon" className="fa-solid fa-play text-xs" />
              <span id="startBtnText">FIND CASUAL MATCH</span>
            </button>

            <button
              id="rematchSameBtn"
              type="button"
              className="btn-clean hidden w-full min-h-[46px] py-3 px-6 rounded-2xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-rotate-right text-xs" />
              <span id="rematchSameText">Rematch</span>
            </button>

            <button
              id="mainMenuBtn"
              type="button"
              className="btn-clean hidden w-full min-h-[46px] py-3 px-6 rounded-2xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-house text-xs" />
              <span>Return to Home Menu</span>
            </button>

            <button
              id="resumeBtn"
              type="button"
              className="indie-cta-btn hidden w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-base tracking-wide cursor-pointer"
            >
              Resume Match
            </button>

            <button
              id="forfeitBtn"
              type="button"
              className="btn-clean hidden w-full min-h-[46px] py-3 px-6 rounded-2xl bg-rose-500 hover:bg-rose-400 border-2 border-slate-900 text-white font-black text-xs sm:text-sm tracking-wide uppercase cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-house text-xs" />
              <span>Forfeit Match</span>
            </button>

            <div className="flex items-center justify-center pt-1">
              <button
                id="howToPlayBtn"
                type="button"
                className="btn-clean min-h-[38px] py-2 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold text-xs tracking-wide cursor-pointer"
              >
                How to Play &amp; Controls
              </button>
            </div>

            {/* Collapsible Controls & Tips Drawer with Selectable Computer / Remote (DualShock 5) / Mobile Tabs */}
            <div
              id="howToPlayPanel"
              className="hidden mt-3 pt-3 border-t-2 border-slate-200 text-left space-y-3 text-xs text-slate-700"
            >
            {/* Device Control Guide Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 border-2 border-slate-900">
              <button
                id="tabComputerBtn"
                type="button"
                data-control-tab="COMPUTER"
                className="control-tab-btn py-2 px-3 rounded-xl text-xs font-black cursor-pointer bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center space-x-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-desktop text-[10px]" />
                <span>Computer</span>
              </button>
              <button
                id="tabRemoteBtn"
                type="button"
                data-control-tab="REMOTE"
                className="control-tab-btn py-2 px-3 rounded-xl text-xs font-extrabold cursor-pointer bg-white text-slate-600 hover:text-slate-900 border border-slate-300 flex items-center justify-center space-x-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-gamepad text-[10px]" />
                <span>Remote (PS5)</span>
              </button>
              <button
                id="tabMobileBtn"
                type="button"
                data-control-tab="MOBILE"
                className="control-tab-btn py-2 px-3 rounded-xl text-xs font-extrabold cursor-pointer bg-white text-slate-600 hover:text-slate-900 border border-slate-300 flex items-center justify-center space-x-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-mobile-screen-button text-[10px]" />
                <span>Mobile</span>
              </button>
            </div>

            {/* 1. COMPUTER CONTROLS GUIDE */}
            <div id="guideComputer" className="space-y-2">
              <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <PixelMouseLeftIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Move &amp; 360° Aim:</strong> Guide your player with{' '}
                  <strong>Mouse</strong>, <strong>WASD</strong>, or <strong>Arrow Keys</strong>. Teammates automatically
                  sprint into open space.
                </div>
              </div>
              <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <PixelFlameIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Through-Balls, Rebounds &amp; Curved Shots:</strong>{' '}
                  <strong>Left-Click / Space</strong> to pass into space, bank off walls, or tackle. Hold &amp; release
                  in the <strong>62%–92% Golden Sweet Spot</strong> for a curved <strong>PERFECT STRIKE!</strong>
                </div>
              </div>
              <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <PixelMouseRightIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Send Teammate Run &amp; Switch:</strong>{' '}
                  <strong>Right-Click / Q / Shift</strong> commands a teammate to sprint forward for a through-ball, or
                  switches defenders.
                </div>
              </div>
            </div>

            {/* 2. REMOTE (DUALSHOCK 5 / DUALSENSE) CONTROLS GUIDE */}
            <div id="guideRemote" className="hidden space-y-2">
              <div className="flex items-start space-x-2.5 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200">
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono-num text-[10px] font-black shrink-0 mt-0.5">
                  L3 / R3
                </span>
                <div>
                  <strong className="text-slate-900">DualShock 5 Move &amp; 360° Aim:</strong> Move with{' '}
                  <strong>Left Stick</strong> (auto-assists onto through-balls) and aim tight angles or wall rebounds
                  with <strong>Right Stick</strong>.
                </div>
              </div>
              <div className="flex items-start space-x-2.5 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200">
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono-num text-[10px] font-black shrink-0 mt-0.5">
                  X / R2
                </span>
                <div>
                  <strong className="text-slate-900">Pass, Tackle &amp; Sweet-Spot Curve:</strong> Tap{' '}
                  <strong>X Cross</strong> or <strong>R2 Trigger</strong> to pass, thread a through-ball, or lunge
                  tackle. Hold &amp; release in the <strong>Golden Sweet Spot</strong> to bend shots!
                </div>
              </div>
              <div className="flex items-start space-x-2.5 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200">
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono-num text-[10px] font-black shrink-0 mt-0.5">
                  O / R1
                </span>
                <div>
                  <strong className="text-slate-900">Send Runner, Switch &amp; Menu Nav:</strong> Press{' '}
                  <strong>O Circle / R1</strong> to send a teammate run or switch defender. Use{' '}
                  <strong>D-Pad + X</strong> to select highlighted UI options &amp; <strong>Options</strong> to pause.
                </div>
              </div>
            </div>

            {/* 3. MOBILE TOUCH CONTROLS GUIDE */}
            <div id="guideMobile" className="hidden space-y-2">
              <div className="flex items-start space-x-2.5 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono-num text-[10px] font-black shrink-0 mt-0.5">
                  JOY
                </span>
                <div>
                  <strong className="text-slate-900">Virtual Left Thumbstick:</strong> Drag the bottom-left thumbstick
                  for smooth 360° dribbling, positioning for rebounds, and aiming through-balls into space.
                </div>
              </div>
              <div className="flex items-start space-x-2.5 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="px-1.5 py-0.5 rounded bg-sky-500 text-white font-mono-num text-[10px] font-black shrink-0 mt-0.5">
                  KICK
                </span>
                <div>
                  <strong className="text-slate-900">Kick / Hold to Curve Button:</strong> Tap <strong>Kick</strong> to
                  pass or lunge tackle. Hold &amp; release in the <strong>62%–92% Golden Sweet Spot</strong> for a
                  curved <strong>PERFECT STRIKE!</strong>
                </div>
              </div>
              <div className="flex items-start space-x-2.5 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-900 font-mono-num text-[10px] font-black shrink-0 mt-0.5">
                  RUN
                </span>
                <div>
                  <strong className="text-slate-900">Send Run &amp; Tap-to-Switch:</strong> Tap{' '}
                  <strong>Send Run</strong> to launch a teammate into open space, or tap any defender on the pitch to
                  switch control immediately.
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile & Camera Photo Capture Modal */}
      <div
        id="editProfileModal"
        className="hidden fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-4"
      >
        <div className="glass-modal rounded-[28px] max-w-md w-full p-5 sm:p-6 text-left relative">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-200">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                CLUB IDENTITY
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Edit Profile</h2>
            </div>
            <button
              id="closeProfileModalBtn"
              type="button"
              aria-label="Close Edit Profile"
              className="btn-clean w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-black text-base flex items-center justify-center cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Avatar & Camera Capture Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-900 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-sky-400 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] overflow-hidden relative flex items-center justify-center mb-3">
                <img
                  id="modalProfilePreviewImg"
                  alt="Profile Preview"
                  className="hidden w-full h-full object-cover"
                />
                <span
                  id="modalProfilePreviewInitials"
                  className="text-2xl font-black text-slate-900"
                >
                  PL
                </span>
                <video
                  id="profileCameraVideo"
                  playsInline
                  muted
                  className="hidden absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />
              </div>

              <div
                id="cameraStatusText"
                className="hidden text-[11px] font-bold text-slate-600 mb-2.5"
              />

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  id="takePhotoBtn"
                  type="button"
                  className="btn-clean py-2 px-4 rounded-xl bg-sky-400 hover:bg-sky-300 border-2 border-slate-900 text-slate-900 font-black text-xs shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center space-x-1.5"
                >
                  <i className="fa-solid fa-camera text-xs" />
                  <span>Take Photo</span>
                </button>
                <button
                  id="capturePhotoBtn"
                  type="button"
                  className="btn-clean hidden py-2 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-slate-900 text-slate-900 font-black text-xs shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center space-x-1.5"
                >
                  <i className="fa-solid fa-check text-xs" />
                  <span>Capture Photo</span>
                </button>
                <button
                  id="clearPhotoBtn"
                  type="button"
                  className="btn-clean hidden py-2 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-extrabold text-xs cursor-pointer"
                >
                  Reset Icon
                </button>
              </div>
            </div>

            {/* Profile Name Input */}
            <div>
              <label
                htmlFor="profileNameInput"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Profile Name
              </label>
              <input
                id="profileNameInput"
                type="text"
                maxLength={16}
                placeholder="Enter your player name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-slate-900 text-slate-900 font-extrabold text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <button
              id="saveProfileBtn"
              type="button"
              className="indie-cta-btn w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm tracking-wide uppercase cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>

      {/* Isolated 60-144Hz Game Canvas */}
      <canvas id="gameCanvas" ref={canvasRef} data-testid="game-canvas" />
    </div>
  );
}
