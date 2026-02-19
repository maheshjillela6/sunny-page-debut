/**
 * RemoteTransport - Sends logs to remote server
 */

import { LogEntry } from '../Logger';
import { LogFormatter } from '../LogFormatter';

export interface RemoteTransportConfig {
  url: string;
  batchSize: number;
  flushInterval: number;
  headers?: Record<string, string>;
}

export function createRemoteTransport(config: RemoteTransportConfig) {
  const buffer: LogEntry[] = [];
  let timer: number | null = null;

  const flush = async () => {
    if (buffer.length === 0) return;

    const entries = buffer.splice(0, config.batchSize);

    try {
      await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify({ logs: entries.map(LogFormatter.formatJson) }),
      });
    } catch (error) {
      console.error('[RemoteTransport] Failed to send logs:', error);
    }
  };

  const scheduleFlush = () => {
    if (timer === null) {
      timer = window.setTimeout(() => {
        timer = null;
        flush();
      }, config.flushInterval);
    }
  };

  return (entry: LogEntry): void => {
    buffer.push(entry);

    if (buffer.length >= config.batchSize) {
      flush();
    } else {
      scheduleFlush();
    }
  };
}
