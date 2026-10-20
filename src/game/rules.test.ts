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
  type PlayerStateSnapshot,
  type KeeperStateSnapshot,
} from './rules.ts';
import { GRAPHICS_CONFIG, PIXEL_DIGITS_3X5 } from './graphicsConfig.ts';

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
    y: 790,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const topWing: PlayerStateSnapshot = {
    team: 'YOU',
    index: 1,
    x: 1350,
    y: 420,
    vx: 3.5,
    vy: 0,
    angle: 0,
    radius: 16.5,
  };
  const keepers: KeeperStateSnapshot[] = [
    { team: 'YOU', x: 42, y: PITCH.height / 2, radius: 13 },
    { team: 'AI', x: PITCH.width - 42, y: PITCH.height / 2, radius: 13 },
  ];

  // Aiming a through-ball 28 degrees away from topWing into open space ahead of topWing:
  // Subtle auto-lock should NOT snap directly onto topWing's current body, allowing a true through-ball into space!
  const throughAimX = 1650 - carrier.x;
  const throughAimY = 260 - carrier.y;
  const len = Math.hypot(throughAimX, throughAimY);
  const throughDecision = evaluateKickDecisionPure(
    carrier,
    throughAimX / len,
    throughAimY / len,
    [carrier, topWing],
    keepers,
    { active: true, x: 1650, y: 260 }
  );
  assert.equal(throughDecision.type, 'PASS');
  assert.equal(throughDecision.isThroughBall, true);
  assert.equal(throughDecision.bestMate, topWing);
  assert.ok(
    throughDecision.passTargetX! > topWing.x + 120,
    `Through-ball targetX (${throughDecision.passTargetX}) should lead ahead of topWing (${topWing.x})`
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

