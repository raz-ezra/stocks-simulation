import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Grant } from '../types';
import { stockPriceTrigger } from '../services/stockPriceTrigger';
import { getStorageKey } from '../utils/storage';

interface GrantsStore {
  grants: Grant[];
  addGrant: (grant: Omit<Grant, 'id'>) => void;
  updateGrant: (id: string, grant: Partial<Grant>) => void;
  deleteGrant: (id: string) => void;
  getGrantsByTicker: (ticker: string) => Grant[];
  getAllTickers: () => string[];
}

export const useGrantsStore = create<GrantsStore>()(
  persist(
    (set, get) => ({
      grants: [],
      
      addGrant: (grantData) => {
        const prevTickers = get().getAllTickers();
        set((state) => ({
          grants: [
            ...state.grants,
            { ...grantData, id: crypto.randomUUID() },
          ],
        }));
        
        // Check if new ticker was added
        const newTickers = get().getAllTickers();
        const addedTickers = newTickers.filter(ticker => !prevTickers.includes(ticker));
        if (addedTickers.length > 0) {
          console.log(`New ticker(s) added: ${addedTickers.join(', ')}, triggering stock price fetch`);
          stockPriceTrigger.triggerFetch(addedTickers);
        }
      },
      
      updateGrant: (id, updates) =>
        set((state) => ({
          grants: state.grants.map((grant) =>
            grant.id === id ? { ...grant, ...updates } : grant
          ),
        })),
      
      deleteGrant: (id) =>
        set((state) => ({
          grants: state.grants.filter((grant) => grant.id !== id),
        })),
      
      getGrantsByTicker: (ticker) =>
        get().grants.filter((grant) => grant.ticker === ticker),
      
      getAllTickers: () =>
        [...new Set(get().grants.map((grant) => grant.ticker))],
    }),
    {
      name: getStorageKey('grants-storage'),
      serialize: (state) => {
        return JSON.stringify(state);
      },
      deserialize: (str) => {
        try {
          const parsed = JSON.parse(str);
          // Convert date strings back to Date objects
          if (parsed.state && parsed.state.grants) {
            parsed.state.grants = parsed.state.grants.map((grant: any) => {
              try {
                return {
                  ...grant,
                  vestingFrom: new Date(grant.vestingFrom),
                  grantDate: new Date(grant.grantDate),
                };
              } catch (error) {
                console.warn('Error parsing grant dates:', error);
                // Return grant with current date as fallback
                return {
                  ...grant,
                  vestingFrom: new Date(),
                  grantDate: new Date(),
                };
              }
            });
          }
          return parsed;
        } catch (error) {
          console.warn('Error deserializing grants:', error);
          // Return empty state if deserialization fails
          return { state: { grants: [] }, version: 0 };
        }
      },
    }
  )
);