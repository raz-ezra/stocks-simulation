import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatCurrency } from '../../utils/calculations';

interface TaxBreakdownProps {
  grantType: 'RSUs' | 'Options' | 'ESPP';
  amount: number;
  grantPrice: number;
  exercisePrice: number;
  taxAmount: number;
  grossGain: number;
  netGain: number;
  usdIlsRate: number;
  isSection102?: boolean;
  holdingPeriodMet?: boolean;
  esppDiscount?: number;
  esppWithTrustee?: boolean;
}

export const TaxBreakdown: React.FC<TaxBreakdownProps> = ({
  grantType,
  amount,
  grantPrice,
  exercisePrice,
  taxAmount,
  grossGain,
  netGain,
  usdIlsRate,
  isSection102 = false,
  holdingPeriodMet = false,
  esppDiscount = 0.15,
  esppWithTrustee = false,
}) => {
  const { isDarkMode } = useThemeStore();
  const [showDetails, setShowDetails] = useState(false);

  // Calculate components based on grant type
  const calculateComponents = () => {
    if (grantType === 'RSUs') {
      return {
        income: grossGain,
        capitalGains: 0,
        incomeTax: taxAmount,
        capitalGainsTax: 0,
        taxRate: (taxAmount / grossGain) * 100,
      };
    } else if (grantType === 'Options') {
      const gain = (exercisePrice - grantPrice) * amount;
      if (isSection102 && holdingPeriodMet) {
        // Section 102: grant price taxed as income, appreciation as capital gains
        const incomeComponent = grantPrice * amount;
        const capitalGainsComponent = gain - incomeComponent;
        return {
          income: incomeComponent,
          capitalGains: capitalGainsComponent,
          incomeTax: incomeComponent * 0.47,
          capitalGainsTax: capitalGainsComponent * 0.25,
          taxRate: (taxAmount / grossGain) * 100,
        };
      } else {
        // Regular options: all capital gains
        return {
          income: 0,
          capitalGains: gain,
          incomeTax: 0,
          capitalGainsTax: gain * 0.25,
          taxRate: 25,
        };
      }
    } else { // ESPP
      const fairMarketValue = grantPrice / (1 - esppDiscount);
      const discountBenefit = (fairMarketValue - grantPrice) * amount;
      const appreciation = (exercisePrice - fairMarketValue) * amount;
      
      if (!esppWithTrustee) {
        // Without trustee: discount already taxed at purchase
        return {
          income: discountBenefit,
          capitalGains: appreciation,
          incomeTax: 0, // Already paid at purchase
          capitalGainsTax: appreciation * 0.25,
          taxRate: (taxAmount / grossGain) * 100,
          note: 'Discount tax was paid at purchase',
        };
      } else if (holdingPeriodMet) {
        // With trustee, held 2+ years
        // Discount is ALWAYS ordinary income, appreciation is capital gains
        return {
          income: discountBenefit,
          capitalGains: appreciation,
          incomeTax: discountBenefit * 0.47, // Always at marginal rate
          capitalGainsTax: appreciation * 0.25,
          taxRate: (taxAmount / grossGain) * 100,
          note: 'Trustee may withhold less, but you owe your marginal rate on discount',
        };
      } else {
        // With trustee, sold early
        return {
          income: grossGain,
          capitalGains: 0,
          incomeTax: grossGain * 0.47,
          capitalGainsTax: 0,
          taxRate: 47,
        };
      }
    }
  };

  const components = calculateComponents();
  const effectiveTaxRate = grossGain > 0 ? (taxAmount / grossGain) * 100 : 0;

  return (
    <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4`}>
      {/* Header with toggle */}
      <div className="flex justify-between items-center mb-3">
        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          Tax Breakdown
        </h3>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            isDarkMode 
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Main Summary */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Gross Gain
          </div>
          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(grossGain)}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            ₪{(grossGain * usdIlsRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        
        <div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Total Tax
          </div>
          <div className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            -{formatCurrency(taxAmount)}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {effectiveTaxRate.toFixed(1)}%
          </div>
        </div>
        
        <div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Net Proceeds
          </div>
          <div className={`text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
            {formatCurrency(netGain)}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            ₪{(netGain * usdIlsRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Visual Tax Bar */}
      <div className="mb-3">
        <div className={`w-full h-6 rounded-md overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div className="h-full flex">
            <div 
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${(netGain / grossGain) * 100}%` }}
              title={`Net: ${formatCurrency(netGain)}`}
            />
            <div 
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${(taxAmount / grossGain) * 100}%` }}
              title={`Tax: ${formatCurrency(taxAmount)}`}
            />
          </div>
        </div>
        <div className="flex justify-between mt-1">
          <span className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
            Net {((netGain / grossGain) * 100).toFixed(0)}%
          </span>
          <span className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            Tax {effectiveTaxRate.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Detailed Breakdown (Collapsible) */}
      {showDetails && (
        <div className={`pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="space-y-2">
            {/* Tax Components */}
            {components.income > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Ordinary Income
                  </span>
                  {grantType === 'ESPP' && esppDiscount && (
                    <span className={`text-xs ml-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      ({(esppDiscount * 100).toFixed(0)}% discount)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(components.income)}
                  </div>
                  {components.incomeTax > 0 && (
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Tax: {formatCurrency(components.incomeTax)} (47%)
                    </div>
                  )}
                </div>
              </div>
            )}

            {components.capitalGains > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Capital Gains
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(components.capitalGains)}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Tax: {formatCurrency(components.capitalGainsTax)} (25%)
                  </div>
                </div>
              </div>
            )}

            {/* Section 102 Status */}
            {(grantType === 'Options' || grantType === 'ESPP') && (
              <div className={`flex items-center justify-between pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Tax Status
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  isSection102 && holdingPeriodMet
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : isSection102
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {isSection102 && holdingPeriodMet
                    ? 'Section 102 Qualified'
                    : isSection102
                    ? 'Section 102 (Holding Period Not Met)'
                    : 'Non-Section 102'}
                </span>
              </div>
            )}

            {/* ESPP Specific Info */}
            {grantType === 'ESPP' && (components as any).note && (
              <div className={`text-xs italic ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} pt-2`}>
                ⚠️ {(components as any).note}
              </div>
            )}

            {/* Calculation Formula */}
            <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="font-semibold mb-1">Calculation:</div>
              <div className="space-y-1 font-mono text-xs">
                <div>Shares: {amount.toLocaleString()}</div>
                <div>Exercise Price: {formatCurrency(exercisePrice)}</div>
                {grantType !== 'RSUs' && (
                  <div>Grant Price: {formatCurrency(grantPrice)}</div>
                )}
                <div className="pt-1 border-t border-dashed">
                  = {formatCurrency(grossGain)} gross
                </div>
                <div className="text-red-500">- {formatCurrency(taxAmount)} tax</div>
                <div className="font-semibold text-green-500">
                  = {formatCurrency(netGain)} net
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};