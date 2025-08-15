import React from "react";
import { useGrantsStore } from "../../stores/useGrantsStore";
import { useExercisesStore } from "../../stores/useExercisesStore";
import { useStockPricesStore } from "../../stores/useStockPricesStore";
import { useThemeStore } from "../../stores/useThemeStore";
import {
  calculateVestedShares,
  calculateExercisedShares,
  formatCurrency,
} from "../../utils/calculations";

interface PortfolioBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PortfolioBreakdownModal: React.FC<PortfolioBreakdownModalProps> = ({
  isOpen,
  onClose,
}) => {
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const { isDarkMode } = useThemeStore();
  const getAllTickers = useGrantsStore((state) => state.getAllTickers);

  const tickers = getAllTickers();

  const calculateBreakdownByTicker = () => {
    const breakdown: {
      [ticker: string]: {
        totalOptions: number;
        totalRSUs: number;
        vestedOptions: number;
        vestedRSUs: number;
        totalValue: number;
        currentPrice: number;
      };
    } = {};

    // Sort grants by date (oldest first) for consistent ordering
    const sortedGrants = [...grants].sort((a, b) => 
      new Date(a.grantDate).getTime() - new Date(b.grantDate).getTime()
    );
    
    sortedGrants.forEach((grant) => {
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
      const totalShares = grant.amount - exercised; // All unexercised shares
      const currentPrice = stockPrices[grant.ticker]?.price || 0;

      if (!breakdown[grant.ticker]) {
        breakdown[grant.ticker] = {
          totalOptions: 0,
          totalRSUs: 0,
          vestedOptions: 0,
          vestedRSUs: 0,
          totalValue: 0,
          currentPrice: currentPrice,
        };
      }

      if (grant.type === "Options") {
        breakdown[grant.ticker].totalOptions += grant.amount;
        breakdown[grant.ticker].vestedOptions += vested;
        
        if (currentPrice > grant.price) {
          // Total value: net proceeds from all unexercised shares if exercised and sold
          breakdown[grant.ticker].totalValue += totalShares * (currentPrice - grant.price);
        }
      } else {
        breakdown[grant.ticker].totalRSUs += Number(grant.amount);
        breakdown[grant.ticker].vestedRSUs += vested;
        // Total value: proceeds from selling all unexercised RSUs
        breakdown[grant.ticker].totalValue += totalShares * currentPrice;
      }
    });

    return breakdown;
  };

  const breakdown = calculateBreakdownByTicker();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-hidden`}>
        <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <svg className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
            </svg>
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Portfolio Breakdown
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-auto max-h-[calc(80vh-120px)]">
          {tickers.length > 0 ? (
            <div className={`rounded-lg overflow-hidden border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <table className={`w-full text-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-4 py-3 text-left ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Ticker
                    </th>
                    <th className={`px-4 py-3 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Price
                    </th>
                    <th className={`px-4 py-3 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Options
                    </th>
                    <th className={`px-4 py-3 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      RSUs
                    </th>
                    <th className={`px-4 py-3 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Vested Options
                    </th>
                    <th className={`px-4 py-3 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Vested RSUs
                    </th>
                    <th className={`px-4 py-3 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {tickers.map((ticker) => {
                    const data = breakdown[ticker];
                    const stockData = stockPrices[ticker];
                    return (
                      <tr key={ticker} className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                        <td className={`px-4 py-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {ticker}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {stockData ? (
                            stockData.error ? (
                              <div className="flex items-center justify-end">
                                <span className="text-red-500 text-xs mr-1">⚠️</span>
                                <span className="text-red-500 text-xs">Error</span>
                              </div>
                            ) : (
                              formatCurrency(stockData.price)
                            )
                          ) : (
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Loading...
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {data.totalOptions > 0 ? data.totalOptions.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {data.totalRSUs > 0 ? data.totalRSUs.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {data.vestedOptions > 0 ? Math.floor(data.vestedOptions).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {data.vestedRSUs > 0 ? Math.floor(data.vestedRSUs).toLocaleString() : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          data.totalValue > 0 
                            ? isDarkMode ? 'text-green-400' : 'text-green-600'
                            : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {data.totalValue > 0 ? formatCurrency(data.totalValue) : '$0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>No grants found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};