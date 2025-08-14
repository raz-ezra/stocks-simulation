import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      isDarkMode: true, // Default to dark mode
      
      toggleTheme: () =>
        set((state) => ({ isDarkMode: !state.isDarkMode })),
      
      setTheme: (isDark: boolean) =>
        set({ isDarkMode: isDark }),
    }),
    {
      name: 'theme-storage',
    }
  )
);