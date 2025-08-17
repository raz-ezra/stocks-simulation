import React, { useState } from "react";
import { useGrantsStore } from "../../stores/useGrantsStore";
import { useExercisesStore } from "../../stores/useExercisesStore";
import { useStockPricesStore } from "../../stores/useStockPricesStore";
import { useCurrencyStore } from "../../stores/useCurrencyStore";
import { useThemeStore } from "../../stores/useThemeStore";
import { useTaxSettingsStore } from "../../stores/useTaxSettingsStore";
import {
  calculateVestedShares,
  calculateExercisedShares,
  formatCurrency,
  calculateESPPTax,
} from "../../utils/calculations";
import { hasMetSection102HoldingPeriod, calculateSection102Tax } from "../../utils/section102";
import { PortfolioBreakdownModal } from "./PortfolioBreakdownModal";

interface OverviewProps {
  onForceRefresh: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ onForceRefresh }) => {
  const [showPortfolioBreakdown, setShowPortfolioBreakdown] = useState(false);
  
  const grants = useGrantsStore((state) => state.grants);
  const exercises = useExercisesStore((state) => state.exercises);
  const stockPrices = useStockPricesStore((state) => state.stockPrices);
  const getAllTickers = useGrantsStore((state) => state.getAllTickers);

  // Currency store
  const usdIlsRate = useCurrencyStore((state) => state.usdIlsRate);
  
  // Theme store
  const { isDarkMode } = useThemeStore();
  
  // Tax settings store
  const { marginalTaxRate, annualIncome, useProgressiveTax } = useTaxSettingsStore();

  const tickers = getAllTickers();

  // Israeli progressive tax brackets for 2024/2025 (annual amounts in ILS)
  const calculateIsraeliIncomeTax = (annualIncomeILS: number): number => {
    const brackets = [
      { min: 0, max: 79560, rate: 0.10 },
      { min: 79560, max: 114120, rate: 0.14 },
      { min: 114120, max: 177360, rate: 0.20 },
      { min: 177360, max: 247440, rate: 0.31 },
      { min: 247440, max: 514920, rate: 0.35 },
      { min: 514920, max: 663240, rate: 0.47 },
      { min: 663240, max: 721560, rate: 0.47 },
      { min: 721560, max: Infinity, rate: 0.50 } // 47% + 3% surtax
    ];

    let tax = 0;
    let previousMax = 0;

    for (const bracket of brackets) {
      if (annualIncomeILS > bracket.min) {
        const taxableInBracket = Math.min(annualIncomeILS, bracket.max) - previousMax;
        tax += taxableInBracket * bracket.rate;
        previousMax = bracket.max;
        
        if (annualIncomeILS <= bracket.max) break;
      }
    }

    return tax;
  };

  const calculateTaxForGrant = (grant: any, grossGainUSD: number): number => {
    // Check if Section 102 benefits apply (default to Section 102 if not specified)
    const isSection102 = grant.isSection102 !== false;
    const section102Track = grant.section102Track || 'capital-gains';
    const isSection102Eligible = isSection102 && 
      section102Track === 'capital-gains' &&
      hasMetSection102HoldingPeriod(grant);

    if (isSection102Eligible) {
      // Use Section 102 tax calculation
      const effectiveMarginalRate = marginalTaxRate !== null && !useProgressiveTax 
        ? marginalTaxRate 
        : 0.47; // Default to high rate if not specified
      
      const currentPrice = stockPrices[grant.ticker]?.price || 0;
      const amount = grant.amount; // For overview, calculate for full grant amount
      
      const { totalTax } = calculateSection102Tax(
        grant,
        currentPrice,
        amount,
        effectiveMarginalRate
      );
      
      return totalTax;
    }

    // Regular tax calculation (non-Section 102)
    const grantValueUSD = (grant.amount) * grant.price;
    const capitalGainUSD = grossGainUSD - grantValueUSD;

    if (grant.type === "RSUs") {
      // RSUs: Income tax on the entire gross gain
      const grossGainILS = grossGainUSD * usdIlsRate;
      
      // If user has set a marginal tax rate, use it directly
      if (marginalTaxRate !== null && !useProgressiveTax) {
        return grossGainUSD * marginalTaxRate;
      }
      
      // If user provided annual income, calculate tax on top of existing income
      if (annualIncome !== null && annualIncome > 0) {
        const totalIncomeILS = annualIncome + grossGainILS;
        const taxWithRSU = calculateIsraeliIncomeTax(totalIncomeILS);
        const taxWithoutRSU = calculateIsraeliIncomeTax(annualIncome);
        const additionalTaxILS = taxWithRSU - taxWithoutRSU;
        return additionalTaxILS / usdIlsRate;
      }
      
      // Default: Calculate as if this is the only income (simplified)
      const taxILS = calculateIsraeliIncomeTax(grossGainILS);
      return taxILS / usdIlsRate;
    } else if (grant.type === "Options") {
      // Options: Capital gains tax (25%) only on the profit
      return Math.max(0, capitalGainUSD * 0.25);
    } else if (grant.type === "ESPP") {
      // ESPP: Tax calculation depends on trustee option
      const currentPrice = stockPrices[grant.ticker]?.price || 0;
      const discount = grant.esppDiscount || 0.15;
      
      // Calculate fair market value considering lookback provision
      const periodStartPrice = grant.esppPeriodStartPrice || grant.price / (1 - discount);
      const periodEndPrice = grant.price / (1 - discount);
      const fairMarketValueAtPurchase = Math.min(periodStartPrice, periodEndPrice);
      
      // Check if holding period is met (2 years from purchase date)
      const purchaseDate = grant.purchaseDate || grant.vestingFrom;
      const monthsHeld = Math.floor(
        (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      const holdingPeriodMet = monthsHeld >= 24;
      
      const withTrustee = grant.esppWithTrustee || false;
      
      const { totalTax, immediatelyTaxed, discountTax } = calculateESPPTax(
        grant.price,
        fairMarketValueAtPurchase,
        currentPrice,
        grant.amount,
        withTrustee,
        holdingPeriodMet
      );
      
      // For non-trustee ESPP, discount tax was already paid at purchase
      if (!withTrustee && immediatelyTaxed) {
        // Only return capital gains tax portion for future sale
        return totalTax - discountTax;
      }
      
      return totalTax;
    }
    
    return 0;
  };

  const calculateSummary = () => {
    let totalOptions = 0;
    let totalRSUs = 0;
    let totalESPP = 0;
    let vestedOptions = 0;
    let vestedRSUs = 0;
    let vestedESPP = 0;
    let todayWorth = 0;
    let valueAtGrant = 0;
    let valueAtGrantVested = 0;
    let totalValue = 0;
    let totalVestedValue = 0;
    let totalTaxEstimate = 0;
    let totalVestedTaxEstimate = 0;

    // Sort grants by date (oldest first) for consistent ordering
    const sortedGrants = [...grants].sort((a, b) => 
      new Date(a.grantDate).getTime() - new Date(b.grantDate).getTime()
    );
    
    sortedGrants.forEach((grant) => {
      const vested = calculateVestedShares(
        grant.amount,
        grant.vestingFrom,
        grant.vestingYears,
        new Date(),
        grant.type
      );
      // Filter exercises to include regular exercises + included simulated exercises
      const includedExercises = exercises.filter(exercise => 
        !exercise.isSimulation || exercise.includeInCalculations
      );
      const exercised = calculateExercisedShares(grant.amount, includedExercises);
      const availableShares = vested - exercised;
      const totalShares = grant.amount - exercised; // All unexercised shares
      const currentPrice = stockPrices[grant.ticker]?.price || 0;

      // Calculate value at grant (what it was worth when granted) - total grant amount
      const grantValue = grant.amount * grant.price;
      valueAtGrant += grantValue;
      
      // Calculate value at grant for vested shares only
      const grantValueVested = availableShares * grant.price;
      valueAtGrantVested += grantValueVested;

      if (grant.type === "Options") {
        totalOptions += grant.amount;
        vestedOptions += vested;
        // For options, today's worth is the gain (current price - strike price) - only vested
        if (currentPrice > grant.price) {
          const optionGain = availableShares * (currentPrice - grant.price);
          todayWorth += optionGain;
          // Total value: net proceeds from all unexercised shares if exercised and sold
          totalValue += totalShares * (currentPrice - grant.price);
          // Total vested value: net proceeds from vested unexercised shares if exercised and sold
          totalVestedValue += availableShares * (currentPrice - grant.price);
        } else {
          // If underwater, no value from exercising and selling
          totalValue += 0;
          totalVestedValue += 0;
        }
      } else if (grant.type === "RSUs") {
        totalRSUs += Number(grant.amount);
        vestedRSUs += vested;
        // For RSUs, today's worth is the full current value - only vested
        const rsuValue = availableShares * currentPrice;
        todayWorth += rsuValue;
        // Total value: proceeds from selling all unexercised RSUs
        totalValue += totalShares * currentPrice;
        // Total vested value: proceeds from selling all vested unexercised RSUs
        totalVestedValue += availableShares * currentPrice;
      } else if (grant.type === "ESPP") {
        totalESPP += Number(grant.amount);
        vestedESPP += vested;
        // For ESPP, you own the shares, so value is full current market value
        const esppValue = availableShares * currentPrice;
        todayWorth += esppValue;
        // Total value: full value of all unexercised shares
        totalValue += totalShares * currentPrice;
        // Total vested value: full value of vested unexercised shares
        totalVestedValue += availableShares * currentPrice;
      }

      // Calculate tax estimates
      if (currentPrice > 0) {
        // For tax calculation, we need to account for different share amounts and gain types
        if (grant.type === "Options" && currentPrice > grant.price) {
          // Options: Tax is on the gain, not the full current price
          const totalGain = totalShares * (currentPrice - grant.price);
          const vestedGain = availableShares * (currentPrice - grant.price);
          
          if (totalGain > 0) {
            // For options, tax is 25% capital gains on the gain
            totalTaxEstimate += totalGain * 0.25;
          }
          
          if (vestedGain > 0) {
            totalVestedTaxEstimate += vestedGain * 0.25;
          }
        } else if (grant.type === "RSUs") {
          // RSUs: Tax is on the full current price (treated as income)
          const totalGrossGain = totalShares * currentPrice;
          const vestedGrossGain = availableShares * currentPrice;
          
          if (totalGrossGain > 0) {
            const taxForTotal = calculateTaxForGrant(grant, totalGrossGain);
            totalTaxEstimate += taxForTotal;
          }

          if (vestedGrossGain > 0) {
            const taxForVested = calculateTaxForGrant(grant, vestedGrossGain);
            totalVestedTaxEstimate += taxForVested;
          }
        } else if (grant.type === "ESPP" && currentPrice > grant.price) {
          // ESPP: Complex tax calculation based on discount and capital gains
          const totalGain = totalShares * (currentPrice - grant.price);
          const vestedGain = availableShares * (currentPrice - grant.price);
          
          if (totalGain > 0) {
            const taxForTotal = calculateTaxForGrant(grant, totalShares * currentPrice);
            totalTaxEstimate += taxForTotal;
          }
          
          if (vestedGain > 0) {
            const taxForVested = calculateTaxForGrant(grant, availableShares * currentPrice);
            totalVestedTaxEstimate += taxForVested;
          }
        }
        // If Options are underwater, no tax (no gain)
      }
    });

    // Calculate net proceeds after taxes
    const netTotalValue = totalValue - totalTaxEstimate;
    const netVestedValue = totalVestedValue - totalVestedTaxEstimate;

    return {
      totalOptions,
      totalRSUs,
      totalESPP,
      vestedOptions,
      vestedRSUs,
      vestedESPP,
      todayWorth,
      valueAtGrant,
      totalValue,
      totalVestedValue,
      totalTaxEstimate,
      totalVestedTaxEstimate,
      netTotalValue,
      netVestedValue,
      // ILS conversions
      todayWorthILS: todayWorth * usdIlsRate,
      valueAtGrantILS: valueAtGrant * usdIlsRate,
      totalValueILS: totalValue * usdIlsRate,
      totalVestedValueILS: totalVestedValue * usdIlsRate,
      totalTaxEstimateILS: totalTaxEstimate * usdIlsRate,
      totalVestedTaxEstimateILS: totalVestedTaxEstimate * usdIlsRate,
      netTotalValueILS: netTotalValue * usdIlsRate,
      netVestedValueILS: netVestedValue * usdIlsRate,
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
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPortfolioBreakdown(true)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-800'
                }`}
              >
                Portfolio Breakdown
              </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">

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
              Total Vested Value
            </h3>
            <p className="text-xl font-bold text-indigo-800">
              {formatCurrency(summary.totalVestedValue)}
            </p>
            <p className="text-sm text-indigo-600">
              ₪{summary.totalVestedValueILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-cyan-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-cyan-600 mb-1">
              Net Proceeds (All)
            </h3>
            <p className={`text-xl font-bold ${summary.netTotalValue >= 0 ? 'text-cyan-800' : 'text-red-700'}`}>
              {formatCurrency(summary.netTotalValue)}
            </p>
            <p className={`text-sm ${summary.netTotalValue >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
              ₪{summary.netTotalValueILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-rose-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-rose-600 mb-1">
              Net Proceeds (Vested)
            </h3>
            <p className={`text-xl font-bold ${summary.netVestedValue >= 0 ? 'text-rose-800' : 'text-red-700'}`}>
              {formatCurrency(summary.netVestedValue)}
            </p>
            <p className={`text-sm ${summary.netVestedValue >= 0 ? 'text-rose-600' : 'text-red-600'}`}>
              ₪{summary.netVestedValueILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {grants.length === 0 && (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p className="text-lg mb-2">No grants found</p>
            <p>Add your first grant to get started</p>
          </div>
        )}
      </div>

      {/* Portfolio Breakdown Modal */}
      <PortfolioBreakdownModal 
        isOpen={showPortfolioBreakdown}
        onClose={() => setShowPortfolioBreakdown(false)}
      />
    </div>
  );
};
