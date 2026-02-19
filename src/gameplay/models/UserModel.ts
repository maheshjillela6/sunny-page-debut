/**
 * UserModel - User data model
 */

export interface UserData {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  locale: string;
  currency: string;
  jurisdiction: string;
  createdAt: number;
  lastLoginAt: number;
}

export interface UserPreferences {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  turboMode: boolean;
  autoPlayEnabled: boolean;
  autoPlaySpins: number;
  quickSpin: boolean;
  leftHandMode: boolean;
}

export class UserModel {
  private data: UserData;
  private preferences: UserPreferences;
  private isAuthenticated: boolean = false;
  private sessionToken: string = '';

  constructor(data?: Partial<UserData>) {
    this.data = {
      userId: data?.userId || '',
      username: data?.username || 'guest',
      displayName: data?.displayName || 'Guest Player',
      avatarUrl: data?.avatarUrl || '',
      locale: data?.locale || 'en-GB',
      currency: data?.currency || 'GBP',
      jurisdiction: data?.jurisdiction || 'UKGC',
      createdAt: data?.createdAt || Date.now(),
      lastLoginAt: data?.lastLoginAt || Date.now(),
    };

    this.preferences = this.getDefaultPreferences();
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      soundEnabled: true,
      musicEnabled: true,
      soundVolume: 0.8,
      musicVolume: 0.5,
      turboMode: false,
      autoPlayEnabled: false,
      autoPlaySpins: 10,
      quickSpin: false,
      leftHandMode: false,
    };
  }

  // Getters
  public getUserId(): string { return this.data.userId; }
  public getUsername(): string { return this.data.username; }
  public getDisplayName(): string { return this.data.displayName; }
  public getLocale(): string { return this.data.locale; }
  public getCurrency(): string { return this.data.currency; }
  public getJurisdiction(): string { return this.data.jurisdiction; }
  public getSessionToken(): string { return this.sessionToken; }
  public isLoggedIn(): boolean { return this.isAuthenticated; }

  // Setters
  public setSessionToken(token: string): void {
    this.sessionToken = token;
    this.isAuthenticated = !!token;
  }

  public updateData(data: Partial<UserData>): void {
    this.data = { ...this.data, ...data };
  }

  public getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  public updatePreferences(prefs: Partial<UserPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
  }

  public getData(): UserData {
    return { ...this.data };
  }

  public toJSON(): { data: UserData; preferences: UserPreferences } {
    return {
      data: this.getData(),
      preferences: this.getPreferences(),
    };
  }

  public static fromJSON(json: { data: UserData; preferences: UserPreferences }): UserModel {
    const model = new UserModel(json.data);
    model.updatePreferences(json.preferences);
    return model;
  }
}

export default UserModel;
