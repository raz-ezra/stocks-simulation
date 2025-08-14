import React, { useEffect, useCallback, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CollapsiblePanel } from "./components/UI/CollapsiblePanel";
import { Overview } from "./components/Overview/Overview";
import { Grants } from "./components/Grants/Grants";
import { Exercises } from "./components/Exercises/Exercises";
import { Simulations } from "./components/Simulations/Simulations";
import { Settings } from "./components/Settings/Settings";
import { TaxSettings } from "./components/TaxSettings/TaxSettings";
import { useGrantsStore } from "./stores/useGrantsStore";
import { useStockPricesStore } from "./stores/useStockPricesStore";
import { useCurrencyStore } from "./stores/useCurrencyStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useThemeStore } from "./stores/useThemeStore";
import { fetchMultipleStockPricesWithCache } from "./services/stockPriceService";
import { fetchUsdIlsRate } from "./services/currencyApi";
import { stockPriceTrigger } from "./services/stockPriceTrigger";
import { validateStorageData } from "./utils/storage";

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const getAllTickers = useGrantsStore((state) => state.getAllTickers);

  // Theme store
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  // Stock prices store
  const stockPricesStore = useStockPricesStore();
  const { setStockPrice, setStockPriceError, clearExpiredCache } =
    stockPricesStore;

  // Update ref on each render
  const stockPricesStoreRef = useRef(stockPricesStore);
  stockPricesStoreRef.current = stockPricesStore;

  // Settings store
  const autoFetchEnabled = useSettingsStore((state) => state.autoFetchEnabled);

  // Currency store actions
  const setUsdIlsRate = useCurrencyStore((state) => state.setUsdIlsRate);
  const setCurrencyError = useCurrencyStore((state) => state.setError);
  const setCurrencyLoading = useCurrencyStore((state) => state.setLoading);

  // Validate storage data on app start
  useEffect(() => {
    validateStorageData();
  }, []);

  // Fetch USD/ILS exchange rate on app start
  useEffect(() => {
    const fetchCurrencyRate = async () => {
      setCurrencyLoading(true);
      try {
        const result = await fetchUsdIlsRate();
        if (result.success) {
          setUsdIlsRate(result.rate);
        } else {
          setCurrencyError(result.error || "Failed to fetch exchange rate");
          // Still set the fallback rate
          setUsdIlsRate(result.rate);
        }
      } catch (error) {
        setCurrencyError("Failed to fetch exchange rate");
        setCurrencyLoading(false);
      }
    };

    fetchCurrencyRate();
  }, [setUsdIlsRate, setCurrencyError, setCurrencyLoading]);

  // Clear expired cache on app start
  useEffect(() => {
    clearExpiredCache();
  }, [clearExpiredCache]);

  // Register for new ticker callbacks
  useEffect(() => {
    const unsubscribe = stockPriceTrigger.onNewTickers(async (newTickers) => {
      try {
        const results = await fetchMultipleStockPricesWithCache(
          newTickers,
          stockPricesStoreRef.current,
          true
        );
        results.forEach((result) => {
          if (result.success) {
            setStockPrice(result.ticker, result.price, result.provider);
          } else {
            setStockPriceError(result.ticker, result.error || "Unknown error");
          }
        });
      } catch (error) {
        // Error fetching prices for new tickers - could be logged to error service
      }
    });

    return unsubscribe;
  }, [setStockPrice, setStockPriceError]);

  // Force refresh function for settings
  const handleForceRefresh = useCallback(async () => {
    const tickers = getAllTickers();
    if (tickers.length > 0) {
      try {
        const results = await fetchMultipleStockPricesWithCache(
          tickers,
          stockPricesStoreRef.current,
          true
        );
        results.forEach((result) => {
          if (result.success) {
            setStockPrice(result.ticker, result.price, result.provider);
          } else {
            setStockPriceError(result.ticker, result.error || "Unknown error");
          }
        });
      } catch (error) {
        // Error force refreshing stock prices - could be logged to error service
      }
    }
  }, [getAllTickers, setStockPrice, setStockPriceError]);

  // Create stable reference for fetchPrices function
  const fetchPrices = useCallback(
    async (tickers: string[], forceRefresh: boolean = false) => {
      try {
        const store = stockPricesStoreRef.current;

        const results = await fetchMultipleStockPricesWithCache(
          tickers,
          store,
          forceRefresh
        );

        results.forEach((result) => {
          if (result.success) {
            setStockPrice(result.ticker, result.price, result.provider);
          } else {
            setStockPriceError(result.ticker, result.error || "Unknown error");
          }
        });
      } catch (error) {
        // Error fetching stock prices - could be logged to error service
      }
    },
    [setStockPrice, setStockPriceError]
  );

  // Initial stock price fetch and auto-fetch setup
  useEffect(() => {
    const tickers = getAllTickers();
    if (tickers.length === 0) return;

    // Initial fetch (will use cache if valid)
    fetchPrices(tickers, false);

    // Set up auto-fetch interval if enabled
    if (autoFetchEnabled) {
      const interval = setInterval(() => {
        const currentTickers = getAllTickers();
        if (currentTickers.length > 0) {
          fetchPrices(currentTickers, false); // This will only fetch if cache is invalid (older than 5 minutes)
        }
      }, 60 * 1000); // Every minute
      return () => {
        clearInterval(interval);
      };
    }
  }, [getAllTickers, fetchPrices, autoFetchEnabled, clearExpiredCache]);

  return (
    <>
      {/* Date input styling for all modes */}
      <style>
        {`
          .date-input-wrapper {
            position: relative;
            display: inline-block;
            width: 100%;
          }
          
          .date-input-wrapper input[type="date"] {
            padding-right: 40px;
          }
          
          .date-input-wrapper input[type="date"]::-webkit-calendar-picker-indicator {
            background: transparent;
            bottom: 0;
            color: transparent;
            cursor: pointer;
            height: auto;
            left: 0;
            position: absolute;
            right: 0;
            top: 0;
            width: auto;
          }
          
          .date-input-wrapper .calendar-icon {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            width: 16px;
            height: 16px;
          }
          
          input[type="date"] {
            color-scheme: ${isDarkMode ? "dark" : "light"};
          }
        `}
      </style>
      <div
        className={`min-h-screen transition-colors ${
          isDarkMode ? "dark bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <header className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1
                  className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Stock Equity Simulation
                </h1>
                <p
                  className={`${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Track your stock options, RSUs, and plan your financial future
                </p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors border ${
                  isDarkMode
                    ? "bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700"
                }`}
                title="Settings"
              >
                <svg
                  className={`w-5 h-5 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Settings</span>
              </button>
            </div>
          </header>

          {/* Hero Section - Overview (Always Visible) */}
          <div className="mb-6">
            <Overview />
          </div>

          {/* Collapsible Sections */}
          <div className="space-y-4">
            <CollapsiblePanel title="Grants" icon="📊" defaultOpen={false}>
              <Grants />
            </CollapsiblePanel>

            <CollapsiblePanel title="Exercises" icon="💰" defaultOpen={false}>
              <Exercises />
            </CollapsiblePanel>

            <CollapsiblePanel title="Simulations" icon="📈" defaultOpen={false}>
              <Simulations />
            </CollapsiblePanel>

            <TaxSettings />
          </div>

          {/* Settings Panel */}
          <Settings
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onForceRefresh={handleForceRefresh}
          />
        </div>
      </div>
    </>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
