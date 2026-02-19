/**
 * NetworkSettingsPanel - UI for viewing and overriding network configuration
 * Shows current environment settings and allows runtime overrides
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  getMergedEnvConfig, 
  setConfigOverride, 
  clearConfigOverrides,
  isDevelopment,
  type NetworkEnvironmentConfig 
} from '@/config/env.config';
import { NetworkManager } from '@/platform/networking/NetworkManager';
import { Wifi, WifiOff, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface NetworkSettingsPanelProps {
  onSettingsChange?: () => void;
  isConnected?: boolean;
}

export const NetworkSettingsPanel: React.FC<NetworkSettingsPanelProps> = ({
  onSettingsChange,
  isConnected: externalConnected,
}) => {
  const [config, setConfig] = useState(getMergedEnvConfig());
  const [isConnected, setIsConnected] = useState(externalConnected ?? false);
  const [isTesting, setIsTesting] = useState(false);
  const { t } = useLocale();
  
  const [adapterType, setAdapterType] = useState<'rest' | 'stomp' | 'mock'>(config.network.adapterType);
  const [restUrl, setRestUrl] = useState(config.network.rest.baseUrl);
  const [stompUrl, setStompUrl] = useState(config.network.stomp.url);
  const [timeout, setTimeout] = useState(config.network.rest.timeout);

  useEffect(() => {
    if (externalConnected !== undefined) {
      setIsConnected(externalConnected);
    } else {
      const networkManager = NetworkManager.getInstance();
      setIsConnected(networkManager.isConnected());
    }
  }, [externalConnected]);

  const handleSaveOverrides = async () => {
    setConfigOverride('network', {
      adapterType,
      rest: {
        ...config.network.rest,
        baseUrl: restUrl,
        timeout,
      },
      stomp: {
        ...config.network.stomp,
        url: stompUrl,
      },
    } as NetworkEnvironmentConfig);

    setConfig(getMergedEnvConfig());

    const networkManager = NetworkManager.getInstance();
    await networkManager.initialize({ defaultAdapter: adapterType });
    setIsConnected(networkManager.isConnected());
    
    onSettingsChange?.();
  };

  const handleResetToDefaults = () => {
    clearConfigOverrides();
    const freshConfig = getMergedEnvConfig();
    setConfig(freshConfig);
    setAdapterType(freshConfig.network.adapterType);
    setRestUrl(freshConfig.network.rest.baseUrl);
    setStompUrl(freshConfig.network.stomp.url);
    setTimeout(freshConfig.network.rest.timeout);
    onSettingsChange?.();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const networkManager = NetworkManager.getInstance();
      await networkManager.connect();
      setIsConnected(networkManager.isConnected());
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('settings.network_config')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('settings.environment')}: <Badge variant={isDevelopment() ? 'secondary' : 'default'}>
                {config.name}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="default" className="gap-1">
                <Wifi className="h-3 w-3" /> {t('settings.connected')}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" /> {t('settings.disconnected')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="adapter-type">{t('settings.network_adapter')}</Label>
          <Select value={adapterType} onValueChange={(v) => setAdapterType(v as any)}>
            <SelectTrigger id="adapter-type">
              <SelectValue placeholder={t('settings.select_adapter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rest">REST (HTTP)</SelectItem>
              <SelectItem value="stomp">STOMP (WebSocket)</SelectItem>
              <SelectItem value="mock">Mock (Local)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settings.adapter_desc')}
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">{t('settings.rest_config')}</h4>
          
          <div className="space-y-2">
            <Label htmlFor="rest-url">{t('settings.base_url')}</Label>
            <Input
              id="rest-url"
              value={restUrl}
              onChange={(e) => setRestUrl(e.target.value)}
              placeholder="/api or https://api.example.com"
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.base_url_desc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">{t('settings.timeout')}</Label>
            <Input
              id="timeout"
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(parseInt(e.target.value) || 30000)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">{t('settings.websocket_config')}</h4>
          
          <div className="space-y-2">
            <Label htmlFor="stomp-url">{t('settings.websocket_url')}</Label>
            <Input
              id="stomp-url"
              value={stompUrl}
              onChange={(e) => setStompUrl(e.target.value)}
              placeholder="ws://localhost:8080/ws or wss://api.example.com/ws"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <h4 className="font-medium">{t('settings.current_env')}</h4>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <span>{t('settings.debug_mode')}:</span>
            <span>{config.debug ? t('settings.enabled') : t('settings.disabled')}</span>
            <span>{t('settings.mock_data')}:</span>
            <span>{config.features.mockDataEnabled ? t('settings.enabled') : t('settings.disabled')}</span>
            <span>{t('settings.asset_fallback')}:</span>
            <span>{config.assets.fallbackToDefaults ? t('settings.enabled') : t('settings.disabled')}</span>
          </div>
        </div>

        <Separator />

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleResetToDefaults}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('settings.reset_defaults')}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {t('settings.test_connection')}
          </Button>
          <Button onClick={handleSaveOverrides}>
            {t('settings.save_apply')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkSettingsPanel;
