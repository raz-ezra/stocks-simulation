import { create } from 'zustand';

interface CurrencyState {
  usdIlsRate: number;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
}

interface CurrencyStore extends CurrencyState {
  setUsdIlsRate: (rate: number) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useCurrencyStore = create<CurrencyStore>()((set) => ({
  usdIlsRate: 3.65, // Default fallback rate
  lastUpdated: null,
  isLoading: false,
  error: null,
  
  setUsdIlsRate: (rate) =>
    set({
      usdIlsRate: rate,
      lastUpdated: new Date(),
      error: null,
      isLoading: false,
    }),
  
  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),
  
  setLoading: (isLoading) =>
    set({ isLoading }),
}));