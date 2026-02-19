/**
 * ConfigHierarchy - Manages hierarchical configuration resolution
 * Priority: Game-specific config → Shared/common config → Built-in defaults
 * 
 * This ensures all configuration is properly merged with the correct priority,
 * allowing games to override only what they need while inheriting sensible defaults.
 */

export interface ConfigSource {
  name: string;
  priority: number; // Higher = more priority
  data: Record<string, any>;
}

export class ConfigHierarchy {
  private sources: ConfigSource[] = [];
  private mergedCache: Map<string, any> = new Map();

  /**
   * Register a configuration source
   */
  public registerSource(name: string, priority: number, data: Record<string, any>): void {
    // Remove existing source with same name
    this.sources = this.sources.filter(s => s.name !== name);
    
    this.sources.push({ name, priority, data });
    this.sources.sort((a, b) => a.priority - b.priority); // Lower priority first
    
    // Clear cache when sources change
    this.mergedCache.clear();
  }

  /**
   * Get a value with hierarchical resolution
   * Checks sources from highest priority to lowest
   */
  public get<T>(path: string, defaultValue?: T): T {
    // Check cache
    const cacheKey = path;
    if (this.mergedCache.has(cacheKey)) {
      return this.mergedCache.get(cacheKey);
    }

    // Search from highest priority to lowest
    for (let i = this.sources.length - 1; i >= 0; i--) {
      const value = this.getValueFromPath(this.sources[i].data, path);
      if (value !== undefined) {
        this.mergedCache.set(cacheKey, value);
        return value as T;
      }
    }

    return defaultValue as T;
  }

  /**
   * Get deeply merged configuration object
   * All sources are merged with proper priority
   */
  public getMerged<T>(path?: string): T {
    const cacheKey = `__merged__${path ?? 'root'}`;
    if (this.mergedCache.has(cacheKey)) {
      return this.mergedCache.get(cacheKey);
    }

    let merged: any = {};

    // Merge from lowest priority to highest
    for (const source of this.sources) {
      const sourceData = path ? this.getValueFromPath(source.data, path) : source.data;
      if (sourceData && typeof sourceData === 'object') {
        merged = this.deepMerge(merged, sourceData);
      }
    }

    this.mergedCache.set(cacheKey, merged);
    return merged as T;
  }

  /**
   * Get value from object using dot notation path
   */
  private getValueFromPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Deep merge two objects, with source overriding target
   */
  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    const output = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          source[key] !== null &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          if (
            target[key] !== null &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])
          ) {
            output[key] = this.deepMerge(target[key], source[key]);
          } else {
            output[key] = source[key];
          }
        } else {
          output[key] = source[key];
        }
      }
    }

    return output;
  }

  /**
   * Clear the merge cache
   */
  public clearCache(): void {
    this.mergedCache.clear();
  }

  /**
   * Clear all sources
   */
  public clear(): void {
    this.sources = [];
    this.mergedCache.clear();
  }

  /**
   * Get list of registered sources
   */
  public getSources(): ConfigSource[] {
    return [...this.sources];
  }
}

/**
 * Configuration priority levels
 */
export const CONFIG_PRIORITY = {
  BUILTIN_DEFAULTS: 0,    // Hardcoded fallbacks
  SHARED_DEFAULTS: 10,    // shared/defaults.json
  SHARED_GLOBAL: 20,      // shared/config.global.json
  GAME_BASE: 30,          // Game manifest
  GAME_CONFIG: 40,        // Game-specific config files (grid.config.json, etc.)
  RUNTIME_OVERRIDE: 100,  // Runtime/UI overrides
} as const;

export default ConfigHierarchy;
