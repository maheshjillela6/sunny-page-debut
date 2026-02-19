/**
 * SlotPlugin - Base class for game plugins
 */

export enum PluginPriority {
  CRITICAL = 0,
  HIGH = 25,
  NORMAL = 50,
  LOW = 75,
  OPTIONAL = 100,
}

export interface PluginConfig {
  id: string;
  version: string;
  priority: PluginPriority;
  dependencies: string[];
  enabled: boolean;
}

export abstract class SlotPlugin {
  public readonly id: string;
  public readonly version: string;
  public readonly priority: PluginPriority;
  public readonly dependencies: string[];
  protected enabled: boolean;

  constructor(config: PluginConfig) {
    this.id = config.id;
    this.version = config.version;
    this.priority = config.priority;
    this.dependencies = config.dependencies;
    this.enabled = config.enabled;
  }

  public abstract onLoad(): Promise<void>;
  public abstract onUnload(): Promise<void>;
  public abstract onEnable(): void;
  public abstract onDisable(): void;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public enable(): void {
    if (!this.enabled) {
      this.enabled = true;
      this.onEnable();
    }
  }

  public disable(): void {
    if (this.enabled) {
      this.enabled = false;
      this.onDisable();
    }
  }

  public getDependencies(): string[] {
    return [...this.dependencies];
  }

  public getInfo(): PluginConfig {
    return {
      id: this.id,
      version: this.version,
      priority: this.priority,
      dependencies: [...this.dependencies],
      enabled: this.enabled,
    };
  }
}

export default SlotPlugin;
