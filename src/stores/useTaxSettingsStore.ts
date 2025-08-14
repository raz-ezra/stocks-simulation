import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TaxSettingsState {
  marginalTaxRate: number | null; // User's marginal tax rate (0.10 to 0.50)
  annualIncome: number | null; // User's annual income in ILS (optional)
  useProgressiveTax: boolean; // Whether to use progressive calculation or marginal rate
  setMarginalTaxRate: (rate: number | null) => void;
  setAnnualIncome: (income: number | null) => void;
  setUseProgressiveTax: (useProgressive: boolean) => void;
}

export const useTaxSettingsStore = create<TaxSettingsState>()(
  persist(
    (set) => ({
      marginalTaxRate: null, // Default to null (will use progressive calculation)
      annualIncome: null,
      useProgressiveTax: true, // Default to progressive calculation
      
      setMarginalTaxRate: (rate) => set({ marginalTaxRate: rate }),
      setAnnualIncome: (income) => set({ annualIncome: income }),
      setUseProgressiveTax: (useProgressive) => set({ useProgressiveTax: useProgressive }),
    }),
    {
      name: 'tax-settings-storage',
    }
  )
);