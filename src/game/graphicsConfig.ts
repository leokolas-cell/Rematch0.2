/**
 * Centralized 16-Bit / 32-Bit Pixel Art Graphics Configuration for REMATCH 0.2.
 *
 * Tuned for a bright, sunlit, cheerful Nintendo-pastel aesthetic with unmistakable
 * high-contrast team silhouettes (Sky-Cyan & Sunny Gold vs. Coral-Rose & Mint-Cream).
 */

export const PIXEL_DIGITS_3X5: Record<string, number[][]> = {
  '0': [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  '1': [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ],
  '2': [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
  ],
  '3': [
    [1, 1, 1],
    [0, 0, 1],
    [0, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  '4': [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
  '5': [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  '6': [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  '7': [
    [1, 1, 1],
    [0, 0, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
  '8': [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  '9': [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
};

export const GRAPHICS_CONFIG = {
  pixelPipeline: {
    pixelSize: 3,
    virtualPixelSize: 3,
    smoothing: false,
    outlineWidth: 2,
    shadowAlpha: 0.24,
    ditherDensity: 0.14,
    angleSteps: 16,
    snapEntitiesToGrid: false, // Smooth 60-144Hz sub-pixel world movement without stepping jitter
    tuftCount: 72,
    ditherStep: 6,
  },
  pitch: {
    stripeCount: 16,
    grassLight: '#88ebb0',
    grassDark: '#75e0a0',
    ditherLight: '#9bf4bf',
    ditherDark: '#65d190',
    tuftLight: '#b4f8cf',
    tuftDark: '#4ec07d',
    chalkLine: '#ffffff',
    apronColor: '#63d297',
    apronDarkBorder: '#4db880',
    wallTopColor: '#ffffff',
    wallTopSuperFlow: '#fef08a',
    wallSideColor: '#64748b',
    wallShadowColor: '#334155',
    cornerCapColor: '#38bdf8',
  },
  crowd: {
    bleacherBase: '#e2e8f0',
    bleacherStep: '#f8fafc',
    bleacherHighlight: '#ffffff',
  },
  palette: {
    outline: '#1e293b',
    apron: {
      base: '#63d297',
      dither: '#52c286',
      track: '#4db880',
      trackLine: '#a7f3d0',
      outerBorder: '#4db880',
      innerPath: '#75e0a0',
      flowerColors: ['#fef08a', '#fbcfe8', '#bae6fd', '#e9d5ff', '#fed7aa'],
      flowerCenter: '#f59e0b',
    },
    turf: {
      stripeLight: '#88ebb0',
      stripeDark: '#75e0a0',
      ditherLight: '#9bf4bf',
      ditherDark: '#65d190',
      tuftHighlight: '#b4f8cf',
      tuftShadow: '#4ec07d',
      chalkLine: '#ffffff',
      scuffMark: '#4ec07d',
      chalk: '#ffffff',
      chalkShadow: '#5bc886',
    },
    cage: {
      wallTop: '#ffffff',
      wallTopSuper: '#fef08a',
      wallSide: '#94a3b8',
      wallSide3D: '#64748b',
      wallExtrude: '#475569',
      wallDeepShadow: '#334155',
      wallOutline: '#1e293b',
      cornerCap: '#38bdf8',
      cornerCapSuper: '#facc15',
      cornerBolt: '#ffffff',
      sparkPrimary: '#38bdf8',
      sparkSecondary: '#fde047',
      netMeshHome: '#7dd3fc',
      netMeshAway: '#fda4af',
      goalPost: '#ffffff',
      goalPostShadow: '#cbd5e1',
    },
    // HOME TEAM (YOU): Electric Sky-Cyan & Sunny Lemon-Gold with Blonde/Gold Cap
    homeKit: {
      primary: '#0ea5e9',
      secondary: '#0284c7',
      shadow: '#0369a1',
      highlight: '#7dd3fc',
      stripe: '#fde047',
      collar: '#ffffff',
      shorts: '#ffffff',
      socks: '#38bdf8',
      cleats: '#0f172a',
      cleatStuds: '#ffffff',
      visor: '#fde047',
      skin: '#fde68a',
      skinShadow: '#f59e0b',
      hair: '#facc15',
      headband: '#ffffff',
      numberColor: '#ffffff',
      badgeBg: '#0369a1',
      teamRing: 'rgba(14, 165, 233, 0.42)',
    },
    // AWAY TEAM (RIVAL): Vibrant Coral-Watermelon Pink & Warm Cream with White Cap
    awayKit: {
      primary: '#fb7185',
      secondary: '#e11d48',
      shadow: '#be123c',
      highlight: '#fda4af',
      stripe: '#fff1f2',
      collar: '#fef08a',
      shorts: '#881337',
      socks: '#fecdd3',
      cleats: '#1e293b',
      cleatStuds: '#ffffff',
      visor: '#ffffff',
      skin: '#fed7aa',
      skinShadow: '#ea580c',
      hair: '#fff1f2',
      headband: '#f43f5e',
      numberColor: '#ffffff',
      badgeBg: '#9f1239',
      teamRing: 'rgba(244, 63, 94, 0.45)',
    },
    keeperHome: {
      primary: '#2dd4bf',
      secondary: '#0d9488',
      gloves: '#fde047',
    },
    keeperAway: {
      primary: '#c084fc',
      secondary: '#9333ea',
      gloves: '#fde047',
    },
    ball: {
      base: '#ffffff',
      shaded: '#e2e8f0',
      darkEdge: '#94a3b8',
      pentagon: '#1e293b',
      superBase: '#fef08a',
      superShaded: '#facc15',
      superPentagon: '#d97706',
      trailNormal: '#bae6fd',
      trailSuper: '#fde047',
      outline: '#1e293b',
    },
    ui: {
      p1Indicator: '#0ea5e9',
      p1IndicatorSuper: '#facc15',
      sweetSpotGold: '#facc15',
      trajectoryNormal: '#38bdf8',
      trajectoryCurved: '#facc15',
      runnerPath: '#06b6d4',
    },
    crowd: ['#38bdf8', '#fb7185', '#fde047', '#4ade80', '#c084fc', '#fb923c', '#ffffff'],
  },
  dimensions: {
    playerRadius: 16.5,
    keeperRadius: 13.5,
    ballRadius: 9.8,
    pixelGridUnit: 3,
    cleatLength: 9,
    cleatWidth: 6,
    shoulderWidth: 30,
    torsoDepth: 22,
    headRadius: 9,
  },
  animation: {
    strideSpeed: 0.28,
    strideAmplitude: 8.0,
    p1ArrowBobSpeed: 0.14,
    p1ArrowBobAmp: 3.0,
    beaconSpinSpeed: 0.045,
    chargeWindupPullback: 5.0,
    celebrationHopAmp: 6.5,
  },
};

export type PitchThemeId = 'CLASSIC_TURF' | 'URBAN_CONCRETE' | 'RIO_CLAY' | 'TWILIGHT_SYNTH';

export interface PitchThemeDefinition {
  id: PitchThemeId;
  name: string;
  subtitle: string;
  swatchLight: string;
  swatchDark: string;
  swatchLine: string;
  apron: {
    base: string;
    dither: string;
    track: string;
    trackLine: string;
    outerBorder: string;
    innerPath: string;
  };
  turf: {
    stripeLight: string;
    stripeDark: string;
    ditherLight: string;
    ditherDark: string;
    tuftHighlight: string;
    tuftShadow: string;
    chalkLine: string;
    scuffMark: string;
    chalk: string;
    chalkShadow: string;
  };
}

export const PITCH_THEMES: PitchThemeDefinition[] = [
  {
    id: 'CLASSIC_TURF',
    name: 'Sunlit Turf',
    subtitle: 'Emerald Grass',
    swatchLight: '#88ebb0',
    swatchDark: '#63d297',
    swatchLine: '#ffffff',
    apron: {
      base: '#63d297',
      dither: '#52c286',
      track: '#4db880',
      trackLine: '#a7f3d0',
      outerBorder: '#4db880',
      innerPath: '#75e0a0',
    },
    turf: {
      stripeLight: '#88ebb0',
      stripeDark: '#75e0a0',
      ditherLight: '#9bf4bf',
      ditherDark: '#65d190',
      tuftHighlight: '#b4f8cf',
      tuftShadow: '#4ec07d',
      chalkLine: '#ffffff',
      scuffMark: '#4ec07d',
      chalk: '#ffffff',
      chalkShadow: '#5bc886',
    },
  },
  {
    id: 'URBAN_CONCRETE',
    name: 'Rooftop Cage',
    subtitle: 'Street Slate',
    swatchLight: '#94a3b8',
    swatchDark: '#64748b',
    swatchLine: '#38bdf8',
    apron: {
      base: '#64748b',
      dither: '#475569',
      track: '#334155',
      trackLine: '#bae6fd',
      outerBorder: '#334155',
      innerPath: '#94a3b8',
    },
    turf: {
      stripeLight: '#94a3b8',
      stripeDark: '#8294ad',
      ditherLight: '#cbd5e1',
      ditherDark: '#64748b',
      tuftHighlight: '#e2e8f0',
      tuftShadow: '#475569',
      chalkLine: '#e0f2fe',
      scuffMark: '#475569',
      chalk: '#f0f9ff',
      chalkShadow: '#475569',
    },
  },
  {
    id: 'RIO_CLAY',
    name: 'Sunset Clay',
    subtitle: 'Warm Terracotta',
    swatchLight: '#f6ad7b',
    swatchDark: '#e07a47',
    swatchLine: '#fef3c7',
    apron: {
      base: '#d97742',
      dither: '#c25e2b',
      track: '#9a4419',
      trackLine: '#fde68a',
      outerBorder: '#9a4419',
      innerPath: '#ea8d5c',
    },
    turf: {
      stripeLight: '#f6ad7b',
      stripeDark: '#ec9660',
      ditherLight: '#fbc49d',
      ditherDark: '#df8149',
      tuftHighlight: '#fed7aa',
      tuftShadow: '#c25e2b',
      chalkLine: '#fffbeb',
      scuffMark: '#c25e2b',
      chalk: '#fffbeb',
      chalkShadow: '#c26533',
    },
  },
  {
    id: 'TWILIGHT_SYNTH',
    name: 'Cobalt Pulse',
    subtitle: 'Hardcourt Blue',
    swatchLight: '#7dd3fc',
    swatchDark: '#38bdf8',
    swatchLine: '#ffffff',
    apron: {
      base: '#38bdf8',
      dither: '#0284c7',
      track: '#0369a1',
      trackLine: '#e0f2fe',
      outerBorder: '#0369a1',
      innerPath: '#7dd3fc',
    },
    turf: {
      stripeLight: '#7dd3fc',
      stripeDark: '#5cc4f8',
      ditherLight: '#bae6fd',
      ditherDark: '#38bdf8',
      tuftHighlight: '#e0f2fe',
      tuftShadow: '#0284c7',
      chalkLine: '#ffffff',
      scuffMark: '#0284c7',
      chalk: '#ffffff',
      chalkShadow: '#0ea5e9',
    },
  },
];

export function applyPitchTheme(themeId: PitchThemeId): PitchThemeDefinition {
  const theme = PITCH_THEMES.find((t) => t.id === themeId) || PITCH_THEMES[0];
  Object.assign(GRAPHICS_CONFIG.palette.apron, theme.apron);
  Object.assign(GRAPHICS_CONFIG.palette.turf, theme.turf);
  GRAPHICS_CONFIG.pitch.grassLight = theme.turf.stripeLight;
  GRAPHICS_CONFIG.pitch.grassDark = theme.turf.stripeDark;
  GRAPHICS_CONFIG.pitch.ditherLight = theme.turf.ditherLight;
  GRAPHICS_CONFIG.pitch.ditherDark = theme.turf.ditherDark;
  GRAPHICS_CONFIG.pitch.tuftLight = theme.turf.tuftHighlight;
  GRAPHICS_CONFIG.pitch.tuftDark = theme.turf.tuftShadow;
  GRAPHICS_CONFIG.pitch.chalkLine = theme.turf.chalkLine;
  GRAPHICS_CONFIG.pitch.apronColor = theme.apron.base;
  GRAPHICS_CONFIG.pitch.apronDarkBorder = theme.apron.outerBorder;
  return theme;
}

