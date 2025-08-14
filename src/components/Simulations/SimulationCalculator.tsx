import React, { useState, useMemo } from 'react';
import { useGrantsStore } from '../../stores/useGrantsStore';
import { useExercisesStore } from '../../stores/useExercisesStore';
import { useStockPricesStore } from '../../stores/useStockPricesStore';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { calculateVestedShares, calculateExercisedShares, formatCurrency, monthsDifference } from '../../utils/calculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SimulationScenario {
  leaveDate: Date;
  growth: number;
  projectedPrices: { [ticker: string]: number };
  expectedGross: number;
  grossIls: number;
  expectedTax: number;
  expectedNet: number;
  netIls: number;
  grossPerMonth: number;
  netPerMonth: number;
}

export const SimulationCalculator: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2).toISOString().split('T')[0] // 2 years from now
  );
  
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  
  // Get USD/ILS rate from currency store
  const usdIlsRate = useCurrencyStore((state) => state.usdIlsRate);
  const currencyLastUpdated = useCurrencyStore((state) => state.lastUpdated);
  const currencyError = useCurrencyStore((state) => state.error);
  const currencyLoading = useCurrencyStore((state) => state.isLoading);
  
  // Theme store
  const { isDarkMode } = useThemeStore();

  const growthScenarios = [0, 0.1, 0.3, 0.5, 1.0, 2.0]; // 0%, 10%, 30%, 50%, 100%, 200%

  const calculateScenarios = useMemo((): SimulationScenario[] => {
    const leaveDate = new Date(selectedDate);
    
    return growthScenarios.map((growth) => {
      let expectedGross = 0;
      let expectedTax = 0;
      const projectedPrices: { [ticker: string]: number } = {};
      
      // Group grants by ticker to calculate per-stock projections
      const tickerGroups = grants.reduce((acc, grant) => {
        if (!acc[grant.ticker]) acc[grant.ticker] = [];
        acc[grant.ticker].push(grant);
        return acc;
      }, {} as { [ticker: string]: typeof grants });

      Object.entries(tickerGroups).forEach(([ticker, tickerGrants]) => {
        const currentPrice = stockPrices[ticker]?.price || 0;
        const projectedPrice = currentPrice + (currentPrice * growth);
        projectedPrices[ticker] = projectedPrice;

        tickerGrants.forEach((grant) => {
          const vestedAtLeave = calculateVestedShares(grant.amount, grant.vestingFrom, grant.vestingYears, leaveDate);
          // Filter exercises to include regular exercises + included simulated exercises
          const includedExercises = exercises.filter(exercise => 
            !exercise.isSimulation || exercise.includeInCalculations
          );
          const exercised = calculateExercisedShares(grant.amount, includedExercises);
          const availableShares = vestedAtLeave - exercised;

          if (availableShares > 0) {
            let grossGain = 0;
            let taxAmount = 0;

            if (grant.type === 'RSUs') {
              grossGain = availableShares * projectedPrice;
              // RSUs: Income tax on full value (simplified Israeli tax ~47%)
              taxAmount = grossGain * 0.47;
            } else {
              // Options: only valuable if projected price > grant price
              if (projectedPrice > grant.price) {
                grossGain = availableShares * (projectedPrice - grant.price);
                // Options: Capital gains tax (~25%)
                taxAmount = grossGain * 0.25;
              }
            }

            expectedGross += grossGain;
            expectedTax += taxAmount;
          }
        });
      });

      const expectedNet = expectedGross - expectedTax;
      const grossIls = expectedGross * usdIlsRate;
      const netIls = expectedNet * usdIlsRate;
      
      // Calculate monthly amounts from earliest vesting start to leave date
      const earliestVestingStart = grants.reduce((earliest, grant) => {
        return !earliest || grant.vestingFrom < earliest ? grant.vestingFrom : earliest;
      }, null as Date | null);

      const monthsToLeave = earliestVestingStart 
        ? monthsDifference(earliestVestingStart, leaveDate) 
        : 1;

      const grossPerMonth = monthsToLeave > 0 ? grossIls / monthsToLeave : 0;
      const netPerMonth = monthsToLeave > 0 ? netIls / monthsToLeave : 0;

      return {
        leaveDate,
        growth,
        projectedPrices,
        expectedGross,
        grossIls,
        expectedTax,
        expectedNet,
        netIls,
        grossPerMonth,
        netPerMonth,
      };
    });
  }, [selectedDate, usdIlsRate, grants, exercises, stockPrices, growthScenarios]);

  const chartData = calculateScenarios.map((scenario) => ({
    growth: `${(scenario.growth * 100).toFixed(0)}%`,
    'Expected Gross': Math.round(scenario.expectedGross),
    'Expected Net': Math.round(scenario.expectedNet),
    'Expected Tax': Math.round(scenario.expectedTax),
  }));

  if (grants.length === 0) {
    return (
      <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <p className="text-lg mb-2">No grants to simulate</p>
        <p>Add grants first to run scenario simulations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className={`${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} rounded-lg p-4 border`}>
        <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Simulation Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
              Exit/Leave Date
            </label>
            <div className="date-input-wrapper">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full px-3 py-2 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-900'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <svg 
                className={`calendar-icon ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-1`}>
              USD/ILS Exchange Rate
              {currencyLoading && (
                <span className="ml-2 text-xs text-blue-500">Loading...</span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={usdIlsRate.toFixed(4)}
                readOnly
                className={`w-full px-3 py-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-50 text-gray-700'} rounded-md cursor-not-allowed`}
                title="Live exchange rate fetched automatically"
              />
              <div className="absolute right-2 top-2 text-green-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {currencyError ? (
                <span className="text-red-500">⚠️ Using fallback rate (API error)</span>
              ) : currencyLastUpdated ? (
                <span className="text-green-600">
                  ✓ Live rate updated: {new Date(currencyLastUpdated).toLocaleTimeString()}
                </span>
              ) : (
                <span>Exchange rate loading...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scenarios Table */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden`}>
        <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white border-gray-700' : 'text-gray-800 border-gray-200'} px-6 py-4 border-b`}>Growth Scenarios</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Growth Rate
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Projected Prices
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Expected Gross (USD)
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Expected Tax (USD)
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Expected Net (USD)
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Net (ILS)
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Net Per Month (ILS)
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {calculateScenarios.map((scenario) => (
                <tr key={scenario.growth} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      scenario.growth === 0 ? (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800') :
                      scenario.growth <= 0.5 ? (isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800') :
                      scenario.growth <= 1.0 ? (isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800') :
                      (isDarkMode ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-800')
                    }`}>
                      {(scenario.growth * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      {Object.entries(scenario.projectedPrices).map(([ticker, price]) => (
                        <div key={ticker} className="flex justify-between items-center">
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>{ticker}:</span>
                          <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'} ml-2`}>{formatCurrency(price)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(scenario.expectedGross)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {formatCurrency(scenario.expectedTax)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {formatCurrency(scenario.expectedNet)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    ₪{scenario.netIls.toLocaleString()}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    ₪{scenario.netPerMonth.toLocaleString()}/mo
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
        <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Scenario Visualization</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} 
              />
              <XAxis 
                dataKey="growth" 
                tick={{ fill: isDarkMode ? '#D1D5DB' : '#374151' }}
                axisLine={{ stroke: isDarkMode ? '#6B7280' : '#D1D5DB' }}
                tickLine={{ stroke: isDarkMode ? '#6B7280' : '#D1D5DB' }}
              />
              <YAxis 
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                tick={{ fill: isDarkMode ? '#D1D5DB' : '#374151' }}
                axisLine={{ stroke: isDarkMode ? '#6B7280' : '#D1D5DB' }}
                tickLine={{ stroke: isDarkMode ? '#6B7280' : '#D1D5DB' }}
              />
              <Tooltip 
                formatter={(value: any) => [formatCurrency(value), '']}
                labelStyle={{ color: isDarkMode ? '#F3F4F6' : '#374151' }}
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDarkMode ? '#4B5563' : '#E5E7EB'}`,
                  borderRadius: '6px',
                  color: isDarkMode ? '#F3F4F6' : '#374151'
                }}
              />
              <Legend 
                wrapperStyle={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}
              />
              <Line 
                type="monotone" 
                dataKey="Expected Gross" 
                stroke={isDarkMode ? '#60A5FA' : '#3B82F6'} 
                strokeWidth={3}
                dot={{ fill: isDarkMode ? '#60A5FA' : '#3B82F6', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: isDarkMode ? '#93C5FD' : '#3B82F6' }}
              />
              <Line 
                type="monotone" 
                dataKey="Expected Net" 
                stroke={isDarkMode ? '#34D399' : '#10B981'} 
                strokeWidth={3}
                dot={{ fill: isDarkMode ? '#34D399' : '#10B981', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: isDarkMode ? '#6EE7B7' : '#10B981' }}
              />
              <Line 
                type="monotone" 
                dataKey="Expected Tax" 
                stroke={isDarkMode ? '#F87171' : '#EF4444'} 
                strokeWidth={3}
                dot={{ fill: isDarkMode ? '#F87171' : '#EF4444', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: isDarkMode ? '#FCA5A5' : '#EF4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};