import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  autoFetchEnabled: boolean;
  setAutoFetchEnabled: (enabled: boolean) => void;
  autoRefreshInterval: number; // in seconds
  setAutoRefreshInterval: (interval: number) => void;
  finnhubApiKey: string | null;
  setFinnhubApiKey: (key: string) => void;
  useMockData: boolean;
  setUseMockData: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoFetchEnabled: true, // Default to enabled
      autoRefreshInterval: 30, // Default to 30 seconds
      finnhubApiKey: null,
      useMockData: false, // Default to real data
      
      setAutoFetchEnabled: (enabled) =>
        set({ autoFetchEnabled: enabled }),
        
      setAutoRefreshInterval: (interval) =>
        set({ autoRefreshInterval: interval }),
        
      setFinnhubApiKey: (key) =>
        set({ finnhubApiKey: key }),
        
      setUseMockData: (enabled) =>
        set({ useMockData: enabled }),
    }),
    {
      name: 'settings-storage',
    }
  )
);