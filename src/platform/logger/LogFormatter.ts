/**
 * LogFormatter - Formats log entries
 */

import { LogEntry } from './Logger';
import { logLevelToString } from './LogLevel';

export class LogFormatter {
  public static format(entry: LogEntry): string {
    const time = LogFormatter.formatTime(entry.timestamp);
    const level = logLevelToString(entry.level).padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';

    return `${time} ${level} ${context} ${entry.message}${data}`;
  }

  public static formatJson(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      levelName: logLevelToString(entry.level),
      time: LogFormatter.formatTime(entry.timestamp),
    });
  }

  private static formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString();
  }

  public static formatPretty(entry: LogEntry): string {
    const colors: Record<number, string> = {
      0: '\x1b[31m', // ERROR - red
      1: '\x1b[33m', // WARN - yellow
      2: '\x1b[36m', // INFO - cyan
      3: '\x1b[90m', // DEBUG - gray
      4: '\x1b[90m', // TRACE - gray
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level] || reset;

    return `${color}${LogFormatter.format(entry)}${reset}`;
  }
}

export default LogFormatter;
