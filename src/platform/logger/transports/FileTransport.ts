/**
 * FileTransport - Stores logs in IndexedDB for later retrieval
 */

import { LogEntry } from '../Logger';

export interface FileTransportConfig {
  dbName: string;
  maxEntries: number;
}

export function createFileTransport(config: FileTransportConfig) {
  let db: IDBDatabase | null = null;

  const initDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(config.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains('logs')) {
          database.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  };

  const storeLog = async (entry: LogEntry) => {
    if (!db) {
      db = await initDB();
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(['logs'], 'readwrite');
      const store = transaction.objectStore('logs');
      const request = store.add({ ...entry, id: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  return (entry: LogEntry): void => {
    storeLog(entry).catch((error) => {
      console.error('[FileTransport] Failed to store log:', error);
    });
  };
}

export async function readLogs(dbName: string): Promise<LogEntry[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      const getRequest = store.getAll();

      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

export async function clearLogs(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['logs'], 'readwrite');
      const store = transaction.objectStore('logs');
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    };
  });
}
