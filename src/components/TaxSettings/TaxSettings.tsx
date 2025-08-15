import React, { useState } from 'react';
import { useTaxSettingsStore } from '../../stores/useTaxSettingsStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { CollapsiblePanel } from '../UI/CollapsiblePanel';
import { TaxBracketsModal } from './TaxBracketsModal';

export const TaxSettings: React.FC = () => {
  const [showTaxBrackets, setShowTaxBrackets] = useState(false);
  
  const {
    marginalTaxRate,
    annualIncome,
    useProgressiveTax,
    isControllingShareholder,
    setMarginalTaxRate,
    setAnnualIncome,
    setUseProgressiveTax,
    setIsControllingShareholder,
  } = useTaxSettingsStore();
  
  const { isDarkMode } = useThemeStore();

  const taxBrackets = [
    { rate: 0.10, range: '0 - 79,560 ₪', monthly: '0 - 6,630 ₪' },
    { rate: 0.14, range: '79,561 - 114,120 ₪', monthly: '6,631 - 9,510 ₪' },
    { rate: 0.20, range: '114,121 - 177,360 ₪', monthly: '9,511 - 14,780 ₪' },
    { rate: 0.31, range: '177,361 - 247,440 ₪', monthly: '14,781 - 20,620 ₪' },
    { rate: 0.35, range: '247,441 - 514,920 ₪', monthly: '20,621 - 42,910 ₪' },
    { rate: 0.47, range: '514,921 - 663,240 ₪', monthly: '42,911 - 55,270 ₪' },
    { rate: 0.50, range: 'Above 721,560 ₪', monthly: 'Above 60,130 ₪' },
  ];

  const handleTaxMethodChange = (method: 'progressive' | 'marginal' | 'income') => {
    if (method === 'progressive') {
      setUseProgressiveTax(true);
      setMarginalTaxRate(null);
      setAnnualIncome(null);
    } else if (method === 'marginal') {
      setUseProgressiveTax(false);
      if (marginalTaxRate === null) {
        setMarginalTaxRate(0.47); // Default to common bracket
      }
    } else if (method === 'income') {
      setUseProgressiveTax(true);
      setMarginalTaxRate(null);
      if (annualIncome === null) {
        setAnnualIncome(300000); // Default annual income
      }
    }
  };

  const getCurrentMethod = () => {
    if (annualIncome !== null && annualIncome > 0) return 'income';
    if (marginalTaxRate !== null && !useProgressiveTax) return 'marginal';
    return 'progressive';
  };

  return (
    <CollapsiblePanel
      title="Tax Settings"
      defaultOpen={false}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      }
    >
      <div className="space-y-6">
        {/* Tax Calculation Method */}
        <div>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            RSU Tax Calculation Method
          </h3>
          
          <div className="space-y-3">
            {/* Progressive Tax (Default) */}
            <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
              getCurrentMethod() === 'progressive'
                ? isDarkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                : isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="taxMethod"
                checked={getCurrentMethod() === 'progressive'}
                onChange={() => handleTaxMethodChange('progressive')}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Progressive Tax (Simplified)
                </div>
                <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Calculate tax as if RSU is your only income. Good for rough estimates.
                </div>
              </div>
            </label>

            {/* Annual Income Based */}
            <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
              getCurrentMethod() === 'income'
                ? isDarkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                : isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="taxMethod"
                checked={getCurrentMethod() === 'income'}
                onChange={() => handleTaxMethodChange('income')}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Based on Annual Income
                </div>
                <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Calculate additional tax on top of your existing income. Most accurate.
                </div>
                {getCurrentMethod() === 'income' && (
                  <div className="mt-3">
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Annual Income (ILS)
                    </label>
                    <input
                      type="number"
                      value={annualIncome || ''}
                      onChange={(e) => setAnnualIncome(e.target.value ? Number(e.target.value) : null)}
                      className={`w-full px-3 py-2 rounded-md ${
                        isDarkMode
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-white text-gray-900 border-gray-300'
                      } border focus:ring-2 focus:ring-blue-500`}
                      placeholder="e.g. 300000"
                    />
                  </div>
                )}
              </div>
            </label>

            {/* Fixed Marginal Rate */}
            <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
              getCurrentMethod() === 'marginal'
                ? isDarkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                : isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="taxMethod"
                checked={getCurrentMethod() === 'marginal'}
                onChange={() => handleTaxMethodChange('marginal')}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Fixed Marginal Tax Rate
                </div>
                <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Apply your current tax bracket rate to the entire RSU value.
                </div>
                {getCurrentMethod() === 'marginal' && (
                  <div className="mt-3">
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Select Your Tax Bracket
                    </label>
                    <select
                      value={marginalTaxRate || 0.47}
                      onChange={(e) => setMarginalTaxRate(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-md ${
                        isDarkMode
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-white text-gray-900 border-gray-300'
                      } border focus:ring-2 focus:ring-blue-500`}
                    >
                      {taxBrackets.map((bracket) => (
                        <option key={bracket.rate} value={bracket.rate}>
                          {(bracket.rate * 100).toFixed(0)}% - {bracket.range}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Controlling Shareholder Status */}
        <div>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Shareholder Status
          </h3>
          
          <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
            isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="checkbox"
              checked={isControllingShareholder}
              onChange={(e) => setIsControllingShareholder(e.target.checked)}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                I am a controlling shareholder (≥10% ownership)
              </div>
              <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Controlling shareholders pay 30% capital gains tax instead of 25% and are not eligible for Section 102 benefits.
              </div>
            </div>
          </label>
        </div>

        {/* Important Notes */}
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
          <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
            Important Notes
          </h4>
          <ul className={`text-xs space-y-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
            <li>• Calculations include National Insurance (ביטוח לאומי) and Health Tax on employment income</li>
            <li>• Includes surtax (מס יסף) for high earners above ₪721,560</li>
            <li>• Section 102 benefits automatically applied when 24-month holding period is met</li>
            <li>• Controlling shareholders (≥10%) pay 30% capital gains vs 25% for regular shareholders</li>
            <li>• These are estimates for planning purposes - consult a tax professional for precision</li>
          </ul>
          <div className="mt-3 pt-2 border-t border-yellow-200 dark:border-yellow-700">
            <button
              onClick={() => setShowTaxBrackets(true)}
              className={`text-xs font-medium underline hover:no-underline transition-colors ${
                isDarkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-yellow-800 hover:text-yellow-700'
              }`}
            >
              View Israeli Tax Brackets (2024/2025) →
            </button>
          </div>
        </div>
      </div>

      {/* Tax Brackets Modal */}
      <TaxBracketsModal 
        isOpen={showTaxBrackets}
        onClose={() => setShowTaxBrackets(false)}
      />
    </CollapsiblePanel>
  );
};