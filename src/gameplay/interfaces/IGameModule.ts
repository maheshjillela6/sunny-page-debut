/**
 * IGameModule - Interface for modular game components
 */

export interface ModuleConfig {
  id: string;
  priority?: number;
  dependencies?: string[];
  enabled?: boolean;
}

export interface IGameModule {
  readonly id: string;
  readonly version: string;
  readonly dependencies: string[];

  initialize(config: ModuleConfig): Promise<void>;
  
  start(): void;
  
  update(deltaTime: number): void;
  
  pause(): void;
  
  resume(): void;
  
  isReady(): boolean;
  
  destroy(): void;
}

export default IGameModule;
