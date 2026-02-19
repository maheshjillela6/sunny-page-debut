/**
 * Logger - Centralized logging system
 */

import { LogLevel } from './LogLevel';
import { LogFormatter } from './LogFormatter';
 import { LoggerController } from './LoggerController';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  data?: unknown;
}

export type LogTransport = (entry: LogEntry) => void;

export class Logger {
  private static instance: Logger | null = null;

  private level: LogLevel = LogLevel.INFO;
  private context: string = '';
  private transports: LogTransport[] = [];

  private constructor() {
     this.addControlledTransport();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public static create(context: string): Logger {
    const logger = new Logger();
    logger.context = context;
    return logger;
  }

   private addControlledTransport(): void {
     // Use LoggerController for centralized control
     const controller = LoggerController.getInstance();
     this.transports.push(controller.getTransport());
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  public clearTransports(): void {
    this.transports = [];
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.context,
      data,
    };

    for (const transport of this.transports) {
      try {
        transport(entry);
      } catch (error) {
        console.error('Logger transport error:', error);
      }
    }
  }

  public error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  public info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  public debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  public trace(message: string, data?: unknown): void {
    this.log(LogLevel.TRACE, message, data);
  }
}

export default Logger;
