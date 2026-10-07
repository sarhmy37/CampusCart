import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';

const ThemeContext = createContext<any>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme(); // 'dark' | 'light' | null
  const [theme, setThemeState] = useState<'dark' | 'light'>(systemScheme === 'dark' ? 'dark' : 'light');
  const [hydrated, setHydrated] = useState(false);

  // On mount: check saved preference, else fall back to system
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('cc_theme');
      const initial = saved || (systemScheme === 'dark' ? 'dark' : 'light');
      setThemeState(initial as 'dark' | 'light');
      nwColorScheme.set(initial as 'dark' | 'light');
      setHydrated(true);
    })();
  }, []);

  // Keep NativeWind's scheme in sync whenever theme changes
  useEffect(() => {
    if (!hydrated) return;
    nwColorScheme.set(theme);
  }, [theme, hydrated]);

  const setTheme = async (next: 'dark' | 'light') => {
    await AsyncStorage.setItem('cc_theme', next);
    setThemeState(next);
  };

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    await AsyncStorage.setItem('cc_theme', next);
    setThemeState(next);
  };

  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);