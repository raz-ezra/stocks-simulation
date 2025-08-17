import React from 'react';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useThemeStore } from '../../stores/useThemeStore';

export const CurrencyIndicator: React.FC = () => {
  const { usdIlsRate, lastUpdated, isLoading, error } = useCurrencyStore();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  return (
    <div
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}
      title={
        lastUpdated
          ? `Last updated: ${new Date(lastUpdated).toLocaleString()}`
          : 'Exchange rate'
      }
    >
      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
        USD/ILS:
      </span>
      {isLoading ? (
        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
          Loading...
        </span>
      ) : error ? (
        <span className="text-yellow-500" title={error}>
          ₪{usdIlsRate.toFixed(2)}
        </span>
      ) : (
        <span
          className={`font-medium ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}
        >
          ₪{usdIlsRate.toFixed(2)}
        </span>
      )}
    </div>
  );
};