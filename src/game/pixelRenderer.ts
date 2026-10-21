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

  // Crisp White Outer Contrast Rim + Dark Ink Rim + Saturated Team Badge Plate
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(startX - px - 2, startY - px - 2, totalW + px * 2 + 4, 5 * px + px * 2 + 4);
  ctx.fillStyle = '#0f172a';
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
 * Universal High-Contrast Dual-Bordered Under-Foot Discs & Double Sprite Outlines.
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

  // 1. UNIVERSAL HIGH-CONTRAST UNDER-FOOT TEAM PLATTER & CONTROLLED PLAYER (P1) RING
  // Guarantees 100% instant readability on dark space/obsidian/synth pitches AND bright ice/clay/turf pitches
  const baseRadius = opts.isControlled ? p.radius + 9.5 : p.radius + 7.5;

  // Outer pure-white halo ring (makes player pop on dark pitches: Cosmic Space, Volcano Forge, Twilight Synth, Rooftop)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = opts.isControlled ? 8.5 : 7.0;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // Bold dark ink border ring (makes player pop on bright pitches: Glacier Frost, Rio Clay, Sakura, Sunlit Turf)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = opts.isControlled ? 5.5 : 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Rich, high-contrast team-colored floor platter fill under the player's feet
  ctx.fillStyle = opts.superFlow
    ? 'rgba(234, 179, 8, 0.68)'
    : wearsHomeKit
      ? 'rgba(2, 132, 199, 0.65)'
      : 'rgba(225, 29, 72, 0.65)';
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius - 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright team accent ring
  ctx.strokeStyle = opts.superFlow
    ? '#fef08a'
    : wearsHomeKit
      ? '#7dd3fc'
      : '#fda4af';
  ctx.lineWidth = opts.isControlled ? 3.2 : 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius - 2.2, 0, Math.PI * 2);
  ctx.stroke();

  // Directional facing pointer on the front rim of every player's floor platter
  const faceAngle = opts.isControlled ? opts.aimAngle : p.angle;
  ctx.save();
  ctx.rotate(faceAngle);
  ctx.fillStyle = opts.superFlow ? '#fde047' : wearsHomeKit ? '#38bdf8' : '#fb7185';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(baseRadius + 13, 0);
  ctx.lineTo(baseRadius + 2, -8);
  ctx.lineTo(baseRadius + 4.5, 0);
  ctx.lineTo(baseRadius + 2, 8);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  if (opts.isControlled) {
    const pulseR = baseRadius + 5.5 + Math.sin(opts.matchTick * 0.14) * 2.0;
    ctx.strokeStyle = opts.superFlow ? '#fde047' : '#ffffff';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    if (opts.superFlow) {
      ctx.save();
      ctx.rotate(opts.matchTick * 0.05);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, pulseR + 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Clean Modern Under-Foot Finesse Charge Bar (with 62%-92% Sweet Spot)
    if (opts.chargePower > 0.04) {
      const barW = 50;
      const barH = 8;
      const barY = baseRadius + 12;
      const sweetWidth = 0.3;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-barW / 2 - 3, barY - 3, barW + 6, barH + 6, 5);
      ctx.fill();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      ctx.roundRect(-barW / 2 - 1.5, barY - 1.5, barW + 3, barH + 3, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(250, 204, 21, 0.42)';
      ctx.fillRect(-barW / 2 + barW * 0.62, barY, barW * sweetWidth, barH);

      const inSweet = opts.chargePower >= 0.62 && opts.chargePower <= 0.92;
      ctx.fillStyle = inSweet ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, barW * opts.chargePower, barH, 3.5);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-barW / 2 + barW * 0.62, barY, barW * sweetWidth, barH);
    }
  } else if (opts.isOpenLane) {
    const isGiveGo = p.giveAndGoTimer > 0;
    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.8;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius + 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isGiveGo
      ? '#fde047'
      : p.commandedRunTimer > 0
        ? '#22d3ee'
        : '#ffffff';
    ctx.lineWidth = isGiveGo ? 3.0 : 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (opts.isControlled && opts.queuedOneTouch) {
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. CELEBRATION HOP OFFSET
  const hopOffset =
    p.celebrateTimer > 0
      ? Math.abs(Math.sin(opts.matchTick * 0.25 + p.index)) * animation.celebrationHopAmp
      : 0;
  ctx.translate(0, -hopOffset);

  // 3. 16-BIT PIXEL CHARACTER SPRITE BODY (Unobstructed Saturated Team Jersey + Double Contrast Outline)
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
  fillLocalPx(ctx, leftCleatX - 5, -p.radius * 0.85 - 2, dimensions.cleatLength + 2, dimensions.cleatWidth + 2, '#0f172a');
  fillLocalPx(ctx, leftCleatX - 4, -p.radius * 0.85 - 1, dimensions.cleatLength, dimensions.cleatWidth, kit.cleats);
  fillLocalPx(ctx, leftCleatX - 2, -p.radius * 0.85, 4, dimensions.cleatWidth - 2, kit.socks);

  // Right Cleat + Team Sock
  fillLocalPx(ctx, rightCleatX - 5, p.radius * 0.85 - dimensions.cleatWidth, dimensions.cleatLength + 2, dimensions.cleatWidth + 2, '#0f172a');
  fillLocalPx(ctx, rightCleatX - 4, p.radius * 0.85 - dimensions.cleatWidth + 1, dimensions.cleatLength, dimensions.cleatWidth, kit.cleats);
  fillLocalPx(ctx, rightCleatX - 2, p.radius * 0.85 - dimensions.cleatWidth + 2, 4, dimensions.cleatWidth - 2, kit.socks);

  const sw = 36; // Generous 36px wide shoulders so team jersey color is unmistakable
  const td = 26; // 26px deep torso

  // Outer Crisp White Contrast Halo around Torso
  fillLocalPx(
    ctx,
    -td / 2 - 4,
    -sw / 2 - 4,
    td + 8,
    sw + 8,
    opts.superFlow ? '#fef08a' : '#ffffff'
  );

  // Bold Dark Ink Pixel Torso Outer Rim
  fillLocalPx(
    ctx,
    -td / 2 - 2,
    -sw / 2 - 2,
    td + 4,
    sw + 4,
    '#0f172a'
  );

  if (wearsHomeKit) {
    // HOME KIT: Electric Sky-Cyan Jersey + Crisp White Shoulder Trim + Lemon-Gold Center Stripe
    fillLocalPx(ctx, -td / 2, -sw / 2, td, sw, '#0284c7');
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 4, sw - 4, '#38bdf8');
    // Crisp White Shoulder Sleeves
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 4, 5, '#ffffff');
    fillLocalPx(ctx, -td / 2 + 2, sw / 2 - 7, td - 4, 5, '#ffffff');
    // Sunny Lemon-Gold Center Chest Stripe
    fillLocalPx(ctx, -3, -sw / 2 + 5, 6, sw - 10, '#fde047');
  } else {
    // AWAY KIT: Vibrant Coral-Crimson Jersey + White Shoulder Trim + Warm-Gold Center Stripe
    fillLocalPx(ctx, -td / 2, -sw / 2, td, sw, '#e11d48');
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 4, sw - 4, '#fb7185');
    // Crisp Cream-White Shoulder Sleeves
    fillLocalPx(ctx, -td / 2 + 2, -sw / 2 + 2, td - 4, 5, '#fff1f2');
    fillLocalPx(ctx, -td / 2 + 2, sw / 2 - 7, td - 4, 5, '#fff1f2');
    // Warm Amber-Gold Center Stripe
    fillLocalPx(ctx, -3, -sw / 2 + 5, 6, sw - 10, '#fde047');
  }

  // Swinging Pixel Arms / Hands with Dark Outline
  const armSwing = -rawStride * 0.65;
  fillLocalPx(ctx, armSwing - 4, -sw / 2 - 6, 9, 6, '#0f172a');
  fillLocalPx(ctx, armSwing - 3, -sw / 2 - 5, 7, 4, kit.skin);
  fillLocalPx(ctx, -armSwing - 4, sw / 2, 9, 6, '#0f172a');
  fillLocalPx(ctx, -armSwing - 3, sw / 2 + 1, 7, 4, kit.skin);

  // Compact Forward-Shifted 16-Bit Head (Leaves the vibrant colored jersey shoulders & back clearly visible!)
  const hr = 6;
  const headX = 4;
  fillLocalPx(ctx, headX - hr - 2, -hr - 2, hr * 2 + 4, hr * 2 + 4, '#0f172a');
  fillLocalPx(ctx, headX - hr, -hr, hr * 2, hr * 2, kit.skin);
  fillLocalPx(ctx, headX - hr, -hr, hr * 1.2, hr * 2, wearsHomeKit ? '#fde047' : '#1e293b');

  ctx.restore();

  // 4. HIGH-CONTRAST OVERHEAD TEAM & NUMBER BADGE ABOVE EVERY PLAYER (Never covers the jersey!)
  const bobY = opts.isControlled
    ? -p.radius - 22 + Math.sin(opts.matchTick * animation.p1ArrowBobSpeed) * animation.p1ArrowBobAmp
    : -p.radius - 19;

  ctx.save();
  ctx.translate(0, bobY);

  const labelText = opts.isControlled
    ? `P1 #${p.jerseyNum}`
    : !isYou && opts.opponentTag
      ? opts.opponentTag
      : `#${p.jerseyNum}`;

  ctx.font = opts.isControlled
    ? '900 10.5px "Plus Jakarta Sans", sans-serif'
    : '900 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const measuredW = ctx.measureText(labelText).width;
  const pillW = Math.max(opts.isControlled ? 46 : 28, measuredW + 12);
  const pillH = opts.isControlled ? 17 : 15;

  // Downward pointer chevron below the pill
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(7, -2);
  ctx.lineTo(0, 6.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = opts.superFlow ? '#facc15' : wearsHomeKit ? '#0ea5e9' : '#f43f5e';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-5.5, -2);
  ctx.lineTo(5.5, -2);
  ctx.lineTo(0, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Outer pure-white halo around pill (pops on dark pitches)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-pillW / 2 - 2.5, -pillH - 3.5, pillW + 5, pillH + 5, 7);
  ctx.fill();

  // Bold team-colored pill with dark slate border (pops on light pitches)
  ctx.fillStyle = opts.isControlled
    ? (opts.superFlow ? '#fde047' : '#0f172a')
    : wearsHomeKit
      ? '#0284c7'
      : '#e11d48';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, -pillH - 1, pillW, pillH, 5.5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = opts.isControlled
    ? (opts.superFlow ? '#0f172a' : '#fef08a')
    : '#ffffff';
  ctx.fillText(labelText, 0, -pillH / 2 - 0.5);
  ctx.restore();

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

  // High-contrast dual-bordered keeper floor platter
  const kRingR = k.radius + 7;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7.0;
  ctx.beginPath();
  ctx.arc(0, 0, kRingR + 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, kRingR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = wearsHomeKit ? 'rgba(16, 185, 129, 0.62)' : 'rgba(168, 85, 247, 0.62)';
  ctx.beginPath();
  ctx.arc(0, 0, kRingR - 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = kit.primary;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(0, 0, kRingR - 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.rotate(k.angle);

  const gloveSpread = k.diveTimer > 0 ? k.radius + 8 : k.radius + 4;
  // Pixel GK Gloves with White + Dark Double Outline
  [-gloveSpread, gloveSpread - 6].forEach((gy) => {
    fillLocalPx(ctx, 1, gy - 3, 12, 12, '#ffffff');
    fillLocalPx(ctx, 2, gy - 2, 10, 10, '#0f172a');
    fillLocalPx(ctx, 4, gy, 6, 6, kit.gloves);
  });

  // Pixel Keeper Torso & Head with Crisp White Outer Halo + Dark Ink Outline
  fillLocalPx(ctx, -k.radius - 4, -k.radius - 4, k.radius * 2 + 8, k.radius * 2 + 8, '#ffffff');
  fillLocalPx(ctx, -k.radius - 2, -k.radius - 2, k.radius * 2 + 4, k.radius * 2 + 4, '#0f172a');
  fillLocalPx(ctx, -k.radius, -k.radius, k.radius * 2, k.radius * 2, kit.secondary);
  fillLocalPx(ctx, -k.radius + 2, -k.radius + 2, k.radius * 2 - 4, k.radius * 2 - 4, kit.primary);
  fillLocalPx(ctx, -3, -3, 6, 6, '#ffffff');
  ctx.restore();

  // Upright GK Overhead Badge
  const gkY = -k.radius - 17;
  ctx.font = '900 9px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-15, gkY - 8, 30, 15, 5);
  ctx.fill();
  ctx.fillStyle = kit.secondary;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.roundRect(-13.5, gkY - 6.5, 27, 12, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('GK', 0, gkY - 0.2);

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
 * Multi-Frame Rotating 16-Bit Pixel Soccer Ball with High-Contrast Ground Ring & Double Outline.
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

  // 2. Decoupled Ground Drop-Shadow + High-Contrast Ground Ring (scales with vertical loft height)
  const shadowScale = Math.max(0.5, 1 - ball.height / 45);
  const sw = Math.round(ball.radius * 2.15 * shadowScale);
  const sh = Math.round(ball.radius * 1.45 * shadowScale);
  fillLocalPx(ctx, ball.x - sw / 2 + 1, ball.y + 4 - sh / 2, sw, sh, 'rgba(15, 23, 42, 0.42)');

  // 3. Multi-Frame Rotating 16-Bit Pixel Ball Sprite (Smooth sub-pixel world position)
  const r = Math.round(ball.radius);

  ctx.save();
  ctx.translate(ball.x, ball.y - ball.height);

  // Subtle bright outer contrast halo so the dark-outlined ball pops on dark space/obsidian/synth pitches
  fillLocalPx(ctx, -r - 3, -r + 2, r * 2 + 6, r * 2 - 4, isGoldenBall ? '#fde047' : 'rgba(255, 255, 255, 0.85)');
  fillLocalPx(ctx, -r + 2, -r - 3, r * 2 - 4, r * 2 + 6, isGoldenBall ? '#fde047' : 'rgba(255, 255, 255, 0.85)');

  // Outer pixel octagon/circle dark outline
  fillLocalPx(ctx, -r - 2, -r + 2, r * 2 + 4, r * 2 - 4, '#0f172a');
  fillLocalPx(ctx, -r + 2, -r - 2, r * 2 - 4, r * 2 + 4, '#0f172a');

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
