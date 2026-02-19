/**
 * StompClient - WebSocket STOMP protocol client for real-time game communication
 */

import { EventBus } from '@/platform/events/EventBus';
import { SessionTokenManager } from './SessionTokenManager';

export type StompConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface StompConfig {
  serverUrl: string;
  reconnectDelay: number;
  heartbeatIncoming: number;
  heartbeatOutgoing: number;
  maxReconnectAttempts: number;
  debug: boolean;
}

export interface StompMessage<T = unknown> {
  type: string;
  destination: string;
  payload: T;
  headers?: Record<string, string>;
  timestamp: number;
  correlationId?: string;
}

export interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

export interface StompSubscription {
  id: string;
  destination: string;
  callback: (message: StompMessage) => void;
}

// STOMP frame commands
const STOMP_COMMANDS = {
  CONNECT: 'CONNECT',
  CONNECTED: 'CONNECTED',
  SUBSCRIBE: 'SUBSCRIBE',
  UNSUBSCRIBE: 'UNSUBSCRIBE',
  SEND: 'SEND',
  MESSAGE: 'MESSAGE',
  DISCONNECT: 'DISCONNECT',
  ERROR: 'ERROR',
  RECEIPT: 'RECEIPT',
  ACK: 'ACK',
  NACK: 'NACK',
} as const;

/**
 * StompClient handles WebSocket communication using STOMP protocol
 */
export class StompClient {
  private static instance: StompClient | null = null;

  private config: StompConfig;
  private eventBus: EventBus;
  private tokenManager: SessionTokenManager;
  
  private socket: WebSocket | null = null;
  private state: StompConnectionState = 'disconnected';
  private subscriptions: Map<string, StompSubscription> = new Map();
  private pendingMessages: StompMessage[] = [];
  private reconnectAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  private subscriptionCounter: number = 0;
  private correlationCounter: number = 0;
  private pendingResponses: Map<string, { resolve: (data: any) => void; reject: (error: Error) => void; timeout: number }> = new Map();

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
    
    this.config = {
      serverUrl: 'wss://game-server.example.com/ws',
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      maxReconnectAttempts: 5,
      debug: true,
    };
  }

  public static getInstance(): StompClient {
    if (!StompClient.instance) {
      StompClient.instance = new StompClient();
    }
    return StompClient.instance;
  }

  /**
   * Configure the STOMP client
   */
  public configure(config: Partial<StompConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('Configuration updated:', this.config);
  }

  /**
   * Connect to the STOMP server
   */
  public async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      this.log('Already connected or connecting');
      return;
    }

    this.state = 'connecting';
    this.eventBus.emit('stomp:connecting', { url: this.config.serverUrl });

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.config.serverUrl);

        this.socket.onopen = () => {
          this.log('WebSocket connected, sending STOMP CONNECT');
          this.sendConnect();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
          if (this.state === 'connecting') {
            // Wait for CONNECTED frame
          } else if (this.state === 'connected') {
            resolve();
          }
        };

        this.socket.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.state = 'error';
          this.eventBus.emit('stomp:error', { error: new Error('WebSocket error') });
          reject(new Error('WebSocket connection error'));
        };

        this.socket.onclose = (event) => {
          this.log('WebSocket closed:', event.code, event.reason);
          this.handleDisconnect();
        };

        // Resolve after connected frame is received
        const checkConnected = setInterval(() => {
          if (this.state === 'connected') {
            clearInterval(checkConnected);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          if (this.state !== 'connected') {
            clearInterval(checkConnected);
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        this.state = 'error';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the STOMP server
   */
  public disconnect(): void {
    if (this.state === 'disconnected') return;

    this.log('Disconnecting...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendFrame({ command: STOMP_COMMANDS.DISCONNECT, headers: {}, body: '' });
      this.socket.close();
    }

    this.socket = null;
    this.state = 'disconnected';
    this.subscriptions.clear();
    this.eventBus.emit('stomp:disconnected', {});
  }

  /**
   * Subscribe to a destination
   */
  public subscribe(destination: string, callback: (message: StompMessage) => void): string {
    const id = `sub-${++this.subscriptionCounter}`;
    
    this.subscriptions.set(id, { id, destination, callback });

    if (this.state === 'connected') {
      this.sendSubscribe(id, destination);
    }

    this.log(`Subscribed to ${destination} with id ${id}`);
    return id;
  }

  /**
   * Unsubscribe from a destination
   */
  public unsubscribe(subscriptionId: string): void {
    if (!this.subscriptions.has(subscriptionId)) return;

    if (this.state === 'connected') {
      this.sendFrame({
        command: STOMP_COMMANDS.UNSUBSCRIBE,
        headers: { id: subscriptionId },
        body: '',
      });
    }

    this.subscriptions.delete(subscriptionId);
    this.log(`Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Send a message to a destination
   */
  public send<T>(destination: string, payload: T, headers: Record<string, string> = {}): void {
    const message: StompMessage<T> = {
      type: 'send',
      destination,
      payload,
      headers,
      timestamp: Date.now(),
    };

    if (this.state === 'connected') {
      this.sendMessage(message);
    } else {
      this.log('Not connected, queueing message');
      this.pendingMessages.push(message);
    }
  }

  /**
   * Send a message and wait for response (request/response pattern)
   */
  public async request<TReq, TRes>(
    destination: string,
    payload: TReq,
    timeout: number = 30000
  ): Promise<TRes> {
    const correlationId = `req-${++this.correlationCounter}-${Date.now()}`;

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Request timeout: ${destination}`));
      }, timeout);

      this.pendingResponses.set(correlationId, {
        resolve: (data) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeout: timeoutId,
      });

      this.send(destination, payload, { 'correlation-id': correlationId });
    });
  }

  /**
   * Get current connection state
   */
  public getState(): StompConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state === 'connected';
  }

  // Private methods

  private sendConnect(): void {
    const headers: Record<string, string> = {
      'accept-version': '1.2',
      'heart-beat': `${this.config.heartbeatOutgoing},${this.config.heartbeatIncoming}`,
      'Authorization': `Bearer ${this.tokenManager.getToken()}`,
    };

    this.sendFrame({
      command: STOMP_COMMANDS.CONNECT,
      headers,
      body: '',
    });
  }

  private sendSubscribe(id: string, destination: string): void {
    this.sendFrame({
      command: STOMP_COMMANDS.SUBSCRIBE,
      headers: {
        id,
        destination,
        ack: 'auto',
      },
      body: '',
    });
  }

  private sendMessage(message: StompMessage): void {
    const headers: Record<string, string> = {
      destination: message.destination,
      'content-type': 'application/json',
      ...message.headers,
    };

    if (message.correlationId) {
      headers['correlation-id'] = message.correlationId;
    }

    this.sendFrame({
      command: STOMP_COMMANDS.SEND,
      headers,
      body: JSON.stringify(message.payload),
    });
  }

  private sendFrame(frame: StompFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send frame, socket not open');
      return;
    }

    const headerLines = Object.entries(frame.headers)
      .map(([key, value]) => `${key}:${value}`)
      .join('\n');

    const stompFrame = `${frame.command}\n${headerLines}\n\n${frame.body}\x00`;
    
    this.socket.send(stompFrame);
    this.log('Sent frame:', frame.command);
  }

  private handleMessage(data: string): void {
    const frame = this.parseFrame(data);
    if (!frame) return;

    this.log('Received frame:', frame.command);

    switch (frame.command) {
      case STOMP_COMMANDS.CONNECTED:
        this.handleConnected(frame);
        break;
      case STOMP_COMMANDS.MESSAGE:
        this.handleStompMessage(frame);
        break;
      case STOMP_COMMANDS.ERROR:
        this.handleError(frame);
        break;
      case STOMP_COMMANDS.RECEIPT:
        this.handleReceipt(frame);
        break;
      default:
        this.log('Unknown frame command:', frame.command);
    }
  }

  private parseFrame(data: string): StompFrame | null {
    try {
      const lines = data.split('\n');
      const command = lines[0].trim();
      
      const headers: Record<string, string> = {};
      let i = 1;
      while (i < lines.length && lines[i].trim() !== '') {
        const [key, ...valueParts] = lines[i].split(':');
        headers[key.trim()] = valueParts.join(':').trim();
        i++;
      }

      // Body is everything after the blank line, minus the null terminator
      const bodyStart = i + 1;
      const body = lines.slice(bodyStart).join('\n').replace(/\x00$/, '');

      return { command, headers, body };
    } catch (error) {
      this.log('Failed to parse frame:', error);
      return null;
    }
  }

  private handleConnected(frame: StompFrame): void {
    this.state = 'connected';
    this.reconnectAttempts = 0;
    
    this.log('STOMP connected:', frame.headers);
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Resubscribe to all destinations
    for (const [id, sub] of this.subscriptions) {
      this.sendSubscribe(id, sub.destination);
    }

    // Send pending messages
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift()!;
      this.sendMessage(message);
    }

    this.eventBus.emit('stomp:connected', { 
      version: frame.headers['version'],
      heartbeat: frame.headers['heart-beat'],
    });
  }

  private handleStompMessage(frame: StompFrame): void {
    const subscriptionId = frame.headers['subscription'];
    const correlationId = frame.headers['correlation-id'];
    const destination = frame.headers['destination'];

    let payload: unknown;
    try {
      payload = JSON.parse(frame.body);
    } catch {
      payload = frame.body;
    }

    // Check for pending request/response
    if (correlationId && this.pendingResponses.has(correlationId)) {
      const pending = this.pendingResponses.get(correlationId)!;
      this.pendingResponses.delete(correlationId);
      pending.resolve(payload);
      return;
    }

    // Route to subscription callback
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      const message: StompMessage = {
        type: 'message',
        destination,
        payload,
        headers: frame.headers,
        timestamp: Date.now(),
      };
      subscription.callback(message);
    }

    this.eventBus.emit('stomp:message', { destination, payload });
  }

  private handleError(frame: StompFrame): void {
    const errorMessage = frame.body || frame.headers['message'] || 'Unknown STOMP error';
    this.log('STOMP error:', errorMessage);
    
    this.eventBus.emit('stomp:error', { error: new Error(errorMessage) });
  }

  private handleReceipt(_frame: StompFrame): void {
    // Handle receipt acknowledgment
  }

  private handleDisconnect(): void {
    this.state = 'disconnected';
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Attempt reconnect if not intentional disconnect
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.attemptReconnect();
    } else {
      this.eventBus.emit('stomp:disconnected', { reason: 'max_reconnect_attempts' });
    }
  }

  private attemptReconnect(): void {
    this.state = 'reconnecting';
    this.reconnectAttempts++;
    
    this.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
    this.eventBus.emit('stomp:reconnecting', { attempt: this.reconnectAttempts });

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect().catch((error) => {
        this.log('Reconnect failed:', error);
      });
    }, this.config.reconnectDelay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('\n'); // STOMP heartbeat
      }
    }, this.config.heartbeatOutgoing);
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[StompClient]', ...args);
    }
  }

  public destroy(): void {
    this.disconnect();
    this.pendingResponses.clear();
    StompClient.instance = null;
  }
}

export default StompClient;
