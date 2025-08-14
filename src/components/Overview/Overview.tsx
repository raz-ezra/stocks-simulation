import React from "react";
import { useGrantsStore } from "../../stores/useGrantsStore";
import { useExercisesStore } from "../../stores/useExercisesStore";
import { useStockPricesStore } from "../../stores/useStockPricesStore";
import { useCurrencyStore } from "../../stores/useCurrencyStore";
import { useThemeStore } from "../../stores/useThemeStore";
import {
  calculateVestedShares,
  calculateExercisedShares,
  formatCurrency,
} from "../../utils/calculations";

interface OverviewProps {
  onForceRefresh: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ onForceRefresh }) => {
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const getAllTickers = useGrantsStore((state) => state.getAllTickers);

  // Currency store
  const usdIlsRate = useCurrencyStore((state) => state.usdIlsRate);
  
  // Theme store
  const { isDarkMode } = useThemeStore();

  const tickers = getAllTickers();

  const calculateSummary = () => {
    let totalOptions = 0;
    let totalRSUs = 0;
    let vestedOptions = 0;
    let vestedRSUs = 0;
    let todayWorth = 0;
    let valueAtGrant = 0;
    let totalValue = 0;

    grants.forEach((grant) => {
      const vested = calculateVestedShares(
        grant.amount,
        grant.vestingFrom,
        grant.vestingYears
      );
      // Filter exercises to include regular exercises + included simulated exercises
      const includedExercises = exercises.filter(exercise => 
        !exercise.isSimulation || exercise.includeInCalculations
      );
      const exercised = calculateExercisedShares(grant.amount, includedExercises);
      const availableShares = vested - exercised;
      const totalShares = grant.amount - exercised; // All unexercised shares
      const currentPrice = stockPrices[grant.ticker]?.price || 0;

      // Calculate value at grant (what it was worth when granted) - only vested
      const grantValue = availableShares * grant.price;
      valueAtGrant += grantValue;

      if (grant.type === "Options") {
        totalOptions += grant.amount;
        vestedOptions += vested;
        // For options, today's worth is the gain (current price - strike price) - only vested
        if (currentPrice > grant.price) {
          const optionGain = availableShares * (currentPrice - grant.price);
          todayWorth += optionGain;
          // Total value: all unexercised shares as if fully vested at current price
          totalValue += totalShares * currentPrice;
        } else {
          // If underwater, total value is still all shares at current price (could be less than grant value)
          totalValue += totalShares * currentPrice;
        }
      } else {
        totalRSUs += Number(grant.amount);
        vestedRSUs += vested;
        // For RSUs, today's worth is the full current value - only vested
        const rsuValue = availableShares * currentPrice;
        todayWorth += rsuValue;
        // Total value: all unexercised RSUs as if fully vested
        totalValue += totalShares * currentPrice;
      }
    });

    return {
      totalOptions,
      totalRSUs,
      vestedOptions,
      vestedRSUs,
      todayWorth,
      valueAtGrant,
      totalValue,
      // ILS conversions
      todayWorthILS: todayWorth * usdIlsRate,
      valueAtGrantILS: valueAtGrant * usdIlsRate,
      totalValueILS: totalValue * usdIlsRate,
    };
  };

  const summary = calculateSummary();

  return (
    <div className="space-y-6">
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-6 shadow-sm border`}>
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-6`}>
          Stock Plan Overview
        </h1>

        {/* Stock Prices */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Current Prices
            </h3>
            <button
              onClick={onForceRefresh}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              title="Force refresh all prices"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tickers.map((ticker) => {
              const stockData = stockPrices[ticker];
              return (
                <div key={ticker} className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{ticker}</div>
                  <div className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {stockData ? (
                      stockData.error ? (
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <span className="text-red-500 text-lg mr-1">⚠️</span>
                            <span className="text-red-500 text-sm font-medium">API Failed</span>
                          </div>
                          {stockData.price > 0 ? (
                            <div>
                              <div className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {formatCurrency(stockData.price)}
                              </div>
                              <div className="text-xs text-orange-500">
                                (Last cached price)
                              </div>
                            </div>
                          ) : (
                            <div className="text-red-500 text-sm">
                              No cached data available
                            </div>
                          )}
                        </div>
                      ) : (
                        formatCurrency(stockData.price)
                      )
                    ) : (
                      <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Loading...</span>
                    )}
                  </div>
                  {stockData && !stockData.error && (
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div>
                        Updated:{" "}
                        {new Date(stockData.lastUpdated).toLocaleTimeString()}
                      </div>
                      {stockData.provider && (
                        <div className="text-blue-500">
                          via {stockData.provider.replace(/ \(cached\)/g, "")}
                          {stockData.provider.includes("cached") && (
                            <span className="text-green-600 ml-1">📦</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {stockData && stockData.error && (
                    <div className="text-xs text-red-500 mt-2">
                      <div title={stockData.error} className="truncate">
                        {stockData.error.length > 50 ? `${stockData.error.substring(0, 50)}...` : stockData.error}
                      </div>
                      <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Last attempt:{" "}
                        {new Date(stockData.lastUpdated).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-600 mb-1">
              Total Options
            </h3>
            <p className="text-xl font-bold text-blue-800">
              {summary.totalOptions.toLocaleString()}
            </p>
            <p className="text-sm text-blue-600">
              {summary.vestedOptions.toLocaleString()} vested (
              {summary.totalOptions > 0
                ? Math.round(
                    (summary.vestedOptions / summary.totalOptions) * 100
                  )
                : 0}
              %)
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-600 mb-1">
              Total RSUs
            </h3>
            <p className="text-xl font-bold text-green-800">
              {summary.totalRSUs.toLocaleString()}
            </p>
            <p className="text-sm text-green-600">
              {summary.vestedRSUs.toLocaleString()} vested (
              {summary.totalRSUs > 0
                ? Math.round((summary.vestedRSUs / summary.totalRSUs) * 100)
                : 0}
              %)
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-600 mb-1">
              Today's Worth
            </h3>
            <p className="text-xl font-bold text-purple-800">
              {formatCurrency(summary.todayWorth)}
            </p>
            <p className="text-sm text-purple-600">
              ₪{summary.todayWorthILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-orange-600 mb-1">
              Value at Grant
            </h3>
            <p className="text-xl font-bold text-orange-800">
              {formatCurrency(summary.valueAtGrant)}
            </p>
            <p className="text-sm text-orange-600">
              ₪{summary.valueAtGrantILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-teal-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-teal-600 mb-1">
              Total Value
            </h3>
            <p className="text-xl font-bold text-teal-800">
              {formatCurrency(summary.totalValue)}
            </p>
            <p className="text-sm text-teal-600">
              ₪{summary.totalValueILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-indigo-600 mb-1">
              Portfolio Count
            </h3>
            <p className="text-xl font-bold text-indigo-800">
              {grants.length}
            </p>
            <p className="text-sm text-indigo-600">{tickers.length} stocks</p>
          </div>
        </div>

        {grants.length === 0 && (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p className="text-lg mb-2">No grants found</p>
            <p>Add your first grant to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};
