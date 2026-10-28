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
    cleatLength: 10,
    cleatWidth: 6,
    shoulderWidth: 32,
    torsoDepth: 24,
    headRadius: 10,
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

export type PitchThemeId =
  | 'CLASSIC_TURF'
  | 'TURF_AUTUMN'
  | 'TURF_SAKURA'
  | 'TURF_CHAMPIONS'
  | 'URBAN_CONCRETE'
  | 'RIO_CLAY'
  | 'TWILIGHT_SYNTH'
  | 'COSMIC_SPACE'
  | 'ARCTIC_ICE'
  | 'VOLCANO_FORGE';

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
  cage?: {
    wallTop: string;
    wallExtrude: string;
    cornerCap: string;
  };
}

export const PITCH_THEMES: PitchThemeDefinition[] = [
  {
    id: 'CLASSIC_TURF',
    name: 'Clunes',
    subtitle: 'Clunes Heritage Park',
    swatchLight: '#88ebb0',
    swatchDark: '#63d297',
    swatchLine: '#ffffff',
    apron: {
      base: '#52c488',
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
    cage: {
      wallTop: '#ffffff',
      wallExtrude: '#334155',
      cornerCap: '#facc15',
    },
  },
  {
    id: 'TURF_AUTUMN',
    name: 'Autumn Harvest Turf',
    subtitle: 'Golden Maple Park',
    swatchLight: '#a3e635',
    swatchDark: '#84cc16',
    swatchLine: '#fefce8',
    apron: {
      base: '#65a30d',
      dither: '#4d7c0f',
      track: '#b45309',
      trackLine: '#fef08a',
      outerBorder: '#78350f',
      innerPath: '#84cc16',
    },
    turf: {
      stripeLight: '#a3e635',
      stripeDark: '#8ce022',
      ditherLight: '#bef264',
      ditherDark: '#74c414',
      tuftHighlight: '#d9f99d',
      tuftShadow: '#65a30d',
      chalkLine: '#fefce8',
      scuffMark: '#65a30d',
      chalk: '#fefce8',
      chalkShadow: '#65a30d',
    },
    cage: {
      wallTop: '#fef3c7',
      wallExtrude: '#78350f',
      cornerCap: '#f97316',
    },
  },
  {
    id: 'TURF_SAKURA',
    name: 'Sakura Blossom Turf',
    subtitle: 'Kyoto Imperial Garden',
    swatchLight: '#7ce8be',
    swatchDark: '#5ad6a6',
    swatchLine: '#fff1f2',
    apron: {
      base: '#34b88a',
      dither: '#2da379',
      track: '#f472b6',
      trackLine: '#ffe4e6',
      outerBorder: '#be185d',
      innerPath: '#6ee7b7',
    },
    turf: {
      stripeLight: '#7ce8be',
      stripeDark: '#64dba8',
      ditherLight: '#a7f3d0',
      ditherDark: '#4bca94',
      tuftHighlight: '#fbcfe8',
      tuftShadow: '#34b88a',
      chalkLine: '#ffffff',
      scuffMark: '#34b88a',
      chalk: '#ffffff',
      chalkShadow: '#34b88a',
    },
    cage: {
      wallTop: '#ffe4e6',
      wallExtrude: '#831843',
      cornerCap: '#f472b6',
    },
  },
  {
    id: 'TURF_CHAMPIONS',
    name: 'Champions Cathedral',
    subtitle: 'Floodlit Trophy Turf',
    swatchLight: '#5eead4',
    swatchDark: '#34d399',
    swatchLine: '#ffffff',
    apron: {
      base: '#1e3a8a',
      dither: '#172554',
      track: '#1d4ed8',
      trackLine: '#fde047',
      outerBorder: '#0f172a',
      innerPath: '#34d399',
    },
    turf: {
      stripeLight: '#6ee7b7',
      stripeDark: '#52d6a0',
      ditherLight: '#a7f3d0',
      ditherDark: '#3bc48c',
      tuftHighlight: '#d1fae5',
      tuftShadow: '#10b981',
      chalkLine: '#ffffff',
      scuffMark: '#10b981',
      chalk: '#ffffff',
      chalkShadow: '#059669',
    },
    cage: {
      wallTop: '#fef08a',
      wallExtrude: '#1e3a8a',
      cornerCap: '#38bdf8',
    },
  },
  {
    id: 'COSMIC_SPACE',
    name: 'Cosmic Orbit',
    subtitle: 'Galactic Starfield',
    swatchLight: '#1a1635',
    swatchDark: '#120e26',
    swatchLine: '#38bdf8',
    apron: {
      base: '#060919',
      dither: '#0f1738',
      track: '#1e1b4b',
      trackLine: '#38bdf8',
      outerBorder: '#312e81',
      innerPath: '#1e293b',
    },
    turf: {
      stripeLight: '#1b1638',
      stripeDark: '#14102b',
      ditherLight: '#241e4a',
      ditherDark: '#0e0b20',
      tuftHighlight: '#312e81',
      tuftShadow: '#1e1b4b',
      chalkLine: '#bae6fd',
      scuffMark: '#312e81',
      chalk: '#e0f2fe',
      chalkShadow: '#1d4ed8',
    },
    cage: {
      wallTop: '#7dd3fc',
      wallExtrude: '#312e81',
      cornerCap: '#e879f9',
    },
  },
  {
    id: 'URBAN_CONCRETE',
    name: 'Rooftop Cage',
    subtitle: 'Street Block Party',
    swatchLight: '#94a3b8',
    swatchDark: '#64748b',
    swatchLine: '#38bdf8',
    apron: {
      base: '#1e293b',
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
      tuftHighlight: '#cbd5e1',
      tuftShadow: '#64748b',
      chalkLine: '#f8fafc',
      scuffMark: '#475569',
      chalk: '#f0f9ff',
      chalkShadow: '#475569',
    },
    cage: {
      wallTop: '#fde047',
      wallExtrude: '#1e293b',
      cornerCap: '#f97316',
    },
  },
  {
    id: 'RIO_CLAY',
    name: 'Byron Bay',
    subtitle: 'Byron Bay Coastal Court',
    swatchLight: '#ebd084',
    swatchDark: '#dec06d',
    swatchLine: '#fef3c7',
    apron: {
      base: '#0284c7',
      dither: '#c25e2b',
      track: '#9a4419',
      trackLine: '#fde68a',
      outerBorder: '#9a4419',
      innerPath: '#e0be68',
    },
    turf: {
      stripeLight: '#ebd084',
      stripeDark: '#dec06d',
      ditherLight: '#f3dd9d',
      ditherDark: '#cfb05b',
      tuftHighlight: '#f7e6b5',
      tuftShadow: '#c2a048',
      chalkLine: '#ffffff',
      scuffMark: '#b8943c',
      chalk: '#ffffff',
      chalkShadow: '#b45309',
    },
    cage: {
      wallTop: '#fef3c7',
      wallExtrude: '#7c2d12',
      cornerCap: '#2dd4bf',
    },
  },
  {
    id: 'TWILIGHT_SYNTH',
    name: 'Cobalt Pulse',
    subtitle: 'Cyber Metropolis',
    swatchLight: '#261742',
    swatchDark: '#1c1033',
    swatchLine: '#22d3ee',
    apron: {
      base: '#09051c',
      dither: '#1e1b4b',
      track: '#311042',
      trackLine: '#22d3ee',
      outerBorder: '#701a75',
      innerPath: '#261742',
    },
    turf: {
      stripeLight: '#261742',
      stripeDark: '#1d1135',
      ditherLight: '#311d54',
      ditherDark: '#150b28',
      tuftHighlight: '#3b2363',
      tuftShadow: '#2e1065',
      chalkLine: '#a5f3fc',
      scuffMark: '#4c1d95',
      chalk: '#a5f3fc',
      chalkShadow: '#a21caf',
    },
    cage: {
      wallTop: '#f472b6',
      wallExtrude: '#311042',
      cornerCap: '#22d3ee',
    },
  },
  {
    id: 'ARCTIC_ICE',
    name: 'Glacier Frost',
    subtitle: 'Aurora Alpine Fjord',
    swatchLight: '#e2e8f0',
    swatchDark: '#d1dce8',
    swatchLine: '#ffffff',
    apron: {
      base: '#0f172a',
      dither: '#1e293b',
      track: '#334155',
      trackLine: '#bae6fd',
      outerBorder: '#38bdf8',
      innerPath: '#e2e8f0',
    },
    turf: {
      stripeLight: '#e2e8f0',
      stripeDark: '#d5e0ec',
      ditherLight: '#f1f5f9',
      ditherDark: '#c5d3e3',
      tuftHighlight: '#f8fafc',
      tuftShadow: '#94a3b8',
      chalkLine: '#475569',
      scuffMark: '#94a3b8',
      chalk: '#475569',
      chalkShadow: '#334155',
    },
    cage: {
      wallTop: '#ecfeff',
      wallExtrude: '#1e3a8a',
      cornerCap: '#38bdf8',
    },
  },
  {
    id: 'VOLCANO_FORGE',
    name: 'Magma Caldera',
    subtitle: 'Obsidian Dragon Forge',
    swatchLight: '#27272a',
    swatchDark: '#18181b',
    swatchLine: '#fde047',
    apron: {
      base: '#7c2d12',
      dither: '#9a3412',
      track: '#450a0a',
      trackLine: '#facc15',
      outerBorder: '#ea580c',
      innerPath: '#27272a',
    },
    turf: {
      stripeLight: '#27272a',
      stripeDark: '#1f1f23',
      ditherLight: '#343438',
      ditherDark: '#18181b',
      tuftHighlight: '#52525b',
      tuftShadow: '#3f3f46',
      chalkLine: '#fde047',
      scuffMark: '#7c2d12',
      chalk: '#fef08a',
      chalkShadow: '#b45309',
    },
    cage: {
      wallTop: '#fdba74',
      wallExtrude: '#450a0a',
      cornerCap: '#ef4444',
    },
  },
];

export interface StadiumGoalEffectSpec {
  id: PitchThemeId;
  name: string;
  effectStyle:
    | 'BOTANICAL_FOUNTAIN'
    | 'MAPLE_SWIRL'
    | 'SAKURA_PETAL_STORM'
    | 'CHAMPIONS_PYRO'
    | 'COSMIC_SUPERNOVA'
    | 'STREET_GRAFFITI_BASS'
    | 'CARNIVAL_STREAMERS'
    | 'SYNTH_LASER_SCAN'
    | 'ARCTIC_CRYSTAL_BURST'
    | 'VOLCANO_MAGMA_PLUME';
  particleColors: string[];
  shockwaveColors: [string, string];
  flashTint: string;
}

export const STADIUM_GOAL_EFFECTS: Record<PitchThemeId, StadiumGoalEffectSpec> = {
  CLASSIC_TURF: {
    id: 'CLASSIC_TURF',
    name: 'Royal Fountain & Botanical Ribbon Burst',
    effectStyle: 'BOTANICAL_FOUNTAIN',
    particleColors: ['#34d399', '#38bdf8', '#fde047', '#a7f3d0', '#ffffff'],
    shockwaveColors: ['#34d399', '#38bdf8'],
    flashTint: 'rgba(167, 243, 208, 0.42)',
  },
  TURF_AUTUMN: {
    id: 'TURF_AUTUMN',
    name: 'Golden Maple Leaf Whirlwind',
    effectStyle: 'MAPLE_SWIRL',
    particleColors: ['#ea580c', '#f59e0b', '#dc2626', '#fde047', '#fef3c7'],
    shockwaveColors: ['#f97316', '#facc15'],
    flashTint: 'rgba(254, 215, 170, 0.44)',
  },
  TURF_SAKURA: {
    id: 'TURF_SAKURA',
    name: 'Kyoto Cherry Blossom Petal Storm',
    effectStyle: 'SAKURA_PETAL_STORM',
    particleColors: ['#f472b6', '#fbcfe8', '#ffe4e6', '#38bdf8', '#ffffff'],
    shockwaveColors: ['#f472b6', '#38bdf8'],
    flashTint: 'rgba(251, 207, 232, 0.45)',
  },
  TURF_CHAMPIONS: {
    id: 'TURF_CHAMPIONS',
    name: 'Champions Gold Pyrotechnic Salute',
    effectStyle: 'CHAMPIONS_PYRO',
    particleColors: ['#fde047', '#facc15', '#fef08a', '#60a5fa', '#ffffff'],
    shockwaveColors: ['#facc15', '#60a5fa'],
    flashTint: 'rgba(254, 240, 138, 0.46)',
  },
  COSMIC_SPACE: {
    id: 'COSMIC_SPACE',
    name: 'Zero-G Supernova Plasma Ring',
    effectStyle: 'COSMIC_SUPERNOVA',
    particleColors: ['#38bdf8', '#e879f9', '#a855f7', '#2dd4bf', '#fef08a'],
    shockwaveColors: ['#38bdf8', '#e879f9'],
    flashTint: 'rgba(56, 189, 248, 0.42)',
  },
  URBAN_CONCRETE: {
    id: 'URBAN_CONCRETE',
    name: 'Street Neon Graffiti & Boombox Bass',
    effectStyle: 'STREET_GRAFFITI_BASS',
    particleColors: ['#f97316', '#22d3ee', '#facc15', '#f43f5e', '#a855f7'],
    shockwaveColors: ['#f97316', '#22d3ee'],
    flashTint: 'rgba(253, 224, 71, 0.4)',
  },
  RIO_CLAY: {
    id: 'RIO_CLAY',
    name: 'Copacabana Carnival Samba Streamers',
    effectStyle: 'CARNIVAL_STREAMERS',
    particleColors: ['#facc15', '#10b981', '#0ea5e9', '#f43f5e', '#fef08a'],
    shockwaveColors: ['#facc15', '#0ea5e9'],
    flashTint: 'rgba(253, 230, 138, 0.44)',
  },
  TWILIGHT_SYNTH: {
    id: 'TWILIGHT_SYNTH',
    name: 'Cyber-Grid Outrun Laser Pulse',
    effectStyle: 'SYNTH_LASER_SCAN',
    particleColors: ['#f472b6', '#22d3ee', '#e879f9', '#67e8f9', '#fde047'],
    shockwaveColors: ['#f472b6', '#22d3ee'],
    flashTint: 'rgba(244, 114, 182, 0.42)',
  },
  ARCTIC_ICE: {
    id: 'ARCTIC_ICE',
    name: 'Glacial Diamond-Frost Shatter',
    effectStyle: 'ARCTIC_CRYSTAL_BURST',
    particleColors: ['#ecfeff', '#7dd3fc', '#38bdf8', '#c4b5fd', '#ffffff'],
    shockwaveColors: ['#7dd3fc', '#c4b5fd'],
    flashTint: 'rgba(186, 230, 253, 0.46)',
  },
  VOLCANO_FORGE: {
    id: 'VOLCANO_FORGE',
    name: 'Caldera Magma Geyser Eruption',
    effectStyle: 'VOLCANO_MAGMA_PLUME',
    particleColors: ['#ef4444', '#f97316', '#facc15', '#fde047', '#fca5a5'],
    shockwaveColors: ['#ef4444', '#fde047'],
    flashTint: 'rgba(251, 146, 60, 0.45)',
  },
};

export function getStadiumGoalEffect(themeId: PitchThemeId): StadiumGoalEffectSpec {
  return STADIUM_GOAL_EFFECTS[themeId] || STADIUM_GOAL_EFFECTS.CLASSIC_TURF;
}

export function applyPitchTheme(themeId: PitchThemeId): PitchThemeDefinition {
  const theme = PITCH_THEMES.find((t) => t.id === themeId) || PITCH_THEMES[0];
  Object.assign(GRAPHICS_CONFIG.palette.apron, theme.apron);
  Object.assign(GRAPHICS_CONFIG.palette.turf, theme.turf);
  if (theme.cage) {
    GRAPHICS_CONFIG.palette.cage.wallTop = theme.cage.wallTop;
    GRAPHICS_CONFIG.palette.cage.wallExtrude = theme.cage.wallExtrude;
    GRAPHICS_CONFIG.palette.cage.cornerCap = theme.cage.cornerCap;
  }
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



