/**
 * LanguageSelector - Language switching dropdown
 */

import React from 'react';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/ui/providers/LocaleProvider';

export const LanguageSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, setLocale, availableLocales } = useLocale();

  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectTrigger className={`w-auto gap-2 ${className ?? ''}`}>
        <Globe className="w-4 h-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableLocales.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            <span>{l.nativeName}</span>
            {l.direction === 'rtl' && (
              <span className="ml-2 text-xs text-muted-foreground">(RTL)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
