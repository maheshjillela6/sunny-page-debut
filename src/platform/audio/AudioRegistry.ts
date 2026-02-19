/**
 * AudioRegistry - Registry of available sounds
 */

import { SoundConfig } from './SoundManager';

export class AudioRegistry {
  private static instance: AudioRegistry | null = null;

  private sounds: Map<string, SoundConfig> = new Map();

  private constructor() {}

  public static getInstance(): AudioRegistry {
    if (!AudioRegistry.instance) {
      AudioRegistry.instance = new AudioRegistry();
    }
    return AudioRegistry.instance;
  }

  public register(config: SoundConfig): void {
    this.sounds.set(config.id, config);
  }

  public registerMany(configs: SoundConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  public get(id: string): SoundConfig | undefined {
    return this.sounds.get(id);
  }

  public getAll(): SoundConfig[] {
    return Array.from(this.sounds.values());
  }

  public getByGroup(group: 'sfx' | 'music' | 'ui'): SoundConfig[] {
    return Array.from(this.sounds.values()).filter((s) => s.group === group);
  }

  public has(id: string): boolean {
    return this.sounds.has(id);
  }

  public remove(id: string): void {
    this.sounds.delete(id);
  }

  public clear(): void {
    this.sounds.clear();
  }
}

export default AudioRegistry;
