import React, { useState, useMemo } from 'react';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useExercisesStore } from '../../stores/useExercisesStore';
import { useStockPricesStore } from '../../stores/useStockPricesStore';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useTaxSettingsStore } from '../../stores/useTaxSettingsStore';
import { calculateVestedShares, calculateExercisedShares, formatCurrency } from '../../utils/calculations';
import { calculateTaxForGrant } from '../../utils/taxCalculations';
import { getSection102Status } from '../../utils/section102';

interface ExerciseSelection {
  grantId: string;
  shares: number;
}

interface ExerciseResult {
  grantId: string;
  ticker: string;
  type: 'RSUs' | 'Options';
  shares: number;
  currentPrice: number;
  strikePrice: number;
  grossGain: number;
  taxAmount: number;
  netGain: number;
}

export const ExerciseSimulation: React.FC = () => {
  const [exerciseSelections, setExerciseSelections] = useState<ExerciseSelection[]>([]);
  const [customPrices, setCustomPrices] = useState<{[ticker: string]: number}>({});
  
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const usdIlsRate = useCurrencyStore((state) => state.usdIlsRate);
  const taxSettings = useTaxSettingsStore((state) => ({
    marginalTaxRate: state.marginalTaxRate,
    annualIncome: state.annualIncome,
    useProgressiveTax: state.useProgressiveTax,
    isControllingShareholder: state.isControllingShareholder,
  }));
  const { isDarkMode } = useThemeStore();

  // Calculate available shares for each grant (sorted by grant date, oldest first)
  const grantAvailability = useMemo(() => {
    const sortedGrants = [...grants].sort((a, b) => 
      new Date(a.grantDate).getTime() - new Date(b.grantDate).getTime()
    );
    return sortedGrants.map((grant) => {
      const vested = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears, new Date());
      const exercised = calculateExercisedShares(grant.amount, exercises);
      const available = vested - exercised;
      const marketPrice = stockPrices[grant.ticker]?.price || 0;
      const effectivePrice = customPrices[grant.ticker] !== undefined ? customPrices[grant.ticker] : marketPrice;
      
      return {
        ...grant,
        vested,
        exercised,
        available: Math.max(0, available),
        currentPrice: effectivePrice,
        marketPrice, // Keep track of market price for display
        isProfitable: grant.type === 'RSUs' || effectivePrice > grant.price
      };
    });
  }, [grants, exercises, stockPrices, customPrices]);

  // Update exercise selection for a grant
  const updateExerciseSelection = (grantId: string, shares: number) => {
    setExerciseSelections(prev => {
      const existing = prev.find(s => s.grantId === grantId);
      if (existing) {
        if (shares === 0) {
          return prev.filter(s => s.grantId !== grantId);
        }
        return prev.map(s => s.grantId === grantId ? { ...s, shares } : s);
      } else if (shares > 0) {
        return [...prev, { grantId, shares }];
      }
      return prev;
    });
  };

  // Get shares selected for a grant
  const getSelectedShares = (grantId: string): number => {
    return exerciseSelections.find(s => s.grantId === grantId)?.shares || 0;
  };

  // Update custom price for a ticker
  const updateCustomPrice = (ticker: string, price: number) => {
    setCustomPrices(prev => ({
      ...prev,
      [ticker]: price
    }));
  };

  // Reset price to market price
  const resetToMarketPrice = (ticker: string) => {
    setCustomPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[ticker];
      return newPrices;
    });
  };

  // Get unique tickers from available grants
  const uniqueTickers = [...new Set(grantAvailability.map(grant => grant.ticker))];

  // Calculate exercise results
  const exerciseResults = useMemo((): ExerciseResult[] => {
    return exerciseSelections.map(selection => {
      const grant = grants.find(g => g.id === selection.grantId);
      if (!grant) return null;
      
      const marketPrice = stockPrices[grant.ticker]?.price || 0;
      const currentPrice = customPrices[grant.ticker] !== undefined ? customPrices[grant.ticker] : marketPrice;
      
      // Use smart tax calculation
      const taxResult = calculateTaxForGrant(
        grant,
        selection.shares,
        currentPrice,
        taxSettings,
        usdIlsRate
      );
      
      return {
        grantId: selection.grantId,
        ticker: grant.ticker,
        type: grant.type,
        shares: selection.shares,
        currentPrice,
        strikePrice: grant.price,
        grossGain: taxResult.grossGain,
        taxAmount: taxResult.totalTax,
        netGain: taxResult.netGain
      };
    }).filter(Boolean) as ExerciseResult[];
  }, [exerciseSelections, grants, stockPrices, taxSettings, usdIlsRate, customPrices]);

  // Calculate totals
  const totals = useMemo(() => {
    const grossTotal = exerciseResults.reduce((sum, result) => sum + result.grossGain, 0);
    const taxTotal = exerciseResults.reduce((sum, result) => sum + result.taxAmount, 0);
    const netTotal = exerciseResults.reduce((sum, result) => sum + result.netGain, 0);
    
    return {
      gross: grossTotal,
      tax: taxTotal,
      net: netTotal,
      grossIls: grossTotal * usdIlsRate,
      taxIls: taxTotal * usdIlsRate,
      netIls: netTotal * usdIlsRate
    };
  }, [exerciseResults, usdIlsRate]);

  if (grants.length === 0) {
    return (
      <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <p className="text-lg mb-2">No grants available</p>
        <p>Add grants first to simulate exercises</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>Exercise Simulation</h3>
        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
          Select grants and specify shares to exercise, then see potential gains and net value
        </p>
        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Tax calculation: {
            taxSettings.annualIncome && taxSettings.annualIncome > 0 
              ? `Progressive (Annual income: ₪${taxSettings.annualIncome.toLocaleString()})`
              : taxSettings.marginalTaxRate && !taxSettings.useProgressiveTax
                ? `Fixed rate (${(taxSettings.marginalTaxRate * 100).toFixed(0)}%)`
                : 'Progressive (simplified)'
          } • Includes Section 102 benefits where applicable
        </div>
      </div>


      {/* Grant Selection */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden`}>
        <h4 className={`text-md font-medium ${isDarkMode ? 'text-white border-gray-700' : 'text-gray-800 border-gray-200'} px-6 py-3 border-b`}>Select Grants to Exercise</h4>
        <div className="p-6 space-y-4">
          {grantAvailability.map((grant) => {
            const section102Status = getSection102Status(grant);
            
            return (
              <div key={grant.id} className={`${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                      {grant.ticker} - {grant.type}
                    </h5>
                    {grant.type === 'Options' && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        grant.isProfitable 
                          ? (isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800')
                          : (isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800')
                      }`}>
                        {grant.isProfitable ? 'In the money' : 'Out of the money'}
                      </span>
                    )}
                    {/* Section 102 Status */}
                    <span 
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        section102Status.status === 'eligible'
                          ? (isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800')
                          : section102Status.status === 'waiting'
                            ? (isDarkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-800')
                            : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')
                      }`}
                      title={
                        section102Status.status === 'eligible' ? 'Section 102 benefits available - capital gains tax rate' :
                        section102Status.status === 'waiting' ? `Section 102 eligibility in ${section102Status.text}` :
                        'Not Section 102 or not applicable'
                      }
                    >
                      {section102Status.status === 'eligible' ? '102 ✓' : 
                       section102Status.status === 'waiting' ? `102 ${section102Status.text}` : 
                       section102Status.text}
                    </span>
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
                    <div>Available: {Math.ceil(grant.available).toLocaleString()} shares (Vested: {Math.ceil(grant.vested)}, Exercised: {Math.ceil(grant.exercised)})</div>
                    <div>
                      Selling Price: {formatCurrency(grant.currentPrice)}
                      {customPrices[grant.ticker] !== undefined && (
                        <span className={`ml-2 text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          (Custom)
                        </span>
                      )}
                      {customPrices[grant.ticker] === undefined && grant.marketPrice !== grant.currentPrice && (
                        <span className={`ml-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Market: {formatCurrency(grant.marketPrice)}
                        </span>
                      )}
                    </div>
                    {grant.currentPrice > 0 && grant.price > 0 && (
                      <div>
                        Profit: {((grant.currentPrice - grant.price) / grant.price * 100).toFixed(1)}%
                        <span className={`ml-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          ({formatCurrency(grant.currentPrice - grant.price)} per share)
                        </span>
                      </div>
                    )}
                    {grant.type === 'Options' && (
                      <div>Strike Price: {formatCurrency(grant.price)}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Shares to exercise:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={grant.available}
                    value={getSelectedShares(grant.id)}
                    onChange={(e) => updateExerciseSelection(grant.id, parseInt(e.target.value) || 0)}
                    className={`w-24 px-3 py-2 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-900'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    disabled={grant.available === 0 || (grant.type === 'Options' && !grant.isProfitable)}
                  />
                  <button
                    onClick={() => updateExerciseSelection(grant.id, grant.available)}
                    disabled={grant.available === 0 || (grant.type === 'Options' && !grant.isProfitable)}
                    className={`text-sm px-3 py-1 rounded ${
                      grant.available === 0 || (grant.type === 'Options' && !grant.isProfitable)
                        ? (isDarkMode ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                        : (isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600')
                    }`}
                  >
                    Max
                  </button>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Price Controls */}
      {uniqueTickers.length > 0 && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden`}>
          <h4 className={`text-md font-medium ${isDarkMode ? 'text-white border-gray-700' : 'text-gray-800 border-gray-200'} px-6 py-3 border-b`}>Selling Price per Stock</h4>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueTickers.map((ticker) => {
                const marketPrice = stockPrices[ticker]?.price || 0;
                const customPrice = customPrices[ticker];
                const isCustom = customPrice !== undefined;
                
                return (
                  <div key={ticker} className={`${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{ticker}</h5>
                      {isCustom && (
                        <button
                          onClick={() => resetToMarketPrice(ticker)}
                          className={`text-xs px-2 py-1 rounded ${
                            isDarkMode 
                              ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' 
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
                      Market: {formatCurrency(marketPrice)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={isCustom ? customPrice : marketPrice}
                        onChange={(e) => updateCustomPrice(ticker, parseFloat(e.target.value) || 0)}
                        className={`flex-1 px-2 py-1 text-sm border rounded ${
                          isDarkMode
                            ? 'border-gray-600 bg-gray-800 text-white'
                            : 'border-gray-300 bg-white text-gray-900'
                        } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        placeholder={marketPrice.toString()}
                      />
                    </div>
                    {isCustom && (
                      <div className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} mt-1`}>
                        Custom price set
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-4`}>
              💡 Set custom selling prices to simulate different scenarios.
            </p>
          </div>
        </div>
      )}

      {/* Exercise Results */}
      {exerciseResults.length > 0 && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden`}>
          <h4 className={`text-md font-medium ${isDarkMode ? 'text-white border-gray-700' : 'text-gray-800 border-gray-200'} px-6 py-3 border-b`}>Exercise Results</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Grant
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Shares
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Selling Price
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Gross Gain (USD)
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Tax (USD)
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    Net Gain (USD)
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {exerciseResults.map((result) => (
                  <tr key={result.grantId} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        <div className="font-medium">{result.ticker}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{result.type}</div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {Math.ceil(result.shares).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        <div>
                          {formatCurrency(result.currentPrice)}
                          {customPrices[result.ticker] !== undefined && (
                            <span className={`ml-1 text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              (Custom)
                            </span>
                          )}
                        </div>
                        {result.type === 'Options' && (
                          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Strike: {formatCurrency(result.strikePrice)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(result.grossGain)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {formatCurrency(result.taxAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(result.netGain)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals Summary */}
      {exerciseResults.length > 0 && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
          <h4 className={`text-md font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Exercise Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>Total Gross Gain</div>
              <div className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(totals.gross)}
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                ₪{totals.grossIls.toLocaleString()}
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>Total Tax</div>
              <div className="text-xl font-semibold text-red-600">
                {formatCurrency(totals.tax)}
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                ₪{totals.taxIls.toLocaleString()}
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 sm:col-span-2 lg:col-span-1`}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>Total Net Gain</div>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(totals.net)}
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                ₪{totals.netIls.toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              💡 Tax calculations use your configured tax settings and include Section 102 benefits where applicable.
              Results are estimates for planning purposes. Consult a tax professional for precise calculations.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {exerciseResults.length === 0 && (
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-8 text-center`}>
          <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <h4 className="text-lg font-medium mb-2">No exercises selected</h4>
            <p className="text-sm">
              Select grants and specify the number of shares you want to exercise to see potential gains.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};