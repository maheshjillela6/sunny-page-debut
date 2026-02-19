/**
 * SettingsModal - Game settings modal
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Settings, Volume2, Gamepad2 } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  turboMode: boolean;
  autoConfirmSpins: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}) => {
  const { t } = useLocale();

  const updateSetting = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('ui.settings')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-medium">
              <Volume2 className="w-4 h-4" />
              {t('settings.audio')}
            </h3>
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="sound">{t('settings.sound_effects')}</Label>
                <Switch
                  id="sound"
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
                />
              </div>
              {settings.soundEnabled && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{t('ui.volume')}</Label>
                  <Slider
                    value={[settings.soundVolume]}
                    onValueChange={([value]) => updateSetting('soundVolume', value)}
                    max={100}
                    step={1}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="music">{t('settings.music')}</Label>
                <Switch
                  id="music"
                  checked={settings.musicEnabled}
                  onCheckedChange={(checked) => updateSetting('musicEnabled', checked)}
                />
              </div>
              {settings.musicEnabled && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{t('ui.volume')}</Label>
                  <Slider
                    value={[settings.musicVolume]}
                    onValueChange={([value]) => updateSetting('musicVolume', value)}
                    max={100}
                    step={1}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-medium">
              <Gamepad2 className="w-4 h-4" />
              {t('settings.gameplay')}
            </h3>
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="turbo">{t('settings.turbo_mode')}</Label>
                <Switch
                  id="turbo"
                  checked={settings.turboMode}
                  onCheckedChange={(checked) => updateSetting('turboMode', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="autoConfirm">{t('settings.auto_confirm')}</Label>
                <Switch
                  id="autoConfirm"
                  checked={settings.autoConfirmSpins}
                  onCheckedChange={(checked) => updateSetting('autoConfirmSpins', checked)}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
