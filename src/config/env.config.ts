/**
 * Environment Configuration
 * Centralized configuration for dev/prod environments
 * All network, API, and runtime settings are defined here
 */

export type Environment = 'development' | 'staging' | 'production';
export type NetworkAdapterType = 'rest' | 'stomp' | 'mock';

export interface NetworkEnvironmentConfig {
  adapterType: NetworkAdapterType;
  rest: {
    baseUrl: string;
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };
  stomp: {
    url: string;
    heartbeatIncoming: number;
    heartbeatOutgoing: number;
    reconnectDelay: number;
    maxReconnectAttempts: number;
  };
  proxy?: {
    enabled: boolean;
    target: string;
    changeOrigin: boolean;
    pathRewrite?: Record<string, string>;
  };
}

export interface EnvironmentConfig {
  name: Environment;
  debug: boolean;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    verbose: boolean;
    remoteLogging: boolean;
  };
  network: NetworkEnvironmentConfig;
  assets: {
    baseUrl: string;
    cdnUrl?: string;
    fallbackToDefaults: boolean;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
  features: {
    mockDataEnabled: boolean;
    devToolsEnabled: boolean;
    hotReload: boolean;
    performanceMonitoring: boolean;
  };
  security: {
    requireAuth: boolean;
    tokenRefreshInterval: number;
    sessionTimeout: number;
  };
}

/**
 * Development environment configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Set VITE_API_PROXY_TARGET in your .env file to your backend URL
 *    Example: VITE_API_PROXY_TARGET=http://localhost:3000
 * 
 * 2. If no proxy is configured, the system will use mock data
 * 
 * 3. For WebSocket (STOMP), set VITE_WS_PROXY_TARGET
 *    Example: VITE_WS_PROXY_TARGET=ws://localhost:8080
 */
const developmentConfig: EnvironmentConfig = {
  name: 'development',
  debug: true,
  logging: {
    level: 'debug',
    verbose: true,
    remoteLogging: false,
  },
  network: {
    // Default to mock in development since no backend server is available
    // Change to 'rest' when you have an actual backend server
    adapterType: 'mock',
    rest: {
      baseUrl: '/api', // Proxied through Vite to VITE_API_PROXY_TARGET
      timeout: 30000,
      retryCount: 2,
      retryDelay: 1000,
    },
    stomp: {
      url: '/ws', // Proxied through Vite to VITE_WS_PROXY_TARGET
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 5,
    },
    proxy: {
      enabled: true,
      target: 'http://localhost:3000', // Default, overridden by VITE_API_PROXY_TARGET
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  },
  assets: {
    baseUrl: '/assets',
    fallbackToDefaults: true,
    cacheEnabled: false,
    cacheTTL: 0,
  },
  features: {
    mockDataEnabled: false,
    devToolsEnabled: true,
    hotReload: true,
    performanceMonitoring: true,
  },
  security: {
    requireAuth: false,
    tokenRefreshInterval: 300000,
    sessionTimeout: 3600000,
  },
};

/**
 * Staging environment configuration
 */
const stagingConfig: EnvironmentConfig = {
  name: 'staging',
  debug: true,
  logging: {
    level: 'info',
    verbose: false,
    remoteLogging: true,
  },
  network: {
    adapterType: 'rest',
    rest: {
      baseUrl: 'https://staging-api.example.com',
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    },
    stomp: {
      url: 'wss://staging-api.example.com/ws',
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
    },
  },
  assets: {
    baseUrl: '/assets',
    cdnUrl: 'https://staging-cdn.example.com',
    fallbackToDefaults: true,
    cacheEnabled: true,
    cacheTTL: 3600000,
  },
  features: {
    mockDataEnabled: false,
    devToolsEnabled: true,
    hotReload: false,
    performanceMonitoring: true,
  },
  security: {
    requireAuth: true,
    tokenRefreshInterval: 300000,
    sessionTimeout: 3600000,
  },
};

/**
 * Production environment configuration
 * 
 * IMPORTANT: Update these URLs before deploying to production!
 * 
 * Replace 'https://api.example.com' with your actual production API URL
 * Replace 'wss://api.example.com/ws' with your actual WebSocket URL
 */
const productionConfig: EnvironmentConfig = {
  name: 'production',
  debug: false,
  logging: {
    level: 'warn',
    verbose: false,
    remoteLogging: true,
  },
  network: {
    adapterType: 'rest',
    rest: {
      // TODO: Replace with your production API URL
      baseUrl: 'https://api.example.com',
      timeout: 30000,
      retryCount: 3,
      retryDelay: 2000,
    },
    stomp: {
      // TODO: Replace with your production WebSocket URL  
      url: 'wss://api.example.com/ws',
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
    },
  },
  assets: {
    baseUrl: '/assets',
    cdnUrl: 'https://cdn.example.com',
    fallbackToDefaults: false,
    cacheEnabled: true,
    cacheTTL: 86400000,
  },
  features: {
    mockDataEnabled: false,
    devToolsEnabled: false,
    hotReload: false,
    performanceMonitoring: true,
  },
  security: {
    requireAuth: true,
    tokenRefreshInterval: 300000,
    sessionTimeout: 3600000,
  },
};

/**
 * All environment configurations
 */
const configs: Record<Environment, EnvironmentConfig> = {
  development: developmentConfig,
  staging: stagingConfig,
  production: productionConfig,
};

/**
 * Determine current environment from Vite mode
 */
function getCurrentEnvironment(): Environment {
  const mode = import.meta.env.MODE;
  
  if (mode === 'production') return 'production';
  if (mode === 'staging') return 'staging';
  return 'development';
}

/**
 * Get current environment configuration
 */
export function getEnvConfig(): EnvironmentConfig {
  const env = getCurrentEnvironment();
  return configs[env];
}

/**
 * Get network configuration for current environment
 */
export function getNetworkConfig(): NetworkEnvironmentConfig {
  return getEnvConfig().network;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return getEnvConfig().debug;
}

/**
 * Override config values (for runtime configuration via UI)
 * Stores overrides in localStorage for persistence
 */
const OVERRIDE_STORAGE_KEY = 'env_config_overrides';

export function setConfigOverride<K extends keyof EnvironmentConfig>(
  key: K,
  value: Partial<EnvironmentConfig[K]>
): void {
  try {
    const overrides = getConfigOverrides();
    overrides[key] = { ...(overrides[key] as any || {}), ...value };
    localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn('[EnvConfig] Failed to save override:', error);
  }
}

export function getConfigOverrides(): Partial<EnvironmentConfig> {
  try {
    const stored = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function clearConfigOverrides(): void {
  localStorage.removeItem(OVERRIDE_STORAGE_KEY);
}

/**
 * Get merged config with overrides applied
 */
export function getMergedEnvConfig(): EnvironmentConfig {
  const baseConfig = getEnvConfig();
  const overrides = getConfigOverrides();
  
  return {
    ...baseConfig,
    ...overrides,
    network: {
      ...baseConfig.network,
      ...(overrides.network || {}),
      rest: {
        ...baseConfig.network.rest,
        ...((overrides.network as any)?.rest || {}),
      },
      stomp: {
        ...baseConfig.network.stomp,
        ...((overrides.network as any)?.stomp || {}),
      },
    },
    assets: {
      ...baseConfig.assets,
      ...(overrides.assets || {}),
    },
    features: {
      ...baseConfig.features,
      ...(overrides.features || {}),
    },
    security: {
      ...baseConfig.security,
      ...(overrides.security || {}),
    },
  };
}

export default getEnvConfig;
