/**
 * Engine.Audio — AudioSpriteLoader
 *
 * Namespace: EngineAudio
 * Responsible for fetching Howler.js sprite manifests, resolving
 * absolute asset URLs, and creating Howl instances.
 *
 * Completely stateless per-game — all games share engine-level sprite packs.
 * Import: import { AudioSpriteLoader } from '@/engine/audio/AudioSpriteLoader';
 */

import { Howl, SoundSpriteDefinitions } from 'howler';
import { EngineAudio } from './types/AudioTypes';

const NS = '[Engine.Audio.SpriteLoader]';

interface HowlEntry {
  howl:   Howl;
  pack:   EngineAudio.SpritePack;
  loaded: boolean;
}

export class AudioSpriteLoader {
  private static instance: AudioSpriteLoader | null = null;
  private howls: Map<EngineAudio.SpritePack, HowlEntry> = new Map();

  private constructor() {}

  public static getInstance(): AudioSpriteLoader {
    if (!AudioSpriteLoader.instance) {
      AudioSpriteLoader.instance = new AudioSpriteLoader();
    }
    return AudioSpriteLoader.instance;
  }

  // ─── Load a sprite pack from its JSON manifest ──────────────────────────

  public async load(
    pack:     EngineAudio.SpritePack,
    basePath: string
  ): Promise<EngineAudio.LoadResult> {
    if (this.howls.has(pack)) {
      console.warn(`${NS} Pack "${pack}" already loaded — skipping.`);
      return { pack, success: true };
    }

    const manifestUrl = `${basePath}/${pack}.json`;
    console.log(`${NS} Fetching manifest: ${manifestUrl}`);

    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${manifestUrl}`);

      const manifest: EngineAudio.SpriteManifest = await res.json();

      // Resolve absolute audio URLs from the manifest's urls array
      const resolvedUrls = manifest.urls.map((u) =>
        u.startsWith('http') ? u : `${basePath}/${u}`
      );

      // Normalize sprite entries to satisfy Howler's strict tuple types
      const normalizedSprites: SoundSpriteDefinitions = {};
      for (const [key, entry] of Object.entries(manifest.sprite)) {
        const [offset, duration, loop] = entry;
        normalizedSprites[key] = loop !== undefined
          ? [offset, duration, loop]
          : [offset, duration];
      }

      return new Promise<EngineAudio.LoadResult>((resolve) => {
        const howl = new Howl({
          src:    resolvedUrls,
          sprite: normalizedSprites,
          volume: 1, // Full volume — AudioManager applies per-channel volumes on play
          onload: () => {
            const entry = this.howls.get(pack);
            if (entry) entry.loaded = true;
            const count = Object.keys(normalizedSprites).length;
            console.log(`${NS} ✓ "${pack}" loaded — ${count} sprites`);
            resolve({ pack, success: true });
          },
          onloaderror: (_id, err) => {
            console.error(`${NS} ✗ Load error for "${pack}":`, err);
            this.howls.delete(pack);
            resolve({ pack, success: false, error: new Error(String(err)) });
          },
        });

        this.howls.set(pack, { howl, pack, loaded: false });
      });
    } catch (error) {
      console.error(`${NS} Failed to fetch manifest for "${pack}":`, error);
      return { pack, success: false, error: error as Error };
    }
  }

  // ─── Accessors ──────────────────────────────────────────────────────────

  public getHowl(pack: EngineAudio.SpritePack): Howl | null {
    return this.howls.get(pack)?.howl ?? null;
  }

  public isLoaded(pack: EngineAudio.SpritePack): boolean {
    return this.howls.get(pack)?.loaded === true;
  }

  public getLoadedPacks(): EngineAudio.SpritePack[] {
    return Array.from(this.howls.entries())
      .filter(([, e]) => e.loaded)
      .map(([pack]) => pack);
  }

  /** List all sprite keys registered in a pack */
  public getSpriteKeys(pack: EngineAudio.SpritePack): string[] {
    const howl = this.getHowl(pack);
    if (!howl) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.keys((howl as any)._sprite ?? {});
  }

  /** Guard: check if a specific sprite key exists */
  public hasSprite(pack: EngineAudio.SpritePack, key: string): boolean {
    return this.getSpriteKeys(pack).includes(key);
  }

  // ─── Teardown ────────────────────────────────────────────────────────────

  public unload(pack: EngineAudio.SpritePack): void {
    const entry = this.howls.get(pack);
    if (entry) {
      entry.howl.unload();
      this.howls.delete(pack);
      console.log(`${NS} Pack unloaded: ${pack}`);
    }
  }

  public destroy(): void {
    this.howls.forEach((entry) => entry.howl.unload());
    this.howls.clear();
    AudioSpriteLoader.instance = null;
    console.log(`${NS} Destroyed`);
  }
}
