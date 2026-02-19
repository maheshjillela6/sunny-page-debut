/**
 * AssetResolver - Resolves asset paths based on game and environment
 * Asset paths: public/assets/games/slots/gamename/[spine,atlases,images,audios,fonts]
 */

export interface AssetPath {
  key: string;
  url: string;
  type: AssetType;
  priority: number;
}

export enum AssetType {
  TEXTURE = 'texture',
  SPRITESHEET = 'spritesheet',
  ATLAS = 'atlas',
  SPINE = 'spine',
  AUDIO = 'audio',
  FONT = 'font',
  VIDEO = 'video',
  JSON = 'json',
  IMAGE = 'image',
}

export interface AssetManifest {
  version: string;
  basePath: string;
  assets: AssetPath[];
}

export class AssetResolver {
  private static instance: AssetResolver | null = null;
  
  // Base path for all game assets
  private basePath: string = '/assets/games/slots';
  private gameName: string = '';
  private cacheBuster: string = '';
  private cdnUrl: string = '';

  private constructor() {}

  public static getInstance(): AssetResolver {
    if (!AssetResolver.instance) {
      AssetResolver.instance = new AssetResolver();
    }
    return AssetResolver.instance;
  }

  /**
   * Set the base path for assets
   */
  public setBasePath(path: string): void {
    this.basePath = path;
  }

  /**
   * Set the current game name
   */
  public setGameName(gameName: string): void {
    this.gameName = gameName;
    console.log(`[AssetResolver] Game set to: ${gameName}`);
  }

  /**
   * Alias for setGameName for compatibility
   */
  public setGamePath(gameId: string): void {
    this.setGameName(gameId);
  }

  /**
   * Set CDN URL for production
   */
  public setCDN(url: string): void {
    this.cdnUrl = url;
  }

  /**
   * Set cache buster version
   */
  public setCacheBuster(version: string): void {
    this.cacheBuster = version;
  }

  /**
   * Get the full game path
   */
  public getGamePath(): string {
    return `${this.basePath}/${this.gameName}`;
  }

  /**
   * Resolve a shared asset path
   */
  public resolveShared(path: string): string {
    return this.buildUrl(`/assets/shared/${path}`);
  }

  /**
   * Resolve a game-specific asset path
   */
  public resolveGame(path: string): string {
    return this.buildUrl(`${this.basePath}/${this.gameName}/${path}`);
  }

  /**
   * Resolve an asset path by type
   */
  public resolve(type: AssetType, key: string): string {
    const typeFolder = this.getTypeFolder(type);
    return this.resolveGame(`${typeFolder}/${key}`);
  }

  /**
   * Resolve manifest path for a game
   */
  public resolveManifest(gameName: string): string {
    return this.buildUrl(`${this.basePath}/${gameName}/manifest.json`);
  }

  /**
   * Resolve symbol texture
   */
  public resolveSymbol(symbolId: string): string {
    return this.resolveGame(`images/symbols/${symbolId}.png`);
  }

  /**
   * Resolve audio file
   */
  public resolveAudio(audioKey: string): string {
    return this.resolveGame(`audios/${audioKey}`);
  }

  /**
   * Resolve spine asset (json file)
   */
  public resolveSpine(spineKey: string): string {
    return this.resolveGame(`spine/${spineKey}/${spineKey}.json`);
  }

  /**
   * Resolve spine atlas
   */
  public resolveSpineAtlas(spineKey: string): string {
    return this.resolveGame(`spine/${spineKey}/${spineKey}.atlas`);
  }

  /**
   * Resolve atlas/spritesheet
   */
  public resolveAtlas(atlasKey: string): string {
    return this.resolveGame(`atlases/${atlasKey}.json`);
  }

  /**
   * Resolve image
   */
  public resolveImage(imagePath: string): string {
    return this.resolveGame(`images/${imagePath}`);
  }

  /**
   * Resolve font
   */
  public resolveFont(fontKey: string): string {
    return this.resolveGame(`fonts/${fontKey}`);
  }

  /**
   * Resolve video
   */
  public resolveVideo(videoKey: string): string {
    return this.resolveGame(`videos/${videoKey}`);
  }

  /**
   * Get folder name for asset type
   */
  private getTypeFolder(type: AssetType): string {
    const folders: Record<AssetType, string> = {
      [AssetType.TEXTURE]: 'images',
      [AssetType.IMAGE]: 'images',
      [AssetType.SPRITESHEET]: 'atlases',
      [AssetType.ATLAS]: 'atlases',
      [AssetType.SPINE]: 'spine',
      [AssetType.AUDIO]: 'audios',
      [AssetType.FONT]: 'fonts',
      [AssetType.VIDEO]: 'videos',
      [AssetType.JSON]: 'data',
    };
    return folders[type];
  }

  /**
   * Build final URL with CDN and cache buster
   */
  private buildUrl(path: string): string {
    let url = path;
    
    if (this.cdnUrl) {
      url = `${this.cdnUrl}${path}`;
    }

    if (this.cacheBuster) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}v=${this.cacheBuster}`;
    }

    return url;
  }

  /**
   * Parse an asset manifest
   */
  public parseManifest(manifest: AssetManifest): AssetPath[] {
    return manifest.assets.map(asset => ({
      ...asset,
      url: this.buildUrl(`${manifest.basePath}/${asset.url}`),
    }));
  }

  /**
   * Create asset paths from game manifest
   */
  public createAssetPaths(gameName: string, assets: {
    spine?: string[];
    atlases?: string[];
    images?: string[];
    audios?: string[];
    fonts?: string[];
  }): AssetPath[] {
    const paths: AssetPath[] = [];
    let priority = 0;

    // Spine assets (highest priority)
    if (assets.spine) {
      for (const key of assets.spine) {
        paths.push({
          key: `spine_${key}`,
          url: this.resolveSpine(key),
          type: AssetType.SPINE,
          priority: priority++,
        });
      }
    }

    // Atlases
    if (assets.atlases) {
      for (const key of assets.atlases) {
        paths.push({
          key: `atlas_${key}`,
          url: this.resolveAtlas(key),
          type: AssetType.ATLAS,
          priority: priority++,
        });
      }
    }

    // Images
    if (assets.images) {
      for (const key of assets.images) {
        paths.push({
          key: `image_${key}`,
          url: this.resolveImage(key),
          type: AssetType.IMAGE,
          priority: priority++,
        });
      }
    }

    // Audios
    if (assets.audios) {
      for (const key of assets.audios) {
        paths.push({
          key: `audio_${key}`,
          url: this.resolveAudio(key),
          type: AssetType.AUDIO,
          priority: priority++,
        });
      }
    }

    // Fonts
    if (assets.fonts) {
      for (const key of assets.fonts) {
        paths.push({
          key: `font_${key}`,
          url: this.resolveFont(key),
          type: AssetType.FONT,
          priority: priority++,
        });
      }
    }

    return paths;
  }

  public static reset(): void {
    AssetResolver.instance = null;
  }
}
