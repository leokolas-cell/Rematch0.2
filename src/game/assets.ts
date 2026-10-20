/**
 * Modular Asset Pipeline & Sprite Registry for REMATCH 0.2.
 *
 * Designed for seamless graphic stylization & Nano Banana Pro / Gemini image generation.
 * Every visual entity in the game (pitch turf, coastal apron, home/away player kits,
 * goalkeepers, soccer ball, golden Super Flow ball, stadium LED board, crowd fans, and
 * meadow flowers) queries this registry first.
 *
 * - If a sprite/texture URL is registered and loaded, the engine renders the high-resolution image asset.
 * - If `src` is null or still loading, the engine seamlessly executes the procedural Canvas fallback
 *   so development and final asset deployment transition with zero code refactoring or broken images.
 */

export type AssetSlotId =
  | 'title_key_art'
  | 'pitch_turf_texture'
  | 'coastal_apron_texture'
  | 'player_home_sprite'
  | 'player_away_sprite'
  | 'keeper_home_sprite'
  | 'keeper_away_sprite'
  | 'ball_standard_sprite'
  | 'ball_super_flow_sprite'
  | 'goal_net_texture'
  | 'crowd_fan_sprite'
  | 'meadow_flower_sprite';

export interface AssetSlotConfig {
  id: AssetSlotId;
  label: string;
  category: 'environment' | 'characters' | 'props' | 'ui';
  aspectRatio: '1:1' | '16:9' | '4:3';
  recommendedSize: string;
  nanoBananaPrompt: string;
  src: string | null;
  scale: number;
  anchorX: number;
  anchorY: number;
  rotateWithEntity: boolean;
  loaded: boolean;
  error: boolean;
  imageElement: HTMLImageElement | null;
}

export const INITIAL_ASSET_MANIFEST: Record<AssetSlotId, AssetSlotConfig> = {
  title_key_art: {
    id: 'title_key_art',
    label: 'Title Screen Key Art Backdrop',
    category: 'ui',
    aspectRatio: '16:9',
    recommendedSize: '1920×1080',
    nanoBananaPrompt:
      'Sunny pastel Nintendo-polished indie arcade 3v3 cage soccer stadium by a coastal park, vibrant mowed grass stripes, chamfered cage walls, cheerful stadium bleachers, 35% calm sky/turf negative space, cel-shaded illustration, no text, no logos.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: false,
    loaded: false,
    error: false,
    imageElement: null,
  },
  pitch_turf_texture: {
    id: 'pitch_turf_texture',
    label: 'Pitch Mowed Turf Texture',
    category: 'environment',
    aspectRatio: '16:9',
    recommendedSize: '2360×1380',
    nanoBananaPrompt:
      'Top-down 2D game texture of sunny pastel mowed soccer turf stripes in mint and emerald (#74d197 and #85dca6), subtle hand-painted grass blade texture, clean arcade style, seamless top-down view.',
    src: null,
    scale: 1.0,
    anchorX: 0,
    anchorY: 0,
    rotateWithEntity: false,
    loaded: false,
    error: false,
    imageElement: null,
  },
  coastal_apron_texture: {
    id: 'coastal_apron_texture',
    label: 'Coastal Park Outer Apron',
    category: 'environment',
    aspectRatio: '16:9',
    recommendedSize: '2560×1440',
    nanoBananaPrompt:
      'Top-down 2D game background of a sunny coastal park meadow apron surrounding a soccer cage, soft sage grass (#5bb386) with subtle stone walkway border, Nintendo indie art style.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: false,
    loaded: false,
    error: false,
    imageElement: null,
  },
  player_home_sprite: {
    id: 'player_home_sprite',
    label: 'Home Player Kit Sprite (Sky-Cobalt & Lemon)',
    category: 'characters',
    aspectRatio: '1:1',
    recommendedSize: '256×256',
    nanoBananaPrompt:
      'Top-down 2.5D arcade soccer player sprite wearing Sky-Cobalt (#2563eb) jersey with Sunny Lemon (#fde047) chest stripe and cyan visor, facing right, clean bold dark outline, isolated on transparent background.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: true,
    loaded: false,
    error: false,
    imageElement: null,
  },
  player_away_sprite: {
    id: 'player_away_sprite',
    label: 'Away Player Kit Sprite (Coral-Rose & Cream)',
    category: 'characters',
    aspectRatio: '1:1',
    recommendedSize: '256×256',
    nanoBananaPrompt:
      'Top-down 2.5D arcade soccer player sprite wearing Coral-Rose (#fb7185) jersey with Cream (#fff1f2) chest stripe and rose visor, facing right, clean bold dark outline, isolated on transparent background.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: true,
    loaded: false,
    error: false,
    imageElement: null,
  },
  keeper_home_sprite: {
    id: 'keeper_home_sprite',
    label: 'Home Goalkeeper Sprite (Teal & Gold Gloves)',
    category: 'characters',
    aspectRatio: '1:1',
    recommendedSize: '256×256',
    nanoBananaPrompt:
      'Top-down 2.5D arcade soccer goalkeeper sprite in bright teal kit (#2dd4bf) with oversized golden goalkeeper gloves (#fde047), facing right, clean dark outline, isolated.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: true,
    loaded: false,
    error: false,
    imageElement: null,
  },
  keeper_away_sprite: {
    id: 'keeper_away_sprite',
    label: 'Away Goalkeeper Sprite (Amber & Gold Gloves)',
    category: 'characters',
    aspectRatio: '1:1',
    recommendedSize: '256×256',
    nanoBananaPrompt:
      'Top-down 2.5D arcade soccer goalkeeper sprite in warm amber kit (#fbbf24) with oversized golden goalkeeper gloves, facing right, clean dark outline, isolated.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: true,
    loaded: false,
    error: false,
    imageElement: null,
  },
  ball_standard_sprite: {
    id: 'ball_standard_sprite',
    label: 'Arcade Match Ball Sprite',
    category: 'props',
    aspectRatio: '1:1',
    recommendedSize: '128×128',
    nanoBananaPrompt:
      'Top-down stylized arcade soccer ball icon, crisp white leather panels with classic dark slate pentagon center, bold cel-shaded outline, isolated.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: true,
    loaded: false,
    error: false,
    imageElement: null,
  },
  ball_super_flow_sprite: {
    id: 'ball_super_flow_sprite',
    label: 'Super Flow Golden Star Ball Sprite',
    category: 'props',
    aspectRatio: '1:1',
    recommendedSize: '128×128',
    nanoBananaPrompt:
      'Top-down stylized golden Super Flow arcade soccer ball (#fef08a) with glowing amber star patterns and crisp dark outline, Nintendo Strikers aesthetic, isolated.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: true,
    loaded: false,
    error: false,
    imageElement: null,
  },
  goal_net_texture: {
    id: 'goal_net_texture',
    label: 'Goal Post & Net Overlay Texture',
    category: 'props',
    aspectRatio: '4:3',
    recommendedSize: '256×512',
    nanoBananaPrompt:
      'Top-down 2D arcade soccer goal frame with clean white metallic posts and diamond nylon net mesh, stylized cel-shaded game asset.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: false,
    loaded: false,
    error: false,
    imageElement: null,
  },
  crowd_fan_sprite: {
    id: 'crowd_fan_sprite',
    label: 'Stadium Bleacher Fan Sprite',
    category: 'environment',
    aspectRatio: '1:1',
    recommendedSize: '64×64',
    nanoBananaPrompt:
      'Top-down cute pastel round stadium crowd character cheering, simple Nintendo mii/capsule style with bold outline.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: false,
    loaded: false,
    error: false,
    imageElement: null,
  },
  meadow_flower_sprite: {
    id: 'meadow_flower_sprite',
    label: 'Coastal Meadow Flower Sprite',
    category: 'environment',
    aspectRatio: '1:1',
    recommendedSize: '64×64',
    nanoBananaPrompt:
      'Top-down cute pastel wildflower blossom for a 2D game grass border, soft yellow/pink petals with white center.',
    src: null,
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    rotateWithEntity: false,
    loaded: false,
    error: false,
    imageElement: null,
  },
};

export class ModularAssetPipeline {
  private slots: Record<AssetSlotId, AssetSlotConfig>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.slots = JSON.parse(JSON.stringify(INITIAL_ASSET_MANIFEST));
  }

  public getManifest(): AssetSlotConfig[] {
    return Object.values(this.slots);
  }

  public getSlot(id: AssetSlotId): AssetSlotConfig {
    return this.slots[id];
  }

  /**
   * Registers or hot-swaps an image URL (e.g. generated via Nano Banana Pro) into a slot.
   * Pass `null` or `""` to revert to the procedural Canvas renderer.
   */
  public registerAsset(id: AssetSlotId, url: string | null, scale = 1.0): Promise<boolean> {
    const slot = this.slots[id];
    if (!slot) return Promise.resolve(false);

    const trimmed = url ? url.trim() : '';
    if (!trimmed) {
      slot.src = null;
      slot.loaded = false;
      slot.error = false;
      slot.imageElement = null;
      this.notify();
      return Promise.resolve(true);
    }

    slot.src = trimmed;
    slot.scale = scale;
    slot.loaded = false;
    slot.error = false;

    return new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(false);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        slot.imageElement = img;
        slot.loaded = true;
        slot.error = false;
        this.notify();
        resolve(true);
      };
      img.onerror = () => {
        slot.imageElement = null;
        slot.loaded = false;
        slot.error = true;
        this.notify();
        resolve(false);
      };
      img.src = trimmed;
    });
  }

  /**
   * Batch-loads a dictionary of `{ [slotId]: url }` assets in parallel.
   */
  public async loadBatch(assetMap: Partial<Record<AssetSlotId, string>>): Promise<void> {
    const tasks: Promise<boolean>[] = [];
    for (const [key, url] of Object.entries(assetMap)) {
      if (key in this.slots && url !== undefined) {
        tasks.push(this.registerAsset(key as AssetSlotId, url));
      }
    }
    await Promise.all(tasks);
  }

  /**
   * Draws a registered sprite if loaded; otherwise executes the procedural fallback function.
   */
  public drawOrFallback(
    ctx: CanvasRenderingContext2D,
    id: AssetSlotId,
    x: number,
    y: number,
    width: number,
    height: number,
    rotationRad: number,
    fallbackFn: () => void
  ): void {
    const slot = this.slots[id];
    if (slot && slot.loaded && slot.imageElement) {
      ctx.save();
      ctx.translate(x, y);
      if (slot.rotateWithEntity && rotationRad !== 0) {
        ctx.rotate(rotationRad);
      }
      const drawW = width * slot.scale;
      const drawH = height * slot.scale;
      ctx.drawImage(
        slot.imageElement,
        -drawW * slot.anchorX,
        -drawH * slot.anchorY,
        drawW,
        drawH
      );
      ctx.restore();
    } else {
      fallbackFn();
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const assetPipeline = new ModularAssetPipeline();
