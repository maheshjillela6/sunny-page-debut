/**
 * SessionTokenManager - Manages session tokens with localStorage persistence
 */

const SESSION_STORAGE_KEY = 'game_session';
const TOKEN_STORAGE_KEY = 'game_session_token';
const USER_STORAGE_KEY = 'game_user_id';

export interface StoredSession {
  sessionId: string;
  token: string;
  userId: string;
  gameId: string;
  timestamp: number;
  balance: number;
  currency: string;
  unfinished?: {
    exists: boolean;
    seriesId?: string;
    mode?: string;
    resumeToken?: string;
  };
}

export class SessionTokenManager {
  private static instance: SessionTokenManager | null = null;

  private token: string = '';
  private refreshToken: string = '';
  private expiresAt: number = 0;
  private refreshThreshold: number = 5 * 60 * 1000; // 5 minutes before expiry
  private userId: string = '';
  private sessionId: string = '';
  private storedSession: StoredSession | null = null;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): SessionTokenManager {
    if (!SessionTokenManager.instance) {
      SessionTokenManager.instance = new SessionTokenManager();
    }
    return SessionTokenManager.instance;
  }

  // Token management
  public setToken(token: string, refreshToken?: string, expiresIn?: number): void {
    this.token = token;
    if (refreshToken) this.refreshToken = refreshToken;
    if (expiresIn) this.expiresAt = Date.now() + expiresIn * 1000;
    this.saveToStorage();
  }

  public getToken(): string {
    if (this.isExpired()) {
      console.warn('[SessionTokenManager] Token expired, generating mock token');
      this.token = `sess-mock-${Date.now()}`;
    }
    return this.token;
  }

  public getRefreshToken(): string {
    return this.refreshToken;
  }

  public hasToken(): boolean {
    return !!this.token;
  }

  public isExpired(): boolean {
    if (!this.expiresAt) return false;
    return Date.now() >= this.expiresAt;
  }

  public needsRefresh(): boolean {
    if (!this.expiresAt) return false;
    return Date.now() >= this.expiresAt - this.refreshThreshold;
  }

  public clear(): void {
    this.token = '';
    this.refreshToken = '';
    this.expiresAt = 0;
    this.clearStorage();
  }

  // User ID management
  public setUserId(userId: string): void {
    this.userId = userId;
    this.saveToStorage();
  }

  public getUserId(): string {
    return this.userId || 'guest';
  }

  // Session ID management
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    this.saveToStorage();
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  // Full session storage
  public storeSession(session: StoredSession): void {
    this.storedSession = session;
    this.token = session.token;
    this.userId = session.userId;
    this.sessionId = session.sessionId;
    this.saveToStorage();
  }

  public getStoredSession(): StoredSession | null {
    return this.storedSession;
  }

  public hasStoredSession(): boolean {
    return this.storedSession !== null && !!this.storedSession.sessionId;
  }

  public hasUnfinishedSession(): boolean {
    return this.storedSession?.unfinished?.exists ?? false;
  }

  public getUnfinishedSession(): StoredSession['unfinished'] | null {
    return this.storedSession?.unfinished ?? null;
  }

  public updateSessionBalance(balance: number): void {
    if (this.storedSession) {
      this.storedSession.balance = balance;
      this.saveToStorage();
    }
  }

  public updateUnfinishedState(unfinished: StoredSession['unfinished']): void {
    if (this.storedSession) {
      this.storedSession.unfinished = unfinished;
      this.saveToStorage();
    }
  }

  public clearUnfinished(): void {
    if (this.storedSession) {
      this.storedSession.unfinished = { exists: false };
      this.saveToStorage();
    }
  }

  // Session validation
  public isSessionValid(): boolean {
    if (!this.storedSession) return false;
    
    // Session expires after 4 hours
    const SESSION_EXPIRY = 4 * 60 * 60 * 1000;
    const elapsed = Date.now() - this.storedSession.timestamp;
    
    return elapsed < SESSION_EXPIRY;
  }

  public getSessionAge(): number {
    if (!this.storedSession) return 0;
    return Date.now() - this.storedSession.timestamp;
  }

  // Storage operations
  private loadFromStorage(): void {
    try {
      // Load full session
      const sessionStored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionStored) {
        this.storedSession = JSON.parse(sessionStored);
        if (this.storedSession) {
          this.token = this.storedSession.token;
          this.userId = this.storedSession.userId;
          this.sessionId = this.storedSession.sessionId;
        }
      }

      // Load token data (legacy/fallback)
      const tokenStored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (tokenStored && !this.token) {
        try {
          const data = JSON.parse(tokenStored);
          if (typeof data === 'object') {
            this.token = data.token || '';
            this.refreshToken = data.refreshToken || '';
            this.expiresAt = data.expiresAt || 0;
          } else {
            this.token = tokenStored;
          }
        } catch {
          this.token = tokenStored;
        }
      }

      // Generate mock token if none exists
      if (!this.token) {
        this.token = `sess-dev-${Date.now()}`;
      }

      // Load user ID (legacy/fallback)
      if (!this.userId) {
        this.userId = localStorage.getItem(USER_STORAGE_KEY) || '';
      }
    } catch (error) {
      console.warn('[SessionTokenManager] Failed to load from storage:', error);
      this.token = `sess-dev-${Date.now()}`;
    }
  }

  private saveToStorage(): void {
    try {
      // Save full session
      if (this.storedSession) {
        this.storedSession.timestamp = Date.now();
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.storedSession));
      }

      // Save token data
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
        token: this.token,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
      }));

      // Save user ID
      if (this.userId) {
        localStorage.setItem(USER_STORAGE_KEY, this.userId);
      }
    } catch (error) {
      console.warn('[SessionTokenManager] Failed to save to storage:', error);
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }

  public clearAll(): void {
    this.token = '';
    this.refreshToken = '';
    this.expiresAt = 0;
    this.userId = '';
    this.sessionId = '';
    this.storedSession = null;
    this.clearStorage();
  }

  public generateMockToken(userId: string): string {
    this.token = `sess-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.userId = userId;
    this.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    this.saveToStorage();
    return this.token;
  }

  // Create a new session token
  public generateSessionToken(): string {
    const token = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
    this.setToken(token);
    return token;
  }

  public destroy(): void {
    this.clearAll();
    SessionTokenManager.instance = null;
  }
}

export default SessionTokenManager;
