import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  autoFetchEnabled: boolean;
  setAutoFetchEnabled: (enabled: boolean) => void;
  polygonApiKey: string | null;
  setPolygonApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoFetchEnabled: true, // Default to enabled
      polygonApiKey: null,
      
      setAutoFetchEnabled: (enabled) =>
        set({ autoFetchEnabled: enabled }),
        
      setPolygonApiKey: (key) =>
        set({ polygonApiKey: key }),
    }),
    {
      name: 'settings-storage',
    }
  )
);