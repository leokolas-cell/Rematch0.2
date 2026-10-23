import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PITCH,
  PASSES_FOR_FLOW_BOOST,
  TOURNAMENT_ROUNDS,
  TOTAL_TOURNAMENT_GAMES,
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
  quantizeAngle,
  simulateCurvedPreviewArc,
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
  COUPON_HACK_REWARD,
  BASE_JACKPOT_POOL,
  POKIE_MACHINES,
  POKIE_MACHINE_LIST,
  getMachineEffectiveJackpot,
  calculateMatchMoneyReward,
  redeemCouponCode,
  evaluatePokieGrid,
  spinPokieReels,
  createHoldAndSpinSession,
  stepHoldAndSpinSession,
  type PlayerStateSnapshot,
  type KeeperStateSnapshot,
} from './rules.ts';
import {
  GRAPHICS_CONFIG,
  PIXEL_DIGITS_3X5,
  PITCH_THEMES,
  applyPitchTheme,
  STADIUM_GOAL_EFFECTS,
  getStadiumGoalEffect,
} from './graphicsConfig.ts';
import { STADIUM_MUSIC_PROFILES, getStadiumMusicProfile } from './soundEngine.ts';

test('Expanded PITCH specification provides spread-out tiki-taka passing room and 3-game Tournament config', () => {
  assert.equal(PITCH.width, 2720);
  assert.equal(PITCH.height, 1580);
  assert.equal(PITCH.goalWidth, 380);
  assert.equal(PITCH.wallRestitution, 0.96);
  assert.equal(PITCH.antiCrowdingRadius, 390);
  assert.equal(PASSES_FOR_FLOW_BOOST, 3);
  assert.equal(TOTAL_TOURNAMENT_GAMES, 3);
  assert.deepEqual(TOURNAMENT_ROUNDS, ['Quarter-Final', 'Semi-Final', 'Grand Final']);
});

test('getContrastingKit ensures CPU kit always contrasts user Home/Away kit selection', () => {
  assert.equal(getContrastingKit('HOME'), 'AWAY');
  assert.equal(getContrastingKit('AWAY'), 'HOME');
});

test('getFlowPassBoost scales pass speed, teammate catch radius, and shrinks AI/keeper interception as Flow builds', () => {
  const zeroFlow = getFlowPassBoost(0);
  const superFlow = getFlowPassBoost(4);

  assert.equal(zeroFlow.passSpeedBonus, 0);
  assert.equal(zeroFlow.aiInterceptRadiusScale, 1.0);
  assert.equal(zeroFlow.keeperReachScale, 1.0);

  assert.ok(superFlow.passSpeedBonus > 2.5);
  assert.ok(superFlow.teammateCatchBonus >= 6);
  assert.ok(superFlow.aiInterceptRadiusScale < 0.55);
  assert.ok(superFlow.keeperReachScale < 0.78);
});

test('computeTackleReach and computePassCatchRadius make tackling and pass reception forgiving for the player', () => {
  assert.ok(computeTackleReach(true, false) >= 85);
  assert.ok(computeTackleReach(true, true) >= 105);
  assert.ok(computeTackleReach(true, false) > computeTackleReach(false, false));

  const userTargetCatch = computePassCatchRadius(16.5, 10.5, true, true, true, 2);
  const aiInterceptCatch = computePassCatchRadius(16.5, 10.5, false, false, false, 2, 0.85);
  assert.ok(userTargetCatch > 48, `Expected generous user pass catch radius, got ${userTargetCatch}`);
  assert.ok(userTargetCatch > aiInterceptCatch * 2);
});

test('GRAPHICS_CONFIG defines bright pastel stadium palette, distinct Home vs Away kits, and 3x5 digit matrices', () => {
  assert.equal(GRAPHICS_CONFIG.pixelPipeline.smoothing, false);
  assert.equal(GRAPHICS_CONFIG.pixelPipeline.angleSteps, 16);
  assert.ok(GRAPHICS_CONFIG.palette.homeKit.primary.startsWith('#'));
  assert.ok(GRAPHICS_CONFIG.palette.awayKit.primary.startsWith('#'));
  assert.notEqual(GRAPHICS_CONFIG.palette.homeKit.primary, GRAPHICS_CONFIG.palette.awayKit.primary);
  assert.notEqual(GRAPHICS_CONFIG.palette.homeKit.shorts, GRAPHICS_CONFIG.palette.awayKit.shorts);
  assert.notEqual(GRAPHICS_CONFIG.palette.homeKit.visor, GRAPHICS_CONFIG.palette.awayKit.visor);
  assert.equal(GRAPHICS_CONFIG.palette.turf.stripeLight, '#88ebb0');
  assert.equal(PIXEL_DIGITS_3X5['7'].length, 5);
  assert.equal(PIXEL_DIGITS_3X5['7'][0].length, 3);
});

test('quantizeAngle snaps angles cleanly to 16 discrete 16-bit sprite orientations', () => {
  const step = (Math.PI * 2) / 16;
  assert.equal(quantizeAngle(0.02, 16), 0);
  assert.ok(Math.abs(quantizeAngle(step * 3.1, 16) - step * 3) < 1e-6);
});

test('computeLaunchVelocityForCurve and simulateCurvedPreviewArc match actual ball physics 1:1 (no inverse curve)', () => {
  const startX = 1200;
  const startY = 790;
  const targetX = 2720;
  const targetY = 660;
  const { shotSpeed, appliedSpin } = computeShotSpinAndSpeed(-0.014, 0.8, true, true, false, true);

  const previewArc = simulateCurvedPreviewArc(startX, startY, targetX, targetY, appliedSpin, 22, shotSpeed);
  const launch = computeLaunchVelocityForCurve(startX, startY, targetX, targetY, shotSpeed, appliedSpin);

  // Simulate actual ball physics using updateBall's exact equations
  let bx = startX;
  let by = startY;
  let vx = launch.vx;
  let vy = launch.vy;
  let s = appliedSpin;

  const midFrame = Math.floor(launch.frames * 0.5);
  let midBallY = by;
  for (let f = 0; f < launch.frames; f++) {
    if (f === midFrame) midBallY = by;
    const perpX = -vy;
    const perpY = vx;
    vx += perpX * s;
    vy += perpY * s;
    s *= 0.988;
    bx += vx;
    by += vy;
    vx *= 0.986;
    vy *= 0.986;
  }

  const straightMidY = (startY + targetY) * 0.5;
  const previewMidY = previewArc[Math.floor(previewArc.length * 0.5)].y;

  assert.equal(Math.sign(previewMidY - straightMidY), Math.sign(midBallY - straightMidY));
  assert.ok(
    Math.abs(previewMidY - midBallY) < 15,
    `Preview mid Y (${previewMidY}) and actual ball mid Y (${midBallY}) must match closely`
  );
  assert.ok(
    Math.hypot(bx - targetX, by - targetY) < 35,
    `Ball landed at (${bx}, ${by}), expected near (${targetX}, ${targetY})`
  );
});

test('findBestReceiverForLooseBall seamlessly selects the teammate running onto a through-ball without oscillating between 2 players', () => {
  const passer: PlayerStateSnapshot = {
    team: 'YOU',
    index: 0,
    x: 900,
    y: 800,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const topRunner: PlayerStateSnapshot = {
    team: 'YOU',
    index: 1,
    x: 1350,
    y: 340,
    vx: 4.2,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const botWing: PlayerStateSnapshot = {
    team: 'YOU',
    index: 2,
    x: 1250,
    y: 1300,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };

  // Frame 1: Through-ball angled into open space ahead of topRunner
  const chosenFrame1 = findBestReceiverForLooseBall(
    { x: 950, y: 740, vx: 16, vy: -9.5, lastTouchTeam: 'YOU', isShot: false },
    [passer, topRunner, botWing],
    passer,
    null
  );
  assert.equal(chosenFrame1, topRunner);

  // Frame 2: Passing chosenFrame1 as currentTarget keeps topRunner locked (never excluding topRunner or oscillating to botWing)
  const chosenFrame2 = findBestReceiverForLooseBall(
    { x: 966, y: 730.5, vx: 15.8, vy: -9.4, lastTouchTeam: 'YOU', isShot: false },
    [passer, topRunner, botWing],
    passer,
    chosenFrame1
  );
  assert.equal(chosenFrame2, topRunner);
});

test('evaluateKickDecisionPure uses subtle auto-lock so tight angles, through-balls, and wall rebounds are not hijacked', () => {
  const carrier: PlayerStateSnapshot = {
    team: 'YOU',
    index: 0,
    x: 900,
    y: 350,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const topWing: PlayerStateSnapshot = {
    team: 'YOU',
    index: 1,
    x: 1450,
    y: 230,
    vx: 3.5,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const keepers: KeeperStateSnapshot[] = [
    { team: 'YOU', x: 42, y: PITCH.height / 2, radius: 13 },
    { team: 'AI', x: PITCH.width - 42, y: PITCH.height / 2, radius: 13 },
  ];

  // Aiming toward the top wall at (1180, 0) for a tactical wall-rebound bank pass around a defender:
  // Relaxed auto-aim should NOT pull the pass directly into topWing's body, and should target the wall bounce point!
  const wallAimX = 1180 - carrier.x;
  const wallAimY = 10.5 - carrier.y;
  const wallLen = Math.hypot(wallAimX, wallAimY);
  const reboundDecision = evaluateKickDecisionPure(
    carrier,
    wallAimX / wallLen,
    wallAimY / wallLen,
    [carrier, topWing],
    keepers,
    { active: false, x: 0, y: 0 }
  );
  assert.equal(reboundDecision.type, 'PASS');
  assert.ok(reboundDecision.wallBouncePoint !== null, 'Expected wallBouncePoint to be populated for wall rebound pass');
  assert.ok(
    reboundDecision.passTargetY! <= 15,
    `Expected wall rebound passTargetY (${reboundDecision.passTargetY}) to target the top wall directly instead of being clamped away`
  );
});

test('clampDeltaTime clamps large frame spikes to <= 50ms (0.05s)', () => {
  const spike = clampDeltaTime(250);
  assert.equal(spike.clampedSec, 0.05);
  assert.ok(spike.rawDt <= 3.01);

  const normal60 = clampDeltaTime(16.6667);
  assert.ok(Math.abs(normal60.rawDt - 1.0) < 0.01);

  const high144 = clampDeltaTime(6.94);
  assert.ok(high144.rawDt > 0.4 && high144.rawDt < 0.45);
});

test('isSweetSpotCharge detects the 62%-92% Finesse Charge window', () => {
  assert.equal(isSweetSpotCharge(0.35), false);
  assert.equal(isSweetSpotCharge(0.61), false);
  assert.equal(isSweetSpotCharge(0.62), true);
  assert.equal(isSweetSpotCharge(0.78), true);
  assert.equal(isSweetSpotCharge(0.92), true);
  assert.equal(isSweetSpotCharge(0.95), false);
});

test('calculateFlowGain awards +1 base, +2 bank pass, and +1 extra for 1-2 Give & Go', () => {
  assert.equal(calculateFlowGain(false, false), 1);
  assert.equal(calculateFlowGain(true, false), 2);
  assert.equal(calculateFlowGain(false, true), 2);
  assert.equal(calculateFlowGain(true, true), 3);
});

test('applyRadialDeadzone filters stick drift and normalizes active input', () => {
  const drift = applyRadialDeadzone(0.08, -0.09, 0.16);
  assert.equal(drift.active, false);
  assert.equal(drift.x, 0);
  assert.equal(drift.y, 0);

  const fullRight = applyRadialDeadzone(1.0, 0.0, 0.16);
  assert.equal(fullRight.active, true);
  assert.ok(Math.abs(fullRight.x - 1.0) < 1e-6);
  assert.equal(fullRight.y, 0);
});

test('pointToSegmentDistance calculates accurate passing lane clearance', () => {
  const distMid = pointToSegmentDistance(100, 30, 0, 0, 200, 0);
  assert.equal(distMid, 30);

  const distEnd = pointToSegmentDistance(250, 0, 0, 0, 200, 0);
  assert.equal(distEnd, 50);
});

test('formatMatchTimer and checkMatchEndCondition handle 3-Goal Lead, 2-Minute Timer, and Golden Goal', () => {
  assert.equal(formatMatchTimer(120), '02:00');
  assert.equal(formatMatchTimer(65), '01:05');
  assert.equal(formatMatchTimer(0), '00:00');

  const twoGoalLead = checkMatchEndCondition(3, 1, 95, false);
  assert.equal(twoGoalLead.ended, false);

  const threeGoalLead = checkMatchEndCondition(4, 1, 95, false);
  assert.equal(threeGoalLead.ended, true);
  assert.match(threeGoalLead.reason, /3-Goal Lead/);

  const timeUpWinner = checkMatchEndCondition(2, 1, 0, false);
  assert.equal(timeUpWinner.ended, true);
  assert.match(timeUpWinner.reason, /Full Time/);

  const drawAtZero = checkMatchEndCondition(2, 2, 0, false);
  assert.equal(drawAtZero.ended, false);
  assert.equal(drawAtZero.enterGoldenGoal, true);

  const goldenWinner = checkMatchEndCondition(3, 2, 0, true);
  assert.equal(goldenWinner.ended, true);
  assert.match(goldenWinner.reason, /Golden Goal/);
});

test('evaluateKickDecisionPure prioritizes clear goal shots over nearby teammates', () => {
  const striker: PlayerStateSnapshot = {
    team: 'YOU',
    index: 2,
    x: 2150,
    y: PITCH.height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const wingMate: PlayerStateSnapshot = {
    team: 'YOU',
    index: 1,
    x: 2350,
    y: PITCH.height / 2 - 40,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const keepers: KeeperStateSnapshot[] = [
    { team: 'YOU', x: 42, y: PITCH.height / 2, radius: 13 },
    { team: 'AI', x: PITCH.width - 42, y: PITCH.height / 2, radius: 13 },
  ];

  // Aiming straight at opponent goal mouth (cursor near goal line, not on teammate)
  const decision = evaluateKickDecisionPure(
    striker,
    1,
    0,
    [striker, wingMate],
    keepers,
    { active: true, x: PITCH.width, y: PITCH.height / 2 }
  );
  assert.equal(decision.type, 'SHOOT');
  assert.equal(decision.shotTargetX, PITCH.width);

  // Aiming directly back at own goalkeeper triggers KEEPER_PASS
  const backCarrier: PlayerStateSnapshot = {
    team: 'YOU',
    index: 0,
    x: 420,
    y: PITCH.height / 2,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    radius: 16.5,
  };
  const keeperPass = evaluateKickDecisionPure(
    backCarrier,
    -1,
    0,
    [backCarrier, striker],
    keepers,
    { active: true, x: 42, y: PITCH.height / 2 }
  );
  assert.equal(keeperPass.type, 'KEEPER_PASS');
});

test('computeKeeperTargetPosition shifts keeper reactively toward ball side so cross-pitch passes open the far post', () => {
  const homeX = PITCH.width - 42;
  const centerY = PITCH.height / 2;

  // Ball carried on top wing in attacking third
  const topWingState = computeKeeperTargetPosition(
    'AI',
    homeX,
    PITCH.width - 420,
    centerY - 380,
    0,
    0,
    false,
    'YOU',
    0
  );

  // Keeper shifts strongly toward top post and steps slightly off line
  assert.ok(topWingState.targetY < centerY - 120, `Expected keeper to shift toward top post, got ${topWingState.targetY}`);
  assert.ok(topWingState.targetX < homeX - 18, `Expected keeper to step out off goal line, got ${topWingState.targetX}`);

  // When ball is passed laterally across goal mouth to bottom wing, far post distance is wide open (>250px away)
  const farPostY = centerY + 145;
  assert.ok(farPostY - topWingState.targetY > 260);
});

test('shouldKeeperSweepLooseBallInBox and clampKeeperToBox allow keeper to collect uncontested ball in box without ever leaving box', () => {
  const farFieldPlayers = [
    { x: 1100, y: 500 },
    { x: 1350, y: 900 },
  ];
  const closeFieldPlayers = [
    { x: 310, y: 780 },
    { x: 1350, y: 900 },
  ];

  // Loose ball inside YOU penalty box (x=280, y=790) with no field players nearby -> keeper sweeps!
  assert.equal(
    shouldKeeperSweepLooseBallInBox(
      'YOU',
      { x: 280, y: 790, vx: 1.5, vy: 0.5, owner: null, isShot: false },
      farFieldPlayers
    ),
    true
  );

  // If a field player is nearby (x=310, y=780), keeper stays on patrol line
  assert.equal(
    shouldKeeperSweepLooseBallInBox(
      'YOU',
      { x: 280, y: 790, vx: 1.5, vy: 0.5, owner: null, isShot: false },
      closeFieldPlayers
    ),
    false
  );

  // Keeper can NEVER leave their penalty box
  const clampedYou = clampKeeperToBox('YOU', 750, 150, 13.5);
  assert.ok(clampedYou.x <= PITCH.boxWidth - 13.5 - 8);
  assert.ok(clampedYou.y >= (PITCH.height - PITCH.boxHeight) / 2 + 13.5 + 6);

  const clampedAi = clampKeeperToBox('AI', 1800, 1450, 13.5);
  assert.ok(clampedAi.x >= PITCH.width - PITCH.boxWidth + 13.5 + 8);
  assert.ok(clampedAi.y <= (PITCH.height + PITCH.boxHeight) / 2 - 13.5 - 6);
});

test('isLongRangeGoal detects goals scored from far outside the penalty box for RONALDO GOAL celebration', () => {
  // Shot by YOU from x=1500 (well outside the x=2180 penalty box edge) -> true
  assert.equal(isLongRangeGoal('YOU', 1500, 790), true);
  // Shot by YOU from inside the penalty box (x=2350) -> false
  assert.equal(isLongRangeGoal('YOU', 2350, 790), false);
  // Shot by YOU from just outside the box line (x=2120) -> false (not far outside)
  assert.equal(isLongRangeGoal('YOU', 2120, 790), false);
});

test('getUserRankInfo starts player at Bronze I (0 wins) and ranks up as wins increase with matching rank border colors', () => {
  const startRank = getUserRankInfo(0);
  assert.equal(startRank.name, 'Bronze I');
  assert.equal(startRank.tierGroup, 'BRONZE');
  assert.equal(startRank.borderHex, '#cd7f32');

  const nextAfterZero = getNextRankInfo(0);
  assert.equal(nextAfterZero?.name, 'Bronze II');

  const silverRank = getUserRankInfo(2);
  assert.equal(silverRank.name, 'Silver I');
  assert.equal(silverRank.borderHex, '#94a3b8');

  const goldRank = getUserRankInfo(3);
  assert.equal(goldRank.name, 'Gold II');
  assert.equal(goldRank.borderHex, '#eab308');

  const starRank = getUserRankInfo(8);
  assert.equal(starRank.name, 'Star League');
  assert.equal(getNextRankInfo(8), null);
  assert.ok(RANK_TIERS.length >= 7);

  const summaryAfterFirstWin = computeRankProgressSummary(1, 0);
  assert.equal(summaryAfterFirstWin.rankedUp, true);
  assert.equal(summaryAfterFirstWin.prevRank.name, 'Bronze I');
  assert.equal(summaryAfterFirstWin.currentRank.name, 'Bronze II');
  assert.equal(summaryAfterFirstWin.nextRank?.name, 'Silver I');
  assert.ok(summaryAfterFirstWin.progressPct > summaryAfterFirstWin.prevProgressPct);
  assert.ok(summaryAfterFirstWin.statusHeadline.includes('RANK UP!'));
});

test('buildGoalCelebrationMessage generates dynamic headlines & callouts for goal types and match score states, and PITCH_THEMES includes COSMIC_SPACE', () => {
  const spaceTheme = PITCH_THEMES.find((t) => t.id === 'COSMIC_SPACE');
  assert.ok(spaceTheme, 'COSMIC_SPACE theme exists in PITCH_THEMES');
  assert.equal(spaceTheme?.name, 'Cosmic Orbit');

  const arcticTheme = PITCH_THEMES.find((t) => t.id === 'ARCTIC_ICE');
  assert.ok(arcticTheme, 'ARCTIC_ICE theme exists in PITCH_THEMES');
  assert.equal(arcticTheme?.name, 'Glacier Frost');

  const volcanoTheme = PITCH_THEMES.find((t) => t.id === 'VOLCANO_FORGE');
  assert.ok(volcanoTheme, 'VOLCANO_FORGE theme exists in PITCH_THEMES');
  assert.equal(volcanoTheme?.name, 'Magma Caldera');

  const autumnTurf = PITCH_THEMES.find((t) => t.id === 'TURF_AUTUMN');
  assert.ok(autumnTurf, 'TURF_AUTUMN theme exists in PITCH_THEMES');
  assert.equal(autumnTurf?.name, 'Autumn Harvest Turf');

  const sakuraTurf = PITCH_THEMES.find((t) => t.id === 'TURF_SAKURA');
  assert.ok(sakuraTurf, 'TURF_SAKURA theme exists in PITCH_THEMES');
  assert.equal(sakuraTurf?.name, 'Sakura Blossom Turf');

  const championsTurf = PITCH_THEMES.find((t) => t.id === 'TURF_CHAMPIONS');
  assert.ok(championsTurf, 'TURF_CHAMPIONS theme exists in PITCH_THEMES');
  assert.equal(championsTurf?.name, 'Champions Cathedral');

  assert.equal(PITCH_THEMES.length, 10);

  // Verify every stadium has its own distinct musical profile
  const titles = new Set<string>();
  const melodies = new Set<string>();
  for (const theme of PITCH_THEMES) {
    const applied = applyPitchTheme(theme.id);
    assert.equal(applied.id, theme.id);
    const music = getStadiumMusicProfile(theme.id);
    assert.equal(music.id, theme.id);
    assert.equal(music.melodySectionA.length, 32);
    assert.equal(music.bassNotesA.length, 32);
    assert.equal(music.chordVoicings.length, 4);
    assert.ok(music.bpm >= 110 && music.bpm <= 145, `Expected valid BPM for ${theme.id}`);
    assert.equal(music.goalChimeNotes.length, 6, `Expected 6 goal chime notes for ${theme.id}`);
    titles.add(music.title);
    melodies.add(music.melodySectionA.join(','));

    const goalFx = getStadiumGoalEffect(theme.id);
    assert.equal(goalFx.id, theme.id);
    assert.ok(goalFx.particleColors.length >= 4);
    assert.ok(goalFx.shockwaveColors[0].startsWith('#'));
    assert.ok(goalFx.shockwaveColors[1].startsWith('#'));
  }
  assert.equal(titles.size, 10, 'All 10 stadiums have unique soundtrack titles');
  assert.equal(melodies.size, 10, 'All 10 stadiums have unique lead melodies');
  assert.equal(Object.keys(STADIUM_MUSIC_PROFILES).length, 10);
  assert.equal(Object.keys(STADIUM_GOAL_EFFECTS).length, 10);
  const effectStyles = new Set(Object.values(STADIUM_GOAL_EFFECTS).map((fx) => fx.effectStyle));
  assert.equal(effectStyles.size, 10, 'All 10 stadiums have unique subtle goal effect styles');

  // 1. Long-Range Ronaldo Goal
  const ronaldoGoal = buildGoalCelebrationMessage({
    scoringTeam: 'YOU',
    scoreYou: 1,
    scoreAi: 0,
    prevScoreYou: 0,
    prevScoreAi: 0,
    isLongRange: true,
    isPerfectStrike: false,
    isOneTouch: false,
    wasWallBounce: false,
    spinMagnitude: 0,
    flowCombo: 1,
    isGoldenGoal: false,
    matchTimeRemaining: 95,
    opponentTag: 'Zico_99',
  });
  assert.equal(ronaldoGoal.headline, 'RONALDO GOAL!');
  assert.match(ronaldoGoal.subheadline, /LONG-RANGE SCREAMER/);

  // 2. Equalizer Goal (2-2)
  const equalizerGoal = buildGoalCelebrationMessage({
    scoringTeam: 'YOU',
    scoreYou: 2,
    scoreAi: 2,
    prevScoreYou: 1,
    prevScoreAi: 2,
    isLongRange: false,
    isPerfectStrike: false,
    isOneTouch: false,
    wasWallBounce: false,
    spinMagnitude: 0,
    flowCombo: 1,
    isGoldenGoal: false,
    matchTimeRemaining: 50,
    opponentTag: 'Zico_99',
  });
  assert.equal(equalizerGoal.headline, 'ICE IN THE VEINS!');
  assert.match(equalizerGoal.subheadline, /EQUALIZER/);

  // 3. Wall Bank Shot Goal
  const bankGoal = buildGoalCelebrationMessage({
    scoringTeam: 'YOU',
    scoreYou: 2,
    scoreAi: 1,
    prevScoreYou: 1,
    prevScoreAi: 1,
    isLongRange: false,
    isPerfectStrike: false,
    isOneTouch: false,
    wasWallBounce: true,
    spinMagnitude: 0,
    flowCombo: 2,
    isGoldenGoal: false,
    matchTimeRemaining: 60,
    opponentTag: 'Zico_99',
  });
  assert.equal(bankGoal.headline, 'PINBALL WIZARD!');
  assert.match(bankGoal.subheadline, /CAGE BANK SHOT/);

  // 4. Mercy Rule KO (3-0)
  const mercyGoal = buildGoalCelebrationMessage({
    scoringTeam: 'YOU',
    scoreYou: 3,
    scoreAi: 0,
    prevScoreYou: 2,
    prevScoreAi: 0,
    isLongRange: false,
    isPerfectStrike: true,
    isOneTouch: false,
    wasWallBounce: false,
    spinMagnitude: 0,
    flowCombo: 3,
    isGoldenGoal: false,
    matchTimeRemaining: 40,
    opponentTag: 'Zico_99',
  });
  assert.equal(mercyGoal.headline, 'MERCY RULE KO!');
  assert.match(mercyGoal.subheadline, /MERCY RULE KNOCKOUT/);

  // 5. Stadium-Specific Goal Slogans & Varied Celebration Color Palettes
  const spaceGoal = buildGoalCelebrationMessage({
    scoringTeam: 'YOU',
    scoreYou: 2,
    scoreAi: 1,
    prevScoreYou: 1,
    prevScoreAi: 1,
    isLongRange: false,
    isPerfectStrike: false,
    isOneTouch: false,
    wasWallBounce: false,
    spinMagnitude: 0,
    flowCombo: 1,
    isGoldenGoal: false,
    matchTimeRemaining: 75,
    opponentTag: 'Zico_99',
    pitchTheme: 'COSMIC_SPACE',
    variationIndex: 1,
  });
  assert.match(spaceGoal.headline, /GALACTIC SCREAMER|ORBITAL LASER STRIKE|SUPERNOVA FINISH|ZERO-G BANGER/);
  assert.equal(spaceGoal.primaryColor, '#38bdf8');
  assert.equal(spaceGoal.secondaryColor, '#e879f9');

  // 6. Player Profile Name Slogan Insertion
  const profileGoal = buildGoalCelebrationMessage({
    scoringTeam: 'YOU',
    scoreYou: 2,
    scoreAi: 1,
    prevScoreYou: 1,
    prevScoreAi: 1,
    isLongRange: false,
    isPerfectStrike: false,
    isOneTouch: false,
    wasWallBounce: false,
    spinMagnitude: 0,
    flowCombo: 1,
    isGoldenGoal: false,
    matchTimeRemaining: 70,
    opponentTag: 'Zico_99',
    playerName: 'Leo',
    pitchTheme: 'RIO_CLAY',
    variationIndex: 2,
  });
  assert.match(profileGoal.headline, /LEO/);
  assert.match(profileGoal.subheadline, /LEO LEADS/);
  assert.ok(profileGoal.pitchCallouts.some((c) => c.text.includes('LEO')));
});

test('calculateMatchMoneyReward scales payouts by game mode, win/loss, goals scored, and Mercy Rule KO', () => {
  const casualLoss = calculateMatchMoneyReward({
    gameMode: 'CASUAL',
    didWin: false,
    goalsFor: 1,
    goalsAgainst: 3,
  });
  assert.ok(casualLoss.totalReward >= 9);

  const casualWin = calculateMatchMoneyReward({
    gameMode: 'CASUAL',
    didWin: true,
    goalsFor: 3,
    goalsAgainst: 1,
  });
  assert.ok(casualWin.totalReward > casualLoss.totalReward);

  const rankedMercyWin = calculateMatchMoneyReward({
    gameMode: 'RANKED',
    didWin: true,
    goalsFor: 3,
    goalsAgainst: 0,
    isMercyRule: true,
  });
  assert.ok(rankedMercyWin.totalReward > casualWin.totalReward);
  assert.equal(rankedMercyWin.specialBonus, 13); // +8 Mercy Rule +5 Clean Sheet

  const tournamentFinalWin = calculateMatchMoneyReward({
    gameMode: 'TOURNAMENT',
    didWin: true,
    goalsFor: 4,
    goalsAgainst: 1,
    tournamentRound: 2,
  });
  assert.ok(tournamentFinalWin.totalReward >= 70);
});

test('redeemCouponCode grants 10 spins ($100) for HACK code and rejects invalid codes', () => {
  const resHack = redeemCouponCode('  hack ', 25);
  assert.equal(resHack.valid, true);
  assert.equal(resHack.normalizedCode, 'HACK');
  assert.equal(resHack.rewardAmount, COUPON_HACK_REWARD);
  assert.equal(resHack.spinsGranted, 10);
  assert.equal(resHack.rewardAmount, SLOT_SPIN_COST * 10);
  assert.equal(resHack.newBalance, 25 + COUPON_HACK_REWARD);

  const resInvalid = redeemCouponCode('WRONG', 25);
  assert.equal(resInvalid.valid, false);
  assert.equal(resInvalid.rewardAmount, 0);
  assert.equal(resInvalid.newBalance, 25);
});

test('evaluatePokieGrid and spinPokieReels implement authentic 5-payline, 2x Wild Star, Scatter, and Grand Jackpot pokie math', () => {
  // 1. Center line 3x MEGA_TROPHY hits the Progressive Grand Jackpot and resets pool
  const jackpotEval = evaluatePokieGrid(
    [
      ['CHERRY_CARD', 'MEGA_TROPHY', 'WHISTLE'],
      ['WHISTLE', 'MEGA_TROPHY', 'CHERRY_CARD'],
      ['FIRE_FLAME', 'MEGA_TROPHY', 'WHISTLE'],
    ],
    SLOT_SPIN_COST,
    1250
  );
  assert.equal(jackpotEval.isJackpot, true);
  assert.equal(jackpotEval.winTier, 'JACKPOT');
  assert.ok(jackpotEval.totalPayout >= 1252);
  assert.equal(jackpotEval.updatedJackpotPool, BASE_JACKPOT_POOL);

  // 2. Wild Star (⭐) substitutes and doubles (2x) payline win for DIAMOND_BALL on Top Line
  const wildSubEval = evaluatePokieGrid(
    [
      ['DIAMOND_BALL', 'WHISTLE', 'FIRE_FLAME'],
      ['WILD_STAR', 'CHERRY_CARD', 'WHISTLE'],
      ['DIAMOND_BALL', 'FIRE_FLAME', 'GOLD_BOOT'],
    ],
    SLOT_SPIN_COST,
    1000
  );
  assert.equal(wildSubEval.isJackpot, false);
  const topLineWin = wildSubEval.winningLines.find((w) => w.lineId === 2);
  assert.ok(topLineWin, 'Expected Top Line win with Wild Star substitution');
  assert.equal(topLineWin?.hasWildMultiplier, true);
  assert.equal(topLineWin?.payout, SLOT_SPIN_COST * 20 * 2); // 20x base * 2x Wild = 40x ($400)

  // 3. 3x SCATTER_CROWN anywhere on the 3x3 window pays 15x total bet AND triggers Hold & Spin
  const scatterEval = evaluatePokieGrid(
    [
      ['SCATTER_CROWN', 'WHISTLE', 'FIRE_FLAME'],
      ['GOLD_BOOT', 'SCATTER_CROWN', 'WHISTLE'],
      ['WHISTLE', 'FIRE_FLAME', 'SCATTER_CROWN'],
    ],
    SLOT_SPIN_COST,
    1000
  );
  assert.equal(scatterEval.scatterCount, 3);
  assert.equal(scatterEval.scatterPayout, SLOT_SPIN_COST * 15);
  assert.equal(scatterEval.triggersHoldAndSpin, true);
  assert.equal(scatterEval.isTeaserTwoReels, true);

  // 4. Deterministic forced stops on spinPokieReels (stop 18 on all 3 reels = MEGA_TROPHY on middle row!)
  const forcedJackpot = spinPokieReels(SLOT_SPIN_COST, 1100, Math.random, [18, 17, 18]);
  assert.equal(forcedJackpot.isJackpot, true);
  assert.equal(forcedJackpot.grid[0][1], 'MEGA_TROPHY');
  assert.equal(forcedJackpot.grid[1][1], 'MEGA_TROPHY');
  assert.equal(forcedJackpot.grid[2][1], 'MEGA_TROPHY');
});

test('POKIE_MACHINES, $10/$100 bet scaling, and Hold & Spin (Hold & Win) bonus mode mechanics work accurately', () => {
  assert.deepEqual(SLOT_BET_OPTIONS, [10, 100]);
  assert.equal(POKIE_MACHINE_LIST.length, 3);

  // Verify each of the 3 stadium-themed machines has distinct aesthetics and jackpots
  const champ = POKIE_MACHINES.CHAMPIONS_GOLD;
  const cosmic = POKIE_MACHINES.COSMIC_NEON;
  const volcano = POKIE_MACHINES.VOLCANO_INFERNO;
  assert.equal(champ.baseJackpot10, 500);
  assert.equal(cosmic.baseJackpot10, 750);
  assert.equal(volcano.baseJackpot10, 1000);

  // Verify $10 vs $100 bet scaling on effective jackpot and line payouts
  assert.equal(getMachineEffectiveJackpot('CHAMPIONS_GOLD', 10, 500), 500);
  assert.equal(getMachineEffectiveJackpot('CHAMPIONS_GOLD', 100, 500), 5000);
  assert.equal(getMachineEffectiveJackpot('COSMIC_NEON', 100, 760), 7600);
  assert.equal(getMachineEffectiveJackpot('VOLCANO_INFERNO', 100, 1000), 10000);

  const spin100 = spinPokieReels(100, 10000, Math.random, [6, 5, 6], 'VOLCANO_INFERNO');
  assert.equal(spin100.triggersHoldAndSpin, true);
  assert.equal(spin100.scatterCount, 3);
  assert.equal(spin100.scatterPayout, 100 * 15); // $1,500 scatter win on $100 spin

  // Initialize Hold & Spin bonus session with 3 locked orbs
  const session = createHoldAndSpinSession({
    machineId: 'COSMIC_NEON',
    betAmount: 100,
    grandJackpotPool: 7500,
    triggerPositions: spin100.scatterPositions,
    rng: () => 0.1, // Deterministic 1X CASH orbs ($100 each)
  });
  assert.equal(session.respinsRemaining, 3);
  assert.equal(session.lockedCount, 3);
  assert.equal(session.orbsTotalValue, 300);
  assert.equal(session.isComplete, false);

  // Respin with no new orbs landed -> decrements respinsRemaining from 3 to 2
  const missStep = stepHoldAndSpinSession(session, () => 0.99);
  assert.equal(missStep.respinsRemaining, 2);
  assert.equal(missStep.lockedCount, 3);
  assert.equal(missStep.lastStepNewOrbs.length, 0);

  // Respin where all remaining cells lock -> resets / completes 9/9 Grand Jackpot!
  const fullGridStep = stepHoldAndSpinSession(missStep, () => 0.1, true);
  assert.equal(fullGridStep.lockedCount, 9);
  assert.equal(fullGridStep.grandJackpotWon, true);
  assert.equal(fullGridStep.isComplete, true);
  assert.equal(fullGridStep.totalBonusWin, fullGridStep.orbsTotalValue + 7500);
});






