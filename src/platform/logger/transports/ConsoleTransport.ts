/**
 * ConsoleTransport - Logs to browser console
 */

import { LogEntry } from '../Logger';
import { LogFormatter } from '../LogFormatter';

export function createConsoleTransport() {
  return (entry: LogEntry): void => {
    const formatted = LogFormatter.format(entry);
    console.log(formatted);
  };
}
