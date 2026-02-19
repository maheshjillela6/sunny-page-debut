/**
 * Scheduler - Central scheduling system for game events and animations
 */

import { EventBus } from '@/platform/events/EventBus';

export interface ScheduledTask {
  id: string;
  callback: () => void;
  delay: number;
  repeat: boolean;
  interval: number;
  lastRun: number;
  paused: boolean;
}

export class Scheduler {
  private static instance: Scheduler | null = null;

  private tasks: Map<string, ScheduledTask> = new Map();
  private eventBus: EventBus;
  private isPaused: boolean = false;
  private nextId: number = 0;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  public schedule(callback: () => void, delay: number, id?: string): string {
    const taskId = id || `task_${++this.nextId}`;
    
    const task: ScheduledTask = {
      id: taskId,
      callback,
      delay,
      repeat: false,
      interval: 0,
      lastRun: 0,
      paused: false,
    };

    this.tasks.set(taskId, task);

    setTimeout(() => {
      if (!this.isPaused && !task.paused) {
        this.executeTask(task);
      }
    }, delay);

    return taskId;
  }

  public scheduleRepeating(callback: () => void, interval: number, id?: string): string {
    const taskId = id || `task_${++this.nextId}`;
    
    const task: ScheduledTask = {
      id: taskId,
      callback,
      delay: 0,
      repeat: true,
      interval,
      lastRun: Date.now(),
      paused: false,
    };

    this.tasks.set(taskId, task);

    const runTask = () => {
      if (this.tasks.has(taskId)) {
        const t = this.tasks.get(taskId)!;
        if (!this.isPaused && !t.paused) {
          this.executeTask(t);
        }
        if (t.repeat) {
          setTimeout(runTask, t.interval);
        }
      }
    };

    setTimeout(runTask, interval);

    return taskId;
  }

  public cancel(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  public cancelAll(): void {
    this.tasks.clear();
  }

  public pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.paused = true;
    }
  }

  public resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.paused = false;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  private executeTask(task: ScheduledTask): void {
    try {
      task.callback();
      task.lastRun = Date.now();
      
      if (!task.repeat) {
        this.tasks.delete(task.id);
      }
    } catch (error) {
      console.error(`[Scheduler] Task ${task.id} failed:`, error);
    }
  }

  public getActiveTaskCount(): number {
    return this.tasks.size;
  }

  public destroy(): void {
    this.cancelAll();
    Scheduler.instance = null;
  }
}

export default Scheduler;
