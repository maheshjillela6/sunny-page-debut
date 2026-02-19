/**
 * PixiFactory - Production-grade factory for creating and configuring display objects
 * Centralizes creation of Container, Sprite, AnimatedSprite, Graphics, and Spine
 */

import {
  Container,
  Sprite,
  AnimatedSprite,
  Graphics,
  Texture,
  TextStyle,
  Text,
} from 'pixi.js';
import { TextureCache } from '../assets/TextureCache';

/** Common properties that can be applied to any display object */
export interface DisplayObjectProps {
  // Transform
  x?: number;
  y?: number;
  position?: { x: number; y: number };
  scale?: number | { x: number; y: number };
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  angle?: number;
  pivot?: { x: number; y: number };
  skew?: { x: number; y: number };

  // Appearance
  alpha?: number;
  tint?: number;
  visible?: boolean;
  blendMode?: string;

  // Hierarchy
  parent?: Container;
  zIndex?: number;
  label?: string;

  // Mask
  mask?: Container | Graphics | null;

  // Interactivity
  interactive?: boolean;
  cursor?: string;
  hitArea?: any;
  eventMode?: 'none' | 'passive' | 'auto' | 'static' | 'dynamic';
}

/** Sprite-specific properties */
export interface SpriteProps extends DisplayObjectProps {
  texture?: Texture | string;
  anchor?: number | { x: number; y: number };
  anchorX?: number;
  anchorY?: number;
  width?: number;
  height?: number;
  roundPixels?: boolean;
}

/** AnimatedSprite properties */
export interface AnimatedSpriteProps extends SpriteProps {
  textures?: Texture[] | string[];
  animationSpeed?: number;
  loop?: boolean;
  autoPlay?: boolean;
  onComplete?: () => void;
  onLoop?: () => void;
  onFrameChange?: (frame: number) => void;
}

/** Graphics-specific properties */
export interface GraphicsProps extends DisplayObjectProps {
  // Will be set after creation via draw methods
}

/** Text-specific properties */
export interface TextProps extends DisplayObjectProps {
  text?: string;
  style?: Partial<TextStyle> | TextStyle;
  anchor?: number | { x: number; y: number };
}

/**
 * PixiFactory - Centralized factory for creating Pixi display objects
 */
export class PixiFactory {
  private static instance: PixiFactory | null = null;
  private textureCache: TextureCache;

  private constructor() {
    this.textureCache = TextureCache.getInstance();
  }

  /** Get singleton instance */
  public static getInstance(): PixiFactory {
    if (!PixiFactory.instance) {
      PixiFactory.instance = new PixiFactory();
    }
    return PixiFactory.instance;
  }

  // ==================== CONTAINER ====================

  /**
   * Create a Container with optional properties
   */
  public createContainer(props: DisplayObjectProps = {}): Container {
    const container = new Container();
    this.applyProperties(container, props);
    return container;
  }

  // ==================== SPRITE ====================

  /**
   * Create a Sprite from texture key or Texture object
   */
  public createSprite(props: SpriteProps = {}): Sprite {
    let texture: Texture = Texture.EMPTY;

    if (props.texture) {
      if (typeof props.texture === 'string') {
        texture = this.textureCache.getSync(props.texture) || Texture.EMPTY;
      } else {
        texture = props.texture;
      }
    }

    const sprite = new Sprite(texture);
    this.applySpriteProperties(sprite, props);
    this.applyProperties(sprite, props);
    return sprite;
  }

  /**
   * Create a Sprite from texture key (alias)
   */
  public createSpriteFromKey(key: string, props: Omit<SpriteProps, 'texture'> = {}): Sprite {
    return this.createSprite({ ...props, texture: key });
  }

  // ==================== ANIMATED SPRITE ====================

  /**
   * Create an AnimatedSprite
   */
  public createAnimatedSprite(props: AnimatedSpriteProps = {}): AnimatedSprite {
    let textures: Texture[] = [];

    if (props.textures) {
      textures = props.textures.map((t) => {
        if (typeof t === 'string') {
          return this.textureCache.get(t) || Texture.EMPTY;
        }
        return t;
      });
    }

    // Ensure at least one texture
    if (textures.length === 0) {
      textures = [Texture.EMPTY];
    }

    const animatedSprite = new AnimatedSprite(textures);
    this.applyAnimatedSpriteProperties(animatedSprite, props);
    this.applySpriteProperties(animatedSprite, props);
    this.applyProperties(animatedSprite, props);
    return animatedSprite;
  }

  // ==================== GRAPHICS ====================

  /**
   * Create an empty Graphics object for drawing
   */
  public createGraphics(props: GraphicsProps = {}): Graphics {
    const graphics = new Graphics();
    this.applyProperties(graphics, props);
    return graphics;
  }

  /**
   * Create a rectangle Graphics
   */
  public createRect(
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      fill?: number;
      fillAlpha?: number;
      stroke?: number;
      strokeWidth?: number;
      strokeAlpha?: number;
      radius?: number;
    } & GraphicsProps = {}
  ): Graphics {
    const graphics = new Graphics();

    if (options.radius && options.radius > 0) {
      graphics.roundRect(x, y, width, height, options.radius);
    } else {
      graphics.rect(x, y, width, height);
    }

    if (options.fill !== undefined) {
      graphics.fill({ color: options.fill, alpha: options.fillAlpha ?? 1 });
    }

    if (options.stroke !== undefined) {
      graphics.stroke({
        color: options.stroke,
        width: options.strokeWidth ?? 1,
        alpha: options.strokeAlpha ?? 1,
      });
    }

    this.applyProperties(graphics, options);
    return graphics;
  }

  /**
   * Create a circle Graphics
   */
  public createCircle(
    x: number,
    y: number,
    radius: number,
    options: {
      fill?: number;
      fillAlpha?: number;
      stroke?: number;
      strokeWidth?: number;
      strokeAlpha?: number;
    } & GraphicsProps = {}
  ): Graphics {
    const graphics = new Graphics();
    graphics.circle(x, y, radius);

    if (options.fill !== undefined) {
      graphics.fill({ color: options.fill, alpha: options.fillAlpha ?? 1 });
    }

    if (options.stroke !== undefined) {
      graphics.stroke({
        color: options.stroke,
        width: options.strokeWidth ?? 1,
        alpha: options.strokeAlpha ?? 1,
      });
    }

    this.applyProperties(graphics, options);
    return graphics;
  }

  /**
   * Create an ellipse Graphics
   */
  public createEllipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    options: {
      fill?: number;
      fillAlpha?: number;
      stroke?: number;
      strokeWidth?: number;
    } & GraphicsProps = {}
  ): Graphics {
    const graphics = new Graphics();
    graphics.ellipse(x, y, radiusX, radiusY);

    if (options.fill !== undefined) {
      graphics.fill({ color: options.fill, alpha: options.fillAlpha ?? 1 });
    }

    if (options.stroke !== undefined) {
      graphics.stroke({
        color: options.stroke,
        width: options.strokeWidth ?? 1,
      });
    }

    this.applyProperties(graphics, options);
    return graphics;
  }

  /**
   * Create a polygon Graphics
   */
  public createPolygon(
    points: number[] | { x: number; y: number }[],
    options: {
      fill?: number;
      fillAlpha?: number;
      stroke?: number;
      strokeWidth?: number;
    } & GraphicsProps = {}
  ): Graphics {
    const graphics = new Graphics();

    // Convert point objects to flat array if needed
    const flatPoints =
      typeof points[0] === 'number'
        ? (points as number[])
        : (points as { x: number; y: number }[]).flatMap((p) => [p.x, p.y]);

    graphics.poly(flatPoints);

    if (options.fill !== undefined) {
      graphics.fill({ color: options.fill, alpha: options.fillAlpha ?? 1 });
    }

    if (options.stroke !== undefined) {
      graphics.stroke({
        color: options.stroke,
        width: options.strokeWidth ?? 1,
      });
    }

    this.applyProperties(graphics, options);
    return graphics;
  }

  /**
   * Create a line Graphics
   */
  public createLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: {
      color?: number;
      width?: number;
      alpha?: number;
    } & GraphicsProps = {}
  ): Graphics {
    const graphics = new Graphics();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke({
      color: options.color ?? 0xffffff,
      width: options.width ?? 1,
      alpha: options.alpha ?? 1,
    });

    this.applyProperties(graphics, options);
    return graphics;
  }

  // ==================== TEXT ====================

  /**
   * Create a Text object
   */
  public createText(props: TextProps = {}): Text {
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      ...(props.style || {}),
    });

    const text = new Text({ text: props.text || '', style });

    if (props.anchor !== undefined) {
      if (typeof props.anchor === 'number') {
        text.anchor.set(props.anchor);
      } else {
        text.anchor.set(props.anchor.x, props.anchor.y);
      }
    }

    this.applyProperties(text, props);
    return text;
  }

  // ==================== SHARED PROPERTY APPLICATION ====================

  /**
   * Apply common properties to any display object
   */
  public applyProperties<T extends Container>(obj: T, props: DisplayObjectProps): T {
    // Position
    if (props.position !== undefined) {
      obj.position.set(props.position.x, props.position.y);
    } else {
      if (props.x !== undefined) obj.x = props.x;
      if (props.y !== undefined) obj.y = props.y;
    }

    // Scale
    if (props.scale !== undefined) {
      if (typeof props.scale === 'number') {
        obj.scale.set(props.scale);
      } else {
        obj.scale.set(props.scale.x, props.scale.y);
      }
    }
    if (props.scaleX !== undefined) obj.scale.x = props.scaleX;
    if (props.scaleY !== undefined) obj.scale.y = props.scaleY;

    // Rotation
    if (props.rotation !== undefined) obj.rotation = props.rotation;
    if (props.angle !== undefined) obj.angle = props.angle;

    // Pivot
    if (props.pivot !== undefined) {
      obj.pivot.set(props.pivot.x, props.pivot.y);
    }

    // Skew
    if (props.skew !== undefined) {
      obj.skew.set(props.skew.x, props.skew.y);
    }

    // Appearance
    if (props.alpha !== undefined) obj.alpha = props.alpha;
    if (props.visible !== undefined) obj.visible = props.visible;
    if (props.blendMode !== undefined) (obj as any).blendMode = props.blendMode;

    // Tint (only for objects that support it)
    if (props.tint !== undefined && 'tint' in obj) {
      (obj as any).tint = props.tint;
    }

    // Z-Index
    if (props.zIndex !== undefined) obj.zIndex = props.zIndex;

    // Label
    if (props.label !== undefined) obj.label = props.label;

    // Mask
    if (props.mask !== undefined) obj.mask = props.mask;

    // Interactivity
    if (props.eventMode !== undefined) obj.eventMode = props.eventMode;
    if (props.cursor !== undefined) obj.cursor = props.cursor;
    if (props.hitArea !== undefined) obj.hitArea = props.hitArea;

    // Parent (add to parent last)
    if (props.parent !== undefined) {
      props.parent.addChild(obj);
    }

    return obj;
  }

  /**
   * Apply sprite-specific properties
   */
  private applySpriteProperties(sprite: Sprite, props: SpriteProps): void {
    // Anchor
    if (props.anchor !== undefined) {
      if (typeof props.anchor === 'number') {
        sprite.anchor.set(props.anchor);
      } else {
        sprite.anchor.set(props.anchor.x, props.anchor.y);
      }
    }
    if (props.anchorX !== undefined) sprite.anchor.x = props.anchorX;
    if (props.anchorY !== undefined) sprite.anchor.y = props.anchorY;

    // Size
    if (props.width !== undefined) sprite.width = props.width;
    if (props.height !== undefined) sprite.height = props.height;

    // Round pixels
    if (props.roundPixels !== undefined) sprite.roundPixels = props.roundPixels;
  }

  /**
   * Apply animated sprite-specific properties
   */
  private applyAnimatedSpriteProperties(sprite: AnimatedSprite, props: AnimatedSpriteProps): void {
    if (props.animationSpeed !== undefined) sprite.animationSpeed = props.animationSpeed;
    if (props.loop !== undefined) sprite.loop = props.loop;
    if (props.onComplete !== undefined) sprite.onComplete = props.onComplete;
    if (props.onLoop !== undefined) sprite.onLoop = props.onLoop;
    if (props.onFrameChange !== undefined) sprite.onFrameChange = props.onFrameChange;
    if (props.autoPlay) sprite.play();
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clone display object properties to another object
   */
  public cloneProperties(source: Container, target: Container): void {
    target.position.copyFrom(source.position);
    target.scale.copyFrom(source.scale);
    target.rotation = source.rotation;
    target.alpha = source.alpha;
    target.visible = source.visible;
    target.zIndex = source.zIndex;
  }

  /**
   * Center an object within a container
   */
  public centerIn(obj: Container, bounds: { width: number; height: number }): void {
    const objBounds = obj.getBounds();
    obj.x = (bounds.width - objBounds.width) / 2;
    obj.y = (bounds.height - objBounds.height) / 2;
  }

  /**
   * Position object relative to another
   */
  public positionRelative(
    obj: Container,
    target: Container,
    offset: { x?: number; y?: number } = {}
  ): void {
    const targetBounds = target.getBounds();
    obj.x = targetBounds.x + (offset.x ?? 0);
    obj.y = targetBounds.y + (offset.y ?? 0);
  }

  /**
   * Set anchor to center (for sprites)
   */
  public centerAnchor(sprite: Sprite): void {
    sprite.anchor.set(0.5);
  }

  /**
   * Create a hit area graphics matching object bounds
   */
  public createHitArea(obj: Container, padding: number = 0): Graphics {
    const bounds = obj.getBounds();
    return this.createRect(
      -padding,
      -padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
      { fill: 0xffffff, fillAlpha: 0 }
    );
  }

  /** Reset singleton (for testing) */
  public static reset(): void {
    PixiFactory.instance = null;
  }
}

/** Shorthand factory functions */
export const pixiFactory = {
  container: (props?: DisplayObjectProps) => PixiFactory.getInstance().createContainer(props),
  sprite: (props?: SpriteProps) => PixiFactory.getInstance().createSprite(props),
  spriteFromKey: (key: string, props?: Omit<SpriteProps, 'texture'>) =>
    PixiFactory.getInstance().createSpriteFromKey(key, props),
  animatedSprite: (props?: AnimatedSpriteProps) =>
    PixiFactory.getInstance().createAnimatedSprite(props),
  graphics: (props?: GraphicsProps) => PixiFactory.getInstance().createGraphics(props),
  rect: (
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: Parameters<PixiFactory['createRect']>[4]
  ) => PixiFactory.getInstance().createRect(x, y, w, h, opts),
  circle: (x: number, y: number, r: number, opts?: Parameters<PixiFactory['createCircle']>[3]) =>
    PixiFactory.getInstance().createCircle(x, y, r, opts),
  ellipse: (
    x: number,
    y: number,
    rx: number,
    ry: number,
    opts?: Parameters<PixiFactory['createEllipse']>[4]
  ) => PixiFactory.getInstance().createEllipse(x, y, rx, ry, opts),
  polygon: (points: number[] | { x: number; y: number }[], opts?: Parameters<PixiFactory['createPolygon']>[1]) =>
    PixiFactory.getInstance().createPolygon(points, opts),
  line: (x1: number, y1: number, x2: number, y2: number, opts?: Parameters<PixiFactory['createLine']>[4]) =>
    PixiFactory.getInstance().createLine(x1, y1, x2, y2, opts),
  text: (props?: TextProps) => PixiFactory.getInstance().createText(props),
};
