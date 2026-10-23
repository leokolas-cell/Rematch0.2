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
  shouldKeeperSweepLooseBallInBox,
  clampKeeperToBox,
  isLongRangeGoal,
  getUserRankInfo,
  getNextRankInfo,
  computeRankProgressSummary,
  buildGoalCelebrationMessage,
  RANK_TIERS,
  SLOT_SPIN_COST,
  SLOT_BET_OPTIONS,
  INITIAL_PLAYER_BALANCE,
  BASE_JACKPOT_POOL,
  POKIE_MACHINES,
  POKIE_MACHINE_LIST,
  getMachineEffectiveJackpot,
  POKIE_SYMBOLS,
  POKIE_PAYLINES,
  VIRTUAL_REEL_STRIPS,
  calculateMatchMoneyReward,
  redeemCouponCode,
  spinPokieReels,
  getPokieGridFromStops,
  createHoldAndSpinSession,
  stepHoldAndSpinSession,
  type PokieMachineId,
  type PokieBetAmount,
  type HoldAndSpinSessionState,
  type PokieSymbolId,
  type PokieEvaluationResult,
  type GoalCelebrationSpec,
} from './game/rules';
import {
  GRAPHICS_CONFIG,
  PITCH_THEMES,
  applyPitchTheme,
  getStadiumGoalEffect,
  type PitchThemeId,
} from './game/graphicsConfig';
import { IndieSoundEngine, getStadiumMusicProfile } from './game/soundEngine';
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
  PixelGoldCoinIcon,
  PixelSlotMachineIcon,
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

    // Offscreen static 16-bit pixel stadium complex, park trees, stone concourse, floodlight towers, bleachers, turf & chalk line cache
    // Eliminates hundreds of per-frame fillRect calls for locked 60-144Hz butter-smooth performance
    const CACHE_PAD_X = 1100;
    const CACHE_PAD_Y = 1480;
    const pitchCacheCanvas = document.createElement('canvas');
    pitchCacheCanvas.width = PITCH.width + CACHE_PAD_X * 2;
    pitchCacheCanvas.height = PITCH.height + CACHE_PAD_Y * 2;
    const pitchCacheCtx = pitchCacheCanvas.getContext('2d');

    function drawPixelTree(
      cCtx: CanvasRenderingContext2D,
      tx: number,
      ty: number,
      scale = 1,
      variant = 0,
      px = 3
    ) {
      const s = Math.max(1, Math.round(scale));
      const p = px * s;
      const outline = GRAPHICS_CONFIG.palette.outline;
      const darkLeaf = variant % 2 === 0 ? '#15803d' : '#0f766e';
      const midLeaf = variant % 2 === 0 ? '#22c55e' : '#14b8a6';
      const lightLeaf = variant % 2 === 0 ? '#86efac' : '#5eead4';

      // Ground drop shadow
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      cCtx.fillRect(Math.round(tx - p * 5), Math.round(ty + p * 4), p * 10, p * 3);

      // Tree trunk
      fillPxRect(cCtx, tx - p * 2, ty + p * 1, p * 4, p * 5, outline, px);
      fillPxRect(cCtx, tx - p * 1, ty + p * 1, p * 2, p * 4, '#78350f', px);

      // Outer dark pixel outline of canopy
      fillPxRect(cCtx, tx - p * 5, ty - p * 4, p * 10, p * 6, outline, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 6, p * 8, p * 8, outline, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 7, p * 6, p * 3, outline, px);

      // Shadow foliage layer
      fillPxRect(cCtx, tx - p * 4, ty - p * 3, p * 8, p * 4, darkLeaf, px);
      // Mid foliage layer
      fillPxRect(cCtx, tx - p * 4, ty - p * 5, p * 8, p * 4, midLeaf, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 6, p * 6, p * 3, midLeaf, px);
      // Sunlit top crown highlights
      fillPxRect(cCtx, tx - p * 2, ty - p * 6, p * 4, p * 2, lightLeaf, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 4, p * 3, p * 2, lightLeaf, px);
    }

    function drawCornerFloodlightTower(
      cCtx: CanvasRenderingContext2D,
      fx: number,
      fy: number,
      dirX: number,
      dirY: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      // Soft radial stadium light glow pool toward pitch corner
      const grad = cCtx.createRadialGradient(
        fx + dirX * 45,
        fy + dirY * 45,
        8,
        fx + dirX * 95,
        fy + dirY * 95,
        220
      );
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.34)');
      grad.addColorStop(0.55, 'rgba(254, 249, 195, 0.14)');
      grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(fx + dirX * 85, fy + dirY * 85, 220, 0, Math.PI * 2);
      cCtx.fill();

      // Tower shadow
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.26)';
      cCtx.fillRect(fx - 26, fy + 24, 56, 16);

      // Concrete foundation & steel pylon base
      fillPxRect(cCtx, fx - 28, fy - 28, 56, 56, outline, px);
      fillPxRect(cCtx, fx - 24, fy - 24, 48, 48, '#475569', px);
      fillPxRect(cCtx, fx - 18, fy - 18, 36, 36, '#64748b', px);

      // Angled Halide Lamp Bank Hood
      const bankX = fx + dirX * 8;
      const bankY = fy + dirY * 8;
      fillPxRect(cCtx, bankX - 22, bankY - 16, 44, 32, outline, px);
      fillPxRect(cCtx, bankX - 18, bankY - 12, 36, 24, '#1e293b', px);

      // 6 Glowing Pixel Halide Bulbs
      for (let bx = -12; bx <= 8; bx += 10) {
        for (let by = -7; by <= 3; by += 10) {
          fillPxRect(cCtx, bankX + bx, bankY + by, 6, 6, '#fde047', px);
          fillPxRect(cCtx, bankX + bx + 1, bankY + by + 1, 3, 3, '#ffffff', px);
        }
      }
    }

    function drawAutumnMapleTree(
      cCtx: CanvasRenderingContext2D,
      tx: number,
      ty: number,
      scale = 2,
      variant = 0,
      px = 3
    ) {
      const s = Math.max(1, Math.round(scale));
      const p = px * s;
      const outline = GRAPHICS_CONFIG.palette.outline;
      const palettes = [
        { dark: '#9a3412', mid: '#ea580c', light: '#fde047' }, // Fiery Orange-Gold Maple
        { dark: '#991b1b', mid: '#dc2626', light: '#fca5a5' }, // Crimson Red Maple
        { dark: '#b45309', mid: '#f59e0b', light: '#fef08a' }, // Golden Ginkgo
      ];
      const pal = palettes[variant % palettes.length];

      cCtx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      cCtx.fillRect(Math.round(tx - p * 5), Math.round(ty + p * 4), p * 10, p * 3);

      fillPxRect(cCtx, tx - p * 2, ty + p * 1, p * 4, p * 5, outline, px);
      fillPxRect(cCtx, tx - p * 1, ty + p * 1, p * 2, p * 4, '#5c280a', px);

      fillPxRect(cCtx, tx - p * 5, ty - p * 4, p * 10, p * 6, outline, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 6, p * 8, p * 8, outline, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 7, p * 6, p * 3, outline, px);

      fillPxRect(cCtx, tx - p * 4, ty - p * 3, p * 8, p * 4, pal.dark, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 5, p * 8, p * 4, pal.mid, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 6, p * 6, p * 3, pal.mid, px);
      fillPxRect(cCtx, tx - p * 2, ty - p * 6, p * 4, p * 2, pal.light, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 4, p * 3, p * 2, pal.light, px);
    }

    function drawSakuraBlossomTree(
      cCtx: CanvasRenderingContext2D,
      tx: number,
      ty: number,
      scale = 2,
      variant = 0,
      px = 3
    ) {
      const s = Math.max(1, Math.round(scale));
      const p = px * s;
      const outline = GRAPHICS_CONFIG.palette.outline;
      const darkPink = variant % 2 === 0 ? '#db2777' : '#e11d48';
      const midPink = variant % 2 === 0 ? '#f472b6' : '#fb7185';
      const lightPink = variant % 2 === 0 ? '#fce7f3' : '#ffe4e6';

      cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      cCtx.fillRect(Math.round(tx - p * 5), Math.round(ty + p * 4), p * 10, p * 3);

      fillPxRect(cCtx, tx - p * 2, ty + p * 1, p * 4, p * 5, outline, px);
      fillPxRect(cCtx, tx - p * 1, ty + p * 1, p * 2, p * 4, '#4a1d1f', px);

      fillPxRect(cCtx, tx - p * 5, ty - p * 4, p * 10, p * 6, outline, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 6, p * 8, p * 8, outline, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 7, p * 6, p * 3, outline, px);

      fillPxRect(cCtx, tx - p * 4, ty - p * 3, p * 8, p * 4, darkPink, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 5, p * 8, p * 4, midPink, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 6, p * 6, p * 3, midPink, px);
      fillPxRect(cCtx, tx - p * 2, ty - p * 6, p * 4, p * 2, lightPink, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 4, p * 3, p * 2, lightPink, px);
    }

    let selectedPitchTheme: PitchThemeId = 'CLASSIC_TURF';
    let preferredArenaMode: 'RANDOM' | PitchThemeId = 'RANDOM';
    const urlPitchParam =
      typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('pitch') || '').toUpperCase()
        : '';
    if (urlPitchParam === 'SPACE' || urlPitchParam === 'COSMIC_SPACE') {
      preferredArenaMode = 'COSMIC_SPACE';
      selectedPitchTheme = 'COSMIC_SPACE';
    } else if (urlPitchParam === 'STREET' || urlPitchParam === 'URBAN_CONCRETE') {
      preferredArenaMode = 'URBAN_CONCRETE';
      selectedPitchTheme = 'URBAN_CONCRETE';
    } else if (urlPitchParam === 'CLAY' || urlPitchParam === 'BEACH' || urlPitchParam === 'RIO_CLAY') {
      preferredArenaMode = 'RIO_CLAY';
      selectedPitchTheme = 'RIO_CLAY';
    } else if (urlPitchParam === 'SYNTH' || urlPitchParam === 'NIGHT' || urlPitchParam === 'TWILIGHT_SYNTH') {
      preferredArenaMode = 'TWILIGHT_SYNTH';
      selectedPitchTheme = 'TWILIGHT_SYNTH';
    } else if (urlPitchParam === 'ICE' || urlPitchParam === 'SNOW' || urlPitchParam === 'ARCTIC_ICE') {
      preferredArenaMode = 'ARCTIC_ICE';
      selectedPitchTheme = 'ARCTIC_ICE';
    } else if (urlPitchParam === 'VOLCANO' || urlPitchParam === 'LAVA' || urlPitchParam === 'VOLCANO_FORGE') {
      preferredArenaMode = 'VOLCANO_FORGE';
      selectedPitchTheme = 'VOLCANO_FORGE';
    } else if (urlPitchParam === 'AUTUMN' || urlPitchParam === 'TURF_AUTUMN') {
      preferredArenaMode = 'TURF_AUTUMN';
      selectedPitchTheme = 'TURF_AUTUMN';
    } else if (urlPitchParam === 'SAKURA' || urlPitchParam === 'TURF_SAKURA') {
      preferredArenaMode = 'TURF_SAKURA';
      selectedPitchTheme = 'TURF_SAKURA';
    } else if (urlPitchParam === 'CHAMPIONS' || urlPitchParam === 'TURF_CHAMPIONS') {
      preferredArenaMode = 'TURF_CHAMPIONS';
      selectedPitchTheme = 'TURF_CHAMPIONS';
    } else if (urlPitchParam === 'TURF' || urlPitchParam === 'CLASSIC_TURF') {
      preferredArenaMode = 'CLASSIC_TURF';
      selectedPitchTheme = 'CLASSIC_TURF';
    } else {
      const initialRandom = PITCH_THEMES[Math.floor(Math.random() * PITCH_THEMES.length)];
      selectedPitchTheme = initialRandom.id;
    }
    applyPitchTheme(selectedPitchTheme);
    sound.setPitchTheme(selectedPitchTheme);

    function drawRingedPlanet(
      cCtx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      const glow = cCtx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.2);
      glow.addColorStop(0, 'rgba(192, 132, 252, 0.36)');
      glow.addColorStop(0.55, 'rgba(56, 189, 248, 0.16)');
      glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      cCtx.fillStyle = glow;
      cCtx.beginPath();
      cCtx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
      cCtx.fill();

      cCtx.save();
      cCtx.translate(cx, cy);
      cCtx.rotate(-0.34);
      for (let a = Math.PI; a <= Math.PI * 2; a += 0.045) {
        const rx = Math.cos(a) * (r * 1.95);
        const ry = Math.sin(a) * (r * 0.56);
        fillPxRect(cCtx, rx - 4, ry - 4, 10, 8, outline, px);
        fillPxRect(cCtx, rx - 3, ry - 3, 8, 6, '#38bdf8', px);
        const rxInner = Math.cos(a) * (r * 1.56);
        const ryInner = Math.sin(a) * (r * 0.44);
        fillPxRect(cCtx, rxInner - 3, ryInner - 3, 6, 6, '#fde047', px);
      }
      cCtx.restore();

      cCtx.save();
      cCtx.beginPath();
      cCtx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      cCtx.fillStyle = outline;
      cCtx.fill();

      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.clip();

      cCtx.fillStyle = '#7c3aed';
      cCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
      fillPxRect(cCtx, cx - r, cy - r * 0.65, r * 2, r * 0.26, '#a855f7', px);
      fillPxRect(cCtx, cx - r, cy - r * 0.22, r * 2, r * 0.28, '#ec4899', px);
      fillPxRect(cCtx, cx - r, cy + r * 0.16, r * 2, r * 0.24, '#6366f1', px);
      fillPxRect(cCtx, cx - r, cy + r * 0.52, r * 2, r * 0.25, '#4338ca', px);
      cCtx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      cCtx.beginPath();
      cCtx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.72, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.restore();

      cCtx.save();
      cCtx.translate(cx, cy);
      cCtx.rotate(-0.34);
      for (let a = 0; a <= Math.PI; a += 0.045) {
        const rx = Math.cos(a) * (r * 1.95);
        const ry = Math.sin(a) * (r * 0.56);
        fillPxRect(cCtx, rx - 4, ry - 4, 10, 8, outline, px);
        fillPxRect(cCtx, rx - 3, ry - 3, 8, 6, '#38bdf8', px);
        const rxInner = Math.cos(a) * (r * 1.56);
        const ryInner = Math.sin(a) * (r * 0.44);
        fillPxRect(cCtx, rxInner - 3, ryInner - 3, 6, 6, '#fde047', px);
      }
      cCtx.restore();
    }

    function drawPixelUfo(
      cCtx: CanvasRenderingContext2D,
      ux: number,
      uy: number,
      tick: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      const beamPulse = 0.22 + 0.1 * Math.sin(tick * 0.09);
      cCtx.save();
      const beamGrad = cCtx.createLinearGradient(ux, uy + 10, ux, uy + 115);
      beamGrad.addColorStop(0, `rgba(52, 211, 153, ${beamPulse + 0.18})`);
      beamGrad.addColorStop(0.6, `rgba(56, 189, 248, ${beamPulse})`);
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      cCtx.fillStyle = beamGrad;
      cCtx.beginPath();
      cCtx.moveTo(ux - 14, uy + 10);
      cCtx.lineTo(ux + 14, uy + 10);
      cCtx.lineTo(ux + 48, uy + 112);
      cCtx.lineTo(ux - 48, uy + 112);
      cCtx.closePath();
      cCtx.fill();
      cCtx.restore();

      fillPxRect(cCtx, ux - 20, uy - 24, 40, 18, outline, px);
      fillPxRect(cCtx, ux - 16, uy - 20, 32, 14, '#38bdf8', px);
      fillPxRect(cCtx, ux - 10, uy - 17, 12, 6, '#e0f2fe', px);
      fillPxRect(cCtx, ux - 4, uy - 15, 8, 8, '#4ade80', px);
      fillPxRect(cCtx, ux - 3, uy - 13, 2, 2, outline, px);
      fillPxRect(cCtx, ux + 1, uy - 13, 2, 2, outline, px);

      fillPxRect(cCtx, ux - 42, uy - 8, 84, 18, outline, px);
      fillPxRect(cCtx, ux - 38, uy - 5, 76, 12, '#94a3b8', px);
      fillPxRect(cCtx, ux - 32, uy - 8, 64, 6, '#e2e8f0', px);
      fillPxRect(cCtx, ux - 22, uy + 7, 44, 6, outline, px);
      fillPxRect(cCtx, ux - 18, uy + 7, 36, 4, '#475569', px);

      const rimColors = ['#fde047', '#38bdf8', '#f43f5e', '#4ade80'];
      const activeIdx = Math.floor(tick * 0.15) % 4;
      for (let i = 0; i < 5; i++) {
        const lx = ux - 28 + i * 14;
        const col = rimColors[(i + activeIdx) % rimColors.length];
        fillPxRect(cCtx, lx - 3, uy - 1, 6, 5, col, px);
      }
    }

    function drawPixelPalmTree(
      cCtx: CanvasRenderingContext2D,
      tx: number,
      ty: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.fillStyle = 'rgba(180, 83, 9, 0.22)';
      cCtx.fillRect(tx - 24, ty + 14, 48, 14);

      fillPxRect(cCtx, tx - 7, ty - 6, 14, 24, outline, px);
      fillPxRect(cCtx, tx - 5, ty - 4, 10, 20, '#92400e', px);
      fillPxRect(cCtx, tx - 9, ty - 22, 14, 18, outline, px);
      fillPxRect(cCtx, tx - 7, ty - 20, 10, 14, '#b45309', px);

      fillPxRect(cCtx, tx - 9, ty - 24, 7, 7, '#451a03', px);
      fillPxRect(cCtx, tx + 2, ty - 24, 7, 7, '#451a03', px);

      const fronds = [
        { dx: -28, dy: -28, w: 24, h: 10, c: '#16a34a' },
        { dx: 4, dy: -28, w: 24, h: 10, c: '#16a34a' },
        { dx: -34, dy: -18, w: 26, h: 9, c: '#22c55e' },
        { dx: 8, dy: -18, w: 26, h: 9, c: '#22c55e' },
        { dx: -12, dy: -40, w: 24, h: 14, c: '#4ade80' },
      ];
      for (const fr of fronds) {
        fillPxRect(cCtx, tx + fr.dx - 2, ty + fr.dy - 2, fr.w + 4, fr.h + 4, outline, px);
        fillPxRect(cCtx, tx + fr.dx, ty + fr.dy, fr.w, fr.h, fr.c, px);
      }
    }

    function drawSnowPineTree(
      cCtx: CanvasRenderingContext2D,
      tx: number,
      ty: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      cCtx.fillRect(tx - 22, ty + 10, 44, 14);
      // Trunk
      fillPxRect(cCtx, tx - 6, ty + 2, 12, 16, outline, px);
      fillPxRect(cCtx, tx - 4, ty + 4, 8, 12, '#78350f', px);
      // Bottom pine tier + snow cap
      fillPxRect(cCtx, tx - 24, ty - 14, 48, 20, outline, px);
      fillPxRect(cCtx, tx - 21, ty - 11, 42, 14, '#0f766e', px);
      fillPxRect(cCtx, tx - 18, ty - 11, 36, 6, '#f8fafc', px);
      // Middle pine tier + snow cap
      fillPxRect(cCtx, tx - 18, ty - 28, 36, 18, outline, px);
      fillPxRect(cCtx, tx - 15, ty - 25, 30, 12, '#14b8a6', px);
      fillPxRect(cCtx, tx - 12, ty - 25, 24, 6, '#ffffff', px);
      // Top pine peak + snow cap
      fillPxRect(cCtx, tx - 12, ty - 40, 24, 16, outline, px);
      fillPxRect(cCtx, tx - 9, ty - 37, 18, 10, '#2dd4bf', px);
      fillPxRect(cCtx, tx - 6, ty - 37, 12, 6, '#ffffff', px);
    }

    function drawBeachUmbrella(
      cCtx: CanvasRenderingContext2D,
      ux: number,
      uy: number,
      primaryCol: string,
      secondaryCol: string,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      fillPxRect(cCtx, ux - 18, uy + 6, 36, 18, outline, px);
      fillPxRect(cCtx, ux - 16, uy + 8, 32, 14, primaryCol, px);
      fillPxRect(cCtx, ux - 16, uy + 13, 32, 4, '#ffffff', px);

      cCtx.fillStyle = 'rgba(180, 83, 9, 0.25)';
      cCtx.fillRect(ux - 22, uy - 12, 44, 24);

      fillPxRect(cCtx, ux - 22, uy - 22, 44, 28, outline, px);
      fillPxRect(cCtx, ux - 19, uy - 19, 38, 22, primaryCol, px);
      fillPxRect(cCtx, ux - 7, uy - 19, 14, 22, secondaryCol, px);
      fillPxRect(cCtx, ux - 3, uy - 11, 6, 6, '#fde047', px);
    }

    function drawParkFountain(
      cCtx: CanvasRenderingContext2D,
      fx: number,
      fy: number,
      r: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      fillPxRect(cCtx, fx - r - 4, fy - r - 4, (r + 4) * 2, (r + 4) * 2, outline, px);
      fillPxRect(cCtx, fx - r, fy - r, r * 2, r * 2, '#cbd5e1', px);
      fillPxRect(cCtx, fx - r + 6, fy - r + 6, (r - 6) * 2, (r - 6) * 2, '#0284c7', px);
      fillPxRect(cCtx, fx - r + 10, fy - r + 10, (r - 10) * 2, (r - 10) * 2, '#38bdf8', px);
      fillPxRect(cCtx, fx - 12, fy - 12, 24, 24, outline, px);
      fillPxRect(cCtx, fx - 9, fy - 9, 18, 18, '#e2e8f0', px);
      fillPxRect(cCtx, fx - 5, fy - 5, 10, 10, '#bae6fd', px);
    }

    function drawStreetCar(
      cCtx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      dirX: number,
      bodyCol: string,
      px = 3,
      isPolice = false,
      tick = 0
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.save();
      const beamX = cx + dirX * 28;
      const grad = cCtx.createLinearGradient(beamX, cy, beamX + dirX * 95, cy);
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
      grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.moveTo(beamX, cy - 12);
      cCtx.lineTo(beamX + dirX * 95, cy - 34);
      cCtx.lineTo(beamX + dirX * 95, cy + 34);
      cCtx.lineTo(beamX, cy + 12);
      cCtx.closePath();
      cCtx.fill();
      cCtx.restore();

      fillPxRect(cCtx, cx - 22, cy - 17, 12, 34, outline, px);
      fillPxRect(cCtx, cx + 10, cy - 17, 12, 34, outline, px);
      fillPxRect(cCtx, cx - 28, cy - 14, 56, 28, outline, px);
      fillPxRect(cCtx, cx - 25, cy - 11, 50, 22, bodyCol, px);
      fillPxRect(cCtx, cx - 14, cy - 9, 28, 18, '#0f172a', px);
      fillPxRect(cCtx, cx - 8, cy - 8, 16, 16, '#e2e8f0', px);
      if (isPolice) {
        const flashRed = Math.floor(tick * 0.25) % 2 === 0;
        fillPxRect(cCtx, cx - 4, cy - 7, 8, 7, flashRed ? '#ef4444' : '#3b82f6', px);
        fillPxRect(cCtx, cx - 4, cy, 8, 7, flashRed ? '#3b82f6' : '#ef4444', px);
      }
      const frontX = dirX > 0 ? cx + 22 : cx - 26;
      const rearX = dirX > 0 ? cx - 26 : cx + 22;
      fillPxRect(cCtx, frontX, cy - 9, 4, 5, '#fef08a', px);
      fillPxRect(cCtx, frontX, cy + 4, 4, 5, '#fef08a', px);
      fillPxRect(cCtx, rearX, cy - 9, 4, 5, '#f43f5e', px);
      fillPxRect(cCtx, rearX, cy + 4, 4, 5, '#f43f5e', px);
    }

    function rebuildStaticPitchCache() {
      if (!pitchCacheCtx) return;
      pitchCacheCtx.imageSmoothingEnabled = false;
      const w = PITCH.width;
      const h = PITCH.height;
      const c = PITCH.cornerChamfer;
      const boxTop = (h - PITCH.boxHeight) / 2;
      const px = GRAPHICS_CONFIG.pixelPipeline.pixelSize;
      const outline = GRAPHICS_CONFIG.palette.outline;

      pitchCacheCtx.clearRect(0, 0, pitchCacheCanvas.width, pitchCacheCanvas.height);
      pitchCacheCtx.save();
      pitchCacheCtx.translate(CACHE_PAD_X, CACHE_PAD_Y);

      // Architectural Zoning Constants:
      // - Pitch & Cage: [0..w, 0..h]
      // - Stadium Bowl (Concourse, 2-Tier Grandstands, Crowd & Corner Floodlights): [-STADIUM_BOWL_PAD .. w+STADIUM_BOWL_PAD, -STADIUM_BOWL_PAD .. h+STADIUM_BOWL_PAD]
      // - Outside World Scenery: Strictly outside [-OUTER_WORLD_START .. w+OUTER_WORLD_START, -OUTER_WORLD_START .. h+OUTER_WORLD_START]
      const STADIUM_BOWL_PAD = 162;
      const OUTER_WORLD_START = 220;

      // ======================================================================
      // STEP 1: OUTSIDE WORLD BACKGROUND & THEMED SCENERY (STRICTLY OUTSIDE STADIUM BOWL)
      // ======================================================================
      if (selectedPitchTheme === 'COSMIC_SPACE') {
        // === 1. COSMIC SPACE ORBITAL ARENA BACKGROUND ===
        pitchCacheCtx.fillStyle = '#060818';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        const bandW = 160;
        pitchCacheCtx.fillStyle = '#0a0e29';
        for (let bx = -CACHE_PAD_X; bx < w + CACHE_PAD_X; bx += bandW * 2) {
          pitchCacheCtx.fillRect(bx, -CACHE_PAD_Y, bandW, h + CACHE_PAD_Y * 2);
        }

        const nebulas = [
          { x: 260, y: -320, r: 340, c1: 'rgba(139, 92, 246, 0.36)', c2: 'rgba(217, 70, 239, 0.16)' },
          { x: w - 260, y: h + 320, r: 360, c1: 'rgba(56, 189, 248, 0.32)', c2: 'rgba(99, 102, 241, 0.15)' },
          { x: -340, y: h * 0.5, r: 310, c1: 'rgba(236, 72, 153, 0.28)', c2: 'rgba(124, 58, 237, 0.12)' },
          { x: w + 340, y: h * 0.35, r: 330, c1: 'rgba(45, 212, 191, 0.28)', c2: 'rgba(56, 189, 248, 0.12)' },
        ];
        for (const neb of nebulas) {
          const nGrad = pitchCacheCtx.createRadialGradient(neb.x, neb.y, 20, neb.x, neb.y, neb.r);
          nGrad.addColorStop(0, neb.c1);
          nGrad.addColorStop(0.55, neb.c2);
          nGrad.addColorStop(1, 'rgba(6, 8, 24, 0)');
          pitchCacheCtx.fillStyle = nGrad;
          pitchCacheCtx.beginPath();
          pitchCacheCtx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
          pitchCacheCtx.fill();
        }

        const starColors = ['#ffffff', '#e0f2fe', '#fef08a', '#f5d0fe', '#bae6fd', '#c4b5fd'];
        for (let i = 0; i < 260; i++) {
          const sx = -CACHE_PAD_X + 20 + ((i * 193) % (w + CACHE_PAD_X * 2 - 40));
          const sy = -CACHE_PAD_Y + 20 + ((i * 271) % (h + CACHE_PAD_Y * 2 - 40));
          if (sx > -STADIUM_BOWL_PAD - 20 && sx < w + STADIUM_BOWL_PAD + 20 && sy > -STADIUM_BOWL_PAD - 20 && sy < h + STADIUM_BOWL_PAD + 20) continue;
          const col = starColors[i % starColors.length];
          const sz = i % 7 === 0 ? px * 2 : px;
          fillPxRect(pitchCacheCtx, sx, sy, sz, sz, col, px);
          if (i % 13 === 0) {
            fillPxRect(pitchCacheCtx, sx - px, sy, px * 3, px, col, px);
            fillPxRect(pitchCacheCtx, sx, sy - px, px, px * 3, col, px);
          }
        }

        // Outer Space Ringed Planets & Cratered Moons (Strictly outside the Stadium Bowl!)
        drawRingedPlanet(pitchCacheCtx, 340, -295, 48, px);
        drawRingedPlanet(pitchCacheCtx, w + 310, h * 0.24, 54, px);
        drawRingedPlanet(pitchCacheCtx, -310, -280, 64, px);
        drawRingedPlanet(pitchCacheCtx, w - 340, h + 295, 50, px);

        for (const mPos of [
          { x: w - 360, y: -285, r: 34 },
          { x: -305, y: h * 0.76, r: 38 },
          { x: 360, y: h + 285, r: 34 },
        ]) {
          fillPxRect(pitchCacheCtx, mPos.x - mPos.r - 3, mPos.y - mPos.r - 3, (mPos.r + 3) * 2, (mPos.r + 3) * 2, outline, px);
          fillPxRect(pitchCacheCtx, mPos.x - mPos.r, mPos.y - mPos.r, mPos.r * 2, mPos.r * 2, '#94a3b8', px);
          fillPxRect(pitchCacheCtx, mPos.x - mPos.r + 6, mPos.y - mPos.r + 6, mPos.r * 1.5, mPos.r * 1.5, '#cbd5e1', px);
          fillPxRect(pitchCacheCtx, mPos.x - 12, mPos.y - 10, 12, 12, '#64748b', px);
          fillPxRect(pitchCacheCtx, mPos.x + 8, mPos.y + 6, 9, 9, '#64748b', px);
        }

        // Left & Right Outer Orbital Solar Array Wings (Outside Stadium Wall at x = -295 and w + 210)
        for (const sideX of [-296, w + 214]) {
          fillPxRect(pitchCacheCtx, sideX - 3, h * 0.32 - 3, 88, 146, outline, px);
          fillPxRect(pitchCacheCtx, sideX, h * 0.32, 82, 140, '#1e3a8a', px);
          pitchCacheCtx.strokeStyle = '#38bdf8';
          pitchCacheCtx.lineWidth = 2;
          for (let sy = h * 0.32 + 20; sy < h * 0.32 + 135; sy += 24) {
            pitchCacheCtx.beginPath();
            pitchCacheCtx.moveTo(sideX + 4, sy);
            pitchCacheCtx.lineTo(sideX + 78, sy);
            pitchCacheCtx.stroke();
          }
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(sideX + 41, h * 0.32 + 4);
          pitchCacheCtx.lineTo(sideX + 41, h * 0.32 + 136);
          pitchCacheCtx.stroke();
        }
      } else if (selectedPitchTheme === 'URBAN_CONCRETE') {
        // === 2. URBAN STREET CONCRETE: DOWNTOWN METRO BLOCK PARTY & ASPHALT AVENUE ===
        pitchCacheCtx.fillStyle = '#1e293b';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        pitchCacheCtx.fillStyle = '#334155';
        for (let bx = -CACHE_PAD_X; bx < w + CACHE_PAD_X; bx += 180) {
          pitchCacheCtx.fillRect(bx, -CACHE_PAD_Y, 90, h + CACHE_PAD_Y * 2);
        }

        // Outer City Asphalt Roads & Crosswalks (Strictly outside Stadium Bowl at y = -280 and y = h + 212)
        for (const roadY of [-280, h + 212]) {
          fillPxRect(pitchCacheCtx, -CACHE_PAD_X, roadY - 4, w + CACHE_PAD_X * 2, 76, outline, px);
          fillPxRect(pitchCacheCtx, -CACHE_PAD_X, roadY, w + CACHE_PAD_X * 2, 68, '#0f172a', px);
          for (let rx = -CACHE_PAD_X + 20; rx < w + CACHE_PAD_X; rx += 64) {
            fillPxRect(pitchCacheCtx, rx, roadY + 31, 34, 6, '#facc15', px);
          }
          for (const cwX of [180, w * 0.5 - 36, w - 230]) {
            for (let stripe = 0; stripe < 5; stripe++) {
              fillPxRect(pitchCacheCtx, cwX, roadY + 6 + stripe * 12, 54, 7, '#f8fafc', px);
            }
          }
        }

        // Left & Right Outer Streetball Half-Courts & Boombox Plazas (Outside Stadium Wall at x = -296 and w + 216)
        for (const sideX of [-296, w + 216]) {
          fillPxRect(pitchCacheCtx, sideX - 3, h * 0.24 - 3, 86, h * 0.52 + 6, outline, px);
          fillPxRect(pitchCacheCtx, sideX, h * 0.24, 80, h * 0.52, '#475569', px);
          fillPxRect(pitchCacheCtx, sideX + 8, h * 0.36, 64, h * 0.28, '#f97316', px);
          pitchCacheCtx.strokeStyle = '#f8fafc';
          pitchCacheCtx.lineWidth = 2.5;
          pitchCacheCtx.strokeRect(sideX + 8, h * 0.36, 64, h * 0.28);
          pitchCacheCtx.beginPath();
          pitchCacheCtx.arc(sideX + 40, h * 0.5, 22, 0, Math.PI * 2);
          pitchCacheCtx.stroke();
          fillPxRect(pitchCacheCtx, sideX + 24, h * 0.25, 32, 6, '#f8fafc', px);
          fillPxRect(pitchCacheCtx, sideX + 34, h * 0.25 + 6, 12, 8, '#ef4444', px);
          // Street-Art Cargo Containers & DJ Boombox Stacks
          fillPxRect(pitchCacheCtx, sideX + 4, 112, 72, 46, outline, px);
          fillPxRect(pitchCacheCtx, sideX + 7, 115, 66, 40, sideX < 0 ? '#38bdf8' : '#f43f5e', px);
          fillPxRect(pitchCacheCtx, sideX + 18, 124, 44, 12, '#fde047', px);
          fillPxRect(pitchCacheCtx, sideX + 4, h - 158, 72, 46, outline, px);
          fillPxRect(pitchCacheCtx, sideX + 7, h - 155, 66, 40, sideX < 0 ? '#a855f7' : '#facc15', px);
          fillPxRect(pitchCacheCtx, sideX + 16, h - 144, 16, 16, '#0f172a', px);
          fillPxRect(pitchCacheCtx, sideX + 48, h - 144, 16, 16, '#0f172a', px);
        }
      } else if (selectedPitchTheme === 'RIO_CLAY') {
        // === 3. RIO CLAY: COPACABANA TROPICAL BEACHFRONT, OCEAN SURF & PALM BOARDWALK ===
        pitchCacheCtx.fillStyle = '#0284c7';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Ocean Surf & Golden Copacabana Sand Island Surrounding the Stadium Bowl
        fillPxRect(pitchCacheCtx, -380, -310, w + 760, h + 620, '#0ea5e9', px);
        fillPxRect(pitchCacheCtx, -345, -280, w + 690, h + 560, '#38bdf8', px);
        fillPxRect(pitchCacheCtx, -318, -256, w + 636, h + 512, '#e0f2fe', px);
        fillPxRect(pitchCacheCtx, -298, -238, w + 596, h + 476, '#fcd34d', px);
        fillPxRect(pitchCacheCtx, -270, -216, w + 540, h + 432, '#fde68a', px);

        // Outer Beach Volleyball Sand Courts on Left & Right Beach (Outside Stadium Wall)
        for (const vx of [-262, w + 192]) {
          pitchCacheCtx.strokeStyle = '#f97316';
          pitchCacheCtx.lineWidth = 2.5;
          pitchCacheCtx.strokeRect(vx, h * 0.28, 66, h * 0.44);
          fillPxRect(pitchCacheCtx, vx - 3, h * 0.5 - 3, 72, 6, '#ffffff', px);
          fillPxRect(pitchCacheCtx, vx - 4, h * 0.5 - 6, 6, 12, outline, px);
          fillPxRect(pitchCacheCtx, vx + 64, h * 0.5 - 6, 6, 12, outline, px);
        }

        // Colorful Tropical Surfboards, Beach Umbrellas & Palms on Outer Sand (Strictly outside ±215px)
        for (const sb of [
          { x: 265, y: -212, col: '#f43f5e', stripe: '#fde047' },
          { x: w - 265, y: -212, col: '#06b6d4', stripe: '#ffffff' },
          { x: 265, y: h + 212, col: '#10b981', stripe: '#fef08a' },
          { x: w - 265, y: h + 212, col: '#f97316', stripe: '#ffffff' },
        ]) {
          fillPxRect(pitchCacheCtx, sb.x - 14, sb.y - 7, 28, 14, outline, px);
          fillPxRect(pitchCacheCtx, sb.x - 11, sb.y - 4, 22, 8, sb.col, px);
          fillPxRect(pitchCacheCtx, sb.x - 6, sb.y - 2, 12, 4, sb.stripe, px);
        }

        const umbrellas = [
          { x: 170, y: -222, c1: '#f43f5e', c2: '#ffffff' },
          { x: 480, y: -224, c1: '#0ea5e9', c2: '#fef08a' },
          { x: w - 480, y: -224, c1: '#ec4899', c2: '#ffffff' },
          { x: w - 170, y: -222, c1: '#10b981', c2: '#fef08a' },
          { x: 170, y: h + 222, c1: '#8b5cf6', c2: '#ffffff' },
          { x: 480, y: h + 224, c1: '#f97316', c2: '#fef08a' },
          { x: w - 480, y: h + 224, c1: '#06b6d4', c2: '#ffffff' },
          { x: w - 170, y: h + 222, c1: '#f43f5e', c2: '#fef08a' },
          { x: -236, y: 150, c1: '#f43f5e', c2: '#ffffff' },
          { x: -236, y: h - 150, c1: '#0ea5e9', c2: '#fef08a' },
          { x: w + 236, y: 150, c1: '#10b981', c2: '#ffffff' },
          { x: w + 236, y: h - 150, c1: '#ec4899', c2: '#fef08a' },
        ];
        for (const umb of umbrellas) {
          drawBeachUmbrella(pitchCacheCtx, umb.x, umb.y, umb.c1, umb.c2, px);
        }

        const palmPositions = [
          { x: 330, y: -220 },
          { x: w - 330, y: -220 },
          { x: 330, y: h + 224 },
          { x: w - 330, y: h + 224 },
          { x: -242, y: 78 },
          { x: -242, y: h - 78 },
          { x: w + 242, y: 78 },
          { x: w + 242, y: h - 78 },
        ];
        for (const pm of palmPositions) {
          drawPixelPalmTree(pitchCacheCtx, pm.x, pm.y, px);
        }
      } else if (selectedPitchTheme === 'TWILIGHT_SYNTH') {
        // === 4. TWILIGHT SYNTH: CYBER-SYNTHWAVES, NEON LASER GRID & SKYLINE ROOFTOP ===
        pitchCacheCtx.fillStyle = '#09051c';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Giant Retro Outrun Segmented Sunset Glow & Horizon Disc Above Stadium
        const sunGrad = pitchCacheCtx.createRadialGradient(w * 0.5, -280, 10, w * 0.5, -280, 320);
        sunGrad.addColorStop(0, 'rgba(244, 114, 182, 0.52)');
        sunGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.26)');
        sunGrad.addColorStop(1, 'rgba(9, 5, 28, 0)');
        pitchCacheCtx.fillStyle = sunGrad;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, -280, 320, 0, Math.PI * 2);
        pitchCacheCtx.fill();

        fillPxRect(pitchCacheCtx, w * 0.5 - 64, -310, 128, 8, '#fde047', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 76, -296, 152, 8, '#fb923c', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 84, -282, 168, 8, '#f43f5e', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 76, -268, 152, 6, '#e879f9', px);

        pitchCacheCtx.strokeStyle = 'rgba(232, 121, 249, 0.34)';
        pitchCacheCtx.lineWidth = 2;
        for (let gx = -CACHE_PAD_X; gx <= w + CACHE_PAD_X; gx += 72) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(gx, -CACHE_PAD_Y);
          pitchCacheCtx.lineTo(gx, h + CACHE_PAD_Y);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(34, 211, 238, 0.32)';
        for (let gy = -CACHE_PAD_Y; gy <= h + CACHE_PAD_Y; gy += 64) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(-CACHE_PAD_X, gy);
          pitchCacheCtx.lineTo(w + CACHE_PAD_X, gy);
          pitchCacheCtx.stroke();
        }

        // Cyber-Synth Skyline Towers (Strictly outside Stadium Bowl at y <= -305, y >= h + 210, x <= -290, x >= w + 206)
        const buildings = [
          { x: 85, y: -305, bw: 96, bh: 92, c: '#1e1b4b', win: '#fde047' },
          { x: 195, y: -320, bw: 110, bh: 106, c: '#311042', win: '#22d3ee' },
          { x: 320, y: -296, bw: 88, bh: 82, c: '#1e1b4b', win: '#f472b6' },
          { x: w - 410, y: -300, bw: 92, bh: 86, c: '#311042', win: '#22d3ee' },
          { x: w - 305, y: -322, bw: 108, bh: 108, c: '#1e1b4b', win: '#fde047' },
          { x: w - 183, y: -304, bw: 96, bh: 90, c: '#311042', win: '#a7f3d0' },
          { x: 95, y: h + 212, bw: 104, bh: 96, c: '#311042', win: '#22d3ee' },
          { x: 215, y: h + 212, bw: 112, bh: 108, c: '#1e1b4b', win: '#f472b6' },
          { x: w - 327, y: h + 212, bw: 112, bh: 108, c: '#1e1b4b', win: '#fde047' },
          { x: w - 199, y: h + 212, bw: 104, bh: 96, c: '#311042', win: '#22d3ee' },
          { x: -292, y: 95, bw: 84, bh: 150, c: '#1e1b4b', win: '#fde047' },
          { x: -292, y: h - 245, bw: 84, bh: 150, c: '#311042', win: '#f472b6' },
          { x: w + 208, y: 95, bw: 84, bh: 150, c: '#311042', win: '#22d3ee' },
          { x: w + 208, y: h - 245, bw: 84, bh: 150, c: '#1e1b4b', win: '#fde047' },
        ];
        for (const b of buildings) {
          fillPxRect(pitchCacheCtx, b.x - 4, b.y - 4, b.bw + 8, b.bh + 8, outline, px);
          fillPxRect(pitchCacheCtx, b.x, b.y, b.bw, b.bh, b.c, px);
          fillPxRect(pitchCacheCtx, b.x + 6, b.y + 4, b.bw - 12, 5, '#f472b6', px);
          fillPxRect(pitchCacheCtx, b.x + b.bw * 0.5 - 3, b.y - 12, 6, 10, '#22d3ee', px);
          for (let wx = b.x + 12; wx < b.x + b.bw - 14; wx += 18) {
            for (let wy = b.y + 14; wy < b.y + b.bh - 12; wy += 16) {
              if ((wx + wy) % 5 !== 0) {
                fillPxRect(pitchCacheCtx, wx, wy, 8, 8, b.win, px);
              }
            }
          }
        }
      } else if (selectedPitchTheme === 'ARCTIC_ICE') {
        // === 5. ARCTIC ICE: GLACIER FROST FJORD, SNOW PINES & ALPINE SKI LODGES ===
        pitchCacheCtx.fillStyle = '#0f172a';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Frozen Glacial Fjord Ring & Snow-Blanketed Shore Outside the Stadium Bowl
        fillPxRect(pitchCacheCtx, -370, -300, w + 740, h + 600, '#1e3a8a', px);
        fillPxRect(pitchCacheCtx, -335, -272, w + 670, h + 544, '#38bdf8', px);
        fillPxRect(pitchCacheCtx, -305, -248, w + 610, h + 496, '#e2e8f0', px);
        fillPxRect(pitchCacheCtx, -276, -224, w + 552, h + 448, '#f8fafc', px);

        // Glowing Crystalline Ice Monoliths on Left & Right Glacial Banks (Outside Stadium Bowl)
        for (const ic of [
          { x: -238, y: h * 0.5 - 64 },
          { x: -238, y: h * 0.5 + 42 },
          { x: w + 222, y: h * 0.5 - 64 },
          { x: w + 222, y: h * 0.5 + 42 },
        ]) {
          fillPxRect(pitchCacheCtx, ic.x - 4, ic.y - 4, 24, 32, outline, px);
          fillPxRect(pitchCacheCtx, ic.x, ic.y, 16, 24, '#38bdf8', px);
          fillPxRect(pitchCacheCtx, ic.x + 3, ic.y + 3, 10, 18, '#bae6fd', px);
          fillPxRect(pitchCacheCtx, ic.x + 5, ic.y + 5, 5, 10, '#ffffff', px);
        }

        // Cozy Alpine Timber Ski Lodges with Warm Lit Windows & Chimneys (Strictly outside Stadium Bowl)
        for (const lodge of [
          { x: 140, y: -262 },
          { x: w - 236, y: -262 },
          { x: 140, y: h + 212 },
          { x: w - 236, y: h + 212 },
        ]) {
          fillPxRect(pitchCacheCtx, lodge.x + 70, lodge.y - 12, 16, 20, outline, px);
          fillPxRect(pitchCacheCtx, lodge.x + 73, lodge.y - 9, 10, 14, '#64748b', px);
          fillPxRect(pitchCacheCtx, lodge.x - 4, lodge.y - 4, 104, 58, outline, px);
          fillPxRect(pitchCacheCtx, lodge.x, lodge.y, 96, 50, '#78350f', px);
          fillPxRect(pitchCacheCtx, lodge.x - 6, lodge.y - 6, 108, 18, outline, px);
          fillPxRect(pitchCacheCtx, lodge.x - 3, lodge.y - 3, 102, 12, '#ffffff', px);
          fillPxRect(pitchCacheCtx, lodge.x + 14, lodge.y + 18, 20, 18, outline, px);
          fillPxRect(pitchCacheCtx, lodge.x + 17, lodge.y + 21, 14, 12, '#fde047', px);
          fillPxRect(pitchCacheCtx, lodge.x + 60, lodge.y + 18, 20, 18, outline, px);
          fillPxRect(pitchCacheCtx, lodge.x + 63, lodge.y + 21, 14, 12, '#fde047', px);
        }

        // Snow-Capped 16-Bit Pine Trees Around the Fjord (Outside Stadium Bowl)
        const pineCoords = [
          { x: 320, y: -226 },
          { x: 450, y: -232 },
          { x: w - 450, y: -232 },
          { x: w - 320, y: -226 },
          { x: 320, y: h + 228 },
          { x: 450, y: h + 234 },
          { x: w - 450, y: h + 234 },
          { x: w - 320, y: h + 228 },
          { x: -236, y: 110 },
          { x: -248, y: 240 },
          { x: -248, y: h - 240 },
          { x: -236, y: h - 110 },
          { x: w + 236, y: 110 },
          { x: w + 248, y: 240 },
          { x: w + 248, y: h - 240 },
          { x: w + 236, y: h - 110 },
        ];
        for (const pt of pineCoords) {
          drawSnowPineTree(pitchCacheCtx, pt.x, pt.y, px);
        }
      } else if (selectedPitchTheme === 'VOLCANO_FORGE') {
        // === 6. VOLCANO FORGE: MAGMA CALDERA CITADEL, LAVA RIVERS & DRAGON BRAZIERS ===
        pitchCacheCtx.fillStyle = '#7c2d12';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Bright Glowing Lava River Moat Outside the Basalt Citadel
        fillPxRect(pitchCacheCtx, -370, -300, w + 740, h + 600, '#c2410c', px);
        fillPxRect(pitchCacheCtx, -335, -270, w + 670, h + 540, '#ea580c', px);
        fillPxRect(pitchCacheCtx, -304, -244, w + 608, h + 488, '#f97316', px);
        fillPxRect(pitchCacheCtx, -278, -222, w + 556, h + 444, '#facc15', px);

        // Left & Right Obsidian Stone Bridges Spanning the Outer Lava Moat
        for (const bx of [-296, w + 196]) {
          fillPxRect(pitchCacheCtx, bx, h * 0.34, 100, h * 0.32, outline, px);
          fillPxRect(pitchCacheCtx, bx + 4, h * 0.34 + 4, 92, h * 0.32 - 8, '#3f3f46', px);
          fillPxRect(pitchCacheCtx, bx + 12, h * 0.34 + 14, 76, 8, '#f97316', px);
          fillPxRect(pitchCacheCtx, bx + 12, h * 0.66 - 22, 76, 8, '#f97316', px);
          fillPxRect(pitchCacheCtx, bx + 36, h * 0.5 - 12, 28, 24, outline, px);
          fillPxRect(pitchCacheCtx, bx + 40, h * 0.5 - 8, 20, 16, '#facc15', px);
        }

        // 8 Ancient Obsidian Fire Brazier Pedestals Outside the Stadium Wall
        for (const bz of [
          { x: 210, y: -214 },
          { x: w - 210, y: -214 },
          { x: 210, y: h + 214 },
          { x: w - 210, y: h + 214 },
          { x: -232, y: 155 },
          { x: -232, y: h - 155 },
          { x: w + 232, y: 155 },
          { x: w + 232, y: h - 155 },
        ]) {
          fillPxRect(pitchCacheCtx, bz.x - 18, bz.y - 18, 36, 36, outline, px);
          fillPxRect(pitchCacheCtx, bz.x - 14, bz.y - 14, 28, 28, '#3f3f46', px);
          fillPxRect(pitchCacheCtx, bz.x - 10, bz.y - 10, 20, 20, '#ea580c', px);
          fillPxRect(pitchCacheCtx, bz.x - 6, bz.y - 6, 12, 12, '#fde047', px);
        }
      } else if (selectedPitchTheme === 'TURF_AUTUMN') {
        // === 7. AUTUMN HARVEST TURF: GOLDEN MAPLE PARK, COBBLESTONE PROMENADE & HARVEST FESTIVAL ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        const bandW = 136;
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
        for (let bx = -CACHE_PAD_X; bx < w + CACHE_PAD_X; bx += bandW * 2) {
          pitchCacheCtx.fillRect(bx, -CACHE_PAD_Y, bandW, h + CACHE_PAD_Y * 2);
        }

        // Warm Sandstone Autumn Park Promenade Path Outside Left & Right Stadium Gates
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 54, w + CACHE_PAD_X * 2, 108, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 48, w + CACHE_PAD_X * 2, 96, '#fed7aa', px);
        for (let cx = -CACHE_PAD_X + 40; cx <= w + CACHE_PAD_X - 40; cx += 52) {
          if (cx > -STADIUM_BOWL_PAD - 20 && cx < w + STADIUM_BOWL_PAD + 20) continue;
          fillPxRect(pitchCacheCtx, cx, h * 0.5 - 36, 28, 18, '#fdba74', px);
          fillPxRect(pitchCacheCtx, cx + 14, h * 0.5 + 18, 28, 18, '#fdba74', px);
        }

        // Harvest Festival Timber Market Stalls & Pumpkin Patches Outside Left & Right Concourses
        for (const sx of [-262, w + 214]) {
          for (const sy of [h * 0.22 - 28, h * 0.78 - 28]) {
            fillPxRect(pitchCacheCtx, sx - 4, sy - 4, 52, 56, outline, px);
            fillPxRect(pitchCacheCtx, sx, sy, 44, 48, '#78350f', px);
            for (let st = 0; st < 4; st++) {
              fillPxRect(pitchCacheCtx, sx + 2 + st * 10, sy + 2, 10, 14, st % 2 === 0 ? '#ea580c' : '#fef3c7', px);
            }
            fillPxRect(pitchCacheCtx, sx + 6, sy + 24, 14, 14, '#f97316', px);
            fillPxRect(pitchCacheCtx, sx + 11, sy + 21, 4, 4, '#15803d', px);
            fillPxRect(pitchCacheCtx, sx + 24, sy + 26, 14, 12, '#facc15', px);
          }
        }

        // 16 Crimson, Amber & Gold Autumn Maple & Ginkgo Trees Strictly Outside the Stadium Bowl
        const maplePositions = [
          { x: -236, y: 88, s: 2, v: 0 },
          { x: -325, y: 185, s: 2, v: 1 },
          { x: -236, y: h - 88, s: 2, v: 2 },
          { x: -325, y: h - 185, s: 2, v: 0 },
          { x: w + 236, y: 88, s: 2, v: 1 },
          { x: w + 325, y: 185, s: 2, v: 2 },
          { x: w + 236, y: h - 88, s: 2, v: 0 },
          { x: w + 325, y: h - 185, s: 2, v: 1 },
          { x: 180, y: -234, s: 2, v: 0 },
          { x: 430, y: -238, s: 2, v: 2 },
          { x: w - 430, y: -238, s: 2, v: 1 },
          { x: w - 180, y: -234, s: 2, v: 0 },
          { x: 180, y: h + 234, s: 2, v: 1 },
          { x: 430, y: h + 238, s: 2, v: 0 },
          { x: w - 430, y: h + 238, s: 2, v: 2 },
          { x: w - 180, y: h + 234, s: 2, v: 1 },
        ];
        for (const mp of maplePositions) {
          drawAutumnMapleTree(pitchCacheCtx, mp.x, mp.y, mp.s, mp.v, px);
        }
      } else if (selectedPitchTheme === 'TURF_SAKURA') {
        // === 8. SAKURA BLOSSOM TURF: KYOTO IMPERIAL GARDEN, KOI PONDS & VERMILION TORII GATES ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        const bandW = 136;
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
        for (let bx = -CACHE_PAD_X; bx < w + CACHE_PAD_X; bx += bandW * 2) {
          pitchCacheCtx.fillRect(bx, -CACHE_PAD_Y, bandW, h + CACHE_PAD_Y * 2);
        }

        // White Pebble Zen Garden Walkways Outside Stadium Gates
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 52, w + CACHE_PAD_X * 2, 104, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 46, w + CACHE_PAD_X * 2, 92, '#fdf2f8', px);

        // Left & Right Imperial Turquoise Koi Ponds & Stone Toro Lanterns Outside the Stadium Wall
        for (const kx of [-268, w + 200]) {
          for (const ky of [h * 0.2 - 36, h * 0.8 - 36]) {
            fillPxRect(pitchCacheCtx, kx - 4, ky - 4, 76, 76, outline, px);
            fillPxRect(pitchCacheCtx, kx, ky, 68, 68, '#94a3b8', px);
            fillPxRect(pitchCacheCtx, kx + 6, ky + 6, 56, 56, '#0284c7', px);
            fillPxRect(pitchCacheCtx, kx + 12, ky + 12, 44, 44, '#38bdf8', px);
            fillPxRect(pitchCacheCtx, kx + 14, ky + 16, 12, 12, '#16a34a', px);
            fillPxRect(pitchCacheCtx, kx + 17, ky + 19, 6, 6, '#f472b6', px);
            fillPxRect(pitchCacheCtx, kx + 38, ky + 38, 12, 12, '#16a34a', px);
            fillPxRect(pitchCacheCtx, kx + 26, ky - 16, 16, 16, outline, px);
            fillPxRect(pitchCacheCtx, kx + 29, ky - 13, 10, 10, '#cbd5e1', px);
            fillPxRect(pitchCacheCtx, kx + 31, ky - 11, 6, 6, '#fde047', px);
          }
        }

        // Traditional Vermilion Torii Gates on Outer Left & Right Walkways
        for (const gx of [-246, w + 214]) {
          const gy = h * 0.5 - 32;
          fillPxRect(pitchCacheCtx, gx - 4, gy - 4, 36, 68, outline, px);
          fillPxRect(pitchCacheCtx, gx, gy, 8, 60, '#dc2626', px);
          fillPxRect(pitchCacheCtx, gx + 20, gy, 8, 60, '#dc2626', px);
          fillPxRect(pitchCacheCtx, gx - 8, gy - 6, 44, 10, outline, px);
          fillPxRect(pitchCacheCtx, gx - 6, gy - 4, 40, 6, '#ef4444', px);
          fillPxRect(pitchCacheCtx, gx - 4, gy + 46, 36, 8, '#ef4444', px);
        }

        // 16 Lush Pink Cherry Blossom Sakura Trees Strictly Outside the Stadium Bowl
        const sakuraPositions = [
          { x: -236, y: 88, s: 2, v: 0 },
          { x: -325, y: 185, s: 2, v: 1 },
          { x: -236, y: h - 88, s: 2, v: 1 },
          { x: -325, y: h - 185, s: 2, v: 0 },
          { x: w + 236, y: 88, s: 2, v: 1 },
          { x: w + 325, y: 185, s: 2, v: 0 },
          { x: w + 236, y: h - 88, s: 2, v: 0 },
          { x: w + 325, y: h - 185, s: 2, v: 1 },
          { x: 180, y: -234, s: 2, v: 0 },
          { x: 430, y: -238, s: 2, v: 1 },
          { x: w - 430, y: -238, s: 2, v: 0 },
          { x: w - 180, y: -234, s: 2, v: 1 },
          { x: 180, y: h + 234, s: 2, v: 1 },
          { x: 430, y: h + 238, s: 2, v: 0 },
          { x: w - 430, y: h + 238, s: 2, v: 1 },
          { x: w - 180, y: h + 234, s: 2, v: 0 },
        ];
        for (const sk of sakuraPositions) {
          drawSakuraBlossomTree(pitchCacheCtx, sk.x, sk.y, sk.s, sk.v, px);
        }
      } else if (selectedPitchTheme === 'TURF_CHAMPIONS') {
        // === 9. CHAMPIONS CATHEDRAL: FLOODLIT EUROPEAN TROPHY ARENA, GOLD BANNERS & CUP PLINTHS ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        const bandW = 128;
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
        for (let bx = -CACHE_PAD_X; bx < w + CACHE_PAD_X; bx += bandW * 2) {
          pitchCacheCtx.fillRect(bx, -CACHE_PAD_Y, bandW, h + CACHE_PAD_Y * 2);
        }

        // Royal Navy & Gold VIP Red-Carpet Tunnel Approaches Outside the Stadium Gates
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 56, w + CACHE_PAD_X * 2, 112, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 50, w + CACHE_PAD_X * 2, 100, '#1e1b4b', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 24, w + CACHE_PAD_X * 2, 48, '#b91c1c', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 28, w + CACHE_PAD_X * 2, 4, '#fde047', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 + 24, w + CACHE_PAD_X * 2, 4, '#fde047', px);

        // Twin Gleaming 16-Bit Golden Championship Trophy Plinths Outside the Stadium Wall
        for (const tx of [-234, w + 234]) {
          for (const ty of [h * 0.24, h * 0.76]) {
            fillPxRect(pitchCacheCtx, tx - 26, ty - 26, 52, 52, outline, px);
            fillPxRect(pitchCacheCtx, tx - 22, ty - 22, 44, 44, '#1e293b', px);
            fillPxRect(pitchCacheCtx, tx - 16, ty - 16, 32, 32, '#b45309', px);
            fillPxRect(pitchCacheCtx, tx - 10, ty - 10, 20, 20, '#facc15', px);
            fillPxRect(pitchCacheCtx, tx - 6, ty - 6, 12, 12, '#fef08a', px);
            fillPxRect(pitchCacheCtx, tx - 3, ty - 3, 6, 6, '#ffffff', px);
          }
        }
      } else {
        // === 10. CLASSIC SUNLIT TURF: ROYAL BOTANICAL PARK, ORNAMENTAL FOUNTAINS & OLYMPIC ARENA ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        const bandW = 136;
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
        for (let bx = -CACHE_PAD_X; bx < w + CACHE_PAD_X; bx += bandW * 2) {
          pitchCacheCtx.fillRect(bx, -CACHE_PAD_Y, bandW, h + CACHE_PAD_Y * 2);
        }

        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 52, w + CACHE_PAD_X * 2, 104, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 46, w + CACHE_PAD_X * 2, 92, '#e2e8f0', px);
        for (const hx of [-265, w + 225]) {
          fillPxRect(pitchCacheCtx, hx, h * 0.5 - 44, 42, 14, '#15803d', px);
          fillPxRect(pitchCacheCtx, hx + 4, h * 0.5 - 41, 34, 8, '#22c55e', px);
          fillPxRect(pitchCacheCtx, hx, h * 0.5 + 30, 42, 14, '#15803d', px);
          fillPxRect(pitchCacheCtx, hx + 4, h * 0.5 + 33, 34, 8, '#22c55e', px);
        }

        // Royal Botanical Park Fountains Strictly Outside the Stadium Bowl
        drawParkFountain(pitchCacheCtx, -234, h * 0.24, 34, px);
        drawParkFountain(pitchCacheCtx, -234, h * 0.76, 34, px);
        drawParkFountain(pitchCacheCtx, w + 234, h * 0.24, 34, px);
        drawParkFountain(pitchCacheCtx, w + 234, h * 0.76, 34, px);

        const flowerPalette = GRAPHICS_CONFIG.palette.apron.flowerColors;
        for (let i = 0; i < 68; i++) {
          const side = i % 4;
          let fx = 0;
          let fy = 0;
          if (side === 0) {
            fx = -420 + ((i * 47) % 190);
            fy = -240 + ((i * 173) % (h + 480));
          } else if (side === 1) {
            fx = w + 230 + ((i * 53) % 190);
            fy = -240 + ((i * 191) % (h + 480));
          } else if (side === 2) {
            fx = -80 + ((i * 167) % (w + 160));
            fy = -340 + ((i * 31) % 115);
          } else {
            fx = -80 + ((i * 181) % (w + 160));
            fy = h + 225 + ((i * 37) % 115);
          }
          const col = flowerPalette[i % flowerPalette.length];
          fillPxRect(pitchCacheCtx, fx, fy + px, px * 2, px * 2, '#34a86c', px);
          fillPxRect(pitchCacheCtx, fx - px, fy, px * 3, px * 2, col, px);
          fillPxRect(pitchCacheCtx, fx, fy - px, px * 2, px * 3, col, px);
          fillPxRect(pitchCacheCtx, fx, fy, px, px, '#fef08a', px);
        }

        const treePositions = [
          { x: -236, y: 88, s: 2, v: 0 },
          { x: -325, y: 185, s: 2, v: 1 },
          { x: -236, y: h - 88, s: 2, v: 1 },
          { x: -325, y: h - 185, s: 2, v: 0 },
          { x: w + 236, y: 88, s: 2, v: 1 },
          { x: w + 325, y: 185, s: 2, v: 0 },
          { x: w + 236, y: h - 88, s: 2, v: 0 },
          { x: w + 325, y: h - 185, s: 2, v: 1 },
          { x: 180, y: -234, s: 2, v: 0 },
          { x: 430, y: -238, s: 2, v: 1 },
          { x: w - 430, y: -238, s: 2, v: 0 },
          { x: w - 180, y: -234, s: 2, v: 1 },
          { x: 180, y: h + 234, s: 2, v: 1 },
          { x: 430, y: h + 238, s: 2, v: 0 },
          { x: w - 430, y: h + 238, s: 2, v: 1 },
          { x: w - 180, y: h + 234, s: 2, v: 0 },
        ];
        for (const tr of treePositions) {
          drawPixelTree(pitchCacheCtx, tr.x, tr.y, tr.s, tr.v, px);
        }
      }

      // Deep Vertical & Horizontal Outer World Details (Strictly beyond ±380px so they never touch the Stadium Bowl!)
      for (const bandSign of [-1, 1]) {
        for (let tier = 0; tier < 4; tier++) {
          const baseY = bandSign < 0 ? -420 - tier * 235 : h + 340 + tier * 235;
          if (selectedPitchTheme === 'COSMIC_SPACE') {
            fillPxRect(pitchCacheCtx, -760, baseY - 22, w + 1520, 44, outline, px);
            fillPxRect(pitchCacheCtx, -754, baseY - 16, w + 1508, 32, '#1e1b4b', px);
            fillPxRect(pitchCacheCtx, -746, baseY - 6, w + 1492, 12, '#312e81', px);
            for (let sx = -680; sx <= w + 680; sx += 260) {
              fillPxRect(pitchCacheCtx, sx - 58, baseY - 56, 116, 36, outline, px);
              fillPxRect(pitchCacheCtx, sx - 52, baseY - 50, 104, 24, '#1d4ed8', px);
              fillPxRect(pitchCacheCtx, sx - 48, baseY - 39, 96, 3, '#38bdf8', px);
              fillPxRect(pitchCacheCtx, sx - 16, baseY + 18, 32, 32, '#4c1d95', px);
              fillPxRect(pitchCacheCtx, sx - 8, baseY + 26, 16, 16, tier % 2 === 0 ? '#22d3ee' : '#f472b6', px);
            }
            if (tier % 2 === 1) {
              drawRingedPlanet(pitchCacheCtx, tier === 1 ? -420 : w + 420, baseY - 70, 56, px);
              drawRingedPlanet(pitchCacheCtx, tier === 1 ? w - 320 : 320, baseY + 65, 48, px);
            }
          } else if (selectedPitchTheme === 'URBAN_CONCRETE') {
            fillPxRect(pitchCacheCtx, -880, baseY - 28, w + 1760, 56, '#1e293b', px);
            for (let lx = -840; lx < w + 840; lx += 84) {
              fillPxRect(pitchCacheCtx, lx, baseY - 3, 42, 6, '#facc15', px);
            }
            for (let bx = -720; bx <= w + 720; bx += 310) {
              const bCol = ((bx + tier * 100) % 620 === 0) ? '#7c2d12' : '#334155';
              fillPxRect(pitchCacheCtx, bx - 95, baseY + 34, 190, 118, outline, px);
              fillPxRect(pitchCacheCtx, bx - 89, baseY + 40, 178, 106, bCol, px);
              fillPxRect(pitchCacheCtx, bx - 78, baseY + 50, 156, 86, '#475569', px);
              if (tier % 2 === 0) {
                fillPxRect(pitchCacheCtx, bx - 64, baseY + 58, 128, 70, '#ea580c', px);
                pitchCacheCtx.strokeStyle = '#ffffff';
                pitchCacheCtx.lineWidth = 2;
                pitchCacheCtx.strokeRect(bx - 60, baseY + 62, 120, 62);
              } else {
                for (let wx = bx - 64; wx <= bx + 48; wx += 28) {
                  for (let wy = baseY + 58; wy <= baseY + 110; wy += 24) {
                    fillPxRect(pitchCacheCtx, wx, wy, 16, 14, (wx + wy) % 3 === 0 ? '#fde047' : '#38bdf8', px);
                  }
                }
              }
            }
          } else if (selectedPitchTheme === 'RIO_CLAY') {
            fillPxRect(pitchCacheCtx, -880, baseY - 22, w + 1760, 44, '#fde68a', px);
            for (let mx = -860; mx < w + 860; mx += 48) {
              fillPxRect(pitchCacheCtx, mx, baseY - 14, 24, 10, '#0f172a', px);
              fillPxRect(pitchCacheCtx, mx + 24, baseY + 2, 24, 10, '#ffffff', px);
            }
            const umbCols = ['#f43f5e', '#facc15', '#38bdf8', '#22c55e', '#a855f7'];
            for (let ux = -680; ux <= w + 680; ux += 240) {
              const uCol = umbCols[Math.abs(Math.floor(ux / 240) + tier) % umbCols.length];
              fillPxRect(pitchCacheCtx, ux - 22, baseY + 46, 44, 44, outline, px);
              fillPxRect(pitchCacheCtx, ux - 18, baseY + 50, 36, 36, uCol, px);
              fillPxRect(pitchCacheCtx, ux - 6, baseY + 62, 12, 12, '#ffffff', px);
              drawPixelPalmTree(pitchCacheCtx, ux + 58, baseY + 68, px);
            }
          } else if (selectedPitchTheme === 'TWILIGHT_SYNTH') {
            fillPxRect(pitchCacheCtx, -880, baseY - 18, w + 1760, 36, '#2e1065', px);
            fillPxRect(pitchCacheCtx, -880, baseY - 4, w + 1760, 8, tier % 2 === 0 ? '#f472b6' : '#22d3ee', px);
            for (let sx = -700; sx <= w + 700; sx += 280) {
              fillPxRect(pitchCacheCtx, sx - 64, baseY + 28, 128, 96, outline, px);
              fillPxRect(pitchCacheCtx, sx - 58, baseY + 34, 116, 84, '#0f0722', px);
              fillPxRect(pitchCacheCtx, sx - 48, baseY + 44, 96, 12, '#22d3ee', px);
              fillPxRect(pitchCacheCtx, sx - 48, baseY + 66, 96, 12, '#f472b6', px);
              fillPxRect(pitchCacheCtx, sx - 48, baseY + 88, 96, 12, '#facc15', px);
            }
          } else if (selectedPitchTheme === 'ARCTIC_ICE') {
            fillPxRect(pitchCacheCtx, -880, baseY - 18, w + 1760, 36, '#bae6fd', px);
            for (let cx = -680; cx <= w + 680; cx += 270) {
              fillPxRect(pitchCacheCtx, cx - 54, baseY + 32, 108, 72, outline, px);
              fillPxRect(pitchCacheCtx, cx - 48, baseY + 38, 96, 60, '#78350f', px);
              fillPxRect(pitchCacheCtx, cx - 52, baseY + 32, 104, 18, '#f8fafc', px);
              fillPxRect(pitchCacheCtx, cx - 32, baseY + 58, 22, 20, '#fef08a', px);
              fillPxRect(pitchCacheCtx, cx + 10, baseY + 58, 22, 20, '#fef08a', px);
              drawSnowPineTree(pitchCacheCtx, cx + 88, baseY + 64, px);
              drawSnowPineTree(pitchCacheCtx, cx - 88, baseY + 68, px);
            }
          } else if (selectedPitchTheme === 'VOLCANO_FORGE') {
            fillPxRect(pitchCacheCtx, -880, baseY - 20, w + 1760, 40, outline, px);
            fillPxRect(pitchCacheCtx, -880, baseY - 14, w + 1760, 28, '#ea580c', px);
            fillPxRect(pitchCacheCtx, -880, baseY - 6, w + 1760, 12, '#fde047', px);
            for (let fx = -680; fx <= w + 680; fx += 270) {
              fillPxRect(pitchCacheCtx, fx - 56, baseY + 34, 112, 82, outline, px);
              fillPxRect(pitchCacheCtx, fx - 50, baseY + 40, 100, 70, '#29150e', px);
              fillPxRect(pitchCacheCtx, fx - 32, baseY + 56, 64, 38, '#f97316', px);
              fillPxRect(pitchCacheCtx, fx - 18, baseY + 66, 36, 18, '#fef08a', px);
            }
          } else if (selectedPitchTheme === 'TURF_AUTUMN') {
            fillPxRect(pitchCacheCtx, -880, baseY - 18, w + 1760, 36, outline, px);
            fillPxRect(pitchCacheCtx, -880, baseY - 12, w + 1760, 24, '#fef3c7', px);
            for (let ax = -680; ax <= w + 680; ax += 250) {
              drawAutumnMapleTree(pitchCacheCtx, ax - 55, baseY + 66, 2, Math.abs(ax + tier) % 3, px);
              drawAutumnMapleTree(pitchCacheCtx, ax + 55, baseY + 78, 2, Math.abs(ax + tier + 1) % 3, px);
              fillPxRect(pitchCacheCtx, ax - 18, baseY + 52, 36, 36, outline, px);
              fillPxRect(pitchCacheCtx, ax - 14, baseY + 56, 28, 28, '#ea580c', px);
              fillPxRect(pitchCacheCtx, ax - 6, baseY + 64, 12, 12, '#fef08a', px);
            }
          } else if (selectedPitchTheme === 'TURF_SAKURA') {
            fillPxRect(pitchCacheCtx, -880, baseY - 18, w + 1760, 36, outline, px);
            fillPxRect(pitchCacheCtx, -880, baseY - 12, w + 1760, 24, '#fbcfe8', px);
            for (let kx = -680; kx <= w + 680; kx += 260) {
              drawSakuraBlossomTree(pitchCacheCtx, kx - 62, baseY + 68, 2, 0, px);
              drawSakuraBlossomTree(pitchCacheCtx, kx + 62, baseY + 74, 2, 1, px);
              fillPxRect(pitchCacheCtx, kx - 28, baseY + 46, 56, 14, outline, px);
              fillPxRect(pitchCacheCtx, kx - 24, baseY + 50, 48, 8, '#ef4444', px);
              fillPxRect(pitchCacheCtx, kx - 16, baseY + 58, 8, 34, '#dc2626', px);
              fillPxRect(pitchCacheCtx, kx + 8, baseY + 58, 8, 34, '#dc2626', px);
            }
          } else if (selectedPitchTheme === 'TURF_CHAMPIONS') {
            fillPxRect(pitchCacheCtx, -880, baseY - 20, w + 1760, 40, outline, px);
            fillPxRect(pitchCacheCtx, -880, baseY - 14, w + 1760, 28, '#1e3a8a', px);
            fillPxRect(pitchCacheCtx, -880, baseY - 2, w + 1760, 4, '#fde047', px);
            for (let cx = -680; cx <= w + 680; cx += 260) {
              fillPxRect(pitchCacheCtx, cx - 48, baseY + 38, 96, 76, outline, px);
              fillPxRect(pitchCacheCtx, cx - 42, baseY + 44, 84, 64, '#172554', px);
              fillPxRect(pitchCacheCtx, cx - 32, baseY + 54, 64, 44, '#2563eb', px);
              fillPxRect(pitchCacheCtx, cx - 12, baseY + 64, 24, 24, '#facc15', px);
              fillPxRect(pitchCacheCtx, cx - 6, baseY + 70, 12, 12, '#fef08a', px);
            }
          } else {
            fillPxRect(pitchCacheCtx, -880, baseY - 18, w + 1760, 36, outline, px);
            fillPxRect(pitchCacheCtx, -880, baseY - 12, w + 1760, 24, '#e2e8f0', px);
            for (let pxPos = -680; pxPos <= w + 680; pxPos += 250) {
              drawPixelTree(pitchCacheCtx, pxPos - 64, baseY + 68, 2, Math.abs(pxPos + tier) % 2, px);
              drawPixelTree(pitchCacheCtx, pxPos + 64, baseY + 74, 2, Math.abs(pxPos + tier + 1) % 2, px);
              if (tier % 2 === 0) {
                drawParkFountain(pitchCacheCtx, pxPos, baseY + 72, 28, px);
              } else {
                fillPxRect(pitchCacheCtx, pxPos - 36, baseY + 52, 72, 36, outline, px);
                fillPxRect(pitchCacheCtx, pxPos - 32, baseY + 56, 64, 28, '#15803d', px);
                fillPxRect(pitchCacheCtx, pxPos - 24, baseY + 62, 48, 16, '#f43f5e', px);
                fillPxRect(pitchCacheCtx, pxPos - 12, baseY + 66, 24, 8, '#fde047', px);
              }
            }
          }
        }
      }

      // ======================================================================
      // STEP 2: UNIFIED ARCHITECTURAL STADIUM BOWL PLINTH, CONCOURSE & GRANDSTANDS
      // Drawn ON TOP of the outside world so zero outside roads, grids, or props overlap!
      // ======================================================================
      const bowlThemeSpec: Record<
        PitchThemeId,
        {
          outerWall: string;
          concourseBase: string;
          concourseInner: string;
          collarOuter: string;
          collarInner: string;
          collarTrim: string;
          standBase: string;
          standStep: string;
          accentHome: string;
          accentAway: string;
        }
      > = {
        CLASSIC_TURF: {
          outerWall: '#334155',
          concourseBase: '#cbd5e1',
          concourseInner: '#e2e8f0',
          collarOuter: '#ea580c',
          collarInner: '#f97316',
          collarTrim: '#fff7ed',
          standBase: '#475569',
          standStep: '#64748b',
          accentHome: '#38bdf8',
          accentAway: '#fb7185',
        },
        TURF_AUTUMN: {
          outerWall: '#431407',
          concourseBase: '#fed7aa',
          concourseInner: '#ffedd5',
          collarOuter: '#9a3412',
          collarInner: '#d97706',
          collarTrim: '#fef9c3',
          standBase: '#78350f',
          standStep: '#92400e',
          accentHome: '#f59e0b',
          accentAway: '#ea580c',
        },
        TURF_SAKURA: {
          outerWall: '#500724',
          concourseBase: '#fbcfe8',
          concourseInner: '#fdf2f8',
          collarOuter: '#be185d',
          collarInner: '#f472b6',
          collarTrim: '#fff1f2',
          standBase: '#831843',
          standStep: '#9d174d',
          accentHome: '#f472b6',
          accentAway: '#fbcfe8',
        },
        TURF_CHAMPIONS: {
          outerWall: '#0f172a',
          concourseBase: '#1e293b',
          concourseInner: '#334155',
          collarOuter: '#1e3a8a',
          collarInner: '#2563eb',
          collarTrim: '#fde047',
          standBase: '#0f172a',
          standStep: '#1e3a8a',
          accentHome: '#fde047',
          accentAway: '#38bdf8',
        },
        COSMIC_SPACE: {
          outerWall: '#090d24',
          concourseBase: '#1e1b4b',
          concourseInner: '#312e81',
          collarOuter: '#1e1b4b',
          collarInner: '#3730a3',
          collarTrim: '#38bdf8',
          standBase: '#0f172a',
          standStep: '#1e293b',
          accentHome: '#38bdf8',
          accentAway: '#e879f9',
        },
        URBAN_CONCRETE: {
          outerWall: '#0f172a',
          concourseBase: '#334155',
          concourseInner: '#475569',
          collarOuter: '#1e293b',
          collarInner: '#334155',
          collarTrim: '#facc15',
          standBase: '#0f172a',
          standStep: '#1e293b',
          accentHome: '#facc15',
          accentAway: '#38bdf8',
        },
        RIO_CLAY: {
          outerWall: '#78350f',
          concourseBase: '#fde68a',
          concourseInner: '#fef3c7',
          collarOuter: '#92400e',
          collarInner: '#b45309',
          collarTrim: '#fef3c7',
          standBase: '#78350f',
          standStep: '#92400e',
          accentHome: '#22c55e',
          accentAway: '#f43f5e',
        },
        TWILIGHT_SYNTH: {
          outerWall: '#2e1065',
          concourseBase: '#1e1b4b',
          concourseInner: '#2e1065',
          collarOuter: '#3b0764',
          collarInner: '#1e1b4b',
          collarTrim: '#22d3ee',
          standBase: '#09051c',
          standStep: '#311042',
          accentHome: '#22d3ee',
          accentAway: '#f472b6',
        },
        ARCTIC_ICE: {
          outerWall: '#0c4a6e',
          concourseBase: '#cbd5e1',
          concourseInner: '#e2e8f0',
          collarOuter: '#0284c7',
          collarInner: '#7dd3fc',
          collarTrim: '#ecfeff',
          standBase: '#0f172a',
          standStep: '#1e3a8a',
          accentHome: '#38bdf8',
          accentAway: '#e0f2fe',
        },
        VOLCANO_FORGE: {
          outerWall: '#450a0a',
          concourseBase: '#18181b',
          concourseInner: '#27272a',
          collarOuter: '#450a0a',
          collarInner: '#27272a',
          collarTrim: '#f97316',
          standBase: '#09090b',
          standStep: '#27272a',
          accentHome: '#f97316',
          accentAway: '#facc15',
        },
      };

      const bowlSpec = bowlThemeSpec[selectedPitchTheme] || bowlThemeSpec.CLASSIC_TURF;

      // 2A. Outer Stadium Perimeter Wall & Solid Concourse Plinth (-162..w+162, -162..h+162)
      fillPxRect(
        pitchCacheCtx,
        -STADIUM_BOWL_PAD - 6,
        -STADIUM_BOWL_PAD - 6,
        w + (STADIUM_BOWL_PAD + 6) * 2,
        h + (STADIUM_BOWL_PAD + 6) * 2,
        outline,
        px
      );
      fillPxRect(
        pitchCacheCtx,
        -STADIUM_BOWL_PAD,
        -STADIUM_BOWL_PAD,
        w + STADIUM_BOWL_PAD * 2,
        h + STADIUM_BOWL_PAD * 2,
        bowlSpec.outerWall,
        px
      );
      fillPxRect(
        pitchCacheCtx,
        -STADIUM_BOWL_PAD + 8,
        -STADIUM_BOWL_PAD + 8,
        w + (STADIUM_BOWL_PAD - 8) * 2,
        h + (STADIUM_BOWL_PAD - 8) * 2,
        bowlSpec.concourseBase,
        px
      );
      fillPxRect(
        pitchCacheCtx,
        -STADIUM_BOWL_PAD + 16,
        -STADIUM_BOWL_PAD + 16,
        w + (STADIUM_BOWL_PAD - 16) * 2,
        h + (STADIUM_BOWL_PAD - 16) * 2,
        bowlSpec.concourseInner,
        px
      );

      // 2B. Inner Running Track / Pitch Collar (-40..w+40, -40..h+40)
      const trackPad = 40;
      fillPxRect(pitchCacheCtx, -trackPad - 4, -trackPad - 4, w + (trackPad + 4) * 2, h + (trackPad + 4) * 2, outline, px);
      fillPxRect(pitchCacheCtx, -trackPad, -trackPad, w + trackPad * 2, h + trackPad * 2, bowlSpec.collarOuter, px);
      fillPxRect(pitchCacheCtx, -trackPad + 8, -trackPad + 8, w + (trackPad - 8) * 2, h + (trackPad - 8) * 2, bowlSpec.collarInner, px);
      pitchCacheCtx.strokeStyle = bowlSpec.collarTrim;
      pitchCacheCtx.lineWidth = 2.5;
      pitchCacheCtx.strokeRect(-trackPad + 16, -trackPad + 16, w + (trackPad - 16) * 2, h + (trackPad - 16) * 2);

      // 2C. Top & Bottom Lower-Tier Grandstands (y = -94..-48 and y = h+48..h+94)
      for (const by of [-94, h + 48]) {
        fillPxRect(pitchCacheCtx, 92, by - 4, w - 184, 50, outline, px);
        fillPxRect(pitchCacheCtx, 96, by, w - 192, 42, bowlSpec.standBase, px);
        fillPxRect(pitchCacheCtx, 102, by + 7, w - 204, 11, bowlSpec.standStep, px);
        fillPxRect(pitchCacheCtx, 102, by + 24, w - 204, 11, bowlSpec.standStep, px);
        fillPxRect(pitchCacheCtx, 102, by + 2, (w - 204) * 0.48, 3, bowlSpec.accentHome, px);
        fillPxRect(pitchCacheCtx, w * 0.52, by + 2, (w - 204) * 0.48, 3, bowlSpec.accentAway, px);
      }

      // 2D. Top & Bottom Upper-Deck Grandstands & VIP Broadcast Gantry (y = -148..-102 and y = h+102..h+148)
      for (const standY of [-148, h + 104]) {
        fillPxRect(pitchCacheCtx, 92, standY - 4, w - 184, 50, outline, px);
        fillPxRect(pitchCacheCtx, 96, standY, w - 192, 42, '#0f172a', px);
        fillPxRect(pitchCacheCtx, 102, standY + 6, w - 204, 11, '#1e293b', px);
        fillPxRect(pitchCacheCtx, 102, standY + 22, w - 204, 11, '#334155', px);
        fillPxRect(pitchCacheCtx, 102, standY + 35, (w - 204) * 0.46, 5, bowlSpec.accentHome, px);
        fillPxRect(pitchCacheCtx, w * 0.52, standY + 35, (w - 204) * 0.46, 5, bowlSpec.accentAway, px);
        // Center VIP Broadcast Gantry Box
        fillPxRect(pitchCacheCtx, w * 0.5 - 88, standY + 4, 176, 32, outline, px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 84, standY + 8, 168, 24, '#1e293b', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 76, standY + 12, 152, 12, '#38bdf8', px);
      }

      // 2E. Left & Right End-Zone Grandstand Terraces (Split cleanly above and below the Goal Mouths!)
      const goalTopStandEnd = (h - PITCH.goalWidth) * 0.5 - 42;
      const goalBotStandStart = (h + PITCH.goalWidth) * 0.5 + 42;
      const topWingH = Math.max(80, goalTopStandEnd - 92);
      const botWingH = Math.max(80, h - 92 - goalBotStandStart);

      for (const standX of [-98, -148, w + 56, w + 106]) {
        const isInner = standX === -98 || standX === w + 56;
        const sideCol = standX < 0 ? bowlSpec.accentHome : bowlSpec.accentAway;
        for (const seg of [
          { sy: 92, sh: topWingH },
          { sy: goalBotStandStart, sh: botWingH },
        ]) {
          fillPxRect(pitchCacheCtx, standX - 4, seg.sy - 4, 48, seg.sh + 8, outline, px);
          fillPxRect(pitchCacheCtx, standX, seg.sy, 40, seg.sh, isInner ? bowlSpec.standBase : '#0f172a', px);
          fillPxRect(pitchCacheCtx, standX + 6, seg.sy + 6, 11, seg.sh - 12, isInner ? bowlSpec.standStep : '#1e293b', px);
          fillPxRect(pitchCacheCtx, standX + 23, seg.sy + 6, 11, seg.sh - 12, isInner ? bowlSpec.standStep : '#334155', px);
          fillPxRect(pitchCacheCtx, standX + 18, seg.sy + 8, 3, seg.sh - 16, sideCol, px);
        }
      }

      // 2F. 4 Corner Floodlight Towers in the Clean Stadium Corner Plazas
      drawCornerFloodlightTower(pitchCacheCtx, -102, -98, 1, 1, px);
      drawCornerFloodlightTower(pitchCacheCtx, w + 102, -98, -1, 1, px);
      drawCornerFloodlightTower(pitchCacheCtx, -102, h + 98, 1, -1, px);
      drawCornerFloodlightTower(pitchCacheCtx, w + 102, h + 98, -1, -1, px);


      // 4. Clipped Chamfered Pitch Turf, Bespoke Mowing Patterns, Center Circle Emblems & Chalk Markings
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

        pitchCacheCtx.fillStyle = isLight
          ? GRAPHICS_CONFIG.pitch.ditherDark
          : GRAPHICS_CONFIG.pitch.ditherLight;
        for (let dy = 12; dy < h - 12; dy += px * 6) {
          pitchCacheCtx.fillRect(Math.round(sx), dy, px, px * 2);
          pitchCacheCtx.fillRect(Math.round(sx + px * 2), dy + px * 3, px, px * 2);
        }
      }

      // Theme-Specific Bespoke Turf Pattern Overlay & Center Circle Art
      if (selectedPitchTheme === 'CLASSIC_TURF') {
        // Wembley Checkerboard Cross-Mowing Horizontal Bands + Royal Double Laurel Ring Emblem
        pitchCacheCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        const rowH = h / 8;
        for (let r = 0; r < 8; r += 2) {
          pitchCacheCtx.fillRect(0, r * rowH, w, rowH);
        }
        pitchCacheCtx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
        pitchCacheCtx.lineWidth = 4;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 64, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        pitchCacheCtx.strokeStyle = 'rgba(254, 240, 138, 0.32)';
        pitchCacheCtx.lineWidth = 2.5;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 42, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
      } else if (selectedPitchTheme === 'TURF_AUTUMN') {
        // Diagonal Argyle Harvest Lawn Mowing + Double Inlaid Golden Maple Diamond Center Emblem
        pitchCacheCtx.strokeStyle = 'rgba(254, 240, 138, 0.24)';
        pitchCacheCtx.lineWidth = 4;
        for (let d = -h; d < w + h; d += 150) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(d, 0);
          pitchCacheCtx.lineTo(d + h, h);
          pitchCacheCtx.stroke();
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(d + h, 0);
          pitchCacheCtx.lineTo(d, h);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(254, 249, 195, 0.58)';
        pitchCacheCtx.lineWidth = 5;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.moveTo(w * 0.5, h * 0.5 - 74);
        pitchCacheCtx.lineTo(w * 0.5 + 74, h * 0.5);
        pitchCacheCtx.lineTo(w * 0.5, h * 0.5 + 74);
        pitchCacheCtx.lineTo(w * 0.5 - 74, h * 0.5);
        pitchCacheCtx.closePath();
        pitchCacheCtx.stroke();
        pitchCacheCtx.strokeStyle = 'rgba(251, 146, 60, 0.42)';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.moveTo(w * 0.5, h * 0.5 - 46);
        pitchCacheCtx.lineTo(w * 0.5 + 46, h * 0.5);
        pitchCacheCtx.lineTo(w * 0.5, h * 0.5 + 46);
        pitchCacheCtx.lineTo(w * 0.5 - 46, h * 0.5);
        pitchCacheCtx.closePath();
        pitchCacheCtx.stroke();
      } else if (selectedPitchTheme === 'TURF_SAKURA') {
        // Concentric Zen Garden Radial Mowing Circles + 5-Petal Pink Sakura Blossom & Golden Stamen Center Crest
        pitchCacheCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        pitchCacheCtx.lineWidth = 6;
        for (const rad of [95, 220, 345, 470]) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.arc(w * 0.5, h * 0.5, rad, 0, Math.PI * 2);
          pitchCacheCtx.stroke();
        }
        for (let p = 0; p < 5; p++) {
          const ang = (p * Math.PI * 2) / 5 - Math.PI / 2;
          const pxCenter = w * 0.5 + Math.cos(ang) * 44;
          const pyCenter = h * 0.5 + Math.sin(ang) * 44;
          fillPxRect(pitchCacheCtx, pxCenter - 14, pyCenter - 14, 28, 28, 'rgba(251, 207, 232, 0.54)', px);
          fillPxRect(pitchCacheCtx, pxCenter - 6, pyCenter - 6, 12, 12, 'rgba(244, 114, 182, 0.45)', px);
        }
      } else if (selectedPitchTheme === 'TURF_CHAMPIONS') {
        // Championship V-Chevron Mowing Bands + Ornate 8-Point Golden Starball Center Crest
        pitchCacheCtx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        pitchCacheCtx.lineWidth = 14;
        for (let cx = 120; cx < w; cx += 180) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(cx - 60, 0);
          pitchCacheCtx.lineTo(cx, h * 0.5);
          pitchCacheCtx.lineTo(cx - 60, h);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(254, 240, 138, 0.58)';
        pitchCacheCtx.lineWidth = 4;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 68, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        pitchCacheCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        pitchCacheCtx.lineWidth = 2.5;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 42, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        for (let s = 0; s < 8; s++) {
          const ang = (s * Math.PI) / 4;
          fillPxRect(
            pitchCacheCtx,
            w * 0.5 + Math.cos(ang) * 68 - 6,
            h * 0.5 + Math.sin(ang) * 68 - 6,
            12,
            12,
            'rgba(254, 240, 138, 0.68)',
            px
          );
        }
      } else if (selectedPitchTheme === 'COSMIC_SPACE') {
        // Glowing Constellation Grid Nodes & Twin Intersecting Orbital Center Rings
        pitchCacheCtx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
        pitchCacheCtx.lineWidth = 2;
        for (let gy = stripeW; gy < h; gy += stripeW) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(0, gy);
          pitchCacheCtx.lineTo(w, gy);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(192, 132, 252, 0.38)';
        pitchCacheCtx.lineWidth = 4;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.ellipse(w * 0.5, h * 0.5, 92, 38, -0.35, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        pitchCacheCtx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.ellipse(w * 0.5, h * 0.5, 92, 38, 0.35, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
      } else if (selectedPitchTheme === 'URBAN_CONCRETE') {
        // Street Asphalt Expansion Joints & Double-Diamond Stencil Center Crest
        pitchCacheCtx.strokeStyle = 'rgba(51, 65, 85, 0.34)';
        pitchCacheCtx.lineWidth = 2;
        for (let gy = 140; gy < h; gy += 140) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(0, gy);
          pitchCacheCtx.lineTo(w, gy);
          pitchCacheCtx.stroke();
        }
        fillPxRect(pitchCacheCtx, w * 0.5 - 42, h * 0.5 - 42, 84, 84, 'rgba(250, 204, 21, 0.22)', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 24, h * 0.5 - 24, 48, 48, 'rgba(56, 189, 248, 0.22)', px);
      } else if (selectedPitchTheme === 'RIO_CLAY') {
        // Diamond-Cut Clay Grooming Lines & 8-Ray Copacabana Sunburst Center Ring
        pitchCacheCtx.strokeStyle = 'rgba(254, 243, 199, 0.18)';
        pitchCacheCtx.lineWidth = 3;
        for (let d = -h; d < w + h; d += 120) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(d, 0);
          pitchCacheCtx.lineTo(d + h, h);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
        pitchCacheCtx.lineWidth = 5;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 58, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        for (let r = 0; r < 8; r++) {
          const ang = (r * Math.PI) / 4;
          fillPxRect(
            pitchCacheCtx,
            w * 0.5 + Math.cos(ang) * 76 - 5,
            h * 0.5 + Math.sin(ang) * 76 - 5,
            10,
            10,
            'rgba(254, 240, 138, 0.45)',
            px
          );
        }
      } else if (selectedPitchTheme === 'TWILIGHT_SYNTH') {
        // Neon Cyber-Circuit Grid Traces & Concentric Outrun Center Sun
        pitchCacheCtx.strokeStyle = 'rgba(244, 114, 182, 0.22)';
        pitchCacheCtx.lineWidth = 2;
        for (let gy = 110; gy < h; gy += 110) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(0, gy);
          pitchCacheCtx.lineTo(w, gy);
          pitchCacheCtx.stroke();
        }
        fillPxRect(pitchCacheCtx, w * 0.5 - 48, h * 0.5 - 48, 96, 96, 'rgba(244, 114, 182, 0.22)', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 32, h * 0.5 - 32, 64, 64, 'rgba(34, 211, 238, 0.24)', px);
        pitchCacheCtx.strokeStyle = 'rgba(232, 121, 249, 0.42)';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.strokeRect(w * 0.5 - 68, h * 0.5 - 68, 136, 136);
      } else if (selectedPitchTheme === 'ARCTIC_ICE') {
        // Crystalline Diagonal Ice Sheen Streaks & 8-Point Snowflake Center Crystal
        pitchCacheCtx.fillStyle = 'rgba(255, 255, 255, 0.26)';
        for (let d = -h; d < w; d += 220) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(d, 0);
          pitchCacheCtx.lineTo(d + 55, 0);
          pitchCacheCtx.lineTo(d + h + 55, h);
          pitchCacheCtx.lineTo(d + h, h);
          pitchCacheCtx.closePath();
          pitchCacheCtx.fill();
        }
        pitchCacheCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        pitchCacheCtx.lineWidth = 4;
        for (let a = 0; a < 4; a++) {
          const ang = (a * Math.PI) / 4;
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(w * 0.5 - Math.cos(ang) * 68, h * 0.5 - Math.sin(ang) * 68);
          pitchCacheCtx.lineTo(w * 0.5 + Math.cos(ang) * 68, h * 0.5 + Math.sin(ang) * 68);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 42, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
      } else if (selectedPitchTheme === 'VOLCANO_FORGE') {
        // Obsidian Basalt Geometric Tiles & Molten Forge Gear-Rune Center Ring
        pitchCacheCtx.strokeStyle = 'rgba(249, 115, 22, 0.22)';
        pitchCacheCtx.lineWidth = 2;
        for (let gy = 140; gy < h; gy += 140) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(0, gy);
          pitchCacheCtx.lineTo(w, gy);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(239, 68, 68, 0.48)';
        pitchCacheCtx.lineWidth = 6;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, h * 0.5, 68, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        fillPxRect(pitchCacheCtx, w * 0.5 - 28, h * 0.5 - 28, 56, 56, 'rgba(249, 115, 22, 0.3)', px);
        for (let g = 0; g < 8; g++) {
          const ang = (g * Math.PI) / 4;
          fillPxRect(
            pitchCacheCtx,
            w * 0.5 + Math.cos(ang) * 68 - 6,
            h * 0.5 + Math.sin(ang) * 68 - 6,
            12,
            12,
            'rgba(253, 224, 71, 0.5)',
            px
          );
        }
      }

      // Hand-crafted pixel grass/surface tufts scattered across the turf
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

      fillPxRect(pitchCacheCtx, w / 2 - lineW * 0.5, 0, lineW, h, lineCol, px);

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
      fillPxRect(pitchCacheCtx, w / 2 - 8, h / 2 - 8, 16, 16, lineCol, px);

      fillPxRect(pitchCacheCtx, 0, boxTop, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, 0, boxTop + PITCH.boxHeight - lineW, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, PITCH.boxWidth - lineW, boxTop, lineW, PITCH.boxHeight, lineCol, px);

      fillPxRect(pitchCacheCtx, w - PITCH.boxWidth, boxTop, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, w - PITCH.boxWidth, boxTop + PITCH.boxHeight - lineW, PITCH.boxWidth, lineW, lineCol, px);
      fillPxRect(pitchCacheCtx, w - PITCH.boxWidth, boxTop, lineW, PITCH.boxHeight, lineCol, px);

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
      prop?: 'SCARF' | 'FLAG' | 'NONE';
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
    const isForcedTouchParam =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('touch') === '1';

    function isCoarseTouchHardware(): boolean {
      return (
        isForcedTouchParam ||
        (typeof window.matchMedia === 'function' &&
          window.matchMedia('(pointer: coarse) and (hover: none)').matches)
      );
    }

    let hasDetectedTouchInput = isCoarseTouchHardware();

    function isMobileOrTabletViewport(): boolean {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return w < h || hasDetectedTouchInput || (isCoarseTouchHardware() && w <= 1366) || (w <= 1024 && h <= 600);
    }

    let landscapeLockDismissed = false;

    function tryLockDeviceToLandscape() {
      // Portrait & Landscape are both natively supported and optimized on mobile; do not force orientation lock
    }

    function syncLandscapeLockOverlay() {
      const lockOverlay = document.getElementById('landscapeLockOverlay');
      if (!lockOverlay) return;
      // Portrait mode is now fully supported with dedicated mobile framing & controls; keep lock overlay hidden
      lockOverlay.classList.add('hidden');
      lockOverlay.classList.remove('flex');
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

      const w = window.innerWidth;
      const h = window.innerHeight;
      const isPhoneViewport = (w < h && w <= 640) || (w > h && h <= 540);
      if (hasDetectedTouchInput || isPhoneViewport) return true;
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
      syncLandscapeLockOverlay();
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
    let tournamentRound = 0; // 0 = Quarter-Final (Game 1), 1 = Semi-Final (Game 2), 2 = Grand Final (Game 3)

    // User Profile State (Name + Preset Icon or Camera Photo + Ranked Progression + Balance & Pokie Jackpot)
    interface UserProfile {
      name: string;
      iconType: 'preset' | 'photo';
      presetIcon: string;
      photoDataUrl: string | null;
      rankedWins: number;
      rankedMatches: number;
      hasEditedProfile: boolean;
      balance: number;
      jackpotPool: number;
      machineJackpots: Record<PokieMachineId, number>;
    }

    const PRESET_ICONS: { id: string; label: string; html: string }[] = [
      { id: '#10', label: '#10 Playmaker', html: '<span class="font-mono-num font-black text-xs">#10</span>' },
      { id: 'STAR', label: 'All-Star', html: '<i class="fa-solid fa-star text-amber-300 text-sm"></i>' },
      { id: 'BOLT', label: 'Speedster', html: '<i class="fa-solid fa-bolt text-sky-200 text-sm"></i>' },
      { id: 'CROWN', label: 'King of the Cage', html: '<i class="fa-solid fa-crown text-amber-300 text-sm"></i>' },
      { id: 'FIRE', label: 'Super Flow', html: '<i class="fa-solid fa-fire-flame-curved text-orange-300 text-sm"></i>' },
      { id: 'TROPHY', label: 'Champion', html: '<i class="fa-solid fa-trophy text-amber-300 text-sm"></i>' },
    ];

    let selectedPokieMachine: PokieMachineId = 'CHAMPIONS_GOLD';
    let selectedPokieBet: PokieBetAmount = 10;

    let userProfile: UserProfile = {
      name: 'Player',
      iconType: 'preset',
      presetIcon: '#10',
      photoDataUrl: null,
      rankedWins: 0,
      rankedMatches: 0,
      hasEditedProfile: false,
      balance: INITIAL_PLAYER_BALANCE,
      jackpotPool: BASE_JACKPOT_POOL,
      machineJackpots: {
        CHAMPIONS_GOLD: POKIE_MACHINES.CHAMPIONS_GOLD.baseJackpot10,
        COSMIC_NEON: POKIE_MACHINES.COSMIC_NEON.baseJackpot10,
        VOLCANO_INFERNO: POKIE_MACHINES.VOLCANO_INFERNO.baseJackpot10,
      },
    };

    try {
      const saved = localStorage.getItem('rematch_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string') {
          const parsedMj = parsed.machineJackpots || {};
          userProfile = {
            name: parsed.name.trim().slice(0, 16) || 'Player',
            iconType: parsed.iconType === 'photo' && parsed.photoDataUrl ? 'photo' : 'preset',
            presetIcon: parsed.presetIcon || '#10',
            photoDataUrl: parsed.photoDataUrl || null,
            rankedWins: typeof parsed.rankedWins === 'number' && parsed.rankedWins >= 0 ? Math.floor(parsed.rankedWins) : 0,
            rankedMatches: typeof parsed.rankedMatches === 'number' && parsed.rankedMatches >= 0 ? Math.floor(parsed.rankedMatches) : 0,
            hasEditedProfile: Boolean(parsed.hasEditedProfile),
            balance:
              typeof parsed.balance === 'number' && Number.isFinite(parsed.balance) && parsed.balance >= 0
                ? Math.floor(parsed.balance)
                : INITIAL_PLAYER_BALANCE,
            jackpotPool:
              typeof parsed.jackpotPool === 'number' && Number.isFinite(parsed.jackpotPool) && parsed.jackpotPool >= BASE_JACKPOT_POOL
                ? Math.floor(parsed.jackpotPool)
                : BASE_JACKPOT_POOL,
            machineJackpots: {
              CHAMPIONS_GOLD:
                typeof parsedMj.CHAMPIONS_GOLD === 'number' && parsedMj.CHAMPIONS_GOLD >= POKIE_MACHINES.CHAMPIONS_GOLD.baseJackpot10
                  ? Math.floor(parsedMj.CHAMPIONS_GOLD)
                  : POKIE_MACHINES.CHAMPIONS_GOLD.baseJackpot10,
              COSMIC_NEON:
                typeof parsedMj.COSMIC_NEON === 'number' && parsedMj.COSMIC_NEON >= POKIE_MACHINES.COSMIC_NEON.baseJackpot10
                  ? Math.floor(parsedMj.COSMIC_NEON)
                  : POKIE_MACHINES.COSMIC_NEON.baseJackpot10,
              VOLCANO_INFERNO:
                typeof parsedMj.VOLCANO_INFERNO === 'number' && parsedMj.VOLCANO_INFERNO >= POKIE_MACHINES.VOLCANO_INFERNO.baseJackpot10
                  ? Math.floor(parsedMj.VOLCANO_INFERNO)
                  : POKIE_MACHINES.VOLCANO_INFERNO.baseJackpot10,
            },
          };
        }
      }
    } catch {
      // Ignore storage access errors
    }

    function saveUserProfileToStorage() {
      try {
        window.localStorage.setItem('rematch_profile_v1', JSON.stringify(userProfile));
      } catch {
        // Ignore storage access errors
      }
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
      RANKED_BRONZE: {
        cpuSpeed: 3.35,
        cpuDribble: 1.82,
        standOff: 195,
        tackleChance: 0.022,
        decisionDelay: 25,
        keeperSpeed: 1.86,
        passCreativity: 0.80,
        interceptScale: 0.94,
        rankLabel: 'Bronze II',
        userRankLabel: 'Bronze II',
      },
      RANKED_SILVER: {
        cpuSpeed: 3.65,
        cpuDribble: 2.02,
        standOff: 170,
        tackleChance: 0.030,
        decisionDelay: 19,
        keeperSpeed: 1.98,
        passCreativity: 0.85,
        interceptScale: 1.0,
        rankLabel: 'Silver I',
        userRankLabel: 'Silver I',
      },
      RANKED_GOLD: {
        cpuSpeed: 3.95,
        cpuDribble: 2.22,
        standOff: 148,
        tackleChance: 0.038,
        decisionDelay: 15,
        keeperSpeed: 2.10,
        passCreativity: 0.90,
        interceptScale: 1.06,
        rankLabel: 'Gold II',
        userRankLabel: 'Gold II',
      },
      RANKED_PLATINUM: {
        cpuSpeed: 4.22,
        cpuDribble: 2.40,
        standOff: 128,
        tackleChance: 0.046,
        decisionDelay: 12,
        keeperSpeed: 2.24,
        passCreativity: 0.93,
        interceptScale: 1.12,
        rankLabel: 'Platinum I',
        userRankLabel: 'Platinum I',
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
        userRankLabel: 'Bronze II',
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
        userRankLabel: 'Bronze II',
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
        userRankLabel: 'Bronze II',
      },
    };

    function getActiveDifficultyPreset() {
      const rankInfo = getUserRankInfo(userProfile.rankedWins);
      if (currentGameMode === 'CASUAL') return MODE_PRESETS.CASUAL;
      if (currentGameMode === 'RANKED') {
        const base =
          rankInfo.tierGroup === 'BRONZE'
            ? MODE_PRESETS.RANKED_BRONZE
            : rankInfo.tierGroup === 'SILVER'
              ? MODE_PRESETS.RANKED_SILVER
              : rankInfo.tierGroup === 'GOLD'
                ? MODE_PRESETS.RANKED_GOLD
                : rankInfo.tierGroup === 'PLATINUM'
                  ? MODE_PRESETS.RANKED_PLATINUM
                  : MODE_PRESETS.RANKED;
        return {
          ...base,
          rankLabel: rankInfo.name,
          userRankLabel: rankInfo.name,
        };
      }
      const roundPreset =
        tournamentRound === 0
          ? MODE_PRESETS.TOURNAMENT_QF
          : tournamentRound === 1
            ? MODE_PRESETS.TOURNAMENT_SF
            : MODE_PRESETS.TOURNAMENT_GF;
      return {
        ...roundPreset,
        userRankLabel: rankInfo.name,
      };
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

    const RANKS = ['Bronze II', 'Silver I', 'Gold II', 'Platinum I', 'Diamond I', 'Star League'];
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

    function applyRankOutlineStyle(el: HTMLElement | null) {
      if (!el) return;
      const rankInfo = getUserRankInfo(userProfile.rankedWins);
      el.style.borderColor = rankInfo.borderHex;
      el.style.boxShadow = `0 3px 0 ${rankInfo.shadowHex}, 0 0 0 1.5px ${rankInfo.borderHex}`;
    }

    function syncProfileUI() {
      // Ensure balance and jackpotPool are always valid integers
      userProfile.balance =
        typeof userProfile.balance === 'number' && Number.isFinite(userProfile.balance) && userProfile.balance >= 0
          ? Math.floor(userProfile.balance)
          : INITIAL_PLAYER_BALANCE;
      userProfile.jackpotPool =
        typeof userProfile.jackpotPool === 'number' &&
        Number.isFinite(userProfile.jackpotPool) &&
        userProfile.jackpotPool >= BASE_JACKPOT_POOL
          ? Math.floor(userProfile.jackpotPool)
          : BASE_JACKPOT_POOL;

      const youIsHome = userKitChoice === 'HOME';
      const rankInfo = getUserRankInfo(userProfile.rankedWins);

      const menuNameEl = document.getElementById('menuProfileNameText');
      const menuRankBadgeEl = document.getElementById('menuProfileRankBadge');
      const menuAvatarBox = document.getElementById('menuProfileAvatarBox');
      const menuProfileCardBtn = document.getElementById('editProfileBtn');
      const profileFirstBootPrompt = document.getElementById('profileFirstBootPrompt');
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
      if (menuRankBadgeEl) {
        menuRankBadgeEl.innerText = rankInfo.name;
        menuRankBadgeEl.style.color = rankInfo.badgeTextHex;
        menuRankBadgeEl.style.backgroundColor = rankInfo.badgeBgHex;
        menuRankBadgeEl.style.borderColor = rankInfo.borderHex;
      }
      if (menuAvatarBox) {
        menuAvatarBox.style.borderColor = rankInfo.borderHex;
      }
      if (menuProfileCardBtn) {
        menuProfileCardBtn.style.borderColor = rankInfo.borderHex;
        menuProfileCardBtn.style.boxShadow = `0 3px 0 #0f172a, 0 0 0 1.5px ${rankInfo.borderHex}`;
      }
      if (profileFirstBootPrompt) {
        profileFirstBootPrompt.classList.toggle('hidden', userProfile.hasEditedProfile);
      }

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
          ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-400 border-[3px] text-slate-900 font-black text-xs flex flex-col items-center justify-center mb-2 relative overflow-hidden transition-colors shrink-0'
          : 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-400 border-[3px] text-white font-black text-xs flex flex-col items-center justify-center mb-2 relative overflow-hidden transition-colors shrink-0';
        applyRankOutlineStyle(mmYouAvatar);
        mmYouAvatar.innerHTML = getProfileAvatarInnerHtml(userProfile, youIsHome);
      }
      if (mmYouTitle) {
        mmYouTitle.innerText = userProfile.name;
      }

      // Sync Profile Overview Modal elements
      const ovAvatarBox = document.getElementById('overviewAvatarBox');
      const ovAvatarImg = document.getElementById('overviewProfileImg') as HTMLImageElement | null;
      const ovAvatarInitials = document.getElementById('overviewProfileInitials');
      const ovName = document.getElementById('overviewProfileName');
      const ovRankBadge = document.getElementById('overviewRankBadge');
      const ovBalanceBadge = document.getElementById('overviewBalanceBadge');
      const menuBalanceTextEl = document.getElementById('menuBalanceText');
      const ovWinsText = document.getElementById('overviewRankedWinsText');
      const ovNextRankText = document.getElementById('overviewNextRankText');
      const ovProgressBar = document.getElementById('overviewRankProgressBar');
      const slotBalEl = document.getElementById('slotBalanceDisplay');
      const slotJackpotEl = document.getElementById('slotJackpotDisplay');
      const slotSpinsLeftEl = document.getElementById('slotSpinsLeftDisplay');

      if (!userProfile.machineJackpots) {
        userProfile.machineJackpots = {
          CHAMPIONS_GOLD: POKIE_MACHINES.CHAMPIONS_GOLD.baseJackpot10,
          COSMIC_NEON: POKIE_MACHINES.COSMIC_NEON.baseJackpot10,
          VOLCANO_INFERNO: POKIE_MACHINES.VOLCANO_INFERNO.baseJackpot10,
        };
      }

      if (ovAvatarBox) {
        applyRankOutlineStyle(ovAvatarBox);
      }
      if (ovAvatarImg && ovAvatarInitials) {
        if (userProfile.iconType === 'photo' && userProfile.photoDataUrl) {
          ovAvatarImg.src = userProfile.photoDataUrl;
          ovAvatarImg.classList.remove('hidden');
          ovAvatarInitials.classList.add('hidden');
        } else {
          ovAvatarImg.classList.add('hidden');
          ovAvatarInitials.classList.remove('hidden');
          ovAvatarInitials.innerText = initials;
        }
      }
      if (ovName) ovName.innerText = userProfile.name;
      if (ovRankBadge) {
        ovRankBadge.innerText = rankInfo.name;
        ovRankBadge.style.backgroundColor = rankInfo.badgeBgHex;
        ovRankBadge.style.color = rankInfo.badgeTextHex;
        ovRankBadge.style.borderColor = rankInfo.borderHex;
      }
      if (menuBalanceTextEl) {
        menuBalanceTextEl.innerText = `$${userProfile.balance.toLocaleString()}`;
      }
      if (ovBalanceBadge) {
        ovBalanceBadge.innerText = `$${userProfile.balance.toLocaleString()}`;
      }
      if (slotBalEl) {
        slotBalEl.innerText = `$${userProfile.balance.toLocaleString()}`;
      }

      const activeEffectiveJackpot = getMachineEffectiveJackpot(
        selectedPokieMachine,
        selectedPokieBet,
        userProfile.machineJackpots[selectedPokieMachine]
      );
      userProfile.jackpotPool = activeEffectiveJackpot;

      if (slotJackpotEl) {
        slotJackpotEl.innerText = `$${activeEffectiveJackpot.toLocaleString()}`;
      }
      for (const m of POKIE_MACHINE_LIST) {
        const mJpEl = document.getElementById(`slotMachineJackpot_${m.id}`);
        if (mJpEl) {
          const eff = getMachineEffectiveJackpot(m.id, selectedPokieBet, userProfile.machineJackpots[m.id]);
          mJpEl.innerText = `$${eff.toLocaleString()}`;
        }
      }
      if (slotSpinsLeftEl) {
        const spinsAvailable = Math.floor(userProfile.balance / selectedPokieBet);
        slotSpinsLeftEl.innerText = `${spinsAvailable} ${spinsAvailable === 1 ? 'SPIN' : 'SPINS'} READY`;
      }
      if (ovWinsText) {
        ovWinsText.innerText = `${userProfile.rankedWins} ${userProfile.rankedWins === 1 ? 'Win' : 'Wins'}`;
      }
      const progressSummary = computeRankProgressSummary(userProfile.rankedWins);
      if (ovNextRankText) {
        ovNextRankText.innerText = progressSummary.subtext;
      }
      if (ovProgressBar) {
        ovProgressBar.style.width = `${progressSummary.progressPct}%`;
      }
    }

    function syncUserProfileUI() {
      syncProfileUI();
    }

    function syncKitAndModeUI() {
      const cpuKit = getContrastingKit(userKitChoice);
      const youIsHome = userKitChoice === 'HOME';
      const rankInfo = getUserRankInfo(userProfile.rankedWins);

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

      // 2. Update Player Card in Home Menu (Rank shown on BOTH Ranked & Tournament; hidden on Casual)
      syncProfileUI();
      const mmYouPill = document.getElementById('mmYouPill');
      const mmYouDot = document.getElementById('mmYouDot');
      const mmYouMeta = document.getElementById('mmYouMeta');

      if (mmYouPill) {
        if (currentGameMode === 'CASUAL') {
          mmYouPill.className = youIsHome
            ? 'inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-[11px] font-extrabold text-sky-800'
            : 'inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-[11px] font-extrabold text-rose-800';
          mmYouPill.style.backgroundColor = '';
          mmYouPill.style.color = '';
          mmYouPill.style.borderColor = '';
        } else {
          mmYouPill.className =
            'inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full border text-[11px] font-black';
          mmYouPill.style.backgroundColor = rankInfo.badgeBgHex;
          mmYouPill.style.color = rankInfo.badgeTextHex;
          mmYouPill.style.borderColor = rankInfo.borderHex;
        }
      }
      if (mmYouDot) {
        if (currentGameMode === 'CASUAL') {
          mmYouDot.className = youIsHome ? 'w-2 h-2 rounded-full bg-sky-500' : 'w-2 h-2 rounded-full bg-rose-500';
          mmYouDot.style.backgroundColor = '';
        } else {
          mmYouDot.className = 'w-2 h-2 rounded-full';
          mmYouDot.style.backgroundColor = rankInfo.borderHex;
        }
      }
      if (mmYouMeta) {
        mmYouMeta.innerText =
          currentGameMode === 'CASUAL'
            ? youIsHome
              ? 'Home Kit (Sky)'
              : 'Away Kit (Coral)'
            : rankInfo.name;
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

      // 4. Update Tournament HUD Badge & Ensure Bracket Initialized
      const hudTourneyBadge = document.getElementById('hudTourneyBadge');
      if (currentGameMode === 'TOURNAMENT') {
        if (!tournamentBracket.initialized) {
          initTournamentBracket();
        }
        if (hudTourneyBadge) {
          hudTourneyBadge.classList.remove('hidden');
          hudTourneyBadge.classList.add('inline-flex');
          hudTourneyBadge.innerText = `CUP ${tournamentRound + 1}/${TOTAL_TOURNAMENT_GAMES} · ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} · ${rankInfo.name.toUpperCase()}`;
        }
      } else {
        if (hudTourneyBadge) {
          hudTourneyBadge.classList.add('hidden');
          hudTourneyBadge.classList.remove('inline-flex');
        }
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

      if (card) card.className = 'sm:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
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
      const openSlotBtnEl = document.getElementById('openSlotMachineBtn');
      if (openSlotBtnEl) {
        openSlotBtnEl.classList.toggle('hidden', gameState !== 'MENU');
      }
      if (startBtnEl) {
        startBtnEl.classList.remove('hidden');
        startBtnEl.removeAttribute('disabled');
        startBtnEl.className =
          'indie-cta-btn w-full sm:w-auto sm:min-w-[240px] sm:max-w-[320px] min-h-[46px] sm:min-h-[50px] py-3 sm:py-3.5 px-7 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm sm:text-base tracking-wide cursor-pointer flex items-center justify-center space-x-2.5 mx-auto';
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
    let stadiumFlashColor = '#ffffff';
    let lastGoalWorldX = PITCH.width;
    let lastGoalWorldY = PITCH.height * 0.5;
    let dribbleSoundTimer = 0;

    let ledBannerMessage = 'REMATCH 0.2 • 3 PASSES = SUPER FLOW';
    let ledBannerTimer = 0;

    interface RippleVfx { x: number; y: number; r: number; maxR: number; alpha: number; color: string; }
    interface ParticleVfx { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string; }
    interface FloatingTextVfx { x: number; y: number; text: string; color: string; vy: number; alpha: number; scale: number; }
    interface WallGlowVfx { x1: number; y1: number; x2: number; y2: number; alpha: number; }
    interface TurfScuffVfx { x: number; y: number; angle: number; alpha: number; color: string; }
    interface AfterimageVfx { x: number; y: number; radius: number; team: 'YOU' | 'AI'; alpha: number; }
    interface ConfettiVfx {
      x: number;
      y: number;
      vx: number;
      vy: number;
      w: number;
      h: number;
      rot: number;
      vRot: number;
      alpha: number;
      color: string;
      shape?: 'RECT' | 'PETAL' | 'LEAF' | 'STAR' | 'CRYSTAL' | 'EMBER' | 'SPARK';
    }

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
        const pickProp = (idx: number): 'SCARF' | 'FLAG' | 'NONE' =>
          idx % 7 === 0 ? 'FLAG' : idx % 4 === 0 ? 'SCARF' : 'NONE';
        let fanIdx = 0;

        // Inner & Upper-Deck Top/Bottom Grandstand Supporters (4 Tiers on Lower & Upper Bleachers inside the ±162px Stadium Bowl)
        const topRows = [-58, -76, -112, -130];
        const botRows = [PITCH.height + 58, PITCH.height + 76, PITCH.height + 112, PITCH.height + 130];
        for (let row = 0; row < topRows.length; row++) {
          const topY = topRows[row];
          const botY = botRows[row];
          const stepX = row < 2 ? 42 : 46;
          for (let x = 95; x <= PITCH.width - 95; x += stepX) {
            if (row === 0 && x > PITCH.width * 0.21 && x < PITCH.width * 0.79) continue;
            if (row >= 2 && Math.abs(x - PITCH.width * 0.5) < 96) continue;
            const isHomeSide = x < PITCH.width * 0.5;
            const palette = isHomeSide ? homeColors : awayColors;
            fanIdx++;
            crowdFans.push({
              x: x + (Math.random() - 0.5) * 10,
              baseY: topY,
              color: palette[Math.floor(Math.random() * palette.length)],
              phase: Math.random() * Math.PI * 2,
              isHome: isHomeSide,
              prop: pickProp(fanIdx),
            });
            fanIdx++;
            crowdFans.push({
              x: x + (Math.random() - 0.5) * 10,
              baseY: botY,
              color: palette[Math.floor(Math.random() * palette.length)],
              phase: Math.random() * Math.PI * 2,
              isHome: isHomeSide,
              prop: pickProp(fanIdx),
            });
          }
        }
        // Left & Right End-Zone Supporter Terrace Crowd (Lower + Upper Decks cleanly above & below goal mouths)
        const goalTopY = (PITCH.height - PITCH.goalWidth) * 0.5;
        const goalBotY = (PITCH.height + PITCH.goalWidth) * 0.5;
        const leftCols = [-66, -83, -116, -133];
        const rightCols = [PITCH.width + 66, PITCH.width + 83, PITCH.width + 116, PITCH.width + 133];
        for (let col = 0; col < leftCols.length; col++) {
          const leftX = leftCols[col];
          const rightX = rightCols[col];
          for (let y = 90; y <= PITCH.height - 90; y += 44) {
            if (y > goalTopY - 48 && y < goalBotY + 48) continue;
            fanIdx++;
            crowdFans.push({
              x: leftX + (Math.random() - 0.5) * 6,
              baseY: y,
              color: homeColors[Math.floor(Math.random() * homeColors.length)],
              phase: Math.random() * Math.PI * 2,
              isHome: true,
              prop: pickProp(fanIdx),
            });
            fanIdx++;
            crowdFans.push({
              x: rightX + (Math.random() - 0.5) * 6,
              baseY: y,
              color: awayColors[Math.floor(Math.random() * awayColors.length)],
              phase: Math.random() * Math.PI * 2,
              isHome: false,
              prop: pickProp(fanIdx),
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
          if (side === 0) { fx = -340 + Math.random() * 145; fy = -200 + Math.random() * (PITCH.height + 400); }
          else if (side === 1) { fx = PITCH.width + 195 + Math.random() * 145; fy = -200 + Math.random() * (PITCH.height + 400); }
          else if (side === 2) { fx = Math.random() * PITCH.width; fy = -310 + Math.random() * 115; }
          else { fx = Math.random() * PITCH.width; fy = PITCH.height + 195 + Math.random() * 115; }
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
      kickOriginX: PITCH.width / 2,
      kickOriginY: PITCH.height / 2,
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
    let activeControlScheme: ControlScheme = hasDetectedTouchInput ? 'JOYSTICK' : 'MOUSE';
    let activeControlGuideTab: ControlGuideTab = hasDetectedTouchInput ? 'MOBILE' : 'COMPUTER';
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
      const vv = window.visualViewport;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(vv ? vv.width : rect.width || window.innerWidth);
      const h = Math.round(vv ? vv.height : rect.height || window.innerHeight);
      canvas.width = w;
      canvas.height = h;
      const isMobileOrTablet = isMobileOrTabletViewport();

      if (isMobileOrTablet) {
        const isPortraitPhone = w < h;
        const isCompactPhoneLandscape = h <= 550 && w > h;
        if (isPortraitPhone) {
          // Portrait Mobile Optimization: closer dynamic zoom & upward pitch offset for bottom thumbstick/buttons, while revealing rich top & bottom stadium grandstands and outer fan plazas
          canvasOffsetY = -18;
          const fitScaleX = w / (PITCH.width + 80);
          const fitScaleY = h / (PITCH.height + 360);
          const fitScale = Math.min(fitScaleX, fitScaleY);
          viewScale = Math.max(0.28, fitScale * 1.48);
        } else {
          // Landscape Mobile & Tablet Arena Framing: comfortable zoom so players and ball are crisp and close
          canvasOffsetY = isCompactPhoneLandscape ? 10 : 14;
          const padX = isCompactPhoneLandscape ? 24 : 48;
          const padY = isCompactPhoneLandscape ? 42 : 76;
          const scaleX = Math.max(240, w - padX) / (PITCH.width + 64);
          const scaleY = Math.max(180, h - padY) / (PITCH.height + 64);
          const fitScale = Math.min(scaleX, scaleY);
          viewScale = isCompactPhoneLandscape ? fitScale * 1.24 : fitScale * 1.06;
        }
      } else {
        // Normal PC widescreen viewing mode: balanced framing so stadium bleachers, floodlights, trees & cosmic space art are visible around the cage
        canvasOffsetY = 8;
        const padX = 185;
        const padY = 175;
        const scaleX = (w - padX) / PITCH.width;
        const scaleY = (h - padY) / PITCH.height;
        viewScale = Math.max(0.18, Math.min(scaleX, scaleY));
      }
      syncBodyStateAttr(gameState);
      syncLandscapeLockOverlay();
      updateMouseWorldCoords();
    }

    window.addEventListener('resize', resizeCanvas);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvas);
    }

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
      floatingTexts.push({ x, y, text, color, vy: -1.35, alpha: 1.0, scale: 1.42 });
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
      const stadiumFx = getStadiumGoalEffect(selectedPitchTheme);
      const kitPalette =
        teamKit === 'HOME'
          ? ['#38bdf8', '#fde047']
          : ['#fb7185', '#fcd34d'];
      const palette = [...stadiumFx.particleColors, ...kitPalette];
      const dirSign = goalX > PITCH.width * 0.5 ? -1 : 1;

      const shapeMap: Record<typeof stadiumFx.effectStyle, ConfettiVfx['shape']> = {
        BOTANICAL_FOUNTAIN: 'RECT',
        MAPLE_SWIRL: 'LEAF',
        SAKURA_PETAL_STORM: 'PETAL',
        CHAMPIONS_PYRO: 'STAR',
        COSMIC_SUPERNOVA: 'STAR',
        STREET_GRAFFITI_BASS: 'SPARK',
        CARNIVAL_STREAMERS: 'RECT',
        SYNTH_LASER_SCAN: 'SPARK',
        ARCTIC_CRYSTAL_BURST: 'CRYSTAL',
        VOLCANO_MAGMA_PLUME: 'EMBER',
      };
      const shape = shapeMap[stadiumFx.effectStyle] || 'RECT';

      // Spawn stadium-signature concentric shockwave ripples at the goal line & center circle
      spawnRipple(goalX, goalY, stadiumFx.shockwaveColors[0], 118);
      spawnRipple(goalX, goalY, stadiumFx.shockwaveColors[1], 168);
      spawnRipple(PITCH.width * 0.5, PITCH.height * 0.5, stadiumFx.shockwaveColors[0], 145);

      for (let i = 0; i < 68; i++) {
        if (confetti.length > 170) confetti.shift();
        const spreadAngle = (Math.random() - 0.5) * 1.48;
        const speed = 3.4 + Math.random() * 9.6;
        const isRisingEmber = shape === 'EMBER';
        confetti.push({
          x: goalX,
          y: goalY + (Math.random() - 0.5) * PITCH.goalWidth * 0.78,
          vx: Math.cos(spreadAngle) * speed * dirSign,
          vy: Math.sin(spreadAngle) * speed - (isRisingEmber ? 2.8 : 1.5),
          w: shape === 'STAR' || shape === 'CRYSTAL' ? 7 + Math.random() * 4 : 6 + Math.random() * 5,
          h: shape === 'PETAL' || shape === 'LEAF' ? 6 + Math.random() * 4 : 4 + Math.random() * 4,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          alpha: 1,
          color: palette[i % palette.length],
          shape,
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
      ball.kickOriginX = actor.x;
      ball.kickOriginY = actor.y;
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
      const openSlotBtnEl = document.getElementById('openSlotMachineBtn');
      if (!modalCard) return;

      if (state === 'SPLASH' || state === 'PLAYING' || state === 'GOAL_CELEBRATION') {
        if (overlay) {
          overlay.classList.add('hidden');
        }
        syncMobileControlsVisibility();
        return;
      }

      const howToPlayWrap = document.getElementById('howToPlayWrap');
      if (state === 'PAUSED' || state === 'MATCH_OVER') {
        if (overlay) {
          overlay.className =
            'absolute inset-0 bg-slate-900/55 flex items-center justify-center z-30 p-2.5 sm:p-5 transition-opacity duration-150 overflow-y-auto';
        }
        modalCard.className =
          state === 'MATCH_OVER'
            ? 'glass-modal rounded-[26px] max-w-xl w-full max-h-[95dvh] overflow-y-auto p-3.5 sm:p-5 text-center relative transition-all duration-200 my-auto'
            : 'glass-modal rounded-[26px] max-w-lg w-full max-h-[94dvh] overflow-y-auto p-4 sm:p-6 text-center relative transition-all duration-200 my-auto';
        if (topBar) {
          topBar.className =
            'flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pb-2.5 mb-2.5 border-b-2 border-slate-200';
        }
        if (mainGrid) {
          mainGrid.className =
            state === 'MATCH_OVER' ? 'hidden' : 'flex flex-col gap-3 text-left mb-3';
        }
        if (leftCol) leftCol.classList.add('hidden');
        if (bottomBar) bottomBar.className = 'flex flex-col items-center space-y-2';
        if (profileBar) profileBar.classList.add('hidden');
        if (editProfileBtn) editProfileBtn.classList.add('hidden');
        if (openSlotBtnEl) openSlotBtnEl.classList.add('hidden');
        if (howToPlayWrap) howToPlayWrap.classList.add('hidden');
        if (howToPlayPanel) howToPlayPanel.classList.add('hidden');
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
            'absolute inset-0 bg-slate-950/25 flex items-center justify-center z-30 p-2.5 sm:p-5 lg:p-8 transition-opacity duration-150 overflow-y-auto';
        }
        modalCard.className =
          'w-full max-w-xl sm:max-w-2xl lg:max-w-4xl flex flex-col gap-2.5 sm:gap-3.5 text-center relative transition-all duration-200 my-auto mx-auto';
        if (topBar) {
          topBar.className =
            'glass-modal rounded-3xl px-4 py-2.5 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2 sm:gap-3';
        }
        if (mainGrid) {
          mainGrid.className = 'grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-stretch text-left';
        }
        if (leftCol) {
          leftCol.className =
            'sm:col-span-7 glass-modal rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3.5';
        }
        if (bottomBar) {
          bottomBar.className = 'glass-modal rounded-3xl p-3.5 sm:p-4 flex flex-col items-center space-y-2';
        }
        const postMatchRankCard = document.getElementById('postMatchRankCard');
        if (postMatchRankCard) postMatchRankCard.classList.add('hidden');
        if (profileBar) profileBar.classList.remove('hidden');
        if (editProfileBtn) editProfileBtn.classList.remove('hidden');
        if (openSlotBtnEl) openSlotBtnEl.classList.remove('hidden');
        if (howToPlayWrap) howToPlayWrap.classList.remove('hidden');
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
          '.mode-btn, .kit-btn, #editProfileBtn, #openSlotMachineBtn, #startBtn, #rematchSameBtn, #mainMenuBtn, #resumeBtn, #forfeitBtn, #howToPlayBtn, .control-tab-btn'
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
        '#splashStartBtn, .mode-btn, .kit-btn, #editProfileBtn, #openSlotMachineBtn, #startBtn, #rematchSameBtn, #mainMenuBtn, #resumeBtn, #forfeitBtn, #howToPlayBtn, .control-tab-btn, #takePhotoBtn, #capturePhotoBtn, #clearPhotoBtn, #saveProfileBtn, #closeProfileModalBtn'
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
        if (!Number.isFinite(k.x) || !Number.isFinite(k.y)) {
          k.x = k.homeX;
          k.y = k.homeY;
        }
        k.patrolPhase = (k.patrolPhase || 0) + dtScale;
        if (k.diveCooldown > 0) k.diveCooldown = Math.max(0, k.diveCooldown - dtScale);
        if (k.saveCooldown > 0) k.saveCooldown = Math.max(0, k.saveCooldown - dtScale);
        k.scaleX += (1 - k.scaleX) * 0.2 * dtScale;
        k.scaleY += (1 - k.scaleY) * 0.2 * dtScale;

        // As your Flow builds, the opponent goalkeeper is more easily wrong-footed by quick passing & shots
        const keeperFlowFactor = !isYou && ball.lastTouchTeam === 'YOU' ? flowBoost.keeperReachScale : 1.0;
        const effectivePatrolSpeed = k.patrolSpeed * keeperFlowFactor;

        if (k.holdingBall) {
          const clampedHold = clampKeeperToBox(k.team, k.x, k.y, k.radius);
          k.x = clampedHold.x;
          k.y = clampedHold.y;
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
              ball.kickOriginX = k.x;
              ball.kickOriginY = k.y;
              ball.vx = (dx / d) * 21.4;
              ball.vy = (dy / d) * 21.4;
              ball.vz = 2.4;
              ball.passTarget = receiver;
              ball.lastTouchTeam = k.team;
              ball.lastTouchPlayer = null;
              ball.passCounted = false;
              if (isYou) {
                controlledPlayer = receiver;
                spawnFloatingText(k.x, k.y - 24, 'KEEPER PASS!', '#06b6d4');
              }
              sound.playPass();
            }
          }
          continue;
        }

        // Check if loose ball is inside the keeper's box with no outfield players nearby -> Keeper walks to ball & passes to team
        const shouldSweepBoxBall =
          k.saveCooldown <= 0 && shouldKeeperSweepLooseBallInBox(k.team, ball, players);

        if (shouldSweepBoxBall) {
          const dxToBall = ball.x - k.x;
          const dyToBall = ball.y - k.y;
          const distToBall = Math.hypot(dxToBall, dyToBall);
          if (distToBall > 2) {
            const sweepSpeed = effectivePatrolSpeed * 1.32;
            k.x += (dxToBall / distToBall) * Math.min(sweepSpeed, distToBall * 0.28) * dtScale;
            k.y += (dyToBall / distToBall) * Math.min(sweepSpeed, distToBall * 0.28) * dtScale;
          }
          const clampedSweep = clampKeeperToBox(k.team, k.x, k.y, k.radius);
          k.x = clampedSweep.x;
          k.y = clampedSweep.y;
          k.angle = Math.atan2(ball.y - k.y, ball.x - k.x);

          if (Math.hypot(ball.x - k.x, ball.y - k.y) <= k.radius + ball.radius + 14) {
            k.holdingBall = true;
            k.holdTimer = 16;
            spawnRipple(k.x, k.y, '#06b6d4', 44);
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
        const clampedBox = clampKeeperToBox(k.team, k.x, k.y, k.radius);
        k.x = clampedBox.x;
        k.y = clampedBox.y;
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

    let activeGoalCelebration: GoalCelebrationSpec = {
      headline: 'GOOOAAAL!',
      subheadline: 'CLINICAL FINISH',
      kickerBadge: '⚽ GOAL SCORED',
      primaryColor: '#fde047',
      secondaryColor: '#38bdf8',
      glowColor: '#f59e0b',
      pitchCallouts: [],
      ledMessage: 'GOOOAAAL!',
    };

    function handleGoalScored(scoringTeam: 'YOU' | 'AI', variationOverride?: number, forceReTrigger = false) {
      if (gameState === 'GOAL_CELEBRATION' && !forceReTrigger) return;
      gameState = 'GOAL_CELEBRATION';
      syncBodyStateAttr(gameState);
      goalScorerTeam = scoringTeam;
      goalBannerTimer = 115;
      screenShake = 18;
      slowMoTimer = 28;
      const stadiumGoalFx = getStadiumGoalEffect(selectedPitchTheme);
      stadiumFlashAlpha = 0.52;
      stadiumFlashColor = stadiumGoalFx.flashTint;
      crowdExcitement = 1.0;
      kickChargeState.active = false;
      kickChargeState.power = 0;

      const goalX = scoringTeam === 'YOU' ? PITCH.width : 0;
      lastGoalWorldX = goalX;
      lastGoalWorldY = ball.y;
      spawnGoalConfetti(goalX, ball.y, scoringTeam);

      const isRonaldoLongShot = isLongRangeGoal(
        scoringTeam,
        ball.kickOriginX,
        ball.kickOriginY
      );

      players.forEach((p) => {
        if (p.team === scoringTeam) {
          p.celebrateTimer = 110;
        }
      });

      const prevScoreYou = scoreYou;
      const prevScoreAi = scoreAi;

      if (scoringTeam === 'YOU') {
        scoreYou++;
        const syEl = document.getElementById('scoreYou');
        if (syEl) syEl.innerText = String(scoreYou);
      } else {
        scoreAi++;
        const saEl = document.getElementById('scoreAi');
        if (saEl) saEl.innerText = String(scoreAi);
      }

      const celebrationSpec = buildGoalCelebrationMessage({
        scoringTeam,
        scoreYou,
        scoreAi,
        prevScoreYou,
        prevScoreAi,
        isLongRange: isRonaldoLongShot,
        isPerfectStrike: Boolean(ball.isPerfectStrike),
        isOneTouch: Boolean(ball.isOneTouch),
        wasWallBounce: Boolean(ball.wasWallBounce),
        spinMagnitude: Math.abs(ball.spin),
        flowCombo,
        isGoldenGoal,
        matchTimeRemaining: matchTime,
        opponentTag: currentOpponent.tag,
        playerName: userProfile.name,
        pitchTheme: selectedPitchTheme,
        variationIndex: variationOverride,
      });

      activeGoalCelebration = celebrationSpec;
      goalBannerText = celebrationSpec.headline;
      goalBannerSub = celebrationSpec.subheadline;
      setLedBanner(celebrationSpec.ledMessage, 240);

      // Spawn expressive unboxed 3D arcade callouts directly over the pitch
      const calloutBaseX = scoringTeam === 'YOU' ? Math.min(PITCH.width - 140, ball.x - 70) : Math.max(140, ball.x + 70);
      celebrationSpec.pitchCallouts.forEach((callout, idx) => {
        spawnFloatingText(
          calloutBaseX + (idx % 2 === 0 ? -18 : 18),
          ball.y - 36 - idx * 32,
          callout.text,
          callout.color
        );
      });

      if (scoringTeam === 'YOU') {
        const oppPlayer = players.find((p) => p.team === 'AI');
        if (oppPlayer && Math.random() < 0.72) {
          const chat = isRonaldoLongShot
            ? 'What a screamer!!'
            : ['Nice shot!', 'What a finish!', 'Unlucky!', 'GG!'][Math.floor(Math.random() * 4)];
          spawnFloatingText(oppPlayer.x, oppPlayer.y - 28, `${currentOpponent.tag}: "${chat}"`, '#fda4af');
        }
      } else if (ball.lastTouchPlayer && ball.lastTouchPlayer.team === 'AI') {
        const chat = ["Let's gooo!", 'Calculated!', 'GG!', 'Nice pass!'][Math.floor(Math.random() * 4)];
        spawnFloatingText(ball.lastTouchPlayer.x, ball.lastTouchPlayer.y - 30, `${currentOpponent.tag}: "${chat}"`, '#fef08a');
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

      // 1. Blit pre-rendered static 16-bit pixel stadium complex, trees, concourse, floodlight towers, bleachers, turf & chalk lines in a single call
      ctx.drawImage(pitchCacheCanvas, -CACHE_PAD_X, -CACHE_PAD_Y);

      if (selectedPitchTheme === 'COSMIC_SPACE') {
        // 2A. Live Twinkling 4-Point Stars, Streaking Shooting Comets, Drifting Asteroids & Cruising 16-Bit Alien UFOs (Strictly in Outer Space Surround >= ±195px)
        ctx.save();
        const twinklePalette = ['#ffffff', '#fef08a', '#38bdf8', '#e879f9', '#a7f3d0'];
        for (let i = 0; i < 42; i++) {
          const side = i % 4;
          let sx = 0;
          let sy = 0;
          if (side === 0) {
            sx = -220 + ((i * 239) % (w + 440));
            sy = -195 - ((i * 53) % 145);
          } else if (side === 1) {
            sx = -220 + ((i * 251) % (w + 440));
            sy = h + 195 + ((i * 59) % 145);
          } else if (side === 2) {
            sx = -205 - ((i * 47) % 165);
            sy = -120 + ((i * 199) % (h + 240));
          } else {
            sx = w + 205 + ((i * 61) % 165);
            sy = -120 + ((i * 211) % (h + 240));
          }
          const pulse = 0.5 + 0.5 * Math.sin(matchTick * 0.11 + i * 1.73);
          ctx.globalAlpha = 0.35 + pulse * 0.65;
          const col = twinklePalette[i % twinklePalette.length];
          ctx.fillStyle = col;
          if (pulse > 0.72) {
            ctx.fillRect(Math.round(sx - 6), Math.round(sy - 1), 12, 3);
            ctx.fillRect(Math.round(sx - 1), Math.round(sy - 6), 3, 12);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 4, 4);
          } else {
            ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 4, 4);
          }
        }
        ctx.globalAlpha = 1;

        // Streaking Shooting Comets across top & bottom outer space
        for (let cIdx = 0; cIdx < 2; cIdx++) {
          const cometProg = ((matchTick * 6.5 + cIdx * 700) % (w + 600)) - 300;
          const cometY = cIdx === 0 ? -245 : h + 245;
          const dir = cIdx === 0 ? 1 : -1;
          const cx = cIdx === 0 ? cometProg : w - cometProg;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.fillRect(Math.round(cx - dir * 48), cometY - 2, 48, 4);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(Math.round(cx - 4), cometY - 4, 8, 8);
        }

        // Drifting 16-bit Pixel Asteroids in Left & Right Outer Space
        for (let a = 0; a < 6; a++) {
          const ax = a < 3 ? -235 + Math.sin(matchTick * 0.02 + a) * 16 : w + 235 + Math.cos(matchTick * 0.02 + a) * 16;
          const ay = 140 + (a % 3) * 290 + Math.cos(matchTick * 0.03 + a * 2) * 18;
          fillPxRect(ctx, ax - 11, ay - 11, 22, 22, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, ax - 8, ay - 8, 16, 16, '#64748b', px);
          fillPxRect(ctx, ax - 5, ay - 5, 8, 8, '#94a3b8', px);
        }

        const ufo1X = w * 0.5 + Math.cos(matchTick * 0.012) * (w * 0.36);
        const ufo1Y = -225 + Math.sin(matchTick * 0.045) * 14;
        drawPixelUfo(ctx, ufo1X, ufo1Y, matchTick, px);

        const ufo2X = w * 0.5 - Math.cos(matchTick * 0.01 + 1.8) * (w * 0.34);
        const ufo2Y = h + 225 + Math.cos(matchTick * 0.04) * 14;
        drawPixelUfo(ctx, ufo2X, ufo2Y, matchTick + 25, px);
        ctx.restore();
      } else if (selectedPitchTheme === 'URBAN_CONCRETE') {
        // 2B. Live Cruising 16-Bit Cars on Outer Asphalt Avenues, Bouncing Streetballs & Boombox Beats
        ctx.save();
        const car1X = ((matchTick * 3.2) % (w + 560)) - 280;
        drawStreetCar(ctx, car1X, -260, 1, '#facc15', px, false, matchTick);
        const car2X = w + 280 - (((matchTick * 2.9 + 420) % (w + 560)));
        drawStreetCar(ctx, car2X, -230, -1, '#1e293b', px, true, matchTick);

        const car3X = w + 280 - (((matchTick * 3.0 + 180) % (w + 560)));
        drawStreetCar(ctx, car3X, h + 230, -1, '#f43f5e', px, false, matchTick);
        const car4X = ((matchTick * 2.5 + 640) % (w + 560)) - 280;
        drawStreetCar(ctx, car4X, h + 260, 1, '#38bdf8', px, false, matchTick);

        // Animated Bouncing Basketballs on Left & Right Outer Streetball Half-Courts + Boombox Soundwaves
        for (const sideX of [-256, w + 256]) {
          const hop = Math.abs(Math.sin(matchTick * 0.14 + (sideX < 0 ? 0 : 1.4))) * 18;
          const bx = sideX;
          const by = h * 0.46 - hop;
          fillPxRect(ctx, bx - 5, h * 0.46 + 4, 10, 4, 'rgba(15, 23, 42, 0.35)', px);
          fillPxRect(ctx, bx - 7, by - 7, 14, 14, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, bx - 5, by - 5, 10, 10, '#f97316', px);
          // Pulsing Boombox Equalizer Bars
          const beatH = 6 + Math.round(Math.abs(Math.sin(matchTick * 0.22)) * 12);
          fillPxRect(ctx, sideX - 14, h - 172 - beatH, 6, beatH, '#22d3ee', px);
          fillPxRect(ctx, sideX - 4, h - 176 - beatH, 6, beatH + 4, '#f472b6', px);
          fillPxRect(ctx, sideX + 6, h - 170 - beatH, 6, beatH, '#fde047', px);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'RIO_CLAY') {
        // 2C. Animated Outer Ocean Waves, Cruising 16-Bit Sailboats & Gliding Seagulls
        ctx.save();
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 24; i++) {
          const wx = -240 + ((i * 179 + Math.floor(matchTick * 0.8)) % (w + 480));
          const wyTop = -265 + Math.sin(matchTick * 0.06 + i) * 8;
          const wyBot = h + 265 + Math.cos(matchTick * 0.06 + i) * 8;
          ctx.globalAlpha = 0.45 + 0.35 * Math.sin(matchTick * 0.08 + i);
          ctx.fillRect(Math.round(wx), Math.round(wyTop), 18, 4);
          ctx.fillRect(Math.round(wx), Math.round(wyBot), 18, 4);
        }
        ctx.globalAlpha = 1;

        // Cruising 16-Bit Tropical Sailboats in Top & Bottom Outer Ocean
        for (let b = 0; b < 2; b++) {
          const dir = b === 0 ? 1 : -1;
          const bx = b === 0
            ? ((matchTick * 1.1 + 220) % (w + 360)) - 180
            : w + 180 - ((matchTick * 1.0 + 540) % (w + 360));
          const by = b === 0 ? -285 + Math.sin(matchTick * 0.05) * 4 : h + 285 + Math.cos(matchTick * 0.05) * 4;
          // White water wake
          fillPxRect(ctx, bx - dir * 28, by + 4, 18, 4, '#e0f2fe', px);
          // Hull & Sail
          fillPxRect(ctx, bx - 18, by, 36, 10, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, bx - 15, by + 2, 30, 6, b === 0 ? '#f43f5e' : '#facc15', px);
          fillPxRect(ctx, bx - 8, by - 20, 16, 20, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, bx - 5, by - 17, 12, 16, '#ffffff', px);
        }

        // Gliding pixel seagulls over the outer boardwalk
        for (let g = 0; g < 4; g++) {
          const gx = ((matchTick * (1.6 + g * 0.25) + g * 520) % (w + 360)) - 180;
          const gy = (g % 2 === 0 ? -225 : h + 225) + Math.sin(matchTick * 0.05 + g * 2) * 14;
          const wingY = Math.sin(matchTick * 0.18 + g) > 0 ? -4 : 3;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(gx - 8), Math.round(gy + wingY), 7, 3);
          ctx.fillRect(Math.round(gx + 1), Math.round(gy + wingY), 7, 3);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(Math.round(gx - 2), Math.round(gy), 5, 4);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'TWILIGHT_SYNTH') {
        // 2D. Sweeping Cyber-Synth Neon Searchlights & Cruising Hover-Spinners in Outer Skyline
        ctx.save();
        for (const sl of [
          { x: 260, y: -215, sign: 1, col: 'rgba(244, 114, 182, 0.22)' },
          { x: w - 260, y: -215, sign: -1, col: 'rgba(34, 211, 238, 0.22)' },
          { x: 260, y: h + 215, sign: 1, col: 'rgba(34, 211, 238, 0.22)' },
          { x: w - 260, y: h + 215, sign: -1, col: 'rgba(244, 114, 182, 0.22)' },
        ]) {
          const swing = Math.sin(matchTick * 0.025 * sl.sign + (sl.y < 0 ? 0 : 1.5)) * 180;
          ctx.fillStyle = sl.col;
          ctx.beginPath();
          ctx.moveTo(sl.x - 10, sl.y);
          ctx.lineTo(sl.x + 10, sl.y);
          ctx.lineTo(sl.x + swing + 75, sl.y < 0 ? -165 : h + 165);
          ctx.lineTo(sl.x + swing - 75, sl.y < 0 ? -165 : h + 165);
          ctx.closePath();
          ctx.fill();
        }

        // Flying 16-Bit Cyber Hover-Spinners with Neon Thruster Trails in Outer Highway
        for (let s = 0; s < 2; s++) {
          const dir = s === 0 ? 1 : -1;
          const hx = s === 0
            ? ((matchTick * 4.2 + 120) % (w + 480)) - 240
            : w + 240 - ((matchTick * 3.8 + 380) % (w + 480));
          const hy = s === 0 ? -225 + Math.sin(matchTick * 0.08) * 6 : h + 225 + Math.cos(matchTick * 0.08) * 6;
          fillPxRect(ctx, hx - dir * 38, hy - 3, 28, 6, s === 0 ? '#22d3ee' : '#f472b6', px);
          fillPxRect(ctx, hx - 18, hy - 9, 36, 18, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, hx - 15, hy - 6, 30, 12, '#312e81', px);
          fillPxRect(ctx, hx - 6, hy - 4, 14, 8, '#67e8f9', px);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'ARCTIC_ICE') {
        // 2E. Shimmering Aurora Borealis Ribbons, Falling Pixel Snowflakes & Waddling Penguins in Outer Glacier
        ctx.save();
        // Aurora Borealis Shimmering Curtains at Top & Bottom Outer Horizon
        for (let a = 0; a < 10; a++) {
          const ax = 80 + a * ((w - 160) / 10) + Math.sin(matchTick * 0.03 + a) * 24;
          const waveY = Math.sin(matchTick * 0.05 + a * 0.8) * 12;
          ctx.fillStyle = a % 2 === 0 ? 'rgba(45, 212, 191, 0.24)' : 'rgba(168, 85, 247, 0.22)';
          ctx.fillRect(Math.round(ax), Math.round(-290 + waveY), 95, 28);
          ctx.fillRect(Math.round(ax), Math.round(h + 260 - waveY), 95, 28);
        }

        // Waddling 16-Bit Pixel Penguins along Top & Bottom Outer Snowbanks
        for (let p = 0; p < 4; p++) {
          const pxBase = p % 2 === 0 ? 540 : w - 540;
          const pyBase = p < 2 ? -205 : h + 205;
          const waddleX = pxBase + Math.sin(matchTick * 0.03 + p * 1.7) * 38;
          const hopY = Math.abs(Math.sin(matchTick * 0.16 + p)) * 4;
          fillPxRect(ctx, waddleX - 8, pyBase - 10 - hopY, 16, 20, '#0f172a', px);
          fillPxRect(ctx, waddleX - 5, pyBase - 4 - hopY, 10, 12, '#ffffff', px);
          fillPxRect(ctx, waddleX - 3, pyBase - 7 - hopY, 6, 4, '#f97316', px);
        }

        // Falling & Swirling 16-Bit Pixel Snowflakes Around the Outer Perimeter
        ctx.fillStyle = '#ffffff';
        for (let s = 0; s < 36; s++) {
          const sx = -260 + ((s * 173 + Math.floor(matchTick * 0.6 + Math.sin(matchTick * 0.04 + s) * 14)) % (w + 520));
          const sy = -280 + ((s * 97 + Math.floor(matchTick * 1.1)) % (h + 560));
          if (sx > -168 && sx < w + 168 && sy > -168 && sy < h + 168) continue;
          ctx.globalAlpha = 0.55 + 0.4 * Math.sin(matchTick * 0.07 + s);
          ctx.fillRect(Math.round(sx), Math.round(sy), 5, 5);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      } else if (selectedPitchTheme === 'VOLCANO_FORGE') {
        // 2F. Roaring 16-Bit Fire Brazier Flames (Matched 1:1 to Outer Caldera Pedestals) & Rising Volcanic Ember Sparks
        ctx.save();
        for (const bz of [
          { x: 240, y: -214 },
          { x: w - 240, y: -214 },
          { x: 240, y: h + 214 },
          { x: w - 240, y: h + 214 },
          { x: -232, y: 155 },
          { x: -232, y: h - 155 },
          { x: w + 232, y: 155 },
          { x: w + 232, y: h - 155 },
        ]) {
          const flicker = Math.round(Math.sin(matchTick * 0.24 + bz.x) * 6);
          fillPxRect(ctx, bz.x - 10, bz.y - 22 - Math.abs(flicker), 20, 18 + Math.abs(flicker), '#ef4444', px);
          fillPxRect(ctx, bz.x - 7, bz.y - 18 - Math.abs(flicker), 14, 14, '#f97316', px);
          fillPxRect(ctx, bz.x - 4, bz.y - 12 - Math.abs(flicker) * 0.5, 8, 8, '#fde047', px);
        }

        // Rising Glowing Volcanic Ember Sparks & Lava Bubbles in Outer Caldera
        for (let e = 0; e < 36; e++) {
          const ex = -260 + ((e * 181 + Math.floor(Math.sin(matchTick * 0.05 + e) * 16)) % (w + 520));
          const ey = h + 280 - ((e * 103 + Math.floor(matchTick * 1.4)) % (h + 560));
          if (ex > -168 && ex < w + 168 && ey > -168 && ey < h + 168) continue;
          ctx.fillStyle = e % 2 === 0 ? '#fde047' : '#f97316';
          ctx.fillRect(Math.round(ex), Math.round(ey), 5, 5);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'TURF_AUTUMN') {
        // 2G. Live Drifting Golden/Crimson Autumn Maple Leaves in Outer Park
        ctx.save();
        const leafColors = ['#ea580c', '#dc2626', '#facc15', '#f97316'];
        for (let l = 0; l < 32; l++) {
          const lx = -260 + ((l * 179 + Math.floor(matchTick * 0.85 + Math.sin(matchTick * 0.05 + l) * 18)) % (w + 520));
          const ly = -280 + ((l * 107 + Math.floor(matchTick * 0.95)) % (h + 560));
          if (lx > -168 && lx < w + 168 && ly > -168 && ly < h + 168) continue;
          ctx.fillStyle = leafColors[l % leafColors.length];
          ctx.fillRect(Math.round(lx), Math.round(ly), 6, 6);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'TURF_SAKURA') {
        // 2H. Swimming Koi Fish in Outer Imperial Ponds & Swirling Pink Sakura Petals
        ctx.save();
        for (const pond of [
          { x: -234, y: h * 0.2 },
          { x: -234, y: h * 0.8 },
          { x: w + 234, y: h * 0.2 },
          { x: w + 234, y: h * 0.8 },
        ]) {
          const koiAng = matchTick * 0.045 + pond.y * 0.01;
          const kx = pond.x + Math.cos(koiAng) * 14;
          const ky = pond.y + Math.sin(koiAng) * 14;
          fillPxRect(ctx, kx - 5, ky - 3, 10, 6, '#f97316', px);
          fillPxRect(ctx, kx + 2, ky - 2, 4, 4, '#ffffff', px);
        }

        const petalColors = ['#fbcfe8', '#f472b6', '#ffe4e6'];
        for (let p = 0; p < 36; p++) {
          const pxPos = -260 + ((p * 167 + Math.floor(matchTick * 1.05 + Math.sin(matchTick * 0.06 + p) * 16)) % (w + 520));
          const pyPos = -280 + ((p * 97 + Math.floor(matchTick * 0.9)) % (h + 560));
          if (pxPos > -168 && pxPos < w + 168 && pyPos > -168 && pyPos < h + 168) continue;
          ctx.fillStyle = petalColors[p % petalColors.length];
          ctx.fillRect(Math.round(pxPos), Math.round(pyPos), 5, 5);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'TURF_CHAMPIONS') {
        // 2I. Gleaming Trophy Sparkles on the 4 Outer Championship Trophy Plinths
        ctx.save();
        for (const tp of [
          { x: -234, y: h * 0.24 },
          { x: -234, y: h * 0.76 },
          { x: w + 234, y: h * 0.24 },
          { x: w + 234, y: h * 0.76 },
        ]) {
          const gleamR = 10 + Math.sin(matchTick * 0.14 + tp.y) * 5;
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, gleamR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // 2J. Sparkling Fountain Water Jets in Outer Royal Botanical Park
        ctx.save();
        for (const ftn of [
          { x: -234, y: h * 0.24 },
          { x: -234, y: h * 0.76 },
          { x: w + 234, y: h * 0.24 },
          { x: w + 234, y: h * 0.76 },
        ]) {
          const sprayR = 8 + ((matchTick * 0.45) % 18);
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ftn.x, ftn.y, sprayR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2K. Universal Multi-Tier Stadium Crowd (Rendered across ALL 10 Stadiums with Waving Team Flags, Raised Scarves & Camera Flashes!)
      ctx.save();
      const bounceAmp = 2.4 + crowdExcitement * 7.8 + (superFlowActive ? 3.5 : 0);
      const bounceFreq = 0.08 + crowdExcitement * 0.14;
      const isExcited = crowdExcitement > 0.22 || gameState === 'GOAL_CELEBRATION' || superFlowActive;
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

        // Supporter Scarves & Waving Team Flags
        if (fan.prop === 'FLAG') {
          const waveX = Math.round(Math.sin(matchTick * 0.16 + fan.phase) * 5);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(fx + 5, fy - 16, 2, 14);
          ctx.fillStyle = fan.isHome ? '#38bdf8' : '#fb7185';
          ctx.fillRect(fx + 7, fy - 16 + (waveX > 0 ? 1 : 0), 9 + Math.abs(waveX) * 0.5, 6);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(fx + 9, fy - 14 + (waveX > 0 ? 1 : 0), 4, 2);
        } else if (fan.prop === 'SCARF' && isExcited) {
          ctx.fillStyle = fan.isHome ? '#38bdf8' : '#fb7185';
          ctx.fillRect(fx - 7, fy - 12, 14, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(fx - 3, fy - 12, 6, 3);
        }

        // Periodic Camera Flash Bulbs in the Stands during Goals or High Excitement
        if (isExcited && (i * 23 + Math.floor(matchTick * 0.3)) % 67 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.fillRect(fx - 9, fy - 9, 18, 18);
        }
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

      // 7. Subtle Per-Stadium Live Goal Celebration Effect on the Pitch & Perimeter
      if (gameState === 'GOAL_CELEBRATION') {
        const stadiumFx = getStadiumGoalEffect(selectedPitchTheme);
        const goalElapsed = Math.max(0, 115 - goalBannerTimer);
        const fxAlpha = Math.max(0, Math.min(1, (115 - goalElapsed) / 95)) * 0.58;
        ctx.save();
        ctx.globalAlpha = fxAlpha;

        // Expanding Stadium-Signature Dual Shockwave Rings from Goal Mouth & Center Circle
        const ringR1 = 35 + goalElapsed * 4.2;
        const ringR2 = Math.max(12, -10 + goalElapsed * 3.3);
        ctx.strokeStyle = stadiumFx.shockwaveColors[0];
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(lastGoalWorldX, lastGoalWorldY, ringR1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = stadiumFx.shockwaveColors[1];
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(lastGoalWorldX, lastGoalWorldY, ringR2, 0, Math.PI * 2);
        ctx.stroke();

        // Subtle Theme-Specific Stadium Celebration Accents
        if (stadiumFx.effectStyle === 'BOTANICAL_FOUNTAIN') {
          // Classic Sunlit Turf: 4 Outer Park Fountains erupt with higher sparkling cyan/gold water rings
          for (const ftn of [
            { x: -234, y: h * 0.24 },
            { x: -234, y: h * 0.76 },
            { x: w + 234, y: h * 0.24 },
            { x: w + 234, y: h * 0.76 },
          ]) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ftn.x, ftn.y, 16 + (goalElapsed % 28), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (stadiumFx.effectStyle === 'MAPLE_SWIRL') {
          // Autumn Harvest Turf: Swirling golden-amber harvest wind vortex ring in center circle
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4;
          ctx.setLineDash([16, 12]);
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.5, 85 + Math.sin(goalElapsed * 0.15) * 14, goalElapsed * 0.08, goalElapsed * 0.08 + Math.PI * 1.8);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (stadiumFx.effectStyle === 'SAKURA_PETAL_STORM') {
          // Sakura Blossom Turf: Expanding pink blossom ripple in center & koi ponds
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.5, 65 + (goalElapsed * 1.6) % 95, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stadiumFx.effectStyle === 'CHAMPIONS_PYRO') {
          // Champions Cathedral: Golden Pyro Flashes along Top & Bottom Touchlines
          for (let pxIdx = 0; pxIdx < 6; pxIdx++) {
            const pyroX = 190 + pxIdx * ((w - 380) / 5);
            const pyroR = 10 + Math.abs(Math.sin(goalElapsed * 0.22 + pxIdx)) * 14;
            fillPxRect(ctx, pyroX - pyroR * 0.5, -28 - pyroR * 0.5, pyroR, pyroR, '#fde047', px);
            fillPxRect(ctx, pyroX - pyroR * 0.5, h + 28 - pyroR * 0.5, pyroR, pyroR, '#fde047', px);
          }
        } else if (stadiumFx.effectStyle === 'COSMIC_SUPERNOVA') {
          // Cosmic Orbit Station: Twin Orbital Supernova Ellipses & UFO Tractor Beam Pulse
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.5, 110 + goalElapsed * 1.5, 48 + goalElapsed * 0.6, goalElapsed * 0.04, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stadiumFx.effectStyle === 'STREET_GRAFFITI_BASS') {
          // Urban Street Concrete: Booming Boombox Soundwave Rings on Left & Right Outer Courts
          for (const sx of [-256, w + 256]) {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(sx, h - 140, 18 + ((goalElapsed * 2.2) % 55), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (stadiumFx.effectStyle === 'CARNIVAL_STREAMERS') {
          // Copacabana Sunset Clay: Golden Sunburst Rays radiating from Center Circle
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 4;
          for (let r = 0; r < 8; r++) {
            const ang = (r * Math.PI) / 4 + goalElapsed * 0.03;
            ctx.beginPath();
            ctx.moveTo(w * 0.5 + Math.cos(ang) * 55, h * 0.5 + Math.sin(ang) * 55);
            ctx.lineTo(w * 0.5 + Math.cos(ang) * 115, h * 0.5 + Math.sin(ang) * 115);
            ctx.stroke();
          }
        } else if (stadiumFx.effectStyle === 'SYNTH_LASER_SCAN') {
          // Twilight Synthwave: Sweeping Magenta & Cyan Laser Scanlines across Pitch
          const scanOffset = (goalElapsed * 9) % (w * 0.5);
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(w * 0.5 - scanOffset, 0);
          ctx.lineTo(w * 0.5 - scanOffset, h);
          ctx.moveTo(w * 0.5 + scanOffset, 0);
          ctx.lineTo(w * 0.5 + scanOffset, h);
          ctx.stroke();
        } else if (stadiumFx.effectStyle === 'ARCTIC_CRYSTAL_BURST') {
          // Glacier Frost Arena: Expanding 8-Point Crystalline Frost Star in Center Circle
          const frostR = 65 + Math.sin(goalElapsed * 0.16) * 22;
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 4;
          for (let a = 0; a < 4; a++) {
            const ang = (a * Math.PI) / 4 + goalElapsed * 0.02;
            ctx.beginPath();
            ctx.moveTo(w * 0.5 - Math.cos(ang) * frostR, h * 0.5 - Math.sin(ang) * frostR);
            ctx.lineTo(w * 0.5 + Math.cos(ang) * frostR, h * 0.5 + Math.sin(ang) * frostR);
            ctx.stroke();
          }
        } else if (stadiumFx.effectStyle === 'VOLCANO_MAGMA_PLUME') {
          // Magma Caldera Citadel: Outer Caldera Fire Braziers Surge with Tall Molten Gold Pillars
          for (const bz of [
            { x: 240, y: -214 },
            { x: w - 240, y: -214 },
            { x: 240, y: h + 214 },
            { x: w - 240, y: h + 214 },
          ]) {
            fillPxRect(ctx, bz.x - 14, bz.y - 42, 28, 34, '#f97316', px);
            fillPxRect(ctx, bz.x - 8, bz.y - 36, 16, 26, '#fde047', px);
          }
        }
        ctx.restore();
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
        const cx = Math.round(cf.x);
        const cy = Math.round(cf.y);
        const cw = Math.round(cf.w);
        const ch = Math.round(cf.h);
        if (cf.shape === 'STAR' || cf.shape === 'CRYSTAL') {
          // 16-bit Pixel Plus-Star / Ice Crystal Shard
          ctx.fillRect(cx - cw * 0.5, cy - 1.5, cw, 3);
          ctx.fillRect(cx - 1.5, cy - cw * 0.5, 3, cw);
        } else if (cf.shape === 'PETAL' || cf.shape === 'LEAF') {
          // Stepped Pixel Petal / Autumn Maple Leaf
          ctx.fillRect(cx - cw * 0.5, cy - ch * 0.5, cw, ch);
          ctx.fillRect(cx - cw * 0.25, cy - ch * 0.5 - 2, cw * 0.5, ch + 4);
        } else {
          ctx.fillRect(cx - cw * 0.5, cy - ch * 0.5, cw, ch);
        }
        ctx.restore();
      }

      // 7. Expressive Unboxed 3D Outlined Arcade Floating Callouts (No Blocked-Out Black Background!)
      for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha * 1.15));
        ctx.translate(ft.x, ft.y);
        const popScale = Math.max(1.0, ft.scale || 1.0);
        ctx.scale(popScale, popScale);
        ctx.font = '900 15.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        // 3D Extruded Block Shadow
        ctx.fillStyle = '#0f172a';
        ctx.fillText(ft.text, 2.5, 3.2);

        // Crisp Neo-Brutalist Ink Stroke Outline
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 5.5;
        ctx.strokeText(ft.text, 0, 0);

        // Vibrant Fill
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, 0, 0);
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
      let targetZoom = 1.0;

      if (isIdleMenuState) {
        // Gentle scenic stadium pan while in Splash or Home Menu so the pitch never looks like a frozen old match
        targetCamX = PITCH.width * 0.5 + Math.sin(matchTick * 0.008) * 110;
        targetCamY = PITCH.height * 0.5 + Math.cos(matchTick * 0.006) * 45;
        targetZoom = 1.0;
      } else {
        const focusX = ball.x * 0.62 + (controlledPlayer ? controlledPlayer.x * 0.38 : PITCH.width * 0.19);
        const focusY = ball.y * 0.62 + (controlledPlayer ? controlledPlayer.y * 0.38 : PITCH.height * 0.19);
        const isPortrait = canvas ? canvas.width < canvas.height : false;
        const isMobOrTab = isMobileOrTabletViewport();
        const isCompactPhoneLandscape = Boolean(canvas && canvas.height <= 550 && canvas.width > canvas.height);

        // Enhanced camera tracking & slight zoom on phone portrait & landscape so gameplay feels close, smooth, and responsive
        const panFactorX = isPortrait ? 0.56 : isCompactPhoneLandscape ? 0.38 : isMobOrTab ? 0.22 : 0.14;
        const panFactorY = isPortrait ? 0.34 : isCompactPhoneLandscape ? 0.36 : isMobOrTab ? 0.20 : 0.12;
        const rawCamX = PITCH.width * 0.5 + (focusX - PITCH.width * 0.5) * panFactorX;
        const rawCamY = PITCH.height * 0.5 + (focusY - PITCH.height * 0.5) * panFactorY;
        const clampMarginX = isPortrait ? 0.18 : isCompactPhoneLandscape ? 0.26 : isMobOrTab ? 0.34 : 0.22;
        const clampMarginY = isPortrait ? 0.24 : isCompactPhoneLandscape ? 0.28 : isMobOrTab ? 0.34 : 0.28;
        targetCamX = Math.max(PITCH.width * clampMarginX, Math.min(PITCH.width * (1 - clampMarginX), rawCamX));
        targetCamY = Math.max(PITCH.height * clampMarginY, Math.min(PITCH.height * (1 - clampMarginY), rawCamY));
        const baseGameplayZoom = isPortrait ? 1.04 : isCompactPhoneLandscape ? 1.06 : 1.0;
        if (gameState === 'GOAL_CELEBRATION') {
          targetZoom = baseGameplayZoom + 0.06;
        } else if (kickChargeState.power > 0.25) {
          targetZoom = baseGameplayZoom + kickChargeState.power * 0.025;
        } else {
          targetZoom = baseGameplayZoom;
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
        ft.scale = Math.max(1.0, (ft.scale || 1.0) - 0.032 * dtScale);
        ft.alpha -= 0.022 * dtScale;
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
      cam.zoom = 1.0;
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
        const postMatchRankCard = document.getElementById('postMatchRankCard');
        const playlistWrap = document.getElementById('playlistSelectorWrap');
        const kitWrap = document.getElementById('kitSelectorWrap');

        if (titleEl) {
          titleEl.innerHTML = `<span>REMATCH</span><span class="font-mono-num text-xl sm:text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_2px_0_#0f172a]">0.2</span>`;
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
        if (postMatchRankCard) {
          postMatchRankCard.classList.add('hidden');
        }
        if (playlistWrap) playlistWrap.classList.remove('hidden');
        if (kitWrap) kitWrap.classList.remove('hidden');
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
          ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-sky-400 border-[3px] text-slate-900 font-black text-xl flex flex-col items-center justify-center relative overflow-hidden shrink-0'
          : 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-rose-400 border-[3px] text-white font-black text-xl flex flex-col items-center justify-center relative overflow-hidden shrink-0';
        applyRankOutlineStyle(winAvatar);
        winAvatar.innerHTML = getProfileAvatarInnerHtml(userProfile, youIsHome);
      }
      if (winPlayerName) winPlayerName.innerText = userProfile.name;
      const winRankText = document.getElementById('tourneyWinRankText');
      if (winRankText) {
        winRankText.innerText = `${getUserRankInfo(userProfile.rankedWins).name} · Cup Champion`;
      }
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

      const youWon = scoreYou > scoreAi;
      const possPct = Math.round((possessionFramesYou / Math.max(1, possessionFramesTotal)) * 100);
      let nextBtnLabel = 'FIND NEW MATCH';
      let showRematchBtn = true;
      let isTournamentChampion = false;
      const matchRoundBeforeUpdate = tournamentRound;

      // Ranked & Tournament win progression: start at Bronze I and rank up by winning games, with Post-Match Rank Progress Bar UI!
      let rankUpAnnouncement = '';
      const postMatchRankCard = document.getElementById('postMatchRankCard');
      if (currentGameMode === 'RANKED' || currentGameMode === 'TOURNAMENT') {
        const prevWins = userProfile.rankedWins;
        userProfile.rankedMatches += 1;
        if (youWon) {
          userProfile.rankedWins += 1;
        }
        saveUserProfileToStorage();
        syncProfileUI();

        const summary = computeRankProgressSummary(userProfile.rankedWins, prevWins);
        if (youWon && summary.rankedUp) {
          sound.playComboBonus();
          rankUpAnnouncement = `RANK UP! Promoted to ${summary.currentRank.name}!`;
        } else if (youWon && currentGameMode === 'RANKED') {
          rankUpAnnouncement = summary.nextRank
            ? `Ranked Win #${userProfile.rankedWins} (${summary.currentRank.name} • ${summary.winsNeededForNext} more to ${summary.nextRank.name})`
            : `Ranked Win #${userProfile.rankedWins} (${summary.currentRank.name})`;
        }

        // Populate and display the Post-Match Ranked Progression Bar & UI Card
        if (postMatchRankCard && (currentGameMode === 'RANKED' || youWon)) {
          postMatchRankCard.classList.remove('hidden');
          postMatchRankCard.style.borderColor = summary.currentRank.borderHex;
          const badgeEl = document.getElementById('postMatchRankBadge');
          const headlineEl = document.getElementById('postMatchRankHeadline');
          const winsPillEl = document.getElementById('postMatchRankWinsPill');
          const barEl = document.getElementById('postMatchRankProgressBar');
          const subtextEl = document.getElementById('postMatchRankSubtext');

          if (badgeEl) {
            badgeEl.innerText = summary.currentRank.name;
            badgeEl.style.backgroundColor = summary.currentRank.badgeBgHex;
            badgeEl.style.color = summary.currentRank.badgeTextHex;
            badgeEl.style.borderColor = summary.currentRank.borderHex;
          }
          if (headlineEl) {
            headlineEl.innerText = youWon
              ? summary.statusHeadline
              : `CURRENT RANK • ${summary.currentRank.name.toUpperCase()}`;
          }
          if (winsPillEl) {
            winsPillEl.innerText = youWon
              ? `+1 WIN (${userProfile.rankedWins} TOTAL)`
              : `${userProfile.rankedWins} ${userProfile.rankedWins === 1 ? 'WIN' : 'WINS'}`;
          }
          if (barEl) {
            barEl.style.width = `${youWon ? summary.prevProgressPct : summary.progressPct}%`;
            setTimeout(() => {
              barEl.style.width = `${summary.progressPct}%`;
            }, 80);
          }
          if (subtextEl) {
            subtextEl.innerText = summary.subtext;
          }

          // Highlight active tier node in the 7-step ladder
          RANK_TIERS.forEach((tier, idx) => {
            const nodeEl = document.getElementById(`postMatchTierNode${idx}`);
            if (!nodeEl) return;
            const isReached = idx <= summary.currentRank.index;
            const isCurrent = idx === summary.currentRank.index;
            nodeEl.style.backgroundColor = isReached ? tier.borderHex : '#e2e8f0';
            nodeEl.style.transform = isCurrent ? 'scale(1.25)' : 'scale(1)';
          });
        } else if (postMatchRankCard) {
          postMatchRankCard.classList.add('hidden');
        }
      } else if (postMatchRankCard) {
        postMatchRankCard.classList.add('hidden');
      }

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
            if (subEl) {
              subEl.innerText = rankUpAnnouncement
                ? `Advanced to ${nextRoundName}! ${rankUpAnnouncement}`
                : `Advanced to ${nextRoundName} (Game ${tournamentRound + 1} of ${TOTAL_TOURNAMENT_GAMES})!`;
            }
            nextBtnLabel = `PLAY ${nextRoundName.toUpperCase()} (${tournamentRound + 1}/${TOTAL_TOURNAMENT_GAMES})`;
          } else {
            isTournamentChampion = true;
            if (titleEl) titleEl.innerHTML = `CHAMPION! <span class="font-light text-amber-500">·</span> ${scoreYou}-${scoreAi}`;
            if (srTitleEl) srTitleEl.innerText = `TOURNAMENT CHAMPION ${scoreYou}-${scoreAi}`;
            if (subEl) {
              subEl.innerText = rankUpAnnouncement
                ? `3-0 Knockout Sweep! ${rankUpAnnouncement}`
                : `3-0 Knockout Sweep! You won the Knockout Cup vs ${currentOpponent.tag}!`;
            }
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
          if (subEl) {
            subEl.innerText = rankUpAnnouncement
              ? `${reason ? reason + ' • ' : ''}${rankUpAnnouncement}`
              : reason || `You defeated ${currentOpponent.tag}!`;
          }
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

      // Calculate & Award Match Money Reward (depends on game outcome & game mode)
      const moneyReward = calculateMatchMoneyReward({
        gameMode: currentGameMode,
        didWin: youWon,
        isDraw: scoreYou === scoreAi,
        goalsFor: scoreYou,
        goalsAgainst: scoreAi,
        isMercyRule: Math.abs(scoreYou - scoreAi) >= MERCY_RULE_LEAD,
        tournamentRound: matchRoundBeforeUpdate,
      });
      userProfile.balance =
        (Number.isFinite(userProfile.balance) ? userProfile.balance : INITIAL_PLAYER_BALANCE) +
        moneyReward.totalReward;
      saveUserProfileToStorage();
      syncProfileUI();

      const spEl = document.getElementById('statPasses');
      const scEl = document.getElementById('statCombo');
      const ssEl = document.getElementById('statShots');
      const spoEl = document.getElementById('statPossession');
      const smeEl = document.getElementById('statMoneyEarned');
      const twMoneyEl = document.getElementById('tourneyWinMoneyStat');
      const statMoneyModeBadgeEl = document.getElementById('statMoneyModeBadge');

      if (spEl) spEl.innerText = String(totalPassesYou);
      if (scEl) scEl.innerText = `x${maxFlowCombo}`;
      if (ssEl) ssEl.innerText = String(totalShotsYou);
      if (spoEl) spoEl.innerText = `${possPct}%`;
      if (smeEl) smeEl.innerText = `+$${moneyReward.totalReward}`;
      if (twMoneyEl) twMoneyEl.innerText = `+$${moneyReward.totalReward}`;
      if (statMoneyModeBadgeEl) {
        statMoneyModeBadgeEl.innerText =
          currentGameMode === 'TOURNAMENT'
            ? '2X CUP'
            : currentGameMode === 'RANKED'
              ? '1.5X'
              : '1X';
      }

      if (statsRow) {
        statsRow.classList.remove('hidden');
        statsRow.classList.add('grid');
      }
      if (playlistWrap) playlistWrap.classList.add('hidden');
      if (kitWrap) kitWrap.classList.add('hidden');

      setMatchmakingIdleUI();
      if (startBtnText) startBtnText.innerText = nextBtnLabel;
      if (openSlotMachineBtn) openSlotMachineBtn.classList.add('hidden');

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
        // Trigger post-match cash reward count-up animation & coin clink SFX
        triggerMatchCashRewardAnimation(moneyReward.totalReward);
      });
    }

    function pickRandomPitchArena() {
      if (preferredArenaMode !== 'RANDOM') {
        selectedPitchTheme = preferredArenaMode;
      } else {
        // Pick a random stadium theme different from the previous one so each match feels fresh
        const candidates = PITCH_THEMES.filter((t) => t.id !== selectedPitchTheme);
        const pool = candidates.length > 0 ? candidates : PITCH_THEMES;
        const randomTheme = pool[Math.floor(Math.random() * pool.length)];
        selectedPitchTheme = randomTheme.id;
      }
      applyPitchTheme(selectedPitchTheme);
      sound.setPitchTheme(selectedPitchTheme);
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

      const rankInfo = getUserRankInfo(userProfile.rankedWins);
      setElText('brkYouNameQf', `${userProfile.name} (${rankInfo.name})`);
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
      setElText('brkYouNameSf', tournamentRound >= 1 ? `${userProfile.name}` : 'Winner QF 1');
      setElText('brkOppNameSf', tournamentRound >= 1 ? tournamentBracket.sfOpponent.tag : 'Winner QF 2');
      setElText('brkScoreSf1', tournamentRound === 1 ? 'NOW' : tournamentRound > 1 ? tournamentBracket.scores.sfYou || 'W' : 'SF 1');

      setElText('brkGfOppNameSf', tournamentRound >= 1 ? tournamentBracket.gfOpponent.tag : 'Winner QF 4');
      setElText('brkOtherSfName', tournamentRound >= 1 ? tournamentBracket.otherSfLoser.tag : 'Winner QF 3');
      setElText('brkScoreSf2', tournamentRound >= 2 ? '2-1' : 'SF 2');

      // Grand Final
      setElText('brkYouNameGf', tournamentRound >= 2 ? `${userProfile.name}` : 'Winner SF 1');
      setElText('brkOppNameGf', tournamentRound >= 2 ? tournamentBracket.gfOpponent.tag : 'Winner SF 2');
      setElText('brkScoreGf', tournamentRound === 2 ? 'FINAL' : 'CUP');

      const qfCard = document.getElementById('brkMatchCardQf1');
      const sfCard = document.getElementById('brkMatchCardSf1');
      const gfCard = document.getElementById('brkMatchCardGf');

      if (qfCard) {
        qfCard.className =
          tournamentRound === 0
            ? 'p-2 rounded-xl bg-amber-300 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-left transition-all'
            : 'p-2 rounded-xl bg-emerald-200 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left';
      }
      if (sfCard) {
        sfCard.className =
          tournamentRound === 1
            ? 'p-2.5 rounded-xl bg-amber-300 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-left transition-all'
            : tournamentRound > 1
              ? 'p-2.5 rounded-xl bg-emerald-200 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left'
              : 'p-2.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left';
      }
      if (gfCard) {
        gfCard.className =
          tournamentRound === 2
            ? 'p-3 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-300 border-2 border-slate-900 shadow-[0_4px_0_#0f172a] text-left transition-all'
            : 'p-3 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-left';
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
      const rankInfo = getUserRankInfo(userProfile.rankedWins);
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
          ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-sky-400 border-[3px] text-slate-900 font-black text-lg flex flex-col items-center justify-center mb-2 relative overflow-hidden'
          : 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-rose-400 border-[3px] text-white font-black text-lg flex flex-col items-center justify-center mb-2 relative overflow-hidden';
        applyRankOutlineStyle(vsYouAvatar);
        vsYouAvatar.innerHTML = getProfileAvatarInnerHtml(userProfile, youIsHome);
      }
      if (vsYouRankPill) {
        if (showRank) {
          vsYouRankPill.classList.remove('hidden');
          vsYouRankPill.innerText = rankInfo.name;
          vsYouRankPill.style.backgroundColor = rankInfo.badgeBgHex;
          vsYouRankPill.style.color = rankInfo.badgeTextHex;
          vsYouRankPill.style.borderColor = rankInfo.borderHex;
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
      sound.setPitchTheme(selectedPitchTheme);
      rebuildStaticPitchCache();

      sound.unlock();
      sound.setMenuMode(false);
      sound.startMusic(() => ({
        isPlaying: gameState === 'PLAYING' || gameState === 'GOAL_CELEBRATION',
        isSuperFlow: flowCombo >= PASSES_FOR_FLOW_BOOST,
        flowCombo,
        pitchTheme: selectedPitchTheme,
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

      if (card) card.className = 'sm:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-sky-50 border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
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
        startBtn.className =
          'indie-cta-btn w-full sm:w-auto sm:min-w-[250px] sm:max-w-[340px] min-h-[46px] sm:min-h-[50px] py-3 sm:py-3.5 px-7 rounded-2xl bg-slate-800 text-slate-200 font-black text-sm sm:text-base tracking-wide cursor-wait flex items-center justify-center space-x-2.5 opacity-90 mx-auto';
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
      if (gameState === 'MATCH_OVER') {
        const mainGridEl = document.getElementById('menuMainGrid');
        const postMatchRankCardEl = document.getElementById('postMatchRankCard');
        const statsRowEl = document.getElementById('matchStatsRow');
        if (mainGridEl) mainGridEl.className = 'flex flex-col gap-3 text-left mb-3';
        if (postMatchRankCardEl) postMatchRankCardEl.classList.add('hidden');
        if (statsRowEl) {
          statsRowEl.classList.add('hidden');
          statsRowEl.classList.remove('grid');
        }
      }
      if (resumeBtn) resumeBtn.classList.add('hidden');
      if (forfeitBtn) forfeitBtn.classList.add('hidden');
      if (rematchSameBtn) rematchSameBtn.classList.add('hidden');
      if (mainMenuBtn) mainMenuBtn.classList.add('hidden');
      if (openSlotMachineBtn) openSlotMachineBtn.classList.add('hidden');

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

          if (card) card.className = 'sm:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-emerald-50 border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
          if (mmStatusLabel) mmStatusLabel.className = 'flex items-center space-x-2 text-emerald-800';
          if (mmStatusText) mmStatusText.innerText = `Opponent Matched • ${currentOpponent.tag}`;
          if (mmStatusIcon) mmStatusIcon.className = 'fa-solid fa-circle-check text-emerald-600 text-xs';
          if (vsBadge) vsBadge.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-400 text-slate-900 text-xs font-black flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 scale-110 transition-all';
          if (progressBar) progressBar.style.width = '100%';

          if (startBtn) {
            startBtn.className =
              'indie-cta-btn w-full sm:w-auto sm:min-w-[250px] sm:max-w-[340px] min-h-[46px] sm:min-h-[50px] py-3 sm:py-3.5 px-7 rounded-2xl bg-emerald-400 text-slate-900 font-black text-sm sm:text-base tracking-wide flex items-center justify-center space-x-2.5 mx-auto';
          }
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
        if (openSlotMachineBtn) openSlotMachineBtn.classList.add('hidden');
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

    // --- Player Profile Overview & Edit Profile / Camera Photo Capture Logic ---
    const editProfileBtn = document.getElementById('editProfileBtn');
    const menuProfileBar = document.getElementById('menuProfileBar');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    const switchToEditProfileBtn = document.getElementById('switchToEditProfileBtn');
    const backToProfileOverviewBtn = document.getElementById('backToProfileOverviewBtn');
    const profileOverviewSection = document.getElementById('profileOverviewSection');
    const profileEditSection = document.getElementById('profileEditSection');
    const profileModalHeaderTitle = document.getElementById('profileModalTitleText');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const profileNameInput = document.getElementById('profileNameInput') as HTMLInputElement | null;
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const clearPhotoBtn = document.getElementById('clearPhotoBtn');
    const profileCameraVideo = document.getElementById('profileCameraVideo') as HTMLVideoElement | null;
    const modalProfilePreviewBox = document.getElementById('modalProfilePreviewBox');
    const modalProfilePreviewImg = document.getElementById('modalProfilePreviewImg') as HTMLImageElement | null;
    const modalProfilePreviewInitials = document.getElementById('modalProfilePreviewInitials');
    const cameraStatusText = document.getElementById('cameraStatusText');
    let pendingAvatarDataUrl: string | null = userProfile.photoDataUrl;

    function switchProfileModalView(view: 'overview' | 'edit') {
      if (profileOverviewSection) profileOverviewSection.classList.toggle('hidden', view !== 'overview');
      if (profileEditSection) profileEditSection.classList.toggle('hidden', view !== 'edit');
      if (profileModalHeaderTitle) {
        profileModalHeaderTitle.innerText = view === 'overview' ? 'Player Profile' : 'Edit Profile';
      }
      if (view !== 'edit') {
        stopProfileCameraStream();
      }
      gamepadState.focusedMenuIndex = 0;
      syncMenuFocusVisual(true);
    }

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

      if (modalProfilePreviewBox) {
        applyRankOutlineStyle(modalProfilePreviewBox);
      }

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

    function resetCouponInputUI() {
      const cInput = document.getElementById('couponCodeInput') as HTMLInputElement | null;
      const cFeedback = document.getElementById('couponFeedbackText');
      if (cInput) {
        cInput.value = '';
      }
      if (cFeedback) {
        cFeedback.innerText = '';
        cFeedback.className = 'hidden';
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
      resetCouponInputUI();
      syncProfileUI();
      renderModalAvatarPreview(pendingAvatarDataUrl);
      switchProfileModalView('overview');
      if (editProfileModal) {
        editProfileModal.classList.remove('hidden');
      }
      gamepadState.focusedMenuIndex = 0;
      syncMenuFocusVisual(true);
    }

    function closeEditProfileModal() {
      stopProfileCameraStream();
      resetCouponInputUI();
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
        ...userProfile,
        name: rawName || 'Player',
        iconType: pendingAvatarDataUrl ? 'photo' : 'preset',
        presetIcon: userProfile.presetIcon || '#10',
        photoDataUrl: pendingAvatarDataUrl,
        hasEditedProfile: true,
      };
      saveUserProfileToStorage();
      syncKitAndModeUI();
      closeEditProfileModal();
    }

    // --- Coupon Redemption ("HACK" = +$100 / 10 Spins) & Club Store Teaser ---
    const couponCodeInput = document.getElementById('couponCodeInput') as HTMLInputElement | null;
    const redeemCouponBtn = document.getElementById('redeemCouponBtn');
    const couponFeedbackText = document.getElementById('couponFeedbackText');

    function handleRedeemCoupon(overrideCode?: string) {
      sound.init();
      const rawCode = typeof overrideCode === 'string' ? overrideCode : couponCodeInput ? couponCodeInput.value : '';
      const res = redeemCouponCode(rawCode, userProfile.balance);
      if (res.valid) {
        userProfile.balance = res.newBalance;
        saveUserProfileToStorage();
        syncProfileUI();
        sound.playCouponRedeem();
        if (couponCodeInput && typeof overrideCode !== 'string') {
          couponCodeInput.value = '';
        }
        if (couponFeedbackText) {
          couponFeedbackText.innerText = res.message;
          couponFeedbackText.className =
            'text-[11px] font-black text-emerald-800 bg-emerald-100 border-2 border-emerald-500 rounded-xl px-3 py-1.5 mt-2 shadow-[0_2px_0_#0f172a]';
          couponFeedbackText.classList.remove('hidden');
        }
      } else {
        sound.playUiBack();
        if (couponFeedbackText) {
          couponFeedbackText.innerText = res.message;
          couponFeedbackText.className =
            'text-[11px] font-black text-rose-800 bg-rose-100 border-2 border-rose-400 rounded-xl px-3 py-1.5 mt-2 shadow-[0_2px_0_#0f172a]';
          couponFeedbackText.classList.remove('hidden');
        }
      }
      return res;
    }

    if (redeemCouponBtn) {
      redeemCouponBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRedeemCoupon();
      });
    }
    if (couponCodeInput) {
      couponCodeInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          handleRedeemCoupon();
        }
      });
    }

    // --- REMATCH POKIES (3 Stadium Machines, $10/$100 Bet Choice & Hold & Spin Bonus Screen) ---
    const openSlotMachineBtn = document.getElementById('openSlotMachineBtn');
    const slotMachineModal = document.getElementById('slotMachineModal');
    const closeSlotModalBtn = document.getElementById('closeSlotModalBtn');
    const slotSpinBtn = document.getElementById('slotSpinBtn') as HTMLButtonElement | null;
    const slotSpinBtnLabel = document.getElementById('slotSpinBtnLabel');
    const slotStatusBanner = document.getElementById('slotStatusBanner');
    const slotWinAmountBadge = document.getElementById('slotWinAmountBadge');
    const slotBalanceDeltaBadge = document.getElementById('slotBalanceDeltaBadge');
    const slotMainGameScreen = document.getElementById('slotMainGameScreen');
    const slotHoldAndSpinScreen = document.getElementById('slotHoldAndSpinScreen');
    const holdSpinActionBtn = document.getElementById('holdSpinActionBtn') as HTMLButtonElement | null;
    const holdSpinActionBtnLabel = document.getElementById('holdSpinActionBtnLabel');
    const holdSpinStatusBanner = document.getElementById('holdSpinStatusBanner');
    let isSlotSpinning = false;
    let slotSpinTimeouts: ReturnType<typeof setTimeout>[] = [];
    let matchCashAnimInterval: ReturnType<typeof setInterval> | null = null;
    let currentPokieGrid = getPokieGridFromStops([0, 2, 1]);
    let activeHoldAndSpinSession: HoldAndSpinSessionState | null = null;
    let isHoldSpinStepAnimating = false;

    function clearSlotTimers() {
      slotSpinTimeouts.forEach((t) => clearTimeout(t));
      slotSpinTimeouts = [];
      if (matchCashAnimInterval) {
        clearInterval(matchCashAnimInterval);
        matchCashAnimInterval = null;
      }
      isSlotSpinning = false;
      isHoldSpinStepAnimating = false;
    }

    function triggerMatchCashRewardAnimation(targetReward: number) {
      if (matchCashAnimInterval) {
        clearInterval(matchCashAnimInterval);
        matchCashAnimInterval = null;
      }
      const smeEl = document.getElementById('statMoneyEarned');
      const twMoneyEl = document.getElementById('tourneyWinMoneyStat');
      const statMoneyCardEl = document.getElementById('statMoneyCard');
      const twMoneyCardEl = document.getElementById('tourneyWinMoneyCard');
      const statCoinIconEl = document.getElementById('statMoneyCoinIcon');
      const twCoinIconEl = document.getElementById('tourneyWinCoinIcon');

      sound.playMatchCashReward(targetReward >= 45);

      [statMoneyCardEl, twMoneyCardEl].forEach((card) => {
        if (!card) return;
        card.classList.remove('cash-reward-card-anim');
        void card.offsetWidth;
        card.classList.add('cash-reward-card-anim');
      });
      [statCoinIconEl, twCoinIconEl].forEach((icon) => {
        if (!icon) return;
        icon.classList.add('coin-reward-spin');
      });

      const totalSteps = 7;
      let step = 0;
      matchCashAnimInterval = setInterval(() => {
        step++;
        sound.playCoinTick(step - 1, totalSteps);
        const curVal =
          step >= totalSteps
            ? targetReward
            : Math.max(1, Math.round((targetReward * step) / totalSteps));
        if (smeEl) smeEl.innerText = `+$${curVal}`;
        if (twMoneyEl) twMoneyEl.innerText = `+$${curVal}`;

        if (step >= totalSteps) {
          if (matchCashAnimInterval) {
            clearInterval(matchCashAnimInterval);
            matchCashAnimInterval = null;
          }
          [statCoinIconEl, twCoinIconEl].forEach((icon) => {
            if (!icon) return;
            icon.classList.remove('coin-reward-spin');
          });
        }
      }, 42);
    }

    function getPokieSymbolVisual(symId: string) {
      const safeId = (symId in POKIE_SYMBOLS ? symId : 'DIAMOND_BALL') as PokieSymbolId;
      const spec = POKIE_SYMBOLS[safeId];

      // Bespoke 16-bit Pixel Art SVG Icons for each Arcade Pokie Symbol
      const svgMap: Record<PokieSymbolId, string> = {
        MEGA_TROPHY: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="4" y="1" width="8" height="2" fill="#0f172a"/>
          <rect x="2" y="2" width="12" height="5" fill="#0f172a"/>
          <rect x="4" y="7" width="8" height="3" fill="#0f172a"/>
          <rect x="6" y="10" width="4" height="2" fill="#0f172a"/>
          <rect x="4" y="12" width="8" height="3" fill="#0f172a"/>
          <rect x="5" y="2" width="6" height="5" fill="#facc15"/>
          <rect x="3" y="3" width="2" height="3" fill="#fde047"/>
          <rect x="11" y="3" width="2" height="3" fill="#d97706"/>
          <rect x="6" y="3" width="2" height="3" fill="#ffffff"/>
          <rect x="5" y="7" width="6" height="2" fill="#f59e0b"/>
          <rect x="7" y="10" width="2" height="2" fill="#facc15"/>
          <rect x="5" y="13" width="6" height="1" fill="#fde047"/>
        </svg>`,
        WILD_STAR: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="6" y="1" width="4" height="3" fill="#0f172a"/>
          <rect x="1" y="5" width="14" height="4" fill="#0f172a"/>
          <rect x="3" y="9" width="10" height="3" fill="#0f172a"/>
          <rect x="2" y="12" width="4" height="3" fill="#0f172a"/>
          <rect x="10" y="12" width="4" height="3" fill="#0f172a"/>
          <rect x="7" y="2" width="2" height="10" fill="#38bdf8"/>
          <rect x="2" y="6" width="12" height="2" fill="#38bdf8"/>
          <rect x="4" y="8" width="8" height="3" fill="#0284c7"/>
          <rect x="3" y="12" width="3" height="2" fill="#38bdf8"/>
          <rect x="10" y="12" width="3" height="2" fill="#38bdf8"/>
          <rect x="6" y="6" width="4" height="3" fill="#fde047"/>
          <rect x="7" y="7" width="2" height="1" fill="#ffffff"/>
        </svg>`,
        DIAMOND_BALL: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="5" y="1" width="6" height="1" fill="#0f172a"/>
          <rect x="3" y="2" width="10" height="12" fill="#0f172a"/>
          <rect x="2" y="4" width="12" height="8" fill="#0f172a"/>
          <rect x="5" y="14" width="6" height="1" fill="#0f172a"/>
          <rect x="5" y="2" width="6" height="12" fill="#ffffff"/>
          <rect x="3" y="4" width="10" height="8" fill="#f8fafc"/>
          <rect x="6" y="6" width="4" height="4" fill="#0f172a"/>
          <rect x="7" y="2" width="2" height="2" fill="#0f172a"/>
          <rect x="3" y="7" width="2" height="2" fill="#0f172a"/>
          <rect x="11" y="7" width="2" height="2" fill="#0f172a"/>
          <rect x="5" y="4" width="2" height="2" fill="#38bdf8"/>
        </svg>`,
        GOLD_BOOT: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="3" y="3" width="5" height="9" fill="#0f172a"/>
          <rect x="2" y="7" width="12" height="6" fill="#0f172a"/>
          <rect x="4" y="4" width="3" height="6" fill="#f97316"/>
          <rect x="3" y="8" width="10" height="3" fill="#fb923c"/>
          <rect x="5" y="8" width="4" height="2" fill="#fde047"/>
          <rect x="3" y="11" width="10" height="1" fill="#ffffff"/>
          <rect x="3" y="13" width="2" height="2" fill="#facc15"/>
          <rect x="7" y="13" width="2" height="2" fill="#facc15"/>
          <rect x="11" y="13" width="2" height="2" fill="#facc15"/>
        </svg>`,
        FIRE_FLAME: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="6" y="1" width="4" height="3" fill="#0f172a"/>
          <rect x="4" y="4" width="8" height="4" fill="#0f172a"/>
          <rect x="2" y="7" width="12" height="6" fill="#0f172a"/>
          <rect x="4" y="13" width="8" height="2" fill="#0f172a"/>
          <rect x="7" y="2" width="2" height="3" fill="#f43f5e"/>
          <rect x="5" y="5" width="6" height="4" fill="#f97316"/>
          <rect x="3" y="8" width="10" height="4" fill="#fb7185"/>
          <rect x="5" y="8" width="6" height="4" fill="#fde047"/>
          <rect x="6" y="10" width="4" height="3" fill="#ffffff"/>
        </svg>`,
        WHISTLE: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="2" y="5" width="12" height="7" fill="#0f172a"/>
          <rect x="3" y="4" width="6" height="9" fill="#0f172a"/>
          <rect x="4" y="5" width="5" height="7" fill="#34d399"/>
          <rect x="9" y="6" width="4" height="4" fill="#10b981"/>
          <rect x="5" y="6" width="3" height="2" fill="#a7f3d0"/>
          <rect x="6" y="8" width="2" height="2" fill="#0f172a"/>
        </svg>`,
        CHERRY_CARD: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="7" y="2" width="5" height="2" fill="#22c55e"/>
          <rect x="5" y="4" width="2" height="4" fill="#16a34a"/>
          <rect x="9" y="4" width="2" height="4" fill="#16a34a"/>
          <rect x="2" y="8" width="6" height="6" fill="#0f172a"/>
          <rect x="8" y="8" width="6" height="6" fill="#0f172a"/>
          <rect x="3" y="9" width="4" height="4" fill="#f43f5e"/>
          <rect x="9" y="9" width="4" height="4" fill="#e11d48"/>
          <rect x="3" y="9" width="2" height="2" fill="#fda4af"/>
          <rect x="9" y="9" width="2" height="2" fill="#fda4af"/>
        </svg>`,
        SCATTER_CROWN: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="1" y="3" width="14" height="11" fill="#0f172a"/>
          <rect x="2" y="4" width="2" height="7" fill="#fde047"/>
          <rect x="7" y="3" width="2" height="8" fill="#fde047"/>
          <rect x="12" y="4" width="2" height="7" fill="#fde047"/>
          <rect x="4" y="7" width="8" height="4" fill="#facc15"/>
          <rect x="2" y="11" width="12" height="2" fill="#d97706"/>
          <rect x="4" y="8" width="2" height="2" fill="#38bdf8"/>
          <rect x="7" y="8" width="2" height="2" fill="#f43f5e"/>
          <rect x="10" y="8" width="2" height="2" fill="#34d399"/>
        </svg>`,
      };

      const tileThemeMap: Record<
        PokieSymbolId,
        { tileBg: string; pillBg: string; pillText: string; shortTag: string; multTag: string }
      > = {
        MEGA_TROPHY: {
          tileBg: 'linear-gradient(180deg, #fef08a 0%, #facc15 100%)',
          pillBg: '#0f172a',
          pillText: '#fde047',
          shortTag: 'GRAND CUP',
          multTag: 'JACKPOT',
        },
        WILD_STAR: {
          tileBg: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 100%)',
          pillBg: '#0f172a',
          pillText: '#38bdf8',
          shortTag: '2X WILD',
          multTag: '40X',
        },
        DIAMOND_BALL: {
          tileBg: 'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%)',
          pillBg: '#0f172a',
          pillText: '#ffffff',
          shortTag: 'GOLD BALL',
          multTag: '20X',
        },
        GOLD_BOOT: {
          tileBg: 'linear-gradient(180deg, #ffedd5 0%, #fb923c 100%)',
          pillBg: '#0f172a',
          pillText: '#fed7aa',
          shortTag: 'STRIKER',
          multTag: '12X',
        },
        FIRE_FLAME: {
          tileBg: 'linear-gradient(180deg, #ffe4e6 0%, #fb7185 100%)',
          pillBg: '#0f172a',
          pillText: '#fecdd3',
          shortTag: 'FLOW FIRE',
          multTag: '6X',
        },
        WHISTLE: {
          tileBg: 'linear-gradient(180deg, #d1fae5 0%, #34d399 100%)',
          pillBg: '#0f172a',
          pillText: '#a7f3d0',
          shortTag: 'WHISTLE',
          multTag: '3X',
        },
        CHERRY_CARD: {
          tileBg: 'linear-gradient(180deg, #fae8ff 0%, #e879f9 100%)',
          pillBg: '#0f172a',
          pillText: '#f5d0fe',
          shortTag: 'CHERRY',
          multTag: '2X/1X',
        },
        SCATTER_CROWN: {
          tileBg: 'linear-gradient(180deg, #fef3c7 0%, #f472b6 100%)',
          pillBg: '#0f172a',
          pillText: '#fde047',
          shortTag: 'CROWN ORB',
          multTag: 'HOLD&SPIN',
        },
      };

      const theme = tileThemeMap[safeId];
      return {
        ...spec,
        svg: svgMap[safeId],
        tileBg: theme.tileBg,
        pillBg: theme.pillBg,
        pillText: theme.pillText,
        shortTag: theme.shortTag,
        multTag: theme.multTag,
      };
    }

    function setPokieMarqueeFast(fast: boolean) {
      const bulbs = document.querySelectorAll('.slot-bulb-dot');
      bulbs.forEach((b) => {
        b.classList.toggle('slot-marquee-bulb-fast', fast);
        b.classList.toggle('slot-marquee-bulb', !fast);
      });
    }

    function highlightActivePaylineBadges(winningLineIds: number[]) {
      const winSet = new Set(winningLineIds);
      for (let id = 1; id <= 5; id++) {
        const leftBadge = document.getElementById(`slotPaylineLeft_${id}`);
        const rightBadge = document.getElementById(`slotPaylineRight_${id}`);
        const isHit = winSet.has(id);
        [leftBadge, rightBadge].forEach((el) => {
          if (!el) return;
          el.classList.toggle('scale-125', isHit);
          el.classList.toggle('ring-2', isHit);
          el.classList.toggle('ring-white', isHit);
          el.classList.toggle('opacity-45', winSet.size > 0 && !isHit);
          el.classList.toggle('opacity-95', winSet.size === 0 || isHit);
        });
      }
    }

    function renderPokieGridDOM(
      grid: string[][],
      winningCells: Set<string> = new Set(),
      spinningReels: [boolean, boolean, boolean] = [false, false, false],
      teaserReel2 = false,
      stoppedReels: [boolean, boolean, boolean] = [false, false, false]
    ) {
      for (let col = 0; col < 3; col++) {
        const reelColEl = document.getElementById(`slotReelCol${col}`);
        if (reelColEl) {
          reelColEl.classList.toggle('slot-reel-spinning', spinningReels[col]);
          reelColEl.classList.toggle('slot-reel-teaser', col === 2 && teaserReel2 && spinningReels[2]);
          reelColEl.classList.toggle('slot-reel-stopped', !spinningReels[col] && stoppedReels[col]);
        }
        for (let row = 0; row < 3; row++) {
          const cellEl = document.getElementById(`slotCell_${col}_${row}`);
          if (!cellEl) continue;
          const symId = grid[col]?.[row] || 'DIAMOND_BALL';
          const vis = getPokieSymbolVisual(symId);
          const isWinner = winningCells.has(`${col}_${row}`);
          const isCenterRow = row === 1;
          cellEl.style.background = isWinner
            ? 'linear-gradient(180deg, #ffffff 0%, #fef08a 45%, #facc15 100%)'
            : vis.tileBg;
          cellEl.style.borderColor = '#0f172a';
          cellEl.className = `slot-symbol-cell relative rounded-2xl border-[2.5px] p-1 sm:p-1.5 flex flex-col items-center justify-center text-center transition-all duration-150 select-none min-h-[58px] sm:min-h-[64px] ${
            isWinner
              ? 'slot-cell-winner z-10'
              : isCenterRow
                ? 'shadow-[0_3px_0_#0f172a] ring-1 ring-amber-300/60'
                : 'shadow-[0_3px_0_#0f172a]'
          }`;
          cellEl.innerHTML = `
            <span class="absolute top-1 right-1 px-1 py-0.2 rounded text-[7px] font-mono-num font-black uppercase tracking-tighter border border-slate-900/30" style="background:${
              isWinner ? '#dc2626' : 'rgba(255,255,255,0.88)'
            };color:${isWinner ? '#ffffff' : '#0f172a'}">${isWinner ? 'WIN!' : vis.multTag}</span>
            <div class="my-0.5 flex items-center justify-center">${vis.svg}</div>
            <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-wider mt-0.5 px-2 py-0.2 rounded-full border border-slate-900 whitespace-nowrap" style="background:${vis.pillBg};color:${vis.pillText}">${vis.shortTag}</span>
          `;
        }
      }
    }

    function syncPokieMachineThemeAndBetUI() {
      const machine = POKIE_MACHINES[selectedPokieMachine] || POKIE_MACHINES.CHAMPIONS_GOLD;
      const cabinetCard = document.getElementById('slotCabinetCard');
      const cabinetHeader = document.getElementById('slotCabinetHeader');
      const cabinetTagline = document.getElementById('slotCabinetTagline');
      const cabinetTitle = document.getElementById('slotCabinetTitle');
      const reelHousing = document.getElementById('slotReelHousing');

      if (cabinetCard) {
        cabinetCard.style.background = machine.cabinetBg;
        cabinetCard.style.borderColor = '#0f172a';
      }
      if (cabinetHeader) {
        cabinetHeader.style.background = machine.headerGradient;
        cabinetHeader.style.borderColor = machine.cabinetBorderHex;
      }
      if (cabinetTagline) {
        cabinetTagline.innerText = `${machine.stadiumName.toUpperCase()} • ${machine.tagline}`;
        cabinetTagline.style.color = machine.accentHex;
      }
      if (cabinetTitle) {
        cabinetTitle.innerText = `${machine.shortName.toUpperCase()} POKIES`;
      }
      if (reelHousing) {
        reelHousing.style.backgroundColor = machine.reelHousingBg;
        reelHousing.style.borderColor = machine.reelBorderHex;
      }

      // Update marquee bulbs with machine-specific stadium colors
      const bulbs = document.querySelectorAll('.slot-bulb-dot') as NodeListOf<HTMLElement>;
      bulbs.forEach((b, idx) => {
        b.style.backgroundColor = machine.bulbColors[idx % machine.bulbColors.length];
      });

      // Highlight active machine card in the 3-machine selector bar
      for (const m of POKIE_MACHINE_LIST) {
        const btn = document.getElementById(`slotMachineBtn_${m.id}`);
        if (!btn) continue;
        const isSelected = m.id === selectedPokieMachine;
        btn.className = isSelected
          ? 'slot-machine-select-btn p-2 rounded-2xl border-[2.5px] border-slate-900 shadow-[0_3px_0_#0f172a] text-left transition-all cursor-pointer relative overflow-hidden scale-[1.02]'
          : 'slot-machine-select-btn p-2 rounded-2xl border-2 border-slate-300 bg-white/85 hover:bg-white text-left transition-all cursor-pointer opacity-80 hover:opacity-100';
        btn.style.background = isSelected ? m.headerGradient : '#ffffff';
        const nameEl = document.getElementById(`slotMachineName_${m.id}`);
        const subEl = document.getElementById(`slotMachineSub_${m.id}`);
        const jpEl = document.getElementById(`slotMachineJackpot_${m.id}`);
        if (nameEl) nameEl.style.color = isSelected ? '#ffffff' : '#0f172a';
        if (subEl) subEl.style.color = isSelected ? m.accentHex : '#64748b';
        if (jpEl) {
          jpEl.style.backgroundColor = isSelected ? m.accentHex : '#f1f5f9';
          jpEl.style.color = '#0f172a';
        }
      }

      // Highlight active bet button ($10 vs $100)
      const bet10Btn = document.getElementById('slotBet10Btn');
      const bet100Btn = document.getElementById('slotBet100Btn');
      if (bet10Btn && bet100Btn) {
        const is10 = selectedPokieBet === 10;
        bet10Btn.className = is10
          ? 'py-1.5 px-3 rounded-xl font-mono-num text-xs font-black bg-amber-300 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer transition-all'
          : 'py-1.5 px-3 rounded-xl font-mono-num text-xs font-extrabold bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer transition-all';
        bet100Btn.className = !is10
          ? 'py-1.5 px-3 rounded-xl font-mono-num text-xs font-black bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer transition-all'
          : 'py-1.5 px-3 rounded-xl font-mono-num text-xs font-extrabold bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer transition-all';
      }

      if (slotSpinBtnLabel && !isSlotSpinning) {
        slotSpinBtnLabel.innerText = `SPIN REELS • $${selectedPokieBet}`;
      }

      // Dynamically update bottom paytable & Hold & Spin guide values for $10 vs $100
      const activeJp = getMachineEffectiveJackpot(
        selectedPokieMachine,
        selectedPokieBet,
        userProfile.machineJackpots[selectedPokieMachine]
      );
      const ptBetBadge = document.getElementById('slotPaytableBetBadge');
      const ptJackpotVal = document.getElementById('slotPtJackpotVal');
      const ptHoldVal = document.getElementById('slotPtHoldVal');
      const ptWildVal = document.getElementById('slotPtWildVal');
      const ptLineVal = document.getElementById('slotPtLineVal');

      if (ptBetBadge) ptBetBadge.innerText = `$${selectedPokieBet} BET`;
      if (ptJackpotVal) ptJackpotVal.innerText = `$${activeJp.toLocaleString()}`;
      if (ptHoldVal) ptHoldVal.innerText = `+$${(selectedPokieBet * 15).toLocaleString()} + 3 RESPINS`;
      if (ptWildVal) ptWildVal.innerText = `2X LINE (3x = $${(selectedPokieBet * 40).toLocaleString()})`;
      if (ptLineVal) ptLineVal.innerText = `$${selectedPokieBet} – $${(selectedPokieBet * 20).toLocaleString()}`;

      syncProfileUI();
    }

    function selectPokieMachine(machineId: PokieMachineId) {
      if (isSlotSpinning || isHoldSpinStepAnimating || activeHoldAndSpinSession) return;
      if (!POKIE_MACHINES[machineId]) return;
      sound.init();
      sound.playUiSelect();
      selectedPokieMachine = machineId;
      syncPokieMachineThemeAndBetUI();
      renderPokieGridDOM(currentPokieGrid);
      const machine = POKIE_MACHINES[machineId];
      if (slotStatusBanner) {
        slotStatusBanner.innerText = `${machine.name.toUpperCase()} READY • SPIN FOR $${selectedPokieBet} OR LAND 3+ ORBS FOR HOLD & SPIN!`;
        slotStatusBanner.className =
          'p-2 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-800 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]';
      }
    }

    function selectPokieBet(betAmount: PokieBetAmount) {
      if (isSlotSpinning || isHoldSpinStepAnimating || activeHoldAndSpinSession) return;
      if (betAmount !== 10 && betAmount !== 100) return;
      sound.init();
      sound.playUiSelect();
      selectedPokieBet = betAmount;
      syncPokieMachineThemeAndBetUI();
      renderPokieGridDOM(currentPokieGrid);
      if (slotStatusBanner) {
        slotStatusBanner.innerText =
          betAmount === 100
            ? '🔥 $100 HIGH-ROLLER STAKES ACTIVE! 10X PAYOUTS & 10X GRAND JACKPOT! 🔥'
            : '⚡ $10 STANDARD SPIN ACTIVE • LAND 3+ CROWN ORBS FOR HOLD & SPIN! ⚡';
        slotStatusBanner.className =
          betAmount === 100
            ? 'p-2 rounded-2xl bg-amber-200 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]'
            : 'p-2 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-800 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]';
      }
    }

    function renderHoldAndSpinDOM(session: HoldAndSpinSessionState, spinningUnlocked = false) {
      const machine = POKIE_MACHINES[session.machineId] || POKIE_MACHINES.CHAMPIONS_GOLD;
      const titleEl = document.getElementById('holdSpinArenaTitle');
      const respinsTextEl = document.getElementById('holdSpinRespinsText');
      const lockedTextEl = document.getElementById('holdSpinLockedText');
      const potTextEl = document.getElementById('holdSpinPotText');
      const grandBannerValEl = document.getElementById('holdSpinGrandTargetVal');

      if (titleEl) {
        titleEl.innerText = `${machine.shortName.toUpperCase()} • HOLD & SPIN`;
      }
      if (respinsTextEl) {
        respinsTextEl.innerText = `${session.respinsRemaining}`;
      }
      for (let d = 1; d <= 3; d++) {
        const dotEl = document.getElementById(`holdSpinLifeDot_${d}`);
        if (dotEl) {
          const active = d <= session.respinsRemaining;
          dotEl.className = active
            ? 'w-3 h-3 rounded-full bg-amber-300 border-2 border-slate-950 shadow-[0_0_8px_#fde047] transition-all scale-110'
            : 'w-3 h-3 rounded-full bg-slate-700 border border-slate-950 opacity-45 transition-all';
        }
      }
      if (lockedTextEl) {
        lockedTextEl.innerText = `${session.lockedCount} / 9 LOCKED`;
      }
      if (potTextEl) {
        potTextEl.innerText = `$${session.totalBonusWin.toLocaleString()}`;
      }
      if (grandBannerValEl) {
        grandBannerValEl.innerText = `$${session.grandJackpotPool.toLocaleString()}`;
      }

      for (let r = 0; r < 3; r++) {
        for (let row = 0; row < 3; row++) {
          const cellEl = document.getElementById(`holdSpinCell_${r}_${row}`);
          if (!cellEl) continue;
          const orb = session.cells[r]?.[row];
          if (orb) {
            const tierBadgeBg =
              orb.tier === 'MEGA'
                ? '#dc2626'
                : orb.tier === 'MAJOR'
                  ? '#9333ea'
                  : orb.tier === 'MINI'
                    ? '#0284c7'
                    : '#0f172a';
            cellEl.style.background = machine.orbGradient;
            cellEl.style.borderColor = machine.orbBorderHex;
            cellEl.className = `rounded-2xl border-[2.5px] p-1.5 flex flex-col items-center justify-center text-center relative select-none min-h-[62px] sm:min-h-[68px] ${
              orb.isNew ? 'hold-orb-locked-new' : 'hold-orb-locked-idle'
            }`;
            cellEl.innerHTML = `
              <span class="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider text-white border border-slate-950" style="background:${tierBadgeBg}">
                ${orb.tier === 'CASH' ? machine.orbName : `${orb.tier} ORB`}
              </span>
              <div class="font-mono-num text-sm sm:text-base font-black text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)] mt-0.5">
                +$${orb.cashValue.toLocaleString()}
              </div>
              <span class="text-[7.5px] font-black uppercase tracking-widest text-slate-900 bg-white/80 px-1.5 rounded border border-slate-900/40 mt-0.5">
                LOCKED
              </span>
            `;
          } else {
            cellEl.style.background = spinningUnlocked
              ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
              : 'rgba(15, 23, 42, 0.78)';
            cellEl.style.borderColor = spinningUnlocked ? machine.accentHex : '#334155';
            cellEl.className = `rounded-2xl border-2 border-dashed p-1.5 flex flex-col items-center justify-center text-center select-none min-h-[62px] sm:min-h-[68px] ${
              spinningUnlocked ? 'slot-reel-spinning' : 'opacity-75'
            }`;
            cellEl.innerHTML = spinningUnlocked
              ? `
                <div class="w-6 h-6 rounded-full border-2 border-amber-300 bg-amber-400/30 animate-ping"></div>
                <span class="text-[8px] font-black uppercase tracking-widest text-amber-300 mt-1">SPINNING</span>
              `
              : `
                <div class="w-5 h-5 rounded-full border border-slate-600 bg-slate-800/80 flex items-center justify-center text-[9px] text-slate-400 font-black">?</div>
                <span class="text-[8px] font-extrabold uppercase tracking-wider text-slate-400 mt-1">OPEN SLOT</span>
              `;
          }
        }
      }

      if (holdSpinActionBtn && holdSpinActionBtnLabel) {
        if (session.isComplete) {
          holdSpinActionBtn.disabled = false;
          holdSpinActionBtn.className =
            'indie-cta-btn w-full min-h-[46px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-emerald-300 hover:from-amber-200 hover:to-emerald-200 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2';
          holdSpinActionBtnLabel.innerText = `COLLECT +$${session.totalBonusWin.toLocaleString()} & RETURN TO REELS`;
        } else {
          holdSpinActionBtn.disabled = isHoldSpinStepAnimating;
          holdSpinActionBtn.className =
            'indie-cta-btn w-full min-h-[46px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2';
          holdSpinActionBtnLabel.innerText = isHoldSpinStepAnimating
            ? 'SPINNING OPEN ORB SLOTS...'
            : `LAUNCH RESPIN (${session.respinsRemaining} ${session.respinsRemaining === 1 ? 'RESPIN' : 'RESPINS'} LEFT)`;
        }
      }
    }

    function triggerHoldAndSpinBonus(triggerPositions?: { reel: number; row: number }[]) {
      sound.init();
      sound.playHoldAndSpinTrigger();
      setPokieMarqueeFast(true);
      const grandPool = getMachineEffectiveJackpot(
        selectedPokieMachine,
        selectedPokieBet,
        userProfile.machineJackpots[selectedPokieMachine]
      );
      activeHoldAndSpinSession = createHoldAndSpinSession({
        machineId: selectedPokieMachine,
        betAmount: selectedPokieBet,
        grandJackpotPool: grandPool,
        triggerPositions,
      });

      if (slotMainGameScreen) slotMainGameScreen.classList.add('hidden');
      if (slotHoldAndSpinScreen) slotHoldAndSpinScreen.classList.remove('hidden');

      renderHoldAndSpinDOM(activeHoldAndSpinSession, false);
      if (holdSpinStatusBanner) {
        holdSpinStatusBanner.innerText = `👑 ${activeHoldAndSpinSession.lockedCount} BONUS ORBS LOCKED! EACH NEW ORB RESETS RESPINS TO 3!`;
        holdSpinStatusBanner.className =
          'p-2 rounded-2xl bg-amber-300 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#000000]';
      }
      return activeHoldAndSpinSession;
    }

    function finishAndCollectHoldAndSpin() {
      if (!activeHoldAndSpinSession) return;
      sound.init();
      const bonusWin = activeHoldAndSpinSession.totalBonusWin;
      const wonGrand = activeHoldAndSpinSession.grandJackpotWon;
      const startBal = userProfile.balance;
      const endBal = startBal + bonusWin;
      userProfile.balance = endBal;
      if (wonGrand) {
        userProfile.machineJackpots[selectedPokieMachine] =
          POKIE_MACHINES[selectedPokieMachine].baseJackpot10;
      }
      saveUserProfileToStorage();
      syncPokieMachineThemeAndBetUI();

      activeHoldAndSpinSession = null;
      isHoldSpinStepAnimating = false;
      setPokieMarqueeFast(false);

      if (slotHoldAndSpinScreen) slotHoldAndSpinScreen.classList.add('hidden');
      if (slotMainGameScreen) slotMainGameScreen.classList.remove('hidden');

      if (slotWinAmountBadge) {
        slotWinAmountBadge.innerText = `+$${bonusWin.toLocaleString()}`;
        slotWinAmountBadge.className =
          'font-mono-num text-sm sm:text-base font-black text-amber-600 animate-bounce mt-0.5';
      }
      if (slotBalanceDeltaBadge) {
        slotBalanceDeltaBadge.innerText = `+$${bonusWin.toLocaleString()}`;
        slotBalanceDeltaBadge.classList.remove('hidden');
      }
      if (slotStatusBanner) {
        slotStatusBanner.innerText = wonGrand
          ? `🏆 9/9 FULL GRID GRAND JACKPOT! +$${bonusWin.toLocaleString()} COLLECTED! 🏆`
          : `👑 HOLD & SPIN COMPLETE! +$${bonusWin.toLocaleString()} ADDED TO BANKROLL! 👑`;
        slotStatusBanner.className =
          'p-2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#0f172a]';
      }

      const slotBalEl = document.getElementById('slotBalanceDisplay');
      const totalSteps = 8;
      let step = 0;
      const collectInterval = setInterval(() => {
        step++;
        sound.playCoinTick(step - 1, totalSteps);
        const curBal =
          step >= totalSteps ? endBal : Math.round(startBal + ((endBal - startBal) * step) / totalSteps);
        if (slotBalEl) slotBalEl.innerText = `$${curBal.toLocaleString()}`;
        if (step >= totalSteps) {
          clearInterval(collectInterval);
        }
      }, 45);
      slotSpinTimeouts.push(collectInterval as unknown as ReturnType<typeof setTimeout>);
    }

    function handleHoldAndSpinRespinStep(forceFillAll = false) {
      if (!activeHoldAndSpinSession || isHoldSpinStepAnimating) return null;
      if (activeHoldAndSpinSession.isComplete) {
        finishAndCollectHoldAndSpin();
        return null;
      }

      sound.init();
      sound.playSlotSpin();
      isHoldSpinStepAnimating = true;
      renderHoldAndSpinDOM(activeHoldAndSpinSession, true);

      if (holdSpinStatusBanner) {
        holdSpinStatusBanner.innerText = '⚡ SPINNING OPEN CELLS FOR GOLDEN BONUS ORBS... ⚡';
        holdSpinStatusBanner.className =
          'p-2 rounded-2xl bg-sky-200 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#000000]';
      }

      const nextState = stepHoldAndSpinSession(activeHoldAndSpinSession, Math.random, forceFillAll);

      if (forceFillAll) {
        // Immediate deterministic update for test hook
        activeHoldAndSpinSession = nextState;
        isHoldSpinStepAnimating = false;
        sound.playHoldAndSpinComplete(nextState.grandJackpotWon);
        renderHoldAndSpinDOM(nextState, false);
        if (holdSpinStatusBanner) {
          holdSpinStatusBanner.innerText = `🏆 FULL 9/9 ORB GRID! GRAND JACKPOT +$${nextState.totalBonusWin.toLocaleString()} WON! 🏆`;
          holdSpinStatusBanner.className =
            'p-2 rounded-2xl bg-amber-300 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#000000] animate-bounce';
        }
        return nextState;
      }

      const stepTimeout = setTimeout(() => {
        activeHoldAndSpinSession = nextState;
        isHoldSpinStepAnimating = false;
        renderHoldAndSpinDOM(nextState, false);

        if (nextState.grandJackpotWon) {
          sound.playHoldAndSpinComplete(true);
          if (holdSpinStatusBanner) {
            holdSpinStatusBanner.innerText = `🏆 9/9 FULL SCREEN! GRAND JACKPOT +$${nextState.totalBonusWin.toLocaleString()} WON! 🏆`;
            holdSpinStatusBanner.className =
              'p-2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#000000]';
          }
        } else if (nextState.isComplete) {
          sound.playHoldAndSpinComplete(false);
          if (holdSpinStatusBanner) {
            holdSpinStatusBanner.innerText = `🎉 BONUS COMPLETE! ${nextState.lockedCount} ORBS LOCKED FOR +$${nextState.totalBonusWin.toLocaleString()}! 🎉`;
            holdSpinStatusBanner.className =
              'p-2 rounded-2xl bg-emerald-300 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#000000]';
          }
        } else if (nextState.lastStepNewOrbs.length > 0) {
          sound.playHoldOrbLock(nextState.lockedCount);
          const addedVal = nextState.lastStepNewOrbs.reduce((s, o) => s + o.cashValue, 0);
          if (holdSpinStatusBanner) {
            holdSpinStatusBanner.innerText = `🔥 +${nextState.lastStepNewOrbs.length} NEW ORB${
              nextState.lastStepNewOrbs.length > 1 ? 'S' : ''
            } LOCKED (+$${addedVal.toLocaleString()})! RESPINS RESET TO 3! 🔥`;
            holdSpinStatusBanner.className =
              'p-2 rounded-2xl bg-amber-300 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#000000]';
          }
        } else {
          sound.playSlotReelStop(1, false);
          if (holdSpinStatusBanner) {
            holdSpinStatusBanner.innerText = `NO NEW ORB • ${nextState.respinsRemaining} ${
              nextState.respinsRemaining === 1 ? 'RESPIN' : 'RESPINS'
            } REMAINING!`;
            holdSpinStatusBanner.className =
              'p-2 rounded-2xl bg-slate-200 border-2 border-slate-950 text-slate-800 font-extrabold text-[11px] uppercase tracking-wide text-center mb-2';
          }
        }
      }, 460);
      slotSpinTimeouts.push(stepTimeout);

      return nextState;
    }

    function openSlotMachineModal() {
      sound.init();
      sound.playUiClick();
      if (editProfileModal && !editProfileModal.classList.contains('hidden')) {
        closeEditProfileModal();
      }
      activeHoldAndSpinSession = null;
      isHoldSpinStepAnimating = false;
      if (slotHoldAndSpinScreen) slotHoldAndSpinScreen.classList.add('hidden');
      if (slotMainGameScreen) slotMainGameScreen.classList.remove('hidden');

      syncPokieMachineThemeAndBetUI();
      highlightActivePaylineBadges([]);
      setPokieMarqueeFast(false);
      renderPokieGridDOM(currentPokieGrid);
      if (slotMachineModal) {
        slotMachineModal.classList.remove('hidden');
      }
    }

    function closeSlotMachineModal() {
      if (activeHoldAndSpinSession && activeHoldAndSpinSession.totalBonusWin > 0) {
        // Ensure any uncollected Hold & Spin winnings are safely credited if closed early
        userProfile.balance += activeHoldAndSpinSession.totalBonusWin;
        saveUserProfileToStorage();
      }
      activeHoldAndSpinSession = null;
      clearSlotTimers();
      setPokieMarqueeFast(false);
      if (slotHoldAndSpinScreen) slotHoldAndSpinScreen.classList.add('hidden');
      if (slotMainGameScreen) slotMainGameScreen.classList.remove('hidden');
      if (slotMachineModal) {
        slotMachineModal.classList.add('hidden');
      }
      if (slotSpinBtn) {
        slotSpinBtn.disabled = false;
      }
      if (slotSpinBtnLabel) {
        slotSpinBtnLabel.innerText = `SPIN REELS • $${selectedPokieBet}`;
      }
      syncProfileUI();
    }

    function handleSpinSlotMachine(forcedStops?: [number, number, number]) {
      sound.init();
      if (isSlotSpinning || activeHoldAndSpinSession) return null;

      userProfile.balance = Number.isFinite(userProfile.balance)
        ? Math.max(0, Math.floor(userProfile.balance))
        : INITIAL_PLAYER_BALANCE;

      const spinCost = selectedPokieBet;

      if (userProfile.balance < spinCost) {
        sound.playUiBack();
        if (slotStatusBanner) {
          slotStatusBanner.innerText =
            spinCost === 100 && userProfile.balance >= 10
              ? 'NEED $100 FOR HIGH-ROLLER SPIN! SWITCH TO $10 BET OR REDEEM COUPON "HACK" IN PROFILE!'
              : `NEED $${spinCost} TO SPIN! PLAY A MATCH OR REDEEM COUPON "HACK" IN PROFILE!`;
          slotStatusBanner.className =
            'p-2 rounded-2xl bg-rose-200 border-2 border-slate-900 text-rose-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#0f172a]';
        }
        return null;
      }

      const balanceBeforeSpin = userProfile.balance;
      const currentMachinePool10 =
        userProfile.machineJackpots[selectedPokieMachine] ||
        POKIE_MACHINES[selectedPokieMachine].baseJackpot10;
      const effectivePoolBefore = getMachineEffectiveJackpot(
        selectedPokieMachine,
        spinCost,
        currentMachinePool10
      );

      const finalResult = spinPokieReels(
        spinCost,
        effectivePoolBefore,
        Math.random,
        forcedStops,
        selectedPokieMachine
      );

      // Deduct spin cost immediately & increment machine's progressive jackpot pool while spinning
      userProfile.balance = Math.max(0, balanceBeforeSpin - spinCost);
      userProfile.machineJackpots[selectedPokieMachine] = Math.round(currentMachinePool10 + 2);
      saveUserProfileToStorage();
      syncPokieMachineThemeAndBetUI();

      isSlotSpinning = true;
      setPokieMarqueeFast(true);
      highlightActivePaylineBadges([]);

      if (slotSpinBtn) {
        slotSpinBtn.disabled = true;
      }
      if (slotSpinBtnLabel) {
        slotSpinBtnLabel.innerText = `SPINNING • $${spinCost}...`;
      }
      if (slotBalanceDeltaBadge) {
        slotBalanceDeltaBadge.classList.add('hidden');
      }
      if (slotWinAmountBadge) {
        slotWinAmountBadge.innerText = '$0';
        slotWinAmountBadge.className = 'font-mono-num text-sm sm:text-base font-black text-slate-500 mt-0.5';
      }
      if (slotStatusBanner) {
        slotStatusBanner.innerText = `⚡ SPINNING ${POKIE_MACHINES[selectedPokieMachine].shortName.toUpperCase()} ($${spinCost} BET)... ⚡`;
        slotStatusBanner.className =
          'p-2 rounded-2xl bg-sky-200 border-2 border-slate-900 text-slate-900 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]';
      }

      sound.playSlotSpin();
      const isTeaser = finalResult.isTeaserTwoReels;

      const spinStart = performance.now();
      const stopReel0Ms = 400;
      const stopReel1Ms = 750;
      const stopReel2Ms = isTeaser ? 1240 : 1020;

      const tickInterval = setInterval(() => {
        const elapsed = performance.now() - spinStart;
        const r0Spin = elapsed < stopReel0Ms;
        const r1Spin = elapsed < stopReel1Ms;
        const r2Spin = elapsed < stopReel2Ms;
        if (!r0Spin && !r1Spin && !r2Spin) {
          clearInterval(tickInterval);
          return;
        }
        const tempStops: [number, number, number] = [
          r0Spin ? Math.floor(Math.random() * VIRTUAL_REEL_STRIPS[0].length) : finalResult.stopIndices[0],
          r1Spin ? Math.floor(Math.random() * VIRTUAL_REEL_STRIPS[1].length) : finalResult.stopIndices[1],
          r2Spin ? Math.floor(Math.random() * VIRTUAL_REEL_STRIPS[2].length) : finalResult.stopIndices[2],
        ];
        const tempGrid = getPokieGridFromStops(tempStops);
        renderPokieGridDOM(
          tempGrid,
          new Set(),
          [r0Spin, r1Spin, r2Spin],
          isTeaser && !r1Spin,
          [!r0Spin, !r1Spin, !r2Spin]
        );
        sound.playSlotReelTick(r0Spin ? 0 : r1Spin ? 1 : 2);
      }, 72);
      slotSpinTimeouts.push(tickInterval as unknown as ReturnType<typeof setTimeout>);

      slotSpinTimeouts.push(
        setTimeout(() => {
          sound.playSlotReelStop(0, false);
        }, stopReel0Ms)
      );

      slotSpinTimeouts.push(
        setTimeout(() => {
          sound.playSlotReelStop(1, isTeaser);
          if (isTeaser && slotStatusBanner) {
            slotStatusBanner.innerText = '🔥 2-REEL TEASER! REEL 3 WINDING UP FOR JACKPOT / HOLD & SPIN... 🔥';
            slotStatusBanner.className =
              'p-2 rounded-2xl bg-amber-300 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a] animate-pulse';
          }
        }, stopReel1Ms)
      );

      slotSpinTimeouts.push(
        setTimeout(() => {
          clearInterval(tickInterval);
          sound.playSlotReelStop(2, false);
          currentPokieGrid = finalResult.grid;
          userProfile.balance = Math.max(0, balanceBeforeSpin - spinCost + finalResult.totalPayout);
          if (finalResult.isJackpot) {
            userProfile.machineJackpots[selectedPokieMachine] =
              POKIE_MACHINES[selectedPokieMachine].baseJackpot10;
          }
          saveUserProfileToStorage();
          syncPokieMachineThemeAndBetUI();

          const winCells = new Set<string>();
          const hitLineIds: number[] = [];
          for (const wl of finalResult.winningLines) {
            hitLineIds.push(wl.lineId);
            for (let colIdx = 0; colIdx < wl.matchCount; colIdx++) {
              winCells.add(`${colIdx}_${wl.rows[colIdx]}`);
            }
          }
          if (finalResult.scatterCount >= 2) {
            for (const sp of finalResult.scatterPositions) {
              winCells.add(`${sp.reel}_${sp.row}`);
            }
          }

          highlightActivePaylineBadges(hitLineIds);
          renderPokieGridDOM(finalResult.grid, winCells, [false, false, false], false, [true, true, true]);

          if (finalResult.totalPayout > 0) {
            sound.playSlotWin(finalResult.winTier === 'NONE' ? 'SMALL' : finalResult.winTier);
            setPokieMarqueeFast(true);
            if (slotBalanceDeltaBadge) {
              slotBalanceDeltaBadge.innerText = `+$${finalResult.totalPayout.toLocaleString()}`;
              slotBalanceDeltaBadge.classList.remove('hidden');
            }
            if (slotWinAmountBadge) {
              slotWinAmountBadge.innerText = `+$${finalResult.totalPayout.toLocaleString()}`;
              slotWinAmountBadge.className =
                finalResult.winTier === 'JACKPOT' || finalResult.winTier === 'MEGA'
                  ? 'font-mono-num text-sm sm:text-base font-black text-amber-600 animate-bounce mt-0.5'
                  : 'font-mono-num text-sm sm:text-base font-black text-emerald-700 mt-0.5';
            }

            const startBal = Math.max(0, balanceBeforeSpin - spinCost);
            const endBal = userProfile.balance;
            const slotBalEl = document.getElementById('slotBalanceDisplay');
            const countSteps = 8;
            let cStep = 0;
            const winCountInterval = setInterval(() => {
              cStep++;
              sound.playCoinTick(cStep - 1, countSteps);
              const curWin =
                cStep >= countSteps
                  ? finalResult.totalPayout
                  : Math.max(1, Math.round((finalResult.totalPayout * cStep) / countSteps));
              const curBal =
                cStep >= countSteps
                  ? endBal
                  : Math.round(startBal + ((endBal - startBal) * cStep) / countSteps);
              if (slotWinAmountBadge) slotWinAmountBadge.innerText = `+$${curWin.toLocaleString()}`;
              if (slotBalEl) slotBalEl.innerText = `$${curBal.toLocaleString()}`;
              if (cStep >= countSteps) {
                clearInterval(winCountInterval);
              }
            }, 46);
            slotSpinTimeouts.push(winCountInterval as unknown as ReturnType<typeof setTimeout>);

            if (slotStatusBanner) {
              const lineSummary =
                finalResult.winningLines.length > 0
                  ? finalResult.winningLines
                      .map((l) => `${l.lineName}${l.hasWildMultiplier ? ' (2X WILD!)' : ''}`)
                      .join(' + ')
                  : finalResult.scatterCount >= 2
                    ? `${finalResult.scatterCount}X BONUS ORBS`
                    : '';
              slotStatusBanner.innerText = lineSummary
                ? `${finalResult.headline} • ${lineSummary}`
                : finalResult.headline;
              slotStatusBanner.className =
                finalResult.winTier === 'JACKPOT' || finalResult.triggersHoldAndSpin
                  ? 'p-2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 border-2 border-slate-900 text-slate-900 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#0f172a]'
                  : 'p-2 rounded-2xl bg-emerald-300 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]';
            }
          } else {
            setPokieMarqueeFast(false);
            if (slotStatusBanner) {
              slotStatusBanner.innerText = finalResult.headline;
              slotStatusBanner.className =
                'p-2 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-700 font-extrabold text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]';
            }
          }

          isSlotSpinning = false;
          if (slotSpinBtn) {
            slotSpinBtn.disabled = false;
          }
          if (slotSpinBtnLabel) {
            slotSpinBtnLabel.innerText = `SPIN REELS • $${selectedPokieBet}`;
          }

          // Transition into the separate HOLD & SPIN screen if 3+ Bonus Orbs landed!
          if (finalResult.triggersHoldAndSpin) {
            const enterBonusTimer = setTimeout(() => {
              triggerHoldAndSpinBonus(finalResult.scatterPositions);
            }, 620);
            slotSpinTimeouts.push(enterBonusTimer);
          }
        }, stopReel2Ms)
      );

      return finalResult;
    }

    for (const m of POKIE_MACHINE_LIST) {
      const mBtn = document.getElementById(`slotMachineBtn_${m.id}`);
      if (mBtn) {
        mBtn.addEventListener('click', () => selectPokieMachine(m.id));
      }
    }
    const slotBet10Btn = document.getElementById('slotBet10Btn');
    const slotBet100Btn = document.getElementById('slotBet100Btn');
    if (slotBet10Btn) {
      slotBet10Btn.addEventListener('click', () => selectPokieBet(10));
    }
    if (slotBet100Btn) {
      slotBet100Btn.addEventListener('click', () => selectPokieBet(100));
    }
    if (holdSpinActionBtn) {
      holdSpinActionBtn.addEventListener('click', () => {
        handleHoldAndSpinRespinStep(false);
      });
    }

    if (openSlotMachineBtn) {
      openSlotMachineBtn.addEventListener('click', openSlotMachineModal);
    }
    if (closeSlotModalBtn) {
      closeSlotModalBtn.addEventListener('click', () => {
        sound.init();
        sound.playUiBack();
        closeSlotMachineModal();
      });
    }
    if (slotSpinBtn) {
      slotSpinBtn.addEventListener('click', () => {
        handleSpinSlotMachine();
      });
    }

    if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
    if (switchToEditProfileBtn) {
      switchToEditProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.init();
        sound.playUiClick();
        switchProfileModalView('edit');
      });
    }
    if (backToProfileOverviewBtn) {
      backToProfileOverviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.init();
        sound.playUiBack();
        switchProfileModalView('overview');
      });
    }
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
      '.mode-btn, .kit-btn, #editProfileBtn, #openSlotMachineBtn, #startBtn, #rematchSameBtn, #mainMenuBtn, #resumeBtn, #forfeitBtn, #howToPlayBtn, .control-tab-btn, #switchToEditProfileBtn, #backToProfileOverviewBtn, #takePhotoBtn, #capturePhotoBtn, #clearPhotoBtn, #saveProfileBtn, #closeProfileModalBtn'
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
      // Ignore global game shortcuts while typing inside the Profile Name or Coupon Code input
      if (document.activeElement === profileNameInput || document.activeElement === couponCodeInput) {
        if (e.code === 'Escape') {
          e.preventDefault();
          closeEditProfileModal();
        } else if (e.code === 'Enter' && document.activeElement === profileNameInput) {
          e.preventDefault();
          handleSaveUserProfile();
        }
        return;
      }

      if (slotMachineModal && !slotMachineModal.classList.contains('hidden')) {
        if (e.code === 'Escape') {
          e.preventDefault();
          closeSlotMachineModal();
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleSpinSlotMachine();
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

    // Global iOS/Phone Audio Unlock & Landscape Orientation Lock Listeners
    const unlockAudioOnGesture = (e: Event) => {
      if (e.type === 'touchstart' || e.type === 'touchend') {
        hasDetectedTouchInput = true;
        tryLockDeviceToLandscape();
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
    const dismissLandscapeLockBtn = document.getElementById('dismissLandscapeLockBtn');
    if (dismissLandscapeLockBtn) {
      dismissLandscapeLockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        landscapeLockDismissed = true;
        tryLockDeviceToLandscape();
        syncLandscapeLockOverlay();
      });
    }
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
      if (e.pointerType === 'mouse' && !isForcedTouchParam) {
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
        ctx.save();
        ctx.globalAlpha = stadiumFlashAlpha * 0.48;
        ctx.fillStyle = stadiumFlashColor || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      if (gameState === 'GOAL_CELEBRATION') {
        // Expressive Unboxed 3D Arcade Goal Splash with Subtle Per-Stadium Goal Aura (Zero Black Box Background!)
        const stadiumGoalFx = getStadiumGoalEffect(selectedPitchTheme);
        ctx.save();
        const elapsed = Math.max(0, 115 - goalBannerTimer);
        const popSpring =
          elapsed < 10
            ? 0.45 + (elapsed / 10) * 0.78
            : elapsed < 20
              ? 1.23 - ((elapsed - 10) / 10) * 0.23
              : 1.0 + Math.sin((elapsed - 20) * 0.16) * 0.032;
        const fadeOut = goalBannerTimer < 16 ? Math.max(0, goalBannerTimer / 16) : 1.0;
        const tilt = Math.sin(elapsed * 0.11) * 0.032;

        const centerX = canvas.width * 0.5;
        const isCompact = canvas.height <= 460;
        const centerY = isCompact ? canvas.height * 0.27 : canvas.height * 0.23;

        ctx.globalAlpha = fadeOut;
        ctx.translate(centerX, centerY);
        ctx.scale(popSpring, popSpring);
        ctx.rotate(tilt);

        // 1. Dynamic Stadium-Tinted Radial Starburst Speed-Rays & Floating 16-Bit Pixel Stars Behind the Text
        const rayCount = 12;
        for (let r = 0; r < rayCount; r++) {
          const ang = (Math.PI * 2 * r) / rayCount + elapsed * 0.022;
          const innerR = isCompact ? 26 : 36;
          const outerR = (isCompact ? 115 : 155) + (r % 2 === 0 ? 28 : -12);
          ctx.save();
          ctx.rotate(ang);
          ctx.globalAlpha = fadeOut * (r % 2 === 0 ? 0.34 : 0.26);
          ctx.fillStyle = r % 2 === 0 ? stadiumGoalFx.shockwaveColors[0] : stadiumGoalFx.shockwaveColors[1];
          ctx.beginPath();
          ctx.moveTo(innerR, -4);
          ctx.lineTo(outerR, -12);
          ctx.lineTo(outerR, 12);
          ctx.lineTo(innerR, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = fadeOut;

        // Orbiting Stadium-Themed 16-Bit Pixel Sparkle Stars
        const starColors = stadiumGoalFx.particleColors;
        for (let s = 0; s < 8; s++) {
          const sAng = (Math.PI * 2 * s) / 8 - elapsed * 0.03;
          const sDistX = (isCompact ? 145 : 210) + Math.sin(elapsed * 0.15 + s) * 18;
          const sDistY = (isCompact ? 42 : 58) + Math.cos(elapsed * 0.15 + s) * 10;
          const sx = Math.cos(sAng) * sDistX;
          const sy = Math.sin(sAng) * sDistY;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);
          ctx.fillStyle = starColors[s % starColors.length];
          ctx.fillRect(Math.round(sx - 4), Math.round(sy - 4), 8, 8);
        }

        // 2. Top Kicker Ribbon Badge (Uses Bespoke Celebration Palette / Stadium Badge Colors)
        const kickerText = activeGoalCelebration.kickerBadge || (goalScorerTeam === 'YOU' ? '⚽ GOAL SCORED' : '⚠️ RIVAL GOAL');
        ctx.font = isCompact ? '900 10.5px "Plus Jakarta Sans", sans-serif' : '900 12.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const kw = ctx.measureText(kickerText).width + 26;
        const kh = isCompact ? 22 : 26;
        const ky = isCompact ? -36 : -48;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-kw / 2 + 3, ky - kh / 2 + 3, kw, kh, 999);
        ctx.fill();
        ctx.fillStyle = activeGoalCelebration.badgeBgColor || (goalScorerTeam === 'YOU' ? '#fde047' : '#fda4af');
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-kw / 2, ky - kh / 2, kw, kh, 999);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = activeGoalCelebration.badgeTextColor || '#0f172a';
        ctx.fillText(kickerText, 0, ky + 0.5);

        // 3. Giant 3D Extruded Arcade Headline (Responsive Font Sizing for Portrait/Landscape & Personalized Slogans)
        const maxBannerW = canvas.width * 0.88;
        const charScale = goalBannerText.length > 20 ? 0.78 : goalBannerText.length > 16 ? 0.88 : 1.0;
        const baseHeadlinePx = isCompact
          ? 30
          : Math.min(52, Math.max(24, Math.floor(canvas.width * 0.052)));
        let headlineFontPx = Math.max(18, Math.round(baseHeadlinePx * charScale));
        ctx.font = `900 ${headlineFontPx}px "Plus Jakarta Sans", sans-serif`;
        const measuredHeadW = ctx.measureText(goalBannerText).width;
        if (measuredHeadW > maxBannerW && measuredHeadW > 0) {
          headlineFontPx = Math.max(16, Math.floor(headlineFontPx * (maxBannerW / measuredHeadW)));
          ctx.font = `900 ${headlineFontPx}px "Plus Jakarta Sans", sans-serif`;
        }
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        // Deep 3D Extruded Block Shadow Layer
        const headStrokeW = Math.max(6, Math.round(headlineFontPx * 0.24));
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = headStrokeW;
        ctx.strokeText(goalBannerText, 4, 6);
        ctx.fillText(goalBannerText, 4, 6);

        // Crisp Main Outline Stroke
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = headStrokeW;
        ctx.strokeText(goalBannerText, 0, 0);

        // Vibrant Vertical Gradient Fill inside Letters
        const textGrad = ctx.createLinearGradient(0, -headlineFontPx * 0.55, 0, headlineFontPx * 0.55);
        textGrad.addColorStop(0, '#ffffff');
        textGrad.addColorStop(0.35, activeGoalCelebration.primaryColor || '#fde047');
        textGrad.addColorStop(1, activeGoalCelebration.secondaryColor || '#f59e0b');
        ctx.fillStyle = textGrad;
        ctx.fillText(goalBannerText, 0, 0);

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

    // Support ?autostart=1 query parameter to skip straight into active gameplay, or ?testRankedWin=1 to verify Ranked Win Progress Bar UI
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pitch') === 'SPACE' || urlParams.get('pitch') === 'COSMIC_SPACE') {
      preferredArenaMode = 'COSMIC_SPACE';
      selectedPitchTheme = 'COSMIC_SPACE';
      applyPitchTheme('COSMIC_SPACE');
      rebuildStaticPitchCache();
    }
    if (urlParams.get('autostart') === '1') {
      const splashEl = document.getElementById('splashScreen');
      if (splashEl) splashEl.classList.add('hidden');
      pickRandomOpponent(false);
      launchMatchNow();
    } else if (urlParams.get('testGoal') === '1') {
      const splashEl = document.getElementById('splashScreen');
      if (splashEl) splashEl.classList.add('hidden');
      pickRandomOpponent(false);
      launchMatchNow();
      ball.kickOriginX = PITCH.width * 0.42;
      ball.kickOriginY = PITCH.height * 0.5;
      ball.x = PITCH.width - 10;
      ball.y = PITCH.height * 0.5;
      handleGoalScored('YOU');
    } else if (urlParams.get('testRankedWin') === '1') {
      const splashEl = document.getElementById('splashScreen');
      if (splashEl) splashEl.classList.add('hidden');
      currentGameMode = 'RANKED';
      pickRandomOpponent(false);
      scoreYou = 3;
      scoreAi = 0;
      endMatch('MERCY RULE +3 VICTORY');
    }

    // Expose deterministic test helper for browser verification
    (window as unknown as Record<string, unknown>).__REMATCH_TEST__ = {
      setPitchTheme(themeId: PitchThemeId) {
        preferredArenaMode = themeId;
        selectedPitchTheme = themeId;
        applyPitchTheme(themeId);
        sound.setPitchTheme(themeId);
        rebuildStaticPitchCache();
      },
      getActiveMusicProfile() {
        return getStadiumMusicProfile(selectedPitchTheme);
      },
      getActiveGoalEffect() {
        return getStadiumGoalEffect(selectedPitchTheme);
      },
      triggerGoal(opts?: {
        scoringTeam?: 'YOU' | 'AI';
        scoreYou?: number;
        scoreAi?: number;
        kickOriginX?: number;
        isLongRange?: boolean;
        isPerfectStrike?: boolean;
        isOneTouch?: boolean;
        wasWallBounce?: boolean;
        spin?: number;
        flowCombo?: number;
        playerName?: string;
        variationIndex?: number;
      }) {
        if (typeof opts?.playerName === 'string' && opts.playerName.trim()) {
          userProfile.name = opts.playerName.trim().slice(0, 16);
          syncUserProfileUI();
        }
        if (typeof opts?.scoreYou === 'number') scoreYou = opts.scoreYou;
        if (typeof opts?.scoreAi === 'number') scoreAi = opts.scoreAi;
        if (typeof opts?.flowCombo === 'number') flowCombo = opts.flowCombo;
        ball.kickOriginX =
          opts?.kickOriginX ??
          (opts?.isLongRange ? PITCH.width * 0.42 : PITCH.width - 240);
        ball.kickOriginY = PITCH.height * 0.5;
        ball.isPerfectStrike = Boolean(opts?.isPerfectStrike);
        ball.isOneTouch = Boolean(opts?.isOneTouch);
        ball.wasWallBounce = Boolean(opts?.wasWallBounce);
        ball.spin = opts?.spin ?? 0;
        ball.x = (opts?.scoringTeam ?? 'YOU') === 'YOU' ? PITCH.width - 8 : 8;
        ball.y = PITCH.height * 0.5;
        handleGoalScored(opts?.scoringTeam ?? 'YOU', opts?.variationIndex, true);
        return activeGoalCelebration;
      },
      openTournamentBracketPreview() {
        const splashEl = document.getElementById('splashScreen');
        if (splashEl) splashEl.classList.add('hidden');
        currentGameMode = 'TOURNAMENT';
        tournamentRound = 0;
        initTournamentBracket();
        pickRandomOpponent(false);
        populatePreMatchVsOverlay();
      },
      redeemCoupon(code: string) {
        return handleRedeemCoupon(code);
      },
      openSlotMachine() {
        const splashEl = document.getElementById('splashScreen');
        if (splashEl) splashEl.classList.add('hidden');
        openSlotMachineModal();
      },
      selectPokieMachine(machineId: PokieMachineId) {
        selectPokieMachine(machineId);
      },
      selectPokieBet(betAmount: PokieBetAmount) {
        selectPokieBet(betAmount);
      },
      spinSlotMachine(forcedStops?: [number, number, number]) {
        return handleSpinSlotMachine(forcedStops);
      },
      triggerHoldAndSpin() {
        return triggerHoldAndSpinBonus();
      },
      stepHoldAndSpin(forceFillAll = false) {
        return handleHoldAndSpinRespinStep(forceFillAll);
      },
      collectHoldAndSpin() {
        finishAndCollectHoldAndSpin();
      },
      getProfileState() {
        return {
          ...userProfile,
          selectedPokieMachine,
          selectedPokieBet,
          activeHoldAndSpinSession,
        };
      },
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(pingInterval);
      clearMatchmakingTimers();
      clearSlotTimers();
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
      {/* Mobile & Tablet Landscape Lock Prompt (Shown when mobile/tablet device is held in portrait) */}
      <div
        id="landscapeLockOverlay"
        className="hidden fixed inset-0 z-[60] bg-slate-950/92 backdrop-blur-md flex-col items-center justify-center p-6 text-center"
      >
        <div className="glass-modal rounded-[28px] max-w-sm w-full p-6 border-3 border-slate-900 shadow-[0_10px_0_#0f172a] flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-300 border-2 border-slate-900 shadow-[0_4px_0_#0f172a] flex items-center justify-center mb-4">
            <svg
              className="w-9 h-9 text-slate-900 animate-phone-rotate"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="2" width="12" height="20" rx="2.5" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-sky-100 border border-sky-400 text-[10px] font-black uppercase tracking-widest text-sky-900 mb-2">
            <span>LANDSCAPE ARENA MODE</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Rotate Device to Landscape
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1.5 mb-5">
            REMATCH <span className="text-amber-500 font-black">0.2</span> is locked to widescreen landscape on mobile &amp; tablet for full-pitch viewing and dual-thumb arcade controls.
          </p>
          <button
            id="dismissLandscapeLockBtn"
            type="button"
            className="btn-clean w-full py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-800 font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Continue Anyway
          </button>
        </div>
      </div>

      {/* Boot-Up Start Page ("PRESS ANY BUTTON TO START") over the clean original stadium background */}
      <div
        id="splashScreen"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-10 bg-slate-950/10 cursor-pointer overflow-hidden"
      >
        <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-5xl px-4">
          <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-3xl bg-sky-400 flex items-center justify-center border-[3px] border-slate-900 shadow-[0_6px_0_#0f172a] mb-3 sm:mb-5">
            <PixelSoccerBallIcon className="w-9 h-9 sm:w-13 sm:h-13" />
          </div>

          <div className="flex flex-nowrap items-baseline justify-center gap-3.5 sm:gap-6 md:gap-8 mb-6 sm:mb-12 whitespace-nowrap">
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight text-white drop-shadow-[0_6px_0_#0f172a]">
              REMATCH
            </span>
            <span className="font-mono-num text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-amber-300 drop-shadow-[0_6px_0_#0f172a]">
              0.2
            </span>
          </div>

          <button
            id="splashStartBtn"
            type="button"
            className="bg-transparent border-0 p-0 text-white font-black text-base sm:text-2xl tracking-[0.22em] uppercase cursor-pointer drop-shadow-[0_3px_0_#0f172a] focus:outline-none"
          >
            <span className="animate-pulse">PRESS ANY BUTTON TO START</span>
          </button>
        </div>
      </div>

      {/* Top Perimeter Indie Sports HUD (Clean, Uncrammed Layout for Mobile Portrait/Landscape, Tablet & Desktop) */}
      <div
        id="hud"
        className="hud-safe-top hidden absolute top-0 left-0 w-full px-2 py-1.5 sm:px-5 md:px-7 md:py-2.5 flex justify-between items-center gap-1.5 sm:gap-3 pointer-events-none z-20"
      >
        {/* Left Slot: Tournament Round Badge (Flow UI removed per user request to keep mobile HUD clean and uncrammed) */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0 z-10 min-w-[36px]">
          <div
            id="flowBadge"
            className="hidden"
            aria-hidden="true"
          >
            <PixelFlameIcon className="w-4 h-4 shrink-0" />
            <div className="hidden" id="passDotsContainer">
              <span id="passDot1" />
              <span id="passDot2" />
              <span id="passDot3" />
            </div>
            <span id="flowVal">FLOW x0</span>
          </div>

          <div
            id="hudTourneyBadge"
            className="hidden glass-pill rounded-xl sm:rounded-2xl px-2 py-1 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/95 whitespace-nowrap"
          >
            CUP 1/3 · QF
          </div>
        </div>

        {/* Center: Indie Arcade Broadcast Scoreboard & Timer (Cleanly Centered, Never Overlapping) */}
        <div className="glass-pill rounded-xl sm:rounded-2xl p-1 sm:p-1.5 flex items-center space-x-1 sm:space-x-2 shrink-0 mx-auto z-10 shadow-[0_3px_0_#0f172a]">
          {/* Player Team (YOU) Pill */}
          <div
            id="hudYouPill"
            className="flex items-center space-x-1 sm:space-x-2 bg-sky-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors"
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
          <div className="bg-slate-900 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl flex items-center justify-center min-w-[42px] sm:min-w-[54px]">
            <span id="timerText" className="font-mono-num text-[10px] sm:text-xs font-black tracking-wider text-amber-300">
              02:00
            </span>
          </div>

          {/* Opponent Team (RIVAL) Pill */}
          <div
            id="hudAiPill"
            className="flex items-center space-x-1 sm:space-x-2 bg-rose-500 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl border-2 border-slate-900 shadow-xs transition-colors"
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
            className="glass-pill btn-clean w-8 h-8 sm:w-auto sm:h-auto sm:min-h-[38px] sm:min-w-[38px] px-0 sm:px-3 rounded-xl sm:rounded-2xl flex items-center justify-center space-x-2 text-slate-800 hover:bg-white cursor-pointer"
            title="Toggle Audio [M]"
          >
            <PixelSoundOnIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
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
            className="glass-pill btn-clean w-8 h-8 sm:w-auto sm:h-auto sm:min-w-[38px] sm:min-h-[38px] rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-800 hover:bg-white cursor-pointer"
            title="Pause Match [P]"
          >
            <PixelPauseIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-800" />
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Touch Controls (Upgraded Neo-Brutalist Arcade Controls for Portrait & Landscape) */}
      <div
        id="mobileControls"
        style={{ display: 'none' }}
        className="mobile-controls-safe hidden fixed bottom-0 left-0 w-full justify-between items-end pointer-events-none z-20"
      >
        {/* Left Thumb: Precision 360° Arcade Analog Thumbstick with Tactile Bezel & Directional Pips */}
        <div
          id="joystickZone"
          aria-label="Virtual Movement Joystick"
          className="touch-joy-zone rounded-full relative flex items-center justify-center pointer-events-auto touch-none transition-opacity"
        >
          <span className="absolute top-1.5 text-[8px] font-black text-white/80 drop-shadow-[0_1px_0_#0f172a] pointer-events-none">▲</span>
          <span className="absolute bottom-1.5 text-[8px] font-black text-white/80 drop-shadow-[0_1px_0_#0f172a] pointer-events-none">▼</span>
          <span className="absolute left-2 text-[8px] font-black text-white/80 drop-shadow-[0_1px_0_#0f172a] pointer-events-none">◀</span>
          <span className="absolute right-2 text-[8px] font-black text-white/80 drop-shadow-[0_1px_0_#0f172a] pointer-events-none">▶</span>
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-white/40 pointer-events-none absolute" />
          <div
            id="joystickKnob"
            className="touch-joy-knob rounded-full transition-transform duration-75 pointer-events-none relative z-10 flex items-center justify-center"
          >
            <div className="w-4 h-4 rounded-full bg-amber-300 border-2 border-slate-900 shadow-inner" />
          </div>
        </div>

        {/* Right Thumb: Ergonomic Dual-Button Arcade Action Cluster */}
        <div className="flex items-end space-x-2.5 sm:space-x-3.5 pointer-events-auto touch-none">
          <button
            id="mobileSwitchBtn"
            type="button"
            aria-label="Send Teammate Run or Switch Defender"
            className="touch-btn-secondary px-2 rounded-full font-black flex flex-col items-center justify-center active:scale-92 active:translate-y-0.5 transition-all mb-0.5 overflow-hidden text-center"
          >
            <span className="w-5 h-5 rounded-full bg-amber-300 border-2 border-slate-900 flex items-center justify-center mb-0.5 shrink-0 shadow-[0_1px_0_#0f172a]">
              <i className="fa-solid fa-bolt text-[10px] text-slate-900" />
            </span>
            <span id="mobileSecondaryText" className="text-[9.5px] sm:text-[10.5px] uppercase tracking-tight leading-[1.05] font-black text-center max-w-full drop-shadow-[0_1px_0_rgba(15,23,42,0.8)]">
              Send Run
            </span>
          </button>
          <button
            id="mobileActionBtn"
            type="button"
            aria-label="Kick, Pass, or Hold for Finesse Shot"
            className="touch-btn-primary px-2 rounded-full font-black flex flex-col items-center justify-center active:scale-92 active:translate-y-1 transition-all mb-2 overflow-hidden text-center"
          >
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 border-2 border-slate-900 flex items-center justify-center mb-0.5 shrink-0 shadow-[0_2px_0_#0f172a]">
              <PixelSoccerBallIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <span id="mobileActionText" className="text-[11px] sm:text-xs uppercase tracking-wider leading-none font-black text-center max-w-full drop-shadow-[0_1px_0_rgba(15,23,42,0.85)]">
              Kick
            </span>
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
                Bronze I
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
                Bronze I
              </div>
            </div>
          </div>

          {/* Tournament Knockout Bracket Tree Visual (Shown before each Tournament Match) */}
          <div
            id="vsTournamentBracketSection"
            className="hidden mt-3.5 pt-3 border-t-2 border-slate-200 text-left"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <i className="fa-solid fa-trophy text-amber-500" />
                <span>8-Club Knockout Cup Bracket Tree</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                QF ──► SF ──► Final
              </span>
            </div>

            {/* Connected Knockout Bracket Tree Diagram */}
            <div className="p-2.5 sm:p-3.5 rounded-2xl bg-slate-100 border-2 border-slate-900 shadow-[0_4px_0_#0f172a] overflow-x-auto">
              <div className="min-w-[540px] grid grid-cols-11 items-center gap-0">
                {/* Column 1 (Cols 1-3): Quarter-Finals (4 Matchups in Upper & Lower Pairs) */}
                <div className="col-span-3 flex flex-col justify-between space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 px-1">
                    Quarter-Finals
                  </div>
                  {/* Upper QF Pair */}
                  <div className="space-y-1.5">
                    <div
                      id="brkMatchCardQf1"
                      className="p-2 rounded-xl bg-amber-300 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-left"
                    >
                      <div className="flex items-center justify-between gap-1.5 text-[10px] font-black text-slate-900">
                        <span id="brkYouNameQf" className="truncate min-w-0">Player</span>
                        <span id="brkScoreQf1" className="px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 font-mono-num text-[8px] shrink-0">NOW</span>
                      </div>
                      <div className="flex items-center justify-between gap-1.5 text-[9.5px] font-bold text-slate-700 mt-0.5">
                        <span id="brkOppNameQf" className="truncate min-w-0">Rival</span>
                        <span className="text-[8px] font-black text-slate-600 shrink-0">QF 1</span>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left">
                      <div className="flex items-center justify-between gap-1.5 text-[9.5px] font-black text-slate-800">
                        <span id="brkB1NameQf" className="truncate min-w-0">Rival B1</span>
                        <span id="brkScoreQf2" className="font-mono-num text-[8px] font-black text-slate-500 shrink-0">QF 2</span>
                      </div>
                      <div className="flex items-center justify-between gap-1.5 text-[9px] font-semibold text-slate-500 mt-0.5">
                        <span id="brkB2NameQf" className="truncate min-w-0">Rival B2</span>
                      </div>
                    </div>
                  </div>

                  {/* Lower QF Pair */}
                  <div className="space-y-1.5 pt-1">
                    <div className="p-1.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left">
                      <div className="flex items-center justify-between gap-1.5 text-[9.5px] font-black text-slate-800">
                        <span id="brkC1NameQf" className="truncate min-w-0">Rival C1</span>
                        <span id="brkScoreQf3" className="font-mono-num text-[8px] font-black text-emerald-700 shrink-0">QF 3</span>
                      </div>
                      <div className="flex items-center justify-between gap-1.5 text-[9px] font-semibold text-slate-500 mt-0.5">
                        <span id="brkC2NameQf" className="truncate min-w-0">Rival C2</span>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left">
                      <div className="flex items-center justify-between gap-1.5 text-[9.5px] font-black text-slate-800">
                        <span id="brkD1NameQf" className="truncate min-w-0">Rival D1</span>
                        <span id="brkScoreQf4" className="font-mono-num text-[8px] font-black text-emerald-700 shrink-0">QF 4</span>
                      </div>
                      <div className="flex items-center justify-between gap-1.5 text-[9px] font-semibold text-slate-500 mt-0.5">
                        <span id="brkD2NameQf" className="truncate min-w-0">Rival D2</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connector Fork 1 (Col 4): Joins QF1+QF2 into SF1 and QF3+QF4 into SF2 */}
                <div className="col-span-1 flex flex-col justify-around h-full py-6 px-0.5 select-none">
                  <div className="flex items-center w-full my-auto">
                    <div className="w-1/2 h-12 border-t-[2.5px] border-b-[2.5px] border-r-[2.5px] border-slate-900 rounded-r-lg" />
                    <div className="w-1/2 h-[2.5px] bg-slate-900" />
                  </div>
                  <div className="flex items-center w-full my-auto pt-4">
                    <div className="w-1/2 h-12 border-t-[2.5px] border-b-[2.5px] border-r-[2.5px] border-slate-900 rounded-r-lg" />
                    <div className="w-1/2 h-[2.5px] bg-slate-900" />
                  </div>
                </div>

                {/* Column 2 (Cols 5-7): Semi-Finals (Upper SF 1 & Lower SF 2) */}
                <div className="col-span-3 flex flex-col justify-around space-y-4">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 px-1">
                    Semi-Finals
                  </div>
                  <div
                    id="brkMatchCardSf1"
                    className="p-2.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-black text-slate-900">
                      <span id="brkYouNameSf" className="truncate min-w-0">Winner QF 1</span>
                      <span id="brkScoreSf1" className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-mono-num text-[8px] shrink-0">SF 1</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold text-slate-600 mt-1">
                      <span id="brkOppNameSf" className="truncate min-w-0">Winner QF 2</span>
                      <span className="text-[8px] font-black text-slate-400 shrink-0">UPPER</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] text-left">
                    <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-black text-slate-800">
                      <span id="brkGfOppNameSf" className="truncate min-w-0">Winner QF 4</span>
                      <span id="brkScoreSf2" className="font-mono-num text-[8px] font-black text-slate-500 shrink-0">SF 2</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold text-slate-500 mt-1">
                      <span id="brkOtherSfName" className="truncate min-w-0">Winner QF 3</span>
                      <span className="text-[8px] font-black text-slate-400 shrink-0">LOWER</span>
                    </div>
                  </div>
                </div>

                {/* Connector Fork 2 (Col 8): Joins SF1 + SF2 into GRAND FINAL */}
                <div className="col-span-1 flex items-center justify-center h-full py-10 px-0.5 select-none">
                  <div className="flex items-center w-full">
                    <div className="w-1/2 h-24 border-t-[2.5px] border-b-[2.5px] border-r-[2.5px] border-slate-900 rounded-r-lg" />
                    <div className="w-1/2 h-[2.5px] bg-slate-900" />
                  </div>
                </div>

                {/* Column 3 (Cols 9-11): Grand Final Championship Node */}
                <div className="col-span-3 flex flex-col justify-center">
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 px-1 mb-1.5 flex items-center space-x-1">
                    <i className="fa-solid fa-crown text-amber-500 text-[10px]" />
                    <span>Grand Final</span>
                  </div>
                  <div
                    id="brkMatchCardGf"
                    className="p-3 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-left"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[11px] font-black text-slate-900">
                      <span id="brkYouNameGf" className="truncate min-w-0">Winner SF 1</span>
                      <span id="brkScoreGf" className="px-2 py-0.5 rounded-full bg-amber-300 border border-slate-900 text-slate-900 font-mono-num text-[8.5px] font-black shrink-0">CUP</span>
                    </div>
                    <div className="my-1.5 flex items-center gap-1.5">
                      <div className="h-[1.5px] flex-1 bg-slate-300" />
                      <span className="text-[9px] font-black text-amber-700">VS</span>
                      <div className="h-[1.5px] flex-1 bg-slate-300" />
                    </div>
                    <div className="flex items-center justify-between gap-1.5 text-[11px] font-black text-slate-800">
                      <span id="brkOppNameGf" className="truncate min-w-0">Winner SF 2</span>
                      <i className="fa-solid fa-trophy text-amber-500 text-xs shrink-0" />
                    </div>
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
              <rect x="5" y="13" width="6" height="1" fill="#fde087" />
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
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-sky-400 border-[3px] border-slate-900 flex items-center justify-center relative overflow-hidden shrink-0"
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
                <span id="tourneyWinRankText">Bronze I · Cup Champion</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5 p-3 rounded-2xl bg-slate-100 border-2 border-slate-900 text-center">
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
            <div
              id="tourneyWinMoneyCard"
              className="col-span-2 sm:col-span-1 bg-gradient-to-b from-amber-200 to-emerald-200 rounded-xl py-1 px-2 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]"
            >
              <div className="text-[9px] font-black uppercase text-slate-900 flex items-center justify-center gap-1">
                <span id="tourneyWinCoinIcon" className="inline-flex">
                  <PixelGoldCoinIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <span>Cup Prize</span>
              </div>
              <div id="tourneyWinMoneyStat" className="font-mono-num text-sm sm:text-base font-black text-emerald-900 mt-0.5">
                +$110
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
          {/* Top Bar: Title Lockup & Clickable Player Profile Card */}
          <div
            id="menuTopBar"
            className="glass-modal rounded-3xl px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2.5 sm:gap-3"
          >
            <div className="flex items-center justify-center space-x-2.5 sm:space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-400 flex items-center justify-center border-2 border-slate-900 shadow-[0_3px_0_#0f172a] shrink-0">
                <PixelSoccerBallIcon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div className="text-left">
                <div
                  id="menuTitleVisible"
                  className="flex items-baseline gap-2.5 sm:gap-3.5 text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 whitespace-nowrap"
                >
                  <span>REMATCH</span>
                  <span className="font-mono-num text-xl sm:text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_2px_0_#0f172a]">
                    0.2
                  </span>
                </div>
              </div>
              <h1 id="menuTitle" className="sr-only">
                REMATCH 0.2
              </h1>
            </div>

            {/* Home Menu Money Display + Clickable Player Profile Card */}
            <div id="menuProfileBar" className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 relative">
              <div
                id="menuWalletBadge"
                title="Club Bankroll (Earned from Matches & Pokies)"
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-gradient-to-b from-amber-200 via-yellow-200 to-amber-300 border-[2.5px] border-slate-900 shadow-[0_3px_0_#0f172a] select-none"
              >
                <PixelGoldCoinIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 coin-bob" />
                <span
                  id="menuBalanceText"
                  className="font-mono-num text-xs sm:text-sm font-black text-slate-900 tracking-tight"
                >
                  $30
                </span>
              </div>

              <button
                id="editProfileBtn"
                type="button"
                aria-label="Open Player Profile & Coupon Vault"
                className="btn-clean group relative flex items-center justify-center gap-2.5 sm:gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-slate-100 hover:bg-white border-[3px] border-amber-600 shadow-[0_3px_0_#0f172a] cursor-pointer transition-all text-left"
              >
                <div
                  id="menuProfileAvatarBox"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-400 border-[2.5px] border-amber-600 overflow-hidden flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                >
                  <img
                    id="menuProfileAvatarImg"
                    alt="Profile Avatar"
                    className="hidden w-full h-full object-cover"
                  />
                  <span
                    id="menuProfileAvatarInitials"
                    className="text-xs sm:text-sm font-black text-slate-900"
                  >
                    PL
                  </span>
                </div>
                <div className="flex flex-col items-start justify-center min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span
                      id="menuProfileNameText"
                      className="text-xs sm:text-sm font-black text-slate-900 max-w-[110px] sm:max-w-[140px] truncate leading-tight"
                    >
                      Player
                    </span>
                    <i className="fa-solid fa-chevron-right text-[9px] text-slate-400 group-hover:text-slate-800 transition-colors" />
                  </div>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span
                      id="menuProfileRankBadge"
                      className="inline-flex items-center px-2 py-0.2 rounded-full border text-[9px] sm:text-[10px] font-black tracking-wide whitespace-nowrap bg-amber-100 text-amber-900 border-amber-700"
                    >
                      Bronze I
                    </span>
                    <span
                      id="profileFirstBootPrompt"
                      className="hidden inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full bg-sky-100 border border-sky-400 text-[9px] font-extrabold text-sky-800 animate-pulse whitespace-nowrap"
                    >
                      <span>✨ Setup</span>
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <p id="menuSubtitle" className="hidden text-slate-600 font-semibold text-xs sm:text-sm mb-1" />

          {/* Main Dashboard Grid (2-Column Horizontal Layout across Landscape Mobile, Tablet & Desktop) */}
          <div id="menuMainGrid" className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-stretch text-left">
            {/* Left Column: Mode & Kit Selection */}
            <div id="menuLeftCol" className="sm:col-span-7 glass-modal rounded-3xl p-4 sm:p-6 flex flex-col justify-between gap-4">
              {/* 1. Game Mode Selector: Casual / Ranked / Tournament */}
              <div id="playlistSelectorWrap">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 px-1">
                  SELECT MATCH MODE
                </div>
                <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 border-2 border-slate-900">
                  <button
                    id="modeBtnCasual"
                    type="button"
                    data-mode="CASUAL"
                    className="mode-btn min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-colors cursor-pointer bg-amber-300 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center"
                  >
                    Casual
                  </button>
                  <button
                    id="modeBtnRanked"
                    type="button"
                    data-mode="RANKED"
                    className="mode-btn min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer text-slate-600 hover:text-slate-900 flex items-center justify-center"
                  >
                    Ranked
                  </button>
                  <button
                    id="modeBtnTourney"
                    type="button"
                    data-mode="TOURNAMENT"
                    className="mode-btn min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer text-slate-600 hover:text-slate-900 flex items-center justify-center"
                  >
                    Tournament
                  </button>
                </div>
              </div>

              {/* 2. Home / Away Kit Selector */}
              <div id="kitSelectorWrap">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 px-1">
                  SELECT TEAM KIT
                </div>
                <div className="grid grid-cols-2 gap-2.5">
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
              className="sm:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
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
                <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border-2 border-slate-900 shadow-[0_3px_0_rgba(15,23,42,0.08)] flex flex-col items-center justify-center text-center min-w-0">
                  <div
                    id="mmYouAvatar"
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-sky-400 border-[3px] border-amber-600 text-slate-900 font-black text-xs flex flex-col items-center justify-center shadow-xs mb-1.5 sm:mb-2 relative overflow-hidden transition-colors shrink-0"
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
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-amber-300 text-slate-900 font-black text-xs flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-colors duration-200"
                >
                  VS
                </div>

                {/* Right Card: RIVAL SLOT */}
                <div
                  id="mmOpponentSlotCard"
                  className="bg-gradient-to-b from-rose-50 to-white rounded-2xl p-3 sm:p-4 border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-center transition-colors duration-200 min-w-0"
                >
                  <div
                    id="mmOpponentAvatar"
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-rose-100/80 border-2 border-dashed border-rose-300 text-rose-500 font-black text-sm flex items-center justify-center mb-1.5 sm:mb-2 relative transition-colors duration-200 shrink-0"
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

          {/* Post-Match Ranked Progression Bar & Rank Promotion UI (Displayed when winning/completing Ranked games) */}
          <div
            id="postMatchRankCard"
            className="hidden mb-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-sky-50 border-[3px] border-amber-600 shadow-[0_4px_0_#0f172a] text-left space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span
                  id="postMatchRankBadge"
                  className="inline-flex items-center px-3 py-0.5 rounded-full border-2 text-xs font-black tracking-wide bg-amber-100 text-amber-900 border-amber-700"
                >
                  Bronze II
                </span>
                <span
                  id="postMatchRankHeadline"
                  className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900"
                >
                  RANK UP! PROMOTED TO BRONZE II
                </span>
              </div>
              <span
                id="postMatchRankWinsPill"
                className="font-mono-num text-[10px] sm:text-xs font-black text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full border border-slate-900 shrink-0"
              >
                +1 WIN (1 TOTAL)
              </span>
            </div>

            {/* Animated Rank Progress Bar */}
            <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden border-2 border-slate-900 p-0.5">
              <div
                id="postMatchRankProgressBar"
                className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 rounded-full transition-all duration-500"
                style={{ width: '29%' }}
              />
            </div>

            {/* 7-Tier Competitive Ladder Checkpoints */}
            <div className="flex items-center justify-between px-1 pt-0.5">
              {['Brz I', 'Brz II', 'Silv I', 'Gold II', 'Plat I', 'Dia I', 'Star'].map((lbl, idx) => (
                <div key={lbl} className="flex flex-col items-center space-y-0.5">
                  <span
                    id={`postMatchTierNode${idx}`}
                    className="w-2.5 h-2.5 rounded-full border border-slate-900 transition-transform duration-300"
                    style={{ backgroundColor: idx <= 1 ? '#d97706' : '#e2e8f0' }}
                  />
                  <span className="text-[8px] sm:text-[9px] font-extrabold text-slate-600">{lbl}</span>
                </div>
              ))}
            </div>

            <div id="postMatchRankSubtext" className="text-[11px] font-bold text-slate-700 text-center pt-0.5">
              Promoted from Bronze I to Bronze II! Win 1 more Ranked match for Silver I.
            </div>
          </div>

          {/* End-of-Match Summary (Includes Match Cash Reward!) */}
          <div
            id="matchStatsRow"
            className="hidden grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3 p-3 rounded-2xl bg-slate-100 border-2 border-slate-900 text-center"
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
            <div
              id="statMoneyCard"
              className="col-span-2 sm:col-span-1 bg-gradient-to-b from-amber-200 via-yellow-200 to-emerald-200 rounded-xl py-1 px-2 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] relative overflow-hidden flex flex-col items-center justify-center"
            >
              <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-900 flex items-center justify-center gap-1 whitespace-nowrap">
                <span id="statMoneyCoinIcon" className="inline-flex">
                  <PixelGoldCoinIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <span>Match Cash</span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5 whitespace-nowrap">
                <div id="statMoneyEarned" className="font-mono-num text-base font-black text-emerald-950 leading-tight">
                  +$20
                </div>
                <span
                  id="statMoneyModeBadge"
                  className="px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 font-mono-num text-[8px] font-black uppercase tracking-tight whitespace-nowrap"
                >
                  1X
                </span>
              </div>
            </div>
          </div>

          {/* Primary Actions — Centered & Well-Proportioned (With Main Menu Pokie Machine Access) */}
          <div id="menuBottomBar" className="glass-modal rounded-3xl p-3.5 sm:p-4 flex flex-col items-center space-y-2">
            <div
              id="menuActionsRow"
              className="w-full flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-3"
            >
              <button
                id="startBtn"
                type="button"
                data-start="true"
                className="indie-cta-btn w-full sm:w-auto sm:min-w-[230px] sm:max-w-[310px] min-h-[46px] sm:min-h-[50px] py-3 sm:py-3.5 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm sm:text-base tracking-wide cursor-pointer flex items-center justify-center space-x-2.5"
              >
                <i id="startBtnIcon" className="fa-solid fa-play text-xs shrink-0" />
                <span id="startBtnText" className="truncate">FIND CASUAL MATCH</span>
              </button>

              <button
                id="openSlotMachineBtn"
                type="button"
                aria-label="Open Pokies Lounge"
                className="indie-cta-btn w-full sm:w-auto sm:min-w-[165px] sm:max-w-[230px] min-h-[46px] sm:min-h-[50px] py-2.5 sm:py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 hover:from-amber-200 hover:to-yellow-200 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2.5"
              >
                <PixelSlotMachineIcon className="w-5 h-5 shrink-0" />
                <span className="truncate">POKIES</span>
              </button>

              <button
                id="rematchSameBtn"
                type="button"
                className="btn-clean hidden w-full sm:w-auto sm:min-w-[175px] sm:max-w-[250px] min-h-[42px] py-2.5 px-5 rounded-2xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-rotate-right text-xs shrink-0" />
                <span id="rematchSameText" className="truncate">Rematch</span>
              </button>

              <button
                id="mainMenuBtn"
                type="button"
                className="btn-clean hidden w-full sm:w-auto sm:min-w-[165px] sm:max-w-[235px] min-h-[42px] py-2.5 px-5 rounded-2xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-house text-xs shrink-0" />
                <span className="truncate">Home Menu</span>
              </button>

              <button
                id="resumeBtn"
                type="button"
                className="indie-cta-btn hidden w-full sm:w-auto sm:min-w-[185px] sm:max-w-[250px] min-h-[44px] py-3 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm sm:text-base tracking-wide cursor-pointer"
              >
                Resume Match
              </button>

              <button
                id="forfeitBtn"
                type="button"
                className="btn-clean hidden w-full sm:w-auto sm:min-w-[165px] sm:max-w-[225px] min-h-[42px] py-2.5 px-5 rounded-2xl bg-rose-500 hover:bg-rose-400 border-2 border-slate-900 text-white font-black text-xs sm:text-sm tracking-wide uppercase cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-house text-xs shrink-0" />
                <span className="truncate">Forfeit Match</span>
              </button>

              <div id="howToPlayWrap" className="flex items-center justify-center w-full sm:w-auto">
                <button
                  id="howToPlayBtn"
                  type="button"
                  className="btn-clean w-full sm:w-auto min-h-[42px] py-2.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-700 font-extrabold text-xs tracking-wide cursor-pointer whitespace-nowrap"
                >
                  How to Play &amp; Controls
                </button>
              </div>
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

      {/* Player Profile Modal (Overview + Coupon Vault + Store Teaser + Edit Profile View) */}
      <div
        id="editProfileModal"
        className="hidden fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div className="glass-modal rounded-[28px] max-w-md w-full p-5 sm:p-6 text-left relative my-auto">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-200">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                CLUB IDENTITY, WALLET &amp; COUPONS
              </div>
              <h2 id="profileModalTitleText" className="text-xl sm:text-2xl font-black text-slate-900">
                Player Profile
              </h2>
            </div>
            <button
              id="closeProfileModalBtn"
              type="button"
              aria-label="Close Profile Modal"
              className="btn-clean w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-black text-base flex items-center justify-center cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* VIEW 1: PROFILE OVERVIEW (Displays Rank, Wallet, Edit Profile, Store Teaser & Bottom Coupon Code Input) */}
          <div id="profileOverviewSection" className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-900 flex items-center space-x-3.5">
              <div
                id="overviewAvatarBox"
                className="w-18 h-18 rounded-2xl bg-sky-400 border-[3.5px] border-amber-600 shadow-[0_4px_0_#0f172a] overflow-hidden relative flex items-center justify-center shrink-0"
              >
                <img
                  id="overviewProfileImg"
                  alt="Player Avatar"
                  className="hidden w-full h-full object-cover"
                />
                <span
                  id="overviewProfileInitials"
                  className="text-2xl font-black text-slate-900"
                >
                  PL
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  CLUB CAPTAIN
                </div>
                <div
                  id="overviewProfileName"
                  className="text-lg sm:text-xl font-black text-slate-900 truncate"
                >
                  Player
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    id="overviewRankBadge"
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full border-2 text-xs font-black tracking-wide bg-amber-100 text-amber-900 border-amber-700"
                  >
                    Bronze I
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 border-slate-900 text-xs font-black tracking-wide bg-emerald-300 text-slate-900">
                    <PixelGoldCoinIcon className="w-3.5 h-3.5 shrink-0" />
                    <span id="overviewBalanceBadge" className="font-mono-num">
                      $30
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Competitive Rank Progression Card */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <i className="fa-solid fa-trophy text-amber-500" />
                  <span>Competitive Rank</span>
                </span>
                <span
                  id="overviewRankedWinsText"
                  className="font-mono-num text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-400"
                >
                  0 Wins
                </span>
              </div>

              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-900">
                <div
                  id="overviewRankProgressBar"
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: '8%' }}
                />
              </div>

              <div id="overviewNextRankText" className="text-[11px] font-bold text-slate-600">
                Win 1 more Ranked match to reach Bronze II
              </div>
            </div>

            {/* Unlaunched Club Store Teaser */}
            <div
              id="clubStoreTeaserCard"
              className="p-3 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-400 text-left flex items-center justify-between opacity-90 select-none"
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-lg leading-none">🛍️</span>
                <div>
                  <div className="text-xs font-black text-slate-800 leading-tight">Club Store</div>
                  <div className="text-[10px] font-bold text-slate-500">Custom Kits &amp; FX — Not Launched Yet</div>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                COMING SOON
              </span>
            </div>

            <button
              id="switchToEditProfileBtn"
              type="button"
              className="indie-cta-btn w-full py-3 px-6 rounded-2xl bg-amber-300 hover:bg-amber-200 text-slate-900 font-black text-xs sm:text-sm tracking-wide uppercase cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-pen-to-square text-xs" />
              <span>Edit Name &amp; Avatar</span>
            </button>

            {/* Coupon Code Redemption Section at the Bottom of Player Profile UI (Extra text only pops up after code entry, resets on close) */}
            <div
              id="profileCouponSection"
              className="p-3.5 rounded-2xl bg-amber-50/90 border-2 border-slate-900 shadow-[0_3px_0_#0f172a]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="couponCodeInput"
                  className="text-[11px] font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5"
                >
                  <i className="fa-solid fa-ticket text-amber-500" />
                  <span>Redeem Promo Coupon</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="couponCodeInput"
                  type="text"
                  maxLength={20}
                  placeholder="Enter coupon code..."
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border-2 border-slate-900 text-slate-900 font-mono-num font-black text-xs uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  id="redeemCouponBtn"
                  type="button"
                  className="btn-clean py-2 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-slate-900 text-slate-900 font-black text-xs uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer shrink-0"
                >
                  Redeem
                </button>
              </div>
              <div id="couponFeedbackText" className="hidden" />
            </div>
          </div>

          {/* VIEW 2: EDIT PROFILE FORM (Name + Camera Photo Capture) */}
          <div id="profileEditSection" className="hidden space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-900 flex flex-col items-center text-center">
              <div
                id="modalProfilePreviewBox"
                className="w-24 h-24 rounded-2xl bg-sky-400 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] overflow-hidden relative flex items-center justify-center mb-3"
              >
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

            <div className="flex items-center gap-2.5">
              <button
                id="backToProfileOverviewBtn"
                type="button"
                className="btn-clean py-3.5 px-4 rounded-2xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-800 font-black text-xs uppercase tracking-wide cursor-pointer"
              >
                Back
              </button>
              <button
                id="saveProfileBtn"
                type="button"
                className="indie-cta-btn flex-1 py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm tracking-wide uppercase cursor-pointer"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* REMATCH POKIES LOUNGE — 3 Stadium Machines, $10/$100 Stakes & Separate Hold & Spin Bonus Screen */}
      <div
        id="slotMachineModal"
        className="hidden fixed inset-0 z-50 bg-slate-950/82 flex items-center justify-center p-2 sm:p-3.5 overflow-y-auto"
      >
        <div
          id="slotCabinetCard"
          className="glass-modal screen-enter rounded-[26px] sm:rounded-[30px] max-w-xl w-full p-3 sm:p-4 text-left relative my-auto border-3 border-slate-900 shadow-[0_10px_0_#0f172a]"
        >
          {/* Top Arcade Marquee Header with Chasing Stadium Floodlight Bulbs */}
          <div
            id="slotCabinetHeader"
            className="p-2.5 rounded-2xl bg-slate-900 border-2 border-amber-400 shadow-[0_4px_0_#0f172a] mb-2 relative overflow-hidden"
          >
            <div id="slotMarqueeBar" className="flex items-center justify-between px-1 mb-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((idx) => (
                <span
                  key={idx}
                  style={{ animationDelay: `${idx * 90}ms` }}
                  className="slot-bulb-dot slot-marquee-bulb w-2 h-2 rounded-full border border-slate-950 bg-amber-300"
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 border-2 border-slate-950 shadow-[0_3px_0_#000000] flex items-center justify-center shrink-0">
                  <PixelSlotMachineIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div
                    id="slotCabinetTagline"
                    className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-amber-300 truncate"
                  >
                    CHAMPIONS CATHEDRAL • ROYAL EMERALD &amp; GOLD ARENA
                  </div>
                  <h2
                    id="slotCabinetTitle"
                    className="text-sm sm:text-lg font-black text-white tracking-tight truncate"
                  >
                    CHAMPIONS GOLD POKIES
                  </h2>
                </div>
              </div>
              <button
                id="closeSlotModalBtn"
                type="button"
                aria-label="Close Pokie Machine"
                className="btn-clean w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-rose-500 border-2 border-slate-950 text-white font-black text-sm flex items-center justify-center cursor-pointer shrink-0 shadow-[0_2px_0_#000000]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* 3-Machine Stadium Selector Bar (Each with Distinct Aesthetic & Progressive Jackpot) */}
          <div id="slotMachineSelectorBar" className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2">
            {POKIE_MACHINE_LIST.map((m) => (
              <button
                key={m.id}
                id={`slotMachineBtn_${m.id}`}
                type="button"
                data-machine-id={m.id}
                className="slot-machine-select-btn p-2 rounded-2xl border-2 border-slate-900 bg-white text-left transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    id={`slotMachineName_${m.id}`}
                    className="text-[9.5px] sm:text-[11px] font-black uppercase tracking-tight truncate"
                  >
                    {m.shortName}
                  </span>
                </div>
                <div
                  id={`slotMachineSub_${m.id}`}
                  className="text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-wider truncate mt-0.5"
                >
                  {m.stadiumName}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[7.5px] font-black uppercase text-amber-400">JACKPOT</span>
                  <span
                    id={`slotMachineJackpot_${m.id}`}
                    className="font-mono-num text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-300 text-slate-950 border border-slate-950"
                  >
                    ${m.baseJackpot10}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Progressive Grand Jackpot, Bankroll, Last Payout & $10 / $100 Bet Selector */}
          <div className="grid grid-cols-12 gap-1.5 sm:gap-2 mb-2 items-stretch">
            <div className="col-span-4 p-1.5 sm:p-2 rounded-2xl bg-gradient-to-b from-amber-200 via-yellow-200 to-amber-300 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-center flex flex-col justify-center">
              <div className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-amber-950">
                🏆 GRAND JACKPOT
              </div>
              <div
                id="slotJackpotDisplay"
                className="font-mono-num text-xs sm:text-base font-black text-slate-900 mt-0.5"
              >
                $500
              </div>
            </div>

            <div className="col-span-4 p-1.5 sm:p-2 rounded-2xl bg-emerald-100 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-center flex flex-col justify-center">
              <div className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-emerald-950 flex items-center justify-center gap-1">
                <PixelGoldCoinIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>BANKROLL</span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span
                  id="slotBalanceDisplay"
                  className="font-mono-num text-xs sm:text-base font-black text-emerald-900"
                >
                  $30
                </span>
                <span
                  id="slotBalanceDeltaBadge"
                  className="hidden font-mono-num text-[8.5px] font-black px-1.5 py-0.2 rounded-full bg-amber-300 border border-slate-900 text-slate-900 animate-bounce"
                >
                  +$20
                </span>
              </div>
            </div>

            <div className="col-span-4 p-1.5 sm:p-2 rounded-2xl bg-sky-100 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-center flex flex-col justify-center">
              <div className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-sky-950">
                ⚡ LAST WIN
              </div>
              <div
                id="slotWinAmountBadge"
                className="font-mono-num text-xs sm:text-base font-black text-slate-600 mt-0.5"
              >
                $0
              </div>
            </div>
          </div>

          {/* Bet Stakes Selector Bar ($10 Standard vs $100 High-Roller) */}
          <div className="flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] mb-2">
            <div className="flex items-center gap-1.5 pl-1">
              <PixelGoldCoinIcon className="w-4 h-4 shrink-0" />
              <div>
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-900 leading-tight">
                  CHOOSE SPIN STAKES
                </div>
                <div className="text-[8px] font-bold text-slate-500 leading-tight">
                  $100 Bet = 10x Line Wins &amp; 10x Jackpot!
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                id="slotBet10Btn"
                type="button"
                className="py-1.5 px-3 rounded-xl font-mono-num text-xs font-black bg-amber-300 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer transition-all"
              >
                $10 SPIN
              </button>
              <button
                id="slotBet100Btn"
                type="button"
                className="py-1.5 px-3 rounded-xl font-mono-num text-xs font-extrabold bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer transition-all"
              >
                $100 SPIN
              </button>
            </div>
          </div>

          {/* =================================================================== */}
          {/* SCREEN MODE 1: MAIN 3x3 5-PAYLINE REEL CABINET                      */}
          {/* =================================================================== */}
          <div id="slotMainGameScreen">
            <div
              id="slotReelHousing"
              className="p-2 sm:p-2.5 rounded-3xl bg-slate-900 border-3 border-amber-400 shadow-[0_4px_0_#0f172a,inset_0_4px_12px_rgba(0,0,0,0.65)] mb-2 relative"
            >
              <div className="flex items-center justify-between text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-amber-300 mb-1.5 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>5 PAYLINES • 3+ CROWN ORBS = HOLD &amp; SPIN</span>
                </span>
                <span id="slotSpinsLeftDisplay" className="text-emerald-300 font-mono-num">
                  3 SPINS READY
                </span>
              </div>

              <div className="flex items-stretch gap-1.5 sm:gap-2">
                {/* Left Payline Anchor Pills */}
                <div className="flex flex-col justify-around py-1 shrink-0 select-none">
                  <span
                    id="slotPaylineLeft_4"
                    title="Payline 4: Diagonal Down"
                    className="px-1.5 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    4↘
                  </span>
                  <span
                    id="slotPaylineLeft_2"
                    title="Payline 2: Top Row"
                    className="px-1.5 py-0.5 rounded-md bg-sky-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    2─
                  </span>
                  <span
                    id="slotPaylineLeft_1"
                    title="Payline 1: Center Row"
                    className="px-1.5 py-0.5 rounded-md bg-amber-300 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    1═
                  </span>
                  <span
                    id="slotPaylineLeft_3"
                    title="Payline 3: Bottom Row"
                    className="px-1.5 py-0.5 rounded-md bg-rose-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    3─
                  </span>
                  <span
                    id="slotPaylineLeft_5"
                    title="Payline 5: Diagonal Up"
                    className="px-1.5 py-0.5 rounded-md bg-fuchsia-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    5↗
                  </span>
                </div>

                {/* 3x3 Reel Window */}
                <div className="flex-1 grid grid-cols-3 gap-1.5 sm:gap-2 bg-slate-950 p-1.5 sm:p-2 rounded-2xl border-2 border-slate-700 overflow-hidden relative">
                  {[0, 1, 2].map((col) => (
                    <div
                      key={col}
                      id={`slotReelCol${col}`}
                      className="flex flex-col gap-1.5 transition-transform duration-100"
                    >
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          id={`slotCell_${col}_${row}`}
                          className="slot-symbol-cell rounded-2xl border-[2.5px] border-slate-900 bg-white p-1 sm:p-1.5 flex flex-col items-center justify-center text-center shadow-[0_3px_0_#0f172a] min-h-[58px] sm:min-h-[64px]"
                        >
                          <span className="text-xl sm:text-2xl leading-none">⚽</span>
                          <span className="text-[8px] sm:text-[9px] font-black uppercase mt-1">GOLD BALL</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Right Payline Anchor Pills */}
                <div className="flex flex-col justify-around py-1 shrink-0 select-none">
                  <span
                    id="slotPaylineRight_5"
                    className="px-1.5 py-0.5 rounded-md bg-fuchsia-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    ↗5
                  </span>
                  <span
                    id="slotPaylineRight_2"
                    className="px-1.5 py-0.5 rounded-md bg-sky-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    ─2
                  </span>
                  <span
                    id="slotPaylineRight_1"
                    className="px-1.5 py-0.5 rounded-md bg-amber-300 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    ═1
                  </span>
                  <span
                    id="slotPaylineRight_3"
                    className="px-1.5 py-0.5 rounded-md bg-rose-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    ─3
                  </span>
                  <span
                    id="slotPaylineRight_4"
                    className="px-1.5 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-mono-num text-[8px] font-black border border-slate-950 transition-all"
                  >
                    ↘4
                  </span>
                </div>
              </div>
            </div>

            {/* Live Pokie Status & Win Callout Banner */}
            <div
              id="slotStatusBanner"
              className="p-2 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-800 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]"
            >
              CHOOSE YOUR MACHINE &amp; BET • LAND 3+ CROWN ORBS FOR HOLD &amp; SPIN!
            </div>

            {/* Primary Arcade Spin Lever Button */}
            <button
              id="slotSpinBtn"
              type="button"
              className="indie-cta-btn w-full min-h-[46px] py-2.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 hover:from-emerald-300 hover:to-sky-300 disabled:opacity-60 text-slate-900 font-black text-sm sm:text-base uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-2.5 mb-2"
            >
              <PixelGoldCoinIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              <span id="slotSpinBtnLabel">SPIN REELS • $10</span>
            </button>

            {/* Clean, Structured Bottom Pokie Guide & Dynamic Paytable Footer */}
            <div
              id="slotPaytableFooter"
              className="p-2.5 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a] space-y-2"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-800">
                  HOW TO WIN &amp; PAYOUT GUIDE
                </span>
                <span
                  id="slotPaytableBetBadge"
                  className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 font-mono-num text-[8.5px] font-black uppercase"
                >
                  $10 BET
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div className="p-1.5 rounded-xl bg-amber-100 border border-slate-900 text-left">
                  <div className="text-[8px] font-black uppercase text-amber-900">🏆 3x GRAND CUP</div>
                  <div id="slotPtJackpotVal" className="font-mono-num text-[10px] font-black text-slate-950 mt-0.5">
                    $500
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-pink-100 border border-slate-900 text-left">
                  <div className="text-[8px] font-black uppercase text-pink-900">👑 3+ CROWN ORBS</div>
                  <div id="slotPtHoldVal" className="font-mono-num text-[9.5px] font-black text-slate-950 mt-0.5">
                    +$150 + 3 RESPINS
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-sky-100 border border-slate-900 text-left">
                  <div className="text-[8px] font-black uppercase text-sky-900">⭐ WILD STAR</div>
                  <div id="slotPtWildVal" className="font-mono-num text-[9.5px] font-black text-slate-950 mt-0.5">
                    2X LINE (3x = $400)
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-emerald-100 border border-slate-900 text-left">
                  <div className="text-[8px] font-black uppercase text-emerald-900">⚽/👟/🔥/🍒 LINES</div>
                  <div id="slotPtLineVal" className="font-mono-num text-[9.5px] font-black text-slate-950 mt-0.5">
                    $10 – $200
                  </div>
                </div>
              </div>

              <div className="text-[9.5px] font-bold text-slate-600 leading-snug bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <strong className="text-slate-900">HOLD &amp; SPIN FEATURE:</strong> Land <strong>3+ Crown Orbs</strong> anywhere to enter the bonus arena with <strong>3 Respins</strong>. Every new Orb locks cash/jackpot prizes and resets respins to 3 — fill all <strong>9/9 slots</strong> to win the <strong>Grand Jackpot</strong>!
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* SCREEN MODE 2: SEPARATE HOLD & SPIN (HOLD & WIN) BONUS ARENA        */}
          {/* =================================================================== */}
          <div id="slotHoldAndSpinScreen" className="hidden">
            <div className="p-2.5 sm:p-3 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950 border-3 border-amber-400 shadow-[0_6px_0_#0f172a] mb-2 text-white">
              {/* Bonus Mode Header & Live Counters */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
                <div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[8.5px] font-black uppercase tracking-widest">
                    <span>👑 SPECIAL BONUS ARENA</span>
                  </div>
                  <h3 id="holdSpinArenaTitle" className="text-sm sm:text-base font-black text-white mt-0.5">
                    CHAMPIONS GOLD • HOLD &amp; SPIN
                  </h3>
                </div>

                {/* 3 Respins Counter & Life Orbs */}
                <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-2xl border-2 border-amber-400">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((d) => (
                      <span
                        key={d}
                        id={`holdSpinLifeDot_${d}`}
                        className="w-3 h-3 rounded-full bg-amber-300 border-2 border-slate-950 shadow-[0_0_8px_#fde047]"
                      />
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-[7.5px] font-black uppercase text-amber-300 leading-none">RESPINS</div>
                    <div id="holdSpinRespinsText" className="font-mono-num text-sm font-black text-white leading-tight">
                      3
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar: Locked Orbs & Total Bonus Pot */}
              <div className="grid grid-cols-3 gap-1.5 mb-2 text-center">
                <div className="p-1.5 rounded-xl bg-slate-800/90 border border-slate-700">
                  <div className="text-[8px] font-black uppercase text-slate-400">LOCKED ORBS</div>
                  <div id="holdSpinLockedText" className="font-mono-num text-xs sm:text-sm font-black text-amber-300">
                    3 / 9 LOCKED
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/60">
                  <div className="text-[8px] font-black uppercase text-emerald-300">BONUS POT</div>
                  <div id="holdSpinPotText" className="font-mono-num text-xs sm:text-sm font-black text-emerald-300">
                    $150
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-400/70">
                  <div className="text-[8px] font-black uppercase text-amber-300">9/9 FULL GRID</div>
                  <div id="holdSpinGrandTargetVal" className="font-mono-num text-xs sm:text-sm font-black text-fde047 text-amber-200">
                    $500
                  </div>
                </div>
              </div>

              {/* 3x3 Hold & Spin Orb Lock Grid */}
              <div id="holdSpinGrid" className="grid grid-cols-3 gap-2 bg-slate-950 p-2 rounded-2xl border-2 border-amber-400/60">
                {[0, 1, 2].map((col) => (
                  <div key={col} className="flex flex-col gap-2">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        id={`holdSpinCell_${col}_${row}`}
                        className="rounded-2xl border-2 border-slate-700 bg-slate-900 p-1.5 flex flex-col items-center justify-center text-center min-h-[62px] sm:min-h-[68px]"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div
              id="holdSpinStatusBanner"
              className="p-2 rounded-2xl bg-amber-300 border-2 border-slate-950 text-slate-950 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#000000]"
            >
              👑 3 BONUS ORBS LOCKED! EACH NEW ORB RESETS RESPINS TO 3!
            </div>

            <button
              id="holdSpinActionBtn"
              type="button"
              className="indie-cta-btn w-full min-h-[46px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
            >
              <PixelGoldCoinIcon className="w-5 h-5 shrink-0" />
              <span id="holdSpinActionBtnLabel">LAUNCH RESPIN (3 RESPINS LEFT)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Isolated 60-144Hz Game Canvas */}
      <canvas id="gameCanvas" ref={canvasRef} data-testid="game-canvas" />
    </div>
  );
}

