import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StockPrice } from '../types';
import { getStorageKey } from '../utils/storage';

interface StockPricesStore {
  stockPrices: { [ticker: string]: StockPrice };
  setStockPrice: (ticker: string, price: number, provider?: string) => void;
  setStockPriceError: (ticker: string, error: string) => void;
  getStockPrice: (ticker: string) => StockPrice | undefined;
  getAllStockPrices: () => StockPrice[];
  isCacheValid: (ticker: string, maxAgeMinutes?: number) => boolean;
  clearExpiredCache: () => void;
}

export const useStockPricesStore = create<StockPricesStore>()(
  persist(
    (set, get) => ({
      stockPrices: {},
      
      setStockPrice: (ticker, price, provider) =>
        set((state) => ({
          stockPrices: {
            ...state.stockPrices,
            [ticker]: {
              ticker,
              price,
              lastUpdated: new Date(),
              error: undefined,
              provider,
            },
          },
        })),
      
      setStockPriceError: (ticker, error) =>
        set((state) => {
          const existingData = state.stockPrices[ticker];
          return {
            stockPrices: {
              ...state.stockPrices,
              [ticker]: {
                ticker,
                // Preserve last successful price, or use 0 if never had one
                price: existingData && !existingData.error ? existingData.price : 0,
                lastUpdated: new Date(),
                error,
                // Preserve provider info if exists
                provider: existingData ? existingData.provider : undefined,
              },
            },
          };
        }),
      
      getStockPrice: (ticker) => get().stockPrices[ticker],
      
      getAllStockPrices: () => Object.values(get().stockPrices),
      
      isCacheValid: (ticker, maxAgeMinutes = 5) => {
        const stockPrice = get().stockPrices[ticker];
        if (!stockPrice || stockPrice.error) return false;
        
        const now = new Date().getTime();
        const lastUpdated = new Date(stockPrice.lastUpdated).getTime();
        const maxAgeMs = maxAgeMinutes * 60 * 1000;
        
        return (now - lastUpdated) < maxAgeMs;
      },
      
      clearExpiredCache: () =>
        set((state) => {
          const now = new Date().getTime();
          const maxAgeMs = 5 * 60 * 1000; // 5 minutes
          
          const validPrices: { [ticker: string]: StockPrice } = {};
          
          Object.entries(state.stockPrices).forEach(([ticker, stockPrice]) => {
            const lastUpdated = new Date(stockPrice.lastUpdated).getTime();
            if ((now - lastUpdated) < maxAgeMs) {
              validPrices[ticker] = stockPrice;
            }
          });
          
          return { stockPrices: validPrices };
        }),
    }),
    {
      name: getStorageKey('stock-prices-storage'),
      serialize: (state) => {
        return JSON.stringify(state);
      },
      deserialize: (str) => {
        try {
          const parsed = JSON.parse(str);
          // Convert date strings back to Date objects
          if (parsed.state && parsed.state.stockPrices) {
            Object.values(parsed.state.stockPrices).forEach((stockPrice: any) => {
              try {
                stockPrice.lastUpdated = new Date(stockPrice.lastUpdated);
              } catch (error) {
                console.warn('Error parsing stock price date:', error);
                stockPrice.lastUpdated = new Date();
              }
            });
          }
          return parsed;
        } catch (error) {
          console.warn('Error deserializing stock prices:', error);
          return { state: { stockPrices: {} }, version: 0 };
        }
      },
    }
  )
);