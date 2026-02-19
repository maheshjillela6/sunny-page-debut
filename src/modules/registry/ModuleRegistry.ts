/**
 * ModuleRegistry - Central registry for all game modules
 */

import { SlotPlugin } from '../../engine/plugin/SlotPlugin';
import { PluginRegistry } from '../../engine/plugin/PluginRegistry';
import { EventBus } from '../../platform/events/EventBus';
 import { Logger } from '../../platform/logger/Logger';
import { SpinMechanismRegistry } from '../features/spinmechanisms/SpinMechanismRegistry';
// Import all modules
import { CascadeSpinStrategy } from '../mechanics/cascade/CascadeSpinStrategy';
import { ClusterSpinStrategy } from '../mechanics/cluster/ClusterSpinStrategy';
import { MegawaysSpinStrategy } from '../mechanics/megaways/MegawaysSpinStrategy';
import { InfinitySpinStrategy } from '../mechanics/infinity/InfinitySpinStrategy';
import { DualBoardSpinStrategy } from '../mechanics/dualboard/DualBoardSpinStrategy';

import { FreeSpinFeature } from '../features/freespins/FreeSpinFeature';
import { HoldRespinMechanism } from '../features/spinmechanisms/mechanisms/HoldRespinMechanism';
import { StickyWildFeature } from '../features/wilds/StickyWildFeature';
import { ExpandingWildFeature } from '../features/wilds/ExpandingWildFeature';
import { MultiplierFeature } from '../features/multipliers/MultiplierFeature';
import { BonusFeature } from '../features/bonus/BonusFeature';

import { LineEvaluator } from '../winsystems/paylines/LineEvaluator';
import { WaysEvaluator } from '../winsystems/ways/WaysEvaluator';
import { ClusterEvaluator } from '../winsystems/cluster/ClusterEvaluator';
import { MegawaysEvaluator } from '../winsystems/megaways/MegawaysEvaluator';

import { SpinStrategyRegistry } from './SpinStrategyRegistry';

export interface ModuleManifest {
  mechanics: string[];
  features: string[];
  winSystems: string[];
  spinStrategies: string[];
}

export class ModuleRegistry {
  private static instance: ModuleRegistry | null = null;
  
  private pluginRegistry: PluginRegistry;
  private eventBus: EventBus;
  private loadedModules: Map<string, SlotPlugin> = new Map();
  private featureInstances: Map<string, SlotPlugin> = new Map();
   private logger: Logger;

  private constructor() {
    this.pluginRegistry = PluginRegistry.getInstance();
    this.eventBus = EventBus.getInstance();
     this.logger = Logger.create('ModuleRegistry');
  }

  public static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Initialize and register all available modules
   */
  public initialize(): void {
    this.registerSpinStrategies();
    this.registerFeatures();
    this.registerWinSystems();
    this.registerSpinMechanisms();
    
     this.logger.info('Initialized with all modules');
  }

  private registerSpinStrategies(): void {
    const registry = SpinStrategyRegistry.getInstance();
    
    // Register additional strategies
    registry.register('cascade', (config) => new CascadeSpinStrategy(config));
    registry.register('cluster', (config) => new ClusterSpinStrategy(config));
    registry.register('megaways', (config) => new MegawaysSpinStrategy(config));
    registry.register('infinity', (config) => new InfinitySpinStrategy(config));
    registry.register('dualboard', (config) => new DualBoardSpinStrategy(config));
    
     this.logger.info('Spin strategies registered');
  }

  private registerFeatures(): void {
    // Create feature instances
    this.featureInstances.set('freespins', new FreeSpinFeature());
    this.featureInstances.set('stickywild', new StickyWildFeature());
    this.featureInstances.set('expandingwild', new ExpandingWildFeature());
    this.featureInstances.set('multiplier', new MultiplierFeature());
    this.featureInstances.set('bonus', new BonusFeature());

    // Register with plugin registry
    for (const [name, feature] of this.featureInstances) {
      this.pluginRegistry.register(feature);
      this.loadedModules.set(name, feature);
    }

     this.logger.info('Features registered');
  }

  private registerWinSystems(): void {
    const lineEvaluator = new LineEvaluator();
    const waysEvaluator = new WaysEvaluator();
    const clusterEvaluator = new ClusterEvaluator();
    const megawaysEvaluator = new MegawaysEvaluator();

    this.pluginRegistry.register(lineEvaluator);
    this.pluginRegistry.register(waysEvaluator);
    this.pluginRegistry.register(clusterEvaluator);
    this.pluginRegistry.register(megawaysEvaluator);

    this.loadedModules.set('paylines', lineEvaluator);
    this.loadedModules.set('ways', waysEvaluator);
    this.loadedModules.set('cluster', clusterEvaluator);
    this.loadedModules.set('megaways', megawaysEvaluator);

     this.logger.info('Win systems registered');
  }

  private registerSpinMechanisms(): void {
    // Initialize the mechanism registry (auto-registers defaults)
    SpinMechanismRegistry.getInstance();
    this.logger.info('Spin mechanisms registered');
  }

  /**
   * Load modules from a game manifest
   */
  public async loadFromManifest(manifest: ModuleManifest): Promise<void> {
    // Enable specified features
    for (const featureName of manifest.features) {
      const feature = this.featureInstances.get(featureName);
      if (feature) {
        feature.enable();
      }
    }

    // Set default spin strategy
    if (manifest.spinStrategies.length > 0) {
      const registry = SpinStrategyRegistry.getInstance();
      registry.setDefault(manifest.spinStrategies[0]);
    }

    await this.pluginRegistry.loadAll();
     this.logger.info('Loaded modules from manifest');
  }

  /**
   * Get a loaded module by name
   */
  public getModule<T extends SlotPlugin>(name: string): T | null {
    return (this.loadedModules.get(name) as T) ?? null;
  }

  /**
   * Get feature instance
   */
  public getFeature<T extends SlotPlugin>(name: string): T | null {
    return (this.featureInstances.get(name) as T) ?? null;
  }

  /**
   * Check if a module is loaded
   */
  public hasModule(name: string): boolean {
    return this.loadedModules.has(name);
  }

  /**
   * Get all loaded module names
   */
  public getLoadedModules(): string[] {
    return Array.from(this.loadedModules.keys());
  }

  /**
   * Unload all modules
   */
  public async unloadAll(): Promise<void> {
    await this.pluginRegistry.unloadAll();
    this.loadedModules.clear();
    this.featureInstances.clear();
     this.logger.info('All modules unloaded');
  }

  public static reset(): void {
    ModuleRegistry.instance = null;
  }
}
