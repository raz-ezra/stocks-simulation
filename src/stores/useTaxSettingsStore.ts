import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getStorageKey } from '../utils/storage';

interface TaxSettingsState {
  marginalTaxRate: number | null; // User's marginal tax rate (0.10 to 0.50)
  annualIncome: number | null; // User's annual income in ILS (optional)
  useProgressiveTax: boolean; // Whether to use progressive calculation or marginal rate
  isControllingShareholder: boolean; // Whether user holds ≥10% (affects CG rate: 30% vs 25%)
  setMarginalTaxRate: (rate: number | null) => void;
  setAnnualIncome: (income: number | null) => void;
  setUseProgressiveTax: (useProgressive: boolean) => void;
  setIsControllingShareholder: (isControlling: boolean) => void;
}

export const useTaxSettingsStore = create<TaxSettingsState>()(
  persist(
    (set) => ({
      marginalTaxRate: null, // Default to null (will use progressive calculation)
      annualIncome: null,
      useProgressiveTax: true, // Default to progressive calculation
      isControllingShareholder: false, // Default to regular shareholder (25% CG rate)
      
      setMarginalTaxRate: (rate) => set({ marginalTaxRate: rate }),
      setAnnualIncome: (income) => set({ annualIncome: income }),
      setUseProgressiveTax: (useProgressive) => set({ useProgressiveTax: useProgressive }),
      setIsControllingShareholder: (isControlling) => set({ isControllingShareholder: isControlling }),
    }),
    {
      name: getStorageKey('tax-settings-storage'),
    }
  )
);