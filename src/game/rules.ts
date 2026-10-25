/**
 * Pure decoupled game rules, physics math, input normalization, and tactical evaluators
 * for REMATCH 0.2 (3v3 Arcade Cage Soccer).
 */

export const PITCH = {
  width: 2720,
  height: 1580,
  goalWidth: 380,
  goalDepth: 96,
  cornerChamfer: 86,
  boxWidth: 540,
  boxHeight: 880,
  wallRestitution: 0.96,
  antiCrowdingRadius: 390,
} as const;

export type GameMode = 'CASUAL' | 'RANKED' | 'TOURNAMENT';
export type KitChoice = 'HOME' | 'AWAY';
export type ControlGuideTab = 'COMPUTER' | 'REMOTE' | 'MOBILE';

export const TOURNAMENT_ROUNDS = ['Quarter-Final', 'Semi-Final', 'Grand Final'] as const;
export const TOTAL_TOURNAMENT_GAMES = 3;

export const PASSES_FOR_FLOW_BOOST = 3;
export const SWEET_SPOT_MIN = 0.62;
export const SWEET_SPOT_MAX = 0.92;
export const MERCY_RULE_LEAD = 3;
export const MATCH_DURATION_SECONDS = 120;

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerStateSnapshot {
  team: 'YOU' | 'AI';
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  commandedRunTimer?: number;
  commandedTargetX?: number;
  commandedTargetY?: number;
}

export interface KeeperStateSnapshot {
  team: 'YOU' | 'AI';
  x: number;
  y: number;
  radius: number;
}

export interface WallBouncePreview {
  x: number;
  y: number;
  refX: number;
  refY: number;
}

export interface KickDecision<
  P extends PlayerStateSnapshot = PlayerStateSnapshot,
  K extends KeeperStateSnapshot = KeeperStateSnapshot
> {
  type: 'SHOOT' | 'PASS' | 'KEEPER_PASS' | 'THROUGH';
  dirX: number;
  dirY: number;
  shotTargetX?: number;
  shotTargetY?: number;
  passTargetX?: number;
  passTargetY?: number;
  suggestedSpin?: number;
  bestMate?: P;
  keeperTarget?: K;
  wallBouncePoint?: WallBouncePreview | null;
  isThroughBall?: boolean;
}

/**
 * Returns the contrasting kit for the CPU team based on the player's chosen kit.
 */
export function getContrastingKit(userKit: KitChoice): KitChoice {
  return userKit === 'HOME' ? 'AWAY' : 'HOME';
}

/**
 * Computes flow-based passing and through-ball boosts so building Flow makes passes
 * faster, more magnetic to teammates, and much harder for CPU defenders or keepers to intercept.
 */
export function getFlowPassBoost(flowCombo: number): {
  speedBonus: number;
  passSpeedBonus: number;
  homingSteer: number;
  passHomingSteer: number;
  catchRadiusBonus: number;
  teammateCatchBonus: number;
  cpuInterceptScale: number;
  aiInterceptRadiusScale: number;
  keeperReachScale: number;
} {
  const clamped = Math.max(0, Math.min(6, flowCombo));
  const speedBonus = clamped * 0.95;
  const homingSteer = clamped * 0.012;
  const catchRadiusBonus = clamped * 2.4;
  const cpuInterceptScale = Math.max(0.36, 1 - clamped * 0.14);
  const keeperReachScale = Math.max(0.56, 1 - clamped * 0.08);
  return {
    speedBonus,
    passSpeedBonus: speedBonus,
    homingSteer: 0.036 + homingSteer,
    passHomingSteer: homingSteer,
    catchRadiusBonus,
    teammateCatchBonus: catchRadiusBonus,
    cpuInterceptScale,
    aiInterceptRadiusScale: cpuInterceptScale,
    keeperReachScale,
  };
}

/**
 * Computes generous tackle lunge reach so tackling the other team feels responsive and rewarding.
 */
export function computeTackleReach(isYou: boolean, inOwnBox: boolean): number {
  if (isYou) {
    return inOwnBox ? 110 : 90;
  }
  return inOwnBox ? 94 : 74;
}

/**
 * Computes organic 2D target position (targetX, targetY) and reaction speed factor for the goalkeeper.
 * The keeper shifts reactively toward the ball's current side (covering the near-post angle and stepping
 * slightly off the line), and tracks long-range shots slightly better while still leaving the far post open
 * when the attacking team switches play or passes across the box.
 */
export function computeKeeperTargetPosition(
  keeperTeam: 'YOU' | 'AI' | boolean,
  homeX: number,
  ballX: number,
  ballY: number,
  ballVx = 0,
  ballVy = 0,
  isShot = false,
  lastTouchTeam: 'YOU' | 'AI' | null = null,
  flowCombo = 0
): { targetX: number; targetY: number; reactivityMult: number; reactionSpeedFactor: number } {
  const isYou = keeperTeam === 'YOU' || keeperTeam === true;
  const teamTag: 'YOU' | 'AI' = isYou ? 'YOU' : 'AI';
  const safeHomeX = Number.isFinite(homeX) ? homeX : isYou ? 42 : PITCH.width - 42;
  const safeBallX = Number.isFinite(ballX) ? ballX : PITCH.width * 0.5;
  const safeBallY = Number.isFinite(ballY) ? ballY : PITCH.height * 0.5;
  const safeBallVx = Number.isFinite(ballVx) ? ballVx : 0;
  const safeBallVy = Number.isFinite(ballVy) ? ballVy : 0;
  const safeFlow = Number.isFinite(flowCombo) ? flowCombo : 0;

  const centerY = PITCH.height / 2;
  const goalHalf = PITCH.goalWidth / 2;
  const patrolLimit = goalHalf - 30;

  const flowBoost = getFlowPassBoost(safeFlow);
  const keeperFlowFactor = !isYou && lastTouchTeam === 'YOU' ? flowBoost.keeperReachScale : 1.0;

  // Distance from ball to this keeper's goal line
  const distToGoalX = isYou ? safeBallX : PITCH.width - safeBallX;
  const proximityRatio = Math.max(0, Math.min(1, 1 - distToGoalX / (PITCH.width * 0.75)));

  // Detect if a shot or fast ball is traveling toward this keeper's goal (especially long shots)
  const movingTowardGoal = isYou ? safeBallVx < -5.5 : safeBallVx > 5.5;
  const isLongShot = (isShot || movingTowardGoal) && distToGoalX > 480 && movingTowardGoal;
  const timeToGoal = movingTowardGoal ? Math.min(34, Math.max(0, Math.abs((safeHomeX - safeBallX) / safeBallVx))) : 0;

  // Keeper commits more strongly to the ball's Y side as the ball gets closer, and reads long-shot trajectories better
  const baseTrack = isLongShot ? 0.68 : 0.55 + proximityRatio * 0.22;
  const trackRatio = Math.min(0.92, baseTrack * keeperFlowFactor);
  const leadFrames = isLongShot ? Math.min(20, timeToGoal * 0.68) : isShot ? 8.5 : 3.0;
  const anticipatedBallY = safeBallY + safeBallVy * leadFrames;
  const rawDesiredY = centerY + (anticipatedBallY - centerY) * trackRatio;
  const targetY = Math.max(centerY - patrolLimit, Math.min(centerY + patrolLimit, rawDesiredY));

  // Step slightly further off the goal line to cut down long-shot angles while staying inside the box
  const stepOutDist = (12 + proximityRatio * 36 + (isLongShot ? 10 : 0)) * keeperFlowFactor;
  const attackSign = isYou ? 1 : -1;
  const targetX = safeHomeX + attackSign * stepOutDist;

  // If the ball is being passed laterally across the pitch (not a shot), the keeper has a subtle organic
  // footwork transition delay so quick cross-pitch passes open up a clean shooting window
  const isLateralPass = !isShot && !movingTowardGoal && Math.abs(safeBallVy) > 3.2 && lastTouchTeam !== teamTag;
  const reactivityMult = isLateralPass
    ? 0.80 * keeperFlowFactor
    : (1.14 + proximityRatio * 0.16 + (isLongShot ? 0.16 : 0)) * keeperFlowFactor;

  return {
    targetX,
    targetY,
    reactivityMult,
    reactionSpeedFactor: reactivityMult,
  };
}

/**
 * Computes first-touch pass reception radius so receiving passes and through-balls from teammates is forgiving and crisp.
 */
export function computePassCatchRadius(
  playerRadius: number,
  ballRadius: number,
  isPassTarget: boolean,
  isSameTeamPass: boolean,
  isYou: boolean,
  flowCombo: number,
  aiInterceptScale = 0.85
): number {
  const flowBoost = getFlowPassBoost(flowCombo);
  const base = playerRadius + ballRadius;
  if (isPassTarget) {
    return base + (isYou ? 22 + flowBoost.teammateCatchBonus : 12);
  }
  if (isYou && isSameTeamPass) {
    return base + 16 + flowBoost.teammateCatchBonus * 0.75;
  }
  if (!isYou && !isSameTeamPass) {
    return base * aiInterceptScale * flowBoost.aiInterceptRadiusScale;
  }
  return base + 4;
}

/**
 * Clamps frame delta time to <= 0.05s (50ms) so tab switches or hiccups
 * never tunnel fast entities through cage walls.
 */
export function clampDeltaTime(elapsedMs: number): { clampedSec: number; rawDt: number } {
  const safeMs = Math.min(50, Math.max(4, Number.isFinite(elapsedMs) ? elapsedMs : 16.6667));
  return {
    clampedSec: safeMs / 1000,
    rawDt: safeMs / 16.6667,
  };
}

/**
 * Checks whether a Finesse Charge bar release falls within the golden Sweet Spot (62% - 92%).
 */
export function isSweetSpotCharge(power: number): boolean {
  return power >= SWEET_SPOT_MIN && power <= SWEET_SPOT_MAX;
}

/**
 * Computes flow combo points gained on a completed pass.
 * - Base pass: +1 Flow
 * - Wall rebound bank pass: +2 Flow (total)
 * - 1-2 Give & Go sprint return: +1 extra Flow (so 1-2 pass gives +2 Flow, or +3 if also banked)
 */
export function calculateFlowGain(wasWallBounce: boolean, isGiveAndGo: boolean): number {
  return (wasWallBounce ? 2 : 1) + (isGiveAndGo ? 1 : 0);
}

/**
 * Shortest distance from point (px, py) to line segment (x1, y1) -> (x2, y2).
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Radial deadzone filter for Gamepad analog sticks and virtual touch joysticks.
 * Smoothly remaps [deadzone, 1.0] -> [0.0, 1.0] to prevent stick drift while keeping 360° precision.
 */
export function applyRadialDeadzone(
  rawX: number,
  rawY: number,
  deadzone = 0.16
): { x: number; y: number; magnitude: number; active: boolean } {
  const mag = Math.hypot(rawX, rawY);
  if (mag <= deadzone) {
    return { x: 0, y: 0, magnitude: 0, active: false };
  }
  const clampedMag = Math.min(1, mag);
  const normalizedMag = (clampedMag - deadzone) / (1 - deadzone);
  const nx = rawX / mag;
  const ny = rawY / mag;
  return {
    x: nx * normalizedMag,
    y: ny * normalizedMag,
    magnitude: normalizedMag,
    active: true,
  };
}

/**
 * Formats remaining match seconds as MM:SS with tabular padding.
 */
export function formatMatchTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Evaluates match termination rules (3-Goal Lead Victory, 2-Minute Regulation Time, or Golden Goal Overtime).
 */
export function checkMatchEndCondition(
  scoreYou: number,
  scoreAi: number,
  matchTimeSec: number,
  isGoldenGoal: boolean
): { ended: boolean; enterGoldenGoal: boolean; reason: string } {
  if (Math.abs(scoreYou - scoreAi) >= MERCY_RULE_LEAD) {
    return {
      ended: true,
      enterGoldenGoal: false,
      reason: '3-Goal Lead Victory!',
    };
  }
  if (isGoldenGoal) {
    if (scoreYou !== scoreAi) {
      return {
        ended: true,
        enterGoldenGoal: false,
        reason: 'Golden Goal Winner!',
      };
    }
    return { ended: false, enterGoldenGoal: false, reason: '' };
  }
  if (matchTimeSec <= 0) {
    if (scoreYou === scoreAi) {
      return {
        ended: false,
        enterGoldenGoal: true,
        reason: 'Golden Goal Overtime',
      };
    }
    return {
      ended: true,
      enterGoldenGoal: false,
      reason: 'Full Time (2:00)!',
    };
  }
  return { ended: false, enterGoldenGoal: false, reason: '' };
}

/**
 * Finds the best teammate to receive a pass or sprint onto a through-ball in space.
 * Rewards teammates who can run forward onto the target spot so through-balls feel natural.
 */
export function findBestReceiverForBall<P extends PlayerStateSnapshot>(
  actor: P | null,
  targetX: number,
  targetY: number,
  dirX: number,
  dirY: number,
  teammates: P[]
): P | undefined {
  let best: P | undefined;
  let bestScore = -Infinity;
  const startX = actor ? actor.x : targetX - dirX * 400;
  const startY = actor ? actor.y : targetY - dirY * 400;
  const passDist = Math.max(280, Math.hypot(targetX - startX, targetY - startY));
  const rayEndX = startX + dirX * (passDist + 160);
  const rayEndY = startY + dirY * (passDist + 160);

  for (const mate of teammates) {
    if (mate === actor) continue;
    const futureX =
      mate.commandedRunTimer && mate.commandedRunTimer > 0 && mate.commandedTargetX !== undefined
        ? mate.x * 0.6 + mate.commandedTargetX * 0.4
        : mate.x + (mate.vx || 0) * 10;
    const futureY =
      mate.commandedRunTimer && mate.commandedRunTimer > 0 && mate.commandedTargetY !== undefined
        ? mate.y * 0.6 + mate.commandedTargetY * 0.4
        : mate.y + (mate.vy || 0) * 10;

    const distToTarget = Math.hypot(futureX - targetX, futureY - targetY);
    const distToPassRay = pointToSegmentDistance(futureX, futureY, startX, startY, rayEndX, rayEndY);

    let forwardAlignment = 0;
    if (actor) {
      const dxFromActor = futureX - actor.x;
      const dyFromActor = futureY - actor.y;
      const dFromActor = Math.hypot(dxFromActor, dyFromActor) || 1;
      forwardAlignment = (dxFromActor / dFromActor) * dirX + (dyFromActor / dFromActor) * dirY;
      if (forwardAlignment < -0.25 && distToTarget > 280) continue;
    }

    const attackDir = mate.team === 'YOU' ? 1 : -1;
    const leadDeltaX = (targetX - mate.x) * attackDir;
    const runOntoBonus = leadDeltaX > -60 && leadDeltaX < 540 ? 95 : 0;
    const runnerBonus = mate.commandedRunTimer && mate.commandedRunTimer > 0 ? 120 : 0;
    const score =
      forwardAlignment * 340 -
      distToPassRay * 1.35 -
      distToTarget * 0.75 +
      runOntoBonus +
      runnerBonus;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

/**
 * Seamlessly selects the best teammate to control when a pass or through-ball is in flight.
 * Evaluates both proximity to the ball's path segment and direct distance to the ball/landing spot,
 * with responsive hysteresis so the player near or receiving the pass is immediately selected.
 */
export function findBestReceiverForLooseBall<P extends PlayerStateSnapshot>(
  ballState: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    lastTouchTeam: 'YOU' | 'AI' | null;
    isShot: boolean;
  },
  allPlayers: P[],
  excludePasser?: P | null,
  currentTarget?: P | null
): P | null {
  const candidates = allPlayers.filter((p) => p.team === 'YOU' && p !== excludePasser);
  if (candidates.length === 0) {
    return allPlayers.find((p) => p.team === 'YOU') || null;
  }

  const spd = Math.hypot(ballState.vx, ballState.vy);
  const lookAheadFrames = spd > 2.5 ? 22 : 6;
  const projBallX = Math.max(50, Math.min(PITCH.width - 50, ballState.x + ballState.vx * lookAheadFrames));
  const projBallY = Math.max(50, Math.min(PITCH.height - 50, ballState.y + ballState.vy * lookAheadFrames));

  let bestPlayer: P | null = null;
  let bestScore = Infinity;
  let currentTargetScore = Infinity;

  for (const p of candidates) {
    const pFutureX = p.x + (p.vx || 0) * 8;
    const pFutureY = p.y + (p.vy || 0) * 8;
    const distNow = Math.hypot(p.x - ballState.x, p.y - ballState.y);
    const distToProjected = Math.hypot(pFutureX - projBallX, pFutureY - projBallY);
    const distToSeg =
      spd > 2.5
        ? pointToSegmentDistance(pFutureX, pFutureY, ballState.x, ballState.y, projBallX, projBallY)
        : distNow;

    // Check if the ball is moving generally toward this player
    let towardBonus = 0;
    if (spd > 2.5 && distNow > 20) {
      const toPx = (pFutureX - ballState.x) / distNow;
      const toPy = (pFutureY - ballState.y) / distNow;
      const dot = (ballState.vx / spd) * toPx + (ballState.vy / spd) * toPy;
      if (dot > 0.5) {
        towardBonus = dot * 75;
      }
    }

    const score = distToSeg * 0.55 + Math.min(distNow, distToProjected) * 0.45 - towardBonus;
    if (p === currentTarget) {
      currentTargetScore = score;
    }
    if (score < bestScore) {
      bestScore = score;
      bestPlayer = p;
    }
  }

  // Responsive hysteresis: switch immediately when another teammate is clearly better positioned (>38px score advantage)
  if (
    currentTarget &&
    currentTarget.team === 'YOU' &&
    currentTarget !== excludePasser &&
    currentTargetScore <= bestScore + 38
  ) {
    return currentTarget;
  }

  return bestPlayer;
}

/**
 * Computes shot speed and applied spin from charge power, flow state, and sweet spot.
 */
export function computeShotSpinAndSpeed(
  suggestedSpin: number,
  chargePower: number,
  hasSuperFlow: boolean,
  isSweetSpot: boolean,
  isOneTouch: boolean,
  isYou: boolean
): { shotSpeed: number; appliedSpin: number } {
  const baseShotSpeed = isYou ? (hasSuperFlow ? 29.8 : 26.2) : hasSuperFlow ? 27.2 : 24.4;
  const shotSpeed =
    baseShotSpeed + chargePower * 6.8 + (isOneTouch ? 2.6 : 0) + (isSweetSpot ? 3.6 : 0);
  const spinScale = 0.38 + chargePower * 1.15 + (isSweetSpot ? 0.25 : 0);
  const appliedSpin = suggestedSpin * spinScale;
  return { shotSpeed, appliedSpin };
}

/**
 * Computes pass speed and applied spin from charge power, flow state, and sweet spot.
 */
export function computePassSpinAndSpeed(
  suggestedSpin: number,
  chargePower: number,
  flowCombo: number,
  isSweetSpot: boolean,
  isOneTouch: boolean
): { passSpeed: number; appliedSpin: number } {
  const flowBoost = getFlowPassBoost(flowCombo);
  const basePassSpeed = 21.4 + flowBoost.passSpeedBonus;
  const passSpeed =
    basePassSpeed + chargePower * 5.5 + (isOneTouch ? 2.0 : 0) + (isSweetSpot ? 2.8 : 0);
  const spinScale = chargePower > 0.12 ? 0.35 + chargePower * 1.15 + (isSweetSpot ? 0.2 : 0) : 0;
  const appliedSpin = suggestedSpin * spinScale;
  return { passSpeed, appliedSpin };
}

/**
 * Pure kick decision evaluator for passes, keeper back-passes, through-balls, bank passes, and curved shots.
 * Uses subtle, non-intrusive teammate auto-lock so players can freely thread tight angles, wall rebounds,
 * and through-balls where teammates sprint onto the pass.
 */
export function evaluateKickDecisionPure<
  P extends PlayerStateSnapshot,
  K extends KeeperStateSnapshot
>(
  actor: P,
  aimDirX: number,
  aimDirY: number,
  allPlayers: P[],
  allKeepers: K[],
  pointerWorld: { active: boolean; x: number; y: number },
  ballRadius = 10.5
): KickDecision<P, K> {
  const isYou = actor.team === 'YOU';
  const enemyGoalX = isYou ? PITCH.width : 0;
  const enemyGoalY = PITCH.height / 2;
  const goalHalfH = PITCH.goalWidth * 0.5;

  let dirX = aimDirX;
  let dirY = aimDirY;
  const len = Math.hypot(dirX, dirY);
  if (len < 0.05) {
    dirX = Math.cos(actor.angle);
    dirY = Math.sin(actor.angle);
  } else {
    dirX /= len;
    dirY /= len;
  }

  // 1. Check if aiming back toward own Goalkeeper for a safe reset pass
  const ownKeeper = allKeepers.find((k) => k.team === actor.team);
  if (ownKeeper && isYou) {
    const kdx = ownKeeper.x - actor.x;
    const kdy = ownKeeper.y - actor.y;
    const kdist = Math.hypot(kdx, kdy);
    if (kdist > 55 && kdist < 1450) {
      const kdot = (kdx / kdist) * dirX + (kdy / kdist) * dirY;
      const mouseDistToKeeper = pointerWorld.active
        ? Math.hypot(pointerWorld.x - ownKeeper.x, pointerWorld.y - ownKeeper.y)
        : 9999;
      if (mouseDistToKeeper < 115 || (kdot > 0.89 && dirX < -0.22)) {
        return {
          type: 'KEEPER_PASS',
          dirX: kdx / kdist,
          dirY: kdy / kdist,
          keeperTarget: ownKeeper,
        };
      }
    }
  }

  // 2. Check if aiming at the opponent's goal mouth
  let intersectsGoal = false;
  let projectedGoalY = enemyGoalY;
  const dxToGoal = enemyGoalX - actor.x;
  if ((isYou && dirX > 0.14 && dxToGoal > 0) || (!isYou && dirX < -0.14 && dxToGoal < 0)) {
    const t = dxToGoal / dirX;
    const yAtGoalLine = actor.y + dirY * t;
    if (Math.abs(yAtGoalLine - enemyGoalY) <= goalHalfH + 105 && Math.abs(dxToGoal) < 2150) {
      intersectsGoal = true;
      projectedGoalY = Math.max(
        enemyGoalY - goalHalfH * 0.9,
        Math.min(enemyGoalY + goalHalfH * 0.9, yAtGoalLine)
      );
    }
  }

  // 3. Check if aiming toward top or bottom cage wall for a bank/rebound pass
  let wallBouncePoint: WallBouncePreview | null = null;
  if (Math.abs(dirY) > 0.16) {
    const targetWallY = dirY < 0 ? ballRadius : PITCH.height - ballRadius;
    const tWall = (targetWallY - actor.y) / dirY;
    if (tWall > 35 && tWall < 1550) {
      const hitX = actor.x + dirX * tWall;
      if (hitX > PITCH.cornerChamfer && hitX < PITCH.width - PITCH.cornerChamfer) {
        wallBouncePoint = {
          x: hitX,
          y: targetWallY,
          refX: Math.max(95, Math.min(PITCH.width - 95, hitX + dirX * 380)),
          refY: Math.max(95, Math.min(PITCH.height - 95, targetWallY - dirY * 380)),
        };
      }
    }
  }

  // 4. Relaxed Teammate Auto-Lock: narrow cone and never hijacks tactical wall rebounds or through-balls into space
  const teammates = allPlayers.filter((p) => p.team === actor.team && p !== actor);
  const opponents = allPlayers.filter((p) => p.team !== actor.team);
  let bestMate: P | undefined;
  let bestMateScore = -Infinity;
  const pointerDistFromActor =
    isYou && pointerWorld.active ? Math.hypot(pointerWorld.x - actor.x, pointerWorld.y - actor.y) : 0;

  for (const mate of teammates) {
    const leadX = mate.x + (mate.vx || 0) * 10;
    const leadY = mate.y + (mate.vy || 0) * 10;
    const dx = leadX - actor.x;
    const dy = leadY - actor.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) continue;
    const dot = (dx / dist) * dirX + (dy / dist) * dirY;
    const mouseDist =
      isYou && pointerWorld.active ? Math.hypot(pointerWorld.x - leadX, pointerWorld.y - leadY) : 9999;

    // If the player is aiming into open space beyond or away from the teammate, let it be a through-ball or rebound pass!
    const aimingThroughBallPastMate =
      isYou &&
      pointerWorld.active &&
      mouseDist > 82 &&
      (pointerDistFromActor > dist + 70 || dot < 0.99);

    // Check if aiming toward the wall for a tactical rebound pass rather than directly at the teammate
    const wallDist = wallBouncePoint ? Math.hypot(wallBouncePoint.x - actor.x, wallBouncePoint.y - actor.y) : Infinity;
    const aimingSteeperToWallThanMate =
      wallBouncePoint !== null && Math.abs(dirY) > Math.abs(dy / dist) + 0.09;
    const directLaneBlockedByOpponent = opponents.some(
      (opp) => pointToSegmentDistance(opp.x, opp.y, actor.x, actor.y, leadX, leadY) < 56
    );
    const aimingForTacticalWallRebound =
      wallBouncePoint !== null &&
      mouseDist >= 58 &&
      (wallDist < dist * 1.28 || aimingSteeperToWallThanMate || directLaneBlockedByOpponent);

    const lockDotThreshold = isYou ? (pointerWorld.active ? 0.955 : 0.915) : 0.90;
    if (
      !aimingForTacticalWallRebound &&
      !aimingThroughBallPastMate &&
      (mouseDist < 62 || dot > lockDotThreshold)
    ) {
      const score = dot * 3.2 + (mouseDist < 62 ? 2.5 : 0) - dist / 4200;
      if (score > bestMateScore) {
        bestMateScore = score;
        bestMate = mate;
      }
    }
  }

  // Prioritize shooting if aiming at goal and cursor is not directly on a teammate
  const cursorDirectlyOnMate =
    bestMate &&
    isYou &&
    pointerWorld.active &&
    Math.hypot(pointerWorld.x - bestMate.x, pointerWorld.y - bestMate.y) < 58;

  if (intersectsGoal && !cursorDirectlyOnMate) {
    const shotDx = enemyGoalX - actor.x;
    const shotDy = projectedGoalY - actor.y;
    const shotLen = Math.hypot(shotDx, shotDy) || 1;
    const cornerOffset = (projectedGoalY - enemyGoalY) / goalHalfH;
    const effectiveCorner =
      Math.abs(cornerOffset) < 0.22 ? (actor.y <= enemyGoalY ? -0.45 : 0.45) : cornerOffset;
    const autoSpin = (isYou ? -1 : 1) * effectiveCorner * 0.0155;
    return {
      type: 'SHOOT',
      dirX: shotDx / shotLen,
      dirY: shotDy / shotLen,
      shotTargetX: enemyGoalX,
      shotTargetY: projectedGoalY,
      suggestedSpin: autoSpin,
    };
  }

  // Helper to compute curl spin around the closest defender or toward pitch center
  const computePassSpin = (targetX: number, targetY: number): number => {
    let closestOppDist = Infinity;
    let bendSign = targetY < PITCH.height * 0.5 ? -1 : 1;
    for (const opp of opponents) {
      const d = pointToSegmentDistance(opp.x, opp.y, actor.x, actor.y, targetX, targetY);
      if (d < closestOppDist) {
        closestOppDist = d;
        const cross = (targetX - actor.x) * (opp.y - actor.y) - (targetY - actor.y) * (opp.x - actor.x);
        bendSign = cross >= 0 ? 1 : -1;
      }
    }
    return bendSign * 0.011;
  };

  if (bestMate) {
    const attackDir = isYou ? 1 : -1;
    const leadX = bestMate.x + (bestMate.vx || 0) * 14 + (isYou ? attackDir * 28 : 0);
    const leadY = bestMate.y + (bestMate.vy || 0) * 14;
    const tdx = leadX - actor.x;
    const tdy = leadY - actor.y;
    const tlen = Math.hypot(tdx, tdy) || 1;
    // Relaxed magnetic assist: 86% player raw aim + 14% teammate lead vector (for YOU) so manual angles feel free
    const aimWeight = isYou ? 0.86 : 0.35;
    const lockWeight = 1 - aimWeight;
    const blendedX = dirX * aimWeight + (tdx / tlen) * lockWeight;
    const blendedY = dirY * aimWeight + (tdy / tlen) * lockWeight;
    const blen = Math.hypot(blendedX, blendedY) || 1;
    const finalDirX = blendedX / blen;
    const finalDirY = blendedY / blen;
    const targetX = Math.max(75, Math.min(PITCH.width - 75, actor.x + finalDirX * tlen));
    const targetY = Math.max(75, Math.min(PITCH.height - 75, actor.y + finalDirY * tlen));

    return {
      type: 'PASS',
      dirX: finalDirX,
      dirY: finalDirY,
      bestMate,
      shotTargetX: targetX,
      shotTargetY: targetY,
      passTargetX: targetX,
      passTargetY: targetY,
      suggestedSpin: computePassSpin(targetX, targetY),
      isThroughBall: false,
    };
  }

  // 5. Tactical Wall Rebound Bank Pass or Through-Ball into Open Space:
  // If aiming at a wall rebound, target the exact wall bounce point so the ball strikes the wall along the player's true aim line!
  if (wallBouncePoint) {
    const refDx = wallBouncePoint.refX - wallBouncePoint.x;
    const refDy = wallBouncePoint.refY - wallBouncePoint.y;
    const refLen = Math.hypot(refDx, refDy) || 1;
    const reboundReceiver = findBestReceiverForBall(
      actor,
      wallBouncePoint.refX,
      wallBouncePoint.refY,
      refDx / refLen,
      refDy / refLen,
      teammates
    );
    return {
      type: 'PASS',
      dirX,
      dirY,
      bestMate: reboundReceiver,
      shotTargetX: wallBouncePoint.x,
      shotTargetY: wallBouncePoint.y,
      passTargetX: wallBouncePoint.x,
      passTargetY: wallBouncePoint.y,
      wallBouncePoint,
      suggestedSpin: 0,
      isThroughBall: true,
    };
  }

  const pointerDist =
    isYou && pointerWorld.active
      ? Math.min(760, Math.max(260, Math.hypot(pointerWorld.x - actor.x, pointerWorld.y - actor.y)))
      : 540;
  const throughX = Math.max(85, Math.min(PITCH.width - 85, actor.x + dirX * pointerDist));
  const throughY = Math.max(85, Math.min(PITCH.height - 85, actor.y + dirY * pointerDist));

  const throughReceiver = findBestReceiverForBall(
    actor,
    throughX,
    throughY,
    dirX,
    dirY,
    teammates
  );

  return {
    type: 'PASS',
    dirX,
    dirY,
    bestMate: throughReceiver,
    shotTargetX: throughX,
    shotTargetY: throughY,
    passTargetX: throughX,
    passTargetY: throughY,
    wallBouncePoint: null,
    suggestedSpin: computePassSpin(throughX, throughY),
    isThroughBall: true,
  };
}

/**
 * Checks if a loose ball is inside the given keeper's penalty box with no field players from either team nearby,
 * allowing the keeper to walk toward the ball, collect it, and pass it to their team without ever leaving the box.
 */
export function shouldKeeperSweepLooseBallInBox<P extends { x: number; y: number }>(
  keeperTeam: 'YOU' | 'AI',
  ballState: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    owner: unknown | null;
    isShot: boolean;
  },
  allFieldPlayers: P[]
): boolean {
  if (ballState.owner !== null) return false;
  const ballSpd = Math.hypot(ballState.vx, ballState.vy);
  // Don't casually walk toward a blazing shot; let normal shot-saving/diving logic handle fast shots
  if (ballState.isShot && ballSpd > 8.5) return false;
  if (ballSpd > 13.5) return false;

  const boxTop = (PITCH.height - PITCH.boxHeight) / 2;
  const boxBottom = (PITCH.height + PITCH.boxHeight) / 2;
  const inBoxY = ballState.y >= boxTop + 14 && ballState.y <= boxBottom - 14;
  if (!inBoxY) return false;

  const isYou = keeperTeam === 'YOU';
  const inBoxX = isYou
    ? ballState.x >= 10 && ballState.x <= PITCH.boxWidth - 16
    : ballState.x >= PITCH.width - PITCH.boxWidth + 16 && ballState.x <= PITCH.width - 10;
  if (!inBoxX) return false;

  // Verify no field player from either team is nearby the ball (within 210px)
  for (const p of allFieldPlayers) {
    if (Math.hypot(p.x - ballState.x, p.y - ballState.y) < 210) {
      return false;
    }
  }
  return true;
}

/**
 * Strictly clamps the goalkeeper's (x, y) coordinates inside their own penalty box so the keeper can NEVER leave the box.
 */
export function clampKeeperToBox(
  keeperTeam: 'YOU' | 'AI',
  x: number,
  y: number,
  radius = 13.5
): { x: number; y: number } {
  const boxTop = (PITCH.height - PITCH.boxHeight) / 2;
  const boxBottom = (PITCH.height + PITCH.boxHeight) / 2;
  const minY = boxTop + radius + 6;
  const maxY = boxBottom - radius - 6;
  const isYou = keeperTeam === 'YOU';
  const minX = isYou ? 22 : PITCH.width - PITCH.boxWidth + radius + 8;
  const maxX = isYou ? PITCH.boxWidth - radius - 8 : PITCH.width - 22;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * Determines whether a goal was scored from a long shot far outside the opponent's penalty box ("RONALDO GOAL").
 */
export function isLongRangeGoal(
  scoringTeam: 'YOU' | 'AI',
  kickOriginX: number,
  kickOriginY: number,
  goalY = PITCH.height / 2
): boolean {
  const isYou = scoringTeam === 'YOU';
  const goalX = isYou ? PITCH.width : 0;
  // Penalty box extends 540px from goal line; "far outside of the box" means at least 145px beyond the box line (685px+ from goal line)
  const boxEdgeX = isYou ? PITCH.width - PITCH.boxWidth : PITCH.boxWidth;
  const farOutsideBoxX = isYou ? kickOriginX <= boxEdgeX - 145 : kickOriginX >= boxEdgeX + 145;
  const totalShotDist = Math.hypot(goalX - kickOriginX, goalY - kickOriginY);
  return farOutsideBoxX && totalShotDist >= 700;
}

export const GAME_TITLE = 'TIKI TAKA 0.2';
export const FIREBASE_CLOUD_TITLE = 'TIKI TAKA 0.2 • GLOBAL CLUB CLOUD';

export type RankSymbolId =
  | 'BRONZE_SHIELD_1'
  | 'BRONZE_SHIELD_2'
  | 'SILVER_CREST'
  | 'GOLD_CROWN'
  | 'PLATINUM_STAR'
  | 'DIAMOND_GEM'
  | 'STAR_CHAMPION';

export interface RankTierInfo {
  index: number;
  name: string;
  shortLabel: string;
  tierGroup: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'STAR';
  divisionNumeral: 'I' | 'II' | '★';
  symbolId: RankSymbolId;
  minWins: number;
  rankPointsRequired: number;
  borderHex: string;
  shadowHex: string;
  badgeBgHex: string;
  badgeTextHex: string;
  accentGlowHex: string;
  cpuSpeed: number;
  cpuDribble: number;
  standOff: number;
  tackleChance: number;
  decisionDelay: number;
  keeperSpeed: number;
  passCreativity: number;
  interceptScale: number;
}

export const RANK_TIERS: readonly RankTierInfo[] = [
  {
    index: 0,
    name: 'Bronze I',
    shortLabel: 'BRZ I',
    tierGroup: 'BRONZE',
    divisionNumeral: 'I',
    symbolId: 'BRONZE_SHIELD_1',
    minWins: 0,
    rankPointsRequired: 0,
    borderHex: '#cd7f32',
    shadowHex: '#7c2d12',
    badgeBgHex: '#ffedd5',
    badgeTextHex: '#9a3412',
    accentGlowHex: '#fb923c',
    cpuSpeed: 3.35,
    cpuDribble: 1.82,
    standOff: 195,
    tackleChance: 0.022,
    decisionDelay: 25,
    keeperSpeed: 1.85,
    passCreativity: 0.80,
    interceptScale: 0.94,
  },
  {
    index: 1,
    name: 'Bronze II',
    shortLabel: 'BRZ II',
    tierGroup: 'BRONZE',
    divisionNumeral: 'II',
    symbolId: 'BRONZE_SHIELD_2',
    minWins: 1,
    rankPointsRequired: 100,
    borderHex: '#d97706',
    shadowHex: '#78350f',
    badgeBgHex: '#fef3c7',
    badgeTextHex: '#92400e',
    accentGlowHex: '#f59e0b',
    cpuSpeed: 3.55,
    cpuDribble: 1.95,
    standOff: 180,
    tackleChance: 0.026,
    decisionDelay: 21,
    keeperSpeed: 1.92,
    passCreativity: 0.83,
    interceptScale: 0.98,
  },
  {
    index: 2,
    name: 'Silver I',
    shortLabel: 'SLV I',
    tierGroup: 'SILVER',
    divisionNumeral: 'I',
    symbolId: 'SILVER_CREST',
    minWins: 2,
    rankPointsRequired: 200,
    borderHex: '#94a3b8',
    shadowHex: '#334155',
    badgeBgHex: '#f1f5f9',
    badgeTextHex: '#1e293b',
    accentGlowHex: '#cbd5e1',
    cpuSpeed: 3.78,
    cpuDribble: 2.08,
    standOff: 162,
    tackleChance: 0.032,
    decisionDelay: 17,
    keeperSpeed: 2.02,
    passCreativity: 0.87,
    interceptScale: 1.03,
  },
  {
    index: 3,
    name: 'Gold II',
    shortLabel: 'GLD II',
    tierGroup: 'GOLD',
    divisionNumeral: 'II',
    symbolId: 'GOLD_CROWN',
    minWins: 3,
    rankPointsRequired: 300,
    borderHex: '#eab308',
    shadowHex: '#854d0e',
    badgeBgHex: '#fef08a',
    badgeTextHex: '#713f12',
    accentGlowHex: '#fde047',
    cpuSpeed: 4.02,
    cpuDribble: 2.24,
    standOff: 146,
    tackleChance: 0.038,
    decisionDelay: 14,
    keeperSpeed: 2.12,
    passCreativity: 0.90,
    interceptScale: 1.08,
  },
  {
    index: 4,
    name: 'Platinum I',
    shortLabel: 'PLT I',
    tierGroup: 'PLATINUM',
    divisionNumeral: 'I',
    symbolId: 'PLATINUM_STAR',
    minWins: 4,
    rankPointsRequired: 400,
    borderHex: '#06b6d4',
    shadowHex: '#155e75',
    badgeBgHex: '#cffafe',
    badgeTextHex: '#0e7490',
    accentGlowHex: '#22d3ee',
    cpuSpeed: 4.24,
    cpuDribble: 2.38,
    standOff: 130,
    tackleChance: 0.045,
    decisionDelay: 12,
    keeperSpeed: 2.22,
    passCreativity: 0.93,
    interceptScale: 1.13,
  },
  {
    index: 5,
    name: 'Diamond I',
    shortLabel: 'DMD I',
    tierGroup: 'DIAMOND',
    divisionNumeral: 'I',
    symbolId: 'DIAMOND_GEM',
    minWins: 5,
    rankPointsRequired: 500,
    borderHex: '#6366f1',
    shadowHex: '#312e81',
    badgeBgHex: '#e0e7ff',
    badgeTextHex: '#3730a3',
    accentGlowHex: '#818cf8',
    cpuSpeed: 4.42,
    cpuDribble: 2.50,
    standOff: 118,
    tackleChance: 0.052,
    decisionDelay: 10,
    keeperSpeed: 2.32,
    passCreativity: 0.95,
    interceptScale: 1.17,
  },
  {
    index: 6,
    name: 'Star League',
    shortLabel: 'STAR',
    tierGroup: 'STAR',
    divisionNumeral: 'MAX',
    symbolId: 'STAR_CHAMPION',
    minWins: 6,
    rankPointsRequired: 600,
    borderHex: '#d946ef',
    shadowHex: '#701a75',
    badgeBgHex: '#fae8ff',
    badgeTextHex: '#86198f',
    accentGlowHex: '#f0abfc',
    cpuSpeed: 4.55,
    cpuDribble: 2.58,
    standOff: 112,
    tackleChance: 0.056,
    decisionDelay: 9,
    keeperSpeed: 2.38,
    passCreativity: 0.96,
    interceptScale: 1.20,
  },
] as const;

/**
 * Returns the player's current RankTierInfo based on their total competitive wins.
 * Players start at Bronze I (0 wins) and rank up as they win games.
 */
export function getUserRankInfo(rankedWins: number): RankTierInfo {
  const safeWins = Math.max(0, Math.floor(Number.isFinite(rankedWins) ? rankedWins : 0));
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (safeWins >= tier.minWins) {
      current = tier;
    }
  }
  return current;
}

/**
 * Returns the next RankTierInfo above the player's current rank, or null if at max rank (Star League).
 */
export function getNextRankInfo(rankedWins: number): RankTierInfo | null {
  const current = getUserRankInfo(rankedWins);
  return RANK_TIERS[current.index + 1] || null;
}

export interface RankProgressSummary {
  currentRank: RankTierInfo;
  prevRank: RankTierInfo;
  nextRank: RankTierInfo | null;
  rankedUp: boolean;
  progressPct: number;
  prevProgressPct: number;
  winsNeededForNext: number;
  statusHeadline: string;
  subtext: string;
  clubLevel: number;
  prevClubLevel: number;
  leveledUp: boolean;
  rankPoints: number;
  nextRankPoints: number;
  divisionProgressPct: number;
  levelProgressPct: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
}

/**
 * Computes the player's competitive rank progress bar percentage, Club Level XP, promotion status, and UI labels.
 */
export function computeRankProgressSummary(
  rankedWins: number,
  prevWins = rankedWins,
  rankedMatches = rankedWins,
  prevMatches = prevWins
): RankProgressSummary {
  const safeWins = Math.max(0, Math.floor(Number.isFinite(rankedWins) ? rankedWins : 0));
  const safePrevWins = Math.max(0, Math.floor(Number.isFinite(prevWins) ? prevWins : safeWins));
  const safeMatches = Math.max(safeWins, Math.floor(Number.isFinite(rankedMatches) ? rankedMatches : safeWins));
  const safePrevMatches = Math.max(safePrevWins, Math.floor(Number.isFinite(prevMatches) ? prevMatches : safePrevWins));

  const currentRank = getUserRankInfo(safeWins);
  const prevRank = getUserRankInfo(safePrevWins);
  const nextRank = getNextRankInfo(safeWins);
  const rankedUp = currentRank.index > prevRank.index;

  // Club XP & Level calculation: +100 XP per Ranked Win, +35 XP per non-win Ranked Match played
  const nonWinMatches = Math.max(0, safeMatches - safeWins);
  const prevNonWinMatches = Math.max(0, safePrevMatches - safePrevWins);
  const totalXp = safeWins * 100 + nonWinMatches * 35;
  const prevTotalXp = safePrevWins * 100 + prevNonWinMatches * 35;

  const xpForNextLevel = 100;
  const clubLevel = 1 + Math.floor(totalXp / xpForNextLevel);
  const prevClubLevel = 1 + Math.floor(prevTotalXp / xpForNextLevel);
  const leveledUp = clubLevel > prevClubLevel;
  const xpInCurrentLevel = totalXp % xpForNextLevel;
  const levelProgressPct = nextRank
    ? Math.max(12, Math.min(98, Math.round(((currentRank.index + xpInCurrentLevel / 100) / (RANK_TIERS.length - 1)) * 100)))
    : 100;

  const rankPoints = totalXp;
  const nextRankPoints = nextRank ? nextRank.rankPointsRequired : currentRank.rankPointsRequired;
  const divisionProgressPct = nextRank
    ? Math.min(96, Math.max(16, Math.round(((currentRank.index + 1) / RANK_TIERS.length) * 100 + (xpInCurrentLevel / 100) * 10)))
    : 100;

  const progressPct = Math.min(100, Math.max(14, Math.round(((currentRank.index + 1) / RANK_TIERS.length) * 100)));
  const prevProgressPct = Math.min(100, Math.max(14, Math.round(((prevRank.index + 1) / RANK_TIERS.length) * 100)));
  const winsNeededForNext = nextRank ? Math.max(1, nextRank.minWins - safeWins) : 0;

  const statusHeadline = rankedUp
    ? `RANK UP! PROMOTED TO ${currentRank.name.toUpperCase()}`
    : nextRank
      ? `RANKED PROGRESS • ${currentRank.name.toUpperCase()}`
      : `MAX RANK ACHIEVED • ${currentRank.name.toUpperCase()}`;

  const subtext = rankedUp
    ? nextRank
      ? `Promoted from ${prevRank.name} to ${currentRank.name}! Win ${winsNeededForNext} more Ranked ${winsNeededForNext === 1 ? 'match' : 'matches'} for ${nextRank.name}.`
      : `Promoted from ${prevRank.name} to the highest tier: ${currentRank.name}!`
    : nextRank
      ? `Win ${winsNeededForNext} more Ranked ${winsNeededForNext === 1 ? 'match' : 'matches'} to reach ${nextRank.name}`
      : 'Top Rank Tier Reached (Star League Champion)';

  return {
    currentRank,
    prevRank,
    nextRank,
    rankedUp,
    progressPct,
    prevProgressPct,
    winsNeededForNext,
    statusHeadline,
    subtext,
    clubLevel,
    prevClubLevel,
    leveledUp,
    rankPoints,
    nextRankPoints,
    divisionProgressPct,
    levelProgressPct,
    xpInCurrentLevel,
    xpForNextLevel,
  };
}


/**
 * Quantizes an angle in radians to the nearest discrete step (e.g. 16 steps for 16-bit sprites).
 */
export function quantizeAngle(angleRad: number, steps = 16): number {
  const stepRad = (Math.PI * 2) / steps;
  return Math.round(angleRad / stepRad) * stepRad;
}

/**
 * Exact forward physics solver that computes the initial velocity (vx, vy) and trajectory points
 * so that a ball kicked from (startX, startY) with `speed` and `appliedSpin` under `updateBall()`
 * physics (`perp = (-vy, vx)`, spin decay `0.988`, drag `0.986`) follows the exact preview curve
 * and lands directly on `(targetX, targetY)`.
 */
export function computeCurvedKickTrajectory(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  speed: number,
  appliedSpin: number,
  numPreviewPoints = 22
): {
  vx: number;
  vy: number;
  launchAngle: number;
  frames: number;
  points: { x: number; y: number }[];
} {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const targetDist = Math.hypot(dx, dy);
  const targetAngle = Math.atan2(dy, dx);

  if (targetDist < 1 || speed <= 0.1) {
    return {
      vx: Math.cos(targetAngle) * speed,
      vy: Math.sin(targetAngle) * speed,
      launchAngle: targetAngle,
      frames: 1,
      points: [
        { x: startX, y: startY },
        { x: targetX, y: targetY },
      ],
    };
  }

  // Simulate in canonical local space starting along +X axis with (speed, 0)
  let sx = 0;
  let sy = 0;
  let svx = speed;
  let svy = 0;
  let sSpin = appliedSpin;
  const rawPts: { x: number; y: number }[] = [{ x: 0, y: 0 }];

  const maxSimFrames = 110;
  for (let f = 0; f < maxSimFrames; f++) {
    if (Math.abs(sSpin) > 0.0001) {
      const perpX = -svy;
      const perpY = svx;
      svx += perpX * sSpin;
      svy += perpY * sSpin;
      sSpin *= 0.988;
    }
    const prevX = sx;
    const prevY = sy;
    const prevDist = Math.hypot(prevX, prevY);

    sx += svx;
    sy += svy;
    svx *= 0.986;
    svy *= 0.986;

    const curDist = Math.hypot(sx, sy);
    if (curDist >= targetDist && curDist > prevDist) {
      const frac = (targetDist - prevDist) / (curDist - prevDist);
      sx = prevX + (sx - prevX) * frac;
      sy = prevY + (sy - prevY) * frac;
      rawPts.push({ x: sx, y: sy });
      break;
    }
    rawPts.push({ x: sx, y: sy });
    if (Math.hypot(svx, svy) < 1.2) break;
  }

  const endPt = rawPts[rawPts.length - 1];
  const simDist = Math.hypot(endPt.x, endPt.y) || 1;
  const simAngle = Math.atan2(endPt.y, endPt.x);
  const launchAngle = targetAngle - simAngle;
  const cosA = Math.cos(launchAngle);
  const sinA = Math.sin(launchAngle);
  const distScale = targetDist / simDist;

  // Resample onto `numPreviewPoints` evenly spaced segments rotated by `launchAngle`
  const points: { x: number; y: number }[] = [];
  const totalRaw = rawPts.length - 1;
  for (let i = 0; i <= numPreviewPoints; i++) {
    const exactIdx = (i / numPreviewPoints) * totalRaw;
    const idx0 = Math.floor(exactIdx);
    const idx1 = Math.min(totalRaw, idx0 + 1);
    const t = exactIdx - idx0;
    const lx = (rawPts[idx0].x + (rawPts[idx1].x - rawPts[idx0].x) * t) * distScale;
    const ly = (rawPts[idx0].y + (rawPts[idx1].y - rawPts[idx0].y) * t) * distScale;
    points.push({
      x: startX + lx * cosA - ly * sinA,
      y: startY + lx * sinA + ly * cosA,
    });
  }

  return {
    vx: Math.cos(launchAngle) * speed,
    vy: Math.sin(launchAngle) * speed,
    launchAngle,
    frames: Math.max(1, totalRaw),
    points,
  };
}

/**
 * Computes the exact launch velocity (vx, vy) and frame count for a curved shot or pass.
 */
export function computeLaunchVelocityForCurve(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  speed: number,
  appliedSpin: number
): { vx: number; vy: number; frames: number } {
  const res = computeCurvedKickTrajectory(startX, startY, targetX, targetY, speed, appliedSpin, 16);
  return { vx: res.vx, vy: res.vy, frames: res.frames };
}

/**
 * Simulates the curved trajectory points for the live shot/pass preview line
 * using the exact physics integrator so the preview line and actual ball path match 1:1.
 */
export function simulateCurvedPreviewArc(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  appliedSpin: number,
  steps = 20,
  speed = 24
): { x: number; y: number }[] {
  return computeCurvedKickTrajectory(startX, startY, targetX, targetY, speed, appliedSpin, steps).points;
}

export interface GoalCelebrationInput {
  scoringTeam: 'YOU' | 'AI';
  scoreYou: number;
  scoreAi: number;
  prevScoreYou: number;
  prevScoreAi: number;
  isLongRange: boolean;
  isPerfectStrike: boolean;
  isOneTouch: boolean;
  wasWallBounce: boolean;
  spinMagnitude: number;
  flowCombo: number;
  isGoldenGoal: boolean;
  matchTimeRemaining: number;
  opponentTag: string;
  playerName?: string;
  pitchTheme?: string;
  variationIndex?: number;
}

export interface GoalCelebrationSpec {
  headline: string;
  subheadline: string;
  kickerBadge: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  pitchCallouts: { text: string; color: string }[];
  ledMessage: string;
}

const CELEBRATION_COLOR_PALETTES: {
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
}[] = [
  { primaryColor: '#fde047', secondaryColor: '#f59e0b', glowColor: '#eab308' }, // Arcade Solar Gold
  { primaryColor: '#38bdf8', secondaryColor: '#22d3ee', glowColor: '#0284c7' }, // Electric Sky Cyan
  { primaryColor: '#34d399', secondaryColor: '#fde047', glowColor: '#059669' }, // Emerald Mint & Gold
  { primaryColor: '#f472b6', secondaryColor: '#c084fc', glowColor: '#db2777' }, // Hyper Neon Magenta
  { primaryColor: '#fb923c', secondaryColor: '#fde047', glowColor: '#ea580c' }, // Blazing Sunset Amber
  { primaryColor: '#a78bfa', secondaryColor: '#38bdf8', glowColor: '#7c3aed' }, // Cyber Violet & Cyan
  { primaryColor: '#4ade80', secondaryColor: '#22d3ee', glowColor: '#16a34a' }, // Turbo Lime & Aqua
];

const STADIUM_GOAL_SLOGANS: Record<
  string,
  { headlines: string[]; badge: string; primaryColor: string; secondaryColor: string; glowColor: string }
> = {
  COSMIC_SPACE: {
    headlines: ['ORBITAL LASER STRIKE!', 'GALACTIC SCREAMER!', 'SUPERNOVA FINISH!', 'ZERO-G BANGER!'],
    badge: '🪐 COSMIC ORBIT ARENA',
    primaryColor: '#38bdf8',
    secondaryColor: '#e879f9',
    glowColor: '#7c3aed',
  },
  URBAN_CONCRETE: {
    headlines: ['CONCRETE JUNGLE KING!', 'ROOFTOP BANGER!', 'STREET CAGE LEGEND!', 'BLACKTOP BULLSEYE!'],
    badge: '🏙️ ROOFTOP BLOCK PARTY',
    primaryColor: '#facc15',
    secondaryColor: '#38bdf8',
    glowColor: '#ea580c',
  },
  RIO_CLAY: {
    headlines: ['COPACABANA JOGA BONITO!', 'SAMBA SCREAMER!', 'RIO CARNIVAL MAGIC!', 'SUNSET BEACH BANGER!'],
    badge: '🌴 COPACABANA SUNSET CLAY',
    primaryColor: '#fde047',
    secondaryColor: '#2dd4bf',
    glowColor: '#f97316',
  },
  TWILIGHT_SYNTH: {
    headlines: ['NEON OVERDRIVE!', 'CYBERPUNK LASER!', 'SYNTHWAVE SCREAMER!', 'OUTRUN THE KEEPER!'],
    badge: '🌆 CYBER METROPOLIS',
    primaryColor: '#f472b6',
    secondaryColor: '#22d3ee',
    glowColor: '#9333ea',
  },
  ARCTIC_ICE: {
    headlines: ['SUB-ZERO ICEBREAKER!', 'GLACIER FROST BANGER!', 'ABSOLUTE ZERO FINISH!', 'AURORA SCREAMER!'],
    badge: '❄️ GLACIER FROST FJORD',
    primaryColor: '#67e8f9',
    secondaryColor: '#e0f2fe',
    glowColor: '#0284c7',
  },
  VOLCANO_FORGE: {
    headlines: ['MAGMA ERUPTION!', 'FORGED IN DRAGON FIRE!', 'VOLCANIC CANNONBALL!', 'MOLTEN LAVA STRIKE!'],
    badge: '🌋 MAGMA CALDERA FORGE',
    primaryColor: '#fb923c',
    secondaryColor: '#fde047',
    glowColor: '#dc2626',
  },
  TURF_AUTUMN: {
    headlines: ['HARVEST FESTIVAL BANGER!', 'GOLDEN MAPLE STRIKE!', 'AUTUMN GALE THUNDER!', 'CRISP OCTOBER FINISH!'],
    badge: '🍁 AUTUMN HARVEST PARK',
    primaryColor: '#fb923c',
    secondaryColor: '#fde047',
    glowColor: '#b45309',
  },
  TURF_SAKURA: {
    headlines: ['SAKURA STORM STRIKE!', 'KYOTO BLOSSOM MAGIC!', 'IMPERIAL ZEN FINISH!', 'PETAL TORNADO GOAL!'],
    badge: '🌸 KYOTO SAKURA GARDEN',
    primaryColor: '#f472b6',
    secondaryColor: '#fef08a',
    glowColor: '#db2777',
  },
  TURF_CHAMPIONS: {
    headlines: ['CHAMPIONS CATHEDRAL ROAR!', 'EUROPEAN NIGHTS MAGIC!', 'IMMORTAL TROPHY FINISH!', 'HALL OF FAME STRIKE!'],
    badge: '🏆 CHAMPIONS CATHEDRAL',
    primaryColor: '#fde047',
    secondaryColor: '#60a5fa',
    glowColor: '#1d4ed8',
  },
  CLASSIC_TURF: {
    headlines: ['ROYAL PARK SCREAMER!', 'BOTANICAL BANGER!', 'OLYMPIC STADIUM CLASS!', 'PURE ARCADE MAGIC!'],
    badge: '⚽ ROYAL BOTANICAL ARENA',
    primaryColor: '#34d399',
    secondaryColor: '#fde047',
    glowColor: '#059669',
  },
};

/**
 * Generates dynamic, expressive goal celebration messages depending on:
 * - overall match score state (opening goal, equalizer, comeback lead, mercy KO, golden goal, buzzer beater)
 * - specific type of goal scored (long-range Ronaldo screamer, curved bender, wall bank shot, one-touch volley, Super Flow)
 * - stadium-specific themed slogans (`pitchTheme`)
 * - personalized player profile name slogans (`playerName`)
 * - vibrant multi-color celebration palettes
 */
export function buildGoalCelebrationMessage(input: GoalCelebrationInput): GoalCelebrationSpec {
  const {
    scoringTeam,
    scoreYou,
    scoreAi,
    prevScoreYou,
    prevScoreAi,
    isLongRange,
    isPerfectStrike,
    isOneTouch,
    wasWallBounce,
    spinMagnitude,
    flowCombo,
    isGoldenGoal,
    matchTimeRemaining,
    opponentTag,
    playerName,
    pitchTheme,
    variationIndex,
  } = input;

  const cleanPlayerName = (playerName || '').trim();
  const hasCustomPlayerName = cleanPlayerName.length > 0;
  const nameUpper = (cleanPlayerName || 'PLAYER').toUpperCase();
  const stadiumSpec = pitchTheme ? STADIUM_GOAL_SLOGANS[pitchTheme] : undefined;
  const seed =
    typeof variationIndex === 'number'
      ? Math.abs(Math.floor(variationIndex))
      : scoreYou * 7 + scoreAi * 13 + Math.floor(Math.max(0, matchTimeRemaining));

  const isCurved = spinMagnitude > 0.0032;
  const isSuperFlow = flowCombo >= PASSES_FOR_FLOW_BOOST;
  const leadDiff = scoreYou - scoreAi;
  const isMercyKnockout = Math.abs(leadDiff) >= MERCY_RULE_LEAD;
  const isBuzzerBeater = !isGoldenGoal && matchTimeRemaining > 0 && matchTimeRemaining <= 15;
  const scoreDisplay = `${scoreYou} - ${scoreAi}`;

  // 1. Describe the Type of Goal
  let styleTag = 'CLINICAL FINISH';
  let styleCallout = 'TOP BINS!';
  let styleColor = '#fde047';

  if (isLongRange) {
    styleTag = 'LONG-RANGE SCREAMER';
    styleCallout = 'RONALDO GOAL! 🚀';
    styleColor = '#fde047';
  } else if (wasWallBounce) {
    styleTag = '200 IQ CAGE BANK SHOT';
    styleCallout = 'PINBALL WIZARD! 🎱';
    styleColor = '#38bdf8';
  } else if (isCurved && isPerfectStrike) {
    styleTag = 'SWEET-SPOT CURVED LASER';
    styleCallout = 'BEND IT LIKE BECKHAM! 🌀';
    styleColor = '#c084fc';
  } else if (isCurved) {
    styleTag = 'FILTHY BANANA CURVE';
    styleCallout = 'WHAT A BENDER! 🌀';
    styleColor = '#38bdf8';
  } else if (isOneTouch) {
    styleTag = 'INSTANT ONE-TOUCH VOLLEY';
    styleCallout = 'THUNDERVOLLEY! ⚡';
    styleColor = '#facc15';
  } else if (isSuperFlow) {
    styleTag = `${flowCombo}-PASS TIKI-TAKA FLOW`;
    styleCallout = `LIQUID FOOTBALL! x${flowCombo} 🔥`;
    styleColor = '#34d399';
  } else if (isPerfectStrike) {
    styleTag = 'SWEET-SPOT LASER MISSILE';
    styleCallout = 'TOP BINS LASER! 🎯';
    styleColor = '#34d399';
  } else if (stadiumSpec) {
    styleTag = stadiumSpec.headlines[seed % stadiumSpec.headlines.length].replace(/!$/, '');
    styleCallout = stadiumSpec.headlines[(seed + 1) % stadiumSpec.headlines.length];
    styleColor = stadiumSpec.primaryColor;
  }

  // 2. Describe the Overall Score Situation
  let scoreSituationTag = `SCORE ${scoreDisplay}`;
  if (isGoldenGoal) {
    scoreSituationTag = `GOLDEN GOAL OVERTIME WINNER (${scoreDisplay})`;
  } else if (isMercyKnockout) {
    scoreSituationTag = `+${MERCY_RULE_LEAD} MERCY RULE KNOCKOUT (${scoreDisplay})`;
  } else if (scoreYou === scoreAi) {
    scoreSituationTag = scoreYou >= 2 ? `HIGH-OCTANE EQUALIZER (${scoreDisplay})` : `ALL LEVEL (${scoreDisplay})`;
  } else if (scoringTeam === 'YOU') {
    if (prevScoreYou === 0 && prevScoreAi === 0) {
      scoreSituationTag = hasCustomPlayerName
        ? `OPENING GOAL • ${nameUpper} LEADS ${scoreDisplay}`
        : `OPENING GOAL • YOU LEAD ${scoreDisplay}`;
    } else if (prevScoreYou <= prevScoreAi && scoreYou > scoreAi && prevScoreAi >= 1) {
      scoreSituationTag = hasCustomPlayerName
        ? `COMEBACK LEAD • ${nameUpper} LEADS ${scoreDisplay}`
        : `COMEBACK LEAD • YOU LEAD ${scoreDisplay}`;
    } else if (leadDiff === 2) {
      scoreSituationTag = `2-GOAL CUSHION • 1 AWAY FROM MERCY (${scoreDisplay})`;
    } else {
      scoreSituationTag = hasCustomPlayerName
        ? `${nameUpper} LEADS ${opponentTag.toUpperCase()} ${scoreDisplay}`
        : `YOU LEAD ${opponentTag.toUpperCase()} ${scoreDisplay}`;
    }
  } else {
    if (prevScoreYou === 0 && prevScoreAi === 0) {
      scoreSituationTag = `${opponentTag.toUpperCase()} STRIKES FIRST (${scoreDisplay})`;
    } else if (scoreAi > scoreYou && prevScoreAi <= prevScoreYou && prevScoreYou >= 1) {
      scoreSituationTag = `${opponentTag.toUpperCase()} TAKES THE LEAD (${scoreDisplay})`;
    } else {
      scoreSituationTag = `${opponentTag.toUpperCase()} GOAL (${scoreDisplay})`;
    }
  }

  // 3. Combine Goal Type + Match Score + Stadium & Profile Name Slogans
  if (scoringTeam === 'YOU') {
    const pal = CELEBRATION_COLOR_PALETTES[seed % CELEBRATION_COLOR_PALETTES.length];
    let headline = 'GOOOAAAL!';
    let kickerBadge = hasCustomPlayerName ? `⚽ ${nameUpper} SCORES!` : '⚽ GOAL SCORED';
    let primaryColor = pal.primaryColor;
    let secondaryColor = pal.secondaryColor;
    let glowColor = pal.glowColor;

    const profileSlogans = [
      `${nameUpper} IS UNSTOPPABLE!`,
      `TAKE A BOW, ${nameUpper}!`,
      `${nameUpper} BREAKS THE CAGE!`,
      `${nameUpper} ON FIRE!`,
      `KING OF THE CAGE: ${nameUpper}!`,
      `${nameUpper} MAGIC!`,
    ];

    if (isGoldenGoal) {
      headline = isLongRange
        ? 'RONALDO GOLDEN GOAL!'
        : hasCustomPlayerName && seed % 2 === 1
          ? `${nameUpper} GOLDEN GOAL!`
          : 'GOLDEN GOAL WINNER!';
      kickerBadge = hasCustomPlayerName ? `👑 ${nameUpper} WALK-OFF WINNER` : '👑 OVERTIME WALK-OFF';
      primaryColor = '#fde047';
      secondaryColor = '#fbbf24';
      glowColor = '#eab308';
    } else if (isMercyKnockout) {
      headline = isLongRange
        ? 'RONALDO MERCY KO!'
        : hasCustomPlayerName && seed % 2 === 1
          ? `${nameUpper} MERCY KO!`
          : 'MERCY RULE KO!';
      kickerBadge = `💥 +${MERCY_RULE_LEAD} WALK-OFF VICTORY`;
      primaryColor = '#fde047';
      secondaryColor = '#34d399';
      glowColor = '#f59e0b';
    } else if (isLongRange) {
      headline = 'RONALDO GOAL!';
      kickerBadge = hasCustomPlayerName
        ? `🚀 ${nameUpper} FROM DOWNTOWN!`
        : '🚀 LONG-RANGE SCREAMER';
      primaryColor = '#fde047';
      secondaryColor = '#f97316';
      glowColor = '#eab308';
    } else if (wasWallBounce) {
      headline =
        hasCustomPlayerName && seed % 3 === 1
          ? `${nameUpper}: PINBALL WIZARD!`
          : 'PINBALL WIZARD!';
      kickerBadge = '🎱 CAGE BANK SHOT';
      primaryColor = '#38bdf8';
      secondaryColor = '#fde047';
      glowColor = '#0284c7';
    } else if (isCurved && isPerfectStrike) {
      headline = 'BEND IT LIKE BECKHAM!';
      kickerBadge = hasCustomPlayerName ? `🌀 ${nameUpper} CURVE LASER` : '🌀 SWEET-SPOT CURVE';
      primaryColor = '#e879f9';
      secondaryColor = '#fde047';
      glowColor = '#a855f7';
    } else if (isOneTouch) {
      headline = 'THUNDERVOLLEY!';
      kickerBadge = hasCustomPlayerName ? `⚡ ${nameUpper} ONE-TOUCH` : '⚡ ONE-TOUCH FINISH';
      primaryColor = '#fde047';
      secondaryColor = '#38bdf8';
      glowColor = '#f59e0b';
    } else if (isSuperFlow) {
      headline = 'TIKI-TAKA MAGIC!';
      kickerBadge = `🔥 SUPER FLOW x${flowCombo}`;
      primaryColor = '#34d399';
      secondaryColor = '#fde047';
      glowColor = '#059669';
    } else if (isBuzzerBeater) {
      headline = 'BUZZER BEATER!';
      kickerBadge = hasCustomPlayerName ? `⏰ ${nameUpper} CLUTCH!` : '⏰ LAST-SECOND CLUTCH';
      primaryColor = '#fde047';
      secondaryColor = '#fb7185';
      glowColor = '#f59e0b';
    } else if (scoreYou === scoreAi) {
      headline = scoreYou >= 2 ? 'ICE IN THE VEINS!' : 'WE ARE LEVEL!';
      kickerBadge = `🥶 CLUTCH EQUALIZER • ${scoreDisplay}`;
      primaryColor = '#38bdf8';
      secondaryColor = '#fde047';
      glowColor = '#0284c7';
    } else if (stadiumSpec && (hasCustomPlayerName || typeof variationIndex === 'number') && seed % 3 === 1) {
      // Stadium-specific headline variation!
      headline = stadiumSpec.headlines[seed % stadiumSpec.headlines.length];
      kickerBadge = `${stadiumSpec.badge} • ${scoreDisplay}`;
      primaryColor = stadiumSpec.primaryColor;
      secondaryColor = stadiumSpec.secondaryColor;
      glowColor = stadiumSpec.glowColor;
    } else if (hasCustomPlayerName && seed % 3 === 2) {
      // Player profile name slogan variation!
      headline = profileSlogans[seed % profileSlogans.length];
      kickerBadge = stadiumSpec
        ? `${stadiumSpec.badge} • ${scoreDisplay}`
        : `🌟 ${nameUpper} SHOWTIME • ${scoreDisplay}`;
      primaryColor = pal.primaryColor;
      secondaryColor = pal.secondaryColor;
      glowColor = pal.glowColor;
    } else if (prevScoreYou <= prevScoreAi && scoreYou > scoreAi && prevScoreAi >= 1) {
      headline = 'COMEBACK KINGS!';
      kickerBadge = `🔥 TURNED THE TABLES • ${scoreDisplay}`;
      primaryColor = '#fde047';
      secondaryColor = '#34d399';
      glowColor = '#f59e0b';
    } else if (prevScoreYou === 0 && prevScoreAi === 0) {
      headline = isPerfectStrike
        ? 'TOP BINS LASER!'
        : stadiumSpec && typeof variationIndex === 'number' && seed % 2 === 1
          ? stadiumSpec.headlines[seed % stadiumSpec.headlines.length]
          : 'FIRST BLOOD!';
      kickerBadge = stadiumSpec
        ? `${stadiumSpec.badge} • ${scoreDisplay}`
        : `⚡ OPENING STRIKE • ${scoreDisplay}`;
      primaryColor = stadiumSpec ? stadiumSpec.primaryColor : pal.primaryColor;
      secondaryColor = stadiumSpec ? stadiumSpec.secondaryColor : pal.secondaryColor;
      glowColor = stadiumSpec ? stadiumSpec.glowColor : pal.glowColor;
    } else if (leadDiff === 2) {
      headline = isPerfectStrike
        ? 'TOP BINS LASER!'
        : hasCustomPlayerName
          ? `${nameUpper} IS CRUISING! +2!`
          : 'CRUISING! +2 LEAD!';
      kickerBadge = `🌊 TWO-GOAL CUSHION • ${scoreDisplay}`;
      primaryColor = '#34d399';
      secondaryColor = '#fde047';
      glowColor = '#10b981';
    } else if (isPerfectStrike) {
      headline = 'TOP BINS LASER!';
      kickerBadge = `🎯 PERFECT STRIKE • ${scoreDisplay}`;
      primaryColor = '#fde047';
      secondaryColor = '#34d399';
      glowColor = '#eab308';
    } else if (stadiumSpec) {
      headline = stadiumSpec.headlines[seed % stadiumSpec.headlines.length];
      kickerBadge = `${stadiumSpec.badge} • ${scoreDisplay}`;
      primaryColor = stadiumSpec.primaryColor;
      secondaryColor = stadiumSpec.secondaryColor;
      glowColor = stadiumSpec.glowColor;
    }

    const stadiumFlavorSub = stadiumSpec
      ? ` • ${stadiumSpec.headlines[(seed + 2) % stadiumSpec.headlines.length].replace(/!$/, '')}`
      : '';
    const subheadline = `${styleTag} • ${scoreSituationTag}${stadiumFlavorSub}`;
    const pitchCallouts: { text: string; color: string }[] = [
      { text: styleCallout, color: primaryColor },
      {
        text: isMercyKnockout
          ? `MERCY KO! ${scoreDisplay}`
          : hasCustomPlayerName
            ? `${nameUpper} GOAL! (${scoreDisplay})`
            : scoreYou === scoreAi
              ? `TIED UP ${scoreDisplay}!`
              : `YOU LEAD ${scoreDisplay}!`,
        color: secondaryColor,
      },
    ];
    if (stadiumSpec) {
      pitchCallouts.push({
        text: stadiumSpec.headlines[seed % stadiumSpec.headlines.length],
        color: stadiumSpec.primaryColor,
      });
    }

    return {
      headline,
      subheadline,
      kickerBadge,
      primaryColor,
      secondaryColor,
      glowColor,
      pitchCallouts,
      ledMessage: `⚡ ${headline} ${subheadline} ⚡`,
    };
  }

  // AI Goal Scored
  const aiHeadline = isLongRange
    ? 'RONALDO SCREAMER!'
    : scoreYou === scoreAi
      ? 'RIVAL EQUALIZER!'
      : isMercyKnockout
        ? `${opponentTag.toUpperCase()} KO!`
        : `${opponentTag.toUpperCase()} SCORES!`;
  const aiSub = `${styleTag} • ${scoreSituationTag}`;

  return {
    headline: aiHeadline,
    subheadline: aiSub,
    kickerBadge: `⚠️ RIVAL GOAL • ${scoreDisplay}`,
    primaryColor: '#fb7185',
    secondaryColor: '#fde047',
    glowColor: '#e11d48',
    pitchCallouts: [{ text: `${opponentTag.toUpperCase()} GOAL! (${scoreDisplay})`, color: '#fb7185' }],
    ledMessage: `${aiHeadline} • ${aiSub}`,
  };
}

// ============================================================================
// MATCH ECONOMY, COUPON CODES & REAL POKIE MACHINE MATHS (REMATCH POKIES)
// ============================================================================

export const SLOT_SPIN_COST = 10;
export const SLOT_BET_OPTIONS = [10, 100, 1000] as const;
export type PokieBetAmount = (typeof SLOT_BET_OPTIONS)[number];
export const INITIAL_PLAYER_BALANCE = 30;
export const BASE_JACKPOT_POOL = 1000;
export const COUPON_HACK_CODE = 'HACK';
export const COUPON_HACK_SPINS = 10;
export const COUPON_HACK_REWARD = SLOT_SPIN_COST * COUPON_HACK_SPINS; // $100 (10 spins at $10)

export type PokieMachineId =
  | 'CHAMPIONS_GOLD'
  | 'COSMIC_NEON'
  | 'VOLCANO_INFERNO'
  | 'HIGH_ROLLER_ROYAL';

export interface PokieMachineConfig {
  id: PokieMachineId;
  name: string;
  shortName: string;
  stadiumName: string;
  pitchThemeId: PitchThemeId;
  tagline: string;
  /** Base Grand Jackpot at $10 bet (scales proportionally for $100 and $1,000 bets) */
  baseJackpot10: number;
  /** Multiplier on bet for 3x MEGA_TROPHY */
  jackpotMultiplier: number;
  /** Allowed spin bet amounts on this machine */
  allowedBets: readonly PokieBetAmount[];
  /** Default spin bet when opening this machine */
  defaultBet: PokieBetAmount;
  /** Shop unlock price in dollars ($0 = unlocked by default, $80,000 for High Roller) */
  unlockPrice: number;
  /** Whether this machine is the dedicated $1,000 High Roller machine */
  isHighRoller?: boolean;
  headerGradient: string;
  cabinetBg: string;
  cabinetBorderHex: string;
  reelHousingBg: string;
  reelBorderHex: string;
  accentHex: string;
  secondaryHex: string;
  badgeBgHex: string;
  badgeTextHex: string;
  bulbColors: [string, string, string];
  orbName: string;
  orbGradient: string;
  orbBorderHex: string;
  orbGlowRgba: string;
}

export const POKIE_MACHINES: Record<PokieMachineId, PokieMachineConfig> = {
  CHAMPIONS_GOLD: {
    id: 'CHAMPIONS_GOLD',
    name: 'Champions Cathedral',
    shortName: 'Champions Gold',
    stadiumName: 'Champions Cathedral',
    pitchThemeId: 'TURF_CHAMPIONS',
    tagline: 'ROYAL EMERALD & GOLD ARENA',
    baseJackpot10: 500,
    jackpotMultiplier: 50,
    allowedBets: [10, 100],
    defaultBet: 10,
    unlockPrice: 0,
    headerGradient: 'linear-gradient(135deg, #064e3b 0%, #0f172a 55%, #713f12 100%)',
    cabinetBg: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 55%, #fef9c3 100%)',
    cabinetBorderHex: '#facc15',
    reelHousingBg: '#064e3b',
    reelBorderHex: '#facc15',
    accentHex: '#facc15',
    secondaryHex: '#34d399',
    badgeBgHex: '#fef08a',
    badgeTextHex: '#422006',
    bulbColors: ['#fde047', '#34d399', '#ffffff'],
    orbName: 'CROWN ORB',
    orbGradient: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 55%, #b45309 100%)',
    orbBorderHex: '#fde047',
    orbGlowRgba: 'rgba(250, 204, 21, 0.9)',
  },
  COSMIC_NEON: {
    id: 'COSMIC_NEON',
    name: 'Cosmic Orbit',
    shortName: 'Cosmic Supernova',
    stadiumName: 'Cosmic Orbit',
    pitchThemeId: 'COSMIC_SPACE',
    tagline: 'ZERO-G CYBER SUPERNOVA',
    baseJackpot10: 750,
    jackpotMultiplier: 75,
    allowedBets: [10, 100],
    defaultBet: 10,
    unlockPrice: 1500,
    headerGradient: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 52%, #4a044e 100%)',
    cabinetBg: 'linear-gradient(180deg, #f8fafc 0%, #e0f2fe 55%, #fae8ff 100%)',
    cabinetBorderHex: '#38bdf8',
    reelHousingBg: '#1e1b4b',
    reelBorderHex: '#38bdf8',
    accentHex: '#38bdf8',
    secondaryHex: '#e879f9',
    badgeBgHex: '#e0f2fe',
    badgeTextHex: '#0c4a6e',
    bulbColors: ['#38bdf8', '#e879f9', '#818cf8'],
    orbName: 'PLASMA ORB',
    orbGradient: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 50%, #7e22ce 100%)',
    orbBorderHex: '#38bdf8',
    orbGlowRgba: 'rgba(56, 189, 248, 0.9)',
  },
  VOLCANO_INFERNO: {
    id: 'VOLCANO_INFERNO',
    name: 'Magma Caldera',
    shortName: 'Magma Inferno',
    stadiumName: 'Magma Caldera',
    pitchThemeId: 'VOLCANO_FORGE',
    tagline: 'MOLTEN OBSIDIAN MEGA-JACKPOT',
    baseJackpot10: 1000,
    jackpotMultiplier: 100,
    allowedBets: [10, 100],
    defaultBet: 10,
    unlockPrice: 12000,
    headerGradient: 'linear-gradient(135deg, #1c0a0a 0%, #450a0a 52%, #7c2d12 100%)',
    cabinetBg: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 55%, #ffe4e6 100%)',
    cabinetBorderHex: '#fb923c',
    reelHousingBg: '#450a0a',
    reelBorderHex: '#fb923c',
    accentHex: '#fb923c',
    secondaryHex: '#f43f5e',
    badgeBgHex: '#ffedd5',
    badgeTextHex: '#7c2d12',
    bulbColors: ['#fb923c', '#f43f5e', '#fde047'],
    orbName: 'MAGMA ORB',
    orbGradient: 'linear-gradient(180deg, #fef08a 0%, #f97316 50%, #dc2626 100%)',
    orbBorderHex: '#fb923c',
    orbGlowRgba: 'rgba(249, 115, 22, 0.92)',
  },
  HIGH_ROLLER_ROYAL: {
    id: 'HIGH_ROLLER_ROYAL',
    name: 'High Roller VIP Vault',
    shortName: 'High Roller VIP',
    stadiumName: 'Twilight Synthwave',
    pitchThemeId: 'TWILIGHT_SYNTH',
    tagline: '$1,000 SPIN • DIAMOND VIP HIGH ROLLER',
    baseJackpot10: 1000, // At $1,000 spin (100x scale), effective Grand Jackpot starts at $100,000!
    jackpotMultiplier: 100,
    allowedBets: [1000],
    defaultBet: 1000,
    unlockPrice: 80000,
    isHighRoller: true,
    headerGradient: 'linear-gradient(135deg, #0f172a 0%, #3b0764 50%, #854d0e 100%)',
    cabinetBg: 'linear-gradient(180deg, #fefce8 0%, #fae8ff 52%, #fef08a 100%)',
    cabinetBorderHex: '#facc15',
    reelHousingBg: '#2e1065',
    reelBorderHex: '#facc15',
    accentHex: '#fde047',
    secondaryHex: '#e879f9',
    badgeBgHex: '#fef08a',
    badgeTextHex: '#3b0764',
    bulbColors: ['#fde047', '#e879f9', '#38bdf8'],
    orbName: 'DIAMOND ORB',
    orbGradient: 'linear-gradient(180deg, #ffffff 0%, #fde047 48%, #a855f7 100%)',
    orbBorderHex: '#fde047',
    orbGlowRgba: 'rgba(250, 204, 21, 0.96)',
  },
};

export const POKIE_MACHINE_LIST: PokieMachineConfig[] = [
  POKIE_MACHINES.CHAMPIONS_GOLD,
  POKIE_MACHINES.COSMIC_NEON,
  POKIE_MACHINES.VOLCANO_INFERNO,
  POKIE_MACHINES.HIGH_ROLLER_ROYAL,
];

/**
 * Computes the active Grand Jackpot for a given machine and bet amount ($10, $100, or $1,000).
 * Scales the base jackpot proportionally (`betAmount / 10`) while preserving progressive contributions.
 */
export function getMachineEffectiveJackpot(
  machineId: PokieMachineId,
  betAmount: number,
  storedPoolAt10?: number
): number {
  const machine = POKIE_MACHINES[machineId] || POKIE_MACHINES.CHAMPIONS_GOLD;
  const base10 = machine.baseJackpot10;
  const pool10 = typeof storedPoolAt10 === 'number' && storedPoolAt10 >= base10 ? storedPoolAt10 : base10;
  const progressiveDelta10 = Math.max(0, pool10 - base10);
  const betScale = Math.max(1, betAmount / 10);
  return Math.round(base10 * betScale + progressiveDelta10 * betScale);
}

// ============================================================================
// TIERED TOURNAMENT BUY-INS & RESPECTIVE AWARDS ($100, $1,000, $10,000)
// ============================================================================

export type TournamentTierId = 'CUP_100' | 'CUP_1000' | 'CUP_10000';

export interface TournamentTierConfig {
  id: TournamentTierId;
  name: string;
  shortName: string;
  entryFee: 100 | 1000 | 10000;
  /** Scale multiplier applied to tournament round rewards (1x, 10x, 100x) */
  rewardMultiplier: number;
  /** Quarter-Final Win base + win payout */
  qfWinReward: number;
  /** Semi-Final Win base + win payout */
  sfWinReward: number;
  /** Grand Final Champion base + win payout */
  finalWinReward: number;
  /** Total guaranteed 3-round sweep prize (excluding extra goal/clean-sheet bonuses) */
  totalCupPrize: number;
  badgeBgHex: string;
  badgeTextHex: string;
  borderHex: string;
}

export const TOURNAMENT_TIERS: Record<TournamentTierId, TournamentTierConfig> = {
  CUP_100: {
    id: 'CUP_100',
    name: 'Club Knockout Cup',
    shortName: '$100 Cup',
    entryFee: 100,
    rewardMultiplier: 1,
    qfWinReward: 75,
    sfWinReward: 125,
    finalWinReward: 300,
    totalCupPrize: 500,
    badgeBgHex: '#dcfce7',
    badgeTextHex: '#14532d',
    borderHex: '#22c55e',
  },
  CUP_1000: {
    id: 'CUP_1000',
    name: 'Champions Gold Cup',
    shortName: '$1,000 Cup',
    entryFee: 1000,
    rewardMultiplier: 10,
    qfWinReward: 750,
    sfWinReward: 1250,
    finalWinReward: 3000,
    totalCupPrize: 5000,
    badgeBgHex: '#fef08a',
    badgeTextHex: '#713f12',
    borderHex: '#eab308',
  },
  CUP_10000: {
    id: 'CUP_10000',
    name: 'Diamond VIP Masters',
    shortName: '$10,000 Cup',
    entryFee: 10000,
    rewardMultiplier: 100,
    qfWinReward: 7500,
    sfWinReward: 12500,
    finalWinReward: 30000,
    totalCupPrize: 50000,
    badgeBgHex: '#f3e8ff',
    badgeTextHex: '#581c87',
    borderHex: '#a855f7',
  },
};

export const TOURNAMENT_TIER_LIST: TournamentTierConfig[] = [
  TOURNAMENT_TIERS.CUP_100,
  TOURNAMENT_TIERS.CUP_1000,
  TOURNAMENT_TIERS.CUP_10000,
];

export interface MatchMoneyRewardInput {
  gameMode: 'CASUAL' | 'RANKED' | 'TOURNAMENT';
  didWin: boolean;
  isDraw?: boolean;
  goalsFor: number;
  goalsAgainst: number;
  isMercyRule?: boolean;
  tournamentRound?: number; // 0 = QF, 1 = SF, 2 = Final
  tournamentTier?: TournamentTierId;
}

export interface MatchMoneyRewardResult {
  totalReward: number;
  basePay: number;
  winBonus: number;
  goalBonus: number;
  specialBonus: number;
  modeMultiplierLabel: string;
  summaryText: string;
}

/**
 * Calculates money earned from completing a match based on performance, game mode, and tournament tier.
 */
export function calculateMatchMoneyReward(input: MatchMoneyRewardInput): MatchMoneyRewardResult {
  const {
    gameMode,
    didWin,
    isDraw = false,
    goalsFor,
    goalsAgainst,
    isMercyRule = false,
    tournamentRound = 0,
    tournamentTier = 'CUP_100',
  } = input;

  if (gameMode === 'TOURNAMENT') {
    const tierCfg = TOURNAMENT_TIERS[tournamentTier] || TOURNAMENT_TIERS.CUP_100;
    const mult = tierCfg.rewardMultiplier;
    const clampedRound = Math.max(0, Math.min(2, tournamentRound));

    // Base match pay by round (QF = $15*mult, SF = $25*mult, Final = $50*mult)
    const basePay = (clampedRound === 2 ? 50 : clampedRound === 1 ? 25 : 15) * mult;

    // Win bonus by round so QF Win = $75*mult, SF Win = $125*mult, Final Champion Win = $300*mult (Total = $500 / $5,000 / $50,000!)
    const winBonus = didWin
      ? (clampedRound === 2 ? 250 : clampedRound === 1 ? 100 : 60) * mult
      : isDraw
        ? 10 * mult
        : 0;

    const goalBonus = Math.max(0, goalsFor) * 5 * mult;
    let specialBonus = 0;
    if (didWin && isMercyRule) specialBonus += 10 * mult;
    if (didWin && goalsAgainst === 0 && goalsFor > 0) specialBonus += 5 * mult;

    const totalReward = basePay + winBonus + goalBonus + specialBonus;
    const modeMultiplierLabel =
      clampedRound >= 2
        ? `${tierCfg.shortName.toUpperCase()} FINAL`
        : clampedRound === 1
          ? `${tierCfg.shortName.toUpperCase()} SEMI`
          : `${tierCfg.shortName.toUpperCase()} QF`;

    return {
      totalReward,
      basePay,
      winBonus,
      goalBonus,
      specialBonus,
      modeMultiplierLabel,
      summaryText: `+$${totalReward.toLocaleString()} ${modeMultiplierLabel} PRIZE`,
    };
  }

  // Casual & Ranked match payouts
  const basePay = gameMode === 'RANKED' ? 10 : 6;
  const winBonus = didWin ? (gameMode === 'RANKED' ? 16 : 10) : isDraw ? 4 : 0;
  const perGoalRate = gameMode === 'RANKED' ? 4 : 3;
  const goalBonus = Math.max(0, goalsFor) * perGoalRate;

  let specialBonus = 0;
  if (didWin && isMercyRule) specialBonus += 8;
  if (didWin && goalsAgainst === 0 && goalsFor > 0) specialBonus += 5;

  const totalReward = basePay + winBonus + goalBonus + specialBonus;
  const modeMultiplierLabel = gameMode === 'RANKED' ? 'RANKED STAKES' : 'CASUAL MATCH PAY';
  const spinsEarned = Math.floor(totalReward / SLOT_SPIN_COST);
  const summaryText =
    spinsEarned >= 1
      ? `+$${totalReward} EARNED (${spinsEarned} POKIE SPIN${spinsEarned > 1 ? 'S' : ''})`
      : `+$${totalReward} MATCH CASH`;

  return {
    totalReward,
    basePay,
    winBonus,
    goalBonus,
    specialBonus,
    modeMultiplierLabel,
    summaryText,
  };
}

export interface CouponRedemptionResult {
  valid: boolean;
  normalizedCode: string;
  rewardAmount: number;
  spinsGranted: number;
  newBalance: number;
  message: string;
}

/**
 * Validates a profile coupon code. Entering "HACK" grants enough money for 10 spins ($100).
 */
export function redeemCouponCode(rawCode: string, currentBalance: number): CouponRedemptionResult {
  const normalizedCode = (rawCode || '').trim().toUpperCase();
  if (normalizedCode === COUPON_HACK_CODE) {
    const rewardAmount = COUPON_HACK_REWARD;
    const newBalance = Math.max(0, currentBalance) + rewardAmount;
    return {
      valid: true,
      normalizedCode,
      rewardAmount,
      spinsGranted: COUPON_HACK_SPINS,
      newBalance,
      message: `COUPON "HACK" APPLIED! +$${rewardAmount} (${COUPON_HACK_SPINS} SPINS) ADDED!`,
    };
  }
  return {
    valid: false,
    normalizedCode,
    rewardAmount: 0,
    spinsGranted: 0,
    newBalance: Math.max(0, currentBalance),
    message: normalizedCode ? `INVALID COUPON "${normalizedCode}"` : 'ENTER A COUPON CODE',
  };
}

export type PokieSymbolId =
  | 'MEGA_TROPHY'
  | 'WILD_STAR'
  | 'DIAMOND_BALL'
  | 'GOLD_BOOT'
  | 'FIRE_FLAME'
  | 'WHISTLE'
  | 'CHERRY_CARD'
  | 'SCATTER_CROWN';

export interface PokieSymbolSpec {
  id: PokieSymbolId;
  name: string;
  icon: string;
  color: string;
  bgHex: string;
  borderHex: string;
  payout3x: number; // Multiplier on total bet for 3-of-a-kind on a payline (or 3 scatters)
  payout2x: number; // Multiplier on total bet for 2-of-a-kind from left (or 2 scatters)
  isWild?: boolean;
  isScatter?: boolean;
  isJackpot?: boolean;
}

export const POKIE_SYMBOLS: Record<PokieSymbolId, PokieSymbolSpec> = {
  MEGA_TROPHY: {
    id: 'MEGA_TROPHY',
    name: 'GRAND CUP',
    icon: '🏆',
    color: '#fde047',
    bgHex: '#422006',
    borderHex: '#facc15',
    payout3x: 100, // Grand Jackpot trigger!
    payout2x: 0,
    isJackpot: true,
  },
  WILD_STAR: {
    id: 'WILD_STAR',
    name: '2X WILD STAR',
    icon: '⭐',
    color: '#38bdf8',
    bgHex: '#082f49',
    borderHex: '#38bdf8',
    payout3x: 40,
    payout2x: 0,
    isWild: true,
  },
  DIAMOND_BALL: {
    id: 'DIAMOND_BALL',
    name: 'GOLDEN BALL',
    icon: '⚽',
    color: '#f8fafc',
    bgHex: '#1e293b',
    borderHex: '#94a3b8',
    payout3x: 20,
    payout2x: 0,
  },
  GOLD_BOOT: {
    id: 'GOLD_BOOT',
    name: 'STRIKER BOOT',
    icon: '👟',
    color: '#fb923c',
    bgHex: '#431407',
    borderHex: '#f97316',
    payout3x: 12,
    payout2x: 0,
  },
  FIRE_FLAME: {
    id: 'FIRE_FLAME',
    name: 'SUPER FLOW',
    icon: '🔥',
    color: '#f43f5e',
    bgHex: '#4c0519',
    borderHex: '#fb7185',
    payout3x: 6,
    payout2x: 0,
  },
  WHISTLE: {
    id: 'WHISTLE',
    name: 'REF WHISTLE',
    icon: '📯',
    color: '#a7f3d0',
    bgHex: '#064e3b',
    borderHex: '#34d399',
    payout3x: 3,
    payout2x: 0,
  },
  CHERRY_CARD: {
    id: 'CHERRY_CARD',
    name: 'LUCKY CHERRY',
    icon: '🍒',
    color: '#fda4af',
    bgHex: '#3b0764',
    borderHex: '#e879f9',
    payout3x: 2,
    payout2x: 1, // Pays 1x bet for 2-of-a-kind on any payline (classic pokie hit-frequency booster)
  },
  SCATTER_CROWN: {
    id: 'SCATTER_CROWN',
    name: 'HOLD & SPIN ORB',
    icon: '👑',
    color: '#fcd34d',
    bgHex: '#311042',
    borderHex: '#f472b6',
    payout3x: 15, // 3+ anywhere pays 15x bet AND triggers Hold & Spin Feature!
    payout2x: 1,  // 2 anywhere on the 3x3 window pays 1x bet
    isScatter: true,
  },
};

/**
 * Real PAR-sheet weighted virtual reel strips (24 stops per reel).
 * High-frequency low symbols keep hit rate ~36%, while 3+ SCATTER_CROWN orbs trigger Hold & Spin Bonus Mode.
 */
export const VIRTUAL_REEL_STRIPS: [PokieSymbolId[], PokieSymbolId[], PokieSymbolId[]] = [
  // Reel 1 (Left)
  [
    'CHERRY_CARD', 'WHISTLE', 'FIRE_FLAME', 'CHERRY_CARD', 'GOLD_BOOT', 'WHISTLE',
    'SCATTER_CROWN', 'CHERRY_CARD', 'FIRE_FLAME', 'DIAMOND_BALL', 'WHISTLE', 'SCATTER_CROWN',
    'WILD_STAR', 'FIRE_FLAME', 'CHERRY_CARD', 'WHISTLE', 'GOLD_BOOT', 'CHERRY_CARD',
    'MEGA_TROPHY', 'WHISTLE', 'FIRE_FLAME', 'SCATTER_CROWN', 'DIAMOND_BALL', 'CHERRY_CARD',
  ],
  // Reel 2 (Center)
  [
    'WHISTLE', 'CHERRY_CARD', 'FIRE_FLAME', 'GOLD_BOOT', 'CHERRY_CARD', 'SCATTER_CROWN',
    'WHISTLE', 'DIAMOND_BALL', 'CHERRY_CARD', 'FIRE_FLAME', 'SCATTER_CROWN', 'WILD_STAR',
    'CHERRY_CARD', 'GOLD_BOOT', 'WHISTLE', 'FIRE_FLAME', 'CHERRY_CARD', 'MEGA_TROPHY',
    'WHISTLE', 'SCATTER_CROWN', 'CHERRY_CARD', 'DIAMOND_BALL', 'FIRE_FLAME', 'WHISTLE',
  ],
  // Reel 3 (Right)
  [
    'FIRE_FLAME', 'CHERRY_CARD', 'WHISTLE', 'GOLD_BOOT', 'CHERRY_CARD', 'WHISTLE',
    'SCATTER_CROWN', 'FIRE_FLAME', 'CHERRY_CARD', 'DIAMOND_BALL', 'WHISTLE', 'SCATTER_CROWN',
    'FIRE_FLAME', 'WILD_STAR', 'WHISTLE', 'CHERRY_CARD', 'GOLD_BOOT', 'FIRE_FLAME',
    'MEGA_TROPHY', 'CHERRY_CARD', 'WHISTLE', 'SCATTER_CROWN', 'DIAMOND_BALL', 'WHISTLE',
  ],
];

export interface PokiePaylineDefinition {
  id: number;
  name: string;
  color: string;
  /** Row index (0 = Top, 1 = Middle, 2 = Bottom) for [Reel0, Reel1, Reel2] */
  rows: [number, number, number];
}

export const POKIE_PAYLINES: PokiePaylineDefinition[] = [
  { id: 1, name: 'CENTER LINE', color: '#fde047', rows: [1, 1, 1] },
  { id: 2, name: 'TOP LINE', color: '#38bdf8', rows: [0, 0, 0] },
  { id: 3, name: 'BOTTOM LINE', color: '#fb7185', rows: [2, 2, 2] },
  { id: 4, name: 'DIAG DOWN', color: '#34d399', rows: [0, 1, 2] },
  { id: 5, name: 'DIAG UP', color: '#e879f9', rows: [2, 1, 0] },
];

export interface PokieWinningLine {
  lineId: number;
  lineName: string;
  color: string;
  symbol: PokieSymbolId;
  matchCount: 2 | 3;
  hasWildMultiplier: boolean;
  payout: number;
  rows: [number, number, number];
}

export type PokieWinTier = 'NONE' | 'SMALL' | 'BIG' | 'MEGA' | 'JACKPOT';

export interface PokieEvaluationResult {
  /** 3x3 matrix indexed as grid[reelIdx][rowIdx] where rowIdx 0=top, 1=mid, 2=bot */
  grid: [
    [PokieSymbolId, PokieSymbolId, PokieSymbolId],
    [PokieSymbolId, PokieSymbolId, PokieSymbolId],
    [PokieSymbolId, PokieSymbolId, PokieSymbolId]
  ];
  stopIndices: [number, number, number];
  machineId: PokieMachineId;
  betAmount: number;
  totalPayout: number;
  netProfit: number;
  winTier: PokieWinTier;
  isJackpot: boolean;
  triggersHoldAndSpin: boolean;
  winningLines: PokieWinningLine[];
  scatterCount: number;
  scatterPayout: number;
  scatterPositions: { reel: number; row: number }[];
  isTeaserTwoReels: boolean;
  updatedJackpotPool: number;
  headline: string;
}

/**
 * Extracts a 3x3 visible symbol window from 3 virtual reel stop indices (representing the middle row stop on each reel).
 */
export function getPokieGridFromStops(
  stops: [number, number, number]
): [
  [PokieSymbolId, PokieSymbolId, PokieSymbolId],
  [PokieSymbolId, PokieSymbolId, PokieSymbolId],
  [PokieSymbolId, PokieSymbolId, PokieSymbolId]
] {
  const buildColumn = (reelIdx: 0 | 1 | 2, midStop: number): [PokieSymbolId, PokieSymbolId, PokieSymbolId] => {
    const strip = VIRTUAL_REEL_STRIPS[reelIdx];
    const len = strip.length;
    const normMid = ((midStop % len) + len) % len;
    const topIdx = (normMid - 1 + len) % len;
    const botIdx = (normMid + 1) % len;
    return [strip[topIdx], strip[normMid], strip[botIdx]];
  };

  return [
    buildColumn(0, stops[0]),
    buildColumn(1, stops[1]),
    buildColumn(2, stops[2]),
  ];
}

/**
 * Evaluates a 3x3 pokie symbol grid using authentic 5-payline + Scatter + 2x Wild Star + Progressive Grand Jackpot + Hold & Spin trigger math.
 */
export function evaluatePokieGrid(
  grid: [
    [PokieSymbolId, PokieSymbolId, PokieSymbolId],
    [PokieSymbolId, PokieSymbolId, PokieSymbolId],
    [PokieSymbolId, PokieSymbolId, PokieSymbolId]
  ],
  betAmount = SLOT_SPIN_COST,
  currentJackpotPool = BASE_JACKPOT_POOL,
  stopIndices: [number, number, number] = [0, 0, 0],
  machineId: PokieMachineId = 'VOLCANO_INFERNO'
): PokieEvaluationResult {
  const machine = POKIE_MACHINES[machineId] || POKIE_MACHINES.VOLCANO_INFERNO;
  const winningLines: PokieWinningLine[] = [];
  let totalPayout = 0;
  let isJackpot = false;
  let isTeaserTwoReels = false;

  // Progressive jackpot pool grows by 20% of each bet prior to evaluation
  let updatedJackpotPool = Math.round(currentJackpotPool + Math.max(1, betAmount * 0.2));

  // 1. Evaluate all 5 active paylines
  for (const line of POKIE_PAYLINES) {
    const s0 = grid[0][line.rows[0]];
    const s1 = grid[1][line.rows[1]];
    const s2 = grid[2][line.rows[2]];
    const lineSyms = [s0, s1, s2];

    // Check if first 2 reels align on a high-value symbol or wild (triggers Reel 3 teaser drumroll!)
    if (
      (s0 === s1 && s0 !== 'SCATTER_CROWN' && s0 !== 'CHERRY_CARD') ||
      (s0 === 'WILD_STAR' && s1 !== 'SCATTER_CROWN') ||
      (s1 === 'WILD_STAR' && s0 !== 'SCATTER_CROWN')
    ) {
      isTeaserTwoReels = true;
    }

    // Scatters do not form line wins; they pay anywhere
    if (s0 === 'SCATTER_CROWN') continue;

    // Determine target base symbol for the line (first non-wild symbol, or WILD_STAR if all wilds)
    let baseSym: PokieSymbolId = 'WILD_STAR';
    for (const sym of lineSyms) {
      if (sym !== 'WILD_STAR') {
        baseSym = sym;
        break;
      }
    }

    const spec = POKIE_SYMBOLS[baseSym];
    // MEGA_TROPHY cannot be substituted by WILD_STAR for the Grand Jackpot (pure 3x Trophy = Grand Jackpot, with Wild = 40x Major)
    const canSubWild = baseSym !== 'SCATTER_CROWN' && baseSym !== 'MEGA_TROPHY';

    const matchesReel = (sym: PokieSymbolId) =>
      sym === baseSym || (canSubWild && sym === 'WILD_STAR');

    if (s0 === 'MEGA_TROPHY' && s1 === 'MEGA_TROPHY' && s2 === 'MEGA_TROPHY') {
      // Pure 3x Trophy hits the progressive Grand Jackpot!
      isJackpot = true;
      const jpWin = Math.max(betAmount * machine.jackpotMultiplier, updatedJackpotPool);
      totalPayout += jpWin;
      winningLines.push({
        lineId: line.id,
        lineName: line.name,
        color: line.color,
        symbol: 'MEGA_TROPHY',
        matchCount: 3,
        hasWildMultiplier: false,
        payout: jpWin,
        rows: line.rows,
      });
    } else if (matchesReel(s0) && matchesReel(s1) && matchesReel(s2)) {
      const hasWildSub = baseSym !== 'WILD_STAR' && lineSyms.includes('WILD_STAR');
      // Wild Star substitution doubles the payline win (classic pokie 2x Wild rule)
      const wildMult = hasWildSub ? 2 : 1;
      const lineWin = betAmount * spec.payout3x * wildMult;
      totalPayout += lineWin;
      winningLines.push({
        lineId: line.id,
        lineName: line.name,
        color: line.color,
        symbol: baseSym,
        matchCount: 3,
        hasWildMultiplier: hasWildSub,
        payout: lineWin,
        rows: line.rows,
      });
    } else if (matchesReel(s0) && matchesReel(s1) && spec.payout2x > 0) {
      const hasWildSub = baseSym !== 'WILD_STAR' && (s0 === 'WILD_STAR' || s1 === 'WILD_STAR');
      const wildMult = hasWildSub ? 2 : 1;
      const lineWin = betAmount * spec.payout2x * wildMult;
      totalPayout += lineWin;
      winningLines.push({
        lineId: line.id,
        lineName: line.name,
        color: line.color,
        symbol: baseSym,
        matchCount: 2,
        hasWildMultiplier: hasWildSub,
        payout: lineWin,
        rows: line.rows,
      });
    }
  }

  // 2. Evaluate Anywhere Crown Scatters (Hold & Spin Bonus Orbs) across all 9 cells
  const scatterPositions: { reel: number; row: number }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let row = 0; row < 3; row++) {
      if (grid[r][row] === 'SCATTER_CROWN') {
        scatterPositions.push({ reel: r, row });
      }
    }
  }
  const scatterCount = scatterPositions.length;
  const scatterSpec = POKIE_SYMBOLS.SCATTER_CROWN;
  let scatterPayout = 0;
  if (scatterCount >= 3) {
    scatterPayout = betAmount * scatterSpec.payout3x;
  } else if (scatterCount === 2) {
    scatterPayout = betAmount * scatterSpec.payout2x;
  }
  totalPayout += scatterPayout;

  // 3+ Scatter Crown Orbs anywhere triggers the dedicated HOLD & SPIN Bonus Screen!
  const triggersHoldAndSpin = scatterCount >= 3;

  // Check if reels 1 & 2 have 2 scatters (teaser for 3rd scatter!)
  const scattersInFirstTwoReels = scatterPositions.filter((p) => p.reel < 2).length;
  if (scattersInFirstTwoReels >= 2) {
    isTeaserTwoReels = true;
  }

  if (isJackpot) {
    const betScale = Math.max(1, betAmount / 10);
    updatedJackpotPool = Math.round(machine.baseJackpot10 * betScale);
  }

  const mult = betAmount > 0 ? totalPayout / betAmount : 0;
  const winTier: PokieWinTier = isJackpot
    ? 'JACKPOT'
    : triggersHoldAndSpin || mult >= 20
      ? 'MEGA'
      : mult >= 6
        ? 'BIG'
        : totalPayout > 0
          ? 'SMALL'
          : 'NONE';

  const headline = isJackpot
    ? `🏆 GRAND JACKPOT! +$${totalPayout.toLocaleString()}! 🏆`
    : triggersHoldAndSpin
      ? `👑 HOLD & SPIN TRIGGERED! +$${totalPayout.toLocaleString()} + 3 RESPINS! 👑`
      : winTier === 'MEGA'
        ? `🔥 MEGA PAYDAY! +$${totalPayout.toLocaleString()}! 🔥`
        : winTier === 'BIG'
          ? `⚡ BIG WIN! +$${totalPayout.toLocaleString()}! ⚡`
          : winTier === 'SMALL'
            ? `💰 WINNER! +$${totalPayout.toLocaleString()}`
            : isTeaserTwoReels
              ? 'SO CLOSE! SPIN AGAIN!'
              : 'NO WIN • TRY AGAIN!';

  return {
    grid,
    stopIndices,
    machineId,
    betAmount,
    totalPayout,
    netProfit: totalPayout - betAmount,
    winTier,
    isJackpot,
    triggersHoldAndSpin,
    winningLines,
    scatterCount,
    scatterPayout,
    scatterPositions,
    isTeaserTwoReels,
    updatedJackpotPool,
    headline,
  };
}

/**
 * Spins the 3 virtual reels using either an RNG function or explicit forced stop indices (for deterministic testing).
 */
export function spinPokieReels(
  betAmount = SLOT_SPIN_COST,
  currentJackpotPool = BASE_JACKPOT_POOL,
  rng: () => number = Math.random,
  forcedStops?: [number, number, number],
  machineId: PokieMachineId = 'VOLCANO_INFERNO'
): PokieEvaluationResult {
  const stops: [number, number, number] = forcedStops
    ? [forcedStops[0], forcedStops[1], forcedStops[2]]
    : [
        Math.floor(rng() * VIRTUAL_REEL_STRIPS[0].length),
        Math.floor(rng() * VIRTUAL_REEL_STRIPS[1].length),
        Math.floor(rng() * VIRTUAL_REEL_STRIPS[2].length),
      ];
  const grid = getPokieGridFromStops(stops);
  return evaluatePokieGrid(grid, betAmount, currentJackpotPool, stops, machineId);
}

// ============================================================================
// HOLD & SPIN (HOLD & WIN) BONUS FEATURE STATE MACHINE
// ============================================================================

export type HoldOrbTier = 'CASH' | 'MINI' | 'MAJOR' | 'MEGA';

export interface HoldAndSpinOrb {
  reel: number;
  row: number;
  tier: HoldOrbTier;
  label: string;
  multiplier: number;
  cashValue: number;
  isNew?: boolean;
}

export interface HoldAndSpinSessionState {
  machineId: PokieMachineId;
  betAmount: number;
  grandJackpotPool: number;
  respinsRemaining: number;
  maxRespins: number;
  totalRespinsPlayed: number;
  /** 3x3 matrix indexed as cells[reel][row] */
  cells: (HoldAndSpinOrb | null)[][];
  lockedCount: number;
  orbsTotalValue: number;
  grandJackpotWon: boolean;
  totalBonusWin: number;
  isComplete: boolean;
  lastStepNewOrbs: HoldAndSpinOrb[];
}

const HOLD_ORB_WEIGHTED_TABLE: { tier: HoldOrbTier; label: string; multiplier: number; weight: number }[] = [
  { tier: 'CASH', label: '1X CASH', multiplier: 1, weight: 28 },
  { tier: 'CASH', label: '2X CASH', multiplier: 2, weight: 25 },
  { tier: 'CASH', label: '3X CASH', multiplier: 3, weight: 18 },
  { tier: 'CASH', label: '5X CASH', multiplier: 5, weight: 12 },
  { tier: 'CASH', label: '8X CASH', multiplier: 8, weight: 7 },
  { tier: 'MINI', label: 'MINI 15X', multiplier: 15, weight: 6 },
  { tier: 'MAJOR', label: 'MAJOR 30X', multiplier: 30, weight: 3 },
  { tier: 'MEGA', label: 'MEGA 50X', multiplier: 50, weight: 1 },
];

export function rollHoldAndSpinOrb(
  reel: number,
  row: number,
  betAmount: number,
  rng: () => number = Math.random
): HoldAndSpinOrb {
  const totalWeight = HOLD_ORB_WEIGHTED_TABLE.reduce((acc, item) => acc + item.weight, 0);
  let pick = rng() * totalWeight;
  let chosen = HOLD_ORB_WEIGHTED_TABLE[0];
  for (const entry of HOLD_ORB_WEIGHTED_TABLE) {
    if (pick < entry.weight) {
      chosen = entry;
      break;
    }
    pick -= entry.weight;
  }
  return {
    reel,
    row,
    tier: chosen.tier,
    label: chosen.label,
    multiplier: chosen.multiplier,
    cashValue: Math.round(betAmount * chosen.multiplier),
    isNew: true,
  };
}

/**
 * Initializes a Hold & Spin (Hold & Win) bonus session from triggering orb positions (minimum 3 orbs).
 */
export function createHoldAndSpinSession(opts: {
  machineId: PokieMachineId;
  betAmount: number;
  grandJackpotPool: number;
  triggerPositions?: { reel: number; row: number }[];
  rng?: () => number;
}): HoldAndSpinSessionState {
  const {
    machineId,
    betAmount,
    grandJackpotPool,
    triggerPositions,
    rng = Math.random,
  } = opts;

  const cells: (HoldAndSpinOrb | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];

  const defaultPositions =
    triggerPositions && triggerPositions.length >= 3
      ? triggerPositions
      : [
          { reel: 0, row: 1 },
          { reel: 1, row: 1 },
          { reel: 2, row: 1 },
        ];

  let lockedCount = 0;
  let orbsTotalValue = 0;
  const initialOrbs: HoldAndSpinOrb[] = [];

  for (const pos of defaultPositions) {
    const r = Math.max(0, Math.min(2, pos.reel));
    const row = Math.max(0, Math.min(2, pos.row));
    if (!cells[r][row]) {
      const orb = rollHoldAndSpinOrb(r, row, betAmount, rng);
      cells[r][row] = orb;
      initialOrbs.push(orb);
      lockedCount++;
      orbsTotalValue += orb.cashValue;
    }
  }

  const grandJackpotWon = lockedCount >= 9;
  const totalBonusWin = orbsTotalValue + (grandJackpotWon ? grandJackpotPool : 0);

  return {
    machineId,
    betAmount,
    grandJackpotPool,
    respinsRemaining: 3,
    maxRespins: 3,
    totalRespinsPlayed: 0,
    cells,
    lockedCount,
    orbsTotalValue,
    grandJackpotWon,
    totalBonusWin,
    isComplete: grandJackpotWon,
    lastStepNewOrbs: initialOrbs,
  };
}

/**
 * Executes a single Respin in the Hold & Spin bonus mode.
 * Each unlocked cell has a chance to land a new Bonus Orb.
 * If 1+ new orbs land, they lock in place and `respinsRemaining` resets to 3!
 * If all 9 cells lock, the player wins the Grand Progressive Jackpot on top of all orb prizes!
 */
export function stepHoldAndSpinSession(
  session: HoldAndSpinSessionState,
  rng: () => number = Math.random,
  forceFillAll = false
): HoldAndSpinSessionState {
  if (session.isComplete || session.respinsRemaining <= 0) {
    return session;
  }

  const nextCells: (HoldAndSpinOrb | null)[][] = session.cells.map((col) =>
    col.map((cell) => (cell ? { ...cell, isNew: false } : null))
  );

  const newOrbs: HoldAndSpinOrb[] = [];
  // Per-empty-cell hit probability (~26% per empty cell gives realistic ~65% chance of resetting on 3-4 empty cells)
  const cellHitProb = 0.26;

  for (let r = 0; r < 3; r++) {
    for (let row = 0; row < 3; row++) {
      if (!nextCells[r][row]) {
        if (forceFillAll || rng() < cellHitProb) {
          const orb = rollHoldAndSpinOrb(r, row, session.betAmount, rng);
          nextCells[r][row] = orb;
          newOrbs.push(orb);
        }
      }
    }
  }

  let lockedCount = 0;
  let orbsTotalValue = 0;
  for (let r = 0; r < 3; r++) {
    for (let row = 0; row < 3; row++) {
      const c = nextCells[r][row];
      if (c) {
        lockedCount++;
        orbsTotalValue += c.cashValue;
      }
    }
  }

  const grandJackpotWon = lockedCount >= 9;
  const respinsRemaining = grandJackpotWon
    ? 0
    : newOrbs.length > 0
      ? session.maxRespins // Resets to 3 whenever a new orb locks!
      : Math.max(0, session.respinsRemaining - 1);

  const isComplete = grandJackpotWon || respinsRemaining === 0;
  const totalBonusWin = orbsTotalValue + (grandJackpotWon ? session.grandJackpotPool : 0);

  return {
    ...session,
    cells: nextCells,
    respinsRemaining,
    totalRespinsPlayed: session.totalRespinsPlayed + 1,
    lockedCount,
    orbsTotalValue,
    grandJackpotWon,
    totalBonusWin,
    isComplete,
    lastStepNewOrbs: newOrbs,
  };
}

// ============================================================================
// 30-SECOND SUDDEN-DEATH JACKPOT GOAL CHALLENGE
// ============================================================================

export const JACKPOT_CHALLENGE_DURATION_SECONDS = 30;

export type JackpotChallengeType = 'HOLD_AND_SPIN' | 'GRAND_JACKPOT';

export interface JackpotChallengeState {
  active: boolean;
  challengeType: JackpotChallengeType;
  machineId: PokieMachineId;
  machineName: string;
  stadiumName: string;
  pitchThemeId: PitchThemeId;
  betAmount: PokieBetAmount;
  jackpotPrize: number;
  durationSeconds: number;
  triggerPositions?: { reel: number; row: number }[];
}

export interface JackpotChallengeOutcome {
  ended: boolean;
  didWinJackpot: boolean;
  unlocksHoldAndSpin: boolean;
  payout: number;
  reason: string;
  headline: string;
  subtext: string;
}

/**
 * Creates a 30-second sudden-death Jackpot Goal Challenge state coinciding with the pokie machine's stadium theme.
 * Supports both 'HOLD_AND_SPIN' (must score in 30s to enter the Hold & Spin bonus screen) and 'GRAND_JACKPOT'.
 */
export function createJackpotChallengeState(
  machineId: PokieMachineId,
  betAmount: PokieBetAmount,
  jackpotPrize?: number,
  challengeType: JackpotChallengeType = 'GRAND_JACKPOT',
  triggerPositions?: { reel: number; row: number }[]
): JackpotChallengeState {
  const machine = POKIE_MACHINES[machineId] || POKIE_MACHINES.CHAMPIONS_GOLD;
  const effectivePrize =
    typeof jackpotPrize === 'number' && jackpotPrize > 0
      ? Math.round(jackpotPrize)
      : getMachineEffectiveJackpot(machineId, betAmount);
  return {
    active: true,
    challengeType,
    machineId,
    machineName: machine.name,
    stadiumName: machine.stadiumName,
    pitchThemeId: machine.pitchThemeId,
    betAmount,
    jackpotPrize: effectivePrize,
    durationSeconds: JACKPOT_CHALLENGE_DURATION_SECONDS,
    triggerPositions: triggerPositions ? [...triggerPositions] : undefined,
  };
}

/**
 * Evaluates the live 30-second Jackpot Goal Challenge match:
 * - Score 1 goal (`scoreYou > 0`) within 30s -> WIN! Either unlocks Hold & Spin screen or awards the 100% Grand Jackpot!
 * - Concede 1 goal (`scoreAi > 0`) -> LOSE the bonus / Jackpot ($0)!
 * - 30s timer expires (`matchTimeRemaining <= 0`) -> LOSE the bonus / Jackpot ($0)!
 */
export function evaluateJackpotChallengeOutcome(
  state: JackpotChallengeState,
  scoreYou: number,
  scoreAi: number,
  matchTimeRemaining: number
): JackpotChallengeOutcome {
  if (!state.active) {
    return {
      ended: false,
      didWinJackpot: false,
      unlocksHoldAndSpin: false,
      payout: 0,
      reason: '',
      headline: '',
      subtext: '',
    };
  }
  const isHoldAndSpinGate = state.challengeType === 'HOLD_AND_SPIN';
  if (scoreYou > 0) {
    if (isHoldAndSpinGate) {
      return {
        ended: true,
        didWinJackpot: true,
        unlocksHoldAndSpin: true,
        payout: 0,
        reason: 'HOLD & SPIN UNLOCKED!',
        headline: `👑 HOLD & SPIN UNLOCKED!`,
        subtext: `You scored in ${state.stadiumName} within 30s! Entering the ${state.machineName} Hold & Spin Bonus Screen now!`,
      };
    }
    return {
      ended: true,
      didWinJackpot: true,
      unlocksHoldAndSpin: false,
      payout: state.jackpotPrize,
      reason: 'JACKPOT GOAL SCORED!',
      headline: `🏆 JACKPOT WON! +$${state.jackpotPrize.toLocaleString()}!`,
      subtext: `You scored in ${state.stadiumName} within 30s and claimed the $${state.jackpotPrize.toLocaleString()} ${state.machineName} Jackpot!`,
    };
  }
  if (scoreAi > 0) {
    return {
      ended: true,
      didWinJackpot: false,
      unlocksHoldAndSpin: false,
      payout: 0,
      reason: isHoldAndSpinGate ? 'CONCEDED GOAL — HOLD & SPIN LOST!' : 'CONCEDED GOAL — JACKPOT LOST!',
      headline: isHoldAndSpinGate ? '💔 HOLD & SPIN LOST! GOAL CONCEDED' : '💔 JACKPOT LOST! GOAL CONCEDED',
      subtext: isHoldAndSpinGate
        ? `You conceded a goal in ${state.stadiumName}! Your Hold & Spin Bonus Screen entry was forfeited.`
        : `You conceded a goal in ${state.stadiumName}! The $${state.jackpotPrize.toLocaleString()} Jackpot was forfeited.`,
    };
  }
  if (matchTimeRemaining <= 0) {
    return {
      ended: true,
      didWinJackpot: false,
      unlocksHoldAndSpin: false,
      payout: 0,
      reason: isHoldAndSpinGate ? '30s EXPIRED — HOLD & SPIN LOST!' : '30s EXPIRED — JACKPOT LOST!',
      headline: isHoldAndSpinGate ? '⏱️ TIME UP! HOLD & SPIN LOST' : '⏱️ TIME UP! JACKPOT LOST',
      subtext: isHoldAndSpinGate
        ? `30 seconds expired before you scored a goal! Your Hold & Spin Bonus Screen entry slipped away.`
        : `30 seconds expired before you scored a goal! The $${state.jackpotPrize.toLocaleString()} Jackpot slipped away.`,
    };
  }
  return {
    ended: false,
    didWinJackpot: false,
    unlocksHoldAndSpin: false,
    payout: 0,
    reason: '',
    headline: '',
    subtext: '',
  };
}

// ============================================================================
// CLUB SHOP (STADIUM & POKIE MACHINE UNLOCKS) & ONLINE LEADERBOARD LOGIC
// ============================================================================

export const DEFAULT_UNLOCKED_STADIUMS: readonly PitchThemeId[] = ['CLASSIC_TURF'] as const;
export const DEFAULT_UNLOCKED_POKIES: readonly PokieMachineId[] = ['CHAMPIONS_GOLD'] as const;

export interface ShopStadiumItem {
  id: PitchThemeId;
  name: string;
  subtitle: string;
  price: number;
  tierLabel: string;
  accentHex: string;
  bgHex: string;
}

export const SHOP_STADIUM_ITEMS: readonly ShopStadiumItem[] = [
  {
    id: 'CLASSIC_TURF',
    name: 'Sunlit Turf',
    subtitle: 'Royal Botanical Park • Starter Arena',
    price: 0,
    tierLabel: 'STARTER',
    accentHex: '#22c55e',
    bgHex: '#dcfce7',
  },
  {
    id: 'URBAN_CONCRETE',
    name: 'Urban Street Concrete',
    subtitle: 'Downtown Rooftop Block Party',
    price: 200,
    tierLabel: 'STREET',
    accentHex: '#f59e0b',
    bgHex: '#fef3c7',
  },
  {
    id: 'RIO_CLAY',
    name: 'Copacabana Sunset Clay',
    subtitle: 'Rio Beach Carnival Court',
    price: 600,
    tierLabel: 'BEACH',
    accentHex: '#f97316',
    bgHex: '#ffedd5',
  },
  {
    id: 'TURF_AUTUMN',
    name: 'Autumn Harvest Turf',
    subtitle: 'Golden Maple Park',
    price: 1800,
    tierLabel: 'CLUB',
    accentHex: '#84cc16',
    bgHex: '#ecfccb',
  },
  {
    id: 'TURF_SAKURA',
    name: 'Sakura Blossom Turf',
    subtitle: 'Kyoto Imperial Zen Garden',
    price: 4500,
    tierLabel: 'IMPERIAL',
    accentHex: '#ec4899',
    bgHex: '#fce7f3',
  },
  {
    id: 'ARCTIC_ICE',
    name: 'Glacier Frost Arena',
    subtitle: 'Sub-Zero Aurora Fjord',
    price: 10000,
    tierLabel: 'PRO',
    accentHex: '#06b6d4',
    bgHex: '#cffafe',
  },
  {
    id: 'TURF_CHAMPIONS',
    name: 'Champions Cathedral',
    subtitle: 'European Floodlit Trophy Arena',
    price: 22000,
    tierLabel: 'ELITE',
    accentHex: '#3b82f6',
    bgHex: '#dbeafe',
  },
  {
    id: 'TWILIGHT_SYNTH',
    name: 'Twilight Synthwave',
    subtitle: 'Cyberpunk Outrun Laser Grid',
    price: 40000,
    tierLabel: 'MASTER',
    accentHex: '#a855f7',
    bgHex: '#f3e8ff',
  },
  {
    id: 'VOLCANO_FORGE',
    name: 'Magma Caldera Citadel',
    subtitle: 'Molten Obsidian Dragon Forge',
    price: 65000,
    tierLabel: 'LEGEND',
    accentHex: '#ef4444',
    bgHex: '#fee2e2',
  },
  {
    id: 'COSMIC_SPACE',
    name: 'Cosmic Orbit Station',
    subtitle: 'Zero-G Supernova Orbital Ring',
    price: 100000,
    tierLabel: 'ULTIMATE 100K',
    accentHex: '#0ea5e9',
    bgHex: '#e0f2fe',
  },
] as const;

export interface ShopPokieItem {
  id: PokieMachineId;
  name: string;
  subtitle: string;
  price: number;
  tierLabel: string;
  baseJackpotLabel: string;
  allowedBetsLabel: string;
  accentHex: string;
  bgHex: string;
}

export const SHOP_POKIE_ITEMS: readonly ShopPokieItem[] = [
  {
    id: 'CHAMPIONS_GOLD',
    name: 'Champions Cathedral Pokie',
    subtitle: 'Royal Emerald & Gold • Starter Machine',
    price: 0,
    tierLabel: 'STARTER',
    baseJackpotLabel: '$500 / $5,000',
    allowedBetsLabel: '$10 / $100 Spins',
    accentHex: '#eab308',
    bgHex: '#fef9c3',
  },
  {
    id: 'COSMIC_NEON',
    name: 'Cosmic Orbit Pokie',
    subtitle: 'Zero-G Cyber Supernova Reels',
    price: 1500,
    tierLabel: 'CYBER',
    baseJackpotLabel: '$750 / $7,500',
    allowedBetsLabel: '$10 / $100 Spins',
    accentHex: '#0ea5e9',
    bgHex: '#e0f2fe',
  },
  {
    id: 'VOLCANO_INFERNO',
    name: 'Magma Caldera Pokie',
    subtitle: 'Molten Obsidian Mega-Jackpot',
    price: 12000,
    tierLabel: 'INFERNO',
    baseJackpotLabel: '$1,000 / $10,000',
    allowedBetsLabel: '$10 / $100 Spins',
    accentHex: '#f97316',
    bgHex: '#ffedd5',
  },
  {
    id: 'HIGH_ROLLER_ROYAL',
    name: 'High Roller VIP Vault',
    subtitle: '$1,000 Spin • Diamond VIP Lounge',
    price: 80000,
    tierLabel: 'VIP 80K',
    baseJackpotLabel: '$100,000+',
    allowedBetsLabel: '$1,000 VIP Spins',
    accentHex: '#a855f7',
    bgHex: '#fae8ff',
  },
] as const;

export interface ShopPurchaseResult<T extends string> {
  success: boolean;
  alreadyUnlocked: boolean;
  insufficientFunds: boolean;
  price: number;
  newBalance: number;
  unlockedItems: T[];
  message: string;
}

export function purchaseShopStadium(
  stadiumId: PitchThemeId,
  currentBalance: number,
  unlockedStadiums: readonly PitchThemeId[]
): ShopPurchaseResult<PitchThemeId> {
  const safeBal = Math.max(0, Math.floor(Number.isFinite(currentBalance) ? currentBalance : 0));
  const currentSet = new Set<PitchThemeId>(
    unlockedStadiums && unlockedStadiums.length > 0 ? unlockedStadiums : DEFAULT_UNLOCKED_STADIUMS
  );
  const item = SHOP_STADIUM_ITEMS.find((s) => s.id === stadiumId);
  if (!item) {
    return {
      success: false,
      alreadyUnlocked: false,
      insufficientFunds: false,
      price: 0,
      newBalance: safeBal,
      unlockedItems: Array.from(currentSet),
      message: 'INVALID STADIUM',
    };
  }
  if (currentSet.has(stadiumId)) {
    return {
      success: false,
      alreadyUnlocked: true,
      insufficientFunds: false,
      price: item.price,
      newBalance: safeBal,
      unlockedItems: Array.from(currentSet),
      message: `${item.name.toUpperCase()} IS ALREADY UNLOCKED!`,
    };
  }
  if (safeBal < item.price) {
    return {
      success: false,
      alreadyUnlocked: false,
      insufficientFunds: true,
      price: item.price,
      newBalance: safeBal,
      unlockedItems: Array.from(currentSet),
      message: `NEED $${item.price.toLocaleString()} TO UNLOCK ${item.name.toUpperCase()} (YOU HAVE $${safeBal.toLocaleString()})`,
    };
  }
  currentSet.add(stadiumId);
  const newBalance = safeBal - item.price;
  return {
    success: true,
    alreadyUnlocked: false,
    insufficientFunds: false,
    price: item.price,
    newBalance,
    unlockedItems: Array.from(currentSet),
    message: `🏟️ UNLOCKED ${item.name.toUpperCase()} FOR $${item.price.toLocaleString()}!`,
  };
}

export function purchaseShopPokieMachine(
  machineId: PokieMachineId,
  currentBalance: number,
  unlockedPokies: readonly PokieMachineId[]
): ShopPurchaseResult<PokieMachineId> {
  const safeBal = Math.max(0, Math.floor(Number.isFinite(currentBalance) ? currentBalance : 0));
  const currentSet = new Set<PokieMachineId>(
    unlockedPokies && unlockedPokies.length > 0 ? unlockedPokies : DEFAULT_UNLOCKED_POKIES
  );
  const item = SHOP_POKIE_ITEMS.find((p) => p.id === machineId);
  if (!item) {
    return {
      success: false,
      alreadyUnlocked: false,
      insufficientFunds: false,
      price: 0,
      newBalance: safeBal,
      unlockedItems: Array.from(currentSet),
      message: 'INVALID POKIE MACHINE',
    };
  }
  if (currentSet.has(machineId)) {
    return {
      success: false,
      alreadyUnlocked: true,
      insufficientFunds: false,
      price: item.price,
      newBalance: safeBal,
      unlockedItems: Array.from(currentSet),
      message: `${item.name.toUpperCase()} IS ALREADY UNLOCKED!`,
    };
  }
  if (safeBal < item.price) {
    return {
      success: false,
      alreadyUnlocked: false,
      insufficientFunds: true,
      price: item.price,
      newBalance: safeBal,
      unlockedItems: Array.from(currentSet),
      message: `NEED $${item.price.toLocaleString()} TO UNLOCK ${item.name.toUpperCase()} (YOU HAVE $${safeBal.toLocaleString()})`,
    };
  }
  currentSet.add(machineId);
  const newBalance = safeBal - item.price;
  return {
    success: true,
    alreadyUnlocked: false,
    insufficientFunds: false,
    price: item.price,
    newBalance,
    unlockedItems: Array.from(currentSet),
    message: `🎰 UNLOCKED ${item.name.toUpperCase()} FOR $${item.price.toLocaleString()}!`,
  };
}

export type LeaderboardSortMode = 'RANK' | 'MONEY';

export interface LeaderboardEntry {
  uid: string;
  name: string;
  iconType: 'preset' | 'photo';
  presetIcon: string;
  photoDataUrl: string | null;
  rankedWins: number;
  rankedMatches: number;
  balance: number;
  isSelf?: boolean;
  isOnline?: boolean;
}

/**
 * Deterministically orders player profiles for the Online Leaderboard by either:
 * - 'RANK' (rankedWins descending, tie-broken by balance descending, then name ascending)
 * - 'MONEY' (balance descending, tie-broken by rankedWins descending, then name ascending)
 */
export function sortLeaderboardEntries(
  entries: readonly LeaderboardEntry[],
  sortBy: LeaderboardSortMode
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (sortBy === 'MONEY') {
      if (b.balance !== a.balance) return b.balance - a.balance;
      if (b.rankedWins !== a.rankedWins) return b.rankedWins - a.rankedWins;
      return a.name.localeCompare(b.name);
    }
    if (b.rankedWins !== a.rankedWins) return b.rankedWins - a.rankedWins;
    if (b.balance !== a.balance) return b.balance - a.balance;
    return a.name.localeCompare(b.name);
  });
}

