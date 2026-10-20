/**
 * Hybrid 16-Bit Pixel Art Entity & Clean Modern Vector Tactical Overlay Renderer for REMATCH 0.2.
 *
 * - Players, Goalkeepers, Soccer Ball, Pitch Turf, Bleachers, Crowd, and Deformable Goals
 *   are rendered in crisp 16-bit pixel art.
 * - Entity world translations use smooth floating-point coordinates (zero 3px grid-snapping jitter).
 * - Tactical UI overlays (player selection circles, pass/shot trajectory curves, and the mouse
 *   target reticle) use clean, modern anti-aliased vector graphics for maximum clarity.
 */

import { GRAPHICS_CONFIG, PIXEL_DIGITS_3X5 } from './graphicsConfig';
import { PITCH, simulateCurvedPreviewArc } from './rules';

export function snapPx(val: number, grid = GRAPHICS_CONFIG.pixelPipeline.pixelSize): number {
  return Math.round(val / grid) * grid;
}

export function fillPxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  grid = GRAPHICS_CONFIG.pixelPipeline.pixelSize
): void {
  ctx.fillStyle = color;
  const sx = Math.round(x / grid) * grid;
  const sy = Math.round(y / grid) * grid;
  const sw = Math.max(grid, Math.round(w / grid) * grid);
  const sh = Math.max(grid, Math.round(h / grid) * grid);
  ctx.fillRect(sx, sy, sw, sh);
}

/** Fast local integer pixel block helper (no world-grid snapping jitter during movement) */
function fillLocalPx(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/**
 * Draws a crisp 3x5 pixel bitmap jersey number ("4", "7", "10", "1") with a team-colored pixel plate.
 */
export function drawPixelNumber(
  ctx: CanvasRenderingContext2D,
  numStr: string,
  centerX: number,
  centerY: number,
  color: string,
  plateColor = GRAPHICS_CONFIG.palette.outline,
  px = 2
): void {
  const chars = String(numStr).split('');
  const totalW = chars.length * 3 * px + (chars.length - 1) * px;
  const startX = Math.round(centerX - totalW / 2);
  const startY = Math.round(centerY - (5 * px) / 2);

  // Dark outer pixel rim + team badge plate
  ctx.fillStyle = GRAPHICS_CONFIG.palette.outline;
  ctx.fillRect(startX - px - 1, startY - px - 1, totalW + px * 2 + 2, 5 * px + px * 2 + 2);
  ctx.fillStyle = plateColor;
  ctx.fillRect(startX - px, startY - px, totalW + px * 2, 5 * px + px * 2);

  // Crisp 3x5 pixel digits
  ctx.fillStyle = color;
  chars.forEach((ch, idx) => {
    const grid = PIXEL_DIGITS_3X5[ch] || PIXEL_DIGITS_3X5['0'];
    const cx = startX + idx * 4 * px;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[r][c]) {
          ctx.fillRect(cx + c * px, startY + r * px, px, px);
        }
      }
    }
  });
}

export interface PixelPlayerRenderData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  stridePhase: number;
  jerseyNum: number;
  team: 'YOU' | 'AI';
  celebrateTimer: number;
  lungeTimer: number;
  giveAndGoTimer: number;
  commandedRunTimer: number;
  isOpenLane: boolean;
  index: number;
}

/**
 * High-Detail 16-Bit Character Sprite Renderer (`drawPixelPlayer`) with
 * Clean Modern Vector Under-Foot Circles & Charge Bar.
 */
export function drawPixelPlayer(
  ctx: CanvasRenderingContext2D,
  p: PixelPlayerRenderData,
  opts: {
    isControlled: boolean;
    superFlow: boolean;
    matchTick: number;
    aimAngle: number;
    chargePower: number;
    isOpenLane: boolean;
    queuedOneTouch: boolean;
    opponentTag?: string;
    userKit?: 'HOME' | 'AWAY';
  }
): void {
  const { palette, dimensions, animation } = GRAPHICS_CONFIG;
  const isYou = p.team === 'YOU';
  const userWearsHome = (opts.userKit || 'HOME') === 'HOME';
  const wearsHomeKit = isYou ? userWearsHome : !userWearsHome;
  const kit = wearsHomeKit ? palette.homeKit : palette.awayKit;

  ctx.save();
  // Smooth floating-point translation for 100% butter-smooth 60-144Hz movement
  ctx.translate(p.x, p.y);

  // 1. CLEAN MODERN VECTOR TEAM RING & CONTROLLED PLAYER (P1) CIRCLE
  if (opts.isControlled) {
    const pulseR = p.radius + 10 + Math.sin(opts.matchTick * 0.14) * 2.0;

    // Soft pastel glow fill under controlled player
    ctx.fillStyle = opts.superFlow
      ? 'rgba(250, 204, 21, 0.25)'
      : wearsHomeKit
        ? 'rgba(56, 189, 248, 0.24)'
        : 'rgba(251, 113, 133, 0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, pulseR + 3, 0, Math.PI * 2);
    ctx.fill();

    // Crisp inner white vector ring
    ctx.strokeStyle = opts.superFlow ? '#fef047' : '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8.5, 0, Math.PI * 2);
    ctx.stroke();

    // Outer accent vector ring
    ctx.strokeStyle = opts.superFlow ? '#f59e0b' : wearsHomeKit ? '#0284c7' : '#e11d48';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 11.8, 0, Math.PI * 2);
    ctx.stroke();

    if (opts.superFlow) {
      ctx.save();
      ctx.rotate(opts.matchTick * 0.05);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Clean Modern Vector Directional Aim Chevron
    ctx.save();
    ctx.rotate(opts.aimAngle);
    ctx.fillStyle = opts.superFlow ? '#fde047' : '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.radius + 23, 0);
    ctx.lineTo(p.radius + 12, -8);
    ctx.lineTo(p.radius + 14.5, 0);
    ctx.lineTo(p.radius + 12, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Clean Modern Under-Foot Finesse Charge Bar (with 62%-92% Sweet Spot)
    if (opts.chargePower > 0.04) {
      const barW = 48;
      const barH = 7.5;
      const barY = p.radius + 16;
      const sweetWidth = 0.3;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(250, 204, 21, 0.38)';
      ctx.fillRect(-barW / 2 + barW * 0.62, barY, barW * sweetWidth, barH);

      const inSweet = opts.chargePower >= 0.62 && opts.chargePower <= 0.92;
      ctx.fillStyle = inSweet ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, barW * opts.chargePower, barH, 3.5);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-barW / 2 + barW * 0.62, barY, barW * sweetWidth, barH);
    }
  } else {
    // Clean modern vector team base circle so Home Kit (Sky-Cyan) vs Away Kit (Coral-Crimson) are instantly distinct
    ctx.fillStyle = wearsHomeKit ? 'rgba(14, 165, 233, 0.18)' : 'rgba(244, 63, 94, 0.20)';
    ctx.beginPath();
    ctx.arc(0, 1, p.radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = wearsHomeKit ? '#0ea5e9' : '#f43f5e';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 1, p.radius + 5, 0, Math.PI * 2);
    ctx.stroke();

    if (opts.isOpenLane) {
      const isGiveGo = p.giveAndGoTimer > 0;
      ctx.save();
      ctx.strokeStyle = isGiveGo
        ? 'rgba(250, 204, 21, 0.95)'
        : p.commandedRunTimer > 0
          ? 'rgba(6, 182, 212, 0.92)'
          : 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = isGiveGo ? 2.8 : 2.2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 1, p.radius + 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (opts.isControlled && opts.queuedOneTouch) {
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. SOFT PIXEL GROUND DROP SHADOW
  const hopOffset =
    p.celebrateTimer > 0
      ? Math.abs(Math.sin(opts.matchTick * 0.25 + p.index)) * animation.celebrationHopAmp
      : 0;

  fillLocalPx(ctx, -p.radius + 2, 5, p.radius * 2 - 4, p.radius * 1.15, 'rgba(15, 23, 42, 0.22)');

  ctx.translate(0, -hopOffset);

  // 3. 16-BIT PIXEL CHARACTER SPRITE BODY (Unmistakably Distinct Home vs Away Kit & Head Design)
  ctx.save();
  ctx.rotate(p.angle);
  ctx.scale(p.scaleX, p.scaleY);

  const windupPullback =
    opts.isControlled && opts.chargePower > 0.05
      ? -opts.chargePower * animation.chargeWindupPullback
      : 0;
  const lungeForward = p.lungeTimer > 0 ? 5 : 0;
  ctx.translate(windupPullback + lungeForward, 0);

  // Animated Running Cleats (Left & Right Stride Frames)
  const speedRatio = Math.min(1, Math.hypot(p.vx, p.vy) / 2.2);
  const rawStride = Math.sin(p.stridePhase) * animation.strideAmplitude * speedRatio;
  const leftCleatX = rawStride + (opts.chargePower > 0.1 ? -opts.chargePower * 4.5 : 0);
  const rightCleatX = -rawStride + (opts.chargePower > 0.1 ? opts.chargePower * 5.5 : 0);

  // Left Cleat + Team Sock
  fillLocalPx(ctx, leftCleatX - 5, -p.radius * 0.82 - 2, dimensions.cleatLength + 2, dimensions.cleatWidth + 2, palette.outline);
  fillLocalPx(ctx, leftCleatX - 4, -p.radius * 0.82 - 1, dimensions.cleatLength, dimensions.cleatWidth, kit.cleats);
  fillLocalPx(ctx, leftCleatX - 2, -p.radius * 0.82, 4, dimensions.cleatWidth - 2, kit.socks);

  // Right Cleat + Team Sock
  fillLocalPx(ctx, rightCleatX - 5, p.radius * 0.82 - dimensions.cleatWidth, dimensions.cleatLength + 2, dimensions.cleatWidth + 2, palette.outline);
  fillLocalPx(ctx, rightCleatX - 4, p.radius * 0.82 - dimensions.cleatWidth + 1, dimensions.cleatLength, dimensions.cleatWidth, kit.cleats);
  fillLocalPx(ctx, rightCleatX - 2, p.radius * 0.82 - dimensions.cleatWidth + 2, 4, dimensions.cleatWidth - 2, kit.socks);

  const sw = dimensions.shoulderWidth;
  const td = dimensions.torsoDepth;

  // Pixel Torso Outer Rim
  fillLocalPx(
    ctx,
    -td / 2 - 2,
    -sw / 2 - 2,
    td + 4,
    sw + 4,
    opts.superFlow ? palette.ui.sweetSpotGold : palette.outline
  );

  if (wearsHomeKit) {
    // HOME KIT: Bright Sky-Cyan Jersey + Crisp White Sleeves + Sunny Lemon-Gold Chest Sash
    fillLocalPx(ctx, -td / 2, -sw / 2, td, sw, '#0284c7');
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 2, sw - 4, '#38bdf8');
    // Crisp White Shoulder Sleeves
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 4, 6, '#ffffff');
    fillLocalPx(ctx, -td / 2 + 2, sw / 2 - 8, td - 4, 6, '#ffffff');
    // Sunny Lemon-Gold Center Chest Stripe
    fillLocalPx(ctx, -3, -sw / 2 + 2, 6, sw - 4, '#fde047');
    fillLocalPx(ctx, td / 2 - 4, -5, 4, 10, '#ffffff');
  } else {
    // AWAY KIT: Vibrant Coral-Crimson Jersey + Dark Berry Sleeves + Cream Twin Stripes
    fillLocalPx(ctx, -td / 2, -sw / 2, td, sw, '#be123c');
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 2, sw - 4, '#fb7185');
    // Deep Berry-Plum Shoulder Sleeves
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 4, 6, '#881337');
    fillLocalPx(ctx, -td / 2 + 2, sw / 2 - 8, td - 4, 6, '#881337');
    // Twin Warm-Cream Vertical Stripes
    fillLocalPx(ctx, -5, -sw / 2 + 2, 3, sw - 4, '#fff1f2');
    fillLocalPx(ctx, 2, -sw / 2 + 2, 3, sw - 4, '#fff1f2');
    fillLocalPx(ctx, td / 2 - 4, -5, 4, 10, '#fde047');
  }

  // Swinging Pixel Arms / Hands
  const armSwing = -rawStride * 0.65;
  fillLocalPx(ctx, armSwing - 3, -sw / 2 - 5, 7, 4, kit.skin);
  fillLocalPx(ctx, -armSwing - 3, sw / 2 + 1, 7, 4, kit.skin);

  // Expressive 16-Bit Head with High-Contrast Team Hair & Visor
  const hr = dimensions.headRadius;
  fillLocalPx(ctx, -hr - 2, -hr - 2, hr * 2 + 4, hr * 2 + 4, palette.outline);
  fillLocalPx(ctx, -hr, -hr, hr * 2, hr * 2, kit.skin);
  // Golden-Blonde Crown for Home Kit vs Dark Obsidian Hair for Away Kit
  fillLocalPx(ctx, -hr, -hr, hr * 1.2, hr * 2, wearsHomeKit ? '#fde047' : '#1e293b');
  // Headband stripe
  fillLocalPx(ctx, -1, -hr, 3, hr * 2, wearsHomeKit ? '#ffffff' : '#fb7185');
  // Directional front visor
  fillLocalPx(ctx, hr - 3, -hr + 2, 5, hr * 2 - 4, wearsHomeKit ? '#38bdf8' : '#ffffff');

  ctx.restore();

  // 4. Upright Pixelated Back Jersey Number (#4, #7, #10 vs #5, #8, #9) on High-Contrast Team Plate
  drawPixelNumber(ctx, String(p.jerseyNum), 0, 1, '#ffffff', wearsHomeKit ? '#0369a1' : '#9f1239', 2);

  // 5. Clean Modern P1 Badge Above Controlled Player
  if (opts.isControlled) {
    const bobY = -p.radius - 22 + Math.sin(opts.matchTick * animation.p1ArrowBobSpeed) * animation.p1ArrowBobAmp;
    ctx.save();
    ctx.translate(0, bobY);

    ctx.fillStyle = opts.superFlow ? '#facc15' : wearsHomeKit ? '#0ea5e9' : '#f43f5e';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(5, -3);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = opts.superFlow ? '#fde047' : wearsHomeKit ? '#38bdf8' : '#fb7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -19, 28, 15, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = opts.superFlow ? '#fde047' : '#ffffff';
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P1', 0, -11);
    ctx.restore();
  }

  // Opponent gamer tag pill when AI has the ball
  if (!isYou && opts.opponentTag) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-44, -p.radius - 25, 88, 16, 6);
    ctx.fill();
    ctx.fillStyle = wearsHomeKit ? '#7dd3fc' : '#fda4af';
    ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.opponentTag, 0, -p.radius - 16.5);
  }

  ctx.restore();
}

export interface PixelKeeperRenderData {
  x: number;
  y: number;
  radius: number;
  angle: number;
  diveTimer: number;
  team: 'YOU' | 'AI';
}

export function drawPixelKeeper(
  ctx: CanvasRenderingContext2D,
  k: PixelKeeperRenderData,
  userKit: 'HOME' | 'AWAY' = 'HOME'
): void {
  const { palette } = GRAPHICS_CONFIG;
  const isYou = k.team === 'YOU';
  const wearsHomeKit = isYou ? userKit === 'HOME' : userKit !== 'HOME';
  const kit = wearsHomeKit ? palette.keeperHome : palette.keeperAway;

  ctx.save();
  ctx.translate(k.x, k.y);

  // Ground drop shadow
  fillLocalPx(ctx, -k.radius, 4, k.radius * 2, k.radius * 1.15, 'rgba(15, 23, 42, 0.24)');

  ctx.rotate(k.angle);

  const gloveSpread = k.diveTimer > 0 ? k.radius + 7 : k.radius + 3;
  // Pixel GK Gloves
  [-gloveSpread, gloveSpread - 6].forEach((gy) => {
    fillLocalPx(ctx, 2, gy - 2, 10, 10, palette.outline);
    fillLocalPx(ctx, 4, gy, 6, 6, kit.gloves);
  });

  // Pixel Keeper Torso & Head
  fillLocalPx(ctx, -k.radius - 2, -k.radius - 2, k.radius * 2 + 4, k.radius * 2 + 4, palette.outline);
  fillLocalPx(ctx, -k.radius, -k.radius, k.radius * 2, k.radius * 2, kit.secondary);
  fillLocalPx(ctx, -k.radius + 2, -k.radius + 2, k.radius * 2 - 4, k.radius * 2 - 4, kit.primary);
  fillLocalPx(ctx, -4, -4, 8, 8, '#ffffff');

  ctx.restore();
}

export interface PixelBallRenderData {
  x: number;
  y: number;
  height: number;
  radius: number;
  rotAngle: number;
  isSuperStrike: boolean;
  trail: Array<{ x: number; y: number; r: number; alpha: number; gold: boolean }>;
}

/**
 * Multi-Frame Rotating 16-Bit Pixel Soccer Ball with Smooth World Coordinates.
 */
export function drawPixelBall(
  ctx: CanvasRenderingContext2D,
  ball: PixelBallRenderData,
  isGoldenBall: boolean
): void {
  const { palette } = GRAPHICS_CONFIG;

  // 1. Pixel Afterimage Trail
  for (const tr of ball.trail) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, tr.alpha);
    const trailCol = tr.gold ? palette.ball.trailSuper : palette.ball.trailNormal;
    const size = Math.max(4, Math.round(tr.r * 1.6));
    fillLocalPx(ctx, tr.x - size / 2, tr.y - ball.height * 0.4 - size / 2, size, size, trailCol);
    ctx.restore();
  }

  // 2. Decoupled Ground Drop-Shadow (scales with vertical loft height)
  const shadowScale = Math.max(0.5, 1 - ball.height / 45);
  const sw = Math.round(ball.radius * 2.0 * shadowScale);
  const sh = Math.round(ball.radius * 1.35 * shadowScale);
  fillLocalPx(ctx, ball.x - sw / 2 + 2, ball.y + 5 - sh / 2, sw, sh, 'rgba(15, 23, 42, 0.28)');

  // 3. Multi-Frame Rotating 16-Bit Pixel Ball Sprite (Smooth sub-pixel world position)
  const r = Math.round(ball.radius);

  ctx.save();
  ctx.translate(ball.x, ball.y - ball.height);

  // Outer pixel octagon/circle outline
  fillLocalPx(ctx, -r - 2, -r + 2, r * 2 + 4, r * 2 - 4, palette.outline);
  fillLocalPx(ctx, -r + 2, -r - 2, r * 2 - 4, r * 2 + 4, palette.outline);

  // Shaded lower-right hemisphere
  fillLocalPx(
    ctx,
    -r + 2,
    -r + 2,
    r * 2 - 4,
    r * 2 - 4,
    isGoldenBall ? palette.ball.superShaded : palette.ball.shaded
  );

  // Lit upper-left hemisphere
  fillLocalPx(
    ctx,
    -r + 2,
    -r + 2,
    r * 1.5,
    r * 1.5,
    isGoldenBall ? palette.ball.superBase : palette.ball.base
  );

  // Multi-frame rotating pentagon pixel patches based on ball.rotAngle
  const patchColor = isGoldenBall ? palette.ball.superPentagon : palette.ball.pentagon;
  const cx = Math.round(Math.cos(ball.rotAngle) * (r * 0.38));
  const cy = Math.round(Math.sin(ball.rotAngle) * (r * 0.38));

  fillLocalPx(ctx, cx - 3, cy - 3, 6, 6, patchColor);

  for (let i = 0; i < 4; i++) {
    const a = ball.rotAngle + (i * Math.PI) / 2;
    const pxPatchX = Math.round(Math.cos(a) * (r * 0.72));
    const pxPatchY = Math.round(Math.sin(a) * (r * 0.72));
    fillLocalPx(ctx, pxPatchX - 2, pxPatchY - 2, 4, 4, patchColor);
  }

  // Crisp top-left specular pixel highlight
  fillLocalPx(ctx, -r * 0.5, -r * 0.5, 3, 3, '#ffffff');

  ctx.restore();
}

/**
 * Pixel-Rendered Deformable 13-Node Spring Goal Net & Posts.
 */
export function drawPixelGoal(
  ctx: CanvasRenderingContext2D,
  isLeft: boolean,
  goalTop: number,
  goalBot: number,
  nodes: Array<{ x: number; y: number; baseX: number; baseY: number }>,
  userKit: 'HOME' | 'AWAY' = 'HOME'
): void {
  const { palette, pixelPipeline } = GRAPHICS_CONFIG;
  const px = pixelPipeline.pixelSize;
  const gx = isLeft ? 0 : PITCH.width;
  const leftWearsHome = userKit === 'HOME';
  const sideIsHomeKit = isLeft ? leftWearsHome : !leftWearsHome;

  ctx.save();
  // Soft interior goal shadow polygon
  ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
  ctx.beginPath();
  ctx.moveTo(gx, goalTop);
  for (let i = 0; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].x, nodes[i].y);
  }
  ctx.lineTo(gx, goalBot);
  ctx.closePath();
  ctx.fill();

  // Hand-crafted pixel mesh net lines that stretch with spring physics
  ctx.strokeStyle = sideIsHomeKit ? palette.cage.netMeshHome : palette.cage.netMeshAway;
  ctx.lineWidth = 2;
  for (let i = 0; i < nodes.length; i++) {
    ctx.beginPath();
    ctx.moveTo(gx, nodes[i].baseY);
    ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.stroke();
  }
  for (let layer = 1; layer <= 4; layer++) {
    const t = layer / 4;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const nx = gx + (nodes[i].x - gx) * t;
      const ny = nodes[i].baseY + (nodes[i].y - nodes[i].baseY) * t;
      if (i === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    }
    ctx.stroke();
  }

  // Pixel Goal Frame Outer Rope
  ctx.strokeStyle = palette.cage.goalPost;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gx, goalTop);
  for (let i = 0; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].x, nodes[i].y);
  }
  ctx.lineTo(gx, goalBot);
  ctx.stroke();

  // Goal Line Tape
  fillPxRect(
    ctx,
    gx - px,
    goalTop,
    px * 2,
    goalBot - goalTop,
    sideIsHomeKit ? 'rgba(14, 165, 233, 0.85)' : 'rgba(244, 63, 94, 0.85)',
    px
  );

  // 16-Bit Square Pixel Goalposts with 3D Extrusion
  [goalTop, goalBot].forEach((py) => {
    fillPxRect(ctx, gx - 9, py - 9, 18, 18, palette.outline, px);
    fillPxRect(ctx, gx - 6, py - 6, 12, 12, palette.cage.goalPostShadow, px);
    fillPxRect(ctx, gx - 6, py - 6, 9, 9, palette.cage.goalPost, px);
  });

  ctx.restore();
}

/**
 * Clean, Non-Pixel Modern Vector Pass/Shot Trajectory Line & Target Ring.
 * Uses the exact physics trajectory solver so the preview curve matches the ball's flight 1:1.
 */
export function drawCurvedTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  appliedSpin: number,
  chargePower: number,
  isSuperFlow: boolean,
  isShot: boolean,
  launchSpeed = 24
): void {
  const { palette } = GRAPHICS_CONFIG;
  const isCurved = Math.abs(appliedSpin) > 0.002 || chargePower > 0.25 || isSuperFlow;
  const arcPoints = simulateCurvedPreviewArc(startX, startY, targetX, targetY, appliedSpin, 22, launchSpeed);
  const lineColor = isCurved
    ? palette.ui.trajectoryCurved
    : isShot
      ? 'rgba(255, 255, 255, 0.92)'
      : 'rgba(56, 189, 248, 0.92)';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // If charging a curved shot/pass, draw a subtle ghost straight reference chord so the player
  // can intuitively see how much curve bend they are putting on the ball!
  if (chargePower > 0.08 && Math.abs(appliedSpin) > 0.001) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
  }

  // Subtle dark outer stroke for contrast on bright pastel turf
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = isCurved ? 6.0 : 5.0;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  for (let i = 0; i < arcPoints.length; i++) {
    if (i === 0) ctx.moveTo(arcPoints[i].x, arcPoints[i].y);
    else ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
  }
  ctx.stroke();

  // Crisp modern vector dashed trajectory line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = isCurved ? 3.5 : 2.8;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  for (let i = 0; i < arcPoints.length; i++) {
    if (i === 0) ctx.moveTo(arcPoints[i].x, arcPoints[i].y);
    else ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
  }
  ctx.stroke();

  // Directional midpoint curve chevron so the player intuitively sees the ball's flight direction along the curve
  if (arcPoints.length > 12) {
    const midIdx = Math.floor(arcPoints.length * 0.52);
    const p0 = arcPoints[midIdx - 1];
    const p1 = arcPoints[midIdx + 1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(arcPoints[midIdx].x, arcPoints[midIdx].y);
    ctx.rotate(ang);
    ctx.setLineDash([]);
    ctx.fillStyle = lineColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Clean Modern Vector Target Ring at Endpoint
  const endPt = arcPoints[arcPoints.length - 1];
  ctx.setLineDash([]);
  ctx.fillStyle = isCurved ? 'rgba(250, 204, 21, 0.26)' : 'rgba(56, 189, 248, 0.22)';
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(endPt.x, endPt.y, 14 + chargePower * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(endPt.x, endPt.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Clean, Non-Pixel Modern Vector Mouse Pointer / Arcade Target Reticle.
 */
export function drawPixelReticle(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  playerX: number | null,
  playerY: number | null,
  chargePower: number,
  inSweetSpot: boolean,
  isSuperFlow: boolean,
  hasPossession: boolean,
  matchTick: number
): void {
  const reticleColor =
    inSweetSpot || isSuperFlow
      ? '#fde047'
      : hasPossession
        ? '#38bdf8'
        : '#fb7185';

  // Clean modern dashed tether line from Controlled Player to Mouse Reticle
  if (playerX !== null && playerY !== null) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(playerX, playerY);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(rx, ry);

  const rad = 15 + chargePower * 7;

  // Soft outer glow circle
  ctx.fillStyle =
    inSweetSpot || isSuperFlow ? 'rgba(250, 204, 21, 0.22)' : 'rgba(15, 23, 42, 0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, rad + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(matchTick * 0.035);

  // Crisp dark outer ring + colored inner vector ring
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = reticleColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.stroke();

  // 4 Clean Modern Vector Crosshair Ticks
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (rad - 5), Math.sin(a) * (rad - 5));
    ctx.lineTo(Math.cos(a) * (rad + 6), Math.sin(a) * (rad + 6));
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (rad - 5), Math.sin(a) * (rad - 5));
    ctx.lineTo(Math.cos(a) * (rad + 6), Math.sin(a) * (rad + 6));
    ctx.stroke();
  }
  ctx.restore();

  // Center Precision Dot
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 4.0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
