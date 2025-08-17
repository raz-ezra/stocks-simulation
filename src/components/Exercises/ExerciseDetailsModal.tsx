import React from 'react';
import { Exercise, Grant } from '../../types';
import { useThemeStore } from '../../stores/useThemeStore';
import { useTaxSettingsStore } from '../../stores/useTaxSettingsStore';
import { formatCurrency, formatDate, calculateESPPTax } from '../../utils/calculations';
import { hasMetSection102HoldingPeriod } from '../../utils/section102';

interface ExerciseDetailsModalProps {
  exercise: Exercise | null;
  grant: Grant | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExerciseDetailsModal: React.FC<ExerciseDetailsModalProps> = ({
  exercise,
  grant,
  isOpen,
  onClose,
}) => {
  const { isDarkMode } = useThemeStore();
  const { marginalTaxRate, useProgressiveTax } = useTaxSettingsStore();

  if (!isOpen || !exercise || !grant) return null;

  // Calculate tax breakdown based on grant type
  const calculateTaxBreakdown = () => {
    const grossGain = exercise.beforeTax;
    const amount = exercise.amount;
    
    if (grant.type === 'RSUs') {
      const taxAmount = grossGain - exercise.calculatedNet;
      
      // Check if Section 102 applies at the time of exercise
      const exerciseDate = exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate);
      const section102Eligible = grant.isSection102 !== false && hasMetSection102HoldingPeriod(grant, exerciseDate);
      
      if (section102Eligible) {
        // With Section 102: Grant price is ordinary income, appreciation is capital gains
        const grantValue = grant.price * amount;
        const appreciation = grossGain - grantValue;
        const ordinaryTax = grantValue * 0.47; // Or use marginal rate
        const capitalTax = appreciation * 0.25;
        
        return {
          grossGain,
          ordinaryIncome: grantValue,
          capitalGains: appreciation,
          ordinaryIncomeTax: ordinaryTax,
          capitalGainsTax: capitalTax,
          totalTax: ordinaryTax + capitalTax,
          netGain: exercise.calculatedNet,
          effectiveRate: ((ordinaryTax + capitalTax) / grossGain) * 100,
        };
      } else {
        // Without Section 102: Everything is ordinary income
        return {
          grossGain,
          ordinaryIncome: grossGain,
          capitalGains: 0,
          ordinaryIncomeTax: taxAmount,
          capitalGainsTax: 0,
          totalTax: taxAmount,
          netGain: exercise.calculatedNet,
          effectiveRate: (taxAmount / grossGain) * 100,
        };
      }
    } else if (grant.type === 'Options') {
      const gain = (exercise.exercisePrice - grant.price) * amount;
      const taxAmount = grossGain - exercise.calculatedNet;
      
      if (grant.isSection102 && hasMetSection102HoldingPeriod(grant)) {
        const incomeComponent = grant.price * amount;
        const capitalGainsComponent = gain - incomeComponent;
        return {
          grossGain,
          ordinaryIncome: incomeComponent,
          capitalGains: capitalGainsComponent,
          ordinaryIncomeTax: incomeComponent * 0.47,
          capitalGainsTax: capitalGainsComponent * 0.25,
          totalTax: taxAmount,
          netGain: exercise.calculatedNet,
          effectiveRate: (taxAmount / grossGain) * 100,
        };
      } else {
        return {
          grossGain,
          ordinaryIncome: 0,
          capitalGains: gain,
          ordinaryIncomeTax: 0,
          capitalGainsTax: gain * 0.25,
          totalTax: taxAmount,
          netGain: exercise.calculatedNet,
          effectiveRate: 25,
        };
      }
    } else { // ESPP
      const discount = grant.esppDiscount || 0.15;
      const fairMarketValueAtPurchase = grant.price / (1 - discount);
      const purchaseDate = grant.purchaseDate || grant.vestingFrom;
      const monthsHeld = Math.floor(
        (new Date(exercise.exerciseDate).getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      const holdingPeriodMet = monthsHeld >= 24;
      const withTrustee = grant.esppWithTrustee || false;
      
      // Get user's marginal tax rate
      const effectiveMarginalRate = marginalTaxRate !== null && !useProgressiveTax 
        ? marginalTaxRate 
        : 0.47; // Default to 47% if not specified
      
      const {
        discountTax,
        capitalGainsTax,
        totalTax,
        ordinaryIncomeAmount,
        capitalGainsAmount,
        trusteeTaxWithheld,
        note
      } = calculateESPPTax(
        grant.price,
        fairMarketValueAtPurchase,
        exercise.exercisePrice,
        amount,
        withTrustee,
        holdingPeriodMet,
        effectiveMarginalRate
      );
      
      return {
        grossGain,
        ordinaryIncome: ordinaryIncomeAmount,
        capitalGains: capitalGainsAmount,
        ordinaryIncomeTax: discountTax,
        capitalGainsTax,
        totalTax,
        trusteeTaxWithheld,
        netGain: exercise.calculatedNet,
        effectiveRate: (totalTax / grossGain) * 100,
        discountAmount: (fairMarketValueAtPurchase - grant.price) * amount,
        appreciationAmount: (exercise.exercisePrice - fairMarketValueAtPurchase) * amount,
        esppNote: note,
      };
    }
  };

  const breakdown = calculateTaxBreakdown();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Exercise Details
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {grant.ticker} - {grant.type} - {formatDate(exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate))}
            </p>
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

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
          {/* Transaction Summary */}
          <div className={`rounded-lg p-4 mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Transaction Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Shares
                </div>
                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {exercise.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {grant.type === 'RSUs' ? 'Vesting Price' : 'Purchase Price'}
                </div>
                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatCurrency(grant.price)}
                </div>
              </div>
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Sale Price
                </div>
                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatCurrency(exercise.exercisePrice)}
                </div>
              </div>
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  USD/ILS Rate
                </div>
                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {Number(exercise.usdIlsRate).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Transaction Breakdown */}
          <div className={`rounded-lg p-4 mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Detailed Transaction Breakdown
            </h3>
            
            {/* Grant Type Specific Breakdown */}
            {grant.type === 'ESPP' && (
              <div className={`space-y-2 mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    ESPP Components
                  </div>
                  {grant.isSection102 && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate))
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      Section 102 {hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate)) ? '✓' : '(2yr pending)'}
                    </span>
                  )}
                </div>
                
                {/* Your Investment */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Your Investment (Not Taxed)
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {exercise.amount} shares × {formatCurrency(grant.price)}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatCurrency(exercise.amount * grant.price)}
                  </div>
                </div>
                
                {/* Discount Benefit */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-xs ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      Discount Benefit ({((grant.esppDiscount || 0.15) * 100).toFixed(0)}% discount)
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Market price at purchase: {formatCurrency(grant.price / (1 - (grant.esppDiscount || 0.15)))}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {formatCurrency((breakdown as any).discountAmount || 0)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                      Tax: -{formatCurrency(breakdown.ordinaryIncomeTax)} (Ordinary Income)
                    </div>
                  </div>
                </div>
                
                {/* Appreciation */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      Stock Appreciation
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      From {formatCurrency(grant.price / (1 - (grant.esppDiscount || 0.15)))} to {formatCurrency(exercise.exercisePrice)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {formatCurrency((breakdown as any).appreciationAmount || 0)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                      Tax: -{formatCurrency(breakdown.capitalGainsTax)} (25% Capital Gains{grant.isSection102 ? ' - Section 102' : ''})
                    </div>
                  </div>
                </div>
                
                {/* Total Sale */}
                <div className={`pt-2 mt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Total Sale Proceeds
                    </div>
                    <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(breakdown.grossGain)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {grant.type === 'RSUs' && (
              <div className={`space-y-2 mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    RSU Components
                  </div>
                  {grant.isSection102 && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate))
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      Section 102 {hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate)) ? '✓' : '(2yr pending)'}
                    </span>
                  )}
                </div>
                
                {/* Grant Value at Vesting */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-xs ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      Grant Value at Vesting
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {exercise.amount} shares × {formatCurrency(grant.price)} (vesting price)
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {formatCurrency(exercise.amount * grant.price)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                      Tax: -{formatCurrency(breakdown.ordinaryIncomeTax || (exercise.amount * grant.price * 0.47))} (Ordinary Income)
                    </div>
                  </div>
                </div>
                
                {/* Appreciation (if Section 102) */}
                {grant.isSection102 !== false && hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate)) && exercise.exercisePrice > grant.price && (
                  <div className="flex justify-between items-center">
                    <div>
                      <div className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        Stock Appreciation (Section 102)
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        From {formatCurrency(grant.price)} to {formatCurrency(exercise.exercisePrice)}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {formatCurrency((exercise.exercisePrice - grant.price) * exercise.amount)}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                        Tax: -{formatCurrency(breakdown.capitalGainsTax || ((exercise.exercisePrice - grant.price) * exercise.amount * 0.25))} (25% Capital Gains)
                      </div>
                    </div>
                  </div>
                )}
                
                {/* No Section 102 - All Ordinary Income */}
                {(grant.isSection102 === false || !hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate))) && exercise.exercisePrice > grant.price && (
                  <div className="flex justify-between items-center">
                    <div>
                      <div className={`text-xs ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        Stock Appreciation (No Section 102 Benefit)
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        From {formatCurrency(grant.price)} to {formatCurrency(exercise.exercisePrice)}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        {formatCurrency((exercise.exercisePrice - grant.price) * exercise.amount)}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                        Tax: -{formatCurrency(((exercise.exercisePrice - grant.price) * exercise.amount * 0.47))} (Ordinary Income)
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Total Sale */}
                <div className={`pt-2 mt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Total Sale Proceeds
                    </div>
                    <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(exercise.amount * exercise.exercisePrice)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {grant.type === 'Options' && (
              <div className={`space-y-2 mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    Options Components
                  </div>
                  {grant.isSection102 && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate))
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      Section 102 {hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate)) ? '✓' : '(2yr pending)'}
                    </span>
                  )}
                </div>
                
                {/* Strike Price */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Your Cost (Strike Price)
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {exercise.amount} shares × {formatCurrency(grant.price)}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatCurrency(exercise.amount * grant.price)}
                  </div>
                </div>
                
                {/* Gain */}
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      Capital Gain
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Sale price {formatCurrency(exercise.exercisePrice)} - Strike {formatCurrency(grant.price)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {formatCurrency((exercise.exercisePrice - grant.price) * exercise.amount)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                      Tax: -{formatCurrency(breakdown.totalTax)} (25%)
                    </div>
                  </div>
                </div>
                
                {/* Total Sale */}
                <div className={`pt-2 mt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Total Sale Proceeds
                    </div>
                    <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(exercise.amount * exercise.exercisePrice)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Tax Summary
            </h3>
            
            {/* Visual Bar */}
            <div className="mb-4">
              <div className={`w-full h-8 rounded-md overflow-hidden ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                <div className="h-full flex">
                  <div 
                    className="bg-green-500 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ width: `${(breakdown.netGain / breakdown.grossGain) * 100}%` }}
                  >
                    {((breakdown.netGain / breakdown.grossGain) * 100).toFixed(0)}%
                  </div>
                  <div 
                    className="bg-red-500 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ width: `${(breakdown.totalTax / breakdown.grossGain) * 100}%` }}
                  >
                    {breakdown.effectiveRate.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Components */}
            <div className="space-y-3">
              {breakdown.ordinaryIncome > 0 && (
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Ordinary Income
                      {grant.type === 'ESPP' && (
                        <span className={`text-xs ml-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          (ESPP Discount)
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatCurrency(breakdown.ordinaryIncome)} × 47%
                      {grant.type === 'ESPP' && grant.esppWithTrustee && (
                        <span className={`ml-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          (Trustee may withhold less)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      -{formatCurrency(breakdown.ordinaryIncomeTax)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      ₪{(breakdown.ordinaryIncomeTax * Number(exercise.usdIlsRate)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              )}

              {breakdown.capitalGains > 0 && (
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Capital Gains
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatCurrency(breakdown.capitalGains)} × 25%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      -{formatCurrency(breakdown.capitalGainsTax)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      ₪{(breakdown.capitalGainsTax * Number(exercise.usdIlsRate)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              )}

              <div className={`pt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <div className="flex justify-between items-center">
                  <div className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Total Tax
                  </div>
                  <div className={`text-sm font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    -{formatCurrency(breakdown.totalTax)} ({breakdown.effectiveRate.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final Values */}
          <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Final Values
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Gross Proceeds
                </span>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatCurrency(breakdown.grossGain)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Total Tax
                </span>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  -{formatCurrency(breakdown.totalTax)}
                </span>
              </div>
              <div className={`flex justify-between pt-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Net Proceeds
                </span>
                <div className="text-right">
                  <div className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {formatCurrency(breakdown.netGain)}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    ₪{(breakdown.netGain * Number(exercise.usdIlsRate)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 102 Status */}
          {grant.isSection102 && (
            <div className={`mt-4 p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
              <div className="flex items-center">
                <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    Section 102 {hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate)) ? 'Qualified' : 'Not Qualified'}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {hasMetSection102HoldingPeriod(grant, exercise.exerciseDate instanceof Date ? exercise.exerciseDate : new Date(exercise.exerciseDate)) 
                      ? 'Holding period met - eligible for capital gains treatment'
                      : 'Holding period not met - taxed as ordinary income'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ESPP Trustee Withholding Note */}
          {grant.type === 'ESPP' && grant.esppWithTrustee && (
            <div className={`mt-4 p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
              <div className="flex items-start">
                <svg className={`w-5 h-5 mr-2 mt-0.5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    Trustee Withholding vs Actual Tax Owed
                  </div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    The trustee doesn't know your salary and withholds at the maximum rate (62%) on the discount portion.
                    However, you actually owe tax based on YOUR marginal rate (which may be lower).
                  </div>
                  {(breakdown as any).trusteeTaxWithheld && (
                    <div className={`mt-2 p-2 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Trustee Withholds (62% on discount):
                        </span>
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                          {formatCurrency((breakdown as any).trusteeTaxWithheld)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          You Actually Owe:
                        </span>
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {formatCurrency(breakdown.totalTax)}
                        </span>
                      </div>
                      {(breakdown as any).trusteeTaxWithheld > breakdown.totalTax && (
                        <div className={`text-xs mt-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          💡 You may be eligible for a refund of {formatCurrency((breakdown as any).trusteeTaxWithheld - breakdown.totalTax)} when filing your annual tax return
                        </div>
                      )}
                    </div>
                  )}
                  {(breakdown as any).esppNote && (
                    <div className={`text-xs mt-2 italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(breakdown as any).esppNote}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actual vs Calculated */}
          {exercise.actualNet && (
            <div className={`mt-4 p-3 rounded-lg ${
              Math.abs(exercise.actualNet - exercise.calculatedNet) > 100 
                ? isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'
                : isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
            }`}>
              <div className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Actual vs Calculated
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Calculated Net
                  </div>
                  <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(exercise.calculatedNet)}
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Actual Net Received
                  </div>
                  <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {exercise.actualNetCurrency === 'ILS' 
                      ? `₪${exercise.actualNet.toLocaleString()}`
                      : formatCurrency(exercise.actualNet)}
                  </div>
                </div>
              </div>
              {Math.abs(exercise.actualNet - exercise.calculatedNet) > 100 && (
                <div className={`text-xs mt-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  ⚠️ Difference of {formatCurrency(Math.abs(exercise.actualNet - exercise.calculatedNet))} detected
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};