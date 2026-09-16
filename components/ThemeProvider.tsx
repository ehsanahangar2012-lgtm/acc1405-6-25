import React, { createContext, useContext, useState, useEffect } from 'react';
import { useStore } from '../store';

interface Theme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mode: 'light' | 'dark';
}

const themes = {
  blue: {
    light: {
      primary: '#3B82F6',
      secondary: '#1E40AF',
      accent: '#60A5FA',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1F2937',
      mode: 'light' as const
    },
    dark: {
      primary: '#60A5FA',
      secondary: '#3B82F6',
      accent: '#93C5FD',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      mode: 'dark' as const
    }
  },
  green: {
    light: {
      primary: '#10B981',
      secondary: '#047857',
      accent: '#34D399',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      text: '#1F2937',
      mode: 'light' as const
    },
    dark: {
      primary: '#34D399',
      secondary: '#10B981',
      accent: '#6EE7B7',
      background: '#064E3B',
      surface: '#065F46',
      text: '#F0FDF4',
      mode: 'dark' as const
    }
  },
  purple: {
    light: {
      primary: '#8B5CF6',
      secondary: '#7C3AED',
      accent: '#A78BFA',
      background: '#FAFAF9',
      surface: '#FFFFFF',
      text: '#1F2937',
      mode: 'light' as const
    },
    dark: {
      primary: '#A78BFA',
      secondary: '#8B5CF6',
      accent: '#C4B5FD',
      background: '#581C87',
      surface: '#6B21A8',
      text: '#FAF5FF',
      mode: 'dark' as const
    }
  }
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (color: keyof typeof themes, mode: 'light' | 'dark' | 'system') => void;
  toggleMode: () => void;
  currentColor: keyof typeof themes;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const useThemeClasses = () => {
  const { theme } = useTheme();
  const isLight = theme.mode === 'light';

  return {
    isLight,
    bgMain: isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#111827] text-slate-100',
    bgCard: isLight ? 'bg-white border border-slate-300 shadow-sm text-slate-900' : 'bg-slate-900/90 border border-white/5 shadow-2xl text-slate-100',
    bgCardHover: isLight ? 'hover:bg-slate-50' : 'hover:border-white/10',
    bgInput: isLight ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-teal-600' : 'bg-slate-950/90 border border-white/10 text-white placeholder:text-slate-600 focus:border-teal-500',
    textMain: isLight ? 'text-slate-900 font-bold' : 'text-white font-bold',
    textMuted: isLight ? 'text-slate-700 font-medium' : 'text-slate-400 font-medium',
    borderCard: isLight ? 'border-slate-300' : 'border-white/5',
    tableHeader: isLight ? 'bg-slate-100 text-slate-900 font-bold border-b border-slate-300' : 'bg-slate-950/60 border-b border-slate-800 text-slate-400',
    tableRowHover: isLight ? 'hover:bg-slate-100 divide-slate-200' : 'hover:bg-slate-800/40 divide-slate-800'
  };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentColor, setCurrentColor] = useState<keyof typeof themes>('blue');
  const appTheme = useStore(state => state.config?.appTheme);
  const [currentMode, setCurrentMode] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('ashke-ghalam-theme') || localStorage.getItem('theme-mode') || 'dark';
      if (stored.toLowerCase() === 'light') return 'light';
      if (stored.toLowerCase() === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    if (appTheme) {
      const mode = appTheme.toLowerCase();
      if (mode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setCurrentMode(isDark ? 'dark' : 'light');
      } else if (mode === 'light' || mode === 'dark') {
        setCurrentMode(mode);
      }
    }
  }, [appTheme]);

  const theme = themes[currentColor][currentMode];

  const setTheme = (color: keyof typeof themes, mode: 'light' | 'dark' | 'system') => {
    setCurrentColor(color);
    let resolvedMode: 'light' | 'dark' = mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
    setCurrentMode(resolvedMode);
    localStorage.setItem('theme-color', color);
    localStorage.setItem('theme-mode', resolvedMode);
    localStorage.setItem('ashke-ghalam-theme', mode.toUpperCase());
    window.dispatchEvent(new CustomEvent('theme-change', { detail: mode.toUpperCase() }));
  };

  const toggleMode = () => {
    const nextMode = currentMode === 'dark' ? 'light' : 'dark';
    setCurrentMode(nextMode);
    localStorage.setItem('theme-mode', nextMode);
    localStorage.setItem('ashke-ghalam-theme', nextMode.toUpperCase());
    window.dispatchEvent(new CustomEvent('theme-change', { detail: nextMode.toUpperCase() }));
  };

  useEffect(() => {
    const savedColor = localStorage.getItem('theme-color') as keyof typeof themes;
    if (savedColor && themes[savedColor]) setCurrentColor(savedColor);
  }, []);

  useEffect(() => {
    const handleSyncWithConfig = () => {
      try {
        const storedTheme = localStorage.getItem('ashke-ghalam-theme') || localStorage.getItem('theme-mode') || 'dark';
        const normalizedMode = storedTheme.toLowerCase() as 'light' | 'dark' | 'system';
        
        if (normalizedMode === 'system') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          setCurrentMode(mediaQuery.matches ? 'dark' : 'light');
        } else if (normalizedMode === 'light' || normalizedMode === 'dark') {
          setCurrentMode(normalizedMode);
        }
      } catch {}
    };

    window.addEventListener('theme-change', handleSyncWithConfig);
    handleSyncWithConfig();
    return () => window.removeEventListener('theme-change', handleSyncWithConfig);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-secondary', theme.secondary);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-background', theme.background);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-text', theme.text);
    
    document.body.className = theme.mode;
    if (theme.mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme.mode === 'dark' ? '#0f172a' : '#f8fafc');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleMode, currentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const ThemeSelector: React.FC = () => {
  const { setTheme, currentColor, theme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">انتخاب تم رنگی سامانه</h4>
        <div className="flex gap-3">
          {Object.keys(themes).map((color) => (
            <button
              key={color}
              onClick={() => setTheme(color as keyof typeof themes, 'dark')}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                currentColor === color ? 'border-gray-800 dark:border-white ring-2 ring-primary/20' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: themes[color as keyof typeof themes].dark.primary }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};