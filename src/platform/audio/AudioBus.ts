/**
 * AudioBus - Audio routing and mixing
 */

export interface AudioBusConfig {
  id: string;
  volume: number;
  parent?: string;
}

export class AudioBus {
  private context: AudioContext;
  private gainNode: GainNode;
  private id: string;
  private children: AudioBus[] = [];

  constructor(context: AudioContext, config: AudioBusConfig) {
    this.context = context;
    this.id = config.id;

    this.gainNode = context.createGain();
    this.gainNode.gain.value = config.volume;
  }

  public getId(): string {
    return this.id;
  }

  public getGainNode(): GainNode {
    return this.gainNode;
  }

  public connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  public disconnect(): void {
    this.gainNode.disconnect();
  }

  public addChild(bus: AudioBus): void {
    bus.connect(this.gainNode);
    this.children.push(bus);
  }

  public removeChild(busId: string): void {
    const index = this.children.findIndex((b) => b.getId() === busId);
    if (index !== -1) {
      this.children[index].disconnect();
      this.children.splice(index, 1);
    }
  }

  public setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  public getVolume(): number {
    return this.gainNode.gain.value;
  }

  public mute(): void {
    this.gainNode.gain.value = 0;
  }

  public unmute(volume: number = 1): void {
    this.gainNode.gain.value = volume;
  }
}

export default AudioBus;
