/**
 * ThemeProvider - Provides theme context to components
 */

import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';

interface Theme {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  primaryColor: 'hsl(262, 83%, 58%)',
  accentColor: 'hsl(186, 85%, 45%)',
  backgroundColor: 'hsl(229, 34%, 10%)',
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  setTheme: () => {},
  isDarkMode: true,
  toggleDarkMode: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = defaultTheme,
}) => {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    // Apply theme CSS variables
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', newTheme.primaryColor);
    root.style.setProperty('--theme-accent', newTheme.accentColor);
    root.style.setProperty('--theme-background', newTheme.backgroundColor);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
    document.documentElement.classList.toggle('dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
