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
    return inOwnBox ? 108 : 88;
  }
  return inOwnBox ? 88 : 66;
}

/**
 * Computes organic 2D target position (targetX, targetY) and reaction speed factor for the goalkeeper.
 * The keeper shifts reactively toward the ball's current side (covering the near-post angle and stepping
 * slightly off the line), which naturally leaves the far side of the goal open when the attacking team
 * switches play or passes across the box.
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
  const safeBallVy = Number.isFinite(ballVy) ? ballVy : 0;
  const safeFlow = Number.isFinite(flowCombo) ? flowCombo : 0;

  const centerY = PITCH.height / 2;
  const goalHalf = PITCH.goalWidth / 2;
  const patrolLimit = goalHalf - 34;

  const flowBoost = getFlowPassBoost(safeFlow);
  const keeperFlowFactor = !isYou && lastTouchTeam === 'YOU' ? flowBoost.keeperReachScale : 1.0;

  // Distance from ball to this keeper's goal line
  const distToGoalX = isYou ? safeBallX : PITCH.width - safeBallX;
  const proximityRatio = Math.max(0, Math.min(1, 1 - distToGoalX / (PITCH.width * 0.72)));

  // Keeper commits more strongly to the ball's Y side as the ball gets closer to their half
  const trackRatio = (0.52 + proximityRatio * 0.22) * keeperFlowFactor;
  const anticipatedBallY = safeBallY + (isShot ? safeBallVy * 6 : safeBallVy * 2.5);
  const rawDesiredY = centerY + (anticipatedBallY - centerY) * trackRatio;
  const targetY = Math.max(centerY - patrolLimit, Math.min(centerY + patrolLimit, rawDesiredY));

  // Step slightly off the goal line toward the ball to narrow direct shooting angles, while staying in the box
  const stepOutDist = (10 + proximityRatio * 34) * keeperFlowFactor;
  const attackSign = isYou ? 1 : -1;
  const targetX = safeHomeX + attackSign * stepOutDist;

  // If the ball is being passed laterally across the pitch (not a shot), the keeper has a subtle organic
  // footwork transition delay so quick cross-pitch passes open up a clean shooting window
  const isLateralPass = !isShot && Math.abs(safeBallVy) > 3.2 && lastTouchTeam !== teamTag;
  const reactivityMult = isLateralPass ? 0.78 * keeperFlowFactor : (1.08 + proximityRatio * 0.14) * keeperFlowFactor;

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
  for (const mate of teammates) {
    if (mate === actor) continue;
    const futureX =
      mate.commandedRunTimer && mate.commandedRunTimer > 0 && mate.commandedTargetX !== undefined
        ? mate.x * 0.5 + mate.commandedTargetX * 0.5
        : mate.x + (mate.vx || 0) * 14;
    const futureY =
      mate.commandedRunTimer && mate.commandedRunTimer > 0 && mate.commandedTargetY !== undefined
        ? mate.y * 0.5 + mate.commandedTargetY * 0.5
        : mate.y + (mate.vy || 0) * 14;

    const distToTarget = Math.hypot(futureX - targetX, futureY - targetY);
    let forwardAlignment = 0;
    if (actor) {
      const dxFromActor = futureX - actor.x;
      const dyFromActor = futureY - actor.y;
      const dFromActor = Math.hypot(dxFromActor, dyFromActor) || 1;
      forwardAlignment = (dxFromActor / dFromActor) * dirX + (dyFromActor / dFromActor) * dirY;
      if (forwardAlignment < -0.25 && distToTarget > 320) continue;
    }

    // Bonus if the through-ball target is ahead of the teammate in the attacking direction (ideal for running onto the ball)
    const attackDir = mate.team === 'YOU' ? 1 : -1;
    const leadDeltaX = (targetX - mate.x) * attackDir;
    const runOntoBonus = leadDeltaX > -40 && leadDeltaX < 520 ? 110 : 0;
    const runnerBonus = mate.commandedRunTimer && mate.commandedRunTimer > 0 ? 150 : 0;
    const score = forwardAlignment * 280 - distToTarget * 0.92 + runOntoBonus + runnerBonus;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

/**
 * Seamlessly selects the best teammate to control when a pass or through-ball is in flight.
 * Includes hysteresis (`currentTarget`) and only excludes the original passer (`excludePasser`),
 * NEVER the currently controlled receiver, preventing 2-player control oscillation.
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
  const lookAheadFrames = spd > 3 ? 20 : 6;
  const projBallX = Math.max(60, Math.min(PITCH.width - 60, ballState.x + ballState.vx * lookAheadFrames));
  const projBallY = Math.max(60, Math.min(PITCH.height - 60, ballState.y + ballState.y * 0 + ballState.vy * lookAheadFrames));

  let bestPlayer: P | null = null;
  let bestScore = Infinity;
  let currentTargetScore = Infinity;

  for (const p of candidates) {
    const pFutureX = p.x + (p.vx || 0) * 10;
    const pFutureY = p.y + (p.vy || 0) * 10;
    const distToProjected = Math.hypot(pFutureX - projBallX, pFutureY - projBallY);
    const distToSeg =
      spd > 3
        ? pointToSegmentDistance(pFutureX, pFutureY, ballState.x, ballState.y, projBallX, projBallY)
        : distToProjected;
    const score = distToSeg * 0.65 + distToProjected * 0.35;
    if (p === currentTarget) {
      currentTargetScore = score;
    }
    if (score < bestScore) {
      bestScore = score;
      bestPlayer = p;
    }
  }

  // Hysteresis lock: keep the current target receiver unless another teammate is >85px better
  if (
    currentTarget &&
    currentTarget.team === 'YOU' &&
    currentTarget !== excludePasser &&
    currentTargetScore <= bestScore + 85
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
  const baseShotSpeed = isYou ? (hasSuperFlow ? 28.0 : 24.5) : hasSuperFlow ? 25.5 : 22.8;
  const shotSpeed =
    baseShotSpeed + chargePower * 6.5 + (isOneTouch ? 2.5 : 0) + (isSweetSpot ? 3.5 : 0);
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
  const basePassSpeed = 19.8 + flowBoost.passSpeedBonus;
  const passSpeed =
    basePassSpeed + chargePower * 5.2 + (isOneTouch ? 1.8 : 0) + (isSweetSpot ? 2.6 : 0);
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
  if (Math.abs(dirY) > 0.22) {
    const targetWallY = dirY < 0 ? ballRadius : PITCH.height - ballRadius;
    const tWall = (targetWallY - actor.y) / dirY;
    if (tWall > 40 && tWall < 1250) {
      const hitX = actor.x + dirX * tWall;
      if (hitX > PITCH.cornerChamfer && hitX < PITCH.width - PITCH.cornerChamfer) {
        wallBouncePoint = {
          x: hitX,
          y: targetWallY,
          refX: hitX + dirX * 340,
          refY: targetWallY - dirY * 340,
        };
      }
    }
  }

  // 4. Subtle Teammate Auto-Lock: narrow cone (~12°) or direct cursor proximity (<76px),
  // and NEVER pulls a pass backward if the player is aiming into open space ahead of the teammate for a through-ball!
  const teammates = allPlayers.filter((p) => p.team === actor.team && p !== actor);
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

    // If the player is aiming into open space beyond or away from the teammate, let it be a through-ball into space!
    const aimingThroughBallPastMate =
      isYou &&
      pointerWorld.active &&
      mouseDist > 110 &&
      (pointerDistFromActor > dist + 85 || dot < 0.985);

    // If aiming at a wall rebound that is closer than the teammate and cursor isn't directly on the teammate, skip lock
    const wallCloserThanMate =
      wallBouncePoint !== null &&
      Math.hypot(wallBouncePoint.x - actor.x, wallBouncePoint.y - actor.y) < dist * 0.95 &&
      mouseDist >= 72;

    const lockDotThreshold = isYou ? 0.978 : 0.90;
    if (!wallCloserThanMate && !aimingThroughBallPastMate && (mouseDist < 76 || dot > lockDotThreshold)) {
      const score = dot * 3.0 + (mouseDist < 76 ? 2.5 : 0) - dist / 4500;
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
    Math.hypot(pointerWorld.x - bestMate.x, pointerWorld.y - bestMate.y) < 68;

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
  const opponents = allPlayers.filter((p) => p.team !== actor.team);
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
    // Subtle magnetic assist: 76% player raw aim + 24% teammate lead vector (for YOU)
    const aimWeight = isYou ? 0.76 : 0.35;
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


  // 5. Through-Ball into Open Space or Wall Rebound Pass:
  // Teammate will actively sprint onto the pass target!
  const pointerDist =
    isYou && pointerWorld.active
      ? Math.min(760, Math.max(260, Math.hypot(pointerWorld.x - actor.x, pointerWorld.y - actor.y)))
      : 540;
  const throughX = Math.max(85, Math.min(PITCH.width - 85, actor.x + dirX * pointerDist));
  const throughY = Math.max(85, Math.min(PITCH.height - 85, actor.y + dirY * pointerDist));

  const targetForReceiverX = wallBouncePoint ? wallBouncePoint.refX : throughX;
  const targetForReceiverY = wallBouncePoint ? wallBouncePoint.refY : throughY;
  const throughReceiver = findBestReceiverForBall(
    actor,
    targetForReceiverX,
    targetForReceiverY,
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
    wallBouncePoint,
    suggestedSpin: computePassSpin(throughX, throughY),
    isThroughBall: true,
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

