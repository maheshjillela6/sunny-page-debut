/**
 * SpinMechanismRegistry - Central registry for pluggable spin mechanisms
 * Mechanisms are registered by ID and instantiated from config
 */

import { SpinMechanismBase } from './SpinMechanismBase';
import { MechanismConfig, SpinMechanismId } from './SpinMechanismTypes';
import { HoldRespinMechanism } from './mechanisms/HoldRespinMechanism';
import { LockSequenceMechanism } from './mechanisms/LockSequenceMechanism';
import { MultiSpinMechanism } from './mechanisms/MultiSpinMechanism';
import { CollectionMechanism } from './mechanisms/CollectionMechanism';
import { ModifierMechanism } from './mechanisms/ModifierMechanism';
import { TransformationMechanism } from './mechanisms/TransformationMechanism';

type MechanismFactory = (config: any) => SpinMechanismBase;

export class SpinMechanismRegistry {
  private static instance: SpinMechanismRegistry | null = null;
  private factories: Map<SpinMechanismId, MechanismFactory> = new Map();
  private activeInstances: Map<string, SpinMechanismBase> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): SpinMechanismRegistry {
    if (!SpinMechanismRegistry.instance) {
      SpinMechanismRegistry.instance = new SpinMechanismRegistry();
    }
    return SpinMechanismRegistry.instance;
  }

  private registerDefaults(): void {
    this.register('holdRespin', (config) => new HoldRespinMechanism(config));
    this.register('lockSequence', (config) => new LockSequenceMechanism(config));
    this.register('multiSpin', (config) => new MultiSpinMechanism(config));
    this.register('collection', (config) => new CollectionMechanism(config));
    this.register('modifier', (config) => new ModifierMechanism(config));
    this.register('transformation', (config) => new TransformationMechanism(config));
  }

  public register(id: SpinMechanismId, factory: MechanismFactory): void {
    this.factories.set(id, factory);
  }

  public create(config: MechanismConfig): SpinMechanismBase | null {
    const factory = this.factories.get(config.id);
    if (!factory) {
      console.warn(`[SpinMechanismRegistry] No factory for mechanism: ${config.id}`);
      return null;
    }
    return factory(config);
  }

  /** Create and track an active instance */
  public activate(config: MechanismConfig, instanceKey?: string): SpinMechanismBase | null {
    const mechanism = this.create(config);
    if (mechanism) {
      const key = instanceKey ?? config.id;
      this.activeInstances.set(key, mechanism);
    }
    return mechanism;
  }

  public getActive(key: string): SpinMechanismBase | null {
    return this.activeInstances.get(key) ?? null;
  }

  public deactivate(key: string): void {
    const instance = this.activeInstances.get(key);
    if (instance) {
      instance.cancel();
      this.activeInstances.delete(key);
    }
  }

  public deactivateAll(): void {
    for (const [key] of this.activeInstances) {
      this.deactivate(key);
    }
  }

  public getRegisteredIds(): SpinMechanismId[] {
    return Array.from(this.factories.keys());
  }

  public has(id: SpinMechanismId): boolean {
    return this.factories.has(id);
  }

  public static reset(): void {
    SpinMechanismRegistry.instance = null;
  }
}
