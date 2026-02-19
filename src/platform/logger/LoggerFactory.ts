/**
 * LoggerFactory - Creates configured loggers
 */

import { Logger } from './Logger';
import { LogLevel, stringToLogLevel } from './LogLevel';

export class LoggerFactory {
  private static defaultLevel: LogLevel = LogLevel.INFO;

  public static setDefaultLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      LoggerFactory.defaultLevel = stringToLogLevel(level);
    } else {
      LoggerFactory.defaultLevel = level;
    }
  }

  public static create(context: string): Logger {
    const logger = Logger.create(context);
    logger.setLevel(LoggerFactory.defaultLevel);
    return logger;
  }

  public static getGlobal(): Logger {
    return Logger.getInstance();
  }
}

export default LoggerFactory;
