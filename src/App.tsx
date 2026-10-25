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
  TOURNAMENT_TIERS,
  TOURNAMENT_TIER_LIST,
  POKIE_SYMBOLS,
  POKIE_PAYLINES,
  VIRTUAL_REEL_STRIPS,
  calculateMatchMoneyReward,
  redeemCouponCode,
  spinPokieReels,
  getPokieGridFromStops,
  createHoldAndSpinSession,
  stepHoldAndSpinSession,
  JACKPOT_CHALLENGE_DURATION_SECONDS,
  createJackpotChallengeState,
  evaluateJackpotChallengeOutcome,
  DEFAULT_UNLOCKED_STADIUMS,
  DEFAULT_UNLOCKED_POKIES,
  SHOP_STADIUM_ITEMS,
  SHOP_POKIE_ITEMS,
  purchaseShopStadium,
  purchaseShopPokieMachine,
  sortLeaderboardEntries,
  computeMatchDifficultyProfile,
  SEEDED_CPU_LEADERBOARD_PROFILES,
  GAME_TITLE,
  FIREBASE_CLOUD_TITLE,
  createDefaultPlayerProfile,
  getPokieMachineSymbolTheme,
  type RankTierInfo,
  type RankSymbolId,
  type PokieMachineId,
  type PokieBetAmount,
  type TournamentTierId,
  type HoldAndSpinSessionState,
  type JackpotChallengeState,
  type JackpotChallengeType,
  type LeaderboardEntry,
  type LeaderboardSortMode,
  type PokieSymbolId,
  type PokieEvaluationResult,
  type GoalCelebrationSpec,
} from './game/rules';
import {
  auth,
  FIREBASE_SERVICE_NAME,
  subscribeToAuthChanges,
  signInWithGoogleForLeaderboard,
  syncProfileToFirestoreLeaderboard,
  deleteProfileFromFirestoreLeaderboard,
  subscribeToOnlineLeaderboard,
} from './firebase';
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

function getRankCrestSvgHtml(rankInfo: RankTierInfo, sizeClass = 'w-4 h-4'): string {
  const { symbolId, borderHex, badgeBgHex, badgeTextHex, divisionNumeral } = rankInfo;
  switch (symbolId) {
    case 'BRONZE_SHIELD_1':
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5V11.5C4 16.8 7.4 20.9 12 22.5C16.6 20.9 20 16.8 20 11.5V5.5L12 2Z" fill="${badgeBgHex}" stroke="#0f172a" stroke-width="2.2"/><path d="M12 4.5L6.5 7V11.3C6.5 15.2 8.9 18.4 12 19.8C15.1 18.4 17.5 15.2 17.5 11.3V7L12 4.5Z" fill="${borderHex}"/><rect x="10.8" y="8" width="2.4" height="7.5" rx="1" fill="#fffbeb"/></svg>`;
    case 'BRONZE_SHIELD_2':
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5V11.5C4 16.8 7.4 20.9 12 22.5C16.6 20.9 20 16.8 20 11.5V5.5L12 2Z" fill="${badgeBgHex}" stroke="#0f172a" stroke-width="2.2"/><path d="M12 4.2L6.2 6.8V11.3C6.2 15.3 8.7 18.6 12 20C15.3 18.6 17.8 15.3 17.8 11.3V6.8L12 4.2Z" fill="${borderHex}"/><rect x="8.6" y="8" width="2.2" height="7.5" rx="0.9" fill="#fffbeb"/><rect x="13.2" y="8" width="2.2" height="7.5" rx="0.9" fill="#fffbeb"/></svg>`;
    case 'SILVER_CREST':
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><polygon points="12,1.8 20.5,6.5 18.5,17.5 12,22.2 5.5,17.5 3.5,6.5" fill="${badgeBgHex}" stroke="#0f172a" stroke-width="2.2"/><polygon points="12,4.4 17.8,7.8 16.3,15.8 12,19.2 7.7,15.8 6.2,7.8" fill="${borderHex}"/><path d="M8 12.5L12 8.5L16 12.5L12 16.5Z" fill="#f8fafc"/></svg>`;
    case 'GOLD_CROWN':
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.8" fill="${badgeBgHex}" stroke="#0f172a" stroke-width="2.2"/><path d="M5.5 16.5L4.5 8.5L9 12L12 6.5L15 12L19.5 8.5L18.5 16.5H5.5Z" fill="#f59e0b" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="14" r="1.4" fill="#fffbeb"/></svg>`;
    case 'PLATINUM_STAR':
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><polygon points="12,1.8 19.5,5.5 21.5,13.5 16.5,20.5 7.5,20.5 2.5,13.5 4.5,5.5" fill="${badgeBgHex}" stroke="#0f172a" stroke-width="2.2"/><polygon points="12,4.5 14.2,9.2 19.3,9.8 15.5,13.3 16.5,18.3 12,15.8 7.5,18.3 8.5,13.3 4.7,9.8 9.8,9.2" fill="${borderHex}" stroke="#0f172a" stroke-width="1.4"/></svg>`;
    case 'DIAMOND_GEM':
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><polygon points="7,3 17,3 22,9.5 12,21.5 2,9.5" fill="${badgeBgHex}" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/><polygon points="8.5,5.5 15.5,5.5 18.8,9.5 12,18.2 5.2,9.5" fill="${borderHex}"/><polygon points="12,6.5 15.5,9.5 12,15.5 8.5,9.5" fill="#e0e7ff"/></svg>`;
    case 'STAR_CHAMPION':
    default:
      return `<svg class="${sizeClass} shrink-0 inline-block" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#fde047" stroke="#0f172a" stroke-width="2.2"/><polygon points="12,2.5 14.9,8.4 21.4,9.3 16.7,13.9 17.8,20.4 12,17.3 6.2,20.4 7.3,13.9 2.6,9.3 9.1,8.4" fill="${borderHex}" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="2.2" fill="#fffbeb"/><title>${divisionNumeral} ${badgeTextHex}</title></svg>`;
  }
}

/**
 * Generates an SVG string of the stadium rendered in the EXACT 1:1 geometric ratio of the real pitch:
 * PITCH.width = 2720, PITCH.height = 1580, cornerChamfer = 86, boxWidth = 540, boxHeight = 880,
 * goalWidth = 380, goalDepth = 96, centerCircle = 152, penaltyArc = 95, 12 mowed turf stripes.
 */
function getTrueRatioStadiumSvgHtml(stadiumId: PitchThemeId): string {
  const theme = PITCH_THEMES.find((t) => t.id === stadiumId) || PITCH_THEMES[0];
  const shopItem = SHOP_STADIUM_ITEMS.find((s) => s.id === stadiumId) || SHOP_STADIUM_ITEMS[0];
  const { turf, apron } = theme;
  const lineHex = turf.chalk || theme.swatchLine || '#ffffff';
  const glowHex = shopItem.accentHex || '#fde047';
  const w = PITCH.width; // 2720
  const h = PITCH.height; // 1580
  const c = PITCH.cornerChamfer; // 86
  const boxW = PITCH.boxWidth; // 540
  const boxH = PITCH.boxHeight; // 880
  const boxTop = (h - boxH) / 2; // 350
  const goalW = PITCH.goalWidth; // 380
  const goalD = PITCH.goalDepth; // 96
  const goalTop = (h - goalW) / 2; // 600
  const stripeW = w / 12;

  let stripesSvg = '';
  for (let i = 0; i < 12; i++) {
    const col = i % 2 === 0 ? turf.stripeLight : turf.stripeDark;
    stripesSvg += `<rect x="${(i * stripeW).toFixed(1)}" y="0" width="${(stripeW + 2).toFixed(1)}" height="${h}" fill="${col}" />`;
  }

  const cagePath = `M ${c} 0 L ${w - c} 0 L ${w} ${c} L ${w} ${h - c} L ${w - c} ${h} L ${c} ${h} L 0 ${h - c} L 0 ${c} Z`;
  const clipId = `pitchClip_${stadiumId}_${Math.random().toString(36).slice(2, 7)}`;

  return `<svg class="w-full h-full block" viewBox="-150 -130 3020 1840" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="${clipId}">
        <path d="${cagePath}" />
      </clipPath>
    </defs>
    <!-- Outer Stadium Concourse Apron -->
    <rect x="-150" y="-130" width="3020" height="1840" rx="64" fill="${apron.base}" />
    <rect x="-105" y="-88" width="2930" height="1756" rx="48" fill="${apron.concourse}" stroke="#0f172a" stroke-width="24" />
    <!-- Top & Bottom Bleacher Banks -->
    <rect x="220" y="-68" width="2280" height="36" rx="10" fill="${apron.bleacherBase}" stroke="#0f172a" stroke-width="14" />
    <rect x="220" y="${h + 32}" width="2280" height="36" rx="10" fill="${apron.bleacherBase}" stroke="#0f172a" stroke-width="14" />
    <!-- Clipped 12-Stripe Turf Field -->
    <g clip-path="url(#${clipId})">
      ${stripesSvg}
    </g>
    <!-- Left & Right Recessed Goal Cages (Exact 96x380 ratio) -->
    <rect x="${-goalD}" y="${goalTop}" width="${goalD}" height="${goalW}" fill="${lineHex}" fill-opacity="0.28" stroke="#0f172a" stroke-width="26" />
    <rect x="${w}" y="${goalTop}" width="${goalD}" height="${goalW}" fill="${lineHex}" fill-opacity="0.28" stroke="#0f172a" stroke-width="26" />
    <!-- Pitch Chalk Lines: Halfway Line, Center Circle (r=152), Penalty Boxes (540x880) & Penalty Arcs -->
    <line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="${lineHex}" stroke-width="22" stroke-opacity="0.9" />
    <circle cx="${w / 2}" cy="${h / 2}" r="152" stroke="${lineHex}" stroke-width="22" stroke-opacity="0.9" />
    <circle cx="${w / 2}" cy="${h / 2}" r="28" fill="${lineHex}" />
    <rect x="0" y="${boxTop}" width="${boxW}" height="${boxH}" stroke="${lineHex}" stroke-width="22" stroke-opacity="0.9" />
    <rect x="${w - boxW}" y="${boxTop}" width="${boxW}" height="${boxH}" stroke="${lineHex}" stroke-width="22" stroke-opacity="0.9" />
    <path d="M ${boxW} ${h / 2 - 95} A 95 95 0 0 1 ${boxW} ${h / 2 + 95}" stroke="${lineHex}" stroke-width="20" stroke-opacity="0.88" />
    <path d="M ${w - boxW} ${h / 2 - 95} A 95 95 0 0 0 ${w - boxW} ${h / 2 + 95}" stroke="${lineHex}" stroke-width="20" stroke-opacity="0.88" />
    <!-- 8-Sided Chamfered Cage Perimeter Wall -->
    <path d="${cagePath}" stroke="#0f172a" stroke-width="34" />
    <path d="${cagePath}" stroke="${lineHex}" stroke-width="16" stroke-opacity="0.95" />
    <!-- 4 Corner Floodlight Pylons -->
    <circle cx="-52" cy="-46" r="38" fill="${glowHex}" stroke="#0f172a" stroke-width="18" />
    <circle cx="${w + 52}" cy="-46" r="38" fill="${glowHex}" stroke="#0f172a" stroke-width="18" />
    <circle cx="-52" cy="${h + 46}" r="38" fill="${glowHex}" stroke="#0f172a" stroke-width="18" />
    <circle cx="${w + 52}" cy="${h + 46}" r="38" fill="${glowHex}" stroke="#0f172a" stroke-width="18" />
  </svg>`;
}

/**
 * Custom TIKI TAKA 0.2 Tactical Passing-Triangle Crest & Extruded Arcade Wordmark Lockup.
 */
function TikiTakaCrestSvg({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer 3D Drop Shadow Hex-Shield */}
      <polygon
        points="32,5 57,15 52,47 32,61 12,47 7,15"
        fill="#0f172a"
      />
      {/* Main Chamfered Tactical Crest Plate */}
      <polygon
        points="32,2 57,12 52,44 32,58 12,44 7,12"
        fill="#0f172a"
        stroke="#0f172a"
        strokeWidth="3"
      />
      <polygon
        points="32,5.5 53.5,14 49,42 32,54 15,42 10.5,14"
        fill="url(#tikiCrestGrad)"
        stroke="#fde047"
        strokeWidth="2.2"
      />
      {/* Mowed Pitch Stripes Inside Crest */}
      <line x1="21" y1="11" x2="21" y2="46" stroke="#0f172a" strokeOpacity="0.22" strokeWidth="4" />
      <line x1="32" y1="8" x2="32" y2="51" stroke="#0f172a" strokeOpacity="0.22" strokeWidth="4" />
      <line x1="43" y1="11" x2="43" y2="46" stroke="#0f172a" strokeOpacity="0.22" strokeWidth="4" />

      {/* Glowing Tiki-Taka One-Touch Passing Triangle Vectors */}
      <polygon
        points="18,37 46,35 32,15"
        fill="rgba(56, 189, 248, 0.22)"
        stroke="#fde047"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line
        x1="18"
        y1="37"
        x2="46"
        y2="35"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeDasharray="3 2"
      />
      {/* Node 1: Left Wing Pass Origin */}
      <circle cx="18" cy="37" r="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2.2" />
      {/* Node 2: Right Wing One-Touch Relay */}
      <circle cx="46" cy="35" r="4.5" fill="#34d399" stroke="#0f172a" strokeWidth="2.2" />
      {/* Apex Node 3: Striker Golden Soccer Ball */}
      <circle cx="32" cy="16" r="7.5" fill="#fde047" stroke="#0f172a" strokeWidth="2.5" />
      <polygon points="32,12.5 35,14.7 33.8,18.2 30.2,18.2 29,14.7" fill="#0f172a" />

      {/* Bottom '3V3 CAGE' Banner Ribbon */}
      <rect x="15" y="43" width="34" height="9" rx="2" fill="#0f172a" stroke="#fde047" strokeWidth="1.5" />
      <circle cx="20" cy="47.5" r="1.5" fill="#38bdf8" />
      <circle cx="32" cy="47.5" r="1.5" fill="#fde047" />
      <circle cx="44" cy="47.5" r="1.5" fill="#34d399" />

      <defs>
        <linearGradient id="tikiCrestGrad" x1="32" y1="5" x2="32" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="55%" stopColor="#047857" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ShopPokiePreviewIllustration({ machineId }: { machineId: PokieMachineId }) {
  const m = POKIE_MACHINES[machineId];

  if (machineId === 'CHAMPIONS_GOLD') {
    // 1. CHAMPIONS CATHEDRAL: Royal Emerald Turf & Brushed Gold Trophy Arch Cabinet
    return (
      <div
        className="w-full h-28 rounded-lg border-[2.5px] border-slate-900 overflow-hidden relative flex flex-col justify-between p-2 shadow-[0_3px_0_#0f172a]"
        style={{ background: 'linear-gradient(180deg, #064e3b 0%, #047857 52%, #022c22 100%)' }}
      >
        {/* Golden Cathedral Arch Marquee */}
        <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-amber-400 border-2 border-slate-950 shadow-[0_2px_0_#000]">
          <span className="text-[7.5px] font-display uppercase tracking-wider text-slate-950">
            🏆 ROYAL STADIUM ARCH
          </span>
          <span className="font-mono-num text-[7.5px] font-bold px-1 rounded bg-slate-950 text-amber-300">
            $10/$100
          </span>
        </div>

        {/* 3x1 Gold-Pillar Reel Window */}
        <div className="my-auto mx-auto w-full max-w-[205px] grid grid-cols-3 gap-1.5 bg-emerald-950 p-1.5 rounded-md border-2 border-amber-400 shadow-[0_3px_0_#000]">
          {[
            { icon: '🏆', label: 'CUP', bg: '#fef08a' },
            { icon: '⚽', label: 'BALL', bg: '#ffffff' },
            { icon: '👑', label: 'ORB', bg: '#fde68a' },
          ].map((cell, idx) => (
            <div
              key={idx}
              className="h-10 rounded border-2 border-slate-950 flex flex-col items-center justify-center leading-none shadow-inner"
              style={{ backgroundColor: cell.bg }}
            >
              <span className="text-sm">{cell.icon}</span>
              <span className="text-[6.5px] font-mono-num font-bold text-slate-900 mt-0.5">{cell.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[7.5px] font-mono-num font-bold text-amber-200 px-0.5">
          <span>PITCH TURF CABINET</span>
          <span className="text-amber-300">JACKPOT $500–$5K</span>
        </div>
      </div>
    );
  }

  if (machineId === 'COSMIC_NEON') {
    // 2. COSMIC ORBIT: Zero-G Sci-Fi Hologram Laser Matrix Cabinet
    return (
      <div
        className="w-full h-28 rounded-lg border-[2.5px] border-slate-900 overflow-hidden relative flex flex-col justify-between p-2 shadow-[0_3px_0_#0f172a]"
        style={{ background: 'radial-gradient(circle at 50% 25%, #311068 0%, #090d24 70%, #030614 100%)' }}
      >
        {/* Sci-Fi Laser Scanbar Top */}
        <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-cyan-400 border-2 border-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.6)]">
          <span className="text-[7.5px] font-display uppercase tracking-wider text-slate-950">
            🪐 ZERO-G HOLO MATRIX
          </span>
          <span className="font-mono-num text-[7.5px] font-bold px-1 rounded bg-slate-950 text-fuchsia-300">
            CYBER
          </span>
        </div>

        {/* Dark Obsidian & Cyan Laser Reels */}
        <div className="my-auto mx-auto w-full max-w-[205px] grid grid-cols-3 gap-1.5 bg-slate-950/95 p-1.5 rounded-md border-2 border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.45)]">
          {[
            { icon: '⚡', label: 'PLASMA', border: '#22d3ee', text: '#67e8f9' },
            { icon: '⭐', label: '2X WILD', border: '#e879f9', text: '#f0abfc' },
            { icon: '👑', label: 'NEBULA', border: '#22d3ee', text: '#fde047' },
          ].map((cell, idx) => (
            <div
              key={idx}
              className="h-10 rounded bg-[#0b132b] border-2 flex flex-col items-center justify-center leading-none"
              style={{ borderColor: cell.border }}
            >
              <span className="text-sm">{cell.icon}</span>
              <span className="text-[6.5px] font-mono-num font-bold mt-0.5" style={{ color: cell.text }}>
                {cell.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[7.5px] font-mono-num font-bold text-cyan-300 px-0.5">
          <span>ORBITAL LASER REELS</span>
          <span className="text-fuchsia-300">JACKPOT $750–$7.5K</span>
        </div>
      </div>
    );
  }

  if (machineId === 'VOLCANO_INFERNO') {
    // 3. MAGMA CALDERA: Jagged Volcanic Basalt & Molten Dragon Forge Cabinet
    return (
      <div
        className="w-full h-28 rounded-lg border-[2.5px] border-slate-900 overflow-hidden relative flex flex-col justify-between p-2 shadow-[0_3px_0_#0f172a]"
        style={{ background: 'linear-gradient(180deg, #450a0a 0%, #9a3412 52%, #1c0704 100%)' }}
      >
        {/* Molten Forge Header */}
        <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500 via-amber-400 to-red-500 border-2 border-slate-950 shadow-[0_2px_0_#000]">
          <span className="text-[7.5px] font-display uppercase tracking-wider text-slate-950">
            🌋 MOLTEN LAVA FORGE
          </span>
          <span className="font-mono-num text-[7.5px] font-bold px-1 rounded bg-slate-950 text-orange-300">
            INFERNO
          </span>
        </div>

        {/* Cracked Obsidian & Magma Reels */}
        <div className="my-auto mx-auto w-full max-w-[205px] grid grid-cols-3 gap-1.5 bg-[#1a0805] p-1.5 rounded-md border-2 border-orange-500 shadow-[0_3px_0_#000]">
          {[
            { icon: '🔥', label: 'MAGMA', bg: '#431407', border: '#f97316', text: '#fdba74' },
            { icon: '🏆', label: 'CALDERA', bg: '#7c2d12', border: '#fde047', text: '#fde047' },
            { icon: '🔥', label: 'EMBER', bg: '#431407', border: '#ef4444', text: '#fca5a5' },
          ].map((cell, idx) => (
            <div
              key={idx}
              className="h-10 rounded border-2 flex flex-col items-center justify-center leading-none"
              style={{ backgroundColor: cell.bg, borderColor: cell.border }}
            >
              <span className="text-sm">{cell.icon}</span>
              <span className="text-[6.5px] font-mono-num font-bold mt-0.5" style={{ color: cell.text }}>
                {cell.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[7.5px] font-mono-num font-bold text-orange-200 px-0.5">
          <span>BASALT EMBER SLOTS</span>
          <span className="text-amber-300">JACKPOT $1K–$10K</span>
        </div>
      </div>
    );
  }

  // 4. HIGH ROLLER VIP VAULT: Art-Deco Diamond Bullion Bank Vault ($1,000 VIP Spins)
  return (
    <div
      className="w-full h-28 rounded-lg border-[2.5px] border-slate-900 overflow-hidden relative flex flex-col justify-between p-2 shadow-[0_3px_0_#0f172a]"
      style={{
        background: 'linear-gradient(135deg, #2e1065 0%, #0f172a 45%, #713f12 100%)',
        borderColor: m.accentHex,
      }}
    >
      {/* 24K Bullion Plaque */}
      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 border-2 border-slate-950 shadow-[0_2px_0_#000]">
        <span className="text-[7.5px] font-display uppercase tracking-wider text-slate-950">
          💎 VIP DIAMOND VAULT
        </span>
        <span className="font-mono-num text-[7.5px] font-bold px-1 rounded bg-purple-950 text-amber-300">
          $1K SPIN
        </span>
      </div>

      {/* Gold Bullion Vault Door Reels */}
      <div className="my-auto mx-auto w-full max-w-[205px] grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-md border-2 border-amber-300 shadow-[0_0_12px_rgba(250,204,21,0.5)]">
        {[
          { icon: '👑', label: 'ROYAL', bg: 'linear-gradient(180deg,#fef08a,#f59e0b)' },
          { icon: '💎', label: '$100K+', bg: 'linear-gradient(180deg,#f5d0fe,#c084fc)' },
          { icon: '🏆', label: 'VIP CUP', bg: 'linear-gradient(180deg,#fef08a,#f59e0b)' },
        ].map((cell, idx) => (
          <div
            key={idx}
            className="h-10 rounded border-2 border-slate-950 flex flex-col items-center justify-center leading-none shadow-inner"
            style={{ background: cell.bg }}
          >
            <span className="text-sm">{cell.icon}</span>
            <span className="text-[6.5px] font-mono-num font-bold text-slate-950 mt-0.5">{cell.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[7.5px] font-mono-num font-bold text-amber-300 px-0.5">
        <span>24K BULLION REELS</span>
        <span className="text-fuchsia-300">JACKPOT $100,000+</span>
      </div>
    </div>
  );
}

function ShopStadiumPreviewIllustration({ stadiumId }: { stadiumId: PitchThemeId }) {
  const theme = PITCH_THEMES.find((t) => t.id === stadiumId) || PITCH_THEMES[0];
  return (
    <div
      className="w-full aspect-[2720/1580] rounded-lg border-2 border-slate-900 overflow-hidden relative shadow-[0_3px_0_#0f172a]"
      style={{ backgroundColor: theme.apron.base }}
      dangerouslySetInnerHTML={{ __html: getTrueRatioStadiumSvgHtml(stadiumId) }}
    />
  );
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
      const v = Math.abs(Math.round(variant)) % 4;

      if (v === 1) {
        // Variant 1: Tall Sculpted Mediterranean Cypress Spire
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.24)';
        cCtx.fillRect(Math.round(tx - p * 3.5), Math.round(ty + p * 4), p * 7, p * 2.5);
        fillPxRect(cCtx, tx - p * 1.5, ty + p * 1, p * 3, p * 4.5, outline, px);
        fillPxRect(cCtx, tx - p * 0.8, ty + p * 1, p * 1.6, p * 3.8, '#5c280a', px);

        fillPxRect(cCtx, tx - p * 3.5, ty - p * 3, p * 7, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 3, ty - p * 6.5, p * 6, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 2, ty - p * 9.5, p * 4, p * 4, outline, px);
        fillPxRect(cCtx, tx - p * 1, ty - p * 11, p * 2, p * 2.5, outline, px);

        fillPxRect(cCtx, tx - p * 2.8, ty - p * 2.5, p * 5.6, p * 3.8, '#065f46', px);
        fillPxRect(cCtx, tx - p * 2.2, ty - p * 6, p * 4.4, p * 4.2, '#0d9488', px);
        fillPxRect(cCtx, tx - p * 1.4, ty - p * 9, p * 2.8, p * 3.5, '#14b8a6', px);
        fillPxRect(cCtx, tx - p * 0.8, ty - p * 10.2, p * 1.4, p * 2, '#5eead4', px);
        return;
      }

      if (v === 2) {
        // Variant 2: Cascading Weeping Willow with Draped Foliage Curtains
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        cCtx.fillRect(Math.round(tx - p * 6), Math.round(ty + p * 4), p * 12, p * 3);
        fillPxRect(cCtx, tx - p * 2, ty, p * 4, p * 5.5, outline, px);
        fillPxRect(cCtx, tx - p * 1, ty - p * 1, p * 2.5, p * 5.5, '#713f12', px);

        fillPxRect(cCtx, tx - p * 6.5, ty - p * 5.5, p * 13, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 5, ty - p * 7.5, p * 10, p * 4, outline, px);
        fillPxRect(cCtx, tx - p * 5.8, ty - p * 5, p * 11.6, p * 4, '#15803d', px);
        fillPxRect(cCtx, tx - p * 4.2, ty - p * 7, p * 8.4, p * 3.2, '#4ade80', px);
        fillPxRect(cCtx, tx - p * 2.5, ty - p * 7.2, p * 5, p * 1.8, '#bef264', px);

        // Hanging willow vine curtains
        for (let vx = -5; vx <= 5; vx += 2) {
          const dropH = (Math.abs(vx) % 3 === 1 ? 4.5 : 3.5) * p;
          fillPxRect(cCtx, tx + vx * p - p * 0.6, ty - p * 2, p * 1.4, dropH, outline, px);
          fillPxRect(cCtx, tx + vx * p - p * 0.3, ty - p * 2, p * 0.9, dropH - p * 0.5, '#84cc16', px);
        }
        return;
      }

      if (v === 3) {
        // Variant 3: Blooming Lavender/Gold Jacaranda Ornamental Park Tree
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        cCtx.fillRect(Math.round(tx - p * 5.5), Math.round(ty + p * 4), p * 11, p * 3);
        fillPxRect(cCtx, tx - p * 2, ty + p * 0.5, p * 4, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 1, ty + p * 0.5, p * 2, p * 4.2, '#5c280a', px);

        fillPxRect(cCtx, tx - p * 5.5, ty - p * 4.5, p * 11, p * 6, outline, px);
        fillPxRect(cCtx, tx - p * 4, ty - p * 7, p * 8, p * 4, outline, px);
        fillPxRect(cCtx, tx - p * 4.8, ty - p * 4, p * 9.6, p * 4.8, '#6d28d9', px);
        fillPxRect(cCtx, tx - p * 3.5, ty - p * 6.2, p * 7, p * 4.2, '#a855f7', px);
        fillPxRect(cCtx, tx - p * 2, ty - p * 6.5, p * 4, p * 2.2, '#e9d5ff', px);
        fillPxRect(cCtx, tx - p * 3.5, ty - p * 2.5, p * 1.5, p * 1.5, '#fde047', px);
        fillPxRect(cCtx, tx + p * 2, ty - p * 3.5, p * 1.5, p * 1.5, '#fde047', px);
        return;
      }

      // Variant 0: Asymmetric Multi-Lobe Royal Oak
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      cCtx.fillRect(Math.round(tx - p * 6), Math.round(ty + p * 4), p * 12, p * 3);
      fillPxRect(cCtx, tx - p * 2.2, ty + p * 0.5, p * 4.4, p * 5, outline, px);
      fillPxRect(cCtx, tx - p * 1.2, ty + p * 0.5, p * 2.4, p * 4.2, '#78350f', px);

      // Left & Right asymmetric canopy lobes + top crown
      fillPxRect(cCtx, tx - p * 6, ty - p * 4, p * 7, p * 5.5, outline, px);
      fillPxRect(cCtx, tx - p * 1, ty - p * 4.5, p * 7, p * 6, outline, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 7.5, p * 8, p * 5, outline, px);

      fillPxRect(cCtx, tx - p * 5.2, ty - p * 3.2, p * 5.8, p * 4.2, '#15803d', px);
      fillPxRect(cCtx, tx - p * 0.4, ty - p * 3.8, p * 5.6, p * 4.6, '#166534', px);
      fillPxRect(cCtx, tx - p * 3.4, ty - p * 6.8, p * 6.8, p * 4.2, '#22c55e', px);
      fillPxRect(cCtx, tx - p * 2.2, ty - p * 6.6, p * 4, p * 2.2, '#86efac', px);
      fillPxRect(cCtx, tx - p * 4.4, ty - p * 3.8, p * 2.5, p * 1.8, '#4ade80', px);
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

      cCtx.fillStyle = 'rgba(15, 23, 42, 0.26)';
      cCtx.fillRect(fx - 26, fy + 24, 56, 16);

      fillPxRect(cCtx, fx - 28, fy - 28, 56, 56, outline, px);
      fillPxRect(cCtx, fx - 24, fy - 24, 48, 48, '#475569', px);
      fillPxRect(cCtx, fx - 18, fy - 18, 36, 36, '#64748b', px);

      const bankX = fx + dirX * 8;
      const bankY = fy + dirY * 8;
      fillPxRect(cCtx, bankX - 22, bankY - 16, 44, 32, outline, px);
      fillPxRect(cCtx, bankX - 18, bankY - 12, 36, 24, '#1e293b', px);

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
      const v = Math.abs(Math.round(variant)) % 4;

      if (v === 1) {
        // Tall Golden Ginkgo Spire
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.24)';
        cCtx.fillRect(Math.round(tx - p * 4), Math.round(ty + p * 4), p * 8, p * 2.5);
        fillPxRect(cCtx, tx - p * 1.5, ty + p * 0.5, p * 3, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 0.8, ty + p * 0.5, p * 1.6, p * 4.2, '#5c280a', px);
        fillPxRect(cCtx, tx - p * 3.8, ty - p * 3.5, p * 7.6, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 3, ty - p * 7, p * 6, p * 5, outline, px);
        fillPxRect(cCtx, tx - p * 1.8, ty - p * 10, p * 3.6, p * 4, outline, px);
        fillPxRect(cCtx, tx - p * 3.2, ty - p * 3, p * 6.4, p * 4, '#b45309', px);
        fillPxRect(cCtx, tx - p * 2.4, ty - p * 6.5, p * 4.8, p * 4, '#f59e0b', px);
        fillPxRect(cCtx, tx - p * 1.2, ty - p * 9.4, p * 2.4, p * 3.4, '#fde047', px);
        return;
      }

      if (v === 2) {
        // White-Bark Silver Birch with Amber Canopy & Fallen Leaf Scatter
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        cCtx.fillRect(Math.round(tx - p * 5), Math.round(ty + p * 4), p * 10, p * 3);
        fillPxRect(cCtx, tx - p * 1.6, ty - p * 0.5, p * 3.2, p * 6, outline, px);
        fillPxRect(cCtx, tx - p * 0.9, ty - p * 0.5, p * 1.8, p * 5.2, '#f1f5f9', px);
        fillPxRect(cCtx, tx - p * 0.9, ty + p * 1.2, p * 1.2, p * 0.6, '#334155', px);
        fillPxRect(cCtx, tx - p * 0.3, ty + p * 2.8, p * 1.2, p * 0.6, '#334155', px);

        fillPxRect(cCtx, tx - p * 5, ty - p * 5.5, p * 10, p * 6, outline, px);
        fillPxRect(cCtx, tx - p * 3.5, ty - p * 8, p * 7, p * 4, outline, px);
        fillPxRect(cCtx, tx - p * 4.2, ty - p * 4.8, p * 8.4, p * 4.6, '#ea580c', px);
        fillPxRect(cCtx, tx - p * 2.8, ty - p * 7.2, p * 5.6, p * 3.4, '#fb923c', px);
        fillPxRect(cCtx, tx - p * 1.8, ty - p * 7.2, p * 3.2, p * 1.8, '#fef08a', px);
        return;
      }

      const pal =
        v === 0
          ? { dark: '#991b1b', mid: '#dc2626', light: '#fca5a5' }
          : { dark: '#9a3412', mid: '#ea580c', light: '#fde047' };

      cCtx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      cCtx.fillRect(Math.round(tx - p * 5.5), Math.round(ty + p * 4), p * 11, p * 3);
      fillPxRect(cCtx, tx - p * 2, ty + p * 1, p * 4, p * 5, outline, px);
      fillPxRect(cCtx, tx - p * 1, ty + p * 1, p * 2, p * 4, '#5c280a', px);

      fillPxRect(cCtx, tx - p * 6, ty - p * 4, p * 12, p * 6, outline, px);
      fillPxRect(cCtx, tx - p * 4.5, ty - p * 6.5, p * 9, p * 8, outline, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 7.8, p * 6, p * 3, outline, px);

      fillPxRect(cCtx, tx - p * 5, ty - p * 3, p * 10, p * 4, pal.dark, px);
      fillPxRect(cCtx, tx - p * 4, ty - p * 5.5, p * 8, p * 4, pal.mid, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 6.8, p * 6, p * 3, pal.mid, px);
      fillPxRect(cCtx, tx - p * 2, ty - p * 6.8, p * 4, p * 2, pal.light, px);
      fillPxRect(cCtx, tx - p * 4.5, ty + p * 4.2, p * 2, p * 1, pal.mid, px);
      fillPxRect(cCtx, tx + p * 2.5, ty + p * 4.5, p * 2, p * 1, '#facc15', px);
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
      const v = Math.abs(Math.round(variant)) % 4;

      if (v === 1) {
        // Variant 1: Arashiyama Segmented Emerald Bamboo Cluster
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        cCtx.fillRect(Math.round(tx - p * 4.5), Math.round(ty + p * 3.5), p * 9, p * 2.5);
        for (const stalk of [
          { dx: -2.4, h: 10.5, col: '#15803d' },
          { dx: 0, h: 12.2, col: '#22c55e' },
          { dx: 2.4, h: 9.6, col: '#16a34a' },
        ]) {
          const sx = tx + stalk.dx * p;
          const sh = stalk.h * p;
          fillPxRect(cCtx, sx - p * 1.1, ty + p * 4 - sh, p * 2.2, sh, outline, px);
          fillPxRect(cCtx, sx - p * 0.6, ty + p * 4 - sh + p * 0.5, p * 1.2, sh - p, stalk.col, px);
          for (let nodeY = ty + p * 2; nodeY > ty + p * 4 - sh + p * 2; nodeY -= p * 2.6) {
            fillPxRect(cCtx, sx - p * 1.1, nodeY, p * 2.2, p * 0.5, '#bbf7d0', px);
          }
          // Bamboo leaf tufts at top
          fillPxRect(cCtx, sx - p * 2.6, ty + p * 3.5 - sh, p * 5.2, p * 2.2, outline, px);
          fillPxRect(cCtx, sx - p * 2.1, ty + p * 3.8 - sh, p * 4.2, p * 1.5, '#4ade80', px);
        }
        return;
      }

      if (v === 2) {
        // Variant 2: Sculpted Japanese Cloud-Pruned Niwaki Pine
        cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        cCtx.fillRect(Math.round(tx - p * 5), Math.round(ty + p * 3.5), p * 10, p * 2.5);
        fillPxRect(cCtx, tx - p * 1.8, ty - p * 2, p * 3.2, p * 6, outline, px);
        fillPxRect(cCtx, tx - p * 1, ty - p * 2, p * 1.8, p * 5.5, '#5c280a', px);
        for (const pad of [
          { dx: -3.5, dy: -2.2, w: 5.2, h: 2.6, c: '#0f766e' },
          { dx: 1.5, dy: -3.4, w: 5.2, h: 2.6, c: '#115e59' },
          { dx: -1.5, dy: -6.2, w: 6.4, h: 3.0, c: '#14b8a6' },
        ]) {
          fillPxRect(cCtx, tx + pad.dx * p - p * 0.6, ty + pad.dy * p - p * 0.6, (pad.w + 1.2) * p, (pad.h + 1.2) * p, outline, px);
          fillPxRect(cCtx, tx + pad.dx * p, ty + pad.dy * p, pad.w * p, pad.h * p, pad.c, px);
          fillPxRect(cCtx, tx + (pad.dx + 0.8) * p, ty + pad.dy * p, (pad.w - 1.6) * p, p * 0.9, '#5eead4', px);
        }
        return;
      }

      const darkPink = v === 0 ? '#db2777' : '#e11d48';
      const midPink = v === 0 ? '#f472b6' : '#fb7185';
      const lightPink = v === 0 ? '#fce7f3' : '#ffe4e6';

      cCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      cCtx.fillRect(Math.round(tx - p * 6), Math.round(ty + p * 4), p * 12, p * 3);

      // Gnarled curving cherry trunk
      fillPxRect(cCtx, tx - p * 2.2, ty + p * 0.5, p * 4.4, p * 5, outline, px);
      fillPxRect(cCtx, tx - p * 1.2, ty + p * 0.5, p * 2.4, p * 4.2, '#4a1d1f', px);

      fillPxRect(cCtx, tx - p * 6, ty - p * 4.2, p * 12, p * 6, outline, px);
      fillPxRect(cCtx, tx - p * 4.5, ty - p * 6.8, p * 9, p * 8, outline, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 8, p * 6, p * 3, outline, px);

      fillPxRect(cCtx, tx - p * 5.2, ty - p * 3.2, p * 10.4, p * 4, darkPink, px);
      fillPxRect(cCtx, tx - p * 4.2, ty - p * 5.8, p * 8.4, p * 4, midPink, px);
      fillPxRect(cCtx, tx - p * 3, ty - p * 7, p * 6, p * 3, midPink, px);
      fillPxRect(cCtx, tx - p * 2.2, ty - p * 7, p * 4.4, p * 2, lightPink, px);
      fillPxRect(cCtx, tx - p * 3.6, ty - p * 4.4, p * 3, p * 2, lightPink, px);
      // Draping weeping sakura garlands on variant 0
      if (v === 0) {
        for (const wx of [-4.2, -1.8, 1.8, 4.2]) {
          fillPxRect(cCtx, tx + wx * p, ty - p * 0.5, p * 1.2, p * 2.8, midPink, px);
          fillPxRect(cCtx, tx + wx * p, ty + p * 1.2, p * 1.0, p * 1.2, lightPink, px);
        }
      }
    }

    function drawTeamCoachBus(
      cCtx: CanvasRenderingContext2D,
      bx: number,
      by: number,
      bodyCol: string,
      stripeCol: string,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      cCtx.fillRect(bx - 30, by - 66, 62, 138);
      // Wheels
      for (const wy of [-46, 32]) {
        fillPxRect(cCtx, bx - 30, by + wy, 60, 14, outline, px);
      }
      // Coach chassis
      fillPxRect(cCtx, bx - 26, by - 64, 52, 128, outline, px);
      fillPxRect(cCtx, bx - 22, by - 60, 44, 120, bodyCol, px);
      fillPxRect(cCtx, bx - 16, by - 54, 32, 108, stripeCol, px);
      fillPxRect(cCtx, bx - 12, by - 50, 24, 100, '#f8fafc', px);
      // Panoramic front & rear windshields
      fillPxRect(cCtx, bx - 18, by - 56, 36, 14, '#0f172a', px);
      fillPxRect(cCtx, bx - 14, by - 53, 28, 8, '#38bdf8', px);
      fillPxRect(cCtx, bx - 18, by + 42, 36, 12, '#0f172a', px);
      // Roof AC pods
      fillPxRect(cCtx, bx - 8, by - 26, 16, 20, '#cbd5e1', px);
      fillPxRect(cCtx, bx - 8, by + 6, 16, 20, '#cbd5e1', px);
      // Headlights
      fillPxRect(cCtx, bx - 18, by - 63, 8, 4, '#fef08a', px);
      fillPxRect(cCtx, bx + 10, by - 63, 8, 4, '#fef08a', px);
    }

    function drawBotanicalGlasshouse(
      cCtx: CanvasRenderingContext2D,
      gx: number,
      gy: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      cCtx.fillRect(gx - 58, gy - 72, 120, 152);
      // Stone foundation plinth
      fillPxRect(cCtx, gx - 54, gy - 70, 108, 140, outline, px);
      fillPxRect(cCtx, gx - 50, gy - 66, 100, 132, '#e2e8f0', px);
      // Arched glass conservatory wings
      fillPxRect(cCtx, gx - 44, gy - 58, 88, 116, outline, px);
      fillPxRect(cCtx, gx - 40, gy - 54, 80, 108, '#0284c7', px);
      fillPxRect(cCtx, gx - 34, gy - 48, 68, 96, '#38bdf8', px);
      // Lush exotic palms visible through glass roof
      fillPxRect(cCtx, gx - 24, gy - 32, 22, 22, '#16a34a', px);
      fillPxRect(cCtx, gx + 4, gy + 10, 22, 22, '#22c55e', px);
      fillPxRect(cCtx, gx - 18, gy + 16, 16, 16, '#f472b6', px);
      // White Victorian wrought-iron glass ribs & central dome
      for (let ry = -38; ry <= 38; ry += 19) {
        fillPxRect(cCtx, gx - 40, gy + ry, 80, 3, '#f8fafc', px);
      }
      fillPxRect(cCtx, gx - 2, gy - 54, 4, 108, '#f8fafc', px);
      fillPxRect(cCtx, gx - 24, gy - 24, 48, 48, outline, px);
      fillPxRect(cCtx, gx - 20, gy - 20, 40, 40, '#bae6fd', px);
      fillPxRect(cCtx, gx - 12, gy - 12, 24, 24, '#e0f2fe', px);
      fillPxRect(cCtx, gx - 4, gy - 4, 8, 8, '#fde047', px);
    }

    function drawArchedFootbridge(
      cCtx: CanvasRenderingContext2D,
      bx: number,
      by: number,
      bw: number,
      bh: number,
      style: 'BRICK' | 'TAIKO' | 'COVERED',
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.32)';
      cCtx.fillRect(bx - bw * 0.5 - 4, by - bh * 0.5 + 8, bw + 8, bh);

      if (style === 'TAIKO') {
        // Vermilion Kyoto Taiko-Bashi Arched Drum Bridge with Golden Giboshi Finials
        fillPxRect(cCtx, bx - bw * 0.5 - 4, by - bh * 0.5 - 4, bw + 8, bh + 8, outline, px);
        fillPxRect(cCtx, bx - bw * 0.5, by - bh * 0.5, bw, bh, '#b91c1c', px);
        fillPxRect(cCtx, bx - bw * 0.5, by - bh * 0.5 + 8, bw, bh - 16, '#ef4444', px);
        fillPxRect(cCtx, bx - bw * 0.22, by - bh * 0.5 + 8, bw * 0.44, bh - 16, '#fca5a5', px);
        for (let plankX = -bw * 0.44; plankX <= bw * 0.44; plankX += 14) {
          fillPxRect(cCtx, bx + plankX, by - bh * 0.5 + 10, 4, bh - 20, '#7f1d1d', px);
        }
        for (const postX of [-bw * 0.45, -bw * 0.18, bw * 0.18, bw * 0.45]) {
          fillPxRect(cCtx, bx + postX - 4, by - bh * 0.5 - 6, 8, 10, '#fde047', px);
          fillPxRect(cCtx, bx + postX - 4, by + bh * 0.5 - 4, 8, 10, '#fde047', px);
        }
        return;
      }

      if (style === 'COVERED') {
        // New England Red Timber Covered Bridge
        fillPxRect(cCtx, bx - bw * 0.5 - 4, by - bh * 0.5 - 4, bw + 8, bh + 8, outline, px);
        fillPxRect(cCtx, bx - bw * 0.5, by - bh * 0.5, bw, bh, '#991b1b', px);
        fillPxRect(cCtx, bx - bw * 0.46, by - bh * 0.5 + 6, bw * 0.92, bh - 12, '#78350f', px);
        fillPxRect(cCtx, bx - bw * 0.46, by - 4, bw * 0.92, 8, '#5c280a', px);
        fillPxRect(cCtx, bx - bw * 0.5, by - bh * 0.5, 8, bh, '#f8fafc', px);
        fillPxRect(cCtx, bx + bw * 0.5 - 8, by - bh * 0.5, 8, bh, '#f8fafc', px);
        return;
      }

      // Classic Sandstone & Red-Brick Arched Park Footbridge
      fillPxRect(cCtx, bx - bw * 0.5 - 4, by - bh * 0.5 - 4, bw + 8, bh + 8, outline, px);
      fillPxRect(cCtx, bx - bw * 0.5, by - bh * 0.5, bw, bh, '#9a3412', px);
      fillPxRect(cCtx, bx - bw * 0.5, by - bh * 0.5 + 10, bw, bh - 20, '#cbd5e1', px);
      fillPxRect(cCtx, bx - bw * 0.25, by - bh * 0.5 + 10, bw * 0.5, bh - 20, '#e2e8f0', px);
      for (const lx of [-bw * 0.38, bw * 0.38]) {
        fillPxRect(cCtx, bx + lx - 5, by - bh * 0.5 - 2, 10, 10, '#fde047', px);
        fillPxRect(cCtx, bx + lx - 5, by + bh * 0.5 - 8, 10, 10, '#fde047', px);
      }
    }

    function drawFiveTierPagoda(
      cCtx: CanvasRenderingContext2D,
      pxCenter: number,
      pyCenter: number,
      px = 3
    ) {
      const outline = GRAPHICS_CONFIG.palette.outline;
      cCtx.fillStyle = 'rgba(15, 23, 42, 0.3)';
      cCtx.fillRect(pxCenter - 58, pyCenter - 52, 120, 114);
      // Stone foundation terrace
      fillPxRect(cCtx, pxCenter - 54, pyCenter - 54, 108, 108, outline, px);
      fillPxRect(cCtx, pxCenter - 50, pyCenter - 50, 100, 100, '#cbd5e1', px);
      // Concentric pagoda roof tiers (from wide base roof to upper spire)
      const tiers = [
        { sz: 88, roofCol: '#1e293b', trimCol: '#dc2626' },
        { sz: 70, roofCol: '#334155', trimCol: '#ef4444' },
        { sz: 52, roofCol: '#1e293b', trimCol: '#dc2626' },
        { sz: 34, roofCol: '#334155', trimCol: '#f97316' },
      ];
      for (const t of tiers) {
        const half = t.sz * 0.5;
        fillPxRect(cCtx, pxCenter - half - 3, pyCenter - half - 3, t.sz + 6, t.sz + 6, outline, px);
        fillPxRect(cCtx, pxCenter - half, pyCenter - half, t.sz, t.sz, t.roofCol, px);
        fillPxRect(cCtx, pxCenter - half + 4, pyCenter - half + 4, t.sz - 8, t.sz - 8, t.trimCol, px);
      }
      // Golden Sorin Spire Finial
      fillPxRect(cCtx, pxCenter - 10, pyCenter - 10, 20, 20, outline, px);
      fillPxRect(cCtx, pxCenter - 7, pyCenter - 7, 14, 14, '#facc15', px);
      fillPxRect(cCtx, pxCenter - 3, pyCenter - 3, 6, 6, '#ffffff', px);
    }

    let homeMenuStadiumId: PitchThemeId = 'CLASSIC_TURF';
    let selectedPitchTheme: PitchThemeId = 'CLASSIC_TURF';
    let preferredArenaMode: 'RANDOM' | PitchThemeId = 'RANDOM';
    const urlPitchParam =
      typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('pitch') || '').toUpperCase()
        : '';
    if (urlPitchParam === 'SPACE' || urlPitchParam === 'COSMIC_SPACE') {
      preferredArenaMode = 'COSMIC_SPACE';
      homeMenuStadiumId = 'COSMIC_SPACE';
    } else if (urlPitchParam === 'STREET' || urlPitchParam === 'URBAN_CONCRETE') {
      preferredArenaMode = 'URBAN_CONCRETE';
      homeMenuStadiumId = 'URBAN_CONCRETE';
    } else if (urlPitchParam === 'CLAY' || urlPitchParam === 'BEACH' || urlPitchParam === 'RIO_CLAY') {
      preferredArenaMode = 'RIO_CLAY';
      homeMenuStadiumId = 'RIO_CLAY';
    } else if (urlPitchParam === 'SYNTH' || urlPitchParam === 'NIGHT' || urlPitchParam === 'TWILIGHT_SYNTH') {
      preferredArenaMode = 'TWILIGHT_SYNTH';
      homeMenuStadiumId = 'TWILIGHT_SYNTH';
    } else if (urlPitchParam === 'ICE' || urlPitchParam === 'SNOW' || urlPitchParam === 'ARCTIC_ICE') {
      preferredArenaMode = 'ARCTIC_ICE';
      homeMenuStadiumId = 'ARCTIC_ICE';
    } else if (urlPitchParam === 'VOLCANO' || urlPitchParam === 'LAVA' || urlPitchParam === 'VOLCANO_FORGE') {
      preferredArenaMode = 'VOLCANO_FORGE';
      homeMenuStadiumId = 'VOLCANO_FORGE';
    } else if (urlPitchParam === 'AUTUMN' || urlPitchParam === 'TURF_AUTUMN') {
      preferredArenaMode = 'TURF_AUTUMN';
      homeMenuStadiumId = 'TURF_AUTUMN';
    } else if (urlPitchParam === 'SAKURA' || urlPitchParam === 'TURF_SAKURA') {
      preferredArenaMode = 'TURF_SAKURA';
      homeMenuStadiumId = 'TURF_SAKURA';
    } else if (urlPitchParam === 'CHAMPIONS' || urlPitchParam === 'TURF_CHAMPIONS') {
      preferredArenaMode = 'TURF_CHAMPIONS';
      homeMenuStadiumId = 'TURF_CHAMPIONS';
    } else if (urlPitchParam === 'TURF' || urlPitchParam === 'CLASSIC_TURF') {
      preferredArenaMode = 'CLASSIC_TURF';
      homeMenuStadiumId = 'CLASSIC_TURF';
    }
    selectedPitchTheme = homeMenuStadiumId;
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
      // STEP 1: ASYMMETRIC 4-QUADRANT ARTISTIC STADIUM SURROUNDINGS DIORAMA
      // West, East, North & South each tell a distinct visual story with zero repeating stamp grids!
      // ======================================================================
      if (selectedPitchTheme === 'COSMIC_SPACE') {
        // === 1. COSMIC SPACE: WEST STARFIGHTER HANGAR, EAST BIODOME & COMMS ARRAY, NORTH REACTORS, SOUTH LUNAR ROVER OUTPOST ===
        pitchCacheCtx.fillStyle = '#050716';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Organic Swirling Deep-Space Nebulae & Spiral Galaxy Arms (Asymmetric placement)
        const nebulas = [
          { x: 420, y: -340, r: 420, c1: 'rgba(139, 92, 246, 0.42)', c2: 'rgba(217, 70, 239, 0.16)' },
          { x: w - 380, y: -290, r: 360, c1: 'rgba(56, 189, 248, 0.34)', c2: 'rgba(14, 165, 233, 0.12)' },
          { x: -360, y: h * 0.32, r: 380, c1: 'rgba(236, 72, 153, 0.3)', c2: 'rgba(124, 58, 237, 0.12)' },
          { x: w + 370, y: h * 0.65, r: 410, c1: 'rgba(45, 212, 191, 0.32)', c2: 'rgba(56, 189, 248, 0.14)' },
          { x: w * 0.45, y: h + 380, r: 460, c1: 'rgba(99, 102, 241, 0.32)', c2: 'rgba(168, 85, 247, 0.12)' },
        ];
        for (const neb of nebulas) {
          const nGrad = pitchCacheCtx.createRadialGradient(neb.x, neb.y, 18, neb.x, neb.y, neb.r);
          nGrad.addColorStop(0, neb.c1);
          nGrad.addColorStop(0.55, neb.c2);
          nGrad.addColorStop(1, 'rgba(5, 7, 22, 0)');
          pitchCacheCtx.fillStyle = nGrad;
          pitchCacheCtx.beginPath();
          pitchCacheCtx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
          pitchCacheCtx.fill();
        }

        // Rich Starfield with Constellation Lines in the North-West Vista
        const starColors = ['#ffffff', '#e0f2fe', '#fef08a', '#f5d0fe', '#bae6fd', '#c4b5fd'];
        for (let i = 0; i < 320; i++) {
          const sx = -CACHE_PAD_X + 20 + ((i * 197 + (i % 7) * 43) % (w + CACHE_PAD_X * 2 - 40));
          const sy = -CACHE_PAD_Y + 20 + ((i * 283 + (i % 5) * 61) % (h + CACHE_PAD_Y * 2 - 40));
          if (sx > -STADIUM_BOWL_PAD - 16 && sx < w + STADIUM_BOWL_PAD + 16 && sy > -STADIUM_BOWL_PAD - 16 && sy < h + STADIUM_BOWL_PAD + 16) continue;
          const col = starColors[i % starColors.length];
          const sz = i % 9 === 0 ? px * 2 : px;
          fillPxRect(pitchCacheCtx, sx, sy, sz, sz, col, px);
          if (i % 17 === 0) {
            fillPxRect(pitchCacheCtx, sx - px, sy, px * 3, px, col, px);
            fillPxRect(pitchCacheCtx, sx, sy - px, px, px * 3, col, px);
          }
        }

        // WEST QUADRANT (x < -165): Orbital Starfighter Docking Hangar & Cargo Deck
        fillPxRect(pitchCacheCtx, -380, h * 0.16 - 4, 206, h * 0.68 + 8, outline, px);
        fillPxRect(pitchCacheCtx, -374, h * 0.16, 194, h * 0.68, '#0f172a', px);
        fillPxRect(pitchCacheCtx, -362, h * 0.18, 170, h * 0.64, '#1e293b', px);
        // Glowing Cyan Magnetic Hangar Forcefield Threshold & Yellow Hazard Stripes
        fillPxRect(pitchCacheCtx, -366, h * 0.24, 10, h * 0.52, '#38bdf8', px);
        for (let hy = h * 0.22; hy < h * 0.76; hy += 28) {
          fillPxRect(pitchCacheCtx, -206, hy, 14, 14, '#facc15', px);
        }
        // Landed Sleek Delta-Wing Starfighter Shuttle on West Hangar Pad (y = h * 0.38)
        const sfX = -275;
        const sfY = h * 0.38;
        fillPxRect(pitchCacheCtx, sfX - 52, sfY - 38, 104, 76, outline, px);
        fillPxRect(pitchCacheCtx, sfX - 46, sfY - 32, 92, 64, '#334155', px);
        fillPxRect(pitchCacheCtx, sfX - 30, sfY - 52, 60, 104, outline, px);
        fillPxRect(pitchCacheCtx, sfX - 24, sfY - 46, 48, 92, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, sfX - 12, sfY - 28, 24, 56, '#0284c7', px);
        fillPxRect(pitchCacheCtx, sfX - 8, sfY - 18, 16, 26, '#38bdf8', px);
        fillPxRect(pitchCacheCtx, sfX - 42, sfY - 12, 14, 24, '#f43f5e', px);
        fillPxRect(pitchCacheCtx, sfX + 28, sfY - 12, 14, 24, '#f43f5e', px);
        // Lower-West Plasma Fuel Tanks & Cargo Containers (y = h * 0.68)
        for (let ty = 0; ty < 2; ty++) {
          const cy = h * 0.64 + ty * 54;
          fillPxRect(pitchCacheCtx, -338, cy - 18, 118, 36, outline, px);
          fillPxRect(pitchCacheCtx, -334, cy - 14, 110, 28, '#312e81', px);
          fillPxRect(pitchCacheCtx, -322, cy - 6, 86, 12, ty === 0 ? '#22d3ee' : '#e879f9', px);
        }

        // EAST QUADRANT (x > w + 165): Geodesic Hydroponic Biodome & Quantum Comms Array
        // Structural Catwalk Spine connecting Stadium to East Modules
        fillPxRect(pitchCacheCtx, w + 162, h * 0.28 - 22, 190, 44, outline, px);
        fillPxRect(pitchCacheCtx, w + 166, h * 0.28 - 16, 182, 32, '#1e293b', px);
        fillPxRect(pitchCacheCtx, w + 162, h * 0.72 - 22, 190, 44, outline, px);
        fillPxRect(pitchCacheCtx, w + 166, h * 0.72 - 16, 182, 32, '#1e293b', px);
        // Giant Geodesic Glass Biodome Arboretum (x = w + 285, y = h * 0.30)
        const bioX = w + 285;
        const bioY = h * 0.30;
        const bioR = 92;
        pitchCacheCtx.save();
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(bioX, bioY, bioR + 6, 0, Math.PI * 2);
        pitchCacheCtx.fillStyle = outline;
        pitchCacheCtx.fill();
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(bioX, bioY, bioR, 0, Math.PI * 2);
        pitchCacheCtx.fillStyle = '#064e3b';
        pitchCacheCtx.fill();
        // Alien bioluminescent trees & winding stream inside Biodome
        fillPxRect(pitchCacheCtx, bioX - 58, bioY - 12, 116, 24, '#0284c7', px);
        drawPixelTree(pitchCacheCtx, bioX - 32, bioY - 28, 1.5, 3, px);
        drawPixelTree(pitchCacheCtx, bioX + 28, bioY + 26, 1.5, 1, px);
        drawSakuraBlossomTree(pitchCacheCtx, bioX + 22, bioY - 26, 1.3, 0, px);
        // Geodesic glass hex struts & specular highlight
        pitchCacheCtx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(bioX, bioY, bioR - 4, 0, Math.PI * 2);
        pitchCacheCtx.arc(bioX, bioY, bioR * 0.58, 0, Math.PI * 2);
        pitchCacheCtx.moveTo(bioX - bioR, bioY);
        pitchCacheCtx.lineTo(bioX + bioR, bioY);
        pitchCacheCtx.moveTo(bioX, bioY - bioR);
        pitchCacheCtx.lineTo(bioX, bioY + bioR);
        pitchCacheCtx.stroke();
        pitchCacheCtx.restore();
        // Lower-East Deep-Space Quantum Dish Deck & EVA Airlock (x = w + 265, y = h * 0.72)
        fillPxRect(pitchCacheCtx, w + 206, h * 0.64, 128, 140, outline, px);
        fillPxRect(pitchCacheCtx, w + 212, h * 0.64 + 6, 116, 128, '#1e1b4b', px);
        fillPxRect(pitchCacheCtx, w + 224, h * 0.64 + 18, 92, 104, '#312e81', px);

        // NORTH QUADRANT (y < -165): Twin Tokamak Fusion Reactor Cores, Energy Bridges & Ringed Planet Vista
        for (const rx of [w * 0.28, w * 0.72]) {
          const ry = -258;
          fillPxRect(pitchCacheCtx, rx - 74, ry - 48, 148, 96, outline, px);
          fillPxRect(pitchCacheCtx, rx - 68, ry - 42, 136, 84, '#0f172a', px);
          fillPxRect(pitchCacheCtx, rx - 52, ry - 28, 104, 56, '#1e3a8a', px);
          fillPxRect(pitchCacheCtx, rx - 28, ry - 20, 56, 40, '#38bdf8', px);
          fillPxRect(pitchCacheCtx, rx - 14, ry - 10, 28, 20, '#e0f2fe', px);
        }
        // Connecting Plasma Conduit Spine between North Reactors
        fillPxRect(pitchCacheCtx, w * 0.28 + 74, -270, w * 0.44 - 148, 24, outline, px);
        fillPxRect(pitchCacheCtx, w * 0.28 + 74, -264, w * 0.44 - 148, 12, '#38bdf8', px);
        drawRingedPlanet(pitchCacheCtx, w * 0.5, -420, 74, px);
        drawRingedPlanet(pitchCacheCtx, -420, -340, 58, px);

        // SOUTH QUADRANT (y > h + 165): Cratered Lunar Outpost Ridge, Habitat Tubes & Kyber Crystals
        fillPxRect(pitchCacheCtx, 120, h + 206, w - 240, 155, outline, px);
        fillPxRect(pitchCacheCtx, 126, h + 212, w - 252, 143, '#334155', px);
        fillPxRect(pitchCacheCtx, 144, h + 224, w - 288, 118, '#475569', px);
        // Lunar craters & glowing purple/cyan crystal clusters along the South Moon Ridge
        for (const crX of [280, 680, w * 0.5 + 160, w - 420]) {
          fillPxRect(pitchCacheCtx, crX - 28, h + 246, 56, 36, '#1e293b', px);
          fillPxRect(pitchCacheCtx, crX - 20, h + 252, 40, 24, '#0f172a', px);
        }
        for (const kx of [460, w - 620, w - 240]) {
          fillPxRect(pitchCacheCtx, kx - 12, h + 234, 24, 34, outline, px);
          fillPxRect(pitchCacheCtx, kx - 8, h + 238, 16, 26, '#e879f9', px);
          fillPxRect(pitchCacheCtx, kx - 3, h + 242, 6, 16, '#f5d0fe', px);
        }
        drawRingedPlanet(pitchCacheCtx, w + 380, h + 330, 66, px);
      } else if (selectedPitchTheme === 'URBAN_CONCRETE') {
        // === 2. URBAN STREET CONCRETE: WEST SKATEPARK & LOWRIDER TACO PLAZA, EAST RUCKER STREETBALL & DJ STAGE, NORTH EL-TRAIN VIADUCT, SOUTH TWO-LANE AVENUE ===
        pitchCacheCtx.fillStyle = '#1e293b';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Subtle urban asphalt block paving joints (non-striped!)
        pitchCacheCtx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        pitchCacheCtx.lineWidth = 3;
        for (let gx = -CACHE_PAD_X; gx < w + CACHE_PAD_X; gx += 220) {
          for (let gy = -CACHE_PAD_Y; gy < h + CACHE_PAD_Y; gy += 180) {
            pitchCacheCtx.strokeRect(gx, gy, 220, 180);
          }
        }

        // WEST QUADRANT (x < -165): Sunken Concrete Skatepark Bowl (Upper-West) & Neon Taco Truck + Lowrider Meet (Lower-West)
        // 1A. Sunken Kidney Skatepark Bowl & Half-Pipe (x = -335..-190, y = 90..540)
        fillPxRect(pitchCacheCtx, -342, 86, 152, 440, outline, px);
        fillPxRect(pitchCacheCtx, -336, 92, 140, 428, '#475569', px);
        fillPxRect(pitchCacheCtx, -320, 114, 108, 220, outline, px);
        fillPxRect(pitchCacheCtx, -314, 120, 96, 208, '#94a3b8', px);
        fillPxRect(pitchCacheCtx, -298, 140, 64, 168, '#cbd5e1', px);
        // Steel Grind Rail & Street Graffiti Tag inside Skatepark
        fillPxRect(pitchCacheCtx, -270, 355, 8, 130, outline, px);
        fillPxRect(pitchCacheCtx, -268, 358, 4, 124, '#facc15', px);
        fillPxRect(pitchCacheCtx, -318, 375, 36, 22, '#f43f5e', px);
        fillPxRect(pitchCacheCtx, -312, 380, 24, 10, '#38bdf8', px);

        // 1B. Lower-West Neon Taco Food Truck, Checkered Tables & Lowrider Meet (y = h - 540 .. h - 85)
        fillPxRect(pitchCacheCtx, -342, h - 520, 152, 430, outline, px);
        fillPxRect(pitchCacheCtx, -336, h - 514, 140, 418, '#334155', px);
        // Pastel Cyan & Magenta Taco Truck
        fillPxRect(pitchCacheCtx, -316, h - 475, 68, 136, outline, px);
        fillPxRect(pitchCacheCtx, -310, h - 469, 56, 124, '#06b6d4', px);
        fillPxRect(pitchCacheCtx, -300, h - 455, 36, 96, '#f472b6', px);
        fillPxRect(pitchCacheCtx, -248, h - 445, 18, 76, '#fde047', px); // Striped awning
        // Picnic Umbrellas
        drawBeachUmbrella(pitchCacheCtx, -238, h - 280, '#f43f5e', '#fef08a', px);
        drawBeachUmbrella(pitchCacheCtx, -295, h - 250, '#38bdf8', '#ffffff', px);

        // EAST QUADRANT (x > w + 165): Full Rucker-Style Streetball Court (Upper-East) & Container DJ Stage + Cypher Mat (Lower-East)
        // 2A. Rucker Streetball Court (x = w + 194, y = 86..640)
        const sbX = w + 194;
        fillPxRect(pitchCacheCtx, sbX - 4, 86, 156, 520, outline, px);
        fillPxRect(pitchCacheCtx, sbX, 92, 148, 508, '#334155', px);
        fillPxRect(pitchCacheCtx, sbX + 12, 110, 124, 472, '#ea580c', px);
        pitchCacheCtx.strokeStyle = '#f8fafc';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.strokeRect(sbX + 14, 112, 120, 468);
        // Painted Key, Center Circle & Backboard
        fillPxRect(pitchCacheCtx, sbX + 44, 112, 60, 96, '#0284c7', px);
        pitchCacheCtx.strokeRect(sbX + 44, 112, 60, 96);
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(sbX + 74, 346, 36, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        fillPxRect(pitchCacheCtx, sbX + 52, 102, 44, 8, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, sbX + 66, 110, 16, 10, '#ef4444', px);

        // 2B. Lower-East Shipping Container Block-Party DJ Stage & Breakdance Cypher Mat (y = h - 490..h - 86)
        fillPxRect(pitchCacheCtx, sbX - 4, h - 480, 156, 394, outline, px);
        fillPxRect(pitchCacheCtx, sbX, h - 474, 148, 382, '#1e293b', px);
        // Stacked Corrugated Cargo Containers (Magenta & Gold)
        fillPxRect(pitchCacheCtx, sbX + 14, h - 455, 120, 68, outline, px);
        fillPxRect(pitchCacheCtx, sbX + 18, h - 451, 112, 60, '#a855f7', px);
        fillPxRect(pitchCacheCtx, sbX + 32, h - 435, 84, 28, '#facc15', px);
        // Checkered Breakdance Cypher Floor Mat
        fillPxRect(pitchCacheCtx, sbX + 22, h - 345, 104, 104, outline, px);
        for (let cx = 0; cx < 4; cx++) {
          for (let cy = 0; cy < 4; cy++) {
            fillPxRect(
              pitchCacheCtx,
              sbX + 26 + cx * 24,
              h - 341 + cy * 24,
              24,
              24,
              (cx + cy) % 2 === 0 ? '#38bdf8' : '#0f172a',
              px
            );
          }
        }
        // Giant Twin Speaker Stacks
        fillPxRect(pitchCacheCtx, sbX + 18, h - 205, 112, 56, outline, px);
        fillPxRect(pitchCacheCtx, sbX + 22, h - 201, 104, 48, '#334155', px);
        fillPxRect(pitchCacheCtx, sbX + 32, h - 193, 28, 32, '#0f172a', px);
        fillPxRect(pitchCacheCtx, sbX + 88, h - 193, 28, 32, '#0f172a', px);

        // NORTH QUADRANT (y < -165): Elevated Steel Subway Viaduct (El-Train Track) & Brick Tenement Rooftops
        const elY = -265;
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, elY - 32, w + CACHE_PAD_X * 2, 64, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, elY - 26, w + CACHE_PAD_X * 2, 52, '#334155', px);
        // Railroad ties & twin steel rails
        for (let tx = -CACHE_PAD_X + 16; tx < w + CACHE_PAD_X; tx += 28) {
          fillPxRect(pitchCacheCtx, tx, elY - 20, 12, 40, '#451a03', px);
        }
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, elY - 12, w + CACHE_PAD_X * 2, 5, '#94a3b8', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, elY + 7, w + CACHE_PAD_X * 2, 5, '#94a3b8', px);
        // Asymmetric Red-Brick Tenements & Rooftop Water Towers North of the El-Track
        for (const bld of [
          { x: 140, y: -440, bw: 240, bh: 125, col: '#7c2d12', roof: '#451a03' },
          { x: 520, y: -455, bw: 190, bh: 140, col: '#334155', roof: '#1e293b' },
          { x: w * 0.5 - 130, y: -445, bw: 260, bh: 130, col: '#9a3412', roof: '#431407' },
          { x: w - 720, y: -450, bw: 210, bh: 135, col: '#1e293b', roof: '#0f172a' },
          { x: w - 390, y: -435, bw: 250, bh: 120, col: '#7f1d1d', roof: '#450a0a' },
        ]) {
          fillPxRect(pitchCacheCtx, bld.x - 4, bld.y - 4, bld.bw + 8, bld.bh + 8, outline, px);
          fillPxRect(pitchCacheCtx, bld.x, bld.y, bld.bw, bld.bh, bld.col, px);
          fillPxRect(pitchCacheCtx, bld.x + 10, bld.y + 10, bld.bw - 20, bld.bh - 20, bld.roof, px);
          // Rooftop Wooden Water Tank or Neon Billboard
          fillPxRect(pitchCacheCtx, bld.x + 24, bld.y + 22, 42, 42, outline, px);
          fillPxRect(pitchCacheCtx, bld.x + 28, bld.y + 26, 34, 34, '#b45309', px);
        }

        // SOUTH QUADRANT (y > h + 165): Two-Lane Downtown Asphalt Avenue, Crosswalks, Bus Stop & Steaming Manholes
        const aveY = h + 206;
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, aveY - 4, w + CACHE_PAD_X * 2, 92, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, aveY, w + CACHE_PAD_X * 2, 84, '#0f172a', px);
        for (let rx = -CACHE_PAD_X + 20; rx < w + CACHE_PAD_X; rx += 72) {
          fillPxRect(pitchCacheCtx, rx, aveY + 39, 38, 6, '#facc15', px);
        }
        for (const cwX of [260, w * 0.5 - 32, w - 310]) {
          for (let stripe = 0; stripe < 6; stripe++) {
            fillPxRect(pitchCacheCtx, cwX, aveY + 6 + stripe * 13, 58, 7, '#f8fafc', px);
          }
        }
        // Iron Manhole Covers (for live rising steam plumes!)
        for (const mhX of [520, w * 0.5 + 240, w - 540]) {
          fillPxRect(pitchCacheCtx, mhX - 12, aveY + 18, 24, 24, outline, px);
          fillPxRect(pitchCacheCtx, mhX - 8, aveY + 22, 16, 16, '#475569', px);
        }
      } else if (selectedPitchTheme === 'RIO_CLAY') {
        // === 3. RIO CLAY: WEST PORTUGUESE WAVE BOARDWALK & SAMBA STAGE, EAST ATLANTIC OCEAN MARINA PIER, NORTH SUGARLOAF WATERFALL, SOUTH PALM COVE ===
        // Base Golden Sand & West Copacabana Promenade
        pitchCacheCtx.fillStyle = '#fde68a';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // EAST QUADRANT (x > w + 175): Curved Atlantic Ocean Surf Bay & Timber Marina Yacht Pier
        fillPxRect(pitchCacheCtx, w + 178, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#f8fafc', px); // White surf foam edge
        fillPxRect(pitchCacheCtx, w + 196, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#38bdf8', px); // Shallow turquoise surf
        fillPxRect(pitchCacheCtx, w + 232, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#0ea5e9', px); // Mid ocean
        fillPxRect(pitchCacheCtx, w + 285, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#0284c7', px); // Deep Atlantic
        // Timber Marina Yacht Pier jutting out at y = h * 0.5
        const pierX = w + 174;
        const pierY = h * 0.5 - 38;
        fillPxRect(pitchCacheCtx, pierX, pierY - 4, 240, 84, outline, px);
        fillPxRect(pitchCacheCtx, pierX + 4, pierY, 232, 76, '#78350f', px);
        for (let pxPlank = pierX + 12; pxPlank < pierX + 228; pxPlank += 16) {
          fillPxRect(pitchCacheCtx, pxPlank, pierY + 4, 10, 68, '#92400e', px);
        }
        // Moored Luxury Sun-Yacht & Tiki Boat House beside the Pier
        fillPxRect(pitchCacheCtx, w + 245, pierY - 82, 112, 48, outline, px);
        fillPxRect(pitchCacheCtx, w + 249, pierY - 78, 104, 40, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, w + 265, pierY - 70, 64, 24, '#38bdf8', px);
        fillPxRect(pitchCacheCtx, w + 285, pierY - 64, 28, 12, '#f43f5e', px);

        // WEST QUADRANT (x < -165): Iconic Black & White Portuguese Wave Mosaic Boardwalk (`Calçadão`), Samba Stage & Footvolley
        fillPxRect(pitchCacheCtx, -365, -CACHE_PAD_Y, 185, h + CACHE_PAD_Y * 2, outline, px);
        fillPxRect(pitchCacheCtx, -359, -CACHE_PAD_Y, 173, h + CACHE_PAD_Y * 2, '#f8fafc', px);
        // Portuguese Wave Mosaic Stripes
        for (let wy = -CACHE_PAD_Y + 20; wy < h + CACHE_PAD_Y; wy += 48) {
          fillPxRect(pitchCacheCtx, -352, wy, 78, 14, '#0f172a', px);
          fillPxRect(pitchCacheCtx, -274, wy + 18, 82, 14, '#0f172a', px);
        }
        // Carnival Samba Percussion Float & Stage (x = -295, y = h * 0.26)
        fillPxRect(pitchCacheCtx, -338, h * 0.18, 132, 195, outline, px);
        fillPxRect(pitchCacheCtx, -332, h * 0.18 + 6, 120, 183, '#db2777', px);
        fillPxRect(pitchCacheCtx, -318, h * 0.18 + 20, 92, 155, '#facc15', px);
        fillPxRect(pitchCacheCtx, -304, h * 0.18 + 38, 64, 118, '#10b981', px);
        // Footvolley Sand Court & Tiki Coconut Bar (y = h * 0.62)
        fillPxRect(pitchCacheCtx, -332, h * 0.56, 120, 260, outline, px);
        fillPxRect(pitchCacheCtx, -326, h * 0.56 + 6, 108, 248, '#fcd34d', px);
        pitchCacheCtx.strokeStyle = '#f43f5e';
        pitchCacheCtx.lineWidth = 3;
        pitchCacheCtx.strokeRect(-314, h * 0.58, 84, 212);
        fillPxRect(pitchCacheCtx, -318, h * 0.58 + 103, 92, 6, '#ffffff', px);

        // NORTH QUADRANT (y < -165): Sugarloaf Coastal Granite Cliffs, Rainforest Waterfall & Plunge Lagoon
        // Plunge Lagoon & Waterfall at x = w * 0.32, y = -285
        const lagX = w * 0.32;
        fillPxRect(pitchCacheCtx, lagX - 180, -390, 360, 190, outline, px);
        fillPxRect(pitchCacheCtx, lagX - 174, -384, 348, 178, '#57534e', px); // Granite cliff rock
        fillPxRect(pitchCacheCtx, lagX - 140, -350, 280, 140, '#78716c', px);
        fillPxRect(pitchCacheCtx, lagX - 96, -295, 192, 92, '#0ea5e9', px); // Turquoise lagoon
        fillPxRect(pitchCacheCtx, lagX - 78, -282, 156, 68, '#38bdf8', px);
        fillPxRect(pitchCacheCtx, lagX - 28, -384, 56, 110, '#bae6fd', px); // Waterfall chute
        fillPxRect(pitchCacheCtx, lagX - 18, -384, 36, 110, '#ffffff', px);
        // North-East Lifeguard Tower & Colorful Beach Towels
        fillPxRect(pitchCacheCtx, w * 0.68 - 32, -265, 64, 64, outline, px);
        fillPxRect(pitchCacheCtx, w * 0.68 - 26, -259, 52, 52, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, w * 0.68 - 18, -251, 36, 36, '#ef4444', px);
        drawBeachUmbrella(pitchCacheCtx, w * 0.56, -230, '#f43f5e', '#fef08a', px);
        drawBeachUmbrella(pitchCacheCtx, w * 0.78, -234, '#0ea5e9', '#ffffff', px);
        drawBeachUmbrella(pitchCacheCtx, w * 0.86, -222, '#10b981', '#fef08a', px);

        // SOUTH QUADRANT (y > h + 165): Surfboard Rental Shack, Giant Sandcastle & Leaning Coconut Palm Grove
        fillPxRect(pitchCacheCtx, 240, h + 208, 146, 78, outline, px);
        fillPxRect(pitchCacheCtx, 246, h + 214, 134, 66, '#b45309', px);
        fillPxRect(pitchCacheCtx, 256, h + 222, 114, 50, '#d97706', px);
        // Lineup of colorful surfboards beside the shack
        for (let sIdx = 0; sIdx < 5; sIdx++) {
          const sCol = ['#f43f5e', '#06b6d4', '#10b981', '#facc15', '#a855f7'][sIdx];
          fillPxRect(pitchCacheCtx, 420 + sIdx * 36, h + 218, 22, 48, outline, px);
          fillPxRect(pitchCacheCtx, 423 + sIdx * 36, h + 221, 16, 42, sCol, px);
        }
        // Sculpted Multi-Tower Sandcastle (x = w * 0.58, y = h + 238)
        const scX = w * 0.58;
        fillPxRect(pitchCacheCtx, scX - 54, h + 206, 108, 74, outline, px);
        fillPxRect(pitchCacheCtx, scX - 48, h + 212, 96, 62, '#d97706', px);
        fillPxRect(pitchCacheCtx, scX - 32, h + 222, 64, 42, '#f59e0b', px);
        fillPxRect(pitchCacheCtx, scX - 12, h + 232, 24, 22, '#fef08a', px);

        for (const pm of [
          { x: 140, y: -228 },
          { x: lagX - 210, y: -240 },
          { x: lagX + 210, y: -236 },
          { x: 160, y: h + 235 },
          { x: w * 0.42, y: h + 242 },
          { x: w - 420, y: h + 232 },
          { x: w - 220, y: h + 240 },
        ]) {
          drawPixelPalmTree(pitchCacheCtx, pm.x, pm.y, px);
        }
      } else if (selectedPitchTheme === 'TWILIGHT_SYNTH') {
        // === 4. TWILIGHT SYNTH: WEST 80s NEON DINER & GULLWING MEET, EAST CYBER HELIPAD & DJ TOWER, NORTH OUTRUN WIREFRAME PEAKS, SOUTH MAGLEV MONORAIL ===
        pitchCacheCtx.fillStyle = '#09051c';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Perspective Synthwave Laser Grid
        pitchCacheCtx.strokeStyle = 'rgba(232, 121, 249, 0.32)';
        pitchCacheCtx.lineWidth = 2;
        for (let gx = -CACHE_PAD_X; gx <= w + CACHE_PAD_X; gx += 76) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(gx, -CACHE_PAD_Y);
          pitchCacheCtx.lineTo(gx, h + CACHE_PAD_Y);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.strokeStyle = 'rgba(34, 211, 238, 0.30)';
        for (let gy = -CACHE_PAD_Y; gy <= h + CACHE_PAD_Y; gy += 68) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(-CACHE_PAD_X, gy);
          pitchCacheCtx.lineTo(w + CACHE_PAD_X, gy);
          pitchCacheCtx.stroke();
        }

        // NORTH QUADRANT (y < -165): Giant Outrun Sunset Disc, 3D Cyan/Magenta Wireframe Mountain Peaks & Asymmetric Neo-Tokyo Towers
        const sunGrad = pitchCacheCtx.createRadialGradient(w * 0.5, -290, 12, w * 0.5, -290, 380);
        sunGrad.addColorStop(0, 'rgba(244, 114, 182, 0.58)');
        sunGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.28)');
        sunGrad.addColorStop(1, 'rgba(9, 5, 28, 0)');
        pitchCacheCtx.fillStyle = sunGrad;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(w * 0.5, -290, 380, 0, Math.PI * 2);
        pitchCacheCtx.fill();

        fillPxRect(pitchCacheCtx, w * 0.5 - 92, -330, 184, 10, '#fde047', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 108, -312, 216, 10, '#fb923c', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 118, -294, 236, 10, '#f43f5e', px);
        fillPxRect(pitchCacheCtx, w * 0.5 - 108, -276, 216, 8, '#e879f9', px);

        // 3D Vector Wireframe Mountain Peaks flanking the Outrun Sun
        pitchCacheCtx.save();
        for (const pk of [
          { cx: w * 0.28, cy: -215, pw: 260, ph: 135, col: '#22d3ee' },
          { cx: w * 0.38, cy: -215, pw: 210, ph: 110, col: '#e879f9' },
          { cx: w * 0.62, cy: -215, pw: 210, ph: 110, col: '#e879f9' },
          { cx: w * 0.72, cy: -215, pw: 260, ph: 135, col: '#22d3ee' },
        ]) {
          pitchCacheCtx.fillStyle = '#140933';
          pitchCacheCtx.strokeStyle = pk.col;
          pitchCacheCtx.lineWidth = 2.5;
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(pk.cx - pk.pw * 0.5, pk.cy);
          pitchCacheCtx.lineTo(pk.cx, pk.cy - pk.ph);
          pitchCacheCtx.lineTo(pk.cx + pk.pw * 0.5, pk.cy);
          pitchCacheCtx.closePath();
          pitchCacheCtx.fill();
          pitchCacheCtx.stroke();
          // Internal wireframe facets
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(pk.cx, pk.cy - pk.ph);
          pitchCacheCtx.lineTo(pk.cx - pk.pw * 0.16, pk.cy);
          pitchCacheCtx.moveTo(pk.cx, pk.cy - pk.ph);
          pitchCacheCtx.lineTo(pk.cx + pk.pw * 0.16, pk.cy);
          pitchCacheCtx.stroke();
        }
        pitchCacheCtx.restore();

        // WEST QUADRANT (x < -165): Retro 80s Chrome & Neon Drive-In Diner + Gullwing Sports Car Meet
        fillPxRect(pitchCacheCtx, -356, 110, 168, h - 220, outline, px);
        fillPxRect(pitchCacheCtx, -350, 116, 156, h - 232, '#1e1b4b', px);
        // Checkered Black & Magenta Diner Patio Floor
        for (let dy = 140; dy < 460; dy += 32) {
          for (let dx = -336; dx < -210; dx += 32) {
            fillPxRect(pitchCacheCtx, dx, dy, 32, 32, ((dx + dy) / 32) % 2 === 0 ? '#3b0764' : '#09051c', px);
          }
        }
        // Chrome & Pink Neon Diner Building
        fillPxRect(pitchCacheCtx, -338, 165, 112, 240, outline, px);
        fillPxRect(pitchCacheCtx, -332, 171, 100, 228, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, -324, 180, 84, 210, '#f472b6', px);
        fillPxRect(pitchCacheCtx, -312, 196, 60, 178, '#22d3ee', px);
        // Parked Silver & Neon Gullwing Sports Cars in Drive-In Stalls (Lower-West)
        for (let cIdx = 0; cIdx < 4; cIdx++) {
          drawStreetCar(
            pitchCacheCtx,
            -268,
            h - 460 + cIdx * 82,
            1,
            cIdx % 2 === 0 ? '#22d3ee' : '#f472b6',
            px,
            false,
            0
          );
        }

        // EAST QUADRANT (x > w + 165): Rooftop Cyber-Helipad (Upper-East) & Hologram Equalizer Megatower (Lower-East)
        const heliX = w + 275;
        const heliY = h * 0.28;
        fillPxRect(pitchCacheCtx, heliX - 88, heliY - 88, 176, 176, outline, px);
        fillPxRect(pitchCacheCtx, heliX - 82, heliY - 82, 164, 164, '#1e1b4b', px);
        pitchCacheCtx.strokeStyle = '#22d3ee';
        pitchCacheCtx.lineWidth = 4;
        pitchCacheCtx.beginPath();
        pitchCacheCtx.arc(heliX, heliY, 64, 0, Math.PI * 2);
        pitchCacheCtx.stroke();
        // Glowing 'H' Markings
        fillPxRect(pitchCacheCtx, heliX - 24, heliY - 28, 10, 56, '#f472b6', px);
        fillPxRect(pitchCacheCtx, heliX + 14, heliY - 28, 10, 56, '#f472b6', px);
        fillPxRect(pitchCacheCtx, heliX - 24, heliY - 5, 48, 10, '#f472b6', px);
        // Lower-East Hologram Equalizer Megatower
        const eqX = w + 202;
        const eqY = h * 0.58;
        fillPxRect(pitchCacheCtx, eqX - 4, eqY - 4, 148, 320, outline, px);
        fillPxRect(pitchCacheCtx, eqX, eqY, 140, 312, '#140933', px);
        for (let bar = 0; bar < 8; bar++) {
          const barW = 48 + ((bar * 37) % 68);
          const barCol = bar % 3 === 0 ? '#22d3ee' : bar % 3 === 1 ? '#f472b6' : '#fde047';
          fillPxRect(pitchCacheCtx, eqX + 14, eqY + 22 + bar * 34, barW, 18, barCol, px);
        }

        // SOUTH QUADRANT (y > h + 165): Elevated Neon Maglev Monorail Beamway
        const monoY = h + 236;
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, monoY - 20, w + CACHE_PAD_X * 2, 40, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, monoY - 14, w + CACHE_PAD_X * 2, 28, '#1e1b4b', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, monoY - 4, w + CACHE_PAD_X * 2, 8, '#22d3ee', px);
      } else if (selectedPitchTheme === 'ARCTIC_ICE') {
        // === 5. ARCTIC ICE: WEST SKI GONDOLA CHAIRLIFT & NORDIC LODGE, EAST ICEBREAKER SHIP & GEOTHERMAL HOT SPRINGS, NORTH GLACIAL PEAKS, SOUTH RESEARCH DOME ===
        pitchCacheCtx.fillStyle = '#e2e8f0';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // EAST QUADRANT (x > w + 175): Deep Glacial Iceberg Bay, Anchored Red Polar Icebreaker Ship & Steaming Turquoise Hot Springs
        fillPxRect(pitchCacheCtx, w + 185, -CACHE_PAD_Y, CACHE_PAD_X, h * 0.56 + CACHE_PAD_Y, '#bae6fd', px);
        fillPxRect(pitchCacheCtx, w + 205, -CACHE_PAD_Y, CACHE_PAD_X, h * 0.54 + CACHE_PAD_Y, '#0284c7', px);
        fillPxRect(pitchCacheCtx, w + 235, -CACHE_PAD_Y, CACHE_PAD_X, h * 0.52 + CACHE_PAD_Y, '#0c4a6e', px);
        // Anchored Red-Hull Polar Expedition Icebreaker Ship (x = w + 275, y = 260)
        const shipX = w + 275;
        const shipY = 260;
        fillPxRect(pitchCacheCtx, shipX - 38, shipY - 115, 76, 230, outline, px);
        fillPxRect(pitchCacheCtx, shipX - 32, shipY - 109, 64, 218, '#dc2626', px);
        fillPxRect(pitchCacheCtx, shipX - 24, shipY - 85, 48, 170, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, shipX - 18, shipY - 45, 36, 68, '#0f172a', px);
        fillPxRect(pitchCacheCtx, shipX - 12, shipY + 35, 24, 24, '#facc15', px); // Helideck circle on stern
        // Floating Pack-Ice Floes in the Bay
        fillPxRect(pitchCacheCtx, w + 230, 520, 68, 48, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, w + 238, 528, 52, 32, '#bae6fd', px);
        // Lower-East Steaming Turquoise Geothermal Hot Springs & Igloo Village (y = h * 0.62 .. h - 90)
        const hsX = w + 258;
        const hsY = h * 0.72;
        fillPxRect(pitchCacheCtx, hsX - 66, hsY - 58, 132, 116, outline, px);
        fillPxRect(pitchCacheCtx, hsX - 60, hsY - 52, 120, 104, '#64748b', px); // Warm volcanic stones
        fillPxRect(pitchCacheCtx, hsX - 48, hsY - 40, 96, 80, '#0d9488', px);
        fillPxRect(pitchCacheCtx, hsX - 36, hsY - 28, 72, 56, '#2dd4bf', px);
        fillPxRect(pitchCacheCtx, hsX - 20, hsY - 14, 40, 28, '#99f6e4', px);
        // Snow Igloo Domes near the Hot Springs
        for (const igY of [h * 0.58, h * 0.88]) {
          fillPxRect(pitchCacheCtx, w + 225, igY - 26, 56, 52, outline, px);
          fillPxRect(pitchCacheCtx, w + 229, igY - 22, 48, 44, '#f8fafc', px);
          fillPxRect(pitchCacheCtx, w + 235, igY - 16, 36, 32, '#bae6fd', px);
          fillPxRect(pitchCacheCtx, w + 215, igY - 8, 16, 16, '#e2e8f0', px); // Igloo tunnel entrance
        }

        // WEST QUADRANT (x < -165): Groomed Alpine Ski Run, Overhead Gondola Chairlift & Cozy Nordic Timber Lodge
        fillPxRect(pitchCacheCtx, -350, -120, 160, h + 240, '#f8fafc', px);
        // Ski slalom gates (alternating red & blue flags)
        for (let sy = 140; sy < h - 180; sy += 160) {
          fillPxRect(pitchCacheCtx, -305, sy, 14, 18, '#ef4444', px);
          fillPxRect(pitchCacheCtx, -225, sy + 80, 14, 18, '#2563eb', px);
        }
        // Overhead Gondola Chairlift Steel Towers & Cable (x = -255)
        fillPxRect(pitchCacheCtx, -258, -140, 6, h + 280, '#334155', px);
        for (const py of [110, h * 0.5, h - 110]) {
          fillPxRect(pitchCacheCtx, -276, py - 12, 42, 24, outline, px);
          fillPxRect(pitchCacheCtx, -272, py - 8, 34, 16, '#64748b', px);
        }
        // Grand Nordic Timber Apres-Ski Lodge with Warm Glowing Windows & Stone Chimney (x = -335, y = h * 0.28)
        const ldgX = -355;
        const ldgY = h * 0.24;
        fillPxRect(pitchCacheCtx, ldgX - 4, ldgY - 4, 118, 168, outline, px);
        fillPxRect(pitchCacheCtx, ldgX, ldgY, 110, 160, '#78350f', px);
        fillPxRect(pitchCacheCtx, ldgX + 8, ldgY + 8, 94, 144, '#92400e', px);
        fillPxRect(pitchCacheCtx, ldgX + 18, ldgY + 18, 36, 124, '#f8fafc', px); // Snow-covered gable ridge
        fillPxRect(pitchCacheCtx, ldgX + 72, ldgY - 14, 24, 24, outline, px); // Stone chimney
        fillPxRect(pitchCacheCtx, ldgX + 76, ldgY - 10, 16, 16, '#475569', px);
        for (let wy = ldgY + 28; wy < ldgY + 130; wy += 36) {
          fillPxRect(pitchCacheCtx, ldgX + 64, wy, 20, 22, '#fde047', px);
        }

        // NORTH QUADRANT (y < -165): Jagged Glacial Mountain Range & Ice-Crystal Citadel Gate
        for (let mx = 120; mx < w - 120; mx += 260) {
          const mh = 110 + ((mx * 17) % 65);
          fillPxRect(pitchCacheCtx, mx - 8, -205 - mh, 196, mh + 12, outline, px);
          fillPxRect(pitchCacheCtx, mx, -200 - mh, 180, mh, '#64748b', px);
          fillPxRect(pitchCacheCtx, mx + 18, -200 - mh, 144, mh * 0.58, '#bae6fd', px);
          fillPxRect(pitchCacheCtx, mx + 36, -200 - mh, 108, mh * 0.35, '#ffffff', px);
        }

        // SOUTH QUADRANT (y > h + 165): Orange Polar Research Geodome & Tracked Snowcats
        const resX = w * 0.34;
        const resY = h + 248;
        fillPxRect(pitchCacheCtx, resX - 58, resY - 58, 116, 116, outline, px);
        fillPxRect(pitchCacheCtx, resX - 52, resY - 52, 104, 104, '#ea580c', px);
        fillPxRect(pitchCacheCtx, resX - 38, resY - 38, 76, 76, '#f97316', px);
        fillPxRect(pitchCacheCtx, resX - 20, resY - 20, 40, 40, '#fef08a', px);
        // Tracked Red Arctic Snowcat Vehicle
        fillPxRect(pitchCacheCtx, resX + 110, resY - 22, 68, 44, outline, px);
        fillPxRect(pitchCacheCtx, resX + 116, resY - 16, 56, 32, '#ef4444', px);
        fillPxRect(pitchCacheCtx, resX + 128, resY - 10, 28, 20, '#38bdf8', px);

        for (const pt of [
          { x: -315, y: 120 },
          { x: -315, y: h - 140 },
          { x: 180, y: h + 235 },
          { x: w - 480, y: h + 238 },
          { x: w - 260, y: h + 230 },
        ]) {
          drawSnowPineTree(pitchCacheCtx, pt.x, pt.y, px);
        }
      } else if (selectedPitchTheme === 'VOLCANO_FORGE') {
        // === 6. VOLCANO FORGE: WEST TITAN CRUCIBLE SMELTERY, EAST DRAGON SKELETON & MINECART TRACK, NORTH CALDERA THRONE, SOUTH IRON DRAWBRIDGE ===
        pitchCacheCtx.fillStyle = '#27120b';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Asymmetric Molten Magma Sea on the East & South-East + Lava Channels
        fillPxRect(pitchCacheCtx, w + 180, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#9a3412', px);
        fillPxRect(pitchCacheCtx, w + 200, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#ea580c', px);
        fillPxRect(pitchCacheCtx, w + 228, -CACHE_PAD_Y, CACHE_PAD_X, h + CACHE_PAD_Y * 2, '#f97316', px);
        fillPxRect(pitchCacheCtx, -120, h + 195, w + 420, 120, '#ea580c', px);
        fillPxRect(pitchCacheCtx, -100, h + 210, w + 380, 90, '#facc15', px);

        // WEST QUADRANT (x < -165): Great Dwarven Titan Crucible Smeltery & Colossal Forge Anvil
        fillPxRect(pitchCacheCtx, -356, 110, 176, h - 220, outline, px);
        fillPxRect(pitchCacheCtx, -350, 116, 164, h - 232, '#18181b', px);
        fillPxRect(pitchCacheCtx, -336, 130, 136, h - 260, '#27272a', px);
        // Giant Tilted Molten Gold Crucible Vat (x = -268, y = 240)
        const vatX = -268;
        const vatY = 235;
        fillPxRect(pitchCacheCtx, vatX - 54, vatY - 54, 108, 108, outline, px);
        fillPxRect(pitchCacheCtx, vatX - 48, vatY - 48, 96, 96, '#3f3f46', px);
        fillPxRect(pitchCacheCtx, vatX - 36, vatY - 36, 72, 72, '#ea580c', px);
        fillPxRect(pitchCacheCtx, vatX - 24, vatY - 24, 48, 48, '#fde047', px);
        // Glowing Runic Lava Channel flowing South from Crucible to the Colossal Anvil (y = 290..h-260)
        fillPxRect(pitchCacheCtx, vatX - 14, vatY + 54, 28, h - 560, outline, px);
        fillPxRect(pitchCacheCtx, vatX - 10, vatY + 54, 20, h - 560, '#f97316', px);
        fillPxRect(pitchCacheCtx, vatX - 4, vatY + 54, 8, h - 560, '#fef08a', px);
        // Colossal Foundry Anvil & Twin Hammer Pedestal (y = h - 240)
        const anvY = h - 245;
        fillPxRect(pitchCacheCtx, vatX - 58, anvY - 42, 116, 84, outline, px);
        fillPxRect(pitchCacheCtx, vatX - 52, anvY - 36, 104, 72, '#52525b', px);
        fillPxRect(pitchCacheCtx, vatX - 38, anvY - 20, 76, 40, '#71717a', px);

        // EAST QUADRANT (x > w + 165): Colossal Bleached Dragon Skeleton in Lava Lake (Upper-East) & Iron Ore Minecart Trestle (Lower-East)
        // 2A. Ancient Dragon Skull & Curved Ribcage Bones emerging from the Magma (x = w + 265, y = 120..520)
        const drgX = w + 272;
        // Horned Dragon Skull
        fillPxRect(pitchCacheCtx, drgX - 44, 115, 88, 68, outline, px);
        fillPxRect(pitchCacheCtx, drgX - 38, 121, 76, 56, '#e2e8f0', px);
        fillPxRect(pitchCacheCtx, drgX - 58, 95, 24, 34, '#cbd5e1', px); // Left horn
        fillPxRect(pitchCacheCtx, drgX + 34, 95, 24, 34, '#cbd5e1', px); // Right horn
        fillPxRect(pitchCacheCtx, drgX - 24, 142, 14, 14, '#ef4444', px); // Glowing eye socket
        fillPxRect(pitchCacheCtx, drgX + 10, 142, 14, 14, '#ef4444', px);
        // Spine & 5 Pairs of Curved Rib Bones
        fillPxRect(pitchCacheCtx, drgX - 8, 185, 16, 285, '#cbd5e1', px);
        for (let rib = 0; rib < 5; rib++) {
          const ry = 205 + rib * 52;
          fillPxRect(pitchCacheCtx, drgX - 56, ry - 4, 112, 18, outline, px);
          fillPxRect(pitchCacheCtx, drgX - 52, ry, 104, 10, '#f1f5f9', px);
        }
        // 2B. Iron Trestle Minecart Rail Track (x = w + 248, y = h * 0.52 .. h + 160)
        const trkX = w + 248;
        fillPxRect(pitchCacheCtx, trkX - 22, h * 0.52, 44, h * 0.55, outline, px);
        fillPxRect(pitchCacheCtx, trkX - 16, h * 0.52, 32, h * 0.55, '#3f3f46', px);
        for (let tieY = h * 0.53; tieY < h + 140; tieY += 24) {
          fillPxRect(pitchCacheCtx, trkX - 20, tieY, 40, 8, '#78350f', px);
        }
        fillPxRect(pitchCacheCtx, trkX - 12, h * 0.52, 4, h * 0.55, '#94a3b8', px);
        fillPxRect(pitchCacheCtx, trkX + 8, h * 0.52, 4, h * 0.55, '#94a3b8', px);

        // NORTH QUADRANT (y < -165): Caldera Throne Gate, Lava Waterfalls & Crimson Ruby Spires
        for (const lwfX of [w * 0.26, w * 0.74]) {
          fillPxRect(pitchCacheCtx, lwfX - 64, -340, 128, 150, outline, px);
          fillPxRect(pitchCacheCtx, lwfX - 58, -334, 116, 138, '#3f3f46', px);
          fillPxRect(pitchCacheCtx, lwfX - 32, -334, 64, 138, '#f97316', px);
          fillPxRect(pitchCacheCtx, lwfX - 16, -334, 32, 138, '#fde047', px);
        }

        // SOUTH QUADRANT (y > h + 165): Heavy Iron-Chain Fortress Drawbridge Spanning the Southern Lava Moat
        const dbX = w * 0.5;
        fillPxRect(pitchCacheCtx, dbX - 96, h + 172, 192, 160, outline, px);
        fillPxRect(pitchCacheCtx, dbX - 88, h + 178, 176, 148, '#3f3f46', px);
        fillPxRect(pitchCacheCtx, dbX - 72, h + 186, 144, 132, '#52525b', px);
        fillPxRect(pitchCacheCtx, dbX - 84, h + 178, 12, 148, '#facc15', px); // Heavy brass/iron chains
        fillPxRect(pitchCacheCtx, dbX + 72, h + 178, 12, 148, '#facc15', px);

        // 8 Obsidian Fire Brazier Pedestals matched to live flames
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
          fillPxRect(pitchCacheCtx, bz.x - 18, bz.y - 18, 36, 36, outline, px);
          fillPxRect(pitchCacheCtx, bz.x - 14, bz.y - 14, 28, 28, '#3f3f46', px);
          fillPxRect(pitchCacheCtx, bz.x - 10, bz.y - 10, 20, 20, '#ea580c', px);
          fillPxRect(pitchCacheCtx, bz.x - 6, bz.y - 6, 12, 12, '#fde047', px);
        }
      } else if (selectedPitchTheme === 'TURF_AUTUMN') {
        // === 7. AUTUMN HARVEST TURF: WEST FARMERS MARKET & TRACTOR, EAST CIDER MILL WATERWHEEL & COVERED BRIDGE, NORTH BONFIRE STAGE, SOUTH HOT-AIR BALLOON MEADOW ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Organic Golden-Ochre Meadow Contours (No vertical stripes!)
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
        for (const patch of [
          { x: -340, y: 220, r: 240 },
          { x: -290, y: h - 260, r: 260 },
          { x: w + 320, y: 310, r: 250 },
          { x: w + 310, y: h - 320, r: 270 },
          { x: w * 0.3, y: -290, r: 280 },
          { x: w * 0.72, y: h + 290, r: 310 },
        ]) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.arc(patch.x, patch.y, patch.r, 0, Math.PI * 2);
          pitchCacheCtx.fill();
        }

        // EAST QUADRANT (x > w + 165): Babbling Autumn Brook, Stone Cider Mill with Waterwheel, Red Covered Bridge & Pumpkin Patch Maze
        const brkX = w + 245;
        fillPxRect(pitchCacheCtx, brkX - 42, -CACHE_PAD_Y, 84, h + CACHE_PAD_Y * 2, outline, px);
        fillPxRect(pitchCacheCtx, brkX - 36, -CACHE_PAD_Y, 72, h + CACHE_PAD_Y * 2, '#b45309', px);
        fillPxRect(pitchCacheCtx, brkX - 28, -CACHE_PAD_Y, 56, h + CACHE_PAD_Y * 2, '#0284c7', px);
        fillPxRect(pitchCacheCtx, brkX - 18, -CACHE_PAD_Y, 36, h + CACHE_PAD_Y * 2, '#38bdf8', px);
        // New England Red Timber Covered Bridge Spanning the Autumn Brook at y = h * 0.5
        drawArchedFootbridge(pitchCacheCtx, brkX, h * 0.5, 118, 72, 'COVERED', px);
        // Old Stone & Timber Cider Millhouse beside the Upper-East Brook (x = w + 315, y = 240)
        const millX = w + 315;
        const millY = 240;
        fillPxRect(pitchCacheCtx, millX - 46, millY - 58, 92, 116, outline, px);
        fillPxRect(pitchCacheCtx, millX - 40, millY - 52, 80, 104, '#78350f', px);
        fillPxRect(pitchCacheCtx, millX - 32, millY - 44, 64, 88, '#9a3412', px);
        fillPxRect(pitchCacheCtx, millX - 14, millY - 44, 28, 88, '#b45309', px);
        // Lower-East Giant Pumpkin Patch & Hay-Bale Maze (x = w + 310, y = h - 280)
        const mzX = w + 305;
        const mzY = h - 310;
        fillPxRect(pitchCacheCtx, mzX - 42, mzY - 68, 96, 148, outline, px);
        fillPxRect(pitchCacheCtx, mzX - 36, mzY - 62, 84, 136, '#eab308', px);
        fillPxRect(pitchCacheCtx, mzX - 20, mzY - 46, 52, 104, '#78350f', px);
        for (let py = -34; py <= 34; py += 22) {
          fillPxRect(pitchCacheCtx, mzX - 12, mzY + py, 14, 14, '#f97316', px);
          fillPxRect(pitchCacheCtx, mzX + 8, mzY + py + 4, 12, 12, '#ea580c', px);
        }

        // WEST QUADRANT (x < -165): Harvest Farmers' Market Plaza, Hot Cider Cauldron & Vintage Red Tractor
        fillPxRect(pitchCacheCtx, -342, h * 0.18, 152, h * 0.64, outline, px);
        fillPxRect(pitchCacheCtx, -336, h * 0.18 + 6, 140, h * 0.64 - 12, '#fed7aa', px);
        // L-Shaped Artisanal Market Stalls (Upper-West)
        for (const sy of [h * 0.22, h * 0.38]) {
          fillPxRect(pitchCacheCtx, -318, sy, 96, 56, outline, px);
          fillPxRect(pitchCacheCtx, -312, sy + 4, 84, 48, '#78350f', px);
          for (let st = 0; st < 4; st++) {
            fillPxRect(pitchCacheCtx, -308 + st * 19, sy + 8, 19, 16, st % 2 === 0 ? '#dc2626' : '#fef3c7', px);
          }
          fillPxRect(pitchCacheCtx, -296, sy + 30, 16, 14, '#f97316', px);
          fillPxRect(pitchCacheCtx, -268, sy + 30, 16, 14, '#facc15', px);
        }
        // Vintage Red Farm Tractor & Loaded Hay Wagon (Lower-West, y = h * 0.66)
        const trcX = -268;
        const trcY = h * 0.66;
        fillPxRect(pitchCacheCtx, trcX - 28, trcY - 42, 56, 48, outline, px);
        fillPxRect(pitchCacheCtx, trcX - 22, trcY - 36, 44, 36, '#dc2626', px);
        fillPxRect(pitchCacheCtx, trcX - 12, trcY - 28, 24, 20, '#fde047', px);
        fillPxRect(pitchCacheCtx, trcX - 32, trcY + 14, 64, 78, outline, px); // Hay wagon trailer
        fillPxRect(pitchCacheCtx, trcX - 26, trcY + 20, 52, 66, '#d97706', px);
        fillPxRect(pitchCacheCtx, trcX - 18, trcY + 28, 36, 50, '#facc15', px);

        // NORTH QUADRANT (y < -165): Harvest Festival Bonfire Circle & Timber Folk Stage
        const bfX = w * 0.35;
        const bfY = -238;
        fillPxRect(pitchCacheCtx, bfX - 44, bfY - 44, 88, 88, outline, px);
        fillPxRect(pitchCacheCtx, bfX - 38, bfY - 38, 76, 76, '#78350f', px);
        fillPxRect(pitchCacheCtx, bfX - 24, bfY - 24, 48, 48, '#451a03', px);
        fillPxRect(pitchCacheCtx, bfX - 14, bfY - 14, 28, 28, '#ea580c', px);
        fillPxRect(pitchCacheCtx, bfX - 8, bfY - 8, 16, 16, '#fde047', px);

        // SOUTH QUADRANT (y > h + 165): Hot-Air Balloon Launch Pad & Vineyard Cask Cellar
        const padX = w * 0.64;
        const padY = h + 248;
        fillPxRect(pitchCacheCtx, padX - 48, padY - 48, 96, 96, outline, px);
        fillPxRect(pitchCacheCtx, padX - 42, padY - 42, 84, 84, '#fef3c7', px);
        fillPxRect(pitchCacheCtx, padX - 28, padY - 28, 56, 56, '#d97706', px);

        // Diverse Autumn Trees (Crimson Maples, Tall Golden Ginkgos, White-Bark Silver Birches)
        for (const mp of [
          { x: -242, y: 92, s: 2, v: 0 },
          { x: -328, y: 175, s: 2, v: 1 },
          { x: -242, y: h - 92, s: 2, v: 2 },
          { x: -328, y: h - 180, s: 2, v: 3 },
          { x: w + 195, y: 96, s: 2, v: 1 },
          { x: w + 335, y: 112, s: 2, v: 0 },
          { x: w + 195, y: h - 96, s: 2, v: 2 },
          { x: w + 335, y: h - 118, s: 2, v: 1 },
          { x: 180, y: -234, s: 2, v: 0 },
          { x: 540, y: -242, s: 2, v: 1 },
          { x: w - 520, y: -238, s: 2, v: 2 },
          { x: w - 190, y: -232, s: 2, v: 3 },
          { x: 210, y: h + 236, s: 2, v: 2 },
          { x: 520, y: h + 242, s: 2, v: 0 },
          { x: w - 460, y: h + 238, s: 2, v: 1 },
          { x: w - 190, y: h + 234, s: 2, v: 0 },
        ]) {
          drawAutumnMapleTree(pitchCacheCtx, mp.x, mp.y, mp.s, mp.v, px);
        }
      } else if (selectedPitchTheme === 'TURF_SAKURA') {
        // === 8. SAKURA BLOSSOM TURF: WEST ARASHIYAMA BAMBOO GROVE & YATAI ALLEY, EAST WINDING KOI STREAM, TAIKO BRIDGE & 5-TIER PAGODA, NORTH ZEN ROCK SANCTUARY, SOUTH LANTERN PIER ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Raked Karesansui White Zen Gravel Sanctuary on the North & West Approaches
        fillPxRect(pitchCacheCtx, 180, -310, w - 360, 125, outline, px);
        fillPxRect(pitchCacheCtx, 186, -304, w - 372, 113, '#fdf2f8', px);
        pitchCacheCtx.strokeStyle = '#fbcfe8';
        pitchCacheCtx.lineWidth = 2;
        for (let ry = -292; ry < -202; ry += 12) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(200, ry);
          pitchCacheCtx.lineTo(w - 200, ry);
          pitchCacheCtx.stroke();
        }
        // Zen Mossy Rock Islands inside the North Karesansui Garden
        for (const rkX of [w * 0.32, w * 0.5, w * 0.68]) {
          fillPxRect(pitchCacheCtx, rkX - 32, -268, 64, 42, '#fbcfe8', px);
          fillPxRect(pitchCacheCtx, rkX - 22, -260, 44, 26, outline, px);
          fillPxRect(pitchCacheCtx, rkX - 18, -256, 36, 18, '#475569', px);
          fillPxRect(pitchCacheCtx, rkX - 10, -252, 18, 10, '#16a34a', px);
        }

        // EAST QUADRANT (x > w + 165): Winding Imperial Turquoise Koi Stream, Arched Vermilion Taiko-Bashi Bridge, Five-Tier Pagoda & Matcha Tea House
        const koiStreamX = w + 236;
        fillPxRect(pitchCacheCtx, koiStreamX - 44, -CACHE_PAD_Y, 88, h + CACHE_PAD_Y * 2, outline, px);
        fillPxRect(pitchCacheCtx, koiStreamX - 38, -CACHE_PAD_Y, 76, h + CACHE_PAD_Y * 2, '#94a3b8', px);
        fillPxRect(pitchCacheCtx, koiStreamX - 30, -CACHE_PAD_Y, 60, h + CACHE_PAD_Y * 2, '#0284c7', px);
        fillPxRect(pitchCacheCtx, koiStreamX - 20, -CACHE_PAD_Y, 40, h + CACHE_PAD_Y * 2, '#38bdf8', px);
        // Floating green lily pads & pink lotus blossoms in the Koi Stream
        for (const ly of [180, 340, 560, h - 520, h - 310, h - 160]) {
          fillPxRect(pitchCacheCtx, koiStreamX - 18 + ((ly * 7) % 22), ly, 14, 14, '#16a34a', px);
          fillPxRect(pitchCacheCtx, koiStreamX - 14 + ((ly * 7) % 22), ly + 4, 6, 6, '#f472b6', px);
        }
        // Vermilion Taiko-Bashi Arched Drum Bridge spanning the Koi Stream at y = h * 0.5
        drawArchedFootbridge(pitchCacheCtx, koiStreamX, h * 0.5, 116, 68, 'TAIKO', px);
        // Five-Tiered Kyoto Timber Pagoda on the Upper-East Terrace (x = w + 335, y = 215)
        drawFiveTierPagoda(pitchCacheCtx, w + 335, 215, px);
        // Traditional Matcha Tea House with Tatami Veranda & Red Paper Lanterns on Lower-East (x = w + 330, y = h - 235)
        const teaX = w + 330;
        const teaY = h - 235;
        fillPxRect(pitchCacheCtx, teaX - 48, teaY - 62, 96, 124, outline, px);
        fillPxRect(pitchCacheCtx, teaX - 42, teaY - 56, 84, 112, '#78350f', px);
        fillPxRect(pitchCacheCtx, teaX - 34, teaY - 48, 68, 96, '#fef08a', px); // Warm glowing shoji & tatami
        fillPxRect(pitchCacheCtx, teaX - 26, teaY - 40, 52, 80, '#334155', px); // Tiled irimoya roof
        fillPxRect(pitchCacheCtx, teaX - 46, teaY - 36, 10, 14, '#ef4444', px); // Chochin lantern
        fillPxRect(pitchCacheCtx, teaX - 46, teaY + 22, 10, 14, '#ef4444', px);

        // WEST QUADRANT (x < -165): Arashiyama Emerald Bamboo Forest Grove, Senbon Torii Procession & Ramen Yatai Stalls
        // Senbon Torii Vermilion Gate Colonade leading to the West Gate (y = h * 0.5)
        fillPxRect(pitchCacheCtx, -365, h * 0.5 - 48, 195, 96, outline, px);
        fillPxRect(pitchCacheCtx, -359, h * 0.5 - 42, 183, 84, '#fdf2f8', px);
        for (const tx of [-335, -285, -235]) {
          const gy = h * 0.5 - 32;
          fillPxRect(pitchCacheCtx, tx - 4, gy - 4, 28, 68, outline, px);
          fillPxRect(pitchCacheCtx, tx, gy, 6, 60, '#dc2626', px);
          fillPxRect(pitchCacheCtx, tx + 14, gy, 6, 60, '#dc2626', px);
          fillPxRect(pitchCacheCtx, tx - 6, gy - 6, 32, 8, '#ef4444', px);
          fillPxRect(pitchCacheCtx, tx - 4, gy + 48, 28, 6, '#ef4444', px);
        }
        // Ramen & Takoyaki Yatai Festival Carts with Indigo Noren Curtains (Lower-West, y = h - 380 .. h - 190)
        for (const yataiY of [h - 360, h - 240]) {
          fillPxRect(pitchCacheCtx, -308, yataiY - 38, 68, 76, outline, px);
          fillPxRect(pitchCacheCtx, -302, yataiY - 32, 56, 64, '#92400e', px);
          fillPxRect(pitchCacheCtx, -294, yataiY - 24, 40, 48, '#1e3a8a', px); // Indigo noren curtain
          fillPxRect(pitchCacheCtx, -252, yataiY - 22, 12, 14, '#ef4444', px);
          fillPxRect(pitchCacheCtx, -252, yataiY + 8, 12, 14, '#fde047', px);
        }

        // Mixed Kyoto Flora: Arashiyama Bamboo Clusters (v=1), Cloud-Pruned Niwaki Pines (v=2), and Weeping Sakura (v=0,3)
        for (const sk of [
          { x: -242, y: 110, s: 2, v: 1 },
          { x: -315, y: 185, s: 2, v: 1 },
          { x: -248, y: 270, s: 2, v: 1 },
          { x: -322, y: 340, s: 2, v: 2 },
          { x: -238, y: h - 105, s: 2, v: 0 },
          { x: -328, y: h - 145, s: 2, v: 3 },
          { x: w + 185, y: 105, s: 2, v: 0 },
          { x: w + 185, y: h - 105, s: 2, v: 2 },
          { x: 140, y: -234, s: 2, v: 0 },
          { x: w - 140, y: -234, s: 2, v: 3 },
          { x: 220, y: h + 234, s: 2, v: 0 },
          { x: 520, y: h + 240, s: 2, v: 2 },
          { x: w - 520, y: h + 240, s: 2, v: 1 },
          { x: w - 220, y: h + 234, s: 2, v: 0 },
        ]) {
          drawSakuraBlossomTree(pitchCacheCtx, sk.x, sk.y, sk.s, sk.v, px);
        }
      } else if (selectedPitchTheme === 'TURF_CHAMPIONS') {
        // === 9. CHAMPIONS CATHEDRAL: WEST VIP RED CARPET & HOLOGRAM ROTUNDA, EAST HALL OF FAME DOME & FAN FEST, NORTH TRIUMPHAL ARCH & BANNERS, SOUTH EXPRESS RAIL VIADUCT ===
        pitchCacheCtx.fillStyle = '#0b132b';
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Grand European Chevron Granite Piazza Paving
        pitchCacheCtx.strokeStyle = 'rgba(30, 58, 138, 0.45)';
        pitchCacheCtx.lineWidth = 3;
        for (let gx = -CACHE_PAD_X; gx < w + CACHE_PAD_X; gx += 180) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.moveTo(gx, -CACHE_PAD_Y);
          pitchCacheCtx.lineTo(gx, h + CACHE_PAD_Y);
          pitchCacheCtx.stroke();
        }

        // WEST QUADRANT (x < -165): VIP Red-Carpet Arrival Boulevard, Starlight Team Coaches & Golden Cup Hologram Rotunda
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 64, CACHE_PAD_X - STADIUM_BOWL_PAD + 12, 128, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 58, CACHE_PAD_X - STADIUM_BOWL_PAD + 12, 116, '#1e1b4b', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 28, CACHE_PAD_X - STADIUM_BOWL_PAD + 12, 56, '#b91c1c', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 - 32, CACHE_PAD_X - STADIUM_BOWL_PAD + 12, 4, '#fde047', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, h * 0.5 + 28, CACHE_PAD_X - STADIUM_BOWL_PAD + 12, 4, '#fde047', px);
        // Starlight Champions Team Coaches on West Arrival Plaza
        drawTeamCoachBus(pitchCacheCtx, -268, 220, '#1e3a8a', '#fde047', px);
        drawTeamCoachBus(pitchCacheCtx, -268, h - 220, '#991b1b', '#f8fafc', px);
        // Golden Cup Hologram Rotunda Plinth (x = -255, y = h * 0.5)
        fillPxRect(pitchCacheCtx, -288, h * 0.5 - 34, 68, 68, outline, px);
        fillPxRect(pitchCacheCtx, -282, h * 0.5 - 28, 56, 56, '#172554', px);
        fillPxRect(pitchCacheCtx, -270, h * 0.5 - 16, 32, 32, '#facc15', px);
        fillPxRect(pitchCacheCtx, -262, h * 0.5 - 8, 16, 16, '#ffffff', px);

        // EAST QUADRANT (x > w + 165): Glass-Domed Champions Hall of Fame Museum & Fan-Fest Jumbotron Piazza
        drawBotanicalGlasshouse(pitchCacheCtx, w + 265, 250, px);
        // Fan-Fest Piazza with Giant LED Screen & Festival Tables (Lower-East, y = h - 380..h - 140)
        const ffX = w + 206;
        const ffY = h - 380;
        fillPxRect(pitchCacheCtx, ffX - 4, ffY - 4, 136, 240, outline, px);
        fillPxRect(pitchCacheCtx, ffX, ffY, 128, 232, '#1e293b', px);
        fillPxRect(pitchCacheCtx, ffX + 14, ffY + 14, 100, 44, '#0284c7', px); // Giant Fan-Fest Jumbotron
        fillPxRect(pitchCacheCtx, ffX + 22, ffY + 22, 84, 28, '#38bdf8', px);
        for (let tblY = ffY + 82; tblY < ffY + 210; tblY += 44) {
          fillPxRect(pitchCacheCtx, ffX + 20, tblY, 88, 24, '#78350f', px);
          fillPxRect(pitchCacheCtx, ffX + 28, tblY + 6, 72, 12, '#fde047', px);
        }

        // NORTH QUADRANT (y < -165): Monumental Neoclassical Triumphal Arch & Colonnade of 10 Distinct Club Heraldic Banners
        const archX = w * 0.5;
        const archY = -255;
        fillPxRect(pitchCacheCtx, archX - 118, archY - 46, 236, 92, outline, px);
        fillPxRect(pitchCacheCtx, archX - 112, archY - 40, 224, 80, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, archX - 96, archY - 28, 192, 56, '#e2e8f0', px);
        fillPxRect(pitchCacheCtx, archX - 42, archY - 40, 84, 80, '#0f172a', px); // Central vaulted passage
        fillPxRect(pitchCacheCtx, archX - 24, archY - 16, 48, 32, '#facc15', px); // Golden quadriga crest on crown
        // 10 Distinct European Club Heraldic Banners Flanking the Triumphal Arch
        const bannerColors = ['#ef4444', '#38bdf8', '#facc15', '#10b981', '#a855f7', '#f97316', '#ec4899', '#ffffff', '#22d3ee', '#eab308'];
        for (let bIdx = 0; bIdx < 10; bIdx++) {
          const bx = bIdx < 5 ? 180 + bIdx * 175 : w - 180 - (9 - bIdx) * 175;
          const bCol = bannerColors[bIdx];
          fillPxRect(pitchCacheCtx, bx - 22, -248, 44, 56, outline, px);
          fillPxRect(pitchCacheCtx, bx - 18, -244, 36, 48, '#1e3a8a', px);
          fillPxRect(pitchCacheCtx, bx - 12, -238, 24, 36, bCol, px);
          fillPxRect(pitchCacheCtx, bx - 6, -230, 12, 16, '#fde047', px);
        }

        // SOUTH QUADRANT (y > h + 165): European High-Speed Rail Stone Viaduct & Choreographed Golden Fountains
        const viaY = h + 245;
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, viaY - 26, w + CACHE_PAD_X * 2, 52, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, viaY - 20, w + CACHE_PAD_X * 2, 40, '#334155', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, viaY - 8, w + CACHE_PAD_X * 2, 16, '#475569', px);
        drawParkFountain(pitchCacheCtx, w * 0.28, h + 195, 24, px);
        drawParkFountain(pitchCacheCtx, w * 0.72, h + 195, 24, px);
      } else {
        // === 10. CLASSIC SUNLIT TURF: WEST VIP ARRIVAL & BROADCAST COMPOUND, EAST SERPENTINE BOTANICAL CANAL & GLASSHOUSE, NORTH FAN PLAZA & 1v1 CAGE, SOUTH METRO STATION & AMPHITHEATER ===
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.base;
        pitchCacheCtx.fillRect(-CACHE_PAD_X, -CACHE_PAD_Y, w + CACHE_PAD_X * 2, h + CACHE_PAD_Y * 2);

        // Organic Sunlit Meadow Contours (Replaces repetitive vertical stripes!)
        pitchCacheCtx.fillStyle = GRAPHICS_CONFIG.palette.apron.dither;
        for (const hill of [
          { x: -340, y: 190, r: 260 },
          { x: -320, y: h - 210, r: 250 },
          { x: w + 380, y: 240, r: 280 },
          { x: w + 360, y: h - 220, r: 290 },
          { x: w * 0.25, y: -310, r: 270 },
          { x: w * 0.75, y: -290, r: 260 },
          { x: w * 0.5, y: h + 320, r: 320 },
        ]) {
          pitchCacheCtx.beginPath();
          pitchCacheCtx.arc(hill.x, hill.y, hill.r, 0, Math.PI * 2);
          pitchCacheCtx.fill();
        }

        // EAST QUADRANT (x > w + 165): Winding Serpentine Botanical Canal, Arched Red-Brick Footbridge, Rowboat Pier & Victorian Glasshouse Conservatory
        const canalX = w + 238;
        // Limestone Canal Embankment & Shimmering Water Channel running North-to-South on the East side
        fillPxRect(pitchCacheCtx, canalX - 44, -CACHE_PAD_Y, 88, h + CACHE_PAD_Y * 2, outline, px);
        fillPxRect(pitchCacheCtx, canalX - 38, -CACHE_PAD_Y, 76, h + CACHE_PAD_Y * 2, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, canalX - 30, -CACHE_PAD_Y, 60, h + CACHE_PAD_Y * 2, '#0284c7', px);
        fillPxRect(pitchCacheCtx, canalX - 20, -CACHE_PAD_Y, 40, h + CACHE_PAD_Y * 2, '#38bdf8', px);
        // Water lily pads along the canal banks
        for (const ly of [140, 320, 610, h - 540, h - 290, h - 130]) {
          fillPxRect(pitchCacheCtx, canalX - 22 + ((ly * 5) % 26), ly, 12, 12, '#16a34a', px);
          fillPxRect(pitchCacheCtx, canalX - 19 + ((ly * 5) % 26), ly + 3, 6, 6, '#fde047', px);
        }
        // Sandstone Promenade connecting East Stadium Gate to the Arched Brick Footbridge
        fillPxRect(pitchCacheCtx, w + STADIUM_BOWL_PAD, h * 0.5 - 44, 190, 88, outline, px);
        fillPxRect(pitchCacheCtx, w + STADIUM_BOWL_PAD, h * 0.5 - 38, 190, 76, '#e2e8f0', px);
        drawArchedFootbridge(pitchCacheCtx, canalX, h * 0.5, 118, 72, 'BRICK', px);
        // Upper-East Timber Rowboat Pier & Lakeside Gazebo (y = 210)
        fillPxRect(pitchCacheCtx, canalX + 24, 185, 68, 32, outline, px);
        fillPxRect(pitchCacheCtx, canalX + 28, 189, 60, 24, '#92400e', px);
        // Lower-East Victorian Glasshouse Conservatory Dome (x = w + 345, y = h - 255)
        drawBotanicalGlasshouse(pitchCacheCtx, w + 345, h - 255, px);

        // WEST QUADRANT (x < -165): VIP Team Arrival Roundabout, Luxury Team Coach Bus, TV Broadcast OB Van & Supporters Bistro Plaza
        // Cobblestone VIP Arrival Roundabout at y = h * 0.5
        fillPxRect(pitchCacheCtx, -365, h * 0.5 - 76, 205, 152, outline, px);
        fillPxRect(pitchCacheCtx, -359, h * 0.5 - 70, 193, 140, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, -345, h * 0.5 - 56, 165, 112, '#e2e8f0', px);
        fillPxRect(pitchCacheCtx, -245, h * 0.5 - 24, 84, 48, '#ef4444', px); // VIP Red Carpet into West Gate
        fillPxRect(pitchCacheCtx, -315, h * 0.5 - 28, 56, 56, '#15803d', px); // Roundabout central topiary island
        fillPxRect(pitchCacheCtx, -303, h * 0.5 - 16, 32, 32, '#22c55e', px);
        // Upper-West: TV Outside Broadcast (OB) Production Van & Team Coach Bus (y = 140..440)
        fillPxRect(pitchCacheCtx, -338, 125, 132, 310, outline, px);
        fillPxRect(pitchCacheCtx, -332, 131, 120, 298, '#94a3b8', px);
        // TV Broadcast OB Van at (-255, 205) — Roof Dish rotates live in drawPitch()!
        fillPxRect(pitchCacheCtx, -284, 152, 58, 108, outline, px);
        fillPxRect(pitchCacheCtx, -278, 158, 46, 96, '#f8fafc', px);
        fillPxRect(pitchCacheCtx, -272, 166, 34, 80, '#0284c7', px);
        // Home Team Luxury Coach Bus at (-258, 345)
        drawTeamCoachBus(pitchCacheCtx, -258, 345, '#0284c7', '#fde047', px);
        // Lower-West: Supporters Espresso Bistro, Merch Kiosk & Parasol Patio (y = h - 435..h - 125)
        fillPxRect(pitchCacheCtx, -338, h - 435, 132, 310, outline, px);
        fillPxRect(pitchCacheCtx, -332, h - 429, 120, 298, '#fed7aa', px);
        fillPxRect(pitchCacheCtx, -320, h - 405, 76, 128, outline, px);
        fillPxRect(pitchCacheCtx, -314, h - 399, 64, 116, '#b91c1c', px);
        for (let st = 0; st < 5; st++) {
          fillPxRect(pitchCacheCtx, -310, h - 395 + st * 22, 56, 11, '#f8fafc', px);
        }
        drawBeachUmbrella(pitchCacheCtx, -238, h - 225, '#0ea5e9', '#fef08a', px);
        drawBeachUmbrella(pitchCacheCtx, -292, h - 185, '#f43f5e', '#ffffff', px);

        // NORTH QUADRANT (y < -165): Grand Champions Fan Rotunda, Food Truck Court (NW) & 1v1 Kids Warm-Up Street Cage (NE)
        // Center-North Golden Statue Rotunda (x = w * 0.5, y = -242)
        const rotX = w * 0.5;
        const rotY = -242;
        fillPxRect(pitchCacheCtx, rotX - 68, rotY - 48, 136, 96, outline, px);
        fillPxRect(pitchCacheCtx, rotX - 62, rotY - 42, 124, 84, '#e2e8f0', px);
        fillPxRect(pitchCacheCtx, rotX - 46, rotY - 28, 92, 56, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, rotX - 22, rotY - 22, 44, 44, outline, px);
        fillPxRect(pitchCacheCtx, rotX - 18, rotY - 18, 36, 36, '#facc15', px);
        fillPxRect(pitchCacheCtx, rotX - 8, rotY - 8, 16, 16, '#fef08a', px);
        // North-West Festival Food Trucks (x = 340..780, y = -242)
        for (const ft of [
          { x: 380, y: -242, col: '#f472b6', roof: '#fce7f3' },
          { x: 560, y: -242, col: '#38bdf8', roof: '#e0f2fe' },
          { x: 740, y: -242, col: '#facc15', roof: '#fef9c3' },
        ]) {
          fillPxRect(pitchCacheCtx, ft.x - 48, ft.y - 26, 96, 52, outline, px);
          fillPxRect(pitchCacheCtx, ft.x - 42, ft.y - 20, 84, 40, ft.col, px);
          fillPxRect(pitchCacheCtx, ft.x - 30, ft.y - 12, 60, 24, ft.roof, px);
        }
        // North-East Mini 1v1 Kids Warm-Up Cage Pitch (x = w - 680 .. w - 420, y = -242)
        const miniX = w - 660;
        const miniY = -282;
        const miniW = 210;
        const miniH = 88;
        fillPxRect(pitchCacheCtx, miniX - 6, miniY - 6, miniW + 12, miniH + 12, outline, px);
        fillPxRect(pitchCacheCtx, miniX, miniY, miniW, miniH, '#10b981', px);
        fillPxRect(pitchCacheCtx, miniX + 6, miniY + 6, miniW - 12, miniH - 12, '#34d399', px);
        pitchCacheCtx.strokeStyle = '#ffffff';
        pitchCacheCtx.lineWidth = 2;
        pitchCacheCtx.strokeRect(miniX + 8, miniY + 8, miniW - 16, miniH - 16);
        fillPxRect(pitchCacheCtx, miniX + miniW * 0.5 - 1, miniY + 8, 2, miniH - 16, '#ffffff', px);

        // SOUTH QUADRANT (y > h + 165): Stadium Express Metro Rail Platform (SW), Sunken Amphitheater (Center) & Rose Cascade (SE)
        // Commuter Rail Track running along y = h + 252
        const railY = h + 252;
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, railY - 20, w + 340, 40, outline, px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, railY - 14, w + 340, 28, '#475569', px);
        for (let tieX = -CACHE_PAD_X + 16; tieX < w + 180; tieX += 26) {
          fillPxRect(pitchCacheCtx, tieX, railY - 12, 10, 24, '#78350f', px);
        }
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, railY - 7, w + 340, 4, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, -CACHE_PAD_X, railY + 3, w + 340, 4, '#cbd5e1', px);
        // Glass-Canopy Metro Station Platform (x = 240..720, y = h + 196)
        fillPxRect(pitchCacheCtx, 240, h + 190, 460, 44, outline, px);
        fillPxRect(pitchCacheCtx, 246, h + 196, 448, 32, '#cbd5e1', px);
        fillPxRect(pitchCacheCtx, 280, h + 200, 380, 24, '#38bdf8', px);
        // South-East Ornamental Fountain & Rose Parterre (x = w - 420, y = h + 205)
        drawParkFountain(pitchCacheCtx, w - 380, h + 204, 28, px);

        // Scatter Wildflower Clusters across the Meadows
        const flowerPalette = GRAPHICS_CONFIG.palette.apron.flowerColors;
        for (let i = 0; i < 48; i++) {
          const fx = (i % 2 === 0 ? -390 : w + 295) + ((i * 37) % 85);
          const fy = 60 + ((i * 163) % (h - 120));
          if (fx < 0 && fy > 110 && fy < h - 110) continue; // Keep clear of West paved plazas
          if (fx > w && fy > h - 340 && fy < h - 170) continue; // Keep clear of East Glasshouse
          const col = flowerPalette[i % flowerPalette.length];
          fillPxRect(pitchCacheCtx, fx, fy + px, px * 2, px * 2, '#34a86c', px);
          fillPxRect(pitchCacheCtx, fx - px, fy, px * 3, px * 2, col, px);
          fillPxRect(pitchCacheCtx, fx, fy, px, px, '#fef08a', px);
        }

        // Diverse Botanical Trees (Variant 0 = Multi-Oak, 1 = Cypress Spire, 2 = Weeping Willow by Canal, 3 = Blooming Jacaranda)
        const treePositions = [
          { x: -242, y: 78, s: 2, v: 0 },
          { x: -338, y: 88, s: 2, v: 3 },
          { x: -242, y: h - 78, s: 2, v: 3 },
          { x: -342, y: h - 92, s: 2, v: 1 },
          { x: w + 188, y: 96, s: 2, v: 2 }, // Weeping willow overhanging upper canal
          { x: w + 318, y: 112, s: 2, v: 0 },
          { x: w + 188, y: 365, s: 2, v: 2 }, // Weeping willow overhanging mid canal
          { x: w + 188, y: h - 355, s: 2, v: 1 }, // Cypress beside glasshouse approach
          { x: w + 188, y: h - 92, s: 2, v: 2 }, // Weeping willow overhanging lower canal
          { x: 175, y: -234, s: 2, v: 0 },
          { x: 920, y: -238, s: 2, v: 1 },
          { x: w - 920, y: -238, s: 2, v: 3 },
          { x: w - 175, y: -234, s: 2, v: 2 },
          { x: 165, y: h + 206, s: 2, v: 1 },
          { x: w * 0.54, y: h + 204, s: 2, v: 0 },
          { x: w - 210, y: h + 206, s: 2, v: 3 },
        ];
        for (const tr of treePositions) {
          drawPixelTree(pitchCacheCtx, tr.x, tr.y, tr.s, tr.v, px);
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

    // User Profile State (Name + Preset Icon or Camera Photo + Ranked Progression + Balance + Pokie Jackpots + Shop Unlocks)
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
      unlockedStadiums: PitchThemeId[];
      unlockedPokies: PokieMachineId[];
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
    let pokieModalScreen: 'LOBBY' | 'CABINET' = 'LOBBY';
    let selectedTournamentTier: TournamentTierId = 'CUP_100';
    let pendingJackpotChallenge: JackpotChallengeState | null = null;
    let activeJackpotChallenge: JackpotChallengeState | null = null;

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
        HIGH_ROLLER_ROYAL: POKIE_MACHINES.HIGH_ROLLER_ROYAL.baseJackpot10,
      },
      unlockedStadiums: [...DEFAULT_UNLOCKED_STADIUMS],
      unlockedPokies: [...DEFAULT_UNLOCKED_POKIES],
    };

    try {
      const saved = localStorage.getItem('rematch_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string') {
          const parsedMj = parsed.machineJackpots || {};
          const validStadIds = new Set<string>(PITCH_THEMES.map((t) => t.id));
          const savedStadiums = Array.isArray(parsed.unlockedStadiums)
            ? (parsed.unlockedStadiums.filter((id: unknown) => typeof id === 'string' && validStadIds.has(id)) as PitchThemeId[])
            : [];
          if (!savedStadiums.includes('CLASSIC_TURF')) savedStadiums.unshift('CLASSIC_TURF');

          const validPokieIds = new Set<string>(POKIE_MACHINE_LIST.map((m) => m.id));
          const savedPokies = Array.isArray(parsed.unlockedPokies)
            ? (parsed.unlockedPokies.filter((id: unknown) => typeof id === 'string' && validPokieIds.has(id)) as PokieMachineId[])
            : [];
          if (!savedPokies.includes('CHAMPIONS_GOLD')) savedPokies.unshift('CHAMPIONS_GOLD');

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
              HIGH_ROLLER_ROYAL:
                typeof parsedMj.HIGH_ROLLER_ROYAL === 'number' && parsedMj.HIGH_ROLLER_ROYAL >= POKIE_MACHINES.HIGH_ROLLER_ROYAL.baseJackpot10
                  ? Math.floor(parsedMj.HIGH_ROLLER_ROYAL)
                  : POKIE_MACHINES.HIGH_ROLLER_ROYAL.baseJackpot10,
            },
            unlockedStadiums: savedStadiums,
            unlockedPokies: savedPokies,
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
      if (auth.currentUser) {
        void syncProfileToFirestoreLeaderboard({
          name: userProfile.name,
          iconType: userProfile.iconType,
          presetIcon: userProfile.presetIcon,
          photoDataUrl: userProfile.photoDataUrl,
          rankedWins: userProfile.rankedWins,
          rankedMatches: userProfile.rankedMatches,
          balance: userProfile.balance,
        });
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
      return computeMatchDifficultyProfile(
        currentGameMode,
        userProfile.rankedWins,
        tournamentRound,
        selectedTournamentTier
      );
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

      const progressSummary = computeRankProgressSummary(
        userProfile.rankedWins,
        userProfile.rankedWins,
        userProfile.rankedMatches,
        userProfile.rankedMatches
      );

      if (menuNameEl) menuNameEl.innerText = userProfile.name;
      if (menuRankBadgeEl) {
        menuRankBadgeEl.innerHTML = `${getRankCrestSvgHtml(rankInfo, 'w-3.5 h-3.5')}<span>${rankInfo.name}</span><span class="opacity-75 font-mono-num">• LVL ${progressSummary.clubLevel}</span>`;
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
      const pokieLobbyBalEl = document.getElementById('pokieLobbyBalanceText');
      const slotJackpotEl = document.getElementById('slotJackpotDisplay');
      const slotSpinsLeftEl = document.getElementById('slotSpinsLeftDisplay');

      if (!userProfile.machineJackpots) {
        userProfile.machineJackpots = {
          CHAMPIONS_GOLD: POKIE_MACHINES.CHAMPIONS_GOLD.baseJackpot10,
          COSMIC_NEON: POKIE_MACHINES.COSMIC_NEON.baseJackpot10,
          VOLCANO_INFERNO: POKIE_MACHINES.VOLCANO_INFERNO.baseJackpot10,
          HIGH_ROLLER_ROYAL: POKIE_MACHINES.HIGH_ROLLER_ROYAL.baseJackpot10,
        };
      }
      if (!userProfile.machineJackpots.HIGH_ROLLER_ROYAL) {
        userProfile.machineJackpots.HIGH_ROLLER_ROYAL = POKIE_MACHINES.HIGH_ROLLER_ROYAL.baseJackpot10;
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
        ovRankBadge.innerHTML = `${getRankCrestSvgHtml(rankInfo, 'w-3.5 h-3.5')}<span>${rankInfo.name}</span>`;
        ovRankBadge.style.backgroundColor = rankInfo.badgeBgHex;
        ovRankBadge.style.color = rankInfo.badgeTextHex;
        ovRankBadge.style.borderColor = rankInfo.borderHex;
      }
      const ovRankSymbolBox = document.getElementById('overviewRankSymbolBox');
      if (ovRankSymbolBox) {
        ovRankSymbolBox.innerHTML = getRankCrestSvgHtml(rankInfo, 'w-9 h-9');
        ovRankSymbolBox.style.backgroundColor = rankInfo.badgeBgHex;
        ovRankSymbolBox.style.borderColor = rankInfo.borderHex;
      }
      const ovClubLevelBadge = document.getElementById('overviewClubLevelBadge');
      if (ovClubLevelBadge) {
        ovClubLevelBadge.innerText = `CLUB LVL ${progressSummary.clubLevel}`;
      }
      const ovRankPointsText = document.getElementById('overviewRankPointsText');
      if (ovRankPointsText) {
        ovRankPointsText.innerText = `${progressSummary.rankPoints} RP`;
      }
      const ovLevelXpText = document.getElementById('overviewLevelXpText');
      if (ovLevelXpText) {
        ovLevelXpText.innerText = `${progressSummary.xpInCurrentLevel} / ${progressSummary.xpForNextLevel} XP TO LVL ${progressSummary.clubLevel + 1}`;
      }
      const ovLevelProgressBar = document.getElementById('overviewLevelProgressBar');
      if (ovLevelProgressBar) {
        ovLevelProgressBar.style.width = `${progressSummary.levelProgressPct}%`;
      }
      RANK_TIERS.forEach((tier, idx) => {
        const nodeEl = document.getElementById(`overviewTierNode${idx}`);
        if (!nodeEl) return;
        const isReached = idx <= rankInfo.index;
        const isCurrent = idx === rankInfo.index;
        nodeEl.style.backgroundColor = isReached ? tier.badgeBgHex : '#f1f5f9';
        nodeEl.style.borderColor = isReached ? tier.borderHex : '#cbd5e1';
        nodeEl.style.transform = isCurrent ? 'scale(1.12)' : 'scale(1)';
        nodeEl.style.opacity = isReached ? '1' : '0.55';
      });
      if (menuBalanceTextEl) {
        menuBalanceTextEl.innerText = `$${userProfile.balance.toLocaleString()}`;
      }
      if (ovBalanceBadge) {
        ovBalanceBadge.innerText = `$${userProfile.balance.toLocaleString()}`;
      }
      if (slotBalEl) {
        slotBalEl.innerText = `$${userProfile.balance.toLocaleString()}`;
      }
      if (pokieLobbyBalEl) {
        pokieLobbyBalEl.innerText = `$${userProfile.balance.toLocaleString()}`;
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
          const previewBet = m.allowedBets.includes(selectedPokieBet) ? selectedPokieBet : m.defaultBet;
          const eff = getMachineEffectiveJackpot(m.id, previewBet, userProfile.machineJackpots[m.id]);
          mJpEl.innerText = `$${eff.toLocaleString()}`;
        }
      }
      if (slotSpinsLeftEl) {
        const spinsAvailable = Math.floor(userProfile.balance / selectedPokieBet);
        slotSpinsLeftEl.innerText = `${spinsAvailable} ${spinsAvailable === 1 ? 'SPIN' : 'SPINS'} READY`;
      }
      if (ovWinsText) {
        ovWinsText.innerText = `${userProfile.rankedWins} ${userProfile.rankedWins === 1 ? 'Win' : 'Wins'} • Div ${rankInfo.divisionNumeral}`;
      }
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

    function syncTournamentTierSelectorUI() {
      const tourneyTierWrap = document.getElementById('tournamentTierSelectorWrap');
      const tourneyEntryBanner = document.getElementById('tourneyEntryStatusBanner');
      if (tourneyTierWrap) {
        const showTierSelector = currentGameMode === 'TOURNAMENT' && gameState !== 'PAUSED' && gameState !== 'MATCH_OVER';
        tourneyTierWrap.classList.toggle('hidden', !showTierSelector);
      }
      for (const tier of TOURNAMENT_TIER_LIST) {
        const btn = document.getElementById(`tourneyTierBtn_${tier.id}`);
        if (!btn) continue;
        const isSelected = tier.id === selectedTournamentTier;
        btn.className = isSelected
          ? 'tourney-tier-btn p-2 rounded-2xl border-[2.5px] border-slate-900 shadow-[0_3px_0_#0f172a] text-left transition-all cursor-pointer scale-[1.02]'
          : 'tourney-tier-btn p-2 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-left transition-all cursor-pointer opacity-85 hover:opacity-100';
        btn.style.backgroundColor = isSelected ? tier.badgeBgHex : '#ffffff';
      }
      if (tourneyEntryBanner && currentGameMode !== 'TOURNAMENT') {
        tourneyEntryBanner.classList.add('hidden');
      }
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
      syncTournamentTierSelectorUI();
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

      // 4. Update Tournament or Jackpot Challenge HUD Badge & Ensure Bracket Initialized
      const hudTourneyBadge = document.getElementById('hudTourneyBadge');
      if (activeJackpotChallenge && activeJackpotChallenge.active) {
        if (hudTourneyBadge) {
          hudTourneyBadge.classList.remove('hidden');
          hudTourneyBadge.classList.add('inline-flex');
          hudTourneyBadge.innerText = `🎰 $${activeJackpotChallenge.jackpotPrize.toLocaleString()} JACKPOT • 30s GOAL CHALLENGE`;
        }
      } else if (currentGameMode === 'TOURNAMENT') {
        if (!tournamentBracket.initialized) {
          initTournamentBracket();
        }
        const activeTier = TOURNAMENT_TIERS[selectedTournamentTier] || TOURNAMENT_TIERS.CUP_100;
        if (hudTourneyBadge) {
          hudTourneyBadge.classList.remove('hidden');
          hudTourneyBadge.classList.add('inline-flex');
          hudTourneyBadge.innerText = `${activeTier.shortName.toUpperCase()} (${tournamentRound + 1}/${TOTAL_TOURNAMENT_GAMES}) · ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()}`;
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

      const activeTourneyTier = TOURNAMENT_TIERS[selectedTournamentTier] || TOURNAMENT_TIERS.CUP_100;

      if (card) card.className = 'sm:col-span-5 w-full p-4 sm:p-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between';
      if (statusLabel) statusLabel.className = 'flex items-center space-x-2 text-slate-800 transition-colors';
      if (statusIcon) statusIcon.className = 'fa-solid fa-trophy text-amber-500 text-xs';
      if (statusText) {
        statusText.innerText =
          currentGameMode === 'TOURNAMENT'
            ? `${activeTourneyTier.name} • ${TOURNAMENT_ROUNDS[tournamentRound]} (${tournamentRound + 1}/3)`
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
        mmName.innerText = 'Open Slot';
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
          'indie-cta-btn w-full sm:w-auto sm:min-w-[210px] min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-5 sm:px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2 mx-auto';
      }
      if (startBtnTextEl) {
        startBtnTextEl.innerText =
          currentGameMode === 'TOURNAMENT'
            ? tournamentRound === 0
              ? `ENTER ${activeTourneyTier.shortName.toUpperCase()} ($${activeTourneyTier.entryFee.toLocaleString()})`
              : `PLAY ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} (${tournamentRound + 1}/3)`
            : currentGameMode === 'RANKED'
              ? 'FIND RANKED MATCH'
              : 'FIND CASUAL MATCH';
      }
      if (startIconEl) startIconEl.className = 'fa-solid fa-play text-xs';
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

    let ledBannerMessage = `${GAME_TITLE} • 3 PASSES = SUPER FLOW`;
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
          // Portrait Mobile Optimization: generous field space & full goal visibility so goals and surrounding diorama are in view
          canvasOffsetY = -18;
          const fitScaleX = w / 1920;
          const fitScaleY = h / (PITCH.height + 540);
          viewScale = Math.max(0.18, Math.min(fitScaleX, fitScaleY));
        } else {
          // Landscape Mobile & Tablet Arena Framing: shows stadium bowl + outer surroundings while keeping players crisp
          canvasOffsetY = isCompactPhoneLandscape ? 8 : 10;
          const scaleX = w / (PITCH.width + (isCompactPhoneLandscape ? 520 : 620));
          const scaleY = h / (PITCH.height + (isCompactPhoneLandscape ? 420 : 500));
          viewScale = Math.max(0.18, Math.min(scaleX, scaleY));
        }
      } else {
        // Normal PC widescreen viewing mode: frames the pitch, stadium bowl, and all 4 surrounding diorama quadrants (-360..w+360, -290..h+290)
        canvasOffsetY = 6;
        const scaleX = w / (PITCH.width + 720);
        const scaleY = h / (PITCH.height + 580);
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
        if (mobileActionText) mobileActionText.innerText = 'KICK';
        if (mobileSecondaryText) mobileSecondaryText.innerText = 'RUN';
      } else {
        if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
        if (text) {
          text.innerText =
            activeControlScheme === 'GAMEPAD'
              ? `Defending vs ${currentOpponent.tag} • X/R2: Tackle • O/R1: Switch`
              : `Defending vs ${currentOpponent.tag} • L-Click: Tackle • R-Click: Switch`;
        }
        if (mobileActionText) mobileActionText.innerText = 'TACKLE';
        if (mobileSecondaryText) mobileSecondaryText.innerText = 'SWITCH';
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
        if (splashEl) splashEl.classList.add('hidden');
        if (gameState !== 'SPLASH') return;
        const menuOverlayEl = document.getElementById('menuOverlay');
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
      const openShopBtnEl = document.getElementById('openShopBtn');
      const openLeaderboardBtnEl = document.getElementById('openLeaderboardBtn');
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
        if (openShopBtnEl) openShopBtnEl.classList.add('hidden');
        if (openLeaderboardBtnEl) openLeaderboardBtnEl.classList.add('hidden');
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
        if (openShopBtnEl) openShopBtnEl.classList.remove('hidden');
        if (openLeaderboardBtnEl) openLeaderboardBtnEl.classList.remove('hidden');
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
      if (activeJackpotChallenge && activeJackpotChallenge.active) {
        goalBannerTimer = 65;
        const isHoldSpinGate = activeJackpotChallenge.challengeType === 'HOLD_AND_SPIN';
        if (scoringTeam === 'YOU') {
          goalBannerText = isHoldSpinGate
            ? 'SPIN TO WIN UNLOCKED!'
            : `JACKPOT WON! +$${activeJackpotChallenge.jackpotPrize.toLocaleString()}`;
          goalBannerSub = isHoldSpinGate
            ? `${activeJackpotChallenge.stadiumName.toUpperCase()} • ENTERING HOLD & SPIN!`
            : `${activeJackpotChallenge.stadiumName.toUpperCase()} GOAL CHALLENGE COMPLETE!`;
          activeGoalCelebration.kickerBadge = isHoldSpinGate
            ? '👑 HOLD & SPIN GOAL SCORED!'
            : '🎰 JACKPOT GOAL SCORED!';
          setLedBanner(
            isHoldSpinGate
              ? 'HOLD & SPIN UNLOCKED! ENTERING SPIN TO WIN BONUS SCREEN!'
              : `JACKPOT WON! YOU SCORED & CLAIMED $${activeJackpotChallenge.jackpotPrize.toLocaleString()}!`,
            240
          );
        } else {
          goalBannerText = isHoldSpinGate ? 'HOLD & SPIN LOST!' : 'JACKPOT LOST!';
          goalBannerSub = 'CONCEDED IN SUDDEN DEATH!';
          activeGoalCelebration.kickerBadge = '💔 BONUS CHALLENGE FAILED';
          setLedBanner(`BONUS LOST! CONCEDED AGAINST ${currentOpponent.tag.toUpperCase()}!`, 240);
        }
      } else {
        goalBannerText = celebrationSpec.headline;
        goalBannerSub = celebrationSpec.subheadline;
        setLedBanner(celebrationSpec.ledMessage, 240);
      }

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
      if (forceReTrigger && activeJackpotChallenge && activeJackpotChallenge.active) {
        const jpOut = evaluateJackpotChallengeOutcome(activeJackpotChallenge, scoreYou, scoreAi, matchTime);
        if (jpOut.ended) {
          endMatch(jpOut.headline);
        }
      }
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
        // 2A. Live Twinkling 4-Point Stars, Shooting Comets, Starfighter Hangar Thrusters, Biodome Pulse & Quantum Comms Radar
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

        // West Hangar Pad: Sequential Runway Docking Chevrons & Starfighter Plasma Thruster Idle Glow
        const activeChevron = Math.floor(matchTick * 0.15) % 5;
        for (let ch = 0; ch < 5; ch++) {
          const cy = 120 + ch * 130;
          if (ch === activeChevron) {
            fillPxRect(ctx, -298, cy - 6, 36, 12, '#67e8f9', px);
          }
        }
        const thrusterPulse = 8 + Math.round(Math.abs(Math.sin(matchTick * 0.25)) * 12);
        fillPxRect(ctx, -275 - 14, h * 0.38 + 46, 28, thrusterPulse, '#38bdf8', px);
        fillPxRect(ctx, -275 - 8, h * 0.38 + 46, 16, Math.max(4, thrusterPulse - 4), '#e0f2fe', px);

        // East Quantum Comms Array (x = w + 285, y = h * 0.72): Rotating Radar Sweep & Telemetry Rings
        const commX = w + 285;
        const commY = h * 0.72;
        const radarAng = matchTick * 0.06;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(commX, commY);
        ctx.lineTo(commX + Math.cos(radarAng) * 52, commY + Math.sin(radarAng) * 52);
        ctx.stroke();
        const teleR = 14 + ((matchTick * 0.65) % 42);
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(commX, commY, teleR, 0, Math.PI * 2);
        ctx.stroke();

        // South Zero-G Tethered Astro-Repair Drone gliding along truss (y = h + 215)
        const droneX = w * 0.5 + Math.sin(matchTick * 0.018) * (w * 0.28);
        const droneY = h + 215 + Math.cos(matchTick * 0.05) * 10;
        fillPxRect(ctx, droneX - 10, droneY - 8, 20, 16, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, droneX - 7, droneY - 5, 14, 10, '#f8fafc', px);
        fillPxRect(ctx, droneX - 3, droneY - 2, 6, 4, '#38bdf8', px);

        const ufo1X = w * 0.5 + Math.cos(matchTick * 0.012) * (w * 0.36);
        const ufo1Y = -225 + Math.sin(matchTick * 0.045) * 14;
        drawPixelUfo(ctx, ufo1X, ufo1Y, matchTick, px);

        const ufo2X = w * 0.5 - Math.cos(matchTick * 0.01 + 1.8) * (w * 0.34);
        const ufo2Y = h + 285 + Math.cos(matchTick * 0.04) * 12;
        drawPixelUfo(ctx, ufo2X, ufo2Y, matchTick + 25, px);
        ctx.restore();
      } else if (selectedPitchTheme === 'URBAN_CONCRETE') {
        // 2B. North Elevated Subway El-Train, South Avenue Lowriders, West Streetball & Boombox, East Skate Bowl Skater
        ctx.save();
        // North Elevated Steel Subway Viaduct (y = -270): 3-Car Graffiti Metro El-Train Gliding Across Trestle
        const trainHeadX = ((matchTick * 3.6) % (w + 920)) - 460;
        const trainY = -274;
        for (let carIdx = 0; carIdx < 3; carIdx++) {
          const cx = trainHeadX - carIdx * 128;
          if (cx > -CACHE_PAD_X - 140 && cx < w + CACHE_PAD_X + 140) {
            fillPxRect(ctx, cx - 58, trainY - 18, 116, 34, GRAPHICS_CONFIG.palette.outline, px);
            fillPxRect(ctx, cx - 54, trainY - 14, 108, 26, '#94a3b8', px);
            fillPxRect(ctx, cx - 54, trainY - 2, 108, 6, carIdx === 1 ? '#f43f5e' : '#0ea5e9', px);
            for (let wx = -42; wx <= 32; wx += 24) {
              fillPxRect(ctx, cx + wx, trainY - 10, 14, 8, '#fef08a', px);
            }
          }
        }

        // South Crosstown Asphalt Avenue (y = h + 230 & h + 265): Cruising Cars & Hydraulic Bouncing Lowrider
        const car3X = w + 280 - (((matchTick * 3.0 + 180) % (w + 560)));
        drawStreetCar(ctx, car3X, h + 230, -1, '#f43f5e', px, false, matchTick);
        const car4X = ((matchTick * 2.5 + 640) % (w + 560)) - 280;
        drawStreetCar(ctx, car4X, h + 265, 1, '#38bdf8', px, true, matchTick);
        // Parked Hydraulic Lowrider bouncing near South Bodega (x = w * 0.72, y = h + 228)
        const lowHop = Math.round(Math.abs(Math.sin(matchTick * 0.18)) * 6);
        drawStreetCar(ctx, w * 0.72, h + 226 - lowHop, -1, '#a855f7', px, false, matchTick);

        // West Streetball Half-Court (x = -260, y = h * 0.30): Bouncing Basketball + Boombox Soundwaves (y = h * 0.68)
        const hop = Math.abs(Math.sin(matchTick * 0.15)) * 20;
        const bx = -252 + Math.sin(matchTick * 0.06) * 18;
        const by = h * 0.32 - hop;
        fillPxRect(ctx, bx - 5, h * 0.32 + 4, 10, 4, 'rgba(15, 23, 42, 0.35)', px);
        fillPxRect(ctx, bx - 7, by - 7, 14, 14, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, bx - 5, by - 5, 10, 10, '#f97316', px);

        const beatH = 6 + Math.round(Math.abs(Math.sin(matchTick * 0.22)) * 14);
        fillPxRect(ctx, -260 - 14, h * 0.68 - 22 - beatH, 6, beatH, '#22d3ee', px);
        fillPxRect(ctx, -260 - 4, h * 0.68 - 26 - beatH, 6, beatH + 4, '#f472b6', px);
        fillPxRect(ctx, -260 + 6, h * 0.68 - 20 - beatH, 6, beatH, '#fde047', px);

        // East Concrete Skate Bowl (x = w + 268, y = h * 0.32): Carving Skateboarder
        const skatePhase = matchTick * 0.075;
        const skX = w + 268 + Math.cos(skatePhase) * 38;
        const skY = h * 0.32 + Math.sin(skatePhase * 2) * 44;
        fillPxRect(ctx, skX - 10, skY + 4, 20, 6, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, skX - 8, skY + 5, 16, 4, '#facc15', px);
        fillPxRect(ctx, skX - 6, skY - 8, 12, 12, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, skX - 4, skY - 6, 8, 8, '#22d3ee', px);
        ctx.restore();
      } else if (selectedPitchTheme === 'RIO_CLAY') {
        // 2C. South Atlantic Ocean Surf Waves & Sailboats, East Beach Volleyball Rally, West Samba Beats & Seagulls
        ctx.save();
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 24; i++) {
          const wx = -240 + ((i * 179 + Math.floor(matchTick * 0.8)) % (w + 480));
          const wyBot = h + 258 + Math.cos(matchTick * 0.06 + i) * 8;
          ctx.globalAlpha = 0.45 + 0.35 * Math.sin(matchTick * 0.08 + i);
          ctx.fillRect(Math.round(wx), Math.round(wyBot), 20, 4);
        }
        ctx.globalAlpha = 1;

        // Cruising 16-Bit Tropical Sailboats in South Atlantic Ocean (y = h + 282)
        for (let b = 0; b < 2; b++) {
          const dir = b === 0 ? 1 : -1;
          const bx = b === 0
            ? ((matchTick * 1.1 + 220) % (w + 360)) - 180
            : w + 180 - ((matchTick * 1.0 + 540) % (w + 360));
          const by = h + 282 + Math.cos(matchTick * 0.05 + b * 2) * 5;
          fillPxRect(ctx, bx - dir * 28, by + 4, 18, 4, '#e0f2fe', px);
          fillPxRect(ctx, bx - 18, by, 36, 10, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, bx - 15, by + 2, 30, 6, b === 0 ? '#f43f5e' : '#facc15', px);
          fillPxRect(ctx, bx - 8, by - 20, 16, 20, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, bx - 5, by - 17, 12, 16, '#ffffff', px);
        }

        // East Beach Volleyball Court (x = w + 268, y = h * 0.34): Rallying Volleyball Arcing Over Net
        const vbPhase = (matchTick * 0.045) % (Math.PI * 2);
        const vbY = h * 0.34 + Math.sin(vbPhase) * 52;
        const vbArc = Math.abs(Math.cos(vbPhase)) * 18;
        const vbX = w + 268 + Math.sin(vbPhase * 2) * 8;
        fillPxRect(ctx, vbX - 4, vbY + 4, 8, 4, 'rgba(15, 23, 42, 0.28)', px);
        fillPxRect(ctx, vbX - 6, vbY - vbArc - 6, 12, 12, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, vbX - 4, vbY - vbArc - 4, 8, 8, '#fef08a', px);

        // West Samba Percussion Stage (x = -268, y = h * 0.68): Floating Carnival Sound Rings
        const sambaR = 14 + ((matchTick * 0.55) % 36);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-268, h * 0.68, sambaR, 0, Math.PI * 2);
        ctx.stroke();

        // Gliding pixel seagulls over the outer boardwalk & ocean
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
        // 2D. Sweeping Cyber-Synth Searchlights, South Outrun Supercars, West Holo-Equalizer & Hover-Spinners
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

        // West Drive-In Holo-Screen (x = -275, y = h * 0.30): Live Pulsing Synthwave Equalizer Bars
        for (let eq = 0; eq < 8; eq++) {
          const eqY = h * 0.30 - 52 + eq * 14;
          const eqW = 14 + Math.round(Math.abs(Math.sin(matchTick * 0.18 + eq * 0.7)) * 34);
          fillPxRect(ctx, -295, eqY, eqW, 8, eq % 2 === 0 ? '#22d3ee' : '#f472b6', px);
        }

        // South Outrun Highway (y = h + 245 & h + 278): Speeding Cyber-Supercars with Neon Tail Trails
        for (let s = 0; s < 2; s++) {
          const dir = s === 0 ? 1 : -1;
          const hx = s === 0
            ? ((matchTick * 4.5 + 120) % (w + 540)) - 270
            : w + 270 - ((matchTick * 4.1 + 380) % (w + 540));
          const hy = s === 0 ? h + 244 : h + 276;
          fillPxRect(ctx, hx - dir * 44, hy - 3, 34, 6, s === 0 ? '#22d3ee' : '#f472b6', px);
          fillPxRect(ctx, hx - 20, hy - 9, 40, 18, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, hx - 16, hy - 6, 32, 12, '#312e81', px);
          fillPxRect(ctx, hx - 6, hy - 4, 14, 8, '#67e8f9', px);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'ARCTIC_ICE') {
        // 2E. Aurora Borealis Ribbons, West Ski Gondola Cabins, East Hot Spring Steam, South Penguins & Snowflakes
        ctx.save();
        // Aurora Borealis Shimmering Curtains at North Horizon
        for (let a = 0; a < 10; a++) {
          const ax = 80 + a * ((w - 160) / 10) + Math.sin(matchTick * 0.03 + a) * 24;
          const waveY = Math.sin(matchTick * 0.05 + a * 0.8) * 12;
          ctx.fillStyle = a % 2 === 0 ? 'rgba(45, 212, 191, 0.24)' : 'rgba(168, 85, 247, 0.22)';
          ctx.fillRect(Math.round(ax), Math.round(-290 + waveY), 95, 28);
        }

        // West Alpine Ski Gondola Cableway (x = -290 & -260): Moving Red & Gold Cabins along Steel Cable
        for (let gIdx = 0; gIdx < 2; gIdx++) {
          const cabX = gIdx === 0 ? -290 : -260;
          const cabY = gIdx === 0
            ? -220 + ((matchTick * 1.4 + 140) % (h + 440))
            : h + 220 - ((matchTick * 1.4 + 320) % (h + 440));
          fillPxRect(ctx, cabX - 14, cabY - 12, 28, 24, GRAPHICS_CONFIG.palette.outline, px);
          fillPxRect(ctx, cabX - 11, cabY - 9, 22, 18, gIdx === 0 ? '#ef4444' : '#facc15', px);
          fillPxRect(ctx, cabX - 7, cabY - 5, 14, 8, '#bae6fd', px);
        }

        // East Geothermal Hot Spring (x = w + 272, y = h * 0.32): Rising Warm Steam Wisps
        for (let st = 0; st < 4; st++) {
          const stPhase = (matchTick * 0.6 + st * 18) % 56;
          const stX = w + 252 + st * 14 + Math.sin(matchTick * 0.06 + st) * 6;
          const stY = h * 0.32 + 10 - stPhase;
          ctx.globalAlpha = Math.max(0, 0.55 * (1 - stPhase / 56));
          fillPxRect(ctx, stX - 6, stY - 6, 12, 12, '#f8fafc', px);
        }
        ctx.globalAlpha = 1;

        // Waddling 16-Bit Pixel Penguins on South Icebergs (y = h + 215..255)
        for (let p = 0; p < 4; p++) {
          const pxBase = 240 + p * 310;
          const pyBase = h + 218 + (p % 2) * 28;
          const waddleX = pxBase + Math.sin(matchTick * 0.03 + p * 1.7) * 34;
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
        // 2F. Roaring Fire Braziers, West Forge Anvil Sparks, East Rolling Magma Minecart & Rising Volcanic Embers
        ctx.save();
        for (const bz of [
          { x: w * 0.25 - 64, y: -255 },
          { x: w * 0.25 + 64, y: -255 },
          { x: w * 0.30, y: h + 245 },
          { x: w * 0.55, y: h + 255 },
        ]) {
          const flicker = Math.round(Math.sin(matchTick * 0.24 + bz.x) * 6);
          fillPxRect(ctx, bz.x - 10, bz.y - 22 - Math.abs(flicker), 20, 18 + Math.abs(flicker), '#ef4444', px);
          fillPxRect(ctx, bz.x - 7, bz.y - 18 - Math.abs(flicker), 14, 14, '#f97316', px);
          fillPxRect(ctx, bz.x - 4, bz.y - 12 - Math.abs(flicker) * 0.5, 8, 8, '#fde047', px);
        }

        // West Dwarven Anvil Forge (x = -272, y = h * 0.32): Periodic Hammer-Strike Spark Bursts
        const anvilPhase = (matchTick * 0.12) % (Math.PI * 2);
        if (Math.sin(anvilPhase) > 0.55) {
          for (let sp = 0; sp < 5; sp++) {
            const ang = (sp * Math.PI) / 4 + anvilPhase;
            const dist = 10 + (matchTick % 16);
            fillPxRect(
              ctx,
              -272 + Math.cos(ang) * dist,
              h * 0.32 + Math.sin(ang) * dist,
              6,
              6,
              sp % 2 === 0 ? '#fde047' : '#fb923c',
              px
            );
          }
        }

        // East Ore Railway Track (x = w + 272): Rolling Iron Minecart with Glowing Magma Ore
        const cartY = h * 0.5 + Math.sin(matchTick * 0.022) * (h * 0.36);
        fillPxRect(ctx, w + 272 - 22, cartY - 26, 44, 52, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, w + 272 - 18, cartY - 22, 36, 44, '#334155', px);
        fillPxRect(ctx, w + 272 - 12, cartY - 16, 24, 32, '#f97316', px);
        fillPxRect(ctx, w + 272 - 6, cartY - 10, 12, 20, '#fde047', px);

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
        // 2G. West Cider Mill Turning Waterwheel & Campfire Flames, East Hot-Air Balloon Bobbing & Swirling Autumn Leaves
        ctx.save();
        // West Cider Mill Waterwheel (x = -275, y = h * 0.32 + 42): Splash Droplets & Creek Ripples
        const splashOff = (matchTick * 0.8) % 24;
        fillPxRect(ctx, -238, h * 0.32 + 34 + splashOff, 10, 6, '#e0f2fe', px);
        fillPxRect(ctx, -232, h * 0.32 + 48 + ((splashOff + 12) % 24), 8, 5, '#bae6fd', px);

        // West Stone Campfire Ring (x = -285, y = h * 0.85): Flickering Warm Flames
        const fireH = 12 + Math.round(Math.abs(Math.sin(matchTick * 0.22)) * 10);
        fillPxRect(ctx, -285 - 8, h * 0.85 - fireH, 16, fireH, '#f97316', px);
        fillPxRect(ctx, -285 - 4, h * 0.85 - fireH + 4, 8, Math.max(4, fireH - 4), '#fde047', px);

        // East Harvest Hot-Air Balloon Burner Glow (x = w + 295, y = h * 0.25 + 28)
        if (Math.sin(matchTick * 0.08) > 0.2) {
          fillPxRect(ctx, w + 295 - 6, h * 0.25 + 24, 12, 10, '#fde047', px);
        }

        // Drifting Golden/Crimson Autumn Maple & Ginkgo Leaves
        const leafColors = ['#ea580c', '#dc2626', '#facc15', '#f97316'];
        for (let l = 0; l < 36; l++) {
          const lx = -260 + ((l * 179 + Math.floor(matchTick * 0.85 + Math.sin(matchTick * 0.05 + l) * 18)) % (w + 520));
          const ly = -280 + ((l * 107 + Math.floor(matchTick * 0.95)) % (h + 560));
          if (lx > -168 && lx < w + 168 && ly > -168 && ly < h + 168) continue;
          ctx.fillStyle = leafColors[l % leafColors.length];
          ctx.fillRect(Math.round(lx), Math.round(ly), 6, 6);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'TURF_SAKURA') {
        // 2H. Swimming Nishikigoi Koi & Floating Paper Lanterns in East Jade River & West Zen Pond + Swirling Sakura Petals
        ctx.save();
        for (const pond of [
          { x: w + 265, y: h * 0.22 },
          { x: w + 265, y: h * 0.64 },
          { x: w + 265, y: h * 0.82 },
          { x: -265, y: h * 0.70 },
        ]) {
          const koiAng = matchTick * 0.045 + pond.y * 0.01;
          const kx = pond.x + Math.cos(koiAng) * 16;
          const ky = pond.y + Math.sin(koiAng) * 14;
          fillPxRect(ctx, kx - 6, ky - 3, 12, 6, '#f97316', px);
          fillPxRect(ctx, kx + 2, ky - 2, 4, 4, '#ffffff', px);
        }

        // Floating Glowing Paper Lanterns drifting along East Jade River (x = w + 265)
        for (let lIdx = 0; lIdx < 3; lIdx++) {
          const ly = -200 + ((matchTick * 0.55 + lIdx * 340) % (h + 400));
          if (Math.abs(ly - h * 0.42) > 48) {
            const lx = w + 265 + Math.sin(ly * 0.012) * 18;
            fillPxRect(ctx, lx - 6, ly - 6, 12, 12, GRAPHICS_CONFIG.palette.outline, px);
            fillPxRect(ctx, lx - 4, ly - 4, 8, 8, '#fef08a', px);
          }
        }

        const petalColors = ['#fbcfe8', '#f472b6', '#ffe4e6'];
        for (let p = 0; p < 38; p++) {
          const pxPos = -260 + ((p * 167 + Math.floor(matchTick * 1.05 + Math.sin(matchTick * 0.06 + p) * 16)) % (w + 520));
          const pyPos = -280 + ((p * 97 + Math.floor(matchTick * 0.9)) % (h + 560));
          if (pxPos > -168 && pxPos < w + 168 && pyPos > -168 && pyPos < h + 168) continue;
          ctx.fillStyle = petalColors[p % petalColors.length];
          ctx.fillRect(Math.round(pxPos), Math.round(pyPos), 5, 5);
        }
        ctx.restore();
      } else if (selectedPitchTheme === 'TURF_CHAMPIONS') {
        // 2I. North Trophy Plaza Fountain Spray & Giant Silver Cup Gleam, West VIP Red Carpet Flashes & South Sky-Trackers
        ctx.save();
        // North Plaza Fountain Spray (x = w * 0.26, y = -255) & Giant Champions Cup Sparkle (x = w * 0.50, y = -262)
        const ftnSpray = 10 + ((matchTick * 0.45) % 20);
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.78)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w * 0.26, -255, ftnSpray, 0, Math.PI * 2);
        ctx.stroke();

        const gleamR = 14 + Math.sin(matchTick * 0.14) * 6;
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.88)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(w * 0.50, -262, gleamR, 0, Math.PI * 2);
        ctx.stroke();

        // West VIP Red Carpet Photographer Camera Flashes (x = -215, y = h * 0.50)
        if (matchTick % 28 < 4) {
          fillPxRect(ctx, -228, h * 0.45 - 8, 16, 16, '#ffffff', px);
        } else if ((matchTick + 14) % 28 < 4) {
          fillPxRect(ctx, -228, h * 0.55 - 8, 16, 16, '#ffffff', px);
        }

        // East OB Van Rotating Satellite Dish (x = w + 265, y = h * 0.28 - 28)
        const dishSwing = Math.sin(matchTick * 0.05) * 6;
        fillPxRect(ctx, w + 265 + dishSwing - 6, h * 0.28 - 32, 12, 8, '#38bdf8', px);
        ctx.restore();
      } else {
        // 2J. CLASSIC_TURF Living Asymmetric Diorama:
        // North-West Glasshouse Fountain Spray, North-East Kids 1v1 Mini-Pitch Rally,
        // East Canal Drifting Wooden Rowboat & Swimming Ducks, West TV OB Dish, South Commuter Train!
        ctx.save();
        // 1. North-West Glasshouse Terrace Fountain Spray (x = w * 0.48, y = -255)
        const sprayR = 8 + ((matchTick * 0.45) % 20);
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.78)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w * 0.48, -255, sprayR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. North-East Youth 1v1 Mini-Pitch (x = w * 0.77, y = -258): Two Mini Academy Players Rallying a Ball!
        const rallyPhase = matchTick * 0.055;
        const kid1X = w * 0.77 - 48 + Math.sin(rallyPhase) * 10;
        const kid2X = w * 0.77 + 48 + Math.cos(rallyPhase) * 10;
        const miniBallX = w * 0.77 + Math.sin(rallyPhase * 1.5) * 44;
        const miniBallY = -258 + Math.cos(rallyPhase * 3) * 12;
        fillPxRect(ctx, kid1X - 6, -264, 12, 12, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, kid1X - 4, -262, 8, 8, '#38bdf8', px);
        fillPxRect(ctx, kid2X - 6, -264, 12, 12, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, kid2X - 4, -262, 8, 8, '#fb7185', px);
        fillPxRect(ctx, miniBallX - 4, miniBallY - 4, 8, 8, '#ffffff', px);

        // 3. East Park Canal (x = w + 266): Drifting Wooden Rowboat & Swimming Mallard Ducks
        const boatY = -140 + Math.sin(matchTick * 0.015) * 75;
        fillPxRect(ctx, w + 266 - 14, boatY - 24, 28, 48, GRAPHICS_CONFIG.palette.outline, px);
        fillPxRect(ctx, w + 266 - 10, boatY - 20, 20, 40, '#9a3412', px);
        fillPxRect(ctx, w + 266 - 8, boatY - 8, 16, 16, '#fdba74', px);
        // Oars
        const oarSwing = Math.sin(matchTick * 0.08) * 6;
        fillPxRect(ctx, w + 266 - 22, boatY + oarSwing, 8, 4, '#fde047', px);
        fillPxRect(ctx, w + 266 + 14, boatY - oarSwing, 8, 4, '#fde047', px);
        // Swimming Mallard Ducks in lower canal reach (y = h * 0.65..0.82)
        for (let d = 0; d < 2; d++) {
          const dy = h * 0.68 + d * 48 + Math.sin(matchTick * 0.03 + d * 2) * 16;
          const dx = w + 264 + Math.cos(matchTick * 0.04 + d) * 10;
          fillPxRect(ctx, dx - 5, dy - 4, 10, 8, '#15803d', px);
          fillPxRect(ctx, dx + 3, dy - 2, 4, 4, '#facc15', px);
        }

        // 4. West Broadcast Compound TV OB Van Dish Pulse (x = -265, y = h * 0.68 - 30)
        const obPulse = 6 + ((matchTick * 0.4) % 18);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-253, h * 0.68 - 28, obPulse, 0, Math.PI * 2);
        ctx.stroke();

        // 5. South Commuter Rail Track (y = h + 278): Sleek Emerald & Silver Commuter Train Gliding Past
        const commuterX = w + 420 - ((matchTick * 3.4) % (w + 840));
        for (let cIdx = 0; cIdx < 2; cIdx++) {
          const cx = commuterX + cIdx * 124;
          if (cx > -CACHE_PAD_X - 130 && cx < w + CACHE_PAD_X + 130) {
            fillPxRect(ctx, cx - 56, h + 262, 112, 30, GRAPHICS_CONFIG.palette.outline, px);
            fillPxRect(ctx, cx - 52, h + 266, 104, 22, '#f8fafc', px);
            fillPxRect(ctx, cx - 52, h + 274, 104, 6, '#10b981', px);
            for (let wx = -38; wx <= 30; wx += 22) {
              fillPxRect(ctx, cx + wx, h + 268, 14, 6, '#38bdf8', px);
            }
          }
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

      ctx.font = '800 13px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayMsg =
        ledBannerTimer > 0
          ? ledBannerMessage
          : superFlowActive
            ? `SUPER FLOW x${flowCombo} ACTIVE • FIRE CURVED STAR STRIKES`
            : currentGameMode === 'TOURNAMENT'
              ? `KNOCKOUT CUP • ${TOURNAMENT_ROUNDS[tournamentRound].toUpperCase()} VS ${currentOpponent.tag.toUpperCase()}`
              : `${GAME_TITLE} • ${userProfile.name.toUpperCase()} VS ${currentOpponent.tag.toUpperCase()}`;
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
          // Classic Sunlit Turf: North Glasshouse Fountain & East Canal erupt with sparkling cyan/gold water rings
          for (const ftn of [
            { x: w * 0.48, y: -255 },
            { x: w + 266, y: h * 0.22 },
            { x: w + 266, y: h * 0.72 },
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
          // Urban Street Concrete: Booming Boombox Soundwave Rings on West Streetball Court & East Skate Bowl
          for (const pt of [
            { x: -260, y: h * 0.68 },
            { x: w + 268, y: h * 0.32 },
          ]) {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 18 + ((goalElapsed * 2.2) % 55), 0, Math.PI * 2);
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
          // Magma Caldera Citadel: Outer Caldera Fire Braziers & West Forge Surge with Tall Molten Gold Pillars
          for (const bz of [
            { x: w * 0.25 - 64, y: -255 },
            { x: w * 0.25 + 64, y: -255 },
            { x: w * 0.30, y: h + 245 },
            { x: w * 0.55, y: h + 255 },
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
        const rawFocusX = ball.x * 0.62 + (controlledPlayer ? controlledPlayer.x * 0.38 : PITCH.width * 0.19);
        const focusY = ball.y * 0.62 + (controlledPlayer ? controlledPlayer.y * 0.38 : PITCH.height * 0.19);
        const isPortrait = canvas ? canvas.width < canvas.height : false;
        const isMobOrTab = isMobileOrTabletViewport();
        const isCompactPhoneLandscape = Boolean(canvas && canvas.height <= 550 && canvas.width > canvas.height);

        // In mobile portrait mode, bias camera lookahead toward the near goal whenever in the attacking/defending half so the goal & net are ALWAYS in full view
        let focusX = rawFocusX;
        if (isPortrait) {
          if (rawFocusX > PITCH.width * 0.52) {
            focusX = Math.min(PITCH.width + PITCH.goalDepth, rawFocusX + 210);
          } else if (rawFocusX < PITCH.width * 0.48) {
            focusX = Math.max(-PITCH.goalDepth, rawFocusX - 210);
          }
        }

        const baseGameplayZoom = isPortrait ? 0.94 : isCompactPhoneLandscape ? 1.04 : 1.0;
        const panFactorX = isPortrait ? 0.95 : isCompactPhoneLandscape ? 0.42 : isMobOrTab ? 0.24 : 0.14;
        const panFactorY = isPortrait ? 0.34 : isCompactPhoneLandscape ? 0.36 : isMobOrTab ? 0.20 : 0.12;
        const rawCamX = PITCH.width * 0.5 + (focusX - PITCH.width * 0.5) * panFactorX;
        const rawCamY = PITCH.height * 0.5 + (focusY - PITCH.height * 0.5) * panFactorY;

        if (isPortrait && canvas) {
          const halfVisW = (canvas.width * 0.5) / Math.max(0.15, viewScale * baseGameplayZoom);
          const worldLeftEdge = -PITCH.goalDepth - 56;
          const worldRightEdge = PITCH.width + PITCH.goalDepth + 56;
          const minCamX = Math.min(PITCH.width * 0.5, worldLeftEdge + halfVisW);
          const maxCamX = Math.max(PITCH.width * 0.5, worldRightEdge - halfVisW);
          targetCamX = Math.max(minCamX, Math.min(maxCamX, rawCamX));
          targetCamY = Math.max(PITCH.height * 0.22, Math.min(PITCH.height * 0.78, rawCamY));
        } else {
          const clampMarginX = isCompactPhoneLandscape ? 0.24 : isMobOrTab ? 0.32 : 0.22;
          const clampMarginY = isCompactPhoneLandscape ? 0.28 : isMobOrTab ? 0.34 : 0.28;
          targetCamX = Math.max(PITCH.width * clampMarginX, Math.min(PITCH.width * (1 - clampMarginX), rawCamX));
          targetCamY = Math.max(PITCH.height * clampMarginY, Math.min(PITCH.height * (1 - clampMarginY), rawCamY));
        }

        if (gameState === 'GOAL_CELEBRATION') {
          targetZoom = baseGameplayZoom + 0.04;
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
        const stadiumWrap = document.getElementById('stadiumSelectorWrap');

        if (titleEl) {
          titleEl.innerHTML = `<span class="font-display tracking-wide">TIKI TAKA</span><span class="font-mono-num text-xl sm:text-3xl md:text-4xl font-black text-amber-400 drop-shadow-[0_2px_0_#0f172a]">0.2</span>`;
        }
        if (srTitleEl) srTitleEl.innerText = GAME_TITLE;
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
        if (stadiumWrap) stadiumWrap.classList.remove('hidden');
        if (resumeBtn) resumeBtn.classList.add('hidden');
        if (forfeitBtn) forfeitBtn.classList.add('hidden');
        if (rematchSameBtn) rematchSameBtn.classList.add('hidden');
        if (mainMenuBtn) mainMenuBtn.classList.add('hidden');

        // Restore the Home Menu's selected stadium so Shuffle Mode only randomizes during matches
        selectedPitchTheme = homeMenuStadiumId;
        applyPitchTheme(selectedPitchTheme);
        sound.setPitchTheme(selectedPitchTheme);
        rebuildStaticPitchCache();
        syncHomeArenaSelectorUI();

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

      const isJackpotMatch = Boolean(activeJackpotChallenge && activeJackpotChallenge.active);
      const jackpotChallengeSnapshot = activeJackpotChallenge;
      if (activeJackpotChallenge) {
        activeJackpotChallenge.active = false;
        activeJackpotChallenge = null;
      }

      // Ranked & Tournament win progression: start at Bronze I and rank up by winning games, with Post-Match Rank Progress Bar UI!
      let rankUpAnnouncement = '';
      const postMatchRankCard = document.getElementById('postMatchRankCard');
      if (!isJackpotMatch && (currentGameMode === 'RANKED' || currentGameMode === 'TOURNAMENT')) {
        const prevWins = userProfile.rankedWins;
        const prevMatches = userProfile.rankedMatches;
        userProfile.rankedMatches += 1;
        if (youWon) {
          userProfile.rankedWins += 1;
        }
        saveUserProfileToStorage();
        syncProfileUI();

        const summary = computeRankProgressSummary(
          userProfile.rankedWins,
          prevWins,
          userProfile.rankedMatches,
          prevMatches
        );
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
            badgeEl.innerHTML = `${getRankCrestSvgHtml(summary.currentRank, 'w-3.5 h-3.5')}<span>${summary.currentRank.name}</span>`;
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
              ? `+1 WIN • LVL ${summary.clubLevel} (${summary.rankPoints} RP)`
              : `LVL ${summary.clubLevel} • ${userProfile.rankedWins} ${userProfile.rankedWins === 1 ? 'WIN' : 'WINS'}`;
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

      let totalCashAwarded = 0;

      let shouldOpenHoldAndSpinAfterMatch = false;

      if (isJackpotMatch && jackpotChallengeSnapshot) {
        showRematchBtn = false;
        const jpOutcome = evaluateJackpotChallengeOutcome(
          { ...jackpotChallengeSnapshot, active: true },
          scoreYou,
          scoreAi,
          scoreYou === 0 && scoreAi === 0 ? 0 : matchTime
        );
        if (jpOutcome.unlocksHoldAndSpin) {
          shouldOpenHoldAndSpinAfterMatch = true;
          totalCashAwarded = 0;
          selectedPokieMachine = jackpotChallengeSnapshot.machineId;
          selectedPokieBet = jackpotChallengeSnapshot.betAmount;
          saveUserProfileToStorage();
          syncUserProfileUI();
          sound.playTournamentWin();
          if (titleEl) {
            titleEl.innerHTML = `HOLD &amp; SPIN UNLOCKED! <span class="font-light text-amber-500">·</span> 3 RESPINS`;
          }
          if (srTitleEl) srTitleEl.innerText = 'HOLD & SPIN UNLOCKED';
          if (subEl) subEl.innerText = jpOutcome.subtext;
        } else if (jpOutcome.didWinJackpot) {
          totalCashAwarded = jpOutcome.payout;
          userProfile.balance =
            (Number.isFinite(userProfile.balance) ? userProfile.balance : INITIAL_PLAYER_BALANCE) +
            totalCashAwarded;
          userProfile.machineJackpots[jackpotChallengeSnapshot.machineId] =
            POKIE_MACHINES[jackpotChallengeSnapshot.machineId].baseJackpot10;
          saveUserProfileToStorage();
          syncUserProfileUI();
          sound.playTournamentWin();
          if (titleEl) {
            titleEl.innerHTML = `JACKPOT WON! <span class="font-light text-amber-500">·</span> +$${totalCashAwarded.toLocaleString()}`;
          }
          if (srTitleEl) srTitleEl.innerText = `JACKPOT WON +$${totalCashAwarded.toLocaleString()}`;
          if (subEl) subEl.innerText = jpOutcome.subtext;
        } else {
          totalCashAwarded = 0;
          saveUserProfileToStorage();
          syncUserProfileUI();
          const lostTitle =
            jackpotChallengeSnapshot.challengeType === 'HOLD_AND_SPIN'
              ? 'HOLD &amp; SPIN LOST'
              : 'JACKPOT LOST';
          if (titleEl) {
            titleEl.innerHTML = `${lostTitle} <span class="font-light text-rose-500">·</span> $0`;
          }
          if (srTitleEl) srTitleEl.innerText = `${lostTitle.replace('&amp;', '&')} $0`;
          if (subEl) subEl.innerText = jpOutcome.subtext;
        }
        nextBtnLabel = 'FIND NEW MATCH';
      } else if (currentGameMode === 'TOURNAMENT') {
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
            const tCfg = TOURNAMENT_TIERS[selectedTournamentTier] || TOURNAMENT_TIERS.CUP_100;
            nextBtnLabel = `ENTER ${tCfg.shortName.toUpperCase()} ($${tCfg.entryFee.toLocaleString()})`;
          }
        } else {
          const knockedOutRound = TOURNAMENT_ROUNDS[tournamentRound];
          if (titleEl) titleEl.innerHTML = `ELIMINATED <span class="font-light text-rose-500">·</span> ${scoreYou}-${scoreAi}`;
          if (srTitleEl) srTitleEl.innerText = `ELIMINATED ${scoreYou}-${scoreAi}`;
          if (subEl) subEl.innerText = `Knocked out in the ${knockedOutRound} by ${currentOpponent.tag}.`;
          tournamentRound = 0;
          tournamentBracket.initialized = false;
          const tCfg = TOURNAMENT_TIERS[selectedTournamentTier] || TOURNAMENT_TIERS.CUP_100;
          nextBtnLabel = `ENTER ${tCfg.shortName.toUpperCase()} ($${tCfg.entryFee.toLocaleString()})`;
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

      if (!isJackpotMatch) {
        // Calculate & Award Match Money Reward (depends on game outcome, game mode & tournament tier)
        const moneyReward = calculateMatchMoneyReward({
          gameMode: currentGameMode,
          didWin: youWon,
          isDraw: scoreYou === scoreAi,
          goalsFor: scoreYou,
          goalsAgainst: scoreAi,
          isMercyRule: Math.abs(scoreYou - scoreAi) >= MERCY_RULE_LEAD,
          tournamentRound: matchRoundBeforeUpdate,
          tournamentTier: selectedTournamentTier,
        });
        totalCashAwarded = moneyReward.totalReward;
        userProfile.balance =
          (Number.isFinite(userProfile.balance) ? userProfile.balance : INITIAL_PLAYER_BALANCE) +
          totalCashAwarded;
        saveUserProfileToStorage();
        syncUserProfileUI();
      }

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
      if (smeEl) smeEl.innerText = `+$${totalCashAwarded.toLocaleString()}`;
      if (twMoneyEl) twMoneyEl.innerText = `+$${totalCashAwarded.toLocaleString()}`;
      if (statMoneyModeBadgeEl) {
        const activeTier = TOURNAMENT_TIERS[selectedTournamentTier] || TOURNAMENT_TIERS.CUP_100;
        statMoneyModeBadgeEl.innerText = isJackpotMatch
          ? shouldOpenHoldAndSpinAfterMatch
            ? 'BONUS!'
            : totalCashAwarded > 0
              ? 'JACKPOT!'
              : 'LOST'
          : currentGameMode === 'TOURNAMENT'
            ? activeTier.shortName.toUpperCase()
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
      const stadiumWrapEnd = document.getElementById('stadiumSelectorWrap');
      if (stadiumWrapEnd) stadiumWrapEnd.classList.add('hidden');

      setMatchmakingIdleUI();
      if (startBtnText) startBtnText.innerText = nextBtnLabel;
      if (openSlotMachineBtn) openSlotMachineBtn.classList.add('hidden');
      const openShopBtnEl = document.getElementById('openShopBtn');
      const openLeaderboardBtnEl = document.getElementById('openLeaderboardBtn');
      if (openShopBtnEl) openShopBtnEl.classList.add('hidden');
      if (openLeaderboardBtnEl) openLeaderboardBtnEl.classList.add('hidden');

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
        if (shouldOpenHoldAndSpinAfterMatch && jackpotChallengeSnapshot) {
          // Player won the 30s stadium match for Hold & Spin! Transition straight into the Spin to Win screen!
          gameState = 'MENU';
          syncBodyStateAttr('MENU');
          syncMenuLayoutForState('MENU');
          if (menuOverlay) menuOverlay.classList.remove('hidden');
          if (slotMachineModal) slotMachineModal.classList.remove('hidden');
          showPokieCabinetScreen();
          triggerHoldAndSpinBonus(jackpotChallengeSnapshot.triggerPositions);
          if (holdSpinStatusBanner) {
            holdSpinStatusBanner.innerText = `⚽ GOAL SCORED IN ${jackpotChallengeSnapshot.stadiumName.toUpperCase()}! SPIN TO WIN UNLOCKED — 3 RESPINS READY!`;
          }
          return;
        }
        if (isTournamentChampion) {
          openTournamentWinCelebration(possPct);
        } else {
          if (menuOverlay) menuOverlay.classList.remove('hidden');
          syncMenuFocusVisual(true);
        }
        // Trigger post-match cash reward count-up animation & coin clink SFX
        if (totalCashAwarded > 0) {
          triggerMatchCashRewardAnimation(totalCashAwarded);
        }
      });
    }

    function pickRandomPitchArena() {
      const unlockedSet = new Set<PitchThemeId>(
        userProfile.unlockedStadiums && userProfile.unlockedStadiums.length > 0
          ? userProfile.unlockedStadiums
          : DEFAULT_UNLOCKED_STADIUMS
      );
      if (preferredArenaMode !== 'RANDOM' && unlockedSet.has(preferredArenaMode)) {
        selectedPitchTheme = preferredArenaMode;
      } else if (preferredArenaMode === 'RANDOM') {
        // Randomly select from the player's unlocked stadiums ONLY when loading a match
        const unlockedThemes = PITCH_THEMES.filter((t) => unlockedSet.has(t.id));
        const safePool = unlockedThemes.length > 0 ? unlockedThemes : [PITCH_THEMES[0]];
        const differentPool = safePool.filter((t) => t.id !== selectedPitchTheme);
        const finalPool = differentPool.length > 0 ? differentPool : safePool;
        const randomTheme = finalPool[Math.floor(Math.random() * finalPool.length)];
        selectedPitchTheme = randomTheme.id;
      } else {
        selectedPitchTheme = homeMenuStadiumId;
      }
      applyPitchTheme(selectedPitchTheme);
      sound.setPitchTheme(selectedPitchTheme);
      rebuildStaticPitchCache();
    }

    function syncHomeArenaSelectorUI() {
      const unlockedList =
        userProfile.unlockedStadiums && userProfile.unlockedStadiums.length > 0
          ? userProfile.unlockedStadiums
          : DEFAULT_UNLOCKED_STADIUMS;
      if (!unlockedList.includes(homeMenuStadiumId)) {
        homeMenuStadiumId = unlockedList[0];
      }
      if (gameState === 'MENU' && selectedPitchTheme !== homeMenuStadiumId) {
        selectedPitchTheme = homeMenuStadiumId;
        applyPitchTheme(selectedPitchTheme);
        sound.setPitchTheme(selectedPitchTheme);
        rebuildStaticPitchCache();
      }
      const homeTheme =
        PITCH_THEMES.find((t) => t.id === homeMenuStadiumId) || PITCH_THEMES[0];
      const homeShopItem =
        SHOP_STADIUM_ITEMS.find((s) => s.id === homeMenuStadiumId) || SHOP_STADIUM_ITEMS[0];
      const nameEl = document.getElementById('activeStadiumNameText');
      const modePillEl = document.getElementById('activeStadiumModePill');
      const countEl = document.getElementById('stadiumUnlockedCountText');
      const shuffleBtn = document.getElementById('stadiumShuffleBtn');
      const previewEl = document.getElementById('homeStadiumTrueRatioPreview');

      if (nameEl) {
        nameEl.innerText = homeTheme.name;
      }
      if (modePillEl) {
        const isRandom = preferredArenaMode === 'RANDOM';
        modePillEl.innerText = isRandom
          ? '🎲 SHUFFLE ON MATCH LOAD'
          : `${homeShopItem.tierLabel} ARENA LOCKED`;
        modePillEl.style.backgroundColor = isRandom ? '#fde047' : homeShopItem.accentHex;
        modePillEl.style.color = '#0f172a';
      }
      if (countEl) {
        countEl.innerText = `${unlockedList.length}/${PITCH_THEMES.length} UNLOCKED`;
      }
      if (previewEl) {
        previewEl.innerHTML = getTrueRatioStadiumSvgHtml(homeMenuStadiumId);
      }
      if (shuffleBtn) {
        const isRandom = preferredArenaMode === 'RANDOM';
        shuffleBtn.innerText = isRandom ? '🎲 Shuffle: ON' : '🎲 Shuffle: OFF';
        shuffleBtn.className = isRandom
          ? 'btn-clean py-1 px-2.5 rounded-lg bg-amber-300 border-2 border-slate-900 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer shrink-0'
          : 'btn-clean py-1 px-2.5 rounded-lg bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-700 font-black text-[10px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer shrink-0';
      }
    }

    function cycleUnlockedStadium(step: number) {
      sound.init();
      sound.playUiSelect();
      const unlockedSet = new Set<PitchThemeId>(
        userProfile.unlockedStadiums && userProfile.unlockedStadiums.length > 0
          ? userProfile.unlockedStadiums
          : DEFAULT_UNLOCKED_STADIUMS
      );
      const unlockedThemes = PITCH_THEMES.filter((t) => unlockedSet.has(t.id));
      const pool = unlockedThemes.length > 0 ? unlockedThemes : [PITCH_THEMES[0]];
      const currentIdx = Math.max(
        0,
        pool.findIndex((t) => t.id === homeMenuStadiumId)
      );
      const nextIdx = (currentIdx + step + pool.length) % pool.length;
      const chosen = pool[nextIdx];
      homeMenuStadiumId = chosen.id;
      preferredArenaMode = chosen.id;
      selectedPitchTheme = chosen.id;
      applyPitchTheme(chosen.id);
      sound.setPitchTheme(chosen.id);
      rebuildStaticPitchCache();
      syncHomeArenaSelectorUI();
    }

    function toggleShuffleArenaMode() {
      sound.init();
      sound.playUiSelect();
      if (preferredArenaMode === 'RANDOM') {
        preferredArenaMode = homeMenuStadiumId;
      } else {
        // Keep the Home Menu stadium untouched; only pick randomly when a match loads!
        preferredArenaMode = 'RANDOM';
      }
      syncHomeArenaSelectorUI();
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

    function selectTournamentTier(tierId: TournamentTierId) {
      if (isSearchingMatch || matchLaunchTimeout) return;
      if (!TOURNAMENT_TIERS[tierId]) return;
      sound.init();
      sound.playUiSelect();
      selectedTournamentTier = tierId;
      tournamentRound = 0;
      const entryBanner = document.getElementById('tourneyEntryStatusBanner');
      if (entryBanner) entryBanner.classList.add('hidden');
      syncTournamentTierSelectorUI();
      if (gameState !== 'PAUSED') {
        setMatchmakingIdleUI();
      } else {
        syncKitAndModeUI();
      }
    }

    function startMatch() {
      sound.unlock();
      if (isSearchingMatch || matchLaunchTimeout) {
        return;
      }

      // Enforce Tournament Entry Fee at Round 0 (Quarter-Final Entry)
      if (currentGameMode === 'TOURNAMENT' && tournamentRound === 0) {
        const tierCfg = TOURNAMENT_TIERS[selectedTournamentTier] || TOURNAMENT_TIERS.CUP_100;
        const entryBanner = document.getElementById('tourneyEntryStatusBanner');
        if (userProfile.balance < tierCfg.entryFee) {
          sound.playUiBack();
          if (entryBanner) {
            entryBanner.innerText = `⚠️ INSUFFICIENT FUNDS! NEED $${tierCfg.entryFee.toLocaleString()} TO ENTER ${tierCfg.name.toUpperCase()} (YOU HAVE $${userProfile.balance.toLocaleString()})`;
            entryBanner.className =
              'mt-2 p-2 rounded-xl bg-rose-200 border-2 border-slate-900 text-rose-950 font-black text-[10px] uppercase tracking-wide text-center shadow-[0_2px_0_#0f172a]';
            entryBanner.classList.remove('hidden');
          }
          return;
        }
        userProfile.balance = Math.max(0, userProfile.balance - tierCfg.entryFee);
        saveUserProfileToStorage();
        syncProfileUI();
        if (entryBanner) {
          entryBanner.innerText = `🏆 -$${tierCfg.entryFee.toLocaleString()} ENTRY FEE PAID • ${tierCfg.name.toUpperCase()} LOCKED IN!`;
          entryBanner.className =
            'mt-2 p-2 rounded-xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[10px] uppercase tracking-wide text-center shadow-[0_2px_0_#0f172a]';
          entryBanner.classList.remove('hidden');
        }
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
      const openShopBtnStart = document.getElementById('openShopBtn');
      const openLeaderboardBtnStart = document.getElementById('openLeaderboardBtn');
      if (openShopBtnStart) openShopBtnStart.classList.add('hidden');
      if (openLeaderboardBtnStart) openLeaderboardBtnStart.classList.add('hidden');

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
        const stadiumWrapPause = document.getElementById('stadiumSelectorWrap');
        if (playlistWrap) playlistWrap.classList.add('hidden');
        if (kitWrap) kitWrap.classList.add('hidden');
        if (stadiumWrapPause) stadiumWrapPause.classList.add('hidden');
        if (startBtn) startBtn.classList.add('hidden');
        if (openSlotMachineBtn) openSlotMachineBtn.classList.add('hidden');
        const openShopBtnPause = document.getElementById('openShopBtn');
        const openLeaderboardBtnPause = document.getElementById('openLeaderboardBtn');
        if (openShopBtnPause) openShopBtnPause.classList.add('hidden');
        if (openLeaderboardBtnPause) openLeaderboardBtnPause.classList.add('hidden');
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

    function resetProfileSettingsUI() {
      const settingsPanel = document.getElementById('profileSettingsPanel');
      const confirmBox = document.getElementById('deleteAccountConfirmBox');
      const initBtn = document.getElementById('deleteAccountInitBtn');
      const resetBanner = document.getElementById('deleteAccountStatusBanner');
      if (settingsPanel) settingsPanel.classList.add('hidden');
      if (confirmBox) confirmBox.classList.add('hidden');
      if (initBtn) initBtn.classList.remove('hidden');
      if (resetBanner) resetBanner.classList.add('hidden');
    }

    function handleToggleProfileSettings() {
      sound.init();
      sound.playUiSelect();
      const settingsPanel = document.getElementById('profileSettingsPanel');
      const confirmBox = document.getElementById('deleteAccountConfirmBox');
      const initBtn = document.getElementById('deleteAccountInitBtn');
      if (!settingsPanel) return;
      const willOpen = settingsPanel.classList.contains('hidden');
      settingsPanel.classList.toggle('hidden', !willOpen);
      if (confirmBox) confirmBox.classList.add('hidden');
      if (initBtn) initBtn.classList.remove('hidden');
    }

    function handleInitDeleteAccountPrompt() {
      sound.init();
      sound.playUiBack();
      const confirmBox = document.getElementById('deleteAccountConfirmBox');
      const initBtn = document.getElementById('deleteAccountInitBtn');
      if (initBtn) initBtn.classList.add('hidden');
      if (confirmBox) confirmBox.classList.remove('hidden');
    }

    function handleCancelDeleteAccountPrompt() {
      sound.init();
      sound.playUiSelect();
      const confirmBox = document.getElementById('deleteAccountConfirmBox');
      const initBtn = document.getElementById('deleteAccountInitBtn');
      if (confirmBox) confirmBox.classList.add('hidden');
      if (initBtn) initBtn.classList.remove('hidden');
    }

    function handleConfirmDeleteAndResetAccount() {
      sound.init();
      sound.playWhistle();
      const freshProfile = createDefaultPlayerProfile();
      userProfile = {
        name: freshProfile.name,
        iconType: freshProfile.iconType,
        presetIcon: '#10',
        photoDataUrl: freshProfile.photoDataUrl,
        rankedWins: freshProfile.rankedWins,
        rankedMatches: freshProfile.rankedMatches,
        hasEditedProfile: false,
        balance: freshProfile.balance,
        jackpotPool: freshProfile.jackpotPool,
        machineJackpots: {
          CHAMPIONS_GOLD: POKIE_MACHINES.CHAMPIONS_GOLD.baseJackpot10,
          COSMIC_NEON: POKIE_MACHINES.COSMIC_NEON.baseJackpot10,
          VOLCANO_INFERNO: POKIE_MACHINES.VOLCANO_INFERNO.baseJackpot10,
          HIGH_ROLLER_ROYAL: POKIE_MACHINES.HIGH_ROLLER_ROYAL.baseJackpot10,
        },
        unlockedStadiums: [...freshProfile.unlockedStadiums],
        unlockedPokies: [...freshProfile.unlockedPokieMachines],
      };
      pendingAvatarDataUrl = null;
      homeMenuStadiumId = 'CLASSIC_TURF';
      preferredArenaMode = 'RANDOM';
      selectedPitchTheme = 'CLASSIC_TURF';
      selectedPokieMachine = 'CHAMPIONS_GOLD';
      selectedPokieBet = 10;
      selectedTournamentTier = 'CUP_100';
      try {
        window.localStorage.removeItem('rematch_profile_v1');
      } catch {
        // Ignore storage error
      }
      saveUserProfileToStorage();
      void deleteProfileFromFirestoreLeaderboard();
      applyPitchTheme(selectedPitchTheme);
      sound.setPitchTheme(selectedPitchTheme);
      sound.setPokieMachine(selectedPokieMachine);
      rebuildStaticPitchCache();
      syncProfileUI();
      syncKitAndModeUI();
      syncHomeArenaSelectorUI();
      syncClubShopUI();
      syncPokieMachineThemeAndBetUI();
      renderLeaderboardRows();
      renderModalAvatarPreview(null);
      if (profileNameInput) {
        profileNameInput.value = userProfile.name;
      }
      const confirmBox = document.getElementById('deleteAccountConfirmBox');
      const initBtn = document.getElementById('deleteAccountInitBtn');
      const resetBanner = document.getElementById('deleteAccountStatusBanner');
      if (confirmBox) confirmBox.classList.add('hidden');
      if (initBtn) initBtn.classList.remove('hidden');
      if (resetBanner) {
        resetBanner.innerText = '✅ ACCOUNT RESET TO DEFAULT ($30 BANKROLL • BRONZE I)';
        resetBanner.classList.remove('hidden');
      }
      return userProfile;
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
      resetProfileSettingsUI();
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
      resetProfileSettingsUI();
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

    function getPokieSymbolVisual(symId: string, machineId: PokieMachineId = selectedPokieMachine) {
      const safeId = (symId in POKIE_SYMBOLS ? symId : 'DIAMOND_BALL') as PokieSymbolId;
      const spec = POKIE_SYMBOLS[safeId];
      const mTheme = getPokieMachineSymbolTheme(machineId, safeId);
      const pCol = mTheme.primaryColor;
      const sCol = mTheme.secondaryColor;

      // Bespoke 16-bit Pixel Art SVG Icons dynamically tinted per Pokie Machine
      const svgMap: Record<PokieSymbolId, string> = {
        MEGA_TROPHY: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="4" y="1" width="8" height="2" fill="#0f172a"/>
          <rect x="2" y="2" width="12" height="5" fill="#0f172a"/>
          <rect x="4" y="7" width="8" height="3" fill="#0f172a"/>
          <rect x="6" y="10" width="4" height="2" fill="#0f172a"/>
          <rect x="4" y="12" width="8" height="3" fill="#0f172a"/>
          <rect x="5" y="2" width="6" height="5" fill="${pCol}"/>
          <rect x="3" y="3" width="2" height="3" fill="${sCol}"/>
          <rect x="11" y="3" width="2" height="3" fill="${sCol}"/>
          <rect x="6" y="3" width="2" height="3" fill="#ffffff"/>
          <rect x="5" y="7" width="6" height="2" fill="${sCol}"/>
          <rect x="7" y="10" width="2" height="2" fill="${pCol}"/>
          <rect x="5" y="13" width="6" height="1" fill="${pCol}"/>
        </svg>`,
        WILD_STAR: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="6" y="1" width="4" height="3" fill="#0f172a"/>
          <rect x="1" y="5" width="14" height="4" fill="#0f172a"/>
          <rect x="3" y="9" width="10" height="3" fill="#0f172a"/>
          <rect x="2" y="12" width="4" height="3" fill="#0f172a"/>
          <rect x="10" y="12" width="4" height="3" fill="#0f172a"/>
          <rect x="7" y="2" width="2" height="10" fill="${pCol}"/>
          <rect x="2" y="6" width="12" height="2" fill="${pCol}"/>
          <rect x="4" y="8" width="8" height="3" fill="${sCol}"/>
          <rect x="3" y="12" width="3" height="2" fill="${pCol}"/>
          <rect x="10" y="12" width="3" height="2" fill="${pCol}"/>
          <rect x="6" y="6" width="4" height="3" fill="${sCol}"/>
          <rect x="7" y="7" width="2" height="1" fill="#ffffff"/>
        </svg>`,
        DIAMOND_BALL: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="5" y="1" width="6" height="1" fill="#0f172a"/>
          <rect x="3" y="2" width="10" height="12" fill="#0f172a"/>
          <rect x="2" y="4" width="12" height="8" fill="#0f172a"/>
          <rect x="5" y="14" width="6" height="1" fill="#0f172a"/>
          <rect x="5" y="2" width="6" height="12" fill="${pCol}"/>
          <rect x="3" y="4" width="10" height="8" fill="${sCol}"/>
          <rect x="6" y="6" width="4" height="4" fill="#0f172a"/>
          <rect x="7" y="2" width="2" height="2" fill="#0f172a"/>
          <rect x="3" y="7" width="2" height="2" fill="#0f172a"/>
          <rect x="11" y="7" width="2" height="2" fill="#0f172a"/>
          <rect x="5" y="4" width="2" height="2" fill="#ffffff"/>
        </svg>`,
        GOLD_BOOT: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="3" y="3" width="5" height="9" fill="#0f172a"/>
          <rect x="2" y="7" width="12" height="6" fill="#0f172a"/>
          <rect x="4" y="4" width="3" height="6" fill="${pCol}"/>
          <rect x="3" y="8" width="10" height="3" fill="${sCol}"/>
          <rect x="5" y="8" width="4" height="2" fill="${pCol}"/>
          <rect x="3" y="11" width="10" height="1" fill="#ffffff"/>
          <rect x="3" y="13" width="2" height="2" fill="${pCol}"/>
          <rect x="7" y="13" width="2" height="2" fill="${pCol}"/>
          <rect x="11" y="13" width="2" height="2" fill="${pCol}"/>
        </svg>`,
        FIRE_FLAME: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="6" y="1" width="4" height="3" fill="#0f172a"/>
          <rect x="4" y="4" width="8" height="4" fill="#0f172a"/>
          <rect x="2" y="7" width="12" height="6" fill="#0f172a"/>
          <rect x="4" y="13" width="8" height="2" fill="#0f172a"/>
          <rect x="7" y="2" width="2" height="3" fill="${pCol}"/>
          <rect x="5" y="5" width="6" height="4" fill="${sCol}"/>
          <rect x="3" y="8" width="10" height="4" fill="${pCol}"/>
          <rect x="5" y="8" width="6" height="4" fill="${sCol}"/>
          <rect x="6" y="10" width="4" height="3" fill="#ffffff"/>
        </svg>`,
        WHISTLE: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="2" y="5" width="12" height="7" fill="#0f172a"/>
          <rect x="3" y="4" width="6" height="9" fill="#0f172a"/>
          <rect x="4" y="5" width="5" height="7" fill="${pCol}"/>
          <rect x="9" y="6" width="4" height="4" fill="${sCol}"/>
          <rect x="5" y="6" width="3" height="2" fill="#ffffff"/>
          <rect x="6" y="8" width="2" height="2" fill="#0f172a"/>
        </svg>`,
        CHERRY_CARD: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="7" y="2" width="5" height="2" fill="${sCol}"/>
          <rect x="5" y="4" width="2" height="4" fill="${sCol}"/>
          <rect x="9" y="4" width="2" height="4" fill="${sCol}"/>
          <rect x="2" y="8" width="6" height="6" fill="#0f172a"/>
          <rect x="8" y="8" width="6" height="6" fill="#0f172a"/>
          <rect x="3" y="9" width="4" height="4" fill="${pCol}"/>
          <rect x="9" y="9" width="4" height="4" fill="${pCol}"/>
          <rect x="3" y="9" width="2" height="2" fill="#ffffff"/>
          <rect x="9" y="9" width="2" height="2" fill="#ffffff"/>
        </svg>`,
        SCATTER_CROWN: `<svg viewBox="0 0 16 16" class="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#0f172a]" shape-rendering="crispEdges" fill="none">
          <rect x="1" y="3" width="14" height="11" fill="#0f172a"/>
          <rect x="2" y="4" width="2" height="7" fill="${pCol}"/>
          <rect x="7" y="3" width="2" height="8" fill="${pCol}"/>
          <rect x="12" y="4" width="2" height="7" fill="${pCol}"/>
          <rect x="4" y="7" width="8" height="4" fill="${pCol}"/>
          <rect x="2" y="11" width="12" height="2" fill="${sCol}"/>
          <rect x="4" y="8" width="2" height="2" fill="#ffffff"/>
          <rect x="7" y="8" width="2" height="2" fill="${sCol}"/>
          <rect x="10" y="8" width="2" height="2" fill="#ffffff"/>
        </svg>`,
      };

      const multTagMap: Record<PokieSymbolId, string> = {
        MEGA_TROPHY: 'JACKPOT',
        WILD_STAR: '40X',
        DIAMOND_BALL: '20X',
        GOLD_BOOT: '12X',
        FIRE_FLAME: '6X',
        WHISTLE: '3X',
        CHERRY_CARD: '2X/1X',
        SCATTER_CROWN: 'HOLD&SPIN',
      };

      return {
        ...spec,
        svg: svgMap[safeId],
        tileBg: mTheme.tileBg,
        pillBg: mTheme.pillBg,
        pillText: mTheme.pillText,
        shortTag: mTheme.shortTag,
        borderHex: mTheme.borderHex,
        multTag: multTagMap[safeId],
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
      const mId = selectedPokieMachine;
      const cellShapeClass =
        mId === 'COSMIC_NEON'
          ? 'rounded-md border-[2.5px]'
          : mId === 'VOLCANO_INFERNO'
            ? 'rounded-lg border-[3px]'
            : mId === 'HIGH_ROLLER_ROYAL'
              ? 'rounded-xl border-[3px]'
              : 'rounded-xl border-[2.5px]';

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
          const vis = getPokieSymbolVisual(symId, mId);
          const isWinner = winningCells.has(`${col}_${row}`);
          const isCenterRow = row === 1;
          cellEl.style.background = isWinner
            ? 'linear-gradient(180deg, #ffffff 0%, #fef08a 45%, #facc15 100%)'
            : vis.tileBg;
          cellEl.style.borderColor = isWinner ? '#dc2626' : vis.borderHex;
          cellEl.className = `slot-symbol-cell relative ${cellShapeClass} p-1 sm:p-1.5 flex flex-col items-center justify-center text-center transition-all duration-150 select-none min-h-[58px] sm:min-h-[64px] ${
            isWinner
              ? 'slot-cell-winner z-10'
              : isCenterRow
                ? 'shadow-[0_3px_0_#0f172a] ring-1 ring-amber-300/60'
                : 'shadow-[0_3px_0_#0f172a]'
          }`;
          cellEl.innerHTML = `
            <span class="absolute top-1 right-1 px-1 py-0.2 rounded text-[7px] font-mono-num font-black uppercase tracking-tighter border border-slate-900/30" style="background:${
              isWinner ? '#dc2626' : vis.pillBg
            };color:${isWinner ? '#ffffff' : vis.pillText}">${isWinner ? 'WIN!' : vis.multTag}</span>
            <div class="my-0.5 flex items-center justify-center">${vis.svg}</div>
            <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-wider mt-0.5 px-2 py-0.2 rounded border border-slate-900 whitespace-nowrap" style="background:${vis.pillBg};color:${vis.pillText}">${vis.shortTag}</span>
          `;
        }
      }
    }

    function syncPokieMachineThemeAndBetUI() {
      const machine = POKIE_MACHINES[selectedPokieMachine] || POKIE_MACHINES.CHAMPIONS_GOLD;
      sound.setPokieMachine(selectedPokieMachine);
      const cabinetCard = document.getElementById('slotCabinetCard');
      const cabinetHeader = document.getElementById('slotCabinetHeader');
      const cabinetTagline = document.getElementById('slotCabinetTagline');
      const cabinetTitle = document.getElementById('slotCabinetTitle');
      const reelHousing = document.getElementById('slotReelHousing');
      const backToLobbyBtn = document.getElementById('backToPokieLobbyBtn');
      const lobbyBalEl = document.getElementById('pokieLobbyBalanceText');

      if (lobbyBalEl) {
        lobbyBalEl.innerText = `$${userProfile.balance.toLocaleString()}`;
      }

      if (pokieModalScreen === 'LOBBY') {
        if (cabinetCard) {
          cabinetCard.style.background = 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 55%, #fef3c7 100%)';
          cabinetCard.style.borderColor = '#0f172a';
        }
        if (cabinetHeader) {
          cabinetHeader.style.background = 'linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)';
          cabinetHeader.style.borderColor = '#fbbf24';
        }
        if (cabinetTagline) {
          cabinetTagline.innerText = `${GAME_TITLE} POKIES LOUNGE • 4 STADIUM & VIP MACHINES`;
          cabinetTagline.style.color = '#fde047';
        }
        if (cabinetTitle) {
          cabinetTitle.innerText = 'SELECT A POKIE MACHINE';
        }
        if (backToLobbyBtn) {
          backToLobbyBtn.classList.add('hidden');
        }
      } else {
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
        if (backToLobbyBtn) {
          backToLobbyBtn.classList.remove('hidden');
        }
      }

      if (reelHousing) {
        reelHousing.style.background = machine.reelHousingBg;
        reelHousing.style.borderColor = machine.reelBorderHex;
      }

      // Update marquee bulbs with machine-specific stadium colors
      const bulbs = document.querySelectorAll('.slot-bulb-dot') as NodeListOf<HTMLElement>;
      bulbs.forEach((b, idx) => {
        b.style.backgroundColor = machine.bulbColors[idx % machine.bulbColors.length];
      });

      // Style the 4 machine selection buttons in the Pokie Lobby screen (greyed out + LOCKED overlay until bought in Shop)
      const unlockedPokieSet = new Set<PokieMachineId>(
        userProfile.unlockedPokies && userProfile.unlockedPokies.length > 0
          ? userProfile.unlockedPokies
          : DEFAULT_UNLOCKED_POKIES
      );
      for (const m of POKIE_MACHINE_LIST) {
        const btn = document.getElementById(`slotMachineBtn_${m.id}`) as HTMLButtonElement | null;
        if (!btn) continue;
        const isUnlocked = unlockedPokieSet.has(m.id);
        const isSelected = m.id === selectedPokieMachine && isUnlocked;
        btn.style.background = m.headerGradient;
        btn.style.borderColor = isSelected ? m.accentHex : '#0f172a';
        btn.setAttribute('data-unlocked', isUnlocked ? 'true' : 'false');
        btn.className = isUnlocked
          ? 'slot-machine-select-btn relative p-3.5 rounded-2xl border-3 border-slate-900 shadow-[0_4px_0_#0f172a] hover:translate-y-[-1px] text-left transition-all cursor-pointer flex flex-col justify-between min-h-[116px] overflow-hidden'
          : 'slot-machine-select-btn relative p-3.5 rounded-2xl border-3 border-slate-900 shadow-[0_4px_0_#0f172a] text-left transition-all cursor-not-allowed flex flex-col justify-between min-h-[116px] grayscale opacity-75 overflow-hidden';

        const lockOverlay = document.getElementById(`slotMachineLockOverlay_${m.id}`);
        if (lockOverlay) {
          lockOverlay.classList.toggle('hidden', isUnlocked);
        }
        const ctaPill = document.getElementById(`slotMachineCtaPill_${m.id}`);
        if (ctaPill) {
          ctaPill.innerText = isUnlocked
            ? 'PLAY MACHINE →'
            : `🔒 $${m.unlockPrice.toLocaleString()} IN SHOP`;
        }

        const jpEl = document.getElementById(`slotMachineJackpot_${m.id}`);
        if (jpEl) {
          const previewBet = m.defaultBet;
          const effJp = getMachineEffectiveJackpot(
            m.id,
            previewBet,
            userProfile.machineJackpots[m.id]
          );
          jpEl.innerText = `$${effJp.toLocaleString()}`;
        }
      }

      // Toggle between $10/$100 selector vs locked $1,000 High Roller VIP stake
      const standardBetWrap = document.getElementById('slotStandardBetBtnsWrap');
      const highRollerBadge = document.getElementById('slotHighRollerStakeBadge');
      const stakesTitle = document.getElementById('slotStakesTitle');
      const stakesSubtitle = document.getElementById('slotStakesSubtitle');
      const isHighRollerMachine =
        machine.allowedBets.length === 1 && machine.allowedBets[0] === 1000;

      if (isHighRollerMachine) {
        if (standardBetWrap) standardBetWrap.classList.add('hidden');
        if (highRollerBadge) highRollerBadge.classList.remove('hidden');
        if (stakesTitle) stakesTitle.innerText = 'VIP HIGH ROLLER STAKES';
        if (stakesSubtitle) stakesSubtitle.innerText = '$1,000 Spin • 100x Line Payouts & $100,000+ Jackpot!';
      } else {
        if (standardBetWrap) standardBetWrap.classList.remove('hidden');
        if (highRollerBadge) highRollerBadge.classList.add('hidden');
        if (stakesTitle) stakesTitle.innerText = 'SPIN STAKES';
        if (stakesSubtitle) stakesSubtitle.innerText = '$100 Bet = 10x Line Wins & 10x Jackpot';
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
        slotSpinBtnLabel.innerText = `SPIN REELS • $${selectedPokieBet.toLocaleString()}`;
      }

      // Dynamically update compact bottom paytable & Hold & Spin values for $10, $100, or $1,000
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

      if (ptBetBadge) ptBetBadge.innerText = `$${selectedPokieBet.toLocaleString()} BET`;
      if (ptJackpotVal) ptJackpotVal.innerText = `$${activeJp.toLocaleString()}`;
      if (ptHoldVal) ptHoldVal.innerText = `+$${(selectedPokieBet * 15).toLocaleString()} + BONUS`;
      if (ptWildVal) ptWildVal.innerText = `2X ($${(selectedPokieBet * 40).toLocaleString()})`;
      if (ptLineVal) ptLineVal.innerText = `2X • $${selectedPokieBet.toLocaleString()}–$${(selectedPokieBet * 20).toLocaleString()}`;

      syncProfileUI();
    }

    function showPokieLobbyScreen() {
      if (isSlotSpinning || isHoldSpinStepAnimating || activeHoldAndSpinSession) return;
      pokieModalScreen = 'LOBBY';
      const lobbyScreen = document.getElementById('pokieLobbyScreen');
      const cabinetScreen = document.getElementById('pokieCabinetScreen');
      const lockBanner = document.getElementById('pokieLobbyLockBanner');
      if (lockBanner) lockBanner.classList.add('hidden');
      if (lobbyScreen) lobbyScreen.classList.remove('hidden');
      if (cabinetScreen) cabinetScreen.classList.add('hidden');
      setPokieMarqueeFast(false);
      syncPokieMachineThemeAndBetUI();
    }

    function showPokieCabinetScreen() {
      pokieModalScreen = 'CABINET';
      const lobbyScreen = document.getElementById('pokieLobbyScreen');
      const cabinetScreen = document.getElementById('pokieCabinetScreen');
      if (lobbyScreen) lobbyScreen.classList.add('hidden');
      if (cabinetScreen) cabinetScreen.classList.remove('hidden');
      if (slotHoldAndSpinScreen) slotHoldAndSpinScreen.classList.add('hidden');
      if (slotMainGameScreen) slotMainGameScreen.classList.remove('hidden');
      syncPokieMachineThemeAndBetUI();
    }

    function selectPokieMachine(machineId: PokieMachineId) {
      if (isSlotSpinning || isHoldSpinStepAnimating || activeHoldAndSpinSession) return;
      if (!POKIE_MACHINES[machineId]) return;
      const machine = POKIE_MACHINES[machineId];
      const isUnlocked =
        userProfile.unlockedPokies && userProfile.unlockedPokies.includes(machineId);
      const lockBanner = document.getElementById('pokieLobbyLockBanner');
      if (!isUnlocked) {
        sound.init();
        sound.playUiBack();
        if (lockBanner) {
          lockBanner.innerText = `🔒 ${machine.name.toUpperCase()} IS LOCKED! UNLOCK IT IN THE CLUB SHOP FOR $${machine.unlockPrice.toLocaleString()}!`;
          lockBanner.classList.remove('hidden');
        }
        return;
      }
      if (lockBanner) lockBanner.classList.add('hidden');
      sound.init();
      sound.playUiSelect();
      selectedPokieMachine = machineId;
      if (!machine.allowedBets.includes(selectedPokieBet)) {
        selectedPokieBet = machine.defaultBet;
      }
      showPokieCabinetScreen();
      renderPokieGridDOM(currentPokieGrid);
      if (slotStatusBanner) {
        slotStatusBanner.innerText = `${machine.name.toUpperCase()} • SPIN FOR $${selectedPokieBet.toLocaleString()} OR LAND 3+ ORBS FOR HOLD & SPIN MATCH!`;
        slotStatusBanner.className =
          'p-2 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-800 font-black text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]';
      }
    }

    function selectPokieBet(betAmount: PokieBetAmount) {
      if (isSlotSpinning || isHoldSpinStepAnimating || activeHoldAndSpinSession) return;
      const machine = POKIE_MACHINES[selectedPokieMachine] || POKIE_MACHINES.CHAMPIONS_GOLD;
      if (!machine.allowedBets.includes(betAmount)) return;
      sound.init();
      sound.playUiSelect();
      selectedPokieBet = betAmount;
      syncPokieMachineThemeAndBetUI();
      renderPokieGridDOM(currentPokieGrid);
      if (slotStatusBanner) {
        slotStatusBanner.innerText =
          betAmount === 1000
            ? '👑 $1,000 HIGH ROLLER VIP STAKES ACTIVE! 100X PAYOUTS & $100,000+ GRAND JACKPOT! 👑'
            : betAmount === 100
              ? '🔥 $100 HIGH-ROLLER STAKES ACTIVE! 10X PAYOUTS & 10X GRAND JACKPOT! 🔥'
              : '⚡ $10 STANDARD SPIN ACTIVE • LAND 3+ CROWN ORBS FOR HOLD & SPIN! ⚡';
        slotStatusBanner.className =
          betAmount >= 100
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

    function showJackpotGoalChallengePrompt(
      machineId: PokieMachineId,
      betAmount: PokieBetAmount,
      jackpotAmount: number,
      challengeType: JackpotChallengeType = 'GRAND_JACKPOT',
      triggerPositions?: { reel: number; row: number }[]
    ) {
      sound.init();
      sound.playSlotWin('JACKPOT');
      setPokieMarqueeFast(true);
      pendingJackpotChallenge = createJackpotChallengeState(
        machineId,
        betAmount,
        jackpotAmount,
        challengeType,
        triggerPositions
      );

      const promptWrap = document.getElementById('jackpotChallengePromptWrap');
      const bubbleTitle = document.getElementById('jackpotBubbleTitle');
      const bubbleText = document.getElementById('jackpotBubbleText');
      const bubbleStadiumPill = document.getElementById('jackpotBubbleStadiumPill');
      const launchBtnLabel = document.getElementById('launchJackpotMatchBtnLabel');

      const isHoldSpinGate = challengeType === 'HOLD_AND_SPIN';

      if (bubbleTitle) {
        bubbleTitle.innerText = isHoldSpinGate
          ? `👑 HOLD & SPIN ("SPIN TO WIN") HIT!`
          : `🎰 YOU HIT THE $${jackpotAmount.toLocaleString()} JACKPOT!`;
      }
      if (bubbleText) {
        bubbleText.innerText = isHoldSpinGate
          ? `"You hit the Hold & Spin Jackpot Screen! Score 1 GOAL in 30 seconds at ${pendingJackpotChallenge.stadiumName} to enter the Spin to Win screen! If you concede or run out of time, you lose the Bonus!"`
          : `"You won the Jackpot! Score 1 GOAL in 30 seconds at ${pendingJackpotChallenge.stadiumName} to claim $${jackpotAmount.toLocaleString()}! Concede a goal or run out of time and you lose the Jackpot!"`;
      }
      if (bubbleStadiumPill) {
        bubbleStadiumPill.innerText = `🏟️ ${pendingJackpotChallenge.stadiumName.toUpperCase()} • 30s SUDDEN DEATH`;
      }
      if (launchBtnLabel) {
        launchBtnLabel.innerText = isHoldSpinGate
          ? `⚽ PLAY 30s MATCH TO ENTER SPIN TO WIN`
          : `⚽ PLAY 30s JACKPOT MATCH ($${jackpotAmount.toLocaleString()})`;
      }
      if (promptWrap) {
        promptWrap.classList.remove('hidden');
      }
      if (slotStatusBanner) {
        slotStatusBanner.innerText = isHoldSpinGate
          ? `💬 BONUS SCREEN HIT! SCORE A GOAL IN 30s AT ${pendingJackpotChallenge.stadiumName.toUpperCase()} TO ENTER SPIN TO WIN!`
          : `💬 JACKPOT HIT! SCORE A GOAL IN 30s AT ${pendingJackpotChallenge.stadiumName.toUpperCase()} TO WIN $${jackpotAmount.toLocaleString()}!`;
        slotStatusBanner.className =
          'p-2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 border-2 border-slate-900 text-slate-950 font-black text-[10px] sm:text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#0f172a]';
      }
      return pendingJackpotChallenge;
    }

    function launchJackpotChallengeMatch() {
      sound.unlock();
      sound.playUiClick();
      const challenge =
        pendingJackpotChallenge ||
        createJackpotChallengeState(
          selectedPokieMachine,
          selectedPokieBet,
          getMachineEffectiveJackpot(
            selectedPokieMachine,
            selectedPokieBet,
            userProfile.machineJackpots[selectedPokieMachine]
          )
        );
      pendingJackpotChallenge = null;
      activeJackpotChallenge = { ...challenge, active: true };

      const promptWrap = document.getElementById('jackpotChallengePromptWrap');
      if (promptWrap) promptWrap.classList.add('hidden');
      closeSlotMachineModal();

      currentGameMode = 'CASUAL';
      preferredArenaMode = activeJackpotChallenge.pitchThemeId as PitchThemeId;
      selectedPitchTheme = activeJackpotChallenge.pitchThemeId as PitchThemeId;
      pickRandomOpponent(false);

      launchMatchNow();

      // Configure 30-second sudden-death Jackpot / Hold & Spin Goal Challenge timer & HUD
      matchTime = JACKPOT_CHALLENGE_DURATION_SECONDS;
      isGoldenGoal = false;
      const tmEl = document.getElementById('timerText');
      if (tmEl) tmEl.innerText = formatMatchTimer(matchTime);

      const isHoldSpinGate = activeJackpotChallenge.challengeType === 'HOLD_AND_SPIN';
      const hudTourneyBadge = document.getElementById('hudTourneyBadge');
      if (hudTourneyBadge) {
        hudTourneyBadge.classList.remove('hidden');
        hudTourneyBadge.classList.add('inline-flex');
        hudTourneyBadge.innerText = isHoldSpinGate
          ? `👑 SPIN TO WIN QUALIFIER • 30s GOAL CHALLENGE`
          : `🎰 $${activeJackpotChallenge.jackpotPrize.toLocaleString()} JACKPOT • 30s GOAL CHALLENGE`;
      }

      setLedBanner(
        isHoldSpinGate
          ? `👑 SPIN TO WIN CHALLENGE • SCORE IN 30s TO ENTER HOLD & SPIN! CONCEDE = LOSE!`
          : `🎰 $${activeJackpotChallenge.jackpotPrize.toLocaleString()} JACKPOT CHALLENGE • SCORE IN 30s TO WIN! CONCEDE = LOSE!`,
        300
      );
      if (controlledPlayer) {
        spawnFloatingText(
          controlledPlayer.x,
          controlledPlayer.y - 36,
          isHoldSpinGate
            ? `SCORE IN 30s TO ENTER SPIN TO WIN!`
            : `SCORE IN 30s FOR $${activeJackpotChallenge.jackpotPrize.toLocaleString()}!`,
          '#fde047'
        );
      }
      return activeJackpotChallenge;
    }

    function finishAndCollectHoldAndSpin() {
      if (!activeHoldAndSpinSession) return;
      sound.init();
      const bonusWin = activeHoldAndSpinSession.totalBonusWin;
      const wonGrand = activeHoldAndSpinSession.grandJackpotWon;
      const finishedMachineId = activeHoldAndSpinSession.machineId;
      const startBal = userProfile.balance;
      const endBal = startBal + bonusWin;
      userProfile.balance = endBal;
      if (wonGrand) {
        userProfile.machineJackpots[finishedMachineId] =
          POKIE_MACHINES[finishedMachineId].baseJackpot10;
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
          ? `🏆 9/9 GRAND JACKPOT + HOLD & SPIN COMPLETE! +$${bonusWin.toLocaleString()} ADDED TO BANKROLL! 🏆`
          : `👑 HOLD & SPIN COMPLETE! +$${bonusWin.toLocaleString()} ADDED TO BANKROLL! 👑`;
        slotStatusBanner.className =
          'p-2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 border-2 border-slate-900 text-slate-950 font-black text-[10px] sm:text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_3px_0_#0f172a]';
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
      const shopModal = document.getElementById('clubShopModal');
      if (shopModal && !shopModal.classList.contains('hidden')) {
        shopModal.classList.add('hidden');
      }
      const lbModal = document.getElementById('onlineLeaderboardModal');
      if (lbModal && !lbModal.classList.contains('hidden')) {
        lbModal.classList.add('hidden');
      }
      activeHoldAndSpinSession = null;
      pendingJackpotChallenge = null;
      isHoldSpinStepAnimating = false;
      const promptWrap = document.getElementById('jackpotChallengePromptWrap');
      if (promptWrap) promptWrap.classList.add('hidden');
      if (slotHoldAndSpinScreen) slotHoldAndSpinScreen.classList.add('hidden');
      if (slotMainGameScreen) slotMainGameScreen.classList.remove('hidden');

      showPokieLobbyScreen();
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
      const promptWrap = document.getElementById('jackpotChallengePromptWrap');
      if (promptWrap) promptWrap.classList.add('hidden');
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
      const stopReel0Ms = 340;
      const stopReel1Ms = 620;
      const stopReel2Ms = isTeaser ? 1040 : 860;

      const promptWrap = document.getElementById('jackpotChallengePromptWrap');
      if (promptWrap) promptWrap.classList.add('hidden');
      pendingJackpotChallenge = null;

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
              'p-2 rounded-2xl bg-amber-300 border-2 border-slate-900 text-slate-950 font-black text-[10px] sm:text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a] animate-pulse';
          }
        }, stopReel1Ms)
      );

      slotSpinTimeouts.push(
        setTimeout(() => {
          clearInterval(tickInterval);
          sound.playSlotReelStop(2, false);
          currentPokieGrid = finalResult.grid;

          // If Jackpot is hit, require the player to score a goal in the 30s Stadium Challenge to win the Jackpot!
          const immediatePayout = finalResult.isJackpot
            ? Math.max(0, finalResult.totalPayout - effectivePoolBefore)
            : finalResult.totalPayout;

          userProfile.balance = Math.max(0, balanceBeforeSpin - spinCost + immediatePayout);
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

          if (finalResult.isJackpot) {
            isSlotSpinning = false;
            if (slotSpinBtn) slotSpinBtn.disabled = false;
            if (slotSpinBtnLabel) {
              slotSpinBtnLabel.innerText = `SPIN REELS • $${selectedPokieBet.toLocaleString()}`;
            }
            if (slotWinAmountBadge) {
              slotWinAmountBadge.innerText = `🎰 $${effectivePoolBefore.toLocaleString()}`;
              slotWinAmountBadge.className =
                'font-mono-num text-xs sm:text-base font-black text-amber-600 animate-bounce mt-0.5';
            }
            showJackpotGoalChallengePrompt(
              selectedPokieMachine,
              spinCost,
              effectivePoolBefore,
              'GRAND_JACKPOT'
            );
            return;
          }

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
            slotSpinBtnLabel.innerText = `SPIN REELS • $${selectedPokieBet.toLocaleString()}`;
          }

          // Require a 30-second Stadium Goal Challenge BEFORE entering the Hold & Spin ("Spin to Win") screen!
          if (finalResult.triggersHoldAndSpin) {
            showJackpotGoalChallengePrompt(
              selectedPokieMachine,
              spinCost,
              effectivePoolBefore,
              'HOLD_AND_SPIN',
              finalResult.scatterPositions
            );
          }
        }, stopReel2Ms)
      );

      return finalResult;
    }

    // =========================================================================
    // CLUB SHOP MODAL (UNLOCK STADIUMS $0–$100k & POKIE MACHINES $0–$80k)
    // =========================================================================
    let activeShopTab: 'POKIES' | 'STADIUMS' = 'POKIES';

    function syncClubShopUI() {
      const balEl = document.getElementById('clubShopBalanceText');
      if (balEl) balEl.innerText = `$${userProfile.balance.toLocaleString()}`;

      const tabPokiesBtn = document.getElementById('shopTabPokiesBtn');
      const tabStadiumsBtn = document.getElementById('shopTabStadiumsBtn');
      const pokiesGrid = document.getElementById('shopPokiesSection');
      const stadiumsGrid = document.getElementById('shopStadiumsSection');

      if (tabPokiesBtn && tabStadiumsBtn) {
        const isPokies = activeShopTab === 'POKIES';
        tabPokiesBtn.className = isPokies
          ? 'py-2 px-4 rounded-xl text-xs font-black bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-1.5'
          : 'py-2 px-4 rounded-xl text-xs font-extrabold bg-white text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5';
        tabStadiumsBtn.className = !isPokies
          ? 'py-2 px-4 rounded-xl text-xs font-black bg-emerald-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-1.5'
          : 'py-2 px-4 rounded-xl text-xs font-extrabold bg-white text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5';
      }
      if (pokiesGrid) pokiesGrid.classList.toggle('hidden', activeShopTab !== 'POKIES');
      if (stadiumsGrid) stadiumsGrid.classList.toggle('hidden', activeShopTab !== 'STADIUMS');

      const unlockedPokiesSet = new Set<PokieMachineId>(userProfile.unlockedPokies);
      for (const item of SHOP_POKIE_ITEMS) {
        const btn = document.getElementById(`buyPokieBtn_${item.id}`) as HTMLButtonElement | null;
        const statusBadge = document.getElementById(`shopPokieStatus_${item.id}`);
        if (!btn) continue;
        const owned = unlockedPokiesSet.has(item.id);
        const canAfford = userProfile.balance >= item.price;
        if (owned) {
          btn.disabled = false;
          btn.innerText = 'PLAY IN POKIES →';
          btn.className =
            'btn-clean py-2 px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer';
          if (statusBadge) {
            statusBadge.innerText = 'UNLOCKED';
            statusBadge.className =
              'px-2 py-0.5 rounded-full bg-emerald-200 border border-slate-900 text-emerald-950 text-[8.5px] font-black uppercase tracking-wider';
          }
        } else {
          btn.disabled = false;
          btn.innerText = `BUY • $${item.price.toLocaleString()}`;
          btn.className = canAfford
            ? 'btn-clean py-2 px-3.5 rounded-xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer'
            : 'btn-clean py-2 px-3.5 rounded-xl bg-slate-200 border-2 border-slate-400 text-slate-600 font-black text-[11px] uppercase tracking-wider cursor-pointer';
          if (statusBadge) {
            statusBadge.innerText = `🔒 $${item.price.toLocaleString()}`;
            statusBadge.className =
              'px-2 py-0.5 rounded-full bg-slate-200 border border-slate-400 text-slate-700 text-[8.5px] font-black uppercase tracking-wider';
          }
        }
      }

      const unlockedStadiumsSet = new Set<PitchThemeId>(userProfile.unlockedStadiums);
      for (const item of SHOP_STADIUM_ITEMS) {
        const btn = document.getElementById(`buyStadiumBtn_${item.id}`) as HTMLButtonElement | null;
        const statusBadge = document.getElementById(`shopStadiumStatus_${item.id}`);
        if (!btn) continue;
        const owned = unlockedStadiumsSet.has(item.id);
        const canAfford = userProfile.balance >= item.price;
        if (owned) {
          btn.disabled = true;
          btn.innerText = 'OWNED';
          btn.className =
            'py-1.5 px-3 rounded-xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[10.5px] uppercase tracking-wider cursor-default select-none';
          if (statusBadge) {
            statusBadge.innerText = 'UNLOCKED';
            statusBadge.className =
              'px-2 py-0.5 rounded-full bg-emerald-200 border border-slate-900 text-emerald-950 text-[8px] font-black uppercase tracking-wider';
          }
        } else {
          btn.disabled = false;
          btn.innerText = `BUY • $${item.price.toLocaleString()}`;
          btn.className = canAfford
            ? 'btn-clean py-1.5 px-3 rounded-xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-950 font-black text-[10.5px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer'
            : 'btn-clean py-1.5 px-3 rounded-xl bg-slate-200 border-2 border-slate-400 text-slate-600 font-black text-[10.5px] uppercase tracking-wider cursor-pointer';
          if (statusBadge) {
            statusBadge.innerText = `🔒 $${item.price.toLocaleString()}`;
            statusBadge.className =
              'px-2 py-0.5 rounded-full bg-slate-200 border border-slate-400 text-slate-700 text-[8px] font-black uppercase tracking-wider';
          }
        }
      }
    }

    function openClubShopModal(initialTab?: 'POKIES' | 'STADIUMS') {
      sound.init();
      sound.playUiClick();
      if (initialTab) activeShopTab = initialTab;
      if (editProfileModal && !editProfileModal.classList.contains('hidden')) {
        closeEditProfileModal();
      }
      if (slotMachineModal && !slotMachineModal.classList.contains('hidden')) {
        closeSlotMachineModal();
      }
      const lbModal = document.getElementById('onlineLeaderboardModal');
      if (lbModal && !lbModal.classList.contains('hidden')) {
        lbModal.classList.add('hidden');
      }
      const banner = document.getElementById('clubShopFeedbackBanner');
      if (banner) banner.classList.add('hidden');
      syncClubShopUI();
      const modal = document.getElementById('clubShopModal');
      if (modal) modal.classList.remove('hidden');
    }

    function closeClubShopModal() {
      sound.init();
      sound.playUiBack();
      const modal = document.getElementById('clubShopModal');
      if (modal) modal.classList.add('hidden');
      syncPokieMachineThemeAndBetUI();
      syncUserProfileUI();
    }

    function handleBuyShopPokie(machineId: PokieMachineId) {
      sound.init();
      const banner = document.getElementById('clubShopFeedbackBanner');
      if (userProfile.unlockedPokies.includes(machineId)) {
        closeClubShopModal();
        openSlotMachineModal();
        selectPokieMachine(machineId);
        return { success: true, alreadyUnlocked: true };
      }
      const res = purchaseShopPokieMachine(
        machineId,
        userProfile.balance,
        userProfile.unlockedPokies
      );
      if (res.success) {
        sound.playSlotWin('BIG');
        userProfile.balance = res.newBalance;
        userProfile.unlockedPokies = res.unlockedItems;
        saveUserProfileToStorage();
        syncUserProfileUI();
        syncClubShopUI();
        syncPokieMachineThemeAndBetUI();
      } else {
        sound.playUiBack();
      }
      if (banner) {
        banner.innerText = res.message;
        banner.className = res.success
          ? 'p-2.5 rounded-2xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[11px] uppercase tracking-wide text-center mb-2.5 shadow-[0_2px_0_#0f172a]'
          : 'p-2.5 rounded-2xl bg-rose-200 border-2 border-slate-900 text-rose-950 font-black text-[11px] uppercase tracking-wide text-center mb-2.5 shadow-[0_2px_0_#0f172a]';
        banner.classList.remove('hidden');
      }
      return res;
    }

    function handleBuyShopStadium(stadiumId: PitchThemeId) {
      sound.init();
      const banner = document.getElementById('clubShopFeedbackBanner');
      if (userProfile.unlockedStadiums.includes(stadiumId)) {
        return { success: false, alreadyUnlocked: true };
      }
      const res = purchaseShopStadium(
        stadiumId,
        userProfile.balance,
        userProfile.unlockedStadiums
      );
      if (res.success) {
        sound.playSlotWin('BIG');
        userProfile.balance = res.newBalance;
        userProfile.unlockedStadiums = res.unlockedItems;
        homeMenuStadiumId = stadiumId;
        preferredArenaMode = stadiumId;
        selectedPitchTheme = stadiumId;
        applyPitchTheme(stadiumId);
        sound.setPitchTheme(stadiumId);
        rebuildStaticPitchCache();
        saveUserProfileToStorage();
        syncUserProfileUI();
        syncClubShopUI();
        syncHomeArenaSelectorUI();
      } else {
        sound.playUiBack();
      }
      if (banner) {
        banner.innerText = res.success
          ? `${res.message} — USE THE HOME MENU STADIUM BAR TO SELECT OR SHUFFLE!`
          : res.message;
        banner.className = res.success
          ? 'p-2.5 rounded-xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[11px] uppercase tracking-wide text-center mb-2.5 shadow-[0_2px_0_#0f172a]'
          : 'p-2.5 rounded-xl bg-rose-200 border-2 border-slate-900 text-rose-950 font-black text-[11px] uppercase tracking-wide text-center mb-2.5 shadow-[0_2px_0_#0f172a]';
        banner.classList.remove('hidden');
      }
      return res;
    }

    // =========================================================================
    // ONLINE LEADERBOARD MODAL (REAL PLAYER PROFILES + CPU LADDER RIVALS)
    // =========================================================================
    let currentLeaderboardSort: LeaderboardSortMode = 'RANK';
    let onlineLeaderboardEntries: LeaderboardEntry[] = [];

    function getMergedLeaderboardEntries(): LeaderboardEntry[] {
      const rankInfo = getUserRankInfo(userProfile.rankedWins);
      const localEntry: LeaderboardEntry = {
        uid: auth.currentUser?.uid || 'local-you',
        name: userProfile.name,
        iconType: userProfile.iconType,
        presetIcon: userProfile.presetIcon,
        photoDataUrl: userProfile.photoDataUrl,
        rankedWins: userProfile.rankedWins,
        rankedMatches: userProfile.rankedMatches,
        balance: userProfile.balance,
        rankName: rankInfo.name,
        rankTierIndex: rankInfo.index,
        updatedAt: Date.now(),
      };
      const map = new Map<string, LeaderboardEntry>();
      // Seed ladder with the loaded CPU playerbase profiles so the leaderboard is rich & competitive
      for (const cpuEntry of SEEDED_CPU_LEADERBOARD_PROFILES) {
        map.set(cpuEntry.uid, cpuEntry);
      }
      for (const e of onlineLeaderboardEntries) {
        map.set(e.uid, e);
      }
      // Always ensure the current player's live profile is visible on the leaderboard
      map.set(localEntry.uid, localEntry);
      return sortLeaderboardEntries(Array.from(map.values()), currentLeaderboardSort);
    }

    function renderLeaderboardRows() {
      const container = document.getElementById('leaderboardRowsContainer');
      const sortRankBtn = document.getElementById('lbSortRankBtn');
      const sortMoneyBtn = document.getElementById('lbSortMoneyBtn');
      const authStatusEl = document.getElementById('lbAuthStatusText');
      const signInBtn = document.getElementById('lbGoogleSignInBtn');

      if (sortRankBtn && sortMoneyBtn) {
        const isRank = currentLeaderboardSort === 'RANK';
        sortRankBtn.className = isRank
          ? 'py-2 px-4 rounded-xl text-xs font-black bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-1.5'
          : 'py-2 px-4 rounded-xl text-xs font-extrabold bg-white text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5';
        sortMoneyBtn.className = !isRank
          ? 'py-2 px-4 rounded-xl text-xs font-black bg-emerald-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-1.5'
          : 'py-2 px-4 rounded-xl text-xs font-extrabold bg-white text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5';
      }

      if (authStatusEl && signInBtn) {
        if (auth.currentUser) {
          authStatusEl.innerText = `✅ Cloud Profile Synced (${userProfile.name})`;
          signInBtn.innerText = 'SYNC PROFILE NOW';
        } else {
          authStatusEl.innerText = 'Sign in with Google to publish your live profile globally';
          signInBtn.innerText = 'SIGN IN & PUBLISH PROFILE';
        }
      }

      if (!container) return;
      const sorted = getMergedLeaderboardEntries();
      if (sorted.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center text-xs font-bold text-slate-500">
            No leaderboard profiles logged yet.
          </div>
        `;
        return;
      }

      container.innerHTML = sorted
        .map((entry, idx) => {
          const rankTier = getUserRankInfo(entry.rankedWins);
          const lvlSummary = computeRankProgressSummary(
            entry.rankedWins,
            entry.rankedWins,
            entry.rankedMatches,
            entry.rankedMatches
          );
          const isYou =
            entry.uid === 'local-you' ||
            (auth.currentUser && entry.uid === auth.currentUser.uid);
          const pos = idx + 1;
          const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
          const initials = (entry.name || 'PL').trim().slice(0, 2).toUpperCase() || 'PL';
          const avatarBgHex = entry.avatarBgHex || '#38bdf8';
          const avatarHtml =
            entry.iconType === 'photo' && entry.photoDataUrl
              ? `<img src="${entry.photoDataUrl}" alt="${entry.name}" class="w-full h-full object-cover" />`
              : `<span class="text-xs font-black text-slate-950">${initials}</span>`;

          return `
            <div class="p-2.5 sm:p-3 rounded-xl border-2 border-slate-900 ${
              isYou ? 'bg-amber-50 shadow-[0_3px_0_#0f172a]' : 'bg-white shadow-[0_2px_0_#0f172a]'
            } flex items-center justify-between gap-2.5">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg ${
                  pos <= 3 ? 'bg-amber-300' : 'bg-slate-100'
                } border-2 border-slate-900 font-mono-num text-xs font-black text-slate-900 flex items-center justify-center shrink-0">
                  ${medal}
                </div>
                <div class="w-10 h-10 rounded-xl border-2 border-slate-900 overflow-hidden flex items-center justify-center shrink-0" style="background:${avatarBgHex};border-color:${rankTier.borderHex}">
                  ${avatarHtml}
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs sm:text-sm font-black text-slate-900 truncate">${entry.name}</span>
                    ${
                      isYou
                        ? '<span class="px-1.5 py-0.2 rounded bg-sky-500 text-white text-[8px] font-black uppercase">YOU</span>'
                        : ''
                    }
                    <span class="px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 font-mono-num text-[8px] font-black uppercase">LVL ${lvlSummary.clubLevel}</span>
                  </div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="inline-flex items-center gap-1 px-2 py-0.2 rounded border text-[9px] font-black" style="background:${rankTier.badgeBgHex};color:${rankTier.badgeTextHex};border-color:${rankTier.borderHex}">
                      ${getRankCrestSvgHtml(rankTier, 'w-3 h-3')}
                      <span>${rankTier.name}</span>
                    </span>
                    <span class="text-[9.5px] font-bold text-slate-500 font-mono-num">
                      ${entry.rankedWins}W / ${entry.rankedMatches}M
                    </span>
                  </div>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="font-mono-num text-xs sm:text-sm font-black ${
                  currentLeaderboardSort === 'MONEY' ? 'text-emerald-700' : 'text-slate-900'
                }">
                  $${entry.balance.toLocaleString()}
                </div>
                <div class="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  ${currentLeaderboardSort === 'RANK' ? `${lvlSummary.rankPoints} RP • ${entry.rankedWins} WINS` : 'BANKROLL'}
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    function openLeaderboardModal(sortMode?: LeaderboardSortMode) {
      sound.init();
      sound.playUiClick();
      if (sortMode) currentLeaderboardSort = sortMode;
      if (editProfileModal && !editProfileModal.classList.contains('hidden')) {
        closeEditProfileModal();
      }
      if (slotMachineModal && !slotMachineModal.classList.contains('hidden')) {
        closeSlotMachineModal();
      }
      const shopModal = document.getElementById('clubShopModal');
      if (shopModal && !shopModal.classList.contains('hidden')) {
        shopModal.classList.add('hidden');
      }
      renderLeaderboardRows();
      const modal = document.getElementById('onlineLeaderboardModal');
      if (modal) modal.classList.remove('hidden');
    }

    function closeLeaderboardModal() {
      sound.init();
      sound.playUiBack();
      const modal = document.getElementById('onlineLeaderboardModal');
      if (modal) modal.classList.add('hidden');
    }

    function setLeaderboardSort(mode: LeaderboardSortMode) {
      sound.init();
      sound.playUiSelect();
      currentLeaderboardSort = mode;
      renderLeaderboardRows();
    }

    async function handleGoogleLeaderboardSignIn() {
      sound.init();
      sound.playUiClick();
      const statusEl = document.getElementById('lbAuthStatusText');
      if (auth.currentUser) {
        const rk = getUserRankInfo(userProfile.rankedWins);
        await syncProfileToFirestoreLeaderboard({
          name: userProfile.name,
          iconType: userProfile.iconType,
          presetIcon: userProfile.presetIcon,
          photoDataUrl: userProfile.photoDataUrl,
          rankedWins: userProfile.rankedWins,
          rankedMatches: userProfile.rankedMatches,
          balance: userProfile.balance,
          rankName: rk.name,
          rankTierIndex: rk.index,
        });
        renderLeaderboardRows();
        return;
      }
      if (statusEl) statusEl.innerText = 'Opening Google Sign-In...';
      const user = await signInWithGoogleForLeaderboard();
      if (user) {
        if (userProfile.name === 'Player' && user.displayName) {
          userProfile.name = user.displayName.slice(0, 16);
        }
        saveUserProfileToStorage();
        syncProfileUI();
        renderLeaderboardRows();
      } else if (statusEl) {
        statusEl.innerText = 'Sign-in cancelled or popup blocked — local profile shown';
      }
    }

    const unsubscribeLeaderboard = subscribeToOnlineLeaderboard((entries) => {
      onlineLeaderboardEntries = entries;
      const modal = document.getElementById('onlineLeaderboardModal');
      if (modal && !modal.classList.contains('hidden')) {
        renderLeaderboardRows();
      }
    });

    const unsubscribeAuth = subscribeToAuthChanges((user) => {
      if (user) {
        const rk = getUserRankInfo(userProfile.rankedWins);
        void syncProfileToFirestoreLeaderboard({
          name: userProfile.name,
          iconType: userProfile.iconType,
          presetIcon: userProfile.presetIcon,
          photoDataUrl: userProfile.photoDataUrl,
          rankedWins: userProfile.rankedWins,
          rankedMatches: userProfile.rankedMatches,
          balance: userProfile.balance,
          rankName: rk.name,
          rankTierIndex: rk.index,
        });
      }
      const modal = document.getElementById('onlineLeaderboardModal');
      if (modal && !modal.classList.contains('hidden')) {
        renderLeaderboardRows();
      }
    });

    for (const m of POKIE_MACHINE_LIST) {
      const mBtn = document.getElementById(`slotMachineBtn_${m.id}`);
      if (mBtn) {
        mBtn.addEventListener('click', () => selectPokieMachine(m.id));
      }
      const buyPokieBtn = document.getElementById(`buyPokieBtn_${m.id}`);
      if (buyPokieBtn) {
        buyPokieBtn.addEventListener('click', () => handleBuyShopPokie(m.id));
      }
    }
    for (const s of SHOP_STADIUM_ITEMS) {
      const buyStBtn = document.getElementById(`buyStadiumBtn_${s.id}`);
      if (buyStBtn) {
        buyStBtn.addEventListener('click', () => handleBuyShopStadium(s.id));
      }
    }
    const openShopBtn = document.getElementById('openShopBtn');
    const closeShopModalBtn = document.getElementById('closeShopModalBtn');
    const shopTabPokiesBtn = document.getElementById('shopTabPokiesBtn');
    const shopTabStadiumsBtn = document.getElementById('shopTabStadiumsBtn');
    if (openShopBtn) openShopBtn.addEventListener('click', () => openClubShopModal());
    if (closeShopModalBtn) closeShopModalBtn.addEventListener('click', closeClubShopModal);
    if (shopTabPokiesBtn) {
      shopTabPokiesBtn.addEventListener('click', () => {
        sound.init();
        sound.playUiSelect();
        activeShopTab = 'POKIES';
        syncClubShopUI();
      });
    }
    if (shopTabStadiumsBtn) {
      shopTabStadiumsBtn.addEventListener('click', () => {
        sound.init();
        sound.playUiSelect();
        activeShopTab = 'STADIUMS';
        syncClubShopUI();
      });
    }

    const openLeaderboardBtn = document.getElementById('openLeaderboardBtn');
    const closeLeaderboardModalBtn = document.getElementById('closeLeaderboardModalBtn');
    const lbSortRankBtn = document.getElementById('lbSortRankBtn');
    const lbSortMoneyBtn = document.getElementById('lbSortMoneyBtn');
    const lbGoogleSignInBtn = document.getElementById('lbGoogleSignInBtn');
    if (openLeaderboardBtn) openLeaderboardBtn.addEventListener('click', () => openLeaderboardModal());
    if (closeLeaderboardModalBtn) closeLeaderboardModalBtn.addEventListener('click', closeLeaderboardModal);
    if (lbSortRankBtn) lbSortRankBtn.addEventListener('click', () => setLeaderboardSort('RANK'));
    if (lbSortMoneyBtn) lbSortMoneyBtn.addEventListener('click', () => setLeaderboardSort('MONEY'));
    if (lbGoogleSignInBtn) lbGoogleSignInBtn.addEventListener('click', handleGoogleLeaderboardSignIn);

    const stadiumPrevBtn = document.getElementById('stadiumPrevBtn');
    const stadiumNextBtn = document.getElementById('stadiumNextBtn');
    const stadiumShuffleBtn = document.getElementById('stadiumShuffleBtn');
    if (stadiumPrevBtn) stadiumPrevBtn.addEventListener('click', () => cycleUnlockedStadium(-1));
    if (stadiumNextBtn) stadiumNextBtn.addEventListener('click', () => cycleUnlockedStadium(1));
    if (stadiumShuffleBtn) stadiumShuffleBtn.addEventListener('click', toggleShuffleArenaMode);

    for (const t of TOURNAMENT_TIER_LIST) {
      const tBtn = document.getElementById(`tourneyTierBtn_${t.id}`);
      if (tBtn) {
        tBtn.addEventListener('click', () => selectTournamentTier(t.id));
      }
    }
    const backToPokieLobbyBtn = document.getElementById('backToPokieLobbyBtn');
    if (backToPokieLobbyBtn) {
      backToPokieLobbyBtn.addEventListener('click', () => {
        sound.init();
        sound.playUiBack();
        showPokieLobbyScreen();
      });
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
    const launchJackpotMatchBtn = document.getElementById('launchJackpotMatchBtn');
    if (launchJackpotMatchBtn) {
      launchJackpotMatchBtn.addEventListener('click', () => {
        launchJackpotChallengeMatch();
      });
    }

    if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
    const profileSettingsToggleBtn = document.getElementById('profileSettingsToggleBtn');
    const deleteAccountInitBtn = document.getElementById('deleteAccountInitBtn');
    const deleteAccountCancelBtn = document.getElementById('deleteAccountCancelBtn');
    const deleteAccountConfirmBtn = document.getElementById('deleteAccountConfirmBtn');
    if (profileSettingsToggleBtn) {
      profileSettingsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleToggleProfileSettings();
      });
    }
    if (deleteAccountInitBtn) {
      deleteAccountInitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleInitDeleteAccountPrompt();
      });
    }
    if (deleteAccountCancelBtn) {
      deleteAccountCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCancelDeleteAccountPrompt();
      });
    }
    if (deleteAccountConfirmBtn) {
      deleteAccountConfirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleConfirmDeleteAndResetAccount();
      });
    }
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

          if (activeJackpotChallenge && activeJackpotChallenge.active) {
            const jpCheck = evaluateJackpotChallengeOutcome(
              activeJackpotChallenge,
              scoreYou,
              scoreAi,
              matchTime
            );
            if (jpCheck.ended) {
              endMatch(jpCheck.headline);
            }
          } else {
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
          }
        } else {
          if (activeJackpotChallenge && activeJackpotChallenge.active) {
            const jpCheck = evaluateJackpotChallengeOutcome(
              activeJackpotChallenge,
              scoreYou,
              scoreAi,
              matchTime
            );
            if (jpCheck.ended) {
              endMatch(jpCheck.headline);
            }
          } else {
            const check = checkMatchEndCondition(scoreYou, scoreAi, matchTime, isGoldenGoal);
            if (check.ended) {
              endMatch(check.reason);
            }
          }
        }
      } else if (gameState === 'GOAL_CELEBRATION') {
        updateBall();
        goalBannerTimer -= rawDt;
        if (goalBannerTimer <= 0) {
          if (activeJackpotChallenge && activeJackpotChallenge.active) {
            const jpCheck = evaluateJackpotChallengeOutcome(
              activeJackpotChallenge,
              scoreYou,
              scoreAi,
              matchTime
            );
            if (jpCheck.ended) {
              endMatch(jpCheck.headline);
              return;
            }
          }
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
        ctx.font = isCompact ? '900 10.5px "Bricolage Grotesque", sans-serif' : '900 12.5px "Bricolage Grotesque", sans-serif';
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
        ctx.font = `900 ${headlineFontPx}px "Bricolage Grotesque", sans-serif`;
        const measuredHeadW = ctx.measureText(goalBannerText).width;
        if (measuredHeadW > maxBannerW && measuredHeadW > 0) {
          headlineFontPx = Math.max(16, Math.floor(headlineFontPx * (maxBannerW / measuredHeadW)));
          ctx.font = `900 ${headlineFontPx}px "Bricolage Grotesque", sans-serif`;
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
    syncHomeArenaSelectorUI();
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
      showPokieLobby() {
        showPokieLobbyScreen();
      },
      selectPokieMachine(machineId: PokieMachineId) {
        selectPokieMachine(machineId);
      },
      selectPokieBet(betAmount: PokieBetAmount) {
        selectPokieBet(betAmount);
      },
      selectTournamentTier(tierId: TournamentTierId) {
        selectTournamentTier(tierId);
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
      triggerJackpotChallenge(
        machineId?: PokieMachineId,
        betAmount?: PokieBetAmount,
        challengeType: JackpotChallengeType = 'GRAND_JACKPOT'
      ) {
        const mId = machineId || selectedPokieMachine;
        const bet = betAmount || selectedPokieBet;
        const jp = getMachineEffectiveJackpot(mId, bet, userProfile.machineJackpots[mId]);
        return showJackpotGoalChallengePrompt(mId, bet, jp, challengeType);
      },
      launchJackpotChallengeMatch() {
        return launchJackpotChallengeMatch();
      },
      completeActiveJackpotMatchWithGoal() {
        scoreYou = 1;
        scoreAi = 0;
        if (activeJackpotChallenge) {
          endMatch('⚽ GOAL SCORED! SPIN TO WIN UNLOCKED!');
        }
      },
      openShop(tab?: 'POKIES' | 'STADIUMS') {
        const splashEl = document.getElementById('splashScreen');
        if (splashEl) splashEl.classList.add('hidden');
        openClubShopModal(tab);
      },
      buyPokieMachine(machineId: PokieMachineId) {
        return handleBuyShopPokie(machineId);
      },
      buyStadium(stadiumId: PitchThemeId) {
        return handleBuyShopStadium(stadiumId);
      },
      openLeaderboard(sortMode?: LeaderboardSortMode) {
        const splashEl = document.getElementById('splashScreen');
        if (splashEl) splashEl.classList.add('hidden');
        openLeaderboardModal(sortMode);
      },
      setLeaderboardSort(sortMode: LeaderboardSortMode) {
        setLeaderboardSort(sortMode);
      },
      getLeaderboardEntries() {
        return getMergedLeaderboardEntries();
      },
      getUnlockedPokies() {
        return [...userProfile.unlockedPokies];
      },
      getUnlockedStadiums() {
        return [...userProfile.unlockedStadiums];
      },
      getPendingJackpotChallenge() {
        return pendingJackpotChallenge;
      },
      setBalance(amount: number) {
        userProfile.balance = Math.max(0, Math.floor(amount));
        saveUserProfileToStorage();
        syncUserProfileUI();
        syncClubShopUI();
        syncPokieMachineThemeAndBetUI();
        return userProfile.balance;
      },
      setMatchTimer(sec: number) {
        matchTime = sec;
        const tmEl = document.getElementById('timerText');
        if (tmEl) tmEl.innerText = formatMatchTimer(Math.max(0, Math.ceil(matchTime)));
      },
      setPlayerAndBallPosition(x: number, y: number) {
        if (controlledPlayer) {
          controlledPlayer.x = x;
          controlledPlayer.y = y;
          controlledPlayer.vx = 0;
          controlledPlayer.vy = 0;
        }
        ball.x = x + 16;
        ball.y = y;
        ball.vx = 0;
        ball.vy = 0;
        for (let i = 0; i < 40; i++) {
          updateCameraAndVFX();
        }
      },
      getCameraAndViewportState() {
        return {
          camX: cam.x,
          camY: cam.y,
          camZoom: cam.zoom,
          viewScale,
          canvasWidth: canvas?.width || 0,
          canvasHeight: canvas?.height || 0,
          matchTime,
          scoreYou,
          scoreAi,
          selectedPitchTheme,
          activeJackpotChallenge,
          pendingJackpotChallenge,
        };
      },
      getProfileState() {
        return {
          ...userProfile,
          selectedPokieMachine,
          selectedPokieBet,
          selectedTournamentTier,
          pokieModalScreen,
          activeHoldAndSpinSession,
          pendingJackpotChallenge,
          activeJackpotChallenge,
          preferredArenaMode,
          selectedPitchTheme,
          homeMenuStadiumId,
        };
      },
      cycleStadium(step = 1) {
        cycleUnlockedStadium(step);
        return { preferredArenaMode, selectedPitchTheme, homeMenuStadiumId };
      },
      toggleShuffleStadium() {
        toggleShuffleArenaMode();
        return { preferredArenaMode, selectedPitchTheme, homeMenuStadiumId };
      },
      getDifficultyProfile() {
        return getActiveDifficultyPreset();
      },
      deleteAndResetAccount() {
        return handleConfirmDeleteAndResetAccount();
      },
    };
    (window as unknown as Record<string, unknown>).__TIKI_TAKA_TEST__ = (
      window as unknown as Record<string, unknown>
    ).__REMATCH_TEST__;

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(pingInterval);
      clearMatchmakingTimers();
      clearSlotTimers();
      stopProfileCameraStream();
      sound.stopMusic();
      unsubscribeLeaderboard();
      unsubscribeAuth();
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
        <div className="glass-modal rounded-2xl max-w-sm w-full p-6 border-3 border-slate-900 shadow-[0_10px_0_#0f172a] flex flex-col items-center">
          <div className="w-16 h-16 rounded-xl bg-amber-300 border-2 border-slate-900 shadow-[0_4px_0_#0f172a] flex items-center justify-center mb-4">
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
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded bg-sky-100 border border-sky-400 text-[10px] font-black uppercase tracking-widest text-sky-900 mb-2">
            <span>LANDSCAPE ARENA MODE</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Rotate Device to Landscape
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1.5 mb-5">
            TIKI TAKA <span className="text-amber-500 font-black">0.2</span> is locked to widescreen landscape on mobile &amp; tablet for full-pitch viewing and dual-thumb arcade controls.
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

      {/* Boot-Up Start Page ("PRESS ANY BUTTON TO START") — Bold TIKI TAKA 0.2 Text Only */}
      <div
        id="splashScreen"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-10 bg-slate-950/15 cursor-pointer overflow-hidden"
      >
        <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-5xl px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-5 mb-6 sm:mb-10">
            <div className="relative inline-block transform -skew-x-6">
              <span className="font-display text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-wider text-white drop-shadow-[0_8px_0_#0f172a] [text-stroke:3px_#0f172a]">
                TIKI TAKA
              </span>
            </div>
            <div className="transform -skew-x-6 px-3.5 py-1 sm:px-5 sm:py-1.5 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border-[3px] border-slate-950 shadow-[0_6px_0_#0f172a] flex flex-col items-center">
              <span className="font-mono-num text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-950 leading-none">
                0.2
              </span>
            </div>
          </div>

          <button
            id="splashStartBtn"
            type="button"
            className="px-6 py-2.5 sm:px-8 sm:py-3 rounded-lg bg-slate-950/85 border-2 border-amber-400 text-amber-300 font-display text-sm sm:text-xl tracking-[0.2em] uppercase cursor-pointer shadow-[0_5px_0_#0f172a] focus:outline-none"
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
            className="hidden absolute top-12 left-1/2 -translate-x-1/2 sm:static sm:translate-x-0 glass-pill rounded-xl sm:rounded-2xl px-2.5 py-0.5 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/95 whitespace-nowrap shadow-[0_2px_0_#0f172a]"
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

      {/* Mobile & Tablet Touch Controls (Clean, Uncluttered Arcade Controls for Portrait & Landscape) */}
      <div
        id="mobileControls"
        style={{ display: 'none' }}
        className="mobile-controls-safe hidden fixed bottom-0 left-0 w-full justify-between items-end pointer-events-none z-20"
      >
        {/* Left Thumb: Clean Translucent 360° Analog Thumbstick */}
        <div
          id="joystickZone"
          aria-label="Virtual Movement Joystick"
          className="touch-joy-zone rounded-full relative flex items-center justify-center pointer-events-auto touch-none transition-opacity"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-white/25 pointer-events-none absolute" />
          <div
            id="joystickKnob"
            className="touch-joy-knob rounded-full transition-transform duration-75 pointer-events-none relative z-10 flex items-center justify-center"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-amber-300 border-2 border-slate-900" />
          </div>
        </div>

        {/* Right Thumb: Clean Dual-Button Action Cluster */}
        <div className="flex items-end space-x-2 sm:space-x-3 pointer-events-auto touch-none">
          <button
            id="mobileSwitchBtn"
            type="button"
            aria-label="Send Teammate Run or Switch Defender"
            className="touch-btn-secondary px-1.5 rounded-full font-black flex flex-col items-center justify-center active:scale-92 active:translate-y-0.5 transition-all mb-0.5 overflow-hidden text-center"
          >
            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-300 border-2 border-slate-900 flex items-center justify-center mb-0.5 shrink-0">
              <i className="fa-solid fa-bolt text-[9px] text-slate-900" />
            </span>
            <span id="mobileSecondaryText" className="text-[9px] sm:text-[10px] uppercase tracking-wider leading-none font-black text-center whitespace-nowrap">
              RUN
            </span>
          </button>
          <button
            id="mobileActionBtn"
            type="button"
            aria-label="Kick, Pass, or Hold for Finesse Shot"
            className="touch-btn-primary px-1.5 rounded-full font-black flex flex-col items-center justify-center active:scale-92 active:translate-y-1 transition-all mb-1.5 overflow-hidden text-center"
          >
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/95 border-2 border-slate-900 flex items-center justify-center mb-0.5 shrink-0">
              <PixelSoccerBallIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
            <span id="mobileActionText" className="text-[10px] sm:text-[11px] uppercase tracking-wider leading-none font-black text-center whitespace-nowrap">
              KICK
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
            You conquered the Quarter-Final, Semi-Final &amp; Grand Final to lift the Tiki Taka Cup!
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
          {/* Top Bar: Clean TIKI TAKA 0.2 Text Wordmark (No Logo Icon) & Clickable Player Profile Card */}
          <div
            id="menuTopBar"
            className="glass-modal rounded-2xl px-3.5 py-2 sm:px-5 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3"
          >
            <div className="flex items-center">
              <div
                id="menuTitleVisible"
                className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-2xl md:text-3xl font-black tracking-wide text-slate-900 whitespace-nowrap"
              >
                <span className="font-display tracking-wide transform -skew-x-6 inline-block">
                  TIKI TAKA
                </span>
                <span className="font-mono-num text-xs sm:text-lg md:text-xl font-black px-2 py-0.5 bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] transform -skew-x-6 inline-block leading-none">
                  0.2
                </span>
              </div>
              <h1 id="menuTitle" className="sr-only">
                TIKI TAKA 0.2
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
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-black tracking-wide whitespace-nowrap bg-amber-100 text-amber-900 border-amber-700"
                    >
                      Bronze I • LVL 1
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

                {/* Tiered Tournament Entry Selector ($100 / $1,000 / $10,000 Entry & Scaled Cup Awards) */}
                <div id="tournamentTierSelectorWrap" className="hidden mt-2 p-2 rounded-2xl bg-amber-50/90 border-2 border-slate-900 shadow-[0_3px_0_#0f172a]">
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-900">
                      🏆 SELECT TOURNAMENT TIER
                    </span>
                    <span className="text-[8.5px] font-black uppercase text-emerald-800">
                      5X CUP PAYOUT
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TOURNAMENT_TIER_LIST.map((t) => (
                      <button
                        key={t.id}
                        id={`tourneyTierBtn_${t.id}`}
                        type="button"
                        data-tier={t.id}
                        className="tourney-tier-btn p-1.5 sm:p-2 rounded-xl border-2 border-slate-900 bg-white text-left transition-all cursor-pointer flex flex-col justify-between min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                          <span className="text-[8.5px] sm:text-[10px] font-black uppercase tracking-tight text-slate-900 truncate">
                            {t.shortName}
                          </span>
                          <span className="font-mono-num text-[8.5px] sm:text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 self-start sm:self-auto">
                            ${t.entryFee.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-[7.5px] sm:text-[8.5px] font-extrabold text-emerald-800 uppercase tracking-tight truncate">
                          Win: ${t.totalCupPrize.toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div
                    id="tourneyEntryStatusBanner"
                    className="hidden mt-1.5 p-1.5 rounded-xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[9.5px] uppercase tracking-wide text-center"
                  />
                </div>
              </div>

              {/* 2. Home / Away Kit Selector */}
              <div id="kitSelectorWrap">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 px-1">
                  SELECT TEAM KIT
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="kitHomeBtn"
                    type="button"
                    data-kit="HOME"
                    className="kit-btn min-h-[42px] py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer bg-sky-400 text-slate-900 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex items-center justify-center gap-2"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-300 border border-slate-900 shrink-0" />
                    <span className="truncate">Home Kit (Sky)</span>
                  </button>
                  <button
                    id="kitAwayBtn"
                    type="button"
                    data-kit="AWAY"
                    className="kit-btn min-h-[42px] py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer bg-slate-100 text-slate-600 hover:text-slate-900 border-2 border-slate-300 flex items-center justify-center gap-2"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-slate-900 shrink-0" />
                    <span className="truncate">Away Kit (Coral)</span>
                  </button>
                </div>
              </div>

              {/* 3. Home Arena Selector & Shuffle Bar (Uncramped, Clean Layout for Mobile & PC, No Ratio Text) */}
              <div id="stadiumSelectorWrap" className="pt-1.5 border-t-2 border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5 px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600">
                      MATCH STADIUM
                    </span>
                    <span
                      id="stadiumUnlockedCountText"
                      className="font-mono-num text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 border border-emerald-500 text-emerald-800"
                    >
                      1/10 UNLOCKED
                    </span>
                  </div>
                  <button
                    id="stadiumShuffleBtn"
                    type="button"
                    title="When ON, keeps your Home Menu arena steady and randomly selects an unlocked stadium when a match loads"
                    className="btn-clean py-1 px-2.5 rounded-lg bg-amber-300 border-2 border-slate-900 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer shrink-0"
                  >
                    🎲 Shuffle: ON
                  </button>
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl bg-slate-100 border-2 border-slate-900 flex items-center justify-between gap-2 sm:gap-3">
                  <button
                    id="stadiumPrevBtn"
                    type="button"
                    aria-label="Previous Unlocked Stadium"
                    className="btn-clean w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white hover:bg-slate-200 border-2 border-slate-900 text-slate-900 font-black text-xs flex items-center justify-center cursor-pointer shrink-0 shadow-[0_2px_0_#0f172a]"
                  >
                    ◀
                  </button>
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div
                      id="homeStadiumTrueRatioPreview"
                      className="w-20 sm:w-24 md:w-28 aspect-[2720/1580] rounded-md border-2 border-slate-900 bg-slate-950 overflow-hidden shrink-0 shadow-[0_2px_0_#0f172a]"
                      dangerouslySetInnerHTML={{
                        __html: getTrueRatioStadiumSvgHtml('CLASSIC_TURF'),
                      }}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <div
                        id="activeStadiumNameText"
                        className="text-xs sm:text-sm md:text-base font-black text-slate-900 leading-tight break-words"
                      >
                        Sunlit Classic
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span
                          id="activeStadiumModePill"
                          className="inline-block px-2 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider border border-slate-900 bg-amber-300 text-slate-950 leading-none"
                        >
                          🎲 SHUFFLE ON MATCH LOAD
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    id="stadiumNextBtn"
                    type="button"
                    aria-label="Next Unlocked Stadium"
                    className="btn-clean w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white hover:bg-slate-200 border-2 border-slate-900 text-slate-900 font-black text-xs flex items-center justify-center cursor-pointer shrink-0 shadow-[0_2px_0_#0f172a]"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Locker-Room 1v1 Online Matchmaking Card */}
            <div
              id="matchmakingCard"
              className="sm:col-span-5 w-full p-3.5 sm:p-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_6px_0_#0f172a] text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider mb-2.5 sm:mb-3 px-1">
                <span id="mmStatusLabel" className="flex items-center space-x-2 text-slate-800 transition-colors min-w-0">
                  <i id="mmStatusIcon" className="fa-solid fa-futbol text-sky-500 text-xs shrink-0" />
                  <span id="mmStatusText" className="truncate">Casual 1v1 Matchmaking</span>
                </span>
                <span id="mmSearchTimer" className="font-mono-num text-[11px] font-bold text-sky-600 hidden shrink-0 ml-2">
                  0.0s
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 relative items-stretch my-auto">
                {/* Left Card: YOU */}
                <div className="bg-slate-50 rounded-2xl p-2.5 sm:p-3.5 border-2 border-slate-900 shadow-[0_3px_0_rgba(15,23,42,0.08)] flex flex-col items-center justify-center text-center min-w-0">
                  <div
                    id="mmYouAvatar"
                    className="w-12 h-12 sm:w-15 sm:h-15 rounded-2xl bg-sky-400 border-[3px] border-amber-600 text-slate-900 font-black text-xs flex flex-col items-center justify-center shadow-xs mb-1.5 relative overflow-hidden transition-colors shrink-0"
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
                    Player
                  </div>
                  <div
                    id="mmYouPill"
                    className="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 rounded-full bg-sky-100 text-[9.5px] sm:text-[10.5px] font-extrabold text-sky-800 max-w-full"
                  >
                    <span id="mmYouDot" className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                    <span id="mmYouMeta" className="truncate">Home Kit (Sky)</span>
                  </div>
                </div>

                {/* Center Floating VS Badge */}
                <div
                  id="mmVsBadge"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-amber-300 text-slate-900 font-black text-[11px] sm:text-xs flex items-center justify-center shadow-[0_3px_0_#0f172a] border-2 border-slate-900 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-colors duration-200"
                >
                  VS
                </div>

                {/* Right Card: RIVAL SLOT */}
                <div
                  id="mmOpponentSlotCard"
                  className="bg-gradient-to-b from-rose-50 to-white rounded-2xl p-2.5 sm:p-3.5 border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-center transition-colors duration-200 min-w-0"
                >
                  <div
                    id="mmOpponentAvatar"
                    className="w-12 h-12 sm:w-15 sm:h-15 rounded-2xl bg-rose-100/80 border-2 border-dashed border-rose-300 text-rose-500 font-black text-sm flex items-center justify-center mb-1.5 relative transition-colors duration-200 shrink-0"
                  >
                    <i className="fa-solid fa-user-astronaut text-sm" />
                  </div>
                  <div id="mmOpponentName" className="text-xs sm:text-sm font-black text-rose-500 truncate max-w-full px-1">
                    Open Slot
                  </div>
                  <div
                    id="mmOpponentPingPill"
                    className="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 rounded-full bg-rose-100 text-[9.5px] sm:text-[10.5px] font-extrabold text-rose-800 max-w-full"
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
                className="indie-cta-btn w-full sm:w-auto sm:min-w-[210px] min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-5 sm:px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <i id="startBtnIcon" className="fa-solid fa-play text-xs shrink-0" />
                <span id="startBtnText" className="whitespace-nowrap">FIND CASUAL MATCH</span>
              </button>

              <button
                id="openSlotMachineBtn"
                type="button"
                aria-label="Open Pokies Lounge"
                className="indie-cta-btn w-full sm:w-auto sm:min-w-[130px] min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 hover:from-amber-200 hover:to-yellow-200 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <PixelSlotMachineIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="whitespace-nowrap">POKIES</span>
              </button>

              <button
                id="openShopBtn"
                type="button"
                aria-label="Open Club Shop"
                className="indie-cta-btn w-full sm:w-auto sm:min-w-[125px] min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-400 hover:from-emerald-200 hover:to-teal-200 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <PixelGoldCoinIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="whitespace-nowrap">SHOP</span>
              </button>

              <button
                id="openLeaderboardBtn"
                type="button"
                aria-label="Open Online Leaderboard"
                className="indie-cta-btn w-full sm:w-auto sm:min-w-[145px] min-h-[44px] sm:min-h-[48px] py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-300 via-sky-300 to-cyan-300 hover:from-indigo-200 hover:to-cyan-200 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-ranking-star text-xs sm:text-sm text-slate-900 shrink-0" />
                <span className="whitespace-nowrap">LEADERBOARD</span>
              </button>

              <button
                id="rematchSameBtn"
                type="button"
                className="btn-clean hidden w-full sm:w-auto sm:min-w-[160px] min-h-[42px] py-2 px-4 sm:px-5 rounded-2xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-rotate-right text-xs shrink-0" />
                <span id="rematchSameText" className="whitespace-nowrap">Rematch</span>
              </button>

              <button
                id="mainMenuBtn"
                type="button"
                className="btn-clean hidden w-full sm:w-auto sm:min-w-[150px] min-h-[42px] py-2 px-4 sm:px-5 rounded-2xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-900 font-black text-xs sm:text-sm tracking-wide cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-house text-xs shrink-0" />
                <span className="whitespace-nowrap">Home Menu</span>
              </button>

              <button
                id="resumeBtn"
                type="button"
                className="indie-cta-btn hidden w-full sm:w-auto sm:min-w-[165px] min-h-[44px] py-2.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs sm:text-sm tracking-wide cursor-pointer"
              >
                Resume Match
              </button>

              <button
                id="forfeitBtn"
                type="button"
                className="btn-clean hidden w-full sm:w-auto sm:min-w-[155px] min-h-[42px] py-2 px-4 sm:px-5 rounded-2xl bg-rose-500 hover:bg-rose-400 border-2 border-slate-900 text-white font-black text-xs sm:text-sm tracking-wide uppercase cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-house text-xs shrink-0" />
                <span className="whitespace-nowrap">Forfeit Match</span>
              </button>

              <div id="howToPlayWrap" className="flex items-center justify-center w-full sm:w-auto">
                <button
                  id="howToPlayBtn"
                  type="button"
                  className="btn-clean w-full sm:w-auto min-h-[42px] py-2 px-4 sm:px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-700 font-extrabold text-xs tracking-wide cursor-pointer whitespace-nowrap"
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

          {/* VIEW 1: PROFILE OVERVIEW (Displays Rank Crest, Level-Up Bar, Wallet, Edit Profile & Bottom Coupon Code Input) */}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    CLUB CAPTAIN
                  </span>
                  <span
                    id="overviewClubLevelBadge"
                    className="px-2 py-0.2 rounded-full bg-slate-900 text-amber-300 font-mono-num text-[9px] font-black uppercase tracking-wider"
                  >
                    CLUB LVL 1
                  </span>
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
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 text-xs font-black tracking-wide bg-amber-100 text-amber-900 border-amber-700"
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

            {/* Refined Competitive Rank & Division Crest + Level-Up Progression Card */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    id="overviewRankSymbolBox"
                    className="w-12 h-12 rounded-2xl border-2 border-amber-700 bg-amber-100 flex items-center justify-center shrink-0 shadow-[0_2px_0_#0f172a]"
                    dangerouslySetInnerHTML={{
                      __html: getRankCrestSvgHtml(RANK_TIERS[0], 'w-8 h-8'),
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      COMPETITIVE DIVISION &amp; RANK
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        id="overviewRankedWinsText"
                        className="font-mono-num text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-500"
                      >
                        0 Wins • Div I
                      </span>
                      <span
                        id="overviewRankPointsText"
                        className="font-mono-num text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-500"
                      >
                        0 RP
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Division Promotion Bar */}
              <div>
                <div className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  <span>RANK LADDER PROGRESS</span>
                  <span className="font-mono-num text-emerald-700">100 RP PER WIN</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-900 p-0.5">
                  <div
                    id="overviewRankProgressBar"
                    className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 rounded-full transition-all duration-300"
                    style={{ width: '8%' }}
                  />
                </div>
                <div id="overviewNextRankText" className="text-[10.5px] font-bold text-slate-700 mt-1">
                  Win 1 more Ranked match to reach Bronze II
                </div>
              </div>

              {/* Club Level-Up XP Bar */}
              <div className="pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  <span>CLUB LEVEL-UP BAR</span>
                  <span id="overviewLevelXpText" className="font-mono-num text-indigo-700">
                    0 / 100 XP TO LVL 2
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-900">
                  <div
                    id="overviewLevelProgressBar"
                    className="h-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: '6%' }}
                  />
                </div>
              </div>

              {/* 7-Division Crest Symbols Strip */}
              <div className="grid grid-cols-7 gap-1 pt-1">
                {RANK_TIERS.map((tier, idx) => (
                  <div
                    key={tier.name}
                    id={`overviewTierNode${idx}`}
                    className="p-1 rounded-xl border flex flex-col items-center justify-center text-center transition-all"
                    style={{
                      backgroundColor: idx === 0 ? tier.badgeBgHex : '#f1f5f9',
                      borderColor: idx === 0 ? tier.borderHex : '#cbd5e1',
                    }}
                  >
                    <span
                      dangerouslySetInnerHTML={{
                        __html: getRankCrestSvgHtml(tier, 'w-4 h-4'),
                      }}
                    />
                    <span className="text-[7.5px] font-black text-slate-800 leading-tight mt-0.5 truncate max-w-full">
                      {tier.shortLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              id="switchToEditProfileBtn"
              type="button"
              className="indie-cta-btn w-full py-3 px-6 rounded-2xl bg-amber-300 hover:bg-amber-200 text-slate-900 font-black text-xs sm:text-sm tracking-wide uppercase cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-pen-to-square text-xs" />
              <span>Edit Name &amp; Avatar</span>
            </button>

            {/* Coupon Code Redemption Section */}
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

            {/* Settings Button & Delete Account Confirmation Flow at Bottom of Profile Tab */}
            <div id="profileSettingsWrap" className="pt-1 border-t-2 border-slate-200">
              <button
                id="profileSettingsToggleBtn"
                type="button"
                className="btn-clean w-full py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-800 font-black text-xs uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-gear text-xs" />
                <span>Settings</span>
              </button>

              <div
                id="profileSettingsPanel"
                className="hidden mt-2.5 p-3 rounded-2xl bg-slate-100 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                    ACCOUNT &amp; DATA SETTINGS
                  </span>
                  <span className="text-[9px] font-mono-num font-bold text-slate-500">
                    LOCAL + CLOUD SAVE
                  </span>
                </div>

                <div
                  id="deleteAccountStatusBanner"
                  className="hidden p-2 rounded-xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[10px] uppercase tracking-wide text-center"
                />

                <button
                  id="deleteAccountInitBtn"
                  type="button"
                  className="btn-clean w-full py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 border-2 border-slate-900 text-white font-black text-xs uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-trash-can text-xs" />
                  <span>Delete Account</span>
                </button>

                <div
                  id="deleteAccountConfirmBox"
                  className="hidden p-3 rounded-xl bg-rose-50 border-2 border-rose-600 space-y-2.5 text-left"
                >
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-rose-900">
                        WARNING: PERMANENT ACCOUNT RESET
                      </div>
                      <p className="text-[11px] font-bold text-rose-800 mt-0.5 leading-snug">
                        You will lose all your progress, bankroll, competitive rank, unlocked stadiums, and pokie machines. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <button
                      id="deleteAccountConfirmBtn"
                      type="button"
                      className="btn-clean w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 border-2 border-slate-900 text-white font-black text-[11px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer text-center"
                    >
                      Are You Sure? Reset Account
                    </button>
                    <button
                      id="deleteAccountCancelBtn"
                      type="button"
                      className="btn-clean w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-800 font-black text-[11px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
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

      {/* REMATCH POKIES LOUNGE — 4-Button Machine Selection Screen + Decluttered Cabinet & Hold & Spin Bonus */}
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
            className="p-2.5 rounded-2xl bg-slate-900 border-2 border-amber-400 shadow-[0_4px_0_#0f172a] mb-2.5 relative overflow-hidden"
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
              <div className="flex items-center space-x-2 min-w-0">
                <button
                  id="backToPokieLobbyBtn"
                  type="button"
                  className="hidden btn-clean px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-950 text-amber-300 font-black text-[10px] uppercase tracking-wider cursor-pointer shrink-0 shadow-[0_2px_0_#000000]"
                >
                  ← Machines
                </button>
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 border-2 border-slate-950 shadow-[0_3px_0_#000000] flex items-center justify-center shrink-0">
                  <PixelSlotMachineIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div
                    id="slotCabinetTagline"
                    className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-amber-300 truncate"
                  >
                    TIKI TAKA 0.2 POKIES LOUNGE • 4 STADIUM &amp; VIP MACHINES
                  </div>
                  <h2
                    id="slotCabinetTitle"
                    className="text-sm sm:text-lg font-black text-white tracking-tight truncate"
                  >
                    SELECT A POKIE MACHINE
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

          {/* =================================================================== */}
          {/* DEDICATED SCREEN 1: 4-BUTTON POKIE MACHINE SELECTION LOUNGE         */}
          {/* =================================================================== */}
          <div id="pokieLobbyScreen" className="space-y-2.5">
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a]">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                  CHOOSE A MACHINE TO ENTER
                </div>
                <div className="text-[9px] font-bold text-slate-500">
                  Unlock locked machines in the Club Shop ($1,500 to $80,000 High Roller)
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 border-2 border-slate-900 shrink-0">
                <PixelGoldCoinIcon className="w-4 h-4 shrink-0" />
                <span id="pokieLobbyBalanceText" className="font-mono-num text-xs sm:text-sm font-black text-emerald-950">
                  $30
                </span>
              </div>
            </div>

            <div
              id="pokieLobbyLockBanner"
              className="hidden p-2 rounded-xl bg-rose-200 border-2 border-slate-900 text-rose-950 font-black text-[10px] uppercase tracking-wide text-center shadow-[0_2px_0_#0f172a]"
            />

            {/* 4 Visually Distinct Pokie Machine Cabinets (Each with bespoke cabinet artwork & silhouette) */}
            <div id="slotMachineSelectorBar" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {POKIE_MACHINE_LIST.map((m) => {
                const isHighRoller = m.id === 'HIGH_ROLLER_ROYAL';
                const stakesBadgeText = isHighRoller ? '$1,000 VIP SPIN' : '$10 / $100 SPINS';
                const defaultJp = m.defaultBet === 1000 ? m.baseJackpot10 * 100 : m.baseJackpot10;
                const isDefaultUnlocked = DEFAULT_UNLOCKED_POKIES.includes(m.id);
                return (
                  <button
                    key={m.id}
                    id={`slotMachineBtn_${m.id}`}
                    type="button"
                    data-machine-id={m.id}
                    data-unlocked={isDefaultUnlocked ? 'true' : 'false'}
                    style={{ background: m.headerGradient }}
                    className={`slot-machine-select-btn relative p-3 rounded-xl border-3 border-slate-900 shadow-[0_4px_0_#0f172a] text-left transition-all flex flex-col justify-between min-h-[156px] overflow-hidden ${
                      isDefaultUnlocked
                        ? 'hover:translate-y-[-1px] cursor-pointer'
                        : 'cursor-not-allowed grayscale opacity-75'
                    }`}
                  >
                    {/* LOCKED OVERLAY (Shown until purchased in the Club Shop) */}
                    <div
                      id={`slotMachineLockOverlay_${m.id}`}
                      className={`${
                        isDefaultUnlocked ? 'hidden ' : ''
                      }absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-[1.5px] flex flex-col items-center justify-center p-2 text-center`}
                    >
                      <div className="px-3 py-1 rounded bg-amber-300 border-2 border-slate-950 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-[0_3px_0_#000000]">
                        🔒 LOCKED • ${m.unlockPrice.toLocaleString()}
                      </div>
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-white mt-1">
                        Unlock in Club Shop to Play
                      </div>
                    </div>

                    {/* Bespoke Pokie Machine Illustration Preview */}
                    <div className="mb-2">
                      <ShopPokiePreviewIllustration machineId={m.id} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className="text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-slate-950"
                          style={{ backgroundColor: m.accentHex, color: '#0f172a' }}
                        >
                          {stakesBadgeText}
                        </span>
                        <span className="text-[8.5px] font-black uppercase tracking-wider text-white/80 truncate">
                          {m.stadiumName}
                        </span>
                      </div>
                      <div
                        id={`slotMachineName_${m.id}`}
                        className="text-sm sm:text-base font-black uppercase tracking-tight text-white mt-1"
                      >
                        {m.name}
                      </div>
                      <div
                        id={`slotMachineSub_${m.id}`}
                        className="text-[9px] font-bold uppercase tracking-wider text-white/80 mt-0.5"
                      >
                        {m.tagline}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/15 flex items-center justify-between">
                      <div>
                        <div className="text-[7.5px] font-black uppercase tracking-widest text-amber-300">
                          GRAND JACKPOT
                        </div>
                        <div
                          id={`slotMachineJackpot_${m.id}`}
                          className="font-mono-num text-xs sm:text-sm font-black text-white"
                        >
                          ${defaultJp.toLocaleString()}
                        </div>
                      </div>
                      <span
                        id={`slotMachineCtaPill_${m.id}`}
                        className="px-2.5 py-1 rounded-lg font-black text-[9.5px] uppercase tracking-wider border-2 border-slate-950 shadow-[0_2px_0_#000000]"
                        style={{ backgroundColor: m.accentHex, color: '#0f172a' }}
                      >
                        {isDefaultUnlocked ? 'PLAY MACHINE →' : `🔒 $${m.unlockPrice.toLocaleString()} IN SHOP`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =================================================================== */}
          {/* DEDICATED SCREEN 2: DECLUTTERED POKIE MACHINE CABINET               */}
          {/* =================================================================== */}
          <div id="pokieCabinetScreen" className="hidden">
            {/* Progressive Grand Jackpot, Bankroll, Last Payout */}
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

            {/* Clean Spin Stakes Bar ($10/$100 Toggle OR $1,000 High Roller VIP Badge) */}
            <div className="flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#0f172a] mb-2">
              <div className="flex items-center gap-1.5 pl-1">
                <PixelGoldCoinIcon className="w-4 h-4 shrink-0" />
                <div>
                  <div id="slotStakesTitle" className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-900 leading-tight">
                    SPIN STAKES
                  </div>
                  <div id="slotStakesSubtitle" className="text-[8px] font-bold text-slate-500 leading-tight">
                    $100 Bet = 10x Line Wins &amp; 10x Jackpot
                  </div>
                </div>
              </div>
              <div id="slotStandardBetBtnsWrap" className="flex items-center gap-1.5 shrink-0">
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
              <div
                id="slotHighRollerStakeBadge"
                className="hidden py-1.5 px-3 rounded-xl font-mono-num text-xs font-black bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] shrink-0"
              >
                👑 $1,000 VIP SPIN
              </div>
            </div>

            {/* =================================================================== */}
            {/* SCREEN MODE 1: MAIN 3x3 5-PAYLINE REEL CABINET (CLEAN & REFINED)    */}
            {/* =================================================================== */}
            <div id="slotMainGameScreen">
              <div
                id="slotReelHousing"
                className="p-2 sm:p-2.5 rounded-3xl bg-slate-900 border-3 border-amber-400 shadow-[0_4px_0_#0f172a,inset_0_4px_12px_rgba(0,0,0,0.65)] mb-2 relative"
              >
                <div className="flex items-center justify-between text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-amber-300 mb-1.5 px-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>5 PAYLINES • 3+ ORBS = HOLD &amp; SPIN</span>
                  </span>
                  <span id="slotSpinsLeftDisplay" className="text-emerald-300 font-mono-num">
                    3 SPINS READY
                  </span>
                </div>

                {/* Full-Width 3x3 Reel Window (Decluttered without side anchor pills) */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-slate-950 p-1.5 sm:p-2 rounded-2xl border-2 border-slate-700 overflow-hidden relative">
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
              </div>

              {/* JACKPOT GOAL CHALLENGE SPEECH BUBBLE / MESSAGE CARD (Appears when Jackpot or Hold & Spin is hit!) */}
              <div
                id="jackpotChallengePromptWrap"
                className="hidden mb-2 p-3 rounded-2xl bg-gradient-to-b from-amber-200 via-yellow-100 to-white border-3 border-slate-900 shadow-[0_5px_0_#0f172a] text-center relative"
              >
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[9px] font-black uppercase tracking-widest mb-1">
                  <span>💬 JACKPOT GOAL CHALLENGE!</span>
                </div>
                <h3
                  id="jackpotBubbleTitle"
                  className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight"
                >
                  🎰 YOU HIT THE $500 JACKPOT!
                </h3>
                <p
                  id="jackpotBubbleText"
                  className="mt-1 text-[10px] sm:text-[11px] font-extrabold text-slate-800 leading-snug bg-white/90 p-2 rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a]"
                >
                  &ldquo;You won the Jackpot! Score 1 GOAL in 30 seconds in the machine&apos;s stadium to claim your Jackpot! If you concede a goal or run out of time, you lose the Jackpot!&rdquo;
                </p>
                <div className="mt-1.5 mb-2">
                  <span
                    id="jackpotBubbleStadiumPill"
                    className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-200 border border-slate-900 text-[9px] font-black uppercase tracking-wider text-emerald-950"
                  >
                    🏟️ CHAMPIONS CATHEDRAL • 30s SUDDEN DEATH
                  </span>
                </div>
                <button
                  id="launchJackpotMatchBtn"
                  type="button"
                  className="indie-cta-btn w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 animate-bounce"
                >
                  <PixelSoccerBallIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span id="launchJackpotMatchBtnLabel">⚽ PLAY 30s JACKPOT MATCH ($500)</span>
                </button>
              </div>

              {/* Live Pokie Status & Win Callout Banner */}
              <div
                id="slotStatusBanner"
                className="p-2 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-800 font-black text-[10px] sm:text-[11px] uppercase tracking-wide text-center mb-2 shadow-[0_2px_0_#0f172a]"
              >
                LAND 3+ CROWN ORBS FOR HOLD &amp; SPIN OR 3x CUPS FOR JACKPOT MATCH!
              </div>

              {/* Primary Arcade Spin Lever Button */}
              <button
                id="slotSpinBtn"
                type="button"
                className="indie-cta-btn w-full min-h-[46px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 hover:from-emerald-300 hover:to-sky-300 disabled:opacity-60 text-slate-900 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-2 mb-2"
              >
                <PixelGoldCoinIcon className="w-5 h-5 shrink-0" />
                <span id="slotSpinBtnLabel">SPIN REELS • $10</span>
              </button>

              {/* Simple, Clean 3-Badge Payout Strip */}
              <div
                id="slotPaytableFooter"
                className="p-1.5 sm:p-2 rounded-2xl bg-white/95 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]"
              >
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1 rounded-xl bg-amber-100 border border-slate-900">
                    <div className="text-[7.5px] font-black uppercase text-amber-900">🏆 3x CUP = MATCH</div>
                    <div id="slotPtJackpotVal" className="font-mono-num text-[9px] sm:text-[10px] font-black text-slate-950 truncate">
                      $500
                    </div>
                  </div>
                  <div className="p-1 rounded-xl bg-pink-100 border border-slate-900">
                    <div className="text-[7.5px] font-black uppercase text-pink-900">👑 3+ ORBS = MATCH</div>
                    <div id="slotPtHoldVal" className="font-mono-num text-[8.5px] sm:text-[9.5px] font-black text-slate-950 truncate">
                      HOLD &amp; SPIN
                    </div>
                  </div>
                  <div className="p-1 rounded-xl bg-sky-100 border border-slate-900">
                    <div className="text-[7.5px] font-black uppercase text-sky-900">⭐ WILD / LINES</div>
                    <div id="slotPtLineVal" className="font-mono-num text-[8.5px] sm:text-[9.5px] font-black text-slate-950 truncate">
                      2X • $10–$200
                    </div>
                  </div>
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
      </div>

      {/* =================================================================== */}
      {/* CLUB SHOP MODAL — UNLOCK NEW POKIE MACHINES ($0–$80k) & STADIUMS ($0–$100k) */}
      {/* =================================================================== */}
      <div
        id="clubShopModal"
        className="hidden fixed inset-0 z-50 bg-slate-950/82 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      >
        <div className="glass-modal screen-enter rounded-[28px] max-w-2xl w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-5 text-left relative my-auto border-3 border-slate-900 shadow-[0_10px_0_#0f172a]">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-slate-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex items-center justify-center shrink-0">
                <PixelGoldCoinIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-black uppercase tracking-widest text-emerald-700">
                  TIKI TAKA 0.2 CLUB SHOP • STADIUMS &amp; POKIE MACHINES
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  Unlock Stadiums &amp; Pokies
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 border-2 border-slate-900 shadow-[0_2px_0_#0f172a]">
                <PixelGoldCoinIcon className="w-4 h-4 shrink-0" />
                <span id="clubShopBalanceText" className="font-mono-num text-xs sm:text-sm font-black text-emerald-950">
                  $30
                </span>
              </div>
              <button
                id="closeShopModalBtn"
                type="button"
                aria-label="Close Club Shop"
                className="btn-clean w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-500 hover:text-white border-2 border-slate-900 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer shadow-[0_2px_0_#0f172a]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border-2 border-slate-900 mb-3">
            <button
              id="shopTabPokiesBtn"
              type="button"
              className="py-2 px-4 rounded-xl text-xs font-black bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PixelSlotMachineIcon className="w-4 h-4 shrink-0" />
              <span>Pokie Machines ($0 – $80k)</span>
            </button>
            <button
              id="shopTabStadiumsBtn"
              type="button"
              className="py-2 px-4 rounded-xl text-xs font-extrabold bg-white text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PixelSoccerBallIcon className="w-4 h-4 shrink-0" />
              <span>Unlock Stadiums ($0 – $100k)</span>
            </button>
          </div>

          <div id="clubShopFeedbackBanner" className="hidden" />

          {/* TAB 1: POKIE MACHINES ($0 Starter to $80,000 High Roller) */}
          <div id="shopPokiesSection" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHOP_POKIE_ITEMS.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-2">
                  <ShopPokiePreviewIllustration machineId={item.id} />
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-700">
                        {item.allowedBetsLabel} • Jackpot {item.baseJackpotLabel}
                      </span>
                      <span
                        id={`shopPokieStatus_${item.id}`}
                        className="px-2 py-0.5 rounded-full bg-slate-200 border border-slate-400 text-slate-700 text-[8.5px] font-black uppercase tracking-wider"
                      >
                        {item.price === 0 ? 'UNLOCKED' : `🔒 $${item.price.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-1">
                      {item.name}
                    </div>
                    <div className="text-[10.5px] font-bold text-slate-600 mt-0.5 leading-snug">
                      {item.subtitle}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="font-mono-num text-xs font-black text-slate-900">
                    {item.price === 0 ? 'STARTER MACHINE' : `$${item.price.toLocaleString()}`}
                  </div>
                  <button
                    id={`buyPokieBtn_${item.id}`}
                    type="button"
                    className="btn-clean py-2 px-3.5 rounded-xl bg-amber-300 hover:bg-amber-200 border-2 border-slate-900 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer"
                  >
                    {item.price === 0 ? 'PLAY IN POKIES →' : `BUY • $${item.price.toLocaleString()}`}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* TAB 2: STADIUMS ($0 Starter to $100,000 Cosmic Space — Select/Shuffle on Home Menu) */}
          <div id="shopStadiumsSection" className="hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHOP_STADIUM_ITEMS.map((st) => (
              <div
                key={st.id}
                className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-2">
                  <ShopStadiumPreviewIllustration stadiumId={st.id} />
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-slate-900"
                        style={{ backgroundColor: st.accentHex, color: '#0f172a' }}
                      >
                        {st.tierLabel}
                      </span>
                      <span
                        id={`shopStadiumStatus_${st.id}`}
                        className="px-2 py-0.5 rounded-full bg-slate-200 border border-slate-400 text-slate-700 text-[8px] font-black uppercase tracking-wider"
                      >
                        {st.price === 0 ? 'UNLOCKED' : `🔒 $${st.price.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-1">{st.name}</div>
                    <div className="text-[10px] font-bold text-slate-600 mt-0.5 leading-snug">
                      {st.subtitle}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="font-mono-num text-xs font-black text-slate-900">
                    {st.price === 0 ? 'STARTER ARENA' : `$${st.price.toLocaleString()}`}
                  </div>
                  <button
                    id={`buyStadiumBtn_${st.id}`}
                    type="button"
                    className="py-1.5 px-3 rounded-xl bg-emerald-200 border-2 border-slate-900 text-emerald-950 font-black text-[10.5px] uppercase tracking-wider cursor-default"
                  >
                    {st.price === 0 ? 'OWNED' : `BUY • $${st.price.toLocaleString()}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ONLINE LEADERBOARD MODAL — REAL PLAYER PROFILES (RANK OR MONEY)      */}
      {/* =================================================================== */}
      <div
        id="onlineLeaderboardModal"
        className="hidden fixed inset-0 z-50 bg-slate-950/82 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      >
        <div className="glass-modal screen-enter rounded-[28px] max-w-xl w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-5 text-left relative my-auto border-3 border-slate-900 shadow-[0_10px_0_#0f172a]">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-slate-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-400 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] flex items-center justify-center shrink-0">
                <i className="fa-solid fa-ranking-star text-white text-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-black uppercase tracking-widest text-indigo-700">
                  {FIREBASE_SERVICE_NAME} • LIVE STANDINGS
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  Tiki Taka 0.2 Club Leaderboard
                </h2>
              </div>
            </div>

            <button
              id="closeLeaderboardModalBtn"
              type="button"
              aria-label="Close Leaderboard"
              className="btn-clean w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-500 hover:text-white border-2 border-slate-900 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer shadow-[0_2px_0_#0f172a]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Cloud Profile Sync Bar */}
          <div className="p-2.5 rounded-2xl bg-slate-100 border-2 border-slate-900 flex flex-wrap items-center justify-between gap-2 mb-3">
            <span id="lbAuthStatusText" className="text-[10.5px] font-bold text-slate-700">
              Sign in with Google to publish your live profile globally
            </span>
            <button
              id="lbGoogleSignInBtn"
              type="button"
              className="btn-clean py-1.5 px-3 rounded-xl bg-sky-400 hover:bg-sky-300 border-2 border-slate-900 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-[0_2px_0_#0f172a] cursor-pointer shrink-0"
            >
              SIGN IN &amp; PUBLISH PROFILE
            </button>
          </div>

          {/* Order By: Rank vs Money */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border-2 border-slate-900 mb-3">
            <button
              id="lbSortRankBtn"
              type="button"
              className="py-2 px-4 rounded-xl text-xs font-black bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-trophy text-xs" />
              <span>Order by Rank</span>
            </button>
            <button
              id="lbSortMoneyBtn"
              type="button"
              className="py-2 px-4 rounded-xl text-xs font-extrabold bg-white text-slate-600 hover:text-slate-900 border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PixelGoldCoinIcon className="w-4 h-4 shrink-0" />
              <span>Order by Money ($)</span>
            </button>
          </div>

          {/* Player Profile Rows */}
          <div id="leaderboardRowsContainer" className="space-y-2 max-h-[52dvh] overflow-y-auto pr-0.5" />
        </div>
      </div>

      {/* Isolated 60-144Hz Game Canvas */}
      <canvas id="gameCanvas" ref={canvasRef} data-testid="game-canvas" />
    </div>
  );
}

